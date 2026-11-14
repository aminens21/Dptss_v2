import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  FileText,
  Printer,
  Download,
  Calendar,
  CheckCircle2,
  Filter,
  Layers,
  Sparkles,
  Info,
  ChevronDown
} from 'lucide-react';
import { Tournament, Match, School, Sport, Venue, Referee, User } from '../types';
import { SPORTS_CONFIG } from '../config/sportsConfig';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import {
  buildAllCalendarEvents,
  downloadProgramAsPdf,
  downloadProgramAsWord,
  printProgram,
  ProgramAffiliationFilter,
  AFFILIATION_LABELS
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
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [loadedVenues, setLoadedVenues] = useState<Venue[]>([]);
  const [loadedReferees, setLoadedReferees] = useState<Referee[]>([]);
  const [loadedTeachers, setLoadedTeachers] = useState<User[]>([]);

  // Sync initial props and load venues / referees / teachers if not passed
  useEffect(() => {
    if (isOpen) {
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

      if (!propVenues || propVenues.length === 0) {
        DataService.getVenues().then(setLoadedVenues).catch(() => {});
      }
      if (!propReferees || propReferees.length === 0) {
        DataService.getReferees().then(setLoadedReferees).catch(() => {});
      }
      if (!propTeachers || propTeachers.length === 0) {
        DataService.getTeachers().then(setLoadedTeachers).catch(() => {});
      }
    }
  }, [isOpen, initialSelectedSportIds, initialScopeFilter, initialAffiliationFilter, isScopedToTechHead, allowedSportIds, propVenues, propReferees, propTeachers]);

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

  // Reset affiliationFilter if selected class has 0 matches
  useEffect(() => {
    if (affiliationFilter !== 'ALL' && !availableAffiliationOptions.some(o => o.id === affiliationFilter)) {
      setAffiliationFilter('ALL');
    }
  }, [affiliationFilter, availableAffiliationOptions]);

  // Filter events for preview and count
  const filteredEvents = useMemo(() => {
    let list = sportAndScopeEvents.slice();
    if (affiliationFilter !== 'ALL') {
      list = list.filter(ev => (ev.affiliationType || 'non_club') === affiliationFilter);
    }
    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }, [sportAndScopeEvents, affiliationFilter]);

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
    selectedSportIds: activeSelectedSportIds,
    scopeFilter,
    affiliationFilter,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden my-auto max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shrink-0">
              📥
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-blue-500/25 border border-blue-400/30 text-blue-200 font-bold px-2 py-0.5 rounded-full">
                  الموسم الدراسي {activeSeason}
                </span>
                <span className="text-[10px] bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 font-bold px-2 py-0.5 rounded-full">
                  تصدير وطباعة رسمي
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-black text-white mt-1">
                تحميل وبرمجة رزنامة البطولات (PDF / Word / طباعة)
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 text-slate-800 text-xs">
          
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

          {/* Summary Indicator Box */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 p-3.5 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                {filteredEvents.length}
              </span>
              <div>
                <h5 className="font-black text-slate-900 text-xs">
                  {filteredEvents.length > 0 ? 'مباريات ومواعيد جاهزة للتصدير' : 'البرنامج فارغ حالياً — لا توجد مباريات مبرمجة'}
                </h5>
                <p className="text-[11px] text-slate-500">
                  {mode === 'ALL_SPORTS'
                    ? 'البرنامج الشامل لكافة الرياضات'
                    : mode === 'SINGLE_SPORT'
                    ? `برنامج رياضة: ${SPORTS_MAP[selectedSingleSport]?.name || selectedSingleSport}`
                    : `برنامج ${selectedMultiSports.length} رياضات محددة`}
                  {' • '}
                  {scopeFilter === 'ALL' ? 'جميع المستويات' : scopeFilter === 'provincial' ? 'إقليمي' : scopeFilter === 'regional' ? 'جهوي' : 'وطني'}
                  {affiliationFilter !== 'ALL' ? ` • ${AFFILIATION_LABELS[affiliationFilter]}` : ''}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-200">
              <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>يتضمن الترويسة الوزارية والتوقيعات الإدارية الرسمية</span>
            </div>
          </div>

          {/* Preview Table or Empty Notice */}
          {filteredEvents.length === 0 ? (
            <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50 text-slate-500 text-xs font-bold">
              لا توجد مباريات مبرمجة حالياً لهذه الرياضة أو الفئة (البرنامج فارغ).
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between text-[11px]">
                <span>معاينة محتوى الجدول الرسمي (أول {Math.min(filteredEvents.length, 5)} مواعيد من أصل {filteredEvents.length}):</span>
                <span className="text-blue-700 font-bold">جاهز للتوليد 📄</span>
              </div>
              <div className="max-h-36 overflow-y-auto">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2">المقابلة (مؤسسة ضد مؤسسة)</th>
                      {mode !== 'SINGLE_SPORT' && <th className="p-2">الرياضة</th>}
                      <th className="p-2">المستوى</th>
                      <th className="p-2">المكان</th>
                      <th className="p-2">الحكام</th>
                      {showNotesColumn && <th className="p-2">ملاحظات</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEvents.slice(0, 5).map(ev => (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-blue-800 whitespace-nowrap">{ev.date}</td>
                        <td className="p-2 font-semibold text-slate-900">{ev.title}</td>
                        {mode !== 'SINGLE_SPORT' && <td className="p-2 text-slate-600">{ev.sportName}</td>}
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ev.scope === 'national' ? 'bg-amber-100 text-amber-800' : ev.scope === 'regional' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {ev.scope === 'national' ? 'وطني' : ev.scope === 'regional' ? 'جهوي' : 'إقليمي'}
                          </span>
                        </td>
                        <td className="p-2 text-slate-600 truncate max-w-[150px]">{ev.venue}</td>
                        <td className="p-2 text-slate-600 truncate max-w-[140px]">{ev.refereesText || '-'}</td>
                        {showNotesColumn && (
                          <td className="p-2 text-slate-600 truncate max-w-[140px]">{ev.notes?.trim() || '-'}</td>
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
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer border border-slate-700"
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
