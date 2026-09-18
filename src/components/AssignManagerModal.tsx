import React, { useState, useEffect } from 'react';
import { Tournament } from '../types';
import { X, UserCheck, KeyRound, Phone, Mail, RefreshCw, Copy, Check, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface AssignManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  tournament: Tournament | null;
  onSave: (tournamentId: string, data: { managerName?: string; managerPhone?: string; managerEmail?: string; accessCode?: string }) => Promise<void>;
}

export const AssignManagerModal: React.FC<AssignManagerModalProps> = ({
  isOpen,
  onClose,
  tournament,
  onSave
}) => {
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (tournament) {
      setManagerName(tournament.managerName || '');
      setManagerPhone(tournament.managerPhone || '');
      setManagerEmail(tournament.managerEmail || '');
      setAccessCode(tournament.accessCode || `TR-${Math.floor(1000 + Math.random() * 9000)}`);
    }
  }, [tournament]);

  if (!isOpen || !tournament) return null;

  const generateNewCode = () => {
    const prefixes: Record<string, string> = {
      football: 'FB',
      futsal: 'FT',
      handball: 'HB',
      volleyball: 'VB',
      basketball: 'BB',
      athletics: 'ATH',
      table_tennis: 'TT',
      chess: 'CH'
    };
    const prefix = prefixes[tournament.sportId] || 'TR';
    const rand = Math.floor(1000 + Math.random() * 9000);
    setAccessCode(`${prefix}-${rand}`);
    toast.success('تم توليد قن سري جديد');
  };

  const handleCopyCredentials = () => {
    const message = `السلام عليكم ذ. ${managerName || 'مسؤول البطولة'},\nتم تعيينكم للإشراف على: ${tournament.name}\nالقن السري للولوج وإدارة المباريات: ${accessCode}\nالرابط: https://sport-taourirt.ma`;
    navigator.clipboard.writeText(message);
    setCopied(true);
    toast.success('تم نسخ بيانات الولوج بنجاح لمشاركتها مع المسؤول!');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onSave(tournament.id, {
        managerName: managerName.trim() || undefined,
        managerPhone: managerPhone.trim() || undefined,
        managerEmail: managerEmail.trim() || undefined,
        accessCode: accessCode.trim() || undefined
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">تخصيص مسؤول البطولة والقن السري</h3>
              <p className="text-[11px] text-slate-500 font-medium truncate max-w-xs">{tournament.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4">
          <div className="bg-blue-50/70 border border-blue-100 rounded-xl p-3 text-xs text-blue-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-600" />
              <span>تخصيص مسؤول البطولة وحفظ حسابه في Firebase</span>
            </p>
            <p className="text-[11px] text-blue-800/80 leading-relaxed">
              عند حفظ البريد الإلكتروني، يتم تسجيل حساب المسؤول تلقائياً في قاعدة البيانات السحابية (Firebase)، لتمكينه من تسجيل الدخول مباشرة ببريده مع القن السري ككلمة مرور، أو عبر حسابه في Google.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              اسم الأستاذ / المشرف على البطولة <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="مثال: ذ. عبد الرحيم بلقاسم (أستاذ التربية البدنية)"
                value={managerName}
                onChange={(e) => setManagerName(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 pl-3 pr-9 py-2.5 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <UserCheck className="h-4 w-4 text-slate-400 absolute right-3 top-3" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف (للتواصل السريع)
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="06XXXXXXXX"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 pl-3 pr-9 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Phone className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                البريد الإلكتروني المهني
              </label>
              <div className="relative">
                <input
                  type="email"
                  placeholder="prof@taourirt.ma"
                  value={managerEmail}
                  onChange={(e) => setManagerEmail(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 pl-3 pr-9 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <Mail className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-2.5" />
              </div>
            </div>
          </div>

          {/* Access Code / PIN Box */}
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <KeyRound className="h-4 w-4 text-amber-700" />
                <span>القن السري للبطولة (Tournament Access PIN)</span>
              </label>
              <button
                type="button"
                onClick={generateNewCode}
                className="text-[10px] text-amber-800 hover:text-amber-950 font-bold flex items-center gap-1 bg-amber-100/80 px-2 py-1 rounded cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>توليد قن جديد</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                className="w-full text-sm font-mono font-black tracking-widest text-center text-amber-950 bg-white border-2 border-amber-300 rounded-lg py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={handleCopyCredentials}
                title="نسخ الرسالة والمعلومات"
                className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shrink-0 shadow-xs cursor-pointer"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copied ? 'تم النسخ' : 'نسخ ومشاركة'}</span>
              </button>
            </div>
            <p className="text-[10px] text-amber-800 font-medium">
              يستعمل المسؤول هذا القن للولوج المباشر وتثبيت محاضر المباريات والنتائج دون الحاجة لبيانات معقدة.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
              {isSubmitting ? 'جاري الحفظ...' : 'تأكيد وحفظ التخصيص'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
