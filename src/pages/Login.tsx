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
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { Role, Directorate, School, Tournament, Match, Student, CrossCountryCategoryResult, AthleticsCategoryResult, AthleticsWinner } from '../types';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason, getCategoryYearsLabel } from '../lib/dataService';
import { calculateTeamRankings, resolveRunnerParticipationType } from '../lib/crossCountryConfig';
import { AppLogo } from '../components/AppLogo';
import { DemoDataModal } from '../components/DemoDataModal';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

export const Login: React.FC = () => {
  const { currentUser, userProfile, loading, updateProfileState, loginAsDemo } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();

  // Mode: 'PUBLIC' (default), or 'REGISTER_TEACHER' if google auth triggers new teacher setup
  const [loginMode, setLoginMode] = useState<'PUBLIC' | 'REGISTER_TEACHER'>('PUBLIC');
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const loginPanelRef = useRef<HTMLDivElement>(null);

  // Data states for Public View
  const [activeDirectorate, setActiveDirectorate] = useState<Directorate | null>(null);
  const [isDemoDataModalOpen, setIsDemoDataModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [crossCountryResults, setCrossCountryResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [athleticsResults, setAthleticsResults] = useState<Record<string, AthleticsCategoryResult>>({});
  const [loadingData, setLoadingData] = useState(true);

  // Public Filters
  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [selectedScope, setSelectedScope] = useState<'ALL' | 'PROVINCIAL' | 'REGIONAL' | 'NATIONAL'>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [selectedAffiliation, setSelectedAffiliation] = useState<'ALL' | 'CLUB' | 'NON_CLUB'>('NON_CLUB');
  const [selectedAthleticsSpecialty, setSelectedAthleticsSpecialty] = useState<'ALL' | 'track' | 'field'>('ALL');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePublicTab, setActivePublicTab] = useState<'CC_PODIUM' | 'ATHLETICS' | 'MATCHES' | 'TOURNAMENTS'>('CC_PODIUM');
  
  // Refs for horizontal scrolling containers
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const ccCategoryScrollRef = useRef<HTMLDivElement>(null);
  const athCategoryScrollRef = useRef<HTMLDivElement>(null);
  const genericCategoryScrollRef = useRef<HTMLDivElement>(null);

  const scrollContainer = (ref: React.RefObject<HTMLDivElement>, direction: 'left' | 'right') => {
    if (ref.current) {
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
      if (targetDirId && activeDir.id !== targetDirId) {
        const dirs = await DataService.getDirectorates();
        const found = dirs.find(d => d.id === targetDirId);
        if (found) setActiveDirectorate(found);
      } else {
        setActiveDirectorate(activeDir);
      }

      const [dirs, schs, tours, mtchs, stds, ccRes, athRes] = await Promise.all([
        DataService.getDirectorates(),
        DataService.getSchools(effectiveDirId),
        DataService.getTournaments(effectiveDirId),
        DataService.getMatches(effectiveDirId),
        DataService.getStudents(effectiveDirId),
        DataService.getCrossCountryResults(effectiveDirId),
        DataService.getAthleticsResults(effectiveDirId)
      ]);

      setDirectorates(dirs || []);
      setSchools(schs || []);
      setTournaments(tours || []);

      // Inject Demo Matches only if directorate is taourirt and none exist
      let finalMatches = mtchs || [];
      if (finalMatches.length === 0 && effectiveDirId === 'taourirt') {
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

      // Inject Demo CC Results only if directorate is taourirt and results are empty
      let finalCcRes = ccRes || {};
      if (Object.keys(finalCcRes).length === 0 && effectiveDirId === 'taourirt') {
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

      // Inject Demo Athletics Results only if directorate is taourirt and results are empty
      let finalAthRes = athRes || {};
      if (Object.keys(finalAthRes).length === 0 && effectiveDirId === 'taourirt') {
        finalAthRes = {
          'u15_male_100m': {
            id: 'u15_male_100m',
            category: 'U15',
            gender: 'Male',
            specialtyName: 'سباق 100 متر (ذكور)',
            specialtyType: 'track',
            venueName: 'الملعب البلدي تاوريرت',
            status: 'completed',
            podium: [
              { rank: 1, fullName: 'ياسين الفيلالي', schoolName: 'إعدادية ابن سينا', performance: '11.85 ث', bibNumber: '112', affiliation: 'non_club' },
              { rank: 2, fullName: 'طارق الزياني', schoolName: 'إعدادية سيدي لحسن', performance: '12.10 ث', bibNumber: '114', affiliation: 'non_club' },
              { rank: 3, fullName: 'حمزة المراكشي', schoolName: 'ثانوية علال الفاسي التأهيلية', performance: '12.35 ث', bibNumber: '118', affiliation: 'club_affiliated' }
            ]
          },
          'u15_female_longjump': {
            id: 'u15_female_longjump',
            category: 'U15',
            gender: 'Female',
            specialtyName: 'القفز الطولي (إناث)',
            specialtyType: 'field',
            venueName: 'الملعب البلدي تاوريرت',
            status: 'completed',
            podium: [
              { rank: 1, fullName: 'إيمان المنصوري', schoolName: 'إعدادية ابن سينا', performance: '4.85 م', bibNumber: '205', affiliation: 'non_club' },
              { rank: 2, fullName: 'زينب الشاوي', schoolName: 'إعدادية سيدي لحسن', performance: '4.62 م', bibNumber: '208', affiliation: 'non_club' },
              { rank: 3, fullName: 'أسماء البصري', schoolName: 'مجموعة مدارس دبدو الابتدائية', performance: '4.40 م', bibNumber: '211', affiliation: 'non_club' }
            ]
          },
          'u18_male_800m': {
            id: 'u18_male_800m',
            category: 'U18',
            gender: 'Male',
            specialtyName: 'سباق 800 متر (فتيان)',
            specialtyType: 'track',
            venueName: 'الملعب البلدي تاوريرت',
            status: 'completed',
            podium: [
              { rank: 1, fullName: 'أمين العلمي', schoolName: 'ثانوية الفتح التأهيلية', performance: '01:58.4', bibNumber: '304', affiliation: 'club_affiliated' },
              { rank: 2, fullName: 'وليد السوسي', schoolName: 'ثانوية الزيتون التأهيلية', performance: '02:01.2', bibNumber: '309', affiliation: 'non_club' },
              { rank: 3, fullName: 'مهدي الحساني', schoolName: 'ثانوية علال الفاسي التأهيلية', performance: '02:03.8', bibNumber: '315', affiliation: 'non_club' }
            ]
          },
          'u18_female_shotput': {
            id: 'u18_female_shotput',
            category: 'U18',
            gender: 'Female',
            specialtyName: 'دفع الجلة 3 كغم (فتيات)',
            specialtyType: 'field',
            venueName: 'الملعب البلدي تاوريرت',
            status: 'completed',
            podium: [
              { rank: 1, fullName: 'خديجة العمراني', schoolName: 'ثانوية الفتح التأهيلية', performance: '11.45 م', bibNumber: '401', affiliation: 'non_club' },
              { rank: 2, fullName: 'سناء المتوكل', schoolName: 'ثانوية الزيتون التأهيلية', performance: '10.80 م', bibNumber: '406', affiliation: 'non_club' },
              { rank: 3, fullName: 'دعاء الصابر', schoolName: 'ثانوية علال الفاسي التأهيلية', performance: '10.15 م', bibNumber: '412', affiliation: 'club_affiliated' }
            ]
          }
        } as any;
      }
      setAthleticsResults(finalAthRes);

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
    loadAllData();

    const unsubSchools = DataService.subscribeToSchools((s) => setSchools(s));
    const unsubTournaments = DataService.subscribeToTournaments((t) => setTournaments(t));
    const unsubMatches = DataService.subscribeToMatches((m) => setMatches(m));
    const unsubCcResults = DataService.subscribeCrossCountryResults((r) => setCrossCountryResults(r as Record<string, CrossCountryCategoryResult>));
    const unsubAthletics = DataService.subscribeAthleticsResults((ar) => setAthleticsResults(ar));

    return () => {
      unsubSchools();
      unsubTournaments();
      unsubMatches();
      unsubCcResults();
      unsubAthletics();
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
      if (selectedCategory !== 'ALL' && m.category && !m.category.toUpperCase().includes(selectedCategory.toUpperCase())) return false;
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

  // Cross Country Results Data (Strictly Separated, Deduplicated, & Recalculated by Affiliation)
  const crossCountryList = useMemo(() => {
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

      // 1. Process Non-Club Class (Only if selectedAffiliation is not CLUB)
      if (rankedNonClub.length > 0 && selectedAffiliation !== 'CLUB') {
        const teamRankings = calculateTeamRankings(rankedNonClub, students);
        list.push({
          key: `${canonicalKey}_non_club`,
          categoryKey: canonicalKey,
          categoryName: `${catName} – صنف غير المنتمين (مدرسي) 🏫`,
          runners: rankedNonClub,
          teamRankings
        });
      }

      // 2. Process Club-Affiliated Class (Only if selectedAffiliation is not NON_CLUB)
      if (rankedClub.length > 0 && selectedAffiliation !== 'NON_CLUB') {
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
  }, [crossCountryResults, students, selectedAffiliation, selectedCategory, selectedGender, searchQuery]);

  // Dynamic active tab categories with gender combo for public filters
  const activeTabCategories = useMemo(() => {
    if (activePublicTab === 'CC_PODIUM') {
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
        
        const genderLabel = gender === 'Male' ? 'ذكور' : gender === 'Female' ? 'إناث' : 'مختلط';
        const catLabel = cat === 'U12' ? 'براعم' : cat === 'U15' ? 'صغار' : cat === 'U18' ? 'فتيان' : 'شبان';
        
        list.push({
          id: key,
          cat,
          gender: gender as any,
          label: `${catLabel} ${genderLabel} (${cat}) 🏃`
        });
      });
      
      return list;
    }
    
    if (activePublicTab === 'ATHLETICS') {
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
        
        const genderLabel = gender === 'Male' ? 'ذكور' : gender === 'Female' ? 'إناث' : 'مختلط';
        const catLabel = cat === 'U12' ? 'براعم' : cat === 'U15' ? 'صغار' : cat === 'U18' ? 'فتيان' : 'شبان';
        
        list.push({
          id: key,
          cat,
          gender: gender as any,
          label: `${catLabel} ${genderLabel} (${cat}) 🏅`
        });
      });
      
      return list;
    }
    
    if (activePublicTab === 'MATCHES') {
      const teamSportsTourns = tournaments.filter(t => {
        const isTeamSport = t.sportId !== 'cross_country' && t.sportId !== 'athletics';
        if (!isTeamSport) return false;
        if (selectedSport !== 'ALL' && t.sportId !== selectedSport) return false;
        return true;
      });
      
      const uniqueCats = Array.from(new Set<string>(teamSportsTourns.map(t => `${t.ageCategory}_${t.gender}`)));
      
      const list = [
        { id: 'ALL_ALL', cat: 'ALL', gender: 'ALL', label: 'جميع الفئات المبرمجة 🌟' }
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
        
        const genderLabel = gender === 'Male' ? 'ذكور' : gender === 'Female' ? 'إناث' : 'مختلط';
        const catLabel = cat === 'U12' ? 'براعم' : cat === 'U15' ? 'صغار' : cat === 'U18' ? 'فتيان' : 'شبان';
        
        const sportIcon = selectedSport !== 'ALL' ? (SPORTS_MAP[selectedSport]?.icon || '👥') : '👥';

        list.push({
          id: key,
          cat,
          gender: gender as any,
          label: `${catLabel} ${genderLabel} (${cat}) ${sportIcon}`
        });
      });
      
      return list;
    }
    
    return [
      { id: 'ALL_ALL', cat: 'ALL', gender: 'ALL', label: 'جميع الفئات 🌟' }
    ];
  }, [activePublicTab, tournaments, crossCountryResults, athleticsResults, selectedSport]);

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
        
        {/* TOP HEADER BAR */}
        <header className="border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 transition-colors">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            
            {/* Logo & Platform Name */}
            <div className="flex items-center gap-3 min-w-0">
              <AppLogo size={42} showText={false} className="shrink-0" />
              <div className="min-w-0">
                <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 dark:text-white tracking-tight truncate">
                  نتائج البطولات الإقليمية للرياضة المدرسية
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <select
                    value={activeDirectorate?.id || 'taourirt'}
                    onChange={(e) => handleDirectorateChange(e.target.value)}
                    className="text-[11px] sm:text-xs font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/70 border border-emerald-300/80 dark:border-emerald-700 rounded-lg px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer max-w-[200px] sm:max-w-xs truncate shadow-3xs"
                    title="تغيير واختيار المديرية الإقليمية"
                  >
                    {directorates.map(dir => (
                      <option key={dir.id} value={dir.id} className="text-slate-900 bg-white">
                        {dir.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Controls Right */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              
              {/* Desktop Only Buttons */}
              <div className="hidden lg:flex items-center gap-2">
                {/* Dark Mode Toggle (Desktop) */}
                <button
                  type="button"
                  onClick={toggleDarkMode}
                  className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold transition-all cursor-pointer shadow-2xs"
                  title={isDarkMode ? 'التحويل للوضع النهار' : 'التحويل للوضع الليلي'}
                >
                  {isDarkMode ? (
                    <Sun className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
                  )}
                </button>

                {/* Generate Demo Data Button */}
                <button
                  type="button"
                  onClick={() => setIsDemoDataModalOpen(true)}
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border border-amber-400/40 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-200 animate-pulse" />
                  <span>توليد بيانات افتراضية</span>
                </button>

                {/* Teacher Login Button */}
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
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm ${
                    showLoginPanel 
                      ? 'bg-emerald-700 text-white ring-2 ring-emerald-400' 
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <LogIn className="w-4 h-4" />
                  <span>دخول الأطر والمسيرين</span>
                </button>
              </div>

              {/* Mobile Menu Dropdown Toggle */}
              <div className="relative lg:hidden">
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className={`p-2 rounded-full transition-all cursor-pointer flex items-center justify-center border ${
                    isMobileMenuOpen 
                      ? 'bg-emerald-600 text-white border-emerald-500 shadow-md' 
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
                            setIsDemoDataModalOpen(true);
                            setIsMobileMenuOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-3 text-right text-xs font-black text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 rounded-xl transition-colors"
                        >
                          <Sparkles className="w-4 h-4 animate-pulse" />
                          <span>توليد بيانات تجريبية ومباريات ⚡</span>
                        </button>

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

        {/* SPORTS BAR (شريط الرياضات) */}
        <section className="bg-white/50 dark:bg-slate-900/50 py-1.5 px-3 sm:px-6 shadow-xs select-none transition-all">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
            
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="hidden sm:flex items-center gap-1 text-xs font-black text-amber-600 dark:text-amber-400 shrink-0 border-l border-slate-200 dark:border-slate-800 pl-3">
                <Trophy className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>شريط الرياضات:</span>
              </div>

              <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-1.5 py-0.5">
                {/* All Sports Option */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSport('ALL');
                    setActivePublicTab('MATCHES');
                    setSelectedCategory('ALL');
                  }}
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
                      onClick={() => {
                        setSelectedSport(sportKey);
                        if (sportKey === 'cross_country') {
                          setActivePublicTab('CC_PODIUM');
                        } else if (sportKey === 'athletics') {
                          setActivePublicTab('ATHLETICS');
                        } else {
                          setActivePublicTab('MATCHES');
                        }
                        setSelectedCategory('ALL');
                      }}
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

            {/* زر دائم وثابت لإظهار وإخفاء الشريط اليومي كاملاً بنقرة واحدة */}
            <button
              type="button"
              onClick={toggleMarqueeVisibility}
              className={`shrink-0 px-2.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                isMarqueeVisible
                  ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-md shadow-emerald-600/25 animate-pulse'
              }`}
              title={isMarqueeVisible ? "إخفاء الشريط اليومي للأخبار بالكامل" : "إظهار الشريط اليومي للأخبار بالكامل"}
            >
              <Megaphone className={`w-3.5 h-3.5 shrink-0 ${isMarqueeVisible ? 'text-amber-500' : 'text-amber-300'}`} />
              <span className="hidden xs:inline">
                {isMarqueeVisible ? 'إخفاء الشريط' : 'إظهار الشريط اليومي'}
              </span>
              {isMarqueeVisible ? (
                <EyeOff className="w-3.5 h-3.5 opacity-60 shrink-0" />
              ) : (
                <Eye className="w-3.5 h-3.5 opacity-90 shrink-0" />
              )}
            </button>

          </div>
        </section>

        {/* الشريـط اليومـي تحـت الرياضـات (DAILY MARQUEE TICKER BAR) - يختفي بالكامل عند الإخفاء */}
        {isMarqueeVisible && (
          <section className="bg-gradient-to-r from-emerald-50/80 via-slate-50/80 to-teal-50/80 dark:from-emerald-950/80 dark:via-slate-900/80 dark:to-teal-950/80 text-slate-800 dark:text-white border-b border-emerald-100 dark:border-emerald-800/60 py-1 px-3 sm:px-6 shadow-xs overflow-hidden select-none transition-all">
            <div className="max-w-4xl mx-auto flex items-center gap-3">
              
              {/* Badge Tag */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black shrink-0 shadow-sm">
                <Megaphone className="w-3 h-3 text-amber-300 shrink-0" />
                <span className="whitespace-nowrap">عاجل</span>
              </div>

              {/* Animated Marquee Stream */}
              <div 
                className="flex-1 overflow-hidden relative min-h-5 flex items-center"
                onMouseEnter={() => setIsMarqueePaused(true)}
                onMouseLeave={() => setIsMarqueePaused(false)}
              >
                <div className={`flex items-center gap-8 text-[10px] sm:text-xs font-bold text-emerald-900 dark:text-emerald-100 ${isMarqueePaused ? '' : 'animate-marquee-rtl'}`}>
                  {marqueeNews.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 whitespace-nowrap shrink-0">
                      <span className="text-amber-600 dark:text-amber-400 font-extrabold">{item.icon}</span>
                      <span className="text-slate-800 dark:text-slate-100">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </section>
        )}

        {/* شريط التاريخ (DATE NAVIGATION BAR) */}
        <section className="bg-white/80 dark:bg-slate-900/80 border-b border-slate-200 dark:border-slate-800 shadow-xs transition-colors overflow-hidden">
          <div className="max-w-4xl mx-auto flex items-stretch h-9 sm:h-10">
            
            {/* Right Arrow (Past / أقدم) */}
            <button 
              type="button"
              onClick={handleDateBarPrev}
              className="px-3 border-l border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center shrink-0 cursor-pointer group"
            >
              <ChevronRight className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" />
            </button>

            {/* Dates list container */}
            <div ref={dateBarScrollRef} className="flex-1 flex overflow-x-auto no-scrollbar scroll-smooth">
              {dateBarItems.map((item) => {
                const isSelected = selectedDate === item.date;
                const isToday = item.isToday;
                return (
                  <button
                    key={item.date}
                    id={isToday ? "today-date-btn" : undefined}
                    type="button"
                    onClick={() => setSelectedDate(item.date)}
                    className={`flex-1 min-w-[110px] sm:min-w-[125px] px-2 flex flex-col items-center justify-center border-l border-slate-100 dark:border-slate-800 transition-all cursor-pointer relative ${
                      isToday
                        ? 'bg-yellow-400 dark:bg-yellow-500 text-slate-950 font-black shadow-inner'
                        : isSelected 
                        ? 'bg-emerald-600 dark:bg-emerald-500 text-white font-black' 
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold'
                    }`}
                  >
                    <span className="text-[10px] sm:text-[11px] whitespace-nowrap">{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Left Arrow (Future / أحدث) */}
            <button 
              type="button"
              onClick={handleDateBarNext}
              className="px-3 border-r border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors flex items-center justify-center shrink-0 cursor-pointer group"
            >
              <ChevronLeft className="w-3.5 h-3.5 group-hover:scale-125 transition-transform" />
            </button>

          </div>
        </section>
      </div>

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
            
            {/* FILTER BAR & SEARCH */}
            <div id="public-results-section" className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm space-y-4 transition-colors scroll-mt-24">
              
              {/* PART 1: AFFILIATION (Club vs Non-club) */}
              <div className="flex items-center gap-2">
                {[
                  { id: 'CLUB', label: 'منتمين للأندية', color: 'bg-amber-500 border-amber-400 text-slate-950' },
                  { id: 'NON_CLUB', label: 'مدرسي (غير منتمين)', color: 'bg-emerald-700 border-emerald-500 text-white' }
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
                  const rawItems = Object.values(athleticsResults) as AthleticsCategoryResult[];
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
                            يمكنك توليد بيانات تجريبية لمعاينة عرض مسابقات القفز والرمي وسباقات السرعة
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDemoDataModalOpen(true)}
                          className="px-4 py-2 bg-gradient-to-r from-amber-500 to-teal-600 text-white rounded-xl text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer inline-flex items-center gap-2"
                        >
                          <Sparkles className="w-4 h-4 text-amber-200" />
                          <span>⚡ توليد نتائج ألعاب القوى افتراضياً</span>
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {items.map((ath: AthleticsCategoryResult) => (
                        <div
                          key={ath.id}
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
                      <div key={m.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm hover:shadow-md space-y-3 transition-all">
                        
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                          <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black">
                            <span>{SPORTS_MAP[m.sportId]?.icon || '⚽'}</span>
                            <span>{m.sportName || 'مباراة رياضية'}</span>
                          </span>
                          <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[10px] font-bold text-slate-700 dark:text-slate-300">
                            {m.category || 'عامة'}
                          </span>
                        </div>

                        {/* Teams Vertical Layout: School under School with score next to each school */}
                        <div className="space-y-2 py-1">
                          {/* School 1 Row */}
                          <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                            m.status === 'Completed' && (m.team1Score ?? 0) > (m.team2Score ?? 0)
                              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                          }`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs">
                                1
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                  {m.team1SchoolName || m.team1Name}
                                </p>
                                {m.team1SchoolName && m.team1Name !== m.team1SchoolName && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {m.team1Name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="font-mono font-black text-sm sm:text-base px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0 shadow-2xs text-slate-900 dark:text-white">
                              {m.status === 'Completed' ? (m.team1Score ?? 0) : '-'}
                            </div>
                          </div>

                          {/* School 2 Row */}
                          <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
                            m.status === 'Completed' && (m.team2Score ?? 0) > (m.team1Score ?? 0)
                              ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 shadow-2xs'
                              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                          }`}>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-2xs">
                                2
                              </span>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                  {m.team2SchoolName || m.team2Name}
                                </p>
                                {m.team2SchoolName && m.team2Name !== m.team2SchoolName && (
                                  <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {m.team2Name}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="font-mono font-black text-sm sm:text-base px-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shrink-0 shadow-2xs text-slate-900 dark:text-white">
                              {m.status === 'Completed' ? (m.team2Score ?? 0) : '-'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{m.venueName || 'الملعب الرياضي'}</span>
                          </span>
                          <span className={`px-2 py-0.5 rounded font-bold ${
                            m.status === 'Completed'
                              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                          }`}>
                            {m.status === 'Completed' ? 'مباراة منتهية ✅' : 'مباراة قادمة ⏳'}
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

      {/* DEMO DATA MODAL */}
      <DemoDataModal
        isOpen={isDemoDataModalOpen}
        onClose={() => setIsDemoDataModalOpen(false)}
        activeDirectorateId={activeDirectorate?.id || 'taourirt'}
        activeDirectorateName={activeDirectorate?.name || 'تاوريرت'}
        activeSeason="2026/2027"
        onDataLoaded={loadAllData}
      />

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
