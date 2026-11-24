import { Tournament, Match, School, Sport, Venue, Referee, User } from '../types';
import { SPORTS_MAP, normalizeDateToYmd, isClubTournament, normalizeCategoryKey } from './dataService';
import { normalizeArabicName } from './utils';
import { hasValidMatchTeams, formatTeamDisplayName } from './drawTournamentUtils';
import toast from 'react-hot-toast';

export type ProgramAffiliationFilter = 'ALL' | 'non_club' | 'club_affiliated' | 'open';

export const AFFILIATION_LABELS: Record<'non_club' | 'club_affiliated' | 'open', string> = {
  non_club: 'البطولة المدرسية (غير المنتمين للأندية)',
  club_affiliated: 'البطولة المدرسية (المنتمون للأندية)',
  open: 'البطولة المفتوحة'
};

export interface CalendarExportEvent {
  id: string;
  title: string;
  sportId: string;
  sportName: string;
  sportIcon?: string;
  scope: 'provincial' | 'regional' | 'national';
  affiliationType?: 'non_club' | 'club_affiliated' | 'open';
  date: string;
  time?: string;
  venue: string;
  category?: string;
  gender?: string;
  matchNumber?: number;
  organizer?: string;
  coordinator?: string;
  referees?: string[];
  tableReferees?: string[];
  fieldReferees?: string[];
  refereesText?: string;
  refereesHtml?: string;
  notes?: string;
  programApprovalStatus?: 'pending' | 'approved';
}

export function resolveMatchAffiliation(
  m: Match,
  tournaments: Tournament[]
): 'non_club' | 'club_affiliated' | 'open' {
  if (m.affiliationType === 'non_club' || m.affiliationType === 'club_affiliated' || m.affiliationType === 'open') {
    return m.affiliationType;
  }
  const parentT = m.tournamentId ? tournaments.find(t => t.id === m.tournamentId) : undefined;
  if (parentT) {
    if (parentT.affiliationType === 'open') return 'open';
    if (parentT.name && (parentT.name.includes('مفتوحة') || parentT.name.includes('المفتوحة'))) return 'open';
    if (parentT.affiliationType === 'club_affiliated' || isClubTournament(parentT)) return 'club_affiliated';
    return 'non_club';
  }
  return 'non_club';
}

