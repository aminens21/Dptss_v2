import * as XLSX from 'xlsx';
import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  serverTimestamp,
  DocumentReference
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { db } from '../firebase/config';
import {
  DataService,
  SPORTS_MAP,
  BASE_SPORTS,
  ConfirmedBranchTuple,
  getEffectiveConfirmedBranches,
  normalizeCategoryKey,
  stripUndefinedDeep,
  deduplicateById,
  generateSecureAccessCode
} from './dataService';
import {
  School,
  User,
  Tournament,
  Sport,
  SchoolTournamentConfirmation,
  SchoolWithdrawalRecord
} from '../types';
import { formatMoroccanPhone, isFlexibleEmailMatch, normalizeArabicName } from './utils';

export interface ParsedParticipationItem {
  sportId: string;
  sportName: string;
  category: string; // 'U12' | 'U15' | 'U18' | 'U20'
  gender: 'Male' | 'Female';
  affiliationType: 'non_club';
  rawText: string;
}

export interface RowIssueItem {
  severity: 'warning' | 'error';
  message: string;
}

export interface ParsedExcelTeacherRow {
  rowIndex: number; // 1-based Excel row index
  fullName: string;
  schoolName: string;
  schoolType: 'ابتدائي' | 'إعدادي' | 'تأهيلي';
  commune: string;
  rawCadre: string;
  teachingCadre: 'PRIMARY' | 'MIDDLE' | 'HIGH';
  email: string;
  leaseNumber: string;
  phone: string;
  participations: ParsedParticipationItem[];
  issues: RowIssueItem[];
}

export interface ParsedExcelImportPreview {
  sheetName: string;
  totalRowsRead: number;
  rows: ParsedExcelTeacherRow[];
  uniqueSchools: Array<{
    name: string;
    type: 'ابتدائي' | 'إعدادي' | 'تأهيلي';
    commune: string;
    teachersCount: number;
    sportsCount: number;
  }>;
  sportSummary: Array<{
    sportId: string;
    sportName: string;
    sportIcon: string;
    schoolsCount: number;
    branchesCount: number;
    branchesLabels: string[];
  }>;
}

export interface ImportExecutionProgress {
  phase: 'reading' | 'preparing' | 'saving' | 'done';
  message: string;
  percent: number;
}

export interface FailedImportRecordInfo {
  opKey: string;
  collection: string;
  label: string;
  rowIndex?: number;
  reason: string;
}

export interface ImportExecutionResult {
  addedSchools: number;
  existingSchoolsPreserved: number;
  addedTeachers: number;
  updatedTeachersPreserved: number;
  confirmedParticipationsMerged: number;
  newlyProgrammedTournaments: number;
  skippedRowsCount: number;
  queuedForTomorrowCount: number;
  savedLocallyMode?: boolean;
  savedLocallyOnlyDueToQuota?: boolean;
  quotaExceededMessage?: string;
  failedRecords?: FailedImportRecordInfo[];
}

interface SerializableQueuedCloudOp {
  opKey: string;
  type: 'set' | 'delete';
  col: 'schools' | 'users' | 'tournaments' | 'sports' | 'school_confirmations' | 'school_withdrawals';
  id: string;
  label: string;
  rowIndex?: number;
  merge: boolean;
  isNewDoc?: boolean;
  jsonPayload?: Record<string, any>;
  queuedAt: string;
}

interface SportColumnMapping {
  colIdx: number;
  sportId: string;
  defaultGender?: 'Male' | 'Female';
  headerLabel: string;
}

const LOCAL_STORAGE_KEYS = {
  TOURNAMENTS: 'taourirt_tournaments_data',
  SCHOOLS: 'taourirt_schools_data',
  USERS: 'local_registered_users',
  SPORTS_CONFIG: 'taourirt_sports_config',
  CONFIRMATIONS: 'app_school_confirmations',
  WITHDRAWALS: 'app_school_tournament_withdrawals',
  PENDING_WRITES: 'app_pending_firestore_writes_v1',
  CLOUD_SYNC_QUEUE: 'taourirt_excel_pending_cloud_sync_v1'
};

// Default positional columns G..P (indices 6..15 when Column A = index 0)
const POSITIONAL_SPORT_COLUMNS_G_TO_P: Array<{
  offsetFromStart: number; // 6 = G, 7 = H, ..., 15 = P
  sportId: string;
  defaultGender: 'Male' | 'Female';
  label: string;
}> = [
  { offsetFromStart: 6, sportId: 'handball', defaultGender: 'Female', label: 'كرة اليد [الإناث]' },
  { offsetFromStart: 7, sportId: 'handball', defaultGender: 'Male', label: 'كرة اليد [الذكور]' },
  { offsetFromStart: 8, sportId: 'basketball', defaultGender: 'Female', label: 'كرة السلة [الإناث]' },
  { offsetFromStart: 9, sportId: 'basketball', defaultGender: 'Male', label: 'كرة السلة [الذكور]' },
  { offsetFromStart: 10, sportId: 'volleyball', defaultGender: 'Female', label: 'الكرة الطائرة [الإناث]' },
  { offsetFromStart: 11, sportId: 'volleyball', defaultGender: 'Male', label: 'الكرة الطائرة [الذكور]' },
  { offsetFromStart: 12, sportId: 'football', defaultGender: 'Female', label: 'كرة القدم [الإناث]' },
  { offsetFromStart: 13, sportId: 'football', defaultGender: 'Male', label: 'كرة القدم [الذكور]' },
  { offsetFromStart: 14, sportId: 'badminton', defaultGender: 'Female', label: 'كرة الريشة [الإناث]' },
  { offsetFromStart: 15, sportId: 'badminton', defaultGender: 'Male', label: 'كرة الريشة [الذكور]' }
];

