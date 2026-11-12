import React, { useState, useRef, useEffect, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { DataService } from '../lib/dataService';

export interface ConfirmedParticipationBadgeProps {
  sportId: string;
  sportName: string;
  schoolId?: string;
  schoolName: string;
  onCancelSuccess?: () => void;
  onClick?: (e: React.MouseEvent) => void;
  className?: string;
  variant?: 'light' | 'dark'; // 'light' for white/colored cards, 'dark' for dark cards (e.g. cross country)
  count?: number;
  label?: string; // default: "مؤكدة ✓"
}

/**
 * ConfirmedParticipationBadge
 * A reusable badge that displays "مؤكدة ✓" and supports:
 * - Normal click: opens details / modal (via onClick)
 * - Long press (3 seconds): visually fills a progress ring/bar and cancels confirmation across all tournament branches
 */
export const ConfirmedParticipationBadge: React.FC<ConfirmedParticipationBadgeProps> = ({
  sportId,
  sportName,
  schoolId,
  schoolName,
  onCancelSuccess,
  onClick,
  className = '',
  variant = 'light',
  count,
  label = 'مؤكدة ✓'
}) => {
  const [progress, setProgress] = useState(0); // 0 to 100
  const [isPressing, setIsPressing] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const pressTimerRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const didTriggerCancelRef = useRef<boolean>(false);

  const LONG_PRESS_DURATION = 3000; // 3 seconds

  const executeCancel = useCallback(async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    const toastId = toast.loading(`جاري إلغاء مشاركة ${schoolName} في جميع فروع بطولة ${sportName}...`);
    try {
      await DataService.cancelSchoolConfirmation(sportId, schoolId || schoolName);
      toast.dismiss(toastId);
      toast.success(`تم إلغاء المشاركة في جميع فروع بطولة ${sportName} بنجاح ✓`, {
        duration: 4500,
        icon: '🗑️'
      });
      if (onCancelSuccess) {
        onCancelSuccess();
      }
    } catch (err) {
      console.error('Error cancelling confirmation on long press:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء إلغاء المشاركة');
    } finally {
      setIsCancelling(false);
      setProgress(0);
      setIsPressing(false);
    }
  }, [sportId, sportName, schoolId, schoolName, onCancelSuccess, isCancelling]);

  const clearTimers = useCallback(() => {
    if (pressTimerRef.current) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const handleStart = (e: React.SyntheticEvent) => {
    // Avoid starting if already cancelling
    if (isCancelling) return;
    didTriggerCancelRef.current = false;
    setIsPressing(true);
    startTimeRef.current = Date.now();
    setProgress(0);

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, Math.round((elapsed / LONG_PRESS_DURATION) * 100));
      setProgress(pct);

      if (elapsed < LONG_PRESS_DURATION) {
        animationFrameRef.current = window.requestAnimationFrame(updateProgress);
      } else {
        // Trigger cancel!
        didTriggerCancelRef.current = true;
        clearTimers();
        executeCancel();
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(updateProgress);
  };

  const handleEnd = (e: React.SyntheticEvent) => {
    clearTimers();
    const wasPressing = isPressing;
    setIsPressing(false);
    setProgress(0);

    // If long press triggered cancellation, stop propagation and do not trigger normal click
    if (didTriggerCancelRef.current) {
      e.preventDefault();
      e.stopPropagation();
      didTriggerCancelRef.current = false;
      return;
    }

    // If user released quickly (regular click < 500ms)
    const elapsed = Date.now() - startTimeRef.current;
    if (wasPressing && elapsed < 500 && onClick) {
      onClick(e as any);
    }
  };

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const isDark = variant === 'dark';

  return (
    <button
      type="button"
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
      disabled={isCancelling}
      title="اضغط ضغطة عادية للتفاصيل، أو اضغط مطولاً لمدة 3 ثوانٍ لإلغاء المشاركة في جميع فروع البطولة"
      className={`relative select-none overflow-hidden transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
        isDark
          ? isPressing
            ? 'bg-red-500/30 text-red-100 border-red-400 ring-2 ring-red-400/50 scale-[0.98]'
            : 'bg-emerald-500/25 hover:bg-emerald-500/35 text-emerald-200 border-emerald-400/40'
          : isPressing
          ? 'bg-red-50 text-red-700 border-red-300 ring-2 ring-red-300 scale-[0.98]'
          : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
      } border font-black text-[11px] rounded-xl px-2.5 py-2 shrink-0 ${className}`}
    >
      {/* Dynamic 3-second Progress Fill overlay */}
      {isPressing && (
        <span
          className="absolute inset-y-0 right-0 bg-red-500/30 transition-all duration-75 pointer-events-none"
          style={{ width: `${progress}%` }}
        />
      )}

      {/* Button Content */}
      <span className="relative z-10 flex items-center gap-1.5">
        {isCancelling ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-red-500" />
            <span className="text-[10px]">جاري الإلغاء...</span>
          </>
        ) : isPressing ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
            <span className="font-extrabold text-[10.5px] text-red-600">
              إلغاء ({Math.max(1, Math.ceil((100 - progress) / 33.3))}ث)...
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className={`h-3.5 w-3.5 ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`} />
            <span>{label}</span>
            {count !== undefined && count > 0 && (
              <span className={`text-[9.5px] px-1 py-0.2 rounded font-mono ${
                isDark ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-100 text-emerald-800'
              }`}>
                ({count})
              </span>
            )}
          </>
        )}
      </span>
    </button>
  );
};
