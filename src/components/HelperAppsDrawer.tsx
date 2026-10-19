import React from 'react';
import {
  X,
  Printer,
  Camera,
  Shuffle,
  Trophy,
  Play,
  Sparkles,
  ChevronLeft,
  Boxes,
  HelpCircle
} from 'lucide-react';
import { AthleticsAppIcon, BibScannerAppIcon } from '../pages/HelperApps';

// Custom App Icon for "إعداد صدريات ألعاب القوى"
export const AthleticsBibAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 48, className = '' }) => {
  return (
    <div 
      className={`relative rounded-2xl overflow-hidden shadow-md border border-white/20 flex items-center justify-center select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #ea580c 0%, #d97706 50%, #b45309 100%)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-black/30 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <span className="text-xl sm:text-2xl">🎽</span>
      </div>
    </div>
  );
};

// Custom App Icon for "مولد الصدريات الرقمي للعدو الريفي"
export const BibGeneratorAppIcon: React.FC<{ size?: number; className?: string }> = ({ size = 48, className = '' }) => {
  return (
    <div 
      className={`relative rounded-2xl overflow-hidden shadow-md border border-white/20 flex items-center justify-center select-none shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 50%, #06b6d4 100%)',
      }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/30 pointer-events-none" />
      <div className="relative z-10 flex flex-col items-center justify-center">
        <span className="text-xl sm:text-2xl">🏷️</span>
      </div>
    </div>
  );
};

interface HelperAppsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAthleticsChampionship: () => void;
  onOpenAthleticsBib: () => void;
  onOpenFinishLineScanner: () => void;
  onOpenBibGenerator: () => void;
  onOpenElectronicDraw: () => void;
  onOpenCrossCountryPodium: () => void;
  onReplayIntro: () => void;
}

export const HelperAppsDrawer: React.FC<HelperAppsDrawerProps> = ({
  isOpen,
  onClose,
  onOpenAthleticsChampionship,
  onOpenAthleticsBib,
  onOpenFinishLineScanner,
  onOpenBibGenerator,
  onOpenElectronicDraw,
  onOpenCrossCountryPodium,
  onReplayIntro
}) => {
  if (!isOpen) return null;

  const appItems = [
    {
      id: 'athletics_championship',
      title: 'تدبير ألعاب القوى المدرسية',
      description: 'إدارة مسابقات الجري والميدان، برمجة السلاسل، الماسح الذكي والميقاتي الآلي.',
      icon: <AthleticsAppIcon size={46} />,
      badge: 'البطولة الرسمية',
      badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300',
      action: onOpenAthleticsChampionship,
      buttonColor: 'bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-orange-500/20'
    },
    {
      id: 'athletics_bib',
      title: 'إعداد صدريات ألعاب القوى',
      description: 'توليد وطباعة صدريات المتسابقين مخصصة بالمسابقة (جري • قفز • رمي) مع QR.',
      icon: <AthleticsBibAppIcon size={46} />,
      badge: 'ألعاب القوى',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
      action: onOpenAthleticsBib,
      buttonColor: 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-700 hover:to-rose-700 text-white shadow-amber-500/20'
    },
    {
      id: 'scanner',
      title: 'ماسح الصدريات لخط النهاية',
      description: 'مسح صدريات العدائين بكاميرا الهاتف أو الإدخال اليدوي مع تسجيل الأزمنة والترتيب.',
      icon: <BibScannerAppIcon size={46} />,
      badge: 'توقيت فوري',
      badgeClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300',
      action: onOpenFinishLineScanner,
      buttonColor: 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20'
    },
    {
      id: 'bib_generator',
      title: 'مولد صدريات العدو الريفي',
      description: 'توليد صدريات العدو متضمنة الباركود والـ QR جاهزة للطباعة بجودة عالية.',
      icon: <BibGeneratorAppIcon size={46} />,
      badge: 'طباعة A4/A5',
      badgeClass: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300',
      action: onOpenBibGenerator,
      buttonColor: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
    },
    {
      id: 'draw',
      title: 'القرعة الإلكترونية والمباريات',
      description: 'إجراء القرعة التلقائية للرياضات الجماعية وتحديد الملاعب والحكام.',
      icon: (
        <div className="w-[46px] h-[46px] rounded-2xl bg-amber-500 text-white flex items-center justify-center text-xl shadow-md">
          <Shuffle className="w-6 h-6" />
        </div>
      ),
      badge: 'قرعة آلية',
      badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300',
      action: onOpenElectronicDraw,
      buttonColor: 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
    },
    {
      id: 'cc_podium',
      title: 'منصة تتويج العدو الريفي',
      description: 'عرض الفائزين الأوائل في كافة الفئات العمرية والترتيب الجماعي للمؤسسات.',
      icon: (
        <div className="w-[46px] h-[46px] rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-md">
          <Trophy className="w-6 h-6" />
        </div>
      ),
      badge: 'منصة الشرف',
      badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300',
      action: onOpenCrossCountryPodium,
      buttonColor: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" dir="rtl">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Slide-over Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
          
          {/* Header Bar */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                  <span>قائمة التطبيقات والأدوات الذكية</span>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                </h3>
                <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                  التشغيل الفوري للأدوات الميدانية والحكام
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer active:scale-95"
              title="إغلاق القائمة"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action: Replay Intro Banner */}
          <div className="px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-b border-amber-200/60 dark:border-amber-800/60 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-lg">🎬</span>
              <div className="min-w-0">
                <p className="text-xs font-black text-amber-900 dark:text-amber-200 truncate">الدخلة الرياضية الترحيبية</p>
                <p className="text-[10px] text-amber-700 dark:text-amber-400 truncate">أنيميشن رياضي للمسابقات</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onReplayIntro();
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black flex items-center gap-1 shadow-xs transition-all cursor-pointer shrink-0 active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>تشغيل الدخلة</span>
            </button>
          </div>

          {/* App Cards List */}
          <div className="p-4 overflow-y-auto flex-1 space-y-3 bg-slate-50/70 dark:bg-slate-950/50">
            <p className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">
              التطبيقات المتاحة للتشغيل المباشر
            </p>

            {appItems.map((app) => (
              <div
                key={app.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-all space-y-3"
              >
                <div className="flex items-start gap-3">
                  {app.icon}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 truncate">
                        {app.title}
                      </h4>
                      <span className={`px-2 py-0.5 text-[9px] font-black rounded-full whitespace-nowrap ${app.badgeClass}`}>
                        {app.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium mt-1">
                      {app.description}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    app.action();
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98 ${app.buttonColor}`}
                >
                  <span>تشغيل التطبيق الآن</span>
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Footer Note */}
          <div className="p-3 bg-slate-100 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 text-center shrink-0">
            <p className="text-[10px] text-slate-500 dark:text-slate-400">
              جميع التطبيقات متزامنة تلقائياً مع قاعدة بيانات البطولة والنتائج الفورية.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
