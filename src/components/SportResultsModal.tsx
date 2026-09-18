import React, { useState, useMemo } from 'react';
import { Sport, Tournament, Match, School, Venue, Student, User } from '../types';
import { DataService, isClubTournament, GENDER_MAP, getAgeCategoriesForSeason } from '../lib/dataService';
import { CrossCountryPodiumView } from './CrossCountryPodiumView';
import { CrossCountryCategoryResult } from '../types';
import {
  X,
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  Award,
  Sparkles,
  Pencil,
  ChevronLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface SportResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | null;
  tournaments: Tournament[];
  matches: Match[];
  schools: School[];
  venues: Venue[];
  students: Student[];
  crossCountryResults: Record<string, CrossCountryCategoryResult>;
  onUpdateCrossCountryResult?: (res: CrossCountryCategoryResult) => Promise<void>;
  userProfile: User | null;
  activeSeason: string;
  onEditScore: (match: Match) => void;
  onEditMatch: (match: Match) => void;
  onDeleteMatch: (match: Match) => void;
  onCreateMatch: (sportId: string, initialAffiliation: 'non_club' | 'club_affiliated') => void;
  onEditTournament?: (tournament: Tournament) => void;
  onDeleteTournament?: (tournament: Tournament) => void;
}

export const SportResultsModal: React.FC<SportResultsModalProps> = ({
  isOpen,
  onClose,
  sport,
  tournaments,
  matches,
  schools,
  venues,
  students,
  crossCountryResults,
  onUpdateCrossCountryResult,
  userProfile,
  activeSeason,
  onEditScore,
  onEditMatch,
  onDeleteMatch,
  onCreateMatch,
  onEditTournament,
  onDeleteTournament
}) => {
  const [selectedAffiliation, setSelectedAffiliation] = useState<'non_club' | 'club_affiliated' | 'open'>('non_club');
  const [activeBranchModal, setActiveBranchModal] = useState<'non_club' | 'club_affiliated' | 'open' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';
  const isSportManager = userProfile?.role === 'SPORT_MANAGER';
  const isTechHead = userProfile?.isTechCommitteeHead === true;
  const canManage = isCentralAdmin || isSportManager || isTechHead;

  const seasonalCategories = useMemo(() => {
    return getAgeCategoriesForSeason(activeSeason);
  }, [activeSeason]);

  // Sport categories list
  const sportCategories = useMemo(() => {
    if (!sport) return seasonalCategories.map(c => c.id);
    if (sport.ageCategories && sport.ageCategories.length > 0) return sport.ageCategories;
    return seasonalCategories.map(c => c.id);
  }, [sport, seasonalCategories]);

  // Tournaments for this sport
  const sportTournaments = useMemo(() => {
    if (!sport) return [];
    return tournaments.filter(t => t.sportId === sport.id);
  }, [tournaments, sport]);

  // Non-club tournaments vs Club-affiliated tournaments
  const nonClubTournaments = useMemo(() => {
    return sportTournaments.filter(t => !isClubTournament(t));
  }, [sportTournaments]);

  const clubTournaments = useMemo(() => {
    return sportTournaments.filter(t => isClubTournament(t));
  }, [sportTournaments]);

  const openTournaments = useMemo(() => {
    return sportTournaments.filter(t => !isClubTournament(t) && (t.affiliationType === 'open' || (t.name && (t.name.includes('مفتوحة') || t.name.includes('المفتوحة')))));
  }, [sportTournaments]);

  // Matches for this sport
  const sportMatches = useMemo(() => {
    if (!sport) return [];
    return matches.filter(m => {
      if (m.sportId === sport.id) return true;
      if (m.tournamentId) {
        return sportTournaments.some(t => t.id === m.tournamentId);
      }
      return false;
    });
  }, [matches, sport, sportTournaments]);

  // Helper: check match affiliation
  const getMatchAffiliation = (match: Match): 'non_club' | 'club_affiliated' | 'open' => {
    if (match.tournamentId) {
      const parentT = tournaments.find(t => t.id === match.tournamentId);
      if (parentT) {
        if (parentT.affiliationType === 'open') return 'open';
        if (parentT.name && (parentT.name.includes('مفتوحة') || parentT.name.includes('المفتوحة'))) return 'open';
        if (isClubTournament(parentT)) return 'club_affiliated';
        return 'non_club';
      }
    }
    // Fallback: check match notes or title
    if (match.notes && (match.notes.includes('مفتوحة') || match.notes.includes('المفتوحة'))) return 'open';
    if (match.notes && (match.notes.includes('منتمين') || match.notes.includes('أندية'))) {
      return match.notes.includes('غير المنتمين') ? 'non_club' : 'club_affiliated';
    }
    return 'non_club';
  };

  const isMatchClubAffiliated = (match: Match): boolean => {
    return getMatchAffiliation(match) === 'club_affiliated';
  };

  // Filtered matches for active branch (selectedAffiliation) and active filters
  const activeBranchMatches = useMemo(() => {
    return sportMatches.filter(m => {
      const mAff = getMatchAffiliation(m);
      if (selectedAffiliation !== mAff) return false;

      // Category filter
      if (selectedCategory !== 'ALL') {
        const mCat = (m.ageCategory || '').toLowerCase();
        const selCat = selectedCategory.toLowerCase();
        if (mCat !== selCat && !mCat.includes(selCat) && !selCat.includes(mCat)) return false;
      }

      // Gender filter
      if (selectedGender !== 'ALL' && m.gender !== selectedGender) return false;

      // Status filter
      if (statusFilter !== 'ALL' && m.status !== statusFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t1 = schools.find(s => s.id === m.team1Id)?.name || m.team1Id || '';
        const t2 = schools.find(s => s.id === m.team2Id)?.name || m.team2Id || '';
        const v = venues.find(v => v.id === m.venueId)?.name || '';
        const stage = m.stage || '';
        const matchStr = `${t1} ${t2} ${v} ${stage}`.toLowerCase();
        if (!matchStr.includes(q)) return false;
      }

      return true;
    });
  }, [sportMatches, selectedAffiliation, selectedCategory, selectedGender, statusFilter, searchQuery, schools, venues, tournaments]);

  // Determine branch card visibility based on existing matches or tournaments
  const hasNonClub = useMemo(() => {
    return sportMatches.some(m => getMatchAffiliation(m) === 'non_club') || sportTournaments.some(t => (t.affiliationType || 'non_club') === 'non_club' && t.affiliationType !== 'open');
  }, [sportMatches, sportTournaments]);

  const hasClub = useMemo(() => {
    return sportMatches.some(m => getMatchAffiliation(m) === 'club_affiliated') || sportTournaments.some(t => t.affiliationType === 'club_affiliated');
  }, [sportMatches, sportTournaments]);

  const hasOpen = useMemo(() => {
    return sportMatches.some(m => getMatchAffiliation(m) === 'open') || openTournaments.length > 0;
  }, [sportMatches, openTournaments]);

  // Set default branch on open or prioritization
  React.useEffect(() => {
    if (isOpen) {
      if (hasOpen) setSelectedAffiliation('open');
      else if (hasNonClub) setSelectedAffiliation('non_club');
      else if (hasClub) setSelectedAffiliation('club_affiliated');
    }
  }, [isOpen, hasOpen, hasNonClub, hasClub]);

  // Non-club vs Club match counters
  const nonClubMatchesCount = useMemo(() => {
    return sportMatches.filter(m => !isMatchClubAffiliated(m)).length;
  }, [sportMatches]);

  const clubMatchesCount = useMemo(() => {
    return sportMatches.filter(m => getMatchAffiliation(m) === 'club_affiliated').length;
  }, [sportMatches]);

  const openMatchesCount = useMemo(() => {
    return sportMatches.filter(m => getMatchAffiliation(m) === 'open').length;
  }, [sportMatches]);

  if (!isOpen || !sport) return null;

  const getSchoolName = (id: string) => {
    const s = schools.find(sch => sch.id === id);
    return s ? s.name : id || 'غير محدد';
  };

  const getVenueName = (id: string) => {
    const v = venues.find(ven => ven.id === id);
    return v ? v.name : id || 'ملعب غير محدد';
  };

  const getCategoryName = (catId: string) => {
    const catObj = seasonalCategories.find(c => c.id === catId);
    return catObj ? catObj.name : catId;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto dir-rtl">
      <div
        className={`w-full bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ${
          isFullScreen ? 'h-full max-w-none m-0 rounded-none' : 'max-w-6xl max-h-[92vh] my-4'
        }`}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white flex flex-col xs:flex-row xs:items-center justify-between gap-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-xl sm:text-2xl shadow-md border border-amber-300/40 shrink-0">
              {sport.icon || '🏆'}
            </div>
            <div className="min-w-0 text-right">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-400/30 whitespace-nowrap">
                  نتائج ومباريات الرياضة
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold whitespace-nowrap">{activeSeason}</span>
              </div>
              <h2 className="text-sm sm:text-base md:text-lg font-black text-white mt-0.5 truncate">
                البطولة الإقليمية المدرسية لـ {sport.name}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-1.5 justify-end w-full xs:w-auto shrink-0">
            {canManage && (
              <button
                type="button"
                onClick={() => onCreateMatch(sport.id, selectedAffiliation)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">برمجة مباراة جديدة</span>
                <span className="sm:hidden">إضافة</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="text-slate-300 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              title={isFullScreen ? 'استعادة الحجم الطبيعي' : 'ملء الشاشة'}
            >
              {isFullScreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
              title="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/60 space-y-6">

          {/* Special view for Cross Country */}
          {sport.id === 'cross_country' ? (
            <CrossCountryPodiumView
              results={crossCountryResults}
              onUpdateResult={onUpdateCrossCountryResult || (async () => {})}
              onBack={onClose}
              canEdit={canManage}
              activeSeason={activeSeason}
              directorateName="المديرية الإقليمية"
              students={students}
              schools={schools}
              currentUser={userProfile}
            />
          ) : (
            <>
              {/* BRANCH CARDS (Show only if corresponding matches or tournaments exist) */}
              <div className={`grid gap-5 ${
                [hasNonClub, hasClub, hasOpen].filter(Boolean).length === 1 
                  ? 'grid-cols-1 max-w-md mx-auto' 
                  : [hasNonClub, hasClub, hasOpen].filter(Boolean).length === 2
                  ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
                  : 'grid-cols-1 lg:grid-cols-3'
              }`}>
                {/* ⚪ Non-club Tournament Branch (White Card) */}
                {hasNonClub && (
                  <div
                    id="results-non-club-championship-card"
                    onClick={() => {
                      setSelectedAffiliation('non_club');
                      setActiveBranchModal('non_club');
                    }}
                    className="text-right p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-sm hover:shadow-xl bg-white border-blue-200 hover:border-blue-500 group"
                  >
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-blue-50 text-blue-800 border-blue-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          ⚪ بطولة غير المنتمين
                        </span>
                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-xl border border-blue-100">
                          {nonClubMatchesCount} مباراة
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-1 group-hover:text-blue-600 transition-colors">
                        نتائج صنف غير المنتمين
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight">
                        البرمجة والنتائج الخاصة بالتلاميذ المتمدرسين غير المنخرطين بالأندية.
                      </p>

                      {/* Category matches count breakdown */}
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                        {sportCategories.slice(0, 4).map(catId => {
                          const count = sportMatches.filter(m => {
                            const mAff = getMatchAffiliation(m);
                            if (mAff !== 'non_club') return false;
                            const mCat = (m.ageCategory || '').toLowerCase();
                            return mCat === catId.toLowerCase() || mCat.includes(catId.toLowerCase());
                          }).length;
                          if (count === 0) return null;
                          return (
                            <span key={catId} className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              {getCategoryName(catId)}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 w-full mt-3">
                      <span className="text-[10px] text-slate-400 font-bold">التفاصيل</span>
                      <button type="button" className="p-1.5 rounded-xl bg-blue-600 text-white shadow-sm group-hover:bg-blue-700">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 🟡 Club-affiliated Tournament Branch (Yellow Card) */}
                {hasClub && (
                  <div
                    id="results-club-affiliated-championship-card"
                    onClick={() => {
                      setSelectedAffiliation('club_affiliated');
                      setActiveBranchModal('club_affiliated');
                    }}
                    className="text-right p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-sm hover:shadow-xl bg-amber-50/70 hover:bg-amber-50 border-amber-300/80 hover:border-amber-500 text-amber-950 group"
                  >
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          🟡 بطولة المنتمين للأندية
                        </span>
                        <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-xl border border-amber-200">
                          {clubMatchesCount} مباراة
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-amber-950 mt-1 group-hover:text-amber-800 transition-colors">
                        نتائج صنف المنتمين للأندية
                      </h4>
                      <p className="text-[11px] text-amber-900/80 font-medium leading-tight">
                        البرمجة والنتائج الخاصة بالتلاميذ المنخرطين بالنوادي والجامعات الرياضية.
                      </p>

                      {/* Category matches count breakdown */}
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-amber-200/60 pt-2">
                        {sportCategories.slice(0, 4).map(catId => {
                          const count = sportMatches.filter(m => {
                            const mAff = getMatchAffiliation(m);
                            if (mAff !== 'club_affiliated') return false;
                            const mCat = (m.ageCategory || '').toLowerCase();
                            return mCat === catId.toLowerCase() || mCat.includes(catId.toLowerCase());
                          }).length;
                          if (count === 0) return null;
                          return (
                            <span key={catId} className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              {getCategoryName(catId)}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-amber-200/60 pt-3 w-full mt-3">
                      <span className="text-[10px] text-amber-800 font-bold">التفاصيل</span>
                      <button type="button" className="p-1.5 rounded-xl bg-amber-500 text-white shadow-sm group-hover:bg-amber-600">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 🟢 Open Tournament Branch (Green Card) */}
                {hasOpen && (
                  <div
                    id="results-open-championship-card"
                    onClick={() => {
                      setSelectedAffiliation('open');
                      setActiveBranchModal('open');
                    }}
                    className="text-right p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-sm hover:shadow-xl bg-emerald-50/70 hover:bg-emerald-50 border-emerald-300/80 hover:border-emerald-500 text-emerald-950 group"
                  >
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-emerald-100 text-emerald-900 border-emerald-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          🟢 البطولات المفتوحة
                        </span>
                        <span className="text-[10px] font-bold text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-xl border border-emerald-200">
                          {openMatchesCount} مباراة
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-emerald-950 mt-1 group-hover:text-emerald-800 transition-colors">
                        نتائج البطولات المفتوحة
                      </h4>
                      <p className="text-[11px] text-emerald-900/80 font-medium leading-tight">
                        البرمجة والنتائج الخاصة بالدوريات والبطولات المفتوحة لجميع الفئات والمشاركين.
                      </p>

                      {/* Category matches count breakdown */}
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-emerald-200/60 pt-2">
                        {sportCategories.slice(0, 4).map(catId => {
                          const count = sportMatches.filter(m => {
                            const mAff = getMatchAffiliation(m);
                            if (mAff !== 'open') return false;
                            const mCat = (m.ageCategory || '').toLowerCase();
                            return mCat === catId.toLowerCase() || mCat.includes(catId.toLowerCase());
                          }).length;
                          if (count === 0) return null;
                          return (
                            <span key={catId} className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                              {getCategoryName(catId)}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-emerald-200/60 pt-3 w-full mt-3">
                      <span className="text-[10px] text-emerald-800 font-bold">التفاصيل</span>
                      <button type="button" className="p-1.5 rounded-xl bg-emerald-500 text-white shadow-sm group-hover:bg-emerald-600">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* INNER BRANCH MODAL WINDOW (نافذة نتائج الصنف المحددة) */}
              {activeBranchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-2 sm:p-5 overflow-y-auto dir-rtl">
                  <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col">
                    {/* Inner Modal Header */}
                    <div
                      className={`px-5 py-4 flex items-center justify-between border-b shrink-0 text-white ${
                        activeBranchModal === 'club_affiliated'
                          ? 'bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 border-amber-500/30'
                          : activeBranchModal === 'open'
                          ? 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 border-emerald-500/30'
                          : 'bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 border-blue-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-2xl shadow-inner border border-white/20">
                          {activeBranchModal === 'club_affiliated' ? '🟡' : activeBranchModal === 'open' ? '🟢' : '⚪'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black px-2.5 py-0.5 rounded-md bg-white/20 text-white">
                              {activeBranchModal === 'club_affiliated' ? 'بطولة المنتمين للأندية' : activeBranchModal === 'open' ? 'البطولة المفتوحة' : 'بطولة غير المنتمين للأندية'}
                            </span>
                            <span className="text-[10px] text-white/80 font-bold">{sport.name} - {activeSeason}</span>
                          </div>
                          <h3 className="text-sm sm:text-base font-black text-white mt-0.5">
                            {activeBranchModal === 'club_affiliated'
                              ? `نافذة نتائج ومباريات صنف المنتمين للأندية والجمعيات (${clubMatchesCount} مباراة)`
                              : activeBranchModal === 'open'
                              ? `نافذة نتائج ومباريات البطولة المفتوحة (${openMatchesCount} مباراة)`
                              : `نافذة نتائج ومباريات صنف غير المنتمين للأندية (${nonClubMatchesCount} مباراة)`}
                          </h3>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => onCreateMatch(sport.id, activeBranchModal)}
                            className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            <Plus className="w-4 h-4" />
                            <span>برمجة مباراة بهذا الصنف</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setActiveBranchModal(null)}
                          className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer border border-white/25"
                          title="إغلاق"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Inner Modal Content */}
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 space-y-5">
                      {/* Central Admin Tournaments Management Box for this Sport & Branch */}
                      {isCentralAdmin && (
                        <div className="p-4 bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-slate-900/10 rounded-2xl border border-blue-200/80 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-700" />
                            <div>
                              <h5 className="text-xs font-black text-slate-800">
                                إدارة بطولات {sport.name} ({activeBranchModal === 'club_affiliated' ? 'المنتمين للأندية' : 'غير المنتمين'})
                              </h5>
                              <p className="text-[11px] text-slate-600 font-medium">
                                يمكنك تعديل بيانات البطولات المحدثة لهذا الصنف أو حذفها نهائياً
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {(activeBranchModal === 'non_club' ? nonClubTournaments : activeBranchModal === 'club_affiliated' ? clubTournaments : openTournaments).map(t => (
                              <div key={t.id} className="flex items-center gap-1 px-2.5 py-1 bg-white rounded-xl border border-slate-300 shadow-2xs text-xs font-bold text-slate-800">
                                <span className="truncate max-w-[150px]">{t.name}</span>
                                {onEditTournament && (
                                  <button
                                    type="button"
                                    onClick={() => onEditTournament(t)}
                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                    title="تعديل البطولة"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {onDeleteTournament && (
                                  <button
                                    type="button"
                                    onClick={() => onDeleteTournament(t)}
                                    className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                    title="حذف البطولة"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Filter Controls for Level 3 (Category Tabs, Gender, Search) */}
                      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                          {/* Category Pills */}
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                            <span className="text-xs font-bold text-slate-500 whitespace-nowrap ml-1">الفئة:</span>
                            <button
                              type="button"
                              onClick={() => setSelectedCategory('ALL')}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                selectedCategory === 'ALL'
                                  ? 'bg-slate-900 text-white shadow-xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              جميع الفئات
                            </button>
                            {sportCategories.map(catId => (
                              <button
                                key={catId}
                                type="button"
                                onClick={() => setSelectedCategory(catId)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                  selectedCategory === catId
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                {getCategoryName(catId)}
                              </button>
                            ))}
                          </div>

                          {/* Gender & Status Filters */}
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                              <button
                                type="button"
                                onClick={() => setSelectedGender('ALL')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  selectedGender === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                                }`}
                              >
                                الكل
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedGender('Male')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  selectedGender === 'Male' ? 'bg-white text-blue-700 shadow-2xs' : 'text-slate-600'
                                }`}
                              >
                                👦 ذكور
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedGender('Female')}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                  selectedGender === 'Female' ? 'bg-white text-pink-700 shadow-2xs' : 'text-slate-600'
                                }`}
                              >
                                👧 إناث
                              </button>
                            </div>

                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl border border-slate-200 focus:outline-none"
                            >
                              <option value="ALL">جميع الحالات</option>
                              <option value="Ongoing">🔴 جارية الآن</option>
                              <option value="Scheduled">📅 مبرمجة</option>
                              <option value="Completed">🏆 مكتملة</option>
                            </select>
                          </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="البحث باسم المؤسسة المنافسة، القاعة الرياضية، أو الدور..."
                            className="w-full pr-9 pl-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* MATCHES LIST / GRID */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                            <span>قائمة المقابلات المبرمجة والنتائج</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                              {activeBranchMatches.length} مباراة
                            </span>
                          </h4>
                          <span className="text-[11px] text-slate-500 font-bold">
                            الصنف: {activeBranchModal === 'non_club' ? '⚪ غير المنتمين للأندية' : activeBranchModal === 'club_affiliated' ? '🟡 المنتمين للأندية' : '🟢 البطولة المفتوحة'}
                          </span>
                        </div>

                        {activeBranchMatches.length === 0 ? (
                          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
                            <div>
                              <p className="text-sm font-bold text-slate-700">لا توجد مباريات مبرمجة في هذا التصنيف بعد</p>
                              <p className="text-xs text-slate-500 mt-1">
                                يمكنك إضافة مباراة جديدة لهذا الصنف بالضغط على زر "برمجة مباراة لهذا الصنف".
                              </p>
                            </div>
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => onCreateMatch(sport.id, activeBranchModal)}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5"
                              >
                                <Plus className="w-4 h-4" />
                                <span>برمجة مباراة الآن</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {activeBranchMatches.map((m) => {
                              const t1Name = getSchoolName(m.team1Id);
                              const t2Name = getSchoolName(m.team2Id);
                              const vName = getVenueName(m.venueId);

                              const isCompleted = m.status === 'Completed';
                              const isOngoing = m.status === 'Ongoing';

                              const s1 = m.score1 ?? 0;
                              const s2 = m.score2 ?? 0;
                              const isT1Winner = isCompleted && (
                                m.winnerId === m.team1Id ||
                                (s1 > s2) ||
                                (s1 === s2 && m.penalty1 !== undefined && m.penalty2 !== undefined && m.penalty1 > m.penalty2)
                              );
                              const isT2Winner = isCompleted && (
                                m.winnerId === m.team2Id ||
                                (s2 > s1) ||
                                (s1 === s2 && m.penalty1 !== undefined && m.penalty2 !== undefined && m.penalty2 > m.penalty1)
                              );

                              return (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-2.5 bg-white shadow-3xs hover:shadow-xs",
                                    activeBranchModal === 'club_affiliated'
                                      ? 'border-amber-200 hover:border-amber-300 bg-amber-50/10'
                                      : activeBranchModal === 'open'
                                      ? 'border-emerald-200 hover:border-emerald-300 bg-emerald-50/10'
                                      : 'border-slate-150 hover:border-blue-300'
                                  )}
                                >
                                  {/* Compact Header: Round, Category, Gender, Status */}
                                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 border-b border-slate-100/80 pb-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-black">
                                        {m.stage || 'دور المجموعات'}
                                      </span>
                                      {m.ageCategory && (
                                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold">
                                          {m.ageCategory}
                                        </span>
                                      )}
                                      {m.gender && GENDER_MAP[m.gender] && (
                                        <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 font-extrabold">
                                          {GENDER_MAP[m.gender].icon} {GENDER_MAP[m.gender].name}
                                        </span>
                                      )}
                                    </div>

                                    {/* Status Badge */}
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 border",
                                        isOngoing
                                          ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                                          : isCompleted
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                          : "bg-blue-50 text-blue-700 border-blue-150"
                                      )}
                                    >
                                      {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
                                      {isOngoing ? '🔴 جارية' : isCompleted ? '🏆 منتهية' : '📅 مبرمجة'}
                                    </span>
                                  </div>

                                  {/* Compact Unified Scoreboard (Responsive: Stacked rows on mobile, side-by-side on desktop) */}
                                  <div className="py-2 px-2.5 bg-slate-50/60 rounded-xl border border-slate-100/80">
                                    {/* Desktop view (sm:flex side-by-side) */}
                                    <div className="hidden sm:flex items-center justify-between">
                                      {/* Team 1 Side (RTL Right) */}
                                      <div className="w-[43%] flex items-center gap-1.5 justify-start min-w-0">
                                        <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                                          🏫
                                        </span>
                                        <span
                                          className={cn(
                                            "text-xs font-black text-slate-800 truncate leading-none",
                                            isCompleted && isT1Winner && "text-blue-700 font-black"
                                          )}
                                          title={t1Name}
                                        >
                                          {t1Name}
                                        </span>
                                        {isCompleted && isT1Winner && (
                                          <Trophy className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" title="الفائز" />
                                        )}
                                      </div>

                                      {/* Scores Box */}
                                      <div className="w-[14%] flex flex-col items-center justify-center shrink-0">
                                        {isCompleted || isOngoing ? (
                                          <div className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-3xs font-mono font-black text-xs text-slate-800 flex items-center gap-1">
                                            <span className={cn(isCompleted && isT1Winner && "text-blue-600 font-black")}>
                                              {m.score1 ?? 0}
                                            </span>
                                            <span className="text-slate-400 font-normal">:</span>
                                            <span className={cn(isCompleted && isT2Winner && "text-blue-600 font-black")}>
                                              {m.score2 ?? 0}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] font-black text-slate-400">VS</span>
                                        )}
                                      </div>

                                      {/* Team 2 Side (RTL Left) */}
                                      <div className="w-[43%] flex items-center gap-1.5 justify-end min-w-0">
                                        {isCompleted && isT2Winner && (
                                          <Trophy className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" title="الفائز" />
                                        )}
                                        <span
                                          className={cn(
                                            "text-xs font-black text-slate-800 truncate leading-none",
                                            isCompleted && isT2Winner && "text-blue-700 font-black"
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

                                    {/* Mobile View (sm:hidden stacked rows) */}
                                    <div className="flex sm:hidden flex-col gap-1.5 w-full">
                                      {/* Team 1 (Top Row on Mobile) */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="w-4.5 h-4.5 rounded-full bg-blue-50 text-blue-700 text-[9px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                                            🏫
                                          </span>
                                          <span
                                            className={cn(
                                              "text-[11px] font-black text-slate-800 truncate leading-tight",
                                              isCompleted && isT1Winner && "text-blue-700"
                                            )}
                                            title={t1Name}
                                          >
                                            {t1Name}
                                          </span>
                                          {isCompleted && isT1Winner && (
                                            <Trophy className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                                          )}
                                        </div>
                                        <div className="shrink-0 font-mono text-[11px] font-black">
                                          {isCompleted || isOngoing ? (
                                            <span className={cn(
                                              "px-1.5 py-0.5 rounded border block text-center min-w-[20px]",
                                              isCompleted && isT1Winner ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-white text-slate-600 border-slate-200"
                                            )}>
                                              {m.score1 ?? 0}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 font-bold">—</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Team 2 (Bottom Row on Mobile) */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="w-4.5 h-4.5 rounded-full bg-blue-50 text-blue-700 text-[9px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                                            🏫
                                          </span>
                                          <span
                                            className={cn(
                                              "text-[11px] font-black text-slate-800 truncate leading-tight",
                                              isCompleted && isT2Winner && "text-blue-700"
                                            )}
                                            title={t2Name}
                                          >
                                            {t2Name}
                                          </span>
                                          {isCompleted && isT2Winner && (
                                            <Trophy className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                                          )}
                                        </div>
                                        <div className="shrink-0 font-mono text-[11px] font-black">
                                          {isCompleted || isOngoing ? (
                                            <span className={cn(
                                              "px-1.5 py-0.5 rounded border block text-center min-w-[20px]",
                                              isCompleted && isT2Winner ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-white text-slate-600 border-slate-200"
                                            )}>
                                              {m.score2 ?? 0}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 font-bold">—</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Penalties or Scorers compact details */}
                                  {(m.penalty1 !== undefined || m.penalty2 !== undefined || m.scorers) && (
                                    <div className="text-[9px] text-slate-500 font-bold bg-amber-50/55 border border-amber-100 p-1.5 rounded-lg flex flex-col gap-0.5">
                                      {(m.penalty1 !== undefined || m.penalty2 !== undefined) && (
                                        <div className="flex items-center justify-center gap-1 text-amber-900 font-black">
                                          🎯 ركلات الترجيح: ({m.penalty1 ?? 0} - {m.penalty2 ?? 0})
                                        </div>
                                      )}
                                      {m.scorers && (
                                        <div className="text-center truncate" title={m.scorers}>
                                          ⚽ الهدافون: <span className="font-medium text-slate-600">{m.scorers}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Venue, Date & Compact Action Buttons Footer */}
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold pt-1.5 border-t border-slate-100/70">
                                    <div className="flex items-center gap-1.5 text-slate-400 truncate max-w-[55%]">
                                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="truncate" title={vName}>{vName}</span>
                                      <span className="text-slate-300 shrink-0">•</span>
                                      <span className="shrink-0">{m.date ? String(m.date).split('T')[0] : '--'}</span>
                                      {m.startTime && (
                                        <>
                                          <span className="text-slate-300 shrink-0">•</span>
                                          <span className="shrink-0">{m.startTime}</span>
                                        </>
                                      )}
                                    </div>

                                    {/* Inline Actions */}
                                    {canManage ? (
                                      <div className="flex items-center gap-1 shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => onEditScore(m)}
                                          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black transition-all cursor-pointer flex items-center gap-1 shadow-3xs"
                                        >
                                          <Edit3 className="w-2.5 h-2.5" />
                                          <span>{isCompleted ? 'تعديل النتيجة' : 'تسجيل النتيجة'}</span>
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() => onEditMatch(m)}
                                          className="p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
                                          title="تعديل تفاصيل المباراة"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>

                                        {isCentralAdmin && (
                                          <button
                                            type="button"
                                            onClick={() => onDeleteMatch(m)}
                                            className="p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all cursor-pointer"
                                            title="حذف المباراة والنتيجة"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 font-normal">عرض فقط</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
