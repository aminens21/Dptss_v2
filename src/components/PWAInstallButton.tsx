import React, { useState } from 'react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Download, Smartphone, Share, PlusSquare, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

export const PWAInstallButton: React.FC<{
  variant?: 'navbar' | 'sidebar' | 'banner' | 'card';
  className?: string;
}> = ({ variant = 'navbar', className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed, show subtle installed badge or nothing
  if (isInstalled) {
    if (variant === 'sidebar') {
      return (
        <div className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-xl border border-emerald-200">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>التطبيق مثبت على جهازك</span>
        </div>
      );
    }
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSGuide(true);
      return;
    }

    if (isInstallable) {
      const success = await install();
      if (success) {
        toast.success('🎉 تم تثبيت التطبيق بنجاح على هاتفك!');
      }
    } else {
      setShowIOSGuide(true);
    }
  };

  return (
    <>
      {variant === 'navbar' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-sm active:scale-95 transition-all cursor-pointer ${className}`}
          title="تثبيت التطبيق على الهاتف لتلقي الإشعارات"
        >
          <Smartphone className="w-3.5 h-3.5 text-amber-300" />
          <span className="hidden sm:inline">تثبيت التطبيق على الهاتف</span>
          <span className="sm:hidden">تثبيت التطبيق</span>
        </button>
      )}

      {variant === 'sidebar' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-emerald-800/60 hover:bg-emerald-800 text-emerald-100 hover:text-white border border-emerald-700/50 rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer ${className}`}
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-emerald-300" />
            <span>تثبيت التطبيق على الهاتف</span>
          </div>
          <Download className="w-3.5 h-3.5 text-emerald-300" />
        </button>
      )}

      {variant === 'banner' && (
        <div className={`bg-gradient-to-r from-slate-900 via-emerald-950 to-teal-950 text-white p-3 sm:p-4 rounded-2xl border border-emerald-800/60 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 ${className}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0 text-emerald-300">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                <span>تثبيت تطبيق المنصة على الهاتف (PWA)</span>
                <span className="bg-emerald-500 text-slate-950 text-[10px] font-black px-2 py-0.2 rounded-full">
                  إشعارات فورية
                </span>
              </h4>
              <p className="text-[11px] text-emerald-200/80 mt-0.5">
                ثبت المنصة على شاشة هاتفك لتصلك إشعارات المباريات فوراً وتنبيهات اللجن التقنية حتى عند إغلاق المتصفح.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleInstallClick}
            className="w-full sm:w-auto px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>تثبيت الآن على الهاتف</span>
          </button>
        </div>
      )}

      {/* iOS & Manual Install Modal Guide */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-100" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">تثبيت التطبيق على هاتفك</h3>
                  <p className="text-[11px] text-slate-500">طريقة التثبيت السريعة على الشاشة الرئيسية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isIOS ? (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">لتثبيت التطبيق على جهاز <strong>iPhone / iPad</strong> في ثوانٍ:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                    <div>
                      <p className="font-bold text-slate-800">اضغط على زر المشاركة (Share)</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        أيقونة المربع مع السهم <Share className="w-3.5 h-3.5 text-blue-600 inline" /> في أسفل شاشة Safari.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                    <div>
                      <p className="font-bold text-slate-800">اختر "إضافة إلى الشاشة الرئيسية"</p>
                      <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <PlusSquare className="w-3.5 h-3.5 text-emerald-600 inline" /> "Add to Home Screen".
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">3</span>
                    <div>
                      <p className="font-bold text-slate-800">اضغط "إضافة" (Add)</p>
                      <p className="text-[11px] text-slate-500">سيظهر التطبيق فوراً كأيقونة على شاشة هاتفك مع تفعيل الإشعارات.</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <p className="text-slate-600">لتثبيت التطبيق على جهاز <strong>Android أو الحاسوب</strong>:</p>
                <div className="space-y-2">
                  <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                    <div>
                      <p className="font-bold text-slate-800">افتح قائمة المتصفح (⋮)</p>
                      <p className="text-[11px] text-slate-500">في أعلى يمين أو يسار متصفح Chrome.</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-black flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                    <div>
                      <p className="font-bold text-slate-800">اختر "تثبيت التطبيق" أو "إضافة إلى الشاشة الرئيسية"</p>
                      <p className="text-[11px] text-slate-500">"Install App" أو "Add to Home Screen".</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                فهمت ذلك، شكراً!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
