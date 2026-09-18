import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason, deduplicateById, getCategoryGenderLabel, isClubTournament, normalizeCategoryKey } from '../lib/dataService';
import { Tournament, User, Student, School, Sport, Match, Directorate } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import * as XLSX from 'xlsx';
import {
  Plus,
  Search,
  Trophy,
  Calendar,
  Filter,
  Sparkles,
  Trash2,
  Users,
  Layers,
  ShieldCheck,
  Phone,
  Star,
  Lock,
  Edit,
  AlertCircle,
  CheckCircle2,
  Settings,
  Award,
  Medal,
  Download,
  Palette
} from 'lucide-react';
import { CreateTournamentModal } from '../components/CreateTournamentModal';
import { EditTournamentModal } from '../components/EditTournamentModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { CrossCountryChampionshipModal } from '../components/CrossCountryChampionshipModal';
import { SportChampionshipModal } from '../components/SportChampionshipModal';
import { EditTournamentScheduleModal } from '../components/EditTournamentScheduleModal';
import { ProgramExportModal } from '../components/ProgramExportModal';
import { TournamentPosterModal } from '../components/TournamentPosterModal';
import { TeacherTeams } from './TeacherTeams';
import { OfficialLogos } from '../lib/dataService';
import toast from 'react-hot-toast';

