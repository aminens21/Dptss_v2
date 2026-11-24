import React, { useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  Building2,
  Users,
  CheckCircle2,
  Trash2,
  Loader2,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { School, Student, Tournament, User } from '../types';
import {
  clearGeneratedCrossCountryDemoParticipants,
  CrossCountryDemoResult,
  generateCrossCountryDemoForSchools,
  getEligibleCrossCountrySchools,
  getSchoolCycleLevel
} from '../lib/crossCountryDemoGenerator';
import toast from 'react-hot-toast';

interface CrossCountryDemoModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  teachers: User[];
  allStudents: Student[];
  tournaments: Tournament[];
  activeSeason: string;
  activeDirectorateId: string;
  currentUser?: User | null;
  onSuccess: () => void;
}

type DensityPreset = 'balanced' | 'full' | 'team_only' | 'compact';

const PRESET_MAP: Record<DensityPreset, { team: number; indiv: number; label: string; desc: string }> = {
  balanced: {
    team: 5,
    indiv: 2,
    label: 'مشاركة متوازنة (5 فريق + 2 فردي)',
    desc: '7 عدائين في كل فئة مناسبة للمؤسسة (يضمن تأهيل الفريق + مشاركات فردية)'
  },
  full: {
    team: 5,
    indiv: 3,
    label: 'الحد الأقصى القانوني (5 فريق + 3 فردي)',
    desc: '8 عدائين في كل فئة مناسبة للمؤسسة وفق السقف القانوني الكامل'
  },
  team_only: {
    team: 5,
    indiv: 0,
    label: 'فرق المؤسسات فقط (5 عدائين/فئة)',
    desc: 'توليد فريق مؤسسة مكتمل من 5 عدائين في كل فئة'
  },
  compact: {
    team: 4,
    indiv: 1,
    label: 'عينة سريعة (4 فريق + 1 فردي)',
    desc: '5 عدائين في كل فئة مناسبة لتجربة سريعة وخفيفة'
  }
};

