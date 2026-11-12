import { Tournament, Match, School, Venue, User, Referee, Student, Sport, AppNotification, RoleSidebarPermissions, Directorate, DirectorateTransferRequest, SUPER_ADMIN_EMAILS, CrossCountryCategoryResult, PodiumWinner, CustomAgeCategory, AthleticsCategoryResult, AthleticsWinner, SchoolTournamentConfirmation, SchoolWithdrawalRecord } from '../types';
import { INITIAL_TOURNAMENTS, INITIAL_MATCHES, INITIAL_SCHOOLS, INITIAL_VENUES, INITIAL_DIRECTORATES } from './initialData';
import { INITIAL_CROSS_COUNTRY_RESULTS } from './crossCountryConfig';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, setDoc, deleteDoc, Timestamp, serverTimestamp, query, where, onSnapshot, writeBatch } from 'firebase/firestore';
import { isFlexibleEmailMatch, fixTeacherFieldJumble, normalizeArabicName } from './utils';

const STORAGE_KEYS = {
  TOURNAMENTS: 'taourirt_tournaments_data',
  MATCHES: 'taourirt_matches_data',
  SCHOOLS: 'taourirt_schools_data',
  VENUES: 'taourirt_venues_data',
  DIRECTORATES: 'app_directorates_data',
  CONFIRMATIONS: 'app_school_confirmations',
  WITHDRAWALS: 'app_school_tournament_withdrawals'
};

// Helper to deduplicate any array of objects by id
export function deduplicateById<T extends { id?: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item) continue;
    const id = item.id;
    if (id) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

// Helper to recursively sanitize payloads for Firestore (removes/replaces undefined with empty string, preserves FieldValues)
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return "" as any;
  }
  // DO NOT mutate FieldValues, Timestamps, Dates, or primitives!
  if (
    typeof obj !== 'object' ||
    obj instanceof Date ||
    (obj as any)?._methodName !== undefined ||
    (obj as any)?.toMillis !== undefined ||
    (obj as any)?.seconds !== undefined
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestorePayload(item)) as any;
  }
  const cleaned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      cleaned[key] = val === undefined || val === null ? "" : sanitizeFirestorePayload(val);
    }
  }
  return cleaned as any;
}

// Helper to recursively omit undefined keys without altering numbers/booleans/FieldValues/Timestamps/Dates
export function stripUndefinedDeep<T>(obj: T): T {
  if (obj === undefined || obj === null) {
    return obj;
  }
  if (
    typeof obj !== 'object' ||
    obj instanceof Date ||
    (obj as any)?._methodName !== undefined ||
    (obj as any)?.toMillis !== undefined ||
    (obj as any)?.seconds !== undefined
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => stripUndefinedDeep(item)) as any;
  }
  const cleaned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = stripUndefinedDeep(val);
      }
    }
  }
  return cleaned as any;
}

const PENDING_WRITES_STORAGE_KEY = 'app_pending_firestore_writes_v1';
const RECENT_DELETES_TTL_MS = 60000;
const recentDeletesMemory: Record<string, Record<string, number>> = {};

function readPendingWritesMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(PENDING_WRITES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePendingWritesMap(map: Record<string, string[]>) {
  try {
    localStorage.setItem(PENDING_WRITES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function markPendingWrite(col: string, id?: string) {
  if (!id) return;
  const map = readPendingWritesMap();
  const list = Array.isArray(map[col]) ? map[col] : [];
  if (!list.includes(id)) {
    map[col] = [...list, id];
    writePendingWritesMap(map);
  }
  if (recentDeletesMemory[col]) {
    delete recentDeletesMemory[col][id];
  }
}

function clearPendingWrite(col: string, id?: string) {
  if (!id) return;
  const map = readPendingWritesMap();
  if (Array.isArray(map[col]) && map[col].includes(id)) {
    map[col] = map[col].filter(x => x !== id);
    writePendingWritesMap(map);
  }
}

function isPendingWrite(col: string, id?: string): boolean {
  if (!id) return false;
  const map = readPendingWritesMap();
  return Array.isArray(map[col]) && map[col].includes(id);
}

function markRecentlyDeleted(col: string, id?: string) {
  if (!id) return;
  clearPendingWrite(col, id);
  if (!recentDeletesMemory[col]) {
    recentDeletesMemory[col] = {};
  }
  recentDeletesMemory[col][id] = Date.now();
}

function isRecentlyDeleted(col: string, id?: string): boolean {
  if (!id) return false;
  const ts = recentDeletesMemory[col]?.[id];
  if (!ts) return false;
  if (Date.now() - ts > RECENT_DELETES_TTL_MS) {
    delete recentDeletesMemory[col][id];
    return false;
  }
  return true;
}

// Local storage helpers with automatic deduplication and self-healing
function getLocal<T extends { id?: string }>(key: string, fallback: T[]): T[] {
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      const cleanFallback = deduplicateById(fallback);
      localStorage.setItem(key, JSON.stringify(cleanFallback));
      return cleanFallback;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      const clean = deduplicateById<T>(parsed);
      // Auto-heal local storage if duplicates existed
      if (clean.length !== parsed.length) {
        localStorage.setItem(key, JSON.stringify(clean));
      }
      return clean;
    }
    return fallback;
  } catch {
    return deduplicateById(fallback);
  }
}

function setLocal<T extends { id?: string }>(key: string, data: T[]) {
  try {
    const clean = deduplicateById(data);
    localStorage.setItem(key, JSON.stringify(clean));
  } catch (e) {
    console.error("Local storage error:", e);
  }
}

// Generate a 6-character secure PIN containing uppercase, lowercase, and numbers
export function generateSecureAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const BASE_SPORTS: Record<string, { name: string; icon: string }> = {
  football: { name: 'كرة القدم', icon: '⚽' },
  basketball_3x3: { name: 'كرة السلة 3 ضد 3', icon: '🏀' },
  basketball: { name: 'كرة السلة 5 ضد 5', icon: '🏀' },
  volleyball: { name: 'الكرة الطائرة', icon: '🏐' },
  cross_country: { name: 'العدو الريفي', icon: '🏃‍♂️' },
  athletics: { name: 'ألعاب القوى', icon: '🏃' },
  beach_volleyball: { name: 'الكرة الطائرة الشاطئية', icon: '🏖️' },
  mixed_volleyball: { name: 'الكرة الطائرة مختلطة', icon: '🏐' },
  handball: { name: 'كرة اليد', icon: '🤾' },
  beach_handball: { name: 'كرة اليد الشاطئية', icon: '🏖️' },
  badminton: { name: 'البادمنتون', icon: '🏸' },
  chess: { name: 'الشطرنج', icon: '♟️' },
  boxing: { name: 'الملاكمة', icon: '🥊' },
  judo: { name: 'الجيدو', icon: '🥋' },
  karate: { name: 'الكراطي', icon: '🥋' },
  rugby: { name: 'الركبي', icon: '🏉' },
  futsal: { name: 'فوتسال (داخل القاعة)', icon: '⚽' },
  table_tennis: { name: 'كرة الطاولة', icon: '🏓' }
};

export const TEAM_SPORTS_IDS = ['football', 'basketball', 'handball', 'volleyball', 'futsal', 'rugby', 'basketball_3x3', 'mixed_volleyball', 'beach_volleyball', 'beach_handball'];

export function isTeamSport(sportIdOrName: string): boolean {
  if (!sportIdOrName) return false;
  const lower = sportIdOrName.toLowerCase();
  if (TEAM_SPORTS_IDS.includes(lower)) return true;
  if (lower.includes('football') || lower.includes('basketball') || lower.includes('handball') || lower.includes('volleyball') || lower.includes('futsal') || lower.includes('rugby')) {
    return true;
  }
  const sportName = SPORTS_MAP[sportIdOrName]?.name || sportIdOrName;
  if (sportName.includes('قدم') || sportName.includes('سلة') || sportName.includes('يد') || sportName.includes('طائرة') || sportName.includes('ركبي') || sportName.includes('فوتسال')) {
    return true;
  }
  return false;
}

export function getDefaultTeamAgeCategories(season: string): CustomAgeCategory[] {
  const match = season.match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 2026;
  return [
    {
      id: 'U15',
      name: 'الصغار والصغيرات',
      yearsExpression: `${startYear - 14}/${startYear - 13}/${startYear - 12}`
    },
    {
      id: 'U18',
      name: 'الفتيان والفتيات',
      yearsExpression: `${startYear - 17}/${startYear - 16}/${startYear - 15}`
    }
  ];
}

export const SPORTS_MAP: Record<string, { name: string; icon: string }> = {
  ...BASE_SPORTS
};

// Immediately hydrate SPORTS_MAP from cached custom sports so synchronous accesses are complete
try {
  const cachedCustomSports = localStorage.getItem('taourirt_custom_sports');
  if (cachedCustomSports) {
    const parsed = JSON.parse(cachedCustomSports);
    if (Array.isArray(parsed)) {
      parsed.forEach((s: any) => {
        if (s && s.id && s.name) {
          SPORTS_MAP[s.id] = { name: s.name, icon: s.icon || '🏆' };
        }
      });
    }
  }
} catch {
  // Ignore in SSR/test environment
}

export interface OfficialLogos {
  ministryLogo?: string;
  frmssLogo?: string;
  ministryLogoHeight?: number;
  frmssLogoHeight?: number;
}

const isCc = (val?: string | boolean): boolean => {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.toLowerCase();
    return s.includes('cross') || s.includes('عدو') || s.includes('athlet') || s.includes('ألعاب القوى') || s.includes('العاب القوى');
  }
  return false;
};

const parseYearsExpression = (expr: string): number[] => {
  if (!expr) return [];
  // Check for "وما بعد" or "و ما بعد" or "+"
  const isPost = expr.includes('بعد') || expr.includes('>') || expr.includes('+');
  const yearsMatched = Array.from(expr.matchAll(/(\d{4})/g)).map(m => parseInt(m[1], 10));
  
  if (isPost && yearsMatched.length > 0) {
    const minYear = Math.min(...yearsMatched);
    return Array.from({ length: 15 }, (_, i) => minYear + i);
  }
  
  return yearsMatched;
};

export const getAgeCategoriesForSeason = (season: string, gender?: 'Male' | 'Female', sportIdOrIsCc?: string | boolean) => {
  const match = season.match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 2026;
  const isCrossCountry = isCc(sportIdOrIsCc);

  // Check if we have dynamic custom age categories configured for this sport
  if (typeof sportIdOrIsCc === 'string') {
    try {
      const localSports = JSON.parse(localStorage.getItem('taourirt_sports_config') || '[]');
      const foundSport = localSports.find((s: any) => s.id === sportIdOrIsCc);
      if (foundSport && foundSport.customAgeCategories && foundSport.customAgeCategories.length > 0) {
        return foundSport.customAgeCategories
          .filter((cat: any) => cat && cat.name && !/^CAT_/i.test(cat.name))
          .map((cat: any) => {
            const cleanId = normalizeCategoryKey(cat.id || cat.name);
            const cleanName = (/^CAT_/i.test(cat.name) || /^cat_/i.test(cat.name))
              ? (cleanId === 'U12' ? 'البراعم' : cleanId === 'U18' ? 'الفتيان' : cleanId === 'U20' ? 'الشبان' : 'الصغار')
              : cat.name;
            const years = parseYearsExpression(cat.yearsExpression);
            return {
              id: cleanId,
              name: `${cleanName}${cat.yearsExpression ? ` - ${cat.yearsExpression}` : ''}`,
              shortName: cleanName,
              years
            };
          });
      }
    } catch (e) {
      console.warn("Error loading custom age categories in getAgeCategoriesForSeason:", e);
    }
  }

  const u12Label = gender === 'Female' ? 'البرعمات (إناث)' : gender === 'Male' ? 'البراعم (ذكور)' : 'البراعم والبرعمات';
  const u15Label = gender === 'Female' ? 'الصغيرات (إناث)' : gender === 'Male' ? 'الصغار (ذكور)' : 'الصغار والصغيرات';
  const u18Label = gender === 'Female' ? 'الفتيات (إناث)' : gender === 'Male' ? 'الفتيان (ذكور)' : 'الفتيان والفتيات';
  const u20Label = gender === 'Female' ? 'الشابات (إناث)' : gender === 'Male' ? 'الشبان (ذكور)' : 'الشبان والشابات';

  if (isCrossCountry) {
    // Cross Country 2026/2027:
    // U12: البراعم والبرعمات (مواليد 2014 وما بعد) -> startYear - 12
    // U15: الصغار والصغيرات (مواليد 2013/2012) -> [startYear - 14, startYear - 13]
    // U18: الفتيان والفتيات (مواليد 2011/2010) -> [startYear - 16, startYear - 15]
    // U20: الشبان والشابات (مواليد 2009/2008) -> [startYear - 18, startYear - 17]
    return [
      { 
        id: 'U12', 
        name: `${u12Label} - مواليد ${startYear - 12} وما بعد`, 
        shortName: u12Label, 
        years: Array.from({ length: 15 }, (_, i) => startYear - 12 + i)
      },
      { 
        id: 'U15', 
        name: `${u15Label} - مواليد ${startYear - 13}/${startYear - 14}`, 
        shortName: u15Label, 
        years: [startYear - 14, startYear - 13] 
      },
      { 
        id: 'U18', 
        name: `${u18Label} - مواليد ${startYear - 15}/${startYear - 16}`, 
        shortName: u18Label, 
        years: [startYear - 16, startYear - 15] 
      },
      { 
        id: 'U20', 
        name: `${u20Label} - مواليد ${startYear - 17}/${startYear - 18}`, 
        shortName: u20Label, 
        years: [startYear - 18, startYear - 17] 
      }
    ];
  } else if (typeof sportIdOrIsCc === 'string' && isTeamSport(sportIdOrIsCc)) {
    // Team sports default: U15 and U18 only
    // 2026/2027: U15 = 2012/2013/2014, U18 = 2009/2010/2011
    // Subsequent seasons shift birth years dynamically
    return [
      { 
        id: 'U15', 
        name: `${u15Label} - مواليد ${startYear - 14}/${startYear - 13}/${startYear - 12}`, 
        shortName: u15Label, 
        years: [startYear - 14, startYear - 13, startYear - 12] 
      },
      { 
        id: 'U18', 
        name: `${u18Label} - مواليد ${startYear - 17}/${startYear - 16}/${startYear - 15}`, 
        shortName: u18Label, 
        years: [startYear - 17, startYear - 16, startYear - 15] 
      }
    ];
  } else {
    // Other individual sports:
    // U12: مواليد 2015 وما بعد
    // U15: مواليد 2012/2013/2014
    // U18: مواليد 2009/2010/2011
    // U20: مواليد 2009 وما بعد
    return [
      { 
        id: 'U12', 
        name: `${u12Label} - مواليد ${startYear - 11} وما بعد`, 
        shortName: u12Label, 
        years: Array.from({ length: 15 }, (_, i) => startYear - 11 + i)
      },
      { 
        id: 'U15', 
        name: `${u15Label} - مواليد ${startYear - 14}/${startYear - 13}/${startYear - 12}`, 
        shortName: u15Label, 
        years: [startYear - 14, startYear - 13, startYear - 12] 
      },
      { 
        id: 'U18', 
        name: `${u18Label} - مواليد ${startYear - 17}/${startYear - 16}/${startYear - 15}`, 
        shortName: u18Label, 
        years: [startYear - 17, startYear - 16, startYear - 15] 
      },
      { 
        id: 'U20', 
        name: `${u20Label} - مواليد ${startYear - 17} وما بعد`, 
        shortName: u20Label, 
        years: Array.from({ length: 15 }, (_, i) => startYear - 17 + i)
      }
    ];
  }
};

export function normalizeCategoryKey(catStr: any): string {
  if (!catStr) return 'U15';
  
  // Convert to string safely to avoid .trim() errors if catStr is not a string primitive
  const s = String(catStr).trim();
  const upper = s.toUpperCase();
  
  if (upper.includes('U12') || upper.includes('براعم') || upper.includes('برعمات')) return 'U12';
  if (upper.includes('U15') || upper.includes('صغار') || upper.includes('صغيرات')) return 'U15';
  if (upper.includes('U18') || upper.includes('فتيان') || upper.includes('فتيات')) return 'U18';
  if (upper.includes('U20') || upper.includes('شبان') || upper.includes('شابات')) return 'U20';
  if (upper === 'U12' || upper === 'U15' || upper === 'U18' || upper === 'U20') return upper;
  
  // Purge any technical auto-generated category hash (e.g. CAT_1793910455460_TEFB or cat_...)
  if (/^CAT_/i.test(s) || /^cat_/i.test(s) || s.length > 8) {
    if (s.includes('12')) return 'U12';
    if (s.includes('18')) return 'U18';
    if (s.includes('20')) return 'U20';
    return 'U15';
  }
  
  return s;
}

export function getCategoryYearsLabel(catId: any, season: string = '2026/2027', sportIdOrIsCc?: string | boolean): string {
  const normKey = normalizeCategoryKey(catId);
  const cats = getAgeCategoriesForSeason(season, undefined, sportIdOrIsCc);
  const matched = cats.find(c => normalizeCategoryKey(c.id) === normKey);
  if (matched) {
    const parts = matched.name.split(' - ');
    if (parts.length > 1) {
      return parts[1];
    }
  }
  return normKey;
}

export function getCategoryShortName(category: any, gender?: string): string {
  if (!category || typeof category !== 'string') return category || '';
  const normKey = normalizeCategoryKey(category);
  if (normKey === 'U12') {
    if (gender === 'Female' || gender === 'إناث') return 'البرعمات';
    if (gender === 'Male' || gender === 'ذكور') return 'البراعم';
    return 'البراعم والبرعمات';
  }
  if (normKey === 'U15') {
    if (gender === 'Female' || gender === 'إناث') return 'الصغيرات';
    if (gender === 'Male' || gender === 'ذكور') return 'الصغار';
    return 'الصغار والصغيرات';
  }
  if (normKey === 'U18') {
    if (gender === 'Female' || gender === 'إناث') return 'الفتيات';
    if (gender === 'Male' || gender === 'ذكور') return 'الفتيان';
    return 'الفتيان والفتيات';
  }
  if (normKey === 'U20') {
    if (gender === 'Female' || gender === 'إناث') return 'الشابات';
    if (gender === 'Male' || gender === 'ذكور') return 'الشبان';
    return 'الشبان والشابات';
  }
  if (/^CAT_/i.test(category) || /^cat_/i.test(category)) {
    return 'الصغار والصغيرات';
  }
  return category;
}

export interface CustomCategoryDetails {
  id: string;
  name: string;
  yearsExpression?: string;
  studentLimit?: number;
}

export function getCustomCategoryDetails(
  catId: string,
  sportId?: string,
  sportsConfigList?: any[]
): CustomCategoryDetails | null {
  if (!catId) return null;

  let sports = sportsConfigList;
  if (!sports) {
    try {
      sports = JSON.parse(localStorage.getItem('taourirt_sports_config') || '[]');
    } catch {}
  }

  if (Array.isArray(sports) && sports.length > 0) {
    const targetSports = sportId ? sports.filter((s: any) => s.id === sportId) : sports;
    for (const sport of targetSports) {
      if (sport && Array.isArray(sport.customAgeCategories)) {
        for (const c of sport.customAgeCategories) {
          if (!c || !c.name) continue;
          if (
            c.id === catId ||
            c.name === catId ||
            c.name.trim() === catId.trim() ||
            (c.id && catId && normalizeCategoryKey(c.id) === normalizeCategoryKey(catId) && normalizeCategoryKey(catId) !== 'U15')
          ) {
            return {
              id: c.id || catId,
              name: c.name,
              yearsExpression: c.yearsExpression,
              studentLimit: c.studentLimit
            };
          }
        }
      }
    }
  }

  return null;
}

export function getCustomCategoryName(catId: string, sportId?: string, sportsConfigList?: any[]): string {
  if (!catId) return '';
  const custom = getCustomCategoryDetails(catId, sportId, sportsConfigList);
  if (custom && custom.name) {
    return custom.name;
  }
  if (['U12', 'U15', 'U18', 'U20'].includes(normalizeCategoryKey(catId))) {
    return getCategoryShortName(catId);
  }
  return catId;
}

export function isSchoolLevelAllowedForTournament(schoolType: string, tournamentLevel?: string): boolean {
  if (!tournamentLevel) return true; // if no level specified, default to allowed
  
  // Normalize school type to english level keys
  let schoolLevelKey = '';
  const cleanType = String(schoolType || '').trim();
  if (cleanType === 'ابتدائي' || cleanType.toLowerCase() === 'primary' || cleanType.includes('ابتدائي')) {
    schoolLevelKey = 'Primary';
  } else if (cleanType === 'إعدادي' || cleanType.toLowerCase() === 'middle' || cleanType === 'أعدادي' || cleanType === 'اعدادي' || cleanType.includes('إعدادي')) {
    schoolLevelKey = 'Middle';
  } else if (cleanType === 'تأهيلي' || cleanType.toLowerCase() === 'high' || cleanType === 'ثانوي' || cleanType === 'تاهيلي' || cleanType.includes('تأهيلي')) {
    schoolLevelKey = 'High';
  }
  
  if (!schoolLevelKey) return true; // If we can't determine the level, allow it
  
  const allowedLevels = tournamentLevel.split(',').map(l => l.trim());
  
  // Also check for Arabic synonyms in the tournamentLevel string itself just in case
  if (allowedLevels.includes('Primary') || tournamentLevel.includes('ابتدائي')) {
    if (schoolLevelKey === 'Primary') return true;
  }
  if (allowedLevels.includes('Middle') || tournamentLevel.includes('إعدادي') || tournamentLevel.includes('اعدادي')) {
    if (schoolLevelKey === 'Middle') return true;
  }
  if (allowedLevels.includes('High') || tournamentLevel.includes('تأهيلي') || tournamentLevel.includes('تاهيلي') || tournamentLevel.includes('ثانوي')) {
    if (schoolLevelKey === 'High') return true;
  }

  return allowedLevels.includes(schoolLevelKey);
}

export function isTeacherLevelAllowedForTournament(teachingCadre?: string, tournamentLevel?: string): boolean {
  if (!tournamentLevel || tournamentLevel === 'جميع الأسلاك' || tournamentLevel.includes('جميع')) return true; 
  if (!teachingCadre) return true; // Flexible: allow entry by default if cadre is not explicitly set yet on mobile
  
  let teacherLevelKey = '';
  const cleanCadre = String(teachingCadre).trim().toUpperCase();
  
  // Support both English keys and Arabic values/synonyms
  if (cleanCadre === 'PRIMARY' || cleanCadre.includes('ابتدائي')) {
    teacherLevelKey = 'Primary';
  } else if (cleanCadre === 'MIDDLE' || cleanCadre.includes('إعدادي') || cleanCadre.includes('اعدادي')) {
    teacherLevelKey = 'Middle';
  } else if (cleanCadre === 'HIGH' || cleanCadre.includes('تأهيلي') || cleanCadre.includes('تاهيلي') || cleanCadre.includes('ثانوي')) {
    teacherLevelKey = 'High';
  }
  
  if (!teacherLevelKey) return true; // Flexible fallback: allow entry if cadre format is unrecognized
  
  const allowedLevels = tournamentLevel.split(',').map(l => l.trim());
  
  // Check mapping
  if (allowedLevels.includes(teacherLevelKey)) return true;
  
  // Arabic synonyms check in tournament level string
  if (teacherLevelKey === 'Primary' && (tournamentLevel.includes('ابتدائي') || allowedLevels.includes('Primary'))) return true;
  if (teacherLevelKey === 'Middle' && (tournamentLevel.includes('إعدادي') || tournamentLevel.includes('اعدادي') || allowedLevels.includes('Middle'))) return true;
  if (teacherLevelKey === 'High' && (tournamentLevel.includes('تأهيلي') || tournamentLevel.includes('تاهيلي') || tournamentLevel.includes('ثانوي') || allowedLevels.includes('High'))) return true;

  return true; // Flexible fallback by default for all teachers
}

export function getCategoryLevel(categoryId: string): 'Primary' | 'Middle' | 'High' | 'Other' {
  const norm = normalizeCategoryKey(categoryId);
  if (norm === 'U12') return 'Primary';
  if (norm === 'U15') return 'Middle';
  if (norm === 'U18' || norm === 'U20') return 'High';
  return 'Other';
}

export function getTournamentLevelAr(level?: string): string {
  if (!level) return 'جميع الأسلاك';
  return level.split(',')
    .map(l => {
      const trimmed = l.trim();
      if (trimmed === 'Primary') return 'الابتدائي';
      if (trimmed === 'Middle') return 'الإعدادي';
      if (trimmed === 'High') return 'التأهيلي';
      return trimmed;
    })
    .join(' و ');
}


export function getCategoryGenderLabel(category: any, gender?: string, season: string = '2026/2027', sportIdOrIsCc?: string | boolean): string {
  if (!category || typeof category !== 'string') return category || '';
  const normKey = normalizeCategoryKey(category);
  const yearsMatch = (season || '').match(/\d{4}/g);
  const startYear = yearsMatch && yearsMatch.length > 0 ? parseInt(yearsMatch[0], 10) : 2026;
  const isCrossCountry = isCc(sportIdOrIsCc);

  const u12Years = isCrossCountry ? ` - مواليد ${startYear - 12} وما بعد` : ` - مواليد ${startYear - 11} وما بعد`;
  const u15Years = isCrossCountry ? ` - مواليد ${startYear - 13}/${startYear - 14}` : ` - مواليد ${startYear - 14}/${startYear - 13}/${startYear - 12}`;
  const u18Years = isCrossCountry ? ` - مواليد ${startYear - 15}/${startYear - 16}` : ` - مواليد ${startYear - 17}/${startYear - 16}/${startYear - 15}`;
  const u20Years = isCrossCountry ? ` - مواليد ${startYear - 17}/${startYear - 18}` : ` - مواليد ${startYear - 17} وما بعد`;

  if (normKey === 'U12') {
    if (gender === 'Female' || gender === 'إناث') return `البرعمات (إناث)${u12Years}`;
    if (gender === 'Male' || gender === 'ذكور') return `البراعم (ذكور)${u12Years}`;
    return `البراعم والبرعمات${u12Years}`;
  }
  if (normKey === 'U15') {
    if (gender === 'Female' || gender === 'إناث') return `الصغيرات (إناث)${u15Years}`;
    if (gender === 'Male' || gender === 'ذكور') return `الصغار (ذكور)${u15Years}`;
    return `الصغار والصغيرات${u15Years}`;
  }
  if (normKey === 'U18') {
    if (gender === 'Female' || gender === 'إناث') return `الفتيات (إناث)${u18Years}`;
    if (gender === 'Male' || gender === 'ذكور') return `الفتيان (ذكور)${u18Years}`;
    return `الفتيان والفتيات${u18Years}`;
  }
  if (normKey === 'U20') {
    if (gender === 'Female' || gender === 'إناث') return `الشابات (إناث)${u20Years}`;
    if (gender === 'Male' || gender === 'ذكور') return `الشبان (ذكور)${u20Years}`;
    return `الشبان والشابات${u20Years}`;
  }
  if (/^CAT_/i.test(category) || /^cat_/i.test(category)) {
    return `الصغار والصغيرات${u15Years}`;
  }
  return category;
}

export interface BirthDateValidationResult {
  isValid: boolean;
  birthYear?: number;
  expectedYearsText?: string;
  errorMessage?: string;
  categoryLabel?: string;
}

export function validateBirthDateForCategory(
  birthDate: string,
  category: any,
  season: string = '2026/2027',
  gender?: string,
  sportIdOrIsCc?: string | boolean
): BirthDateValidationResult {
  if (!birthDate || !category) {
    return { isValid: true };
  }

  const birthYear = parseInt(birthDate.split('-')[0], 10);
  if (isNaN(birthYear) || birthYear < 1980 || birthYear > 2035) {
    return { isValid: false, errorMessage: 'يرجى إدخال تاريخ ازدياد صالح ومكتمل', birthYear };
  }

  const normCat = normalizeCategoryKey(category);
  const isCrossCountry = isCc(sportIdOrIsCc);
  const cats = getAgeCategoriesForSeason(season, gender as any, sportIdOrIsCc);
  const catDef = cats.find(c => normalizeCategoryKey(c.id) === normCat);
  const catLabel = getCategoryShortName(normCat, gender) || normCat;

  if (catDef) {
    if (normCat === 'U12') {
      const minYear = catDef.years[0];
      const expected = isCrossCountry ? `مواليد سنة 2014 وما بعد` : `مواليد سنة 2015 وما بعد`;
      if (birthYear < minYear) {
        return {
          isValid: false,
          birthYear,
          expectedYearsText: expected,
          categoryLabel: catLabel,
          errorMessage: `خطأ في تاريخ الازدياد: تاريخ الازدياد (سنة ${birthYear}) لا يتناسب مع الفئة المعنية (${catLabel} - مخصصة لـ ${expected}).`
        };
      }
      return { isValid: true, birthYear, expectedYearsText: expected, categoryLabel: catLabel };
    }

    if (normCat === 'U20' && !isCrossCountry) {
      const minYear = catDef.years[0];
      const expected = `مواليد سنة 2009 وما بعد`;
      if (birthYear < minYear) {
        return {
          isValid: false,
          birthYear,
          expectedYearsText: expected,
          categoryLabel: catLabel,
          errorMessage: `خطأ في تاريخ الازدياد: تاريخ الازدياد (سنة ${birthYear}) لا يتناسب مع الفئة المعنية (${catLabel} - مخصصة لـ ${expected}).`
        };
      }
      return { isValid: true, birthYear, expectedYearsText: expected, categoryLabel: catLabel };
    }

    const allowed = catDef.years;
    const expected = `مواليد السنوات التالية: ${allowed.join(' / ')}`;
    if (!allowed.includes(birthYear)) {
      return {
        isValid: false,
        birthYear,
        expectedYearsText: expected,
        categoryLabel: catLabel,
        errorMessage: `خطأ في تاريخ الازدياد: تاريخ الازدياد (سنة ${birthYear}) لا يتناسب مع الفئة المعنية (${catLabel} - مخصصة لـ ${expected}).`
      };
    }
    return { isValid: true, birthYear, expectedYearsText: expected, categoryLabel: catLabel };
  }

  return { isValid: true, birthYear, categoryLabel: catLabel };
}

export const AGE_CATEGORIES = getAgeCategoriesForSeason('2026/2027');

export const isClubTournament = (t?: { affiliationType?: string; name?: string } | null): boolean => {
  if (!t) return false;
  if (t.affiliationType === 'club_affiliated') return true;
  if (t.affiliationType === 'non_club' || t.affiliationType === 'open') return false;
  if (t.name && (t.name.includes('للمنتمين للأندية') || t.name.includes('المنتمين للأندية') || t.name.includes('عصب وأندية') || t.name.includes('منتمي لنادي'))) return true;
  return false;
};

export const isOpenTournament = (t?: { affiliationType?: string; name?: string } | null): boolean => {
  if (!t) return false;
  if (t.affiliationType === 'open') return true;
  if (t.name && (t.name.includes('مفتوحة') || t.name.includes('المفتوحة') || t.name.includes('دوري مفتوح'))) return true;
  return false;
};

export const GENDER_MAP: Record<string, { name: string; icon: string; badgeClass: string }> = {
  Male: { name: 'ذكور', icon: '👦', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  Female: { name: 'إناث', icon: '👧', badgeClass: 'bg-pink-50 text-pink-700 border-pink-200' },
  Mixed: { name: 'مختلط', icon: '👥', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' }
};

export const DataService = {
  getCustomCategoryName,
  getCustomCategoryDetails,
  // OFFICIAL LOGOS FOR PARTICIPATION LISTS
  async getOfficialLogos(): Promise<OfficialLogos> {
    try {
      const snap = await getDoc(doc(db, 'config', 'logos'));
      if (snap.exists()) {
        const logos = snap.data() as OfficialLogos;
        localStorage.setItem('taourirt_official_logos', JSON.stringify(logos));
        return logos;
      }
    } catch (e) {
      console.warn("Firestore load official logos error, falling back to cached:", e);
    }
    try {
      const data = localStorage.getItem('taourirt_official_logos');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  async saveOfficialLogos(logos: OfficialLogos): Promise<void> {
    try {
      localStorage.setItem('taourirt_official_logos', JSON.stringify(logos));
    } catch {}
    try {
      await setDoc(doc(db, 'config', 'logos'), {
        ...logos,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Error saving official logos to Firestore:", e);
    }
  },

  // TOURNAMENTS
  async getTournaments(targetDirectorateId?: string, all?: boolean): Promise<Tournament[]> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    const tournsMap = new Map<string, Tournament>();

    // 1. Fetch from Firestore first (source of truth)
    try {
      const snap = await getDocs(collection(db, 'tournaments'));
      if (!snap.empty) {
        snap.docs.forEach(d => {
          const data = d.data();
          const firestoreTourn: Tournament = {
            id: d.id,
            name: data.name || '',
            sportId: data.sportId || '',
            seasonId: data.seasonId || '',
            directorateId: data.directorateId || 'taourirt',
            ageCategory: data.ageCategory || '',
            gender: data.gender || 'Mixed',
            level: data.level || '',
            scope: data.scope || 'Provincial',
            status: data.status || 'Scheduled',
            description: data.description || '',
            affiliationType: data.affiliationType || 'non_club',
            managerName: data.managerName || '',
            managerPhone: data.managerPhone || '',
            managerEmail: data.managerEmail || '',
            accessCode: data.accessCode || '',
            ...data,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
            endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
            registrationDeadline: data.registrationDeadline?.toDate ? data.registrationDeadline.toDate() : (data.registrationDeadline ? new Date(data.registrationDeadline) : undefined),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined),
          } as Tournament;

          tournsMap.set(d.id, firestoreTourn);
        });
      }
    } catch (e) {
      console.warn("Firestore fetch tournaments error, falling back to cached local storage:", e);
    }

    // 2. Merge local cache for any items not yet in Firestore or newer local edits
    // Only use INITIAL_TOURNAMENTS fallback if we are on taourirt or requesting all
    const initialFallback = (all === true || activeDirId === 'taourirt') ? INITIAL_TOURNAMENTS : [];
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, tournsMap.size > 0 ? [] : initialFallback);
    localList.forEach(t => {
      if (t && t.id && !isRecentlyDeleted('tournaments', t.id)) {
        const existing = tournsMap.get(t.id);
        if (!existing) {
          // If Firestore is loaded, only merge local items that are unsynced pending creations
          if (tournsMap.size === 0 || isPendingWrite('tournaments', t.id) || t.id.startsWith('tourn-')) {
            tournsMap.set(t.id, {
              ...t,
              directorateId: t.directorateId || 'taourirt',
              startDate: t.startDate ? (typeof t.startDate === 'object' && 'toDate' in t.startDate ? (t.startDate as any).toDate() : (t.startDate instanceof Date ? t.startDate : new Date(t.startDate))) : undefined,
              endDate: t.endDate ? (typeof t.endDate === 'object' && 'toDate' in t.endDate ? (t.endDate as any).toDate() : (t.endDate instanceof Date ? t.endDate : new Date(t.endDate))) : undefined,
              registrationDeadline: t.registrationDeadline ? (typeof t.registrationDeadline === 'object' && 'toDate' in t.registrationDeadline ? (t.registrationDeadline as any).toDate() : (t.registrationDeadline instanceof Date ? t.registrationDeadline : new Date(t.registrationDeadline))) : undefined
            });
          }
        } else if (isPendingWrite('tournaments', t.id)) {
          tournsMap.set(t.id, {
            ...existing,
            ...t,
            directorateId: t.directorateId || existing.directorateId || 'taourirt',
            startDate: t.startDate ? (typeof t.startDate === 'object' && 'toDate' in t.startDate ? (t.startDate as any).toDate() : (t.startDate instanceof Date ? t.startDate : new Date(t.startDate))) : existing.startDate,
            endDate: t.endDate ? (typeof t.endDate === 'object' && 'toDate' in t.endDate ? (t.endDate as any).toDate() : (t.endDate instanceof Date ? t.endDate : new Date(t.endDate))) : existing.endDate,
            registrationDeadline: t.registrationDeadline !== undefined 
              ? (t.registrationDeadline ? (typeof t.registrationDeadline === 'object' && 'toDate' in t.registrationDeadline ? (t.registrationDeadline as any).toDate() : (t.registrationDeadline instanceof Date ? t.registrationDeadline : new Date(t.registrationDeadline))) : undefined) 
              : existing.registrationDeadline
          });
        }
      }
    });

    const mergedList = Array.from(tournsMap.values()).filter(t => !isRecentlyDeleted('tournaments', t.id));
    const sanitizedList = mergedList.map(t => {
      let cleanCat = normalizeCategoryKey(t.ageCategory);
      if (/^CAT_/i.test(cleanCat) || /^cat_/i.test(cleanCat)) {
        cleanCat = 'U15';
      }
      let cleanName = t.name || '';
      if (/CAT_[0-9A-Za-z_]+/i.test(cleanName) || /cat_[0-9A-Za-z_]+/i.test(cleanName)) {
        cleanName = cleanName
          .replace(/CAT_[0-9A-Za-z_]+/gi, 'الصغار والصغيرات')
          .replace(/cat_[0-9A-Za-z_]+/gi, 'الصغار والصغيرات')
          .replace(/\s+-\s+-\s+/g, ' - ')
          .trim();
      }
      return {
        ...t,
        ageCategory: cleanCat,
        name: cleanName
      };
    });

    setLocal(STORAGE_KEYS.TOURNAMENTS, sanitizedList);
    const deduped = deduplicateById(sanitizedList);

    if (all === true || !activeDirId || activeDirId === 'all') {
      return deduped;
    }

    // Isolate by active directorate
    return deduped.filter(t => (t.directorateId || 'taourirt') === activeDirId);
  },

  async addTournament(tournament: Omit<Tournament, 'id'>): Promise<Tournament> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const docRef = doc(collection(db, 'tournaments'));
    const realId = docRef.id;

    const tournamentWithDir = {
      ...tournament,
      directorateId: tournament.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId),
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const newTournament: Tournament = {
      ...tournamentWithDir,
      id: realId
    };

    // Always update local cache first with final Firestore ID
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const filtered = localList.filter(t => t.id !== realId);
    setLocal(STORAGE_KEYS.TOURNAMENTS, [newTournament, ...filtered]);
    markPendingWrite('tournaments', realId);

    // Sync to Firestore with clean payload (no undefined fields)
    try {
      const firestorePayload = stripUndefinedDeep({
        ...tournamentWithDir,
        id: realId,
        startDate: tournamentWithDir.startDate instanceof Date ? Timestamp.fromDate(tournamentWithDir.startDate) : (tournamentWithDir.startDate ? Timestamp.fromDate(new Date(tournamentWithDir.startDate)) : null),
        endDate: tournamentWithDir.endDate instanceof Date ? Timestamp.fromDate(tournamentWithDir.endDate) : (tournamentWithDir.endDate ? Timestamp.fromDate(new Date(tournamentWithDir.endDate)) : null),
        registrationDeadline: tournamentWithDir.registrationDeadline instanceof Date ? Timestamp.fromDate(tournamentWithDir.registrationDeadline) : (tournamentWithDir.registrationDeadline ? Timestamp.fromDate(new Date(tournamentWithDir.registrationDeadline)) : null),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(docRef, firestorePayload);
      clearPendingWrite('tournaments', realId);
    } catch (e) {
      console.warn("Saved tournament locally; Firestore sync pending:", e);
    }

    // Automatically set sport isProgrammed to true in database & cache when a tournament is created
    try {
      const sportId = tournament.sportId;
      const currentSports = getLocal<Sport>('taourirt_sports_config', []);
      const targetSport = currentSports.find(s => s.id === sportId);
      const normCat = normalizeCategoryKey(tournament.ageCategory);
      let newCats = (targetSport?.ageCategories && targetSport.ageCategories.length > 0)
        ? targetSport.ageCategories.map(normalizeCategoryKey)
        : [normCat];
      if (!newCats.includes(normCat) && ['U12', 'U15', 'U18', 'U20'].includes(normCat)) {
        newCats.push(normCat);
      }
      
      const updatedSports = currentSports.map(s => s.id === sportId ? { ...s, isProgrammed: true, ageCategories: newCats } : s);
      setLocal('taourirt_sports_config', updatedSports);

      await setDoc(doc(db, 'sports', sportId), {
        isProgrammed: true,
        ageCategories: newCats,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Could not update sport programmed status in Firestore:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
    }

    return newTournament;
  },

  async deleteTournament(id: string): Promise<void> {
    try {
      // 1. Get the tournament details first to know what students, matches, and results to delete
      const tournaments = await this.getTournaments();
      const tournament = tournaments.find(t => t.id === id);

      if (tournament) {
        // 2. Delete Matches associated with this tournament or specific category/gender/affiliation
        const matches = await this.getMatches();
        const matchesToDelete = matches.filter(m => 
          m.tournamentId === id ||
          (m.sportId === tournament.sportId && 
           normalizeCategoryKey(m.ageCategory) === normalizeCategoryKey(tournament.ageCategory) && 
           m.gender === tournament.gender &&
           (tournament.affiliationType ? (m as any).affiliationType === tournament.affiliationType : true))
        );
        for (const m of matchesToDelete) {
          await this.deleteMatch(m.id);
        }

        // 3. Delete Students (Participants)
        const allStudents = await this.getStudents();
        const studentsToDelete = allStudents.filter(s => 
          s.sportId === tournament.sportId &&
          normalizeCategoryKey(s.category) === normalizeCategoryKey(tournament.ageCategory) &&
          s.gender === tournament.gender &&
          (tournament.affiliationType ? s.affiliationType === tournament.affiliationType : true)
        );
        for (const s of studentsToDelete) {
          await this.deleteStudent(s.id);
        }

        // 4. Delete Cross Country Results if applicable
        if (tournament.sportId === 'cross_country') {
          const activeDirId = this.getActiveDirectorateId();
          const resultsMap = await this.getCrossCountryResults();
          const resultsToDelete = (Object.values(resultsMap) as CrossCountryCategoryResult[]).filter(r => 
            normalizeCategoryKey(r.category) === normalizeCategoryKey(tournament.ageCategory) &&
            r.gender === tournament.gender
          );
          
          for (const r of resultsToDelete) {
            const docId = `${activeDirId}_${r.categoryId}`;
            await deleteDoc(doc(db, 'cross_country_results', docId)).catch(() => {});
            
            // Update local cache for CC results
            const cacheKey = `taourirt_cc_results_${activeDirId}`;
            const localResults = localStorage.getItem(cacheKey);
            if (localResults) {
              const parsed = JSON.parse(localResults) as Record<string, CrossCountryCategoryResult>;
              delete parsed[r.categoryId];
              localStorage.setItem(cacheKey, JSON.stringify(parsed));
            }
          }
        }
      }

      // 5. Delete the tournament itself from local storage
      markRecentlyDeleted('tournaments', id);
      const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
      const updated = localList.filter(t => t.id !== id);
      setLocal(STORAGE_KEYS.TOURNAMENTS, updated);

      // 6. Delete from Firestore
      await deleteDoc(doc(db, 'tournaments', id));

      // 7. Update parent sport configuration (isProgrammed and ageCategories)
      if (tournament) {
        const remainingSportTournaments = updated.filter(t => t.sportId === tournament.sportId);
        const currentSports = getLocal<Sport>('taourirt_sports_config', []);
        
        if (remainingSportTournaments.length === 0) {
          // If no tournaments remain for this sport, turn it to unprogrammed / neutralized
          const updatedSports = currentSports.map(s => 
            s.id === tournament.sportId ? { ...s, isProgrammed: false, ageCategories: [] } : s
          );
          setLocal('taourirt_sports_config', updatedSports);
          await setDoc(doc(db, 'sports', tournament.sportId), {
            isProgrammed: false,
            ageCategories: [],
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        } else {
          // Update ageCategories to only remaining active tournament categories
          const remainingCats = Array.from(new Set(remainingSportTournaments.map(t => normalizeCategoryKey(t.ageCategory)).filter(Boolean)));
          const updatedSports = currentSports.map(s => 
            s.id === tournament.sportId ? { ...s, isProgrammed: true, ageCategories: remainingCats } : s
          );
          setLocal('taourirt_sports_config', updatedSports);
          await setDoc(doc(db, 'sports', tournament.sportId), {
            isProgrammed: true,
            ageCategories: remainingCats,
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      }

      // 8. Dispatch synchronization events across all pages/components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tournamentDataChanged', { detail: { tournamentId: id } }));
        window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
        window.dispatchEvent(new CustomEvent('matchesDataChanged'));
        window.dispatchEvent(new CustomEvent('resultsChanged'));
        window.dispatchEvent(new CustomEvent('sportsConfigChanged'));
        window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
      }
    } catch (e) {
      console.warn("Error during cascade delete:", e);
      // Fallback: still delete the tournament locally even if cascade failed
      markRecentlyDeleted('tournaments', id);
      const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
      const updated = localList.filter(t => t.id !== id);
      setLocal(STORAGE_KEYS.TOURNAMENTS, updated);
      await deleteDoc(doc(db, 'tournaments', id)).catch(() => {});
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tournamentDataChanged', { detail: { tournamentId: id } }));
        window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
        window.dispatchEvent(new CustomEvent('matchesDataChanged'));
        window.dispatchEvent(new CustomEvent('sportsConfigChanged'));
      }
    }
  },

  async bulkDeleteTournamentsBySport(sportId: string): Promise<void> {
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const tournamentsToDelete = localList.filter(t => t.sportId === sportId);
    tournamentsToDelete.forEach(t => markRecentlyDeleted('tournaments', t.id));
    const updatedTournaments = localList.filter(t => t.sportId !== sportId);
    setLocal(STORAGE_KEYS.TOURNAMENTS, updatedTournaments);

    for (const tourn of tournamentsToDelete) {
      try {
        await deleteDoc(doc(db, 'tournaments', tourn.id));
      } catch (e) {
        console.warn(`Could not delete tournament ${tourn.id} in Firestore:`, e);
      }
    }

    // Delete associated matches
    try {
      const matches = await this.getMatches();
      const matchesToDelete = matches.filter(m => m.sportId === sportId || tournamentsToDelete.some(t => t.id === m.tournamentId));
      for (const m of matchesToDelete) {
        await this.deleteMatch(m.id);
      }
    } catch (e) {
      console.warn("Error deleting matches for sport:", e);
    }

    // Delete associated students
    try {
      const allStudents = await this.getStudents();
      const sportStudents = allStudents.filter(s => s.sportId === sportId);
      for (const s of sportStudents) {
        await this.deleteStudent(s.id);
      }
    } catch (e) {
      console.warn("Error deleting students for sport:", e);
    }

    // Delete cross country results if sport is cross_country
    if (sportId === 'cross_country') {
      try {
        const activeDirId = this.getActiveDirectorateId();
        const resultsMap = await this.getCrossCountryResults();
        for (const catId of Object.keys(resultsMap)) {
          const docId = `${activeDirId}_${catId}`;
          await deleteDoc(doc(db, 'cross_country_results', docId)).catch(() => {});
        }
        const cacheKey = `taourirt_cc_results_${activeDirId}`;
        localStorage.removeItem(cacheKey);
      } catch (e) {
        console.warn("Error deleting cross country results:", e);
      }
    }

    try {
      const currentSports = getLocal<Sport>('taourirt_sports_config', []);
      const updatedSports = currentSports.map(s => s.id === sportId ? { ...s, isProgrammed: false, ageCategories: [] } : s);
      setLocal('taourirt_sports_config', updatedSports);

      await setDoc(doc(db, 'sports', sportId), {
        isProgrammed: false,
        ageCategories: [],
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Could not reset sport programmed status in Firestore:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged', { detail: { sportId } }));
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('resultsChanged'));
      window.dispatchEvent(new CustomEvent('sportsConfigChanged'));
      window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
    }
  },

  async updateTournament(id: string, updates: Partial<Tournament>): Promise<void> {
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const existing = localList.find(t => t.id === id);
    const targetSportId = updates.sportId || existing?.sportId || 'cross_country';

    // Format updates and strip undefined
    const cleanUpdates: Record<string, any> = {};
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanUpdates[key] = val;
      }
    });

    const fullUpdatedTournament: Tournament = {
      ...(existing || { 
        id, 
        sportId: targetSportId, 
        name: 'البطولة الرياضية', 
        seasonId: '2026/2027', 
        directorateId: this.getActiveDirectorateId(), 
        gender: 'Mixed', 
        ageCategory: 'جميع الفئات', 
        level: 'High', 
        scope: 'Provincial', 
        status: 'Scheduled',
        affiliationType: 'non_club'
      } as Tournament),
      ...cleanUpdates,
      id,
      updatedAt: new Date()
    };

    const updated = localList.map(t => t.id === id ? fullUpdatedTournament : t);
    if (!existing) {
      updated.push(fullUpdatedTournament);
    }
    setLocal(STORAGE_KEYS.TOURNAMENTS, updated);

    // If manager email was provided, sync user account to Firebase and local accounts
    if (updates.managerEmail && updates.managerEmail.trim()) {
      const cleanEmail = updates.managerEmail.trim().toLowerCase();
      const sanitizedId = `mgr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      const accessCode = updates.accessCode || '123456';
      const managerName = updates.managerName?.trim() || 'مسؤول البطولة';

      // 1. Sync to local registry
      try {
        const localAccountsRaw = localStorage.getItem('local_registered_users');
        const accounts: Array<{ email: string; pass: string; name: string; role: string; accessCode?: string; assignedTournamentId?: string; sportId?: string }> = localAccountsRaw ? JSON.parse(localAccountsRaw) : [];
        const existingIdx = accounts.findIndex(a => a.email.toLowerCase() === cleanEmail);
        const newAccount = {
          email: cleanEmail,
          pass: accessCode,
          name: managerName,
          role: 'SPORT_MANAGER',
          accessCode,
          assignedTournamentId: id,
          sportId: targetSportId
        };
        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...newAccount };
        } else {
          accounts.push(newAccount);
        }
        localStorage.setItem('local_registered_users', JSON.stringify(accounts));
      } catch (err) {
        console.warn("Local storage manager save error:", err);
      }

      // 2. Sync to Firebase Firestore 'users' collection
      try {
        await setDoc(doc(db, 'users', sanitizedId), {
          id: sanitizedId,
          email: cleanEmail,
          fullName: managerName,
          phone: updates.managerPhone?.trim() || null,
          role: 'SPORT_MANAGER',
          accessCode: accessCode,
          assignedTournamentId: id,
          sportId: targetSportId,
          isActive: true,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (fbErr) {
        console.warn("Firestore sync manager user document error:", fbErr);
      }
    }

    // Build clean Firestore payload with valid Timestamps for dates
    markPendingWrite('tournaments', id);
    const cleanFirestorePayload: Record<string, any> = stripUndefinedDeep({
      ...fullUpdatedTournament,
      updatedAt: serverTimestamp()
    });
    if (fullUpdatedTournament.startDate) {
      cleanFirestorePayload.startDate = fullUpdatedTournament.startDate instanceof Date 
        ? Timestamp.fromDate(fullUpdatedTournament.startDate) 
        : Timestamp.fromDate(new Date(fullUpdatedTournament.startDate));
    }
    if (fullUpdatedTournament.endDate) {
      cleanFirestorePayload.endDate = fullUpdatedTournament.endDate instanceof Date 
        ? Timestamp.fromDate(fullUpdatedTournament.endDate) 
        : Timestamp.fromDate(new Date(fullUpdatedTournament.endDate));
    }
    if (fullUpdatedTournament.registrationDeadline !== undefined) {
      cleanFirestorePayload.registrationDeadline = fullUpdatedTournament.registrationDeadline 
        ? (fullUpdatedTournament.registrationDeadline instanceof Date 
            ? Timestamp.fromDate(fullUpdatedTournament.registrationDeadline) 
            : Timestamp.fromDate(new Date(fullUpdatedTournament.registrationDeadline))) 
        : null;
    }

    try {
      await setDoc(doc(db, 'tournaments', id), cleanFirestorePayload, { merge: true });
      clearPendingWrite('tournaments', id);
    } catch (e) {
      console.warn("Firestore tournament update error:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
    }
  },

  async updateSportDates(
    sportId: string,
    dates: {
      startDate?: any;
      endDate?: any;
      registrationDeadline?: any;
      status?: Tournament['status'];
      description?: string;
      level?: string;
    }
  ): Promise<void> {
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const updated = localList.map(t => {
      if (t.sportId === sportId) {
        return {
          ...t,
          ...(dates.startDate !== undefined ? { startDate: dates.startDate instanceof Date ? dates.startDate : new Date(dates.startDate) } : {}),
          ...(dates.endDate !== undefined ? { endDate: dates.endDate instanceof Date ? dates.endDate : new Date(dates.endDate) } : {}),
          ...(dates.registrationDeadline !== undefined ? { registrationDeadline: dates.registrationDeadline instanceof Date ? dates.registrationDeadline : (dates.registrationDeadline ? new Date(dates.registrationDeadline) : null) } : {}),
          ...(dates.status !== undefined ? { status: dates.status } : {}),
          ...(dates.description !== undefined ? { description: dates.description } : {}),
          ...(dates.level !== undefined ? { level: dates.level } : {}),
          updatedAt: new Date()
        };
      }
      return t;
    });
    setLocal(STORAGE_KEYS.TOURNAMENTS, updated);

    try {
      const snap = await getDocs(query(collection(db, 'tournaments'), where('sportId', '==', sportId)));
      if (!snap.empty) {
        const promises = snap.docs.map(d => {
          const updatePayload: any = {
            updatedAt: serverTimestamp()
          };
          if (dates.startDate !== undefined) {
            updatePayload.startDate = dates.startDate instanceof Date ? Timestamp.fromDate(dates.startDate) : (dates.startDate ? Timestamp.fromDate(new Date(dates.startDate)) : null);
          }
          if (dates.endDate !== undefined) {
            updatePayload.endDate = dates.endDate instanceof Date ? Timestamp.fromDate(dates.endDate) : (dates.endDate ? Timestamp.fromDate(new Date(dates.endDate)) : null);
          }
          if (dates.registrationDeadline !== undefined) {
            updatePayload.registrationDeadline = dates.registrationDeadline instanceof Date ? Timestamp.fromDate(dates.registrationDeadline) : (dates.registrationDeadline ? Timestamp.fromDate(new Date(dates.registrationDeadline)) : null);
          }
          if (dates.status !== undefined) updatePayload.status = dates.status;
          if (dates.description !== undefined) updatePayload.description = dates.description;
          if (dates.level !== undefined) updatePayload.level = dates.level;
          return setDoc(doc(db, 'tournaments', d.id), updatePayload, { merge: true });
        });
        await Promise.all(promises);
      } else {
        // No docs in Firestore yet for this sport, persist local items of this sport to Firestore
        const sportItems = updated.filter(t => t.sportId === sportId);
        for (const item of sportItems) {
          const payload: any = {
            ...item,
            startDate: item.startDate instanceof Date ? Timestamp.fromDate(item.startDate) : (item.startDate ? Timestamp.fromDate(new Date(item.startDate)) : null),
            endDate: item.endDate instanceof Date ? Timestamp.fromDate(item.endDate) : (item.endDate ? Timestamp.fromDate(new Date(item.endDate)) : null),
            registrationDeadline: item.registrationDeadline instanceof Date ? Timestamp.fromDate(item.registrationDeadline) : (item.registrationDeadline ? Timestamp.fromDate(new Date(item.registrationDeadline)) : null),
            updatedAt: serverTimestamp()
          };
          await setDoc(doc(db, 'tournaments', item.id), payload, { merge: true });
        }
      }
    } catch (e) {
      console.warn("Updated sport dates in Firestore:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
    }
  },

  async updateSportDeadline(sportId: string, registrationDeadline: any): Promise<void> {
    await this.updateSportDates(sportId, { registrationDeadline });
  },

  // MATCHES
  async getMatches(targetDirectorateId?: string, all?: boolean): Promise<Match[]> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    const normalizeMatch = (m: Match): Match => {
      const s1 = m.score1 ?? m.team1Score;
      const s2 = m.score2 ?? m.team2Score;
      return {
        ...m,
        directorateId: m.directorateId || 'taourirt',
        score1: s1,
        score2: s2,
        team1Score: s1,
        team2Score: s2
      };
    };

    let allMatches: Match[] = [];
    let fetchedFromCloud = false;
    try {
      const snap = await getDocs(collection(db, 'matches'));
      fetchedFromCloud = true;
      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('matches', d.id))
          .map(d => normalizeMatch({ id: d.id, ...d.data() } as Match));
        const filtered = firestoreList.filter(m => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3');
        const localPending = getLocal<Match>(STORAGE_KEYS.MATCHES, []).filter(
          lm => lm && lm.id && isPendingWrite('matches', lm.id) && !isRecentlyDeleted('matches', lm.id)
        );
        allMatches = deduplicateById([...localPending, ...filtered]);
        setLocal(STORAGE_KEYS.MATCHES, allMatches);
      } else {
        const localPending = getLocal<Match>(STORAGE_KEYS.MATCHES, []).filter(
          lm => lm && lm.id && isPendingWrite('matches', lm.id) && !isRecentlyDeleted('matches', lm.id)
        );
        allMatches = deduplicateById(localPending);
        setLocal(STORAGE_KEYS.MATCHES, allMatches);
      }
    } catch (e) {
      console.warn("Firestore fetch matches error, falling back to cache:", e);
    }

    if (!fetchedFromCloud && allMatches.length === 0) {
      const initialFallback = (all === true || activeDirId === 'taourirt') ? INITIAL_MATCHES : [];
      const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, initialFallback).map(normalizeMatch);
      const cleaned = localList.filter(m => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3' && !isRecentlyDeleted('matches', m.id));
      if (cleaned.length !== localList.length) {
        setLocal(STORAGE_KEYS.MATCHES, cleaned);
      }
      allMatches = deduplicateById(cleaned);
    }

    if (all === true || !activeDirId || activeDirId === 'all') {
      return allMatches;
    }

    return allMatches.filter(m => (m.directorateId || 'taourirt') === activeDirId);
  },

  async addMatch(match: Omit<Match, 'id'>): Promise<Match> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const docRef = doc(collection(db, 'matches'));
    const realId = docRef.id;

    const matchWithDir = {
      ...match,
      directorateId: match.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId)
    };
    const newMatch: Match = {
      ...matchWithDir,
      id: realId
    };
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
    const filtered = localList.filter(m => m.id !== realId);
    setLocal(STORAGE_KEYS.MATCHES, [newMatch, ...filtered]);
    markPendingWrite('matches', realId);

    try {
      const firestorePayload = stripUndefinedDeep({
        ...matchWithDir,
        id: realId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(docRef, firestorePayload);
      clearPendingWrite('matches', realId);
    } catch (e) {
      console.warn("Match saved locally; Firestore sync pending:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    // Trigger notification
    this.triggerMatchNotification('create', newMatch);

    return newMatch;
  },

  async updateMatch(matchId: string, matchData: Partial<Match>): Promise<void> {
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
    const updated = localList.map(m => m.id === matchId ? { ...m, ...matchData } : m);
    setLocal(STORAGE_KEYS.MATCHES, updated);
    markPendingWrite('matches', matchId);

    try {
      const { id, ...dataToUpdate } = matchData as any;
      const cleanData = stripUndefinedDeep(dataToUpdate);
      await setDoc(doc(db, 'matches', matchId), {
        ...cleanData,
        id: matchId,
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('matches', matchId);
    } catch (e) {
      console.warn("Match updated locally; Firestore sync pending:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    const fullMatch = updated.find(m => m.id === matchId);
    if (fullMatch) {
      this.triggerMatchNotification('update', fullMatch);
    }
  },

  async updateMatchScore(
    matchId: string,
    score1: number,
    score2: number,
    status: Match['status'],
    extras?: {
      penalty1?: number;
      penalty2?: number;
      winnerId?: string;
      notes?: string;
      scorers?: string;
      updatedBy?: string;
    }
  ): Promise<void> {
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
    const updated = localList.map(m => m.id === matchId ? {
      ...m,
      score1,
      score2,
      team1Score: score1,
      team2Score: score2,
      status,
      ...(extras || {})
    } : m);
    setLocal(STORAGE_KEYS.MATCHES, updated);
    markPendingWrite('matches', matchId);

    try {
      const cleanExtras = stripUndefinedDeep(extras || {});
      await setDoc(doc(db, 'matches', matchId), {
        id: matchId,
        score1,
        score2,
        team1Score: score1,
        team2Score: score2,
        status,
        ...cleanExtras,
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('matches', matchId);
    } catch (e) {
      console.warn("Match score updated locally; Firestore sync pending:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    const fullMatch = updated.find(m => m.id === matchId);
    if (fullMatch) {
      this.triggerMatchNotification('result', fullMatch);
    }
  },

  async deleteMatch(id: string): Promise<void> {
    markRecentlyDeleted('matches', id);
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
    const updated = localList.filter(m => m.id !== id);
    setLocal(STORAGE_KEYS.MATCHES, updated);

    try {
      await deleteDoc(doc(db, 'matches', id));
    } catch (e) {
      console.warn("Match deleted locally:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }
  },

  // SCHOOLS
  async getSchools(targetDirectorateId?: string, all?: boolean): Promise<School[]> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    try {
      const snap = await getDocs(collection(db, 'schools'));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('schools', d.id))
          .map(d => ({ id: d.id, ...d.data(), directorateId: d.data().directorateId || 'taourirt' } as School))
          .filter(s => s && s.name && !s.name.includes('غير محدد'));

        // Auto-heal accessCode for legacy schools
        const listWithCodes = firestoreList.map(s => {
          if (s.accessCode && s.accessCode.trim().length === 6) {
            return s;
          }
          const accessCode = generateSecureAccessCode();
          if (s.id) {
            setDoc(doc(db, 'schools', s.id), { accessCode }, { merge: true }).catch(err => 
              console.warn(`Failed to auto-update school ${s.name} accessCode:`, err)
            );
          }
          return { ...s, accessCode };
        });

        // Merge ONLY genuinely pending local writes (not deleted schools)
        const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
        const localPending = localList.filter(ls => 
          ls && ls.id && ls.name &&
          isPendingWrite('schools', ls.id) &&
          !isRecentlyDeleted('schools', ls.id) &&
          !ls.name.includes('غير محدد')
        );

        if (localPending.length > 0) {
          localPending.forEach(ls => {
            const docRef = doc(db, 'schools', ls.id);
            const sanitized = stripUndefinedDeep({
              ...ls,
              id: docRef.id,
              directorateId: ls.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId),
              updatedAt: serverTimestamp()
            });
            setDoc(docRef, sanitized, { merge: true })
              .then(() => clearPendingWrite('schools', ls.id))
              .catch(err => console.warn("Failed to background-persist pending school:", err));
          });
        }

        const combinedList = deduplicateById<School>([...localPending, ...listWithCodes]);
        setLocal(STORAGE_KEYS.SCHOOLS, combinedList);
        if (all === true || !activeDirId || activeDirId === 'all') {
          return combinedList;
        }
        return combinedList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      } else {
        // Firestore collection is empty: preserve only genuinely pending local creations
        const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
        const pendingOnly = localList.filter(ls =>
          ls && ls.id && ls.name &&
          isPendingWrite('schools', ls.id) &&
          !isRecentlyDeleted('schools', ls.id) &&
          !ls.name.includes('غير محدد')
        );
        if (pendingOnly.length > 0) {
          pendingOnly.forEach(ls => {
            const docRef = doc(db, 'schools', ls.id);
            const sanitized = stripUndefinedDeep({
              ...ls,
              id: docRef.id,
              directorateId: ls.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            setDoc(docRef, sanitized, { merge: true })
              .then(() => clearPendingWrite('schools', ls.id))
              .catch(err => console.warn("Background upload of pending school failed:", err));
          });
        }
        setLocal(STORAGE_KEYS.SCHOOLS, pendingOnly);
        return (all === true || !activeDirId || activeDirId === 'all')
          ? pendingOnly
          : pendingOnly.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      }
    } catch (e) {
      console.warn("Firestore schools fetch error:", e);
      const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
      const filtered = localList.filter(s => s && s.name && !s.name.includes('غير محدد') && !isRecentlyDeleted('schools', s.id));
      if (all === true || !activeDirId || activeDirId === 'all') {
        return filtered;
      }
      return filtered.filter(s => (s.directorateId || 'taourirt') === activeDirId);
    }
  },

  subscribeToSchools(callback: (schools: School[]) => void): () => void {
    try {
      const unsubscribe = onSnapshot(collection(db, 'schools'), (snap) => {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('schools', d.id))
          .map(d => ({ id: d.id, ...d.data(), directorateId: d.data().directorateId || 'taourirt' } as School))
          .filter(s => s && s.name && !s.name.includes('غير محدد'));
        
        // Auto-heal accessCode for legacy schools in real-time
        const listWithCodes = firestoreList.map(s => {
          if (s.accessCode && s.accessCode.trim().length === 6) {
            return s;
          }
          const accessCode = generateSecureAccessCode();
          if (s.id) {
            setDoc(doc(db, 'schools', s.id), { accessCode }, { merge: true }).catch(err => 
              console.warn(`Failed to auto-update school ${s.name} accessCode:`, err)
            );
          }
          return { ...s, accessCode };
        });

        const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
        const localPending = localList.filter(ls => 
          ls && ls.id && ls.name &&
          isPendingWrite('schools', ls.id) &&
          !isRecentlyDeleted('schools', ls.id) &&
          !ls.name.includes('غير محدد')
        );

        const combined = deduplicateById<School>([...localPending, ...listWithCodes]);
        setLocal(STORAGE_KEYS.SCHOOLS, combined);
        callback(combined);
      }, (err) => {
        console.warn("Real-time schools listener error:", err);
      });
      return unsubscribe;
    } catch (err) {
      console.warn("Failed to subscribe to schools:", err);
      return () => {};
    }
  },

  subscribeToTournaments(callback: (tournaments: Tournament[]) => void): () => void {
    try {
      const unsubscribe = onSnapshot(collection(db, 'tournaments'), (snap) => {
        const tournsMap = new Map<string, Tournament>();
        snap.docs.forEach(d => {
          if (isRecentlyDeleted('tournaments', d.id)) return;
          const data = d.data();
          const firestoreTourn: Tournament = {
            id: d.id,
            name: data.name || '',
            sportId: data.sportId || '',
            seasonId: data.seasonId || '',
            directorateId: data.directorateId || '',
            ageCategory: data.ageCategory || '',
            gender: data.gender || 'Mixed',
            level: data.level || '',
            scope: data.scope || 'Provincial',
            status: data.status || 'Scheduled',
            description: data.description || '',
            affiliationType: data.affiliationType || 'non_club',
            managerName: data.managerName || '',
            managerPhone: data.managerPhone || '',
            managerEmail: data.managerEmail || '',
            accessCode: data.accessCode || '',
            ...data,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
            endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
            registrationDeadline: data.registrationDeadline?.toDate ? data.registrationDeadline.toDate() : (data.registrationDeadline ? new Date(data.registrationDeadline) : undefined),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined),
          } as Tournament;
          tournsMap.set(d.id, firestoreTourn);
        });
        const localPending = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []).filter(
          lt => lt && lt.id && isPendingWrite('tournaments', lt.id) && !isRecentlyDeleted('tournaments', lt.id)
        );
        localPending.forEach(lt => tournsMap.set(lt.id, lt));
        const list = Array.from(tournsMap.values());
        setLocal(STORAGE_KEYS.TOURNAMENTS, list);
        callback(list);
      }, (err) => {
        console.warn("Real-time tournaments listener error:", err);
      });
      return unsubscribe;
    } catch (err) {
      console.warn("Failed to subscribe to tournaments:", err);
      return () => {};
    }
  },

  subscribeToMatches(callback: (matches: Match[]) => void): () => void {
    try {
      const unsubscribe = onSnapshot(collection(db, 'matches'), (snap) => {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('matches', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Match));
        const filtered = firestoreList.filter(m => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3');
        const localPending = getLocal<Match>(STORAGE_KEYS.MATCHES, []).filter(
          lm => lm && lm.id && isPendingWrite('matches', lm.id) && !isRecentlyDeleted('matches', lm.id)
        );
        const deduped = deduplicateById([...localPending, ...filtered]);
        setLocal(STORAGE_KEYS.MATCHES, deduped);
        callback(deduped);
      }, (err) => {
        console.warn("Real-time matches listener error:", err);
      });
      return unsubscribe;
    } catch (err) {
      console.warn("Failed to subscribe to matches:", err);
      return () => {};
    }
  },

  subscribeToVenues(callback: (venues: Venue[]) => void): () => void {
    try {
      const unsubscribe = onSnapshot(collection(db, 'venues'), (snap) => {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('venues', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Venue));
        const localPending = getLocal<Venue>(STORAGE_KEYS.VENUES, []).filter(
          lv => lv && lv.id && isPendingWrite('venues', lv.id) && !isRecentlyDeleted('venues', lv.id)
        );
        const deduped = deduplicateById([...localPending, ...firestoreList]);
        setLocal(STORAGE_KEYS.VENUES, deduped);
        callback(deduped);
      }, (err) => {
        console.warn("Real-time venues listener error:", err);
      });
      return unsubscribe;
    } catch (err) {
      console.warn("Failed to subscribe to venues:", err);
      return () => {};
    }
  },

  subscribeToSportsConfig(callback: (sports: Sport[]) => void): () => void {
    try {
      const unsubscribe = onSnapshot(collection(db, 'sports'), (snap) => {
        let fetchedSports: Sport[] = [];
        if (!snap.empty) {
          fetchedSports = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sport));
        }
        
        const localSports = getLocal<Sport>('taourirt_sports_config', []);
        if (fetchedSports.length === 0) {
          fetchedSports = localSports;
        } else if (localSports.length > 0) {
          fetchedSports = fetchedSports.map(f => {
            const loc = localSports.find(l => l.id === f.id);
            if (loc) {
              return {
                ...f,
                ...loc,
                ...f,
                ageCategories: (f.ageCategories && f.ageCategories.length > 0) ? f.ageCategories : loc.ageCategories
              };
            }
            return f;
          });
        }
        
        setLocal('taourirt_sports_config', fetchedSports);
        callback(fetchedSports);
      }, (err) => {
        console.warn("Real-time sports listener error:", err);
      });
      return unsubscribe;
    } catch (err) {
      console.warn("Failed to subscribe to sports configuration:", err);
      return () => {};
    }
  },

  async addSchool(school: Omit<School, 'id'>): Promise<School> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const accessCode = (school.accessCode && school.accessCode.trim().length === 6)
      ? school.accessCode.trim()
      : generateSecureAccessCode();
    const cleanName = school.name?.trim() || '';
    
    const newDocRef = doc(collection(db, 'schools'));
    const realId = newDocRef.id;

    const schoolWithDir: School = {
      ...school,
      id: realId,
      name: cleanName,
      type: school.type || 'تأهيلي',
      commune: school.commune || 'تاوريرت المركز',
      accessCode,
      directorateId: school.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId),
      coordinatorName: school.coordinatorName || school.teacherName || '',
      teacherName: school.coordinatorName || school.teacherName || '',
      phone: school.phone || '',
      principalName: school.principalName || '',
      principalPhone: school.principalPhone || ''
    };

    // Update local state immediately and mark pending until Firestore confirms
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const filtered = localList.filter(s => s.id !== realId);
    setLocal(STORAGE_KEYS.SCHOOLS, [schoolWithDir, ...filtered]);
    markPendingWrite('schools', realId);

    const firestoreDocData: Record<string, any> = {
      id: realId,
      name: cleanName,
      type: schoolWithDir.type,
      commune: schoolWithDir.commune,
      directorateId: schoolWithDir.directorateId,
      accessCode: schoolWithDir.accessCode,
      coordinatorName: schoolWithDir.coordinatorName || '',
      teacherName: schoolWithDir.teacherName || '',
      phone: schoolWithDir.phone || '',
      principalName: schoolWithDir.principalName || '',
      principalPhone: schoolWithDir.principalPhone || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(newDocRef, firestoreDocData);
      clearPendingWrite('schools', realId);
    } catch (e) {
      console.warn("Primary Firestore school save failed, retrying fallback:", e);
      try {
        await setDoc(newDocRef, {
          ...firestoreDocData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        clearPendingWrite('schools', realId);
      } catch (errFallback) {
        console.error("Critical: Firestore school save fallback failed (kept in pending queue):", errFallback);
      }
    }

    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
    return schoolWithDir;
  },

  async updateSchool(id: string, updates: Partial<School>): Promise<void> {
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const updated = localList.map(s => s.id === id ? { ...s, ...updates } : s);
    setLocal(STORAGE_KEYS.SCHOOLS, updated);
    markPendingWrite('schools', id);

    try {
      const cleanUpdates = stripUndefinedDeep({
        ...updates,
        id,
        updatedAt: serverTimestamp()
      });
      await setDoc(doc(db, 'schools', id), cleanUpdates, { merge: true });
      clearPendingWrite('schools', id);
    } catch (e) {
      console.warn("Primary Firestore school update failed, retrying fallback:", e);
      try {
        const cleanUpdates = stripUndefinedDeep({
          ...updates,
          id,
          updatedAt: new Date().toISOString()
        });
        await setDoc(doc(db, 'schools', id), cleanUpdates, { merge: true });
        clearPendingWrite('schools', id);
      } catch (err2) {
        console.error("Critical: Firestore school update fallback failed:", err2);
      }
    }

    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
  },

  async deleteSchool(id: string): Promise<void> {
    markRecentlyDeleted('schools', id);
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const updated = localList.filter(s => s.id !== id);
    setLocal(STORAGE_KEYS.SCHOOLS, updated);

    try {
      await deleteDoc(doc(db, 'schools', id));
    } catch (e) {
      console.error("Error deleting school from Firestore:", e);
    }

    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
  },

  async deleteAllSchools(): Promise<void> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    localList
      .filter(s => activeDirId === 'all' || (s.directorateId || 'taourirt') === activeDirId)
      .forEach(s => markRecentlyDeleted('schools', s.id));
    
    // 1. Delete from Firestore
    try {
      const snap = activeDirId === 'all'
        ? await getDocs(collection(db, 'schools'))
        : await getDocs(query(collection(db, 'schools'), where('directorateId', '==', activeDirId)));
      
      if (!snap.empty) {
        let batch = writeBatch(db);
        let count = 0;
        for (const d of snap.docs) {
          markRecentlyDeleted('schools', d.id);
          batch.delete(d.ref);
          count++;
          if (count >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }
    } catch (e) {
      console.error("Error deleting all schools from Firestore:", e);
    }

    // 2. Delete from Local Storage
    const updated = activeDirId === 'all'
      ? []
      : localList.filter(s => (s.directorateId || 'taourirt') !== activeDirId);
    setLocal(STORAGE_KEYS.SCHOOLS, updated);
    
    // Trigger global UI refresh
    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
  },

  async addSchoolsBulk(newSchools: Omit<School, 'id'>[]): Promise<School[]> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const effectiveDirId = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const existing = await this.getSchools();
    const createdOrUpdatedList: School[] = [];
    const updatedMap = new Map<string, School>();
    
    existing.forEach(s => {
      if (s.name) {
        updatedMap.set(s.name.trim().toLowerCase(), s);
      }
    });

    let batch = writeBatch(db);
    let batchCount = 0;

    for (const item of newSchools) {
      const cleanName = item.name?.trim();
      if (!cleanName) continue;
      const key = cleanName.toLowerCase();
      
      const cleanItem: any = {};
      Object.entries(item).forEach(([k, v]) => {
        cleanItem[k] = v !== undefined ? v : "";
      });

      const itemWithDir = {
        ...cleanItem,
        directorateId: item.directorateId || effectiveDirId,
        updatedAt: serverTimestamp()
      };

      const existingSchool = updatedMap.get(key);
      const accessCode = existingSchool?.accessCode || itemWithDir.accessCode || generateSecureAccessCode();

      const itemWithDirAndCode = {
        ...itemWithDir,
        accessCode
      };

      if (existingSchool) {
        const updatedItem: School = {
          ...existingSchool,
          ...itemWithDirAndCode,
          name: cleanName,
          id: existingSchool.id,
          coordinatorName: itemWithDirAndCode.coordinatorName || itemWithDirAndCode.teacherName || existingSchool.coordinatorName || '',
          teacherName: itemWithDirAndCode.coordinatorName || itemWithDirAndCode.teacherName || existingSchool.teacherName || ''
        } as any;
        
        updatedMap.set(key, updatedItem);
        createdOrUpdatedList.push(updatedItem);
        
        const docRef = doc(db, 'schools', existingSchool.id);
        batch.set(docRef, { ...itemWithDirAndCode, id: existingSchool.id }, { merge: true });
        batchCount++;
      } else {
        const docRef = doc(collection(db, 'schools'));
        const newSchool: School = {
          ...itemWithDirAndCode,
          id: docRef.id,
          name: cleanName,
          coordinatorName: itemWithDirAndCode.coordinatorName || itemWithDirAndCode.teacherName || '',
          teacherName: itemWithDirAndCode.coordinatorName || itemWithDirAndCode.teacherName || '',
          createdAt: serverTimestamp()
        } as any;
        
        batch.set(docRef, { ...itemWithDirAndCode, id: docRef.id, createdAt: serverTimestamp() }, { merge: true });
        updatedMap.set(key, newSchool);
        createdOrUpdatedList.push(newSchool);
        batchCount++;
      }

      if (batchCount >= 450) {
        await batch.commit();
        batch = writeBatch(db);
        batchCount = 0;
      }
    }

    if (batchCount > 0) {
      try {
        await batch.commit();
      } catch (e) {
        console.error("Firestore batch commit error:", e);
      }
    }

    const finalList = Array.from(updatedMap.values());
    setLocal(STORAGE_KEYS.SCHOOLS, finalList);
    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
    
    return createdOrUpdatedList;
  },

  // VENUES
  async getVenues(): Promise<Venue[]> {
    try {
      const snap = await getDocs(collection(db, 'venues'));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('venues', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Venue));
        const localPending = getLocal<Venue>(STORAGE_KEYS.VENUES, []).filter(
          lv => lv && lv.id && isPendingWrite('venues', lv.id) && !isRecentlyDeleted('venues', lv.id)
        );
        const merged = deduplicateById([...localPending, ...firestoreList]);
        setLocal(STORAGE_KEYS.VENUES, merged);
        return merged;
      } else {
        const localPending = getLocal<Venue>(STORAGE_KEYS.VENUES, []).filter(
          lv => lv && lv.id && isPendingWrite('venues', lv.id) && !isRecentlyDeleted('venues', lv.id)
        );
        if (localPending.length > 0) {
          setLocal(STORAGE_KEYS.VENUES, localPending);
          return localPending;
        }
      }
    } catch (e) {
      console.warn("Firestore venues fetch error:", e);
    }
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES).filter(v => !isRecentlyDeleted('venues', v.id));
    return deduplicateById(localList);
  },

  async addVenue(venue: Omit<Venue, 'id'>): Promise<Venue> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const docRef = doc(collection(db, 'venues'));
    const realId = docRef.id;

    const venueWithDir = {
      ...venue,
      directorateId: venue.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId)
    };
    const newVenue: Venue = {
      ...venueWithDir,
      id: realId
    };
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const filtered = localList.filter(v => v.id !== realId);
    setLocal(STORAGE_KEYS.VENUES, [newVenue, ...filtered]);
    markPendingWrite('venues', realId);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...venueWithDir,
        id: realId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(docRef, cleanPayload);
      clearPendingWrite('venues', realId);
    } catch (e) {
      console.warn("Saved venue locally; Firestore sync pending:", e);
    }
    window.dispatchEvent(new CustomEvent('venuesUpdated'));
    return newVenue;
  },

  async updateVenue(id: string, updates: Partial<Venue>): Promise<void> {
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const updated = localList.map(v => v.id === id ? { ...v, ...updates } : v);
    setLocal(STORAGE_KEYS.VENUES, updated);
    markPendingWrite('venues', id);

    try {
      const cleanUpdates = stripUndefinedDeep({
        ...updates,
        id,
        updatedAt: serverTimestamp()
      });
      await setDoc(doc(db, 'venues', id), cleanUpdates, { merge: true });
      clearPendingWrite('venues', id);
    } catch (e) {
      console.warn("Updated venue locally; Firestore sync pending:", e);
    }
    window.dispatchEvent(new CustomEvent('venuesUpdated'));
  },

  async deleteVenue(id: string): Promise<void> {
    markRecentlyDeleted('venues', id);
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const updated = localList.filter(v => v.id !== id);
    setLocal(STORAGE_KEYS.VENUES, updated);

    try {
      await deleteDoc(doc(db, 'venues', id));
    } catch (e) {
      console.warn("Deleted venue locally:", e);
    }
    window.dispatchEvent(new CustomEvent('venuesUpdated'));
  },

  // REFEREES
  async getReferees(): Promise<Referee[]> {
    let explicitReferees: Referee[] = [];
    const readCachedRefs = () => {
      const primary = getLocal<Referee>('taourirt_referees_data', []);
      const legacy = getLocal<Referee>('referees', []);
      return deduplicateById([...primary, ...legacy]).filter(r => !isRecentlyDeleted('referees', r.id));
    };

    try {
      const snap = await getDocs(collection(db, 'referees'));
      const firestoreRefs = snap.empty
        ? []
        : snap.docs
            .filter(d => !isRecentlyDeleted('referees', d.id))
            .map(d => ({ id: d.id, ...d.data() } as Referee));
      const pendingRefs = readCachedRefs().filter(r => isPendingWrite('referees', r.id));
      explicitReferees = deduplicateById([...pendingRefs, ...firestoreRefs]);
      setLocal('taourirt_referees_data', explicitReferees);
      setLocal('referees', explicitReferees);
    } catch (e) {
      console.warn("Firestore fetch referees error, falling back to local:", e);
      explicitReferees = readCachedRefs();
    }

    const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();

    let usersList: User[] = [];
    try {
      usersList = await this.getUsers();
    } catch (e) {
      console.warn("Failed to fetch users for referee merge:", e);
    }

    explicitReferees = explicitReferees.map(r => {
      const matchedUser = usersList.find(u => 
        u.id === r.id || 
        (u.fullName && r.fullName && (norm(u.fullName) === norm(r.fullName) || norm(u.fullName).includes(norm(r.fullName)) || norm(r.fullName).includes(norm(u.fullName))))
      );
      if (matchedUser && matchedUser.phone && matchedUser.phone.trim()) {
        return {
          ...r,
          phone: matchedUser.phone.trim(),
          photoUrl: matchedUser.photoUrl || r.photoUrl
        };
      }
      return r;
    });

    const teacherReferees: Referee[] = usersList
      .filter(t => !isRecentlyDeleted('referees', t.id) && t.role === 'TEACHER' && (Array.isArray(t.refereeSpecialty) ? t.refereeSpecialty.length > 0 : !!t.refereeSpecialty))
      .map(t => ({
        id: t.id,
        fullName: t.fullName + ' (أستاذ)',
        phone: t.phone || 'غير محدد',
        specialty: Array.isArray(t.refereeSpecialty) ? t.refereeSpecialty : [t.refereeSpecialty || 'كرة القدم'],
        directorateId: t.directorateId || 'taourirt',
        isActive: t.isActive !== false,
        isTeacher: true,
        photoUrl: t.photoUrl
      }));

    const idMap = new Map<string, Referee>();
    [...explicitReferees, ...teacherReferees].forEach(r => {
      if (!r || !r.id || isRecentlyDeleted('referees', r.id)) return;
      if (!idMap.has(r.id)) {
        idMap.set(r.id, r);
      } else {
        const existing = idMap.get(r.id)!;
        const mergedSpecialties = Array.from(new Set([
          ...(Array.isArray(existing.specialty) ? existing.specialty : (existing.specialty ? [existing.specialty] : [])),
          ...(Array.isArray(r.specialty) ? r.specialty : (r.specialty ? [r.specialty] : []))
        ]));
        idMap.set(r.id, {
          ...existing,
          ...r,
          specialty: mergedSpecialties,
          phone: (r.phone && r.phone !== 'غير محدد') ? r.phone : existing.phone,
          fullName: existing.fullName || r.fullName
        });
      }
    });

    const uniqueMap = new Map<string, Referee>();
    idMap.forEach(r => {
      const key = norm(r.fullName.replace(/\s*\(أستاذ\)\s*/g, ''));
      if (!uniqueMap.has(key) || (r.phone && r.phone !== 'غير محدد' && !uniqueMap.get(key)?.phone)) {
        uniqueMap.set(key, r);
      }
    });

    return deduplicateById(Array.from(uniqueMap.values()));
  },

  async addReferee(referee: Omit<Referee, 'id'>): Promise<Referee> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const docRef = doc(collection(db, 'referees'));
    const realId = docRef.id;

    const refereeWithDir = {
      ...referee,
      directorateId: referee.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId)
    };
    const newRef: Referee = { ...refereeWithDir, id: realId };
    const list = deduplicateById([...getLocal<Referee>('taourirt_referees_data', []), ...getLocal<Referee>('referees', [])]);
    const updated = [newRef, ...list.filter(r => r.id !== realId)];
    setLocal('taourirt_referees_data', updated);
    setLocal('referees', updated);
    markPendingWrite('referees', realId);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...refereeWithDir,
        id: realId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(docRef, cleanPayload);
      clearPendingWrite('referees', realId);
    } catch (e) {
      console.warn("Saved referee locally; Firestore sync pending:", e);
    }
    window.dispatchEvent(new CustomEvent('refereesUpdated'));
    return newRef;
  },

  async updateReferee(id: string, updates: Partial<Referee>): Promise<void> {
    const list = deduplicateById([...getLocal<Referee>('taourirt_referees_data', []), ...getLocal<Referee>('referees', [])]);
    const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
    
    const targetRef = list.find(r => r.id === id);
    const updated = list.some(r => r.id === id)
      ? list.map(r => r.id === id ? { ...r, ...updates } : r)
      : list;
    setLocal('taourirt_referees_data', updated);
    setLocal('referees', updated);

    // Check if this referee corresponds to a teacher user profile
    let matchedTeacherUser: User | undefined;
    try {
      const users = await this.getUsers();
      const refName = (updates.fullName || targetRef?.fullName || '').replace(/\s*\(أستاذ\)\s*/g, '');
      matchedTeacherUser = users.find(u => 
        u.id === id || 
        (refName && u.fullName && (norm(u.fullName) === norm(refName) || norm(u.fullName).includes(norm(refName)) || norm(refName).includes(norm(u.fullName))))
      );
    } catch (err) {
      console.warn("Error looking up teacher for referee update:", err);
    }

    // Update explicit referees collection if not purely a teacher-derived record (or if present in explicit list)
    if (!matchedTeacherUser || list.some(r => r.id === id)) {
      markPendingWrite('referees', id);
      try {
        const cleanUpdates = stripUndefinedDeep({
          ...updates,
          fullName: updates.fullName ? updates.fullName.replace(/\s*\(أستاذ\)\s*/g, '') : undefined,
          id,
          updatedAt: serverTimestamp()
        });
        await setDoc(doc(db, 'referees', id), cleanUpdates, { merge: true });
        clearPendingWrite('referees', id);
      } catch (e) {
        console.warn("Updated referee locally; Firestore sync pending:", e);
      }
    }

    // Bidirectional sync to user profile (including refereeSpecialty, phone, and fullName)
    if (matchedTeacherUser) {
      try {
        const cleanTeacherName = updates.fullName ? updates.fullName.replace(/\s*\(أستاذ\)\s*/g, '').trim() : undefined;
        await this.updateUserProfile(matchedTeacherUser.id, {
          ...(updates.phone ? { phone: updates.phone } : {}),
          ...(cleanTeacherName ? { fullName: cleanTeacherName } : {}),
          ...(updates.specialty !== undefined ? { refereeSpecialty: Array.isArray(updates.specialty) ? updates.specialty : [updates.specialty] } : {})
        });
      } catch (err) {
        console.warn("Error syncing referee update to user profile:", err);
      }
    }
    window.dispatchEvent(new CustomEvent('refereesUpdated'));
  },

  async deleteReferee(id: string): Promise<void> {
    markRecentlyDeleted('referees', id);
    const list = deduplicateById([...getLocal<Referee>('taourirt_referees_data', []), ...getLocal<Referee>('referees', [])]);
    const filtered = list.filter(r => r.id !== id);
    setLocal('taourirt_referees_data', filtered);
    setLocal('referees', filtered);
    try {
      await deleteDoc(doc(db, 'referees', id));
    } catch (e) {
      console.warn("Deleted referee locally:", e);
    }

    // If this referee was auto-derived from a teacher's refereeSpecialty, clear refereeSpecialty so they don't reappear
    try {
      const users = await this.getUsers();
      const matchedTeacher = users.find(u => u.id === id);
      if (matchedTeacher && matchedTeacher.refereeSpecialty) {
        await this.updateUserProfile(matchedTeacher.id, { refereeSpecialty: [] });
      }
    } catch (e) {
      console.warn("Could not clear teacher refereeSpecialty on referee delete:", e);
    }
    window.dispatchEvent(new CustomEvent('refereesUpdated'));
  },

  // USERS / TEACHERS
  async getUsers(): Promise<User[]> {
    const activeDirId = this.getActiveDirectorateId();
    const usersMap = new Map<string, User>();

    // Helper to find existing map entry by id, email, leaseNumber, or normalized name
    const findMatchingKey = (u: any): string | null => {
      if (!u) return null;
      const cleanEmail = u.email ? String(u.email).trim().toLowerCase() : '';
      const cleanLease = u.leaseNumber ? String(u.leaseNumber).trim() : '';
      const cleanName = u.fullName ? normalizeArabicName(u.fullName) : '';

      for (const [k, existing] of usersMap.entries()) {
        if (
          k === u.id || existing.id === u.id ||
          (cleanEmail && existing.email && isFlexibleEmailMatch(existing.email, cleanEmail)) ||
          (cleanLease && existing.leaseNumber && existing.leaseNumber === cleanLease) ||
          (cleanName && existing.fullName && cleanName.length >= 6 && normalizeArabicName(existing.fullName) === cleanName)
        ) {
          return k;
        }
      }
      return null;
    };

    let firestoreSucceeded = false;
    let firestoreWasEmpty = true;

    // 1. Load from Firestore first so deleted users never resurrect from local cache
    try {
      const snap = await getDocs(collection(db, 'users'));
      firestoreSucceeded = true;
      firestoreWasEmpty = snap.empty;
      if (!snap.empty) {
        snap.docs.forEach(d => {
          const docId = d.id;
          if (isRecentlyDeleted('users', docId)) return;
          const data = d.data() as any;
          const matchedKey = findMatchingKey({ id: docId, ...data });

          if (matchedKey) {
            const existing = usersMap.get(matchedKey)!;
            const preferData = !docId.startsWith('mgr_') || (data.schoolAccessVerified && !existing.schoolAccessVerified);
            const merged: User = {
              ...existing,
              ...data,
              id: preferData ? docId : existing.id,
              role: data.role || existing.role || 'TEACHER',
              fullName: data.fullName || data.name || existing.fullName || 'أستاذ',
              directorateId: data.directorateId || existing.directorateId || activeDirId,
              workLocation: preferData ? (data.workLocation || existing.workLocation || '') : (existing.workLocation || data.workLocation || ''),
              schoolId: preferData ? (data.schoolId || existing.schoolId || '') : (existing.schoolId || data.schoolId || ''),
              leaseNumber: data.leaseNumber || existing.leaseNumber || '',
              phone: data.phone || existing.phone || '',
              schoolAccessVerified: existing.schoolAccessVerified || data.schoolAccessVerified || false,
              isTechCommitteeHead: data.isTechCommitteeHead !== undefined ? !!data.isTechCommitteeHead : !!existing.isTechCommitteeHead,
              techCommitteeSports: data.techCommitteeSports !== undefined ? data.techCommitteeSports : (existing.techCommitteeSports || []),
              isTechCommitteeMember: data.isTechCommitteeMember !== undefined ? !!data.isTechCommitteeMember : !!existing.isTechCommitteeMember,
              techCommitteeSportsMemberOf: data.techCommitteeSportsMemberOf !== undefined ? data.techCommitteeSportsMemberOf : (existing.techCommitteeSportsMemberOf || [])
            };
            const targetKey = preferData ? docId : matchedKey;
            usersMap.set(targetKey, merged);
            if (matchedKey !== targetKey) {
              usersMap.delete(matchedKey);
            }
          } else {
            usersMap.set(docId, {
              id: docId,
              fullName: data.fullName || data.name || 'أستاذ',
              email: data.email || '',
              role: data.role || 'TEACHER',
              directorateId: data.directorateId || activeDirId,
              workLocation: data.workLocation || '',
              leaseNumber: data.leaseNumber || '',
              phone: data.phone || '',
              isTechCommitteeHead: !!data.isTechCommitteeHead,
              techCommitteeSports: Array.isArray(data.techCommitteeSports) ? data.techCommitteeSports : [],
              isTechCommitteeMember: !!data.isTechCommitteeMember,
              techCommitteeSportsMemberOf: Array.isArray(data.techCommitteeSportsMemberOf) ? data.techCommitteeSportsMemberOf : [],
              ...data
            });
          }
        });
      }
    } catch (e) {
      console.warn("Firestore fetch users error, falling back to cached list:", e);
    }

    // 2. Merge local cache ONLY when offline, empty cloud, or pending write
    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      if (localUsersRaw) {
        const localUsers = JSON.parse(localUsersRaw) as any[];
        localUsers.forEach(u => {
          if (u && (u.id || u.email || u.leaseNumber || u.fullName)) {
            const uid = String(u.id || u.email || u.leaseNumber || '');
            if (uid && isRecentlyDeleted('users', uid)) return;
            if (firestoreSucceeded && !firestoreWasEmpty && !(uid && isPendingWrite('users', uid))) return;

            const matchedKey = findMatchingKey(u);
            const userObj: User = {
              id: u.id || matchedKey || u.email || u.leaseNumber,
              fullName: u.fullName || u.name || 'أستاذ',
              email: u.email || '',
              role: u.role || 'TEACHER',
              directorateId: u.directorateId || activeDirId,
              workLocation: u.workLocation || '',
              leaseNumber: u.leaseNumber || '',
              phone: u.phone || '',
              isTechCommitteeHead: !!u.isTechCommitteeHead,
              techCommitteeSports: Array.isArray(u.techCommitteeSports) ? u.techCommitteeSports : [],
              isTechCommitteeMember: !!u.isTechCommitteeMember,
              techCommitteeSportsMemberOf: Array.isArray(u.techCommitteeSportsMemberOf) ? u.techCommitteeSportsMemberOf : [],
              ...u
            };

            if (matchedKey) {
              const existing = usersMap.get(matchedKey)!;
              const preferNew = (uid && isPendingWrite('users', uid)) || (u.schoolAccessVerified && !existing.schoolAccessVerified);
              const merged: User = {
                ...existing,
                ...(preferNew ? userObj : {}),
                workLocation: preferNew ? (u.workLocation || existing.workLocation) : (existing.workLocation || u.workLocation),
                schoolId: preferNew ? (u.schoolId || existing.schoolId) : (existing.schoolId || u.schoolId),
                schoolAccessVerified: existing.schoolAccessVerified || u.schoolAccessVerified || false
              };
              const targetKey = preferNew ? userObj.id : matchedKey;
              usersMap.set(targetKey, merged);
              if (matchedKey !== targetKey) usersMap.delete(matchedKey);
            } else {
              usersMap.set(userObj.id, userObj);
            }
          }
        });
      }
    } catch {}

    // 3. Also check demo user profile
    try {
      const demoRaw = localStorage.getItem('demo_user_profile');
      if (demoRaw) {
        const demo = JSON.parse(demoRaw);
        if (demo && demo.id && !isRecentlyDeleted('users', String(demo.id))) {
          const existing = usersMap.get(demo.id);
          usersMap.set(demo.id, {
            ...existing,
            ...demo,
            id: demo.id,
            role: demo.role || existing?.role || 'TEACHER'
          });
        }
      }
    } catch {}

    const mergedUsers = Array.from(usersMap.values()).map(u => fixTeacherFieldJumble(u));
    try {
      localStorage.setItem('local_registered_users', JSON.stringify(mergedUsers));
    } catch {}

    return deduplicateById(mergedUsers);
  },

  async getTeachers(): Promise<User[]> {
    try {
      const allUsers = await this.getUsers();
      return allUsers.filter(u => !u.role || u.role === 'TEACHER');
    } catch (e) {
      console.warn("Firestore fetch teachers error:", e);
      return [];
    }
  },

  async cleanupDuplicateTeachers(primaryUser: Partial<User>): Promise<User | null> {
    if (!primaryUser || (!primaryUser.id && !primaryUser.email && !primaryUser.leaseNumber && !primaryUser.fullName)) {
      return null;
    }

    try {
      const allUsers = await this.getUsers();
      const primaryId = primaryUser.id;
      const cleanEmail = primaryUser.email?.trim().toLowerCase();
      const cleanLease = primaryUser.leaseNumber?.trim();
      const cleanName = primaryUser.fullName ? normalizeArabicName(primaryUser.fullName) : '';

      // Find all duplicate teacher records that represent the same teacher
      const duplicates = allUsers.filter(u => {
        if (primaryId && u.id === primaryId) return false;
        
        const emailMatch = !!(cleanEmail && u.email && isFlexibleEmailMatch(u.email, cleanEmail));
        const leaseMatch = !!(cleanLease && u.leaseNumber && u.leaseNumber === cleanLease);
        const nameMatch = !!(cleanName && u.fullName && normalizeArabicName(u.fullName) === cleanName && cleanName.length >= 6);

        return emailMatch || leaseMatch || nameMatch;
      });

      if (duplicates.length === 0) return null;

      let mergedPrimary: User = { ...primaryUser } as User;
      const idsToDelete: string[] = [];

      duplicates.forEach(dup => {
        // Merge missing fields from duplicate into primary user
        mergedPrimary = {
          ...dup,
          ...mergedPrimary,
          workLocation: primaryUser.workLocation || dup.workLocation || '',
          schoolId: primaryUser.schoolId || dup.schoolId || '',
          leaseNumber: primaryUser.leaseNumber || dup.leaseNumber || '',
          phone: primaryUser.phone || dup.phone || '',
          email: primaryUser.email || dup.email || '',
          schoolAccessVerified: primaryUser.schoolAccessVerified ?? dup.schoolAccessVerified ?? false
        };

        if (dup.id && dup.id !== primaryId) {
          idsToDelete.push(dup.id);
        }
      });

      // Delete duplicates from local cache and Firestore
      for (const dupId of idsToDelete) {
        await this.deleteUser(dupId);
      }

      // Save the cleaned primary record
      if (primaryId) {
        await this.updateUserProfile(primaryId, mergedPrimary);
      }

      return mergedPrimary;
    } catch (err) {
      console.error("Error cleaning up duplicate teachers:", err);
      return null;
    }
  },

  async updateUserProfile(userId: string, profileData: Partial<User>): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();

    // Strip undefined values to prevent Firestore unsupported field value crashes
    const cleanProfileData: Record<string, any> = {};
    Object.entries(profileData).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanProfileData[key] = val;
      }
    });

    // 1. Update in local_registered_users list
    let users: User[] = [];
    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      users = localUsersRaw ? JSON.parse(localUsersRaw) : [];
    } catch {}

    const idx = users.findIndex((u: any) => 
      (userId && u.id === userId) || 
      (profileData.email && u.email?.toLowerCase() === profileData.email?.toLowerCase()) ||
      (profileData.leaseNumber && u.leaseNumber === profileData.leaseNumber)
    );

    let fullUserRecord: User;
    if (idx >= 0) {
      fullUserRecord = {
        ...users[idx],
        ...cleanProfileData,
        id: users[idx].id || userId,
        role: cleanProfileData.role || users[idx].role || 'TEACHER',
        directorateId: cleanProfileData.directorateId || users[idx].directorateId || activeDirId,
        isActive: users[idx].isActive !== undefined ? users[idx].isActive : true,
        updatedAt: new Date()
      };
      users[idx] = fullUserRecord;
    } else {
      fullUserRecord = {
        id: userId,
        fullName: cleanProfileData.fullName || (cleanProfileData as any).name || 'أستاذ',
        email: cleanProfileData.email || '',
        role: cleanProfileData.role || 'TEACHER',
        directorateId: cleanProfileData.directorateId || activeDirId,
        workLocation: cleanProfileData.workLocation || '',
        leaseNumber: cleanProfileData.leaseNumber || '',
        phone: cleanProfileData.phone || '',
        isActive: true,
        isTechCommitteeHead: !!cleanProfileData.isTechCommitteeHead,
        techCommitteeSports: cleanProfileData.techCommitteeSports || [],
        isTechCommitteeMember: !!cleanProfileData.isTechCommitteeMember,
        techCommitteeSportsMemberOf: cleanProfileData.techCommitteeSportsMemberOf || [],
        ...cleanProfileData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      users.push(fullUserRecord);
    }
    localStorage.setItem('local_registered_users', JSON.stringify(users));

    // 2. Also sync demo user profile if matching
    try {
      const savedDemo = localStorage.getItem('demo_user_profile');
      if (savedDemo) {
        const parsed = JSON.parse(savedDemo) as User;
        if (parsed.id === userId || (profileData.email && parsed.email?.toLowerCase() === profileData.email?.toLowerCase()) || parsed.role === 'TEACHER') {
          const updatedDemo = { ...parsed, ...fullUserRecord, updatedAt: new Date() };
          localStorage.setItem('demo_user_profile', JSON.stringify(updatedDemo));
        }
      }
    } catch {}

    // 3. Sync full document to Firestore
    const targetDocId = fullUserRecord.id || userId;
    if (targetDocId) {
      markPendingWrite('users', targetDocId);
      try {
        await setDoc(doc(db, 'users', targetDocId), stripUndefinedDeep({
          ...fullUserRecord,
          id: targetDocId,
          updatedAt: serverTimestamp()
        }), { merge: true });
        clearPendingWrite('users', targetDocId);
      } catch (e) {
        console.warn("Firestore user profile update error:", e);
      }
    }

    try {
      // Trigger event for listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('userDataChanged'));
        window.dispatchEvent(new CustomEvent('teacherProfileUpdated', { detail: fullUserRecord }));
      }

      // Synchronize changes to Schools (teacherName & teacher phone)
      if (profileData.workLocation || profileData.fullName || profileData.phone) {
        const schoolsList = getLocal<School>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
        let schoolChanged = false;
        const updatedSchools = schoolsList.map(sch => {
          const matchesWork = profileData.workLocation && (
            sch.name.trim().toLowerCase() === profileData.workLocation.trim().toLowerCase() ||
            sch.name.includes(profileData.workLocation) ||
            profileData.workLocation.includes(sch.name)
          );
          const matchesTeacherName = profileData.fullName && sch.teacherName && (
            sch.teacherName.trim().toLowerCase() === profileData.fullName.trim().toLowerCase()
          );

          if (matchesWork || matchesTeacherName) {
            schoolChanged = true;
            return {
              ...sch,
              ...(profileData.fullName ? { teacherName: profileData.fullName } : {}),
              ...(profileData.phone ? { phone: profileData.phone } : {})
            };
          }
          return sch;
        });

        if (schoolChanged) {
          setLocal(STORAGE_KEYS.SCHOOLS, updatedSchools);
          try {
            const matched = updatedSchools.filter(s => {
              const prev = schoolsList.find(ps => ps.id === s.id);
              return prev && (prev.phone !== s.phone || prev.teacherName !== s.teacherName);
            });
            for (const ms of matched) {
              await setDoc(doc(db, 'schools', ms.id), stripUndefinedDeep({
                teacherName: ms.teacherName,
                phone: ms.phone,
                updatedAt: Timestamp.now()
              }), { merge: true }).catch(() => {});
            }
          } catch (e) {
            console.warn("Error syncing teacher phone to schools Firestore:", e);
          }
        }
      }

      // Synchronize changes to Referees list
      if (profileData.phone || profileData.fullName || profileData.refereeSpecialty) {
        const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
        const refList = deduplicateById([...getLocal<Referee>('taourirt_referees_data', []), ...getLocal<Referee>('referees', [])]);
        let refChanged = false;
        const targetName = profileData.fullName;
        
        const updatedRefList = refList.map(r => {
          const matchId = r.id === userId;
          const matchName = targetName && r.fullName && (
            norm(r.fullName) === norm(targetName) ||
            norm(r.fullName).includes(norm(targetName)) ||
            norm(targetName).includes(norm(r.fullName))
          );

          if (matchId || matchName) {
            refChanged = true;
            return {
              ...r,
              ...(profileData.phone ? { phone: profileData.phone } : {}),
              ...(profileData.fullName ? { fullName: profileData.fullName } : {}),
              ...(profileData.refereeSpecialty ? { specialty: Array.isArray(profileData.refereeSpecialty) ? profileData.refereeSpecialty : [profileData.refereeSpecialty] } : {})
            };
          }
          return r;
        });

        if (refChanged) {
          setLocal('taourirt_referees_data', updatedRefList);
          setLocal('referees', updatedRefList);
          try {
            const matched = updatedRefList.filter(r => {
              const matchId = r.id === userId;
              const matchName = targetName && r.fullName && (norm(r.fullName) === norm(targetName) || norm(r.fullName).includes(norm(targetName)));
              return matchId || matchName;
            });
            for (const mr of matched) {
              await setDoc(doc(db, 'referees', mr.id), stripUndefinedDeep({
                ...(profileData.phone ? { phone: profileData.phone } : {}),
                ...(profileData.fullName ? { fullName: profileData.fullName } : {}),
                updatedAt: Timestamp.now()
              }), { merge: true }).catch(() => {});
            }
          } catch (e) {
            console.warn("Error syncing referee phone to Firestore:", e);
          }
        }
      }
    } catch (err) {
      console.warn("Local storage update profile error:", err);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    markRecentlyDeleted('users', userId);
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      console.warn("Deleted from Firestore failed, proceeding with local:", e);
    }

    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      if (localUsersRaw) {
        const users = JSON.parse(localUsersRaw) as User[];
        const updated = users.filter(u => u.id !== userId);
        localStorage.setItem('local_registered_users', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Local storage delete user error:", e);
    }
    window.dispatchEvent(new CustomEvent('userDataChanged'));
  },

  async deleteAllTeachers(): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    
    // 1. Delete from Firestore
    try {
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'TEACHER'),
        where('directorateId', '==', activeDirId)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          markRecentlyDeleted('users', d.id);
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Error deleting all teachers from Firestore:", e);
    }

    // 2. Delete from Local Storage
    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      if (localUsersRaw) {
        const users = JSON.parse(localUsersRaw) as User[];
        users.forEach(u => {
          if (u.role === 'TEACHER' && (u.directorateId || 'taourirt') === activeDirId && u.id) {
            markRecentlyDeleted('users', u.id);
          }
        });
        const updated = users.filter(u => 
          !(u.role === 'TEACHER' && (u.directorateId || 'taourirt') === activeDirId)
        );
        localStorage.setItem('local_registered_users', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Local storage delete all teachers error:", e);
    }
    window.dispatchEvent(new CustomEvent('userDataChanged'));
  },

  // DIRECTORATE TRANSFER WORKFLOW FOR TEACHERS
  async requestTeacherTransfer(
    userId: string,
    targetDirectorateId: string,
    targetDirectoratePin: string
  ): Promise<{ success: boolean; message: string; transfer?: DirectorateTransferRequest }> {
    // 1. Verify PIN for target directorate
    const isPinValid = await this.verifyDirectorateCode(targetDirectorateId, targetDirectoratePin.trim());
    if (!isPinValid) {
      return { success: false, message: 'القن السري للمديرية الإقليمية المستهدفة غير صحيح. يرجى التأكد وإعادة المحاولة.' };
    }

    // 2. Fetch target directorate details
    const directorates = await this.getDirectorates();
    const targetDir = directorates.find(d => d.id === targetDirectorateId);
    if (!targetDir) {
      return { success: false, message: 'المديرية الإقليمية المستهدفة غير موجودة.' };
    }

    // 3. Fetch user details
    const users = await this.getUsers();
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) {
      return { success: false, message: 'تعذر العثور على حساب الأستاذ.' };
    }

    const currentDirId = currentUser.directorateId || 'taourirt';
    if (currentDirId === targetDirectorateId) {
      return { success: false, message: 'أنت منتمٍ بالفعل لهذه المديرية الإقليمية.' };
    }

    const currentDir = directorates.find(d => d.id === currentDirId);

    // 4. Create pending transfer object
    const transferReq: DirectorateTransferRequest = {
      targetDirectorateId,
      targetDirectorateName: targetDir.name,
      targetDirectorateRegion: targetDir.region,
      currentDirectorateId: currentDirId,
      currentDirectorateName: currentDir?.name || 'المديرية الإقليمية بتاوريرت',
      requestedAt: new Date().toISOString(),
      status: 'pending',
      teacherId: currentUser.id,
      teacherName: currentUser.fullName,
      leaseNumber: currentUser.leaseNumber,
      workLocation: currentUser.workLocation,
      phone: currentUser.phone,
      teachingCadre: currentUser.teachingCadre
    };

    // 5. Update user profile with pendingTransfer (do NOT change directorateId yet!)
    await this.updateUserProfile(userId, {
      pendingTransfer: transferReq
    });

    // 6. Send system notification to the sport managers / coordinators of the target directorate
    try {
      await this.addNotification({
        title: `طلب انتقال أستاذ وارد: ${currentUser.fullName}`,
        body: `طلب الأستاذ ${currentUser.fullName} (رقم التأجير: ${currentUser.leaseNumber || 'غير محدد'}) الانتقال إلى ${targetDir.name}. بانتظار موافقتكم.`,
        role: 'SPORT_MANAGER',
        directorateId: targetDirectorateId
      });
    } catch (e) {
      console.warn("Notification dispatch for transfer request warning:", e);
    }

    return {
      success: true,
      message: `تم التحقق من القن السري وتقديم طلب الانتقال إلى مديرية ${targetDir.name} بنجاح. الطلب الآن قيد المعالجة في انتظار موافقة المسؤول الإقليمي.`,
      transfer: transferReq
    };
  },

  async cancelTeacherTransfer(userId: string): Promise<void> {
    await this.updateUserProfile(userId, {
      pendingTransfer: null
    });
  },

  async approveTeacherTransfer(
    teacherId: string,
    targetDirectorateId: string,
    targetDirectorateName: string
  ): Promise<void> {
    // Update teacher profile: assign new directorate and clear pending transfer
    await this.updateUserProfile(teacherId, {
      directorateId: targetDirectorateId,
      directorateName: targetDirectorateName,
      pendingTransfer: null
    });

    // Send confirmation notification to the teacher
    try {
      await this.addNotification({
        title: 'تهانينا! تمت الموافقة على طلب انتقالكم 🎉',
        body: `وافق المسؤول الإقليمي لـ (${targetDirectorateName}) على طلب انتقالك. يمكنك الآن الولوج والتفاعل مع كافة أنشطة مديريتك الجديدة.`,
        userIds: [teacherId],
        role: 'TEACHER',
        directorateId: targetDirectorateId
      });
    } catch (e) {
      console.warn("Approval notification error:", e);
    }
  },

  async rejectTeacherTransfer(teacherId: string, reason?: string): Promise<void> {
    await this.updateUserProfile(teacherId, {
      pendingTransfer: null
    });

    try {
      await this.addNotification({
        title: 'إشعار بشأن طلب الانتقال',
        body: `نأسف لإبلاغكم بأنه لم تتم الموافقة على طلب الانتقال إلى المديرية المطلوبة${reason ? `: ${reason}` : ' من قبل المسؤول الإقليمي.'}`,
        userIds: [teacherId],
        role: 'TEACHER'
      });
    } catch (e) {
      console.warn("Rejection notification error:", e);
    }
  },

  async getPendingTransfersForDirectorate(targetDirectorateId: string): Promise<User[]> {
    const users = await this.getUsers();
    return users.filter(u => 
      u.role === 'TEACHER' && 
      u.pendingTransfer && 
      u.pendingTransfer.status === 'pending' &&
      u.pendingTransfer.targetDirectorateId === targetDirectorateId
    );
  },

  // Direct phone update for teacher, school principal, or referee
  async updateContactPhone(target: {
    type: 'teacher' | 'school' | 'principal' | 'referee';
    id?: string;
    schoolId?: string;
    schoolName?: string;
    name?: string;
    phone: string;
  }): Promise<void> {
    const cleanPhone = target.phone.trim();
    if (!cleanPhone) return;

    // 1. If it's a School or Principal
    if (target.type === 'principal' || target.type === 'school') {
      const schoolsList = getLocal<School>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
      const targetSchool = schoolsList.find(s => 
        (target.schoolId && s.id === target.schoolId) ||
        (target.id && s.id === target.id) ||
        (target.schoolName && (s.name === target.schoolName || s.name.includes(target.schoolName)))
      );

      if (targetSchool) {
        const fieldToUpdate = target.type === 'principal' ? { principalPhone: cleanPhone } : { phone: cleanPhone };
        await this.updateSchool(targetSchool.id, fieldToUpdate);
      }
    }

    // 2. If it's a Teacher
    if (target.type === 'teacher') {
      const allUsers = await this.getUsers();
      const matchedUser = allUsers.find(u => 
        (target.id && u.id === target.id) ||
        (target.name && u.fullName === target.name) ||
        (target.schoolName && u.workLocation && (u.workLocation === target.schoolName || target.schoolName.includes(u.workLocation)))
      );

      if (matchedUser) {
        await this.updateUserProfile(matchedUser.id, { phone: cleanPhone });
      }

      // Also update matching school's teacher phone
      const schoolsList = getLocal<School>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
      const targetSchool = schoolsList.find(s => 
        (target.schoolId && s.id === target.schoolId) ||
        (target.schoolName && (s.name === target.schoolName || s.name.includes(target.schoolName))) ||
        (target.name && s.teacherName && s.teacherName === target.name)
      );
      if (targetSchool) {
        await this.updateSchool(targetSchool.id, { phone: cleanPhone });
      }
    }

    // 3. If it's a Referee
    if (target.type === 'referee') {
      const referees = await this.getReferees();
      const matchedRef = referees.find(r => 
        (target.id && r.id === target.id) ||
        (target.name && (r.fullName === target.name || r.fullName.includes(target.name)))
      );
      if (matchedRef && !matchedRef.isTeacher) {
        await this.updateReferee(matchedRef.id, { phone: cleanPhone });
      } else if (matchedRef && matchedRef.isTeacher) {
        await this.updateUserProfile(matchedRef.id, { phone: cleanPhone });
      }
    }
  },

  // ACTIVE SEASON CONFIGURATION
  async getSeasons(): Promise<string[]> {
    try {
      const snap = await getDocs(collection(db, 'config'));
      const seasonsDoc = snap.docs.find(d => d.id === 'seasons');
      if (seasonsDoc && seasonsDoc.data().list) {
        return seasonsDoc.data().list;
      }
    } catch (e) {
      console.warn("Error loading seasons list from Firestore:", e);
    }
    const local = localStorage.getItem('taourirt_sports_seasons_list');
    if (local) {
      try {
        return JSON.parse(local);
      } catch {}
    }
    return ['2025/2026', '2026/2027'];
  },

  async addSeason(season: string): Promise<void> {
    const current = await this.getSeasons();
    if (current.includes(season)) return;
    const newList = [...current, season].sort();
    localStorage.setItem('taourirt_sports_seasons_list', JSON.stringify(newList));
    try {
      await setDoc(doc(db, 'config', 'seasons'), {
        list: newList,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Error saving seasons list to Firestore:", e);
    }
  },

  async getActiveSeason(): Promise<string> {
    try {
      const snap = await getDoc(doc(db, 'config', 'season'));
      if (snap.exists()) {
        const season = snap.data().current || '2026/2027';
        localStorage.setItem('taourirt_sports_season', season);
        // Sync legacy key
        localStorage.setItem('active_season', season);
        return season;
      }
    } catch (e) {
      console.warn("Error loading active season from Firestore:", e);
    }
    return localStorage.getItem('taourirt_sports_season') || '2026/2027';
  },

  subscribeToActiveSeason(callback: (season: string) => void): () => void {
    try {
      return onSnapshot(doc(db, 'config', 'season'), (docSnap) => {
        if (docSnap.exists()) {
          const season = docSnap.data().current || '2026/2027';
          localStorage.setItem('taourirt_sports_season', season);
          localStorage.setItem('active_season', season);
          callback(season);
        }
      }, (error) => {
        console.warn("Firestore subscription error for active season:", error);
      });
    } catch (e) {
      console.warn("Error setting up onSnapshot for active season:", e);
      return () => {};
    }
  },

  async setActiveSeason(season: string): Promise<void> {
    localStorage.setItem('taourirt_sports_season', season);
    localStorage.setItem('active_season', season);
    window.dispatchEvent(new CustomEvent('seasonChanged', { detail: season }));
    try {
      await setDoc(doc(db, 'config', 'season'), {
        current: season,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Error saving season to Firestore:", e);
    }
  },

  // SPORTS CONFIGURATION
  async getSportsConfig(): Promise<Sport[]> {
    let fetchedSports: Sport[] = [];
    try {
      const snap = await getDocs(collection(db, 'sports'));
      if (!snap.empty) {
        fetchedSports = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sport));
      }
    } catch (e) {
      console.warn("Firestore fetch sports error, falling back to local cache:", e);
    }

    const localSports = getLocal<Sport>('taourirt_sports_config', []);
    if (fetchedSports.length === 0) {
      fetchedSports = localSports;
    } else if (localSports.length > 0) {
      const map = new Map<string, Sport>();
      fetchedSports.forEach(s => map.set(s.id, s));
      localSports.forEach(loc => {
        const remote = map.get(loc.id);
        if (remote) {
          map.set(loc.id, {
            ...remote,
            ...loc,
            isDeleted: loc.isDeleted !== undefined ? loc.isDeleted : remote.isDeleted,
            ageCategories: (loc.ageCategories && loc.ageCategories.length > 0) ? loc.ageCategories : remote.ageCategories
          });
        } else {
          map.set(loc.id, loc);
        }
      });
      fetchedSports = Array.from(map.values());
    }

    const allCategoryIds = getAgeCategoriesForSeason('2026/2027').map(c => c.id);

    // 1. Merge default base sports
    const mergedBase: Sport[] = Object.entries(BASE_SPORTS).map(([id, s]) => {
      const existing = fetchedSports.find(item => item.id === id);
      if (existing) {
        if (existing.isDeleted) {
          return {
            ...existing,
            id,
            name: s.name,
            icon: s.icon,
            isDeleted: true
          };
        }
        // Prevent tournament title corruption from ever overriding base sport discipline name
        const isTournamentTitle = existing.name && (
          existing.name.includes('البطولة') ||
          existing.name.includes('دوري') ||
          existing.name.includes('بطولة')
        );
        const cleanName = isTournamentTitle || !existing.name ? s.name : existing.name;

        return {
          ...existing,
          name: cleanName,
          icon: existing.icon || s.icon,
          description: existing.description || `منافسات ${s.name} الإقليمية`
        };
      }
      return {
        id,
        name: s.name,
        icon: s.icon,
        description: `منافسات ${s.name} الإقليمية`,
        ageCategories: allCategoryIds,
        studentLimit: 0,
        athleticsSpecialties: []
      };
    });

    // 2. Custom sports created by central admin (any sport in fetchedSports not in BASE_SPORTS)
    const customSports: Sport[] = fetchedSports
      .filter(item => !Object.prototype.hasOwnProperty.call(BASE_SPORTS, item.id))
      .map(item => {
        let cleanName = item.name || 'رياضة جديدة';
        if (cleanName.includes('البطولة الإقليمية لـ')) {
          cleanName = cleanName.replace(/البطولة الإقليمية لـ\s*/, '').trim();
        } else if (cleanName.includes('البطولة الإقليمية')) {
          cleanName = cleanName.replace(/البطولة الإقليمية\s*/, '').trim();
        }
        return {
          ...item,
          name: cleanName || 'رياضة جديدة',
          icon: item.icon || '🏆',
          description: item.description || `منافسات ${cleanName || 'رياضة جديدة'} المدرسية`,
          ageCategories: item.ageCategories || allCategoryIds,
          studentLimit: item.studentLimit !== undefined ? item.studentLimit : 0,
          athleticsSpecialties: item.athleticsSpecialties || [],
          isCustom: true
        };
      });

    const allSports: Sport[] = deduplicateById<Sport>([...mergedBase, ...customSports]).map(s => {
      const rawCats = (Array.isArray(s.ageCategories) ? s.ageCategories : allCategoryIds) as string[];
      
      // Clean raw categories from any technical strings like CAT_1793910455460_TEFB or cat_...
      const normalizedCats = Array.from(new Set(
        rawCats
          .map(c => normalizeCategoryKey(c))
          .filter(c => !/^CAT_/i.test(c) && !/^cat_/i.test(c) && ['U12', 'U15', 'U18', 'U20'].includes(c))
      ));
      const validCats = normalizedCats.length > 0 ? normalizedCats : ['U12', 'U15', 'U18', 'U20'];

      const cleanedCustom = (s.customAgeCategories || [])
        .filter(cat => cat && cat.name && !/^CAT_/i.test(cat.name))
        .map(cat => ({
          ...cat,
          id: cat.id || cat.name,
          name: cat.name
        }));

      // Clean category student limits keys
      const cleanCategoryLimits: Record<string, number> = {};
      if (s.categoryStudentLimits) {
        Object.entries(s.categoryStudentLimits).forEach(([k, v]) => {
          if (!/^CAT_/i.test(k) && !/^cat_/i.test(k)) {
            const cleanKey = normalizeCategoryKey(k);
            if (['U12', 'U15', 'U18', 'U20'].includes(cleanKey)) {
              cleanCategoryLimits[cleanKey] = v;
            }
          }
        });
      }

      return {
        ...s,
        ageCategories: validCats,
        customAgeCategories: cleanedCustom.length > 0 ? cleanedCustom : undefined,
        categoryStudentLimits: Object.keys(cleanCategoryLimits).length > 0 ? cleanCategoryLimits : undefined
      };
    });

    // Keep SPORTS_MAP in sync with all current sports
    allSports.forEach(s => {
      SPORTS_MAP[s.id] = { name: s.name, icon: s.icon || '🏆' };
    });

    // Cache custom sports in localStorage for instantaneous boot
    const customListOnly = allSports.filter(s => s.isCustom);
    if (customListOnly.length > 0) {
      localStorage.setItem('taourirt_custom_sports', JSON.stringify(customListOnly.map(s => ({ id: s.id, name: s.name, icon: s.icon || '🏆' }))));
    }

    setLocal('taourirt_sports_config', allSports);
    return allSports.filter(s => s && !s.isDeleted);
  },

  async addSport(sport: {
    name: string;
    id?: string;
    icon?: string;
    description?: string;
    ageCategories: string[];
    studentLimit?: number;
    athleticsSpecialties?: string[];
    customAgeCategories?: CustomAgeCategory[];
    categoryStudentLimits?: Record<string, number>;
    targetAffiliations?: string[];
  }): Promise<Sport> {
    const cleanName = sport.name.trim();
    // Unique ID from latin characters or sport_timestamp
    let sportId = (sport.id || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (!sportId) {
      sportId = `sport_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const newSport: Sport = {
      id: sportId,
      name: cleanName,
      icon: sport.icon || '🏆',
      description: sport.description?.trim() || `منافسات ${cleanName} المدرسية الإقليمية`,
      ageCategories: sport.ageCategories,
      customAgeCategories: sport.customAgeCategories || [],
      studentLimit: sport.studentLimit !== undefined ? sport.studentLimit : 0,
      categoryStudentLimits: sport.categoryStudentLimits || {},
      targetAffiliations: sport.targetAffiliations || ['non_club', 'espoir_non_club', 'sports_tracks', 'espoir_club'],
      athleticsSpecialties: sport.athleticsSpecialties || [],
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    // Register immediately in runtime SPORTS_MAP
    SPORTS_MAP[sportId] = { name: newSport.name, icon: newSport.icon || '🏆' };

    const currentSports = await this.getSportsConfig();
    const updatedSports = deduplicateById<Sport>([...currentSports.filter(s => s.id !== sportId), newSport]);
    setLocal('taourirt_sports_config', updatedSports);

    const customOnly = updatedSports.filter(s => s.isCustom);
    localStorage.setItem('taourirt_custom_sports', JSON.stringify(customOnly.map(s => ({ id: s.id, name: s.name, icon: s.icon || '🏆' }))));

    try {
      await setDoc(doc(db, 'sports', sportId), {
        ...newSport,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Added custom sport locally, Firestore pending:", e);
    }

    return newSport;
  },

  async deleteSport(sportId: string): Promise<void> {
    // Delete from runtime SPORTS_MAP
    delete SPORTS_MAP[sportId];

    // Load full local sports (including any previously deleted)
    const currentLocal = getLocal<Sport>('taourirt_sports_config', []);
    let updatedSports = currentLocal.map(s => {
      if (s.id === sportId) {
        return { ...s, isDeleted: true };
      }
      return s;
    });

    if (BASE_SPORTS[sportId]) {
      // If base sport not yet in local list, explicitly insert it with isDeleted: true
      if (!updatedSports.some(s => s.id === sportId)) {
        updatedSports.push({
          id: sportId,
          name: BASE_SPORTS[sportId].name,
          icon: BASE_SPORTS[sportId].icon,
          description: `منافسات ${BASE_SPORTS[sportId].name} الإقليمية`,
          ageCategories: [],
          isDeleted: true
        });
      }
    } else {
      // Custom sport: filter it out or mark isDeleted
      updatedSports = updatedSports.filter(s => s.id !== sportId);
    }

    setLocal('taourirt_sports_config', updatedSports);

    const customOnly = updatedSports.filter(s => s.isCustom && !s.isDeleted);
    localStorage.setItem('taourirt_custom_sports', JSON.stringify(customOnly.map(s => ({ id: s.id, name: s.name, icon: s.icon || '🏆' }))));

    // Dispatch event so any other components (e.g. SportsBar, Navigation) update immediately
    window.dispatchEvent(new CustomEvent('sportsConfigChanged', { detail: { deletedId: sportId } }));

    try {
      if (BASE_SPORTS[sportId]) {
        // For base sports, update the document to mark as deleted in Firestore
        await setDoc(doc(db, 'sports', sportId), { isDeleted: true }, { merge: true });
      } else {
        // For custom sports, delete the document
        await deleteDoc(doc(db, 'sports', sportId));
      }
    } catch (e) {
      console.warn("Deleted sport locally, Firestore pending:", e);
    }
  },

  async updateSportCategories(
    sportId: string,
    ageCategories: string[],
    studentLimit?: number,
    athleticsSpecialties?: string[],
    name?: string,
    icon?: string,
    isProgrammed?: boolean,
    customAgeCategories?: CustomAgeCategory[],
    categoryStudentLimits?: Record<string, number>,
    targetAffiliations?: string[]
  ): Promise<void> {
    const list = await this.getSportsConfig();
    const existingSport = list.find(s => s.id === sportId);

    // Prevent tournament title corruption from setting sport name
    const isTournamentTitle = name && (
      name.includes('البطولة') ||
      name.includes('دوري') ||
      name.includes('بطولة')
    );
    const validSportName = isTournamentTitle ? undefined : name;

    const updated = list.map(s => {
      if (s.id !== sportId) return s;
      return {
        ...s,
        ageCategories,
        customAgeCategories: customAgeCategories !== undefined ? customAgeCategories : s.customAgeCategories,
        studentLimit: studentLimit !== undefined ? studentLimit : s.studentLimit,
        categoryStudentLimits: categoryStudentLimits !== undefined ? categoryStudentLimits : s.categoryStudentLimits,
        targetAffiliations: targetAffiliations !== undefined ? targetAffiliations : (s.targetAffiliations || ['non_club', 'club_affiliated']),
        athleticsSpecialties: athleticsSpecialties !== undefined ? athleticsSpecialties : s.athleticsSpecialties,
        name: validSportName || s.name,
        icon: icon || s.icon,
        isProgrammed: isProgrammed !== undefined ? isProgrammed : s.isProgrammed
      };
    });
    setLocal('taourirt_sports_config', updated);

    if (validSportName || icon) {
      SPORTS_MAP[sportId] = {
        name: validSportName || SPORTS_MAP[sportId]?.name || 'الرياضة',
        icon: icon || SPORTS_MAP[sportId]?.icon || '🏆'
      };
    }

    try {
      await setDoc(doc(db, 'sports', sportId), {
        ageCategories,
        customAgeCategories: customAgeCategories !== undefined ? customAgeCategories : (existingSport?.customAgeCategories || null),
        studentLimit: studentLimit !== undefined ? studentLimit : (existingSport?.studentLimit || null),
        categoryStudentLimits: categoryStudentLimits !== undefined ? categoryStudentLimits : (existingSport?.categoryStudentLimits || null),
        targetAffiliations: targetAffiliations !== undefined ? targetAffiliations : (existingSport?.targetAffiliations || ['non_club', 'club_affiliated']),
        athleticsSpecialties: athleticsSpecialties !== undefined ? athleticsSpecialties : (existingSport?.athleticsSpecialties || null),
        ...(isProgrammed !== undefined ? { isProgrammed } : {}),
        ...(validSportName ? { name: validSportName } : {}),
        ...(icon ? { icon } : {}),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Updated sport categories locally, Firestore pending:", e);
    }
  },

  // STUDENTS / TEAM ROSTERS
  async getStudents(targetDirectorateId?: string, all?: boolean): Promise<Student[]> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    let allStudents: Student[] = [];
    try {
      const snap = await getDocs(collection(db, 'students'));
      const localList = getLocal<Student>('taourirt_students_data', []).filter(s => s && !isRecentlyDeleted('students', s.id));
      const pendingLocal = localList.filter(s => isPendingWrite('students', s.id));

      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('students', d.id))
          .map(d => ({ id: d.id, ...d.data(), directorateId: d.data().directorateId || 'taourirt' } as Student));
        allStudents = deduplicateById([...pendingLocal, ...firestoreList]);
        setLocal('taourirt_students_data', allStudents);
      } else {
        allStudents = deduplicateById(pendingLocal);
        setLocal('taourirt_students_data', allStudents);
      }
    } catch (e) {
      console.warn("Firestore fetch students error, using local storage:", e);
      allStudents = getLocal<Student>('taourirt_students_data', []).filter(s => s && !isRecentlyDeleted('students', s.id));
    }
    const cleanList = deduplicateById(allStudents);
    if (all === true || !activeDirId || activeDirId === 'all') {
      return cleanList;
    }
    return cleanList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
  },

  subscribeToStudents(callback: (students: Student[]) => void): () => void {
    try {
      const unsubscribe = onSnapshot(collection(db, 'students'), (snap) => {
        const localList = getLocal<Student>('taourirt_students_data', []).filter(s => s && !isRecentlyDeleted('students', s.id));
        const pendingLocal = localList.filter(s => isPendingWrite('students', s.id));
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('students', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Student));
        const merged = deduplicateById([...pendingLocal, ...firestoreList]);
        setLocal('taourirt_students_data', merged);
        callback(merged);
      }, (err) => {
        console.warn("Real-time students listener error:", err);
      });
      return unsubscribe;
    } catch (err) {
      console.warn("Failed to subscribe to students:", err);
      return () => {};
    }
  },

  async addStudent(student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<Student> {
    const activeDirId = this.getActiveDirectorateId();
    const studentWithDir = {
      ...student,
      directorateId: (student as any).directorateId || activeDirId
    };
    const studentId = `stud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newStudent: Student = {
      ...studentWithDir,
      id: studentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;

    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', [newStudent, ...localList.filter(s => s.id !== studentId)]);
    markPendingWrite('students', studentId);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...studentWithDir,
        id: studentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await setDoc(doc(db, 'students', studentId), cleanPayload);
      clearPendingWrite('students', studentId);
    } catch (e) {
      console.warn("Student saved locally; Firestore sync pending:", e);
    }

    window.dispatchEvent(new CustomEvent('studentsUpdated'));
    return newStudent;
  },

  async addStudentsBulk(studentsList: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Student[]> {
    const activeDirId = this.getActiveDirectorateId();
    const createdStudents: Student[] = [];
    const nowTime = Date.now();

    for (let i = 0; i < studentsList.length; i++) {
      const s = studentsList[i];
      const studentWithDir = {
        ...s,
        directorateId: (s as any).directorateId || activeDirId
      };
      const newStudent: Student = {
        ...studentWithDir,
        id: `stud-${nowTime}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any;
      createdStudents.push(newStudent);
      markPendingWrite('students', newStudent.id);
    }

    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', deduplicateById([...createdStudents, ...localList]));

    try {
      let batch = writeBatch(db);
      let opCount = 0;
      let batchIds: string[] = [];

      for (const newStudent of createdStudents) {
        const studentRef = doc(db, 'students', newStudent.id);
        const cleanPayload = stripUndefinedDeep({
          ...newStudent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        batch.set(studentRef, cleanPayload, { merge: true });
        batchIds.push(newStudent.id);
        opCount++;

        if (opCount >= 450) {
          await batch.commit();
          batchIds.forEach(id => clearPendingWrite('students', id));
          batch = writeBatch(db);
          opCount = 0;
          batchIds = [];
        }
      }

      if (opCount > 0) {
        await batch.commit();
        batchIds.forEach(id => clearPendingWrite('students', id));
      }
    } catch (e) {
      console.warn("Bulk students saved locally; Firestore sync pending:", e);
    }

    window.dispatchEvent(new CustomEvent('studentsUpdated'));
    return createdStudents;
  },

  async deleteStudent(id: string): Promise<void> {
    markRecentlyDeleted('students', id);
    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', localList.filter(s => s.id !== id));

    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (e) {
      console.warn("Deleted student locally:", e);
    }
    window.dispatchEvent(new CustomEvent('studentsUpdated'));
  },

  async updateStudent(id: string, student: Partial<Student>): Promise<void> {
    const localList = getLocal<Student>('taourirt_students_data', []);
    const existsLocally = localList.some(s => s.id === id);
    const updated = existsLocally
      ? localList.map(s => s.id === id ? { ...s, ...student, updatedAt: new Date().toISOString() } : s)
      : [{ ...(student as Student), id, updatedAt: new Date().toISOString() }, ...localList];
    setLocal('taourirt_students_data', updated);
    markPendingWrite('students', id);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...student,
        id,
        updatedAt: serverTimestamp()
      });

      await setDoc(doc(db, 'students', id), cleanPayload, { merge: true });
      clearPendingWrite('students', id);
    } catch (e) {
      console.warn("Updated student locally; Firestore sync pending:", e);
    }
    window.dispatchEvent(new CustomEvent('studentsUpdated'));
  },

  async updateBibNumbersBulk(items: Array<{ id: string; bibNumber: string | number }>): Promise<void> {
    if (!items || items.length === 0) return;
    const localList = getLocal<Student>('taourirt_students_data', []);
    const bibMap = new Map(items.map(it => [it.id, String(it.bibNumber)]));
    const nowIso = new Date().toISOString();
    const updated = localList.map(s => {
      if (bibMap.has(s.id)) {
        const b = bibMap.get(s.id)!;
        return {
          ...s,
          bibNumber: b,
          crossCountryBibNumber: b,
          updatedAt: nowIso
        } as Student;
      }
      return s;
    });
    setLocal('taourirt_students_data', updated);

    // Sync to Firestore in background
    try {
      await Promise.all(
        items.map(async (item) => {
          try {
            await setDoc(doc(db, 'students', item.id), {
              bibNumber: String(item.bibNumber),
              crossCountryBibNumber: String(item.bibNumber),
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch (err) {
            // ignore individual doc fail
          }
        })
      );
    } catch (e) {
      console.warn("Synced bib numbers locally; Firestore background sync:", e);
    }
    window.dispatchEvent(new CustomEvent('studentsUpdated'));
  },

  // NOTIFICATIONS SYSTEM
  async getNotifications(): Promise<AppNotification[]> {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      }
    } catch (e) {
      console.warn("Firestore fetch notifications error:", e);
    }
    return getLocal<AppNotification>('taourirt_notifications_data', []);
  },

  async addNotification(notification: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> {
    const activeDirId = this.getActiveDirectorateId();
    const notificationWithDir = {
      ...notification,
      directorateId: notification.directorateId || activeDirId
    };
    const newNotification: AppNotification = {
      ...notificationWithDir,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const localList = getLocal<AppNotification>('taourirt_notifications_data', []);
    setLocal('taourirt_notifications_data', [newNotification, ...localList]);

    try {
      await setDoc(doc(db, 'notifications', newNotification.id), {
        ...notificationWithDir,
        id: newNotification.id,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Notification saved locally; Firestore sync pending:", e);
    }

    return newNotification;
  },

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    const localList = getLocal<AppNotification>('taourirt_notifications_data', []);
    const updated = localList.map(n => {
      if (n.id === id) {
        const readBy = n.readBy || [];
        if (!readBy.includes(userId)) {
          return { ...n, readBy: [...readBy, userId] };
        }
      }
      return n;
    });
    setLocal('taourirt_notifications_data', updated);

    try {
      const docRef = doc(db, 'notifications', id);
      const readByList = updated.find(n => n.id === id)?.readBy || [userId];
      await updateDoc(docRef, {
        readBy: readByList
      });
    } catch (e) {
      console.warn("Updated notification read state locally:", e);
    }
  },

  async triggerMatchNotification(type: 'create' | 'update' | 'result', match: Match) {
    try {
      const schools = await this.getSchools();
      const s1Name = schools.find(s => s.id === match.team1Id)?.name || 'الفريق الأول';
      const s2Name = schools.find(s => s.id === match.team2Id)?.name || 'الفريق الثاني';
      const sportName = SPORTS_MAP[match.sportId]?.name || 'التخصص الرياضي';
      
      let title = '';
      let body = '';
      
      if (type === 'create') {
        title = `🏆 برمجة مباراة جديدة: ${sportName}`;
        body = `تمت برمجة مباراة جديدة في ${sportName} بين ${s1Name} و ${s2Name} يوم ${match.date ? (typeof match.date === 'string' ? match.date : new Date(match.date.seconds * 1000).toLocaleDateString('ar-MA')) : ''} على الساعة ${match.startTime}.`;
      } else if (type === 'update') {
        title = `📅 تعديل مباراة: ${sportName}`;
        body = `تم تحديث تفاصيل أو موعد المباراة بين ${s1Name} و ${s2Name} في منافسات ${sportName}. الموعد الجديد: يوم ${match.date ? (typeof match.date === 'string' ? match.date : new Date(match.date.seconds * 1000).toLocaleDateString('ar-MA')) : ''} في تمام الساعة ${match.startTime}.`;
      } else if (type === 'result') {
        title = `⚽ نتيجة مباراة: ${sportName}`;
        const scoreText = match.score1 !== undefined && match.score2 !== undefined ? `(${match.score1} - ${match.score2})` : '';
        body = `تم تسجيل نتيجة المباراة في ${sportName} بين ${s1Name} و ${s2Name}: ${scoreText}. حالة المباراة: ${match.status === 'Completed' ? 'منتهية' : match.status}.`;
      }
      
      await this.addNotification({
        title,
        body,
        sportId: match.sportId,
        role: 'ALL',
        userIds: []
      });
    } catch (err) {
      console.error("Error triggering match notification:", err);
    }
  },

  async getRoleSidebarPermissions(): Promise<RoleSidebarPermissions> {
    const DEFAULT_PERMISSIONS: RoleSidebarPermissions = {
      CENTRAL_ADMIN: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions',
        'action:export_data', 'action:import_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule', 'action:delete_records'
      ],
      TECH_COMMITTEE_HEAD: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config',
        'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
      ],
      SPORT_MANAGER: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics',
        'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
      ],
      TEACHER: [
        '/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics',
        'action:export_data', 'action:register_students'
      ],
      REFEREE: [
        '/dashboard', '/matches', '/statistics',
        'action:edit_results'
      ]
    };

    const ensureNewRoutes = (perms: RoleSidebarPermissions): RoleSidebarPermissions => {
      if (!perms || typeof perms !== 'object') return DEFAULT_PERMISSIONS;
      const res = { ...perms };
      (['CENTRAL_ADMIN', 'TECH_COMMITTEE_HEAD', 'SPORT_MANAGER'] as const).forEach(role => {
        if (res[role] && Array.isArray(res[role]) && !res[role].includes('/helper-apps')) {
          const list = [...res[role]];
          const matchIdx = list.indexOf('/matches');
          if (matchIdx !== -1) {
            list.splice(matchIdx + 1, 0, '/helper-apps');
          } else {
            list.push('/helper-apps');
          }
          res[role] = list;
        }
      });
      return res;
    };

    try {
      const docSnap = await getDoc(doc(db, 'settings', 'role_sidebar_permissions'));
      if (docSnap.exists()) {
        const firestoreData = docSnap.data() as RoleSidebarPermissions;
        if (firestoreData && typeof firestoreData === 'object') {
          const merged = ensureNewRoutes({ ...DEFAULT_PERMISSIONS, ...firestoreData });
          localStorage.setItem('taourirt_role_sidebar_permissions', JSON.stringify(merged));
          return merged;
        }
      }
    } catch (e) {
      console.warn("Firestore fetch role_sidebar_permissions error, checking local storage:", e);
    }

    try {
      const local = localStorage.getItem('taourirt_role_sidebar_permissions');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed === 'object') {
          return ensureNewRoutes({ ...DEFAULT_PERMISSIONS, ...parsed });
        }
      }
    } catch (e) {
      console.error("Error loading local role permissions:", e);
    }
    return DEFAULT_PERMISSIONS;
  },

  subscribeToReferees(callback: (referees: Referee[]) => void): () => void {
    try {
      return onSnapshot(collection(db, 'referees'), (snap) => {
        const referees = snap.docs.map(d => ({ id: d.id, ...d.data() } as Referee));
        callback(referees);
      }, (error) => {
        console.warn("Firestore subscription error for referees:", error);
      });
    } catch (e) {
      console.warn("Error setting up onSnapshot for referees:", e);
      return () => {};
    }
  },

  subscribeToUsers(callback: (users: User[]) => void): () => void {
    try {
      return onSnapshot(collection(db, 'users'), (snap) => {
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() } as User));
        callback(users);
      }, (error) => {
        console.warn("Firestore subscription error for users:", error);
      });
    } catch (e) {
      console.warn("Error setting up onSnapshot for users:", e);
      return () => {};
    }
  },

  subscribeToDirectorates(callback: (dirs: Directorate[]) => void): () => void {
    try {
      return onSnapshot(collection(db, 'directorates'), (snap) => {
        const dirs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Directorate));
        callback(dirs);
      }, (error) => {
        console.warn("Firestore subscription error for directorates:", error);
      });
    } catch (e) {
      console.warn("Error setting up onSnapshot for directorates:", e);
      return () => {};
    }
  },

  subscribeToRoleSidebarPermissions(callback: (permissions: RoleSidebarPermissions) => void): () => void {
    const docRef = doc(db, 'settings', 'role_sidebar_permissions');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as RoleSidebarPermissions;
        if (data) {
          const res = { ...data };
          (['CENTRAL_ADMIN', 'TECH_COMMITTEE_HEAD', 'SPORT_MANAGER'] as const).forEach(role => {
            if (res[role] && Array.isArray(res[role]) && !res[role].includes('/helper-apps')) {
              const list = [...res[role]];
              const matchIdx = list.indexOf('/matches');
              if (matchIdx !== -1) {
                list.splice(matchIdx + 1, 0, '/helper-apps');
              } else {
                list.push('/helper-apps');
              }
              res[role] = list;
            }
          });
          localStorage.setItem('taourirt_role_sidebar_permissions', JSON.stringify(res));
          callback(res);
          window.dispatchEvent(new CustomEvent('sidebarPermissionsChanged', { detail: res }));
        }
      }
    }, (err) => {
      console.warn("Firestore role_sidebar_permissions subscription error:", err);
    });
  },

  async saveRoleSidebarPermissions(permissions: RoleSidebarPermissions): Promise<void> {
    try {
      localStorage.setItem('taourirt_role_sidebar_permissions', JSON.stringify(permissions));
      await setDoc(doc(db, 'settings', 'role_sidebar_permissions'), permissions, { merge: true });
      window.dispatchEvent(new CustomEvent('sidebarPermissionsChanged', { detail: permissions }));
    } catch (e) {
      console.warn("Saved permissions locally; Firestore sync pending:", e);
      window.dispatchEvent(new CustomEvent('sidebarPermissionsChanged', { detail: permissions }));
    }
  },

  // DIRECTORATES MANAGEMENT (Multi-Tenant Architecture)
  async getDirectorates(): Promise<Directorate[]> {
    try {
      const snap = await getDocs(collection(db, 'directorates'));
      const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES).filter(d => d && !isRecentlyDeleted('directorates', d.id));
      const pendingLocal = localList.filter(d => isPendingWrite('directorates', d.id));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('directorates', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Directorate));
        const merged = deduplicateById([...pendingLocal, ...firestoreList]);
        setLocal(STORAGE_KEYS.DIRECTORATES, merged);
        return merged;
      } else {
        console.log("Seeding initial directorates to new Firestore...");
        for (const dir of INITIAL_DIRECTORATES) {
          await this.addDirectorate(dir);
        }
        return INITIAL_DIRECTORATES;
      }
    } catch (e) {
      console.warn("Firestore directorates fetch error, falling back to cache:", e);
    }
    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES).filter(d => d && !isRecentlyDeleted('directorates', d.id));
    return deduplicateById(localList);
  },

  async addDirectorate(directorate: Omit<Directorate, 'id'> & { id?: string }): Promise<Directorate> {
    const rawId = directorate.id || `dir_${(directorate.shortName || directorate.name || 'dir').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
    const tempId = rawId;
    const newDir: Directorate = {
      ...directorate,
      id: tempId,
      isActive: directorate.isActive !== undefined ? directorate.isActive : true,
      adminEmails: (directorate.adminEmails || []).map(e => e.trim().toLowerCase()).filter(Boolean),
      createdAt: new Date()
    };

    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES);
    const updated = [newDir, ...localList.filter(d => d.id !== tempId)];
    setLocal(STORAGE_KEYS.DIRECTORATES, updated);
    markPendingWrite('directorates', tempId);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...newDir,
        createdAt: Timestamp.now()
      });
      await setDoc(doc(db, 'directorates', tempId), cleanPayload, { merge: true });
      clearPendingWrite('directorates', tempId);
    } catch (e) {
      console.warn("Directorate saved locally; Firestore sync error:", e);
    }

    window.dispatchEvent(new CustomEvent('directoratesListUpdated', { detail: updated }));
    return newDir;
  },

  async updateDirectorate(id: string, updates: Partial<Directorate>): Promise<void> {
    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES);
    const cleanUpdates = stripUndefinedDeep({
      ...updates,
      ...(updates.adminEmails ? { adminEmails: updates.adminEmails.map(e => e.trim().toLowerCase()).filter(Boolean) } : {})
    });
    const updated = localList.map(d => d.id === id ? { ...d, ...cleanUpdates } : d);
    setLocal(STORAGE_KEYS.DIRECTORATES, updated);
    markPendingWrite('directorates', id);

    try {
      await setDoc(doc(db, 'directorates', id), {
        ...cleanUpdates,
        id,
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('directorates', id);
    } catch (e) {
      console.warn("Directorate updated locally:", e);
    }

    window.dispatchEvent(new CustomEvent('directoratesListUpdated', { detail: updated }));
  },

  async deleteDirectorate(id: string): Promise<void> {
    markRecentlyDeleted('directorates', id);
    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES);
    const updated = localList.filter(d => d.id !== id);
    setLocal(STORAGE_KEYS.DIRECTORATES, updated);

    try {
      await deleteDoc(doc(db, 'directorates', id));
    } catch (e) {
      console.warn("Directorate deleted locally:", e);
    }

    window.dispatchEvent(new CustomEvent('directoratesListUpdated', { detail: updated }));
  },

  getActiveDirectorateId(): string {
    return localStorage.getItem('active_directorate_id') || 'taourirt';
  },

  setActiveDirectorateId(id: string): void {
    localStorage.setItem('active_directorate_id', id);
    window.dispatchEvent(new CustomEvent('directorateChanged', { detail: id }));
  },

  async getActiveDirectorate(): Promise<Directorate> {
    const activeId = this.getActiveDirectorateId();
    const all = await this.getDirectorates();
    const found = all.find(d => d.id === activeId);
    return found || all[0] || INITIAL_DIRECTORATES[0];
  },

  async verifyDirectorateCode(directorateId: string, inputCode: string): Promise<boolean> {
    const all = await this.getDirectorates();
    const dir = all.find(d => d.id === directorateId);
    if (!dir) return false;
    const cleanDirCode = (dir.code || '').trim().toUpperCase();
    const cleanInput = (inputCode || '').trim().toUpperCase();
    return cleanDirCode === cleanInput;
  },

  _normalizeCrossCountryDoc(docId: string, data: any, activeDirId: string): CrossCountryCategoryResult {
    const rawCatId = (data.categoryId || data.category_id || data.id || docId || '').toLowerCase().trim();
    let normalizedId = rawCatId;
    
    // Check if this document represents a club-affiliated category
    const isClub = data.affiliationType === 'club_affiliated' || normalizedId.includes('_club') || normalizedId.includes('club');

    // Strip directorate prefix if present, e.g. taourirt_u13_male -> u13_male
    if (activeDirId && normalizedId.startsWith(`${activeDirId.toLowerCase()}_`)) {
      normalizedId = normalizedId.replace(`${activeDirId.toLowerCase()}_`, '');
    } else if (normalizedId.includes('_')) {
      const parts = normalizedId.split('_');
      if (parts.length >= 2) {
        // If it ends with 'club', look at the parts before it
        let lastPart = parts[parts.length - 1];
        let secondLast = parts[parts.length - 2];
        if (lastPart === 'club' && parts.length >= 3) {
          lastPart = parts[parts.length - 2];
          secondLast = parts[parts.length - 3];
        }

        if (['male', 'female', 'ذكور', 'إناث', 'اناث', 'm', 'f'].includes(lastPart)) {
          const gNorm = (lastPart === 'ذكور' || lastPart === 'm') ? 'male' : (lastPart === 'إناث' || lastPart === 'اناث' || lastPart === 'f') ? 'female' : lastPart;
          normalizedId = isClub ? `${secondLast}_${gNorm}_club` : `${secondLast}_${gNorm}`;
        }
      }
    }

    // Gender normalization
    let gender: 'Male' | 'Female' = 'Male';
    const rawGender = String(data.gender || data.sexe || data.genre || '').trim().toLowerCase();
    if (
      rawGender === 'female' ||
      rawGender === 'f' ||
      rawGender === 'أنثى' ||
      rawGender === 'انثى' ||
      rawGender === 'إناث' ||
      rawGender === 'فتيات' ||
      rawGender === 'صغيرات' ||
      rawGender === 'برعمات' ||
      rawGender === 'شابات' ||
      normalizedId.includes('female')
    ) {
      gender = 'Female';
    }

    // Category normalization
    let category = data.category || data.categorie || 'U15';
    const catStr = String(category).toLowerCase();
    const catNameStr = String(data.categoryName || data.nom_categorie || '').toLowerCase();
    if (
      normalizedId.includes('u12') ||
      normalizedId.includes('u13') ||
      catStr.includes('u12') ||
      catStr.includes('u13') ||
      catStr.includes('براعم') ||
      catNameStr.includes('براعم')
    ) {
      category = 'U12';
    } else if (
      normalizedId.includes('u15') ||
      catStr.includes('u15') ||
      catStr.includes('صغار') ||
      catStr.includes('صغيرات') ||
      catNameStr.includes('صغار') ||
      catNameStr.includes('صغيرات')
    ) {
      category = 'U15';
    } else if (
      normalizedId.includes('u18') ||
      catStr.includes('u18') ||
      catStr.includes('فتيان') ||
      catStr.includes('فتيات') ||
      catNameStr.includes('فتيان') ||
      catNameStr.includes('فتيات')
    ) {
      category = 'U18';
    } else if (
      normalizedId.includes('u20') ||
      catStr.includes('u20') ||
      catStr.includes('شبان') ||
      catStr.includes('شابات') ||
      catNameStr.includes('شبان') ||
      catNameStr.includes('شابات')
    ) {
      category = 'U20';
    }

    // Standard title
    let titleAr = data.titleAr || data.title || data.nom_course || (data as any).categoryName || '';
    if (!titleAr) {
      const suffix = isClub ? ' - المنتمين للأندية' : ' - مدرسي';
      if (category === 'U12' && gender === 'Male') titleAr = `سباق البراعم ذكور (U12)${suffix}`;
      else if (category === 'U12' && gender === 'Female') titleAr = `سباق البرعمات إناث (U12)${suffix}`;
      else if (category === 'U15' && gender === 'Male') titleAr = `سباق الصغار ذكور (U15)${suffix}`;
      else if (category === 'U15' && gender === 'Female') titleAr = `سباق الصغيرات إناث (U15)${suffix}`;
      else if (category === 'U18' && gender === 'Male') titleAr = `سباق الفتيان ذكور (U18)${suffix}`;
      else if (category === 'U18' && gender === 'Female') titleAr = `سباق الفتيات إناث (U18)${suffix}`;
      else if (category === 'U20' && gender === 'Male') titleAr = `سباق الشبان ذكور (U20)${suffix}`;
      else if (category === 'U20' && gender === 'Female') titleAr = `سباق الشابات إناث (U20)${suffix}`;
    }

    // Flexible extraction of podium/results/rankings array from external application
    let rawList: any[] = [];
    if (Array.isArray(data.podium)) rawList = data.podium;
    else if (Array.isArray(data.results)) rawList = data.results;
    else if (Array.isArray(data.rankings)) rawList = data.rankings;
    else if (Array.isArray(data.ranking)) rawList = data.ranking;
    else if (Array.isArray(data.winners)) rawList = data.winners;
    else if (Array.isArray(data.runners)) rawList = data.runners;
    else if (Array.isArray(data.participants)) rawList = data.participants;
    else if (Array.isArray(data.athletes)) rawList = data.athletes;
    else if (Array.isArray(data.classement)) rawList = data.classement;
    else if (data.podium && typeof data.podium === 'object') rawList = Object.values(data.podium);
    else if (data.results && typeof data.results === 'object') rawList = Object.values(data.results);

    const podium: PodiumWinner[] = rawList
      .filter(item => item && (item.fullName || item.name || item.nom || item.athleteName || item.studentName || item.runnerName || item.athlete_name))
      .map((item, idx) => {
        const rankVal = Number(item.rank ?? item.position ?? item.place ?? item.ordre ?? (idx + 1));
        return {
          rank: isNaN(rankVal) ? idx + 1 : rankVal,
          fullName: String(item.fullName || item.name || item.nom || item.athleteName || item.studentName || item.runnerName || item.athlete_name || '').trim(),
          schoolName: String(item.schoolName || item.school || item.etablissement || item.etab || item.school_name || item.institution || '').trim(),
          time: item.time || item.timing || item.temps || item.chrono || item.duration || undefined,
          bibNumber: item.bibNumber ? String(item.bibNumber) : (item.bib ? String(item.bib) : (item.dossard ? String(item.dossard) : (item.number ? String(item.number) : undefined))),
          notes: item.notes || item.observation || item.remarks || item.remarques || item.qualif || item.status || undefined,
          massarNumber: item.massarNumber || item.massar || item.cne || item.codeMassar || undefined,
          affiliationType: item.affiliationType || (isClub ? 'club_affiliated' : 'non_club')
        };
      })
      .sort((a, b) => a.rank - b.rank);

    return {
      categoryId: normalizedId,
      category,
      gender,
      titleAr,
      distance: data.distance || (category === 'U12' ? (gender === 'Male' ? '1500 م' : '1000 م') : category === 'U15' ? (gender === 'Male' ? '3000 م' : '2000 م') : category === 'U18' ? (gender === 'Male' ? '4000 م' : '3000 م') : (gender === 'Male' ? '5000 م' : '3000 م')),
      venueName: data.venueName || data.venue || data.lieu || 'مضمار حلبة ألعاب القوى بتاوريرت',
      directorateId: data.directorateId || activeDirId,
      affiliationType: isClub ? 'club_affiliated' : 'non_club',
      status: data.status,
      updatedAt: data.updatedAt ? (typeof data.updatedAt === 'string' ? data.updatedAt : (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString())) : new Date().toISOString(),
      podium
    };
  },

  /**
   * Subscribe to real-time Cross Country results from Firestore (onSnapshot)
   */
  subscribeCrossCountryResults(callback: (results: Record<string, CrossCountryCategoryResult>) => void): () => void {
    const q = collection(db, 'cross_country_results');
    const unsubscribe = onSnapshot(q, async (snap) => {
      const activeDirId = this.getActiveDirectorateId();
      const activeSeason = await this.getActiveSeason();
      const cacheKey = `taourirt_cc_results_${activeDirId}`;
      const resultsMap: Record<string, CrossCountryCategoryResult> = JSON.parse(JSON.stringify(INITIAL_CROSS_COUNTRY_RESULTS));
      
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const docDirId = data.directorateId || (docSnap.id.includes('_') ? docSnap.id.substring(0, docSnap.id.lastIndexOf('_')) : docSnap.id);
        const docSeasonId = data.seasonId || '2026/2027';
        
        // Only process results for the current active season
        if (docSeasonId !== activeSeason) return;

        // Accept document for current directorate or global view
        if (!activeDirId || activeDirId === 'all' || activeDirId === 'taourirt' || docDirId === activeDirId) {
          const item = this._normalizeCrossCountryDoc(docSnap.id, data, activeDirId);
          resultsMap[docSnap.id] = item;
          
          // Priority for base keys (like 'u15_male') should be results from current directorate
          if (docDirId === activeDirId || (!activeDirId && docDirId === 'taourirt') || (activeDirId === 'all' && docDirId === 'taourirt')) {
            resultsMap[item.categoryId] = item;
            
            if (item.categoryId === 'u13_male' || item.categoryId === 'u12_male') {
              resultsMap['u12_male'] = item;
              resultsMap['u13_male'] = item;
            }
            if (item.categoryId === 'u13_female' || item.categoryId === 'u12_female') {
              resultsMap['u12_female'] = item;
              resultsMap['u13_female'] = item;
            }
          } else if (activeDirId === 'all') {
            // In 'all' view, use directorate-prefixed key or base key if none exists
            if (!resultsMap[item.categoryId]) {
               resultsMap[item.categoryId] = item;
            }
          }
        }
      });

      this._sanitizeCrossCountryResultsMap(resultsMap);
      localStorage.setItem(cacheKey, JSON.stringify(resultsMap));
      callback(resultsMap);
    }, (error) => {
      console.warn("Firestore real-time subscription error for cross_country_results:", error);
    });

    return unsubscribe;
  },

  _sanitizeCrossCountryResultsMap(resultsMap: Record<string, CrossCountryCategoryResult>): Record<string, CrossCountryCategoryResult> {
    if (!resultsMap) return resultsMap;
    const pairs = [
      { male: 'u12_male', female: 'u12_female' },
      { male: 'u12_male_club', female: 'u12_female_club' },
      { male: 'u13_male', female: 'u13_female' },
      { male: 'u15_male', female: 'u15_female' },
      { male: 'u15_male_club', female: 'u15_female_club' },
      { male: 'u18_male', female: 'u18_female' },
      { male: 'u18_male_club', female: 'u18_female_club' },
      { male: 'u20_male', female: 'u20_female' },
      { male: 'u20_male_club', female: 'u20_female_club' }
    ];

    pairs.forEach(({ male, female }) => {
      const m = resultsMap[male];
      const f = resultsMap[female];
      if (m && f && m.podium && f.podium && m.podium.length > 0 && f.podium.length > 0) {
        const mSig = m.podium.map(p => (p.studentId || p.fullName || '').trim().toLowerCase()).sort().join('|');
        const fSig = f.podium.map(p => (p.studentId || p.fullName || '').trim().toLowerCase()).sort().join('|');
        if (mSig && mSig === fSig) {
          f.podium = [];
        }
      }
    });

    return resultsMap;
  },

  /**
   * Reset or delete all results of a specific sport for the active directorate and season
   */
  async deleteSportResults(sportId: string, deleteMatchesCompletely: boolean = false): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;

    if (sportId === 'cross_country') {
      const ccResults = await this.getCrossCountryResults();
      const resetMap: Record<string, CrossCountryCategoryResult> = {};
      
      for (const [key, val] of Object.entries(ccResults)) {
        const catVal = (val || {}) as CrossCountryCategoryResult;
        resetMap[key] = {
          ...catVal,
          podium: [],
          status: 'setup',
          updatedAt: new Date().toISOString()
        };
        // Also update Firestore
        try {
          const docId = `${effectiveDirId}_${key}`;
          await setDoc(doc(db, 'cross_country_results', docId), {
            ...resetMap[key],
            podium: [],
            status: 'setup',
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (e) {
          console.warn(`Error resetting cross country doc for ${key}:`, e);
        }
      }

      const cacheKey = `taourirt_cc_results_${effectiveDirId}`;
      localStorage.setItem(cacheKey, JSON.stringify(resetMap));
      this._notifyCCUpdate({ categoryId: 'all', podium: [] } as any);
    } else {
      const allMatches = await this.getMatches();
      const sportMatches = allMatches.filter(m => m.sportId === sportId);

      for (const m of sportMatches) {
        if (deleteMatchesCompletely) {
          await this.deleteMatch(m.id);
        } else {
          // Reset match scores and completed status to SCHEDULED
          await this.updateMatchScore(m.id, null as any, null as any, 'SCHEDULED', {
            matchSheet: null,
            team1Score: null,
            team2Score: null,
            team1Penalties: null,
            team2Penalties: null
          });
        }
      }
    }
  },

  async getCrossCountryResults(targetDirectorateId?: string): Promise<Record<string, CrossCountryCategoryResult>> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const activeSeason = await this.getActiveSeason();
    const cacheKey = `taourirt_cc_results_${effectiveDirId}`;
    try {
      const snap = await getDocs(collection(db, 'cross_country_results'));
      if (!snap.empty) {
        // Only seed with initial demo results if the directorate is taourirt!
        const initialSeed = (effectiveDirId === 'taourirt') ? JSON.parse(JSON.stringify(INITIAL_CROSS_COUNTRY_RESULTS)) : {};
        const resultsMap: Record<string, CrossCountryCategoryResult> = initialSeed;
        let foundAnyForDir = false;

        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const docDirId = data.directorateId || (docSnap.id.includes('_') ? docSnap.id.substring(0, docSnap.id.lastIndexOf('_')) : (effectiveDirId === 'taourirt' ? 'taourirt' : ''));
          const docSeasonId = data.seasonId || '2026/2027';

          // Only process results for the current active season
          if (docSeasonId !== activeSeason) return;

          if (docDirId === effectiveDirId) {
            foundAnyForDir = true;
            const item = this._normalizeCrossCountryDoc(docSnap.id, data, effectiveDirId);
            const keyToUse = item.categoryId || docSnap.id;
            resultsMap[keyToUse] = item;
          }
        });

        if (foundAnyForDir || effectiveDirId === 'taourirt') {
          this._sanitizeCrossCountryResultsMap(resultsMap);
          localStorage.setItem(cacheKey, JSON.stringify(resultsMap));
          return resultsMap;
        }
      }
    } catch (e) {
      console.warn("Firestore fetch cross_country_results error, using local storage:", e);
    }

    // Check local storage for this specific directorate
    try {
      const local = localStorage.getItem(cacheKey);
      if (local) {
        const parsed = JSON.parse(local);
        const initialSeed = (effectiveDirId === 'taourirt') ? JSON.parse(JSON.stringify(INITIAL_CROSS_COUNTRY_RESULTS)) : {};
        const merged = { ...initialSeed, ...parsed };
        return this._sanitizeCrossCountryResultsMap(merged);
      }
    } catch (e) {
      console.error("Local storage error reading cross country results:", e);
    }

    // For other directorates with no results yet, return a clean empty space
    if (effectiveDirId === 'taourirt') {
      return JSON.parse(JSON.stringify(INITIAL_CROSS_COUNTRY_RESULTS));
    }
    return {};
  },

  // Dispatch local and cross-tab updates
  _notifyCCUpdate(result: CrossCountryCategoryResult) {
    const event = new CustomEvent('crossCountryResultsUpdated', { detail: result });
    window.dispatchEvent(event);
    try {
      const bc = new BroadcastChannel('cc_results_sync');
      bc.postMessage({ type: 'UPDATE', result });
      bc.close();
    } catch (e) {}
  },

  async saveCrossCountryCategoryResult(result: CrossCountryCategoryResult): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const cacheKey = `taourirt_cc_results_${effectiveDirId}`;
    const activeSeason = await this.getActiveSeason();
    
    const resultWithDir: CrossCountryCategoryResult = {
      ...result,
      directorateId: result.directorateId || effectiveDirId,
      seasonId: result.seasonId || activeSeason,
      updatedAt: new Date().toISOString()
    };

    // Update local cache
    try {
      const current = await this.getCrossCountryResults();
      current[result.categoryId] = resultWithDir;
      localStorage.setItem(cacheKey, JSON.stringify(current));
    } catch (e) {
      console.error("Error updating local CC results:", e);
    }

    // Sync to Firestore
    try {
      const docId = `${effectiveDirId}_${result.categoryId}`;
      // Clean undefined values to prevent Firestore rejection
      const sanitized = JSON.parse(JSON.stringify(resultWithDir));
      await setDoc(doc(db, 'cross_country_results', docId), {
        ...sanitized,
        id: docId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore save CC result error:", e);
    }

    this._notifyCCUpdate(resultWithDir);
  },

  /**
   * Clear recorded arrivals / podium for a single Cross Country category
   */
  async clearCrossCountryCategoryResult(categoryId: string): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const cacheKey = `taourirt_cc_results_${activeDirId}`;

    // 1. Update local cache
    try {
      const current = await this.getCrossCountryResults();
      if (current[categoryId]) {
        current[categoryId] = {
          ...current[categoryId],
          podium: [],
          status: 'setup',
          updatedAt: new Date().toISOString()
        };
      }
      if (categoryId === 'u12_male' || categoryId === 'u13_male') {
        if (current['u12_male']) current['u12_male'] = { ...current['u12_male'], podium: [], status: 'setup', updatedAt: new Date().toISOString() };
        if (current['u13_male']) current['u13_male'] = { ...current['u13_male'], podium: [], status: 'setup', updatedAt: new Date().toISOString() };
      }
      if (categoryId === 'u12_female' || categoryId === 'u13_female') {
        if (current['u12_female']) current['u12_female'] = { ...current['u12_female'], podium: [], status: 'setup', updatedAt: new Date().toISOString() };
        if (current['u13_female']) current['u13_female'] = { ...current['u13_female'], podium: [], status: 'setup', updatedAt: new Date().toISOString() };
      }
      localStorage.setItem(cacheKey, JSON.stringify(current));
    } catch (e) {
      console.warn("Local clear CC category error:", e);
    }

    // 2. Sync to Firestore
    try {
      const docId = `${activeDirId}_${categoryId}`;
      await setDoc(doc(db, 'cross_country_results', docId), {
        podium: [],
        status: 'setup',
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Also clean alias doc if applicable
      if (categoryId === 'u12_male') {
        await setDoc(doc(db, 'cross_country_results', `${activeDirId}_u13_male`), { podium: [], status: 'setup', updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      } else if (categoryId === 'u12_female') {
        await setDoc(doc(db, 'cross_country_results', `${activeDirId}_u13_female`), { podium: [], status: 'setup', updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    } catch (e) {
      console.warn("Firestore clear CC category error:", e);
    }

    window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
  },

  /**
   * Clear recorded arrivals / podium across ALL 8 Cross Country categories
   */
  async clearAllCrossCountryResults(): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const cacheKey = `taourirt_cc_results_${activeDirId}`;

    // 1. Reset local cache
    const freshMap: Record<string, CrossCountryCategoryResult> = {};
    Object.entries(INITIAL_CROSS_COUNTRY_RESULTS).forEach(([catId, def]) => {
      freshMap[catId] = {
        ...def,
        podium: [],
        status: 'setup',
        directorateId: activeDirId,
        updatedAt: new Date().toISOString()
      };
    });
    localStorage.setItem(cacheKey, JSON.stringify(freshMap));

    // 2. Clear all docs in Firestore
    try {
      const q = collection(db, 'cross_country_results');
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          const data = d.data();
          if (!data.directorateId || data.directorateId === activeDirId || activeDirId === 'taourirt' || !activeDirId) {
            batch.update(d.ref, {
              podium: [],
              status: 'setup',
              updatedAt: serverTimestamp()
            });
          }
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn("Firestore clear all CC results error:", e);
    }

    window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
  },

  /**
   * Clear all students/participants registered under sportId === 'cross_country'
   */
  async clearCrossCountryParticipants(): Promise<number> {
    const activeDirId = this.getActiveDirectorateId();

    // 1. Filter local cache
    const localList = getLocal<Student>('taourirt_students_data', []);
    const remaining = localList.filter(s => s.sportId !== 'cross_country');
    const removedCount = localList.length - remaining.length;
    setLocal('taourirt_students_data', remaining);

    // 2. Delete matching docs from Firestore
    try {
      const q = query(
        collection(db, 'students'),
        where('sportId', '==', 'cross_country')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn("Firestore clear CC participants error:", e);
    }

    window.dispatchEvent(new CustomEvent('studentsUpdated'));
    return removedCount;
  },

  /**
   * Get track & field / athletics results
   */
  async getAthleticsResults(targetDirectorateId?: string): Promise<Record<string, AthleticsCategoryResult>> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const cacheKey = `taourirt_athletics_results_${effectiveDirId}`;
    
    // 1. Try local cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed reading cached athletics results:", e);
    }

    // 2. Fetch from Firestore
    try {
      const q = query(
        collection(db, 'athletics_results'),
        where('directorateId', '==', effectiveDirId)
      );
      const snap = await getDocs(q);
      const map: Record<string, AthleticsCategoryResult> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as AthleticsCategoryResult;
        if (data.id) {
          map[data.id] = data;
        }
      });
      
      if (Object.keys(map).length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(map));
        return map;
      }
    } catch (e) {
      console.warn("Firestore athletics results fetch error:", e);
    }

    // 3. Fallback to localStorage without filtering only if taourirt
    try {
      if (effectiveDirId === 'taourirt') {
        const globalCached = localStorage.getItem('taourirt_athletics_results');
        if (globalCached) return JSON.parse(globalCached);
      }
    } catch (e) {}

    return {};
  },

  async saveAthleticsCategoryResult(result: AthleticsCategoryResult): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const cacheKey = `taourirt_athletics_results_${effectiveDirId}`;
    const activeSeason = await this.getActiveSeason();

    const resultWithDir: AthleticsCategoryResult = {
      ...result,
      directorateId: result.directorateId || effectiveDirId,
      seasonId: result.seasonId || activeSeason,
      updatedAt: new Date().toISOString()
    };

    // Update local cache
    try {
      const current = await this.getAthleticsResults();
      current[result.id] = resultWithDir;
      localStorage.setItem(cacheKey, JSON.stringify(current));
      localStorage.setItem('taourirt_athletics_results', JSON.stringify(current));
    } catch (e) {
      console.error("Error updating local Athletics results:", e);
    }

    // Sync to Firestore
    try {
      const docId = `${effectiveDirId}_${result.id}`;
      const sanitized = JSON.parse(JSON.stringify(resultWithDir));
      await setDoc(doc(db, 'athletics_results', docId), {
        ...sanitized,
        id: docId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore save Athletics result error:", e);
    }

    window.dispatchEvent(new CustomEvent('athleticsResultsUpdated', { detail: resultWithDir }));
  },

  subscribeAthleticsResults(callback: (results: Record<string, AthleticsCategoryResult>) => void): () => void {
    const activeDirId = this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;

    // Load initial
    this.getAthleticsResults().then(callback);

    // Event listener
    const handleUpdate = () => {
      this.getAthleticsResults().then(callback);
    };
    window.addEventListener('athleticsResultsUpdated', handleUpdate);

    // Firestore listener
    let unsubscribeFirestore = () => {};
    try {
      const q = query(
        collection(db, 'athletics_results'),
        where('directorateId', '==', effectiveDirId)
      );
      unsubscribeFirestore = onSnapshot(q, (snap) => {
        const map: Record<string, AthleticsCategoryResult> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as AthleticsCategoryResult;
          if (data.id) {
            map[data.id] = data;
          }
        });
        if (Object.keys(map).length > 0) {
          localStorage.setItem(`taourirt_athletics_results_${effectiveDirId}`, JSON.stringify(map));
          callback(map);
        }
      }, (err) => console.warn("Athletics listener error:", err));
    } catch (e) {}

    return () => {
      window.removeEventListener('athleticsResultsUpdated', handleUpdate);
      unsubscribeFirestore();
    };
  },

  async syncAllDataFromCloud(): Promise<{
    success: boolean;
    schoolsCount: number;
    tournamentsCount: number;
    studentsCount: number;
    matchesCount: number;
    venuesCount: number;
    refereesCount: number;
    directoratesCount: number;
    timestamp: number;
  }> {
    try {
      const [
        schoolsSnap,
        tournamentsSnap,
        studentsSnap,
        matchesSnap,
        venuesSnap,
        refereesSnap,
        directoratesSnap,
        sportsSnap,
        ccSnap,
        permsSnap,
        configSnap
      ] = await Promise.all([
        getDocs(collection(db, 'schools')).catch(() => null),
        getDocs(collection(db, 'tournaments')).catch(() => null),
        getDocs(collection(db, 'students')).catch(() => null),
        getDocs(collection(db, 'matches')).catch(() => null),
        getDocs(collection(db, 'venues')).catch(() => null),
        getDocs(collection(db, 'referees')).catch(() => null),
        getDocs(collection(db, 'directorates')).catch(() => null),
        getDocs(collection(db, 'sports')).catch(() => null),
        getDocs(collection(db, 'cross_country_results')).catch(() => null),
        getDoc(doc(db, 'settings', 'role_sidebar_permissions')).catch(() => null),
        getDocs(collection(db, 'config')).catch(() => null)
      ]);

      let schoolsCount = 0;
      const localSchools = getLocal<School>(STORAGE_KEYS.SCHOOLS, []).filter(
        s => s && s.name && !s.name.includes('غير محدد') && !isRecentlyDeleted('schools', s.id)
      );
      const pendingLocalSchools = localSchools.filter(ls => isPendingWrite('schools', ls.id));

      if (schoolsSnap) {
        const firestoreSchools = schoolsSnap.docs
          .filter(d => !isRecentlyDeleted('schools', d.id))
          .map(d => ({ id: d.id, ...d.data() } as School))
          .filter(s => s && s.name && !s.name.includes('غير محدد'));

        // Persist any genuinely pending local writes to Firestore
        if (pendingLocalSchools.length > 0) {
          for (const ls of pendingLocalSchools) {
            const docRef = ls.id ? doc(db, 'schools', ls.id) : doc(collection(db, 'schools'));
            const sanitized = sanitizeFirestorePayload({
              ...ls,
              id: docRef.id,
              updatedAt: serverTimestamp()
            });
            setDoc(docRef, sanitized, { merge: true })
              .then(() => clearPendingWrite('schools', docRef.id))
              .catch(err => console.warn("Failed to persist pending local school during sync:", err));
          }
        }

        const merged = deduplicateById([...pendingLocalSchools, ...firestoreSchools]);
        setLocal(STORAGE_KEYS.SCHOOLS, merged);
        schoolsCount = merged.length;
      } else {
        schoolsCount = localSchools.length;
      }

      let tournamentsCount = 0;
      if (tournamentsSnap) {
        const firestoreTournaments = tournamentsSnap.docs
          .filter(d => !isRecentlyDeleted('tournaments', d.id))
          .map(d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate,
              endDate: data.endDate?.toDate ? data.endDate.toDate() : data.endDate,
              registrationDeadline: data.registrationDeadline?.toDate ? data.registrationDeadline.toDate() : data.registrationDeadline,
            } as Tournament;
          });
        const pendingLocal = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []).filter(
          t => t && !isRecentlyDeleted('tournaments', t.id) && isPendingWrite('tournaments', t.id)
        );
        const merged = deduplicateById([...pendingLocal, ...firestoreTournaments]);
        setLocal(STORAGE_KEYS.TOURNAMENTS, merged);
        tournamentsCount = merged.length;
      } else {
        const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
        tournamentsCount = localList.length;
      }

      let studentsCount = 0;
      if (studentsSnap) {
        const firestoreStudents = studentsSnap.docs
          .filter(d => !isRecentlyDeleted('students', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Student));
        const pendingLocal = getLocal<Student>('taourirt_students_data', []).filter(
          s => s && !isRecentlyDeleted('students', s.id) && isPendingWrite('students', s.id)
        );
        const merged = deduplicateById([...pendingLocal, ...firestoreStudents]);
        setLocal('taourirt_students_data', merged);
        studentsCount = merged.length;
      } else {
        const localList = getLocal<Student>('taourirt_students_data', []);
        studentsCount = localList.length;
      }

      let matchesCount = 0;
      if (matchesSnap) {
        const firestoreMatches = matchesSnap.docs
          .filter(d => !isRecentlyDeleted('matches', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Match));
        const pendingLocal = getLocal<Match>(STORAGE_KEYS.MATCHES, []).filter(
          m => m && !isRecentlyDeleted('matches', m.id) && isPendingWrite('matches', m.id)
        );
        const merged = deduplicateById([...pendingLocal, ...firestoreMatches]);
        setLocal(STORAGE_KEYS.MATCHES, merged);
        matchesCount = merged.length;
      } else {
        const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
        matchesCount = localList.length;
      }

      let venuesCount = 0;
      if (venuesSnap) {
        const firestoreVenues = venuesSnap.docs
          .filter(d => !isRecentlyDeleted('venues', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Venue));
        const pendingLocal = getLocal<Venue>(STORAGE_KEYS.VENUES, []).filter(
          v => v && !isRecentlyDeleted('venues', v.id) && isPendingWrite('venues', v.id)
        );
        const baseVenues = venuesSnap.empty && pendingLocal.length === 0 ? INITIAL_VENUES.filter(v => !isRecentlyDeleted('venues', v.id)) : firestoreVenues;
        const merged = deduplicateById([...pendingLocal, ...baseVenues]);
        setLocal(STORAGE_KEYS.VENUES, merged);
        venuesCount = merged.length;
      }

      let refereesCount = 0;
      if (refereesSnap) {
        const firestoreReferees = refereesSnap.docs
          .filter(d => !isRecentlyDeleted('referees', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Referee));
        const pendingLocal = deduplicateById([
          ...getLocal<Referee>('taourirt_referees_data', []),
          ...getLocal<Referee>('referees', [])
        ]).filter(r => r && !isRecentlyDeleted('referees', r.id) && isPendingWrite('referees', r.id));
        const merged = deduplicateById([...pendingLocal, ...firestoreReferees]);
        setLocal('taourirt_referees_data', merged);
        setLocal('referees', merged);
        refereesCount = merged.length;
      }

      let directoratesCount = 0;
      if (directoratesSnap && !directoratesSnap.empty) {
        const firestoreDirs = directoratesSnap.docs
          .filter(d => !isRecentlyDeleted('directorates', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Directorate));
        const pendingLocal = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, []).filter(
          d => d && !isRecentlyDeleted('directorates', d.id) && isPendingWrite('directorates', d.id)
        );
        const merged = deduplicateById([...pendingLocal, ...firestoreDirs]);
        setLocal(STORAGE_KEYS.DIRECTORATES, merged);
        directoratesCount = merged.length;
      }

      if (sportsSnap && !sportsSnap.empty) {
        const firestoreSports = sportsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Sport));
        const localList = getLocal<Sport>('taourirt_sports_config', []);
        const merged = deduplicateById([...firestoreSports, ...localList]);
        setLocal('taourirt_sports_config', merged);
      }

      if (ccSnap && !ccSnap.empty) {
        const activeDirId = this.getActiveDirectorateId();
        const resultsMap: Record<string, CrossCountryCategoryResult> = {};
        ccSnap.docs.forEach(docSnap => {
          const data = docSnap.data() as CrossCountryCategoryResult;
          if (!data.directorateId || data.directorateId === activeDirId) {
            resultsMap[data.categoryId || docSnap.id] = { ...data, categoryId: data.categoryId || docSnap.id };
          }
        });
        if (Object.keys(resultsMap).length > 0) {
          const cacheKey = `taourirt_cc_results_${activeDirId}`;
          const merged = { ...INITIAL_CROSS_COUNTRY_RESULTS, ...resultsMap };
          localStorage.setItem(cacheKey, JSON.stringify(merged));
        }
      }

      if (permsSnap && permsSnap.exists()) {
        const firestorePerms = permsSnap.data() as RoleSidebarPermissions;
        if (firestorePerms) {
          localStorage.setItem('taourirt_role_sidebar_permissions', JSON.stringify(firestorePerms));
          window.dispatchEvent(new CustomEvent('sidebarPermissionsChanged', { detail: firestorePerms }));
        }
      }

      if (configSnap && !configSnap.empty) {
        const seasonsDoc = configSnap.docs.find(d => d.id === 'seasons');
        if (seasonsDoc && seasonsDoc.data().list) {
          localStorage.setItem('taourirt_sports_seasons_list', JSON.stringify(seasonsDoc.data().list));
        }
        const seasonDoc = configSnap.docs.find(d => d.id === 'season');
        if (seasonDoc && seasonDoc.data().current) {
          localStorage.setItem('taourirt_sports_season', seasonDoc.data().current);
          window.dispatchEvent(new CustomEvent('seasonChanged', { detail: seasonDoc.data().current }));
        }
      }

      // Dispatch real-time global refresh events across all app components and open tabs
      window.dispatchEvent(new CustomEvent('dataSynchronized', {
        detail: {
          timestamp: Date.now(),
          schoolsCount,
          tournamentsCount,
          studentsCount,
          matchesCount
        }
      }));
      window.dispatchEvent(new CustomEvent('schoolsUpdated'));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
      window.dispatchEvent(new CustomEvent('studentsUpdated'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
      window.dispatchEvent(new CustomEvent('directoratesListUpdated'));

      return {
        success: true,
        schoolsCount,
        tournamentsCount,
        studentsCount,
        matchesCount,
        venuesCount,
        refereesCount,
        directoratesCount,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error("syncAllDataFromCloud error:", error);
      return {
        success: false,
        schoolsCount: 0,
        tournamentsCount: 0,
        studentsCount: 0,
        matchesCount: 0,
        venuesCount: 0,
        refereesCount: 0,
        directoratesCount: 0,
        timestamp: Date.now()
      };
    }
  },

  // --- SCHOOL TOURNAMENT PARTICIPATION CONFIRMATIONS ---
  async getSchoolConfirmations(targetDirectorateId?: string): Promise<SchoolTournamentConfirmation[]> {
    try {
      const activeDirId = targetDirectorateId || this.getActiveDirectorateId() || 'taourirt';
      const snap = await getDocs(collection(db, 'school_confirmations'));
      let list: SchoolTournamentConfirmation[] = [];
      snap.forEach(docSnap => {
        if (!isRecentlyDeleted('school_confirmations', docSnap.id)) {
          list.push({ id: docSnap.id, ...docSnap.data() } as SchoolTournamentConfirmation);
        }
      });
      const pendingLocal = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
        c => c && !isRecentlyDeleted('school_confirmations', c.id) && isPendingWrite('school_confirmations', c.id)
      );
      list = deduplicateById([...pendingLocal, ...list]);
      setLocal(STORAGE_KEYS.CONFIRMATIONS, list);
      if (activeDirId === 'all') return list;
      return list.filter(c => !activeDirId || !c.directorateId || c.directorateId === activeDirId);
    } catch (e) {
      console.warn('Error fetching school confirmations from Firestore, using local storage:', e);
      const local = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
        c => c && !isRecentlyDeleted('school_confirmations', c.id)
      );
      return local;
    }
  },

  async confirmSchoolParticipation(data: {
    sportId: string;
    sportName?: string;
    tournamentId?: string;
    schoolId: string;
    schoolName: string;
    teacherId: string;
    teacherName: string;
    teacherPhone?: string;
    teacherLeaseNumber?: string;
    registrationDeadline?: string;
    notes?: string;
    directorateId?: string;
    seasonId?: string;
    categories?: string[];
    genders?: ('Male' | 'Female')[];
    affiliationTypes?: string[];
    selectedBranches?: Array<{
      category: string;
      gender: 'Male' | 'Female';
      affiliationType: string;
    }>;
  }): Promise<SchoolTournamentConfirmation> {
    const confirmationId = `${data.sportId}_${data.schoolId}`;

    let normalizedBranches: ConfirmedBranchTuple[] = [];
    if (Array.isArray(data.selectedBranches) && data.selectedBranches.length > 0) {
      const seen = new Set<string>();
      data.selectedBranches.forEach(b => {
        if (!b || !b.category) return;
        const cat = normalizeCategoryKey(b.category);
        const gen: 'Male' | 'Female' = b.gender === 'Female' ? 'Female' : 'Male';
        const aff = (b.affiliationType || 'non_club').trim();
        const key = `${aff}__${cat}__${gen}`;
        if (!seen.has(key)) {
          seen.add(key);
          normalizedBranches.push({ category: cat, gender: gen, affiliationType: aff });
        }
      });
    } else {
      const cats = (data.categories && data.categories.length > 0 ? data.categories : ['U15']).map(normalizeCategoryKey);
      const gens: ('Male' | 'Female')[] = data.genders && data.genders.length > 0 ? data.genders : ['Male', 'Female'];
      const affs = data.affiliationTypes && data.affiliationTypes.length > 0 ? data.affiliationTypes : ['non_club'];
      const seen = new Set<string>();
      affs.forEach(aff => {
        cats.forEach(cat => {
          gens.forEach(gen => {
            const key = `${aff}__${cat}__${gen}`;
            if (!seen.has(key)) {
              seen.add(key);
              normalizedBranches.push({ category: cat, gender: gen, affiliationType: aff });
            }
          });
        });
      });
    }

    const derivedCategories = Array.from(new Set(normalizedBranches.map(b => b.category)));
    const derivedGenders = Array.from(new Set(normalizedBranches.map(b => b.gender)));
    const derivedAffiliations = Array.from(new Set(normalizedBranches.map(b => b.affiliationType)));
    const resolvedDir = data.directorateId || this.getActiveDirectorateId() || 'taourirt';

    const payload: SchoolTournamentConfirmation = {
      ...data,
      categories: derivedCategories,
      genders: derivedGenders,
      affiliationTypes: derivedAffiliations,
      selectedBranches: normalizedBranches,
      id: confirmationId,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      directorateId: resolvedDir === 'all' ? 'taourirt' : resolvedDir,
      seasonId: data.seasonId || '2026/2027'
    };

    const current = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []);
    const updated = deduplicateById([payload, ...current.filter(c => c.id !== confirmationId)]);
    setLocal(STORAGE_KEYS.CONFIRMATIONS, updated);
    markPendingWrite('school_confirmations', confirmationId);

    try {
      const cleanPayload = stripUndefinedDeep(payload);
      await setDoc(doc(db, 'school_confirmations', confirmationId), cleanPayload, { merge: true });
      clearPendingWrite('school_confirmations', confirmationId);
    } catch (err) {
      console.error('Error writing school confirmation to Firestore:', err);
    }

    window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated', { detail: payload }));
    return payload;
  },

  async cancelSchoolConfirmation(sportId: string, schoolId: string, schoolName?: string): Promise<void> {
    const confirmationId = `${sportId}_${schoolId}`;
    const cleanTargetName = (schoolName || schoolId || '').trim().toLowerCase();

    const current = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []);
    const matchedIds = new Set<string>([confirmationId]);
    current.forEach(c => {
      if (c.sportId === sportId) {
        if (
          c.id === confirmationId ||
          c.schoolId === schoolId ||
          (cleanTargetName && c.schoolName && c.schoolName.trim().toLowerCase() === cleanTargetName)
        ) {
          matchedIds.add(c.id);
        }
      }
    });

    matchedIds.forEach(id => markRecentlyDeleted('school_confirmations', id));
    const updated = current.filter(c => !matchedIds.has(c.id));
    setLocal(STORAGE_KEYS.CONFIRMATIONS, updated);

    try {
      await Promise.all(
        Array.from(matchedIds).map(id => deleteDoc(doc(db, 'school_confirmations', id)).catch(() => {}))
      );
    } catch (err) {
      console.error('Error deleting school confirmation from Firestore:', err);
    }

    window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated'));
  },

  subscribeToSchoolConfirmations(callback: (confirmations: SchoolTournamentConfirmation[]) => void): () => void {
    const emitCurrent = () => {
      const activeDirId = this.getActiveDirectorateId() || 'taourirt';
      const list = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
        c => c && !isRecentlyDeleted('school_confirmations', c.id)
      );
      if (activeDirId === 'all') {
        callback(list);
      } else {
        callback(list.filter(c => !activeDirId || !c.directorateId || c.directorateId === activeDirId));
      }
    };

    emitCurrent();

    const handleCustomEvent = () => {
      emitCurrent();
    };
    window.addEventListener('schoolConfirmationsUpdated', handleCustomEvent);
    window.addEventListener('directorateChanged', handleCustomEvent);

    try {
      const q = query(collection(db, 'school_confirmations'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const activeDirId = this.getActiveDirectorateId() || 'taourirt';
        const list: SchoolTournamentConfirmation[] = [];
        snapshot.forEach(docSnap => {
          if (!isRecentlyDeleted('school_confirmations', docSnap.id)) {
            list.push({ id: docSnap.id, ...docSnap.data() } as SchoolTournamentConfirmation);
          }
        });
        const pendingLocal = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
          c => c && !isRecentlyDeleted('school_confirmations', c.id) && isPendingWrite('school_confirmations', c.id)
        );
        const clean = deduplicateById([...pendingLocal, ...list]);
        setLocal(STORAGE_KEYS.CONFIRMATIONS, clean);
        if (activeDirId === 'all') {
          callback(clean);
        } else {
          callback(clean.filter(c => !activeDirId || !c.directorateId || c.directorateId === activeDirId));
        }
      }, (err) => {
        console.warn('school_confirmations onSnapshot error, keeping local:', err);
      });

      return () => {
        unsubscribe();
        window.removeEventListener('schoolConfirmationsUpdated', handleCustomEvent);
        window.removeEventListener('directorateChanged', handleCustomEvent);
      };
    } catch (err) {
      return () => {
        window.removeEventListener('schoolConfirmationsUpdated', handleCustomEvent);
        window.removeEventListener('directorateChanged', handleCustomEvent);
      };
    }
  },

  async withdrawSchool(data: {
    sportId: string;
    schoolName: string;
    schoolId?: string;
    tournamentId?: string;
    ageCategory?: string;
    gender?: string;
    affiliationType?: string;
    withdrawnBy?: string;
  }): Promise<void> {
    const normCat = data.ageCategory ? normalizeCategoryKey(data.ageCategory) : undefined;
    const cleanSchool = data.schoolName.trim();
    const id = `${data.sportId}_${data.tournamentId || 'branch'}_${normCat || 'all'}_${data.gender || 'all'}_${data.affiliationType || 'all'}_${cleanSchool}`;
    const resolvedDir = this.getActiveDirectorateId() || 'taourirt';
    
    const record: SchoolWithdrawalRecord = {
      id,
      schoolName: cleanSchool,
      schoolId: data.schoolId,
      sportId: data.sportId,
      tournamentId: data.tournamentId,
      ageCategory: normCat,
      gender: data.gender,
      affiliationType: data.affiliationType,
      withdrawnAt: new Date().toISOString(),
      withdrawnBy: data.withdrawnBy,
      directorateId: resolvedDir === 'all' ? 'taourirt' : resolvedDir
    };

    const current = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);
    const updated = deduplicateById([record, ...current]);
    setLocal(STORAGE_KEYS.WITHDRAWALS, updated);

    try {
      await setDoc(doc(db, 'school_withdrawals', id), stripUndefinedDeep(record), { merge: true });
    } catch (err) {
      console.warn('Error saving withdrawal to Firestore:', err);
    }

    try {
      const confirmations = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []);
      const matchedConf = confirmations.find(c => 
        c.sportId === data.sportId && (
          (data.schoolId && c.schoolId === data.schoolId) ||
          c.schoolName.trim().toLowerCase() === cleanSchool.toLowerCase() ||
          c.schoolName.includes(cleanSchool) ||
          cleanSchool.includes(c.schoolName)
        )
      );
      if (matchedConf) {
        if (matchedConf.tournamentId && data.tournamentId && matchedConf.tournamentId === data.tournamentId && (!matchedConf.selectedBranches || matchedConf.selectedBranches.length <= 1)) {
          await this.cancelSchoolConfirmation(data.sportId, matchedConf.schoolId || matchedConf.schoolName, matchedConf.schoolName);
        } else {
          const currentBranches = getEffectiveConfirmedBranches(matchedConf, false);
          const remainingBranches = currentBranches.filter(b => {
            const catMatches = !normCat || normalizeCategoryKey(b.category) === normCat;
            const genMatches = !data.gender || data.gender === 'Both' || data.gender === 'Mixed' || data.gender === 'ALL' || b.gender.toLowerCase() === data.gender.toLowerCase();
            const affMatches = !data.affiliationType || data.affiliationType === 'ALL' || b.affiliationType === data.affiliationType;
            return !(catMatches && genMatches && affMatches);
          });

          if (remainingBranches.length === 0) {
            await this.cancelSchoolConfirmation(data.sportId, matchedConf.schoolId || matchedConf.schoolName, matchedConf.schoolName);
          } else {
            const updatedConf: SchoolTournamentConfirmation = {
              ...matchedConf,
              selectedBranches: remainingBranches,
              categories: Array.from(new Set(remainingBranches.map(b => b.category))),
              genders: Array.from(new Set(remainingBranches.map(b => b.gender))),
              affiliationTypes: Array.from(new Set(remainingBranches.map(b => b.affiliationType)))
            };
            const updatedConfs = confirmations.map(c => c.id === matchedConf.id ? updatedConf : c);
            setLocal(STORAGE_KEYS.CONFIRMATIONS, updatedConfs);
            try {
              await setDoc(doc(db, 'school_confirmations', matchedConf.id), stripUndefinedDeep(updatedConf), { merge: true });
            } catch (e) {
              console.warn(e);
            }
            window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated', { detail: updatedConf }));
          }
        }
      }
    } catch (err) {
      console.warn('Error updating confirmation on withdrawal:', err);
    }

    window.dispatchEvent(new CustomEvent('schoolWithdrawalsUpdated', { detail: record }));
  },

  isSchoolWithdrawn(params: {
    sportId?: string;
    tournamentId?: string;
    ageCategory?: string;
    gender?: string;
    affiliationType?: string;
  }, schoolId?: string, schoolName?: string): boolean {
    if (!schoolName && !schoolId) return false;
    const cleanName = (schoolName || '').trim().toLowerCase();
    const cleanId = (schoolId || '').trim().toLowerCase();
    const withdrawals = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);

    const normCat = params.ageCategory ? normalizeCategoryKey(params.ageCategory) : undefined;
    const targetGen = params.gender;
    const targetAff = params.affiliationType;
    const targetTournId = params.tournamentId;
    const targetSport = params.sportId;

    return withdrawals.some(w => {
      const wName = (w.schoolName || '').trim().toLowerCase();
      const wId = (w.schoolId || '').trim().toLowerCase();
      const matchSchool = (cleanName && (wName === cleanName || wName.includes(cleanName) || cleanName.includes(wName))) ||
                          (cleanId && (wId === cleanId || wId === cleanName));
      if (!matchSchool) return false;

      if (targetTournId && w.tournamentId && w.tournamentId === targetTournId) return true;
      if (targetSport && w.sportId && w.sportId !== targetSport) return false;
      if (normCat && w.ageCategory && w.ageCategory !== normCat) return false;
      if (targetGen && targetGen !== 'Both' && targetGen !== 'Mixed' && w.gender && w.gender !== 'Both' && w.gender !== 'Mixed' && w.gender.toLowerCase() !== targetGen.toLowerCase()) return false;
      if (targetAff && w.affiliationType && w.affiliationType !== targetAff) return false;

      return true;
    });
  },

  async cancelSchoolWithdrawal(sportId: string, schoolNameOrId: string, tournamentId?: string): Promise<void> {
    const clean = schoolNameOrId.trim().toLowerCase();
    const current = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);
    const removedIds: string[] = [];
    const updated = current.filter(w => {
      const matchSchool = (w.schoolName && w.schoolName.toLowerCase() === clean) || (w.schoolId && w.schoolId.toLowerCase() === clean);
      if (!matchSchool) return true;
      if (w.sportId !== sportId) return true;
      if (tournamentId && w.tournamentId && w.tournamentId !== tournamentId) return true;
      if (w.id) removedIds.push(w.id);
      return false;
    });
    setLocal(STORAGE_KEYS.WITHDRAWALS, updated);
    if (removedIds.length > 0) {
      await Promise.all(removedIds.map(id => deleteDoc(doc(db, 'school_withdrawals', id)).catch(() => {})));
    }
    window.dispatchEvent(new CustomEvent('schoolWithdrawalsUpdated'));
  }
};

export interface ConfirmedBranchTuple {
  category: string;
  gender: 'Male' | 'Female';
  affiliationType: string;
}

/**
 * Returns the exact list of confirmed (category, gender, affiliationType) branch tuples for a school confirmation.
 * Uses `selectedBranches` when present (eliminating Cartesian-product false positives), with fallback to legacy arrays.
 */
export function getEffectiveConfirmedBranches(
  conf?: SchoolTournamentConfirmation | null,
  excludeWithdrawn = true
): ConfirmedBranchTuple[] {
  if (!conf || conf.status !== 'confirmed') return [];

  const raw: ConfirmedBranchTuple[] = [];
  const seen = new Set<string>();

  const pushTuple = (category: string, gender: 'Male' | 'Female', affiliationType: string) => {
    const normCat = normalizeCategoryKey(category);
    if (!normCat) return;
    const normGen: 'Male' | 'Female' = gender === 'Female' ? 'Female' : 'Male';
    const normAff = (affiliationType || 'non_club').trim();
    const key = `${normAff}__${normCat}__${normGen}`;
    if (seen.has(key)) return;
    seen.add(key);
    raw.push({ category: normCat, gender: normGen, affiliationType: normAff });
  };

  if (Array.isArray(conf.selectedBranches) && conf.selectedBranches.length > 0) {
    conf.selectedBranches.forEach(b => {
      if (!b || !b.category) return;
      pushTuple(b.category, b.gender === 'Female' ? 'Female' : 'Male', b.affiliationType || 'non_club');
    });
  } else {
    const cats = conf.categories && conf.categories.length > 0 ? conf.categories : [];
    const gens: ('Male' | 'Female')[] = conf.genders && conf.genders.length > 0 ? conf.genders : ['Male', 'Female'];
    const affs = conf.affiliationTypes && conf.affiliationTypes.length > 0
      ? conf.affiliationTypes
      : ((conf as any).affiliationType ? [(conf as any).affiliationType] : ['non_club']);

    affs.forEach(aff => {
      cats.forEach(cat => {
        gens.forEach(gen => {
          pushTuple(cat, gen, aff);
        });
      });
    });
  }

  if (!excludeWithdrawn) return raw;

  return raw.filter(b => !DataService.isSchoolWithdrawn({
    sportId: conf.sportId,
    ageCategory: b.category,
    gender: b.gender,
    affiliationType: b.affiliationType
  }, conf.schoolId, conf.schoolName));
}

/**
 * Checks whether a school confirmation explicitly includes a target championship branch
 * (affiliationType, category, gender).
 */
export function doesConfirmationMatchBranch(
  conf: SchoolTournamentConfirmation | undefined | null,
  branch: {
    category?: string;
    gender?: string;
    affiliationType?: string;
  }
): boolean {
  const tuples = getEffectiveConfirmedBranches(conf, true);
  if (tuples.length === 0) return false;

  const targetAff = branch.affiliationType && branch.affiliationType !== 'ALL' ? branch.affiliationType : undefined;
  const targetCat = branch.category && branch.category !== 'ALL' ? normalizeCategoryKey(branch.category) : undefined;
  const targetGen = branch.gender && branch.gender !== 'ALL' && branch.gender !== 'Both' && branch.gender !== 'Mixed'
    ? branch.gender.toLowerCase()
    : undefined;

  return tuples.some(b => {
    if (targetAff && b.affiliationType !== targetAff) return false;
    if (targetCat && normalizeCategoryKey(b.category) !== targetCat) return false;
    if (targetGen && b.gender.toLowerCase() !== targetGen) return false;
    return true;
  });
}

/**
 * Returns a strictly gender-separated Arabic category title:
 * U12: البراعم / البرعمات
 * U15: الصغار / الصغيرات
 * U18: الفتيان / الفتيات
 * U20: الشبان / الشابات
 */
export function getGenderSpecificCategoryTitle(
  category: string,
  gender: 'Male' | 'Female',
  sportId?: string
): string {
  const norm = normalizeCategoryKey(category);
  const isFem = gender === 'Female';
  if (norm === 'U12') return isFem ? 'البرعمات (U12 إناث)' : 'البراعم (U12 ذكور)';
  if (norm === 'U15') return isFem ? 'الصغيرات (U15 إناث)' : 'الصغار (U15 ذكور)';
  if (norm === 'U18') return isFem ? 'الفتيات (U18 إناث)' : 'الفتيان (U18 ذكور)';
  if (norm === 'U20') return isFem ? 'الشابات (U20 إناث)' : 'الشبان (U20 ذكور)';

  const rawCustom = getCustomCategoryName(norm, sportId) || norm;
  const separated = rawCustom
    .replace(/البراعم والبرعمات/g, isFem ? 'البرعمات' : 'البراعم')
    .replace(/الصغار والصغيرات/g, isFem ? 'الصغيرات' : 'الصغار')
    .replace(/الفتيان والفتيات/g, isFem ? 'الفتيات' : 'الفتيان')
    .replace(/الشبان والشابات/g, isFem ? 'الشابات' : 'الشبان');

  const genWord = isFem ? 'إناث' : 'ذكور';
  if (separated.includes(genWord)) return separated;
  return `${separated} (${genWord})`;
}

/**
 * Formats an exact branch tuple in clear gender-separated Arabic,
 * e.g. "لا منتمين — الصغار (U15 ذكور)" or "لا منتمين — الفتيات (U18 إناث)"
 */
export function formatBranchLabelAr(branch: ConfirmedBranchTuple, sportId?: string): string {
  const affLabel = branch.affiliationType === 'club_affiliated'
    ? 'منتمين للأندية'
    : branch.affiliationType === 'open'
    ? 'مفتوحة'
    : 'لا منتمين';
  const catGenderTitle = getGenderSpecificCategoryTitle(branch.category, branch.gender, sportId);
  return `${affLabel} — ${catGenderTitle}`;
}



