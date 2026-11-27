import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  X,
  FileText,
  Printer,
  Download,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Filter,
  Layers,
  Sparkles,
  Info,
  Hash,
  Trophy,
  RotateCcw
} from 'lucide-react';
import { Tournament, Match, School, Sport, Venue, Referee, User } from '../types';
import { SPORTS_CONFIG } from '../config/sportsConfig';
import { DataService, SPORTS_MAP, normalizeDateToYmd } from '../lib/dataService';
import {
  buildAllCalendarEvents,
  downloadProgramAsPdf,
  downloadProgramAsWord,
  printProgram,
  ProgramAffiliationFilter,
  ProgramSortCriterion,
  AFFILIATION_LABELS,
  filterCalendarEvents,
  getEventCategoryGenderTuple,
  formatTargetCategoryWithGender,
  formatYmdToDmy
} from '../lib/programExportService';
import toast from 'react-hot-toast';

interface ProgramExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournaments: Tournament[];
  matches: Match[];
  schools: School[];
  venues?: Venue[];
  referees?: Referee[];
  teachers?: User[];
  activeSeason: string;
  initialSelectedSportIds?: string[];
  initialScopeFilter?: 'ALL' | 'provincial' | 'regional' | 'national';
  initialAffiliationFilter?: ProgramAffiliationFilter;
  allowedSportIds?: string[] | null;
  isCentralAdmin?: boolean;
}

type ExportMode = 'ALL_SPORTS' | 'SINGLE_SPORT' | 'MULTI_SPORTS';

