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
import { CrossCountryCategoryResult, School, Student, User } from '../types';
import { DataService } from '../lib/dataService';
import { FinishLineScannerModal } from '../components/FinishLineScannerModal';
import { CrossCountryPodiumView } from '../components/CrossCountryPodiumView';
import { ElectronicDrawModal } from '../components/ElectronicDrawModal';
import { BibGeneratorModal } from '../components/BibGeneratorModal';
import { AthleticsChampionshipModal } from '../components/AthleticsChampionshipModal';
import { AthleticsService } from '../lib/athleticsService';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

// Custom App Icon for "تدبير البطولة المدرسية لألعاب القوى"
export const AthleticsAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 64, className = '' }) => {
  return (
    <div 
      className={`relative rounded-3xl overflow-hidden shadow-lg border border-white/20 flex items-center justify-center select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/30 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <span className="text-2xl sm:text-3xl">🏃‍♂️</span>
      </div>
    </div>
  );
};

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
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<CrossCountryCategoryDef | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [resultsCategory, setResultsCategory] = useState<CrossCountryCategoryDef | null>(null);
  const [isAthleticsModalOpen, setIsAthleticsModalOpen] = useState<boolean>(false);

  // Auxiliary Interactive Tools states
  const [activeSecondaryModal, setActiveSecondaryModal] = useState<'draw' | 'bib_generator' | null>(null);

  // Electronic Draw Tool State
  const [drawPool, setDrawPool] = useState<string[]>([]);
  const [groupsCount, setGroupsCount] = useState<number>(2);
  const [drawnGroups, setDrawnGroups] = useState<{ groupName: string; teams: string[] }[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);

  // Load results, students and schools
  const loadData = async () => {
    try {
      const [ccResults, scList, stList, tcList] = await Promise.all([
        DataService.getCrossCountryResults(),
        DataService.getSchools(),
        DataService.getStudents(),
        DataService.getTeachers()
      ]);
      
      setResults(prev => {
        if (Object.keys(prev).length > 0 && ccResults && Object.keys(ccResults).length > 0) {
           return { ...ccResults, ...prev };
        }
        return ccResults || prev;
      });

      setSchools(prev => scList.length > prev.length ? scList : (prev.length > 0 ? prev : scList));
      setStudents(prev => stList.length > prev.length ? stList.filter(s => s.sportId === 'cross_country') : (prev.length > 0 ? prev : stList.filter(s => s.sportId === 'cross_country')));
      setTeachers(tcList || []);
      
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
      {/* 🛠️ AUXILIARY APPS SUITE (أدوات وتطبيقات مساعدة في المنظومة) 🛠️ */}
      {/* ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              أدوات وتطبيقات مساعدة في المنظومة
            </h3>
            <p className="text-xs text-slate-500 font-medium">أدوات مساعدة مدمجة لتعزيز كفاءة التنظيم والقرعة والتحكيم وألعاب القوى</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* App 1: Athletics Championship Manager (Featured New App) */}
          <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-rose-500/10 border-2 border-amber-500/40 rounded-3xl p-5 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-amber-500 transition-all group">
            <div>
              <div className="flex items-center justify-between mb-3">
                <AthleticsAppIcon size={48} />
                <span className="px-2.5 py-0.5 text-[10px] font-black bg-gradient-to-r from-amber-500 to-rose-600 text-white rounded-full shadow-xs">
                  جديد • ألعاب القوى
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 dark:text-white mb-1">
                تدبير البطولة المدرسية لألعاب القوى
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium mb-3">
                إدارة لجان ألعاب القوى الخمس (بما فيها لجنة التتويج)، ضبط الصلاحيات والأزرار لكل لجنة، تسجيل المشاركين، والميقاتي الذكي للسباقات والقفز والجلة.
              </p>

              <div className="flex flex-wrap gap-1 mb-4">
                <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-bold">5 لجان + التتويج</span>
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-900 rounded text-[10px] font-bold">ضبط الصلاحيات</span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[10px] font-bold">تسجيل المشاركين</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAthleticsModalOpen(true)}
                className="flex-1 py-2.5 px-3 bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 hover:from-amber-600 hover:to-rose-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/25 cursor-pointer active:scale-98"
              >
                <Trophy className="w-3.5 h-3.5" />
                <span>دخول للتطبيق</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const res = AthleticsService.loadDefaultMockData();
                  toast.success(`تم تحميل البيانات الافتراضية لألعاب القوى (${res.participantsCount} مشارك و${res.committeesCount} لجان)`);
                  setIsAthleticsModalOpen(true);
                }}
                className="py-2.5 px-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-900 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-98"
                title="تحميل بيانات افتراضية نموذجية وفتح التطبيق"
              >
                <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                <span className="hidden sm:inline">بيانات افتراضية</span>
              </button>
            </div>
          </div>

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

              <h4 className="text-sm font-black text-slate-900 mb-1">القرعة الإلكترونية وبرمجة المباريات</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium mb-4">
                فلترة البطولات حسب الرياضات الجماعية، إجراء القرعة التلقائية وتحديد مواعيد وملاعب وحكام المباريات.
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

          {/* App 3: Bib Numbers Generator */}
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

          {/* App 4: Bib Scanner App Card (Restored) */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all">
            <div>
              <div className="flex items-center justify-between mb-3">
                <BibScannerAppIcon size={48} />
                <span className="px-2 py-0.5 text-[10px] font-black bg-blue-100 text-blue-800 rounded-full border border-blue-200">
                  ماسح خط النهاية
                </span>
              </div>

              <h4 className="text-sm font-black text-slate-900 mb-1">ماسح الصدريات لخط النهاية</h4>
              <p className="text-xs text-slate-500 leading-relaxed font-medium mb-3">
                تطبيق مخصص لقضاة وحكام خط النهاية لمسح أرقام صدريات العدائين بكاميرا الهاتف أو الإدخال اليدوي، مع تسجيل دقيق للأزمنة والترتيب.
              </p>

              <div className="flex flex-wrap gap-1 mb-4">
                <span className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px] font-bold">
                  {totalArrived} وصول مسجل
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded text-[10px] font-bold">
                  {completedRaces} من 8 سباقات
                </span>
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-[10px] font-bold">
                  مسح QR & كاميرا
                </span>
              </div>
            </div>

            <button
              onClick={() => handleOpenScanner(CROSS_COUNTRY_CATEGORIES[0])}
              className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>تشغيل ماسح الصدريات</span>
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

      {/* ========================================================================= */}
      {/* 🏃‍♂️ MODAL: ATHLETICS CHAMPIONSHIP MANAGER (تدبير بطولة ألعاب القوى) 🏃‍♂️ */}
      {/* ========================================================================= */}
      {isAthleticsModalOpen && (
        <AthleticsChampionshipModal
          isOpen={isAthleticsModalOpen}
          onClose={() => setIsAthleticsModalOpen(false)}
          teachers={teachers}
          schools={schools}
          students={students}
          currentUser={userProfile}
          directorateName={userProfile?.directorateName || "المديرية الإقليمية"}
          season="2026/2027"
        />
      )}
    </div>
  );
};
