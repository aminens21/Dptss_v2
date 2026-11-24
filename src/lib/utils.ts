import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function normalizeDateToYmd(dateVal: any): string {
  if (!dateVal) return '';
  try {
    if (typeof dateVal === 'string') {
      const trimmed = dateVal.trim();
      if (!trimmed) return '';
      const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
      }
      const dmyMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      if (dmyMatch) {
        return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
      }
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return '';
    }

    let d: Date | null = null;
    if (typeof dateVal === 'object') {
      if (typeof dateVal.toDate === 'function') {
        d = dateVal.toDate();
      } else if (typeof dateVal.seconds === 'number') {
        d = new Date(dateVal.seconds * 1000);
      } else if (typeof dateVal._seconds === 'number') {
        d = new Date(dateVal._seconds * 1000);
      } else if (dateVal instanceof Date) {
        d = dateVal;
      }
    } else if (typeof dateVal === 'number') {
      d = new Date(dateVal);
    }

    if (d && !isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
    return '';
  } catch {
    return '';
  }
}

export function parseDateToTimestampMs(dateVal: any): number {
  const ymd = normalizeDateToYmd(dateVal);
  if (!ymd) return 0;
  const t = new Date(ymd).getTime();
  return isNaN(t) ? 0 : t;
}

export function formatMatchDate(dateVal: any): string {
  if (!dateVal) return '--';
  let d: Date;

  try {
    const ymd = normalizeDateToYmd(dateVal);
    if (ymd) {
      const [yearStr, monthStr, dayStr] = ymd.split('-');
      return `${dayStr}/${monthStr}/${yearStr}`;
    }

    if (typeof dateVal === 'string') {
      d = new Date(dateVal);
    } else if (dateVal && typeof dateVal === 'object') {
      if (typeof dateVal.toDate === 'function') {
        d = dateVal.toDate();
      } else if (typeof dateVal.seconds === 'number') {
        d = new Date(dateVal.seconds * 1000);
      } else if (typeof dateVal._seconds === 'number') {
        d = new Date(dateVal._seconds * 1000);
      } else if (dateVal instanceof Date) {
        d = dateVal;
      } else {
        return '--';
      }
    } else {
      d = new Date(dateVal);
    }

    if (isNaN(d.getTime())) {
      return '--';
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return '--';
  }
}

/**
 * Flexible & typo-tolerant email comparison function.
 * Matches exact emails, handles Gmail dots/hyphens, handle truncation (e.g. physical.educatio vs physical.education),
 * and small typos.
 */
export function isFlexibleEmailMatch(email1?: string, email2?: string): boolean {
  if (!email1 || !email2) return false;

  const e1 = email1.trim().toLowerCase();
  const e2 = email2.trim().toLowerCase();

  if (e1 === e2) return true;

  const parts1 = e1.split('@');
  const parts2 = e2.split('@');

  const h1 = parts1[0].replace(/[\.\_\-\s]/g, '');
  const h2 = parts2[0].replace(/[\.\_\-\s]/g, '');

  if (!h1 || !h2) return false;

  // Direct handle match ignoring dots and hyphens
  if (h1 === h2) return true;

  // Domain match check (if both have domains, domains must match or be gmail/googlemail)
  const d1 = (parts1[1] || 'gmail.com').replace('googlemail.com', 'gmail.com');
  const d2 = (parts2[1] || 'gmail.com').replace('googlemail.com', 'gmail.com');
  if (d1 !== d2) return false;

  // Handle truncation (e.g. physical.educatio vs physical.education)
  if (h1.length >= 6 && h2.length >= 6) {
    if (h1.startsWith(h2) || h2.startsWith(h1)) {
      if (Math.abs(h1.length - h2.length) <= 3) {
        return true;
      }
    }

    // Edit distance check for small typos (distance <= 2)
    const len1 = h1.length;
    const len2 = h2.length;
    if (Math.abs(len1 - len2) <= 2) {
      const matrix: number[][] = [];
      for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
      }
      for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
          if (h1[i - 1] === h2[j - 1]) {
            matrix[i][j] = matrix[i - 1][j - 1];
          } else {
            matrix[i][j] = Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1
            );
          }
        }
      }
      if (matrix[len1][len2] <= 2) return true;
    }
  }

  return false;
}

