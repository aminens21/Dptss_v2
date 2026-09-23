import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { User, Sport } from '../types';
import {
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  X,
  Trophy,
  RefreshCw,
  AlertCircle,
  Users,
  UserPlus,
  Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';

export const TechCommitteeHeads: React.FC = () => {
  const { userProfile } = useAuth();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states for Heads
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'head' | 'member';
    id: string;
    sportKey?: string;
    name: string;
    title: string;
    message: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for Members
  const [addingMemberSport, setAddingMemberSport] = useState<string | null>(null);
  const [selectedMemberTeacherId, setSelectedMemberTeacherId] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Dedicated Member Modal for the Central Manager (المسير)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedMemberSport, setSelectedMemberSport] = useState('');
  const [selectedMemberIdForModal, setSelectedMemberIdForModal] = useState('');
  const [isSubmittingMemberModal, setIsSubmittingMemberModal] = useState(false);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);

  const effectiveSportsMap = useMemo(() => {
    const map: Record<string, { name: string; icon: string }> = { ...SPORTS_MAP };
    sportsConfig.forEach((s: Sport) => {
      if (s.id) {
        map[s.id] = { name: s.name, icon: s.icon };
      }
    });
    return map;
  }, [sportsConfig, SPORTS_MAP]);

  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.isSuperAdmin || userProfile?.role === 'SPORT_MANAGER';
  const canManageTechCommittee = isCentralAdmin;

  useEffect(() => {
    loadData();
    const handleDirChange = () => {
      loadData();
    };
    window.addEventListener('directorateChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [allTeachers, allSports] = await Promise.all([
        DataService.getTeachers(),
        DataService.getSportsConfig()
      ]);
      const dirTeachers = allTeachers.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      setTeachers(dirTeachers);
      setSportsConfig(allSports);
    } catch (error) {
      console.error('Error loading teachers data:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMemberModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberSport) {
      toast.error('يرجى اختيار الصنف الرياضي');
      return;
    }
    if (!selectedMemberIdForModal) {
      toast.error('يرجى اختيار الأستاذ المعني');
      return;
    }

    setIsSubmittingMemberModal(true);
    try {
      const teacherToUpdate = teachers.find(t => t.id === selectedMemberIdForModal);
      if (teacherToUpdate) {
        const currentSports = teacherToUpdate.techCommitteeSportsMemberOf || [];
        const updatedSports = [...new Set([...currentSports, selectedMemberSport])];
        
        await DataService.updateUserProfile(teacherToUpdate.id, {
          isTechCommitteeMember: true,
          techCommitteeSportsMemberOf: updatedSports
        });

        const sportInfo = effectiveSportsMap[selectedMemberSport]?.name || '';
        toast.success(`تمت إضافة الأستاذ ${teacherToUpdate.fullName} كعضو في لجنة ${sportInfo} بنجاح`);
        setIsMemberModalOpen(false);
        setSelectedMemberSport('');
        setSelectedMemberIdForModal('');
        loadData();
      }
    } catch (err) {
      console.error('Error adding tech committee member:', err);
      toast.error('حدث خطأ أثناء إضافة العضو للجنة الرياضية');
    } finally {
      setIsSubmittingMemberModal(false);
    }
  };

  // Tech committee heads list
  const heads = teachers.filter(t => t.isTechCommitteeHead);

  // Filtered heads based on search term
  const filteredHeads = heads.filter(h => {
    const matchesSearch =
      h.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (h.workLocation && h.workLocation.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (h.techCommitteeSports && h.techCommitteeSports.some(s => {
        const sportInfo = effectiveSportsMap[s];
        return sportInfo && sportInfo.name.toLowerCase().includes(searchTerm.toLowerCase());
      }));
    return matchesSearch;
  });

  const handleOpenAssignModal = () => {
    setIsEditing(false);
    setEditingHeadId(null);
    setSelectedTeacherId('');
    setSelectedSports([]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (head: User) => {
    setIsEditing(true);
    setEditingHeadId(head.id);
    setSelectedTeacherId(head.id);
    setSelectedSports(head.techCommitteeSports || []);
    setIsModalOpen(true);
  };

  const handleToggleSport = (sportKey: string) => {
    setSelectedSports(prev =>
      prev.includes(sportKey) ? prev.filter(k => k !== sportKey) : [...prev, sportKey]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      toast.error('يرجى اختيار الأستاذ المعني أولاً');
      return;
    }
    if (selectedSports.length === 0) {
      toast.error('يرجى تحديد تخصص رياضي واحد على الأقل للجنة التقنية');
      return;
    }

    setIsSubmitting(true);
    try {
      await DataService.updateUserProfile(selectedTeacherId, {
        isTechCommitteeHead: true,
        techCommitteeSports: selectedSports
      });

      toast.success(isEditing ? 'تم تحديث تعيين رئيس اللجنة التقنية بنجاح' : 'تم تعيين رئيس لجنة تقنية جديد بنجاح');
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحديث التعيين');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = (headId: string, headName: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'head',
      id: headId,
      name: headName,
      title: 'تأكيد إلغاء تعيين رئيس اللجنة التقنية',
      message: `هل أنت متأكد من رغبتك في إلغاء تعيين الأستاذ "${headName}" كرئيس للجنة التقنية وحذف صلاحياته الإشرافية؟`
    });
  };

  // Member Operations
  const handleAddMember = async (sportKey: string) => {
    if (!selectedMemberTeacherId) {
      toast.error('يرجى اختيار أستاذ أولاً');
      return;
    }

    setIsAddingMember(true);
    try {
      const teacherToUpdate = teachers.find(t => t.id === selectedMemberTeacherId);
      if (teacherToUpdate) {
        const currentSports = teacherToUpdate.techCommitteeSportsMemberOf || [];
        const updatedSports = [...new Set([...currentSports, sportKey])];
        
        await DataService.updateUserProfile(teacherToUpdate.id, {
          isTechCommitteeMember: true,
          techCommitteeSportsMemberOf: updatedSports
        });

        toast.success(`تمت إضافة الأستاذ ${teacherToUpdate.fullName} كعضو لجنة تقنية بنجاح`);
        setAddingMemberSport(null);
        setSelectedMemberTeacherId('');
        loadData();
      }
    } catch (err) {
      console.error('Error adding tech committee member:', err);
      toast.error('حدث خطأ أثناء إضافة العضو');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = (teacherId: string, sportKey: string, teacherName: string) => {
    const sportName = effectiveSportsMap[sportKey]?.name || 'هذا الصنف الرياضي';
    setDeleteConfirm({
      isOpen: true,
      type: 'member',
      id: teacherId,
      sportKey,
      name: teacherName,
      title: 'تأكيد إزالة عضو من اللجنة التقنية',
      message: `هل أنت متأكد من رغبتك في إزالة الأستاذ "${teacherName}" من عضوية اللجنة التقنية لرياضة (${sportName})؟`
    });
  };

  const handleExecuteDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'head') {
        await DataService.updateUserProfile(deleteConfirm.id, {
          isTechCommitteeHead: false,
          techCommitteeSports: []
        });
        toast.success(`تم إلغاء تعيين الأستاذ "${deleteConfirm.name}" بنجاح`);
      } else if (deleteConfirm.type === 'member' && deleteConfirm.sportKey) {
        const teacherToUpdate = teachers.find(t => t.id === deleteConfirm.id);
        const currentSports = teacherToUpdate?.techCommitteeSportsMemberOf || [];
        const updatedSports = currentSports.filter(s => s !== deleteConfirm.sportKey);
        await DataService.updateUserProfile(deleteConfirm.id, {
          isTechCommitteeMember: updatedSports.length > 0,
          techCommitteeSportsMemberOf: updatedSports
        });
        toast.success(`تمت إزالة الأستاذ "${deleteConfirm.name}" من عضوية اللجنة التقنية بنجاح`);
      }
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      console.error('Error during deletion execution:', err);
      toast.error('حدث خطأ أثناء تنفيذ الحذف، يرجى المحاولة مرة أخرى');
    } finally {
      setIsDeleting(false);
    }
  };

  // Get list of teachers who can be assigned as heads (excluding already assigned heads, unless in edit mode)
  const assignableTeachers = teachers.filter(t => !t.isTechCommitteeHead || t.id === editingHeadId);

  // Statistics
  const totalHeads = heads.length;
  const uniqueSportsCount = new Set(heads.flatMap(h => h.techCommitteeSports || [])).size;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header and Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <span>تدبير اللجان التقنية الرياضية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة وتعيين رؤساء وأعضاء اللجان التقنية المشرفة على تأطير وتنظيم البطولات والأنشطة الرياضية الإقليمية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>تحديث</span>
          </button>

          {isCentralAdmin && (
            <>
              <button
                onClick={handleOpenAssignModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>تعيين رئيس لجنة جديد</span>
              </button>
              <button
                onClick={() => {
                  setSelectedMemberSport('');
                  setSelectedMemberIdForModal('');
                  setIsMemberModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>تعيين عضو لجنة جديد</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards Dashboard Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">إجمالي رؤساء اللجن التقنية</p>
            <h3 className="text-2xl font-black text-slate-800">{totalHeads}</h3>
          </div>
          <span className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShieldCheck className="h-5.5 w-5.5" />
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">تخصصات رياضية مغطاة برئيس لجنة</p>
            <h3 className="text-2xl font-black text-emerald-600">{uniqueSportsCount} / {Object.keys(effectiveSportsMap).length}</h3>
          </div>
          <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Trophy className="h-5.5 w-5.5" />
          </span>
        </div>
      </div>

      {/* Section: رؤساء اللجان التقنية */}
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-600" />
            <span>دليل رؤساء اللجان التقنية المعينين</span>
          </h3>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center">
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              className="w-full text-xs pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
              placeholder="البحث باسم رئيس اللجنة أو الصنف الرياضي..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Tech Committee Heads List */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-xs text-slate-500 font-medium">جاري تحميل لائحة اللجن التقنية...</p>
          </div>
        ) : filteredHeads.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-slate-500 text-xs font-semibold">لا يوجد أي رئيس لجنة تقنية معين حالياً يطابق تصفيتك.</p>
            {isCentralAdmin && (
              <button
                onClick={handleOpenAssignModal}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                اضغط هنا لتعيين أول رئيس لجنة تقنية الآن
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHeads.map((head) => (
              <div
                key={head.id}
                className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col justify-between hover:border-blue-300 hover:shadow-md transition-all duration-200 relative overflow-hidden"
              >
                {/* Premium Top Accents */}
                <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-l from-blue-500 to-indigo-600"></div>
                
                <div>
                  {/* Profile Header */}
                  <div className="flex items-start justify-between gap-2.5 mt-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center text-sm font-bold shrink-0">
                        <ShieldCheck className="h-5.5 w-5.5 text-blue-600" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">{head.fullName}</h4>
                        <span className="inline-flex px-2 py-0.5 mt-1 bg-blue-50 text-blue-700 border border-blue-200 rounded text-[9px] font-bold">
                          رئيس لجنة تقنية
                        </span>
                      </div>
                    </div>

                    {isCentralAdmin && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEditModal(head)}
                          className="p-1 text-slate-400 hover:text-blue-600 rounded hover:bg-slate-50 cursor-pointer"
                          title="تعديل الأنشطة الرياضية"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleRevoke(head.id, head.fullName)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-slate-50 cursor-pointer"
                          title="إلغاء التعيين"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Info List */}
                  <div className="mt-4 space-y-2 text-xs border-t border-slate-100 pt-3">
                    {head.workLocation && (
                      <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" />
                        <span>{head.workLocation}</span>
                      </div>
                    )}
                    {head.phone && (
                      <div className="flex items-center gap-1.5 text-slate-600 font-mono">
                        <Phone className="h-3.5 w-3.5 text-slate-400" />
                        <span>{head.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-slate-500 truncate">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />
                      <span className="truncate">{head.email}</span>
                    </div>
                  </div>
                </div>

                {/* Sports Managed List */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold mb-1.5">الأنشطة واللجن المشرف عليها:</p>
                  <div className="flex flex-wrap gap-1">
                    {head.techCommitteeSports && head.techCommitteeSports.length > 0 ? (
                      head.techCommitteeSports.map(s => {
                        const sportInfo = effectiveSportsMap[s];
                        if (!sportInfo) return null;
                        return (
                          <span
                            key={s}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-md text-[10px] font-bold"
                          >
                            <span>{sportInfo.icon}</span>
                            <span>{sportInfo.name}</span>
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">لا يوجد أصناف معينة</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section: أعضاء اللجان التقنية */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-8">
        <div className="bg-slate-50/70 p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">أعضاء اللجان التقنية للأصناف الرياضية</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">أساتذة التربية البدنية المشكلون للجان التقنية والمكلفون بالتأطير والمتابعة ميدانياً</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(effectiveSportsMap).map(([sportKey, sportInfo]) => {
              const info = sportInfo as { name: string; icon: string };
              // Members of this specific sport committee
              const committeeMembers = teachers.filter(t => 
                t.isTechCommitteeMember && t.techCommitteeSportsMemberOf?.includes(sportKey)
              );

              // Find the head of this sport committee
              const sportHead = teachers.find(t => 
                t.isTechCommitteeHead && t.techCommitteeSports?.includes(sportKey)
              );

              const canManageThisSport = isCentralAdmin || (
                userProfile?.isTechCommitteeHead && 
                userProfile?.techCommitteeSports?.includes(sportKey)
              );

              // Teachers eligible to be added (not the head of this sport, and not already a member)
              const eligibleTeachers = teachers.filter(t => 
                t.id !== sportHead?.id &&
                (!t.techCommitteeSportsMemberOf || !t.techCommitteeSportsMemberOf.includes(sportKey))
              );

              return (
                <div 
                  key={sportKey} 
                  className="border border-slate-150 rounded-xl p-4 space-y-4 hover:border-slate-300 transition-colors bg-slate-50/30"
                >
                  {/* Sport Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info.icon}</span>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">لجنة {info.name}</h4>
                        <p className="text-[10px] text-slate-400">تنظيم وتدبير بطولات {info.name}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[9px] font-bold">
                      {committeeMembers.length} أعضاء
                    </span>
                  </div>

                  {/* Sport Head Info */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-blue-50 text-blue-600 rounded">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold">رئيس اللجنة التقنية</p>
                        <p className="font-bold text-slate-800">{sportHead ? sportHead.fullName : 'لم يتم تعيين رئيس للجنة التقنية بعد'}</p>
                      </div>
                    </div>
                    {sportHead && (
                      <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 border border-slate-150 rounded">{sportHead.workLocation || 'بدون مؤسسة'}</span>
                    )}
                  </div>

                  {/* Committee Members List */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold">أعضاء اللجنة التقنية:</p>
                    {committeeMembers.length === 0 ? (
                      <p className="text-slate-400 italic text-xs py-2 text-center bg-white rounded-lg border border-dashed border-slate-200">
                        لا يوجد أعضاء مضافين حالياً لهذه اللجنة التقنية.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {committeeMembers.map(member => (
                          <div 
                            key={member.id} 
                            className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:border-blue-200 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                                👤
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{member.fullName}</p>
                                <p className="text-[9px] text-slate-400">{member.workLocation || 'أستاذ'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              {member.phone && (
                                <span className="text-[9px] text-slate-400 font-mono hidden sm:inline">{member.phone}</span>
                              )}
                              {canManageThisSport && (
                                <button
                                  onClick={() => handleRemoveMember(member.id, sportKey, member.fullName)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                                  title="إزالة العضو من اللجنة"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Member Quick Selector */}
                  {canManageThisSport && (
                    <div className="pt-2 border-t border-slate-100">
                      {addingMemberSport === sportKey ? (
                        <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
                          <label className="block text-[10px] font-bold text-slate-500">اختر أستاذاً لإضافته كعضو للجنة التقنية للـ {(sportInfo as any).name}:</label>
                          <select
                            value={selectedMemberTeacherId}
                            onChange={(e) => setSelectedMemberTeacherId(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- اختر الأستاذ المعني --</option>
                            {eligibleTeachers.map(t => (
                              <option key={t.id} value={t.id}>
                                👨‍🏫 {t.fullName} ({t.workLocation || 'أستاذ'})
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-end gap-1.5 pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAddingMemberSport(null);
                                setSelectedMemberTeacherId('');
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddMember(sportKey)}
                              disabled={isAddingMember}
                              className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <UserPlus className="h-3 w-3" />
                              <span>إضافة كعضو</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingMemberSport(sportKey);
                            setSelectedMemberTeacherId('');
                          }}
                          className="w-full py-1.5 bg-white border border-dashed border-slate-250 hover:border-blue-400 hover:text-blue-600 text-slate-500 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          <span>تعيين أستاذ كعضو في لجنة {(sportInfo as any).name}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Appointment / Editing Modal for HEADS */}
      {isModalOpen && isCentralAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {isEditing ? 'تعديل تعيين اللجن الرياضية لـ رئيس اللجنة' : 'تعيين رئيس لجنة تقنية جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-5 space-y-4">
              {/* Select Teacher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اختر الأستاذ من لائحة هيئة التدريس <span className="text-red-500">*</span>
                </label>
                {isEditing ? (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs font-bold text-slate-700">
                    👨‍🏫 {teachers.find(t => t.id === selectedTeacherId)?.fullName}
                  </div>
                ) : (
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    required
                    className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- اختر أستاذاً للتعيين كمسؤول تقني --</option>
                    {assignableTeachers.map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        👨‍🏫 {teacher.fullName} ({teacher.workLocation || 'بدون مؤسسة محددة'})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  * يتم تعيين رئيس اللجنة التقنية حصراً من بين أساتذة التربية البدنية المسجلين بالنظام.
                </p>
              </div>

              {/* Select Sports */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  تحديد الأنشطة واللجن الرياضية المشرف عليها <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150 overflow-y-auto max-h-60">
                  {Object.entries(effectiveSportsMap).map(([key, sport]) => {
                    const isChecked = selectedSports.includes(key);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 px-2.5 py-2 bg-white rounded-lg border border-slate-200 hover:border-blue-400 cursor-pointer text-xs font-bold text-slate-700 transition-colors select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSport(key)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>{(sport as any).icon} {(sport as any).name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:bg-blue-300 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>جاري حفظ البيانات...</span>
                    </>
                  ) : (
                    <span>تأكيد وحفظ التعيين</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Modal for MEMBERS */}
      {isMemberModalOpen && isCentralAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  إضافة عضو جديد للجنة تقنية رياضية
                </h3>
              </div>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveMemberModal} className="p-5 space-y-4">
              {/* Select Sport */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اختر الصنف الرياضي / اللجنة <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedMemberSport}
                  onChange={(e) => setSelectedMemberSport(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- اختر الصنف الرياضي المعني --</option>
                  {Object.entries(effectiveSportsMap).map(([key, sport]) => (
                    <option key={key} value={key}>
                      {(sport as any).icon} {(sport as any).name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Teacher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اختر الأستاذ من لائحة هيئة التدريس <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedMemberIdForModal}
                  onChange={(e) => setSelectedMemberIdForModal(e.target.value)}
                  required
                  disabled={!selectedMemberSport}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="">
                    {!selectedMemberSport ? '-- يرجى تحديد الصنف الرياضي أولاً --' : '-- اختر أستاذاً لإضافته كعضو لجنة تقنية --'}
                  </option>
                  {teachers
                    .filter(t => {
                      if (!selectedMemberSport) return true;
                      return !t.techCommitteeSportsMemberOf?.includes(selectedMemberSport);
                    })
                    .map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        👨‍🏫 {teacher.fullName} ({teacher.workLocation || 'بدون مؤسسة محددة'})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  * تظهر في هذه اللائحة أسماء هيئة التدريس غير المنتمين لعضوية اللجنة التقنية المحددة مسبقاً.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMemberModal}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:bg-emerald-300 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingMemberModal ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>جاري إضافة العضو...</span>
                    </>
                  ) : (
                    <span>تأكيد الإضافة للجنة</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Interactive Delete / Revoke Confirmation Modal */}
      {deleteConfirm && deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">{deleteConfirm.title}</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">يرجى تأكيد هذا الإجراء للمتابعة</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
              {deleteConfirm.message}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDeleteConfirm}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:bg-red-300"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>نعم، تأكيد الحذف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
