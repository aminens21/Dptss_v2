import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Trophy,
  Building2,
  Users,
  Calendar,
  Medal,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Loader2,
  Flame,
  Printer,
  Shuffle
} from 'lucide-react';
import { DemoDataService, DemoDataCounts } from '../lib/demoDataGenerator';
import toast from 'react-hot-toast';

interface DemoDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDirectorateId: string;
  activeDirectorateName?: string;
  activeSeason: string;
  onDataLoaded: () => void;
}

export const DemoDataModal: React.FC<DemoDataModalProps> = ({
  isOpen,
  onClose,
  activeDirectorateId,
  activeDirectorateName = 'المديرية الإقليمية',
  activeSeason,
  onDataLoaded
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [resultCounts, setResultCounts] = useState<DemoDataCounts | null>(null);

  if (!isOpen) return null;

  const handlePopulate = async () => {
    setIsLoading(true);
    setResultCounts(null);
    try {
      const counts = await DemoDataService.populateDemoData(
        activeDirectorateId,
        activeSeason,
        overwrite
      );
      setResultCounts(counts);
      toast.success('تمت تعبئة البيانات التجريبية بنجاح! تم تحديث المنصة.');
      onDataLoaded();
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تعبئة البيانات التجريبية');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف البيانات التجريبية فقط؟')) {
      return;
    }
    setIsClearing(true);
    try {
      await DemoDataService.clearDirectorateData(activeDirectorateId);
      toast.success('تم حذف البيانات التجريبية بنجاح.');
      setResultCounts(null);
      onDataLoaded();
    } catch (e) {
      console.error(e);
      toast.error('تعذر حذف البيانات التجريبية');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="relative p-6 pb-5 bg-gradient-to-l from-emerald-600 via-teal-600 to-indigo-700 text-white flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white shadow-inner shrink-0">
              <Sparkles className="h-6 w-6 text-emerald-200 animate-pulse" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-xs font-semibold text-emerald-100 mb-1">
                <Flame className="h-3 w-3" />
                <span>بيئة الاختبار والتجربة السريعة</span>
              </div>
              <h2 className="text-xl font-black tracking-tight">
                تعبئة بيانات تجريبية لاختبار التطبيق
              </h2>
              <p className="text-xs text-emerald-100/90 font-medium mt-0.5">
                {activeDirectorateName} • الموسم الدراسي {activeSeason}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-700 text-sm">
          {/* Explanation Alert */}
          <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 text-emerald-900 text-xs leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-2 text-emerald-950 text-sm">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>ماذا سيتم إنشاؤه عند النقر على هذا الزر؟</span>
            </div>
            <p className="text-slate-600">
              يقوم هذا الزر بضخ حزمة متكاملة من البيانات الواقعية في ثوانٍ معدودة، مما يمكنك من اختبار كافة وظائف المنصة دون الحاجة لإدخال يدوي طويل:
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 shrink-0">
                <Trophy className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">7 بطولات مبرمجة</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  كرة القدم (صغار وفتيان)، السلة، اليد، الطائرة، العدو الريفي، وكرة الطاولة مع تواريخ ومسؤولين.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">24+ تلميذ ورياضي</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  أرقام مسار نظامية، فئات عمرية صحيحة (U12/U15/U18)، مجهزة لطباعة الصدريات ولوائح المؤسسات.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">6 مؤسسات و5 ملاعب</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  ثانويات تأهيلية، إعداديات، وابتدائي، مع القاعة المغطاة، الملعب البلدي، ومطاف العدو الريفي.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 shrink-0">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">مباريات مجدولة ونتائج</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  مباريات منتهية بأهداف وهدافين، مباريات جارية بنتيجة مباشرة، ومباريات مبرمجة بالمواعيد.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/70 flex items-start gap-3 sm:col-span-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 shrink-0">
                <Medal className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs">منصات تتويج ونتائج العدو الريفي</h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  سجل متكامل للرتب 1، 2، 3 مع التوقيتات وأرقام الصدريات (101، 102...) لتجربة شاشة النتائج والماسح.
                </p>
              </div>
            </div>
          </div>

          {/* Test suggestions shortcuts */}
          <div className="p-3 bg-slate-100/70 rounded-2xl border border-slate-200 text-xs space-y-1.5">
            <div className="font-bold text-slate-800">💡 ماذا يمكنك اختباره مباشرة بعد التعبئة؟</div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 text-[11px] pr-1">
              <li>
                <span className="font-semibold text-indigo-700">طباعة الصدريات (PDF):</span> تجربة المقاسات الجديدة واختيار 6 صدريات في الصفحة بنمط القص مع الباركود ورقم الصدرية.
              </li>
              <li>
                <span className="font-semibold text-amber-700">القرعة وتحديد المواعيد:</span> فتح نافذة القرعة الإلكترونية وسحب مجموعات الفرق المدرسية وجدولة المباريات آلياً.
              </li>
              <li>
                <span className="font-semibold text-emerald-700">النتائج والترتيب:</span> استعراض المباريات المكتملة وشجرة المنافسة ولوحة الترتيب العام.
              </li>
            </ul>
          </div>

          {/* Overwrite option */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-700 select-none">
              <input
                type="checkbox"
                checked={overwrite}
                onChange={e => setOverwrite(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded-md border-slate-300 focus:ring-emerald-500"
              />
              <span className="font-medium">
                تنظيف البيانات السابقة الخاصة بالمديرية قبل التعبئة (تهيئة نظيفة)
              </span>
            </label>
          </div>

          {/* Success summary if just seeded */}
          {resultCounts && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs animate-in fade-in space-y-1">
              <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>تم تحديث قاعدة البيانات بالبيانات التجريبية:</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 font-semibold text-slate-700">
                <div className="p-2 rounded-lg bg-white border border-emerald-100">
                  🏆 {resultCounts.tournamentsCount} بطولات
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-100">
                  🏫 {resultCounts.schoolsCount} مؤسسات
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-100">
                  🏃‍♂️ {resultCounts.studentsCount} رياضيين
                </div>
                <div className="p-2 rounded-lg bg-white border border-emerald-100">
                  ⚽ {resultCounts.matchesCount} مباريات
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 px-6 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleClear}
            disabled={isClearing || isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            title="حذف البيانات التجريبية فقط"
          >
            {isClearing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span>حذف البيانات التجريبية</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={isLoading || isClearing}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              onClick={handlePopulate}
              disabled={isLoading || isClearing}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-black text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جارٍ التعبئة وتحديث المنصة...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 text-emerald-200" />
                  <span>تأكيد تعبئة البيانات التجريبية</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
