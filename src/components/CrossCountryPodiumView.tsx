import React, { useState, useMemo } from 'react';
import { CrossCountryCategoryResult, PodiumWinner, Student, School, User } from '../types';
import {
  CROSS_COUNTRY_CATEGORIES,
  CrossCountryCategoryDef,
  calculateTeamRankings,
  calculateRegionalQualifications,
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
  CheckCircle2,
  Award,
  Sparkles,
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
  RefreshCw
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
}

export const CrossCountryPodiumView: React.FC<CrossCountryPodiumViewProps> = ({
  results,
  onUpdateResult,
  onBack,
  canEdit = false,
  activeSeason,
  directorateName,
  students,
  schools,
  currentUser
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>('u15_male');
  const [viewAllCategories, setViewAllCategories] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'individual' | 'team' | 'regional'>('individual');

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
              'التوقيت الرسمي': p.time || '-',
              'الملاحظات والتأهيل': p.notes || '-'
            }))
          : [
              {
                'الرتبة': 'لا توجد نتائج مسجلة بعد',
                'رقم الصدرية': '-',
                'اسم العداء(ة)': '-',
                'المؤسسة التعليمية': '-',
                'التوقيت الرسمي': '-',
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
      {/* Top Banner & Breadcrumb Header */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-3xl p-5 md:p-7 text-white shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-2">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-300 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all border border-white/10"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة إلى دليل البطولات والمباريات</span>
            </button>

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

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto justify-end">
            {canEdit && (
              <button
                onClick={() => handleOpenEdit(selectedCatId)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-md transition-all active:scale-95"
              >
                <Edit3 className="w-4 h-4 text-slate-950" />
                <span>تسجيل / تعديل نتائج التتويج</span>
              </button>
            )}

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-colors"
              title="تصدير النتائج إلى إكسيل"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">تصدير إكسيل</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-xl border border-white/15 transition-colors"
              title="طباعة محضر النتائج"
            >
              <Printer className="w-4 h-4 text-blue-300" />
              <span className="hidden sm:inline">طباعة المحضر</span>
            </button>
          </div>
        </div>

        {/* Global summary stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-slate-800/80 text-xs">
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
      </div>

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
              <div className="bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 rounded-3xl p-6 md:p-8 border border-slate-800 shadow-2xl relative overflow-hidden text-white">
                {/* Ambient gold/light glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10 text-center mb-6">
                  <span className="inline-flex items-center gap-1 text-[11px] font-black text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-full uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    منصة التتويج الرسمية • سباق {selectedCategoryDef.shortLabel}
                  </span>
                  <h3 className="text-lg md:text-xl font-black text-white mt-1">
                    الثلاثي المتوج على البوديوم الإقليمي
                  </h3>
                </div>

                {/* PODIUM STRUCTURE: 3 BLOCKS */}
                <div className="relative z-10 max-w-4xl mx-auto pt-8 pb-4">
                  <div className="grid grid-cols-3 gap-2 md:gap-4 items-end">
                    {/* 2ND PLACE (SILVER 🥈 - RIGHT IN RTL) */}
                    <div className="flex flex-col items-center">
                      {/* Athlete Info Card */}
                      <div className="mb-3 text-center w-full px-1">
                        <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-2 rounded-2xl bg-gradient-to-tr from-slate-300 via-slate-100 to-slate-300 border-2 border-slate-200 text-2xl md:text-3xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                          🥈
                        </div>
                        {secondPlace ? (
                          <div className="space-y-1">
                            <div className="inline-block bg-slate-300/20 text-slate-200 border border-slate-300/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                              الوصيف (الفضة)
                            </div>
                            <h4 className="text-xs md:text-sm font-black text-white line-clamp-1">
                              {secondPlace.fullName}
                            </h4>
                            <p className="text-[10px] md:text-xs text-slate-300 line-clamp-1 font-medium">
                              {secondPlace.schoolName}
                            </p>
                            {secondPlace.time && (
                              <span className="inline-block font-mono text-[10px] md:text-xs font-bold text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700">
                                ⏱️ {secondPlace.time}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-medium italic">في انتظار التتويج</p>
                        )}
                      </div>

                      {/* 2nd Platform Pedestal */}
                      <div className="w-full h-36 md:h-44 rounded-t-2xl bg-gradient-to-b from-slate-300 via-slate-400 to-slate-600 border-t-2 border-x-2 border-slate-200/60 shadow-xl flex flex-col items-center justify-start pt-3 text-slate-900">
                        <span className="text-3xl md:text-5xl font-black opacity-90 drop-shadow-sm">2</span>
                        <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-widest text-slate-800 mt-1">
                          المركز الثاني
                        </span>
                        <span className="text-[9px] font-bold text-slate-700 mt-0.5">ميدالية فضية</span>
                      </div>
                    </div>

                    {/* 1ST PLACE (GOLD 🥇 - CENTER HIGHEST) */}
                    <div className="flex flex-col items-center">
                      {/* Athlete Info Card */}
                      <div className="mb-3 text-center w-full px-1">
                        <div className="relative inline-block">
                          <div className="w-16 h-16 md:w-20 md:h-20 mx-auto mb-2 rounded-2xl bg-gradient-to-tr from-amber-300 via-yellow-200 to-amber-500 border-2 border-amber-200 text-3xl md:text-4xl flex items-center justify-center shadow-xl transform hover:scale-105 transition-transform animate-bounce-subtle">
                            🥇
                          </div>
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-base">👑</span>
                        </div>

                        {firstPlace ? (
                          <div className="space-y-1">
                            <div className="inline-block bg-amber-400 text-slate-950 text-[10px] md:text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">
                              بطل الفئة (الذهب)
                            </div>
                            <h4 className="text-sm md:text-base font-black text-amber-300 line-clamp-1">
                              {firstPlace.fullName}
                            </h4>
                            <p className="text-[11px] md:text-xs text-amber-100 line-clamp-1 font-bold">
                              {firstPlace.schoolName}
                            </p>
                            {firstPlace.time && (
                              <span className="inline-block font-mono text-xs font-black text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-500/40">
                                ⏱️ {firstPlace.time}
                              </span>
                            )}
                            {firstPlace.bibNumber && (
                              <span className="block text-[9px] text-amber-300/80 font-bold">
                                صدرية رقم: #{firstPlace.bibNumber}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-400 font-medium italic">في انتظار التتويج</p>
                        )}
                      </div>

                      {/* 1st Platform Pedestal (Highest) */}
                      <div className="w-full h-48 md:h-60 rounded-t-3xl bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 border-t-2 border-x-2 border-amber-200 shadow-2xl flex flex-col items-center justify-start pt-4 text-slate-950 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                        <span className="relative z-10 text-4xl md:text-6xl font-black text-slate-950 drop-shadow-sm">
                          1
                        </span>
                        <span className="relative z-10 text-xs md:text-sm font-black uppercase tracking-widest text-slate-950 mt-1">
                          المركز الأول
                        </span>
                        <span className="relative z-10 text-[10px] font-extrabold text-amber-950 bg-amber-300/70 px-2 py-0.5 rounded-full mt-1">
                          ميدالية ذهبية 🏆
                        </span>
                      </div>
                    </div>

                    {/* 3RD PLACE (BRONZE 🥉 - LEFT IN RTL) */}
                    <div className="flex flex-col items-center">
                      {/* Athlete Info Card */}
                      <div className="mb-3 text-center w-full px-1">
                        <div className="w-12 h-12 md:w-16 md:h-16 mx-auto mb-2 rounded-2xl bg-gradient-to-tr from-amber-700 via-amber-600 to-amber-800 border-2 border-amber-600/50 text-2xl md:text-3xl flex items-center justify-center shadow-lg transform hover:scale-105 transition-transform">
                          🥉
                        </div>
                        {thirdPlace ? (
                          <div className="space-y-1">
                            <div className="inline-block bg-amber-700/30 text-amber-300 border border-amber-600/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                              المركز الثالث (البرونز)
                            </div>
                            <h4 className="text-xs md:text-sm font-black text-white line-clamp-1">
                              {thirdPlace.fullName}
                            </h4>
                            <p className="text-[10px] md:text-xs text-slate-300 line-clamp-1 font-medium">
                              {thirdPlace.schoolName}
                            </p>
                            {thirdPlace.time && (
                              <span className="inline-block font-mono text-[10px] md:text-xs font-bold text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-md border border-amber-800">
                                ⏱️ {thirdPlace.time}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400 font-medium italic">في انتظار التتويج</p>
                        )}
                      </div>

                      {/* 3rd Platform Pedestal */}
                      <div className="w-full h-28 md:h-36 rounded-t-2xl bg-gradient-to-b from-amber-700 via-amber-800 to-amber-950 border-t-2 border-x-2 border-amber-600/60 shadow-xl flex flex-col items-center justify-start pt-3 text-amber-200">
                        <span className="text-3xl md:text-5xl font-black text-amber-200 drop-shadow-sm">3</span>
                        <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-widest text-amber-300 mt-1">
                          المركز الثالث
                        </span>
                        <span className="text-[9px] font-bold text-amber-400 mt-0.5">ميدالية برونزية</span>
                      </div>
                    </div>
                  </div>

                  {/* Base Platform Bar */}
                  <div className="h-4 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 rounded-b-2xl border-t border-white/10 shadow-inner"></div>
                </div>

                {/* Empty state action prompt */}
                {!firstPlace && !secondPlace && !thirdPlace && canEdit && (
                  <div className="relative z-10 text-center pt-4">
                    <button
                      onClick={() => handleOpenEdit(selectedCatId)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 text-slate-950 font-black text-xs md:text-sm rounded-xl shadow-lg transition-transform active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      <span>تسجيل نتائج هذا السباق وتتويج الأبطال الآن ⏱️</span>
                    </button>
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
                          <th className="py-3 px-4 w-16 text-center">الرتبة</th>
                          <th className="py-3 px-4 w-20 text-center">الصدرية</th>
                          <th className="py-3 px-4">اسم العداء(ة)</th>
                          <th className="py-3 px-4">المؤسسة التعليمية</th>
                          <th className="py-3 px-4 text-center">التوقيت الرسمي</th>
                          <th className="py-3 px-4">الملاحظات والتأهيل</th>
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
                              {/* Rank */}
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

                              {/* Bib */}
                              <td className="py-3 px-4 text-center font-mono font-bold text-slate-600">
                                {winner.bibNumber ? `#${winner.bibNumber}` : '-'}
                              </td>

                              {/* Full Name */}
                              <td className="py-3 px-4">
                                <span className="font-black text-slate-900 text-sm">
                                  {winner.fullName}
                                </span>
                              </td>

                              {/* School */}
                              <td className="py-3 px-4 text-slate-600 font-bold">
                                {winner.schoolName}
                              </td>

                              {/* Time */}
                              <td className="py-3 px-4 text-center font-mono font-black text-slate-800">
                                {winner.time || '-'}
                              </td>

                              {/* Notes / Qualification */}
                              <td className="py-3 px-4">
                                {isGold || isSilver || isBronze ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    {winner.notes || 'مؤهل للبطولة الجهوية'}
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-500 font-medium">
                                    {winner.notes || 'مؤهل للمنتخب الإقليمي'}
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
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden my-6">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-xl shadow-sm">
                  🏆
                </div>
                <div>
                  <h3 className="text-base font-black">
                    تسجيل نتائج منصة التتويج (البوديوم)
                  </h3>
                  <p className="text-xs text-slate-300">
                    {CROSS_COUNTRY_CATEGORIES.find(c => c.id === editingCategoryId)?.titleAr}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Category Selector inside modal */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    className="w-full text-xs font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white"
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
                    className="w-full text-xs font-bold rounded-xl border border-slate-300 p-2.5 bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Notice */}
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p>
                  يمكنك كتابة اسم العداء والمؤسسة والتوقيت يدوياً، أو الاختيار السريع من قائمة التلاميذ المسجلين في هذه الفئة بالمديرية لملء البيانات بضغطة زر.
                </p>
              </div>

              {/* Winners rows (Rank 1, 2, 3...) */}
              <div className="space-y-4">
                {editingWinners.map((winner, idx) => {
                  const rankNum = idx + 1;
                  const isGold = rankNum === 1;
                  const isSilver = rankNum === 2;
                  const isBronze = rankNum === 3;

                  return (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isGold
                          ? 'bg-amber-50/50 border-amber-300'
                          : isSilver
                          ? 'bg-slate-50 border-slate-300'
                          : isBronze
                          ? 'bg-amber-50/30 border-amber-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">
                            {isGold ? '🥇' : isSilver ? '🥈' : isBronze ? '🥉' : '🏅'}
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            {isGold ? 'المركز الأول (الميدالية الذهبية)' : isSilver ? 'المركز الثاني (الميدالية الفضية)' : isBronze ? 'المركز الثالث (الميدالية البرونزية)' : `المركز ${rankNum}`}
                          </span>
                        </div>

                        {idx >= 3 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingWinners.filter((_, i) => i !== idx);
                              setEditingWinners(updated);
                            }}
                            className="text-red-500 hover:text-red-700 p-1"
                            title="حذف هذا المركز"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Quick select dropdown from registered students */}
                      {availableCategoryStudents.length > 0 && (
                        <div className="mb-2">
                          <select
                            onChange={e => {
                              if (e.target.value) {
                                handleSelectStudentForRank(idx, e.target.value);
                              }
                            }}
                            defaultValue=""
                            className="w-full text-[11px] font-bold text-slate-700 bg-white border border-slate-300 rounded-lg p-1.5 focus:border-blue-500"
                          >
                            <option value="">⚡ ملء سريع: اختر من قائمة التلاميذ المسجلين في هذا السباق ({availableCategoryStudents.length} عداء)...</option>
                            {availableCategoryStudents.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.fullName} - {s.schoolName}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Inputs Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            اسم العداء(ة) الكامل *
                          </label>
                          <input
                            type="text"
                            value={winner.fullName}
                            onChange={e => {
                              const updated = [...editingWinners];
                              updated[idx].fullName = e.target.value;
                              setEditingWinners(updated);
                            }}
                            placeholder="مثلاً: أنس العلمي"
                            className="w-full font-bold text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            المؤسسة التعليمية *
                          </label>
                          <input
                            type="text"
                            value={winner.schoolName}
                            onChange={e => {
                              const updated = [...editingWinners];
                              updated[idx].schoolName = e.target.value;
                              setEditingWinners(updated);
                            }}
                            placeholder="مثلاً: إعدادية الفتح"
                            className="w-full font-bold text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            التوقيت الرسمي (⏱️)
                          </label>
                          <input
                            type="text"
                            value={winner.time || ''}
                            onChange={e => {
                              const updated = [...editingWinners];
                              updated[idx].time = e.target.value;
                              setEditingWinners(updated);
                            }}
                            placeholder="مثلاً: 09:42.15"
                            className="w-full font-mono font-bold text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-blue-500"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-600 mb-0.5">
                            رقم الصدرية (Dossard)
                          </label>
                          <input
                            type="text"
                            value={winner.bibNumber || ''}
                            onChange={e => {
                              const updated = [...editingWinners];
                              updated[idx].bibNumber = e.target.value;
                              setEditingWinners(updated);
                            }}
                            placeholder="مثلاً: 104"
                            className="w-full font-mono font-bold text-xs rounded-lg border border-slate-300 p-2 bg-white focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

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
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة رتبة إضافية (المركز {editingWinners.length + 1})</span>
                </button>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleSaveWinners}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs md:text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'جاري الحفظ...' : 'حفظ النتائج وتثبيت البوديوم 🏆'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
