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
  Info,
  Menu,
  MoreHorizontal
} from 'lucide-react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  signOut
} from 'firebase/auth';
import { CommunicationWidget } from '../components/CommunicationWidget';
import { doc, setDoc, getDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { User, Role, Directorate, School, Tournament, Match, Student, CrossCountryCategoryResult, AthleticsCategoryResult, AthleticsWinner, Sport, Referee, AffiliationDisplayConfig } from '../types';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason, getCategoryYearsLabel, normalizeCategoryKey, normalizeTournamentAffiliation, resolveEffectiveAffiliationMode, isAffiliationAllowedByDisplayConfig } from '../lib/dataService';
import { calculateTeamRankings, resolveRunnerParticipationType } from '../lib/crossCountryConfig';
import { hasValidMatchTeams, formatTeamDisplayName, extractMatchGroupLabel, isPlaceholderTeamId, computeGroupStandings } from '../lib/drawTournamentUtils';
import { resolveMatchAffiliation, resolveMatchRefereesInfo, getOrdinalRefLabel } from '../lib/programExportService';
import { AppLogo } from '../components/AppLogo';
import { SportsIntroAnimation } from '../components/SportsIntroAnimation';
import { CrossCountryPodiumView } from '../components/CrossCountryPodiumView';
import toast from 'react-hot-toast';
import { cn, isFlexibleEmailMatch, normalizeDateToYmd, formatMatchDate } from '../lib/utils';