// Proposed official annual program for Moroccan School Sports in Taourirt & Oriental region
export const OFFICIAL_PROPOSED_PROGRAM: Omit<CalendarExportEvent, 'sportName' | 'sportIcon'>[] = [
  // November 2026
  {
    id: 'prop-cc-prov',
    title: 'البطولة الإقليمية المدرسية للعدو الريفي',
    sportId: 'cross_country',
    scope: 'provincial',
    date: '2026-11-12',
    time: '09:00 صباحاً',
    venue: 'مطاف وحلبة العدو الريفي بتاوريرت',
    category: 'جميع الفئات (U12, U15, U18, U20)',
    gender: 'Mixed',
    organizer: 'الفرع الإقليمي للجامعة الملكية المغربية للرياضة المدرسية بتاوريرت',
    coordinator: 'ذ. عبد الرحيم بلقاسم',
    notes: 'مشاركة جميع المؤسسات التعليمية الابتدائية، الإعدادية والتأهيلية بالإقليم'
  },
  {
    id: 'prop-fb-prov-qual',
    title: 'تصفيات البطولة الإقليمية لكرة القدم المصغرة',
    sportId: 'football',
    scope: 'provincial',
    date: '2026-11-25',
    time: '14:30 بعد الزوال',
    venue: 'ملاعب القرب والقاعة المغطاة تاوريرت',
    category: 'فئة البراعم والصغار (U12 - U15)',
    gender: 'Male',
    organizer: 'اللجنة التقنية الإقليمية لكرة القدم المدرسية',
    coordinator: 'ذ. إبراهيم بنعلي',
    notes: 'إقصائيات تمهيدية بين أحواض تاوريرت، العيون سيدي ملوك ودبدو'
  },
  // December 2026
  {
    id: 'prop-cc-reg',
    title: 'البطولة الجهوية المدرسية للعدو الريفي (جهة الشرق)',
    sportId: 'cross_country',
    scope: 'regional',
    date: '2026-12-06',
    time: '09:30 صباحاً',
    venue: 'مطاف السعيدية / حلبة وجدة سيدي يحيى',
    category: 'المتأهلون من البطولات الإقليمية (U15, U18, U20)',
    gender: 'Mixed',
    organizer: 'الأكاديمية الجهوية للتربية والتكوين لجهة الشرق والفرع الجهوي للجامعة',
    coordinator: 'اللجنة التقنية الجهوية للعدو الريفي',
    notes: 'تأهيل أحسن العدائين والفرق لتمثيل جهة الشرق في البطولة الوطنية'
  },
  {
    id: 'prop-bb-prov',
    title: 'نهائيات البطولة الإقليمية لكرة السلة 3x3',
    sportId: 'basketball',
    scope: 'provincial',
    date: '2026-12-16',
    time: '10:00 صباحاً',
    venue: 'القاعة المغطاة تاوريرت',
    category: 'فئة الفتيان والشبان (U18 - U20)',
    gender: 'Mixed',
    organizer: 'فرع تاوريرت للجامعة الملكية للرياضة المدرسية',
    coordinator: 'ذ. محمد القادري',
    notes: 'مباريات حماسية بمشاركة 16 مؤسسة تعليمية إعدادية وتأهيلية'
  },
  {
    id: 'prop-hb-prov',
    title: 'تصفيات البطولة الإقليمية لكرة اليد المدرسية',
    sportId: 'handball',
    scope: 'provincial',
    date: '2026-12-23',
    time: '14:00 زوالاً',
    venue: 'ملاعب ثانوية الفتح التأهيلية وثانوية 9 أبريل',
    category: 'فئة الصغار والفتيان (U15 - U18)',
    gender: 'Male',
    organizer: 'اللجنة التقنية الإقليمية لكرة اليد',
    coordinator: 'ذ. رشيد المنصوري',
    notes: 'مباريات بنظام خروج المغلوب'
  },
  // January 2027
  {
    id: 'prop-cc-nat',
    title: 'البطولة الوطنية المدرسية للعدو الريفي (المستوى الوطني)',
    sportId: 'cross_country',
    scope: 'national',
    date: '2027-01-10',
    time: '09:00 صباحاً',
    venue: 'حلبة باب جديد بمراكش / الرباط',
    category: 'نخبة أبطال جهات المملكة المتأهلون (U15, U18, U20)',
    gender: 'Mixed',
    organizer: 'وزارة التربية الوطنية والجامعة الملكية المغربية للرياضة المدرسية',
    coordinator: 'اللجنة المركزية للرياضة المدرسية',
    notes: 'تظاهرة وطنية كبرى تجمع أبطال كافة الأكاديميات الجهوية بالمملكة'
  },
  {
    id: 'prop-vb-prov',
    title: 'البطولة الإقليمية للكرة الطائرة المدرسية',
    sportId: 'volleyball',
    scope: 'provincial',
    date: '2027-01-20',
    time: '10:00 صباحاً',
    venue: 'القاعة المغطاة بمدينة تاوريرت',
    category: 'فئة الفتيات والفتيان (U15 - U18)',
    gender: 'Mixed',
    organizer: 'فرع تاوريرت للجامعة الملكية للرياضة المدرسية',
    coordinator: 'ذ. كمال اليعقوبي',
    notes: 'دوريات تمهيدية ونهائيات تتويج أبطال الإقليم'
  },
  // February 2027
  {
    id: 'prop-tt-prov',
    title: 'البطولة الإقليمية المدرسية لكرة الطاولة والشطرنج',
    sportId: 'table_tennis',
    scope: 'provincial',
    date: '2027-02-11',
    time: '09:30 صباحاً',
    venue: 'دار الشباب تاوريرت / النادي الرياضي المعتمد',
    category: 'فردي ذكور وإناث (جميع الأسلاك)',
    gender: 'Mixed',
    organizer: 'مكتب التربية البدنية والرياضة المدرسية بالمديرية',
    coordinator: 'ذ. سمير بنجلون',
    notes: 'منافسات الذكاء وسرعة البديهة والتركيز العالي'
  },
  {
    id: 'prop-chess-prov',
    title: 'البطولة الإقليمية للشطرنج المدرسي',
    sportId: 'chess',
    scope: 'provincial',
    date: '2027-02-18',
    time: '10:00 صباحاً',
    venue: 'المركز الإقليمي للتكوينات والملتقيات تاوريرت',
    category: 'جميع الفئات المدرسية (ابتدائي، إعدادي، تأهيلي)',
    gender: 'Mixed',
    organizer: 'اللجنة التقنية للشطرنج المدرسي',
    coordinator: 'ذ. طارق المحمدي',
    notes: 'نظام الجولات السويسرية وفق القواعد الفيدرالية'
  },
  // March 2027
  {
    id: 'prop-badm-prov',
    title: 'البطولة الإقليمية للبادمنتون (كرة الريشة المدرسية)',
    sportId: 'badminton',
    scope: 'provincial',
    date: '2027-03-04',
    time: '10:00 صباحاً',
    venue: 'القاعة المغطاة المتعددة الرياضات تاوريرت',
    category: 'فئة البراعم والصغار (U12 - U15)',
    gender: 'Mixed',
    organizer: 'فرع الجامعة الملكية للرياضة المدرسية',
    coordinator: 'ذ. فاطمة الزهراء العلوي',
    notes: 'مسابقات الفردي والزوجي'
  },
  {
    id: 'prop-gym-prov',
    title: 'البطولة الإقليمية للجمباز المدرسي والرياضات الحضرية',
    sportId: 'gymnastics',
    scope: 'provincial',
    date: '2027-03-18',
    time: '10:00 صباحاً',
    venue: 'القاعة الرياضية المجهزة تاوريرت',
    category: 'التعليم الابتدائي والإعدادي',
    gender: 'Mixed',
    organizer: 'اللجنة التقنية للجمباز والحركات الإيقاعية',
    coordinator: 'ذة. خديجة بوزيان',
    notes: 'عروض الحركات الإجبارية والحرة الفردية والجماعية'
  },
  // April 2027
  {
    id: 'prop-ath-prov',
    title: 'البطولة الإقليمية المدرسية لألعاب القوى',
    sportId: 'athletics',
    scope: 'provincial',
    date: '2027-04-14',
    time: '08:30 صباحاً',
    venue: 'حلبة ألعاب القوى بالمركب الرياضي تاوريرت',
    category: 'السباقات السريعة، الرمي، الوثب لجميع الفئات',
    gender: 'Mixed',
    organizer: 'الفرع الإقليمي للجامعة والمديرية الإقليمية',
    coordinator: 'ذ. الحسين العمراني',
    notes: 'مشاركة قياسية وتأهيل الأبطال للأولمبياد المدرسي الجهوي'
  },
  {
    id: 'prop-fb-prov-final',
    title: 'نهائيات البطولة الإقليمية لكرة القدم المدرسية',
    sportId: 'football',
    scope: 'provincial',
    date: '2027-04-28',
    time: '15:00 بعد الزوال',
    venue: 'الملعب البلدي بتاوريرت',
    category: 'نهائيات فئات الصغار والفتيان والشبان',
    gender: 'Male',
    organizer: 'اللجنة التقنية المشتركة لكرة القدم المدرسية',
    coordinator: 'ذ. إبراهيم بنعلي',
    notes: 'المباراة الختامية وتوزيع الكؤوس والميداليات وشهادات الاستحقاق'
  },
  // May 2027
  {
    id: 'prop-multi-reg-final',
    title: 'البطولات الجهوية المدرسية للألعاب الجماعية (الجهة الشرقية)',
    sportId: 'basketball',
    scope: 'regional',
    date: '2027-05-12',
    time: '09:00 صباحاً',
    venue: 'القاعات المغطاة بوجدة وبركان والناظور',
    category: 'الفرق المتوجة إقليمياً (كرة السلة، كرة اليد، الطائرة)',
    gender: 'Mixed',
    organizer: 'الأكاديمية الجهوية للتربية والتكوين لجهة الشرق',
    coordinator: 'الفرع الجهوي للجامعة الملكية للرياضة المدرسية',
    notes: 'المرحلة التأهيلية المباشرة للبطولة الوطنية المدرسية'
  }
];

export interface ResolvedMatchReferees {
  tableRefs: string[];
  fieldRefs: string[];
  extraRefs: string[];
  allRefs: string[];
  hasReferees: boolean;
}

