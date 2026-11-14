import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  RotateCcw,
  X,
  AlertTriangle,
  Trophy,
  CalendarX2,
  ShieldCheck,
  CheckCircle2,
  Filter,
  Loader2,
  Eraser
} from 'lucide-react';
import { Match, Sport, Tournament } from '../types';
import { DataService, SPORTS_MAP, normalizeCategoryKey } from '../lib/dataService';
import toast from 'react-hot-toast';

interface TournamentResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  sportsConfig: Sport[];
  tournaments: Tournament[];
  matches: Match[];
  isCentralAdmin: boolean;
  allowedSportIds: string[] | null; // null = unrestricted (Central Admin), string[] = Technical Committee Head scoped sports
  onResetComplete: () => Promise<void> | void;
}

type ResetActionKind =
  | 'ALL_MATCH_RESULTS'
  | 'SPECIFIC_TOURNAMENT_RESULTS'
  | 'ALL_SCHEDULED_MATCHES';

export const TournamentResetModal: React.FC<TournamentResetModalProps> = ({
  isOpen,
  onClose,
  sportsConfig,
  tournaments,
  matches,
  isCentralAdmin,
  allowedSportIds,
  onResetComplete
}) => {
  const isScopedToTechHead = !isCentralAdmin && Array.isArray(allowedSportIds);

  // Allowed sports list for dropdown & display
  const availableSports = useMemo(() => {
    const base = isScopedToTechHead
      ? sportsConfig.filter(s => allowedSportIds!.includes(s.id))
      : sportsConfig;

    // Sort programmed / sports-with-matches to the top
    return [...base].sort((a, b) => {
      const aCount = matches.filter(m => m.sportId === a.id).length;
      const bCount = matches.filter(m => m.sportId === b.id).length;
      if (aCount !== bCount) return bCount - aCount;
      const aProg = tournaments.some(t => t.sportId === a.id) ? 1 : 0;
      const bProg = tournaments.some(t => t.sportId === b.id) ? 1 : 0;
      return bProg - aProg;
    });
  }, [sportsConfig, matches, tournaments, isScopedToTechHead, allowedSportIds]);

  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('ALL');
  const [pendingConfirm, setPendingConfirm] = useState<ResetActionKind | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Sync default selectedSportId when modal opens or availableSports changes
  useEffect(() => {
    if (!isOpen) {
      setPendingConfirm(null);
      return;
    }
    if (availableSports.length > 0) {
      const stillValid = availableSports.some(s => s.id === selectedSportId);
      if (!stillValid) {
        setSelectedSportId(availableSports[0].id);
        setSelectedTournamentId('ALL');
      }
    } else {
      setSelectedSportId('');
      setSelectedTournamentId('ALL');
    }
  }, [isOpen, availableSports]);

  // Scoped matches according to user permissions
  const scopedMatches = useMemo(() => {
    if (!isScopedToTechHead) return matches;
    return matches.filter(m => allowedSportIds!.includes(m.sportId));
  }, [matches, isScopedToTechHead, allowedSportIds]);

  const scopedScoredMatchesCount = useMemo(() => {
    return scopedMatches.filter(
      m =>
        m.status === 'Completed' ||
        (m.score1 !== undefined && m.score1 !== null && m.score1 > 0) ||
        (m.score2 !== undefined && m.score2 !== null && m.score2 > 0) ||
        Boolean(m.winnerId)
    ).length;
  }, [scopedMatches]);

  // Branches (sub-tournaments) for the selected sport in Section 2
  const sportBranchTournaments = useMemo(() => {
    if (!selectedSportId) return [];
    return tournaments
      .filter(t => t.sportId === selectedSportId && t.status !== 'Archived')
      .sort((a, b) => {
        const affA = a.affiliationType === 'club_affiliated' ? 1 : 0;
        const affB = b.affiliationType === 'club_affiliated' ? 1 : 0;
        if (affA !== affB) return affA - affB;
        return (a.name || '').localeCompare(b.name || '', 'ar');
      });
  }, [tournaments, selectedSportId]);

  // Matches matching the selected sport & optional branch in Section 2
  const specificTargetMatches = useMemo(() => {
    if (!selectedSportId) return [];
    if (selectedTournamentId === 'ALL') {
      return scopedMatches.filter(m => m.sportId === selectedSportId);
    }
    const targetTourn = sportBranchTournaments.find(t => t.id === selectedTournamentId);
    return scopedMatches.filter(m => {
      if (m.tournamentId === selectedTournamentId) return true;
      if (!targetTourn) return false;
      return (
        m.sportId === targetTourn.sportId &&
        normalizeCategoryKey(m.ageCategory) === normalizeCategoryKey(targetTourn.ageCategory) &&
        (m.gender === targetTourn.gender || targetTourn.gender === 'Mixed') &&
        ((m as any).affiliationType || 'non_club') === (targetTourn.affiliationType || 'non_club')
      );
    });
  }, [scopedMatches, selectedSportId, selectedTournamentId, sportBranchTournaments]);

  const specificScoredCount = useMemo(() => {
    return specificTargetMatches.filter(
      m =>
        m.status === 'Completed' ||
        (m.score1 !== undefined && m.score1 !== null && m.score1 > 0) ||
        (m.score2 !== undefined && m.score2 !== null && m.score2 > 0) ||
        Boolean(m.winnerId)
    ).length;
  }, [specificTargetMatches]);

  const assignedSportNames = useMemo(() => {
    if (!isScopedToTechHead || !allowedSportIds) return [];
    return allowedSportIds.map(
      id => sportsConfig.find(s => s.id === id)?.name || SPORTS_MAP[id]?.name || id
    );
  }, [isScopedToTechHead, allowedSportIds, sportsConfig]);

  if (!isOpen) return null;

  const executeReset = async (action: ResetActionKind) => {
    if (isExecuting) return;
    if (isScopedToTechHead && (!allowedSportIds || allowedSportIds.length === 0)) {
      toast.error('لا توجد أي رياضة مسندة لحسابك لتصفير معطياتها.');
      return;
    }

    setIsExecuting(true);
    try {
      const scopeIds = isScopedToTechHead ? allowedSportIds : null;

      if (action === 'ALL_MATCH_RESULTS') {
        const res = await DataService.resetMatchResultsByScope({
          allowedSportIds: scopeIds
        });
        await onResetComplete();
        const extraParts: string[] = [];
        if (res.resetCrossCountry) extraParts.push('نتائج العدو الريفي');
        if (res.resetAthletics) extraParts.push('نتائج ألعاب القوى');
        const extraText = extraParts.length > 0 ? ` و${extraParts.join(' و')}` : '';
        toast.success(
          `تم تصفير نتائج المباريات بنجاح (${res.resetMatchesCount} مباراة${extraText}) مع الإبقاء على برنامج المباريات.`
        );
      } else if (action === 'SPECIFIC_TOURNAMENT_RESULTS') {
        if (!selectedSportId) {
          toast.error('يرجى اختيار البطولة / الرياضة المراد تصفير نتائجها');
          setIsExecuting(false);
          return;
        }
        const res = await DataService.resetMatchResultsByScope({
          allowedSportIds: scopeIds,
          sportId: selectedSportId,
          tournamentId: selectedTournamentId !== 'ALL' ? selectedTournamentId : undefined
        });
        await onResetComplete();
        const sportLabel =
          availableSports.find(s => s.id === selectedSportId)?.name ||
          SPORTS_MAP[selectedSportId]?.name ||
          selectedSportId;
        toast.success(
          `تم تصفير نتائج بطولة «${sportLabel}» بنجاح (${res.resetMatchesCount} مباراة).`
        );
      } else if (action === 'ALL_SCHEDULED_MATCHES') {
        const res = await DataService.clearScheduledMatchesByScope({
          allowedSportIds: scopeIds
        });
        await onResetComplete();
        toast.success(
          `تم تصفير ومسح جميع المباريات المبرمجة بنجاح (${res.deletedMatchesCount} مباراة).`
        );
      }

      setPendingConfirm(null);
    } catch (error: any) {
      console.error('Reset action error:', error);
      if (error?.message === 'UNAUTHORIZED_SPORT_RESET') {
        toast.error('غير مسموح لك بتصفير رياضة خارج تخصصك المسند.');
      } else {
        toast.error('حدث خطأ أثناء تنفيذ عملية التصفير');
      }
    } finally {
      setIsExecuting(false);
    }
  };

  const renderConfirmBar = (action: ResetActionKind, warningText: string) => {
    if (pendingConfirm !== action) return null;
    return (
      <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 space-y-2.5 animate-in fade-in duration-150">
        <div className="flex items-start gap-2 text-xs text-red-900 font-bold leading-relaxed">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span>{warningText}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={isExecuting}
            onClick={() => setPendingConfirm(null)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
          >
            تراجع
          </button>
          <button
            type="button"
            disabled={isExecuting}
            onClick={() => executeReset(action)}
            className="px-4 py-1.5 rounded-lg text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>جاري التصفير...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>تأكيد التصفير الآن</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-l from-rose-700 via-red-700 to-slate-900 text-white p-5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <RotateCcw className="w-6 h-6 text-rose-100" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black leading-tight">
                تصفير النتائج والمباريات المبرمجة
              </h2>
              <p className="text-xs text-rose-100/90 mt-0.5 font-medium">
                {isCentralAdmin
                  ? 'صلاحيات المسير المركزي — يشمل جميع الرياضات والبطولات المبرمجة'
                  : `صلاحيات رئيس اللجنة التقنية — خاص برياضتك فقط (${assignedSportNames.join('، ') || 'غير محددة'})`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto bg-slate-50/60 flex-1">
          {/* Role scope banner */}
          <div
            className={`p-3 rounded-2xl border flex items-center gap-2.5 text-xs font-bold ${
              isCentralAdmin
                ? 'bg-slate-100 border-slate-200 text-slate-800'
                : 'bg-amber-50 border-amber-200 text-amber-950'
            }`}
          >
            <ShieldCheck
              className={`w-4 h-4 shrink-0 ${isCentralAdmin ? 'text-slate-600' : 'text-amber-700'}`}
            />
            <span className="leading-relaxed">
              {isCentralAdmin
                ? 'تنطبق عمليات التصفير أدناه على معطيات المديرية الإقليمية النشطة حسب اختيارك (جميع البطولات أو بطولة محددة).'
                : `يتم تطبيق كافة خيارات التصفير بشكل حصري على رياضتك المسندة فقط (${assignedSportNames.join('، ')}) دون المساس بباقي الرياضات.`}
            </span>
          </div>

          {isScopedToTechHead && (!allowedSportIds || allowedSportIds.length === 0) ? (
            <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold">
              لا توجد أي رياضة مسندة لحسابك حالياً.
            </div>
          ) : (
            <>
              {/* Action 1: تصفير جميع نتائج المباريات */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <Eraser className="w-4 h-4" />
                      </span>
                      <h3 className="text-sm font-black text-slate-900">
                        1. تصفير جميع نتائج المباريات
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pr-10">
                      إرجاع جميع النتائج إلى (0 - 0) وحالة «مبرمجة» مع{' '}
                      <strong className="text-slate-800">الاحتفاظ ببرنامج المباريات والفرق والملاعب</strong>.
                      <span className="inline-block mr-1.5 text-[11px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                        {scopedScoredMatchesCount} نتيجة مسجلة / {scopedMatches.length} مباراة
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isExecuting || scopedMatches.length === 0}
                    onClick={() => setPendingConfirm('ALL_MATCH_RESULTS')}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تصفير جميع نتائج المباريات</span>
                  </button>
                </div>

                {renderConfirmBar(
                  'ALL_MATCH_RESULTS',
                  isCentralAdmin
                    ? `هل أنت متأكد من تصفير جميع نتائج المباريات (${scopedMatches.length} مباراة) عبر جميع الرياضات في المديرية؟ سيبقى جدول المباريات كما هو وتعاد النتائج إلى الصفر.`
                    : `هل أنت متأكد من تصفير جميع نتائج المباريات الخاصة برياضتك (${assignedSportNames.join('، ')}) وعددها ${scopedMatches.length} مباراة؟`
                )}
              </div>

              {/* Action 2: تصفير نتائج بطولة معينة */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                    <Trophy className="w-4 h-4" />
                  </span>
                  <div>
                    <h3 className="text-sm font-black text-slate-900">
                      2. تصفير نتائج بطولة معينة
                    </h3>
                    <p className="text-xs text-slate-600">
                      اختر الرياضة (والفرع إذا أردت) لتصفير نتائجها فقط دون المساس بالبطولات الأخرى.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      البطولة / الرياضة:
                    </label>
                    <select
                      value={selectedSportId}
                      onChange={e => {
                        setSelectedSportId(e.target.value);
                        setSelectedTournamentId('ALL');
                        if (pendingConfirm === 'SPECIFIC_TOURNAMENT_RESULTS') {
                          setPendingConfirm(null);
                        }
                      }}
                      className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {availableSports.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.icon || '🏆'} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1">
                      <Filter className="w-3 h-3 text-slate-500" />
                      <span>الفرع / الفئة (اختياري):</span>
                    </label>
                    <select
                      value={selectedTournamentId}
                      onChange={e => {
                        setSelectedTournamentId(e.target.value);
                        if (pendingConfirm === 'SPECIFIC_TOURNAMENT_RESULTS') {
                          setPendingConfirm(null);
                        }
                      }}
                      className="w-full text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ALL">جميع فروع وأصناف هذه البطولة</option>
                      {sportBranchTournaments.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.affiliationType === 'club_affiliated' ? '🟡 ' : '⚪ '}
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] font-bold text-slate-600">
                    المباريات المشمولة بهذا التحديد:{' '}
                    <strong className="text-blue-700">
                      {specificScoredCount} نتيجة مسجلة / {specificTargetMatches.length} مباراة
                    </strong>
                  </span>

                  <button
                    type="button"
                    disabled={
                      isExecuting ||
                      !selectedSportId ||
                      (specificTargetMatches.length === 0 &&
                        selectedSportId !== 'cross_country' &&
                        selectedSportId !== 'athletics')
                    }
                    onClick={() => setPendingConfirm('SPECIFIC_TOURNAMENT_RESULTS')}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تصفير نتائج هذه البطولة</span>
                  </button>
                </div>

                {renderConfirmBar(
                  'SPECIFIC_TOURNAMENT_RESULTS',
                  `هل أنت متأكد من تصفير نتائج «${
                    availableSports.find(s => s.id === selectedSportId)?.name || selectedSportId
                  }»${
                    selectedTournamentId !== 'ALL'
                      ? ` (${
                          sportBranchTournaments.find(t => t.id === selectedTournamentId)?.name || ''
                        })`
                      : ''
                  }؟`
                )}
              </div>

              {/* Action 3: تصفير جميع المباريات المبرمجة */}
              <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-2xs space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                        <CalendarX2 className="w-4 h-4" />
                      </span>
                      <h3 className="text-sm font-black text-rose-950">
                        3. تصفير جميع المباريات المبرمجة
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed pr-10">
                      حذف ومسح جميع المباريات المبرمجة بالكامل لإعادة برمجة القرعة والمواجهات من جديد.
                      <span className="inline-block mr-1.5 text-[11px] font-black text-rose-800 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200">
                        {scopedMatches.length} مباراة مبرمجة
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={isExecuting || scopedMatches.length === 0}
                    onClick={() => setPendingConfirm('ALL_SCHEDULED_MATCHES')}
                    className="px-4 py-2 rounded-xl text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition-all cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <CalendarX2 className="w-3.5 h-3.5" />
                    <span>تصفير جميع المباريات المبرمجة</span>
                  </button>
                </div>

                {renderConfirmBar(
                  'ALL_SCHEDULED_MATCHES',
                  isCentralAdmin
                    ? `تحذير: سيتم حذف جميع المباريات المبرمجة (${scopedMatches.length} مباراة) عبر جميع الرياضات في المديرية نهائياً لإعادة القرعة من الصفر. هل تريد المتابعة؟`
                    : `تحذير: سيتم حذف جميع المباريات المبرمجة الخاصة برياضتك (${assignedSportNames.join('، ')}) وعددها ${scopedMatches.length} مباراة نهائياً. هل تريد المتابعة؟`
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 bg-white border-t border-slate-200 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
