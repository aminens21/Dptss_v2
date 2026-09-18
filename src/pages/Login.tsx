import React, { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth, isSuperAdminEmail } from '../contexts/AuthContext';
import {
  LogIn,
  Building2,
  Sparkles,
  ShieldCheck,
  User as UserIcon,
  Mail,
  KeyRound,
  CreditCard,
  Phone,
  MapPin,
  Award,
  Camera,
  UploadCloud,
  Trash2,
  ArrowRight,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  Search,
  Check
} from 'lucide-react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Role, Directorate, School } from '../types';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { AppLogo } from '../components/AppLogo';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { currentUser, userProfile, loading, updateProfileState, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  
  // View mode: 'LOGIN' (Google Sign In screen) or 'REGISTER_TEACHER' (complete teacher profile after Google auth)
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER_TEACHER'>('LOGIN');

  // Directorates dynamic list
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  useEffect(() => {
    DataService.getDirectorates().then(dirs => setDirectorates(dirs));
    
    setLoadingSchools(true);
    DataService.getSchools().then(schs => {
      setSchools(schs);
      setLoadingSchools(false);
    }).catch(err => {
      console.warn("Could not load schools in Login:", err);
      setLoadingSchools(false);
    });

    const unsub = DataService.subscribeToSchools((liveSchools) => {
      setSchools(liveSchools);
    });
    return () => unsub();
  }, []);

  // Teacher Registration Form states (completed with Google info)
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDirectorateId, setRegDirectorateId] = useState<string>('taourirt');
  const [regDirectorateCode, setRegDirectorateCode] = useState<string>('');
  const [showRegPin, setShowRegPin] = useState(false);
  const [regWorkLocation, setRegWorkLocation] = useState('');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState(false);
  const [regLeaseNumber, setRegLeaseNumber] = useState('');
  const [regTeachingCadre, setRegTeachingCadre] = useState<'PRIMARY' | 'MIDDLE' | 'HIGH'>('HIGH');
  const [regRefereeSpecialty, setRegRefereeSpecialty] = useState<string[]>([]);
  const [regPhone, setRegPhone] = useState('');
  const [regPhoto, setRegPhoto] = useState<string>('');
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filtered approved schools by directorate and cycle
  const selectedCycleType = regTeachingCadre === 'PRIMARY' ? 'ابتدائي' : regTeachingCadre === 'MIDDLE' ? 'إعدادي' : 'تأهيلي';
  const filteredSchools = [...schools]
    .filter(s => 
      s && 
      s.name && 
      !s.name.includes('غير محدد') &&
      (s.directorateId === regDirectorateId || (!s.directorateId && regDirectorateId === 'taourirt')) &&
      s.type === selectedCycleType
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

  // Selected directorate object
  const selectedDirObj = directorates.find(d => d.id === regDirectorateId);

  // Determine if existing user is already registered with complete data
  const isProfileComplete = Boolean(
    userProfile && (
      userProfile.isSuperAdmin ||
      userProfile.role === 'CENTRAL_ADMIN' ||
      userProfile.role === 'SPORT_MANAGER' ||
      (userProfile.directorateId && (userProfile.workLocation || userProfile.leaseNumber))
    )
  );

  // If user is authenticated and already registered, redirect to dashboard
  useEffect(() => {
    if (!loading && currentUser && isProfileComplete && mode !== 'REGISTER_TEACHER') {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, currentUser, isProfileComplete, mode, navigate]);

  // Handle Photo upload / resizing
  const handleProcessPhotoFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صالح (JPG, PNG, WebP)');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 8 ميغابايت');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setRegPhoto(dataUrl);
          toast.success('تم إرفاق صورة الأستاذ بنجاح');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Google Sign-In Flow:
  // Google verifies the account. If registered -> direct login. If not registered -> transition to teacher registration.
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      const cleanEmail = (googleUser.email || '').toLowerCase().trim();

      // 1. Check if Super Admin
      if (isSuperAdminEmail(cleanEmail)) {
        toast.success(`مرحباً بك! تم تسجيل الدخول بصلاحيات المشرف العام المركزي (${cleanEmail})`);
        return;
      }

      // 2. Check if Provincial Directorate Admin
      const dirs = await DataService.getDirectorates();
      const managedDir = dirs.find(d => (d.adminEmails || []).some(ae => ae.trim().toLowerCase() === cleanEmail));
      if (managedDir) {
        toast.success(`مرحباً بك! تم تسجيل الدخول كمسير إقليمي لـ ${managedDir.name}`);
        return;
      }

      // 3. Check if Teacher is already registered in Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', googleUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.directorateId && (data.leaseNumber || data.workLocation)) {
            // Already registered!
            DataService.setActiveDirectorateId(data.directorateId);
            toast.success(`مرحباً بك ذ. ${data.fullName || googleUser.displayName || ''}! تم تسجيل الدخول بنجاح`);
            return;
          }
        }
      } catch (checkErr) {
        console.warn("Error checking user doc in Firestore:", checkErr);
      }

      // 4. If not registered or incomplete: transition to Teacher Registration page
      setRegFullName(''); // Keep empty so user types their name in Arabic
      setRegEmail(cleanEmail);
      setRegPhoto(googleUser.photoURL || '');
      setMode('REGISTER_TEACHER');
      toast('يرجى استكمال بيانات التسجيل وكتابة الإسم الكامل بالعربية', { icon: 'ℹ️' });

    } catch (error: any) {
      console.error("Google sign in error:", error);
      if (error?.code === 'auth/popup-closed-by-user') {
        toast.error('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية');
      } else if (error?.code === 'auth/unauthorized-domain') {
        toast.error('هذا النطاق غير مصرح له في إعدادات Firebase Authentication. يرجى إضافة رابط التطبيق إلى Authorized Domains أو استخدام وضع المعاينة السريعة.');
      } else if (error?.code === 'auth/cancelled-popup-request') {
        // user clicked again
      } else {
        toast.error('حدث خطأ في الاتصال بـ Google. تأكد من تفعيل "Google Sign-In" في وحدة تحكم Firebase.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit complete teacher registration form
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = regEmail.trim().toLowerCase();

    if (!regFullName.trim()) {
      toast.error('يرجى إدخال الإسم الكامل للأستاذ');
      return;
    }
    if (!cleanEmail) {
      toast.error('البريد الإلكتروني مفقود');
      return;
    }
    if (!regDirectorateId) {
      toast.error('يرجى اختيار المديرية الإقليمية');
      return;
    }
    if (!regDirectorateCode.trim()) {
      toast.error('يرجى إدخال القن السري للمديرية الإقليمية للتحقق');
      return;
    }
    if (!regLeaseNumber.trim()) {
      toast.error('يرجى إدخال رقم التأجير');
      return;
    }
    if (!regWorkLocation.trim()) {
      toast.error('يرجى اختيار مؤسستك التعليمية من لائحة المؤسسات المعتمدة');
      return;
    }

    // Verify Directorate PIN
    const isValidCode = await DataService.verifyDirectorateCode(regDirectorateId, regDirectorateCode);
    if (!isValidCode) {
      toast.error('القن السري للمديرية الإقليمية غير صحيح. يرجى مراجعة المنسق الإقليمي للمديرية.');
      return;
    }

    const targetDir = directorates.find(d => d.id === regDirectorateId);
    const dirName = targetDir?.name || 'المديرية الإقليمية';

    setIsSubmitting(true);

    const teacherData = {
      fullName: regFullName.trim(),
      email: cleanEmail,
      role: 'TEACHER' as Role,
      directorateId: regDirectorateId,
      directorateName: dirName,
      workLocation: regWorkLocation.trim(),
      leaseNumber: regLeaseNumber.trim(),
      teachingCadre: regTeachingCadre || 'HIGH',
      refereeSpecialty: regRefereeSpecialty,
      phone: regPhone.trim(),
      photoUrl: regPhoto || '',
      isActive: true
    };

    try {
      const targetUid = currentUser?.uid || `usr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;

      // Update Firebase Auth user display name & photo if available
      if (currentUser) {
        try {
          await updateProfile(currentUser, {
            displayName: regFullName.trim(),
            photoURL: regPhoto || currentUser.photoURL
          });
        } catch (upErr) {
          console.warn("Could not update auth profile:", upErr);
        }
      }

      // Save user doc to Firestore
      await setDoc(doc(db, 'users', targetUid), {
        id: targetUid,
        ...teacherData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Update local storage backup for offline/fast load
      try {
        const localAccountsRaw = localStorage.getItem('local_registered_users');
        const accounts: Array<any> = localAccountsRaw ? JSON.parse(localAccountsRaw) : [];
        const existingIdx = accounts.findIndex(a => a.email.toLowerCase() === cleanEmail);
        const newRecord = { id: targetUid, ...teacherData };
        if (existingIdx >= 0) {
          accounts[existingIdx] = newRecord;
        } else {
          accounts.push(newRecord);
        }
        localStorage.setItem('local_registered_users', JSON.stringify(accounts));
      } catch (e) {
        console.warn("Local storage cache write error:", e);
      }

      // Set active directorate
      DataService.setActiveDirectorateId(regDirectorateId);

      // Update Auth Context state
      updateProfileState({
        id: targetUid,
        ...teacherData
      });

      toast.success(`مرحباً بك أستاذ ${regFullName.trim()} ضمن أطر ${dirName}!`);
      setMode('LOGIN');

    } catch (err: any) {
      console.error("Teacher registration error:", err);
      toast.error('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Cancel / Sign Out from Google
  const handleCancelRegistration = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Signout error:", e);
    }
    setMode('LOGIN');
    setRegFullName('');
    setRegEmail('');
    setRegPhoto('');
    setRegDirectorateCode('');
    setRegLeaseNumber('');
    setRegWorkLocation('');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-8" dir="rtl">
      <div className="w-full max-w-lg space-y-4">
        
        {/* Main Card */}
        <div className="rounded-3xl bg-white p-6 md:p-8 border border-slate-200/80 shadow-xl shadow-slate-200/50 space-y-6">
          
          {/* Brand Header */}
          <div className="text-center flex flex-col items-center">
            <AppLogo size={72} className="mx-auto mb-2" />
            <h2 className="text-xl font-black tracking-tight text-slate-900">
              منظومة تدبير أنشطة وبطولات الرياضة المدرسية
            </h2>
            <div className="flex items-center gap-1.5 mt-1.5 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>فضاء المديريات الإقليمية بالمملكة المغربية</span>
            </div>
          </div>

          {/* VIEW 1: GOOGLE SIGN IN (Official Google Verification) */}
          {mode === 'LOGIN' && (
            <div className="space-y-5 pt-2">
              <div className="text-center space-y-1.5">
                <p className="text-sm font-bold text-slate-800">
                  تسجيل الدخول الموحد بحساب Google
                </p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  يتم التحقق من الحساب الرسمي مباشرة عبر Google. إذا كنت مسجلاً مسبقاً ستلج مباشرة إلى مديريتك، وإذا كنت مستخدماً جديداً ستنتقل لاستكمال بياناتك.
                </p>
              </div>

              {/* Official Google Sign-In Button */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isSubmitting}
                className="w-full py-3.5 px-5 bg-white hover:bg-slate-50 border-2 border-slate-200 hover:border-slate-300 text-slate-800 font-bold rounded-2xl shadow-sm hover:shadow-md transition-all text-xs sm:text-sm flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-50"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isSubmitting ? 'جاري التحقق عبر Google...' : 'المتابعة باستخدام حساب Google (Gmail)'}</span>
              </button>

              {/* Divider & Demo Sign-In Section */}
              <div className="relative pt-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-500 font-bold">أو الدخول بصفة تجريبية (Demo)</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => loginAsDemo('CENTRAL_ADMIN')}
                  className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-right transition-colors cursor-pointer group"
                >
                  <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">المسير المركزي</p>
                  <p className="text-[10px] text-slate-500">مشرف المنظومة والمتابعة</p>
                </button>

                <button
                  type="button"
                  onClick={() => loginAsDemo('SPORT_MANAGER')}
                  className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-right transition-colors cursor-pointer group"
                >
                  <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">مسؤول رياضة</p>
                  <p className="text-[10px] text-slate-500">تدبير البطولات والأنشطة</p>
                </button>

                <button
                  type="button"
                  onClick={() => loginAsDemo('TEACHER')}
                  className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-right transition-colors cursor-pointer group"
                >
                  <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">أستاذ التربية البدنية</p>
                  <p className="text-[10px] text-slate-500">تسجيل التلاميذ والفرق</p>
                </button>

                <button
                  type="button"
                  onClick={() => loginAsDemo('REFEREE')}
                  className="p-2.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-right transition-colors cursor-pointer group"
                >
                  <p className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">حكم معتمد</p>
                  <p className="text-[10px] text-slate-500">إدارة المباريات والنتائج</p>
                </button>
              </div>
            </div>
          )}

          {/* VIEW 2: COMPLETE TEACHER REGISTRATION & DIRECTORATE ASSIGNMENT */}
          {mode === 'REGISTER_TEACHER' && (
            <form className="space-y-4 pt-1" onSubmit={handleCompleteRegistration}>
              
              {/* Google Verified Account Card */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-blue-300 bg-white shrink-0 flex items-center justify-center">
                    {regPhoto ? (
                      <img src={regPhoto} alt="Google Avatar" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-blue-700 font-bold text-sm">G</span>
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-blue-950 truncate">
                      تم التحقق من حساب Google:
                    </p>
                    <p className="text-[11px] text-blue-700 font-mono truncate" dir="ltr">
                      {regEmail}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancelRegistration}
                  className="px-2.5 py-1 text-[11px] text-red-600 hover:bg-red-50 rounded-lg font-bold transition-colors cursor-pointer shrink-0 flex items-center gap-1"
                >
                  <LogOut className="w-3 h-3" />
                  <span>تغيير الحساب</span>
                </button>
              </div>

              {/* Step 1: Directorate Selection & PIN Verification */}
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-900">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <span>1. تحديد المديرية الإقليمية والقن السري التابع لها:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      المديرية الإقليمية *
                    </label>
                    <select
                      value={regDirectorateId}
                      onChange={(e) => setRegDirectorateId(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {directorates.map(dir => (
                        <option key={dir.id} value={dir.id}>
                          {dir.shortName || dir.name} ({dir.region})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-emerald-600" />
                      القن السري للمديرية *
                    </label>
                    <div className="relative">
                      <input
                        type={showRegPin ? "text" : "password"}
                        required
                        value={regDirectorateCode}
                        onChange={(e) => setRegDirectorateCode(e.target.value)}
                        placeholder="القن السري الخاص بالمديرية"
                        className="w-full pl-10 pr-3 py-2 bg-white border border-emerald-300 rounded-xl text-xs font-mono font-bold text-center tracking-wider text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPin(!showRegPin)}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                        title={showRegPin ? "إخفاء القن" : "إظهار القن"}
                      >
                        {showRegPin ? <EyeOff className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4 text-emerald-600" />}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-emerald-800 leading-normal">
                  * يتم تزويدك بالقن السري من طرف منسق أو مسير مديريتك الإقليمية لربط حسابك بأنشطة ومؤسسات مديريتك حصراً.
                </p>
              </div>

              {/* Step 2: Teacher Identity Details */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2 text-xs font-black text-slate-900 border-b border-slate-100 pb-2">
                  <UserIcon className="w-4 h-4 text-slate-600" />
                  <span>2. البيانات المهنية للأستاذ:</span>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الإسم الكامل للأستاذ(ة) باللغة العربية *
                  </label>
                  <input
                    type="text"
                    required
                    className="block w-full rounded-xl border border-slate-200 px-3.5 py-2 text-slate-800 placeholder-slate-400 text-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
                    placeholder="اكتب الإسم والنسب بالعربية (مثال: ذ. محمد المرابط)"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Lease Number */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                      <span>رقم التأجير (SOM) *</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="block w-full rounded-xl border border-slate-200 px-3.5 py-2 text-slate-800 placeholder-slate-400 text-xs font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
                      placeholder="مثال: 1254890"
                      value={regLeaseNumber}
                      onChange={(e) => setRegLeaseNumber(e.target.value)}
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>رقم الهاتف</span>
                    </label>
                    <input
                      type="tel"
                      className="block w-full rounded-xl border border-slate-200 px-3.5 py-2 text-slate-800 placeholder-slate-400 text-xs font-mono focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-slate-50/50"
                      placeholder="مثال: 0661234567"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Educational Cycle Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
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
                          setRegTeachingCadre(cycle.id as any);
                          setRegWorkLocation('');
                          setSchoolSearchQuery('');
                          setIsSchoolDropdownOpen(false);
                        }}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          regTeachingCadre === cycle.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-base mb-1">{cycle.icon}</span>
                        <span className="text-center">{cycle.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Approved School Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>مقر العمل (المؤسسة التعليمية المعتمدة) *</span>
                    </span>
                    {filteredSchools.length > 0 && (
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {filteredSchools.length} مؤسسة مسجلة
                      </span>
                    )}
                  </label>

                  {filteredSchools.length > 0 ? (
                    <div className="relative">
                      {/* Toggle Button */}
                      <button
                        type="button"
                        onClick={() => setIsSchoolDropdownOpen(!isSchoolDropdownOpen)}
                        className="flex justify-between items-center w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 text-xs font-bold bg-white focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-xs text-right"
                      >
                        <span className={regWorkLocation ? 'text-slate-800' : 'text-slate-400 font-medium'}>
                          {regWorkLocation || '-- اكتب حرفاً أو كلمة للبحث واختيار مؤسستك --'}
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                      </button>

                      {/* Backdrop for click away */}
                      {isSchoolDropdownOpen && (
                        <div 
                          className="fixed inset-0 z-40 cursor-default" 
                          onClick={() => setIsSchoolDropdownOpen(false)} 
                        />
                      )}

                      {/* Dropdown Panel */}
                      {isSchoolDropdownOpen && (
                        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
                          {/* Search Input */}
                          <div className="relative border-b border-slate-100 p-2 bg-slate-50/50 flex items-center">
                            <Search className="absolute right-4.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                            <input
                              type="text"
                              value={schoolSearchQuery}
                              onChange={(e) => setSchoolSearchQuery(e.target.value)}
                              className="w-full pr-8 pl-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-slate-700"
                              placeholder="اكتب كلمة أو حرفاً من اسم المؤسسة للبحث..."
                              autoFocus
                            />
                          </div>

                          {/* List */}
                          <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                            {filteredSchools.filter(sch => 
                              !schoolSearchQuery || 
                              sch.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()) ||
                              (sch.commune && sch.commune.toLowerCase().includes(schoolSearchQuery.toLowerCase()))
                            ).length === 0 ? (
                              <div className="p-4 text-center text-slate-400 text-xs font-semibold">
                                لا توجد مؤسسة مطابقة للبحث
                              </div>
                            ) : (
                              filteredSchools.filter(sch => 
                                !schoolSearchQuery || 
                                sch.name.toLowerCase().includes(schoolSearchQuery.toLowerCase()) ||
                                (sch.commune && sch.commune.toLowerCase().includes(schoolSearchQuery.toLowerCase()))
                              ).map(sch => (
                                <button
                                  key={sch.id}
                                  type="button"
                                  onClick={() => {
                                    setRegWorkLocation(sch.name);
                                    setIsSchoolDropdownOpen(false);
                                    setSchoolSearchQuery('');
                                  }}
                                  className="flex items-center justify-between w-full px-3.5 py-2.5 text-right text-xs font-bold text-slate-700 hover:bg-emerald-50/50 hover:text-emerald-950 transition-colors cursor-pointer"
                                >
                                  <span>
                                    {sch.name} {sch.commune ? `(${sch.commune})` : ''}
                                  </span>
                                  {regWorkLocation === sch.name && (
                                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                                  )}
                                </button>
                              ))
                            )}
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
                            لم يقم المسؤول الإقليمي أو المركزي بإدراج مؤسسات سلك ({selectedCycleType}) بـ {selectedDirObj?.name || 'المديرية'} بعد.
                          </p>
                          <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                            لتفادي تكرار واختلاف أسماء المؤسسات، يجب على المسؤول الإقليمي أو المركزي إضافة المؤسسة التعليمية إلى المنصة أولاً لتتمكن من اختيارها والتسجيل بها.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-1">
                    * يتم اختيار المؤسسة حصراً من بين المؤسسات الرسمية التي أضافها المسؤول الإقليمي أو المركزي لضمان دقة وتوحيد البيانات.
                  </p>
                </div>

                {/* Referee Specialty */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                    <Award className="h-3.5 w-3.5 text-slate-400" />
                    <span>التخصصات الرياضية في التحكيم</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(SPORTS_MAP).map(([key, sport]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (regRefereeSpecialty.includes(key)) {
                            setRegRefereeSpecialty(regRefereeSpecialty.filter(s => s !== key));
                          } else {
                            setRegRefereeSpecialty([...regRefereeSpecialty, key]);
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer ${
                          regRefereeSpecialty.includes(key)
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{sport.icon}</span>
                        <span>{sport.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Photo custom replacement */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5 text-slate-400" />
                    <span>الصورة الشخصية للأستاذ (اختيارية)</span>
                  </label>

                  {regPhoto ? (
                    <div className="flex items-center gap-3 p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                      <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-500 shadow-sm shrink-0 bg-white">
                        <img src={regPhoto} alt="صورة الأستاذ" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs font-bold text-slate-800">تم اعتماد الصورة</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRegPhoto('')}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="حذف الصورة"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDraggingPhoto(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        setIsDraggingPhoto(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingPhoto(false);
                        const files = e.dataTransfer.files;
                        if (files && files.length > 0) {
                          handleProcessPhotoFile(files[0]);
                        }
                      }}
                      onClick={() => {
                        const input = document.getElementById('reg-teacher-photo-input') as HTMLInputElement;
                        input?.click();
                      }}
                      className="border border-dashed border-slate-300 hover:border-emerald-400 bg-slate-50/50 hover:bg-slate-50 rounded-xl p-2.5 text-center cursor-pointer transition-all flex items-center justify-center gap-2"
                    >
                      <input
                        type="file"
                        id="reg-teacher-photo-input"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files;
                          if (files && files.length > 0) {
                            handleProcessPhotoFile(files[0]);
                          }
                        }}
                      />
                      <UploadCloud className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-bold text-slate-600">انقر لتغيير الصورة الشخصية</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  type="submit"
                  disabled={isSubmitting || filteredSchools.length === 0 || !regWorkLocation}
                  className="flex w-full justify-center items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:shadow-none transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    {isSubmitting
                      ? 'جاري التحقق وحفظ البيانات...'
                      : filteredSchools.length === 0
                      ? 'في انتظار إضافة مؤسسات السلك من المسؤول الإقليمي'
                      : !regWorkLocation
                      ? 'يرجى اختيار مؤسستك التعليمية من اللائحة أعلاه'
                      : 'تأكيد التسجيل والدخول إلى المنظومة'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleCancelRegistration}
                  className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  إلغاء والعودة لصفحة الدخول
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Footer Note */}
        <p className="text-center text-[11px] text-slate-500 font-medium">
          الجامعة الملكية المغربية للرياضة المدرسية – منصة المديريات الإقليمية © 2026
        </p>
      </div>
    </div>
  );
};
