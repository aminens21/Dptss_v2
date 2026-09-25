import { Tournament, Match, School, Venue, User, Referee, Student, Sport, AppNotification, RoleSidebarPermissions, Directorate, DirectorateTransferRequest, SUPER_ADMIN_EMAILS, CrossCountryCategoryResult, PodiumWinner, CustomAgeCategory } from '../types';
import { INITIAL_TOURNAMENTS, INITIAL_MATCHES, INITIAL_SCHOOLS, INITIAL_VENUES, INITIAL_DIRECTORATES } from './initialData';
import { INITIAL_CROSS_COUNTRY_RESULTS } from './crossCountryConfig';
import { db } from '../firebase/config';
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, setDoc, deleteDoc, Timestamp, serverTimestamp, query, where, onSnapshot, writeBatch } from 'firebase/firestore';

const STORAGE_KEYS = {
  TOURNAMENTS: 'taourirt_tournaments_data',
  MATCHES: 'taourirt_matches_data',
  SCHOOLS: 'taourirt_schools_data',
  VENUES: 'taourirt_venues_data',
  DIRECTORATES: 'app_directorates_data'
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

// Helper to recursively sanitize payloads for Firestore (removes/replaces undefined with null)
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return null as any;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestorePayload(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const val = obj[key];
        cleaned[key] = val === undefined ? null : sanitizeFirestorePayload(val);
      }
    }
    return cleaned as any;
  }
  return obj;
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
        return foundSport.customAgeCategories.map((cat: any) => {
          const years = parseYearsExpression(cat.yearsExpression);
          return {
            id: cat.id,
            name: `${cat.name} - ${cat.yearsExpression}`,
            shortName: cat.name,
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
  } else {
    // Other sports:
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
  const s = String(catStr).trim().toUpperCase();
  
  if (s.includes('U12') || s.includes('براعم') || s.includes('برعمات')) return 'U12';
  if (s.includes('U15') || s.includes('صغار') || s.includes('صغيرات')) return 'U15';
  if (s.includes('U18') || s.includes('فتيان') || s.includes('فتيات')) return 'U18';
  if (s.includes('U20') || s.includes('شبان') || s.includes('شابات')) return 'U20';
  if (s === 'U12' || s === 'U15' || s === 'U18' || s === 'U20') return s;
  
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
  return category;
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
  if (!teachingCadre) return false; // STRICT: If cadre is missing, teachers shouldn't register until they set it
  
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
  
  if (!teacherLevelKey) return false; // If we can't determine the cadre, block it for safety
  
  const allowedLevels = tournamentLevel.split(',').map(l => l.trim());
  
  // Check mapping
  if (allowedLevels.includes(teacherLevelKey)) return true;
  
  // Arabic synonyms check in tournament level string
  if (teacherLevelKey === 'Primary' && (tournamentLevel.includes('ابتدائي') || allowedLevels.includes('Primary'))) return true;
  if (teacherLevelKey === 'Middle' && (tournamentLevel.includes('إعدادي') || tournamentLevel.includes('اعدادي') || allowedLevels.includes('Middle'))) return true;
  if (teacherLevelKey === 'High' && (tournamentLevel.includes('تأهيلي') || tournamentLevel.includes('تاهيلي') || tournamentLevel.includes('ثانوي') || allowedLevels.includes('High'))) return true;

  return false;
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
  async getTournaments(): Promise<Tournament[]> {
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
      }
    } catch (e) {
      console.warn("Firestore fetch tournaments error, falling back to cached local storage:", e);
    }

    // 2. Merge local cache for any items not yet in Firestore or newer local edits
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, tournsMap.size > 0 ? [] : INITIAL_TOURNAMENTS);
    localList.forEach(t => {
      if (t && t.id) {
        const existing = tournsMap.get(t.id);
        if (!existing) {
          // If Firestore is loaded, only merge local items that are unsynced pending creations
          if (tournsMap.size === 0 || t.id.startsWith('tourn-')) {
            tournsMap.set(t.id, {
              ...t,
              startDate: t.startDate ? (typeof t.startDate === 'object' && 'toDate' in t.startDate ? (t.startDate as any).toDate() : (t.startDate instanceof Date ? t.startDate : new Date(t.startDate))) : undefined,
              endDate: t.endDate ? (typeof t.endDate === 'object' && 'toDate' in t.endDate ? (t.endDate as any).toDate() : (t.endDate instanceof Date ? t.endDate : new Date(t.endDate))) : undefined,
              registrationDeadline: t.registrationDeadline ? (typeof t.registrationDeadline === 'object' && 'toDate' in t.registrationDeadline ? (t.registrationDeadline as any).toDate() : (t.registrationDeadline instanceof Date ? t.registrationDeadline : new Date(t.registrationDeadline))) : undefined
            });
          }
        } else {
          // If local item exists and has newer or equal updatedAt date than firestore, merge local updates into tournsMap
          const localUpdated = t.updatedAt ? (typeof t.updatedAt === 'object' && 'toDate' in t.updatedAt ? (t.updatedAt as any).toDate().getTime() : new Date(t.updatedAt).getTime()) : 0;
          const remoteUpdated = existing.updatedAt ? (typeof existing.updatedAt === 'object' && 'toDate' in existing.updatedAt ? (existing.updatedAt as any).toDate().getTime() : new Date(existing.updatedAt).getTime()) : 0;
          
          if (localUpdated >= remoteUpdated) {
            tournsMap.set(t.id, {
              ...existing,
              ...t,
              startDate: t.startDate ? (typeof t.startDate === 'object' && 'toDate' in t.startDate ? (t.startDate as any).toDate() : (t.startDate instanceof Date ? t.startDate : new Date(t.startDate))) : existing.startDate,
              endDate: t.endDate ? (typeof t.endDate === 'object' && 'toDate' in t.endDate ? (t.endDate as any).toDate() : (t.endDate instanceof Date ? t.endDate : new Date(t.endDate))) : existing.endDate,
              registrationDeadline: t.registrationDeadline !== undefined 
                ? (t.registrationDeadline ? (typeof t.registrationDeadline === 'object' && 'toDate' in t.registrationDeadline ? (t.registrationDeadline as any).toDate() : (t.registrationDeadline instanceof Date ? t.registrationDeadline : new Date(t.registrationDeadline))) : undefined) 
                : existing.registrationDeadline
            });
          }
        }
      }
    });

    const mergedList = Array.from(tournsMap.values());
    setLocal(STORAGE_KEYS.TOURNAMENTS, mergedList);
    return deduplicateById(mergedList);
  },

  async addTournament(tournament: Omit<Tournament, 'id'>): Promise<Tournament> {
    const activeDirId = this.getActiveDirectorateId();
    const tournamentWithDir = {
      ...tournament,
      directorateId: tournament.directorateId || activeDirId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const tempId = `tourn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newTournament: Tournament = {
      ...tournamentWithDir,
      id: tempId
    };

    // Always update local cache first for instant feedback
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const filtered = localList.filter(t => t.id !== tempId);
    const updated = [newTournament, ...filtered];
    setLocal(STORAGE_KEYS.TOURNAMENTS, updated);

    // Sync to Firestore if online
    try {
      const docRef = await addDoc(collection(db, 'tournaments'), {
        ...tournamentWithDir,
        startDate: tournamentWithDir.startDate instanceof Date ? Timestamp.fromDate(tournamentWithDir.startDate) : (tournamentWithDir.startDate ? Timestamp.fromDate(new Date(tournamentWithDir.startDate)) : null),
        endDate: tournamentWithDir.endDate instanceof Date ? Timestamp.fromDate(tournamentWithDir.endDate) : (tournamentWithDir.endDate ? Timestamp.fromDate(new Date(tournamentWithDir.endDate)) : null),
        registrationDeadline: tournamentWithDir.registrationDeadline instanceof Date ? Timestamp.fromDate(tournamentWithDir.registrationDeadline) : (tournamentWithDir.registrationDeadline ? Timestamp.fromDate(new Date(tournamentWithDir.registrationDeadline)) : null),
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      const realId = docRef.id;
      newTournament.id = realId;

      // Update local cache with the Firestore ID
      const currentList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
      const synced = currentList.map(t => t.id === tempId ? { ...t, id: realId } : t);
      setLocal(STORAGE_KEYS.TOURNAMENTS, synced);
    } catch (e) {
      console.warn("Saved locally; Firestore sync pending:", e);
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
    }

    return newTournament;
  },

  async deleteTournament(id: string): Promise<void> {
    try {
      // 1. Get the tournament details first to know what students to delete
      const tournaments = await this.getTournaments();
      const tournament = tournaments.find(t => t.id === id);

      if (tournament) {
        // 2. Delete Matches
        const matches = await this.getMatches();
        const matchesToDelete = matches.filter(m => m.tournamentId === id);
        for (const m of matchesToDelete) {
          await this.deleteMatch(m.id);
        }

        // 3. Delete Students (Participants)
        // Note: Students are linked by (sportId, category, gender, affiliationType)
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
      const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
      const updated = localList.filter(t => t.id !== id);
      setLocal(STORAGE_KEYS.TOURNAMENTS, updated);

      // 6. Delete from Firestore
      await deleteDoc(doc(db, 'tournaments', id));
    } catch (e) {
      console.warn("Error during cascade delete:", e);
      // Fallback: still delete the tournament locally even if cascade failed
      const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
      const updated = localList.filter(t => t.id !== id);
      setLocal(STORAGE_KEYS.TOURNAMENTS, updated);
      await deleteDoc(doc(db, 'tournaments', id)).catch(() => {});
    }
  },

  async bulkDeleteTournamentsBySport(sportId: string): Promise<void> {
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const tournamentsToDelete = localList.filter(t => t.sportId === sportId);
    const updatedTournaments = localList.filter(t => t.sportId !== sportId);
    setLocal(STORAGE_KEYS.TOURNAMENTS, updatedTournaments);

    for (const tourn of tournamentsToDelete) {
      try {
        await deleteDoc(doc(db, 'tournaments', tourn.id));
      } catch (e) {
        console.warn(`Could not delete tournament ${tourn.id} in Firestore:`, e);
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
    const cleanFirestorePayload: Record<string, any> = {
      ...fullUpdatedTournament,
      updatedAt: serverTimestamp()
    };
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
    } catch (e) {
      console.warn("Firestore tournament update error:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
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
  async getMatches(): Promise<Match[]> {
    try {
      const snap = await getDocs(collection(db, 'matches'));
      if (!snap.empty) {
        const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
        const filtered = firestoreList.filter(m => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3');
        const deduped = deduplicateById(filtered);
        setLocal(STORAGE_KEYS.MATCHES, deduped);
        return deduped;
      }
    } catch (e) {
      console.warn("Firestore fetch matches error, falling back to cache:", e);
    }
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
    const cleaned = localList.filter(m => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3');
    if (cleaned.length !== localList.length) {
      setLocal(STORAGE_KEYS.MATCHES, cleaned);
    }
    return deduplicateById(cleaned);
  },

  async addMatch(match: Omit<Match, 'id'>): Promise<Match> {
    const activeDirId = this.getActiveDirectorateId();
    const matchWithDir = {
      ...match,
      directorateId: match.directorateId || activeDirId
    };
    const tempId = `mat-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newMatch: Match = {
      ...matchWithDir,
      id: tempId
    };
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
    const filtered = localList.filter(m => m.id !== tempId);
    const updated = [newMatch, ...filtered];
    setLocal(STORAGE_KEYS.MATCHES, updated);

    try {
      const docRef = await addDoc(collection(db, 'matches'), {
        ...matchWithDir,
        updatedAt: Timestamp.now()
      });
      const realId = docRef.id;
      newMatch.id = realId;

      const currentList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
      const synced = currentList.map(m => m.id === tempId ? { ...m, id: realId } : m);
      setLocal(STORAGE_KEYS.MATCHES, synced);
    } catch (e) {
      console.warn("Match saved locally:", e);
    }

    // Trigger notification
    this.triggerMatchNotification('create', newMatch);

    return newMatch;
  },

  async updateMatch(matchId: string, matchData: Partial<Match>): Promise<void> {
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
    const updated = localList.map(m => m.id === matchId ? { ...m, ...matchData } : m);
    setLocal(STORAGE_KEYS.MATCHES, updated);

    try {
      // Remove id from matchData if it exists before updating Firestore
      const { id, ...dataToUpdate } = matchData as any;
      const sanitizedData = sanitizeFirestorePayload(dataToUpdate);
      await updateDoc(doc(db, 'matches', matchId), {
        ...sanitizedData,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error updating match in Firestore:", e);
      throw e;
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
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
    const updated = localList.map(m => m.id === matchId ? {
      ...m,
      score1,
      score2,
      status,
      ...(extras || {})
    } : m);
    setLocal(STORAGE_KEYS.MATCHES, updated);

    try {
      const sanitizedExtras = sanitizeFirestorePayload(extras || {});
      await updateDoc(doc(db, 'matches', matchId), {
        score1,
        score2,
        status,
        ...sanitizedExtras,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error("Error updating match score in Firestore:", e);
      throw e;
    }

    const fullMatch = updated.find(m => m.id === matchId);
    if (fullMatch) {
      this.triggerMatchNotification('result', fullMatch);
    }
  },

  async deleteMatch(id: string): Promise<void> {
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
    const updated = localList.filter(m => m.id !== id);
    setLocal(STORAGE_KEYS.MATCHES, updated);

    try {
      await deleteDoc(doc(db, 'matches', id));
    } catch (e) {
      console.warn("Match deleted locally:", e);
    }
  },

  // SCHOOLS
  async getSchools(): Promise<School[]> {
    try {
      const snap = await getDocs(collection(db, 'schools'));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as School))
          .filter(s => s && s.name && !s.name.includes('الكندي') && !s.name.includes('غير محدد') && s.name.trim() !== 'ثانوية المغرب العربي التأهيلية');
        
        // Auto-clean any document with name 'ثانوية المغرب العربي التأهيلية'
        const duplicateDocs = snap.docs.filter(d => {
          const name = d.data()?.name?.trim();
          return name === 'ثانوية المغرب العربي التأهيلية';
        });
        if (duplicateDocs.length > 0) {
          duplicateDocs.forEach(d => {
            deleteDoc(doc(db, 'schools', d.id)).catch(err => console.warn("Failed to delete duplicate school doc:", err));
          });
        }

        // Auto-heal accessCode for legacy schools
        const listWithCodes = firestoreList.map(s => {
          if (s.accessCode && s.accessCode.trim().length === 6) {
            return s;
          }
          const accessCode = generateSecureAccessCode();
          if (s.id) {
            updateDoc(doc(db, 'schools', s.id), { accessCode }).catch(err => 
              console.warn(`Failed to auto-update school ${s.name} accessCode:`, err)
            );
          }
          return { ...s, accessCode };
        });

        setLocal(STORAGE_KEYS.SCHOOLS, listWithCodes);
        return listWithCodes;
      } else {
        // If Firestore is empty, we return an empty list instead of auto-seeding
        // This allows the user to have a clean database after "Delete All"
        setLocal(STORAGE_KEYS.SCHOOLS, []);
        return [];
      }
    } catch (e) {
      console.warn("Firestore schools fetch error:", e);
      // Fallback to local storage only, without INITIAL_SCHOOLS to respect empty state
      const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
      return localList.filter(s => s && s.name && !s.name.includes('الكندي') && !s.name.includes('غير محدد') && s.name.trim() !== 'ثانوية المغرب العربي التأهيلية');
    }
  },

  subscribeToSchools(callback: (schools: School[]) => void): () => void {
    try {
      const unsubscribe = onSnapshot(collection(db, 'schools'), (snap) => {
        const firestoreList = snap.docs
          .map(d => ({ id: d.id, ...d.data() } as School))
          .filter(s => s && s.name && !s.name.includes('الكندي') && !s.name.includes('غير محدد') && s.name.trim() !== 'ثانوية المغرب العربي التأهيلية');
        
        // Auto-heal accessCode for legacy schools in real-time
        const listWithCodes = firestoreList.map(s => {
          if (s.accessCode && s.accessCode.trim().length === 6) {
            return s;
          }
          const accessCode = generateSecureAccessCode();
          if (s.id) {
            updateDoc(doc(db, 'schools', s.id), { accessCode }).catch(err => 
              console.warn(`Failed to auto-update school ${s.name} accessCode:`, err)
            );
          }
          return { ...s, accessCode };
        });

        setLocal(STORAGE_KEYS.SCHOOLS, listWithCodes);
        callback(listWithCodes);
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
        const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
        const filtered = firestoreList.filter(m => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3');
        const deduped = deduplicateById(filtered);
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
        const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Venue));
        const deduped = deduplicateById(firestoreList);
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
                ageCategories: (loc.ageCategories && loc.ageCategories.length > 0) ? loc.ageCategories : f.ageCategories
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
    const activeDirId = this.getActiveDirectorateId();
    const accessCode = school.accessCode || generateSecureAccessCode();
    const schoolWithDir = {
      ...school,
      accessCode,
      directorateId: school.directorateId || activeDirId
    };
    const tempId = `sch-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newSchool: School = {
      ...schoolWithDir,
      id: tempId
    };
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const filtered = localList.filter(s => s.id !== tempId && s.name?.trim() !== 'ثانوية المغرب العربي التأهيلية');
    const updated = [newSchool, ...filtered];
    setLocal(STORAGE_KEYS.SCHOOLS, updated);

    try {
      const docRef = await addDoc(collection(db, 'schools'), {
        ...schoolWithDir,
        createdAt: Timestamp.now()
      });
      const realId = docRef.id;
      newSchool.id = realId;

      const currentList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
      const synced = currentList.map(s => s.id === tempId ? { ...s, id: realId } : s).filter(s => s.name?.trim() !== 'ثانوية المغرب العربي التأهيلية');
      setLocal(STORAGE_KEYS.SCHOOLS, synced);
    } catch (e) {
      console.warn("Saved school locally:", e);
    }
    return newSchool;
  },

  async updateSchool(id: string, updates: Partial<School>): Promise<void> {
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const updated = localList.map(s => s.id === id ? { ...s, ...updates } : s).filter(s => s.name?.trim() !== 'ثانوية المغرب العربي التأهيلية');
    setLocal(STORAGE_KEYS.SCHOOLS, updated);

    try {
      await updateDoc(doc(db, 'schools', id), {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (e) {
      console.warn("Updated school locally:", e);
    }
  },

  async deleteSchool(id: string): Promise<void> {
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const updated = localList.filter(s => s.id !== id);
    setLocal(STORAGE_KEYS.SCHOOLS, updated);

    try {
      await deleteDoc(doc(db, 'schools', id));
    } catch (e) {
      console.warn("Deleted school locally:", e);
    }
  },

  async deleteAllSchools(): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    
    // 1. Delete from Firestore
    try {
      const q = query(collection(db, 'schools'), where('directorateId', '==', activeDirId));
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Error deleting all schools from Firestore:", e);
    }

    // 2. Delete from Local Storage
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const updated = localList.filter(s => (s.directorateId || 'taourirt') !== activeDirId);
    setLocal(STORAGE_KEYS.SCHOOLS, updated);
    
    // Trigger global UI refresh
    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
  },

  async addSchoolsBulk(newSchools: Omit<School, 'id'>[]): Promise<School[]> {
    const activeDirId = this.getActiveDirectorateId();
    const existing = await this.getSchools();
    const createdOrUpdatedList: School[] = [];
    const updatedMap = new Map<string, School>();
    
    // Index existing by clean name
    existing.forEach(s => {
      if (s.name) {
        updatedMap.set(s.name.trim().toLowerCase(), s);
      }
    });

    // Use Firestore Batch for atomic and fast updates (up to 500 docs per batch)
    const batch = writeBatch(db);
    let batchCount = 0;

    for (const item of newSchools) {
      const cleanName = item.name?.trim();
      if (!cleanName) continue;
      const key = cleanName.toLowerCase();
      
      // Ensure no field is undefined for Firestore
      const cleanItem: any = {};
      Object.entries(item).forEach(([k, v]) => {
        if (v !== undefined) {
          cleanItem[k] = v;
        } else {
          cleanItem[k] = ""; // Replace undefined with empty string
        }
      });

      const itemWithDir = {
        ...cleanItem,
        directorateId: item.directorateId || activeDirId,
        updatedAt: serverTimestamp()
      };

      const existingSchool = updatedMap.get(key);
      const accessCode = existingSchool?.accessCode || itemWithDir.accessCode || generateSecureAccessCode();

      const itemWithDirAndCode = {
        ...itemWithDir,
        accessCode
      };

      if (existingSchool) {
        // Update existing school
        const updatedItem: School = {
          ...existingSchool,
          ...itemWithDirAndCode,
          name: cleanName,
          id: existingSchool.id,
          coordinatorName: itemWithDirAndCode.coordinatorName || itemWithDirAndCode.teacherName || existingSchool.coordinatorName,
          teacherName: itemWithDirAndCode.coordinatorName || itemWithDirAndCode.teacherName || existingSchool.teacherName
        } as any;
        
        updatedMap.set(key, updatedItem);
        createdOrUpdatedList.push(updatedItem);
        
        const docRef = doc(db, 'schools', existingSchool.id);
        batch.update(docRef, itemWithDirAndCode);
        batchCount++;
      } else {
        // Create new school
        const docRef = doc(collection(db, 'schools'));
        const newSchool: School = {
          ...itemWithDirAndCode,
          id: docRef.id,
          name: cleanName,
          coordinatorName: itemWithDirAndCode.coordinatorName || itemWithDirAndCode.teacherName || '',
          teacherName: itemWithDirAndCode.coordinatorName || itemWithDirAndCode.teacherName || '',
          createdAt: serverTimestamp()
        } as any;
        
        batch.set(docRef, { ...itemWithDirAndCode, createdAt: serverTimestamp() });
        updatedMap.set(key, newSchool);
        createdOrUpdatedList.push(newSchool);
        batchCount++;
      }

      // Firestore batches are limited to 500 operations
      if (batchCount >= 450) {
        await batch.commit();
        // Reset batch if we have more
      }
    }

    if (batchCount > 0) {
      try {
        await batch.commit();
      } catch (e) {
        console.error("Firestore batch commit error:", e);
        // If Firestore fails, we still have the local state for immediate use
      }
    }

    const finalList = Array.from(updatedMap.values());
    setLocal(STORAGE_KEYS.SCHOOLS, finalList);
    
    // Trigger global UI refresh
    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
    
    return createdOrUpdatedList;
  },

  // VENUES
  async getVenues(): Promise<Venue[]> {
    try {
      const snap = await getDocs(collection(db, 'venues'));
      if (!snap.empty) {
        const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Venue));
        return deduplicateById(firestoreList);
      }
    } catch (e) {
      console.warn("Firestore venues fetch error:", e);
    }
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    return deduplicateById(localList);
  },

  async addVenue(venue: Omit<Venue, 'id'>): Promise<Venue> {
    const activeDirId = this.getActiveDirectorateId();
    const venueWithDir = {
      ...venue,
      directorateId: venue.directorateId || activeDirId
    };
    const tempId = `ven-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newVenue: Venue = {
      ...venueWithDir,
      id: tempId
    };
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const filtered = localList.filter(v => v.id !== tempId);
    const updated = [newVenue, ...filtered];
    setLocal(STORAGE_KEYS.VENUES, updated);

    try {
      const docRef = await addDoc(collection(db, 'venues'), {
        ...venueWithDir,
        createdAt: Timestamp.now()
      });
      const realId = docRef.id;
      newVenue.id = realId;

      const currentList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
      const synced = currentList.map(v => v.id === tempId ? { ...v, id: realId } : v);
      setLocal(STORAGE_KEYS.VENUES, synced);
    } catch (e) {
      console.warn("Saved venue locally:", e);
    }
    return newVenue;
  },

  async updateVenue(id: string, updates: Partial<Venue>): Promise<void> {
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const updated = localList.map(v => v.id === id ? { ...v, ...updates } : v);
    setLocal(STORAGE_KEYS.VENUES, updated);

    try {
      await updateDoc(doc(db, 'venues', id), {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (e) {
      console.warn("Updated venue locally:", e);
    }
  },

  async deleteVenue(id: string): Promise<void> {
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const updated = localList.filter(v => v.id !== id);
    setLocal(STORAGE_KEYS.VENUES, updated);

    try {
      await deleteDoc(doc(db, 'venues', id));
    } catch (e) {
      console.warn("Deleted venue locally:", e);
    }
  },

  // REFEREES
  async getReferees(): Promise<Referee[]> {
    let explicitReferees: Referee[] = [];
    try {
      const snap = await getDocs(collection(db, 'referees'));
      if (!snap.empty) {
        explicitReferees = snap.docs.map(d => ({ id: d.id, ...d.data() } as Referee));
      }
    } catch (e) {
      console.warn("Firestore fetch referees error, falling back to local:", e);
      explicitReferees = getLocal<Referee>('referees', []);
    }

    // Helper text normalizer for name matching
    const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();

    // Fetch teachers/users to sync phone numbers and teacher referees
    let usersList: User[] = [];
    try {
      usersList = await this.getUsers();
    } catch (e) {
      console.warn("Failed to fetch users for referee merge:", e);
    }

    // Merge latest phone numbers into explicit referees if a user profile has a fresher phone
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

    // Automatically fill referees from teachers who have referee data filled
    const teacherReferees: Referee[] = usersList
      .filter(t => t.role === 'TEACHER' && (Array.isArray(t.refereeSpecialty) ? t.refereeSpecialty.length > 0 : !!t.refereeSpecialty))
      .map(t => ({
        id: t.id,
        fullName: t.fullName + ' (أستاذ)',
        phone: t.phone || 'غير محدد',
        specialty: Array.isArray(t.refereeSpecialty) ? t.refereeSpecialty : [t.refereeSpecialty || 'كرة القدم'],
        isActive: t.isActive !== false,
        isTeacher: true,
        photoUrl: t.photoUrl
      }));

    // Deduplicate by ID and normalized name
    const combined = [...explicitReferees, ...teacherReferees];
    const uniqueMap = new Map<string, Referee>();
    combined.forEach(r => {
      const key = norm(r.fullName.replace(/\s*\(أستاذ\)\s*/g, ''));
      if (!uniqueMap.has(key) || (r.phone && r.phone !== 'غير محدد' && !uniqueMap.get(key)?.phone)) {
        uniqueMap.set(key, r);
      }
    });

    return Array.from(uniqueMap.values());
  },

  async addReferee(referee: Omit<Referee, 'id'>): Promise<Referee> {
    const activeDirId = this.getActiveDirectorateId();
    const refereeWithDir = {
      ...referee,
      directorateId: referee.directorateId || activeDirId
    };
    const newRef: Referee = { ...refereeWithDir, id: `ref-${Date.now()}` };
    const list = getLocal<Referee>('referees', []);
    setLocal('referees', [newRef, ...list]);

    try {
      const docRef = await addDoc(collection(db, 'referees'), {
        ...refereeWithDir,
        createdAt: Timestamp.now()
      });
      newRef.id = docRef.id;
    } catch (e) {
      console.warn("Saved referee locally:", e);
    }
    return newRef;
  },

  async updateReferee(id: string, updates: Partial<Referee>): Promise<void> {
    const list = getLocal<Referee>('referees', []);
    const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
    
    const targetRef = list.find(r => r.id === id);
    const updated = list.map(r => r.id === id ? { ...r, ...updates } : r);
    setLocal('referees', updated);

    try {
      await updateDoc(doc(db, 'referees', id), {
        ...updates,
        updatedAt: Timestamp.now()
      });
    } catch (e) {
      console.warn("Updated referee locally:", e);
    }

    // Bidirectional sync: if this referee has a user profile (or matching name like عثماني خالد), update the user profile phone as well!
    if (updates.phone || updates.fullName) {
      try {
        const users = await this.getUsers();
        const refName = updates.fullName || targetRef?.fullName || '';
        const matchedUser = users.find(u => 
          u.id === id || 
          (refName && u.fullName && (norm(u.fullName) === norm(refName) || norm(u.fullName).includes(norm(refName)) || norm(refName).includes(norm(u.fullName))))
        );
        if (matchedUser) {
          await this.updateUserProfile(matchedUser.id, {
            ...(updates.phone ? { phone: updates.phone } : {}),
            ...(updates.fullName ? { fullName: updates.fullName } : {})
          });
        }
      } catch (err) {
        console.warn("Error syncing referee update to user profile:", err);
      }
    }
  },

  async deleteReferee(id: string): Promise<void> {
    const list = getLocal<Referee>('referees', []);
    setLocal('referees', list.filter(r => r.id !== id));
    try {
      await deleteDoc(doc(db, 'referees', id));
    } catch (e) {
      console.warn("Deleted referee locally:", e);
    }
  },

  // USERS / TEACHERS
  async getUsers(): Promise<User[]> {
    const activeDirId = this.getActiveDirectorateId();
    const usersMap = new Map<string, User>();

    // 1. Load from local cache first
    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      if (localUsersRaw) {
        const localUsers = JSON.parse(localUsersRaw) as any[];
        localUsers.forEach(u => {
          if (u && (u.id || u.email || u.leaseNumber)) {
            const key = u.id || u.email || u.leaseNumber;
            usersMap.set(key, {
              id: u.id || key,
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
            });
          }
        });
      }
    } catch {}

    // 2. Also check demo user profile
    try {
      const demoRaw = localStorage.getItem('demo_user_profile');
      if (demoRaw) {
        const demo = JSON.parse(demoRaw);
        if (demo && demo.id) {
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

    // 3. Load from Firestore and merge
    try {
      const snap = await getDocs(collection(db, 'users'));
      if (!snap.empty) {
        snap.docs.forEach(d => {
          const data = d.data() as any;
          const docId = d.id;
          // Find existing record by docId or email or leaseNumber
          let matchedKey: string | null = null;
          for (const [k, u] of usersMap.entries()) {
            if (k === docId || u.id === docId || (data.email && u.email?.toLowerCase() === data.email.toLowerCase()) || (data.leaseNumber && u.leaseNumber === data.leaseNumber)) {
              matchedKey = k;
              break;
            }
          }

          if (matchedKey) {
            const existing = usersMap.get(matchedKey)!;
            const merged: User = {
              ...existing,
              ...data,
              id: docId || existing.id,
              role: data.role || existing.role || 'TEACHER',
              fullName: data.fullName || data.name || existing.fullName || 'أستاذ',
              directorateId: data.directorateId || existing.directorateId || activeDirId,
              workLocation: data.workLocation || existing.workLocation || '',
              leaseNumber: data.leaseNumber || existing.leaseNumber || '',
              phone: data.phone || existing.phone || '',
              isTechCommitteeHead: data.isTechCommitteeHead !== undefined ? !!data.isTechCommitteeHead : !!existing.isTechCommitteeHead,
              techCommitteeSports: data.techCommitteeSports !== undefined ? data.techCommitteeSports : (existing.techCommitteeSports || []),
              isTechCommitteeMember: data.isTechCommitteeMember !== undefined ? !!data.isTechCommitteeMember : !!existing.isTechCommitteeMember,
              techCommitteeSportsMemberOf: data.techCommitteeSportsMemberOf !== undefined ? data.techCommitteeSportsMemberOf : (existing.techCommitteeSportsMemberOf || [])
            };
            usersMap.set(docId, merged);
            if (matchedKey !== docId) {
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

    const mergedUsers = Array.from(usersMap.values());
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
    try {
      if (userId) {
        await setDoc(doc(db, 'users', userId), {
          ...fullUserRecord,
          id: userId,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (e) {
      console.warn("Firestore user profile update error:", e);
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
              await updateDoc(doc(db, 'schools', ms.id), {
                teacherName: ms.teacherName,
                phone: ms.phone,
                updatedAt: Timestamp.now()
              }).catch(() => {});
            }
          } catch (e) {
            console.warn("Error syncing teacher phone to schools Firestore:", e);
          }
        }
      }

      // Synchronize changes to Referees list (e.g. Othmani Khalid / عثماني خالد and all teacher referees)
      if (profileData.phone || profileData.fullName || profileData.refereeSpecialty) {
        const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
        const refList = getLocal<Referee>('referees', []);
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
          setLocal('referees', updatedRefList);
          try {
            const matched = updatedRefList.filter(r => {
              const matchId = r.id === userId;
              const matchName = targetName && r.fullName && (norm(r.fullName) === norm(targetName) || norm(r.fullName).includes(norm(targetName)));
              return matchId || matchName;
            });
            for (const mr of matched) {
              await updateDoc(doc(db, 'referees', mr.id), {
                ...(profileData.phone ? { phone: profileData.phone } : {}),
                ...(profileData.fullName ? { fullName: profileData.fullName } : {}),
                updatedAt: Timestamp.now()
              }).catch(() => {});
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
  },

  async deleteAllTeachers(): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    
    // 1. Delete from Firestore
    try {
      // Find all users with role TEACHER in this directorate
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'TEACHER'),
        where('directorateId', '==', activeDirId)
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
      console.error("Error deleting all teachers from Firestore:", e);
    }

    // 2. Delete from Local Storage
    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      if (localUsersRaw) {
        const users = JSON.parse(localUsersRaw) as User[];
        const updated = users.filter(u => 
          !(u.role === 'TEACHER' && (u.directorateId || 'taourirt') === activeDirId)
        );
        localStorage.setItem('local_registered_users', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Local storage delete all teachers error:", e);
    }
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
      fetchedSports = fetchedSports.map(f => {
        const loc = localSports.find(l => l.id === f.id);
        if (loc) {
          return {
            ...f,
            ...loc,
            ageCategories: (loc.ageCategories && loc.ageCategories.length > 0) ? loc.ageCategories : f.ageCategories
          };
        }
        return f;
      });
    }

    const allCategoryIds = getAgeCategoriesForSeason('2026/2027').map(c => c.id);

    // 1. Merge default base sports
    const mergedBase: Sport[] = Object.entries(BASE_SPORTS).map(([id, s]) => {
      const existing = fetchedSports.find(item => item.id === id);
      if (existing) {
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
      
      if (s.customAgeCategories && s.customAgeCategories.length > 0) {
        return {
          ...s,
          ageCategories: rawCats
        };
      }

      const normalizedCats = Array.from(new Set(rawCats.map(c => normalizeCategoryKey(c)))).filter(c => c !== 'OPEN');
      const validCats = normalizedCats.filter(c => ['U12', 'U15', 'U18', 'U20'].includes(c));
      return {
        ...s,
        ageCategories: validCats
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
    return allSports;
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
    // Delete from runtime SPORTS_MAP if custom
    if (SPORTS_MAP[sportId] && !BASE_SPORTS[sportId]) {
      delete SPORTS_MAP[sportId];
    }

    const currentSports = await this.getSportsConfig();
    const updatedSports = currentSports.filter(s => s.id !== sportId);
    setLocal('taourirt_sports_config', updatedSports);

    const customOnly = updatedSports.filter(s => s.isCustom);
    localStorage.setItem('taourirt_custom_sports', JSON.stringify(customOnly.map(s => ({ id: s.id, name: s.name, icon: s.icon || '🏆' }))));

    try {
      await deleteDoc(doc(db, 'sports', sportId));
    } catch (e) {
      console.warn("Deleted custom sport locally, Firestore pending:", e);
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
    customAgeCategories?: CustomAgeCategory[]
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
  async getStudents(): Promise<Student[]> {
    try {
      const snap = await getDocs(collection(db, 'students'));
      if (!snap.empty) {
        const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        const localList = getLocal<Student>('taourirt_students_data', []);
        // Prioritize localList first so newer local updates are not overwritten by stale Firestore fetches
        const merged = deduplicateById([...localList, ...firestoreList]);
        setLocal('taourirt_students_data', merged);
        return merged;
      }
    } catch (e) {
      console.warn("Firestore fetch students error, using local storage:", e);
    }
    const localList = getLocal<Student>('taourirt_students_data', []);
    return deduplicateById(localList);
  },

  subscribeToStudents(callback: (students: Student[]) => void): () => void {
    try {
      const unsubscribe = onSnapshot(collection(db, 'students'), (snap) => {
        if (!snap.empty) {
          const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
          const localList = getLocal<Student>('taourirt_students_data', []);
          // Prioritize localList first so newer local updates are not overwritten by stale Firestore snapshots
          const merged = deduplicateById([...localList, ...firestoreList]);
          setLocal('taourirt_students_data', merged);
          callback(merged);
        } else {
          callback(getLocal<Student>('taourirt_students_data', []));
        }
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
    const newStudent: Student = {
      ...studentWithDir,
      id: `stud-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;

    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', [newStudent, ...localList]);

    try {
      // Safely filter undefined fields so Firestore does not reject the payload
      const firestorePayload: any = {};
      Object.keys(studentWithDir).forEach(key => {
        const val = (studentWithDir as any)[key];
        if (val !== undefined) {
          firestorePayload[key] = val;
        }
      });

      await setDoc(doc(db, 'students', newStudent.id), {
        ...firestorePayload,
        id: newStudent.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Student saved locally; Firestore sync pending:", e);
    }

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
    }

    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', [...createdStudents, ...localList]);

    try {
      const batch = writeBatch(db);
      for (const newStudent of createdStudents) {
        const studentRef = doc(db, 'students', newStudent.id);
        
        // Clean undefined properties
        const cleanPayload: any = {};
        Object.keys(newStudent).forEach(key => {
          const val = (newStudent as any)[key];
          if (val !== undefined) {
            cleanPayload[key] = val;
          }
        });

        batch.set(studentRef, {
          ...cleanPayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      await batch.commit();
    } catch (e) {
      console.warn("Bulk students saved locally; Firestore sync pending:", e);
    }

    return createdStudents;
  },

  async deleteStudent(id: string): Promise<void> {
    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', localList.filter(s => s.id !== id));

    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (e) {
      console.warn("Deleted student locally:", e);
    }
  },

  async updateStudent(id: string, student: Partial<Student>): Promise<void> {
    const localList = getLocal<Student>('taourirt_students_data', []);
    const updated = localList.map(s => s.id === id ? { ...s, ...student, updatedAt: new Date().toISOString() } : s);
    setLocal('taourirt_students_data', updated);

    try {
      // Safely filter undefined fields so Firestore does not reject the update
      const firestorePayload: any = {};
      Object.keys(student).forEach(key => {
        const val = (student as any)[key];
        if (val !== undefined) {
          firestorePayload[key] = val;
        }
      });

      await updateDoc(doc(db, 'students', id), {
        ...firestorePayload,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Updated student locally; Firestore sync pending:", e);
    }
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
      if (!snap.empty) {
        const firestoreList = snap.docs.map(d => ({ id: d.id, ...d.data() } as Directorate));
        return deduplicateById(firestoreList);
      } else {
        // AUTO-SEED: If new database, seed with initial directorates
        console.log("Seeding initial directorates to new Firestore...");
        for (const dir of INITIAL_DIRECTORATES) {
          await this.addDirectorate(dir);
        }
        return INITIAL_DIRECTORATES;
      }
    } catch (e) {
      console.warn("Firestore directorates fetch error, falling back to cache:", e);
    }
    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES);
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

    try {
      await setDoc(doc(db, 'directorates', tempId), {
        ...newDir,
        createdAt: Timestamp.now()
      });
    } catch (e) {
      console.warn("Directorate saved locally; Firestore sync error:", e);
    }

    window.dispatchEvent(new CustomEvent('directoratesListUpdated', { detail: updated }));
    return newDir;
  },

  async updateDirectorate(id: string, updates: Partial<Directorate>): Promise<void> {
    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES);
    const cleanUpdates = {
      ...updates,
      ...(updates.adminEmails ? { adminEmails: updates.adminEmails.map(e => e.trim().toLowerCase()).filter(Boolean) } : {})
    };
    const updated = localList.map(d => d.id === id ? { ...d, ...cleanUpdates } : d);
    setLocal(STORAGE_KEYS.DIRECTORATES, updated);

    try {
      await updateDoc(doc(db, 'directorates', id), {
        ...cleanUpdates,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Directorate updated locally:", e);
    }

    window.dispatchEvent(new CustomEvent('directoratesListUpdated', { detail: updated }));
  },

  async deleteDirectorate(id: string): Promise<void> {
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

      localStorage.setItem(cacheKey, JSON.stringify(resultsMap));
      callback(resultsMap);
    }, (error) => {
      console.warn("Firestore real-time subscription error for cross_country_results:", error);
    });

    return unsubscribe;
  },

  async getCrossCountryResults(): Promise<Record<string, CrossCountryCategoryResult>> {
    const activeDirId = this.getActiveDirectorateId();
    const activeSeason = await this.getActiveSeason();
    const cacheKey = `taourirt_cc_results_${activeDirId}`;
    try {
      const snap = await getDocs(collection(db, 'cross_country_results'));
      if (!snap.empty) {
        const resultsMap: Record<string, CrossCountryCategoryResult> = JSON.parse(JSON.stringify(INITIAL_CROSS_COUNTRY_RESULTS));
        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const docDirId = data.directorateId || (docSnap.id.includes('_') ? docSnap.id.substring(0, docSnap.id.lastIndexOf('_')) : docSnap.id);
          const docSeasonId = data.seasonId || '2026/2027';

          // Only process results for the current active season
          if (docSeasonId !== activeSeason) return;

          if (!activeDirId || activeDirId === 'all' || activeDirId === 'taourirt' || docDirId === activeDirId) {
            const item = this._normalizeCrossCountryDoc(docSnap.id, data, activeDirId);
            const keyToUse = item.categoryId || docSnap.id;
            resultsMap[keyToUse] = item;
          }
        });
        localStorage.setItem(cacheKey, JSON.stringify(resultsMap));
        return resultsMap;
      }
    } catch (e) {
      console.warn("Firestore fetch cross_country_results error, using local storage:", e);
    }

    // Check local storage
    try {
      const local = localStorage.getItem(cacheKey);
      if (local) {
        const parsed = JSON.parse(local);
        return { ...JSON.parse(JSON.stringify(INITIAL_CROSS_COUNTRY_RESULTS)), ...parsed };
      }
    } catch (e) {
      console.error("Local storage error reading cross country results:", e);
    }
    return JSON.parse(JSON.stringify(INITIAL_CROSS_COUNTRY_RESULTS));
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
      if (schoolsSnap && !schoolsSnap.empty) {
        const firestoreSchools = schoolsSnap.docs.map(d => ({ id: d.id, ...d.data() } as School));
        const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
        const merged = deduplicateById([...firestoreSchools, ...localList]);
        setLocal(STORAGE_KEYS.SCHOOLS, merged);
        schoolsCount = merged.length;
      } else {
        const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
        schoolsCount = localList.length;
      }

      let tournamentsCount = 0;
      if (tournamentsSnap && !tournamentsSnap.empty) {
        const firestoreTournaments = tournamentsSnap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate,
            endDate: data.endDate?.toDate ? data.endDate.toDate() : data.endDate,
            registrationDeadline: data.registrationDeadline?.toDate ? data.registrationDeadline.toDate() : data.registrationDeadline,
          } as Tournament;
        });
        const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
        const merged = deduplicateById([...firestoreTournaments, ...localList]);
        setLocal(STORAGE_KEYS.TOURNAMENTS, merged);
        tournamentsCount = merged.length;
      } else {
        const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
        tournamentsCount = localList.length;
      }

      let studentsCount = 0;
      if (studentsSnap && !studentsSnap.empty) {
        const firestoreStudents = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Student));
        const localList = getLocal<Student>('taourirt_students_data', []);
        const merged = deduplicateById([...localList, ...firestoreStudents]);
        setLocal('taourirt_students_data', merged);
        studentsCount = merged.length;
      } else {
        const localList = getLocal<Student>('taourirt_students_data', []);
        studentsCount = localList.length;
      }

      let matchesCount = 0;
      if (matchesSnap && !matchesSnap.empty) {
        const firestoreMatches = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
        const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
        const merged = deduplicateById([...firestoreMatches, ...localList]);
        setLocal(STORAGE_KEYS.MATCHES, merged);
        matchesCount = merged.length;
      } else {
        const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, INITIAL_MATCHES);
        matchesCount = localList.length;
      }

      let venuesCount = 0;
      if (venuesSnap && !venuesSnap.empty) {
        const firestoreVenues = venuesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Venue));
        const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
        const merged = deduplicateById([...firestoreVenues, ...localList]);
        setLocal(STORAGE_KEYS.VENUES, merged);
        venuesCount = merged.length;
      }

      let refereesCount = 0;
      if (refereesSnap && !refereesSnap.empty) {
        const firestoreReferees = refereesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Referee));
        const localList = getLocal<Referee>('taourirt_referees_data', []);
        const merged = deduplicateById([...firestoreReferees, ...localList]);
        setLocal('taourirt_referees_data', merged);
        refereesCount = merged.length;
      }

      let directoratesCount = 0;
      if (directoratesSnap && !directoratesSnap.empty) {
        const firestoreDirs = directoratesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Directorate));
        const localList = getLocal<Directorate>('app_directorates_data', INITIAL_DIRECTORATES);
        const merged = deduplicateById([...firestoreDirs, ...localList]);
        setLocal('app_directorates_data', merged);
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
  }
};