export function formatMoroccanPhone(val: any): string {
  if (val === undefined || val === null || val === '') return '';
  let str = String(val).replace(/[\s\-\.\(\)]/g, '').trim();
  if (!str || str.includes('@')) return '';

  // If starts with 212 or +212 e.g. +212697590490 -> 0697590490
  if (/^\+?212/.test(str)) {
    str = '0' + str.replace(/^\+?212/, '');
  }

  // If 9 digits starting with 5, 6, 7, 8 (Excel stripped leading 0 when stored as numeric)
  if (/^[5678]\d{8}$/.test(str)) {
    return '0' + str;
  }

  // If 10 digits starting with 05, 06, 07, 08
  if (/^0[5678]\d{8}$/.test(str)) {
    return str;
  }

  if (/^\d{9,10}$/.test(str)) {
    return str.startsWith('0') ? str : '0' + str;
  }

  return str;
}

export function isPhoneLike(val: any): boolean {
  if (val === undefined || val === null || val === '') return false;
  const str = String(val).replace(/[\s\-\.\(\)]/g, '').trim();
  if (!str || str.includes('@')) return false;

  // 9 digits starting with 5,6,7,8 (Excel stripped zero)
  if (/^[5678]\d{8}$/.test(str)) return true;
  // 10 digits starting with 05, 06, 07, 08
  if (/^0[5678]\d{8}$/.test(str)) return true;
  // Starts with +212 or 212
  if (/^\+?212[5678]\d{8}$/.test(str)) return true;
  // General 10 digits starting with 0
  if (str.length === 10 && str.startsWith('0') && !str.startsWith('00')) return true;

  return false;
}

/**
 * Identifies Amine Sanoussi (aminens21@gmail.com / أمين سنوسي / amine sanoussi),
 * who is strictly a Central Admin and Educational Inspector (مفتش تربوي), never a school PE teacher.
 */
export function isAmineSanoussiIdentity(
  userOrInput?: string | { email?: string; fullName?: string; name?: string } | null
): boolean {
  if (!userOrInput) return false;
  if (typeof userOrInput === 'string') {
    const trimmed = userOrInput.trim();
    if (!trimmed) return false;
    if (isFlexibleEmailMatch(trimmed, 'aminens21@gmail.com')) return true;
    const normStr = trimmed
      .toLowerCase()
      .replace(/[أإآا]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\s\-_.]+/g, '');
    return (
      normStr === 'امينسنوسي' ||
      normStr === 'المفتشامينسنوسي' ||
      normStr === 'aminesanoussi' ||
      normStr === 'aminsanoussi' ||
      normStr === 'sanoussiamine'
    );
  }

  const cleanEmail = String(userOrInput.email || '').trim().toLowerCase();
  if (cleanEmail && isFlexibleEmailMatch(cleanEmail, 'aminens21@gmail.com')) {
    return true;
  }

  const rawName = String(userOrInput.fullName || userOrInput.name || '').trim();
  if (!rawName) return false;
  const normName = rawName
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_.]+/g, '');

  const isNameMatch =
    normName === 'امينسنوسي' ||
    normName === 'المفتشامينسنوسي' ||
    normName === 'aminesanoussi' ||
    normName === 'aminsanoussi' ||
    normName === 'sanoussiamine';

  return isNameMatch && (!cleanEmail || !cleanEmail.includes('@') || isFlexibleEmailMatch(cleanEmail, 'aminens21@gmail.com'));
}

