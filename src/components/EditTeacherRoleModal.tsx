import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, School, Sport } from '../types';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  UserCheck,
  Award,
  ShieldCheck,
  Building,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Save,
  GraduationCap,
  LogIn,
  Trash2,
  Search
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EditTeacherRoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: User | null;
  schools?: School[];
  onSuccess?: (updatedTeacher: User) => void;
  onDelete?: (deletedTeacherId: string) => void;
}

export const EditTeacherRoleModal: React.FC<EditTeacherRoleModalProps> = ({
  isOpen,
  onClose,
  teacher,
  schools = [],
  onSuccess,
  onDelete
}) => {
  const navigate = useNavigate();
  const { userProfile, updateProfileState, isDemo, loginAsDemo } = useAuth();

  const [cadre, setCadre] = useState<'PRIMARY' | 'MIDDLE' | 'HIGH' | string>(teacher?.teachingCadre || 'HIGH');
  const [role, setRole] = useState<'TEACHER' | 'SPORT_MANAGER' | 'CENTRAL_ADMIN'>(
    teacher?.role === 'CENTRAL_ADMIN' ? 'CENTRAL_ADMIN' : teacher?.role === 'SPORT_MANAGER' ? 'SPORT_MANAGER' : 'TEACHER'
  );
  const [fullName, setFullName] = useState<string>(teacher?.fullName || '');
  const [email, setEmail] = useState<string>(teacher?.email || '');
  const [phone, setPhone] = useState<string>(teacher?.phone || '');
  const [isTechCommitteeHead, setIsTechCommitteeHead] = useState<boolean>(!!teacher?.isTechCommitteeHead);
  const [techCommitteeSports, setTechCommitteeSports] = useState<string[]>(teacher?.techCommitteeSports || []);
  const [isTechCommitteeMember, setIsTechCommitteeMember] = useState<boolean>(!!teacher?.isTechCommitteeMember);
  const [techCommitteeMemberSports, setTechCommitteeMemberSports] = useState<string[]>(teacher?.techCommitteeSportsMemberOf || []);
  const [refereeSpecialty, setRefereeSpecialty] = useState<string[]>(
    Array.isArray(teacher?.refereeSpecialty) ? teacher.refereeSpecialty : teacher?.refereeSpecialty ? [teacher.refereeSpecialty] : []
  );
  const [workLocation, setWorkLocation] = useState<string>(teacher?.workLocation || '');
  const [leaseNumber, setLeaseNumber] = useState<string>(teacher?.leaseNumber || '');
  const [schoolSearch, setSchoolSearch] = useState<string>('');
  const [schoolTypeFilter, setSchoolTypeFilter] = useState<'ALL' | 'تأهيلي' | 'إعدادي' | 'ابتدائي'>('ALL');
  const [allSportsList, setAllSportsList] = useState<Array<{ id: string; name: string; icon: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load sports
  useEffect(() => {
    if (isOpen) {
      DataService.getSportsConfig()
        .then(sports => {
          const mapped = sports.map(s => ({
            id: s.id,
            name: s.name,
            icon: s.icon || '🏆'
          }));
          setAllSportsList(mapped);
        })
        .catch(err => {
          console.error("Error loading sports in EditTeacherRoleModal:", err);
          const fallback = Object.entries(SPORTS_MAP).map(([k, v]) => ({
            id: k,
            name: v.name,
            icon: v.icon || '🏆'
          }));
          setAllSportsList(fallback);
        });
    }
  }, [isOpen]);

  // Sync state whenever selected teacher changes or modal opens
  useEffect(() => {
    if (teacher) {
      setCadre(teacher.teachingCadre || 'HIGH');
      setRole(teacher.role === 'CENTRAL_ADMIN' ? 'CENTRAL_ADMIN' : teacher.role === 'SPORT_MANAGER' ? 'SPORT_MANAGER' : 'TEACHER');
      setFullName(teacher.fullName || '');
      setEmail(teacher.email || '');
      setPhone(teacher.phone || '');
      setIsTechCommitteeHead(!!teacher.isTechCommitteeHead);
      setTechCommitteeSports(teacher.techCommitteeSports || []);
      setIsTechCommitteeMember(!!teacher.isTechCommitteeMember);
      setTechCommitteeMemberSports(teacher.techCommitteeSportsMemberOf || []);
      setRefereeSpecialty(
        Array.isArray(teacher.refereeSpecialty) ? teacher.refereeSpecialty : teacher.refereeSpecialty ? [teacher.refereeSpecialty] : []
      );
      setWorkLocation(teacher.workLocation || '');
      setLeaseNumber(teacher.leaseNumber || '');
      setSchoolSearch('');
      setSchoolTypeFilter('ALL');
      setShowDeleteConfirm(false);
    }
  }, [teacher, isOpen]);

  if (!isOpen || !teacher) return null;

  const handleToggleSportHead = (sportId: string) => {
    setTechCommitteeSports(prev => 
      prev.includes(sportId) ? prev.filter(id => id !== sportId) : [...prev, sportId]
    );
  };

  const handleToggleSportMember = (sportId: string) => {
    setTechCommitteeMemberSports(prev => 
      prev.includes(sportId) ? prev.filter(id => id !== sportId) : [...prev, sportId]
    );
  };

  const handleToggleRefereeSport = (sportId: string) => {
    setRefereeSpecialty(prev => 
      prev.includes(sportId) ? prev.filter(id => id !== sportId) : [...prev, sportId]
    );
  };

  const saveTeacherData = async (): Promise<User | null> => {
    if (!teacher) return null;

    const primarySport = isTechCommitteeHead && techCommitteeSports.length > 0 ? techCommitteeSports[0] : (teacher.sportId || undefined);

    const updateData: Partial<User> = {
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      teachingCadre: cadre,
      role: role,
      isTechCommitteeHead: isTechCommitteeHead,
      techCommitteeSports: isTechCommitteeHead ? techCommitteeSports : [],
      sportId: primarySport,
      isTechCommitteeMember: isTechCommitteeMember,
      techCommitteeSportsMemberOf: isTechCommitteeMember ? techCommitteeMemberSports : [],
      refereeSpecialty: refereeSpecialty,
      workLocation: workLocation.trim(),
      leaseNumber: leaseNumber.trim(),
      updatedAt: new Date()
    };

    await DataService.updateUserProfile(teacher.id, updateData);

    const updatedUser: User = {
      ...teacher,
      ...updateData
    };

    // Reactively update current AuthContext profile if this teacher is currently active
    const isCurrentActiveUser = userProfile && (
      userProfile.id === teacher.id ||
      (userProfile.email && teacher.email && userProfile.email.toLowerCase() === teacher.email.toLowerCase()) ||
      (userProfile.leaseNumber && teacher.leaseNumber && userProfile.leaseNumber === teacher.leaseNumber)
    );

    if (isCurrentActiveUser) {
      updateProfileState(updateData);
      if (isDemo) {
        localStorage.setItem('demo_user_profile', JSON.stringify({
          ...userProfile,
          ...updateData
        }));
      }
    }

    return updatedUser;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacher) return;

    setSaving(true);
    try {
      const updatedUser = await saveTeacherData();
      if (!updatedUser) return;

      toast.success(`تم تحديث صفة وإطار الأستاذ ${teacher.fullName} بنجاح!`);
      if (onSuccess) {
        onSuccess(updatedUser);
      }
      onClose();
    } catch (error) {
      console.error('Error updating teacher role/cadre:', error);
      toast.error('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndTestLogin = async () => {
    if (!teacher) return;
    setSaving(true);
    try {
      const updatedUser = await saveTeacherData();
      if (!updatedUser) return;

      toast.success(`تم حفظ صفة الأستاذ ${teacher.fullName} وتفعيل الحساب للتجربة!`);
      if (onSuccess) {
        onSuccess(updatedUser);
      }
      onClose();

      // Switch active demo login to this teacher
      const assignedSport = isTechCommitteeHead && techCommitteeSports.length > 0 ? techCommitteeSports[0] : teacher.sportId;
      loginAsDemo(
        role,
        teacher.fullName,
        teacher.email || `prof.${teacher.id}@taourirt-sports.ma`,
        assignedSport,
        undefined,
        updatedUser
      );

      // Navigate to Tournaments so the user can immediately test permissions!
      navigate('/tournaments');
    } catch (error) {
      console.error('Error in save and test login:', error);
      toast.error('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTeacher = async () => {
    if (!teacher) return;
    setDeleting(true);
    try {
      await DataService.deleteUser(teacher.id);
      toast.success(`تم حذف حساب الأستاذ ${fullName || teacher.fullName} بنجاح!`);
      if (onDelete) {
        onDelete(teacher.id);
      }
      onClose();
    } catch (error) {
      console.error("Error deleting teacher:", error);
      toast.error("حدث خطأ أثناء حذف الحساب");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/75 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-auto">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-800 text-white p-5 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-xl font-black shrink-0 overflow-hidden shadow-inner">
              {teacher.photoUrl ? (
                <img src={teacher.photoUrl} alt={teacher.fullName} className="w-full h-full object-cover" />
              ) : (
                <span>{teacher.fullName[0]?.toUpperCase()}</span>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-white/20 text-blue-100 border border-white/20">
                  تعديل الصفة والمهام
                </span>
                <span className="text-[10px] font-bold text-slate-200 font-mono">
                  {teacher.leaseNumber || 'بدون تأجير'}
                </span>
              </div>
              <h3 className="text-base font-black text-white mt-1">{teacher.fullName}</h3>
              <p className="text-xs text-blue-100/80 font-medium truncate max-w-xs">
                {teacher.workLocation ? `مقر العمل: ${teacher.workLocation}` : 'المديرية الإقليمية تاوريرت'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 md:p-6 space-y-5 max-h-[75vh] overflow-y-auto bg-slate-50/50">
          
          {/* Section 0: البيانات الشخصية والاتصال */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-3xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <label className="text-xs font-black text-slate-800 flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600" />
                <span>البيانات الشخصية ومعلومات الاتصال *</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">الاسم الكامل:</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold"
                  placeholder="الاسم الكامل للأستاذ"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">البريد الإلكتروني:</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium"
                  placeholder="example@mail.com"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">رقم الهاتف:</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                  placeholder="06XXXXXXXX"
                  dir="ltr"
                />
              </div>
            </div>
          </div>
          
          {/* Section 1: Teaching Cadre (السلك والإطار التعليمي) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-3xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <label className="text-xs font-black text-slate-800 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-blue-600" />
                <span>الإطار والسلك التعليمي (صفة الأستاذ) *</span>
              </label>
              <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold">
                المسلك الوظيفي
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { id: 'PRIMARY', label: 'أستاذ التعليم الابتدائي', sub: 'السلك الابتدائي', icon: '🏫', color: 'border-emerald-500 bg-emerald-50/50 text-emerald-900' },
                { id: 'MIDDLE', label: 'أستاذ الثانوي الإعدادي', sub: 'السلك الإعدادي', icon: '📘', color: 'border-indigo-500 bg-indigo-50/50 text-indigo-900' },
                { id: 'HIGH', label: 'أستاذ الثانوي التأهيلي', sub: 'السلك التأهيلي', icon: '🎓', color: 'border-purple-500 bg-purple-50/50 text-purple-900' },
              ].map((c) => {
                const isSelected = cadre === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCadre(c.id)}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer relative flex flex-col justify-between ${
                      isSelected
                        ? `${c.color} ring-2 ring-blue-500 font-black shadow-xs`
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xl">{c.icon}</span>
                      {isSelected && (
                        <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold leading-tight">{c.label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{c.sub}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Roles and Field Responsibilities (الصفة التأطيرية والمسؤوليات) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-3xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <label className="text-xs font-black text-slate-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-600" />
                <span>الصفات التأطيرية والمهام الرياضية الميدانية</span>
              </label>
            </div>

            {/* Main Role Dropdown */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                الدور والصفة العامة في المنظومة:
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold text-slate-800 cursor-pointer"
              >
                <option value="TEACHER">أستاذ مؤطر (TEACHER)</option>
                <option value="SPORT_MANAGER">منسق مادة التربية البدنية بالمؤسسة (SPORT_MANAGER)</option>
                <option value="CENTRAL_ADMIN">مسير إقليمي (CENTRAL_ADMIN)</option>
              </select>
            </div>

            {/* Technical Committee Head Toggle */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <ShieldCheck className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">رئيس لجنة تقنية إقليمية</span>
                    <span className="text-[10px] text-slate-500">منحه صفة رئاسة اللجنة التقنية للرياضة المدرسية</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTechCommitteeHead}
                    onChange={(e) => setIsTechCommitteeHead(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Sports Selection if Tech Committee Head */}
              {isTechCommitteeHead && (
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5 animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-blue-800 block">حدد الرياضات التي يرأس لجنتها:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(allSportsList.length > 0 ? allSportsList : Object.entries(SPORTS_MAP).map(([k, v]) => ({ id: k, name: v.name, icon: v.icon || '🏆' }))).map((sportItem) => {
                      const isChecked = techCommitteeSports.includes(sportItem.id);
                      return (
                        <button
                          key={sportItem.id}
                          type="button"
                          onClick={() => handleToggleSportHead(sportItem.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border text-right cursor-pointer ${
                            isChecked
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{sportItem.icon}</span>
                          <span className="truncate">{sportItem.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Technical Committee Member Toggle */}
            <div className="bg-slate-50/80 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <Award className="h-4 w-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">عضو لجنة تقنية إقليمية</span>
                    <span className="text-[10px] text-slate-500">المشاركة في اللجان التقنية للرياضات المختلفة</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isTechCommitteeMember}
                    onChange={(e) => setIsTechCommitteeMember(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Sports Selection if Tech Committee Member */}
              {isTechCommitteeMember && (
                <div className="pt-2 border-t border-slate-200/80 space-y-1.5 animate-in fade-in duration-150">
                  <span className="text-[11px] font-bold text-indigo-800 block">حدد الرياضات التي يشارك في لجنتها كعضو:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {(allSportsList.length > 0 ? allSportsList : Object.entries(SPORTS_MAP).map(([k, v]) => ({ id: k, name: v.name, icon: v.icon || '🏆' }))).map((sportItem) => {
                      const isChecked = techCommitteeMemberSports.includes(sportItem.id);
                      return (
                        <button
                          key={`member-sport-${sportItem.id}`}
                          type="button"
                          onClick={() => handleToggleSportMember(sportItem.id)}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border text-right cursor-pointer ${
                            isChecked
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <span>{sportItem.icon}</span>
                          <span className="truncate">{sportItem.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Referee Specialties Selection */}
            <div className="space-y-2 pt-1">
              <label className="text-xs font-bold text-slate-700 block flex items-center gap-1.5">
                <span>تخصصات التحكيم الرياضي المعتمدة للأستاذ:</span>
                <span className="text-[10px] text-slate-400 font-normal">(يظهر في سجل الحكام)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {(allSportsList.length > 0 ? allSportsList : Object.entries(SPORTS_MAP).map(([k, v]) => ({ id: k, name: v.name, icon: v.icon || '🏆' }))).map((sportItem) => {
                  const isChecked = refereeSpecialty.includes(sportItem.id);
                  return (
                    <button
                      key={`ref-${sportItem.id}`}
                      type="button"
                      onClick={() => handleToggleRefereeSport(sportItem.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all border text-right cursor-pointer ${
                        isChecked
                          ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span>{sportItem.icon}</span>
                      <span className="truncate">{sportItem.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 3: Work Location and Lease Number Verification */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-3xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5 pb-2 border-b border-slate-100">
              <Building className="h-4 w-4 text-blue-600" />
              <span>بيانات التعيين والتعريف الإداري</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  رقم التأجير الوزاري:
                </label>
                <div className="relative">
                  <CreditCard className="h-4 w-4 absolute right-3 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={leaseNumber}
                    onChange={(e) => setLeaseNumber(e.target.value)}
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-mono font-bold"
                    placeholder="مثال: 145896"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  مقر العمل (المؤسسة التعليمية):
                </label>
                {schools.length > 0 ? (
                  <div className="space-y-2">
                    {/* Search and Cycle Filtering Section */}
                    <div className="space-y-1.5 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      {/* Search Input */}
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute right-2.5 top-2 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="ابحث باسم المؤسسة..."
                          value={schoolSearch}
                          onChange={(e) => setSchoolSearch(e.target.value)}
                          className="w-full pr-8 pl-3 py-1 bg-white border border-slate-200 rounded-lg text-[11px] font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      {/* Cycle Filter Buttons (الأسلاك التعليمية) */}
                      <div className="flex flex-wrap gap-1" dir="rtl">
                        <button
                          type="button"
                          onClick={() => setSchoolTypeFilter('ALL')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                            schoolTypeFilter === 'ALL'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-3xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          الكل ({schools.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSchoolTypeFilter('تأهيلي')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                            schoolTypeFilter === 'تأهيلي'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-3xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          تأهيلي ({schools.filter(s => s.type === 'تأهيلي').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSchoolTypeFilter('إعدادي')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                            schoolTypeFilter === 'إعدادي'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-3xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          إعدادي ({schools.filter(s => s.type === 'إعدادي').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setSchoolTypeFilter('ابتدائي')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all border cursor-pointer ${
                            schoolTypeFilter === 'ابتدائي'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-3xs'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          ابتدائي ({schools.filter(s => s.type === 'ابتدائي').length})
                        </button>
                      </div>
                    </div>

                    {/* Filtered Dropdown List */}
                    <select
                      value={workLocation}
                      onChange={(e) => setWorkLocation(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-bold"
                    >
                      <option value="">اختر المؤسسة التعليمية...</option>
                      
                      {/* Edge case: If the current location is filtered out, preserve it explicitly */}
                      {(() => {
                        const filtered = schools.filter(sch => {
                          const matchesType = schoolTypeFilter === 'ALL' || sch.type === schoolTypeFilter;
                          const matchesSearch = schoolSearch.trim() === '' || 
                            sch.name.toLowerCase().includes(schoolSearch.toLowerCase()) ||
                            (sch.commune && sch.commune.toLowerCase().includes(schoolSearch.toLowerCase()));
                          return matchesType && matchesSearch;
                        });

                        const currentSchoolObj = schools.find(sch => sch.name === workLocation);
                        const showCurrentLocationOption = workLocation && currentSchoolObj && !filtered.some(sch => sch.id === currentSchoolObj.id);

                        return (
                          <>
                            {showCurrentLocationOption && currentSchoolObj && (
                              <option key={`current-${currentSchoolObj.id}`} value={currentSchoolObj.name} className="bg-amber-50 font-black">
                                📌 {currentSchoolObj.name} ({currentSchoolObj.type === 'تأهيلي' ? 'ثانوي تأهيلي' : currentSchoolObj.type === 'إعدادي' ? 'ثانوي إعدادي' : 'ابتدائي'}) [مقر العمل الحالي]
                              </option>
                            )}

                            {filtered.map(sch => (
                              <option key={sch.id} value={sch.name}>
                                {sch.name} ({sch.type === 'تأهيلي' ? 'ثانوي تأهيلي' : sch.type === 'إعدادي' ? 'ثانوي إعدادي' : 'ابتدائي'})
                              </option>
                            ))}
                          </>
                        );
                      })()}
                    </select>
                  </div>
                ) : (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                    لم يتم إدراج أي مؤسسات تعليمية في هذه المديرية بعد. يرجى إضافة المؤسسات من تبويب المؤسسات التعليمية أولاً.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Delete Account Warning Block */}
          {showDeleteConfirm && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-2xl space-y-3 animate-in slide-in-from-top-4 duration-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-black text-red-900">تأكيد حذف الحساب نهائياً</h5>
                  <p className="text-[11px] text-red-700 font-medium mt-1">
                    هل أنت متأكد من رغبتك في حذف حساب الأستاذ <strong>{fullName || teacher.fullName}</strong>؟ هذا الإجراء سيقوم بإزالة بياناته من النظام بالكامل ولا يمكن التراجع عنه.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTeacher}
                  disabled={deleting}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{deleting ? 'جاري الحذف...' : 'نعم، احذف الحساب'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Modal Actions */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-200/80">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveAndTestLogin}
                disabled={saving || deleting}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="تطبيق التعديلات والانتقال فوراً لصفحة البطولات لتجربة الصلاحيات الجديدة مباشرة"
              >
                <LogIn className="h-4 w-4" />
                <span>حفظ وتجربة الدخول 🚀</span>
              </button>

              {(userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'SPORT_MANAGER') && !showDeleteConfirm && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={saving || deleting}
                  className="flex items-center justify-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  title="حذف حساب هذا الأستاذ نهائياً من المنظومة"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف الحساب</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={saving || deleting}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving || deleting}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};
