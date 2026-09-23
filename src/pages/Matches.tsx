import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP, deduplicateById, AGE_CATEGORIES, isClubTournament, getAgeCategoriesForSeason, normalizeCategoryKey } from '../lib/dataService';
import { Match, School, Venue, Tournament, Sport, Student, User } from '../types';
import { CountdownTimer } from '../components/CountdownTimer';
import {
  Plus,
  Search,
  CalendarDays,
  MapPin,
  Clock,
  Filter,
  CheckCircle2,
  Trophy,
  UserCheck,
  KeyRound,
  Trash2,
  ShieldCheck,
  Lock,
  Pencil,
  Phone,
  Calendar as CalendarIcon,
  ListOrdered,
  FileDown,
  BookOpen,
  ArrowRight,
  ChevronLeft,
  Users,
  Activity,
  Award,
  Medal,
  Layers,
  Sparkles,
  ChevronRight,
  Settings,
  Star
} from 'lucide-react';
import { CreateMatchModal } from '../components/CreateMatchModal';
import { ScoreModal } from '../components/ScoreModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { ChampionshipCalendarView } from '../components/ChampionshipCalendarView';
import { SportResultsModal } from '../components/SportResultsModal';
import { EditTournamentModal } from '../components/EditTournamentModal';
import { EditTournamentScheduleModal } from '../components/EditTournamentScheduleModal';
import { CrossCountryCategoryResult } from '../types';
import { CROSS_COUNTRY_CATEGORIES } from '../lib/crossCountryConfig';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

