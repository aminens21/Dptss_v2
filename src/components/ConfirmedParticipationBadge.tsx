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
  const isPressingRef = useRef<boolean>(false);
  const isCancellingRef = useRef<boolean>(false);
  const ignoreMouseUntilRef = useRef<number>(0);
  const suppressNextClickRef = useRef<boolean>(false);

  const LONG_PRESS_DURATION = 3000; // 3 seconds

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

  const executeCancel = useCallback(async () => {
    if (isCancellingRef.current) return;
    isCancellingRef.current = true;
    isPressingRef.current = false;
    setIsCancelling(true);
    setIsPressing(false);
    const toastId = toast.loading(`جاري سحب وإلغاء مشاركة ${schoolName} في جميع فروع بطولة ${sportName}...`);
    try {
      await DataService.cancelSchoolConfirmation(sportId, schoolId || schoolName, schoolName);
      toast.dismiss(toastId);
      toast.success(`تم سحب وإلغاء المشاركة في جميع فروع بطولة ${sportName} بنجاح ✓`, {
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
      isCancellingRef.current = false;
      setIsCancelling(false);
      setProgress(0);
      setIsPressing(false);
    }
  }, [sportId, sportName, schoolId, schoolName, onCancelSuccess]);

  const handleStart = (e: React.SyntheticEvent, isTouch = false) => {
    e.stopPropagation();
    if (!isTouch && Date.now() < ignoreMouseUntilRef.current) return;
    if (isTouch) {
      ignoreMouseUntilRef.current = Date.now() + 900;
    }
    if (isCancellingRef.current) return;

    clearTimers();
    didTriggerCancelRef.current = false;
    suppressNextClickRef.current = false;
    isPressingRef.current = true;
    setIsPressing(true);
    startTimeRef.current = Date.now();
    setProgress(0);

    const updateProgress = () => {
      if (!isPressingRef.current || isCancellingRef.current) return;
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, Math.round((elapsed / LONG_PRESS_DURATION) * 100));
      setProgress(pct);

      if (elapsed < LONG_PRESS_DURATION) {
        animationFrameRef.current = window.requestAnimationFrame(updateProgress);
      } else {
        didTriggerCancelRef.current = true;
        suppressNextClickRef.current = true;
        clearTimers();
        executeCancel();
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(updateProgress);
  };

  const handleEnd = (e: React.SyntheticEvent, isTouch = false, isCancelOrLeave = false) => {
    e.stopPropagation();
    if (!isTouch && Date.now() < ignoreMouseUntilRef.current && !isCancelOrLeave) return;
    if (isTouch) {
      ignoreMouseUntilRef.current = Date.now() + 900;
    }

    const wasPressing = isPressingRef.current;
    clearTimers();
    isPressingRef.current = false;
    setIsPressing(false);
    setProgress(0);

    if (didTriggerCancelRef.current) {
      e.preventDefault();
      didTriggerCancelRef.current = false;
      suppressNextClickRef.current = true;
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    if (wasPressing && !isCancelOrLeave && elapsed < 500 && onClick) {
      suppressNextClickRef.current = true;
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
      onMouseDown={(e) => handleStart(e, false)}
      onMouseUp={(e) => handleEnd(e, false, false)}
      onMouseLeave={(e) => handleEnd(e, false, true)}
      onTouchStart={(e) => handleStart(e, true)}
      onTouchEnd={(e) => handleEnd(e, true, false)}
      onTouchCancel={(e) => handleEnd(e, true, true)}
      onClick={(e) => {
        e.stopPropagation();
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        if (onClick && !isCancellingRef.current) {
          onClick(e);
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      disabled={isCancelling}
      title="اضغط ضغطة عادية للتفاصيل، أو اضغط مطولاً لمدة 3 ثوانٍ لإلغاء المشاركة في جميع فروع البطولة"
      className={`relative select-none touch-none overflow-hidden transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
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