/**
 * Enforces canonical Central Admin + Educational Inspector metadata for Amine Sanoussi
 * and clears any mistakenly attached school/teacher fields (such as الثانوية التأهيلية الفتح).
 */
export function normalizeCentralAdminUser<T extends Record<string, any>>(user: T): T {
  if (!user || typeof user !== 'object') return user;
  if (!isAmineSanoussiIdentity(user)) return user;

  const rawName = String(user.fullName || user.name || '').trim();
  const isGenericOrLatinName =
    !rawName ||
    rawName === 'أستاذ' ||
    rawName === 'أستاذ(ة)' ||
    rawName === 'مستخدم' ||
    rawName === 'المسير المركزي الرئيسي' ||
    rawName === 'المسؤول المركزي (المشرف العام)' ||
    /^(amine\s+sanoussi|amin\s+sanoussi|sanoussi\s+amine)$/i.test(rawName);

  return {
    ...user,
    fullName: isGenericOrLatinName ? 'أمين سنوسي' : rawName,
    email: 'aminens21@gmail.com',
    role: 'CENTRAL_ADMIN',
    isSuperAdmin: true,
    cadre: 'مفتش تربوي',
    workLocation: '',
    schoolId: '',
    teachingCadre: '',
    schoolAccessVerified: true,
    isActive: user.isActive !== false
  };
}

/**
 * Auto-detects and repairs jumbled teacher profile fields (e.g. if school was saved as email or lease number as phone).
 */
