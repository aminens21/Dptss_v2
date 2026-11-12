import React, { useState, useMemo, useEffect } from 'react';
import { Tournament, Student, School, User, Sport, Match } from '../types';
import { SPORTS_MAP, getAgeCategoriesForSeason, normalizeCategoryKey, DataService, getCategoryYearsLabel, isTeacherLevelAllowedForTournament, getTournamentLevelAr, doesConfirmationMatchBranch, getEffectiveConfirmedBranches, formatBranchLabelAr } from '../lib/dataService';
import { useAuth, isSuperAdminEmail } from '../contexts/AuthContext';
import { AppLogo } from './AppLogo';
import { CountdownTimer } from './CountdownTimer';
import { RegisterStudentModal } from './RegisterStudentModal';
import { SportBulkRegisterModal } from './SportBulkRegisterModal';
import { EditDeadlineModal } from './EditDeadlineModal';
import { ParticipationFormPdfModal } from './ParticipationFormPdfModal';
import { ElectronicDrawModal } from './ElectronicDrawModal';
import { ConfirmParticipationModal } from './ConfirmParticipationModal';
import { ConfirmedParticipationBadge } from './ConfirmedParticipationBadge';
import { useSchoolConfirmations } from '../hooks/useSchoolConfirmations';
import * as XLSX from 'xlsx';
import {
  X,
  Trophy,
  Users,
  Search,
  Filter,
  Download,
  FileText,
  ShieldCheck,
  Phone,
  Calendar,
  Layers,
  Settings,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Lock,
  Edit,
  Save,
  Clock,
  Plus,
  GraduationCap,
  Maximize2,
  Minimize2,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  Building2,
  UserPlus,
  UserCheck,
  Trash2,
  Camera,
  Upload,
  Image as ImageIcon,
  Palette,
  Shuffle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { compressImageToBase64 } from '../lib/imageUtils';

export function getDistinctCategoryLabel(category: string, gender?: string): string {
  const normKey = normalizeCategoryKey(category);
  const isFem = gender === 'Female' || gender === 'إناث';
  if (normKey === 'U12') {
    return isFem ? 'البرعمات' : 'البراعم';
  }
  if (normKey === 'U15') {
    return isFem ? 'الصغيرات' : 'الصغار';
  }
  if (normKey === 'U18') {
    return isFem ? 'الفتيات' : 'الفتيان';
  }
  if (normKey === 'U20') {
    return isFem ? 'الشابات' : 'الشبان';
  }
  if (isFem) {
    if (category.includes('براعم') || category.includes('برعم')) return 'البرعمات';
    if (category.includes('صغار') || category.includes('صغير')) return 'الصغيرات';
    if (category.includes('فتيان') || category.includes('فتيات')) return 'الفتيات';
    if (category.includes('شبان') || category.includes('شابات')) return 'الشابات';
  } else {
    if (category.includes('براعم') || category.includes('برعم')) return 'البراعم';
    if (category.includes('صغار') || category.includes('صغير')) return 'الصغار';
    if (category.includes('فتيان') || category.includes('فتيات')) return 'الفتيان';
    if (category.includes('شبان') || category.includes('شابات')) return 'الشبان';
  }
  return category;
}

export function getBranchTournamentTitle(t: Tournament, activeBranchModal?: string | null): string {
  const affPrefix = (t.affiliationType || activeBranchModal) === 'club_affiliated' ? 'بطولة المنتمين للأندية' : 'بطولة غير المنتمين للأندية';
  const normCat = normalizeCategoryKey(t.ageCategory || 'U15');
  const genLabel = t.gender === 'Female' ? 'إناث' : t.gender === 'Male' ? 'ذكور' : 'مختلط';
  return `${affPrefix} ${normCat} ${genLabel}`;
}

interface SportChampionshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | null;
  tournaments: Tournament[];
  allStudents: Student[];
  schools: School[];
  matches: Match[];
  teachers: User[];
  activeSeason: string;
  canManage: boolean;
  isProgrammed: boolean;
  onProgramTournament: (sportId: string) => void;
  onRefreshData?: () => void;
  isTeacherRole?: boolean;
  teacherSchoolName?: string;
}

