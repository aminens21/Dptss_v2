import React, { useState, useMemo, useEffect } from 'react';
import { Tournament, Match, School, User, Venue, Referee, BlockedSchedulePeriod } from '../types';
import {
  DataService,
  SPORTS_MAP,
  findAllBlockedPeriodsForDate,
  isMatchProgramPendingApproval,
  findMatchingSchoolForTeacher,
  resolveEffectiveTeacherCadre,
  isTeacherLevelAllowedForTournament,
  isCrossCountryU15OpenToPrimary,
  isSchoolSectorAllowedForTournament,
  normalizeCategoryKey
} from '../lib/dataService';
import { SPORTS_CONFIG } from '../config/sportsConfig';
import { ProgramExportModal } from './ProgramExportModal';
import {
  buildAllCalendarEvents,
  downloadProgramAsPdf,
  downloadProgramAsWord,
  printProgram,
  ProgramAffiliationFilter,
  AFFILIATION_LABELS
} from '../lib/programExportService';
import {
  Calendar as CalendarIcon,
  Calendar,
  ChevronRight,
  ChevronLeft,
  Download,
  Printer,
  Filter,
  Trophy,
  MapPin,
  Clock,
  Users,
  Medal,
  CalendarDays,
  FileText,
  Sparkles,
  Search,
  CheckCircle2,
  ExternalLink,
  Plus,
  Layers,
  ShieldCheck,
  X,
  Undo2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatMatchDate } from '../lib/utils';
import { useAuth, isSuperAdminEmail } from '../contexts/AuthContext';

export interface CalendarEventItem {
  id: string;
  title: string;
  sportId: string;
  sportName: string;
  sportIcon: string;
  scope: 'provincial' | 'regional' | 'national';
  affiliationType?: 'non_club' | 'club_affiliated' | 'open';
  date: string; // YYYY-MM-DD
  time?: string;
  venue: string;
  category: string;
  gender: 'Male' | 'Female' | 'Mixed';
  organizer: string;
  coordinator?: string;
  referees?: string[];
  refereesText?: string;
  notes?: string;
  programApprovalStatus?: 'pending' | 'approved';
  isRealData?: boolean;
  rawTournament?: Tournament;
  rawMatch?: Match;
}

interface ChampionshipCalendarViewProps {
  tournaments: Tournament[];
  matches: Match[];
  schools: School[];
  venues?: Venue[];
  userProfile?: User | null;
  activeSeason: string;
  allowedSportIds?: string[] | null;
  isCentralAdmin?: boolean;
  onNavigateToTournament?: (tournamentId: string) => void;
  onOpenCreateMatch?: (initialDate?: string) => void;
  onOpenMatchDetail?: (match: Match) => void;
}

