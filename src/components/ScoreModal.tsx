import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Match, School, Venue } from '../types';
import { X, CheckCircle2, ShieldAlert, Plus, Minus, Database, Megaphone, CalendarClock, ShieldCheck } from 'lucide-react';
import { SPORTS_MAP, GENDER_MAP, canUserApproveSportResult } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';

interface ScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: Match | null;
  schools: School[];
  venues?: Venue[];
  canApprove?: boolean;
  currentUserName?: string;
  onNotifySchedule?: (match: Match) => void;
  onNotifyApprovedResult?: (
    match: Match,
    score1: number,
    score2: number,
    extras: {
      penalty1?: number;
      penalty2?: number;
      winnerId?: string;
      notes?: string;
      scorers?: string;
      approvalStatus?: 'provisional' | 'approved';
      approvedByName?: string;
      approvedAt?: string;
    }
  ) => void;
  onSave: (
    matchId: string,
    score1: number,
    score2: number,
    status: Match['status'],
    extras?: {
      penalty1?: number;
      penalty2?: number;
      winnerId?: string;
      notes?: string;
      scorers?: string;
      approvalStatus?: 'provisional' | 'approved';
      recordedByName?: string;
      recordedByRole?: string;
      approvedByName?: string;
      approvedAt?: string;
    }
  ) => Promise<void>;
}

