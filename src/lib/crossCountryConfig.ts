import { CrossCountryCategoryResult, PodiumWinner } from '../types';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export interface CrossCountryCategoryDef {
  id: string;
  category: string; // 'U12' | 'U15' | 'U18' | 'U20'
  gender: 'Male' | 'Female';
  titleAr: string;
  shortLabel: string;
  genderLabel: string;
  distance: string;
  icon: string;
  colorClass: string;
}

export const CROSS_COUNTRY_CATEGORIES: CrossCountryCategoryDef[] = [
  {
    id: 'u12_male',
    category: 'U12',
    gender: 'Male',
    titleAr: 'سباق البراعم ذكور',
    shortLabel: 'البراعم ذكور',
    genderLabel: 'ذكور',
    distance: '1500 م',
    icon: '👦',
    colorClass: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
  },
  {
    id: 'u12_female',
    category: 'U12',
    gender: 'Female',
    titleAr: 'سباق البرعمات إناث',
    shortLabel: 'البرعمات إناث',
    genderLabel: 'إناث',
    distance: '1000 م',
    icon: '👧',
    colorClass: 'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100'
  },
  {
    id: 'u15_male',
    category: 'U15',
    gender: 'Male',
    titleAr: 'سباق الصغار ذكور',
    shortLabel: 'الصغار ذكور',
    genderLabel: 'ذكور',
    distance: '3000 م',
    icon: '👦',
    colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
  },
  {
    id: 'u15_female',
    category: 'U15',
    gender: 'Female',
    titleAr: 'سباق الصغيرات إناث',
    shortLabel: 'الصغيرات إناث',
    genderLabel: 'إناث',
    distance: '2000 م',
    icon: '👧',
    colorClass: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100'
  },
  {
    id: 'u18_male',
    category: 'U18',
    gender: 'Male',
    titleAr: 'سباق الفتيان ذكور',
    shortLabel: 'الفتيان ذكور',
    genderLabel: 'ذكور',
    distance: '4000 م',
    icon: '🏃‍♂️',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
  },
  {
    id: 'u18_female',
    category: 'U18',
    gender: 'Female',
    titleAr: 'سباق الفتيات إناث',
    shortLabel: 'الفتيات إناث',
    genderLabel: 'إناث',
    distance: '3000 م',
    icon: '🏃‍♀️',
    colorClass: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
  },
  {
    id: 'u20_male',
    category: 'U20',
    gender: 'Male',
    titleAr: 'سباق الشبان ذكور',
    shortLabel: 'الشبان ذكور',
    genderLabel: 'ذكور',
    distance: '5000 م',
    icon: '🏃‍♂️',
    colorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
  },
  {
    id: 'u20_female',
    category: 'U20',
    gender: 'Female',
    titleAr: 'سباق الشابات إناث',
    shortLabel: 'الشابات إناث',
    genderLabel: 'إناث',
    distance: '3000 م',
    icon: '🏃‍♀️',
    colorClass: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
  }
];

export interface TeamRankingResult {
  schoolName: string;
  totalPoints: number; // مجموع رتب العناصر الأربعة الأولى
  fourthRunnerRank: number; // رتبة العداء الرابع (للاحتكام عند التساوي)
  thirdRunnerRank: number; // رتبة العداء الثالث
  secondRunnerRank: number; // رتبة العداء الثاني
  firstRunnerRank: number; // رتبة أول عداء في الفريق
  runners: PodiumWinner[];
  top4Runners: PodiumWinner[];
  rank: number; // ترتيب الفريق (1، 2، 3...)
  isWinnerTeam: boolean; // الفريق الفائز بالمركز الأول المتأهل للبطولة الجهوية
  isValidTeam: boolean; // هل اكتمل الفريق بـ 4 واصلين على الأقل؟
}

export interface RegionalQualifiedIndividual {
  qualifyingRank: number; // 1, 2, 3
  runner: PodiumWinner;
  originalFinishRank: number;
  isReplacement: boolean; // هل تم تصعيده كبديل؟
  replacedTop3Runner?: PodiumWinner; // المتوج الفردي المتأهل مع فريقه
  reasonAr: string;
}

