import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { User, Student, School } from '../types';
import { TeacherDetailModal } from '../components/TeacherDetailModal';
import { EditTeacherRoleModal } from '../components/EditTeacherRoleModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { useAuth } from '../contexts/AuthContext';
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
  ChevronDown
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
  const { userProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const cadreQuery = searchParams.get('cadre');

  const [teachers, setTeachers] = useState<User[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedCadre, setSelectedCadre] = useState<string>(cadreQuery || '');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Detail Modal State
  const [selectedTeacherModal, setSelectedTeacherModal] = useState<User | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Edit Role/Cadre Modal State
  const [selectedTeacherForEdit, setSelectedTeacherForEdit] = useState<User | null>(null);
  const [isEditRoleModalOpen, setIsEditRoleModalOpen] = useState(false);

  // Deletion Modal State
  const [teacherToDelete, setTeacherToDelete] = useState<User | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  useEffect(() => {
    setSelectedCadre(cadreQuery || '');
  }, [cadreQuery]);

  useEffect(() => {
    loadTeachersAndStudents();
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
      window.removeEventListener('directorateChanged', handleDirChange);
      window.removeEventListener('userDataChanged', handleProfileChange);
      window.removeEventListener('teacherProfileUpdated', handleProfileChange);
    };
  }, []);

  const loadTeachersAndStudents = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [teachersData, studentsData, schoolsData] = await Promise.all([
        DataService.getTeachers(),
        DataService.getStudents(),
        DataService.getSchools()
      ]);
      const dirTeachers = teachersData.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      const dirStudents = studentsData.filter(st => (st.directorateId || 'taourirt') === activeDirId);
      const dirSchools = schoolsData.filter(sch => (sch.directorateId || 'taourirt') === activeDirId);

      setTeachers(dirTeachers);
      setStudents(dirStudents);
      setSchools(dirSchools);
    } catch (error) {
      console.error('Error loading teachers:', error);
      toast.error('حدث خطأ أثناء تحميل قائمة الأساتذة');
    } finally {
      setLoading(false);
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
    setTeachers(prev => prev.map(t => t.id === updatedTeacher.id ? updatedTeacher : t));
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

    return matchesSearch && matchesSport && matchesLocation && matchesCadre;
  });

  // Calculate statistics
  const totalTeachers = teachers.length;
  const completedProfiles = teachers.filter(t => t.workLocation && t.leaseNumber).length;
  const incompleteProfiles = totalTeachers - completedProfiles;

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
      {/* Header and Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-blue-600" />
            <span>لائحة الأطر التربوية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة ومتابعة ملفات أساتذة التربية البدنية والرياضية المسجلين بالمديرية. اضغط على أي أستاذ لعرض بطاقته التفصيلية.
          </p>
        </div>
        <button
          onClick={loadTeachersAndStudents}
          className="self-start md:self-auto flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer transition-all bg-white shadow-3xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>تحديث القائمة</span>
        </button>

        {userProfile?.role === 'CENTRAL_ADMIN' && teachers.length > 0 && (
          <button
            onClick={() => setShowDeleteAllModal(true)}
            className="self-start md:self-auto flex items-center gap-1.5 px-3 py-2 bg-red-50 border border-red-200 hover:bg-red-100 rounded-xl text-xs font-bold text-red-600 transition-all shadow-3xs cursor-pointer"
            title="حذف جميع حسابات الأطر التربوية في هذه المديرية"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>حذف الكل</span>
          </button>
        )}
      </div>

      {/* Stats Cards Dashboard Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">إجمالي الأساتذة المسجلين</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-slate-800">{totalTeachers}</h3>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <GraduationCap className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">ملفات شخصية مكتملة</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-emerald-600">{completedProfiles}</h3>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <UserCheck className="h-5 w-5" />
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">ملفات تحتاج استكمال</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black text-amber-600">{incompleteProfiles}</h3>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertCircle className="h-5 w-5" />
            </span>
          </div>
        </div>
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

          {(searchTerm || selectedSport || selectedLocation || selectedCadre) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedSport('');
                setSelectedLocation('');
                setSelectedCadre('');
                setSearchParams({});
              }}
              className="text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-2.5 rounded-xl transition-colors shrink-0 cursor-pointer"
            >
              إلغاء الفلاتر
            </button>
          )}
        </div>
      </div>

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
            onClick={() => { setSearchTerm(''); setSelectedSport(''); setSelectedLocation(''); }}
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
                  <th className="px-6 py-4">مقر العمل (المؤسسة)</th>
                  <th className="px-6 py-4">معلومات الاتصال</th>
                  <th className="px-6 py-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredTeachers.map((teacher) => {
                  const hasDetails = teacher.workLocation && teacher.leaseNumber;
                  const specialties = Array.isArray(teacher.refereeSpecialty) ? teacher.refereeSpecialty : (teacher.refereeSpecialty ? [teacher.refereeSpecialty] : []);

                  return (
                    <tr
                      key={`desktop-${teacher.id}`}
                      onClick={() => handleOpenTeacherDetail(teacher)}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      {/* Name & Role */}
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

                      {/* Work Location */}
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {teacher.workLocation ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{teacher.workLocation}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">لم يدخل بعد</span>
                        )}
                      </td>

                      {/* Contact Info */}
                      <td className="px-6 py-4">
                        <div className="space-y-1 text-[11px] text-slate-600">
                          {teacher.phone && (
                            <div className="flex items-center gap-1.5 font-medium">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span dir="ltr">{teacher.phone}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span className="truncate max-w-[140px]">{teacher.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {(userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'SPORT_MANAGER') ? (
                            <>
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
                              <button
                                type="button"
                                onClick={(e) => handleDeleteClick(e, teacher)}
                                className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl border border-red-200 transition-all cursor-pointer shadow-3xs"
                                title="حذف حساب الأستاذ نهائياً"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          ) : null}
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

              return (
                <div
                  key={`mobile-${teacher.id}`}
                  onClick={() => handleOpenTeacherDetail(teacher)}
                  className="p-4 space-y-3 hover:bg-blue-50/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden">
                        {teacher.photoUrl ? (
                          <img src={teacher.photoUrl} alt={teacher.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{teacher.fullName[0].toUpperCase()}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800 text-sm flex items-center gap-1 flex-wrap">
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

                     <div className="flex items-center gap-1.5 flex-wrap">
                      {(userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'SPORT_MANAGER') ? (
                        <>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditRole(teacher);
                            }}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] rounded-lg border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors"
                            title="تعديل بيانات الأستاذ ومهامه"
                          >
                            <Pencil className="h-3 w-3" />
                            <span>تعديل</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteClick(e, teacher)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-bold text-[11px] rounded-lg border border-red-200 flex items-center gap-1 cursor-pointer transition-colors"
                            title="حذف حساب الأستاذ نهائياً"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>حذف</span>
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTeacherDetail(teacher);
                        }}
                        className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] rounded-lg border border-blue-200 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Eye className="h-3 w-3" />
                        <span>التفاصيل</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-slate-400 font-bold mb-1 text-[10px] uppercase">رقم التأجير</p>
                      {teacher.leaseNumber ? (
                        <span className="font-mono font-bold text-slate-700">{teacher.leaseNumber}</span>
                      ) : (
                        <span className="text-slate-400 italic">غير متوفر</span>
                      )}
                    </div>
                    <div>
                      <p className="text-slate-400 font-bold mb-1 text-[10px] uppercase">المؤسسة</p>
                      <span className="font-bold text-slate-700 truncate block">
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

      {/* Teacher Detail Modal */}
      {isDetailModalOpen && (
        <TeacherDetailModal
          isOpen={isDetailModalOpen}
          onClose={() => setIsDetailModalOpen(false)}
          teacher={selectedTeacherModal}
          teacherStudents={teacherStudents}
          onEditRole={handleOpenEditRole}
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
    </div>
  );
};

export default Teachers;
