import React, { useState, useEffect } from 'react';
import { School, Directorate } from '../types';
import { DataService } from '../lib/dataService';
import { X, School as SchoolIcon, MapPin, User, Phone, PhoneCall, Layers, KeyRound } from 'lucide-react';

interface CreateSchoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (school: Omit<School, 'id'>) => Promise<void>;
  initialData?: School | null;
}

export const CreateSchoolModal: React.FC<CreateSchoolModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [activeDir, setActiveDir] = useState<Directorate | null>(null);
  const [name, setName] = useState(initialData?.name || '');
  const [type, setType] = useState(initialData?.type || 'تأهيلي');
  const [commune, setCommune] = useState(initialData?.commune || 'تاوريرت المركز');
  const [teacherName, setTeacherName] = useState(initialData?.coordinatorName || initialData?.teacherName || '');
  const [phone, setPhone] = useState(initialData?.phone || '');
  const [principalName, setPrincipalName] = useState(initialData?.principalName || '');
  const [principalPhone, setPrincipalPhone] = useState(initialData?.principalPhone || '');
  const [accessCode, setAccessCode] = useState(initialData?.accessCode || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load active directorate
  useEffect(() => {
    DataService.getActiveDirectorate().then(dir => setActiveDir(dir)).catch(() => {});
  }, []);

  // Sync initialData when opening for edit
  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setType(initialData.type);
      setCommune(initialData.commune);
      setTeacherName(initialData.coordinatorName || initialData.teacherName || '');
      setPhone(initialData.phone || '');
      setPrincipalName(initialData.principalName || '');
      setPrincipalPhone(initialData.principalPhone || '');
      setAccessCode(initialData.accessCode || '');
    } else {
      setName('');
      setType('تأهيلي');
      setCommune(activeDir?.shortName || activeDir?.name || 'تاوريرت المركز');
      setTeacherName('');
      setPhone('');
      setPrincipalName('');
      setPrincipalPhone('');
      setAccessCode('');
    }
  }, [initialData, isOpen, activeDir]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('يرجى إدخال اسم المؤسسة التعليمية');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        type,
        commune: commune.trim() || 'المركز',
        teacherName: teacherName.trim() || undefined,
        coordinatorName: teacherName.trim() || undefined,
        phone: phone.trim() || undefined,
        principalName: principalName.trim() || undefined,
        principalPhone: principalPhone.trim() || undefined,
        accessCode: accessCode.trim() || undefined
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto p-2 sm:p-4 flex min-h-full items-center justify-center bg-slate-900/60 backdrop-blur-xs overscroll-contain" dir="rtl">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-auto max-h-[92dvh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header (Fixed at top) */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <SchoolIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800">
                {initialData ? 'تعديل بيانات المؤسسة التعليمية' : 'إضافة مؤسسة تعليمية جديدة'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {activeDir?.name ? `تسجيل المؤسسة بـ ${activeDir.name}` : 'تسجيل المؤسسة وأرقام التواصل'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 overscroll-contain">
          <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-xl text-[11px] text-blue-900 leading-relaxed">
            💡 <strong>تنبيه إداري:</strong> المؤسسة المضافة ستظهر تلقائياً في قائمة الاختيار للأساتذة عند فتح حساب أو تحديث بياناتهم حسب السلك، مما يضمن توحيد وتفادي تكرار أسماء المؤسسات.
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم المؤسسة التعليمية *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: ثانوية الفتح التأهيلية"
              className="w-full text-sm sm:text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">السلك التعليمي</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full text-sm sm:text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="تأهيلي">ثانوي تأهيلي</option>
                <option value="إعدادي">ثانوي إعدادي</option>
                <option value="ابتدائي">تعليم ابتدائي</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الجماعة / الدائرة</label>
              <select
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                className="w-full text-sm sm:text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="تاوريرت المركز">تاوريرت المركز</option>
                <option value="العيون سيدي ملوك">العيون سيدي ملوك</option>
                <option value="دبدو">دبدو</option>
                <option value="سيدي لحسن">سيدي لحسن</option>
                <option value="سيدي علي بلقاسم">سيدي علي بلقاسم</option>
                <option value="مستكمار">مستكمار</option>
                <option value="قطيطير">قطيطير</option>
                <option value="أهل واد زا">أهل واد زا</option>
                <option value="ملقى الويدان">ملقى الويدان</option>
                <option value="تنكرفا">تنكرفا</option>
                <option value="أولاد امحمد">أولاد امحمد</option>
                <option value="مشرع حمادي">مشرع حمادي</option>
              </select>
            </div>
          </div>

          {/* Coordinator and Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المنسق (أستاذ التربية البدنية) - اختياري</label>
              <input
                type="text"
                value={teacherName}
                onChange={(e) => setTeacherName(e.target.value)}
                placeholder="مثال: ذ. عبد الرحيم بلقاسم"
                className="w-full text-sm sm:text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">هاتف المنسق</label>
              <div className="relative">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="06XXXXXXXX"
                  className="w-full text-sm sm:text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 text-left pl-8 bg-white"
                  dir="ltr"
                />
                <Phone className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              </div>
            </div>
          </div>

          {/* School Principal (اسم وهاتف مدير المؤسسة) */}
          <div className="bg-amber-50/70 rounded-xl p-3.5 border border-amber-200/80 space-y-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <PhoneCall className="h-4 w-4 text-amber-700 shrink-0" />
              <label className="text-xs font-bold text-amber-950">بيانات إدارة المؤسسة (المدير)</label>
              <span className="text-[10px] bg-amber-200/70 text-amber-900 font-medium px-2 py-0.5 rounded-full mr-auto">
                متاح للتنسيق الإداري والمراسلات
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">اسم مدير المؤسسة التعليمية</label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  placeholder="مثال: ذ. محمد اليعقوبي"
                  className="w-full text-sm sm:text-xs rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-900 mb-1">هاتف مدير المؤسسة</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={principalPhone}
                    onChange={(e) => setPrincipalPhone(e.target.value)}
                    placeholder="06XXXXXXXX أو 05XXXXXXXX"
                    className="w-full text-sm sm:text-xs rounded-lg border border-amber-300/80 bg-white px-3 py-2 text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 text-left pl-8"
                    dir="ltr"
                  />
                  <PhoneCall className="h-3.5 w-3.5 text-amber-600 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>
          </div>

          {/* School Access PIN Code (رمز الأمان السري للمؤسسة) */}
          <div className="bg-blue-50/50 rounded-xl p-3.5 border border-blue-200/60 space-y-2">
            <div className="flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-blue-600 shrink-0" />
              <label className="text-xs font-bold text-blue-950">رمز أمان المؤسسة (Access Code / PIN)</label>
            </div>
            <p className="text-[10px] text-blue-800 leading-relaxed">
              رمز سري مكون من 6 أحرف وأرقام يمنح لأساتذة المؤسسة لربط حساباتهم بالمؤسسة لضمان أمان معطياتها وتفادي عبث المتطفلين. (اتركه فارغاً للتوليد التلقائي).
            </p>
            <div className="relative">
              <input
                type="text"
                maxLength={6}
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                placeholder="6 أحرف وأرقام سرية (مثال: 589412)"
                className="w-full text-center tracking-[0.3em] text-sm sm:text-xs rounded-lg border border-blue-300 bg-white px-3 py-2.5 text-blue-950 font-mono font-black focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Sticky Submit Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 sticky bottom-0 bg-white/95 backdrop-blur-xs -mx-4 -mb-4 md:-mx-6 md:-mb-6 p-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-xs disabled:bg-blue-300 cursor-pointer"
            >
              {isSubmitting ? 'جاري الحفظ...' : initialData ? 'تحديث البيانات' : 'إضافة المؤسسة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