/**
 * حساب ترتيب الفرق للمؤسسات التعليمية طبقاً للقوانين الرسمية للرياضة المدرسية في العدو الريفي:
 * 1. شروط تكوين الفريق: اقتصار الحساب على المشاركين بصفتهم "فريق المؤسسة" (استبعاد المشاركة الفردية).
 * 2. الحد الأدنى للوصول: يجب وصول 4 عداءين على الأقل من نفس المؤسسة لخط النهاية لاحتساب نتائج الفريق.
 * 3. مجموع النقاط: جمع رتب الوصول الفردية لأول 4 عداءين من المؤسسة (المجموع الأقل هو الأفضل 🏆).
 * 4. معيار الحسم عند التعادل (Tie-Breaker): عند تساوي مجموع النقاط، يتم الاحتكام لـ رتبة العداء الرابع المكمل للفريق (الأفضل/الأسبق رتبة يفوز).
 */
export function calculateTeamRankings(runners: PodiumWinner[]): TeamRankingResult[] {
  if (!runners || runners.length === 0) return [];

  const schoolGroups: Record<string, PodiumWinner[]> = {};

  runners.forEach(r => {
    if (!r.schoolName || !r.fullName) return;

    // استبعاد المشاركين الفرديين صراحة
    const partType = (r.participationType || '').trim().toLowerCase();
    const isIndividual = partType === 'فردي' || partType === 'مشاركة فردية' || partType === 'individual';
    if (isIndividual) return;

    const name = r.schoolName.trim();
    if (!schoolGroups[name]) {
      schoolGroups[name] = [];
    }
    schoolGroups[name].push(r);
  });

  const validTeams: {
    schoolName: string;
    totalPoints: number;
    fourthRunnerRank: number;
    thirdRunnerRank: number;
    secondRunnerRank: number;
    firstRunnerRank: number;
    runners: PodiumWinner[];
    top4Runners: PodiumWinner[];
    isValidTeam: boolean;
  }[] = [];

  Object.entries(schoolGroups).forEach(([schoolName, schoolRunners]) => {
    const sorted = [...schoolRunners].sort((a, b) => a.rank - b.rank);
    // يُشترط القوانين الرسمية وصول 4 عداءين على الأقل من نفس المؤسسة لخط النهاية
    if (sorted.length >= 4) {
      const top4 = sorted.slice(0, 4);
      const totalPoints = top4.reduce((sum, r) => sum + r.rank, 0);
      const fourthRunnerRank = top4[3].rank;
      const thirdRunnerRank = top4[2].rank;
      const secondRunnerRank = top4[1].rank;
      const firstRunnerRank = top4[0].rank;

      validTeams.push({
        schoolName,
        totalPoints,
        fourthRunnerRank,
        thirdRunnerRank,
        secondRunnerRank,
        firstRunnerRank,
        runners: sorted,
        top4Runners: top4,
        isValidTeam: true
      });
    }
  });

  // معايير الترتيب وحسم التعادل طبقاً لقوانين الجامعة الملكية المغربية للرياضة المدرسية:
  // 1- المجموع الأقل من النقاط لأول 4 عداءين
  // 2- عند التعادل في النقاط: الاحتكام لـ رتبة العداء الرابع المكمل للفريق (الأقل رتبة/الأسبق وصولاً يفوز)
  // 3- عند التعادل في العداء الرابع: الاحتكام للعداء الثالث، ثم الثاني، ثم الأول
  validTeams.sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) {
      return a.totalPoints - b.totalPoints; // المجموع الأقل هو الأفضل
    }
    if (a.fourthRunnerRank !== b.fourthRunnerRank) {
      return a.fourthRunnerRank - b.fourthRunnerRank; // أسبقية العداء الرابع
    }
    if (a.thirdRunnerRank !== b.thirdRunnerRank) {
      return a.thirdRunnerRank - b.thirdRunnerRank;
    }
    if (a.secondRunnerRank !== b.secondRunnerRank) {
      return a.secondRunnerRank - b.secondRunnerRank;
    }
    return a.firstRunnerRank - b.firstRunnerRank;
  });

  return validTeams.map((team, idx) => ({
    ...team,
    rank: idx + 1,
    isWinnerTeam: idx === 0
  }));
}

