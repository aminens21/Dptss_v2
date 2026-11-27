import React, { useState, useMemo, useEffect } from 'react';
import { Match, School, Venue, Tournament, User, Referee } from '../types';
import { DataService, SPORTS_MAP, normalizeArabicMatchText, canUserEnterMatchScore, isUserTechHeadForSport, isTeamSport } from '../lib/dataService';
import { formatTeamDisplayName, hasValidMatchTeams } from '../lib/drawTournamentUtils';
import { resolveMatchRefereesInfo, isOpaqueEntityId } from '../lib/programExportService';
import { AthleticsService } from '../lib/athleticsService';
import {
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Search,
  Filter,
  Award,
  Sparkles,
  Edit3,
  ShieldAlert,
  UserCheck,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { cn, formatMatchDate } from '../lib/utils';

interface RefereeMatchesViewProps {
  matches: Match[];
  schools: School[];
  venues: Venue[];
  tournaments: Tournament[];
  refereeName: string;
  userProfile: User | null;
  onEditScore: (match: Match) => void;
}

export const RefereeMatchesView: React.FC<RefereeMatchesViewProps> = ({
  matches,
  schools,
  venues,
  tournaments,
  refereeName,
  userProfile,
  onEditScore,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [refereesList, setRefereesList] = useState<Referee[]>([]);
  const [usersDirectory, setUsersDirectory] = useState<User[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadRefData = () => {
      Promise.all([
        DataService.getReferees().catch(() => [] as Referee[]),
        DataService.getUsers().catch(() => [] as User[])
      ]).then(([refs, users]) => {
        if (!mounted) return;
        setRefereesList(refs || []);
        setUsersDirectory(users || []);
      });
    };
    loadRefData();
    window.addEventListener('refereesUpdated', loadRefData);
    window.addEventListener('userDataChanged', loadRefData);
    return () => {
      mounted = false;
      window.removeEventListener('refereesUpdated', loadRefData);
      window.removeEventListener('userDataChanged', loadRefData);
    };
  }, []);

  const cleanRefString = (raw: string): string => {
    return normalizeArabicMatchText(
      String(raw || '')
        .replace(/الحكم المعتمد/gi, '')
        .replace(/حكم الأول|الحكم الأول|حكم أول/gi, '')
        .replace(/حكم الثاني|الحكم الثاني|حكم ثاني/gi, '')
        .replace(/حكم الساحة|حكام الساحة|حكم الطاولة|حكام الطاولة/gi, '')
        .replace(/\(?\s*أستاذ\s*\)?/gi, '')
        .replace(/[():\-–—،,.]/g, ' ')
        .trim()
    );
  };

  // Build all possible IDs and normalized name tokens identifying this teacher/referee
  const targetIdentity = useMemo(() => {
    const ids = new Set<string>();
    const names = new Set<string>();

    const addName = (val?: string) => {
      const cleaned = cleanRefString(val || '');
      if (cleaned && cleaned.length >= 2) {
        names.add(cleaned);
      }
    };

    if (userProfile?.id) ids.add(userProfile.id.trim().toLowerCase());
    addName(userProfile?.fullName);
    addName(refereeName);

    usersDirectory.forEach(u => {
      const matchesSameAccount =
        (userProfile?.id && u.id === userProfile.id) ||
        (userProfile?.email && u.email && u.email.trim().toLowerCase() === userProfile.email.trim().toLowerCase()) ||
        (userProfile?.leaseNumber && u.leaseNumber && u.leaseNumber.trim() === userProfile.leaseNumber.trim());
      if (matchesSameAccount) {
        if (u.id) ids.add(u.id.trim().toLowerCase());
        addName(u.fullName);
      }
    });

    refereesList.forEach(r => {
      const matchesUser =
        (userProfile?.id && (r.teacherId === userProfile.id || (r as any).userId === userProfile.id || r.id === userProfile.id)) ||
        (userProfile?.email && r.email && r.email.trim().toLowerCase() === userProfile.email.trim().toLowerCase()) ||
        (userProfile?.phone && r.phone && r.phone.replace(/\s+/g, '') === userProfile.phone.replace(/\s+/g, '')) ||
        Array.from(names).some(n => {
          const rNorm = cleanRefString(r.fullName || '');
          return rNorm && (rNorm === n || (rNorm.length >= 4 && n.length >= 4 && (rNorm.includes(n) || n.includes(rNorm))));
        });
      if (matchesUser) {
        if (r.id) ids.add(r.id.trim().toLowerCase());
        if (r.teacherId) ids.add(r.teacherId.trim().toLowerCase());
        addName(r.fullName);
      }
    });

    return {
      ids: Array.from(ids),
      names: Array.from(names)
    };
  }, [userProfile, refereeName, refereesList, usersDirectory]);

  const isEntryMatchingTarget = (entry?: string): boolean => {
    if (!entry) return false;
    const trimmedLower = entry.trim().toLowerCase();
    if (!trimmedLower) return false;

    if (targetIdentity.ids.includes(trimmedLower)) return true;

    const refRecord = refereesList.find(r => r.id && r.id.trim().toLowerCase() === trimmedLower);
    const cleaned = cleanRefString(refRecord ? refRecord.fullName : entry);
    if (!cleaned) return false;

    return targetIdentity.names.some(target => {
      if (cleaned === target) return true;
      if (cleaned.length >= 4 && target.length >= 4) {
        return cleaned.includes(target) || target.includes(cleaned);
      }
      return false;
    });
  };

  const targetName = refereeName.trim().toLowerCase();

  // Filter matches assigned to this referee across tableReferees, fieldReferees, referees, referee1Id, referee2Id
  const refereeMatches = useMemo(() => {
    return matches.filter((m) => {
      if (targetIdentity.names.length === 0 && targetIdentity.ids.length === 0) return false;
      if (!hasValidMatchTeams(m, schools)) return false;

      const allEntries: string[] = [
        ...(Array.isArray(m.fieldReferees) ? m.fieldReferees : []),
        ...(Array.isArray(m.tableReferees) ? m.tableReferees : []),
        ...(Array.isArray(m.referees) ? m.referees : []),
        ...(m.referee1Id ? [m.referee1Id] : []),
        ...(m.referee2Id ? [m.referee2Id] : [])
      ];

      return allEntries.some(entry => isEntryMatchingTarget(entry));
    });
  }, [matches, schools, targetIdentity, refereesList]);

  const getVenueName = (m: Match) => {
    const explicitName = (m.venueName || '').trim();
    if (explicitName && !isOpaqueEntityId(explicitName)) return explicitName;
    const v = venues.find((ven) => ven.id === m.venueId);
    if (v?.name) return v.name;
    const sch = schools.find((s) => s.id === (m.hostSchoolId || m.venueId) || s.id === m.venueId);
    if (sch?.name) return sch.name;
    if (m.venueId && !isOpaqueEntityId(m.venueId)) return m.venueId;
    return 'ملعب غير محدد';
  };

  // Apply search & status filters on the referee's matches
  const filteredMatches = useMemo(() => {
    return refereeMatches.filter((m) => {
      // Status filter
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t1 = formatTeamDisplayName(m.team1Id, m.team1Name, schools, m.team1Placeholder, m.team1SourceMatchNumber);
        const t2 = formatTeamDisplayName(m.team2Id, m.team2Name, schools, m.team2Placeholder, m.team2SourceMatchNumber);
        const venueName = getVenueName(m);
        const sportName = SPORTS_MAP[m.sportId]?.name || '';
        const stage = m.stage || '';
        const composite = `${t1} ${t2} ${venueName} ${sportName} ${stage}`.toLowerCase();
        if (!composite.includes(q)) return false;
      }

      return true;
    });
  }, [refereeMatches, statusFilter, searchQuery, schools, venues]);

  // Count matches by status
  const scheduledCount = refereeMatches.filter((m) => m.status === 'Scheduled').length;
  const ongoingCount = refereeMatches.filter((m) => m.status === 'Ongoing').length;
  const completedCount = refereeMatches.filter((m) => m.status === 'Completed').length;

  const getSchoolName = (id: string, fallbackName?: string, placeholder?: string, sourceNum?: number) => {
    return formatTeamDisplayName(id, fallbackName, schools, placeholder, sourceNum);
  };

  const getSportDetails = (sportId: string) => {
    return SPORTS_MAP[sportId] || { name: 'رياضة مدرسية', icon: '🏆' };
  };

  const athleticsAssignments = useMemo(() => {
    if (!userProfile) return [];
    try {
      return AthleticsService.getRefereeAthleticsAssignments(userProfile);
    } catch {
      return [];
    }
  }, [userProfile]);

  return (
    <div className="space-y-4 sm:space-y-6 dir-rtl text-right">
      {/* Athletics Committee Assignments (مهامي التحكيمية في ألعاب القوى) */}
      {athleticsAssignments.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-600/10 border border-amber-500/30 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-md">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
              🏃‍♂️
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-snug">
                مهامك وصفاتك التحكيمية الرسمية في بطولات ألعاب القوى المدرسية
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-600 dark:text-slate-400 font-medium mt-0.5">
                تم تعيينك رسمياً في اللجان التقنية والتحكيمية التالية لسباقات ألعاب القوى:
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mt-3">
            {athleticsAssignments.map((assign, idx) => (
              <div key={idx} className="bg-white dark:bg-slate-900 border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-black px-2.5 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
                    {assign.committeeTitle}
                  </span>
                  <span className="text-xl shrink-0">🥇</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">الصفة أو المهمة:</span>
                  <span className="text-xs font-black text-slate-900 dark:text-white block mt-0.5">
                    {assign.roleInCommittee}
                  </span>
                </div>
                {assign.permissions && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1">
                    {assign.permissions.canRecordResults && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                        ✅ تسجيل النتائج
                      </span>
                    )}
                    {assign.permissions.canValidateResults && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/80 dark:text-blue-300">
                        🛡️ اعتماد النتائج
                      </span>
                    )}
                    {assign.permissions.canPrintReports && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300">
                        🖨️ طباعة التقارير
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welcome Card & Referee Profile Summary */}
      <div className="p-4 sm:p-6 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-amber-400 via-yellow-500 to-amber-600" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-5 relative z-10">
          <div className="flex items-start sm:items-center gap-3 sm:gap-4">
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-white/10 backdrop-blur-xs text-2xl sm:text-3xl flex items-center justify-center border border-white/20 shadow-lg shrink-0">
              🏁
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  لوحة تحكيم الحكم المعتمد
                </span>
                <span className="text-[10px] text-slate-300 font-bold">الموسم الحالي</span>
              </div>
              <h2 className="text-base sm:text-xl font-black text-white mt-1 leading-snug">
                الكابتن: {userProfile?.fullName || refereeName}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                مرحباً بك في فضائك الرقمي للتحكيم. يمكنك هنا متابعة جميع مبارياتك المبرمجة وتفاصيل التحكيم والنتائج المسجلة.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-1 sm:gap-2.5 bg-white/5 border border-white/10 p-2.5 sm:p-3.5 rounded-2xl md:self-auto self-stretch">
            <div className="text-center px-2 sm:px-4 border-l border-white/10 last:border-0">
              <span className="text-[10px] text-slate-400 font-bold block">إجمالي مبارياتك</span>
              <span className="text-xl sm:text-2xl font-black text-amber-400">{refereeMatches.length}</span>
            </div>
            <div className="text-center px-2 sm:px-4 border-l border-white/10 last:border-0">
              <span className="text-[10px] text-slate-400 font-bold block">قيد الانتظار</span>
              <span className="text-xl sm:text-2xl font-black text-blue-300">{scheduledCount}</span>
            </div>
            <div className="text-center px-2 sm:px-4 border-l border-white/10 last:border-0">
              <span className="text-[10px] text-slate-400 font-bold block">منتهية</span>
              <span className="text-xl sm:text-2xl font-black text-emerald-400">{completedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-3xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-blue-700 uppercase block">المباريات المجدولة</span>
            <span className="text-2xl font-black text-slate-800 mt-1 block">{scheduledCount}</span>
            <span className="text-[10px] text-slate-400 font-medium">مقابلة مبرمجة لم تبدأ بعد</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-3xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-red-600 uppercase block">المباريات الجارية حالياً</span>
            <span className="text-2xl font-black text-red-600 mt-1 block">{ongoingCount}</span>
            <span className="text-[10px] text-slate-400 font-medium">مقابلات في طور اللعب والتحكيم</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center animate-pulse">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-3xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-extrabold text-emerald-700 uppercase block">النتائج المكتملة</span>
            <span className="text-2xl font-black text-emerald-700 mt-1 block">{completedCount}</span>
            <span className="text-[10px] text-slate-400 font-medium">مقابلات تم إدارة تحكيمها بنجاح</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث باسم المؤسسة المنافسة، القاعة، نوع الرياضة..."
            className="w-full pr-10 pl-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800"
          />
        </div>

        {/* Status Dropdown */}
        <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">حالة المباراة:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full md:w-48"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="Scheduled">📅 مبرمجة (مجدولة)</option>
            <option value="Ongoing">🔴 جارية الآن</option>
            <option value="Completed">🏆 مكتملة</option>
          </select>
        </div>
      </div>

      {/* Matches Grid List */}
      {filteredMatches.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-3xs space-y-3.5">
          <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto">
            <UserCheck className="w-8 h-8 text-slate-300" />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-800">لم يتم العثور على أي مباراة</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
              {refereeMatches.length === 0
                ? "لا توجد حالياً أي مباراة معينة لاسمك كحكم في قاعدة البيانات. سيقوم المنسقون والمسؤولون بتعيينك في المباريات القادمة لتظهر هنا."
                : "لا توجد مباريات تطابق معايير البحث والفلترة المحددة."}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredMatches.map((m) => {
            const sport = getSportDetails(m.sportId);
            const t1Name = getSchoolName(m.team1Id, m.team1Name, m.team1Placeholder, m.team1SourceMatchNumber);
            const t2Name = getSchoolName(m.team2Id, m.team2Name, m.team2Placeholder, m.team2SourceMatchNumber);
            const venueName = getVenueName(m);

            const isCompleted = m.status === 'Completed';
            const isOngoing = m.status === 'Ongoing';

            const s1 = m.score1 ?? 0;
            const s2 = m.score2 ?? 0;
            const isT1Winner = isCompleted && s1 > s2;
            const isT2Winner = isCompleted && s2 > s1;

            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-3xs p-3.5 sm:p-4 flex flex-col justify-between space-y-3 hover:shadow-xs hover:border-blue-200 transition-all duration-200 group"
              >
                {/* Header: Sport Icon, Name, Stage & Status */}
                <div className="flex items-start justify-between gap-2 text-[11px] font-bold pb-2.5 border-b border-slate-100">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100/60 text-sm shrink-0 mt-0.5">
                      {sport.icon}
                    </span>
                    <div className="min-w-0 leading-snug">
                      <span className="text-slate-800 font-extrabold text-[12px]">{sport.name}</span>
                      <span className="mx-1 text-slate-300">•</span>
                      <span className="text-slate-500 font-bold break-words">{m.stage || 'دور المجموعات'}</span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 border shrink-0 whitespace-nowrap",
                      isOngoing
                        ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                        : isCompleted && m.approvalStatus === 'provisional'
                        ? "bg-amber-50 text-amber-800 border-amber-300"
                        : isCompleted
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-150"
                    )}
                  >
                    {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
                    {isOngoing
                      ? '🔴 جارية الآن'
                      : isCompleted && m.approvalStatus === 'provisional'
                      ? '⏳ نتيجة أولية'
                      : isCompleted
                      ? '✅ نتيجة مصادق عليها'
                      : '📅 مبرمجة'}
                  </span>
                </div>

                {/* Scoreboard Block (wraps cleanly on mobile without truncating school names) */}
                <div className="py-2.5 px-2.5 sm:px-3 bg-slate-50/70 rounded-xl border border-slate-100/80">
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    {/* Team 1 hosting */}
                    <div className="flex items-center gap-1.5 min-w-0 justify-start text-right">
                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                        🏫
                      </span>
                      <span
                        className={cn(
                          "text-[11px] sm:text-xs font-black text-slate-800 leading-snug break-words",
                          isT1Winner && "text-blue-700"
                        )}
                        title={t1Name}
                      >
                        {t1Name}
                      </span>
                      {isT1Winner && (
                        <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                      )}
                    </div>

                    {/* Scores container */}
                    <div className="flex flex-col items-center justify-center shrink-0">
                      {isCompleted || isOngoing ? (
                        <div className="bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-3xs font-mono font-black text-xs text-slate-800 flex items-center gap-1">
                          <span className={cn(isT1Winner && "text-blue-600")}>{s1}</span>
                          <span className="text-slate-400 font-normal">:</span>
                          <span className={cn(isT2Winner && "text-blue-600")}>{s2}</span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">VS</span>
                      )}
                    </div>

                    {/* Team 2 guest */}
                    <div className="flex items-center gap-1.5 min-w-0 justify-end text-left">
                      {isT2Winner && (
                        <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-[11px] sm:text-xs font-black text-slate-800 leading-snug break-words",
                          isT2Winner && "text-blue-700"
                        )}
                        title={t2Name}
                      >
                        {t2Name}
                      </span>
                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                        🏫
                      </span>
                    </div>
                  </div>
                </div>

                {/* Score details (Scorers/Penalties) */}
                {(m.penalty1 !== undefined || m.penalty2 !== undefined || m.scorers) && (
                  <div className="text-[10px] text-slate-500 font-bold bg-amber-50/50 border border-amber-100/60 p-2 rounded-xl flex flex-col gap-0.5 text-center">
                    {(m.penalty1 !== undefined || m.penalty2 !== undefined) && (
                      <span className="text-amber-900 font-black">
                        🎯 ركلات الترجيح: ({m.penalty1 ?? 0} - {m.penalty2 ?? 0})
                      </span>
                    )}
                    {m.scorers && (
                      <span className="break-words leading-relaxed">
                        ⚽ الهدافون: <strong className="font-semibold text-slate-600">{m.scorers}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* Info Card: Venue, Date, Other Referees */}
                <div className="bg-slate-50/40 border border-slate-100/80 p-2.5 sm:p-3 rounded-xl text-slate-600 space-y-1.5 text-[11px] font-medium">
                  <div className="flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <span className="leading-snug break-words" title={venueName}>
                      المكان: <strong className="font-bold text-slate-800">{venueName}</strong>
                    </span>
                  </div>

                  <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>التاريخ: <strong className="font-bold text-slate-800">{formatMatchDate(m.date)}</strong></span>
                    {m.startTime && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>الساعة: <strong className="font-bold text-slate-800">{m.startTime}</strong></span>
                      </>
                    )}
                  </div>

                  {(() => {
                    const { fieldRefs, tableRefs, allRefs } = resolveMatchRefereesInfo(m, refereesList, usersDirectory);
                    const categorizedSet = new Set([...fieldRefs, ...tableRefs]);
                    const extraOtherRefs = allRefs.filter(name => !categorizedSet.has(name));
                    if (fieldRefs.length === 0 && tableRefs.length === 0 && extraOtherRefs.length === 0) return null;
                    return (
                      <div className="space-y-1.5 pt-1.5 border-t border-slate-100/60">
                        {fieldRefs.length > 0 && (
                          <div className="flex items-start gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black shrink-0">حكام الساحة</span>
                            <strong className="font-bold text-slate-700 leading-relaxed break-words">{fieldRefs.join(' • ')}</strong>
                          </div>
                        )}
                        {tableRefs.length > 0 && (
                          <div className="flex items-start gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-sky-100 text-sky-800 text-[10px] font-black shrink-0">حكام الطاولة</span>
                            <strong className="font-bold text-slate-700 leading-relaxed break-words">{tableRefs.join(' • ')}</strong>
                          </div>
                        )}
                        {extraOtherRefs.length > 0 && (
                          <div className="flex items-start gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[10px] font-black shrink-0">
                              {fieldRefs.length === 0 && tableRefs.length === 0 ? 'طاقم التحكيم' : 'حكام إضافيون'}
                            </span>
                            <strong className="font-bold text-slate-700 leading-relaxed break-words">{extraOtherRefs.join(' • ')}</strong>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Match Actions for Referee */}
                <div className="pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 font-bold">
                    {isCompleted && m.approvalStatus === 'approved'
                      ? `تمت المصادقة النهائية (${m.approvedByName || 'رئيس اللجنة'})`
                      : 'طاقم التحكيم المعين لاسمك'}
                  </span>

                  {(() => {
                    const canScore = canUserEnterMatchScore(userProfile, m, refereesList, usersDirectory);
                    const isTechHead = isUserTechHeadForSport(userProfile, m.sportId, usersDirectory);
                    const isTeam = isTeamSport(m.sportId || '');

                    if (isCompleted && m.approvalStatus === 'approved') {
                      return (
                        <span className="inline-flex items-center justify-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-black w-full sm:w-auto">
                          <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>نتيجة معتمدة رسمياً</span>
                        </span>
                      );
                    }

                    if (!canScore) {
                      return (
                        <span className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-[11px] font-bold w-full sm:w-auto text-center">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            {isTeam
                              ? 'تدوين النتيجة مقتصر على رئيس اللجنة التقنية المعنية'
                              : 'غير مصرح بتدوين النتيجة'}
                          </span>
                        </span>
                      );
                    }

                    return (
                      <button
                        type="button"
                        onClick={() => onEditScore(m)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-3xs hover:shadow-xs transition-all cursor-pointer w-full sm:w-auto whitespace-nowrap"
                      >
                        <Edit3 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {isTechHead
                            ? (isCompleted ? 'تعديل النتيجة' : 'تسجيل النتيجة')
                            : (isCompleted ? 'تعديل النتيجة الأولية' : 'تدوين النتيجة الأولية 📝')}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
