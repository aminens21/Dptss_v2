import React, { useState, useEffect, useMemo } from 'react';
import { DataService } from '../lib/dataService';
import { Directorate } from '../types';
import { useAuth, isSuperAdminEmail } from '../contexts/AuthContext';
import {
  Building2,
  KeyRound,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
  Search,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  Eye,
  EyeOff,
  Layers,
  ArrowRight,
  ExternalLink,
  SlidersHorizontal,
  X,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';

const MOROCCAN_REGIONS = [
  'جهة الشرق',
  'جهة طنجة تطوان الحسيمة',
  'جهة فاس مكناس',
  'جهة الرباط سلا القنيطرة',
  'جهة بني ملال خنيفرة',
  'جهة الدار البيضاء سطات',
  'جهة مراكش آسفي',
  'جهة درعة تافيلالت',
  'جهة سوس ماسة',
  'جهة كلميم واد نون',
  'جهة العيون الساقية الحمراء',
  'جهة الداخلة وادي الذهب'
];

export const Directorates: React.FC = () => {
  const { userProfile } = useAuth();
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [activeDirectorateId, setActiveDirectorateId] = useState<string>('taourirt');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [revealedCodes, setRevealedCodes] = useState<Record<string, boolean>>({});

  const toggleRevealCode = (id: string) => {
    setRevealedCodes(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDirectorate, setEditingDirectorate] = useState<Directorate | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formShortName, setFormShortName] = useState('');
  const [formRegion, setFormRegion] = useState('جهة الشرق');
  const [formCode, setFormCode] = useState('');
  const [formAdminEmails, setFormAdminEmails] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [deletingDir, setDeletingDir] = useState<Directorate | null>(null);
  const [pendingActiveDir, setPendingActiveDir] = useState<Directorate | null>(null);

  const loadDirectorates = async () => {
    setLoading(true);
    try {
      const dirs = await DataService.getDirectorates();
      setDirectorates(dirs);
      setActiveDirectorateId(DataService.getActiveDirectorateId());
    } catch (e) {
      console.error("Error loading directorates:", e);
      toast.error('حدث خطأ أثناء تحميل بيانات المديريات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDirectorates();

    const handleDirectorateChanged = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setActiveDirectorateId(customEvent.detail);
      }
    };

    const handleListUpdated = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setDirectorates(customEvent.detail);
      }
    };

    window.addEventListener('directorateChanged', handleDirectorateChanged);
    window.addEventListener('directoratesListUpdated', handleListUpdated);
    return () => {
      window.removeEventListener('directorateChanged', handleDirectorateChanged);
      window.removeEventListener('directoratesListUpdated', handleListUpdated);
    };
  }, []);

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    toast.success(`تم نسخ القن السري (${code}) بنجاح!`);
    setTimeout(() => setCopiedCodeId(null), 2000);
  };

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormCode(result);
  };

  const openCreateModal = () => {
    setEditingDirectorate(null);
    setFormName('');
    setFormShortName('');
    setFormRegion('جهة الشرق');
    setFormCode('');
    setFormAdminEmails('');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormIsActive(true);
    generateRandomCode();
    setIsModalOpen(true);
  };

  const openEditModal = (dir: Directorate) => {
    setEditingDirectorate(dir);
    setFormName(dir.name);
    setFormShortName(dir.shortName || '');
    setFormRegion(dir.region || 'جهة الشرق');
    setFormCode(dir.code || '');
    setFormAdminEmails((dir.adminEmails || []).join(', '));
    setFormPhone(dir.phone || '');
    setFormEmail(dir.email || '');
    setFormAddress(dir.address || '');
    setFormIsActive(dir.isActive !== false);
    setIsModalOpen(true);
  };

  const handleSaveDirectorate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('يرجى إدخال اسم المديرية الإقليمية');
      return;
    }
    if (!formCode.trim()) {
      toast.error('يرجى إدخال القن السري للمديرية');
      return;
    }
    if (!formAdminEmails.trim()) {
      toast.error('يرجى إدخال البريد الإلكتروني للمسير الإقليمي المعتمد');
      return;
    }

    setIsSubmitting(true);

    const emailList = formAdminEmails
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    try {
      if (editingDirectorate) {
        await DataService.updateDirectorate(editingDirectorate.id, {
          name: formName.trim(),
          shortName: formShortName.trim() || formName.trim(),
          region: formRegion.trim(),
          code: formCode.trim().toUpperCase(),
          adminEmails: emailList,
          phone: formPhone.trim(),
          email: formEmail.trim(),
          address: formAddress.trim(),
          isActive: formIsActive
        });
        toast.success(`تم تحديث بيانات ${formName.trim()} والقن السري بنجاح`);
      } else {
        const customId = `dir_${(formShortName || formName).trim().toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
        await DataService.addDirectorate({
          id: customId,
          name: formName.trim(),
          shortName: formShortName.trim() || formName.trim(),
          region: formRegion.trim(),
          code: formCode.trim().toUpperCase(),
          adminEmails: emailList,
          phone: formPhone.trim(),
          email: formEmail.trim(),
          address: formAddress.trim(),
          isActive: formIsActive
        });
        toast.success(`تمت إضافة ${formName.trim()} بنجاح مع تعيين القن السري`);
      }

      await loadDirectorates();
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving directorate:", err);
      toast.error('حدث خطأ أثناء حفظ بيانات المديرية');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectActiveDirectorate = (dir: Directorate) => {
    setPendingActiveDir(dir);
  };

  const handleDeleteDirectorate = async () => {
    if (!deletingDir) return;
    try {
      await DataService.deleteDirectorate(deletingDir.id);
      toast.success(`تم حذف ${deletingDir.name} بنجاح`);
      if (activeDirectorateId === deletingDir.id) {
        DataService.setActiveDirectorateId('taourirt');
        setActiveDirectorateId('taourirt');
      }
      await loadDirectorates();
      setDeletingDir(null);
    } catch (e) {
      console.error("Error deleting directorate:", e);
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const filteredDirectorates = useMemo(() => {
    const list = userProfile?.isSuperAdmin
      ? directorates
      : directorates.filter(dir => dir.id === userProfile?.directorateId);

    return list.filter(dir => {
      const matchesSearch =
        dir.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (dir.shortName && dir.shortName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dir.region && dir.region.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dir.code && dir.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (dir.adminEmails && dir.adminEmails.some(e => e.toLowerCase().includes(searchQuery.toLowerCase())));

      const matchesRegion = selectedRegion === 'ALL' || dir.region === selectedRegion;
      return matchesSearch && matchesRegion;
    });
  }, [directorates, searchQuery, selectedRegion, userProfile]);

  const activeDirectorateObj = directorates.find(d => d.id === activeDirectorateId) || directorates[0];

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Top Banner & Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden border border-slate-800">
        <div className="absolute top-0 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{userProfile?.isSuperAdmin ? 'فضاء المسير المركزي العام (Super Admin)' : 'فضاء المسير الإقليمي المعتمد'}</span>
            </div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
              <Building2 className="w-6 h-6 text-blue-400" />
              <span>{userProfile?.isSuperAdmin ? 'تدبير المديريات الإقليمية والأقنان السرية (PIN)' : 'بيانات ومعلومات المديرية الإقليمية'}</span>
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              {userProfile?.isSuperAdmin 
                ? 'هنا يمكنك إضافة مديريات إقليمية جديدة عبر المملكة، ضبط وتوليد الأقنان السرية (PIN) الخاصة بكل مديرية لمنحها لأساتذة وأطر المديرية للتسجيل والولوج، وتعيين المسيرين الإقليميين.'
                : 'هنا يمكنك الإطلاع على بيانات مديريتك الإقليمية المعتمدة وتحديث المعلومات الأساسية والقن السري الخاص بها لتمكين أطر التربية البدنية من الانتساب للمديرية.'}
            </p>
          </div>

          {userProfile?.isSuperAdmin && (
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={openCreateModal}
                className="flex items-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs sm:text-sm font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مديرية إقليمية جديدة</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-bold">{userProfile?.isSuperAdmin ? 'إجمالي المديريات المسجلة' : 'المديريات المتاحة لك'}</p>
            <p className="text-lg font-black text-slate-800">{userProfile?.isSuperAdmin ? `${directorates.length} مديرية إقليمية` : '1 مديرية معتمدة'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-bold">{userProfile?.isSuperAdmin ? 'المديرية النشطة حالياً' : 'المديرية الإقليمية المنتسبة'}</p>
            <p className="text-sm font-black text-emerald-700 truncate">{activeDirectorateObj?.shortName || activeDirectorateObj?.name || 'تاوريرت'}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-amber-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-bold">{userProfile?.isSuperAdmin ? 'الأقنان السرية (PIN)' : 'حالة القن السري (PIN)'}</p>
            <p className="text-lg font-black text-amber-600">
              {userProfile?.isSuperAdmin 
                ? `${directorates.filter(d => d.code).length} قن سري نشط` 
                : (activeDirectorateObj?.code ? '1 قن سري نشط' : 'لا يوجد قن نشط')}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-purple-200 shadow-xs flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 font-bold">{userProfile?.isSuperAdmin ? 'حسابك المركزي' : 'حسابك الإقليمي'}</p>
            <p className="text-xs font-mono font-black text-purple-700 truncate" dir="ltr">{userProfile?.email || 'aminens21@gmail.com'}</p>
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم، القن السري، الجهة، الإيميل..."
            className="w-full pr-10 pl-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400 font-bold"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs font-bold text-slate-500 shrink-0">تصفية حسب الجهة:</label>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">جميع جهات المملكة</option>
            {MOROCCAN_REGIONS.map(reg => (
              <option key={reg} value={reg}>{reg}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Directorates Grid */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-500">جاري تحميل بيانات المديريات الإقليمية والأقنان السرية...</p>
        </div>
      ) : filteredDirectorates.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 space-y-3">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-sm font-bold text-slate-700">لم يتم العثور على أي مديرية تطابق البحث</p>
          <button
            type="button"
            onClick={openCreateModal}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مديرية جديدة الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredDirectorates.map((dir) => {
            const isActive = dir.id === activeDirectorateId;
            const isCopied = copiedCodeId === dir.id;

            return (
              <div
                key={dir.id}
                className={`bg-white rounded-3xl border transition-all duration-200 p-5 flex flex-col justify-between relative overflow-hidden shadow-xs hover:shadow-md ${
                  isActive
                    ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/20'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Active Badge */}
                {isActive && (
                  <div className="absolute top-0 left-0 bg-emerald-600 text-white text-[10px] font-black px-3 py-1 rounded-br-2xl flex items-center gap-1 shadow-sm">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>المديرية المحددة للعمل حالياً</span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Directorate Header */}
                  <div className="flex items-start gap-3 pt-1">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isActive ? 'bg-emerald-100 border-emerald-300 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-700'
                    }`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-black text-slate-900 leading-tight">
                        {dir.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        <span>{dir.region || 'جهة الشرق'}</span>
                      </p>
                    </div>
                  </div>

                  {/* PIN CODE BOX - THE KEY FEATURE */}
                  <div className="p-3.5 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200/90 rounded-2xl space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-black text-amber-900">
                      <span className="flex items-center gap-1">
                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                        القن السري للمديرية (PIN):
                      </span>
                      <span className="text-[10px] text-amber-700 font-normal">يُمنح للأطر للتسجيل</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 bg-white px-3 py-2 rounded-xl border border-amber-300 shadow-2xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleRevealCode(dir.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center justify-center shrink-0"
                          title={revealedCodes[dir.id] ? "إخفاء القن السري" : "إظهار القن السري"}
                        >
                          {revealedCodes[dir.id] ? (
                            <EyeOff className="w-4 h-4 text-slate-500" />
                          ) : (
                            <Eye className="w-4 h-4 text-slate-500" />
                          )}
                        </button>
                        <span className="text-base font-mono font-black text-slate-900 tracking-wider">
                          {dir.code ? (revealedCodes[dir.id] ? dir.code : '••••••') : 'بدون قن'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyCode(dir.id, dir.code || '')}
                        className="p-1.5 text-amber-700 hover:text-amber-900 hover:bg-amber-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold"
                        title="نسخ القن السري"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span className="text-emerald-700">تم النسخ!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>نسخ</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Admin Emails info */}
                  <div className="space-y-1.5 text-xs">
                    <p className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      <span>المسيرون الإقليميون المعتمدون:</span>
                    </p>
                    {(dir.adminEmails && dir.adminEmails.length > 0) ? (
                      <div className="flex flex-wrap gap-1">
                        {dir.adminEmails.map((email, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-[10px] font-mono font-bold truncate max-w-[200px]"
                            dir="ltr"
                          >
                            {email}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic">يتم تدبيرها من طرف المشرف العام المركزي</p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  {userProfile?.isSuperAdmin ? (
                    !isActive ? (
                      <button
                        type="button"
                        onClick={() => handleSelectActiveDirectorate(dir)}
                        className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>تفعيل والعمل على هذه المديرية</span>
                      </button>
                    ) : (
                      <div className="flex-1 py-2 px-3 bg-emerald-100/70 text-emerald-800 rounded-xl text-xs font-black text-center">
                        ✓ المديرية النشطة
                      </div>
                    )
                  ) : (
                    <div className="flex-1 py-2 px-3 bg-emerald-100/70 text-emerald-800 rounded-xl text-xs font-black text-center">
                      ✓ مديريتك المعتمدة
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(dir)}
                      className="p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                      title="تعديل بيانات المديرية والقن السري"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {userProfile?.isSuperAdmin && dir.id !== 'taourirt' && (
                      <button
                        type="button"
                        onClick={() => setDeletingDir(dir)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                        title="حذف المديرية"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ADD / EDIT DIRECTORATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in duration-150 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <h3 className="text-sm font-black">
                    {editingDirectorate ? 'تعديل بيانات المديرية والقن السري' : 'إضافة مديرية إقليمية جديدة'}
                  </h3>
                  <p className="text-[11px] text-blue-200 font-medium">منظومة بطولات وأنشطة الرياضة المدرسية</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveDirectorate} className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              
              {/* Directorate Full Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  اسم المديرية الإقليمية الكامل *
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: المديرية الإقليمية بالناظور"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Short Name */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    الاسم المختصر *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: الناظور"
                    value={formShortName}
                    onChange={(e) => setFormShortName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                {/* Region */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    الجهة التابعة لها *
                  </label>
                  <select
                    value={formRegion}
                    onChange={(e) => setFormRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white cursor-pointer"
                  >
                    {MOROCCAN_REGIONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* PIN Code Setup - Highlighted */}
              <div className="p-4 bg-amber-50/80 border-2 border-amber-300 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-black text-amber-950 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-amber-700" />
                    <span>القن السري للمديرية (PIN Code) *</span>
                  </label>
                  <button
                    type="button"
                    onClick={generateRandomCode}
                    className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg text-[10px] font-black transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>توليد قن عشوائي 🎲</span>
                  </button>
                </div>

                <input
                  type="text"
                  required
                  placeholder="مثال: NAD2026 أو 458921"
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3.5 py-2.5 bg-white border-2 border-amber-400 rounded-xl font-mono font-black text-center text-sm tracking-widest text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />

                <p className="text-[10px] text-amber-800 leading-relaxed font-medium">
                  * يُقدم هذا القن لأساتذة وأطر التربية البدنية لربط حساباتهم بهذه المديرية الإقليمية حصراً عند التسجيل.
                </p>
              </div>

              {/* Admin Emails */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>البريد الإلكتروني للمسير الإقليمي المعتمد * (إجباري):</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: admin.nador@gmail.com"
                  value={formAdminEmails}
                  onChange={(e) => setFormAdminEmails(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono text-[11px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  dir="ltr"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  * يجب إدخال عنوان البريد الإلكتروني للمسير الإقليمي بدقة. سيعتمد هذا البريد حصرياً للدخول وتسيير حسابات هذه المديرية فقط.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Phone */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الهاتف الإداري</label>
                  <input
                    type="tel"
                    placeholder="0536xxxxxx"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">البريد الإداري للمديرية</label>
                  <input
                    type="email"
                    placeholder="dp.province@men.gov.ma"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان مقر المديرية</label>
                <input
                  type="text"
                  placeholder="شارع..."
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white font-medium"
                />
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-colors shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'جاري الحفظ...' : (editingDirectorate ? 'تحديث البيانات والقن' : 'إضافة المديرية وتثبيت القن')}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingDir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">تأكيد حذف المديرية الإقليمية</h3>
              <p className="text-xs text-slate-600">
                هل أنت متأكد من رغبتك في حذف <strong>{deletingDir.name}</strong>؟
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingDir(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDeleteDirectorate}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer shadow-md shadow-red-600/20"
              >
                تأكيد الحذف
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SELECT ACTIVE DIRECTORATE CONFIRMATION MODAL */}
      {pendingActiveDir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in zoom-in duration-150" dir="rtl">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-black text-slate-900">تأكيد تغيير المديرية النشطة</h3>
              <p className="text-xs text-slate-600">
                هل أنت متأكد من رغبتك في تبديل وتفعيل العمل على:
              </p>
              <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-right">
                <div>
                  <p className="font-black text-slate-900 text-xs">{pendingActiveDir.name}</p>
                  <p className="text-[10px] text-slate-500 font-medium">{pendingActiveDir.region || 'جهة الشرق'}</p>
                </div>
                <div className="flex items-center gap-1 bg-amber-100 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold">
                  <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                  <span>{pendingActiveDir.code}</span>
                </div>
              </div>
              <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2.5 rounded-lg border border-rose-100 text-right">
                ⚠️ تنبيه: سيتم تبديل فضاء العمل وعرض وتصفية كافة اللوائح والبطولات والمباريات المدرسية الخاصة بهذه المديرية المحددة فقط.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPendingActiveDir(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200"
              >
                إلغاء التغيير
              </button>
              <button
                type="button"
                onClick={() => {
                  DataService.setActiveDirectorateId(pendingActiveDir.id);
                  setActiveDirectorateId(pendingActiveDir.id);
                  setPendingActiveDir(null);
                  toast.success(`تم تبديل فضاء العمل بنجاح إلى: ${pendingActiveDir.name}`);
                  // Dispatch custom event to notify AppLayout or other components
                  window.dispatchEvent(new CustomEvent('directorateChanged', { detail: pendingActiveDir.id }));
                }}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-colors cursor-pointer shadow-md shadow-blue-600/20"
              >
                تأكيد التبديل ✅
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
