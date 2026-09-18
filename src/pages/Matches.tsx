import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP, deduplicateById, AGE_CATEGORIES, isClubTournament } from '../lib/dataService';
import { Match, School, Venue, Tournament, Sport, Student } from '../types';
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
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

export const Matches: React.FC = () => {
  const { userProfile } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
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
      const [m, s, v, t, curSeason, ccRes, stu, config] = await Promise.all([
        DataService.getMatches(),
        DataService.getSchools(),
        DataService.getVenues(),
        DataService.getTournaments(),
        DataService.getActiveSeason(),
        DataService.getCrossCountryResults(),
        DataService.getStudents(),
        DataService.getSportsConfig()
      ]);
      setMatches(m);
      setSchools(s);
      setVenues(v);
      setTournaments(deduplicateById(t));
      if (curSeason) setActiveSeason(curSeason);
      if (ccRes) setCrossCountryResults(ccRes);
      if (stu) setStudents(stu);
      if (config) setSportsConfig(config);
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
    window.addEventListener('directorateChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
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

  // Group sports with match metrics & tournaments
  const sportsData = useMemo(() => {
    const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';

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

      const scheduledCount = sportMatches.filter(m => m.status === 'Scheduled').length;
      const ongoingCount = sportMatches.filter(m => m.status === 'Ongoing').length;
      const completedCount = sportMatches.filter(m => m.status === 'Completed').length;
      const totalMatches = sportMatches.length;

      const nonClubCount = sportMatches.filter(m => {
        if (m.tournamentId) {
          const pt = tournaments.find(t => t.id === m.tournamentId);
          if (pt) return !isClubTournament(pt);
        }
        return true;
      }).length;

      const clubCount = totalMatches - nonClubCount;

      return {
        sport,
        sportTournaments,
        sportMatches,
        scheduledCount,
        ongoingCount,
        completedCount,
        totalMatches,
        nonClubCount,
        clubCount
      };
    });
  }, [sportsConfig, tournaments, matches, affiliationFilter]);

  // Filtered sports list for Level 1
  const filteredSports = useMemo(() => {
    return sportsData.filter(item => {
      const { sport, totalMatches, ongoingCount, completedCount, scheduledCount } = item;

      // Filter by Sport
      if (selectedSportFilter !== 'ALL' && sport.id !== selectedSportFilter) return false;

      // Filter by Status
      if (statusFilter === 'Ongoing' && ongoingCount === 0) return false;
      if (statusFilter === 'Scheduled' && scheduledCount === 0) return false;
      if (statusFilter === 'Completed' && completedCount === 0) return false;

      // Hide sports with no matches in this affiliation
      if (totalMatches === 0 && affiliationFilter !== 'ALL') return false;

      // Filter by Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = sport.name.toLowerCase().includes(q);
        const matchDesc = (sport.description || '').toLowerCase().includes(q);
        return matchName || matchDesc;
      }

      return true;
    });
  }, [sportsData, selectedSportFilter, statusFilter, searchQuery]);

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
                const { sport, totalMatches, scheduledCount, ongoingCount, completedCount, sportTournaments } = item;
                const isManagerSpecialty = managerSportId === sport.id;
                const isProgrammed = sport.isProgrammed !== false;

                if (!isProgrammed) {
                  return (
                    <div
                      key={sport.id}
                      onClick={() => handleOpenSportResults(sport)}
                      className="rounded-3xl border border-dashed border-slate-300 transition-all duration-300 flex flex-col justify-between overflow-hidden bg-slate-50/70 text-slate-500 hover:bg-slate-100 hover:border-slate-400 cursor-pointer shadow-3xs group"
                    >
                      <div className="p-5 space-y-4">
                        {/* Header: Sport Icon & Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-slate-200/80 text-xl flex items-center justify-center border border-slate-300/60 grayscale opacity-75">
                              {sport.icon || '🏆'}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                  {sport.name}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400 font-medium">الموسم {activeSeason}</span>
                            </div>
                          </div>

                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold bg-slate-200 text-slate-600 border border-slate-300">
                            <Lock className="h-3 w-3 text-slate-500" />
                            غير مبرمجة بعد
                          </span>
                        </div>

                        {/* Sport Description */}
                        <h3 className="text-sm font-bold text-slate-700 leading-snug">
                          البطولة الإقليمية المدرسية لـ {sport.name}
                        </h3>

                        <p className="text-xs text-slate-500 leading-relaxed bg-white/70 p-3 rounded-2xl border border-slate-200/60">
                          في انتظار تفعيل وبرمجة مباريات هذه البطولة من طرف اللجنة الإقليمية المدرسية والمسؤولين التقنيين.
                        </p>
                      </div>

                      {/* Card Footer Actions */}
                      <div className="p-3 bg-slate-100/70 border-t border-slate-200/60 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSportResults(sport);
                          }}
                          className="flex-1 py-2 px-3 bg-slate-300 text-slate-500 font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer"
                        >
                          <Lock className="h-4 w-4" />
                          <span>نتائج المقابلات غير متاحة (غير مبرمجة)</span>
                        </button>

                        {/* Central Admin Edit Schedule option even if unprogrammed */}
                        {isCentralAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedSportForSchedule(sport);
                              setIsScheduleModalOpen(true);
                            }}
                            className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            title="تعديل تواريخ وإعدادات الرياضة"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={sport.id}
                    onClick={() => handleOpenSportResults(sport)}
                    className={`rounded-3xl border transition-all duration-300 flex flex-col justify-between overflow-hidden bg-white shadow-2xs hover:shadow-lg cursor-pointer group ${
                      isManagerSpecialty
                        ? 'border-blue-400 ring-2 ring-blue-500/10'
                        : 'border-slate-200/80 hover:border-blue-400'
                    }`}
                  >
                    <div className="p-5 space-y-4">
                      {/* Header: Sport Icon & Status */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 flex items-center justify-center text-2xl shadow-3xs group-hover:scale-105 transition-transform">
                            {sport.icon || '🏆'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-black text-blue-700 uppercase tracking-wider">
                                {sport.name}
                              </span>
                              {isManagerSpecialty && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] bg-amber-50 text-amber-800 font-bold px-1.5 py-0.2 rounded border border-amber-200">
                                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                                  تخصصك
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">الموسم {activeSeason}</span>
                          </div>
                        </div>

                        {/* Ongoing status pulse or overall status */}
                        {ongoingCount > 0 ? (
                          <span className="flex items-center gap-1 text-[10px] font-black bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full animate-pulse shadow-xs">
                            <span className="w-2 h-2 rounded-full bg-red-600 animate-ping" />
                            مباشر ({ongoingCount})
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-800 border border-blue-100 px-2.5 py-1 rounded-full">
                            {totalMatches} مباراة
                          </span>
                        )}
                      </div>

                      {/* Sport Description */}
                      <h3 className="text-sm font-black text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                        البطولة الإقليمية المدرسية لـ {sport.name}
                      </h3>

                      {/* Branch indicator summary */}
                      <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5 text-xs font-bold text-slate-700">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[11px] text-slate-600">
                            <span>⚪ بطولة غير المنتمين للأندية:</span>
                          </span>
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 text-[10px] font-black">
                            {item.nonClubCount} مباراة
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-[11px] text-amber-900">
                            <span>🟡 بطولة المنتمين للأندية:</span>
                          </span>
                          <span className="text-amber-900 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-200 text-[10px] font-black">
                            {item.clubCount} مباراة
                          </span>
                        </div>
                      </div>

                      {/* Matches breakdown bar */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold pt-1">
                        <div className="bg-blue-50 text-blue-800 p-1.5 rounded-xl border border-blue-100">
                          <span>مبرمجة: </span>
                          <strong className="font-black text-xs">{scheduledCount}</strong>
                        </div>
                        <div className="bg-red-50 text-red-700 p-1.5 rounded-xl border border-red-100">
                          <span>جارية: </span>
                          <strong className="font-black text-xs">{ongoingCount}</strong>
                        </div>
                        <div className="bg-emerald-50 text-emerald-800 p-1.5 rounded-xl border border-emerald-100">
                          <span>منتهية: </span>
                          <strong className="font-black text-xs">{completedCount}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenSportResults(sport);
                        }}
                        className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer group-hover:bg-blue-600"
                      >
                        <Layers className="h-4 w-4" />
                        <span>دخول واستعراض نتائج الرياضة (المنتمين وغير المنتمين)</span>
                      </button>

                      {/* Central Admin Edit Schedule option */}
                      {isCentralAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSportForSchedule(sport);
                            setIsScheduleModalOpen(true);
                          }}
                          className="p-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
