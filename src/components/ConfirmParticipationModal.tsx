import React, { useState, useMemo } from 'react';
import { Sport, SchoolTournamentConfirmation, TARGET_AFFILIATIONS } from '../types';
import { DataService, getCustomCategoryName, getCategoryShortName } from '../lib/dataService';
import { CountdownTimer } from './CountdownTimer';
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
  Users2,
  Tags,
  Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ConfirmParticipationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | { id: string; name: string; icon?: string; ageCategories?: string[]; customAgeCategories?: any[]; targetAffiliations?: string[] };
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

export const ConfirmParticipationModal: React.FC<ConfirmParticipationModalProps> = ({
  isOpen,
  onClose,
  sport,
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

  // Available categories for this sport
  const availableCategories = useMemo(() => {
    const customCats = (sport as any)?.customAgeCategories;
    if (Array.isArray(customCats) && customCats.length > 0) {
      return customCats.map(c => ({
        id: c.id,
        name: c.name,
        years: c.yearsExpression || ''
      }));
    }
    const ageCats = (sport as any)?.ageCategories;
    if (Array.isArray(ageCats) && ageCats.length > 0) {
      return ageCats.map((cat: string) => ({
        id: cat,
        name: getCustomCategoryName(cat, sport.id) || getCategoryShortName(cat) || cat,
        years: ''
      }));
    }
    return [
      { id: 'U12', name: 'البراعم (U12)', years: '' },
      { id: 'U15', name: 'الصغار (U15)', years: '' },
      { id: 'U18', name: 'الفتيان (U18)', years: '' },
      { id: 'U20', name: 'الشبان (U20)', years: '' }
    ];
  }, [sport]);

  // Gender options
  const genderOptions: { id: 'Male' | 'Female'; label: string; icon: string }[] = [
    { id: 'Male', label: 'ذكور', icon: '👦' },
    { id: 'Female', label: 'إناث', icon: '👧' }
  ];

  // Affiliation options (صنف المشاركين)
  const affiliationOptions = useMemo(() => {
    return TARGET_AFFILIATIONS;
  }, []);

  // Multi-selection states
  const [selectedCategories, setSelectedCategories] = useState<string[]>(() => {
    if (confirmedRecord?.categories && confirmedRecord.categories.length > 0) {
      return confirmedRecord.categories;
    }
    // Default to all sport categories
    return availableCategories.map(c => c.id);
  });

  const [selectedGenders, setSelectedGenders] = useState<('Male' | 'Female')[]>(() => {
    if (confirmedRecord?.genders && confirmedRecord.genders.length > 0) {
      return confirmedRecord.genders;
    }
    return ['Male', 'Female'];
  });

  const [selectedAffiliations, setSelectedAffiliations] = useState<string[]>(() => {
    if (confirmedRecord?.affiliationTypes && confirmedRecord.affiliationTypes.length > 0) {
      return confirmedRecord.affiliationTypes;
    }
    const sportAffils = (sport as any)?.targetAffiliations;
    if (Array.isArray(sportAffils) && sportAffils.length > 0) {
      return sportAffils;
    }
    return ['non_club']; // Default to Non-Club
  });

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

  // Toggle Category
  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(availableCategories.map(c => c.id));
  };

  const handleDeselectAllCategories = () => {
    setSelectedCategories([]);
  };

  // Toggle Gender
  const toggleGender = (gender: 'Male' | 'Female') => {
    setSelectedGenders(prev =>
      prev.includes(gender) ? prev.filter(g => g !== gender) : [...prev, gender]
    );
  };

  // Toggle Affiliation
  const toggleAffiliation = (affId: string) => {
    setSelectedAffiliations(prev =>
      prev.includes(affId) ? prev.filter(a => a !== affId) : [...prev, affId]
    );
  };

  const handleSelectAllAffiliations = () => {
    setSelectedAffiliations(affiliationOptions.map(a => a.id));
  };

  const handleConfirm = async () => {
    if (!schoolName) {
      toast.error('يرجى تحديد المؤسسة التعليمية أولاً من ملفك الشخصي');
      return;
    }

    if (isDeadlinePassed) {
      toast.error('عذراً، لقد انتهى أجل التسجيل وتأكيد المشاركة في هذه البطولة');
      return;
    }

    if (selectedCategories.length === 0) {
      toast.error('يرجى تحديد فئة عمرية واحدة على الأقل للمشاركة في البطولة');
      return;
    }

    if (selectedGenders.length === 0) {
      toast.error('يرجى تحديد الجنس (ذكور و/أو إناث) للمشاركة في البطولة');
      return;
    }

    if (selectedAffiliations.length === 0) {
      toast.error('يرجى تحديد صنف واحد على الأقل للمشاركين (مثل: غير المنتمين للأندية)');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('جاري حفظ تأكيد مشاركة المؤسسة في البطولة...');
    try {
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
        categories: selectedCategories,
        genders: selectedGenders,
        affiliationTypes: selectedAffiliations
      });

      await DataService.cancelSchoolWithdrawal(sport.id, schoolId || schoolName);

      toast.dismiss(toastId);
      toast.success(`تم تأكيد مشاركة «${schoolName}» في بطولة ${sport.name} بنجاح! 🎉\nيمكنك الآن تسجيل أسماء وتفاصيل المشاركين قبل نهاية الأجل.`, { duration: 5000 });
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
    if (!window.confirm(`هل أنت متأكد من رغبتك في إلغاء تأكيد مشاركة مؤسسة «${schoolName}» في بطولة ${sport.name}؟`)) {
      return;
    }

    setIsCancelling(true);
    const toastId = toast.loading('جاري إلغاء تأكيد المشاركة...');
    try {
      await DataService.cancelSchoolConfirmation(sport.id, schoolId || schoolName);
      toast.dismiss(toastId);
      toast.success(`تم إلغاء تأكيد مشاركة مؤسسة «${schoolName}»`);
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
                  <span className="text-[10px] font-black bg-emerald-500 text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>مشاركة مؤكدة</span>
                  </span>
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
              <span>نظام المشاركة في البطولات المدرسية (على مرحلتين):</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {/* Phase 1 */}
              <div className={`p-2.5 rounded-xl border transition-all ${
                isConfirmed
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : 'bg-white border-blue-300 text-blue-950 shadow-3xs ring-2 ring-blue-500/20'
              }`}>
                <div className="flex items-center justify-between font-black text-[11px] mb-0.5">
                  <span>المرحلة 1: تأكيد المشاركة والفئات</span>
                  {isConfirmed ? (
                    <span className="text-emerald-700 text-[10px] font-extrabold flex items-center gap-0.5">
                      ✓ مكتملة
                    </span>
                  ) : (
                    <span className="text-blue-700 text-[10px] font-extrabold">الآن 👈</span>
                  )}
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-600">
                  حجز مقعد المؤسسة في القرعة وتحديد الفئات والجنس وصنف المشاركين.
                </p>
              </div>

              {/* Phase 2 */}
              <div className={`p-2.5 rounded-xl border transition-all ${
                isConfirmed
                  ? 'bg-white border-blue-400 text-blue-950 shadow-3xs ring-2 ring-blue-500/20'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-black text-[11px] mb-0.5">
                  <span>المرحلة 2: أسماء التلاميذ</span>
                  <span className="text-amber-600 text-[10px] font-extrabold">قبل نهاية الأجل ⏳</span>
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-600">
                  إدخال لائحة التلاميذ الممثلين للمؤسسة وصورهم ومصادقة البيانات.
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
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-black text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>مشاركة المؤسسة مؤكدة رسمياً</span>
                </div>
                {!isDeadlinePassed && (
                  <button
                    type="button"
                    onClick={() => setIsEditingExisting(true)}
                    className="px-2.5 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>تعديل الفئات والأصناف</span>
                  </button>
                )}
              </div>

              {/* Confirmed Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 text-[11px]">
                {/* Categories */}
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80">
                  <div className="font-bold text-slate-600 mb-1 flex items-center gap-1 text-[10px]">
                    <Layers className="w-3 h-3 text-emerald-600" />
                    <span>الفئات المحددة:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {confirmedRecord.categories && confirmedRecord.categories.length > 0 ? (
                      confirmedRecord.categories.map(cat => (
                        <span key={cat} className="px-2 py-0.5 bg-emerald-100 text-emerald-900 rounded-md font-black text-[10px]">
                          {getCustomCategoryName(cat, sport.id) || cat}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 text-[10px]">جميع الفئات</span>
                    )}
                  </div>
                </div>

                {/* Gender */}
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80">
                  <div className="font-bold text-slate-600 mb-1 flex items-center gap-1 text-[10px]">
                    <Users2 className="w-3 h-3 text-emerald-600" />
                    <span>الجنس المحدد:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {confirmedRecord.genders && confirmedRecord.genders.length > 0 ? (
                      confirmedRecord.genders.map(g => (
                        <span key={g} className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded-md font-black text-[10px]">
                          {g === 'Female' ? '👧 إناث' : '👦 ذكور'}
                        </span>
                      ))
                    ) : (
                      <span className="text-slate-400 text-[10px]">ذكور وإناث</span>
                    )}
                  </div>
                </div>

                {/* Affiliations */}
                <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-200/80">
                  <div className="font-bold text-slate-600 mb-1 flex items-center gap-1 text-[10px]">
                    <Tags className="w-3 h-3 text-emerald-600" />
                    <span>أصناف المشاركين:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {confirmedRecord.affiliationTypes && confirmedRecord.affiliationTypes.length > 0 ? (
                      confirmedRecord.affiliationTypes.map(affId => {
                        const aff = TARGET_AFFILIATIONS.find(a => a.id === affId);
                        return (
                          <span key={affId} className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md font-black text-[10px] flex items-center gap-0.5">
                            <span>{aff?.icon || '⚪'}</span>
                            <span>{aff?.shortLabel || affId}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-slate-400 text-[10px]">غير المنتمين</span>
                    )}
                  </div>
                </div>
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
                بواسطة الأستاذ <strong>{confirmedRecord.teacherName}</strong>.
              </p>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SELECTION FORM: CATEGORIES, GENDER & AFFILIATIONS (MULTI-SELECTION) */}
          {/* ========================================================================= */}
          {(!isConfirmed || isEditingExisting) && (
            <div className="space-y-3.5 bg-slate-50/60 p-3.5 rounded-2xl border border-slate-200">
              
              {/* SECTION 1: CATEGORIES MULTI-SELECT */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>1. فئات المشاركة المستهدفة (يمكن تحديد أكثر من خيار):</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAllCategories}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
                    >
                      تحديد الكل
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllCategories}
                      className="text-[10px] text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {availableCategories.map(cat => {
                    const isChecked = selectedCategories.includes(cat.id);
                    return (
                      <div
                        key={cat.id}
                        onClick={() => toggleCategory(cat.id)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isChecked
                            ? 'bg-blue-50 border-blue-500 text-blue-950 font-black shadow-xs ring-1 ring-blue-400/30'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="truncate">
                          <div className="truncate">{cat.name}</div>
                          {cat.years && <span className="text-[9px] text-slate-400 block truncate">{cat.years}</span>}
                        </div>
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 shrink-0 ml-1" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0 ml-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 2: GENDER MULTI-SELECT */}
              <div className="space-y-2 pt-1 border-t border-slate-200/70">
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Users2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span>2. جنس المشاركين (يمكن تحديد ذكور و/أو إناث):</span>
                </label>

                <div className="grid grid-cols-2 gap-2">
                  {genderOptions.map(gen => {
                    const isChecked = selectedGenders.includes(gen.id);
                    return (
                      <div
                        key={gen.id}
                        onClick={() => toggleGender(gen.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-black shadow-xs ring-1 ring-indigo-400/30'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{gen.icon}</span>
                          <span>{gen.label}</span>
                        </div>
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* SECTION 3: PARTICIPANT AFFILIATIONS (صنف المشاركين) */}
              <div className="space-y-2 pt-1 border-t border-slate-200/70">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Tags className="w-3.5 h-3.5 text-amber-600" />
                    <span>3. صنف المشاركين في البطولة (تحديد صنف أو أكثر):</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllAffiliations}
                    className="text-[10px] text-amber-700 hover:text-amber-900 font-bold cursor-pointer"
                  >
                    تحديد جميع الأصناف
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {affiliationOptions.map(aff => {
                    const isChecked = selectedAffiliations.includes(aff.id);
                    return (
                      <div
                        key={aff.id}
                        onClick={() => toggleAffiliation(aff.id)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isChecked
                            ? `${aff.badgeBg} ${aff.badgeBorder} ${aff.badgeText} font-black shadow-xs ring-1 ring-amber-400/40`
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-sm shrink-0">{aff.icon}</span>
                          <span className="truncate">{aff.label}</span>
                        </div>
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-amber-600 shrink-0 ml-1" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0 ml-1" />
                        )}
                      </div>
                    );
                  })}
                </div>
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
                placeholder="مثال: ستشارك المؤسسة بفريقين، وجاري ضبط الأسماء النهائية..."
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
          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            {isConfirmed && !isEditingExisting && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelConfirmation}
                className="w-full sm:w-auto px-3.5 py-2 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                title="إلغاء تأكيد مشاركة المؤسسة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isCancelling ? 'جاري الإلغاء...' : 'إلغاء التأكيد'}</span>
              </button>
            )}

            {isEditingExisting && (
              <button
                type="button"
                onClick={() => setIsEditingExisting(false)}
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
                disabled={isSubmitting || isDeadlinePassed}
                onClick={handleConfirm}
                className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 disabled:opacity-50 text-white rounded-xl font-black text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? 'جاري الحفظ...'
                    : isEditingExisting
                    ? 'حفظ تعديلات الفئات والأصناف ✓'
                    : 'تأكيد مشاركة المؤسسة والفئات رسمياً (المرحلة 1) ✓'}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
