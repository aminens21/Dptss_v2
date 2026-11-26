import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason, deduplicateById, getCategoryGenderLabel, isClubTournament, normalizeCategoryKey, getTournamentLevelAr, isTeacherLevelAllowedForTournament, isCrossCountryU15OpenToPrimary, parseTournamentAllowedLevels, getCustomCategoryName, getCustomCategoryDetails, isSchoolSectorAllowedForTournament, getTournamentEducationSectorsAr, normalizeTournamentEducationSectors, getSchoolEducationSector, schoolNamesMatch, normalizeCanonicalSportId, areSportIdsEquivalent, isAffiliationAllowedByDisplayConfig, resolveEffectiveAffiliationMode, getEffectiveConfirmedBranches, resolveEffectiveTeacherCadre, findMatchingSchoolForTeacher, isTrackOrCrossCountrySport } from '../lib/dataService';
import { Tournament, User, Student, School, Sport, Match, Directorate, AffiliationDisplayConfig, CrossCountryBibsStatus } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import * as XLSX from 'xlsx';
import {
  Plus,
  Search,
  Trophy,
  Calendar,
  Filter,
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
  Palette,
  Shuffle,
  FileSpreadsheet,
  UploadCloud,
  RefreshCw,
  RotateCcw,
  FileText,
  Sparkles,
  Printer
} from 'lucide-react';
import { CreateTournamentModal } from '../components/CreateTournamentModal';
import { EditTournamentModal } from '../components/EditTournamentModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { CrossCountryChampionshipModal } from '../components/CrossCountryChampionshipModal';
import { CrossCountryDemoModal } from '../components/CrossCountryDemoModal';
import { BibGeneratorModal } from '../components/BibGeneratorModal';
import { filterCrossCountryStudents } from '../lib/crossCountryConfig';
import { SportChampionshipModal } from '../components/SportChampionshipModal';
import { AthleticsChampionshipModal } from '../components/AthleticsChampionshipModal';
import { EditTournamentScheduleModal } from '../components/EditTournamentScheduleModal';
import { ProgramExportModal } from '../components/ProgramExportModal';
import { ElectronicDrawModal, TEAM_SPORTS_IDS } from '../components/ElectronicDrawModal';
import { ImportParticipationsExcelModal } from '../components/ImportParticipationsExcelModal';
import { TournamentResetModal } from '../components/TournamentResetModal';
import { getPendingCloudSyncCount, syncPendingLocalImportsToCloud } from '../lib/excelParticipationsImportService';
import { ConfirmParticipationModal } from '../components/ConfirmParticipationModal';
import { ConfirmedParticipationBadge } from '../components/ConfirmedParticipationBadge';
import { useSchoolConfirmations } from '../hooks/useSchoolConfirmations';
import { TeacherTeams } from './TeacherTeams';
import { OfficialLogos } from '../lib/dataService';
import {
  canUserDownloadTournamentTablePdf,
  buildParticipationTableRows,
  downloadTournamentParticipationTablePdf,
  formatTournamentRedBannerTitle
} from '../lib/tournamentTablePdfService';
import toast from 'react-hot-toast';
import { useRolePermissions } from '../hooks/useRolePermissions';

