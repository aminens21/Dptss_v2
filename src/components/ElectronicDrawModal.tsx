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
  Trash2,
  Filter,
  Search,
  UserCheck,
  ShieldCheck,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  ShieldAlert,
  Volleyball
} from 'lucide-react';
import { Tournament, School, Team, Match, User, Venue, Sport, Referee } from '../types';
import { DataService, SPORTS_MAP, deduplicateById } from '../lib/dataService';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export const TEAM_SPORTS_IDS = ['football', 'basketball', 'handball', 'volleyball', 'rugby', 'futsal'];

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
  refereeId?: string;
  refereeName?: string;
  referee2Id?: string;
  referee2Name?: string;
}

interface ElectronicDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onMatchesCreated?: () => void;
  initialTournamentId?: string;
  initialSportId?: string;
}

export const ElectronicDrawModal: React.FC<ElectronicDrawModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onMatchesCreated,
  initialTournamentId,
  initialSportId
}) => {
  // Data State
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Workflow State: 1 = Choose Tournament & Filter, 2 = Review Teams & Draw Config, 3 = Draw & Schedule Matches with Referees
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(initialTournamentId || '');

  // Step 1 Filtering Options
  const [sportsCategoryFilter, setSportsCategoryFilter] = useState<'TEAM_SPORTS' | 'ALL'>('TEAM_SPORTS');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>(initialSportId || 'ALL');
  const [selectedAgeCategoryFilter, setSelectedAgeCategoryFilter] = useState<string>('ALL');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('ALL');
  const [tournamentSearchQuery, setTournamentSearchQuery] = useState<string>('');

  // Step 2: Draw Configuration & Participating Schools
  const [participatingSchoolIds, setParticipatingSchoolIds] = useState<string[]>([]);
  const [customTeamNames, setCustomTeamNames] = useState<string[]>([]);
  const [newTeamInput, setNewTeamInput] = useState<string>('');
  const [drawSystem, setDrawSystem] = useState<'groups' | 'knockout'>('groups');
  const [groupsCount, setGroupsCount] = useState<number>(2);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState<string>('');

  // Step 3: Draw Result & Scheduled Matches with Referees
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawnGroups, setDrawnGroups] = useState<{ groupName: string; teams: { id: string; name: string }[] }[]>([]);
  const [generatedMatches, setGeneratedMatches] = useState<GeneratedDrawMatch[]>([]);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Batch edit helpers
  const [bulkDate, setBulkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [bulkTime, setBulkTime] = useState<string>('10:00');
  const [bulkVenueName, setBulkVenueName] = useState<string>('');
  const [bulkRefereeId, setBulkRefereeId] = useState<string>('');

  // Load Tournaments, Referees, Teachers & Data
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const [
          loadedTournaments,
          loadedSports,
          loadedSchools,
          loadedStudents,
          loadedVenues,
          loadedReferees,
          loadedTeachers
        ] = await Promise.all([
          DataService.getTournaments(),
          DataService.getSportsConfig(),
          DataService.getSchools(),
          DataService.getStudents(),
          DataService.getVenues(),
          DataService.getReferees(),
          DataService.getTeachers()
        ]);

        setTournaments(loadedTournaments);
        setSportsConfig(loadedSports);
        setSchools(loadedSchools);
        setVenues(loadedVenues);
        setReferees(loadedReferees);
        setTeachers(loadedTeachers);

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

        // Auto restrict sport filter for Technical Committee Head
        if (currentUser) {
          const isTechHead = currentUser.isTechCommitteeHead || currentUser.role === 'SPORT_MANAGER';
          const isCentralAdmin = currentUser.role === 'CENTRAL_ADMIN' || currentUser.isSuperAdmin;

          if (isTechHead && !isCentralAdmin) {
            const assignedSport = currentUser.sportId || (currentUser.techCommitteeSports && currentUser.techCommitteeSports[0]);
            if (assignedSport) {
              setSelectedSportFilter(assignedSport);
            }
          }
        }

        // If initialTournamentId passed, select it
        if (initialTournamentId) {
          setSelectedTournamentId(initialTournamentId);
          setStep(2);
        } else if (initialSportId) {
          setSelectedSportFilter(initialSportId);
          const matchingTourns = loadedTournaments.filter(t => t.sportId === initialSportId);
          if (matchingTourns.length === 1) {
            setSelectedTournamentId(matchingTourns[0].id);
            setStep(2);
          }
        }
      } catch (err) {
        console.error('Failed to load draw data:', err);
        toast.error('حدث خطأ أثناء تحميل بيانات البطولة');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [isOpen, initialTournamentId, initialSportId, currentUser]);

  // Combined Referees List (Official Referees + Qualified Teachers)
  const combinedRefereesList = useMemo(() => {
    const list: { id: string; name: string; phone?: string; specialty?: string; type: 'referee' | 'teacher' }[] = [];

    referees.forEach(r => {
      list.push({
        id: r.id,
        name: `حكم: ${r.fullName}`,
        phone: r.phone,
        specialty: r.specialty?.join('، '),
        type: 'referee'
      });
    });

    teachers.forEach(t => {
      list.push({
        id: t.id,
        name: `أستاذ(ة): ${t.fullName} (${t.workLocation || 'مؤسسة'})`,
        phone: t.phone,
        specialty: t.refereeSpecialty?.join('، '),
        type: 'teacher'
      });
    });

    return list;
  }, [referees, teachers]);

  // Check if current user has restricted sport permissions
  const userSportRestriction = useMemo(() => {
    if (!currentUser) return null;
    const isCentralAdmin = currentUser.role === 'CENTRAL_ADMIN' || currentUser.isSuperAdmin;
    if (isCentralAdmin) return null;

    const isTechHead = currentUser.isTechCommitteeHead || currentUser.role === 'SPORT_MANAGER';
    if (isTechHead) {
      const allowedSports = new Set<string>();
      if (currentUser.sportId) allowedSports.add(currentUser.sportId);
      if (currentUser.techCommitteeSports) currentUser.techCommitteeSports.forEach(s => allowedSports.add(s));
      return Array.from(allowedSports);
    }

    return null;
  }, [currentUser]);

  // Filter Tournaments based on User Role, Team Sports, Sport, Category & Gender
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
      // 1. Role-Based Permission Filter (بالنسبة لرئيس اللجنة التقنية تظهر له فقط الرياضة الخاصة به)
      if (userSportRestriction && userSportRestriction.length > 0) {
        if (!userSportRestriction.includes(t.sportId)) {
          return false;
        }
      }

      // 2. Team Sports Filter (الرياضات الجماعية)
      if (sportsCategoryFilter === 'TEAM_SPORTS') {
        const isTeamSport = TEAM_SPORTS_IDS.includes(t.sportId) || (t.name && (
          t.name.includes('قدم') || t.name.includes('سلة') || t.name.includes('يد') || t.name.includes('طائرة') || t.name.includes('ريكبي')
        ));
        if (!isTeamSport) return false;
      }

      // 3. Sport Type Filter
      if (selectedSportFilter !== 'ALL' && t.sportId !== selectedSportFilter) {
        return false;
      }

      // 4. Age Category Filter
      if (selectedAgeCategoryFilter !== 'ALL') {
        const tCat = (t.ageCategory || '').toUpperCase();
        if (!tCat.includes(selectedAgeCategoryFilter.toUpperCase())) {
          return false;
        }
      }

      // 5. Gender Filter
      if (selectedGenderFilter !== 'ALL') {
        if (t.gender && t.gender !== selectedGenderFilter && t.gender !== 'Mixed') {
          return false;
        }
      }

      // 6. Search Query
      if (tournamentSearchQuery.trim()) {
        const q = tournamentSearchQuery.toLowerCase();
        const matchName = (t.name || '').toLowerCase().includes(q);
        const matchSport = (SPORTS_MAP[t.sportId]?.name || '').toLowerCase().includes(q);
        if (!matchName && !matchSport) return false;
      }

      return true;
    });
  }, [
    tournaments,
    userSportRestriction,
    sportsCategoryFilter,
    selectedSportFilter,
    selectedAgeCategoryFilter,
    selectedGenderFilter,
    tournamentSearchQuery
  ]);

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

  const handleSelectAllSchools = () => {
    setParticipatingSchoolIds(schools.map(s => s.id));
  };

  const handleDeselectAllSchools = () => {
    setParticipatingSchoolIds([]);
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

    customTeamNames.forEach((cName, idx) => {
      list.push({
        id: `custom-team-${idx}`,
        name: cName,
        schoolName: cName
      });
    });

    return list;
  }, [participatingSchoolIds, customTeamNames, schools]);

  // Filtered Schools for step 2 search
  const filteredSchoolsList = useMemo(() => {
    if (!schoolSearchQuery.trim()) return schools;
    const q = schoolSearchQuery.toLowerCase();
    return schools.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.commune || '').toLowerCase().includes(q) ||
      (s.type || '').toLowerCase().includes(q)
    );
  }, [schools, schoolSearchQuery]);

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
        const defaultRef = combinedRefereesList[0];

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
                venueName: defaultVenue,
                refereeId: defaultRef?.id,
                refereeName: defaultRef?.name
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
        const defaultRef = combinedRefereesList[0];

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
            venueName: defaultVenue,
            refereeId: defaultRef?.id,
            refereeName: defaultRef?.name
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

  // Update match details (date, time, venue, referee)
  const handleUpdateMatchField = (matchId: string, field: keyof GeneratedDrawMatch, value: string) => {
    setGeneratedMatches(prev => 
      prev.map(m => {
        if (m.id !== matchId) return m;
        if (field === 'refereeId') {
          const ref = combinedRefereesList.find(r => r.id === value);
          return {
            ...m,
            refereeId: value,
            refereeName: ref?.name || value
          };
        }
        return { ...m, [field]: value };
      })
    );
  };

  // Apply batch date, venue & referee to all matches
  const handleApplyBatchSchedule = () => {
    if (!bulkDate && !bulkVenueName && !bulkRefereeId) {
      toast.error('يرجى تحديد التاريخ، المكان أو الحكم لتعميمه');
      return;
    }

    const ref = combinedRefereesList.find(r => r.id === bulkRefereeId);

    setGeneratedMatches(prev => 
      prev.map(m => ({
        ...m,
        date: bulkDate || m.date,
        time: bulkTime || m.time,
        venueName: bulkVenueName || m.venueName,
        refereeId: bulkRefereeId || m.refereeId,
        refereeName: ref ? ref.name : m.refereeName
      }))
    );
    toast.success('تم تعميم التوقيت والمكان والحكام على جميع المباريات');
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
    const toastId = toast.loading(`جاري حفظ ${generatedMatches.length} مباراة مع تعيين الحكام في جدول البطولة...`);

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
          venueName: gm.venueName,
          referee1Id: gm.refereeId,
          status: 'Scheduled',
          updatedAt: new Date()
        });
      }

      toast.dismiss(toastId);
      toast.success('تم حفظ واعتماد جميع المباريات والحكام في المنظومة بنجاح!');
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
      'مكان الإجراء': m.venueName,
      'حكم المقابلة': m.refereeName || 'غير محدد'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'برنامج المباريات والحكام');
    XLSX.writeFile(wb, `برنامج_مباريات_${selectedTournament?.name || 'القرعة'}.xlsx`);
    toast.success('تم تصدير ملف Excel بنجاح');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl shadow-xs font-black">
              <Shuffle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">القرعة الإلكترونية وبرمجة المباريات وتعيين الحكام</h3>
                {userSportRestriction && userSportRestriction.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-slate-950 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    <span>صلاحية محددة برياضتك</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-100/90 mt-0.5 font-medium">
                فلترة الرياضات الجماعية، إجراء القرعة العادلة، تحديد المواعيد والملاعب وتعيين الحكام
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper Progress Bar */}
        <div className="bg-slate-100 px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold shrink-0">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-emerald-800 font-black' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>1</span>
            <span>1. اختيار نوع البطولة والفلترة</span>
          </div>

          <div className="w-12 h-0.5 bg-slate-300" />

          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-emerald-800 font-black' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>2</span>
            <span>2. المؤسسات ونظام القرعة</span>
          </div>

          <div className="w-12 h-0.5 bg-slate-300" />

          <div className={`flex items-center gap-2 ${step >= 3 ? 'text-emerald-800 font-black' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>3</span>
            <span>3. المواعيد والملاعب وتعيين الحكام</span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 space-y-6">
          
          {/* ========================================================================= */}
          {/* STEP 1: CHOOSE TOURNAMENT & MULTI-CRITERIA FILTERING */}
          {/* ========================================================================= */}
          {step === 1 && (
            <div className="space-y-5">
              
              {/* Role restriction banner for Tech Committee Head */}
              {userSportRestriction && userSportRestriction.length > 0 && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-300 rounded-2xl flex items-center justify-between gap-3 text-amber-950">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                      🔒
                    </div>
                    <div>
                      <h5 className="text-xs font-black">حساب رئيس لجنة تقنية معتمد</h5>
                      <p className="text-[11px] text-amber-900 font-medium">
                        تم تقييد القرعة للرياضات المسندة لك فقط ({userSportRestriction.map(s => SPORTS_MAP[s]?.name || s).join('، ')}). لا يحق إجراء القرعة لرياضات أخرى التزاماً بضوابط الصلاحيات.
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-md shrink-0">
                    صلاحية مؤمنة
                  </span>
                </div>
              )}

              {/* FILTERS TOOLBAR */}
              <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                    <Filter className="w-4 h-4 text-emerald-600" />
                    <span>فلترة البطولات المستهدفة للقرعة:</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-400">
                    {filteredTournaments.length} بطولة مطابقة للفلترة
                  </span>
                </div>

                {/* Filter Row 1: Team Sports vs All */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-xs font-bold text-slate-600 ml-1">نوع المنافسة:</span>
                  
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
                    <button
                      onClick={() => setSportsCategoryFilter('TEAM_SPORTS')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        sportsCategoryFilter === 'TEAM_SPORTS'
                          ? 'bg-emerald-600 text-white shadow-xs font-black'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <span>⚽ الرياضات الجماعية (Team Sports)</span>
                    </button>

                    <button
                      onClick={() => setSportsCategoryFilter('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        sportsCategoryFilter === 'ALL'
                          ? 'bg-slate-900 text-white shadow-xs font-black'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      <span>🏆 جميع الرياضات المبرمجة</span>
                    </button>
                  </div>
                </div>

                {/* Filter Row 2: Specific Sport, Age Category & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  
                  {/* Specific Sport Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {userSportRestriction && userSportRestriction.length > 0 ? '🔒 رياضتك المصرح بها فقط:' : 'نوع الرياضة:'}
                    </label>
                    <select
                      value={selectedSportFilter}
                      onChange={(e) => setSelectedSportFilter(e.target.value)}
                      disabled={Boolean(userSportRestriction && userSportRestriction.length === 1)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:opacity-80"
                    >
                      {(!userSportRestriction || userSportRestriction.length > 1) && (
                        <option value="ALL">-- كل الرياضات --</option>
                      )}
                      {(sportsCategoryFilter === 'TEAM_SPORTS' 
                        ? sportsConfig.filter(s => TEAM_SPORTS_IDS.includes(s.id))
                        : sportsConfig
                      )
                      .filter(s => !userSportRestriction || userSportRestriction.length === 0 || userSportRestriction.includes(s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.icon || '🏆'} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Age Category Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">الفئة العمرية المشاركة:</label>
                    <select
                      value={selectedAgeCategoryFilter}
                      onChange={(e) => setSelectedAgeCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="ALL">-- جميع الفئات --</option>
                      <option value="U12">براعم (U12) - مواليد 2015 فما فوق</option>
                      <option value="U15">صغار (U15) - مواليد 2012/2013/2014</option>
                      <option value="U18">فتيان (U18) - مواليد 2009/2010/2011</option>
                      <option value="U20">شبان (U20) - مواليد 2009 وما بعد</option>
                    </select>
                  </div>

                  {/* Gender Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">الجنس:</label>
                    <select
                      value={selectedGenderFilter}
                      onChange={(e) => setSelectedGenderFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="ALL">-- ذكور وإناث --</option>
                      <option value="Male">🏃‍♂️ ذكور</option>
                      <option value="Female">🏃‍♀️ إناث</option>
                    </select>
                  </div>

                </div>

                {/* Search Bar */}
                <div className="relative pt-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
                  <input
                    type="text"
                    value={tournamentSearchQuery}
                    onChange={(e) => setTournamentSearchQuery(e.target.value)}
                    placeholder="ابحث باسم البطولة أو التخصص الرياضي..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Tournaments Grid */}
              {filteredTournaments.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center text-amber-900 space-y-2">
                  <AlertCircle className="w-10 h-10 mx-auto text-amber-600" />
                  <h5 className="font-black text-sm">لا توجد بطولات مطابقة لمعايير الفلترة المحددة</h5>
                  <p className="text-xs text-amber-700 max-w-md mx-auto">
                    يرجى تغيير معايير الفلترة أو التأكد من إسناد البطولة والتخصص الرياضي لحسابك.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredTournaments.map(t => {
                    const isSelected = selectedTournamentId === t.id;
                    const sportInfo = SPORTS_MAP[t.sportId] || { name: t.sportId, icon: '🏆' };
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTournamentId(t.id)}
                        className={`p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-600 shadow-md ring-2 ring-emerald-400/30'
                            : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-2xl p-2 bg-slate-50 rounded-xl border border-slate-100">{sportInfo.icon}</span>
                            <span className="px-2.5 py-0.5 text-[10px] font-black rounded-full bg-slate-100 text-slate-700 border border-slate-200">
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
                          <span className="text-slate-400 font-medium">{t.seasonId || '2026/2027'}</span>
                          <span className={`font-black ${isSelected ? 'text-emerald-700' : 'text-slate-600'}`}>
                            {isSelected ? '✓ محددة للقرعة' : 'اختر البطولة'}
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
                      toast.error('يرجى اختيار البطولة أولاً للمتابعة');
                      return;
                    }
                    setStep(2);
                  }}
                  disabled={!selectedTournamentId}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <span>التالي: تحديد المؤسسات المشاركة ونظام القرعة</span>
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
              <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow-xs">
                    {SPORTS_MAP[selectedTournament.sportId]?.icon || '🏆'}
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950">{selectedTournament.name}</h4>
                    <p className="text-xs text-emerald-800 font-bold">
                      {SPORTS_MAP[selectedTournament.sportId]?.name} • {selectedTournament.ageCategory} • {selectedTournament.gender === 'Female' ? 'إناث' : 'ذكور'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className="px-3 py-1.5 bg-white text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold border border-emerald-200 cursor-pointer"
                >
                  تغيير البطولة
                </button>
              </div>

              {/* Draw System Selector (مجموعات أو خروج مغلوب) */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-emerald-600" />
                  <span>نظام القرعة والتوزيع:</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    onClick={() => setDrawSystem('groups')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      drawSystem === 'groups'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl">👥</span>
                    <div>
                      <h5 className="font-black text-xs text-slate-900">نظام المجموعات (دور المجموعات)</h5>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        توزيع الفرق عشوائياً على مجموعات (A, B, C...) مع توليد مباريات كل دور.
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setDrawSystem('knockout')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      drawSystem === 'knockout'
                        ? 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl">⚔️</span>
                    <div>
                      <h5 className="font-black text-xs text-slate-900">نظام خروج المغلوب المباشر (Knockout)</h5>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        مواجهات إقصائية مباشرة (نصف نهائي، نهائي...) مع تأهل الفائز.
                      </p>
                    </div>
                  </div>
                </div>

                {drawSystem === 'groups' && (
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                    <span className="text-xs font-bold text-slate-700">عدد المجموعات المراد تكوينها:</span>
                    <div className="flex items-center gap-2">
                      {[2, 3, 4].map(num => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setGroupsCount(num)}
                          className={`w-9 h-9 rounded-xl font-black text-xs transition-all cursor-pointer ${
                            groupsCount === num
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Participating Schools Selection Box */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>تحديد المؤسسات المشاركة في القرعة ({allDrawTeams.length} فريق محدد):</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      حدد المؤسسات التعليمية التي ستدخل في وعاء السحب الإلكتروني للقرعة
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAllSchools}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      تحديد الكل
                    </button>
                    <button
                      onClick={handleDeselectAllSchools}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                {/* School Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
                  <input
                    type="text"
                    value={schoolSearchQuery}
                    onChange={(e) => setSchoolSearchQuery(e.target.value)}
                    placeholder="ابحث باسم المؤسسة أو الجماعة..."
                    className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                {/* Schools Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1">
                  {filteredSchoolsList.map(school => {
                    const isSelected = participatingSchoolIds.includes(school.id);
                    return (
                      <div
                        key={school.id}
                        onClick={() => toggleSchoolParticipation(school.id)}
                        className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between text-xs ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-950 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="text-sm">🏫</span>
                          <span className="truncate">{school.name}</span>
                        </div>
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Custom Manual Team */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                  <input
                    type="text"
                    value={newTeamInput}
                    onChange={(e) => setNewTeamInput(e.target.value)}
                    placeholder="أو إضافة اسم فريق مخصص..."
                    className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                  <button
                    onClick={handleAddCustomTeam}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    إضافة فريق
                  </button>
                </div>

                {/* Custom teams pills */}
                {customTeamNames.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {customTeamNames.map((cName, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold"
                      >
                        <span>{cName}</span>
                        <X
                          onClick={() => handleRemoveCustomTeam(cName)}
                          className="w-3 h-3 hover:text-rose-600 cursor-pointer"
                        />
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  الرجوع للخطوة 1
                </button>

                <button
                  onClick={handleExecuteDraw}
                  disabled={allDrawTeams.length < 2 || isDrawing}
                  className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                >
                  <Shuffle className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                  <span>{isDrawing ? 'جاري السحب العشوائي...' : 'إجراء القرعة الإلكترونية وتوليد المباريات'}</span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: DRAW RESULTS, DATES, VENUES & REFEREES ASSIGNMENT */}
          {/* ========================================================================= */}
          {step === 3 && selectedTournament && (
            <div className="space-y-6">
              
              {/* Groups Distribution Overview */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span>نتائج قرعة المجموعات والمسارات:</span>
                  </h4>
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    تم التوزيع العشوائي بنجاح
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  {drawnGroups.map((grp, idx) => (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
                        <span className="text-xs font-black text-slate-900">{grp.groupName}</span>
                        <span className="text-[10px] font-bold bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                          {grp.teams.length} فرق
                        </span>
                      </div>

                      <div className="space-y-1">
                        {grp.teams.map((t, tIdx) => (
                          <div key={t.id} className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">
                              {tIdx + 1}
                            </span>
                            <span className="truncate">{t.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* BATCH SCHEDULING & REFEREE TOOLBAR */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-4 rounded-3xl border border-emerald-200 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-xs font-black text-emerald-950">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>تعميم التاريخ، الملعب، وتعيين الحكم على جميع المباريات دفعة واحدة:</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">التاريخ الموحد:</label>
                    <input
                      type="date"
                      value={bulkDate}
                      onChange={(e) => setBulkDate(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">التوقيت الافتراضي:</label>
                    <input
                      type="time"
                      value={bulkTime}
                      onChange={(e) => setBulkTime(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">مكان الإجراء (الملعب/القاعة):</label>
                    <input
                      type="text"
                      value={bulkVenueName}
                      onChange={(e) => setBulkVenueName(e.target.value)}
                      placeholder="القاعة المغطاة تاوريرت"
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">تعيين الحكم لجميع المباريات:</label>
                    <select
                      value={bulkRefereeId}
                      onChange={(e) => setBulkRefereeId(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="">-- اختر حكماً لتعميمه --</option>
                      {combinedRefereesList.map(ref => (
                        <option key={ref.id} value={ref.id}>{ref.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleApplyBatchSchedule}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    تطبيق على كل المباريات
                  </button>
                </div>
              </div>

              {/* GENERATED MATCHES LIST WITH DATES, VENUES & REFEREES */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>جدول المباريات المبرمجة وتعيين الحكام ({generatedMatches.length} مباراة):</span>
                  </h4>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportExcel}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تصدير Excel</span>
                    </button>
                  </div>
                </div>

                {/* Match Cards */}
                <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                  {generatedMatches.map((match, mIdx) => (
                    <div
                      key={match.id}
                      className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs"
                    >
                      {/* Match Teams & Stage */}
                      <div className="space-y-1.5 min-w-[240px]">
                        <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-bold text-[10px]">
                          {match.stage} • مقابلة #{mIdx + 1}
                        </span>
                        <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                          <span className="text-emerald-700">{match.team1Name}</span>
                          <span className="text-slate-400 font-mono">VS</span>
                          <span className="text-blue-700">{match.team2Name}</span>
                        </div>
                      </div>

                      {/* Inputs: Date, Time, Venue & Referee */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">التاريخ:</label>
                          <input
                            type="date"
                            value={match.date}
                            onChange={(e) => handleUpdateMatchField(match.id, 'date', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">التوقيت:</label>
                          <input
                            type="time"
                            value={match.time}
                            onChange={(e) => handleUpdateMatchField(match.id, 'time', e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الملعب / المكان:</label>
                          <input
                            type="text"
                            value={match.venueName}
                            onChange={(e) => handleUpdateMatchField(match.id, 'venueName', e.target.value)}
                            placeholder="اسم القاعة / الملعب"
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                          />
                        </div>

                        {/* ⭐ REFEREE ASSIGNMENT FIELD ⭐ */}
                        <div>
                          <label className="block text-[10px] font-bold text-amber-700 mb-0.5 flex items-center gap-1">
                            <UserCheck className="w-3 h-3" />
                            <span>حكم المقابلة:</span>
                          </label>
                          <select
                            value={match.refereeId || ''}
                            onChange={(e) => handleUpdateMatchField(match.id, 'refereeId', e.target.value)}
                            className="w-full px-2 py-1.5 bg-amber-50/60 border border-amber-300 rounded-xl font-bold text-amber-950 cursor-pointer text-[11px]"
                          >
                            <option value="">-- تعيين الحكم --</option>
                            {combinedRefereesList.map(ref => (
                              <option key={ref.id} value={ref.id}>{ref.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>

              {/* Final Submit & Save to Database */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إعادة ضبط القرعة
                </button>

                <button
                  onClick={handleSaveMatchesToDatabase}
                  disabled={isSaving || generatedMatches.length === 0}
                  className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-xl shadow-emerald-600/30 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSaving ? 'جاري الحفظ والاعتماد...' : 'حفظ واعتماد جدول المباريات والحكام في المنظومة'}</span>
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
