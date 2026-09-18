import React, { useState, useEffect } from 'react';
import { Venue, User } from '../types';
import { DataService } from '../lib/dataService';
import { X, MapPin, Building, Users, FileText, UserCheck, Phone, Mail } from 'lucide-react';

interface CreateVenueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (venue: Omit<Venue, 'id'>) => Promise<void>;
  initialData?: Venue | null;
}

export const CreateVenueModal: React.FC<CreateVenueModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [city, setCity] = useState(initialData?.city || 'تاوريرت');
  const [address, setAddress] = useState(initialData?.address || '');
  const [capacity, setCapacity] = useState<number>(initialData?.capacity || 1000);
  const [notes, setNotes] = useState(initialData?.notes || '');
  
  // Venue Head (Responsible person) state
  const [managerName, setManagerName] = useState(initialData?.managerName || '');
  const [managerPhone, setManagerPhone] = useState(initialData?.managerPhone || '');
  const [managerEmail, setManagerEmail] = useState(initialData?.managerEmail || '');
  
  const [teachers, setTeachers] = useState<User[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load teachers for appointing Venue Head
  useEffect(() => {
    if (isOpen) {
      DataService.getTeachers()
        .then(list => {
          setTeachers(list);
          // Find matching teacher if edit mode
          if (initialData?.managerEmail) {
            const matched = list.find(t => t.email.toLowerCase() === initialData.managerEmail?.toLowerCase());
            if (matched) {
              setSelectedTeacherId(matched.id);
            }
          }
        })
        .catch(err => console.error('Error fetching teachers for venue head selection:', err));
    }
  }, [isOpen, initialData]);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setCity(initialData.city);
      setAddress(initialData.address);
      setCapacity(initialData.capacity || 1000);
      setNotes(initialData.notes || '');
      setManagerName(initialData.managerName || '');
      setManagerPhone(initialData.managerPhone || '');
      setManagerEmail(initialData.managerEmail || '');
    } else {
      setName('');
      setCity('تاوريرت');
      setAddress('');
      setCapacity(1000);
      setNotes('');
      setManagerName('');
      setManagerPhone('');
      setManagerEmail('');
      setSelectedTeacherId('');
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleTeacherChange = (teacherId: string) => {
    setSelectedTeacherId(teacherId);
    if (!teacherId) {
      setManagerName('');
      setManagerPhone('');
      setManagerEmail('');
      return;
    }
    const matched = teachers.find(t => t.id === teacherId);
    if (matched) {
      setManagerName(matched.fullName);
      setManagerPhone(matched.phone || '');
      setManagerEmail(matched.email);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !address.trim()) {
      alert('يرجى إدخال اسم مركز التباري والعنوان');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        city: city.trim(),
        address: address.trim(),
        capacity: Number(capacity) || undefined,
        notes: notes.trim() || undefined,
        managerName: managerName.trim() || undefined,
        managerPhone: managerPhone.trim() || undefined,
        managerEmail: managerEmail.trim() || undefined
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {initialData ? 'تعديل مركز التباري / القاعة' : 'إضافة مركز تباري أو قاعة رياضية'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">تسجيل المنشآت والملاعب لاحتضان المنافسات الإقليمية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer animate-none"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم مركز التباري / الملعب *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: القاعة المغطاة للرياضات بتاوريرت"
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">المدينة / الجماعة</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="تاوريرت">تاوريرت</option>
                <option value="العيون سيدي ملوك">العيون سيدي ملوك</option>
                <option value="دبدو">دبدو</option>
                <option value="سيدي لحسن">سيدي لحسن</option>
                <option value="سيدي علي بلقاسم">سيدي علي بلقاسم</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الطاقة الاستيعابية (متفرجين)</label>
              <input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
                placeholder="1000"
                min="0"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">العنوان والموقع بالتفصيل *</label>
            <input
              type="text"
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="مثال: شارع الحسن الثاني، قرب المركب السوسيو رياضي"
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Section: Appoint Venue Head */}
          <div className="border-t border-slate-100 pt-3 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-800">
              <UserCheck className="h-4 w-4" />
              <span>تعيين رئيس مركز التباري (مسؤول القاعة/الملعب)</span>
            </div>

            {/* Quick Select from Teachers */}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">اختيار سريع من لائحة الأساتذة</label>
              <select
                value={selectedTeacherId}
                onChange={(e) => handleTeacherChange(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- اختر أستاذاً لملء معلومات المسؤول تلقائياً --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>
                    👨‍🏫 {t.fullName} ({t.workLocation || 'أستاذ'})
                  </option>
                ))}
              </select>
            </div>

            {/* Manual input / Overwrite */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">اسم رئيس المركز</label>
                <input
                  type="text"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  placeholder="الاسم الكامل لرئيس المركز"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">رقم الهاتف للاتصال</label>
                <input
                  type="text"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  placeholder="مثال: 0612345678"
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات ومواصفات المنشأة</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="نوع الأرضية (باركيه / عشب اصطناعي)، التجهيزات المتوفرة، مستودعات الملابس..."
              rows={2}
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
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
              {isSubmitting ? 'جاري الحفظ...' : initialData ? 'تحديث المركز' : 'إضافة مركز التباري'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
