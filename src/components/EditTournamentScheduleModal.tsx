import React, { useState, useEffect } from 'react';
import { Sport, Tournament } from '../types';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import { X, Calendar, Clock, ShieldCheck, Check, MapPin, FileText, Activity, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';

interface EditTournamentScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | null;
  tournaments: Tournament[];
  onUpdated: () => void;
}

export const EditTournamentScheduleModal: React.FC<EditTournamentScheduleModalProps> = ({
  isOpen,
  onClose,
  sport,
  tournaments,
  onUpdated
}) => {
  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2026-03-30');
  const [deadlineDate, setDeadlineDate] = useState('2026-02-28T23:59');
  const [selectedLevels, setSelectedLevels] = useState<('Primary' | 'Middle' | 'High')[]>(['High']);
  const [status, setStatus] = useState<Tournament['status']>('Scheduled');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to safely format dates
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
    if (sport && tournaments.length > 0) {
      const sportTournaments = tournaments.filter(t => t.sportId === sport.id);
      if (sportTournaments.length > 0) {
        const first = sportTournaments[0];
        
        if (first.startDate) {
          const sDate = formatDateToYMD(first.startDate);
          if (sDate) setStartDate(sDate);
        }
        if (first.endDate) {
          const eDate = formatDateToYMD(first.endDate);
          if (eDate) setEndDate(eDate);
        }
        if (first.registrationDeadline) {
          const dDate = formatDateToYMDHM(first.registrationDeadline);
          if (dDate) setDeadlineDate(dDate);
        }
        if (first.status) {
          setStatus(first.status);
        }
        if (first.description) {
          setDescription(first.description);
        }
        if (first.level) {
          const lvls = first.level.split(',').map((l: string) => l.trim()).filter(Boolean) as ('Primary' | 'Middle' | 'High')[];
          if (lvls.length > 0) setSelectedLevels(lvls);
        } else {
          setSelectedLevels(['High']);
        }
      }
    }
  }, [sport, tournaments, isOpen]);

  if (!isOpen || !sport) return null;

  const sportName = sport.name || SPORTS_MAP[sport.id]?.name || sport.id;
  const sportIcon = sport.icon || SPORTS_MAP[sport.id]?.icon || '🏆';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error('يرجى تحديد تاريخي انطلاق واختتام البطولة');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error('تاريخ انطلاق البطولة يجب أن يكون قبل أو نفس تاريخ الاختتام');
      return;
    }

    if (selectedLevels.length === 0) {
      toast.error('يرجى تحديد سلك تعليمي مسموح له بالمشاركة واحد على الأقل');
      return;
    }

    setIsSubmitting(true);
    try {
      await DataService.updateSportDates(sport.id, {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        registrationDeadline: deadlineDate ? new Date(deadlineDate) : null,
        status: status,
        description: description.trim(),
        level: selectedLevels.join(',')
      });

      toast.success(`تم تحديث تواريخ وضوابط بطولة ${sportName} بنجاح!`);
      onUpdated();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ التعديلات');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto" dir="rtl">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full flex flex-col overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150 relative z-[101]">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center text-xl font-black shrink-0 shadow-inner">
              {sportIcon}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                  تعديل وبرمجة التواريخ
                </span>
                <span className="text-[10px] text-slate-300 font-bold">
                  {status === 'Scheduled' ? 'مبرمجة ومجدولة' : status === 'Ongoing' ? 'جارية حالياً' : 'مكتملة'}
                </span>
              </div>
              <h3 className="text-base font-black text-white mt-0.5">
                برمجة بطولة {sportName}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[78vh] overflow-y-auto bg-slate-50/50">
          
          {/* Permissions note */}
          <div className="bg-blue-50/80 border border-blue-200/80 rounded-2xl p-3.5 text-xs text-blue-950 space-y-1 shadow-3xs">
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
              <span>صلاحيات رئيس اللجنة التقنية والمسؤول المركزي</span>
            </div>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              تتيح لك هذه النافذة ضبط وتعديل المواعيد الرسمية لانطلاق واختتام البطولة، وتحديد الأجل الأقصى لاستقبال تراخيص وتسجيلات المؤسسات التعليمية والتلاميذ مع تحديث العداد التفاعلي.
            </p>
          </div>

          {/* Start and End Dates */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-600" />
              <span>مواعيد وفترة إجراء البطولة المدرسية:</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تاريخ الانطلاق (البداية) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  تاريخ الاختتام (النهاية) <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
                />
              </div>
            </div>
          </div>

          {/* Registration Deadline & Countdown */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>آخر أجل لتسجيل التلاميذ والفرق (العداد التنازلي):</span>
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                إغلاق المنظومة
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                تاريخ وساعة الإغلاق النهائية <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={deadlineDate}
                onChange={(e) => setDeadlineDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 text-slate-800 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                عند انقضاء هذا التوقيت، يتعذر على الأساتذة المؤطرين إضافة تلاميذ جدد تلقائياً.
              </p>
            </div>
          </div>

          {/* Allowed Educational Cycles */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-indigo-600" />
              <span>الأسلاك التعليمية المسموح لها بالمشاركة:</span>
            </h4>

            <div className="space-y-1">
              <label className="block text-[11px] text-slate-500 mb-1.5">
                حدد السلك أو الأسلاك التعليمية المعنية بالتسجيل في هذه البطولة:
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {[
                  { id: 'Primary', label: 'التعليم الابتدائي' },
                  { id: 'Middle', label: 'التعليم الإعدادي' },
                  { id: 'High', label: 'التعليم التأهيلي' }
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
                      className={`flex-1 min-w-[120px] px-3 py-2.5 rounded-xl text-xs font-black text-center border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-3xs hover:bg-indigo-700'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tournament Status & Details */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-600" />
              <span>حالة البطولة وملاحظات البرمجة:</span>
            </h4>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                وضعية وحالة البطولة حالياً:
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2.5 text-slate-800 font-bold focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 focus:bg-white cursor-pointer"
              >
                <option value="Scheduled">🟢 مفتوحة للتسجيل (خضراء) - تسجيل المؤسسات والتلاميذ مفتوح لجميع الأطر والأساتذة</option>
                <option value="Ongoing">🔵 جارية (زرقاء) - متابعة البرمجة والمنافسات، مع إقفال التسجيل عن الأساتذة وإتاحته للمسؤول فقط</option>
                <option value="Completed">🏆 منتهية (ذهبية) - مغلقة نهائياً ومؤرشفة للنتائج والمعطيات</option>
                <option value="Draft">📝 مسودة قيد التعيين والتحضير</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-slate-500" />
                <span>ملاحظات أو توجيهات البرمجة الميدانية (اختياري):</span>
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="أدخل أي ملاحظات بخصوص القاعة المحتضنة، التوقيت، أو توجيهات للأساتذة..."
                className="w-full text-xs rounded-xl border border-slate-300 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 focus:bg-white resize-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md hover:scale-102 active:scale-98 disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وتطبيق التواريخ والبرمجة'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