export function getOrdinalRefLabel(idx: number): string {
  if (idx === 0) return 'الحكم الأول';
  if (idx === 1) return 'الحكم الثاني';
  if (idx === 2) return 'الحكم الثالث';
  if (idx === 3) return 'الحكم الرابع';
  return `الحكم ${idx + 1}`;
}

export function isOpaqueEntityId(value?: string): boolean {
  const clean = (value || '').trim();
  if (!clean) return false;
  if (/^(ref[-_]|usr[-_]|mgr[-_]|teacher[-_]|sch[-_]|ven[-_]|mat[-_]|tourn[-_])/i.test(clean)) {
    return true;
  }
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clean)) {
    return true;
  }
  if (clean === 'custom' || clean === 'default-venue') {
    return true;
  }
  if (/^[A-Za-z0-9_-]{16,}$/.test(clean) && !/\s/.test(clean)) {
    return true;
  }
  if (/^[A-Za-z0-9_-]{12,}$/.test(clean) && /[A-Za-z]/.test(clean) && /\d/.test(clean)) {
    return true;
  }
  return false;
}

export function isRefereeTechCommitteeHead(
  rawEntry?: string,
  referees: Referee[] = [],
  users: User[] = []
): boolean {
  const stripTeacherTag = (name: string): string =>
    (name || '').replace(/\s*\(أستاذ\)\s*/g, '').replace(/\s+/g, ' ').trim();

  const clean = stripTeacherTag(rawEntry || '');
  if (!clean) return false;
  const normClean = normalizeArabicName(clean);

  const isTechHeadUser = (u?: Partial<User> | null): boolean =>
    Boolean(
      u &&
        (u.isTechCommitteeHead === true ||
          u.role === 'TECH_HEAD' ||
          (u.role as string) === 'TECH_COMMITTEE_HEAD')
    );

  const userHasId = (u: Partial<User>, targetId: string): boolean => {
    if (!targetId) return false;
    if (u.id === targetId || (u as any).uid === targetId || (u as any).teacherId === targetId) return true;
    return Array.isArray(u.aliasIds) && u.aliasIds.includes(targetId);
  };

  const refHasId = (r: Partial<Referee>, targetId: string): boolean => {
    if (!targetId) return false;
    if (r.id === targetId || r.teacherId === targetId || (r as any).userId === targetId) return true;
    return Array.isArray(r.aliasIds) && r.aliasIds.includes(targetId);
  };

  const directUser = users.find(
    u =>
      userHasId(u, clean) ||
      (u.email && u.email.trim().toLowerCase() === clean.toLowerCase()) ||
      (normClean && normalizeArabicName(stripTeacherTag(u.fullName || '')) === normClean)
  );
  if (isTechHeadUser(directUser)) return true;

  const refMatch = referees.find(
    r =>
      refHasId(r, clean) ||
      (normClean && normalizeArabicName(stripTeacherTag(r.fullName || '')) === normClean)
  );
  if (refMatch) {
    const refNormName = normalizeArabicName(stripTeacherTag(refMatch.fullName || ''));
    const refEmail = (refMatch.email || '').trim().toLowerCase();
    const linkedUser = users.find(
      u =>
        userHasId(u, refMatch.id || '') ||
        (refMatch.teacherId ? userHasId(u, refMatch.teacherId) : false) ||
        ((refMatch as any).userId ? userHasId(u, (refMatch as any).userId) : false) ||
        (refEmail && u.email && u.email.trim().toLowerCase() === refEmail) ||
        (refNormName && normalizeArabicName(stripTeacherTag(u.fullName || '')) === refNormName)
    );
    if (isTechHeadUser(linkedUser)) return true;
  }

  return false;
}