/**
 * حساب لائحة المؤهلين للبطولة الجهوية/الوطنية وتطبيق قاعدة بدلاء التعويض:
 * - الفريق الفائز بالمركز الأول يتأهل بكامل أعضائه للجهة.
 * - إذا حاز أحد عناصر الفريق الفائز على أحد المراكز الثلاثة الأولى فردياً، فإنه يحصل على ميدالية البوديوم ويتأهل مع فريقه.
 * - يتم تعويض مقعده الفردي للتأهل الجهوي بالمرتبة الموالية (المركز 4، 5...) لعداء ينتمي لمؤسسة أخرى.
 */
export function calculateRegionalQualifications(
  runners: PodiumWinner[],
  winningTeamName: string | null
): RegionalQualifiedIndividual[] {
  if (!runners || runners.length === 0) return [];

  const result: RegionalQualifiedIndividual[] = [];
  const sortedRunners = [...runners].sort((a, b) => a.rank - b.rank);

  const targetSpots = 3;
  let filledSpots = 0;
  const replacedTop3Runners: PodiumWinner[] = [];

  for (const runner of sortedRunners) {
    if (filledSpots >= targetSpots) break;

    const isFromWinningTeam = winningTeamName && runner.schoolName.trim().toLowerCase() === winningTeamName.trim().toLowerCase();

    if (isFromWinningTeam) {
      // عداء يتأهل مع فريقه الفائز بالمركز الأول
      if (runner.rank <= 3) {
        replacedTop3Runners.push(runner);
      }
    } else {
      // عداء يحجز مقعداً فردياً للبطولة الجهوية
      filledSpots++;
      const isReplacement = runner.rank > 3;
      const replaced = replacedTop3Runners.length > 0 ? replacedTop3Runners[filledSpots - 1] || replacedTop3Runners[0] : undefined;

      result.push({
        qualifyingRank: filledSpots,
        runner,
        originalFinishRank: runner.rank,
        isReplacement,
        replacedTop3Runner: isReplacement ? replaced : undefined,
        reasonAr: !isReplacement
          ? 'تأهل فردي مباشر (تتويج إقليمي في المراكز الثلاثة الأولى)'
          : `تأهل جهوي صاعد (بديل) - نظراً لتأهل البطل "${replaced?.fullName || 'المتوج الفردي'}" مع فريقه (${winningTeamName})`
      });
    }
  }

  return result;
}

