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
  ChevronLeft,
  ChevronDown,
  Edit2,
  Trash2,
  Save,
  AlertTriangle,
  Upload
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

  const canSeePrincipalPhone = useMemo(() => {
    if (!school || !userProfile) return false;
    const isPrivilegedAdmin = userProfile.role === 'CENTRAL_ADMIN' || 
                              userProfile.role === 'REGIONAL_ADMIN' || 
                              userProfile.role === 'PROVINCIAL_ADMIN';
    if (isPrivilegedAdmin) return true;
    
    const cleanWorkLoc = (userProfile.workLocation || userProfile.schoolName || '').trim().toLowerCase();
    const cleanSchoolName = (school.name || '').trim().toLowerCase();
    return (
      !!(cleanWorkLoc && (cleanSchoolName === cleanWorkLoc || cleanSchoolName.includes(cleanWorkLoc) || cleanWorkLoc.includes(cleanSchoolName))) ||
      !!(userProfile.schoolId && school.id === userProfile.schoolId)
    );
  }, [school, userProfile]);

  // PDF Modal state
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [pdfTargetSport, setPdfTargetSport] = useState<Sport | null>(null);
  const [pdfStudents, setPdfStudents] = useState<Student[]>([]);
  const [selectedPdfCategory, setSelectedPdfCategory] = useState<string>('ALL');

  // Selected group ID for viewing detailed tournament participants card
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [detailCatFilter, setDetailCatFilter] = useState<string>('ALL');

  // Local state for instant student updates
  const [localStudents, setLocalStudents] = useState<Student[]>(allStudents);
  useEffect(() => {
    setLocalStudents(allStudents);
  }, [allStudents]);

  // Edit / Delete student states
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Edit Form Fields
  const [editFullName, setEditFullName] = useState('');
  const [editMassarNumber, setEditMassarNumber] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female'>('Male');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editCategory, setEditCategory] = useState('U12');
  const [editAffiliationType, setEditAffiliationType] = useState<'non_club' | 'club_affiliated'>('non_club');
  const [editParticipationType, setEditParticipationType] = useState<'individual' | 'school_team'>('school_team');
  const [editAthleticsSpecialty, setEditAthleticsSpecialty] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editBibNumber, setEditBibNumber] = useState('');

  const handleStartEditStudent = (stud: Student) => {
    setEditingStudent(stud);
    setEditFullName(stud.fullName || '');
    setEditMassarNumber(stud.massarNumber || '');
    setEditGender(stud.gender || 'Male');
    setEditBirthDate(stud.birthDate || '');
    setEditCategory(stud.category || 'U12');
    setEditAffiliationType(stud.affiliationType || 'non_club');
    setEditParticipationType(stud.participationType || 'school_team');
    setEditAthleticsSpecialty(stud.athleticsSpecialty || '');
    setEditPhotoUrl(stud.photoUrl || '');
    setEditBibNumber(
      stud.bibNumber ? String(stud.bibNumber) : (stud.crossCountryBibNumber ? String(stud.crossCountryBibNumber) : '')
    );
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن لا يتعدى 5 ميغابايت');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditPhotoUrl(reader.result as string);
        toast.success('تم تحميل الصورة بنجاح');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveEditStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editFullName.trim()) {
      toast.error('المرجو إدخال الاسم الكامل للتلميذ');
      return;
    }

    setIsSavingStudent(true);
    try {
      const updates: Partial<Student> = {
        fullName: editFullName.trim(),
        massarNumber: editMassarNumber.trim().toUpperCase(),
        gender: editGender,
        birthDate: editBirthDate,
        category: editCategory,
        affiliationType: editAffiliationType,
        participationType: editParticipationType,
        athleticsSpecialty: editAthleticsSpecialty.trim(),
        photoUrl: editPhotoUrl,
        bibNumber: editBibNumber.trim() || undefined,
        crossCountryBibNumber: editBibNumber.trim() || undefined
      };

      await DataService.updateStudent(editingStudent.id, updates);
      setLocalStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, ...updates } : s));
      toast.success('تم تحديث بيانات التلميذ بنجاح');
      setEditingStudent(null);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ تعديلات التلميذ');
    } finally {
      setIsSavingStudent(false);
    }
  };

  const handleConfirmDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    try {
      await DataService.deleteStudent(studentToDelete.id);
      setLocalStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
      toast.success(`تم حذف التلميذ "${studentToDelete.fullName}" بنجاح`);
      setStudentToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حذف التلميذ');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  // Filter students belonging to this school
  const schoolStudents = useMemo(() => {
    if (!school) return [];
    return localStudents.filter(
      s => s.schoolId === school.id || s.schoolName === school.name
    );
  }, [localStudents, school?.id, school?.name]);

  // Group school students by Sport (One Card per Sport)
  const participatingGroups = useMemo(() => {
    if (!school) return [];
    const groups: {
      id: string;
      sportId: string;
      categories: string[];
      students: Student[];
      hasClubAffiliated: boolean;
      hasNonClub: boolean;
    }[] = [];

    schoolStudents.forEach(st => {
      if (!st.category || !st.sportId) return;
      if (selectedSportFilter !== 'ALL' && st.sportId !== selectedSportFilter) return;

      const sId = st.sportId;
      const cat = st.category;
      const isClub = st.affiliationType === 'club_affiliated';

      let g = groups.find(x => x.sportId === sId);
      if (!g) {
        g = {
          id: sId,
          sportId: sId,
          categories: [],
          students: [],
          hasClubAffiliated: false,
          hasNonClub: false,
        };
        groups.push(g);
      }
      if (!g.categories.includes(cat)) {
        g.categories.push(cat);
      }
      if (isClub) g.hasClubAffiliated = true;
      else g.hasNonClub = true;

      g.students.push(st);
    });

    // Sort categories in each group according to AGE_CATEGORIES order
    groups.forEach(g => {
      g.categories.sort((a, b) => {
        const idxA = AGE_CATEGORIES.findIndex(c => c.id === a);
        const idxB = AGE_CATEGORIES.findIndex(c => c.id === b);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
      });
    });

    // Sort groups by Sport Name
    return groups.sort((a, b) => {
      const sportA = SPORTS_MAP[a.sportId]?.name || a.sportId;
      const sportB = SPORTS_MAP[b.sportId]?.name || b.sportId;
      return sportA.localeCompare(sportB, 'ar');
    });
  }, [school, schoolStudents, selectedSportFilter]);

  useEffect(() => {
    if (isOpen) {
      setSelectedSportFilter(sportId || 'ALL');
      setSelectedGroupId(null);
      setLoadingTournaments(true);
      DataService.getTournaments()
        .then(tList => setTournaments(tList || []))
        .catch(err => console.error(err))
        .finally(() => setLoadingTournaments(false));
    }
  }, [isOpen, sportId]);

  if (!isOpen || !school) return null;

  // Strict Permission Check: Teachers cannot enter or view participants of other schools
  if (isTeacher && !isUserBelongToSchool) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4" dir="rtl">
        <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-200">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto text-3xl font-black">
            🔒
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-black text-slate-900">غير مصرح بالولوج إلى هذه المؤسسة</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              بصفتك أستاذاً، يمكنك فقط الاطلاع على المؤسسات المشاركة في المنصة، ولا يحق لك الولوج إلى لوائح وتفاصيل مؤسسة
              <strong className="text-slate-900 font-bold block mt-1">[{school.name}]</strong>
            </p>
            <p className="text-[11px] text-amber-900 bg-amber-50 p-3 rounded-xl border border-amber-200 mt-2 font-medium">
              الولوج إلى لوائح وتدبير التلاميذ متاح حصرياً لمؤسستك المعتمدة:
              <strong className="block font-bold mt-0.5 text-amber-950">{userProfile?.workLocation || 'مؤسستك المعتمدة'}</strong>
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={onClose}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-sm"
            >
              العودة لقائمة المؤسسات
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          'هاتف مدير المؤسسة': canSeePrincipalPhone ? (school.principalPhone || '---') : 'غير متاح'
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
                    {school.principalPhone && canSeePrincipalPhone && (
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

          {/* Header Title for Registered Tournaments */}
          <div className="bg-slate-100/90 border-b border-slate-200 px-3 sm:px-4 py-2.5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 font-black text-xs text-slate-800">
              <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
              <span>البطولات والرياضات المسجل فيها ({participatingGroups.length}) 🏆</span>
            </div>
            <span className="text-[10px] sm:text-xs font-bold text-slate-500">
              بطاقات البطولات المدرسية واللوائح التفصيلية
            </span>
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
                  onChange={(e) => {
                    setSelectedSportFilter(e.target.value);
                    setSelectedGroupId(null);
                  }}
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
          </div>

          {/* Scrollable Main Content */}
          <div className="p-3 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/50 overscroll-contain">
            {/* PROGRAMMED TOURNAMENTS & PARTICIPATIONS */}
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1 border-b border-slate-200">
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>البطولات التي تم تسجيل المشاركة فيها فعلياً</span>
                </h3>
              </div>

                {loadingTournaments ? (
                  <div className="flex justify-center p-8">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
                  </div>
                ) : participatingGroups.length === 0 ? (
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
                    {(!isTeacher || isUserBelongToSchool) && (
                      <button
                        onClick={() => handleNavigateToManage()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5 mt-2"
                      >
                        <span>+ إدراج وتأطير مشاركي المؤسسة الآن</span>
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* View 1: If no specific tournament card is selected, show Grid of Sport Cards */}
                    {!selectedGroupId ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between px-1">
                          <span className="text-xs font-black text-slate-700">بطاقات الرياضات والبطولات المسجلة ({participatingGroups.length}):</span>
                          <span className="text-[10px] text-slate-500 font-bold">انقر على أي بطاقة لعرض لائحة وتفاصيل المشاركين</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {participatingGroups.map((group) => {
                            const sObj = SPORTS_MAP[group.sportId] || { name: group.sportId, icon: '🏆', description: '' };

                            const groupMaleCount = group.students.filter(st => st.gender === 'Male').length;
                            const groupFemaleCount = group.students.filter(st => st.gender === 'Female').length;

                            return (
                              <div
                                key={group.id}
                                onClick={() => {
                                  setSelectedGroupId(group.id);
                                  setDetailCatFilter('ALL');
                                }}
                                className="group relative rounded-2xl border p-4 transition-all duration-200 cursor-pointer shadow-xs hover:shadow-md hover:-translate-y-0.5 flex flex-col justify-between bg-white border-slate-200/90 hover:border-blue-400 hover:bg-blue-50/20"
                              >
                                {/* Card Header */}
                                <div>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 rounded-2xl border border-blue-200 bg-blue-50 text-blue-700 flex items-center justify-center text-2xl shrink-0 shadow-3xs group-hover:scale-105 transition-transform">
                                        {sObj.icon}
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                          {group.hasClubAffiliated && (
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                              🟡 منتمين للأندية
                                            </span>
                                          )}
                                          {group.hasNonClub && (
                                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                                              ⚪ مدرسيين
                                            </span>
                                          )}
                                        </div>
                                        <h4 className="text-xs sm:text-sm font-black text-slate-900 mt-1 group-hover:text-blue-700 transition-colors">
                                          بطولة {sObj.name}
                                        </h4>
                                      </div>
                                    </div>
                                  </div>

                                  {/* List of Participating Age Categories inside Card */}
                                  <div className="mt-3 pt-2.5 border-t border-slate-100">
                                    <span className="text-[10px] font-bold text-slate-500 block mb-1.5">الفئات المشاركة بهذه البطولة:</span>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {group.categories.map(catId => {
                                        const catObj = AGE_CATEGORIES.find(c => c.id === catId);
                                        const catCount = group.students.filter(s => s.category === catId).length;
                                        return (
                                          <span
                                            key={catId}
                                            className="px-2.5 py-1 rounded-xl bg-blue-50 text-blue-900 text-[11px] font-black border border-blue-200/90 shadow-2xs flex items-center gap-1.5"
                                          >
                                            <span>{catObj?.shortName || catId}</span>
                                            <span className="bg-blue-600 text-white rounded-md px-1.5 py-0.2 text-[9px] font-extrabold">{catCount}</span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Stats Summary */}
                                  <div className="my-3 grid grid-cols-3 gap-2 text-center">
                                    <div className="bg-slate-50/80 rounded-xl p-2 border border-slate-100">
                                      <span className="text-[10px] text-slate-400 font-bold block mb-0.5">المشاركون</span>
                                      <span className="text-xs font-black text-slate-900">{group.students.length}</span>
                                    </div>
                                    <div className="bg-blue-50/60 rounded-xl p-2 border border-blue-100">
                                      <span className="text-[10px] text-blue-600 font-bold block mb-0.5">ذكور 👦</span>
                                      <span className="text-xs font-black text-blue-700">{groupMaleCount}</span>
                                    </div>
                                    <div className="bg-rose-50/60 rounded-xl p-2 border border-rose-100">
                                      <span className="text-[10px] text-rose-600 font-bold block mb-0.5">إناث 👧</span>
                                      <span className="text-xs font-black text-rose-700">{groupFemaleCount}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Card Footer Button */}
                                <div className="pt-1">
                                  <div className="w-full py-2 px-3 bg-slate-100 group-hover:bg-blue-600 text-slate-700 group-hover:text-white rounded-xl text-xs font-black transition-all flex items-center justify-between shadow-2xs">
                                    <span>عرض تفاصيل المشاركة واللائحة 🔍</span>
                                    <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      /* View 2: Detailed View of the Selected Sport Card */
                      (() => {
                        const selectedGroup = participatingGroups.find(g => g.id === selectedGroupId) || participatingGroups[0];

                        if (!selectedGroup) return null;

                        const sObj = SPORTS_MAP[selectedGroup.sportId] || { name: selectedGroup.sportId, icon: '🏆', description: '' };

                        const groupMaleCount = selectedGroup.students.filter(st => st.gender === 'Male').length;
                        const groupFemaleCount = selectedGroup.students.filter(st => st.gender === 'Female').length;

                        // Filter students inside detail view by category if selected
                        const filteredDetailStudents = detailCatFilter === 'ALL'
                          ? selectedGroup.students
                          : selectedGroup.students.filter(s => s.category === detailCatFilter);

                        return (
                          <div className="space-y-4 animate-in fade-in duration-200">
                            {/* Top Navigation Bar */}
                            <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-slate-200">
                              <button
                                onClick={() => setSelectedGroupId(null)}
                                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                              >
                                <ChevronLeft className="w-4 h-4 rotate-180" />
                                <span>← العودة لقائمة بطاقات الرياضات ({participatingGroups.length})</span>
                              </button>

                              {/* Quick horizontal switch pills */}
                              {participatingGroups.length > 1 && (
                                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-0.5">
                                  <span className="text-[10px] font-bold text-slate-400 shrink-0">الرياضات الأخرى:</span>
                                  {participatingGroups.map(g => {
                                    const sp = SPORTS_MAP[g.sportId];
                                    const isCurr = g.id === selectedGroup.id;
                                    return (
                                      <button
                                        key={g.id}
                                        onClick={() => {
                                          setSelectedGroupId(g.id);
                                          setDetailCatFilter('ALL');
                                        }}
                                        className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border transition-all shrink-0 cursor-pointer flex items-center gap-1 ${
                                          isCurr
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-3xs'
                                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                        }`}
                                      >
                                        <span>{sp?.icon || '🏆'}</span>
                                        <span>{sp?.name || g.sportId}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Sport Banner Details */}
                            <div className="p-4 rounded-2xl border bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border-blue-200">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl border border-blue-300 bg-blue-100 flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-xs">
                                    {sObj.icon}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="text-sm sm:text-base font-black text-slate-900">
                                        تفاصيل مشاركة بطولة {sObj.name}
                                      </h3>
                                      {selectedGroup.hasClubAffiliated && (
                                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                          🟡 منتمين للأندية
                                        </span>
                                      )}
                                      {selectedGroup.hasNonClub && (
                                        <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                                          ⚪ مدرسيين
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-600 font-medium">
                                      إجمالي المشاركين: <strong className="text-slate-900 font-black">{selectedGroup.students.length} مشارك(ة)</strong> ({groupMaleCount} ذكور ، {groupFemaleCount} إناث)
                                    </p>
                                  </div>
                                </div>

                                {/* Sport Actions */}
                                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                  <button
                                    onClick={() => handleOpenPdfForGroup(selectedGroup.sportId, selectedGroup.students, detailCatFilter)}
                                    className="px-3.5 py-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                                  >
                                    <FileText className="w-4 h-4" />
                                    <span>إضافة مؤطر واستخراج لائحة المشاركة (PDF)</span>
                                  </button>
                                </div>
                              </div>

                              {/* Category Filter Pills inside Detail View */}
                              {selectedGroup.categories.length > 1 && (
                                <div className="mt-3 pt-3 border-t border-blue-200/60 flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-black text-slate-700">تصفية حسب الفئة:</span>
                                  <button
                                    onClick={() => setDetailCatFilter('ALL')}
                                    className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                      detailCatFilter === 'ALL'
                                        ? 'bg-blue-600 text-white shadow-3xs'
                                        : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                    }`}
                                  >
                                    🌟 جميع الفئات ({selectedGroup.students.length})
                                  </button>
                                  {selectedGroup.categories.map(catId => {
                                    const catObj = AGE_CATEGORIES.find(c => c.id === catId);
                                    const catCount = selectedGroup.students.filter(s => s.category === catId).length;
                                    const isSelected = detailCatFilter === catId;
                                    return (
                                      <button
                                        key={catId}
                                        onClick={() => setDetailCatFilter(catId)}
                                        className={`px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer ${
                                          isSelected
                                            ? 'bg-blue-600 text-white shadow-3xs'
                                            : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                                        }`}
                                      >
                                        {getCategoryGenderLabel(catId, undefined, '2026/2027', selectedGroup.sportId)} ({catCount})
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Participant Roster Table */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                <span className="text-xs font-black text-slate-800">
                                  لائحة المشاركين بـ (بطولة {sObj.name}) - {filteredDetailStudents.length} تلميذ(ة)
                                </span>
                                <span className="text-[11px] font-bold text-slate-500">
                                  {school.name}
                                </span>
                              </div>

                              <div className="overflow-x-auto">
                                <table className="w-full text-center border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-100/70 text-slate-700 font-black border-b border-slate-200">
                                      <th className="p-3 w-10">#</th>
                                      <th className="p-3 text-right">الاسم والنسب الكامل</th>
                                      <th className="p-3">رقم مسار</th>
                                      <th className="p-3">الفئة العمرية</th>
                                      <th className="p-3">الصفة</th>
                                      <th className="p-3">الجنس</th>
                                      <th className="p-3">تاريخ الازدياد</th>
                                      <th className="p-3 text-left">التخصص / المركز</th>
                                      {(!isTeacher || isUserBelongToSchool) && (
                                        <th className="p-3 text-center">الإجراءات</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {filteredDetailStudents.map((stud, idx) => {
                                      const catObj = AGE_CATEGORIES.find(c => c.id === stud.category);
                                      const isClub = stud.affiliationType === 'club_affiliated';
                                      return (
                                        <tr key={stud.id} className="hover:bg-slate-50/80 transition-colors">
                                          <td className="p-3 text-slate-400 font-bold">{idx + 1}</td>
                                          <td className="p-3 text-right">
                                            <div className="flex items-center gap-2.5">
                                              <div className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                                                {stud.photoUrl ? (
                                                  <img src={stud.photoUrl} alt={stud.fullName} className="w-full h-full object-cover" />
                                                ) : (
                                                  <span className="text-xs">{stud.gender === 'Female' ? '👧' : '👦'}</span>
                                                )}
                                              </div>
                                              <span className="font-black text-slate-900">{stud.fullName}</span>
                                            </div>
                                          </td>
                                          <td className="p-3 font-mono font-bold text-blue-700 bg-blue-50/50 rounded-lg">
                                            {stud.massarNumber || '—'}
                                          </td>
                                          <td className="p-3">
                                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-900 font-black text-[10px] border border-blue-200">
                                              {getCategoryGenderLabel(stud.category, stud.gender, '2026/2027', selectedGroup.sportId)}
                                            </span>
                                          </td>
                                          <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                              isClub ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-700'
                                            }`}>
                                              {isClub ? 'منتمي' : 'مدرسي'}
                                            </span>
                                          </td>
                                          <td className="p-3">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                              stud.gender === 'Male' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                                            }`}>
                                              {stud.gender === 'Male' ? 'ذكر 👦' : 'أنثى 👧'}
                                            </span>
                                          </td>
                                          <td className="p-3 font-mono text-slate-600 font-bold">{stud.birthDate || '—'}</td>
                                          <td className="p-3 text-left font-bold text-slate-600">
                                            {stud.athleticsSpecialty || (stud.participationType === 'school_team' ? 'فريق المؤسسة' : 'فردي')}
                                          </td>
                                          {(!isTeacher || isUserBelongToSchool) && (
                                            <td className="p-3 text-center">
                                              <div className="flex items-center justify-center gap-1.5">
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleStartEditStudent(stud);
                                                  }}
                                                  className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer"
                                                  title="تعديل بيانات المشارك"
                                                >
                                                  <Edit2 className="w-3.5 h-3.5" />
                                                  <span>تعديل</span>
                                                </button>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setStudentToDelete(stud);
                                                  }}
                                                  className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-[11px] font-black transition-all flex items-center gap-1 cursor-pointer"
                                                  title="حذف المشارك"
                                                >
                                                  <Trash2 className="w-3.5 h-3.5" />
                                                  <span>حذف</span>
                                                </button>
                                              </div>
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>

            {/* TAB 2 REMOVED */}
            {false && (
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
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Student Modal Overlay */}
      {editingStudent && (
        <div className="fixed inset-0 z-60 overflow-y-auto p-4 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-black">
                  ✏️
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تعديل بيانات المشارك(ة)</h3>
                  <p className="text-xs text-slate-500 font-bold">
                    {editingStudent.fullName} • {editingStudent.schoolName || school.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStudent} className="space-y-4 text-xs font-bold text-slate-700">
              {/* Photo Upload & Preview Section */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center gap-4">
                <div className="relative w-20 h-20 rounded-2xl bg-white border-2 border-slate-200 shadow-xs overflow-hidden shrink-0 flex items-center justify-center">
                  {editPhotoUrl ? (
                    <img src={editPhotoUrl} alt={editFullName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <span className="text-2xl">{editGender === 'Female' ? '👧' : '👦'}</span>
                      <p className="text-[9px] text-slate-400 font-bold mt-0.5">بدون صورة</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 text-center sm:text-right space-y-1.5">
                  <p className="text-xs font-black text-slate-900">الصورة الشخصية للتلميذ(ة)</p>
                  <p className="text-[11px] text-slate-500 font-normal">
                    يمكنك اختيار صورة من الملفات أو التقاطها مباشرة عبر كاميرا الهاتف/الجهاز.
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{editPhotoUrl ? 'تغيير الصورة' : 'رفع صورة'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    <label className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-3xs">
                      <span>📸 بالكاميرا</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    {editPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setEditPhotoUrl('')}
                        className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>إزالة</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Full Name */}
              <div>
                <label className="block mb-1 text-slate-700 font-black">الاسم والنسب الكامل (*):</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-900 text-xs"
                  placeholder="الاسم والنسب الكامل"
                />
              </div>

              {/* Massar Number & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-700 font-black">رقم مسار (*):</label>
                  <input
                    type="text"
                    value={editMassarNumber}
                    onChange={(e) => setEditMassarNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-extrabold text-blue-900 text-xs"
                    placeholder="مثال: G13000000"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-700 font-black">الجنس (*):</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as 'Male' | 'Female')}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-extrabold text-xs"
                  >
                    <option value="Male">ذكور 👦</option>
                    <option value="Female">إناث 👧</option>
                  </select>
                </div>
              </div>

              {/* Birth Date & Age Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-700 font-black">تاريخ الازدياد (*):</label>
                  <input
                    type="date"
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-xs"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-700 font-black">الفئة العمرية (*):</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                  >
                    {AGE_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {getCategoryGenderLabel(cat.id, editGender, '2026/2027', editingStudent?.sportId)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Affiliation & Participation */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-700 font-black">الصفة الرياضية (*):</label>
                  <select
                    value={editAffiliationType}
                    onChange={(e) => setEditAffiliationType(e.target.value as 'non_club' | 'club_affiliated')}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                  >
                    <option value="non_club">⚪ لا منتمي (مدرسي فقط)</option>
                    <option value="club_affiliated">🟡 منتمي لنادي / عصبة</option>
                  </select>
                </div>

                <div>
                  <label className="block mb-1 text-slate-700 font-black">نوع المشاركة (*):</label>
                  <select
                    value={editParticipationType}
                    onChange={(e) => setEditParticipationType(e.target.value as 'individual' | 'school_team')}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-xs"
                  >
                    <option value="school_team">🏆 فريق المؤسسة</option>
                    <option value="individual">👤 مشاركة فردية</option>
                  </select>
                </div>
              </div>

              {/* Bib Number & Athletics Specialty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 text-slate-700 font-black">رقم الصدر / الصدرية (Bib):</label>
                  <input
                    type="text"
                    value={editBibNumber}
                    onChange={(e) => setEditBibNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono font-bold text-xs text-amber-900 bg-amber-50/50"
                    placeholder="مثال: 105"
                  />
                </div>

                <div>
                  <label className="block mb-1 text-slate-700 font-black">التخصص / المركز:</label>
                  <input
                    type="text"
                    value={editAthleticsSpecialty}
                    onChange={(e) => setEditAthleticsSpecialty(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-xs"
                    placeholder="مثال: حارس مرمى / 100م / 2000م"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingStudent}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingStudent ? 'جاري الحفظ...' : 'حفظ جميع التعديلات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal Overlay */}
      {studentToDelete && (
        <div className="fixed inset-0 z-60 overflow-y-auto p-4 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto text-xl font-black">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900">تأكيد حذف المشارك</h3>
              <p className="text-xs text-slate-600">
                هل أنت مأكد من حذف التلميذ(ة) <strong className="text-slate-900 font-bold">[{studentToDelete.fullName}]</strong> من لائحة المشاركين بالمؤسسة؟
              </p>
            </div>
            <div className="pt-2 flex items-center gap-2 justify-center">
              <button
                onClick={() => setStudentToDelete(null)}
                className="flex-1 py-2 px-4 border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmDeleteStudent}
                disabled={isDeletingStudent}
                className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDeletingStudent ? 'جاري الحذف...' : 'تأكيد الحذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
