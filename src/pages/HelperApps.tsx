import React, { useState, useEffect } from 'react';
import { 
  Boxes, 
  QrCode, 
  Camera, 
  ChevronRight, 
  ArrowLeft, 
  Clock, 
  Users, 
  Trophy, 
  Activity, 
  CheckCircle, 
  HelpCircle, 
  ShieldAlert, 
  Sparkles, 
  Play, 
  RotateCcw, 
  Shuffle, 
  FileText, 
  Printer, 
  Timer, 
  Layers, 
  ShieldCheck,
  Check,
  X
} from 'lucide-react';
import { CROSS_COUNTRY_CATEGORIES, CrossCountryCategoryDef } from '../lib/crossCountryConfig';
import { CrossCountryCategoryResult, School, Student } from '../types';
import { DataService } from '../lib/dataService';
import { FinishLineScannerModal } from '../components/FinishLineScannerModal';
import { CrossCountryPodiumView } from '../components/CrossCountryPodiumView';
import { ElectronicDrawModal } from '../components/ElectronicDrawModal';
import { BibGeneratorModal } from '../components/BibGeneratorModal';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

// Custom App Icon for "ماسح الصدريات لخط النهاية"
export const BibScannerAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 64, className = '' }) => {
  return (
    <div 
      className={`relative rounded-3xl overflow-hidden shadow-lg border border-white/20 flex items-center justify-center select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #0284c7 100%)',
      }}
    >
      {/* Background glow & subtle patterns */}
      <div className="absolute inset-0 bg-linear-to-b from-white/25 via-transparent to-black/30 pointer-events-none" />
      <div className="absolute -top-6 -right-6 w-16 h-16 bg-sky-400/40 rounded-full blur-md" />
      <div className="absolute -bottom-6 -left-6 w-16 h-16 bg-blue-700/50 rounded-full blur-md" />

      {/* Main Bib Silhouette Graphic */}
      <div className="relative z-10 flex flex-col items-center justify-center">
        {/* Race Bib Miniature */}
        <div className="w-10 h-8 sm:w-11 sm:h-9 bg-white rounded-md shadow-md border border-slate-200/90 flex flex-col items-center justify-between p-0.5 relative overflow-hidden">
          {/* Top Bib Header Bar */}
          <div className="w-full bg-blue-600 h-1.5 rounded-t-xs flex items-center justify-between px-1">
            <div className="w-1 h-1 rounded-full bg-white/80" />
            <span className="text-[5px] font-black text-white leading-none">BIB</span>
            <div className="w-1 h-1 rounded-full bg-white/80" />
          </div>

          {/* Bib Number */}
          <span className="text-[11px] sm:text-xs font-black text-slate-900 tracking-tighter leading-none mt-0.5 font-mono">
            #01
          </span>

          {/* Barcode/Scan graphic at bottom of bib */}
          <div className="flex items-center gap-0.5 h-1.5 mb-0.5 opacity-80">
            <div className="w-0.5 h-full bg-slate-800" />
            <div className="w-1 h-full bg-slate-800" />
            <div className="w-0.5 h-full bg-slate-800" />
            <div className="w-1.5 h-full bg-slate-800" />
            <div className="w-0.5 h-full bg-slate-800" />
            <div className="w-1 h-full bg-slate-800" />
          </div>

          {/* Laser Scan Beam Animation */}
          <div className="absolute inset-x-0 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_#ef4444] animate-pulse" />
        </div>

        {/* Small Camera / Scanner badge floating on corner */}
        <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white p-1 rounded-full shadow-md border border-white">
          <Camera className="w-2.5 h-2.5" />
        </div>
      </div>
    </div>
  );
};

export const HelperApps: React.FC = () => {
  const { userProfile } = useAuth();
  const [results, setResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CrossCountryCategoryDef | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [resultsCategory, setResultsCategory] = useState<CrossCountryCategoryDef | null>(null);
  const [isBibScannerExpanded, setIsBibScannerExpanded] = useState<boolean>(false);

  // Auxiliary Interactive Tools states
  const [activeSecondaryModal, setActiveSecondaryModal] = useState<'stopwatch' | 'draw' | 'bib_generator' | null>(null);

  // Stopwatch Tool State
  const [stopwatchTime, setStopwatchTime] = useState<number>(0);
  const [isStopwatchRunning, setIsStopwatchRunning] = useState<boolean>(false);
  const [laps, setLaps] = useState<number[]>([]);

  // Electronic Draw Tool State
  const [drawPool, setDrawPool] = useState<string[]>([]);
  const [groupsCount, setGroupsCount] = useState<number>(2);
  const [drawnGroups, setDrawnGroups] = useState<{ groupName: string; teams: string[] }[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Load results, students and schools
  const loadData = async () => {
    try {
      const [ccResults, scList, stList] = await Promise.all([
        DataService.getCrossCountryResults(),
        DataService.getSchools(),
        DataService.getStudents()
      ]);
      
      setResults(prev => {
        if (Object.keys(prev).length > 0 && ccResults && Object.keys(ccResults).length > 0) {
           return { ...ccResults, ...prev };
        }
        return ccResults || prev;
      });

      setSchools(prev => scList.length > prev.length ? scList : (prev.length > 0 ? prev : scList));
      setStudents(prev => stList.length > prev.length ? stList.filter(s => s.sportId === 'cross_country') : (prev.length > 0 ? prev : stList.filter(s => s.sportId === 'cross_country')));
      
      if (scList.length > 0 && drawPool.length === 0) {
        setDrawPool(scList.slice(0, 8).map(s => s.name));
      }
    } catch (err) {
      console.error('Failed to load helper apps data:', err);
    }
  };

  useEffect(() => {
    loadData();
    const unsubscribe = DataService.subscribeCrossCountryResults((newResults) => {
      setResults(newResults);
    });

    const handleCCUpdate = (e: Event | { type: string, result: CrossCountryCategoryResult }) => {
      let updatedResult: CrossCountryCategoryResult | null = null;
      if (e instanceof Event) {
        const customEvent = e as CustomEvent;
        if (customEvent.detail) updatedResult = customEvent.detail;
      } else if (e && e.result) {
        updatedResult = e.result;
      }

      if (updatedResult) {
        setResults(prev => ({
          ...prev,
          [updatedResult!.categoryId]: updatedResult!
        }));
      }
    };

    const bc = new BroadcastChannel('cc_results_sync');
    bc.onmessage = (event) => {
      if (event.data.type === 'UPDATE') {
        handleCCUpdate({ type: 'UPDATE', result: event.data.result });
      }
    };

    window.addEventListener('crossCountryResultsUpdated', handleCCUpdate);

    return () => {
      unsubscribe();
      window.removeEventListener('crossCountryResultsUpdated', handleCCUpdate);
      bc.close();
    };
  }, []);

  // Stopwatch timer logic
  useEffect(() => {
    let interval: any = null;
    if (isStopwatchRunning) {
      interval = setInterval(() => {
        setStopwatchTime(prev => prev + 10);
      }, 10);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isStopwatchRunning]);

  const formatStopwatch = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  };

  const handleOpenScanner = (cat?: CrossCountryCategoryDef) => {
    setSelectedCategory(cat || CROSS_COUNTRY_CATEGORIES[0]);
    setIsScannerOpen(true);
  };

  const handleOpenResults = (cat: CrossCountryCategoryDef) => {
    setResultsCategory(cat);
  };

  const handleSavePodiumResult = async (updatedResult: CrossCountryCategoryResult) => {
    try {
      await DataService.saveCrossCountryCategoryResult(updatedResult);
      await loadData();
      toast.success('تم تحديث نتائج السباق بنجاح');
    } catch (err) {
      console.error('Failed to update result:', err);
      toast.error('حدث خطأ أثناء حفظ النتائج');
    }
  };

  // Electronic Draw Execution
  const executeDraw = () => {
    if (drawPool.length < 2) {
      toast.error('يرجى تحديد فريقين على الأقل لإجراء القرعة');
      return;
    }
    setIsDrawing(true);
    setTimeout(() => {
      const shuffled = [...drawPool].sort(() => Math.random() - 0.5);
      const groups: { groupName: string; teams: string[] }[] = [];
      const alphabet = ['المجموعة أ (Groupe A)', 'المجموعة ب (Groupe B)', 'المجموعة ج (Groupe C)', 'المجموعة د (Groupe D)'];
      
      for (let i = 0; i < groupsCount; i++) {
        groups.push({
          groupName: alphabet[i] || `المجموعة ${i + 1}`,
          teams: []
        });
      }

      shuffled.forEach((team, index) => {
        const groupIndex = index % groupsCount;
        groups[groupIndex].teams.push(team);
      });

      setDrawnGroups(groups);
      setIsDrawing(false);
      toast.success('تمت إجراء القرعة الإلكترونية بنجاح!');
    }, 600);
  };

  // Total arrivals counted
  const totalArrived = (Object.values(results) as CrossCountryCategoryResult[]).reduce((sum, res) => sum + (res?.podium?.length || 0), 0);
  const completedRaces = (Object.values(results) as CrossCountryCategoryResult[]).filter(res => res?.podium && res.podium.length > 0).length;

  // App 4: Bib Numbers Generator
  const BibGeneratorAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 64, className = '' }) => {
    return (
      <div 
        className={`relative rounded-3xl overflow-hidden shadow-lg border border-white/20 flex items-center justify-center select-none shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%)',
        }}
      >
        <div className="absolute inset-0 bg-linear-to-b from-white/25 via-transparent to-black/30 pointer-events-none" />
        <div className="relative z-10 flex flex-col items-center justify-center">
          <div className="w-10 h-8 sm:w-11 sm:h-9 bg-white rounded-md shadow-md border border-slate-200/90 flex flex-col items-center justify-between p-0.5 relative overflow-hidden">
            <div className="w-full bg-indigo-600 h-1.5 rounded-t-xs flex items-center justify-between px-1">
              <div className="w-1 h-1 rounded-full bg-white/80" />
              <span className="text-[5px] font-black text-white leading-none">PDF</span>
              <div className="w-1 h-1 rounded-full bg-white/80" />
            </div>
            <span className="text-[11px] sm:text-xs font-black text-slate-900 tracking-tighter leading-none mt-0.5 font-mono">
              #01
            </span>
            <div className="flex items-center gap-0.5 h-1.5 mb-0.5 opacity-80">
              <div className="w-0.5 h-full bg-slate-800" />
              <div className="w-1 h-full bg-slate-800" />
              <div className="w-0.5 h-full bg-slate-800" />
            </div>
          </div>
          <div className="absolute -bottom-1.5 -right-1.5 bg-indigo-500 text-white p-1 rounded-full shadow-md border border-white">
            <Printer className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 py-6 select-none" dir="rtl">
      
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-950">تطبيقات مساعدة</h1>
                <span className="px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                  منظومة الأدوات الميدانية
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                تطبيقات متخصصة مخصصة لتسهيل التحكيم والعمليات الميدانية واللوجستية للرياضة المدرسية
              </p>
            </div>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-2 text-xs font-bold bg-slate-100 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl self-start md:self-auto">
          <Activity className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
          <span>الربط الميداني نشط ومتزامن</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ⭐ HERO SECTION: APP #1 - ماسح الصدريات لخط النهاية (The Primary App) ⭐ */}
      {/* ========================================================================= */}
      {isBibScannerExpanded && (
        <div className="bg-linear-to-br from-white via-slate-50 to-blue-50/40 border-2 border-blue-200/90 rounded-3xl p-6 sm:p-8 shadow-md relative overflow-hidden transition-all hover:shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
          {/* Decorative corner accent */}
          <div className="absolute top-0 left-0 bg-blue-600 text-white px-4 py-1 rounded-br-2xl text-[11px] font-black flex items-center gap-1.5 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>التطبيق الرئيسي رقم 1</span>
          </div>

          {/* Close Button for Full App View */}
          <button 
            onClick={() => setIsBibScannerExpanded(false)}
            className="absolute top-4 left-4 p-2 bg-white/80 hover:bg-white text-slate-500 hover:text-slate-800 rounded-xl border border-slate-200 shadow-sm transition-all cursor-pointer z-10"
            title="تصغير التطبيق"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pt-2">
          
          {/* App Branding & Icon */}
          <div className="flex items-center gap-5">
            {/* The Dedicated Custom Icon for Bib Scanner */}
            <BibScannerAppIcon size={76} className="shadow-blue-500/25 ring-4 ring-white" />

            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-2xl font-black text-slate-900">
                  ماسح الصدريات لخط النهاية (Bib Scanner)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  متاح ومفعّل للتحكيم
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed font-medium">
                تطبيق مخصص لقضاة وحكام خط النهاية لمسح أرقام صدريات العدائين بكاميرا الهاتف أو الإدخال اليدوي، مع تسجيل دقيق لأزمنة الوصول واحتساب فوري وتلقائي لنقاط وترتيب المؤسسات والفرق.
              </p>

              {/* Badges / Features */}
              <div className="flex items-center gap-2 pt-1 flex-wrap text-[11px] text-slate-500 font-semibold">
                <span className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                  <Camera className="w-3 h-3 text-blue-600" />
                  مسح QR وباركود بالكاميرا
                </span>
                <span className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                  <Timer className="w-3 h-3 text-emerald-600" />
                  ساعة توقيت لحظية
                </span>
                <span className="flex items-center gap-1 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
                  <Trophy className="w-3 h-3 text-amber-600" />
                  حساب نقاط المدارس آلياً
                </span>
              </div>
            </div>
          </div>

          {/* Launch Main Scanner Button */}
          <div className="w-full lg:w-auto shrink-0 flex flex-col sm:flex-row lg:flex-col gap-2.5">
            <button
              onClick={() => handleOpenScanner(CROSS_COUNTRY_CATEGORIES[0])}
              className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-blue-600/25 cursor-pointer"
            >
              <Camera className="w-5 h-5 text-white animate-pulse" />
              <span>تشغيل ماسح الصدريات</span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>

            <div className="text-center text-[10px] text-slate-500 font-bold bg-white/70 px-3 py-1 rounded-lg border border-slate-200">
              {totalArrived} عداء مسجل في {completedRaces} من 8 سباقات
            </div>
          </div>
        </div>

        {/* Quick Launch Race Category Grid with Auto Participants & Green Finish State */}
        <div className="mt-6 pt-6 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
            <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-blue-600" />
              <span>فئات السباق (تظهر المشاركين تلقائياً - السباقات المنتهية باللون الأخضر تحيل مباشرة للنتائج):</span>
            </span>
            <span className="text-[11px] font-bold text-slate-500">
              8 فئات معتمدة • {completedRaces} سباق مكتمل
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            {CROSS_COUNTRY_CATEGORIES.map((cat) => {
              const raceResult = results[cat.id];
              const arrivedCount = raceResult?.podium?.length || 0;
              const isFinished = arrivedCount > 0;
              const isFemale = cat.gender === 'Female';
              
              // Registered participants in database for this category (with robust fallback matching)
              const catCategory = cat.category.toLowerCase().trim();
              const catGender = cat.gender.toLowerCase().trim();

              const registeredStudents = students.filter(s => {
                const sCategory = (s.category || '').toLowerCase().trim();
                const sGender = (s.gender || '').toLowerCase().trim();

                const matchCat = sCategory === catCategory ||
                  (catCategory === 'u12' && (sCategory.includes('براعم') || sCategory.includes('12') || sCategory.includes('برعم'))) ||
                  (catCategory === 'u15' && (sCategory.includes('صغار') || sCategory.includes('15') || sCategory.includes('صغير'))) ||
                  (catCategory === 'u18' && (sCategory.includes('فتيان') || sCategory.includes('18') || sCategory.includes('فتيات') || sCategory.includes('فتي'))) ||
                  (catCategory === 'u20' && (sCategory.includes('شبان') || sCategory.includes('20') || sCategory.includes('شابات') || sCategory.includes('شب')));

                const matchGen = sGender === catGender ||
                  (catGender === 'male' && (sGender.includes('ذكر') || sGender.includes('ذكور') || sGender === 'm' || sGender === 'male' || sGender.includes('ولد'))) ||
                  (catGender === 'female' && (sGender.includes('أنثى') || sGender.includes('انثى') || sGender.includes('إناث') || sGender.includes('اناث') || sGender === 'f' || sGender === 'female' || sGender.includes('بنت')));

                return matchCat && matchGen;
              });
              const registeredCount = registeredStudents.length;

              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    if (isFinished) {
                      handleOpenResults(cat);
                    } else {
                      handleOpenScanner(cat);
                    }
                  }}
                  className={`p-3 rounded-2xl border text-right transition-all flex flex-col justify-between group cursor-pointer shadow-xs hover:shadow-lg hover:scale-102 active:scale-98 relative overflow-hidden ${
                    isFinished 
                      ? 'bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 text-white border-emerald-400/80 ring-2 ring-emerald-400/40' 
                      : 'bg-white hover:border-blue-400 border-slate-200 text-slate-800'
                  }`}
                >
                  {/* Top Status & Category Badges */}
                  <div>
                    <div className="flex items-center justify-between w-full mb-1.5">
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg shadow-2xs ${
                        isFinished
                          ? 'bg-white/20 text-white border border-white/30'
                          : isFemale 
                          ? 'bg-pink-100 text-pink-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isFemale ? 'إناث' : 'ذكور'}
                      </span>
                      
                      {isFinished ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-black bg-white text-emerald-900 px-2 py-0.5 rounded-full shadow-2xs animate-pulse">
                          <Check className="w-2.5 h-2.5 text-emerald-700 stroke-[3]" />
                          <span>منتهي</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400 font-bold">{cat.distance}</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 my-1">
                      <span className="text-base">{cat.icon}</span>
                      <span className={`text-xs font-black truncate block ${isFinished ? 'text-white' : 'text-slate-900 group-hover:text-blue-600'}`}>
                        {cat.titleAr}
                      </span>
                    </div>
                  </div>

                  {/* Participants Auto Stats from Database */}
                  <div className={`mt-2 pt-2 border-t flex flex-col gap-1 text-[11px] ${
                    isFinished ? 'border-white/20' : 'border-slate-100'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={isFinished ? 'text-emerald-100 font-medium' : 'text-slate-500 font-medium'}>
                        {isFinished ? 'الواصلون بالمسح:' : 'المسجلون:'}
                      </span>
                      <span className={`font-black px-1.5 py-0.2 rounded-md ${
                        isFinished 
                          ? 'bg-white/25 text-white' 
                          : registeredCount > 0 
                          ? 'bg-blue-50 text-blue-700 font-extrabold' 
                          : 'text-slate-400'
                      }`}>
                        {isFinished ? arrivedCount : registeredCount} عداء
                      </span>
                    </div>

                    {isFinished && registeredCount > 0 && (
                      <div className="flex items-center justify-between text-[10px] text-emerald-200">
                        <span>المسجلون:</span>
                        <span>{registeredCount}</span>
                      </div>
                    )}

                    {/* Action Hint / Link */}
                    <div className="mt-1 flex items-center justify-between pt-1">
                      {isFinished ? (
                        <div className="w-full flex items-center justify-center gap-1 text-[10px] font-black bg-white text-emerald-900 py-1 px-2 rounded-lg shadow-2xs hover:bg-emerald-50 transition-colors">
                          <Trophy className="w-3 h-3 text-amber-600" />
                          <span>عرض النتائج</span>
                        </div>
                      ) : (
                        <div className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 py-1 px-2 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Camera className="w-3 h-3" />
                          <span>بدء المسح</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      )}

      {/* ========================================================================= */}
      {/* 🛠️ ADDITIONAL AUXILIARY APPS SUITE (تطبيقات مساعدة إضافية) 🛠️ */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              أدوات وتطبيقات مساعدة إضافية في المنظومة
            </h3>
            <p className="text-xs text-slate-500 font-medium">أدوات مساعدة مدمجة لتعزيز كفاءة التنظيم والقرعة والتحكيم</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

          {/* App 1: Bib Scanner (Compact Card) */}
          {!isBibScannerExpanded && (
            <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all group animate-in fade-in zoom-in-95">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <BibScannerAppIcon size={48} />
                  <span className="px-2 py-0.5 text-[10px] font-black bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                    التطبيق الرئيسي
                  </span>
                </div>

                <h4 className="text-sm font-black text-slate-900 mb-1">ماسح الصدريات لخط النهاية (Bib Scanner)</h4>
                <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
                  تطبيق مخصص لقضاة وحكام خط النهاية لمسح أرقام صدريات العدائين بكاميرا الهاتف أو الإدخال اليدوي.
                </p>
              </div>

              <button
                onClick={() => setIsBibScannerExpanded(true)}
                className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer group-hover:scale-102 active:scale-98"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>تشغيل ماسح الصدريات</span>
              </button>
            </div>
          )}

          {/* App 2: Electronic Draw Tool */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shadow-xs">
                  <Shuffle className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 text-[10px] font-black bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                  أداة تفاعلية
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 mb-1">القرعة الإلكترونية وتوزيع المجموعات</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
                توليد قرعة نزيهة وشفافة للفرق والمؤسسات المشاركة في المنافسات المدرسية مع توزيع المجموعات والمسارات عشوائياً.
              </p>
            </div>

            <button
              onClick={() => setActiveSecondaryModal('draw')}
              className="w-full py-2.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>إجراء القرعة الإلكترونية الآن</span>
            </button>
          </div>

          {/* App 3: Stopwatch Pro */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-xs">
                  <Clock className="w-6 h-6" />
                </div>
                <span className="px-2 py-0.5 text-[10px] font-black bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                  ساعة إلكترونية
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 mb-1">ساعة التوقيت الرقمية المتعددة (Stopwatch)</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
                أداة توقيت دقيقة بالميلي ثانية مع تسجيل اللفات (Laps) وأزمنة المتسابقين في سباقات المضمار والميدان.
              </p>
            </div>

            <button
              onClick={() => setActiveSecondaryModal('stopwatch')}
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5" />
              <span>فتح ساعة التوقيت الرقمية</span>
            </button>
          </div>

          {/* App 4: Bib Numbers Generator */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <BibGeneratorAppIcon size={48} />
                <span className="px-2 py-0.5 text-[10px] font-black bg-indigo-100 text-indigo-800 rounded-full border border-indigo-200">
                  مولد الصدريات
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 mb-1">مولد الصدريات الرقمي (Bib Generator)</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
                توليد بطاقات الصدريات للعدائين متضمنة الرمز الشريطي والـ QR جاهزة للطباعة على ورق مقاوم قبل انطلاق السباق.
              </p>
            </div>

            <button
              onClick={() => setActiveSecondaryModal('bib_generator')}
              className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>دخول لمولد الصدريات</span>
            </button>
          </div>

        </div>
      </div>

      {/* Permissions & Security Note Box */}
      <div className="bg-slate-900 text-slate-100 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border border-slate-800">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-800 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-white">إدارة صلاحيات الوصول للتطبيقات المساعدة</h4>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              يمكن للمسؤول المركزي التحكم في الفئات المخولة بالولوج إلى صفحة "تطبيقات مساعدة" (رؤساء اللجان، المسيرين، الأساتذة، أو الحكام) مباشرة عبر نافذة **صلاحيات المستخدمين** في القائمة الجانبية.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ⏱️ MODAL 1: STOPWATCH PRO ⏱️ */}
      {/* ========================================================================= */}
      {activeSecondaryModal === 'stopwatch' && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <Timer className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-black text-slate-900">ساعة التوقيت الرقمية المتعددة</h3>
              </div>
              <button 
                onClick={() => setActiveSecondaryModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Time display */}
            <div className="my-6 py-6 bg-slate-950 text-emerald-400 rounded-2xl font-mono text-4xl sm:text-5xl font-black tracking-wider shadow-inner">
              {formatStopwatch(stopwatchTime)}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={() => setIsStopwatchRunning(!isStopwatchRunning)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 text-white shadow-md transition-all cursor-pointer ${
                  isStopwatchRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isStopwatchRunning ? 'إيقاف مؤقت' : 'انطلاق / تشغيل'}
              </button>

              <button
                onClick={() => {
                  if (stopwatchTime > 0) {
                    setLaps(prev => [stopwatchTime, ...prev]);
                  }
                }}
                disabled={stopwatchTime === 0}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs disabled:opacity-40 cursor-pointer"
              >
                تسجيل لفة (Lap)
              </button>

              <button
                onClick={() => {
                  setIsStopwatchRunning(false);
                  setStopwatchTime(0);
                  setLaps([]);
                }}
                className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl cursor-pointer"
                title="تصفير"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {/* Laps list */}
            {laps.length > 0 && (
              <div className="mt-4 pt-4 border-t border-slate-100 max-h-40 overflow-y-auto space-y-1.5 text-right">
                <span className="text-[10px] font-bold text-slate-400 block mb-1">سجل اللفات:</span>
                {laps.map((lap, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-slate-50 px-3 py-1.5 rounded-lg font-mono">
                    <span className="text-slate-500 font-sans font-bold">اللفة {laps.length - idx}</span>
                    <span className="text-slate-900 font-black">{formatStopwatch(lap)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎲 MODAL 2: ADVANCED ELECTRONIC DRAW & MATCH SCHEDULING TOOL 🎲 */}
      {/* ========================================================================= */}
      {activeSecondaryModal === 'draw' && (
        <ElectronicDrawModal
          isOpen={true}
          onClose={() => setActiveSecondaryModal(null)}
          currentUser={userProfile}
          onMatchesCreated={loadData}
        />
      )}

      {/* ========================================================================= */}
      {/* 🎽 MODAL 3: PDF BIB GENERATOR (2 BIBS PER PAGE MODEL) 🎽 */}
      {/* ========================================================================= */}
      {activeSecondaryModal === 'bib_generator' && (
        <BibGeneratorModal
          isOpen={true}
          onClose={() => setActiveSecondaryModal(null)}
          students={students}
          schools={schools}
        />
      )}

      {/* ========================================================================= */}
      {/* 🏁 THE FINISH LINE SCANNER MODAL (CONNECTED LIVE) 🏁 */}
      {/* ========================================================================= */}
      {selectedCategory && (
        <FinishLineScannerModal
          isOpen={isScannerOpen}
          onClose={() => {
            setIsScannerOpen(false);
            setSelectedCategory(null);
            loadData();
          }}
          initialRaceId={selectedCategory.id}
          existingResults={results}
          onResultsUpdated={loadData}
        />
      )}

      {/* ========================================================================= */}
      {/* 🏆 DIRECT RACE RESULTS MODAL (OPENED WHEN CLICKING FINISHED RACE) 🏆 */}
      {/* ========================================================================= */}
      {resultsCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Top Header */}
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl shadow-xs">
                  🏆
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">نتائج ومنصة تتويج: {resultsCategory.titleAr}</h3>
                    <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded-full border border-emerald-500/30">
                      سباق مكتمل
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    المسافة: {resultsCategory.distance} • الفئة: {resultsCategory.genderLabel}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const cat = resultsCategory;
                    setResultsCategory(null);
                    handleOpenScanner(cat);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  title="فتح ماسح الصدريات لإضافة أو تعديل وصول المتسابقين"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>فتح الماسح</span>
                </button>

                <button
                  onClick={() => setResultsCategory(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Embedded Cross Country Podium View */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50">
              <CrossCountryPodiumView
                results={results}
                onUpdateResult={handleSavePodiumResult}
                onBack={() => setResultsCategory(null)}
                canEdit={userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'TECH_HEAD'}
                activeSeason="2025/2026"
                directorateName="المديرية الإقليمية"
                students={students}
                schools={schools}
                currentUser={userProfile}
                onRefreshData={loadData}
                initialCategoryId={resultsCategory.id}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
