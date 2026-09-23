import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason } from '../lib/dataService';
import { Sport, Tournament, RoleKey, RoleSidebarPermissions, CustomAgeCategory } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Settings,
  Save,
  Check,
  AlertCircle,
  RefreshCw,
  Trophy,
  Plus,
  X,
  Calendar,
  Trash2,
  PlusCircle,
  Sparkles,
  ShieldAlert,
  ArrowRight,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  SlidersHorizontal,
  Layers,
  Users,
  Building2,
  KeyRound,
  Upload,
  Image,
  Edit2,
  Edit3
} from 'lucide-react';
import toast from 'react-hot-toast';

const PRESET_EMOJIS = ['🏸', '🥋', '🏹', '🏊‍♂️', '🤸‍♀️', '🥊', '🧗', '🤼', '🏓', '🎾', '🏐', '🏀', '⚽', '🎯', '🚴‍♂️', '♟️', '🏃', '🏆'];

const CustomCategoryForm: React.FC<{ onAdd: (name: string) => void }> = ({ onAdd }) => {
  const [value, setValue] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onAdd(value.trim());
      setValue('');
      setIsEditing(false);
    }
  };

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 transition-all shadow-3xs cursor-pointer"
      >
        <Plus className="h-3.5 w-3.5" />
        <span>إضافة فئة يدوياً</span>
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-1.5 max-w-xs">
      <input
        type="text"
        required
        autoFocus
        placeholder="مثال: البراعم U11"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="px-2.5 py-1.5 text-xs bg-white border border-blue-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 placeholder-slate-400"
      />
      <button
        type="submit"
        className="p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
        title="إضافة"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setIsEditing(false)}
        className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl text-xs font-bold cursor-pointer transition-colors"
        title="إلغاء"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </form>
  );
};

