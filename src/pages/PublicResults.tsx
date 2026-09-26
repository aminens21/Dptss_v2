import React, { useState, useMemo, useEffect } from 'react';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { Match, School, Venue, CrossCountryCategoryResult, AthleticsCategoryResult, Student } from '../types';
import { CROSS_COUNTRY_CATEGORIES, resolveRunnerParticipationType } from '../lib/crossCountryConfig';
import { MapPin, Trophy, Goal, Users, Award, Calendar, ChevronDown, X, Medal, Sparkles, Filter, Activity } from 'lucide-react';
import { cn, formatMatchDate } from '../lib/utils';

export const PublicResults: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'MATCHES' | 'CROSS_COUNTRY' | 'ATHLETICS'>('MATCHES');
  const [matches, setMatches] = useState<Match[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [ccResults, setCcResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [athResults, setAthResults] = useState<Record<string, AthleticsCategoryResult>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [ccAffiliation, setCcAffiliation] = useState<'CLUB' | 'NON_CLUB'>('NON_CLUB');

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [m, s, v, stds, ccr, ath] = await Promise.all([
          DataService.getMatches(),
          DataService.getSchools(),
          DataService.getVenues(),
          DataService.getStudents(),
          DataService.getCrossCountryResults(),
          DataService.getAthleticsResults()
        ]);
        setMatches(m);
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
    loadData();
  }, []);

  const allMatches = useMemo(() => [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), [matches]);

  const stats = useMemo(() => {
    const completed = matches.filter(m => m.status?.toLowerCase() === 'completed' || m.status?.toLowerCase() === 'ongoing' || m.score1 !== undefined || m.score2 !== undefined || m.team1Score !== undefined || m.team2Score !== undefined);
    const totalGoals = completed.reduce((sum, m) => sum + (m.score1 ?? m.team1Score ?? 0) + (m.score2 ?? m.team2Score ?? 0), 0);
    return { totalGoals };
  }, [matches]);

  const getSchoolName = (id: string) => schools.find(sch => sch.id === id)?.name || id;
  const getVenueName = (id: string) => venues.find(ven => ven.id === id)?.name || id;

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
  const athleticsList = Object.values(athResults).filter(res => res && res.podium && res.podium.length > 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8 dir-rtl">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-slate-600 font-bold">جاري تحميل النتائج الرسمية...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8 dir-rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-black text-slate-900">المنصة الرقمية للنتائج المدرسية</h1>
          <p className="text-slate-500 font-bold">النتائج الرسمية للبطولات الرياضية المدرسية الإقليمية</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-2xl mx-auto">
          <button
            onClick={() => setActiveTab('MATCHES')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer",
              activeTab === 'MATCHES' ? "bg-blue-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Activity className="w-4 h-4" />
            <span>الألعاب الجماعية</span>
          </button>
          <button
            onClick={() => setActiveTab('CROSS_COUNTRY')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer",
              activeTab === 'CROSS_COUNTRY' ? "bg-amber-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Trophy className="w-4 h-4" />
            <span>العدو الريفي</span>
          </button>
          <button
            onClick={() => setActiveTab('ATHLETICS')}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-black transition-all cursor-pointer",
              activeTab === 'ATHLETICS' ? "bg-emerald-600 text-white shadow-md" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            <Award className="w-4 h-4" />
            <span>ألعاب القوى</span>
          </button>
        </div>

        {/* CONTENT SECTIONS */}
        {activeTab === 'MATCHES' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-4 rounded-2xl bg-indigo-50 text-indigo-600">
                  <Goal className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-500">مجموع الأهداف المسجلة</p>
                  <p className="text-4xl font-black text-slate-900">{stats.totalGoals}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allMatches.map(m => (
                <div key={m.id} className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow space-y-3">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 border-b pb-2">
                    <span className={cn(
                      "px-2 py-0.5 rounded-full",
                      m.status?.toLowerCase() === 'completed' ? "bg-emerald-50 text-emerald-700" :
                      m.status?.toLowerCase() === 'ongoing' ? "bg-red-50 text-red-700 animate-pulse" : "bg-amber-50 text-amber-700"
                    )}>
                      {m.status?.toLowerCase() === 'completed' ? '🏆 منتهية' : m.status?.toLowerCase() === 'ongoing' ? '🔴 جارية' : '📅 مبرمجة'}
                    </span>
                    <span>{formatMatchDate(m.date)} • {m.stage}</span>
                  </div>
                  <div className="flex items-center justify-between py-3 px-3 bg-slate-50/80 rounded-2xl border border-slate-100">
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
                      <span>{getVenueName(m.venueId)}</span>
                    </div>
                    {m.startTime && (
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                        ⏰ {m.startTime}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'CROSS_COUNTRY' && (
          <div className="space-y-6">
            <div className="flex items-center justify-center gap-2">
              <button 
                onClick={() => setCcAffiliation('NON_CLUB')}
                className={cn("px-4 py-2 rounded-xl text-xs font-black border transition-all", ccAffiliation === 'NON_CLUB' ? "bg-amber-600 text-white border-amber-600" : "bg-white text-slate-600 border-slate-200")}
              >
                مدرسي (غير منتمي)
              </button>
              <button 
                onClick={() => setCcAffiliation('CLUB')}
                className={cn("px-4 py-2 rounded-xl text-xs font-black border transition-all", ccAffiliation === 'CLUB' ? "bg-purple-600 text-white border-purple-600" : "bg-white text-slate-600 border-slate-200")}
              >
                المنتمين للأندية
              </button>
            </div>

            {crossCountryList.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
                <Trophy className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-bold">لا توجد نتائج مسجلة للعدو الريفي في هذا الفرع حالياً</p>
              </div>
            ) : (
              crossCountryList.map(cat => (
                <div key={cat.key} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 border-b pb-4">
                    <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm">
                      <Trophy className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900">{cat.categoryName}</h3>
                      <p className="text-xs text-slate-500 font-bold">منصة التتويج الرسمية • {cat.distance}</p>
                    </div>
                  </div>

                  {/* Podium Display */}
                  <div className="grid grid-cols-3 gap-3 items-end max-w-xl mx-auto pt-8 pb-4">
                    {[
                      { rank: 2 as const, winner: cat.podium?.find(p => p.rank === 2) || null },
                      { rank: 1 as const, winner: cat.podium?.find(p => p.rank === 1) || null },
                      { rank: 3 as const, winner: cat.podium?.find(p => p.rank === 3) || null }
                    ].map(({ rank, winner }) => {
                      const isGold = rank === 1;
                      const isSilver = rank === 2;
                      const medalBg = isGold ? 'from-amber-400 to-amber-600' : isSilver ? 'from-slate-200 to-slate-400' : 'from-amber-700 to-amber-900';
                      const stepH = isGold ? 'h-24 sm:h-32 bg-amber-500' : isSilver ? 'h-16 sm:h-24 bg-slate-400' : 'h-12 sm:h-16 bg-amber-800';

                      const matchedStd = students.find(s => winner?.studentId && s.id === winner.studentId);
                      const photo = winner?.photoUrl || matchedStd?.photoUrl;

                      return (
                        <div key={rank} className={cn("flex flex-col items-center justify-end w-full", isGold ? "z-10 -translate-y-4" : "z-0")}>
                          <div className="relative -mb-6 z-10">
                            <div className={cn("w-16 h-16 sm:w-24 sm:h-24 rounded-full border-4 border-white shadow-xl flex items-center justify-center overflow-hidden bg-gradient-to-b relative", medalBg)}>
                              {photo ? (
                                <>
                                  <img 
                                    src={photo} 
                                    alt={winner?.fullName} 
                                    className="w-full h-full object-cover" 
                                  />
                                </>
                              ) : (
                                <div className="w-full h-full bg-slate-100/20" />
                              )}
                            </div>
                          </div>
                          <div className={cn("w-full pt-8 pb-3 px-2 rounded-xl text-center shadow-sm flex flex-col items-center min-h-[140px] sm:min-h-[180px]", isGold ? "bg-amber-50 border-2 border-amber-300" : "bg-slate-50 border border-slate-200")}>
                             {winner ? (
                               <>
                                 <h4 className="text-[10px] sm:text-xs font-black text-slate-900 line-clamp-1">{winner.fullName}</h4>
                                 <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold line-clamp-1 mt-1">{winner.schoolName}</p>
                                 <p className="text-[9px] sm:text-xs font-mono font-black text-blue-700 mt-2">{winner.time}</p>
                               </>
                             ) : (
                               <span className="text-[8px] text-slate-400 font-bold my-auto">قيد التتويج</span>
                             )}
                          </div>
                          <div className={cn("w-full rounded-t-xl text-white font-black text-lg flex items-center justify-center", stepH)}>
                            {rank}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'ATHLETICS' && (
          <div className="space-y-6">
            {athleticsList.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-sm">
                <Award className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-bold">لا توجد نتائج مسجلة لألعاب القوى حالياً</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {athleticsList.map(ath => (
                  <div key={ath.id} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
                    <div className="flex items-center justify-between border-b pb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-sm">
                          <Award className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-black text-slate-900">{ath.specialtyName}</h3>
                          <p className="text-xs text-slate-500 font-bold">{ath.category} - {ath.gender === 'Male' ? 'ذكور' : 'إناث'}</p>
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
                            <div className="relative -mb-4 z-10">
                              <div className={cn("w-14 h-14 sm:w-20 sm:h-20 rounded-full border-4 border-white shadow-lg flex items-center justify-center overflow-hidden bg-gradient-to-b relative", medalBg)}>
                                {photo ? (
                                  <>
                                    <img 
                                      src={photo} 
                                      alt={winner?.fullName} 
                                      className="w-full h-full object-cover" 
                                    />
                                  </>
                                ) : (
                                  <div className="w-full h-full bg-slate-100/20" />
                                )}
                              </div>
                            </div>
                            <div className={cn("w-full pt-6 pb-2 px-1 rounded-xl text-center flex flex-col items-center min-h-[110px] sm:min-h-[140px]", isGold ? "bg-amber-50 border-2 border-amber-300" : "bg-slate-50 border border-slate-200")}>
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
      </div>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto mt-12 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs">
        <p className="font-bold">البطولات الرياضية المدرسية 2026 • جميع النتائج رسمية ومعتمدة</p>
      </footer>
    </div>
  );
};
