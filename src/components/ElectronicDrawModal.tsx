import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Shuffle,
  Trophy,
  Calendar,
  MapPin,
  Clock,
  Save,
  CheckCircle2,
  Building2,
  Users,
  Layers,
  ArrowRight,
  FileSpreadsheet,
  Printer,
  Sparkles,
  AlertCircle,
  Plus,
  Trash2
} from 'lucide-react';
import { Tournament, School, Team, Match, User, Venue, Sport } from '../types';
import { DataService, SPORTS_MAP } from '../lib/dataService';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export interface GeneratedDrawMatch {
  id: string;
  stage: string;
  groupName?: string;
  team1Id: string;
  team1Name: string;
  team2Id: string;
  team2Name: string;
  date: string;
  time: string;
  venueId: string;
  venueName: string;
}

interface ElectronicDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onMatchesCreated?: () => void;
  initialTournamentId?: string;
}

export const ElectronicDrawModal: React.FC<ElectronicDrawModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onMatchesCreated,
  initialTournamentId
}) => {
  // Data State
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Workflow State: 1 = Choose Tournament, 2 = Review Teams & Draw Config, 3 = Draw & Schedule Matches
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(initialTournamentId || '');

  // Draw Configuration
  const [participatingSchoolIds, setParticipatingSchoolIds] = useState<string[]>([]);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>([]);
  const [newTeamInput, setNewTeamInput] = useState<string>('');
  const [drawSystem, setDrawSystem] = useState<'groups' | 'knockout'>('groups');
  const [groupsCount, setGroupsCount] = useState<number>(2);

  // Draw Result & Scheduled Matches
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawnGroups, setDrawnGroups] = useState<{ groupName: string; teams: { id: string; name: string }[] }[]>([]);
  const [generatedMatches, setGeneratedMatches] = useState<GeneratedDrawMatch[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Batch edit helper
  const [bulkDate, setBulkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [bulkTime, setBulkTime] = useState<string>('10:00');
  const [bulkVenueName, setBulkVenueName] = useState<string>('');

  // Load Tournaments & Data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [loadedTournaments, loadedSchools, loadedStudents, loadedVenues] = await Promise.all([
          DataService.getTournaments(),
          DataService.getSchools(),
          DataService.getStudents(),
          DataService.getVenues()
        ]);

        setTournaments(loadedTournaments);
        setSchools(loadedSchools);
        setVenues(loadedVenues);

        // Derive team records from students
        const derivedTeams: Team[] = [];
        const seenTeamKeys = new Set<string>();
        loadedStudents.forEach(st => {
          if (st.schoolId && st.sportId) {
            const key = `${st.schoolId}_${st.sportId}_${st.category || 'U15'}_${st.gender || 'Male'}`;
            if (!seenTeamKeys.has(key)) {
              seenTeamKeys.add(key);
              const sc = loadedSchools.find(s => s.id === st.schoolId);
              derivedTeams.push({
                id: `team_${st.schoolId}_${st.sportId}`,
                name: sc?.name || st.schoolName || 'فريق مدرسي',
                schoolId: st.schoolId,
                sportId: st.sportId,
                gender: (st.gender === 'Female' ? 'Female' : 'Male') as any,
                category: st.category || 'U15',
                directorateId: st.directorateId
              });
            }
          }
        });
        setTeams(derivedTeams);

        if (loadedVenues.length > 0) {
          setBulkVenueName(loadedVenues[0].name);
        }

        // If initialTournamentId passed, select it
        if (initialTournamentId) {
          setSelectedTournamentId(initialTournamentId);
          setStep(2);
        }
      } catch (err) {
        console.error('Failed to load draw data:', err);
        toast.error('حدث خطأ أثناء تحميل بيانات البطولة');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, initialTournamentId]);

  // Filter Tournaments based on User Role (بالنسبة لرئيس اللجنة تظهر له فقط البطولة الخاصة به)
  const accessibleTournaments = useMemo(() => {
    if (!currentUser) return tournaments;

    const userRole = currentUser.role;

    // Super Admins & Central Admins see all tournaments
    if (userRole === 'CENTRAL_ADMIN' || currentUser.isSuperAdmin) {
      return tournaments;
    }

    // Sport Managers / Tech Committee Heads: Show only their assigned sport or assigned tournaments
    const userSportId = currentUser.sportId;
    const userTechSports = currentUser.techCommitteeSports || [];
    const assignedTourId = currentUser.assignedTournamentId;

    return tournaments.filter(t => {
      if (assignedTourId && t.id === assignedTourId) return true;
      if (userSportId && t.sportId === userSportId) return true;
      if (userTechSports.includes(t.sportId)) return true;
      return false;
    });
  }, [tournaments, currentUser]);

  // Selected Tournament Object
  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  // When Tournament is selected, automatically detect participating schools/teams
  useEffect(() => {
    if (!selectedTournament) {
      setParticipatingSchoolIds([]);
      setCustomTeamNames([]);
      return;
    }

    // Find teams matching this tournament or sport
    const matchedTeams = teams.filter(t => {
      if (t.tournamentId && t.tournamentId === selectedTournament.id) return true;
      if (t.sportId === selectedTournament.sportId) {
        const catMatch = !selectedTournament.ageCategory || t.category === selectedTournament.ageCategory;
        const genMatch = !selectedTournament.gender || t.gender === selectedTournament.gender;
        return catMatch && genMatch;
      }
      return false;
    });

    let autoSchoolIds = matchedTeams.map(t => t.schoolId).filter(Boolean);

    // If no teams found explicitly, pre-populate with directorate schools
    if (autoSchoolIds.length === 0) {
      autoSchoolIds = schools.slice(0, 8).map(s => s.id);
    }

    setParticipatingSchoolIds(Array.from(new Set(autoSchoolIds)));
  }, [selectedTournament, teams, schools]);

  // Toggle school participation
  const toggleSchoolParticipation = (schoolId: string) => {
    setParticipatingSchoolIds(prev => 
      prev.includes(schoolId) ? prev.filter(id => id !== schoolId) : [...prev, schoolId]
    );
  };

  // Add custom manual team name
  const handleAddCustomTeam = () => {
    if (!newTeamInput.trim()) return;
    if (customTeamNames.includes(newTeamInput.trim())) {
      toast.error('هذا الفريق موجود مسبقاً');
      return;
    }
    setCustomTeamNames(prev => [...prev, newTeamInput.trim()]);
    setNewTeamInput('');
  };

  // Remove custom team
  const handleRemoveCustomTeam = (name: string) => {
    setCustomTeamNames(prev => prev.filter(t => t !== name));
  };

  // All participating teams ready for draw
  const allDrawTeams = useMemo(() => {
    const list: { id: string; name: string; schoolName?: string }[] = [];

    // From schools
    participatingSchoolIds.forEach(sId => {
      const school = schools.find(s => s.id === sId);
      if (school) {
        list.push({
          id: school.id,
          name: school.name,
          schoolName: school.name
        });
      }
    });

    // From custom names
    customTeamNames.forEach((cName, idx) => {
      list.push({
        id: `custom-team-${idx}`,
        name: cName,
        schoolName: cName
      });
    });

    return list;
  }, [participatingSchoolIds, customTeamNames, schools]);

  // Execute Electronic Draw (سحب القرعة آلياً)
  const handleExecuteDraw = () => {
    if (allDrawTeams.length < 2) {
      toast.error('يرجى تحديد فريقين على الأقل لإجراء القرعة');
      return;
    }

    setIsDrawing(true);

    setTimeout(() => {
      // Shuffle array randomly
      const shuffled = [...allDrawTeams].sort(() => Math.random() - 0.5);

      if (drawSystem === 'groups') {
        const alphabet = ['المجموعة أ (Groupe A)', 'المجموعة ب (Groupe B)', 'المجموعة ج (Groupe C)', 'المجموعة د (Groupe D)'];
        const groups: { groupName: string; teams: { id: string; name: string }[] }[] = [];

        const numGroups = Math.min(groupsCount, shuffled.length);
        for (let i = 0; i < numGroups; i++) {
          groups.push({
            groupName: alphabet[i] || `المجموعة ${i + 1}`,
            teams: []
          });
        }

        shuffled.forEach((team, index) => {
          const groupIdx = index % numGroups;
          groups[groupIdx].teams.push(team);
        });

        setDrawnGroups(groups);

        // Generate matches for each group (Round robin in each group)
        const matchesList: GeneratedDrawMatch[] = [];
        let matchCounter = 1;
        const defaultVenue = venues[0]?.name || 'القاعة المغطاة';
        const defaultDate = new Date().toISOString().slice(0, 10);

        groups.forEach(grp => {
          const grpTeams = grp.teams;
          for (let i = 0; i < grpTeams.length; i++) {
            for (let j = i + 1; j < grpTeams.length; j++) {
              matchesList.push({
                id: `gen-match-${matchCounter++}`,
                stage: `${grp.groupName} - الجولة ${i + 1}`,
                groupName: grp.groupName,
                team1Id: grpTeams[i].id,
                team1Name: grpTeams[i].name,
                team2Id: grpTeams[j].id,
                team2Name: grpTeams[j].name,
                date: defaultDate,
                time: `${9 + (matchCounter % 6)}:00`,
                venueId: venues[0]?.id || 'v1',
                venueName: defaultVenue
              });
            }
          }
        });

        setGeneratedMatches(matchesList);
      } else {
        // Knockout system (Direct elimination)
        const matchesList: GeneratedDrawMatch[] = [];
        let matchCounter = 1;
        const defaultVenue = venues[0]?.name || 'القاعة المغطاة';
        const defaultDate = new Date().toISOString().slice(0, 10);

        const totalMatches = Math.floor(shuffled.length / 2);
        for (let i = 0; i < totalMatches; i++) {
          const t1 = shuffled[i * 2];
          const t2 = shuffled[i * 2 + 1];
          matchesList.push({
            id: `gen-match-${matchCounter++}`,
            stage: totalMatches === 2 ? 'نصف النهائي' : totalMatches === 1 ? 'المباراة النهائية' : `دور خروج المغلوب (المباراة ${i + 1})`,
            team1Id: t1.id,
            team1Name: t1.name,
            team2Id: t2.id,
            team2Name: t2.name,
            date: defaultDate,
            time: `${9 + i * 2}:00`,
            venueId: venues[0]?.id || 'v1',
            venueName: defaultVenue
          });
        }

        setDrawnGroups([
          {
            groupName: 'أدوار خروج المغلوب',
            teams: shuffled
          }
        ]);
        setGeneratedMatches(matchesList);
      }

      setIsDrawing(false);
      setStep(3);
      toast.success('تمت القرعة وتوليد جدول المباريات بنجاح!');
    }, 700);
  };

  // Update match details (date, time, venue)
  const handleUpdateMatchField = (matchId: string, field: keyof GeneratedDrawMatch, value: string) => {
    setGeneratedMatches(prev => 
      prev.map(m => m.id === matchId ? { ...m, [field]: value } : m)
    );
  };

  // Apply batch date & venue to all matches
  const handleApplyBatchSchedule = () => {
    if (!bulkDate && !bulkVenueName) {
      toast.error('يرجى تحديد التاريخ أو مكان الإجراء');
      return;
    }

    setGeneratedMatches(prev => 
      prev.map(m => ({
        ...m,
        date: bulkDate || m.date,
        time: bulkTime || m.time,
        venueName: bulkVenueName || m.venueName
      }))
    );
    toast.success('تم تعميم التاريخ والمكان على جميع المباريات');
  };

  // Save all matches to database
  const handleSaveMatchesToDatabase = async () => {
    if (!selectedTournament) {
      toast.error('يرجى اختيار البطولة أولاً');
      return;
    }
    if (generatedMatches.length === 0) {
      toast.error('لا توجد مباريات لحفظها');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(`جاري حفظ ${generatedMatches.length} مباراة في جدول البطولة...`);

    try {
      for (const gm of generatedMatches) {
        await DataService.addMatch({
          tournamentId: selectedTournament.id,
          sportId: selectedTournament.sportId,
          stage: gm.stage,
          team1Id: gm.team1Id,
          team2Id: gm.team2Id,
          ageCategory: selectedTournament.ageCategory,
          gender: selectedTournament.gender,
          date: gm.date,
          startTime: gm.time || '10:00',
          venueId: gm.venueId || 'default-venue',
          status: 'Scheduled',
          updatedAt: new Date()
        });
      }

      toast.dismiss(toastId);
      toast.success('تم حفظ واعتماد جميع المباريات في المنظومة بنجاح!');
      if (onMatchesCreated) onMatchesCreated();
      onClose();
    } catch (err) {
      console.error('Failed to save matches:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء حفظ المباريات في قاعدة البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (generatedMatches.length === 0) return;

    const data = generatedMatches.map((m, idx) => ({
      'رقم المقابلة': idx + 1,
      'البطولة': selectedTournament?.name || '',
      'المرحلة / الدور': m.stage,
      'الفريق الأول': m.team1Name,
      'الفريق الثاني': m.team2Name,
      'تاريخ الإجراء': m.date,
      'توقيت الانطلاق': m.time,
      'مكان الإجراء': m.venueName
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'برنامج المباريات');
    XLSX.writeFile(wb, `برنامج_مباريات_${selectedTournament?.name || 'القرعة'}.xlsx`);
    toast.success('تم تصدير ملف Excel بنجاح');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-xl shadow-xs">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">القرعة الإلكترونية وبرمجة المباريات</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {currentUser?.role === 'SPORT_MANAGER' 
                  ? `خاص برئيس اللجنة / المسؤول الرياضي (${currentUser.fullName})` 
                  : 'توزيع المجموعات وتحديد مواعيد وأماكن إجراء المقابلات'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold shrink-0">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-blue-700 font-black' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>1</span>
            <span>اختيار نوع البطولة</span>
          </div>

          <div className="w-12 h-0.5 bg-slate-300" />

          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-blue-700 font-black' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>2</span>
            <span>المؤسسات ونظام القرعة</span>
          </div>

          <div className="w-12 h-0.5 bg-slate-300" />

          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-blue-700 font-black' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>3</span>
            <span>نتائج القرعة وتحديد المواعيد والأماكن</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
          
          {/* ========================================================================= */}
          {/* STEP 1: CHOOSE TOURNAMENT (اختيار نوع البطولة) */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900">اختر البطولة المعنية بإجراء القرعة:</h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {accessibleTournaments.length === 0 
                      ? 'لا توجد بطولات مسندة لك حالياً' 
                      : `يتم عرض البطولات المتاحة لك (${accessibleTournaments.length} بطولة)`}
                  </p>
                </div>
              </div>

              {accessibleTournaments.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-amber-800 space-y-2">
                  <AlertCircle className="w-8 h-8 mx-auto text-amber-600" />
                  <h5 className="font-black text-sm">لم يتم العثور على بطولات مخصصة</h5>
                  <p className="text-xs text-amber-700">
                    يرجى التأكد من إنشاء البطولة أولاً في صفحة "البطولات" أو إسناد التخصص الرياضي لحسابك.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {accessibleTournaments.map(t => {
                    const isSelected = selectedTournamentId === t.id;
                    const sportInfo = SPORTS_MAP[t.sportId] || { name: t.sportId, icon: '🏆' };
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTournamentId(t.id)}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-blue-50 border-blue-600 shadow-md ring-2 ring-blue-400/30'
                            : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">{sportInfo.icon}</span>
                            <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                              {t.scope || 'إقليمية'}
                            </span>
                          </div>

                          <div>
                            <h5 className="font-black text-sm text-slate-900 leading-snug">{t.name}</h5>
                            <p className="text-xs text-slate-500 font-bold mt-1">
                              {sportInfo.name} • {t.ageCategory || 'عامة'} • {t.gender === 'Female' ? 'إناث' : t.gender === 'Male' ? 'ذكور' : 'مختلط'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">{t.seasonId || '2025/2026'}</span>
                          <span className={`font-black ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                            {isSelected ? '✓ محددة' : 'اختر البطولة'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    if (!selectedTournamentId) {
                      toast.error('يرجى اختيار البطولة أولاً');
                      return;
                    }
                    setStep(2);
                  }}
                  disabled={!selectedTournamentId}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <span>التالي: معاينة المؤسسات المشاركة</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: PARTICIPATING SCHOOLS & DRAW CONFIG */}
          {/* ========================================================================= */}
          {step === 2 && selectedTournament && (
            <div className="space-y-5">
              
              {/* Tournament Summary Banner */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center text-xl shadow-xs">
                    {SPORTS_MAP[selectedTournament.sportId]?.icon || '🏆'}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 text-sm">{selectedTournament.name}</h4>
                    <p className="text-xs text-blue-800 font-bold">
                      {SPORTS_MAP[selectedTournament.sportId]?.name || selectedTournament.sportId} • الفئة: {selectedTournament.ageCategory} • {selectedTournament.gender === 'Female' ? 'إناث' : 'ذكور'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="text-xs text-blue-700 hover:underline font-bold"
                >
                  تغيير البطولة
                </button>
              </div>

              {/* Participating Schools Selection Card */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h5 className="font-black text-sm text-slate-900">
                      المؤسسات والفرق المشاركة في القرعة ({allDrawTeams.length} مؤسسة):
                    </h5>
                    <p className="text-xs text-slate-500 mt-0.5">
                      حدد المؤسسات التي ستدخل وعاء القرعة الإلكترونية
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setParticipatingSchoolIds(schools.map(s => s.id))}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                    >
                      تحديد الكل
                    </button>
                    <button
                      onClick={() => setParticipatingSchoolIds([])}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                {/* Schools Grid Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto p-1">
                  {schools.map(school => {
                    const isChecked = participatingSchoolIds.includes(school.id);
                    return (
                      <div
                        key={school.id}
                        onClick={() => toggleSchoolParticipation(school.id)}
                        className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isChecked 
                            ? 'bg-blue-50/70 border-blue-400 text-blue-950 font-bold' 
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <Building2 className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-blue-600' : 'text-slate-400'}`} />
                          <span className="truncate">{school.name}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // Handled by parent div
                          className="rounded-sm text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Manual custom team input */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    value={newTeamInput}
                    onChange={(e) => setNewTeamInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddCustomTeam()}
                    placeholder="أو أضف اسم فريق / مؤسسة إضافية يدوياً..."
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <button
                    onClick={handleAddCustomTeam}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>إضافة</span>
                  </button>
                </div>

                {customTeamNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {customTeamNames.map((name, i) => (
                      <span key={i} className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5">
                        <span>{name}</span>
                        <button onClick={() => handleRemoveCustomTeam(name)} className="text-amber-600 hover:text-amber-900">
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Draw Options (نظام القرعة) */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
                <h5 className="font-black text-sm text-slate-900">نظام وتوزيع القرعة الإلكترونية:</h5>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setDrawSystem('groups')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      drawSystem === 'groups'
                        ? 'bg-amber-50 border-amber-500 shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs text-slate-900">نظام المجموعات (Group Stage)</span>
                      <Layers className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      تقسيم الفرق إلى مجموعات متكافئة وإجراء دوري داخل كل مجموعة.
                    </p>
                  </div>

                  <div
                    onClick={() => setDrawSystem('knockout')}
                    className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                      drawSystem === 'knockout'
                        ? 'bg-amber-50 border-amber-500 shadow-sm'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-black text-xs text-slate-900">نظام خروج المغلوب (Knockout)</span>
                      <Trophy className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      مواجهات إقصائية مباشرة (نصف النهائي، النهائي، أو دور الـ 8).
                    </p>
                  </div>
                </div>

                {drawSystem === 'groups' && (
                  <div className="flex items-center gap-3 pt-2">
                    <label className="text-xs font-black text-slate-700">عدد المجموعات المطلوبة:</label>
                    <div className="flex gap-2">
                      {[2, 3, 4].map(num => (
                        <button
                          key={num}
                          onClick={() => setGroupsCount(num)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                            groupsCount === num
                              ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                              : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          {num} مجموعات
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  رجوع
                </button>

                <button
                  onClick={handleExecuteDraw}
                  disabled={isDrawing || allDrawTeams.length < 2}
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
                >
                  <Shuffle className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                  <span>{isDrawing ? 'جاري سحب القرعة الإلكترونية...' : 'سحب القرعة آلياً وتوليد المباريات 🎲'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: DRAW RESULTS & SCHEDULING (تحديد التواريخ ومكان الإجراء) */}
          {/* ========================================================================= */}
          {step === 3 && (
            <div className="space-y-6">
              
              {/* Groups Distribution Overview */}
              {drawnGroups.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-black text-sm text-slate-900 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-500" />
                      <span>نتائج القرعة الإلكترونية المعتمدة:</span>
                    </h5>
                    <button
                      onClick={handleExecuteDraw}
                      className="text-xs text-amber-700 font-bold hover:underline flex items-center gap-1"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      <span>إعادة السحب</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {drawnGroups.map((grp, gIdx) => (
                      <div key={gIdx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="font-black text-blue-700 text-xs">{grp.groupName}</span>
                          <span className="text-[10px] font-bold text-slate-500 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                            {grp.teams.length} فرق
                          </span>
                        </div>
                        <ul className="space-y-1.5">
                          {grp.teams.map((t, ti) => (
                            <li key={ti} className="text-xs font-bold text-slate-800 flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200/80">
                              <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-black flex items-center justify-center shrink-0">
                                {ti + 1}
                              </span>
                              <span className="truncate">{t.name}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Batch Match Schedule Fast-Fill */}
              <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h6 className="font-black text-xs text-blue-950">تعميم سريع للتاريخ ومكان الإجراء:</h6>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    حدد تاريخاً ومكاناً موحداً لملء كافة المقابلات بضغطة زر
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    value={bulkDate}
                    onChange={(e) => setBulkDate(e.target.value)}
                    className="bg-white border border-blue-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden"
                  />
                  <input
                    type="time"
                    value={bulkTime}
                    onChange={(e) => setBulkTime(e.target.value)}
                    className="bg-white border border-blue-300 rounded-xl px-2 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden font-mono"
                  />
                  <input
                    type="text"
                    value={bulkVenueName}
                    onChange={(e) => setBulkVenueName(e.target.value)}
                    placeholder="مكان الإجراء..."
                    className="bg-white border border-blue-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 focus:outline-hidden w-36"
                  />
                  <button
                    onClick={handleApplyBatchSchedule}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer"
                  >
                    تطبيق على الكل
                  </button>
                </div>
              </div>

              {/* Generated Matches Table with Interactive Scheduling Controls */}
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-black text-sm text-slate-900">
                    جدول المقابلات وتحديد التواريخ والأماكن ({generatedMatches.length} مباراة):
                  </h5>
                  <button
                    onClick={handleExportExcel}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>تصدير Excel</span>
                  </button>
                </div>

                {/* Matches Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-slate-900 text-white font-black">
                      <tr>
                        <th className="py-3 px-3 w-12 text-center">#</th>
                        <th className="py-3 px-3">المرحلة / الدور</th>
                        <th className="py-3 px-3">المواجهة (الفريق 1 ضد الفريق 2)</th>
                        <th className="py-3 px-3 w-36">تاريخ المقابلة</th>
                        <th className="py-3 px-3 w-28">التوقيت</th>
                        <th className="py-3 px-3 w-48">مكان الإجراء</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {generatedMatches.map((m, idx) => (
                        <tr key={m.id} className="hover:bg-slate-50 transition-all">
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-700">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 text-[11px]">
                              {m.stage}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-2 font-black text-slate-900">
                              <span className="text-blue-700 truncate max-w-[140px]">{m.team1Name}</span>
                              <span className="text-[10px] text-slate-400 font-bold">ضد</span>
                              <span className="text-amber-700 truncate max-w-[140px]">{m.team2Name}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="date"
                              value={m.date}
                              onChange={(e) => handleUpdateMatchField(m.id, 'date', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:bg-white"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="time"
                              value={m.time}
                              onChange={(e) => handleUpdateMatchField(m.id, 'time', e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:bg-white font-mono"
                            />
                          </td>
                          <td className="py-2.5 px-3">
                            <input
                              type="text"
                              value={m.venueName}
                              onChange={(e) => handleUpdateMatchField(m.id, 'venueName', e.target.value)}
                              placeholder="القاعة / الملعب..."
                              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 focus:bg-white"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bottom Final Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  تعديل المؤسسات والقرعة
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveMatchesToDatabase}
                    disabled={isSaving || generatedMatches.length === 0}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-black rounded-xl text-xs flex items-center gap-2 shadow-md shadow-emerald-600/25 disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isSaving ? 'جاري حفظ واعتماد المباريات...' : 'حفظ واعتماد المقابلات في جدول البطولة ✓'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
};