function sanitizeFirestoreDocId(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[\/\\?#[\]]+/g, '_')
    .replace(/^\.+$/, '_');
  return cleaned.slice(0, 240) || `id_${Date.now()}`;
}

function sanitizeEmail(raw: any): string {
  if (!raw) return '';
  let str = String(raw)
    .replace(/[\s\u200B-\u200D\uFEFF]+/g, '')
    .trim()
    .toLowerCase();
  if (!str) return '';

  if (/[\u0600-\u06FF]/.test(str)) return '';

  if (!str.includes('@')) {
    const domainMatch = str.match(
      /^([a-z0-9._+-]+?)(gmail\.com|googlemail\.com|hotmail\.com|hotmail\.fr|outlook\.com|yahoo\.com|yahoo\.fr|taalim\.ma)$/i
    );
    if (domainMatch && domainMatch[1]) {
      str = `${domainMatch[1]}@${domainMatch[2]}`;
    }
  }

  return str.includes('@') ? str : '';
}

function sanitizeLeaseNumber(raw: any): string {
  if (raw === undefined || raw === null) return '';
  const str = String(raw).trim();
  if (!str) return '';
  if (
    str.includes('لم يستلم') ||
    str.includes('لا يوجد') ||
    str.includes('غير متوفر') ||
    str.includes('بدون') ||
    str === '-' ||
    str === '--' ||
    str === '—'
  ) {
    return '';
  }
  const compact = str.replace(/[\s\-_.]/g, '');
  if (/^[a-zA-Z]{0,3}\d{4,10}$/.test(compact)) {
    return compact;
  }
  return '';
}

function parseTeachingCadre(rawCadre: string, schoolName: string): 'PRIMARY' | 'MIDDLE' | 'HIGH' {
  const c = (rawCadre || '').trim().toLowerCase();
  if (c.includes('ابتدائ') || c.includes('primary')) return 'PRIMARY';
  if (c.includes('إعداد') || c.includes('اعداد') || c.includes('middle')) return 'MIDDLE';
  if (c.includes('تأهيل') || c.includes('تاهيل') || c.includes('high')) return 'HIGH';

  const s = (schoolName || '').trim();
  if (s.includes('ابتدائ') || s.startsWith('مدرسة')) return 'PRIMARY';
  if (s.includes('إعداد') || s.includes('اعداد')) return 'MIDDLE';
  return 'HIGH';
}

function parseSchoolType(schoolName: string, teachingCadre: 'PRIMARY' | 'MIDDLE' | 'HIGH'): 'ابتدائي' | 'إعدادي' | 'تأهيلي' {
  const s = (schoolName || '').trim();
  if (s.includes('إعداد') || s.includes('اعداد')) return 'إعدادي';
  if (s.includes('تأهيل') || s.includes('تاهيل')) return 'تأهيلي';
  if (s.includes('ابتدائ') || s.startsWith('مدرسة') || s.includes('مجموعة مدارس') || s.includes('م.م')) return 'ابتدائي';

  if (teachingCadre === 'PRIMARY') return 'ابتدائي';
  if (teachingCadre === 'MIDDLE') return 'إعدادي';
  return 'تأهيلي';
}

function inferCommuneFromSchoolName(schoolName: string): string {
  const s = (schoolName || '').trim();
  if (s.includes('العيون') || s.includes('سيدي ملوك')) return 'العيون سيدي ملوك';
  if (s.includes('دبدو')) return 'دبدو';
  if (s.includes('ملقى الويدان') || s.includes('ملقى')) return 'ملقى الويدان';
  if (s.includes('مستكمار')) return 'مستكمار';
  if (s.includes('تنشرفي')) return 'تنشرفي';
  if (s.includes('أهل واد زا') || s.includes('اهل واد زا')) return 'أهل واد زا';
  if (s.includes('سيدي لحسن')) return 'سيدي لحسن';
  if (s.includes('سيدي علي بلقاسم')) return 'سيدي علي بلقاسم';
  if (s.includes('القطيبات')) return 'القطيبات';
  if (s.includes('عين لحجر')) return 'عين لحجر';
  if (s.includes('مشرع حمادي')) return 'مشرع حمادي';
  return 'تاوريرت';
}

export function detectSportIdFromText(text: string): string | null {
  if (!text) return null;
  const t = text.trim().toLowerCase();

  if (t.includes('يد شاطئية') || t.includes('اليد الشاطئية')) return 'beach_handball';
  if (t.includes('كرة اليد') || t.includes('كره اليد') || t.includes('الـيد') || /\bhandball\b/.test(t)) return 'handball';

  if (
    (t.includes('سلة') || t.includes('سله') || t.includes('basketball')) &&
    (t.includes('3x3') || t.includes('3×3') || t.includes('3 ضد 3') || t.includes('ثلاثية'))
  ) {
    return 'basketball_3x3';
  }
  if (t.includes('كرة السلة') || t.includes('كره السله') || t.includes('كرة سلة') || t.includes('السلة') || /\bbasketball\b/.test(t)) {
    return 'basketball';
  }

  if (t.includes('طائرة شاطئية') || t.includes('الطائرة الشاطئية')) return 'beach_volleyball';
  if ((t.includes('طائرة') || t.includes('طائره')) && t.includes('مختلط')) return 'mixed_volleyball';
  if (t.includes('كرة الطائرة') || t.includes('الكرة الطائرة') || t.includes('كره الطائره') || t.includes('الطائرة') || /\bvolleyball\b/.test(t)) {
    return 'volleyball';
  }

  if (t.includes('فوتسال') || t.includes('داخل القاعة') || t.includes('القاعة') || /\bfutsal\b/.test(t)) return 'futsal';
  if (t.includes('كرة القدم') || t.includes('كره القدم') || t.includes('القدم') || /\bfootball\b/.test(t)) return 'football';

  if (
    t.includes('كرة الريشة') ||
    t.includes('كره الريشه') ||
    t.includes('الريشة') ||
    t.includes('الريشه') ||
    t.includes('بادمنتون') ||
    t.includes('البادمنتون') ||
    /\bbadminton\b/.test(t)
  ) {
    return 'badminton';
  }

  if (t.includes('عدو ريفي') || t.includes('العدو الريفي') || t.includes('عدو') || /\bcross/.test(t)) return 'cross_country';
  if (t.includes('ألعاب القوى') || t.includes('العاب القوى') || t.includes('القوى') || /\bathletics\b/.test(t)) return 'athletics';
  if (t.includes('طاولة') || t.includes('تنس الطاولة') || /\btable_tennis\b/.test(t)) return 'table_tennis';
  if (t.includes('شطرنج') || /\bchess\b/.test(t)) return 'chess';
  if (t.includes('جيدو') || t.includes('جودو') || /\bjudo\b/.test(t)) return 'judo';
  if (t.includes('كراطي') || t.includes('كاراتي') || /\bkarate\b/.test(t)) return 'karate';
  if (t.includes('ملاكمة') || /\bboxing\b/.test(t)) return 'boxing';
  if (t.includes('ركبي') || t.includes('ريكبي') || t.includes('روغبي') || /\brugby\b/.test(t)) return 'rugby';

  return null;
}

export function detectGenderFromText(text: string): 'Male' | 'Female' | undefined {
  if (!text) return undefined;
  const t = text.trim();
  const hasFemale = /(إناث|اناث|الإناث|الاناث|فتيات|صغيرات|شابات|برعمات|بنات|female|filles)/i.test(t);
  const hasMale = /(ذكور|الذكور|فتيان|صغار|شبان|براعم|أولاد|اولاد|male|garçons|garcons)/i.test(t);
  if (hasFemale && !hasMale) return 'Female';
  if (hasMale && !hasFemale) return 'Male';
  return undefined;
}

function isNegativeOrEmptyCell(raw: string): boolean {
  const clean = raw.replace(/[\s"'\-_—.،,/\\()[\]]+/g, '').toLowerCase();
  if (!clean) return true;
  const negatives = [
    'لا',
    'لااشارك',
    'لاأشارك',
    'لايشارك',
    'لانشارك',
    'عدمالمشاركة',
    'عدمالمشاركه',
    'غيرمشارك',
    'بدون',
    'بدونمشاركة',
    'لاشيء',
    'لايوجد',
    'فارغ',
    'no',
    'none',
    'non',
    'null',
    'n/a',
    '0'
  ];
  return negatives.includes(clean);
}

function extractCategoriesFromSegment(
  seg: string,
  fallbackCadre: 'PRIMARY' | 'MIDDLE' | 'HIGH',
  fallbackSchoolType: 'ابتدائي' | 'إعدادي' | 'تأهيلي'
): string[] {
  const found = new Set<string>();

  if (/u\s*12/i.test(seg) || /(براعم|برعمات|البراعم|البرعمات)/.test(seg)) found.add('U12');
  if (/u\s*15/i.test(seg) || /(صغار|صغيرات|الصغار|الصغيرات)/.test(seg)) found.add('U15');
  if (/u\s*18/i.test(seg) || /(فتيان|فتيات|الفتيان|الفتيات)/.test(seg)) found.add('U18');
  if (/u\s*20/i.test(seg) || /(شبان|شابات|الشبان|الشابات|كبار|كبيرات)/.test(seg)) found.add('U20');

  if (found.size > 0) {
    return Array.from(found);
  }

  if (fallbackSchoolType === 'ابتدائي' || fallbackCadre === 'PRIMARY') return ['U12'];
  if (fallbackSchoolType === 'إعدادي' || fallbackCadre === 'MIDDLE') return ['U15'];
  return ['U18'];
}

export function parseParticipationCell(
  cellValue: any,
  columnSportId: string | null,
  columnDefaultGender: 'Male' | 'Female' | undefined,
  teacherCadre: 'PRIMARY' | 'MIDDLE' | 'HIGH',
  schoolType: 'ابتدائي' | 'إعدادي' | 'تأهيلي'
): ParsedParticipationItem[] {
  if (cellValue === undefined || cellValue === null) return [];
  const raw = String(cellValue).trim();
  if (!raw || isNegativeOrEmptyCell(raw)) return [];

  const segments = raw
    .split(/\s*(?:\/|\||\r?\n|;|،|,)\s*/)
    .map(s => s.trim())
    .filter(s => s && !isNegativeOrEmptyCell(s));

  const results: ParsedParticipationItem[] = [];
  const seen = new Set<string>();

  for (const seg of segments) {
    const resolvedSportId = detectSportIdFromText(seg) || columnSportId;
    if (!resolvedSportId) continue;

    const resolvedGender: 'Male' | 'Female' =
      detectGenderFromText(seg) || columnDefaultGender || 'Male';

    // All participations in the Excel file are strictly for non-affiliated students (غير المنتمين للأندية)
    const affiliationType: 'non_club' = 'non_club';
    const categories = extractCategoriesFromSegment(seg, teacherCadre, schoolType);
    const sportName = SPORTS_MAP[resolvedSportId]?.name || resolvedSportId;

    for (const cat of categories) {
      const normCat = normalizeCategoryKey(cat);
      const key = `${resolvedSportId}__${affiliationType}__${normCat}__${resolvedGender}`;
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          sportId: resolvedSportId,
          sportName,
          category: normCat,
          gender: resolvedGender,
          affiliationType,
          rawText: seg
        });
      }
    }
  }

  return results;
}

function isHeaderRowCandidate(row: any[]): boolean {
  if (!Array.isArray(row)) return false;
  const joined = row.slice(0, 30).map(c => String(c || '').trim().toLowerCase()).join(' | ');
  let score = 0;
  if (joined.includes('الاسم والنسب') || joined.includes('الاسم الكامل')) score += 2;
  if (joined.includes('المؤسسة') || joined.includes('مقر العمل')) score += 2;
  if (joined.includes('الإطار') || joined.includes('الاطار')) score += 2;
  if (joined.includes('البريد') || joined.includes('(gmail)')) score += 2;
  if (joined.includes('رقم التأجير') || joined.includes('التأجير')) score += 2;
  if (joined.includes('رقم الهاتف') || joined.includes('الهاتف')) score += 2;
  if (joined.includes('كرة اليد') || joined.includes('كرة السلة') || joined.includes('كرة القدم')) score += 2;
  return score >= 4;
}

function looksLikeTimestampOrIndex(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  if (val instanceof Date) return true;
  const s = String(val).trim();
  if (!s) return false;
  if (/^\d{1,4}$/.test(s)) return true;
  if (/^\d{5}(\.\d+)?$/.test(s)) return true;
  if (/^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(s)) return true;
  if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(s)) return true;
  return false;
}

export function buildSummaryFromRows(rows: ParsedExcelTeacherRow[]) {
  const schoolsAgg = new Map<
    string,
    {
      name: string;
      type: 'ابتدائي' | 'إعدادي' | 'تأهيلي';
      commune: string;
      teachersSet: Set<string>;
      sportsSet: Set<string>;
    }
  >();

  const sportsAgg = new Map<
    string,
    {
      schoolsSet: Set<string>;
      branchesMap: Map<string, string>;
    }
  >();

  for (const r of rows) {
    if (r.schoolName) {
      const normSchool = normalizeArabicName(r.schoolName) || r.schoolName.trim();
      if (!schoolsAgg.has(normSchool)) {
        schoolsAgg.set(normSchool, {
          name: r.schoolName,
          type: r.schoolType,
          commune: r.commune,
          teachersSet: new Set(),
          sportsSet: new Set()
        });
      }
      const sEntry = schoolsAgg.get(normSchool)!;
      sEntry.teachersSet.add(r.leaseNumber || r.email || r.fullName);
      r.participations.forEach(p => sEntry.sportsSet.add(p.sportId));
    }

    for (const p of r.participations) {
      if (!sportsAgg.has(p.sportId)) {
        sportsAgg.set(p.sportId, {
          schoolsSet: new Set(),
          branchesMap: new Map()
        });
      }
      const spEntry = sportsAgg.get(p.sportId)!;
      if (r.schoolName) {
        spEntry.schoolsSet.add(normalizeArabicName(r.schoolName) || r.schoolName);
      }
      const branchKey = `${p.affiliationType}__${p.category}__${p.gender}`;
      const genderAr = p.gender === 'Female' ? 'إناث' : 'ذكور';
      spEntry.branchesMap.set(branchKey, `${p.category} ${genderAr} (غير منتمين)`);
    }
  }

  const uniqueSchools = Array.from(schoolsAgg.values()).map(s => ({
    name: s.name,
    type: s.type,
    commune: s.commune,
    teachersCount: s.teachersSet.size,
    sportsCount: s.sportsSet.size
  }));

  const sportSummary = Array.from(sportsAgg.entries()).map(([sportId, data]) => ({
    sportId,
    sportName: SPORTS_MAP[sportId]?.name || sportId,
    sportIcon: SPORTS_MAP[sportId]?.icon || '🏆',
    schoolsCount: data.schoolsSet.size,
    branchesCount: data.branchesMap.size,
    branchesLabels: Array.from(data.branchesMap.values())
  }));

  return { uniqueSchools, sportSummary };
}

