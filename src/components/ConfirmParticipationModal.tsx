import React, { useState, useMemo, useEffect } from 'react';
import { Sport, Tournament, SchoolTournamentConfirmation, TARGET_AFFILIATIONS } from '../types';
import {
  DataService,
  ConfirmedBranchTuple,
  getEffectiveConfirmedBranches,
  formatBranchLabelAr,
  getGenderSpecificCategoryTitle,
  getCustomCategoryName,
  getCategoryShortName,
  normalizeCategoryKey
} from '../lib/dataService';
import { CountdownTimer } from './CountdownTimer';
import { ConfirmedParticipationBadge } from './ConfirmedParticipationBadge';
import {
  X,
  Building,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  Phone,
  Sparkles,
  ArrowRight,
  Trash2,
  CheckSquare,
  Square,
  Layers,
  Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ConfirmParticipationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | { id: string; name: string; icon?: string; ageCategories?: string[]; customAgeCategories?: any[]; targetAffiliations?: string[] };
  tournaments?: Tournament[];
  schoolName: string;
  schoolId?: string;
  teacherId?: string;
  teacherName?: string;
  teacherPhone?: string;
  teacherLeaseNumber?: string;
  registrationDeadline?: any;
  confirmedRecord?: SchoolTournamentConfirmation | null;
  onConfirmSuccess?: () => void;
  onCancelSuccess?: () => void;
  onProceedToRegister?: () => void;
}

interface BranchOptionItem {
  key: string;
  category: string;
  categoryName: string;
  years: string;
  gender: 'Male' | 'Female';
  affiliationType: string;
}