export const Tournaments: React.FC = () => {
  const { userProfile, impersonationScopedSportIds, isImpersonatingTeacher } = useAuth();
  const { canDo } = useRolePermissions();
  const [searchParams, setSearchParams] = useSearchParams();
  const urlTab = searchParams.get('tab') || searchParams.get('level');

  const [activeBranch, setActiveBranch] = useState<'provincial' | 'regional' | 'national' | 'registration'>(
    urlTab === 'regional' ? 'regional' :
    urlTab === 'national' ? 'national' :
    urlTab === 'registration' || urlTab === 'teams' ? 'registration' : 'provincial'
  );

  const urlModal = searchParams.get('modal');

  useEffect(() => {
    if (urlModal === 'cc' || urlModal === 'cross_country') {
      setIsCcModalOpen(true);
    }
  }, [urlModal]);

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
  const [isCcDemoModalOpen, setIsCcDemoModalOpen] = useState(false);
  const [isTeacherCcBibsModalOpen, setIsTeacherCcBibsModalOpen] = useState(false);
  const [ccBibsStatus, setCcBibsStatus] = useState<CrossCountryBibsStatus>(() =>
    DataService.getCrossCountryBibsStatusSync()
  );
  const [filterSport, setFilterSport] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PROGRAMMED' | 'UNPROGRAMMED' | 'MY_SCHOOL'>('ALL');

  const navigate = useNavigate();

  // Sport Championship Modal State
  const [selectedSportForModal, setSelectedSportForModal] = useState<Sport | null>(null);
  const [isSportModalOpen, setIsSportModalOpen] = useState(false);
  const [preselectedSportId, setPreselectedSportId] = useState<string | undefined>(undefined);

  // School Participation Confirmation State
  const [affiliationDisplayConfig, setAffiliationDisplayConfig] = useState<AffiliationDisplayConfig>(() =>
    DataService.getAffiliationDisplayConfigSync()
  );
  const [confirmParticipationSport, setConfirmParticipationSport] = useState<Sport | null>(null);
  const { confirmations, isSchoolConfirmed, getConfirmation, refreshConfirmations } = useSchoolConfirmations(activeDirObj?.id);
  const teacherSchoolName = userProfile?.schoolName || userProfile?.workLocation || '';

  // Schedule and Dates Modal State
  const [selectedSportForSchedule, setSelectedSportForSchedule] = useState<Sport | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Electronic Draw and Demo Data Modal states
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);
  const [selectedSportForDraw, setSelectedSportForDraw] = useState<string | undefined>(undefined);
  const [selectedTournamentForDraw, setSelectedTournamentForDraw] = useState<string | undefined>(undefined);
  const [isImportExcelModalOpen, setIsImportExcelModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [pendingCloudSyncCount, setPendingCloudSyncCount] = useState<number>(() => getPendingCloudSyncCount());
  const [isSyncingPendingCloud, setIsSyncingPendingCloud] = useState(false);
  const [isConvertingParticipations, setIsConvertingParticipations] = useState(false);
  const [isCleaningOrphaned, setIsCleaningOrphaned] = useState(false);
  const autoMigratedDirsRef = useRef<Set<string>>(new Set());

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
  // During teacher impersonation, never allow DB teacher record to re-elevate role/admin permissions
  const isSuperAdmin = !isImpersonatingTeacher && (userProfile?.isSuperAdmin === true || currentTeacherProfile?.isSuperAdmin === true || userProfile?.role === 'SUPER_ADMIN');
  const effectiveRole = isImpersonatingTeacher ? userProfile?.role : (currentTeacherProfile?.role || userProfile?.role);
  const isCentralAdmin = effectiveRole === 'CENTRAL_ADMIN' || isSuperAdmin;
  const isSportManager = effectiveRole === 'SPORT_MANAGER';
  const isTechCommitteeHead = isImpersonatingTeacher
    ? userProfile?.isTechCommitteeHead === true
    : (
        userProfile?.isTechCommitteeHead === true ||
        currentTeacherProfile?.isTechCommitteeHead === true ||
        effectiveRole === 'TECH_HEAD' ||
        (effectiveRole as string) === 'TECH_COMMITTEE_HEAD'
      );
  const isTeacherRole = effectiveRole === 'TEACHER' && !isTechCommitteeHead && !isCentralAdmin && !isSportManager;

  const canManageAllLevels = isCentralAdmin || (!isImpersonatingTeacher && userProfile?.isSuperAdmin) || isSportManager || isTechCommitteeHead;
  const userSchoolId = userProfile?.schoolId || currentTeacherProfile?.schoolId;
  const userSchoolName = userProfile?.workLocation || currentTeacherProfile?.workLocation || userProfile?.schoolName;

  const hasRegionalQualification = useMemo(() => {
    const hasRegTournaments = tournaments.some(t => t.level === 'REGIONAL' || t.scope === 'REGIONAL');
    if (hasRegTournaments) return true;
    return allStudents.some(s => 
      ((userSchoolId && s.schoolId === userSchoolId) || (userSchoolName && (s.schoolName === userSchoolName || s.schoolName?.trim() === userSchoolName?.trim()))) &&
      (s.isQualifiedRegional || s.qualificationLevel === 'regional' || s.qualificationLevel === 'national' || s.isQualifiedNational)
    );
  }, [tournaments, allStudents, userSchoolId, userSchoolName]);

  const hasNationalQualification = useMemo(() => {
    const hasNatTournaments = tournaments.some(t => t.level === 'NATIONAL' || t.scope === 'NATIONAL');
    if (hasNatTournaments) return true;
    return allStudents.some(s => 
      ((userSchoolId && s.schoolId === userSchoolId) || (userSchoolName && (s.schoolName === userSchoolName || s.schoolName?.trim() === userSchoolName?.trim()))) &&
      (s.isQualifiedNational || s.qualificationLevel === 'national')
    );
  }, [tournaments, allStudents, userSchoolId, userSchoolName]);

  useEffect(() => {
    if (!loading) {
      if (activeBranch === 'regional' && !hasRegionalQualification) {
        toast.error('البطولة الجهوية تظهر فقط للمؤسسات والتلاميذ المتأهلين. لم يُسجل تأهل لمؤسستك بعد.', {
          id: 'regional-lock-toast'
        });
        setActiveBranch('provincial');
        setSearchParams({ tab: 'provincial' });
      } else if (activeBranch === 'national' && !hasNationalQualification) {
        toast.error('البطولة الوطنية تظهر فقط للمؤسسات والتلاميذ المتأهلين. لم يُسجل تأهل لمؤسستك بعد.', {
          id: 'national-lock-toast'
        });
        setActiveBranch('provincial');
        setSearchParams({ tab: 'provincial' });
      }
    }
  }, [activeBranch, hasRegionalQualification, hasNationalQualification, loading, setSearchParams]);

  // Helper to format category for badges elegantly in Arabic
  const formatCategoryBadge = (catId: string, sportTournaments: Tournament[] = [], sportId?: string) => {
    const isCC = isTrackOrCrossCountrySport(sportId);

    // 1. Check custom age category details configured in settings first!
    const customDetails = getCustomCategoryDetails(catId, sportId, sportsConfig);
    if (customDetails && customDetails.name) {
      return {
        label: customDetails.name,
        years: customDetails.yearsExpression ? `مواليد ${customDetails.yearsExpression}` : ''
      };
    }

    const norm = normalizeCategoryKey(catId);
    const match = activeSeason.match(/(\d{4})/);
    const startYear = match ? parseInt(match[1], 10) : 2026;

    // Determine which genders are present
    const catTournaments = sportTournaments.filter(t => t.ageCategory === catId || normalizeCategoryKey(t.ageCategory) === norm);
    const hasMale = catTournaments.some(t => t.gender === 'Male' || t.gender === 'Mixed');
    const hasFemale = catTournaments.some(t => t.gender === 'Female' || t.gender === 'Mixed');

    // Custom age categories fallback
    if (!['U12', 'U15', 'U17', 'U18', 'U20'].includes(norm)) {
      const customName = getCustomCategoryName(catId, sportId, sportsConfig);
      return { label: customName || catId, years: '' };
    }

    if (isCC) {
      if (norm === 'U12') {
        const label = (hasFemale && !hasMale) ? 'برعمات' : (hasFemale && hasMale) ? 'براعم / برعمات' : 'براعم';
        return {
          label,
          years: `مواليد ${startYear - 12} وما بعد`
        };
      }
      if (norm === 'U15') {
        const label = (hasFemale && !hasMale) ? 'صغيرات' : (hasFemale && hasMale) ? 'صغار / صغيرات' : 'صغار';
        return {
          label,
          years: `مواليد ${startYear - 14}-${startYear - 13}`
        };
      }
      if (norm === 'U18') {
        const label = (hasFemale && !hasMale) ? 'فتيات' : (hasFemale && hasMale) ? 'فتيان / فتيات' : 'فتيان';
        return {
          label,
          years: `مواليد ${startYear - 16}-${startYear - 15}`
        };
      }
      if (norm === 'U20') {
        const label = (hasFemale && !hasMale) ? 'شابات' : (hasFemale && hasMale) ? 'شبان / شابات' : 'شبان';
        return {
          label,
          years: `مواليد ${startYear - 18}-${startYear - 17}`
        };
      }
    } else {
      if (norm === 'U12') {
        return {
          label: 'أقل من 12 سنة (U12)',
          years: `مواليد ${startYear - 9}/${startYear - 10}/${startYear - 11}`
        };
      }
      if (norm === 'U15') {
        return {
          label: 'أقل من 15 سنة (U15)',
          years: `مواليد ${startYear - 12}/${startYear - 13}/${startYear - 14}`
        };
      }
      if (norm === 'U17') {
        return {
          label: 'أقل من 17 سنة (U17)',
          years: `مواليد ${startYear - 14}/${startYear - 15}/${startYear - 16}`
        };
      }
      if (norm === 'U18') {
        return {
          label: 'أقل من 18 سنة (U18)',
          years: `مواليد ${startYear - 15}/${startYear - 16}/${startYear - 17}`
        };
      }
      if (norm === 'U20') {
        return {
          label: `مواليد ${startYear - 17} وما بعد`,
          years: ''
        };
      }
    }

    if (/^CAT_/i.test(catId) || /^cat_/i.test(catId)) {
      return isCC
        ? { label: 'الصغار والصغيرات', years: `مواليد ${startYear - 14}-${startYear - 13}` }
        : { label: 'أقل من 15 سنة (U15)', years: `مواليد ${startYear - 12}/${startYear - 13}/${startYear - 14}` };
    }
    return { label: catId, years: '' };
  };

  // Allowed sport IDs for technical committee head
  const allowedSportIds = useMemo(() => {
    if (isCentralAdmin) return null; // null means unrestricted
    if (isTechCommitteeHead) {
      const set = new Set<string>();
      const addSport = (raw?: string) => {
        if (!raw) return;
        set.add(raw);
        const canonical = normalizeCanonicalSportId(raw, sportsConfig);
        if (canonical) set.add(canonical);
      };
      if (userProfile?.techCommitteeSports) {
        userProfile.techCommitteeSports.forEach(addSport);
      }
      if (currentTeacherProfile?.techCommitteeSports) {
        currentTeacherProfile.techCommitteeSports.forEach(addSport);
      }
      addSport(userProfile?.sportId);
      addSport(currentTeacherProfile?.sportId);
      tournaments.forEach(t => {
        const emailMatch = t.managerEmail && userProfile?.email && t.managerEmail.toLowerCase() === userProfile.email.toLowerCase();
        const nameMatch = t.managerName && userProfile?.fullName && t.managerName.trim() === userProfile.fullName.trim();
        if ((emailMatch || nameMatch) && t.sportId) {
          addSport(t.sportId);
        }
      });
      return Array.from(set);
    }
    return [];
  }, [isCentralAdmin, isTechCommitteeHead, userProfile, currentTeacherProfile, sportsConfig, tournaments]);

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
    if (isTechCommitteeHead && allowedSportIds && allowedSportIds.some(id => areSportIdsEquivalent(id, sportId, sportsConfig))) return true;
    if (isSportManager && managerSportId && areSportIdsEquivalent(managerSportId, sportId, sportsConfig)) return true;
    return false;
  };

  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadData(false);
    const scheduleReload = () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      reloadTimerRef.current = setTimeout(() => {
        reloadTimerRef.current = null;
        loadData(true);
      }, 150);
    };

    const unsubscribeTournaments = DataService.subscribeToTournaments(scheduleReload);
    const unsubscribeMatches = DataService.subscribeToMatches(scheduleReload);
    const unsubscribeSchools = DataService.subscribeToSchools(scheduleReload);
    const unsubscribeVenues = DataService.subscribeToVenues(scheduleReload);
    const unsubscribeStudents = DataService.subscribeToStudents(scheduleReload);
    const unsubscribeSportsConfig = DataService.subscribeToSportsConfig(scheduleReload);
    const unsubscribeAffiliationCfg = DataService.subscribeToAffiliationDisplayConfig((cfg) => {
      setAffiliationDisplayConfig(cfg);
    });

    const handleConfirmationSync = () => {
      refreshConfirmations();
      scheduleReload();
    };

    window.addEventListener('directorateChanged', scheduleReload);
    window.addEventListener('tournamentDataChanged', scheduleReload);
    window.addEventListener('matchesDataChanged', scheduleReload);
    window.addEventListener('sportsConfigChanged', scheduleReload);
    window.addEventListener('resultsChanged', scheduleReload);
    window.addEventListener('schoolConfirmationsUpdated', handleConfirmationSync);
    window.addEventListener('schoolWithdrawalsUpdated', handleConfirmationSync);
    const handlePendingQueueChange = () => {
      setPendingCloudSyncCount(getPendingCloudSyncCount());
    };
    window.addEventListener('pendingCloudSyncUpdated', handlePendingQueueChange);

    // Automatically attempt to sync queued local imports ONLY if Cloud Sync is NOT paused by the user
    if (getPendingCloudSyncCount() > 0 && !DataService.isCloudSyncPaused()) {
      syncPendingLocalImportsToCloud().then(res => {
        setPendingCloudSyncCount(res.remainingCount);
        if (res.syncedCount > 0 && res.remainingCount === 0) {
          toast.success(`تمت مزامنة جميع المعطيات المحفوظة محلياً (${res.syncedCount} سجل) مع السحابة تلقائياً!`);
          loadData(true);
        }
      }).catch(() => {});
    }

    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
      window.removeEventListener('pendingCloudSyncUpdated', handlePendingQueueChange);
      window.removeEventListener('directorateChanged', scheduleReload);
      window.removeEventListener('tournamentDataChanged', scheduleReload);
      window.removeEventListener('matchesDataChanged', scheduleReload);
      window.removeEventListener('sportsConfigChanged', scheduleReload);
      window.removeEventListener('resultsChanged', scheduleReload);
      window.removeEventListener('schoolConfirmationsUpdated', handleConfirmationSync);
      window.removeEventListener('schoolWithdrawalsUpdated', handleConfirmationSync);
      if (unsubscribeTournaments) unsubscribeTournaments();
      if (unsubscribeMatches) unsubscribeMatches();
      if (unsubscribeSchools) unsubscribeSchools();
      if (unsubscribeVenues) unsubscribeVenues();
      if (unsubscribeStudents) unsubscribeStudents();
      if (unsubscribeSportsConfig) unsubscribeSportsConfig();
      if (unsubscribeAffiliationCfg) unsubscribeAffiliationCfg();
    };
  }, []);

  useEffect(() => {
    const unsubBibsStatus = DataService.subscribeToCrossCountryBibsStatus((st) => {
      setCcBibsStatus(st);
    }, activeDirObj?.id);
    return () => {
      if (typeof unsubBibsStatus === 'function') unsubBibsStatus();
    };
  }, [activeDirObj?.id]);

  const handleManualCloudSync = async () => {
    if (isSyncingPendingCloud) return;
    if (DataService.isCloudSyncPaused()) {
      toast('المزامنة السحابية متوقفة حالياً — اضغط على زر المزامنة في الشريط العلوي لتشغيلها أولاً.', {
        icon: '⏸️',
        duration: 4000
      });
      return;
    }
    setIsSyncingPendingCloud(true);
    try {
      const res = await syncPendingLocalImportsToCloud();
      setPendingCloudSyncCount(res.remainingCount);
      if (res.quotaStillExceeded && res.syncedCount === 0) {
        toast('لا تزال الحصة اليومية المجانية لـ Firestore مستنفدة اليوم — بياناتك محفوظة محلياً بأمان.', {
          icon: '⏳',
          duration: 5000
        });
      } else if (res.remainingCount === 0) {
        toast.success(`تمت مزامنة جميع المحفوظات المحلية (${res.syncedCount} سجل) مع السحابة بنجاح!`);
        await loadData(true);
      } else {
        toast.success(`تمت مزامنة ${res.syncedCount} سجل وبقي ${res.remainingCount} سجل.`);
      }
    } catch {
      toast.error('تعذرت المزامنة حالياً، المعطيات محفوظة محلياً بأمان.');
    } finally {
      setIsSyncingPendingCloud(false);
    }
  };

  const handleConvertParticipationsToNonClub = async (silent = false) => {
    if (isConvertingParticipations) return;
    if (DataService.isCloudSyncPaused()) {
      if (!silent) {
        toast.error('المزامنة السحابية متوقفة حالياً — يرجى تفعيلها أولاً لتحديث قاعدة البيانات.');
      }
      return;
    }
    const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
    const isAllDirs = !activeDirId || activeDirId === 'all';
    setIsConvertingParticipations(true);
    try {
      const res = await DataService.convertAllParticipationsToNonClubAndDeduplicate({
        targetDirectorateId: isAllDirs ? 'all' : activeDirId,
        onlyIfNotMigrated: silent
      });
      if (res.alreadyMigrated) return;

      const totalChanged =
        res.convertedConfirmationsCount +
        res.deletedDuplicateConfirmationsCount +
        res.convertedStudentsCount +
        res.deletedDuplicateStudentsCount;

      if (totalChanged > 0) {
        await Promise.all([loadData(true), refreshConfirmations()]);
        toast.success(
          `تم تحويل جميع المشاركات إلى غير المنتمين للأندية وحذف التكرار (تأكيدات: ${res.convertedConfirmationsCount}، تكرارات محذوفة: ${res.deletedDuplicateConfirmationsCount + res.deletedDuplicateStudentsCount}، مشاركون محولون: ${res.convertedStudentsCount})`,
          { duration: 5500 }
        );
      } else if (!silent) {
        toast.success('جميع المشاركات مسجلة بالفعل ضمن غير المنتمين للأندية ولا توجد مشاركات مكررة.');
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        toast.error('حدث خطأ أثناء تحويل المشاركات وتوحيدها.');
      }
    } finally {
      setIsConvertingParticipations(false);
    }
  };

  const handleCleanOrphanedParticipations = async (silent = false) => {
    if (isCleaningOrphaned) return;
    if (DataService.isCloudSyncPaused()) {
      if (!silent) {
        toast.error('المزامنة السحابية متوقفة حالياً — يرجى تفعيلها أولاً لتحديث قاعدة البيانات.');
      }
      return;
    }
    const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
    const isAllDirs = !activeDirId || activeDirId === 'all';
    setIsCleaningOrphaned(true);
    try {
      const res = await DataService.pruneOrphanedParticipationsForDeletedSchools({
        targetDirectorateId: isAllDirs ? 'all' : activeDirId,
        onlyIfNotCleaned: silent
      });
      if (res.alreadyCleaned) return;

      const totalRemoved = res.deletedConfirmationsCount + res.deletedStudentsCount;
      if (totalRemoved > 0) {
        await Promise.all([loadData(true), refreshConfirmations()]);
        toast.success(
          `تم حذف مشاركات المؤسسات المحذوفة والإبقاء على المؤسسات المسجلة فقط (تأكيدات محذوفة: ${res.deletedConfirmationsCount}، مشاركون محذوفون: ${res.deletedStudentsCount})`,
          { duration: 5500 }
        );
      } else if (!silent) {
        toast.success('جميع المشاركات المسجلة تنتمي لمؤسسات موجودة حالياً في لائحة المؤسسات التعليمية.');
      }
    } catch (err) {
      console.error(err);
      if (!silent) {
        toast.error('حدث خطأ أثناء حذف مشاركات المؤسسات المحذوفة.');
      }
    } finally {
      setIsCleaningOrphaned(false);
    }
  };

  useEffect(() => {
    const canRunAutoMigration =
      isCentralAdmin ||
      effectiveRole === 'PROVINCIAL_ADMIN' ||
      effectiveRole === 'REGIONAL_ADMIN' ||
      isTechCommitteeHead;
    if (loading || !canRunAutoMigration) return;
    const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
    if (autoMigratedDirsRef.current.has(activeDirId)) return;
    autoMigratedDirsRef.current.add(activeDirId);
    (async () => {
      await handleCleanOrphanedParticipations(true);
      await handleConvertParticipationsToNonClub(true);
      if (!DataService.isCloudSyncPaused()) {
        const removed = await DataService.deduplicateTournamentBranches(activeDirId).catch(() => 0);
        if (removed > 0) {
          await loadData(true);
        }
      }
    })();
  }, [loading, isCentralAdmin, effectiveRole, isTechCommitteeHead, activeDirObj?.id]);

  const loadData = async (silent = true) => {
    if (!silent) {
      setLoading(true);
    }
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [tournList, sportsList, season, allTeachersRaw, studentsList, schoolsList, matchList, activeDir] = await Promise.all([
        DataService.getTournaments(),
        DataService.getSportsConfig(),
        DataService.getActiveSeason(),
        DataService.getUsers(),
        DataService.getStudents(),
        DataService.getSchools(),
        DataService.getMatches(),
        DataService.getActiveDirectorate().catch(() => null)
      ]);
      const allTeachers = Array.isArray(allTeachersRaw)
        ? allTeachersRaw.filter((u: any) => !u.role || u.role === 'TEACHER' || u.role === 'TECH_HEAD' || u.role === 'SPORT_MANAGER' || u.isTechCommitteeHead || u.isTechCommitteeMember)
        : [];

      let resolvedTournaments = tournList;
      let resolvedSports = sportsList;
      const restoredCount = await DataService.ensureClubAffiliatedBranchesForProgrammedSports(
        activeDirId,
        typeof season === 'string' && season ? season : activeSeason
      ).catch(() => 0);
      if (restoredCount > 0) {
        [resolvedTournaments, resolvedSports] = await Promise.all([
          DataService.getTournaments(),
          DataService.getSportsConfig()
        ]);
      }

      const isAllDirs = !activeDirId || activeDirId === 'all';
      const dirTeachers = isAllDirs ? allTeachers : allTeachers.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      const dirStudents = isAllDirs ? studentsList : studentsList.filter(st => (st.directorateId || 'taourirt') === activeDirId);
      const dirSchools = isAllDirs ? schoolsList : schoolsList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      const dirMatches = isAllDirs ? matchList : matchList.filter(m => (m.directorateId || 'taourirt') === activeDirId);
      const dirTournaments = isAllDirs ? resolvedTournaments : resolvedTournaments.filter(t => (t.directorateId || 'taourirt') === activeDirId);

      setActiveDirObj(activeDir);
      setTournaments(deduplicateById(dirTournaments));
      setSportsConfig(resolvedSports);
      if (selectedSportForModal) {
        const updatedSport = resolvedSports.find(s => s.id === selectedSportForModal.id);
        if (updatedSport) {
          setSelectedSportForModal(updatedSport);
        }
      }
      setTeachers(deduplicateById(dirTeachers));
      setAllStudents(deduplicateById(dirStudents));
      setSchools(deduplicateById(dirSchools));
      setMatches(deduplicateById(dirMatches));
      if (season && typeof season === 'string') {
        setActiveSeason(season);
      }
      setPendingCloudSyncCount(getPendingCloudSyncCount());
    } catch (e) {
      console.error(e);
      if (!silent) {
        toast.error('تعذر تحميل بيانات البطولات والرياضات');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
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

      // Find all existing tournaments for this sport in this directorate
      const existingSportTournaments = latestTournaments.filter(t => 
        t.sportId === targetSportId && 
        (!t.seasonId || !targetSeasonId || t.seasonId === targetSeasonId || (targetSeasonId === '2026/2027' && t.seasonId === '2025/2026')) &&
        (!targetDirId || !t.directorateId || (t.directorateId || 'taourirt') === (targetDirId || 'taourirt'))
      );

      const isEditMode = existingSportTournaments.length > 0;

      if (!isEditMode) {
        const createdItems: Tournament[] = [];
        for (const item of items) {
          const created = await DataService.addTournament(item);
          createdItems.push(created);
        }

        const newSelectedCats = Array.from(new Set(items.map(i => normalizeCategoryKey(i.ageCategory)).filter(Boolean)));
        
        const cleanBaseNameCreate = items[0]?.name
          ? items[0].name.split(/\s*-\s*(?:البرعمات|البراعم|الصغيرات|الصغار|الفتيات|الفتيان|الشابات|الشبان|ذكور|إناث|مختلط|U12|U15|U18|U20|جميع الفئات|فئة|صغار|فتيان|شبان|براعم|صغيرات|فتيات|شابات|برعمات|لا منتمين|للمنتمين للأندية|مفتوحة|مواليد|السلك|دوري)/i)[0].trim()
          : undefined;

        await DataService.updateSportCategories(
          targetSportId, 
          newSelectedCats, 
          undefined, 
          undefined, 
          undefined, // Keep base sport discipline name intact
          undefined, 
          true
        );

        await loadData();
        toast.success(`تم إنشاء وبرمجة ${createdItems.length} ${createdItems.length > 1 ? 'بطولات' : 'بطولة'} بنجاح!`);
      } else {
        // Edit / Re-configuration mode:
        // Smartly map existing tournaments to items so edits (to category, gender, name, dates, affiliation) update existing records directly!
        const matchedExistingIds = new Set<string>();
        const itemToExistingIdMap = new Map<number, string>();

        // Pass 1: Exact match on (ageCategory, gender, affiliationType)
        // Do NOT arbitrarily reassign unmatched remaining tournament IDs across different categories/affiliations,
        // because old matches/results tied to that tournamentId would bleed into the wrong category/branch.
        items.forEach((item, idx) => {
          const exact = existingSportTournaments.find(existing => {
            if (matchedExistingIds.has(existing.id)) return false;
            return (
              normalizeCategoryKey(existing.ageCategory) === normalizeCategoryKey(item.ageCategory) &&
              existing.gender === item.gender &&
              (existing.affiliationType || 'non_club') === (item.affiliationType || 'non_club')
            );
          });
          if (exact) {
            matchedExistingIds.add(exact.id);
            itemToExistingIdMap.set(idx, exact.id);
          }
        });

        // Apply updates or additions
        let updatedCount = 0;
        let createdCount = 0;

        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const existingId = itemToExistingIdMap.get(idx);

          if (existingId) {
            await DataService.updateTournament(existingId, {
              name: item.name,
              startDate: item.startDate,
              endDate: item.endDate,
              registrationDeadline: item.registrationDeadline,
              level: item.level,
              educationSectors: item.educationSectors,
              scope: item.scope,
              status: item.status,
              description: item.description,
              affiliationType: item.affiliationType,
              seasonId: item.seasonId,
              gender: item.gender,
              ageCategory: item.ageCategory,
              sportId: item.sportId,
              directorateId: item.directorateId
            });
            updatedCount++;
          } else {
            await DataService.addTournament(item);
            createdCount++;
          }
        }

        // Delete any existing tournaments that were NOT matched in this re-configuration
        const toDelete = existingSportTournaments.filter(existing => !matchedExistingIds.has(existing.id));
        for (const rem of toDelete) {
          await DataService.deleteTournament(rem.id);
        }

        // Update the sport's configured categories in Firestore and local config
        const newSelectedCats = Array.from(new Set(items.map(i => normalizeCategoryKey(i.ageCategory)).filter(Boolean)));
        const newSelectedAffs = Array.from(new Set(items.map(i => i.affiliationType || 'non_club'))) as Array<'non_club' | 'club_affiliated' | 'open'>;

        const cleanBaseNameEdit = items[0]?.name
          ? items[0].name.split(/\s*-\s*(?:البرعمات|البراعم|الصغيرات|الصغار|الفتيات|الفتيان|الشابات|الشبان|ذكور|إناث|مختلط|U12|U15|U18|U20|جميع الفئات|فئة|صغار|فتيان|شبان|براعم|صغيرات|فتيات|شابات|برعمات|لا منتمين|للمنتمين للأندية|مفتوحة|مواليد|السلك|دوري)/i)[0].trim()
          : undefined;

        await DataService.updateSportCategories(
          targetSportId, 
          newSelectedCats, 
          undefined, 
          newSelectedAffs, 
          undefined, // Keep base sport discipline name intact
          undefined, 
          true
        );

        // Reload full state
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
      const updatedSports = await DataService.getSportsConfig();
      setSportsConfig(updatedSports);
      toast.success('تم حذف البطولة وتحييد نتائجها بنجاح');
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
              'رقم الصدرية': p.bibNumber || (p as any).crossCountryBibNumber || '-',
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

  const mergedTeacherProfile = useMemo(() => {
    if (!userProfile && !currentTeacherProfile) return null;
    return {
      ...currentTeacherProfile,
      ...userProfile,
      teachingCadre: userProfile?.teachingCadre || currentTeacherProfile?.teachingCadre,
      workLocation: userProfile?.workLocation || currentTeacherProfile?.workLocation,
      schoolName: userProfile?.schoolName || currentTeacherProfile?.schoolName,
      schoolId: userProfile?.schoolId || currentTeacherProfile?.schoolId,
    };
  }, [userProfile, currentTeacherProfile]);

  const teacherSchoolObj = useMemo(() => {
    return findMatchingSchoolForTeacher(schools, mergedTeacherProfile);
  }, [schools, mergedTeacherProfile]);

  const canonicalTeacherSchoolId = teacherSchoolObj?.id || userProfile?.schoolId || currentTeacherProfile?.schoolId || teacherSchoolName;
  const resolvedTeacherSchoolName = teacherSchoolObj?.name || teacherSchoolName;

  const teacherOwnCcRunnersCount = useMemo(() => {
    if (!isTeacherRole) return 0;
    const pool = filterCrossCountryStudents(allStudents);
    const effectiveName = resolvedTeacherSchoolName || teacherSchoolName;
    return pool.filter(s =>
      (canonicalTeacherSchoolId && s.schoolId === canonicalTeacherSchoolId) ||
      (effectiveName && schoolNamesMatch(s.schoolName || '', effectiveName))
    ).length;
  }, [isTeacherRole, allStudents, canonicalTeacherSchoolId, resolvedTeacherSchoolName, teacherSchoolName]);

  const handleOpenTeacherCcBibsModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ccBibsStatus.generated) {
      toast('لم يقم المسير بتوليد صدريات البطولة بعد — ستتمكن من تحميل صدريات مؤسستك فور توليدها.', {
        icon: '⏳',
        duration: 4000
      });
      return;
    }
    if (teacherOwnCcRunnersCount === 0) {
      toast.error('لا يوجد تلاميذ مسجلون لمؤسستكم في بطولة العدو الريفي بعد.');
      return;
    }
    setIsTeacherCcBibsModalOpen(true);
  };

  const handleDownloadTournamentTablePdf = async (sport: Sport, sportTournaments: Tournament[]) => {
    const actorProfile = currentTeacherProfile || userProfile;
    if (!canUserDownloadTournamentTablePdf(actorProfile, sport.id, sportsConfig)) {
      toast.error('تحميل جدول المؤسسات مخصص للمسؤول المركزي أو رئيس اللجنة التقنية المختص بالرياضة فقط');
      return;
    }

    const allowedAffStudents = allStudents.filter(st =>
      isAffiliationAllowedByDisplayConfig(st.affiliationType, affiliationDisplayConfig, sport.id)
    );
    const allowedMode = resolveEffectiveAffiliationMode(affiliationDisplayConfig, sport.id);

    const rows = buildParticipationTableRows({
      sportId: sport.id,
      students: allowedAffStudents,
      schools,
      teachers,
      confirmations,
      currentUser: actorProfile,
      affiliationType: allowedMode === 'both' ? 'ALL' : allowedMode,
      isSchoolWithdrawnFn: (sid, sname, b) =>
        DataService.isSchoolWithdrawn(
          {
            sportId: sport.id,
            ageCategory: b?.category,
            gender: b?.gender,
            affiliationType: b?.affiliationType
          },
          sid,
          sname
        )
    });

    const levelSet = new Set<string>();
    sportTournaments.forEach(t => {
      if (t.level) {
        t.level.split(',').map(x => x.trim()).filter(Boolean).forEach(x => levelSet.add(x));
      }
    });
    const levelLabel = levelSet.size > 0 && levelSet.size < 3
      ? getTournamentLevelAr(Array.from(levelSet).join(','))
      : undefined;

    const affSet = new Set(
      sportTournaments.map(t => t.affiliationType || (isClubTournament(t) ? 'club_affiliated' : 'non_club'))
    );
    const effectiveAff = allowedMode !== 'both'
      ? allowedMode
      : affSet.size === 1
      ? Array.from(affSet)[0]
      : undefined;

    const redTitle = formatTournamentRedBannerTitle({
      sportId: sport.id,
      sportName: sport.name,
      levelLabel,
      affiliationType: effectiveAff
    });

    await downloadTournamentParticipationTablePdf({
      redTitle,
      subtitle: `${activeDirObj?.name || 'المديرية الإقليمية'} — الموسم الرياضي ${activeSeason}`,
      rows
    });
  };

  // Group tournaments by sport & check programming status
  const sportsWithTournamentData = useMemo(() => {

    const teacherCadre = resolveEffectiveTeacherCadre(
      mergedTeacherProfile,
      teacherSchoolObj
    );

    return sportsConfig
      .filter(sport => impersonationScopedSportIds.length === 0 || impersonationScopedSportIds.includes(sport.id))
      .map(sport => {
      let sportTournaments = tournaments.filter(t => {
        if (t.sportId !== sport.id || t.status === 'Draft' || (t as any).isActive === false) return false;
        const tAff = t.affiliationType || (isClubTournament(t) ? 'club_affiliated' : 'non_club');
        return isAffiliationAllowedByDisplayConfig(tAff, affiliationDisplayConfig, sport.id);
      });
      const isManagerOfSport = canManageSport(sport.id);

      // For teachers (non-admins), filter tournaments to ONLY those allowed for their teaching cadre and school education sector
      if (isTeacherRole && !isManagerOfSport) {
        const rawSportTourns = sportTournaments;
        sportTournaments = rawSportTourns.filter(t => 
          (
            isTeacherLevelAllowedForTournament(teacherCadre, t.level, t.ageCategory, t.sportId || sport.id) ||
            (teacherCadre === 'Primary' && isCrossCountryU15OpenToPrimary(t, rawSportTourns))
          ) &&
          (!teacherSchoolObj || isSchoolSectorAllowedForTournament(teacherSchoolObj, t))
        );
      }
      
      // Determine if programmed for this level
      const isProgrammed = sportTournaments.length > 0;

      // Technical head
      const techHead = teachers.find(tch =>
        tch.isTechCommitteeHead &&
        (tch.techCommitteeSports?.includes(sport.id) || tch.sportId === sport.id)
      );

      // Categories list configured: prefer custom age categories from settings if configured
      let categoriesList: string[] = [];
      if (sport.customAgeCategories && sport.customAgeCategories.length > 0) {
        categoriesList = sport.customAgeCategories.filter(c => c && c.name).map(c => c.id || c.name);
      } else {
        const tournCats = Array.from(new Set(
          sportTournaments
            .map(t => t.ageCategory)
            .filter(Boolean)
        ));
        categoriesList = (sportTournaments.length > 0 && tournCats.length > 0)
          ? tournCats
          : ((sport.ageCategories && sport.ageCategories.length > 0)
            ? sport.ageCategories
            : getAgeCategoriesForSeason(activeSeason, undefined, sport.id).map(c => c.id));
      }

      // Active (non-withdrawn, display-allowed) students in this sport across all schools
      const activeSportStudents = allStudents.filter(s => {
        if (s.sportId !== sport.id) return false;
        if (!isAffiliationAllowedByDisplayConfig(s.affiliationType, affiliationDisplayConfig, sport.id)) return false;
        if (DataService.isSchoolWithdrawn(
          { sportId: sport.id, ageCategory: s.category, gender: s.gender, affiliationType: s.affiliationType },
          s.schoolId,
          s.schoolName || ''
        )) {
          return false;
        }
        return true;
      });
      const registeredCount = activeSportStudents.length;

      // Confirmed schools count respecting affiliationDisplayConfig & withdrawals
      const confirmedSchoolKeys = new Set<string>();
      confirmations
        .filter(c => c.sportId === sport.id && c.status === 'confirmed' && c.schoolName)
        .forEach(c => {
          const validBranches = getEffectiveConfirmedBranches(c, true).filter(b =>
            isAffiliationAllowedByDisplayConfig(b.affiliationType, affiliationDisplayConfig, sport.id)
          );
          if (validBranches.length > 0) {
            confirmedSchoolKeys.add((c.schoolId || c.schoolName).trim().toLowerCase());
          }
        });
      const confirmedSchoolsCount = confirmedSchoolKeys.size;

      // School-specific participation (for teachers/schools)
      const schoolSportStudents = (resolvedTeacherSchoolName || canonicalTeacherSchoolId)
        ? activeSportStudents.filter(s =>
            (canonicalTeacherSchoolId && s.schoolId === canonicalTeacherSchoolId) ||
            (resolvedTeacherSchoolName && schoolNamesMatch(s.schoolName || '', resolvedTeacherSchoolName))
          )
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
        confirmedSchoolsCount,
        hasParticipations,
        schoolRegisteredCount,
        isTeacherRole
      };
    });
  }, [sportsConfig, tournaments, teachers, allStudents, confirmations, activeSeason, effectiveRole, userProfile, currentTeacherProfile, mergedTeacherProfile, isTeacherRole, schools, teacherSchoolObj, canonicalTeacherSchoolId, resolvedTeacherSchoolName, affiliationDisplayConfig, impersonationScopedSportIds]);

  // Filtered sports list (Always sorting programmed tournaments to the top)
  const filteredSports = useMemo(() => {
    return sportsWithTournamentData
      .filter(item => {
        const { sport, isProgrammed, techHead, hasParticipations } = item;

        // In teacher account: strictly show ONLY tournaments that have been activated / programmed
        if (isTeacherRole && !isProgrammed) return false;

        // Filter by Sport
        if (filterSport !== 'ALL' && sport.id !== filterSport) return false;

        // Filter by Status
        if (filterStatus === 'PROGRAMMED' && !isProgrammed) return false;
        if (filterStatus === 'UNPROGRAMMED' && isProgrammed) return false;
        if (filterStatus === 'MY_SCHOOL' && !hasParticipations && !isSchoolConfirmed(sport.id, resolvedTeacherSchoolName || teacherSchoolName)) return false;

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
  }, [sportsWithTournamentData, filterSport, filterStatus, search, isTeacherRole, resolvedTeacherSchoolName, teacherSchoolName, isSchoolConfirmed]);

  const handleOpenSportModal = (sport: Sport) => {
    // 1. Get programmed active tournaments for this sport
    const sportTourns = tournaments.filter(t => 
      t.sportId === sport.id &&
      t.status !== 'Draft' &&
      (t as any).isActive !== false &&
      (!t.seasonId || t.seasonId === activeSeason || (activeSeason === '2026/2027' && t.seasonId === '2025/2026')) &&
      (!t.directorateId || (t.directorateId || 'taourirt') === (activeDirObj?.id || 'taourirt'))
    );

    // 2. Strict Cadre & Sector restriction for Teachers
    if (isTeacherRole && !canManageSport(sport.id)) {
      const userSchool = teacherSchoolObj || findMatchingSchoolForTeacher(schools, mergedTeacherProfile);
      const teacherCadre = resolveEffectiveTeacherCadre(
        mergedTeacherProfile,
        userSchool
      );

      if (sportTourns.length > 0) {
        const isAnyLevelAllowed = sportTourns.some(t =>
          isTeacherLevelAllowedForTournament(teacherCadre, t.level, t.ageCategory, t.sportId || sport.id) ||
          (teacherCadre === 'Primary' && isCrossCountryU15OpenToPrimary(t, sportTourns))
        );
        const isAnySectorAllowed = !userSchool || sportTourns.some(t =>
          isSchoolSectorAllowedForTournament(userSchool, t)
        );

        if (!isAnyLevelAllowed) {
          const levelsSet = new Set<'Primary' | 'Middle' | 'High'>();
          sportTourns.forEach(t => {
            const parsed = parseTournamentAllowedLevels(t.level, t.ageCategory, t.sportId || sport.id);
            if (parsed === 'ALL') {
              levelsSet.add('Primary');
              levelsSet.add('Middle');
              levelsSet.add('High');
            } else {
              parsed.forEach(l => levelsSet.add(l));
            }
          });
          const allowedLevelsAr = levelsSet.size > 0
            ? getTournamentLevelAr(Array.from(levelsSet).join(','))
            : 'أسلاك أخرى';

          let cadreAr = 'السلك المسند لك';
          const cleanCadre = String(teacherCadre || '').toUpperCase();
          if (cleanCadre === 'PRIMARY' || cleanCadre.includes('ابتدائي')) cadreAr = 'التعليم الابتدائي';
          else if (cleanCadre === 'MIDDLE' || cleanCadre.includes('إعدادي')) cadreAr = 'التعليم الإعدادي';
          else if (cleanCadre === 'HIGH' || cleanCadre.includes('تأهيلي') || cleanCadre.includes('ثانوي')) cadreAr = 'التعليم الثانوي التأهيلي';

          toast.error(
            `عذراً، هذه البطولة (${sport.name}) مخصصة لـ (${allowedLevelsAr}) فقط.\nبصفتك أستاذ سلك (${cadreAr})، لا يمكنك الولوج لتسجيل الفرق والمشاركين فيها.`,
            { duration: 6000, id: 'cadre-restriction-toast' }
          );
          return;
        }

        if (!isAnySectorAllowed && userSchool) {
          const sectorsSet = new Set<'public' | 'private'>();
          sportTourns.forEach(t => {
            normalizeTournamentEducationSectors(t).forEach(sec => sectorsSet.add(sec));
          });
          const allowedSectorsAr = getTournamentEducationSectorsAr(Array.from(sectorsSet));
          const schoolSecAr = getSchoolEducationSector(userSchool) === 'private' ? 'التعليم الخصوصي' : 'التعليم العمومي';

          toast.error(
            `عذراً، هذه البطولة (${sport.name}) مفتوحة فقط لمؤسسات (${allowedSectorsAr}).\nمؤسستكم مصنفة ضمن (${schoolSecAr})، ولا يحق لها المشاركة في هذه البطولة.`,
            { duration: 6000, id: 'sector-restriction-toast' }
          );
          return;
        }
      }
    }

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
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 md:p-5 rounded-2xl border border-slate-200 shadow-3xs">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base md:text-lg font-black text-slate-800">
                  {activeBranch === 'regional' && 'البطولة الجهوية للرياضة المدرسية (جهة الشرق)'}
                  {activeBranch === 'national' && 'البطولة الوطنية المدرسية (الجامعة الملكية المغربية للرياضة المدرسية)'}
                  {activeBranch === 'provincial' && `بطولات الرياضات الإقليمية (${activeDirObj?.name || 'المديرية الإقليمية'})`}
                </h2>
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border shrink-0 ${
                  activeBranch === 'regional' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                  activeBranch === 'national' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                  'bg-blue-50 text-blue-700 border-blue-200'
                }`}>
                  {activeBranch === 'regional' ? 'أكاديمية جهة الشرق' : activeBranch === 'national' ? 'القطاع الوطني' : (activeDirObj?.shortName || activeDirObj?.name || 'المديرية الإقليمية')}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                {activeBranch === 'regional' && 'استعراض ومتابعة البطولات والتأهيلات الجهوية على مستوى كافة مديريات جهة الشرق.'}
                {activeBranch === 'national' && 'برمجة وتتبع المشاركات في البطولات الوطنية المدرسية المنظمة تحت إشراف الوزارة والجامعة الملكية.'}
                {activeBranch === 'provincial' && 'تجميع كافة الفئات داخل بطولة كل رياضة. تكون الرياضات غير المعدة باللون الرمادي إلى حين إعداد ضوابطها وبرمجتها.'}
              </p>
            </div>

            {/* Level switcher & action buttons — cleanly wrapped for mobile with zero horizontal scrolling */}
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveBranch('provincial');
                  setSearchParams({ tab: 'provincial' });
                }}
                className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center justify-center flex items-center gap-1.5 cursor-pointer ${
                  activeBranch === 'provincial'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>🏆 البطولة الإقليمية</span>
              </button>

              {hasRegionalQualification && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveBranch('regional');
                    setSearchParams({ tab: 'regional' });
                  }}
                  className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center justify-center flex items-center gap-1.5 cursor-pointer ${
                    activeBranch === 'regional'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>🏅 البطولة الجهوية</span>
                </button>
              )}

              {hasNationalQualification && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveBranch('national');
                    setSearchParams({ tab: 'national' });
                  }}
                  className={`px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all text-center justify-center flex items-center gap-1.5 cursor-pointer ${
                    activeBranch === 'national'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>🥇 البطولة الوطنية</span>
                </button>
              )}

              {/* Add New Championship Button */}
              {canCreate && (
                <button
                  type="button"
                  onClick={() => {
                    setPreselectedSportId(undefined);
                    setIsModalOpen(true);
                  }}
                  className="px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer bg-blue-600 hover:bg-blue-700 text-white shadow-xs flex items-center justify-center gap-1.5 text-center"
                  title="إضافة بطولة إقليمية جديدة وبرمجتها"
                >
                  <Plus className="w-3.5 h-3.5 shrink-0" />
                  <span>إضافة بطولة جديدة</span>
                </button>
              )}

              {/* Import Comprehensive Excel (Teachers, Schools & Participations G..P) */}
              {activeBranch === 'provincial' && !isTeacherRole && userProfile?.role !== 'TEACHER' && (
                <button
                  type="button"
                  onClick={() => setIsImportExcelModalOpen(true)}
                  className="col-span-2 sm:col-span-1 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs flex items-center justify-center gap-1.5 text-center"
                  title="استيراد ملف إكسيل شامل (الأساتذة، المؤسسات، ومشاركات البطولات من الأعمدة G إلى P مع الاحتفاظ بالمعطيات السابقة)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
                  <span>استيراد ملف المشاركات (Excel)</span>
                </button>
              )}

              {/* Sync Locally Saved Excel Records to Cloud Tomorrow */}
              {activeBranch === 'provincial' && !isTeacherRole && userProfile?.role !== 'TEACHER' && pendingCloudSyncCount > 0 && (
                <button
                  type="button"
                  onClick={handleManualCloudSync}
                  disabled={isSyncingPendingCloud}
                  className="col-span-2 sm:col-span-1 px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center justify-center gap-1.5 text-center disabled:opacity-60"
                  title="مزامنة المعطيات المحفوظة محلياً مع قاعدة بيانات السحابة بعد تجدد الحصة اليومية"
                >
                  {isSyncingPendingCloud ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="tabular-nums">مزامنة المحفوظات المحلية ({pendingCloudSyncCount})</span>
                </button>
              )}

              {/* Electronic Draw Button */}
              {!isTeacherRole && userProfile?.role !== 'TEACHER' && (
                <button
                  type="button"
                  onClick={() => setIsDrawModalOpen(true)}
                  className="px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-xs flex items-center justify-center gap-1.5 text-center"
                  title="إجراء القرعة الإلكترونية وبرمجة المباريات وتعيين الحكام"
                >
                  <Shuffle className="w-3.5 h-3.5 shrink-0" />
                  <span>القرعة الإلكترونية والمباريات</span>
                </button>
              )}

              {/* Convert & Deduplicate Participations Button (Central Admin) */}
              {activeBranch === 'provincial' && isCentralAdmin && (
                <>
                  <button
                    type="button"
                    disabled={isCleaningOrphaned}
                    onClick={() => handleCleanOrphanedParticipations(false)}
                    className="px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer bg-amber-600 hover:bg-amber-700 text-white shadow-xs flex items-center justify-center gap-1.5 text-center disabled:opacity-60"
                    title="حذف مشاركات المؤسسات المحذوفة والإبقاء فقط على مشاركات المؤسسات المسجلة حالياً في المؤسسات التعليمية"
                  >
                    <Trash2 className={`w-3.5 h-3.5 shrink-0 ${isCleaningOrphaned ? 'animate-pulse' : ''}`} />
                    <span>{isCleaningOrphaned ? 'جاري التنظيف...' : 'حذف مشاركات المحذوفة'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isConvertingParticipations}
                    onClick={() => handleConvertParticipationsToNonClub(false)}
                    className="px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center justify-center gap-1.5 text-center disabled:opacity-60"
                    title="تحويل جميع مشاركات البطولات إلى غير المنتمين للأندية مع حذف مشاركات المؤسسات المكررة في نفس الصنف والفئة والجنس"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isConvertingParticipations ? 'animate-spin' : ''}`} />
                    <span>{isConvertingParticipations ? 'جاري التحويل...' : 'توحيد المشاركات (غير منتمين)'}</span>
                  </button>
                </>
              )}

              {/* Reset Button (Central Admin & Technical Committee Head scoped to own sport) */}
              {activeBranch === 'provincial' &&
                (isCentralAdmin || (isTechCommitteeHead && allowedSportIds && allowedSportIds.length > 0)) && (
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(true)}
                  className="px-2.5 sm:px-3 py-2 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer bg-rose-600 hover:bg-rose-700 text-white shadow-xs flex items-center justify-center gap-1.5 text-center"
                  title={
                    isCentralAdmin
                      ? 'حذف نتائج المباريات أو المباريات المبرمجة لجميع البطولات أو لبطولة معينة'
                      : 'حذف نتائج المباريات أو المباريات المبرمجة الخاصة برياضتك فقط'
                  }
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  <span>حذف</span>
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
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[140px]">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">الحالة:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="w-full sm:w-auto text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer"
            >
              <option value="ALL">{isTeacherRole ? '🟢 جميع البطولات المفعلة' : 'جميع الحالات'}</option>
              {!isTeacherRole && (
                <option value="PROGRAMMED">🟢 المبرمجة والمفتوحة للتسجيل</option>
              )}
              {userProfile?.role === 'TEACHER' && (
                <option value="MY_SCHOOL">🏫 بطولات تشارك فيها مؤسستي</option>
              )}
              {!isTeacherRole && (
                <option value="UNPROGRAMMED">⚪ غير المبرمجة (في طور الإعداد)</option>
              )}
            </select>
          </div>

          {/* Sport Filter Dropdown */}
          <div className="flex items-center gap-1.5 flex-1 sm:flex-initial min-w-[140px]">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">الرياضة:</span>
            <select
              value={filterSport}
              onChange={(e) => setFilterSport(e.target.value)}
              className="w-full sm:w-auto text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none cursor-pointer sm:max-w-[160px]"
            >
              <option value="ALL">🏆 جميع الرياضات</option>
              {(isTeacherRole
                ? sportsConfig.filter(s => sportsWithTournamentData.some(item => item.sport.id === s.id && item.isProgrammed))
                : sportsConfig
              ).map(s => (
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
              const { sport, sportTournaments, isProgrammed, techHead, categoriesList, registeredCount, confirmedSchoolsCount, hasParticipations, schoolRegisteredCount } = item;
              const isManagerSpecialty = managerSportId && sport.id === managerSportId;
              const canManageThis = canManageSport(sport.id);
              const canDownloadPdf = canUserDownloadTournamentTablePdf(currentTeacherProfile || userProfile, sport.id, sportsConfig);

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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider">
                                بطولة العدو الريفي
                              </span>
                              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                8 فئات مدمجة
                              </span>
                              {sportTournaments[0]?.level && (
                                <span className="bg-blue-500/20 text-blue-200 border border-blue-500/30 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                  {getTournamentLevelAr(sportTournaments[0].level)}
                                </span>
                              )}
                              {sportTournaments[0] && (
                                <span className="bg-purple-500/20 text-purple-200 border border-purple-400/30 text-[9px] font-extrabold px-2 py-0.5 rounded-full">
                                  {getTournamentEducationSectorsAr(sportTournaments[0].educationSectors)}
                                </span>
                              )}
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
                      {isTeacherRole ? (
                        isSchoolConfirmed('cross_country', resolvedTeacherSchoolName || teacherSchoolName) ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <ConfirmedParticipationBadge
                              sportId="cross_country"
                              sportName="العدو الريفي"
                              schoolId={canonicalTeacherSchoolId}
                              schoolName={resolvedTeacherSchoolName || teacherSchoolName}
                              variant="dark"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmParticipationSport({ id: 'cross_country', name: 'العدو الريفي', icon: '🏃‍♂️' });
                              }}
                              onCancelSuccess={() => {
                                refreshConfirmations();
                              }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsCcModalOpen(true);
                              }}
                              className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                            >
                              <Users className="h-4 w-4" />
                              <span>المشاركون (م2)</span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 flex-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmParticipationSport({ id: 'cross_country', name: 'العدو الريفي', icon: '🏃‍♂️' });
                              }}
                              className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-700/30 cursor-pointer animate-pulse"
                              title="تأكيد رغبة المؤسسة في خوض بطولة العدو الريفي"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              <span>تأكيد مشاركة المؤسسة 📋</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsCcModalOpen(true);
                              }}
                              className="py-2 px-2.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-xl flex items-center justify-center transition-colors cursor-pointer shrink-0"
                              title="دخول البطولة"
                            >
                              <Layers className="h-4 w-4" />
                            </button>
                          </div>
                        )
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCcModalOpen(true);
                          }}
                          title="دخول البطولة واستعراض الفئات الـ8"
                          className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          <Layers className="h-4 w-4" />
                          <span>دخول البطولة</span>
                        </button>
                      )}

                      {canManageThis && (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenProgramModal(sport.id);
                            }}
                            title="تعديل وإعداد وبرمجة بطولة العدو الريفي"
                            className="p-2.5 bg-amber-500/30 hover:bg-amber-500/50 text-amber-200 rounded-xl transition-colors cursor-pointer shrink-0 border border-amber-400/30 flex items-center justify-center"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          {isCentralAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSportToDeleteAll({ id: sport.id, name: sport.name });
                              }}
                              title="مسح كافة بطولات هذه الرياضة"
                              className="p-2.5 bg-red-500/30 hover:bg-red-500/50 text-red-200 rounded-xl transition-colors cursor-pointer shrink-0 border border-red-400/30 flex items-center justify-center"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}

                      {canDownloadPdf && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownloadTournamentTablePdf(sport, sportTournaments);
                          }}
                          title="تحميل جدول المؤسسات المشاركة بصيغة PDF"
                          className="p-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center gap-1 font-black text-[11px]"
                        >
                          <FileText className="h-4 w-4" />
                          <span>PDF</span>
                        </button>
                      )}

                      {canDo('action:export_data') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportAllCrossCountry();
                          }}
                          title="تصدير ملف العدو الريفي الموحد Excel"
                          className="p-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {isTeacherRole && !canManageThis && (
                      <div className="px-3 py-2 bg-emerald-950/60 border-t border-white/10 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleOpenTeacherCcBibsModal}
                          title={
                            ccBibsStatus.generated
                              ? 'تحميل أو طبع صدريات مؤسستك فقط بصيغة PDF'
                              : 'ستتاح صدريات مؤسستك للتحميل والطباعة فور توليدها من طرف المسير'
                          }
                          className={`w-full py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                            ccBibsStatus.generated && teacherOwnCcRunnersCount > 0
                              ? 'bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 border-amber-300 shadow-sm'
                              : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/15'
                          }`}
                        >
                          {ccBibsStatus.generated ? (
                            <Printer className="h-4 w-4 shrink-0" />
                          ) : (
                            <Lock className="h-3.5 w-3.5 text-amber-300 shrink-0" />
                          )}
                          <span>
                            {ccBibsStatus.generated
                              ? teacherOwnCcRunnersCount > 0
                                ? `تحميل / طبع صدريات مؤسستي PDF (${teacherOwnCcRunnersCount}) 🎽`
                                : 'صدريات مؤسستي PDF (لا يوجد تلاميذ مسجلون بمؤسستك)'
                              : 'صدريات مؤسستي PDF (متاحة بعد التوليد من المسير) 🎽'}
                          </span>
                        </button>
                      </div>
                    )}

                    {isCentralAdmin && (
                      <div className="px-3 py-2 bg-indigo-950/70 border-t border-white/10 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-indigo-200">أداة المسير المركزي:</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsCcDemoModalOpen(true);
                          }}
                          title="توليد بيانات افتراضية للمشاركين الخاصة بالمؤسسات الموجودة في المنصة"
                          className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-[11px] font-black flex items-center gap-1.5 shadow-sm border border-indigo-400/40 cursor-pointer transition-all"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                          <span>توليد بيانات افتراضية للمشاركين</span>
                        </button>
                      </div>
                    )}
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

                        <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600">
                          <Lock className="h-3 w-3 text-slate-600 dark:text-slate-400" />
                          غير مبرمجة بعد
                        </span>
                      </div>

                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 leading-snug">
                        البطولة الإقليمية لـ {sport.name}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-white/60 dark:bg-slate-950/40 p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-700/60">
                        في انتظار تحديد الفئات العمرية وضوابط المشاركة من طرف المسير المركزي أو رئيس اللجنة التقنية المكلف.
                      </p>

                      {/* Technical Committee Head Info */}
                      <div className="bg-slate-200/50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-300/50 dark:border-slate-700 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium">
                          <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          <span>رئيس اللجنة التقنية:</span>
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {techHead ? techHead.fullName : 'لم يتم التعيين بعد'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-200/60 dark:bg-slate-800 border-t border-slate-300/60 dark:border-slate-700 flex items-center justify-between gap-2">
                      {canManageThis ? (
                        <button
                          onClick={() => handleOpenProgramModal(sport.id)}
                          className="w-full py-2 px-3 bg-slate-700 dark:bg-slate-600 hover:bg-slate-800 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          <Settings className="h-4 w-4" />
                          <span>إعداد وبرمجة البطولة الآن</span>
                        </button>
                      ) : (
                        <button
                          disabled
                          className="w-full py-2 px-3 bg-slate-300/80 dark:bg-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
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
                  onClick={() => handleOpenSportModal(sport)}
                  className={`flex flex-col rounded-2xl border shadow-3xs overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                    isClub
                      ? 'bg-amber-50/90 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 hover:border-amber-400'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-700'
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
                          isClub ? 'bg-amber-100/80 dark:bg-amber-900/60 border-amber-300 dark:border-amber-700' : 'bg-blue-50 dark:bg-blue-950/60 border-blue-100 dark:border-blue-900'
                        }`}>
                          {sport.icon || '🏆'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-blue-900 dark:text-blue-200 uppercase tracking-wider">
                              {sport.name}
                            </span>
                            {hasBothClasses ? (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="text-[9px] font-extrabold bg-amber-100 dark:bg-amber-900 text-amber-950 dark:text-amber-200 px-1.5 py-0.2 rounded border border-amber-300 dark:border-amber-700 shadow-3xs">
                                  🟡 للمنتمين للأندية
                                </span>
                                <span className="text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 px-1.5 py-0.2 rounded border border-slate-300 dark:border-slate-700 shadow-3xs">
                                  ⚪ لا منتمين
                                </span>
                              </div>
                            ) : isClub ? (
                              <span className="text-[9px] font-extrabold bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 px-1.5 py-0.2 rounded border border-amber-400 dark:border-amber-700 shadow-3xs">
                                🟡 للمنتمين للأندية
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 px-1.5 py-0.2 rounded border border-slate-300 dark:border-slate-700 shadow-3xs">
                                ⚪ لا منتمين
                              </span>
                            )}
                            {isManagerSpecialty && (
                              <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800">
                                <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                تخصصك
                              </span>
                            )}
                            {(() => {
                              const levelSet = new Set<'Primary' | 'Middle' | 'High'>();
                              sportTournaments.forEach(t => {
                                const parsed = parseTournamentAllowedLevels(t.level, t.ageCategory, t.sportId || sport.id);
                                if (parsed === 'ALL') {
                                  levelSet.add('Primary');
                                  levelSet.add('Middle');
                                  levelSet.add('High');
                                } else {
                                  parsed.forEach(l => levelSet.add(l));
                                }
                              });
                              const combinedLevel = levelSet.size === 3
                                ? 'جميع الأسلاك'
                                : levelSet.size > 0
                                ? Array.from(levelSet).join(',')
                                : (mainTourn?.level || '');
                              if (!combinedLevel) return null;
                              return (
                                <span className="text-[9px] font-extrabold bg-blue-50 text-blue-800 px-1.5 py-0.2 rounded border border-blue-200 shadow-3xs">
                                  🎓 {getTournamentLevelAr(combinedLevel)}
                                </span>
                              );
                            })()}
                            {mainTourn && (
                              <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded border shadow-3xs ${
                                normalizeTournamentEducationSectors(mainTourn).length === 1 && normalizeTournamentEducationSectors(mainTourn)[0] === 'private'
                                  ? 'bg-purple-50 text-purple-800 border-purple-200'
                                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              }`}>
                                {getTournamentEducationSectorsAr(mainTourn.educationSectors)}
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
                        <div className="flex items-center gap-1">
                          {isSchoolConfirmed(sport.id, resolvedTeacherSchoolName || teacherSchoolName) ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>المشاركة مؤكدة</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 shrink-0">
                              <span>لم تؤكد بعد</span>
                            </span>
                          )}
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                            hasParticipations
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {hasParticipations ? `مسجل: ${schoolRegisteredCount}` : 'بدون تلاميذ'}
                          </span>
                        </div>
                      )}
                    </div>

                     {/* Configured Categories & Limit */}
                     <div className="text-[11px] text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                       <div className="flex items-start justify-between gap-2">
                         <span className="text-slate-500 mt-1 shrink-0">الفئات المدمجة:</span>
                         <div className="flex flex-col gap-1 items-end max-w-[75%]">
                           {categoriesList.slice(0, 4).map(c => {
                             const badge = formatCategoryBadge(c, sportTournaments, sport.id);
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

                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                        <span className="text-slate-500">المؤسسات المؤكدة مشاركتها:</span>
                        <strong className="text-blue-700 font-bold tabular-nums">
                          {confirmedSchoolsCount} مؤسسة
                        </strong>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">إجمالي المسجلين بالإقليم:</span>
                        <strong className="text-emerald-700 font-bold tabular-nums">{registeredCount} تلميذ(ة)</strong>
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
                    {userProfile?.role === 'TEACHER' ? (
                      isSchoolConfirmed(sport.id, resolvedTeacherSchoolName || teacherSchoolName) ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <ConfirmedParticipationBadge
                            sportId={sport.id}
                            sportName={sport.name}
                            schoolId={canonicalTeacherSchoolId}
                            schoolName={resolvedTeacherSchoolName || teacherSchoolName}
                            variant="light"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmParticipationSport(sport);
                            }}
                            onCancelSuccess={() => {
                              refreshConfirmations();
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSportModal(sport);
                            }}
                            className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                          >
                            <Users className="h-4 w-4" />
                            <span>المشاركون (م2)</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmParticipationSport(sport);
                            }}
                            className="flex-1 py-2.5 px-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-700/20 cursor-pointer animate-pulse"
                            title="تأكيد رغبة المؤسسة في خوض البطولة أولاً قبل إضافة أسماء التلاميذ"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            <span>تأكيد مشاركة المؤسسة 📋</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenSportModal(sport);
                            }}
                            className="py-2.5 px-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer shrink-0"
                            title="استعراض تفاصيل البطولة"
                          >
                            <Layers className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSportModal(sport);
                        }}
                        className="flex-1 py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer"
                      >
                        <Layers className="h-4 w-4" />
                        <span>تسجيل الفرق والمشاركين</span>
                      </button>
                    )}

                    {canDownloadPdf && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadTournamentTablePdf(sport, sportTournaments);
                        }}
                        title="تحميل جدول المؤسسات المشاركة بصيغة PDF"
                        className="px-2.5 py-2 text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1 shrink-0 text-[11px] font-black shadow-3xs"
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span>PDF</span>
                      </button>
                    )}

                    {canManageThis && (
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {TEAM_SPORTS_IDS.includes(sport.id) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSportForDraw(sport.id);
                              setSelectedTournamentForDraw(undefined);
                              setIsDrawModalOpen(true);
                            }}
                            title={`إجراء القرعة الإلكترونية لبطولة ${sport.name}`}
                            className="p-2 text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100/90 bg-emerald-50 border border-emerald-300 rounded-xl transition-colors cursor-pointer shrink-0 flex items-center justify-center shadow-3xs"
                          >
                            <Shuffle className="h-4 w-4" />
                          </button>
                        )}

                        {isCentralAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSportToDeleteAll({ id: sport.id, name: sport.name });
                            }}
                            title="مسح كافة بطولات هذه الرياضة وإعادتها لحالة غير مبرمجة"
                            className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer border border-red-200 bg-white flex items-center justify-center shrink-0"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenProgramModal(sport.id);
                          }}
                          title="تعديل وإعداد وبرمجة البطولة"
                          className="p-2 text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer border border-amber-200 bg-amber-50/60 flex items-center justify-center shrink-0"
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
              <p className="text-sm font-bold text-slate-700 mb-1">
                {isTeacherRole ? 'لا توجد بطولات مفعلة حالياً لمؤسستكم' : 'لا توجد رياضات مطابقة للبحث'}
              </p>
              <p className="text-xs text-slate-400 mb-4">
                {isTeacherRole
                  ? 'يتم عرض البطولات المبرمجة والمفعلة رسمياً فقط. ستظهر البطولات فور قيام الإدارة واللجنة التقنية بتفعيلها.'
                  : 'يمكنك تغيير فلتر الرياضة أو الفلتر المعتمد أعلاه'}
              </p>
            </div>
          )}
        </div>
      )}
      </div>
    )}

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
        teachers={teachers}
        techHead={teachers.find(tch => tch.isTechCommitteeHead && (tch.techCommitteeSports?.includes('cross_country') || tch.sportId === 'cross_country'))}
        activeSeason={activeSeason}
        canManage={canManageSport('cross_country')}
        isCentralAdmin={isCentralAdmin}
        activeDirectorateId={activeDirObj?.id || 'taourirt'}
        onProgramTournament={(sId) => {
          setIsCcModalOpen(false);
          handleOpenProgramModal(sId);
        }}
        onRefreshData={loadData}
        isTeacherRole={effectiveRole === 'TEACHER'}
        teacherSchoolName={effectiveRole === 'TEACHER' && userProfile ? userProfile.workLocation : undefined}
      />

      {isTeacherCcBibsModalOpen && isTeacherRole && (
        <BibGeneratorModal
          isOpen={true}
          onClose={() => setIsTeacherCcBibsModalOpen(false)}
          students={allStudents}
          schools={schools}
          directorateName={activeDirObj?.shortName || activeDirObj?.name || 'تاوريرت'}
          teacherSchoolScope={{
            schoolId: canonicalTeacherSchoolId,
            schoolName: resolvedTeacherSchoolName || teacherSchoolName
          }}
        />
      )}

      {isCentralAdmin && (
        <CrossCountryDemoModal
          isOpen={isCcDemoModalOpen}
          onClose={() => setIsCcDemoModalOpen(false)}
          schools={schools}
          teachers={teachers}
          allStudents={allStudents}
          tournaments={tournaments}
          activeSeason={activeSeason}
          activeDirectorateId={activeDirObj?.id || 'taourirt'}
          currentUser={userProfile}
          onSuccess={() => {
            refreshConfirmations();
            loadData();
          }}
        />
      )}

      {/* General Sport Championship Modal for viewing categories, controls & rosters */}
      {selectedSportForModal && (
        <SportChampionshipModal
          isOpen={isSportModalOpen && selectedSportForModal.id !== 'athletics'}
          onClose={() => setIsSportModalOpen(false)}
          sport={selectedSportForModal}
          tournaments={tournaments}
          allStudents={allStudents}
          schools={schools}
          matches={matches}
          teachers={teachers}
          activeSeason={activeSeason}
          canManage={canManageSport(selectedSportForModal.id)}
          isProgrammed={
            sportsWithTournamentData.find(item => item.sport.id === selectedSportForModal.id)?.isProgrammed || false
          }
          onProgramTournament={(sId) => {
            setIsSportModalOpen(false);
            handleOpenProgramModal(sId);
          }}
          onRefreshData={loadData}
          isTeacherRole={effectiveRole === 'TEACHER'}
          teacherSchoolName={effectiveRole === 'TEACHER' && userProfile ? userProfile.workLocation : undefined}
        />
      )}

      {/* Athletics Championship dedicated manager modal */}
      <AthleticsChampionshipModal
        isOpen={isSportModalOpen && selectedSportForModal?.id === 'athletics'}
        onClose={() => setIsSportModalOpen(false)}
        teachers={teachers}
        schools={schools}
        students={allStudents}
        currentUser={userProfile}
        directorateName={activeDirObj?.name || undefined}
        season={activeSeason}
        onProgramTournament={(sId) => {
          setIsSportModalOpen(false);
          handleOpenProgramModal(sId);
        }}
      />

      {/* Create / Program Tournament Modal (Always Foreground) */}
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

      {/* Edit Tournament Modal (Always Foreground) */}
      <EditTournamentModal
        isOpen={!!editingTournament}
        tournament={editingTournament}
        onClose={() => setEditingTournament(null)}
        onUpdated={loadData}
      />

      {/* Edit Tournament Schedule & Dates Modal (Always Foreground) */}
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

      {/* Electronic Draw and Schedule Wizard */}
      <ElectronicDrawModal
        isOpen={isDrawModalOpen}
        onClose={() => {
          setIsDrawModalOpen(false);
          setSelectedSportForDraw(undefined);
          setSelectedTournamentForDraw(undefined);
        }}
        currentUser={userProfile}
        onMatchesCreated={loadData}
        initialSportId={selectedSportForDraw}
        initialTournamentId={selectedTournamentForDraw}
      />

      {/* Comprehensive Excel Import Modal (Teachers + Schools + Sport Participations G..P) */}
      <ImportParticipationsExcelModal
        isOpen={isImportExcelModalOpen}
        onClose={() => setIsImportExcelModalOpen(false)}
        directorateId={activeDirObj?.id || DataService.getActiveDirectorateId()}
        directorateName={activeDirObj?.name || 'المديرية الإقليمية بتاوريرت'}
        activeSeason={activeSeason}
        onImportComplete={async () => {
          await refreshConfirmations();
          await loadData();
        }}
      />

      {/* School Participation Confirmation Modal */}
      {confirmParticipationSport && (
        <ConfirmParticipationModal
          isOpen={true}
          onClose={() => setConfirmParticipationSport(null)}
          sport={confirmParticipationSport}
          tournaments={tournaments.filter(t => t.sportId === confirmParticipationSport.id)}
          schoolName={resolvedTeacherSchoolName || teacherSchoolName}
          schoolId={canonicalTeacherSchoolId}
          teacherId={userProfile?.id}
          teacherName={userProfile?.fullName}
          teacherPhone={userProfile?.phone}
          teacherLeaseNumber={userProfile?.leaseNumber}
          registrationDeadline={
            tournaments.find(t => t.sportId === confirmParticipationSport.id && t.registrationDeadline)?.registrationDeadline
          }
          confirmedRecord={getConfirmation(confirmParticipationSport.id, resolvedTeacherSchoolName || teacherSchoolName)}
          onConfirmSuccess={() => {
            refreshConfirmations();
            loadData();
          }}
          onCancelSuccess={() => {
            refreshConfirmations();
            loadData();
          }}
          onProceedToRegister={() => {
            if (confirmParticipationSport.id === 'cross_country') {
              setIsCcModalOpen(true);
            } else {
              handleOpenSportModal(confirmParticipationSport);
            }
          }}
        />
      )}

      {/* Tournament & Matches Reset Modal (Central Admin + Technical Committee Head scoped) */}
      <TournamentResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        sportsConfig={sportsConfig}
        tournaments={tournaments}
        matches={matches}
        isCentralAdmin={isCentralAdmin}
        allowedSportIds={allowedSportIds}
        onResetComplete={() => loadData(true)}
      />

    </div>
  );
};
