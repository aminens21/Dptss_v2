import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP, deduplicateById } from '../lib/dataService';
import { getWhatsAppUrl } from '../lib/whatsappService';
import { Referee, User } from '../types';
import {
  ShieldCheck,
  Search,
  Phone,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Edit2,
  Table as TableIcon,
  LayoutGrid,
  GraduationCap,
  Award,
  Building,
  MessageCircle,
  UserCheck,
  X,
  CheckCircle2
} from 'lucide-react';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import toast from 'react-hot-toast';

const DIPLOMA_PRESETS = [
  'حكم وطني',
  'حكم فدرالي',
  'حكم جهوي',
  'حكم عصبة',
  'حكم إقليمي / مدرسي',
  'شهادة تحكيم معتمدة'
];

export const Referees: React.FC = () => {
  const { userProfile } = useAuth();
  const [referees, setReferees] = useState<Referee[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');

  // Determine user's primary/preferred sport specialty for automatic focus on login
  const preferredSportId = useMemo(() => {
    if (!userProfile) return '';
    if (userProfile.role === 'SPORT_MANAGER') {
      return userProfile.sportId || '';
    }
    if (userProfile.isTechCommitteeHead && userProfile.techCommitteeSports && userProfile.techCommitteeSports.length > 0) {
      return userProfile.techCommitteeSports[0];
    }
    if (userProfile.isTechCommitteeMember && userProfile.techCommitteeSportsMemberOf && userProfile.techCommitteeSportsMemberOf.length > 0) {
      return userProfile.techCommitteeSportsMemberOf[0];
    }
    if (userProfile.sportId) {
      return userProfile.sportId;
    }
    return '';
  }, [userProfile]);

  useEffect(() => {
    if (preferredSportId) {
      setSelectedSport(preferredSportId);
    }
  }, [preferredSportId]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Referee | null>(null);
  const [refereeToDelete, setRefereeToDelete] = useState<Referee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal mode when adding: 'teacher' (pick from teachers) or 'manual'
  const [entryMode, setEntryMode] = useState<'teacher' | 'manual'>('teacher');
  const [teacherSearchQuery, setTeacherSearchQuery] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  const [formData, setFormData] = useState<{
    fullName: string;
    phone: string;
    specialty: string[];
    diploma: string;
    specialtyDiplomas: Record<string, string>;
    workLocation?: string;
    photoUrl?: string;
    isTeacher?: boolean;
  }>({
    fullName: '',
    phone: '',
    specialty: [],
    diploma: '',
    specialtyDiplomas: {}
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadReferees();
    const handleRefresh = () => {
      loadReferees();
    };
    window.addEventListener('directorateChanged', handleRefresh);
    window.addEventListener('refereesUpdated', handleRefresh);
    window.addEventListener('userDataChanged', handleRefresh);
    return () => {
      window.removeEventListener('directorateChanged', handleRefresh);
      window.removeEventListener('refereesUpdated', handleRefresh);
      window.removeEventListener('userDataChanged', handleRefresh);
    };
  }, []);

  const loadReferees = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [refData, teachersData] = await Promise.all([
        DataService.getReferees(),
        DataService.getTeachers().catch(() => [] as User[])
      ]);
      const dirReferees = deduplicateById(
        refData.filter(r => activeDirId === 'all' || (r.directorateId || 'taourirt') === activeDirId)
      );
      const dirTeachers = teachersData.filter(
        t => activeDirId === 'all' || (t.directorateId || 'taourirt') === activeDirId
      );
      setReferees(dirReferees);
      setTeachers(dirTeachers);
    } catch (error) {
      console.error('Error loading referees:', error);
      toast.error('حدث خطأ أثناء تحميل قائمة الحكام');
    } finally {
      setLoading(false);
    }
  };

  const cleanDisplayName = (rawName: string) =>
    (rawName || '').replace(/\s*\(أستاذ\)\s*/g, '').trim();

  const handleSelectTeacherForReferee = (teacher: User) => {
    setSelectedTeacherId(teacher.id);
    const existingSpecs = Array.isArray(teacher.refereeSpecialty)
      ? teacher.refereeSpecialty
      : teacher.refereeSpecialty
      ? [teacher.refereeSpecialty]
      : [];
    const mergedSpecs = selectedSport && !existingSpecs.includes(selectedSport)
      ? [...existingSpecs, selectedSport]
      : existingSpecs.length > 0
      ? existingSpecs
      : selectedSport
      ? [selectedSport]
      : [];

    const initDiplomas: Record<string, string> = { ...(teacher.refereeDiplomas || {}) };
    if (teacher.refereeDiploma && mergedSpecs.length > 0) {
      mergedSpecs.forEach(sp => {
        if (!initDiplomas[sp]) initDiplomas[sp] = teacher.refereeDiploma || '';
      });
    }

    setFormData({
      fullName: teacher.fullName || '',
      phone: teacher.phone || '',
      specialty: mergedSpecs,
      diploma: teacher.refereeDiploma || '',
      specialtyDiplomas: initDiplomas,
      workLocation: teacher.workLocation || '',
      photoUrl: teacher.photoUrl || '',
      isTeacher: true
    });
  };

  const handleOpenModal = (referee?: Referee) => {
    setTeacherSearchQuery('');
    if (referee) {
      setEditingRef(referee);
      setEntryMode('manual');
      setSelectedTeacherId(referee.teacherId || (referee.isTeacher ? referee.id : ''));
      const specs = Array.isArray(referee.specialty)
        ? referee.specialty
        : referee.specialty
        ? [referee.specialty]
        : [];
      const initDiplomas: Record<string, string> = { ...(referee.specialtyDiplomas || {}) };
      if (referee.diploma && specs.length > 0) {
        specs.forEach(sp => {
          if (!initDiplomas[sp]) initDiplomas[sp] = referee.diploma || '';
        });
      }
      setFormData({
        fullName: cleanDisplayName(referee.fullName),
        phone: referee.phone === 'غير محدد' ? '' : referee.phone,
        specialty: specs,
        diploma: referee.diploma || '',
        specialtyDiplomas: initDiplomas,
        workLocation: referee.workLocation || '',
        photoUrl: referee.photoUrl || '',
        isTeacher: referee.isTeacher
      });
    } else {
      setEditingRef(null);
      setEntryMode(teachers.length > 0 ? 'teacher' : 'manual');
      setSelectedTeacherId('');
      setFormData({
        fullName: '',
        phone: '',
        specialty: selectedSport ? [selectedSport] : [],
        diploma: '',
        specialtyDiplomas: {}
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRef(null);
    setSelectedTeacherId('');
    setTeacherSearchQuery('');
    setFormData({
      fullName: '',
      phone: '',
      specialty: [],
      diploma: '',
      specialtyDiplomas: {}
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      toast.error(entryMode === 'teacher' && !editingRef ? 'يرجى اختيار الأستاذ(ة) أولاً' : 'يرجى إدخال الاسم الكامل للحكم');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('يرجى إدخال رقم الهاتف للتواصل');
      return;
    }

    const cleanedSpecialtyDiplomas: Record<string, string> = {};
    formData.specialty.forEach(sp => {
      const val = (formData.specialtyDiplomas[sp] || '').trim();
      if (val) cleanedSpecialtyDiplomas[sp] = val;
    });
    const summaryDiploma =
      Object.values(cleanedSpecialtyDiplomas).filter(Boolean).join(' • ') ||
      formData.diploma.trim();

    setIsSubmitting(true);
    try {
      if (editingRef) {
        await DataService.updateReferee(editingRef.id, {
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          specialty: formData.specialty,
          diploma: summaryDiploma,
          specialtyDiplomas: cleanedSpecialtyDiplomas,
          workLocation: formData.workLocation,
          isTeacher: formData.isTeacher,
          teacherId: selectedTeacherId || editingRef.teacherId
        });
        toast.success('تم تحديث بطاقة الحكم بنجاح');
      } else {
        const activeDirId = DataService.getActiveDirectorateId();
        await DataService.addReferee({
          fullName: formData.fullName.trim(),
          phone: formData.phone.trim(),
          specialty: formData.specialty,
          diploma: summaryDiploma,
          specialtyDiplomas: cleanedSpecialtyDiplomas,
          workLocation: formData.workLocation,
          photoUrl: formData.photoUrl,
          isTeacher: entryMode === 'teacher' ? true : formData.isTeacher,
          teacherId: entryMode === 'teacher' && selectedTeacherId ? selectedTeacherId : undefined,
          isActive: true,
          directorateId: activeDirId === 'all' ? 'taourirt' : activeDirId
        });
        if (selectedSport && formData.specialty.length > 0 && !formData.specialty.includes(selectedSport)) {
          setSelectedSport('');
        }
        toast.success('تم اعتماد الحكم وحفظ تخصصه وشهادته بنجاح');
      }
      handleCloseModal();
      await loadReferees();
    } catch (error) {
      console.error('Submit referee error:', error);
      toast.error('حدث خطأ أثناء حفظ البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (ref: Referee) => {
    setRefereeToDelete(ref);
  };

  const handleConfirmDeleteReferee = async () => {
    if (!refereeToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteReferee(refereeToDelete.id);
      toast.success('تم حذف الحكم بنجاح');
      setRefereeToDelete(null);
      await loadReferees();
    } catch {
      toast.error('تعذر الحذف');
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTeachersForPicker = useMemo(() => {
    const q = teacherSearchQuery.trim().toLowerCase();
    if (!q) return teachers.slice(0, 40);
    return teachers.filter(t =>
      (t.fullName || '').toLowerCase().includes(q) ||
      (t.workLocation || '').toLowerCase().includes(q) ||
      (t.phone || '').includes(q) ||
      (t.leaseNumber || '').includes(q)
    );
  }, [teachers, teacherSearchQuery]);

  const filteredReferees = referees.filter((ref) => {
    const q = searchTerm.trim().toLowerCase();
    const diplomaText = [
      ref.diploma || '',
      ...Object.values(ref.specialtyDiplomas || {})
    ].join(' ').toLowerCase();

    const matchesSearch =
      !q ||
      ref.fullName.toLowerCase().includes(q) ||
      ref.phone.includes(q) ||
      (ref.workLocation || '').toLowerCase().includes(q) ||
      diplomaText.includes(q);

    const matchesSport =
      selectedSport === '' ||
      (Array.isArray(ref.specialty)
        ? ref.specialty.includes(selectedSport)
        : ref.specialty === selectedSport);

    return matchesSearch && matchesSport;
  });

  const getRefereeDiplomaForSport = (ref: Referee, specId: string): string => {
    return ref.specialtyDiplomas?.[specId] || ref.diploma || '';
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-slate-900 text-amber-400 flex items-center justify-center shadow-xs border border-slate-800">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <span>الهيئة الإقليمية للحكام المعتمدين</span>
            <span className="text-xs font-black px-2.5 py-0.5 rounded-lg bg-amber-50 text-amber-900 border border-amber-200 tabular-nums">
              {filteredReferees.length}
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            بطائق الاعتماد الرسمية للحكام والأساتذة المحكمين، التخصصات الرياضية، الشواهد ومستويات التحكيم
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={loadReferees}
            className="flex items-center gap-1.5 px-3 py-2.5 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-600 cursor-pointer bg-white transition-colors"
            title="تحديث اللائحة"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">تحديث</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-sm transition-colors cursor-pointer border border-slate-800"
          >
            <Plus className="h-4 w-4 text-amber-400" />
            <span>إضافة أستاذ / حكم معتمد</span>
          </button>
        </div>
      </div>

      {/* Filters & View Controls */}
      <div className="bg-white p-3 md:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex-1 relative w-full">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="البحث باسم الحكم، المؤسسة، رقم الهاتف، أو مستوى التحكيم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pr-9 pl-3 py-2.5 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-slate-900 focus:border-transparent text-slate-800 bg-slate-50/50 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <Filter className="h-4 w-4 text-slate-400" />
            </div>
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(e.target.value)}
              className="block w-full pr-9 pl-3 py-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-slate-900 focus:border-transparent appearance-none text-slate-800 bg-white cursor-pointer"
            >
              <option value="">جميع التخصصات التحكيمية</option>
              {Object.entries(SPORTS_MAP).map(([key, sport]) => (
                <option key={key} value={key}>{sport.icon} {sport.name}</option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle Buttons (Icon-only) */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض البطائق الرسمية"
              aria-label="عرض البطائق الرسمية"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-2 rounded-lg transition-all flex items-center justify-center cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="عرض الجدول"
              aria-label="عرض الجدول"
            >
              <TableIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mb-4 text-slate-700" />
          <p className="text-sm font-bold">جاري تحميل هيئة الحكام...</p>
        </div>
      ) : filteredReferees.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-200">
            <ShieldCheck className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-base font-black text-slate-800 mb-1">لا يوجد حكام مطابقون للبحث</h3>
          <p className="text-xs text-slate-500 font-medium">
            يمكنك إضافة أستاذ محكم أو حكم جديد وتحديد تخصصه وشهادته التحكيمية من الزر أعلاه
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-900 text-slate-100 font-bold">
                <tr>
                  <th className="p-3.5 text-center w-12">#</th>
                  <th className="p-3.5">الحكم المعتمد</th>
                  <th className="p-3.5">التخصص التحكيمي</th>
                  <th className="p-3.5">الدبلوم / الشهادة / المستوى</th>
                  <th className="p-3.5">الصفة والمؤسسة</th>
                  <th className="p-3.5">التواصل المباشر</th>
                  <th className="p-3.5 text-center w-24">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredReferees.map((ref, idx) => {
                  const specialties = Array.isArray(ref.specialty) ? ref.specialty : (ref.specialty ? [ref.specialty] : []);
                  const displayName = cleanDisplayName(ref.fullName);
                  const hasValidPhone = ref.phone && ref.phone !== 'غير محدد';
                  const waMessage = `السلام عليكم الحكم الأستاذ(ة) ${displayName}، نتواصل معكم بخصوص البطولة الإقليمية المدرسية.`;

                  return (
                    <tr key={`ref-row-${ref.id}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 text-center font-bold text-slate-400 tabular-nums">{idx + 1}</td>
                      <td className="p-3.5 font-bold text-slate-900">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-amber-400/50 text-amber-300 flex items-center justify-center font-black text-xs shrink-0 overflow-hidden">
                            {ref.photoUrl ? (
                              <img src={ref.photoUrl} alt={displayName} className="w-full h-full object-cover" />
                            ) : (
                              <span>{displayName[0]?.toUpperCase() || 'ح'}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-xs font-black text-slate-900 block">{displayName}</span>
                            <span className="text-[10px] text-amber-700 font-bold">حكم رسمي معتمد</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1">
                          {specialties.length > 0 ? (
                            specialties.map(spec => {
                              const sportDetails = SPORTS_MAP[spec];
                              return (
                                <span key={spec} className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-900 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                                  <span>{sportDetails?.icon || '🏆'}</span>
                                  <span>{sportDetails?.name || spec}</span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                              متعدد التخصصات
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap gap-1">
                          {specialties.some(sp => getRefereeDiplomaForSport(ref, sp)) ? (
                            specialties.map(sp => {
                              const dip = getRefereeDiplomaForSport(ref, sp);
                              if (!dip) return null;
                              return (
                                <span key={`tbl-dip-${sp}`} className="inline-flex items-center gap-1 text-[10px] font-black text-amber-950 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300/80">
                                  <Award className="h-3 w-3 text-amber-600 shrink-0" />
                                  <span>{dip}</span>
                                </span>
                              );
                            })
                          ) : ref.diploma ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-950 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-300/80">
                              <Award className="h-3 w-3 text-amber-600 shrink-0" />
                              <span>{ref.diploma}</span>
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">حكم معتمد بالمديرية</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="space-y-0.5">
                          {ref.isTeacher ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-800 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                              <GraduationCap className="h-3 w-3" />
                              <span>أستاذ(ة) تربية بدنية</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                              <ShieldCheck className="h-3 w-3 text-slate-700" />
                              <span>حكم فدرالي / خارجي</span>
                            </span>
                          )}
                          {ref.workLocation && (
                            <p className="text-[10px] text-slate-500 font-bold truncate max-w-[160px]" title={ref.workLocation}>
                              🏫 {ref.workLocation}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5">
                        {hasValidPhone ? (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={getWhatsAppUrl(ref.phone, waMessage)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                              title="مراسلة عبر واتساب"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                            </a>
                            <a
                              href={`tel:${ref.phone}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-mono font-bold tabular-nums transition-colors"
                            >
                              <Phone className="h-3 w-3 text-slate-600" />
                              <span dir="ltr">{ref.phone}</span>
                            </a>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">غير مسجل</span>
                        )}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenModal(ref)}
                            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                            title="تعديل بطاقة الحكم"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(ref)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* PRESTIGIOUS OFFICIAL REFEREE CARDS VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredReferees.map((ref, idx) => {
            const specialties = Array.isArray(ref.specialty) ? ref.specialty : (ref.specialty ? [ref.specialty] : []);
            const displayName = cleanDisplayName(ref.fullName);
            const hasValidPhone = Boolean(ref.phone && ref.phone !== 'غير محدد' && ref.phone.trim());
            const primaryDiploma =
              (selectedSport && getRefereeDiplomaForSport(ref, selectedSport)) ||
              specialties.map(sp => getRefereeDiplomaForSport(ref, sp)).find(Boolean) ||
              ref.diploma ||
              '';
            const waMessage = `السلام عليكم الحكم الأستاذ(ة) *${displayName}*، نتواصل معكم من اللجنة الإقليمية للرياضة المدرسية بخصوص برمجة المباريات.`;

            return (
              <div
                key={`ref-card-${ref.id}-${idx}`}
                className="group bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-amber-300/80 transition-all duration-200 overflow-hidden flex flex-col justify-between"
              >
                {/* Top Metallic Gold Ribbon + Executive Federation Header */}
                <div>
                  <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600" />
                  <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-emerald-950 p-4 text-white relative overflow-hidden">
                    {/* Subtle Architectural Corner Ring */}
                    <div className="absolute -left-6 -top-6 w-24 h-24 rounded-full border border-amber-400/15 pointer-events-none" />

                    {/* Top Row: Official Crest + Edit/Delete */}
                    <div className="flex items-center justify-between gap-2 mb-3.5 relative z-10">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-400/15 border border-amber-400/35 text-amber-300 text-[10px] font-black tracking-wide">
                        <ShieldCheck className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                        <span>بطاقة حكم رسمي معتمد</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenModal(ref)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
                          title="تعديل بيانات الحكم والشواهد"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(ref)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/30 text-slate-200 hover:text-red-200 transition-colors cursor-pointer"
                          title="حذف البطاقة"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Portrait + Name + Title */}
                    <div className="flex items-center gap-3.5 relative z-10">
                      <div className="relative shrink-0">
                        <div className="w-14 h-14 rounded-2xl bg-slate-800 ring-2 ring-amber-400/80 shadow-md flex items-center justify-center overflow-hidden text-amber-300 font-black text-xl">
                          {ref.photoUrl ? (
                            <img src={ref.photoUrl} alt={displayName} className="w-full h-full object-cover" />
                          ) : (
                            <span>{displayName[0]?.toUpperCase() || 'ح'}</span>
                          )}
                        </div>
                        <span
                          className="absolute -bottom-1 -left-1 w-6 h-6 rounded-lg bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs border border-slate-900"
                          title="حكم معتمد"
                        >
                          <Award className="h-3.5 w-3.5" />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-base font-black text-white truncate leading-snug" title={displayName}>
                          {displayName}
                        </h4>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1">
                          {ref.isTeacher ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-200 bg-emerald-500/20 border border-emerald-400/30 px-2 py-0.5 rounded-md">
                              <GraduationCap className="h-3 w-3 shrink-0" />
                              <span>أستاذ(ة) التربية البدنية</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-200 bg-white/10 border border-white/15 px-2 py-0.5 rounded-md">
                              <UserCheck className="h-3 w-3 shrink-0" />
                              <span>إطار تحكيمي معتمد</span>
                            </span>
                          )}
                          {primaryDiploma && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-950 bg-amber-400 px-2 py-0.5 rounded-md shadow-2xs truncate max-w-[165px]">
                              <span>🏅</span>
                              <span className="truncate">{primaryDiploma}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Body: Institution + Specialties & Diplomas */}
                  <div className="p-4 space-y-3.5">
                    {ref.workLocation && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70 text-xs">
                        <Building className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                        <span className="text-slate-500 font-semibold text-[11px]">مقر العمل:</span>
                        <span className="font-bold text-slate-800 truncate" title={ref.workLocation}>
                          {ref.workLocation}
                        </span>
                      </div>
                    )}

                    {/* Specialties & Corresponding Diploma / Level */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-black text-slate-500">
                        <span>التخصصات التحكيمية ومستوى الاعتماد:</span>
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                          {specialties.length || 1} تخصص
                        </span>
                      </div>

                      {specialties.length > 0 ? (
                        <div className="space-y-1.5">
                          {specialties.map(spec => {
                            const sportDetails = SPORTS_MAP[spec] || { name: spec, icon: '🏆' };
                            const specDiploma = getRefereeDiplomaForSport(ref, spec);
                            return (
                              <div
                                key={`card-spec-${ref.id}-${spec}`}
                                className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50/90 border border-slate-200/80"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm shrink-0 shadow-3xs">
                                    {sportDetails.icon}
                                  </span>
                                  <span className="text-xs font-black text-slate-800 truncate">
                                    {sportDetails.name}
                                  </span>
                                </div>

                                {specDiploma ? (
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300/90 text-amber-950 text-[10px] font-black shrink-0 max-w-[55%]"
                                    title={specDiploma}
                                  >
                                    <Award className="h-3 w-3 text-amber-600 shrink-0" />
                                    <span className="truncate">{specDiploma}</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenModal(ref)}
                                    className="text-[10px] font-bold text-slate-400 hover:text-amber-700 transition-colors cursor-pointer shrink-0"
                                  >
                                    + تحديد المستوى / الشهادة
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-700">حكم متعدد التخصصات الرياضية</span>
                          {ref.diploma && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-950 text-[10px] font-black">
                              🏅 {ref.diploma}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Footer: Direct WhatsApp + Phone Call */}
                <div className="px-4 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-2">
                  {hasValidPhone ? (
                    <>
                      <a
                        href={getWhatsAppUrl(ref.phone, waMessage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 min-h-[38px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs transition-colors"
                      >
                        <MessageCircle className="h-4 w-4 shrink-0" />
                        <span>مراسلة عبر واتساب</span>
                      </a>
                      <a
                        href={`tel:${ref.phone}`}
                        className="min-h-[38px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono font-bold tabular-nums flex items-center gap-1.5 transition-colors"
                        title="اتصال هاتفي مباشر"
                      >
                        <Phone className="h-3.5 w-3.5 text-slate-600 shrink-0" />
                        <span dir="ltr">{ref.phone}</span>
                      </a>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenModal(ref)}
                      className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-dashed border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <span>إضافة رقم الهاتف للتواصل المباشر</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Referee & Teacher Specialty Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col" dir="rtl">
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shadow-xs">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">
                    {editingRef ? 'تعديل بطاقة الحكم والشواهد المعتمدة' : 'إضافة أستاذ محكم أو حكم معتمد'}
                  </h3>
                  <p className="text-[11px] text-slate-300 font-medium">
                    تحديد التخصص الرياضي والدبلوم أو شهادة ومستوى التحكيم
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1">
              {/* Source Mode Selector when Adding New Referee */}
              {!editingRef && teachers.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setEntryMode('teacher')}
                    className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      entryMode === 'teacher'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" />
                    <span>اختيار أستاذ(ة) مسجل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEntryMode('manual');
                      setSelectedTeacherId('');
                    }}
                    className={`py-2 px-3 rounded-lg text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      entryMode === 'manual'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>إدخال حكم يدوياً</span>
                  </button>
                </div>
              )}

              {/* Searchable Teacher Picker */}
              {!editingRef && entryMode === 'teacher' && teachers.length > 0 && (
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <label className="block text-xs font-black text-slate-800">
                    ابحث واختر الأستاذ(ة) لإضافته للتخصص التحكيمي:
                  </label>
                  <div className="relative">
                    <Search className="h-4 w-4 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                    <input
                      type="text"
                      value={teacherSearchQuery}
                      onChange={(e) => setTeacherSearchQuery(e.target.value)}
                      placeholder="ابحث باسم الأستاذ(ة)، المؤسسة، أو رقم التأجير..."
                      className="w-full pr-9 pl-3 py-2 text-xs font-bold bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 bg-white rounded-lg border border-slate-200">
                    {filteredTeachersForPicker.length === 0 ? (
                      <p className="p-3 text-center text-xs text-slate-400">لا يوجد أستاذ مطابق للبحث</p>
                    ) : (
                      filteredTeachersForPicker.map(t => {
                        const isSelected = selectedTeacherId === t.id;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => handleSelectTeacherForReferee(t)}
                            className={`w-full px-3 py-2 text-right flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                              isSelected ? 'bg-emerald-50 text-emerald-950' : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-xs font-black truncate">{t.fullName}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {t.workLocation || 'بدون مؤسسة محددة'}
                              </p>
                            </div>
                            {isSelected ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                            ) : (
                              <span className="text-[10px] font-bold text-blue-600 shrink-0">اختيار</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* Name & Phone */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل للحكم *</label>
                  <input
                    type="text"
                    required
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full text-xs font-bold rounded-xl border border-slate-200 px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    placeholder="الاسم العائلي والشخصي"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (واتساب) *</label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full text-xs font-mono font-bold tabular-nums rounded-xl border border-slate-200 pl-3 pr-9 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 text-left"
                      placeholder="06XXXXXXXX"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <Phone className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Sports Specialties */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  التخصصات التحكيمية (اختر رياضة أو أكثر):
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(SPORTS_MAP).map(([key, sport]) => {
                    const isSelected = formData.specialty.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormData({
                              ...formData,
                              specialty: formData.specialty.filter(s => s !== key)
                            });
                          } else {
                            setFormData({
                              ...formData,
                              specialty: [...formData.specialty, key]
                            });
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 border-slate-900 text-amber-300 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{sport.icon}</span>
                        <span>{sport.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Diploma / Certificate / Refereeing Level Input Section */}
              <div className="p-3.5 bg-amber-50/75 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                    <Award className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>الدبلوم أو الشهادة أو مستوى التحكيم:</span>
                  </label>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                    يظهر في البطاقة الرسمية
                  </span>
                </div>

                {formData.specialty.length > 0 ? (
                  <div className="space-y-2.5">
                    {formData.specialty.map(spId => {
                      const spInfo = SPORTS_MAP[spId] || { name: spId, icon: '🏆' };
                      const currentVal = formData.specialtyDiplomas[spId] || '';
                      return (
                        <div key={`modal-dip-${spId}`} className="bg-white p-3 rounded-xl border border-amber-200/90 space-y-2 shadow-3xs">
                          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                            <span>{spInfo.icon}</span>
                            <span>تخصص {spInfo.name}:</span>
                          </span>
                          <input
                            type="text"
                            value={currentVal}
                            onChange={(e) =>
                              setFormData(prev => ({
                                ...prev,
                                specialtyDiplomas: {
                                  ...prev.specialtyDiplomas,
                                  [spId]: e.target.value
                                }
                              }))
                            }
                            placeholder="اكتب الدبلوم أو الشهادة أو مستوى التحكيم (مثال: حكم فدرالي درجة 1، شهادة عصبة الشرق...)"
                            className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                          />
                          <div className="flex flex-wrap gap-1">
                            {DIPLOMA_PRESETS.map(preset => (
                              <button
                                key={preset}
                                type="button"
                                onClick={() =>
                                  setFormData(prev => ({
                                    ...prev,
                                    specialtyDiplomas: {
                                      ...prev.specialtyDiplomas,
                                      [spId]: preset
                                    }
                                  }))
                                }
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                                  currentVal === preset
                                    ? 'bg-amber-600 text-white border-amber-600'
                                    : 'bg-amber-50/70 hover:bg-amber-100 text-amber-900 border-amber-200'
                                }`}
                              >
                                {preset}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.diploma}
                      onChange={(e) => setFormData({ ...formData, diploma: e.target.value })}
                      placeholder="اكتب الدبلوم أو الشهادة أو مستوى التحكيم العام..."
                      className="w-full px-3 py-2 text-xs font-bold text-slate-800 bg-white border border-amber-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-500"
                    />
                    <div className="flex flex-wrap gap-1">
                      {DIPLOMA_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setFormData({ ...formData, diploma: preset })}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                            formData.diploma === preset
                              ? 'bg-amber-600 text-white border-amber-600'
                              : 'bg-white hover:bg-amber-100 text-amber-900 border-amber-200'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white py-2.5 rounded-xl text-xs font-black transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'جاري الحفظ...' : editingRef ? 'حفظ تعديلات البطاقة' : 'اعتماد وحفظ بطاقة الحكم'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={!!refereeToDelete}
        onClose={() => setRefereeToDelete(null)}
        onConfirm={handleConfirmDeleteReferee}
        title="حذف بطاقة الحكم"
        message="هل أنت متأكد من رغبتك في حذف هذا الحكم من الهيئة المعتمدة؟"
        itemName={refereeToDelete ? cleanDisplayName(refereeToDelete.fullName) : undefined}
        isDeleting={isDeleting}
      />
    </div>
  );
};
