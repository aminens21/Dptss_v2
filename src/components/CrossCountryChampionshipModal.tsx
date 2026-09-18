import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Tournament, Student, School, User, Sport, CrossCountryCategoryResult, PodiumWinner } from '../types';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason } from '../lib/dataService';
import {
  CROSS_COUNTRY_CATEGORIES,
  CrossCountryCategoryDef,
  calculateTeamRankings,
  calculateRegionalQualifications,
  TeamRankingResult,
  RegionalQualifiedIndividual
} from '../lib/crossCountryConfig';
import { AppLogo } from './AppLogo';
import { CountdownTimer } from './CountdownTimer';
import { RegisterStudentModal } from './RegisterStudentModal';
import { EditDeadlineModal } from './EditDeadlineModal';
import { ParticipationFormPdfModal } from './ParticipationFormPdfModal';
import * as XLSX from 'xlsx';
import {
  X,
  Trophy,
  Users,
  Search,
  Filter,
  Download,
  Printer,
  FileText,
  ShieldCheck,
  Phone,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Layers,
  MapPin,
  Clock,
  GraduationCap,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  Medal,
  Award,
  Sparkles,
  Edit3,
  Plus,
  Trash2,
  Save,
  Info,
  Grid,
  Table,
  CreditCard
} from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadIndividualCardPdf } from '../lib/participationPdfService';

interface CrossCountryChampionshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournaments: Tournament[];
  allStudents: Student[];
  schools: School[];
  techHead?: User;
  activeSeason: string;
  canManage?: boolean;
  onRefreshData?: () => void;
}