export const ChampionshipCalendarView: React.FC<ChampionshipCalendarViewProps> = ({
  tournaments,
  matches,
  schools,
  venues,
  userProfile,
  activeSeason,
  allowedSportIds: propAllowedSportIds,
  isCentralAdmin: propIsCentralAdmin,
  onNavigateToTournament,
  onOpenCreateMatch,
  onOpenMatchDetail
}) => {
  const { userProfile: authUser } = useAuth();
  const activeUser = userProfile || authUser;

  const effectiveIsCentralAdmin = useMemo(() => {
    if (propIsCentralAdmin !== undefined) return propIsCentralAdmin;
    return (
      activeUser?.role === 'CENTRAL_ADMIN' ||
      activeUser?.role === 'SUPER_ADMIN' ||
      activeUser?.isSuperAdmin === true ||
      isSuperAdminEmail(activeUser?.email)
    );
  }, [propIsCentralAdmin, activeUser]);

  const effectiveIsTechHeadOrManager = useMemo(() => {
    if (effectiveIsCentralAdmin) return false;
    return (
      activeUser?.isTechCommitteeHead === true ||
      activeUser?.role === 'TECH_HEAD' ||
      (activeUser?.role as string) === 'TECH_COMMITTEE_HEAD' ||
      activeUser?.role === 'SPORT_MANAGER'
    );
  }, [effectiveIsCentralAdmin, activeUser]);

  const effectiveAllowedSportIds = useMemo<string[] | null>(() => {
    if (effectiveIsCentralAdmin) return null;
    if (propAllowedSportIds !== undefined) return propAllowedSportIds;
    if (!effectiveIsTechHeadOrManager) return null;
    const set = new Set<string>();
    activeUser?.techCommitteeSports?.forEach(id => id && set.add(id));
    if (activeUser?.sportId) set.add(activeUser.sportId);
    return Array.from(set);
  }, [effectiveIsCentralAdmin, propAllowedSportIds, effectiveIsTechHeadOrManager, activeUser]);

  const isScopedToTechHead = !effectiveIsCentralAdmin && Array.isArray(effectiveAllowedSportIds);

  const isTeacher =
    activeUser?.role === 'TEACHER' &&
    !effectiveIsTechHeadOrManager &&
    !effectiveIsCentralAdmin;

  // Hover Popover & Quick Modal States
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [activeQuickModalDate, setActiveQuickModalDate] = useState<string | null>(null);

  // Calendar Navigation State
  // Default to November 2026 or current active date in Moroccan school calendar
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    // If today is within 2026/2027 school year, use today, otherwise default to November 2026
    const yr = today.getFullYear();
    if (yr === 2026 || yr === 2027) return today;
    return new Date(2026, 10, 12); // Nov 12, 2026
  });

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    // Default to '2026-11-12' (Cross Country date) or today
    const today = new Date();
    const yr = today.getFullYear();
    if (yr === 2026 || yr === 2027) {
      return today.toISOString().split('T')[0];
    }
    return '2026-11-12';
  });

  // Filter States
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'provincial' | 'regional' | 'national'>('ALL');
  const [sportFilter, setSportFilter] = useState<string>('ALL');
  const [affiliationFilter, setAffiliationFilter] = useState<ProgramAffiliationFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedReferees, setLoadedReferees] = useState<Referee[]>([]);
  const [loadedTeachers, setLoadedTeachers] = useState<User[]>([]);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedSchedulePeriod[]>([]);

  useEffect(() => {
    DataService.getReferees().then(setLoadedReferees).catch(() => {});
    DataService.getTeachers().then(setLoadedTeachers).catch(() => {});
    const unsubBlocked = DataService.subscribeToBlockedScheduleDates(setBlockedPeriods);
    return () => unsubBlocked();
  }, []);

  // Keep sportFilter locked/valid when scoped to Technical Committee Head
  React.useEffect(() => {
    if (isScopedToTechHead) {
      const allowed = effectiveAllowedSportIds || [];
      if (allowed.length === 1) {
        setSportFilter(allowed[0]);
      } else if (allowed.length > 1 && sportFilter !== 'ALL' && !allowed.includes(sportFilter)) {
        setSportFilter('ALL');
      }
    }
  }, [isScopedToTechHead, effectiveAllowedSportIds, sportFilter]);

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalInitialSports, setExportModalInitialSports] = useState<string[]>([]);

  const mergedTeacherProfile = useMemo(() => {
    if (!activeUser) return null;
    const dirMatch = loadedTeachers.find(t =>
      (t.id && t.id === activeUser.id) ||
      (t.email && activeUser.email && t.email.trim().toLowerCase() === activeUser.email.trim().toLowerCase()) ||
      (t.leaseNumber && activeUser.leaseNumber && t.leaseNumber.trim() === activeUser.leaseNumber.trim())
    );
    if (!dirMatch) return activeUser;
    return {
      ...dirMatch,
      ...activeUser,
      workLocation: activeUser.workLocation || dirMatch.workLocation,
      schoolId: activeUser.schoolId || dirMatch.schoolId,
      teachingCadre: activeUser.teachingCadre || dirMatch.teachingCadre
    };
  }, [activeUser, loadedTeachers]);

  const teacherSchoolObj = useMemo(() => {
    return findMatchingSchoolForTeacher(schools, mergedTeacherProfile);
  }, [schools, mergedTeacherProfile]);

  const effectiveTeacherCadre = useMemo(() => {
    return resolveEffectiveTeacherCadre(mergedTeacherProfile, teacherSchoolObj);
  }, [mergedTeacherProfile, teacherSchoolObj]);

  const isTournamentAllowedForTeacher = (t: Tournament, pool: Tournament[]): boolean => {
    if (t.status === 'Draft' || (t as any).isActive === false) return false;
    const levelOk =
      isTeacherLevelAllowedForTournament(effectiveTeacherCadre, t.level, t.ageCategory, t.sportId) ||
      (effectiveTeacherCadre === 'Primary' && isCrossCountryU15OpenToPrimary(t, pool));
    if (!levelOk) return false;
    if (teacherSchoolObj && !isSchoolSectorAllowedForTournament(teacherSchoolObj, t)) return false;
    return true;
  };

  const isCalendarEventAllowedForTeacher = (
    ev: { id: string; sportId: string; category?: string; gender?: string },
    matchObj?: Match
  ): boolean => {
    if (!isTeacher) return true;
    const activeTourns = tournaments.filter(t => t.status !== 'Draft' && (t as any).isActive !== false);
    const parentT =
      (matchObj?.tournamentId ? tournaments.find(t => t.id === matchObj.tournamentId) : undefined) ||
      activeTourns.find(
        t =>
          t.sportId === ev.sportId &&
          (!ev.category || normalizeCategoryKey(t.ageCategory) === normalizeCategoryKey(ev.category)) &&
          (!ev.gender || !t.gender || t.gender === ev.gender)
      );
    if (parentT) {
      return isTournamentAllowedForTeacher(parentT, activeTourns);
    }
    const sportActiveTourns = activeTourns.filter(t => t.sportId === ev.sportId);
    if (sportActiveTourns.length === 0) return false;
    return sportActiveTourns.some(t => isTournamentAllowedForTeacher(t, activeTourns));
  };

  // Build calendar events for monthly/screen views: hide Technical Committee Heads assigned as referees
  const allEvents = useMemo<CalendarEventItem[]>(() => {
    const allowedSet = isScopedToTechHead ? new Set(effectiveAllowedSportIds || []) : null;
    const matchById = new Map<string, Match>();
    matches.forEach(m => {
      if (m.id) matchById.set(`match-${m.id}`, m);
    });

    const built = buildAllCalendarEvents(
      tournaments,
      matches,
      schools,
      venues || [],
      loadedReferees,
      loadedTeachers
    );

    return built
      .filter(ev => {
        if (allowedSet && !allowedSet.has(ev.sportId)) return false;
        if (isTeacher && !isCalendarEventAllowedForTeacher(ev, matchById.get(ev.id))) return false;
        return true;
      })
      .map(ev => ({
        id: ev.id,
        title: ev.title,
        sportId: ev.sportId,
        sportName: ev.sportName,
        sportIcon: ev.sportIcon || '🏆',
        scope: ev.scope,
        affiliationType: ev.affiliationType || 'non_club',
        date: ev.date,
        time: ev.time,
        venue: ev.venue,
        category: ev.category || 'مباراة رسمية',
        gender: (ev.gender as 'Male' | 'Female' | 'Mixed') || 'Male',
        organizer: ev.organizer || 'لجنة التحكيم والبرمجة بالمديرية',
        coordinator: ev.coordinator,
        referees: ev.referees,
        refereesText: ev.refereesText,
        notes: (ev.notes || '').trim(),
        programApprovalStatus: ev.programApprovalStatus,
        isRealData: true,
        rawMatch: matchById.get(ev.id)
      }));
  }, [tournaments, matches, schools, venues, loadedReferees, loadedTeachers, isScopedToTechHead, effectiveAllowedSportIds, isTeacher, effectiveTeacherCadre, teacherSchoolObj]);

  // Build export events WITH Technical Committee Heads visible when assigned to a match (البرنامج المحمل)
  const allExportEvents = useMemo(() => {
    const allowedSet = isScopedToTechHead ? new Set(effectiveAllowedSportIds || []) : null;
    const matchById = new Map<string, Match>();
    matches.forEach(m => {
      if (m.id) matchById.set(`match-${m.id}`, m);
    });
    const built = buildAllCalendarEvents(
      tournaments,
      matches,
      schools,
      venues || [],
      loadedReferees,
      loadedTeachers
    );
    return built.filter(ev => {
      if (allowedSet && !allowedSet.has(ev.sportId)) return false;
      if (isTeacher && !isCalendarEventAllowedForTeacher(ev, matchById.get(ev.id))) return false;
      return true;
    });
  }, [tournaments, matches, schools, venues, loadedReferees, loadedTeachers, isScopedToTechHead, effectiveAllowedSportIds, isTeacher, effectiveTeacherCadre, teacherSchoolObj]);

  // Available sports for dropdown (strictly Tech Head's assigned sports, or sports that have matches for Admin)
  const availableFilterSports = useMemo(() => {
    const base = SPORTS_CONFIG.map(s => ({ id: s.id, name: s.name }));
    if (isScopedToTechHead) {
      const allowedSet = new Set(effectiveAllowedSportIds || []);
      const filtered = base.filter(s => allowedSet.has(s.id));
      (effectiveAllowedSportIds || []).forEach(id => {
        if (!filtered.some(s => s.id === id)) {
          filtered.push({ id, name: SPORTS_MAP[id]?.name || id });
        }
      });
      return filtered;
    }
    const sportsWithMatches = new Set(allEvents.map(ev => ev.sportId));
    const filtered = base.filter(s => sportsWithMatches.has(s.id));
    allEvents.forEach(ev => {
      if (!filtered.some(s => s.id === ev.sportId)) {
        filtered.push({ id: ev.sportId, name: ev.sportName || SPORTS_MAP[ev.sportId]?.name || ev.sportId });
      }
    });
    return filtered;
  }, [isScopedToTechHead, effectiveAllowedSportIds, allEvents]);

  // Keep sportFilter valid if matches of previously selected sport were cleared
  useEffect(() => {
    if (!isScopedToTechHead && sportFilter !== 'ALL' && !availableFilterSports.some(s => s.id === sportFilter)) {
      setSportFilter('ALL');
    }
  }, [isScopedToTechHead, sportFilter, availableFilterSports]);

  // Tournament types/affiliations that actually have matches in the selected sport + scope
  const availableAffiliations = useMemo(() => {
    const counts: Record<'non_club' | 'club_affiliated' | 'open', number> = {
      non_club: 0,
      club_affiliated: 0,
      open: 0
    };
    allEvents.forEach(ev => {
      if (scopeFilter !== 'ALL' && ev.scope !== scopeFilter) return;
      if (sportFilter !== 'ALL' && ev.sportId !== sportFilter) return;
      const aff = ev.affiliationType || 'non_club';
      counts[aff] += 1;
    });
    const list: { id: 'non_club' | 'club_affiliated' | 'open'; label: string; count: number; icon: string }[] = [];
    if (counts.non_club > 0) list.push({ id: 'non_club', label: AFFILIATION_LABELS.non_club, count: counts.non_club, icon: '🏫' });
    if (counts.club_affiliated > 0) list.push({ id: 'club_affiliated', label: AFFILIATION_LABELS.club_affiliated, count: counts.club_affiliated, icon: '🏅' });
    if (counts.open > 0) list.push({ id: 'open', label: AFFILIATION_LABELS.open, count: counts.open, icon: '🌍' });
    return list;
  }, [allEvents, scopeFilter, sportFilter]);

  useEffect(() => {
    if (affiliationFilter !== 'ALL' && !availableAffiliations.some(a => a.id === affiliationFilter)) {
      setAffiliationFilter('ALL');
    }
  }, [affiliationFilter, availableAffiliations]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const matchesScope = scopeFilter === 'ALL' || ev.scope === scopeFilter;
      const matchesSport = sportFilter === 'ALL' || ev.sportId === sportFilter;
      const matchesAffiliation = affiliationFilter === 'ALL' || (ev.affiliationType || 'non_club') === affiliationFilter;
      const matchesSearch = !searchQuery ||
        ev.title.includes(searchQuery) ||
        ev.sportName.includes(searchQuery) ||
        ev.venue.includes(searchQuery) ||
        (ev.coordinator && ev.coordinator.includes(searchQuery)) ||
        (ev.category && ev.category.includes(searchQuery)) ||
        (ev.notes && ev.notes.includes(searchQuery));
      return matchesScope && matchesSport && matchesAffiliation && matchesSearch;
    });
  }, [allEvents, scopeFilter, sportFilter, affiliationFilter, searchQuery]);

  // Map of date string -> events list for fast lookup in calendar days
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    filteredEvents.forEach(ev => {
      if (!map[ev.date]) {
        map[ev.date] = [];
      }
      map[ev.date].push(ev);
    });
    return map;
  }, [filteredEvents]);

  // Events on the currently selected date
  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDateStr] || [];
  }, [eventsByDate, selectedDateStr]);

  const selectedDateBlocked = useMemo(() => {
    return findAllBlockedPeriodsForDate(selectedDateStr, ['ALL'], blockedPeriods);
  }, [selectedDateStr, blockedPeriods]);

  const selectedDateHolidays = useMemo(() => {
    return selectedDateBlocked.filter(p => p.type === 'holiday');
  }, [selectedDateBlocked]);

  const selectedDateExams = useMemo(() => {
    return selectedDateBlocked.filter(p => p.type === 'exams');
  }, [selectedDateBlocked]);

  const quickModalDateBlocked = useMemo(() => {
    if (!activeQuickModalDate) return [];
    return findAllBlockedPeriodsForDate(activeQuickModalDate, ['ALL'], blockedPeriods);
  }, [activeQuickModalDate, blockedPeriods]);

  const quickModalDateHolidays = useMemo(() => {
    return quickModalDateBlocked.filter(p => p.type === 'holiday');
  }, [quickModalDateBlocked]);

  const quickModalDateExams = useMemo(() => {
    return quickModalDateBlocked.filter(p => p.type === 'exams');
  }, [quickModalDateBlocked]);

  // Days in month logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
    'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'
  ];

  const weekdaysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  const formatFullArabicDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = weekdaysArabic[dateObj.getDay()];
      const monthName = monthNamesArabic[m - 1];
      return `${dayName} ${d} ${monthName} ${y}`;
    } catch {
      return dateStr;
    }
  };

  const getScopeBadge = (scope: 'provincial' | 'regional' | 'national') => {
    switch (scope) {
      case 'provincial':
        return (
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
            🏆 بطولة إقليمية (تاوريرت)
          </span>
        );
      case 'regional':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            🏅 بطولة جهوية (جهة الشرق)
          </span>
        );
      case 'national':
        return (
          <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
            🥇 بطولة وطنية (المملكة المغربية)
          </span>
        );
    }
  };

  const [approvingSportId, setApprovingSportId] = useState<string | null>(null);
  const [revertingSportId, setRevertingSportId] = useState<string | null>(null);

  const handleApproveMatchProgram = async (matchId: string) => {
    if (!effectiveIsCentralAdmin) return;
    await DataService.approveMatchProgram(matchId, activeUser?.fullName || 'المسير المركزي');
    toast.success('تمت المصادقة على برمجة المباراة وإظهارها بلونها الطبيعي');
  };

  const handleRevertMatchProgram = async (matchId: string) => {
    if (!effectiveIsCentralAdmin) return;
    await DataService.revertMatchProgram(matchId);
    toast.success('تم التراجع عن مصادقة المباراة وإعادتها إلى حالة انتظار المصادقة 🔄');
  };

  const pendingCalendarBySport = useMemo(() => {
    const map = new Map<string, { sportId: string; sportName: string; sportIcon: string; ids: Set<string> }>();
    allEvents.forEach(ev => {
      if (ev.rawMatch?.id && isMatchProgramPendingApproval(ev.rawMatch)) {
        const sid = ev.sportId || ev.rawMatch.sportId || 'other';
        const sp = SPORTS_MAP[sid];
        const existing = map.get(sid) || {
          sportId: sid,
          sportName: ev.sportName || sp?.name || sid,
          sportIcon: ev.sportIcon || sp?.icon || '🏆',
          ids: new Set<string>()
        };
        existing.ids.add(ev.rawMatch.id);
        map.set(sid, existing);
      }
    });
    return Array.from(map.values()).map(item => ({
      ...item,
      matchIds: Array.from(item.ids)
    }));
  }, [allEvents]);

  const approvedCalendarBySport = useMemo(() => {
    const map = new Map<string, { sportId: string; sportName: string; sportIcon: string; ids: Set<string> }>();
    allEvents.forEach(ev => {
      if (ev.rawMatch?.id && !isMatchProgramPendingApproval(ev.rawMatch)) {
        const sid = ev.sportId || ev.rawMatch.sportId || 'other';
        const sp = SPORTS_MAP[sid];
        const existing = map.get(sid) || {
          sportId: sid,
          sportName: ev.sportName || sp?.name || sid,
          sportIcon: ev.sportIcon || sp?.icon || '🏆',
          ids: new Set<string>()
        };
        existing.ids.add(ev.rawMatch.id);
        map.set(sid, existing);
      }
    });
    return Array.from(map.values()).map(item => ({
      ...item,
      matchIds: Array.from(item.ids)
    }));
  }, [allEvents]);

  const totalPendingCalendarCount = useMemo(
    () => pendingCalendarBySport.reduce((sum, s) => sum + s.matchIds.length, 0),
    [pendingCalendarBySport]
  );

  const totalApprovedCalendarCount = useMemo(
    () => approvedCalendarBySport.reduce((sum, s) => sum + s.matchIds.length, 0),
    [approvedCalendarBySport]
  );

  const handleBatchApproveSportCalendarProgram = async (sportId: string, sportName: string, matchIds: string[]) => {
    if (!effectiveIsCentralAdmin || matchIds.length === 0) return;
    setApprovingSportId(sportId);
    try {
      const count = await DataService.approveMatchesProgramBatch(
        matchIds,
        activeUser?.fullName || 'المسير المركزي'
      );
      toast.success(`تمت المصادقة على برنامج ${sportName} (${count} مباراة) وإظهارها بلونها الطبيعي ✅`);
    } finally {
      setApprovingSportId(null);
    }
  };

  const handleBatchRevertSportCalendarProgram = async (sportId: string, sportName: string, matchIds: string[]) => {
    if (!effectiveIsCentralAdmin || matchIds.length === 0) return;
    setRevertingSportId(sportId);
    try {
      const count = await DataService.revertMatchesProgramBatch(matchIds);
      toast.success(`تم التراجع عن مصادقة برنامج ${sportName} (${count} مباراة) وإعادته إلى انتظار المصادقة 🔄`);
    } finally {
      setRevertingSportId(null);
    }
  };

  // ==========================================
  // EXPORT HANDLERS (PDF / WORD / PRINT)
  // ==========================================
  const getCalendarExportOptions = () => ({
    events: allExportEvents.map(e => ({
      ...e,
      sportName: e.sportName || SPORTS_MAP[e.sportId]?.name || e.sportId,
      sportIcon: e.sportIcon || SPORTS_MAP[e.sportId]?.icon || '🏆'
    })),
    selectedSportIds:
      sportFilter !== 'ALL'
        ? [sportFilter]
        : isScopedToTechHead
        ? (effectiveAllowedSportIds && effectiveAllowedSportIds.length > 0 ? effectiveAllowedSportIds : ['__none__'])
        : [],
    scopeFilter,
    affiliationFilter,
    activeSeason
  });

  // 1. Direct PDF Download (SEPARATE from window.print!)
  const handleDirectPdfDownload = async () => {
    await downloadProgramAsPdf(getCalendarExportOptions());
  };

  // 2. Direct Word Download (.doc)
  const handleExportWord = () => {
    downloadProgramAsWord(getCalendarExportOptions());
  };

  // 3. Print Program (Dedicated printer screen)
  const handlePrintPdf = () => {
    printProgram(getCalendarExportOptions());
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-4 sm:p-6 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
                <span>رزنامة البرنامج الرياضي المدرسي (Calendrier)</span>
              </span>
              <span className="bg-white/10 text-slate-200 text-xs font-bold px-2.5 py-1 rounded border border-white/10">
                الموسم {activeSeason}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-1 rounded-full">
                إقليمي • جهوي • وطني
              </span>
              {isScopedToTechHead && availableFilterSports.length > 0 && (
                <span className="bg-amber-500/20 text-amber-200 border border-amber-400/40 text-[11px] font-black px-2.5 py-1 rounded-full">
                  🛡️ برنامج رياضتك فقط: {availableFilterSports.map(s => s.name).join('، ')}
                </span>
              )}
              {effectiveIsCentralAdmin && (
                <span className="bg-indigo-500/25 text-indigo-200 border border-indigo-400/40 text-[11px] font-black px-2.5 py-1 rounded-full">
                  🌐 جميع الرزنامات والبرامج (المسير المركزي)
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white mt-2 flex items-center gap-2.5">
              <span>البرنامج والمواعيد الرسمية للمنافسات والبطولات</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl font-medium leading-relaxed">
              جدول زمني تفاعلي (Calendrier) لكافة البطولات والمباريات المدرسية. اضغط على أي يوم في الرزنامة لاكتشاف المنافسات المبرمجة فيه، مع إمكانية تحميل البرنامج بصيغة PDF أو Word أو طباعته، وتخصيص تحميل بطولة معينة.
            </p>
          </div>

          {/* Download & Print Actions - Clean 2x2 Grid on mobile, inline flex on tablet/desktop */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
            {/* 1. SEPARATE PDF DOWNLOAD */}
            <button
              onClick={handleDirectPdfDownload}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer hover:scale-102 active:scale-98 text-center"
              title="تحميل البرنامج بصيغة PDF مباشرة إلى جهازك"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>تحميل (PDF)</span>
            </button>

            {/* 2. WORD DOWNLOAD */}
            <button
              onClick={handleExportWord}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer hover:scale-102 active:scale-98 text-center"
              title="تحميل البرنامج بصيغة Microsoft Word قابلة للتعديل"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>تحميل (Word)</span>
            </button>

            {/* 3. PRINT BUTTON (SEPARATE) */}
            <button
              onClick={handlePrintPdf}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold shadow-xs transition-all cursor-pointer text-center"
              title="طباعة البرنامج ورقية فورية"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span>طباعة البرنامج</span>
            </button>

            {/* 4. GRANULAR SELECTION MODAL BUTTON (Hidden for teachers) */}
            {!isTeacher && (
              <button
                onClick={() => {
                  setExportModalInitialSports(
                    sportFilter !== 'ALL'
                      ? [sportFilter]
                      : isScopedToTechHead
                      ? (effectiveAllowedSportIds || [])
                      : []
                  );
                  setIsExportModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer hover:scale-102 text-center"
                title="تخصيص استخراج وتنزيل برنامج بطولة واحدة معينة أو بطولتين أو أكثر"
              >
                <Layers className="h-4 w-4 shrink-0" />
                <span>{isScopedToTechHead ? 'تخصيص وتصدير البرنامج...' : 'تخصيص بطولة معينة...'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills Ribbon */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          {/* Level Filter Tabs */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 bg-white/5 p-1.5 rounded-xl border border-white/10 w-full lg:w-auto">
            {[
              { id: 'ALL', label: 'جميع المستويات (الشامل)', icon: '🌐' },
              { id: 'provincial', label: 'بطولة إقليمية (تاوريرت)', icon: '🏆' },
              { id: 'regional', label: 'بطولة جهوية (الجهة الشرقية)', icon: '🏅' },
              { id: 'national', label: 'بطولة وطنية (المملكة)', icon: '🥇' },
            ].map(tab => {
              const isActive = scopeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setScopeFilter(tab.id as any)}
                  className={`flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer text-center ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="shrink-0">{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Sport Filter Dropdown */}
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15 w-full sm:w-auto min-w-0">
              <span className="text-slate-300 font-bold text-xs shrink-0">نوع الرياضة:</span>
              <select
                value={sportFilter}
                onChange={e => setSportFilter(e.target.value)}
                disabled={isScopedToTechHead && availableFilterSports.length <= 1}
                className="flex-1 sm:flex-initial min-w-0 bg-slate-900/90 text-white font-bold text-xs rounded-lg px-2.5 py-1 border border-white/20 focus:outline-hidden cursor-pointer disabled:opacity-80 disabled:cursor-default"
              >
                {(!isScopedToTechHead || availableFilterSports.length > 1) && (
                  <option value="ALL">
                    {isScopedToTechHead ? 'جميع رياضاتي المسندة' : 'كافة الرياضات (الشامل)'}
                  </option>
                )}
                {availableFilterSports.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            {/* Quick Search Field */}
            <div className="relative w-full sm:w-auto sm:min-w-[200px] flex-1">
              <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث عن بطولة، رياضة، مكان أو مؤطر..."
                className="w-full bg-white/10 border border-white/15 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-400"
              />
            </div>
          </div>
        </div>

        {/* Affiliation / Tournament Class Pills (Shown only when matches exist in classes) */}
        {availableAffiliations.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[11px] text-slate-300 font-bold ml-1">صنف البطولة:</span>
            <button
              type="button"
              onClick={() => setAffiliationFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                affiliationFilter === 'ALL'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/15'
              }`}
            >
              🌐 الكل ({allEvents.filter(ev => (scopeFilter === 'ALL' || ev.scope === scopeFilter) && (sportFilter === 'ALL' || ev.sportId === sportFilter)).length})
            </button>
            {availableAffiliations.map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setAffiliationFilter(opt.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  affiliationFilter === opt.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white/10 text-slate-300 hover:text-white hover:bg-white/15'
                }`}
              >
                {opt.icon} {opt.label} ({opt.count})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Central Admin Per-Sport Program Approval & Revert Banner in Calendar */}
      {effectiveIsCentralAdmin && (pendingCalendarBySport.length > 0 || approvedCalendarBySport.length > 0) && (
        <div className="bg-slate-100 border border-slate-300 rounded-2xl px-4 py-3 space-y-3 shadow-xs">
          {pendingCalendarBySport.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-red-100 text-red-700 border border-red-200 flex items-center justify-center text-sm font-black shrink-0">
                  ⏳
                </span>
                <div>
                  <p className="text-xs font-black text-red-700">
                    برامج في انتظار المصادقة ({totalPendingCalendarCount} مباراة) — مصادقة مستقلة لكل بطولة
                  </p>
                  <p className="text-[11px] font-medium text-slate-600">
                    يمكنك المصادقة على برنامج كل رياضة على حدة مع إبقاء باقي الرياضات في انتظار المصادقة.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {pendingCalendarBySport.map(item => (
                  <button
                    key={`cal-approve-${item.sportId}`}
                    type="button"
                    disabled={approvingSportId === item.sportId}
                    onClick={() => handleBatchApproveSportCalendarProgram(item.sportId, item.sportName, item.matchIds)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {approvingSportId === item.sportId
                        ? 'جاري المصادقة...'
                        : `${item.sportIcon} المصادقة على برنامج ${item.sportName} (${item.matchIds.length})`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {approvedCalendarBySport.length > 0 && (
            <div className={`space-y-2 ${pendingCalendarBySport.length > 0 ? 'pt-3 border-t border-slate-300/80' : ''}`}>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center text-sm font-black shrink-0">
                  ✅
                </span>
                <div>
                  <p className="text-xs font-black text-emerald-800">
                    برامج مصادق عليها ({totalApprovedCalendarCount} مباراة) — إمكانية التراجع عن المصادقة
                  </p>
                  <p className="text-[11px] font-medium text-slate-600">
                    يمكنك التراجع عن مصادقة برنامج أي بطولة رياضية لإعادته إلى حالة انتظار المصادقة (باللون الرمادي).
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {approvedCalendarBySport.map(item => (
                  <button
                    key={`cal-revert-${item.sportId}`}
                    type="button"
                    disabled={revertingSportId === item.sportId}
                    onClick={() => handleBatchRevertSportCalendarProgram(item.sportId, item.sportName, item.matchIds)}
                    className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>
                      {revertingSportId === item.sportId
                        ? 'جاري التراجع...'
                        : `${item.sportIcon} التراجع عن مصادقة برنامج ${item.sportName} (${item.matchIds.length})`}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Grid: Interactive Calendar on Right (8 cols) + Selected Day Events on Left (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ======================================================== */}
        {/* Interactive Calendar Grid (8 cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-3xs p-4 sm:p-5 flex flex-col">
          {/* Calendar Header: Month Navigator & Quick Jump */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <CalendarIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  {monthNamesArabic[month]} {year}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  الموسم الرياضي المدرسي {activeSeason}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={goToToday}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                اليوم
              </button>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
                  title="الشهر القادم"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
                  title="الشهر السابق"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 my-2.5 text-center">
            {weekdaysArabic.map((dayName, idx) => (
              <div
                key={dayName}
                className={`py-1.5 sm:py-2 px-0.5 text-[10px] sm:text-xs font-black rounded-lg truncate ${
                  idx === 5 || idx === 6 ? 'text-amber-700 bg-amber-50/60' : 'text-slate-600 bg-slate-50'
                }`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Days Matrix */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1 auto-rows-fr">
            {/* Blank leading days from previous month */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[75px] sm:min-h-[90px] p-1 bg-slate-50/30 rounded-xl border border-dashed border-slate-100 opacity-40"
              />
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNumber = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
              const dayEvents = eventsByDate[dateKey] || [];
              const dayBlocked = findAllBlockedPeriodsForDate(dateKey, ['ALL'], blockedPeriods);
              const dayHolidays = dayBlocked.filter(p => p.type === 'holiday');
              const dayExams = dayBlocked.filter(p => p.type === 'exams');
              const isSelected = selectedDateStr === dateKey;
              const hasEvents = dayEvents.length > 0;
              const hasHolidays = dayHolidays.length > 0;
              const hasExams = dayExams.length > 0;
              const holidayTitles = dayHolidays.map(h => h.title).join(' • ');
              const examTitles = dayExams.map(e => e.title).join(' • ');
              const titleParts: string[] = [];
              if (hasHolidays) titleParts.push(`🏖️ عطلة مدرسية: ${holidayTitles}`);
              if (hasExams) titleParts.push(`📝 أيام الامتحانات: ${examTitles}`);

              return (
                <div
                  key={dateKey}
                  title={titleParts.length > 0 ? titleParts.join('\n') : undefined}
                  onMouseEnter={() => setHoveredDateKey(dateKey)}
                  onMouseLeave={() => setHoveredDateKey(null)}
                  onClick={() => {
                    setSelectedDateStr(dateKey);
                    if (hasEvents || hasHolidays || hasExams) {
                      setActiveQuickModalDate(dateKey);
                    }
                  }}
                  className={`min-h-[75px] sm:min-h-[95px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                    isSelected && hasHolidays
                      ? 'border-red-600 bg-red-100 ring-2 ring-red-500/30 shadow-xs'
                      : isSelected && hasExams
                      ? 'border-blue-600 bg-blue-100 ring-2 ring-blue-500/30 shadow-xs'
                      : isSelected
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/30 shadow-xs'
                      : hasHolidays
                      ? 'border-red-200 bg-red-50 hover:bg-red-100/80 hover:border-red-300 shadow-3xs'
                      : hasExams
                      ? 'border-blue-300 bg-blue-50/95 hover:bg-blue-100/80 hover:border-blue-400 shadow-3xs'
                      : hasEvents
                      ? 'border-blue-200 bg-white hover:bg-blue-50/30 hover:border-blue-300 shadow-3xs'
                      : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  {/* Hover Popover preview tooltip on hover */}
                  {hoveredDateKey === dateKey && (hasEvents || hasHolidays || hasExams) && (
                    <div className="absolute z-40 bottom-full mb-2 right-0 w-72 bg-slate-900 text-white rounded-xl p-3 shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-100 pointer-events-none" dir="rtl">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-700 text-[10px] text-blue-300 font-bold">
                        <span className="flex items-center gap-1">
                          <CalendarDays className={`w-3 h-3 ${hasHolidays ? 'text-red-400' : 'text-blue-400'}`} />
                          <span>{dateKey}</span>
                        </span>
                        {hasHolidays ? (
                          <span className="bg-red-500/90 text-white px-1.5 py-0.5 rounded-full text-[9px] font-black">
                            عطلة مدرسية
                          </span>
                        ) : hasExams ? (
                          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[9px] font-black">
                            أيام الامتحانات
                          </span>
                        ) : (
                          <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                            {dayEvents.length} {dayEvents.length === 1 ? 'مباراة' : 'مباريات'}
                          </span>
                        )}
                      </div>
                      {hasHolidays && (
                        <div className="mt-2 space-y-1">
                          {dayHolidays.map(h => (
                            <div key={`hov-hol-${h.id}`} className="p-1.5 rounded-lg bg-red-950/90 border border-red-700/80 text-[10px] text-red-100 font-black">
                              🏖️ {h.title}
                              <div className="text-[9px] font-bold text-red-300 mt-0.5">
                                ممنوع برمجة المباريات في هذا التاريخ
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasExams && (
                        <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                          {dayExams.map(ex => (
                            <div key={`hov-ex-${ex.id}`} className="p-1.5 rounded-lg bg-blue-950/90 border border-blue-700/80 text-[10px] text-blue-100 font-black">
                              📝 {ex.title}
                              <div className="text-[9px] font-bold text-blue-300 mt-0.5">
                                يُمنع برمجة بطولات هذا السلك في هذا التاريخ
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {hasEvents && (
                        <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                          {dayEvents.slice(0, 3).map(ev => (
                            <div key={`hov-${ev.id}`} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px]">
                              <div className="flex items-center gap-1 font-bold text-blue-200 truncate">
                                <span>{ev.sportIcon}</span>
                                <span className="truncate">{ev.title}</span>
                              </div>
                              <div className="text-[9px] text-slate-300 mt-1 flex items-center justify-between font-medium">
                                <span className="truncate max-w-[120px]">📍 {ev.venue}</span>
                                <span>⏰ {ev.time}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 text-[9px] text-blue-400 font-extrabold text-center border-t border-slate-800 pt-1">
                        ✨ انقر لعرض التفاصيل الكاملة
                      </div>
                    </div>
                  )}

                  {/* Day number & indicators */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-black w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isSelected && hasHolidays
                          ? 'bg-red-600 text-white shadow-xs'
                          : isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : hasHolidays
                          ? 'text-red-700 font-black'
                          : hasExams
                          ? 'text-blue-700 font-black'
                          : hasEvents
                          ? 'text-blue-700 font-black'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNumber}
                    </span>

                    <div className="flex items-center gap-1">
                      {hasHolidays && (
                        <span className="text-[9px] bg-red-100 text-red-800 border border-red-200 font-black px-1.5 py-0.2 rounded-full">
                          عطلة
                        </span>
                      )}
                      {hasExams && (
                        <span className="text-[9px] bg-blue-600 text-white border border-blue-700 font-black px-1.5 py-0.2 rounded-full">
                          امتحانات
                        </span>
                      )}
                      {hasEvents && (
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">
                          {dayEvents.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Holiday, Exam & Event Badges inside calendar cell */}
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {dayHolidays.slice(0, 1).map(h => (
                      <div
                        key={`cell-hol-${h.id}`}
                        className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded truncate border bg-red-100/90 text-red-800 border-red-300"
                        title={`عطلة مدرسية: ${holidayTitles}`}
                      >
                        <span>🏖️ {h.title}{dayHolidays.length > 1 ? ` (+${dayHolidays.length - 1})` : ''}</span>
                      </div>
                    ))}

                    {!hasHolidays && dayExams.slice(0, 1).map(ex => (
                      <div
                        key={`cell-ex-${ex.id}`}
                        className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded truncate border bg-blue-600/10 text-blue-900 border-blue-300"
                        title={`أيام الامتحانات: ${examTitles}`}
                      >
                        <span>📝 {ex.title}{dayExams.length > 1 ? ` (+${dayExams.length - 1})` : ''}</span>
                      </div>
                    ))}

                    {dayEvents.slice(0, hasHolidays || hasExams ? 1 : 2).map(ev => {
                      const isPendingApproval = ev.rawMatch ? isMatchProgramPendingApproval(ev.rawMatch) : ev.programApprovalStatus === 'pending';
                      const scopeColor = isPendingApproval
                        ? 'bg-slate-200 text-slate-600 border-slate-300'
                        : ev.scope === 'national'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : ev.scope === 'regional'
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : 'bg-blue-100 text-blue-800 border-blue-300';

                      return (
                        <div
                          key={ev.id}
                          className={`text-[9px] sm:text-[10px] font-bold px-1 py-0.5 rounded truncate border ${scopeColor}`}
                          title={`${ev.sportName}: ${ev.title}${isPendingApproval ? ' (في انتظار المصادقة على البرنامج)' : ''}`}
                        >
                          <span className="ml-1">{ev.sportIcon}</span>
                          <span>{ev.title}</span>
                        </div>
                      );
                    })}

                    {dayEvents.length > (hasHolidays || hasExams ? 1 : 2) && (
                      <div className="text-[9px] font-bold text-slate-400 text-center">
                        +{dayEvents.length - (hasHolidays || hasExams ? 1 : 2)} المزيد...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Legend */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 font-medium">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>بطولة إقليمية</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>بطولة جهوية</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <span>بطولة وطنية</span>
              </span>
              <span className="flex items-center gap-1.5 text-red-700 font-bold">
                <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
                <span>عطلة مدرسية (يُمنع فيها البرمجة)</span>
              </span>
              <span className="flex items-center gap-1.5 text-blue-700 font-bold">
                <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" />
                <span>أيام الامتحانات (يُمنع برمجة السلك المعني)</span>
              </span>
            </div>

            <span>إجمالي المواعيد والأنشطة المسجلة: <strong>{filteredEvents.length} تظاهرة</strong></span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Selected Date Event Details Panel (4 cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">
                  البرنامج المبرمج في هذا التاريخ:
                </span>
                <h4 className="text-sm sm:text-base font-black text-slate-800 mt-0.5">
                  {formatFullArabicDate(selectedDateStr)}
                </h4>
              </div>

              {selectedDateEvents.length > 0 && (
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
                  {selectedDateEvents.length} أنشطة
                </span>
              )}
            </div>

            {/* Holiday Notice for Selected Date */}
            {selectedDateHolidays.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-red-50 border border-red-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-red-800 flex items-center gap-1.5">
                    <span>🏖️ عطلة مدرسية رسمية</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                    البرمجة ممنوعة
                  </span>
                </div>
                {selectedDateHolidays.map(h => (
                  <div key={`side-hol-${h.id}`} className="text-xs font-black text-red-900">
                    • {h.title}{' '}
                    <span className="text-[10px] font-bold text-red-700 font-mono" dir="ltr">
                      ({h.startDate === h.endDate ? h.startDate : `${h.startDate} → ${h.endDate}`})
                    </span>
                  </div>
                ))}
                <p className="text-[10.5px] font-bold text-red-700 leading-relaxed">
                  لا يُسمح ببرمجة أي مباراة رياضية خلال العطل المدرسية المعتمدة.
                </p>
              </div>
            )}

            {/* Exam Notice for Selected Date */}
            {selectedDateExams.length > 0 && (
              <div className="mt-3 p-3 rounded-2xl bg-blue-50 border border-blue-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black text-blue-900 flex items-center gap-1.5">
                    <span>📝 فترة الامتحانات</span>
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                    ممنوع للسلك المعني
                  </span>
                </div>
                {selectedDateExams.map(ex => (
                  <div key={`side-ex-${ex.id}`} className="text-xs font-black text-blue-950">
                    • {ex.title}{' '}
                    <span className="text-[10px] font-bold text-blue-700 font-mono" dir="ltr">
                      ({ex.startDate === ex.endDate ? ex.startDate : `${ex.startDate} → ${ex.endDate}`})
                    </span>
                  </div>
                ))}
                <p className="text-[10.5px] font-bold text-blue-800 leading-relaxed">
                  يُمنع برمجة بطولات السلك المعني خلال تواريخ الامتحانات الخاصة به.
                </p>
              </div>
            )}

            {/* List of Events on Selected Day */}
            <div className="mt-4 space-y-3">
              {selectedDateEvents.length === 0 ? (
                <div className={`text-center py-8 px-4 rounded-2xl border border-dashed ${
                  selectedDateHolidays.length > 0
                    ? 'bg-red-50/40 border-red-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-2 text-xl ${
                    selectedDateHolidays.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'
                  }`}>
                    {selectedDateHolidays.length > 0 ? '🏖️' : '📅'}
                  </div>
                  <h5 className="text-xs font-bold text-slate-700">
                    {selectedDateHolidays.length > 0
                      ? 'يوم عطلة مدرسية — لا توجد مباريات مبرمجة'
                      : 'لا توجد بطولات أو مباريات في هذا اليوم'}
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {selectedDateHolidays.length > 0
                      ? 'تُمنع برمجة أي مقابلة في تواريخ العطل المدرسية.'
                      : 'يمكنك استعراض الأيام المميزة في الرزنامة، أو برمجة نشاط أو مباراة جديدة في هذا التاريخ.'}
                  </p>

                  {!isTeacher && onOpenCreateMatch && selectedDateHolidays.length === 0 && (
                    <button
                      onClick={() => onOpenCreateMatch(selectedDateStr)}
                      className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>برمجة مباراة في هذا اليوم</span>
                    </button>
                  )}
                </div>
              ) : (
                selectedDateEvents.map(ev => {
                  const isPendingApproval = ev.rawMatch ? isMatchProgramPendingApproval(ev.rawMatch) : ev.programApprovalStatus === 'pending';
                  const displayedRefs = ev.refereesText && ev.refereesText !== '-' ? ev.refereesText : 'يعين لاحقاً';
                  return (
                  <div
                    key={ev.id}
                    className={`p-3.5 rounded-xl border transition-all shadow-3xs space-y-2.5 ${
                      isPendingApproval
                        ? 'bg-slate-200/90 border-slate-300 text-slate-600'
                        : 'border-slate-200 bg-gradient-to-b from-white to-slate-50/50 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center shrink-0 border ${
                          isPendingApproval ? 'bg-slate-300/70 text-slate-600 border-slate-300 grayscale' : 'bg-blue-50 text-blue-700 border-blue-100'
                        }`}>
                          {ev.sportIcon}
                        </span>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 leading-tight">
                            {ev.title}
                          </h5>
                          <span className="text-[10px] text-slate-500 font-bold block">
                            رياضة: {ev.sportName}
                          </span>
                        </div>
                      </div>

                      {isPendingApproval && (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-300 text-[10px] font-black">
                          في انتظار المصادقة على البرنامج
                        </span>
                      )}

                      {getScopeBadge(ev.scope)}
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-200/70">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700">{ev.venue}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>التاريخ: <strong className="text-slate-700">{formatMatchDate(ev.date)}</strong></span>
                      </div>

                      {ev.time && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>التوقيت: {ev.time}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>الفئة: <strong>{ev.category}</strong></span>
                      </div>

                      {ev.coordinator && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Medal className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>المؤطر المكلف: <strong className="text-slate-700">{ev.coordinator}</strong></span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-slate-500">
                        <ShieldCheck className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span>الحكام: <strong className="text-slate-700">{displayedRefs}</strong></span>
                      </div>
                    </div>

                    {ev.notes && (
                      <div className="text-[10px] bg-white/80 p-2 rounded-lg border border-slate-200/80 text-slate-500 leading-relaxed">
                        ℹ️ {ev.notes}
                      </div>
                    )}

                    {effectiveIsCentralAdmin && ev.rawMatch?.id && (
                      isPendingApproval ? (
                        <button
                          type="button"
                          onClick={() => handleApproveMatchProgram(ev.rawMatch!.id)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>المصادقة على البرنامج</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleRevertMatchProgram(ev.rawMatch!.id)}
                          className="w-full py-1.5 px-2.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 font-black text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                          <span>التراجع عن مصادقة البرنامج</span>
                        </button>
                      )
                    )}

                    {ev.rawTournament && onNavigateToTournament && (
                      <button
                        onClick={() => onNavigateToTournament(ev.rawTournament!.id)}
                        className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>عرض تفاصيل ومشاركي البطولة</span>
                      </button>
                    )}
                  </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 p-4 rounded-2xl border border-blue-200/80 text-xs text-blue-950 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>ميزة التحميل الرسمي للبرنامج</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              يمكنك تحميل البرنامج بصيغة <strong>PDF</strong> منفصلة، أو بصيغة <strong>Word (.doc)</strong>، أو طباعته ورقياً، كما يمكنك اختيار برنامج بطولة واحدة معينة أو بطولتين أو أكثر عوض الشامل فقط.
            </p>
          </div>
        </div>
      </div>

      {/* Program Export Modal (PDF / Word / Print with Granular Tournament Selection) */}
      <ProgramExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tournaments={tournaments}
        matches={matches}
        schools={schools}
        venues={venues}
        referees={loadedReferees}
        teachers={loadedTeachers}
        activeSeason={activeSeason}
        initialSelectedSportIds={exportModalInitialSports}
        initialScopeFilter={scopeFilter}
        initialAffiliationFilter={affiliationFilter}
        allowedSportIds={isScopedToTechHead ? effectiveAllowedSportIds : null}
        isCentralAdmin={effectiveIsCentralAdmin}
      />

      {/* Interactive Popup Modal for Date Match Details */}
      {activeQuickModalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs text-xl shadow-inner">
                  📅
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black">
                    تفاصيل البرمجة ليوم {activeQuickModalDate}
                  </h3>
                  <p className="text-[11px] text-blue-100 font-medium">
                    {(eventsByDate[activeQuickModalDate] || []).length > 0 
                      ? `يتضمن ${(eventsByDate[activeQuickModalDate] || []).length} مبارة/تظاهرة مدرسية` 
                      : 'لا توجد أنشطة مبرمجة في هذا التاريخ'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveQuickModalDate(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-slate-50/50">
              {quickModalDateHolidays.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-red-800">🏖️ عطلة مدرسية رسمية</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300">
                      ممنوع البرمجة
                    </span>
                  </div>
                  {quickModalDateHolidays.map(h => (
                    <p key={`modal-hol-${h.id}`} className="text-xs font-black text-red-900">
                      • {h.title}
                    </p>
                  ))}
                </div>
              )}

              {quickModalDateExams.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-blue-900">📝 فترة الامتحانات</span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-300">
                      ممنوع للسلك المعني
                    </span>
                  </div>
                  {quickModalDateExams.map(ex => (
                    <p key={`modal-ex-${ex.id}`} className="text-xs font-black text-blue-950">
                      • {ex.title}
                    </p>
                  ))}
                </div>
              )}

              {(eventsByDate[activeQuickModalDate] || []).length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                  <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">
                    {quickModalDateHolidays.length > 0
                      ? 'يوم عطلة مدرسية — لا يُسمح ببرمجة المباريات في هذا التاريخ'
                      : 'لم يتم تسجيل أية مباراة مبرمجة لهذا اليوم'}
                  </p>
                  {!isTeacher && onOpenCreateMatch && quickModalDateHolidays.length === 0 && (
                    <button
                      onClick={() => {
                        const d = activeQuickModalDate;
                        setActiveQuickModalDate(null);
                        onOpenCreateMatch(d);
                      }}
                      className="mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>برمجة مباراة في هذا اليوم</span>
                    </button>
                  )}
                </div>
              ) : (
                (eventsByDate[activeQuickModalDate] || []).map(ev => {
                  const rawM = ev.rawMatch;
                  const isPendingApproval = rawM ? isMatchProgramPendingApproval(rawM) : ev.programApprovalStatus === 'pending';
                  const displayedRefs = ev.refereesText && ev.refereesText !== '-' ? ev.refereesText : 'يعين لاحقاً';
                  return (
                    <div
                      key={`modal-ev-${ev.id}`}
                      className={`rounded-2xl border p-4 shadow-xs space-y-3 transition-all ${
                        isPendingApproval
                          ? 'bg-slate-200/90 border-slate-300'
                          : 'bg-white border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-300/70 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-9 h-9 rounded-xl font-black flex items-center justify-center text-lg border ${
                            isPendingApproval ? 'bg-slate-300 text-slate-600 border-slate-400/50 grayscale' : 'bg-blue-50 text-blue-700 border-blue-100'
                          }`}>
                            {ev.sportIcon}
                          </span>
                          <div>
                            <h4 className="text-xs md:text-sm font-black text-slate-900">{ev.title}</h4>
                            <span className="text-[10px] text-slate-500 font-bold">الرياضة: {ev.sportName}</span>
                          </div>
                        </div>
                        {isPendingApproval && (
                          <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-300 text-[10px] font-black">
                            في انتظار المصادقة على البرنامج
                          </span>
                        )}
                        {getScopeBadge(ev.scope)}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-medium bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span>التاريخ: <strong>{formatMatchDate(ev.date)}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>التوقيت: <strong>{ev.time || '15:00'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="truncate" title={ev.venue}>المركز: <strong>{ev.venue}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>الفئة: <strong>{ev.category}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>الجنس: <strong>{ev.gender === 'Male' ? 'ذكور' : ev.gender === 'Female' ? 'إناث' : 'مختلط'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <ShieldCheck className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate" title={displayedRefs}>الحكام: <strong>{displayedRefs}</strong></span>
                        </div>
                      </div>

                      {ev.notes && (
                        <div className="text-[10px] bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl text-amber-900 font-medium leading-relaxed">
                          ℹ️ {ev.notes}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-col gap-2 pt-1">
                        {effectiveIsCentralAdmin && rawM?.id && (
                          isPendingApproval ? (
                            <button
                              type="button"
                              onClick={() => handleApproveMatchProgram(rawM.id)}
                              className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>المصادقة على البرنامج</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRevertMatchProgram(rawM.id)}
                              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-xs font-black rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                            >
                              <Undo2 className="w-4 h-4" />
                              <span>التراجع عن مصادقة البرنامج</span>
                            </button>
                          )
                        )}
                        {rawM && onOpenMatchDetail ? (
                          <button
                            onClick={() => {
                              setActiveQuickModalDate(null);
                              onOpenMatchDetail(rawM);
                            }}
                            className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer border border-blue-200"
                          >
                            <span>تعديل برمجة المقابلة والنتيجة ✏️</span>
                          </button>
                        ) : ev.rawTournament && onNavigateToTournament ? (
                          <button
                            onClick={() => {
                              setActiveQuickModalDate(null);
                              onNavigateToTournament(ev.rawTournament!.id);
                            }}
                            className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer border border-blue-200"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>عرض تفاصيل البطولة المشاركة</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              {!isTeacher && onOpenCreateMatch && quickModalDateHolidays.length === 0 ? (
                <button
                  onClick={() => {
                    const d = activeQuickModalDate;
                    setActiveQuickModalDate(null);
                    onOpenCreateMatch(d);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة مباراة في هذا التاريخ</span>
                </button>
              ) : <div />}
              <button
                onClick={() => setActiveQuickModalDate(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
