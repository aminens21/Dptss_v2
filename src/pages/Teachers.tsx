import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { DataService, SPORTS_MAP, findMatchingSchoolForTeacher } from '../lib/dataService';
import { User, Student, School, AdministrativeCadre } from '../types';
import { fixTeacherFieldJumble, formatMoroccanPhone, isFlexibleEmailMatch, normalizeArabicName } from '../lib/utils';
import {
  getWhatsAppUrl,
  isValidPhoneNumber,
  generateTeacherSecurityCodeWhatsAppMessage
} from '../lib/whatsappService';
import { TeacherDetailModal } from '../components/TeacherDetailModal';
import { EditTeacherRoleModal } from '../components/EditTeacherRoleModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { TeacherBadgesModal } from '../components/TeacherBadgesModal';
import { useAuth } from '../contexts/AuthContext';
import { Directorate } from '../types';
import { OfficialLogos } from '../lib/dataService';
import * as XLSX from 'xlsx';
import {
  GraduationCap,
  Search,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Award,
  Filter,
  RefreshCw,
  Copy,
  Check,
  UserCheck,
  AlertCircle,
  Eye,
  Info,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronDown,
  UserPlus,
  Download,
  Upload,
  FileSpreadsheet,
  LogIn,
  Briefcase,
  ShieldCheck,
  X,
  Save,
  KeyRound,
  MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const CollapsibleSpecialties: React.FC<{ specialties: string[]; SPORTS_MAP: Record<string, { name: string; icon: string }> }> = ({ specialties, SPORTS_MAP }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (specialties.length === 0) return null;
  
  if (specialties.length === 1) {
    const spec = specialties[0];
    const sportDetails = SPORTS_MAP[spec];
    if (!sportDetails) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-md font-bold text-[10px]" title="حكم معتمد">
        <span>{sportDetails.icon}</span>
        <span>{sportDetails.name} (حكم)</span>
      </span>
    );
  }
  
  const firstSpec = specialties[0];
  const firstSport = SPORTS_MAP[firstSpec];
  const remainingCount = specialties.length - 1;
  
  return (
    <div className="flex flex-col gap-1 items-start">
      <div className="flex items-center gap-1.5">
        {firstSport && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-md font-bold text-[10px]" title="حكم معتمد">
            <span>{firstSport.icon}</span>
            <span>{firstSport.name} (حكم)</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="inline-flex items-center justify-center p-1 bg-purple-100 hover:bg-purple-200 text-purple-800 rounded-md transition-all cursor-pointer text-[10px] font-black shrink-0 gap-0.5"
          title={isExpanded ? "إخفاء باقي التخصصات" : "عرض باقي التخصصات"}
        >
          <span className="text-[9px]">+{remainingCount}</span>
          <ChevronDown className={`h-3 w-3 transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
      </div>
      
      {isExpanded && (
        <div className="flex flex-wrap gap-1 mt-1 p-1 bg-purple-50/50 border border-purple-100/50 rounded-lg animate-in slide-in-from-top-1 duration-150 max-w-[220px]">
          {specialties.slice(1).map(spec => {
            const sportDetails = SPORTS_MAP[spec];
            if (!sportDetails) return null;
            return (
              <span key={spec} className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 border border-purple-100 rounded-md font-bold text-[10px]" title="حكم معتمد">
                <span>{sportDetails.icon}</span>
                <span>{sportDetails.name} (حكم)</span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const Teachers: React.FC = () => {
  const { userProfile, originalUserProfile, isImpersonatingTeacher, startTeacherImpersonation } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const cadreQuery = searchParams.get('cadre');

  const effectiveAdminProfile = originalUserProfile || userProfile;
  const isCentralOrSportManager = Boolean(
    userProfile?.role === 'CENTRAL_ADMIN' ||
    userProfile?.role === 'SPORT_MANAGER' ||
    userProfile?.isSuperAdmin
  );
  const canEditTeachers = Boolean(
    isCentralOrSportManager ||
    (effectiveAdminProfile?.isTechCommitteeHead && !isImpersonatingTeacher)
  );
  const isOrigCentralAdmin = Boolean(
    effectiveAdminProfile?.role === 'CENTRAL_ADMIN' || effectiveAdminProfile?.isSuperAdmin
  );
  const isPrivilegedAdmin = Boolean(
    userProfile?.role === 'CENTRAL_ADMIN' ||
    userProfile?.role === 'REGIONAL_ADMIN' ||
    userProfile?.role === 'PROVINCIAL_ADMIN' ||
    userProfile?.role === 'SUPER_ADMIN' ||
    userProfile?.isSuperAdmin === true ||
    effectiveAdminProfile?.role === 'CENTRAL_ADMIN' ||
    effectiveAdminProfile?.role === 'REGIONAL_ADMIN' ||
    effectiveAdminProfile?.role === 'PROVINCIAL_ADMIN' ||
    effectiveAdminProfile?.role === 'SUPER_ADMIN' ||
    effectiveAdminProfile?.isSuperAdmin === true
  );
  const canTechHeadImpersonate = Boolean(
    (effectiveAdminProfile?.isTechCommitteeHead || isOrigCentralAdmin) && !isImpersonatingTeacher
  );

  const handleStartImpersonation = (targetTeacher: User, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canTechHeadImpersonate) return;
    if ((targetTeacher.role === 'CENTRAL_ADMIN' || targetTeacher.isSuperAdmin) && !(isOrigCentralAdmin && targetTeacher.isTechCommitteeHead)) {
      toast.error('لا يمكن الدخول بصفة حساب مسير مركزي أو مسؤول عام');
      return;
    }
    const preserveTechHead = Boolean(isOrigCentralAdmin && targetTeacher.isTechCommitteeHead);
    const scopedSports =
      !isOrigCentralAdmin && effectiveAdminProfile?.techCommitteeSports && effectiveAdminProfile.techCommitteeSports.length > 0
        ? effectiveAdminProfile.techCommitteeSports
        : !isOrigCentralAdmin && effectiveAdminProfile?.sportId
        ? [effectiveAdminProfile.sportId]
        : [];
    startTeacherImpersonation(targetTeacher, { preserveTechCommitteeRole: preserveTechHead });
    setIsDetailModalOpen(false);
    if (preserveTechHead) {
      toast.success(`تم الدخول بصفة رئيس اللجنة التقنية ${targetTeacher.fullName} مع الحفاظ على صفتك الأصلية`);
      navigate('/tournaments');
    } else {
      toast.success(
        isOrigCentralAdmin
          ? `تم الدخول بصفة الأستاذ ${targetTeacher.fullName} مع الحفاظ على صفتك الأصلية`
          : `تم الدخول بصفة الأستاذ ${targetTeacher.fullName} (محصور في رياضتك)`
      );
      navigate(scopedSports.length === 1 ? `/teacher-teams?sport=${scopedSports[0]}` : '/teacher-teams');
    }
  };

  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCadre, setSelectedCadre] = useState<string>(cadreQuery || '');
  const [profileFilter, setProfileFilter] = useState<'ALL' | 'COMPLETE' | 'INCOMPLETE'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Detail Modal State
  const [selectedTeacherModal, setSelectedTeacherModal] = useState<User | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [pinModalTarget, setPinModalTarget] = useState<{ teacher: User; school: School } | null>(null);
  const [pinModalPhone, setPinModalPhone] = useState<string>('');

  // Edit Role/Cadre Modal State
  const [selectedTeacherForEdit, setSelectedTeacherForEdit] = useState<User | null>(null);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);

  // Badges Modal State
  const [isBadgesModalOpen, setIsBadgesModalOpen] = useState(false);
  const [preselectedTeacherId, setPreselectedTeacherId] = useState<string | undefined>(undefined);
  const [activeDirObj, setActiveDirObj] = useState<Directorate | null>(null);
  const [officialLogos, setOfficialLogos] = useState<OfficialLogos | undefined>(undefined);
  const [activeSeason, setActiveSeason] = useState<string>('2026/2027');

  // Deletion Modal State
  const [teacherToDelete, setTeacherToDelete] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  // Administrative Cadres Sub-Section State (الأطر الإدارية)
  const [activeSection, setActiveSection] = useState<'PEDAGOGICAL' | 'ADMIN'>(() =>
    searchParams.get('section') === 'admin' || searchParams.get('tab') === 'admin' ? 'ADMIN' : 'PEDAGOGICAL'
  );
  const [adminCadres, setAdminCadres] = useState<AdministrativeCadre[]>(() =>
    DataService.getDefaultAdministrativeCadres()
  );
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [adminCategoryFilter, setAdminCategoryFilter] = useState<'ALL' | 'INSPECTOR' | 'OFFICE_HEAD' | 'OTHER'>('ALL');
  const [isAdminCadreModalOpen, setIsAdminCadreModalOpen] = useState(false);
  const [editingAdminCadre, setEditingAdminCadre] = useState<AdministrativeCadre | null>(null);
  const [adminForm, setAdminForm] = useState<{
    fullName: string;
    leaseNumber: string;
    cadre: string;
    phone: string;
    email: string;
  }>({
    fullName: '',
    leaseNumber: '',
    cadre: 'مفتش',
    phone: '',
    email: ''
  });
  const [isSavingAdminCadre, setIsSavingAdminCadre] = useState(false);
  const [adminCadreToDelete, setAdminCadreToDelete] = useState<AdministrativeCadre | null>(null);
  const [isDeletingAdminCadre, setIsDeletingAdminCadre] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadExcelTemplate = () => {
    try {
      const templateData = [
        {
          'رقم': 1,
          'الاسم الكامل للأستاذ': 'محمد العلوي',
          'البريد الإلكتروني (Gmail)': 'm.alaoui@gmail.com',
          'رقم التأجير (SOM)': '1234567',
          'مقر العمل (المؤسسة)': 'ثانوية ابن تاشفين التأهيلية',
          'رقم الهاتف': '0661234567',
          'السلك التعليمي (تأهيلي / إعدادي / ابتدائي)': 'تأهيلي'
        },
        {
          'رقم': 2,
          'الاسم الكامل للأستاذ': 'فاطمة الزهراء الإدريسي',
          'البريد الإلكتروني (Gmail)': 'fatima.idrissi@gmail.com',
          'رقم التأجير (SOM)': '7654321',
          'مقر العمل (المؤسسة)': 'إعدادية علال بن عبد الله',
          'رقم الهاتف': '0667654321',
          'السلك التعليمي (تأهيلي / إعدادي / ابتدائي)': 'إعدادي'
        }
      ];
      const ws = XLSX.utils.json_to_sheet(templateData);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 30 },
        { wch: 18 },
        { wch: 30 },
        { wch: 18 },
        { wch: 25 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الأطر التربوية');
      XLSX.writeFile(wb, 'نموذج_تعبئة_لائحة_الأساتذة_مديرية_تاوريرت.xlsx');
      toast.success('تم تحميل نموذج Excel بنجاح.');
    } catch (err) {
      console.error('Error downloading template:', err);
      toast.error('حدث خطأ أثناء تنزيل نموذج الإكسيل');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('جاري قراءة ملف Excel واستيراد لائحة الأساتذة...');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];

      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';

      const sanitizeImportedLease = (rawVal: any): string => {
        if (rawVal === undefined || rawVal === null) return '';
        let str = String(rawVal)
          .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
          .trim()
          .replace(/\.0$/, '')
          .replace(/^(?:som|ppr)\s*[:\-]?\s*/i, '')
          .trim();
        if (
          !str ||
          str.includes('لم يستلم') ||
          str.includes('لا يوجد') ||
          str.includes('غير متوفر') ||
          str.includes('بدون') ||
          str === '-' ||
          str === '--' ||
          str === '—'
        ) {
          return '';
        }
        return str;
      };

      const sanitizeImportedEmail = (rawVal: any): string => {
        if (rawVal === undefined || rawVal === null) return '';
        const s = String(rawVal)
          .replace(/[\s\u200B-\u200D\uFEFF]+/g, '')
          .trim()
          .toLowerCase();
        return s.includes('@') ? s : '';
      };

      const parseCadreValue = (rawCadre: string, workLocation: string): { cadre: 'PRIMARY' | 'MIDDLE' | 'HIGH'; explicit: boolean } => {
        const c = (rawCadre || '')
          .trim()
          .toLowerCase()
          .replace(/[أإآٱ]/g, 'ا')
          .replace(/ة/g, 'ه');
        if (c.includes('ابتدائ') || c.includes('primary')) return { cadre: 'PRIMARY', explicit: true };
        if (c.includes('اعداد') || c.includes('middle')) return { cadre: 'MIDDLE', explicit: true };
        if (c.includes('تاهيل') || c.includes('ثانويه') || c.includes('high')) return { cadre: 'HIGH', explicit: true };

        const w = (workLocation || '')
          .trim()
          .toLowerCase()
          .replace(/[أإآٱ]/g, 'ا')
          .replace(/ة/g, 'ه');
        if (w.includes('ابتدائ') || w.includes('م.م') || w.includes('مجموعه مدارس') || /^مدرسه\s/.test(w)) {
          return { cadre: 'PRIMARY', explicit: false };
        }
        if (w.includes('اعداد')) {
          return { cadre: 'MIDDLE', explicit: false };
        }
        return { cadre: 'HIGH', explicit: false };
      };

      // Detect header row & exact column indices
      let headerRowIdx = -1;
      let nameCol = -1;
      let emailCol = -1;
      let leaseCol = -1;
      let schoolCol = -1;
      let phoneCol = -1;
      let cadreCol = -1;

      const isHeaderMatchScore = (row: any[]): number => {
        if (!Array.isArray(row)) return 0;
        const joined = row.slice(0, 20).map(c => String(c || '').trim().toLowerCase()).join(' | ');
        let score = 0;
        if (joined.includes('الاسم الكامل') || joined.includes('الاسم والنسب') || joined.includes('اسم الأستاذ')) score += 2;
        if (joined.includes('البريد') || joined.includes('gmail') || joined.includes('email')) score += 2;
        if (joined.includes('التأجير') || joined.includes('التاجير') || joined.includes('som') || joined.includes('ppr')) score += 2;
        if (joined.includes('مقر العمل') || joined.includes('المؤسسة') || joined.includes('الموسسة')) score += 2;
        if (joined.includes('الهاتف') || joined.includes('phone')) score += 1;
        if (joined.includes('السلك') || joined.includes('الإطار') || joined.includes('الاطار')) score += 1;
        return score;
      };

      for (let i = 0; i < Math.min(rawRows.length, 15); i++) {
        if (isHeaderMatchScore(rawRows[i]) >= 4) {
          headerRowIdx = i;
          break;
        }
      }

      if (headerRowIdx >= 0) {
        const headerRow = rawRows[headerRowIdx].slice(0, 25).map(c => String(c || '').trim().toLowerCase());
        headerRow.forEach((hl, idx) => {
          if (!hl) return;
          if (
            nameCol === -1 &&
            (hl.includes('الاسم الكامل') || hl.includes('الاسم والنسب') || hl === 'الاسم' || hl.includes('اسم الأستاذ') || hl.includes('fullname') || hl === 'name')
          ) {
            nameCol = idx;
            return;
          }
          if (emailCol === -1 && (hl.includes('البريد') || hl.includes('gmail') || hl.includes('email'))) {
            emailCol = idx;
            return;
          }
          if (leaseCol === -1 && (hl.includes('التأجير') || hl.includes('التاجير') || hl.includes('som') || hl.includes('ppr') || hl.includes('leasenumber'))) {
            leaseCol = idx;
            return;
          }
          if (schoolCol === -1 && (hl.includes('مقر العمل') || hl.includes('المؤسسة') || hl.includes('الموسسة') || hl.includes('worklocation') || hl.includes('school'))) {
            schoolCol = idx;
            return;
          }
          if (phoneCol === -1 && (hl.includes('الهاتف') || hl.includes('النقال') || hl.includes('phone') || hl.includes('tel'))) {
            phoneCol = idx;
            return;
          }
          if (cadreCol === -1 && (hl.includes('السلك') || hl.includes('الإطار') || hl.includes('الاطار') || hl.includes('cadre'))) {
            cadreCol = idx;
            return;
          }
        });
      }

      // Default to the template/export column layout if no header row was matched:
      // 0: رقم | 1: الاسم الكامل | 2: البريد الإلكتروني | 3: رقم التأجير | 4: مقر العمل | 5: الهاتف | 6: السلك
      if (headerRowIdx === -1) {
        const sampleRow = rawRows.find(
          r => Array.isArray(r) && r.filter(c => String(c || '').trim() !== '').length >= 2
        );
        const col0Val = sampleRow ? String(sampleRow[0] || '').trim() : '';
        const hasIndexCol = Boolean(sampleRow && (/^\d{1,4}$/.test(col0Val) || col0Val === ''));
        const offset = hasIndexCol ? 1 : 0;
        nameCol = offset;
        emailCol = offset + 1;
        leaseCol = offset + 2;
        schoolCol = offset + 3;
        phoneCol = offset + 4;
        cadreCol = offset + 5;
      }

      // Load current users once so re-imports match and update existing teachers without duplicating
      const existingUsersSnapshot = await DataService.getUsers();
      const workingUsers: User[] = [...existingUsersSnapshot];

      const findExistingTeacherIdx = (candidate: {
        fullName: string;
        email: string;
        leaseNumber: string;
        workLocation: string;
      }): number => {
        const cleanLease = candidate.leaseNumber.trim();
        const cleanEmail = candidate.email.trim().toLowerCase();
        const isRealEmail = Boolean(cleanEmail && !cleanEmail.endsWith('@taourirt-sports.ma'));
        const normName = normalizeArabicName(candidate.fullName);
        const normSchool = normalizeArabicName(candidate.workLocation);

        if (cleanLease) {
          const byLease = workingUsers.findIndex(
            u => u && u.leaseNumber && sanitizeImportedLease(u.leaseNumber) === cleanLease
          );
          if (byLease >= 0) return byLease;
        }

        if (isRealEmail) {
          const byEmail = workingUsers.findIndex(
            u => u && u.email && !u.email.endsWith('@taourirt-sports.ma') && isFlexibleEmailMatch(u.email, cleanEmail)
          );
          if (byEmail >= 0) return byEmail;
        }

        if (normName && normSchool) {
          const byNameAndSchool = workingUsers.findIndex(u => {
            if (!u || (u.role && u.role !== 'TEACHER')) return false;
            if ((u.directorateId || 'taourirt') !== activeDirId) return false;
            const uNormName = normalizeArabicName(u.fullName || '');
            const uNormSchool = normalizeArabicName(u.workLocation || '');
            return (
              uNormName === normName &&
              Boolean(uNormSchool) &&
              (uNormSchool === normSchool || uNormSchool.includes(normSchool) || normSchool.includes(uNormSchool))
            );
          });
          if (byNameAndSchool >= 0) return byNameAndSchool;
        }

        if (normName && normName.length >= 5) {
          // Prefer existing teacher in the active directorate whose leaseNumber is missing or matches
          const matches = workingUsers
            .map((u, idx) => ({ u, idx }))
            .filter(({ u }) => {
              if (!u || (u.role && u.role !== 'TEACHER')) return false;
              if ((u.directorateId || 'taourirt') !== activeDirId) return false;
              return normalizeArabicName(u.fullName || '') === normName;
            });
          if (matches.length > 0) {
            const missingLeaseMatch = matches.find(({ u }) => !u.leaseNumber || !u.leaseNumber.trim());
            return (missingLeaseMatch || matches[0]).idx;
          }
        }

        return -1;
      };

      let addedCount = 0;
      let updatedCount = 0;
      const startRow = headerRowIdx >= 0 ? headerRowIdx + 1 : 0;

      for (let i = startRow; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        if (isHeaderMatchScore(row) >= 4) continue;

        const rawName = nameCol >= 0 ? String(row[nameCol] ?? '').trim() : '';
        const rawEmailCell = emailCol >= 0 ? String(row[emailCol] ?? '').trim() : '';
        const rawLeaseCell = leaseCol >= 0 ? row[leaseCol] : '';
        const rawSchool = schoolCol >= 0 ? String(row[schoolCol] ?? '').trim() : '';
        const rawPhoneCell = phoneCol >= 0 ? row[phoneCol] : '';
        const rawCadreCell = cadreCol >= 0 ? String(row[cadreCol] ?? '').trim() : '';

        if (!rawName && !rawEmailCell && !rawLeaseCell && !rawSchool && !rawPhoneCell) continue;

        const cleanedLease = sanitizeImportedLease(rawLeaseCell);
        const cleanedEmail = sanitizeImportedEmail(rawEmailCell);
        const cleanedPhone = formatMoroccanPhone(rawPhoneCell);
        const parsedCadre = parseCadreValue(rawCadreCell, rawSchool);

        const tempId = `teacher_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
        let parsedTeacher: User = {
          id: tempId,
          fullName: rawName || 'أستاذ(ة)',
          email: cleanedEmail || rawEmailCell.toLowerCase(),
          leaseNumber: cleanedLease,
          workLocation: rawSchool,
          phone: cleanedPhone || String(rawPhoneCell || '').trim(),
          teachingCadre: parsedCadre.cadre,
          role: 'TEACHER',
          directorateId: activeDirId,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        // Safely normalize / fix any swapped columns if user uploaded a differently ordered file
        parsedTeacher = fixTeacherFieldJumble(parsedTeacher);
        if (cleanedLease && !parsedTeacher.leaseNumber) {
          parsedTeacher.leaseNumber = cleanedLease;
        }

        const finalName = (parsedTeacher.fullName || '').trim();
        if (!finalName || finalName === 'أستاذ(ة)' || finalName === 'أستاذ') continue;

        const finalEmail = sanitizeImportedEmail(parsedTeacher.email);
        const finalLease = sanitizeImportedLease(parsedTeacher.leaseNumber) || cleanedLease;
        const finalSchool = (parsedTeacher.workLocation || rawSchool || '').trim();
        const finalPhone = formatMoroccanPhone(parsedTeacher.phone) || cleanedPhone;
        const finalCadre = parsedCadre.explicit
          ? parsedCadre.cadre
          : (parsedTeacher.teachingCadre as 'PRIMARY' | 'MIDDLE' | 'HIGH') || parsedCadre.cadre;

        const existingIdx = findExistingTeacherIdx({
          fullName: finalName,
          email: finalEmail,
          leaseNumber: finalLease,
          workLocation: finalSchool
        });

        if (existingIdx >= 0) {
          const existing = workingUsers[existingIdx];
          const existingEmail = (existing.email || '').trim().toLowerCase();
          const hasSyntheticEmail = !existingEmail || existingEmail.endsWith('@taourirt-sports.ma');
          const mergedEmail =
            finalEmail && hasSyntheticEmail
              ? finalEmail
              : existingEmail || finalEmail || `${existing.id}@taourirt-sports.ma`;

          const mergedTeacher: User = {
            ...existing,
            id: existing.id,
            fullName:
              existing.fullName && existing.fullName !== 'أستاذ' && existing.fullName !== 'أستاذ(ة)'
                ? existing.fullName
                : finalName,
            email: mergedEmail,
            leaseNumber: finalLease || sanitizeImportedLease(existing.leaseNumber) || '',
            workLocation: finalSchool || existing.workLocation || '',
            phone: finalPhone || existing.phone || '',
            teachingCadre: parsedCadre.explicit
              ? finalCadre
              : existing.teachingCadre || finalCadre,
            role: existing.role || 'TEACHER',
            directorateId: existing.directorateId || activeDirId,
            isActive: existing.isActive !== undefined ? existing.isActive : true,
            updatedAt: new Date()
          };

          workingUsers[existingIdx] = mergedTeacher;
          await DataService.updateUserProfile(existing.id, mergedTeacher);
          updatedCount++;
        } else {
          const newTeacher: User = {
            id: tempId,
            fullName: finalName,
            email: finalEmail || `${tempId}@taourirt-sports.ma`,
            leaseNumber: finalLease,
            workLocation: finalSchool,
            phone: finalPhone,
            teachingCadre: finalCadre,
            role: 'TEACHER',
            directorateId: activeDirId,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          workingUsers.push(newTeacher);
          await DataService.updateUserProfile(newTeacher.id, newTeacher);
          addedCount++;
        }
      }

      const totalProcessed = addedCount + updatedCount;
      if (totalProcessed > 0) {
        if (addedCount > 0 && updatedCount > 0) {
          toast.success(
            `تم استيراد ${addedCount} أستاذ(ة) جديد وتحديث بيانات ${updatedCount} أستاذ(ة) موجود (بما في ذلك رقم التأجير) دون تكرار!`,
            { id: toastId, duration: 5000 }
          );
        } else if (updatedCount > 0) {
          toast.success(
            `تم تحديث بيانات ${updatedCount} أستاذ(ة) وإضافة أرقام التأجير في مكانها المناسب دون تكرار!`,
            { id: toastId, duration: 5000 }
          );
        } else {
          toast.success(`تم بنجاح استيراد وتفعيل ${addedCount} أستاذ(ة) جديد في المنظومة!`, { id: toastId });
        }
        await loadTeachersAndStudents();
      } else {
        toast.error(
          'لم يتم العثور على بيانات صالحة مطابقة لأعمدة النموذج (الاسم الكامل، البريد الإلكتروني، رقم التأجير، مقر العمل، رقم الهاتف، السلك التعليمي).',
          { id: toastId }
        );
      }
    } catch (err) {
      console.error('Error importing teachers Excel:', err);
      toast.error('حدث خطأ أثناء قراءة واستيراد ملف الإكسيل', { id: toastId });
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleExportCurrentTeachers = () => {
    try {
      const exportData = filteredTeachers.map((t, idx) => ({
        'رقم': idx + 1,
        'الاسم الكامل للأستاذ': t.fullName,
        'البريد الإلكتروني (Gmail)': t.email || '',
        'رقم التأجير (SOM)': t.leaseNumber || '',
        'مقر العمل (المؤسسة)': t.workLocation || '',
        'رقم الهاتف': t.phone || '',
        'السلك التعليمي': t.teachingCadre === 'PRIMARY' ? 'ابتدائي' : t.teachingCadre === 'MIDDLE' ? 'إعدادي' : 'تأهيلي'
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 25 },
        { wch: 30 },
        { wch: 18 },
        { wch: 30 },
        { wch: 18 },
        { wch: 25 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'لائحة الأساتذة');
      XLSX.writeFile(wb, `لائحة_الأطر_التربوية_${activeDirObj?.name || 'تاوريرت'}.xlsx`);
      toast.success('تم تصدير لائحة الأساتذة إلى ملف Excel بنجاح.');
    } catch (err) {
      console.error('Error exporting teachers:', err);
      toast.error('حدث خطأ أثناء تصدير البيانات');
    }
  };

  useEffect(() => {
    setSelectedCadre(cadreQuery || '');
  }, [cadreQuery]);

  useEffect(() => {
    const tabParam = searchParams.get('section') || searchParams.get('tab');
    if (tabParam === 'admin') {
      setActiveSection('ADMIN');
    } else if (tabParam === 'pedagogical') {
      setActiveSection('PEDAGOGICAL');
    }
  }, [searchParams]);

  useEffect(() => {
    loadTeachersAndStudents();
    const unsubAdminCadres = DataService.subscribeToAdministrativeCadres((cadres) => {
      setAdminCadres(cadres);
    });
    const handleDirChange = () => {
      loadTeachersAndStudents();
    };
    const handleProfileChange = () => {
      loadTeachersAndStudents();
    };
    window.addEventListener('directorateChanged', handleDirChange);
    window.addEventListener('userDataChanged', handleProfileChange);
    window.addEventListener('teacherProfileUpdated', handleProfileChange);
    return () => {
      unsubAdminCadres();
      window.removeEventListener('directorateChanged', handleDirChange);
      window.removeEventListener('userDataChanged', handleProfileChange);
      window.removeEventListener('teacherProfileUpdated', handleProfileChange);
    };
  }, []);

  const loadTeachersAndStudents = async () => {
    setLoading(true);
    setAdminLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [teachersData, studentsData, schoolsData, activeDir, logos, curSeason, cadresData] = await Promise.all([
        DataService.getTeachers(),
        DataService.getStudents(),
        DataService.getSchools(),
        DataService.getActiveDirectorate(),
        DataService.getOfficialLogos(),
        DataService.getActiveSeason(),
        DataService.getAdministrativeCadres(activeDirId).catch(() => DataService.getDefaultAdministrativeCadres(activeDirId))
      ]);
      const dirTeachers = teachersData.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      const dirStudents = studentsData.filter(st => (st.directorateId || 'taourirt') === activeDirId);
      const dirSchools = schoolsData.filter(sch => (sch.directorateId || 'taourirt') === activeDirId);

      setTeachers(dirTeachers);
      setStudents(dirStudents);
      setSchools(dirSchools);
      setAdminCadres(cadresData);
      if (activeDir) setActiveDirObj(activeDir);
      if (logos) setOfficialLogos(logos);
      if (curSeason) setActiveSeason(curSeason);
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('حدث خطأ أثناء تحميل قائمة الأساتذة');
    } finally {
      setLoading(false);
      setAdminLoading(false);
    }
  };

  const handleOpenAddAdminCadre = () => {
    if (!isOrigCentralAdmin) {
      toast.error('إضافة الأطر الإدارية مخولة للمشرف المركزي فقط');
      return;
    }
    setEditingAdminCadre(null);
    setAdminForm({
      fullName: '',
      leaseNumber: '',
      cadre: 'مفتش',
      phone: '',
      email: ''
    });
    setIsAdminCadreModalOpen(true);
  };

  const handleOpenEditAdminCadre = (cadreItem: AdministrativeCadre) => {
    if (!isOrigCentralAdmin) return;
    setEditingAdminCadre(cadreItem);
    setAdminForm({
      fullName: cadreItem.fullName || '',
      leaseNumber: cadreItem.leaseNumber || '',
      cadre: cadreItem.cadre || 'مفتش',
      phone: cadreItem.phone || '',
      email: cadreItem.email || ''
    });
    setIsAdminCadreModalOpen(true);
  };

  const handleSaveAdminCadre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOrigCentralAdmin) {
      toast.error('إضافة وتعديل الأطر الإدارية مخولة للمشرف المركزي فقط');
      return;
    }
    const cleanName = adminForm.fullName.trim();
    const cleanCadre = adminForm.cadre.trim();
    if (!cleanName) {
      toast.error('يرجى إدخال الاسم والنسب');
      return;
    }
    if (!cleanCadre) {
      toast.error('يرجى تحديد الإطار');
      return;
    }

    setIsSavingAdminCadre(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
      if (editingAdminCadre) {
        const updated = await DataService.updateAdministrativeCadre(editingAdminCadre.id, {
          fullName: cleanName,
          leaseNumber: adminForm.leaseNumber.trim(),
          cadre: cleanCadre,
          phone: adminForm.phone.trim(),
          email: adminForm.email.trim().toLowerCase(),
          directorateId: editingAdminCadre.directorateId || activeDirId
        });
        setAdminCadres(prev => prev.map(c => (c.id === updated.id ? updated : c)));
        toast.success(`تم تحديث بيانات ${cleanName} بنجاح`);
      } else {
        const created = await DataService.addAdministrativeCadre({
          fullName: cleanName,
          leaseNumber: adminForm.leaseNumber.trim(),
          cadre: cleanCadre,
          phone: adminForm.phone.trim(),
          email: adminForm.email.trim().toLowerCase(),
          directorateId: activeDirId,
          createdBy: effectiveAdminProfile?.email || effectiveAdminProfile?.fullName || 'المشرف المركزي'
        });
        setAdminCadres(prev => [created, ...prev.filter(c => c.id !== created.id)]);
        toast.success(`تمت إضافة ${cleanName} إلى الأطر الإدارية بنجاح`);
      }
      setIsAdminCadreModalOpen(false);
      setEditingAdminCadre(null);
    } catch (error) {
      console.error('Error saving administrative cadre:', error);
      toast.error('تعذر حفظ بيانات الإطار الإداري');
    } finally {
      setIsSavingAdminCadre(false);
    }
  };

  const handleConfirmDeleteAdminCadre = async () => {
    if (!adminCadreToDelete || !isOrigCentralAdmin) return;
    setIsDeletingAdminCadre(true);
    try {
      await DataService.deleteAdministrativeCadre(adminCadreToDelete.id);
      setAdminCadres(prev => prev.filter(c => c.id !== adminCadreToDelete.id));
      toast.success(`تم حذف ${adminCadreToDelete.fullName} من لائحة الأطر الإدارية`);
      setAdminCadreToDelete(null);
    } catch (error) {
      console.error('Error deleting administrative cadre:', error);
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setIsDeletingAdminCadre(false);
    }
  };

  const handleExportAdminCadres = () => {
    try {
      const exportRows = filteredAdminCadres.map((item, idx) => ({
        'رقم': idx + 1,
        'الاسم والنسب': item.fullName,
        'الإطار': item.cadre,
        'رقم التأجير': item.leaseNumber || '',
        'رقم الهاتف': item.phone || '',
        'البريد الإلكتروني': item.email || ''
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 28 },
        { wch: 26 },
        { wch: 16 },
        { wch: 18 },
        { wch: 30 }
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'الأطر الإدارية');
      XLSX.writeFile(wb, `لائحة_الأطر_الإدارية_${activeDirObj?.name || 'تاوريرت'}.xlsx`);
      toast.success('تم تصدير لائحة الأطر الإدارية إلى ملف Excel بنجاح.');
    } catch (err) {
      console.error('Error exporting admin cadres:', err);
      toast.error('حدث خطأ أثناء التصدير');
    }
  };

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('تم النسخ إلى الحافظة');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenTeacherDetail = (teacher: User) => {
    setSelectedTeacherModal(teacher);
    setIsDetailModalOpen(true);
  };

  const handleOpenEditRole = (teacher: User) => {
    setSelectedTeacherForEdit(teacher);
    setIsEditRoleModalOpen(true);
  };

  const handleTeacherUpdated = (updatedTeacher: User) => {
    setTeachers(prev => {
      const exists = prev.some(t => t.id === updatedTeacher.id);
      if (exists) {
        return prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t);
      }
      return [updatedTeacher, ...prev];
    });
    if (selectedTeacherModal && selectedTeacherModal.id === updatedTeacher.id) {
      setSelectedTeacherModal(updatedTeacher);
    }
  };

  const handleTeacherDeleted = (deletedTeacherId: string) => {
    setTeachers(prev => prev.filter(t => t.id !== deletedTeacherId));
    if (selectedTeacherModal && selectedTeacherModal.id === deletedTeacherId) {
      setSelectedTeacherModal(null);
      setIsDetailModalOpen(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, teacher: User) => {
    e.stopPropagation();
    setTeacherToDelete(teacher);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!teacherToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteUser(teacherToDelete.id);
      toast.success(`تم حذف حساب الأستاذ ${teacherToDelete.fullName} بنجاح!`);
      setTeachers(prev => prev.filter(t => t.id !== teacherToDelete.id));
      setIsDeleteModalOpen(false);
      setTeacherToDelete(null);
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast.error("حدث خطأ أثناء محاولة حذف الحساب");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllTeachers = async () => {
    setIsDeletingAll(true);
    try {
      await DataService.deleteAllTeachers();
      toast.success('تم حذف جميع حسابات الأطر التربوية بنجاح');
      await loadTeachersAndStudents();
      setShowDeleteAllModal(false);
    } catch (error) {
      console.error("Error deleting all teachers:", error);
      toast.error("حدث خطأ أثناء محاولة حذف الكل");
    } finally {
      setIsDeletingAll(false);
    }
  };

  // Get unique work locations for filter dropdown
  const uniqueLocations = Array.from(
    new Set(teachers.map((t) => t.workLocation).filter(Boolean))
  ) as string[];

  // Filter teachers based on search term, selected specialization, and work location
  const filteredTeachers = teachers.filter((teacher) => {
    const matchesSearch =
      teacher.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (teacher.leaseNumber && teacher.leaseNumber.includes(searchTerm)) ||
      (teacher.workLocation && teacher.workLocation.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesSport = selectedSport === '' || (Array.isArray(teacher.refereeSpecialty) ? teacher.refereeSpecialty.includes(selectedSport) : teacher.refereeSpecialty === selectedSport);
    const matchesLocation = selectedLocation === '' || teacher.workLocation === selectedLocation;
    const matchesCadre = selectedCadre === '' || (teacher.teachingCadre || 'HIGH') === selectedCadre;
    const isProfileComplete = Boolean(teacher.workLocation && teacher.leaseNumber);
    const matchesProfile =
      profileFilter === 'ALL'
        ? true
        : profileFilter === 'COMPLETE'
        ? isProfileComplete
        : !isProfileComplete;

    return matchesSearch && matchesSport && matchesLocation && matchesCadre && matchesProfile;
  });

  // Calculate statistics
  const totalTeachers = teachers.length;
  const completedProfiles = teachers.filter(t => t.workLocation && t.leaseNumber).length;
  const incompleteProfiles = totalTeachers - completedProfiles;

  const filteredAdminCadres = adminCadres.filter((item) => {
    const q = adminSearchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      (item.fullName || '').toLowerCase().includes(q) ||
      (item.cadre || '').toLowerCase().includes(q) ||
      (item.leaseNumber || '').toLowerCase().includes(q) ||
      (item.phone || '').toLowerCase().includes(q) ||
      (item.email || '').toLowerCase().includes(q);

    const cat = item.category || (item.cadre?.includes('مفتش') ? 'INSPECTOR' : item.cadre?.includes('رئيس مكتب') ? 'OFFICE_HEAD' : 'OTHER');
    const matchesCategory = adminCategoryFilter === 'ALL' || cat === adminCategoryFilter;
    return matchesSearch && matchesCategory;
  });

  const inspectorCadres = filteredAdminCadres.filter(
    (c) => (c.category || (c.cadre?.includes('مفتش') ? 'INSPECTOR' : 'OTHER')) === 'INSPECTOR'
  );
  const officeAndOtherCadres = filteredAdminCadres.filter(
    (c) => (c.category || (c.cadre?.includes('مفتش') ? 'INSPECTOR' : 'OTHER')) !== 'INSPECTOR'
  );

  // Filter students for the selected teacher modal
  const teacherStudents = selectedTeacherModal
    ? students.filter(s => s.schoolName === selectedTeacherModal.workLocation)
    : [];

  const getCadreBadge = (cadre?: string) => {
    switch (cadre) {
      case 'PRIMARY':
        return { text: 'أستاذ الابتدائي', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'MIDDLE':
        return { text: 'أستاذ الإعدادي', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'HIGH':
      default:
        return { text: 'أستاذ التأهيلي', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Hidden file input for Excel upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcel}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Header and Sub-Section Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            {activeSection === 'ADMIN' ? (
              <Briefcase className="h-6 w-6 text-slate-800 shrink-0" />
            ) : (
              <GraduationCap className="h-6 w-6 text-blue-600 shrink-0" />
            )}
            <span>{activeSection === 'ADMIN' ? 'لائحة الأطر الإدارية' : 'لائحة الأطر التربوية'}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {activeSection === 'ADMIN'
              ? 'إدارة ومتابعة المفتشين التربويين ورئيس مكتب التربية البدنية والأطر الإدارية بالمديرية.'
              : 'إدارة ومتابعة ملفات أساتذة التربية البدنية والرياضية المسجلين بالمديرية. اضغط على أي أستاذ لعرض بطاقته التفصيلية.'}
          </p>
        </div>

        {activeSection === 'PEDAGOGICAL' ? (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Download Blank Template Button */}
            <button
              onClick={handleDownloadExcelTemplate}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-emerald-50 border border-emerald-300 hover:bg-emerald-100 text-emerald-800 rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-3xs cursor-pointer text-center whitespace-nowrap shrink-0"
              title="تحميل نموذج إكسيل فارغ لتعبئة بيانات الأطر التربوية"
            >
              <Download className="h-3.5 w-3.5 shrink-0" />
              <span>تحميل نموذج Excel فارغ</span>
            </button>

            {/* Import from Excel Button */}
            {(userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'SPORT_MANAGER') && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-indigo-50 border border-indigo-300 hover:bg-indigo-100 text-indigo-800 rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-3xs cursor-pointer text-center whitespace-nowrap shrink-0"
                title="استيراد وتعبئة لائحة الأساتذة من ملف إكسيل (الأعمدة B إلى G)"
              >
                <Upload className="h-3.5 w-3.5 shrink-0" />
                <span>استيراد من Excel</span>
              </button>
            )}

            {/* Export to Excel Button */}
            <button
              onClick={handleExportCurrentTeachers}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-slate-50 border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-3xs cursor-pointer text-center whitespace-nowrap shrink-0"
              title="تصدير اللائحة الحالية للأساتذة إلى ملف إكسيل"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
              <span>تصدير إلى Excel</span>
            </button>

            {/* Add New Teacher / Authorize Email Button */}
            {(userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'SPORT_MANAGER') && (
              <button
                onClick={() => {
                  setSelectedTeacherForEdit(null);
                  setIsEditRoleModalOpen(true);
                }}
                className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-sm hover:shadow-md cursor-pointer text-center whitespace-nowrap shrink-0"
                title="إضافة أستاذ جديد واعتماد بريده الإلكتروني للدخول عبر Google"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>إضافة أستاذ جديد (اعتماد بريد)</span>
              </button>
            )}

            {/* Print Badges Button */}
            <button
              onClick={() => {
                setPreselectedTeacherId(undefined);
                setIsBadgesModalOpen(true);
              }}
              className="col-span-2 sm:col-span-1 flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-[11px] sm:text-xs font-black transition-all shadow-sm hover:shadow-md cursor-pointer text-center whitespace-nowrap shrink-0"
              title="إنشاء وطباعة شارات وبادجات الأساتذة (8 في الورقة A4)"
            >
              <span className="text-sm shrink-0">🪪</span>
              <span>إنشاء شارات وبادجات الأساتذة (A4)</span>
            </button>

            <button
              onClick={loadTeachersAndStudents}
              className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-600 cursor-pointer transition-all bg-white shadow-3xs text-center whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0" />
              <span>تحديث القائمة</span>
            </button>

            {userProfile?.role === 'CENTRAL_ADMIN' && teachers.length > 0 && (
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl text-[11px] sm:text-xs font-bold text-red-600 transition-all shadow-3xs cursor-pointer text-center whitespace-nowrap shrink-0"
                title="حذف جميع حسابات الأطر التربوية في هذه المديرية"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                <span>حذف الكل</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {isOrigCentralAdmin && (
              <button
                type="button"
                onClick={handleOpenAddAdminCadre}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-4 w-4 shrink-0" />
                <span>إضافة إطار إداري</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportAdminCadres}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-slate-500" />
              <span>تصدير إلى Excel</span>
            </button>
            <button
              type="button"
              onClick={loadTeachersAndStudents}
              className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span>تحديث القائمة</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-navigation Switcher: الأطر التربوية / الأطر الإدارية */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl">
          <button
            type="button"
            onClick={() => {
              setActiveSection('PEDAGOGICAL');
              const nextParams = new URLSearchParams(searchParams);
              nextParams.delete('section');
              nextParams.delete('tab');
              setSearchParams(nextParams);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSection === 'PEDAGOGICAL'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <GraduationCap className="h-4 w-4 shrink-0" />
            <span>الأطر التربوية</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-500">({teachers.length})</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveSection('ADMIN');
              const nextParams = new URLSearchParams(searchParams);
              nextParams.set('section', 'admin');
              setSearchParams(nextParams);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSection === 'ADMIN'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Briefcase className="h-4 w-4 shrink-0" />
            <span>الأطر الإدارية</span>
            <span className="font-mono tabular-nums text-[11px] text-slate-500">({adminCadres.length})</span>
          </button>
        </div>

        {activeSection === 'ADMIN' && (
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <span>المفتشون ومكتب التربية البدنية</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">{adminCadres.length} مسجل</span>
          </div>
        )}
      </div>

      {activeSection === 'ADMIN' ? (
        <div className="space-y-5">
          {/* Search & Category Filter Toolbar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative w-full md:w-80">
              <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="h-4 w-4 text-slate-400" />
              </span>
              <input
                type="text"
                className="w-full text-xs pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 transition-colors placeholder:text-slate-400"
                placeholder="بحث بالاسم والنسب، رقم التأجير، الإطار، الهاتف..."
                value={adminSearchTerm}
                onChange={(e) => setAdminSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {[
                { id: 'ALL' as const, label: 'الكل', count: adminCadres.length },
                {
                  id: 'INSPECTOR' as const,
                  label: 'المفتشون',
                  count: adminCadres.filter(c => (c.category || (c.cadre?.includes('مفتش') ? 'INSPECTOR' : 'OTHER')) === 'INSPECTOR').length
                },
                {
                  id: 'OFFICE_HEAD' as const,
                  label: 'رئيس مكتب التربية البدنية',
                  count: adminCadres.filter(c => (c.category || (c.cadre?.includes('رئيس مكتب') ? 'OFFICE_HEAD' : 'OTHER')) === 'OFFICE_HEAD').length
                },
                {
                  id: 'OTHER' as const,
                  label: 'أطر أخرى',
                  count: adminCadres.filter(c => (c.category || (c.cadre?.includes('مفتش') ? 'INSPECTOR' : c.cadre?.includes('رئيس مكتب') ? 'OFFICE_HEAD' : 'OTHER')) === 'OTHER').length
                }
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setAdminCategoryFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 ${
                    adminCategoryFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">{tab.count}</span>
                </button>
              ))}
            </div>
          </div>

          {adminLoading ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
              <div className="h-7 w-7 animate-spin rounded-full border-3 border-slate-800 border-t-transparent" />
              <p className="text-xs text-slate-500 font-medium">جاري تحميل لائحة الأطر الإدارية...</p>
            </div>
          ) : filteredAdminCadres.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
              <p className="text-slate-700 text-sm font-semibold">لا توجد بيانات تطابق معايير البحث الحالية.</p>
              <div className="flex items-center justify-center gap-2">
                {(adminSearchTerm || adminCategoryFilter !== 'ALL') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdminSearchTerm('');
                      setAdminCategoryFilter('ALL');
                    }}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                  >
                    إعادة تعيين البحث
                  </button>
                )}
                {isOrigCentralAdmin && (
                  <button
                    type="button"
                    onClick={handleOpenAddAdminCadre}
                    className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    <span>إضافة إطار إداري</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {[
                {
                  key: 'inspectors',
                  title: 'المفتشون التربويون',
                  subtitle: 'المفتشون المكلفون بتأطير ومواكبة مادة التربية البدنية والرياضية',
                  items: inspectorCadres
                },
                {
                  key: 'office',
                  title: 'مكتب التربية البدنية والأطر الإدارية',
                  subtitle: 'رئيس مكتب التربية البدنية والأطر الإدارية المكلفة بالتدبير الرياضي بالمديرية',
                  items: officeAndOtherCadres
                }
              ]
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.key} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{group.title}</h3>
                        <p className="text-xs text-slate-500 mt-0.5">{group.subtitle}</p>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        {group.items.length} إطار
                      </span>
                    </div>

                    {/* Desktop High-Density Table */}
                    <div className="hidden md:block overflow-x-auto">
                      <table className="w-full text-right border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 bg-white">
                            <th className="px-5 py-3">الاسم والنسب</th>
                            <th className="px-5 py-3">الإطار</th>
                            <th className="px-5 py-3">رقم التأجير</th>
                            <th className="px-5 py-3">رقم الهاتف</th>
                            <th className="px-5 py-3">البريد الإلكتروني</th>
                            {isOrigCentralAdmin && <th className="px-5 py-3 text-center">الإجراءات</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {group.items.map((item) => {
                            const formattedPhone = formatMoroccanPhone(item.phone);
                            return (
                              <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                                      {(item.fullName || 'إ').trim().charAt(0)}
                                    </div>
                                    <span className="font-bold text-slate-900">{item.fullName}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3.5 text-slate-700 font-medium">
                                  {item.cadre}
                                </td>
                                <td className="px-5 py-3.5">
                                  {item.leaseNumber ? (
                                    <span className="font-mono tabular-nums font-semibold text-slate-800" dir="ltr">
                                      {item.leaseNumber}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5">
                                  {formattedPhone ? (
                                    <a
                                      href={`tel:${formattedPhone}`}
                                      className="font-mono tabular-nums font-semibold text-slate-800 hover:text-slate-950 hover:underline"
                                      dir="ltr"
                                    >
                                      {formattedPhone}
                                    </a>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3.5">
                                  {item.email ? (
                                    <div className="flex items-center gap-2">
                                      <a
                                        href={`mailto:${item.email}`}
                                        className="font-mono text-slate-700 hover:text-slate-950 hover:underline truncate max-w-[220px]"
                                        dir="ltr"
                                      >
                                        {item.email}
                                      </a>
                                      <button
                                        type="button"
                                        onClick={(e) => handleCopy(e, item.email || '', `admin-email-${item.id}`)}
                                        className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer"
                                        title="نسخ البريد الإلكتروني"
                                      >
                                        {copiedId === `admin-email-${item.id}` ? (
                                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                                        ) : (
                                          <Copy className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </td>
                                {isOrigCentralAdmin && (
                                  <td className="px-5 py-3.5 text-center">
                                    <div className="inline-flex items-center justify-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => handleOpenEditAdminCadre(item)}
                                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                        title="تعديل البيانات"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setAdminCadreToDelete(item)}
                                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors cursor-pointer"
                                        title="حذف"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
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

                    {/* Mobile List View */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {group.items.map((item) => {
                        const formattedPhone = formatMoroccanPhone(item.phone);
                        return (
                          <div key={`m-${item.id}`} className="p-4 space-y-2.5">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-bold text-slate-900">{item.fullName}</p>
                                <p className="text-xs text-slate-600 mt-0.5">{item.cadre}</p>
                              </div>
                              {isOrigCentralAdmin && (
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditAdminCadre(item)}
                                    className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                                    title="تعديل"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setAdminCadreToDelete(item)}
                                    className="p-2 text-red-600 bg-red-50 border border-red-200 rounded-lg cursor-pointer"
                                    title="حذف"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-1">
                              <span>
                                رقم التأجير:{' '}
                                <span className="font-mono tabular-nums text-slate-900" dir="ltr">
                                  {item.leaseNumber || '—'}
                                </span>
                              </span>
                              <span aria-hidden="true" className="text-slate-300">·</span>
                              <span>
                                الهاتف:{' '}
                                {formattedPhone ? (
                                  <a href={`tel:${formattedPhone}`} className="font-mono tabular-nums text-slate-900 underline" dir="ltr">
                                    {formattedPhone}
                                  </a>
                                ) : (
                                  '—'
                                )}
                              </span>
                            </div>
                            {item.email && (
                              <div className="text-xs text-slate-600">
                                البريد:{' '}
                                <a href={`mailto:${item.email}`} className="font-mono text-slate-900 hover:underline" dir="ltr">
                                  {item.email}
                                </a>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      ) : (
        <>

      {/* Stats Cards Dashboard Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setProfileFilter('ALL')}
          className={`w-full text-right bg-white p-4 rounded-2xl border shadow-3xs transition-all cursor-pointer group ${
            profileFilter === 'ALL'
              ? 'border-blue-500 ring-2 ring-blue-500/15 bg-blue-50/20'
              : 'border-slate-200 hover:border-blue-300 hover:shadow-sm'
          }`}
          title="عرض جميع الأساتذة المسجلين"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase">إجمالي الأساتذة المسجلين</p>
            {profileFilter === 'ALL' && (
              <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                الكل
              </span>
            )}
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800">{totalTeachers}</h3>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl group-hover:scale-105 transition-transform">
              <GraduationCap className="h-5 w-5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setProfileFilter(prev => (prev === 'COMPLETE' ? 'ALL' : 'COMPLETE'))}
          aria-pressed={profileFilter === 'COMPLETE'}
          className={`w-full text-right bg-white p-4 rounded-2xl border shadow-3xs transition-all cursor-pointer group ${
            profileFilter === 'COMPLETE'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30'
              : 'border-slate-200 hover:border-emerald-300 hover:shadow-sm'
          }`}
          title="تصفية لعرض الملفات الشخصية المكتملة"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase">ملفات شخصية مكتملة</p>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                profileFilter === 'COMPLETE'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 opacity-80 group-hover:opacity-100'
              }`}
            >
              {profileFilter === 'COMPLETE' ? 'مُصفّى ✓' : 'انقر للتصفية'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-emerald-600">{completedProfiles}</h3>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-105 transition-transform">
              <UserCheck className="h-5 w-5" />
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setProfileFilter(prev => (prev === 'INCOMPLETE' ? 'ALL' : 'INCOMPLETE'))}
          aria-pressed={profileFilter === 'INCOMPLETE'}
          className={`w-full text-right bg-white p-4 rounded-2xl border shadow-3xs transition-all cursor-pointer group ${
            profileFilter === 'INCOMPLETE'
              ? 'border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/40'
              : 'border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 hover:shadow-sm'
          }`}
          title="انقر لعرض الملفات التي تحتاج استكمال البيانات"
        >
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] text-slate-500 font-bold uppercase">ملفات تحتاج استكمال</p>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                profileFilter === 'INCOMPLETE'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-700 opacity-85 group-hover:opacity-100'
              }`}
            >
              {profileFilter === 'INCOMPLETE' ? 'مُصفّى ✓' : 'انقر للعرض'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-amber-600">{incompleteProfiles}</h3>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-105 transition-transform">
              <AlertCircle className="h-5 w-5" />
            </span>
          </div>
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-72">
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            className="w-full text-xs pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
            placeholder="بحث بالإسم، رقم التأجير، المؤسسة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Quick Level Filter Pills */}
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 w-full pt-1">
          {[
            { id: '', label: `جميع الأسلاك (${teachers.length})`, icon: '👥' },
            { id: 'HIGH', label: `الثانوي التأهيلي (${teachers.filter(t => (t.teachingCadre || 'HIGH') === 'HIGH').length})`, icon: '🎓' },
            { id: 'MIDDLE', label: `الثانوي الإعدادي (${teachers.filter(t => t.teachingCadre === 'MIDDLE').length})`, icon: '📘' },
            { id: 'PRIMARY', label: `التعليم الابتدائي (${teachers.filter(t => t.teachingCadre === 'PRIMARY').length})`, icon: '🏫' },
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setSelectedCadre(f.id);
                if (f.id) {
                  setSearchParams({ cadre: f.id });
                } else {
                  setSearchParams({});
                }
              }}
              className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 text-center ${
                selectedCadre === f.id
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <span className="shrink-0">{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full md:w-auto">
          <Filter className="h-4 w-4 text-slate-400 shrink-0 hidden sm:block" />

          {/* Teaching Cadre Filter */}
          <select
            className="w-full sm:w-44 text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold cursor-pointer"
            value={selectedCadre}
            onChange={(e) => {
              setSelectedCadre(e.target.value);
              if (e.target.value) {
                setSearchParams({ cadre: e.target.value });
              } else {
                setSearchParams({});
              }
            }}
          >
            <option value="">جميع الأسلاك والأطر</option>
            <option value="PRIMARY">🏫 أستاذ التعليم الابتدائي</option>
            <option value="MIDDLE">📘 أستاذ الثانوي الإعدادي</option>
            <option value="HIGH">🎓 أستاذ الثانوي التأهيلي</option>
          </select>
          
          {/* Work Location Filter */}
          <select
            className="w-full sm:w-48 text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold cursor-pointer"
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
          >
            <option value="">جميع مقرات العمل (المؤسسات)</option>
            {uniqueLocations.map((loc) => (
              <option key={loc} value={loc}>
                📍 {loc}
              </option>
            ))}
          </select>

          {/* Referee Specialty Filter */}
          <select
            className="w-full sm:w-48 text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold cursor-pointer"
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
          >
            <option value="">جميع التخصصات الرياضية</option>
            {Object.entries(SPORTS_MAP).map(([key, sport]) => (
              <option key={key} value={key}>
                {sport.icon} {sport.name}
              </option>
            ))}
          </select>

          {(searchTerm || selectedSport || selectedLocation || selectedCadre || profileFilter !== 'ALL') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedSport('');
                setSelectedLocation('');
                setSelectedCadre('');
                setProfileFilter('ALL');
                setSearchParams({});
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              إلغاء الفلاتر
            </button>
          )}
        </div>
      </div>

      {profileFilter !== 'ALL' && (
        <div
          className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl border text-xs font-bold ${
            profileFilter === 'INCOMPLETE'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {profileFilter === 'INCOMPLETE' ? (
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            ) : (
              <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
            <span>
              {profileFilter === 'INCOMPLETE'
                ? `يتم الآن عرض الملفات التي تحتاج استكمال فقط (مقر العمل أو رقم التأجير غير مكتمل) — العدد: ${filteredTeachers.length}`
                : `يتم الآن عرض الملفات الشخصية المكتملة فقط — العدد: ${filteredTeachers.length}`}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setProfileFilter('ALL')}
            className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer text-[11px] font-bold"
          >
            عرض جميع الأساتذة
          </button>
        </div>
      )}

      {/* Main Table / Grid */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
          <p className="text-xs text-slate-500 font-medium">جاري تحميل لائحة الأساتذة...</p>
        </div>
      ) : filteredTeachers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-xs font-semibold">لا توجد نتائج تطابق خيارات البحث الحالية.</p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedSport('');
              setSelectedLocation('');
              setSelectedCadre('');
              setProfileFilter('ALL');
              setSearchParams({});
            }}
            className="mt-3 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
          >
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-4">الأستاذ المؤطر</th>
                  <th className="px-6 py-4">رقم التأجير (SOM)</th>
                  <th className="px-6 py-4">مقر العمل (المؤسسة)</th>
                  <th className="px-6 py-4">رقم الهاتف والتواصل</th>
                  <th className="px-6 py-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTeachers.map((teacher) => {
                  const formattedPhone = formatMoroccanPhone(teacher.phone);
                  const specialties = Array.isArray(teacher.refereeSpecialty) ? teacher.refereeSpecialty : (teacher.refereeSpecialty ? [teacher.refereeSpecialty] : []);
                  const matchedSchool = findMatchingSchoolForTeacher(schools, teacher);
                  const hasValidTeacherPhone = isValidPhoneNumber(teacher.phone);
                  const teacherPinMessage = matchedSchool?.accessCode
                    ? generateTeacherSecurityCodeWhatsAppMessage({
                        teacherName: teacher.fullName,
                        schoolName: matchedSchool.name,
                        accessCode: matchedSchool.accessCode
                      })
                    : '';

                  return (
                    <tr
                      key={`desktop-${teacher.id}`}
                      onClick={() => handleOpenTeacherDetail(teacher)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Name & Cadre */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden shadow-3xs group-hover:border-blue-400 transition-colors">
                            {teacher.photoUrl ? (
                              <img src={teacher.photoUrl} alt={teacher.fullName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{teacher.fullName[0].toUpperCase()}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-800 group-hover:text-blue-700 transition-colors flex items-center gap-1.5 flex-wrap">
                              <span>{teacher.fullName}</span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getCadreBadge(teacher.teachingCadre).bg}`}>
                                {getCadreBadge(teacher.teachingCadre).text}
                              </span>
                              {teacher.isTechCommitteeHead && (
                                <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-1.5 py-0.2 rounded border border-blue-200">
                                  رئيس لجنة
                                </span>
                              )}
                              {teacher.isTechCommitteeMember && (
                                <span className="text-[9px] bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.2 rounded border border-indigo-200">
                                  عضو لجنة
                                </span>
                              )}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium">{teacher.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Lease Number */}
                      <td className="px-6 py-4">
                        {teacher.leaseNumber ? (
                          <div className="flex items-center gap-1.5 font-bold text-slate-700">
                            <CreditCard className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                            <span className="font-mono text-xs">{teacher.leaseNumber}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">غير متوفر</span>
                        )}
                      </td>

                      {/* Work Location */}
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {teacher.workLocation ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                              <span className="font-bold text-slate-700">{teacher.workLocation}</span>
                            </div>
                            {isPrivilegedAdmin && matchedSchool?.accessCode && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-200 text-violet-900 text-[10px] font-mono font-black">
                                <KeyRound className="h-3 w-3 text-violet-600 shrink-0" />
                                <span>{matchedSchool.accessCode}</span>
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">لم يدخل بعد</span>
                        )}
                      </td>

                      {/* Phone & Contact */}
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-[11px] text-slate-600">
                          {formattedPhone ? (
                            <div className="flex items-center gap-1.5">
                              <a
                                href={`tel:${formattedPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg font-mono font-bold text-xs transition-colors"
                                title="اتصال بالهاتف"
                              >
                                <Phone className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span dir="ltr">{formattedPhone}</span>
                              </a>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">غير مسجل</span>
                          )}
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[150px]">{teacher.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {isPrivilegedAdmin && matchedSchool?.accessCode && (
                            hasValidTeacherPhone ? (
                              <a
                                href={getWhatsAppUrl(teacher.phone || '', teacherPinMessage)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toast.success(`تم فتح واتساب لإرسال رمز أمان ${matchedSchool.name} إلى ${teacher.fullName}`);
                                }}
                                className="px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-xl border border-green-700 transition-all cursor-pointer shadow-3xs flex items-center gap-1 text-[11px] font-black"
                                title={`إرسال رمز الأمان (${matchedSchool.accessCode}) مباشرة إلى ${teacher.fullName} عبر واتساب`}
                              >
                                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                                <span className="hidden xl:inline">رمز الأمان</span>
                              </a>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPinModalPhone(teacher.phone || '');
                                  setPinModalTarget({ teacher, school: matchedSchool });
                                }}
                                className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl border border-emerald-200 transition-all cursor-pointer shadow-3xs flex items-center gap-1 text-[11px] font-black"
                                title={`إرسال رمز الأمان (${matchedSchool.accessCode}) إلى ${teacher.fullName} عبر واتساب`}
                              >
                                <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                                <span className="hidden xl:inline">رمز الأمان</span>
                              </button>
                            )
                          )}
                          {canTechHeadImpersonate && ((teacher.role !== 'CENTRAL_ADMIN' && !teacher.isSuperAdmin) || (isOrigCentralAdmin && teacher.isTechCommitteeHead)) && (
                            <button
                              type="button"
                              onClick={(e) => handleStartImpersonation(teacher, e)}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl border border-indigo-700 transition-all cursor-pointer shadow-3xs flex items-center gap-1 text-[11px] font-black"
                              title={teacher.isTechCommitteeHead && isOrigCentralAdmin ? 'الدخول بصفة رئيس اللجنة التقنية مع الحفاظ على صفتك الأصلية' : 'الدخول بصفة هذا الأستاذ'}
                            >
                              <LogIn className="h-3.5 w-3.5" />
                              <span className="hidden xl:inline">{teacher.isTechCommitteeHead && isOrigCentralAdmin ? 'دخول كرئيس لجنة' : 'دخول بصفته'}</span>
                            </button>
                          )}
                          {canEditTeachers && (isCentralOrSportManager || (teacher.role !== 'CENTRAL_ADMIN' && !teacher.isSuperAdmin)) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenEditRole(teacher);
                              }}
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl border border-emerald-200 transition-all cursor-pointer shadow-3xs"
                              title="تعديل بيانات الأستاذ ومهامه"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {(userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'SPORT_MANAGER') && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteClick(e, teacher)}
                              className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition-all cursor-pointer shadow-3xs"
                              title="حذف حساب الأستاذ نهائياً"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreselectedTeacherId(teacher.id);
                              setIsBadgesModalOpen(true);
                            }}
                            className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-xl border border-amber-200 transition-all cursor-pointer shadow-3xs"
                            title="توليد شارة الاعتماد الرسمية"
                          >
                            <span className="text-xs">🪪</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenTeacherDetail(teacher);
                            }}
                            className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl border border-blue-200 transition-all cursor-pointer shadow-3xs"
                            title="عرض تفاصيل البطاقة"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden divide-y divide-slate-100">
            {filteredTeachers.map((teacher) => {
              const hasDetails = teacher.workLocation && teacher.leaseNumber;
              const specialties = Array.isArray(teacher.refereeSpecialty) ? teacher.refereeSpecialty : (teacher.refereeSpecialty ? [teacher.refereeSpecialty] : []);
              const matchedSchool = findMatchingSchoolForTeacher(schools, teacher);
              const hasValidTeacherPhone = isValidPhoneNumber(teacher.phone);
              const teacherPinMessage = matchedSchool?.accessCode
                ? generateTeacherSecurityCodeWhatsAppMessage({
                    teacherName: teacher.fullName,
                    schoolName: matchedSchool.name,
                    accessCode: matchedSchool.accessCode
                  })
                : '';

              return (
                <div
                  key={`mobile-${teacher.id}`}
                  onClick={() => handleOpenTeacherDetail(teacher)}
                  className="p-4 space-y-3 hover:bg-blue-50/30 transition-colors cursor-pointer"
                >
                  {/* Mobile Action Buttons: Icons only, centered above name */}
                  <div className="flex items-center justify-center flex-wrap gap-2 w-full pb-2.5 border-b border-slate-100">
                    {isPrivilegedAdmin && matchedSchool?.accessCode && (
                      hasValidTeacherPhone ? (
                        <a
                          href={getWhatsAppUrl(teacher.phone || '', teacherPinMessage)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.success(`تم فتح واتساب لإرسال رمز أمان ${matchedSchool.name} إلى ${teacher.fullName}`);
                          }}
                          className="px-2.5 py-2 bg-green-600 hover:bg-green-700 active:scale-95 text-white rounded-xl border border-green-700 transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1 text-[11px] font-black"
                          title={`إرسال رمز الأمان (${matchedSchool.accessCode}) للأستاذ عبر واتساب`}
                        >
                          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>إرسال رمز الأمان</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPinModalPhone(teacher.phone || '');
                            setPinModalTarget({ teacher, school: matchedSchool });
                          }}
                          className="px-2.5 py-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-800 rounded-xl border border-emerald-200 transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1 text-[11px] font-black"
                          title={`إرسال رمز الأمان (${matchedSchool.accessCode}) للأستاذ عبر واتساب`}
                        >
                          <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>إرسال رمز الأمان</span>
                        </button>
                      )
                    )}
                    {canTechHeadImpersonate && ((teacher.role !== 'CENTRAL_ADMIN' && !teacher.isSuperAdmin) || (isOrigCentralAdmin && teacher.isTechCommitteeHead)) && (
                      <button
                        type="button"
                        onClick={(e) => handleStartImpersonation(teacher, e)}
                        className="px-2.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl border border-indigo-700 transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1 text-[11px] font-black"
                        title={teacher.isTechCommitteeHead && isOrigCentralAdmin ? 'الدخول بصفة رئيس اللجنة التقنية مع الحفاظ على صفتك الأصلية' : 'الدخول بصفة هذا الأستاذ'}
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        <span>{teacher.isTechCommitteeHead && isOrigCentralAdmin ? 'الدخول كرئيس لجنة' : 'الدخول بصفة الأستاذ'}</span>
                      </button>
                    )}
                    {canEditTeachers && (isCentralOrSportManager || (teacher.role !== 'CENTRAL_ADMIN' && !teacher.isSuperAdmin)) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEditRole(teacher);
                        }}
                        className="p-2 bg-emerald-50 hover:bg-emerald-100 active:scale-95 text-emerald-700 rounded-xl border border-emerald-200 transition-all cursor-pointer shadow-3xs flex items-center justify-center"
                        title="تعديل بيانات الأستاذ ومهامه"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {(userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'SPORT_MANAGER') && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteClick(e, teacher)}
                        className="p-2 bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 rounded-xl border border-red-200 transition-all cursor-pointer shadow-3xs flex items-center justify-center"
                        title="حذف حساب الأستاذ نهائياً"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreselectedTeacherId(teacher.id);
                        setIsBadgesModalOpen(true);
                      }}
                      className="p-2 bg-amber-50 hover:bg-amber-100 active:scale-95 text-amber-700 rounded-xl border border-amber-200 transition-all cursor-pointer shadow-3xs flex items-center justify-center"
                      title="توليد شارة الاعتماد الرسمية"
                    >
                      <span className="text-sm leading-none">🪪</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenTeacherDetail(teacher);
                      }}
                      className="p-2 bg-blue-50 hover:bg-blue-100 active:scale-95 text-blue-700 rounded-xl border border-blue-200 transition-all cursor-pointer shadow-3xs flex items-center justify-center"
                      title="عرض تفاصيل الأستاذ"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Teacher Info Row */}
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden shadow-2xs">
                      {teacher.photoUrl ? (
                        <img src={teacher.photoUrl} alt={teacher.fullName} className="w-full h-full object-cover" />
                      ) : (
                        <span>{teacher.fullName[0].toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                        <span>{teacher.fullName}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${getCadreBadge(teacher.teachingCadre).bg}`}>
                          {getCadreBadge(teacher.teachingCadre).text}
                        </span>
                        {teacher.isTechCommitteeHead && (
                          <span className="text-[9px] bg-blue-100 text-blue-800 font-black px-1.5 py-0.2 rounded border border-blue-200">
                            رئيس لجنة
                          </span>
                        )}
                        {teacher.isTechCommitteeMember && (
                          <span className="text-[9px] bg-indigo-100 text-indigo-800 font-black px-1.5 py-0.2 rounded border border-indigo-200">
                            عضو لجنة
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{teacher.email}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-slate-400 font-bold mb-0.5 text-[9px] uppercase">رقم التأجير</p>
                      {teacher.leaseNumber ? (
                        <span className="font-mono font-bold text-slate-800 text-[11px] block">{teacher.leaseNumber}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">غير متوفر</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold mb-0.5 text-[9px] uppercase">رقم الهاتف</p>
                      {teacher.phone ? (
                        <span className="font-mono font-bold text-slate-800 text-[11px] block" dir="ltr">{teacher.phone}</span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">غير مسجل</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold mb-0.5 text-[9px] uppercase">المؤسسة</p>
                      <span className="font-bold text-slate-800 truncate block text-[11px]">
                        {teacher.workLocation || 'غير محددة'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
        </>
      )}

      {/* Add / Edit Administrative Cadre Modal */}
      {isAdminCadreModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg overflow-hidden shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-5 w-5 text-slate-800 shrink-0" />
                <h3 className="text-base font-bold text-slate-900">
                  {editingAdminCadre ? 'تعديل بيانات الإطار الإداري' : 'إضافة إطار إداري جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAdminCadreModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdminCadre} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الاسم والنسب <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, fullName: e.target.value }))}
                  placeholder="مثال: أمين سنوسي"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم التأجير
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={adminForm.leaseNumber}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, leaseNumber: e.target.value }))}
                  placeholder="مثال: 1234567"
                  className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500 text-right"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الإطار <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['مفتش', 'رئيس مكتب التربية البدنية', 'إطار إداري'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdminForm((prev) => ({ ...prev, cadre: preset }))}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                        adminForm.cadre.trim() === preset
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  required
                  value={adminForm.cadre}
                  onChange={(e) => setAdminForm((prev) => ({ ...prev, cadre: e.target.value }))}
                  placeholder="مفتش / رئيس مكتب التربية البدنية..."
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    رقم الهاتف
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={adminForm.phone}
                    onChange={(e) => setAdminForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="0661234567"
                    className="w-full px-3.5 py-2.5 text-sm font-mono tabular-nums bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    value={adminForm.email}
                    onChange={(e) => setAdminForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="example@gmail.com"
                    className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-500 text-right"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAdminCadreModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdminCadre}
                  className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-60"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSavingAdminCadre ? 'جاري الحفظ...' : editingAdminCadre ? 'حفظ التعديلات' : 'حفظ الإطار الإداري'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Delete Administrative Cadre Modal */}
      {adminCadreToDelete && (
        <ConfirmDeleteModal
          isOpen={true}
          onClose={() => setAdminCadreToDelete(null)}
          onConfirm={handleConfirmDeleteAdminCadre}
          title="حذف إطار إداري"
          message={`هل أنت متأكد من رغبتك في حذف ${adminCadreToDelete.fullName} من لائحة الأطر الإدارية؟`}
          itemName={adminCadreToDelete.fullName}
          isDeleting={isDeletingAdminCadre}
        />
      )}

      {/* Send School Security Code via WhatsApp Modal (when phone number is missing or needs confirmation) */}
      {pinModalTarget && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          dir="rtl"
          onClick={() => setPinModalTarget(null)}
        >
          <div
            className="bg-white rounded-2xl border border-slate-200 w-full max-w-md overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-gradient-to-l from-emerald-700 to-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/15">
                  <KeyRound className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black">إرسال رمز الأمان للأستاذ عبر واتساب</h3>
                  <p className="text-[11px] text-emerald-100">{pinModalTarget.school.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalTarget(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="text-xs">
                  <p className="font-black text-slate-900">{pinModalTarget.teacher.fullName}</p>
                  <p className="text-[11px] text-slate-500 font-semibold">{pinModalTarget.school.name}</p>
                </div>
                <div className="flex items-center gap-1.5 bg-white border border-violet-200 px-2.5 py-1 rounded-lg">
                  <span className="font-mono font-black text-sm text-violet-900">
                    {pinModalTarget.school.accessCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (pinModalTarget.school.accessCode) {
                        navigator.clipboard.writeText(pinModalTarget.school.accessCode);
                        toast.success('تم نسخ رمز الأمان');
                      }
                    }}
                    className="p-1 text-violet-600 hover:bg-violet-50 rounded cursor-pointer"
                    title="نسخ رمز الأمان"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  رقم هاتف الأستاذ للواتساب (اختياري):
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={pinModalPhone}
                  onChange={(e) => setPinModalPhone(e.target.value)}
                  placeholder="0661234567"
                  className="w-full px-3.5 py-2 text-sm font-mono font-bold bg-white border border-slate-200 rounded-xl text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  إذا تُرك فارغاً، سيفتح واتساب بالرسالة الجاهزة لتختار جهة الاتصال مباشرة.
                </p>
              </div>

              {(() => {
                const msg = generateTeacherSecurityCodeWhatsAppMessage({
                  teacherName: pinModalTarget.teacher.fullName,
                  schoolName: pinModalTarget.school.name,
                  accessCode: pinModalTarget.school.accessCode || ''
                });
                const url = getWhatsAppUrl(pinModalPhone, msg);
                const validPhone = isValidPhoneNumber(pinModalPhone);
                return (
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(msg);
                        toast.success('تم نسخ نص رسالة رمز الأمان');
                      }}
                      className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>نسخ الرسالة</span>
                    </button>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => {
                        toast.success(
                          validPhone
                            ? `تم فتح واتساب لإرسال رمز الأمان إلى ${pinModalTarget.teacher.fullName}`
                            : 'تم فتح واتساب بالرسالة الجاهزة — اختر الأستاذ من جهات اتصالك'
                        );
                        setPinModalTarget(null);
                      }}
                      className="px-4 py-2 text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span>{validPhone ? 'إرسال عبر واتساب الآن' : 'فتح واتساب واختيار جهة الاتصال'}</span>
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Teacher Detail Modal */}
      {isDetailModalOpen && (
        <TeacherDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          teacher={selectedTeacherModal}
          teacherStudents={teacherStudents}
          matchedSchool={selectedTeacherModal ? findMatchingSchoolForTeacher(schools, selectedTeacherModal) || null : null}
          canSendSecurityCode={isPrivilegedAdmin}
          onEditRole={
            canEditTeachers &&
            selectedTeacherModal &&
            (isCentralOrSportManager || (selectedTeacherModal.role !== 'CENTRAL_ADMIN' && !selectedTeacherModal.isSuperAdmin))
              ? handleOpenEditRole
              : undefined
          }
          onImpersonateTeacher={canTechHeadImpersonate ? (t) => handleStartImpersonation(t) : undefined}
        />
      )}

      {/* Edit Teacher Role/Cadre Modal */}
      {isEditRoleModalOpen && (
        <EditTeacherRoleModal
          isOpen={isEditRoleModalOpen}
          onClose={() => setIsEditRoleModalOpen(false)}
          teacher={selectedTeacherForEdit}
          schools={schools}
          onSuccess={handleTeacherUpdated}
          onDelete={handleTeacherDeleted}
        />
      )}

      {/* Confirm Direct Delete Modal */}
      {isDeleteModalOpen && teacherToDelete && (
        <ConfirmDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setTeacherToDelete(null);
          }}
          onConfirm={handleConfirmDelete}
          title="حذف حساب الأستاذ نهائياً"
          message={`هل أنت متأكد من رغبتك في حذف حساب الأستاذ ${teacherToDelete.fullName} بالكامل؟ سيؤدي ذلك لإزالة بياناته وملفه التعريفي من النظام بشكل نهائي.`}
          itemName={teacherToDelete.fullName}
          isDeleting={isDeleting}
        />
      )}

      {/* Confirm Delete All Modal */}
      {showDeleteAllModal && (
        <ConfirmDeleteModal
          isOpen={showDeleteAllModal}
          onClose={() => setShowDeleteAllModal(false)}
          onConfirm={handleDeleteAllTeachers}
          title="حذف جميع حسابات الأطر التربوية"
          message={`تحذير خطير: أنت على وشك حذف جميع حسابات الأطر التربوية (${teachers.length}) المسجلين في مديريتك الحالية. هذا الإجراء سيؤدي لحذف وصولهم للنظام وبياناتهم الشخصية بشكل نهائي. هل أنت متأكد؟`}
          itemName="جميع الأطر التربوية"
          isDeleting={isDeletingAll}
        />
      )}

      {/* Teacher Badges Modal */}
      {isBadgesModalOpen && (
        <TeacherBadgesModal
          isOpen={isBadgesModalOpen}
          onClose={() => {
            setIsBadgesModalOpen(false);
            setPreselectedTeacherId(undefined);
          }}
          teachers={teachers}
          schools={schools}
          directorateObj={activeDirObj}
          officialLogos={officialLogos}
          activeSeason={activeSeason}
          preselectedTeacherId={preselectedTeacherId}
        />
      )}
    </div>
  );
};

export default Teachers;