export const Tournaments: React.FC = () => {
  const { userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') || searchParams.get('level');

  const [activeBranch, setActiveBranch] = useState<'provincial' | 'regional' | 'national' | 'registration'>(
    urlTab === 'regional' ? 'regional' :
    urlTab === 'national' ? 'national' :
    urlTab === 'registration' || urlTab === 'teams' ? 'registration' : 'provincial'
  );

  useEffect(() => {
    if (urlTab === 'regional') setActiveBranch('regional');
    else if (urlTab === 'national') setActiveBranch('national');
    else if (urlTab === 'registration' || urlTab === 'teams') setActiveBranch('registration');
    else if (urlTab === 'provincial') setActiveBranch('provincial');
  }, [urlTab]);

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [activeDirObj, setActiveDirObj] = useState<Directorate | null>(null);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeSeason, setActiveSeason] = useState('2026/2027');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCcModalOpen, setIsCcModalOpen] = useState(false);
  const [filterSport, setFilterSport] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PROGRAMMED' | 'UNPROGRAMMED' | 'MY_SCHOOL'>('ALL');

  const navigate = useNavigate();

  // Sport Championship Modal State
  const [selectedSportForModal, setSelectedSportForModal] = useState<Sport | null>(null);
  const [isSportModalOpen, setIsSportModalOpen] = useState(false);
  const [preselectedSportId, setPreselectedSportId] = useState<string | undefined>(undefined);

  // Schedule and Dates Modal State
  const [selectedSportForSchedule, setSelectedSportForSchedule] = useState<Sport | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Tournament Poster Modal State
  const [selectedSportForPoster, setSelectedSportForPoster] = useState<Sport | null>(null);
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);
  const [officialLogos, setOfficialLogos] = useState<OfficialLogos | undefined>(undefined);

  // Program Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalInitialSports, setExportModalInitialSports] = useState<string[]>([]);

  // Edit Specific Tournament Modal state
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);

  // Deletion Modal state
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sportToDeleteAll, setSportToDeleteAll] = useState<{ id: string; name: string } | null>(null);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Matching teacher profile from database to ensure real-time permission sync
  const currentTeacherProfile = useMemo(() => {
    if (!userProfile) return null;
    return teachers.find(t =>
      (t.id && t.id === userProfile.id) ||
      (t.email && userProfile.email && t.email.toLowerCase() === userProfile.email.toLowerCase()) ||
      (t.leaseNumber && userProfile.leaseNumber && t.leaseNumber === userProfile.leaseNumber)
    );
  }, [teachers, userProfile]);

  // Only CENTRAL_ADMIN and Technical Committee Heads can create, assign or delete tournaments
  const effectiveRole = currentTeacherProfile?.role || userProfile?.role;
  const isCentralAdmin = effectiveRole === 'CENTRAL_ADMIN';
  const isSportManager = effectiveRole === 'SPORT_MANAGER';
  const isTechCommitteeHead = userProfile?.isTechCommitteeHead === true || currentTeacherProfile?.isTechCommitteeHead === true;

  // Helper to format category for badges elegantly in Arabic
  const formatCategoryBadge = (catId: string, sportTournaments: Tournament[] = []) => {
    const norm = normalizeCategoryKey(catId);
    const match = activeSeason.match(/(\d{4})/);
    const startYear = match ? parseInt(match[1], 10) : 2026;

    // Determine which genders are present
    const catTournaments = sportTournaments.filter(t => normalizeCategoryKey(t.ageCategory) === norm);
    const hasMale = catTournaments.some(t => t.gender === 'Male' || t.gender === 'Mixed');
    const hasFemale = catTournaments.some(t => t.gender === 'Female' || t.gender === 'Mixed');
    
    if (norm === 'U12') {
      const label = (hasFemale && !hasMale) ? 'برعمات' : (hasFemale && hasMale) ? 'براعم / برعمات' : 'براعم';
      return {
        label,
        years: `مواليد ${startYear - 11} وما بعد`
      };
    }
    if (norm === 'U15') {
      const label = (hasFemale && !hasMale) ? 'صغيرات' : (hasFemale && hasMale) ? 'صغار / صغيرات' : 'صغار';
      return {
        label,
        years: `مواليد ${startYear - 14}/${startYear - 13}/${startYear - 12}`
      };
    }
    if (norm === 'U18') {
      const label = (hasFemale && !hasMale) ? 'فتيات' : (hasFemale && hasMale) ? 'فتيان / فتيات' : 'فتيان';
      return {
        label,
        years: `مواليد ${startYear - 17}/${startYear - 16}/${startYear - 15}`
      };
    }
    if (norm === 'U20') {
      const label = (hasFemale && !hasMale) ? 'شابات' : (hasFemale && hasMale) ? 'شبان / شابات' : 'شبان';
      return {
        label,
        years: `مواليد ${startYear - 17} وما بعد`
      };
    }
    return { label: catId, years: '' };
  };

  // Allowed sport IDs for technical committee head
  const allowedSportIds = useMemo(() => {
    if (isCentralAdmin) return null; // null means unrestricted
    if (isTechCommitteeHead) {
      const set = new Set<string>();
      if (userProfile?.techCommitteeSports) {
        userProfile.techCommitteeSports.forEach(s => set.add(s));
      }
      if (currentTeacherProfile?.techCommitteeSports) {
        currentTeacherProfile.techCommitteeSports.forEach(s => set.add(s));
      }
      if (userProfile?.sportId) set.add(userProfile.sportId);
      if (currentTeacherProfile?.sportId) set.add(currentTeacherProfile.sportId);
      return Array.from(set);
    }
    return [];
  }, [isCentralAdmin, isTechCommitteeHead, userProfile, currentTeacherProfile]);

  const canCreate = isCentralAdmin || (isTechCommitteeHead && (allowedSportIds === null || allowedSportIds.length > 0));

  // Determine manager sport specialty
  const managerSportId = useMemo(() => {
    if (!isSportManager) return undefined;
    if (userProfile?.sportId) return userProfile.sportId;
    if (currentTeacherProfile?.sportId) return currentTeacherProfile.sportId;
    const assignedTourn = tournaments.find(t =>
      (t.managerEmail && t.managerEmail.toLowerCase() === userProfile?.email?.toLowerCase()) ||
      (t.managerName && t.managerName === userProfile?.fullName)
    );
    return assignedTourn?.sportId || 'basketball';
  }, [userProfile, currentTeacherProfile, isSportManager, tournaments]);

  const canManageSport = (sportId: string) => {
    if (isCentralAdmin) return true;
    if (isTechCommitteeHead && allowedSportIds && allowedSportIds.includes(sportId)) return true;
    if (isSportManager && managerSportId === sportId) return true;
    return false;
  };

  useEffect(() => {
    loadData();
    const handleDirChange = () => {
      loadData();
    };
    window.addEventListener('directorateChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [tournList, sportsList, season, allTeachers, studentsList, schoolsList, matchList, activeDir, logos] = await Promise.all([
        DataService.getTournaments(),
        DataService.getSportsConfig(),
        DataService.getActiveSeason(),
        DataService.getTeachers(),
        DataService.getStudents(),
        DataService.getSchools(),
        DataService.getMatches(),
        DataService.getActiveDirectorate(),
        DataService.getOfficialLogos().catch(() => undefined)
      ]);

      const dirTeachers = allTeachers.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      const dirStudents = studentsList.filter(st => (st.directorateId || 'taourirt') === activeDirId);
      const dirSchools = schoolsList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      const dirMatches = matchList.filter(m => (m.directorateId || 'taourirt') === activeDirId);
      const dirTournaments = tournList.filter(t => (t.directorateId || 'taourirt') === activeDirId);

      setActiveDirObj(activeDir);
      setTournaments(deduplicateById(dirTournaments));
      setSportsConfig(sportsList);
      setTeachers(deduplicateById(dirTeachers));
      setAllStudents(deduplicateById(dirStudents));
      setSchools(deduplicateById(dirSchools));
      setMatches(deduplicateById(dirMatches));
      if (logos) {
        setOfficialLogos(logos);
      }
      if (season) {
        setActiveSeason(season);
      }
    } catch (e) {
      console.error(e);
      toast.error('تعذر تحميل بيانات البطولات والرياضات');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (newTourns: Omit<Tournament, 'id'> | Omit<Tournament, 'id'>[]) => {
    try {
      const items = Array.isArray(newTourns) ? newTourns : [newTourns];
      if (items.length === 0) return;

      const targetSportId = items[0].sportId;
      const targetSeasonId = items[0].seasonId || activeSeason;
      const targetDirId = items[0].directorateId || DataService.getActiveDirectorateId();

      // Get latest tournaments from local/Firestore to have full up to date list
      const latestTournaments = await DataService.getTournaments();

      // Find all existing tournaments for this sport in this season & directorate
      const existingSportTournaments = latestTournaments.filter(t => 
        t.sportId === targetSportId && 
        t.seasonId === targetSeasonId &&
        (!targetDirId || !t.directorateId || t.directorateId === targetDirId)
      );

      const isEditMode = existingSportTournaments.length > 0;

      if (!isEditMode) {
        const createdItems: Tournament[] = [];
        for (const item of items) {
          const created = await DataService.addTournament(item);
          createdItems.push(created);
        }

        const newSelectedCats = Array.from(new Set(items.map(i => normalizeCategoryKey(i.ageCategory)).filter(Boolean)));
        await DataService.updateSportCategories(targetSportId, newSelectedCats, undefined, undefined, undefined, undefined, true);

        await loadData();
        toast.success(`تم إنشاء وبرمجة ${createdItems.length} ${createdItems.length > 1 ? 'بطولات' : 'بطولة'} بنجاح!`);
      } else {
        // Edit / Re-configuration mode:
        // 1. Update matching tournaments or add newly introduced combinations
        let updatedCount = 0;
        let createdCount = 0;

        for (const item of items) {
          const matched = existingSportTournaments.find(existing =>
            normalizeCategoryKey(existing.ageCategory) === normalizeCategoryKey(item.ageCategory) &&
            existing.gender === item.gender &&
            (existing.affiliationType || 'non_club') === (item.affiliationType || 'non_club')
          );

          if (matched) {
            await DataService.updateTournament(matched.id, {
              name: item.name,
              startDate: item.startDate,
              endDate: item.endDate,
              registrationDeadline: item.registrationDeadline,
              level: item.level,
              scope: item.scope,
              status: item.status,
              description: item.description,
              affiliationType: item.affiliationType
            });
            updatedCount++;
          } else {
            await DataService.addTournament(item);
            createdCount++;
          }
        }

        // 2. Delete tournaments that were unchecked/removed by the user in this re-configuration
        const toDelete = existingSportTournaments.filter(existing =>
          !items.some(item =>
            normalizeCategoryKey(existing.ageCategory) === normalizeCategoryKey(item.ageCategory) &&
            existing.gender === item.gender &&
            (existing.affiliationType || 'non_club') === (item.affiliationType || 'non_club')
          )
        );

        for (const rem of toDelete) {
          await DataService.deleteTournament(rem.id);
        }

        // 3. Update the sport's configured categories in Firestore and local config
        const newSelectedCats = Array.from(new Set(items.map(i => normalizeCategoryKey(i.ageCategory)).filter(Boolean)));
        await DataService.updateSportCategories(targetSportId, newSelectedCats, undefined, undefined, undefined, undefined, true);

        // 4. Reload full state
        await loadData();

        toast.success(`تم تحديث إعدادات البطولة بنجاح (${items.length} ${items.length > 1 ? 'فروع/أجناس مبرمجة' : 'فرع مبرمج'})`);
      }

      // Refresh sports config to update statuses
      const updatedSports = await DataService.getSportsConfig();
      setSportsConfig(updatedSports);
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء حفظ البطولة');
    }
  };

  const handleOpenProgramModal = (sportId?: string) => {
    setPreselectedSportId(sportId);
    setIsModalOpen(true);
  };

  const promptDeleteTournament = (t: Tournament, e: React.MouseEvent) => {
    e.stopPropagation();
    setTournamentToDelete(t);
  };

  const handleConfirmDelete = async () => {
    if (!tournamentToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteTournament(tournamentToDelete.id);
      setTournaments(prev => prev.filter(t => t.id !== tournamentToDelete.id));
      toast.success('تم حذف البطولة بنجاح');
      setTournamentToDelete(null);
    } catch (e) {
      toast.error('تعذر حذف البطولة');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (!sportToDeleteAll) return;
    setIsDeletingAll(true);
    try {
      await DataService.bulkDeleteTournamentsBySport(sportToDeleteAll.id);
      
      // Update local states
      setTournaments(prev => prev.filter(t => t.sportId !== sportToDeleteAll.id));
      
      const updatedSports = await DataService.getSportsConfig();
      setSportsConfig(updatedSports);
      
      toast.success(`تم مسح كافة بطولات رياضة "${sportToDeleteAll.name}" وإعادتها لحالة غير مبرمجة.`);
      setSportToDeleteAll(null);
    } catch (e) {
      toast.error('تعذر مسح بطولات الرياضة');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleExportAllCrossCountry = async () => {
    const loadToastId = toast.loading('جاري تحضير وتصدير ملف فئات العدو الريفي الثمانية...');
    try {
      const allStudents = await DataService.getStudents();
      const ccStudents = allStudents.filter(s => s.sportId === 'cross_country');

      if (ccStudents.length === 0) {
        toast.dismiss(loadToastId);
        toast.error('لا يوجد تلاميذ مسجلين في العدو الريفي حالياً لتصديرهم.');
        return;
      }

      const workbook = XLSX.utils.book_new();
      let hasData = false;

      const ccCategories = [
        { category: 'U12', gender: 'Male', label: 'البراعم ذكور' },
        { category: 'U12', gender: 'Female', label: 'البرعمات إناث' },
        { category: 'U15', gender: 'Male', label: 'الصغار ذكور' },
        { category: 'U15', gender: 'Female', label: 'الصغيرات إناث' },
        { category: 'U18', gender: 'Male', label: 'الفتيان ذكور' },
        { category: 'U18', gender: 'Female', label: 'الفتيات إناث' },
        { category: 'U20', gender: 'Male', label: 'الشبان ذكور' },
        { category: 'U20', gender: 'Female', label: 'الشابات إناث' },
      ];

      ccCategories.forEach(cat => {
        const participants = ccStudents.filter(s => 
          s.category === cat.category && 
          s.gender === cat.gender
        );

        const sheetData = participants.length > 0 
          ? participants.map((p, index) => ({
              'الرقم الترتيبي': index + 1,
              'الاسم والنسب': p.fullName,
              'الجنس': p.gender === 'Male' ? 'ذكر' : 'أنثى',
              'تاريخ الازدياد': p.birthDate,
              'الفئة الرياضية': p.category,
              'المؤسسة التعليمية': p.schoolName,
              'نوع المشاركة': p.participationType === 'school_team' ? 'فريق المؤسسة' : 'فردي',
              'المسافة المبرمجة': p.distance || '',
            }))
          : [
              {
                'تنبيه': 'لا يوجد تلاميذ مسجلين في هذه الفئة بعد'
              }
            ];

        if (participants.length > 0) {
          hasData = true;
        }

        const worksheet = XLSX.utils.json_to_sheet(sheetData);
        worksheet['!views'] = [{ RTL: true }];
        const sheetName = cat.label.substring(0, 30);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      });

      const fileName = `ملف_العدو_الريفي_الموحد_للفئات_الثمانية_${activeSeason.replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.dismiss(loadToastId);
      if (hasData) {
        toast.success('تم تصدير الملف الموحد لجميع الفئات الثمانية بنجاح!');
      } else {
        toast.success('تم تصدير هيكل الملف الموحد (الفئات فارغة حالياً)');
      }
    } catch (error) {
      console.error('Error exporting cross country workbook:', error);
      toast.dismiss(loadToastId);
      toast.error('حدث خطأ أثناء محاولة تصدير البيانات بصيغة إكسيل.');
    }
  };

  // Group tournaments by sport & check programming status
  const sportsWithTournamentData = useMemo(() => {
    const seasonalCats = getAgeCategoriesForSeason(activeSeason);
    const isTeacherRole = effectiveRole === 'TEACHER';
    const teacherSchoolName = userProfile?.workLocation;

    return sportsConfig.map(sport => {
      const sportTournaments = tournaments.filter(t => t.sportId === sport.id);
      
      // Determine if programmed
      const isProgrammed = sportTournaments.length > 0
        ? true
        : (sport.isProgrammed !== undefined
          ? sport.isProgrammed
          : (sport.ageCategories && sport.ageCategories.length > 0 && sport.studentLimit !== undefined && sport.studentLimit > 0));

      // Technical head
      const techHead = teachers.find(tch =>
        tch.isTechCommitteeHead &&
        (tch.techCommitteeSports?.includes(sport.id) || tch.sportId === sport.id)
      );

      // Categories list configured
      const categoriesList = (sport.ageCategories && sport.ageCategories.length > 0)
        ? sport.ageCategories
        : (sportTournaments.length > 0 
          ? Array.from(new Set(sportTournaments.map(t => t.ageCategory).filter(Boolean)))
          : seasonalCats.map(c => c.id));

      // Total students registered in this sport across all schools
      const registeredCount = allStudents.filter(s => s.sportId === sport.id).length;

      // School-specific participation (for teachers/schools)
      const schoolSportStudents = teacherSchoolName
        ? allStudents.filter(s => s.sportId === sport.id && s.schoolName === teacherSchoolName)
        : [];
      const hasParticipations = schoolSportStudents.length > 0;
      const schoolRegisteredCount = schoolSportStudents.length;

      return {
        sport,
        sportTournaments,
        isProgrammed,
        techHead,
        categoriesList,
        registeredCount,
        hasParticipations,
        schoolRegisteredCount,
        isTeacherRole
      };
    });
  }, [sportsConfig, tournaments, teachers, allStudents, activeSeason, effectiveRole, userProfile]);

  // Filtered sports list (Always sorting programmed tournaments to the top)
  const filteredSports = useMemo(() => {
    return sportsWithTournamentData
      .filter(item => {
        const { sport, isProgrammed, techHead, hasParticipations } = item;

        // Filter by Sport
        if (filterSport !== 'ALL' && sport.id !== filterSport) return false;

        // Filter by Status
        if (filterStatus === 'PROGRAMMED' && !isProgrammed) return false;
        if (filterStatus === 'UNPROGRAMMED' && isProgrammed) return false;
        if (filterStatus === 'MY_SCHOOL' && !hasParticipations) return false;

        // Search filter
        if (search.trim()) {
          const q = search.toLowerCase();
          const matchName = sport.name.toLowerCase().includes(q);
          const matchDesc = (sport.description || '').toLowerCase().includes(q);
          const matchHead = techHead?.fullName.toLowerCase().includes(q);
          return matchName || matchDesc || matchHead;
        }

        return true;
      })
      .sort((a, b) => {
        // Programmed tournaments ALWAYS on top
        if (a.isProgrammed && !b.isProgrammed) return -1;
        if (!a.isProgrammed && b.isProgrammed) return 1;
        return 0;
      });
  }, [sportsWithTournamentData, filterSport, filterStatus, search]);

  const handleOpenSportModal = (sport: Sport) => {
    setSelectedSportForModal(sport);
    setIsSportModalOpen(true);
  };

  return (
    <div className="space-y-4" dir="rtl">
      {activeBranch === 'registration' ? (
        <TeacherTeams />
      ) : (
        <div className="space-y-4">
          {/* Top action header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-3xs">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-slate-800">
                  {activeBranch === 'regional' && 'البطولة الجهوية للرياضة المدرسية (جهة الشرق)'}
                  {activeBranch === 'national' && 'البطولة الوطنية المدرسية (الجامعة الملكية المغربية للرياضة المدرسية)'}
                  {activeBranch === 'provincial' && `بطولات الرياضات الإقليمية (${activeDirObj?.name || 'المديرية الإقليمية'})`}
                </h2>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                  activeBranch === 'regional' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  activeBranch === 'national' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {activeBranch === 'regional' ? 'أكاديمية جهة الشرق' : activeBranch === 'national' ? 'القطاع الوطني' : (activeDirObj?.shortName || activeDirObj?.name || 'المديرية الإقليمية')}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {activeBranch === 'regional' && 'استعراض ومتابعة البطولات والتأهيلات الجهوية على مستوى كافة مديريات جهة الشرق.'}
                {activeBranch === 'national' && 'برمجة وتتبع المشاركات في البطولات الوطنية المدرسية المنظمة تحت إشراف الوزارة والجامعة الملكية.'}
                {activeBranch === 'provincial' && 'تجميع كافة الفئات داخل بطولة كل رياضة. تكون الرياضات غير المعدة باللون الرمادي إلى حين إعداد ضوابطها وبرمجتها.'}
              </p>
            </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCreate && (
            <button
              onClick={() => handleOpenProgramModal()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة / برمجة بطولة جديدة</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice for Sport Managers */}
      {isSportManager && (
        <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50/70 to-slate-50 border border-blue-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-blue-900 shadow-3xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl font-bold shadow-xs shrink-0">
              {managerSportId ? SPORTS_MAP[managerSportId]?.icon : '🏅'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-slate-800">
                  فضاء مسؤول النشاط الرياضي {managerSportId ? `(${SPORTS_MAP[managerSportId]?.name})` : ''}
                </span>
                <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  صلاحيات مخصصة
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                يمكنك الاطلاع على ضوابط البطولة المعتمدة، برمجة المباريات، وتوجيه المؤسسات للتباري.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            <a
              href="/matches"
              className="px-3 py-1.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors shadow-xs"
            >
              برمجة مباراة الآن
            </a>
            <a
              href="/schools"
              className="px-3 py-1.5 bg-white text-blue-700 border border-blue-300 rounded-xl font-bold text-xs hover:bg-blue-50 transition-colors"
            >
              المؤسسات والفرق
            </a>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-3xs">
        <div className="flex flex-1 items-center px-2 w-full">
          <Search className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            placeholder="ابحث عن رياضة، بطولة، أو اسم رئيس اللجنة التقنية المكلف..."
            className="w-full border-0 focus:ring-0 text-xs py-1 text-slate-800 placeholder-slate-400 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto border-t md:border-t-0 md:border-r border-slate-100 pt-2 md:pt-0 md:pr-3 shrink-0">
          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">الحالة:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="ALL">جميع الحالات</option>
              <option value="PROGRAMMED">🟢 المبرمجة والمفتوحة للتسجيل</option>
              {userProfile?.role === 'TEACHER' && (
                <option value="MY_SCHOOL">🏫 رياضات تشارك فيها مؤسستي</option>
              )}
              <option value="UNPROGRAMMED">⚪ غير المبرمجة (في طور الإعداد)</option>
            </select>
          </div>

          {/* Sport Filter Dropdown */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">الرياضة:</span>
            <select
              value={filterSport}
              onChange={(e) => setFilterSport(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer max-w-[160px]"
            >
              <option value="ALL">🏆 جميع الرياضات</option>
              {sportsConfig.map(s => (
                <option key={s.id} value={s.id}>
                  {s.icon || '🏆'} {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSports.length > 0 ? (
            filteredSports.map((item, index) => {
              const { sport, sportTournaments, isProgrammed, techHead, categoriesList, registeredCount, hasParticipations, schoolRegisteredCount } = item;
              const isManagerSpecialty = managerSportId && sport.id === managerSportId;
              const canManageThis = canManageSport(sport.id);

              // If regional or national branch, show locked/closed state for all sports
              if (activeBranch === 'regional' || activeBranch === 'national') {
                const isReg = activeBranch === 'regional';
                return (
                  <div
                    key={sport.id}
                    className="flex flex-col rounded-2xl bg-slate-50 border border-slate-200 text-slate-500 overflow-hidden shadow-2xs opacity-90 transition-all hover:opacity-100"
                  >
                    <div className="p-4 md:p-5 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-slate-100 text-xl flex items-center justify-center border border-slate-200 grayscale opacity-80">
                            {sport.icon || '🏆'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {isReg ? 'البطولة الجهوية' : 'البطولة الوطنية'}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400">الموسم {activeSeason}</span>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                          <Lock className="h-3 w-3 text-slate-500" />
                          {isReg ? 'مغلقة جهوياً' : 'مغلقة وطنياً'}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-700 leading-snug">
                        {isReg ? `البطولة الجهوية المدرسية لـ ${sport.name}` : `البطولة الوطنية المدرسية لـ ${sport.name}`}
                      </h3>

                      <p className="text-xs text-slate-500 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-slate-200/60">
                        {isReg
                          ? 'هذه البطولة مغلقة حالياً. سيتم تفعيل التسجيل التلقائي واستيراد المتأهلين من المديريات فور إعداد وبرمجة البطولة من طرف الأكاديمية الجهوية للتربية والتكوين لجهة الشرق.'
                          : 'هذه البطولة مغلقة حالياً. سيتم تفعيل المشاركة فور إعداد وبرمجة البطولة وتحديد التواريخ من طرف الوزارة والجامعة الملكية المغربية للرياضة المدرسية.'}
                      </p>

                      {/* Organizer info */}
                      <div className="bg-slate-100/50 p-2.5 rounded-xl border border-slate-200/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <ShieldCheck className="h-4 w-4 text-slate-500" />
                          <span>الجهة المنظمة:</span>
                        </div>
                        <span className="font-bold text-slate-700">
                          {isReg ? 'أكاديمية جهة الشرق' : 'الوزارة والجامعة الملكية للرياضة المدرسية'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-100/60 border-t border-slate-200 flex items-center justify-between gap-2">
                      <button
                        disabled
                        className="w-full py-2 px-3 bg-slate-200 text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed border border-slate-300"
                      >
                        <Lock className="h-3.5 w-3.5" />
                        <span>في انتظار البرمجة {isReg ? 'الجهوية' : 'الوطنية'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              // 1. Cross Country Championship Card
              if (sport.id === 'cross_country' && isProgrammed) {
                return (
                  <div
                    key={sport.id}
                    onClick={() => setIsCcModalOpen(true)}
                    className="flex flex-col rounded-2xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 shadow-md overflow-hidden transition-all hover:shadow-xl hover:border-blue-500/50 cursor-pointer group"
                  >
                    <div className="p-4 md:p-5 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-11 h-11 rounded-2xl bg-white/10 backdrop-blur-xs text-2xl flex items-center justify-center border border-white/20 shadow-xs group-hover:scale-105 transition-transform">
                            🏃‍♂️
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                بطولة العدو الريفي
                              </span>
                              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                8 فئات مدمجة
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-300">الموسم {activeSeason}</span>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            بطولة واحدة شاملة
                          </span>
                          <CountdownTimer deadline={sportTournaments.find(t => t.registrationDeadline)?.registrationDeadline} compact={true} />
                        </div>
                      </div>

                      <div>
                        <h3 className="text-base font-black text-white leading-snug group-hover:text-blue-200 transition-colors">
                          البطولة الإقليمية المدرسية للعدو الريفي
                        </h3>
                        <p className="text-xs text-slate-300 mt-1 line-clamp-2 leading-relaxed font-medium">
                          تجمع كافة السباقات للفئات العمرية الـ8 الذكور والإناث.
                        </p>
                      </div>

                      {/* Categories Pills */}
                      <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl space-y-1.5">
                        <div className="text-[10px] font-bold text-slate-300 flex items-center justify-between">
                          <span>الفئات الثمانية المعتمدة:</span>
                          <span className="text-emerald-400 font-mono text-[9px]">{registeredCount} تلميذ(ة)</span>
                        </div>
                        <div className="flex flex-wrap gap-1 text-[10px]">
                          <span className="bg-blue-500/20 text-blue-200 px-1.5 py-0.5 rounded border border-blue-500/30">البراعم / البرعمات</span>
                          <span className="bg-emerald-500/20 text-emerald-200 px-1.5 py-0.5 rounded border border-emerald-500/30">الصغار / الصغيرات</span>
                          <span className="bg-amber-500/20 text-amber-200 px-1.5 py-0.5 rounded border border-amber-200/30">الفتيان / الفتيات</span>
                          <span className="bg-purple-500/20 text-purple-200 px-1.5 py-0.5 rounded border border-purple-200/30">الشبان / الشابات</span>
                        </div>
                      </div>

                      {/* Technical Head */}
                      <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <ShieldCheck className="h-4 w-4 text-emerald-400" />
                          <span>رئيس اللجنة التقنية:</span>
                        </div>
                        <span className="font-bold text-amber-300">
                          {techHead ? techHead.fullName : 'ذ. عبد الرحيم بلقاسم'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-white/10 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsCcModalOpen(true);
                        }}
                        className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                      >
                        <Layers className="h-4 w-4" />
                        <span>دخول البطولة واستعراض الفئات الـ8</span>
                      </button>

                      {canManageThis && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSportForPoster(sport);
                              setIsPosterModalOpen(true);
                            }}
                            title="إعداد وتصميم ملصق إعلان البطولة"
                            className="p-2 bg-purple-500/30 hover:bg-purple-500/50 text-purple-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 border border-purple-400/30 flex items-center gap-1"
                          >
                            <Palette className="h-4 w-4" />
                            <span className="hidden sm:inline">إعداد الملصق</span>
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSportForSchedule(sport);
                              setIsScheduleModalOpen(true);
                            }}
                            title="تعديل وبرمجة تواريخ البطولة وآخر أجل للتسجيل"
                            className="p-2 bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 border border-amber-400/30 flex items-center gap-1"
                          >
                            <Calendar className="h-4 w-4" />
                            <span className="hidden sm:inline">برمجة التواريخ</span>
                          </button>

                          {isCentralAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSportToDeleteAll({ id: sport.id, name: sport.name });
                              }}
                              title="مسح كافة بطولات هذه الرياضة"
                              className="p-2 bg-red-500/30 hover:bg-red-500/50 text-red-200 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 border border-red-400/30 flex items-center gap-1"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="hidden sm:inline">مسح البطولات</span>
                            </button>
                          )}
                        </>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportAllCrossCountry();
                        }}
                        title="تصدير ملف العدو الريفي الموحد Excel"
                        className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              }

              // 2. UNPROGRAMMED SPORT CARD (Greyed Out Style)
              if (!isProgrammed) {
                return (
                  <div
                    key={sport.id}
                    className="flex flex-col rounded-2xl bg-slate-100/90 border border-dashed border-slate-300 text-slate-500 overflow-hidden transition-all hover:border-slate-400 hover:bg-slate-100 shadow-3xs opacity-85 hover:opacity-100"
                  >
                    <div className="p-4 md:p-5 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-slate-200/80 text-xl flex items-center justify-center border border-slate-300/60 grayscale opacity-80">
                            {sport.icon || '🏆'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                {sport.name}
                              </span>
                            </div>
                            <span className="text-[10px] font-medium text-slate-400">الموسم {activeSeason}</span>
                          </div>
                        </div>

                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                          <Lock className="h-3 w-3 text-slate-500" />
                          غير مبرمجة بعد
                        </span>
                      </div>

                      <h3 className="text-sm font-bold text-slate-700 leading-snug">
                        البطولة الإقليمية لـ {sport.name}
                      </h3>

                      <p className="text-xs text-slate-500 leading-relaxed bg-white/60 p-2.5 rounded-xl border border-slate-200/60">
                        في انتظار تحديد الفئات العمرية وضوابط المشاركة من طرف المسير المركزي أو رئيس اللجنة التقنية المكلف.
                      </p>

                      {/* Technical Committee Head Info */}
                      <div className="bg-slate-200/50 p-2.5 rounded-xl border border-slate-300/50 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <ShieldCheck className="h-4 w-4 text-slate-500" />
                          <span>رئيس اللجنة التقنية:</span>
                        </div>
                        <span className="font-bold text-slate-700">
                          {techHead ? techHead.fullName : 'لم يتم التعيين بعد'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-200/60 border-t border-slate-300/60 flex items-center justify-between gap-2">
                      {canManageThis ? (
                        <button
                          onClick={() => handleOpenProgramModal(sport.id)}
                          className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          <Settings className="h-4 w-4" />
                          <span>إعداد وبرمجة البطولة الآن</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full py-2 px-3 bg-slate-300/80 text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>في طور الإعداد (غير مبرمجة)</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              // 3. PROGRAMMED SPORT CARD (Active Color Card)
              const mainTourn = sportTournaments.length > 0 ? sportTournaments[0] : null;
              const hasClubTournaments = sportTournaments.some(t => isClubTournament(t));
              const hasSchoolOnlyTournaments = sportTournaments.some(t => !isClubTournament(t));
              const hasBothClasses = hasClubTournaments && hasSchoolOnlyTournaments;
              const isClub = isClubTournament(mainTourn) && !hasBothClasses;

              return (
                <div
                  key={sport.id}
                  className={`flex flex-col rounded-2xl border shadow-3xs overflow-hidden transition-all hover:shadow-md ${
                    isClub
                      ? 'bg-amber-50/90 border-amber-300 hover:border-amber-400'
                      : 'bg-white border-slate-200 hover:border-blue-300'
                  } ${
                    isManagerSpecialty
                      ? 'ring-2 ring-blue-500/20'
                      : ''
                  }`}
                >
                  <div className="p-4 md:p-5 flex-1 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-2xl text-xl flex items-center justify-center border shadow-3xs ${
                          isClub ? 'bg-amber-100/80 border-amber-300' : 'bg-blue-50 border-blue-100'
                        }`}>
                          {sport.icon || '🏆'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-blue-900 uppercase tracking-wider">
                              {sport.name}
                            </span>
                            {hasBothClasses ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[9px] font-extrabold bg-amber-100 text-amber-950 px-1.5 py-0.2 rounded border border-amber-300 shadow-3xs">
                                  🟡 للمنتمين للأندية
                                </span>
                                <span className="text-[9px] font-extrabold bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded border border-slate-300 shadow-3xs">
                                  ⚪ لا منتمين
                                </span>
                              </div>
                            ) : isClub ? (
                              <span className="text-[9px] font-extrabold bg-amber-200 text-amber-950 px-1.5 py-0.2 rounded border border-amber-400 shadow-3xs">
                                🟡 للمنتمين للأندية
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded border border-slate-300 shadow-3xs">
                                ⚪ لا منتمين
                              </span>
                            )}
                            {isManagerSpecialty && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-200">
                                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                تخصصك
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-slate-400">الموسم {activeSeason}</span>
                        </div>
                      </div>

                        <div className="flex flex-col items-end gap-1">
                          {(() => {
                            const statusVal = mainTourn?.status || 'Scheduled';
                            if (statusVal === 'Ongoing') {
                              return (
                                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                  🔵 جارية
                                </span>
                              );
                            } else if (statusVal === 'Completed' || statusVal === 'Archived') {
                              return (
                                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                  🏆 منتهية (مؤرشفة)
                                </span>
                              );
                            } else {
                              return (
                                <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  🟢 مفتوحة للتسجيل
                                </span>
                              );
                            }
                          })()}
                          <CountdownTimer deadline={sportTournaments.find(t => t.registrationDeadline)?.registrationDeadline} compact={true} />
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-800 leading-snug">
                        البطولة الإقليمية المدرسية لـ {sport.name}
                      </h3>
                      {userProfile?.role === 'TEACHER' && (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                          hasParticipations
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border-amber-200'
                        }`}>
                          {hasParticipations ? `🏫 مسجل: ${schoolRegisteredCount}` : '🏫 غير مسجل بعد'}
                        </span>
                      )}
                    </div>

                     {/* Configured Categories & Limit */}
                     <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                       <div className="flex items-start justify-between gap-2">
                         <span className="text-slate-500 mt-1 shrink-0">الفئات المدمجة:</span>
                         <div className="flex flex-col gap-1 items-end max-w-[75%]">
                           {categoriesList.slice(0, 4).map(c => {
                             const badge = formatCategoryBadge(c, sportTournaments);
                             return (
                               <span 
                                 key={c} 
                                 title={badge.years}
                                 className="bg-blue-50/80 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-blue-100 flex flex-col items-end cursor-help hover:bg-blue-100/90 transition-all text-right w-full"
                               >
                                 <span>{badge.label}</span>
                                 {badge.years && (
                                   <span className="text-[8px] text-slate-500 font-normal leading-tight mt-0.5">
                                     {badge.years}
                                   </span>
                                 )}
                               </span>
                             );
                           })}
                         </div>
                       </div>

                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-500">إجمالي المسجلين بالإقليم:</span>
                        <strong className="text-emerald-700 font-bold">{registeredCount} تلميذ(ة)</strong>
                      </div>
                    </div>

                    {/* Technical Committee Head */}
                    <div className="bg-gradient-to-br from-slate-50 to-blue-50/50 p-2.5 rounded-xl border border-blue-100/90 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <ShieldCheck className="h-4 w-4 text-blue-600" />
                        <span>رئيس اللجنة التقنية:</span>
                      </div>
                      <span className="font-bold text-slate-900 text-[11px]">
                        {techHead ? techHead.fullName : 'لم يتم التعيين بعد'}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleOpenSportModal(sport)}
                      className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                    >
                      <Layers className="h-4 w-4" />
                      <span>تسجيل الفرق والمشاركين</span>
                    </button>

                    {canManageThis && (
                      <div className="flex items-center gap-1.5">
                        {isCentralAdmin && (
                          <button
                            onClick={() => setSportToDeleteAll({ id: sport.id, name: sport.name })}
                            title="مسح كافة بطولات هذه الرياضة وإعادتها لحالة غير مبرمجة"
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200 bg-white flex items-center justify-center shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedSportForPoster(sport);
                            setIsPosterModalOpen(true);
                          }}
                          title="إعداد وتصميم ملصق إعلان البطولة"
                          className="py-2 px-2.5 text-purple-600 hover:text-purple-800 hover:bg-purple-50 rounded-xl transition-colors cursor-pointer border border-purple-200 bg-purple-50/60 flex items-center gap-1"
                        >
                          <Palette className="h-4 w-4" />
                          <span className="text-[11px] font-bold">إعداد الملصق</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedSportForSchedule(sport);
                            setIsScheduleModalOpen(true);
                          }}
                          title="تعديل وبرمجة تواريخ البطولة وآخر أجل للتسجيل"
                          className="py-2 px-2.5 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer border border-amber-200 bg-amber-50/60 flex items-center gap-1"
                        >
                          <Calendar className="h-4 w-4" />
                          <span className="text-[11px] font-bold">برمجة التواريخ</span>
                        </button>

                        <button
                          onClick={() => {
                            handleOpenProgramModal(sport.id);
                          }}
                          title="تعديل فئات وجنس وإعدادات البطولة"
                          className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer border border-slate-200 bg-white"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-2xl border border-slate-200 text-center">
              <Trophy className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700 mb-1">لا توجد رياضات مطابقة للبحث</p>
              <p className="text-xs text-slate-400 mb-4">يمكنك تغيير فلتر الرياضة أو الفلتر المعتمد أعلاه</p>
            </div>
          )}
        </div>
      )}
      </div>
    )}

      {/* Create / Program Tournament Modal */}
      <CreateTournamentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setPreselectedSportId(undefined);
        }}
        allowedSportIds={allowedSportIds}
        preselectedSportId={preselectedSportId}
        onCreated={handleCreateTournament}
      />

      {/* Edit Tournament Modal */}
      <EditTournamentModal
        isOpen={!!editingTournament}
        tournament={editingTournament}
        onClose={() => setEditingTournament(null)}
        onUpdated={loadData}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!tournamentToDelete}
        onClose={() => setTournamentToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="حذف البطولة الإقليمية"
        message="هل أنت متأكد من رغبتك في حذف هذه البطولة نهائياً؟ سيتم مسح كافة البيانات والإعدادات المرتبطة بها."
        itemName={tournamentToDelete?.name}
        isDeleting={isDeleting}
      />

      {/* Confirm Delete All Modal */}
      <ConfirmDeleteModal
        isOpen={!!sportToDeleteAll}
        onClose={() => setSportToDeleteAll(null)}
        onConfirm={handleConfirmDeleteAll}
        title="مسح جميع بطولات الرياضة"
        message="تحذير: هل أنت متأكد من رغبتك في مسح كافة الفئات والبطولات المبرمجة لهذه الرياضة نهائياً؟ سيتم إلغاء برمجتها وإعادتها لحالتها الأولية ومسح جميع البطولات المحددة لها."
        itemName={sportToDeleteAll?.name}
        isDeleting={isDeletingAll}
      />

      {/* Cross Country Championship Unified 8 Categories Modal */}
      <CrossCountryChampionshipModal
        isOpen={isCcModalOpen}
        onClose={() => setIsCcModalOpen(false)}
        tournaments={tournaments}
        allStudents={allStudents}
        schools={schools}
        techHead={teachers.find(tch => tch.isTechCommitteeHead && (tch.techCommitteeSports?.includes('cross_country') || tch.sportId === 'cross_country'))}
        activeSeason={activeSeason}
        canManage={canManageSport('cross_country')}
        onRefreshData={loadData}
        isTeacherRole={effectiveRole === 'TEACHER'}
        teacherSchoolName={effectiveRole === 'TEACHER' && userProfile ? userProfile.workLocation : undefined}
      />

      {/* General Sport Championship Modal for viewing categories, controls & rosters */}
      <SportChampionshipModal
        isOpen={isSportModalOpen}
        onClose={() => setIsSportModalOpen(false)}
        sport={selectedSportForModal}
        tournaments={tournaments}
        allStudents={allStudents}
        schools={schools}
        matches={matches}
        teachers={teachers}
        activeSeason={activeSeason}
        canManage={selectedSportForModal ? canManageSport(selectedSportForModal.id) : false}
        isProgrammed={selectedSportForModal ? (
          sportsWithTournamentData.find(item => item.sport.id === selectedSportForModal.id)?.isProgrammed || false
        ) : false}
        onProgramTournament={(sId) => {
          setIsSportModalOpen(false);
          handleOpenProgramModal(sId);
        }}
        onRefreshData={loadData}
        isTeacherRole={effectiveRole === 'TEACHER'}
        teacherSchoolName={effectiveRole === 'TEACHER' && userProfile ? userProfile.workLocation : undefined}
      />

      {/* Edit Tournament Schedule & Dates Modal */}
      <EditTournamentScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedSportForSchedule(null);
        }}
        sport={selectedSportForSchedule}
        tournaments={tournaments}
        onUpdated={loadData}
      />

      {/* Tournament Poster Generator Modal */}
      {selectedSportForPoster && (
        <TournamentPosterModal
          isOpen={isPosterModalOpen}
          onClose={() => {
            setIsPosterModalOpen(false);
            setSelectedSportForPoster(null);
          }}
          sport={selectedSportForPoster}
          directorateName={activeDirObj?.name || userProfile?.directorateName || 'المديرية الإقليمية بتاوريرت'}
          directorateObj={activeDirObj}
          tournaments={tournaments}
          officialLogos={officialLogos}
        />
      )}
    </div>
  );
};
