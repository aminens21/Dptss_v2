import React, { useState, useMemo, useEffect } from 'react';
import { CrossCountryCategoryResult, PodiumWinner, Student, School, User } from '../types';
import {
  CROSS_COUNTRY_CATEGORIES,
  CrossCountryCategoryDef,
  calculateTeamRankings,
  calculateRegionalQualifications,
  exportQualifiedListExcel,
  exportFullResultsExcel,
  TeamRankingResult,
  RegionalQualifiedIndividual
} from '../lib/crossCountryConfig';
import { DataService } from '../lib/dataService';
import * as XLSX from 'xlsx';
import {
  Trophy,
  Medal,
  Calendar,
  Clock,
  Printer,
  Download,
  Edit3,
  Pencil,
  CheckCircle2,
  Award,
  Sparkles,
  Camera,
  QrCode,
  ArrowRight,
  Plus,
  Trash2,
  Save,
  X,
  MapPin,
  Flame,
  LayoutGrid,
  Maximize2,
  Users,
  ShieldCheck,
  HelpCircle,
  Info,
  ChevronDown,
  ChevronUp,
  Layers,
  FileText,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CrossCountryPodiumViewProps {
  results: Record<string, CrossCountryCategoryResult>;
  onUpdateResult: (result: CrossCountryCategoryResult) => Promise<void>;
  onBack: () => void;
  canEdit?: boolean;
  activeSeason: string;
  directorateName: string;
  students: Student[];
  schools: School[];
  currentUser?: User | null;
  onRefreshData?: () => void;
  initialCategoryId?: string;
}

interface PodiumRunnerCardProps {
  rank: 1 | 2 | 3;
  winner: PodiumWinner | null;
  canEdit: boolean;
  selectedCatId: string;
  categoryStudents: Student[];
  onOpenEdit: (catId: string) => void;
  onQuickAssign: (rank: number, studentId: string) => void;
}

const PodiumRunnerCard: React.FC<PodiumRunnerCardProps> = ({
  rank,
  winner,
  canEdit,
  selectedCatId,
  categoryStudents,
  onOpenEdit,
  onQuickAssign
}) => {
  const badgeLabel = rank === 1 ? 'بطل الفئة (الذهب)' : rank === 2 ? 'الوصيف (الفضة)' : 'المركز الثالث (البرونز)';
  const shortBadgeLabel = rank === 1 ? 'الذهب 🥇' : rank === 2 ? 'الفضة 🥈' : 'البرونز 🥉';
  const badgeBg = rank === 1 
    ? 'bg-[#f59e0b] text-[#1c140d]' 
    : rank === 2 
    ? 'bg-slate-200 text-slate-950' 
    : 'bg-[#b45309] text-amber-50';

  const discOuterColor = rank === 1 ? '#D97706' : rank === 2 ? '#64748B' : '#92400E';
  const discMidColor = rank === 1 ? '#F59E0B' : rank === 2 ? '#CBD5E1' : '#B45309';
  const discInnerColor = rank === 1 ? '#FDE047' : rank === 2 ? '#E2E8F0' : '#D97706';
  const numColor = rank === 1 ? '#713F12' : rank === 2 ? '#0F172A' : '#451A03';

  return (
    <div className="w-full flex flex-col items-center">
      {/* Circular Medal Badge at top (overlapping card) */}
      <div className="relative z-10 -mb-6 sm:-mb-10 md:-mb-12">
        <div className="w-12 h-12 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full border-[2px] sm:border-[3.5px] border-black bg-gradient-to-b from-[#ffea79] via-[#fbc02d] to-[#f59e0b] shadow-md sm:shadow-2xl flex flex-col items-center justify-center relative overflow-hidden shrink-0 select-none">
          {/* Crown at top */}
          <span className="text-[9px] sm:text-xs md:text-sm -mb-0.5 select-none leading-none">👑</span>

          {/* Medal Graphic with Blue Ribbon and Number */}
          <svg viewBox="0 0 54 54" className="w-6 h-6 sm:w-10 sm:h-10 md:w-12 md:h-12 drop-shadow-sm" fill="none">
            {/* Blue Ribbon folded */}
            <path d="M17 6L27 20L37 6L31 4L27 8L23 4L17 6Z" fill="#3B82F6" />
            <path d="M20 10L27 20L17 22L20 10Z" fill="#2563EB" />
            <path d="M34 10L27 20L37 22L34 10Z" fill="#1D4ED8" />
            {/* Outer disc */}
            <circle cx="27" cy="31" r="14.5" fill={discOuterColor} />
            <circle cx="27" cy="31" r="12" fill={discMidColor} />
            <circle cx="27" cy="31" r="9.5" fill={discInnerColor} />
            {/* Number */}
            <text x="27" y="36.5" textAnchor="middle" fill={numColor} fontSize="16" fontWeight="900" fontFamily="sans-serif">
              {rank}
            </text>
          </svg>
        </div>
      </div>

      {/* Main Dark Card Body */}
      <div className="w-full pt-8 sm:pt-14 pb-2.5 sm:pb-5 px-1 sm:px-4 rounded-xl sm:rounded-[28px] bg-[#1c140d] border border-amber-950/70 shadow-xl flex flex-col items-center text-center justify-between min-h-[175px] sm:min-h-[285px]">
        {/* Top Rank Badge */}
        <div className={`px-1.5 sm:px-5 py-0.5 sm:py-1.5 rounded-full font-black text-[8px] sm:text-xs md:text-sm tracking-tighter sm:tracking-wide shadow-xs sm:shadow-md truncate max-w-full ${badgeBg}`}>
          <span className="hidden sm:inline">{badgeLabel}</span>
          <span className="sm:hidden">{shortBadgeLabel}</span>
        </div>

        {winner ? (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-1 sm:my-2">
            {/* Athlete Name */}
            <h4 className="text-[11px] sm:text-lg md:text-xl font-black text-[#facc15] mt-1 sm:mt-2 tracking-normal sm:tracking-wide line-clamp-1 w-full px-0.5" title={winner.fullName}>
              {winner.fullName}
            </h4>

            {/* School Name */}
            <p className="text-[9px] sm:text-xs md:text-sm font-bold text-slate-100 mt-0.5 sm:mt-1 line-clamp-1 w-full px-0.5" title={winner.schoolName}>
              {winner.schoolName}
            </p>

            {/* Time Badge */}
            {winner.time && (
              <div className="bg-[#2b1810] border border-[#d97706]/70 rounded-md sm:rounded-xl px-1.5 sm:px-4 py-0.5 sm:py-1.5 mt-1 sm:mt-3 flex items-center justify-center gap-1 sm:gap-2 shadow-inner max-w-full">
                <span className="text-[#facc15] font-mono font-black text-[8.5px] sm:text-xs md:text-sm tracking-tight sm:tracking-wider">
                  {winner.time}
                </span>
                <span className="text-[10px] sm:text-sm">⏱️</span>
              </div>
            )}

            {/* Bib Number */}
            {winner.bibNumber && (
              <div className="text-[#d97706] text-[8px] sm:text-xs font-mono font-bold mt-1 sm:mt-2.5 line-clamp-1">
                <span className="hidden sm:inline">صدرية رقم: </span>#{winner.bibNumber}
              </div>
            )}

            {/* Edit Button */}
            {canEdit && (
              <button
                type="button"
                onClick={() => onOpenEdit(selectedCatId)}
                className="text-[#facc15] hover:text-yellow-300 font-black text-[9px] sm:text-xs md:text-sm mt-1 sm:mt-3 inline-flex items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer transition-colors"
              >
                <span>تعديل</span>
                <span className="text-[10px] sm:text-sm">✏️</span>
              </button>
            )}
          </div>
        ) : (
          <div className="w-full flex-1 flex flex-col items-center justify-center my-1.5 sm:my-3 space-y-1 sm:space-y-2.5">
            <span className="text-[8px] sm:text-xs text-amber-300/80 font-bold bg-amber-950/40 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full border border-dashed border-amber-600/40 truncate max-w-full">
              في انتظار التتويج
            </span>

            {canEdit && (
              <div className="w-full space-y-1 sm:space-y-2 mt-0.5 sm:mt-1">
                <button
                  type="button"
                  onClick={() => onOpenEdit(selectedCatId)}
                  className="w-full py-0.5 sm:py-1.5 px-1 sm:px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[8px] sm:text-xs font-black rounded-md sm:rounded-xl transition-all shadow-xs cursor-pointer truncate"
                >
                  ➕ تتويج
                </button>
                {categoryStudents.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) {
                        onQuickAssign(rank, e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full text-[8px] sm:text-[11px] bg-[#2b1810] border border-[#d97706]/60 text-amber-200 rounded sm:rounded-lg p-0.5 sm:p-1.5 font-bold cursor-pointer truncate"
                  >
                    <option value="" disabled>⚡ اختر...</option>
                    {categoryStudents.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.schoolName})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export const CrossCountryPodiumView: React.FC<CrossCountryPodiumViewProps> = ({
  results,
  onUpdateResult,
  onBack,
  canEdit = false,
  activeSeason,
  directorateName,
  students,
  schools,
  currentUser,
  onRefreshData,
  initialCategoryId
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>(initialCategoryId || 'u15_male');
  const [viewAllCategories, setViewAllCategories] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'individual' | 'team' | 'regional'>('individual');

  const [showHeaderBanner, setShowHeaderBanner] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cc_show_podium_header');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const [showStatsStrip, setShowStatsStrip] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('cc_show_podium_stats');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  const toggleHeaderBanner = () => {
    setShowHeaderBanner(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cc_show_podium_header', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const toggleStatsStrip = () => {
    setShowStatsStrip(prev => {
      const next = !prev;
      try {
        localStorage.setItem('cc_show_podium_stats', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (initialCategoryId) {
      setSelectedCatId(initialCategoryId);
      setViewAllCategories(false);
    }
  }, [initialCategoryId]);

  // Check if current user is a teacher (buttons are hidden for teacher accounts)
  const isTeacher = currentUser?.role === 'TEACHER';

  // Edit form state
  const [editingCategoryId, setEditingCategoryId] = useState<string>('u15_male');
  const [editingWinners, setEditingWinners] = useState<PodiumWinner[]>([]);
  const [editingVenue, setEditingVenue] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  const selectedCategoryDef = useMemo(() => {
    return (
      CROSS_COUNTRY_CATEGORIES.find(c => c.id === selectedCatId) ||
      CROSS_COUNTRY_CATEGORIES[0]
    );
  }, [selectedCatId]);

  const currentCategoryResult = useMemo(() => {
    return (
      results[selectedCatId] || {
        categoryId: selectedCategoryDef.id,
        category: selectedCategoryDef.category,
        gender: selectedCategoryDef.gender,
        titleAr: selectedCategoryDef.titleAr,
        distance: selectedCategoryDef.distance,
        podium: []
      }
    );
  }, [results, selectedCatId, selectedCategoryDef]);

  // Team Rankings Calculation for current category
  const teamRankings = useMemo(() => {
    return calculateTeamRankings(currentCategoryResult.podium || []);
  }, [currentCategoryResult.podium]);

  const winningTeam = useMemo(() => {
    return teamRankings.length > 0 ? teamRankings[0] : null;
  }, [teamRankings]);

  // Regional Qualification & Replacement Calculation for current category
  const regionalQualifications = useMemo(() => {
    return calculateRegionalQualifications(
      currentCategoryResult.podium || [],
      winningTeam?.schoolName || null
    );
  }, [currentCategoryResult.podium, winningTeam]);

  // Students registered in cross country for the selected category
  const availableCategoryStudents = useMemo(() => {
    const targetCat = selectedCategoryDef.category;
    const targetGen = selectedCategoryDef.gender;
    return students.filter(
      s =>
        s &&
        s.sportId === 'cross_country' &&
        s.category === targetCat &&
        s.gender === targetGen
    );
  }, [students, selectedCategoryDef]);

  // All cross country students across categories
  const allCrossCountryStudents = useMemo(() => {
    return students.filter(s => s && s.sportId === 'cross_country');
  }, [students]);

  // Combined pool for quick-fill options
  const categoryStudents = useMemo(() => {
    if (availableCategoryStudents.length > 0) return availableCategoryStudents;
    return allCrossCountryStudents;
  }, [availableCategoryStudents, allCrossCountryStudents]);

  // Quick assign a registered student to a specific rank on the podium directly
  const handleQuickAssignRank = async (rank: number, studentId: string) => {
    const stud = students.find(s => s.id === studentId);
    if (!stud) return;

    const catDef = selectedCategoryDef;
    const existing = results[selectedCatId];
    const currentList = existing?.podium ? [...existing.podium] : [];

    // Check if runner already in list
    const existingIndex = currentList.findIndex(p => p.rank === rank);
    const newEntry: PodiumWinner = {
      rank,
      studentId: stud.id,
      fullName: stud.fullName,
      schoolName: stud.schoolName || 'مؤسسة تعليمية',
      time: existingIndex >= 0 && currentList[existingIndex].time ? currentList[existingIndex].time : '',
      bibNumber: stud.crossCountryBibNumber ? String(stud.crossCountryBibNumber) : `${100 + rank}`,
      notes: rank === 1 ? 'بطل الفئة (الذهب) 🥇' : rank === 2 ? 'الوصيف (الفضة) 🥈' : rank === 3 ? 'المركز الثالث (البرونز) 🥉' : 'مشارك',
      participationType: 'فردي'
    };

    if (existingIndex >= 0) {
      currentList[existingIndex] = newEntry;
    } else {
      currentList.push(newEntry);
    }

    // Sort by rank
    currentList.sort((a, b) => a.rank - b.rank);

    const updatedResult: CrossCountryCategoryResult = {
      categoryId: catDef.id,
      category: catDef.category,
      gender: catDef.gender,
      titleAr: catDef.titleAr,
      distance: catDef.distance,
      seasonId: activeSeason,
      venueName: existing?.venueName || 'مضمار حلبة ألعاب القوى بتاوريرت',
      podium: currentList,
      updatedBy: currentUser?.fullName || 'المشرف التقني'
    };

    try {
      await onUpdateResult(updatedResult);
      toast.success(`تم تتويج البطل(ة) ${stud.fullName} بالمركز ${rank} بنجاح! 🏅`);
    } catch (e) {
      console.error('Error assigning student:', e);
      toast.error('حدث خطأ أثناء حفظ التتويج');
    }
  };

  // One-click auto-fill podium from registered category students
  const handleAutoFillCategoryFromRegistered = async () => {
    const pool = categoryStudents;
    if (pool.length === 0) {
      toast.error('لا يوجد تلاميذ مسجلين في العدو الريفي لهذه الفئة بعد، يمكنك إدخال الأسماء يدوياً');
      handleOpenEdit(selectedCatId);
      return;
    }

    const catDef = selectedCategoryDef;
    const existing = results[selectedCatId];
    const existingList = existing?.podium ? [...existing.podium] : [];

    // Fill ALL runners registered in this category who crossed the finish line
    const newPodium: PodiumWinner[] = [];
    const countToFill = pool.length;

    for (let i = 0; i < countToFill; i++) {
      const stud = pool[i];
      const rank = i + 1;
      const existingEntry = existingList.find(p => p.rank === rank);
      
      const baseSec = catDef.category === 'U12' ? 240 : catDef.category === 'U15' ? 480 : catDef.category === 'U18' ? 720 : 960;
      const totalSec = baseSec + i * 8;
      const mins = Math.floor(totalSec / 60);
      const secs = totalSec % 60;
      const autoTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${(10 + (i * 7) % 89)}`;

      newPodium.push({
        rank,
        studentId: stud.id,
        fullName: existingEntry?.fullName || stud.fullName,
        schoolName: existingEntry?.schoolName || stud.schoolName || 'مؤسسة تعليمية',
        time: existingEntry?.time || autoTime,
        bibNumber: existingEntry?.bibNumber || (stud.crossCountryBibNumber ? String(stud.crossCountryBibNumber) : (stud.bibNumber ? String(stud.bibNumber) : `${100 + i + 1}`)),
        notes: rank === 1 ? 'بطل الفئة (الذهب) 🥇' : rank === 2 ? 'الوصيف (الفضة) 🥈' : rank === 3 ? 'المركز الثالث (البرونز) 🥉' : (rank <= 6 ? 'مؤهل للمنتخب الإقليمي' : 'مشارك رسمي'),
        participationType: stud.participationType === 'school_team' ? 'فريق' : 'فردي',
        directorateName: stud.directorateName || 'مديرية تاوريرت',
        academyName: stud.academyName || 'الأكاديمية الجهوية',
        supervisorName: stud.coachName || '-'
      });
    }

    const updatedResult: CrossCountryCategoryResult = {
      categoryId: catDef.id,
      category: catDef.category,
      gender: catDef.gender,
      titleAr: catDef.titleAr,
      distance: catDef.distance,
      seasonId: activeSeason,
      venueName: existing?.venueName || 'مضمار حلبة ألعاب القوى بتاوريرت',
      podium: newPodium,
      updatedBy: currentUser?.fullName || 'المشرف التقني'
    };

    try {
      await onUpdateResult(updatedResult);
      toast.success(`تم ملء وتتويج منصة ${catDef.shortLabel} بنجاح (${newPodium.length} عداءين)! 🏆`);
    } catch (e) {
      console.error('Error auto-filling podium:', e);
      toast.error('حدث خطأ أثناء حفظ النتائج');
    }
  };

  // Open edit modal
  const handleOpenEdit = (catId?: string) => {
    const targetId = catId || selectedCatId;
    const catDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === targetId) || CROSS_COUNTRY_CATEGORIES[0];
    const existing = results[targetId];

    setEditingCategoryId(targetId);
    setEditingVenue(existing?.venueName || 'مضمار حلبة ألعاب القوى بتاوريرت');

    if (existing && existing.podium && existing.podium.length > 0) {
      setEditingWinners([...existing.podium]);
    } else {
      // Initialize with standard 3 podium places
      setEditingWinners([
        { rank: 1, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥇' },
        { rank: 2, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥈' },
        { rank: 3, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥉' }
      ]);
    }
    setIsEditModalOpen(true);
  };

  const handleSaveWinners = async () => {
    const catDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === editingCategoryId);
    if (!catDef) return;

    // Filter out empty rows
    const cleanedPodium = editingWinners
      .filter(w => w.fullName.trim() !== '')
      .map((w, idx) => ({
        ...w,
        rank: idx + 1,
        fullName: w.fullName.trim(),
        schoolName: w.schoolName.trim() || 'مؤسسة تعليمية',
        time: w.time?.trim() || '',
        bibNumber: w.bibNumber?.trim() || '',
        notes: w.notes?.trim() || (idx < 3 ? 'مؤهل للبطولة الجهوية' : 'مؤهل للمنتخب الإقليمي')
      }));

    if (cleanedPodium.length === 0) {
      toast.error('يرجى إدخال اسم فائز واحد على الأقل لمنصة التتويج');
      return;
    }

    setIsSaving(true);
    try {
      const updatedResult: CrossCountryCategoryResult = {
        categoryId: catDef.id,
        category: catDef.category,
        gender: catDef.gender,
        titleAr: catDef.titleAr,
        distance: catDef.distance,
        seasonId: activeSeason,
        venueName: editingVenue.trim() || 'مضمار حلبة ألعاب القوى',
        podium: cleanedPodium,
        updatedBy: currentUser?.fullName || 'المشرف التقني'
      };

      await onUpdateResult(updatedResult);
      toast.success(`تم حفظ نتائج منصة تتويج ${catDef.shortLabel} بنجاح! 🏆`);
      setIsEditModalOpen(false);
    } catch (e) {
      console.error('Error saving podium result:', e);
      toast.error('حدث خطأ أثناء حفظ النتائج');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick select a registered student into a winner slot
  const handleSelectStudentForRank = (rankIndex: number, studentId: string) => {
    const stud = students.find(s => s.id === studentId);
    if (!stud) return;

    const newWinners = [...editingWinners];
    while (newWinners.length <= rankIndex) {
      newWinners.push({
        rank: newWinners.length + 1,
        fullName: '',
        schoolName: '',
        time: '',
        bibNumber: '',
        notes: ''
      });
    }

    newWinners[rankIndex] = {
      ...newWinners[rankIndex],
      studentId: stud.id,
      fullName: stud.fullName,
      schoolName: stud.schoolName || 'مؤسسة تعليمية'
    };
    setEditingWinners(newWinners);
  };

  // Swap order of winners (rank change)
  const handleMoveWinner = (index: number, direction: 'up' | 'down') => {
    const updated = [...editingWinners];
    if (direction === 'up' && index > 0) {
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
    } else if (direction === 'down' && index < updated.length - 1) {
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
    }
    // Update the rank parameter to reflect its position
    const reregistered = updated.map((w, idx) => ({
      ...w,
      rank: idx + 1,
      notes: idx < 3 
        ? `مؤهل(ة) للبطولة الجهوية ${idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}` 
        : (w.notes && !w.notes.includes('البطولة الجهوية') ? w.notes : 'مؤهل لمنتخب المديرية')
    }));
    setEditingWinners(reregistered);
  };

  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Individual Category Sheets
      CROSS_COUNTRY_CATEGORIES.forEach(cat => {
        const catRes = results[cat.id];
        const podiumData = catRes?.podium || [];

        const sheetRows = podiumData.length > 0
          ? podiumData.map((p, idx) => ({
              'الرتبة': idx === 0 ? '🥇 الأول (بطل الفئة)' : idx === 1 ? '🥈 الثاني (الوصيف)' : idx === 2 ? '🥉 الثالث' : idx + 1,
              'رقم الصدرية': p.bibNumber || '-',
              'اسم العداء(ة)': p.fullName,
              'المؤسسة التعليمية': p.schoolName,
              'المديرية': p.directorateName || directorateName,
              'الأكاديمية': p.academyName || 'الأكاديمية الجهوية',
              'اسم المؤطر': p.supervisorName || '-',
              'نوع المشاركة': p.participationType || 'فردي',
              'الملاحظات والتأهيل': p.notes || '-'
            }))
          : [
              {
                'الرتبة': 'لا توجد نتائج مسجلة بعد',
                'رقم الصدرية': '-',
                'اسم العداء(ة)': '-',
                'المؤسسة التعليمية': '-',
                'المديرية': '-',
                'الأكاديمية': '-',
                'اسم المؤطر': '-',
                'نوع المشاركة': '-',
                'الملاحظات والتأهيل': '-'
              }
            ];

        const ws = XLSX.utils.json_to_sheet(sheetRows);
        XLSX.utils.book_append_sheet(wb, ws, cat.shortLabel.substring(0, 30));
      });

      // 2. Summary Sheet: Team Rankings for all categories
      const allTeamRows: Record<string, any>[] = [];
      CROSS_COUNTRY_CATEGORIES.forEach(cat => {
        const catRes = results[cat.id];
        const teams = calculateTeamRankings(catRes?.podium || []);
        teams.forEach(t => {
          allTeamRows.push({
            'الفئة العمرية': cat.titleAr,
            'ترتيب الفريق': t.rank === 1 ? '🥇 الأول (بطل الفئة)' : t.rank === 2 ? '🥈 الثاني' : t.rank === 3 ? '🥉 الثالث' : t.rank,
            'المؤسسة التعليمية': t.schoolName,
            'مجموع نقاط أسرع 4 عداءين': t.totalPoints,
            'رتبة العداء الرابع (حسم التساوي)': t.fourthRunnerRank,
            'عدد الواصلين لخط النهاية': t.runners.length,
            'أسماء العداءين المحتسبين': t.top4Runners.map(r => `${r.fullName} (رتبة ${r.rank})`).join(' ، ')
          });
        });
      });

      if (allTeamRows.length > 0) {
        const wsTeams = XLSX.utils.json_to_sheet(allTeamRows);
        XLSX.utils.book_append_sheet(wb, wsTeams, 'ترتيب_الفرق_الشامل');
      }

      // 3. Summary Sheet: Regional Qualification & Replacement Protocol
      const allRegionalRows: Record<string, any>[] = [];
      CROSS_COUNTRY_CATEGORIES.forEach(cat => {
        const catRes = results[cat.id];
        const teams = calculateTeamRankings(catRes?.podium || []);
        const winningTeamName = teams.length > 0 ? teams[0].schoolName : null;
        const quals = calculateRegionalQualifications(catRes?.podium || [], winningTeamName);

        quals.forEach(q => {
          allRegionalRows.push({
            'الفئة العمرية': cat.titleAr,
            'المقعد الفردي الجهوي': `#${q.qualifyingRank}`,
            'اسم العداء(ة) المتأهل(ة)': q.runner.fullName,
            'المؤسسة التعليمية': q.runner.schoolName,
            'الرتبة الأصلية في خط الوصول': q.originalFinishRank,
            'نوع التأهل': q.isReplacement ? 'بديل صاعد (تعويض فردي) 🎯' : 'تأهل فردي مباشر 🥇',
            'السبب والتوضيح القانوني': q.reasonAr,
            'الفريق البطل المتأهل جماعياً': winningTeamName || 'غير مكتمل'
          });
        });
      });

      if (allRegionalRows.length > 0) {
        const wsRegional = XLSX.utils.json_to_sheet(allRegionalRows);
        XLSX.utils.book_append_sheet(wb, wsRegional, 'محضر_التأهل_الجهوي');
      }

      XLSX.writeFile(wb, `محضر_نتائج_وترتيب_فرق_العدو_الريفي_${activeSeason.replace('/', '-')}.xlsx`);
      toast.success('تم تحميل ملف إكسيل الشامل لنتائج البوديوم وترتيب الفرق والتأهل الجهوي بنجاح!');
    } catch (e) {
      console.error('Export error:', e);
      toast.error('تعذر تصدير الملف');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Safe helper to get podium winner
  const getWinnerByRank = (podium: PodiumWinner[], rank: number) => {
    return podium.find(w => w.rank === rank) || null;
  };

  const firstPlace = getWinnerByRank(currentCategoryResult.podium, 1);
  const secondPlace = getWinnerByRank(currentCategoryResult.podium, 2);
  const thirdPlace = getWinnerByRank(currentCategoryResult.podium, 3);
  const otherRankings = currentCategoryResult.podium.filter(w => w.rank > 3);

  // Statistics across all 8 categories
  const totalCategoriesWithResults = useMemo(() => {
    return CROSS_COUNTRY_CATEGORIES.filter(c => {
      const res = results[c.id];
      return res && res.podium && res.podium.length > 0;
    }).length;
  }, [results]);

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Banner & Breadcrumb Header - with Hide / Show capability */}
      {!showHeaderBanner ? (
        /* Compact Bar when Header is hidden */
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-3 sm:p-4 text-white shadow-md border border-slate-800 flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all border border-white/10 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span className="hidden sm:inline">العودة إلى دليل البطولات</span>
              <span className="sm:hidden">عودة</span>
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xl">🏃‍♂️</span>
              <span className="text-xs sm:text-sm font-black text-white">
                البطولة الإقليمية للعدو الريفي
              </span>
              <span className="hidden md:inline-flex bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black px-2 py-0.5 rounded-full items-center gap-1">
                منصة التتويج والبوديوم ({totalCategoriesWithResults}/8)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {!isTeacher && (
              <>
                <button
                  onClick={() => exportQualifiedListExcel(results, activeSeason, directorateName)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl border border-amber-400/30 transition-colors cursor-pointer"
                  title="تصدير لائحة المتأهلين للبطولة الجهوية"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">تصدير المؤهلين</span>
                </button>

                <button
                  onClick={() => exportFullResultsExcel(results, activeSeason, directorateName)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  title="تصدير النتائج الشاملة"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">النتائج الشاملة</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-colors cursor-pointer"
                  title="طباعة محضر النتائج"
                >
                  <Printer className="w-3.5 h-3.5 text-blue-300" />
                  <span className="hidden md:inline">طباعة</span>
                </button>
              </>
            )}

            <button
              onClick={toggleHeaderBanner}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer"
              title="إظهار الترويسة وبطاقات الإحصائيات بالكامل"
            >
              <Eye className="w-3.5 h-3.5 text-slate-950" />
              <span>إظهار الترويسة</span>
            </button>
          </div>
        </div>
      ) : (
        /* Full Expanded Hero Header */
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-5 md:p-7 text-white shadow-xl border border-slate-800 relative overflow-hidden animate-fadeIn">
          <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={onBack}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all border border-white/10 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>العودة إلى دليل البطولات والمباريات</span>
                </button>

                {/* Hide Header Button */}
                <button
                  onClick={toggleHeaderBanner}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl transition-all border border-amber-400/30 cursor-pointer"
                  title="إخفاء الترويسة لتوفير مساحة وتكبير عرض النتائج"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>إخفاء الترويسة</span>
                </button>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 text-3xl flex items-center justify-center shadow-lg border border-amber-300/40 shrink-0">
                  🏃‍♂️
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">
                      البطولة الإقليمية المدرسية للعدو الريفي
                    </h1>
                    <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Trophy className="w-3.5 h-3.5 text-amber-400" />
                      منصة التتويج والبوديوم
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-slate-300 font-medium mt-1">
                    النتائج الرسمية، التوقيت، والمؤهلون للبطولة الجهوية • الفرع الإقليمي لـ {directorateName} • الموسم الرياضي {activeSeason}
                  </p>
                </div>
              </div>
            </div>

            {/* Action buttons - Hidden for teacher accounts */}
            {!isTeacher && (
              <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
                <button
                  onClick={() => exportQualifiedListExcel(results, activeSeason, directorateName)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs rounded-xl border border-amber-400/30 transition-colors cursor-pointer"
                  title="تصدير لائحة المتأهلين للبطولة الجهوية (خاص بالمسؤول المركزي ورئيس اللجنة)"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>تصدير المؤهلين (Excel)</span>
                </button>

                <button
                  onClick={() => exportFullResultsExcel(results, activeSeason, directorateName)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
                  title="تصدير لائحة النتائج الكاملة لجميع الفئات وترتيب الفرق"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير النتائج الشاملة (Excel)</span>
                </button>

                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-colors cursor-pointer"
                  title="طباعة محضر النتائج"
                >
                  <Printer className="w-4 h-4 text-blue-300" />
                  <span className="hidden sm:inline">طباعة المحضر</span>
                </button>
              </div>
            )}
          </div>

          {/* Global summary stats bar with collapse/expand option */}
          <div className="mt-6 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-slate-400">إحصائيات السباقات المعتمدة والتأهيل:</span>
              <button
                type="button"
                onClick={toggleStatsStrip}
                className="text-[11px] text-blue-300 hover:text-white flex items-center gap-1 cursor-pointer transition-colors bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded-lg border border-white/10"
                title={showStatsStrip ? 'طي بطاقات الإحصائيات' : 'إظهار بطاقات الإحصائيات'}
              >
                {showStatsStrip ? (
                  <>
                    <span>طي بطاقات الإحصائيات</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>إظهار بطاقات الإحصائيات</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>

            {showStatsStrip && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs animate-fadeIn">
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-[10px] text-slate-400 block font-medium">عدد الفئات المعتمدة</span>
                  <span className="text-base font-black text-white">8 سباقات رسمية</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-[10px] text-slate-400 block font-medium">الفئات المكتملة التتويج</span>
                  <span className="text-base font-black text-amber-400">{totalCategoriesWithResults} من أصل 8</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-[10px] text-slate-400 block font-medium">مكان إجراء المنافسات</span>
                  <span className="text-base font-black text-slate-200 truncate block">حلبة ألعاب القوى</span>
                </div>
                <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                  <span className="text-[10px] text-slate-400 block font-medium">التأهيل المباشر</span>
                  <span className="text-base font-black text-emerald-400">المراكز 1، 2 و 3 جهوياً</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category selector strip */}
      <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs">
        <div className="flex items-center justify-between gap-3 mb-2 px-1">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-500" />
            <h2 className="text-xs md:text-sm font-black text-slate-900">
              اختر الفئة العمرية والسباق المعتمد (8 فئات):
            </h2>
          </div>

          <button
            onClick={() => setViewAllCategories(!viewAllCategories)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              viewAllCategories
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{viewAllCategories ? 'العودة للبوديوم الفردي' : 'عرض منصات جميع الفئات (8)'}</span>
          </button>
        </div>

        {/* Categories horizontal scroll tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 scrollbar-thin">
          {CROSS_COUNTRY_CATEGORIES.map(cat => {
            const isSelected = !viewAllCategories && selectedCatId === cat.id;
            const res = results[cat.id];
            const hasResult = res && res.podium && res.podium.length > 0;
            const catTeams = res?.podium ? calculateTeamRankings(res.podium) : [];
            const catWinningTeam = catTeams.length > 0 ? catTeams[0] : null;

            return (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCatId(cat.id);
                  setViewAllCategories(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border cursor-pointer ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md scale-102'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <span>{cat.icon}</span>
                <span>{cat.shortLabel}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {cat.distance}
                </span>
                {catWinningTeam ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] bg-amber-400/20 text-amber-600 px-1.5 py-0.2 rounded-full border border-amber-400/30 font-black" title={`الفريق الفائز: ${catWinningTeam.schoolName}`}>
                    🏆
                  </span>
                ) : hasResult ? (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-200" title="تم تسجيل النتائج"></span>
                ) : (
                  <span className="w-2 h-2 rounded-full bg-slate-300" title="في انتظار النتائج"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Either Master All-Categories Grid or Single Detailed Category Podium */}
      {viewAllCategories ? (
        /* ALL 8 PODIUMS MASTER VIEW */
        <div className="space-y-6">
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-xl text-xs text-blue-900 font-bold">
            <span>عرض شامل لكافة منصات التتويج والفرق الفائزة في الفئات الثمانية للعدو الريفي المدرسي</span>
            <span>المجموع: 8 فئات</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {CROSS_COUNTRY_CATEGORIES.map(cat => {
              const res = results[cat.id];
              const p1 = res?.podium ? getWinnerByRank(res.podium, 1) : null;
              const p2 = res?.podium ? getWinnerByRank(res.podium, 2) : null;
              const p3 = res?.podium ? getWinnerByRank(res.podium, 3) : null;
              const hasAny = p1 || p2 || p3;

              const catTeams = res?.podium ? calculateTeamRankings(res.podium) : [];
              const catWinningTeam = catTeams.length > 0 ? catTeams[0] : null;

              return (
                <div
                  key={cat.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between hover:border-amber-400 hover:shadow-md transition-all group"
                >
                  <div>
                    {/* Card Header */}
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{cat.icon}</span>
                        <div>
                          <h3 className="text-xs font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                            {cat.shortLabel}
                          </h3>
                          <span className="text-[10px] text-slate-500 font-bold">{cat.distance}</span>
                        </div>
                      </div>
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEdit(cat.id)}
                          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                          title="تعديل النتائج"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Mini Podium Triad */}
                    {hasAny ? (
                      <div className="space-y-2 text-xs">
                        {/* 1st Place */}
                        <div className="p-2 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-100/60 border border-amber-200 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">🥇</span>
                            <div className="truncate">
                              <p className="font-black text-slate-900 text-xs truncate">{p1?.fullName || 'غير محدد'}</p>
                              <p className="text-[10px] text-amber-900 truncate font-medium">{p1?.schoolName || 'المؤسسة'}</p>
                            </div>
                          </div>
                          {p1?.time && (
                            <span className="text-[10px] font-mono font-black text-amber-800 shrink-0 bg-amber-200/60 px-1.5 py-0.5 rounded">
                              {p1.time}
                            </span>
                          )}
                        </div>

                        {/* 2nd Place */}
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">🥈</span>
                            <div className="truncate">
                              <p className="font-bold text-slate-800 text-xs truncate">{p2?.fullName || 'غير محدد'}</p>
                              <p className="text-[10px] text-slate-500 truncate">{p2?.schoolName || 'المؤسسة'}</p>
                            </div>
                          </div>
                          {p2?.time && (
                            <span className="text-[10px] font-mono font-bold text-slate-600 shrink-0">
                              {p2.time}
                            </span>
                          )}
                        </div>

                        {/* 3rd Place */}
                        <div className="p-2 rounded-xl bg-amber-50/40 border border-amber-200/50 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base">🥉</span>
                            <div className="truncate">
                              <p className="font-bold text-slate-800 text-xs truncate">{p3?.fullName || 'غير محدد'}</p>
                              <p className="text-[10px] text-slate-500 truncate">{p3?.schoolName || 'المؤسسة'}</p>
                            </div>
                          </div>
                          {p3?.time && (
                            <span className="text-[10px] font-mono font-bold text-amber-900 shrink-0">
                              {p3.time}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-400 space-y-2">
                        <Award className="w-8 h-8 mx-auto text-slate-300" />
                        <p className="text-[11px] font-medium">في انتظار إعلان النتائج الرسمية</p>
                      </div>
                    )}

                    {/* Winning Team Badge inside Category Card */}
                    {catWinningTeam ? (
                      <div className="mt-3 p-2.5 rounded-xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white border border-blue-700/70 shadow-xs">
                        <div className="flex items-center justify-between gap-1 mb-1">
                          <span className="inline-flex items-center gap-1 text-[9px] font-black text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                            🏆 الفريق الفائز (البطل)
                          </span>
                          <span className="text-[10px] font-mono font-black text-amber-300 bg-blue-950 px-2 py-0.5 rounded border border-blue-600/50">
                            {catWinningTeam.totalPoints} ن
                          </span>
                        </div>
                        <div className="text-xs font-black text-white truncate">
                          {catWinningTeam.schoolName}
                        </div>
                        <div className="text-[10px] text-blue-200 mt-1 flex items-center justify-between font-medium">
                          <span>متأهل للجهوية 🚀</span>
                          <span>4 عداءين محتسبين</span>
                        </div>
                      </div>
                    ) : hasAny ? (
                      <div className="mt-3 p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                        <span className="text-[10px] font-bold text-slate-500">🏆 الفريق الفائز: غ.مكتمل</span>
                      </div>
                    ) : null}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedCatId(cat.id);
                      setViewAllCategories(false);
                    }}
                    className="mt-4 w-full py-1.5 text-center text-xs font-black text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors cursor-pointer"
                  >
                    عرض البوديوم المكبر وتفاصيل السباق ←
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* SINGLE DETAILED PODIUM VIEW FOR SELECTED CATEGORY */
        <div className="space-y-6">
          {/* Active Category Header Card */}
          <div className="bg-white rounded-2xl p-4 md:p-5 border border-slate-200 shadow-xs space-y-3">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-2xl shadow-xs">
                  {selectedCategoryDef.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base md:text-lg font-black text-slate-900">
                      {selectedCategoryDef.titleAr}
                    </h2>
                    <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-black px-2.5 py-0.5 rounded-full">
                      المسافة: {selectedCategoryDef.distance}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    مكان السباق: {currentCategoryResult.venueName || 'مضمار حلبة ألعاب القوى'} • نتائج الترتيب الفردي، ترتيب الفرق، ومحضر التأهل الجهوي
                  </p>
                </div>
              </div>

              {canEdit && (
                <button
                  onClick={() => handleOpenEdit(selectedCatId)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs transition-colors self-stretch md:self-auto justify-center cursor-pointer"
                >
                  <Edit3 className="w-4 h-4 text-amber-400" />
                  <span>تعديل نتائج هذه الفئة</span>
                </button>
              )}
            </div>

            {/* Winning Team Banner inside Category Header Card */}
            {winningTeam ? (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white border border-blue-700/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-xs shrink-0">
                    🏆
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-black text-amber-300 bg-amber-400/20 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                        الفريق الفائز بالمرتبة الأولى (بطل الفئة)
                      </span>
                      <span className="text-[10px] font-black text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-400/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        متأهل جماعياً للبطولة الجهوية
                      </span>
                    </div>
                    <h3 className="text-sm md:text-base font-black text-white mt-1 truncate">
                      {winningTeam.schoolName}
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs self-end sm:self-auto shrink-0 bg-blue-900/60 px-3 py-1.5 rounded-xl border border-blue-700/50">
                  <span className="text-blue-200 font-bold">مجموع نقاط أسرع 4 عداءين:</span>
                  <span className="text-xs font-mono font-black text-amber-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                    {winningTeam.totalPoints} نقطة
                  </span>
                </div>
              </div>
            ) : currentCategoryResult.podium && currentCategoryResult.podium.length > 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>الفريق الفائز بالمرتبة الأولى: لم تتوفر التغطية الكاملة لـ 4 عداءين أوايل من نفس المؤسسة.</span>
              </div>
            ) : null}
          </div>

          {/* SUB-TABS NAVIGATION: Individual / Team / Regional */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setActiveSubTab('individual')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs md:text-sm font-black transition-all ${
                activeSubTab === 'individual'
                  ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Trophy className={`w-4 h-4 ${activeSubTab === 'individual' ? 'text-amber-500' : 'text-slate-400'}`} />
              <span>🏅 الترتيب الفردي والبوديوم</span>
            </button>

            <button
              onClick={() => setActiveSubTab('team')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs md:text-sm font-black transition-all ${
                activeSubTab === 'team'
                  ? 'bg-white text-blue-900 shadow-sm border border-blue-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className={`w-4 h-4 ${activeSubTab === 'team' ? 'text-blue-600' : 'text-slate-400'}`} />
              <span>🏫 ترتيب الفرق للمؤسسات ({teamRankings.length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('regional')}
              className={`flex-1 min-w-[140px] flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs md:text-sm font-black transition-all ${
                activeSubTab === 'regional'
                  ? 'bg-white text-emerald-900 shadow-sm border border-emerald-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 ${activeSubTab === 'regional' ? 'text-emerald-600' : 'text-slate-400'}`} />
              <span>📜 محضر التأهل الجهوي والبدلاء</span>
            </button>
          </div>

          {/* TAB 1: INDIVIDUAL PODIUM & RACE FINISH LINE TABLE */}
          {activeSubTab === 'individual' && (
            <div className="space-y-6">
              {/* THE 3D-STYLE OLYMPIC PODIUM (المركز الأول، الثاني، الثالث) */}
              <div className="bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 rounded-2xl sm:rounded-3xl p-2 sm:p-5 md:p-8 border border-slate-800 shadow-2xl relative overflow-hidden text-white">
                {/* Ambient gold/light glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-3 mb-4 sm:mb-6 pb-3 sm:pb-4 border-b border-white/10">
                  <div className="text-center md:text-right">
                    <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full uppercase tracking-wider">
                      <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-400" />
                      منصة التتويج الرسمية • سباق {selectedCategoryDef.shortLabel}
                    </span>
                    <h3 className="text-base sm:text-lg md:text-xl font-black text-white mt-1">
                      الثلاثي المتوج على البوديوم الإقليمي
                    </h3>
                  </div>

                  {canEdit && (
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-center">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(selectedCatId)}
                        className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[11px] sm:text-xs rounded-lg sm:rounded-xl shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <Pencil className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                        <span>تعديل وترتيب المتوجين</span>
                      </button>

                      {categoryStudents.length > 0 && (
                        <button
                          type="button"
                          onClick={handleAutoFillCategoryFromRegistered}
                          className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 bg-blue-600/80 hover:bg-blue-600 text-white font-black text-[11px] sm:text-xs rounded-lg sm:rounded-xl border border-blue-400/40 shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95"
                          title="ملء المراكز تلقائياً من لائحة التلاميذ المسجلين في هذه الفئة"
                        >
                          <Sparkles className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-amber-300" />
                          <span>ملء سريع ({categoryStudents.length})</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* PODIUM CARDS: 3 STANDALONE CARDS IN A SINGLE ROW (المركز الأول، الثاني، الثالث) */}
                <div className="relative z-10 max-w-4xl mx-auto pt-4 sm:pt-8 pb-2 sm:pb-3">
                  <div className="grid grid-cols-3 gap-1 sm:gap-4 md:gap-6 items-stretch">
                    {/* 2ND PLACE (SILVER 🥈 - RIGHT IN RTL) */}
                    <div className="flex flex-col items-center">
                      <PodiumRunnerCard
                        rank={2}
                        winner={secondPlace}
                        canEdit={canEdit}
                        selectedCatId={selectedCatId}
                        categoryStudents={categoryStudents}
                        onOpenEdit={handleOpenEdit}
                        onQuickAssign={handleQuickAssignRank}
                      />
                    </div>

                    {/* 1ST PLACE (GOLD 🥇 - CENTER) */}
                    <div className="flex flex-col items-center sm:-translate-y-2">
                      <PodiumRunnerCard
                        rank={1}
                        winner={firstPlace}
                        canEdit={canEdit}
                        selectedCatId={selectedCatId}
                        categoryStudents={categoryStudents}
                        onOpenEdit={handleOpenEdit}
                        onQuickAssign={handleQuickAssignRank}
                      />
                    </div>

                    {/* 3RD PLACE (BRONZE 🥉 - LEFT IN RTL) */}
                    <div className="flex flex-col items-center">
                      <PodiumRunnerCard
                        rank={3}
                        winner={thirdPlace}
                        canEdit={canEdit}
                        selectedCatId={selectedCatId}
                        categoryStudents={categoryStudents}
                        onOpenEdit={handleOpenEdit}
                        onQuickAssign={handleQuickAssignRank}
                      />
                    </div>
                  </div>
                </div>

                {/* Prompt button if not all top 3 places are filled */}
                {(!firstPlace || !secondPlace || !thirdPlace) && canEdit && (
                  <div className="relative z-10 text-center pt-3 mt-2 border-t border-white/10 flex flex-wrap items-center justify-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(selectedCatId)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>تسجيل وتتويج أبطال هذا السباق الآن ⏱️</span>
                    </button>
                    {categoryStudents.length > 0 && (
                      <button
                        onClick={handleAutoFillCategoryFromRegistered}
                        className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs md:text-sm rounded-xl shadow-lg transition-transform active:scale-95 cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4 text-amber-300" />
                        <span>ملء أوتوماتيكي من المسجلين بالفئة ⚡</span>
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* OFFICIAL RANKING TABLE FOR THE CATEGORY */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 md:p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-slate-50/50">
                  <div>
                    <h3 className="text-sm md:text-base font-black text-slate-900 flex items-center gap-2">
                      <Award className="w-4 h-4 text-blue-600" />
                      <span>الترتيب العام الرسمي لفئة {selectedCategoryDef.shortLabel}</span>
                    </h3>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      ترتيب خط الوصول حسب الوصول الفردي بجميع المراكز
                    </p>
                  </div>

                  <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full">
                    إجمالي الواصلين: {currentCategoryResult.podium.length} عدائين
                  </span>
                </div>

                {currentCategoryResult.podium.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                        <tr>
                          <th className="py-3 px-4 w-16 text-center">الوصول العام</th>
                          <th className="py-3 px-4 text-center">الترتيب الفردي</th>
                          <th className="py-3 px-4 text-center">الصورة</th>
                          <th className="py-3 px-4">الاسم</th>
                          <th className="py-3 px-4 text-center">التوقيت</th>
                          <th className="py-3 px-4 text-center">نوع المشاركة</th>
                          <th className="py-3 px-4">المؤسسة</th>
                          <th className="py-3 px-4">المديرية</th>
                          <th className="py-3 px-4">الأكاديمية</th>
                          <th className="py-3 px-4 w-20 text-center">الصدرية</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {currentCategoryResult.podium.map((winner, idx) => {
                          const isGold = winner.rank === 1;
                          const isSilver = winner.rank === 2;
                          const isBronze = winner.rank === 3;

                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50 transition-colors ${
                                isGold
                                  ? 'bg-amber-50/40 font-bold'
                                  : isSilver
                                  ? 'bg-slate-50/60'
                                  : isBronze
                                  ? 'bg-amber-50/20'
                                  : ''
                              }`}
                            >
                              {/* General Finish Rank */}
                              <td className="py-3 px-4 text-center">
                                {isGold ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black text-xs shadow-xs">
                                    🥇 1
                                  </span>
                                ) : isSilver ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-black text-xs shadow-xs">
                                    🥈 2
                                  </span>
                                ) : isBronze ? (
                                  <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-700 text-white font-black text-xs shadow-xs">
                                    🥉 3
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                                    {winner.rank}
                                  </span>
                                )}
                              </td>

                              {/* Individual Rank Status */}
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${winner.participationType === 'فريق' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'}`}>
                                  {winner.participationType === 'فريق' ? 'ضمن فريق' : `${winner.rank} فردي`}
                                </span>
                              </td>

                              {/* Photo Placeholder */}
                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center mx-auto transition-colors"
                                  title="صورة العداء"
                                >
                                  <Camera className="w-4 h-4" />
                                </button>
                              </td>

                              {/* Full Name */}
                              <td className="py-3 px-4">
                                <span className="font-black text-slate-900 text-sm">
                                  {winner.fullName}
                                </span>
                              </td>

                              {/* Time */}
                              <td className="py-3 px-4 text-center">
                                <div className="inline-flex items-center gap-1 font-mono font-black text-xs text-blue-900 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                                  <span>{winner.time || '00:00.0'}</span>
                                </div>
                              </td>

                              {/* Participation Type */}
                              <td className="py-3 px-4 text-center">
                                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${winner.participationType === 'فريق' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-900'}`}>
                                  {winner.participationType || 'فردي'}
                                </span>
                              </td>

                              {/* School */}
                              <td className="py-3 px-4 text-slate-700 font-bold">
                                {winner.schoolName}
                              </td>

                              {/* Directorate */}
                              <td className="py-3 px-4 text-slate-600 font-medium">
                                {winner.directorateName || directorateName}
                              </td>

                              {/* Academy */}
                              <td className="py-3 px-4 text-slate-600 font-medium">
                                {winner.academyName || 'الشرق'}
                              </td>

                              {/* Bib */}
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                                {winner.bibNumber ? `#${winner.bibNumber}` : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 space-y-2">
                    <Trophy className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">لم يتم تسجيل نتائج هذا السباق بعد</p>
                    <p className="text-xs text-slate-400">
                      يمكن للمسؤولين تسجيل نتائج التتويج من خلال زر "تعديل نتائج هذه الفئة" أعلاه.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: TEAM RANKINGS (SUM OF TOP 4 RUNNERS & TIE-BREAKER RULE) */}
          {activeSubTab === 'team' && (
            <div className="space-y-6">
              {/* Formula explanation banner */}
              <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-blue-950 rounded-2xl p-4 md:p-5 text-white shadow-md border border-blue-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <span>قانون احتساب ترتيب الفرق للمؤسسات التعليمية</span>
                      <span className="bg-blue-400/20 text-blue-300 text-[10px] px-2 py-0.5 rounded-full border border-blue-400/30 font-bold">
                        رسمي
                      </span>
                    </h3>
                    <p className="text-slate-200 leading-relaxed font-medium">
                      1️⃣ <strong>مجموع النقاط:</strong> يتم جمع رتب (نقاط) أسرع 4 عداءين في خط الوصول لكل مؤسسة مشاركة بفريق. الفريق صاحب <strong>أقل مجموع نقاط</strong> يتوج بطلاً للفئة ويضمن التأهل الجهوي.
                    </p>
                    <p className="text-amber-300 leading-relaxed font-bold bg-amber-400/10 p-2 rounded-xl border border-amber-400/20">
                      ⚖️ <strong>قاعدة حسم التساوي في النقاط (Tie-Break):</strong> في حالة تساوي مجموع نقاط فريقين أو أكثر (مثلاً فريق أ 35 نقطة وفريق ب 35 نقطة)، يتم الاحتكام مباشرة إلى <strong>رتبة العداء الرابع (4th runner rank)</strong> بكل فريق. الفريق الذي يحتل عداؤه الرابع رتبة أفضل (أقل عدداً) يفوز بالمرتبة الأعلى بالتصنيف!
                    </p>
                  </div>
                </div>
              </div>

              {/* Team Standings Cards / Table */}
              {teamRankings.length > 0 ? (
                <div className="space-y-4">
                  {teamRankings.map(team => {
                    const is1st = team.rank === 1;
                    const is2nd = team.rank === 2;
                    const is3rd = team.rank === 3;

                    return (
                      <div
                        key={team.schoolName}
                        className={`bg-white rounded-2xl border p-4 md:p-5 shadow-xs transition-all ${
                          is1st
                            ? 'border-amber-400 ring-2 ring-amber-400/20 bg-gradient-to-r from-amber-50/30 via-white to-white'
                            : is2nd
                            ? 'border-slate-300 bg-slate-50/30'
                            : is3rd
                            ? 'border-amber-200 bg-amber-50/10'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-xs ${
                                is1st
                                  ? 'bg-amber-400 text-slate-950 font-black'
                                  : is2nd
                                  ? 'bg-slate-300 text-slate-900 font-black'
                                  : is3rd
                                  ? 'bg-amber-700 text-white font-black'
                                  : 'bg-slate-100 text-slate-700 font-bold'
                              }`}
                            >
                              {is1st ? '🥇 1' : is2nd ? '🥈 2' : is3rd ? '🥉 3' : `#${team.rank}`}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm md:text-base font-black text-slate-900">
                                  {team.schoolName}
                                </h4>
                                {is1st && (
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    الفريق المتأهل للبطولة الجهوية 🏆
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 font-medium mt-0.5">
                                عدد العداءين الواصلين: {team.runners.length} عداءين
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                            <div className="bg-slate-900 text-white text-xs font-black px-3.5 py-1.5 rounded-xl border border-slate-800 shadow-xs flex flex-col items-end">
                              <span className="text-[10px] text-slate-400 font-normal">مجموع النقاط</span>
                              <span className="text-sm text-amber-400 font-mono">{team.totalPoints} نقطة</span>
                            </div>

                            <div className="bg-blue-50 text-blue-900 border border-blue-200 text-xs font-bold px-3 py-1.5 rounded-xl flex flex-col items-end">
                              <span className="text-[10px] text-blue-600 font-normal">العداء الرابع (حسم)</span>
                              <span className="text-xs font-mono font-black text-blue-950">الرتبة {team.fourthRunnerRank}</span>
                            </div>
                          </div>
                        </div>

                        {/* Top 4 scoring runners breakdown */}
                        <div className="mt-3 pt-2">
                          <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                            <span>الأربعة الأوائل المحتسبون في مجموع نقاط الفريق:</span>
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                            {team.top4Runners.map((r, i) => (
                              <div
                                key={i}
                                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 truncate">{r.fullName}</p>
                                  <p className="text-[10px] text-slate-500 font-mono">{r.time ? `⏱️ ${r.time}` : 'وصل لخط النهاية'}</p>
                                </div>
                                <span className="bg-slate-900 text-amber-300 font-mono font-black text-xs px-2 py-1 rounded-lg shrink-0">
                                  {r.rank} نقطة
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center space-y-2">
                  <Users className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">لا يوجد فريق مكتمل بأربعة عداءين في هذه الفئة بعد</p>
                  <p className="text-xs text-slate-500">
                    يشترط قانون العدو الريفي وجود 4 عداءين على الأقل ينتمون لنفس المؤسسة لحساب مجموع النقاط وإدراج المؤسسة في ترتيب الفرق.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: REGIONAL QUALIFICATION PROTOCOL & REPLACEMENT RULES */}
          {activeSubTab === 'regional' && (
            <div className="space-y-6">
              {/* Protocol Header Card */}
              <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-emerald-900 rounded-2xl p-5 text-white shadow-md border border-emerald-800">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <h3 className="text-sm font-black text-white flex items-center gap-2">
                      <span>محضر ومحاكاة التأهل للبطولة الجهوية/الوطنية للعدو الريفي</span>
                      <span className="bg-emerald-400/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded-full border border-emerald-400/30 font-bold">
                        قاعدة التتويج والتعويض
                      </span>
                    </h3>
                    <p className="text-slate-200 leading-relaxed font-medium">
                      🏆 <strong>التتويج المزدوج:</strong> العداء الحاصل على مركز في منصة التتويج الفردية (1، 2، 3) والذي ينتمي للفريق الفائز يتوج بالميدالية الإقليمية وتُحتسب نقاطه لصالح فريقه.
                    </p>
                    <p className="text-emerald-200 leading-relaxed font-bold bg-emerald-500/10 p-2 rounded-xl border border-emerald-400/20">
                      🔄 <strong>قاعدة البدلاء والتصعيد الفردي:</strong> نظراً لأن البطل يتأهل تلقائياً بكامل أعضاء فريقه للبطولة الجهوية، فإن <strong>مقعده الفردي لا يضيع</strong>؛ بل يُتاح للعداء الحاصل على المرتبة التالية في خط الوصول (المركز 4، 5...) كبديل صاعد (التعويض الفردي) لتمثيل المديرية!
                    </p>
                  </div>
                </div>
              </div>

              {/* Part 1: Qualified Winning Team */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
                <div className="flex items-center gap-2 pb-3 border-b border-slate-100 mb-3">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <h4 className="text-sm font-black text-slate-900">
                    أولاً: الفريق المتأهل جماعياً للبطولة الجهوية (بطل الفئة)
                  </h4>
                </div>

                {winningTeam ? (
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🏆</span>
                        <h5 className="text-base font-black text-emerald-950">
                          {winningTeam.schoolName}
                        </h5>
                        <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                          بطل الفرق ({winningTeam.totalPoints} نقطة)
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 font-medium mt-1">
                        يتأهل بكامل عناصره الأربعة لتمثيل الفرع الإقليمي في البطولة الجهوية المدرسية.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {winningTeam.top4Runners.map((r, i) => (
                        <span key={i} className="bg-white border border-emerald-300 text-emerald-900 text-xs font-bold px-2.5 py-1 rounded-lg shadow-2xs">
                          {r.fullName} (#{r.rank})
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic p-3 bg-slate-50 rounded-xl">
                    في انتظار اكتمال فريق بأربعة عداءين لتحديد الفريق الفائز المتأهل للجهة.
                  </p>
                )}
              </div>

              {/* Part 2: Individually Qualified Athletes Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Award className="w-4 h-4 text-blue-600" />
                    <span>ثانياً: لائحة المقاعد الفردية الثلاثة المتأهلة جهوياً (مع البدلاء الصاعدين)</span>
                  </h4>
                  <span className="text-xs font-bold text-slate-600 bg-white border border-slate-200 px-3 py-1 rounded-full">
                    المقاعد: 3 عداءين فرديين
                  </span>
                </div>

                {regionalQualifications.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                        <tr>
                          <th className="py-3 px-4 text-center w-16">مقعد التأهل</th>
                          <th className="py-3 px-4">اسم العداء(ة)</th>
                          <th className="py-3 px-4">المؤسسة التعليمية</th>
                          <th className="py-3 px-4 text-center">الرتبة في السباق</th>
                          <th className="py-3 px-4">صفة التأهل والتوضيح</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {regionalQualifications.map((q, idx) => {
                          return (
                            <tr
                              key={idx}
                              className={`hover:bg-slate-50 transition-colors ${
                                q.isReplacement ? 'bg-amber-50/40' : 'bg-emerald-50/20'
                              }`}
                            >
                              <td className="py-3 px-4 text-center">
                                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-900 text-amber-400 font-black text-xs shadow-xs">
                                  #{q.qualifyingRank}
                                </span>
                              </td>

                              <td className="py-3 px-4 font-black text-slate-900 text-sm">
                                {q.runner.fullName}
                              </td>

                              <td className="py-3 px-4 text-slate-700 font-bold">
                                {q.runner.schoolName}
                              </td>

                              <td className="py-3 px-4 text-center font-mono font-black text-slate-800">
                                المركز {q.originalFinishRank}
                              </td>

                              <td className="py-3 px-4">
                                {q.isReplacement ? (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-amber-100 text-amber-900 border border-amber-300">
                                    <span>🎯</span>
                                    <span>{q.reasonAr}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-900 border border-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>{q.reasonAr}</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="p-6 text-center text-xs text-slate-400 font-medium">
                    يرجى تسجيل نتائج السباق لعرض محضر التأهل الجهوي وقائمة البدلاء الصاعدين.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* EDIT / RECORD RESULTS MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-6xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-sm">
                  🏆
                </div>
                <div>
                  <h3 className="text-base font-black">
                    لوحة تعديل وترتيب نتائج السباق (جدول تفاعلي)
                  </h3>
                  <p className="text-xs text-slate-300">
                    {CROSS_COUNTRY_CATEGORIES.find(c => c.id === editingCategoryId)?.titleAr}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Category Selector inside modal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الفئة المعنية بالسباق:
                  </label>
                  <select
                    value={editingCategoryId}
                    onChange={e => {
                      const newCatId = e.target.value;
                      setEditingCategoryId(newCatId);
                      const existing = results[newCatId];
                      if (existing && existing.podium && existing.podium.length > 0) {
                        setEditingWinners([...existing.podium]);
                      } else {
                        setEditingWinners([
                          { rank: 1, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥇' },
                          { rank: 2, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥈' },
                          { rank: 3, fullName: '', schoolName: '', time: '', bibNumber: '', notes: 'مؤهل(ة) للبطولة الجهوية 🥉' }
                        ]);
                      }
                    }}
                    className="w-full text-xs font-bold rounded-xl border border-slate-300 p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {CROSS_COUNTRY_CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.titleAr} ({c.distance})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    مكان أو حلبة السباق:
                  </label>
                  <input
                    type="text"
                    value={editingVenue}
                    onChange={e => setEditingVenue(e.target.value)}
                    placeholder="مثلاً: مضمار حلبة ألعاب القوى بتاوريرت"
                    className="w-full text-xs font-bold rounded-xl border border-slate-300 p-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Notice */}
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 animate-pulse" />
                <p className="leading-relaxed">
                  <strong>💡 ميزة الترتيب والتعديل الفوري:</strong> يمكنك إدخال البيانات يدوياً، أو ملء الخانات بسرعة من قائمة المسجلين. استخدم أزرار الأسهم (⬆️ / ⬇️) لتغيير رتبة وتصنيف العدائين فورياً، وسيتم إعادة احتساب نقاط الفرق وتأهيل الجهة بناءً عليها تلقائياً.
                </p>
              </div>

              {/* TABLE CONTAINER */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                <div className="overflow-x-auto border-slate-100">
                  <table className="w-full text-right text-xs table-auto border-collapse">
                    <thead className="bg-slate-900 text-slate-100 border-b border-slate-200 font-bold">
                      <tr>
                        <th className="py-3 px-2 text-center w-24">الترتيب</th>
                        <th className="py-3 px-2 text-center w-24">رقم الصدرية</th>
                        <th className="py-3 px-3 min-w-[200px]">الاسم الكامل للعداء(ة) *</th>
                        <th className="py-3 px-3 min-w-[160px]">المؤسسة التعليمية *</th>
                        <th className="py-3 px-2 text-center w-28">التوقيت (⏱️)</th>
                        <th className="py-3 px-3 min-w-[130px]">المديرية</th>
                        <th className="py-3 px-3 min-w-[130px]">الأكاديمية</th>
                        <th className="py-3 px-3 min-w-[130px]">اسم المؤطر</th>
                        <th className="py-3 px-2 text-center w-28">المشاركة</th>
                        <th className="py-3 px-2 text-center w-14">إجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {editingWinners.map((winner, idx) => {
                        const rankNum = idx + 1;
                        const isGold = rankNum === 1;
                        const isSilver = rankNum === 2;
                        const isBronze = rankNum === 3;

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-50/80 transition-colors ${
                              isGold
                                ? 'bg-amber-50/40'
                                : isSilver
                                ? 'bg-slate-50/30'
                                : isBronze
                                ? 'bg-orange-50/20'
                                : 'bg-white'
                            }`}
                          >
                            {/* RANK & POSITION ADJUSTING ARROWS */}
                            <td className="py-2.5 px-2 text-center">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <div className="flex items-center gap-1 font-black text-slate-900">
                                  <span>{isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : '🏅'}</span>
                                  <span className="font-mono text-xs">{rankNum}</span>
                                </div>
                                
                                {/* Up / Down arrow buttons */}
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() => handleMoveWinner(idx, 'up')}
                                    className={`p-1 rounded hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`}
                                    title="ترقية الترتيب للأعلى (رتبة أفضل)"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === editingWinners.length - 1}
                                    onClick={() => handleMoveWinner(idx, 'down')}
                                    className={`p-1 rounded hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed`}
                                    title="تخفيض الترتيب للأسفل"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </td>

                            {/* BIB NUMBER (DOSSARD) */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                value={winner.bibNumber || ''}
                                onChange={e => {
                                  const updated = [...editingWinners];
                                  updated[idx].bibNumber = e.target.value;
                                  setEditingWinners(updated);
                                }}
                                placeholder="الصدرية"
                                className="w-full text-center font-mono font-black text-xs rounded-lg border border-slate-300 p-1.5 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>

                            {/* FULL NAME & INSTANT AUTOCOMPLETE */}
                            <td className="py-2.5 px-3">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={winner.fullName}
                                  onChange={e => {
                                    const updated = [...editingWinners];
                                    updated[idx].fullName = e.target.value;
                                    setEditingWinners(updated);
                                  }}
                                  placeholder="الاسم الكامل للعداء(ة)"
                                  className="w-full font-bold text-xs rounded-lg border border-slate-300 p-1.5 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                                {availableCategoryStudents.length > 0 && (
                                  <select
                                    onChange={e => {
                                      if (e.target.value) {
                                        handleSelectStudentForRank(idx, e.target.value);
                                      }
                                    }}
                                    defaultValue=""
                                    className="w-full text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 rounded p-1 focus:border-blue-500"
                                  >
                                    <option value="">👤 ملء من العدائين المسجلين...</option>
                                    {availableCategoryStudents.map(s => (
                                      <option key={s.id} value={s.id}>
                                        {s.fullName} ({s.schoolName})
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </td>

                            {/* SCHOOL NAME */}
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={winner.schoolName}
                                onChange={e => {
                                  const updated = [...editingWinners];
                                  updated[idx].schoolName = e.target.value;
                                  setEditingWinners(updated);
                                }}
                                placeholder="المؤسسة التعليمية"
                                className="w-full font-bold text-xs rounded-lg border border-slate-300 p-1.5 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>

                            {/* TIME */}
                            <td className="py-2.5 px-2">
                              <input
                                type="text"
                                value={winner.time || ''}
                                onChange={e => {
                                  const updated = [...editingWinners];
                                  updated[idx].time = e.target.value;
                                  setEditingWinners(updated);
                                }}
                                placeholder="مثلاً: 12:45"
                                className="w-full text-center font-mono font-bold text-xs rounded-lg border border-slate-300 p-1.5 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>

                            {/* DIRECTORATE */}
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={winner.directorateName || ''}
                                onChange={e => {
                                  const updated = [...editingWinners];
                                  updated[idx].directorateName = e.target.value;
                                  setEditingWinners(updated);
                                }}
                                placeholder={directorateName}
                                className="w-full font-bold text-xs rounded-lg border border-slate-300 p-1.5 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>

                            {/* ACADEMY */}
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={winner.academyName || ''}
                                onChange={e => {
                                  const updated = [...editingWinners];
                                  updated[idx].academyName = e.target.value;
                                  setEditingWinners(updated);
                                }}
                                placeholder="الجهة / الأكاديمية"
                                className="w-full font-bold text-xs rounded-lg border border-slate-300 p-1.5 bg-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </td>

                            {/* SUPERVISOR / COACH */}
                            <td className="py-2.5 px-3">
                              <input
                                type="text"
                                value={winner.supervisorName || ''}
                                onChange={e => {
                                  const updated = [...editingWinners];
                                  updated[idx].supervisorName = e.target.value;
                                  setEditingWinners(updated);
                                }}
                                placeholder="اسم المؤطر"
                                className="w-full font-bold text-xs rounded-lg border border-slate-300 p-1.5 bg-white focus:border-blue-500 focus:outline-none"
                              />
                            </td>

                            {/* PARTICIPATION TYPE */}
                            <td className="py-2.5 px-2">
                              <select
                                value={winner.participationType || 'فردي'}
                                onChange={e => {
                                  const updated = [...editingWinners];
                                  updated[idx].participationType = e.target.value;
                                  setEditingWinners(updated);
                                }}
                                className="w-full font-bold text-xs rounded-lg border border-slate-300 p-1.5 bg-white focus:border-blue-500 focus:outline-none"
                              >
                                <option value="فردي">فردي</option>
                                <option value="فريق">فريق</option>
                                <option value="مؤهل">مؤهل</option>
                              </select>
                            </td>

                            {/* DELETE BUTTON */}
                            <td className="py-2.5 px-2 text-center">
                              {idx >= 3 ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = editingWinners.filter((_, i) => i !== idx);
                                    // Recalculate ranks on delete
                                    const reregistered = updated.map((w, idx) => ({ ...w, rank: idx + 1 }));
                                    setEditingWinners(reregistered);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="حذف هذا المركز من الترتيب"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              ) : (
                                <span className="text-slate-300 select-none cursor-not-allowed font-medium text-[10px]" title="لا يمكن حذف منصة التتويج الأساسية">
                                  رئيسي
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Add extra rank button */}
              <button
                type="button"
                onClick={() => {
                  const nextRank = editingWinners.length + 1;
                  setEditingWinners([
                    ...editingWinners,
                    {
                      rank: nextRank,
                      fullName: '',
                      schoolName: '',
                      time: '',
                      bibNumber: '',
                      notes: 'مؤهل لمنتخب المديرية'
                    }
                  ]);
                }}
                className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 text-slate-500 hover:text-blue-600" />
                <span>إضافة عداء إضافي للائحة الوصول (المرتبة {editingWinners.length + 1})</span>
              </button>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                إلغاء وتراجع
              </button>

              <button
                type="button"
                onClick={handleSaveWinners}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-850 text-white font-black text-xs md:text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جاري حفظ التعديلات...' : 'حفظ النتائج وتثبيت الترتيب الجديد 🏆'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
