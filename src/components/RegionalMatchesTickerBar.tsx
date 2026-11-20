import React, { useEffect, useState } from 'react';
import { DataService } from '../lib/dataService';
import { Match } from '../types';
import { CalendarDays, Trophy, Clock, ChevronLeft, ChevronRight, Activity, Radio, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const RegionalMatchesTickerBar: React.FC = () => {
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const data = await DataService.getMatches();
        if (data && data.length > 0) {
          // Sort by newest or recently updated
          const sorted = [...data].sort((a, b) => {
            const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return timeB - timeA;
          });
          setMatches(sorted);
        } else {
          // Fallback demo items if no matches yet
          setMatches([
            {
              id: 'demo-1',
              tournamentId: 't1',
              sportId: 'football',
              sportName: 'كرة القدم المصغرة',
              drawMatchNumber: 1,
              groupName: 'المجموعة أ',
              stage: 'دور المجموعات',
              ageCategory: 'U15',
              gender: 'Male',
              team1Id: 's1',
              team2Id: 's2',
              team1Name: 'ثانوية ابن طفوف الإعدادية',
              team2Name: 'ثانوية علال الفاسي',
              team1Score: 2,
              team2Score: 1,
              status: 'Completed',
              date: new Date().toISOString(),
              startTime: '10:00',
              venueId: 'v1',
              venueName: 'الملعب البلدي تاوريرت',
              updatedAt: new Date().toISOString()
            },
            {
              id: 'demo-2',
              tournamentId: 't2',
              sportId: 'basketball',
              sportName: 'كرة السلة الثلاثية',
              drawMatchNumber: 2,
              groupName: 'المجموعة ب',
              stage: 'نصف النهائي',
              ageCategory: 'U18',
              gender: 'Female',
              team1Id: 's3',
              team2Id: 's4',
              team1Name: 'ثانوية عمر بن الخطاب',
              team2Name: 'ثانوية الموحدين',
              team1Score: 18,
              team2Score: 15,
              status: 'Ongoing',
              date: new Date().toISOString(),
              startTime: '11:30',
              venueId: 'v2',
              venueName: 'قاعة المغطاة المسيرة',
              updatedAt: new Date().toISOString()
            },
            {
              id: 'demo-3',
              tournamentId: 't3',
              sportId: 'handball',
              sportName: 'كرة اليد',
              drawMatchNumber: 3,
              groupName: 'المجموعة أ',
              stage: 'المباراة النهائية',
              ageCategory: 'U20',
              gender: 'Male',
              team1Id: 's5',
              team2Id: 's6',
              team1Name: 'ثانوية ابن خلدون التأهيلية',
              team2Name: 'ثانوية الحسن الثاني',
              team1Score: 0,
              team2Score: 0,
              status: 'Scheduled',
              date: new Date().toISOString(),
              startTime: '14:00',
              venueId: 'v1',
              venueName: 'الملعب البلدي تاوريرت',
              updatedAt: new Date().toISOString()
            }
          ]);
        }
      } catch (err) {
        console.error('Error fetching ticker matches:', err);
      }
    };

    fetchMatches();
    const interval = setInterval(fetchMatches, 30000);
    return () => clearInterval(interval);
  }, []);

  // Auto advance ticker items every 5 seconds if not paused
  useEffect(() => {
    if (matches.length <= 1 || isPaused) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % matches.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [matches.length, isPaused]);

  if (matches.length === 0) return null;

  const currentMatch = matches[currentIndex] || matches[0];

  // Formatting according to user exact requirement:
  // رمز الرياضة - رقم المباراة - المجموعة - الدور - الفئة - النتيجة أو الحالة
  const sportCode = currentMatch.sportName || currentMatch.sportId || 'رياضة';
  const matchNum = currentMatch.drawMatchNumber || currentMatch.matchNumber || `#${currentMatch.id.slice(-4)}`;
  const group = currentMatch.groupName || 'المجموعة العامة';
  const round = currentMatch.stage || 'الدور التمهيدي';
  const category = currentMatch.ageCategory || currentMatch.category || 'U15';

  const formatScoreOrStatus = (m: Match) => {
    const s1 = m.team1Score ?? m.score1 ?? 0;
    const s2 = m.team2Score ?? m.score2 ?? 0;
    const t1 = m.team1Name || 'الفريق الأول';
    const t2 = m.team2Name || 'الفريق الثاني';

    if (m.status === 'Completed') {
      return `انتهت: ${t1} (${s1} - ${s2}) ${t2}`;
    } else if (m.status === 'Ongoing') {
      return `جارية الآن 🔴: ${t1} (${s1} - ${s2}) ${t2}`;
    } else if (m.status === 'Postponed') {
      return `مؤجلة (الموعد: ${m.startTime || 'يحدد لاحقاً'})`;
    } else if (m.status === 'Cancelled') {
      return `ملغاة`;
    } else {
      return `مبرمجة في ${m.startTime || 'قريباً'} (${t1} ضد ${t2})`;
    }
  };

  const scoreStatusText = formatScoreOrStatus(currentMatch);

  return (
    <div
      className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border-b border-indigo-500/30 shadow-md px-3 py-2 flex items-center justify-between gap-3 text-xs font-bold overflow-hidden transition-all select-none"
      dir="rtl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Ticker Title Badge */}
      <div className="flex items-center gap-2 shrink-0 bg-emerald-600/90 text-white px-2.5 py-1 rounded-lg text-[11px] font-black shadow-xs">
        <span className="flex h-2 w-2 relative">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-200"></span>
        </span>
        <span className="hidden sm:inline">شريط أحدث المباريات والبرمجة الإقليمية</span>
        <span className="sm:hidden">مباريات إقليمية</span>
      </div>

      {/* Ticker Content Line in Exact Requested Format */}
      <div
        className="flex-1 truncate cursor-pointer hover:text-emerald-300 transition-colors flex items-center gap-2 font-mono text-[11px] sm:text-xs"
        onClick={() => navigate('/matches?tab=list')}
        title="انقر لعرض جدول المباريات الكامل والنتائج"
      >
        <span className="text-emerald-400 font-black">[{sportCode}]</span>
        <span className="text-slate-400">-</span>
        <span className="text-amber-300 font-black">مباراة رقم {matchNum}</span>
        <span className="text-slate-400">-</span>
        <span className="text-indigo-200">{group}</span>
        <span className="text-slate-400">-</span>
        <span className="text-teal-200">{round}</span>
        <span className="text-slate-400">-</span>
        <span className="bg-white/10 px-1.5 py-0.5 rounded text-amber-200 font-bold">{category}</span>
        <span className="text-slate-400">-</span>
        <span className="text-emerald-300 font-black truncate">{scoreStatusText}</span>
      </div>

      {/* Controls & Nav */}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[10px] text-slate-400 hidden md:inline font-mono">
          {currentIndex + 1} / {matches.length}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex((prev) => (prev - 1 + matches.length) % matches.length);
          }}
          className="p-1 hover:bg-white/10 rounded text-slate-300 transition-colors cursor-pointer"
          title="المباراة السابقة"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCurrentIndex((prev) => (prev + 1) % matches.length);
          }}
          className="p-1 hover:bg-white/10 rounded text-slate-300 transition-colors cursor-pointer"
          title="المباراة التالية"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
