import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Tournament, Student, School, User, Sport } from '../types';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason, validateBirthDateForCategory } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
import { useRolePermissions } from '../hooks/useRolePermissions';
import {
  CROSS_COUNTRY_CATEGORIES,
  CrossCountryCategoryDef
} from '../lib/crossCountryConfig';
import { AppLogo } from './AppLogo';
import { CountdownTimer } from './CountdownTimer';
import { RegisterStudentModal } from './RegisterStudentModal';
import { CrossCountryBulkRegisterModal } from './CrossCountryBulkRegisterModal';
import { EditDeadlineModal } from './EditDeadlineModal';
import { ParticipationFormPdfModal } from './ParticipationFormPdfModal';
import * as XLSX from 'xlsx';
import {
  X,
  Search,
  Filter,
  Download,
  FileText,
  CheckCircle2,
  Layers,
  Clock,
  Settings,
  GraduationCap,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  Trash2,
  Save,
  Info,
  Grid,
  Table,
  CreditCard,
  Edit,
  Upload,
  Image as ImageIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadIndividualCardPdf } from '../lib/participationPdfService';
import { compressImageToBase64 } from '../lib/imageUtils';

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
  onProgramTournament?: (sportId: string) => void;
  isTeacherRole?: boolean;
  teacherSchoolName?: string;
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
  onRefreshData,
  onProgramTournament,
  isTeacherRole: propIsTeacherRole,
  teacherSchoolName: propTeacherSchoolName
}) => {
  const { userProfile } = useAuth();
  const { canDo } = useRolePermissions();
  const isTeacherRole = propIsTeacherRole !== undefined ? propIsTeacherRole : userProfile?.role === 'TEACHER';
  const teacherSchoolName = propTeacherSchoolName !== undefined ? propTeacherSchoolName : (userProfile?.workLocation || '');

  const [selectedCatId, setSelectedCatId] = useState<string>('u15_male');
  const activeCategory = useMemo(() => {
    return CROSS_COUNTRY_CATEGORIES.find(c => c.id === selectedCatId) || CROSS_COUNTRY_CATEGORIES[0];
  }, [selectedCatId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'school_team' | 'individual'>('ALL');
  const [filterSchool, setFilterSchool] = useState<string>('ALL');
  const [participantsViewMode, setParticipantsViewMode] = useState<'table' | 'cards'>('table');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBulkRegisterModalOpen, setIsBulkRegisterModalOpen] = useState(false);
  const [isEditDeadlineOpen, setIsEditDeadlineOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

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

  // Compute deadline and affiliation for cross country
  const ccTournaments = useMemo(() => {
    return tournaments.filter(t => t.sportId === 'cross_country');
  }, [tournaments]);

  const hasClubTournament = useMemo(() => {
    return ccTournaments.some(t => t.affiliationType === 'club_affiliated' || t.affiliationType === 'open');
  }, [ccTournaments]);

  const hasNonClubTournament = useMemo(() => {
    return ccTournaments.some(t => !t.affiliationType || t.affiliationType === 'non_club' || t.affiliationType === 'open');
  }, [ccTournaments]);

  const [selectedAffiliationFilter, setSelectedAffiliationFilter] = useState<'ALL' | 'non_club' | 'club_affiliated'>('ALL');

  const { currentDeadline, currentAffiliationType } = useMemo(() => {
    const ccT = ccTournaments.find(t => selectedAffiliationFilter === 'club_affiliated' ? t.affiliationType === 'club_affiliated' : true) || ccTournaments[0];
    return {
      currentDeadline: ccT?.registrationDeadline || null,
      currentAffiliationType: (ccT?.affiliationType as any) || (hasClubTournament && !hasNonClubTournament ? 'club_affiliated' : 'open')
    };
  }, [ccTournaments, selectedAffiliationFilter, hasClubTournament, hasNonClubTournament]);

  const ccSportObject: Sport = useMemo(() => ({
    id: 'cross_country',
    name: 'العدو الريفي',
    icon: '🏃‍♂️',
    category: 'Individual',
    description: 'بطولة العدو الريفي المدرسي بمديرية تاوريرت'
  }), []);

  // Refresh data on open
  useEffect(() => {
    if (!isOpen) return;
    if (onRefreshData) {
      onRefreshData();
    }
  }, [isOpen]);

  // Local students state to allow immediate optimistic updates
  const [localStudents, setLocalStudents] = useState<Student[]>(allStudents);

  useEffect(() => {
    setLocalStudents(allStudents);
  }, [allStudents]);

  // Student Delete & Edit State
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  const [studentToEditConfirm, setStudentToEditConfirm] = useState<Student | null>(null);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editMassarNumber, setEditMassarNumber] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female'>('Male');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editCategory, setEditCategory] = useState('U15');
  const [editParticipationType, setEditParticipationType] = useState<'school_team' | 'individual'>('school_team');
  const [editPhoto, setEditPhoto] = useState('');
  const [editAffiliationType, setEditAffiliationType] = useState<'non_club' | 'club_affiliated'>('non_club');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [editCoachName, setEditCoachName] = useState('');
  const [editCoachLease, setEditCoachLease] = useState('');
  const [editCoachPhone, setEditCoachPhone] = useState('');
  const [isSavingEditStudent, setIsSavingEditStudent] = useState(false);

  // Permission checker for modifying or deleting a cross country runner
  const canManageThisStudent = (stud: Student) => {
    if (canManage) return true;
    if (!isTeacherRole) return false;
    if (!userProfile) return false;

    const cleanStudentSchool = String(stud.schoolName || '').trim().toLowerCase();
    const cleanTeacherSchool = String(userProfile.workLocation || teacherSchoolName || '').trim().toLowerCase();
    const isSameSchoolName = cleanStudentSchool && cleanTeacherSchool && (
      cleanStudentSchool === cleanTeacherSchool ||
      cleanStudentSchool.includes(cleanTeacherSchool) ||
      cleanTeacherSchool.includes(cleanStudentSchool)
    );

    const matched = schools.find(s => s.name === (userProfile.workLocation || teacherSchoolName) || s.name.includes(userProfile.workLocation || teacherSchoolName || ''));
    const teacherSchoolId = matched ? matched.id : undefined;
    const isSameSchoolId = (stud.schoolId && teacherSchoolId && stud.schoolId === teacherSchoolId) || (userProfile?.schoolId && stud.schoolId === userProfile.schoolId);

    return isSameSchoolName || isSameSchoolId;
  };

  const customTitle = useMemo(() => {
    if (tournaments && tournaments.length > 0) {
      const ccTourn = tournaments.find(t => t.sportId === 'cross_country');
      if (ccTourn && ccTourn.name) {
        const raw = ccTourn.name;
        const clean = raw.split(/\s*-\s*(?:البرعمات|البراعم|الصغيرات|الصغار|الفتيات|الفتيان|الشابات|الشبان|ذكور|إناث|مختلط|U12|U15|U18|U20|جميع الفئات|فئة|صغار|فتيان|شبان|براعم|صغيرات|فتيات|شابات|برعمات|لا منتمين|للمنتمين للأندية|مفتوحة|مواليد|السلك|دوري)/i)[0].trim();
        if (clean && clean.length >= 3) return clean;
        return raw.split(/\s*-\s*/)[0].trim() || raw;
      }
    }
    return 'البطولة الإقليمية المدرسية للعدو الريفي';
  }, [tournaments]);

  // Sync editing student form values when a student is selected
  useEffect(() => {
    if (editingStudent) {
      setEditFullName(editingStudent.fullName || '');
      setEditMassarNumber(editingStudent.massarNumber || '');
      setEditGender(editingStudent.gender || activeCategory.gender || 'Male');
      setEditBirthDate(editingStudent.birthDate || '');
      setEditCategory(editingStudent.category || activeCategory.category || 'U15');
      setEditParticipationType(editingStudent.participationType || 'school_team');
      setEditPhoto(editingStudent.photoUrl || '');
      setEditAffiliationType(editingStudent.affiliationType || 'non_club');
      setEditCoachName(editingStudent.coachName || (isTeacherRole && userProfile?.fullName ? userProfile.fullName : ''));
      setEditCoachLease(editingStudent.coachLeaseNumber || (isTeacherRole && userProfile?.leaseNumber ? userProfile.leaseNumber : ''));
      setEditCoachPhone(editingStudent.coachPhone || (isTeacherRole && userProfile?.phone ? userProfile.phone : ''));
    }
  }, [editingStudent, isTeacherRole, userProfile, activeCategory]);

  const handleEditPhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsCompressingPhoto(true);
      const compressed = await compressImageToBase64(file, { maxWidth: 240, maxHeight: 240, quality: 0.7 });
      setEditPhoto(compressed);
      toast.success('تم تحميل وتحديث الصورة بنجاح');
    } catch (err) {
      console.error('Error compressing image:', err);
      toast.error('حدث خطأ أثناء معالجة الصورة');
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const executeDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    const toastId = toast.loading(`جاري حذف المشارك(ة) ${studentToDelete.fullName}...`);
    try {
      await DataService.deleteStudent(studentToDelete.id);
      setLocalStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
      toast.dismiss(toastId);
      toast.success(`تم حذف المشارك "${studentToDelete.fullName}" بنجاح`);
      setStudentToDelete(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Error deleting student:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء حذف المشارك');
    } finally {
      setIsDeletingStudent(false);
    }
  };

  const handleSaveEditedStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    if (!editFullName.trim()) {
      toast.error('يرجى إدخال اسم ونسب المشارك(ة)');
      return;
    }
    const massarRegex = /^[A-Z]\d{9}$/;
    const cleanMassar = editMassarNumber.trim().toUpperCase();
    if (!cleanMassar) {
      toast.error('يرجى إدخال رقم مسار للمشارك(ة)');
      return;
    }
    if (!massarRegex.test(cleanMassar)) {
      toast.error('رقم مسار إجباري ويجب أن يتكون من حرف لاتيني كبير متبوعاً بـ 9 أرقام (مثال: F212121212)');
      return;
    }
    if (!editBirthDate) {
      toast.error('يرجى تحديد تاريخ الازدياد');
      return;
    }
    const birthVal = validateBirthDateForCategory(editBirthDate, editCategory, activeSeason, editGender, true);
    if (!birthVal.isValid) {
      toast.error(`تاريخ الازدياد غير متوافق مع الفئة المحددة والجنس: ${birthVal.errorMessage}`);
      return;
    }
    setIsSavingEditStudent(true);
    const toastId = toast.loading('جاري حفظ التعديلات...');
    try {
      const updates: Partial<Student> = {
        fullName: editFullName.trim(),
        massarNumber: cleanMassar,
        gender: editGender,
        birthDate: editBirthDate,
        category: editCategory,
        participationType: editParticipationType,
        photoUrl: editPhoto || undefined,
        affiliationType: editAffiliationType,
        coachName: (editCoachName.trim() || userProfile?.fullName || '').trim() || undefined,
        coachLeaseNumber: (editCoachLease.trim() || userProfile?.leaseNumber || '').trim() || undefined,
        coachPhone: (editCoachPhone.trim() || userProfile?.phone || '').trim() || undefined,
      };
      await DataService.updateStudent(editingStudent.id, updates);
      setLocalStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, ...updates } : s));
      toast.dismiss(toastId);
      toast.success(`تم تحديث بيانات المشارك(ة) "${editFullName}" بنجاح`);
      setEditingStudent(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Error updating student:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء تعديل بيانات المشارك');
    } finally {
      setIsSavingEditStudent(false);
    }
  };

  // Filter students participating in cross country (teachers only see their own school's participants)
  const ccStudents = useMemo(() => {
    let list = localStudents.filter(s => s && s.sportId === 'cross_country');
    if (isTeacherRole) {
      if (!teacherSchoolName && !userProfile?.schoolId) return [];
      const cleanSchool = (teacherSchoolName || '').trim().toLowerCase();
      list = list.filter(s => {
        const sName = (s.schoolName || '').trim().toLowerCase();
        return (
          sName === cleanSchool ||
          sName.includes(cleanSchool) ||
          cleanSchool.includes(sName) ||
          (userProfile?.schoolId && s.schoolId === userProfile.schoolId)
        );
      });
    }
    return list;
  }, [localStudents, isTeacherRole, teacherSchoolName, userProfile?.schoolId]);

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

  // Filtered participants by search, type, school, and affiliation
  const filteredParticipants = useMemo(() => {
    return activeCategoryParticipants.filter(p => {
      const runnerName = p.fullName || '';
      const runnerSchool = p.schoolName || '';
      const runnerMassar = p.massarNumber || '';
      const matchSearch = runnerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          runnerSchool.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          runnerMassar.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === 'ALL' || p.participationType === filterType;
      const matchSchool = isTeacherRole || filterSchool === 'ALL' || p.schoolId === filterSchool || p.schoolName === filterSchool;
      const matchAffiliation = selectedAffiliationFilter === 'ALL'
        ? true
        : selectedAffiliationFilter === 'club_affiliated'
          ? p.affiliationType === 'club_affiliated'
          : (!p.affiliationType || p.affiliationType === 'non_club');
      return matchSearch && matchType && matchSchool && matchAffiliation;
    });
  }, [activeCategoryParticipants, searchQuery, filterType, filterSchool, isTeacherRole, selectedAffiliationFilter]);

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
                      {customTitle}
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

                {isHeaderCollapsed && !isTeacherRole && (
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
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setIsEditDeadlineOpen(true)}
                          className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>تعديل آخر أجل للتسجيل ✏️</span>
                        </button>

                        {onProgramTournament && (
                          <button
                            onClick={() => onProgramTournament('cross_country')}
                            className="px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-400/40 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                            title="تعديل فئات وإعدادات البطولة"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            <span>إعدادات البطولة ⚙️</span>
                          </button>
                        )}
                      </div>
                    )}
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
                انقر على الفئة لاستعراض تفاصيلها ولوائح التلاميذ المسجلين بها
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
              {CROSS_COUNTRY_CATEGORIES.map((cat) => {
                const isSelected = selectedCatId === cat.id;
                const catCategory = cat.category.toLowerCase().trim();
                const catGender = cat.gender.toLowerCase().trim();
                const countInCat = ccStudents.filter(s => {
                  const sCategory = (s.category || '').toLowerCase().trim();
                  const sGender = (s.gender || '').toLowerCase().trim();
                  const matchCat = sCategory === catCategory ||
                    (catCategory === 'u12' && (sCategory.includes('براعم') || sCategory.includes('12') || sCategory.includes('برعم'))) ||
                    (catCategory === 'u15' && (sCategory.includes('صغار') || sCategory.includes('15') || sCategory.includes('صغير'))) ||
                    (catCategory === 'u18' && (sCategory.includes('فتيان') || sCategory.includes('18') || sCategory.includes('فتيات') || sCategory.includes('فتي'))) ||
                    (catCategory === 'u20' && (sCategory.includes('شبان') || sCategory.includes('20') || sCategory.includes('شابات') || sCategory.includes('شب')));

                  const matchGen = sGender === catGender ||
                    (catGender === 'male' && (sGender.includes('ذكر') || sGender.includes('ذكور') || sGender === 'm' || sGender === 'male' || sGender.includes('ولد'))) ||
                    (catGender === 'female' && (sGender.includes('أنثى') || sGender.includes('انثى') || sGender.includes('إناث') || sGender.includes('اناث') || sGender === 'f' || sGender === 'female' || sGender.includes('بنت')));

                  return matchCat && matchGen;
                }).length;

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
                      <span
                        className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
                          isSelected ? 'bg-white/25 text-white' : 'bg-white text-slate-800 border border-slate-200/60'
                        }`}
                      >
                        {countInCat}
                      </span>
                    </div>
                    <div className="mt-1">
                      <div className={`text-[11px] font-black leading-tight truncate ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                        {cat.shortLabel}
                      </div>
                      <div className={`text-[9px] font-semibold mt-0.5 ${isSelected ? 'text-blue-100' : 'text-slate-500'}`}>
                        المسافة: {cat.distance}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Registration action buttons directly below the 8 categories */}
            <div className="mt-3 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 px-1 bg-white/70 rounded-xl p-2">
              <div className="text-xs text-slate-700 font-bold flex items-center gap-1.5 flex-wrap">
                <span>التسجيل في منافسات العدو الريفي:</span>
                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md font-black text-xs">الفئة المحددة: {activeCategory.titleAr}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsBulkRegisterModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-2 hover:scale-102 active:scale-98"
                  title="تسجيل 8 مشاركين دفعة واحدة (3 فردي + 5 فريق المؤسسة) مع إمكانية التصدير إلى Excel"
                >
                  <Sparkles className="w-4 h-4 text-slate-950" />
                  <span>تسجيل 8 مشاركين (3 فردي + 5 فريق) ⚡</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-2 hover:scale-102 active:scale-98"
                  title="تسجيل تلميذ مشارك بشكل منفرد"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>تسجيل واحد تلو الآخر</span>
                </button>
              </div>
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
                  <button
                    onClick={() => handleExportCategoryExcel(activeCategory)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                    title="تصدير لائحة المشاركين المسجلين في هذه الفئة بصيغة Excel"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>تصدير المشاركين (Excel)</span>
                  </button>

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
            </div>

            {/* Info Notice: Segregation of Scanner and Results */}
            <div className="bg-gradient-to-r from-blue-50 via-slate-50 to-blue-50 border border-blue-200/80 rounded-2xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🏃</span>
                <div>
                  <div className="font-extrabold text-blue-950 flex items-center gap-2">
                    <span>لائحة العدائين المسجلين في فئة {activeCategory.titleAr} ({filteredParticipants.length} مشارك)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    هذه النافذة مخصصة لإدارة وتسجيل العدائين والتحقق من الصدريات ولوائح المؤسسات المشاركة.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 self-stretch sm:self-auto justify-end">
                <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 shadow-2xs">
                  🏆 النتائج والتتويج: في زر <strong className="text-blue-700">المباريات والنتائج</strong>
                </span>
                <span className="px-2.5 py-1 bg-white rounded-lg border border-slate-200 text-slate-700 shadow-2xs">
                  📱 ماسح الصدريات: في زر <strong className="text-blue-700">تطبيقات مساعدة</strong>
                </span>
              </div>
            </div>

            {/* REGISTERED ATHLETES TABLE */}
              <div className="space-y-3">
                {/* Teacher Notification Banner */}
                {isTeacherRole && (
                  <div className="bg-amber-50 border border-amber-200/90 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-amber-950 shadow-3xs">
                    <div className="flex items-center gap-2">
                      <span className="text-base">👤</span>
                      <div>
                        <span className="font-extrabold text-amber-900">لائحة مشاركي مؤسستك فقط: </span>
                        <span className="text-amber-800">
                          بصفتك أستاذاً، تُعرض هنا حصرياً مشاركات تلاميذ مؤسستك
                          {teacherSchoolName ? ` [${teacherSchoolName}] ` : ' '}
                          المسجلين في فئة {activeCategory.shortLabel}.
                        </span>
                      </div>
                    </div>
                  </div>
                )}

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
                      value={selectedAffiliationFilter}
                      onChange={(e) => setSelectedAffiliationFilter(e.target.value as any)}
                      className="text-xs font-bold text-amber-900 bg-amber-50/70 border border-amber-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer w-full sm:w-auto"
                    >
                      <option value="ALL">🌟 جميع الأصناف (منتمين وغير منتمين)</option>
                      <option value="non_club">⚪ غير المنتمين للأندية (مدرسي)</option>
                      <option value="club_affiliated">⚽ المنتمين للأندية (Club)</option>
                    </select>

                    {isTeacherRole ? (
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 shadow-3xs select-none max-w-[200px]" title="مؤسستك المعتمدة">
                        <GraduationCap className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span className="truncate">{teacherSchoolName || 'مؤسستك المعتمدة'}</span>
                      </div>
                    ) : (
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
                    )}
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
                              <th className="py-2.5 px-3 text-center">الانتماء</th>
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
                                  {runner.affiliationType === 'club_affiliated' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shadow-3xs">
                                      <span>⚽</span>
                                      <span>منتمي لنادي</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                      <span>⚪</span>
                                      <span>لا منتمي (مدرسي)</span>
                                    </span>
                                  )}
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
                                <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-1.5">
                                    {canManageThisStudent(runner) && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => setStudentToEditConfirm(runner)}
                                          className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                          title="تعديل بيانات العداء(ة)"
                                        >
                                          <Edit className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setStudentToDelete(runner)}
                                          className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                          title="حذف العداء(ة)"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </>
                                    )}
                                    {runner.participationType === 'individual' && (
                                      <button
                                        type="button"
                                        onClick={() => downloadIndividualCardPdf(runner, { id: 'cross_country', name: 'العدو الريفي' }, activeSeason)}
                                        className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                        title="تحميل بطاقة المشارك الفردية"
                                      >
                                        <CreditCard className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
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
                                  <div className="flex items-center justify-between text-[10px]">
                                    <span className="text-slate-400 font-medium">الانتماء:</span>
                                    {runner.affiliationType === 'club_affiliated' ? (
                                      <span className="font-black text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                                        ⚽ منتمي لنادي
                                      </span>
                                    ) : (
                                      <span className="font-bold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                                        ⚪ لا منتمي (مدرسي)
                                      </span>
                                    )}
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
                              
                              <div className="flex items-center gap-1.5">
                                {canManageThisStudent(runner) && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setStudentToEditConfirm(runner)}
                                      className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                      title="تعديل بيانات العداء(ة)"
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setStudentToDelete(runner)}
                                      className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                      title="حذف العداء(ة)"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                                <button
                                  type="button"
                                  onClick={() => downloadIndividualCardPdf(runner, { id: 'cross_country', name: 'العدو الريفي' }, activeSeason)}
                                  className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-extrabold transition-colors cursor-pointer"
                                  title="تحميل بطاقة المشارك"
                                >
                                  <Download className="h-3 w-3" />
                                  <span>بطاقة</span>
                                </button>
                              </div>
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

      {/* Register Student Modal */}
      <RegisterStudentModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        sport={ccSportObject}
        preselectedCategory={activeCategory.category}
        preselectedGender={activeCategory.gender}
        preselectedAffiliation={selectedAffiliationFilter === 'club_affiliated' ? 'club_affiliated' : (selectedAffiliationFilter === 'non_club' ? 'non_club' : (hasClubTournament && !hasNonClubTournament ? 'club_affiliated' : (hasNonClubTournament && !hasClubTournament ? 'non_club' : 'open')))}
        schools={schools}
        registrationDeadline={currentDeadline}
        tournaments={tournaments}
        onRegistered={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Bulk Register Modal (8 Participants: 3 individual + 5 school team) */}
      <CrossCountryBulkRegisterModal
        isOpen={isBulkRegisterModalOpen}
        onClose={() => setIsBulkRegisterModalOpen(false)}
        schools={schools}
        initialCategoryDefId={activeCategory.id}
        allExistingStudents={allStudents}
        currentSeason={activeSeason}
        affiliationType={selectedAffiliationFilter === 'club_affiliated' ? 'club_affiliated' : (selectedAffiliationFilter === 'non_club' ? 'non_club' : (hasClubTournament && !hasNonClubTournament ? 'club_affiliated' : 'non_club'))}
        tournaments={tournaments}
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

      {/* Confirmation Modal for Edit */}
      {studentToEditConfirm && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">
                ✏️
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">تأكيد تعديل بيانات العداء(ة)</h3>
                <p className="text-[11px] text-slate-500">مسابقة العدو الريفي المدرسي</p>
              </div>
            </div>
            
             <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs relative">
              {/* Photo Thumbnail if exists */}
              <div className="absolute top-3.5 left-3.5 w-12 h-12 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center shadow-3xs">
                {studentToEditConfirm.photoUrl ? (
                  <img src={studentToEditConfirm.photoUrl} alt="صورة المشارك" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl text-slate-400">👤</span>
                )}
              </div>

              <div className="space-y-1.5 pl-14">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">اسم العداء(ة):</span>
                  <span className="font-extrabold text-slate-900 truncate max-w-[180px]">{studentToEditConfirm.fullName}</span>
                </div>
                {studentToEditConfirm.massarNumber && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold shrink-0">رقم مسار:</span>
                    <span className="font-mono font-bold text-slate-700">{studentToEditConfirm.massarNumber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">المؤسسة التعليمية:</span>
                  <span className="font-bold text-slate-800 truncate max-w-[180px]">{studentToEditConfirm.schoolName}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">تاريخ الازدياد:</span>
                  <span className="font-mono font-bold text-slate-700">{studentToEditConfirm.birthDate || 'غير محدد'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">الفئة والجنس:</span>
                  <span className="font-bold text-blue-700">
                    {studentToEditConfirm.category} ({studentToEditConfirm.gender === 'Male' ? 'ذكور' : 'إناث'})
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">نوع المشاركة:</span>
                  <span className="font-bold text-blue-800">
                    {studentToEditConfirm.participationType === 'school_team' ? '👥 فريق المؤسسة' : '👤 مشاركة فردية'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">صنف العداء:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    studentToEditConfirm.affiliationType === 'club_affiliated'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {studentToEditConfirm.affiliationType === 'club_affiliated' ? '🏆 مدرسي منخرط (نادي)' : '🏃 مدرسي (غير منخرط)'}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              هل ترغب في تعديل بيانات هذا العداء(ة)؟ بالضغط على تأكيد، ستفتح نافذة تعديل بياناته لتحديثها وحفظها.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStudentToEditConfirm(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingStudent(studentToEditConfirm);
                  setStudentToEditConfirm(null);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-3xs transition-all flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>نعم، تعديل البيانات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deletion */}
      {studentToDelete && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">تأكيد حذف العداء(ة) نهائياً</h3>
                <p className="text-[11px] text-slate-500">مسابقة العدو الريفي المدرسي</p>
              </div>
            </div>
            
            <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">اسم العداء(ة):</span>
                <span className="font-extrabold text-red-950">{studentToDelete.fullName}</span>
              </div>
              {studentToDelete.massarNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">رقم مسار:</span>
                  <span className="font-mono font-bold text-slate-700">{studentToDelete.massarNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">المؤسسة التعليمية:</span>
                <span className="font-bold text-slate-800">{studentToDelete.schoolName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">نوع المشاركة:</span>
                <span className="font-bold text-slate-800">
                  {studentToDelete.participationType === 'school_team' ? '👥 فريق المؤسسة' : '👤 مشاركة فردية'}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف هذا العداء(ة) من لائحة المشاركين بشكل نهائي؟ سيتم تحرير المقعد ولن يمكن التراجع عن هذا الإجراء لاحقاً.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => setStudentToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={executeDeleteStudent}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-3xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingStudent ? 'جاري الحذف...' : 'نعم، حذف العداء نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200" dir="rtl">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تعديل بيانات العداء(ة)</h3>
                  <p className="text-[11px] text-white/80">{editingStudent.schoolName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingStudent(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedStudent} className="p-6 overflow-y-auto space-y-4 text-xs">
              {/* Photo Upload & Preview Section */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-slate-200 border-2 border-white shadow-xs shrink-0 flex items-center justify-center">
                    {editPhoto ? (
                      <img
                        src={editPhoto}
                        alt={editFullName || 'صورة المشارك'}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-slate-400 flex flex-col items-center justify-center">
                        <ImageIcon className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">صورة العداء(ة)</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {editPhoto ? 'تم تعيين صورة مخصصة' : 'لم يتم تحديد صورة بعد'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] rounded-xl cursor-pointer transition-colors flex items-center gap-1.5 shadow-3xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isCompressingPhoto ? 'جاري المعالجة...' : 'تغيير الصورة'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditPhotoFileChange}
                      disabled={isCompressingPhoto}
                    />
                  </label>
                  {editPhoto && (
                    <button
                      type="button"
                      onClick={() => setEditPhoto('')}
                      className="px-2.5 py-1.5 bg-slate-200 hover:bg-red-50 hover:text-red-600 text-slate-600 font-bold text-[11px] rounded-xl transition-colors cursor-pointer"
                      title="حذف الصورة"
                    >
                      حذف
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الاسم الكامل للعداء(ة) *</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                  placeholder="مثال: يوسف العلوي"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">رقم مسار *</label>
                  <input
                    type="text"
                    required
                    value={editMassarNumber}
                    onChange={(e) => setEditMassarNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all uppercase"
                    placeholder="مثال: F212121212"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">تاريخ الازدياد *</label>
                  <input
                    type="date"
                    required
                    value={editBirthDate}
                    onChange={(e) => setEditBirthDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">الجنس *</label>
                  <select
                    value={editGender}
                    onChange={(e) => setEditGender(e.target.value as 'Male' | 'Female')}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                  >
                    <option value="Male">ذكر (Male)</option>
                    <option value="Female">أنثى (Female)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">الفئة العمرية *</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                  >
                    <option value="U12">U12 - البراعم</option>
                    <option value="U15">U15 - الصغار</option>
                    <option value="U18">U18 - الفتيان</option>
                    <option value="U20">U20 - الشبان</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">نوع المشاركة في سباق العدو الريفي *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditParticipationType('school_team')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editParticipationType === 'school_team'
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-3xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>👥 فريق المؤسسة (جماعي)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditParticipationType('individual')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editParticipationType === 'individual'
                        ? 'bg-amber-50 border-amber-500 text-amber-900 shadow-3xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>👤 مشاركة فردية</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">صنف العداء(ة) في البطولة (نوع الترخيص) *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAffiliationType('non_club')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editAffiliationType === 'non_club'
                        ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-3xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏃 مدرسي (غير منخرط في نادٍ)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAffiliationType('club_affiliated')}
                    className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      editAffiliationType === 'club_affiliated'
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-3xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🏆 مدرسي منخرط (في نادٍ رياضي)</span>
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h5 className="text-[11px] font-bold text-slate-500 mb-2">بيانات الأستاذ المؤطر:</h5>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold mb-0.5">اسم المؤطر</label>
                    <input
                      type="text"
                      value={editCoachName}
                      onChange={(e) => setEditCoachName(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                      placeholder="الاسم"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold mb-0.5">رقم التأجير SOM</label>
                    <input
                      type="text"
                      value={editCoachLease}
                      onChange={(e) => setEditCoachLease(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                      placeholder="SOM"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold mb-0.5">الهاتف</label>
                    <input
                      type="text"
                      value={editCoachPhone}
                      onChange={(e) => setEditCoachPhone(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900"
                      placeholder="الهاتف"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isSavingEditStudent}
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditStudent}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingEditStudent ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
