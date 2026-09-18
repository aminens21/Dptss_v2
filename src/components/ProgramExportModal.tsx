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
import { Tournament, Match, School, Sport } from '../types';
import { SPORTS_CONFIG } from '../config/sportsConfig';
import { SPORTS_MAP } from '../lib/dataService';
import {
  buildAllCalendarEvents,
  downloadProgramAsPdf,
  downloadProgramAsWord,
  printProgram,
  CalendarExportEvent
} from '../lib/programExportService';
import toast from 'react-hot-toast';

interface ProgramExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournaments: Tournament[];
  matches: Match[];
  schools: School[];
  activeSeason: string;
  initialSelectedSportIds?: string[];
  initialScopeFilter?: 'ALL' | 'provincial' | 'regional' | 'national';
}

type ExportMode = 'ALL_SPORTS' | 'SINGLE_SPORT' | 'MULTI_SPORTS';

export const ProgramExportModal: React.FC<ProgramExportModalProps> = ({
  isOpen,
  onClose,
  tournaments,
  matches,
  schools,
  activeSeason,
  initialSelectedSportIds,
  initialScopeFilter = 'ALL'
}) => {
  // Mode: All sports vs single sport vs custom multi-sports
  const [mode, setMode] = useState<ExportMode>(() => {
    if (initialSelectedSportIds && initialSelectedSportIds.length === 1 && initialSelectedSportIds[0] !== 'ALL') {
      return 'SINGLE_SPORT';
    }
    if (initialSelectedSportIds && initialSelectedSportIds.length > 1) {
      return 'MULTI_SPORTS';
    }
    return 'ALL_SPORTS';
  });

  const [selectedSingleSport, setSelectedSingleSport] = useState<string>(() => {
    if (initialSelectedSportIds && initialSelectedSportIds.length === 1 && initialSelectedSportIds[0] !== 'ALL') {
      return initialSelectedSportIds[0];
    }
    return 'basketball';
  });

  const [selectedMultiSports, setSelectedMultiSports] = useState<string[]>(() => {
    if (initialSelectedSportIds && initialSelectedSportIds.length > 0 && !initialSelectedSportIds.includes('ALL')) {
      return initialSelectedSportIds;
    }
    return ['basketball', 'handball'];
  });

  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'provincial' | 'regional' | 'national'>(initialScopeFilter);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialSelectedSportIds && initialSelectedSportIds.length === 1 && initialSelectedSportIds[0] !== 'ALL') {
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
    }
  }, [isOpen, initialSelectedSportIds, initialScopeFilter]);

  // Build unified calendar events
  const allEvents = useMemo(() => {
    return buildAllCalendarEvents(tournaments, matches, schools);
  }, [tournaments, matches, schools]);

  // Determine active selected sport IDs based on current mode
  const activeSelectedSportIds = useMemo<string[]>(() => {
    if (mode === 'ALL_SPORTS') return [];
    if (mode === 'SINGLE_SPORT') return [selectedSingleSport];
    if (mode === 'MULTI_SPORTS') return selectedMultiSports;
    return [];
  }, [mode, selectedSingleSport, selectedMultiSports]);

  // Filter events for preview and count
  const filteredEvents = useMemo(() => {
    let list = allEvents.slice();

    if (activeSelectedSportIds.length > 0) {
      list = list.filter(ev => activeSelectedSportIds.includes(ev.sportId));
    }

    if (scopeFilter !== 'ALL') {
      list = list.filter(ev => ev.scope === scopeFilter);
    }

    list.sort((a, b) => a.date.localeCompare(b.date));
    return list;
  }, [allEvents, activeSelectedSportIds, scopeFilter]);

  // Available sports list from configuration
  const availableSports = useMemo(() => {
    return SPORTS_CONFIG.map(s => ({
      id: s.id,
      name: s.name,
      icon: s.icon || '🏆'
    }));
  }, []);

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
          <div className="space-y-2.5">
            <label className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              <span>نطاق الرياضات المراد استخراج برنامجها:</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: ALL SPORTS */}
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
                  <h4 className="font-bold text-slate-900 text-xs">البرنامج الشامل</h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">كافة الرياضات والبطولات المدرسية</p>
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

          {/* Summary Indicator Box */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 p-3.5 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs">
                {filteredEvents.length}
              </span>
              <div>
                <h5 className="font-black text-slate-900 text-xs">
                  {filteredEvents.length > 0 ? 'أنشطة ومواعيد جاهزة للتصدير' : 'لا توجد أنشطة مسجلة بهذه الفلاتر'}
                </h5>
                <p className="text-[11px] text-slate-500">
                  {mode === 'ALL_SPORTS'
                    ? 'البرنامج الشامل لكافة الرياضات'
                    : mode === 'SINGLE_SPORT'
                    ? `برنامج رياضة: ${SPORTS_MAP[selectedSingleSport]?.name || selectedSingleSport}`
                    : `برنامج ${selectedMultiSports.length} رياضات محددة`}
                  {' • '}
                  {scopeFilter === 'ALL' ? 'جميع المستويات' : scopeFilter === 'provincial' ? 'إقليمي' : scopeFilter === 'regional' ? 'جهوي' : 'وطني'}
                </p>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 flex items-center gap-1.5 font-medium bg-white px-3 py-1.5 rounded-lg border border-slate-200">
              <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>يتضمن الترويسة الوزارية والتوقيعات الإدارية الرسمية</span>
            </div>
          </div>

          {/* Preview Table of First few events */}
          {filteredEvents.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-bold text-slate-700 flex items-center justify-between text-[11px]">
                <span>معاينة محتوى الجدول الرسمي (أول {Math.min(filteredEvents.length, 5)} أنشطة من أصل {filteredEvents.length}):</span>
                <span className="text-blue-700 font-bold">جاهز للتوليد 📄</span>
              </div>
              <div className="max-h-36 overflow-y-auto">
                <table className="w-full text-right text-[11px]">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2">البطولة أو التظاهرة</th>
                      <th className="p-2">الرياضة</th>
                      <th className="p-2">المستوى</th>
                      <th className="p-2">المكان</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEvents.slice(0, 5).map(ev => (
                      <tr key={ev.id} className="hover:bg-slate-50">
                        <td className="p-2 font-bold text-blue-800 whitespace-nowrap">{ev.date}</td>
                        <td className="p-2 font-semibold text-slate-900">{ev.title}</td>
                        <td className="p-2 text-slate-600">{ev.sportName}</td>
                        <td className="p-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            ev.scope === 'national' ? 'bg-amber-100 text-amber-800' : ev.scope === 'regional' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {ev.scope === 'national' ? 'وطني' : ev.scope === 'regional' ? 'جهوي' : 'إقليمي'}
                          </span>
                        </td>
                        <td className="p-2 text-slate-500 truncate max-w-[150px]">{ev.venue}</td>
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
