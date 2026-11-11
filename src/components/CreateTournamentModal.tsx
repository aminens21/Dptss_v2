import React, { useState, useEffect, useMemo } from 'react';
import { Tournament, Sport, Directorate, TARGET_AFFILIATIONS, TargetAffiliationConfig } from '../types';
import { AGE_CATEGORIES, DataService, getAgeCategoriesForSeason, SPORTS_MAP, getCategoryGenderLabel, normalizeCategoryKey, isTeamSport } from '../lib/dataService';
import { X, Trophy, Calendar, Users, Target, Award, Sparkles, ShieldCheck, RefreshCw, Check, Clock, GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';

interface CreateTournamentModalProps {
  isOpen: boolean;
  onClose: () => void;
  allowedSportIds?: string[] | null;
  preselectedSportId?: string;
  onCreated: (tournaments: Omit<Tournament, 'id'>[]) => Promise<void>;
}

export const CreateTournamentModal: React.FC<CreateTournamentModalProps> = ({
  isOpen,
  onClose,
  allowedSportIds,
  preselectedSportId,
  onCreated
}) => {
  const [name, setName] = useState('');
  const [sportId, setSportId] = useState('football');
  const [selectedLevels, setSelectedLevels] = useState<('Primary' | 'Middle' | 'High')[]>(['High']);
  
  // Custom states for multi-select categories and gender combinations
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['U15']);
  const [genderSelection, setGenderSelection] = useState<'Male' | 'Female' | 'Both' | 'Mixed'>('Both');
  const [selectedAffiliations, setSelectedAffiliations] = useState<string[]>(['non_club']);

  // Sports Configuration for custom/dynamic categories
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [currentSeason, setCurrentSeason] = useState('2026/2027');
  const [activeDirObj, setActiveDirObj] = useState<Directorate | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingConfig(true);
      Promise.all([
        DataService.getSportsConfig(),
        DataService.getActiveSeason(),
        DataService.getActiveDirectorate()
      ])
        .then(([config, season, activeDir]) => {
          setSportsConfig(config);
          localStorage.setItem('taourirt_sports_config', JSON.stringify(config));
          setCurrentSeason(season);
          setActiveDirObj(activeDir);
          setLoadingConfig(false);
        })
        .catch(err => {
          console.error("Error loading sports config in modal:", err);
          setLoadingConfig(false);
        });
    }
  }, [isOpen]);

  // Filter sports based on allowedSportIds for Tech Committee Head
  const availableSports = React.useMemo(() => {
    if (allowedSportIds === null) return sportsConfig; // null means unrestricted (CENTRAL_ADMIN)
    if (Array.isArray(allowedSportIds)) {
      return sportsConfig.filter(s => allowedSportIds.includes(s.id));
    }
    return sportsConfig;
  }, [sportsConfig, allowedSportIds]);

  // Auto-set sportId to preselectedSportId or first allowed sport
  useEffect(() => {
    if (preselectedSportId) {
      setSportId(preselectedSportId);
    } else if (availableSports.length > 0) {
      const isCurrentValid = availableSports.some(s => s.id === sportId);
      if (!isCurrentValid) {
        setSportId(availableSports[0].id);
      }
    }
  }, [availableSports, preselectedSportId]);

  const seasonalCategories = getAgeCategoriesForSeason(currentSeason, undefined, sportId);
  const activeSportConfig = sportsConfig.find(s => s.id === sportId);

  // Available target classifications configured in SportsConfig for this sport
  const availableAffiliations = useMemo(() => {
    const allowed = activeSportConfig?.targetAffiliations;
    if (allowed && allowed.length > 0) {
      return TARGET_AFFILIATIONS.filter(a => allowed.includes(a.id));
    }
    return TARGET_AFFILIATIONS.filter(a => ['non_club', 'espoir_non_club', 'sports_tracks', 'espoir_club'].includes(a.id));
  }, [activeSportConfig]);

  // Compute categoriesToRender based strictly on configured/programmed categories in SportsConfig
  const categoriesToRender = useMemo(() => {
    if (activeSportConfig?.customAgeCategories && activeSportConfig.customAgeCategories.length > 0) {
      return activeSportConfig.customAgeCategories.map(c => ({
        id: normalizeCategoryKey(c.id),
        name: c.name,
        shortName: c.name
      }));
    }
    if (activeSportConfig?.ageCategories && activeSportConfig.ageCategories.length > 0) {
      return activeSportConfig.ageCategories.map(catKey => {
        const normKey = normalizeCategoryKey(catKey);
        const found = seasonalCategories.find(sc => sc.id === normKey);
        return {
          id: normKey,
          name: found ? found.name : catKey,
          shortName: found ? found.shortName : catKey
        };
      });
    }
    if (isTeamSport(sportId)) {
      return seasonalCategories
        .filter(c => c.id === 'U15' || c.id === 'U18')
        .map(c => ({
          id: c.id,
          name: c.name,
          shortName: c.shortName
        }));
    }
    return seasonalCategories.map(c => ({
      id: c.id,
      name: c.name,
      shortName: c.shortName
    }));
  }, [activeSportConfig, seasonalCategories, sportId]);

  const [scope, setScope] = useState<'Provincial' | 'Regional' | 'National'>('Provincial');
  const [status, setStatus] = useState<Tournament['status']>('Scheduled');
  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2026-03-30');
  const [registrationDeadline, setRegistrationDeadline] = useState('2026-02-28T23:59');
  const [description, setDescription] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Auto-prefill existing tournament data for sport if present
  useEffect(() => {
    if (!isOpen || !sportId) return;

    let isMounted = true;
    DataService.getTournaments().then(allTourns => {
      if (!isMounted) return;
      const activeDirId = activeDirObj?.id || DataService.getActiveDirectorateId();
      const sportTourns = allTourns.filter(t => 
        t.sportId === sportId && 
        (!t.seasonId || !currentSeason || t.seasonId === currentSeason) &&
        (!t.directorateId || (t.directorateId || 'taourirt') === (activeDirId || 'taourirt'))
      );

      if (sportTourns.length > 0) {
        setIsEditing(true);
        const sample = sportTourns[0];
        if (sample.name) {
          const cleanName = sample.name.split(/\s*-\s*(?:البرعمات|البراعم|الصغيرات|الصغار|الفتيات|الفتيان|الشابات|الشبان|ذكور|إناث|مختلط|U12|U15|U18|U20|جميع الفئات|فئة|صغار|فتيان|شبان|براعم|صغيرات|فتيات|شابات|برعمات|لا منتمين|للمنتمين للأندية|مفتوحة|مواليد|السلك|دوري)/i)[0].trim();
          setName(cleanName && cleanName.length >= 3 ? cleanName : sample.name);
        }
        if (sample.startDate) {
          let d: Date | null = null;
          if (typeof sample.startDate === 'object' && 'toDate' in sample.startDate && typeof (sample.startDate as any).toDate === 'function') d = (sample.startDate as any).toDate();
          else if (sample.startDate instanceof Date) d = sample.startDate;
          else d = new Date(sample.startDate);
          if (d && !isNaN(d.getTime())) setStartDate(d.toISOString().split('T')[0]);
        }
        if (sample.endDate) {
          let d: Date | null = null;
          if (typeof sample.endDate === 'object' && 'toDate' in sample.endDate && typeof (sample.endDate as any).toDate === 'function') d = (sample.endDate as any).toDate();
          else if (sample.endDate instanceof Date) d = sample.endDate;
          else d = new Date(sample.endDate);
          if (d && !isNaN(d.getTime())) setEndDate(d.toISOString().split('T')[0]);
        }
        if (sample.registrationDeadline) {
          let d: Date | null = null;
          if (typeof sample.registrationDeadline === 'object' && 'toDate' in sample.registrationDeadline && typeof (sample.registrationDeadline as any).toDate === 'function') d = (sample.registrationDeadline as any).toDate();
          else if (sample.registrationDeadline instanceof Date) d = sample.registrationDeadline;
          else d = new Date(sample.registrationDeadline);
          if (d && !isNaN(d.getTime())) {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const hours = String(d.getHours()).padStart(2, '0');
            const mins = String(d.getMinutes()).padStart(2, '0');
            setRegistrationDeadline(`${year}-${month}-${day}T${hours}:${mins}`);
          }
        }
        if (sample.description) setDescription(sample.description);
        if (sample.scope) setScope(sample.scope as any);
        if (sample.status) setStatus(sample.status);
        if (sample.level) {
          const lvls = sample.level.split(',').map((l: string) => l.trim()).filter(Boolean) as ('Primary' | 'Middle' | 'High')[];
          if (lvls.length > 0) setSelectedLevels(lvls);
        }

        const existingCats = Array.from(new Set(
          sportTourns
            .map(t => normalizeCategoryKey(t.ageCategory))
            .filter(Boolean)
        ));
        if (existingCats.length > 0) {
          setSelectedCategories(existingCats);
        } else if (categoriesToRender.length > 0) {
          setSelectedCategories([categoriesToRender[0].id]);
        } else {
          setSelectedCategories(['U15']);
        }

        const genders = new Set(sportTourns.map(t => t.gender));
        if (genders.has('Male') && genders.has('Female')) setGenderSelection('Both');
        else if (genders.has('Mixed')) setGenderSelection('Mixed');
        else if (genders.has('Male')) setGenderSelection('Male');
        else if (genders.has('Female')) setGenderSelection('Female');
        else if (sportId === 'cross_country') setGenderSelection('Both');

        const affs = new Set(sportTourns.map(t => t.affiliationType || 'non_club').filter(Boolean) as string[]);
        if (affs.size > 0) {
          setSelectedAffiliations(Array.from(affs));
        } else {
          setSelectedAffiliations(['non_club']);
        }
      } else {
        setIsEditing(false);
        const activeSportConfig = sportsConfig.find(s => s.id === sportId);
        const sportName = SPORTS_MAP[sportId]?.name || activeSportConfig?.name || sportId;
        setName(`البطولة الإقليمية المدرسية لـ ${sportName}`);

        if (categoriesToRender.length > 0) {
          setSelectedCategories([categoriesToRender[0].id]);
        } else {
          setSelectedCategories(['U15']);
        }
        setGenderSelection('Both');
        setSelectedAffiliations(['non_club']);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen, sportId]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleToggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim()) {
      toast.error('يرجى إدخال اسم البطولة الأساسي');
      return;
    }

    if (allowedSportIds && allowedSportIds.length > 0 && !allowedSportIds.includes(sportId)) {
      toast.error('غير مسموح لك بإضافة بطولة في هذه الرياضة. يمكنك الإضافة فقط في تخصصك المسند.');
      return;
    }

    if (selectedCategories.length === 0) {
      toast.error('يرجى تحديد فئة عمرية واحدة على الأقل');
      return;
    }

    setIsSubmitting(true);
    try {
      // Determine genders to generate based on selection
      const gendersToGenerate: ('Male' | 'Female' | 'Mixed')[] = [];
      if (genderSelection === 'Both') {
        gendersToGenerate.push('Male', 'Female');
      } else if (genderSelection === 'Male') {
        gendersToGenerate.push('Male');
      } else if (genderSelection === 'Female') {
        gendersToGenerate.push('Female');
      } else {
        gendersToGenerate.push('Mixed');
      }

      if (selectedAffiliations.length === 0) {
        toast.error('يرجى تحديد صنف مشاركة مستهدف واحد على الأقل');
        setIsSubmitting(false);
        return;
      }

      // Generate combinations: categories x genders x target affiliations
      const tournamentsBatch: Omit<Tournament, 'id'>[] = [];
      const activeDirId = activeDirObj?.id || DataService.getActiveDirectorateId();

      for (const catId of selectedCategories) {
        for (const gen of gendersToGenerate) {
          const genderCatName = getCategoryGenderLabel(catId, gen);

          for (const affId of selectedAffiliations) {
            const affPrefix = affId === 'club_affiliated' ? 'بطولة المنتمين للأندية' : 'بطولة غير المنتمين للأندية';
            const genLabel = gen === 'Female' ? 'إناث' : gen === 'Male' ? 'ذكور' : 'مختلط';
            const normCat = normalizeCategoryKey(catId);
            const affConfig = TARGET_AFFILIATIONS.find(a => a.id === affId);
            const affLabel = affConfig?.label || (affId === 'non_club' ? 'غير المنتمين للأندية' : affId);
            
            // Formulate distinct tournament name according to standard
            const finalTournamentName = `${affPrefix} ${normCat} ${genLabel}`;

            tournamentsBatch.push({
              name: finalTournamentName,
              seasonId: currentSeason,
              sportId,
              ageCategory: catId,
              gender: gen,
              level: selectedLevels && selectedLevels.length > 0 ? selectedLevels.join(',') : (catId === 'U12' ? 'Primary' : catId === 'U15' ? 'Middle' : (catId === 'U18' || catId === 'U20') ? 'High' : 'Primary,Middle,High'),
              scope,
              affiliationType: affId,
              targetAffiliations: [affId],
              categoryStudentLimits: activeSportConfig?.categoryStudentLimits || {},
              startDate: new Date(startDate),
              endDate: new Date(endDate),
              registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : new Date(endDate),
              status,
              description: description.trim() || `بطولة مدرسية رسمية (${affLabel}) بـ ${activeDirObj?.name || 'المديرية الإقليمية'}`,
              directorateId: activeDirId
            });
          }
        }
      }

      // Sync sport dates & settings across tournaments
      try {
        await DataService.updateSportDates(sportId, {
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          registrationDeadline: registrationDeadline ? new Date(registrationDeadline) : null,
          status,
          description: description.trim(),
          level: selectedLevels.join(',')
        });
      } catch (err) {
        console.warn("Could not updateSportDates:", err);
      }

      // Submit batch array of tournaments
      await onCreated(tournamentsBatch);

      // Reset Form fields
      setName('');
      setDescription('');
      setSelectedCategories(['U15']);
      setSelectedLevels(['High']);
      setGenderSelection('Both');
      setSelectedAffiliations(availableAffiliations.map(a => a.id));
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء محاولة إنشاء البطولات');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs" dir="rtl">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-slate-900 dark:text-slate-100">
        {/* Header - Responsive & Centered on Mobile */}
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2.5 sm:gap-4 p-3.5 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-2.5 text-center sm:text-right w-full sm:w-auto">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-600/20 text-base sm:text-lg font-black shrink-0">
              {activeSportConfig?.icon || SPORTS_MAP[sportId]?.icon || <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />}
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 flex-wrap">
                <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  {isEditing ? 'نافذة موحدة ومختصرة' : 'برمجة جديدة'}
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold">
                  {status === 'Scheduled' ? '🟢 مبرمجة' : status === 'Ongoing' ? '🔴 جارية' : '⚪ مسودة'}
                </span>
              </div>
              <h3 className="text-xs sm:text-base font-black text-slate-800 dark:text-white mt-0.5 tracking-tight">
                {isEditing ? `تعديل وإعداد وبرمجة بطولة ${activeSportConfig?.name || SPORTS_MAP[sportId]?.name || ''}` : 'إضافة وإعداد وبرمجة بطولة إقليمية'}
              </h3>
              {/* Details: hidden on mobile */}
              <p className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {isEditing ? 'نافذة واحدة مختصرة لتعديل الفئات، وضوابط البرمجة، والتواريخ، وآخر أجل للتسجيل' : 'يقوم النظام بتوليد بطولات منفصلة لكل فئة وجنس ونوع انتساب محدد مع برمجة المواعيد'}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Tournament Name */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              الاسم الأساسي للبطولة / الدوري <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: البطولة الإقليمية المدرسية لكرة السلة"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <span className="text-[10px] text-slate-400 block mt-1 leading-relaxed">
              * سيقوم النظام بإضافة لواحق الجنس والفئة تلقائياً (مثال: - ذكور (البراعم U12)) لكل نسخة يتم توليدها.
            </span>
          </div>

          {/* Sport Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              صنف الرياضة / التخصص الرياضي <span className="text-red-500">*</span>
            </label>
            <select
              value={sportId}
              onChange={(e) => setSportId(e.target.value)}
              disabled={allowedSportIds !== null && allowedSportIds !== undefined && allowedSportIds.length === 1}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold disabled:bg-slate-100 disabled:text-slate-700 disabled:cursor-not-allowed cursor-pointer"
            >
              {availableSports.length > 0
                ? availableSports.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon || SPORTS_MAP[s.id]?.icon || '🏆'} {s.name}
                    </option>
                  ))
                : Object.entries(SPORTS_MAP)
                    .filter(([id]) => !allowedSportIds || allowedSportIds.includes(id))
                    .map(([id, info]) => (
                      <option key={id} value={id}>
                        {info.icon} {info.name}
                      </option>
                    ))}
            </select>
            <span className="text-[10px] text-slate-500 font-medium block mt-1">
              * تحديد صنف الرياضة يربط البطولات مباشرة بإشراف رئيس اللجنة التقنية الخاص بها (مثال: الكرة الطائرة تشمل كل بطولات الكرة الطائرة بالمديرية).
            </span>
            {isEditing && (
              <span className="text-[10px] text-blue-700 font-bold block mt-1 bg-blue-50 p-1.5 rounded border border-blue-200">
                ✏️ تعديل إعدادات وتصنيفات هذه الرياضة المبرمجة.
              </span>
            )}
            {!isEditing && allowedSportIds && allowedSportIds.length > 0 && (
              <span className="text-[10px] text-amber-700 font-bold block mt-1 bg-amber-50 p-1.5 rounded border border-amber-200">
                🔒 رئيس لجنة تقنية: مسند لك إضافة بطولات في تخصصك فقط.
              </span>
            )}
          </div>

          {/* Gender and Multi-select Age Categories */}
          <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-150 rounded-xl">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                تحديد الجنس (اختر لتوليد فروع الجنس)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGenderSelection('Both')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    genderSelection === 'Both'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  👫 الجنسين معاً (ذكور + إناث)
                </button>
                <button
                  type="button"
                  onClick={() => setGenderSelection('Male')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    genderSelection === 'Male'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  👦 ذكور فقط
                </button>
                <button
                  type="button"
                  onClick={() => setGenderSelection('Female')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    genderSelection === 'Female'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  👧 إناث فقط
                </button>
                <button
                  type="button"
                  onClick={() => setGenderSelection('Mixed')}
                  className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    genderSelection === 'Mixed'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  👥 مختلط (Mixed)
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  تحديد الفئات العمرية المستهدفة (اختر فئة أو أكثر) <span className="text-red-500">*</span>
                </label>
                <span className="text-[10px] text-slate-500 font-medium">
                  (جميع الفئات ليست فئة - يمكن تحديد فئة أو المشاركة في جميع الفئات)
                </span>
              </div>

              {loadingConfig ? (
                <div className="flex items-center gap-2 text-slate-400 text-xs py-2">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>جاري تحميل فئات التخصص الرياضي...</span>
                </div>
              ) : categoriesToRender.length === 0 ? (
                <p className="text-[11px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
                  ⚠️ لم يتم تفعيل أو إضافة أي فئة لهذا التخصص بعد في لوحة التحكم.
                </p>
              ) : (
                <div className="flex flex-col gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs">
                  {/* Dedicated Checkbox for "المشاركة في جميع الفئات" */}
                  <label className="flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-50 border border-emerald-300 hover:bg-emerald-100/90 cursor-pointer text-xs font-black text-emerald-950 transition-all shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={categoriesToRender.length > 0 && categoriesToRender.every(cat => selectedCategories.includes(cat.id))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCategories(categoriesToRender.map(cat => cat.id));
                          } else {
                            setSelectedCategories([]);
                          }
                        }}
                        className="rounded border-emerald-400 text-emerald-600 focus:ring-emerald-500 w-4.5 h-4.5 cursor-pointer accent-emerald-600"
                      />
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm">🏆</span>
                        <span className="font-black text-emerald-950 text-xs">المشاركة في جميع الفئات</span>
                      </span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-white px-2 py-0.5 rounded-md border border-emerald-200 shrink-0">
                      Check box الكل
                    </span>
                  </label>

                  <div className="pt-1 text-[11px] font-bold text-slate-500 pr-1">
                    أو حدد الفئات العمرية المطلوبة:
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {categoriesToRender.map((cat) => {
                      const isChecked = selectedCategories.includes(cat.id);
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                            isChecked
                              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-950 shadow-2xs'
                              : 'bg-slate-50/70 border-slate-200/80 text-slate-700 hover:bg-slate-100/80'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleCategory(cat.id)}
                            className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 w-4 h-4 cursor-pointer accent-emerald-600"
                          />
                          <span>{cat.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Affiliation / Target Classification Selector */}
          <div className="space-y-2.5 p-3.5 bg-amber-50/60 border border-amber-200/80 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-amber-700 shrink-0" />
                <label className="text-xs font-black text-amber-950">
                  الأصناف المستهدفة المتاحة للتسجيل في البطولة <span className="text-red-500">*</span>
                </label>
              </div>
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    const allIds = availableAffiliations.map(a => a.id);
                    setSelectedAffiliations(allIds);
                  }}
                  className="text-[10px] text-amber-800 hover:underline font-bold px-2 py-0.5 rounded bg-amber-100 border border-amber-300 cursor-pointer"
                >
                  تحديد جميع الأصناف
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (availableAffiliations.length > 0) {
                      setSelectedAffiliations([availableAffiliations[0].id]);
                    }
                  }}
                  className="text-[10px] text-slate-500 hover:underline font-bold px-2 py-0.5 rounded bg-white border border-slate-200 cursor-pointer"
                >
                  صنف واحد
                </button>
              </div>
            </div>
            
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              يتم إنشاء بطولة مستقلة لكل صنف يتم اختياره من الأصناف المحددة في ضوابط وإعدادات هذا التخصص الرياضي:
            </p>

            {/* Checkbox list */}
            <div className="space-y-2 pt-1">
              {/* Check All Toggle Banner */}
              <label className="flex items-center justify-between p-2.5 bg-amber-100/70 border border-amber-300/80 rounded-xl cursor-pointer hover:bg-amber-100 transition-colors">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={availableAffiliations.length > 0 && selectedAffiliations.length === availableAffiliations.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedAffiliations(availableAffiliations.map(a => a.id));
                      } else if (availableAffiliations.length > 0) {
                        setSelectedAffiliations([availableAffiliations[0].id]);
                      }
                    }}
                    className="rounded border-amber-400 text-amber-600 focus:ring-amber-500 w-4.5 h-4.5 cursor-pointer accent-amber-600"
                  />
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm">🎯</span>
                    <span className="font-black text-amber-950 text-xs">المشاركة وبرمجة جميع الأصناف المتاحة</span>
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                  Check box الكل ({selectedAffiliations.length} من {availableAffiliations.length})
                </span>
              </label>

              {/* Grid of Available Target Classifications */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {availableAffiliations.map((aff) => {
                  const isChecked = selectedAffiliations.includes(aff.id);
                  return (
                    <label
                      key={aff.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                        isChecked
                          ? 'bg-white border-amber-400 text-amber-950 shadow-xs ring-1 ring-amber-400/50'
                          : 'bg-white/60 border-slate-200 text-slate-600 hover:bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          setSelectedAffiliations(prev =>
                            isChecked
                              ? (prev.length > 1 ? prev.filter(id => id !== aff.id) : prev)
                              : [...prev, aff.id]
                          );
                        }}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer accent-amber-600"
                      />
                      <span className="text-base">{aff.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="block truncate">{aff.label}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تاريخ البداية
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تاريخ الاختتام المتوقع
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Registration Deadline */}
          <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3">
            <label className="block text-xs font-bold text-amber-900 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>آخر أجل لتسجيل التلاميذ والفرق (العداد الزمني)</span>
            </label>
            <input
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              className="w-full text-xs rounded-xl border border-amber-300 bg-white px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold"
            />
            <p className="text-[10px] text-amber-700 mt-1">
              بعد هذا الموعد، يقفل نظام التسجيل أوتوماتيكياً أمام الأساتذة ولا يمكن إضافة مشاركين جدد.
            </p>
          </div>

          {/* School Levels Selection */}
          <div className="space-y-2 p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-emerald-700" />
                <span>الأسلاك التعليمية المسموح لها بالمشاركة *</span>
              </label>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded border border-emerald-300">
                التحكم بالانتساب
              </span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              حدد سلك واحد أو أكثر ليتم فلترة ومنع تسجيل أي تلاميذ ينتمون لمؤسسات من خارج الأسلاك المحددة.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { id: 'Primary', label: 'ابتدائي' },
                { id: 'Middle', label: 'إعدادي' },
                { id: 'High', label: 'تأهيلي' }
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
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-3xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Scope & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                نطاق البطولة
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Provincial">إقليمية (مديرية تاوريرت)</option>
                <option value="Regional">جهوية (أكاديمية جهة الشرق)</option>
                <option value="National">وطنية (الجامعة الملكية المغربية للرياضة المدرسية)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                حالة البطولة
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Scheduled">مبرمجة وقيد الإعداد</option>
                <option value="Ongoing">جارية ومفتوحة</option>
                <option value="Draft">مسودة أولية</option>
              </select>
            </div>
          </div>

          {/* Technical Committee Authority Banner */}
          <div className="bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                <h4 className="text-xs font-black text-emerald-950 dark:text-emerald-100">إشراف وضوابط البطولة</h4>
              </div>
              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/90 text-emerald-800 dark:text-emerald-200 font-extrabold px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-700">
                اللجنة التقنية
              </span>
            </div>
            <p className="text-[11px] text-emerald-900 dark:text-emerald-200 font-bold leading-relaxed">
              يتولى رئيس اللجنة التقنية المكلّف بهذا الصنف الرياضي (والمعيّن من طرف المسؤول المركزي) كامل صلاحيات الإشراف والضوابط وإدارة المباريات والنتائج للبطولة.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات أو توصيف إضافي
            </label>
            <textarea
              rows={2}
              placeholder="مثال: تجرى المباريات بالقاعة المغطاة بتاوريرت، ويتأهل الفائز للبطولة الجهوية بوجدة..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

            {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            {(() => {
              const affMultiplier = selectedAffiliations.length > 0 ? selectedAffiliations.length : 1;
              const count = (sportId === 'cross_country' ? 1 : selectedCategories.length * (genderSelection === 'Both' ? 2 : 1)) * affMultiplier;
              return (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 rounded-xl transition-all shadow-md shadow-emerald-600/20 disabled:bg-emerald-300 cursor-pointer flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>{isEditing ? 'جاري حفظ وتحديث البطولة...' : `جاري إنشاء ${count} بطولات...`}</span>
                    </>
                  ) : (
                    <span>{isEditing ? `حفظ وتحديث البطولة (${count} ${count > 1 ? 'فروع/أجناس' : 'فرع'})` : `حفظ وإنشاء ${count} ${count > 1 ? 'بطولات' : 'بطولة'}`}</span>
                  )}
                </button>
              );
            })()}
          </div>
        </form>
      </div>
    </div>
  );
};
