import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP, AGE_CATEGORIES, deduplicateById, generateSecureAccessCode } from '../lib/dataService';
import { School, Match, Directorate } from '../types';
import * as XLSX from 'xlsx';
import {
  Plus,
  Search,
  School as SchoolIcon,
  MapPin,
  User,
  Users,
  Phone,
  PhoneCall,
  Edit3,
  Trash2,
  Filter,
  CheckCircle2,
  Building2,
  GraduationCap,
  FileSpreadsheet,
  Download,
  Upload,
  ShieldCheck,
  LayoutGrid,
  List,
  FileText,
  ChevronDown,
  Check,
  Copy,
  KeyRound,
  Send,
  Lock
} from 'lucide-react';
import { CreateSchoolModal } from '../components/CreateSchoolModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { SchoolParticipantsModal } from '../components/SchoolParticipantsModal';
import toast from 'react-hot-toast';
import { useRolePermissions } from '../hooks/useRolePermissions';

export const Schools: React.FC = () => {
  const { userProfile } = useAuth();
  const { canDo } = useRolePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [schools, setSchools] = useState<School[]>([]);
  const [activeDirObj, setActiveDirObj] = useState<Directorate | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [communeFilter, setCommuneFilter] = useState<string>('ALL');
  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string>('ALL');
  const [schoolSelectQuery, setSchoolSelectQuery] = useState<string>('');
  const [isSchoolDropdownOpen, setIsSchoolDropdownOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [schoolToDelete, setSchoolToDelete] = useState<School | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [selectedSchoolForParticipants, setSelectedSchoolForParticipants] = useState<School | null>(null);

  // CENTRAL_ADMIN, SPORT_MANAGER, and Technical Committee Head can manage schools
  const isTechCommitteeHead = !!userProfile?.isTechCommitteeHead;
  const isTeacher = userProfile?.role === 'TEACHER';
  const canManage = userProfile?.role === 'CENTRAL_ADMIN' || 
                    userProfile?.role === 'SPORT_MANAGER' || 
                    isTechCommitteeHead;

  // Determine user's primary/preferred sport specialty for automatic focus on login
  const preferredSportId = useMemo(() => {
    if (!userProfile) return 'ALL';
    
    // 1. Sport Manager
    if (userProfile.role === 'SPORT_MANAGER') {
      return userProfile.sportId || 'ALL';
    }
    
    // 2. Technical Committee Head
    if (userProfile.isTechCommitteeHead && userProfile.techCommitteeSports && userProfile.techCommitteeSports.length > 0) {
      return userProfile.techCommitteeSports[0];
    }
    
    // 3. Technical Committee Member
    if (userProfile.isTechCommitteeMember && userProfile.techCommitteeSportsMemberOf && userProfile.techCommitteeSportsMemberOf.length > 0) {
      return userProfile.techCommitteeSportsMemberOf[0];
    }
    
    // 4. Fallback userProfile.sportId
    if (userProfile.sportId) {
      return userProfile.sportId;
    }
    
    return 'ALL';
  }, [userProfile]);

  // Default selected sport is 'ALL' so all institutions are visible when entering the page
  // (We do not auto-force selectedSport to preferredSportId to avoid unintentionally hiding institutions)

  useEffect(() => {
    loadSchools();
    const handleRefresh = () => {
      loadSchools();
    };
    window.addEventListener('directorateChanged', handleRefresh);
    window.addEventListener('schoolsUpdated', handleRefresh);
    return () => {
      window.removeEventListener('directorateChanged', handleRefresh);
      window.removeEventListener('schoolsUpdated', handleRefresh);
    };
  }, []);

  const loadSchools = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [list, mList, studList, activeDir] = await Promise.all([
        DataService.getSchools(),
        DataService.getMatches(),
        DataService.getStudents(),
        DataService.getActiveDirectorate()
      ]);

      const dirSchools = list.filter(s => 
        s && 
        s.name && 
        !s.name.includes('الكندي') && 
        !s.name.includes('غير محدد') && 
        (s.directorateId === activeDirId || (!s.directorateId && activeDirId === 'taourirt'))
      );
      const dirMatches = mList.filter(m => (m.directorateId || 'taourirt') === activeDirId);
      const dirStudents = studList.filter(st => (st.directorateId || 'taourirt') === activeDirId);

      setActiveDirObj(activeDir);
      setSchools(deduplicateById<School>(dirSchools));
      setMatches(dirMatches);
      setStudents(dirStudents);
    } catch (e) {
      console.error(e);
      toast.error('تعذر تحميل لائحة المؤسسات والفرق');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSchool = async (schoolData: Omit<School, 'id'>) => {
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const fullSchoolData = { ...schoolData, directorateId: activeDirId };
      if (editingSchool) {
        await DataService.updateSchool(editingSchool.id, fullSchoolData);
        setSchools(prev => deduplicateById<School>(prev.map(s => s.id === editingSchool.id ? { ...s, ...fullSchoolData } : s)));
        toast.success('تم تحديث بيانات المؤسسة بنجاح');
        setEditingSchool(null);
      } else {
        const created = await DataService.addSchool(fullSchoolData);
        setSchools(prev => deduplicateById<School>([created, ...prev]));
        toast.success('تمت إضافة المؤسسة التعليمية بنجاح');
      }
    } catch (e) {
      toast.error('حدث خطأ أثناء حفظ المؤسسة');
    }
  };

  const handleConfirmDelete = async () => {
    if (!schoolToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteSchool(schoolToDelete.id);
      setSchools(prev => prev.filter(s => s.id !== schoolToDelete.id));
      toast.success('تم حذف المؤسسة بنجاح');
      setSchoolToDelete(null);
    } catch (e) {
      toast.error('تعذر حذف المؤسسة');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAllSchools = async () => {
    setIsDeletingAll(true);
    try {
      await DataService.deleteAllSchools();
      toast.success('تم حذف جميع المؤسسات التعليمية بنجاح');
      await loadSchools();
      setShowDeleteAllModal(false);
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء محاولة حذف الكل');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleDownloadExcelTemplate = () => {
    try {
      const headers = [
        'اسم المؤسسة التعليمية *',
        'السلك التعليمي (تأهيلي / إعدادي / ابتدائي)',
        'الجماعة / الدائرة',
        'اسم المنسق (أستاذ التربية البدنية)',
        'هاتف المنسق',
        'اسم مدير المؤسسة',
        'هاتف مدير المؤسسة'
      ];

      const sampleRows = [
        [
          'ثانوية الفتح التأهيلية',
          'تأهيلي',
          'تاوريرت المركز',
          'ذ. عبد الرحيم بلقاسم',
          '0661234567',
          'ذ. محمد اليعقوبي',
          '0661998877'
        ],
        [
          'إعدادية ابن سينا',
          'إعدادي',
          'تاوريرت',
          'ذة. فاطمة الزهراء بنعلي',
          '0663456789',
          'ذ. حسن المنصوري',
          '0663776655'
        ],
        [
          'مجموعة مدارس دبدو',
          'ابتدائي',
          'دبدو',
          'ذ. يوسف المراكشي',
          '0665678901',
          'ذ. عبد القادر الفاسي',
          '0665554433'
        ]
      ];

      const wsData = [headers, ...sampleRows];
      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!cols'] = [
        { wch: 35 },
        { wch: 25 },
        { wch: 20 },
        { wch: 30 },
        { wch: 18 },
        { wch: 25 },
        { wch: 18 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المؤسسات التعليمية');
      XLSX.writeFile(wb, 'نموذج_تعبئة_المؤسسات_التعليمية_مديرية_تاوريرت.xlsx');
      toast.success('تم تحميل نموذج Excel بنجاح. يرجى تعبئته بمعلومات مؤسسات الإقليم ثم استيراده.');
    } catch (err) {
      console.error('Error downloading template:', err);
      toast.error('حدث خطأ أثناء تنزيل نموذج الإكسيل');
    }
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const toastId = toast.loading('جاري قراءة ملف Excel واستيراد المؤسسات التعليمية...');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const ws = wb.Sheets[firstSheetName];
      const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!jsonData || jsonData.length === 0) {
        toast.error('الملف فارغ أو لا يحتوي على بيانات صالحة', { id: toastId });
        return;
      }

      const parsedSchools: Omit<School, 'id'>[] = [];

      for (const row of jsonData) {
        const schoolName = (
          row['اسم المؤسسة التعليمية *'] ||
          row['اسم المؤسسة التعليمية'] ||
          row['اسم المؤسسة'] ||
          row['المؤسسة'] ||
          row['المؤسسة التعليمية'] ||
          row['School'] ||
          row['name'] ||
          ''
        ).toString().trim();

        if (!schoolName || schoolName.startsWith('#') || schoolName.includes('اسم المؤسسة')) {
          continue;
        }

        const rawType = (
          row['السلك التعليمي (تأهيلي / إعدادي / ابتدائي)'] ||
          row['السلك التعليمي'] ||
          row['السلك'] ||
          row['النوع'] ||
          row['type'] ||
          'تأهيلي'
        ).toString().trim();

        let normalizedType = 'تأهيلي';
        if (rawType.includes('إعداد') || rawType.includes('اعداد')) {
          normalizedType = 'إعدادي';
        } else if (rawType.includes('ابتدائ')) {
          normalizedType = 'ابتدائي';
        } else {
          normalizedType = 'تأهيلي';
        }

        const commune = (
          row['الجماعة / الدائرة'] ||
          row['الجماعة'] ||
          row['الدائرة'] ||
          row['المدينة'] ||
          row['commune'] ||
          'تاوريرت المركز'
        ).toString().trim();

        const coordinatorName = (
          row['اسم المنسق (أستاذ التربية البدنية)'] ||
          row['اسم المنسق'] ||
          row['المنسق'] ||
          row['أستاذ التربية البدنية المنسق'] ||
          row['المؤطر'] ||
          row['اسم المؤطر'] ||
          row['teacherName'] ||
          'منسق المادة'
        ).toString().trim();

        const phone = (
          row['هاتف المنسق'] ||
          row['هاتف المؤطر'] ||
          row['الهاتف'] ||
          row['phone'] ||
          ''
        ).toString().trim();

        const principalName = (
          row['اسم مدير المؤسسة'] ||
          row['اسم المدير'] ||
          row['المدير'] ||
          row['principalName'] ||
          ''
        ).toString().trim();

        const principalPhone = (
          row['هاتف مدير المؤسسة'] ||
          row['هاتف المدير'] ||
          row['principalPhone'] ||
          ''
        ).toString().trim();

        parsedSchools.push({
          name: schoolName,
          type: normalizedType,
          commune: commune || 'تاوريرت المركز',
          teacherName: coordinatorName,
          coordinatorName: coordinatorName,
          phone: phone || undefined,
          principalName: principalName || undefined,
          principalPhone: principalPhone || undefined
        });
      }

      if (parsedSchools.length === 0) {
        toast.error('لم يتم العثور على أي صفوف صالحة للمؤسسات في ملف Excel المرفوع.', { id: toastId });
        return;
      }

      await DataService.addSchoolsBulk(parsedSchools);
      await loadSchools();
      toast.success(`تم بنجاح استيراد وتحديث ${parsedSchools.length} مؤسسة تعليمية بمديرية تاوريرت!`, { id: toastId });
    } catch (err) {
      console.error('Error importing Excel:', err);
      toast.error('حدث خطأ أثناء معالجة ملف Excel، يرجى التأكد من التنسيق وإعادة المحاولة', { id: toastId });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendPinViaWhatsApp = (school: School) => {
    const phone = school.principalPhone || school.phone;
    if (!phone) {
      toast.error('لم يتم تسجيل هاتف لمدير المؤسسة أو المنسق لإرسال الرمز إليه');
      return;
    }
    
    // Clean phone number: remove spaces, dashes, ensure country code is 212
    let cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '212' + cleanPhone.substring(1);
    } else if (!cleanPhone.startsWith('212')) {
      cleanPhone = '212' + cleanPhone;
    }
    
    const message = `السلام عليكم ورحمة الله وبركاته،\nالسيد(ة) مدير(ة) مؤسسة *${school.name}*،\n\nإليكم الرمز السري للأمان (Access Code) الخاص بمؤسستكم لتفعيل حسابات الأساتذة في منصة البطولة الإقليمية المدرسية:\n\n*الرمز السري الخاص بمؤسستكم: [ ${school.accessCode || ''} ]*\n\nيرجى تسليم هذا الرمز لأساتذة التربية البدنية العاملين بالمؤسسة لتمكينهم من استكمال ملفاتهم الشخصية والتسجيل الآمن بالمنصة.\n\nمع خالص التقدير والتحية.`;
    
    const encodedText = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
    toast.success('تم فتح واتساب لإرسال الرمز السري بنجاح!');
  };

  const handleRegenerateCodes = async () => {
    try {
      setIsLoading(true);
      const toastId = toast.loading('جاري تأمين وتحديث الرموز السرية للمؤسسات...');
      
      let updatedCount = 0;
      for (const school of schools) {
        if (school.accessCode && /^\d+$/.test(school.accessCode)) {
          const newCode = generateSecureAccessCode();
          await DataService.updateSchool(school.id, { accessCode: newCode });
          updatedCount++;
        }
      }
      
      await loadSchools();
      
      if (updatedCount > 0) {
        toast.success(`تم تأمين وتحديث ${updatedCount} رمزاً سرياً بنجاح!`, { id: toastId });
      } else {
        toast.success('جميع المؤسسات تمتلك رموزاً سرية آمنة بالفعل', { id: toastId });
      }
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحديث الرموز السرية');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCurrentSchools = () => {
    try {
      const exportData = schools.map((s, idx) => ({
        'الرقم': idx + 1,
        'اسم المؤسسة التعليمية': s.name,
        'السلك التعليمي': s.type === 'تأهيلي' ? 'ثانوي تأهيلي' : s.type === 'إعدادي' ? 'ثانوي إعدادي' : 'ابتدائي',
        'الجماعة / الدائرة': s.commune,
        'المنسق (أستاذ التربية البدنية)': s.coordinatorName || s.teacherName,
        'هاتف المنسق': s.phone || '',
        'اسم مدير المؤسسة': s.principalName || '',
        'هاتف مدير المؤسسة': s.principalPhone || ''
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      ws['!cols'] = [
        { wch: 8 },
        { wch: 35 },
        { wch: 20 },
        { wch: 20 },
        { wch: 30 },
        { wch: 18 },
        { wch: 25 },
        { wch: 18 }
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'المؤسسات التعليمية تاوريرت');
      XLSX.writeFile(wb, 'المؤسسات_التعليمية_مديرية_تاوريرت.xlsx');
      toast.success(`تم تصدير ${schools.length} مؤسسة تعليمية إلى Excel بنجاح!`);
    } catch (err) {
      console.error('Error exporting schools:', err);
      toast.error('حدث خطأ أثناء تصدير البيانات إلى Excel');
    }
  };

  const participatingSchoolIdsForSport = useMemo(() => {
    if (selectedSport === 'ALL') return null;

    const ids = new Set<string>();

    // 1. Schools with matches in this sport
    matches.forEach(m => {
      if (m.sportId === selectedSport) {
        if (m.team1Id) ids.add(m.team1Id);
        if (m.team2Id) ids.add(m.team2Id);
      }
    });

    // 2. Schools with registered students in this sport
    students.forEach(s => {
      if (s.sportId === selectedSport) {
        if (s.schoolId) ids.add(s.schoolId);
        if (s.schoolName) ids.add(s.schoolName.trim().toLowerCase());
        const school = schools.find(sch => sch.id === s.schoolId || sch.name.trim().toLowerCase() === s.schoolName?.trim().toLowerCase());
        if (school) {
          ids.add(school.id);
          ids.add(school.name.trim().toLowerCase());
        }
      }
    });

    return ids;
  }, [selectedSport, matches, students, schools]);

  const isTeacherSchool = (s: School) => {
    if (!userProfile?.workLocation) return false;
    const cleanWorkLoc = userProfile.workLocation.trim().toLowerCase();
    const cleanSchoolName = (s.name || '').trim().toLowerCase();
    return (
      cleanSchoolName === cleanWorkLoc ||
      cleanSchoolName.includes(cleanWorkLoc) ||
      cleanWorkLoc.includes(cleanSchoolName) ||
      (userProfile.schoolId && s.id === userProfile.schoolId)
    );
  };

  const filtered = useMemo(() => {
    const list = schools.filter(s => {
      const coordinatorStr = (s.coordinatorName || s.teacherName || '').toLowerCase();
      const principalStr = (s.principalName || '').toLowerCase();
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
                          s.commune.toLowerCase().includes(search.toLowerCase()) ||
                          coordinatorStr.includes(search.toLowerCase()) ||
                          principalStr.includes(search.toLowerCase()) ||
                          (s.phone || '').includes(search) ||
                          (s.principalPhone || '').includes(search);
      const matchType = typeFilter === 'ALL' || s.type === typeFilter;
      const matchCommune = communeFilter === 'ALL' || s.commune.includes(communeFilter);
      const matchSport = selectedSport === 'ALL' || (participatingSchoolIdsForSport && (
        participatingSchoolIdsForSport.has(s.id) || 
        participatingSchoolIdsForSport.has(s.name.trim().toLowerCase())
      ));
      const matchSchool = selectedSchoolFilter === 'ALL' || s.id === selectedSchoolFilter || s.name === selectedSchoolFilter;
      return matchSearch && matchType && matchCommune && matchSport && matchSchool;
    });

    if (userProfile?.workLocation) {
      list.sort((a, b) => {
        const aMine = isTeacherSchool(a);
        const bMine = isTeacherSchool(b);
        if (aMine && !bMine) return -1;
        if (!aMine && bMine) return 1;
        return 0;
      });
    }

    return list;
  }, [schools, search, typeFilter, communeFilter, selectedSport, selectedSchoolFilter, participatingSchoolIdsForSport, userProfile?.workLocation, userProfile?.schoolId]);

  const highSchoolsCount = schools.filter(s => s.type === 'تأهيلي').length;
  const middleSchoolsCount = schools.filter(s => s.type === 'إعدادي').length;
  const primarySchoolsCount = schools.filter(s => s.type === 'ابتدائي').length;

  return (
    <div className="space-y-4" dir="rtl">
      {/* Hidden file input for Excel upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportExcel}
        accept=".xlsx, .xls, .csv"
        className="hidden"
      />

      {/* Top Header with Centered Headings and Specialized Icon Action Buttons */}
      <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col items-center text-center gap-4">
        {/* Centered Headings */}
        <div className="flex flex-col items-center max-w-2xl">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center shadow-2xs">
              <SchoolIcon className="w-4 h-4" />
            </div>
            <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">دليل المؤسسات التعليمية</h2>
            <span className="text-xs bg-blue-50 text-blue-700 font-extrabold px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
              {activeDirObj?.name || 'المديرية الإقليمية'}
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1.5 leading-relaxed">
            قائمة المؤسسات التعليمية والمنسقين والإدارة التربوية لـ {activeDirObj?.name || 'المديرية الإقليمية'}
          </p>
        </div>

        {/* Specialized Icon Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 w-full pt-1">
          {/* Download blank Excel template */}
          <button
            onClick={handleDownloadExcelTemplate}
            title="تحميل نموذج إكسيل فارغ لتعبئة مؤسسات الإقليم"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-emerald-50/80 px-3.5 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 transition-all shadow-2xs hover:shadow-xs active:scale-97 cursor-pointer whitespace-nowrap"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Download className="h-3.5 w-3.5" />
            </div>
            <span>تحميل نموذج Excel فارغ</span>
          </button>

          {/* Import Excel */}
          {canManage && canDo('action:import_data') && (
            <button
              onClick={() => fileInputRef.current?.click()}
              title="استيراد وتعبئة المؤسسات التعليمية من ملف إكسيل"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50/80 px-3.5 py-2.5 text-xs font-black text-indigo-800 hover:bg-indigo-100 hover:border-indigo-400 transition-all shadow-2xs hover:shadow-xs active:scale-97 cursor-pointer whitespace-nowrap"
            >
              <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                <Upload className="h-3.5 w-3.5" />
              </div>
              <span>استيراد من Excel</span>
            </button>
          )}

          {/* Export current schools */}
          {canDo('action:export_data') && (
            <button
              onClick={handleExportCurrentSchools}
              title="تصدير القائمة الحالية للمؤسسات التعليمية إلى ملف إكسيل"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition-all shadow-2xs hover:shadow-xs active:scale-97 cursor-pointer whitespace-nowrap"
            >
              <div className="w-6 h-6 rounded-lg bg-slate-700 text-white flex items-center justify-center shadow-2xs shrink-0">
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </div>
              <span>تصدير إلى Excel</span>
            </button>
          )}

          {/* Manual Add School */}
          {canManage && (
            <button
              onClick={() => {
                setEditingSchool(null);
                setIsModalOpen(true);
              }}
              title="إضافة مؤسسة تعليمية جديدة"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-black text-white shadow-sm hover:from-blue-700 hover:to-indigo-700 transition-all hover:shadow-md active:scale-97 cursor-pointer whitespace-nowrap border border-blue-500/30"
            >
              <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center shadow-2xs shrink-0">
                <Plus className="h-4 w-4 text-white" />
              </div>
              <span>إضافة مؤسسة تعليمية</span>
            </button>
          )}

          {/* Central Admin Only Actions */}
          {userProfile?.role === 'CENTRAL_ADMIN' && schools.length > 0 && (
            <>
              <button
                onClick={handleRegenerateCodes}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-50 border border-orange-300 px-3.5 py-2.5 text-xs font-black text-orange-800 shadow-2xs hover:bg-orange-100 transition-all hover:shadow-xs active:scale-97 cursor-pointer whitespace-nowrap disabled:opacity-50"
                title="تحديث جميع الرموز السرية القديمة إلى رموز أكثر أماناً"
              >
                <div className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center shadow-2xs shrink-0">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <span>تحديث الرموز القديمة</span>
              </button>
              <button
                onClick={() => setShowDeleteAllModal(true)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 border border-red-300 px-3.5 py-2.5 text-xs font-black text-red-700 shadow-2xs hover:bg-red-100 transition-all hover:shadow-xs active:scale-97 cursor-pointer whitespace-nowrap"
                title="حذف جميع المؤسسات المسجلة في هذه المديرية"
              >
                <div className="w-6 h-6 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-2xs shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </div>
                <span>حذف الكل</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Teacher's School Highlight Notice & Permissions Banner */}
      {userProfile?.workLocation && (
        <div className="p-3.5 bg-gradient-to-r from-amber-500/15 via-amber-50 to-white border border-amber-300/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 font-bold shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shadow-2xs shrink-0">
              🏫
            </div>
            <div>
              <p className="font-extrabold text-amber-950">
                مرحباً بك يا أستاذ! تم إبراز مؤسستك (<span className="text-amber-900 underline font-black">{userProfile.workLocation}</span>) في أول القائمة لتيسير الولوج إليها.
              </p>
              <p className="text-[11px] text-amber-800 font-normal mt-0.5">
                {isTeacher
                  ? 'بصفتك أستاذاً، يمكنك الاطلاع على بيانات المؤسسات المشاركة، بينما الولوج إلى لوائح وتدبير المشاركين متاح حصرياً لمؤسستك فقط.'
                  : 'تظهر مؤسستك دائماً في المرتبة الأولى لتسهيل الوصول المباشر إلى تلاميذك ومشاركاتك.'}
              </p>
            </div>
          </div>
          <span className="shrink-0 self-start sm:self-center inline-flex items-center gap-1 text-[11px] font-black bg-amber-500 text-white px-3 py-1 rounded-full shadow-2xs">
            <span>مؤسستي أولاً</span>
            <span>⭐</span>
          </span>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setTypeFilter('تأهيلي')}
          className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
            typeFilter === 'تأهيلي'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-blue-200'
          }`}
        >
          <span className="text-[10px] font-bold text-blue-700 uppercase">الثانوي التأهيلي</span>
          <p className="text-lg md:text-xl font-black text-slate-800 mt-1">{highSchoolsCount}</p>
        </button>

        <button
          onClick={() => setTypeFilter('إعدادي')}
          className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
            typeFilter === 'إعدادي'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-emerald-200'
          }`}
        >
          <span className="text-[10px] font-bold text-emerald-700 uppercase">الثانوي الإعدادي</span>
          <p className="text-lg md:text-xl font-black text-emerald-700 mt-1">{middleSchoolsCount}</p>
        </button>

        <button
          onClick={() => setTypeFilter('ابتدائي')}
          className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
            typeFilter === 'ابتدائي'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-amber-200'
          }`}
        >
          <span className="text-[10px] font-bold text-amber-700 uppercase">التعليم الابتدائي</span>
          <p className="text-lg md:text-xl font-black text-slate-800 mt-1">{primarySchoolsCount}</p>
        </button>
      </div>

      {/* Filter and search */}
      <div className="flex flex-col lg:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center px-2 w-full">
          <Search className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            placeholder="ابحث باسم المؤسسة، الجماعة، المنسق، أو المدير..."
            className="w-full border-0 focus:ring-0 text-xs py-1 text-slate-800 placeholder-slate-400 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* School Search Filter Dropdown */}
        <div className="relative flex items-center gap-2 w-full lg:w-auto border-t lg:border-t-0 lg:border-r border-slate-100 pt-2 lg:pt-0 lg:pr-3 shrink-0">
          <label className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1.5">
            <SchoolIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>المؤسسة:</span>
          </label>
          <div className="relative min-w-[200px] w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setIsSchoolDropdownOpen(!isSchoolDropdownOpen)}
              className="flex justify-between items-center w-full rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 text-xs font-bold bg-slate-50 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-right"
            >
              <span className="truncate max-w-[150px]">
                {selectedSchoolFilter === 'ALL' 
                  ? '🏫 جميع المؤسسات' 
                  : (schools.find(sch => sch.id === selectedSchoolFilter || sch.name === selectedSchoolFilter)?.name || selectedSchoolFilter)}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
            </button>

            {isSchoolDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsSchoolDropdownOpen(false)} />
                <div className="absolute right-0 lg:left-0 z-50 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden min-w-[250px]">
                  <div className="relative p-2 border-b border-slate-100 bg-slate-50/50 flex items-center">
                    <Search className="absolute right-4.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={schoolSelectQuery}
                      onChange={(e) => setSchoolSelectQuery(e.target.value)}
                      className="w-full pr-8 pl-3 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 text-slate-700"
                      placeholder="ابحث باسم المؤسسة..."
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-50">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedSchoolFilter('ALL');
                        setIsSchoolDropdownOpen(false);
                        setSchoolSelectQuery('');
                      }}
                      className="flex items-center justify-between w-full px-3 py-2 text-right text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <span>🏫 جميع المؤسسات</span>
                      {selectedSchoolFilter === 'ALL' && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                    </button>
                    {[...schools]
                      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
                      .filter(sch => 
                        !schoolSelectQuery || 
                        sch.name.toLowerCase().includes(schoolSelectQuery.toLowerCase())
                      )
                      .map(sch => (
                        <button
                          key={sch.id}
                          type="button"
                          onClick={() => {
                            setSelectedSchoolFilter(sch.id);
                            setIsSchoolDropdownOpen(false);
                            setSchoolSelectQuery('');
                          }}
                          className="flex items-center justify-between w-full px-3 py-2 text-right text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          <span className="truncate max-w-[200px]">{sch.name}</span>
                          {selectedSchoolFilter === sch.id && <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                        </button>
                      ))
                    }
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sport Filter Dropdown */}
        <div className="flex items-center gap-2 w-full lg:w-auto border-t lg:border-t-0 lg:border-r border-slate-100 pt-2 lg:pt-0 lg:pr-3 shrink-0">
          <label htmlFor="schools-sport-filter" className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>الرياضة:</span>
          </label>
          <select
            id="schools-sport-filter"
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer min-w-[160px]"
          >
            <option value="ALL">🏆 جميع الرياضات</option>
            {Object.entries(SPORTS_MAP).map(([id, info]) => (
              <option key={id} value={id}>
                {info.icon} {info.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'ALL', label: `الكل (${schools.length})` },
              { id: 'تأهيلي', label: 'تأهيلي' },
              { id: 'إعدادي', label: 'إعدادي' },
              { id: 'ابتدائي', label: 'ابتدائي' },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  typeFilter === f.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Cards vs Table View Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 mr-2">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              title="عرض المؤسسات على شكل بطائق"
              className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">بطائق 📇</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              title="عرض المؤسسات على شكل جدول"
              className={`p-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-blue-700 shadow-xs border border-slate-200 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">جدول 📊</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sport Participation Notice Banner */}
      {selectedSport !== 'ALL' && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/70 border border-blue-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900 shadow-2xs">
          <div className="flex items-center gap-2">
            <span className="text-xl shrink-0">{SPORTS_MAP[selectedSport]?.icon || '🏆'}</span>
            <div>
              <span className="font-bold">المؤسسات المشاركة في بطولة {SPORTS_MAP[selectedSport]?.name}:</span>{' '}
              <span className="text-blue-700">اضغط على أي مؤسسة للاطلاع الفوري على لائحة التلاميذ المشاركين وتصديرها بصيغة Excel.</span>
            </div>
          </div>
          <button
            onClick={() => setSelectedSport('ALL')}
            className="text-blue-700 hover:text-blue-900 font-bold underline text-[11px] shrink-0 self-end sm:self-auto cursor-pointer"
          >
            عرض جميع الرياضات ({schools.length})
          </button>
        </div>
      )}

      {/* School Cards Grid or Table View */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
        </div>
      ) : viewMode === 'table' ? (
        <div className="space-y-2">
          {/* Mobile horizontal scroll banner indicator */}
          <div className="sm:hidden flex items-center justify-between p-2 bg-blue-50/80 border border-blue-200 rounded-lg text-[11px] text-blue-900">
            <span className="flex items-center gap-1 font-bold">
              <span>↔️</span>
              <span>اسحب الجدول أفقياً للاطلاع على جميع الأعمدة والتفاصيل</span>
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-x-auto">
            {filtered.length > 0 ? (
              <table className="w-full text-right border-collapse min-w-[880px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-xs font-black">
                    <th className="p-3 border-b border-slate-800 w-12 text-center">#</th>
                    <th className="p-3 border-b border-slate-800 min-w-[200px]">اسم المؤسسة التعليمية</th>
                    <th className="p-3 border-b border-slate-800 w-24">السلك</th>
                    <th className="p-3 border-b border-slate-800 min-w-[120px]">الجماعة</th>
                    <th className="p-3 border-b border-slate-800 min-w-[140px]">الأستاذ المنسق</th>
                    <th className="p-3 border-b border-slate-800 w-28">هاتف المنسق</th>
                    <th className="p-3 border-b border-slate-800 min-w-[150px]">مدير المؤسسة</th>
                    {canManage && <th className="p-3 border-b border-slate-800 w-28 text-center">رمز الأمان</th>}
                    <th className="p-3 border-b border-slate-800 text-center w-24">المشاركون</th>
                    <th className="p-3 border-b border-slate-800 text-center min-w-[180px]">الإجراءات والمشاركات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filtered.map((s, idx) => {
                    const schoolStudentsForSport = students.filter(
                      stud => (stud.schoolId === s.id || stud.schoolName === s.name) && (selectedSport === 'ALL' || stud.sportId === selectedSport)
                    );
                    const count = schoolStudentsForSport.length;
                    const isMine = isTeacherSchool(s);

                    return (
                      <tr key={s.id} className={`transition-colors ${
                        isMine 
                          ? 'bg-amber-50/95 hover:bg-amber-100/90 border-y-2 border-amber-400 font-bold shadow-2xs' 
                          : 'hover:bg-slate-50/90'
                      }`}>
                        <td className="p-3 font-mono font-bold text-center">
                          {isMine ? (
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-500 text-white text-[10px] font-black shadow-2xs" title="مؤسستك المعتمدة">
                              ⭐ 1
                            </span>
                          ) : (
                            <span className="text-slate-400">{idx + 1}</span>
                          )}
                        </td>
                        <td className="p-3 font-bold text-slate-900">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={isMine ? 'text-amber-950 font-black text-sm' : ''}>{s.name}</span>
                            {isMine && (
                              <span className="text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-500 text-white shadow-2xs inline-flex items-center gap-1">
                                <span>مقر عملي</span>
                                <span>🏫</span>
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                            s.type === 'تأهيلي' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            s.type === 'إعدادي' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {s.type}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 font-medium">{s.commune}</td>
                        <td className="p-3 font-bold text-slate-800">{s.coordinatorName || s.teacherName || '—'}</td>
                        <td className="p-3 font-mono text-slate-700" dir="ltr">{s.phone || '—'}</td>
                        <td className="p-3 font-medium text-amber-900">
                          {s.principalName || '—'}{' '}
                          {s.principalPhone && (
                            <span className="text-[10px] font-mono text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 font-bold inline-block mt-0.5" dir="ltr">
                              {s.principalPhone}
                            </span>
                          )}
                        </td>
                        {canManage && (
                          <td className="p-3 text-center">
                            <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg">
                              <span className="font-mono font-black text-slate-800 tracking-wider">
                                {s.accessCode || '—'}
                              </span>
                              <button
                                onClick={() => {
                                  if (s.accessCode) {
                                    navigator.clipboard.writeText(s.accessCode);
                                    toast.success('تم نسخ رمز الأمان!');
                                  }
                                }}
                                className="p-1 hover:bg-slate-200 rounded text-slate-500 transition-colors cursor-pointer"
                                title="نسخ رمز الأمان"
                              >
                                <Copy className="w-3 h-3" />
                              </button>
                              {(s.principalPhone || s.phone) && (
                                <button
                                  onClick={() => handleSendPinViaWhatsApp(s)}
                                  className="p-1 hover:bg-green-100 rounded text-green-600 transition-colors cursor-pointer"
                                  title="إرسال عبر WhatsApp إلى مدير المؤسسة"
                                >
                                  <Send className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                        <td className="p-3 text-center">
                          <span className="inline-flex items-center gap-1 font-mono font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                            <Users className="w-3 h-3 text-blue-600" />
                            {count}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            {isTeacher && !isMine ? (
                              <span 
                                className="px-2.5 py-1.5 bg-slate-100 text-slate-500 font-bold rounded-lg text-[11px] border border-slate-200 inline-flex items-center gap-1.5 cursor-not-allowed select-none"
                                title="الاطلاع فقط: بصفتك أستاذاً، لا يحق لك الولوج إلى لوائح وتفاصيل المؤسسات الأخرى"
                              >
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span>اطلاع فقط</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => setSelectedSchoolForParticipants(s)}
                                className={`px-3 py-1.5 font-bold rounded-lg text-[11px] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs ${
                                  isMine
                                    ? 'bg-amber-600 hover:bg-amber-700 text-white ring-2 ring-amber-400/40'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                                }`}
                                title={isMine ? 'الولوج وإدارة لوائح تلاميذ مؤسستك المعتمدة' : 'عرض المشاركات واللائحة'}
                              >
                                <span>{isMine ? 'عرض وإدارة لوائح مؤسستي' : 'عرض المشاركات واللائحة'}</span>
                                <FileText className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canManage && (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingSchool(s);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                                  title="تعديل المؤسسة"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => setSchoolToDelete(s)}
                                  className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                  title="حذف المؤسسة"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl text-center">
                <SchoolIcon className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-bold text-slate-700 mb-1">لا توجد مؤسسات مطابقة</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filtered.length > 0 ? (
            filtered.map((s) => {
              const schoolStudentsForSport = students.filter(
                stud => (stud.schoolId === s.id || stud.schoolName === s.name) && (selectedSport === 'ALL' || stud.sportId === selectedSport)
              );
              const count = schoolStudentsForSport.length;
              const isMine = isTeacherSchool(s);

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    if (isTeacher && !isMine) {
                      toast('الاطلاع فقط: بصفتك أستاذاً، يحق لك الاطلاع على المؤسسات المشاركة دون إمكانية الولوج إلى لوائح وتفاصيل المؤسسات الأخرى.', {
                        icon: '🔒',
                        duration: 3500
                      });
                      return;
                    }
                    setSelectedSchoolForParticipants(s);
                  }}
                  className={`flex flex-col justify-between rounded-2xl p-4 transition-all space-y-3 ${
                    isMine
                      ? 'bg-gradient-to-br from-indigo-50/95 via-sky-50/30 to-white border-2 border-indigo-500 shadow-md ring-2 ring-indigo-500/20 cursor-pointer group'
                      : isTeacher
                        ? 'bg-white border border-slate-200 shadow-3xs cursor-default hover:border-slate-300'
                        : 'bg-white border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md cursor-pointer group'
                  }`}
                >
                  <div>
                    {isMine && (
                      <div className="flex items-center justify-between text-[11px] font-black text-indigo-950 bg-indigo-100/90 px-2.5 py-1 rounded-lg border border-indigo-300 mb-2.5 shadow-3xs">
                        <span className="flex items-center gap-1">
                          <span>⭐</span>
                          <span>مؤسستك التعليمية ومقر عملك</span>
                        </span>
                        <span className="text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded font-bold">المؤسسة رقم 1</span>
                      </div>
                    )}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 font-bold transition-colors ${
                          isMine
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                            : 'bg-blue-50 text-blue-700 border-blue-100 group-hover:bg-blue-600 group-hover:text-white'
                        }`}>
                          🏫
                        </div>
                        <div>
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                            s.type === 'تأهيلي'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : s.type === 'إعدادي'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}>
                            {s.type === 'تأهيلي' ? 'ثانوي تأهيلي' : s.type === 'إعدادي' ? 'ثانوي إعدادي' : 'ابتدائي'}
                          </span>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingSchool(s);
                              setIsModalOpen(true);
                            }}
                            title="تعديل المؤسسة"
                            className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSchoolToDelete(s);
                            }}
                            title="حذف المؤسسة"
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <h3 className="text-xs md:text-sm font-bold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">
                      {s.name}
                    </h3>

                    <div className="mt-2 text-[11px] text-slate-500 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{s.commune}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span>المنسق: {s.coordinatorName || s.teacherName}</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-medium text-amber-900">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>المدير: {s.principalName || 'غير مسجل'}</span>
                      </div>
                    </div>

                    {/* Participation Preview (البطولات والفئات والأصناف المشاركة فقط) */}
                    {(() => {
                      const schoolStudentsAll = students.filter(
                        stud => stud.schoolId === s.id || stud.schoolName === s.name
                      );
                      const participatedSportKeys = Array.from(new Set(schoolStudentsAll.map(st => st.sportId).filter(Boolean)));
                      const participatedCatKeys = Array.from(new Set(schoolStudentsAll.map(st => st.category).filter(Boolean)));
                      const hasClub = schoolStudentsAll.some(st => st.affiliationType === 'club_affiliated');
                      const hasSchoolOnly = schoolStudentsAll.some(st => st.affiliationType !== 'club_affiliated');

                      if (participatedSportKeys.length === 0) {
                        return (
                          <div className="mt-2.5 px-2.5 py-1.5 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-400 font-medium">
                            لم تسجل هذه المؤسسة مشاركات بعد
                          </div>
                        );
                      }

                      return (
                        <div className="mt-2.5 p-2 bg-blue-50/70 rounded-xl border border-blue-100 space-y-1 text-[11px]">
                          {/* Sports */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="font-black text-blue-950 text-[10px]">البطولات:</span>
                            {participatedSportKeys.map(sKey => {
                              const sp = SPORTS_MAP[sKey as string];
                              return (
                                <span key={sKey} className="px-1.5 py-0.5 bg-white text-blue-900 font-bold border border-blue-200 rounded-md text-[10px] flex items-center gap-1 shadow-3xs">
                                  <span>{sp?.icon || '🏆'}</span>
                                  <span>{sp?.name || sKey}</span>
                                </span>
                              );
                            })}
                          </div>

                          {/* Categories */}
                          {participatedCatKeys.length > 0 && (
                            <div className="flex items-center gap-1 flex-wrap pt-0.5">
                              <span className="font-black text-slate-700 text-[10px]">الفئات:</span>
                              {participatedCatKeys.map(cKey => {
                                const cat = AGE_CATEGORIES.find(c => c.id === cKey);
                                return (
                                  <span key={cKey} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-900 font-bold border border-emerald-200 rounded-md text-[10px]">
                                    {cat ? cat.shortName : cKey}
                                  </span>
                                );
                              })}
                            </div>
                          )}

                          {/* Classes */}
                          <div className="flex items-center gap-1 flex-wrap text-[10px] pt-0.5">
                            <span className="font-black text-slate-700">الأصناف:</span>
                            {hasSchoolOnly && (
                              <span className="px-1.5 py-0.5 bg-white text-slate-800 font-bold border border-slate-300 rounded-md">
                                ⚪ لا منتمين
                              </span>
                            )}
                            {hasClub && (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-950 font-bold border border-amber-300 rounded-md">
                                🟡 منتمين للأندية
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {/* Coordinator Phone */}
                    {s.phone && (
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium flex items-center gap-1">
                          <Phone className="h-3 w-3 text-blue-500" />
                          <span>هاتف المنسق:</span>
                        </span>
                        <a
                          href={`tel:${s.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-slate-700 hover:text-blue-600 font-bold"
                          dir="ltr"
                        >
                          {s.phone}
                        </a>
                      </div>
                    )}

                    {/* Principal Phone (هاتف مدير المؤسسة) */}
                    <div className={`pt-1.5 ${s.phone ? 'border-t border-slate-100/70' : 'pt-2 border-t border-slate-100'} flex items-center justify-between text-[11px]`}>
                      <span className="text-amber-900 font-semibold flex items-center gap-1">
                        <PhoneCall className="h-3 w-3 text-amber-600" />
                        <span>هاتف المدير:</span>
                      </span>
                      {s.principalPhone ? (
                        <a
                          href={`tel:${s.principalPhone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-mono text-amber-950 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-bold hover:bg-amber-100 transition-colors"
                          dir="ltr"
                          title="الاتصال بمدير المؤسسة"
                        >
                          {s.principalPhone}
                        </a>
                      ) : canManage ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingSchool(s);
                            setIsModalOpen(true);
                          }}
                          className="text-[10px] text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100/80 border border-amber-200/80 px-2 py-0.5 rounded font-bold transition-colors cursor-pointer"
                          title="إضافة رقم هاتف مدير المؤسسة"
                        >
                          + إضافة هاتف المدير
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px]">غير مسجل</span>
                      )}
                    </div>

                    {/* School Access Code for authorized managers */}
                    {canManage && (
                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px]" onClick={(e) => e.stopPropagation()}>
                        <span className="text-blue-900 font-bold flex items-center gap-1">
                          <KeyRound className="h-3.5 w-3.5 text-blue-600" />
                          <span>رمز الأمان (PIN):</span>
                        </span>
                        <div className="flex items-center gap-1.5 bg-blue-50/50 border border-blue-200 px-2 py-0.5 rounded font-bold">
                          <span className="font-mono font-black text-blue-950 tracking-wider">
                            {s.accessCode || '—'}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (s.accessCode) {
                                navigator.clipboard.writeText(s.accessCode);
                                toast.success('تم نسخ رمز الأمان!');
                              }
                            }}
                            className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors cursor-pointer"
                            title="نسخ رمز الأمان"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {(s.principalPhone || s.phone) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSendPinViaWhatsApp(s);
                              }}
                              className="p-1 hover:bg-green-100 rounded text-green-600 transition-colors cursor-pointer"
                              title="إرسال عبر WhatsApp إلى مدير المؤسسة"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Participant List Click Trigger Footer */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <div className={`flex items-center gap-1.5 text-xs font-bold ${
                        isTeacher && !isMine ? 'text-slate-500' : isMine ? 'text-indigo-700' : 'text-blue-600 group-hover:text-blue-700'
                      }`}>
                        <Users className={`h-3.5 w-3.5 ${isTeacher && !isMine ? 'text-slate-400' : isMine ? 'text-indigo-600' : 'text-blue-600'}`} />
                        <span>
                          {selectedSport !== 'ALL'
                            ? `المشاركون (${count} ${count === 1 ? 'تلميذ' : 'تلاميذ'})`
                            : `المشاركون المسجلون (${count})`}
                        </span>
                      </div>
                      {isTeacher && !isMine ? (
                        <span 
                          className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1 select-none"
                          title="اطلاع فقط: لا يحق للأستاذ الولوج للوائح وتفاصيل المؤسسات الأخرى"
                        >
                          <Lock className="w-3 h-3 text-slate-400" />
                          <span>اطلاع فقط</span>
                        </span>
                      ) : (
                        <span className={`text-[11px] font-bold flex items-center gap-0.5 transition-all ${
                          isMine
                            ? 'text-indigo-700 hover:text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200'
                            : 'text-blue-600 group-hover:text-blue-800 group-hover:translate-x-[-2px]'
                        }`}>
                          <span>{isMine ? 'عرض وإدارة لوائح مؤسستي' : 'عرض اللائحة'}</span>
                          <span className="text-xs">←</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-slate-200 text-center">
              <SchoolIcon className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700 mb-1">لا توجد مؤسسات مطابقة</p>
              {canManage && (
                <button
                  onClick={() => {
                    setEditingSchool(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-3 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  إضافة مؤسسة جديدة الآن
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit School Modal */}
      <CreateSchoolModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingSchool(null);
        }}
        onSave={handleSaveSchool}
        initialData={editingSchool}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!schoolToDelete}
        onClose={() => setSchoolToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="حذف المؤسسة التعليمية"
        message="هل أنت متأكد من رغبتك في حذف هذه المؤسسة من دليل المشاركين؟"
        itemName={schoolToDelete?.name}
        isDeleting={isDeleting}
      />

      {/* Confirm Delete All Modal */}
      <ConfirmDeleteModal
        isOpen={showDeleteAllModal}
        onClose={() => setShowDeleteAllModal(false)}
        onConfirm={handleDeleteAllSchools}
        title="حذف جميع المؤسسات التعليمية"
        message={`تحذير خطير: أنت على وشك حذف جميع المؤسسات التعليمية (${schools.length}) التابعة لمديريتك الحالية. هل أنت متأكد تماماً من هذا الإجراء؟ لا يمكن التراجع عن هذه العملية.`}
        itemName="جميع المؤسسات"
        isDeleting={isDeletingAll}
      />

      {/* School Participants Modal for Filtered Sport */}
      <SchoolParticipantsModal
        isOpen={!!selectedSchoolForParticipants}
        onClose={() => setSelectedSchoolForParticipants(null)}
        school={selectedSchoolForParticipants}
        sportId={selectedSport}
        allStudents={students}
      />
    </div>
  );
};
