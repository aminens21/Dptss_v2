import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Plus, Trash2, Image as ImageIcon, Tag, Calendar, User, Filter, X, Eye, Shield, Award, Sparkles } from 'lucide-react';
import { DocumentationService, DocumentationPhoto, compressImageFileToCode, DataService, SPORTS_MAP } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
import { Sport } from '../types';
import toast from 'react-hot-toast';

export const DocumentationGallery: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const [photos, setPhotos] = useState<DocumentationPhoto[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  // Add / Edit Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [sportId, setSportId] = useState('ALL');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Full view modal state
  const [viewPhoto, setViewPhoto] = useState<DocumentationPhoto | null>(null);

  const canAdd = useMemo(() => {
    if (!userProfile && !currentUser) return false;
    const role = userProfile?.role;
    return (
      role === 'CENTRAL_ADMIN' ||
      role === 'REGIONAL_ADMIN' ||
      role === 'PROVINCIAL_ADMIN' ||
      userProfile?.isTechCommitteeHead ||
      userProfile?.isSportManager ||
      role === 'TEACHER' // allow teachers / committee heads to document activities
    );
  }, [userProfile, currentUser]);

  const loadPhotos = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
      const list = await DocumentationService.getDocumentationPhotos(activeDirId);
      setPhotos(list);
      const sports = await DataService.getSportsConfig();
      setSportsConfig(sports);
    } catch (e) {
      console.error("Error loading documentation gallery:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPhotos();
    const handleUpdate = () => loadPhotos();
    window.addEventListener('taourirt_documentation_updated', handleUpdate);
    return () => {
      window.removeEventListener('taourirt_documentation_updated', handleUpdate);
    };
  }, []);

  const filteredPhotos = useMemo(() => {
    if (selectedSportFilter === 'ALL') return photos;
    return photos.filter(p => p.sportId === 'ALL' || p.sportId === selectedSportFilter);
  }, [photos, selectedSportFilter]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً (الحد الأقصى 10 ميجابايت)');
      return;
    }
    setImageFile(file);
    setIsCompressing(true);
    try {
      const compressedCode = await compressImageFileToCode(file, 900, 0.65);
      setImagePreview(compressedCode);
    } catch (err) {
      console.error("Error compressing image:", err);
      toast.error('حدث خطأ أثناء ضغط الصورة');
    } finally {
      setIsCompressing(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('يرجى إدخال عنوان الصورة أو النشاط');
      return;
    }
    if (!imagePreview) {
      toast.error('يرجى إرفاق صورة للنشاط الرياضي');
      return;
    }

    setSubmitting(true);
    try {
      const newPhoto: DocumentationPhoto = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: title.trim(),
        sportId,
        imageCode: imagePreview, // stored as compact compressed string code
        description: description.trim(),
        date: new Date().toISOString().split('T')[0],
        authorName: userProfile?.fullName || currentUser?.displayName || 'رئيس اللجنة / المسؤول',
        authorEmail: userProfile?.email || currentUser?.email || '',
        directorateId: DataService.getActiveDirectorateId() || 'taourirt'
      };

      await DocumentationService.saveDocumentationPhoto(newPhoto);
      toast.success('تمت إضافة الصورة بنجاح إلى فضاء التوثيق!');
      setTitle('');
      setSportId('ALL');
      setDescription('');
      setImageFile(null);
      setImagePreview('');
      setIsAddModalOpen(false);
      loadPhotos();
    } catch (err) {
      console.error("Error saving photo:", err);
      toast.error('حدث خطأ أثناء حفظ الصورة');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الصورة من فضاء التوثيق؟')) return;
    try {
      const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
      await DocumentationService.deleteDocumentationPhoto(id, activeDirId);
      toast.success('تم حذف الصورة بنجاح');
      loadPhotos();
    } catch (e) {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-right">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-black">
            <Camera className="h-4 w-4 text-emerald-400" />
            <span>فضاء التوثيق والأرشيف المرئي</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">معرض الصور والأنشطة الرياضية المدرسية</h1>
          <p className="text-sm text-slate-300 max-w-2xl font-medium">
            توثيق مرئي رسمي لأنشطة البطولات والملتقيات الرياضية الإقليمية، مصنفة حسب الأنشطة ومخزنة بأعلى كفاءة لتحسين الأداء وسرعة التصفح.
          </p>
        </div>

        {canAdd && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 shrink-0 cursor-pointer border border-blue-500/40"
          >
            <Plus className="h-5 w-5" />
            <span>إضافة صورة توثيقية جديدة</span>
          </button>
        )}
      </div>

      {/* Sport Activity Filter Tabs */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-3xs flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 ml-2 text-slate-500 text-xs font-bold">
          <Filter className="h-4 w-4 text-blue-600" />
          <span>تصفية حسب النشاط الرياضي:</span>
        </div>
        <button
          onClick={() => setSelectedSportFilter('ALL')}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            selectedSportFilter === 'ALL'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          🌟 جميع الأنشطة العامة
        </button>
        {sportsConfig.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSportFilter(s.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              selectedSportFilter === s.id
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>{s.icon || '🏆'}</span>
            <span>{s.name}</span>
          </button>
        ))}
      </div>

      {/* Gallery Grid */}
      {loading ? (
        <div className="flex justify-center p-16">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
        </div>
      ) : filteredPhotos.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredPhotos.map((photo) => {
            const sportObj = sportsConfig.find(s => s.id === photo.sportId);
            const sportName = photo.sportId === 'ALL' ? 'جميع الأنشطة' : (sportObj?.name || SPORTS_MAP[photo.sportId]?.name || photo.sportId);
            const sportIcon = photo.sportId === 'ALL' ? '🌟' : (sportObj?.icon || SPORTS_MAP[photo.sportId]?.icon || '🏆');

            return (
              <div
                key={photo.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-3xs overflow-hidden hover:shadow-lg hover:border-blue-400 transition-all flex flex-col group"
              >
                <div
                  onClick={() => setViewPhoto(photo)}
                  className="relative aspect-[4/3] bg-slate-900 overflow-hidden cursor-pointer"
                >
                  <img
                    src={photo.imageCode}
                    alt={photo.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                    <span className="text-white text-xs font-bold bg-blue-600/90 px-2.5 py-1 rounded-xl backdrop-blur-xs flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      <span>معاينة مكبرة</span>
                    </span>
                  </div>
                  <div className="absolute top-2.5 right-2.5">
                    <span className="bg-slate-900/80 backdrop-blur-xs text-white border border-white/20 text-[10px] font-bold px-2 py-1 rounded-xl flex items-center gap-1">
                      <span>{sportIcon}</span>
                      <span>{sportName}</span>
                    </span>
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-1 group-hover:text-blue-600 transition-colors">
                      {photo.title}
                    </h3>
                    {photo.description && (
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed font-medium">
                        {photo.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-medium">
                    <div className="flex items-center gap-1.5 truncate">
                      <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      <span className="truncate">{photo.authorName}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{photo.date}</span>
                    </div>
                  </div>

                  {canAdd && (
                    <div className="pt-2 flex justify-end">
                      <button
                        onClick={() => handleDelete(photo.id)}
                        className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
            🖼️
          </div>
          <h3 className="text-base font-black text-slate-800">لا توجد صور توثيقية منشورة بعد في هذا القسم</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            قم بالضغط على زر "إضافة صورة توثيقية جديدة" لتوثيق أنشطة البطولات والملتقيات الرياضية.
          </p>
        </div>
      )}

      {/* Add Photo Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4" dir="rtl">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
                  📷
                </div>
                <div>
                  <h3 className="text-base font-black">إضافة صورة توثيقية جديدة للنشاط الرياضي</h3>
                  <p className="text-xs text-slate-300">يتم ضغط الصورة تلقائياً لتقليل مساحة التخزين</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1">
              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">عنوان الصورة أو النشاط الرياضي *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: انطلاق منافسات العدو الريفي الإقليمي بتاوريرت"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">النشاط الرياضي المستهدف *</label>
                <select
                  value={sportId}
                  onChange={(e) => setSportId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all cursor-pointer"
                >
                  <option value="ALL">🌟 تظهر في جميع الأنشطة العامة</option>
                  {sportsConfig.map(s => (
                    <option key={s.id} value={s.id}>{s.icon || '🏆'} {s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">صورة النشاط الرياضي *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
                {isCompressing && (
                  <p className="text-[11px] text-blue-600 font-bold mt-1">جاري ضغط وتحويل الصورة إلى كود توفير المساحة...</p>
                )}
                {imagePreview && (
                  <div className="mt-3 relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">وصف تفصيلي للنشاط (اختياري)</label>
                <textarea
                  rows={3}
                  placeholder="أدخل تفاصيل موجزة عن الفعالية، المؤسسات المشاركة، أو النتائج..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || isCompressing || !imagePreview}
                  className="px-5 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? 'جاري الحفظ...' : 'نشر وتوثيق الصورة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Size View Modal */}
      {viewPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6" dir="rtl">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-800">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base font-black">{viewPhoto.title}</h3>
                <span className="text-[11px] text-blue-400 font-medium">بواسطة: {viewPhoto.authorName} — {viewPhoto.date}</span>
              </div>
              <button
                onClick={() => setViewPhoto(null)}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-950 flex-1 flex items-center justify-center p-2 overflow-hidden">
              <img
                src={viewPhoto.imageCode}
                alt={viewPhoto.title}
                className="max-h-[70vh] max-w-full object-contain rounded-xl"
              />
            </div>

            {viewPhoto.description && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-700 font-medium">
                {viewPhoto.description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
