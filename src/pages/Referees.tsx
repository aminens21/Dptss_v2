import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { Referee } from '../types';
import {
  ShieldCheck,
  Search,
  Phone,
  Filter,
  RefreshCw,
  Plus,
  Trash2,
  Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Referees: React.FC = () => {
  const { userProfile } = useAuth();
  const [referees, setReferees] = useState<Referee[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSport, setSelectedSport] = useState('');

  // Determine user's primary/preferred sport specialty for automatic focus on login
  const preferredSportId = useMemo(() => {
    if (!userProfile) return '';
    
    // 1. Sport Manager
    if (userProfile.role === 'SPORT_MANAGER') {
      return userProfile.sportId || '';
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
    
    return '';
  }, [userProfile]);

  // Set initial selected sport to user preferred specialty upon login/data load
  useEffect(() => {
    if (preferredSportId) {
      setSelectedSport(preferredSportId);
    }
  }, [preferredSportId]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRef, setEditingRef] = useState<Referee | null>(null);
  
  const [formData, setFormData] = useState<{ fullName: string; phone: string; specialty: string[] }>({ fullName: '', phone: '', specialty: [] });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadReferees();
    const handleDirChange = () => {
      loadReferees();
    };
    window.addEventListener('directorateChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
    };
  }, []);

  const loadReferees = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const data = await DataService.getReferees();
      const dirReferees = data.filter(r => (r.directorateId || 'taourirt') === activeDirId);
      setReferees(dirReferees);
    } catch (error) {
      console.error('Error loading referees:', error);
      toast.error('حدث خطأ أثناء تحميل قائمة الحكام');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (referee?: Referee) => {
    if (referee) {
      setEditingRef(referee);
      setFormData({
        fullName: referee.fullName,
        phone: referee.phone,
        specialty: referee.specialty || []
      });
    } else {
      setEditingRef(null);
      setFormData({ fullName: '', phone: '', specialty: [] });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRef(null);
    setFormData({ fullName: '', phone: '', specialty: [] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim() || !formData.phone.trim()) {
      toast.error('يرجى إدخال الاسم ورقم الهاتف');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingRef) {
        await DataService.updateReferee(editingRef.id, formData);
        toast.success('تم تحديث بيانات الحكم بنجاح');
      } else {
        const activeDirId = DataService.getActiveDirectorateId();
        await DataService.addReferee({ ...formData, isActive: true, directorateId: activeDirId });
        toast.success('تمت إضافة الحكم بنجاح');
      }
      handleCloseModal();
      loadReferees();
    } catch (error) {
      console.error('Submit referee error:', error);
      toast.error('حدث خطأ أثناء حفظ البيانات');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الحكم؟')) {
      try {
        await DataService.deleteReferee(id);
        toast.success('تم الحذف بنجاح');
        loadReferees();
      } catch (e) {
        toast.error('تعذر الحذف');
      }
    }
  };

  const filteredReferees = referees.filter((ref) => {
    const matchesSearch = ref.fullName.toLowerCase().includes(searchTerm.toLowerCase()) || ref.phone.includes(searchTerm);
    const matchesSport = selectedSport === '' || (Array.isArray(ref.specialty) ? ref.specialty.includes(selectedSport) : ref.specialty === selectedSport);
    return matchesSearch && matchesSport;
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <span>لائحة الحكام</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة قائمة الحكام المعتمدين والتواصل معهم
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            onClick={loadReferees}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer bg-white transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">تحديث</span>
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>إضافة حكم</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 md:p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="البحث بالاسم أو رقم الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-800"
          />
        </div>
        
        <div className="relative md:w-64">
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <Filter className="h-4 w-4 text-slate-400" />
          </div>
          <select
            value={selectedSport}
            onChange={(e) => setSelectedSport(e.target.value)}
            className="block w-full pr-9 pl-3 py-2 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none text-slate-800"
          >
            <option value="">جميع التخصصات</option>
            {Object.entries(SPORTS_MAP).map(([key, sport]) => (
              <option key={key} value={key}>{sport.icon} {sport.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mb-4 text-blue-500" />
          <p className="text-sm">جاري تحميل القائمة...</p>
        </div>
      ) : filteredReferees.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-xs">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
            <ShieldCheck className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">لا يوجد حكام</h3>
          <p className="text-sm text-slate-500">
            لم يتم العثور على أي حكم يطابق معايير البحث
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredReferees.map((ref) => {
            const specialties = Array.isArray(ref.specialty) ? ref.specialty : (ref.specialty ? [ref.specialty] : []);
            return (
              <div key={ref.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0">
                      {ref.fullName[0].toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{ref.fullName}</h4>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {specialties.length > 0 ? (
                          specialties.map(spec => {
                            const sportDetails = SPORTS_MAP[spec];
                            if (!sportDetails) return null;
                            return (
                              <span key={spec} className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                {sportDetails.icon} {sportDetails.name}
                              </span>
                            );
                          })
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            متعدد التخصصات
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!ref.isTeacher && (
                      <>
                        <button onClick={() => handleOpenModal(ref)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded transition-colors" title="تعديل">
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDelete(ref.id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded transition-colors" title="حذف">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="pt-3 border-t border-slate-100">
                  <a href={`tel:${ref.phone}`} className="flex items-center gap-2 text-slate-600 hover:text-blue-600 transition-colors text-xs font-bold">
                    <Phone className="h-4 w-4" />
                    <span dir="ltr">{ref.phone}</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl overflow-hidden" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-800">
                {editingRef ? 'تعديل بيانات الحكم' : 'إضافة حكم جديد'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم الكامل</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="الاسم العائلي والشخصي"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف (واتساب)</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    className="w-full text-xs rounded-lg border border-slate-200 pl-3 pr-9 py-2.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-left"
                    placeholder="06..."
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    <Phone className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">التخصصات (يمكن اختيار أكثر من تخصص)</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(SPORTS_MAP).map(([key, sport]) => {
                    const isSelected = formData.specialty.includes(key);
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setFormData({...formData, specialty: formData.specialty.filter(s => s !== key)});
                          } else {
                            setFormData({...formData, specialty: [...formData.specialty, key]});
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 border-blue-200 text-blue-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span>{sport.icon}</span>
                        <span>{sport.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              
              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'جاري الحفظ...' : 'حفظ'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded-lg text-xs font-bold transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
