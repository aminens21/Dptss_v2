import React, { useState, useMemo, useEffect } from 'react';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { Match, School, Venue, CrossCountryCategoryResult, AthleticsCategoryResult, Student, Directorate, Sport, Tournament } from '../types';
import { CROSS_COUNTRY_CATEGORIES } from '../lib/crossCountryConfig';
import { MapPin, Trophy, Goal, Users, Award, Calendar, ChevronDown, X, Medal, Sparkles, Filter, Activity, Building2, Search, CheckCircle2, Clock } from 'lucide-react';
import { cn, formatMatchDate } from '../lib/utils';
import toast from 'react-hot-toast';

export const PublicResults: React.FC = () => {
  const [selectedSportId, setSelectedSportId] = useState<string>('ALL');
  const [matches, setMatches] = useState<Match[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [ccResults, setCcResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [athResults, setAthResults] = useState<Record<string, AthleticsCategoryResult>>({});
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [selectedDirId, setSelectedDirId] = useState<string>(DataService.getActiveDirectorateId() || 'taourirt');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Completed' | 'Ongoing' | 'Scheduled'>('ALL');

  // Filters for Cross Country
  const [ccAffiliation, setCcAffiliation] = useState<'CLUB' | 'NON_CLUB'>('NON_CLUB');

  const loadData = async (dirId?: string) => {
    setLoading(true);
    const effectiveDirId = dirId || selectedDirId;
    try {
      const [dirs, m, t, sports, s, v, stds, ccr, ath] = await Promise.all([
        DataService.getDirectorates(),
        DataService.getMatches(effectiveDirId),
        DataService.getTournaments(effectiveDirId),
        DataService.getSportsConfig(),
        DataService.getSchools(effectiveDirId),
        DataService.getVenues(),
        DataService.getStudents(effectiveDirId),
        DataService.getCrossCountryResults(effectiveDirId),
        DataService.getAthleticsResults(effectiveDirId)
      ]);
      setDirectorates(dirs);
      setMatches(m);
      setTournaments(t);
      setSportsConfig(sports);
      setSchools(s);
      setVenues(v);
      setStudents(stds);
      setCcResults(ccr);
      setAthResults(ath);
    } catch (err) {
      console.error("Error loading public data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDirectorateChange = async (newDirId: string) => {
    setSelectedDirId(newDirId);
    DataService.setActiveDirectorateId(newDirId);
    await loadData(newDirId);
    const dirObj = directorates.find(d => d.id === newDirId);
    toast.success(`تم التبديل لعرض نتائج: ${dirObj?.name || newDirId}`);
  };

  const getSchoolName = (id: string) => schools.find(sch => sch.id === id)?.name || id;
  const getVenueName = (id: string) => venues.find(ven => ven.id === id)?.name || id;

  const getMatchSport = (m: Match): { id: string; name: string; icon: string } => {
    if (m.sportId) {
      const sConf = sportsConfig.find(s => s.id === m.sportId);
      if (sConf) return { id: sConf.id, name: sConf.name, icon: sConf.icon || '⚽' };
      if (SPORTS_MAP[m.sportId]) return { id: m.sportId, name: SPORTS_MAP[m.sportId].name, icon: SPORTS_MAP[m.sportId].icon || '⚽' };
    }
    if (m.tournamentId) {
      const t = tournaments.find(tourn => tourn.id === m.tournamentId);
      if (t?.sportId) {
        const sConf = sportsConfig.find(s => s.id === t.sportId);
        if (sConf) return { id: sConf.id, name: sConf.name, icon: sConf.icon || '⚽' };
        if (SPORTS_MAP[t.sportId]) return { id: t.sportId, name: SPORTS_MAP[t.sportId].name, icon: SPORTS_MAP[t.sportId].icon || '⚽' };
      }
    }
    return { id: 'football', name: 'كرة القدم', icon: '⚽' };
  };

  // Build the sports list for the horizontal filter bar
  const availableSportsList = useMemo(() => {
    const list: { id: string; name: string; icon: string }[] = [
      { id: 'ALL', name: 'جميع الرياضات', icon: '🏆' },
      { id: 'cross_country', name: 'العدو الريفي', icon: '🏃‍♂️' },
      { id: 'athletics', name: 'ألعاب القوى', icon: '🥇' }
    ];

    sportsConfig.forEach(sp => {
      if (sp.id !== 'cross_country' && sp.id !== 'athletics') {
        list.push({
          id: sp.id,
          name: sp.name,
          icon: sp.icon || SPORTS_MAP[sp.id]?.icon || '⚽'
        });
      }
    });

    return list;
  }, [sportsConfig]);

  // Matches sorting and filtering
  const filteredMatches = useMemo(() => {
    return matches
      .filter(m => {
        // Sport filter
        if (selectedSportId !== 'ALL') {
          const matchSport = getMatchSport(m);
          if (matchSport.id !== selectedSportId) return false;
        }

        // Status filter
        if (statusFilter !== 'ALL') {
          const s = (m.status || '').toLowerCase();
          if (statusFilter === 'Completed' && s !== 'completed') return false;
          if (statusFilter === 'Ongoing' && s !== 'ongoing') return false;
          if (statusFilter === 'Scheduled' && s !== 'scheduled' && s !== 'draft') return false;
        }

        // Search query filter
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const team1 = getSchoolName(m.team1Id).toLowerCase();
          const team2 = getSchoolName(m.team2Id).toLowerCase();
          const venue = getVenueName(m.venueId).toLowerCase();
          const stage = (m.stage || '').toLowerCase();
          const sp = getMatchSport(m).name.toLowerCase();
          return team1.includes(q) || team2.includes(q) || venue.includes(q) || stage.includes(q) || sp.includes(q);
        }

        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [matches, selectedSportId, statusFilter, searchQuery, sportsConfig, tournaments, schools, venues]);

  // Match statistics
  const stats = useMemo(() => {
    const completed = matches.filter(m => m.status?.toLowerCase() === 'completed' || m.status?.toLowerCase() === 'ongoing' || m.score1 !== undefined || m.score2 !== undefined || m.team1Score !== undefined || m.team2Score !== undefined);
    const totalGoals = completed.reduce((sum, m) => sum + (m.score1 ?? m.team1Score ?? 0) + (m.score2 ?? m.team2Score ?? 0), 0);
    const completedCount = matches.filter(m => m.status?.toLowerCase() === 'completed').length;
    const ongoingCount = matches.filter(m => m.status?.toLowerCase() === 'ongoing').length;
    const scheduledCount = matches.filter(m => m.status?.toLowerCase() === 'scheduled' || !m.status).length;
    return { totalGoals, completedCount, ongoingCount, scheduledCount, totalMatches: matches.length };
  }, [matches]);

  // Cross Country List Processing
  const crossCountryList = useMemo(() => {
    return CROSS_COUNTRY_CATEGORIES.map(cat => {
      const key = ccAffiliation === 'CLUB' ? `${cat.id}_club` : cat.id;
      const res = ccResults[key];
      if (!res || !res.podium || res.podium.length === 0) return null;
      return {
        ...res,
        categoryName: cat.titleAr,
        key
      };
    }).filter(Boolean) as (CrossCountryCategoryResult & { categoryName: string; key: string })[];
  }, [ccResults, ccAffiliation]);

  // Athletics List Processing
  const athleticsList = useMemo(() => {
    return (Object.values(athResults) as AthleticsCategoryResult[]).filter(res => res && res.podium && res.podium.length > 0);
  }, [athResults]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 dir-rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-bold">جاري تحميل النتائج الرسمية...</p>
        </div>
      </div>
    );
  }

  const showCrossCountry = selectedSportId === 'ALL' || selectedSportId === 'cross_country';
  const showAthletics = selectedSportId === 'ALL' || selectedSportId === 'athletics';
  const showMatches = selectedSportId === 'ALL' || (selectedSportId !== 'cross_country' && selectedSportId !== 'athletics');

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 dir-rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200 text-xs font-black shadow-3xs mb-1">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>المنصة الرسمية للنتائج المدرسية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900">
            نتائج ومباريات البطولات الرياضية المدرسية
          </h1>
          <p className="text-slate-500 font-bold text-xs sm:text-sm">
            استعراض النتائج المعتمدة، منصات التتويج، وبرمجة المباريات الرياضية الإقليمية
          </p>
          
          {/* Directorate Selector */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-2xl shadow-3xs">
              <Building2 className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-bold text-slate-600">المديرية الإقليمية:</span>
              <select
                value={selectedDirId}
                onChange={(e) => handleDirectorateChange(e.target.value)}
                className="text-xs font-black text-slate-900 bg-transparent focus:outline-none cursor-pointer"
              >
                {directorates.map(dir => (
                  <option key={dir.id} value={dir.id}>
                    {dir.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Global Statistics Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase">إجمالي المقابلات</span>
              <Calendar className="h-4.5 w-4.5 text-blue-600" />
            </div>
            <p className="text-2xl font-black text-slate-900 mt-1">{stats.totalMatches}</p>
            <span className="text-[10px] text-slate-400 font-bold">مباراة بالبطولة</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-emerald-700 uppercase">النتائج المسجلة</span>
              <Award className="h-4.5 w-4.5 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-700 mt-1">{stats.completedCount}</p>
            <span className="text-[10px] text-emerald-600/80 font-bold">مباراة منتهية</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-red-600 uppercase">مباشر جارية الآن</span>
              <Clock className="h-4.5 w-4.5 text-red-600 animate-pulse" />
            </div>
            <p className="text-2xl font-black text-red-600 mt-1">{stats.ongoingCount}</p>
            <span className="text-[10px] text-red-600/80 font-bold">مباراة جارية</span>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-indigo-700 uppercase">الأهداف والنقاط</span>
              <Goal className="h-4.5 w-4.5 text-indigo-600" />
            </div>
            <p className="text-2xl font-black text-indigo-700 mt-1">{stats.totalGoals}</p>
            <span className="text-[10px] text-indigo-600/80 font-bold">مجموع الأهداف المسجلة</span>
          </div>
        </div>

        {/* SPORTS FILTER BAR - Horizontal Pill Navigation */}
        <div className="bg-white p-2.5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between px-2 pb-1 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800">
              <Filter className="w-3.5 h-3.5 text-emerald-600" />
              <span>تصفية النتائج حسب الرياضة:</span>
            </div>
            <span className="text-[11px] font-bold text-slate-400">
              {availableSportsList.length} رياضة متاحة
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 no-scrollbar scroll-smooth">
            {availableSportsList.map(sport => {
              const isSelected = selectedSportId === sport.id;
              return (
                <button
                  key={sport.id}
                  onClick={() => setSelectedSportId(sport.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black transition-all cursor-pointer shrink-0 border",
                    isSelected
                      ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  <span className="text-sm">{sport.icon}</span>
                  <span>{sport.name}</span>
                </button>
              );
            })}
          </div>

          {/* Search and Status filter bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 border-t border-slate-100">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث باسم المؤسسة، القاعة/الملعب، الدور، أو الرياضة..."
                className="w-full pr-9 pl-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {showMatches && (
              <div className="flex items-center gap-1 w-full sm:w-auto shrink-0">
                {(['ALL', 'Completed', 'Ongoing', 'Scheduled'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "flex-1 sm:flex-initial px-2.5 py-1.5 text-[11px] font-bold rounded-xl border transition-all cursor-pointer",
                      statusFilter === st
                        ? "bg-emerald-600 text-white border-emerald-600 font-black shadow-xs"
                        : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                    )}
                  >
                    {st === 'ALL' ? 'الكل' : st === 'Completed' ? '🏆 منتهية' : st === 'Ongoing' ? '🔴 مباشرة' : '📅 مبرمجة'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RESULTS SECTIONS */}

        {/* 1. CROSS COUNTRY PODIUMS */}
        {showCrossCountry && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-amber-50 to-orange-50 p-4 rounded-3xl border border-amber-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-sm">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-amber-950">
                    نتائج ومنصات تتويج بطولة العدو الريفي
                  </h2>
                  <p className="text-xs text-amber-800 font-bold">
                    النتائج المعتمدة لجميع الفئات العمرية والمسافات
                  </p>
                </div>
              </div>

              {/* Affiliation Switcher */}
              <div className="flex items-center gap-1.5 bg-white p-1 rounded-2xl border border-amber-200 shadow-3xs">
                <button 
                  onClick={() => setCcAffiliation('NON_CLUB')}
                  className={cn("px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer", ccAffiliation === 'NON_CLUB' ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50")}
                >
                  ⚪ مدرسي (غير منتمي)
                </button>
                <button 
                  onClick={() => setCcAffiliation('CLUB')}
                  className={cn("px-3 py-1.5 rounded-xl text-[11px] font-black transition-all cursor-pointer", ccAffiliation === 'CLUB' ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:bg-slate-50")}
                >
                  🟡 المنتمين للأندية
                </button>
              </div>
            </div>

            {crossCountryList.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs">
                <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-bold text-xs">لا توجد نتائج مسجلة للعدو الريفي في هذا الفرع حالياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {crossCountryList.map(cat => (
                  <div key={cat.key} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                      <div className="p-2 bg-amber-500 text-white rounded-xl shadow-xs">
                        <Trophy className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-base font-black text-slate-900">{cat.categoryName}</h3>
                        <p className="text-[11px] text-slate-500 font-bold">منصة التتويج الرسمية • المسافة: {cat.distance}</p>
                      </div>
                    </div>

                    {/* Podium Display */}
                    <div className="grid grid-cols-3 gap-2 items-end max-w-xl mx-auto pt-6 pb-2">
                      {[
                        { rank: 2 as const, winner: cat.podium?.find(p => p.rank === 2) || null },
                        { rank: 1 as const, winner: cat.podium?.find(p => p.rank === 1) || null },
                        { rank: 3 as const, winner: cat.podium?.find(p => p.rank === 3) || null }
                      ].map(({ rank, winner }) => {
                        const isGold = rank === 1;
                        const isSilver = rank === 2;
                        const medalBg = isGold ? 'from-amber-400 to-amber-600' : isSilver ? 'from-slate-200 to-slate-400' : 'from-amber-700 to-amber-900';
                        const stepH = isGold ? 'h-20 sm:h-24 bg-amber-500' : isSilver ? 'h-14 sm:h-18 bg-slate-400' : 'h-10 sm:h-12 bg-amber-800';

                        const matchedStd = students.find(s => winner?.studentId && s.id === winner.studentId);
                        const photo = winner?.photoUrl || matchedStd?.photoUrl;

                        return (
                          <div key={rank} className={cn("flex flex-col items-center justify-end w-full", isGold ? "z-10 -translate-y-3" : "z-0")}>
                            <div className="relative -mb-4 z-10">
                              <div className={cn("w-12 h-12 sm:w-14 sm:h-14 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden bg-gradient-to-b relative hover:scale-125 transition-transform duration-200 cursor-pointer", medalBg)}>
                                {photo ? (
                                  <img 
                                    src={photo} 
                                    alt={winner?.fullName} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <div className="w-full h-full bg-slate-100/20" />
                                )}
                              </div>
                            </div>
                            <div className={cn("w-full pt-6 pb-2 px-1.5 rounded-xl text-center shadow-3xs flex flex-col items-center min-h-[120px] sm:min-h-[140px]", isGold ? "bg-amber-50 border-2 border-amber-300" : "bg-slate-50 border border-slate-200")}>
                               {winner ? (
                                 <>
                                   <h4 className="text-[10px] sm:text-xs font-black text-slate-900 line-clamp-1">{winner.fullName}</h4>
                                   <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold line-clamp-1 mt-0.5">{winner.schoolName}</p>
                                   <p className="text-[9px] sm:text-xs font-mono font-black text-amber-700 mt-1.5">{winner.time}</p>
                                 </>
                               ) : (
                                 <span className="text-[8px] text-slate-400 font-bold my-auto">قيد التتويج</span>
                               )}
                            </div>
                            <div className={cn("w-full rounded-t-xl text-white font-black text-base flex items-center justify-center", stepH)}>
                              {rank}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 2. ATHLETICS PODIUMS */}
        {showAthletics && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-3xl border border-emerald-200">
              <div className="p-2.5 bg-emerald-600 text-white rounded-2xl shadow-sm">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-emerald-950">
                  نتائج ومنصات تتويج ألعاب القوى
                </h2>
                <p className="text-xs text-emerald-800 font-bold">
                  النتائج الرسمية لجميع التخصصات والمسابقات الفردية
                </p>
              </div>
            </div>

            {athleticsList.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-bold text-xs">لا توجد نتائج مسجلة لألعاب القوى حالياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {athleticsList.map(ath => (
                  <div key={ath.id} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500 text-white rounded-xl shadow-xs">
                          <Award className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="text-sm sm:text-base font-black text-slate-900">{ath.specialtyName}</h3>
                          <p className="text-[11px] text-slate-500 font-bold">{ath.category} - {ath.gender === 'Male' ? 'ذكور' : 'إناث'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 items-end pt-6 pb-2">
                      {[
                        { rank: 2 as const, winner: ath.podium?.find(p => p.rank === 2) || null },
                        { rank: 1 as const, winner: ath.podium?.find(p => p.rank === 1) || null },
                        { rank: 3 as const, winner: ath.podium?.find(p => p.rank === 3) || null }
                      ].map(({ rank, winner }) => {
                        const isGold = rank === 1;
                        const isSilver = rank === 2;
                        const medalBg = isGold ? 'from-amber-400 to-amber-600' : isSilver ? 'from-slate-200 to-slate-400' : 'from-amber-700 to-amber-900';
                        const stepH = isGold ? 'h-16 sm:h-20 bg-amber-500' : isSilver ? 'h-10 sm:h-14 bg-slate-400' : 'h-6 sm:h-10 bg-amber-800';

                        const matchedStd = students.find(s => winner?.studentId && s.id === winner.studentId);
                        const photo = winner?.photoUrl || matchedStd?.photoUrl;

                        return (
                          <div key={rank} className={cn("flex flex-col items-center justify-end w-full", isGold ? "z-10 -translate-y-2" : "z-0")}>
                            <div className="relative -mb-3 sm:-mb-4 z-10">
                              <div className={cn("w-10 h-10 sm:w-12 sm:h-12 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden bg-gradient-to-b relative hover:scale-125 transition-transform duration-200 cursor-pointer", medalBg)}>
                                {photo ? (
                                  <img 
                                    src={photo} 
                                    alt={winner?.fullName} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <div className="w-full h-full bg-slate-100/20" />
                                )}
                              </div>
                            </div>
                            <div className={cn("w-full pt-6 pb-2 px-1 rounded-xl text-center flex flex-col items-center min-h-[110px] sm:min-h-[130px]", isGold ? "bg-amber-50 border-2 border-amber-300" : "bg-slate-50 border border-slate-200")}>
                               {winner ? (
                                 <>
                                   <h4 className="text-[9px] sm:text-[11px] font-black text-slate-900 line-clamp-1">{winner.fullName}</h4>
                                   <p className="text-[8px] sm:text-[9px] text-slate-500 font-bold line-clamp-1 mt-0.5">{winner.schoolName}</p>
                                   <p className="text-[9px] sm:text-xs font-mono font-black text-emerald-700 mt-1">{winner.performance}</p>
                                 </>
                               ) : (
                                 <span className="text-[8px] text-slate-400 font-bold my-auto">قيد التتويج</span>
                               )}
                            </div>
                            <div className={cn("w-full rounded-t-xl text-white font-black text-sm flex items-center justify-center", stepH)}>
                              {rank}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. MATCHES & TOURNAMENT RESULTS */}
        {showMatches && (
          <div className="space-y-6">
            <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-3xl border border-blue-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-2xl shadow-sm">
                  <Goal className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-blue-950">
                    {selectedSportId === 'ALL' ? 'نتائج وبرمجة المباريات الرياضية' : `نتائج مباريات ${availableSportsList.find(s => s.id === selectedSportId)?.name || ''}`}
                  </h2>
                  <p className="text-xs text-blue-800 font-bold">
                    النتائج المباشرة والنهائية للمؤسسات التعليمية
                  </p>
                </div>
              </div>

              <span className="text-xs font-black bg-white px-3 py-1 rounded-xl text-blue-900 border border-blue-200">
                {filteredMatches.length} مباراة
              </span>
            </div>

            {filteredMatches.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs space-y-2">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto" />
                <p className="text-slate-600 font-black text-sm">لا توجد مباريات مسجلة وفق معايير البحث الحالية</p>
                <p className="text-slate-400 font-medium text-xs">يمكنك تغيير الرياضة المختارة أو التبديل لعرض جميع الرياضات</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMatches.map(m => {
                  const matchSport = getMatchSport(m);
                  return (
                    <div key={m.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-3">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-b border-slate-100 pb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{matchSport.icon}</span>
                          <span className="font-black text-slate-700">{matchSport.name}</span>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full font-bold",
                          m.status?.toLowerCase() === 'completed' ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                          m.status?.toLowerCase() === 'ongoing' ? "bg-red-50 text-red-700 animate-pulse border border-red-200" : "bg-amber-50 text-amber-700 border border-amber-200"
                        )}>
                          {m.status?.toLowerCase() === 'completed' ? '🏆 منتهية' : m.status?.toLowerCase() === 'ongoing' ? '🔴 جارية' : '📅 مبرمجة'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between py-3 px-3 bg-slate-50/90 rounded-2xl border border-slate-100">
                        <div className="flex-1 text-right min-w-0">
                          <span className="text-xs font-black text-slate-900 truncate block" title={getSchoolName(m.team1Id)}>
                            {getSchoolName(m.team1Id)}
                          </span>
                        </div>
                        <div className="px-3 py-1 bg-white rounded-xl border border-slate-200 shadow-2xs font-mono font-black text-sm text-blue-700 shrink-0 mx-2">
                          {(m.status?.toLowerCase() === 'completed' || m.status?.toLowerCase() === 'ongoing' || ((m.score1 !== undefined || m.team1Score !== undefined) && m.status?.toLowerCase() !== 'scheduled')) ? (
                            `${m.score1 ?? m.team1Score ?? 0} : ${m.score2 ?? m.team2Score ?? 0}`
                          ) : (
                            'VS'
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <span className="text-xs font-black text-slate-900 truncate block" title={getSchoolName(m.team2Id)}>
                            {getSchoolName(m.team2Id)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium px-1">
                        <div className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span className="truncate max-w-[120px]">{getVenueName(m.venueId)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {m.stage && (
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-600">
                              {m.stage}
                            </span>
                          )}
                          <span>{formatMatchDate(m.date)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs">
        <p className="font-bold">البطولات الرياضية المدرسية 2026 • جميع النتائج رسمية ومعتمدة</p>
      </footer>
    </div>
  );
};
