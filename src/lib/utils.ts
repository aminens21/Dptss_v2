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
 * Auto-detects and repairs jumbled teacher profile fields (e.g. if school was saved as email or lease number as phone).
 */
export function fixTeacherFieldJumble(user: any): any {
  if (!user || typeof user !== 'object') return user;

  const name = String(user.fullName || user.name || '').trim();
  let email = String(user.email || '').trim().toLowerCase();
  let workLocation = String(user.workLocation || '').trim();
  let leaseNumber = String(user.leaseNumber || '').trim();
  let rawPhone = user.phone;
  let rawCadre = String(user.teachingCadre || user.cadre || '').trim();

  // Helper to check if string looks like a SOM/PPR lease number (e.g. 1280856, 1176420, FB93905)
  function isLeaseLike(v: string) {
    if (!v) return false;
    const clean = String(v).trim();
    if (clean.includes('@')) return false;
    if (isPhoneLike(clean)) return false;
    // SOM / PPR: numeric (5-8 digits) or alpha+numeric code (e.g. FB93905, Fb65233)
    return /^[a-zA-Z]{0,3}\d{4,8}$/.test(clean);
  }

  // Gather all available values
  const values = [email, workLocation, leaseNumber, rawPhone, rawCadre]
    .map(f => (f !== undefined && f !== null ? String(f).trim() : ''))
    .filter(Boolean);

  // 1. Detect Real Email
  const realEmail = values.find(v => v.includes('@') || v.includes('gmail') || v.includes('hotmail') || v.includes('yahoo') || v.endsWith('.com') || v.endsWith('.fr') || v.endsWith('.ma'));

  // 2. Detect Real Phone
  const rawPhoneFound = values.find(v => v !== realEmail && isPhoneLike(v));
  const realPhone = rawPhoneFound ? formatMoroccanPhone(rawPhoneFound) : '';

  // 3. Detect Real Lease Number
  const realLease = values.find(v => v !== realEmail && v !== rawPhoneFound && isLeaseLike(v));

  // 4. Detect Real School Location: text containing school terms or Arabic text
  const realSchool = values.find(v => v !== realEmail && v !== rawPhoneFound && v !== realLease && (
    v.includes('اع') || v.includes('ث') || v.includes('مدرسة') || v.includes('إعداد') || v.includes('تأهيل') || v.includes('ابتدائ') || v.includes('مؤسس') || v.includes('ثانوية') || /[\u0600-\u06FF]/.test(v)
  ));

  // 5. Detect Real Cadre
  let teachingCadre = user.teachingCadre || 'HIGH';
  const cadreText = (rawCadre + ' ' + workLocation).toLowerCase();
  if (cadreText.includes('ابتدائ') || cadreText.includes('primary')) teachingCadre = 'PRIMARY';
  else if (cadreText.includes('إعداد') || cadreText.includes('اعداد') || cadreText.includes('middle')) teachingCadre = 'MIDDLE';

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
    teachingCadre
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