export const CrossCountryChampionshipModal: React.FC<CrossCountryChampionshipModalProps> = ({
  isOpen,
  onClose,
  tournaments,
  allStudents,
  schools,
  techHead,
  activeSeason,
  canManage = false,
  onRefreshData
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>('u15_male');
  const [activeTab, setActiveTab] = useState<'participants' | 'results'>('results');
  const [resultsSubTab, setResultsSubTab] = useState<'individual' | 'team' | 'regional'>('individual');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'school_team' | 'individual'>('ALL');
  const [filterSchool, setFilterSchool] = useState<string>('ALL');
  const [participantsViewMode, setParticipantsViewMode] = useState<'table' | 'cards'>('table');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isEditDeadlineOpen, setIsEditDeadlineOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // Results State
  const [results, setResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [loadingResults, setLoadingResults] = useState(false);

  // Edit Result Modal State
  const [isEditResultModalOpen, setIsEditResultModalOpen] = useState(false);
  const [editingWinners, setEditingWinners] = useState<PodiumWinner[]>([]);
  const [editingVenue, setEditingVenue] = useState('');
  const [isSavingResults, setIsSavingResults] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ 
        top: scrollContainerRef.current.scrollHeight, 
        behavior: 'smooth' 
      });
    }
  };

  // Load results from data service
  const loadResults = async () => {
    try {
      setLoadingResults(true);
      const res = await DataService.getCrossCountryResults();
      setResults(res || {});
    } catch (e) {
      console.error('Error loading cross country results:', e);
    } finally {
      setLoadingResults(false);
    }
  };

  // Compute deadline for cross country
  const currentDeadline = useMemo(() => {
    const ccT = tournaments.find(t => t.sportId === 'cross_country');
    return ccT?.registrationDeadline || null;
  }, [tournaments]);

  const ccSportObject: Sport = useMemo(() => ({
    id: 'cross_country',
    name: 'العدو الريفي',
    icon: '🏃‍♂️',
    category: 'Individual',
    description: 'بطولة العدو الريفي المدرسي بمديرية تاوريرت'
  }), []);

  // Refresh data on open
  useEffect(() => {
    if (isOpen) {
      loadResults();
      if (onRefreshData) {
        onRefreshData();
      }
    }
  }, [isOpen]);

  // Filter students participating in cross country
  const ccStudents = useMemo(() => {
    return allStudents.filter(s => s && s.sportId === 'cross_country');
  }, [allStudents]);

  // Selected category object
  const activeCategory = CROSS_COUNTRY_CATEGORIES.find(c => c.id === selectedCatId) || CROSS_COUNTRY_CATEGORIES[0];

  // Participants in active category
  const activeCategoryParticipants = useMemo(() => {
    return ccStudents.filter(s => 
      s && 
      s.category && 
      s.category.toUpperCase() === activeCategory.category.toUpperCase() && 
      s.gender && 
      s.gender.toLowerCase() === activeCategory.gender.toLowerCase()
    );
  }, [ccStudents, activeCategory]);

  // Filtered participants by search, type, and school
  const filteredParticipants = useMemo(() => {
    return activeCategoryParticipants.filter(p => {
      const runnerName = p.fullName || '';
      const runnerSchool = p.schoolName || '';
      const runnerMassar = p.massarNumber || '';
      const matchSearch = runnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          runnerSchool.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          runnerMassar.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === 'ALL' || p.participationType === filterType;
      const matchSchool = filterSchool === 'ALL' || p.schoolId === filterSchool || p.schoolName === filterSchool;
      return matchSearch && matchType && matchSchool;
    });
  }, [activeCategoryParticipants, searchQuery, filterType, filterSchool]);

  // Current category result and calculations
  const activeCategoryResult = useMemo(() => {
    return results[selectedCatId] || {
      categoryId: activeCategory.id,
      category: activeCategory.category,
      gender: activeCategory.gender,
      titleAr: activeCategory.titleAr,
      distance: activeCategory.distance,
      podium: []
    };
  }, [results, selectedCatId, activeCategory]);

  // Calculate team rankings for active category
  const activeTeamRankings = useMemo(() => {
    return calculateTeamRankings(activeCategoryResult?.podium || []);
  }, [activeCategoryResult]);

  // Active winning team
  const activeWinningTeam = useMemo(() => {
    return activeTeamRankings.length > 0 ? activeTeamRankings[0] : null;
  }, [activeTeamRankings]);

  // Regional qualifications
  const activeRegionalQualifications = useMemo(() => {
    return calculateRegionalQualifications(
      activeCategoryResult?.podium || [],
      activeWinningTeam?.schoolName || null
    );
  }, [activeCategoryResult, activeWinningTeam]);

  // Open edit results modal
  const handleOpenEditResults = () => {
    setEditingVenue(activeCategoryResult.venueName || 'مضمار حلبة ألعاب القوى بتاوريرت');
    if (activeCategoryResult.podium && activeCategoryResult.podium.length > 0) {
      setEditingWinners([...activeCategoryResult.podium]);
    } else {
      // Initialize with standard places
      setEditingWinners([
        { rank: 1, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥇' },
        { rank: 2, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥈' },
        { rank: 3, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥉' },
        { rank: 4, fullName: '', schoolName: '', time: '', bibNumber: '', notes: '' },
        { rank: 5, fullName: '', schoolName: '', time: '', bibNumber: '', notes: '' }
      ]);
    }
    setIsEditResultModalOpen(true);
  };

  const handleAddWinnerRow = () => {
    const nextRank = editingWinners.length > 0 ? Math.max(...editingWinners.map(w => w.rank)) + 1 : 1;
    setEditingWinners([...editingWinners, { rank: nextRank, fullName: '', schoolName: '', time: '', bibNumber: '', notes: '' }]);
  };

  const handleRemoveWinnerRow = (index: number) => {
    const updated = editingWinners.filter((_, i) => i !== index);
    setEditingWinners(updated);
  };

  const handleSaveResults = async () => {
    try {
      setIsSavingResults(true);
      const validWinners = editingWinners.filter(w => w.fullName.trim() !== '');
      validWinners.sort((a, b) => a.rank - b.rank);

      const payload: CrossCountryCategoryResult = {
        categoryId: activeCategory.id,
        category: activeCategory.category,
        gender: activeCategory.gender,
        titleAr: activeCategory.titleAr,
        distance: activeCategory.distance,
        venueName: editingVenue,
        updatedAt: new Date().toISOString().split('T')[0],
        podium: validWinners
      };

      await DataService.saveCrossCountryCategoryResult(payload);
      setResults(prev => ({ ...prev, [activeCategory.id]: payload }));
      setIsEditResultModalOpen(false);
      toast.success(`تم حفظ نتائج وتتويج ${activeCategory.titleAr} بنجاح!`);
    } catch (e) {
      console.error('Error saving category results:', e);
      toast.error('حدث خطأ أثناء حفظ النتائج.');
    } finally {
      setIsSavingResults(false);
    }
  };

  if (!isOpen) return null;

  // Total summary statistics
  const totalRunners = ccStudents.length;
  const boysCount = ccStudents.filter(s => s.gender === 'Male').length;
  const girlsCount = ccStudents.filter(s => s.gender === 'Female').length;
  const participatingSchoolIds = Array.from(new Set(ccStudents.map(s => s.schoolId || s.schoolName)));

  // Export single category to Excel
  const handleExportCategoryExcel = (cat: CrossCountryCategoryDef) => {
    const participants = ccStudents.filter(s => s.category === cat.category && s.gender === cat.gender);
    if (participants.length === 0) {
      toast.error(`لا يوجد تلاميذ مسجلين في ${cat.titleAr} حالياً لتصديرهم.`);
      return;
    }

    const excelData = participants.map((p, index) => ({
      'الرقم الترتيبي': index + 1,
      'الاسم والنسب': p.fullName,
      'رقم مسار': p.massarNumber || '—',
      'الجنس': p.gender === 'Male' ? 'ذكر' : 'أنثى',
      'تاريخ الازدياد': p.birthDate,
      'الفئة الرياضية': cat.shortLabel,
      'المسافة المقررة': cat.distance,
      'المؤسسة التعليمية': p.schoolName,
      'نوع المشاركة': p.participationType === 'school_team' ? 'فريق المؤسسة (جماعي)' : 'مشاركة فردية'
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!views'] = [{ RTL: true }];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, cat.shortLabel.substring(0, 30));

    const fileName = `لائحة_مشاركي_${cat.titleAr.replace(/\s+/g, '_')}_${activeSeason.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success(`تم تصدير لائحة ${cat.titleAr} بنجاح!`);
  };

  // Export all 8 categories in one unified workbook
  const handleExportAllUnifiedWorkbook = () => {
    if (ccStudents.length === 0) {
      toast.error('لا يوجد تلاميذ مسجلين في العدو الريفي حالياً لتصديرهم.');
      return;
    }

    const workbook = XLSX.utils.book_new();

    CROSS_COUNTRY_CATEGORIES.forEach(cat => {
      const participants = ccStudents.filter(s => s.category === cat.category && s.gender === cat.gender);
      const sheetData = participants.length > 0
        ? participants.map((p, index) => ({
            'الرقم الترتيبي': index + 1,
            'الاسم والنسب': p.fullName,
            'رقم مسار': p.massarNumber || '—',
            'الجنس': p.gender === 'Male' ? 'ذكر' : 'أنثى',
            'تاريخ الازدياد': p.birthDate,
            'الفئة الرياضية': cat.shortLabel,
            'المسافة المقررة': cat.distance,
            'المؤسسة التعليمية': p.schoolName,
            'نوع المشاركة': p.participationType === 'school_team' ? 'فريق المؤسسة (جماعي)' : 'مشاركة فردية'
          }))
        : [
            {
              'تنبيه': 'لا يوجد تلاميذ مسجلين في هذه الفئة بعد'
            }
          ];

      const worksheet = XLSX.utils.json_to_sheet(sheetData);
      worksheet['!views'] = [{ RTL: true }];
      const sheetName = cat.shortLabel.substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    const fileName = `ملف_العدو_الريفي_الموحد_للفئات_الثمانية_${activeSeason.replace(/\//g, '-')}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    toast.success('تم تصدير الملف الموحد لجميع الفئات الثمانية بنجاح!');
  };

  const firstPlace = activeCategoryResult.podium?.find(w => w.rank === 1);
  const secondPlace = activeCategoryResult.podium?.find(w => w.rank === 2);
  const thirdPlace = activeCategoryResult.podium?.find(w => w.rank === 3);
  const otherRankings = activeCategoryResult.podium?.filter(w => w.rank > 3) || [];

  return (
    <>
      <div ref={scrollContainerRef} className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-4 md:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto scroll-smooth" dir="rtl">
        <div className={`relative w-full bg-white rounded-2xl shadow-2xl border border-slate-200 my-4 sm:my-8 flex flex-col transition-all duration-200 ${
          isFullScreen ? 'max-w-[98vw]' : 'max-w-6xl xl:max-w-7xl'
        }`}>
          {/* Modal Top Header Banner */}
          <div className="p-3 sm:p-4 md:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white border-b border-slate-800 shrink-0">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-xs border border-white/20 flex items-center justify-center shrink-0">
                  <AppLogo size={isHeaderCollapsed ? 28 : 36} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-sm sm:text-base md:text-lg font-black tracking-tight text-white">
                      البطولة الإقليمية المدرسية للعدو الريفي
                    </h2>
                    <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                      8 فئات عمرية مدمجة
                    </span>
                    <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded">
                      الموسم {activeSeason}
                    </span>
                  </div>
                  {!isHeaderCollapsed && (
                    <p className="text-xs text-slate-300 mt-0.5 font-medium">
                      المديرية الإقليمية تاوريرت • الفرع الإقليمي للجامعة الملكية للرياضة المدرسية
                    </p>
                  )}
                </div>
              </div>

              {/* Header controls: collapse/expand, quick register, fullscreen, and close */}
              <div className="flex items-center gap-2 shrink-0 mr-auto">
                <button
                  type="button"
                  onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/15 shadow-2xs"
                  title={isHeaderCollapsed ? 'إظهار لوحة العداد والمؤشرات' : 'إخفاء هذا الجزء لتوسيع جدول وتفاصيل التلاميذ المسجلين'}
                >
                  {isHeaderCollapsed ? (
                    <>
                      <ChevronDown className="h-4 w-4 text-emerald-300 animate-pulse" />
                      <span>إظهار لوحة المؤشرات والعداد</span>
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4 text-amber-300" />
                      <span>إخفاء هذا الجزء (توسيع العرض)</span>
                    </>
                  )}
                </button>

                {isHeaderCollapsed && (
                  <button
                    type="button"
                    onClick={() => setIsRegisterModalOpen(true)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>تسجيل عدائين</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsFullScreen(!isFullScreen)}
                  className="text-slate-300 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title={isFullScreen ? 'استعادة الحجم الطبيعي' : 'ملء الشاشة بالكامل (أقصى اتساع)'}
                >
                  {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {!isHeaderCollapsed && (
              <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-3 animate-in fade-in duration-200">
                <div className="bg-white/5 border border-white/10 rounded-xl p-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <CountdownTimer deadline={currentDeadline} />
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    {canManage && (
                      <button
                        onClick={() => setIsEditDeadlineOpen(true)}
                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>تعديل آخر أجل للتسجيل ✏️</span>
                      </button>
                    )}

                    <button
                      onClick={() => setIsRegisterModalOpen(true)}
                      className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2 hover:scale-102 active:scale-98"
                    >
                      <GraduationCap className="w-4 h-4" />
                      <span>تسجيل عدائين / فرق في هذه البطولة</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center font-bold text-base">
                      🏃
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">إجمالي العدائين</div>
                      <div className="text-sm font-black text-white">{totalRunners} تلميذ(ة)</div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-base">
                      🏫
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">المؤسسات المشاركة</div>
                      <div className="text-sm font-black text-white">{participatingSchoolIds.length} مؤسسة</div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-300 flex items-center justify-center font-bold text-base">
                      👥
                    </div>
                    <div>
                      <div className="text-[10px] text-slate-400 font-medium">توزيع المشاركات</div>
                      <div className="text-xs font-bold text-slate-200">
                        {boysCount} ذكور / {girlsCount} إناث
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-base">
                      🛡️
                    </div>
                    <div className="truncate">
                      <div className="text-[10px] text-slate-400 font-medium">رئيس اللجنة التقنية</div>
                      <div className="text-xs font-bold text-amber-300 truncate">
                        {techHead ? techHead.fullName : 'ذ. عبد الرحيم بلقاسم'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Categories 8-Tab Ribbon with Winning Team Badges */}
          <div className="bg-slate-100 p-2 sm:p-3 border-b border-slate-200 shrink-0">
            <div className="flex items-center justify-between gap-2 mb-2 px-1">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-blue-600" />
                <span>الفئات المشاركة الثمانية المعتمدة (8 Categories):</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                انقر على الفئة لاستعراض تفاصيلها، لوائحها، ونتائج الفريق الفائز
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
              {CROSS_COUNTRY_CATEGORIES.map((cat) => {
                const isSelected = selectedCatId === cat.id;
                const countInCat = ccStudents.filter(s => s.category === cat.category && s.gender === cat.gender).length;
                const catResult = results[cat.id];
                const catTeams = calculateTeamRankings(catResult?.podium || []);
                const catWinningTeam = catTeams.length > 0 ? catTeams[0] : null;

                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatId(cat.id)}
                    className={`p-2 rounded-xl text-right transition-all flex flex-col justify-between border cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/30'
                        : `${cat.colorClass} shadow-xs`
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs">{cat.icon}</span>
                      <div className="flex items-center gap-1">
                        {catWinningTeam && (
                          <span
                            title={`الفريق الفائز: ${catWinningTeam.schoolName} (${catWinningTeam.totalPoints} ن)`}
                            className="text-[9px] bg-amber-400 text-slate-950 font-black px-1 rounded-full shadow-2xs flex items-center gap-0.5"
                          >
                            🏆
                          </span>
                        )}
                        <span
                          className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                            isSelected ? 'bg-white/25 text-white' : 'bg-white text-slate-800 border border-slate-200/60'
                          }`}
                        >
                          {countInCat}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1">
                      <div className={`text-[11px] font-black leading-tight truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {cat.shortLabel}
                      </div>
                      <div className={`text-[9px] font-semibold mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        المسافة: {cat.distance}
                      </div>
                      {catWinningTeam && (
                        <div className={`text-[9px] font-black truncate mt-0.5 ${isSelected ? 'text-amber-300' : 'text-amber-800'}`}>
                          بطل الفرق: {catWinningTeam.schoolName.split(' ')[0]}..
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Area */}
          <div className="p-4 sm:p-5 space-y-4">
            {/* Active Category Header Card */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs">
                    {activeCategory.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900">
                        {activeCategory.titleAr}
                      </h3>
                      <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-black rounded-md">
                        المسافة المقررة: {activeCategory.distance}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[11px] font-bold rounded-md">
                        {activeCategory.genderLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      ضوابط المشاركة: سقف <strong>5 تلاميذ</strong> كفريق للمؤسسة (Team) + سقف <strong>3 تلاميذ</strong> للمشاركة الفردية.
                    </p>
                  </div>
                </div>

                {/* Quick Category Actions */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {canManage && (
                    <button
                      onClick={handleOpenEditResults}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      title="تسجيل أو تعديل نتائج التتويج والبوديوم لهذه الفئة"
                    >
                      <Edit3 className="h-3.5 w-3.5 text-amber-400" />
                      <span>تسجيل / تعديل النتائج</span>
                    </button>
                  )}

                  {canManage && (
                    <button
                      onClick={() => handleExportCategoryExcel(activeCategory)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                      title="تصدير لائحة هذه الفئة إلى Excel"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>تصدير اللائحة (Excel)</span>
                    </button>
                  )}
                  {filterSchool !== 'ALL' && (
                    <button
                      onClick={() => setIsPdfModalOpen(true)}
                      className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      title="معاينة وعرض لائحة المشاركة الرسمية للطباعة والتحميل"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>عرض لائحة المشاركة</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 🏆 WINNING TEAM CARD / BANNER IN ACTIVE CATEGORY */}
              {activeWinningTeam ? (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white border border-amber-400/50 shadow-md animate-in fade-in duration-200">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg border border-amber-300 shrink-0">
                        🏆
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] font-black text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/30 flex items-center gap-1">
                            <span>الفريق الفائز بالبطولة في هذه الفئة (فريق المؤسسة البطل)</span>
                          </span>
                          <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>متأهل جماعياً للبطولة الجهوية للرياضة المدرسية</span>
                          </span>
                        </div>
                        <h4 className="text-base sm:text-lg font-black text-white mt-1 truncate">
                          {activeWinningTeam.schoolName}
                        </h4>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs self-stretch sm:self-auto justify-end">
                      <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                        <span className="text-slate-300 text-[10px] block font-medium">مجموع نقط الأربعة الأوائل:</span>
                        <span className="text-sm font-mono font-black text-amber-300">{activeWinningTeam.totalPoints} نقطة (الأصغر)</span>
                      </div>
                      <div className="bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
                        <span className="text-slate-300 text-[10px] block font-medium">رتبة العداء الرابع (الحاسم):</span>
                        <span className="text-sm font-mono font-black text-blue-200">الرتبة {activeWinningTeam.fourthRunnerRank}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top 4 runners chips for winning team */}
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <div className="text-[11px] font-bold text-slate-300 mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <span>عناصر الفريق الفائز المحتسبين في التتويج (أول 4 عداءين في خط الوصول):</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {activeWinningTeam.top4Runners.map((runner, rIdx) => (
                        <div key={rIdx} className="bg-white/5 border border-white/10 rounded-xl p-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                              runner.rank === 1 ? 'bg-amber-400 text-slate-950 font-black' :
                              runner.rank === 2 ? 'bg-slate-300 text-slate-950 font-black' :
                              runner.rank === 3 ? 'bg-amber-600 text-white font-black' :
                              'bg-blue-500/30 text-blue-200 font-bold'
                            }`}>
                              {runner.rank}
                            </span>
                            <span className="text-xs font-bold text-white truncate">{runner.fullName}</span>
                          </div>
                          {runner.time && (
                            <span className="text-[10px] font-mono text-slate-300 shrink-0">{runner.time}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : activeCategoryResult.podium && activeCategoryResult.podium.length > 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                  <Info className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>لم يتم حسم فريق فائز في هذه الفئة بعد (يشترط وصول 4 عداءين على الأقل من نفس المؤسسة المصرح بمشاركتها كفريق).</span>
                </div>
              ) : null}
            </div>

            {/* View Mode Switcher: Results vs. Registered Participants */}
            <div className="flex items-center justify-between gap-3 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-1.5 flex-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('results')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'results'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Trophy className={`w-3.5 h-3.5 ${activeTab === 'results' ? 'text-amber-500' : 'text-slate-400'}`} />
                  <span>منصة النتائج والتتويج الرسمي</span>
                  {activeCategoryResult.podium && activeCategoryResult.podium.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('participants')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    activeTab === 'participants'
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Users className={`w-3.5 h-3.5 ${activeTab === 'participants' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span>لائحة العدائين المسجلين ({filteredParticipants.length})</span>
                </button>
              </div>
            </div>

            {/* TAB 1: RESULTS & PODIUM VIEW */}
            {activeTab === 'results' && (
              <div className="space-y-4">
                {/* Results Subtabs: Individual Podium vs. Team Rankings vs. Regional Qualifications */}
                <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setResultsSubTab('individual')}
                    className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      resultsSubTab === 'individual'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Medal className="w-3.5 h-3.5" />
                    <span>البوديوم الفردي (الثلاثة الأوائل)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResultsSubTab('team')}
                    className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      resultsSubTab === 'team'
                        ? 'bg-blue-600 text-white font-black shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>ترتيب فرق المؤسسات ({activeTeamRankings.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResultsSubTab('regional')}
                    className={`flex-1 min-w-[120px] py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      resultsSubTab === 'regional'
                        ? 'bg-emerald-600 text-white font-black shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>محضر التأهل الجهوي والبدلاء</span>
                  </button>
                </div>

                {/* SubTab 1: Individual Podium */}
                {resultsSubTab === 'individual' && (
                  <div className="space-y-4">
                    {/* Top 3 Podium Boxes */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* 1st Place */}
                      <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-50 to-yellow-100/60 border-2 border-amber-300 shadow-sm relative overflow-hidden flex flex-col justify-between">
                        <div className="absolute -top-6 -right-6 w-24 h-24 bg-amber-400/20 rounded-full blur-xl pointer-events-none"></div>
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">🥇</span>
                          <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full shadow-2xs">
                            المرتبة الأولى (بطل الفئة)
                          </span>
                        </div>
                        <div className="my-3">
                          <h4 className="text-sm font-black text-slate-900">
                            {firstPlace?.fullName || 'في انتظار تسجيل النتائج'}
                          </h4>
                          <p className="text-xs text-amber-900 font-bold mt-0.5">
                            {firstPlace?.schoolName || '—'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-200 font-mono">
                          <span className="text-slate-500 font-sans text-[10px]">التوقيت:</span>
                          <span className="font-black text-amber-950">{firstPlace?.time || '—'}</span>
                        </div>
                      </div>

                      {/* 2nd Place */}
                      <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-slate-100 border-2 border-slate-300 shadow-sm relative overflow-hidden flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">🥈</span>
                          <span className="text-[10px] font-black bg-slate-300 text-slate-900 px-2 py-0.5 rounded-full shadow-2xs">
                            المرتبة الثانية
                          </span>
                        </div>
                        <div className="my-3">
                          <h4 className="text-sm font-black text-slate-900">
                            {secondPlace?.fullName || 'في انتظار تسجيل النتائج'}
                          </h4>
                          <p className="text-xs text-slate-600 font-bold mt-0.5">
                            {secondPlace?.schoolName || '—'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 font-mono">
                          <span className="text-slate-500 font-sans text-[10px]">التوقيت:</span>
                          <span className="font-black text-slate-800">{secondPlace?.time || '—'}</span>
                        </div>
                      </div>

                      {/* 3rd Place */}
                      <div className="p-4 rounded-2xl bg-gradient-to-b from-amber-50/40 to-orange-100/50 border-2 border-amber-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl">🥉</span>
                          <span className="text-[10px] font-black bg-amber-600 text-white px-2 py-0.5 rounded-full shadow-2xs">
                            المرتبة الثالثة
                          </span>
                        </div>
                        <div className="my-3">
                          <h4 className="text-sm font-black text-slate-900">
                            {thirdPlace?.fullName || 'في انتظار تسجيل النتائج'}
                          </h4>
                          <p className="text-xs text-amber-900 font-bold mt-0.5">
                            {thirdPlace?.schoolName || '—'}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t border-amber-200 font-mono">
                          <span className="text-slate-500 font-sans text-[10px]">التوقيت:</span>
                          <span className="font-black text-amber-950">{thirdPlace?.time || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Other rankings table if available */}
                    {otherRankings.length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="p-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-700">
                          باقي المراكز المسجلة في خط الوصول ({otherRankings.length})
                        </div>
                        <table className="w-full text-center text-xs">
                          <thead className="bg-slate-100/80 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3 text-center w-12">الرتبة</th>
                              <th className="py-2 px-3">الاسم والنسب</th>
                              <th className="py-2 px-3">المؤسسة التعليمية</th>
                              <th className="py-2 px-3 text-center">التوقيت</th>
                              <th className="py-2 px-3 text-center">رقم الصدرية</th>
                              <th className="py-2 px-3">ملاحظات</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {otherRankings.map((r, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="py-2 px-3 text-center font-bold text-slate-500">{r.rank}</td>
                                <td className="py-2 px-3 font-bold text-slate-900">{r.fullName}</td>
                                <td className="py-2 px-3 text-slate-700">{r.schoolName}</td>
                                <td className="py-2 px-3 text-center font-mono font-bold text-slate-600">{r.time || '—'}</td>
                                <td className="py-2 px-3 text-center font-mono">{r.bibNumber || '—'}</td>
                                <td className="py-2 px-3 text-slate-500 text-[11px]">{r.notes || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SubTab 2: Team Rankings */}
                {resultsSubTab === 'team' && (
                  <div className="space-y-4">
                    {activeTeamRankings.length > 0 ? (
                      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="p-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                            <Users className="w-4 h-4 text-blue-600" />
                            <span>جدول ترتيب الفرق الرسمية (احتساب مجموع رتب 4 عداءين الأوائل لكل مؤسسة)</span>
                          </div>
                          <span className="text-[11px] text-blue-700 font-bold">
                            قاعدة الحسم: أصغر مجموع نقاط، وعند التساوي رتبة العداء الرابع
                          </span>
                        </div>

                        <table className="w-full text-center text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 text-center w-14">الترتيب</th>
                              <th className="py-2.5 px-3">المؤسسة التعليمية</th>
                              <th className="py-2.5 px-3 text-center">مجموع النقط (المجموع الأصغر يفوز)</th>
                              <th className="py-2.5 px-3 text-center">رتبة العداء الرابع</th>
                              <th className="py-2.5 px-3 text-center">رتبة أول عداء</th>
                              <th className="py-2.5 px-3 text-center">صفة التأهل</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeTeamRankings.map((team) => (
                              <tr key={team.schoolName} className={team.isWinnerTeam ? 'bg-amber-50/60 font-bold' : 'hover:bg-slate-50'}>
                                <td className="py-2.5 px-3 text-center">
                                  {team.rank === 1 ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-2xs">
                                      🥇
                                    </span>
                                  ) : (
                                    <span className="font-bold text-slate-600">{team.rank}</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-black text-slate-900 flex items-center gap-1.5">
                                    <span>{team.schoolName}</span>
                                    {team.isWinnerTeam && (
                                      <span className="text-[10px] bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded font-black">
                                        الفريق البطل 🏆
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-blue-700">
                                  {team.totalPoints} نقطة
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                                  الرتبة {team.fourthRunnerRank}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono text-slate-700">
                                  الرتبة {team.firstRunnerRank}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {team.isWinnerTeam ? (
                                    <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      متأهل للبطولة الجهوية 🚀
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-[10px]">غير متأهل</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-8 text-center text-slate-500 bg-white rounded-xl border border-slate-200 space-y-2">
                        <Users className="w-10 h-10 text-slate-300 mx-auto" />
                        <p className="text-xs font-bold text-slate-700">لا يوجد ترتيب للفرق مسجل حالياً</p>
                        <p className="text-[11px] text-slate-400">
                          يشترط وجود 4 عداءين على الأقل من نفس المؤسسة في خط الوصول لاحتساب المؤسسة ضمن ترتيب الفرق.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* SubTab 3: Regional Qualifications & Replacements */}
                {resultsSubTab === 'regional' && (
                  <div className="space-y-4">
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                      <div className="p-3 bg-emerald-50/50 border-b border-emerald-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                          <ShieldCheck className="w-4 h-4 text-emerald-600" />
                          <span>محضر التأهل الفردي والجماعي للبطولة الجهوية للرياضة المدرسية</span>
                        </div>
                        <span className="text-[11px] text-emerald-700 font-bold">
                          تطبيق قاعدة تعويض المتوج الفردي المتأهل مع فريقه
                        </span>
                      </div>

                      {activeRegionalQualifications.length > 0 ? (
                        <table className="w-full text-center text-xs">
                          <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2.5 px-3 text-center w-14">مقعد التأهل</th>
                              <th className="py-2.5 px-3">العداء المؤهل</th>
                              <th className="py-2.5 px-3">المؤسسة التعليمية</th>
                              <th className="py-2.5 px-3 text-center">الرتبة في السباق</th>
                              <th className="py-2.5 px-3">نوع وصفة التأهل</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {activeRegionalQualifications.map((item) => (
                              <tr key={item.qualifyingRank} className="hover:bg-slate-50">
                                <td className="py-2.5 px-3 text-center">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs">
                                    {item.qualifyingRank}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 font-black text-slate-900">
                                  {item.runner.fullName}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700">
                                  {item.runner.schoolName}
                                </td>
                                <td className="py-2.5 px-3 text-center font-mono font-bold text-blue-700">
                                  المركز {item.originalFinishRank}
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    item.isReplacement
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                    {item.reasonAr}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <div className="p-8 text-center text-slate-500 space-y-2">
                          <ShieldCheck className="w-10 h-10 text-slate-300 mx-auto" />
                          <p className="text-xs font-bold text-slate-700">في انتظار تسجيل نتائج السباق</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: REGISTERED ATHLETES TABLE */}
            {activeTab === 'participants' && (
              <div className="space-y-3">
                {/* Search & Sub-filters */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <div className="flex flex-1 items-center px-2 w-full bg-white rounded-lg border border-slate-200">
                    <Search className="h-3.5 w-3.5 text-slate-400 ml-2 shrink-0" />
                    <input
                      type="text"
                      placeholder="ابحث بالاسم، رقم مسار، أو المؤسسة..."
                      className="w-full border-0 focus:ring-0 text-xs py-1.5 text-slate-800 placeholder-slate-400 focus:outline-none"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-3xs">
                      <button
                        onClick={() => setParticipantsViewMode('table')}
                        className={`p-1.5 rounded-md transition-all ${participantsViewMode === 'table' ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}
                        title="عرض الجدول"
                      >
                        <Table className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setParticipantsViewMode('cards')}
                        className={`p-1.5 rounded-md transition-all ${participantsViewMode === 'cards' ? 'bg-blue-100 text-blue-700' : 'text-slate-400 hover:text-slate-600'}`}
                        title="عرض البطاقات"
                      >
                        <Grid className="h-4 w-4" />
                      </button>
                    </div>

                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value as any)}
                      className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full sm:w-auto"
                    >
                      <option value="ALL">جميع أنواع المشاركة</option>
                      <option value="school_team">فريق المؤسسة (جماعي)</option>
                      <option value="individual">مشاركة فردية</option>
                    </select>

                    <select
                      value={filterSchool}
                      onChange={(e) => setFilterSchool(e.target.value)}
                      className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer w-full sm:w-auto max-w-[180px]"
                    >
                      <option value="ALL">جميع المؤسسات</option>
                      {schools.map(sch => (
                        <option key={sch.id} value={sch.id}>
                          {sch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Table of Registered Athletes */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>لائحة العدائين المسجلين في {activeCategory.shortLabel}</span>
                    <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      المجموع: {filteredParticipants.length} عداء(ة)
                    </span>
                  </div>

                  {filteredParticipants.length > 0 ? (
                    participantsViewMode === 'table' ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-center text-xs">
                          <thead className="bg-slate-100/80 text-slate-600 border-b border-slate-200 font-bold">
                            <tr>
                              <th className="py-2.5 px-3 text-center w-12">#</th>
                              <th className="py-2.5 px-3">العداء(ة)</th>
                              <th className="py-2.5 px-3">رقم مسار</th>
                              <th className="py-2.5 px-3">المؤسسة التعليمية</th>
                              <th className="py-2.5 px-3 text-center">نوع المشاركة</th>
                              <th className="py-2.5 px-3 text-center">المسافة</th>
                              <th className="py-2.5 px-3 text-center">تاريخ الازدياد</th>
                              <th className="py-2.5 px-3 text-center">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {filteredParticipants.map((runner, index) => (
                              <tr key={runner.id || `runner-${index}`} className={`transition-colors ${runner.participationType === 'individual' ? 'bg-amber-50/20 hover:bg-amber-100/30' : 'hover:bg-blue-50/40'}`}>
                                <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                                  {index + 1}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2.5">
                                    {runner.photoUrl ? (
                                      <img
                                        src={runner.photoUrl}
                                        alt={runner.fullName}
                                        className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                                        referrerPolicy="no-referrer"
                                      />
                                    ) : (
                                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                        {runner.gender === 'Male' ? '🏃‍♂️' : '🏃‍♀️'}
                                      </div>
                                    )}
                                    <div>
                                      <div className="font-black text-slate-900 text-xs">{runner.fullName}</div>
                                      <div className="text-[10px] text-slate-400 font-medium">
                                        {runner.gender === 'Male' ? 'تلميذ (ذكر)' : 'تلميذة (أنثى)'}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-700">
                                  {runner.massarNumber ? (
                                    <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-blue-900">
                                      {runner.massarNumber}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-800">{runner.schoolName}</div>
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <span
                                    className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                      runner.participationType === 'school_team'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                    }`}
                                  >
                                    {runner.participationType === 'school_team' ? '👥 فريق المؤسسة' : '👤 مشاركة فردية'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap font-bold text-blue-700">
                                  {runner.distance || activeCategory.distance}
                                </td>
                                <td className="py-2.5 px-3 text-center whitespace-nowrap text-slate-500 font-mono text-[11px]">
                                  {runner.birthDate || '—'}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  {runner.participationType === 'individual' && (
                                    <button
                                      onClick={() => downloadIndividualCardPdf(runner, { id: 'cross_country', name: 'العدو الريفي' }, activeSeason)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer"
                                      title="تحميل بطاقة المشارك الفردية"
                                    >
                                      <CreditCard className="h-4 w-4" />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50/50">
                        {filteredParticipants.map((runner, index) => (
                          <div 
                            key={runner.id || `runner-card-${index}`} 
                            className={`bg-white rounded-xl border p-3 shadow-sm hover:shadow-md transition-all relative overflow-hidden group ${
                              runner.participationType === 'individual' ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200'
                            }`}
                          >
                            {runner.participationType === 'individual' && (
                              <div className="absolute top-0 left-0 bg-amber-500 text-white text-[9px] font-black px-2 py-0.5 rounded-br-lg uppercase tracking-tighter">
                                Individual
                              </div>
                            )}
                            
                            <div className="flex gap-3">
                              <div className="shrink-0 relative">
                                {runner.photoUrl ? (
                                  <img
                                    src={runner.photoUrl}
                                    alt={runner.fullName}
                                    className="w-16 h-20 rounded-lg object-cover border border-slate-200"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-16 h-20 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-2xl">
                                    {runner.gender === 'Male' ? '🏃‍♂️' : '🏃‍♀️'}
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 min-width-0">
                                <div className="font-black text-slate-900 text-[13px] leading-tight mb-1 truncate">
                                  {runner.fullName}
                                </div>
                                <div className="text-[10px] text-slate-500 font-bold mb-2">
                                  {runner.schoolName}
                                </div>
                                
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400 font-medium">رقم مسار:</span>
                                    <span className="font-mono font-bold text-blue-700">{runner.massarNumber || '—'}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400 font-medium">الفئة:</span>
                                    <span className="font-bold text-slate-700">{runner.category || activeCategory.shortLabel}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400 font-medium">المسافة:</span>
                                    <span className="font-bold text-emerald-600">{runner.distance || activeCategory.distance}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                              <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${
                                runner.participationType === 'school_team'
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}>
                                {runner.participationType === 'school_team' ? 'فريق المؤسسة' : 'مشاركة فردية'}
                              </span>
                              
                              <button
                                onClick={() => downloadIndividualCardPdf(runner, { id: 'cross_country', name: 'العدو الريفي' }, activeSeason)}
                                className="flex items-center gap-1.5 px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer"
                              >
                                <Download className="h-3 w-3" />
                                <span>بطاقة المشارك</span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : (
                    <div className="p-8 text-center text-slate-500 space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto text-xl font-bold">
                        🏃
                      </div>
                      <p className="text-xs font-bold text-slate-700">لا يوجد تلاميذ مسجلين في هذه الفئة حالياً</p>
                      <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                        يمكن للأساتذة المؤطرين تسجيل فرقهم في فئة {activeCategory.shortLabel} عبر فضاء "فرق المؤسسة" مع احترام السقف المحدد.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Floating Scroll to Top / Bottom Buttons */}
          {filteredParticipants.length > 3 && (
            <div className="fixed bottom-6 left-6 z-50 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={scrollToTop}
                className="w-11 h-11 rounded-full bg-slate-900/95 hover:bg-slate-950 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-115 active:scale-90 cursor-pointer border border-slate-700/50"
                title="الانتقال إلى أعلى القائمة"
              >
                <ChevronUp className="h-6 w-6 text-blue-400" />
              </button>
              <button
                type="button"
                onClick={scrollToBottom}
                className="w-11 h-11 rounded-full bg-slate-900/95 hover:bg-slate-950 text-white shadow-2xl flex items-center justify-center transition-all hover:scale-115 active:scale-90 cursor-pointer border border-slate-700/50"
                title="الانتقال إلى أسفل القائمة"
              >
                <ChevronDown className="h-6 w-6 text-blue-400" />
              </button>
            </div>
          )}

          {/* Modal Bottom Footer Actions */}
          <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span className="font-medium">
                يتم تحديث لوائح المشاركين ونتائج التتويج تلقائياً وبشكل فوري عبر المنظومة.
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {canManage && (
                <button
                  onClick={handleExportAllUnifiedWorkbook}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors shadow-xs cursor-pointer"
                >
                  <Download className="h-4 w-4" />
                  <span>تحميل الملف الموحد لجميع الفئات (Excel)</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Results Modal */}
      {isEditResultModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-xl">
                  🏆
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    تسجيل وتعديل نتائج سباق: {activeCategory.titleAr}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    إدخال الرتب الرسمية للعدائين لحساب التتويج الفردي وترتيب الفرق الفائزة
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditResultModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مكان إجراء السباق / المضمار:
                </label>
                <input
                  type="text"
                  value={editingVenue}
                  onChange={(e) => setEditingVenue(e.target.value)}
                  placeholder="مضمار حلبة ألعاب القوى..."
                  className="w-full text-xs font-bold p-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-black text-slate-800">
                    لائحة العدائين الواصلين حسب الرتبة:
                  </label>
                  <button
                    type="button"
                    onClick={handleAddWinnerRow}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة رتبة أخرى</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {editingWinners.map((winner, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
                      <div className="w-12 text-center shrink-0">
                        <span className={`inline-block font-black px-2 py-0.5 rounded text-xs ${
                          winner.rank === 1 ? 'bg-amber-400 text-slate-950' :
                          winner.rank === 2 ? 'bg-slate-300 text-slate-950' :
                          winner.rank === 3 ? 'bg-amber-600 text-white' :
                          'bg-slate-200 text-slate-700'
                        }`}>
                          #{winner.rank}
                        </span>
                      </div>

                      <input
                        type="text"
                        placeholder="الاسم والنسب..."
                        value={winner.fullName}
                        onChange={(e) => {
                          const updated = [...editingWinners];
                          updated[idx].fullName = e.target.value;
                          setEditingWinners(updated);
                        }}
                        className="flex-1 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />

                      <select
                        value={winner.schoolName}
                        onChange={(e) => {
                          const updated = [...editingWinners];
                          updated[idx].schoolName = e.target.value;
                          setEditingWinners(updated);
                        }}
                        className="w-44 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="">اختر المؤسسة...</option>
                        {schools.map(sch => (
                          <option key={sch.id} value={sch.name}>
                            {sch.name}
                          </option>
                        ))}
                      </select>

                      <input
                        type="text"
                        placeholder="التوقيت (مثال: 04:32)"
                        value={winner.time || ''}
                        onChange={(e) => {
                          const updated = [...editingWinners];
                          updated[idx].time = e.target.value;
                          setEditingWinners(updated);
                        }}
                        className="w-24 p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 text-center"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveWinnerRow(idx)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer shrink-0"
                        title="حذف هذا الصف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsEditResultModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveResults}
                disabled={isSavingResults}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingResults ? 'جاري الحفظ...' : 'حفظ النتائج واحتساب التتويج'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Register Student Modal */}
      <RegisterStudentModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        sport={ccSportObject}
        preselectedCategory={activeCategory.category}
        preselectedGender={activeCategory.gender}
        preselectedAffiliation="non_club"
        schools={schools}
        registrationDeadline={currentDeadline}
        onRegistered={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Edit Deadline Modal */}
      <EditDeadlineModal
        isOpen={isEditDeadlineOpen}
        onClose={() => setIsEditDeadlineOpen(false)}
        sport={ccSportObject}
        tournaments={tournaments}
        onUpdated={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {isPdfModalOpen && filterSchool !== 'ALL' && (
        <ParticipationFormPdfModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          sport={ccSportObject}
          schoolName={filterSchool}
          students={ccStudents.filter(s => s.schoolId === filterSchool || s.schoolName === filterSchool)}
          season={activeSeason}
        />
      )}
    </>
  );
};
