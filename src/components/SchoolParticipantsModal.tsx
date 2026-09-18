import React, { useState, useEffect, useMemo } from 'react';
import { School, Student, Tournament, Sport } from '../types';
import { DataService, SPORTS_MAP, AGE_CATEGORIES, getCategoryGenderLabel } from '../lib/dataService';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  X,
  Users,
  Trophy,
  Download,
  Printer,
  ExternalLink,
  MapPin,
  User,
  Phone,
  PhoneCall,
  Calendar,
  Filter,
  CheckCircle2,
  FileText,
  FileDown,
  Sparkles,
  ShieldCheck,
  ChevronLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ParticipationFormPdfModal } from './ParticipationFormPdfModal';
import { useAuth } from '../contexts/AuthContext';

interface SchoolParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  school: School | null;
  sportId: string;
  allStudents: Student[];
}

export const SchoolParticipantsModal: React.FC<SchoolParticipantsModalProps> = ({
  isOpen,
  onClose,
  school,
  sportId,
  allStudents
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'tournaments' | 'students'>('tournaments');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>(sportId || 'ALL');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('ALL');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);

  const { userProfile } = useAuth();
  const isTeacher = userProfile?.role === 'TEACHER';

  const isUserBelongToSchool = useMemo(() => {
    if (!school || !userProfile) return false;
    if (!isTeacher) return true; // Admins / regional managers can manage
    if (!userProfile.workLocation && !userProfile.schoolId) return false;
    const cleanWorkLoc = (userProfile.workLocation || '').trim().toLowerCase();
    const cleanSchoolName = (school.name || '').trim().toLowerCase();
    return (
      cleanSchoolName === cleanWorkLoc ||
      cleanSchoolName.includes(cleanWorkLoc) ||
      cleanWorkLoc.includes(cleanSchoolName) ||
      (userProfile.schoolId && school.id === userProfile.schoolId)
    );
  }, [school, userProfile, isTeacher]);

  // PDF Modal state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfTargetSport, setPdfTargetSport] = useState<Sport | null>(null);
  const [pdfStudents, setPdfStudents] = useState<Student[]>([]);
  const [selectedPdfCategory, setSelectedPdfCategory] = useState<string>('ALL');

  // Expanded group ID for showing the student list inline
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedSportFilter(sportId || 'ALL');
      setLoadingTournaments(true);
      DataService.getTournaments()
        .then(tList => setTournaments(tList || []))
        .catch(err => console.error(err))
        .finally(() => setLoadingTournaments(false));
    }
  }, [isOpen, sportId]);

  if (!isOpen || !school) return null;

  // Filter students belonging to this school
  const schoolStudents = allStudents.filter(
    s => s.schoolId === school.id || s.schoolName === school.name
  );

  // Filter by sport if a specific sport is selected
  const sportStudents = selectedSportFilter === 'ALL'
    ? schoolStudents
    : schoolStudents.filter(s => s.sportId === selectedSportFilter);

  // Filter by category if selected
  const displayedStudents = activeCategoryFilter === 'ALL'
    ? sportStudents
    : sportStudents.filter(s => s.category === activeCategoryFilter);

  const sportInfo = selectedSportFilter !== 'ALL' ? SPORTS_MAP[selectedSportFilter] : null;

  const maleCount = sportStudents.filter(s => s.gender === 'Male').length;
  const femaleCount = sportStudents.filter(s => s.gender === 'Female').length;
  const categoriesPresent = Array.from(new Set(sportStudents.map(s => s.category).filter(Boolean)));

  // Open PDF modal for a specific sport or default
  const handleOpenPdfForSport = (sportIdToUse?: string) => {
    const targetId = sportIdToUse || (sportId !== 'ALL' ? sportId : schoolStudents[0]?.sportId || 'football');
    const targetSportObj = SPORTS_MAP[targetId] || {
      id: targetId,
      name: targetId,
      description: '',
      icon: '🏆'
    };

    setPdfTargetSport(targetSportObj as Sport);
    setPdfStudents([]);
    setSelectedPdfCategory('ALL');
    setIsPdfModalOpen(true);
  };

  // Open PDF modal for a specific sport and group with preselected category
  const handleOpenPdfForGroup = (sportIdToUse: string, groupStudents: Student[], catId: string) => {
    const targetSportObj = SPORTS_MAP[sportIdToUse] || {
      id: sportIdToUse,
      name: sportIdToUse,
      description: '',
      icon: '🏆'
    };

    setPdfTargetSport(targetSportObj as Sport);
    setPdfStudents(groupStudents);
    setSelectedPdfCategory(catId);
    setIsPdfModalOpen(true);
  };

  const handleExportExcel = () => {
    try {
      const sportLabel = sportInfo ? sportInfo.name : 'جميع الرياضات';
      const rows = sportStudents.map((s, index) => {
        const catInfo = AGE_CATEGORIES.find(c => c.id === s.category);
        const sSport = SPORTS_MAP[s.sportId];
        return {
          'الرقم الترتيبي': index + 1,
          'الاسم والنسب': s.fullName,
          'رقم مسار': s.massarNumber || '---',
          'الجنس': s.gender === 'Male' ? 'ذكر' : 'أنثى',
          'تاريخ الازدياد': s.birthDate || 'غير محدد',
          'الصفة الرياضية': s.affiliationType === 'club_affiliated' ? 'منتمي لنادي/عصبة' : 'لا منتمي (مدرسي فقط)',
          'الفئة العمرية': catInfo ? catInfo.shortName : s.category || 'غير محدد',
          'الرياضة': sSport ? sSport.name : s.sportId,
          'نوع المشاركة / التخصص': s.athleticsSpecialty || (s.participationType === 'school_team' ? 'فريق المؤسسة' : 'فردي'),
          'المسافة': s.distance || '---',
          'المؤسسة التعليمية': school.name,
          'الجماعة': school.commune,
          'الأستاذ المؤطر': school.teacherName,
          'هاتف المؤطر': school.phone || '---',
          'هاتف مدير المؤسسة': school.principalPhone || '---'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!views'] = [{ RTL: true }];

      const workbook = XLSX.utils.book_new();
      const cleanSheetName = (sportInfo ? sportInfo.name : 'المشاركون').substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, worksheet, cleanSheetName);

      const fileName = `لائحة_مشاركي_${school.name.replace(/\s+/g, '_')}_${sportLabel.replace(/\s+/g, '_')}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.success('تم تصدير لائحة المشاركين بصيغة Excel بنجاح!');
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء تصدير اللائحة');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleNavigateToManage = (sportIdToManage?: string) => {
    if (isTeacher && !isUserBelongToSchool) {
      toast.error('عذراً، لا يمكنك إضافة مشاركين أو تعديل فرق مؤسسة لا تنتمي إليها.');
      return;
    }
    onClose();
    const query = new URLSearchParams();
    const sId = sportIdToManage || (sportId !== 'ALL' ? sportId : '');
    if (sId) {
      query.set('sport', sId);
    }
    query.set('school', school.name);
    navigate(`/teacher-teams?${query.toString()}`);
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto p-1.5 sm:p-4 flex min-h-full items-center justify-center bg-slate-900/60 backdrop-blur-xs overscroll-contain" dir="rtl">
        <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[94dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 text-white p-4 sm:p-5 relative shrink-0">
            <button
              onClick={onClose}
              className="absolute top-3.5 left-3.5 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-1 pl-8 sm:pl-0">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-xl sm:text-2xl shrink-0 shadow-inner">
                  {sportInfo ? sportInfo.icon : '🏫'}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] sm:text-[11px] bg-blue-500/40 text-blue-100 font-bold px-2.5 py-0.5 rounded-full border border-blue-300/30">
                      {sportInfo ? `بطولة ${sportInfo.name}` : 'جميع البطولات والرياضات'}
                    </span>
                    <span className="text-[10px] sm:text-[11px] bg-white/20 text-white font-medium px-2 py-0.5 rounded-full">
                      {school.type}
                    </span>
                  </div>
                  <h2 className="text-base sm:text-xl font-black mt-1 text-white leading-tight">
                    {school.name} - ملف المشاركات والفرق
                  </h2>
                  <div className="flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs text-blue-100/90 mt-1 flex-wrap font-medium">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-blue-200 shrink-0" />
                      {school.commune}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <User className="h-3.5 w-3.5 text-blue-200 shrink-0" />
                      المؤطر: {school.teacherName || school.coordinatorName || '—'}
                    </span>
                    {school.phone && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono" dir="ltr">
                          <Phone className="h-3 w-3 text-blue-200 shrink-0" />
                          {school.phone}
                        </span>
                      </>
                    )}
                    {school.principalPhone && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1 font-mono bg-amber-400/20 text-amber-200 px-2 py-0.5 rounded border border-amber-300/30 font-bold" dir="ltr">
                          <PhoneCall className="h-3 w-3 text-amber-300 shrink-0" />
                          المدير: {school.principalPhone}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons inside Header */}
              <div className="flex items-center gap-2 pt-1 sm:pt-0 self-start sm:self-center flex-wrap">
              </div>
            </div>
          </div>

          {/* Navigation Tabs Header */}
          <div className="bg-slate-100 border-b border-slate-200 px-3 sm:px-4 pt-2 flex items-center gap-2 overflow-x-auto shrink-0">
            <button
              onClick={() => setActiveTab('tournaments')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-black rounded-t-xl border-t border-x transition-all shrink-0 cursor-pointer ${
                activeTab === 'tournaments'
                  ? 'bg-white border-slate-300 text-blue-700 shadow-xs -mb-[1px]'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
              <span>المشاركات في البطولات 🏆</span>
            </button>

            <button
              onClick={() => setActiveTab('students')}
              className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-black rounded-t-xl border-t border-x transition-all shrink-0 cursor-pointer ${
                activeTab === 'students'
                  ? 'bg-white border-slate-300 text-blue-700 shadow-xs -mb-[1px]'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Users className="w-4 h-4 text-blue-600 shrink-0" />
              <span>لوائح التلاميذ المسجلين ({schoolStudents.length}) 👥</span>
            </button>
          </div>

          {/* Stats & Filter Strip */}
          <div className="bg-slate-50 border-b border-slate-200 p-2.5 sm:p-3 sm:px-5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-6 text-xs flex-wrap">
              <div className="flex items-center gap-1.5 font-bold text-slate-800">
                <Users className="h-4 w-4 text-blue-600 shrink-0" />
                <span>المجموع بالمؤسسة:</span>
                <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-black text-xs sm:text-sm">
                  {schoolStudents.length}
                </span>
              </div>

              {/* Sport Filter Dropdown */}
              <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-300 shadow-3xs">
                <span className="text-[11px] font-bold text-slate-500">تصفية بالرياضة:</span>
                <select
                  value={selectedSportFilter}
                  onChange={(e) => setSelectedSportFilter(e.target.value)}
                  className="text-xs font-black text-blue-900 bg-transparent border-none focus:ring-0 cursor-pointer"
                >
                  <option value="ALL">🌟 جميع الرياضات ({schoolStudents.length})</option>
                  {Array.from(new Set(schoolStudents.map(s => s.sportId).filter(Boolean))).map((sId) => {
                    const sIdStr = sId as string;
                    const sObj = SPORTS_MAP[sIdStr] || { name: sIdStr, icon: '🏆' };
                    const count = schoolStudents.filter(s => s.sportId === sIdStr).length;
                    return (
                      <option key={sIdStr} value={sIdStr}>
                        {sObj.icon} {sObj.name} ({count})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span>ذكور:</span>
                <span className="font-bold text-blue-700">{sportStudents.filter(s => s.gender === 'Male').length}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                <span>إناث:</span>
                <span className="font-bold text-rose-600">{sportStudents.filter(s => s.gender === 'Female').length}</span>
              </div>
            </div>

            {/* Category Filter Pills if active Tab is students and more than 1 category exists */}
            {activeTab === 'students' && categoriesPresent.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full">
                <span className="text-[11px] font-bold text-slate-400 shrink-0 ml-1">تصفية:</span>
                <button
                  onClick={() => setActiveCategoryFilter('ALL')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors shrink-0 cursor-pointer ${
                    activeCategoryFilter === 'ALL'
                      ? 'bg-slate-800 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  الكل ({sportStudents.length})
                </button>
                {categoriesPresent.map(catId => {
                  const catObj = AGE_CATEGORIES.find(c => c.id === catId);
                  const count = sportStudents.filter(s => s.category === catId).length;
                  return (
                    <button
                      key={catId}
                      onClick={() => setActiveCategoryFilter(catId)}
                      className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors shrink-0 cursor-pointer ${
                        activeCategoryFilter === catId
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {catObj ? catObj.shortName : catId} ({count})
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scrollable Main Content */}
          <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50 overscroll-contain">
            {/* TAB 1: PROGRAMMED TOURNAMENTS & PARTICIPATIONS */}
            {activeTab === 'tournaments' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-200">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>البطولات والفئات التي تشارك فيها المؤسسة فعلياً</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    يتم تلوين بطولات المنتمين للأندية باللون الأصفر وبطولات غير المنتمين باللون الأبيض
                  </span>
                </div>

                {loadingTournaments ? (
                  <div className="flex justify-center p-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                ) : (() => {
                  // Group school students by Sport, Category, and AffiliationType
                  const participatingGroups = (() => {
                    const groups: {
                      id: string;
                      sportId: string;
                      category: string;
                      affiliationType: 'club_affiliated' | 'non_club';
                      students: Student[];
                    }[] = [];

                    schoolStudents.forEach(st => {
                      if (!st.category || !st.sportId) return;
                      if (selectedSportFilter !== 'ALL' && st.sportId !== selectedSportFilter) return;

                      const sId = st.sportId;
                      const cat = st.category;
                      const aff: 'club_affiliated' | 'non_club' = st.affiliationType === 'club_affiliated' ? 'club_affiliated' : 'non_club';

                      let g = groups.find(x => x.sportId === sId && x.category === cat && x.affiliationType === aff);
                      if (!g) {
                        g = {
                          id: `${sId}_${cat}_${aff}`,
                          sportId: sId,
                          category: cat,
                          affiliationType: aff,
                          students: []
                        };
                        groups.push(g);
                      }
                      g.students.push(st);
                    });

                    // Sort groups by Sport Name and then Category name
                    return groups.sort((a, b) => {
                      const sportA = SPORTS_MAP[a.sportId]?.name || a.sportId;
                      const sportB = SPORTS_MAP[b.sportId]?.name || b.sportId;
                      const compSport = sportA.localeCompare(sportB, 'ar');
                      if (compSport !== 0) return compSport;
                      return a.category.localeCompare(b.category);
                    });
                  })();

                  if (participatingGroups.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-white rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3 shadow-2xs">
                        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl border border-amber-200">
                          🏆
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-slate-800">
                            لا توجد مشاركات مسجلة حالياً لهذه المؤسسة التعليمية
                          </h4>
                          <p className="text-xs text-slate-500 max-w-md">
                            لم تقم مؤسسة <span className="font-bold text-slate-700">{school.name}</span> بعد بتسجيل أطقمها في أي من بطولات البرنامج الرياضي.
                          </p>
                        </div>
                        <button
                          onClick={() => handleNavigateToManage()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 mt-2"
                        >
                          <span>+ إدراج وتأطير مشاركي المؤسسة الآن</span>
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      {participatingGroups.map((group) => {
                        const sObj = SPORTS_MAP[group.sportId] || { name: group.sportId, icon: '🏆', description: '' };
                        const catObj = AGE_CATEGORIES.find(c => c.id === group.category);
                        const catLabel = catObj ? catObj.shortName : group.category;
                        const isClubAffiliated = group.affiliationType === 'club_affiliated';

                        const groupMaleCount = group.students.filter(st => st.gender === 'Male').length;
                        const groupFemaleCount = group.students.filter(st => st.gender === 'Female').length;

                        return (
                          <div
                            key={group.id}
                            className={`p-4 sm:p-5 rounded-2xl border-2 transition-all shadow-xs ${
                              isClubAffiliated
                                ? 'bg-amber-50/70 border-amber-200 hover:border-amber-300'
                                : 'bg-white border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
                              <div className="flex items-center gap-3">
                                <span className={`text-2xl sm:text-3xl p-2 rounded-xl border shrink-0 ${
                                  isClubAffiliated ? 'bg-amber-100/70 border-amber-300' : 'bg-blue-50/80 border-blue-100'
                                }`}>
                                  {sObj.icon}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className="text-sm sm:text-base font-black text-slate-950">
                                      بطولة {sObj.name} - فئة {catLabel}
                                    </h4>
                                    <span className={`text-[9px] sm:text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                                      isClubAffiliated
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-slate-100 text-slate-800 border-slate-300'
                                    }`}>
                                      {isClubAffiliated ? '🟡 للمنتمين للأندية' : '⚪ لا منتمين'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                                    الفئة العمرية المعتمدة: {catObj ? catObj.name : group.category}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 text-xs font-bold font-mono">
                                <span className="bg-blue-50/80 text-blue-800 px-2.5 py-1 rounded-lg border border-blue-200">{groupMaleCount} ذكور</span>
                                <span className="bg-rose-50/80 text-rose-800 px-2.5 py-1 rounded-lg border border-rose-200">{groupFemaleCount} إناث</span>
                                <span className="bg-slate-800 text-white px-3 py-1 rounded-lg font-black">{group.students.length} مشارك(ة)</span>
                              </div>
                            </div>

                            {/* Expanded Student List inside the Card */}
                            {expandedGroupId === group.id && (
                              <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-2.5 overflow-x-auto animate-in fade-in duration-200">
                                <h5 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                                  <span>👥 لائحة المشاركين المسجلين في هذه الفئة:</span>
                                </h5>
                                <table className="w-full text-center border-collapse text-xs bg-white rounded-xl overflow-hidden border border-slate-200">
                                  <thead>
                                    <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                                      <th className="p-2.5 w-10 text-center">ر.ت</th>
                                      <th className="p-2.5">الاسم والنسب</th>
                                      <th className="p-2.5">رقم مسار</th>
                                      <th className="p-2.5 text-center">الجنس</th>
                                      <th className="p-2.5 text-center">تاريخ الازدياد</th>
                                      <th className="p-2.5 text-center">الانتماء الرياضي</th>
                                      <th className="p-2.5">التفاصيل / التخصص</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {group.students.map((stud, idx) => (
                                      <tr key={stud.id} className="hover:bg-slate-50/50">
                                        <td className="p-2.5 text-center font-bold text-slate-400">{idx + 1}</td>
                                        <td className="p-2.5 font-bold text-slate-950">{stud.fullName}</td>
                                        <td className="p-2.5 font-mono text-blue-700 font-bold">{stud.massarNumber || '—'}</td>
                                        <td className="p-2.5 text-center">
                                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                            stud.gender === 'Male' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                                          }`}>
                                            {stud.gender === 'Male' ? 'ذكر' : 'أنثى'}
                                          </span>
                                        </td>
                                        <td className="p-2.5 text-center font-mono text-slate-600">{stud.birthDate || '—'}</td>
                                        <td className="p-2.5 text-center">
                                          <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${
                                            stud.affiliationType === 'club_affiliated'
                                              ? 'bg-amber-100 text-amber-950 border-amber-300'
                                              : 'bg-slate-100 text-slate-700 border-slate-200'
                                          }`}>
                                            {stud.affiliationType === 'club_affiliated' ? 'منتمي لنادي' : 'لا منتمي'}
                                          </span>
                                        </td>
                                        <td className="p-2.5 text-slate-500 font-medium">
                                          {stud.athleticsSpecialty || (stud.participationType === 'school_team' ? 'فريق المؤسسة' : 'مشاركة فردية')}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}

                            {/* Card Footer Actions */}
                            <div className="pt-3.5 mt-3 border-t border-slate-200/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setExpandedGroupId(expandedGroupId === group.id ? null : group.id)}
                                  className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <span>{expandedGroupId === group.id ? 'إخفاء اللائحة 👁️‍عون' : 'عرض اللائحة 👁️'}</span>
                                </button>
                              </div>

                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <button
                                  onClick={() => handleOpenPdfForGroup(group.sportId, group.students, group.category)}
                                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                                  title="تحميل لائحة المشاركة الرسمية بصيغة PDF لهذه الفئة حصراً"
                                >
                                  <FileText className="w-4 h-4 shrink-0" />
                                  <span>تحميل لائحة المشاركة (PDF)</span>
                                </button>

                                {(!isTeacher || isUserBelongToSchool) && (
                                  <button
                                    onClick={() => handleNavigateToManage(group.sportId)}
                                    className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <span>تعديل الفريق</span>
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 2: REGISTERED STUDENTS DETAILED LIST */}
            {activeTab === 'students' && (
              <div className="space-y-3">
                {displayedStudents.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {displayedStudents.map((stud, idx) => {
                      const catInfo = AGE_CATEGORIES.find(c => c.id === stud.category);
                      const studSport = SPORTS_MAP[stud.sportId] || { name: stud.sportId, icon: '🏆' };

                      return (
                        <div
                          key={stud.id}
                          className="flex items-start gap-3 p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-blue-300 transition-all w-full"
                        >
                          {/* Student Photo or Avatar */}
                          <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                            {stud.photoUrl ? (
                              <img
                                src={stud.photoUrl}
                                alt={stud.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span className="text-xl">
                                {stud.gender === 'Female' ? '👧' : '👦'}
                              </span>
                            )}
                          </div>

                          {/* Student Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                  {idx + 1}. {stud.fullName}
                                </h4>
                                {stud.massarNumber && (
                                  <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200 inline-block mt-0.5">
                                    رقم مسار: {stud.massarNumber}
                                  </span>
                                )}
                              </div>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                stud.gender === 'Male'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {stud.gender === 'Male' ? 'ذكر' : 'أنثى'}
                              </span>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                              {/* Sport Badge */}
                              <span className="bg-blue-50 text-blue-800 font-bold px-2 py-0.5 rounded border border-blue-200">
                                {studSport.icon} {studSport.name}
                              </span>

                              {/* Category Badge */}
                              <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200/80">
                                {catInfo ? catInfo.shortName : stud.category}
                              </span>

                              {/* Affiliation Badge */}
                              <span className={`px-2 py-0.5 rounded border font-bold ${
                                stud.affiliationType === 'club_affiliated'
                                  ? 'bg-amber-100 text-amber-950 border-amber-300'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}>
                                {stud.affiliationType === 'club_affiliated' ? '🟡 منتمي لنادي / عصبة' : '⚪ لا منتمي'}
                              </span>

                              {/* Birth Date */}
                              {stud.birthDate && (
                                <span className="text-slate-500 font-medium font-mono flex items-center gap-1">
                                  <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
                                  {stud.birthDate}
                                </span>
                              )}
                            </div>

                            {/* Details / Specialty / Distance */}
                            {(stud.participationType || stud.athleticsSpecialty || stud.distance) && (
                              <div className="mt-1.5 pt-1.5 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[10px] text-slate-600">
                                {stud.participationType && (
                                  <span className="font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded">
                                    {stud.participationType === 'school_team' ? 'فريق المؤسسة' : 'مشاركة فردية'}
                                  </span>
                                )}
                                {stud.athleticsSpecialty && (
                                  <span className="font-bold text-amber-800 bg-amber-50 px-1.5 py-0.2 rounded">
                                    {stud.athleticsSpecialty}
                                  </span>
                                )}
                                {stud.distance && (
                                  <span className="font-medium text-slate-500 font-mono">
                                    المسافة: {stud.distance}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-dashed border-slate-200">
                    <Users className="h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700">لا يوجد تلاميذ مسجلين لهذه المؤسسة حالياً</p>
                    <p className="text-xs text-slate-400 mt-1">
                      يمكن للأستاذ المؤطر إضافة وتأكيد تسجيل التلاميذ عبر منصة فرق المؤسسة
                    </p>
                    {(!isTeacher || isUserBelongToSchool) && (
                      <button
                        onClick={() => handleNavigateToManage()}
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>فتح صفحة تسجيل وتأطير الفرق</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-white border-t border-slate-200 p-3 sm:px-5 flex flex-col sm:flex-row items-center justify-between gap-2.5 shrink-0">
            <span className="text-xs text-slate-500 font-medium text-center sm:text-right">
              منظومة تدبير الأنشطة الرياضية المدرسية - مديرية تاوريرت
            </span>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {(!isTeacher || isUserBelongToSchool) && (
                <button
                  onClick={() => handleNavigateToManage()}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>إدارة الفرق</span>
                </button>
              )}

              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Official PDF Participation Form Modal */}
      {pdfTargetSport && (
        <ParticipationFormPdfModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          sport={pdfTargetSport}
          schoolName={school.name}
          directorateName="المديرية الإقليمية بتاوريرت"
          teacher={{
            fullName: school.teacherName,
            phone: school.phone
          }}
          students={pdfStudents.length > 0 ? pdfStudents : schoolStudents}
          preselectedCategory={selectedPdfCategory}
        />
      )}
    </>
  );
};
