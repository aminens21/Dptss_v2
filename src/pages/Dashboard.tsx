import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { formatMatchDate, parseDateToTimestampMs } from '../lib/utils';
import { DataService, SPORTS_MAP, deduplicateById, normalizeCategoryKey, getCategoryShortName, getCustomCategoryName, isTeacherLevelAllowedForTournament, isSchoolSectorAllowedForTournament, schoolNamesMatch, resolveEffectiveTeacherCadre, findMatchingSchoolForTeacher } from '../lib/dataService';
import { extractMatchGroupLabel } from '../lib/drawTournamentUtils';
import { Match, Tournament, School, Venue, Referee, User } from '../types';
import {
  Trophy,
  CalendarDays,
  Users,
  CheckCircle2,
  Clock,
  MapPin,
  ArrowLeft,
  ChevronLeft,
  School as SchoolIcon,
  AlertCircle,
  BellRing,
  Activity,
  Plus,
  BarChart3,
  MessageSquare,
  ShieldCheck,
  QrCode
} from 'lucide-react';
import { CreateTournamentModal } from '../components/CreateTournamentModal';
import { DailyWhatsAppNotificationCenter } from '../components/DailyWhatsAppNotificationCenter';
import { FinishLineScannerModal } from '../components/FinishLineScannerModal';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { AppLogo } from '../components/AppLogo';
import { PermissionsModal } from '../components/PermissionsModal';
import toast from 'react-hot-toast';

