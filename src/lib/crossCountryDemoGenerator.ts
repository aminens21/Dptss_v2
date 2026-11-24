import { School, Student, Tournament, User } from '../types';
import {
  DataService,
  getAgeCategoriesForSeason,
  inferLevelFromSchoolName,
  isCrossCountryU15OpenToPrimary,
  isSchoolSectorAllowedForTournament,
  isTeacherLevelAllowedForTournament,
  normalizeCadreToLevelKey,
  normalizeCategoryKey,
  resolveSchoolCoach,
  schoolNamesMatch
} from './dataService';
import { CROSS_COUNTRY_CATEGORIES, CrossCountryCategoryDef } from './crossCountryConfig';

export interface CrossCountryDemoOptions {
  schools: School[];
  teachers: User[];
  existingStudents: Student[];
  tournaments: Tournament[];
  activeSeason: string;
  activeDirectorateId: string;
  teamCountPerCat: number; // 0..5
  individualCountPerCat: number; // 0..3
  affiliationMode: 'auto' | 'non_club' | 'club_affiliated';
  includePrimaryU15: boolean;
  includeMiddleU18: boolean;
  schoolFilter: 'all' | 'only_empty';
  ignoreTournamentFilters: boolean;
  autoConfirmSchools: boolean;
  currentUser?: User | null;
}

export interface CrossCountryDemoResult {
  createdStudentsCount: number;
  affectedSchoolsCount: number;
  confirmedSchoolsCount: number;
  skippedSchoolsCount: number;
  categoryCounts: Record<string, number>;
}

const MALE_FIRST_NAMES = [
  'ياسين', 'أمين', 'حمزة', 'أيوب', 'أنس', 'يوسف', 'عمر', 'زكرياء', 'إلياس', 'مهدي',
  'وليد', 'سليمان', 'مروان', 'سفيان', 'طارق', 'بدر', 'عثمان', 'آدم', 'بلال', 'محمد',
  'أحمد', 'إسماعيل', 'سعد', 'نزار', 'معاذ', 'هشام', 'مصطفى', 'كريم', 'عادل', 'حسام',
  'صلاح الدين', 'نور الدين', 'عبد الرحمان', 'توفيق', 'أسامة', 'رشيد', 'يونس', 'عماد'
];

const FEMALE_FIRST_NAMES = [
  'فاطمة الزهراء', 'سارة', 'مريم', 'آية', 'خديجة', 'ندى', 'هبة', 'سلمى', 'إيمان', 'زينب',
  'شيماء', 'نهيلة', 'كوثر', 'هاجر', 'أميمة', 'صفاء', 'ياسمين', 'حفصة', 'وصال', 'إكرام',
  'دعاء', 'ملاك', 'روان', 'غيثة', 'لبنى', 'هدى', 'نورة', 'وفاء', 'كريمة', 'سميرة',
  'أسماء', 'رحمة', 'نادية', 'ابتسام', 'بشرى', 'حسناء', 'رانية', 'مروة'
];

const LAST_NAMES = [
  'الفاسي', 'المريني', 'الناصري', 'الإدريسي', 'العلوي', 'التازي', 'برادة', 'التلمساني',
  'الرحماني', 'الصالحي', 'الوزاني', 'الشرقاوي', 'اليعقوبي', 'البوشيخي', 'القادري', 'البقالي',
  'السجلماسي', 'الحسني', 'العلمي', 'بنسليمان', 'الداودي', 'الغازي', 'المنصوري', 'الزايدي',
  'الوردي', 'بنعيسى', 'بنعلي', 'المراكشي', 'أزهراي', 'البكاي', 'الزروالي', 'الكتاني',
  'الشاوي', 'العمراني', 'السليماني', 'الخرشفي', 'الرمضاني', 'الخالدي', 'الماجدي', 'العثماني'
];

const MASSAR_LETTERS = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'R', 'D', 'S'];

function pickFrom<T>(arr: T[], index: number): T {
  return arr[((index % arr.length) + arr.length) % arr.length];
}

function generateUniqueMassar(usedMassar: Set<string>, seed: number): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const letter = MASSAR_LETTERS[(seed + attempt) % MASSAR_LETTERS.length];
    const numBase = 130000000 + ((seed * 7919 + attempt * 104729) % 69999999);
    const candidate = `${letter}${String(numBase).padStart(9, '0').slice(0, 9)}`;
    if (!usedMassar.has(candidate)) {
      usedMassar.add(candidate);
      return candidate;
    }
  }
  const fallback = `F${String(Date.now()).slice(-9).padStart(9, '0')}`;
  usedMassar.add(fallback);
  return fallback;
}

