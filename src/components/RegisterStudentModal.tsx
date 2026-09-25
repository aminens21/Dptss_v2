import React, { useState, useEffect, useMemo } from 'react';
import { Sport, Student, School, Tournament } from '../types';
import { DataService, getAgeCategoriesForSeason, SPORTS_MAP, getCategoryGenderLabel, validateBirthDateForCategory, normalizeCategoryKey, isSchoolLevelAllowedForTournament, getTournamentLevelAr, isTeacherLevelAllowedForTournament } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
import { X, GraduationCap, User, Calendar, Upload, AlertCircle, Lock, ShieldCheck, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface RegisterStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | null;
  preselectedCategory?: string;
  preselectedGender?: 'Male' | 'Female';
  preselectedAffiliation?: 'non_club' | 'club_affiliated';
  schools: School[];
  registrationDeadline?: any;
  onRegistered: () => void;
  preselectedSchoolName?: string;
  tournaments?: Tournament[];
}

export const RegisterStudentModal: React.FC<RegisterStudentModalProps> = ({
  isOpen,
  onClose,
  sport,
  preselectedCategory,
  preselectedGender,
  preselectedAffiliation,
  schools,
  registrationDeadline,
  onRegistered,
  preselectedSchoolName,
  tournaments = []
}) => {
  const { userProfile } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [massarNumber, setMassarNumber] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female'>(preselectedGender || 'Male');
  const [birthDate, setBirthDate] = useState('');
  const [category, setCategory] = useState(preselectedCategory || 'U15');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [participationType, setParticipationType] = useState<'individual' | 'school_team'>('individual');
  const [affiliationType, setAffiliationType] = useState<'non_club' | 'club_affiliated'>(preselectedAffiliation || 'non_club');
  const [athleticsSpecialty, setAthleticsSpecialty] = useState('');
  const [photo, setPhoto] = useState('');
  const [coachName, setCoachName] = useState(userProfile?.fullName || '');
  const [coachLeaseNumber, setCoachLeaseNumber] = useState(userProfile?.leaseNumber || '');
  const [coachPhone, setCoachPhone] = useState(userProfile?.phone || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSeason, setCurrentSeason] = useState('2026/2027');

  useEffect(() => {
    DataService.getActiveSeason().then(setCurrentSeason);
  }, []);

  const effectiveLockedAffiliation = preselectedAffiliation === 'open' ? null : preselectedAffiliation;

  useEffect(() => {
    if (isOpen) {
      setCategory(preselectedCategory || 'U15');
      setGender(preselectedGender || 'Male');
      setAffiliationType(preselectedAffiliation === 'club_affiliated' ? 'club_affiliated' : 'non_club');

      // Reset text inputs to prevent stale data between modal openings
      setFullName('');
      setMassarNumber('');
      setBirthDate('');
      setPhoto('');
      setAthleticsSpecialty('');
      setCoachName(userProfile?.fullName || '');
      setCoachLeaseNumber(userProfile?.leaseNumber || '');
      setCoachPhone(userProfile?.phone || '');
    }
  }, [isOpen, preselectedCategory, preselectedGender, preselectedAffiliation, userProfile]);

  // Synchronize school auto-selection based on preselectedSchoolName or userProfile and schools list
  useEffect(() => {
    if (isOpen) {
      if (preselectedSchoolName) {
        const match = schools.find(s => 
          s.name && (
            s.name.trim().toLowerCase() === preselectedSchoolName.trim().toLowerCase() ||
            s.name.includes(preselectedSchoolName) ||
            preselectedSchoolName.includes(s.name)
          )
        );
        if (match) {
          setSelectedSchoolId(match.id);
          return;
        }
      }
      if (userProfile?.workLocation) {
        const match = schools.find(s => 
          s.name && (
            s.name.trim().toLowerCase() === userProfile.workLocation!.trim().toLowerCase() ||
            s.name.includes(userProfile.workLocation!) ||
            userProfile.workLocation!.includes(s.name)
          )
        );
        if (match) {
          setSelectedSchoolId(match.id);
        } else {
          setSelectedSchoolId('');
        }
      } else {
        setSelectedSchoolId('');
      }
    }
  }, [isOpen, preselectedSchoolName, userProfile, schools]);

  const isExpired = useMemo(() => {
    if (!registrationDeadline) return false;
    let targetDate: Date;
    if (typeof registrationDeadline === 'object' && registrationDeadline !== null && 'toDate' in registrationDeadline && typeof registrationDeadline.toDate === 'function') {
      targetDate = registrationDeadline.toDate();
    } else if (registrationDeadline instanceof Date) {
      targetDate = registrationDeadline;
    } else {
      targetDate = new Date(registrationDeadline);
    }
    return !isNaN(targetDate.getTime()) && targetDate.getTime() < Date.now();
  }, [registrationDeadline]);

  const birthDateValidation = useMemo(() => {
    if (!birthDate || !category) return { isValid: true };
    return validateBirthDateForCategory(birthDate, category, currentSeason, gender, sport?.id);
  }, [birthDate, category, currentSeason, gender, sport?.id]);

  if (!isOpen || !sport) return null;

  const seasonalCategories = getAgeCategoriesForSeason(currentSeason, undefined, sport?.id);
  const baseCategories = (sport.ageCategories && sport.ageCategories.length > 0)
    ? sport.ageCategories.map(normalizeCategoryKey)
    : seasonalCategories.map(c => c.id);

  const availableCategories = useMemo(() => {
    // If not a teacher, show everything
    if (userProfile?.role !== 'TEACHER' || !userProfile?.teachingCadre) return baseCategories;

    // Filter categories based on teacher cadre
    const cadre = userProfile.teachingCadre.toUpperCase();
    return baseCategories.filter(catId => {
      const norm = normalizeCategoryKey(catId);
      if (cadre.includes('PRIMARY')) return norm === 'U12';
      if (cadre.includes('MIDDLE')) return norm === 'U15';
      if (cadre.includes('HIGH') || cadre.includes('SECONDARY')) return norm === 'U18' || norm === 'U20';
      return true;
    });
  }, [baseCategories, userProfile]);

  const handleBirthDateChange = (newDate: string) => {
    setBirthDate(newDate);
    if (!newDate) return;

    const parts = newDate.split('-');
    const year = parseInt(parts[0], 10);
    if (isNaN(year) || year < 1990 || year > 2030) return;

    const match = currentSeason.match(/(\d{4})/);
    const startYear = match ? parseInt(match[1], 10) : 2026;

    let detectedCatId = '';
    if (year >= startYear - 11) {
      detectedCatId = 'U12';
    } else if (year >= startYear - 14 && year <= startYear - 12) {
      detectedCatId = 'U15';
    } else if (year >= startYear - 17 && year <= startYear - 15) {
      detectedCatId = 'U18';
    } else {
      detectedCatId = 'U20';
    }

    if (preselectedCategory) {
      // Keep category strictly locked to the preselected tournament category, but validate and warn if birth date is outside allowed range
      const validation = validateBirthDateForCategory(newDate, preselectedCategory, currentSeason, gender, sport?.id);
      if (!validation.isValid && validation.errorMessage) {
        toast.error(validation.errorMessage, { duration: 4000 });
      }
      return;
    }

    if (detectedCatId) {
      setCategory(detectedCatId);
    }
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً (يجب أن يكون أقل من 2 ميغابايت)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhoto(reader.result as string);
      toast.success('تم تحميل الصورة الشخصية بنجاح');
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isExpired) {
      toast.error('انتهى أجل التسجيل المحدد لهذه البطولة ولا يمكن إضافة مشاركين جديد!');
      return;
    }

    if (!fullName.trim()) {
      toast.error('يرجى إدخال اسم ونسب التلميذ(ة)');
      return;
    }

    const massarRegex = /^[A-Z]\d{9}$/;
    const cleanMassar = massarNumber.trim().toUpperCase();
    if (!cleanMassar) {
      toast.error('يرجى إدخال رقم مسار للتلميذ(ة)');
      return;
    }
    if (!massarRegex.test(cleanMassar)) {
      toast.error('رقم مسار إجباري ويجب أن يتكون من حرف لاتيني كبير متبوعاً بـ 9 أرقام (مثال: F212121212)');
      return;
    }
    if (!birthDate) {
      toast.error('يرجى اختيار تاريخ الميلاد');
      return;
    }
    if (!category) {
      toast.error('يرجى اختيار الفئة الرياضية');
      return;
    }

    // Strict validation for birth date matching the category
    const validation = validateBirthDateForCategory(birthDate, category, currentSeason, gender, sport?.id);
    if (!validation.isValid) {
      toast.error(validation.errorMessage || 'خطأ في تاريخ الازدياد لا يتناسب مع الفئة المعنية');
      return;
    }

    if (sport.id === 'athletics' && !athleticsSpecialty) {
      toast.error('يرجى تحديد تخصص ألعاب القوى');
      return;
    }

    setIsSubmitting(true);
    try {
      let resolvedSchoolName = userProfile?.workLocation || '';
      let resolvedSchoolId = userProfile?.id || '';

      if (userProfile?.role === 'TEACHER') {
        if (!userProfile?.workLocation) {
          toast.error('يرجى تحديد مقر عملك (المؤسسة التعليمية) في ملفك الشخصي لتسجيل تلاميذ مؤسستك.');
          setIsSubmitting(false);
          return;
        }
        const matched = schools.find(s => s.name === userProfile.workLocation || s.name.includes(userProfile.workLocation!));
        resolvedSchoolName = userProfile.workLocation;
        resolvedSchoolId = matched ? matched.id : `sch-${userProfile.workLocation.replace(/\s+/g, '-')}`;
      } else {
        const chosenSchool = schools.find(s => s.id === selectedSchoolId);
        if (chosenSchool) {
          resolvedSchoolName = chosenSchool.name;
          resolvedSchoolId = chosenSchool.id;
        } else {
          toast.error('يرجى اختيار المؤسسة التعليمية للتلميذ من لائحة المؤسسات المعتمدة.');
          setIsSubmitting(false);
          return;
        }
      }

      const activeSchoolObj = userProfile?.role === 'TEACHER'
        ? schools.find(s => s.name === userProfile.workLocation || s.name.includes(userProfile.workLocation!))
        : schools.find(s => s.id === selectedSchoolId);

      if (activeSchoolObj && tournaments && tournaments.length > 0) {
        const normCategory = normalizeCategoryKey(category);
        const relevantTournament = tournaments.find(t => 
          t.sportId === sport.id && 
          (normalizeCategoryKey(t.ageCategory) === normCategory || normalizeCategoryKey(t.ageCategory) === 'جميع الفئات') &&
          (t.gender === gender || t.gender === 'Mixed')
        );
        if (relevantTournament && relevantTournament.level) {
          const isAllowed = isSchoolLevelAllowedForTournament(activeSchoolObj.type, relevantTournament.level);
          if (!isAllowed) {
            toast.error(`عذراً، السلك التعليمي لمؤسسة "${activeSchoolObj.name}" (${activeSchoolObj.type}) غير مسموح له بالمشاركة في هذه البطولة المخصصة لـ (${getTournamentLevelAr(relevantTournament.level)})`);
            setIsSubmitting(false);
            return;
          }

          // Check teacher cadre (extra safety)
          if (userProfile?.teachingCadre && !isTeacherLevelAllowedForTournament(userProfile.teachingCadre, relevantTournament.level)) {
            const cadreAr = userProfile.teachingCadre.includes('PRIMARY') ? 'ابتدائي' : userProfile.teachingCadre.includes('MIDDLE') ? 'إعدادي' : 'تأهيلي';
            toast.error(`عذراً، بصفتك أستاذ سلك (${cadreAr})، لا يمكنك التسجيل في بطولة مخصصة لـ (${getTournamentLevelAr(relevantTournament.level)})`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      const studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> = {
        fullName: fullName.trim(),
        massarNumber: massarNumber.trim() || undefined,
        gender,
        birthDate,
        category,
        schoolId: resolvedSchoolId,
        schoolName: resolvedSchoolName,
        sportId: sport.id,
        photoUrl: photo || undefined,
        affiliationType,
        coachName: (coachName.trim() || userProfile?.fullName || '').trim() || undefined,
        coachLeaseNumber: (coachLeaseNumber.trim() || userProfile?.leaseNumber || '').trim() || undefined,
        coachPhone: (coachPhone.trim() || userProfile?.phone || '').trim() || undefined,
        ...(sport.id === 'cross_country' ? {
          participationType,
          distance: category === 'U12' ? '1500م' : category === 'U15' ? '2000م' : category === 'U18' ? '3000م' : '4000م'
        } : {}),
        ...(sport.id === 'athletics' ? {
          athleticsSpecialty
        } : {})
      };

      await DataService.addStudent(studentData);
      toast.success(`تم تسجيل التلميذ(ة) ${fullName} ببطولة ${sport.name} بنجاح!`);
      
      // Reset & close
      setFullName('');
      setMassarNumber('');
      setPhoto('');
      onRegistered();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء عملية التسجيل');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 relative z-[101]">
        
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-blue-900 to-slate-900 dark:from-slate-900 dark:to-indigo-950 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-300 flex items-center justify-center font-bold border border-blue-400/30 text-lg">
              🎓
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                تسجيل تلميذ(ة) جديد في بطولة {sport.name}
              </h3>
              <p className="text-[11px] text-slate-300 dark:text-slate-400">
                إدخال البيانات الرسمية المشاركة بالمؤسسة التعليمية
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Expired Warning Banner */}
        {isExpired && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/40 flex items-center gap-2.5 text-red-900 dark:text-red-300 text-xs font-bold transition-colors">
            <Lock className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />
            <div>
              <p>انتهى أجل التسجيل المحدد لهذه البطولة أوتوماتيكياً.</p>
              <p className="text-[10px] text-red-700 dark:text-red-400/70 font-normal mt-0.5">
                لا يمكن إضافة أو تعديل قائمة التلاميذ والفرق بعد انقضاء الوقت المحدد من طرف رئيس اللجنة التقنية.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Automatic Tournament Constraints Banner */}
          {(preselectedCategory || preselectedGender || preselectedAffiliation) && (
            <div className="p-3 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/90 dark:border-blue-800/50 rounded-2xl flex items-center justify-between gap-2 shadow-3xs transition-colors">
              <div className="flex items-center gap-2 text-xs font-bold text-blue-950 dark:text-blue-100">
                <span className="text-base">🔒</span>
                <span>
                  محدد ومقفل تلقائياً وفق شروط البطولة:{' '}
                  <strong className="text-blue-700 dark:text-blue-400">
                    {preselectedGender ? (gender === 'Male' ? 'ذكور 👦' : 'إناث 👧') : ''}
                    {preselectedGender && preselectedCategory ? ' • ' : ''}
                    {preselectedCategory ? `فئة ${getCategoryGenderLabel(category, gender, currentSeason)} 🏅` : ''}
                    {(preselectedGender || preselectedCategory) && preselectedAffiliation ? ' • ' : ''}
                    {preselectedAffiliation ? (affiliationType === 'club_affiliated' ? 'منتمين للأندية 🟡' : 'لا منتمين (مدرسي) ⚪') : ''}
                  </strong>
                </span>
              </div>
              <span className="text-[10px] font-black bg-blue-600 dark:bg-blue-700 text-white px-2 py-0.5 rounded-full shrink-0">
                التزام إجباري
              </span>
            </div>
          )}

          {/* Student Name, Massar ID & Photo */}
          <div className="flex items-start gap-3">
            <div className="flex-1 space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  الاسم والنسب الكامل للتلميذ(ة) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={isExpired}
                  placeholder="مثال: محمد العمراوي"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 transition-colors"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                    رقم مسار (Code Massar) *
                  </label>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold">
                    حرف + 9 أرقام
                  </span>
                </div>
                <input
                  type="text"
                  required
                  maxLength={10}
                  disabled={isExpired}
                  placeholder="مثال: F212121212"
                  value={massarNumber}
                  onChange={(e) => setMassarNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-mono font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 transition-colors uppercase"
                />
              </div>
            </div>

            {/* Photo Avatar */}
            <div className="flex flex-col items-center pt-1">
              <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                الصورة
              </label>
              <label className={`relative w-14 h-16 rounded-2xl border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden transition-all ${
                photo ? 'border-blue-500' : 'border-slate-300 dark:border-slate-700 hover:border-blue-400 bg-slate-50 dark:bg-slate-800'
              }`}>
                {photo ? (
                  <img src={photo} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-5 h-5 text-slate-400" />
                )}
                <input
                  type="file"
                  disabled={isExpired}
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Gender & BirthDate */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center justify-between">
                <span>الجنس وتحديد الفئات المسموحة <span className="text-red-500">*</span></span>
                {preselectedGender ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 flex items-center gap-1 transition-colors">
                    <Lock className="w-3 h-3" />
                    <span>مقفل وفق شروط البطولة</span>
                  </span>
                ) : (
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded border transition-colors ${
                    gender === 'Male' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800' : 'bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800'
                  }`}>
                    {gender === 'Male' ? '👦 فئات الذكور' : '👧 فئات الإناث'}
                  </span>
                )}
              </label>
              {preselectedGender ? (
                <div className="w-full text-xs px-3.5 py-2.5 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-bold flex items-center justify-between cursor-not-allowed select-none transition-colors">
                  <span className="flex items-center gap-2">
                    <span>{gender === 'Male' ? '👦' : '👧'}</span>
                    <span className="font-extrabold text-blue-950 dark:text-blue-100">{gender === 'Male' ? 'ذكر (فئات الذكور)' : 'أنثى (فئات الإناث)'}</span>
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> مقفل
                  </span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isExpired}
                    onClick={() => setGender('Male')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      gender === 'Male'
                        ? 'bg-blue-50 dark:bg-blue-900 border-blue-500 text-blue-700 dark:text-blue-100 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>👦</span>
                    <span>ذكر (فئات الذكور)</span>
                  </button>
                  <button
                    type="button"
                    disabled={isExpired}
                    onClick={() => setGender('Female')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      gender === 'Female'
                        ? 'bg-pink-50 dark:bg-pink-900 border-pink-500 text-pink-700 dark:text-pink-100 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
                    }`}
                  >
                    <span>👧</span>
                    <span>أنثى (فئات الإناث)</span>
                  </button>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  تاريخ الازدياد <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800 transition-colors">
                  {preselectedCategory ? 'مطابقة الفئة المقفلة' : 'إحالة مباشرة للفئة'}
                </span>
              </div>
              <input
                type="date"
                disabled={isExpired}
                value={birthDate}
                onChange={(e) => handleBirthDateChange(e.target.value)}
                className={`w-full text-xs rounded-xl border px-3 py-2.5 text-slate-800 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-700 focus:outline-none focus:ring-2 font-mono transition-colors ${
                  birthDate && !birthDateValidation.isValid
                    ? 'border-red-400 dark:border-red-600 ring-2 ring-red-200 dark:ring-red-900/30 focus:ring-red-500 bg-red-50/40 dark:bg-red-900/20 text-red-900 dark:text-red-100'
                    : 'border-slate-200 dark:border-slate-700 focus:ring-blue-500'
                } disabled:bg-slate-100 dark:disabled:bg-slate-900`}
              />
              {birthDate && !birthDateValidation.isValid && (
                <div className="mt-2 p-2.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 flex items-start gap-2 text-[11px] font-bold animate-in fade-in slide-in-from-top-1 duration-150 transition-colors">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-red-900 dark:text-red-100 font-black">{birthDateValidation.errorMessage}</p>
                    <p className="text-red-700 dark:text-red-400/80 text-[10px] font-semibold mt-0.5">
                      ⚠️ يرجى تصحيح تاريخ الازدياد ليتوافق مع السن المعتمد.
                    </p>
                  </div>
                </div>
              )}
              {birthDate && birthDateValidation.isValid && category && (
                <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                  gender === 'Male'
                    ? 'text-blue-800 bg-blue-50/90 border-blue-200'
                    : 'text-pink-800 bg-pink-50/90 border-pink-200'
                }`}>
                  <span className={gender === 'Male' ? 'text-blue-600' : 'text-pink-600'}>✓</span>
                  <span>
                    {preselectedCategory ? 'فئة التلميذ(ة) المقفلة بالبطولة:' : (gender === 'Male' ? 'تمت إحالة التلميذ مباشرة لفئة:' : 'تمت إحالة التلميذة مباشرة لفئة:')}{' '}
                    <strong className="underline">{getCategoryGenderLabel(category, gender, currentSeason)}</strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Category selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700">
                الفئة العمرية الرياضية ({gender === 'Male' ? 'فئات الذكور فقط' : 'فئات الإناث فقط'}) <span className="text-red-500">*</span>
              </label>
              {preselectedCategory ? (
                <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>مقفل وفق شروط البطولة</span>
                </span>
              ) : (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                  gender === 'Male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'
                }`}>
                  {gender === 'Male' ? 'فئات الذكور' : 'فئات الإناث'}
                </span>
              )}
            </div>
            {preselectedCategory ? (
              <div className="w-full text-xs px-3.5 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-slate-800 font-bold flex items-center justify-between cursor-not-allowed select-none">
                <span className="flex items-center gap-2">
                  <span>🏅</span>
                  <span className="font-extrabold text-blue-950">{getCategoryGenderLabel(category, gender, currentSeason)}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> مقفل
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableCategories.map(catId => {
                  const isSelected = category === catId;
                  return (
                    <button
                      type="button"
                      key={catId}
                      disabled={isExpired}
                      onClick={() => setCategory(catId)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-center ${
                        isSelected
                          ? gender === 'Male'
                            ? 'bg-blue-600 text-white border-blue-600 shadow-xs ring-2 ring-blue-300'
                            : 'bg-pink-600 text-white border-pink-600 shadow-xs ring-2 ring-pink-300'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <span>{getCategoryGenderLabel(catId, gender, currentSeason, sport?.id)}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* School selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
              <span>المؤسسة التعليمية</span>
              {userProfile?.role === 'TEACHER' && (
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60 transition-colors">
                  مؤسستك المعتمدة
                </span>
              )}
            </label>
            {userProfile?.role === 'TEACHER' ? (
              <div className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 font-bold flex items-center justify-between transition-colors">
                <span>{userProfile?.workLocation || 'يرجى تحديد المؤسسة في ملفكم الشخصي أولاً'}</span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">مغلق (مؤسستك فقط)</span>
              </div>
            ) : (
              <select
                disabled={isExpired}
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 transition-colors"
              >
                <option value="">-- {userProfile?.workLocation || 'اختر المؤسسة'} --</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.commune})</option>
                ))}
              </select>
            )}
          </div>

          {/* Athletics Specialization */}
          {sport.id === 'athletics' && (
            <div>
              <label className="block text-xs font-bold text-purple-900 mb-1">
                تخصص ألعاب القوى الفرعي <span className="text-red-500">*</span>
              </label>
              <select
                disabled={isExpired}
                value={athleticsSpecialty}
                onChange={(e) => setAthleticsSpecialty(e.target.value)}
                className="w-full text-xs rounded-xl border border-purple-200 bg-purple-50/40 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="">-- اختر التخصص (مثل القفز الطولي / جري 80م) --</option>
                {(sport.athleticsSpecialties || [
                  'سباق 80 متر حواجز',
                  'سباق 100 متر',
                  'سباق 800 متر',
                  'القفز الطولي',
                  'القفز العالي',
                  'رمي الجلة (Poids)',
                  'رمي القرص (Disque)',
                  'رمي الرمح (Javelot)'
                ]).map(spec => (
                  <option key={spec} value={spec}>{spec}</option>
                ))}
              </select>
            </div>
          )}

          {/* Affiliation Type: non_club vs club_affiliated */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                صفة الانتماء الرياضي للتلميذ(ة) <span className="text-red-500">*</span>
              </label>
              {effectiveLockedAffiliation && (
                <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800 transition-colors flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>مقفل وفق شروط البطولة</span>
                </span>
              )}
            </div>
            {effectiveLockedAffiliation ? (
              <div className="w-full text-xs px-3.5 py-2.5 bg-slate-100/90 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 font-bold flex items-center justify-between cursor-not-allowed select-none transition-colors">
                <span className="flex items-center gap-2">
                  <span>{affiliationType === 'club_affiliated' ? '🟡' : '⚪'}</span>
                  <span className="font-extrabold text-blue-950 dark:text-blue-100">
                    {affiliationType === 'club_affiliated' ? 'منتمي لنادي (بطولة المنتمين)' : 'لا منتمي (مدرسي فقط)'}
                  </span>
                </span>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold flex items-center gap-1">
                  <Lock className="w-3 h-3" /> مقفل
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isExpired}
                  onClick={() => setAffiliationType('non_club')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    affiliationType === 'non_club'
                      ? 'bg-slate-900 dark:bg-slate-700 text-white border-slate-900 dark:border-slate-600 shadow-xs'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  ⚪ لا منتمي (مدرسي)
                </button>
                <button
                  type="button"
                  disabled={isExpired}
                  onClick={() => setAffiliationType('club_affiliated')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    affiliationType === 'club_affiliated'
                      ? 'bg-amber-400 dark:bg-amber-500 text-amber-950 font-extrabold border-amber-500 shadow-xs ring-1 ring-amber-400'
                      : 'bg-amber-50 dark:bg-amber-900/30 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-800'
                  }`}
                >
                  🟡 منتمي لنادي
                </button>
              </div>
            )}
          </div>

          {/* Cross Country Participation type */}
          {sport.id === 'cross_country' && (
            <div>
            <label className="block text-xs font-bold text-indigo-900 dark:text-indigo-100 mb-1">
                نوع المشاركة في العدو الريفي
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isExpired}
                  onClick={() => setParticipationType('individual')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    participationType === 'individual'
                      ? 'bg-indigo-600 dark:bg-indigo-700 text-white border-indigo-600 dark:border-indigo-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  فردي (3 مشاركين)
                </button>
                <button
                  type="button"
                  disabled={isExpired}
                  onClick={() => setParticipationType('school_team')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                    participationType === 'school_team'
                      ? 'bg-indigo-600 dark:bg-indigo-700 text-white border-indigo-600 dark:border-indigo-500 shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                  }`}
                >
                  فريق المؤسسة (5 مشاركين)
                </button>
              </div>
            </div>
          )}

          {/* Coach info section - automatically defaulted to logged in user */}
          <div className="p-3.5 bg-indigo-50/70 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2.5 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950 dark:text-indigo-100">
                <span className="text-base">👨‍🏫</span>
                <span>الأستاذ(ة) المؤطر(ة) للمشارك(ة)</span>
              </div>
              <span className="text-[10px] text-indigo-700 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/50 px-2 py-0.5 rounded-full font-bold">
                تلقائي
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
              المؤطر المسجل تلقائياً هو صاحب الحساب، ويمكنك تعديله.
            </p>
            <div className="space-y-2">
              <div>
                <input
                  type="text"
                  disabled={isExpired}
                  placeholder="اسم ونسب الأستاذ المؤطر"
                  value={coachName}
                  onChange={(e) => setCoachName(e.target.value)}
                  className="w-full text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 transition-colors"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  disabled={isExpired}
                  placeholder="رقم التأجير (SOM)"
                  value={coachLeaseNumber}
                  onChange={(e) => setCoachLeaseNumber(e.target.value)}
                  className="w-full text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 transition-colors"
                />
                <input
                  type="tel"
                  disabled={isExpired}
                  placeholder="رقم الهاتف"
                  value={coachPhone}
                  onChange={(e) => setCoachPhone(e.target.value)}
                  className="w-full text-xs rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-slate-800 px-3 py-2 text-slate-900 dark:text-slate-100 font-mono font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-100 dark:disabled:bg-slate-900 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Submit buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isExpired}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-600 rounded-xl transition-all shadow-xs disabled:bg-slate-300 dark:disabled:bg-slate-800 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <GraduationCap className="w-4 h-4" />
                  <span>تأكيد تسجيل التلميذ(ة)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