export const ProgramExportModal: React.FC<ProgramExportModalProps> = ({
  isOpen,
  onClose,
  tournaments,
  matches,
  schools,
  venues: propVenues,
  referees: propReferees,
  teachers: propTeachers,
  activeSeason,
  initialSelectedSportIds,
  initialScopeFilter = 'ALL',
  initialAffiliationFilter = 'ALL',
  allowedSportIds = null,
  isCentralAdmin = false
}) => {
  const isScopedToTechHead = !isCentralAdmin && Array.isArray(allowedSportIds);

  // Mode: All sports vs single sport vs custom multi-sports
  const [mode, setMode] = useState<ExportMode>(() => {
    if (isScopedToTechHead && allowedSportIds!.length <= 1) {
      return 'SINGLE_SPORT';
    }
    if (initialSelectedSportIds && initialSelectedSportIds.length === 1 && initialSelectedSportIds[0] !== 'ALL') {
      return 'SINGLE_SPORT';
    }
    if (initialSelectedSportIds && initialSelectedSportIds.length > 1) {
      return 'MULTI_SPORTS';
    }
    return 'ALL_SPORTS';
  });

  const [selectedSingleSport, setSelectedSingleSport] = useState<string>(() => {
    if (isScopedToTechHead && allowedSportIds!.length > 0) {
      return allowedSportIds![0];
    }
    if (initialSelectedSportIds && initialSelectedSportIds.length === 1 && initialSelectedSportIds[0] !== 'ALL') {
      return initialSelectedSportIds[0];
    }
    return 'basketball';
  });

  const [selectedMultiSports, setSelectedMultiSports] = useState<string[]>(() => {
    if (isScopedToTechHead && allowedSportIds!.length > 0) {
      return allowedSportIds!;
    }
    if (initialSelectedSportIds && initialSelectedSportIds.length > 0 && !initialSelectedSportIds.includes('ALL')) {
      return initialSelectedSportIds;
    }
    return ['basketball', 'handball'];
  });

  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'provincial' | 'regional' | 'national'>(initialScopeFilter);
  const [affiliationFilter, setAffiliationFilter] = useState<ProgramAffiliationFilter>(initialAffiliationFilter);
  const [sortBy, setSortBy] = useState<ProgramSortCriterion>('category');
  const [activeFilters, setActiveFilters] = useState<{
    date: boolean;
    category: boolean;
    matchNumber: boolean;
    sport: boolean;
  }>({
    date: false,
    category: true,
    matchNumber: false,
    sport: false
  });
  const [selectedDate, setSelectedDate] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('ALL');
  const [matchNumberQuery, setMatchNumberQuery] = useState<string>('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [loadedVenues, setLoadedVenues] = useState<Venue[]>([]);
  const [loadedReferees, setLoadedReferees] = useState<Referee[]>([]);
  const [loadedTeachers, setLoadedTeachers] = useState<User[]>([]);
  const wasOpenRef = useRef<boolean>(false);

  // Initialize modal state ONLY when transitioning from closed -> open so background sync never resets user filters
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      if (isScopedToTechHead) {
        const scoped = allowedSportIds || [];
        if (scoped.length <= 1) {
          setMode('SINGLE_SPORT');
          if (scoped[0]) {
            setSelectedSingleSport(scoped[0]);
            setSelectedMultiSports([scoped[0]]);
          }
        } else {
          if (initialSelectedSportIds && initialSelectedSportIds.length === 1 && scoped.includes(initialSelectedSportIds[0])) {
            setMode('SINGLE_SPORT');
            setSelectedSingleSport(initialSelectedSportIds[0]);
          } else {
            setMode('ALL_SPORTS');
            setSelectedSingleSport(scoped[0]);
          }
          setSelectedMultiSports(scoped);
        }
      } else if (initialSelectedSportIds && initialSelectedSportIds.length === 1 && initialSelectedSportIds[0] !== 'ALL') {
        setMode('SINGLE_SPORT');
        setSelectedSingleSport(initialSelectedSportIds[0]);
      } else if (initialSelectedSportIds && initialSelectedSportIds.length > 1) {
        setMode('MULTI_SPORTS');
        setSelectedMultiSports(initialSelectedSportIds);
      } else {
        setMode('ALL_SPORTS');
      }
      if (initialScopeFilter) {
        setScopeFilter(initialScopeFilter);
      }
      setAffiliationFilter(initialAffiliationFilter || 'ALL');
      setSortBy('category');
      setActiveFilters({
        date: false,
        category: true,
        matchNumber: false,
        sport: false
      });
      setSelectedDate('ALL');
      setCategoryFilter('ALL');
      setSelectedSportFilter('ALL');
      setMatchNumberQuery('');
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, initialSelectedSportIds, initialScopeFilter, initialAffiliationFilter, isScopedToTechHead, allowedSportIds]);

  // Load auxiliary data on open without touching filter selections
  useEffect(() => {
    if (!isOpen) return;
    if ((!propVenues || propVenues.length === 0) && loadedVenues.length === 0) {
      DataService.getVenues().then(setLoadedVenues).catch(() => {});
    }
    if ((!propReferees || propReferees.length === 0) && loadedReferees.length === 0) {
      DataService.getReferees().then(setLoadedReferees).catch(() => {});
    }
    if ((!propTeachers || propTeachers.length === 0) && loadedTeachers.length === 0) {
      DataService.getTeachers().then(setLoadedTeachers).catch(() => {});
    }
  }, [isOpen, propVenues, propReferees, propTeachers, loadedVenues.length, loadedReferees.length, loadedTeachers.length]);

  const effectiveVenues = propVenues && propVenues.length > 0 ? propVenues : loadedVenues;
  const effectiveReferees = propReferees && propReferees.length > 0 ? propReferees : loadedReferees;
  const effectiveTeachers = propTeachers && propTeachers.length > 0 ? propTeachers : loadedTeachers;

  // Build unified calendar events (strictly scoped to assigned sport(s) when Technical Committee Head)
  const allEvents = useMemo(() => {
    const built = buildAllCalendarEvents(tournaments, matches, schools, effectiveVenues, effectiveReferees, effectiveTeachers);
    if (!isScopedToTechHead) return built;
    const allowedSet = new Set(allowedSportIds || []);
    return built.filter(ev => allowedSet.has(ev.sportId));
  }, [tournaments, matches, schools, effectiveVenues, effectiveReferees, effectiveTeachers, isScopedToTechHead, allowedSportIds]);

  // Available sports:
  // - Central Admin: ONLY sports that actually have scheduled matches
  // - Tech Head: strictly their assigned sport(s) (preserving lock even if empty after reset)
  const availableSports = useMemo(() => {
    const base = SPORTS_CONFIG.map(s => ({
      id: s.id,
      name: s.name,
      icon: s.icon || '🏆'
    }));

    if (isScopedToTechHead) {
      const allowedSet = new Set(allowedSportIds || []);
      const filtered = base.filter(s => allowedSet.has(s.id));
      (allowedSportIds || []).forEach(id => {
        if (!filtered.some(s => s.id === id)) {
          filtered.push({
            id,
            name: SPORTS_MAP[id]?.name || id,
            icon: SPORTS_MAP[id]?.icon || '🏆'
          });
        }
      });
      return filtered;
    }

    const sportsWithMatches = new Set(allEvents.map(ev => ev.sportId));
    const filtered = base.filter(s => sportsWithMatches.has(s.id));
    allEvents.forEach(ev => {
      if (!filtered.some(s => s.id === ev.sportId)) {
        filtered.push({
          id: ev.sportId,
          name: ev.sportName || SPORTS_MAP[ev.sportId]?.name || ev.sportId,
          icon: ev.sportIcon || SPORTS_MAP[ev.sportId]?.icon || '🏆'
        });
      }
    });
    return filtered;
  }, [isScopedToTechHead, allowedSportIds, allEvents]);

  // Keep selectedSingleSport / selectedMultiSports valid when availableSports changes
  useEffect(() => {
    if (availableSports.length > 0 && !availableSports.some(s => s.id === selectedSingleSport)) {
      setSelectedSingleSport(availableSports[0].id);
    }
  }, [availableSports, selectedSingleSport]);

  // Determine active selected sport IDs based on current mode
  const activeSelectedSportIds = useMemo<string[]>(() => {
    if (isScopedToTechHead) {
      const scoped = allowedSportIds || [];
      if (scoped.length === 0) return ['__none__'];
      if (mode === 'SINGLE_SPORT') {
        return scoped.includes(selectedSingleSport) ? [selectedSingleSport] : [scoped[0]];
      }
      if (mode === 'MULTI_SPORTS') {
        const valid = selectedMultiSports.filter(id => scoped.includes(id));
        return valid.length > 0 ? valid : scoped;
      }
      return scoped;
    }
    if (mode === 'ALL_SPORTS') return [];
    if (mode === 'SINGLE_SPORT') return [selectedSingleSport];
    if (mode === 'MULTI_SPORTS') return selectedMultiSports;
    return [];
  }, [mode, selectedSingleSport, selectedMultiSports, isScopedToTechHead, allowedSportIds]);

  // Base events matching selected sports + scope (before affiliation class filter)
  const sportAndScopeEvents = useMemo(() => {
    let list = allEvents.slice();
    if (activeSelectedSportIds.length > 0) {
      list = list.filter(ev => activeSelectedSportIds.includes(ev.sportId));
    }
    if (scopeFilter !== 'ALL') {
      list = list.filter(ev => ev.scope === scopeFilter);
    }
    return list;
  }, [allEvents, activeSelectedSportIds, scopeFilter]);

  // Only tournament types/classes that actually contain matches
  const availableAffiliationOptions = useMemo(() => {
    const counts: Record<'non_club' | 'club_affiliated' | 'open', number> = {
      non_club: 0,
      club_affiliated: 0,
      open: 0
    };
    sportAndScopeEvents.forEach(ev => {
      const aff = ev.affiliationType || 'non_club';
      counts[aff] += 1;
    });
    const options: { id: 'non_club' | 'club_affiliated' | 'open'; label: string; count: number; icon: string }[] = [];
    if (counts.non_club > 0) {
      options.push({ id: 'non_club', label: AFFILIATION_LABELS.non_club, count: counts.non_club, icon: '🏫' });
    }
    if (counts.club_affiliated > 0) {
      options.push({ id: 'club_affiliated', label: AFFILIATION_LABELS.club_affiliated, count: counts.club_affiliated, icon: '🏅' });
    }
    if (counts.open > 0) {
      options.push({ id: 'open', label: AFFILIATION_LABELS.open, count: counts.open, icon: '🌍' });
    }
    return options;
  }, [sportAndScopeEvents]);

  // Reset affiliationFilter only when base events are loaded and selected class truly has 0 matches
  useEffect(() => {
    if (sportAndScopeEvents.length > 0 && affiliationFilter !== 'ALL' && !availableAffiliationOptions.some(o => o.id === affiliationFilter)) {
      setAffiliationFilter('ALL');
    }
  }, [sportAndScopeEvents.length, affiliationFilter, availableAffiliationOptions]);

  // Events after sport, scope, and affiliation filters
  const sportScopeAffiliationEvents = useMemo(() => {
    let list = sportAndScopeEvents.slice();
    if (affiliationFilter !== 'ALL') {
      list = list.filter(ev => (ev.affiliationType || 'non_club') === affiliationFilter);
    }
    return list;
  }, [sportAndScopeEvents, affiliationFilter]);

  // Available sports within current scope & affiliation
  const availableSportFilterOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon: string; count: number }>();
    sportScopeAffiliationEvents.forEach(ev => {
      const existing = map.get(ev.sportId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(ev.sportId, {
          id: ev.sportId,
          name: ev.sportName || SPORTS_MAP[ev.sportId]?.name || ev.sportId,
          icon: ev.sportIcon || SPORTS_MAP[ev.sportId]?.icon || '🏆',
          count: 1
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [sportScopeAffiliationEvents]);

  // Reset selectedSportFilter if no longer valid (only when events exist)
  useEffect(() => {
    if (sportScopeAffiliationEvents.length > 0 && selectedSportFilter !== 'ALL' && !availableSportFilterOptions.some(o => o.id === selectedSportFilter)) {
      setSelectedSportFilter('ALL');
    }
  }, [sportScopeAffiliationEvents.length, selectedSportFilter, availableSportFilterOptions]);

  // Events narrowed by the sport sub-filter (if active)
  const eventsAfterSportCriterion = useMemo(() => {
    if (activeFilters.sport && selectedSportFilter !== 'ALL') {
      return sportScopeAffiliationEvents.filter(ev => ev.sportId === selectedSportFilter);
    }
    return sportScopeAffiliationEvents;
  }, [sportScopeAffiliationEvents, activeFilters.sport, selectedSportFilter]);

  // Pool for Category dropdown (respects active Sport + active Date cross-filtering)
  const eventsForCategoryPool = useMemo(() => {
    if (activeFilters.date && selectedDate !== 'ALL') {
      return eventsAfterSportCriterion.filter(ev => (normalizeDateToYmd(ev.date) || ev.date || '') === selectedDate);
    }
    return eventsAfterSportCriterion;
  }, [eventsAfterSportCriterion, activeFilters.date, selectedDate]);

  // Available age category + gender combinations sorted in official order (female first, then male)
  const availableCategoryOptions = useMemo(() => {
    const map = new Map<
      string,
      { id: string; label: string; count: number; genderKey: 'Female' | 'Male' | 'Mixed'; ageRank: number; genderRank: number }
    >();
    eventsForCategoryPool.forEach(ev => {
      const tuple = getEventCategoryGenderTuple(ev);
      const existing = map.get(tuple.filterKey);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(tuple.filterKey, {
          id: tuple.filterKey,
          label: tuple.label,
          count: 1,
          genderKey: tuple.genderKey,
          ageRank: tuple.ageRank,
          genderRank: tuple.genderRank
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => {
      if (a.genderRank !== b.genderRank) return a.genderRank - b.genderRank;
      if (a.ageRank !== b.ageRank) return a.ageRank - b.ageRank;
      return a.label.localeCompare(b.label, 'ar');
    });
  }, [eventsForCategoryPool]);

  // Reset categoryFilter if no longer valid (only when category pool has items)
  useEffect(() => {
    if (eventsForCategoryPool.length > 0 && categoryFilter !== 'ALL' && !availableCategoryOptions.some(o => o.id === categoryFilter)) {
      setCategoryFilter('ALL');
    }
  }, [eventsForCategoryPool.length, categoryFilter, availableCategoryOptions]);

  // Pool for Date dropdown (respects active Sport + active Category cross-filtering)
  const eventsForDatePool = useMemo(() => {
    if (activeFilters.category && categoryFilter !== 'ALL') {
      return eventsAfterSportCriterion.filter(ev => getEventCategoryGenderTuple(ev).filterKey === categoryFilter);
    }
    return eventsAfterSportCriterion;
  }, [eventsAfterSportCriterion, activeFilters.category, categoryFilter]);

  // Available dates sorted newest-first (التاريخ الأحدث في الأعلى)
  const availableDateOptions = useMemo(() => {
    const counts = new Map<string, number>();
    eventsForDatePool.forEach(ev => {
      const ymd = normalizeDateToYmd(ev.date) || ev.date || '';
      if (!ymd) return;
      counts.set(ymd, (counts.get(ymd) || 0) + 1);
    });
    return Array.from(counts.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, count]) => ({
        date,
        label: formatYmdToDmy(date),
        count
      }));
  }, [eventsForDatePool]);

  // Reset selectedDate if no longer valid (only when date pool has items)
  useEffect(() => {
    if (eventsForDatePool.length > 0 && selectedDate !== 'ALL' && !availableDateOptions.some(o => o.date === selectedDate)) {
      setSelectedDate('ALL');
    }
  }, [eventsForDatePool.length, selectedDate, availableDateOptions]);

  const toggleFilterCriterion = (criterion: 'date' | 'category' | 'matchNumber' | 'sport') => {
    setActiveFilters(prev => {
      const nextActive = !prev[criterion];
      if (!nextActive) {
        if (criterion === 'date') setSelectedDate('ALL');
        if (criterion === 'category') setCategoryFilter('ALL');
        if (criterion === 'matchNumber') setMatchNumberQuery('');
        if (criterion === 'sport') setSelectedSportFilter('ALL');
      }
      return {
        ...prev,
        [criterion]: nextActive
      };
    });
  };

  const hasAnyActiveSubFilterValue = Boolean(
    (activeFilters.date && selectedDate !== 'ALL') ||
    (activeFilters.category && categoryFilter !== 'ALL') ||
    (activeFilters.matchNumber && matchNumberQuery.trim().length > 0) ||
    (activeFilters.sport && selectedSportFilter !== 'ALL')
  );

  const handleResetSubFilters = () => {
    setSelectedDate('ALL');
    setCategoryFilter('ALL');
    setSelectedSportFilter('ALL');
    setMatchNumberQuery('');
  };

  const effectiveSelectedSportIds = useMemo(() => {
    if (activeFilters.sport && selectedSportFilter !== 'ALL') {
      return [selectedSportFilter];
    }
    return activeSelectedSportIds;
  }, [activeFilters.sport, selectedSportFilter, activeSelectedSportIds]);

  // Unified filtered & sorted events using exact same pipeline as PDF/Word/Print export
  const {
    filtered: filteredEvents,
    resolvedMatchNumbers,
    selectedCategoryLabels,
    parsedMatchQuery
  } = useMemo(() => {
    return filterCalendarEvents({
      events: allEvents,
      selectedSportIds: effectiveSelectedSportIds,
      scopeFilter,
      affiliationFilter,
      categoryFilter: activeFilters.category ? categoryFilter : 'ALL',
      selectedDates: activeFilters.date && selectedDate !== 'ALL' ? [selectedDate] : [],
      matchNumberQuery: activeFilters.matchNumber ? matchNumberQuery : '',
      sortBy
    });
  }, [
    allEvents,
    effectiveSelectedSportIds,
    scopeFilter,
    affiliationFilter,
    activeFilters,
    categoryFilter,
    selectedDate,
    matchNumberQuery,
    selectedSportFilter,
    sortBy
  ]);

  const sortOrderLabel =
    sortBy === 'date'
      ? 'مرتب حسب التاريخ'
      : sortBy === 'matchNumber'
      ? 'مرتب حسب رقم المقابلة'
      : sortBy === 'sport'
      ? 'مرتب حسب الرياضة'
      : 'مرتب حسب الفئة';

  const showNotesColumn = useMemo(
    () => filteredEvents.some(ev => Boolean(ev.notes && ev.notes.trim().length > 0)),
    [filteredEvents]
  );

  const toggleMultiSport = (sportId: string) => {
    setSelectedMultiSports(prev => {
      if (prev.includes(sportId)) {
        if (prev.length === 1) {
          toast.error('يجب اختيار رياضة واحدة على الأقل');
          return prev;
        }
        return prev.filter(id => id !== sportId);
      } else {
        return [...prev, sportId];
      }
    });
  };

  // Export handlers
  const getExportOptions = () => ({
    events: allEvents,
    selectedSportIds: effectiveSelectedSportIds,
    scopeFilter,
    affiliationFilter,
    categoryFilter: activeFilters.category ? categoryFilter : 'ALL',
    selectedDates: activeFilters.date && selectedDate !== 'ALL' ? [selectedDate] : [],
    matchNumberQuery: activeFilters.matchNumber ? matchNumberQuery : '',
    sortBy,
    activeSeason
  });

  const handleDownloadPdf = async () => {
    if (filteredEvents.length === 0) {
      toast.error('لا توجد أنشطة مبرمجة تطابق المعايير المحددة');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      await downloadProgramAsPdf(getExportOptions());
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleDownloadWord = () => {
    if (filteredEvents.length === 0) {
      toast.error('لا توجد أنشطة مبرمجة تطابق المعايير المحددة');
      return;
    }
    downloadProgramAsWord(getExportOptions());
  };

  const handlePrint = () => {
    if (filteredEvents.length === 0) {
      toast.error('لا توجد أنشطة مبرمجة تطابق المعايير المحددة');
      return;
    }
    printProgram(getExportOptions());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 bg-slate-900/75 overflow-hidden animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white rounded-none border-0 shadow-2xl w-full h-[100dvh] flex flex-col overflow-hidden my-0">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-3.5 sm:p-5 flex items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shrink-0">
              📥
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] bg-blue-500/25 border border-blue-400/30 text-blue-200 font-bold px-2 py-0.5 rounded-full">
                  الموسم الدراسي {activeSeason}
                </span>
                <span className="text-[10px] bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 font-bold px-2 py-0.5 rounded-full">
                  تصدير وطباعة رسمي
                </span>
              </div>
              <h2 className="text-sm sm:text-lg font-black text-white mt-1 leading-snug">
                تحميل وبرمجة رزنامة البطولات (PDF / Word / طباعة)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 overflow-y-auto overflow-x-hidden space-y-5 text-slate-800 text-xs flex-1">
          
          {/* Section 1: Selection Mode (الشامل vs بطولة واحدة vs بطولتان أو أكثر) */}
          {isScopedToTechHead && availableSports.length <= 1 ? (
            <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">{availableSports[0]?.icon || '🏆'}</span>
                <div>
                  <h4 className="font-black text-amber-950 text-xs">
                    برنامج رياضتك المسندة: {availableSports[0]?.name || SPORTS_MAP[selectedSingleSport]?.name || selectedSingleSport}
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    بصفتك رئيس اللجنة التقنية، يقتصر الاستخراج والمعاينة على برنامج هذه الرياضة فقط.
                  </p>
                </div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-amber-700 shrink-0" />
            </div>
          ) : (
            <div className="space-y-2.5">
              <label className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Layers className="h-4 w-4 text-blue-600" />
                <span>نطاق الرياضات المراد استخراج برنامجها:</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Option 1: ALL SPORTS (or All Assigned Sports for multi-sport Tech Head) */}
                <button
                  type="button"
                  onClick={() => setMode('ALL_SPORTS')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    mode === 'ALL_SPORTS'
                      ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🌐</span>
                    {mode === 'ALL_SPORTS' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">
                      {isScopedToTechHead ? 'جميع رياضاتي المسندة' : 'البرنامج الشامل'}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {isScopedToTechHead
                        ? `كافة الرياضات المسندة إليك (${availableSports.length})`
                        : 'كافة الرياضات والبطولات المدرسية'}
                    </p>
                  </div>
                </button>

                {/* Option 2: SINGLE SPORT */}
                <button
                  type="button"
                  onClick={() => setMode('SINGLE_SPORT')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    mode === 'SINGLE_SPORT'
                      ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">🎯</span>
                    {mode === 'SINGLE_SPORT' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">بطولة واحدة فقط</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">تحديد رياضة معينة بذاتها</p>
                  </div>
                </button>

                {/* Option 3: MULTI SPORTS */}
                <button
                  type="button"
                  onClick={() => setMode('MULTI_SPORTS')}
                  className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                    mode === 'MULTI_SPORTS'
                      ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500/20 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">⚡</span>
                    {mode === 'MULTI_SPORTS' && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">بطولتان أو أكثر</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">تخصيص رياضتين أو ثلاث مجتمعة</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Conditional Sub-selector based on mode */}
          {mode === 'SINGLE_SPORT' && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">
                اختر الرياضة أو البطولة المحددة:
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableSports.map(sp => {
                  const isSelected = selectedSingleSport === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => setSelectedSingleSport(sp.id)}
                      className={`p-2 rounded-xl text-right font-bold text-xs flex items-center gap-2 transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <span className="text-base">{sp.icon}</span>
                      <span className="truncate">{sp.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === 'MULTI_SPORTS' && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">
                  حدد الرياضات المطلوب إدراجها معاً ({selectedMultiSports.length} محددة):
                </label>
                <span className="text-[11px] text-slate-500">انقر لتحديد أو إلغاء تحديد الرياضة</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableSports.map(sp => {
                  const isSelected = selectedMultiSports.includes(sp.id);
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onClick={() => toggleMultiSport(sp.id)}
                      className={`p-2 rounded-xl text-right font-bold text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-base">{sp.icon}</span>
                        <span className="truncate">{sp.name}</span>
                      </div>
                      {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-blue-200 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 2: Scope Filter (المستوى الإداري) */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Filter className="h-4 w-4 text-blue-600" />
              <span>مستوى المنافسات (النطاق الجغرافي):</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'ALL', label: 'كافة المستويات (الشامل)', icon: '🌐' },
                { id: 'provincial', label: 'بطولة إقليمية (تاوريرت)', icon: '🏆' },
                { id: 'regional', label: 'بطولة جهوية (الشرق)', icon: '🏅' },
                { id: 'national', label: 'بطولة وطنية (المملكة)', icon: '🥇' },
              ].map(lvl => {
                const isActive = scopeFilter === lvl.id;
                return (
                  <button
                    key={lvl.id}
                    type="button"
                    onClick={() => setScopeFilter(lvl.id as any)}
                    className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{lvl.icon}</span>
                    <span>{lvl.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Tournament Type / Affiliation Filter (Only types with matches) */}
          {availableAffiliationOptions.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                <span>نوع البطولة المراد إصدار برنامجها (تظهر الأصناف التي تتوفر على مباريات فقط):</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAffiliationFilter('ALL')}
                  className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                    affiliationFilter === 'ALL'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <span>🌐</span>
                  <span>الكل ({sportAndScopeEvents.length})</span>
                </button>
                {availableAffiliationOptions.map(opt => {
                  const isActive = affiliationFilter === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAffiliationFilter(opt.id)}
                      className={`py-2 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label} ({opt.count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section 4: Multi-Criteria Filter & Sort Selector */}
          {sportScopeAffiliationEvents.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-black text-slate-800 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-purple-600 shrink-0" />
                  <span>تصفية البرنامج (يمكن تفعيل معيارين أو أكثر في نفس الوقت):</span>
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {hasAnyActiveSubFilterValue && (
                    <button
                      type="button"
                      onClick={handleResetSubFilters}
                      className="px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>مسح التصفية</span>
                    </button>
                  )}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <span>ترتيب حسب:</span>
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value as ProgramSortCriterion)}
                      className="px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 font-bold text-xs focus:outline-none focus:ring-1 focus:ring-purple-500 cursor-pointer"
                    >
                      <option value="category">الفئة</option>
                      <option value="date">التاريخ</option>
                      <option value="matchNumber">رقم المقابلة</option>
                      <option value="sport">الرياضة</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Multi-Select Filter Criteria Toggles */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  {
                    id: 'date' as const,
                    label: 'التاريخ',
                    icon: CalendarDays,
                    activeClass: 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-500/20',
                    badgeTextClass: 'text-blue-700',
                    hasSelection: selectedDate !== 'ALL'
                  },
                  {
                    id: 'category' as const,
                    label: 'الفئة',
                    icon: Calendar,
                    activeClass: 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-500/20',
                    badgeTextClass: 'text-purple-700',
                    hasSelection: categoryFilter !== 'ALL'
                  },
                  {
                    id: 'matchNumber' as const,
                    label: 'رقم المقابلة',
                    icon: Hash,
                    activeClass: 'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-500/20',
                    badgeTextClass: 'text-sky-700',
                    hasSelection: matchNumberQuery.trim().length > 0
                  },
                  {
                    id: 'sport' as const,
                    label: 'الرياضة',
                    icon: Trophy,
                    activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20',
                    badgeTextClass: 'text-emerald-700',
                    hasSelection: selectedSportFilter !== 'ALL'
                  }
                ].map(criterion => {
                  const Icon = criterion.icon;
                  const isActive = activeFilters[criterion.id];
                  return (
                    <button
                      key={criterion.id}
                      type="button"
                      onClick={() => toggleFilterCriterion(criterion.id)}
                      className={`py-2 px-2.5 rounded-xl font-bold text-xs flex items-center justify-between gap-1.5 transition-all cursor-pointer border ${
                        isActive
                          ? criterion.activeClass
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{criterion.label}</span>
                      </div>
                      <span
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isActive
                            ? `bg-white ${criterion.badgeTextClass}`
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {isActive ? (criterion.hasSelection ? '●' : '✓') : '+'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Inputs for active filters (all active ones appear simultaneously) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                {activeFilters.date && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-blue-800 block">فلترة حسب التاريخ:</span>
                    <select
                      value={selectedDate}
                      onChange={e => setSelectedDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-blue-200 bg-blue-50/50 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 cursor-pointer"
                    >
                      <option value="ALL">جميع التواريخ ({eventsForDatePool.length})</option>
                      {availableDateOptions.map(opt => (
                        <option key={opt.date} value={opt.date}>
                          {opt.label} ({opt.count})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activeFilters.category && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-purple-800 block">فلترة حسب الفئة:</span>
                    <select
                      value={categoryFilter}
                      onChange={e => setCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-purple-200 bg-purple-50/50 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 cursor-pointer"
                    >
                      <option value="ALL">جميع الفئات ({eventsForCategoryPool.length})</option>
                      {availableCategoryOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label} ({opt.count})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {activeFilters.matchNumber && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-sky-800 block">فلترة حسب رقم المقابلة:</span>
                    <div className="relative">
                      <input
                        type="text"
                        value={matchNumberQuery}
                        onChange={e => setMatchNumberQuery(e.target.value)}
                        placeholder="أدخل رقم المقابلة (مثال: 5 أو 1-8 أو 2، 5)"
                        className="w-full px-3 py-2.5 pl-9 rounded-xl border border-sky-200 bg-sky-50/50 text-slate-900 text-xs font-bold placeholder:text-slate-400 placeholder:font-normal focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500"
                      />
                      {matchNumberQuery.trim() && (
                        <button
                          type="button"
                          onClick={() => setMatchNumberQuery('')}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="مسح"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {activeFilters.sport && (
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-emerald-800 block">فلترة حسب الرياضة:</span>
                    <select
                      value={selectedSportFilter}
                      onChange={e => setSelectedSportFilter(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 text-slate-800 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="ALL">جميع الرياضات ({sportScopeAffiliationEvents.length})</option>
                      {availableSportFilterOptions.map(opt => (
                        <option key={opt.id} value={opt.id}>
                          {opt.icon} {opt.name} ({opt.count})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {!activeFilters.date && !activeFilters.category && !activeFilters.matchNumber && !activeFilters.sport && (
                  <div className="sm:col-span-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-[11px] text-slate-500 font-medium">
                    لم يتم تفعيل أي معيار فلترة فرعي (يعرض البرنامج كاملاً حسب النطاق والنوع). انقر على الأزرار أعلاه لتفعيل معيارين أو أكثر في نفس الوقت.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Summary Indicator Box */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 p-3.5 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                {filteredEvents.length}
              </span>
              <div>
                <h5 className="font-black text-slate-900 text-xs">
                  {filteredEvents.length > 0 ? 'مباريات ومواعيد جاهزة للتصدير' : 'لا توجد مباريات تطابق الاختيار المحدد'}
                </h5>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  {mode === 'ALL_SPORTS'
                    ? 'البرنامج الشامل لكافة الرياضات'
                    : mode === 'SINGLE_SPORT'
                    ? `برنامج رياضة: ${SPORTS_MAP[selectedSingleSport]?.name || selectedSingleSport}`
                    : `برنامج ${selectedMultiSports.length} رياضات محددة`}
                  {' • '}
                  {scopeFilter === 'ALL' ? 'جميع المستويات' : scopeFilter === 'provincial' ? 'إقليمي' : scopeFilter === 'regional' ? 'جهوي' : 'وطني'}
                  {affiliationFilter !== 'ALL' ? ` • ${AFFILIATION_LABELS[affiliationFilter]}` : ''}
                  {activeFilters.category && selectedCategoryLabels.length > 0
                    ? ` • الفئة: ${selectedCategoryLabels[0]}`
                    : ''}
                  {activeFilters.date && selectedDate !== 'ALL'
                    ? ` • التاريخ: ${formatYmdToDmy(selectedDate)}`
                    : ''}
                  {activeFilters.matchNumber && parsedMatchQuery.hasQuery
                    ? ` • رقم المقابلة: ${parsedMatchQuery.normalizedDisplay}`
                    : ''}
                  {activeFilters.sport && selectedSportFilter !== 'ALL'
                    ? ` • الرياضة: ${SPORTS_MAP[selectedSportFilter]?.name || selectedSportFilter}`
                    : ''}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-200">
              <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>{sortOrderLabel}</span>
            </div>
          </div>

          {/* Preview Table (Desktop) & Cards (Mobile) or Empty Notice */}
          {filteredEvents.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50 text-slate-500 text-xs font-bold">
              لا توجد مباريات مبرمجة تطابق الاختيار المحدد حالياً.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between gap-2 flex-wrap text-[11px]">
                <span>معاينة محتوى الجدول الرسمي (أول {Math.min(filteredEvents.length, 15)} مواعيد من أصل {filteredEvents.length}):</span>
                <span className="text-blue-700 font-bold">{sortOrderLabel} 📄</span>
              </div>

              {/* Mobile Compact Preview Cards */}
              <div className="sm:hidden max-h-60 overflow-y-auto divide-y divide-slate-100 bg-white">
                {filteredEvents.slice(0, 15).map((ev, idx) => {
                  const matchNum = ev.matchNumber ?? resolvedMatchNumbers.get(ev.id) ?? idx + 1;
                  return (
                    <div key={ev.id} className="p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200 font-black text-[11px]">
                          مقابلة #{matchNum}
                        </span>
                        <span className="font-bold text-blue-800 text-[11px]">
                          {formatYmdToDmy(ev.date)}{ev.time ? ` • ${ev.time}` : ''}
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-xs leading-snug">
                        {ev.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                        <span className="font-bold text-purple-800">
                          {formatTargetCategoryWithGender(ev.category, ev.gender, ev.sportId)}
                        </span>
                        {mode !== 'SINGLE_SPORT' && (
                          <span className="text-slate-700 font-semibold">{ev.sportName}</span>
                        )}
                        <span>📍 {ev.venue}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop / Tablet Preview Table */}
              <div className="hidden sm:block max-h-52 overflow-y-auto overflow-x-auto">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2 text-center">رقم المقابلة</th>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2">الفئة المعنية</th>
                      <th className="p-2">المقابلة (مؤسسة ≠ مؤسسة)</th>
                      {mode !== 'SINGLE_SPORT' && <th className="p-2">الرياضة</th>}
                      <th className="p-2">المكان</th>
                      <th className="p-2">الحكام</th>
                      {showNotesColumn && <th className="p-2">ملاحظات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEvents.slice(0, 15).map((ev, idx) => (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="p-2 text-center font-black text-sky-700 whitespace-nowrap">
                          {ev.matchNumber ?? resolvedMatchNumbers.get(ev.id) ?? idx + 1}
                        </td>
                        <td className="p-2 font-bold text-blue-800 whitespace-nowrap">{formatYmdToDmy(ev.date)}</td>
                        <td className="p-2 font-bold text-purple-800 whitespace-nowrap">
                          {formatTargetCategoryWithGender(ev.category, ev.gender, ev.sportId)}
                        </td>
                        <td className="p-2 font-semibold text-slate-900">{ev.title}</td>
                        {mode !== 'SINGLE_SPORT' && <td className="p-2 text-slate-600">{ev.sportName}</td>}
                        <td className="p-2 text-slate-600 truncate max-w-[140px]">{ev.venue}</td>
                        <td className="p-2 text-slate-600 truncate max-w-[130px]">{ev.refereesText || 'يعين لاحقاً'}</td>
                        {showNotesColumn && (
                          <td className="p-2 text-slate-600 truncate max-w-[130px]">{ev.notes?.trim() || '-'}</td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer: DISTINCT EXPORT BUTTONS! */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="text-[11px] text-slate-500 font-medium">
            اختر الصيغة المناسبة: تحميل مباشر للملف أو طباعة ورقية فورية
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. SEPARATE PDF DOWNLOAD BUTTON */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf || filteredEvents.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:scale-102"
              title="تنزيل ملف PDF رسمي ومحكم التنسيق مباشرة إلى جهازك"
            >
              <Download className="h-4 w-4" />
              <span>{isGeneratingPdf ? 'جاري التحميل...' : 'تحميل البرنامج (PDF)'}</span>
            </button>

            {/* 2. WORD (.DOC) DOWNLOAD BUTTON */}
            <button
              type="button"
              onClick={handleDownloadWord}
              disabled={filteredEvents.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer hover:scale-102"
              title="تنزيل بصيغة Word قابلة للتعديل والإضافة وإدراج الخاتم"
            >
              <FileText className="h-4 w-4" />
              <span>تحميل البرنامج (Word)</span>
            </button>

            {/* 3. PRINT BUTTON (SEPARATE FROM DOWNLOAD!) */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredEvents.length === 0}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer border border-slate-700"
              title="فتح شاشة الطباعة الفورية وإرسال الأمر للطابعة الورقية"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة البرنامج</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