export function fixTeacherFieldJumble(user: any): any {
  if (!user || typeof user !== 'object') return user;
  if (isAmineSanoussiIdentity(user)) {
    return normalizeCentralAdminUser(user);
  }

  const name = String(user.fullName || user.name || '').trim();
  let email = String(user.email || '').trim().toLowerCase();
  let workLocation = String(user.workLocation || '').trim();
  let leaseNumber = String(user.leaseNumber || '').trim();
  let rawPhone = user.phone;
  let rawCadre = String(user.teachingCadre || user.cadre || '').trim();

  const normalizeDigits = (v: string) =>
    v.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\.0$/, '').trim();

  leaseNumber = normalizeDigits(leaseNumber).replace(/^(?:som|ppr)\s*[:\-]?\s*/i, '').trim();

  // Helper to check if string looks like a SOM/PPR lease number (e.g. 1280856, 1982424, FB93905)
  function isLeaseLike(v: string) {
    if (!v) return false;
    const clean = normalizeDigits(String(v)).replace(/\s+/g, '');
    if (!clean || clean.includes('@')) return false;
    if (isPhoneLike(clean)) return false;
    // SOM / PPR: numeric (4-10 digits) or alpha+numeric code (e.g. FB93905, Fb65233)
    return /^[a-zA-Z]{0,4}\d{4,10}$/.test(clean);
  }

  // Gather all available values
  const values = [email, workLocation, leaseNumber, rawPhone, rawCadre]
    .map(f => (f !== undefined && f !== null ? String(f).trim() : ''))
    .filter(Boolean);

  // 1. Detect Real Email (prefer explicit email field if already valid)
  const isEmailLike = (v: string) =>
    v.includes('@') || v.includes('gmail') || v.includes('hotmail') || v.includes('yahoo') || v.endsWith('.com') || v.endsWith('.fr') || v.endsWith('.ma');
  const realEmail = (email && isEmailLike(email) ? email : '') || values.find(isEmailLike);

  // 2. Detect Real Phone (prefer explicit rawPhone if already phone-like)
  const rawPhoneStr = rawPhone !== undefined && rawPhone !== null ? String(rawPhone).trim() : '';
  const rawPhoneFound =
    (rawPhoneStr && rawPhoneStr !== realEmail && isPhoneLike(rawPhoneStr) ? rawPhoneStr : '') ||
    values.find(v => v !== realEmail && isPhoneLike(v));
  const realPhone = rawPhoneFound ? formatMoroccanPhone(rawPhoneFound) : '';

  // 3. Detect Real Lease Number (prefer explicit leaseNumber if already lease-like)
  const realLeaseRaw =
    (leaseNumber && leaseNumber !== realEmail && leaseNumber !== rawPhoneFound && isLeaseLike(leaseNumber) ? leaseNumber : '') ||
    values.find(v => v !== realEmail && v !== rawPhoneFound && isLeaseLike(v));
  const realLease = realLeaseRaw ? normalizeDigits(realLeaseRaw).replace(/\s+/g, '') : '';

  // 4. Detect Real School Location: prefer explicit workLocation if school-like/Arabic and not email/phone/lease
  const isSchoolText = (v: string) =>
    Boolean(v) &&
    v !== realEmail &&
    v !== rawPhoneFound &&
    v !== realLeaseRaw &&
    !isPhoneLike(v) &&
    !isLeaseLike(v) &&
    (v.includes('اع') || v.includes('ث') || v.includes('مدرسة') || v.includes('مدرسه') || v.includes('م.م') || v.includes('مجموع') || v.includes('إعداد') || v.includes('تأهيل') || v.includes('ابتدائ') || v.includes('مؤسس') || v.includes('ثانوية') || /[\u0600-\u06FF]/.test(v));
  const realSchool = (isSchoolText(workLocation) ? workLocation : '') || values.find(isSchoolText);

  // 5. Detect Real Cadre cleanly without falsely forcing HIGH on unknown/Primary teachers
  const normOrigCadre = String(user.teachingCadre || '').trim().toUpperCase();
  let teachingCadre = (normOrigCadre === 'PRIMARY' || normOrigCadre === 'MIDDLE' || normOrigCadre === 'HIGH') ? normOrigCadre : '';
  const detectedSchool = realSchool || workLocation || '';
  const cadreText = (rawCadre + ' ' + detectedSchool)
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه');
  const trimmedSchool = detectedSchool
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه');

  if (
    cadreText.includes('ابتدائ') ||
    cadreText.includes('primary') ||
    cadreText.includes('م.م') ||
    cadreText.includes('م م') ||
    cadreText.includes('مجموعه مدارس') ||
    cadreText.includes('مدرسه جماعاتيه') ||
    cadreText.includes('فرعيه') ||
    /^مدرسه\s/.test(trimmedSchool)
  ) {
    teachingCadre = 'PRIMARY';
  } else if (cadreText.includes('اعداد') || cadreText.includes('middle')) {
    teachingCadre = 'MIDDLE';
  } else if (
    cadreText.includes('تاهيل') ||
    cadreText.includes('ثانويه') ||
    cadreText.includes('high') ||
    cadreText.includes('secondary') ||
    (cadreText.includes('ثانوي') && !cadreText.includes('اعداد'))
  ) {
    teachingCadre = 'HIGH';
  }

  // Strict field assignment:
  const formattedOrigPhone = formatMoroccanPhone(rawPhone);
  const finalPhone = realPhone || (isPhoneLike(formattedOrigPhone) ? formattedOrigPhone : '');
  const finalLease = realLease || (isLeaseLike(leaseNumber) ? leaseNumber : '');

  return {
    ...user,
    fullName: name || user.fullName || 'أستاذ',
    email: realEmail || (email.includes('@') ? email : ''),
    workLocation: realSchool || (workLocation && !isPhoneLike(workLocation) && !isLeaseLike(workLocation) ? workLocation : ''),
    leaseNumber: finalLease,
    phone: finalPhone,
    ...(teachingCadre ? { teachingCadre } : { teachingCadre: user.teachingCadre || '' })
  };
}

export function normalizeArabicName(name: string): string {
  if (!name) return '';
  return name
    .trim()
    .toLowerCase()
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_]+/g, '');
}

export function normalizeArabicSearch(text: string): string {
  if (!text) return '';
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // strip Arabic diacritics & tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ');
}

