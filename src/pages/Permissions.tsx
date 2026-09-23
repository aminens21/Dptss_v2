import React, { useEffect, useState, useMemo } from 'react';
import { DataService } from '../lib/dataService';
import { RoleKey, RoleSidebarPermissions } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  RefreshCw,
  Lock,
  KeyRound,
  Users,
  CheckCircle2,
  AlertCircle,
  Undo2,
  UserCheck,
  GraduationCap,
  Eye,
  Settings,
  Grid
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Permissions: React.FC = () => {
  const { userProfile } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<RoleSidebarPermissions>({
    CENTRAL_ADMIN: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions'],
    TECH_COMMITTEE_HEAD: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config'],
    SPORT_MANAGER: ['/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics'],
    TEACHER: ['/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics'],
    REFEREE: ['/dashboard', '/matches', '/statistics']
  });
  const [loading, setLoading] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';

  useEffect(() => {
    const loadPermissions = async () => {
      setLoading(true);
      try {
        const perms = await DataService.getRoleSidebarPermissions();
        if (perms) {
          setRolePermissions(perms);
        }
      } catch (err) {
        console.error('Failed to load role permissions inside Permissions page:', err);
        toast.error('تعذر تحميل صلاحيات المستخدمين من الخادم');
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, []);

  const sidebarItemsList = [
    { href: '/dashboard', label: 'الرئيسية والإشعارات', icon: '🏠', desc: 'لوحة التحكم الرئيسية والتنبيهات العامة' },
    { href: '/schools', label: 'المؤسسات التعليمية', icon: '🏫', desc: 'دليل ورعاة وممثلي المؤسسات التعليمية بالمديرية' },
    { href: '/tournaments', label: 'البطولات الرياضية المدرسية', icon: '🏆', desc: 'استعراض وإدارة البطولات الإقليمية والجهوية والوطنية وتفرعاتها وتسجيل الفرق' },
    { href: '/teachers', label: 'الأطر التربوية', icon: '👨‍🏫', desc: 'قائمة أساتذة التربية البدنية ومؤطري الرياضة المدرسية' },
    { href: '/tech-committee', label: 'رؤساء اللجن التقنية', icon: '🛡️', desc: 'إدارة وتعيين مسؤولي اللجان التقنية حسب الرياضات' },
    { href: '/referees', label: 'الحكام وقضاة الملاعب', icon: '🏁', desc: 'سجل وتنظيم الحكام المعتمدين وتعيينات المباريات' },
    { href: '/matches', label: 'المباريات والنتائج', icon: '⚽', desc: 'برمجة وتدقيق وتسجيل نتائج المباريات المدرسية' },
    { href: '/helper-apps', label: 'تطبيقات مساعدة', icon: '🛠️', desc: 'مجموعة من التطبيقات المساعدة من بينها ماسح الصدريات لخط النهاية' },
    { href: '/posters-certificates', label: 'الملصقات والشواهد التقديرية', icon: '🎨', desc: 'توليد ملصقات البطولات المبرمجة والشواهد التقديرية للمشاركين' },
    { href: '/statistics', label: 'إحصائيات عامة والترتيب', icon: '📊', desc: 'مؤشرات الأداء، ونسب المشاركة، والتحليلات البيانية وترتيب فرق المؤسسات' },
    { href: '/permissions', label: 'صلاحيات المستخدمين', icon: '🔑', desc: 'التحكم وتحديد أزرار القائمة الجانبية المتاحة لكل فئة بالموقع' },
    { href: '/sports-config', label: 'الإعدادات والضوابط الرياضية', icon: '⚙️', desc: 'ضوابط الرياضات والمواسم وربط المؤسسات التعليمية' },
  ];

  const rolesConfig = [
    {
      key: 'TEACHER' as RoleKey,
      title: 'الأطر التربوية (الأساتذة)',
      subtitle: 'مؤطرو الرياضة المدرسية بالجمعيات الرياضية للمؤسسات التعليمية',
      badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-800',
      badgeText: 'أستاذ(ة) مؤطر',
      icon: GraduationCap,
      colorClass: 'text-emerald-600',
      borderClass: 'border-emerald-100',
      bgHeader: 'bg-emerald-50/50'
    },
    {
      key: 'TECH_COMMITTEE_HEAD' as RoleKey,
      title: 'رؤساء اللجان التقنية الإقليمية',
      subtitle: 'المشرفون التقنيون الإقليميون على تخصص رياضي معين',
      badgeBg: 'bg-blue-50 border-blue-200 text-blue-800',
      badgeText: 'رئيس لجنة تقنية إقليمية',
      icon: ShieldCheck,
      colorClass: 'text-blue-600',
      borderClass: 'border-blue-100',
      bgHeader: 'bg-blue-50/50'
    },
    {
      key: 'REFEREE' as RoleKey,
      title: 'الحكام وقضاة الملاعب المعتمدون',
      subtitle: 'الحكام المكلفون بقيادة وتسيير وتوثيق نتائج المقابلات الرياضية المدرسية',
      badgeBg: 'bg-amber-50 border-amber-200 text-amber-800',
      badgeText: 'حكم معتمد',
      icon: UserCheck,
      colorClass: 'text-amber-600',
      borderClass: 'border-amber-100',
      bgHeader: 'bg-amber-50/50'
    },
    {
      key: 'SPORT_MANAGER' as RoleKey,
      title: 'المنسقون الرياضيون (المسيرون)',
      subtitle: 'مسؤولو تتبع وتسيير منافسات الرياضة المدرسية والألعاب الجماعية والفردية',
      badgeBg: 'bg-indigo-50 border-indigo-200 text-indigo-800',
      badgeText: 'مسير رياضي',
      icon: Users,
      colorClass: 'text-indigo-600',
      borderClass: 'border-indigo-100',
      bgHeader: 'bg-indigo-50/50'
    },
    {
      key: 'CENTRAL_ADMIN' as RoleKey,
      title: 'المسير المركزي والمحلي للمنصة',
      subtitle: 'المسؤول الإقليمي العام والمشرف الكامل على إعدادات وبنيات المنصة الرقمية',
      badgeBg: 'bg-purple-50 border-purple-200 text-purple-800',
      badgeText: 'مسير مركزي إقليمي',
      icon: Shield,
      colorClass: 'text-purple-600',
      borderClass: 'border-purple-100',
      bgHeader: 'bg-purple-50/50'
    }
  ];

  const handleTogglePermission = (roleKey: RoleKey, href: string) => {
    if (!isCentralAdmin) {
      toast.error('عذراً، يمتلك المسير المركزي الإقليمي فقط الصلاحية الحصرية لتعديل الأدوار');
      return;
    }
    setRolePermissions(prev => {
      const current = prev[roleKey] || [];
      const updated = current.includes(href)
        ? current.filter(h => h !== href)
        : [...current, href];
      return { ...prev, [roleKey]: updated };
    });
  };

  const handleSaveRolePermissions = async () => {
    if (!isCentralAdmin) {
      toast.error('غير مسموح لك بإجراء هذا التعديل الحساس');
      return;
    }
    setSavingPermissions(true);
    try {
      await DataService.saveRoleSidebarPermissions(rolePermissions);
      toast.success('تم حفظ وتطبيق صلاحيات القائمة الجانبية بنجاح لجميع المستخدمين ✅');
    } catch (error) {
      console.error('Error saving role permissions:', error);
      toast.error('حدث خطأ أثناء الاتصال بقاعدة البيانات لحفظ الصلاحيات');
    } finally {
      setSavingPermissions(false);
    }
  };

  const handleResetRolePermissions = () => {
    if (!isCentralAdmin) {
      toast.error('الصلاحية حصرية للمسؤول المركزي');
      return;
    }
    const DEFAULT_PERMISSIONS: RoleSidebarPermissions = {
      CENTRAL_ADMIN: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions'],
      TECH_COMMITTEE_HEAD: ['/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config'],
      SPORT_MANAGER: ['/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics'],
      TEACHER: ['/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics'],
      REFEREE: ['/dashboard', '/matches', '/statistics']
    };
    setRolePermissions(DEFAULT_PERMISSIONS);
    toast.success('تمت استعادة الصلاحيات الافتراضية للنظام بنجاح. يرجى الضغط على حفظ لتأكيد التغييرات.');
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-3 select-none">
        <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
        <p className="text-xs font-bold text-slate-500">جاري تحميل مصفوفة الصلاحيات وأقسام القائمة الجانبية...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 select-none" dir="rtl" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-blue-600">
            <KeyRound className="h-6 w-6 shrink-0" />
            <h1 className="text-base sm:text-lg md:text-xl font-black text-slate-900 tracking-tight">إدارة صلاحيات الوصول والأدوار</h1>
          </div>
          <p className="text-xs sm:text-xs text-slate-500 font-medium">
            تحديد وتمكين فئات مستخدمي المنصة (الأساتذة، رؤساء اللجان، الحكام، المنسقين) من استخدام أقسام النظام واستغلالها بشكل مخصص ومحمي.
          </p>
        </div>

        {isCentralAdmin && (
          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={handleResetRolePermissions}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all shadow-3xs cursor-pointer active:scale-95"
            >
              <Undo2 className="w-4 h-4 text-slate-500" />
              <span>إعادة الضبط الافتراضي</span>
            </button>
            <button
              type="button"
              onClick={handleSaveRolePermissions}
              disabled={savingPermissions}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              <Save className="h-4 h-4 shrink-0" />
              <span>{savingPermissions ? 'جاري تطبيق الحفظ...' : 'حفظ وتطبيق المصفوفة 💾'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Warning Notice for non-admins */}
      {!isCentralAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-1 text-right">
            <h4 className="text-xs font-bold text-amber-900">أنت في وضع العرض فقط (صلاحيات القراءة)</h4>
            <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
              عذراً، يمتلك "المسؤول المركزي" الحصري فقط القدرة على تعديل وتخصيص صفحات القائمة الجانبية وإعادة تعيين مصفوفة الأمان. يمكنك الاطلاع على الصلاحيات الحالية لمختلف الفئات.
            </p>
          </div>
        </div>
      )}

      {/* Info Cards / Dashboard layout for Roles */}
      <div className="grid grid-cols-1 gap-6">
        {rolesConfig.map((role) => {
          const allowedHrefs = rolePermissions[role.key] || [];
          const RoleIcon = role.icon;

          return (
            <div
              key={role.key}
              className={`bg-white rounded-2xl border ${role.borderClass} shadow-xs overflow-hidden hover:shadow-md transition-all duration-300 flex flex-col`}
            >
              {/* Header block */}
              <div className={`p-4 ${role.bgHeader} border-b ${role.borderClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                <div className="flex items-start gap-3">
                  <span className={`p-2 bg-white rounded-xl shadow-3xs shrink-0 border ${role.borderClass}`}>
                    <RoleIcon className={`w-5 h-5 ${role.colorClass}`} />
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs sm:text-sm font-black text-slate-900">{role.title}</h3>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${role.badgeBg}`}>
                        {role.badgeText}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 font-medium leading-relaxed">{role.subtitle}</p>
                  </div>
                </div>

                {isCentralAdmin && (
                  <div className="flex items-center gap-2.5 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        const allHrefs = sidebarItemsList.map(i => i.href);
                        setRolePermissions(prev => ({ ...prev, [role.key]: allHrefs }));
                      }}
                      className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2.5 py-1.5 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                    >
                      تحديد جميع الأقسام ✅
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        // Prevent Central Admin from accidentally locking themselves out of dashboard / permissions
                        const preserved = role.key === 'CENTRAL_ADMIN' 
                          ? ['/dashboard', '/permissions'] 
                          : [];
                        setRolePermissions(prev => ({ ...prev, [role.key]: preserved }));
                        if (role.key === 'CENTRAL_ADMIN') {
                          toast.success('تم الإبقاء على صلاحية لوحة التحكم وإدارة الصلاحيات لحمايتك من الإغلاق التلقائي 🛡️');
                        }
                      }}
                      className="text-[10px] font-black text-slate-600 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                    >
                      إلغاء التحديد ❌
                    </button>
                  </div>
                )}
              </div>

              {/* Modules List Grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {sidebarItemsList.map((item) => {
                  const isChecked = allowedHrefs.includes(item.href);
                  const isPreservedAdminRoute = role.key === 'CENTRAL_ADMIN' && (item.href === '/dashboard' || item.href === '/permissions');

                  return (
                    <label
                      key={item.href}
                      className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all select-none ${
                        isChecked
                          ? 'bg-blue-50/20 hover:bg-blue-50/40 border-blue-200/70'
                          : 'bg-white hover:bg-slate-50 border-slate-100'
                      } ${isPreservedAdminRoute ? 'opacity-80' : 'cursor-pointer'}`}
                    >
                      <input
                        type="checkbox"
                        disabled={!isCentralAdmin || isPreservedAdminRoute}
                        checked={isChecked}
                        onChange={() => handleTogglePermission(role.key, item.href)}
                        className={`mt-1 h-3.5 w-3.5 rounded-md text-blue-600 border-slate-300 focus:ring-blue-500 ${
                          !isCentralAdmin || isPreservedAdminRoute ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs shrink-0">{item.icon}</span>
                          <span className={`text-[11px] font-black truncate ${
                            isChecked ? 'text-blue-900' : 'text-slate-400'
                          }`}>
                            {item.label}
                          </span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-normal mt-1 font-medium line-clamp-2">
                          {item.desc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer warning */}
      {isCentralAdmin && (
        <div className="p-4 bg-blue-50 border border-blue-200/60 rounded-2xl flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-blue-950">هل انتهيت من تعديل الصلاحيات؟</h4>
              <p className="text-[10px] text-blue-800 font-medium">
                تأكد من مراجعة اختياراتك بدقة لتفادي حجب أقسام حساسة عن المستخدمين عن طريق الخطأ. اضغط على زر الحفظ لتثبيت التغييرات على السحابة وتحديث القائمة الجانبية فورياً لدى الجميع.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSaveRolePermissions}
            disabled={savingPermissions}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
          >
            <span>{savingPermissions ? 'جاري الحفظ...' : 'حفظ وتثبيت الصلاحيات الآن'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