export const ConfirmParticipationModal: React.FC<ConfirmParticipationModalProps> = ({
  isOpen,
  onClose,
  sport,
  tournaments: propTournaments,
  schoolName,
  schoolId,
  teacherId,
  teacherName,
  teacherPhone,
  teacherLeaseNumber,
  registrationDeadline,
  confirmedRecord,
  onConfirmSuccess,
  onCancelSuccess,
  onProceedToRegister
}) => {
  const isConfirmed = !!confirmedRecord && confirmedRecord.status === 'confirmed';
  const [isEditingExisting, setIsEditingExisting] = useState(false);
  const [confirmCancelStep, setConfirmCancelStep] = useState(false);
  const [loadedTournaments, setLoadedTournaments] = useState<Tournament[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    if (propTournaments && propTournaments.length > 0) {
      setLoadedTournaments(propTournaments);
      return;
    }
    let mounted = true;
    DataService.getTournaments().then(list => {
      if (mounted) {
        setLoadedTournaments((list || []).filter(t => t.sportId === sport.id && t.status !== 'Archived' && t.status !== 'Draft'));
      }
    }).catch(() => {});
    return () => {
      mounted = false;
    };
  }, [isOpen, propTournaments, sport.id]);

  const activeSportTournaments = useMemo(() => {
    const source = propTournaments && propTournaments.length > 0 ? propTournaments : loadedTournaments;
    return source.filter(t => t.sportId === sport.id && t.status !== 'Archived' && t.status !== 'Draft');
  }, [propTournaments, loadedTournaments, sport.id]);

  // Available categories for this sport
  const availableCategories = useMemo(() => {
    const customCats = (sport as any)?.customAgeCategories;
    if (Array.isArray(customCats) && customCats.length > 0) {
      return customCats.map((c: any) => ({
        id: normalizeCategoryKey(c.id),
        name: c.name,
        years: c.yearsExpression || ''
      }));
    }
    const ageCats = (sport as any)?.ageCategories;
    if (Array.isArray(ageCats) && ageCats.length > 0) {
      return ageCats.map((cat: string) => {
        const norm = normalizeCategoryKey(cat);
        return {
          id: norm,
          name: getCustomCategoryName(norm, sport.id) || getCategoryShortName(norm) || norm,
          years: ''
        };
      });
    }
    if (sport.id === 'cross_country' || sport.id === 'athletics') {
      return [
        { id: 'U12', name: 'البراعم والبرعمات (U12)', years: '' },
        { id: 'U15', name: 'الصغار والصغيرات (U15)', years: '' },
        { id: 'U18', name: 'الفتيان والفتيات (U18)', years: '' },
        { id: 'U20', name: 'الشبان والشابات (U20)', years: '' }
      ];
    }
    return [
      { id: 'U15', name: 'الصغار والصغيرات (U15)', years: '' },
      { id: 'U18', name: 'الفتيان والفتيات (U18)', years: '' }
    ];
  }, [sport]);

  // Build exact programmable branches grouped by affiliation
  const affiliationGroups = useMemo(() => {
    const groupsMap = new Map<string, BranchOptionItem[]>();

    const addBranchOption = (affiliationType: string, catIdRaw: string, gender: 'Male' | 'Female') => {
      const catId = normalizeCategoryKey(catIdRaw);
      if (!catId) return;
      const aff = (affiliationType || 'non_club').trim();
      const catMeta = availableCategories.find(c => c.id === catId);
      const catName = getGenderSpecificCategoryTitle(catId, gender, sport.id);
      const years = catMeta?.years || '';
      const key = `${aff}__${catId}__${gender}`;

      if (!groupsMap.has(aff)) {
        groupsMap.set(aff, []);
      }
      const arr = groupsMap.get(aff)!;
      if (!arr.some(item => item.key === key)) {
        arr.push({
          key,
          category: catId,
          categoryName: catName,
          years,
          gender,
          affiliationType: aff
        });
      }
    };

    if (activeSportTournaments.length > 0) {
      activeSportTournaments.forEach(t => {
        const aff = t.affiliationType || 'non_club';
        const catId = normalizeCategoryKey(t.ageCategory || t.category || 'U15');
        if (t.gender === 'Male' || t.gender === 'Female') {
          addBranchOption(aff, catId, t.gender);
        } else {
          addBranchOption(aff, catId, 'Male');
          addBranchOption(aff, catId, 'Female');
        }
      });
    } else {
      const sportAffs: string[] = Array.isArray((sport as any)?.targetAffiliations) && (sport as any).targetAffiliations.length > 0
        ? (sport as any).targetAffiliations
        : (sport.id === 'cross_country' ? ['non_club', 'club_affiliated'] : ['non_club', 'club_affiliated']);

      sportAffs.forEach(aff => {
        // Normalize legacy targetAffiliation IDs to canonical non_club / club_affiliated if needed
        const canonicalAff = aff === 'club_affiliated' ? 'club_affiliated' : aff === 'open' ? 'open' : 'non_club';
        availableCategories.forEach(cat => {
          addBranchOption(canonicalAff, cat.id, 'Male');
          addBranchOption(canonicalAff, cat.id, 'Female');
        });
      });
    }

    const orderAffs = ['non_club', 'club_affiliated', 'open'];
    const catOrder = ['U12', 'U15', 'U18', 'U20', 'OPEN'];

    return Array.from(groupsMap.entries())
      .sort((a, b) => {
        const ia = orderAffs.indexOf(a[0]);
        const ib = orderAffs.indexOf(b[0]);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      })
      .map(([affId, items]) => {
        const affConfig = TARGET_AFFILIATIONS.find(x => x.id === affId);
        const sortedItems = [...items].sort((x, y) => {
          const cx = catOrder.indexOf(x.category);
          const cy = catOrder.indexOf(y.category);
          const diff = (cx === -1 ? 99 : cx) - (cy === -1 ? 99 : cy);
          if (diff !== 0) return diff;
          return x.gender === 'Male' ? -1 : 1;
        });
        return {
          affiliationId: affId,
          label: affId === 'club_affiliated'
            ? 'بطولة المنتمين للأندية والجمعيات الرياضية'
            : affId === 'open'
            ? 'البطولة المفتوحة (Open)'
            : 'بطولة غير المنتمين للأندية (لا منتمين)',
          shortLabel: affConfig?.shortLabel || (affId === 'club_affiliated' ? 'منتمين للأندية' : 'لا منتمين'),
          icon: affId === 'club_affiliated' ? '🟡' : affId === 'open' ? '🟢' : '⚪',
          items: sortedItems
        };
      });
  }, [activeSportTournaments, availableCategories, sport]);

  // Exact selected branches state (NO hidden Cartesian product & NO auto-selecting club_affiliated!)
  const [selectedBranches, setSelectedBranches] = useState<ConfirmedBranchTuple[]>(() => {
    if (confirmedRecord && confirmedRecord.status === 'confirmed') {
      return getEffectiveConfirmedBranches(confirmedRecord, true);
    }
    return [];
  });

  useEffect(() => {
    if (!isOpen) return;
    setConfirmCancelStep(false);
    if (confirmedRecord && confirmedRecord.status === 'confirmed') {
      setSelectedBranches(getEffectiveConfirmedBranches(confirmedRecord, true));
    } else {
      setSelectedBranches([]);
    }
  }, [isOpen, confirmedRecord]);

  const [notes, setNotes] = useState(confirmedRecord?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  if (!isOpen) return null;

  // Check if deadline has passed
  const isDeadlinePassed = (() => {
    if (!registrationDeadline) return false;
    try {
      const d = registrationDeadline?.toDate ? registrationDeadline.toDate() : new Date(registrationDeadline);
      return !isNaN(d.getTime()) && d.getTime() < Date.now();
    } catch {
      return false;
    }
  })();

  const makeBranchKey = (b: { affiliationType: string; category: string; gender: 'Male' | 'Female' }) =>
    `${b.affiliationType}__${normalizeCategoryKey(b.category)}__${b.gender}`;

  const isBranchChecked = (item: BranchOptionItem) => {
    const targetKey = makeBranchKey(item);
    return selectedBranches.some(b => makeBranchKey(b) === targetKey);
  };

  const toggleBranch = (item: BranchOptionItem) => {
    const targetKey = makeBranchKey(item);
    setSelectedBranches(prev => {
      const exists = prev.some(b => makeBranchKey(b) === targetKey);
      if (exists) {
        return prev.filter(b => makeBranchKey(b) !== targetKey);
      }
      return [
        ...prev,
        {
          category: item.category,
          gender: item.gender,
          affiliationType: item.affiliationType
        }
      ];
    });
  };

  const selectAllInAffiliation = (affId: string) => {
    const group = affiliationGroups.find(g => g.affiliationId === affId);
    if (!group) return;
    setSelectedBranches(prev => {
      const map = new Map<string, ConfirmedBranchTuple>();
      prev.forEach(b => map.set(makeBranchKey(b), b));
      group.items.forEach(item => {
        const tuple: ConfirmedBranchTuple = {
          category: item.category,
          gender: item.gender,
          affiliationType: item.affiliationType
        };
        map.set(makeBranchKey(tuple), tuple);
      });
      return Array.from(map.values());
    });
  };

  const clearAffiliation = (affId: string) => {
    setSelectedBranches(prev => prev.filter(b => b.affiliationType !== affId));
  };

  const confirmedBranchesForSummary = confirmedRecord
    ? getEffectiveConfirmedBranches(confirmedRecord, true)
    : [];

  const handleConfirm = async () => {
    if (!schoolName) {
      toast.error('يرجى تحديد المؤسسة التعليمية أولاً من ملفك الشخصي');
      return;
    }

    if (isDeadlinePassed) {
      toast.error('عذراً، لقد انتهى أجل التسجيل وتأكيد المشاركة في هذه البطولة');
      return;
    }

    if (selectedBranches.length === 0) {
      toast.error('يرجى تحديد فرع واحد على الأقل (مثلاً: لا منتمين U15 ذكور) لتأكيد مشاركة المؤسسة');
      return;
    }

    const derivedCategories: string[] = Array.from(new Set<string>(selectedBranches.map(b => b.category)));
    const derivedGenders: ('Male' | 'Female')[] = Array.from(new Set<'Male' | 'Female'>(selectedBranches.map(b => b.gender)));
    const derivedAffiliations: string[] = Array.from(new Set<string>(selectedBranches.map(b => b.affiliationType)));

    setIsSubmitting(true);
    const toastId = toast.loading('جاري حفظ تأكيد مشاركة المؤسسة في الفروع المحددة...');
    try {
      await DataService.cancelSchoolWithdrawal(sport.id, schoolId || schoolName);

      await DataService.confirmSchoolParticipation({
        sportId: sport.id,
        sportName: sport.name,
        schoolId: schoolId || schoolName,
        schoolName: schoolName,
        teacherId: teacherId || '',
        teacherName: teacherName || '',
        teacherPhone: teacherPhone || '',
        teacherLeaseNumber: teacherLeaseNumber || '',
        registrationDeadline: registrationDeadline ? (registrationDeadline?.toISOString ? registrationDeadline.toISOString() : String(registrationDeadline)) : undefined,
        notes: notes.trim() || undefined,
        categories: derivedCategories,
        genders: derivedGenders,
        affiliationTypes: derivedAffiliations,
        selectedBranches
      });

      toast.dismiss(toastId);
      toast.success(`تم تأكيد مشاركة «${schoolName}» في ${selectedBranches.length} فرع(فروع) من بطولة ${sport.name} بنجاح!`, { duration: 4500 });
      setIsEditingExisting(false);
      if (onConfirmSuccess) onConfirmSuccess();
      onClose();
    } catch (err) {
      console.error('Error confirming school participation:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء تأكيد المشاركة، يرجى المحاولة ثانية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelConfirmation = async () => {
    setIsCancelling(true);
    const toastId = toast.loading('جاري إلغاء تأكيد المشاركة...');
    try {
      await DataService.cancelSchoolConfirmation(sport.id, schoolId || schoolName);
      toast.dismiss(toastId);
      toast.success(`تم إلغاء تأكيد مشاركة مؤسسة «${schoolName}»`);
      setConfirmCancelStep(false);
      if (onCancelSuccess) onCancelSuccess();
      onClose();
    } catch (err) {
      console.error('Error cancelling confirmation:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء إلغاء التأكيد');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-80 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-auto border border-slate-200 text-slate-800">
        
        {/* Header with sport gradient */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-900 p-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute left-4 top-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
              {sport.icon || '🏆'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-0.5 rounded-full text-blue-100">
                  تأكيد المشاركة الرسمية
                </span>
                {isConfirmed && (
                  <ConfirmedParticipationBadge
                    sportId={sport.id}
                    sportName={sport.name}
                    schoolId={schoolId || schoolName}
                    schoolName={schoolName}
                    variant="dark"
                    label="مشاركة مؤكدة ✓ (اضغط 3ث للإلغاء)"
                    count={confirmedBranchesForSummary.length}
                    className="!py-0.5 !px-2.5 !text-[10px] !rounded-full"
                    onCancelSuccess={() => {
                      setIsEditingExisting(false);
                      setSelectedBranches([]);
                      if (onCancelSuccess) onCancelSuccess();
                      if (onConfirmSuccess) onConfirmSuccess();
                      onClose();
                    }}
                  />
                )}
              </div>
              <h3 className="text-base sm:text-lg font-black text-white mt-1">
                تأكيد مشاركة المؤسسة في بطولة {sport.name}
              </h3>
            </div>
          </div>
        </div>

        {/* Body content */}
        <div className="p-5 space-y-4 text-xs max-h-[75vh] overflow-y-auto">

          {/* Two-phase visual explanation */}
          <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-slate-50 p-3.5 rounded-2xl border border-blue-100 space-y-2.5">
            <h4 className="text-xs font-black text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>نظام المشاركة في البطولات المدرسية (على مرحلتين متناسقتين):</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className={`p-2.5 rounded-xl border transition-all ${
                isConfirmed
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : 'bg-white border-blue-300 text-blue-950 shadow-3xs ring-2 ring-blue-500/20'
              }`}>
                <div className="flex items-center justify-between font-black text-[11px] mb-0.5">
                  <span>المرحلة 1: تحديد الفروع بدقة</span>
                  {isConfirmed ? (
                    <span className="text-emerald-700 text-[10px] font-extrabold flex items-center gap-0.5">
                      ✓ مكتملة
                    </span>
                  ) : (
                    <span className="text-blue-700 text-[10px] font-extrabold">الآن 👈</span>
                  )}
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-600">
                  اختر الفروع الدقيقة التي ستشارك فيها مؤسستك فقط (مثلاً: لا منتمين U15 ذكور، لا منتمين U18 إناث).
                </p>
              </div>

              <div className={`p-2.5 rounded-xl border transition-all ${
                isConfirmed
                  ? 'bg-white border-blue-400 text-blue-950 shadow-3xs ring-2 ring-blue-500/20'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-black text-[11px] mb-0.5">
                  <span>المرحلة 2: لوائح التلاميذ</span>
                  <span className="text-amber-600 text-[10px] font-extrabold">قبل نهاية الأجل ⏳</span>
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-600">
                  ستدرج مؤسستك حصرياً في الفروع المؤكدة وفي ملف مشاركات مؤسستك لاستكمال أسماء التلاميذ.
                </p>
              </div>
            </div>
          </div>

          {/* Deadline Countdown banner */}
          {registrationDeadline && (
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-center justify-between gap-3 text-amber-900">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                <div>
                  <div className="font-bold text-[11px]">آخر أجل لتسجيل المشاركين:</div>
                  <div className="text-[10px] text-amber-700">
                    يمكنك تأكيد المؤسسة الآن واستكمال إضافة المشاركين حتى انقضاء الأجل.
                  </div>
                </div>
              </div>
              <CountdownTimer deadline={registrationDeadline} compact={true} />
            </div>
          )}

          {/* School & Teacher Information Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-1.5">
            <div className="flex items-center justify-between text-slate-600 border-b border-slate-200/80 pb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span>المؤسسة التعليمية:</span>
              </span>
              <span className="font-black text-slate-900 text-xs">
                {schoolName || 'لم تحدد المؤسسة بعد'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 border-b border-slate-200/80 pb-1.5">
              <span className="font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-blue-600" />
                <span>الأستاذ المنسق / المؤطر:</span>
              </span>
              <span className="font-bold text-slate-900">
                {teacherName || 'الأستاذ'}
                {teacherLeaseNumber && ` (SOM: ${teacherLeaseNumber})`}
              </span>
            </div>

            {teacherPhone && (
              <div className="flex items-center justify-between text-slate-600">
                <span className="font-bold flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" />
                  <span>رقم الهاتف:</span>
                </span>
                <span className="font-mono font-bold text-slate-900">
                  {teacherPhone}
                </span>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* CONFIRMED SUMMARY (WHEN ALREADY CONFIRMED AND NOT EDITING) */}
          {/* ========================================================================= */}
          {isConfirmed && confirmedRecord && !isEditingExisting && (
            <div className="p-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl text-emerald-950 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 font-black text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>الفروع المؤكدة رسمياً لمؤسستك ({confirmedBranchesForSummary.length}):</span>
                </div>
                {!isDeadlinePassed && (
                  <button
                    type="button"
                    onClick={() => setIsEditingExisting(true)}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>تعديل الفروع المؤكدة</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {confirmedBranchesForSummary.map(branch => {
                  const isClub = branch.affiliationType === 'club_affiliated';
                  return (
                    <span
                      key={`${branch.affiliationType}_${branch.category}_${branch.gender}`}
                      className={`px-3 py-1.5 rounded-xl font-black text-[11px] border flex items-center gap-1.5 shadow-2xs ${
                        isClub
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-white text-slate-900 border-emerald-300'
                      }`}
                    >
                      <span>{isClub ? '🟡' : '⚪'}</span>
                      <span>{formatBranchLabelAr(branch, sport.id)}</span>
                      <span>{branch.gender === 'Female' ? '👧' : '👦'}</span>
                    </span>
                  );
                })}
              </div>

              <p className="text-[10px] text-emerald-700 leading-relaxed border-t border-emerald-200 pt-1.5">
                سُجل التأكيد بتاريخ{' '}
                <strong className="font-mono">
                  {new Date(confirmedRecord.confirmedAt).toLocaleDateString('ar-MA', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </strong>{' '}
                بواسطة الأستاذ <strong>{confirmedRecord.teacherName}</strong>. تظهر مؤسستك الآن حصرياً في هذه الفروع فقط.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* EXACT BRANCH SELECTION BY AFFILIATION (NO CARTESIAN PRODUCT) */}
          {/* ========================================================================= */}
          {(!isConfirmed || isEditingExisting) && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" />
                  <span>اختر فروع البطولة الدقيقة التي تود المشاركة فيها:</span>
                </label>
                {selectedBranches.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedBranches([])}
                    className="text-[10px] text-red-600 hover:text-red-800 font-bold cursor-pointer"
                  >
                    إلغاء تحديد الكل ({selectedBranches.length})
                  </button>
                )}
              </div>

              {affiliationGroups.map(affGroup => {
                const isClubGroup = affGroup.affiliationId === 'club_affiliated';
                const selectedInGroupCount = affGroup.items.filter(item => isBranchChecked(item)).length;
                const allSelectedInGroup = affGroup.items.length > 0 && selectedInGroupCount === affGroup.items.length;

                return (
                  <div
                    key={affGroup.affiliationId}
                    className={`p-3.5 rounded-2xl border-2 space-y-2.5 transition-all ${
                      isClubGroup
                        ? selectedInGroupCount > 0
                          ? 'bg-amber-50/80 border-amber-400'
                          : 'bg-amber-50/30 border-amber-200/80'
                        : selectedInGroupCount > 0
                        ? 'bg-blue-50/50 border-blue-400'
                        : 'bg-slate-50/70 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/70">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{affGroup.icon}</span>
                        <span className={`text-xs font-black ${isClubGroup ? 'text-amber-950' : 'text-slate-900'}`}>
                          {affGroup.label}
                        </span>
                        {selectedInGroupCount > 0 && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            isClubGroup ? 'bg-amber-200 text-amber-950' : 'bg-blue-600 text-white'
                          }`}>
                            {selectedInGroupCount} محدد
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {!allSelectedInGroup ? (
                          <button
                            type="button"
                            onClick={() => selectAllInAffiliation(affGroup.affiliationId)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black border cursor-pointer transition-colors ${
                              isClubGroup
                                ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-300'
                                : 'bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300'
                            }`}
                          >
                            تحديد جميع فئات {affGroup.shortLabel} فقط
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => clearAffiliation(affGroup.affiliationId)}
                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 cursor-pointer transition-colors"
                          >
                            إلغاء تحديد {affGroup.shortLabel}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {affGroup.items.map(item => {
                        const checked = isBranchChecked(item);
                        const isFemale = item.gender === 'Female';
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => toggleBranch(item)}
                            className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between gap-2 ${
                              checked
                                ? isClubGroup
                                  ? 'bg-amber-100 border-amber-500 text-amber-950 font-black shadow-xs ring-1 ring-amber-400/40'
                                  : isFemale
                                  ? 'bg-pink-50 border-pink-500 text-pink-950 font-black shadow-xs ring-1 ring-pink-400/30'
                                  : 'bg-blue-50 border-blue-600 text-blue-950 font-black shadow-xs ring-1 ring-blue-500/30'
                                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-base shrink-0">{isFemale ? '👧' : '👦'}</span>
                              <div className="min-w-0">
                                <div className="text-xs font-black truncate">
                                  {affGroup.shortLabel} — {item.categoryName}
                                </div>
                                {item.years && (
                                  <div className="text-[10px] text-slate-500 font-medium truncate">
                                    مواليد: {item.years}
                                  </div>
                                )}
                              </div>
                            </div>
                            {checked ? (
                              <CheckSquare className={`w-4 h-4 shrink-0 ${
                                isClubGroup ? 'text-amber-700' : isFemale ? 'text-pink-600' : 'text-blue-600'
                              }`} />
                            ) : (
                              <Square className="w-4 h-4 text-slate-300 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Live Preview of Exact Branches */}
              <div className={`p-3 rounded-2xl border ${
                selectedBranches.length > 0
                  ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950'
                  : 'bg-slate-100/80 border-slate-200 text-slate-500'
              }`}>
                <div className="font-black text-[11px] mb-1.5">
                  {selectedBranches.length > 0
                    ? `✓ ستدرج مشاركة مؤسستك حصرياً في الفروع التالية (${selectedBranches.length}):`
                    : 'لم يتم تحديد أي فرع بعد — اضغط على الفروع المطلوبة أعلاه:'}
                </div>
                {selectedBranches.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedBranches.map(b => {
                      const isClub = b.affiliationType === 'club_affiliated';
                      return (
                        <span
                          key={makeBranchKey(b)}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-black border flex items-center gap-1 ${
                            isClub
                              ? 'bg-amber-100 text-amber-950 border-amber-300'
                              : 'bg-white text-emerald-950 border-emerald-300'
                          }`}
                        >
                          <span>{isClub ? '🟡' : '⚪'}</span>
                          <span>{formatBranchLabelAr(b, sport.id)}</span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Notes input */}
          {(!isConfirmed || isEditingExisting) && (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                ملاحظات أو توضيحات إضافية للمنظمين (اختياري):
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="مثال: ستشارك المؤسسة في الفروع المحددة أعلاه وجاري ضبط اللائحة النهائية..."
                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition-all"
              />
            </div>
          )}

          {/* Deadline expired warning */}
          {isDeadlinePassed && (
            <div className="p-3.5 bg-red-50 border-2 border-red-200 rounded-2xl text-red-800 font-bold text-xs flex items-center gap-2.5 shadow-xs">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <div className="font-black text-xs text-red-950">انتهى أجل التسجيل وتأكيد المشاركة (مغلق 🔒)</div>
                <div className="text-[11px] text-red-700 mt-0.5">
                  لقد انقضى الوقت المحدد للتسجيل وتأكيد المشاركة في هذه البطولة من طرف اللجنة المنظمة. لا يمكن تقديم تأكيدات أو تسجيلات جديدة.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="w-full sm:w-auto flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            {isConfirmed && !isEditingExisting && !confirmCancelStep && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={() => setConfirmCancelStep(true)}
                className="w-full sm:w-auto px-3.5 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                title="إلغاء تأكيد مشاركة المؤسسة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>إلغاء التأكيد</span>
              </button>
            )}

            {isConfirmed && !isEditingExisting && confirmCancelStep && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={isCancelling}
                  onClick={handleCancelConfirmation}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-black text-xs transition-colors cursor-pointer"
                >
                  {isCancelling ? 'جاري الإلغاء...' : 'تأكيد إلغاء المشاركة نهائياً'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmCancelStep(false)}
                  className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            )}

            {isEditingExisting && (
              <button
                type="button"
                onClick={() => {
                  setIsEditingExisting(false);
                  if (confirmedRecord) {
                    setSelectedBranches(getEffectiveConfirmedBranches(confirmedRecord, true));
                  }
                }}
                className="w-full sm:w-auto px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
              >
                إلغاء التعديل
              </button>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2 justify-end">
            {isConfirmed && !isEditingExisting ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onProceedToRegister) onProceedToRegister();
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <span>المرحلة 2: تسجيل وتعديل المشاركين</span>
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting || isDeadlinePassed || selectedBranches.length === 0}
                onClick={handleConfirm}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'جاري الحفظ...'
                    : isEditingExisting
                    ? `حفظ تعديلات الفروع (${selectedBranches.length}) ✓`
                    : `تأكيد المشاركة في الفروع المحددة (${selectedBranches.length}) ✓`}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