export function resolveMatchRefereesInfo(
  m: Match,
  referees: Referee[] = [],
  users: User[] = [],
  options?: { excludeTechCommitteeHeads?: boolean }
): ResolvedMatchReferees {
  const stripTeacherTag = (name: string): string =>
    (name || '').replace(/\s*\(أستاذ\)\s*/g, '').replace(/\s+/g, ' ').trim();

  const excludeHeads = Boolean(options?.excludeTechCommitteeHeads);

  const userHasId = (u: Partial<User>, targetId: string): boolean => {
    if (!targetId) return false;
    if (u.id === targetId || (u as any).uid === targetId || (u as any).teacherId === targetId) return true;
    return Array.isArray(u.aliasIds) && u.aliasIds.includes(targetId);
  };

  const refHasId = (r: Partial<Referee>, targetId: string): boolean => {
    if (!targetId) return false;
    if (r.id === targetId || r.teacherId === targetId || (r as any).userId === targetId) return true;
    return Array.isArray(r.aliasIds) && r.aliasIds.includes(targetId);
  };

  const resolveSingle = (rawEntry?: string, fallbackName?: string): string => {
    const clean = stripTeacherTag(rawEntry || '');
    const cleanFallback = stripTeacherTag(fallbackName || '');
    if (!clean && !cleanFallback) return '';
    if (!clean) {
      if (excludeHeads && isRefereeTechCommitteeHead(cleanFallback, referees, users)) {
        return '';
      }
      return isOpaqueEntityId(cleanFallback) ? '' : cleanFallback;
    }

    if (excludeHeads && isRefereeTechCommitteeHead(clean, referees, users)) {
      return '';
    }
    const normClean = normalizeArabicName(clean);

    const refMatch = referees.find(
      r =>
        refHasId(r, clean) ||
        stripTeacherTag(r.fullName || '') === clean ||
        (normClean && normalizeArabicName(stripTeacherTag(r.fullName || '')) === normClean)
    );
    if (refMatch?.fullName) {
      const resolvedName = stripTeacherTag(refMatch.fullName);
      if (excludeHeads && isRefereeTechCommitteeHead(resolvedName, referees, users)) {
        return '';
      }
      return resolvedName;
    }

    const userMatch = users.find(
      u =>
        userHasId(u, clean) ||
        (u.email && u.email.trim().toLowerCase() === clean.toLowerCase()) ||
        stripTeacherTag(u.fullName || '') === clean ||
        (normClean && normalizeArabicName(stripTeacherTag(u.fullName || '')) === normClean)
    );
    if (userMatch?.fullName) {
      if (
        excludeHeads &&
        (userMatch.isTechCommitteeHead === true ||
          userMatch.role === 'TECH_HEAD' ||
          (userMatch.role as string) === 'TECH_COMMITTEE_HEAD')
      ) {
        return '';
      }
      return stripTeacherTag(userMatch.fullName);
    }

    if (isOpaqueEntityId(clean)) {
      if (cleanFallback && !isOpaqueEntityId(cleanFallback)) {
        if (excludeHeads && isRefereeTechCommitteeHead(cleanFallback, referees, users)) {
          return '';
        }
        return cleanFallback;
      }
      return '';
    }
    return clean;
  };

  const dedupePreserveOrder = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

  const rawTableIds = Array.isArray(m.tableReferees) ? m.tableReferees : [];
  const rawTableNames = Array.isArray(m.tableRefereeNames) ? m.tableRefereeNames : [];
  const tableLen = Math.max(rawTableIds.length, rawTableNames.length);
  const tableRefs = dedupePreserveOrder(
    Array.from({ length: tableLen }, (_, idx) => resolveSingle(rawTableIds[idx], rawTableNames[idx]))
  );

  const rawFieldIds = Array.isArray(m.fieldReferees) ? m.fieldReferees : [];
  const rawFieldNames = Array.isArray(m.fieldRefereeNames) ? m.fieldRefereeNames : [];
  const fieldLen = Math.max(rawFieldIds.length, rawFieldNames.length);
  const fieldRefs = dedupePreserveOrder(
    Array.from({ length: fieldLen }, (_, idx) => resolveSingle(rawFieldIds[idx], rawFieldNames[idx]))
  );
  const categorizedSet = new Set([...tableRefs, ...fieldRefs]);
  const categorizedNormSet = new Set(
    [...tableRefs, ...fieldRefs].map(name => normalizeArabicName(name)).filter(Boolean)
  );

  const legacyRefereeId = typeof (m as any).refereeId === 'string' ? (m as any).refereeId : '';
  const legacyRefereeIds = Array.isArray((m as any).refereeIds) ? (m as any).refereeIds : [];
  const rawRefereeNames = Array.isArray(m.refereeNames) ? m.refereeNames : [];
  const rawReferees = Array.isArray(m.referees) ? m.referees : [];

  const extraRefs = dedupePreserveOrder([
    ...rawReferees.map((id, idx) => resolveSingle(id, rawRefereeNames[idx])),
    ...(m.referee1Id ? [resolveSingle(m.referee1Id, (m as any).refereeName)] : []),
    ...(m.referee2Id ? [resolveSingle(m.referee2Id, (m as any).referee2Name)] : []),
    ...legacyRefereeIds.map((id, idx) => resolveSingle(id, rawRefereeNames[idx])),
    ...(legacyRefereeId ? [resolveSingle(legacyRefereeId, (m as any).refereeName)] : [])
  ]).filter(name => !categorizedSet.has(name) && !categorizedNormSet.has(normalizeArabicName(name)));

  const combinedFieldRefs = dedupePreserveOrder([...fieldRefs, ...extraRefs]);
  const allRefs = dedupePreserveOrder([...tableRefs, ...combinedFieldRefs]);
  return {
    tableRefs,
    fieldRefs: combinedFieldRefs,
    extraRefs: [],
    allRefs,
    hasReferees: allRefs.length > 0
  };
}

export function buildAllCalendarEvents(
  tournaments: Tournament[],
  matches: Match[],
  schools: School[],
  venues: Venue[] = [],
  referees: Referee[] = [],
  teachers: User[] = [],
  options?: { excludeTechCommitteeHeads?: boolean }
): CalendarExportEvent[] {
  const list: CalendarExportEvent[] = [];

  // Build program events exclusively from scheduled/recorded matches with valid team names
  matches.forEach(m => {
    if (!m.date) return;
    if (!hasValidMatchTeams(m, schools)) return;
    const parentT =
      (m.tournamentId ? tournaments.find(t => t.id === m.tournamentId) : undefined) ||
      tournaments.find(
        t =>
          t.sportId === m.sportId &&
          normalizeCategoryKey(t.ageCategory) === normalizeCategoryKey(m.ageCategory) &&
          (!m.gender || !t.gender || t.gender === m.gender)
      );

    const resolvedSportId = m.sportId || parentT?.sportId || 'football';
    const sp = SPORTS_MAP[resolvedSportId] || { name: 'رياضة مدرسية', icon: '🏆' };
    const dateStr = normalizeDateToYmd(m.date);
    if (!dateStr) return;

    let sc: 'provincial' | 'regional' | 'national' = 'provincial';
    if (parentT) {
      if (parentT.scope === 'national' || parentT.name.includes('وطني') || parentT.name.includes('الوطنية')) sc = 'national';
      else if (parentT.scope === 'regional' || parentT.name.includes('جهوي') || parentT.name.includes('الجهوية')) sc = 'regional';
    }

    const school1 = formatTeamDisplayName(m.team1Id, m.team1Name || m.team1SchoolName, schools, m.team1Placeholder, m.team1SourceMatchNumber);
    const school2 = formatTeamDisplayName(m.team2Id, m.team2Name || m.team2SchoolName, schools, m.team2Placeholder, m.team2SourceMatchNumber);
    const venueObj = venues.find(v => v.id === m.venueId || v.name === m.venueId);
    const resolvedVenueName =
      m.venueName?.trim() ||
      venueObj?.name?.trim() ||
      (m as any).location?.trim() ||
      (m as any).venue?.trim() ||
      m.venueId ||
      'الملعب الإقليمي';

    const { tableRefs: tableRefNames, fieldRefs: fieldRefNames, allRefs: uniqueRefs } =
      resolveMatchRefereesInfo(m, referees, teachers, options);

    const textParts: string[] = [];
    const htmlParts: string[] = [];
    if (fieldRefNames.length > 0) {
      const formattedField = fieldRefNames.map((name, i) => `${getOrdinalRefLabel(i)}: ${name}`).join(' • ');
      textParts.push(`حكام الساحة (${formattedField})`);
      htmlParts.push(
        `<div style="margin-bottom: 3px;"><span style="font-weight: 800; color: #047857;">حكام الساحة:</span> ${fieldRefNames
          .map((name, i) => `<span style="white-space: nowrap;">${getOrdinalRefLabel(i)}: <strong>${name}</strong></span>`)
          .join(' • ')}</div>`
      );
    }
    if (tableRefNames.length > 0) {
      const formattedTable = tableRefNames.map((name, i) => `${getOrdinalRefLabel(i)}: ${name}`).join(' • ');
      textParts.push(`حكام الطاولة (${formattedTable})`);
      htmlParts.push(
        `<div style="margin-bottom: 3px;"><span style="font-weight: 800; color: #0369a1;">حكام الطاولة:</span> ${tableRefNames
          .map((name, i) => `<span style="white-space: nowrap;">${getOrdinalRefLabel(i)}: <strong>${name}</strong></span>`)
          .join(' • ')}</div>`
      );
    }

    const refereesText = textParts.length > 0
      ? textParts.join(' | ')
      : (uniqueRefs.length > 0 ? uniqueRefs.join(' • ') : 'يعين لاحقاً');
    const refereesHtml = htmlParts.length > 0
      ? htmlParts.join('')
      : (uniqueRefs.length > 0 ? uniqueRefs.join(' • ') : 'يعين لاحقاً');

    const affiliationType = resolveMatchAffiliation(m, tournaments);
    const userNote = (m.notes || '').trim();

    list.push({
      id: `match-${m.id}`,
      title: `${school1} ضد ${school2}`,
      sportId: resolvedSportId,
      sportName: sp.name,
      sportIcon: sp.icon,
      scope: sc,
      affiliationType,
      date: dateStr,
      time: m.startTime || (m as any).time || '15:00',
      venue: resolvedVenueName,
      category: m.ageCategory || parentT?.ageCategory || (m.stage ? `دور ${m.stage}` : 'مباراة رسمية'),
      gender: m.gender || parentT?.gender || 'Male',
      matchNumber: m.drawMatchNumber,
      organizer: 'لجنة التحكيم والبرمجة بالمديرية',
      referees: uniqueRefs,
      tableReferees: tableRefNames,
      fieldReferees: fieldRefNames,
      refereesText,
      refereesHtml,
      notes: userNote,
      programApprovalStatus: m.programApprovalStatus
    });
  });

  return list;
}