export const INITIAL_CROSS_COUNTRY_RESULTS: Record<string, CrossCountryCategoryResult> = {
  u12_male: {
    categoryId: 'u12_male',
    category: 'U12',
    gender: 'Male',
    titleAr: 'سباق البراعم ذكور (U12)',
    distance: '1500 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u12_female: {
    categoryId: 'u12_female',
    category: 'U12',
    gender: 'Female',
    titleAr: 'سباق البرعمات إناث (U12)',
    distance: '1000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u13_male: {
    categoryId: 'u13_male',
    category: 'U12',
    gender: 'Male',
    titleAr: 'سباق البراعم ذكور (U13/U12)',
    distance: '1500 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u13_female: {
    categoryId: 'u13_female',
    category: 'U12',
    gender: 'Female',
    titleAr: 'سباق البرعمات إناث (U13/U12)',
    distance: '1000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u15_male: {
    categoryId: 'u15_male',
    category: 'U15',
    gender: 'Male',
    titleAr: 'سباق الصغار ذكور (U15)',
    distance: '3000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u15_female: {
    categoryId: 'u15_female',
    category: 'U15',
    gender: 'Female',
    titleAr: 'سباق الصغيرات إناث (U15)',
    distance: '2000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u18_male: {
    categoryId: 'u18_male',
    category: 'U18',
    gender: 'Male',
    titleAr: 'سباق الفتيان ذكور (U18)',
    distance: '4000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u18_female: {
    categoryId: 'u18_female',
    category: 'U18',
    gender: 'Female',
    titleAr: 'سباق الفتيات إناث (U18)',
    distance: '3000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u20_male: {
    categoryId: 'u20_male',
    category: 'U20',
    gender: 'Male',
    titleAr: 'سباق الشبان ذكور (U20)',
    distance: '5000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  },
  u20_female: {
    categoryId: 'u20_female',
    category: 'U20',
    gender: 'Female',
    titleAr: 'سباق الشابات إناث (U20)',
    distance: '3000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: []
  }
};

/**
 * تصدير لائحة المتأهلين للبطولة الجهوية (خاص بالمسؤول المركزي ورئيس اللجنة التقنية للعدو الريفي)
 */
export function exportQualifiedListExcel(
  results: Record<string, CrossCountryCategoryResult>,
  activeSeason: string,
  directorateName: string = 'مديرية تاوريرت'
) {
  try {
    const wb = XLSX.utils.book_new();

    // 1. Qualified Teams Sheet (الفرق المتأهلة بطلة الفئات)
    const teamRows: Record<string, any>[] = [];
    CROSS_COUNTRY_CATEGORIES.forEach(cat => {
      const catRes = results[cat.id];
      const teams = calculateTeamRankings(catRes?.podium || []);
      const winningTeam = teams.find(t => t.isWinnerTeam);

      if (winningTeam) {
        teamRows.push({
          'الفئة العمرية': cat.titleAr,
          'اسم المؤسسة التعليمية البطلة 🏆': winningTeam.schoolName,
          'مجموع نقاط أول 4 عداءين': winningTeam.totalPoints,
          'رتبة العداء الرابع (حسم التعادل ⚖️)': winningTeam.fourthRunnerRank,
          'عدد العداءين الواصلين': winningTeam.runners.length,
          'عناصر الفريق المتأهلين رسمياً': winningTeam.top4Runners.map(r => `${r.fullName} (المرتبة ${r.rank})`).join(' ، '),
          'المديرية': directorateName,
          'صفة التأهل': 'تأهل جماعي رسمي للبطولة الجهوية 🏆'
        });
      } else {
        teamRows.push({
          'الفئة العمرية': cat.titleAr,
          'اسم المؤسسة التعليمية البطلة 🏆': 'لم يكتمل فريق بـ 4 عداءين',
          'مجموع نقاط أول 4 عداءين': '-',
          'رتبة العداء الرابع (حسم التعادل ⚖️)': '-',
          'عدد العداءين الواصلين': '-',
          'عناصر الفريق المتأهلين رسمياً': '-',
          'المديرية': directorateName,
          'صفة التأهل': 'غير محدد'
        });
      }
    });

    const wsTeams = XLSX.utils.json_to_sheet(teamRows);
    wsTeams['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsTeams, 'الفرق_المتأهلة_جماعياً');

    // 2. Qualified Individuals Sheet (العداؤون المتأهلون فردياً + البدلاء)
    const individualRows: Record<string, any>[] = [];
    CROSS_COUNTRY_CATEGORIES.forEach(cat => {
      const catRes = results[cat.id];
      const teams = calculateTeamRankings(catRes?.podium || []);
      const winningTeamName = teams.length > 0 ? teams[0].schoolName : null;
      const quals = calculateRegionalQualifications(catRes?.podium || [], winningTeamName);

      if (quals.length > 0) {
        quals.forEach(q => {
          individualRows.push({
            'الفئة العمرية': cat.titleAr,
            'المقعد الفردي الجهوي': `#${q.qualifyingRank}`,
            'اسم العداء(ة) المتأهل(ة)': q.runner.fullName,
            'رقم الصدرية': q.runner.bibNumber || '-',
            'المؤسسة التعليمية': q.runner.schoolName,
            'الرتبة الأصلية عند خط الوصول': q.originalFinishRank,
            'نوع التأهل': q.isReplacement ? 'بديل صاعد (تعويض فردي) 🎯' : 'تأهل فردي مباشر 🥇',
            'السبب والتوضيح القانوني': q.reasonAr,
            'الفريق البطل المتأهل جماعياً': winningTeamName || 'غ.مكتمل',
            'المديرية': directorateName
          });
        });
      } else {
        individualRows.push({
          'الفئة العمرية': cat.titleAr,
          'المقعد الفردي الجهوي': '-',
          'اسم العداء(ة) المتأهل(ة)': 'لا توجد نتائج مسجلة',
          'رقم الصدرية': '-',
          'المؤسسة التعليمية': '-',
          'الرتبة الأصلية عند خط الوصول': '-',
          'نوع التأهل': '-',
          'السبب والتوضيح القانوني': '-',
          'الفريق البطل المتأهل جماعياً': '-',
          'المديرية': directorateName
        });
      }
    });

    const wsIndiv = XLSX.utils.json_to_sheet(individualRows);
    wsIndiv['!views'] = [{ RTL: true }];
    XLSX.utils.book_append_sheet(wb, wsIndiv, 'العداؤون_المتأهلون_فردياً');

    XLSX.writeFile(wb, `لائحة_المتأهلين_الرسمية_للبطولة_الجهوية_${activeSeason.replace('/', '-')}.xlsx`);
    toast.success('تم تصدير لائحة المتأهلين الرسمية للبطولة الجهوية بنجاح! 🏆');
  } catch (err) {
    console.error('Error exporting qualified list:', err);
    toast.error('حدث خطأ أثناء تصدير لائحة المتأهلين');
  }
}

/**
 * تصدير لائحة النتائج الشاملة لجميع فئات العدو الريفي وترتيب الفرق
 */
export function exportFullResultsExcel(
  results: Record<string, CrossCountryCategoryResult>,
  activeSeason: string,
  directorateName: string = 'مديرية تاوريرت'
) {
  try {
    const wb = XLSX.utils.book_new();

    // 1. Full Individual Results across all 8 categories
    CROSS_COUNTRY_CATEGORIES.forEach(cat => {
      const catRes = results[cat.id];
      const podium = catRes?.podium || [];

      const rows = podium.length > 0
        ? podium.map((p, idx) => ({
            'الرتبة العامة (الوصول)': idx + 1,
            'رقم الصدرية': p.bibNumber || '-',
            'اسم العداء(ة)': p.fullName,
            'التوقيت': p.time || '-',
            'المؤسسة التعليمية': p.schoolName,
            'المديرية': p.directorateName || directorateName,
            'الأكاديمية': p.academyName || 'الأكاديمية الجهوية',
            'اسم المؤطر': p.supervisorName || '-',
            'نوع المشاركة': p.participationType === 'school_team' || p.participationType === 'فريق' ? 'فريق المؤسسة' : 'مشاركة فردية',
            'الملاحظات والنتيجة': p.notes || '-'
          }))
        : [
            {
              'الرتبة العامة (الوصول)': 'لا توجد نتائج مسجلة',
              'رقم الصدرية': '-',
              'اسم العداء(ة)': '-',
              'التوقيت': '-',
              'المؤسسة التعليمية': '-',
              'المديرية': '-',
              'الأكاديمية': '-',
              'اسم المؤطر': '-',
              'نوع المشاركة': '-',
              'الملاحظات والنتيجة': '-'
            }
          ];

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, ws, cat.shortLabel.substring(0, 30));
    });

    // 2. Team Rankings Summary Sheet
    const teamSummaryRows: Record<string, any>[] = [];
    CROSS_COUNTRY_CATEGORIES.forEach(cat => {
      const catRes = results[cat.id];
      const teams = calculateTeamRankings(catRes?.podium || []);
      teams.forEach(t => {
        teamSummaryRows.push({
          'الفئة العمرية': cat.titleAr,
          'ترتيب الفريق': t.rank === 1 ? '🥇 المركز الأول (بطل الفئة المتأهل)' : t.rank === 2 ? '🥈 المركز الثاني' : t.rank === 3 ? '🥉 المركز الثالث' : t.rank,
          'اسم المؤسسة التعليمية': t.schoolName,
          'مجموع نقاط أول 4 عداءين': t.totalPoints,
          'رتبة العداء الرابع (حسم التعادل ⚖️)': t.fourthRunnerRank,
          'عدد العداءين الواصلين': t.runners.length,
          'أسماء العناصر المحتسبين في التتويج': t.top4Runners.map(r => `${r.fullName} (مرتبة ${r.rank})`).join(' ، ')
        });
      });
    });

    if (teamSummaryRows.length > 0) {
      const wsTeams = XLSX.utils.json_to_sheet(teamSummaryRows);
      wsTeams['!views'] = [{ RTL: true }];
      XLSX.utils.book_append_sheet(wb, wsTeams, 'ترتيب_فرق_المؤسسات');
    }

    XLSX.writeFile(wb, `لائحة_النتائج_الكاملة_للعدو_الريفي_${activeSeason.replace('/', '-')}.xlsx`);
    toast.success('تم تصدير محضر لائحة النتائج الشاملة بنجاح! 📊');
  } catch (err) {
    console.error('Error exporting full results:', err);
    toast.error('حدث خطأ أثناء تصدير محضر النتائج');
  }
}
