import React, { useEffect, useState } from 'react';
import { DataService } from '../lib/dataService';
import { RoleKey, RoleSidebarPermissions } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Save,
  RefreshCw,
  KeyRound,
  Users,
  Undo2,
  UserCheck,
  GraduationCap,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PermissionsModal: React.FC<PermissionsModalProps> = ({ isOpen, onClose }) => {
  const { userProfile } = useAuth();
  const [rolePermissions, setRolePermissions] = useState<RoleSidebarPermissions>({
    CENTRAL_ADMIN: [
      '/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions',
      'action:export_data', 'action:import_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule', 'action:delete_records'
    ],
    TECH_COMMITTEE_HEAD: [
      '/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config',
      'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
    ],
    SPORT_MANAGER: [
      '/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics',
      'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
    ],
    TEACHER: [
      '/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics',
      'action:export_data', 'action:register_students'
    ],
    REFEREE: [
      '/dashboard', '/matches', '/statistics',
      'action:edit_results'
    ]
  });
  const [loading, setLoading] = useState(true);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN';

  useEffect(() => {
    if (!isOpen) return;

    const loadPermissions = async () => {
      setLoading(true);
      try {
        const perms = await DataService.getRoleSidebarPermissions();
        if (perms) {
          // Merge to handle older records without the actions keys
          setRolePermissions(perms);
        }
      } catch (err) {
        console.error('Failed to load role permissions inside PermissionsModal:', err);
        toast.error('تعذر تحميل صلاحيات المستخدمين من الخادم');
      } finally {
        setLoading(false);
      }
    };

    loadPermissions();
  }, [isOpen]);

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

  const actionItemsList = [
    { href: 'action:export_data', label: 'تصدير البيانات واللوائح', icon: '📥', desc: 'تصدير اللوائح، الإحصائيات، والنتائج بصيغ Excel أو شواهد ومحاضر PDF' },
    { href: 'action:import_data', label: 'استيراد اللوائح جماعياً', icon: '📤', desc: 'استيراد ملفات التلاميذ والمؤسسات بشكل جماعي عبر ملفات Excel الموحدة' },
    { href: 'action:edit_results', label: 'إدخال وتعديل نتائج المباريات والسباقات', icon: '✍️', desc: 'توثيق وتعديل وتدقيق نتائج مباريات الألعاب الجماعية وسباقات العدو الريفي' },
    { href: 'action:register_students', label: 'تسجيل وتعديل العدائين والتلاميذ', icon: '👤', desc: 'إضافة التلاميذ الجدد وتعديل معلوماتهم الشخصية والبدنية والصحية والبطاقات' },
    { href: 'action:manage_schedule', label: 'برمجة وجدولة المواعيد والملاعب', icon: '📅', desc: 'تحديد وتعديل أوقات وملاعب المباريات والبطولات الجارية' },
    { href: 'action:delete_records', label: 'الصلاحية الكاملة للحذف النهائي', icon: '🗑️', desc: 'صلاحية الحذف النهائي للمباريات، والعدائين، والمؤسسات والفرق بشكل نهائي' }
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
      onClose();
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
      CENTRAL_ADMIN: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions',
        'action:export_data', 'action:import_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule', 'action:delete_records'
      ],
      TECH_COMMITTEE_HEAD: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config',
        'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
      ],
      SPORT_MANAGER: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics',
        'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
      ],
      TEACHER: [
        '/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics',
        'action:export_data', 'action:register_students'
      ],
      REFEREE: [
        '/dashboard', '/matches', '/statistics',
        'action:edit_results'
      ]
    };
    setRolePermissions(DEFAULT_PERMISSIONS);
    toast.success('تمت استعادة الصلاحيات والعمليات الافتراضية للنظام بنجاح. يرجى الضغط على حفظ لتأكيد التغييرات.');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs select-none animate-in fade-in duration-150" dir="rtl">
      <div 
        className="w-full max-w-6xl h-[90vh] bg-slate-50 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden relative z-[201] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-900">نافذة التحكم في صلاحيات الوصول والأدوار</h2>
              <p className="text-[11px] text-slate-500 font-medium">تخصيص صفحات القائمة الجانبية المتاحة لكل فئة بالموقع في الوقت الفعلي</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer active:scale-95"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable) */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Warning Notice for non-admins */}
          {!isCentralAdmin && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1 text-right">
                <h4 className="text-xs font-bold text-amber-900">أنت في وضع العرض فقط (صلاحيات القراءة)</h4>
                <p className="text-[11px] text-amber-700 font-medium leading-relaxed">
                  عذراً، يمتلك "المسؤول المركزي" الحصري فقط القدرة على تعديل وتخصيص صفحات القائمة الجانبية وإعادة تعيين مصفوفة الأمان.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
              <p className="text-xs font-bold text-slate-500">جاري تحميل مصفوفة الصلاحيات المحدثة...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {rolesConfig.map((role) => {
                const allowedHrefs = rolePermissions[role.key] || [];
                const RoleIcon = role.icon;

                return (
                  <div
                    key={role.key}
                    className={`bg-white rounded-xl border ${role.borderClass} shadow-xs overflow-hidden flex flex-col`}
                  >
                    {/* Role Header */}
                    <div className={`p-4 ${role.bgHeader} border-b ${role.borderClass} flex flex-col sm:flex-row sm:items-center justify-between gap-3`}>
                      <div className="flex items-start gap-3">
                        <span className={`p-2 bg-white rounded-lg shadow-3xs shrink-0 border ${role.borderClass}`}>
                          <RoleIcon className={`w-4 h-4 ${role.colorClass}`} />
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
                              const allHrefs = [
                                ...sidebarItemsList.map(i => i.href),
                                ...actionItemsList.map(i => i.href)
                              ];
                              setRolePermissions(prev => ({ ...prev, [role.key]: allHrefs }));
                            }}
                            className="text-[10px] font-black text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/80 px-2.5 py-1 rounded-lg border border-blue-200 cursor-pointer transition-colors"
                          >
                            تحديد الجميع ✅
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
                            className="text-[10px] font-black text-slate-600 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer transition-colors"
                          >
                            إلغاء التحديد ❌
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-4 space-y-4">
                      {/* Sidebar Items Section */}
                      <div>
                        <h4 className="text-[11px] font-black text-slate-400 mb-2.5 flex items-center gap-1.5 border-b border-slate-100 pb-1">
                          <span>📋</span>
                          <span>أقسام القائمة الجانبية المتاحة للوصول</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                                  className={`mt-1 h-3.5 w-3.5 rounded text-blue-600 border-slate-300 focus:ring-blue-500 ${
                                    !isCentralAdmin || isPreservedAdminRoute ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1 leading-normal font-medium truncate" title={item.desc}>
                                    {item.desc}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Advanced Actions Section */}
                      <div className="pt-2">
                        <h4 className="text-[11px] font-black text-slate-400 mb-2.5 flex items-center gap-1.5 border-b border-slate-100 pb-1">
                          <span>⚡</span>
                          <span>صلاحيات العمليات والوظائف المتقدمة</span>
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {actionItemsList.map((item) => {
                            const isChecked = allowedHrefs.includes(item.href);

                            return (
                              <label
                                key={item.href}
                                className={`flex items-start gap-2.5 p-3 rounded-xl border transition-all select-none ${
                                  isChecked
                                    ? 'bg-amber-50/10 hover:bg-amber-50/20 border-amber-200/60'
                                    : 'bg-white hover:bg-slate-50 border-slate-100'
                                } cursor-pointer`}
                              >
                                <input
                                  type="checkbox"
                                  disabled={!isCentralAdmin}
                                  checked={isChecked}
                                  onChange={() => handleTogglePermission(role.key, item.href)}
                                  className={`mt-1 h-3.5 w-3.5 rounded text-amber-600 border-slate-300 focus:ring-amber-500 ${
                                    !isCentralAdmin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                  }`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                                    <span>{item.icon}</span>
                                    <span>{item.label}</span>
                                  </div>
                                  <p className="text-[10px] text-slate-400 mt-1 leading-normal font-medium truncate" title={item.desc}>
                                    {item.desc}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {isCentralAdmin && (
          <div className="px-6 py-4 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleResetRolePermissions}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer active:scale-95"
            >
              <Undo2 className="w-3.5 h-3.5 text-slate-500" />
              <span>إعادة الضبط الافتراضي</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveRolePermissions}
                disabled={savingPermissions}
                className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5 shrink-0" />
                <span>{savingPermissions ? 'جاري تطبيق الحفظ...' : 'حفظ وتطبيق المصفوفة 💾'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
