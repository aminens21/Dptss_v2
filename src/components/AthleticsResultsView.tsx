import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  Award,
  Medal,
  Calendar,
  Building,
  Users,
  Timer,
  Printer,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  Layers,
  Search,
  Filter
} from 'lucide-react';
import {
  AthleticsDisciplineDef,
  AthleticsEventResult
} from '../lib/athleticsConfig';
import { AthleticsService } from '../lib/athleticsService';
import { School, Student, User } from '../types';

interface AthleticsResultsViewProps {
  onBack?: () => void;
  canEdit?: boolean;
  activeSeason?: string;
  directorateName?: string;
  students?: Student[];
  schools?: School[];
  currentUser?: User | null;
}

export const AthleticsResultsView: React.FC<AthleticsResultsViewProps> = ({
  onBack,
  canEdit,
  activeSeason = '2026/2027',
  directorateName = 'المديرية الإقليمية',
  students = [],
  schools = [],
  currentUser
}) => {
  const [disciplines, setDisciplines] = useState<AthleticsDisciplineDef[]>([]);
  const [results, setResults] = useState<Record<string, AthleticsEventResult>>({});
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<'U12' | 'U15' | 'U18' | 'U20'>('U18');
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female'>('Male');

  useEffect(() => {
    const loadedDisciplines = AthleticsService.getDisciplines();
    const loadedResults = AthleticsService.getAllResults();
    setDisciplines(loadedDisciplines);
    setResults(loadedResults);
    if (loadedDisciplines.length > 0 && !selectedDisciplineId) {
      setSelectedDisciplineId(loadedDisciplines[0].id);
    }
  }, []);

  const activeDiscipline = useMemo(() => {
    return disciplines.find(d => d.id === selectedDisciplineId) || disciplines[0];
  }, [disciplines, selectedDisciplineId]);

  const currentEventKey = activeDiscipline ? `${activeDiscipline.id}_${selectedCategory}_${selectedGender}` : '';
  const currentResult = results[currentEventKey];

  // Count of completed events
  const completedEventsCount = (Object.values(results) as AthleticsEventResult[]).filter(r => r && r.status === 'completed').length;

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-rose-700 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-3xl shadow-inner shrink-0">
            🏃‍♂️
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black">نتائج ومنصات تتويج البطولة المدرسية لألعاب القوى</h2>
              <span className="bg-white/20 text-white text-xs font-black px-3 py-0.5 rounded-full">
                الموسم {activeSeason}
              </span>
            </div>
            <p className="text-xs text-orange-100 font-medium mt-1">
              النتائج المعتمدة لسباقات السرعة، المسافات المتوسطة، التناوب، القفز الطولي، ودفع الجلة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="px-3.5 py-1.5 bg-white text-slate-900 font-black rounded-xl text-xs shadow-sm">
            🏆 {completedEventsCount} مسابقة معتمدة
          </span>
          {onBack && (
            <button
              onClick={onBack}
              className="px-3.5 py-1.5 bg-black/20 hover:bg-black/40 text-white font-bold rounded-xl text-xs cursor-pointer"
            >
              العودة
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Disciplines select */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-600">المسابقة:</span>
          <select
            value={selectedDisciplineId}
            onChange={(e) => setSelectedDisciplineId(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
          >
            {disciplines.map(d => (
              <option key={d.id} value={d.id}>
                {d.icon} {d.nameAr} ({d.distanceOrUnit})
              </option>
            ))}
          </select>
        </div>

        {/* Category & Gender */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            {(['U12', 'U15', 'U18', 'U20'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-white text-blue-600 shadow-xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSelectedGender('Male')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedGender === 'Male'
                  ? 'bg-blue-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ذكور
            </button>
            <button
              onClick={() => setSelectedGender('Female')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedGender === 'Female'
                  ? 'bg-pink-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              إناث
            </button>
          </div>
        </div>
      </div>

      {/* Main Results View */}
      {currentResult ? (
        <div className="space-y-6">
          
          {/* PODIUM */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 text-center shadow-xs">
            <h3 className="text-base font-black text-slate-900 flex items-center justify-center gap-2 mb-6">
              <Trophy className="w-5 h-5 text-amber-500" />
              <span>منصة التتويج: {activeDiscipline?.nameAr} ({selectedCategory} - {selectedGender === 'Male' ? 'ذكور' : 'إناث'})</span>
            </h3>

            <div className="flex items-end justify-center gap-3 sm:gap-6 max-w-xl mx-auto pt-4 pb-2">
              
              {/* 2nd */}
              <div className="flex-1 flex flex-col items-center">
                <div className="text-2xl mb-1">🥈</div>
                <span className="text-xs font-black text-slate-800">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[1]?.studentName || 'لا يوجد'
                    : currentResult.fieldEntries?.[1]?.studentName || 'لا يوجد'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[1]?.schoolName
                    : currentResult.fieldEntries?.[1]?.schoolName}
                </span>
                <span className="text-xs font-mono font-bold text-slate-600 mt-1">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[1]?.formattedTime
                    : currentResult.fieldEntries?.[1]?.bestAttempt ? `${currentResult.fieldEntries[1].bestAttempt}م` : ''}
                </span>
                <div className="w-full h-20 bg-gradient-to-t from-slate-300 to-slate-200 rounded-t-2xl border-t-2 border-slate-400 flex items-center justify-center text-slate-700 font-black text-base mt-2 shadow-xs">
                  2
                </div>
              </div>

              {/* 1st */}
              <div className="flex-1 flex flex-col items-center -translate-y-3">
                <div className="text-3xl mb-1 animate-bounce">👑</div>
                <span className="text-sm font-black text-amber-800">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[0]?.studentName || 'لا يوجد'
                    : currentResult.fieldEntries?.[0]?.studentName || 'لا يوجد'}
                </span>
                <span className="text-xs text-slate-500 font-bold truncate max-w-[140px]">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[0]?.schoolName
                    : currentResult.fieldEntries?.[0]?.schoolName}
                </span>
                <span className="text-sm font-mono font-black text-amber-600 mt-1">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[0]?.formattedTime
                    : currentResult.fieldEntries?.[0]?.bestAttempt ? `${currentResult.fieldEntries[0].bestAttempt}م` : ''}
                </span>
                <div className="w-full h-28 bg-gradient-to-t from-amber-400 to-amber-300 rounded-t-2xl border-t-2 border-amber-500 flex items-center justify-center text-amber-950 font-black text-xl mt-2 shadow-md shadow-amber-300/30">
                  1 🥇
                </div>
              </div>

              {/* 3rd */}
              <div className="flex-1 flex flex-col items-center">
                <div className="text-2xl mb-1">🥉</div>
                <span className="text-xs font-black text-slate-800">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[2]?.studentName || 'لا يوجد'
                    : currentResult.fieldEntries?.[2]?.studentName || 'لا يوجد'}
                </span>
                <span className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[2]?.schoolName
                    : currentResult.fieldEntries?.[2]?.schoolName}
                </span>
                <span className="text-xs font-mono font-bold text-orange-700 mt-1">
                  {currentResult.type === 'track'
                    ? currentResult.trackLaps?.[2]?.formattedTime
                    : currentResult.fieldEntries?.[2]?.bestAttempt ? `${currentResult.fieldEntries[2].bestAttempt}م` : ''}
                </span>
                <div className="w-full h-16 bg-gradient-to-t from-amber-700 to-amber-600 rounded-t-2xl border-t-2 border-amber-800 flex items-center justify-center text-amber-100 font-black text-sm mt-2 shadow-xs">
                  3
                </div>
              </div>

            </div>
          </div>

          {/* Full Results Table */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-black text-slate-800">جدول الترتيب والنتائج الكاملة:</h4>
            
            {currentResult.type === 'track' && currentResult.trackLaps ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black">
                      <th className="py-2.5 px-3 text-center">الرتبة</th>
                      <th className="py-2.5 px-3">الصدرية</th>
                      <th className="py-2.5 px-3">اسم التلميذ(ة)</th>
                      <th className="py-2.5 px-3">المؤسسة التعليمية</th>
                      <th className="py-2.5 px-3 text-center">التوقيت المسجل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {currentResult.trackLaps.map((lap, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center font-black">
                          {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : `#${lap.rank}`}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                          #{lap.bibNumber || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {lap.studentName || 'غير محدد'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {lap.schoolName || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-emerald-700">
                          {lap.formattedTime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : currentResult.fieldEntries ? (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black">
                      <th className="py-2.5 px-3 text-center">الرتبة</th>
                      <th className="py-2.5 px-3">الصدرية</th>
                      <th className="py-2.5 px-3">اسم التلميذ(ة)</th>
                      <th className="py-2.5 px-3">المؤسسة التعليمية</th>
                      <th className="py-2.5 px-3 text-center">أفضل إنجاز (م)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {currentResult.fieldEntries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 text-center font-black">
                          {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : (entry.rank ? `#${entry.rank}` : '-')}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-600">
                          #{entry.bibNumber || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">
                          {entry.studentName || 'غير محدد'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {entry.schoolName || '-'}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-black text-amber-700">
                          {entry.bestAttempt !== null ? `${entry.bestAttempt.toFixed(2)} م` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>

        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center space-y-3 shadow-xs">
          <Award className="w-12 h-12 text-slate-300 mx-auto" />
          <h4 className="text-sm font-black text-slate-800">لم يتم تسجيل واعتماد نتائج هذه المسابقة بعد</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            يمكن لقضاة ولجان ألعاب القوى إطلاق الميقاتي وإدخال المحاولات واعتماد النتائج عبر تطبيق ألعاب القوى في صفحة التطبيقات المساعدة.
          </p>
        </div>
      )}

      {/* Print Action */}
      <div className="flex justify-center pt-2">
        <button
          onClick={() => window.print()}
          className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-sm"
        >
          <Printer className="w-4 h-4 text-amber-400" />
          <span>طباعة محضر نتائج ألعاب القوى</span>
        </button>
      </div>

    </div>
  );
};
