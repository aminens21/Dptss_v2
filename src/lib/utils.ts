import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMatchDate(dateVal: any): string {
  if (!dateVal) return '--';
  let d: Date;

  try {
    if (typeof dateVal === 'string') {
      const match = dateVal.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10);
        const day = parseInt(match[3], 10);
        d = new Date(year, month - 1, day);
      } else {
        d = new Date(dateVal);
      }
    } else if (dateVal && typeof dateVal === 'object') {
      if (typeof dateVal.toDate === 'function') {
        d = dateVal.toDate();
      } else if (dateVal.seconds !== undefined) {
        d = new Date(dateVal.seconds * 1000);
      } else if (dateVal instanceof Date) {
        d = dateVal;
      } else {
        d = new Date(dateVal);
      }
    } else {
      d = new Date(dateVal);
    }

    if (isNaN(d.getTime())) {
      return String(dateVal);
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  } catch (error) {
    return String(dateVal);
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

/**
 * Auto-detects and repairs jumbled teacher profile fields (e.g. if school was saved as email or lease number as phone).
 */
export function fixTeacherFieldJumble(user: any): any {
  if (!user || typeof user !== 'object') return user;

  const name = String(user.fullName || user.name || '').trim();
  let email = String(user.email || '').trim().toLowerCase();
  let workLocation = String(user.workLocation || '').trim();
  let leaseNumber = String(user.leaseNumber || '').trim();
  let phone = String(user.phone || '').trim();
  let rawCadre = String(user.teachingCadre || user.cadre || '').trim();

  // Helper to check if string looks like a Moroccan phone number (e.g. 0697590490, 0666742835, +2126...)
  function isPhoneLike(v: string) {
    if (!v) return false;
    const clean = v.replace(/[\s\-\.\(\)]/g, '');
    return /^(06|07|05|08|\+212|212)\d{8,10}$/.test(clean) || (clean.length === 10 && clean.startsWith('0') && !clean.startsWith('00'));
  }

  // Helper to check if string looks like a SOM/PPR lease number (e.g. 1280856, 1176420, FB93905)
  function isLeaseLike(v: string) {
    if (!v) return false;
    const clean = v.trim();
    if (clean.includes('@')) return false;
    if (isPhoneLike(clean)) return false;
    // SOM / PPR: numeric (5-8 digits) or alpha+numeric code (e.g. FB93905, Fb65233)
    return /^[a-zA-Z]{0,3}\d{4,8}$/.test(clean);
  }

  // Gather all available values
  const values = [email, workLocation, leaseNumber, phone, rawCadre].map(f => String(f || '').trim()).filter(Boolean);

  // 1. Detect Real Email
  const realEmail = values.find(v => v.includes('@') || v.includes('gmail') || v.includes('hotmail') || v.includes('yahoo') || v.endsWith('.com') || v.endsWith('.fr') || v.endsWith('.ma'));

  // 2. Detect Real Phone
  const realPhone = values.find(v => v !== realEmail && isPhoneLike(v));

  // 3. Detect Real Lease Number
  const realLease = values.find(v => v !== realEmail && v !== realPhone && isLeaseLike(v));

  // 4. Detect Real School Location: text containing school terms or Arabic text
  const realSchool = values.find(v => v !== realEmail && v !== realPhone && v !== realLease && (
    v.includes('اع') || v.includes('ث') || v.includes('مدرسة') || v.includes('إعداد') || v.includes('تأهيل') || v.includes('ابتدائ') || v.includes('مؤسس') || v.includes('ثانوية') || /[\u0600-\u06FF]/.test(v)
  ));

  // 5. Detect Real Cadre
  let teachingCadre = user.teachingCadre || 'HIGH';
  const cadreText = (rawCadre + ' ' + workLocation).toLowerCase();
  if (cadreText.includes('ابتدائ') || cadreText.includes('primary')) teachingCadre = 'PRIMARY';
  else if (cadreText.includes('إعداد') || cadreText.includes('اعداد') || cadreText.includes('middle')) teachingCadre = 'MIDDLE';

  // Strict field assignment:
  // - If phone is not phone-like and realPhone exists, use realPhone; if not, clear it so lease number won't pollute phone field
  const finalPhone = realPhone || (isPhoneLike(phone) ? phone : '');
  // - If leaseNumber is not lease-like and realLease exists, use realLease; if not, clear it
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

