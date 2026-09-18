import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { compressImageToBase64 } from '../lib/imageUtils';
import { CameraCaptureModal } from './CameraCaptureModal';
import { School, User } from '../types';
import {
  User as UserIcon,
  MapPin,
  CreditCard,
  Award,
  Mail,
  Phone,
  Save,
  AlertCircle,
  X,
  Camera,
  Upload,
  Trash2,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  KeyRound,
  ShieldCheck,
  Clock,
  ArrowRightLeft,
  CheckCircle2
} from 'lucide-react';
import toast from 'react-hot-toast';

export const TeacherProfileModal: React.FC = () => {
  const { userProfile, updateProfileState, isProfileModalOpen, setIsProfileModalOpen, closeProfileModal } = useAuth();
  const [loading, setLoading] = useState(false);

  // Form state
  const [fullName, setFullName] = useState('');
  const [workLocation, setWorkLocation] = useState('');
  const [schoolAccessCodeInput, setSchoolAccessCodeInput] = useState('');
  const [showAccessCodeField, setShowAccessCodeField] = useState(false);
  const [leaseNumber, setLeaseNumber] = useState('');
  const [teachingCadre, setTeachingCadre] = useState<'PRIMARY' | 'MIDDLE' | 'HIGH' | string>('HIGH');
  const [refereeSpecialty, setRefereeSpecialty] = useState<string[]>([]);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [directorates, setDirectorates] = useState<any[]>([]);
  const [schools, setSchools] = useState<School[]>([]);

  // Transfer request state
  const [wantTransfer, setWantTransfer] = useState(false);
  const [targetDirectorateId, setTargetDirectorateId] = useState('');
  const [targetDirectoratePin, setTargetDirectoratePin] = useState('');
  const [showTargetPin, setShowTargetPin] = useState(false);
  const [isCancellingTransfer, setIsCancellingTransfer] = useState(false);

  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const dismissedAutoPromptRef = useRef(false);
  const mobileCameraInputRef = useRef<HTMLInputElement>(null);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);

  const handleClose = () => {
    sessionStorage.setItem('teacher_profile_prompt_dismissed', 'true');
    localStorage.setItem('teacher_profile_prompt_dismissed_global', 'true');
    if (userProfile?.id) {
      localStorage.setItem(`teacher_profile_prompt_dismissed_${userProfile.id}`, 'true');
    }
    if (userProfile?.email) {
      localStorage.setItem(`teacher_profile_prompt_dismissed_${userProfile.email}`, 'true');
    }
    dismissedAutoPromptRef.current = true;
    closeProfileModal();
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }

    try {
      setIsProcessingPhoto(true);
      // Compress to lightweight Base64 to save storage space and bandwidth
      const compressed = await compressImageToBase64(file, {
        maxWidth: 320,
        maxHeight: 320,
        quality: 0.82
      });
      setPhotoUrl(compressed);
      toast.success('تمت معالجة وضغط الصورة بنجاح');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء معالجة الصورة');
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  // Check if teacher profile is incomplete on first load (only trigger if not dismissed by user)
  useEffect(() => {
    if (userProfile && userProfile.role === 'TEACHER' && !dismissedAutoPromptRef.current) {
      const isDismissed = sessionStorage.getItem('teacher_profile_prompt_dismissed') === 'true' ||
        localStorage.getItem('teacher_profile_prompt_dismissed_global') === 'true' ||
        (userProfile.id && localStorage.getItem(`teacher_profile_prompt_dismissed_${userProfile.id}`) === 'true') ||
        (userProfile.email && localStorage.getItem(`teacher_profile_prompt_dismissed_${userProfile.email}`) === 'true');
      if (isDismissed) {
        dismissedAutoPromptRef.current = true;
        return;
      }
      const isIncomplete = !userProfile.workLocation || !userProfile.leaseNumber;
      if (isIncomplete) {
        setIsProfileModalOpen(true);
      }
    }
  }, [userProfile, setIsProfileModalOpen]);

  // Load directorates & schools list
  useEffect(() => {
    if (isProfileModalOpen) {
      DataService.getDirectorates().then(list => {
        setDirectorates(list);
      }).catch(err => {
        console.error("Error loading directorates:", err);
      });

      DataService.getSchools().then(list => {
        setSchools(list);
      }).catch(err => {
        console.error("Error loading schools:", err);
      });

      const unsub = DataService.subscribeToSchools(list => {
        setSchools(list);
      });
      return () => unsub();
    }
  }, [isProfileModalOpen]);

  // Active directorate and filtered schools by cycle
  const activeDirId = userProfile?.directorateId || DataService.getActiveDirectorateId();
  const activeDir = directorates.find(d => d.id === activeDirId);
  const selectedCycleType = teachingCadre === 'PRIMARY' ? 'ابتدائي' : teachingCadre === 'MIDDLE' ? 'إعدادي' : 'تأهيلي';
  const filteredSchools = schools.filter(s =>
    s &&
    s.name &&
    !s.name.includes('الكندي') &&
    !s.name.includes('غير محدد') &&
    (s.directorateId === activeDirId || (!s.directorateId && activeDirId === 'taourirt')) &&
    s.type === selectedCycleType
  );

  // Handle ESC key press to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isProfileModalOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isProfileModalOpen]);

  // Sync form data when modal opens or userProfile changes
  useEffect(() => {
    if (userProfile && isProfileModalOpen) {
      setFullName(userProfile.fullName || '');
      setWorkLocation(userProfile.workLocation || '');
      setSchoolAccessCodeInput('');
      setShowAccessCodeField(false);
      setLeaseNumber(userProfile.leaseNumber || '');
      setTeachingCadre(userProfile.teachingCadre || 'HIGH');
      setRefereeSpecialty(
        Array.isArray(userProfile.refereeSpecialty)
          ? userProfile.refereeSpecialty
          : userProfile.refereeSpecialty
          ? [userProfile.refereeSpecialty]
          : []
      );
      setPhone(userProfile.phone || '');
      setEmail(userProfile.email || '');
      setPhotoUrl(userProfile.photoUrl || '');
      setWantTransfer(false);
      setTargetDirectorateId('');
      setTargetDirectoratePin('');
      setShowTargetPin(false);
    }
  }, [userProfile, isProfileModalOpen]);

  if (!isProfileModalOpen || !userProfile) return null;

  const isIncomplete = userProfile.role === 'TEACHER' && (!userProfile.workLocation || !userProfile.leaseNumber);
  const currentDirId = userProfile.directorateId || 'taourirt';
  const currentDirObj = directorates.find(d => d.id === currentDirId);
  const currentDirName = currentDirObj ? currentDirObj.name : (userProfile.directorateName || 'المديرية الإقليمية بتاوريرت');
  const hasPendingTransfer = userProfile.pendingTransfer && userProfile.pendingTransfer.status === 'pending';

  // Cancel pending transfer
  const handleCancelTransfer = async () => {
    if (!userProfile) return;
    try {
      setIsCancellingTransfer(true);
      await DataService.cancelTeacherTransfer(userProfile.id);
      updateProfileState({ pendingTransfer: null });
      toast.success('تم إلغاء طلب الانتقال بنجاح.');
    } catch (err) {
      console.error("Error cancelling transfer:", err);
      toast.error('حدث خطأ أثناء إلغاء طلب الانتقال');
    } finally {
      setIsCancellingTransfer(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!fullName.trim()) {
      toast.error('الرجاء إدخال الإسم الكامل');
      return;
    }
    if (!workLocation.trim()) {
      toast.error('الرجاء اختيار مؤسستك التعليمية من لائحة المؤسسات المعتمدة');
      return;
    }
    if (!leaseNumber.trim()) {
      toast.error('الرجاء إدخال رقم التأجير');
      return;
    }
    if (!phone.trim()) {
      toast.error('الرجاء إدخال رقم الهاتف');
      return;
    }

    // School Access Code Validation
    if (showAccessCodeField) {
      if (!schoolAccessCodeInput.trim()) {
        toast.error('الرجاء إدخال رمز الأمان السري للمؤسسة لتأكيد انتمائك إليها');
        return;
      }
      const targetSchool = schools.find(s => s.name === workLocation);
      if (!targetSchool) {
        toast.error('المؤسسة التعليمية المحددة غير صالحة');
        return;
      }
      if (!targetSchool.accessCode || targetSchool.accessCode.trim() !== schoolAccessCodeInput.trim()) {
        toast.error('رمز الأمان السري للمؤسسة غير صحيح! المرجو التأكد من الرمز وإعادة المحاولة.');
        return;
      }
    }

    setLoading(true);
    try {
      let updatedPendingTransfer = userProfile.pendingTransfer;

      // Handle Transfer Request if toggled on
      if (wantTransfer) {
        if (!targetDirectorateId) {
          toast.error('المرجو اختيار المديرية الإقليمية المراد الانتقال إليها');
          setLoading(false);
          return;
        }
        if (targetDirectorateId === currentDirId) {
          toast.error('أنت منتمٍ بالفعل لهذه المديرية الإقليمية');
          setLoading(false);
          return;
        }
        if (!targetDirectoratePin.trim()) {
          toast.error('المرجو إدخال القن السري (PIN) الخاص بالمديرية المستهدفة');
          setLoading(false);
          return;
        }

        // Verify PIN and submit transfer request securely
        const transferResult = await DataService.requestTeacherTransfer(
          userProfile.id,
          targetDirectorateId,
          targetDirectoratePin.trim()
        );

        if (!transferResult.success) {
          toast.error(transferResult.message);
          setLoading(false);
          return;
        }

        updatedPendingTransfer = transferResult.transfer;
      }

      const matchedSchool = schools.find(s => s.name === workLocation.trim());
      const schoolId = matchedSchool ? matchedSchool.id : null;

      // Update basic profile info in current directorate (remains in current directorate until manager approval)
      const updatedData: Partial<User> = {
        fullName: fullName.trim(),
        workLocation: workLocation.trim(),
        schoolId: schoolId || undefined,
        leaseNumber: leaseNumber.trim(),
        teachingCadre: (teachingCadre as any) || 'HIGH',
        refereeSpecialty: refereeSpecialty || [],
        phone: phone.trim(),
        photoUrl: photoUrl || '',
        email: userProfile.email || email.trim(),
        directorateId: currentDirId,
        directorateName: currentDirName,
        pendingTransfer: updatedPendingTransfer || undefined,
        updatedAt: new Date()
      };

      // 1. Update in backend/local cache
      await DataService.updateUserProfile(userProfile.id || `teacher-${Date.now()}`, updatedData);

      // 2. Update in Auth state
      updateProfileState(updatedData);
      if (userProfile.id) {
        localStorage.removeItem(`teacher_profile_prompt_dismissed_${userProfile.id}`);
      }

      if (wantTransfer) {
        toast.success('تم حفظ البيانات وتقديم طلب الانتقال بنجاح! في انتظار موافقة المسؤول الإقليمي للمديرية الجديدة.');
      } else {
        toast.success('تم حفظ وتحديث البيانات الشخصية بنجاح!');
      }
      closeProfileModal();
    } catch (error) {
      console.error('Error updating teacher profile:', error);
      toast.error('حدث خطأ أثناء حفظ البيانات. يرجى المحاولة لاحقاً.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
      dir="rtl"
      onClick={handleClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-800 p-5 text-white relative shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/10 rounded-lg">
                <UserIcon className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold">
                  {isIncomplete ? 'استكمال البيانات الشخصية للأستاذ' : 'الملف الشخصي وتعديل البيانات'}
                </h3>
                <p className="text-xs text-blue-100/80 mt-0.5">
                  {isIncomplete
                    ? 'يرجى ملء الاستمارة لتفعيل حسابكم وتسهيل تواصل الإدارة معكم'
                    : 'يمكنك تعديل معلوماتك الشخصية وصورتك ومقر عملك وتخصصاتك في التحكيم'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {isIncomplete && (
            <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg flex gap-2.5 text-amber-800 text-[11px] leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                مرحباً بك! لإتمام إعداد حسابكم الرياضي وتعيينكم في لجان التحكيم، يرجى استكمال رقم التأجير، مقر العمل، ورقم الهاتف وتخصص التحكيم.
              </span>
            </div>
          )}

          {/* Teacher Photo Upload Box (Compressed & Mobile Camera) */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt={fullName || 'Teacher photo'}
                    className="w-16 h-16 rounded-full object-cover border-2 border-blue-500 shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-slate-200 border-2 border-slate-300 flex items-center justify-center text-slate-400">
                    <UserIcon className="w-8 h-8" />
                  </div>
                )}
                {photoUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoUrl('')}
                    className="absolute -top-1 -right-1 bg-red-600 hover:bg-red-700 text-white p-1 rounded-full shadow cursor-pointer transition-transform hover:scale-110"
                    title="حذف الصورة"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">صورة الأستاذ(ة) المؤطر(ة)</span>
                  {photoUrl && (
                    <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      ✓ تم تسجيل الصورة
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                  يمكنك التقاط صورتك مباشرة عبر كاميرا هاتفك المحمول أو رفع صورة من جهازك.
                </p>
                {isProcessingPhoto && (
                  <span className="text-[10px] text-blue-600 font-bold animate-pulse block mt-1">
                    جاري ضغط ومعالجة الصورة...
                  </span>
                )}
              </div>
            </div>

            {/* Quick Action Buttons for Camera & File */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
              <button
                type="button"
                onClick={() => mobileCameraInputRef.current?.click()}
                className="py-2 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>التقاط بالكاميرا مباشرة 📸</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                className="py-2 px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>فتح الكاميرا المباشرة 📷</span>
              </button>

              <button
                type="button"
                onClick={() => fileUploadInputRef.current?.click()}
                className="sm:col-span-2 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>اختيار صورة من ملفات الجهاز 📁</span>
              </button>
            </div>

            {/* Native Mobile Camera Input */}
            <input
              ref={mobileCameraInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {/* File Upload Input */}
            <input
              ref={fileUploadInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoSelect}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <UserIcon className="h-3.5 w-3.5 text-slate-400" />
                <span>الإسم الكامل *</span>
              </label>
              <input
                type="text"
                required
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                placeholder="مثال: أحمد العمراني"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>

            {/* Teaching Cadre */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-slate-400" />
                <span>الإطار التعليمي للأستاذ(ة) *</span>
              </label>
              <select
                value={teachingCadre}
                onChange={(e) => setTeachingCadre(e.target.value)}
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-bold text-slate-800 cursor-pointer"
              >
                <option value="PRIMARY">🏫 أستاذ التعليم الابتدائي</option>
                <option value="MIDDLE">📘 أستاذ التعليم الثانوي الإعدادي</option>
                <option value="HIGH">🎓 أستاذ التعليم الثانوي التأهيلي</option>
              </select>
            </div>

            {/* Email (Read Only) */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-slate-400" />
                <span>البريد الإلكتروني (غير قابل للتعديل)</span>
              </label>
              <input
                type="email"
                disabled
                className="w-full text-xs px-3 py-2.5 bg-slate-100 text-slate-500 border border-slate-200 rounded-lg cursor-not-allowed font-mono"
                value={email}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Lease Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                  <span>رقم التأجير *</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                  placeholder="مثال: 1245789"
                  value={leaseNumber}
                  onChange={(e) => setLeaseNumber(e.target.value)}
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  <span>رقم الهاتف *</span>
                </label>
                <input
                  type="tel"
                  required
                  className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                  placeholder="مثال: 0661234567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
            </div>

            {/* Current Directorate Display (Locked & Verified) */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span>المديرية الإقليمية المعتمدة حالياً:</span>
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300/60">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>معتمدة ونشطة</span>
                </span>
              </div>
              <div className="font-bold text-slate-900 text-xs px-3 py-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <span>📍 {currentDirName}</span>
                <span className="text-[10px] font-normal text-slate-500">
                  (تحدد نطاق بطولاتك ومؤسستك)
                </span>
              </div>
            </div>

            {/* Pending Transfer Alert Card (if currently pending approval) */}
            {hasPendingTransfer && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50/80 border border-amber-300/80 rounded-2xl p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <Clock className="w-4 h-4 text-amber-600 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>طلب انتقال قيد الانتظار والمراجعة ⏳</span>
                  </div>
                  <span className="text-[10px] font-black bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full border border-amber-300">
                    قيد مصادقة المسؤول الإقليمي
                  </span>
                </div>

                <div className="text-xs text-slate-700 space-y-1.5 bg-white/70 rounded-xl p-3 border border-amber-200/60">
                  <p className="flex items-center justify-between">
                    <span className="text-slate-500 font-semibold">المديرية المستهدفة للانتقال:</span>
                    <span className="font-black text-blue-900">📍 {userProfile.pendingTransfer?.targetDirectorateName}</span>
                  </p>
                  <p className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">تاريخ تقديم الطلب:</span>
                    <span className="font-mono text-slate-700">
                      {userProfile.pendingTransfer?.requestedAt ? new Date(userProfile.pendingTransfer.requestedAt).toLocaleDateString('ar-MA') : 'حديثاً'}
                    </span>
                  </p>
                  <div className="pt-2 border-t border-amber-100 flex items-start gap-2 text-[11px] text-amber-800 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                    <span>تم التحقق من القن السري بنجاح. كإجراء احترازي، لا يتم نقلك مباشرة إلى المديرية الجديدة إلا بعد موافقة ومصادقة المسير الإقليمي لتلك المديرية.</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCancelTransfer}
                  disabled={isCancellingTransfer}
                  className="w-full py-2 px-3 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>{isCancellingTransfer ? 'جاري إلغاء الطلب...' : 'إلغاء طلب الانتقال'}</span>
                </button>
              </div>
            )}

            {/* Secure Directorate Transfer Request Section (when no transfer is pending) */}
            {!hasPendingTransfer && (
              <div className="border border-blue-100 bg-blue-50/40 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft className="w-4 h-4 text-blue-700" />
                    <span className="text-xs font-bold text-blue-950">الانتقال إلى مديرية إقليمية أخرى</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWantTransfer(!wantTransfer);
                      if (wantTransfer) {
                        setTargetDirectorateId('');
                        setTargetDirectoratePin('');
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      wantTransfer
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white text-blue-700 border border-blue-300 hover:bg-blue-100'
                    }`}
                  >
                    {wantTransfer ? 'إلغاء الطلب' : 'طلب انتقال +'}
                  </button>
                </div>

                {wantTransfer && (
                  <div className="pt-2 border-t border-blue-200/60 space-y-3 animate-in slide-in-from-top-1 duration-200">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-[11px] text-amber-900 leading-relaxed font-medium flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        <strong>إجراء احترازي وأمني:</strong> يتطلب الانتقال إدخال القن السري الخاص بالمديرية المستهدفة. لن يتم نقلك مباشرة إلى المديرية الجديدة، بل سيتم إرسال طلب رسمي ينتظر موافقة ومصادقة المسير الإقليمي لتلك المديرية.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        اختر المديرية الإقليمية المستهدفة *
                      </label>
                      <select
                        value={targetDirectorateId}
                        onChange={(e) => setTargetDirectorateId(e.target.value)}
                        className="w-full text-xs px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 cursor-pointer"
                        required={wantTransfer}
                      >
                        <option value="">-- حدد المديرية الإقليمية المراد الانتقال إليها --</option>
                        {directorates
                          .filter(dir => dir.id !== currentDirId)
                          .map(dir => (
                            <option key={dir.id} value={dir.id}>
                              📍 {dir.name} ({dir.region || 'جهة الشرق'})
                            </option>
                          ))}
                      </select>
                    </div>

                    {targetDirectorateId && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1 text-amber-900 font-bold">
                            <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                            <span>القن السري للمديرية المستهدفة (PIN) *</span>
                          </span>
                          <span className="text-[10px] text-slate-500">مسلم من إدارة المديرية المستقبلة</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showTargetPin ? "text" : "password"}
                            required={wantTransfer}
                            value={targetDirectoratePin}
                            onChange={(e) => setTargetDirectoratePin(e.target.value)}
                            placeholder="أدخل القن السري للمديرية الجديدة"
                            className="w-full pl-10 pr-3 py-2 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-center tracking-wider text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowTargetPin(!showTargetPin)}
                            className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                            title={showTargetPin ? "إخفاء القن" : "إظهار القن"}
                          >
                            {showTargetPin ? <EyeOff className="w-4 h-4 text-amber-600" /> : <Eye className="w-4 h-4 text-amber-600" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Educational Cycle Selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Award className="h-3.5 w-3.5 text-slate-400" />
                  <span>السلك التعليمي للأستاذ(ة) *</span>
                </span>
                <span className="text-[10px] text-slate-500 font-normal">
                  اختر السلك لعرض مؤسساته
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'PRIMARY', label: 'الابتدائي', icon: '🏫', type: 'ابتدائي' },
                  { id: 'MIDDLE', label: 'الثانوي الإعدادي', icon: '📘', type: 'إعدادي' },
                  { id: 'HIGH', label: 'الثانوي التأهيلي', icon: '🎓', type: 'تأهيلي' }
                ].map(cycle => (
                  <button
                    key={cycle.id}
                    type="button"
                    onClick={() => {
                      setTeachingCadre(cycle.id);
                      setWorkLocation('');
                    }}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                      teachingCadre === cycle.id
                        ? 'bg-blue-50 border-blue-500 text-blue-900 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm mb-0.5">{cycle.icon}</span>
                    <span className="text-center text-[11px]">{cycle.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Approved Work Location (School) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>مقر العمل (المؤسسة التعليمية المعتمدة) *</span>
                </span>
                {filteredSchools.length > 0 && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    {filteredSchools.length} مؤسسة مسجلة
                  </span>
                )}
              </label>

              {filteredSchools.length > 0 ? (
                <div className="space-y-3">
                  <select
                    required
                    value={workLocation}
                    onChange={(e) => {
                      const newLoc = e.target.value;
                      setWorkLocation(newLoc);
                      if (newLoc && newLoc.trim() !== (userProfile?.workLocation || '').trim()) {
                        setShowAccessCodeField(true);
                      } else {
                        setShowAccessCodeField(false);
                      }
                    }}
                    className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-bold cursor-pointer"
                  >
                    <option value="">-- اختر مؤسستك التعليمية من اللائحة المعتمدة --</option>
                    {filteredSchools.map(sch => (
                      <option key={sch.id} value={sch.name}>
                        {sch.name} {sch.commune ? `(${sch.commune})` : ''}
                      </option>
                    ))}
                  </select>

                  {showAccessCodeField && (
                    <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="flex items-center gap-1.5">
                        <KeyRound className="h-4 w-4 text-blue-600 shrink-0" />
                        <span className="text-xs font-bold text-blue-900">رمز الدخول السري للمؤسسة (Access Code) *</span>
                      </div>
                      <p className="text-[10px] text-blue-800 leading-relaxed">
                        لكي نتحقق من هويتك كأستاذ ينتمي لهذه المؤسسة، يرجى إدخال رمز الولوج السري المكون من 6 أحرف وأرقام. (يمكنك الحصول عليه من مدير المؤسسة أو من المسؤول الإقليمي بالمديرية).
                      </p>
                      <div className="relative">
                        <input
                          type="text"
                          maxLength={6}
                          value={schoolAccessCodeInput}
                          onChange={(e) => setSchoolAccessCodeInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                          placeholder="أدخل الرمز المكون من 6 أحرف وأرقام"
                          className="w-full text-center tracking-[0.5em] font-mono text-sm px-3 py-2.5 bg-white border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-black text-blue-950"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-amber-900 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        لم يقم المسؤول الإقليمي أو المركزي بإدراج مؤسسات سلك ({selectedCycleType}) بـ {activeDir?.name || 'المديرية'} بعد.
                      </p>
                      <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                        لتفادي تكرار واختلاف أسماء المؤسسات، يجب على المسؤول الإقليمي أو المركزي إضافة المؤسسة التعليمية إلى المنصة أولاً لتتمكن من اختيارها.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-slate-500 mt-1">
                * يتم اختيار المؤسسة حصراً من اللائحة الرسمية المعتمدة من طرف المسؤول الإقليمي أو المركزي.
              </p>
            </div>

            {/* Sports Specialization in Refereeing */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-slate-400" />
                <span>التخصصات الرياضية في التحكيم (يمكن اختيار أكثر من تخصص)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(SPORTS_MAP).map(([key, sport]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      if (refereeSpecialty.includes(key)) {
                        setRefereeSpecialty(refereeSpecialty.filter(s => s !== key));
                      } else {
                        setRefereeSpecialty([...refereeSpecialty, key]);
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                      refereeSpecialty.includes(key)
                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <span>{sport.icon}</span>
                    <span>{sport.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {isIncomplete ? 'إغلاق ومتابعة لاحقاً' : 'إلغاء'}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'جاري حفظ البيانات...' : (isIncomplete ? 'حفظ البيانات والاستمرار' : 'حفظ التعديلات')}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(capturedBase64) => {
          setPhotoUrl(capturedBase64);
        }}
        title="التقاط صورة الأستاذ(ة) المؤطر(ة)"
      />
    </div>
  );
};


