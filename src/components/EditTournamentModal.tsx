import React, { useState, useEffect } from 'react';
import { Tournament, Sport } from '../types';
import { DataService, SPORTS_MAP, getAgeCategoriesForSeason } from '../lib/dataService';
import { X, Trophy, Calendar, Clock, User, ShieldCheck, Check, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onUpdated: () => void;
}

export const EditTournamentModal: React.FC<EditTournamentModalProps> = ({
  isOpen,
  onClose,
  tournament,
  onUpdated
}) => {
  const [name, setName] = useState('');
  const [sportId, setSportId] = useState('football');
  const [ageCategory, setAgeCategory] = useState('U15');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Mixed'>('Male');
  const [affiliationType, setAffiliationType] = useState<'non_club' | 'club_affiliated' | 'open'>('non_club');
  const [selectedLevels, setSelectedLevels] = useState<('Primary' | 'Middle' | 'High')[]>(['High']);
  const [scope, setScope] = useState('Provincial');
  const [status, setStatus] = useState<Tournament['status']>('Scheduled');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);

  // Format date helper
  const formatDateToYMD = (dateVal: any): string => {
    if (!dateVal) return '';
    let d: Date;
    if (typeof dateVal === 'object' && 'toDate' in dateVal) {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const formatDateToYMDHM = (dateVal: any): string => {
    if (!dateVal) return '';
    let d: Date;
    if (typeof dateVal === 'object' && 'toDate' in dateVal) {
      d = dateVal.toDate();
    } else {
      d = new Date(dateVal);
    }
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  useEffect(() => {
    if (isOpen) {
      DataService.getSportsConfig().then(config => setSportsConfig(config)).catch(console.error);
    }
  }, [isOpen]);

  useEffect(() => {
    if (tournament && isOpen) {
      setName(tournament.name || '');
      setSportId(tournament.sportId || 'football');
      setAgeCategory(tournament.ageCategory || 'U15');
      setGender(tournament.gender || 'Male');
      setAffiliationType((tournament.affiliationType as any) || 'non_club');
      
      if (tournament.level) {
        const lvls = tournament.level.split(',').map((l: string) => l.trim()).filter(Boolean) as ('Primary' | 'Middle' | 'High')[];
        if (lvls.length > 0) setSelectedLevels(lvls);
      } else {
        setSelectedLevels(['High']);
      }

      setScope(tournament.scope || 'Provincial');
      setStatus(tournament.status || 'Scheduled');
      setStartDate(formatDateToYMD(tournament.startDate));
      setEndDate(formatDateToYMD(tournament.endDate));
      setRegistrationDeadline(formatDateToYMDHM(tournament.registrationDeadline));
      setManagerName(tournament.managerName || '');
      setManagerPhone(tournament.managerPhone || '');
      setDescription(tournament.description || '');
    }
  }, [tournament, isOpen]);

  if (!isOpen || !tournament) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('يرجى إدخال اسم البطولة');
      return;
    }

    setIsSubmitting(true);
    try {
      await DataService.updateTournament(tournament.id, {
        name: name.trim(),
        sportId,
        ageCategory,
        gender,
        affiliationType,
        level: selectedLevels.join(','),
        scope,
        status,
        startDate: startDate ? new Date(startDate) : tournament.startDate,
        endDate: endDate ? new Date(endDate) : tournament.endDate,
        registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : tournament.registrationDeadline,
        managerName: managerName.trim(),
        managerPhone: managerPhone.trim(),
        description: description.trim()
      });

      toast.success('تمت تحديث وتعديل بيانات البطولة بنجاح!');
      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ تعديلات البطولة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto dir-rtl">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-xl backdrop-blur-xs border border-white/20">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-black">تعديل بيانات البطولة الإقليمية</h3>
              <p className="text-xs text-blue-200">تعديل التسمية، الفئة، التواريخ ونوع المشاركة (مسؤول مركزي)</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Tournament Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم البطولة الإقليمية</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sport selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الرياضة المدرسية</label>
              <select
                value={sportId}
                onChange={(e) => setSportId(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {sportsConfig.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.icon || '🏆'} {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Educational Cycles */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الأسلاك التعليمية المعنية *
              </label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {[
                  { id: 'Primary', label: 'ابتدائي' },
                  { id: 'Middle', label: 'إعدادي' },
                  { id: 'High', label: 'تأهيلي' }
                ].map((item) => {
                  const isSelected = selectedLevels.includes(item.id as any);
                  return (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        setSelectedLevels(prev =>
                          prev.includes(item.id as any)
                            ? (prev.length > 1 ? prev.filter(x => x !== item.id) : prev)
                            : [...prev, item.id as any]
                        );
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white shadow-3xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Affiliation Type */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نوع البطولة والانتساب</label>
              <select
                value={affiliationType}
                onChange={(e) => setAffiliationType(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="non_club">⚪ بطولة غير المنتمين للأندية (البطاقة البيضاء)</option>
                <option value="club_affiliated">🟡 بطولة المنتمين للأندية والجمعيات (البطاقة الصفراء)</option>
                <option value="open">🟢 بطولة مفتوحة (للجميع)</option>
              </select>
            </div>

            {/* Scope selection */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">نطاق البطولة</label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Provincial">إقليمية (المديرية)</option>
                <option value="Regional">جهوية (الأكاديمية)</option>
                <option value="National">وطنية (الوزارة)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Age Category */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الفئة العمرية</label>
              <input
                type="text"
                value={ageCategory}
                onChange={(e) => setAgeCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="مثال: U15 / الصغار"
              />
            </div>

            {/* Gender */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الجنس</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Male">👦 ذكور</option>
                <option value="Female">👧 إناث</option>
                <option value="Mixed">👥 مختلط / الجميع</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">حالة البطولة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="Scheduled">📅 مبرمجة</option>
                <option value="Ongoing">🔴 جارية الآن</option>
                <option value="Completed">🏆 منتهية</option>
                <option value="Draft">⚪ قيد الإعداد</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ الإنطلاق</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ الاختتام</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-amber-800 mb-1">آخر أجل للتسجيل</label>
              <input
                type="datetime-local"
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-bold border border-amber-300 bg-amber-50 rounded-lg focus:outline-none text-amber-900"
              />
            </div>
          </div>

          {/* Manager Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اسم المشرف / رئيس اللجنة</label>
              <input
                type="text"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none"
                placeholder="اسم الأستاذ/المسؤول المشرف"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف التواصل</label>
              <input
                type="text"
                value={managerPhone}
                onChange={(e) => setManagerPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-xl focus:outline-none"
                placeholder="06XXXXXXXX"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات وضوابط تنظيمية</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-xs font-medium border border-slate-300 rounded-xl focus:outline-none"
              placeholder="أي معلومات إضافية عن البطولة..."
            />
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
