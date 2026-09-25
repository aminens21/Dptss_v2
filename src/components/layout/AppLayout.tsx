import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { auth } from '../../firebase/config';
import { signOut } from 'firebase/auth';
import {
  LayoutDashboard,
  Trophy,
  Users,
  CalendarDays,
  LogOut,
  Menu,
  X,
  MapPin,
  Bell,
  Plus,
  Shield,
  FileSpreadsheet,
  Megaphone,
  Check,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  User as UserIcon,
  Edit3,
  Settings,
  ChevronDown,
  BarChart3,
  ChevronRight,
  ChevronLeft,
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  KeyRound,
  AlertTriangle,
  RotateCw,
  RefreshCw,
  Wifi,
  Award,
  Wrench,
  Boxes
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { TeacherProfileModal } from '../TeacherProfileModal';
import { DataService } from '../../lib/dataService';
import { RoleKey, RoleSidebarPermissions, Directorate, School } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { PWAInstallButton } from '../PWAInstallButton';
import { AppLogo } from '../AppLogo';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';

export const AppLayout: React.FC = () => {
  const { currentUser, userProfile, logout, isDemo, openProfileModal, updateProfileState } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(location.pathname === '/sports-config');
  const [isTournamentsExpanded, setIsTournamentsExpanded] = useState(location.pathname.startsWith('/tournaments'));
  const [isTeachersExpanded, setIsTeachersExpanded] = useState(location.pathname.startsWith('/teachers'));
  const [isMatchesExpanded, setIsMatchesExpanded] = useState(location.pathname.startsWith('/matches'));
  const [isSchoolsExpanded, setIsSchoolsExpanded] = useState(location.pathname.startsWith('/schools'));
  const [activeSeason, setActiveSeason] = useState('2026/2027');
  const [directoratesList, setDirectoratesList] = useState<Directorate[]>([]);
  const [activeDirectorateId, setActiveDirectorateId] = useState<string>('taourirt');
  const [isDirectorateMenuOpen, setIsDirectorateMenuOpen] = useState(false);
  const [pendingDirectorate, setPendingDirectorate] = useState<Directorate | null>(null);
  const [isSyncingData, setIsSyncingData] = useState(false);
  const directorateMenuRef = useRef<HTMLDivElement>(null);

  // School verification for teachers
  const [schoolsList, setSchoolsList] = useState<School[]>([]);
  const [schoolAccessInput, setSchoolAccessInput] = useState('');
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  // Regional & National Qualification state
  const [hasRegionalQualification, setHasRegionalQualification] = useState(false);
  const [hasNationalQualification, setHasNationalQualification] = useState(false);

  useEffect(() => {
    if (!userProfile) return;

    const userSchoolId = userProfile.schoolId;
    const userSchoolName = userProfile.workLocation;

    const checkQualifications = async () => {
      try {
        const [students, tournaments] = await Promise.all([
          DataService.getStudents(),
          DataService.getTournaments()
        ]);

        const hasRegTournaments = tournaments.some(t => t.level === 'REGIONAL' || t.scope === 'REGIONAL');
        const hasNatTournaments = tournaments.some(t => t.level === 'NATIONAL' || t.scope === 'NATIONAL');

        const userStudents = students.filter(s => 
          (userSchoolId && s.schoolId === userSchoolId) ||
          (userSchoolName && (s.schoolName === userSchoolName || s.schoolName?.trim() === userSchoolName?.trim()))
        );

        const isReg = hasRegTournaments || userStudents.some(s => 
          s.isQualifiedRegional || 
          s.qualificationLevel === 'regional' || 
          s.qualificationLevel === 'national' || 
          s.isQualifiedNational
        );
        const isNat = hasNatTournaments || userStudents.some(s => 
          s.isQualifiedNational || 
          s.qualificationLevel === 'national'
        );

        setHasRegionalQualification(isReg);
        setHasNationalQualification(isNat);
      } catch (e) {
        console.error("Qualification check error:", e);
      }
    };

    checkQualifications();
  }, [userProfile]);

  useEffect(() => {
    if (userProfile && userProfile.role === 'TEACHER' && !userProfile.schoolAccessVerified && !isDemo) {
      const unsub = DataService.subscribeToSchools((liveSchools) => {
        setSchoolsList(liveSchools);
      });
      return () => unsub();
    }
  }, [userProfile, isDemo]);

  const handleVerifySchoolAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !userProfile) return;
    
    const userSchoolName = (userProfile.workLocation || '').trim();
    if (!userSchoolName) {
      toast.error('مؤسستك التعليمية غير محددة في ملفك الشخصي. يرجى التواصل مع المسؤول الإقليمي.');
      return;
    }
    
    const matchedSchool = schoolsList.find(s => s.name === userSchoolName);
    if (!matchedSchool) {
      toast.error(`المؤسسة التعليمية "${userSchoolName}" غير مسجلة في النظام بعد. يرجى مراجعة المسؤول الإقليمي لمديريتك.`);
      return;
    }
    
    const correctCode = (matchedSchool.accessCode || '').trim();
    if (!correctCode) {
      toast.error('لم يتم تعيين رمز أمان لهذه المؤسسة بعد. يرجى مراجعة المسؤول الإقليمي.');
      return;
    }
    
    if (schoolAccessInput.trim() !== correctCode) {
      toast.error('رمز الأمان السري للمؤسسة غير صحيح! يرجى التأكد من الرمز وإعادة المحاولة.');
      return;
    }
    
    setIsVerifyingCode(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        schoolAccessVerified: true,
        schoolId: matchedSchool.id
      });
      
      updateProfileState({ schoolAccessVerified: true, schoolId: matchedSchool.id });
      toast.success('تم التحقق وتأكيد انتسابك للمؤسسة بنجاح! مرحباً بك.');
    } catch (err) {
      console.error('Error updating school access verification:', err);
      toast.error('حدث خطأ أثناء حفظ حالة التحقق. يرجى المحاولة لاحقاً.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSyncData = async (silent = true) => {
    if (isSyncingData) return;
    setIsSyncingData(true);
    try {
      await DataService.syncAllDataFromCloud();
    } catch (err) {
      console.error('Silent sync error:', err);
    } finally {
      setIsSyncingData(false);
    }
  };

  // Automatic background silent sync every 60 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      handleSyncData(true);
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const [rolePermissions, setRolePermissions] = useState<RoleSidebarPermissions>({
    CENTRAL_ADMIN: ['/dashboard', '/tournaments', '/schools', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/directorates', '/sports-config'],
    TECH_COMMITTEE_HEAD: ['/dashboard', '/tournaments', '/schools', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config'],
    SPORT_MANAGER: ['/dashboard', '/tournaments', '/schools', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics'],
    TEACHER: ['/dashboard', '/tournaments', '/schools', '/matches', '/posters-certificates', '/statistics'],
    REFEREE: ['/dashboard', '/matches', '/statistics']
  });
  
  useEffect(() => {
    // Load active season initially and subscribe to real-time changes
    const unsubSeason = DataService.subscribeToActiveSeason((season) => {
      if (season) setActiveSeason(season);
    });

    DataService.getActiveSeason()
      .then(season => {
        if (season) setActiveSeason(season);
      })
      .catch(err => console.error("Error fetching active season inside AppLayout:", err));

    // Load directorates and subscribe
    const unsubDirs = DataService.subscribeToDirectorates((dirs) => {
      if (dirs && dirs.length > 0) {
        setDirectoratesList(dirs);
      }
    });

    DataService.getDirectorates()
      .then(dirs => {
        setDirectoratesList(dirs);
        setActiveDirectorateId(DataService.getActiveDirectorateId());
      })
      .catch(err => console.error("Error loading directorates in AppLayout:", err));

    // Load role sidebar permissions & subscribe
    const unsubPerms = DataService.subscribeToRoleSidebarPermissions((perms) => {
      if (perms) setRolePermissions(perms);
    });

    DataService.getRoleSidebarPermissions()
      .then(perms => {
        if (perms) setRolePermissions(perms);
      })
      .catch(err => console.error("Error fetching role permissions inside AppLayout:", err));

    // Listen to custom 'seasonChanged' event
    const handleSeasonChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveSeason(customEvent.detail);
      }
    };

    // Listen to custom 'directorateChanged' event
    const handleDirectorateChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveDirectorateId(customEvent.detail);
      }
    };

    // Listen to custom 'directoratesListUpdated' event
    const handleDirectoratesListUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDirectoratesList(customEvent.detail);
      }
    };

    // Listen to custom 'sidebarPermissionsChanged' event
    const handlePermissionsChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setRolePermissions(customEvent.detail);
      }
    };

    window.addEventListener('seasonChanged', handleSeasonChange);
    window.addEventListener('directorateChanged', handleDirectorateChange);
    window.addEventListener('directoratesListUpdated', handleDirectoratesListUpdate);
    window.addEventListener('sidebarPermissionsChanged', handlePermissionsChanged);
    return () => {
      unsubSeason();
      unsubDirs();
      unsubPerms();
      window.removeEventListener('seasonChanged', handleSeasonChange);
      window.removeEventListener('directorateChanged', handleDirectorateChange);
      window.removeEventListener('directoratesListUpdated', handleDirectoratesListUpdate);
      window.removeEventListener('sidebarPermissionsChanged', handlePermissionsChanged);
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      // On mobile devices (width < 768px), the directorate switcher is displayed as a centered full-screen modal.
      // Clicks/touches on the mobile modal will fall outside directorateMenuRef, triggering this click-outside
      // handler and instantly closing the modal before clicks on directorate items can be registered.
      // Therefore, we bypass this handler on mobile screens to ensure the modal functions perfectly.
      if (window.innerWidth < 768) {
        return;
      }
      if (directorateMenuRef.current && !directorateMenuRef.current.contains(event.target as Node)) {
        setIsDirectorateMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (location.pathname === '/sports-config') {
      setIsSettingsOpen(true);
    }
    if (location.pathname.startsWith('/tournaments')) {
      setIsTournamentsExpanded(true);
    }
    if (location.pathname.startsWith('/teachers')) {
      setIsTeachersExpanded(true);
    }
    if (location.pathname.startsWith('/matches')) {
      setIsMatchesExpanded(true);
    }
    if (location.pathname.startsWith('/schools')) {
      setIsSchoolsExpanded(true);
    }
  }, [location.pathname]);

  const { notifications, unreadCount, permission, requestPermission, markAsRead, markAllAsRead } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  const formatNotificationTime = (isoString?: string) => {
    if (!isoString) return 'الآن';
    try {
      const diff = Date.now() - new Date(isoString).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'الآن';
      if (minutes < 60) return `منذ ${minutes} دقيقة`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `منذ ${hours} ساعة`;
      const days = Math.floor(hours / 24);
      return `منذ ${days} يوم`;
    } catch {
      return 'الآن';
    }
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.success('تم تسجيل الخروج بنجاح');
    } catch (error) {
      toast.error('خطأ في تسجيل الخروج');
    }
  };

  const isTeacher = userProfile?.role === 'TEACHER';
  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';
  const isTechCommitteeHead = userProfile?.isTechCommitteeHead === true;

  // Ordered Navigation as strictly requested by user:
  // 1. البطولات الاقليمية
  // 2. المؤسسات التعليمية
  // 3. فرق المؤسسة وتسجيل التلاميذ
  // 4. رؤساء اللجن التقنية
  // 5. الحكام
  // 6. المباريات والنتائج
  // 7. احصائيات عامة
  // 8. الاعدادات والضوابط
  const canSendNotifications = isCentralAdmin || isTechCommitteeHead || userProfile?.role === 'SPORT_MANAGER';

  const userRoleKey: RoleKey = userProfile?.isTechCommitteeHead
    ? 'TECH_COMMITTEE_HEAD'
    : (userProfile?.role as RoleKey) || 'TEACHER';

  const defaultRoleHrefs: Record<RoleKey, string[]> = {
    CENTRAL_ADMIN: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions'],
    TECH_COMMITTEE_HEAD: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config'],
    SPORT_MANAGER: ['/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics'],
    TEACHER: ['/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics'],
    REFEREE: ['/dashboard', '/matches', '/statistics']
  };

  const rawHrefs = Array.isArray(rolePermissions?.[userRoleKey])
    ? rolePermissions[userRoleKey]
    : (defaultRoleHrefs[userRoleKey] || defaultRoleHrefs.TEACHER);

  const allowedHrefs = [...rawHrefs];
  // Ensure /helper-apps is visible for admin and committee roles if not yet in stored permissions
  if ((userProfile?.isSuperAdmin || userRoleKey === 'CENTRAL_ADMIN' || userRoleKey === 'TECH_COMMITTEE_HEAD' || userRoleKey === 'SPORT_MANAGER') && !allowedHrefs.includes('/helper-apps')) {
    const matchIdx = allowedHrefs.indexOf('/matches');
    if (matchIdx !== -1) {
      allowedHrefs.splice(matchIdx + 1, 0, '/helper-apps');
    } else {
      allowedHrefs.push('/helper-apps');
    }
  }

  const allNavItems = [
    { name: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
    { name: 'المؤسسات التعليمية', href: '/schools', icon: Users },
    { name: 'البطولات الرياضية المدرسية', href: '/tournaments', icon: Trophy },
    { name: 'الأطر التربوية', href: '/teachers', icon: UserIcon },
    { name: 'رؤساء اللجن التقنية', href: '/tech-committee', icon: ShieldCheck },
    { name: 'الحكام', href: '/referees', icon: UserCheck },
    { name: 'المباريات والنتائج', href: '/matches', icon: CalendarDays },
    { name: 'تطبيقات مساعدة', href: '/helper-apps', icon: Boxes },
    { name: 'الملصقات والشواهد التقديرية', href: '/posters-certificates', icon: Award },
    { name: 'إحصائيات عامة', href: '/statistics', icon: BarChart3 },
    { name: 'صلاحيات المستخدمين', href: '/permissions', icon: KeyRound },
    { name: 'الإعدادات والضوابط', href: '/sports-config', icon: Settings }
  ];

  const navItems = allNavItems.filter(item => allowedHrefs.includes(item.href));

  // Role display helper
  const getRoleLabel = (user?: any) => {
    if (!user) return 'مستخدم';
    if (user.isTechCommitteeHead) {
      return 'رئيس لجنة تقنية إقليمية';
    }
    switch (user.role) {
      case 'CENTRAL_ADMIN':
        return user.isSuperAdmin ? 'المسؤول المركزي' : 'مسير إقليمي';
      case 'SPORT_MANAGER':
        return 'منسق مادة التربية البدنية بالمؤسسة';
      case 'TEACHER':
        return 'أستاذ مؤطر';
      case 'REFEREE':
        return 'حكم معتمد';
      default:
        return 'مستخدم';
    }
  };

  const activeDirObj = directoratesList.find(d => d.id === activeDirectorateId) || directoratesList[0];

  const isTeacherBlocked = userProfile && userProfile.role === 'TEACHER' && !userProfile.schoolAccessVerified && !isDemo;

  if (isTeacherBlocked) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-100/60 p-4 sm:p-6 select-none" dir="rtl" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6 sm:p-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
          
          {/* Top Decorative bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-blue-500 via-sky-500 to-emerald-500" />

          {/* Logo and Icon Header */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <AppLogo size={90} showText={false} />
            <div className="space-y-1.5 mt-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">تأكيد رمز الأمان للمؤسسة</h2>
              <p className="text-xs text-slate-500 font-bold">نظام التحقق والربط المعتمد للمؤسسات التعليمية</p>
            </div>
          </div>

          {/* Welcome User info - Digital Badge style */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-4 text-right space-y-2.5 shadow-2xs">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-blue-100 text-blue-700 rounded-md">
                  <UserIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-slate-600">الأستاذ(ة):</span>
              </div>
              <span className="text-blue-700 font-black text-sm">{userProfile?.fullName}</span>
            </div>
            
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between leading-relaxed">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-100 text-emerald-700 rounded-md">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                </span>
                <span className="text-slate-600">مؤسسة العمل:</span>
              </div>
              <span className="text-emerald-800 font-black bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded text-[11px]">{userProfile?.workLocation || 'غير محددة'}</span>
            </div>
          </div>

          {/* Description */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-xl text-right">
            <p className="text-[11px] text-slate-700 leading-relaxed font-bold">
              تأكيد انتسابك لهذه المؤسسة يحمي معطياتها ويضمن عدم تداخل حسابات الأستاذة بالمنصة.
              <span className="block mt-1.5 text-[10px] text-amber-700 font-black flex items-center gap-1">
                ⚠️ احصل على رمز الأمان (6 أحرف وأرقام) من مدير المؤسسة أو منسق المديرية.
              </span>
            </p>
          </div>

          {/* Input Form */}
          <form onSubmit={handleVerifySchoolAccess} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-black text-slate-700 text-right">أدخل رمز الأمان للمؤسسة *</label>
              <div className="relative">
                <input
                  required
                  type="text"
                  maxLength={6}
                  value={schoolAccessInput}
                  onChange={(e) => setSchoolAccessInput(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                  placeholder="0 0 0 0 0 0"
                  className="w-full text-center tracking-[0.5em] font-mono text-base sm:text-lg px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-black text-blue-950 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isVerifyingCode || schoolAccessInput.length < 6}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-xs font-black transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-md shadow-blue-500/10 cursor-pointer active:scale-98"
              >
                {isVerifyingCode ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>جاري التحقق...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>تأكيد الرمز والدخول للمنصة</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => logout()}
                className="px-4 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold border border-slate-200 hover:border-slate-300 transition-all flex items-center gap-1 cursor-pointer active:scale-98"
                title="تسجيل الخروج والرجوع"
              >
                <LogOut className="h-4 w-4 text-slate-500" />
                <span>خروج</span>
              </button>
            </div>
          </form>
          
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] dark:bg-[#0b0f1a] text-[#1e293b] dark:text-slate-200 transition-colors duration-300" dir="rtl">
      {/* Sidebar for Desktop - High Density Dark Navy with Collapse/Expand feature */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col bg-[#0f172a] text-white border-l border-slate-700/80 shadow-lg select-none transition-all duration-300 relative z-20',
          isSidebarCollapsed ? 'w-18' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div className="p-3.5 border-b border-slate-700/80 bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <AppLogo size={isSidebarCollapsed ? 36 : 48} />
            {!isSidebarCollapsed && (
              <div className="truncate">
                <h1 className="text-xs font-bold leading-tight text-white truncate">
                  {activeDirObj?.name || 'المديرية الإقليمية'}
                </h1>
                <p className="text-[10px] text-slate-400 font-medium truncate">الفرع الإقليمي للجامعة الملكية للرياضة المدرسية</p>
              </div>
            )}
          </div>

          {/* Toggle Button Inside Header */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title={isSidebarCollapsed ? 'إظهار القائمة الجانبية بالكامل' : 'طي وإخفاء القائمة الجانبية'}
          >
            {isSidebarCollapsed ? (
              <ChevronLeft className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isTournamentsItem = item.href === '/tournaments';
            const isTeachersItem = item.href === '/teachers';
            const isMatchesItem = item.href === '/matches';

            return (
              <div key={item.name} className="space-y-0.5">
                <NavLink
                  to={item.href}
                  title={isSidebarCollapsed ? item.name : undefined}
                  onClick={() => {
                    if (isTournamentsItem) {
                      setIsTournamentsExpanded(prev => !prev);
                    }
                    if (isTeachersItem) {
                      setIsTeachersExpanded(prev => !prev);
                    }
                    if (isMatchesItem) {
                      setIsMatchesExpanded(prev => !prev);
                    }
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all group min-w-0',
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-black'
                        : 'text-slate-200 hover:bg-slate-800/90 hover:text-white font-bold',
                      isSidebarCollapsed && 'justify-center px-2'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0 group-hover:scale-110 transition-transform" />
                  {!isSidebarCollapsed && <span className="truncate flex-1 text-right">{item.name}</span>}
                </NavLink>

                {/* Tournament Sub-Branches */}
                {isTournamentsItem && isTournamentsExpanded && !isSidebarCollapsed && (
                  <div className="mr-5 my-1 pr-2 border-r border-slate-700/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {[
                      { name: 'بطولة إقليمية', tab: 'provincial', icon: '🏆', show: true },
                      { name: 'بطولة جهوية', tab: 'regional', icon: '🏅', show: hasRegionalQualification },
                      { name: 'بطولة وطنية', tab: 'national', icon: '🥇', show: hasNationalQualification },
                    ]
                      .filter(sub => sub.show)
                      .map((sub) => {
                      const isSubActive = location.pathname === '/tournaments' && (
                        location.search.includes(`tab=${sub.tab}`) ||
                        (!location.search.includes('tab=') && sub.tab === 'provincial')
                      );
                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/tournaments?tab=${sub.tab}`}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-normal transition-all',
                            isSubActive
                              ? 'bg-blue-600/30 text-blue-200 font-bold border-r-2 border-blue-400'
                              : 'text-slate-200 font-bold hover:text-white hover:bg-slate-800/80'
                          )}
                        >
                          <span className="text-[11px] opacity-80">{sub.icon}</span>
                          <span className="truncate">{sub.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Teacher Sub-Branches */}
                {isTeachersItem && isTeachersExpanded && !isSidebarCollapsed && (
                  <div className="mr-5 my-1 pr-2 border-r border-slate-700/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {[
                      { name: 'أستاذ التعليم الابتدائي', cadre: 'PRIMARY', icon: '🏫' },
                      { name: 'أستاذ التعليم الثانوي الإعدادي', cadre: 'MIDDLE', icon: '📘' },
                      { name: 'أستاذ التعليم الثانوي التأهيلي', cadre: 'HIGH', icon: '🎓' },
                    ].map((sub) => {
                      const isSubActive = location.pathname === '/teachers' && location.search.includes(`cadre=${sub.cadre}`);
                      return (
                        <NavLink
                          key={sub.cadre}
                          to={`/teachers?cadre=${sub.cadre}`}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-normal transition-all',
                            isSubActive
                              ? 'bg-blue-600/30 text-blue-200 font-bold border-r-2 border-blue-400'
                              : 'text-slate-200 font-bold hover:text-white hover:bg-slate-800/80'
                          )}
                        >
                          <span className="text-[11px] opacity-80">{sub.icon}</span>
                          <span className="truncate">{sub.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}

                {/* Matches & Calendar Sub-Branches */}
                {isMatchesItem && isMatchesExpanded && !isSidebarCollapsed && (
                  <div className="mr-5 my-1 pr-2 border-r border-slate-700/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {[
                      { name: 'جدول المقابلات والنتائج', tab: 'list', icon: '⚽', show: true },
                      { name: 'الرزنامة والبرنامج (Calendrier)', tab: 'calendar', icon: '📅', show: true },
                      { name: 'مبارياتي التحكيمية', tab: 'referee', icon: '🏁', show: userProfile?.role === 'TEACHER' || userProfile?.role === 'REFEREE' || userProfile?.role === 'CENTRAL_ADMIN' }
                    ]
                      .filter(sub => sub.show)
                      .map((sub) => {
                      const isSubActive = location.pathname === '/matches' && (
                        location.search.includes(`tab=${sub.tab}`) ||
                        (!location.search.includes('tab=') && sub.tab === 'list')
                      );
                      return (
                        <NavLink
                          key={sub.tab}
                          to={`/matches?tab=${sub.tab}`}
                          className={cn(
                            'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-normal transition-all',
                            isSubActive
                              ? 'bg-blue-600/30 text-blue-200 font-bold border-r-2 border-blue-400'
                              : 'text-slate-200 font-bold hover:text-white hover:bg-slate-800/80'
                          )}
                        >
                          <span className="text-[11px] opacity-80">{sub.icon}</span>
                          <span className="truncate">{sub.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* PWA Install Sidebar Button */}
        {!isSidebarCollapsed && (
          <div className="px-3 py-2 border-t border-slate-800">
            <PWAInstallButton variant="sidebar" />
          </div>
        )}

        {/* User Profile Footer */}
        <div className="p-3 border-t border-slate-700/80 bg-slate-900/70">
          <div className={cn('flex items-center', isSidebarCollapsed ? 'justify-center' : 'justify-between')}>
            <button
              type="button"
              onClick={openProfileModal}
              title="تعديل البيانات الشخصية"
              className="flex items-center gap-2.5 min-w-0 text-right hover:opacity-90 cursor-pointer group flex-1"
            >
              {userProfile?.photoUrl ? (
                <img
                  src={userProfile.photoUrl}
                  alt={userProfile.fullName || 'User'}
                  className="w-8 h-8 rounded-full object-cover border border-blue-400 shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-bold text-slate-200 group-hover:border-blue-400 group-hover:text-blue-300 transition-colors shrink-0">
                  {userProfile?.fullName?.[0] || 'U'}
                </div>
              )}
              {!isSidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-200 truncate group-hover:text-blue-300 transition-colors flex items-center gap-1">
                    <span>{userProfile?.fullName || 'المسير'}</span>
                    <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-blue-400 transition-opacity" />
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{getRoleLabel(userProfile)}</p>
                </div>
              )}
            </button>
            {!isSidebarCollapsed && (
              <button
                onClick={handleLogout}
                title="تسجيل الخروج"
                className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer shrink-0 mr-1"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main App Container */}
      <div className="flex flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-[#0b0f1a] transition-colors duration-300">
        {/* Top Header - High Density Crisp Style */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 sm:px-4 md:px-8 z-10 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* Mobile menu trigger & AppLogo */}
            <div className="flex items-center gap-1.5 md:hidden shrink-0">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg bg-slate-100/80 dark:bg-slate-800/80 cursor-pointer shrink-0"
                aria-label="القائمة الجانبية"
              >
                {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
              <AppLogo size={38} className="shrink-0" />
            </div>

            {/* Desktop toggle sidebar button */}
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="hidden md:flex p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer items-center gap-1.5 text-xs font-semibold shrink-0"
              title={isSidebarCollapsed ? 'إظهار القائمة الجانبية' : 'إخفاء القائمة الجانبية'}
            >
              <Menu className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{isSidebarCollapsed ? 'إظهار القائمة' : 'إخفاء'}</span>
            </button>

            {/* Page Title (Desktop & Tablet) */}
            <h2 className="hidden lg:block text-xs sm:text-sm md:text-base font-bold text-slate-800 dark:text-slate-100 truncate">
              {isTeacher ? 'فضاء الأستاذ - المقابلات والنتائج' : 'لوحة التحكم والتدبير الإقليمي'}
            </h2>
            <span className="hidden xl:inline-flex px-2.5 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded text-[11px] font-bold shrink-0">
              الموسم {activeSeason}
            </span>

            {/* Directorate Selector / Switcher Pill - Desktop Only to prevent mobile header overlap */}
            {userProfile?.isSuperAdmin ? (
              <div className="hidden md:block relative" ref={directorateMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsDirectorateMenuOpen(!isDirectorateMenuOpen)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50/90 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 rounded-full text-xs font-black transition-all cursor-pointer shadow-2xs shrink-0 select-none"
                  title="المديرية الإقليمية المحددة حالياً - انقر للتبديل"
                >
                  <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="truncate max-w-[160px] font-black text-blue-900 dark:text-blue-50">
                    {activeDirObj?.shortName || activeDirObj?.name || 'المديرية الإقليمية'}
                  </span>
                  <div className="flex items-center gap-1 bg-amber-100/90 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded-full font-mono text-[9px] font-bold">
                    <KeyRound className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
                    <span>{activeDirObj?.code || 'PIN'}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                </button>

                {/* Desktop Dropdown Menu */}
                {isDirectorateMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-100 mb-1.5 flex items-center justify-between">
                      <p className="text-[11px] font-black text-slate-700">المديريات الإقليمية والأقنان السرية</p>
                      <span className="text-[10px] text-slate-400 font-bold">{directoratesList.length} مديرية</span>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                      {directoratesList.map(d => {
                        const isSelected = d.id === activeDirectorateId;
                        const isPending = pendingDirectorate?.id === d.id;
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              if (d.id === activeDirectorateId) {
                                  setPendingDirectorate(null);
                                  return;
                              }
                              setPendingDirectorate(d);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all text-right cursor-pointer ${
                              isPending
                                ? 'bg-amber-50 text-amber-900 border border-amber-300'
                                : isSelected
                                ? 'bg-emerald-50 text-emerald-900 border border-emerald-300'
                                : 'hover:bg-slate-50 text-slate-700'
                            }`}
                          >
                            <div className="truncate min-w-0 flex-1 pl-2">
                              <p className="truncate font-black">{d.shortName || d.name}</p>
                              <p className="text-[10px] text-slate-400 font-normal">{d.region || 'جهة الشرق'}</p>
                            </div>
                            <div className="flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0">
                              <KeyRound className="w-2.5 h-2.5 text-amber-600" />
                              <span>{d.code}</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {pendingDirectorate ? (
                      <div className="pt-2 mt-2 border-t border-amber-200 bg-amber-50/70 p-2 rounded-xl space-y-1.5">
                        <p className="text-[10px] text-amber-800 font-bold text-center leading-tight">
                          تأكيد الانتقال لمديرية {pendingDirectorate.name}؟
                        </p>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPendingDirectorate(null)}
                            className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold cursor-pointer text-center"
                          >
                            تراجع
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              DataService.setActiveDirectorateId(pendingDirectorate.id);
                              setActiveDirectorateId(pendingDirectorate.id);
                              setIsDirectorateMenuOpen(false);
                              setPendingDirectorate(null);
                              toast.success(`تم التبديل إلى ${pendingDirectorate.name}`);
                            }}
                            className="flex-[2] py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black cursor-pointer text-center shadow-xs"
                          >
                            تأكيد التغيير ✅
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 mt-2 border-t border-slate-100 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDirectorateMenuOpen(false);
                            navigate('/sports-config');
                          }}
                          className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5 text-slate-400" />
                          <span>إدارة وتعديل المديريات والأقنان ⚙️</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              userProfile?.directorateId && (
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-white/80 border border-slate-200/80 text-slate-800 rounded-full text-xs font-black shrink-0 select-none shadow-2xs">
                  <Building2 className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="truncate max-w-[160px] text-slate-700">
                    {userProfile.directorateName || activeDirObj?.shortName || activeDirObj?.name}
                  </span>
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-3 md:gap-4">
            {/* Notifications Center Bell with Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2 rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-center shrink-0 relative ${
                  isNotificationsOpen
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
                title="مركز الإشعارات والتنبيهات"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center animate-pulse border border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Dropdown Panel */}
              {isNotificationsOpen && (
                <div className="absolute left-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in zoom-in-95 duration-100 text-right" dir="rtl">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
                    <div className="flex items-center gap-1.5 font-black text-slate-800 text-xs">
                      <Bell className="w-4 h-4 text-blue-600" />
                      <span>الإشعارات والتنبيهات</span>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await markAllAsRead();
                          toast.success('تم تحديد جميع الإشعارات كمقروءة');
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                      >
                        قراءة الكل
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 space-y-2">
                        <div className="text-2xl">🔔</div>
                        <p className="text-[10px] font-bold">لا توجد أي إشعارات أو تنبيهات حالياً</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const isUnread = !n.readBy?.includes(userProfile?.id || '');
                        return (
                          <div
                            key={n.id}
                            onClick={async () => {
                              if (isUnread) {
                                await markAsRead(n.id);
                              }
                            }}
                            className={`p-2.5 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-1 ${
                              isUnread
                                ? 'bg-blue-50/50 border-blue-100 hover:bg-blue-50'
                                : 'bg-slate-50/40 border-slate-100 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <h4 className={`text-xs leading-snug font-black ${isUnread ? 'text-blue-950' : 'text-slate-700'}`}>
                                {n.title}
                              </h4>
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1 animate-ping" />
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">
                              {n.body}
                            </p>
                            <span className="text-[8px] text-slate-400 self-start font-medium mt-0.5">
                              {formatNotificationTime(n.createdAt)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sync Button (مزامنة البيانات صامتاً بين الأجهزة) - Small Green circular arrows with rotation on sync */}
            <button
              type="button"
              onClick={() => handleSyncData(true)}
              disabled={isSyncingData}
              title="مزامنة تلقائية وصامتة خلف الشاشة (Internet Sync)"
              className="p-2 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-800 border border-emerald-300 rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs disabled:opacity-60 flex items-center justify-center shrink-0"
              aria-label="مزامنة صامتة"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${isSyncingData ? 'animate-spin' : ''}`} />
            </button>

            {/* Statistics Quick Button */}
            <button
              type="button"
              onClick={() => navigate('/statistics')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
              <span>الإحصائيات والترتيب</span>
            </button>

            {/* User Profile Button */}
            <button
              type="button"
              onClick={openProfileModal}
              className="flex items-center gap-2 py-1.5 px-2.5 hover:bg-slate-100 rounded-lg text-slate-700 transition-colors cursor-pointer border border-slate-200"
              title="تعديل البيانات الشخصية"
            >
              {userProfile?.photoUrl ? (
                <img
                  src={userProfile.photoUrl}
                  alt={userProfile.fullName || 'User'}
                  className="w-6 h-6 rounded-full object-cover border border-blue-400 shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 border border-blue-200 flex items-center justify-center text-xs font-bold shrink-0">
                  {userProfile?.fullName?.[0] || 'U'}
                </div>
              )}
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
                  {userProfile?.fullName || 'المستخدم'}
                </p>
                <p className="text-[9px] text-blue-600 font-semibold leading-none">الملف الشخصي</p>
              </div>
              <Edit3 className="h-3 w-3 text-slate-400 hidden sm:block" />
            </button>

            <div className="h-6 w-px bg-slate-200 hidden sm:block"></div>

            {/* Quick Action Button - Central Admin Only */}
            {isCentralAdmin && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate('/tournaments')}
                  className="bg-blue-600 text-white px-3 py-1.5 md:px-3.5 md:py-2 rounded-md text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>بطولة جديدة</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden" dir="rtl">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="relative flex w-72 flex-1 flex-col bg-[#0f172a] text-white shadow-2xl">
              <div className="flex items-center justify-between p-3.5 border-b border-slate-700 bg-slate-900/90">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AppLogo size={46} className="shrink-0" />
                  <div className="flex flex-col text-right min-w-0">
                    <span className="text-xs font-black text-white truncate">
                      {activeDirObj?.name || 'المديرية الإقليمية'}
                    </span>
                    <span className="text-[10px] text-slate-300 font-bold leading-tight truncate">
                      الفرع الإقليمي للجامعة الملكية
                    </span>
                  </div>
                </div>
                <button
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Directorate Quick Switcher inside Drawer */}
              {(isCentralAdmin || userProfile?.isSuperAdmin) && (
                <div className="p-3 bg-slate-800/90 border-b border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between text-slate-300 text-[11px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-400" />
                      <span>المديرية الإقليمية الحالية:</span>
                    </span>
                    <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono border border-amber-500/30">
                      PIN: {activeDirObj?.code}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDirectorateMenuOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-between shadow-xs transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="w-4 h-4 text-blue-200 shrink-0" />
                      <span className="truncate">{activeDirObj?.shortName || activeDirObj?.name || 'اختر المديرية'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] bg-blue-700/90 px-2 py-0.5 rounded-lg shrink-0">
                      <span>تغيير المديرية 🏢</span>
                      <ChevronDown className="w-3 h-3" />
                    </div>
                  </button>
                </div>
              )}
              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {navItems.map((item) => {
                  const isTournamentsItem = item.href === '/tournaments';
                  const isTeachersItem = item.href === '/teachers';
                  const isSchoolsItem = item.href === '/schools';
                  const isMatchesItem = item.href === '/matches';

                  const hasSubItems = isTournamentsItem || isTeachersItem || isSchoolsItem || isMatchesItem;

                  let isExpanded = false;
                  if (isTournamentsItem) isExpanded = isTournamentsExpanded;
                  if (isTeachersItem) isExpanded = isTeachersExpanded;
                  if (isSchoolsItem) isExpanded = isSchoolsExpanded;
                  if (isMatchesItem) isExpanded = isMatchesExpanded;

                  const handleParentClick = (e: React.MouseEvent) => {
                    if (hasSubItems) {
                      e.preventDefault();
                      if (isTournamentsItem) setIsTournamentsExpanded(prev => !prev);
                      if (isTeachersItem) setIsTeachersExpanded(prev => !prev);
                      if (isSchoolsItem) setIsSchoolsExpanded(prev => !prev);
                      if (isMatchesItem) setIsMatchesExpanded(prev => !prev);
                    } else {
                      setIsMobileMenuOpen(false);
                      navigate(item.href);
                    }
                  };

                  return (
                    <div key={item.name} className="space-y-1">
                      <div
                        onClick={handleParentClick}
                        className={cn(
                          'flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer select-none',
                          location.pathname === item.href || (hasSubItems && location.pathname.startsWith(item.href))
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </div>
                        {hasSubItems && (
                          <ChevronDown
                            className={cn("h-4 w-4 text-slate-400 transition-transform duration-200 shrink-0", isExpanded && "rotate-180 text-white")}
                          />
                        )}
                      </div>

                      {/* Tournament Sub-Branches */}
                      {isTournamentsItem && isTournamentsExpanded && (
                        <div className="mr-5 my-1 pr-2 border-r-2 border-blue-500/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {[
                            { name: 'بطولة إقليمية', tab: 'provincial', icon: '🏆', show: true },
                            { name: 'بطولة جهوية', tab: 'regional', icon: '🏅', show: hasRegionalQualification },
                            { name: 'بطولة وطنية', tab: 'national', icon: '🥇', show: hasNationalQualification },
                          ]
                            .filter(sub => sub.show)
                            .map((sub) => (
                            <NavLink
                              key={sub.tab}
                              to={`/tournaments?tab=${sub.tab}`}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                            >
                              <span className="text-xs">{sub.icon}</span>
                              <span>{sub.name}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}

                      {/* Teachers Sub-Branches */}
                      {isTeachersItem && isTeachersExpanded && (
                        <div className="mr-5 my-1 pr-2 border-r-2 border-blue-500/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {[
                            { name: 'أستاذ التعليم الابتدائي', cadre: 'PRIMARY', icon: '🏫' },
                            { name: 'أستاذ التعليم الثانوي الإعدادي', cadre: 'MIDDLE', icon: '📘' },
                            { name: 'أستاذ التعليم الثانوي التأهيلي', cadre: 'HIGH', icon: '🎓' },
                          ].map((sub) => (
                            <NavLink
                              key={sub.cadre}
                              to={`/teachers?cadre=${sub.cadre}`}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                            >
                              <span className="text-xs">{sub.icon}</span>
                              <span>{sub.name}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}

                      {/* Schools Sub-Branches */}
                      {isSchoolsItem && isSchoolsExpanded && (
                        <div className="mr-5 my-1 pr-2 border-r-2 border-blue-500/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {[
                            { name: 'جميع المؤسسات التعليمية', level: 'ALL', icon: '🏫' },
                            { name: 'التعليم الابتدائي', level: 'PRIMARY', icon: '👧' },
                            { name: 'التعليم الثانوي الإعدادي', level: 'MIDDLE', icon: '👦' },
                            { name: 'التعليم الثانوي التأهيلي', level: 'HIGH', icon: '🎓' },
                          ].map((sub) => (
                            <NavLink
                              key={sub.level}
                              to={sub.level === 'ALL' ? '/schools' : `/schools?level=${sub.level}`}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                            >
                              <span className="text-xs">{sub.icon}</span>
                              <span>{sub.name}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}

                      {/* Matches Sub-Branches */}
                      {isMatchesItem && isMatchesExpanded && (
                        <div className="mr-5 my-1 pr-2 border-r-2 border-blue-500/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {[
                            { name: 'جدول المقابلات والنتائج', tab: 'list', icon: '⚽' },
                            { name: 'الرزنامة والبرنامج (Calendrier)', tab: 'calendar', icon: '📅' },
                          ].map((sub) => (
                            <NavLink
                              key={sub.tab}
                              to={`/matches?tab=${sub.tab}`}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 transition-colors"
                            >
                              <span className="text-xs">{sub.icon}</span>
                              <span>{sub.name}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="p-4 border-t border-slate-700 bg-slate-900/50 space-y-2">
                <PWAInstallButton variant="sidebar" className="mb-2" />
                <button
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    openProfileModal();
                  }}
                  className="flex w-full items-center gap-2 text-xs font-semibold text-blue-300 hover:text-blue-200 cursor-pointer"
                >
                  <UserIcon className="h-4 w-4" />
                  <span>تعديل البيانات الشخصية</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-[#f8fafc] p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile Directorate Selection Modal */}
      {isDirectorateMenuOpen && userProfile?.isSuperAdmin && (
        <div className="md:hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] my-auto">
            <div className="px-4 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-white truncate">التبديل بين المديريات الإقليمية</h3>
                  <p className="text-[10px] text-slate-300 truncate">اختر المديرية لمتابعة التدبير والنتائج</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsDirectorateMenuOpen(false);
                  setPendingDirectorate(null);
                }}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 overflow-y-auto space-y-1.5 flex-1 max-h-[280px] min-h-0">
              {directoratesList.map(d => {
                const isSelected = d.id === activeDirectorateId;
                const isPending = pendingDirectorate?.id === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      if (d.id === activeDirectorateId) {
                        setPendingDirectorate(null);
                        return;
                      }
                      setPendingDirectorate(d);
                    }}
                    className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all text-right cursor-pointer ${
                      isPending
                        ? 'bg-amber-50 text-amber-900 border-2 border-amber-500 shadow-xs'
                        : isSelected
                        ? 'bg-blue-50 text-blue-900 border-2 border-blue-600 shadow-xs'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <div className="truncate min-w-0 flex-1 pl-2">
                      <p className="truncate text-xs font-black text-slate-900">{d.name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">{d.shortName ? `${d.shortName} • ` : ''}{d.region || 'جهة الشرق'}</p>
                    </div>
                    <div className="flex items-center gap-1 bg-amber-100 text-amber-900 border border-amber-300 px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold shrink-0">
                      <KeyRound className="w-3 h-3 text-amber-700" />
                      <span>{d.code}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {pendingDirectorate ? (
              <div className="p-3 bg-amber-50 border-t border-amber-200 shrink-0 space-y-2.5">
                <div className="text-center space-y-1">
                  <p className="text-[11px] text-amber-800 font-black">
                    تأكيد تبديل فضاء العمل إلى: <span className="text-slate-900">{pendingDirectorate.name}</span>
                  </p>
                  <p className="text-[9px] text-rose-600 font-bold leading-tight bg-rose-50 p-2 rounded-lg border border-rose-100">
                    ⚠️ سيتم عرض وتصفية كافة إحصائيات وبطولات هذه المديرية فقط.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPendingDirectorate(null)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-200 cursor-pointer text-center"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      DataService.setActiveDirectorateId(pendingDirectorate.id);
                      setActiveDirectorateId(pendingDirectorate.id);
                      setIsDirectorateMenuOpen(false);
                      setPendingDirectorate(null);
                      toast.success(`تم التغيير بنجاح إلى ${pendingDirectorate.name}`);
                    }}
                    className="flex-[2] py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-colors shadow-md shadow-blue-600/20 cursor-pointer text-center"
                  >
                    تأكيد التبديل ✅
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border-t border-slate-200 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsDirectorateMenuOpen(false);
                    navigate('/sports-config');
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-xs cursor-pointer"
                >
                  <Settings className="w-4 h-4 text-slate-300" />
                  <span>تدبير المديريات والأقنان من الإعدادات ⚙️</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <TeacherProfileModal />
    </div>
  );
};


