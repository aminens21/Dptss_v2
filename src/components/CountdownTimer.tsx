import React, { useState, useEffect } from 'react';
import { Clock, Lock } from 'lucide-react';

interface CountdownTimerProps {
  deadline: any; // Date, timestamp, ISO string
  compact?: boolean;
}

export const CountdownTimer: React.FC<CountdownTimerProps> = ({ deadline, compact = false }) => {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
  }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  useEffect(() => {
    if (!deadline) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      return;
    }

    let targetDate: Date;
    if (typeof deadline === 'object' && deadline !== null && 'toDate' in deadline && typeof deadline.toDate === 'function') {
      targetDate = deadline.toDate();
    } else if (deadline instanceof Date) {
      targetDate = deadline;
    } else {
      targetDate = new Date(deadline);
    }

    if (isNaN(targetDate.getTime())) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [deadline]);

  if (timeLeft.isExpired) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-50 text-red-700 border border-red-200 text-xs font-bold ${compact ? 'text-[10px] py-0.5' : ''}`}>
        <Lock className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <span>انتهى أجل التسجيل</span>
      </div>
    );
  }

  const isUrgent = timeLeft.days === 0 && timeLeft.hours < 24;

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs border ${
        isUrgent ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse' : 'bg-slate-900 text-amber-400 border-slate-700'
      }`}>
        <Clock className="w-3 h-3 text-amber-400 shrink-0" />
        <span>
          {timeLeft.days > 0 ? `${timeLeft.days}ي ` : ''}
          {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
        </span>
      </div>
    );
  }

  return (
    <div className={`p-2.5 rounded-xl border flex flex-col gap-1.5 ${
      isUrgent
        ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-300 text-amber-900 shadow-xs'
        : 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 border-slate-700 text-white shadow-xs'
    }`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold">
          <Clock className={`w-3.5 h-3.5 ${isUrgent ? 'text-amber-600 animate-pulse' : 'text-amber-400'}`} />
          <span>آخر أجل لتسجيل الفرق والتلاميذ</span>
        </div>
        <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
          isUrgent ? 'bg-amber-200 text-amber-900' : 'bg-amber-400/20 text-amber-300'
        }`}>
          مفتوح
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1 text-center font-mono font-black" dir="ltr">
        <div className="bg-black/20 rounded p-1">
          <span className="text-sm md:text-base text-amber-400 block leading-tight">{timeLeft.days}</span>
          <span className="text-[9px] text-slate-300 font-sans block opacity-80">يوم</span>
        </div>
        <div className="bg-black/20 rounded p-1">
          <span className="text-sm md:text-base text-amber-400 block leading-tight">{String(timeLeft.hours).padStart(2, '0')}</span>
          <span className="text-[9px] text-slate-300 font-sans block opacity-80">ساعة</span>
        </div>
        <div className="bg-black/20 rounded p-1">
          <span className="text-sm md:text-base text-amber-400 block leading-tight">{String(timeLeft.minutes).padStart(2, '0')}</span>
          <span className="text-[9px] text-slate-300 font-sans block opacity-80">دقيقة</span>
        </div>
        <div className="bg-black/20 rounded p-1">
          <span className="text-sm md:text-base text-amber-400 block leading-tight">{String(timeLeft.seconds).padStart(2, '0')}</span>
          <span className="text-[9px] text-slate-300 font-sans block opacity-80">ثانية</span>
        </div>
      </div>
    </div>
  );
};
