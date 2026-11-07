import React, { useState } from 'react';
import { Sport, SchoolTournamentConfirmation } from '../types';
import { DataService } from '../lib/dataService';
import { CountdownTimer } from './CountdownTimer';
import {
  X,
  Building,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Clock,
  ShieldCheck,
  User,
  Phone,
  FileText,
  Sparkles,
  ArrowRight,
  Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ConfirmParticipationModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | { id: string; name: string; icon?: string };
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
  const [notes, setNotes] = useState(confirmedRecord?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  if (!isOpen) return null;

  const isConfirmed = !!confirmedRecord && confirmedRecord.status === 'confirmed';

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

  const handleConfirm = async () => {
    if (!schoolName) {
      toast.error('يرجى تحديد المؤسسة التعليمية أولاً من ملفك الشخصي');
      return;
    }

    if (isDeadlinePassed) {
      toast.error('عذراً، لقد انتهى أجل التسجيل وتأكيد المشاركة في هذه البطولة');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('جاري تسجيل تأكيد مشاركة المؤسسة في البطولة...');
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
        notes: notes.trim() || undefined
      });

      toast.dismiss(toastId);
      toast.success(`تم تأكيد مشاركة «${schoolName}» في بطولة ${sport.name} بنجاح! 🎉\nيمكنك الآن تسجيل أسماء التلاميذ في أي وقت قبل نهاية الأجل.`, { duration: 5000 });
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
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden my-auto border border-slate-200 text-slate-800">
        
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
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-full text-blue-100">
                  تأكيد المشاركة الرسمية
                </span>
                {isConfirmed && (
                  <span className="text-[10px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
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
        <div className="p-5 space-y-4 text-xs">

          {/* Two-phase visual explanation */}
          <div className="bg-gradient-to-br from-blue-50/80 via-indigo-50/50 to-slate-50 p-4 rounded-2xl border border-blue-100 space-y-3">
            <h4 className="text-xs font-black text-blue-950 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
              <span>نظام المشاركة في البطولات المدرسية (على مرحلتين):</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Phase 1 */}
              <div className={`p-3 rounded-xl border transition-all ${
                isConfirmed
                  ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950'
                  : 'bg-white border-blue-300 text-blue-950 shadow-3xs ring-2 ring-blue-500/20'
              }`}>
                <div className="flex items-center justify-between font-black text-[11px] mb-1">
                  <span>المرحلة 1: تأكيد المشاركة</span>
                  {isConfirmed ? (
                    <span className="text-emerald-700 text-[10px] font-extrabold flex items-center gap-0.5">
                      ✓ مكتملة
                    </span>
                  ) : (
                    <span className="text-blue-700 text-[10px] font-extrabold">الآن 👈</span>
                  )}
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-600">
                  حجز مقعد المؤسسة في البطولة وضمان حضورها الرسمي في البرمجة والقرعة.
                </p>
              </div>

              {/* Phase 2 */}
              <div className={`p-3 rounded-xl border transition-all ${
                isConfirmed
                  ? 'bg-white border-blue-400 text-blue-950 shadow-3xs ring-2 ring-blue-500/20'
                  : 'bg-white/60 border-slate-200 text-slate-500'
              }`}>
                <div className="flex items-center justify-between font-black text-[11px] mb-1">
                  <span>المرحلة 2: أسماء التلاميذ</span>
                  <span className="text-amber-600 text-[10px] font-extrabold">قبل نهاية الأجل ⏳</span>
                </div>
                <p className="text-[10.5px] leading-relaxed text-slate-600">
                  اختيار وتعيين لائحة المشاركين الممثلين للمؤسسة وإدخال بياناتهم وصورهم.
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
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-slate-600 border-b border-slate-200/80 pb-2">
              <span className="font-bold flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                <span>المؤسسة التعليمية:</span>
              </span>
              <span className="font-black text-slate-900 text-xs">
                {schoolName || 'لم تحدد المؤسسة بعد'}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600 border-b border-slate-200/80 pb-2">
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

          {/* Already confirmed info banner */}
          {isConfirmed && confirmedRecord && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 space-y-1">
              <div className="flex items-center gap-2 font-black text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>مشاركة المؤسسة مؤكدة رسمياً</span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                تم تسجيل التأكيد بتاريخ{' '}
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

          {/* Notes input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              ملاحظات أو الفئات المستهدفة (اختياري):
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: ستشارك المؤسسة بفريق الصغار والفتيان، وجاري انتقاء التلاميذ..."
              disabled={isConfirmed}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-blue-600 focus:outline-none transition-all disabled:opacity-60"
            />
          </div>

          {/* Deadline expired warning */}
          {isDeadlinePassed && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 flex items-center gap-2 font-bold text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>انتهى آخر أجل مخصص للتسجيل في هذه البطولة.</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="w-full sm:w-auto flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              إغلاق
            </button>

            {isConfirmed && (
              <button
                type="button"
                disabled={isCancelling}
                onClick={handleCancelConfirmation}
                className="w-full sm:w-auto px-3.5 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                title="إلغاء تأكيد مشاركة المؤسسة"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isCancelling ? 'جاري الإلغاء...' : 'إلغاء التأكيد'}</span>
              </button>
            )}
          </div>

          <div className="w-full sm:w-auto flex items-center gap-2 justify-end">
            {isConfirmed ? (
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
                <span>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد مشاركة المؤسسة رسمياً (المرحلة 1) ✓'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