export const Dashboard: React.FC = () => {
  const { userProfile, openProfileModal } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    tournaments: 0,
    matches: 0,
    schools: 0,
    completedMatches: 0
  });
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [teacherMatches, setTeacherMatches] = useState<Match[]>([]);
  const [selectedMatchSportFilter, setSelectedMatchSportFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [isTournamentModalOpen, setIsTournamentModalOpen] = useState(false);
  const [isFinishLineScannerOpen, setIsFinishLineScannerOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);

  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';
  const isRegionalManager = (userProfile?.role as any) === 'REGIONAL_MANAGER';
  const isSportManager = userProfile?.role === 'SPORT_MANAGER';
  const isTechCommitteeHead = userProfile?.isTechCommitteeHead === true;
  const isTeacher = userProfile?.role === 'TEACHER';
  const isReferee = userProfile?.role === 'REFEREE';

  // Only Central Admin, Regional Manager, Sport Manager, and Technical Committee Heads can view the WhatsApp Notification Center.
  // Ordinary teachers and referees will not see this window at all; they receive notifications via the bell.
  const canAccessWhatsAppNotificationCenter =
    isCentralAdmin || isRegionalManager || isSportManager || isTechCommitteeHead;

  useEffect(() => {
    loadDashboardData();
    const handleDirChange = () => {
      loadDashboardData();
    };

    const unsubscribeTournaments = DataService.subscribeToTournaments(() => {
      loadDashboardData();
    });

    const unsubscribeMatches = DataService.subscribeToMatches(() => {
      loadDashboardData();
    });

    const unsubscribeSchools = DataService.subscribeToSchools(() => {
      loadDashboardData();
    });

    const unsubscribeVenues = DataService.subscribeToVenues(() => {
      loadDashboardData();
    });

    const unsubscribeStudents = DataService.subscribeToStudents(() => {
      loadDashboardData();
    });

    const unsubscribeReferees = DataService.subscribeToReferees(() => {
      loadDashboardData();
    });

    const unsubscribeUsers = DataService.subscribeToUsers(() => {
      loadDashboardData();
    });

    const unsubscribeCC = DataService.subscribeCrossCountryResults(() => {
      loadDashboardData();
    });

    window.addEventListener('directorateChanged', handleDirChange);
    window.addEventListener('seasonChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
      window.removeEventListener('seasonChanged', handleDirChange);
      if (unsubscribeTournaments) unsubscribeTournaments();
      if (unsubscribeMatches) unsubscribeMatches();
      if (unsubscribeSchools) unsubscribeSchools();
      if (unsubscribeVenues) unsubscribeVenues();
      if (unsubscribeStudents) unsubscribeStudents();
      if (unsubscribeReferees) unsubscribeReferees();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeCC) unsubscribeCC();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [tList, mList, sList, vList, rList, uList] = await Promise.all([
        DataService.getTournaments(),
        DataService.getMatches(),
        DataService.getSchools(),
        DataService.getVenues(),
        DataService.getReferees(),
        DataService.getUsers()
      ]);

      const dirMatches = mList.filter(m => !activeDirId || activeDirId === 'all' || (m.directorateId || 'taourirt') === activeDirId || (!m.directorateId && activeDirId === 'taourirt'));
      const dirSchools = sList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      const dirVenues = vList.filter(v => (v.directorateId || 'taourirt') === activeDirId);
      const dirReferees = rList.filter(r => (r.directorateId || 'taourirt') === activeDirId);
      const dirTeachers = uList.filter(u => (u.directorateId || 'taourirt') === activeDirId);

      const completed = dirMatches.filter(m => m.status === 'Completed').length;

      const dirTournaments = tList.filter(t => (t.directorateId || 'taourirt') === activeDirId);

      setTournaments(dirTournaments);
      setMatches(dirMatches);
      setSchools(deduplicateById<School>(dirSchools));
      setVenues(dirVenues);
      setReferees(dirReferees);
      setTeachers(dirTeachers);

      setStats({
        tournaments: dirTournaments.length,
        matches: dirMatches.length,
        schools: dirSchools.length,
        completedMatches: completed
      });

      if (userProfile?.role === 'TEACHER' || userProfile?.role === 'REFEREE') {
        const myId = (userProfile.id || '').trim().toLowerCase();
        const myName = (userProfile.fullName || '').trim().toLowerCase();
        const myRefIds = new Set<string>(
          rList
            .filter(
              r =>
                (userProfile.id && (r.teacherId === userProfile.id || (r as any).userId === userProfile.id)) ||
                (userProfile.email && r.email && r.email.trim().toLowerCase() === userProfile.email.trim().toLowerCase()) ||
                (myName && (r.fullName || '').trim().toLowerCase() === myName)
            )
            .map(r => (r.id || '').trim().toLowerCase())
            .filter(Boolean)
        );
        if (myId) myRefIds.add(myId);

        const tMatches = mList
          .filter(m => {
            const entries = [
              ...(Array.isArray(m.fieldReferees) ? m.fieldReferees : []),
              ...(Array.isArray(m.tableReferees) ? m.tableReferees : []),
              ...(Array.isArray(m.referees) ? m.referees : []),
              ...(m.referee1Id ? [m.referee1Id] : []),
              ...(m.referee2Id ? [m.referee2Id] : [])
            ];
            return entries.some(entry => {
              const rawLower = (entry || '').trim().toLowerCase();
              if (!rawLower) return false;
              if (myRefIds.has(rawLower)) return true;
              const clean = rawLower
                .replace(/\(?\s*أستاذ\s*\)?/gi, '')
                .replace(/الحكم المعتمد/gi, '')
                .trim();
              return Boolean(myName && clean && (clean === myName || clean.includes(myName) || myName.includes(clean)));
            });
          })
          .filter(m => m.status !== 'Completed')
          .sort((a, b) => parseDateToTimestampMs(a.date) - parseDateToTimestampMs(b.date));
        setTeacherMatches(tMatches);
      }

    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (newTourns: Omit<Tournament, 'id'> | Omit<Tournament, 'id'>[]) => {
    try {
      const items = Array.isArray(newTourns) ? newTourns : [newTourns];
      if (items.length === 0) return;

      const targetSportId = items[0].sportId;
      const targetSeasonId = items[0].seasonId;
      const targetDirId = items[0].directorateId || DataService.getActiveDirectorateId();

      const latestTournaments = await DataService.getTournaments();
      const existingSportTournaments = latestTournaments.filter(t => 
        t.sportId === targetSportId && 
        (!t.seasonId || !targetSeasonId || t.seasonId === targetSeasonId) &&
        (!targetDirId || !t.directorateId || (t.directorateId || 'taourirt') === (targetDirId || 'taourirt'))
      );

      if (existingSportTournaments.length === 0) {
        for (const item of items) {
          await DataService.addTournament(item);
        }
      } else {
        const matchedExistingIds = new Set<string>();
        const itemToExistingIdMap = new Map<number, string>();

        items.forEach((item, idx) => {
          const exact = existingSportTournaments.find(existing => {
            if (matchedExistingIds.has(existing.id)) return false;
            return (
              normalizeCategoryKey(existing.ageCategory) === normalizeCategoryKey(item.ageCategory) &&
              existing.gender === item.gender &&
              (existing.affiliationType || 'non_club') === (item.affiliationType || 'non_club')
            );
          });
          if (exact) {
            matchedExistingIds.add(exact.id);
            itemToExistingIdMap.set(idx, exact.id);
          }
        });

        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];
          const existingId = itemToExistingIdMap.get(idx);

          if (existingId) {
            await DataService.updateTournament(existingId, {
              name: item.name,
              startDate: item.startDate,
              endDate: item.endDate,
              registrationDeadline: item.registrationDeadline,
              level: item.level,
              educationSectors: item.educationSectors,
              scope: item.scope,
              status: item.status,
              description: item.description,
              affiliationType: item.affiliationType,
              seasonId: item.seasonId,
              gender: item.gender,
              ageCategory: item.ageCategory,
              sportId: item.sportId,
              directorateId: item.directorateId
            });
          } else {
            await DataService.addTournament(item);
          }
        }

        const toDelete = existingSportTournaments.filter(existing => !matchedExistingIds.has(existing.id));
        for (const rem of toDelete) {
          await DataService.deleteTournament(rem.id);
        }
      }

      const newSelectedCats = Array.from(new Set(items.map(i => normalizeCategoryKey(i.ageCategory)).filter(Boolean)));

      await DataService.updateSportCategories(
        targetSportId, 
        newSelectedCats, 
        undefined, 
        undefined, 
        undefined, 
        undefined, 
        true
      );

      toast.success('تمت إضافة وتعديل إعدادات البطولة بنجاح!');
      loadDashboardData();
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء حفظ إعدادات البطولة');
    }
  };

  const teacherSchoolObj = useMemo(() => {
    return findMatchingSchoolForTeacher(schools, userProfile);
  }, [schools, userProfile]);

  const effectiveTeacherCadre = useMemo(() => {
    return resolveEffectiveTeacherCadre(userProfile, teacherSchoolObj);
  }, [userProfile, teacherSchoolObj]);

  const isPureTeacher = isTeacher && !isCentralAdmin && !isSportManager && !isTechCommitteeHead;

  const allowedTeacherTournaments = useMemo(() => {
    const active = tournaments.filter(t => t.status !== 'Draft' && (t as any).isActive !== false);
    if (!isPureTeacher) return active;
    return active.filter(t =>
      isTeacherLevelAllowedForTournament(effectiveTeacherCadre, t.level, t.ageCategory) &&
      (!teacherSchoolObj || isSchoolSectorAllowedForTournament(teacherSchoolObj, t))
    );
  }, [tournaments, isPureTeacher, effectiveTeacherCadre, teacherSchoolObj]);

  const filteredDashboardMatches = useMemo(() => {
    if (!isPureTeacher) return matches;
    return matches.filter(m => {
      if (m.tournamentId) {
        const explicitTourn = tournaments.find(t => t.id === m.tournamentId);
        if (explicitTourn) {
          return (
            isTeacherLevelAllowedForTournament(effectiveTeacherCadre, explicitTourn.level, explicitTourn.ageCategory) &&
            (!teacherSchoolObj || isSchoolSectorAllowedForTournament(teacherSchoolObj, explicitTourn))
          );
        }
      }
      const sportActiveTourns = tournaments.filter(
        t => t.sportId === m.sportId && t.status !== 'Draft' && (t as any).isActive !== false
      );
      if (sportActiveTourns.length > 0) {
        return allowedTeacherTournaments.some(t => t.sportId === m.sportId);
      }
      return true;
    });
  }, [matches, tournaments, allowedTeacherTournaments, isPureTeacher, effectiveTeacherCadre, teacherSchoolObj]);

  const effectiveStats = useMemo(() => {
    if (!isPureTeacher) return stats;
    return {
      tournaments: allowedTeacherTournaments.length,
      matches: filteredDashboardMatches.length,
      schools: 1,
      completedMatches: filteredDashboardMatches.filter(m => m.status === 'Completed').length
    };
  }, [stats, isPureTeacher, allowedTeacherTournaments.length, filteredDashboardMatches]);

  const availableMatchSports = useMemo(() => {
    const seen = new Set<string>();
    const list: string[] = [];
    filteredDashboardMatches.forEach(m => {
      if (m.sportId && !seen.has(m.sportId)) {
        seen.add(m.sportId);
        list.push(m.sportId);
      }
    });
    return list;
  }, [filteredDashboardMatches]);

  const visibleRecentMatches = useMemo(() => {
    const base = selectedMatchSportFilter === 'ALL'
      ? filteredDashboardMatches
      : filteredDashboardMatches.filter(m => m.sportId === selectedMatchSportFilter);
    return base.slice(0, 8);
  }, [filteredDashboardMatches, selectedMatchSportFilter]);

  useEffect(() => {
    if (selectedMatchSportFilter !== 'ALL' && !availableMatchSports.includes(selectedMatchSportFilter)) {
      setSelectedMatchSportFilter('ALL');
    }
  }, [availableMatchSports, selectedMatchSportFilter]);

  const formatDashboardMatchTitle = (m: Match, idx: number): string => {
    const sportIcon = SPORTS_MAP[m.sportId]?.icon || '🏆';
    const matchedTourn = m.tournamentId ? tournaments.find(t => t.id === m.tournamentId) : undefined;

    const rawStage = (m.stage || '').trim();
    const matchNumberFromStage = rawStage.match(/المباراة\s*(\d+)/)?.[1];
    const matchNum = m.drawMatchNumber || (matchNumberFromStage ? Number(matchNumberFromStage) : idx + 1);
    const matchNumLabel = `المباراة ${matchNum}`;

    const extractedGroup = extractMatchGroupLabel(m);
    const groupOrPath = extractedGroup || 'مسار الإقصاء المباشر';

    let stageClean = rawStage
      .replace(/(?:-\s*)?المجموعة\s+[^\s-–(]+(?:\s*\([^)]+\))?/g, '')
      .replace(/المباراة\s*(?:رقم\s*)?\d+/g, '')
      .replace(/\s*[-–—]+\s*/g, ' ')
      .trim();
    if (!stageClean) {
      stageClean = extractedGroup ? 'دور المجموعات' : 'مباراة إقليمية';
    }

    const catKey = m.ageCategory || m.category || matchedTourn?.ageCategory || '';
    const genderKey = m.gender || matchedTourn?.gender;
    const rawCatLabel = getCustomCategoryName(catKey, m.sportId) || getCategoryShortName(catKey, genderKey);
    const shortCatLabel = (rawCatLabel || '').replace(
      /^ال(?=صغار|صغيرات|فتيان|فتيات|براعم|برعمات|شبان|شابات)/,
      ''
    );

    const parts = [matchNumLabel, groupOrPath, stageClean, shortCatLabel].filter(Boolean);
    return `${sportIcon} ${parts.join(' - ')}`;
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Welcome Banner - Coordinated with Homepage Day Mode */}
      <div className="bg-linear-to-r from-indigo-900 via-slate-900 to-black rounded-3xl p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-indigo-500/20 relative overflow-hidden">
        <div className="absolute -left-10 -bottom-10 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="flex items-start gap-3.5 min-w-0 relative z-10">
          <AppLogo size={56} className="shrink-0 drop-shadow-md" />
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase">
                {isTeacher ? 'فضاء أستاذ التربية البدنية' : isSportManager ? 'فضاء مسؤول النشاط الرياضي' : 'لوحة الإدارة الإقليمية'}
              </span>
              <span className="text-indigo-200/70 text-xs font-bold">| الفرع الإقليمي للرياضة المدرسية</span>
            </div>
            <h2 className="text-base sm:text-lg md:text-xl font-black text-white">
              مرحباً بك، {userProfile?.fullName || (isTeacher ? 'الأستاذ' : isSportManager ? 'مسؤول النشاط' : 'المسير المركزي')} 👋
            </h2>
            <p className="text-xs text-indigo-100/80 mt-1 max-w-xl leading-relaxed">
              {isTeacher
                ? 'متابعة فورية للمقابلات المبرمجة، ملاعب وقاعات التباري، وجداول النتائج الرسمية المحينة أولاً بأول.'
                : isSportManager
                ? 'برمجة وإدارة مباريات البطولة، إضافة وتعديل المؤسسات والفرق المشاركة، وإدارة مراكز التباري.'
                : 'متابعة فورية للأنشطة والبطولات الرياضية المدرسية، تعيين لجان التحكيم، وبرمجة الإقصائيات الإقليمية.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap relative z-10">
          {/* Statistics button hidden as requested */}

          {isCentralAdmin ? (
            <button
              onClick={() => setIsTournamentModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة بطولة جديدة</span>
            </button>
          ) : isSportManager ? (
            <button
              onClick={() => navigate('/matches')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>برمجة مباراة جديدة</span>
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openProfileModal}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-98 transition-all cursor-pointer shrink-0"
                title="تعديل البيانات الشخصية والمؤسسة ورقم التأجير"
              >
                <span>👤</span>
                <span>تعديل بياناتي</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/matches')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-indigo-500/20 active:scale-98 transition-all cursor-pointer shrink-0"
              >
                <CalendarDays className="h-4 w-4" />
                <span>استعراض جدول المقابلات</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PWA Mobile App Installation Banner hidden as requested */}

      {/* Teacher Profile Incomplete Banner (Gentle Non-blocking notice) */}
      {isTeacher && (!userProfile?.workLocation || !userProfile?.leaseNumber) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-black text-amber-950">بيانات الأستاذ(ة) والمؤسسة غير مكتملة</h4>
              <p className="text-[11px] text-amber-800 mt-0.5">
                يرجى استكمال مقر العمل ورقم التأجير لتسهيل التواصل والتعيين في لجان التحكيم.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={openProfileModal}
            className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-xs cursor-pointer shrink-0 text-center"
          >
            استكمال الملف الشخصي ✍️
          </button>
        </div>
      )}

      {/* Daily WhatsApp Notification Center - Only for authorized roles */}
      {canAccessWhatsAppNotificationCenter && (
        <DailyWhatsAppNotificationCenter
          matches={matches}
          schools={schools}
          tournaments={tournaments}
          venues={venues}
          referees={referees}
          teachers={teachers}
          onRefresh={loadDashboardData}
        />
      )}

      {/* High Density 4-Column Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1 */}
        <div
          onClick={() => navigate('/tournaments')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all cursor-pointer"
        >
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">
            {userProfile?.role === 'TEACHER' ? 'البطولات المفعلة' : 'إجمالي البطولات'}
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {effectiveStats.tournaments}
            </h3>
            <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              عرض البطولات ←
            </span>
          </div>
        </div>

        {/* Card 2 */}
        <div
          onClick={() => navigate('/matches')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm transition-all cursor-pointer"
        >
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">المباريات المبرمجة</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {effectiveStats.matches}
            </h3>
            <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
              برنامج المباريات ←
            </span>
          </div>
        </div>

        {/* Card 3 */}
        <div
          onClick={() => navigate('/schools')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-sm transition-all cursor-pointer"
        >
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">
            {userProfile?.role === 'TEACHER' ? 'مؤسستي التعليمية' : 'المؤسسات المشاركة'}
          </p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {effectiveStats.schools}
            </h3>
            <span className="text-slate-700 dark:text-slate-300 text-[10px] font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
              {userProfile?.role === 'TEACHER' ? 'مؤسستي' : 'دليل المؤسسات'}
            </span>
          </div>
        </div>

        {/* Card 4 */}
        <div
          onClick={() => navigate('/statistics')}
          className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs hover:border-amber-300 dark:hover:border-amber-700 hover:shadow-sm transition-all cursor-pointer"
        >
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider mb-1">المباريات المنجزة والإحصائيات</p>
          <div className="flex items-end justify-between">
            <h3 className="text-2xl font-black text-slate-800 dark:text-white tracking-tight">
              {effectiveStats.completedMatches}
            </h3>
            <span className="text-amber-800 dark:text-amber-300 text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">
              النتائج والترتيب 🏆
            </span>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Matches Section */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Teacher Refereeing Matches */}
          {isTeacher && teacherMatches.length > 0 && (
            <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-emerald-50/60 dark:bg-emerald-950/30">
                <h4 className="text-xs md:text-sm font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <span className="text-xl">哨</span>
                  <span>المباريات التي تم تعييني كحكم فيها</span>
                </h4>
              </div>
              <div className="flex-1 p-4 space-y-3">
                {teacherMatches.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => navigate('/matches')}
                    className="flex items-center gap-3 p-3 border border-emerald-100 dark:border-emerald-900/40 rounded-xl hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-all cursor-pointer bg-emerald-50/20 dark:bg-emerald-950/10"
                  >
                    <div className="w-20 text-center border-l border-emerald-100 dark:border-emerald-900/50 pl-2">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-0.5">{formatMatchDate(m.date)}</p>
                      <p className="text-sm font-black text-emerald-700 dark:text-emerald-400">{m.startTime}</p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold mt-0.5">
                        {m.status === 'Ongoing' ? 'جارية الآن' : 'في الانتظار'}
                      </p>
                    </div>
                    <div className="flex-1 flex flex-col px-2 gap-1.5">
                      <span className="font-bold text-sm text-slate-800 dark:text-white">
                        {m.stage || 'مباراة'}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        <span>يوم: {formatMatchDate(m.date)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 space-y-2.5 sm:space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white flex items-center gap-1.5 sm:gap-2 min-w-0">
                  <CalendarDays className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">أحدث المباريات والبرمجة الإقليمية</span>
                </h4>
                <button
                  onClick={() => navigate('/matches')}
                  className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 text-[11px] sm:text-xs font-bold hover:underline flex items-center gap-0.5 sm:gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <span>البرنامج الكامل</span>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </div>

              {filteredDashboardMatches.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMatchSportFilter('ALL')}
                    className={`px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer tabular-nums ${
                      selectedMatchSportFilter === 'ALL'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    الكل ({filteredDashboardMatches.length})
                  </button>
                  {availableMatchSports.map(sportId => {
                    const sportMeta = SPORTS_MAP[sportId];
                    const isActive = selectedMatchSportFilter === sportId;
                    return (
                      <button
                        key={sportId}
                        type="button"
                        onClick={() => setSelectedMatchSportFilter(sportId)}
                        title={sportMeta?.name || sportId}
                        aria-label={sportMeta?.name || sportId}
                        className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-sm sm:text-base leading-none transition-all cursor-pointer border ${
                          isActive
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-800 shadow-xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {sportMeta?.icon || '🏆'}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex-1 p-2.5 sm:p-4 space-y-2.5 sm:space-y-3">
              {visibleRecentMatches.length === 0 ? (
                <div className="text-center py-8 text-xs font-bold text-slate-400">
                  لا توجد مباريات مبرمجة حالياً ضمن هذا النطاق.
                </div>
              ) : (
                visibleRecentMatches.map((m, idx) => {
                  const isFinished = m.status === 'Completed';
                  const scoreLeft = m.score1 ?? m.scoreA ?? 0;
                  const scoreRight = m.score2 ?? m.scoreB ?? 0;
                  return (
                    <div
                      key={m.id}
                      onClick={() => navigate('/matches')}
                      className={`flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3.5 border rounded-2xl transition-all cursor-pointer ${
                        isFinished
                          ? 'border-emerald-300 bg-emerald-50/40 hover:bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/20'
                          : 'border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50/20 dark:hover:bg-emerald-950/20'
                      }`}
                    >
                      <div className="w-[64px] sm:w-24 text-center border-l border-slate-100 dark:border-slate-800 pl-2 sm:pl-2.5 shrink-0">
                        <p className="text-[9.5px] sm:text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 tabular-nums whitespace-nowrap">
                          {formatMatchDate(m.date)}
                        </p>
                        <p className="text-[11px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {m.startTime || '10:00'}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium mt-0.5">
                          {m.status === 'Completed' ? 'انتهت' : m.status === 'Ongoing' ? 'مباشر' : 'مبرمجة'}
                        </p>
                      </div>
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 sm:gap-3 px-0.5 sm:px-1 min-w-0">
                        <span className="font-bold text-[10.5px] sm:text-xs md:text-sm leading-relaxed text-slate-800 dark:text-slate-100 break-words">
                          {formatDashboardMatchTitle(m, idx)}
                        </span>
                        <div
                          className={`self-end sm:self-auto font-black text-[10px] sm:text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border shrink-0 tabular-nums whitespace-nowrap ${
                            isFinished
                              ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-700'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {isFinished ? `${scoreLeft} - ${scoreRight}` : 'مقابلة مبرمجة'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Side Panel: Quick Actions & Alerts */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h4 className="text-xs font-black text-slate-800 dark:text-white mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span>{userProfile?.role === 'TEACHER' ? 'روابط سريعة للأستاذ' : 'إجراءات سريعة للمسير'}</span>
            </h4>
            <div className="space-y-2">
              {isTeacher && (
                <button
                  onClick={openProfileModal}
                  className="w-full text-right p-2.5 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border border-emerald-200/80"
                >
                  <span className="flex items-center gap-1.5">
                    <span>👤</span>
                    <span>تعديل بياناتي وصورتي وتخصصات التحكيم</span>
                  </span>
                  <span>←</span>
                </button>
              )}
              {isCentralAdmin && (
                <button
                  onClick={() => setIsTournamentModalOpen(true)}
                  className="w-full text-right p-2.5 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border border-emerald-200/80"
                >
                  <span>➕ برمجة بطولة إقليمية جديدة</span>
                  <span>←</span>
                </button>
              )}
              <button
                onClick={() => navigate('/statistics')}
                className="w-full text-right p-2.5 bg-amber-50 hover:bg-amber-100/90 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border border-amber-200/80"
              >
                <span>📊 إحصائيات وترتيب المؤسسات</span>
                <span>←</span>
              </button>
              <button
                onClick={() => navigate('/matches')}
                className="w-full text-right p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border border-slate-200"
              >
                <span>📅 جدول المقابلات والنتائج</span>
                <span>←</span>
              </button>
              <button
                onClick={() => navigate('/tournaments')}
                className="w-full text-right p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border border-slate-200"
              >
                <span>🏆 البطولات الإقليمية المبرمجة</span>
                <span>←</span>
              </button>
              <button
                onClick={() => navigate('/schools')}
                className="w-full text-right p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer border border-slate-200"
              >
                <span>🏫 المؤسسات والفرق المشاركة</span>
                <span>←</span>
              </button>
            </div>
          </div>

          {canAccessWhatsAppNotificationCenter && (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 p-4 rounded-xl border border-emerald-100 text-slate-700 text-xs">
              <h5 className="font-bold text-emerald-900 mb-1 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>تذكير الواتساب التلقائي</span>
              </h5>
              <p className="text-[11px] text-emerald-800/90 leading-relaxed">
                يمكنك بضغطة زر واحدة إرسال تفاصيل المباراة وموعد الحضور مباشرة إلى واتساب الحكام والمؤطرين ومدراء المؤسسات.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateTournamentModal
        isOpen={isTournamentModalOpen}
        onClose={() => setIsTournamentModalOpen(false)}
        onCreated={handleCreateTournament}
      />

      {isFinishLineScannerOpen && (
        <FinishLineScannerModal
          isOpen={isFinishLineScannerOpen}
          onClose={() => setIsFinishLineScannerOpen(false)}
          onResultsUpdated={loadDashboardData}
        />
      )}

      <PermissionsModal
        isOpen={isPermissionsModalOpen}
        onClose={() => setIsPermissionsModalOpen(false)}
      />
    </div>
  );
};

