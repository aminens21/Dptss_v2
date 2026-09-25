import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, isSuperAdminEmail } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import {
  LogIn,
  Building2,
  Sparkles,
  ShieldCheck,
  User as UserIcon,
  KeyRound,
  CreditCard,
  Phone,
  MapPin,
  Award,
  Camera,
  UploadCloud,
  Trash2,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ChevronDown,
  Search,
  Check,
  Trophy,
  Moon,
  Sun,
  Flame,
  Medal,
  Calendar,
  Clock,
  Filter,
  Users,
  Megaphone,
  Play,
  Pause,
  ExternalLink,
  Layers,
  ChevronRight,
  ChevronLeft,
  X,
  FileSpreadsheet,
  Zap,
  Info
} from 'lucide-react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Role, Directorate, School, Tournament, Match, Student, CrossCountryCategoryResult } from '../types';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason, getCategoryYearsLabel } from '../lib/dataService';
import { calculateTeamRankings } from '../lib/crossCountryConfig';
import { AppLogo } from '../components/AppLogo';
import toast from 'react-hot-toast';

export const Login: React.FC = () => {
  const { currentUser, userProfile, loading, updateProfileState, loginAsDemo } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  // Mode: 'PUBLIC' (default), or 'REGISTER_TEACHER' if google auth triggers new teacher setup
  const [loginMode, setLoginMode] = useState<'PUBLIC' | 'REGISTER_TEACHER'>('PUBLIC');
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const loginPanelRef = useRef<HTMLDivElement>(null);

  // Data states for Public View
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [crossCountryResults, setCrossCountryResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Public Filters
  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [selectedScope, setSelectedScope] = useState<'ALL' | 'PROVINCIAL' | 'REGIONAL' | 'NATIONAL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [selectedAffiliation, setSelectedAffiliation] = useState<'ALL' | 'CLUB' | 'NON_CLUB'>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePublicTab, setActivePublicTab] = useState<'CC_PODIUM' | 'MATCHES' | 'TOURNAMENTS'>('CC_PODIUM');

  // Helper to safely compare dates regardless of their format (string, Firestore Timestamp, or Date object)
  const safeDateCompare = (dateVal: any, targetYmd: string) => {
    if (!dateVal) return false;
    try {
      let ymd = '';
      if (typeof dateVal === 'string') {
        ymd = dateVal;
      } else if (dateVal && typeof dateVal.toDate === 'function') {
        ymd = dateVal.toDate().toISOString().split('T')[0];
      } else if (dateVal && dateVal.seconds !== undefined) {
        ymd = new Date(dateVal.seconds * 1000).toISOString().split('T')[0];
      } else if (dateVal instanceof Date) {
        ymd = dateVal.toISOString().split('T')[0];
      } else {
        ymd = String(dateVal);
      }
      return ymd.startsWith(targetYmd);
    } catch (e) {
      return false;
    }
  };

  // Date Bar state & Scroll Ref
  const [dateOffset, setDateOffset] = useState(0);
  const dateBarScrollRef = useRef<HTMLDivElement>(null);

  const handleDateBarPrev = () => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const current = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      current.setDate(current.getDate() - 1);
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const newYmd = `${y}-${m}-${d}`;
      setSelectedDate(newYmd);
      setDateOffset(prev => prev - 1);
    }
  };

  const handleDateBarNext = () => {
    const parts = selectedDate.split('-');
    if (parts.length === 3) {
      const current = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      current.setDate(current.getDate() + 1);
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      const newYmd = `${y}-${m}-${d}`;
      setSelectedDate(newYmd);
      setDateOffset(prev => prev + 1);
    }
  };

  // Generate Date Bar items
  const dateBarItems = useMemo(() => {
    const items = [];
    const today = new Date();
    
    for (let i = -7; i <= 7; i++) {
      const offsetIndex = i + dateOffset;
      const d = new Date();
      d.setDate(today.getDate() + offsetIndex);
      const dateStr = d.toISOString().split('T')[0];
      
      let label = '';
      if (offsetIndex === -1) label = 'أمس';
      else if (offsetIndex === 0) label = 'اليوم';
      else if (offsetIndex === 1) label = 'غداً';
      else {
        const dayName = d.toLocaleDateString('ar-MA', { weekday: 'long' });
        const dayNum = d.getDate();
        const monthName = d.toLocaleDateString('ar-MA', { month: 'long' });
        label = `${dayName} ${dayNum} ${monthName}`;
      }
      
      items.push({ date: dateStr, label, isToday: offsetIndex === 0 });
    }
    // Sort from Future (Left) to Past (Right) for RTL
    return items.reverse(); 
  }, [dateOffset]);

  // Marquee pause & visibility state
  const [isMarqueePaused, setIsMarqueePaused] = useState(false);
  const [isMarqueeVisible, setIsMarqueeVisible] = useState(true);

  // Prayer times state (Corrected to default to official Moroccan Ministry of Habous Taourirt timings)
  const [prayerTimes, setPrayerTimes] = useState({
    Fajr: '04:32',
    Dhuhr: '12:08',
    Asr: '15:29',
    Maghrib: '18:11',
    Isha: '19:23'
  });

  useEffect(() => {
    // Fetch live prayer times using Union des Organisations Islamiques de France/Morocco method (method=21)
    fetch('https://api.aladhan.com/v1/timingsByCity?city=Taourirt&country=Morocco&method=21')
      .then(res => res.json())
      .then(data => {
        if (data?.data?.timings) {
          const t = data.data.timings;
          
          // Fine-tune timing adjustments to perfectly align with the Moroccan Ministry of Habous / Salaat First calculation
          const adjustTime = (timeStr: string, minutesOffset: number) => {
            if (!timeStr) return '';
            const [h, m] = timeStr.split(':').map(Number);
            const date = new Date();
            date.setHours(h, m + minutesOffset, 0, 0);
            return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          };

          setPrayerTimes({
            Fajr: adjustTime(t.Fajr?.slice(0, 5), -1) || '04:32',
            Dhuhr: t.Dhuhr?.slice(0, 5) || '12:08',
            Asr: t.Asr?.slice(0, 5) || '15:29',
            Maghrib: adjustTime(t.Maghrib?.slice(0, 5), 2) || '18:11',
            Isha: t.Isha?.slice(0, 5) || '19:23',
          });
        }
      })
      .catch(err => {
        console.warn("Could not fetch Morocco prayer times:", err);
      });
  }, []);

  // Auto scroll to Today element on load to avoid showing future dates (like October 2nd) by default
  useEffect(() => {
    const timer = setTimeout(() => {
      const todayBtn = document.getElementById("today-date-btn");
      if (todayBtn) {
        todayBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Monthly Calendar state
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(new Date());

  const ARABIC_MONTHS = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
    'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'
  ];

  const handlePrevMonth = () => {
    setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentCalendarMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Selected Detail Modal
  const [selectedTournamentDetail, setSelectedTournamentDetail] = useState<Tournament | null>(null);

  // Teacher Registration Form states
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
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load initial data for public view & registration
  useEffect(() => {
    let isMounted = true;
    setLoadingData(true);

    Promise.all([
      DataService.getDirectorates(),
      DataService.getSchools(),
      DataService.getTournaments(),
      DataService.getMatches(),
      DataService.getStudents(),
      DataService.getCrossCountryResults()
    ]).then(([dirs, schs, tours, mtchs, stds, ccRes]) => {
      if (!isMounted) return;
      setDirectorates(dirs || []);
      setSchools(schs || []);
      setTournaments(tours || []);
      
      // Inject Demo Matches if none exist for today
      let finalMatches = mtchs || [];
      if (finalMatches.length === 0) {
        const todayObj = new Date();
        const y = todayObj.getFullYear();
        const m = String(todayObj.getMonth() + 1).padStart(2, '0');
        const dNum = todayObj.getDate();
        
        const pad = (num: number) => String(num).padStart(2, '0');
        const dayToday = `${y}-${m}-${pad(dNum)}`;
        const dayPlus2 = `${y}-${m}-${pad(Math.min(dNum + 2, 28))}`;
        const dayPlus5 = `${y}-${m}-${pad(Math.min(dNum + 5, 28))}`;
        const dayPlus8 = `${y}-${m}-${pad(Math.min(dNum + 8, 28))}`;
        const dayMinus3 = `${y}-${m}-${pad(Math.max(dNum - 3, 1))}`;

        finalMatches = [
          { id: 'm1', sportId: 'football', sportName: 'كرة القدم', team1Name: 'ثانوية الفتح', team2Name: 'ثانوية علال الفاسي', date: dayToday, startTime: '10:00', venueName: 'الملعب البلدي', status: 'COMPLETED', team1Score: 2, team2Score: 1, category: 'U18 ذكور' },
          { id: 'm2', sportId: 'basketball', sportName: 'كرة السلة', team1Name: 'إعدادية ابن سينا', team2Name: 'إعدادية سيدي لحسن', date: dayToday, startTime: '14:30', venueName: 'القاعة المغطاة', status: 'ONGOING', team1Score: 12, team2Score: 10, category: 'U15 إناث' },
          { id: 'm3', sportId: 'handball', sportName: 'كرة اليد', team1Name: 'ثانوية الزيتون', team2Name: 'ثانوية الفتح', date: dayPlus2, startTime: '16:00', venueName: 'القاعة المغطاة', status: 'SCHEDULED', category: 'U18 ذكور' },
          { id: 'm4', sportId: 'volleyball', sportName: 'الكرة الطائرة', team1Name: 'إعدادية ابن رشد', team2Name: 'إعدادية القدس', date: dayPlus5, startTime: '09:00', venueName: 'ثانوية الفتح', status: 'SCHEDULED', category: 'U15 ذكور' },
          { id: 'm5', sportId: 'football', sportName: 'كرة القدم', team1Name: 'إعدادية سيدي لحسن', team2Name: 'إعدادية ابن رشد', date: dayPlus8, startTime: '11:00', venueName: 'الملعب البلدي', status: 'SCHEDULED', category: 'U15 ذكور' },
          { id: 'm6', sportId: 'basketball', sportName: 'كرة السلة', team1Name: 'ثانوية الفتح', team2Name: 'ثانوية الزيتون', date: dayMinus3, startTime: '15:00', venueName: 'القاعة المغطاة', status: 'COMPLETED', team1Score: 45, team2Score: 38, category: 'U18 إناث' }
        ] as any;
      }
      setMatches(finalMatches);
      
      setStudents(stds || []);
      
      // Inject Demo CC Results if empty
      let finalCcRes = ccRes || {};
      if (Object.keys(finalCcRes).length === 0) {
        finalCcRes = {
          'u12_male': {
            categoryId: 'u12_male',
            categoryName: 'سباق البراعم ذكور',
            titleAr: 'سباق البراعم ذكور',
            gender: 'Male',
            podium: [
              { rank: 1, fullName: 'ياسين بونو', schoolName: 'م.م دبدو', bibNumber: '102', time: '04:12', affiliationType: 'non_club' },
              { rank: 2, fullName: 'أشرف حكيمي', schoolName: 'إعدادية ابن سينا', bibNumber: '115', time: '04:15', affiliationType: 'club_affiliated' },
              { rank: 3, fullName: 'سفيان أمرابط', schoolName: 'إعدادية سيدي لحسن', bibNumber: '108', time: '04:20', affiliationType: 'non_club' },
              { rank: 4, fullName: 'نايف أكرد', schoolName: 'ثانوية الفتح', bibNumber: '130', time: '04:25', affiliationType: 'non_club' }
            ]
          },
          'u15_female': {
            categoryId: 'u15_female',
            categoryName: 'سباق الصغيرات إناث',
            titleAr: 'سباق الصغيرات إناث',
            gender: 'Female',
            podium: [
              { rank: 1, fullName: 'خديجة المرضي', schoolName: 'إعدادية القدس', bibNumber: '205', time: '05:30', affiliationType: 'club_affiliated' },
              { rank: 2, fullName: 'نوال المتوكل', schoolName: 'إعدادية ابن سينا', bibNumber: '210', time: '05:45', affiliationType: 'non_club' },
              { rank: 3, fullName: 'نزهة بدوان', schoolName: 'ثانوية الزيتون', bibNumber: '218', time: '06:00', affiliationType: 'non_club' }
            ]
          }
        } as any;
      }
      setCrossCountryResults(finalCcRes);
      
      setLoadingData(false);
    }).catch(err => {
      console.warn("Could not load public data in Login page:", err);
      if (isMounted) setLoadingData(false);
    });

    const unsubSchools = DataService.subscribeToSchools((s) => setSchools(s));
    const unsubTournaments = DataService.subscribeToTournaments((t) => setTournaments(t));
    const unsubMatches = DataService.subscribeToMatches((m) => setMatches(m));
    const unsubCcResults = DataService.subscribeCrossCountryResults((r) => setCrossCountryResults(r as Record<string, CrossCountryCategoryResult>));

    return () => {
      isMounted = false;
      unsubSchools();
      unsubTournaments();
      unsubMatches();
      unsubCcResults();
    };
  }, []);

  // Determine if existing logged-in user has complete profile
  const isProfileComplete = Boolean(
    userProfile && (
      userProfile.isSuperAdmin ||
      userProfile.role === 'CENTRAL_ADMIN' ||
      userProfile.role === 'SPORT_MANAGER' ||
      (userProfile.directorateId && (userProfile.workLocation || userProfile.leaseNumber))
    )
  );

  // Redirect to dashboard if already authenticated & complete profile
  useEffect(() => {
    if (!loading && currentUser && isProfileComplete && loginMode !== 'REGISTER_TEACHER') {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, currentUser, isProfileComplete, loginMode, navigate]);

  // Filtered approved schools by directorate and cycle
  const selectedCycleType = regTeachingCadre === 'PRIMARY' ? 'ابتدائي' : regTeachingCadre === 'MIDDLE' ? 'إعدادي' : 'تأهيلي';
  const filteredSchools = useMemo(() => {
    return [...schools]
      .filter(s => 
        s && 
        s.name && 
        !s.name.includes('غير محدد') &&
        (s.directorateId === regDirectorateId || (!s.directorateId && regDirectorateId === 'taourirt')) &&
        s.type === selectedCycleType
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [schools, regDirectorateId, selectedCycleType]);

  const selectedDirObj = directorates.find(d => d.id === regDirectorateId);

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

  // Google Sign-In Flow
  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const googleUser = result.user;
      const cleanEmail = (googleUser.email || '').toLowerCase().trim();

      if (isSuperAdminEmail(cleanEmail)) {
        toast.success(`مرحباً بك! تم تسجيل الدخول بصلاحيات المشرف العام المركزي (${cleanEmail})`);
        navigate('/dashboard', { replace: true });
        return;
      }

      const dirs = await DataService.getDirectorates();
      const managedDir = dirs.find(d => (d.adminEmails || []).some(ae => ae.trim().toLowerCase() === cleanEmail));
      if (managedDir) {
        toast.success(`مرحباً بك! تم تسجيل الدخول كمسير إقليمي لـ ${managedDir.name}`);
        navigate('/dashboard', { replace: true });
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', googleUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.directorateId && (data.leaseNumber || data.workLocation)) {
            DataService.setActiveDirectorateId(data.directorateId);
            toast.success(`مرحباً بك ذ. ${data.fullName || googleUser.displayName || ''}! تم تسجيل الدخول بنجاح`);
            navigate('/dashboard', { replace: true });
            return;
          }
        }
      } catch (checkErr) {
        console.warn("Error checking user doc in Firestore:", checkErr);
      }

      setRegFullName('');
      setRegEmail(cleanEmail);
      setRegPhoto(googleUser.photoURL || '');
      setLoginMode('REGISTER_TEACHER');
      toast('يرجى استكمال بيانات التسجيل وكتابة الإسم الكامل بالعربية', { icon: 'ℹ️' });

    } catch (error: any) {
      console.error("Google sign in error:", error);
      if (error?.code === 'auth/popup-closed-by-user') {
        toast.error('تم إغلاق نافذة تسجيل الدخول قبل إتمام العملية');
      } else if (error?.code === 'auth/unauthorized-domain') {
        toast.error('هذا النطاق غير مصرح له في إعدادات Firebase Authentication.');
      } else {
        toast.error('حدث خطأ في الاتصال بـ Google. تأكد من إعدادات Firebase Authentication.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Teacher Registration Submission
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

      await setDoc(doc(db, 'users', targetUid), {
        id: targetUid,
        ...teacherData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });

      DataService.setActiveDirectorateId(regDirectorateId);

      updateProfileState({
        id: targetUid,
        ...teacherData
      });

      toast.success(`مرحباً بك أستاذ ${regFullName.trim()} ضمن أطر ${dirName}!`);
      setLoginMode('PUBLIC');

    } catch (err: any) {
      console.error("Teacher registration error:", err);
      toast.error('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelRegistration = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Signout error:", e);
    }
    setLoginMode('PUBLIC');
    setRegFullName('');
    setRegEmail('');
    setRegPhoto('');
    setRegDirectorateCode('');
    setRegLeaseNumber('');
    setRegWorkLocation('');
  };

  // --- HELPER RENDERS ---

  const renderLoginPanel = () => (
    <div className="space-y-5">
      {/* Header */}
      <div className="text-center space-y-2 border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="inline-flex p-3 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 rounded-2xl border border-emerald-200 dark:border-emerald-800 mx-auto">
          <UserIcon className="w-6 h-6" />
        </div>
        <h3 className="text-base font-black text-slate-900 dark:text-white">
          فضاء الأطر التربوية والمسيرين
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
          تسجيل الدخول الموحد للأساتذة، المنظمين والحكام المعتمدين بالمنظومة
        </p>
      </div>

      {/* MODE 1: LOGIN (GOOGLE SIGN IN & DEMO) */}
      {loginMode === 'PUBLIC' && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-700/80 border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white font-black rounded-2xl shadow-sm hover:shadow-md transition-all text-xs flex items-center justify-center gap-2.5 cursor-pointer group disabled:opacity-50"
          >
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{isSubmitting ? 'جاري التحقق عبر Google...' : 'المتابعة بحساب Google (Gmail)'}</span>
          </button>

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-[10px]">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 font-bold">أو الدخول بصفة تجريبية (Demo)</span>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => loginAsDemo('CENTRAL_ADMIN')}
              className="w-full p-2.5 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/60 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-2xl text-right transition-colors cursor-pointer group flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">المسير المركزي</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">المشرف العام ومتابعة الأنشطة</p>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => loginAsDemo('SPORT_MANAGER')}
              className="w-full p-2.5 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/60 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-2xl text-right transition-colors cursor-pointer group flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">مسؤول رياضة</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">تدبير بطولات التخصصات</p>
              </div>
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
            </button>

            <button
              type="button"
              onClick={() => loginAsDemo('TEACHER')}
              className="w-full p-2.5 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800/60 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-700 hover:border-emerald-400 rounded-2xl text-right transition-colors cursor-pointer group flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">أستاذ التربية البدنية</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">تسجيل التلاميذ والفرق المدرسية</p>
              </div>
              <UserIcon className="w-4 h-4 text-blue-500 shrink-0" />
            </button>
          </div>

          <div className="p-3 bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl text-[11px] text-blue-900 dark:text-blue-300 font-bold leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span>يتطلب التسجيل لأول مرة إدخال القن السري للمديرية الإقليمية الخاص بمؤسستك التعليمية.</span>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: TEACHER REGISTRATION MODAL */}
      {loginMode === 'REGISTER_TEACHER' && (
        <form className="space-y-4" onSubmit={handleCompleteRegistration}>
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-slate-800 rounded-2xl flex items-center justify-between">
            <span className="text-xs font-bold text-blue-950 dark:text-blue-200 truncate">{regEmail}</span>
            <button type="button" onClick={handleCancelRegistration} className="text-[10px] text-red-600 dark:text-red-400 font-bold">تغيير</button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الإسم الكامل بالعربية *</label>
            <input
              type="text"
              required
              value={regFullName}
              onChange={(e) => setRegFullName(e.target.value)}
              placeholder="ذ. محمد المرابط"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold mb-1">رقم التأجير (SOM) *</label>
              <input
                type="text"
                required
                value={regLeaseNumber}
                onChange={(e) => setRegLeaseNumber(e.target.value)}
                placeholder="123456"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold mb-1">القن السري للمديرية *</label>
              <input
                type="password"
                required
                value={regDirectorateCode}
                onChange={(e) => setRegDirectorateCode(e.target.value)}
                placeholder="القن السري"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold mb-1">المؤسسة التعليمية *</label>
            <select
              value={regWorkLocation}
              onChange={(e) => setRegWorkLocation(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-bold"
            >
              <option value="">-- اختر مؤسستك --</option>
              {filteredSchools.map(sch => (
                <option key={sch.id} value={sch.name}>{sch.name}</option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !regWorkLocation}
            className="w-full py-3 bg-emerald-600 text-white font-bold rounded-2xl text-xs cursor-pointer hover:bg-emerald-700"
          >
            تأكيد التسجيل والدخول
          </button>
        </form>
      )}
    </div>
  );

  // Filtered Tournaments for Public Catalog
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      // Date Filter: Tournament starts on the selected day
      if (t.startDate && !safeDateCompare(t.startDate, selectedDate)) return false;

      if (selectedSport !== 'ALL' && t.sportId !== selectedSport) return false;
      if (selectedScope !== 'ALL' && t.level !== selectedScope && t.scope !== selectedScope) return false;
      if (selectedCategory !== 'ALL' && t.category !== selectedCategory) return false;
      if (selectedGender !== 'ALL' && t.gender !== selectedGender) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesSport = t.sportName?.toLowerCase().includes(q);
        const matchesCat = t.category?.toLowerCase().includes(q);
        const matchesVenue = t.venue?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesSport && !matchesCat && !matchesVenue) return false;
      }
      return true;
    });
  }, [tournaments, selectedDate, selectedSport, selectedScope, selectedCategory, selectedGender, searchQuery]);

  // Filtered Matches for Public Fixtures
  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      // Date Filter: Match must be on the selected day
      if (m.date && !safeDateCompare(m.date, selectedDate)) return false;
      
      if (selectedSport !== 'ALL' && m.sportId !== selectedSport) return false;
      if (selectedCategory !== 'ALL' && m.category !== selectedCategory) return false;
      if (selectedGender !== 'ALL' && m.gender !== selectedGender) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesTeam1 = m.team1Name?.toLowerCase().includes(q);
        const matchesTeam2 = m.team2Name?.toLowerCase().includes(q);
        const matchesVenue = m.venueName?.toLowerCase().includes(q);
        const matchesGroup = m.groupName?.toLowerCase().includes(q);
        if (!matchesTeam1 && !matchesTeam2 && !matchesVenue && !matchesGroup) return false;
      }
      return true;
    });
  }, [matches, selectedDate, selectedSport, selectedCategory, selectedGender, searchQuery]);

  // Cross Country Results Data (Strictly Deduplicated per Category & Team Rankings)
  const crossCountryList = useMemo(() => {
    const list: Array<{
      key: string;
      categoryKey: string;
      categoryName: string;
      runners: Array<any>;
      teamRankings: ReturnType<typeof calculateTeamRankings>;
    }> = [];

    const processedCategoryKeys = new Set<string>();

    Object.entries(crossCountryResults).forEach(([key, val]) => {
      const catRes = val as CrossCountryCategoryResult;
      if (!catRes || !catRes.podium || catRes.podium.length === 0) return;

      // Canonical key for deduplication
      const canonicalKey = catRes.categoryId || catRes.id || key;
      if (processedCategoryKeys.has(canonicalKey)) return;
      processedCategoryKeys.add(canonicalKey);

      const catName = catRes.titleAr || catRes.category || key;
      const winners = catRes.podium || [];

      // Filter runners by search query & affiliation
      const filteredRunners = winners.filter(w => {
        const studentName = w.fullName || (w as any).studentName;
        if (!w || !studentName) return false;

        // Affiliation Filter
        const studentObj = students.find(s => s.id === w.studentId || s.fullName === studentName);
        const isClub = studentObj?.affiliationType === 'club_affiliated' || w.affiliationType === 'club_affiliated';
        if (selectedAffiliation === 'CLUB' && !isClub) return false;
        if (selectedAffiliation === 'NON_CLUB' && isClub) return false;

        // Gender Filter
        if (selectedGender === 'Male' && (catRes.gender === 'Female' || catName.includes('إناث'))) return false;
        if (selectedGender === 'Female' && (catRes.gender === 'Male' || catName.includes('ذكور'))) return false;

        // Search Query
        if (searchQuery.trim()) {
          const q = searchQuery.trim().toLowerCase();
          const matchesName = studentName.toLowerCase().includes(q);
          const matchesSchool = (w.schoolName || '').toLowerCase().includes(q);
          const matchesBib = String(w.bibNumber || '').includes(q);
          if (!matchesName && !matchesSchool && !matchesBib) return false;
        }

        return true;
      });

      if (filteredRunners.length > 0) {
        // Compute official school team rankings
        const teamRankings = calculateTeamRankings(filteredRunners);

        list.push({
          key: canonicalKey,
          categoryKey: canonicalKey,
          categoryName: catName,
          runners: filteredRunners,
          teamRankings
        });
      }
    });

    return list;
  }, [crossCountryResults, students, selectedAffiliation, selectedGender, searchQuery]);

  // News Marquee Items
  const marqueeNews = [
    { id: 1, icon: '🏆', text: 'اعتماد ومصادقة نتائج العدو الريفي المدرسي والإقليمي لموسم 2026/2027 مع التمييز الدقيق بين المنتمين وغير المنتمين للأندية.' },
    { id: 2, icon: '🏃‍♂️', text: 'تأهيل صفوة العدائين والعداءات للبطولة الجهوية والوطنية للرياضة المدرسية بالمديرية الإقليمية.' },
    { id: 3, icon: '⚽', text: 'انطلاق الأدوار الإقصائية للرياضات الجماعية (كرة القدم، كرة السلة، الكرة الطائرة وكرة اليد).' },
    { id: 4, icon: '📋', text: 'فضاء الأساتذة متاح لتسجيل لوائح التلاميذ والفرق المدرسية وتأكيد رخص المشاركة.' },
    { id: 5, icon: '🏁', text: 'تحميل الشواهد التقديرية ومحاضر المباريات والنتائج الرسمية متاح مباشرة عبر المنصة.' }
  ];

  const renderRightSidebar = () => (
    <div className="space-y-5">
      {/* Weather Widget (نافذة الطقس الصغيرة) */}
      <div className="bg-linear-to-br from-blue-600 via-sky-600 to-indigo-800 dark:from-blue-700 dark:via-sky-800 dark:to-indigo-950 rounded-2xl p-4 text-white shadow-md space-y-2.5 border border-blue-400/30">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold opacity-90">
              <MapPin className="w-3.5 h-3.5 text-amber-300" />
              <span>طقس تاوريرت</span>
            </div>
            <p className="text-2xl font-black font-mono">24°C</p>
          </div>
          <div className="p-2 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 shadow-inner">
            <Sun className="w-8 h-8 text-amber-300 animate-pulse" />
          </div>
        </div>
        <div className="flex items-center justify-between text-[11px] font-bold border-t border-white/20 pt-2 opacity-95">
          <span>مشمس غائم جزئياً</span>
          <span>الرطوبة: 15%</span>
        </div>
        
        {/* تفاصيل طقس 5 أيام المقبلة */}
        <div className="border-t border-white/20 pt-2 space-y-1.5">
          <p className="text-[10px] font-extrabold opacity-85">التوقعات لـ 5 أيام المقبلة:</p>
          <div className="grid grid-cols-5 gap-1 text-center">
            {[
              { day: 'السبت', temp: '26°', icon: '☀️' },
              { day: 'الأحد', temp: '25°', icon: '🌤️' },
              { day: 'الإثنين', temp: '23°', icon: '☁️' },
              { day: 'الثلاثاء', temp: '24°', icon: '☀️' },
              { day: 'الأربعاء', temp: '22°', icon: '🌧️' }
            ].map((f, i) => (
              <div key={i} className="bg-white/10 rounded-lg py-1 px-0.5 space-y-0.5 border border-white/5">
                <span className="block text-[8px] font-black opacity-80">{f.day}</span>
                <span className="block text-xs">{f.icon}</span>
                <span className="block text-[10px] font-extrabold font-mono">{f.temp}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Prayer Times Widget (نافذة مواقيت الصلاة الصغيرة) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 transition-colors">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">مواقيت الصلاة (تاوريرت)</h4>
          </div>
          <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 text-[10px] font-black rounded-md border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
            <span>وزارة الأوقاف</span>
            <span>🕋</span>
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
          <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <span className="text-slate-700 dark:text-slate-300">الفجر</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{prayerTimes.Fajr}</span>
          </div>
          <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <span className="text-slate-700 dark:text-slate-300">الظهر</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{prayerTimes.Dhuhr}</span>
          </div>
          <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/50">
            <span className="text-slate-700 dark:text-slate-300">العصر</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{prayerTimes.Asr}</span>
          </div>
          <div className="flex justify-between p-2 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-xl shadow-xs">
            <span className="text-emerald-950 dark:text-emerald-200 font-black">المغرب</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-mono font-black">{prayerTimes.Maghrib}</span>
          </div>
          <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-100 dark:border-slate-700/50 col-span-2">
            <span className="text-slate-700 dark:text-slate-300">العشاء</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black">{prayerTimes.Isha}</span>
          </div>
        </div>
      </div>

      {/* Monthly Program & Interactive Monthly Calendar (نافذة اليومية الشهرية الصغيرة) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 transition-colors">
        
        {/* Header with Month Navigator */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
              البرنامج الشهري واليومية
            </h4>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="الشهر السابق"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <span className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
              {ARABIC_MONTHS[currentCalendarMonth.getMonth()]} {currentCalendarMonth.getFullYear()}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="الشهر التالي"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Monthly Calendar Grid (اليومية الشهرية) */}
        <div className="space-y-1.5">
          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center text-[10px] font-black text-slate-500 dark:text-slate-400 pb-1 border-b border-slate-100 dark:border-slate-800">
            <span>أحد</span>
            <span>اتن</span>
            <span>ثلا</span>
            <span>أرب</span>
            <span>خميس</span>
            <span>جمعة</span>
            <span>سبت</span>
          </div>

          {/* Days cells */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Empty padding slots before 1st of month */}
            {Array.from({ length: new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="h-6"></div>
            ))}

            {/* Days 1..N */}
            {Array.from({ length: new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 0).getDate() }).map((_, idx) => {
              const dayNum = idx + 1;
              const year = currentCalendarMonth.getFullYear();
              const monthStr = String(currentCalendarMonth.getMonth() + 1).padStart(2, '0');
              const dayStr = String(dayNum).padStart(2, '0');
              const cellYmd = `${year}-${monthStr}-${dayStr}`;

              const isSelected = selectedDate === cellYmd;
              
              // Count matches on this specific day
              const dayMatchesCount = matches.filter(m => safeDateCompare(m.date, cellYmd)).length;
              const hasMatches = dayMatchesCount > 0;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => setSelectedDate(cellYmd)}
                  className={`h-6.5 rounded-lg flex flex-col items-center justify-center relative font-bold text-[10px] transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/30 scale-105'
                      : hasMatches
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{dayNum}</span>
                  {hasMatches && !isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 absolute bottom-0.5"></span>
                  )}
                  {hasMatches && isSelected && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 absolute bottom-0.5"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day / Monthly Matches Summary */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 dark:text-slate-300">
            <span>مباريات اليوم ({selectedDate}):</span>
            <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 rounded font-mono font-bold">
              {filteredMatches.length} مباراة
            </span>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {filteredMatches.length === 0 ? (
              <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl text-center text-[10px] text-slate-500 dark:text-slate-400">
                لا توجد مباريات مبرمجة في تاريخ {selectedDate}
              </div>
            ) : (
              filteredMatches.map(m => (
                <div key={m.id} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-xl space-y-1 border border-slate-100 dark:border-slate-700/60">
                  <div className="flex items-center justify-between text-[10px] font-black text-slate-800 dark:text-slate-100">
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span>{SPORTS_MAP[m.sportId]?.icon || '⚽'}</span>
                      <span className="truncate">{m.team1Name} VS {m.team2Name}</span>
                    </span>
                    <span className="font-mono text-amber-600 dark:text-amber-400">{m.startTime || '10:00'}</span>
                  </div>

                  <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {m.venueName || 'الملعب'}</span>
                    <span className="px-1.5 py-0.5 bg-white dark:bg-slate-700 rounded font-bold">{m.category || 'عامة'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Sport Gallery (نافذة الصور الصغيرة) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-2.5">
        <div className="flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
          <Camera className="w-4 h-4 text-amber-600" />
          <h4 className="text-xs font-black text-slate-800 dark:text-slate-100">
            ألبوم صور {selectedSport !== 'ALL' ? SPORTS_MAP[selectedSport]?.name : 'البطولة'}
          </h4>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <img src="https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=200&h=200&fit=crop" className="rounded-xl w-full h-16 object-cover bg-slate-100" alt="Gallery 1" />
          <img src="https://images.unsplash.com/photo-1544644181-1484b3fdfc62?w=200&h=200&fit=crop" className="rounded-xl w-full h-16 object-cover bg-slate-100" alt="Gallery 2" />
          <img src="https://images.unsplash.com/photo-1511886929837-354d827aae26?w=200&h=200&fit=crop" className="rounded-xl w-full h-16 object-cover bg-slate-100" alt="Gallery 3" />
          <img src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=200&h=200&fit=crop" className="rounded-xl w-full h-16 object-cover bg-slate-100" alt="Gallery 4" />
        </div>
        <button className="w-full py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold rounded-lg text-slate-600 dark:text-slate-300">
          عرض معرض الصور بالكامل
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <AppLogo size={64} className="animate-pulse" />
          <p className="text-xs font-bold text-slate-600 dark:text-slate-400">جاري تحميل منصة النتائج والبطولات المدرسية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-300 font-sans selection:bg-emerald-500 selection:text-white ${isDarkMode ? 'dark bg-[#0a0f1d] text-slate-100' : 'bg-slate-50 text-slate-800'}`} dir="rtl">
      
      {/* TOP HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-xs px-3 sm:px-6 py-2.5 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-3 min-w-0">
            <AppLogo size={42} showText={false} className="shrink-0" />
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                منظومة تدبير أنشطة وبطولات الرياضة المدرسية
              </h1>
              <p className="text-[10px] sm:text-xs text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1 truncate">
                <Sparkles className="w-3 h-3 text-emerald-500 shrink-0" />
                <span>النتائج الرسمية والمحاضر العامة للعموم</span>
              </p>
            </div>
          </div>

          {/* Controls Right */}
          <div className="flex items-center gap-2 shrink-0">
            
            {/* Directorate & Season Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>الفرع الإقليمي للرياضة المدرسية</span>
            </div>

            {/* Teacher Login Button - Moved here per user request */}
            <button
              type="button"
              onClick={() => {
                if (loginMode === 'REGISTER_TEACHER') {
                  setLoginMode('PUBLIC');
                }
                const nextState = !showLoginPanel;
                setShowLoginPanel(nextState);
                if (nextState) {
                  setTimeout(() => {
                    loginPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 100);
                }
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                showLoginPanel 
                  ? 'bg-emerald-700 text-white ring-2 ring-emerald-400' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">دخول الأطر والمسيرين</span>
              <span className="sm:hidden text-[10px]">دخول</span>
            </button>

            {/* Dark Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 sm:px-3 sm:py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title={isDarkMode ? 'التحويل للوضع النهار' : 'التحويل للوضع الليلي (Dark Mode)'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
            </button>
          </div>

        </div>
      </header>

      {/* SPORTS BAR (شريط الرياضات) */}
      <section className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-b border-slate-200 dark:border-slate-800 py-1.5 px-3 sm:px-6 shadow-inner select-none transition-colors">
        <div className="max-w-4xl mx-auto flex items-center gap-2">
          
          <div className="hidden sm:flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-3">
            <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>شريط الرياضات:</span>
          </div>

          <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-1.5 py-0.5">
            {/* All Sports Option */}
            <button
              type="button"
              onClick={() => setSelectedSport('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                selectedSport === 'ALL'
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60'
              }`}
            >
              <span>🏆</span>
              <span>جميع الرياضات</span>
            </button>

            {/* Individual Sports from SPORTS_MAP */}
            {Object.entries(SPORTS_MAP).map(([sportKey, sport]) => {
              const isSelected = selectedSport === sportKey;
              return (
                <button
                  key={sportKey}
                  type="button"
                  onClick={() => setSelectedSport(sportKey)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60'
                  }`}
                >
                  <span className="text-sm">{sport.icon}</span>
                  <span>{sport.name}</span>
                </button>
              );
            })}
          </div>

        </div>
      </section>

      {/* الشريـط اليومـي تحـت الرياضـات (DAILY MARQUEE TICKER BAR) */}
      <section className="bg-linear-to-r from-emerald-50 via-slate-50 to-teal-50 dark:from-emerald-950 dark:via-slate-900 dark:to-teal-950 text-slate-800 dark:text-white border-b border-emerald-100 dark:border-emerald-800/60 py-1.5 px-3 sm:px-6 shadow-sm overflow-hidden select-none transition-colors">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          
          {/* Badge Tag */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[11px] font-black shrink-0 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
            </span>
            <Megaphone className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="whitespace-nowrap">الشريط اليومي</span>
          </div>

          {/* Marquee Controls Pill (التحكم بالشريط اليومي) */}
          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl shrink-0 border border-slate-200 dark:border-slate-700/60 shadow-xs z-10">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={() => setIsMarqueePaused(!isMarqueePaused)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer flex items-center justify-center"
              title={isMarqueePaused ? 'تشغيل حركة الشريط' : 'إيقاف حركة الشريط مؤقتاً'}
            >
              {isMarqueePaused ? (
                <Play className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Pause className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </button>

            {/* Separator line */}
            <div className="w-px h-3.5 bg-slate-300 dark:bg-slate-600"></div>

            {/* Eye Hide/Show Button */}
            <button
              type="button"
              onClick={() => setIsMarqueeVisible(!isMarqueeVisible)}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all cursor-pointer flex items-center justify-center"
              title={isMarqueeVisible ? 'إخفاء شريط الأخبار بالكامل' : 'إظهار شريط الأخبار'}
            >
              {isMarqueeVisible ? (
                <Eye className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              )}
            </button>
          </div>

          {/* Animated Marquee Stream / Hidden State */}
          <div 
            className="flex-1 overflow-hidden relative min-h-5 flex items-center"
            onMouseEnter={() => setIsMarqueePaused(true)}
            onMouseLeave={() => setIsMarqueePaused(false)}
          >
            {isMarqueeVisible ? (
              <div className={`flex items-center gap-8 text-xs font-bold text-emerald-900 dark:text-emerald-100 ${isMarqueePaused ? '' : 'animate-marquee-rtl'}`}>
                {marqueeNews.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 whitespace-nowrap shrink-0">
                    <span className="text-amber-600 dark:text-amber-400 font-extrabold text-sm">{item.icon}</span>
                    <span className="text-slate-800 dark:text-slate-100 font-medium">{item.text}</span>
                    <span className="text-emerald-500 dark:text-emerald-500/80 font-mono text-xs mx-2">●</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 italic flex items-center gap-1.5 animate-in fade-in duration-200">
                <EyeOff className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>عناوين الأخبار مخفية (انقر على الأيقونة لإظهار الشريط)</span>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* شريط التاريخ (DATE NAVIGATION BAR) */}
      <section className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors overflow-hidden">
        <div className="max-w-4xl mx-auto flex items-stretch h-10">
          
          {/* Right Arrow (Past / أقدم) */}
          <button 
            type="button"
            onClick={handleDateBarPrev}
            className="px-3 border-l border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors flex items-center justify-center shrink-0 cursor-pointer group"
            title="الأيام السابقة"
          >
            <ChevronRight className="w-4 h-4 group-hover:scale-125 transition-transform" />
          </button>

          {/* Dates list container with scroll ref */}
          <div 
            ref={dateBarScrollRef}
            className="flex-1 flex overflow-x-auto no-scrollbar scroll-smooth"
          >
            {dateBarItems.map((item) => {
              const isSelected = selectedDate === item.date;
              const isToday = item.isToday;
              return (
                <button
                  key={item.date}
                  id={isToday ? "today-date-btn" : undefined}
                  type="button"
                  onClick={() => setSelectedDate(item.date)}
                  className={`flex-1 min-w-[125px] px-2 flex flex-col items-center justify-center border-l border-slate-200 dark:border-slate-800 transition-all cursor-pointer relative ${
                    isToday
                      ? 'bg-yellow-400 dark:bg-yellow-500 text-slate-950 font-black shadow-[0_10px_25px_-5px_rgba(234,179,8,0.6),0_8px_10px_-6px_rgba(234,179,8,0.6)] scale-105 z-10 border-b-4 border-yellow-600 dark:border-yellow-700'
                      : isSelected 
                      ? 'bg-emerald-600 dark:bg-emerald-500 text-white font-black shadow-[0_8px_20px_rgba(16,185,129,0.3)] z-10' 
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
                  }`}
                >
                  <span className="text-[11px] whitespace-nowrap flex items-center gap-1">
                    <span>{item.label}</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* Left Arrow (Future / أحدث) */}
          <button 
            type="button"
            onClick={handleDateBarNext}
            className="px-3 border-r border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 transition-colors flex items-center justify-center shrink-0 cursor-pointer group"
            title="الأيام القادمة"
          >
            <ChevronLeft className="w-4 h-4 group-hover:scale-125 transition-transform" />
          </button>

        </div>
      </section>

      {/* MAIN CONTAINER (TRIPLE LAYOUT: LEFT WIDGETS | PUBLIC RESULTS | SIDE TEACHER LOGIN) */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 py-6">
        {/* MOBILE LOGIN PANEL (Appears at the TOP on mobile if active) */}
        {showLoginPanel && (
          <div ref={loginPanelRef} className="lg:hidden mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/50 dark:border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-5 transition-colors">
              {renderLoginPanel()}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* RIGHT SIDEBAR WIDGETS (WEATHER, PRAYER, PROGRAM, GALLERY) */}
          <div className="order-2 lg:order-none lg:col-span-3 lg:col-start-1 space-y-5">
            {renderRightSidebar()}
          </div>

          {/* MAIN COLUMN: PUBLIC RESULTS & CHAMPIONSHIPS PORTAL */}
          <div className={`space-y-5 transition-all duration-300 order-1 lg:order-none ${
            showLoginPanel 
              ? 'lg:col-span-6 lg:col-start-4' 
              : 'lg:col-span-9 lg:col-start-4'
          }`}>
            
            {/* PUBLIC HERO BANNER */}
            <div className="relative rounded-3xl bg-linear-to-r from-emerald-800 via-teal-900 to-slate-900 text-white p-5 sm:p-6 shadow-xl overflow-hidden border border-emerald-700/40">
              <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="relative z-10 space-y-3">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  <span>الموسم الدراسي 2026 / 2027</span>
                </div>

                <h2 className="text-lg sm:text-xl md:text-2xl font-black text-white leading-snug">
                  نتائج ومحاضر البطولات والأنشطة الرياضية المدرسية
                </h2>

                <p className="text-xs sm:text-sm text-emerald-100/90 max-w-2xl leading-relaxed">
                  بوابة العموم الرسمية لمتابعة نتائج العدو الريفي المدرسي والمنتمين للأندية، المجموعات، نتائج المباريات وتصنيفات الأبطال والمؤسسات التعليمية بالمديرية الإقليمية.
                </p>

                {/* Scope Filters */}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {[
                    { id: 'ALL', label: 'جميع المستويات' },
                    { id: 'PROVINCIAL', label: '🏆 البطولة الإقليمية' },
                    { id: 'REGIONAL', label: '🏅 البطولة الجهوية' },
                    { id: 'NATIONAL', label: '🥇 البطولة الوطنية' }
                  ].map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedScope(s.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        selectedScope === s.id
                          ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                          : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* FILTER BAR & SEARCH */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 transition-colors">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
                
                {/* Search Input */}
                <div className="sm:col-span-2 relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث باسم التلميذ، المؤسسة، أو التخصص..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder-slate-400"
                  />
                </div>

                {/* Category Filter */}
                <div>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">جميع الفئات العمرية</option>
                    <option value="U12">البراعم والبرعمات (U12)</option>
                    <option value="U15">الصغار والصغيرات (U15)</option>
                    <option value="U18">الفتيان والفتيات (U18)</option>
                    <option value="U20">الشبان والشابات (U20)</option>
                  </select>
                </div>

                {/* Affiliation Filter for Cross Country / Individual Sports */}
                <div>
                  <select
                    value={selectedAffiliation}
                    onChange={(e) => setSelectedAffiliation(e.target.value as any)}
                    className="w-full px-3 py-2 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700 rounded-xl text-xs font-black text-emerald-900 dark:text-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="ALL">معيار الانتماء: جميع المشاركين</option>
                    <option value="CLUB">المنتمين للأندية فقط 🏅</option>
                    <option value="NON_CLUB">غير المنتمين للأندية (مدرسي) 🏫</option>
                  </select>
                </div>

              </div>

              {/* View Sub-Tabs */}
              <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setActivePublicTab('CC_PODIUM')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePublicTab === 'CC_PODIUM'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>نتائج العدو الريفي والمنتمين للأندية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePublicTab('MATCHES')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePublicTab === 'MATCHES'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  <span>المباريات والنتائج الجماعية</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActivePublicTab('TOURNAMENTS')}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePublicTab === 'TOURNAMENTS'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>دليل البطولات ({filteredTournaments.length})</span>
                </button>
              </div>

            </div>

            {/* TAB 1: CROSS COUNTRY PODIUM & RANKING RESULTS */}
            {activePublicTab === 'CC_PODIUM' && (
              <div className="space-y-4">
                {crossCountryList.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-xs transition-colors">
                    <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      لا توجد نتائج مسجلة تطابق معايير التصفية الحالية
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      جرب تغيير الفئة العمرية، معيار الانتماء للأندية، أو الرياضة المحددة.
                    </p>
                  </div>
                ) : (
                  crossCountryList.map((catGroup) => (
                    <div key={catGroup.key} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4 transition-colors">
                      
                      {/* Header */}
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-xl">
                            <Trophy className="w-5 h-5" />
                          </span>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 dark:text-white">
                              {catGroup.categoryName}
                            </h3>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                              عدد العدائين المعتمدين: {catGroup.runners.length} عداء(ة)
                            </p>
                          </div>
                        </div>

                        <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-bold">
                          النتائج الرسمية
                        </span>
                      </div>

                      {/* Top 3 Podium Highlights */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {catGroup.runners.slice(0, 3).map((winner, idx) => {
                          const rank = idx + 1;
                          const winnerName = winner.fullName || winner.studentName;
                          const isClub = students.find(s => s.id === winner.studentId || s.fullName === winnerName)?.affiliationType === 'club_affiliated' || winner.affiliationType === 'club_affiliated';
                          
                          return (
                            <div
                              key={winner.studentId || idx}
                              className={`p-3.5 rounded-2xl border transition-all text-center space-y-2 ${
                                rank === 1
                                  ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700'
                                  : rank === 2
                                  ? 'bg-slate-50 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700'
                                  : 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700'
                              }`}
                            >
                              <div className="inline-flex items-center justify-center w-8 h-8 rounded-full font-black text-xs shadow-xs mx-auto" style={{
                                backgroundColor: rank === 1 ? '#f59e0b' : rank === 2 ? '#94a3b8' : '#d97706',
                                color: '#fff'
                              }}>
                                #{rank}
                              </div>

                              <div>
                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                  {winner.fullName || winner.studentName}
                                </p>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                                  {winner.schoolName}
                                </p>
                              </div>

                              <div className="flex items-center justify-center gap-1.5 pt-1">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isClub
                                    ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                    : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                }`}>
                                  {isClub ? 'منتمي لنادٍ 🏅' : 'مدرسي 🏫'}
                                </span>

                                {winner.time && (
                                  <span className="text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                    ⏱️ {winner.time}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* SCHOOL TEAM RANKINGS (ترتيب فرق المؤسسات التعليمية) */}
                      {catGroup.teamRankings && catGroup.teamRankings.length > 0 ? (
                        <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-emerald-500/10 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="p-1.5 bg-amber-500 text-white rounded-lg shadow-xs">
                                <Award className="w-4 h-4" />
                              </span>
                              <div>
                                <h4 className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>ترتيب فرق المؤسسات التعليمية</span>
                                  <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded-full border border-amber-300 dark:border-amber-700">
                                    تأهل 4 عداءين
                                  </span>
                                </h4>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  حسب المجموع الأقل لنقاط رتب أول 4 عداءين واصلين من نفس المدرسة
                                </p>
                              </div>
                            </div>

                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/40 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                              🏆 نتائج الفرق الرسمية
                            </span>
                          </div>

                          <div className="overflow-x-auto border border-amber-200 dark:border-amber-900/50 rounded-xl bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-amber-100/60 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold border-b border-amber-200 dark:border-amber-900">
                                <tr>
                                  <th className="p-2 text-center">الترتيب</th>
                                  <th className="p-2">المؤسسة التعليمية</th>
                                  <th className="p-2 text-center">مجموع النقاط</th>
                                  <th className="p-2 text-center">رتب العدائين الـ 4 الأوائل</th>
                                  <th className="p-2 text-center">حسم التعادل (العداء 4)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-amber-100 dark:divide-slate-800">
                                {catGroup.teamRankings.map((team, tIdx) => {
                                  const rank = tIdx + 1;
                                  return (
                                    <tr key={team.schoolName || tIdx} className="hover:bg-amber-50/50 dark:hover:bg-slate-800/60 transition-colors">
                                      <td className="p-2 text-center font-black">
                                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${
                                          rank === 1
                                            ? 'bg-amber-500 text-white shadow-xs'
                                            : rank === 2
                                            ? 'bg-slate-400 text-white'
                                            : rank === 3
                                            ? 'bg-amber-700 text-white'
                                            : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                        }`}>
                                          #{rank}
                                        </span>
                                      </td>
                                      <td className="p-2 font-bold text-slate-900 dark:text-white">
                                        {team.schoolName}
                                      </td>
                                      <td className="p-2 text-center font-mono font-black text-amber-700 dark:text-amber-400">
                                        {team.totalPoints} ن
                                      </td>
                                      <td className="p-2 text-center">
                                        <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
                                          {team.top4Runners.map((r, rI) => (
                                            <span key={rI} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                                              #{r.rank}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className="p-2 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                        العداء 4 (رتبة #{team.fourthRunnerRank})
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            ℹ️ لم تتمكن أي مؤسسة من استكمال شروط الفريق (وصول 4 عداءين على الأقل من نفس المدرسة لخط النهاية) في هذه الفئة.
                          </p>
                        </div>
                      )}

                      {/* Full Runner Results Table */}
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                            <tr>
                              <th className="p-2.5 text-center">الترتيب</th>
                              <th className="p-2.5">رقم الصدرية</th>
                              <th className="p-2.5">اسم التلميذ(ة)</th>
                              <th className="p-2.5">المؤسسة التعليمية</th>
                              <th className="p-2.5 text-center">معيار الانتماء</th>
                              <th className="p-2.5 text-center">التوقيت</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {catGroup.runners.map((runner, rIdx) => {
                              const runnerName = runner.fullName || runner.studentName;
                              const isClub = students.find(s => s.id === runner.studentId || s.fullName === runnerName)?.affiliationType === 'club_affiliated' || runner.affiliationType === 'club_affiliated';
                              
                              return (
                                <tr key={runner.studentId || rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="p-2.5 text-center font-black text-slate-900 dark:text-white">
                                    #{runner.rank || rIdx + 1}
                                  </td>
                                  <td className="p-2.5 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                    {runner.bibNumber || '-'}
                                  </td>
                                  <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100">
                                    {runner.fullName || runner.studentName}
                                  </td>
                                  <td className="p-2.5 text-slate-600 dark:text-slate-400">
                                    {runner.schoolName}
                                  </td>
                                  <td className="p-2.5 text-center">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      isClub
                                        ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300'
                                        : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                                    }`}>
                                      {isClub ? 'منتمي للأندية' : 'غير منتمي (مدرسي)'}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-center font-mono text-slate-700 dark:text-slate-300">
                                    {runner.time || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB 2: TEAM MATCHES & STANDINGS */}
            {activePublicTab === 'MATCHES' && (
              <div className="space-y-3">
                {filteredMatches.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-xs transition-colors">
                    <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      لا توجد مباريات مسجلة حالياً تطابق البحث
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredMatches.map((m) => (
                      <div key={m.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3 transition-colors">
                        
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <span>{SPORTS_MAP[m.sportId]?.icon || '⚽'}</span>
                            <span>{m.sportName || 'مباراة رياضية'}</span>
                          </span>
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">
                            {m.category || 'عامة'}
                          </span>
                        </div>

                        {/* Teams & Scorecard */}
                        <div className="flex items-center justify-between gap-2 py-1">
                          <div className="flex-1 text-center space-y-1 min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {m.team1Name}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {m.team1SchoolName || 'المؤسسة الأولى'}
                            </p>
                          </div>

                          <div className="px-3 py-1 bg-slate-900 dark:bg-slate-800 text-white rounded-xl text-center font-mono font-black text-sm shrink-0 shadow-xs">
                            {m.status === 'COMPLETED' ? `${m.team1Score ?? 0} - ${m.team2Score ?? 0}` : 'VS'}
                          </div>

                          <div className="flex-1 text-center space-y-1 min-w-0">
                            <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                              {m.team2Name}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {m.team2SchoolName || 'المؤسسة الثانية'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{m.venueName || 'الملعب الرياضي'}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            m.status === 'COMPLETED'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          }`}>
                            {m.status === 'COMPLETED' ? 'مباراة منتهية ✅' : 'مباراة قادمة ⏳'}
                          </span>
                        </div>

                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: TOURNAMENTS CATALOG */}
            {activePublicTab === 'TOURNAMENTS' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredTournaments.length === 0 ? (
                  <div className="sm:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-xs transition-colors">
                    <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      لا توجد بطولات مسجلة حالياً
                    </p>
                  </div>
                ) : (
                  filteredTournaments.map((t) => (
                    <div
                      key={t.id}
                      onClick={() => setSelectedTournamentDetail(t)}
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer space-y-3 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl p-2 bg-emerald-50 dark:bg-emerald-950/60 rounded-2xl">
                            {SPORTS_MAP[t.sportId]?.icon || '🏆'}
                          </span>
                          <div>
                            <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white group-hover:text-emerald-600 transition-colors">
                              {t.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                              {t.sportName || 'بطولة مدرسية'}
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-300 rounded-full text-[10px] font-black shrink-0">
                          {t.level === 'NATIONAL' ? 'وطنية' : t.level === 'REGIONAL' ? 'جهوية' : 'إقليمية'}
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-300 space-y-1">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          <span>التاريخ: {t.startDate || '2026'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                          <span>المكان: {t.venue || 'المؤسسة المستقبلة'}</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                        <span>معاينة التفاصيل الكاملة</span>
                        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

          </div>

          {/* SIDE COLUMN (3 COLS ON DESKTOP): TEACHERS & MANAGERS LOGIN PANEL */}
          <div 
            ref={loginPanelRef}
            className={`space-y-5 transition-all duration-300 order-3 lg:order-none lg:col-span-3 lg:col-start-10 ${
              showLoginPanel ? 'block animate-in slide-in-from-left-4 fade-in duration-300' : 'hidden'
            }`}
          >
            <div className="sticky top-20 bg-white dark:bg-slate-900 border-2 border-emerald-500/50 dark:border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-5 transition-colors">
              {renderLoginPanel()}
            </div>
          </div>
        </div>
      </main>

      {/* TOURNAMENT DETAIL MODAL */}
      {selectedTournamentDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                {selectedTournamentDetail.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedTournamentDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 dark:text-slate-300">
              <p><strong className="font-black">الرياضة:</strong> {selectedTournamentDetail.sportName || 'عامة'}</p>
              <p><strong className="font-black">المستوى:</strong> {selectedTournamentDetail.level || 'إقليمية'}</p>
              <p><strong className="font-black">الفئة العمرية:</strong> {selectedTournamentDetail.category || 'جميع الفئات'}</p>
              <p><strong className="font-black">تاريخ الإجراء:</strong> {selectedTournamentDetail.startDate || '2026'}</p>
              <p><strong className="font-black">المكان:</strong> {selectedTournamentDetail.venue || 'المديرية'}</p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedTournamentDetail(null)}
              className="w-full py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              إغلاق النافذة
            </button>
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1 transition-colors">
        <p className="font-bold text-slate-700 dark:text-slate-300">
          الفرع الإقليمي للجامعة الملكية المغربية للرياضة المدرسية، بوابة نتائج بطولة المديرية الإقليمية تاوريرت 2026
        </p>
        <p className="text-[11px]">
          تم التطوير بالكامل باللغة العربية لدعم وتدبير الأنشطة والبطولات المدرسية المغربية.
        </p>
      </footer>

    </div>
  );
};