export interface ProgramHtmlOptions {
  events: CalendarExportEvent[];
  selectedSportIds: string[]; // empty or ['ALL'] means all sports
  scopeFilter: 'ALL' | 'provincial' | 'regional' | 'national';
  affiliationFilter?: ProgramAffiliationFilter;
  categoryFilter?: string; // 'ALL' or '<catKey>__<genderKey>' e.g. 'U15__Female'
  activeSeason: string;
  customTitle?: string;
}

const AGE_CATEGORY_ORDER: Record<string, number> = {
  U12: 1,
  U15: 2,
  U17: 3,
  U18: 4,
  U20: 5
};

const GENDER_ORDER: Record<'Female' | 'Male' | 'Mixed', number> = {
  Female: 0,
  Male: 1,
  Mixed: 2
};

export interface CategoryGenderTuple {
  categoryKey: string;
  genderKey: 'Female' | 'Male' | 'Mixed';
  filterKey: string;
  label: string;
  ageRank: number;
  genderRank: number;
}

export function getEventCategoryGenderTuple(ev: {
  category?: string;
  gender?: string;
  sportId?: string;
}): CategoryGenderTuple {
  const rawCat = (ev.category || '').trim();
  const upperCat = rawCat.toUpperCase();

  let categoryKey = 'OTHER';
  if (
    upperCat.includes('U12') ||
    rawCat.includes('أقل من 12') ||
    rawCat.includes('اقل من 12') ||
    rawCat.includes('براعم') ||
    rawCat.includes('برعمات')
  ) {
    categoryKey = 'U12';
  } else if (
    upperCat.includes('U15') ||
    rawCat.includes('أقل من 15') ||
    rawCat.includes('اقل من 15') ||
    rawCat.includes('صغار') ||
    rawCat.includes('صغيرات')
  ) {
    categoryKey = 'U15';
  } else if (
    upperCat.includes('U17') ||
    rawCat.includes('أقل من 17') ||
    rawCat.includes('اقل من 17')
  ) {
    categoryKey = 'U17';
  } else if (
    upperCat.includes('U18') ||
    rawCat.includes('أقل من 18') ||
    rawCat.includes('اقل من 18') ||
    rawCat.includes('فتيان') ||
    rawCat.includes('فتيات')
  ) {
    categoryKey = 'U18';
  } else if (
    upperCat.includes('U20') ||
    rawCat.includes('شبان') ||
    rawCat.includes('شابات') ||
    rawCat.includes('2009 وما بعد')
  ) {
    categoryKey = 'U20';
  } else if (/^CAT_/i.test(rawCat)) {
    categoryKey = normalizeCategoryKey(rawCat);
  } else if (rawCat) {
    categoryKey = rawCat;
  }

  const gNorm = (ev.gender || '').trim().toLowerCase();
  const hasFemaleWords = /إناث|اناث|فتيات|صغيرات|برعمات|شابات/.test(rawCat);
  const hasMaleWords = /ذكور|فتيان|صغار|براعم|شبان/.test(rawCat);

  let genderKey: 'Female' | 'Male' | 'Mixed' = 'Mixed';
  if (gNorm === 'female' || gNorm === 'f' || gNorm === 'إناث' || gNorm === 'اناث') {
    genderKey = 'Female';
  } else if (gNorm === 'male' || gNorm === 'm' || gNorm === 'ذكور') {
    genderKey = 'Male';
  } else if (gNorm === 'mixed' || gNorm === 'مختلط') {
    genderKey = 'Mixed';
  } else if (hasFemaleWords && !hasMaleWords) {
    genderKey = 'Female';
  } else if (hasMaleWords && !hasFemaleWords) {
    genderKey = 'Male';
  }

  const spId = (ev.sportId || '').toLowerCase();
  const isTrackOrCC = spId === 'cross_country' || spId === 'athletics' || spId === 'track_field';

  const genderAr = genderKey === 'Female' ? 'إناث' : genderKey === 'Male' ? 'ذكور' : 'مختلط';
  let label = '';

  if (isTrackOrCC) {
    if (categoryKey === 'U12') {
      label = genderKey === 'Female' ? 'البرعمات إناث' : genderKey === 'Male' ? 'البراعم ذكور' : 'البراعم والبرعمات';
    } else if (categoryKey === 'U15') {
      label = genderKey === 'Female' ? 'الصغيرات إناث' : genderKey === 'Male' ? 'الصغار ذكور' : 'الصغار والصغيرات';
    } else if (categoryKey === 'U18') {
      label = genderKey === 'Female' ? 'الفتيات إناث' : genderKey === 'Male' ? 'الفتيان ذكور' : 'الفتيان والفتيات';
    } else if (categoryKey === 'U20') {
      label = genderKey === 'Female' ? 'الشابات إناث' : genderKey === 'Male' ? 'الشبان ذكور' : 'الشبان والشابات';
    }
  }

  if (!label) {
    if (categoryKey === 'U12') {
      label = genderKey === 'Mixed' ? 'أقل من 12 سنة (مختلط)' : `أقل من 12 سنة ${genderAr}`;
    } else if (categoryKey === 'U15') {
      label = genderKey === 'Mixed' ? 'أقل من 15 سنة (مختلط)' : `أقل من 15 سنة ${genderAr}`;
    } else if (categoryKey === 'U17') {
      label = genderKey === 'Mixed' ? 'أقل من 17 سنة (مختلط)' : `أقل من 17 سنة ${genderAr}`;
    } else if (categoryKey === 'U18') {
      label = genderKey === 'Mixed' ? 'أقل من 18 سنة (مختلط)' : `أقل من 18 سنة ${genderAr}`;
    } else if (categoryKey === 'U20') {
      label = genderKey === 'Mixed' ? 'أقل من 20 سنة (مختلط)' : `أقل من 20 سنة ${genderAr}`;
    } else if (rawCat) {
      label = /ذكور|إناث|اناث|مختلط/.test(rawCat) || !ev.gender ? rawCat : `${rawCat} ${genderAr}`;
    } else {
      label = genderAr;
    }
  }

  return {
    categoryKey,
    genderKey,
    filterKey: `${categoryKey}__${genderKey}`,
    label,
    ageRank: AGE_CATEGORY_ORDER[categoryKey] ?? 99,
    genderRank: GENDER_ORDER[genderKey]
  };
}