function resolveBirthYearsMap(activeSeason: string): Record<string, number[]> {
  const match = activeSeason.match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 2026;
  const ageCats = getAgeCategoriesForSeason(activeSeason, undefined, 'cross_country');

  const getYears = (catId: string, defaults: number[]) => {
    const found = ageCats.find(c => normalizeCategoryKey(c.id) === catId);
    if (found && Array.isArray(found.years) && found.years.length > 0) {
      // For U12 keep primary range (3 realistic consecutive years starting at startYear - 12)
      if (catId === 'U12') {
        const minY = startYear - 12;
        const primaryYears = found.years.filter(y => y >= minY && y <= minY + 2);
        return primaryYears.length > 0 ? primaryYears : defaults;
      }
      return found.years;
    }
    return defaults;
  };

  return {
    U12: getYears('U12', [startYear - 12, startYear - 11, startYear - 10]),
    U15: getYears('U15', [startYear - 14, startYear - 13]),
    U18: getYears('U18', [startYear - 16, startYear - 15]),
    U20: getYears('U20', [startYear - 18, startYear - 17])
  };
}

export function getSchoolCycleLevel(school: School): 'Primary' | 'Middle' | 'High' {
  const fromType = normalizeCadreToLevelKey(school.type);
  if (fromType) return fromType;
  const fromName = inferLevelFromSchoolName(school.name);
  if (fromName) return fromName;
  return 'Middle';
}

export function getEligibleCrossCountrySchools(
  schools: School[],
  tournaments: Tournament[],
  ignoreTournamentFilters: boolean = false
): School[] {
  const ccTournaments = tournaments.filter(
    t => t.sportId === 'cross_country' && t.status !== 'Draft' && (t as any).isActive !== false
  );

  if (ignoreTournamentFilters || ccTournaments.length === 0) {
    return schools;
  }

  return schools.filter(school => {
    const cycle = getSchoolCycleLevel(school);
    return ccTournaments.some(
      t =>
        (
          isTeacherLevelAllowedForTournament(cycle, t.level, t.ageCategory, 'cross_country') ||
          (cycle === 'Primary' && isCrossCountryU15OpenToPrimary(t, ccTournaments))
        ) &&
        isSchoolSectorAllowedForTournament(school, t)
    );
  });
}

function resolveCategoriesForSchool(
  school: School,
  ccTournaments: Tournament[],
  includePrimaryU15: boolean,
  includeMiddleU18: boolean,
  ignoreTournamentFilters: boolean
): CrossCountryCategoryDef[] {
  const cycle = getSchoolCycleLevel(school);

  const allowedCategoryIds = new Set<string>();
  if (cycle === 'Primary') {
    allowedCategoryIds.add('U12');
    if (includePrimaryU15) allowedCategoryIds.add('U15');
  } else if (cycle === 'Middle') {
    allowedCategoryIds.add('U15');
    if (includeMiddleU18) allowedCategoryIds.add('U18');
  } else {
    allowedCategoryIds.add('U18');
    allowedCategoryIds.add('U20');
  }

  let cats = CROSS_COUNTRY_CATEGORIES.filter(c => allowedCategoryIds.has(c.category));

  if (!ignoreTournamentFilters && ccTournaments.length > 0) {
    const filtered = cats.filter(cat =>
      ccTournaments.some(t => {
        if (!isSchoolSectorAllowedForTournament(school, t)) return false;
        const levelOk =
          isTeacherLevelAllowedForTournament(cycle, t.level, t.ageCategory, 'cross_country') ||
          (cycle === 'Primary' && cat.category === 'U15' && isCrossCountryU15OpenToPrimary(t, ccTournaments));
        if (!levelOk) return false;

        const tCat = normalizeCategoryKey(t.ageCategory);
        const catMatches =
          !t.ageCategory ||
          t.ageCategory.includes('جميع') ||
          tCat === 'ALL' ||
          tCat === cat.category;

        const genMatches = !t.gender || t.gender === 'Mixed' || t.gender === cat.gender;
        return catMatches && genMatches;
      })
    );
    if (filtered.length > 0) {
      cats = filtered;
    }
  }

  return cats;
}