export const SportChampionshipModal: React.FC<SportChampionshipModalProps> = ({
  isOpen,
  onClose,
  sport,
  tournaments,
  allStudents,
  schools,
  matches,
  teachers,
  activeSeason,
  canManage,
  isProgrammed,
  onProgramTournament,
  onRefreshData,
  isTeacherRole,
  teacherSchoolName
}) => {
  const { userProfile } = useAuth();

  // Local copy of students for instant optimistic UI updates
  const [localStudents, setLocalStudents] = useState<Student[]>(allStudents);
  useEffect(() => {
    setLocalStudents(allStudents);
  }, [allStudents]);

  // Refresh data on open
  useEffect(() => {
    if (isOpen && onRefreshData) {
      onRefreshData();
    }
  }, [isOpen, onRefreshData]);

  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<'ALL' | 'Male' | 'Female'>('ALL');
  const [selectedAffiliation, setSelectedAffiliation] = useState<'non_club' | 'club_affiliated'>('non_club');
  const [activeBranchModal, setActiveBranchModal] = useState<'non_club' | 'club_affiliated' | null>(null);
  const [selectedBranchTournament, setSelectedBranchTournament] = useState<Tournament | null>(null);
  const [search, setSearch] = useState('');
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isBulkRegisterOpen, setIsBulkRegisterOpen] = useState(false);
  const [preselectedSchoolForRegister, setPreselectedSchoolForRegister] = useState<string | undefined>(undefined);
  const [isEditDeadlineOpen, setIsEditDeadlineOpen] = useState(false);

  // School Confirmation State
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const { isSchoolConfirmed, getConfirmation, getConfirmedSchoolsForSport, refreshConfirmations } = useSchoolConfirmations();
  const effectiveSchoolName = teacherSchoolName || userProfile?.schoolName || userProfile?.workLocation || '';
  const isSchoolCurrentlyConfirmed = sport ? isSchoolConfirmed(sport.id, effectiveSchoolName) : false;
  const currentConfirmationRecord = sport ? getConfirmation(sport.id, effectiveSchoolName) : undefined;
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);
  const [selectedSchoolNameForView, setSelectedSchoolNameForView] = useState<string | null>(null);
  const [pdfSchoolName, setPdfSchoolName] = useState<string | null>(null);
  const [pdfPreselectedCat, setPdfPreselectedCat] = useState<string>('ALL');
  const [pdfPreselectedGender, setPdfPreselectedGender] = useState<'Male' | 'Female' | 'ALL'>('ALL');

  // Coach modal states for school drilldown view
  const [isCoachModalOpen, setIsCoachModalOpen] = useState(false);
  const [coachNameInput, setCoachNameInput] = useState('');
  const [coachLeaseInput, setCoachLeaseInput] = useState('');
  const [coachPhoneInput, setCoachPhoneInput] = useState('');
  const [coachCategoryTarget, setCoachCategoryTarget] = useState<string>('ALL');
  const [isSubmittingCoach, setIsSubmittingCoach] = useState(false);

  // Category deletion state
  const [categoryToDelete, setCategoryToDelete] = useState<{ category: string; gender: 'Male' | 'Female'; label: string; count: number } | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Individual student deletion state
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);

  // Individual student editing state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [isSavingEditStudent, setIsSavingEditStudent] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editMassarNumber, setEditMassarNumber] = useState('');
  const [editGender, setEditGender] = useState<'Male' | 'Female'>('Male');
  const [editBirthDate, setEditBirthDate] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAffiliationType, setEditAffiliationType] = useState<'non_club' | 'club_affiliated'>('non_club');
  const [editAthleticsSpecialty, setEditAthleticsSpecialty] = useState('');
  const [editPhoto, setEditPhoto] = useState('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [editCoachName, setEditCoachName] = useState('');
  const [editCoachLease, setEditCoachLease] = useState('');
  const [editCoachPhone, setEditCoachPhone] = useState('');

  // Sync editing student form values when a student is selected
  useEffect(() => {
    if (editingStudent) {
      setEditFullName(editingStudent.fullName || '');
      setEditMassarNumber(editingStudent.massarNumber || '');
      setEditGender(editingStudent.gender || 'Male');
      setEditBirthDate(editingStudent.birthDate || '');
      setEditCategory(editingStudent.category || 'U12');
      setEditAffiliationType(editingStudent.affiliationType || 'non_club');
      setEditAthleticsSpecialty(editingStudent.athleticsSpecialty || '');
      setEditPhoto(editingStudent.photoUrl || '');
      setEditCoachName(editingStudent.coachName || (isTeacherRole && userProfile?.fullName ? userProfile.fullName : ''));
      setEditCoachLease(editingStudent.coachLeaseNumber || (isTeacherRole && userProfile?.leaseNumber ? userProfile.leaseNumber : ''));
      setEditCoachPhone(editingStudent.coachPhone || (isTeacherRole && userProfile?.phone ? userProfile.phone : ''));
    }
  }, [editingStudent, isTeacherRole, userProfile]);

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

  // School participation withdrawal state
  const [schoolToWithdraw, setSchoolToWithdraw] = useState<{ schoolName: string; studentCount: number } | null>(null);
  const [isWithdrawingSchool, setIsWithdrawingSchool] = useState(false);

  // Helper to check if a school is the teacher's own school
  const isUserSchool = (targetSchoolName: string) => {
    if (!userProfile) return false;
    const cleanTarget = String(targetSchoolName || '').trim().toLowerCase();
    const cleanTeacherSchool = String(userProfile.workLocation || teacherSchoolName || userProfile.schoolName || '').trim().toLowerCase();
    if (!cleanTarget || !cleanTeacherSchool) return false;
    return (
      cleanTarget === cleanTeacherSchool ||
      cleanTarget.includes(cleanTeacherSchool) ||
      cleanTeacherSchool.includes(cleanTarget)
    );
  };

  // Helper to check if current user can manage/modify/withdraw this school
  const canManageSchool = (targetSchoolName: string) => {
    if (canManage) return true;
    if (isTeacherRole && isUserSchool(targetSchoolName)) return true;
    return false;
  };

  // Permission checker for modifying or deleting a student
  const canManageThisStudent = (stud: Student) => {
    if (canManage) return true;
    if (!isTeacherRole) return false;
    if (!userProfile) return false;

    // 1. Verify student belongs to the teacher's school
    const cleanStudentSchool = String(stud.schoolName || '').trim().toLowerCase();
    const cleanTeacherSchool = String(userProfile.workLocation || teacherSchoolName || '').trim().toLowerCase();
    const isSameSchoolName = cleanStudentSchool && cleanTeacherSchool && (
      cleanStudentSchool === cleanTeacherSchool ||
      cleanStudentSchool.includes(cleanTeacherSchool) ||
      cleanTeacherSchool.includes(cleanStudentSchool)
    );

    const matched = schools.find(s => s.name === (userProfile.workLocation || teacherSchoolName) || s.name.includes(userProfile.workLocation || teacherSchoolName || ''));
    const teacherSchoolId = matched ? matched.id : undefined;
    const isSameSchoolId = stud.schoolId && teacherSchoolId && stud.schoolId === teacherSchoolId;

    if (!isSameSchoolName && !isSameSchoolId) {
      return false;
    }

    // Teacher can edit or delete any participant belonging to their institution
    return true;
  };

  // Function to execute school withdrawal from this branch/tournament
  const executeWithdrawSchool = async () => {
    if (!schoolToWithdraw || !sport) return;
    setIsWithdrawingSchool(true);
    const toastId = toast.loading(`جاري سحب مشاركة مؤسسة ${schoolToWithdraw.schoolName}...`);
    try {
      const targetBranchAff = (selectedBranchTournament && selectedBranchTournament.affiliationType) || activeBranchModal || selectedAffiliation || 'non_club';
      const targetCat = selectedBranchTournament ? normalizeCategoryKey(selectedBranchTournament.ageCategory) : (selectedCatId !== 'ALL' ? normalizeCategoryKey(selectedCatId) : undefined);
      const targetGender = selectedBranchTournament ? selectedBranchTournament.gender : (selectedGender !== 'ALL' ? selectedGender : undefined);

      // Find all students for this school in this sport & branch
      const studentsToDelete = sportStudents.filter(s => {
        if (!s) return false;
        const matchSchool = s.schoolName && (
          s.schoolName.trim().toLowerCase() === schoolToWithdraw.schoolName.trim().toLowerCase() ||
          s.schoolName.includes(schoolToWithdraw.schoolName) ||
          schoolToWithdraw.schoolName.includes(s.schoolName)
        );
        if (!matchSchool) return false;
        
        const sAff = s.affiliationType || 'non_club';
        if (sAff !== targetBranchAff) return false;

        if (targetCat) {
          if (normalizeCategoryKey(s.category) !== targetCat) return false;
        }

        if (targetGender && targetGender !== 'ALL' && targetGender !== 'Both') {
          if ((s.gender || 'Male').toLowerCase() !== targetGender.toLowerCase()) return false;
        }

        return true;
      });

      for (const st of studentsToDelete) {
        await DataService.deleteStudent(st.id);
      }
      setLocalStudents(prev => prev.filter(s => !studentsToDelete.some(t => t.id === s.id)));

      // Record withdrawal in DataService so it persists across sessions and removes school from electronic draw
      const matchedSchool = schools.find(sch => 
        sch.name.trim().toLowerCase() === schoolToWithdraw.schoolName.trim().toLowerCase() ||
        sch.name.includes(schoolToWithdraw.schoolName) ||
        schoolToWithdraw.schoolName.includes(sch.name)
      );
      const sId = matchedSchool ? matchedSchool.id : schoolToWithdraw.schoolName;

      await DataService.withdrawSchool({
        sportId: sport.id,
        schoolName: schoolToWithdraw.schoolName,
        schoolId: sId,
        tournamentId: selectedBranchTournament?.id,
        ageCategory: targetCat,
        gender: targetGender,
        affiliationType: targetBranchAff,
        withdrawnBy: userProfile?.fullName || userProfile?.email
      });

      await refreshConfirmations();

      toast.dismiss(toastId);
      toast.success(`تم سحب مشاركة مؤسسة "${schoolToWithdraw.schoolName}" من فرع هذه البطولة بنجاح`);
      
      // If we are currently inside this school's drilldown, navigate back to schools list
      if (selectedSchoolNameForView === schoolToWithdraw.schoolName) {
        setSelectedSchoolNameForView(null);
      }
      setSchoolToWithdraw(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Error withdrawing school:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء سحب المشاركة');
    } finally {
      setIsWithdrawingSchool(false);
    }
  };

  // Function to execute student deletion
  const confirmDeleteStudent = async () => {
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

  // Function to execute student edit save
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
    setIsSavingEditStudent(true);
    const toastId = toast.loading('جاري حفظ التعديلات...');
    try {
      const updates: Partial<Student> = {
        fullName: editFullName.trim(),
        massarNumber: editMassarNumber.trim() || undefined,
        gender: editGender,
        birthDate: editBirthDate,
        category: editCategory,
        affiliationType: editAffiliationType,
        photoUrl: editPhoto || undefined,
        coachName: (editCoachName.trim() || userProfile?.fullName || '').trim() || undefined,
        coachLeaseNumber: (editCoachLease.trim() || userProfile?.leaseNumber || '').trim() || undefined,
        coachPhone: (editCoachPhone.trim() || userProfile?.phone || '').trim() || undefined,
        ...(sport?.id === 'athletics' ? { athleticsSpecialty: editAthleticsSpecialty.trim() || undefined } : {})
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

  // Function to execute category deletion
  const confirmDeleteCategory = async () => {
    if (!categoryToDelete || !selectedSchoolNameForView || !sport) return;
    setIsDeletingCategory(true);
    const toastId = toast.loading(`جاري حذف فئة ${categoryToDelete.label}...`);
    try {
      const allTargets = schoolStudents.filter(
        s => s.category === categoryToDelete.category && s.gender === categoryToDelete.gender
      );

      // Filter only manageable students for teachers
      const manageableTargets = allTargets.filter(st => canManageThisStudent(st));
      const unmanageableCount = allTargets.length - manageableTargets.length;

      if (manageableTargets.length === 0) {
        toast.dismiss(toastId);
        toast.error('لا يمكنك حذف هذه الفئة لأن جميع المشاركين فيها مسجلون تحت تأطير أستاذ آخر بالمؤسسة.');
        setCategoryToDelete(null);
        return;
      }

      for (const st of manageableTargets) {
        await DataService.deleteStudent(st.id);
      }
      setLocalStudents(prev => prev.filter(s => !manageableTargets.some(t => t.id === s.id)));
      toast.dismiss(toastId);
      
      if (unmanageableCount > 0) {
        toast.success(`تم حذف مشاركتك فقط (${manageableTargets.length} مشارك). تم الإبقاء على مشاركة المؤطر الآخر (${unmanageableCount} مشارك) بالمؤسسة.`);
      } else {
        toast.success(`تم حذف فئة ${categoryToDelete.label} (${manageableTargets.length} مشارك) بنجاح`);
      }
      setCategoryToDelete(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء حذف الفئة');
    } finally {
      setIsDeletingCategory(false);
    }
  };

  useEffect(() => {
    setActiveBranchModal(null);
    setSelectedBranchTournament(null);
    setSelectedSchoolNameForView(null);
    setPdfSchoolName(null);
  }, [sport?.id]);

  useEffect(() => {
    setSelectedSchoolNameForView(null);
  }, [selectedAffiliation]);

  // Compute deadline for this sport from its tournaments
  const currentDeadline = useMemo(() => {
    if (!sport) return null;
    const sportTournaments = tournaments.filter(t => t.sportId === sport.id);
    const withDeadline = sportTournaments.find(t => t.registrationDeadline);
    return withDeadline?.registrationDeadline || null;
  }, [tournaments, sport]);

  const isDeadlineExpired = useMemo(() => {
    if (!currentDeadline) return false;
    try {
      const d = (currentDeadline as any)?.toDate ? (currentDeadline as any).toDate() : new Date(currentDeadline);
      return !isNaN(d.getTime()) && d.getTime() < Date.now();
    } catch {
      return false;
    }
  }, [currentDeadline]);

  // Head of Technical Committee assigned to this sport
  const techHead = useMemo(() => {
    if (!sport || !teachers) return null;
    return teachers.find(tch =>
      tch.isTechCommitteeHead &&
      (tch.techCommitteeSports?.includes(sport.id) || tch.sportId === sport.id)
    );
  }, [teachers, sport]);

  const teacherCadre = useMemo(() => {
    if (userProfile?.teachingCadre) return userProfile.teachingCadre;
    if (userProfile?.schoolId || userProfile?.schoolName) {
      const userSchool = (schools || []).find(s => 
        (userProfile.schoolId && s.id === userProfile.schoolId) || 
        (userProfile.schoolName && s.name === userProfile.schoolName)
      );
      if (userSchool?.type) return userSchool.type;
    }
    return undefined;
  }, [userProfile, schools]);

  // Determine which branch cards to show based on programmed tournaments for this sport
  const sportTournaments = useMemo(() => {
    if (!sport) return [];
    return tournaments.filter(t => t.sportId === sport.id);
  }, [tournaments, sport]);

  // Categories list configured for this sport
  const seasonalCategories = getAgeCategoriesForSeason(activeSeason, undefined, sport?.id);
  const sportCategories = useMemo(() => {
    return (sport?.ageCategories && sport.ageCategories.length > 0)
      ? sport.ageCategories.map(normalizeCategoryKey)
      : seasonalCategories.map(c => c.id);
  }, [sport, seasonalCategories]);

  // Tournaments belonging to the active classification branch (or fallback virtual tournaments)
  const displayBranchTournaments = useMemo(() => {
    if (!activeBranchModal || !sport) return [];
    const programmed = sportTournaments.filter(t => (t.affiliationType || 'non_club') === activeBranchModal);
    if (programmed.length > 0) return programmed;

    // Fallback virtual tournaments for configured categories & genders if no specific records exist yet
    const virtuals: Tournament[] = [];
    const cats = sportCategories.length > 0 ? sportCategories : ['U15', 'U18'];
    const genders: Array<'Male' | 'Female'> = ['Male', 'Female'];

    cats.forEach(cat => {
      genders.forEach(g => {
        const affPrefix = activeBranchModal === 'club_affiliated' ? 'بطولة المنتمين للأندية' : 'بطولة غير المنتمين للأندية';
        const gLabel = g === 'Female' ? 'إناث' : 'ذكور';
        const tName = `${affPrefix} ${cat} ${gLabel}`;
        virtuals.push({
          id: `virtual-${sport.id}-${cat}-${g}-${activeBranchModal}`,
          sportId: sport.id,
          name: tName,
          gender: g,
          ageCategory: cat,
          affiliationType: activeBranchModal,
          seasonId: activeSeason || '2026-2027',
          scope: 'provincial',
          startDate: new Date().toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0],
          status: 'Scheduled',
          level: 'ALL'
        });
      });
    });
    return virtuals;
  }, [sportTournaments, activeBranchModal, sport, sportCategories]);

  // Main modal title for the sport
  const customTitle = useMemo(() => {
    return `البطولة الإقليمية المدرسية لـ ${sport?.name || ''}`;
  }, [sport?.name]);

  // Check if teacher level is allowed for this sport (at least one tournament matches their cadre)
  const isTeacherAllowedForSport = useMemo(() => {
    if (!isTeacherRole || !userProfile || !sportTournaments.length) return true;
    if (canManage) return true; // Admins/Managers always allowed
    
    return sportTournaments.some(t => 
      isTeacherLevelAllowedForTournament(userProfile.teachingCadre, t.level)
    );
  }, [isTeacherRole, userProfile, sportTournaments, canManage]);

  const teacherCadreAr = useMemo(() => {
    if (!userProfile?.teachingCadre) return '';
    if (userProfile.teachingCadre === 'PRIMARY') return 'ابتدائي';
    if (userProfile.teachingCadre === 'MIDDLE') return 'إعدادي';
    if (userProfile.teachingCadre === 'HIGH') return 'تأهيلي';
    return userProfile.teachingCadre;
  }, [userProfile?.teachingCadre]);

  const allowedSportLevelsAr = useMemo(() => {
    const levels = new Set<string>();
    sportTournaments.forEach(t => {
      if (t.level) {
        t.level.split(',').forEach(l => levels.add(l.trim()));
      }
    });
    if (levels.size === 0) return '';
    return getTournamentLevelAr(Array.from(levels).join(','));
  }, [sportTournaments]);

  const allowedTournamentsForTeacher = useMemo(() => {
    if (!isTeacherRole || canManage) return tournaments;
    return tournaments.filter(t => 
      isTeacherLevelAllowedForTournament(userProfile?.teachingCadre, t.level)
    );
  }, [tournaments, isTeacherRole, canManage, userProfile?.teachingCadre]);

  const hasNonClubTournaments = useMemo(() => {
    return sportTournaments.some(t => (t.affiliationType || 'non_club') === 'non_club');
  }, [sportTournaments]);

  const hasClubTournaments = useMemo(() => {
    return sportTournaments.some(t => t.affiliationType === 'club_affiliated');
  }, [sportTournaments]);

  const hasOpenTournaments = useMemo(() => {
    return sportTournaments.some(t => t.affiliationType === 'open' || (t.name && (t.name.includes('مفتوحة') || t.name.includes('المفتوحة'))));
  }, [sportTournaments]);

  // Set default category on open or when sport changes + auto guard for teacher cadre
  useEffect(() => {
    if (isOpen) {
      if (isTeacherRole && !canManage && !isTeacherAllowedForSport) {
        toast.error(
          `عذراً، هذه البطولة مخصصة لـ (${allowedSportLevelsAr || 'أسلاك أخرى'}) فقط.\nبصفتك أستاذ سلك (${teacherCadreAr || 'غير مطابق'}), لا يمكنك الولوج لتسجيل الفرق والمشاركين بها.`,
          { id: 'modal-cadre-blocked' }
        );
        onClose();
        return;
      }

      if (sportCategories && sportCategories.length > 0) {
        setSelectedCatId(sportCategories[0]);
      } else {
        setSelectedCatId('ALL');
      }
    }
  }, [isOpen, sport?.id, sportCategories, isTeacherRole, canManage, isTeacherAllowedForSport, allowedSportLevelsAr, teacherCadreAr, onClose]);

  // Students registered for this sport
  const sportStudents = localStudents.filter(s => s && s.sportId === sport?.id);

  const nonClubStudents = useMemo(() => {
    return sportStudents.filter(s => (s.affiliationType || 'non_club') === 'non_club');
  }, [sportStudents]);

  const clubStudents = useMemo(() => {
    return sportStudents.filter(s => s.affiliationType === 'club_affiliated');
  }, [sportStudents]);

  const nonClubSchoolsCount = useMemo(() => {
    const names = new Set(nonClubStudents.map(s => (s.schoolName || '').trim()).filter(Boolean));
    if (sport) {
      getConfirmedSchoolsForSport(sport.id).forEach(conf => {
        if (conf?.schoolName && doesConfirmationMatchBranch(conf, { affiliationType: 'non_club' })) {
          names.add(conf.schoolName.trim());
        }
      });
    }
    return names.size;
  }, [nonClubStudents, sport, getConfirmedSchoolsForSport]);

  const clubSchoolsCount = useMemo(() => {
    const names = new Set(clubStudents.map(s => (s.schoolName || '').trim()).filter(Boolean));
    if (sport) {
      getConfirmedSchoolsForSport(sport.id).forEach(conf => {
        if (conf?.schoolName && doesConfirmationMatchBranch(conf, { affiliationType: 'club_affiliated' })) {
          names.add(conf.schoolName.trim());
        }
      });
    }
    return names.size;
  }, [clubStudents, sport, getConfirmedSchoolsForSport]);

  const openStudentsCount = useMemo(() => {
    return sportStudents.filter(s => s.affiliationType === 'open').length;
  }, [sportStudents]);

  const effectivePreselectedGender = useMemo(() => {
    if (!sport) return undefined;
    if (selectedBranchTournament && selectedBranchTournament.gender && selectedBranchTournament.gender !== 'Both') {
      return selectedBranchTournament.gender as 'Male' | 'Female';
    }
    if (selectedGender !== 'ALL') return selectedGender;
    const genders = Array.from(new Set(sportTournaments.map(t => t.gender).filter(g => g === 'Male' || g === 'Female')));
    if (genders.length === 1) return genders[0] as 'Male' | 'Female';
    return undefined;
  }, [sport, selectedBranchTournament, selectedGender, sportTournaments]);

  const effectivePreselectedCategory = useMemo(() => {
    if (!sport) return undefined;
    if (selectedBranchTournament && selectedBranchTournament.ageCategory) {
      return normalizeCategoryKey(selectedBranchTournament.ageCategory);
    }
    if (selectedCatId !== 'ALL' && selectedCatId) return selectedCatId;
    const cats = Array.from(new Set(sportTournaments.map(t => normalizeCategoryKey(t.ageCategory)).filter(Boolean)));
    if (cats.length === 1) return cats[0];
    if (sportCategories.length === 1) return sportCategories[0];
    return undefined;
  }, [sport, selectedBranchTournament, selectedCatId, sportTournaments, sportCategories]);

  const effectivePreselectedAffiliation = useMemo(() => {
    if (!sport) return 'non_club';
    if (selectedBranchTournament && selectedBranchTournament.affiliationType) {
      return selectedBranchTournament.affiliationType as 'non_club' | 'club_affiliated';
    }
    if (activeBranchModal) return activeBranchModal;
    if (selectedAffiliation) return selectedAffiliation;
    const affs = Array.from(new Set(sportTournaments.map(t => t.affiliationType || 'non_club')));
    if (affs.length === 1) return affs[0] as 'non_club' | 'club_affiliated';
    return 'non_club';
  }, [sport, selectedBranchTournament, activeBranchModal, selectedAffiliation, sportTournaments]);

  const currentSchoolForPdf = selectedSchoolNameForView || pdfSchoolName;
  const targetSchoolStudents = useMemo(() => {
    if (!sport || !currentSchoolForPdf) return [];
    return sportStudents.filter(s => 
      s.schoolName === currentSchoolForPdf &&
      (s.affiliationType || 'non_club') === (activeBranchModal || selectedAffiliation)
    );
  }, [sport, sportStudents, currentSchoolForPdf, activeBranchModal, selectedAffiliation]);

  // Filter students by active category tab & gender & search & affiliationType
  const filteredStudents = sportStudents.filter(s => {
    if (!sport || !s) return false;
    const sCategory = s.category || '';
    const sGender = s.gender || '';
    const sFullName = s.fullName || '';
    const sSchoolName = s.schoolName || '';
    const sAffType = s.affiliationType || 'non_club';

    const matchCategory = selectedCatId === 'ALL' || sCategory.toUpperCase() === selectedCatId.toUpperCase();
    const matchGender = selectedGender === 'ALL' || sGender.toLowerCase() === selectedGender.toLowerCase();
    const matchAffiliation = sAffType === selectedAffiliation;
    const matchSearch = !search.trim() ||
      sFullName.toLowerCase().includes(search.toLowerCase()) ||
      sSchoolName.toLowerCase().includes(search.toLowerCase());
    return matchCategory && matchGender && matchAffiliation && matchSearch;
  });

  // Matches for this sport
  const sportMatches = matches.filter(m => m.sportId === sport?.id);

  const getCategoryName = (catId: string) => {
    const found = seasonalCategories.find(c => c.id === catId);
    if (found) {
      const years = getCategoryYearsLabel(catId, activeSeason, sport?.id);
      return `${found.shortName || found.name} (${years})`;
    }
    return getCategoryYearsLabel(catId, activeSeason, sport?.id);
  };

  // List of all participating schools with participant counts, gender counts, and category details
  const participatingSchools = useMemo(() => {
    if (!sport) return [];
    const targetAff = (selectedBranchTournament && selectedBranchTournament.affiliationType) || activeBranchModal || selectedAffiliation || 'non_club';
    const targetCat = selectedBranchTournament 
      ? normalizeCategoryKey(selectedBranchTournament.ageCategory) 
      : (selectedCatId && selectedCatId !== 'ALL' ? normalizeCategoryKey(selectedCatId) : 'ALL');
    const targetGen = selectedBranchTournament 
      ? selectedBranchTournament.gender 
      : selectedGender;

    const affiliationStudents = sportStudents.filter(s => {
      if (!s) return false;
      const sAffType = s.affiliationType || 'non_club';
      const sNormCat = normalizeCategoryKey(s.category);
      const sGen = s.gender || 'Male';

      const matchAff = sAffType === targetAff;
      const matchCat = targetCat === 'ALL' || sNormCat === targetCat;
      const matchGen = targetGen === 'ALL' || targetGen === 'Both' || sGen.toLowerCase() === targetGen.toLowerCase();
      
      return matchAff && matchCat && matchGen;
    });

    const schoolsMap: Record<string, {
      name: string;
      totalCount: number;
      maleCount: number;
      femaleCount: number;
      genderCategories: Array<{
        key: string;
        category: string;
        gender: 'Male' | 'Female';
        label: string;
        count: number;
      }>;
    }> = {};

    affiliationStudents.forEach(s => {
      if (!s.schoolName) return;
      if (!schoolsMap[s.schoolName]) {
        schoolsMap[s.schoolName] = {
          name: s.schoolName,
          totalCount: 0,
          maleCount: 0,
          femaleCount: 0,
          genderCategories: []
        };
      }
      const schoolItem = schoolsMap[s.schoolName];
      schoolItem.totalCount += 1;
      const gen: 'Male' | 'Female' = s.gender === 'Female' ? 'Female' : 'Male';
      if (gen === 'Male') {
        schoolItem.maleCount += 1;
      } else {
        schoolItem.femaleCount += 1;
      }
      const cat = normalizeCategoryKey(s.category || 'U15');
      const key = `${cat}__${gen}`;
      const existing = schoolItem.genderCategories.find(g => g.key === key);
      if (existing) {
        existing.count += 1;
      } else {
        const label = getDistinctCategoryLabel(cat, gen);
        schoolItem.genderCategories.push({
          key,
          category: cat,
          gender: gen,
          label,
          count: 1
        });
      }
    });

    // Merge confirmed schools from Phase 1 ONLY when they explicitly confirmed this exact (affiliation, category, gender) branch
    if (sport) {
      const confirmedSchoolsList = getConfirmedSchoolsForSport(sport.id);
      confirmedSchoolsList.forEach(conf => {
        if (!conf || !conf.schoolName) return;

        const matchingBranches = getEffectiveConfirmedBranches(conf, true).filter(b => {
          if (b.affiliationType !== targetAff) return false;
          if (targetCat !== 'ALL' && normalizeCategoryKey(b.category) !== targetCat) return false;
          if (targetGen !== 'ALL' && targetGen !== 'Both' && (targetGen as string) !== 'Mixed' && b.gender.toLowerCase() !== targetGen.toLowerCase()) return false;
          return true;
        });

        if (matchingBranches.length === 0) return;

        const isConfWithdrawn = DataService.isSchoolWithdrawn({
          sportId: sport?.id,
          tournamentId: selectedBranchTournament?.id,
          ageCategory: targetCat !== 'ALL' ? targetCat : undefined,
          gender: targetGen !== 'ALL' ? targetGen : undefined,
          affiliationType: targetAff
        }, conf.schoolId, conf.schoolName);
        if (isConfWithdrawn) return;

        if (!schoolsMap[conf.schoolName]) {
          schoolsMap[conf.schoolName] = {
            name: conf.schoolName,
            totalCount: 0,
            maleCount: 0,
            femaleCount: 0,
            genderCategories: []
          };
        }

        const schoolItem = schoolsMap[conf.schoolName];
        matchingBranches.forEach(b => {
          const cat = normalizeCategoryKey(b.category);
          const gen = b.gender;
          const key = `${cat}__${gen}`;
          if (!schoolItem.genderCategories.some(g => g.key === key)) {
            schoolItem.genderCategories.push({
              key,
              category: cat,
              gender: gen,
              label: getDistinctCategoryLabel(cat, gen),
              count: 0
            });
          }
        });
      });
    }

    let allSchools = Object.values(schoolsMap).filter(sch => {
      if (sch.totalCount === 0) {
        const isWithdrawn = DataService.isSchoolWithdrawn({
          sportId: sport?.id,
          tournamentId: selectedBranchTournament?.id,
          ageCategory: targetCat !== 'ALL' ? targetCat : undefined,
          gender: targetGen !== 'ALL' ? targetGen : undefined,
          affiliationType: targetAff
        }, undefined, sch.name);
        if (isWithdrawn) return false;
      }
      return true;
    });

    // Sort schools: Teacher's own school first (when participating), then alphabetically
    allSchools.sort((a, b) => {
      const aIsOwn = isUserSchool(a.name);
      const bIsOwn = isUserSchool(b.name);
      if (aIsOwn && !bIsOwn) return -1;
      if (!aIsOwn && bIsOwn) return 1;
      return a.name.localeCompare(b.name, 'ar');
    });

    return allSchools.filter(sch => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      const matchSchoolName = sch.name.toLowerCase().includes(term);
      const matchCategories = sch.genderCategories.some(gCat => 
        gCat.label.toLowerCase().includes(term) || gCat.category.toLowerCase().includes(term)
      );
      return matchSchoolName || matchCategories;
    });
  }, [sportStudents, selectedAffiliation, selectedBranchTournament, selectedCatId, selectedGender, search, isTeacherRole, userProfile, teacherSchoolName, canManage, activeBranchModal, sport, getConfirmedSchoolsForSport]);

  // Students belonging to the currently selected school in this sport & affiliation
  const schoolStudents = useMemo(() => {
    if (!sport || !selectedSchoolNameForView) return [];
    const targetAff = (selectedBranchTournament && selectedBranchTournament.affiliationType) || activeBranchModal || selectedAffiliation || 'non_club';
    const targetCat = selectedBranchTournament 
      ? normalizeCategoryKey(selectedBranchTournament.ageCategory) 
      : (selectedCatId && selectedCatId !== 'ALL' ? normalizeCategoryKey(selectedCatId) : 'ALL');
    const targetGen = selectedBranchTournament ? selectedBranchTournament.gender : selectedGender;

    return sportStudents.filter(s => {
      if (!s || s.schoolName !== selectedSchoolNameForView) return false;
      const sAff = s.affiliationType || 'non_club';
      const sNormCat = normalizeCategoryKey(s.category);
      const sGen = s.gender || 'Male';

      const matchAff = sAff === targetAff;
      const matchCat = targetCat === 'ALL' || sNormCat === targetCat;
      const matchGen = targetGen === 'ALL' || targetGen === 'Both' || sGen.toLowerCase() === targetGen.toLowerCase();

      return matchAff && matchCat && matchGen;
    });
  }, [sportStudents, selectedSchoolNameForView, selectedBranchTournament, activeBranchModal, selectedAffiliation, selectedCatId, selectedGender]);

  // Grouped students of this school by category and gender
  const groupedSchoolStudents = useMemo(() => {
    const groups: Record<string, {
      category: string;
      gender: 'Male' | 'Female';
      label: string;
      students: Student[];
    }> = {};

    schoolStudents.forEach(s => {
      if (!s.category) return;
      const gen: 'Male' | 'Female' = s.gender === 'Female' ? 'Female' : 'Male';
      const normCat = normalizeCategoryKey(s.category);
      const key = `${normCat}__${gen}`;
      if (!groups[key]) {
        groups[key] = {
          category: normCat,
          gender: gen,
          label: getDistinctCategoryLabel(normCat, gen),
          students: []
        };
      }
      groups[key].students.push(s);
    });
    return groups;
  }, [schoolStudents]);

  // Teachers belonging to the currently selected school for quick coach assignment
  const matchingSchoolTeachers = useMemo(() => {
    if (!selectedSchoolNameForView || !teachers) return [];
    return teachers.filter(t => 
      t.workLocation && (
        t.workLocation.trim().toLowerCase() === selectedSchoolNameForView.trim().toLowerCase() ||
        t.workLocation.includes(selectedSchoolNameForView) ||
        selectedSchoolNameForView.includes(t.workLocation)
      )
    );
  }, [teachers, selectedSchoolNameForView]);

  // Save/Update coach for school participants
  const handleSaveCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachNameInput.trim()) {
      toast.error('يرجى إدخال اسم الأستاذ المؤطر');
      return;
    }
    setIsSubmittingCoach(true);
    try {
      const targets = schoolStudents.filter(s => {
        if (coachCategoryTarget === 'ALL') return true;
        return `${s.category}__${s.gender}` === coachCategoryTarget || s.category === coachCategoryTarget;
      });

      if (targets.length === 0) {
        toast.error('لا يوجد تلاميذ مسجلين لتطبيق المؤطر عليهم');
        setIsSubmittingCoach(false);
        return;
      }

      const loadToast = toast.loading('جاري حفظ بيانات المؤطر...');
      const coachUpdates = {
        coachName: coachNameInput.trim(),
        coachLeaseNumber: coachLeaseInput.trim(),
        coachPhone: coachPhoneInput.trim()
      };
      for (const st of targets) {
        await DataService.updateStudent(st.id, coachUpdates);
      }
      setLocalStudents(prev => prev.map(s => targets.some(t => t.id === s.id) ? { ...s, ...coachUpdates } : s));
      toast.dismiss(loadToast);
      toast.success('تمت إضافة وتحديث بيانات الأستاذ المؤطر بنجاح');
      setIsCoachModalOpen(false);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error('Error saving coach:', err);
      toast.error('حدث خطأ أثناء حفظ بيانات المؤطر');
    } finally {
      setIsSubmittingCoach(false);
    }
  };

  const handleExportCategoryExcel = (catId: string) => {
    const isAll = catId === 'ALL';
    const targets = isAll ? sportStudents : sportStudents.filter(s => s.category === catId);

    if (targets.length === 0) {
      toast.error('لا يوجد تلاميذ مسجلين حالياً للتصدير');
      return;
    }

    const loadToastId = toast.loading('جاري تحضير ملف الإكسيل...');
    try {
      const excelData = targets.map((p, index) => {
        const base: any = {
          'الرقم الترتيبي': index + 1,
          'الاسم والنسب': p.fullName,
          'الجنس': p.gender === 'Male' ? 'ذكر' : 'أنثى',
          'تاريخ الازدياد': p.birthDate,
          'الفئة الرياضية': getCategoryName(p.category),
          'المؤسسة التعليمية': p.schoolName,
        };

        if (sport?.id === 'athletics') {
          base['التخصص الفرعي'] = p.athleticsSpecialty || 'غير محدد';
        }

        return base;
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      worksheet['!views'] = [{ RTL: true }];
      const workbook = XLSX.utils.book_new();
      const sheetName = isAll ? 'جميع المشاركين' : getCategoryName(catId).substring(0, 30);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const fileName = `مشاركي_بطولة_${(sport?.name || 'رياضة').replace(/\s+/g, '_')}_${isAll ? 'جميع_الفئات' : catId}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast.dismiss(loadToastId);
      toast.success('تم تصدير ملف الإكسيل بنجاح!');
    } catch (e) {
      console.error(e);
      toast.dismiss(loadToastId);
      toast.error('تعذر تصدير الملف');
    }
  };

  if (!isOpen || !sport) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto transition-all text-slate-900 dark:text-slate-100 ${
        isFullScreen ? 'max-w-[98vw] h-[96vh]' : 'max-w-6xl xl:max-w-7xl h-[92vh] sm:h-[85vh] max-h-[96vh] sm:max-h-[92vh]'
      }`}>
        
        {/* Top Header - Responsive & Centered on Mobile */}
        <div className={`p-2.5 sm:p-4 md:p-5 border-b flex flex-col sm:flex-row items-center sm:justify-between gap-2.5 sm:gap-4 ${
          isProgrammed
            ? 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white border-slate-800'
            : 'bg-gradient-to-r from-slate-700 via-slate-800 to-slate-900 text-white border-slate-700'
        }`}>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-right w-full sm:w-auto">
            <div className={`w-8 h-8 md:w-12 md:h-12 rounded-xl md:rounded-2xl text-base md:text-2xl flex items-center justify-center border shadow-xs shrink-0 ${
              isProgrammed ? 'bg-white/10 border-white/20' : 'bg-slate-600/40 border-slate-500/40 opacity-80'
            }`}>
              {sport.icon || '🏆'}
            </div>

            <div className="w-full sm:w-auto">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                <span className={`text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  isProgrammed
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {isProgrammed ? '🟢 مبرمجة ومفتوحة' : '⚪ غير مبرمجة'}
                </span>

                <span className="hidden xs:inline-block text-[9px] sm:text-[10px] font-medium text-slate-300 bg-white/10 px-2 py-0.5 rounded border border-white/10">
                  الموسم الدراسي {activeSeason}
                </span>
              </div>

              <h2 className="text-xs sm:text-base md:text-lg font-black text-white mt-1 leading-tight tracking-tight">
                {customTitle}
              </h2>
              {!isHeaderCollapsed && (
                <p className="hidden sm:block text-xs text-slate-300 mt-0.5 font-medium line-clamp-1">
                  {sport.description || `المسابقات والبطولات المدرسية الخاصة بـ ${sport.name} بمديرية تاوريرت`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto shrink-0 mr-auto">
            {/* Direct Electronic Draw Button for Managers / Tech Committee */}
            {canManage && isProgrammed && (
              <button
                type="button"
                onClick={() => setIsDrawModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer select-none"
                title="إجراء القرعة الإلكترونية وبرمجة المباريات وتعيين الحكام لهذه الرياضة"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>إجراء القرعة الإلكترونية</span>
              </button>
            )}

            {/* Toggle Collapse/Expand */}
            <button
              type="button"
              onClick={() => setIsHeaderCollapsed(!isHeaderCollapsed)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all cursor-pointer border border-white/15 shadow-2xs"
              title={isHeaderCollapsed ? 'إظهار لوحة العداد والضوابط' : 'إخفاء هذا الجزء لتوسيع جدول وتفاصيل التلاميذ المسجلين'}
            >
              {isHeaderCollapsed ? (
                <>
                  <ChevronDown className="h-4 w-4 text-emerald-300 animate-pulse" />
                  <span className="hidden sm:inline">إظهار لوحة المؤشرات والعداد</span>
                  <span className="inline sm:hidden">المؤشرات 📊</span>
                </>
              ) : (
                <>
                  <ChevronUp className="h-4 w-4 text-amber-300" />
                  <span className="hidden sm:inline">إخفاء هذا الجزء (توسيع جدول التلاميذ)</span>
                  <span className="inline sm:hidden">إخفاء ✕</span>
                </>
              )}
            </button>

            {/* Quick Register button when collapsed */}
            {isHeaderCollapsed && isProgrammed && (
              <button
                type="button"
                onClick={() => {
                  if (!isTeacherAllowedForSport) {
                    toast.error(`عذراً، أنت مسجل كأستاذ سلك (${teacherCadreAr})، وهذه البطولة مخصصة لأسلاك (${allowedSportLevelsAr}) فقط.`);
                    return;
                  }
                  setIsRegisterModalOpen(true);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                  !isTeacherAllowedForSport 
                    ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-70' 
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>تسجيل مشاركين</span>
              </button>
            )}

            {/* Fullscreen / Maximize toggle */}
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

        {/* Modal Scrollable Body */}
        <div className="p-3 sm:p-4 md:p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/50">

          {/* BRANCH CARDS (Show only if corresponding tournaments exist) */}
          <div className={`grid gap-4 ${
            [hasNonClubTournaments, hasClubTournaments, hasOpenTournaments].filter(Boolean).length === 1 
              ? 'grid-cols-1 max-w-md mx-auto' 
              : [hasNonClubTournaments, hasClubTournaments, hasOpenTournaments].filter(Boolean).length === 2
              ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
              : 'grid-cols-1 lg:grid-cols-3'
          }`}>
            {/* ⚪ Non-club Tournament Branch (White Card) */}
            {hasNonClubTournaments && (
              <div
                id="non-club-championship-card"
                onClick={() => {
                  setSelectedAffiliation('non_club');
                  setSelectedSchoolNameForView(null);
                  setActiveBranchModal('non_club');
                }}
                className="text-right p-5 rounded-2xl border-2 border-slate-200/90 hover:border-blue-500 bg-white hover:bg-blue-50/20 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-2xs hover:shadow-md group"
              >
                <div className="space-y-2 w-full">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-black px-3 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1.5 shadow-3xs">
                      <span>⚪</span>
                      <span>بطولة غير المنتمين للأندية</span>
                    </span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                      {nonClubSchoolsCount} مؤسسة مشاركة
                    </span>
                  </div>
                  <h4 className="text-base font-black text-slate-800 mt-1 group-hover:text-blue-700 transition-colors">
                    البطولة الإقليمية المدرسية لغير المنتمين للأندية
                  </h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    خاصة بالتلاميذ المتمدرسين العاديين غير المنخرطين في الأندية الرياضية أو العصب المدنية.
                  </p>

                  {/* List of categories with counts for this affiliation */}
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-slate-100 pt-3">
                    {sportCategories.map(catId => {
                      const count = nonClubStudents.filter(s => s.category === catId).length;
                      return (
                        <span key={catId} className={`text-[10px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                          count > 0 
                            ? 'bg-blue-50 text-blue-800 border-blue-200' 
                            : 'bg-slate-50 text-slate-400 border-slate-100'
                        }`}>
                          <span>{getCategoryName(catId)}:</span>
                          <strong className="font-black">{count}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-slate-100 pt-3.5 w-full mt-4 gap-2">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-xs text-slate-400 font-bold">المشاركون:</span>
                    <strong className="text-xs font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-lg border border-blue-200">
                      {nonClubStudents.length} تلميذ(ة)
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAffiliation('non_club');
                      setSelectedBranchTournament(null);
                      setSelectedSchoolNameForView(null);
                      setActiveBranchModal('non_club');
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
                  >
                    <span>دخول واستعراض بطولات هذا الصنف 🔓</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 🟡 Club-affiliated Tournament Branch (Yellow Card) */}
            {hasClubTournaments && (
              <div
                id="club-affiliated-championship-card"
                onClick={() => {
                  setSelectedAffiliation('club_affiliated');
                  setSelectedBranchTournament(null);
                  setSelectedSchoolNameForView(null);
                  setActiveBranchModal('club_affiliated');
                }}
                className="text-right p-5 rounded-2xl border-2 border-amber-200 hover:border-amber-400 bg-amber-50/40 hover:bg-amber-50/80 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-2xs hover:shadow-md group text-amber-950"
              >
                <div className="space-y-2 w-full">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-black px-3 py-1 rounded-full border bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1.5 shadow-3xs">
                      <span>🟡</span>
                      <span>بطولة المنتمين للأندية</span>
                    </span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-100/80 text-amber-900 border border-amber-200">
                      {clubSchoolsCount} مؤسسة مشاركة
                    </span>
                  </div>
                  <h4 className="text-base font-black text-amber-900 mt-1 group-hover:text-amber-950 transition-colors">
                    البطولة الإقليمية المدرسية للمنتمين للأندية
                  </h4>
                  <p className="text-xs text-amber-800/80 font-medium leading-relaxed">
                    خاصة بالتلاميذ المتمدرسين الممارسين والمرخصين رسمياً بالنوادي والعصب والجامعات الرياضية.
                  </p>

                  {/* List of categories with counts for this affiliation */}
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-amber-200/60 pt-3">
                    {sportCategories.map(catId => {
                      const count = clubStudents.filter(s => s.category === catId).length;
                      return (
                        <span key={catId} className={`text-[10px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                          count > 0 
                            ? 'bg-amber-100 text-amber-900 border-amber-300' 
                            : 'bg-amber-50/30 text-amber-800/40 border-amber-100/40'
                        }`}>
                          <span>{getCategoryName(catId)}:</span>
                          <strong className="font-black">{count}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-amber-200/60 pt-3.5 w-full mt-4 gap-2">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-xs text-amber-800 font-bold">المشاركون:</span>
                    <strong className="text-xs font-black text-amber-950 bg-amber-200/60 px-3 py-1 rounded-lg border border-amber-300">
                      {clubStudents.length} تلميذ(ة)
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAffiliation('club_affiliated');
                      setSelectedBranchTournament(null);
                      setSelectedSchoolNameForView(null);
                      setActiveBranchModal('club_affiliated');
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
                  >
                    <span>دخول واستعراض بطولات هذا الصنف 🔓</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* 🟢 Open Tournament Branch (Green Card) */}
            {hasOpenTournaments && (
              <div
                id="open-championship-card"
                onClick={() => {
                  setSelectedAffiliation('open');
                  setSelectedSchoolNameForView(null);
                  setActiveBranchModal('open');
                }}
                className="text-right p-5 rounded-2xl border-2 border-emerald-200 hover:border-emerald-500 bg-emerald-50/40 hover:bg-emerald-50/80 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-2xs hover:shadow-md group text-emerald-950"
              >
                <div className="space-y-2 w-full">
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-black px-3 py-1 rounded-full border bg-emerald-100 text-emerald-900 border-emerald-300 flex items-center gap-1.5 shadow-3xs">
                      <span>🟢</span>
                      <span>البطولات المفتوحة (Open)</span>
                    </span>
                    <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100/80 text-emerald-900 border border-emerald-200">
                      {openStudentsCount} مشاركين
                    </span>
                  </div>
                  <h4 className="text-base font-black text-emerald-900 mt-1 group-hover:text-emerald-950 transition-colors">
                    البطولات والدوريات المفتوحة
                  </h4>
                  <p className="text-xs text-emerald-800/80 font-medium leading-relaxed">
                    بطولات مفتوحة لجميع الفئات التعليمية والمستويات للمشاركة الرياضية الحرة.
                  </p>

                  {/* List of categories with counts for this affiliation */}
                  <div className="mt-3 flex flex-wrap gap-1 border-t border-emerald-200/60 pt-3">
                    {sportCategories.map(catId => {
                      const count = sportStudents.filter(s => s.category === catId && s.affiliationType === 'open').length;
                      return (
                        <span key={catId} className={`text-[10px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 border ${
                          count > 0 
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300' 
                            : 'bg-emerald-50/30 text-emerald-800/40 border-emerald-100/40'
                        }`}>
                          <span>{getCategoryName(catId)}:</span>
                          <strong className="font-black">{count}</strong>
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-t border-emerald-200/60 pt-3.5 w-full mt-4 gap-2">
                  <div className="flex items-center justify-between sm:justify-start gap-2">
                    <span className="text-xs text-emerald-800 font-bold">المشاركون:</span>
                    <strong className="text-xs font-black text-emerald-950 bg-emerald-200/60 px-3 py-1 rounded-lg border border-emerald-300">
                      {openStudentsCount} مشارك(ة)
                    </strong>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAffiliation('open');
                      setSelectedBranchTournament(null);
                      setSelectedSchoolNameForView(null);
                      setActiveBranchModal('open');
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
                  >
                    <span>دخول واستعراض بطولات هذا الصنف 🔓</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {!isHeaderCollapsed && (
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Deadline Countdown & Registration CTA Bar */}
              {isProgrammed && (
                <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-4 shadow-md flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border border-slate-700/80">
                  <div className="flex-1 min-w-0">
                    <CountdownTimer deadline={currentDeadline} />
                  </div>

                  {canManage && (
                    <div className="flex flex-wrap items-center justify-end gap-2.5 shrink-0">
                      <button
                        onClick={() => setIsEditDeadlineOpen(true)}
                        className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5 text-amber-400" />
                        <span>تعديل آخر أجل للتسجيل ✏️</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Teacher School Participation Confirmation Banner */}
              {isTeacherRole && effectiveSchoolName && sport && (
                <div className={`p-4 rounded-2xl border transition-all ${
                  isSchoolCurrentlyConfirmed
                    ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                    : 'bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border-amber-300 text-amber-950 shadow-sm ring-2 ring-amber-500/20'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 border ${
                        isSchoolCurrentlyConfirmed
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-3xs'
                          : 'bg-amber-500 text-white border-amber-400 shadow-3xs animate-bounce'
                      }`}>
                        {isSchoolCurrentlyConfirmed ? '✓' : '📋'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900">
                            {isSchoolCurrentlyConfirmed
                              ? `مشاركة مؤسسة «${effectiveSchoolName}» مؤكدة رسمياً (المرحلة 1 مكتملة)`
                              : `تأكيد مشاركة مؤسسة «${effectiveSchoolName}» في البطولة (المرحلة 1)`}
                          </h4>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            isSchoolCurrentlyConfirmed ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900 animate-pulse'
                          }`}>
                            {isSchoolCurrentlyConfirmed ? 'مؤكدة رسمياً ✓' : 'مطلوب التأكيد أولاً'}
                          </span>
                        </div>
                        <p className="text-[11px] mt-0.5 leading-relaxed text-slate-600">
                          {isSchoolCurrentlyConfirmed
                            ? 'تم إدراج مؤسستك حصرياً في الفروع المؤكدة أدناه. يمكنك إضافة وتعديل أسماء التلاميذ قبل حلول آخر أجل للتسجيل.'
                            : 'يمكنك تأكيد رغبة المؤسسة وتحديد الفروع الدقيقة التي ستشارك فيها فقط، ثم استكمال إضافة أسماء التلاميذ لاحقاً.'}
                        </p>
                        {isSchoolCurrentlyConfirmed && currentConfirmationRecord && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {getEffectiveConfirmedBranches(currentConfirmationRecord, true).map(b => (
                              <span
                                key={`${b.affiliationType}_${b.category}_${b.gender}`}
                                className={`text-[10px] font-black px-2.5 py-0.5 rounded-lg border ${
                                  b.affiliationType === 'club_affiliated'
                                    ? 'bg-amber-100 text-amber-950 border-amber-300'
                                    : 'bg-white text-emerald-900 border-emerald-300'
                                }`}
                              >
                                {b.affiliationType === 'club_affiliated' ? '🟡' : '⚪'} {formatBranchLabelAr(b, sport.id)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 justify-end">
                      {isSchoolCurrentlyConfirmed ? (
                        <>
                          <ConfirmedParticipationBadge
                            sportId={sport.id}
                            sportName={sport.name}
                            schoolId={userProfile?.schoolId}
                            schoolName={effectiveSchoolName}
                            variant="light"
                            label="مؤكدة ✓ (اضغط مطولاً 3ث للإلغاء)"
                            onClick={() => setIsConfirmModalOpen(true)}
                            onCancelSuccess={() => {
                              refreshConfirmations();
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (isDeadlineExpired) {
                                toast.error('عذراً، لقد انتهى أجل تسجيل وتعديل المشاركين في هذه البطولة 🔒');
                                return;
                              }
                              if (isProgrammed) {
                                setIsBulkRegisterOpen(true);
                              }
                            }}
                            disabled={isDeadlineExpired}
                            className={`px-4 py-2 rounded-xl text-xs font-black shadow-3xs transition-all cursor-pointer flex items-center gap-1.5 ${
                              isDeadlineExpired
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-75'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <span>{isDeadlineExpired ? 'انتهى أجل التسجيل 🔒' : 'تسجيل المشاركين (المرحلة 2) 👥'}</span>
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (isDeadlineExpired) {
                              toast.error('عذراً، لقد انتهى أجل التسجيل وتأكيد مشاركة المؤسسات في هذه البطولة 🔒');
                              return;
                            }
                            setIsConfirmModalOpen(true);
                          }}
                          disabled={isDeadlineExpired}
                          className={`px-5 py-2.5 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-2 ${
                            isDeadlineExpired
                              ? 'bg-slate-300 text-slate-500 cursor-not-allowed opacity-80'
                              : 'bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white shadow-emerald-700/20 active:scale-98 animate-pulse'
                          }`}
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isDeadlineExpired ? 'انتهى أجل التسجيل والتأكيد 🔒' : 'تأكيد مشاركة المؤسسة أولاً 📋'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Technical Committee Head & Rules Banner */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Tech Head info */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center font-bold shrink-0 border border-blue-100">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">رئيس اللجنة التقنية المكلف:</span>
                      <strong className="text-xs font-bold text-slate-800">
                        {techHead ? techHead.fullName : 'لم يتم التعيين بعد (المسؤول المركزي)'}
                      </strong>
                    </div>
                  </div>

                  {techHead?.phone && (
                    <a
                      href={`tel:${techHead.phone}`}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold font-mono flex items-center gap-1 transition-colors"
                      dir="ltr"
                    >
                      <Phone className="h-3 w-3 text-slate-500" />
                      <span>{techHead.phone}</span>
                    </a>
                  )}
                </div>

                {/* Participation limits & Rules */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center font-bold shrink-0 border border-purple-100">
                      <Settings className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block">سقف مشاركة المؤسسة التعليمية:</span>
                      <strong className="text-xs font-bold text-slate-800">
                        {sport.studentLimit && sport.studentLimit > 0
                          ? `${sport.studentLimit} تلميذ(ة) كأقصى حد`
                          : 'بدون سقف عددي محدّد'}
                      </strong>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => onProgramTournament(sport.id)}
                      className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Edit className="h-3.5 w-3.5" />
                      <span>تعديل الضوابط</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Unprogrammed Warning Banner if not programmed */}
              {!isProgrammed && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-3xs">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-amber-950">هذه البطولة في طور الإعداد حالياً</h4>
                      <p className="text-[11px] text-amber-800 mt-0.5">
                        لم يتم تأكيد برمجة الفئات والضوابط لهذه الرياضة نهائياً من طرف المسير المركزي أو رئيس اللجنة التقنية.
                      </p>
                    </div>
                  </div>

                  {canManage && (
                    <button
                      onClick={() => onProgramTournament(sport.id)}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
                    >
                      برمجة وإعداد البطولة الآن
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Guidance note inside main modal */}
          <div className="p-4 bg-blue-50/50 dark:bg-blue-950/40 border border-blue-200/70 dark:border-blue-800/60 rounded-2xl flex items-center justify-between gap-3 text-slate-700 dark:text-slate-300 shadow-3xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100/80 dark:bg-blue-900/80 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold shrink-0">
                ℹ️
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">استعراض وإدارة المؤسسات التعليمية المشاركة</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  يرجى الضغط على زر <strong className="text-blue-700 dark:text-blue-400">"دخول واستعراض المؤسسات المشاركة 🔓"</strong> داخل بطاقة الصنف المطلوب أعلاه للولوج إلى اللائحة التفصيلية وتنزيل لوائح المشاركة.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-800 dark:text-slate-100">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            🏆 بطولة إقليمية مدرسية بمديرية تاوريرت
          </div>

          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={() => handleExportCategoryExcel('ALL')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer shadow-xs"
              >
                <Download className="h-4 w-4" />
                <span>تصدير جميع الفئات (Excel)</span>
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

      {/* INNER MODAL: Dedicated branch viewing window for participating schools */}
      {activeBranchModal && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
          <div className="w-full max-w-5xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] my-auto">
            {/* Header */}
            <div className={`p-4 sm:p-5 text-white flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
              activeBranchModal === 'non_club'
                ? 'bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900'
                : 'bg-gradient-to-r from-amber-600 via-amber-700 to-yellow-800'
            }`}>
              <div className="flex items-center gap-3 w-full lg:w-auto">
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center text-lg sm:text-xl font-bold shadow-xs border shrink-0 ${
                  activeBranchModal === 'non_club'
                    ? 'bg-white/15 border-white/20 text-white'
                    : 'bg-white/20 border-white/30 text-white'
                }`}>
                  {activeBranchModal === 'non_club' ? '⚪' : '🟡'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white border border-white/20 truncate">
                      {activeBranchModal === 'non_club' ? 'صنف غير المنتمين للأندية' : 'صنف المنتمين للأندية والجمعيات'}
                    </span>
                    <span className="text-[10px] sm:text-xs text-white/80 font-bold">• {sport.name}</span>
                  </div>
                  <h3 className="text-base sm:text-lg md:text-xl font-black text-white mt-1 leading-tight">
                    {selectedBranchTournament
                      ? selectedSchoolNameForView
                        ? `مشاركات مؤسسة «${selectedSchoolNameForView}» في ${getBranchTournamentTitle(selectedBranchTournament, activeBranchModal)}`
                        : getBranchTournamentTitle(selectedBranchTournament, activeBranchModal)
                      : (activeBranchModal === 'non_club'
                          ? 'بطولات صنف غير المنتمين للأندية المبرمجة'
                          : 'بطولات صنف المنتمين للأندية والجمعيات المبرمجة')}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-start lg:justify-end shrink-0">
                {selectedBranchTournament && (() => {
                  const tCat = normalizeCategoryKey(selectedBranchTournament.ageCategory);
                  const tGender = selectedBranchTournament.gender;
                  const tAff = selectedBranchTournament.affiliationType || activeBranchModal || 'non_club';
                  
                  // Check if current user is admin or if the teacher's school is participating in this branch
                  const canRegisterInBranch = canManage || (isTeacherRole && effectiveSchoolName && (() => {
                    const hasStudentsInBranch = sportStudents.some(s =>
                      isUserSchool(s.schoolName || '') &&
                      (s.affiliationType || 'non_club') === tAff &&
                      normalizeCategoryKey(s.category) === tCat &&
                      (tGender === 'Both' || (tGender as string) === 'Mixed' || (s.gender || 'Male') === tGender)
                    );
                    if (hasStudentsInBranch) return true;

                    const schoolConf = getConfirmation(sport.id, effectiveSchoolName);
                    if (schoolConf && doesConfirmationMatchBranch(schoolConf, { affiliationType: tAff, category: tCat, gender: tGender })) {
                      const isW = DataService.isSchoolWithdrawn({
                        sportId: sport.id,
                        tournamentId: selectedBranchTournament.id,
                        ageCategory: tCat,
                        gender: tGender,
                        affiliationType: tAff
                      }, schoolConf.schoolId, schoolConf.schoolName);
                      return !isW;
                    }
                    return false;
                  })());

                  if (!canRegisterInBranch) return null;

                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          if (!isTeacherAllowedForSport) {
                            toast.error(`عذراً، بصفتك أستاذ سلك (${teacherCadreAr})، لا يمكنك التسجيل في هذه البطولة المخصصة لـ (${allowedSportLevelsAr})`);
                            return;
                          }
                          setPreselectedSchoolForRegister(selectedSchoolNameForView || undefined);
                          setIsRegisterModalOpen(true);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102 flex-1 sm:flex-initial justify-center ${
                          !isTeacherAllowedForSport
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>تسجيل واحد تلو الآخر</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (!isTeacherAllowedForSport) {
                            toast.error(`عذراً، بصفتك أستاذ سلك (${teacherCadreAr})، لا يمكنك التسجيل في هذه البطولة المخصصة لـ (${allowedSportLevelsAr})`);
                            return;
                          }
                          setPreselectedSchoolForRegister(selectedSchoolNameForView || undefined);
                          setIsBulkRegisterOpen(true);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102 flex-1 sm:flex-initial justify-center ${
                          !isTeacherAllowedForSport
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                        }`}
                        title="تسجيل عدة مشاركين دفعة واحدة لتوفير الوقت"
                      >
                        <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>تسجيل دفعة واحدة ⚡</span>
                      </button>
                    </>
                  );
                })()}

                {selectedSchoolNameForView && (
                  <button
                    type="button"
                    onClick={() => {
                      const firstCoach = schoolStudents.find(s => s.coachName);
                      setCoachNameInput(firstCoach?.coachName || '');
                      setCoachLeaseInput(firstCoach?.coachLeaseNumber || '');
                      setCoachPhoneInput(firstCoach?.coachPhone || '');
                      setCoachCategoryTarget('ALL');
                      setIsCoachModalOpen(true);
                    }}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs sm:text-sm font-black shadow-xs flex items-center gap-1.5 transition-all cursor-pointer hover:scale-102 flex-1 sm:flex-initial justify-center"
                    title="تعديل بيانات الأستاذ المؤطر لهذه المؤسسة عند الطوارئ"
                  >
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span>تعديل المؤطر</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveBranchModal(null);
                    setSelectedBranchTournament(null);
                    setSelectedSchoolNameForView(null);
                  }}
                  className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer flex items-center justify-center"
                  title="الرجوع للأصناف الرئيسية"
                >
                  <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/60 space-y-4">
              {selectedBranchTournament === null ? (
                /* LEVEL 2: Tournaments List inside this Classification Branch */
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-3xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-black text-slate-800 flex items-center gap-2">
                        <span>🏆 بطولات هذا الصنف المبرمجة ({displayBranchTournaments.length})</span>
                      </h4>
                      <p className="text-xs text-slate-500 mt-0.5">
                        اختر البطولة المطلوبة للولوج إلى استعراض المؤسسات والفرق المشاركة بها وتنزيل لوائح المشاركة.
                      </p>
                    </div>

                    {canManage && (
                      <button
                        onClick={() => onProgramTournament(sport.id)}
                        className="px-3.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>إعداد وإضافة بطولات ⚙️</span>
                      </button>
                    )}
                  </div>

                  {/* Grid of programmed tournaments under this branch */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayBranchTournaments.map((t) => {
                      const tCat = normalizeCategoryKey(t.ageCategory);
                      const tGender = t.gender;
                      const tAff = t.affiliationType || activeBranchModal || 'non_club';

                      const tourneyStudents = sportStudents.filter(s =>
                        (s.affiliationType || 'non_club') === tAff &&
                        normalizeCategoryKey(s.category) === tCat &&
                        (tGender === 'Both' || (tGender as string) === 'Mixed' || (s.gender || 'Male') === tGender)
                      );
                      const schoolNamesSet = new Set<string>(tourneyStudents.map(s => String(s.schoolName || '').trim()).filter(Boolean));
                      getConfirmedSchoolsForSport(sport.id).forEach(conf => {
                        if (!conf?.schoolName) return;
                        if (doesConfirmationMatchBranch(conf, { affiliationType: tAff, category: tCat, gender: tGender })) {
                          const isW = DataService.isSchoolWithdrawn({
                            sportId: sport.id,
                            tournamentId: t.id,
                            ageCategory: tCat,
                            gender: tGender,
                            affiliationType: tAff
                          }, conf.schoolId, conf.schoolName);
                          if (!isW) {
                            schoolNamesSet.add(conf.schoolName.trim());
                          }
                        }
                      });
                      const tourneySchoolsCount = schoolNamesSet.size;
                      const isOwnSchoolInBranch = isTeacherRole && effectiveSchoolName
                        ? Array.from(schoolNamesSet).some(sName => isUserSchool(sName))
                        : false;

                      return (
                        <div
                          key={t.id}
                          className={`bg-white border-2 rounded-2xl p-5 shadow-3xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group min-h-[210px] ${
                            isOwnSchoolInBranch
                              ? 'border-emerald-400 ring-2 ring-emerald-500/20'
                              : tAff === 'club_affiliated'
                              ? 'border-amber-200/90 hover:border-amber-500'
                              : 'border-slate-200/90 hover:border-blue-500'
                          }`}
                          onClick={() => {
                            setSelectedBranchTournament(t);
                            setSelectedCatId(normalizeCategoryKey(t.ageCategory));
                            setSelectedGender(t.gender as any);
                            setSelectedAffiliation((t.affiliationType || activeBranchModal || 'non_club') as 'non_club' | 'club_affiliated');
                            setSelectedSchoolNameForView(null);
                          }}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className={`text-[11px] font-black px-3 py-1 rounded-full border flex items-center gap-1.5 shadow-3xs ${
                                tAff === 'club_affiliated'
                                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                                  : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}>
                                <span>🏆</span>
                                <span>{getDistinctCategoryLabel(t.ageCategory, t.gender)} ({t.ageCategory})</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                {isOwnSchoolInBranch && (
                                  <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                                    ✓ مؤسستي مشاركة
                                  </span>
                                )}
                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                                  t.gender === 'Female' ? 'bg-pink-50 text-pink-700 border-pink-200' : 
                                  tAff === 'club_affiliated' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-blue-50 text-blue-700 border-blue-200'
                                }`}>
                                  {t.gender === 'Female' ? '👧 إناث' : t.gender === 'Male' ? '👦 ذكور' : '👫 ذكور وإناث'}
                                </span>
                              </div>
                            </div>

                            <h4 className={`text-base font-black transition-colors ${
                              tAff === 'club_affiliated' ? 'text-amber-900 group-hover:text-amber-700' : 'text-slate-800 group-hover:text-blue-700'
                            }`}>
                              {getBranchTournamentTitle(t, activeBranchModal)}
                            </h4>

                            <p className="text-xs text-slate-500 font-medium">
                              السنوات المعنية: <strong className="font-mono text-slate-700">{getCategoryYearsLabel(t.ageCategory, activeSeason, sport.id)}</strong>
                            </p>

                            <div className="flex items-center gap-2 text-xs font-bold pt-2.5 border-t border-slate-100 text-slate-600">
                              <span className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200/80">🏫 المؤسسات: {tourneySchoolsCount}</span>
                              <span className={`px-2.5 py-1 rounded-lg border ${
                                tAff === 'club_affiliated' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-800 border-blue-200'
                              }`}>👥 المشاركون: {tourneyStudents.length}</span>
                            </div>
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBranchTournament(t);
                                setSelectedCatId(normalizeCategoryKey(t.ageCategory));
                                setSelectedGender(t.gender as any);
                                setSelectedSchoolNameForView(null);
                              }}
                              className={`w-full py-2.5 px-4 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2 group-hover:scale-102 ${
                                tAff === 'club_affiliated'
                                  ? 'bg-amber-500 hover:bg-amber-600'
                                  : 'bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              <span>دخول واستعراض المؤسسات المشاركة 🔓</span>
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (selectedSchoolNameForView === null || !canManageSchool(selectedSchoolNameForView)) ? (
                /* LEVEL 3A: Participating Schools View for Selected Tournament */
                <div className="space-y-4">
                  {/* Tournament context bar with Back button */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-3xs">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedBranchTournament(null);
                          setSelectedSchoolNameForView(null);
                          setSelectedCatId('ALL');
                          setSelectedGender('ALL');
                        }}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-300"
                        title="الرجوع للائحة بطولات هذا الصنف"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>← الرجوع لبطولات هذا الصنف</span>
                      </button>

                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">البطولة المختارة:</span>
                        <h4 className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                          <span>🏆 {getBranchTournamentTitle(selectedBranchTournament, activeBranchModal)}</span>
                          <span className="text-[10px] font-mono text-slate-500">
                            ({getCategoryYearsLabel(selectedBranchTournament.ageCategory, activeSeason, sport.id)})
                          </span>
                        </h4>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                        عدد المؤسسات: {participatingSchools.length}
                      </span>
                      {canManage && (
                        <button
                          onClick={() => handleExportCategoryExcel('ALL')}
                          className="px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تصدير Excel</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Search bar */}
                  <div className="flex items-center gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-3xs">
                    <Search className="h-4 w-4 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="ابحث عن مؤسسة تعليمية في هذه البطولة..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full text-xs border-0 focus:ring-0 focus:outline-none text-slate-800 placeholder-slate-400"
                    />
                  </div>

                  {/* Grid of schools */}
                  {participatingSchools.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {participatingSchools.map((sch) => {
                        const isOwn = isUserSchool(sch.name);
                        const canManageThis = canManageSchool(sch.name);

                        return (
                          <div
                            key={sch.name}
                            onClick={() => {
                              if (canManageThis) {
                                setSelectedSchoolNameForView(sch.name);
                              }
                            }}
                            className={`rounded-2xl p-4 sm:p-5 shadow-3xs transition-all flex flex-col justify-between group border-2 ${
                              canManageThis ? 'cursor-pointer hover:shadow-md min-h-[220px]' : 'cursor-default min-h-[150px]'
                            } ${
                              isOwn
                                ? 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white border-blue-400 ring-2 ring-blue-500/30 shadow-md'
                                : canManageThis
                                ? 'bg-white border-slate-200/90 hover:border-blue-400 text-slate-800'
                                : 'bg-white/95 border-slate-200/80 text-slate-800'
                            }`}
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold border shrink-0 text-lg ${
                                    isOwn
                                      ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                                      : 'bg-blue-50 text-blue-600 border-blue-100'
                                  }`}>
                                    🏫
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <h4 className={`text-sm font-black leading-tight transition-colors ${
                                        isOwn
                                          ? 'text-white group-hover:text-blue-300'
                                          : canManageThis
                                          ? 'text-slate-900 group-hover:text-blue-700'
                                          : 'text-slate-900'
                                      }`}>
                                        {sch.name}
                                      </h4>
                                      {isOwn && (
                                        <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-500 text-white shadow-3xs flex items-center gap-1">
                                          <span>⭐</span>
                                          <span>مؤسستي التابعة</span>
                                        </span>
                                      )}
                                    </div>
                                    <span className={`inline-flex items-center text-[10px] font-black px-2 py-0.5 rounded-md border ${
                                      isOwn
                                        ? 'bg-white/10 text-blue-200 border-white/20'
                                        : activeBranchModal === 'non_club'
                                          ? 'bg-blue-50/50 text-blue-700 border-blue-100'
                                          : 'bg-amber-50/50 text-amber-700 border-amber-100'
                                    }`}>
                                      {activeBranchModal === 'non_club' ? 'صنف: غير المنتمين للأندية' : 'صنف: المنتمين للأندية والجمعيات'}
                                    </span>
                                  </div>
                                </div>
                                {canManageThis ? (
                                  <span className={`text-[11px] font-black px-3 py-1 rounded-full border shrink-0 whitespace-nowrap shadow-3xs ${
                                    isOwn
                                      ? 'bg-blue-600/30 text-blue-200 border-blue-400/40'
                                      : 'bg-blue-50 text-blue-800 border-blue-200'
                                  }`}>
                                    {sch.totalCount} مشارك(ة)
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-black px-2.5 py-1 rounded-full border shrink-0 whitespace-nowrap bg-emerald-50 text-emerald-800 border-emerald-200 shadow-3xs">
                                    ✓ مؤسسة مشاركة
                                  </span>
                                )}
                              </div>

                              {/* Detailed breakdown & PDF category buttons ONLY visible to own school or admins */}
                              {canManageThis && (
                                <>
                                  <div className="flex gap-2 text-[11px] font-bold">
                                    {(!selectedBranchTournament || (selectedBranchTournament.gender !== 'Female' && selectedBranchTournament.gender !== 'female')) && selectedGender !== 'Female' && (
                                      <span className={`px-2.5 py-1 rounded-lg border ${
                                        isOwn
                                          ? 'bg-white/10 text-blue-200 border-white/15'
                                          : 'bg-blue-50/70 text-blue-800 border-blue-200/70'
                                      }`}>
                                        👦 ذكور: {sch.maleCount}
                                      </span>
                                    )}
                                    {(!selectedBranchTournament || (selectedBranchTournament.gender !== 'Male' && selectedBranchTournament.gender !== 'male')) && selectedGender !== 'Male' && (
                                      <span className={`px-2.5 py-1 rounded-lg border ${
                                        isOwn
                                          ? 'bg-white/10 text-pink-200 border-white/15'
                                          : 'bg-pink-50/70 text-pink-800 border-pink-200/70'
                                      }`}>
                                        👧 إناث: {sch.femaleCount}
                                      </span>
                                    )}
                                  </div>

                                  <div className={`flex flex-wrap gap-2 pt-2.5 border-t ${isOwn ? 'border-white/10' : 'border-slate-100'}`}>
                                    {sch.genderCategories.map((gCat) => (
                                      <button
                                        key={gCat.key}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPdfSchoolName(sch.name);
                                          setPdfPreselectedCat(gCat.category);
                                          setPdfPreselectedGender(gCat.gender);
                                          setIsPdfModalOpen(true);
                                        }}
                                        className={`text-xs font-black px-3 py-1 rounded-xl border flex items-center gap-1.5 shadow-3xs transition-all hover:scale-105 cursor-pointer hover:shadow-xs ${
                                          isOwn
                                            ? (gCat.gender === 'Female'
                                              ? 'bg-pink-500/20 text-pink-200 border-pink-400/30 hover:bg-pink-500/30'
                                              : 'bg-blue-500/20 text-blue-200 border-blue-400/30 hover:bg-blue-500/30')
                                            : (gCat.gender === 'Female'
                                              ? 'bg-pink-50 text-pink-800 border-pink-200 hover:bg-pink-100'
                                              : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100')
                                        }`}
                                        title={`معاينة لائحة المشاركة لـ ${gCat.label}`}
                                      >
                                        <span>{gCat.gender === 'Female' ? '👧' : '👦'}</span>
                                        <span>{gCat.label}</span>
                                        <span className="text-[10px] font-black opacity-75 font-mono">({gCat.count})</span>
                                      </button>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>

                            <div className={`mt-4 pt-3 border-t flex flex-wrap items-center justify-between gap-2 ${
                              isOwn ? 'border-white/10' : 'border-slate-100'
                            }`}>
                              {canManageThis ? (
                                <>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isTeacherAllowedForSport) {
                                          toast.error(`عذراً، أنت مسجل كأستاذ سلك (${teacherCadreAr})، ولا يمكنك التسجيل في هذه البطولة المخصصة لـ (${allowedSportLevelsAr})`);
                                          return;
                                        }
                                        setPreselectedSchoolForRegister(sch.name);
                                        setIsRegisterModalOpen(true);
                                      }}
                                      className="px-2.5 py-1.5 text-xs font-bold border rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-3xs hover:scale-102 text-white bg-emerald-600 hover:bg-emerald-700 border-emerald-500"
                                      title={`إضافة مشارك جديد لمؤسسة ${sch.name}`}
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>إضافة مشارك</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSchoolToWithdraw({ schoolName: sch.name, studentCount: sch.totalCount });
                                      }}
                                      className="px-2 py-1.5 text-xs font-bold border rounded-xl flex items-center gap-1 transition-all cursor-pointer shadow-3xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border-red-200"
                                      title={canManage ? `سحب مشاركة مؤسسة ${sch.name} من فرع هذه البطولة` : `سحب مشاركة ثانويتك من فرع هذه البطولة`}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                      <span>سحب المشاركة</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setPdfSchoolName(sch.name);
                                        
                                        let finalCat = 'ALL';
                                        if (selectedCatId && selectedCatId !== 'ALL') {
                                          finalCat = selectedCatId;
                                        } else if (sch.genderCategories.length > 0) {
                                          finalCat = sch.genderCategories[0].category;
                                        }
                                        
                                        let finalGender: 'ALL' | 'Male' | 'Female' = 'ALL';
                                        if (selectedGender && selectedGender !== 'ALL') {
                                          finalGender = selectedGender;
                                        } else if (sch.genderCategories.length > 0) {
                                          finalGender = sch.genderCategories[0].gender;
                                        }
                                        
                                        setPdfPreselectedCat(finalCat);
                                        setPdfPreselectedGender(finalGender);
                                        setIsPdfModalOpen(true);
                                      }}
                                      className={`px-2.5 py-1.5 text-xs font-bold border rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                                        isOwn
                                          ? 'text-sky-200 bg-sky-950/60 hover:bg-sky-900 border-sky-400/30'
                                          : 'text-sky-700 bg-sky-50 hover:bg-sky-100 border-sky-200'
                                      }`}
                                      title="معاينة لائحة المشاركة"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                      <span>لائحة المشاركة</span>
                                    </button>
                                  </div>

                                  <div className={`flex items-center gap-1 text-[11px] font-black ${
                                    isOwn ? 'text-blue-300 group-hover:text-blue-200' : 'text-blue-600 group-hover:text-blue-700'
                                  }`}>
                                    <span>دخول واستعراض</span>
                                    <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-1 transition-transform" />
                                  </div>
                                </>
                              ) : (
                                <span className="text-[10.5px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5 w-full justify-center">
                                  <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                  <span>مؤسسة مشاركة (اللوائح التفصيلية خاصة بمؤسستك فقط)</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-12 text-center bg-white border border-slate-200 rounded-3xl text-slate-400 space-y-3">
                      <Building2 className="h-12 w-12 mx-auto text-slate-300" />
                      <p className="text-sm font-bold text-slate-700">لا توجد مؤسسات تعليمية مسجلة في هذه البطولة حالياً</p>
                      {(() => {
                        if (!selectedBranchTournament) return null;
                        const tCat = normalizeCategoryKey(selectedBranchTournament.ageCategory);
                        const tGender = selectedBranchTournament.gender;
                        const tAff = selectedBranchTournament.affiliationType || activeBranchModal || 'non_club';
                        const canRegister = canManage || (isTeacherRole && effectiveSchoolName && (() => {
                          const schoolConf = getConfirmation(sport.id, effectiveSchoolName);
                          return schoolConf && doesConfirmationMatchBranch(schoolConf, { affiliationType: tAff, category: tCat, gender: tGender });
                        })());

                        if (!canRegister) return null;

                        return (
                          <button
                            type="button"
                            onClick={() => {
                              if (!isTeacherAllowedForSport) {
                                toast.error(`عذراً، أنت مسجل كأستاذ سلك (${teacherCadreAr})، ولا يمكنك التسجيل في هذه البطولة المخصصة لـ (${allowedSportLevelsAr})`);
                                return;
                              }
                              setPreselectedSchoolForRegister(undefined);
                              setIsRegisterModalOpen(true);
                            }}
                            className={`px-4 py-2 font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                              !isTeacherAllowedForSport
                                ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <Plus className="w-4 h-4" />
                            <span>تسجيل مشاركين</span>
                          </button>
                        );
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                /* Selected School Drilldown inside Branch */
                <div className="space-y-4 animate-in fade-in duration-200">
                  {/* School header bar */}
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedSchoolNameForView(null)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                        title="الرجوع للائحة المؤسسات بهذا الصنف"
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>رجوع للمؤسسات</span>
                      </button>

                      <div>
                        <span className="text-[10px] text-slate-400 font-bold block">مشاركات المؤسسة التعليمية:</span>
                        <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                          <span>{selectedSchoolNameForView}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            activeBranchModal === 'non_club'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}>
                            {activeBranchModal === 'non_club' ? 'غير المنتمين للأندية' : 'المنتمون للأندية'}
                          </span>
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1.5 rounded-xl">
                        إجمالي المشاركين: {schoolStudents.length} تلميذ(ة)
                      </span>

                      {selectedSchoolNameForView && canManageSchool(selectedSchoolNameForView) && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const firstCoach = schoolStudents.find(s => s.coachName);
                              setCoachNameInput(firstCoach?.coachName || '');
                              setCoachLeaseInput(firstCoach?.coachLeaseNumber || '');
                              setCoachPhoneInput(firstCoach?.coachPhone || '');
                              setCoachCategoryTarget('ALL');
                              setIsCoachModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                            title="تعديل بيانات الأستاذ المؤطر لهذه المؤسسة عند الطوارئ"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>تعديل المؤطر</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSchoolToWithdraw({ schoolName: selectedSchoolNameForView, studentCount: schoolStudents.length });
                            }}
                            className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                            title={canManage ? `سحب مشاركة مؤسسة ${selectedSchoolNameForView} من فرع هذه البطولة` : `سحب مشاركة ثانويتك من فرع هذه البطولة`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>سحب مشاركة المؤسسة</span>
                          </button>
                        </>
                      )}

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleExportCategoryExcel('ALL')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تصدير Excel</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setPdfSchoolName(selectedSchoolNameForView);
                          
                          // Determine preselected category
                          let finalCat = 'ALL';
                          if (selectedCatId && selectedCatId !== 'ALL') {
                            finalCat = selectedCatId;
                          } else {
                            const firstGroup: any = Object.values(groupedSchoolStudents)[0];
                            if (firstGroup) finalCat = firstGroup.category;
                          }
                          
                          // Determine preselected gender
                          let finalGender: 'ALL' | 'Male' | 'Female' = 'ALL';
                          if (selectedGender && selectedGender !== 'ALL') {
                            finalGender = selectedGender;
                          } else {
                            const firstGroup: any = Object.values(groupedSchoolStudents)[0];
                            if (firstGroup) finalGender = firstGroup.gender;
                          }
                          
                          setPdfPreselectedCat(finalCat);
                          setPdfPreselectedGender(finalGender);
                          setIsPdfModalOpen(true);
                        }}
                        className="px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                        title="معاينة وعرض لائحة المشاركة الرسمية للطباعة والتحميل"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>عرض لائحة المشاركة</span>
                      </button>
                    </div>
                  </div>

                  {/* Coach info bar */}
                  {(() => {
                    const explicitCoaches = Array.from(new Set(schoolStudents.map(s => s.coachName).filter(Boolean))) as string[];
                    const isSchoolMatchingTeacher = isTeacherRole && userProfile?.workLocation && (
                      !selectedSchoolNameForView ||
                      userProfile.workLocation.trim().toLowerCase() === selectedSchoolNameForView.trim().toLowerCase() ||
                      userProfile.workLocation.includes(selectedSchoolNameForView) ||
                      selectedSchoolNameForView.includes(userProfile.workLocation)
                    );
                    const isDefaultFromUser = explicitCoaches.length === 0 && (isSchoolMatchingTeacher || isTeacherRole) && !!userProfile?.fullName;
                    const displayedCoaches = explicitCoaches.length > 0
                      ? explicitCoaches
                      : (isDefaultFromUser && userProfile?.fullName ? [userProfile.fullName] : []);
                    const displayedCoachLease = schoolStudents.find(s => s.coachLeaseNumber)?.coachLeaseNumber || (isDefaultFromUser ? userProfile?.leaseNumber : '');
                    const displayedCoachPhone = schoolStudents.find(s => s.coachPhone)?.coachPhone || (isDefaultFromUser ? userProfile?.phone : '');

                    return (
                      <div className="bg-gradient-to-r from-indigo-50/90 to-blue-50/90 p-3.5 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-3 shadow-3xs">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-xs shrink-0 text-lg">
                            👨‍🏫
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-indigo-700 block">الأستاذ(ة) المؤطر(ة) للمؤسسة:</span>
                            {displayedCoaches.length > 0 ? (
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-0.5 text-xs">
                                <span className="font-black text-slate-900">
                                  {displayedCoaches.join('، ')}
                                </span>
                                {displayedCoachLease && (
                                  <span className="text-slate-600 font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                                    رقم التأجير: {displayedCoachLease}
                                  </span>
                                )}
                                {displayedCoachPhone && (
                                  <span className="text-slate-600 font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-indigo-100">
                                    الهاتف: {displayedCoachPhone}
                                  </span>
                                )}
                                {isDefaultFromUser && (
                                  <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100/80 px-2 py-0.5 rounded-md">
                                    (تلقائي - صاحب الحساب)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-500">لم يتم تعيين أستاذ مؤطر بعد لهذه المؤسسة</span>
                            )}
                          </div>
                        </div>

                        {selectedSchoolNameForView && canManageSchool(selectedSchoolNameForView) && (
                          <button
                            type="button"
                            onClick={() => {
                              const firstCoach = schoolStudents.find(s => s.coachName);
                              setCoachNameInput(firstCoach?.coachName || (isDefaultFromUser && userProfile?.fullName ? userProfile.fullName : ''));
                              setCoachLeaseInput(firstCoach?.coachLeaseNumber || (isDefaultFromUser && userProfile?.leaseNumber ? userProfile.leaseNumber : ''));
                              setCoachPhoneInput(firstCoach?.coachPhone || (isDefaultFromUser && userProfile?.phone ? userProfile.phone : ''));
                              setCoachCategoryTarget('ALL');
                              setIsCoachModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                            title="تعديل بيانات الأستاذ المؤطر لهذه المؤسسة عند الطوارئ"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            <span>تعديل بيانات المؤطر</span>
                          </button>
                        )}
                      </div>
                    );
                  })()}

                  {/* Categories Breakdown and Student Tables - Distinct by category and gender */}
                  {Object.keys(groupedSchoolStudents).length > 0 ? (
                    <div className="space-y-4">
                      {(Object.entries(groupedSchoolStudents) as [string, { category: string; gender: 'Male' | 'Female'; label: string; students: Student[] }][]).map(([grpKey, grp]) => {
                        const isFemale = grp.gender === 'Female';
                        return (
                          <div
                            key={grpKey}
                            className={`bg-white rounded-2xl border overflow-hidden shadow-3xs ${
                              isFemale ? 'border-pink-200/90' : 'border-blue-200/90'
                            }`}
                          >
                            <div className={`p-3 border-b flex flex-wrap items-center justify-between gap-2 ${
                              isFemale ? 'bg-pink-50/70 border-pink-100' : 'bg-blue-50/70 border-blue-100'
                            }`}>
                              <span className="text-xs sm:text-sm font-black text-slate-900 flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${isFemale ? 'bg-pink-600' : 'bg-blue-600'}`}></span>
                                <span>{isFemale ? '👧' : '👦'}</span>
                                <span>الفئة الرياضية: <strong className={isFemale ? 'text-pink-800 text-sm' : 'text-blue-800 text-sm'}>{grp.label} ({isFemale ? 'إناث' : 'ذكور'})</strong></span>
                              </span>
                              
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] font-black px-3 py-0.5 rounded-full border ${
                                  isFemale ? 'bg-pink-100 text-pink-800 border-pink-200' : 'bg-blue-100 text-blue-800 border-blue-200'
                                }`}>
                                  {grp.students.length} تلميذ(ة) مشارك
                                </span>

                                {selectedSchoolNameForView && canManageSchool(selectedSchoolNameForView) && (
                                  <button
                                    type="button"
                                    onClick={() => setCategoryToDelete({
                                      category: grp.category,
                                      gender: grp.gender,
                                      label: grp.label,
                                      count: grp.students.length
                                    })}
                                    className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-3xs"
                                    title="حذف هذه الفئة وجميع المشاركين المسجلين بها"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>حذف الفئة</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="overflow-x-auto">
                              <table className="w-full text-center text-xs">
                                <thead className="bg-slate-50/70 text-slate-600 font-bold border-b border-slate-200">
                                  <tr>
                                    <th className="p-3 text-center w-12">#</th>
                                    <th className="p-3">الاسم والنسب</th>
                                    <th className="p-3">رقم مسار</th>
                                    <th className="p-3">الجنس</th>
                                    <th className="p-3">تاريخ الازدياد</th>
                                    {sport.id === 'athletics' && <th className="p-3">التخصص الفرعي</th>}
                                    <th className="p-3 text-center w-24">إجراءات</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-slate-800">
                                  {grp.students.map((stud, idx) => (
                                    <tr key={stud.id || `st-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="p-3 text-center font-bold text-slate-400">{idx + 1}</td>
                                      <td className="p-3 font-bold text-slate-900">{stud.fullName}</td>
                                      <td className="p-3 font-mono text-[11px] text-slate-600">{stud.massarNumber || '-'}</td>
                                      <td className="p-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          stud.gender === 'Female' ? 'bg-pink-50 text-pink-700' : 'bg-blue-50 text-blue-700'
                                        }`}>
                                          {stud.gender === 'Female' ? 'أنثى' : 'ذكر'}
                                        </span>
                                      </td>
                                      <td className="p-3 font-medium text-slate-600">{stud.birthDate || 'غير متوفر'}</td>
                                      {sport.id === 'athletics' && (
                                        <td className="p-3 font-bold text-purple-700">{stud.athleticsSpecialty || 'عام'}</td>
                                      )}
                                      <td className="p-3 text-center">
                                        {canManageThisStudent(stud) ? (
                                          <div className="flex items-center justify-center gap-1.5">
                                            <button
                                              type="button"
                                              onClick={() => setEditingStudent(stud)}
                                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                              title="تعديل بيانات المشارك(ة)"
                                            >
                                              <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => setStudentToDelete(stud)}
                                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                              title="حذف هذا المشارك(ة)"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex items-center justify-center">
                                            <span
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-bold border border-slate-200"
                                              title={`مسجل تحت تأطير أستاذ آخر (${stud.coachName || 'مؤطر آخر'})`}
                                            >
                                              <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                                              <span className="truncate max-w-[70px]">{stud.coachName || 'مؤطر آخر'}</span>
                                            </span>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl text-slate-400">
                      <p className="text-xs font-bold text-slate-600">لا توجد مشاركات مسجلة لهذه المؤسسة في هذا الصنف</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer of Inner Modal */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <div className="text-xs text-slate-500 font-medium">
                {selectedSchoolNameForView ? `مؤسسة: ${selectedSchoolNameForView}` : 'نافذة المؤسسات المشاركة في الصنف'}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveBranchModal(null);
                  setSelectedSchoolNameForView(null);
                }}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <span>العودة للأصناف الرئيسية</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Coach Modal */}
      {isCoachModalOpen && (
        <div className="fixed inset-0 z-70 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 bg-gradient-to-r from-indigo-700 to-blue-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center text-lg">
                  👨‍🏫
                </div>
                <div>
                  <h3 className="text-base font-black">إضافة وتعيين أستاذ مؤطر</h3>
                  <p className="text-[11px] text-white/80">{selectedSchoolNameForView}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCoachModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCoach} className="p-5 space-y-4">
              {matchingSchoolTeachers.length > 0 && (
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    اختيار سريع من أساتذة المؤسسة المسجلين:
                  </label>
                  <select
                    onChange={(e) => {
                      const tch = matchingSchoolTeachers.find(t => t.id === e.target.value);
                      if (tch) {
                        setCoachNameInput(tch.fullName);
                        setCoachLeaseInput(tch.leaseNumber || '');
                        setCoachPhoneInput(tch.phone || '');
                      }
                    }}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="">-- اختر أستاذ من المؤسسة أو املأ يدوياً --</option>
                    {matchingSchoolTeachers.map(tch => (
                      <option key={tch.id} value={tch.id}>
                        {tch.fullName} {tch.leaseNumber ? `(رقم التأجير: ${tch.leaseNumber})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  اسم الأستاذ(ة) المؤطر(ة) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={coachNameInput}
                  onChange={(e) => setCoachNameInput(e.target.value)}
                  placeholder="الاسم والنسب الكامل للأستاذ"
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    رقم التأجير
                  </label>
                  <input
                    type="text"
                    value={coachLeaseInput}
                    onChange={(e) => setCoachLeaseInput(e.target.value)}
                    placeholder="رقم التأجير"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    value={coachPhoneInput}
                    onChange={(e) => setCoachPhoneInput(e.target.value)}
                    placeholder="06XXXXXXXX"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold font-mono text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  تطبيق المؤطر على:
                </label>
                <select
                  value={coachCategoryTarget}
                  onChange={(e) => setCoachCategoryTarget(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="ALL">جميع الفئات المسجلة لهذه المؤسسة</option>
                  {(Object.entries(groupedSchoolStudents) as [string, { category: string; gender: 'Male' | 'Female'; label: string; students: Student[] }][]).map(([grpKey, grp]) => (
                    <option key={grpKey} value={grpKey}>
                      فئة {grp.label} ({grp.gender === 'Female' ? 'إناث' : 'ذكور'}) - {grp.students.length} مشارك
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCoachModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCoach}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{isSubmittingCoach ? 'جاري الحفظ...' : 'حفظ بيانات المؤطر'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Register Student Modal */}
      <RegisterStudentModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setPreselectedSchoolForRegister(undefined);
        }}
        sport={sport}
        preselectedSchoolName={preselectedSchoolForRegister}
        preselectedCategory={effectivePreselectedCategory}
        preselectedGender={effectivePreselectedGender}
        preselectedAffiliation={effectivePreselectedAffiliation}
        schools={schools}
        registrationDeadline={currentDeadline}
        tournaments={allowedTournamentsForTeacher}
        onRegistered={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {/* Sport Bulk Register Modal */}
      {isBulkRegisterOpen && (
        <SportBulkRegisterModal
          isOpen={isBulkRegisterOpen}
          onClose={() => {
            setIsBulkRegisterOpen(false);
            setPreselectedSchoolForRegister(undefined);
          }}
          sport={sport}
          schools={schools}
          preselectedSchoolName={preselectedSchoolForRegister}
          preselectedCategory={effectivePreselectedCategory}
          preselectedGender={effectivePreselectedGender}
          allExistingStudents={localStudents}
          tournaments={allowedTournamentsForTeacher}
          onRegistered={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {/* Edit Deadline Modal */}
      <EditDeadlineModal
        isOpen={isEditDeadlineOpen}
        onClose={() => setIsEditDeadlineOpen(false)}
        sport={sport}
        tournaments={tournaments}
        onUpdated={() => {
          if (onRefreshData) onRefreshData();
        }}
      />
      
      {isPdfModalOpen && currentSchoolForPdf && (
        <ParticipationFormPdfModal
          isOpen={isPdfModalOpen}
          onClose={() => {
            setIsPdfModalOpen(false);
            setPdfSchoolName(null);
          }}
          sport={sport}
          schoolName={currentSchoolForPdf}
          students={sportStudents.filter(s => s.schoolName === currentSchoolForPdf)}
          season={activeSeason}
          preselectedCategory={pdfPreselectedCat}
          preselectedGender={pdfPreselectedGender}
          preselectedAffiliation={activeBranchModal || 'ALL'}
        />
      )}

      {/* Delete Student Confirmation Modal */}
      {studentToDelete && (
        <div className="fixed inset-0 z-80 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-red-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تأكيد حذف المشارك</h3>
                  <p className="text-[11px] text-white/80">{studentToDelete.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs space-y-2 text-red-900">
                <p className="font-black text-sm text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>تنبيه: هل أنت متأكد من حذف هذا المشارك؟</span>
                </p>
                <div className="bg-white p-3 rounded-xl border border-red-100 text-xs space-y-1 text-slate-800 font-medium">
                  <div><strong>الاسم:</strong> {studentToDelete.fullName}</div>
                  {studentToDelete.massarNumber && <div><strong>رقم مسار:</strong> {studentToDelete.massarNumber}</div>}
                  <div><strong>المؤسسة:</strong> {studentToDelete.schoolName}</div>
                  <div><strong>الفئة:</strong> {studentToDelete.category} ({studentToDelete.gender === 'Female' ? 'إناث' : 'ذكور'})</div>
                </div>
                <p className="text-[11px] text-red-600 font-bold">
                  لا يمكن التراجع عن هذه العملية بعد التأكيد.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingStudent}
                  onClick={() => setStudentToDelete(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isDeletingStudent}
                  onClick={confirmDeleteStudent}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingStudent ? 'جاري الحذف...' : 'تأكيد الحذف'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {editingStudent && (
        <div className="fixed inset-0 z-80 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Edit className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تعديل بيانات المشارك(ة)</h3>
                  <p className="text-[11px] text-white/80">{editingStudent.schoolName || selectedSchoolNameForView}</p>
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
                    <h4 className="text-xs font-bold text-slate-800">صورة المشارك(ة)</h4>
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
                <label className="block text-slate-700 font-bold mb-1">الاسم الكامل للمشارك(ة) *</label>
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
                  <label className="block text-slate-700 font-bold mb-1">رقم مسار</label>
                  <input
                    type="text"
                    value={editMassarNumber}
                    onChange={(e) => setEditMassarNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all uppercase"
                    placeholder="مثال: G123456789"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">الجنس *</label>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>مقفل (ذكور فقط)</span>
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between cursor-not-allowed">
                    <span className="flex items-center gap-1.5">
                      <span>👦</span>
                      <span>ذكر (Male)</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> مقفل
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-bold">الفئة العمرية *</label>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                      <Lock className="w-3 h-3" />
                      <span>مقفل (البراعم فقط)</span>
                    </span>
                  </div>
                  <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between cursor-not-allowed">
                    <span className="font-extrabold text-blue-900">{editCategory || 'U12'} - البراعم</span>
                    <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                      <Lock className="w-3 h-3" /> مقفل
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">صنف المشاركة والانتماء الرياضي *</label>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>مقفل (لا منتمي فقط)</span>
                  </span>
                </div>
                <div className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between cursor-not-allowed">
                  <span className="flex items-center gap-1.5">
                    <span>⚪</span>
                    <span>غير منخرطين بالجامعات (لا منتمي - مشاركة مدرسية فقط)</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" /> مقفل
                  </span>
                </div>
              </div>

              {sport?.id === 'athletics' && (
                <div>
                  <label className="block text-slate-700 font-bold mb-1">التخصص في ألعاب القوى</label>
                  <input
                    type="text"
                    value={editAthleticsSpecialty}
                    onChange={(e) => setEditAthleticsSpecialty(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                    placeholder="مثال: 100م، دفع الجلة، الوثب العالي..."
                  />
                </div>
              )}

              {/* Coach details */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-3">
                <span className="text-[11px] font-black text-indigo-900 block">
                  👨‍🏫 بيانات الأستاذ المؤطر (المسؤول)
                </span>
                <div>
                  <label className="block text-slate-700 font-bold mb-1">اسم ونسب الأستاذ المؤطر</label>
                  <input
                    type="text"
                    value={editCoachName}
                    onChange={(e) => setEditCoachName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-hidden focus:border-indigo-600"
                    placeholder={userProfile?.fullName || 'اسم المؤطر'}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم التأجير</label>
                    <input
                      type="text"
                      value={editCoachLease}
                      onChange={(e) => setEditCoachLease(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-indigo-600"
                      placeholder={userProfile?.leaseNumber || 'رقم التأجير'}
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-bold mb-1">رقم الهاتف</label>
                    <input
                      type="tel"
                      value={editCoachPhone}
                      onChange={(e) => setEditCoachPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-indigo-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:border-indigo-600"
                      placeholder={userProfile?.phone || '06...'}
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

      {/* Delete Category Confirmation Modal */}
      {categoryToDelete && (
        <div className="fixed inset-0 z-80 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-red-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تأكيد حذف الفئة</h3>
                  <p className="text-[11px] text-white/80">{selectedSchoolNameForView}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCategoryToDelete(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs space-y-2 text-red-900">
                <p className="font-black text-sm text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>تنبيه: سيتم حذف جميع المسجلين في هذه الفئة!</span>
                </p>
                <p className="font-medium leading-relaxed">
                  أنت على وشك حذف فئة <strong>{categoryToDelete.label} ({categoryToDelete.gender === 'Female' ? 'إناث' : 'ذكور'})</strong> والتي تحتوي على <strong>{categoryToDelete.count} مشارك(ة)</strong>.
                </p>
                <p className="text-[11px] text-red-600 font-bold">
                  لا يمكن التراجع عن هذه العملية بعد التأكيد.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isDeletingCategory}
                  onClick={() => setCategoryToDelete(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isDeletingCategory}
                  onClick={confirmDeleteCategory}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isDeletingCategory ? 'جاري الحذف...' : 'تأكيد حذف الفئة'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw School Participation Confirmation Modal */}
      {schoolToWithdraw && (
        <div className="fixed inset-0 z-80 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-red-100 overflow-hidden">
            <div className="p-5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تأكيد سحب مشاركة المؤسسة</h3>
                  <p className="text-[11px] text-white/80">{schoolToWithdraw.schoolName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSchoolToWithdraw(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs space-y-2 text-red-900">
                <p className="font-black text-sm text-red-700 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>تنبيه هام: سحب المشاركة من فرع هذه البطولة</span>
                </p>
                <p className="font-medium leading-relaxed">
                  أنت على وشك سحب مشاركة مؤسسة <strong>"{schoolToWithdraw.schoolName}"</strong> من <strong>{selectedBranchTournament ? getBranchTournamentTitle(selectedBranchTournament, activeBranchModal) : 'فرع هذه البطولة'}</strong>{schoolToWithdraw.studentCount > 0 ? ` وإلغاء تسجيل جميع التلاميذ المسجلين بها في هذا الفرع وعددهم (${schoolToWithdraw.studentCount}) مشارك(ة)` : ''}.
                </p>
                <p className="text-[11px] text-red-600 font-bold bg-white p-2.5 rounded-xl border border-red-200">
                  ⚠️ لن تظهر المؤسسة في لائحة المشاركين بهذا الفرع أو في القرعة الإلكترونية بعد هذا الإجراء، ويمكن إعادة تأكيد المشاركة والتسجيل لاحقاً طالما أن باب التسجيل ما زال مفتوحاً.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  disabled={isWithdrawingSchool}
                  onClick={() => setSchoolToWithdraw(null)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  disabled={isWithdrawingSchool}
                  onClick={executeWithdrawSchool}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{isWithdrawingSchool ? 'جاري سحب المشاركة...' : 'تأكيد سحب المشاركة نهائياً'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Electronic Draw and Match Scheduling Modal */}
      {isDrawModalOpen && sport && (
        <ElectronicDrawModal
          isOpen={isDrawModalOpen}
          onClose={() => setIsDrawModalOpen(false)}
          currentUser={userProfile}
          initialSportId={sport.id}
          initialTournamentId={sportTournaments.length === 1 ? sportTournaments[0].id : undefined}
          onMatchesCreated={() => {
            if (onRefreshData) onRefreshData();
          }}
        />
      )}

      {/* School Participation Confirmation Modal */}
      {isConfirmModalOpen && sport && (
        <ConfirmParticipationModal
          isOpen={isConfirmModalOpen}
          onClose={() => setIsConfirmModalOpen(false)}
          sport={sport}
          tournaments={sportTournaments}
          schoolName={effectiveSchoolName}
          schoolId={userProfile?.schoolId || effectiveSchoolName}
          teacherId={userProfile?.id}
          teacherName={userProfile?.fullName}
          teacherPhone={userProfile?.phone}
          teacherLeaseNumber={userProfile?.leaseNumber}
          registrationDeadline={currentDeadline}
          confirmedRecord={currentConfirmationRecord}
          onConfirmSuccess={() => {
            refreshConfirmations();
            if (onRefreshData) onRefreshData();
          }}
          onCancelSuccess={() => {
            refreshConfirmations();
            if (onRefreshData) onRefreshData();
          }}
          onProceedToRegister={() => {
            if (isProgrammed) {
              setIsBulkRegisterOpen(true);
            }
          }}
        />
      )}

    </div>
  );
};