export function sortCalendarEvents(events: CalendarExportEvent[]): CalendarExportEvent[] {
  return events.slice().sort((a, b) => {
    const tA = getEventCategoryGenderTuple(a);
    const tB = getEventCategoryGenderTuple(b);

    // 1. Gender priority: Female (إناث) first, then Male (ذكور), then Mixed
    if (tA.genderRank !== tB.genderRank) {
      return tA.genderRank - tB.genderRank;
    }

    // 2. Age category priority: U12 -> U15 -> U17 -> U18 -> U20 -> other
    if (tA.ageRank !== tB.ageRank) {
      return tA.ageRank - tB.ageRank;
    }
    if (tA.categoryKey !== tB.categoryKey) {
      return tA.categoryKey.localeCompare(tB.categoryKey, 'ar');
    }

    // 3. Keep events of the same sport grouped within the same category
    const sportCmp = (a.sportId || '').localeCompare(b.sportId || '');
    if (sportCmp !== 0) {
      return sportCmp;
    }

    // 4. Match number ascending
    const numA = typeof a.matchNumber === 'number' && !Number.isNaN(a.matchNumber)
      ? a.matchNumber
      : Number.MAX_SAFE_INTEGER;
    const numB = typeof b.matchNumber === 'number' && !Number.isNaN(b.matchNumber)
      ? b.matchNumber
      : Number.MAX_SAFE_INTEGER;
    if (numA !== numB) {
      return numA - numB;
    }

    // 5. Chronological tie-breaker (date, then time)
    const dateCmp = (a.date || '').localeCompare(b.date || '');
    if (dateCmp !== 0) {
      return dateCmp;
    }
    return (a.time || '').localeCompare(b.time || '');
  });
}

function getActiveDirectorateSync() {
  try {
    const activeId = localStorage.getItem('active_directorate_id') || 'taourirt';
    const raw = localStorage.getItem('taourirt_directorates');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const found = list.find((d: any) => d.id === activeId);
        if (found) {
          return {
            name: found.name || 'المديرية الإقليمية',
            shortName: found.shortName || found.name || 'المديرية الإقليمية',
            region: found.region || 'جهة الشرق'
          };
        }
      }
    }
  } catch {}
  return { name: 'المديرية الإقليمية بتاوريرت', shortName: 'تاوريرت', region: 'جهة الشرق' };
}

