import React, { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth, isSuperAdminEmail } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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
  CloudOff,
  Wifi,
  Award,
  Wrench,
  Boxes,
  Sun,
  Moon,
  Trash2,
  BellOff
} from 'lucide-react';
import { cn } from '../../lib/utils';
import toast from 'react-hot-toast';
import { TeacherProfileModal } from '../TeacherProfileModal';
import { CommunicationWidget } from '../CommunicationWidget';
import { DataService, SPORTS_MAP } from '../../lib/dataService';
import {
  syncPendingLocalImportsToCloud,
  getPendingCloudSyncCount
} from '../../lib/excelParticipationsImportService';
import { RoleKey, RoleSidebarPermissions, Directorate, School } from '../../types';
import { useNotifications } from '../../contexts/NotificationContext';
import { PWAInstallButton } from '../PWAInstallButton';
import { AppLogo } from '../AppLogo';
import { doc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';


export const AppLayout: React.FC = () => {
  const {
    currentUser,
    userProfile,
    originalUserProfile,
    isImpersonatingTeacher,
    impersonationScopedSportIds,
    stopTeacherImpersonation,
    logout,
    isDemo,
    openProfileModal,
    updateProfileState
  } = useAuth();
  const { isDarkMode, toggleDarkMode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarFooterExpanded, setIsSidebarFooterExpanded] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('taourirt_sidebar_footer_expanded');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });
  const toggleSidebarFooter = () => {
    setIsSidebarFooterExpanded((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('taourirt_sidebar_footer_expanded', String(next));
      } catch {}
      return next;
    });
  };
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
  const [isCloudSyncPaused, setIsCloudSyncPaused] = useState<boolean>(() => DataService.isCloudSyncPaused());
  const directorateMenuRef = useRef<HTMLDivElement>(null);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);

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
    
    const enteredCode = schoolAccessInput.trim();
    if (!enteredCode) {
      toast.error('الرجاء إدخال رمز الأمان المكون من 6 أحرف وأرقام الخاص بمؤسستك');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const cleanCode = (c?: string) => (c || '').replace(/[\-\s]/g, '').toLowerCase();
      const targetClean = cleanCode(enteredCode);

      // Search ALL schools in the platform for a matching accessCode or code
      let matchedSchool = schoolsList.find(s => cleanCode(s.accessCode) === targetClean || cleanCode((s as any).code) === targetClean);

      // Fallback: If not found in current loaded list, fetch fresh list from DataService
      if (!matchedSchool) {
        const freshSchools = await DataService.getSchools();
        matchedSchool = freshSchools.find(s => cleanCode(s.accessCode) === targetClean || cleanCode((s as any).code) === targetClean);
      }

      // Fallback: Check if user profile work location matches
      if (!matchedSchool && userProfile.workLocation) {
        const userSchoolName = userProfile.workLocation.trim();
        const candidate = schoolsList.find(s => s.name === userSchoolName || s.name.includes(userSchoolName) || userSchoolName.includes(s.name));
        if (candidate && cleanCode(candidate.accessCode) === targetClean) {
          matchedSchool = candidate;
        }
      }

      if (!matchedSchool) {
        toast.error('رمز الأمان السري غير صحيح أو غير مخصص لأي مؤسسة بالمنظومة! يرجى التأكد من الرمز المكون من 6 أحرف والمقدم من مدير المؤسسة أو المنسق.');
        setIsVerifyingCode(false);
        return;
      }

      // Assign teacher to the matched official school authoritatively (bypassing Excel imported name variations)
      const officialSchoolName = matchedSchool.name;
      const officialSchoolId = matchedSchool.id;
      const effectiveDirId = matchedSchool.directorateId || userProfile.directorateId || 'taourirt';

      if (!DataService.isCloudSyncPaused()) {
        await setDoc(doc(db, 'users', currentUser.uid), {
          workLocation: officialSchoolName,
          schoolId: officialSchoolId,
          directorateId: effectiveDirId,
          schoolAccessVerified: true,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }

      // Automatically purge duplicate second teacher record from Excel import with typo school name
      try {
        await DataService.cleanupDuplicateTeachers({
          id: currentUser.uid,
          email: currentUser.email || userProfile.email,
          fullName: userProfile.fullName,
          leaseNumber: userProfile.leaseNumber,
          workLocation: officialSchoolName,
          schoolId: officialSchoolId,
          schoolAccessVerified: true
        });
      } catch (cleanupErr) {
        console.warn('Duplicate teacher cleanup warning:', cleanupErr);
      }

      DataService.setActiveDirectorateId(effectiveDirId);
      updateProfileState({
        workLocation: officialSchoolName,
        schoolId: officialSchoolId,
        directorateId: effectiveDirId,
        schoolAccessVerified: true
      });

      window.dispatchEvent(new CustomEvent('teacherProfileUpdated'));
      window.dispatchEvent(new CustomEvent('userDataChanged'));

      toast.success(`تم التحقق بنجاح! تم ربط حسابك بالمؤسسة المعتمدة: ${officialSchoolName}`);
    } catch (err) {
      console.error('Error updating school access verification:', err);
      toast.error('حدث خطأ أثناء حفظ حالة التحقق. يرجى المحاولة لاحقاً.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const handleSyncData = async (silent = true) => {
    if (isSyncingData || DataService.isCloudSyncPaused()) return;
    setIsSyncingData(true);
    try {
      await DataService.syncAllDataFromCloud();
      if (!silent) {
        toast.success('تمت مزامنة البيانات بنجاح');
      }
    } catch (err) {
      console.error('Silent sync error:', err);
    } finally {
      setIsSyncingData(false);
    }
  };

  const handleToggleCloudSync = () => {
    const nextPaused = !isCloudSyncPaused;
    setIsCloudSyncPaused(nextPaused);

    if (nextPaused) {
      // Turn OFF sync immediately
      setIsSyncingData(false);
      DataService.setCloudSyncPaused(true).catch(() => {});
      toast('تم توقيف المزامنة السحابية', {
        icon: '⏸️',
        duration: 2500
      });
    } else {
      // Turn ON sync immediately and sync in background without blocking or reverting the button
      DataService.setCloudSyncPaused(false)
        .then(async () => {
          if (DataService.isCloudSyncPaused()) return;
          setIsSyncingData(true);
          try {
            if (getPendingCloudSyncCount() > 0) {
              await syncPendingLocalImportsToCloud().catch(() => {});
            }
            if (!DataService.isCloudSyncPaused()) {
              await DataService.syncAllDataFromCloud().catch(() => {});
            }
          } finally {
            setIsSyncingData(false);
          }
        })
        .catch(() => {});
      toast.success('تم تشغيل المزامنة السحابية', {
        duration: 2500
      });
    }
  };

  // Sync local button state across tabs/components
  useEffect(() => {
    const syncStateFromEvent = () => {
      const paused = DataService.isCloudSyncPaused();
      setIsCloudSyncPaused(paused);
      if (paused) {
        setIsSyncingData(false);
      }
    };
    window.addEventListener('cloudSyncPausedChanged', syncStateFromEvent);
    window.addEventListener('storage', syncStateFromEvent);

    return () => {
      window.removeEventListener('cloudSyncPausedChanged', syncStateFromEvent);
      window.removeEventListener('storage', syncStateFromEvent);
    };
  }, []);

  // Automatic background silent sync every 60 seconds ONLY when Cloud Sync is NOT paused
  useEffect(() => {
    if (isCloudSyncPaused) return;
    const timer = setInterval(() => {
      if (!DataService.isCloudSyncPaused()) {
        handleSyncData(true);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [isCloudSyncPaused]);

  const [rolePermissions, setRolePermissions] = useState<RoleSidebarPermissions>(() => {
    const defaults: RoleSidebarPermissions = {
      CENTRAL_ADMIN: ['/dashboard', '/tournaments', '/schools', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/directorates', '/sports-config', '/permissions'],
      TECH_COMMITTEE_HEAD: ['/dashboard', '/tournaments', '/schools', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config'],
      SPORT_MANAGER: ['/dashboard', '/tournaments', '/schools', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics'],
      TEACHER: ['/dashboard', '/tournaments', '/schools', '/matches', '/posters-certificates', '/statistics'],
      REFEREE: ['/dashboard', '/matches', '/statistics']
    };
    try {
      const saved = localStorage.getItem('taourirt_role_sidebar_permissions');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return { ...defaults, ...parsed };
        }
      }
    } catch {}
    return defaults;
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

  const {
    notifications,
    unreadCount,
    permission,
    requestPermission,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAllNotifications,
    resetAllBellsForAllUsers
  } = useNotifications();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [confirmGlobalBellReset, setConfirmGlobalBellReset] = useState(false);
  const [isResettingGlobalBells, setIsResettingGlobalBells] = useState(false);
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
  const isSuperOrCentral =
    isCentralAdmin ||
    userProfile?.isSuperAdmin === true ||
    userProfile?.role === 'SUPER_ADMIN' ||
    isSuperAdminEmail(userProfile?.email);
  const isTechCommitteeHead =
    userProfile?.isTechCommitteeHead === true ||
    userProfile?.role === 'TECH_HEAD' ||
    (userProfile?.role as string) === 'TECH_COMMITTEE_HEAD';
  const hideCloudSyncButton = !isSuperOrCentral && (isTeacher || isTechCommitteeHead);

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

  const userRoleKey: RoleKey = isSuperOrCentral
    ? 'CENTRAL_ADMIN'
    : isTechCommitteeHead
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

  const allNavItems = [
    { name: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
    { name: 'المؤسسات التعليمية', href: '/schools', icon: Users },
    { name: 'البطولات الإقليمية المدرسية', href: '/tournaments', icon: Trophy },
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
    if (user.email && String(user.email).trim().toLowerCase() === 'sayhihassan@gmail.com') {
      return 'مشرف تربوي';
    }
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

  const isTeacherBlocked = userProfile && userProfile.role === 'TEACHER' && !userProfile.schoolAccessVerified && !isDemo && !isImpersonatingTeacher;

  if (isTeacherBlocked) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-100/60 p-4 sm:p-6 select-none" dir="rtl" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
        <div className="w-full max-w-md bg-white border border-slate-200/80 rounded-3xl shadow-xl hover:shadow-2xl transition-all duration-300 p-6 sm:p-8 space-y-6 text-center animate-in fade-in zoom-in-95 duration-200 relative overflow-hidden">
          
          {/* Top Decorative bar */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-emerald-500 via-teal-500 to-amber-500" />

          {/* Logo and Icon Header */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <AppLogo size={90} showText={false} />
            <div className="space-y-1.5 mt-2">
              <h2 className="text-xl font-black text-slate-900 tracking-tight">تأكيد رمز الأمان للمؤسسة</h2>
              <p className="text-xs text-slate-500 font-bold">نظام التحقق والربط المعتمد للمؤسسات التعليمية</p>
            </div>
          </div>

          {/* Welcome User info - Digital Badge style */}
          <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 text-right space-y-2.5 shadow-2xs">
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-100 text-emerald-700 rounded-md">
                  <UserIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-slate-600">الأستاذ(ة):</span>
              </div>
              <span className="text-emerald-800 font-black text-sm">{userProfile?.fullName}</span>
            </div>
            
            <div className="text-xs font-bold text-slate-800 flex items-center justify-between leading-relaxed">
              <div className="flex items-center gap-2">
                <span className="p-1 bg-emerald-100 text-emerald-700 rounded-md">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                </span>
                <span className="text-slate-600">مؤسسة العمل:</span>
              </div>
              <span className="text-emerald-800 font-black bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-lg text-[11px]">{userProfile?.workLocation || 'غير محددة'}</span>
            </div>
          </div>

          {/* Description */}
          <div className="p-3.5 bg-amber-50/70 border border-amber-100 rounded-2xl text-right">
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
                  className="w-full text-center tracking-[0.5em] font-mono text-base sm:text-lg px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-black text-emerald-950 shadow-2xs"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isVerifyingCode || schoolAccessInput.length < 6}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 text-xs font-black transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 shadow-md shadow-emerald-500/10 cursor-pointer active:scale-98"
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

            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={async () => {
                  try {
                    if (currentUser && !DataService.isCloudSyncPaused()) {
                      await setDoc(doc(db, 'users', currentUser.uid), {
                        schoolAccessVerified: true,
                        updatedAt: serverTimestamp()
                      }, { merge: true }).catch(() => {});
                    }
                  } catch (err) {}
                  updateProfileState({ schoolAccessVerified: true });
                  openProfileModal();
                  toast.success('تم الدخول بنجاح! يمكنك الآن اختيار وتعديل اسم مؤسستك من استمارة البيانات الشخصية.');
                }}
                className="w-full py-2.5 px-3 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>✍️ الدخول للمنصة واختيار/تعديل اسم مؤسستي يدوياً من الاستمارة</span>
              </button>
            </div>
          </form>
          
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] dark:bg-[#0b0f1a] text-[#1e293b] dark:text-slate-200 transition-colors duration-300" dir="rtl">
      {/* Sidebar for Desktop - Coordinated Day/Night mode styling */}
      <aside
        className={cn(
          'hidden md:flex md:flex-col bg-white dark:bg-[#0f172a] text-slate-800 dark:text-white border-l border-slate-200 dark:border-slate-700/80 shadow-sm dark:shadow-lg select-none transition-all duration-300 relative z-20',
          isSidebarCollapsed ? 'w-18' : 'w-64'
        )}
      >
        {/* Brand Header */}
        <div className="p-3.5 border-b border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <AppLogo size={isSidebarCollapsed ? 36 : 48} />
            {!isSidebarCollapsed && (
              <div className="truncate">
                <h1 className="text-xs font-black leading-tight text-slate-900 dark:text-white truncate">
                  {activeDirObj?.name || 'المديرية الإقليمية'}
                </h1>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold truncate">المنظومة الرقمية لتتبع نتائج البطولات المدرسية الاقليمية 2026</p>
              </div>
            )}
          </div>

          {/* Toggle Button Inside Header */}
          <button
            type="button"
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
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
                    if (isMatchesItem) {
                      setIsMatchesExpanded(prev => !prev);
                    }
                  }}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-black transition-all group min-w-0',
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20 font-black'
                        : 'text-slate-600 hover:bg-indigo-50/70 hover:text-indigo-800 font-bold dark:text-slate-200 dark:hover:bg-slate-800/90 dark:hover:text-white',
                      isSidebarCollapsed && 'justify-center px-2'
                    )
                  }
                >
                  <item.icon className="h-4 w-4 flex-shrink-0 group-hover:scale-110 transition-transform" />
                  {!isSidebarCollapsed && <span className="truncate flex-1 text-right">{item.name}</span>}
                </NavLink>

                {/* Tournament Sub-Branches */}
                {isTournamentsItem && isTournamentsExpanded && !isSidebarCollapsed && (
                  <div className="mr-5 my-1 pr-2 border-r border-slate-200 dark:border-slate-700/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {[
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
                              ? 'bg-indigo-50 text-indigo-800 font-black border-r-2 border-indigo-500 dark:bg-indigo-600/30 dark:text-indigo-200 dark:border-indigo-400'
                              : 'text-slate-600 font-bold hover:text-indigo-800 hover:bg-indigo-50/50 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80'
                          )}
                        >
                          <span className="text-[11px] opacity-80">{sub.icon}</span>
                          <span className="truncate">{sub.name}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
                {isMatchesItem && isMatchesExpanded && !isSidebarCollapsed && (
                  <div className="mr-5 my-1 pr-2 border-r border-slate-200 dark:border-slate-700/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                    {[
                      { name: 'جدول المقابلات والنتائج', tab: 'list', icon: '⚽', show: true },
                      { name: 'الرزنامة والبرنامج (Calendrier)', tab: 'calendar', icon: '📅', show: true },
                      { name: 'أنشطتي التحكيمية', tab: 'referee', icon: '🏁', show: userProfile?.role === 'TEACHER' || userProfile?.role === 'REFEREE' || userProfile?.role === 'CENTRAL_ADMIN' }
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
                              ? 'bg-indigo-50 text-indigo-800 font-black border-r-2 border-indigo-500 dark:bg-indigo-600/30 dark:text-indigo-200 dark:border-indigo-400'
                              : 'text-slate-600 font-bold hover:text-indigo-800 hover:bg-indigo-50/50 dark:text-slate-200 dark:hover:text-white dark:hover:bg-slate-800/80'
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

        {/* Collapsible Sidebar Footer Section (Desktop) */}
        {!isSidebarCollapsed ? (
          <div className="border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/70 shrink-0">
            <button
              type="button"
              onClick={toggleSidebarFooter}
              aria-expanded={isSidebarFooterExpanded}
              title={isSidebarFooterExpanded ? 'إخفاء هذا الجزء' : 'إظهار الحساب وتثبيت التطبيق'}
              className="w-full px-3 py-2 flex items-center justify-between text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
            >
              <span className="truncate">
                {isSidebarFooterExpanded
                  ? 'إخفاء الحساب وخيارات التطبيق'
                  : (userProfile?.fullName || 'الحساب وخيارات التطبيق')}
              </span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-200 shrink-0',
                  !isSidebarFooterExpanded && 'rotate-180'
                )}
              />
            </button>

            {isSidebarFooterExpanded && (
              <div className="animate-in fade-in duration-150">
                {/* About App Button */}
                <div className="px-3 py-1">
                  <button
                    type="button"
                    onClick={() => setIsAboutModalOpen(true)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-emerald-800 dark:hover:text-white hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                  >
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>حول المنظومة الرقمية ℹ️</span>
                  </button>
                </div>

                {/* PWA Install Sidebar Button */}
                <div className="px-3 py-2 border-t border-slate-200 dark:border-slate-800">
                  <PWAInstallButton variant="sidebar" />
                </div>

                {/* User Profile Footer */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-700/80">
                  <div className="flex items-center justify-between">
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
                          className="w-8 h-8 rounded-full object-cover border border-emerald-500 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-slate-700 border border-emerald-200 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-slate-200 group-hover:border-emerald-500 group-hover:text-emerald-800 transition-colors shrink-0">
                          {userProfile?.fullName?.[0] || 'U'}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black text-slate-800 dark:text-slate-200 truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors flex items-center gap-1">
                          <span>{userProfile?.fullName || 'المسير'}</span>
                          <Edit3 className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 text-emerald-600 transition-opacity" />
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">{getRoleLabel(userProfile)}</p>
                      </div>
                    </button>
                    <button
                      onClick={handleLogout}
                      title="تسجيل الخروج"
                      className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0 mr-1"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/80 dark:border-slate-800 text-center">
                    <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 leading-snug">
                      برمجة المفتش أمين سنوسي والأستاذ عمر حماني
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 border-t border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-slate-900/70">
            <div className="flex items-center justify-center">
              <button
                type="button"
                onClick={openProfileModal}
                title="تعديل البيانات الشخصية"
                className="flex items-center justify-center hover:opacity-90 cursor-pointer group"
              >
                {userProfile?.photoUrl ? (
                  <img
                    src={userProfile.photoUrl}
                    alt={userProfile.fullName || 'User'}
                    className="w-8 h-8 rounded-full object-cover border border-emerald-500 shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-slate-700 border border-emerald-200 dark:border-slate-600 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-slate-200 group-hover:border-emerald-500 group-hover:text-emerald-800 transition-colors shrink-0">
                    {userProfile?.fullName?.[0] || 'U'}
                  </div>
                )}
              </button>
            </div>
          </div>
        )}
      </aside>

      {/* Main App Container */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden bg-slate-50 dark:bg-[#0b0f1a] transition-colors duration-300">
        {/* Top Header - High Density Crisp Style */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 px-2.5 sm:px-4 md:px-8 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-colors">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/90 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 border border-emerald-200/90 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100 rounded-full text-xs font-black transition-all cursor-pointer shadow-2xs shrink-0 select-none"
                  title="المديرية الإقليمية المحددة حالياً - انقر للتبديل"
                >
                  <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="truncate max-w-[160px] font-black text-emerald-950 dark:text-emerald-50">
                    {activeDirObj?.shortName || activeDirObj?.name || 'المديرية الإقليمية'}
                  </span>
                  <div className="flex items-center gap-1 bg-amber-100/90 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 px-1.5 py-0.5 rounded-full font-mono text-[9px] font-bold">
                    <KeyRound className="w-2.5 h-2.5 text-amber-700 dark:text-amber-400" />
                    <span>{activeDirObj?.code || 'PIN'}</span>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                </button>

                {/* Desktop Dropdown Menu */}
                {isDirectorateMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1.5 flex items-center justify-between">
                      <p className="text-[11px] font-black text-slate-700 dark:text-slate-200">المديريات الإقليمية والأقنان السرية</p>
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
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            <div className="truncate min-w-0 flex-1 pl-2">
                              <p className="truncate font-black">{d.shortName || d.name}</p>
                              <p className="text-[10px] text-slate-400 font-normal">{d.region || 'جهة الشرق'}</p>
                            </div>
                            <div className="flex items-center gap-1 bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold shrink-0">
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
                            className="flex-[2] py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black cursor-pointer text-center shadow-xs"
                          >
                            تأكيد التغيير ✅
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800 space-y-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDirectorateMenuOpen(false);
                            navigate('/sports-config');
                          }}
                          className="flex items-center justify-center gap-1.5 w-full py-2 bg-slate-50 hover:bg-emerald-50 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 hover:text-emerald-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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
                <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50/80 border border-emerald-200/80 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-100 rounded-full text-xs font-black shrink-0 select-none shadow-2xs">
                  <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate max-w-[160px]">
                    {userProfile.directorateName || activeDirObj?.shortName || activeDirObj?.name}
                  </span>
                </div>
              )
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 md:gap-3 shrink-0">
            {/* Dark Mode Toggle Button (Identical to Homepage) */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 sm:px-2.5 sm:py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
              title={isDarkMode ? 'التحويل للوضع النهاري' : 'التحويل للوضع الليلي (Dark Mode)'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600 shrink-0" />
              )}
            </button>

            {/* Communication Widget Message Button */}
            <CommunicationWidget />

            {/* Notifications Center Bell with Dropdown */}
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className={`p-2 rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-center shrink-0 relative ${
                  isNotificationsOpen
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
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

              {/* Mobile Backdrop & Centered/Anchored Dropdown Panel */}
              {isNotificationsOpen && (
                <>
                  <div
                    className="sm:hidden fixed inset-0 bg-slate-900/45 backdrop-blur-[1px] z-[120]"
                    onClick={() => setIsNotificationsOpen(false)}
                  />
                  <div
                    className="fixed inset-x-3 top-[68px] mx-auto w-auto max-w-md sm:inset-x-auto sm:left-6 sm:top-[68px] sm:mx-0 sm:w-96 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-3.5 z-[130] animate-in fade-in zoom-in-95 duration-100 text-right"
                    dir="rtl"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5 mb-2.5">
                      <div className="flex items-center gap-1.5 font-black text-slate-800 dark:text-white text-xs min-w-0">
                        <Bell className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="truncate">الإشعارات والتنبيهات</span>
                        {notifications.length > 0 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-black tabular-nums">
                            {notifications.length}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await markAllAsRead();
                              toast.success('تم تحديد جميع الإشعارات كمقروءة');
                            }}
                            className="text-[10px] font-bold text-emerald-600 hover:text-emerald-800 hover:underline cursor-pointer"
                          >
                            قراءة الكل
                          </button>
                        )}
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteAllNotifications();
                              toast.success('تم حذف جميع الإشعارات من حسابك فقط');
                            }}
                            className="text-[10px] font-bold text-rose-600 hover:text-rose-800 hover:underline cursor-pointer flex items-center gap-0.5"
                            title="حذف كافة الإشعارات من حسابي فقط"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>حذف الكل</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsNotificationsOpen(false)}
                          aria-label="إغلاق الإشعارات"
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-[62vh] sm:max-h-80 overflow-y-auto space-y-1.5 pr-0.5">
                      {notifications.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 space-y-2">
                          <div className="text-2xl">🔔</div>
                          <p className="text-[11px] font-bold">لا توجد أي إشعارات أو تنبيهات حالياً</p>
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
                                  ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50'
                                  : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-100 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                  {isUnread && (
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0 mt-1.5" />
                                  )}
                                  <h4 className={`text-xs leading-snug font-black break-words ${isUnread ? 'text-emerald-950 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {n.title}
                                  </h4>
                                </div>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await deleteNotification(n.id);
                                    toast.success('تم حذف الإشعار من حسابك فقط');
                                  }}
                                  title="حذف هذا الإشعار من حسابي فقط"
                                  aria-label="حذف الإشعار"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors cursor-pointer shrink-0"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-semibold break-words">
                                {n.body}
                              </p>
                              <span className="text-[9px] text-slate-400 self-start font-medium mt-0.5 tabular-nums">
                                {formatNotificationTime(n.createdAt)}
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Central Admin Global Bell Reset Bar */}
                    {isSuperOrCentral && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        {!confirmGlobalBellReset ? (
                          <button
                            type="button"
                            onClick={() => setConfirmGlobalBellReset(true)}
                            className="w-full py-2 px-3 rounded-xl text-[11px] font-black bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 dark:border-rose-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                            title="حذف جميع إشعارات الجرس لدى كافة المشرفين والأساتذة والحكام"
                          >
                            <BellOff className="w-3.5 h-3.5 shrink-0" />
                            <span>حذف إشعارات الجرس لكل المشرفين والأساتذة</span>
                          </button>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 space-y-2">
                            <p className="text-[10px] font-bold text-rose-900 dark:text-rose-200 leading-relaxed">
                              تأكيد: سيتم حذف جميع تنبيهات الجرس لدى كافة الأساتذة والمشرفين والحكام (لن تحذف رسائل منصة تواصل).
                            </p>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={isResettingGlobalBells}
                                onClick={() => setConfirmGlobalBellReset(false)}
                                className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer disabled:opacity-50"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                disabled={isResettingGlobalBells}
                                onClick={async () => {
                                  setIsResettingGlobalBells(true);
                                  try {
                                    const res = await resetAllBellsForAllUsers();
                                    setConfirmGlobalBellReset(false);
                                    toast.success(
                                      res.deletedCount > 0
                                        ? `تم حذف إشعارات الجرس لجميع المشرفين والأساتذة بنجاح (حذف ${res.deletedCount} إشعار)`
                                        : 'تم حذف إشعارات الجرس لجميع المشرفين والأساتذة بنجاح'
                                    );
                                  } catch {
                                    toast.error('تعذر حذف إشعارات الجرس، يرجى المحاولة مجدداً');
                                  } finally {
                                    setIsResettingGlobalBells(false);
                                  }
                                }}
                                className="px-3 py-1 rounded-lg text-[10px] font-black bg-rose-600 hover:bg-rose-700 text-white cursor-pointer disabled:opacity-50"
                              >
                                {isResettingGlobalBells ? 'جاري الحذف...' : 'نعم، حذف للجميع'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Sync ON/OFF Toggle Button (يظهر للمسؤولين فقط ويُخفى للأستاذ ورئيس اللجنة التقنية) */}
            {!hideCloudSyncButton && (
              <button
                type="button"
                onClick={handleToggleCloudSync}
                title={
                  isCloudSyncPaused
                    ? 'المزامنة متوقفة — اضغط لتشغيل المزامنة'
                    : 'المزامنة مشغلة — اضغط لتوقيف المزامنة'
                }
                className={cn(
                  'p-2 rounded-full transition-all cursor-pointer shadow-2xs hover:shadow-xs flex items-center justify-center gap-1.5 shrink-0 border select-none',
                  isCloudSyncPaused
                    ? 'px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 dark:text-rose-200 dark:border-rose-700'
                    : 'bg-emerald-50 hover:bg-emerald-100/90 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-700'
                )}
                aria-label={isCloudSyncPaused ? 'تشغيل المزامنة' : 'توقيف المزامنة'}
                aria-pressed={!isCloudSyncPaused}
              >
                {isCloudSyncPaused ? (
                  <>
                    <CloudOff className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                    <span className="hidden sm:inline text-[11px] font-black whitespace-nowrap">المزامنة متوقفة</span>
                  </>
                ) : (
                  <RefreshCw className={`w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 ${isSyncingData ? 'animate-spin' : ''}`} />
                )}
              </button>
            )}

            {/* Statistics Quick Button */}
            <button
              type="button"
              onClick={() => navigate('/statistics')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-emerald-600" />
              <span>الإحصائيات والترتيب</span>
            </button>

            {/* User Profile Button */}
            <button
              type="button"
              onClick={openProfileModal}
              className="flex items-center gap-2 py-1.5 px-2.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-700 dark:text-slate-200 transition-colors cursor-pointer border border-slate-200 dark:border-slate-700"
              title="تعديل البيانات الشخصية"
            >
              {userProfile?.photoUrl ? (
                <img
                  src={userProfile.photoUrl}
                  alt={userProfile.fullName || 'User'}
                  className="w-6 h-6 rounded-full object-cover border border-emerald-500 shrink-0"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-xs font-bold shrink-0">
                  {userProfile?.fullName?.[0] || 'U'}
                </div>
              )}
              <div className="hidden sm:block text-right">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-[120px]">
                  {userProfile?.fullName || 'المستخدم'}
                </p>
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold leading-none">الملف الشخصي</p>
              </div>
              <Edit3 className="h-3 w-3 text-slate-400 hidden sm:block" />
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

            {/* Quick Action Button - Central Admin Only */}
            {isCentralAdmin && (
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => navigate('/tournaments')}
                  title="إضافة بطولة جديدة"
                  aria-label="إضافة بطولة جديدة"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white w-9 h-9 rounded-xl flex items-center justify-center shadow-xs shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer shrink-0"
                >
                  <Plus className="h-4.5 w-4.5 shrink-0" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden" dir="rtl">
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={() => setIsMobileMenuOpen(false)}></div>
            <div className="relative flex w-72 flex-1 flex-col bg-white dark:bg-[#0f172a] text-slate-800 dark:text-white shadow-2xl border-l border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between p-3.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AppLogo size={46} className="shrink-0" />
                  <div className="flex flex-col text-right min-w-0">
                    <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {activeDirObj?.name || 'المديرية الإقليمية'}
                    </span>
                    <span className="text-[10px] text-slate-500 dark:text-slate-300 font-bold leading-tight truncate">
                      المنظومة الرقمية لتتبع نتائج البطولات المدرسية الاقليمية 2026
                    </span>
                  </div>
                </div>
                <button
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Mobile Directorate Quick Switcher inside Drawer */}
              {(isCentralAdmin || userProfile?.isSuperAdmin) && (
                <div className="p-3 bg-emerald-50/70 dark:bg-slate-800/90 border-b border-emerald-100 dark:border-slate-700/80 space-y-2">
                  <div className="flex items-center justify-between text-slate-700 dark:text-slate-300 text-[11px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>المديرية الإقليمية الحالية:</span>
                    </span>
                    <span className="bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded text-[10px] font-mono border border-amber-500/30">
                      PIN: {activeDirObj?.code}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsDirectorateMenuOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2 px-3 rounded-xl text-xs flex items-center justify-between shadow-xs transition-colors cursor-pointer active:scale-98"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Building2 className="w-4 h-4 text-emerald-200 shrink-0" />
                      <span className="truncate">{activeDirObj?.shortName || activeDirObj?.name || 'اختر المديرية'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] bg-emerald-700/90 px-2 py-0.5 rounded-lg shrink-0">
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

                  const hasSubItems = isTournamentsItem || isMatchesItem;

                  let isExpanded = false;
                  if (isTournamentsItem) isExpanded = isTournamentsExpanded;
                  if (isMatchesItem) isExpanded = isMatchesExpanded;

                  const handleParentClick = () => {
                    if (hasSubItems) {
                      // Toggle expansion for better mobile UX
                      if (isTournamentsItem) setIsTournamentsExpanded(prev => !prev);
                      if (isMatchesItem) setIsMatchesExpanded(prev => !prev);
                      
                      // Also navigate to the main section page as requested by user
                      setIsMobileMenuOpen(false);
                      navigate(item.href);
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
                            ? 'bg-indigo-600 text-white shadow-xs font-black'
                            : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
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
                        <div className="mr-5 my-1 pr-2 border-r-2 border-indigo-500/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
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
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 transition-colors"
                            >
                              <span className="text-xs">{sub.icon}</span>
                              <span>{sub.name}</span>
                            </NavLink>
                          ))}
                        </div>
                      )}

                      {/* Matches Sub-Branches */}
                      {isMatchesItem && isMatchesExpanded && (
                        <div className="mr-5 my-1 pr-2 border-r-2 border-indigo-500/60 space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
                          {[
                            { name: 'جدول المقابلات والنتائج', tab: 'list', icon: '⚽', show: true },
                            { name: 'الرزنامة والبرنامج (Calendrier)', tab: 'calendar', icon: '📅', show: true },
                            { name: 'أنشطتي التحكيمية', tab: 'referee', icon: '🏁', show: userProfile?.role === 'TEACHER' || userProfile?.role === 'REFEREE' || userProfile?.role === 'CENTRAL_ADMIN' }
                          ]
                            .filter(sub => sub.show)
                            .map((sub) => (
                            <NavLink
                              key={sub.tab}
                              to={`/matches?tab=${sub.tab}`}
                              onClick={() => setIsMobileMenuOpen(false)}
                              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-emerald-800 hover:bg-emerald-50/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/80 transition-colors"
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
              <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 shrink-0">
                <button
                  type="button"
                  onClick={toggleSidebarFooter}
                  aria-expanded={isSidebarFooterExpanded}
                  title={isSidebarFooterExpanded ? 'إخفاء هذا الجزء' : 'إظهار هذا الجزء'}
                  className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-black text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
                >
                  <span className="truncate">
                    {isSidebarFooterExpanded
                      ? 'إخفاء الحساب وخيارات التطبيق'
                      : (userProfile?.fullName || 'الحساب وخيارات التطبيق')}
                  </span>
                  <ChevronDown
                    className={cn(
                      'w-4 h-4 text-slate-500 dark:text-slate-400 transition-transform duration-200 shrink-0',
                      !isSidebarFooterExpanded && 'rotate-180'
                    )}
                  />
                </button>

                {isSidebarFooterExpanded && (
                  <div className="px-4 pb-4 pt-1 space-y-3 animate-in fade-in duration-150">
                    <PWAInstallButton variant="sidebar" className="mb-2" />

                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setIsAboutModalOpen(true);
                      }}
                      className="flex w-full items-center gap-3 px-3 py-3 text-xs font-black text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-xl transition-all cursor-pointer mb-1"
                    >
                      <ShieldCheck className="h-5 w-5" />
                      <span>حول المنظومة الرقمية ℹ️</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        openProfileModal();
                      }}
                      className="flex w-full items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 cursor-pointer"
                    >
                      <UserIcon className="h-4 w-4" />
                      <span>تعديل البيانات الشخصية</span>
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 text-xs font-semibold text-red-500 hover:text-red-600 cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>تسجيل الخروج</span>
                    </button>
                    <div className="pt-2.5 mt-1 border-t border-slate-200 dark:border-slate-800 text-center">
                      <p className="text-[10px] font-black text-emerald-800 dark:text-emerald-300 leading-snug">
                        برمجة المفتش أمين سنوسي والأستاذ عمر حماني
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Content Viewport */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-[#0b0f1a] p-3 sm:p-4 md:p-6 transition-colors">
          {isImpersonatingTeacher && userProfile && (
            <div className="mb-4 rounded-2xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 via-yellow-50 to-indigo-50 p-3 sm:p-4 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in duration-150" dir="rtl">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs font-black">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-black bg-amber-200 text-amber-950 px-2 py-0.5 rounded-full border border-amber-300">
                      وضع الدخول بالنيابة ({originalUserProfile?.fullName || 'رئيس اللجنة التقنية'})
                    </span>
                    {impersonationScopedSportIds.length > 0 && (
                      <span className="text-[10px] font-black bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded-full border border-indigo-200">
                        الرياضة المسموحة: {impersonationScopedSportIds.map(id => SPORTS_MAP[id]?.name || id).join('، ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                    أنت تعمل الآن بصفة الأستاذ: <span className="text-indigo-800">{userProfile.fullName}</span>
                    {userProfile.workLocation ? (
                      <span className="text-slate-600 font-bold text-xs"> — المؤسسة: ({userProfile.workLocation})</span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-amber-900 font-medium">
                    جميع التعديلات أو الإضافات التي تجريها الآن ستُسجل رسمياً باسم هذا الأستاذ ومؤسسته ضمن رياضتك المسندة فقط.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  stopTeacherImpersonation();
                  toast.success('تمت العودة بنجاح إلى حسابك الأصلي');
                  navigate('/teachers');
                }}
                className="shrink-0 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
              >
                <RotateCw className="w-3.5 h-3.5 text-amber-300" />
                <span>العودة لحساب رئيس اللجنة التقنية</span>
              </button>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      {/* Mobile Directorate Selection Modal */}
      {isDirectorateMenuOpen && userProfile?.isSuperAdmin && (
        <div className="md:hidden fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150" dir="rtl">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] my-auto">
            <div className="px-4 py-3.5 bg-linear-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Building2 className="w-5 h-5 text-emerald-400 shrink-0" />
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
                        ? 'bg-emerald-50 text-emerald-900 border-2 border-emerald-600 shadow-xs'
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
                    className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-colors shadow-md shadow-emerald-600/20 cursor-pointer text-center active:scale-98"
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

      {/* ABOUT APPLICATION MODAL - DETAILED */}
      {isAboutModalOpen && (
        <div
          className="fixed inset-0 z-[140] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
          dir="rtl"
          onClick={() => setIsAboutModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-xl w-full max-h-[88vh] overflow-y-auto space-y-4 shadow-2xl animate-in zoom-in-95 duration-150 relative text-right"
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-amber-500" />

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 pt-1">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    حول المنظومة الرقمية للرياضة المدرسية 2026
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    الإصدار 1.4.0 — منصة التدبير الرياضي الموحد بالمديرية الإقليمية
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              {/* Overview & Objectives */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 space-y-1.5">
                <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-200">
                  🎯 أهداف المنظومة ورؤيتها الرقمية
                </h4>
                <p className="font-semibold text-slate-700 dark:text-slate-300 leading-relaxed">
                  منظومة رقمية متكاملة باللغة العربية مصممة لرقمنة تدبير البطولات المدرسية الإقليمية والجهوية والوطنية، وتسهيل التنسيق بين الإدارة الإقليمية واللجان التقنية وأطر التربية البدنية والحكام والمؤسسات التعليمية (العمومية والخصوصية) بشفافية وسرعة ودقة عالية.
                </p>
              </div>

              {/* Roles & Beneficiaries */}
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <h4 className="text-xs font-black text-slate-900 dark:text-white">
                  👥 الفئات المستفيدة وصلاحيات الأدوار
                </h4>
                <ul className="space-y-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 list-disc pr-4">
                  <li><strong>المسير المركزي / الإقليمي:</strong> الإشراف العام، إعداد المواسم والبطولات، تدبير المديريات، ضبط لائحة العطل وتواريخ الفروض، والاعتماد النهائي للنتائج.</li>
                  <li><strong>رؤساء اللجن التقنية الإقليمية:</strong> إجراء القرعة الإلكترونية، برمجة المقابلات وفق الرزنامة المحمية، وتعيين طاقم التحكيم وتدقيق النتائج.</li>
                  <li><strong>أساتذة ومنسقو التربية البدنية:</strong> تأكيد مشاركة المؤسسات، تسجيل التلاميذ، إصدار لوائح المشاركة والصدريات الذكية، وإدخال النتائج المؤقتة.</li>
                  <li><strong>الحكام المعتمدون والتلاميذ والجمهور:</strong> متابعة التعيينات التحكيمية، جدول المقابلات والترتيب، والشواهد والملصقات.</li>
                </ul>
              </div>

              {/* Key Features */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/70 space-y-2">
                <h4 className="text-xs font-black text-indigo-950 dark:text-indigo-200">
                  ⚙️ أهم المزايا والقدرات التقنية والتربوية
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-semibold">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60">
                    <span className="font-black text-indigo-900 dark:text-indigo-300 block">🏫 تغطية الأسلاك الأربعة</span>
                    <span className="text-slate-500 dark:text-slate-400">الابتدائي، الثانوي الإعدادي، التأهيلي، والتعليم الخصوصي بإحصائيات مستقلة.</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60">
                    <span className="font-black text-indigo-900 dark:text-indigo-300 block">🔀 القرعة الإلكترونية والبرمجة</span>
                    <span className="text-slate-500 dark:text-slate-400">سحب المجموعات والإقصاء المباشر مع الحماية من التعارض وتواريخ العطل والفروض.</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60">
                    <span className="font-black text-indigo-900 dark:text-indigo-300 block">🏷️ الصدريات الذكية QR والماسح</span>
                    <span className="text-slate-500 dark:text-slate-400">توليد صدريات العدو الريفي وألعاب القوى مع ماسح ضوئي لخط النهاية.</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60">
                    <span className="font-black text-indigo-900 dark:text-indigo-300 block">📩 التواصل وبث الواتساب</span>
                    <span className="text-slate-500 dark:text-slate-400">تراسل داخلي موجه + إشعار المعنيين الـ6 عبر الواتساب (Nouvelle diffusion).</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60">
                    <span className="font-black text-indigo-900 dark:text-indigo-300 block">✅ النتائج المؤقتة والاعتماد</span>
                    <span className="text-slate-500 dark:text-slate-400">مسك النتائج مؤقتاً ثم المصادقة الرسمية قبل النشر والترتيب العام.</span>
                  </div>
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-indigo-900/60">
                    <span className="font-black text-indigo-900 dark:text-indigo-300 block">📱 العمل أوفلاين والتصدير</span>
                    <span className="text-slate-500 dark:text-slate-400">تثبيت كتطبيق (PWA) ومزامنة سحابية وتصدير رسمي بصيغ PDF وExcel.</span>
                  </div>
                </div>
              </div>

              {/* Programming Attribution Box */}
              <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-center space-y-1">
                <p className="text-[10px] font-bold text-amber-800 dark:text-amber-300">
                  التصميم والتطوير والبرمجة التربوية والتقنية
                </p>
                <p className="text-sm font-black text-amber-950 dark:text-amber-100">
                  برمجة المفتش أمين سنوسي والأستاذ عمر حماني
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsAboutModalOpen(false)}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs cursor-pointer shadow-md shadow-emerald-600/20 text-center active:scale-98 transition-all"
              >
                إغلاق
              </button>
              <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 font-semibold">
                جميع الحقوق محفوظة &copy; 2026 — المنظومة الرقمية للرياضة المدرسية
              </p>
            </div>
          </div>
        </div>
      )}

      <TeacherProfileModal />
    </div>
  );
};