export const CrossCountryDemoModal: React.FC<CrossCountryDemoModalProps> = ({
  isOpen,
  onClose,
  schools,
  teachers,
  allStudents,
  tournaments,
  activeSeason,
  activeDirectorateId,
  currentUser,
  onSuccess
}) => {
  const [preset, setPreset] = useState<DensityPreset>('balanced');
  const [schoolFilter, setSchoolFilter] = useState<'all' | 'only_empty'>('all');
  const [affiliationMode, setAffiliationMode] = useState<'auto' | 'non_club' | 'club_affiliated'>('auto');
  const [autoConfirmSchools, setAutoConfirmSchools] = useState(true);
  const [includePrimaryU15, setIncludePrimaryU15] = useState(false);
  const [ignoreTournamentFilters, setIgnoreTournamentFilters] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [resultSummary, setResultSummary] = useState<CrossCountryDemoResult | null>(null);

  const eligibleSchools = useMemo(
    () => getEligibleCrossCountrySchools(schools, tournaments, ignoreTournamentFilters),
    [schools, tournaments, ignoreTournamentFilters]
  );

  const stats = useMemo(() => {
    let primary = 0;
    let middle = 0;
    let high = 0;
    eligibleSchools.forEach(s => {
      const cycle = getSchoolCycleLevel(s);
      if (cycle === 'Primary') primary++;
      else if (cycle === 'Middle') middle++;
      else high++;
    });

    const ccStudents = allStudents.filter(s => s.sportId === 'cross_country');
    const demoGeneratedCount = ccStudents.filter(s => s.isDemoGenerated === true).length;

    return {
      totalSchools: schools.length,
      eligibleCount: eligibleSchools.length,
      primary,
      middle,
      high,
      existingCcCount: ccStudents.length,
      demoGeneratedCount
    };
  }, [schools.length, eligibleSchools, allStudents]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (eligibleSchools.length === 0) {
      toast.error('لا توجد مؤسسات تعليمية مؤهلة متاحة في المنصة حالياً');
      return;
    }

    setIsGenerating(true);
    setConfirmClear(false);
    setResultSummary(null);
    const toastId = toast.loading('جاري توليد بيانات المشاركين للمؤسسات في بطولة العدو الريفي...');
    try {
      const counts = PRESET_MAP[preset];
      const res = await generateCrossCountryDemoForSchools({
        schools,
        teachers,
        existingStudents: allStudents,
        tournaments,
        activeSeason,
        activeDirectorateId,
        teamCountPerCat: counts.team,
        individualCountPerCat: counts.indiv,
        affiliationMode,
        includePrimaryU15,
        includeMiddleU18: false,
        schoolFilter,
        ignoreTournamentFilters,
        autoConfirmSchools,
        currentUser
      });

      setResultSummary(res);
      toast.dismiss(toastId);
      if (res.createdStudentsCount > 0) {
        toast.success(
          `تم توليد ${res.createdStudentsCount} مشارك(ة) لـ ${res.affectedSchoolsCount} مؤسسة بنجاح!`
        );
        onSuccess();
      } else {
        toast('جميع المؤسسات المؤهلة مستوفية للحصة المحددة مسبقاً.', { icon: 'ℹ️' });
      }
    } catch (err) {
      console.error('Error generating CC demo participants:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء توليد بيانات المشاركين الافتراضية');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleClearDemoOnly = async () => {
    setIsClearing(true);
    const toastId = toast.loading('جاري حذف المشاركين الافتراضيين المولدين فقط...');
    try {
      const removed = await clearGeneratedCrossCountryDemoParticipants(allStudents);
      toast.dismiss(toastId);
      toast.success(`تم حذف ${removed} مشارك(ة) افتراضي بنجاح مع الإبقاء على المشاركين الحقيقيين.`);
      setConfirmClear(false);
      setResultSummary(null);
      onSuccess();
    } catch (err) {
      console.error('Error clearing demo CC participants:', err);
      toast.dismiss(toastId);
      toast.error('تعذر حذف البيانات الافتراضية');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 bg-gradient-to-l from-indigo-900 via-blue-900 to-slate-900 text-white flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6 text-amber-300" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-300/30 text-[10px] font-black text-amber-200 mb-1">
                <ShieldAlert className="w-3 h-3" />
                <span>أداة المسير المركزي فقط</span>
              </div>
              <h2 className="text-base sm:text-lg font-black leading-snug">
                توليد بيانات افتراضية لمشاركي العدو الريفي
              </h2>
              <p className="text-[11px] text-blue-200/90 font-medium mt-0.5">
                تعبئة تلاميذ وتلميذات للمؤسسات التعليمية الموجودة فعلياً في المنصة • الموسم {activeSeason}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-700">
          {/* Platform Schools Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200">
              <div className="text-[10px] font-bold text-blue-700 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                <span>المؤسسات المؤهلة</span>
              </div>
              <div className="text-lg font-black text-blue-950 mt-0.5">
                {stats.eligibleCount} <span className="text-[10px] font-bold text-blue-700">/ {stats.totalSchools}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-600">توزيع الأسلاك</div>
              <div className="text-[11px] font-black text-slate-900 mt-1 space-x-reverse space-x-1">
                <span>إ: {stats.primary}</span>
                <span>• ع: {stats.middle}</span>
                <span>• ت: {stats.high}</span>
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                <span>المسجلون حالياً</span>
              </div>
              <div className="text-lg font-black text-emerald-950 mt-0.5">
                {stats.existingCcCount}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
              <div className="text-[10px] font-bold text-amber-800">المولّدون افتراضياً</div>
              <div className="text-lg font-black text-amber-950 mt-0.5">
                {stats.demoGeneratedCount}
              </div>
            </div>
          </div>

          {/* Preset Selection */}
          <div className="space-y-2">
            <label className="block font-black text-slate-900 text-xs">
              1. كثافة التوليد لكل فئة عمرية مناسبة للمؤسسة:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(Object.keys(PRESET_MAP) as DensityPreset[]).map((key) => {
                const item = PRESET_MAP[key];
                const isSelected = preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setPreset(key)}
                    className={`p-3 rounded-2xl border text-right transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-black text-slate-900 text-xs flex items-center justify-between">
                      <span>{item.label}</span>
                      {isSelected && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-medium leading-relaxed">
                      {item.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Schools & Affiliation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block font-black text-slate-900 text-xs">
                2. نطاق المؤسسات المستهدفة:
              </label>
              <select
                value={schoolFilter}
                onChange={(e) => setSchoolFilter(e.target.value as 'all' | 'only_empty')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">جميع المؤسسات المؤهلة (استكمال السقف)</option>
                <option value="only_empty">المؤسسات التي لا تضم مشاركين بعد فقط</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block font-black text-slate-900 text-xs">
                3. صنف الترخيص (الانتماء):
              </label>
              <select
                value={affiliationMode}
                onChange={(e) => setAffiliationMode(e.target.value as 'auto' | 'non_club' | 'club_affiliated')}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="auto">تلقائي حسب برمجة البطولة</option>
                <option value="non_club">غير منتمين للأندية (مدرسي)</option>
                <option value="club_affiliated">منتمين للأندية</option>
              </select>
            </div>
          </div>

          {/* Extra Toggles */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoConfirmSchools}
                onChange={(e) => setAutoConfirmSchools(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-black text-slate-900">تأكيد مشاركة المؤسسات تلقائياً</span>
                <p className="text-[10px] text-slate-500">
                  تظهر المؤسسات كمؤكدة رسمياً في جداول المشاركة والـ PDF والإحصائيات.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includePrimaryU15}
                onChange={(e) => setIncludePrimaryU15(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-slate-800">تضمين فئة الصغار/الصغيرات لمؤسسات الابتدائي أيضاً</span>
                <p className="text-[10px] text-slate-500">
                  بشكل افتراضي يُسجل تلاميذ الابتدائي في فئة البراعم/البرعمات، ويمكن تفعيل هذا الخيار لإضافة الصغار/الصغيرات.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ignoreTournamentFilters}
                onChange={(e) => setIgnoreTournamentFilters(e.target.checked)}
                className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="font-bold text-slate-800">شمول كافة مؤسسات المنصة ({schools.length}) دون تقييد</span>
                <p className="text-[10px] text-slate-500">
                  يتجاوز قيود الأسلاك أو القطاع المحددة في البطولة المبرمجة إن أردت اختبار جميع المؤسسات.
                </p>
              </div>
            </label>
          </div>

          {/* Result Banner */}
          {resultSummary && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 space-y-1 animate-in fade-in duration-200">
              <div className="font-black flex items-center gap-1.5 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>تم توليد البيانات الافتراضية بنجاح!</span>
              </div>
              <p className="text-xs font-bold text-emerald-800">
                • إجمالي المشاركين الجدد: {resultSummary.createdStudentsCount} عداء(ة)
                <br />• عدد المؤسسات المزودة بالمشاركين: {resultSummary.affectedSchoolsCount} مؤسسة
                {autoConfirmSchools && (
                  <>
                    <br />• تم تأكيد مشاركة: {resultSummary.confirmedSchoolsCount} مؤسسة تلقائياً
                  </>
                )}
              </p>
            </div>
          )}

          {/* Clear Demo Only Section */}
          {stats.demoGeneratedCount > 0 && (
            <div className="p-3 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-rose-900">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="text-[11px] font-bold">
                  يوجد حالياً <strong>{stats.demoGeneratedCount}</strong> مشارك(ة) مولد افتراضياً (يمكن حذفهم دون المساس بالمسجلين الحقيقيين).
                </span>
              </div>
              {confirmClear ? (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleClearDemoOnly}
                    disabled={isClearing}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-[11px] cursor-pointer disabled:opacity-50"
                  >
                    {isClearing ? 'جاري الحذف...' : 'تأكيد الحذف'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 font-bold text-[11px] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 font-black text-[11px] flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف الافتراضيين فقط</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs cursor-pointer"
          >
            إغلاق
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || isClearing || eligibleSchools.length === 0}
            className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-blue-600 to-emerald-600 hover:from-indigo-700 hover:to-emerald-700 text-white font-black text-xs shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التوليد...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>توليد البيانات الافتراضية ({eligibleSchools.length} مؤسسة)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
