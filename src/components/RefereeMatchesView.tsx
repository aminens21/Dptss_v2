import React, { useState, useMemo } from 'react';
import { Match, School, Venue, Tournament, User } from '../types';
import { SPORTS_MAP } from '../lib/dataService';
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

  // Helper to robustly match referee names (fuzziness, substring, clean prefix/parentheses)
  const isNameMatch = (nameInMatch: string, loggedInName: string) => {
    if (!nameInMatch || !loggedInName) return false;
    const n1 = nameInMatch.trim().toLowerCase();
    const n2 = loggedInName.trim().toLowerCase();
    
    if (n1 === n2) return true;
    
    // Check if one contains the other (e.g. "الحكم المعتمد (محمد العلوي)" contains "محمد العلوي")
    if (n2.includes(n1) || n1.includes(n2)) return true;
    
    // Clean up common prefixes/suffixes/parentheses
    const clean = (s: string) => s.replace(/[()]/g, '').replace('الحكم المعتمد', '').trim();
    const c1 = clean(n1);
    const c2 = clean(n2);
    
    if (c1 === c2 || c2.includes(c1) || c1.includes(c2)) return true;
    
    return false;
  };

  // Normalize name for matching
  const targetName = refereeName.trim().toLowerCase();

  // Filter matches assigned to this referee
  const refereeMatches = useMemo(() => {
    return matches.filter((m) => {
      if (!targetName) return false;

      // Match against referees array (names)
      if (Array.isArray(m.referees)) {
        const hasMatch = m.referees.some(
          (ref) => ref && isNameMatch(ref, targetName)
        );
        if (hasMatch) return true;
      }

      // Match against referee1Id / referee2Id (which sometimes store names)
      if (m.referee1Id && isNameMatch(m.referee1Id, targetName)) {
        return true;
      }
      if (m.referee2Id && isNameMatch(m.referee2Id, targetName)) {
        return true;
      }

      return false;
    });
  }, [matches, targetName]);

  // Apply search & status filters on the referee's matches
  const filteredMatches = useMemo(() => {
    return refereeMatches.filter((m) => {
      // Status filter
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t1 = schools.find((s) => s.id === m.team1Id)?.name || m.team1Id || '';
        const t2 = schools.find((s) => s.id === m.team2Id)?.name || m.team2Id || '';
        const venueName = venues.find((v) => v.id === m.venueId)?.name || '';
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

  const getSchoolName = (id: string) => {
    const s = schools.find((sch) => sch.id === id);
    return s ? s.name : id || 'غير محدد';
  };

  const getVenueName = (id: string) => {
    const v = venues.find((ven) => ven.id === id);
    return v ? v.name : id || 'ملعب غير محدد';
  };

  const getSportDetails = (sportId: string) => {
    return SPORTS_MAP[sportId] || { name: sportId || 'رياضة مدرسية', icon: '🏆' };
  };

  return (
    <div className="space-y-6 dir-rtl text-right">
      {/* Welcome Card & Referee Profile Summary */}
      <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white border border-slate-800 shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-linear-to-r from-amber-400 via-yellow-500 to-amber-600" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-xs text-3xl flex items-center justify-center border border-white/20 shadow-lg">
              🏁
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30">
                  لوحة تحكيم الحكم المعتمد
                </span>
                <span className="text-[10px] text-slate-300 font-bold">الموسم الحالي</span>
              </div>
              <h2 className="text-xl font-black text-white mt-1">
                الكابتن: {userProfile?.fullName || refereeName}
              </h2>
              <p className="text-xs text-slate-300 font-medium mt-1 leading-relaxed">
                مرحباً بك في فضائك الرقمي للتحكيم. يمكنك هنا متابعة جميع مبارياتك المبرمجة وتسجيل نتائجها مباشرة وبسرعة.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5 bg-white/5 border border-white/10 p-3.5 rounded-2xl md:self-auto self-stretch justify-around md:justify-end">
            <div className="text-center px-4 border-l border-white/10 last:border-0">
              <span className="text-[10px] text-slate-400 font-bold block">إجمالي مبارياتك</span>
              <span className="text-2xl font-black text-amber-400">{refereeMatches.length}</span>
            </div>
            <div className="text-center px-4 border-l border-white/10 last:border-0">
              <span className="text-[10px] text-slate-400 font-bold block">قيد الانتظار</span>
              <span className="text-2xl font-black text-blue-300">{scheduledCount}</span>
            </div>
            <div className="text-center px-4 border-l border-white/10 last:border-0">
              <span className="text-[10px] text-slate-400 font-bold block">منتهية</span>
              <span className="text-2xl font-black text-emerald-400">{completedCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            const t1Name = getSchoolName(m.team1Id);
            const t2Name = getSchoolName(m.team2Id);
            const venueName = getVenueName(m.venueId);

            const isCompleted = m.status === 'Completed';
            const isOngoing = m.status === 'Ongoing';

            const s1 = m.score1 ?? 0;
            const s2 = m.score2 ?? 0;
            const isT1Winner = isCompleted && s1 > s2;
            const isT2Winner = isCompleted && s2 > s1;

            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-3xs p-4 flex flex-col justify-between space-y-3.5 hover:shadow-xs hover:border-blue-200 transition-all duration-200 group"
              >
                {/* Header: Sport Icon, Name, Stage & Status */}
                <div className="flex items-center justify-between text-[11px] font-bold pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100/60 text-sm">
                      {sport.icon}
                    </span>
                    <div>
                      <span className="text-slate-800 font-extrabold text-[12px]">{sport.name}</span>
                      <span className="mx-1 text-slate-300">•</span>
                      <span className="text-slate-500 font-bold">{m.stage || 'دور المجموعات'}</span>
                    </div>
                  </div>

                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-black inline-flex items-center gap-1 border",
                      isOngoing
                        ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                        : isCompleted
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-150"
                    )}
                  >
                    {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
                    {isOngoing ? '🔴 جارية الآن' : isCompleted ? '🏆 منتهية' : '📅 مبرمجة'}
                  </span>
                </div>

                {/* Scoreboard Block */}
                <div className="py-3 px-3 bg-slate-50/60 rounded-xl border border-slate-100/80">
                  <div className="flex items-center justify-between">
                    {/* Team 1 hosting */}
                    <div className="w-[43%] flex items-center gap-1.5 min-w-0 justify-start text-right">
                      <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                        🏫
                      </span>
                      <span
                        className={cn(
                          "text-xs font-black text-slate-800 truncate leading-none",
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
                    <div className="w-[14%] flex flex-col items-center justify-center shrink-0">
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
                    <div className="w-[43%] flex items-center gap-1.5 min-w-0 justify-end text-left">
                      {isT2Winner && (
                        <Trophy className="w-3.5 h-3.5 text-amber-500 fill-amber-400 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-black text-slate-800 truncate leading-none",
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
                      <span className="truncate">
                        ⚽ الهدافون: <strong className="font-semibold text-slate-600">{m.scorers}</strong>
                      </span>
                    )}
                  </div>
                )}

                {/* Info Card: Venue, Date, Other Referees */}
                <div className="bg-slate-50/30 border border-slate-100/70 p-3 rounded-xl text-slate-600 space-y-1.5 text-[11px] font-medium">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate" title={venueName}>المكان: <strong className="font-bold text-slate-800">{venueName}</strong></span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>التاريخ: <strong className="font-bold text-slate-800">{formatMatchDate(m.date)}</strong></span>
                    {m.startTime && (
                      <>
                        <span className="text-slate-300">•</span>
                        <span>الساعة: <strong className="font-bold text-slate-800">{m.startTime}</strong></span>
                      </>
                    )}
                  </div>

                  {Array.isArray(m.referees) && m.referees.filter(r => r && r.trim().toLowerCase() !== targetName).length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100/60">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>الحكام المساعدون: <strong className="font-bold text-slate-700">{m.referees.filter(r => r && r.trim().toLowerCase() !== targetName).join(' ، ')}</strong></span>
                    </div>
                  )}
                </div>

                {/* Match Actions for Referee */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-bold">
                    طاقم التحكيم المعين لاسمك
                  </span>

                  <button
                    type="button"
                    onClick={() => onEditScore(m)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-3xs hover:shadow-xs transition-all cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>{isCompleted ? 'تعديل نتيجة المقابلة' : 'تسجيل وتثبيت النتيجة 📝'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
