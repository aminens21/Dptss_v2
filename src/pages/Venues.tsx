import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { Venue, Match } from '../types';
import {
  Plus,
  Search,
  MapPin,
  Building,
  Users,
  Edit3,
  Trash2,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle,
  Trophy,
  UserCheck,
  Phone,
  Filter
} from 'lucide-react';
import { CreateVenueModal } from '../components/CreateVenueModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import toast from 'react-hot-toast';

export const Venues: React.FC = () => {
  const { userProfile } = useAuth();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('ALL');
  const [selectedSport, setSelectedSport] = useState<string>('ALL');

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Both CENTRAL_ADMIN, SPORT_MANAGER and Technical Committee Head can manage venues
  const isTechCommitteeHead = userProfile?.isTechCommitteeHead === true;
  const canManage = userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'SPORT_MANAGER' || isTechCommitteeHead;

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

  // Set initial selected sport to user preferred specialty upon login/data load
  useEffect(() => {
    if (preferredSportId && preferredSportId !== 'ALL') {
      setSelectedSport(preferredSportId);
    }
  }, [preferredSportId]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vList, mList] = await Promise.all([
        DataService.getVenues(),
        DataService.getMatches()
      ]);
      setVenues(vList);
      setMatches(mList);
    } catch (e) {
      console.error(e);
      toast.error('تعذر تحميل مراكز التباري');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVenue = async (venueData: Omit<Venue, 'id'>) => {
    try {
      if (editingVenue) {
        await DataService.updateVenue(editingVenue.id, venueData);
        setVenues(prev => prev.map(v => v.id === editingVenue.id ? { ...v, ...venueData } : v));
        toast.success('تم تحديث مركز التباري بنجاح');
        setEditingVenue(null);
      } else {
        const created = await DataService.addVenue(venueData);
        setVenues(prev => [created, ...prev]);
        toast.success('تمت إضافة مركز التباري بنجاح');
      }
    } catch (e) {
      toast.error('حدث خطأ أثناء حفظ مركز التباري');
    }
  };

  const handleConfirmDelete = async () => {
    if (!venueToDelete) return;
    setIsDeleting(true);
    try {
      await DataService.deleteVenue(venueToDelete.id);
      setVenues(prev => prev.filter(v => v.id !== venueToDelete.id));
      toast.success('تم حذف مركز التباري بنجاح');
      setVenueToDelete(null);
    } catch (e) {
      toast.error('تعذر حذف مركز التباري');
    } finally {
      setIsDeleting(false);
    }
  };

  const getVenueMatches = (venueId: string) => {
    return matches.filter(m => m.venueId === venueId && (m.status === 'Scheduled' || m.status === 'Ongoing'));
  };

  const participatingVenueIdsForSport = useMemo(() => {
    if (selectedSport === 'ALL') return null;
    const ids = new Set<string>();
    matches.forEach(m => {
      if (m.sportId === selectedSport && m.venueId) {
        ids.add(m.venueId);
      }
    });
    return ids;
  }, [selectedSport, matches]);

  const filtered = venues.filter(v => {
    const matchSearch = v.name.toLowerCase().includes(search.toLowerCase()) ||
                        v.city.toLowerCase().includes(search.toLowerCase()) ||
                        v.address.toLowerCase().includes(search.toLowerCase()) ||
                        (v.notes || '').toLowerCase().includes(search.toLowerCase());
    const matchCity = cityFilter === 'ALL' || v.city === cityFilter;
    const matchSport = selectedSport === 'ALL' || (participatingVenueIdsForSport && participatingVenueIdsForSport.has(v.id));
    return matchSearch && matchCity && matchSport;
  });

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 md:p-5 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-slate-800">مراكز التباري والقاعات الرياضية</h2>
            <span className="text-[10px] bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded border border-blue-200">
              مديرية تاوريرت
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            دليل القاعات المغطاة والملاعب المعتمدة لاحتضان المنافسات وتتبع جاهزيتها وشغورها
          </p>
        </div>

        {canManage && (
          <button
            onClick={() => {
              setEditingVenue(null);
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مركز تباري</span>
          </button>
        )}
      </div>

      {/* Filter and search */}
      <div className="flex flex-col lg:flex-row items-center gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-1 items-center px-2 w-full">
          <Search className="h-4 w-4 text-slate-400 ml-2 shrink-0" />
          <input
            type="text"
            placeholder="ابحث باسم القاعة، المدينة، العنوان، أو المواصفات..."
            className="w-full border-0 focus:ring-0 text-xs py-1 text-slate-800 placeholder-slate-400 focus:outline-none"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Sport Filter Dropdown */}
        <div className="flex items-center gap-2 w-full lg:w-auto border-t lg:border-t-0 lg:border-r border-slate-100 pt-2 lg:pt-0 lg:pr-3 shrink-0">
          <label htmlFor="venues-sport-filter" className="text-xs font-bold text-slate-600 whitespace-nowrap flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-blue-600" />
            <span>الرياضة:</span>
          </label>
          <select
            id="venues-sport-filter"
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

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: `جميع المراكز (${venues.length})` },
            { id: 'تاوريرت', label: 'تاوريرت' },
            { id: 'العيون سيدي ملوك', label: 'العيون سيدي ملوك' },
            { id: 'سيدي لحسن', label: 'سيدي لحسن' },
          ].map(c => (
            <button
              key={c.id}
              onClick={() => setCityFilter(c.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                cityFilter === c.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Venues Grid */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.length > 0 ? (
            filtered.map((v) => {
              const bookedMatches = getVenueMatches(v.id);
              const isOccupied = bookedMatches.length > 0;

              return (
                <div
                  key={v.id}
                  className="flex flex-col justify-between rounded-xl bg-white p-5 border border-slate-200 shadow-xs hover:border-blue-300 hover:shadow-sm transition-all space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100 shrink-0">
                          <MapPin className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-slate-800 leading-snug">{v.name}</h3>
                          <span className="text-[11px] font-bold text-blue-600">{v.city}</span>
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingVenue(v);
                              setIsModalOpen(true);
                            }}
                            title="تعديل المركز"
                            className="p-1.5 text-slate-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setVenueToDelete(v)}
                            title="حذف المركز"
                            className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-slate-600 space-y-1.5 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 font-medium">العنوان:</span>
                        <span className="font-bold text-slate-800 text-left truncate max-w-[220px]">{v.address}</span>
                      </div>
                      {v.capacity && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 font-medium">الطاقة الاستيعابية:</span>
                          <span className="font-bold text-slate-800">{v.capacity.toLocaleString('ar-MA')} متفرج</span>
                        </div>
                      )}
                      {v.notes && (
                        <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 leading-relaxed">
                          {v.notes}
                        </p>
                      )}
                      {v.managerName && (
                        <div className="pt-2 mt-2 border-t border-slate-200/60 space-y-1">
                          <div className="flex items-center gap-1.5 text-blue-800 font-bold text-[11px]">
                            <UserCheck className="h-3.5 w-3.5 text-blue-600" />
                            <span>مسؤول المركز: {v.managerName}</span>
                          </div>
                          {v.managerPhone && (
                            <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-mono pr-4">
                              <Phone className="h-3 w-3 text-slate-400" />
                              <span>{v.managerPhone}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Occupancy Status Badge & Details */}
                    <div className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                      isOccupied
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    }`}>
                      <div className="flex items-center gap-1.5 font-bold">
                        {isOccupied ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-amber-600 animate-pulse" />
                            <span>محجوز ({bookedMatches.length} مباراة مبرمجة)</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4 text-emerald-600" />
                            <span>شاغر ومتاح للبرمجة</span>
                          </>
                        )}
                      </div>
                      <span className="text-[10px] font-medium opacity-80">
                        {isOccupied ? 'يتطلب التنسيق عند اختيار التاريخ' : 'جاهز للاستعمال'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full flex flex-col items-center justify-center p-12 text-slate-500 bg-white rounded-xl border border-slate-200 text-center">
              <MapPin className="h-10 w-10 text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-700 mb-1">لا توجد مراكز تباري مطابقة</p>
              {canManage && (
                <button
                  onClick={() => {
                    setEditingVenue(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-3 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
                >
                  إضافة مركز تباري جديد الآن
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create / Edit Venue Modal */}
      <CreateVenueModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingVenue(null);
        }}
        onSave={handleSaveVenue}
        initialData={editingVenue}
      />

      {/* Confirm Delete Modal */}
      <ConfirmDeleteModal
        isOpen={!!venueToDelete}
        onClose={() => setVenueToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="حذف مركز التباري"
        message="هل أنت متأكد من رغبتك في حذف هذا المركز من منظومة المباريات؟"
        itemName={venueToDelete?.name}
        isDeleting={isDeleting}
      />
    </div>
  );
};
