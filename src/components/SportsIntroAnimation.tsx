import React, { useState, useEffect, useRef } from 'react';
import { Play, Volume2, VolumeX, Sparkles, ChevronLeft, Trophy, Flame } from 'lucide-react';
import { AppLogo } from './AppLogo';

interface SportsIntroAnimationProps {
  onComplete: () => void;
  isOpen: boolean;
}

export const SportsIntroAnimation: React.FC<SportsIntroAnimationProps> = ({ onComplete, isOpen }) => {
  const [stage, setStage] = useState<'countdown' | 'sprint' | 'championship' | 'exit'>('countdown');
  const [countdownNum, setCountdownNum] = useState<number | string>(3);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Sound synthesis via Web Audio API (Whistle & Fanfare)
  const playWhistleSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // Whistle frequency modulation
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(2600, now);
      osc.frequency.linearRampToValueAtTime(2900, now + 0.08);
      osc.frequency.linearRampToValueAtTime(2700, now + 0.25);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);
    } catch {
      // Ignore audio policy errors
    }
  };

  const playFanfareSound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioCtx();
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      const notes = [440, 554.37, 659.25, 880]; // A major chord
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const now = ctx.currentTime + idx * 0.09;
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.2, now + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.65);
      });
    } catch {
      // Audio error ignored
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setHasStarted(true);
    setStage('countdown');
    setCountdownNum(3);

    // Sequence of animations:
    // 0ms: 3
    // 700ms: 2
    // 1400ms: 1
    // 2100ms: انطلاق! (Sprint & Whistle)
    // 2800ms: Championship Logo & Title
    // 4400ms: Exit to App
    const t1 = setTimeout(() => {
      setCountdownNum(2);
    }, 650);

    const t2 = setTimeout(() => {
      setCountdownNum(1);
    }, 1300);

    const t3 = setTimeout(() => {
      setCountdownNum('انطلق! 💨');
      setStage('sprint');
      playWhistleSound();
    }, 1950);

    const t4 = setTimeout(() => {
      setStage('championship');
      playFanfareSound();
    }, 2800);

    const t5 = setTimeout(() => {
      setStage('exit');
      setTimeout(() => {
        onComplete();
      }, 500);
    }, 4500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
    };
  }, [isOpen]);

  const handleSkip = () => {
    setStage('exit');
    setTimeout(() => {
      onComplete();
    }, 300);
  };

  if (!isOpen && !hasStarted) return null;

  return (
    <div
      dir="rtl"
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden transition-all duration-500 ${
        stage === 'exit'
          ? 'opacity-0 scale-105 pointer-events-none'
          : 'opacity-100 scale-100 pointer-events-auto'
      }`}
      style={{
        background: 'radial-gradient(circle at 50% 35%, #0f172a 0%, #020617 80%, #000000 100%)'
      }}
    >
      {/* Stadium Floodlights & Ambient Glow */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute top-0 right-1/4 translate-x-1/2 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none animate-pulse delay-300" />
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-80 bg-gradient-to-t from-emerald-950/40 via-blue-950/20 to-transparent pointer-events-none" />

      {/* Synthetic Athletic Track Lines on Floor */}
      <div className="absolute bottom-0 inset-x-0 h-48 opacity-25 pointer-events-none overflow-hidden [perspective:500px]">
        <div className="w-[140%] -mr-[20%] h-full flex justify-between [transform:rotateX(60deg)] origin-bottom">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((lane) => (
            <div
              key={lane}
              className="flex-1 border-r-2 border-white/60 h-full relative"
            >
              <span className="absolute bottom-4 right-2 text-white/50 text-[10px] font-mono font-bold">
                {lane}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Sports Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden select-none">
        <span className="absolute top-[18%] left-[12%] text-2xl sm:text-3xl animate-bounce duration-1000 opacity-60">⚽</span>
        <span className="absolute top-[28%] right-[15%] text-2xl sm:text-3xl animate-pulse duration-700 opacity-60">🏀</span>
        <span className="absolute bottom-[25%] left-[18%] text-2xl sm:text-3xl animate-bounce duration-700 opacity-50">🏐</span>
        <span className="absolute bottom-[22%] right-[20%] text-2xl sm:text-3xl animate-pulse duration-1000 opacity-60">🏸</span>
        <span className="absolute top-[15%] right-[35%] text-2xl sm:text-3xl animate-spin duration-3000 opacity-40">🏓</span>
      </div>

      {/* Top Header Controls: Mute & Skip */}
      <div className="absolute top-4 inset-x-4 sm:inset-x-8 flex items-center justify-between z-20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white backdrop-blur-md border border-white/15 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-lg active:scale-95"
            title={soundEnabled ? 'كتم الصوت' : 'تشغيل الصوت'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span className="hidden sm:inline">{soundEnabled ? 'الصوت مفعل' : 'صامت'}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-emerald-900/40 border border-emerald-400/30 transition-all cursor-pointer active:scale-95 group"
        >
          <span>تخطي والدخول ⚡</span>
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        </button>
      </div>

      {/* Central Animation Canvas */}
      <div className="relative z-10 max-w-xl mx-auto px-6 text-center flex flex-col items-center justify-center">

        {/* STAGE 1 & 2: COUNTDOWN & SPRINT */}
        {(stage === 'countdown' || stage === 'sprint') && (
          <div className="flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in-75 duration-300">
            {/* Running Silhouette Graphic */}
            <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-full bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 p-1 flex items-center justify-center shadow-2xl shadow-orange-500/30 animate-pulse">
              <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center overflow-hidden border border-amber-400/40">
                <span className="text-5xl sm:text-7xl transform -scale-x-100 animate-bounce duration-500">
                  🏃‍♂️
                </span>
              </div>
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 animate-ping" />
            </div>

            {/* Huge Dynamic Countdown Counter */}
            <div className="space-y-2">
              <div
                key={String(countdownNum)}
                className={`text-6xl sm:text-8xl font-black tracking-tight font-mono drop-shadow-[0_10px_25px_rgba(245,158,11,0.5)] transition-all transform animate-in zoom-in-50 duration-200 ${
                  stage === 'sprint'
                    ? 'text-emerald-400 scale-110'
                    : 'text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500'
                }`}
              >
                {countdownNum}
              </div>
              <p className="text-xs sm:text-sm text-slate-400 font-bold tracking-wider uppercase">
                {stage === 'sprint' ? 'صافرة الانطلاق • الميدان الرياضي' : 'استعد للانطلاق في المنافسات'}
              </p>
            </div>
          </div>
        )}

        {/* STAGE 3: CHAMPIONSHIP IDENTITY & REVEAL */}
        {stage === 'championship' && (
          <div className="flex flex-col items-center justify-center space-y-5 animate-in fade-in zoom-in-90 duration-500">
            
            {/* Official App Logo with Glowing Crown */}
            <div className="relative">
              <div className="absolute inset-0 rounded-3xl bg-emerald-500/30 blur-xl animate-pulse" />
              <AppLogo size={96} showText={false} className="relative z-10 shadow-2xl shadow-emerald-500/30" />
            </div>

            {/* Ministry & Federation Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-[11px] sm:text-xs font-black shadow-md">
              <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span>الجامعة الملكية المغربية للرياضة المدرسية</span>
            </div>

            {/* Main Championship Titles */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight leading-snug drop-shadow-md">
                منظومة تدبير البطولات والأنشطة الرياضية
              </h1>
              <p className="text-xs sm:text-sm text-amber-400 font-extrabold max-w-md mx-auto leading-relaxed">
                التغطية الرقمية الفورية • النتائج الرسمية • بطاقات الصدريات الذكية والتحكيم
              </p>
            </div>

            {/* Sports Showcase Carousel Strip */}
            <div className="flex items-center justify-center gap-2 pt-2 flex-wrap max-w-sm">
              {[
                { label: 'العدو الريفي', icon: '🏃' },
                { label: 'ألعاب القوى', icon: '🎽' },
                { label: 'كرة القدم', icon: '⚽' },
                { label: 'كرة السلة', icon: '🏀' },
                { label: 'كرة اليد', icon: '🤾' },
                { label: 'الكرة الطائرة', icon: '🏐' },
                { label: 'الجمباز', icon: '🤸' }
              ].map((sp, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-white text-[11px] font-bold flex items-center gap-1.5 shadow-sm"
                >
                  <span>{sp.icon}</span>
                  <span>{sp.label}</span>
                </div>
              ))}
            </div>

            {/* Loading Indicator for auto enter */}
            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-4">
              <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 rounded-full animate-[progress_1.6s_ease-in-out_infinite]" />
            </div>
            <p className="text-[11px] text-slate-400 font-medium">جاري الدخول إلى لوحة النتائج والمنظومة...</p>
          </div>
        )}

      </div>

      {/* Bottom Footer Note */}
      <div className="absolute bottom-4 text-center inset-x-4 pointer-events-none z-20">
        <p className="text-[10px] sm:text-xs text-slate-500 font-medium">
          وزارة التربية الوطنية والتعليم الأولي والرياضة • مديرية الارتقاء بالرياضة المدرسية
        </p>
      </div>
    </div>
  );
};