const SportAgeCategoriesManager: React.FC<{
  sportId: string;
  customCategories: CustomAgeCategory[];
  onChange: (updated: CustomAgeCategory[]) => void;
}> = ({ sportId, customCategories, onChange }) => {
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');
  const [yearsInput, setYearsInput] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  
  // Year Picker state
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [isAndAfter, setIsAndAfter] = useState(false);

  // Generate lists of birth years (from 2005 to 2021)
  const availableYears = Array.from({ length: 17 }, (_, i) => 2005 + i);

  const handleOpenYearPicker = (currentExpr: string) => {
    // Try to pre-fill from current expression
    const isPost = currentExpr.includes('بعد') || currentExpr.includes('>') || currentExpr.includes('+');
    const matched = Array.from(currentExpr.matchAll(/(\d{4})/g)).map(m => parseInt(m[1], 10));
    setSelectedYears(matched);
    setIsAndAfter(isPost);
    setIsYearPickerOpen(true);
  };

  const handleApplyYearPicker = () => {
    if (selectedYears.length === 0) {
      toast.error('يرجى اختيار سنة واحدة على الأقل');
      return;
    }
    let expr = '';
    const sorted = [...selectedYears].sort((a, b) => a - b);
    if (isAndAfter) {
      expr = `${sorted[0]} وما بعد`;
    } else {
      expr = sorted.join('/');
    }
    setYearsInput(expr);
    setIsYearPickerOpen(false);
  };

  const handleStartAdd = () => {
    setNameInput('');
    setYearsInput('');
    setEditingCatId(null);
    setIsAdding(true);
  };

  const handleStartEdit = (cat: CustomAgeCategory) => {
    setEditingCatId(cat.id);
    setNameInput(cat.name);
    setYearsInput(cat.yearsExpression);
    setIsAdding(false);
  };

  const handleSave = () => {
    if (!nameInput.trim()) {
      toast.error('اسم الفئة إجباري');
      return;
    }
    if (!yearsInput.trim()) {
      toast.error('سنوات المشاركة المسموح بها إجبارية');
      return;
    }

    if (isAdding) {
      const newCat: CustomAgeCategory = {
        id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: nameInput.trim(),
        yearsExpression: yearsInput.trim()
      };
      onChange([...customCategories, newCat]);
      toast.success(`تمت إضافة الفئة "${newCat.name}"`);
      setIsAdding(false);
    } else if (editingCatId) {
      const updated = customCategories.map(cat => {
        if (cat.id === editingCatId) {
          return {
            ...cat,
            name: nameInput.trim(),
            yearsExpression: yearsInput.trim()
          };
        }
        return cat;
      });
      onChange(updated);
      toast.success(`تم تعديل الفئة بنجاح`);
      setEditingCatId(null);
    }
  };

  const handleDelete = (id: string) => {
    const updated = customCategories.filter(cat => cat.id !== id);
    onChange(updated);
    toast.success('تم حذف الفئة');
  };

  return (
    <div className="space-y-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-blue-600" />
          <span>الفئات العمرية المخصصة ديناميكياً:</span>
        </span>
        {!isAdding && !editingCatId && (
          <button
            type="button"
            onClick={handleStartAdd}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>إضافة فئة جديدة ➕</span>
          </button>
        )}
      </div>

      {/* Categories List */}
      {customCategories.length === 0 && !isAdding && !editingCatId ? (
        <div className="text-center py-5">
          <p className="text-xs text-slate-400 font-medium mb-2">لا توجد فئات مخصصة مضافة حالياً لهذا التخصص.</p>
          <button
            type="button"
            onClick={() => {
              // Prepopulate with defaults
              const defaultCats = [
                { id: 'U12', name: 'البراعم والبرعمات', yearsExpression: '2015 وما بعد' },
                { id: 'U15', name: 'الصغار والصغيرات', yearsExpression: '2012/2013/2014' },
                { id: 'U18', name: 'الفتيان والفتيات', yearsExpression: '2009/2010/2011' },
                { id: 'U20', name: 'الشبان والشابات', yearsExpression: '2009 وما بعد' }
              ];
              onChange(defaultCats);
              toast.success('تم توليد الفئات الافتراضية بنجاح للتعديل عليها');
            }}
            className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer bg-blue-50/50 hover:bg-blue-50 px-3 py-1.5 rounded-xl border border-blue-100"
          >
            ⚡ توليد الفئات الافتراضية للتخصيص
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {customCategories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200/60 shadow-3xs">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-800">{cat.name}</p>
                <p className="text-[10px] text-slate-500 font-bold bg-slate-50 px-2 py-0.5 rounded-md inline-block">
                  مواليد {cat.yearsExpression}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleStartEdit(cat)}
                  className="p-1 hover:bg-slate-100 rounded-lg text-blue-600 cursor-pointer"
                  title="تعديل"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(cat.id)}
                  className="p-1 hover:bg-red-50 rounded-lg text-red-500 cursor-pointer"
                  title="حذف"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Form */}
      {(isAdding || editingCatId) && (
        <div className="p-3.5 bg-white rounded-2xl border border-blue-200/80 space-y-3 shadow-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <h4 className="text-xs font-black text-blue-900">
            {isAdding ? '✨ إضافة فئة عمرية مخصصة جديدة' : '⚙️ تعديل الفئة العمرية المخصصة'}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black text-slate-700 mb-1">اسم الفئة (مثال: البراعم والبرعمات)</label>
              <input
                type="text"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="البراعم والبرعمات"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-700 mb-1">سنوات الازدياد المسموح بها</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={yearsInput}
                  onChange={e => setYearsInput(e.target.value)}
                  placeholder="2015 وما بعد أو 2012/2013/2014"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                />
                <button
                  type="button"
                  onClick={() => handleOpenYearPicker(yearsInput)}
                  className="px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold cursor-pointer transition-colors"
                  title="اختيار من نافذة مخصصة"
                >
                  🗓️ اختر من القائمة
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setEditingCatId(null);
              }}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            >
              حفظ الفئة
            </button>
          </div>
        </div>
      )}

      {/* Beautiful Year Picker Dialog */}
      {isYearPickerOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150" dir="rtl">
            <div className="p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                🗓️ نافذة اختيار سنوات الازدياد
              </span>
              <button
                type="button"
                onClick={() => setIsYearPickerOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-[11px] text-slate-500 font-semibold">اضغط على سنوات الازدياد المطلوبة لتحديدها للبطولة:</p>
              <div className="grid grid-cols-4 gap-1.5">
                {availableYears.map(year => {
                  const isChecked = selectedYears.includes(year);
                  return (
                    <button
                      key={year}
                      type="button"
                      onClick={() => {
                        if (isChecked) {
                          setSelectedYears(prev => prev.filter(y => y !== year));
                        } else {
                          setSelectedYears(prev => [...prev, year]);
                        }
                      }}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer text-center ${
                        isChecked
                          ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>

              <label className="flex items-center gap-2 px-3 py-2.5 bg-blue-50/50 border border-blue-100 rounded-xl text-xs font-bold text-blue-955 cursor-pointer hover:bg-blue-50 transition-colors">
                <input
                  type="checkbox"
                  checked={isAndAfter}
                  onChange={e => setIsAndAfter(e.target.checked)}
                  className="rounded border-blue-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer accent-blue-600"
                />
                <span>وما بعد (للأعمار الأصغر فما فوق) ➕</span>
              </label>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsYearPickerOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleApplyYearPicker}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                >
                  تثبيت واختيار ✔️
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const SportsConfig: React.FC = () => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [sportsList, setSportsList] = useState<Sport[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editingInfoId, setEditingInfoId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [currentSeason, setCurrentSeason] = useState('2026/2027');
  const [savingSeason, setSavingSeason] = useState(false);
  const [seasonsList, setSeasonsList] = useState<string[]>(['2025/2026', '2026/2027']);
  const [newSeasonInput, setNewSeasonInput] = useState('');
  const [isAddingSeason, setIsAddingSeason] = useState(false);
  const [savingNewSeason, setSavingNewSeason] = useState(false);

  // Active Tab
  const [activeConfigTab, setActiveConfigTab] = useState<'sports' | 'permissions' | 'logos'>('sports');

  // Official Logos State
  const [ministryLogo, setMinistryLogo] = useState<string>('');
  const [frmssLogo, setFrmssLogo] = useState<string>('');
  const [ministryLogoHeight, setMinistryLogoHeight] = useState<number>(80);
  const [frmssLogoHeight, setFrmssLogoHeight] = useState<number>(60);
  const [savingLogos, setSavingLogos] = useState(false);

  // Role Permissions State
  const [rolePermissions, setRolePermissions] = useState<RoleSidebarPermissions>({
    CENTRAL_ADMIN: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions'],
    TECH_COMMITTEE_HEAD: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config'],
    SPORT_MANAGER: ['/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics'],
    TEACHER: ['/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics'],
    REFEREE: ['/dashboard', '/matches', '/statistics']
  });
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PROGRAMMED' | 'UNPROGRAMMED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // New Sport Modal State (Exclusive to CENTRAL_ADMIN)
  const [isAddSportModalOpen, setIsAddSportModalOpen] = useState(false);
  const [newSportName, setNewSportName] = useState('');
  const [newSportId, setNewSportId] = useState('');
  const [newSportIcon, setNewSportIcon] = useState('🏸');
  const [newSportDescription, setNewSportDescription] = useState('');
  const [newSportCategories, setNewSportCategories] = useState<string[]>([]);
  const [newSportCustomCategories, setNewSportCustomCategories] = useState<CustomAgeCategory[]>([]);
  const [newSportStudentLimit, setNewSportStudentLimit] = useState<string>('');
  const [newSportIsProgrammed, setNewSportIsProgrammed] = useState<boolean>(true);
  const [isSubmittingSport, setIsSubmittingSport] = useState(false);

  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';
  const isTechCommitteeHead = userProfile?.isTechCommitteeHead === true;
  const mySports = userProfile?.techCommitteeSports || [];

  const visibleSportsList = useMemo(() => {
    return sportsList.filter(s => {
      if (isCentralAdmin) return true;
      if (isTechCommitteeHead) {
        return mySports.includes(s.id);
      }
      return false;
    });
  }, [sportsList, isCentralAdmin, isTechCommitteeHead, mySports]);

  // Helper function to resolve programmed status
  const isSportProgrammed = (s: Sport): boolean => {
    if (tournaments.some(t => t.sportId === s.id)) return true;
    if (s.isProgrammed !== undefined) return s.isProgrammed;
    return (s.ageCategories && s.ageCategories.length > 0 && s.studentLimit !== undefined && s.studentLimit > 0) || false;
  };

  // Filtered sports list by search and status
  const filteredSports = useMemo(() => {
    return visibleSportsList.filter(s => {
      const isProg = isSportProgrammed(s);
      if (statusFilter === 'PROGRAMMED' && !isProg) return false;
      if (statusFilter === 'UNPROGRAMMED' && isProg) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = s.name.toLowerCase().includes(q);
        const matchId = s.id.toLowerCase().includes(q);
        return matchName || matchId;
      }
      return true;
    });
  }, [visibleSportsList, statusFilter, searchQuery]);

  // Counters
  const programmedCount = useMemo(() => {
    return visibleSportsList.filter(s => isSportProgrammed(s)).length;
  }, [visibleSportsList]);

  const unprogrammedCount = useMemo(() => {
    return visibleSportsList.filter(s => !isSportProgrammed(s)).length;
  }, [visibleSportsList]);

  useEffect(() => {
    loadSportsAndSeason();
    const handleDirChange = () => {
      loadSportsAndSeason();
    };
    window.addEventListener('directorateChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
    };
  }, []);

  // Initialize categories for new sport modal when season loads
  useEffect(() => {
    if (currentSeason && newSportCategories.length === 0) {
      const defaultCats = [
        { id: 'U12', name: 'البراعم والبرعمات', yearsExpression: '2015 وما بعد' },
        { id: 'U15', name: 'الصغار والصغيرات', yearsExpression: '2012/2013/2014' },
        { id: 'U18', name: 'الفتيان والفتيات', yearsExpression: '2009/2010/2011' },
        { id: 'U20', name: 'الشبان والشابات', yearsExpression: '2009 وما بعد' }
      ];
      setNewSportCustomCategories(defaultCats);
      setNewSportCategories(defaultCats.map(c => c.id));
    }
  }, [currentSeason]);

  const loadSportsAndSeason = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [config, season, seasons, tourns, perms, logos] = await Promise.all([
        DataService.getSportsConfig(),
        DataService.getActiveSeason(),
        DataService.getSeasons(),
        DataService.getTournaments(),
        DataService.getRoleSidebarPermissions(),
        DataService.getOfficialLogos()
      ]);
      setSportsList(config);
      setCurrentSeason(season);
      setSeasonsList(seasons);
      
      const dirTourns = tourns.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      setTournaments(dirTourns);
      if (perms) setRolePermissions(perms);
      if (logos) {
        if (logos.ministryLogo) setMinistryLogo(logos.ministryLogo);
        if (logos.frmssLogo) setFrmssLogo(logos.frmssLogo);
        if (logos.ministryLogoHeight) setMinistryLogoHeight(logos.ministryLogoHeight);
        if (logos.frmssLogoHeight) setFrmssLogoHeight(logos.frmssLogoHeight);
      }
    } catch (error) {
      console.error('Error loading sports config and season:', error);
      toast.error('حدث خطأ أثناء تحميل إعدادات الفئات والموسم الرياضي');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, setLogoState: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 2 ميغابايت');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setLogoState(result);
        toast.success('تم تحميل الصورة بنجاح');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveOfficialLogos = async () => {
    setSavingLogos(true);
    try {
      await DataService.saveOfficialLogos({
        ministryLogo,
        frmssLogo,
        ministryLogoHeight,
        frmssLogoHeight
      });
      toast.success('تم حفظ الشعارات الرسمية والمقاييس المحددة بنجاح! سيتم تطبيقها في ترويسة لائحة المشاركة');
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ الشعارات');
    } finally {
      setSavingLogos(false);
    }
  };

  const handleTogglePermission = (roleKey: RoleKey, href: string) => {
    setRolePermissions(prev => {
      const currentList = prev[roleKey] || [];
      const updated = currentList.includes(href)
        ? currentList.filter(h => h !== href)
        : [...currentList, href];
      return {
        ...prev,
        [roleKey]: updated
      };
    });
  };

  const handleSaveRolePermissions = async () => {
    setSavingPermissions(true);
    try {
      await DataService.saveRoleSidebarPermissions(rolePermissions);
      toast.success('تم حفظ صلاحيات وأزرار القائمة الجانبية بنجاح لجميع الصفات!');
    } catch (error) {
      console.error('Error saving role permissions:', error);
      toast.error('حدث خطأ أثناء حفظ الصلاحيات');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleResetRolePermissions = () => {
    const DEFAULT_PERMISSIONS: RoleSidebarPermissions = {
      CENTRAL_ADMIN: ['/dashboard', '/tournaments', '/schools', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/statistics', '/sports-config', '/permissions'],
      TECH_COMMITTEE_HEAD: ['/dashboard', '/tournaments', '/schools', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/statistics', '/sports-config'],
      SPORT_MANAGER: ['/dashboard', '/tournaments', '/schools', '/teachers', '/referees', '/matches', '/helper-apps', '/statistics'],
      TEACHER: ['/dashboard', '/tournaments', '/schools', '/matches', '/statistics'],
      REFEREE: ['/dashboard', '/matches', '/statistics']
    };
    setRolePermissions(DEFAULT_PERMISSIONS);
    toast.success('تمت إعادة ضبط الصلاحيات إلى القيم الافتراضية. لا تنس الضغط على حفظ.');
  };

  const handleSeasonChange = async (newSeason: string) => {
    setSavingSeason(true);
    try {
      await DataService.setActiveSeason(newSeason);
      setCurrentSeason(newSeason);
      
      // Dispatch custom event to notify AppLayout to update immediately
      window.dispatchEvent(new CustomEvent('seasonChanged', { detail: newSeason }));
      
      toast.success(`تم تغيير الموسم الرياضي النشط بنجاح إلى: ${newSeason}`);
    } catch (error) {
      console.error('Error changing sports season:', error);
      toast.error('تعذر حفظ الموسم الرياضي الجديد');
    } finally {
      setSavingSeason(false);
    }
  };

  const handleAddSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSeason = newSeasonInput.trim();
    
    const pattern = /^\d{4}[\/\-]\d{4}$/;
    if (!pattern.test(cleanSeason)) {
      toast.error('يرجى إدخال الموسم بالصيغة الصحيحة، مثال: 2027/2028');
      return;
    }

    if (seasonsList.includes(cleanSeason)) {
      toast.error('هذا الموسم مضاف بالفعل في النظام');
      return;
    }

    setSavingNewSeason(true);
    try {
      await DataService.addSeason(cleanSeason);
      toast.success(`تمت إضافة الموسم الجديد "${cleanSeason}" بنجاح`);
      setNewSeasonInput('');
      setIsAddingSeason(false);
      const updatedSeasons = await DataService.getSeasons();
      setSeasonsList(updatedSeasons);
      
      // Auto-switch to the new season
      await handleSeasonChange(cleanSeason);
    } catch (error) {
      console.error('Error adding new season:', error);
      toast.error('حدث خطأ أثناء إضافة الموسم الرياضي الجديد');
    } finally {
      setSavingNewSeason(false);
    }
  };

  const handleToggleCategory = (sportId: string, categoryId: string) => {
    setSportsList(prev => prev.map(s => {
      if (s.id !== sportId) return s;
      const currentCats = s.ageCategories || [];
      const updatedCats = currentCats.includes(categoryId)
        ? currentCats.filter(id => id !== categoryId)
        : [...currentCats, categoryId];
      return { ...s, ageCategories: updatedCats };
    }));
  };

  const handleSelectAllCategories = (sportId: string) => {
    setSportsList(prev => prev.map(s => {
      if (s.id !== sportId) return s;
      const allCategoryIds = getAgeCategoriesForSeason(currentSeason, undefined, sportId).map(c => c.id);
      return { ...s, ageCategories: allCategoryIds };
    }));
  };

  const handleClearAllCategories = (sportId: string) => {
    setSportsList(prev => prev.map(s => {
      if (s.id !== sportId) return s;
      return { ...s, ageCategories: [] };
    }));
  };

  // Status Mode Toggle (مبرمجة vs في طور الإعداد)
  const handleToggleSportProgrammedStatus = (sportId: string, targetStatus: boolean) => {
    setSportsList(prev => prev.map(s => {
      if (s.id !== sportId) return s;
      return { ...s, isProgrammed: targetStatus };
    }));
  };

  const handleSaveSportConfig = async (
    sportId: string,
    ageCategories: string[],
    studentLimit?: number,
    athleticsSpecialties?: string[],
    isProgrammed?: boolean,
    name?: string,
    icon?: string,
    customAgeCategories?: CustomAgeCategory[]
  ) => {
    setSavingId(sportId);
    try {
      await DataService.updateSportCategories(
        sportId,
        ageCategories,
        studentLimit,
        athleticsSpecialties,
        name,
        icon,
        isProgrammed,
        customAgeCategories
      );
      setEditingInfoId(null);
      toast.success('تم حفظ وتعديل إعدادات وضوابط التخصص الرياضي بنجاح');
    } catch (error) {
      console.error('Error updating sport categories:', error);
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSavingId(null);
    }
  };

  // Central Admin: Delete custom sport
  const handleDeleteSport = async (sportId: string, sportName: string) => {
    if (!isCentralAdmin) return;
    if (!window.confirm(`هل أنت متأكد من حذف التخصص الرياضي "${sportName}" نهائياً من المنظومة؟`)) {
      return;
    }

    setDeletingId(sportId);
    try {
      await DataService.deleteSport(sportId);
      setSportsList(prev => prev.filter(s => s.id !== sportId));
      toast.success(`تم حذف التخصص الرياضي "${sportName}" بنجاح`);
    } catch (error) {
      console.error('Error deleting sport:', error);
      toast.error('حدث خطأ أثناء محاولة حذف الرياضة');
    } finally {
      setDeletingId(null);
    }
  };

  // Central Admin: Create new sport submission
  const handleCreateNewSport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isCentralAdmin) {
      toast.error('عفواً، إضافة التخصصات الرياضية صلاحية حصرية للمسير المركزي فقط.');
      return;
    }

    const cleanName = newSportName.trim();
    if (!cleanName) {
      toast.error('يرجى إدخال اسم الرياضة');
      return;
    }

    if (newSportCustomCategories.length === 0) {
      toast.error('يرجى إضافة فئة عمرية واحدة على الأقل للمشاركة');
      return;
    }

    const limitVal = newSportStudentLimit.trim() === '' ? undefined : parseInt(newSportStudentLimit, 10);
    if (limitVal !== undefined && (isNaN(limitVal) || limitVal < 0)) {
      toast.error('يرجى إدخال عدد صحيح موجب لسقف عدد المشاركين');
      return;
    }

    const catIds = newSportCustomCategories.map(c => c.id);

    setIsSubmittingSport(true);
    try {
      const addedSport = await DataService.addSport({
        name: cleanName,
        id: newSportId.trim() || undefined,
        icon: newSportIcon.trim() || '🏆',
        description: newSportDescription.trim() || undefined,
        ageCategories: catIds,
        studentLimit: limitVal,
        customAgeCategories: newSportCustomCategories
      });

      // Update programmed status
      await DataService.updateSportCategories(
        addedSport.id,
        catIds,
        limitVal,
        [],
        undefined,
        undefined,
        newSportIsProgrammed,
        newSportCustomCategories
      );

      toast.success(`تمت إضافة الرياضة الجديدة "${cleanName}" بنجاح وتحديد حالتها وسقف مشاركيها.`);
      
      // Reset form
      setNewSportName('');
      setNewSportId('');
      setNewSportIcon('🏸');
      setNewSportDescription('');
      setNewSportStudentLimit('');
      setNewSportIsProgrammed(true);
      setIsAddSportModalOpen(false);

      // Reload sports list
      await loadSportsAndSeason();
    } catch (error) {
      console.error('Error creating new sport:', error);
      toast.error('حدث خطأ أثناء إضافة النوع الرياضي الجديد');
    } finally {
      setIsSubmittingSport(false);
    }
  };

  // Guard: if user is neither central admin nor tech committee head
  if (!loading && !isCentralAdmin && !isTechCommitteeHead) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-3xl border border-red-200 shadow-sm text-center space-y-4" dir="rtl">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">صلاحية الدخول غير متوفرة</h2>
        <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
          صفحة الإعدادات والضوابط مخصصة حصرياً للمسير المركزي ورؤساء اللجن التقنية الإقليمية لضبط الفئات، وسقف المشاركة، ووضع الرياضات (مبرمجة أو في طور الإعداد).
        </p>
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <span>العودة إلى لوحة التحكم</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-blue-600" />
              <span>الإعدادات والضوابط: إدارة وضعية البطولات والرياضات</span>
            </h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
              isCentralAdmin 
                ? 'bg-blue-50 text-blue-700 border-blue-100' 
                : 'bg-emerald-50 text-emerald-700 border-emerald-100'
            }`}>
              {isCentralAdmin ? 'المسير المركزي (تحكم شامل)' : 'رئيس اللجنة التقنية (التخصصات المسندة)'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            {isCentralAdmin 
              ? 'تفعيل الرياضات والتحكم في وضعيتها (مبرمجة ومفتوحة للتسجيل أو في طور الإعداد)، وتحديد الفئات العمرية وسقف المشاركين لكل بطولة.'
              : 'مراجعة وتعديل وضعية البطولات وضوابط الفئات العمرية وسقف المشاركين للتخصصات الرياضية الواقعة تحت إشرافك المباشر.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          {/* Add New Sport Button - CENTRAL ADMIN ONLY */}
          {isCentralAdmin && (
            <button
              onClick={() => {
                const defaultCats = getAgeCategoriesForSeason(currentSeason).map(c => c.id);
                setNewSportCategories(defaultCats);
                setIsAddSportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-xs"
            >
              <PlusCircle className="h-4 w-4" />
              <span>إضافة نوع رياضي جديد</span>
            </button>
          )}

          <button
            onClick={loadSportsAndSeason}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer transition-all bg-white disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>تحديث البيانات</span>
          </button>
        </div>
      </div>

      {/* Settings Sub-Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveConfigTab('sports')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeConfigTab === 'sports'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            <span>ضوابط الرياضات والموسم الرياضي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveConfigTab('permissions')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeConfigTab === 'permissions'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>تحديد الأزرار الجانبية المتاحة لكل صفة</span>
            <span className="bg-white/20 text-current px-2 py-0.5 rounded-full text-[10px]">
              4 صفات
            </span>
          </button>

          {isCentralAdmin && (
            <button
              type="button"
              onClick={() => setActiveConfigTab('logos')}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeConfigTab === 'logos'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Upload className="h-4 w-4" />
              <span>تحميل الشعارات الرسمية (الوزارة والجامعة) 🖼️</span>
            </button>
          )}
        </div>

        {isCentralAdmin && (
          <button
            type="button"
            onClick={() => navigate('/directorates')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-xs"
          >
            <Building2 className="h-4 w-4 text-emerald-200" />
            <span>تدبير المديريات الإقليمية والأقنان السرية (PIN) 🏢</span>
          </button>
        )}
      </div>

      {/* Permissions View */}
      {activeConfigTab === 'permissions' ? (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header Action Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-purple-600" />
                <span>ضبط وتحديد أزرار القائمة الجانبية حسب صفة المستخدم</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                قم بالـتأشير على الأزرار التي ترغب في إظهارها في القائمة الجانبية لكل صفة من الصفات الأربع أدناه: أستاذ(ة)، أستاذ(ة) رئيس(ة) اللجنة التقنية، مسير، ومسير مركزي.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={handleResetRolePermissions}
                className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-3xs cursor-pointer"
              >
                إعادة الضبط
              </button>
              <button
                type="button"
                onClick={handleSaveRolePermissions}
                disabled={savingPermissions}
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{savingPermissions ? 'جاري الحفظ...' : 'حفظ الصلاحيات'}</span>
              </button>
            </div>
          </div>

          {/* Grid of 4 Roles */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                key: 'TEACHER' as RoleKey,
                title: 'أستاذ(ة) التربية البدنية',
                subtitle: 'مؤطر الرياضة المدرسية بالمؤسسة التعليمية',
                badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
                badgeText: 'أستاذ(ة)'
              },
              {
                key: 'TECH_COMMITTEE_HEAD' as RoleKey,
                title: 'أستاذ(ة) رئيس(ة) اللجنة التقنية',
                subtitle: 'المشرف التقني الإقليمي على التخصص الرياضي',
                badgeBg: 'bg-blue-50 border-blue-200 text-blue-800',
                badgeText: 'أستاذ(ة) رئيس(ة) اللجنة التقنية'
              },
              {
                key: 'SPORT_MANAGER' as RoleKey,
                title: 'مسير رياضي',
                subtitle: 'مسؤول تتبع وتنسيق المنافسات الرياضية',
                badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
                badgeText: 'مسير'
              },
              {
                key: 'CENTRAL_ADMIN' as RoleKey,
                title: 'مسير مركزي',
                subtitle: 'المسؤول الإقليمي والمشرف العام على المنظومة',
                badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
                badgeText: 'مسير مركزي'
              }
            ].map(role => {
              const allowedHrefs = rolePermissions[role.key] || [];
              const sidebarItemsList = [
                { href: '/dashboard', label: 'الرئيسية والإشعارات', icon: '🏠', desc: 'لوحة التحكم الرئيسية والتنبيهات العامة' },
                { href: '/schools', label: 'المؤسسات التعليمية', icon: '🏫', desc: 'دليل ورعاة وممثلي المؤسسات التعليمية بمديرية تاوريرت' },
                { href: '/tournaments', label: 'البطولات الرياضية المدرسية', icon: '🏆', desc: 'استعراض وإدارة البطولات الإقليمية والجهوية والوطنية وتفرعاتها وتسجيل الفرق' },
                { href: '/teachers', label: 'الأطر التربوية', icon: '👨‍🏫', desc: 'قائمة أساتذة التربية البدنية ومؤطري الرياضة المدرسية' },
                { href: '/tech-committee', label: 'رؤساء اللجن التقنية', icon: '🛡️', desc: 'إدارة وتعيين مسؤولي اللجان التقنية حسب الرياضات' },
                { href: '/referees', label: 'الحكام', icon: '🏁', desc: 'سجل وتنظيم الحكام المعتمدين وتعيينات المباريات' },
                { href: '/matches', label: 'المباريات والنتائج', icon: '⚽', desc: 'برمجة وتدقيق وتسجيل نتائج المباريات المدرسية' },
                { href: '/helper-apps', label: 'تطبيقات مساعدة', icon: '🛠️', desc: 'مجموعة من التطبيقات المساعدة من بينها ماسح الصدريات لخط النهاية' },
                { href: '/posters-certificates', label: 'الملصقات والشواهد التقديرية', icon: '🎨', desc: 'توليد ملصقات البطولات المبرمجة والشواهد التقديرية للمشاركين' },
                { href: '/statistics', label: 'إحصائيات عامة', icon: '📊', desc: 'مؤشرات الأداء، ونسب المشاركة، والتحليلات البيانية' },
                { href: '/sports-config', label: 'الإعدادات والضوابط', icon: '⚙️', desc: 'ضوابط الرياضات والمواسم وصلاحيات الوصول والقائمة الجانبية' },
              ];

              return (
                <div key={role.key} className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
                  <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${role.badgeBg}`}>
                          {role.badgeText}
                        </span>
                        <h4 className="text-xs font-bold text-slate-800">{role.title}</h4>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{role.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const allHrefs = sidebarItemsList.map(i => i.href);
                          setRolePermissions(prev => ({ ...prev, [role.key]: allHrefs }));
                        }}
                        className="text-[10px] font-bold text-blue-600 hover:underline cursor-pointer"
                      >
                        تحديد الكل
                      </button>
                      <span className="text-slate-300 text-xs">|</span>
                      <button
                        type="button"
                        onClick={() => {
                          setRolePermissions(prev => ({ ...prev, [role.key]: [] }));
                        }}
                        className="text-[10px] font-bold text-slate-500 hover:underline cursor-pointer"
                      >
                        إلغاء الكل
                      </button>
                    </div>
                  </div>

                  <div className="p-3 divide-y divide-slate-100 flex-1 space-y-1">
                    {sidebarItemsList.map(item => {
                      const isChecked = allowedHrefs.includes(item.href);
                      return (
                        <label
                          key={item.href}
                          className={`flex items-start gap-3 p-2.5 rounded-xl transition-all cursor-pointer select-none ${
                            isChecked ? 'bg-purple-50/50 hover:bg-purple-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleTogglePermission(role.key, item.href)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{item.icon}</span>
                              <span className={`text-xs font-bold ${isChecked ? 'text-slate-900' : 'text-slate-400'}`}>
                                {item.label}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-0.5">{item.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeConfigTab === 'logos' ? (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Header Action Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>🖼️ تحميل الشعارات الرسمية لتزيين لوائح المشاركة</span>
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                قم بتحميل شعار وزارة التربية الوطنية وشعار الجامعة الملكية المغربية للرياضة المدرسية لاستخدامهما تلقائياً في ترويسة جميع لوائح المشاركة والمستندات الرسمية (PDF).
              </p>
            </div>

            <button
              type="button"
              onClick={handleSaveOfficialLogos}
              disabled={savingLogos}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Save className="h-4 w-4" />
              <span>{savingLogos ? 'جاري الحفظ...' : 'حفظ الشعارات الرسمية'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ministry Logo Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center text-center space-y-4">
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">1. شعار وزارة التربية الوطنية والتعليم الأولي والرياضة</span>
                <span className="text-[10px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-bold border border-sky-200">يمين الترويسة</span>
              </div>

              <div className="w-48 h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative overflow-hidden">
                {ministryLogo ? (
                  <img 
                    src={ministryLogo} 
                    alt="شعار الوزارة" 
                    className="object-contain p-3 transition-all" 
                    style={{ height: `${ministryLogoHeight}px` }} 
                  />
                ) : (
                  <div className="text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                    <span className="text-4xl">🏛️</span>
                    <span>لم يتم رفع الشعار بعد</span>
                  </div>
                )}
              </div>

              {ministryLogo && (
                <div className="w-full space-y-2 px-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>مقياس الارتفاع (بالبكسل):</span>
                    <span className="text-sky-700 font-mono">{ministryLogoHeight}px</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="180"
                    value={ministryLogoHeight}
                    onChange={(e) => setMinistryLogoHeight(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-sky-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>تصغير (30px)</span>
                    <span>تكبير (180px)</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-3xs flex items-center gap-1.5">
                  <Upload className="h-4 w-4" />
                  <span>{ministryLogo ? 'تغيير شعار الوزارة' : 'رفع شعار الوزارة'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e, setMinistryLogo)}
                  />
                </label>
                {ministryLogo && (
                  <button
                    type="button"
                    onClick={() => setMinistryLogo('')}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>

            {/* FRMSS Logo Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col items-center text-center space-y-4">
              <div className="w-full flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-xs font-bold text-slate-800">2. شعار الجامعة الملكية المغربية للرياضة المدرسية</span>
                <span className="text-[10px] bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-bold border border-purple-200">يسار/وسط الترويسة</span>
              </div>

              <div className="w-48 h-48 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl flex items-center justify-center relative overflow-hidden">
                {frmssLogo ? (
                  <img 
                    src={frmssLogo} 
                    alt="شعار الجامعة الملكية" 
                    className="object-contain p-3 transition-all" 
                    style={{ height: `${frmssLogoHeight}px` }} 
                  />
                ) : (
                  <div className="text-slate-400 text-xs font-bold flex flex-col items-center gap-2">
                    <span className="text-4xl">🏆</span>
                    <span>لم يتم رفع الشعار بعد</span>
                  </div>
                )}
              </div>

              {frmssLogo && (
                <div className="w-full space-y-2 px-4 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>مقياس الارتفاع (بالبكسل):</span>
                    <span className="text-purple-700 font-mono">{frmssLogoHeight}px</span>
                  </div>
                  <input
                    type="range"
                    min="30"
                    max="180"
                    value={frmssLogoHeight}
                    onChange={(e) => setFrmssLogoHeight(Number(e.target.value))}
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-[9px] text-slate-400">
                    <span>تصغير (30px)</span>
                    <span>تكبير (180px)</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer transition-all shadow-3xs flex items-center gap-1.5">
                  <Upload className="h-4 w-4" />
                  <span>{frmssLogo ? 'تغيير شعار الجامعة' : 'رفع شعار الجامعة'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoUpload(e, setFrmssLogo)}
                  />
                </label>
                {frmssLogo && (
                  <button
                    type="button"
                    onClick={() => setFrmssLogo('')}
                    className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    حذف
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overview Statistics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">إجمالي التخصصات</span>
            <span className="text-lg font-black text-slate-800">{visibleSportsList.length}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">بطولات مبرمجة ومفتوحة</span>
            <span className="text-lg font-black text-emerald-700">{programmedCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">في طور الإعداد</span>
            <span className="text-lg font-black text-amber-700">{unprogrammedCount}</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200/80 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-slate-400 block">الموسم الرياضي</span>
            <span className="text-sm font-black text-purple-800">{currentSeason}</span>
          </div>
        </div>
      </div>

      {/* Current Sports Season Setup Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-2.5">
            <Calendar className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-xs md:text-sm font-bold text-slate-800">تحديد وتفعيل الموسم الرياضي النشط</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">بناءً على اختيار الموسم، يتم تلقائياً تحديث تعريف المواليد المقبولة للفئات العمرية (U12, U15, U18, U20).</p>
            </div>
          </div>
          
          {isCentralAdmin && !isAddingSeason && (
            <button
              type="button"
              onClick={() => setIsAddingSeason(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl shadow-3xs cursor-pointer transition-all shrink-0 self-start sm:self-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>إضافة موسم جديد</span>
            </button>
          )}
        </div>

        {isCentralAdmin && isAddingSeason && (
          <form onSubmit={handleAddSeason} className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <div className="space-y-1 flex-1">
              <label className="block text-[10px] font-bold text-slate-500">صيغة الموسم الرياضي الجديد (YYYY/YYYY):</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="مثال: 2027/2028"
                value={newSeasonInput}
                onChange={(e) => setNewSeasonInput(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 placeholder-slate-400"
              />
            </div>
            <div className="flex items-center gap-2 pt-4 sm:pt-0 shrink-0 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setIsAddingSeason(false);
                  setNewSeasonInput('');
                }}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-200 rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={savingNewSeason}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
              >
                {savingNewSeason && <RefreshCw className="h-3 w-3 animate-spin" />}
                <span>حفظ وتفعيل الموسم</span>
              </button>
            </div>
          </form>
        )}

        <div className="flex items-center gap-3 pt-1">
          {isCentralAdmin ? (
            <select
              value={currentSeason}
              onChange={(e) => handleSeasonChange(e.target.value)}
              disabled={savingSeason}
              className="px-4 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 cursor-pointer disabled:opacity-50"
            >
              {seasonsList.map((season) => (
                <option key={season} value={season}>
                  الموسم الرياضي: {season} {season === '2026/2027' ? '(الموسم الحالي)' : ''}
                </option>
              ))}
            </select>
          ) : (
            <span className="px-4 py-2 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-700">
              الموسم الرياضي المعتمد: {currentSeason}
            </span>
          )}

          {savingSeason && (
            <span className="text-[10px] text-blue-600 flex items-center gap-1.5 animate-pulse font-medium">
              <RefreshCw className="h-3 w-3 animate-spin" />
              جاري حفظ وتغيير الموسم...
            </span>
          )}
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث باسم الرياضة أو رمزها..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'ALL'
                ? 'bg-white text-slate-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            جميع البطولات ({visibleSportsList.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('PROGRAMMED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'PROGRAMMED'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>المبرمجة ({programmedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('UNPROGRAMMED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              statusFilter === 'UNPROGRAMMED'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>في طور الإعداد ({unprogrammedCount})</span>
          </button>
        </div>
      </div>

      {/* Info Alert */}
      <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-xl flex gap-3 text-amber-900 text-xs leading-relaxed">
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="font-bold text-amber-950">ملاحظة تنظيمية هامة للمسير ورؤساء اللجن التقنية:</p>
          <p className="mt-0.5 text-amber-800 leading-normal">
            من هذه الشاشة، يمكنك التبديل المباشر لوضعية أي رياضة بين <strong>"🟢 مبرمجة ومفتوحة للتسجيل"</strong> أو <strong>"⚪ في طور الإعداد"</strong>. عند اختيار "في طور الإعداد"، تظهر البطولة رمادية في المنصة حتى يتم اعتمادها وبرمجتها رسمياً.
          </p>
        </div>
      </div>

      {/* Sports List */}
      {loading ? (
        <div className="flex justify-center p-12">
          <div className="h-7 w-7 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5">
          {filteredSports.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 text-center text-slate-500">
              <Trophy className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">لا توجد تخصصات رياضية تطابق خيارات البحث المحددة</p>
              <p className="text-xs text-slate-400 mt-1">جرب تغيير فلتر الحالة أو كلمة البحث لعرض باقي الرياضات.</p>
            </div>
          ) : (
            filteredSports.map((sport) => {
              const mappedSport = SPORTS_MAP[sport.id] || { name: sport.name, icon: sport.icon || '🏆' };
              const activeCategories = sport.ageCategories || [];
              const seasonalCategories = getAgeCategoriesForSeason(currentSeason, undefined, sport.id);
              const isProgrammed = isSportProgrammed(sport);

              return (
                <div
                  key={sport.id}
                  className={`bg-white rounded-2xl border transition-all p-5 space-y-5 ${
                    isProgrammed
                      ? 'border-slate-200/80 shadow-xs hover:border-blue-300'
                      : 'border-amber-200/90 bg-amber-50/10 shadow-xs hover:border-amber-300'
                  }`}
                >
                  {/* Top Bar: Icon, Name, Badge, & Programmed Status Selector */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    {editingInfoId === sport.id ? (
                      <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <input
                          type="text"
                          value={sport.icon || ''}
                          placeholder="🏆"
                          title="رمز الرياضة التعبيري"
                          onChange={(e) => setSportsList(prev => prev.map(s => s.id === sport.id ? { ...s, icon: e.target.value } : s))}
                          className="w-12 px-2 py-1.5 text-base text-center border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold bg-white"
                        />
                        <input
                          type="text"
                          value={sport.name || ''}
                          placeholder="اسم الرياضة"
                          title="اسم الرياضة"
                          onChange={(e) => setSportsList(prev => prev.map(s => s.id === sport.id ? { ...s, name: e.target.value } : s))}
                          className="px-3 py-1.5 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white min-w-[150px]"
                        />
                        <button
                          type="button"
                          onClick={() => setEditingInfoId(null)}
                          className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-2xl w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 shadow-3xs">
                          {sport.icon || mappedSport.icon}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base font-bold text-slate-800">{sport.name || mappedSport.name}</h3>
                            {isCentralAdmin && (
                              <button
                                type="button"
                                onClick={() => setEditingInfoId(sport.id)}
                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                title="تعديل الاسم أو الأيقونة"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                            {sport.isCustom && (
                              <span className="text-[9px] bg-purple-50 text-purple-700 font-bold px-2 py-0.5 rounded-full border border-purple-200">
                                صنف مضاف
                              </span>
                            )}
                            <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border flex items-center gap-1 ${
                              isProgrammed 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${isProgrammed ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                              <span>{isProgrammed ? '🟢 مبرمجة ومفتوحة' : '⚪ في طور الإعداد'}</span>
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium">رمز الرياضة: {sport.id}</span>
                        </div>
                      </div>
                    )}

                    {/* STATUS SWITCHER TOGGLE BUTTONS */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
                      <span className="text-[11px] font-bold text-slate-500 px-2">وضع البطولة:</span>
                      <div className="flex items-center gap-1 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => handleToggleSportProgrammedStatus(sport.id, true)}
                          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            isProgrammed
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                          }`}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>🟢 مبرمجة</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleSportProgrammedStatus(sport.id, false)}
                          className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            !isProgrammed
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                          }`}
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>⚪ في طور الإعداد</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Programmed Status Explanation Banner */}
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                    {isProgrammed ? (
                      <span className="text-emerald-800 font-semibold">
                        ✅ وضعية البطولة حالياً: <strong className="font-bold">مبرمجة ومتاحة للتسجيل</strong>. تظهر باللون الأخضر في القائمة الرئيسية للبطولات ويمكن للأساتذة والمؤسسات تسجيل الفرق والتلاميذ فوراً.
                      </span>
                    ) : (
                      <span className="text-amber-800 font-semibold">
                        ⏳ وضعية البطولة حالياً: <strong className="font-bold">في طور الإعداد (غير مبرمجة)</strong>. تظهر باللون الرمادي في منصة البطولات بانتظار استكمال الضوابط والبرمجة الرسمية من طرف رئيس اللجنة التقنية.
                      </span>
                    )}
                  </p>

                  {/* Categories Selector */}
                  <SportAgeCategoriesManager
                    sportId={sport.id}
                    customCategories={sport.customAgeCategories || []}
                    onChange={(updated) => {
                      setSportsList(prev => prev.map(s => {
                        if (s.id === sport.id) {
                          return {
                            ...s,
                            customAgeCategories: updated,
                            ageCategories: updated.map(c => c.id)
                          };
                        }
                        return s;
                      }));
                    }}
                  />

                  {/* Student Limit Setup */}
                  <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-500 shrink-0" />
                      <label className="text-xs font-bold text-slate-700">
                        الحد الأقصى لعدد التلاميذ المسموح بمشاركتهم لكل مؤسسة:
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="غير محدود"
                        value={sport.studentLimit ?? ''}
                        onChange={(e) => {
                          const val = e.target.value === '' ? undefined : parseInt(e.target.value, 10);
                          setSportsList(prev => prev.map(s => s.id === sport.id ? { ...s, studentLimit: val } : s));
                        }}
                        className="w-28 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-center"
                      />
                      <span className="text-[11px] text-slate-400 font-medium">
                        تلميذ(ة) (اتركه فارغاً أو 0 بدون سقف)
                      </span>
                    </div>
                  </div>

                  {/* Athletics Specialties Setup */}
                  {sport.id === 'athletics' && (
                    <div className="pt-3 border-t border-slate-100 space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                      <label className="block text-xs font-bold text-slate-700">
                        تخصصات ألعاب القوى المتاحة للتسجيل:
                      </label>
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {(sport.athleticsSpecialties || ['القفز الطولي العلوي', 'القفز الطولي', 'جري 80 متر']).map((spec, sIdx) => (
                          <span key={sIdx} className="inline-flex items-center gap-1.5 bg-white text-slate-700 text-xs font-bold px-2.5 py-1 rounded-lg border border-slate-200">
                            <span>{spec}</span>
                            <button
                              type="button"
                              onClick={() => {
                                const currentSpecs = sport.athleticsSpecialties || ['القفز الطولي العلوي', 'القفز الطولي', 'جري 80 متر'];
                                const updatedSpecs = currentSpecs.filter((_, i) => i !== sIdx);
                                setSportsList(prev => prev.map(s => s.id === 'athletics' ? { ...s, athleticsSpecialties: updatedSpecs } : s));
                              }}
                              className="text-slate-400 hover:text-red-500 font-black cursor-pointer transition-colors"
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        
                        {/* Inline form to add athletics specialty */}
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            id="new-athletics-spec-input"
                            placeholder="تخصص جديد..."
                            className="px-2.5 py-1 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.currentTarget;
                                const val = input.value.trim();
                                if (val) {
                                  const currentSpecs = sport.athleticsSpecialties || ['القفز الطولي العلوي', 'القفز الطولي', 'جري 80 متر'];
                                  if (currentSpecs.includes(val)) {
                                    toast.error('هذا التخصص مضاف بالفعل');
                                    return;
                                  }
                                  const updatedSpecs = [...currentSpecs, val];
                                  setSportsList(prev => prev.map(s => s.id === 'athletics' ? { ...s, athleticsSpecialties: updatedSpecs } : s));
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const input = document.getElementById('new-athletics-spec-input') as HTMLInputElement;
                              const val = input?.value.trim();
                              if (val) {
                                const currentSpecs = sport.athleticsSpecialties || ['القفز الطولي العلوي', 'القفز الطولي', 'جري 80 متر'];
                                if (currentSpecs.includes(val)) {
                                  toast.error('هذا التخصص مضاف بالفعل');
                                  return;
                                }
                                const updatedSpecs = [...currentSpecs, val];
                                setSportsList(prev => prev.map(s => s.id === 'athletics' ? { ...s, athleticsSpecialties: updatedSpecs } : s));
                                input.value = '';
                              }
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            + إضافة
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Save & Delete Action Buttons */}
                  <div className="shrink-0 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2 justify-end">
                    {/* Delete button (Central Admin only) */}
                    {isCentralAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDeleteSport(sport.id, sport.name || mappedSport.name)}
                        disabled={deletingId === sport.id}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs px-3 py-2.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                        title="حذف هذا التخصص الرياضي"
                      >
                        {deletingId === sport.id ? (
                          <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>حذف التخصص الرياضي 🗑️</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleSaveSportConfig(sport.id, activeCategories, sport.studentLimit, sport.athleticsSpecialties, isProgrammed, sport.name, sport.icon, sport.customAgeCategories)}
                      disabled={savingId !== null}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingId === sport.id ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      <span>حفظ تغييرات {sport.name}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      </div>
      )}

      {/* ADD NEW SPORT MODAL (CENTRAL ADMIN ONLY) */}
      {isAddSportModalOpen && isCentralAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">إضافة نوع رياضي جديد إلى المنظومة</h3>
                  <p className="text-[11px] text-slate-500 font-medium">خاص بالمسير المركزي - تحديد الفئات العمرية وسقف المشاركين والحالة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSportModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleCreateNewSport} className="p-5 md:p-6 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Sport Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اسم التخصص أو النوع الرياضي <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="مثال: كرة الريشة الطائرة (الريشة)، الرماية بالنبال، السباحة المدرسية..."
                  value={newSportName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setNewSportName(name);
                    // auto generate latin slug if empty
                    if (!newSportId || newSportId.startsWith('sport_')) {
                      const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
                      if (slug) setNewSportId(slug);
                    }
                  }}
                  className="w-full text-xs rounded-xl border border-slate-200 px-3.5 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                />
              </div>

              {/* Initial Programmed Status Switcher */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  حالة البطولة الأولية (مبرمجة أم في طور الإعداد)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewSportIsProgrammed(true)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      newSportIsProgrammed
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>🟢 مبرمجة ومفتوحة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewSportIsProgrammed(false)}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      !newSportIsProgrammed
                        ? 'bg-amber-600 border-amber-600 text-white shadow-xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Clock className="h-4 w-4" />
                    <span>⚪ في طور الإعداد</span>
                  </button>
                </div>
              </div>

              {/* Icon / Emoji Picker */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الرمز التعبيري للرياضة (الأيقونة)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setNewSportIcon(emoji)}
                      className={`text-lg w-9 h-9 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                        newSportIcon === emoji
                          ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                          : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="أو اكتب رمز إيموجي مخصص..."
                    value={newSportIcon}
                    onChange={(e) => setNewSportIcon(e.target.value)}
                    className="w-24 text-center text-sm rounded-xl border border-slate-200 px-2 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[11px] text-slate-400">سيظهر هذا الرمز بجانب اسم الرياضة في البطولات واللوائح</span>
                </div>
              </div>

              {/* Unique Technical Key (Slug/ID) & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    المعرف التقني باللاتينية (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: badminton أو archery"
                    value={newSportId}
                    onChange={(e) => setNewSportId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                  <span className="text-[10px] text-slate-400 block mt-1">اتركه فارغاً للتوليد التلقائي</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    الوصف التوضيحي (اختياري)
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: منافسات بطولة كرة الريشة المدرسية"
                    value={newSportDescription}
                    onChange={(e) => setNewSportDescription(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Age Categories Configuration */}
              <SportAgeCategoriesManager
                sportId="new_sport"
                customCategories={newSportCustomCategories}
                onChange={(updated) => {
                  setNewSportCustomCategories(updated);
                  setNewSportCategories(updated.map(c => c.id));
                }}
              />

              {/* Student Limit (سقف المشاركين لكل مؤسسة) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  سقف عدد المشاركين (التلاميذ) المسموح بهم لكل مؤسسة
                </label>
                <div className="flex items-center gap-2.5">
                  <input
                    type="number"
                    min="0"
                    placeholder="غير محدود"
                    value={newSportStudentLimit}
                    onChange={(e) => setNewSportStudentLimit(e.target.value)}
                    className="w-32 px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-slate-700 text-center"
                  />
                  <span className="text-xs text-slate-500">
                    تلميذ(ة) لكل مؤسسة (اتركه فارغاً أو 0 ليكون العدد مفتوحاً)
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  * مثال: 8 لاعبين لكرة السلة المصغرة، أو 12 لاعباً، إلخ. لن يتمكن الأستاذ من تجاوز هذا العدد عند تعبئة لائحة الفريق.
                </p>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddSportModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSport}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingSport ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  <span>حفظ وإضافة الرياضة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SportsConfig;