export const Matches: React.FC = () => {
  const { userProfile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [crossCountryResults, setCrossCountryResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [activeSeason, setActiveSeason] = useState('2026/2027');
  const [loading, setLoading] = useState(true);

  // Filters for Level 1 Sports overview
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [affiliationFilter, setAffiliationFilter] = useState<string>('ALL'); // Default to 'ALL' to show all matches

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Tab selection ('list' for sports/results hierarchy, 'calendar' for annual schedule)
  const tabParam = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<'list' | 'calendar'>(() => {
    return tabParam === 'calendar' ? 'calendar' : 'list';
  });

  // Selected sport for detailed results modal (Level 2 & 3)
  const [selectedSportForResults, setSelectedSportForResults] = useState<Sport | null>(null);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);

  // Modals for Match / Tournament operations
  const [isCreateMatchOpen, setIsCreateMatchOpen] = useState(false);
  const [createMatchInitialSportId, setCreateMatchInitialSportId] = useState<string | undefined>(undefined);
  const [createMatchInitialAffiliation, setCreateMatchInitialAffiliation] = useState<'non_club' | 'club_affiliated' | 'open' | undefined>(undefined);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);
  const [selectedMatchForScore, setSelectedMatchForScore] = useState<Match | null>(null);

  // Edit / Delete tournament modals
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [isEditTournamentOpen, setIsEditTournamentOpen] = useState(false);
  const [selectedSportForSchedule, setSelectedSportForSchedule] = useState<Sport | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Deletion targets
  const [matchToDelete, setMatchToDelete] = useState<Match | null>(null);
  const [tournamentToDelete, setTournamentToDelete] = useState<Tournament | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Role flags
  const isTeacher = userProfile?.role === 'TEACHER' && !userProfile?.isTechCommitteeHead;
  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';
  const isSportManager = userProfile?.role === 'SPORT_MANAGER';
  const isTechCommitteeHead = userProfile?.isTechCommitteeHead === true;

  const canCreate = isCentralAdmin || isSportManager || isTechCommitteeHead;

  // Manager specialty sport ID
  const managerSportId = useMemo(() => {
    if (userProfile?.role !== 'SPORT_MANAGER') return undefined;
    if (userProfile.sportId) return userProfile.sportId;
    const assignedTourn = tournaments.find(t =>
      (t.managerEmail && t.managerEmail.toLowerCase() === userProfile.email?.toLowerCase()) ||
      (t.managerName && t.managerName === userProfile.fullName)
    );
    return assignedTourn?.sportId || 'basketball';
  }, [userProfile, tournaments]);

  // Load initial data
  const loadData = async () => {
    setLoading(true);
    try {
      const [m, s, v, t, curSeason, ccRes, stu, config, tch] = await Promise.all([
        DataService.getMatches(),
        DataService.getSchools(),
        DataService.getVenues(),
        DataService.getTournaments(),
        DataService.getActiveSeason(),
        DataService.getCrossCountryResults(),
        DataService.getStudents(),
        DataService.getSportsConfig(),
        DataService.getTeachers()
      ]);
      setMatches(m);
      setSchools(s);
      setVenues(v);
      setTournaments(deduplicateById(t));
      if (curSeason) setActiveSeason(curSeason);
      if (ccRes) setCrossCountryResults(ccRes);
      if (stu) setStudents(stu);
      if (config) setSportsConfig(config);
      if (tch) setTeachers(tch);
    } catch (error) {
      console.error('Error loading matches data:', error);
      toast.error('حدث خطأ أثناء تحميل بيانات المباريات والنتائج');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const handleDirChange = () => {
      loadData();
    };

    const unsubscribeCC = DataService.subscribeCrossCountryResults((liveResults) => {
      if (liveResults) {
        setCrossCountryResults(liveResults);
      }
    });

    window.addEventListener('directorateChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
      if (unsubscribeCC) unsubscribeCC();
    };
  }, []);

  useEffect(() => {
    if (tabParam === 'calendar') {
      setActiveTab('calendar');
    } else {
      setActiveTab('list');
    }
  }, [tabParam]);

  const handleTabChange = (tab: 'list' | 'calendar') => {
    setActiveTab(tab);
    setSearchParams(prev => {
      const p = new URLSearchParams(prev);
      p.set('tab', tab);
      return p;
    });
  };

  // Open Sport Results Modal (Level 2 & 3)
  const handleOpenSportResults = (sport: Sport) => {
    if (sport.isProgrammed === false) {
      toast.error('هذه الرياضة غير مبرمجة بعد للموسم الحالي، ولا يمكن استعراض نتائجها أو مقابلاتها.');
      return;
    }
    setSelectedSportForResults(sport);
    setIsResultsModalOpen(true);
  };

  // Save/Update match
  const handleSaveMatch = async (matchData: Omit<Match, 'id'>, matchId?: string) => {
    try {
      if (matchId) {
        await DataService.updateMatch(matchId, matchData);
        toast.success('تم تحيين بيانات المقابلة بنجاح');
      } else {
        await DataService.addMatch(matchData);
        toast.success('تمت برمجة المقابلة بنجاح');
      }
      setIsCreateMatchOpen(false);
      setEditingMatch(null);
      await loadData();
    } catch (error: any) {
      console.error('Error saving match:', error);
      toast.error(error.message || 'فشل في حفظ بيانات المقابلة');
    }
  };

  // Save match score
  const handleSaveScore = async (
    matchId: string,
    score1: number,
    score2: number,
    status: Match['status'],
    options?: {
      scorers?: string;
      penalty1?: number;
      penalty2?: number;
      isWalkover?: boolean;
      walkoverWinner?: 'team1' | 'team2';
      winnerTeamId?: string;
      school1Qualified?: boolean;
      school2Qualified?: boolean;
    }
  ) => {
    try {
      await DataService.updateMatchScore(matchId, score1, score2, status, options);
      toast.success('تم تسجيل وتحيين نتيجة المقابلة بنجاح');
      setSelectedMatchForScore(null);
      await loadData();
    } catch (error: any) {
      console.error('Error updating match score:', error);
      toast.error(error.message || 'فشل في تحيين النتيجة');
    }
  };

  // Confirm delete match
  const handleConfirmDeleteMatch = async () => {
    if (!matchToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteMatch(matchToDelete.id);
      toast.success('تم حذف المقابلة والنتيجة بنجاح!');
      setMatchToDelete(null);
      await loadData();
    } catch (error: any) {
      console.error('Error deleting match:', error);
      toast.error(error.message || 'فشل في حذف المقابلة');
    } finally {
      setIsDeleting(false);
    }
  };

  // Confirm delete tournament
  const handleConfirmDeleteTournament = async () => {
    if (!tournamentToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteTournament(tournamentToDelete.id);
      toast.success('تم حذف البطولة الإقليمية بنجاح!');
      setTournamentToDelete(null);
      await loadData();
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      toast.error(error.message || 'فشل في حذف البطولة');
    } finally {
      setIsDeleting(false);
    }
  };

  // Save cross country category result
  const handleSaveCrossCountryResult = async (result: CrossCountryCategoryResult) => {
    try {
      await DataService.saveCrossCountryCategoryResult(result);
      setCrossCountryResults(prev => ({
        ...prev,
        [result.categoryId]: result
      }));
      toast.success('تم حفظ وتثبيت نتائج البوديوم بنجاح 🏆');
    } catch (error) {
      console.error('Error saving cross country result:', error);
      toast.error('حدث خطأ أثناء حفظ النتائج');
    }
  };

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

  // Group sports with match metrics & tournaments
  const sportsData = useMemo(() => {
    const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
    const seasonalCats = getAgeCategoriesForSeason(activeSeason);

    return sportsConfig.map(sport => {
      let sportTournaments = tournaments.filter(t => t.sportId === sport.id);
      
      // Filter tournaments by affiliation if not ALL
      if (affiliationFilter !== 'ALL') {
        sportTournaments = sportTournaments.filter(t => {
          if (affiliationFilter === 'open') return t.affiliationType === 'open' || (t.name && (t.name.includes('مفتوحة') || t.name.includes('المفتوحة')));
          if (affiliationFilter === 'non_club') return t.affiliationType === 'non_club' || (!t.affiliationType && !isClubTournament(t));
          if (affiliationFilter === 'club_affiliated') return t.affiliationType === 'club_affiliated' || isClubTournament(t);
          return true;
        });
      }

      const sportMatches = matches.filter(m => {
        // Directorate filter check
        if (activeDirId && activeDirId !== 'all') {
          const matchDir = m.directorateId || 'taourirt';
          if (matchDir !== activeDirId) return false;
        }

        // Determine effective sportId of match
        const effectiveSportId = m.sportId || (m.tournamentId ? tournaments.find(t => t.id === m.tournamentId)?.sportId : undefined);
        if (effectiveSportId && effectiveSportId !== sport.id) return false;
        if (!effectiveSportId && sport.id !== 'football') return false; // Fallback to football if sportId missing

        // Affiliation check if filtered
        if (affiliationFilter !== 'ALL') {
          let matchAffiliation = 'non_club';
          if (m.tournamentId) {
            const matchedTourn = tournaments.find(t => t.id === m.tournamentId);
            if (matchedTourn) {
              if (matchedTourn.affiliationType) {
                matchAffiliation = matchedTourn.affiliationType;
              } else if (isClubTournament(matchedTourn)) {
                matchAffiliation = 'club_affiliated';
              } else if (matchedTourn.name && (matchedTourn.name.includes('مفتوحة') || matchedTourn.name.includes('المفتوحة'))) {
                matchAffiliation = 'open';
              }
            }
          }
          if ((m as any).affiliationType) {
            matchAffiliation = (m as any).affiliationType;
          }

          if (affiliationFilter === 'open' && matchAffiliation !== 'open') return false;
          if (affiliationFilter === 'non_club' && matchAffiliation === 'club_affiliated') return false;
          if (affiliationFilter === 'club_affiliated' && matchAffiliation !== 'club_affiliated') return false;
        }

        return true;
      });

      let scheduledCount = sportMatches.filter(m => m.status === 'Scheduled').length;
      let ongoingCount = sportMatches.filter(m => m.status === 'Ongoing').length;
      let completedCount = sportMatches.filter(m => m.status === 'Completed').length;
      let totalMatches = sportMatches.length;

      if (sport.id === 'cross_country') {
        const ccCompleted = CROSS_COUNTRY_CATEGORIES.filter(c => crossCountryResults[c.id]?.podium && crossCountryResults[c.id].podium.length > 0).length;
        completedCount = ccCompleted;
        totalMatches = 8;
        scheduledCount = Math.max(0, 8 - ccCompleted);
      }

      const nonClubCount = sportMatches.filter(m => {
        if (m.tournamentId) {
          const pt = tournaments.find(t => t.id === m.tournamentId);
          if (pt) return !isClubTournament(pt);
        }
        return true;
      }).length;

      const clubCount = totalMatches - nonClubCount;

      // Determine if programmed / open
      const isProgrammed = sport.id === 'cross_country'
        ? true
        : (sportTournaments.length > 0 || sportMatches.length > 0
          ? true
          : (sport.isProgrammed !== undefined
            ? sport.isProgrammed
            : (Boolean(sport.ageCategories && sport.ageCategories.length > 0 && sport.studentLimit !== undefined && sport.studentLimit > 0))));

      // Technical head
      const techHead = teachers.find(tch =>
        tch.isTechCommitteeHead &&
        (tch.techCommitteeSports?.includes(sport.id) || tch.sportId === sport.id)
      );

      // Categories list configured: prefer actual active tournament categories if present
      const tournCats = Array.from(new Set(sportTournaments.map(t => normalizeCategoryKey(t.ageCategory)).filter(Boolean)));
      const categoriesList = (sportTournaments.length > 0 && tournCats.length > 0)
        ? tournCats
        : ((sport.ageCategories && sport.ageCategories.length > 0)
          ? sport.ageCategories.map(normalizeCategoryKey)
          : seasonalCats.map(c => c.id));

      const registeredCount = students.filter(s => s.sportId === sport.id).length;

      const hasClubTournaments = sportTournaments.some(t => isClubTournament(t));
      const hasSchoolOnlyTournaments = sportTournaments.some(t => !isClubTournament(t));
      const hasBothClasses = hasClubTournaments && hasSchoolOnlyTournaments;
      const mainTourn = sportTournaments.length > 0 ? sportTournaments[0] : null;
      const isClub = isClubTournament(mainTourn) && !hasBothClasses;

      return {
        sport,
        sportTournaments,
        sportMatches,
        scheduledCount,
        ongoingCount,
        completedCount,
        totalMatches,
        nonClubCount,
        clubCount,
        isProgrammed,
        techHead,
        categoriesList,
        registeredCount,
        hasClubTournaments,
        hasSchoolOnlyTournaments,
        hasBothClasses,
        isClub
      };
    });
  }, [sportsConfig, tournaments, matches, affiliationFilter, activeSeason, teachers, students]);

  // Filtered sports list for Level 1 (Open / Programmed tournaments ALWAYS on top)
  const filteredSports = useMemo(() => {
    return sportsData
      .filter(item => {
        const { sport, totalMatches, ongoingCount, completedCount, scheduledCount, isProgrammed } = item;

        // Filter by Sport
        if (selectedSportFilter !== 'ALL' && sport.id !== selectedSportFilter) return false;

        // Filter by Status
        if (statusFilter === 'OPEN' && !isProgrammed) return false;
        if (statusFilter === 'Ongoing' && ongoingCount === 0) return false;
        if (statusFilter === 'Scheduled' && scheduledCount === 0) return false;
        if (statusFilter === 'Completed' && completedCount === 0) return false;

        // Hide sports with no matches in this affiliation (except cross country if programmed)
        if (totalMatches === 0 && affiliationFilter !== 'ALL' && sport.id !== 'cross_country') return false;

        // Filter by Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = sport.name.toLowerCase().includes(q);
          const matchDesc = (sport.description || '').toLowerCase().includes(q);
          const matchHead = item.techHead?.fullName.toLowerCase().includes(q);
          return matchName || matchDesc || matchHead;
        }

        return true;
      })
      .sort((a, b) => {
        // 1. Programmed / Open tournaments ALWAYS at the top
        if (a.isProgrammed && !b.isProgrammed) return -1;
        if (!a.isProgrammed && b.isProgrammed) return 1;

        // 2. Among open / programmed sports:
        if (a.isProgrammed && b.isProgrammed) {
          // Cross Country championship at the very top
          if (a.sport.id === 'cross_country' && b.sport.id !== 'cross_country') return -1;
          if (a.sport.id !== 'cross_country' && b.sport.id === 'cross_country') return 1;

          // Ongoing matches first
          if (a.ongoingCount !== b.ongoingCount) return b.ongoingCount - a.ongoingCount;

          // Total matches count descending
          if (a.totalMatches !== b.totalMatches) return b.totalMatches - a.totalMatches;

          // Tournaments count descending
          if (a.sportTournaments.length !== b.sportTournaments.length) {
            return b.sportTournaments.length - a.sportTournaments.length;
          }
        }

        return 0;
      });
  }, [sportsData, selectedSportFilter, statusFilter, searchQuery, affiliationFilter]);

  // Overall Match Stats (Respecting filters)
  const filteredMatches = useMemo(() => {
    return filteredSports.reduce((acc, item) => [...acc, ...item.sportMatches], [] as Match[]);
  }, [filteredSports]);

  const overallScheduledCount = filteredMatches.filter(m => m.status === 'Scheduled').length;
  const overallOngoingCount = filteredMatches.filter(m => m.status === 'Ongoing').length;
  const overallCompletedCount = filteredMatches.filter(m => m.status === 'Completed').length;
  const programmedSportsCount = filteredSports.length;

  return (
    <div className="space-y-6 dir-rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-black text-slate-800">
              نتائج ومباريات البطولات الإقليمية المدرسية
            </h2>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-extrabold px-2.5 py-0.5 rounded-full border border-blue-200">
              الموسم {activeSeason}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            استعراض النتائج والبرمجة حسب الرياضة، صنف البطولة (⚪ لا منتمين / 🟡 منتمين للأندية)، والفئات العمرية
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Main Tab Toggle: Sports List vs Calendar */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => handleTabChange('list')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === 'list'
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>نتائج الرياضات</span>
            </button>
            <button
              onClick={() => handleTabChange('calendar')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                activeTab === 'calendar'
                  ? "bg-slate-900 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>الرزنامة الإقليمية</span>
            </button>
          </div>

          {canCreate && (
            <button
              onClick={() => {
                setEditingMatch(null);
                setCreateMatchInitialSportId(undefined);
                setIsCreateMatchOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>برمجة مباراة جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Content View */}
      {activeTab === 'calendar' ? (
        <ChampionshipCalendarView
          matches={matches}
          tournaments={tournaments}
          schools={schools}
          venues={venues}
          activeSeason={activeSeason}
          user={userProfile}
          onOpenMatchDetail={(match) => {
            if (canCreate) {
              setEditingMatch(match);
              setIsCreateMatchOpen(true);
            }
          }}
          onOpenCreateMatch={() => {
            if (canCreate) {
              setEditingMatch(null);
              setIsCreateMatchOpen(true);
            }
          }}
        />
      ) : (
        <div className="space-y-6">
          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-500 uppercase">الرياضات المبرمجة</span>
                <Trophy className="h-4.5 w-4.5 text-amber-500" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-1">{programmedSportsCount}</p>
              <span className="text-[10px] text-slate-400 font-medium">رياضة مبرمجة حالياً</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-blue-700 uppercase">إجمالي المقابلات</span>
                <CalendarDays className="h-4.5 w-4.5 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-blue-700 mt-1">{filteredMatches.length}</p>
              <span className="text-[10px] text-blue-600/80 font-medium">
                {overallScheduledCount} مباراة مبرمجة
              </span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-red-600 uppercase">جارية الآن (مباشر)</span>
                <Clock className="h-4.5 w-4.5 text-red-600 animate-pulse" />
              </div>
              <p className="text-2xl font-black text-red-600 mt-1">{overallOngoingCount}</p>
              <span className="text-[10px] text-red-600/80 font-medium">مباراة تجرى حالياً</span>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-emerald-700 uppercase">النتائج المسجلة</span>
                <Award className="h-4.5 w-4.5 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-700 mt-1">{overallCompletedCount}</p>
              <span className="text-[10px] text-emerald-600/80 font-medium">مباراة منتهية بنتائج رسمية</span>
            </div>
          </div>

          {/* Level 1 Search & Filter Bar */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم الرياضة الإقليمية أو تفاصيلها..."
                className="w-full pr-9 pl-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto shrink-0">
              {/* Affiliation Selector */}
              <select
                value={affiliationFilter}
                onChange={(e) => setAffiliationFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="ALL">جميع أنواع البطولات</option>
                <option value="non_club">⚪ بطولات غير المنتمين</option>
                <option value="club_affiliated">🟡 بطولات المنتمين للأندية</option>
                <option value="open">🟢 البطولات المفتوحة</option>
              </select>

              {/* Sport Selector */}
              <select
                value={selectedSportFilter}
                onChange={(e) => setSelectedSportFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
              >
                <option value="ALL">🏆 جميع الرياضات الإقليمية</option>
                {sportsConfig.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.icon || '🏆'} {s.name}
                  </option>
                ))}
              </select>

              {/* Status Selector */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="OPEN">🟢 البطولات المفتوحة / المبرمجة</option>
                <option value="Ongoing">🔴 جارية الآن</option>
                <option value="Scheduled">📅 مبرمجة</option>
                <option value="Completed">🏆 مكتملة النتائج</option>
              </select>
            </div>
          </div>

          {/* LEVEL 1: SPORTS CARDS GRID (بطولات الرياضات الإقليمية) */}
          {loading ? (
            <div className="flex justify-center p-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            </div>
          ) : filteredSports.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
              <Trophy className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-base font-bold text-slate-700">لم يتم العثور على أي نتائج مطابقة</p>
              <p className="text-xs text-slate-500">جرب تغيير معايير البحث أو اختيار رياضة أخرى.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSports.map(item => {
                const {
                  sport,
                  totalMatches,
                  scheduledCount,
                  ongoingCount,
                  completedCount,
                  sportTournaments,
                  isProgrammed,
                  techHead,
                  categoriesList,
                  registeredCount,
                  hasBothClasses,
                  isClub
                } = item;
                const isManagerSpecialty = managerSportId === sport.id;

                // 1. Cross Country Championship Card (Identical dark gradient styling as in Tournaments.tsx)
                if (sport.id === 'cross_country' && isProgrammed) {
                  const ccResultsCount = Object.keys(crossCountryResults).length;

                  return (
                    <div
                      key={sport.id}
                      onClick={() => handleOpenSportResults(sport)}
                      className="flex flex-col rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 shadow-md overflow-hidden transition-all hover:shadow-xl hover:border-blue-500/50 cursor-pointer group"
                    >
                      <div className="p-5 flex-1 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs text-2xl flex items-center justify-center border border-white/20 shadow-xs group-hover:scale-105 transition-transform">
                              🏃‍♂️
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[11px] font-black text-emerald-400 uppercase tracking-wider">
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
                            <span className="inline-flex items-center rounded-md px-2.5 py-1 text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
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
                            تجمع كافة السباقات للفئات العمرية الـ8 الذكور والإناث، مع استعراض منصات التتويج والفرق الفائزة.
                          </p>
                        </div>

                        {/* 8 Categories Pills */}
                        <div className="bg-white/5 border border-white/10 p-3 rounded-2xl space-y-2">
                          <div className="text-[10px] font-bold text-slate-300 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Trophy className="w-3.5 h-3.5 text-amber-400" />
                              <span>الفئات الثمانية المعتمدة للنتائج:</span>
                            </span>
                            <span className="text-emerald-400 font-mono text-[10px]">
                              {ccResultsCount > 0 ? `${ccResultsCount} من 8 فئات متوجة` : `${registeredCount} عداء مسجل`}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 text-[10px]">
                            <span className="bg-blue-500/20 text-blue-200 px-2 py-0.5 rounded-lg border border-blue-500/30 font-bold">البراعم / البرعمات</span>
                            <span className="bg-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded-lg border border-emerald-500/30 font-bold">الصغار / الصغيرات</span>
                            <span className="bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-lg border border-amber-200/30 font-bold">الفتيان / الفتيات</span>
                            <span className="bg-purple-500/20 text-purple-200 px-2 py-0.5 rounded-lg border border-purple-200/30 font-bold">الشبان / الشابات</span>
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
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSportResults(sport);
                          }}
                          title="استعراض نتائج ومنصة تتويج العدو الريفي للفئات الثمانية"
                          className="flex-1 py-2.5 px-3 bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98"
                        >
                          <Trophy className="h-4 w-4 text-slate-950" />
                          <span>استعراض منصة التتويج والنتائج الرسمية</span>
                        </button>

                        {isCentralAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSportForSchedule(sport);
                              setIsScheduleModalOpen(true);
                            }}
                            className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0 border border-white/15 flex items-center justify-center"
                            title="تعديل تواريخ وإعدادات رياضة العدو الريفي"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // 2. UNPROGRAMMED SPORT CARD (Greyed Out Style matching Tournaments.tsx)
                if (!isProgrammed) {
                  return (
                    <div
                      key={sport.id}
                      onClick={() => handleOpenSportResults(sport)}
                      className="flex flex-col rounded-3xl bg-slate-100/90 border border-dashed border-slate-300 text-slate-500 overflow-hidden transition-all hover:border-slate-400 hover:bg-slate-100 shadow-3xs opacity-85 hover:opacity-100 cursor-pointer group"
                    >
                      <div className="p-5 flex-1 space-y-3">
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
                          في انتظار تفعيل وبرمجة مباريات هذه البطولة من طرف اللجنة الإقليمية المدرسية والمسؤولين التقنيين.
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
                        <button
                          type="button"
                          disabled
                          className="w-full py-2 px-3 bg-slate-300/80 text-slate-500 font-bold text-xs rounded-xl flex items-center justify-center gap-2 cursor-not-allowed"
                        >
                          <Lock className="h-3.5 w-3.5" />
                          <span>في طور الإعداد (غير مبرمجة)</span>
                        </button>

                        {isCentralAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSportForSchedule(sport);
                              setIsScheduleModalOpen(true);
                            }}
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                            title="تعديل تواريخ وإعدادات الرياضة"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                // 3. PROGRAMMED SPORT CARD (Active Color Card matching Tournaments.tsx)
                return (
                  <div
                    key={sport.id}
                    onClick={() => handleOpenSportResults(sport)}
                    className={`flex flex-col rounded-3xl border shadow-3xs overflow-hidden transition-all hover:shadow-md cursor-pointer group ${
                      isClub
                        ? 'bg-amber-50/90 border-amber-300 hover:border-amber-400'
                        : 'bg-white border-slate-200 hover:border-blue-300'
                    } ${
                      isManagerSpecialty
                        ? 'ring-2 ring-blue-500/20'
                        : ''
                    }`}
                  >
                    <div className="p-5 flex-1 space-y-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-11 h-11 rounded-2xl text-xl flex items-center justify-center border shadow-3xs group-hover:scale-105 transition-transform ${
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
                          {ongoingCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black bg-red-50 text-red-700 border border-red-200 px-2.5 py-0.5 rounded-full animate-pulse shadow-xs">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />
                              مباشر ({ongoingCount})
                            </span>
                          ) : completedCount > 0 && scheduledCount === 0 ? (
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                              🏆 منتهية ({completedCount})
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🟢 مفتوحة ({totalMatches} مباراة)
                            </span>
                          )}
                          <CountdownTimer deadline={sportTournaments.find(t => t.registrationDeadline)?.registrationDeadline} compact={true} />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                          البطولة الإقليمية المدرسية لـ {sport.name}
                        </h3>
                      </div>

                      {/* Configured Categories & Limit */}
                      <div className="text-[11px] text-slate-600 space-y-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-slate-500 mt-1 shrink-0">الفئات المدمجة:</span>
                          <div className="flex flex-col gap-1 items-end max-w-[75%]">
                            {categoriesList.slice(0, 3).map(c => {
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

                        {/* Branch summary */}
                        <div className="grid grid-cols-2 gap-1 text-[10px] font-bold pt-1 border-t border-slate-200/60">
                          <div className="bg-slate-100/70 text-slate-700 p-1 rounded-lg border border-slate-200 flex items-center justify-between px-1.5">
                            <span>⚪ غير المنتمين:</span>
                            <span className="font-black text-blue-700">{item.nonClubCount}</span>
                          </div>
                          <div className="bg-amber-100/70 text-amber-900 p-1 rounded-lg border border-amber-200 flex items-center justify-between px-1.5">
                            <span>🟡 المنتمين للأندية:</span>
                            <span className="font-black text-amber-950">{item.clubCount}</span>
                          </div>
                        </div>

                        {/* Matches mini breakdown */}
                        <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-bold pt-1">
                          <div className="bg-blue-50/60 text-blue-800 p-1 rounded-lg border border-blue-100/60">
                            <span>مبرمجة: </span>
                            <strong className="font-black text-[11px]">{scheduledCount}</strong>
                          </div>
                          <div className="bg-red-50/60 text-red-700 p-1 rounded-lg border border-red-100/60">
                            <span>جارية: </span>
                            <strong className="font-black text-[11px]">{ongoingCount}</strong>
                          </div>
                          <div className="bg-emerald-50/60 text-emerald-800 p-1 rounded-lg border border-emerald-100/60">
                            <span>منتهية: </span>
                            <strong className="font-black text-[11px]">{completedCount}</strong>
                          </div>
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
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSportResults(sport);
                        }}
                        className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-blue-700 text-white font-black text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-3xs cursor-pointer group-hover:bg-blue-600"
                      >
                        <Layers className="h-4 w-4" />
                        <span>دخول واستعراض نتائج ومباريات البطولة</span>
                      </button>

                      {isCentralAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSportForSchedule(sport);
                            setIsScheduleModalOpen(true);
                          }}
                          className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                          title="تعديل تواريخ وإعدادات الرياضة"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* LEVEL 2 & 3: SPORT RESULTS MODAL (WITH ⚪ NON-CLUB VS 🟡 CLUB BRANCHES) */}
      <SportResultsModal
        isOpen={isResultsModalOpen}
        onClose={() => setIsResultsModalOpen(false)}
        sport={selectedSportForResults}
        tournaments={tournaments}
        matches={matches}
        schools={schools}
        venues={venues}
        students={students}
        crossCountryResults={crossCountryResults}
        onUpdateCrossCountryResult={handleSaveCrossCountryResult}
        userProfile={userProfile}
        activeSeason={activeSeason}
        onEditScore={(match) => {
          setSelectedMatchForScore(match);
        }}
        onEditMatch={(match) => {
          setEditingMatch(match);
          setIsCreateMatchOpen(true);
        }}
        onDeleteMatch={(match) => {
          setMatchToDelete(match);
        }}
        onCreateMatch={(sportId, initialAffiliation) => {
          setCreateMatchInitialSportId(sportId);
          setCreateMatchInitialAffiliation(initialAffiliation);
          setEditingMatch(null);
          setIsCreateMatchOpen(true);
        }}
        onEditTournament={(tourn) => {
          setEditingTournament(tourn);
          setIsEditTournamentOpen(true);
        }}
        onDeleteTournament={(tourn) => {
          setTournamentToDelete(tourn);
        }}
      />

      {/* CREATE / EDIT MATCH MODAL */}
      <CreateMatchModal
        isOpen={isCreateMatchOpen}
        onClose={() => {
          setIsCreateMatchOpen(false);
          setEditingMatch(null);
        }}
        tournaments={tournaments}
        schools={schools}
        venues={venues}
        students={students}
        managerSportId={managerSportId}
        initialSportId={createMatchInitialSportId}
        initialAffiliation={createMatchInitialAffiliation}
        onSave={handleSaveMatch}
        editingMatch={editingMatch}
      />

      {/* SCORE MODAL */}
      <ScoreModal
        match={selectedMatchForScore}
        isOpen={!!selectedMatchForScore}
        onClose={() => setSelectedMatchForScore(null)}
        onSave={handleSaveScore}
        schools={schools}
        venues={venues}
      />

      {/* EDIT TOURNAMENT MODAL (CENTRAL ADMIN) */}
      <EditTournamentModal
        isOpen={isEditTournamentOpen}
        onClose={() => {
          setIsEditTournamentOpen(false);
          setEditingTournament(null);
        }}
        tournament={editingTournament}
        onUpdated={loadData}
      />

      {/* EDIT TOURNAMENT SCHEDULE MODAL */}
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

      {/* CONFIRM DELETE MATCH MODAL */}
      <ConfirmDeleteModal
        isOpen={!!matchToDelete}
        onClose={() => setMatchToDelete(null)}
        onConfirm={handleConfirmDeleteMatch}
        title="حذف المباراة والنتيجة"
        message="هل أنت متأكد من رغبتك في حذف هذه المباراة؟ سيتم إلغاء النتيجة والبرمجة نهائياً."
        confirmText="حذف نهائي"
        isDeleting={isDeleting}
      />

      {/* CONFIRM DELETE TOURNAMENT MODAL */}
      <ConfirmDeleteModal
        isOpen={!!tournamentToDelete}
        onClose={() => setTournamentToDelete(null)}
        onConfirm={handleConfirmDeleteTournament}
        title="حذف البطولة الإقليمية"
        message={`هل أنت متأكد من رغبتك في حذف بطولة "${tournamentToDelete?.name || ''}" نهائياً؟`}
        confirmText="تأكيد الحذف"
        isDeleting={isDeleting}
      />
    </div>
  );
};