export const ScoreModal: React.FC<ScoreModalProps> = ({
  isOpen,
  onClose,
  match,
  schools,
  canApprove,
  currentUserName,
  onNotifySchedule,
  onNotifyApprovedResult,
  onSave
}) => {
  const { userProfile } = useAuth();
  const [score1, setScore1] = useState<number>(0);
  const [score2, setScore2] = useState<number>(0);
  const [penalty1, setPenalty1] = useState<number | undefined>(undefined);
  const [penalty2, setPenalty2] = useState<number | undefined>(undefined);
  const [showPenalties, setShowPenalties] = useState<boolean>(false);
  const [status, setStatus] = useState<Match['status']>('Completed');
  const [notes, setNotes] = useState<string>('');
  const [scorers, setScorers] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen && match) {
      setScore1(match.score1 ?? match.team1Score ?? 0);
      setScore2(match.score2 ?? match.team2Score ?? 0);
      setPenalty1(match.penalty1);
      setPenalty2(match.penalty2);
      setShowPenalties(match.penalty1 !== undefined || match.penalty2 !== undefined);
      setStatus(match.status === 'Scheduled' ? 'Completed' : (match.status || 'Completed'));
      setNotes(match.notes || '');
      setScorers(match.scorers || '');
    }
  }, [isOpen, match]);

  if (!isOpen || !match) return null;

  const effectiveCanApprove =
    canApprove !== undefined
      ? canApprove
      : canUserApproveSportResult(userProfile, match.sportId);

  const actorName =
    currentUserName ||
    userProfile?.fullName ||
    userProfile?.email ||
    (effectiveCanApprove ? 'رئيس اللجنة التقنية' : 'حكم المقابلة');

  const team1 = schools.find(s => s.id === match.team1Id)?.name || match.team1Name || 'المؤسسة 1';
  const team2 = schools.find(s => s.id === match.team2Id)?.name || match.team2Name || 'المؤسسة 2';
  const sportInfo = SPORTS_MAP[match.sportId] || { name: 'الرياضة', icon: '🏆' };
  const genderInfo = match.gender ? GENDER_MAP[match.gender] : undefined;

  const isBasketball = match.sportId === 'basketball';

  const adjustScore1 = (delta: number) => {
    setScore1(prev => Math.max(0, prev + delta));
  };

  const adjustScore2 = (delta: number) => {
    setScore2(prev => Math.max(0, prev + delta));
  };

  const buildWinnerAndExtras = (finalStatus: Match['status']) => {
    let winnerId: string | undefined = undefined;
    if (score1 > score2) {
      winnerId = match.team1Id;
    } else if (score2 > score1) {
      winnerId = match.team2Id;
    } else if (showPenalties && penalty1 !== undefined && penalty2 !== undefined) {
      if (penalty1 > penalty2) winnerId = match.team1Id;
      else if (penalty2 > penalty1) winnerId = match.team2Id;
    }

    const isCompletedStatus = finalStatus === 'Completed';
    const approvalFields = isCompletedStatus
      ? effectiveCanApprove
        ? {
            approvalStatus: 'approved' as const,
            approvedByName: actorName,
            approvedAt: new Date().toISOString()
          }
        : {
            approvalStatus: 'provisional' as const,
            recordedByName: actorName,
            recordedByRole: userProfile?.role || 'REFEREE'
          }
      : {};

    return {
      penalty1: showPenalties && penalty1 !== undefined ? Number(penalty1) : undefined,
      penalty2: showPenalties && penalty2 !== undefined ? Number(penalty2) : undefined,
      winnerId,
      notes: notes.trim() || undefined,
      scorers: scorers.trim() || undefined,
      ...approvalFields
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const extras = buildWinnerAndExtras(status);
    try {
      await onSave(match.id, Number(score1), Number(score2), status, extras);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveAndNotify = async () => {
    if (!effectiveCanApprove) return;
    setIsSubmitting(true);
    const finalStatus: Match['status'] = 'Completed';
    const extras = buildWinnerAndExtras(finalStatus);
    try {
      await onSave(match.id, Number(score1), Number(score2), finalStatus, extras);
      const updatedMatch: Match = {
        ...match,
        score1: Number(score1),
        score2: Number(score2),
        team1Score: Number(score1),
        team2Score: Number(score2),
        status: finalStatus,
        ...extras
      };
      onClose();
      if (onNotifyApprovedResult) {
        onNotifyApprovedResult(updatedMatch, Number(score1), Number(score2), extras);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150 relative z-[151]">
        {/* Header */}
        <div className={`flex items-center justify-between p-4 md:p-5 border-b border-slate-200 text-white shrink-0 ${
          effectiveCanApprove
            ? 'bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900'
            : 'bg-gradient-to-r from-amber-700 via-amber-800 to-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 text-white flex items-center justify-center shadow-inner text-xl">
              {sportInfo.icon}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs md:text-sm font-black text-white">
                  {effectiveCanApprove ? 'تسجيل والمصادقة على النتيجة النهائية' : 'تدوين النتيجة الأولية للمقابلة'}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-white/15 text-white border border-white/25 rounded-md">
                  {sportInfo.name}
                </span>
              </div>
              <p className="text-[11px] text-white/80 font-medium mt-0.5">
                {match.stage || 'مباراة رسمية'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-white/80 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category, Gender & Schedule Notify Quick Action Bar */}
        <div className="bg-slate-100/90 px-4 py-2 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200">
              🏷️ {match.ageCategory || 'غير محددة'}
            </span>
            {genderInfo && (
              <span className={`font-bold px-2 py-0.5 rounded border text-[11px] ${genderInfo.badgeClass}`}>
                {genderInfo.icon} {genderInfo.name}
              </span>
            )}
          </div>
          {onNotifySchedule && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onNotifySchedule(match);
              }}
              className="px-2.5 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[11px] font-black flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
              title="إشعار المعنيين بتاريخ وساعة ومكان برمجة المقابلة عبر واتساب"
            >
              <CalendarClock className="w-3.5 h-3.5" />
              <span>إشعار المعنيين ببرمجة المقابلة</span>
            </button>
          )}
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
          {/* Provisional vs Homologation Role Banner */}
          {!effectiveCanApprove ? (
            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl flex items-start gap-2.5 text-xs text-amber-950">
              <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-black">نتيجة أولية (حكم المقابلة):</span> ستظهر النتيجة المدونة كـ{' '}
                <span className="underline font-black">نتيجة أولية</span> إلى حين المصادقة النهائية عليها من طرف رئيس اللجنة التقنية المختص أو المسير المركزي.
              </div>
            </div>
          ) : match.approvalStatus === 'provisional' ? (
            <div className="p-3 bg-blue-50 border border-blue-300 rounded-xl flex items-start gap-2.5 text-xs text-blue-950">
              <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="font-black">نتيجة أولية في انتظار مصادقتكم:</span> تم تدوين هذه النتيجة من طرف{' '}
                <span className="font-black">{match.recordedByName || 'حكم المقابلة'}</span>. اضغط على زر المصادقة أدناه لاعتمادها رسمياً وإخبار المعنيين بها.
              </div>
            </div>
          ) : null}

          {/* Main Score Board */}
          <div className="bg-gradient-to-b from-slate-50 to-slate-100/60 p-4 rounded-2xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-5 items-center gap-2">
              {/* Team 1 */}
              <div className={`col-span-2 text-center p-2.5 sm:p-3 rounded-xl border transition-all ${
                score1 > score2 ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200' : 'bg-white border-slate-200'
              }`}>
                <p className="text-xs font-bold text-slate-800 line-clamp-2 min-h-[32px] mb-2">{team1}</p>
                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustScore1(-1)}
                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={score1}
                    onChange={(e) => setScore1(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 sm:w-16 h-11 sm:h-12 text-center text-xl sm:text-2xl font-black bg-white border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => adjustScore1(1)}
                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isBasketball && (
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <button type="button" onClick={() => adjustScore1(2)} className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 cursor-pointer">+2</button>
                    <button type="button" onClick={() => adjustScore1(3)} className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 cursor-pointer">+3</button>
                  </div>
                )}

                {score1 > score2 && (
                  <span className="inline-block mt-2 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    👑 الفريق الفائز
                  </span>
                )}
              </div>

              {/* VS Divider */}
              <div className="col-span-1 text-center">
                <span className="inline-block px-2 py-1 text-xs font-black text-slate-400 bg-slate-200/80 rounded-full">
                  VS
                </span>
                {score1 === score2 && (
                  <p className="text-[10px] font-bold text-amber-600 mt-1">تعادل</p>
                )}
              </div>

              {/* Team 2 */}
              <div className={`col-span-2 text-center p-2.5 sm:p-3 rounded-xl border transition-all ${
                score2 > score1 ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-200' : 'bg-white border-slate-200'
              }`}>
                <p className="text-xs font-bold text-slate-800 line-clamp-2 min-h-[32px] mb-2">{team2}</p>
                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustScore2(-1)}
                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    value={score2}
                    onChange={(e) => setScore2(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-14 sm:w-16 h-11 sm:h-12 text-center text-xl sm:text-2xl font-black bg-white border-2 border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => adjustScore2(1)}
                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isBasketball && (
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <button type="button" onClick={() => adjustScore2(2)} className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 cursor-pointer">+2</button>
                    <button type="button" onClick={() => adjustScore2(3)} className="text-[10px] font-bold px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 cursor-pointer">+3</button>
                  </div>
                )}

                {score2 > score1 && (
                  <span className="inline-block mt-2 text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    👑 الفريق الفائز
                  </span>
                )}
              </div>
            </div>

            {/* Penalties / Tie-breaker Toggle */}
            <div className="pt-2 border-t border-slate-200/70">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowPenalties(!showPenalties)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
                >
                  <span>{showPenalties ? '− إخفاء ركلات الترجيح / الأشواط الإضافية' : '+ إضافة ركلات الترجيح (في حالة التعادل)'}</span>
                </button>
              </div>

              {showPenalties && (
                <div className="grid grid-cols-2 gap-3 mt-2.5 p-3 bg-white rounded-xl border border-blue-100">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      ركلات {team1}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={penalty1 ?? ''}
                      onChange={(e) => setPenalty1(e.target.value === '' ? undefined : parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full text-xs rounded-lg border border-slate-200 p-2 text-center font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      ركلات {team2}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={penalty2 ?? ''}
                      onChange={(e) => setPenalty2(e.target.value === '' ? undefined : parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full text-xs rounded-lg border border-slate-200 p-2 text-center font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Status Selection */}
          <div className="space-y-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">حالة المقابلة</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                <option value="Completed">
                  {effectiveCanApprove
                    ? '✅ انتهت المقابلة (المصادقة وتثبيت النتيجة النهائية)'
                    : '⏳ انتهت المقابلة (حفظ كـ نتيجة أولية في انتظار المصادقة)'}
                </option>
                <option value="Ongoing">⏱️ جارية حالياً (تحديث النتيجة المؤقتة مباشرة)</option>
                <option value="Scheduled">🗓️ مبرمجة (لم تنطلق بعد)</option>
                <option value="Postponed">⏸️ مؤجلة</option>
                <option value="Cancelled">❌ ملغاة</option>
              </select>
            </div>
          </div>

          {/* Scorers / Highlights */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">مسجلو الأهداف أو النقاط (اختياري)</label>
            <input
              type="text"
              value={scorers}
              onChange={(e) => setScorers(e.target.value)}
              placeholder="مثال: أحمد ب. (د 23)، يوسف ع. (د 68)"
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Technical Notes / Report */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات الحكام والتقرير التقني (اختياري)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أي ملاحظات حول التحكيم أو الروح الرياضية أو القرارات التقنية..."
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          {/* Database Synchronization Notice */}
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-2 text-[11px] text-slate-700">
            <Database className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>
              {effectiveCanApprove
                ? 'بعد المصادقة على النتيجة النهائية، يمكنك إخبار المؤطرين ومديري وأساتذة المؤسستين عبر الواتساب بضغطة زر.'
                : 'سيتم حفظ النتيجة كـ "نتيجة أولية" ليطلع عليها رئيس اللجنة التقنية والمسير المركزي للمصادقة عليها.'}
            </span>
          </div>

          {/* Footer Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer order-3 sm:order-1"
            >
              إلغاء
            </button>

            {effectiveCanApprove && onNotifyApprovedResult && (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleApproveAndNotify}
                className="px-4 py-2.5 text-xs font-black text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 active:scale-95 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 order-1 sm:order-2"
              >
                <Megaphone className="h-4 w-4 shrink-0" />
                <span>مصادقة وإخبار المعنيين بالنتيجة</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-4 py-2.5 text-xs font-black text-white active:scale-95 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 order-2 sm:order-3 ${
                effectiveCanApprove
                  ? 'bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/20'
                  : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
              }`}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>
                {isSubmitting
                  ? 'جاري الحفظ...'
                  : effectiveCanApprove
                  ? 'مصادقة وحفظ النتيجة'
                  : 'حفظ كـ نتيجة أولية'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
