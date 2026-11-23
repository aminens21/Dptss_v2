import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import {
  School,
  Student,
  User,
  SchoolTournamentConfirmation,
  SUPER_ADMIN_EMAILS
} from '../types';
import {
  SPORTS_MAP,
  areSportIdsEquivalent,
  getEffectiveConfirmedBranches,
  normalizeCategoryKey,
  resolveSchoolCoach,
  schoolNamesMatch,
  normalizeArabicMatchText,
  isTrackOrCrossCountrySport
} from './dataService';
import { prepareFontEmbedCss } from './fontExportHelper';

export interface ParticipationTableRow {
  schoolName: string;
  categoriesLabel: string;
}

export interface TournamentTablePdfOptions {
  /** Text displayed in RED bold inside the top banner after "المؤسسات المشاركة في بطولة " */
  redTitle: string;
  /** Optional small subtitle below the banner */
  subtitle?: string;
  rows: ParticipationTableRow[];
  filename?: string;
}

function escapeHtml(text: string): string {
  return String(text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Checks whether the current user is allowed to download the institutional participation table PDF:
 * - Central Admin / Super Admin / Provincial Admin: ALL sports
 * - Technical Committee Head / Sport Manager: ONLY their assigned sport(s)
 * - Others (ordinary Teacher, Referee): false
 */
export function canUserDownloadTournamentTablePdf(
  userProfile: User | null | undefined,
  sportId: string,
  sportsList?: any[]
): boolean {
  if (!userProfile) return false;
  const cleanEmail = (userProfile.email || '').trim().toLowerCase();
  const roleStr = String(userProfile.role || '');

  const isCentralOrSuper =
    roleStr === 'CENTRAL_ADMIN' ||
    roleStr === 'SUPER_ADMIN' ||
    roleStr === 'PROVINCIAL_ADMIN' ||
    userProfile.isSuperAdmin === true ||
    SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail);

  if (isCentralOrSuper) return true;

  const isTechHead =
    !!userProfile.isTechCommitteeHead ||
    roleStr === 'TECH_HEAD' ||
    roleStr === 'TECH_COMMITTEE_HEAD' ||
    roleStr === 'SPORT_MANAGER';

  if (!isTechHead) return false;

  const assignedSports: string[] = [];
  if (Array.isArray(userProfile.techCommitteeSports)) {
    assignedSports.push(...userProfile.techCommitteeSports);
  }
  if (userProfile.sportId) {
    assignedSports.push(userProfile.sportId);
  }

  return assignedSports.some(assigned =>
    areSportIdsEquivalent(assigned, sportId, sportsList)
  );
}

/**
 * Formats a concise gender-category badge such as "الفتيان (U18)" or "الصغيرات (U15)"
 * matching the official table format requested by the user.
 */
export function formatCompactCategoryGender(
  category: string,
  gender: 'Male' | 'Female',
  sportId?: string
): string {
  const norm = normalizeCategoryKey(category);
  const isFem = gender === 'Female';
  const isCC = isTrackOrCrossCountrySport(sportId);

  if (isCC) {
    if (norm === 'U12') return isFem ? 'البرعمات' : 'البراعم';
    if (norm === 'U15') return isFem ? 'الصغيرات' : 'الصغار';
    if (norm === 'U18') return isFem ? 'الفتيات' : 'الفتيان';
    if (norm === 'U20') return isFem ? 'الشابات' : 'الشبان';
  } else {
    if (norm === 'U12') return isFem ? 'U12 إناث' : 'U12 ذكور';
    if (norm === 'U15') return isFem ? 'U15 إناث' : 'U15 ذكور';
    if (norm === 'U17') return isFem ? 'U17 إناث' : 'U17 ذكور';
    if (norm === 'U18') return isFem ? 'U18 إناث' : 'U18 ذكور';
    if (norm === 'U20') return isFem ? '2009 وما بعد إناث' : '2009 وما بعد ذكور';
  }
  return isFem ? `${norm} إناث` : `${norm} ذكور`;
}

/**
 * Builds canonical deduplicated school rows for a sport (or specific branch filter)
 * from both registered students and confirmed Phase-1 school participations.
 */
export function buildParticipationTableRows(params: {
  sportId: string;
  students: Student[];
  schools: School[];
  teachers: User[];
  confirmations: SchoolTournamentConfirmation[];
  currentUser?: User | null;
  affiliationType?: string; // 'ALL' | 'non_club' | 'club_affiliated' | 'open'
  ageCategory?: string;     // 'ALL' | 'U12' | 'U15' | 'U18' | 'U20'
  gender?: string;          // 'ALL' | 'Both' | 'Mixed' | 'Male' | 'Female'
  isSchoolWithdrawnFn?: (schoolId: string | undefined, schoolName: string, b?: { category?: string; gender?: string; affiliationType?: string }) => boolean;
}): ParticipationTableRow[] {
  const {
    sportId,
    students,
    schools,
    teachers,
    confirmations,
    currentUser,
    affiliationType = 'ALL',
    ageCategory = 'ALL',
    gender = 'ALL',
    isSchoolWithdrawnFn
  } = params;

  const targetAff = affiliationType && affiliationType !== 'ALL' ? affiliationType : 'ALL';
  const targetCat = ageCategory && ageCategory !== 'ALL' ? normalizeCategoryKey(ageCategory) : 'ALL';
  const targetGen = gender && gender !== 'ALL' && gender !== 'Both' && gender !== 'Mixed' ? gender : 'ALL';

  const catOrder = ['U12', 'U15', 'U17', 'U18', 'U20', 'OPEN'];

  const resolveSchoolMeta = (rawSchoolId?: string, rawSchoolName?: string) => {
    const matched = schools.find(
      s => (rawSchoolId && s.id === rawSchoolId) || (rawSchoolName && schoolNamesMatch(s.name, rawSchoolName))
    );
    if (matched) {
      return { key: `id:${matched.id}`, id: matched.id, name: matched.name };
    }
    const cleanName = (rawSchoolName || '').trim();
    const norm = normalizeArabicMatchText(cleanName);
    return {
      key: norm ? `name:${norm}` : `id:${(rawSchoolId || '').trim().toLowerCase()}`,
      id: rawSchoolId,
      name: cleanName
    };
  };

  interface Bucket {
    schoolId?: string;
    schoolName: string;
    branches: Map<string, { category: string; gender: 'Male' | 'Female'; affiliationType: string; label: string }>;
    studentsInBucket: Student[];
    conf?: SchoolTournamentConfirmation;
  }

  const buckets = new Map<string, Bucket>();

  // 1. Collect from students
  students
    .filter(st => {
      if (!st || st.sportId !== sportId) return false;
      const sAff = st.affiliationType || 'non_club';
      const sCat = normalizeCategoryKey(st.category || 'U15');
      const sGen: 'Male' | 'Female' = st.gender === 'Female' ? 'Female' : 'Male';
      if (targetAff !== 'ALL' && sAff !== targetAff) return false;
      if (targetCat !== 'ALL' && sCat !== targetCat) return false;
      if (targetGen !== 'ALL' && sGen.toLowerCase() !== targetGen.toLowerCase()) return false;
      if (isSchoolWithdrawnFn && isSchoolWithdrawnFn(st.schoolId, st.schoolName || '', { category: sCat, gender: sGen, affiliationType: sAff })) {
        return false;
      }
      return Boolean(st.schoolName && st.schoolName.trim());
    })
    .forEach(st => {
      const meta = resolveSchoolMeta(st.schoolId, st.schoolName);
      if (!meta.key || !meta.name) return;
      if (!buckets.has(meta.key)) {
        buckets.set(meta.key, {
          schoolId: meta.id,
          schoolName: meta.name,
          branches: new Map(),
          studentsInBucket: []
        });
      }
      const b = buckets.get(meta.key)!;
      b.studentsInBucket.push(st);
      const sCat = normalizeCategoryKey(st.category || 'U15');
      const sGen: 'Male' | 'Female' = st.gender === 'Female' ? 'Female' : 'Male';
      const sAff = st.affiliationType || 'non_club';
      const bKey = `${sCat}__${sGen}`;
      if (!b.branches.has(bKey)) {
        b.branches.set(bKey, {
          category: sCat,
          gender: sGen,
          affiliationType: sAff,
          label: formatCompactCategoryGender(sCat, sGen, sportId)
        });
      }
    });

  // 2. Merge confirmed schools from Phase 1
  confirmations
    .filter(c => c && c.sportId === sportId && c.status === 'confirmed' && c.schoolName)
    .forEach(conf => {
      const branches = getEffectiveConfirmedBranches(conf, true).filter(br => {
        if (targetAff !== 'ALL' && br.affiliationType !== targetAff) return false;
        if (targetCat !== 'ALL' && normalizeCategoryKey(br.category) !== targetCat) return false;
        if (targetGen !== 'ALL' && br.gender.toLowerCase() !== targetGen.toLowerCase()) return false;
        if (isSchoolWithdrawnFn && isSchoolWithdrawnFn(conf.schoolId, conf.schoolName, br)) {
          return false;
        }
        return true;
      });
      if (branches.length === 0) return;

      const meta = resolveSchoolMeta(conf.schoolId, conf.schoolName);
      if (!meta.key || !meta.name) return;
      if (!buckets.has(meta.key)) {
        buckets.set(meta.key, {
          schoolId: meta.id,
          schoolName: meta.name,
          branches: new Map(),
          studentsInBucket: [],
          conf
        });
      } else {
        buckets.get(meta.key)!.conf = conf;
      }
      const b = buckets.get(meta.key)!;
      branches.forEach(br => {
        const normCat = normalizeCategoryKey(br.category);
        const bKey = `${normCat}__${br.gender}`;
        if (!b.branches.has(bKey)) {
          b.branches.set(bKey, {
            category: normCat,
            gender: br.gender,
            affiliationType: br.affiliationType,
            label: formatCompactCategoryGender(normCat, br.gender, sportId)
          });
        }
      });
    });

  // Convert buckets into sorted rows
  const rows: ParticipationTableRow[] = Array.from(buckets.values())
    .filter(b => b.branches.size > 0)
    .map(b => {
      const sortedBranches = Array.from(b.branches.values()).sort((x, y) => {
        const cx = catOrder.indexOf(x.category);
        const cy = catOrder.indexOf(y.category);
        const diff = (cx === -1 ? 99 : cx) - (cy === -1 ? 99 : cy);
        if (diff !== 0) return diff;
        return x.gender === 'Male' ? -1 : 1;
      });

      const firstBranch = sortedBranches[0];
      return {
        schoolName: b.schoolName,
        categoriesLabel: sortedBranches.map(br => br.label).join(' • ')
      };
    })
    .sort((a, b) => a.schoolName.localeCompare(b.schoolName, 'ar'));

  return rows;
}

function buildTablePageHtml(
  redTitle: string,
  subtitle: string | undefined,
  rowsSlice: Array<ParticipationTableRow & { seq: number }>,
  pageIndex: number,
  totalPages: number,
  fontCss: string
): string {
  const rowsHtml = rowsSlice.length === 0
    ? `
      <tr>
        <td colspan="3" style="border: 1.5px solid #000; padding: 24px 12px; text-align: center; font-weight: 700; color: #475569; font-size: 16px;">
          لا توجد مؤسسات مشاركة مسجلة حالياً في هذه البطولة
        </td>
      </tr>
    `
    : rowsSlice.map(r => `
      <tr>
        <td style="border: 1.5px solid #000; padding: 9px 10px; text-align: center; font-weight: 700; font-size: 15px; color: #000; background: #fff; width: 62px;">
          ${r.seq}
        </td>
        <td style="border: 1.5px solid #000; padding: 9px 14px; text-align: center; font-weight: 700; font-size: 15px; color: #000; background: #fff; width: 42%;">
          ${escapeHtml(r.schoolName)}
        </td>
        <td style="border: 1.5px solid #000; padding: 9px 12px; text-align: center; font-weight: 700; font-size: 14.5px; color: #000; background: #fff;">
          ${escapeHtml(r.categoriesLabel)}
        </td>
      </tr>
    `).join('');

  return `
    <div dir="rtl" lang="ar" style="width: 1080px; background: #ffffff; padding: 28px 30px; box-sizing: border-box; font-family: 'Cairo', 'Tajawal', Arial, sans-serif; color: #000;">
      <style>${fontCss}</style>

      <!-- Header banner matching user's exact visual template -->
      <div style="background: #d9d9d9; border: 2px solid #000000; padding: 11px 18px; text-align: center; margin-bottom: 14px;">
        <div style="font-size: 20px; font-weight: 900; line-height: 1.5;">
          <span style="color: #000000;">المؤسسات المشاركة في بطولة </span>
          <span style="color: #dc2626;">${escapeHtml(redTitle)}</span>
        </div>
        ${subtitle ? `<div style="font-size: 12px; font-weight: 700; color: #334155; margin-top: 2px;">${escapeHtml(subtitle)}</div>` : ''}
      </div>

      <!-- Bordered 3-column table -->
      <table style="width: 100%; border-collapse: collapse; border: 2px solid #000000; table-layout: fixed;">
        <thead>
          <tr style="background: #d9d9d9;">
            <th style="border: 1.5px solid #000; padding: 10px 8px; text-align: center; font-weight: 900; font-size: 15px; color: #000; width: 62px;">
              ر.ت
            </th>
            <th style="border: 1.5px solid #000; padding: 10px 14px; text-align: center; font-weight: 900; font-size: 16px; color: #000; width: 42%;">
              المؤسسة التعليمية
            </th>
            <th style="border: 1.5px solid #000; padding: 10px 12px; text-align: center; font-weight: 900; font-size: 16px; color: #000;">
              الفئات المعنية
            </th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      ${totalPages > 1 ? `
        <div style="margin-top: 10px; text-align: left; font-size: 11px; font-weight: 700; color: #475569;">
          صفحة ${pageIndex + 1} من ${totalPages}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generates and directly downloads a clean multi-page A4 Landscape PDF
 * matching the official participating schools table template (zero window.open).
 */
export async function downloadTournamentParticipationTablePdf(
  options: TournamentTablePdfOptions
): Promise<void> {
  const { redTitle, subtitle, rows, filename } = options;
  const safeBase = (redTitle || 'بطولة_مدرسية').replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, '_');
  const finalFilename = filename || `المؤسسات_المشاركة_${safeBase}.pdf`;

  const loadingToast = toast.loading('جاري إعداد وتحميل جدول المؤسسات المشاركة (PDF)...');

  let hostContainer: HTMLDivElement | null = null;
  try {
    const fontCss = await prepareFontEmbedCss('Cairo').catch(() => '');

    const numberedRows = rows.map((r, idx) => ({ ...r, seq: idx + 1 }));
    const ROWS_PER_PAGE = 14;
    const chunks: Array<Array<ParticipationTableRow & { seq: number }>> = [];
    if (numberedRows.length === 0) {
      chunks.push([]);
    } else {
      for (let i = 0; i < numberedRows.length; i += ROWS_PER_PAGE) {
        chunks.push(numberedRows.slice(i, i + ROWS_PER_PAGE));
      }
    }

    hostContainer = document.createElement('div');
    hostContainer.style.position = 'fixed';
    hostContainer.style.left = '-12000px';
    hostContainer.style.top = '0';
    hostContainer.style.zIndex = '-1';
    hostContainer.style.pointerEvents = 'none';
    hostContainer.style.background = '#ffffff';
    document.body.appendChild(hostContainer);

    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const maxDrawW = pageW - margin * 2;
    const maxDrawH = pageH - margin * 2;

    for (let i = 0; i < chunks.length; i++) {
      hostContainer.innerHTML = buildTablePageHtml(
        redTitle,
        subtitle,
        chunks[i],
        i,
        chunks.length,
        fontCss
      );
      const targetEl = hostContainer.firstElementChild as HTMLElement;
      await new Promise(resolve => setTimeout(resolve, 60));

      const dataUrl = await toPng(targetEl, {
        quality: 1,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
        fontEmbedCSS: fontCss || undefined
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = dataUrl;
      });

      const aspectRatio = img.width / (img.height || 1);
      let drawW = maxDrawW;
      let drawH = drawW / aspectRatio;
      if (drawH > maxDrawH) {
        drawH = maxDrawH;
        drawW = drawH * aspectRatio;
      }
      const xOffset = (pageW - drawW) / 2;

      if (i > 0) {
        pdf.addPage();
      }
      pdf.addImage(dataUrl, 'PNG', xOffset, margin, drawW, drawH);
    }

    pdf.save(finalFilename);
    toast.dismiss(loadingToast);
    toast.success(`تم تحميل جدول المؤسسات المشاركة (${rows.length} مؤسسة) بنجاح ✓`);
  } catch (err) {
    console.error('Error generating participation table PDF:', err);
    toast.dismiss(loadingToast);
    toast.error('تعذر إنشاء ملف PDF، يرجى المحاولة مجدداً');
  } finally {
    if (hostContainer && hostContainer.parentNode) {
      hostContainer.parentNode.removeChild(hostContainer);
    }
  }
}

export function formatTournamentRedBannerTitle(params: {
  sportId: string;
  sportName?: string;
  levelLabel?: string;
  affiliationType?: string;
  category?: string;
  gender?: 'Male' | 'Female' | 'Mixed' | string;
}): string {
  const sportLabel = SPORTS_MAP[params.sportId]?.name || params.sportName || params.sportId;
  const parts: string[] = [sportLabel];
  if (params.levelLabel && params.levelLabel !== 'ALL' && params.levelLabel !== 'جميع الأسلاك') {
    parts.push(params.levelLabel);
  }
  if (params.category && params.category !== 'ALL') {
    if (params.gender === 'Male' || params.gender === 'Female') {
      parts.push(formatCompactCategoryGender(params.category, params.gender, params.sportId));
    } else {
      parts.push(normalizeCategoryKey(params.category));
    }
  }
  if (params.affiliationType === 'club_affiliated') {
    parts.push('للمنتمين للأندية');
  } else if (params.affiliationType === 'non_club') {
    parts.push('لغير المنتمين');
  } else if (params.affiliationType === 'open') {
    parts.push('المفتوحة');
  }
  return parts.join(' ').trim();
}