export async function generateCrossCountryDemoForSchools(
  options: CrossCountryDemoOptions
): Promise<CrossCountryDemoResult> {
  const {
    schools,
    teachers,
    existingStudents,
    tournaments,
    activeSeason,
    activeDirectorateId,
    teamCountPerCat,
    individualCountPerCat,
    affiliationMode,
    includePrimaryU15,
    includeMiddleU18,
    schoolFilter,
    ignoreTournamentFilters,
    autoConfirmSchools,
    currentUser
  } = options;

  const ccTournaments = tournaments.filter(
    t => t.sportId === 'cross_country' && t.status !== 'Draft' && (t as any).isActive !== false
  );

  let targetAffiliation: 'non_club' | 'club_affiliated' = 'non_club';
  if (affiliationMode === 'club_affiliated') {
    targetAffiliation = 'club_affiliated';
  } else if (affiliationMode === 'auto') {
    const hasNonClub = ccTournaments.some(t => !t.affiliationType || t.affiliationType === 'non_club' || t.affiliationType === 'open');
    const hasClub = ccTournaments.some(t => t.affiliationType === 'club_affiliated');
    if (hasClub && !hasNonClub) {
      targetAffiliation = 'club_affiliated';
    }
  }

  const eligibleSchools = getEligibleCrossCountrySchools(schools, tournaments, ignoreTournamentFilters);
  const birthYearsMap = resolveBirthYearsMap(activeSeason);

  const usedMassar = new Set<string>();
  existingStudents.forEach(s => {
    const m = (s.massarNumber || s.nationalId || '').trim().toUpperCase();
    if (m) usedMassar.add(m);
  });

  const existingCcStudents = existingStudents.filter(s => s.sportId === 'cross_country');

  const studentsToCreate: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>> = [];
  const schoolConfirmedBranches = new Map<
    string,
    {
      school: School;
      branches: Array<{ category: string; gender: 'Male' | 'Female'; affiliationType: string }>;
      coach: { fullName?: string; phone?: string; leaseNumber?: string; teacherId?: string };
    }
  >();

  const categoryCounts: Record<string, number> = {};
  let skippedSchoolsCount = 0;
  let globalRunnerSeq = 1;

  for (let sIdx = 0; sIdx < eligibleSchools.length; sIdx++) {
    const school = eligibleSchools[sIdx];
    const schoolCcExisting = existingCcStudents.filter(
      s =>
        (school.id && s.schoolId === school.id) ||
        (school.name && s.schoolName && schoolNamesMatch(s.schoolName, school.name))
    );

    if (schoolFilter === 'only_empty' && schoolCcExisting.length > 0) {
      skippedSchoolsCount++;
      continue;
    }

    const categoriesForSchool = resolveCategoriesForSchool(
      school,
      ccTournaments,
      includePrimaryU15,
      includeMiddleU18,
      ignoreTournamentFilters
    );

    if (categoriesForSchool.length === 0) {
      skippedSchoolsCount++;
      continue;
    }

    const matchedTeacher = teachers.find(
      t =>
        (school.id && t.schoolId === school.id) ||
        (t.workLocation && schoolNamesMatch(t.workLocation, school.name))
    );

    const resolvedCoach = resolveSchoolCoach({
      schoolName: school.name,
      sportId: 'cross_country',
      students: schoolCcExisting,
      schools,
      teachers,
      currentUser
    });

    const coachName =
      resolvedCoach.fullName ||
      matchedTeacher?.fullName ||
      school.coordinatorName ||
      school.teacherName ||
      'أستاذ(ة) التربية البدنية';
    const coachPhone = resolvedCoach.phone || matchedTeacher?.phone || school.phone || '';
    const coachLease = resolvedCoach.leaseNumber || matchedTeacher?.leaseNumber || '';
    const coachTeacherId = matchedTeacher?.id || currentUser?.id || `auto-teacher-${school.id}`;

    let schoolCreatedAny = false;
    const branchesForConfirm: Array<{ category: string; gender: 'Male' | 'Female'; affiliationType: string }> = [];

    for (const cat of categoriesForSchool) {
      const inCatExisting = schoolCcExisting.filter(
        s =>
          normalizeCategoryKey(s.category) === cat.category &&
          s.gender === cat.gender &&
          (s.affiliationType || 'non_club') === targetAffiliation
      );

      const existingTeamCount = inCatExisting.filter(s => (s.participationType || 'school_team') === 'school_team').length;
      const existingIndivCount = inCatExisting.filter(s => s.participationType === 'individual').length;

      const clampedTeamTarget = Math.min(5, Math.max(0, teamCountPerCat));
      const clampedIndivTarget = Math.min(3, Math.max(0, individualCountPerCat));

      const teamToAdd = Math.max(0, clampedTeamTarget - existingTeamCount);
      const indivToAdd = Math.max(0, clampedIndivTarget - existingIndivCount);

      if (teamToAdd === 0 && indivToAdd === 0) {
        continue;
      }

      const yearsPool = birthYearsMap[cat.category] || [2012, 2013];

      const pushRunner = (participationType: 'school_team' | 'individual', slotIdx: number) => {
        const seq = globalRunnerSeq++;
        const firstNames = cat.gender === 'Male' ? MALE_FIRST_NAMES : FEMALE_FIRST_NAMES;
        const firstName = pickFrom(firstNames, sIdx * 13 + seq + slotIdx);
        const lastName = pickFrom(LAST_NAMES, sIdx * 7 + seq * 3 + slotIdx);
        const fullName = `${firstName} ${lastName}`;

        const year = yearsPool[(seq + slotIdx) % yearsPool.length];
        const month = String(((seq + slotIdx) % 12) + 1).padStart(2, '0');
        const day = String(((seq * 3 + slotIdx) % 27) + 1).padStart(2, '0');
        const birthDate = `${year}-${month}-${day}`;

        const massarNumber = generateUniqueMassar(usedMassar, sIdx * 100 + seq);
        const dirId =
          school.directorateId ||
          (activeDirectorateId && activeDirectorateId !== 'all' ? activeDirectorateId : 'taourirt');

        studentsToCreate.push({
          fullName,
          massarNumber,
          gender: cat.gender,
          birthDate,
          birthYear: year,
          category: cat.category,
          schoolId: school.id,
          schoolName: school.name,
          commune: school.commune || '',
          sportId: 'cross_country',
          affiliationType: targetAffiliation,
          participationType,
          distance: cat.distance,
          coachName,
          ...(coachPhone ? { coachPhone } : {}),
          ...(coachLease ? { coachLeaseNumber: coachLease } : {}),
          directorateId: dirId,
          isDemoGenerated: true
        });

        categoryCounts[cat.id] = (categoryCounts[cat.id] || 0) + 1;
        schoolCreatedAny = true;
      };

      for (let t = 0; t < teamToAdd; t++) {
        pushRunner('school_team', t);
      }
      for (let i = 0; i < indivToAdd; i++) {
        pushRunner('individual', i + 10);
      }

      branchesForConfirm.push({
        category: cat.category,
        gender: cat.gender,
        affiliationType: targetAffiliation
      });
    }

    if (schoolCreatedAny) {
      schoolConfirmedBranches.set(school.id, {
        school,
        branches: branchesForConfirm,
        coach: {
          fullName: coachName,
          phone: coachPhone,
          leaseNumber: coachLease,
          teacherId: coachTeacherId
        }
      });
    } else {
      skippedSchoolsCount++;
    }
  }

  if (studentsToCreate.length > 0) {
    await DataService.addStudentsBulk(studentsToCreate);
  }

  let confirmedSchoolsCount = 0;
  if (autoConfirmSchools && schoolConfirmedBranches.size > 0) {
    const entries = Array.from(schoolConfirmedBranches.values());
    const ccRefTourn = ccTournaments[0];
    const deadline = ccRefTourn?.registrationDeadline;

    for (let i = 0; i < entries.length; i += 8) {
      const chunk = entries.slice(i, i + 8);
      await Promise.all(
        chunk.map(async entry => {
          try {
            await DataService.confirmSchoolParticipation({
              sportId: 'cross_country',
              sportName: 'العدو الريفي',
              tournamentId: ccRefTourn?.id,
              schoolId: entry.school.id,
              schoolName: entry.school.name,
              teacherId: entry.coach.teacherId || 'central-admin',
              teacherName: entry.coach.fullName || 'منسق المؤسسة',
              teacherPhone: entry.coach.phone,
              teacherLeaseNumber: entry.coach.leaseNumber,
              registrationDeadline: deadline,
              directorateId:
                entry.school.directorateId ||
                (activeDirectorateId && activeDirectorateId !== 'all' ? activeDirectorateId : 'taourirt'),
              seasonId: activeSeason,
              selectedBranches: entry.branches
            });
            confirmedSchoolsCount++;
          } catch (err) {
            console.warn('Error auto-confirming school participation:', entry.school.name, err);
          }
        })
      );
    }
  }

  return {
    createdStudentsCount: studentsToCreate.length,
    affectedSchoolsCount: schoolConfirmedBranches.size,
    confirmedSchoolsCount,
    skippedSchoolsCount,
    categoryCounts
  };
}

export async function clearGeneratedCrossCountryDemoParticipants(
  existingStudents: Student[]
): Promise<number> {
  const demoIds = existingStudents
    .filter(s => s.sportId === 'cross_country' && s.isDemoGenerated === true)
    .map(s => s.id);
  if (demoIds.length === 0) return 0;
  return await DataService.deleteStudentsBulk(demoIds);
}
