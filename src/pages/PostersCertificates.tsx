import React, { useState, useEffect, useMemo } from 'react';
import {
  Award,
  Palette,
  Medal,
  Trophy,
  Search,
  Filter,
  Printer,
  Download,
  Copy,
  Calendar,
  MapPin,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Layers,
  ArrowRight,
  Info,
  Building,
  RefreshCw
} from 'lucide-react';
import { DataService, OfficialLogos } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
import { Tournament, Sport, Directorate } from '../types';
import { TournamentPosterModal } from '../components/TournamentPosterModal';
import { TournamentCertificateModal } from '../components/TournamentCertificateModal';

// Helper to safely format dates (handles Firestore Timestamps, Date objects, strings, numbers)
const safeFormatDate = (val: any): string | null => {
  if (!val) return null;
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    try {
      return new Date(val).toLocaleDateString('ar-MA');
    } catch {
      return String(val);
    }
  }
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        return val.toDate().toLocaleDateString('ar-MA');
      } catch {
        return null;
      }
    }
    if (typeof val.seconds === 'number') {
      try {
        return new Date(val.seconds * 1000).toLocaleDateString('ar-MA');
      } catch {
        return null;
      }
    }
    if (val instanceof Date) {
      try {
        return val.toLocaleDateString('ar-MA');
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const PostersCertificates: React.FC = () => {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [activeSeason, setActiveSeason] = useState('2026/2027');
  const [activeDirObj, setActiveDirObj] = useState<Directorate | null>(null);
  const [officialLogos, setOfficialLogos] = useState<OfficialLogos | undefined>(undefined);

  // Search and Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSport, setFilterSport] = useState<string>('ALL');

  // Selected Sport for Modals
  const [selectedSportForPoster, setSelectedSportForPoster] = useState<Sport | null>(null);
  const [isPosterModalOpen, setIsPosterModalOpen] = useState(false);

  const [selectedSportForCertificate, setSelectedSportForCertificate] = useState<Sport | null>(null);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);

  // Load Data
  const loadData = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [tournList, sportsList, season, activeDir, logos] = await Promise.all([
        DataService.getTournaments(),
        DataService.getSportsConfig(),
        DataService.getActiveSeason(),
        DataService.getActiveDirectorate(),
        DataService.getOfficialLogos().catch(() => undefined)
      ]);

      const dirTournaments = tournList.filter(t => (t.directorateId || 'taourirt') === activeDirId);

      setTournaments(dirTournaments);
      setSportsConfig(sportsList);
      if (season) setActiveSeason(season);
      if (activeDir) setActiveDirObj(activeDir);
      if (logos) setOfficialLogos(logos);
    } catch (error) {
      console.error('Error loading posters & certificates data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute Programmed Tournaments / Sports
  const programmedTournamentsList = useMemo(() => {
    return sportsConfig
      .map(sport => {
        const sportTournaments = tournaments.filter(t => t.sportId === sport.id);
        
        // A sport is programmed if tournaments exist for it or is marked programmed
        const isProgrammed = sportTournaments.length > 0
          ? true
          : (sport.isProgrammed !== undefined
            ? sport.isProgrammed
            : (sport.ageCategories && sport.ageCategories.length > 0 && sport.studentLimit !== undefined && sport.studentLimit > 0));

        // Find primary tournament or construct title
        const primaryTourn = sportTournaments[0];
        const rawTitle = primaryTourn?.name || `البطولة الإقليمية المدرسية لـ ${sport.name}`;
        const title = typeof rawTitle === 'string' ? rawTitle : `البطولة الإقليمية المدرسية لـ ${sport.name}`;
        
        // Find date / location if available (safely formatted)
        const rawDate = primaryTourn?.startDate || (sport as any)?.championshipDate;
        const dateStr = safeFormatDate(rawDate);
        const rawVenue = primaryTourn?.venue || (sport as any)?.championshipVenue;
        const venueStr = typeof rawVenue === 'string' ? rawVenue : null;

        return {
          sport,
          title,
          isProgrammed,
          sportTournaments,
          tournamentsCount: sportTournaments.length,
          categoriesCount: sport.ageCategories?.length || 0,
          dateStr,
          venueStr
        };
      })
      .filter(item => item.isProgrammed);
  }, [sportsConfig, tournaments]);

  // Filtered list
  const filteredList = useMemo(() => {
    return programmedTournamentsList.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sport.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSport = filterSport === 'ALL' || item.sport.id === filterSport;
      return matchesSearch && matchesSport;
    });
  }, [programmedTournamentsList, searchTerm, filterSport]);

  const directorateName = activeDirObj?.name || userProfile?.directorateName || 'المديرية الإقليمية بتاوريرت';

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-red-950 via-slate-900 to-amber-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border border-red-900/40 relative overflow-hidden">
        {/* Subtle Moroccan map or geometric pattern in background */}
        <div className="absolute -left-10 -bottom-10 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-0 top-0 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold">
              <Award className="h-4 w-4" />
              <span>المنظومة الرسمية للملصقات والشواهد التقديرية</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>الملصقات والشواهد التقديرية</span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              توليد وتخصيص الملصقات الإعلانية الرسمية للبطولات المبرمجة (<strong className="text-amber-300 font-bold">A4 عمودي</strong>)،
              والشواهد التقديرية المعتمدة للمشاركين والمتوجين (<strong className="text-amber-300 font-bold">A4 أفقي</strong>) بنفس هوية وخلفية كل بطولة.
            </p>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300 pt-1">
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 font-medium">
                <Building className="h-3.5 w-3.5 text-amber-400" />
                <span>{directorateName}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10 font-medium">
                <Calendar className="h-3.5 w-3.5 text-blue-400" />
                <span>الموسم الدراسي: {activeSeason}</span>
              </span>
              <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-500/30 font-bold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>{programmedTournamentsList.length} بطولة مبرمجة معتمدة</span>
              </span>
            </div>
          </div>

          {/* Quick Refresh */}
          <div className="flex items-center gap-2 self-start md:self-center">
            <button
              onClick={loadData}
              disabled={loading}
              className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors border border-white/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="تحديث البيانات"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-3xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="بحث عن عنوان بطولة أو نوع رياضة..."
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-hidden"
          />
        </div>

        {/* Filter by Sport */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <span>تصفية حسب الرياضة:</span>
          </span>
          <select
            value={filterSport}
            onChange={(e) => setFilterSport(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-hidden cursor-pointer w-full sm:w-auto"
          >
            <option value="ALL">🏆 جميع الرياضات المبرمجة ({programmedTournamentsList.length})</option>
            {programmedTournamentsList.map(item => (
              <option key={item.sport.id} value={item.sport.id}>
                {item.sport.icon || '🏆'} {item.sport.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Programmed Tournaments Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-amber-600 border-t-transparent" />
          <span className="text-xs font-bold text-slate-500">جاري تحميل البطولات المبرمجة...</span>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-md mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 text-2xl">
            🏆
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-800">لا توجد بطولات تطابق البحث</h3>
            <p className="text-xs text-slate-500">
              {searchTerm || filterSport !== 'ALL'
                ? 'جرب تغيير معايير البحث أو اختيار كل الرياضات'
                : 'لم يتم برمجة بطولات رياضية بعد للموسم الحالي. فور برمجة أي بطولة ستظهر تلقائياً هنا مع إمكانية توليد ملصقها وشواهدها.'}
            </p>
          </div>
          {(searchTerm || filterSport !== 'ALL') && (
            <button
              onClick={() => { setSearchTerm(''); setFilterSport('ALL'); }}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              إعادة ضبط البحث
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredList.map((item) => {
            const { sport, title, categoriesCount, dateStr, venueStr } = item;

            return (
              <div
                key={sport.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-amber-400/50 transition-all overflow-hidden flex flex-col justify-between group"
              >
                {/* Top Section */}
                <div className="p-5 space-y-3 flex-1">
                  {/* Sport Badge & Type */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-50 to-red-50 text-2xl flex items-center justify-center border border-amber-200 shadow-3xs group-hover:scale-105 transition-transform shrink-0">
                        {sport.icon || '🏆'}
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full inline-block">
                          بطولة إقليمية رسمية
                        </span>
                        <h3 className="text-sm font-black text-slate-900 leading-snug mt-1 group-hover:text-amber-700 transition-colors">
                          {title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  {/* Details / Pills */}
                  <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                        <Layers className="h-3.5 w-3.5 text-slate-400" />
                        <span>نوع الرياضة:</span>
                      </span>
                      <span className="font-bold text-slate-800 text-[11px]">
                        {sport.name}
                      </span>
                    </div>

                    {categoriesCount > 0 && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-500">
                          <Trophy className="h-3.5 w-3.5 text-amber-500" />
                          <span>الفئات المعتمدة:</span>
                        </span>
                        <span className="font-bold text-slate-800 text-[11px]">
                          {categoriesCount} فئات عمرية
                        </span>
                      </div>
                    )}

                    {(dateStr || venueStr) && (
                      <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-500">
                        {dateStr && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-red-500" />
                            <span>{dateStr}</span>
                          </span>
                        )}
                        {venueStr && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-blue-500" />
                            <span>{venueStr}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom Actions: TWO prominent buttons as requested */}
                <div className="p-3.5 bg-gradient-to-b from-slate-50 to-slate-100/80 border-t border-slate-200/90 grid grid-cols-2 gap-2">
                  {/* Button 1: توليد ملصق (A4 عمودي) */}
                  <button
                    onClick={() => {
                      setSelectedSportForPoster(sport);
                      setIsPosterModalOpen(true);
                    }}
                    title="توليد وتخصيص ملصق إعلان البطولة (A4 عمودي)"
                    className="py-2.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Palette className="h-4 w-4 text-purple-200 shrink-0" />
                    <span>توليد ملصق 🎨</span>
                  </button>

                  {/* Button 2: توليد شهادة تقديرية (A4 أفقي) */}
                  <button
                    onClick={() => {
                      setSelectedSportForCertificate(sport);
                      setIsCertificateModalOpen(true);
                    }}
                    title="توليد وتخصيص شهادة تقديرية للمشاركين (A4 أفقي)"
                    className="py-2.5 px-3 bg-gradient-to-r from-amber-600 to-red-600 hover:from-amber-700 hover:to-red-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-md flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Award className="h-4 w-4 text-amber-200 shrink-0" />
                    <span>توليد شهادة 🏅</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tournament Poster Generator Modal */}
      {selectedSportForPoster && (
        <TournamentPosterModal
          isOpen={isPosterModalOpen}
          onClose={() => {
            setIsPosterModalOpen(false);
            setSelectedSportForPoster(null);
          }}
          sport={selectedSportForPoster}
          directorateName={directorateName}
          directorateObj={activeDirObj}
          tournaments={tournaments}
          officialLogos={officialLogos}
        />
      )}

      {/* Tournament Certificate Generator Modal */}
      {selectedSportForCertificate && (
        <TournamentCertificateModal
          isOpen={isCertificateModalOpen}
          onClose={() => {
            setIsCertificateModalOpen(false);
            setSelectedSportForCertificate(null);
          }}
          sport={selectedSportForCertificate}
          directorateName={directorateName}
          directorateObj={activeDirObj}
          tournaments={tournaments}
          officialLogos={officialLogos}
          activeSeason={activeSeason}
        />
      )}
    </div>
  );
};
