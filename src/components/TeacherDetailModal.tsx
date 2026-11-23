import React from 'react';
import { User, Student, School } from '../types';
import { SPORTS_MAP } from '../lib/dataService';
import {
  getWhatsAppUrl,
  isValidPhoneNumber,
  generateTeacherSecurityCodeWhatsAppMessage
} from '../lib/whatsappService';
import {
  X,
  User as UserIcon,
  MapPin,
  CreditCard,
  Award,
  Phone,
  Mail,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building,
  Users,
  Copy,
  Check,
  Pencil,
  LogIn,
  KeyRound,
  MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface TeacherDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User | null;
  teacherStudents?: Student[];
  matchedSchool?: School | null;
  canSendSecurityCode?: boolean;
  onEditRole?: (teacher: User) => void;
  onImpersonateTeacher?: (teacher: User) => void;
}

export const TeacherDetailModal: React.FC<TeacherDetailModalProps> = ({
  isOpen,
  onClose,
  teacher,
  teacherStudents = [],
  matchedSchool,
  canSendSecurityCode = false,
  onEditRole,
  onImpersonateTeacher
}) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [customPhone, setCustomPhone] = React.useState<string>('');

  React.useEffect(() => {
    setCustomPhone(teacher?.phone || '');
  }, [teacher?.id, teacher?.phone]);

  if (!isOpen || !teacher) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`تم نسخ ${fieldName} للحافظة`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const getCadreLabel = (cadre?: string) => {
    switch (cadre) {
      case 'PRIMARY':
        return { text: 'أستاذ التعليم الابتدائي', bg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30' };
      case 'MIDDLE':
        return { text: 'أستاذ الثانوي الإعدادي', bg: 'bg-indigo-500/20 text-indigo-200 border-indigo-400/30' };
      case 'HIGH':
      default:
        return { text: 'أستاذ الثانوي التأهيلي', bg: 'bg-purple-500/20 text-purple-200 border-purple-400/30' };
    }
  };

  const isProfileComplete = !!(teacher.workLocation && teacher.leaseNumber);

  const specialties = Array.isArray(teacher.refereeSpecialty)
    ? teacher.refereeSpecialty
    : teacher.refereeSpecialty
    ? [teacher.refereeSpecialty]
    : [];

  const techCommitteeSports = teacher.techCommitteeSports || [];
  const techCommitteeMemberSports = teacher.techCommitteeSportsMemberOf || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-5 md:p-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-2xl font-black shrink-0 overflow-hidden shadow-inner">
              {teacher.photoUrl ? (
                <img src={teacher.photoUrl} alt={teacher.fullName} className="w-full h-full object-cover" />
              ) : (
                <span>{teacher.fullName[0]?.toUpperCase()}</span>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${getCadreLabel(teacher.teachingCadre).bg}`}>
                  {getCadreLabel(teacher.teachingCadre).text}
                </span>

                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  {teacher.isSuperAdmin
                    ? 'المسؤول المركزي'
                    : teacher.role === 'CENTRAL_ADMIN'
                    ? 'مسير إقليمي'
                    : teacher.role === 'SPORT_MANAGER'
                    ? 'منسق مادة التربية البدنية بالمؤسسة'
                    : teacher.isTechCommitteeHead
                    ? 'رئيس لجنة تقنية إقليمية'
                    : teacher.isTechCommitteeMember
                    ? 'عضو لجنة تقنية إقليمية'
                    : 'أستاذ مؤطر'}
                </span>

                <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                  isProfileComplete
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {isProfileComplete ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  <span>{isProfileComplete ? 'ملف شخصي مكتمل' : 'ملف يحتاج استكمال'}</span>
                </span>
              </div>

              <h2 className="text-lg md:text-xl font-extrabold text-white mt-1.5 leading-tight">
                {teacher.fullName}
              </h2>
              <p className="text-xs text-emerald-100 font-medium mt-0.5">
                {teacher.workLocation ? `مؤطر أستاذ بـ: ${teacher.workLocation}` : 'أستاذ بالمديرية الإقليمية بتاوريرت'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 md:p-6 space-y-5 max-h-[75vh] overflow-y-auto bg-slate-50/50">

          {/* Key Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Lease Number */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-3xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block uppercase flex items-center gap-1">
                <CreditCard className="h-3.5 w-3.5 text-blue-600" />
                <span>رقم التأجير الوزاري:</span>
              </span>
              <div className="flex items-center justify-between">
                <strong className="text-sm font-black font-mono text-slate-800">
                  {teacher.leaseNumber || 'غير محدد بعد'}
                </strong>
                {teacher.leaseNumber && (
                  <button
                    onClick={() => handleCopy(teacher.leaseNumber || '', 'رقم التأجير')}
                    className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="نسخ رقم التأجير"
                  >
                    {copiedField === 'رقم التأجير' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* School / Work Location */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-3xs space-y-1">
              <span className="text-[10px] font-bold text-slate-400 block uppercase flex items-center gap-1">
                <Building className="h-3.5 w-3.5 text-blue-600" />
                <span>المؤسسة التعليمية (مقر العمل):</span>
              </span>
              <strong className="text-xs font-bold text-slate-800 block truncate">
                {teacher.workLocation || 'لم يتم إدخال المؤسسة بعد'}
              </strong>
            </div>
          </div>

          {/* Contact Methods */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Phone className="h-4 w-4 text-blue-600" />
              <span>معلومات وسوائل التواصل:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Phone */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-slate-400 block">الهاتف:</span>
                  <span className="font-bold text-slate-800 font-mono" dir="ltr">
                    {teacher.phone || 'غير مسجل'}
                  </span>
                </div>
                {teacher.phone && (
                  <a
                    href={`tel:${teacher.phone}`}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer"
                  >
                    اتصال
                  </a>
                )}
              </div>

              {/* Email */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div className="space-y-0.5 overflow-hidden">
                  <span className="text-[10px] font-bold text-slate-400 block">البريد الإلكتروني:</span>
                  <span className="font-bold text-slate-800 truncate block text-[11px]">
                    {teacher.email}
                  </span>
                </div>
                <a
                  href={`mailto:${teacher.email}`}
                  className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  تراسل
                </a>
              </div>
            </div>
          </div>

          {/* Direct Security Code WhatsApp Card (Privileged Admins) */}
          {canSendSecurityCode && matchedSchool?.accessCode && (() => {
            const targetPhone = customPhone.trim() || teacher.phone || '';
            const hasPhone = isValidPhoneNumber(targetPhone);
            const waMessage = generateTeacherSecurityCodeWhatsAppMessage({
              teacherName: teacher.fullName,
              schoolName: matchedSchool.name,
              accessCode: matchedSchool.accessCode
            });
            const waUrl = getWhatsAppUrl(targetPhone, waMessage);

            return (
              <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-3xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-emerald-200/70">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-emerald-950">
                        رمز الأمان الخاص بالمؤسسة ({matchedSchool.name})
                      </h4>
                      <p className="text-[10px] text-emerald-800 font-semibold">
                        إرسال رمز الأمان مباشرة للأستاذ(ة) المعني(ة) عبر الواتساب
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-xl border border-emerald-200">
                    <span className="font-mono font-black text-sm text-emerald-900 tracking-wider">
                      {matchedSchool.accessCode}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(matchedSchool.accessCode || '', 'رمز الأمان')}
                      className="p-1 text-emerald-700 hover:bg-emerald-50 rounded-md transition-colors cursor-pointer"
                      title="نسخ رمز الأمان"
                    >
                      {copiedField === 'رمز الأمان' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="tel"
                      dir="ltr"
                      value={customPhone}
                      onChange={e => setCustomPhone(e.target.value)}
                      placeholder="رقم الواتساب (مثال: 0661234567)"
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-emerald-200 rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      toast.success(
                        hasPhone
                          ? `تم فتح واتساب لإرسال رمز الأمان مباشرة إلى ${teacher.fullName}`
                          : 'تم فتح واتساب مع الرسالة الجاهزة — اختر جهة الاتصال للإرسال'
                      );
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  >
                    <MessageCircle className="h-4 w-4 shrink-0" />
                    <span>{hasPhone ? 'إرسال رمز الأمان عبر واتساب' : 'فتح واتساب واختيار جهة الاتصال'}</span>
                  </a>
                </div>
              </div>
            );
          })()}

          {/* Sports Specialties & Roles */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Award className="h-4 w-4 text-purple-600" />
              <span>التخصصات الرياضية ومهام التحكيم والتأطير:</span>
            </h4>

            <div className="space-y-2">
              {/* Referee Specialties */}
              <div>
                <span className="text-[11px] font-bold text-slate-500 block mb-1.5">تخصصات التحكيم والإشراف الرياضي:</span>
                <div className="flex flex-wrap gap-2">
                  {specialties.length > 0 ? (
                    specialties.map(spec => {
                      const sport = SPORTS_MAP[spec];
                      const specDiploma = teacher.refereeDiplomas?.[spec] || teacher.refereeDiploma;
                      return (
                        <div key={spec} className="inline-flex items-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-900 border border-purple-200 rounded-xl text-xs font-bold">
                          <span>{sport?.icon || '🏆'}</span>
                          <span>{sport?.name || spec}</span>
                          {specDiploma && (
                            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
                              🏅 {specDiploma}
                            </span>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400 italic">لم يتم تحديد تخصصات تحكيم بعد</span>
                  )}
                </div>
              </div>

              {/* Technical Committee Responsibilities */}
              {teacher.isTechCommitteeHead && techCommitteeSports.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-blue-700 block mb-1.5 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                    <span>رئيس لجنة تقنية إقليمية مكلف بالرياضات التالية:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {techCommitteeSports.map(spec => {
                      const sport = SPORTS_MAP[spec];
                      return (
                        <span key={spec} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-xl text-xs font-bold">
                          <span>{sport?.icon || '🏆'}</span>
                          <span>{sport?.name || spec}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Technical Committee Member Responsibilities */}
              {teacher.isTechCommitteeMember && techCommitteeMemberSports.length > 0 && (
                <div className="pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-indigo-700 block mb-1.5 flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-indigo-600" />
                    <span>عضو لجنة تقنية إقليمية مكلف بالرياضات التالية:</span>
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {techCommitteeMemberSports.map(spec => {
                      const sport = SPORTS_MAP[spec];
                      return (
                        <span key={spec} className="inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-xl text-xs font-bold">
                          <span>{sport?.icon || '🏆'}</span>
                          <span>{sport?.name || spec}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Registered Students Summary under this Teacher */}
          {teacherStudents.length > 0 && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-emerald-600" />
                  <span>التلاميذ والفرق المؤطرة ({teacherStudents.length} تلميذ/ة):</span>
                </h4>
              </div>

              <div className="max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs">
                {teacherStudents.map((st) => (
                  <div key={st.id} className="py-1.5 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-800">{st.fullName}</span>
                      <span className="text-[10px] text-slate-400 mr-2">({st.category})</span>
                    </div>
                    <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      {SPORTS_MAP[st.sportId]?.name || st.sportId}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {onImpersonateTeacher && teacher.role !== 'CENTRAL_ADMIN' && !teacher.isSuperAdmin && (
              <button
                type="button"
                onClick={() => onImpersonateTeacher(teacher)}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-xs cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>الدخول بصفة الأستاذ</span>
              </button>
            )}
            {onEditRole && (
              <button
                type="button"
                onClick={() => onEditRole(teacher)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                <Pencil className="h-3.5 w-3.5" />
                <span>تعديل صفة الأستاذ والإطار</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors mr-auto"
          >
            إغلاق البطاقة
          </button>
        </div>

      </div>
    </div>
  );
};