function getOfficialLogosSync(): { ministryLogo?: string; frmssLogo?: string; ministryLogoHeight?: number; frmssLogoHeight?: number } {
  try {
    const raw = localStorage.getItem('taourirt_official_logos');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export function formatTargetCategoryWithGender(
  category?: string,
  gender?: string,
  sportId?: string
): string {
  const tuple = getEventCategoryGenderTuple({ category, gender, sportId });
  return tuple.label || '-';
}

export function generateProgramHtml({
  events,
  selectedSportIds,
  scopeFilter,
  affiliationFilter = 'ALL',
  categoryFilter = 'ALL',
  activeSeason,
  customTitle
}: ProgramHtmlOptions): { html: string; title: string; filenameBase: string } {
  const activeDirInfo = getActiveDirectorateSync();

  // 1. Filter events
  let filtered = events.slice();

  // Sport Filter
  const isAllSports = selectedSportIds.length === 0 || selectedSportIds.includes('ALL');
  if (!isAllSports) {
    filtered = filtered.filter(ev => selectedSportIds.includes(ev.sportId));
  }

  // Scope Filter
  if (scopeFilter !== 'ALL') {
    filtered = filtered.filter(ev => ev.scope === scopeFilter);
  }

  // Affiliation / Tournament Class Filter
  if (affiliationFilter !== 'ALL') {
    filtered = filtered.filter(ev => (ev.affiliationType || 'non_club') === affiliationFilter);
  }

  // Category & Gender Filter
  let selectedCategoryLabel = '';
  if (categoryFilter && categoryFilter !== 'ALL') {
    filtered = filtered.filter(ev => {
      const tuple = getEventCategoryGenderTuple(ev);
      if (tuple.filterKey === categoryFilter) {
        if (!selectedCategoryLabel) selectedCategoryLabel = tuple.label;
        return true;
      }
      return false;
    });
    if (!selectedCategoryLabel) {
      const [catPart, genderPart] = categoryFilter.split('__');
      selectedCategoryLabel = formatTargetCategoryWithGender(
        catPart,
        genderPart,
        !isAllSports && selectedSportIds.length === 1 ? selectedSportIds[0] : undefined
      );
    }
  }

  // Sort by gender (females first), age category, sport, match number, and date/time
  filtered = sortCalendarEvents(filtered);

  const affiliationLabel = affiliationFilter !== 'ALL' ? AFFILIATION_LABELS[affiliationFilter] : '';

  // Determine Title & Subtitle
  let title = customTitle || '';
  let filenameBase = 'برنامج_البطولات_المدرسية';

  if (!title) {
    if (isAllSports) {
      if (scopeFilter === 'provincial') {
        title = `البرنامج الرياضي المدرسي الإقليمي الشامل (${activeDirInfo.name})`;
        filenameBase = 'برنامج_البطولات_المدرسية_الاقليمي';
      } else if (scopeFilter === 'regional') {
        title = `البرنامج الرياضي المدرسي الجهوي (${activeDirInfo.region || 'جهة الشرق'})`;
        filenameBase = 'برنامج_البطولات_المدرسية_الجهوي';
      } else if (scopeFilter === 'national') {
        title = 'البرنامج الرياضي المدرسي الوطني (الجامعة الملكية للرياضة المدرسية)';
        filenameBase = 'برنامج_البطولات_المدرسية_الوطني';
      } else {
        title = 'البرنامج الرياضي المدرسي السنوي الشامل (كافة البطولات والتظاهرات)';
        filenameBase = 'برنامج_البطولات_المدرسية_الشامل';
      }
    } else if (selectedSportIds.length === 1) {
      const spId = selectedSportIds[0];
      const spName = SPORTS_MAP[spId]?.name || spId;
      title = `البرنامج والمواعيد الرسمية للبطولة الإقليمية ${spName}`;
      filenameBase = `برنامج_بطولة_${spName.replace(/\s+/g, '_')}`;
    } else if (selectedSportIds.length === 2) {
      const sp1 = SPORTS_MAP[selectedSportIds[0]]?.name || selectedSportIds[0];
      const sp2 = SPORTS_MAP[selectedSportIds[1]]?.name || selectedSportIds[1];
      title = `برنامج البطولتين المدرسيتين: ${sp1} و ${sp2}`;
      filenameBase = `برنامج_بطولتي_${sp1.replace(/\s+/g, '_')}_و_${sp2.replace(/\s+/g, '_')}`;
    } else {
      const names = selectedSportIds.map(id => SPORTS_MAP[id]?.name || id).join(' • ');
      title = `برنامج البطولات الرياضية المحددة: ${names}`;
      filenameBase = `برنامج_بطولات_مختارة`;
    }

    if (affiliationLabel) {
      title = `${title} — ${affiliationLabel}`;
      filenameBase = `${filenameBase}_${affiliationFilter}`;
    }

    if (selectedCategoryLabel) {
      title = `${title} — فئة ${selectedCategoryLabel}`;
      filenameBase = `${filenameBase}_${selectedCategoryLabel.replace(/\s+/g, '_')}`;
    }
  }

  const hideSportColumn = !isAllSports && selectedSportIds.length === 1;
  const showNotesColumn = filtered.some(ev => Boolean(ev.notes && ev.notes.trim().length > 0));
  const totalColumns = 7 + (hideSportColumn ? 0 : 1) + (showNotesColumn ? 1 : 0);

  const rowsHtml = filtered.length > 0 ? filtered.map((ev, index) => {
    const targetCategoryDisplay = formatTargetCategoryWithGender(ev.category, ev.gender, ev.sportId);
    const matchNumDisplay = ev.matchNumber ? String(ev.matchNumber) : String(index + 1);

    return `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #cbd5e1; padding: 7px 5px; text-align: center; font-weight: bold; font-size: 11px;">${index + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; text-align: center; white-space: nowrap; font-weight: bold; color: #1e3a8a; font-size: 11px;">${ev.date}${ev.time ? `<div style="font-size: 9.5px; color: #475569; margin-top: 2px;">${ev.time}</div>` : ''}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 6px; text-align: center; font-weight: bold; color: #0284c7; font-size: 11px;">${matchNumDisplay}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-weight: bold; color: #0f172a; font-size: 11px;">${ev.title}</td>
        ${!hideSportColumn ? `<td style="border: 1px solid #cbd5e1; padding: 7px 6px; text-align: center; font-size: 11px; font-weight: bold; color: #334155;">${ev.sportName}</td>` : ''}
        <td style="border: 1px solid #cbd5e1; padding: 7px 6px; text-align: center; font-weight: bold; font-size: 10.5px; color: #334155;">${targetCategoryDisplay}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10.5px; color: #334155;">${ev.venue || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10.5px; color: #1e293b;">${ev.refereesHtml || ev.refereesText || (ev.referees && ev.referees.length > 0 ? ev.referees.map(r => r.replace(/\s*\(أستاذ\)\s*/g, '').trim()).join(' • ') : 'يعين لاحقاً')}</td>
        ${showNotesColumn ? `<td style="border: 1px solid #cbd5e1; padding: 7px 6px; font-size: 10px; color: #334155;">${ev.notes?.trim() || '-'}</td>` : ''}
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="${totalColumns}" style="border: 1px solid #cbd5e1; padding: 25px; text-align: center; font-size: 13px; color: #64748b; font-weight: bold;">
        لا توجد مباريات أو أنشطة مبرمجة حالياً وفق الاختيارات المحددة
      </td>
    </tr>
  `;

  const officialLogos = getOfficialLogosSync();

  const html = `
    <div style="direction: rtl; text-align: right; font-family: 'Traditional Arabic', 'Amiri', 'Cairo', Arial, sans-serif; padding: 15px 25px; background: #ffffff; color: #0f172a; max-width: 1100px; margin: 0 auto; box-sizing: border-box;">
      
      <!-- Official Header (Ministry in Center, FRMSS on Left and Right) -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px;">
        <tr>
          <td style="width: 25%; text-align: right; vertical-align: middle; padding-bottom: 10px;">
            ${officialLogos.frmssLogo 
              ? `<img src="${officialLogos.frmssLogo}" alt="شعار الجامعة الملكية" style="height: ${officialLogos.frmssLogoHeight || 60}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 11px; font-weight: bold; color: #b45309; background-color: #fffbeb; padding: 6px 10px; border-radius: 8px; border: 1px solid #fde68a; display: inline-block;">الجامعة الملكية للرياضة المدرسية</div>`
            }
          </td>
          <td style="width: 50%; text-align: center; vertical-align: middle; padding-bottom: 10px;">
            ${officialLogos.ministryLogo 
              ? `<img src="${officialLogos.ministryLogo}" alt="شعار الوزارة" style="height: ${officialLogos.ministryLogoHeight || 80}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 11px; font-weight: bold; color: #0369a1; background-color: #f0f9ff; padding: 6px 10px; border-radius: 8px; border: 1px solid #bae6fd; display: inline-block;">وزارة التربية الوطنية</div>`
            }
          </td>
          <td style="width: 25%; text-align: left; vertical-align: middle; padding-bottom: 10px;">
            ${officialLogos.frmssLogo 
              ? `<img src="${officialLogos.frmssLogo}" alt="شعار الجامعة الملكية" style="height: ${officialLogos.frmssLogoHeight || 60}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 11px; font-weight: bold; color: #b45309; background-color: #fffbeb; padding: 6px 10px; border-radius: 8px; border: 1px solid #fde68a; display: inline-block;">الجامعة الملكية للرياضة المدرسية</div>`
            }
          </td>
        </tr>
      </table>

      <!-- Main Document Title -->
      <div style="text-align: center; margin: 15px 0 10px 0;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 900; color: #1e3a8a; text-decoration: underline; text-underline-offset: 6px;">
          ${title}
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: bold; color: #475569;">
          رزنامة وجدول المواعيد والأنشطة الرياضية المدرسية الرسمية للموسم الدراسي ${activeSeason} • إجمالي الأنشطة: (${filtered.length})
        </p>
      </div>

      <!-- Extraction Date Line -->
      <div style="display: flex; justify-content: flex-end; align-items: center; margin-bottom: 10px; font-size: 10.5px; font-weight: bold; color: #475569; border-bottom: 1px dashed #cbd5e1; padding-bottom: 5px;">
        <div>
          <span>تاريخ الاستخراج: </span>
          <span>${new Date().toLocaleDateString('ar-MA')}</span>
        </div>
      </div>

      <!-- Data Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; line-height: 1.4;">
        <thead>
          <tr style="background-color: #1e3a8a; color: #ffffff;">
            <th style="border: 1px solid #0f172a; padding: 8px 4px; text-align: center; width: 4%; font-weight: bold;">ر.ت</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: center; width: 13%; font-weight: bold;">التاريخ والتوقيت</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: center; width: 8%; font-weight: bold;">رقم المقابلة</th>
            <th style="border: 1px solid #0f172a; padding: 8px 8px; text-align: right; width: ${hideSportColumn ? '26%' : '22%'}; font-weight: bold;">المقابلة</th>
            ${!hideSportColumn ? `<th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: center; width: 10%; font-weight: bold;">نوع الرياضة</th>` : ''}
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: center; width: 13%; font-weight: bold;">الفئة المعنية</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: right; width: ${hideSportColumn ? '18%' : '14%'}; font-weight: bold;">مركز التباري</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: right; width: ${hideSportColumn ? '16%' : '12%'}; font-weight: bold;">الحكام</th>
            ${showNotesColumn ? `<th style="border: 1px solid #0f172a; padding: 8px 4px; text-align: center; width: 10%; font-weight: bold;">ملاحظات</th>` : ''}
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <table style="width: 100%; margin-top: 35px; border-collapse: collapse; page-break-inside: avoid;">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; font-size: 12px; line-height: 1.8; color: #0f172a; font-weight: bold;">
            رئيس الفرع الإقليمي للجامعة الملكية للرياضة المدرسية<br/>
            (المدير الإقليمي بتاوريرت)<br/>
            <div style="height: 45px;"></div>
            <span>................................................</span>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; font-size: 12px; line-height: 1.8; color: #0f172a; font-weight: bold;">
            مكتب التربية البدنية والرياضة المدرسية<br/>
            واللجان التقنية الإقليمية<br/>
            <div style="height: 45px;"></div>
            <span>................................................</span>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 25px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #94a3b8;">
        منظومة تدبير الأنشطة والبطولات الرياضية المدرسية - المديرية الإقليمية تاوريرت © ${new Date().getFullYear()}
      </div>

    </div>
  `;

  return { html, title, filenameBase };
}

// ----------------------------------------------------
// 1. Direct PDF Download (SEPARATE from printing!)
// ----------------------------------------------------
export async function downloadProgramAsPdf(options: ProgramHtmlOptions): Promise<void> {
  const { html, filenameBase } = generateProgramHtml(options);
  const toastId = toast.loading('جاري فتح نافذة الطباعة...');
  const filename = `${filenameBase}_${options.activeSeason.replace('/', '-')}.pdf`;

  return new Promise((resolve) => {
    toast.dismiss(toastId);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback if popup blocked
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <html dir="rtl" lang="ar">
            <head>
              <title>${filename}</title>
              <meta charset="utf-8" />
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                @page { size: A4 landscape; margin: 8mm; }
                body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                @media print { body { width: 100%; } }
              </style>
            </head>
            <body>
              ${html}
              <script>
                window.onload = () => {
                  setTimeout(() => {
                    window.focus();
                    window.print();
                  }, 500);
                };
              </script>
            </body>
          </html>
        `);
        doc.close();
      }
      resolve();
      return;
    }

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${filename}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
            @page { size: A4 landscape; margin: 8mm; }
            body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @media print { body { width: 100%; } }
          </style>
        </head>
        <body>
          ${html}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    resolve();
  });
}