export const Login: React.FC = () => {
  const { currentUser, userProfile, loading, updateProfileState } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  // Mode: 'PUBLIC' (default), or 'REGISTER_TEACHER' if google auth triggers new teacher setup
  const [loginMode, setLoginMode] = useState<'PUBLIC' | 'REGISTER_TEACHER'>('PUBLIC');
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const loginPanelRef = useRef<HTMLDivElement>(null);

  // Data states for Public View
  const [activeDirectorate, setActiveDirectorate] = useState<Directorate | null>(null);
  const activeDirIdRef = useRef<string>('taourirt');
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('app_intro_enabled_v2');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleIntroToggled = (e: any) => {
      if (typeof e.detail === 'boolean') {
        setIsIntroOpen(e.detail);
      }
    };
    window.addEventListener('introToggled', handleIntroToggled);
    return () => window.removeEventListener('introToggled', handleIntroToggled);
  }, []);
  const [isCrossCountryPodiumOpen, setIsCrossCountryPodiumOpen] = useState(false);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [crossCountryResults, setCrossCountryResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [athleticsResults, setAthleticsResults] = useState<Record<string, AthleticsCategoryResult>>({});
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [affiliationDisplayConfig, setAffiliationDisplayConfig] = useState<AffiliationDisplayConfig>(() =>
    DataService.getAffiliationDisplayConfigSync()
  );
  const [referees, setReferees] = useState<Referee[]>([]);
  const [usersDirectory, setUsersDirectory] = useState<User[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Public Filters
  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [selectedScope, setSelectedScope] = useState<'ALL' | 'PROVINCIAL' | 'REGIONAL' | 'NATIONAL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [selectedAffiliation, setSelectedAffiliation] = useState<'ALL' | 'CLUB' | 'NON_CLUB'>('NON_CLUB');
  const [selectedAthleticsSpecialty, setSelectedAthleticsSpecialty] = useState<'ALL' | 'track' | 'field'>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [filterMatchesByDate, setFilterMatchesByDate] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePublicTab, setActivePublicTab] = useState<'CC_PODIUM' | 'ATHLETICS' | 'MATCHES' | 'TOURNAMENTS'>('MATCHES');
  
  // Refs for horizontal scrolling containers
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const ccCategoryScrollRef = useRef<HTMLDivElement>(null);
  const athCategoryScrollRef = useRef<HTMLDivElement>(null);
  const genericCategoryScrollRef = useRef<HTMLDivElement>(null);
  const sportsBarRef = useRef<HTMLDivElement>(null);
  const set1Ref = useRef<HTMLDivElement>(null);
  const [isSportsBarDragging, setIsSportsBarDragging] = useState(false);
  const [sportsBarStartX, setSportsBarStartX] = useState(0);
  const [sportsBarScrollLeft, setSportsBarScrollLeft] = useState(0);
  const [isSportsBarPaused, setIsSportsBarPaused] = useState(false);
  const sportsBarTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let animationFrameId: number;
    const scrollEl = sportsBarRef.current;
    const set1El = set1Ref.current;

    const step = () => {
      if (scrollEl && set1El && !isSportsBarPaused && !isSportsBarDragging) {
        const set1Width = set1El.offsetWidth;
        scrollEl.scrollLeft += 0.6;
        if (scrollEl.scrollLeft >= set1Width) {
          scrollEl.scrollLeft -= set1Width;
        }
      }
      animationFrameId = requestAnimationFrame(step);
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isSportsBarPaused, isSportsBarDragging]);

  const triggerSportsBarPause = () => {
    setIsSportsBarPaused(true);
    if (sportsBarTimeoutRef.current) {
      clearTimeout(sportsBarTimeoutRef.current);
    }
    sportsBarTimeoutRef.current = setTimeout(() => {
      setIsSportsBarPaused(false);
    }, 2000);
  };

  const scrollContainer = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
      if (ref === sportsBarRef) {
        triggerSportsBarPause();
      }
      const scrollAmount = 200;
      ref.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Track expanded state for general ranking tables (default: hidden)
  const [expandedRankings, setExpandedRankings] = useState<Record<string, boolean>>({});
  const toggleRanking = (key: string) => {
    setExpandedRankings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Helper to safely compare dates regardless of their format (string, Firestore Timestamp, serialized Timestamp, or Date object)
  const safeDateCompare = (dateVal: any, targetYmd: string) => {
    if (!dateVal || !targetYmd) return false;
    const ymd = normalizeDateToYmd(dateVal);
    return Boolean(ymd && ymd.startsWith(targetYmd));
  };

  // Select a specific program date and enforce date filtering on the main matches view
  const selectProgramDate = (ymd: string) => {
    setSelectedDate(ymd);
    setFilterMatchesByDate(true);
    const parts = ymd.split('-');
    if (parts.length === 3) {
      const y = Number(parts[0]);
      const m = Number(parts[1]) - 1;
      if (!Number.isNaN(y) && !Number.isNaN(m)) {
        setCurrentCalendarMonth(prev =>
          prev.getFullYear() === y && prev.getMonth() === m ? prev : new Date(y, m, 1)
        );
      }
    }
    if (selectedSport !== 'cross_country' && selectedSport !== 'athletics') {
      setActivePublicTab('MATCHES');
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
      selectProgramDate(newYmd);
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
      selectProgramDate(newYmd);
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

  // Marquee pause & visibility state (with localStorage persistence)
  const [isMarqueePaused, setIsMarqueePaused] = useState(false);
  const [isMarqueeVisible, setIsMarqueeVisible] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('app_marquee_visible');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const toggleMarqueeVisibility = () => {
    setIsMarqueeVisible(prev => {
      const next = !prev;
      try {
        localStorage.setItem('app_marquee_visible', String(next));
      } catch (e) {
        console.warn(e);
      }
      return next;
    });
  };

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
  const [isCalendarExpanded, setIsCalendarExpanded] = useState<boolean>(true);
  const [mobileProgramTab, setMobileProgramTab] = useState<'daily' | 'monthly'>('daily');

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

  // Load active directorate & initial data for public view & registration
  const loadAllData = async (targetDirId?: string) => {
    setLoadingData(true);
    try {
      const activeDir = await DataService.getActiveDirectorate();
      const effectiveDirId = targetDirId || activeDir.id;
      activeDirIdRef.current = effectiveDirId;
      if (targetDirId && activeDir.id !== targetDirId) {
        const dirs = await DataService.getDirectorates();
        const found = dirs.find(d => d.id === targetDirId);
        if (found) setActiveDirectorate(found);
      } else {
        setActiveDirectorate(activeDir);
      }

      const [dirs, schs, tours, mtchs, stds, ccRes, athRes, sps, refs, usrs] = await Promise.all([
        DataService.getDirectorates(),
        DataService.getSchools(effectiveDirId),
        DataService.getTournaments(effectiveDirId),
        DataService.getMatches(effectiveDirId),
        DataService.getStudents(effectiveDirId),
        DataService.getCrossCountryResults(effectiveDirId),
        DataService.getAthleticsResults(effectiveDirId),
        DataService.getSportsConfig(),
        DataService.getReferees().catch(() => [] as Referee[]),
        DataService.getUsers().catch(() => [] as User[])
      ]);

      setDirectorates(dirs || []);
      setSchools(schs || []);
      setTournaments(tours || []);
      setSportsConfig(sps || []);
      setReferees(refs || []);
      setUsersDirectory(usrs || []);
      setMatches(mtchs || []);
      setStudents(stds || []);
      setCrossCountryResults(ccRes || {});
      setAthleticsResults(athRes || {});

    } catch (err) {
      console.warn("Could not load public data in Login page:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const handleDirectorateChange = async (dirId: string) => {
    DataService.setActiveDirectorateId(dirId);
    const targetDir = directorates.find(d => d.id === dirId);
    if (targetDir) {
      setActiveDirectorate(targetDir);
    }
    setRegDirectorateId(dirId);
    await loadAllData(dirId);
    window.dispatchEvent(new CustomEvent('directorateChanged', { detail: dirId }));
    toast.success(`تم التحويل إلى: ${targetDir?.name || dirId}`);
  };

  useEffect(() => {
    loadAllData('taourirt');

    const unsubSchools = DataService.subscribeToSchools((s) => {
      const dir = activeDirIdRef.current;
      setSchools(!dir || dir === 'all' ? s : s.filter(item => !item.directorateId || item.directorateId === dir));
    });
    const unsubTournaments = DataService.subscribeToTournaments((t) => {
      const dir = activeDirIdRef.current;
      setTournaments(!dir || dir === 'all' ? t : t.filter(item => !item.directorateId || item.directorateId === dir));
    });
    const unsubMatches = DataService.subscribeToMatches((m) => {
      const dir = activeDirIdRef.current;
      setMatches(!dir || dir === 'all' ? m : m.filter(item => !item.directorateId || item.directorateId === dir));
    });
    const unsubCcResults = DataService.subscribeCrossCountryResults((r) => setCrossCountryResults(r as Record<string, CrossCountryCategoryResult>));
    const unsubAthletics = DataService.subscribeAthleticsResults((ar) => setAthleticsResults(ar));
    const unsubAffiliationCfg = DataService.subscribeToAffiliationDisplayConfig((cfg) => setAffiliationDisplayConfig(cfg));

    const handleRefreshPublicData = () => {
      loadAllData(activeDirIdRef.current);
    };
    window.addEventListener('resultsChanged', handleRefreshPublicData);
    window.addEventListener('tournamentDataChanged', handleRefreshPublicData);

    return () => {
      unsubSchools();
      unsubTournaments();
      unsubMatches();
      unsubCcResults();
      unsubAthletics();
      unsubAffiliationCfg();
      window.removeEventListener('resultsChanged', handleRefreshPublicData);
      window.removeEventListener('tournamentDataChanged', handleRefreshPublicData);
    };
  }, []);

  // Determine if existing logged-in user has a profile
  const isProfileComplete = Boolean(userProfile);

  // Redirect to dashboard if already authenticated & has profile
  useEffect(() => {
    if (!loading && currentUser && userProfile) {
      navigate('/dashboard', { replace: true });
    }
  }, [loading, currentUser, userProfile, navigate]);

  // Filtered approved schools by directorate and cycle (including private schools)
  const { filteredSchools, publicSchools, privateSchools } = useMemo(() => {
    const list = [...schools]
      .filter(s => {
        if (!s || !s.name || s.name.includes('غير محدد')) return false;
        const matchesDir = s.directorateId === regDirectorateId || (!s.directorateId && regDirectorateId === 'taourirt');
        if (!matchesDir) return false;
        const t = (s.type || '').trim().toLowerCase();
        const n = (s.name || '').trim().toLowerCase();
        const isPrivate =
          t.includes('خاص') ||
          t.includes('خصوص') ||
          n.includes('خاص') ||
          n.includes('خصوص') ||
          (s.name || '').trim().startsWith('مؤسسة ') ||
          (s as any).isPrivate;

        if (isPrivate) {
          return true;
        }

        if (regTeachingCadre === 'PRIMARY') {
          return t.includes('ابتدائي') || t === 'primary' || n.includes('ابتدائي') || n.includes('م/م') || n.includes('مجموعة مدارس') || n.includes('مدرسة');
        }
        if (regTeachingCadre === 'MIDDLE') {
          return t.includes('إعدادي') || t === 'middle' || n.includes('إعدادي') || n.includes('إعدادية');
        }
        if (regTeachingCadre === 'HIGH') {
          return t.includes('تأهيلي') || t === 'high' || t.includes('ثانوي تأهيلي') || n.includes('تأهيلي') || n.includes('ثانوية');
        }
        return false;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    const pub: School[] = [];
    const priv: School[] = [];

    list.forEach(s => {
      const t = (s.type || '').trim().toLowerCase();
      const n = (s.name || '').trim().toLowerCase();
      const isPriv =
        t.includes('خاص') ||
        t.includes('خصوص') ||
        n.includes('خاص') ||
        n.includes('خصوص') ||
        (s.name || '').trim().startsWith('مؤسسة ') ||
        (s as any).isPrivate;
      if (isPriv) {
        priv.push(s);
      } else {
        pub.push(s);
      }
    });

    return {
      filteredSchools: list,
      publicSchools: pub,
      privateSchools: priv
    };
  }, [schools, regDirectorateId, regTeachingCadre]);

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
        try {
          await setDoc(doc(db, 'users', googleUser.uid), {
            id: googleUser.uid,
            fullName: googleUser.displayName || 'المسير المركزي الرئيسي',
            email: cleanEmail,
            role: 'CENTRAL_ADMIN',
            isSuperAdmin: true,
            isActive: true,
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn("Could not persist super admin user doc:", err);
        }
        toast.success(`مرحباً بك! تم تسجيل الدخول بصلاحيات المشرف العام المركزي (${cleanEmail})`);
        navigate('/dashboard', { replace: true });
        return;
      }

      const dirs = await DataService.getDirectorates();
      const managedDir = dirs.find(d => (d.adminEmails || []).some(ae => isFlexibleEmailMatch(ae, cleanEmail)));
      if (managedDir) {
        try {
          await setDoc(doc(db, 'users', googleUser.uid), {
            id: googleUser.uid,
            fullName: googleUser.displayName || `مسير ${managedDir.name}`,
            email: cleanEmail,
            role: 'CENTRAL_ADMIN',
            directorateId: managedDir.id,
            directorateName: managedDir.name,
            isActive: true,
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn("Could not persist directorate admin user doc:", err);
        }
        DataService.setActiveDirectorateId(managedDir.id);
        toast.success(`مرحباً بك! تم تسجيل الدخول كمسير إقليمي لـ ${managedDir.name}`);
        navigate('/dashboard', { replace: true });
        return;
      }

      // 3. Check if user email exists anywhere in the platform (users collection, teachers, schools, local cache)
      let matchedTeacher: User | null = null;

      // 3.a. Check users list with flexible email match
      try {
        const allUsers = await DataService.getUsers();
        const found = allUsers.find(u => u.email && isFlexibleEmailMatch(u.email, cleanEmail));
        if (found) {
          matchedTeacher = found;
        }
      } catch (checkErr) {
        console.warn("Error checking users list:", checkErr);
      }

      // 3.b. Check teachers list with flexible email match
      if (!matchedTeacher) {
        try {
          const allTeachers = await DataService.getTeachers();
          const found = allTeachers.find(t => t.email && isFlexibleEmailMatch(t.email, cleanEmail));
          if (found) {
            matchedTeacher = found;
          }
        } catch (tErr) {
          console.warn("Error checking teachers list:", tErr);
        }
      }

      // 3.c. Check Firestore user doc by UID
      try {
        const userDoc = await getDoc(doc(db, 'users', googleUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data() as User;
          matchedTeacher = { ...(matchedTeacher || {}), ...data, id: googleUser.uid } as User;
        }
      } catch (checkErr) {
        console.warn("Error checking user doc in Firestore:", checkErr);
      }

      // 3.d. Check Firestore users collection docs with flexible match
      if (!matchedTeacher) {
        try {
          const snap = await getDocs(collection(db, 'users'));
          if (!snap.empty) {
            const foundDoc = snap.docs.find(d => {
              const data = d.data();
              return data.email && isFlexibleEmailMatch(data.email, cleanEmail);
            });
            if (foundDoc) {
              matchedTeacher = { ...(foundDoc.data() as User), id: foundDoc.id };
            }
          }
        } catch (qErr) {
          console.warn("Error querying users collection by email:", qErr);
        }
      }

      // 3.e. Check schools coordinator or teacher contact email
      if (!matchedTeacher) {
        try {
          const allSchools = await DataService.getSchools();
          const matchedSchool = allSchools.find(s => 
            ((s as any).email && isFlexibleEmailMatch((s as any).email, cleanEmail)) ||
            ((s as any).coordinatorEmail && isFlexibleEmailMatch((s as any).coordinatorEmail, cleanEmail))
          );
          if (matchedSchool) {
            matchedTeacher = {
              id: googleUser.uid,
              fullName: googleUser.displayName || `أستاذ(ة) ${matchedSchool.name}`,
              email: cleanEmail,
              role: 'TEACHER',
              workLocation: matchedSchool.name,
              schoolId: matchedSchool.id,
              directorateId: matchedSchool.directorateId || 'taourirt',
              isActive: true,
              createdAt: new Date(),
              updatedAt: new Date()
            };
          }
        } catch (sErr) {
          console.warn("Error checking schools for coordinator email:", sErr);
        }
      }

      // 4. If email is recognized in the app: ALLOW ENTRY IMMEDIATELY
      // The teacher can view, complete, and modify all their data inside the platform after login.
      if (matchedTeacher) {
        const effectiveDirId = matchedTeacher.directorateId || 'taourirt';
        const effectiveDir = dirs.find(d => d.id === effectiveDirId);
        const effectiveDirName = matchedTeacher.directorateName || effectiveDir?.name || 'المديرية الإقليمية بتاوريرت';
        DataService.setActiveDirectorateId(effectiveDirId);

        const mergedProfile: User = {
          ...matchedTeacher,
          id: googleUser.uid,
          email: cleanEmail,
          fullName: matchedTeacher.fullName || googleUser.displayName || 'أستاذ(ة)',
          role: matchedTeacher.role || 'TEACHER',
          directorateId: effectiveDirId,
          directorateName: effectiveDirName,
          photoUrl: (matchedTeacher.photoUrl && matchedTeacher.photoUrl.trim()) || googleUser.photoURL || '',
          isActive: true
        };

        try {
          await setDoc(doc(db, 'users', googleUser.uid), {
            ...mergedProfile,
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }, { merge: true });

          // Purge duplicate second record created during Excel import with typo school name
          await DataService.cleanupDuplicateTeachers(mergedProfile);
        } catch (linkErr) {
          console.warn("Error linking user uid or cleaning duplicates:", linkErr);
        }

        updateProfileState(mergedProfile);

        toast.success(`مرحباً بك ذ. ${mergedProfile.fullName}! تم تسجيل الدخول بنجاح. يمكنك تعديل بياناتك الشخصية من داخل المنصة في أي وقت.`);
        navigate('/dashboard', { replace: true });
        return;
      }

      // 5. If email is NOT registered in the platform: DENY ENTRY COMPLETELY
      try {
        await signOut(auth);
      } catch (soErr) {
        console.warn("Sign out error:", soErr);
      }

      toast.error(
        `عذراً، البريد الإلكتروني (${cleanEmail}) غير مسجل في المنظومة. الدخول حصرياً للأساتذة والأطر الذين تم تسجيل بريدهم مسبقاً في التطبيق.`,
        { duration: 8000 }
      );
      setIsSubmitting(false);
      return;

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

      await DataService.updateUserProfile(targetUid, {
        id: targetUid,
        ...teacherData
      });

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

      {/* LOGIN (GOOGLE SIGN IN FOR PRE-ADDED EMAILS ONLY) */}
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

        <div className="p-3 bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-[11px] text-emerald-900 dark:text-emerald-300 font-bold leading-relaxed flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <span>الدخول متاح مباشرة عبر البريد الإلكتروني (Google) المسجل في التطبيق. يمكنك بعد الدخول إلى المنصة تعديل واستكمال بياناتك ومؤسستك وصورتك الشخصية بكل مرونة.</span>
          </div>
        </div>
      </div>
    </div>
  );

  // Active tournaments (excludes Draft/Archived/inactive tournaments)
  const activeTournaments = useMemo(() => {
    return tournaments.filter(
      t => (t as any).isActive !== false && t.status !== 'Draft' && t.status !== 'Archived'
    );
  }, [tournaments]);

  const effectivePublicAffiliationMode = useMemo(() => {
    return resolveEffectiveAffiliationMode(
      affiliationDisplayConfig,
      selectedSport !== 'ALL' ? selectedSport : undefined
    );
  }, [affiliationDisplayConfig, selectedSport]);

  // Keep selectedAffiliation aligned with the Provincial Supervisor affiliation display rule
  useEffect(() => {
    if (effectivePublicAffiliationMode === 'non_club' && selectedAffiliation !== 'NON_CLUB') {
      setSelectedAffiliation('NON_CLUB');
    } else if (effectivePublicAffiliationMode === 'club_affiliated' && selectedAffiliation !== 'CLUB') {
      setSelectedAffiliation('CLUB');
    }
  }, [effectivePublicAffiliationMode, selectedAffiliation]);

  // Filtered Tournaments for Public Catalog
  const filteredTournaments = useMemo(() => {
    return activeTournaments.filter(t => {
      // Respect supervisor affiliation display setting
      const tAff = normalizeTournamentAffiliation(t.affiliationType, t.name);
      if (!isAffiliationAllowedByDisplayConfig(tAff, affiliationDisplayConfig, t.sportId)) {
        return false;
      }

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
  }, [activeTournaments, affiliationDisplayConfig, selectedDate, selectedSport, selectedScope, selectedCategory, selectedGender, searchQuery]);

  // Helper predicate for Public Match filtering (enforces active tournament + both teams present + sport + affiliation + category + gender + search)
  const doesMatchPassPublicFilters = (m: Match, enforceSelectedDate: boolean): boolean => {
    if (!hasValidMatchTeams(m, schools)) return false;
    if (activeTournaments.length === 0) return false;

    const tourn = m.tournamentId ? activeTournaments.find(t => t.id === m.tournamentId) : undefined;
    // Reject orphan matches whose referenced tournament was deleted/archived
    if (m.tournamentId && !tourn) return false;

    const mSport = m.sportId || tourn?.sportId;
    if (!mSport) return false;

    // Require at least one active tournament for this sport & ensure sport is not marked unprogrammed
    const sportConf = sportsConfig.find(s => s.id === mSport);
    if (sportConf?.isProgrammed === false) return false;
    if (!tourn && !activeTournaments.some(t => t.sportId === mSport)) return false;

    if (enforceSelectedDate && (!m.date || !safeDateCompare(m.date, selectedDate))) {
      return false;
    }

    if (selectedSport !== 'ALL' && mSport !== selectedSport) return false;

    const rawAff = m.affiliationType || tourn?.affiliationType;
    const mAff = rawAff
      ? normalizeTournamentAffiliation(rawAff, tourn?.name)
      : resolveMatchAffiliation(m, activeTournaments);

    if (!isAffiliationAllowedByDisplayConfig(mAff, affiliationDisplayConfig, mSport)) {
      return false;
    }

    if (selectedAffiliation !== 'ALL') {
      if (selectedAffiliation === 'CLUB' && mAff !== 'club_affiliated' && mAff !== 'open') return false;
      if (selectedAffiliation === 'NON_CLUB' && mAff !== 'non_club' && mAff !== 'open') return false;
    }

    if (selectedCategory !== 'ALL') {
      const rawMCat = m.ageCategory || m.category || tourn?.ageCategory || '';
      if (!rawMCat) return false;
      const normMCat = normalizeCategoryKey(rawMCat);
      const normSelectedCat = normalizeCategoryKey(selectedCategory);
      if (normMCat !== normSelectedCat) return false;
    }

    if (selectedGender !== 'ALL') {
      const rawCategoryText = `${m.ageCategory || ''} ${m.category || ''} ${tourn?.name || ''}`;
      const explicitGender =
        m.gender && m.gender !== 'Mixed'
          ? m.gender
          : tourn?.gender && tourn.gender !== 'Mixed'
          ? tourn.gender
          : '';
      const inferredGender =
        explicitGender ||
        (rawCategoryText.includes('إناث') || rawCategoryText.includes('فتيات') || rawCategoryText.includes('صغيرات') || rawCategoryText.includes('برعمات') || rawCategoryText.includes('شابات')
          ? 'Female'
          : rawCategoryText.includes('ذكور') || rawCategoryText.includes('فتيان') || rawCategoryText.includes('صغار') || rawCategoryText.includes('براعم') || rawCategoryText.includes('شبان')
          ? 'Male'
          : '');
      if (!inferredGender || inferredGender !== selectedGender) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const t1 = formatTeamDisplayName(m.team1Id, m.team1Name || m.team1SchoolName, schools, m.team1Placeholder, m.team1SourceMatchNumber).toLowerCase();
      const t2 = formatTeamDisplayName(m.team2Id, m.team2Name || m.team2SchoolName, schools, m.team2Placeholder, m.team2SourceMatchNumber).toLowerCase();
      const venue = (m.venueName || '').toLowerCase();
      const group = extractMatchGroupLabel(m).toLowerCase();
      const stage = (m.stage || '').toLowerCase();
      const matchNumStr = m.drawMatchNumber ? String(m.drawMatchNumber) : '';
      if (
        !t1.includes(q) &&
        !t2.includes(q) &&
        !venue.includes(q) &&
        !group.includes(q) &&
        !stage.includes(q) &&
        !matchNumStr.includes(q)
      ) {
        return false;
      }
    }

    return true;
  };

  // Filtered Matches for Daily Program Calendar Widget (strictly scoped to selectedDate)
  const filteredMatches = useMemo(() => {
    return matches
      .filter(m => doesMatchPassPublicFilters(m, true))
      .sort((a, b) => (a.drawMatchNumber ?? 9999) - (b.drawMatchNumber ?? 9999));
  }, [matches, activeTournaments, sportsConfig, affiliationDisplayConfig, schools, selectedDate, selectedSport, selectedAffiliation, selectedCategory, selectedGender, searchQuery]);

  // Filtered Matches for Public Matches Tab (all dates by default, or selectedDate when toggle active)
  const publicTabMatches = useMemo(() => {
    return matches
      .filter(m => doesMatchPassPublicFilters(m, filterMatchesByDate))
      .sort((a, b) => {
        const numDiff = (a.drawMatchNumber ?? 9999) - (b.drawMatchNumber ?? 9999);
        if (numDiff !== 0) return numDiff;
        const dateA = normalizeDateToYmd(a.date) || '9999-12-31';
        const dateB = normalizeDateToYmd(b.date) || '9999-12-31';
        return dateA.localeCompare(dateB);
      });
  }, [matches, tournaments, schools, selectedDate, filterMatchesByDate, selectedSport, selectedAffiliation, selectedCategory, selectedGender, searchQuery]);

  const publicTabGroupStandings = useMemo(() => {
    if (selectedSport === 'ALL' || selectedSport === 'cross_country' || selectedSport === 'athletics') {
      return [];
    }
    return computeGroupStandings(publicTabMatches, schools);
  }, [publicTabMatches, schools, selectedSport]);

  // Cross Country Results Data (Strictly Separated, Deduplicated, & Recalculated by Affiliation)
  const crossCountryList = useMemo(() => {
    const ccSportConf = sportsConfig.find(s => s.id === 'cross_country');
    if (ccSportConf?.isProgrammed === false) return [];
    const hasActiveCcTournament = activeTournaments.some(t => t.sportId === 'cross_country');
    if (!hasActiveCcTournament) return [];

    const list: Array<{
      key: string;
      categoryKey: string;
      categoryName: string;
      runners: Array<any>;
      teamRankings: ReturnType<typeof calculateTeamRankings>;
    }> = [];

    const processedCategoryKeys = new Set<string>();
    const seenPodiumSignatures = new Set<string>();

    Object.entries(crossCountryResults).forEach(([key, val]) => {
      const catRes = val as CrossCountryCategoryResult;
      if (!catRes || !catRes.podium || catRes.podium.length === 0) return;

      // Canonical key for deduplication
      const canonicalKey = catRes.categoryId || key;
      if (processedCategoryKeys.has(canonicalKey)) return;

      const catName = catRes.titleAr || catRes.category || key;

      // Identify declared gender of this category
      const isFemaleCat =
        catRes.gender === 'Female' ||
        catName.includes('إناث') ||
        catName.includes('البرعمات') ||
        catName.includes('برعمات') ||
        catName.includes('الصغيرات') ||
        catName.includes('الفتيات') ||
        catName.includes('الشابات') ||
        canonicalKey.toLowerCase().includes('female');

      // Gender Filter
      if (selectedGender === 'Male' && isFemaleCat) return;
      if (selectedGender === 'Female' && !isFemaleCat) return;

      // Age Category Filter
      if (selectedCategory !== 'ALL' && catRes.category !== selectedCategory) return;

      const winners = catRes.podium || [];

      // Validate runner gender against declared category gender:
      // If a category claims to be female (e.g. البرعمات إناث), but its registered runners are actually male students,
      // it is a data glitch / duplication and MUST NOT be displayed under the female category!
      let confirmedMaleRunnersCount = 0;
      let confirmedFemaleRunnersCount = 0;
      winners.forEach(w => {
        const studentName = w.fullName || (w as any).studentName;
        const studentObj = students.find(s => s.id === w.studentId || s.fullName === studentName);
        if (studentObj) {
          const sGen = (studentObj.gender || '').toLowerCase();
          if (sGen === 'male' || sGen.includes('ذكر') || sGen.includes('ذكور')) confirmedMaleRunnersCount++;
          if (sGen === 'female' || sGen.includes('أنثى') || sGen.includes('إناث')) confirmedFemaleRunnersCount++;
        }
      });

      // Erroneous cross-gender check
      if (isFemaleCat && confirmedMaleRunnersCount > 0 && confirmedFemaleRunnersCount === 0) {
        return;
      }
      if (!isFemaleCat && confirmedFemaleRunnersCount > 0 && confirmedMaleRunnersCount === 0) {
        return;
      }

      // Check for duplicate podium signatures (exact same set of runner names or student IDs)
      const podiumSignature = winners
        .map(w => (w.studentId || w.fullName || '').trim().toLowerCase())
        .filter(Boolean)
        .sort()
        .join('|');

      if (podiumSignature && seenPodiumSignatures.has(podiumSignature)) {
        return; // Duplicate podium from another category, skip!
      }

      processedCategoryKeys.add(canonicalKey);
      if (podiumSignature) {
        seenPodiumSignatures.add(podiumSignature);
      }

      // Filter runners by search query
      const filteredRunners = winners.filter(w => {
        const studentName = w.fullName || (w as any).studentName;
        if (!w || !studentName) return false;

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

      // Split into Non-Club and Club-Affiliated
      const nonClubRunners = filteredRunners.filter(w => {
        const studentName = w.fullName || (w as any).studentName;
        const studentObj = students.find(s => s.id === w.studentId || s.fullName === studentName);
        const isClub = studentObj?.affiliationType === 'club_affiliated' || w.affiliationType === 'club_affiliated';
        return !isClub;
      });

      const clubRunners = filteredRunners.filter(w => {
        const studentName = w.fullName || (w as any).studentName;
        const studentObj = students.find(s => s.id === w.studentId || s.fullName === studentName);
        const isClub = studentObj?.affiliationType === 'club_affiliated' || w.affiliationType === 'club_affiliated';
        return isClub;
      });

      // Recalculate ranks for each separate class starting from #1
      const rankedNonClub = nonClubRunners.map((w, idx) => {
        const resolvedType = resolveRunnerParticipationType(w, students);
        return {
          ...w,
          participationType: resolvedType,
          recalculatedRank: idx + 1
        };
      });

      const rankedClub = clubRunners.map((w, idx) => {
        const resolvedType = resolveRunnerParticipationType(w, students);
        return {
          ...w,
          participationType: resolvedType,
          recalculatedRank: idx + 1
        };
      });

      // 1. Process Non-Club Class (Only if selectedAffiliation is not CLUB and allowed by display config)
      if (
        rankedNonClub.length > 0 &&
        selectedAffiliation !== 'CLUB' &&
        isAffiliationAllowedByDisplayConfig('non_club', affiliationDisplayConfig, 'cross_country')
      ) {
        const teamRankings = calculateTeamRankings(rankedNonClub, students);
        list.push({
          key: `${canonicalKey}_non_club`,
          categoryKey: canonicalKey,
          categoryName: `${catName} – صنف غير المنتمين (مدرسي) 🏫`,
          runners: rankedNonClub,
          teamRankings
        });
      }

      // 2. Process Club-Affiliated Class (Only if selectedAffiliation is not NON_CLUB and allowed by display config)
      if (
        rankedClub.length > 0 &&
        selectedAffiliation !== 'NON_CLUB' &&
        isAffiliationAllowedByDisplayConfig('club_affiliated', affiliationDisplayConfig, 'cross_country')
      ) {
        list.push({
          key: `${canonicalKey}_club`,
          categoryKey: canonicalKey,
          categoryName: `${catName} – صنف المنتمين للأندية 🏅`,
          runners: rankedClub,
          teamRankings: [] // Club-affiliated do not participate in school teams
        });
      }
    });

    return list;
  }, [crossCountryResults, activeTournaments, sportsConfig, affiliationDisplayConfig, students, selectedAffiliation, selectedCategory, selectedGender, searchQuery]);

  // Dynamic active tab categories with gender combo for public filters
  const activeTabCategories = useMemo(() => {
    const formatPublicCategoryChipLabel = (cat: string, gender: string, sportId?: string): string => {
      const normCat = normalizeCategoryKey(cat);
      const isFem = gender === 'Female';
      const isMixed = gender === 'Mixed';

      if (normCat === 'U12') {
        return isMixed ? 'براعم وبرعمات U12' : isFem ? 'برعمات U12' : 'براعم U12';
      }
      if (normCat === 'U15') {
        return isMixed ? 'صغار وصغيرات U15' : isFem ? 'صغيرات U15' : 'صغار U15';
      }
      if (normCat === 'U18') {
        return isMixed ? 'فتيان وفتيات U18' : isFem ? 'فتيات U18' : 'فتيان U18';
      }
      if (normCat === 'U20') {
        return isMixed ? 'شبان وشابات U20' : isFem ? 'شابات U20' : 'شبان U20';
      }

      const customName = DataService.getCustomCategoryName(cat, sportId, sportsConfig);
      const genderLabel = isFem ? 'إناث' : isMixed ? 'مختلط' : 'ذكور';
      return customName !== cat ? `${customName} ${genderLabel} (${cat})` : `${cat} ${genderLabel}`;
    };

    if (activePublicTab === 'CC_PODIUM') {
      const hasActiveCcTourn = activeTournaments.some(t => t.sportId === 'cross_country');
      const ccConf = sportsConfig.find(s => s.id === 'cross_country');
      if (!hasActiveCcTourn || ccConf?.isProgrammed === false) {
        return [{ id: 'ALL_ALL', cat: 'ALL', gender: 'ALL', label: 'جميع السباقات 🌟' }];
      }
      const results = Object.values(crossCountryResults) as CrossCountryCategoryResult[];
      const uniqueCats = Array.from(new Set<string>(results.map(r => `${r.category}_${r.gender}`)));
      
      const list = [
        { id: 'ALL_ALL', cat: 'ALL', gender: 'ALL', label: 'جميع السباقات 🌟' }
      ];
      
      const catOrder: Record<string, number> = { 'U12': 1, 'U15': 2, 'U18': 3, 'U20': 4 };
      const sortedKeys = uniqueCats.sort((a, b) => {
        const catA = a.split('_')[0];
        const catB = b.split('_')[0];
        return (catOrder[catA] || 99) - (catOrder[catB] || 99);
      });

      sortedKeys.forEach(key => {
        const [cat, gender] = key.split('_');
        if (!cat || !gender) return;
        
        list.push({
          id: key,
          cat,
          gender: gender as any,
          label: `${formatPublicCategoryChipLabel(cat, gender, 'cross_country')} 🏃`
        });
      });
      
      return list;
    }
    
    if (activePublicTab === 'ATHLETICS') {
      const hasActiveAthTourn = activeTournaments.some(t => t.sportId === 'athletics');
      const athConf = sportsConfig.find(s => s.id === 'athletics');
      if (!hasActiveAthTourn || athConf?.isProgrammed === false) {
        return [{ id: 'ALL_ALL', cat: 'ALL', gender: 'ALL', label: 'جميع المسابقات 🌟' }];
      }
      const results = Object.values(athleticsResults) as AthleticsCategoryResult[];
      const uniqueCats = Array.from(new Set<string>(results.map(r => `${r.category}_${r.gender}`)));
      
      const list = [
        { id: 'ALL_ALL', cat: 'ALL', gender: 'ALL', label: 'جميع المسابقات 🌟' }
      ];
      
      const catOrder: Record<string, number> = { 'U12': 1, 'U15': 2, 'U18': 3, 'U20': 4 };
      const sortedKeys = uniqueCats.sort((a, b) => {
        const catA = a.split('_')[0];
        const catB = b.split('_')[0];
        return (catOrder[catA] || 99) - (catOrder[catB] || 99);
      });

      sortedKeys.forEach(key => {
        const [cat, gender] = key.split('_');
        if (!cat || !gender) return;
        
        list.push({
          id: key,
          cat,
          gender: gender as any,
          label: `${formatPublicCategoryChipLabel(cat, gender, 'athletics')} 🏅`
        });
      });
      
      return list;
    }
    
    if (activePublicTab === 'MATCHES') {
      const teamSportsTourns = activeTournaments.filter(t => {
        const isTeamSport = t.sportId !== 'cross_country' && t.sportId !== 'athletics';
        if (!isTeamSport) return false;
        const sportConf = sportsConfig.find(s => s.id === t.sportId);
        if (sportConf && sportConf.isProgrammed === false) return false;
        if (selectedSport !== 'ALL' && t.sportId !== selectedSport) return false;
        const tAff = normalizeTournamentAffiliation(t.affiliationType, t.name);
        if (!isAffiliationAllowedByDisplayConfig(tAff, affiliationDisplayConfig, t.sportId)) return false;
        if (selectedAffiliation !== 'ALL') {
          if (selectedAffiliation === 'CLUB' && tAff !== 'club_affiliated' && tAff !== 'open') return false;
          if (selectedAffiliation === 'NON_CLUB' && tAff !== 'non_club' && tAff !== 'open') return false;
        }
        return true;
      });
      
      const uniqueBranchSet = new Set<string>();
      teamSportsTourns.forEach(t => {
        const cleanCat = normalizeCategoryKey(t.ageCategory || t.name || 'U15');
        const cleanGender = t.gender || 'Mixed';
        if (cleanCat && cleanGender) {
          uniqueBranchSet.add(`${cleanCat}__${cleanGender}`);
        }
      });
      const uniqueCats = Array.from(uniqueBranchSet);
      
      const list = [
        { id: 'ALL_ALL', cat: 'ALL', gender: 'ALL', label: 'جميع الفئات المبرمجة 🌟' }
      ];
      
      const catOrder: Record<string, number> = { 'U12': 1, 'U15': 2, 'U18': 3, 'U20': 4 };
      const sortedKeys = uniqueCats.sort((a, b) => {
        const catA = a.split('__')[0];
        const catB = b.split('__')[0];
        const orderDiff = (catOrder[catA] || 99) - (catOrder[catB] || 99);
        if (orderDiff !== 0) return orderDiff;
        return a.localeCompare(b);
      });

      sortedKeys.forEach(key => {
        const [cat, gender] = key.split('__');
        if (!cat || !gender) return;
        
        const sportIcon = selectedSport !== 'ALL' ? (SPORTS_MAP[selectedSport]?.icon || '👥') : '👥';
        const labelText = formatPublicCategoryChipLabel(
          cat,
          gender,
          selectedSport !== 'ALL' ? selectedSport : undefined
        );

        list.push({
          id: key,
          cat,
          gender: gender as any,
          label: `${labelText} ${sportIcon}`
        });
      });
      
      return list;
    }
    
    return [
      { id: 'ALL_ALL', cat: 'ALL', gender: 'ALL', label: 'جميع الفئات 🌟' }
    ];
  }, [activePublicTab, activeTournaments, crossCountryResults, athleticsResults, selectedSport, selectedAffiliation, sportsConfig, affiliationDisplayConfig]);

  // Filtered sports for sports bar: STRICTLY sports that are programmed AND have active open tournaments
  const programmedSportsEntries = useMemo(() => {
    return Object.entries(SPORTS_MAP).filter(([sportKey]) => {
      const conf = sportsConfig.find(s => s.id === sportKey);
      const isConfigProgrammed = conf?.isProgrammed === true;
      if (!isConfigProgrammed) return false;

      const openTournaments = activeTournaments.filter(t => t.sportId === sportKey);
      return openTournaments.length > 0;
    });
  }, [sportsConfig, activeTournaments]);

  // News Marquee Items
  const marqueeNews = [
    { id: 1, icon: '🏆', text: 'اعتماد ومصادقة نتائج العدو الريفي المدرسي والإقليمي لموسم 2026/2027 مع التمييز الدقيق بين المنتمين وغير المنتمين للأندية.' },
    { id: 2, icon: '🏃‍♂️', text: 'تأهيل صفوة العدائين والعداءات للبطولة الجهوية والوطنية للرياضة المدرسية بالمديرية الإقليمية.' },
    { id: 3, icon: '⚽', text: 'انطلاق الأدوار الإقصائية للرياضات الجماعية (كرة القدم، كرة السلة، الكرة الطائرة وكرة اليد).' },
    { id: 4, icon: '📋', text: 'فضاء الأساتذة متاح لتسجيل لوائح التلاميذ والفرق المدرسية وتأكيد رخص المشاركة.' },
    { id: 5, icon: '🏁', text: 'تحميل الشواهد التقديرية ومحاضر المباريات والنتائج الرسمية متاح مباشرة عبر المنصة.' }
  ];

  // Keep selectedSport valid if a specific sport was removed from programmed sports, while preserving 'ALL'
  useEffect(() => {
    if (programmedSportsEntries.length > 0 && selectedSport !== 'ALL') {
      const keys = programmedSportsEntries.map(([k]) => k);
      if (!keys.includes(selectedSport)) {
        setSelectedSport('ALL');
      }
    }
  }, [programmedSportsEntries, selectedSport]);

  // Interactive Monthly Calendar & Daily Program Widget (نافذة البرنامج اليومي والشهرية)
  const renderMonthlyProgramWidget = (isMobile = false) => {
    const year = currentCalendarMonth.getFullYear();
    const monthStr = String(currentCalendarMonth.getMonth() + 1).padStart(2, '0');
    
    const sportRelevantMatches = matches.filter(m => doesMatchPassPublicFilters(m, false));

    const set = new Set<string>();
    sportRelevantMatches.forEach(m => {
      const ymd = normalizeDateToYmd(m?.date);
      if (ymd && ymd.startsWith(`${year}-${monthStr}`)) {
        set.add(ymd);
      }
    });
    const monthDatesWithMatches = Array.from(set).sort();
    const formatLocalYmd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayYmd = formatLocalYmd(new Date());

    const handlePrevDay = () => {
      try {
        const parts = selectedDate.split('-');
        const d = parts.length === 3
          ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
          : new Date(selectedDate);
        d.setDate(d.getDate() - 1);
        selectProgramDate(formatLocalYmd(d));
      } catch (e) {
        // ignore
      }
    };

    const handleNextDay = () => {
      try {
        const parts = selectedDate.split('-');
        const d = parts.length === 3
          ? new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
          : new Date(selectedDate);
        d.setDate(d.getDate() + 1);
        selectProgramDate(formatLocalYmd(d));
      } catch (e) {
        // ignore
      }
    };

    if (isMobile) {
      return (
        <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/40 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg space-y-3.5 transition-all">
          {/* Mobile Top Header: Title, Sport, & Jump to Today */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shrink-0 shadow-xs">
                <Calendar className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 truncate">
                  <span>البرنامج اليومي والشهرية</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 rounded-md font-bold">
                    مباشر
                  </span>
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                  {selectedSport !== 'ALL' ? (SPORTS_MAP[selectedSport]?.name || 'المنافسة') : 'كافة الرياضات والبطولات'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => selectProgramDate(todayYmd)}
                className={`px-2.5 py-1 text-[10px] font-black rounded-xl border transition-all cursor-pointer ${
                  selectedDate === todayYmd
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                }`}
                title="الانتقال لتاريخ اليوم"
              >
                ⚡ اليوم
              </button>
            </div>
          </div>

          {/* Mobile View Switcher (البرنامج اليومي vs اليومية الشهرية) */}
          <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-black">
            <button
              type="button"
              onClick={() => setMobileProgramTab('daily')}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mobileProgramTab === 'daily'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>⚡ البرنامج اليومي</span>
              <span className="px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-full text-[10px] font-bold">
                {filteredMatches.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setMobileProgramTab('monthly')}
              className={`py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                mobileProgramTab === 'monthly'
                  ? 'bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-300 shadow-xs font-black'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <span>🗓️ اليومية والبرنامج الشهري</span>
              {monthDatesWithMatches.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
              )}
            </button>
          </div>

          {/* TAB 1: DAILY PROGRAM VIEW (البرنامج اليومي) */}
          {mobileProgramTab === 'daily' && (
            <div className="space-y-3">
              {/* Day Selector with Previous/Next Day navigation */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={handleNextDay}
                  className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer border border-slate-200 dark:border-slate-600"
                  title="اليوم التالي"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>

                <div className="text-center">
                  <div className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-center gap-1.5">
                    <span>برنامج ومباريات يوم:</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">{selectedDate}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    {selectedDate === todayYmd ? '⚡ موعد اليوم الحالي' : 'تاريخ محدد'} • {filteredMatches.length} حدث مبرمج
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handlePrevDay}
                  className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer border border-slate-200 dark:border-slate-600"
                  title="اليوم السابق"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>

              {/* Matches List for Selected Day */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
                {filteredMatches.length === 0 ? (
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-center space-y-2 border border-dashed border-slate-200 dark:border-slate-700">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                      لا توجد مباريات مبرمجة في تاريخ {selectedDate}
                    </p>
                    {monthDatesWithMatches.length > 0 && (
                      <div className="pt-1 flex flex-wrap items-center justify-center gap-1.5 text-[10px]">
                        <span className="text-slate-400 font-bold">مواعيد مبرمجة هذا الشهر:</span>
                        {monthDatesWithMatches.slice(0, 5).map(dt => (
                          <button
                            key={dt}
                            type="button"
                            onClick={() => selectProgramDate(dt)}
                            className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-lg font-black hover:bg-emerald-200 transition-colors cursor-pointer"
                          >
                            {dt.slice(8)} {ARABIC_MONTHS[currentCalendarMonth.getMonth()]}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  filteredMatches.map((m, mIdx) => {
                    const t1Display = formatTeamDisplayName(m.team1Id, m.team1Name || m.team1SchoolName, schools, m.team1Placeholder, m.team1SourceMatchNumber);
                    const t2Display = formatTeamDisplayName(m.team2Id, m.team2Name || m.team2SchoolName, schools, m.team2Placeholder, m.team2SourceMatchNumber);
                    const grpLabel = extractMatchGroupLabel(m);
                    const matchNum = m.drawMatchNumber ?? (mIdx + 1);
                    const refInfo = resolveMatchRefereesInfo(m, referees, usersDirectory);
                    const sportInfo = SPORTS_MAP[m.sportId];
                    const genderLabel = m.gender === 'Female' ? 'إناث' : m.gender === 'Male' ? 'ذكور' : '';
                    const categoryGenderText = [m.ageCategory || m.category, genderLabel].filter(Boolean).join(' • ') || 'عامة';

                    return (
                      <div key={m.id} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-1.5 border border-slate-200/80 dark:border-slate-700/60 shadow-xs hover:border-emerald-400 transition-all">
                        <div className="flex items-center justify-between gap-1 text-[9px] font-black border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 truncate">
                            <span>{sportInfo?.icon || '⚽'}</span>
                            <span className="truncate">{m.sportName || sportInfo?.name || 'رياضة'}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                            m.gender === 'Female'
                              ? 'bg-pink-100 text-pink-800 border border-pink-200 dark:bg-pink-950/80 dark:text-pink-300 dark:border-pink-800'
                              : m.gender === 'Male'
                              ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800'
                              : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}>
                            {categoryGenderText}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 text-[9.5px] font-black">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded-md">
                              المباراة رقم {matchNum}
                            </span>
                            <span className="px-1.5 py-0.5 bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-bold">
                              {m.stage?.trim() || 'دور المجموعات'}
                            </span>
                            {grpLabel && (
                              <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 rounded-md truncate max-w-[120px]">
                                {grpLabel}
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-amber-600 dark:text-amber-400 shrink-0 font-black text-[10px]">{m.startTime || '10:00'}</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-black text-slate-900 dark:text-slate-100">
                          <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 truncate">
                            <span className="truncate">{t1Display} VS {t2Display}</span>
                          </span>
                        </div>

                        {refInfo.hasReferees && (
                          <div className="flex items-start gap-1 text-[9px] font-bold text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                            <ShieldCheck className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                            <span className="leading-snug">
                              <span className="font-black text-indigo-700 dark:text-indigo-300">الحكام: </span>
                              {refInfo.allRefs.join(' • ')}
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 font-bold">
                          <span className="flex items-center gap-1 truncate"><MapPin className="w-2.5 h-2.5" /> {m.venueName || 'الملعب الرياضي'}</span>
                          <span className="text-[9px] font-mono text-slate-400">{m.date}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Notice linking to podium underneath */}
              <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-2xl border border-amber-200 dark:border-amber-800 text-center">
                <p className="text-[11px] font-black text-amber-900 dark:text-amber-200 flex items-center justify-center gap-1">
                  <span>🏆</span>
                  <span>منصة التتويج الأولمبية والنتائج الرسمية معروضة أسفله مباشرة 👇</span>
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: MONTHLY CALENDAR VIEW (اليومية الشهرية) */}
          {mobileProgramTab === 'monthly' && (
            <div className="space-y-3">
              {/* Month Navigator */}
              <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 p-2 rounded-2xl border border-slate-200/80 dark:border-slate-700/60">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer border border-slate-200 dark:border-slate-600"
                  title="الشهر السابق"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800 font-mono">
                  {ARABIC_MONTHS[currentCalendarMonth.getMonth()]} {currentCalendarMonth.getFullYear()}
                </span>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-xl shadow-xs transition-colors cursor-pointer border border-slate-200 dark:border-slate-600"
                  title="الشهر التالي"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

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
                {/* Empty padding slots */}
                {Array.from({ length: new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-7"></div>
                ))}

                {/* Days 1..N */}
                {Array.from({ length: new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 0).getDate() }).map((_, idx) => {
                  const dayNum = idx + 1;
                  const dayStr = String(dayNum).padStart(2, '0');
                  const cellYmd = `${year}-${monthStr}-${dayStr}`;

                  const isSelected = selectedDate === cellYmd;
                  const dayMatchesCount = sportRelevantMatches.filter(m => safeDateCompare(m.date, cellYmd)).length;
                  const hasMatches = dayMatchesCount > 0;

                  return (
                    <button
                      key={dayNum}
                      type="button"
                      onClick={() => {
                        selectProgramDate(cellYmd);
                        setMobileProgramTab('daily');
                      }}
                      className={`h-7 rounded-xl flex flex-col items-center justify-center relative font-bold text-[11px] transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-black shadow-md scale-105 ring-2 ring-emerald-400'
                          : hasMatches
                          ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black'
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

              {/* Quick Jump Dates With Matches */}
              {monthDatesWithMatches.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="text-slate-400 font-bold">أيام المنافسات:</span>
                  {monthDatesWithMatches.map(dt => (
                    <button
                      key={dt}
                      type="button"
                      onClick={() => {
                        selectProgramDate(dt);
                        setMobileProgramTab('daily');
                      }}
                      className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-lg font-black hover:bg-emerald-200 transition-colors cursor-pointer"
                    >
                      {dt.slice(8)} {ARABIC_MONTHS[currentCalendarMonth.getMonth()]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Desktop Layout
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-3.5 transition-all">
        {/* Header with Month Navigator */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-200/60 dark:border-emerald-800">
              <Calendar className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-slate-100 truncate">
                البرنامج الشهري واليومية
              </h4>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">
                {selectedSport !== 'ALL' ? (SPORTS_MAP[selectedSport]?.name || 'المنافسة') : 'كافة الرياضات والبطولات'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title="الشهر السابق"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <span className="text-[11px] font-black text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 font-mono">
              {ARABIC_MONTHS[currentCalendarMonth.getMonth()]} {currentCalendarMonth.getFullYear()}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title="الشهر التالي"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Monthly Calendar Grid (اليومية الشهرية) */}
        <div className="space-y-2">
          {/* Days of week header */}
          <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-black text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-100 dark:border-slate-800">
            <span>أحد</span>
            <span>اتن</span>
            <span>ثلا</span>
            <span>أرب</span>
            <span>خميس</span>
            <span>جمعة</span>
            <span>سبت</span>
          </div>

          {/* Days cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 text-center text-xs">
            {/* Empty padding slots before 1st of month */}
            {Array.from({ length: new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth(), 1).getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7 sm:h-8"></div>
            ))}

            {/* Days 1..N */}
            {Array.from({ length: new Date(currentCalendarMonth.getFullYear(), currentCalendarMonth.getMonth() + 1, 0).getDate() }).map((_, idx) => {
              const dayNum = idx + 1;
              const dayStr = String(dayNum).padStart(2, '0');
              const cellYmd = `${year}-${monthStr}-${dayStr}`;

              const isSelected = selectedDate === cellYmd;
              const dayMatchesCount = sportRelevantMatches.filter(m => safeDateCompare(m.date, cellYmd)).length;
              const hasMatches = dayMatchesCount > 0;

              return (
                <button
                  key={dayNum}
                  type="button"
                  onClick={() => selectProgramDate(cellYmd)}
                  className={`h-7 sm:h-8 rounded-xl flex flex-col items-center justify-center relative font-bold text-[11px] sm:text-xs transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-black shadow-md shadow-emerald-600/30 scale-105 ring-2 ring-emerald-400'
                      : hasMatches
                      ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-black'
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
        <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>برمجة ومباريات يوم ({selectedDate}):</span>
            </span>
            <span className="px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 rounded-md font-mono font-black text-[11px] border border-emerald-200/50 dark:border-emerald-800">
              {filteredMatches.length} حدث/مباراة
            </span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {filteredMatches.length === 0 ? (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl text-center space-y-1.5 border border-dashed border-slate-200 dark:border-slate-700/60">
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  لا توجد مباريات مبرمجة في تاريخ {selectedDate}
                </p>
                {(selectedSport === 'athletics' || selectedSport === 'cross_country') && (
                  <p className="text-[10px] font-black text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 py-1 px-2.5 rounded-lg inline-block">
                    🏆 منصة التتويج والنتائج الرسمية المعتمدة معروضة أسفله مباشرة 👇
                  </p>
                )}
                {monthDatesWithMatches.length > 0 && (
                  <div className="pt-1 flex flex-wrap items-center justify-center gap-1 text-[10px]">
                    <span className="text-slate-400">مواعيد مبرمجة هذا الشهر:</span>
                    {monthDatesWithMatches.slice(0, 4).map(dt => (
                      <button
                        key={dt}
                        type="button"
                        onClick={() => selectProgramDate(dt)}
                        className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 rounded-md font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
                      >
                        {dt.slice(8)} {ARABIC_MONTHS[currentCalendarMonth.getMonth()]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              filteredMatches.map((m, mIdx) => {
                const t1Display = formatTeamDisplayName(m.team1Id, m.team1Name || m.team1SchoolName, schools, m.team1Placeholder, m.team1SourceMatchNumber);
                const t2Display = formatTeamDisplayName(m.team2Id, m.team2Name || m.team2SchoolName, schools, m.team2Placeholder, m.team2SourceMatchNumber);
                const grpLabel = extractMatchGroupLabel(m);
                const matchNum = m.drawMatchNumber ?? (mIdx + 1);
                const refInfo = resolveMatchRefereesInfo(m, referees, usersDirectory);
                const sportInfo = SPORTS_MAP[m.sportId];
                const genderLabel = m.gender === 'Female' ? 'إناث' : m.gender === 'Male' ? 'ذكور' : '';
                const categoryGenderText = [m.ageCategory || m.category, genderLabel].filter(Boolean).join(' • ') || 'عامة';

                return (
                  <div key={m.id} className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-2xl space-y-1.5 border border-slate-200/80 dark:border-slate-700/60 hover:border-emerald-300 transition-all">
                    <div className="flex items-center justify-between gap-1 text-[9px] font-black border-b border-slate-200/60 dark:border-slate-700/60 pb-1">
                      <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 truncate">
                        <span>{sportInfo?.icon || '⚽'}</span>
                        <span className="truncate">{m.sportName || sportInfo?.name || 'رياضة'}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                        m.gender === 'Female'
                          ? 'bg-pink-100 text-pink-800 border border-pink-200 dark:bg-pink-950/80 dark:text-pink-300 dark:border-pink-800'
                          : m.gender === 'Male'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800'
                          : 'bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {categoryGenderText}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1 text-[9.5px] font-black">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200 rounded-md">
                          المباراة رقم {matchNum}
                        </span>
                        <span className="px-1.5 py-0.5 bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-md font-bold">
                          {m.stage?.trim() || 'دور المجموعات'}
                        </span>
                        {grpLabel && (
                          <span className="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-200 rounded-md truncate max-w-[120px]">
                            {grpLabel}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-amber-600 dark:text-amber-400 shrink-0 font-black text-[10px]">{m.startTime || '10:00'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-black text-slate-900 dark:text-slate-100">
                      <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200 truncate">
                        <span className="truncate">{t1Display} VS {t2Display}</span>
                      </span>
                    </div>

                    {refInfo.hasReferees && (
                      <div className="flex items-start gap-1 text-[9px] font-bold text-slate-600 dark:text-slate-300 pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                        <ShieldCheck className="w-3 h-3 text-indigo-500 shrink-0 mt-0.5" />
                        <span className="leading-snug">
                          <span className="font-black text-indigo-700 dark:text-indigo-300">الحكام: </span>
                          {refInfo.allRefs.join(' • ')}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1"><MapPin className="w-2.5 h-2.5" /> {m.venueName || 'الملعب'}</span>
                      <span className="text-[9px] font-mono text-slate-400">{m.date}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  };

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

      {/* Monthly Program & Interactive Monthly Calendar (نافذة اليومية الشهرية - معروضة هنا في الحاسوب فقط) */}
      <div className="hidden lg:block">
        {renderMonthlyProgramWidget(false)}
      </div>

      {/* Tournament Guides Button */}
      <button
        type="button"
        onClick={() => {
          setActivePublicTab('TOURNAMENTS');
          const resultsSection = document.getElementById('public-results-section');
          resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
        className={`w-full py-3.5 px-4 rounded-2xl text-xs font-black transition-all cursor-pointer flex items-center justify-between border-2 shadow-xs ${
          activePublicTab === 'TOURNAMENTS'
            ? 'bg-emerald-600 text-white border-emerald-500 shadow-md ring-2 ring-emerald-400/20'
            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
        }`}
      >
        <div className="flex items-center gap-2">
          <Layers className={`w-4 h-4 ${activePublicTab === 'TOURNAMENTS' ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'}`} />
          <span>دليل البطولات والمحاضر</span>
        </div>
        <span className="text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">
          {filteredTournaments.length}
        </span>
      </button>

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
      
      {/* FIXED TOP NAVIGATION WRAPPER (HEADER + SPORTS BAR + MARQUEE + DATE BAR) */}
      <div className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md shadow-sm transition-all duration-300">
        
        {/* TOP HEADER BAR - Centered & Optimized on Mobile */}
        <header className="border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2 sm:py-2.5 transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            
            {/* Logo & Platform Name */}
            <div className="flex items-center gap-3">
              <AppLogo size={42} showText={false} className="shrink-0" />
              <div className="flex flex-col items-start text-right">
                <h1 className="text-sm sm:text-base md:text-lg font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                  نتائج البطولات الإقليمية للرياضة المدرسية
                </h1>
                <span className="text-[10px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400">
                  المديرية الإقليمية لتاوريرت
                </span>
              </div>
            </div>

            {/* Action Icons: Far Left (End in RTL) - Optimized as small icons in a single row */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
              {/* Teacher Login Icon Button - Person Icon */}
              <button
                type="button"
                onClick={() => {
                  if (loginMode === 'REGISTER_TEACHER') setLoginMode('PUBLIC');
                  const nextState = !showLoginPanel;
                  setShowLoginPanel(nextState);
                  if (nextState) {
                    setTimeout(() => loginPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                  }
                }}
                className={`p-1.5 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                  showLoginPanel 
                    ? 'bg-emerald-600 text-white ring-1 ring-emerald-400' 
                    : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 text-emerald-600 dark:text-emerald-400 border border-slate-200 dark:border-slate-700'
                }`}
                title="دخول الأطر والمسيرين"
              >
                <UserIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {/* Dark Mode Toggle Icon Button */}
              <button
                type="button"
                onClick={toggleDarkMode}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg transition-all cursor-pointer flex items-center justify-center"
                title={isDarkMode ? 'التحويل للوضع النهاري' : 'التحويل للوضع الليلي'}
              >
                {isDarkMode ? (
                  <Sun className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 shrink-0" />
                ) : (
                  <Moon className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-indigo-600 shrink-0" />
                )}
              </button>

              {/* Communication Widget Message Button */}
              <CommunicationWidget />

              {/* Mobile Menu Dropdown Toggle */}
              <div className="relative lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center border ${
                    isMobileMenuOpen 
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isMobileMenuOpen ? <X className="w-4 h-4 sm:w-4.5 sm:h-4.5" /> : <Menu className="w-4 h-4 sm:w-4.5 sm:h-4.5" />}
                </button>

                {/* Dropdown Menu Overlay */}
                {isMobileMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-transparent" 
                      onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <div className="absolute left-0 mt-2 w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95 duration-150 origin-top-left">
                      
                      {/* Top Action Icons & Search in Menu */}
                      <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">إعدادات سريعة</span>
                          <div className="flex items-center gap-2">
                            {/* Dark Mode Toggle Item */}
                            <button
                              type="button"
                              onClick={toggleDarkMode}
                              className="p-2.5 bg-white dark:bg-slate-800 text-slate-800 dark:text-amber-400 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-transform active:scale-90"
                              title={isDarkMode ? 'الوضع النهاري' : 'الوضع الليلي'}
                            >
                              {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Search Input in Side Menu */}
                        <div className="relative">
                          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="ابحث عن تلميذ أو مؤسسة..."
                            className="w-full pr-9 pl-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                          />
                        </div>
                      </div>

                      <div className="p-2 space-y-1">
                        <button
                          onClick={() => {
                            if (loginMode === 'REGISTER_TEACHER') setLoginMode('PUBLIC');
                            setShowLoginPanel(true);
                            setIsMobileMenuOpen(false);
                            setTimeout(() => loginPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 text-right text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors"
                        >
                          <LogIn className="w-4 h-4 text-emerald-600" />
                          <span>تسجيل الدخول للأطر والمسيرين</span>
                        </button>
                        
                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

                        {[
                          { id: 'CC_PODIUM', label: 'نتائج العدو الريفي', icon: <Trophy className="w-4 h-4" /> },
                          { id: 'ATHLETICS', label: 'نتائج ألعاب القوى', icon: <Award className="w-4 h-4" /> },
                          { id: 'MATCHES', label: 'الرياضات الجماعية', icon: <Calendar className="w-4 h-4" /> },
                          { id: 'TOURNAMENTS', label: 'رياضات أخرى / دليل', icon: <Layers className="w-4 h-4" /> }
                        ].map(item => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActivePublicTab(item.id as any);
                              setIsMobileMenuOpen(false);
                              const resultsSection = document.getElementById('public-results-section');
                              resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            className={`w-full flex items-center gap-3 px-3 py-3 text-right text-xs font-bold rounded-xl transition-colors ${
                              activePublicTab === item.id 
                                ? 'bg-emerald-600 text-white shadow-sm' 
                                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                            }`}
                          >
                            <span className={activePublicTab === item.id ? 'text-white' : 'text-emerald-500'}>
                              {item.icon}
                            </span>
                            <span>{item.label}</span>
                          </button>
                        ))}

                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1 mx-2" />

                        <button
                          onClick={() => {
                            setIsAboutModalOpen(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 text-right text-xs font-black text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-xl transition-colors"
                        >
                          <Info className="w-4 h-4" />
                          <span>حول المنظومة الرقمية ℹ️</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* SPORTS BAR (شريط الرياضات مع عكس الاتجاه وإمكانية التحريك اليدوي والسحب) */}
        <section className="bg-white/50 dark:bg-slate-900/50 py-1.5 px-3 sm:px-6 shadow-xs select-none transition-all">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="hidden sm:flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-3">
                <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>شريط الرياضات:</span>
              </div>

              {/* Manual navigation buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => scrollContainer(sportsBarRef, 'right')}
                  className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="تحريك لليمين"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollContainer(sportsBarRef, 'left')}
                  className="p-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
                  title="تحريك لليسار"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
              </div>

              <div 
                ref={sportsBarRef}
                className="flex-1 overflow-x-auto overflow-y-hidden relative py-0.5 group cursor-grab active:cursor-grabbing no-scrollbar"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      triggerSportsBarPause();
                      setSelectedSport('ALL');
                      setActivePublicTab('MATCHES');
                      setSelectedCategory('ALL');
                      setSelectedGender('ALL');
                    }}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      selectedSport === 'ALL'
                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-black scale-105'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60'
                    }`}
                  >
                    <span className="text-sm">🏆</span>
                    <span>جميع الرياضات</span>
                  </button>

                  {programmedSportsEntries.map(([sportKey, sport]) => {
                    const isSelected = selectedSport === sportKey;
                    return (
                      <button
                        key={sportKey}
                        type="button"
                        onClick={() => {
                          triggerSportsBarPause();
                          setSelectedSport(sportKey);
                          if (sportKey === 'cross_country') {
                            setActivePublicTab('CC_PODIUM');
                          } else if (sportKey === 'athletics') {
                            setActivePublicTab('ATHLETICS');
                          } else {
                            setActivePublicTab('MATCHES');
                          }
                          setSelectedCategory('ALL');
                          setSelectedGender('ALL');
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                          isSelected
                            ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 font-black scale-105'
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
            </div>
          </div>
        </section>
      </div>

      {/* MAIN CONTAINER (TRIPLE LAYOUT: RIGHT WIDGETS | PUBLIC RESULTS | SIDE TEACHER LOGIN) */}
      <main className="max-w-7xl 2xl:max-w-[1600px] mx-auto px-3 sm:px-6 py-6">
        {/* MOBILE LOGIN PANEL (Appears at the TOP on mobile if active) */}
        {showLoginPanel && (
          <div ref={loginPanelRef} className="lg:hidden mb-6 animate-in slide-in-from-top-4 fade-in duration-300">
            <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500/50 dark:border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-5 transition-colors">
              {renderLoginPanel()}
            </div>
          </div>
        )}

        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">

          {/* RIGHT SIDEBAR WIDGETS (DESKTOP: SIDEBAR IN ROW 1 / MOBILE: AUXILIARY WIDGETS BELOW PODIUM) */}
          <div className="w-full order-2 lg:order-1 lg:col-span-3 lg:col-start-1 lg:row-start-1 space-y-5">
            {renderRightSidebar()}
          </div>

          {/* MAIN COLUMN: PUBLIC RESULTS & CHAMPIONSHIPS PORTAL (FIRST ON MOBILE) */}
          <div className={`w-full space-y-5 transition-all duration-300 order-1 lg:order-2 lg:row-start-1 ${
            showLoginPanel 
              ? 'lg:col-span-6 lg:col-start-4' 
              : 'lg:col-span-9 lg:col-start-4'
          }`}>
            
            {/* FILTER BAR & SEARCH */}
            <div id="public-results-section" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4 transition-colors scroll-mt-24">
              
              {/* PART 1: AFFILIATION (Club vs Non-club, governed by Provincial Supervisor display settings) */}
              <div className="flex items-center gap-2">
                {[
                  ...(effectivePublicAffiliationMode === 'both'
                    ? [{ id: 'ALL', label: 'الصنفين معاً (الكل)', color: 'bg-slate-900 border-slate-800 text-white' }]
                    : []),
                  ...(effectivePublicAffiliationMode === 'both' || effectivePublicAffiliationMode === 'club_affiliated'
                    ? [{ id: 'CLUB', label: 'منتمين للأندية', color: 'bg-amber-500 border-amber-400 text-slate-950' }]
                    : []),
                  ...(effectivePublicAffiliationMode === 'both' || effectivePublicAffiliationMode === 'non_club'
                    ? [{ id: 'NON_CLUB', label: 'مدرسي (غير منتمين)', color: 'bg-emerald-700 border-emerald-500 text-white' }]
                    : [])
                ].map(aff => (
                  <button
                    key={aff.id}
                    type="button"
                    onClick={() => setSelectedAffiliation(aff.id as any)}
                    className={`flex-1 py-3 px-2 rounded-2xl text-[11px] sm:text-xs font-black transition-all cursor-pointer border-2 ${
                      selectedAffiliation === aff.id
                        ? aff.color + ' shadow-inner'
                        : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    {aff.label}
                  </button>
                ))}
              </div>

              {/* SHARED, DYNAMIC CATEGORY SELECTOR WITH SCROLL ARROWS */}
              {activePublicTab !== 'TOURNAMENTS' && activeTabCategories.length > 0 && (
                <div className="space-y-1.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300 px-1">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <Flame className="w-4 h-4 text-amber-500" />
                      <span>الفئات العمرية المتاحة للبطولة المحددة:</span>
                    </span>
                  </div>

                  <div className="relative flex items-center pr-1 pl-1">
                    {/* Right side floating arrow */}
                    <button
                      type="button"
                      onClick={() => scrollContainer(categoryScrollRef, 'right')}
                      className="absolute right-0 z-10 p-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full shadow-md text-emerald-700 dark:text-emerald-400 focus:outline-none transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                      title="التمرير لليمين"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>

                    <div 
                      ref={categoryScrollRef} 
                      className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-8 scroll-smooth"
                    >
                      {activeTabCategories.map((item) => {
                        const isActive = selectedCategory === item.cat && selectedGender === item.gender;
                        
                        // Condition coloring: Amber/Yellow for CLUB, Emerald/Green for NON_CLUB
                        const activeStyle = selectedAffiliation === 'CLUB'
                          ? 'bg-amber-500 text-slate-950 border-amber-400 ring-amber-300 shadow-md ring-2 font-black animate-in zoom-in-95'
                          : 'bg-emerald-600 text-white border-emerald-500 ring-emerald-400 shadow-md ring-2 font-black animate-in zoom-in-95';

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setSelectedCategory(item.cat);
                              setSelectedGender(item.gender as any);
                            }}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border ${
                              isActive
                                ? activeStyle
                                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent'
                            }`}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Left side floating arrow */}
                    <button
                      type="button"
                      onClick={() => scrollContainer(categoryScrollRef, 'left')}
                      className="absolute left-0 z-10 p-1.5 bg-white/95 dark:bg-slate-900/95 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full shadow-md text-emerald-700 dark:text-emerald-400 focus:outline-none transition-all cursor-pointer border border-slate-200 dark:border-slate-700"
                      title="التمرير لليسار"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* 📅 MONTHLY & DAILY PROGRAM (ON MOBILE: PROMINENTLY POSITIONED DIRECTLY ABOVE THE PODIUM) 📅 */}
            <div className="block lg:hidden">
              {renderMonthlyProgramWidget(true)}
            </div>

            {/* TAB 1: CROSS COUNTRY PODIUM & RANKING RESULTS */}
            {activePublicTab === 'CC_PODIUM' && (
              <div className="space-y-6">

                {crossCountryList.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-xs transition-colors">
                    <Trophy className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                      لا توجد نتائج مسجلة تطابق معايير التصفية الحالية
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      جرب اختيار &quot;جميع السباقات والفئات&quot; أو تغيير معيار الانتماء للأندية.
                    </p>
                  </div>
                ) : (
                  crossCountryList.map((catGroup) => {
                    const sortedRunners = [...catGroup.runners].sort((a, b) => ((a.recalculatedRank || a.rank || 0) - (b.recalculatedRank || b.rank || 0)));
                    const first = sortedRunners[0] || null;
                    const second = sortedRunners[1] || null;
                    const third = sortedRunners[2] || null;

                    return (
                      <div key={catGroup.key} className="bg-white dark:bg-slate-900 border-2 border-emerald-500/20 dark:border-slate-800 rounded-3xl p-3 sm:p-6 shadow-md space-y-4 sm:space-y-5 transition-colors overflow-hidden">
                        
                        {/* Header with Title & Badge */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3 sm:pb-4">
                          <div className="flex items-center gap-2.5 sm:gap-3">
                            <span className="p-2 sm:p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-xl sm:rounded-2xl shadow-sm">
                              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" />
                            </span>
                            <div>
                              <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <span>{catGroup.categoryName}</span>
                              </h3>
                              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold mt-0.5">
                                منصة التتويج الرسمية • عدد العدائين المصنفين: {catGroup.runners.length} عداء(ة)
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 rounded-full text-[11px] sm:text-xs font-black flex items-center gap-1.5 shadow-xs">
                              <span>منصة التتويج الأولمبية</span>
                            </span>
                          </div>
                        </div>

                        {/* Top 3 Olympic-Style Podium (1st in Center, 2nd on Left, 3rd on Right) */}
                        {(() => {
                          const renderPodiumSlot = (
                            runner: any | null,
                            rank: 1 | 2 | 3
                          ) => {
                            const isGold = rank === 1;
                            const isSilver = rank === 2;
                            const isBronze = rank === 3;

                            const runnerName = runner ? (runner.fullName || runner.studentName) : '';
                            const isClub = runner ? (students.find(s => s.id === runner.studentId || s.fullName === runnerName)?.affiliationType === 'club_affiliated' || runner.affiliationType === 'club_affiliated') : false;
                            const isTeam = runner ? (resolveRunnerParticipationType(runner, students) === 'school_team') : false;

                            const medalBg = isGold
                              ? 'from-[#ffea79] via-[#fbc02d] to-[#f59e0b] border-amber-300 text-[#713F12]'
                              : isSilver
                              ? 'from-slate-100 via-slate-200 to-slate-400 border-slate-200 text-slate-900'
                              : 'from-amber-600 via-amber-700 to-amber-900 border-amber-500 text-amber-100';

                            const stepHeight = isGold
                              ? 'h-14 sm:h-28 bg-gradient-to-t from-amber-500 via-yellow-400 to-amber-300 text-slate-950 border-t-2 sm:border-t-4 border-yellow-100 shadow-lg'
                              : isSilver
                              ? 'h-10 sm:h-20 bg-gradient-to-t from-slate-400 to-slate-200 dark:from-slate-700 dark:to-slate-500 text-slate-950 dark:text-white border-t-2 sm:border-t-4 border-slate-300 shadow-md'
                              : 'h-7 sm:h-16 bg-gradient-to-t from-amber-800 to-amber-600 dark:from-amber-950 dark:to-amber-800 text-amber-50 border-t-2 sm:border-t-4 border-amber-400 shadow-md';

                            return (
                              <div className={`flex flex-col items-center justify-end w-full min-w-0 ${isGold ? '-translate-y-1.5 sm:-translate-y-4 z-10' : 'z-0'}`}>
                                {/* Circular Medal Badge at top with crown */}
                                <div className="relative -mb-4 sm:-mb-6 z-10">
                                  <div className={`w-14 h-14 sm:w-20 sm:h-20 rounded-full border-2 sm:border-4 overflow-hidden bg-gradient-to-b ${medalBg} shadow-md sm:shadow-xl flex flex-col items-center justify-center relative shrink-0 select-none hover:scale-[1.5] active:scale-[1.5] transition-all duration-300 cursor-pointer hover:z-50`}>
                                    {(() => {
                                      const matchedStud = students.find(s => 
                                        (runner?.studentId && s.id === runner.studentId) ||
                                        (runnerName && s.fullName.trim().toLowerCase() === runnerName.trim().toLowerCase())
                                      );
                                      const pPhoto = runner?.photoUrl || matchedStud?.photoUrl;
                                      if (pPhoto) {
                                        return (
                                          <>
                                            <img 
                                              src={pPhoto} 
                                              alt={runnerName} 
                                              className="absolute inset-0 w-full h-full object-cover z-10" 
                                            />
                                          </>
                                        );
                                      }
                                      return (
                                        <div className="w-full h-full bg-slate-100/20" />
                                      );
                                    })()}
                                  </div>
                                </div>

                                {/* Podium Athlete Card */}
                                <div className={`w-full min-w-0 pt-4 sm:pt-8 pb-2 sm:pb-3 px-1 sm:px-3 rounded-xl sm:rounded-2xl border text-center flex flex-col items-center justify-between min-h-[145px] sm:min-h-[210px] shadow-sm transition-all overflow-hidden ${
                                  isGold
                                    ? 'bg-amber-50/95 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 sm:ring-4 ring-amber-400/20'
                                    : isSilver
                                    ? 'bg-slate-50 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 shadow-xs'
                                    : 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800 shadow-xs'
                                }`}>
                                  <div className={`px-1.5 sm:px-2.5 py-0.5 rounded-full text-[8.5px] sm:text-xs font-black mb-1 shadow-xs truncate max-w-full ${
                                    isGold
                                      ? 'bg-amber-400 text-slate-950'
                                      : isSilver
                                      ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white'
                                      : 'bg-amber-700 text-amber-50'
                                  }`}>
                                    {isGold ? 'بطل الفئة 🥇' : isSilver ? 'الوصيف 🥈' : 'المركز الثالث 🥉'}
                                  </div>

                                  {runner ? (
                                    <div className="w-full min-w-0 space-y-0.5 sm:space-y-1.5 my-auto px-0.5">
                                      <h4 className="text-[11px] sm:text-sm md:text-base font-black text-slate-900 dark:text-white truncate w-full" title={runnerName}>
                                        {runnerName}
                                      </h4>
                                      <p className="text-[9px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 truncate w-full" title={runner.schoolName}>
                                        {runner.schoolName}
                                      </p>
                                      {runner.bibNumber && (
                                        <p className="text-[8.5px] sm:text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded inline-block max-w-full truncate">
                                          صدرية: #{runner.bibNumber}
                                        </p>
                                      )}
                                      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-0.5 sm:gap-1 pt-0.5 w-full">
                                        <span className={`px-1 sm:px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-bold truncate max-w-full ${
                                          isClub
                                            ? 'bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                        }`}>
                                          {isClub ? '🏅 منتمي' : '🏫 مدرسي'}
                                        </span>
                                        <span className={`px-1 sm:px-2 py-0.5 rounded text-[8px] sm:text-[10px] font-bold truncate max-w-full ${
                                          isTeam
                                            ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                            : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                        }`}>
                                          {isTeam ? '👥 فريق' : '👤 فردي'}
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="my-auto py-2">
                                      <p className="text-[10px] sm:text-xs text-slate-400 font-bold">في انتظار استكمال النتائج</p>
                                    </div>
                                  )}
                                </div>

                                {/* Olympic Step Block with Number */}
                                <div className={`w-full rounded-t-xl sm:rounded-t-2xl font-black font-mono flex items-center justify-center text-sm sm:text-2xl ${stepHeight}`}>
                                  <span>{rank}</span>
                                </div>
                              </div>
                            );
                          };

                          return (
                            <div className="bg-gradient-to-b from-slate-100/50 to-white dark:from-slate-800/30 dark:to-slate-900/30 p-2 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                              <div className="flex items-end justify-center gap-1 sm:gap-3 max-w-xl mx-auto w-full" dir="ltr">
                                {/* Rank 2 (Left) - Order 1 */}
                                <div dir="rtl" className="flex-1 min-w-0 max-w-[33.33%]">
                                  {renderPodiumSlot(second, 2)}
                                </div>
                                {/* Rank 1 (Center) - Order 2 (elevated) */}
                                <div dir="rtl" className="flex-1 min-w-0 max-w-[33.33%]">
                                  {renderPodiumSlot(first, 1)}
                                </div>
                                {/* Rank 3 (Right) - Order 3 */}
                                <div dir="rtl" className="flex-1 min-w-0 max-w-[33.33%]">
                                  {renderPodiumSlot(third, 3)}
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* SCHOOL TEAM RANKINGS (ترتيب فرق المؤسسات التعليمية) */}
                        {catGroup.teamRankings && catGroup.teamRankings.length > 0 ? (
                          <div className="bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-emerald-500/10 border border-amber-300 dark:border-amber-800/60 rounded-2xl p-3 sm:p-4 space-y-3 overflow-hidden">
                            <div className="flex flex-wrap items-center justify-between gap-2">
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
                              <table className="w-full text-right text-[11px] sm:text-xs min-w-[440px]">
                                <thead className="bg-amber-100/60 dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold border-b border-amber-200 dark:border-amber-900 whitespace-nowrap">
                                  <tr>
                                    <th className="p-2 text-center w-12">الترتيب</th>
                                    <th className="p-2">المؤسسة التعليمية</th>
                                    <th className="p-2 text-center">مجموع النقاط</th>
                                    <th className="p-2 text-center">رتب الـ 4 الأوائل</th>
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
                                        <td className="p-2 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                          {team.schoolName}
                                        </td>
                                        <td className="p-2 text-center font-mono font-black text-amber-700 dark:text-amber-400 whitespace-nowrap">
                                          {team.totalPoints} ن
                                        </td>
                                        <td className="p-2 text-center whitespace-nowrap">
                                          <div className="flex items-center justify-center gap-1 font-mono text-[10px]">
                                            {team.top4Runners.map((r, rI) => (
                                              <span key={rI} className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700">
                                                #{r.recalculatedRank || r.rank}
                                              </span>
                                            ))}
                                          </div>
                                        </td>
                                        <td className="p-2 text-center font-mono text-[11px] text-slate-600 dark:text-slate-400 whitespace-nowrap">
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

                        {/* Collapsible Full Runner Results Section (Default: Hidden) */}
                        {(() => {
                          const isExpanded = Boolean(expandedRankings[catGroup.key]);
                          return (
                            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                              <button
                                type="button"
                                onClick={() => toggleRanking(catGroup.key)}
                                className="w-full py-2.5 px-3 sm:px-4 bg-slate-50 hover:bg-emerald-50/80 dark:bg-slate-800/60 dark:hover:bg-emerald-950/40 border border-slate-200 hover:border-emerald-300 dark:border-slate-700 dark:hover:border-emerald-700 rounded-2xl text-xs font-black text-slate-800 dark:text-slate-200 transition-all flex items-center justify-between cursor-pointer group shadow-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-400 rounded-xl group-hover:scale-110 transition-transform shrink-0">
                                    <Layers className="w-4 h-4" />
                                  </span>
                                  <div className="text-right">
                                    <span className="block font-black text-xs sm:text-sm text-slate-900 dark:text-white">
                                      {isExpanded ? 'إخفاء الترتيب العام الكامل' : `الترتيب العام الكامل لجميع العدائين (${sortedRunners.length})`}
                                    </span>
                                    <span className="block text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                      {isExpanded ? 'انقر لطي الجدول وإخفائه' : 'انقر لاستعراض جدول النتائج وتفاصيل جميع العدائين'}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 text-[11px] sm:text-xs font-black shadow-2xs group-hover:border-emerald-400 transition-colors shrink-0">
                                  <span>{isExpanded ? 'إخفاء' : 'عرض الترتيب'}</span>
                                  <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                </div>
                              </button>

                              {isExpanded && (
                                <div className="mt-3 overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl animate-in fade-in slide-in-from-top-2 duration-200">
                                  <table className="w-full text-right text-xs min-w-[500px]">
                                    <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                                      <tr>
                                        <th className="p-2.5 text-center w-12">الترتيب</th>
                                        <th className="p-2.5 text-center">رقم الصدرية</th>
                                        <th className="p-2.5">اسم التلميذ(ة)</th>
                                        <th className="p-2.5">المؤسسة التعليمية</th>
                                        <th className="p-2.5 text-center">معيار الانتماء</th>
                                        <th className="p-2.5 text-center">نوع المشاركة</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                      {sortedRunners.map((runner, rIdx) => {
                                        const runnerName = runner.fullName || runner.studentName;
                                        const isClub = students.find(s => s.id === runner.studentId || s.fullName === runnerName)?.affiliationType === 'club_affiliated' || runner.affiliationType === 'club_affiliated';
                                        const isTeam = runner.participationType === 'school_team' || runner.participationType === 'فريق';

                                        return (
                                          <tr key={runner.studentId || rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-2.5 text-center font-black text-slate-900 dark:text-white">
                                              #{runner.recalculatedRank || runner.rank || rIdx + 1}
                                            </td>
                                            <td className="p-2.5 text-center font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                              {runner.bibNumber || '-'}
                                            </td>
                                            <td className="p-2.5 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                                              {runner.fullName || runner.studentName}
                                            </td>
                                            <td className="p-2.5 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                                              {runner.schoolName}
                                            </td>
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                isClub
                                                  ? 'bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300'
                                                  : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300'
                                              }`}>
                                                {isClub ? 'منتمي للأندية' : 'غير منتمي (مدرسي)'}
                                              </span>
                                            </td>
                                            <td className="p-2.5 text-center whitespace-nowrap">
                                              <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                                                isTeam
                                                  ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                                  : 'bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                              }`}>
                                                {isTeam ? '👥 فريق المؤسسة' : '👤 مشاركة فردية'}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          );
                        })()}

                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* TAB: ATHLETICS (ألعاب القوى) RESULTS */}
            {activePublicTab === 'ATHLETICS' && (
              <div className="space-y-6">

                {/* Athletics Specialty Filter Quick Pills */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-300 px-1">
                    <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <Filter className="w-3.5 h-3.5 text-emerald-500" />
                      <span>نوع المسابقة:</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedAthleticsSpecialty('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                        selectedAthleticsSpecialty === 'ALL'
                          ? (selectedAffiliation === 'CLUB' ? 'bg-amber-400 text-slate-950' : 'bg-emerald-600 text-white')
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      🌟 جميع التخصصات
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAthleticsSpecialty('track')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                        selectedAthleticsSpecialty === 'track'
                          ? (selectedAffiliation === 'CLUB' ? 'bg-amber-400 text-slate-950' : 'bg-emerald-600 text-white')
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      🏃‍♂️ سباقات الجري (المضمار)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedAthleticsSpecialty('field')}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                        selectedAthleticsSpecialty === 'field'
                          ? (selectedAffiliation === 'CLUB' ? 'bg-amber-400 text-slate-950' : 'bg-emerald-600 text-white')
                          : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      🎯 القفز والرمي (الميدان)
                    </button>
                  </div>
                </div>

                {/* Athletics Events Grid */}
                {(() => {
                  const athSportConf = sportsConfig.find(s => s.id === 'athletics');
                  const hasActiveAthTournament = activeTournaments.some(t => t.sportId === 'athletics');
                  const rawItems =
                    athSportConf?.isProgrammed !== false && hasActiveAthTournament
                      ? (Object.values(athleticsResults) as AthleticsCategoryResult[])
                      : [];
                  const items = rawItems.filter((item: AthleticsCategoryResult) => {
                    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
                    if (selectedGender !== 'ALL' && item.gender !== selectedGender) return false;
                    if (selectedAthleticsSpecialty !== 'ALL' && item.specialtyType !== selectedAthleticsSpecialty) return false;
                    if (searchQuery.trim()) {
                      const q = searchQuery.toLowerCase();
                      const matchName = item.specialtyName.toLowerCase().includes(q) || (item.venueName || '').toLowerCase().includes(q);
                      const matchWinner = item.podium?.some(p => p.fullName.toLowerCase().includes(q) || p.schoolName.toLowerCase().includes(q));
                      if (!matchName && !matchWinner) return false;
                    }
                    return true;
                  });

                  if (items.length === 0) {
                    return (
                      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-4 shadow-xs">
                        <Award className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                        <div>
                          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                            لا توجد نتائج مسجلة لألعاب القوى تطابق الفلترة المحددة
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            لم يتم نشر نتائج منافسات ألعاب القوى لهذه الفئة حتى الآن من طرف اللجنة التقنية والمنظمين.
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {items.map((ath: AthleticsCategoryResult, idx: number) => (
                        <div
                          key={`ath-res-${ath.id}-${idx}`}
                          className="bg-white dark:bg-slate-900 border-2 border-emerald-500/20 dark:border-slate-800 rounded-3xl p-4 sm:p-5 shadow-md hover:shadow-lg transition-all space-y-4"
                        >
                          {/* Card Header */}
                          <div className="flex items-start justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                  ath.specialtyType === 'track'
                                    ? 'bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                    : 'bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                }`}>
                                  {ath.specialtyType === 'track' ? '🏃‍♂️ مضمار / جري' : '🎯 ميدان / قفز ورمي'}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                  {ath.category} - {ath.gender === 'Male' ? 'ذكور' : 'إناث'}
                                </span>
                              </div>
                              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                {ath.specialtyName}
                              </h3>
                              {ath.venueName && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{ath.venueName}</span>
                                </p>
                              )}
                            </div>

                            <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-[10px] font-black rounded-xl shrink-0 flex items-center gap-1 shadow-2xs">
                              <span>منصة التتويج</span>
                            </span>
                          </div>

                          {/* Olympic 3D Podium Pedestal Display (2nd Left, 1st Center Elevated, 3rd Right) */}
                          <div className="grid grid-cols-3 gap-1.5 sm:gap-3 items-end pt-1 pb-1">
                            {[
                              { rank: 2 as const, winner: ath.podium?.find(p => p.rank === 2) || ath.podium?.[1] || null },
                              { rank: 1 as const, winner: ath.podium?.find(p => p.rank === 1) || ath.podium?.[0] || null },
                              { rank: 3 as const, winner: ath.podium?.find(p => p.rank === 3) || ath.podium?.[2] || null }
                            ].map(({ rank, winner }) => {
                              const isGold = rank === 1;
                              const isSilver = rank === 2;
                              const isBronze = rank === 3;

                              const medalBg = isGold
                                ? 'from-[#ffea79] via-[#fbc02d] to-[#f59e0b] border-amber-300 text-[#713F12]'
                                : isSilver
                                ? 'from-slate-100 via-slate-200 to-slate-400 border-slate-200 text-slate-900'
                                : 'from-amber-600 via-amber-700 to-amber-900 border-amber-500 text-amber-100';

                              const stepHeight = isGold
                                ? 'h-9 sm:h-16 bg-gradient-to-t from-amber-500 via-yellow-400 to-amber-300 text-slate-950 border-t-2 sm:border-t-4 border-yellow-100 shadow-md'
                                : isSilver
                                ? 'h-6 sm:h-12 bg-gradient-to-t from-slate-400 to-slate-200 dark:from-slate-700 dark:to-slate-500 text-slate-950 dark:text-white border-t-2 sm:border-t-4 border-slate-300 shadow-sm'
                                : 'h-4 sm:h-8 bg-gradient-to-t from-amber-800 to-amber-600 dark:from-amber-950 dark:to-amber-800 text-amber-50 border-t-2 sm:border-t-4 border-amber-400 shadow-sm';

                              return (
                                <div key={rank} className={`flex flex-col items-center justify-end w-full min-w-0 ${isGold ? '-translate-y-1 sm:-translate-y-2 z-10' : 'z-0'}`}>
                                  {/* Medal Badge / Photo */}
                                  <div className="relative -mb-3 sm:-mb-4 z-10">
                                    <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 sm:border-3 overflow-hidden bg-gradient-to-b ${medalBg} shadow-md flex flex-col items-center justify-center relative shrink-0 select-none hover:scale-[1.5] active:scale-[1.5] transition-all duration-300 cursor-pointer hover:z-50`}>
                                      {(() => {
                                        const matchedStud = students.find(s => 
                                          (winner?.studentId && s.id === winner.studentId) ||
                                          (winner?.fullName && s.fullName.trim().toLowerCase() === winner.fullName.trim().toLowerCase())
                                        );
                                        const pPhoto = winner?.photoUrl || matchedStud?.photoUrl;
                                        if (pPhoto) {
                                          return (
                                            <>
                                              <img 
                                                src={pPhoto} 
                                                alt={winner?.fullName || ''} 
                                                className="absolute inset-0 w-full h-full object-cover z-10" 
                                              />
                                            </>
                                          );
                                        }
                                        return (
                                          <div className="w-full h-full bg-slate-100/20" />
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  {/* Podium Athlete Card */}
                                  <div className={`w-full min-w-0 pt-3 sm:pt-5 pb-2 px-1 sm:px-2 rounded-xl border text-center flex flex-col items-center justify-between min-h-[115px] sm:min-h-[145px] shadow-2xs transition-all overflow-hidden ${
                                    isGold
                                      ? 'bg-amber-50/95 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 ring-2 ring-amber-400/20'
                                      : isSilver
                                      ? 'bg-slate-50 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700'
                                      : 'bg-orange-50/80 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800'
                                  }`}>
                                    <div className={`px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9.5px] font-black mb-1 shadow-2xs truncate max-w-full ${
                                      isGold
                                        ? 'bg-amber-400 text-slate-950'
                                        : isSilver
                                        ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white'
                                        : 'bg-amber-700 text-amber-50'
                                    }`}>
                                      {isGold ? '🥇 البطل الأوّل' : isSilver ? '🥈 وصيف البطل' : '🥉 المرتبة الثالثة'}
                                    </div>

                                    {winner ? (
                                      <div className="w-full space-y-0.5 my-0.5">
                                        <h5 className="font-black text-[10.5px] sm:text-xs text-slate-900 dark:text-white truncate leading-snug">
                                          {winner.fullName}
                                        </h5>
                                        <p className="text-[8.5px] sm:text-[10px] text-slate-600 dark:text-slate-400 truncate font-bold">
                                          {winner.schoolName}
                                        </p>
                                        <p className="text-[10px] sm:text-xs font-mono font-black text-emerald-700 dark:text-emerald-400">
                                          {winner.performance}
                                        </p>
                                      </div>
                                    ) : (
                                      <div className="my-auto py-2">
                                        <span className="text-[9px] text-slate-400 font-bold">غير محدد</span>
                                      </div>
                                    )}

                                    {/* Pedestal Base */}
                                    <div className={`w-full rounded-lg flex items-center justify-center font-black font-mono text-xs sm:text-sm mt-1 ${stepHeight}`}>
                                      <span>{isGold ? '1' : isSilver ? '2' : '3'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}

              </div>
            )}

            {/* TAB 2: TEAM MATCHES & STANDINGS */}
            {activePublicTab === 'MATCHES' && (
              <div className="space-y-4">
                {/* Summary Header + Date Toggle */}
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span>{selectedSport !== 'ALL' ? (SPORTS_MAP[selectedSport]?.icon || '⚽') : '🏆'}</span>
                      <span>
                        {selectedSport !== 'ALL'
                          ? `مباريات وبرمجة ${SPORTS_MAP[selectedSport]?.name || ''}`
                          : 'المباريات المبرمجة والنتائج (جميع الرياضات)'}
                      </span>
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                      {publicTabMatches.length} مباراة جاهزة
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-[10px] font-black">
                    <button
                      type="button"
                      onClick={() => setFilterMatchesByDate(false)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        !filterMatchesByDate
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
                      }`}
                    >
                      جميع التواريخ
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterMatchesByDate(true)}
                      className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                        filterMatchesByDate
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/60'
                      }`}
                    >
                      تاريخ {selectedDate}
                    </button>
                  </div>
                </div>

                {/* Group Standings Table (when groups exist for filtered sport) */}
                {publicTabGroupStandings.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <div className="px-4 py-2.5 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-black">🏆 ترتيب المجموعات والنقط</span>
                      <span className="text-[10px] font-bold text-emerald-300">فوز: 3ن • تعادل: 1ن • هزيمة: 0ن</span>
                    </div>
                    <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {publicTabGroupStandings.map((grp) => (
                        <div key={grp.groupName} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                          <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px]">
                            <span className="font-black text-slate-900 dark:text-white">{grp.groupName}</span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{grp.systemLabel}</span>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-right">
                              <thead className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-black">
                                <tr>
                                  <th className="py-1.5 px-2 text-center w-7">#</th>
                                  <th className="py-1.5 px-2">المؤسسة</th>
                                  <th className="py-1.5 px-1 text-center">ل</th>
                                  <th className="py-1.5 px-1 text-center">ف</th>
                                  <th className="py-1.5 px-1 text-center">ت</th>
                                  <th className="py-1.5 px-1 text-center">هـ</th>
                                  <th className="py-1.5 px-2 text-center text-emerald-700 dark:text-emerald-400">ن</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {grp.rows.map((row) => (
                                  <tr key={row.teamId} className={row.rank === 1 && grp.completedMatches > 0 ? 'bg-emerald-50/50 dark:bg-emerald-950/30' : ''}>
                                    <td className="py-1.5 px-2 text-center font-black">{row.rank}</td>
                                    <td className="py-1.5 px-2 font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">{row.teamName}</td>
                                    <td className="py-1.5 px-1 text-center font-mono">{row.played}</td>
                                    <td className="py-1.5 px-1 text-center font-mono text-emerald-700 dark:text-emerald-400 font-bold">{row.won}</td>
                                    <td className="py-1.5 px-1 text-center font-mono text-amber-600">{row.drawn}</td>
                                    <td className="py-1.5 px-1 text-center font-mono text-rose-600">{row.lost}</td>
                                    <td className="py-1.5 px-2 text-center font-mono font-black text-emerald-700 dark:text-emerald-400">{row.points}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {publicTabMatches.length === 0 ? (
                  <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center space-y-3 shadow-xs transition-colors">
                    <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto" />
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {filterMatchesByDate
                        ? `لا توجد مباريات مسجلة في تاريخ ${selectedDate} تطابق معايير الفلترة المحددة`
                        : 'لا توجد مباريات مسجلة حالياً تطابق معايير الفلترة المحددة'}
                    </p>
                    {filterMatchesByDate && (
                      <button
                        type="button"
                        onClick={() => setFilterMatchesByDate(false)}
                        className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl transition-colors cursor-pointer"
                      >
                        عرض مباريات جميع التواريخ
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {publicTabMatches.map((m, idx) => {
                      const t1Display = formatTeamDisplayName(
                        m.team1Id,
                        m.team1Name || m.team1SchoolName,
                        schools,
                        m.team1Placeholder,
                        m.team1SourceMatchNumber
                      );
                      const t2Display = formatTeamDisplayName(
                        m.team2Id,
                        m.team2Name || m.team2SchoolName,
                        schools,
                        m.team2Placeholder,
                        m.team2SourceMatchNumber
                      );
                      const isT1Placeholder = isPlaceholderTeamId(m.team1Id) || /الفائز\s*من\s*المباراة/.test(t1Display);
                      const isT2Placeholder = isPlaceholderTeamId(m.team2Id) || /الفائز\s*من\s*المباراة/.test(t2Display);
                      const groupLabel = extractMatchGroupLabel(m);
                      const matchNumber = m.drawMatchNumber ?? (idx + 1);
                      const statusLower = (m.status || '').toLowerCase();
                      const isCompleted = statusLower === 'completed';
                      const isOngoing = statusLower === 'ongoing';
                      const score1 = m.score1 ?? m.team1Score ?? 0;
                      const score2 = m.score2 ?? m.team2Score ?? 0;
                      const hasScore = isCompleted || isOngoing || ((m.score1 !== undefined || m.team1Score !== undefined) && statusLower !== 'scheduled');
                      const isT1Winner = isCompleted && (
                        m.winnerId === m.team1Id ||
                        score1 > score2 ||
                        (score1 === score2 && m.penalty1 !== undefined && m.penalty2 !== undefined && m.penalty1 > m.penalty2)
                      );
                      const isT2Winner = isCompleted && (
                        m.winnerId === m.team2Id ||
                        score2 > score1 ||
                        (score1 === score2 && m.penalty1 !== undefined && m.penalty2 !== undefined && m.penalty2 > m.penalty1)
                      );
                      const sportInfo = SPORTS_MAP[m.sportId];
                      const genderLabel = m.gender === 'Female' ? 'إناث' : m.gender === 'Male' ? 'ذكور' : '';
                      const categoryLabel = [m.ageCategory || m.category, genderLabel].filter(Boolean).join(' • ') || 'عامة';
                      const refInfo = resolveMatchRefereesInfo(m, referees, usersDirectory);
                      const hasCategorizedRefs = refInfo.tableRefs.length > 0 || refInfo.fieldRefs.length > 0;

                      return (
                        <div key={m.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md space-y-3 transition-all">
                          {/* Top Row: Sport, Category & Match Status */}
                          <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black truncate">
                              <span>{sportInfo?.icon || '⚽'}</span>
                              <span>{m.sportName || sportInfo?.name || 'مباراة رياضية'}</span>
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                              m.gender === 'Female'
                                ? 'bg-pink-100 text-pink-800 border border-pink-200 dark:bg-pink-950/80 dark:text-pink-300 dark:border-pink-800'
                                : m.gender === 'Male'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200 dark:bg-blue-950/80 dark:text-blue-300 dark:border-blue-800'
                                : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-300'
                            }`}>
                              {categoryLabel}
                            </span>
                          </div>

                          {/* Match Number, Stage & Group Badges */}
                          <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-black">
                            <span className="px-2.5 py-0.5 bg-blue-100 dark:bg-blue-950/80 text-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-800 rounded-lg">
                              المباراة رقم {matchNumber}
                            </span>
                            <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg font-bold">
                              الدور: {m.stage?.trim() || 'دور المجموعات'}
                            </span>
                            {groupLabel && (
                              <span className="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-950/80 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800 rounded-lg">
                                {groupLabel.startsWith('المجموعة') ? groupLabel : `المجموعة: ${groupLabel}`}
                              </span>
                            )}
                          </div>

                          {/* Teams Vertical Layout: Team 1 & Team 2 */}
                          <div className="space-y-2 py-0.5">
                            {/* Team 1 Row */}
                            <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                              isT1Winner
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                                : isT1Placeholder
                                ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                            }`}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-6 h-6 rounded-lg text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs ${
                                  isT1Placeholder ? 'bg-indigo-500' : 'bg-emerald-600'
                                }`}>
                                  1
                                </span>
                                <div className="min-w-0">
                                  <p className={`text-xs font-black truncate ${
                                    isT1Placeholder ? 'text-indigo-800 dark:text-indigo-300' : 'text-slate-900 dark:text-white'
                                  }`} title={t1Display}>
                                    {t1Display}
                                  </p>
                                </div>
                              </div>

                              <div className="font-mono font-black text-sm sm:text-base px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0 shadow-2xs text-slate-900 dark:text-white">
                                {hasScore ? score1 : '-'}
                              </div>
                            </div>

                            {/* Team 2 Row */}
                            <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                              isT2Winner
                                ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                                : isT2Placeholder
                                ? 'bg-indigo-50/60 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                            }`}>
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className={`w-6 h-6 rounded-lg text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs ${
                                  isT2Placeholder ? 'bg-indigo-500' : 'bg-indigo-600'
                                }`}>
                                  2
                                </span>
                                <div className="min-w-0">
                                  <p className={`text-xs font-black truncate ${
                                    isT2Placeholder ? 'text-indigo-800 dark:text-indigo-300' : 'text-slate-900 dark:text-white'
                                  }`} title={t2Display}>
                                    {t2Display}
                                  </p>
                                </div>
                              </div>

                              <div className="font-mono font-black text-sm sm:text-base px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0 shadow-2xs text-slate-900 dark:text-white">
                                {hasScore ? score2 : '-'}
                              </div>
                            </div>

                            {isCompleted && score1 === score2 && m.penalty1 !== undefined && m.penalty2 !== undefined && (
                              <div className="text-center text-[10px] font-black text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg py-1">
                                ضربات الجزاء: ({m.penalty1} - {m.penalty2})
                              </div>
                            )}
                          </div>

                          {/* Referees Section (طاقم التحكيم) */}
                          {refInfo.hasReferees ? (
                            <div className="bg-slate-50/90 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/70 rounded-xl px-3 py-2 space-y-1.5">
                              {hasCategorizedRefs ? (
                                <>
                                  {refInfo.fieldRefs.length > 0 && (
                                    <div className="flex items-start gap-1.5 text-[10px] leading-relaxed">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black shrink-0">
                                        حكام الساحة
                                      </span>
                                      <span className="font-bold text-slate-700 dark:text-slate-200">
                                        {refInfo.fieldRefs.map((name, i) => `${getOrdinalRefLabel(i)}: ${name}`).join(' • ')}
                                      </span>
                                    </div>
                                  )}
                                  {refInfo.tableRefs.length > 0 && (
                                    <div className="flex items-start gap-1.5 text-[10px] leading-relaxed">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/80 text-sky-800 dark:text-sky-300 font-black shrink-0">
                                        حكام الطاولة
                                      </span>
                                      <span className="font-bold text-slate-700 dark:text-slate-200">
                                        {refInfo.tableRefs.map((name, i) => `${getOrdinalRefLabel(i)}: ${name}`).join(' • ')}
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex items-start gap-1.5 text-[10px] leading-relaxed">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-300 font-black shrink-0">
                                    الحكام
                                  </span>
                                  <span className="font-bold text-slate-700 dark:text-slate-200">
                                    {refInfo.allRefs.join(' • ')}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700/70 rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-[10px]">
                              <span className="font-black text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3 text-slate-400 shrink-0" />
                                <span>الحكام:</span>
                              </span>
                              <span className="font-bold text-slate-400 dark:text-slate-500">لم يحدد طاقم التحكيم بعد</span>
                            </div>
                          )}

                          {/* Footer: Venue, Date/Time & Status */}
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">{m.venueName || 'الملعب الرياضي'}</span>
                              </span>
                              {m.date && (
                                <span className="flex items-center gap-1 font-mono font-bold text-slate-600 dark:text-slate-300">
                                  <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span>{formatMatchDate(m.date)}</span>
                                  {m.startTime && <span>• {m.startTime}</span>}
                                </span>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded font-bold shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                                : isOngoing
                                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 animate-pulse'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                            }`}>
                              {isCompleted ? 'مباراة منتهية ✅' : isOngoing ? 'جارية الآن 🔴' : 'مباراة قادمة ⏳'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
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
            className={`space-y-5 transition-all duration-300 order-3 lg:order-3 lg:row-start-1 lg:col-span-3 lg:col-start-10 ${
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

      {/* ABOUT APPLICATION MODAL */}
      {isAboutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 relative overflow-hidden text-right">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500" />
            
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  حول المنظومة الرقمية 2026
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-bold">
              <p className="text-sm font-black text-emerald-800 dark:text-emerald-400">
                المنظومة الرقمية لتتبع نتائج البطولات المدرسية الاقليمية 2026
              </p>
              <p className="text-slate-500 dark:text-slate-400 font-semibold leading-relaxed">
                تم تطوير هذه المنظومة بالكامل باللغة العربية لدعم وتدبير الأنشطة والبطولات المدرسية المغربية بالمديرية الإقليمية.
              </p>
              <p className="text-slate-600 dark:text-slate-300 font-medium">
                تتيح المنصة الرقمية الموحدة تسجيل المشاركين والفرق، طباعة الصدريات الذكية مع الباركود والماسح الضوئي الرقمي، إدارة وتعيين الملاعب والحكام المعتمدين، ونشر التحديثات الفورية والنتائج الرسمية لجميع الرياضات المدرسية (ألعاب جماعية، عدو ريفي، ألعاب قوى، كرة طاولة...) بدقة وسرعة متناهية.
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 text-[11px] space-y-1 text-slate-500 dark:text-slate-400">
                <p>• الإصدار: 1.3.4 (نسخة مستقرة)</p>
                <p>• الفئة المستهدفة: أطر التربية البدنية، اللجان التقنية والجمهور الكريم</p>
                <p>• المنصة متكاملة بنظام إشعارات الواتساب الذكية والعمل أوفلاين</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/20 text-center active:scale-98 transition-all"
              >
                حسناً، فهمت
              </button>
              <p className="text-[10px] text-center text-slate-400 dark:text-slate-500">
                كل الحقوق محفوظة &copy; 2026
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SPORTS INTRO ANIMATION */}
      {isIntroOpen && (
        <SportsIntroAnimation
          isOpen={isIntroOpen}
          onComplete={() => {
            setIsIntroOpen(false);
          }}
        />
      )}

      {/* CROSS COUNTRY PODIUM MODAL */}
      {isCrossCountryPodiumOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-y-auto p-4 sm:p-6 relative border border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200 dark:border-slate-800">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span>منصة تتويج العدو الريفي المدرسي</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCrossCountryPodiumOpen(false)}
                className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CrossCountryPodiumView
              results={crossCountryResults}
              students={students}
              selectedAffiliation="ALL"
            />
          </div>
        </div>
      )}

      {/* FOOTER */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-6 text-center text-xs text-slate-500 dark:text-slate-400 space-y-1 transition-colors">
        <p className="font-bold text-slate-700 dark:text-slate-300">
          المنظومة الرقمية لتتبع نتائج البطولات المدرسية الاقليمية 2026
        </p>
        <p className="text-[11px] font-semibold">
          كل الحقوق محفوظة &copy; 2026
        </p>
      </footer>

    </div>
  );
};