export async function parseTeachersAndParticipationsWorkbook(file: File): Promise<ParsedExcelImportPreview> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false });

  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
    if (rawRows[i] && isHeaderRowCandidate(rawRows[i])) {
      headerRowIdx = i;
      break;
    }
  }

  let nameCol = 0;
  let schoolCol = 1;
  let cadreCol = 2;
  let emailCol = 3;
  let leaseCol = 4;
  let phoneCol = 5;
  const sportColumnsMap = new Map<number, SportColumnMapping>();

  if (headerRowIdx >= 0) {
    const headerRow = rawRows[headerRowIdx].slice(0, 60).map(c => String(c || '').trim());
    let foundName = -1;
    let foundSchool = -1;
    let foundCadre = -1;
    let foundEmail = -1;
    let foundLease = -1;
    let foundPhone = -1;

    headerRow.forEach((h, idx) => {
      const hl = h.toLowerCase();
      if (!hl) return;

      if (
        foundName === -1 &&
        (hl.includes('الاسم والنسب') ||
          hl.includes('الاسم الكامل') ||
          hl === 'الاسم' ||
          hl.includes('اسم الأستاذ') ||
          hl.includes('اسم الاستاذ'))
      ) {
        foundName = idx;
        return;
      }
      if (foundSchool === -1 && (hl.includes('المؤسسة') || hl.includes('مقر العمل') || hl.includes('الموسسة'))) {
        foundSchool = idx;
        return;
      }
      if (foundCadre === -1 && (hl.includes('الإطار') || hl.includes('الاطار') || hl.includes('السلك'))) {
        foundCadre = idx;
        return;
      }
      if (foundEmail === -1 && (hl.includes('البريد') || hl.includes('gmail') || hl.includes('email'))) {
        foundEmail = idx;
        return;
      }
      if (foundLease === -1 && (hl.includes('التأجير') || hl.includes('التاجير') || hl.includes('som') || hl.includes('ppr'))) {
        foundLease = idx;
        return;
      }
      if (foundPhone === -1 && (hl.includes('الهاتف') || hl.includes('النقال') || hl.includes('phone') || hl.includes('هاتف'))) {
        foundPhone = idx;
        return;
      }

      const detectedSport = detectSportIdFromText(h);
      if (detectedSport) {
        sportColumnsMap.set(idx, {
          colIdx: idx,
          sportId: detectedSport,
          defaultGender: detectGenderFromText(h),
          headerLabel: h
        });
      }
    });

    const baseOffset = foundName >= 0 ? foundName : 0;
    nameCol = foundName >= 0 ? foundName : baseOffset;
    schoolCol = foundSchool >= 0 ? foundSchool : baseOffset + 1;
    cadreCol = foundCadre >= 0 ? foundCadre : baseOffset + 2;
    emailCol = foundEmail >= 0 ? foundEmail : baseOffset + 3;
    leaseCol = foundLease >= 0 ? foundLease : baseOffset + 4;
    phoneCol = foundPhone >= 0 ? foundPhone : baseOffset + 5;

    POSITIONAL_SPORT_COLUMNS_G_TO_P.forEach(pos => {
      const targetIdx = baseOffset + pos.offsetFromStart;
      if (!sportColumnsMap.has(targetIdx)) {
        sportColumnsMap.set(targetIdx, {
          colIdx: targetIdx,
          sportId: pos.sportId,
          defaultGender: pos.defaultGender,
          headerLabel: pos.label
        });
      }
    });
  } else {
    const sampleDataRow = rawRows.find(r => Array.isArray(r) && r.filter(cell => String(cell || '').trim() !== '').length >= 3);
    const hasLeadingTimestampCol = sampleDataRow
      ? looksLikeTimestampOrIndex(sampleDataRow[0]) && /[\u0600-\u06FF]/.test(String(sampleDataRow[1] || ''))
      : false;

    const baseOffset = hasLeadingTimestampCol ? 1 : 0;
    nameCol = baseOffset;
    schoolCol = baseOffset + 1;
    cadreCol = baseOffset + 2;
    emailCol = baseOffset + 3;
    leaseCol = baseOffset + 4;
    phoneCol = baseOffset + 5;

    POSITIONAL_SPORT_COLUMNS_G_TO_P.forEach(pos => {
      const targetIdx = baseOffset + pos.offsetFromStart;
      sportColumnsMap.set(targetIdx, {
        colIdx: targetIdx,
        sportId: pos.sportId,
        defaultGender: pos.defaultGender,
        headerLabel: pos.label
      });
    });
  }

  const maxMappedSportCol = Math.max(15, ...Array.from(sportColumnsMap.keys()));

  const parsedRows: ParsedExcelTeacherRow[] = [];
  const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;
  const seenEmailRow = new Map<string, number>();
  const seenLeaseRow = new Map<string, number>();

  for (let rIdx = startRow; rIdx < rawRows.length; rIdx++) {
    const row = rawRows[rIdx];
    if (!Array.isArray(row) || row.length === 0) continue;
    if (isHeaderRowCandidate(row)) continue;

    const excelRowNum = rIdx + 1;
    const fullName = String(row[nameCol] ?? '').trim();
    const schoolName = String(row[schoolCol] ?? '').trim();
    const rawCadre = String(row[cadreCol] ?? '').trim();
    const rawEmailCell = String(row[emailCol] ?? '').trim();
    const email = sanitizeEmail(rawEmailCell);
    const rawLeaseCell = String(row[leaseCol] ?? '').trim();
    const leaseNumber = sanitizeLeaseNumber(rawLeaseCell);
    const phone = formatMoroccanPhone(row[phoneCol]);

    if (!fullName && !schoolName && !email && !leaseNumber && !phone) continue;
    if (!fullName && !schoolName) continue;

    const issues: RowIssueItem[] = [];
    if (!fullName) {
      issues.push({ severity: 'error', message: 'اسم الأستاذ(ة) فارغ في هذا الصف' });
    }
    if (!schoolName) {
      issues.push({ severity: 'error', message: 'اسم المؤسسة التعليمية فارغ (لن تُربط المشاركات بمؤسسة)' });
    }
    if (rawEmailCell && !email) {
      issues.push({ severity: 'warning', message: `صيغة البريد الإلكتروني غير صالحة (${rawEmailCell})` });
    } else if (!email) {
      issues.push({ severity: 'warning', message: 'البريد الإلكتروني غير متوفر' });
    }
    if (rawLeaseCell && !leaseNumber && !rawLeaseCell.includes('لم يستلم')) {
      issues.push({ severity: 'warning', message: `رقم التأجير غير قياسي (${rawLeaseCell})` });
    }

    if (leaseNumber) {
      if (seenLeaseRow.has(leaseNumber)) {
        issues.push({
          severity: 'warning',
          message: `رقم التأجير مكرر في الملف مع الصف رقم ${seenLeaseRow.get(leaseNumber)} (يُدمج تلقائياً أو يمكنك تجاوزه)`
        });
      } else {
        seenLeaseRow.set(leaseNumber, excelRowNum);
      }
    } else if (email) {
      if (seenEmailRow.has(email)) {
        issues.push({
          severity: 'warning',
          message: `البريد الإلكتروني مكرر في الملف مع الصف رقم ${seenEmailRow.get(email)} (يُدمج تلقائياً أو يمكنك تجاوزه)`
        });
      } else {
        seenEmailRow.set(email, excelRowNum);
      }
    }

    const teachingCadre = parseTeachingCadre(rawCadre, schoolName);
    const schoolType = parseSchoolType(schoolName, teachingCadre);
    const commune = inferCommuneFromSchoolName(schoolName);

    const rowParticipations: ParsedParticipationItem[] = [];
    const seenRowPart = new Set<string>();

    const maxColIdx = Math.min(Math.max(row.length - 1, maxMappedSportCol), 50);
    const firstParticipationCol = Math.max(phoneCol + 1, nameCol + 6);

    for (let cIdx = firstParticipationCol; cIdx <= maxColIdx; cIdx++) {
      const cellVal = row[cIdx];
      if (cellVal === undefined || cellVal === null || cellVal === '') continue;
      const cellStr = String(cellVal).trim();
      if (!cellStr) continue;

      const colMeta = sportColumnsMap.get(cIdx);
      const items = parseParticipationCell(
        cellStr,
        colMeta?.sportId || null,
        colMeta?.defaultGender,
        teachingCadre,
        schoolType
      );

      if (items.length === 0 && !isNegativeOrEmptyCell(cellStr)) {
        issues.push({
          severity: 'warning',
          message: `تعذر التعرف على الرياضة في العمود ${cIdx + 1}: "${cellStr.slice(0, 35)}"`
        });
      }

      for (const item of items) {
        const key = `${item.sportId}__${item.affiliationType}__${item.category}__${item.gender}`;
        if (!seenRowPart.has(key)) {
          seenRowPart.add(key);
          rowParticipations.push(item);
        }
      }
    }

    parsedRows.push({
      rowIndex: excelRowNum,
      fullName: fullName || 'أستاذ(ة)',
      schoolName,
      schoolType,
      commune,
      rawCadre:
        rawCadre ||
        (teachingCadre === 'HIGH'
          ? 'أستاذ التعليم الثانوي التأهيلي'
          : teachingCadre === 'MIDDLE'
          ? 'أستاذ التعليم الثانوي الإعدادي'
          : 'أستاذ التعليم الابتدائي'),
      teachingCadre,
      email,
      leaseNumber,
      phone,
      participations: rowParticipations,
      issues
    });
  }

  const { uniqueSchools, sportSummary } = buildSummaryFromRows(parsedRows);

  return {
    sheetName,
    totalRowsRead: parsedRows.length,
    rows: parsedRows,
    uniqueSchools,
    sportSummary
  };
}