// ----------------------------------------------------
// 2. Direct Word Download (.doc)
// ----------------------------------------------------
export function downloadProgramAsWord(options: ProgramHtmlOptions): void {
  const { html, filenameBase } = generateProgramHtml(options);
  const filename = `${filenameBase}_${options.activeSeason.replace('/', '-')}.doc`;

  const wordContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${filenameBase}</title>
      <style>
        body {
          font-family: 'Traditional Arabic', 'Arial', sans-serif;
          direction: rtl;
          text-align: right;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + wordContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success('تم تحميل البرنامج بصيغة Word (.doc) بنجاح!');
}

// ----------------------------------------------------
// 3. Print Program (SEPARATE from file download!)
// ----------------------------------------------------
export function printProgram(options: ProgramHtmlOptions): void {
  const { html, title } = generateProgramHtml(options);

  const printWindow = window.open('', '_blank', 'width=1150,height=850');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            margin: 0;
            padding: 10px;
            font-family: 'Traditional Arabic', 'Amiri', 'Cairo', Arial, sans-serif;
            direction: rtl;
            background: #fff;
            color: #000;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${html}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } else {
    // Fallback if popup blocked
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            body { font-family: 'Traditional Arabic', Arial, sans-serif; direction: rtl; margin: 0; padding: 10px; }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 3000);
      }, 500);
    }
  }
}
