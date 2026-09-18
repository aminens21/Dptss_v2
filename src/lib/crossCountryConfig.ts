import { CrossCountryCategoryResult, PodiumWinner } from '../types';

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
  firstRunnerRank: number; // رتبة أول عداء في الفريق
  runners: PodiumWinner[];
  top4Runners: PodiumWinner[];
  rank: number; // ترتيب الفريق (1، 2، 3...)
  isWinnerTeam: boolean; // الفريق الفائز بالمركز الأول المتأهل للبطولة الجهوية
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
 * حساب ترتيب الفرق للمؤسسات التعليمية:
 * 1. جمع رتب أول 4 عداءين في خط الوصول لكل مؤسسة.
 * 2. الفريق الحاصل على أقل مجموع نقاط يحتل المركز الأول.
 * 3. في حالة تساوي النقاط بين مؤسستين أو أكثر، يتم الاحتكام إلى رتبة العداء الرابع لكل فريق (الأفضل رتبة يفوز).
 */
export function calculateTeamRankings(runners: PodiumWinner[]): TeamRankingResult[] {
  if (!runners || runners.length === 0) return [];

  const schoolGroups: Record<string, PodiumWinner[]> = {};

  runners.forEach(r => {
    if (!r.schoolName || !r.fullName) return;
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
    firstRunnerRank: number;
    runners: PodiumWinner[];
    top4Runners: PodiumWinner[];
  }[] = [];

  Object.entries(schoolGroups).forEach(([schoolName, schoolRunners]) => {
    const sorted = [...schoolRunners].sort((a, b) => a.rank - b.rank);
    // يشترط وجود 4 عداءين على الأقل لتكوين فريق وإدخال المؤسسة في ترتيب الفرق
    if (sorted.length >= 4) {
      const top4 = sorted.slice(0, 4);
      const totalPoints = top4.reduce((sum, r) => sum + r.rank, 0);
      const fourthRunnerRank = top4[3].rank;
      const firstRunnerRank = top4[0].rank;

      validTeams.push({
        schoolName,
        totalPoints,
        fourthRunnerRank,
        firstRunnerRank,
        runners: sorted,
        top4Runners: top4
      });
    }
  });

  // الترتيب: 1- الأقل نقاطاً ، 2- عند التساوي الأفضل رتبة للعداء الرابع ، 3- الأفضل رتبة للعداء الأول
  validTeams.sort((a, b) => {
    if (a.totalPoints !== b.totalPoints) {
      return a.totalPoints - b.totalPoints;
    }
    if (a.fourthRunnerRank !== b.fourthRunnerRank) {
      return a.fourthRunnerRank - b.fourthRunnerRank;
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
  u15_male: {
    categoryId: 'u15_male',
    category: 'U15',
    gender: 'Male',
    titleAr: 'سباق الصغار ذكور (U15)',
    distance: '3000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: [
      {
        rank: 1,
        fullName: 'ياسين بوعزة',
        schoolName: 'ثانوية الفتح الإعدادية',
        time: '09:42.10',
        bibNumber: '104',
        notes: 'بطل الفئة 🥇 (يتأهل مع فريقه إلى البطولة الجهوية)'
      },
      {
        rank: 2,
        fullName: 'محمد المهداوي',
        schoolName: 'ثانوية الزيتون الإعدادية',
        time: '09:55.40',
        bibNumber: '118',
        notes: 'مؤهل فردي جهوياً 🥈'
      },
      {
        rank: 3,
        fullName: 'حمزة القاسمي',
        schoolName: 'ثانوية الفتح الإعدادية',
        time: '10:08.80',
        bibNumber: '132',
        notes: 'المركز الثالث 🥉 (يتأهل مع فريقه إلى البطولة الجهوية)'
      },
      {
        rank: 4,
        fullName: 'أنس الرحماني',
        schoolName: 'ثانوية علال بن عبد الله الإعدادية',
        time: '10:19.30',
        bibNumber: '112',
        notes: 'مؤهل جهوياً كبديل صاعد (التعويض الفردي) 🎯'
      },
      {
        rank: 5,
        fullName: 'أيوب السليماني',
        schoolName: 'ثانوية الفتح الإعدادية',
        time: '10:28.15',
        bibNumber: '125',
        notes: 'عنصر بالفريق الفائز (الفتح)'
      },
      {
        rank: 6,
        fullName: 'عمر بوطيب',
        schoolName: 'ثانوية الفتح الإعدادية',
        time: '10:35.00',
        bibNumber: '140',
        notes: 'العداء الرابع بالفريق الفائز (الفتح)'
      },
      {
        rank: 7,
        fullName: 'وليد البقالي',
        schoolName: 'ثانوية 20 غشت الإعدادية',
        time: '10:42.10',
        bibNumber: '151',
        notes: 'مؤهل جهوياً كبديل صاعد (التعويض الفردي 2) 🎯'
      },
      {
        rank: 8,
        fullName: 'أشرف الجوطي',
        schoolName: 'ثانوية الزيتون الإعدادية',
        time: '10:50.00',
        bibNumber: '160',
        notes: 'فريق الزيتون (العداء الثاني)'
      }
    ]
  },
  u15_female: {
    categoryId: 'u15_female',
    category: 'U15',
    gender: 'Female',
    titleAr: 'سباق الصغيرات إناث (U15)',
    distance: '2000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: [
      {
        rank: 1,
        fullName: 'فاطمة الزهراء العمراني',
        schoolName: 'ثانوية الفتح الإعدادية',
        time: '07:15.30',
        bibNumber: '205',
        notes: 'مؤهلة للبطولة الجهوية 🥇'
      },
      {
        rank: 2,
        fullName: 'مريم الصالحي',
        schoolName: 'ثانوية 20 غشت الإعدادية',
        time: '07:28.00',
        bibNumber: '214',
        notes: 'مؤهلة للبطولة الجهوية 🥈'
      },
      {
        rank: 3,
        fullName: 'سعاد البقالي',
        schoolName: 'ثانوية الزيتون الإعدادية',
        time: '07:41.50',
        bibNumber: '221',
        notes: 'مؤهلة للبطولة الجهوية 🥉'
      },
      {
        rank: 4,
        fullName: 'سلمى العزوزي',
        schoolName: 'ثانوية 20 غشت الإعدادية',
        time: '07:50.00',
        bibNumber: '230',
        notes: 'عنصر فريق 20 غشت'
      }
    ]
  },
  u12_male: {
    categoryId: 'u12_male',
    category: 'U12',
    gender: 'Male',
    titleAr: 'سباق البراعم ذكور (U12)',
    distance: '1500 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: [
      {
        rank: 1,
        fullName: 'أحمد التازي',
        schoolName: 'مدرسة ابن خلدون الابتدائية',
        time: '05:12.40',
        bibNumber: '042',
        notes: 'مؤهل للبطولة الجهوية 🥇'
      },
      {
        rank: 2,
        fullName: 'سفيان الوزاني',
        schoolName: 'مدرسة المسيرة الخضراء',
        time: '05:24.10',
        bibNumber: '055',
        notes: 'مؤهل للبطولة الجهوية 🥈'
      },
      {
        rank: 3,
        fullName: 'إلياس المصباحي',
        schoolName: 'مدرسة وادي الذهب الابتدائية',
        time: '05:33.80',
        bibNumber: '061',
        notes: 'مؤهل للبطولة الجهوية 🥉'
      }
    ]
  },
  u12_female: {
    categoryId: 'u12_female',
    category: 'U12',
    gender: 'Female',
    titleAr: 'سباق البرعمات إناث (U12)',
    distance: '1000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: [
      {
        rank: 1,
        fullName: 'آية المرابط',
        schoolName: 'مدرسة وادي الذهب الابتدائية',
        time: '03:45.20',
        bibNumber: '018',
        notes: 'مؤهلة للبطولة الجهوية 🥇'
      },
      {
        rank: 2,
        fullName: 'هبة الشرقاوي',
        schoolName: 'مدرسة ابن خلدون الابتدائية',
        time: '03:54.60',
        bibNumber: '022',
        notes: 'مؤهلة للبطولة الجهوية 🥈'
      },
      {
        rank: 3,
        fullName: 'خديجة الحسني',
        schoolName: 'مدرسة النخيل الابتدائية',
        time: '04:02.10',
        bibNumber: '031',
        notes: 'مؤهلة للبطولة الجهوية 🥉'
      }
    ]
  },
  u18_male: {
    categoryId: 'u18_male',
    category: 'U18',
    gender: 'Male',
    titleAr: 'سباق الفتيان ذكور (U18)',
    distance: '4000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: [
      {
        rank: 1,
        fullName: 'يوسف شرفي',
        schoolName: 'ثانوية الفتح التأهيلية',
        time: '13:10.50',
        bibNumber: '302',
        notes: 'مؤهل للبطولة الجهوية 🥇'
      },
      {
        rank: 2,
        fullName: 'وليد الهاشمي',
        schoolName: 'ثانوية المرينيين التأهيلية',
        time: '13:24.00',
        bibNumber: '315',
        notes: 'مؤهل للبطولة الجهوية 🥈'
      },
      {
        rank: 3,
        fullName: 'بلال العزاوي',
        schoolName: 'ثانوية ابن الهيثم التأهيلية',
        time: '13:40.80',
        bibNumber: '320',
        notes: 'مؤهل للبطولة الجهوية 🥉'
      }
    ]
  },
  u18_female: {
    categoryId: 'u18_female',
    category: 'U18',
    gender: 'Female',
    titleAr: 'سباق الفتيات إناث (U18)',
    distance: '3000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: [
      {
        rank: 1,
        fullName: 'إيمان المنصوري',
        schoolName: 'ثانوية الفتح التأهيلية',
        time: '11:05.10',
        bibNumber: '401',
        notes: 'مؤهلة للبطولة الجهوية 🥇'
      },
      {
        rank: 2,
        fullName: 'سلمى الإدريسي',
        schoolName: 'ثانوية المرينيين التأهيلية',
        time: '11:22.40',
        bibNumber: '412',
        notes: 'مؤهلة للبطولة الجهوية 🥈'
      },
      {
        rank: 3,
        fullName: 'أميمة التازي',
        schoolName: 'ثانوية الزيتون التأهيلية',
        time: '11:38.90',
        bibNumber: '425',
        notes: 'مؤهلة للبطولة الجهوية 🥉'
      }
    ]
  },
  u20_male: {
    categoryId: 'u20_male',
    category: 'U20',
    gender: 'Male',
    titleAr: 'سباق الشبان ذكور (U20)',
    distance: '5000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: [
      {
        rank: 1,
        fullName: 'حميد الزياني',
        schoolName: 'ثانوية المرينيين التأهيلية',
        time: '16:45.00',
        bibNumber: '501',
        notes: 'مؤهل للبطولة الجهوية 🥇'
      },
      {
        rank: 2,
        fullName: 'رشيد البوعناني',
        schoolName: 'ثانوية الفتح التأهيلية',
        time: '17:02.30',
        bibNumber: '511',
        notes: 'مؤهل للبطولة الجهوية 🥈'
      },
      {
        rank: 3,
        fullName: 'زكرياء الداودي',
        schoolName: 'ثانوية ابن الهيثم التقنية',
        time: '17:19.80',
        bibNumber: '522',
        notes: 'مؤهل للبطولة الجهوية 🥉'
      }
    ]
  },
  u20_female: {
    categoryId: 'u20_female',
    category: 'U20',
    gender: 'Female',
    titleAr: 'سباق الشابات إناث (U20)',
    distance: '3000 م',
    venueName: 'مضمار حلبة ألعاب القوى بتاوريرت',
    podium: [
      {
        rank: 1,
        fullName: 'كوثر العثماني',
        schoolName: 'ثانوية الفتح التأهيلية',
        time: '11:50.20',
        bibNumber: '601',
        notes: 'مؤهلة للبطولة الجهوية 🥇'
      },
      {
        rank: 2,
        fullName: 'شيماء الراشدي',
        schoolName: 'ثانوية المرينيين التأهيلية',
        time: '12:08.50',
        bibNumber: '614',
        notes: 'مؤهلة للبطولة الجهوية 🥈'
      },
      {
        rank: 3,
        fullName: 'دعاء الصنهاجي',
        schoolName: 'ثانوية ابن الهيثم التأهيلية',
        time: '12:25.10',
        bibNumber: '620',
        notes: 'مؤهلة للبطولة الجهوية 🥉'
      }
    ]
  }
};