type QueuedFirestoreOp =
  | {
      opKey: string;
      type: 'set';
      col: SerializableQueuedCloudOp['col'];
      id: string;
      label: string;
      rowIndex?: number;
      ref: DocumentReference;
      data: Record<string, any>;
      jsonPayload: Record<string, any>;
      isNewDoc?: boolean;
      merge: boolean;
    }
  | {
      opKey: string;
      type: 'delete';
      col: SerializableQueuedCloudOp['col'];
      id: string;
      label: string;
      rowIndex?: number;
      ref: DocumentReference;
    };

function safeReadLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWriteLocalArray<T extends { id?: string }>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(deduplicateById(items)));
  } catch (err) {
    console.warn('Local storage write warning:', err);
  }
}

function buildDefaultSportsListFromLocal(): Sport[] {
  const local = safeReadLocalArray<Sport>(LOCAL_STORAGE_KEYS.SPORTS_CONFIG);
  const byId = new Map<string, Sport>();
  local.forEach(s => {
    if (s && s.id) byId.set(s.id, s);
  });
  Object.entries(BASE_SPORTS).forEach(([id, meta]) => {
    if (!byId.has(id)) {
      byId.set(id, {
        id,
        name: meta.name,
        description: (meta as any).description || meta.name,
        icon: meta.icon,
        ageCategories: ['U15', 'U18'],
        isProgrammed: false
      });
    }
  });
  return Array.from(byId.values());
}

function readCloudSyncQueue(): SerializableQueuedCloudOp[] {
  return safeReadLocalArray<SerializableQueuedCloudOp>(LOCAL_STORAGE_KEYS.CLOUD_SYNC_QUEUE);
}

function writeCloudSyncQueue(items: SerializableQueuedCloudOp[]): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEYS.CLOUD_SYNC_QUEUE, JSON.stringify(items));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pendingCloudSyncUpdated'));
    }
  } catch (err) {
    console.warn('Failed to persist cloud sync queue:', err);
  }
}

export function getPendingCloudSyncCount(): number {
  return readCloudSyncQueue().length;
}

function enqueueSerializableOpsForTomorrow(ops: QueuedFirestoreOp[]): number {
  const existing = readCloudSyncQueue();
  const map = new Map<string, SerializableQueuedCloudOp>();
  existing.forEach(item => {
    if (item && item.opKey) map.set(item.opKey, item);
  });

  const nowIso = new Date().toISOString();
  for (const op of ops) {
    if (op.type === 'delete') {
      map.set(op.opKey, {
        opKey: op.opKey,
        type: 'delete',
        col: op.col,
        id: op.id,
        label: op.label,
        rowIndex: op.rowIndex,
        merge: false,
        queuedAt: nowIso
      });
    } else {
      map.set(op.opKey, {
        opKey: op.opKey,
        type: 'set',
        col: op.col,
        id: op.id,
        label: op.label,
        rowIndex: op.rowIndex,
        merge: op.merge,
        isNewDoc: op.isNewDoc,
        jsonPayload: op.jsonPayload,
        queuedAt: nowIso
      });
    }
  }

  const finalQueue = Array.from(map.values());
  writeCloudSyncQueue(finalQueue);
  return finalQueue.length;
}

function removeSucceededOpsFromTomorrowQueue(opKeys: string[]): void {
  if (opKeys.length === 0) return;
  const removeSet = new Set(opKeys);
  const remaining = readCloudSyncQueue().filter(item => !removeSet.has(item.opKey));
  writeCloudSyncQueue(remaining);
}

function bulkMarkPendingWrites(ops: Array<{ type: 'set' | 'delete'; col: string; id: string }>): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.PENDING_WRITES);
    const map: Record<string, string[]> = raw ? JSON.parse(raw) : {};
    for (const op of ops) {
      if (op.type !== 'set') continue;
      const set = new Set(map[op.col] || []);
      set.add(op.id);
      map[op.col] = Array.from(set);
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.PENDING_WRITES, JSON.stringify(map));
  } catch {
    // ignore quota errors
  }
}

function bulkClearPendingWrites(ops: Array<{ col: string; id: string }>): void {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEYS.PENDING_WRITES);
    if (!raw) return;
    const map: Record<string, string[]> = JSON.parse(raw);
    const idsByCol = new Map<string, Set<string>>();
    for (const op of ops) {
      if (!idsByCol.has(op.col)) idsByCol.set(op.col, new Set());
      idsByCol.get(op.col)!.add(op.id);
    }
    for (const [col, ids] of idsByCol.entries()) {
      if (Array.isArray(map[col])) {
        map[col] = map[col].filter(x => !ids.has(x));
      }
    }
    localStorage.setItem(LOCAL_STORAGE_KEYS.PENDING_WRITES, JSON.stringify(map));
  } catch {
    // ignore
  }
}

/**
 * Checks whether Firestore Cloud is currently returning HTTP 429 RESOURCE_EXHAUSTED ("Quota exceeded.")
 */
export async function probeFirestoreQuotaStatus(): Promise<{ quotaExceeded: boolean; rawMessage?: string }> {
  try {
    const projectId = (firebaseConfig as any).projectId;
    const apiKey = (firebaseConfig as any).apiKey;
    const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';
    if (!projectId || !apiKey) return { quotaExceeded: false };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      projectId
    )}/databases/${encodeURIComponent(databaseId)}/documents/config/logos?key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);

    if (res.status === 429) {
      const json = await res.json().catch(() => ({}));
      const msg = json?.error?.message || 'Quota exceeded.';
      return { quotaExceeded: true, rawMessage: msg };
    }
    return { quotaExceeded: false };
  } catch {
    return { quotaExceeded: false };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, timeoutCode = 'COMMIT_TIMEOUT'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutCode));
    }, ms);
    promise
      .then(val => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function sanitizeForFirestoreWrite(val: any): any {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) ? val : 0;
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date() : val;
  }
  if (
    typeof val !== 'object' ||
    (val as any)?._methodName !== undefined ||
    typeof (val as any)?.toMillis === 'function'
  ) {
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .filter(item => item !== undefined)
      .map(item => sanitizeForFirestoreWrite(item));
  }
  const out: Record<string, any> = {};
  for (const k of Object.keys(val)) {
    const v = sanitizeForFirestoreWrite(val[k]);
    if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

function rehydrateQueuedItemToFirestoreData(item: SerializableQueuedCloudOp): Record<string, any> {
  const base = { ...(item.jsonPayload || {}) };
  if (item.col === 'tournaments') {
    const toTs = (v: any) => {
      if (!v) return Timestamp.fromDate(new Date());
      const d = new Date(v);
      return isNaN(d.getTime()) ? Timestamp.fromDate(new Date()) : Timestamp.fromDate(d);
    };
    return sanitizeForFirestoreWrite(
      stripUndefinedDeep({
        ...base,
        startDate: toTs(base.startDate),
        endDate: toTs(base.endDate),
        registrationDeadline: toTs(base.registrationDeadline),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    );
  }
  if (item.col === 'schools' || item.col === 'users') {
    return sanitizeForFirestoreWrite(
      stripUndefinedDeep({
        ...base,
        ...(item.isNewDoc ? { createdAt: serverTimestamp() } : {}),
        updatedAt: serverTimestamp()
      })
    );
  }
  if (item.col === 'sports') {
    return sanitizeForFirestoreWrite(
      stripUndefinedDeep({
        ...base,
        updatedAt: serverTimestamp()
      })
    );
  }
  return sanitizeForFirestoreWrite(stripUndefinedDeep(base));
}

/**
 * Syncs all locally saved Excel records (`taourirt_excel_pending_cloud_sync_v1`) to Firestore
 * once the daily free-tier quota resets tomorrow.
 */
export async function syncPendingLocalImportsToCloud(
  onProgress?: (synced: number, total: number) => void
): Promise<{
  syncedCount: number;
  remainingCount: number;
  quotaStillExceeded: boolean;
}> {
  const queue = readCloudSyncQueue();
  if (queue.length === 0) {
    return { syncedCount: 0, remainingCount: 0, quotaStillExceeded: false };
  }

  const quota = await probeFirestoreQuotaStatus();
  if (quota.quotaExceeded) {
    return {
      syncedCount: 0,
      remainingCount: queue.length,
      quotaStillExceeded: true
    };
  }

  if (DataService.isCloudSyncPaused()) {
    return {
      syncedCount: 0,
      remainingCount: queue.length,
      quotaStillExceeded: false
    };
  }

  const CHUNK_SIZE = 35;
  const succeededKeys: string[] = [];
  const succeededColIds: Array<{ col: string; id: string }> = [];

  for (let offset = 0; offset < queue.length; offset += CHUNK_SIZE) {
    const chunk = queue.slice(offset, offset + CHUNK_SIZE);
    const batch = writeBatch(db);

    for (const item of chunk) {
      const ref = doc(db, item.col, sanitizeFirestoreDocId(item.id));
      if (item.type === 'delete') {
        batch.delete(ref);
      } else {
        const firestoreData = rehydrateQueuedItemToFirestoreData(item);
        if (item.merge) {
          batch.set(ref, firestoreData, { merge: true });
        } else {
          batch.set(ref, firestoreData);
        }
      }
    }

    try {
      await withTimeout(batch.commit(), 10000, 'SYNC_BATCH_TIMEOUT');
      chunk.forEach(c => {
        succeededKeys.push(c.opKey);
        succeededColIds.push({ col: c.col, id: c.id });
      });
      if (onProgress) {
        onProgress(succeededKeys.length, queue.length);
      }
    } catch {
      const recheck = await probeFirestoreQuotaStatus();
      if (recheck.quotaExceeded) {
        break;
      }
    }
  }

  if (succeededKeys.length > 0) {
    removeSucceededOpsFromTomorrowQueue(succeededKeys);
    bulkClearPendingWrites(succeededColIds);
  }

  const remaining = getPendingCloudSyncCount();
  return {
    syncedCount: succeededKeys.length,
    remainingCount: remaining,
    quotaStillExceeded: remaining > 0
  };
}

/**
 * Purely additive Excel import supporting BOTH:
 * 1) Instant Local Save Mode (`localOnly: true`) — 0ms cloud wait, saves 100% locally and queues for tomorrow's cloud sync.
 * 2) Cloud Batch Mode (`localOnly: false`) — checks quota in 200ms; if quota exceeded, automatically falls back to Instant Local Save.
 */
export async function executeAdditiveExcelImport(
  preview: ParsedExcelImportPreview,
  options: {
    directorateId?: string;
    seasonId?: string;
    autoProgramMissingTournaments?: boolean;
    localOnly?: boolean;
    excludedRowIndices?: Set<number>;
    excludedOpKeys?: Set<string>;
    onProgress?: (progress: ImportExecutionProgress) => void;
  } = {}
): Promise<ImportExecutionResult> {
  const activeDirId =
    options.directorateId && options.directorateId !== 'all'
      ? options.directorateId
      : DataService.getActiveDirectorateId() || 'taourirt';
  const effectiveDirId = activeDirId === 'all' ? 'taourirt' : activeDirId;
  const autoProgram = options.autoProgramMissingTournaments !== false;
  const forceLocalOnly = options.localOnly === true;
  const excludedRowIndices = options.excludedRowIndices || new Set<number>();
  const excludedOpKeys = options.excludedOpKeys || new Set<string>();
  const report = options.onProgress || (() => {});

  const activeRows = preview.rows.filter(r => !excludedRowIndices.has(r.rowIndex));
  const skippedRowsCount = preview.rows.length - activeRows.length;

  report({
    phase: 'reading',
    message: forceLocalOnly
      ? 'جاري قراءة البيانات المحلية الحالية لدمج المعطيات الجديدة بدون حذف...'
      : 'جاري فحص حالة السحابة وقراءة المعطيات الحالية...',
    percent: 20
  });

  // Check quota FIRST (200ms) before attempting any Firestore getDocs calls so we never wait 6s when quota is exhausted!
  const quotaCheck = forceLocalOnly ? { quotaExceeded: false } : await probeFirestoreQuotaStatus();
  const shouldReadFromLocalCacheOnly = forceLocalOnly || quotaCheck.quotaExceeded;

  let allSchools: School[];
  let existingUsers: User[];
  let allConfirmations: SchoolTournamentConfirmation[];
  let allTournaments: Tournament[];
  let sportsConfig: Sport[];
  let activeSeason: string;

  if (shouldReadFromLocalCacheOnly) {
    allSchools = safeReadLocalArray<School>(LOCAL_STORAGE_KEYS.SCHOOLS);
    existingUsers = safeReadLocalArray<User>(LOCAL_STORAGE_KEYS.USERS);
    allConfirmations = safeReadLocalArray<SchoolTournamentConfirmation>(LOCAL_STORAGE_KEYS.CONFIRMATIONS);
    allTournaments = safeReadLocalArray<Tournament>(LOCAL_STORAGE_KEYS.TOURNAMENTS);
    sportsConfig = buildDefaultSportsListFromLocal();
    activeSeason = options.seasonId || localStorage.getItem('taourirt_active_season') || '2026/2027';
  } else {
    const [sList, uList, cList, tList, spList, seasonStr] = await Promise.all([
      withTimeout(DataService.getSchools('all', true), 4000).catch(() =>
        safeReadLocalArray<School>(LOCAL_STORAGE_KEYS.SCHOOLS)
      ),
      withTimeout(DataService.getUsers(), 4000).catch(() =>
        safeReadLocalArray<User>(LOCAL_STORAGE_KEYS.USERS)
      ),
      withTimeout(DataService.getSchoolConfirmations('all'), 4000).catch(() =>
        safeReadLocalArray<SchoolTournamentConfirmation>(LOCAL_STORAGE_KEYS.CONFIRMATIONS)
      ),
      withTimeout(DataService.getTournaments('all', true), 4000).catch(() =>
        safeReadLocalArray<Tournament>(LOCAL_STORAGE_KEYS.TOURNAMENTS)
      ),
      withTimeout(DataService.getSportsConfig(), 4000).catch(() => buildDefaultSportsListFromLocal()),
      options.seasonId
        ? Promise.resolve(options.seasonId)
        : withTimeout(DataService.getActiveSeason(), 3000).catch(() => '2026/2027')
    ]);
    allSchools = sList;
    existingUsers = uList;
    allConfirmations = cList;
    allTournaments = tList;
    sportsConfig = spList;
    activeSeason = seasonStr || '2026/2027';
  }

  report({
    phase: 'preparing',
    message: 'جاري تجهيز وتجميع كافة المؤسسات والأساتذة والمشاركات في الذاكرة...',
    percent: 55
  });

  let addedSchools = 0;
  let existingSchoolsPreserved = 0;
  let addedTeachers = 0;
  let updatedTeachersPreserved = 0;
  let confirmedParticipationsMerged = 0;
  let newlyProgrammedTournaments = 0;

  const queuedOpsMap = new Map<string, QueuedFirestoreOp>();

  // --- 1. PREPARE SCHOOLS IN MEMORY ---
  const schoolsById = new Map<string, School>();
  const dirSchoolByNormName = new Map<string, School>();

  allSchools.forEach(s => {
    if (!s || !s.id) return;
    schoolsById.set(s.id, s);
    if ((s.directorateId || 'taourirt') === effectiveDirId && s.name) {
      const norm = normalizeArabicName(s.name);
      if (norm && !dirSchoolByNormName.has(norm)) {
        dirSchoolByNormName.set(norm, s);
      }
    }
  });

  const processedSchoolNorms = new Set<string>();
  for (const row of activeRows) {
    if (!row.schoolName) continue;
    const normSchool = normalizeArabicName(row.schoolName);
    if (!normSchool || processedSchoolNorms.has(normSchool)) continue;
    processedSchoolNorms.add(normSchool);

    const existingSchool = dirSchoolByNormName.get(normSchool);
    if (existingSchool) {
      existingSchoolsPreserved++;
      const safeId = sanitizeFirestoreDocId(existingSchool.id);
      const opKey = `schools__${safeId}`;
      if (excludedOpKeys.has(opKey)) continue;

      const patch: Partial<School> = {};
      if (!existingSchool.coordinatorName && !existingSchool.teacherName && row.fullName) {
        patch.coordinatorName = row.fullName;
        patch.teacherName = row.fullName;
      }
      if (!existingSchool.phone && row.phone) {
        patch.phone = row.phone;
      }
      if (Object.keys(patch).length > 0) {
        const updatedSchool: School = { ...existingSchool, ...patch };
        schoolsById.set(existingSchool.id, updatedSchool);
        dirSchoolByNormName.set(normSchool, updatedSchool);
        const jsonPayload = stripUndefinedDeep({ ...patch, id: safeId });
        queuedOpsMap.set(opKey, {
          opKey,
          type: 'set',
          col: 'schools',
          id: safeId,
          label: `مؤسسة: ${row.schoolName}`,
          rowIndex: row.rowIndex,
          ref: doc(db, 'schools', safeId),
          jsonPayload,
          isNewDoc: false,
          data: sanitizeForFirestoreWrite({
            ...jsonPayload,
            updatedAt: serverTimestamp()
          }),
          merge: true
        });
      }
    } else {
      const newDocRef = doc(collection(db, 'schools'));
      const realId = newDocRef.id;
      const opKey = `schools__${realId}`;
      if (excludedOpKeys.has(opKey)) continue;

      const accessCode = generateSecureAccessCode();
      const cleanName = row.schoolName.trim();

      const newSchool: School = {
        id: realId,
        name: cleanName,
        type: row.schoolType,
        commune: row.commune,
        accessCode,
        directorateId: effectiveDirId,
        coordinatorName: row.fullName || '',
        teacherName: row.fullName || '',
        phone: row.phone || '',
        principalName: '',
        principalPhone: ''
      };

      schoolsById.set(realId, newSchool);
      dirSchoolByNormName.set(normSchool, newSchool);
      const jsonPayload = {
        id: realId,
        name: cleanName,
        type: newSchool.type,
        commune: newSchool.commune,
        directorateId: effectiveDirId,
        accessCode,
        coordinatorName: newSchool.coordinatorName || '',
        teacherName: newSchool.teacherName || '',
        phone: newSchool.phone || '',
        principalName: '',
        principalPhone: ''
      };

      queuedOpsMap.set(opKey, {
        opKey,
        type: 'set',
        col: 'schools',
        id: realId,
        label: `مؤسسة جديدة: ${cleanName}`,
        rowIndex: row.rowIndex,
        ref: newDocRef,
        jsonPayload,
        isNewDoc: true,
        data: sanitizeForFirestoreWrite({
          ...jsonPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }),
        merge: false
      });
      addedSchools++;
    }
  }

  // --- 2. PREPARE TEACHERS (USERS) IN MEMORY ---
  const workingUsers: User[] = [...existingUsers];
  const userIdxByLease = new Map<string, number>();
  const userIdxByEmail = new Map<string, number>();
  const userIdxByNameAndSchool = new Map<string, number>();

  const indexUserRecord = (u: User, idx: number) => {
    if (!u) return;
    if (u.leaseNumber && u.leaseNumber.trim()) {
      userIdxByLease.set(u.leaseNumber.trim(), idx);
    }
    if (u.email && !u.email.endsWith('@taourirt-sports.ma')) {
      userIdxByEmail.set(u.email.trim().toLowerCase(), idx);
    }
    if (u.fullName && u.workLocation) {
      const nk = `${normalizeArabicName(u.fullName)}__${normalizeArabicName(u.workLocation)}`;
      if (nk !== '__') userIdxByNameAndSchool.set(nk, idx);
    }
  };

  workingUsers.forEach((u, idx) => indexUserRecord(u, idx));

  const teacherRecordByRowIdx = new Map<number, User>();
  const touchedUserIdsInImport = new Set<string>();
  const nowDate = new Date();

  for (let i = 0; i < activeRows.length; i++) {
    const row = activeRows[i];
    const normSchool = row.schoolName ? normalizeArabicName(row.schoolName) : '';
    const linkedSchool = normSchool ? dirSchoolByNormName.get(normSchool) : undefined;
    const normTeacherName = normalizeArabicName(row.fullName);

    let existingIdx = -1;
    if (row.leaseNumber && userIdxByLease.has(row.leaseNumber)) {
      existingIdx = userIdxByLease.get(row.leaseNumber)!;
    } else if (row.email && userIdxByEmail.has(row.email.toLowerCase())) {
      existingIdx = userIdxByEmail.get(row.email.toLowerCase())!;
    } else if (normTeacherName && normSchool && userIdxByNameAndSchool.has(`${normTeacherName}__${normSchool}`)) {
      existingIdx = userIdxByNameAndSchool.get(`${normTeacherName}__${normSchool}`)!;
    } else if (row.email) {
      existingIdx = workingUsers.findIndex(
        u => u && u.email && !u.email.endsWith('@taourirt-sports.ma') && isFlexibleEmailMatch(u.email, row.email)
      );
    }

    if (existingIdx >= 0) {
      const prev = workingUsers[existingIdx];
      const safeUserId = sanitizeFirestoreDocId(prev.id);
      const opKey = `users__${safeUserId}`;
      if (excludedOpKeys.has(opKey)) continue;

      const hasSyntheticEmail = !prev.email || prev.email.endsWith('@taourirt-sports.ma');
      const mergedUser: User = {
        ...prev,
        id: safeUserId,
        fullName:
          prev.fullName && prev.fullName !== 'أستاذ' && prev.fullName !== 'أستاذ(ة)'
            ? prev.fullName
            : row.fullName,
        email:
          row.email && hasSyntheticEmail
            ? row.email
            : prev.email || row.email || `${safeUserId}@taourirt-sports.ma`,
        leaseNumber: prev.leaseNumber || row.leaseNumber || '',
        phone: prev.phone || row.phone || '',
        workLocation: row.schoolName || prev.workLocation || '',
        schoolId: prev.schoolId || linkedSchool?.id || undefined,
        teachingCadre: prev.teachingCadre || row.teachingCadre,
        directorateId: prev.directorateId || effectiveDirId,
        role: prev.role || 'TEACHER',
        isActive: prev.isActive !== undefined ? prev.isActive : true,
        updatedAt: nowDate
      };

      workingUsers[existingIdx] = mergedUser;
      indexUserRecord(mergedUser, existingIdx);
      teacherRecordByRowIdx.set(row.rowIndex, mergedUser);

      const jsonPayload = stripUndefinedDeep({
        id: safeUserId,
        fullName: mergedUser.fullName,
        email: mergedUser.email,
        leaseNumber: mergedUser.leaseNumber || '',
        phone: mergedUser.phone || '',
        workLocation: mergedUser.workLocation || '',
        schoolId: mergedUser.schoolId,
        teachingCadre: mergedUser.teachingCadre,
        directorateId: mergedUser.directorateId || effectiveDirId,
        role: mergedUser.role || 'TEACHER',
        isActive: mergedUser.isActive !== false
      });

      queuedOpsMap.set(opKey, {
        opKey,
        type: 'set',
        col: 'users',
        id: safeUserId,
        label: `أستاذ(ة): ${row.fullName} (${row.schoolName || 'بدون مؤسسة'})`,
        rowIndex: row.rowIndex,
        ref: doc(db, 'users', safeUserId),
        jsonPayload,
        isNewDoc: false,
        data: sanitizeForFirestoreWrite({
          ...jsonPayload,
          updatedAt: serverTimestamp()
        }),
        merge: true
      });

      if (!touchedUserIdsInImport.has(safeUserId)) {
        touchedUserIdsInImport.add(safeUserId);
        updatedTeachersPreserved++;
      }
    } else {
      const newTeacherId = `teacher_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
      const opKey = `users__${newTeacherId}`;
      if (excludedOpKeys.has(opKey)) continue;

      const newUser: User = {
        id: newTeacherId,
        fullName: row.fullName,
        email: row.email || `${newTeacherId}@taourirt-sports.ma`,
        leaseNumber: row.leaseNumber || '',
        phone: row.phone || '',
        workLocation: row.schoolName || '',
        schoolId: linkedSchool?.id || undefined,
        teachingCadre: row.teachingCadre,
        role: 'TEACHER',
        directorateId: effectiveDirId,
        isActive: true,
        createdAt: nowDate,
        updatedAt: nowDate
      };

      const newIdx = workingUsers.length;
      workingUsers.push(newUser);
      indexUserRecord(newUser, newIdx);
      teacherRecordByRowIdx.set(row.rowIndex, newUser);
      touchedUserIdsInImport.add(newTeacherId);

      const jsonPayload = stripUndefinedDeep({
        id: newTeacherId,
        fullName: newUser.fullName,
        email: newUser.email,
        leaseNumber: newUser.leaseNumber || '',
        phone: newUser.phone || '',
        workLocation: newUser.workLocation || '',
        schoolId: newUser.schoolId,
        teachingCadre: newUser.teachingCadre,
        role: 'TEACHER',
        directorateId: effectiveDirId,
        isActive: true
      });

      queuedOpsMap.set(opKey, {
        opKey,
        type: 'set',
        col: 'users',
        id: newTeacherId,
        label: `أستاذ(ة) جديد: ${row.fullName} (${row.schoolName || 'بدون مؤسسة'})`,
        rowIndex: row.rowIndex,
        ref: doc(db, 'users', newTeacherId),
        jsonPayload,
        isNewDoc: true,
        data: sanitizeForFirestoreWrite({
          ...jsonPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }),
        merge: true
      });
      addedTeachers++;
    }
  }

  // --- 3. PREPARE TOURNAMENTS & SPORT CONFIGS IN MEMORY ---
  const tournamentsById = new Map<string, Tournament>();
  allTournaments.forEach(t => {
    if (t && t.id) tournamentsById.set(t.id, t);
  });
  let workingSportsConfig: Sport[] = [...sportsConfig];

  if (autoProgram) {
    const dirTournaments = allTournaments.filter(
      t => (t.directorateId || 'taourirt') === effectiveDirId && t.status !== 'Archived'
    );

    const neededBranches = new Map<
      string,
      {
        sportId: string;
        category: string;
        gender: 'Male' | 'Female';
        affiliationType: 'non_club';
      }
    >();

    for (const row of activeRows) {
      for (const p of row.participations) {
        const key = `${p.sportId}__non_club__${p.category}__${p.gender}`;
        if (!neededBranches.has(key)) {
          neededBranches.set(key, {
            sportId: p.sportId,
            category: p.category,
            gender: p.gender,
            affiliationType: 'non_club'
          });
        }
      }
    }

    const catsBySportToEnsure = new Map<string, Set<string>>();

    for (const branch of neededBranches.values()) {
      const genLabel = branch.gender === 'Female' ? 'إناث' : 'ذكور';
      const sportLabel = SPORTS_MAP[branch.sportId]?.name || branch.sportId;

      for (const affId of ['non_club', 'club_affiliated'] as const) {
        const alreadyExists = dirTournaments.some(
          t =>
            t.sportId === branch.sportId &&
            normalizeCategoryKey(t.ageCategory) === normalizeCategoryKey(branch.category) &&
            (t.gender === branch.gender || t.gender === 'Mixed') &&
            (t.affiliationType || 'non_club') === affId
        );

        if (!alreadyExists) {
          const start = new Date();
          const end = new Date();
          end.setMonth(end.getMonth() + 3);

          const docRef = doc(collection(db, 'tournaments'));
          const realId = docRef.id;
          const opKey = `tournaments__${realId}`;

          if (!excludedOpKeys.has(opKey)) {
            const affPrefix = affId === 'club_affiliated' ? 'بطولة المنتمين للأندية' : 'بطولة غير المنتمين للأندية';
            const affShort = affId === 'club_affiliated' ? 'منتمين للأندية' : 'غير منتمين';
            const newTournament: Tournament = {
              id: realId,
              name: `${affPrefix} ${branch.category} ${genLabel}`,
              seasonId: activeSeason,
              sportId: branch.sportId,
              sportName: sportLabel,
              ageCategory: branch.category,
              gender: branch.gender,
              level: 'Primary,Middle,High',
              scope: 'Provincial',
              affiliationType: affId,
              targetAffiliations: [affId],
              startDate: start,
              endDate: end,
              registrationDeadline: end,
              status: 'Scheduled',
              description: `بطولة إقليمية ${affId === 'club_affiliated' ? 'للمنتمين للأندية' : 'لغير المنتمين للأندية'} (${sportLabel})`,
              directorateId: effectiveDirId,
              createdAt: nowDate,
              updatedAt: nowDate
            };

            tournamentsById.set(realId, newTournament);
            dirTournaments.push(newTournament);

            const jsonPayload = stripUndefinedDeep({
              ...newTournament,
              id: realId,
              startDate: start.toISOString(),
              endDate: end.toISOString(),
              registrationDeadline: end.toISOString(),
              createdAt: nowDate.toISOString(),
              updatedAt: nowDate.toISOString()
            });

            queuedOpsMap.set(opKey, {
              opKey,
              type: 'set',
              col: 'tournaments',
              id: realId,
              label: `فرع بطولة: ${sportLabel} ${branch.category} ${genLabel} (${affShort})`,
              ref: docRef,
              jsonPayload,
              isNewDoc: true,
              data: sanitizeForFirestoreWrite(
                stripUndefinedDeep({
                  ...newTournament,
                  id: realId,
                  startDate: Timestamp.fromDate(start),
                  endDate: Timestamp.fromDate(end),
                  registrationDeadline: Timestamp.fromDate(end),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                })
              ),
              merge: false
            });

            newlyProgrammedTournaments++;
          }
        }
      }

      if (!catsBySportToEnsure.has(branch.sportId)) {
        catsBySportToEnsure.set(branch.sportId, new Set());
      }
      catsBySportToEnsure.get(branch.sportId)!.add(normalizeCategoryKey(branch.category));
    }

    for (const [sportId, importedCats] of catsBySportToEnsure.entries()) {
      const safeSportId = sanitizeFirestoreDocId(sportId);
      const opKey = `sports__${safeSportId}`;
      if (excludedOpKeys.has(opKey)) continue;

      const currentSportCfg = workingSportsConfig.find(s => s.id === sportId);
      const prevCats = (currentSportCfg?.ageCategories || []).map(normalizeCategoryKey).filter(Boolean);
      const mergedCats = Array.from(new Set([...prevCats, ...Array.from(importedCats)]));
      const prevAffs = currentSportCfg?.targetAffiliations || [];
      const mergedAffs = Array.from(new Set([...prevAffs.filter(a => a === 'non_club' || a === 'club_affiliated'), 'non_club', 'club_affiliated']));

      if (mergedCats.length > prevCats.length || currentSportCfg?.isProgrammed !== true || !prevAffs.includes('club_affiliated')) {
        const existsInWorking = workingSportsConfig.some(s => s.id === sportId);
        if (existsInWorking) {
          workingSportsConfig = workingSportsConfig.map(s =>
            s.id === sportId ? { ...s, isProgrammed: true, ageCategories: mergedCats, targetAffiliations: mergedAffs } : s
          );
        } else {
          workingSportsConfig.push({
            id: sportId,
            name: SPORTS_MAP[sportId]?.name || sportId,
            description: (BASE_SPORTS as Record<string, any>)[sportId]?.description || SPORTS_MAP[sportId]?.name || sportId,
            icon: SPORTS_MAP[sportId]?.icon || '🏆',
            isProgrammed: true,
            ageCategories: mergedCats,
            targetAffiliations: mergedAffs
          });
        }

        const jsonPayload = {
          isProgrammed: true,
          ageCategories: mergedCats,
          targetAffiliations: mergedAffs
        };

        queuedOpsMap.set(opKey, {
          opKey,
          type: 'set',
          col: 'sports',
          id: safeSportId,
          label: `إعدادات الرياضة: ${SPORTS_MAP[sportId]?.name || sportId}`,
          ref: doc(db, 'sports', safeSportId),
          jsonPayload,
          isNewDoc: false,
          data: {
            ...jsonPayload,
            updatedAt: serverTimestamp()
          },
          merge: true
        });
      }
    }
  }

  // --- 4. PREPARE SCHOOL CONFIRMATIONS IN MEMORY (100% ADDITIVE UNION, NON_CLUB) ---
  const confirmationsById = new Map<string, SchoolTournamentConfirmation>();
  allConfirmations.forEach(c => {
    if (c && c.id) confirmationsById.set(c.id, c);
  });

  let workingWithdrawals = safeReadLocalArray<SchoolWithdrawalRecord>(LOCAL_STORAGE_KEYS.WITHDRAWALS);

  interface AggregatedSchoolSportConfirmation {
    sportId: string;
    school: School;
    teacher: User | undefined;
    fallbackTeacherName: string;
    fallbackTeacherPhone: string;
    fallbackTeacherLease: string;
    firstRowIndex: number;
    branchesMap: Map<string, ConfirmedBranchTuple>;
  }

  const aggConfirmations = new Map<string, AggregatedSchoolSportConfirmation>();

  for (const row of activeRows) {
    if (!row.schoolName || row.participations.length === 0) continue;
    const normSchool = normalizeArabicName(row.schoolName);
    const schoolObj = dirSchoolByNormName.get(normSchool);
    if (!schoolObj) continue;

    const teacherObj = teacherRecordByRowIdx.get(row.rowIndex);

    for (const p of row.participations) {
      const aggKey = `${p.sportId}__${schoolObj.id}`;
      if (!aggConfirmations.has(aggKey)) {
        aggConfirmations.set(aggKey, {
          sportId: p.sportId,
          school: schoolObj,
          teacher: teacherObj,
          fallbackTeacherName: row.fullName,
          fallbackTeacherPhone: row.phone,
          fallbackTeacherLease: row.leaseNumber,
          firstRowIndex: row.rowIndex,
          branchesMap: new Map()
        });
      }
      const entry = aggConfirmations.get(aggKey)!;
      const bKey = `non_club__${p.category}__${p.gender}`;
      entry.branchesMap.set(bKey, {
        category: p.category,
        gender: p.gender,
        affiliationType: 'non_club'
      });
    }
  }

  const confirmedIsoNow = new Date().toISOString();

  for (const item of aggConfirmations.values()) {
    const normTargetSchoolName = normalizeArabicName(item.school.name);

    const matchingExistingConfs: SchoolTournamentConfirmation[] = allConfirmations.filter(c => {
      if (!c || c.sportId !== item.sportId || c.status !== 'confirmed') return false;
      if ((c.directorateId || 'taourirt') !== effectiveDirId) return false;
      if (c.schoolId === item.school.id) return true;
      if (c.schoolName && normalizeArabicName(c.schoolName) === normTargetSchoolName) return true;
      return false;
    });

    const mergedBranchesMap = new Map<string, ConfirmedBranchTuple>();

    matchingExistingConfs.forEach(prevConf => {
      const prevBranches = getEffectiveConfirmedBranches(prevConf, false);
      prevBranches.forEach(b => {
        const normCat = normalizeCategoryKey(b.category);
        const aff = b.affiliationType || 'non_club';
        const key = `${aff}__${normCat}__${b.gender}`;
        mergedBranchesMap.set(key, {
          category: normCat,
          gender: b.gender,
          affiliationType: aff
        });
      });
    });

    item.branchesMap.forEach((b, key) => {
      mergedBranchesMap.set(key, b);
    });

    const finalBranches = Array.from(mergedBranchesMap.values());
    if (finalBranches.length === 0) continue;

    const primaryExisting = matchingExistingConfs[0];
    const targetSchoolId = primaryExisting?.schoolId || item.school.id;
    const confirmationId = sanitizeFirestoreDocId(`${item.sportId}_${targetSchoolId}`);
    const opKey = `school_confirmations__${confirmationId}`;
    if (excludedOpKeys.has(opKey)) continue;

    const schoolLowerId = targetSchoolId.trim().toLowerCase();
    const schoolLowerName = item.school.name.trim().toLowerCase();
    workingWithdrawals = workingWithdrawals.filter(w => {
      if (!w || w.sportId !== item.sportId) return true;
      const wName = (w.schoolName || '').trim().toLowerCase();
      const wId = (w.schoolId || '').trim().toLowerCase();
      const isMatch =
        wName === schoolLowerName ||
        wName === schoolLowerId ||
        wId === schoolLowerId ||
        wId === schoolLowerName;
      if (isMatch && w.id) {
        const safeWId = sanitizeFirestoreDocId(w.id);
        const wOpKey = `school_withdrawals__${safeWId}`;
        if (!excludedOpKeys.has(wOpKey)) {
          queuedOpsMap.set(wOpKey, {
            opKey: wOpKey,
            type: 'delete',
            col: 'school_withdrawals',
            id: safeWId,
            label: `إلغاء انسحاب سابق: ${item.school.name}`,
            rowIndex: item.firstRowIndex,
            ref: doc(db, 'school_withdrawals', safeWId)
          });
        }
        return false;
      }
      return true;
    });

    const sportLabel = SPORTS_MAP[item.sportId]?.name || item.sportId;
    const confirmationPayload: SchoolTournamentConfirmation = sanitizeForFirestoreWrite(
      stripUndefinedDeep({
        id: confirmationId,
        sportId: item.sportId,
        sportName: sportLabel,
        schoolId: targetSchoolId,
        schoolName: item.school.name,
        teacherId: primaryExisting?.teacherId || item.teacher?.id || '',
        teacherName: primaryExisting?.teacherName || item.teacher?.fullName || item.fallbackTeacherName || '',
        teacherPhone: primaryExisting?.teacherPhone || item.teacher?.phone || item.fallbackTeacherPhone || '',
        teacherLeaseNumber:
          primaryExisting?.teacherLeaseNumber || item.teacher?.leaseNumber || item.fallbackTeacherLease || '',
        notes: primaryExisting?.notes,
        directorateId: effectiveDirId,
        seasonId: activeSeason,
        categories: Array.from(new Set(finalBranches.map(b => b.category))),
        genders: Array.from(new Set(finalBranches.map(b => b.gender))),
        affiliationTypes: Array.from(new Set(finalBranches.map(b => b.affiliationType))),
        selectedBranches: finalBranches,
        status: 'confirmed',
        confirmedAt: primaryExisting?.confirmedAt || confirmedIsoNow
      })
    );

    confirmationsById.set(confirmationId, confirmationPayload);
    queuedOpsMap.set(opKey, {
      opKey,
      type: 'set',
      col: 'school_confirmations',
      id: confirmationId,
      label: `مشاركة ${item.school.name} في ${sportLabel}`,
      rowIndex: item.firstRowIndex,
      ref: doc(db, 'school_confirmations', confirmationId),
      jsonPayload: confirmationPayload as Record<string, any>,
      isNewDoc: false,
      data: confirmationPayload as Record<string, any>,
      merge: true
    });

    confirmedParticipationsMerged++;
  }

  // --- 5. SAVE LOCALLY IMMEDIATELY + QUEUE OR COMMIT TO CLOUD ---
  const allOps = Array.from(queuedOpsMap.values());

  report({
    phase: 'saving',
    message: `جاري حفظ جميع المعطيات محلياً (${allOps.length} سجل مدمج)...`,
    percent: 85
  });

  // 1. Write all updated collections to localStorage immediately
  safeWriteLocalArray(LOCAL_STORAGE_KEYS.SCHOOLS, Array.from(schoolsById.values()));
  safeWriteLocalArray(LOCAL_STORAGE_KEYS.USERS, workingUsers);
  safeWriteLocalArray(LOCAL_STORAGE_KEYS.TOURNAMENTS, Array.from(tournamentsById.values()));
  safeWriteLocalArray(LOCAL_STORAGE_KEYS.SPORTS_CONFIG, workingSportsConfig);
  safeWriteLocalArray(LOCAL_STORAGE_KEYS.CONFIRMATIONS, Array.from(confirmationsById.values()));
  safeWriteLocalArray(LOCAL_STORAGE_KEYS.WITHDRAWALS, workingWithdrawals);

  const emitRefreshEvents = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('schoolsUpdated'));
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
      window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated'));
    }
  };

  // 2. If Local-Only Mode requested OR Cloud Quota is currently exhausted -> queue for tomorrow and finish immediately!
  if (forceLocalOnly || quotaCheck.quotaExceeded || DataService.isCloudSyncPaused()) {
    bulkMarkPendingWrites(allOps);
    const totalQueued = enqueueSerializableOpsForTomorrow(allOps);
    emitRefreshEvents();
    report({
      phase: 'done',
      message: 'تم حفظ جميع المعطيات محلياً بنجاح (100%) وجدولتها للمزامنة السحابية!',
      percent: 100
    });
    return {
      addedSchools,
      existingSchoolsPreserved,
      addedTeachers,
      updatedTeachersPreserved,
      confirmedParticipationsMerged,
      newlyProgrammedTournaments,
      skippedRowsCount,
      queuedForTomorrowCount: totalQueued,
      savedLocallyMode: forceLocalOnly,
      savedLocallyOnlyDueToQuota: !forceLocalOnly && quotaCheck.quotaExceeded,
      quotaExceededMessage: quotaCheck.rawMessage
    };
  }

  // 3. Otherwise commit to Firestore Cloud in compact chunks with deterministic timeout
  const failedRecords: FailedImportRecordInfo[] = [];

  if (allOps.length > 0) {
    bulkMarkPendingWrites(allOps);
    enqueueSerializableOpsForTomorrow(allOps);

    const CHUNK_SIZE = 35;
    const succeededOps: QueuedFirestoreOp[] = [];

    for (let offset = 0; offset < allOps.length; offset += CHUNK_SIZE) {
      const chunk = allOps.slice(offset, offset + CHUNK_SIZE);
      const pct = 85 + Math.round(((offset + chunk.length) / allOps.length) * 14);
      report({
        phase: 'saving',
        message: `جاري المزامنة السحابية (${Math.min(offset + chunk.length, allOps.length)} / ${allOps.length})...`,
        percent: pct
      });

      const batch = writeBatch(db);
      for (const op of chunk) {
        if (op.type === 'delete') {
          batch.delete(op.ref);
        } else if (op.merge) {
          batch.set(op.ref, op.data, { merge: true });
        } else {
          batch.set(op.ref, op.data);
        }
      }

      try {
        await withTimeout(batch.commit(), 8000, 'BATCH_COMMIT_TIMEOUT');
        succeededOps.push(...chunk);
      } catch (chunkErr: any) {
        const recheckQuota = await probeFirestoreQuotaStatus();
        const errMsg = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);

        if (recheckQuota.quotaExceeded || /quota exceeded|resource-exhausted/i.test(errMsg)) {
          if (succeededOps.length > 0) {
            bulkClearPendingWrites(succeededOps);
            removeSucceededOpsFromTomorrowQueue(succeededOps.map(o => o.opKey));
          }
          emitRefreshEvents();
          report({
            phase: 'done',
            message: 'تم حفظ المعطيات محلياً بالكامل وجدولة الباقي للمزامنة غداً تلقائياً!',
            percent: 100
          });
          return {
            addedSchools,
            existingSchoolsPreserved,
            addedTeachers,
            updatedTeachersPreserved,
            confirmedParticipationsMerged,
            newlyProgrammedTournaments,
            skippedRowsCount,
            queuedForTomorrowCount: getPendingCloudSyncCount(),
            savedLocallyOnlyDueToQuota: true,
            quotaExceededMessage: recheckQuota.rawMessage || 'Quota exceeded.'
          };
        }

        for (const singleOp of chunk) {
          try {
            const singleBatch = writeBatch(db);
            if (singleOp.type === 'delete') {
              singleBatch.delete(singleOp.ref);
            } else if (singleOp.merge) {
              singleBatch.set(singleOp.ref, singleOp.data, { merge: true });
            } else {
              singleBatch.set(singleOp.ref, singleOp.data);
            }
            await withTimeout(singleBatch.commit(), 5000, 'SINGLE_OP_TIMEOUT');
            succeededOps.push(singleOp);
          } catch (opErr: any) {
            const singleMsg = opErr instanceof Error ? opErr.message : String(opErr);
            failedRecords.push({
              opKey: singleOp.opKey,
              collection: singleOp.col,
              label: singleOp.label,
              rowIndex: singleOp.rowIndex,
              reason:
                singleMsg === 'SINGLE_OP_TIMEOUT'
                  ? 'محفوظ محلياً وبانتظار المزامنة السحابية'
                  : singleMsg
            });
          }
        }
      }
    }

    if (succeededOps.length > 0) {
      bulkClearPendingWrites(succeededOps);
      removeSucceededOpsFromTomorrowQueue(succeededOps.map(o => o.opKey));
    }
  }

  emitRefreshEvents();

  report({
    phase: 'done',
    message: 'تم حفظ ودمج جميع المعطيات دفعة واحدة بنجاح!',
    percent: 100
  });

  return {
    addedSchools,
    existingSchoolsPreserved,
    addedTeachers,
    updatedTeachersPreserved,
    confirmedParticipationsMerged,
    newlyProgrammedTournaments,
    skippedRowsCount,
    queuedForTomorrowCount: getPendingCloudSyncCount(),
    failedRecords: failedRecords.length > 0 ? failedRecords : undefined
  };
}

export function downloadParticipationsExcelTemplate(): void {
  const sampleRows = [
    {
      'الاسم والنسب': 'أحمد الشرقاوي',
      'المؤسسة': 'الثانوية التأهيلية الفتح',
      'الإطار': 'أستاذ التعليم الثانوي التأهيلي',
      'البريد الإلكتروني (gmail)': 'ahmed.exemple@gmail.com',
      'رقم التأجير': '1947987',
      'رقم الهاتف': '0661234567',
      'كرة اليد [الاناث]': 'كرة اليد "U18" إناث غير منتمين للأندية',
      'كرة اليد [الذكور]': 'كرة اليد "U18" ذكور غير منتمين للأندية',
      'كرة السلة [الاناث]': '',
      'كرة السلة [الذكور]': 'كرة السلة "U18" ذكور غير منتمين للأندية',
      'كرة الطائرة [الاناث]': '',
      'كرة الطائرة [الذكور]': '',
      'كرة القدم [الاناث]': '',
      'كرة القدم [الذكور]': 'كرة القدم "U18" ذكور غير منتمين للأندية',
      'كرة الريشة [الاناث]': '',
      'كرة الريشة [الذكور]': ''
    },
    {
      'الاسم والنسب': 'نجاة الزايدي',
      'المؤسسة': 'الثانوية الإعدادية محمد الخامس',
      'الإطار': 'أستاذ التعليم الثانوي الإعدادي',
      'البريد الإلكتروني (gmail)': 'najat.exemple@gmail.com',
      'رقم التأجير': '2162463',
      'رقم الهاتف': '0672762665',
      'كرة اليد [الاناث]': 'كرة اليد "U15" إناث غير منتمين للأندية / كرة اليد "U18" إناث غير منتمين للأندية',
      'كرة اليد [الذكور]': 'كرة اليد "U15" ذكور غير منتمين للأندية',
      'كرة السلة [الاناث]': '',
      'كرة السلة [الذكور]': '',
      'كرة الطائرة [الاناث]': 'كرة الطائرة "U15" إناث غير منتمين للأندية',
      'كرة الطائرة [الذكور]': '',
      'كرة القدم [الاناث]': '',
      'كرة القدم [الذكور]': '',
      'كرة الريشة [الاناث]': 'كرة الريشة "U15" إناث غير منتمين للأندية',
      'كرة الريشة [الذكور]': ''
    }
  ];

  const ws = XLSX.utils.json_to_sheet(sampleRows);
  ws['!views'] = [{ RTL: true }];
  ws['!cols'] = [
    { wch: 22 },
    { wch: 32 },
    { wch: 28 },
    { wch: 28 },
    { wch: 14 },
    { wch: 15 },
    { wch: 36 },
    { wch: 36 },
    { wch: 34 },
    { wch: 34 },
    { wch: 34 },
    { wch: 34 },
    { wch: 34 },
    { wch: 34 },
    { wch: 34 },
    { wch: 34 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'المشاركات_والأطر');
  XLSX.writeFile(wb, 'نموذج_استيراد_المشاركات_والأطر_والمؤسسات.xlsx');
}
