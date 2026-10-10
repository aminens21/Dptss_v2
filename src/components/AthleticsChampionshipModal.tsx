import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Trophy,
  Users,
  Timer,
  Play,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  Edit2,
  Check,
  Award,
  ChevronRight,
  Printer,
  Sparkles,
  Layers,
  ArrowRight,
  Search,
  Building,
  ShieldCheck,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Flag,
  Calendar,
  Medal,
  Download,
  Share2,
  Settings as SettingsIcon,
  Lock,
  Unlock,
  RefreshCw,
  UserPlus,
  ShieldAlert,
  SlidersHorizontal,
  HelpCircle,
  FileSpreadsheet,
  FileText,
  Phone,
  School as SchoolIcon,
  User as UserIcon,
  Filter,
  CheckCircle,
  Sun,
  Moon,
  ClipboardList,
  UserX,
  XCircle,
  Volume2
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import {
  AthleticsCommitteeDef,
  AthleticsDisciplineDef,
  AthleticsCommitteeAssignment,
  CommitteeTeacherMember,
  AthleticsParticipantRecord,
  AthleticsEventResult,
  TrackRankEntry,
  FieldAttemptEntry,
  COMMITTEE_ROLE_OPTIONS,
  AthleticsCommitteePermissions,
  AthleticsAttendanceRecord
} from '../lib/athleticsConfig';
import { AthleticsService } from '../lib/athleticsService';
import { User, School, Student } from '../types';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import toast from 'react-hot-toast';

interface AthleticsChampionshipModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers?: User[];
  schools?: School[];
  students?: Student[];
  currentUser?: User | null;
  directorateName?: string;
  season?: string;
}

export const AthleticsChampionshipModal: React.FC<AthleticsChampionshipModalProps> = ({
  isOpen,
  onClose,
  teachers = [],
  schools = [],
  students = [],
  currentUser,
  directorateName = 'المديرية الإقليمية تاوريرت',
  season = '2026/2027'
}) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  // Role determination
  const isSuperOrAdmin = currentUser?.isSuperAdmin === true || 
                         currentUser?.role === 'SUPER_ADMIN' || 
                         currentUser?.role === 'CENTRAL_ADMIN' || 
                         currentUser?.role === 'SPORT_MANAGER' || 
                         currentUser?.isTechCommitteeHead === true;
  const isTeacher = currentUser?.role === 'TEACHER' && !isSuperOrAdmin;

  // Active Role / Committee Permission Simulator Mode: 'AUTO' | 'ADMIN' | 'TEACHER' | committeeId (e.g. 'long_jump_committee')
  const [activeRoleMode, setActiveRoleMode] = useState<string>('AUTO');

  // Committee Permissions Edit Modal State
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [editingPermissionsCommittee, setEditingPermissionsCommittee] = useState<AthleticsCommitteeDef | null>(null);
  const [tempAllowedTabs, setTempAllowedTabs] = useState<('events' | 'committees' | 'stopwatch' | 'field' | 'podium' | 'school_registration' | 'my_participations')[]>([]);
  const [tempAllowedDiscIds, setTempAllowedDiscIds] = useState<string[]>([]);
  const [tempCanRecord, setTempCanRecord] = useState(true);
  const [tempCanValidate, setTempCanValidate] = useState(true);
  const [tempCanPrint, setTempCanPrint] = useState(true);
  const [tempCanExport, setTempCanExport] = useState(true);

  // Navigation Tabs: 'school_registration' | 'my_participations' | 'events' | 'committees' | 'stopwatch' | 'field' | 'podium'
  type AthleticsTab = 'school_registration' | 'my_participations' | 'events' | 'committees' | 'stopwatch' | 'field' | 'podium';
  const [activeTab, setActiveTab] = useState<AthleticsTab>(isTeacher ? 'school_registration' : 'events');

  useEffect(() => {
    if (isTeacher) {
      setActiveTab('school_registration');
    }
  }, [isTeacher]);

  // Core Data
  const [committees, setCommittees] = useState<AthleticsCommitteeDef[]>([]);
  const [disciplines, setDisciplines] = useState<AthleticsDisciplineDef[]>([]);
  const [assignments, setAssignments] = useState<Record<string, AthleticsCommitteeAssignment>>({});
  const [participants, setParticipants] = useState<AthleticsParticipantRecord[]>([]);
  const [results, setResults] = useState<Record<string, AthleticsEventResult>>({});
  const resultsList = useMemo(() => Object.values(results) as AthleticsEventResult[], [results]);

  // Active Selection Filters
  const [selectedDiscipline, setSelectedDiscipline] = useState<AthleticsDisciplineDef | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<'U12' | 'U15' | 'U18' | 'U20'>('U18');
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female'>('Male');

  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'committees' | 'disciplines' | 'auto_import'>('committees');

  // Committee Editing in Settings
  const [editingCommittee, setEditingCommittee] = useState<AthleticsCommitteeDef | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [manualTeacherName, setManualTeacherName] = useState<string>('');
  const [teacherPhone, setTeacherPhone] = useState<string>('');
  const [committeeMembersList, setCommitteeMembersList] = useState<CommitteeTeacherMember[]>([]);

  // Add Member to Committee Form
  const [newMemberTeacherId, setNewMemberTeacherId] = useState<string>('');
  const [newMemberRole, setNewMemberRole] = useState<string>(COMMITTEE_ROLE_OPTIONS[1]);

  // Add Discipline Form in Settings
  const [newDiscNameAr, setNewDiscNameAr] = useState('');
  const [newDiscNameFr, setNewDiscNameFr] = useState('');
  const [newDiscType, setNewDiscType] = useState<AthleticsDisciplineDef['type']>('track_sprint');
  const [newDiscCommitteeId, setNewDiscCommitteeId] = useState('sprint_committee');
  const [newDiscDistance, setNewDiscDistance] = useState('100م');
  const [newDiscIcon, setNewDiscIcon] = useState('⚡');
  const [newDiscCats, setNewDiscCats] = useState<('U12' | 'U15' | 'U18' | 'U20')[]>(['U15', 'U18']);
  const [newDiscGenders, setNewDiscGenders] = useState<('Male' | 'Female')[]>(['Male', 'Female']);

  // Add Participant Form State
  const [isAddParticipantOpen, setIsAddParticipantOpen] = useState(false);
  const [newBib, setNewBib] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newSchoolName, setNewSchoolName] = useState('');
  const [newBirthYear, setNewBirthYear] = useState('2008');

  // Deletion Confirmation State
  const [disciplineToDelete, setDisciplineToDelete] = useState<AthleticsDisciplineDef | null>(null);
  const [editingDiscipline, setEditingDiscipline] = useState<AthleticsDisciplineDef | null>(null);
  const [participantToDelete, setParticipantToDelete] = useState<AthleticsParticipantRecord | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<{ teacherName: string; teacherId: string } | null>(null);

  // School Participant Management State
  const [selectedSchoolForView, setSelectedSchoolForView] = useState<string>('');
  const [schoolSearchQuery, setSchoolSearchQuery] = useState<string>('');
  const [schoolCategoryFilter, setSchoolCategoryFilter] = useState<string>('ALL');
  const [schoolGenderFilter, setSchoolGenderFilter] = useState<string>('ALL');
  const [isPrintRosterModalOpen, setIsPrintRosterModalOpen] = useState(false);

  // School Participant Add/Edit Form State
  const [isSchoolRegModalOpen, setIsSchoolRegModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<AthleticsParticipantRecord | null>(null);
  const [regFullName, setRegFullName] = useState('');
  const [regMassar, setRegMassar] = useState('');
  const [regGender, setRegGender] = useState<'Male' | 'Female'>('Male');
  const [regCategory, setRegCategory] = useState<'U12' | 'U15' | 'U18' | 'U20'>('U15');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regAffiliation, setRegAffiliation] = useState<'non_club' | 'club_affiliated'>('non_club');
  const [regDiscipline1, setRegDiscipline1] = useState('');
  const [regDiscipline2, setRegDiscipline2] = useState('');
  const [regBibNumber, setRegBibNumber] = useState('');
  const [regCoachName, setRegCoachName] = useState('');
  const [regCoachPhone, setRegCoachPhone] = useState('');

  // --- SMART STOPWATCH STATE ---
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recordedLaps, setRecordedLaps] = useState<TrackRankEntry[]>([]);
  const timerRef = useRef<any>(null);
  const prevEventKeyRef = useRef<string>('');

  // --- FIELD ATTEMPTS STATE ---
  const [fieldTrials, setFieldTrials] = useState<FieldAttemptEntry[]>([]);

  // Load all initial data
  const loadAllAthleticsData = () => {
    const loadedCommittees = AthleticsService.getCommittees();
    const loadedDisciplines = AthleticsService.getDisciplines();
    const loadedAssignments = AthleticsService.getCommitteeAssignments();
    const loadedParticipants = AthleticsService.getParticipants();
    const loadedResults = AthleticsService.getAllResults();

    setCommittees(loadedCommittees);
    setDisciplines(loadedDisciplines);
    setAssignments(loadedAssignments);
    setParticipants(loadedParticipants);
    setResults(loadedResults);

    if (!selectedDiscipline && loadedDisciplines.length > 0) {
      setSelectedDiscipline(loadedDisciplines[0]);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAllAthleticsData();
    }
  }, [isOpen]);

  // Stopwatch interval timer
  useEffect(() => {
    if (isTimerRunning) {
      const startTime = Date.now() - elapsedMs;
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 10);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning]);

  // Core Effective Role determination:
  const effectiveRole = useMemo(() => {
    if (activeRoleMode !== 'AUTO') return activeRoleMode;
    if (isSuperOrAdmin) return 'ADMIN';
    
    // If teacher is assigned to a committee, they get that committee's role
    // BUT we will ensure they keep their teacher tabs below in allowedTabs
    if (currentUser) {
      for (const [cId, assign] of Object.entries(assignments) as [string, AthleticsCommitteeAssignment][]) {
        if (assign.teacherId === currentUser.id || assign.teacherName === currentUser.fullName ||
            assign.members?.some(m => m.teacherId === currentUser.id || m.teacherName === currentUser.fullName)) {
          return cId;
        }
      }
    }
    return isTeacher ? 'TEACHER' : 'ADMIN';
  }, [activeRoleMode, isTeacher, isSuperOrAdmin, currentUser, assignments]);

  const activeCommitteePermissionDef = useMemo(() => {
    if (effectiveRole === 'ADMIN' || (effectiveRole === 'TEACHER' && isTeacher)) return null;
    return committees.find(c => c.id === effectiveRole) || null;
  }, [effectiveRole, committees, isTeacher]);

  // Allowed tabs based on effective role / committee permission
  const allowedTabs = useMemo<AthleticsTab[]>(() => {
    const tabs: AthleticsTab[] = [];
    
    // Teachers ALWAYS get their base tabs regardless of committee assignment
    if (isTeacher) {
      tabs.push('school_registration', 'my_participations');
    }

    if (effectiveRole === 'ADMIN') {
      return ['school_registration', 'my_participations', 'events', 'committees', 'stopwatch', 'field', 'podium'];
    }
    
    if (activeCommitteePermissionDef) {
      const commTabs = (activeCommitteePermissionDef.permissions?.allowedTabs as AthleticsTab[]) || [];
      commTabs.forEach(t => {
        if (!tabs.includes(t)) tabs.push(t);
      });
      
      // Fallbacks if no tabs defined
      if (tabs.length === (isTeacher ? 2 : 0)) {
        if (activeCommitteePermissionDef.id === 'podium_committee') tabs.push('podium');
        else if (activeCommitteePermissionDef.id === 'long_jump_committee' || activeCommitteePermissionDef.id === 'shot_put_committee') tabs.push('field');
        else tabs.push('stopwatch');
      }
      return tabs;
    }
    
    if (effectiveRole === 'TEACHER') return ['school_registration', 'my_participations'];
    
    return ['school_registration', 'events', 'committees', 'stopwatch', 'field', 'podium'];
  }, [effectiveRole, activeCommitteePermissionDef, isTeacher]);

  // Ensure activeTab stays in sync with allowed tabs
  useEffect(() => {
    if (allowedTabs.length > 0 && !allowedTabs.includes(activeTab)) {
      setActiveTab(allowedTabs[0]);
    }
  }, [allowedTabs, activeTab]);

  const [isManualTrackEntry, setIsManualTrackEntry] = useState(false);

  // --- TRACK HEATS / MULTI-SERIES (سباقات المجموعات والسلاسل لنفس الفئة) STATE ---
  const [activeSeriesNumber, setActiveSeriesNumber] = useState<number>(1);
  const [seriesViewFilter, setSeriesViewFilter] = useState<'ALL' | number>('ALL');
  const [customSeriesList, setCustomSeriesList] = useState<number[]>([1, 2, 3]);

  // Available heats/series for current race
  const availableSeriesList = useMemo(() => {
    const set = new Set<number>([...customSeriesList]);
    recordedLaps.forEach(l => {
      if (l.seriesNumber) set.add(l.seriesNumber);
    });
    if (set.size === 0) set.add(1);
    return Array.from(set).sort((a, b) => a - b);
  }, [recordedLaps, customSeriesList]);

  // --- ATTENDANCE & ROLL CALL (غرفة المناداة وتأكيد الحضور) STATE ---
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AthleticsAttendanceRecord>>({});
  const [attendanceFilterStatus, setAttendanceFilterStatus] = useState<'ALL' | 'present' | 'absent' | 'pending'>('ALL');
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState('');
  const [isCallingParticipantId, setIsCallingParticipantId] = useState<string | null>(null);

  // --- ASSIGN PARTICIPANTS BY FINISH ORDER (اختيار أسماء التلاميذ حسب الترتيب عند انتهاء الاختبار) STATE ---
  const [isAssignByOrderModalOpen, setIsAssignByOrderModalOpen] = useState(false);

  // --- CLEAR RACE DATA (تفريغ بيانات السباق مع اختيار السباق والتأكيد) STATE ---
  const [isClearRaceModalOpen, setIsClearRaceModalOpen] = useState(false);
  const [clearRaceDisciplineId, setClearRaceDisciplineId] = useState<string>('');
  const [clearRaceCategory, setClearRaceCategory] = useState<'U12' | 'U15' | 'U18' | 'U20'>('U18');
  const [clearRaceGender, setClearRaceGender] = useState<'Male' | 'Female'>('Male');
  const [clearIncludeAttendance, setClearIncludeAttendance] = useState(false);
  const [clearConfirmedByUser, setClearConfirmedByUser] = useState(false);

  // --- DEMO ROSTER & COMMITTEE 10-COMPETITOR GENERATION STATE (دمج 10 متسابقين لكل سباق وتوزيعها حسب اللجان) ---
  const [isDemoRosterModalOpen, setIsDemoRosterModalOpen] = useState(false);
  const [demoSeedMode, setDemoSeedMode] = useState<'replace' | 'merge'>('replace');
  const [schoolCommitteeFilter, setSchoolCommitteeFilter] = useState<string>('ALL');

  // Filtered disciplines list allowed for the currently selected category & gender
  // AND filtered strictly according to the active committee permission (e.g. Jump Committee only sees Jump competitions!)
  const currentCategoryGendersDisciplines = useMemo(() => {
    let list = disciplines.filter(d => 
      (!d.allowedCategories || d.allowedCategories.includes(selectedCategory)) &&
      (!d.allowedGenders || d.allowedGenders.includes(selectedGender))
    );

    // If a specific committee permission is active (e.g. Jump committee)
    if (activeCommitteePermissionDef) {
      const allowedIds = activeCommitteePermissionDef.permissions?.allowedDisciplineIds || activeCommitteePermissionDef.disciplines || [];
      if (allowedIds.length > 0) {
        list = list.filter(d => allowedIds.includes(d.id) || d.committeeId === activeCommitteePermissionDef.id);
      } else if (activeCommitteePermissionDef.disciplines?.length > 0) {
        list = list.filter(d => activeCommitteePermissionDef.disciplines.includes(d.id));
      }
    }

    return list;
  }, [disciplines, selectedCategory, selectedGender, activeCommitteePermissionDef]);

  // Current Active Discipline (Ensuring it is one of the allowed disciplines for this category/gender)
  const activeDiscipline = selectedDiscipline && currentCategoryGendersDisciplines.some(d => d.id === selectedDiscipline.id)
    ? selectedDiscipline
    : currentCategoryGendersDisciplines[0] || null;

  // Auto-correct selectedDiscipline state when filtered out
  useEffect(() => {
    if (currentCategoryGendersDisciplines.length > 0) {
      const isStillValid = selectedDiscipline && currentCategoryGendersDisciplines.some(d => d.id === selectedDiscipline.id);
      if (!isStillValid) {
        setSelectedDiscipline(currentCategoryGendersDisciplines[0]);
      }
    } else {
      if (selectedDiscipline !== null) {
        setSelectedDiscipline(null);
      }
    }
  }, [selectedCategory, selectedGender, currentCategoryGendersDisciplines, selectedDiscipline]);
  const currentEventKey = activeDiscipline ? `${activeDiscipline.id}_${selectedCategory}_${selectedGender}` : '';
  const currentEventResult = results[currentEventKey];

  // Committee for current active discipline
  const currentCommitteeDef = committees.find(c => c.id === activeDiscipline?.committeeId);
  const currentCommitteeAssignment = currentCommitteeDef ? assignments[currentCommitteeDef.id] : null;

  // Action Permissions according to effective role / committee
  const canRecordResults = useMemo(() => {
    if (effectiveRole === 'ADMIN') return true;
    if (effectiveRole === 'TEACHER') return false;
    if (activeCommitteePermissionDef) {
      return activeCommitteePermissionDef.permissions?.canRecordResults ?? true;
    }
    return true;
  }, [effectiveRole, activeCommitteePermissionDef]);

  const canValidateResults = useMemo(() => {
    if (effectiveRole === 'ADMIN') return true;
    if (effectiveRole === 'TEACHER') return false;
    if (activeCommitteePermissionDef) {
      return activeCommitteePermissionDef.permissions?.canValidateResults ?? true;
    }
    return true;
  }, [effectiveRole, activeCommitteePermissionDef]);

  const canPrintReports = useMemo(() => {
    if (effectiveRole === 'ADMIN') return true;
    if (effectiveRole === 'TEACHER') return true; // Teacher can print school roster!
    if (activeCommitteePermissionDef) {
      return activeCommitteePermissionDef.permissions?.canPrintReports ?? true;
    }
    return true;
  }, [effectiveRole, activeCommitteePermissionDef]);

  const canExportData = useMemo(() => {
    if (effectiveRole === 'ADMIN') return true;
    if (effectiveRole === 'TEACHER') return true; // Teacher can export school roster!
    if (activeCommitteePermissionDef) {
      return activeCommitteePermissionDef.permissions?.canExportData ?? true;
    }
    return true;
  }, [effectiveRole, activeCommitteePermissionDef]);

  // Permission Check for current user on the active event/committee
  const userAccess = useMemo(() => {
    if (effectiveRole === 'ADMIN') return { canManage: true };
    if (!currentCommitteeDef) return { canManage: canRecordResults };
    if (activeCommitteePermissionDef) {
      const match = activeCommitteePermissionDef.id === currentCommitteeDef.id;
      return { canManage: match && canRecordResults };
    }
    return AthleticsService.canUserManageCommittee(currentUser, currentCommitteeDef.id, assignments);
  }, [effectiveRole, currentCommitteeDef, canRecordResults, activeCommitteePermissionDef, currentUser, assignments]);

  const userAssignedCommittee = useMemo(() => {
    if (!currentUser) return null;
    const list = AthleticsService.getRefereeAthleticsAssignments(currentUser);
    if (list.length > 0) {
      return list.map(l => `${l.committeeTitle} (${l.roleInCommittee})`).join(' • ');
    }
    return null;
  }, [currentUser, assignments]);
  // ENSURES 100% INDEPENDENT STORAGE AND STATE PER RACE (كل سباق يتم حفظ نتائجه مستقلا)
  // CRITICAL FIX: DO NOT reset recordedLaps or fieldTrials on re-renders or when stopwatch is reset!
  useEffect(() => {
    if (!activeDiscipline || !currentEventKey) return;
    
    // Only perform load when switching to a DIFFERENT race/event:
    if (prevEventKeyRef.current !== currentEventKey) {
      prevEventKeyRef.current = currentEventKey;

      if (activeDiscipline.type.startsWith('field')) {
        const eventRes = results[currentEventKey];
        if (eventRes && eventRes.fieldEntries && eventRes.fieldEntries.length > 0) {
          setFieldTrials(eventRes.fieldEntries);
        } else {
          // USER DIRECTIVE:
          // "بالنسبة للاختبارات، عدم إظهار أسماء التلاميذ تلقائيا عند تسجيل المرتبة، ولكن يتم اختيارهم بشكل يدوي"
          // Start with empty trials, teacher adds/selects participants manually:
          setFieldTrials([]);
        }
      } else {
        const eventRes = results[currentEventKey];
        const draftLaps = AthleticsService.getDraftTrackLaps(currentEventKey);
        if (eventRes && eventRes.trackLaps && eventRes.trackLaps.length > 0) {
          setRecordedLaps(eventRes.trackLaps);
        } else if (draftLaps && draftLaps.length > 0) {
          setRecordedLaps(draftLaps);
        } else {
          setRecordedLaps([]);
        }
        setIsTimerRunning(false);
        setElapsedMs(0);
        setIsManualTrackEntry(false);
        setActiveSeriesNumber(1);
        setSeriesViewFilter('ALL');
      }

      // Load attendance for currentEventKey
      const att = AthleticsService.getAttendanceForEvent(currentEventKey);
      setAttendanceMap(att);
    }
  }, [currentEventKey, activeDiscipline, results]);

  // Real-time synchronization of draft track laps into local storage to prevent any accidental data loss:
  useEffect(() => {
    if (currentEventKey && activeDiscipline && !activeDiscipline.type.startsWith('field')) {
      if (recordedLaps.length > 0) {
        AthleticsService.saveDraftTrackLaps(currentEventKey, recordedLaps);
      }
    }
  }, [recordedLaps, currentEventKey, activeDiscipline]);

  // Filtered Participants for Current Event (both primary & secondary disciplines)
  const currentEventParticipants = useMemo(() => {
    if (!activeDiscipline) return [];
    return participants.filter(
      p => (p.disciplineId === activeDiscipline.id || p.secondDisciplineId === activeDiscipline.id) &&
           p.category === selectedCategory &&
           p.gender === selectedGender
    );
  }, [participants, activeDiscipline, selectedCategory, selectedGender]);

  // Sorted participants for assignment: present athletes first!
  const sortedParticipantsForAssignment = useMemo(() => {
    return [...currentEventParticipants].sort((a, b) => {
      const aStatus = attendanceMap[a.id]?.status || 'pending';
      const bStatus = attendanceMap[b.id]?.status || 'pending';
      if (aStatus === 'present' && bStatus !== 'present') return -1;
      if (bStatus === 'present' && aStatus !== 'present') return 1;
      if (aStatus === 'absent' && bStatus !== 'absent') return 1;
      if (bStatus === 'absent' && aStatus !== 'absent') return -1;
      return (parseInt(a.bibNumber) || 0) - (parseInt(b.bibNumber) || 0);
    });
  }, [currentEventParticipants, attendanceMap]);

  // Laps to display based on series view filter ('ALL' = Unified Overall Ranking by fastest time, or specific series)
  const lapsToDisplay = useMemo(() => {
    if (seriesViewFilter === 'ALL') {
      return [...recordedLaps]
        .map((lap, origIdx) => ({
          ...lap,
          origIdx,
          effectiveTimeMs: lap.timeMs > 0 ? lap.timeMs : AthleticsService.parseTimeToMs(lap.formattedTime)
        }))
        .sort((a, b) => a.effectiveTimeMs - b.effectiveTimeMs)
        .map((lap, rankIdx) => ({
          ...lap,
          overallRank: rankIdx + 1
        }));
    } else {
      return recordedLaps
        .map((lap, origIdx) => ({
          ...lap,
          origIdx,
          overallRank: undefined,
          effectiveTimeMs: lap.timeMs > 0 ? lap.timeMs : AthleticsService.parseTimeToMs(lap.formattedTime)
        }))
        .filter(lap => (lap.seriesNumber || 1) === seriesViewFilter);
    }
  }, [recordedLaps, seriesViewFilter]);

  // Attendance stats for quick badges & counts
  const attendanceStats = useMemo(() => {
    const total = currentEventParticipants.length;
    let present = 0;
    let absent = 0;
    let pending = 0;

    currentEventParticipants.forEach(p => {
      const rec = attendanceMap[p.id];
      if (rec?.status === 'present') present++;
      else if (rec?.status === 'absent') absent++;
      else pending++;
    });

    return { total, present, absent, pending };
  }, [currentEventParticipants, attendanceMap]);

  // Detected teacher school or initial school for admins
  const detectedTeacherSchool = useMemo(() => {
    if (currentUser?.workLocation) {
      const m = schools.find(s => 
        s.name.trim().toLowerCase() === currentUser.workLocation!.trim().toLowerCase() ||
        s.name.includes(currentUser.workLocation!) ||
        currentUser.workLocation!.includes(s.name)
      );
      if (m) return m.name;
      return currentUser.workLocation;
    }
    if (schools.length > 0) return schools[0].name;
    return 'المؤسسة التعليمية';
  }, [currentUser, schools]);

  useEffect(() => {
    if (!selectedSchoolForView && detectedTeacherSchool) {
      setSelectedSchoolForView(detectedTeacherSchool);
    }
  }, [detectedTeacherSchool, selectedSchoolForView]);

  // Filtered Participants for School View
  const currentSchoolParticipants = useMemo(() => {
    let list = participants;
    if (selectedSchoolForView && selectedSchoolForView !== 'ALL') {
      list = list.filter(p => 
        p.schoolName && (
          p.schoolName.trim().toLowerCase() === selectedSchoolForView.trim().toLowerCase() ||
          p.schoolName.includes(selectedSchoolForView) ||
          selectedSchoolForView.includes(p.schoolName)
        )
      );
    }
    if (schoolSearchQuery.trim()) {
      const q = schoolSearchQuery.trim().toLowerCase();
      list = list.filter(p => 
        (p.studentName && p.studentName.toLowerCase().includes(q)) ||
        (p.massarNumber && p.massarNumber.toLowerCase().includes(q)) ||
        (p.bibNumber && p.bibNumber.includes(q))
      );
    }
    if (schoolCategoryFilter !== 'ALL') {
      list = list.filter(p => p.category === schoolCategoryFilter);
    }
    if (schoolGenderFilter !== 'ALL') {
      list = list.filter(p => p.gender === schoolGenderFilter);
    }
    if (schoolCommitteeFilter !== 'ALL') {
      const commDiscs = disciplines.filter(d => d.committeeId === schoolCommitteeFilter);
      const commDiscIds = new Set(commDiscs.map(d => d.id));
      list = list.filter(p => commDiscIds.has(p.disciplineId) || (p.secondDisciplineId && commDiscIds.has(p.secondDisciplineId)));
    }
    return list;
  }, [participants, selectedSchoolForView, schoolSearchQuery, schoolCategoryFilter, schoolGenderFilter, schoolCommitteeFilter, disciplines]);

  // Disciplines available for registration form based on category & gender
  const availableRegDisciplines = useMemo(() => {
    return disciplines.filter(d => 
      (!d.allowedCategories || d.allowedCategories.includes(regCategory)) &&
      (!d.allowedGenders || d.allowedGenders.includes(regGender))
    );
  }, [disciplines, regCategory, regGender]);

  // --- SMART MULTI-RANK STOPWATCH HANDLERS ---
  const handleStartStopwatch = () => {
    if (!userAccess.canManage) {
      toast.error(userAccess.reason || 'لا تملك صلاحية التحكم في هذا السباق');
      return;
    }
    setIsTimerRunning(true);
  };

  const handleStopStopwatch = () => {
    setIsTimerRunning(false);
    const unassignedInSeries = recordedLaps.filter(l => (l.seriesNumber || 1) === activeSeriesNumber && !l.participantId).length;
    if (unassignedInSeries > 0) {
      toast(`انتهى السباق/السلسلة ${activeSeriesNumber}! يمكنك الآن اختيار أسماء التلاميذ حسب الترتيب (${unassignedInSeries} وصولات بانتظار الاختيار)`, { icon: '🏁' });
    }
  };

  const handleResetStopwatch = () => {
    setIsTimerRunning(false);
    setElapsedMs(0);
    // Preserving all recorded arrivals as requested (لا يتم مسح النتائج عند تصفير الميقاتي لأن السباقات بالمجموعات)
    const countInActiveSeries = recordedLaps.filter(l => (l.seriesNumber || 1) === activeSeriesNumber).length;
    toast.success(`تم تصفير الميقاتي بنجاح للبدء من جديد. تم الحفاظ بالكامل على مراتب ووصولات السلسلة ${activeSeriesNumber} (${countInActiveSeries} وصول) وكافة السلاسل الأخرى (${recordedLaps.length} وصول محفوظ)`);
  };

  const handleTriggerRankSplit = () => {
    if (!userAccess.canManage) {
      toast.error(userAccess.reason || 'لا تملك صلاحية تسجيل المراتب في هذه اللجنة');
      return;
    }

    if (!isTimerRunning && elapsedMs === 0) {
      toast.error('يرجى إطلاق الميقاتي أولاً!');
      return;
    }

    // Number of arrivals already recorded in this specific heat/series
    const lapsInCurrentSeries = recordedLaps.filter(l => (l.seriesNumber || 1) === activeSeriesNumber);
    const nextRankInSeries = lapsInCurrentSeries.length + 1;
    const formatted = AthleticsService.formatMilliseconds(elapsedMs);

    // CRITICAL USER REQUIREMENT:
    // "عدم إظهار أسماء التلاميذ تلقائيا عند تسجيل المرتبة، ولكن يتم اختيارهم بشكل يدوي"
    const newLap: TrackRankEntry = {
      rank: nextRankInSeries,
      timeMs: elapsedMs,
      formattedTime: formatted,
      participantId: '',
      bibNumber: '',
      studentName: '',
      schoolName: '',
      confirmed: false,
      seriesNumber: activeSeriesNumber
    };

    const updated = [...recordedLaps, newLap];
    setRecordedLaps(updated);

    toast.success(`تم تسجيل وصول بالسلسلة ${activeSeriesNumber} (المرتبة ${nextRankInSeries}): ${formatted} - يرجى تعيين التلميذ يدوياً`);
  };

  const handleAssignParticipantToLap = (lapIndex: number, participantId: string) => {
    if (!userAccess.canManage) {
      toast.error('لا تملك صلاحية تغيير التعيين');
      return;
    }
    const p = participants.find(part => part.id === participantId);
    setRecordedLaps(prev => {
      const copy = [...prev];
      if (copy[lapIndex]) {
        copy[lapIndex] = {
          ...copy[lapIndex],
          participantId: p ? p.id : '',
          bibNumber: p ? p.bibNumber : '',
          studentName: p ? p.studentName : '',
          schoolName: p ? p.schoolName : '',
          confirmed: !!p
        };
      }
      return copy;
    });
    if (p) {
      toast.success(`تم تعيين التلميذ(ة) ${p.studentName} يدوياً بنجاح`);
    }
  };

  const handleSaveTrackResults = () => {
    if (!userAccess.canManage) {
      toast.error(userAccess.reason || 'لا تملك صلاحية حفظ نتائج هذه اللجنة');
      return;
    }
    if (!activeDiscipline) return;
    if (recordedLaps.length === 0) {
      toast.error('لم يتم تسجيل أي مرتبة بعد!');
      return;
    }

    // CRITICAL USER REQUIREMENT:
    // "إمكانية القيام بسباقين أو ثلاث سباقات في نفس الفئة، ويتم تحديد المراتب الأولى بعد انتهاء جميع المتسابقين"
    // Unified overall ranking sorted strictly by fastest time (timeMs ascending):
    const sortedTrackLaps = [...recordedLaps]
      .map(lap => ({
        ...lap,
        effectiveTimeMs: lap.timeMs > 0 ? lap.timeMs : AthleticsService.parseTimeToMs(lap.formattedTime)
      }))
      .sort((a, b) => a.effectiveTimeMs - b.effectiveTimeMs)
      .map((lap, idx) => ({
        rank: idx + 1, // Unified official overall rank across all series
        timeMs: lap.effectiveTimeMs,
        formattedTime: lap.formattedTime,
        participantId: lap.participantId,
        bibNumber: lap.bibNumber,
        studentName: lap.studentName,
        schoolName: lap.schoolName,
        confirmed: lap.confirmed,
        seriesNumber: lap.seriesNumber || 1
      }));

    const eventResult: AthleticsEventResult = {
      id: currentEventKey,
      disciplineId: activeDiscipline.id,
      category: selectedCategory,
      gender: selectedGender,
      committeeId: activeDiscipline.committeeId,
      type: 'track',
      status: 'completed',
      trackLaps: sortedTrackLaps,
      recordedByTeacherName: currentCommitteeAssignment?.teacherName || currentUser?.fullName || 'أستاذ التحكيم',
      directorateName,
      season,
      lastUpdated: new Date().toISOString()
    };

    AthleticsService.saveEventResult(eventResult);
    AthleticsService.clearDraftTrackLaps(currentEventKey);
    setResults(AthleticsService.getAllResults());
    toast.success(`تم حفظ واعتماد الترتيب العام الموحد لـ ${activeDiscipline.nameAr} (${selectedCategory} - ${selectedGender === 'Male' ? 'ذكور' : 'إناث'}) بنجاح! تم تحديد المراتب الأولى لجميع السلاسل`);
    setIsManualTrackEntry(false);
    setActiveTab('podium');
  };

  const handleDeleteEventResult = (resultId: string) => {
    if (!userAccess.canManage) {
      toast.error('لا تملك صلاحية حذف هذه النتائج');
      return;
    }
    if (window.confirm('هل أنت متأكد من رغبتك في حذف هذه النتائج بشكل نهائي؟')) {
      AthleticsService.deleteEventResult(resultId);
      setResults(AthleticsService.getAllResults());
      toast.success('تم حذف نتائج المسابقة بنجاح');
    }
  };

  const handleEditEventResult = (res: AthleticsEventResult) => {
    const d = disciplines.find(item => item.id === res.disciplineId);
    if (!d) return;
    
    setSelectedDiscipline(d);
    setSelectedCategory(res.category as any);
    setSelectedGender(res.gender as any);
    
    if (res.type === 'track') {
      setActiveTab('stopwatch');
      setIsManualTrackEntry(true);
    } else {
      setActiveTab('field');
    }
  };

  // --- CLEAR RACE / EVENT DATA (تفريغ بيانات السباق مع اختيار السباق والتأكيد) ---
  const handleOpenClearRaceModal = (discId?: string, cat?: 'U12' | 'U15' | 'U18' | 'U20', gen?: 'Male' | 'Female') => {
    setClearRaceDisciplineId(discId || activeDiscipline?.id || disciplines[0]?.id || '');
    setClearRaceCategory(cat || selectedCategory);
    setClearRaceGender(gen || selectedGender);
    setClearIncludeAttendance(false);
    setClearConfirmedByUser(false);
    setIsClearRaceModalOpen(true);
  };

  const handleClearCurrentRaceData = () => {
    handleOpenClearRaceModal();
  };

  const handleExecuteClearRace = () => {
    if (!userAccess.canManage) {
      toast.error('لا تملك صلاحية تفريغ بيانات هذه المسابقة');
      return;
    }
    const targetDisc = disciplines.find(d => d.id === clearRaceDisciplineId);
    if (!targetDisc) {
      toast.error('يرجى تحديد المسابقة المراد تفريغها');
      return;
    }

    const targetEventKey = `${targetDisc.id}_${clearRaceCategory}_${clearRaceGender}`;
    const raceName = `${targetDisc.nameAr} (${clearRaceCategory} - ${clearRaceGender === 'Male' ? 'ذكور' : 'إناث'})`;

    // 1. If currently viewing this race, reset in-memory states
    if (activeDiscipline?.id === targetDisc.id && selectedCategory === clearRaceCategory && selectedGender === clearRaceGender) {
      if (targetDisc.type.startsWith('field')) {
        setFieldTrials([]);
      } else {
        setRecordedLaps([]);
        setIsTimerRunning(false);
        setElapsedMs(0);
        setIsManualTrackEntry(false);
        setActiveSeriesNumber(1);
        setSeriesViewFilter('ALL');
      }
    }

    // Always clear persistent draft laps for target race
    AthleticsService.clearDraftTrackLaps(targetEventKey);

    // 2. Delete the saved event result from storage and update results state
    if (results[targetEventKey]) {
      AthleticsService.deleteEventResult(targetEventKey);
      setResults(AthleticsService.getAllResults());
    }

    // 3. Clear attendance if chosen
    if (clearIncludeAttendance) {
      AthleticsService.clearAttendanceForEvent(targetEventKey);
      if (targetEventKey === currentEventKey) {
        setAttendanceMap({});
      }
    }

    toast.success(`تم تفريغ ومسح بيانات ${raceName} بنجاح ✅ السباق جاهز للانطلاق من جديد.`);
    setIsClearRaceModalOpen(false);
    setClearConfirmedByUser(false);
  };

  // --- ATTENDANCE & ROLL CALL (غرفة المناداة وتأكيد الحضور) HANDLERS ---
  const handleToggleAttendance = (participantId: string, status: 'present' | 'absent' | 'pending') => {
    if (!currentEventKey) return;
    const currentLane = attendanceMap[participantId]?.lane || 1;
    AthleticsService.setParticipantAttendance(currentEventKey, participantId, status, currentLane);
    setAttendanceMap(prev => ({
      ...prev,
      [participantId]: {
        participantId,
        status,
        lane: currentLane,
        checkInTime: new Date().toISOString()
      }
    }));
  };

  const handleUpdateLane = (participantId: string, lane: number) => {
    if (!currentEventKey) return;
    const current = attendanceMap[participantId];
    AthleticsService.setParticipantAttendance(
      currentEventKey,
      participantId,
      current?.status || 'present',
      lane
    );
    setAttendanceMap(prev => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] || { participantId, status: 'present', checkInTime: new Date().toISOString() }),
        lane
      }
    }));
  };

  const handleMarkAllAttendance = (status: 'present' | 'absent') => {
    if (!currentEventKey) return;
    const ids = currentEventParticipants.map(p => p.id);
    AthleticsService.markAllAttendanceForEvent(currentEventKey, ids, status);
    const updated = AthleticsService.getAttendanceForEvent(currentEventKey);
    setAttendanceMap(updated);
    toast.success(status === 'present' ? 'تم تأكيد حضور جميع المتسابقين في غرفة المناداة ✅' : 'تم تسجيل غياب الجميع ❌');
  };

  const handleResetAttendance = () => {
    if (!currentEventKey) return;
    if (window.confirm('هل أنت متأكد من إعادة ضبط غرفة المناداة لهذا السباق؟')) {
      AthleticsService.clearAttendanceForEvent(currentEventKey);
      setAttendanceMap({});
      toast.success('تمت إعادة ضبط المناداة بنجاح 🔄');
    }
  };

  const handleAudioCall = (studentName: string, bibNumber: string) => {
    setIsCallingParticipantId(studentName);
    setTimeout(() => setIsCallingParticipantId(null), 3000);

    try {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const text = `رقم ${bibNumber}، ${studentName}`;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ar-SA';
        utterance.rate = 0.9;
        window.speechSynthesis.speak(utterance);
      }
    } catch (e) {
      console.log('Audio speech synthesis error:', e);
    }
  };

  const handlePrintAttendanceSheet = () => {
    window.print();
  };

  // --- FIELD ATTEMPTS HANDLERS ---
  const handleAddFieldTrial = (participantId?: string) => {
    if (!userAccess.canManage) {
      toast.error('لا تملك صلاحية إضافة متسابق');
      return;
    }
    const p = participantId ? participants.find(x => x.id === participantId) : null;
    const newEntry: FieldAttemptEntry = {
      participantId: p ? p.id : '',
      bibNumber: p ? p.bibNumber : '',
      studentName: p ? p.studentName : '',
      schoolName: p ? p.schoolName : '',
      attempts: [null, null, null],
      bestAttempt: null
    };
    setFieldTrials(prev => [...prev, newEntry]);
    if (p) {
      toast.success(`تمت إضافة التلميذ(ة) ${p.studentName} للاختبار يدوياً`);
    } else {
      toast('تمت إضافة خانة جديدة للاختبار - يرجى اختيار التلميذ(ة) يدوياً', { icon: 'ℹ️' });
    }
  };

  const handleAssignParticipantToFieldTrial = (entryIndex: number, participantId: string) => {
    if (!userAccess.canManage) {
      toast.error('لا تملك صلاحية تغيير التعيين');
      return;
    }
    const p = participants.find(x => x.id === participantId);
    setFieldTrials(prev => {
      const copy = [...prev];
      if (copy[entryIndex]) {
        copy[entryIndex] = {
          ...copy[entryIndex],
          participantId: p ? p.id : '',
          bibNumber: p ? p.bibNumber : '',
          studentName: p ? p.studentName : '',
          schoolName: p ? p.schoolName : ''
        };
      }
      return copy;
    });
    if (p) toast.success(`تم تعيين التلميذ(ة) ${p.studentName} يدوياً للاختبار`);
  };

  const handleRemoveFieldTrial = (entryIndex: number) => {
    setFieldTrials(prev => prev.filter((_, idx) => idx !== entryIndex));
  };

  const handleBulkImportFieldRegistered = () => {
    const registered = currentEventParticipants;
    if (registered.length === 0) {
      toast.error('لا يوجد تلاميذ مسجلين في هذه المسابقة');
      return;
    }
    const entries: FieldAttemptEntry[] = registered.map(p => ({
      participantId: p.id,
      bibNumber: p.bibNumber,
      studentName: p.studentName,
      schoolName: p.schoolName,
      attempts: [null, null, null],
      bestAttempt: null
    }));
    setFieldTrials(entries);
    toast.success(`تم إدراج ${entries.length} تلميذ(ة) مسجل في الاختبار`);
  };

  const handleUpdateAttempt = (entryIndex: number, attemptIndex: number, valStr: string) => {
    if (!userAccess.canManage) {
      toast.error('لا تملك صلاحية تعديل نتائج هذه اللجنة');
      return;
    }
    setFieldTrials(prev => {
      const copy = [...prev];
      const entry = { ...copy[entryIndex] };
      const attempts = [...entry.attempts];

      if (valStr.toUpperCase() === 'X') {
        attempts[attemptIndex] = 'X';
      } else {
        const num = parseFloat(valStr);
        attempts[attemptIndex] = isNaN(num) ? null : num;
      }
      entry.attempts = attempts;

      const validNumbers = attempts.filter((a): a is number => typeof a === 'number' && a > 0);
      entry.bestAttempt = validNumbers.length > 0 ? Math.max(...validNumbers) : null;

      copy[entryIndex] = entry;

      const sorted = [...copy].sort((a, b) => (b.bestAttempt || 0) - (a.bestAttempt || 0));
      return sorted.map((item, idx) => ({
        ...item,
        rank: item.bestAttempt ? idx + 1 : undefined
      }));
    });
  };

  const handleSaveFieldResults = () => {
    if (!userAccess.canManage) {
      toast.error(userAccess.reason || 'لا تملك صلاحية حفظ نتائج هذه المسابقة');
      return;
    }
    if (!activeDiscipline) return;
    if (fieldTrials.length === 0) {
      toast.error('لا يوجد متسابقون مسجلون في هذه المسابقة!');
      return;
    }

    const eventResult: AthleticsEventResult = {
      id: currentEventKey,
      disciplineId: activeDiscipline.id,
      category: selectedCategory,
      gender: selectedGender,
      committeeId: activeDiscipline.committeeId,
      type: 'field',
      status: 'completed',
      fieldEntries: fieldTrials,
      recordedByTeacherName: currentCommitteeAssignment?.teacherName || currentUser?.fullName || 'أستاذ التحكيم',
      directorateName,
      season,
      lastUpdated: new Date().toISOString()
    };

    AthleticsService.saveEventResult(eventResult);
    setResults(AthleticsService.getAllResults());
    toast.success(`تم حفظ نتائج ${activeDiscipline.nameAr} بنجاح!`);
    setActiveTab('podium');
  };

  // --- AUTO IMPORT STUDENTS ---
  const handleTriggerAutoImport = () => {
    const res = AthleticsService.autoImportSystemStudents(students, schools);
    setParticipants(AthleticsService.getParticipants());
    if (res.importedCount > 0) {
      toast.success(`تم بنجاح استيراد وتوزيع ${res.importedCount} تلميذ(ة) مشارك في ألعاب القوى من قاعدة البيانات`);
    } else {
      toast.success('تمت المزامنة: جميع المشاركين المسجلين في المنظومة مدرجون بالفعل.');
    }
  };

  const handleStartEditDiscipline = (disc: AthleticsDisciplineDef) => {
    setEditingDiscipline(disc);
    setNewDiscNameAr(disc.nameAr);
    setNewDiscNameFr(disc.nameFr || '');
    setNewDiscType(disc.type);
    setNewDiscCommitteeId(disc.committeeId);
    setNewDiscDistance(disc.distanceOrUnit);
    setNewDiscIcon(disc.icon);
    setNewDiscCats(disc.allowedCategories || ['U15', 'U18']);
    setNewDiscGenders(disc.allowedGenders || ['Male', 'Female']);
  };

  const handleCancelEditDiscipline = () => {
    setEditingDiscipline(null);
    setNewDiscNameAr('');
    setNewDiscNameFr('');
    setNewDiscType('track_sprint');
    setNewDiscCommitteeId('sprint_committee');
    setNewDiscDistance('100م');
    setNewDiscIcon('⚡');
    setNewDiscCats(['U15', 'U18']);
    setNewDiscGenders(['Male', 'Female']);
  };

  // --- ADD / EDIT DISCIPLINE ---
  const handleCreateDiscipline = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscNameAr.trim()) {
      toast.error('يرجى كتابة اسم المسابقة');
      return;
    }

    if (editingDiscipline) {
      // Update Mode
      const updatedList = disciplines.map(d => {
        if (d.id === editingDiscipline.id) {
          return {
            ...d,
            nameAr: newDiscNameAr.trim(),
            nameFr: newDiscNameFr.trim() || newDiscNameAr.trim(),
            type: newDiscType,
            committeeId: newDiscCommitteeId,
            distanceOrUnit: newDiscDistance.trim(),
            icon: newDiscIcon,
            allowedCategories: newDiscCats,
            allowedGenders: newDiscGenders
          };
        }
        return d;
      });

      AthleticsService.saveDisciplines(updatedList);
      setDisciplines(updatedList);
      const updatedObj = updatedList.find(d => d.id === editingDiscipline.id);
      if (updatedObj) setSelectedDiscipline(updatedObj);
      toast.success(`تم تحديث مسابقة «${newDiscNameAr.trim()}» بنجاح`);
      handleCancelEditDiscipline();
    } else {
      // Create Mode
      const created = AthleticsService.addDiscipline({
        nameAr: newDiscNameAr.trim(),
        nameFr: newDiscNameFr.trim() || newDiscNameAr.trim(),
        type: newDiscType,
        committeeId: newDiscCommitteeId,
        distanceOrUnit: newDiscDistance.trim(),
        icon: newDiscIcon,
        allowedCategories: newDiscCats,
        allowedGenders: newDiscGenders
      });

      setDisciplines(AthleticsService.getDisciplines());
      setSelectedDiscipline(created);
      setNewDiscNameAr('');
      setNewDiscNameFr('');
      toast.success(`تمت إضافة مسابقة «${created.nameAr}» بنجاح`);
    }
  };

  const handleDeleteDiscipline = (disc: AthleticsDisciplineDef) => {
    setDisciplineToDelete(disc);
  };

  const handleConfirmDeleteDiscipline = () => {
    if (!disciplineToDelete) return;
    AthleticsService.deleteDiscipline(disciplineToDelete.id);
    const updated = AthleticsService.getDisciplines();
    setDisciplines(updated);
    if (selectedDiscipline?.id === disciplineToDelete.id && updated.length > 0) {
      setSelectedDiscipline(updated[0]);
    }
    toast.success('تم حذف المسابقة بنجاح');
    setDisciplineToDelete(null);
  };

  // --- COMMITTEE MEMBER TASK MANAGEMENT ---
  const handleOpenCommitteeEdit = (comm: AthleticsCommitteeDef) => {
    setEditingCommittee(comm);
    const assignment = assignments[comm.id];
    setSelectedTeacherId(assignment?.teacherId || '');
    setManualTeacherName(assignment?.teacherName || '');
    setTeacherPhone(assignment?.teacherPhone || '');
    setCommitteeMembersList(assignment?.members || []);
  };

  const handleAddMemberToCommittee = () => {
    if (!newMemberTeacherId) {
      toast.error('يرجى اختيار الأستاذ أولاً');
      return;
    }
    const t = teachers.find(item => item.id === newMemberTeacherId);
    if (!t) return;

    if (committeeMembersList.some(m => m.teacherId === t.id)) {
      toast.error('هذا الأستاذ مضاف بالفعل في أعضاء اللجنة');
      return;
    }

    const newMember: CommitteeTeacherMember = {
      teacherId: t.id,
      teacherName: t.fullName,
      schoolName: t.workLocation || '',
      phone: t.phone || '',
      roleInCommittee: newMemberRole
    };

    setCommitteeMembersList(prev => [...prev, newMember]);
    setNewMemberTeacherId('');
    toast.success(`تمت إضافة ${t.fullName} بمهمة: ${newMemberRole}`);
  };

  const handleRemoveMember = (tId: string) => {
    setCommitteeMembersList(prev => prev.filter(m => m.teacherId !== tId));
  };

  const handleSaveCommitteeDetails = () => {
    if (!editingCommittee) return;

    let tName = manualTeacherName.trim();
    let tSchool = '';
    let tPhone = teacherPhone.trim();

    if (selectedTeacherId) {
      const foundTeacher = teachers.find(t => t.id === selectedTeacherId);
      if (foundTeacher) {
        tName = foundTeacher.fullName;
        tSchool = foundTeacher.workLocation || '';
        tPhone = foundTeacher.phone || tPhone;
      }
    }

    if (!tName && committeeMembersList.length > 0) {
      tName = committeeMembersList[0].teacherName;
      tSchool = committeeMembersList[0].schoolName || '';
      tPhone = committeeMembersList[0].phone || '';
    }

    if (!tName) {
      toast.error('يرجى تحديد الأستاذ المسؤول عن اللجنة');
      return;
    }

    const updatedAssignment: AthleticsCommitteeAssignment = {
      committeeId: editingCommittee.id,
      teacherId: selectedTeacherId || `tch-custom-${Date.now()}`,
      teacherName: tName,
      teacherSchool: tSchool,
      teacherPhone: tPhone,
      members: committeeMembersList,
      updatedAt: new Date().toISOString()
    };

    AthleticsService.saveCommitteeAssignment(updatedAssignment);
    setAssignments(AthleticsService.getCommitteeAssignments());
    setEditingCommittee(null);
    toast.success(`تم حفظ إعدادات وأعضاء ${editingCommittee.titleAr} وتحديد مهامهم بنجاح`);
  };

  // --- ADD MANUAL PARTICIPANT ---
  const handleCreateParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDiscipline) return;
    if (!newStudentName.trim() || !newSchoolName.trim() || !newBib.trim()) {
      toast.error('يرجى ملء جميع الحقول المطلوبة للعداء');
      return;
    }

    // Check max 2 events per participant rule (مع امكانية اختيار مسابقتين لكل متسابق)
    const existingStudentRecords = participants.filter(
      p => p.studentName.toLowerCase().trim() === newStudentName.toLowerCase().trim() &&
           p.schoolName.toLowerCase().trim() === newSchoolName.toLowerCase().trim()
    );

    if (existingStudentRecords.length >= 2) {
      toast.error(`عذراً، التلميذ(ة) "${newStudentName.trim()}" مسجل بالفعل في مسابقتين كحد أقصى مسموح به لكل متسابق في ألعاب القوى!`);
      return;
    }

    if (existingStudentRecords.some(p => p.disciplineId === activeDiscipline.id)) {
      toast.error(`التلميذ(ة) "${newStudentName.trim()}" مسجل مسبقاً في هذه المسابقة.`);
      return;
    }

    AthleticsService.addParticipant({
      disciplineId: activeDiscipline.id,
      category: selectedCategory,
      gender: selectedGender,
      bibNumber: newBib.trim(),
      studentName: newStudentName.trim(),
      schoolName: newSchoolName.trim(),
      birthYear: newBirthYear
    });

    setParticipants(AthleticsService.getParticipants());
    setNewBib('');
    setNewStudentName('');
    setIsAddParticipantOpen(false);
    toast.success(`تمت إضافة التلميذ(ة) ${newStudentName} للمسابقة بنجاح (ضمن الحد الأقصى المسموح: مسابقتين)`);
  };

  // --- SCHOOL PARTICIPANTS MANAGEMENT HANDLERS ---
  const handleOpenAddSchoolParticipant = () => {
    setEditingParticipant(null);
    setRegFullName('');
    setRegMassar('');
    setRegGender(selectedGender || 'Male');
    setRegCategory(selectedCategory || 'U15');
    setRegBirthDate('');
    setRegAffiliation('non_club');
    setRegDiscipline1(availableRegDisciplines[0]?.id || disciplines[0]?.id || '');
    setRegDiscipline2('');
    const nextBib = String(participants.length + 101);
    setRegBibNumber(nextBib);
    setRegCoachName(currentUser?.fullName || '');
    setRegCoachPhone(currentUser?.phone || '');
    setIsSchoolRegModalOpen(true);
  };

  const handleOpenEditSchoolParticipant = (p: AthleticsParticipantRecord) => {
    setEditingParticipant(p);
    setRegFullName(p.studentName);
    setRegMassar(p.massarNumber || '');
    setRegGender(p.gender);
    setRegCategory(p.category);
    setRegBirthDate(p.birthDate || (p.birthYear ? `${p.birthYear}-01-01` : ''));
    setRegAffiliation(p.affiliationType || 'non_club');
    setRegDiscipline1(p.disciplineId);
    setRegDiscipline2(p.secondDisciplineId || '');
    setRegBibNumber(p.bibNumber);
    setRegCoachName(p.coachName || currentUser?.fullName || '');
    setRegCoachPhone(p.coachPhone || currentUser?.phone || '');
    setIsSchoolRegModalOpen(true);
  };

  const handleSaveSchoolParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regFullName.trim()) {
      toast.error('يرجى كتابة الاسم والنسب الكامل للتلميذ(ة)');
      return;
    }
    if (!regDiscipline1) {
      toast.error('يرجى تحديد المسابقة الأولى');
      return;
    }
    if (regDiscipline2 && regDiscipline2 === regDiscipline1) {
      toast.error('المسابقة الثانية يجب أن تكون مختلفة عن المسابقة الأولى');
      return;
    }

    const targetSchool = (isTeacher ? detectedTeacherSchool : selectedSchoolForView) || 'المؤسسة التعليمية';
    const bYear = regBirthDate ? String(new Date(regBirthDate).getFullYear()) : (regCategory === 'U12' ? '2014' : regCategory === 'U15' ? '2011' : regCategory === 'U18' ? '2008' : '2006');

    if (editingParticipant) {
      AthleticsService.updateParticipant(editingParticipant.id, {
        studentName: regFullName.trim(),
        massarNumber: regMassar.trim(),
        gender: regGender,
        category: regCategory,
        birthDate: regBirthDate,
        birthYear: bYear,
        affiliationType: regAffiliation,
        disciplineId: regDiscipline1,
        secondDisciplineId: regDiscipline2 || undefined,
        bibNumber: regBibNumber.trim() || editingParticipant.bibNumber,
        schoolName: targetSchool,
        coachName: regCoachName.trim(),
        coachPhone: regCoachPhone.trim()
      });
      toast.success(`تم تحديث بيانات المشارك(ة) «${regFullName.trim()}» بنجاح`);
    } else {
      AthleticsService.addParticipant({
        studentName: regFullName.trim(),
        massarNumber: regMassar.trim(),
        gender: regGender,
        category: regCategory,
        birthDate: regBirthDate,
        birthYear: bYear,
        affiliationType: regAffiliation,
        disciplineId: regDiscipline1,
        secondDisciplineId: regDiscipline2 || undefined,
        bibNumber: regBibNumber.trim() || `${100 + participants.length + 1}`,
        schoolName: targetSchool,
        coachName: regCoachName.trim(),
        coachPhone: regCoachPhone.trim(),
        addedByTeacherId: currentUser?.id
      });
      toast.success(`تم تسجيل التلميذ(ة) «${regFullName.trim()}» بلائحة المؤسسة بنجاح`);
    }

    setParticipants(AthleticsService.getParticipants());
    setIsSchoolRegModalOpen(false);
  };

  const handlePromptDeleteParticipant = (p: AthleticsParticipantRecord) => {
    setParticipantToDelete(p);
  };

  const handleConfirmDeleteParticipant = () => {
    if (!participantToDelete) return;
    AthleticsService.deleteParticipant(participantToDelete.id);
    setParticipants(AthleticsService.getParticipants());
    toast.success(`تم حذف المشارك(ة) «${participantToDelete.studentName}» من اللائحة`);
    setParticipantToDelete(null);
  };

  const handlePromptRemoveMember = (m: CommitteeTeacherMember) => {
    setMemberToDelete({ teacherName: m.teacherName, teacherId: m.teacherId });
  };

  const handleConfirmRemoveMember = () => {
    if (!memberToDelete) return;
    setCommitteeMembersList(prev => prev.filter(m => m.teacherId !== memberToDelete.teacherId));
    toast.success(`تم حذف الأستاذ ${memberToDelete.teacherName} من أعضاء اللجنة`);
    setMemberToDelete(null);
  };

  const handleLoadDemoData = () => {
    const res = AthleticsService.loadDefaultMockData();
    setCommittees(AthleticsService.getCommittees());
    setDisciplines(AthleticsService.getDisciplines());
    setAssignments(AthleticsService.getCommitteeAssignments());
    setParticipants(AthleticsService.getParticipants());
    setResults(AthleticsService.getAllResults());
    toast.success(`تم بنجاح تحميل البيانات وتوليد 10 متسابقين في كل سباق وفئة وجنس لجميع اللجان (${res.participantsCount} مشارك في ${res.disciplinesCount} مسابقة)`);
  };

  const handleSeedAllCommittees = (mode: 'replace' | 'merge') => {
    const res = AthleticsService.seedAllCommitteesParticipants(10, mode);
    setParticipants(AthleticsService.getParticipants());
    toast.success(`تم بنجاح ${mode === 'replace' ? 'توليد واستبدال' : 'دمج'} 10 متسابقين في كل سباق وفئة وجنس لجميع اللجان (${res.totalParticipants} مشارك في ${res.totalEvents} سباقاً)!`);
  };

  const handleSeedCommittee = (committeeId: string, committeeTitle: string, mode: 'replace' | 'merge') => {
    const res = AthleticsService.seedCommitteeParticipants(committeeId, 10, mode);
    setParticipants(AthleticsService.getParticipants());
    toast.success(`تم بنجاح ${mode === 'replace' ? 'توليد' : 'دمج'} 10 متسابقين لكل سباق وفئة وجنس لـ «${committeeTitle}» (${res.addedCount} مشارك جديد، المجموع: ${res.totalCommitteeParticipants})!`);
  };

  const handleSeedCurrentEvent = () => {
    if (!activeDiscipline) return;
    AthleticsService.seedSingleEventParticipants(activeDiscipline.id, selectedCategory, selectedGender, 10);
    setParticipants(AthleticsService.getParticipants());
    toast.success(`تم بنجاح دمج 10 متسابقين في سباق «${activeDiscipline.nameAr}» (${selectedCategory} - ${selectedGender === 'Male' ? 'ذكور' : 'إناث'})!`);
  };

  const handleLoadSchoolDemoData = () => {
    const school = (isTeacher ? detectedTeacherSchool : selectedSchoolForView) || 'المؤسسة التعليمية';
    if (!school || school === 'ALL') {
      toast.error('يرجى اختيار مؤسسة تعليمية محددة أولاً');
      return;
    }
    const res = AthleticsService.loadDefaultSchoolData(school);
    setParticipants(AthleticsService.getParticipants());
    toast.success(`تم بنجاح توليد ${res.participantsCount} مشارك افتراضي لمؤسسة «${school}»`);
  };

  const handleOpenCommitteePermissionsModal = (comm: AthleticsCommitteeDef) => {
    setEditingPermissionsCommittee(comm);
    const perms = comm.permissions || {
      allowedTabs: comm.id === 'podium_committee' ? ['podium'] : comm.id.includes('jump') || comm.id.includes('shot') ? ['field'] : ['stopwatch'],
      allowedDisciplineIds: comm.disciplines || [],
      canRecordResults: true,
      canValidateResults: true,
      canPrintReports: true,
      canExportData: true
    };
    setTempAllowedTabs(perms.allowedTabs);
    setTempAllowedDiscIds(perms.allowedDisciplineIds || comm.disciplines || []);
    setTempCanRecord(perms.canRecordResults);
    setTempCanValidate(perms.canValidateResults);
    setTempCanPrint(perms.canPrintReports);
    setTempCanExport(perms.canExportData);
    setIsPermissionsModalOpen(true);
  };

  const handleSaveCommitteePermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPermissionsCommittee) return;
    const updated = AthleticsService.updateCommitteePermissions(editingPermissionsCommittee.id, {
      allowedTabs: tempAllowedTabs.length > 0 ? tempAllowedTabs : ['events'],
      allowedDisciplineIds: tempAllowedDiscIds,
      canRecordResults: tempCanRecord,
      canValidateResults: tempCanValidate,
      canPrintReports: tempCanPrint,
      canExportData: tempCanExport
    });
    if (updated) {
      setCommittees(AthleticsService.getCommittees());
      toast.success(`تم بنجاح تحديث وتثبيت صلاحيات «${editingPermissionsCommittee.titleAr}»`);
    }
    setIsPermissionsModalOpen(false);
  };

  const handleExportSchoolExcel = () => {
    try {
      const targetSchool = (isTeacher ? detectedTeacherSchool : selectedSchoolForView) || 'جميع المؤسسات';
      const exportData = currentSchoolParticipants.map((p, idx) => {
        const disc1 = disciplines.find(d => d.id === p.disciplineId);
        const disc2 = p.secondDisciplineId ? disciplines.find(d => d.id === p.secondDisciplineId) : null;
        return {
          'الرقم الترتيبي': idx + 1,
          'الاسم والنسب الكامل': p.studentName,
          'رقم مسار': p.massarNumber || '---',
          'الجنس': p.gender === 'Male' ? 'ذكر' : 'أنثى',
          'تاريخ الازدياد': p.birthDate || p.birthYear || '---',
          'الفئة العمرية': p.category === 'U12' ? 'براعم (U12)' : p.category === 'U15' ? 'صغار (U15)' : p.category === 'U18' ? 'فتيان (U18)' : 'شبان (U20)',
          'المسابقة الأولى': disc1 ? `${disc1.nameAr} (${disc1.distanceOrUnit})` : p.disciplineId,
          'المسابقة الثانية': disc2 ? `${disc2.nameAr} (${disc2.distanceOrUnit})` : (p.secondDisciplineId || 'لا توجد'),
          'رقم الصدرية': p.bibNumber,
          'الصفة الرياضية': p.affiliationType === 'club_affiliated' ? 'منتمي لنادي' : 'مدرسي',
          'المؤسسة التعليمية': p.schoolName,
          'الأستاذ المؤطر': p.coachName || currentUser?.fullName || '---',
          'هاتف المؤطر': p.coachPhone || currentUser?.phone || '---'
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      worksheet['!views'] = [{ RTL: true }];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'لائحة مشاركي ألعاب القوى');
      const cleanSchool = targetSchool.replace(/\s+/g, '_');
      const fileName = `لائحة_ألعاب_القوى_${cleanSchool}_${season.replace(/\//g, '-')}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      toast.success('تم تصدير لائحة المشاركين بصيغة Excel بنجاح!');
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('حدث خطأ أثناء تصدير ملف الإكسيل');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-900 dark:text-slate-100 transition-colors duration-300">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER WITH APP IDENTITY & SETTINGS BUTTON */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-blue-700 via-slate-700 to-indigo-900 dark:from-blue-900 dark:via-slate-900 dark:to-indigo-950 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between shrink-0 transition-colors">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 text-xl sm:text-2xl font-black shrink-0">
              🏃‍♂️
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                <h2 className="text-sm sm:text-lg font-black text-white truncate">
                  <span className="hidden sm:inline">تدبير البطولة المدرسية لألعاب القوى (Athletics Manager)</span>
                  <span className="inline sm:hidden">ألعاب القوى المدرسية</span>
                </h2>
                <span className="hidden xs:inline-block px-2 sm:px-2.5 py-0.5 text-[9px] sm:text-[10px] font-black bg-white/20 dark:bg-amber-500/20 text-white dark:text-amber-300 border border-white/30 dark:border-amber-500/30 rounded-full">
                  {season}
                </span>

                {/* User Role & Access Status Badge */}
                {currentUser && (
                  <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-lg border hidden sm:flex items-center gap-1 ${
                    userAccess.canManage
                      ? 'bg-emerald-500/20 dark:bg-emerald-950/80 text-white dark:text-emerald-300 border-emerald-400/30 dark:border-emerald-800'
                      : 'bg-amber-500/20 dark:bg-amber-950/80 text-white dark:text-amber-300 border-amber-400/30 dark:border-amber-800'
                  }`}>
                    {userAccess.canManage ? <Unlock className="w-3 h-3 text-emerald-200 dark:text-emerald-400" /> : <Lock className="w-3 h-3 text-amber-200 dark:text-amber-400" />}
                    <span>{userAccess.canManage ? 'تحكيم مفعل' : 'قراءة فقط'}</span>
                  </span>
                )}

                {userAssignedCommittee && (
                  <span className="px-2.5 py-0.5 text-[10px] font-black bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 rounded-lg shadow-sm flex items-center gap-1">
                    <span>🏁 صفة التحكيم: {userAssignedCommittee}</span>
                  </span>
                )}
              </div>
              <p className="hidden md:block text-xs text-white/80 dark:text-slate-300 font-medium">
                إدارة اللجان، توزيع مهام الأساتذة، تسجيل المشاركين، والميقاتي الذكي للسباقات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            
            {/* Admin/Teacher Controls consolidated into Settings */}
            {(effectiveRole === 'ADMIN' || isTeacher) && (
              <button
                onClick={() => {
                  setIsSettingsModalOpen(true);
                  if (isTeacher) setSettingsActiveTab('auto_import');
                }}
                className="p-2 sm:px-4 sm:py-2 bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white border border-slate-600 rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all cursor-pointer group active:scale-95"
                title={effectiveRole === 'ADMIN' ? 'الإعدادات والتحكم' : 'أدوات التحكم'}
              >
                <SettingsIcon className="w-4 h-4 group-hover:rotate-45 transition-transform text-amber-400" />
                <span className="hidden sm:inline">{effectiveRole === 'ADMIN' ? 'الإعدادات والتحكم' : 'أدوات التحكم'}</span>
              </button>
            )}

            {/* Teacher Specific Actions */}
            {effectiveRole === 'TEACHER' && (
              <>
                <button
                  type="button"
                  onClick={handleOpenAddSchoolParticipant}
                  className="p-2 sm:px-3.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                  title="تسجيل تلميذ مشارك جديد لمؤسستي"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">تسجيل مشارك</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintRosterModalOpen(true)}
                  className="p-2 sm:px-3 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
                  title="طبع لائحة المشاركة الرسمية للمؤسسة"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">طبع اللائحة</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSchoolExcel}
                  className="p-2 sm:px-3 sm:py-2 bg-emerald-700/80 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                  title="تصدير لائحة المشاركين إلى ملف Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                  <span className="hidden sm:inline">Excel</span>
                </button>
              </>
            )}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleDarkMode}
              className="p-2 bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-all cursor-pointer group active:scale-90 border border-slate-200 dark:border-slate-700 shadow-sm dark:shadow-none"
              title={isDarkMode ? 'التحويل للوضع النهاري' : 'التحويل للوضع الليلي'}
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-amber-400 group-hover:rotate-45 transition-transform" />
              ) : (
                <Moon className="w-5 h-5 text-indigo-500 group-hover:-rotate-12 transition-transform" />
              )}
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Active Committee Permission Notification Banner */}
        {activeCommitteePermissionDef && (
          <div className="bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 border-b border-indigo-800/80 px-4 sm:px-6 py-2 flex items-center justify-between text-xs text-indigo-200 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base p-1 bg-indigo-900/60 rounded-lg">{activeCommitteePermissionDef.icon}</span>
              <span>
                أنت في وضع صلاحيات: <strong className="text-amber-300">{activeCommitteePermissionDef.titleAr}</strong> • تظهر لك المسابقات الخاصة بهذه اللجنة فقط والأزرار المسموح بها.
              </span>
            </div>
            <button
              onClick={() => setActiveRoleMode('ADMIN')}
              className="px-2.5 py-1 bg-indigo-900/80 hover:bg-indigo-800 text-indigo-100 rounded-lg text-[11px] font-bold border border-indigo-700 transition-all cursor-pointer"
            >
              العودة للوضع الكامل 👑
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TOP TAB NAVIGATION BAR */}
        {/* ========================================================================= */}
        <div className="bg-slate-100 dark:bg-slate-950 px-2 sm:px-6 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-1.5 overflow-x-auto shrink-0 scrollbar-none transition-colors">
          <div className="flex items-center gap-1 sm:gap-1.5">
            {allowedTabs.includes('school_registration') && (
              <button
                onClick={() => setActiveTab('school_registration')}
                title={effectiveRole === 'TEACHER' ? 'تسجيل مشاركي المؤسسة' : 'لوائح ومشاركو المؤسسات'}
                className={`p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'school_registration'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400/40'
                    : 'text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <Building className="w-4 h-4 text-emerald-600 dark:text-emerald-200 shrink-0" />
                <span className="hidden sm:inline">{effectiveRole === 'TEACHER' ? 'تسجيل مشاركي المؤسسة' : 'لوائح المؤسسات'}</span>
              </button>
            )}

            {allowedTabs.includes('my_participations') && (
              <button
                onClick={() => setActiveTab('my_participations')}
                title="مشاركاتي ونتائج تلاميذي"
                className={`p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'my_participations'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-2 ring-purple-400/40'
                    : 'text-slate-500 dark:text-slate-400 hover:text-purple-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
                }`}
              >
                <UserCheck className="w-4 h-4 text-purple-600 dark:text-purple-200 shrink-0" />
                <span className="hidden sm:inline">مشاركاتي وتلاميذي</span>
              </button>
            )}

            {allowedTabs.includes('events') && (
              <button
                onClick={() => setActiveTab('events')}
                title="المسابقات والتخصصات"
                className={`p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'events'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Layers className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">المسابقات</span>
                <span className="hidden sm:inline px-1.5 py-0.2 bg-blue-500/30 text-blue-200 rounded text-[10px]">{disciplines.length}</span>
              </button>
            )}

            {allowedTabs.includes('committees') && (
              <button
                onClick={() => setActiveTab('committees')}
                title="اللجان ومهام الأساتذة"
                className={`p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'committees'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">اللجان والمهام</span>
                <span className="hidden sm:inline px-1.5 py-0.2 bg-amber-500/30 text-amber-200 rounded text-[10px]">{committees.length}</span>
              </button>
            )}

            {allowedTabs.includes('stopwatch') && (
              <button
                onClick={() => setActiveTab('stopwatch')}
                title="الميقاتي الذكي للسباقات"
                className={`p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'stopwatch'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Timer className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
                <span className="hidden sm:inline">الميقاتي</span>
              </button>
            )}

            {allowedTabs.includes('field') && (
              <button
                onClick={() => setActiveTab('field')}
                title="مسابقات الميدان (القفز والجلة)"
                className={`p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'field'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Award className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">الميدان</span>
              </button>
            )}

            {allowedTabs.includes('podium') && (
              <button
                onClick={() => setActiveTab('podium')}
                title="منصة التتويج والنتائج الرسمية"
                className={`p-2 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'podium'
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="hidden sm:inline">منصة التتويج</span>
              </button>
            )}
          </div>

          {/* Quick Active Event Summary Pill */}
          {activeDiscipline && (
            <div className="hidden lg:flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-xl text-xs shadow-sm dark:shadow-none">
              <span className="text-slate-500 dark:text-slate-400">المسابقة:</span>
              <span className="font-black text-amber-600 dark:text-amber-400">{activeDiscipline.nameAr}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{selectedCategory}</span>
              <span className="text-slate-300 dark:text-slate-600">•</span>
              <span className="font-bold text-rose-500 dark:text-pink-400">{selectedGender === 'Male' ? 'ذكور' : 'إناث'}</span>
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* PERMISSION NOTICE BANNER IF USER CANNOT EDIT CURRENT COMMITTEE */}
        {/* ========================================================================= */}
        {!userAccess.canManage && (
          <div className="bg-amber-950/80 border-b border-amber-800/80 px-4 py-2 flex items-center justify-between text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{userAccess.reason}</span>
            </div>
            <span className="text-[11px] bg-amber-900/60 px-2 py-0.5 rounded border border-amber-700 font-mono">
              تصفح للقراءة فقط
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL BODY CONTENT */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

          {/* ======================================================================= */}
          {/* TAB 0.5: MY PARTICIPATIONS (FOR TEACHERS) */}
          {/* ======================================================================= */}
          {activeTab === 'my_participations' && (
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 dark:from-purple-900/40 to-indigo-50 dark:to-indigo-900/40 border border-purple-100 dark:border-purple-500/30 rounded-3xl p-6 relative overflow-hidden transition-colors shadow-sm dark:shadow-none">
                <div className="absolute top-0 right-0 p-4 opacity-10 rotate-12">
                  <Trophy className="w-32 h-32 text-purple-600 dark:text-white" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <UserCheck className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                      <span>تتبع مشاركات ونتائج تلاميذ مؤسسة: «{detectedTeacherSchool || 'مؤسستي'}»</span>
                    </h3>
                    <p className="text-sm text-purple-700/70 dark:text-purple-200/70 mt-1">
                      يمكنك هنا متابعة حالة تلاميذك في مختلف المسابقات والاطلاع على النتائج المحققة فور المصادقة عليها.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white/80 dark:bg-slate-900/60 px-4 py-2 rounded-2xl border border-purple-200 dark:border-purple-500/20 text-center shadow-sm dark:shadow-none">
                      <span className="text-[10px] text-purple-600 dark:text-purple-300 block font-bold uppercase tracking-wider">إجمالي المشاركات</span>
                      <span className="text-xl font-black text-slate-900 dark:text-white">{currentSchoolParticipants.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Participants Tracking List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentSchoolParticipants.map(participant => {
                  const disc1 = disciplines.find(d => d.id === participant.disciplineId);
                  const disc2 = participant.secondDisciplineId ? disciplines.find(d => d.id === participant.secondDisciplineId) : null;
                  
                  // Find results for this participant
                  const pResults = (Object.values(results) as AthleticsEventResult[]).filter(r => 
                    (r.trackLaps?.some(l => l.participantId === participant.id)) ||
                    (r.fieldEntries?.some(a => a.participantId === participant.id))
                  );

                  return (
                    <div key={participant.id} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden flex flex-col shadow-lg dark:shadow-purple-500/5 hover:border-purple-500/40 transition-all group">
                      <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-xl font-black border border-slate-200 dark:border-slate-700 text-purple-600 dark:text-purple-400 shadow-sm">
                            {participant.studentName.charAt(0)}
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">{participant.studentName}</h4>
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 font-bold uppercase">صدريـة: {participant.bibNumber} • {participant.category} • {participant.gender === 'Male' ? 'ذكر' : 'أنثى'}</span>
                          </div>
                        </div>
                        <div className="bg-purple-100 dark:bg-purple-500/10 text-purple-700 dark:text-purple-400 px-2 py-1 rounded-lg text-[10px] font-black border border-purple-200 dark:border-purple-500/20">
                          تلميذ مشارك
                        </div>
                      </div>

                      <div className="p-4 flex-1 space-y-4">
                        {/* Discipline 1 */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1">
                              {disc1?.icon} المسابقة الأساسية:
                            </span>
                            <span className="text-blue-600 dark:text-blue-400">{disc1?.nameAr}</span>
                          </div>
                          
                          {/* Result for Disc 1 */}
                          {(() => {
                            const res = pResults.find(r => r.disciplineId === participant.disciplineId);
                            if (!res) return (
                              <div className="flex items-center gap-2 text-[10px] bg-slate-50 dark:bg-slate-900 p-2 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-400 dark:text-slate-500 italic">
                                <Timer className="w-3 h-3" />
                                <span>في انتظار انطلاق المنافسة...</span>
                              </div>
                            );
                            
                            if (res.type === 'track') {
                              const entry = res.trackLaps?.find(l => l.participantId === participant.id);
                              return (
                                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/5 p-2 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${entry?.rank === 1 ? 'bg-amber-500 text-white shadow-md' : entry?.rank === 2 ? 'bg-slate-200 dark:bg-slate-300 text-slate-700 dark:text-slate-900' : entry?.rank === 3 ? 'bg-orange-400 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                      {entry?.rank || '-'}
                                    </div>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{entry?.formattedTime}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500">الرتبة النهائية</span>
                                </div>
                              );
                            } else {
                              const entry = res.fieldEntries?.find(a => a.participantId === participant.id);
                              return (
                                <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-500/5 p-2 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${entry?.rank === 1 ? 'bg-amber-500 text-white shadow-md' : entry?.rank === 2 ? 'bg-slate-200 dark:bg-slate-300 text-slate-700 dark:text-slate-900' : entry?.rank === 3 ? 'bg-orange-400 text-white shadow-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                      {entry?.rank || '-'}
                                    </div>
                                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">{entry?.bestAttempt !== null && entry?.bestAttempt !== undefined ? `${entry.bestAttempt} م` : '-'}</span>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-500">أفضل علامة</span>
                                </div>
                              );
                            }
                          })()}
                        </div>

                        {/* Discipline 2 if exists */}
                        {participant.secondDisciplineId && (
                          <div className="space-y-2 pt-2 border-t border-slate-800/50">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                              <span className="flex items-center gap-1">
                                {disc2?.icon} المسابقة الثانية:
                              </span>
                              <span className="text-indigo-400">{disc2?.nameAr}</span>
                            </div>
                            
                            {/* Result for Disc 2 */}
                            {(() => {
                              const res = pResults.find(r => r.disciplineId === participant.secondDisciplineId);
                              if (!res) return (
                                <div className="flex items-center gap-2 text-[10px] bg-slate-900 p-2 rounded-xl border border-slate-800 text-slate-500 italic">
                                  <Timer className="w-3 h-3" />
                                  <span>في انتظار انطلاق المنافسة...</span>
                                </div>
                              );
                              
                              if (res.type === 'track') {
                                const entry = res.trackLaps?.find(l => l.participantId === participant.id);
                                return (
                                  <div className="flex items-center justify-between bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/20">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${entry?.rank === 1 ? 'bg-amber-500 text-white' : entry?.rank === 2 ? 'bg-slate-300 text-slate-900' : entry?.rank === 3 ? 'bg-orange-400 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                        {entry?.rank || '-'}
                                      </div>
                                      <span className="text-xs font-black text-emerald-400">{entry?.formattedTime}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">الرتبة النهائية</span>
                                  </div>
                                );
                              } else {
                                const entry = res.fieldEntries?.find(a => a.participantId === participant.id);
                                return (
                                  <div className="flex items-center justify-between bg-emerald-500/5 p-2 rounded-xl border border-emerald-500/20">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${entry?.rank === 1 ? 'bg-amber-500 text-white' : entry?.rank === 2 ? 'bg-slate-300 text-slate-900' : entry?.rank === 3 ? 'bg-orange-400 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                        {entry?.rank || '-'}
                                      </div>
                                      <span className="text-xs font-black text-emerald-400">{entry?.bestAttempt !== null && entry?.bestAttempt !== undefined ? `${entry.bestAttempt} م` : '-'}</span>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-500">أفضل علامة</span>
                                  </div>
                                );
                              }
                            })()}
                          </div>
                        )}
                      </div>

                      <div className="px-4 py-2.5 bg-slate-900/30 flex items-center justify-between">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">الحالة: {pResults.length === (participant.secondDisciplineId ? 2 : 1) ? 'اكتملت المشاركة ✅' : 'قيد الانتظار ⏳'}</span>
                        <button 
                          onClick={() => {
                            setActiveTab('podium');
                            if (pResults.length > 0) {
                              setSelectedDiscipline(disciplines.find(d => d.id === pResults[0].disciplineId) || null);
                            }
                          }}
                          className="text-[10px] font-black text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <span>تفاصيل النتائج</span>
                          <ChevronRight className="w-3 h-3 rotate-180" />
                        </button>
                      </div>
                    </div>
                  );
                })}

                {currentSchoolParticipants.length === 0 && (
                  <div className="col-span-full py-20 text-center space-y-4">
                    <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-3xl text-slate-600 grayscale">
                      🏅
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-white">لا توجد مشاركات مسجلة حالياً</h4>
                      <p className="text-xs text-slate-500">قم بتسجيل تلاميذك في المسابقات أولاً لتتمكن من تتبع نتائجهم هنا.</p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('school_registration')}
                      className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-purple-600/30 cursor-pointer"
                    >
                      انتقل لتسجيل المشاركين الآن
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 0: SCHOOL PARTICIPANT REGISTRATION & ROSTER MANAGEMENT */}
          {/* ======================================================================= */}
          {activeTab === 'school_registration' && (
            <div className="space-y-6">
              
              {/* Institution Header Card */}
              <div className="bg-gradient-to-r from-emerald-950/70 via-slate-900 to-teal-950/60 border-2 border-emerald-800/80 rounded-3xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 bg-emerald-600 text-white px-4 py-1 rounded-br-2xl text-[10px] font-black flex items-center gap-1.5 shadow-xs">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>اللائحة الرسمية للمؤسسة التعليمية</span>
                </div>

                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5 pt-2">
                  <div className="flex items-start sm:items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-lg shadow-emerald-600/30 text-2xl font-black">
                      <SchoolIcon className="w-7 h-7" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {isTeacher ? (
                          <h3 className="text-lg sm:text-xl font-black text-white">
                            {detectedTeacherSchool || 'مؤسستي التعليمية'}
                          </h3>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-300 font-bold">المؤسسة التعليمية:</span>
                            <select
                              value={selectedSchoolForView}
                              onChange={(e) => setSelectedSchoolForView(e.target.value)}
                              className="px-3 py-1.5 bg-slate-900 border border-emerald-700/80 rounded-xl text-xs font-black text-emerald-300 cursor-pointer"
                            >
                              <option value="ALL">جميع المؤسسات التعليمية (عرض إجمالي)</option>
                              {schools.map(s => (
                                <option key={s.id} value={s.name}>{s.name}</option>
                              ))}
                            </select>
                          </div>
                        )}
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          {season}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-300 flex-wrap">
                        <span className="flex items-center gap-1">
                          <UserIcon className="w-3.5 h-3.5 text-amber-400" />
                          <span>الأستاذ المؤطر: <strong>{currentUser?.fullName || 'ذ. التربية البدنية'}</strong></span>
                        </span>
                        {currentUser?.phone && (
                          <span className="flex items-center gap-1 text-slate-400">
                            <Phone className="w-3.5 h-3.5 text-blue-400" />
                            <span dir="ltr">{currentUser.phone}</span>
                          </span>
                        )}
                        <span className="text-slate-400">• المديرية: {directorateName}</span>
                      </div>
                    </div>
                  </div>

                    {/* Action Buttons: Add, Print, Excel, MockData */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5 flex-wrap w-full lg:w-auto">
                    <button
                      type="button"
                      onClick={() => setIsDemoRosterModalOpen(true)}
                      className="p-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/25 cursor-pointer active:scale-95"
                      title="دمج 10 متسابقين في كل سباق وفئة وجنس وتوزيعها حسب اللجان للتجريب"
                    >
                      <Sparkles className="w-4 h-4 text-amber-300" />
                      <span className="hidden sm:inline">دمج 10 لكل سباق ولجنة</span>
                      <span className="inline sm:hidden">10 متسابقين</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddSchoolParticipant}
                      className="p-2 sm:px-4 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-95"
                      title="تسجيل تلميذ(ة) جديد في البطولة"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span className="hidden sm:inline">تسجيل تلميذ(ة) جديد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPrintRosterModalOpen(true)}
                      className="p-2 sm:px-4 sm:py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer active:scale-95"
                      title="طبع اللائحة الرسمية للمؤسسة"
                    >
                      <Printer className="w-4 h-4" />
                      <span className="hidden sm:inline">طبع اللائحة الرسمية</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportSchoolExcel}
                      className="p-2 sm:px-3.5 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer active:scale-95"
                      title="تصدير إلى ملف Excel"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span className="hidden sm:inline">Excel</span>
                    </button>
                  </div>
                </div>

                {/* Counters Pills */}
                <div className="mt-4 pt-4 border-t border-emerald-900/60 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-center text-xs">
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-slate-400 block font-bold">إجمالي المسجلين</span>
                    <span className="text-base font-black text-white">{currentSchoolParticipants.length}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-blue-400 block font-bold">ذكور</span>
                    <span className="text-base font-black text-blue-300">
                      {currentSchoolParticipants.filter(p => p.gender === 'Male').length}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-pink-400 block font-bold">إناث</span>
                    <span className="text-base font-black text-pink-300">
                      {currentSchoolParticipants.filter(p => p.gender === 'Female').length}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-amber-400 block font-bold">براعم (U12)</span>
                    <span className="text-base font-black text-amber-300">
                      {currentSchoolParticipants.filter(p => p.category === 'U12').length}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-emerald-400 block font-bold">صغار (U15)</span>
                    <span className="text-base font-black text-emerald-300">
                      {currentSchoolParticipants.filter(p => p.category === 'U15').length}
                    </span>
                  </div>
                  <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800">
                    <span className="text-[10px] text-purple-400 block font-bold">فتيان/شبان (U18/U20)</span>
                    <span className="text-base font-black text-purple-300">
                      {currentSchoolParticipants.filter(p => p.category === 'U18' || p.category === 'U20').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Filters Bar: Search & Category & Gender */}
              <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={schoolSearchQuery}
                    onChange={(e) => setSchoolSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم، رقم مسار، أو رقم الصدرية..."
                    className="w-full pr-9 pl-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={schoolCategoryFilter}
                    onChange={(e) => setSchoolCategoryFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    <option value="ALL">جميع الفئات</option>
                    <option value="U12">براعم (U12)</option>
                    <option value="U15">صغار (U15)</option>
                    <option value="U18">فتيان (U18)</option>
                    <option value="U20">شبان (U20)</option>
                  </select>

                  <select
                    value={schoolGenderFilter}
                    onChange={(e) => setSchoolGenderFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    <option value="ALL">جميع الأجناس</option>
                    <option value="Male">ذكور فقط</option>
                    <option value="Female">إناث فقط</option>
                  </select>

                  <select
                    value={schoolCommitteeFilter}
                    onChange={(e) => setSchoolCommitteeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    <option value="ALL">جميع اللجان</option>
                    <option value="sprint_committee">⚡ لجنة الجري السريع</option>
                    <option value="middle_distance_committee">🏃‍♂️ لجنة المسافات المتوسطة</option>
                    <option value="long_jump_committee">🦘 لجنة مسابقة القفز</option>
                    <option value="shot_put_committee">☄️ لجنة مسابقة الرمي</option>
                  </select>
                </div>
              </div>

              {/* Participants Roster Table */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md">
                {currentSchoolParticipants.length === 0 ? (
                  <div className="text-center py-12 px-4 space-y-3">
                    <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 text-slate-500 flex items-center justify-center mx-auto text-2xl">
                      🏃
                    </div>
                    <h4 className="text-sm font-black text-slate-300">لا يوجد تلاميذ مسجلون في هذه اللائحة حتى الآن</h4>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      يمكنك البدء بتسجيل تلاميذ مؤسستك وتحديد مسابقاتهم (سباقين كحد أقصى لكل عداء) عبر الضغط على الزر أدناه.
                    </p>
                    <button
                      type="button"
                      onClick={handleOpenAddSchoolParticipant}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all inline-flex items-center gap-1.5 cursor-pointer mt-2"
                    >
                      <Plus className="w-4 h-4" />
                      <span>تسجيل أول مشارك الآن</span>
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-900 text-slate-400 font-black border-b border-slate-800">
                        <tr>
                          <th className="py-3 px-3.5 text-center w-12">#</th>
                          <th className="py-3 px-3.5">الاسم والنسب</th>
                          <th className="py-3 px-3.5">رقم مسار</th>
                          <th className="py-3 px-3.5">الفئة والجنس</th>
                          <th className="py-3 px-3.5">المسابقات المسجل فيها (حد أقصى 2)</th>
                          <th className="py-3 px-3.5 text-center">رقم الصدرية</th>
                          <th className="py-3 px-3.5">الصفة</th>
                          <th className="py-3 px-3.5 text-center w-28">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {currentSchoolParticipants.map((p, idx) => {
                          const disc1 = disciplines.find(d => d.id === p.disciplineId);
                          const disc2 = p.secondDisciplineId ? disciplines.find(d => d.id === p.secondDisciplineId) : null;
                          const isFemale = p.gender === 'Female';

                          return (
                            <tr key={p.id} className="hover:bg-slate-900/60 transition-colors">
                              <td className="py-3 px-3.5 text-center font-mono font-bold text-slate-400">
                                {idx + 1}
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="font-black text-white">{p.studentName}</div>
                                {p.birthDate && (
                                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                    تاريخ الازدياد: {p.birthDate}
                                  </div>
                                )}
                              </td>

                              <td className="py-3 px-3.5 font-mono text-slate-300 font-bold">
                                {p.massarNumber || '---'}
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-blue-950 text-blue-300 border border-blue-800">
                                    {p.category}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                    isFemale ? 'bg-pink-950 text-pink-300 border border-pink-800' : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    {isFemale ? 'أنثى' : 'ذكر'}
                                  </span>
                                </div>
                              </td>

                              <td className="py-3 px-3.5">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {disc1 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-emerald-950 text-emerald-300 border border-emerald-800">
                                      <span>{disc1.icon}</span>
                                      <span>{disc1.nameAr}</span>
                                    </span>
                                  )}
                                  {disc2 && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-black bg-amber-950 text-amber-300 border border-amber-800">
                                      <span>{disc2.icon}</span>
                                      <span>{disc2.nameAr}</span>
                                    </span>
                                  )}
                                  {!disc1 && !disc2 && (
                                    <span className="text-slate-500 font-mono text-[11px]">{p.disciplineId}</span>
                                  )}
                                </div>
                              </td>

                              <td className="py-3 px-3.5 text-center">
                                <span className="inline-block px-2.5 py-0.5 font-mono font-black text-xs bg-slate-900 border border-slate-700 rounded-lg text-amber-400 shadow-inner">
                                  #{p.bibNumber}
                                </span>
                              </td>

                              <td className="py-3 px-3.5">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  p.affiliationType === 'club_affiliated'
                                    ? 'bg-purple-950 text-purple-300 border border-purple-800'
                                    : 'bg-slate-800 text-slate-400'
                                }`}>
                                  {p.affiliationType === 'club_affiliated' ? 'نادي' : 'مدرسي'}
                                </span>
                              </td>

                              <td className="py-3 px-3.5 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditSchoolParticipant(p)}
                                    className="p-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-white rounded-lg transition-colors border border-amber-500/30 cursor-pointer"
                                    title="تعديل بيانات التلميذ"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePromptDeleteParticipant(p)}
                                    className="p-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg transition-colors border border-rose-500/30 cursor-pointer"
                                    title="حذف من اللائحة"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 1: DISCIPLINES & EVENTS DASHBOARD */}
          {/* ======================================================================= */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              
              {/* Filter Bar: Category & Gender */}
              <div className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">الفئة العمرية:</span>
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    {(['U12', 'U15', 'U18', 'U20'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {cat === 'U12' ? 'براعم (U12)' : cat === 'U15' ? 'صغار (U15)' : cat === 'U18' ? 'فتيان (U18)' : 'شبان (U20)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-700 dark:text-slate-300">الجنس:</span>
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => setSelectedGender('Male')}
                      className={`px-2.5 sm:px-3.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                        selectedGender === 'Male'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="ذكور"
                    >
                      <span>🏃‍♂️</span>
                      <span className="hidden sm:inline">ذكور</span>
                    </button>
                    <button
                      onClick={() => setSelectedGender('Female')}
                      className={`px-2.5 sm:px-3.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                        selectedGender === 'Female'
                          ? 'bg-pink-600 text-white shadow-xs'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                      }`}
                      title="إناث"
                    >
                      <span>🏃‍♀️</span>
                      <span className="hidden sm:inline">إناث</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Disciplines Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentCategoryGendersDisciplines.map(disc => {
                  const eventKey = `${disc.id}_${selectedCategory}_${selectedGender}`;
                  const isCompleted = results[eventKey]?.status === 'completed';
                  const isSelected = activeDiscipline?.id === disc.id;
                  const committee = committees.find(c => c.id === disc.committeeId);
                  const assignment = committee ? assignments[committee.id] : null;
                  const partCount = participants.filter(
                    p => p.disciplineId === disc.id && p.category === selectedCategory && p.gender === selectedGender
                  ).length;

                  return (
                    <div
                      key={disc.id}
                      onClick={() => {
                        setSelectedDiscipline(disc);
                        if (disc.type.startsWith('track')) {
                          setActiveTab('stopwatch');
                        } else {
                          setActiveTab('field');
                        }
                      }}
                      className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-slate-800/90 border-blue-500 shadow-lg ring-2 ring-blue-500/20'
                          : 'bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-850 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl">{disc.icon}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                            }`}>
                              {isCompleted ? '✓ معتمد بالنتائج' : 'مفتوح للتحكيم'}
                            </span>
                            {!isTeacher && (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleStartEditDiscipline(disc);
                                    setIsSettingsModalOpen(true);
                                    setSettingsActiveTab('disciplines');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="تعديل هذا السباق"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDiscipline(disc)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                  title="حذف هذا السباق"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <h3 className={`text-base font-black transition-colors ${isSelected ? 'text-blue-700 dark:text-white' : 'text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400'}`}>
                          {disc.nameAr}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                          {disc.nameFr} • {disc.distanceOrUnit}
                        </p>

                        <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <div className="flex items-center justify-between">
                            <span>اللجنة المشرفة:</span>
                            <span className="font-bold text-amber-600 dark:text-amber-300">{committee?.titleAr.replace('لجنة ', '')}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>الأستاذ المسؤول:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-200">{assignment?.teacherName || 'لم يعين بعد'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {partCount} مشارك مسجل
                        </span>
                        <div className="flex items-center gap-1 text-xs font-black text-blue-600 dark:text-blue-400 group-hover:translate-x-[-2px] transition-transform">
                          <span>{disc.type.startsWith('track') ? 'فتح الميقاتي' : 'إدخال المحاولات'}</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 2: COMMITTEES & TEACHERS TASKS (اللجان وتحديد المهام) */}
          {/* ======================================================================= */}
          {activeTab === 'committees' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 transition-colors">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    <span>اللجان وتوزيع المهام على الأساتذة المؤطرين</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    الأساتذة يتم استدعاؤهم مباشرة من قاعدة بيانات الأطر المسجلة مع تحديد دور ومهمة كل أستاذ في لجنته
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
                  <button
                    onClick={() => setIsDemoRosterModalOpen(true)}
                    className="p-2 sm:px-3.5 sm:py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                    title="دمج 10 متسابقين في كل سباق وفئة وجنس وتوزيعها حسب اللجان للتجريب"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>دمج 10 متسابقين لكل لجنة للتجريب</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsSettingsModalOpen(true);
                      setSettingsActiveTab('committees');
                    }}
                    className="p-2 sm:px-3.5 sm:py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                    title="تعديل اللجان والمهام وتعيين الأساتذة"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">تعديل اللجان والمهام</span>
                  </button>
                </div>
              </div>

              {/* Committees Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {committees.map(comm => {
                  const assignment = assignments[comm.id];
                  const commDisciplines = disciplines.filter(d => d.committeeId === comm.id);
                  const members = assignment?.members || [];

                  return (
                    <div
                      key={comm.id}
                      className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-blue-300 dark:hover:border-slate-700 transition-all relative overflow-hidden shadow-sm hover:shadow-md"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                              {comm.icon}
                            </span>
                            <div>
                              <h4 className="text-base font-black text-slate-900 dark:text-white">{comm.titleAr}</h4>
                              <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{comm.titleFr}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="px-2.5 py-1 text-[10px] font-black bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-xl">
                              {commDisciplines.length} مسابقات
                            </span>
                            {comm.id !== 'podium_committee' && (
                              <span className="px-2.5 py-1 text-[10px] font-black bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-500/30 rounded-xl" title="عدد المتسابقين المسجلين في هذه اللجنة">
                                🏃 {AthleticsService.getCommitteeParticipantStats(comm.id).totalParticipants} متسابق
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Head of Committee */}
                        <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                              <span>رئيس اللجنة الرئيسي:</span>
                            </span>
                            <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                              {assignment?.teacherName || 'لم يعين بعد'}
                            </span>
                          </div>
                          {assignment?.teacherSchool && (
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5 pr-4.5">
                              🏢 {assignment.teacherSchool}
                            </p>
                          )}
                        </div>

                        {/* Members & Tasks in Committee */}
                        <div className="space-y-1.5 mb-4">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block pr-1">
                            طاقم التحكيم والمهام المحددة ({members.length} أستاذ):
                          </span>
                          {members.length === 0 ? (
                            <p className="text-[11px] text-slate-400 italic pr-1">
                              لم يتم تعيين أعضاء إضافيين بعد.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {members.map((m, idx) => (
                                <div
                                  key={idx}
                                  className="px-3 py-1.5 bg-slate-50/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800/80 rounded-xl flex items-center justify-between text-xs transition-colors"
                                >
                                  <div>
                                    <span className="font-bold text-slate-800 dark:text-white block">{m.teacherName}</span>
                                    {m.schoolName && (
                                      <span className="text-[10px] text-slate-400">{m.schoolName}</span>
                                    )}
                                  </div>
                                  <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-950/80 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 rounded-lg text-[10px] font-black">
                                    {m.roleInCommittee}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Committee Permissions and Allowed Buttons Badge */}
                        <div className="bg-amber-50/50 dark:bg-slate-900/80 border border-amber-200/50 dark:border-slate-800 rounded-2xl p-3 mb-3 text-xs space-y-1.5 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                              <span>الصلاحيات والأزرار المصرح بها:</span>
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                            {comm.permissions?.allowedTabs?.map(t => (
                              <span key={t} className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-200 rounded-lg text-[9px] font-bold shadow-xs">
                                {t === 'stopwatch' ? 'الميقاتي الذكي' : t === 'field' ? 'مسابقات الميدان' : t === 'podium' ? 'منصة التتويج' : t === 'school_registration' ? 'لوائح المؤسسات' : 'المسابقات'}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap transition-colors">
                        <button
                          type="button"
                          onClick={() => setActiveRoleMode(comm.id)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                            activeRoleMode === comm.id
                              ? 'bg-amber-500 text-white shadow-md ring-2 ring-amber-400'
                              : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 border border-indigo-100 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{activeRoleMode === comm.id ? 'الصلاحية نشطة حالياً ✓' : 'معاينة بهذه الصلاحية'}</span>
                        </button>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {comm.id !== 'podium_committee' && (
                            <button
                              type="button"
                              onClick={() => handleSeedCommittee(comm.id, comm.titleAr, 'merge')}
                              className="px-2.5 py-1.5 bg-purple-50 dark:bg-purple-950/60 hover:bg-purple-100 dark:hover:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-xl text-[10px] font-black flex items-center gap-1 border border-purple-200 dark:border-purple-800 transition-all cursor-pointer active:scale-95"
                              title="دمج 10 متسابقين لكل سباق وفئة وجنس في هذه اللجنة للتجريب"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>دمج 10 لكل سباق</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenCommitteePermissionsModal(comm)}
                            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-amber-300 rounded-xl text-[10px] font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                          >
                            <SlidersHorizontal className="w-3 h-3 text-slate-500 dark:text-amber-400" />
                            <span>الصلاحيات</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenCommitteeEdit(comm)}
                            className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-bold flex items-center gap-1 border border-slate-200 dark:border-slate-700 cursor-pointer transition-all"
                          >
                            <Edit2 className="w-3 h-3 text-slate-400" />
                            <span>المهام</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 3: SMART STOPWATCH & MULTI-RANK RECORDER */}
          {/* ======================================================================= */}
          {activeTab === 'stopwatch' && activeDiscipline && (
            <div className="space-y-6">
              
              {/* Event Selector & Info Header (مخفي في وضعية الهاتف لتوفير المساحة وإبراز الميقاتي) */}
              <div className="hidden sm:flex bg-white dark:bg-slate-950 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-3 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-800 rounded-2xl text-emerald-600 dark:text-emerald-400">
                    ⚡
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-slate-900 dark:text-white">
                        {activeDiscipline.nameAr}
                      </h3>
                      <span className="px-2.5 py-0.5 text-xs font-black bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/30 rounded-lg">
                        {selectedCategory}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-black bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-500/30 rounded-lg">
                        {selectedGender === 'Male' ? 'ذكور' : 'إناث'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      الأستاذ المسؤول: <span className="text-amber-600 dark:text-amber-400 font-bold">{currentCommitteeAssignment?.teacherName || 'غير معين'}</span>
                    </p>
                  </div>
                </div>

                {/* Quick Switch Dropdown */}
                <div className="flex items-center gap-2 flex-wrap">
                  <select
                    value={activeDiscipline?.id || ''}
                    onChange={(e) => {
                      const disc = currentCategoryGendersDisciplines.find(d => d.id === e.target.value);
                      if (disc) setSelectedDiscipline(disc);
                    }}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    {currentCategoryGendersDisciplines.filter(d => d.type.startsWith('track')).map(d => (
                      <option key={d.id} value={d.id}>{d.nameAr}</option>
                    ))}
                  </select>

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as any)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="U12">براعم (U12)</option>
                    <option value="U15">صغار (U15)</option>
                    <option value="U18">فتيان (U18)</option>
                    <option value="U20">شبان (U20)</option>
                  </select>

                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value as any)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white cursor-pointer"
                  >
                    <option value="Male">ذكور</option>
                    <option value="Female">إناث</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setIsAttendanceModalOpen(true)}
                    className="p-2 sm:px-3 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
                    title="غرفة المناداة وتأكيد حضور العدائين وتوزيع الممرات"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">غرفة المناداة</span>
                    <span className="px-1.5 py-0.5 bg-indigo-800 rounded-md text-[10px] font-mono font-bold">
                      {attendanceStats.present}/{attendanceStats.total}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCurrentRaceData}
                    className="p-2 sm:px-3 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title="تفريغ بيانات هذا السباق ومسح مراتب الوصول والميقاتي للبدء من جديد"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">تفريغ السباق</span>
                  </button>

                  {!isTeacher && activeDiscipline && (
                    <button
                      type="button"
                      onClick={() => {
                        handleStartEditDiscipline(activeDiscipline);
                        setIsSettingsModalOpen(true);
                        setSettingsActiveTab('disciplines');
                      }}
                      className="p-2 sm:px-3 sm:py-2 bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-700 dark:text-amber-300 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="تعديل بيانات هذا السباق"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">تعديل السباق</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 🏁 MULTI-SERIES / HEATS SELECTOR (سباقات المجموعات والسلاسل لنفس الفئة) 🏁 */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 space-y-2 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-2 bg-amber-500/10 border border-amber-500/20 rounded-2xl">🏁</span>
                    <div>
                      <h4 className="text-sm font-black text-white flex items-center gap-2 flex-wrap">
                        <span>سباقات المجموعات / السلاسل لنفس الفئة ({selectedCategory} - {selectedGender === 'Male' ? 'ذكور' : 'إناث'})</span>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-sm">
                          ⚡ السلسلة الحالية النشطة: {activeSeriesNumber}
                        </span>
                      </h4>
                      <p className="hidden sm:block text-xs text-slate-400 mt-0.5 font-medium">
                        يمكنك إجراء سباقين أو 3 سباقات (سلاسل) لنفس الفئة. عند تصفير الميقاتي لا تُمسح النتائج، ويتم تحديد المراتب الأولى الموحدة بعد انتهاء جميع المتسابقين.
                      </p>
                    </div>
                  </div>
                  
                  {/* Series Tabs */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {availableSeriesList.map((sNum) => {
                      const countInSeries = recordedLaps.filter(l => (l.seriesNumber || 1) === sNum).length;
                      const isActive = activeSeriesNumber === sNum;
                      return (
                        <button
                          key={sNum}
                          type="button"
                          onClick={() => {
                            setActiveSeriesNumber(sNum);
                            if (!isTimerRunning) {
                              setElapsedMs(0);
                            }
                            toast(`تم تفعيل السلسلة ${sNum} (${countInSeries} وصول مسجل)`, { icon: '⚡' });
                          }}
                          className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            isActive
                              ? 'bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 text-white shadow-md ring-2 ring-amber-400/40 scale-102'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700'
                          }`}
                        >
                          <span>⚡ السلسلة {sNum}</span>
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${isActive ? 'bg-black/30 text-white' : 'bg-slate-900 text-slate-400'}`}>
                            {countInSeries} وصول
                          </span>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() => {
                        const nextNum = Math.max(...availableSeriesList, 0) + 1;
                        setCustomSeriesList(prev => [...prev, nextNum]);
                        setActiveSeriesNumber(nextNum);
                        if (!isTimerRunning) setElapsedMs(0);
                        toast.success(`تمت إضافة السلسلة ${nextNum}`);
                      }}
                      className="px-2.5 py-2 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer border border-dashed border-slate-700"
                      title="إضافة سلسلة أو مجموعة رابعة أو خامسة"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ سلسلة جديدة</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* --- BIG SMART STOPWATCH CONSOLE --- */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left (Stopwatch Screen & Main Trigger Button) */}
                <div className="lg:col-span-6 bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-emerald-900/60 rounded-3xl p-6 flex flex-col items-center justify-between shadow-2xl space-y-6">
                  
                  {/* Digital Clock Display */}
                  <div className="w-full text-center py-6 bg-slate-950/80 border border-slate-800 rounded-2xl shadow-inner relative overflow-hidden">
                    <div className="absolute top-2 left-2 flex items-center gap-1.5">
                       <button
                         onClick={() => setIsManualTrackEntry(!isManualTrackEntry)}
                         className={`px-2 py-1 rounded-lg text-[10px] font-black border transition-all ${
                           isManualTrackEntry
                             ? 'bg-amber-600 text-white border-amber-500'
                             : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                         }`}
                         title={isManualTrackEntry ? 'الوضع اليدوي نشط' : 'تفعيل الإدخال اليدوي'}
                       >
                         <span>{isManualTrackEntry ? '⌨️' : '⏱️'}</span>
                         <span className="hidden sm:inline">{isManualTrackEntry ? ' الوضع اليدوي' : ' إدخال يدوي'}</span>
                       </button>
                    </div>

                    <div className="flex items-center justify-center gap-2 mb-1">
                      <span className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-wider">
                        CHRONO SMART CHIPS • 1/100s
                      </span>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        سلسلة {activeSeriesNumber}
                      </span>
                    </div>

                    <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-white select-none">
                      {AthleticsService.formatMilliseconds(elapsedMs)}
                    </div>
                    {isTimerRunning && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 mt-2 bg-emerald-950/80 px-3 py-0.5 rounded-full border border-emerald-700 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>سباق السلسلة {activeSeriesNumber} جاري والتوقيت نشط</span>
                      </div>
                    )}
                  </div>

                  {/* Stopwatch Base Controls (Start / Stop / Reset) */}
                  <div className="flex items-center gap-3 w-full">
                    {!isTimerRunning ? (
                      <button
                        onClick={handleStartStopwatch}
                        className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer transition-all"
                        title={elapsedMs === 0 ? 'إطلاق الميقاتي (Départ)' : 'استئناف التوقيت'}
                      >
                        <Play className="w-5 h-5 fill-white" />
                        <span className="hidden sm:inline">{elapsedMs === 0 ? `إطلاق ميقاتي السلسلة ${activeSeriesNumber} (Départ)` : 'استئناف التوقيت'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStopStopwatch}
                        className="flex-1 py-3.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
                        title="إيقاف الميقاتي"
                      >
                        <Square className="w-5 h-5 fill-white" />
                        <span className="hidden sm:inline">إيقاف الميقاتي</span>
                      </button>
                    )}

                    <button
                      onClick={handleResetStopwatch}
                      disabled={isTimerRunning && elapsedMs > 0}
                      className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="إعادة ضبط الصفر (تصفير الميقاتي مع الحفاظ التام على النتائج)"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span className="hidden sm:inline">تصفير الميقاتي</span>
                    </button>
                  </div>

                  {/* ⭐ THE REQUESTED SMART ONE-TAP MULTI-RANK BUTTON FOR ACTIVE SERIES ⭐ */}
                  <div className="w-full pt-2">
                    {(() => {
                      const lapsInThisSeries = recordedLaps.filter(l => (l.seriesNumber || 1) === activeSeriesNumber);
                      const nextRankInThisSeries = lapsInThisSeries.length + 1;
                      return (
                        <button
                          onClick={handleTriggerRankSplit}
                          disabled={!isTimerRunning && elapsedMs === 0}
                          className="w-full py-6 px-4 bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 hover:from-amber-400 hover:to-rose-500 active:scale-97 disabled:opacity-50 text-white rounded-3xl font-black text-lg sm:text-xl flex flex-col items-center justify-center gap-1 shadow-2xl shadow-orange-600/30 transition-all cursor-pointer ring-4 ring-orange-500/20"
                        >
                          <div className="flex items-center gap-2">
                            <Flag className="w-6 h-6 animate-bounce" />
                            <span>
                              {nextRankInThisSeries === 1
                                ? `🥇 تسجيل المرتبة الأولى (السلسلة ${activeSeriesNumber})`
                                : nextRankInThisSeries === 2
                                ? `🥈 تسجيل المرتبة الثانية (السلسلة ${activeSeriesNumber})`
                                : nextRankInThisSeries === 3
                                ? `🥉 تسجيل المرتبة الثالثة (السلسلة ${activeSeriesNumber})`
                                : `تسجيل المرتبة (${nextRankInThisSeries}) - السلسلة ${activeSeriesNumber}`}
                            </span>
                          </div>
                          <span className="text-xs text-orange-100 font-medium">
                            اضغط عند وصول العداء لخط النهاية لحفظ توقيته آلياً (يتم اختيار التلميذ يدوياً)
                          </span>
                        </button>
                      );
                    })()}
                  </div>

                  {/* Summary info & series notice */}
                  <div className="w-full space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-bold">
                      <span>
                        السلسلة {activeSeriesNumber}: <span className="text-amber-400 font-black">{recordedLaps.filter(l => (l.seriesNumber || 1) === activeSeriesNumber).length}</span> وصول • إجمالي السلاسل: <span className="text-emerald-400 font-black">{recordedLaps.length}</span>
                      </span>
                      {isManualTrackEntry && (
                         <button
                           onClick={() => {
                             const lapsInThisSeries = recordedLaps.filter(l => (l.seriesNumber || 1) === activeSeriesNumber);
                             const newLap: TrackRankEntry = {
                               rank: lapsInThisSeries.length + 1,
                               timeMs: 0,
                               formattedTime: '00:00.00',
                               participantId: '',
                               bibNumber: '',
                               studentName: '',
                               schoolName: '',
                               confirmed: false,
                               seriesNumber: activeSeriesNumber
                             };
                             setRecordedLaps(prev => [...prev, newLap]);
                           }}
                           className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black shadow-sm"
                         >
                           + إضافة مرتبة يدوياً
                         </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right (Recorded Ranks, Series Filter & Manual Participant Selection) */}
                <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                  
                  <div>
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h4 className="text-sm font-black text-white">المراتب المسجلة وتعيين التلاميذ</h4>
                        <button
                          onClick={() => setIsAddParticipantOpen(true)}
                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-400 rounded-lg transition-colors mr-1"
                          title="إضافة مشارك جديد لهذا السباق"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {/* Filter Switcher: Unified Overall vs By Series */}
                      <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setSeriesViewFilter('ALL')}
                          className={`px-2 py-1 rounded-lg transition-all ${
                            seriesViewFilter === 'ALL'
                              ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          🏆 الترتيب العام الموحد ({recordedLaps.length})
                        </button>
                        {availableSeriesList.map(sNum => {
                          const countInSeries = recordedLaps.filter(l => (l.seriesNumber || 1) === sNum).length;
                          return (
                            <div key={sNum} className="inline-flex items-center gap-0.5 bg-slate-800 rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setSeriesViewFilter(sNum)}
                                className={`px-2 py-1 transition-all ${
                                  seriesViewFilter === sNum
                                    ? 'bg-indigo-600 text-white font-black shadow-sm'
                                    : 'text-slate-400 hover:text-white'
                                }`}
                              >
                                س {sNum} ({countInSeries})
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  if (availableSeriesList.length <= 1) {
                                    toast.error('لا يمكن حذف السلسلة الوحيدة المتبقية!');
                                    return;
                                  }
                                  if (window.confirm(`هل أنت متأكد من حذف السلسلة ${sNum} بالكامل مع كافة وصولاتها وتوقيتاتها؟`)) {
                                    setRecordedLaps(prev => prev.filter(l => (l.seriesNumber || 1) !== sNum));
                                    setCustomSeriesList(prev => prev.filter(s => s !== sNum));
                                    if (seriesViewFilter === sNum) {
                                      setSeriesViewFilter('ALL');
                                    }
                                    if (activeSeriesNumber === sNum) {
                                      const remaining = availableSeriesList.filter(s => s !== sNum);
                                      setActiveSeriesNumber(remaining[0] || 1);
                                    }
                                    toast.success(`تم حذف السلسلة ${sNum} بنجاح`);
                                  }
                                }}
                                className="px-2 py-1 text-rose-400 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer text-xs font-black z-10"
                                title={`حذف السلسلة ${sNum}`}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Action Bar: Assign pupils by finish order at end of test */}
                    {recordedLaps.length > 0 && (
                      <div className="mb-2.5 flex items-center justify-between gap-2 p-2.5 bg-slate-900 border border-amber-500/30 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <span className="text-base p-1.5 bg-amber-500/10 text-amber-400 rounded-xl">🎯</span>
                          <div>
                            <span className="text-xs font-black text-amber-300 block">
                              عند انتهاء الاختبار: تحديد التلاميذ حسب الترتيب
                            </span>
                            <span className="text-[10px] text-slate-400 font-medium">
                              اختيار يدوي إلزامي • تم تحديد {recordedLaps.filter(l => l.participantId).length} من {recordedLaps.length} وصول
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsAssignByOrderModalOpen(true)}
                          className="px-3 py-1.5 bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
                          title="فتح نافذة اختيار وتعيين التلاميذ حسب ترتيب الوصول"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>تعيين بالترتيب</span>
                        </button>
                      </div>
                    )}

                    {/* Laps List */}
                    {recordedLaps.length === 0 ? (
                      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-2.5">
                        <Timer className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-xs font-bold text-slate-400">لم يتم تسجيل أي توقيت بعد</p>
                        <p className="text-[11px] text-slate-500">
                          أطلق الميقاتي واضغط على الزر البرتقالي الموحد عند وصول كل عداء في السلسلة {activeSeriesNumber}
                        </p>
                        {currentEventParticipants.length === 0 && activeDiscipline && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={handleSeedCurrentEvent}
                              className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-black transition-all inline-flex items-center gap-1.5 cursor-pointer active:scale-95"
                              title="دمج 10 متسابقين فوراً لهذا السباق للتجريب"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                              <span>دمج 10 متسابقين لهذا السباق الآن للتجريب</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ) : lapsToDisplay.length === 0 ? (
                      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-6 text-center space-y-2">
                        <p className="text-xs font-bold text-slate-400">لا توجد وصولات مسجلة في السلسلة {seriesViewFilter} بعد</p>
                        <p className="text-[11px] text-slate-500">
                          اختر السلسلة {seriesViewFilter} أعلاه وأطلق الميقاتي لتسجيل وصولاتها
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {lapsToDisplay.map((lap) => {
                          const origIdx = lap.origIdx;
                          const displayRank = seriesViewFilter === 'ALL' ? lap.overallRank : lap.rank;
                          return (
                            <div
                              key={origIdx}
                              className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                displayRank === 1
                                  ? 'bg-amber-950/40 border-amber-800/80 ring-1 ring-amber-500/30'
                                  : displayRank === 2
                                  ? 'bg-slate-850 border-slate-700'
                                  : displayRank === 3
                                  ? 'bg-orange-950/30 border-orange-900/60'
                                  : 'bg-slate-900 border-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <span className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                                  displayRank === 1
                                    ? 'bg-amber-500 text-slate-950 shadow-md'
                                    : displayRank === 2
                                    ? 'bg-slate-300 text-slate-900 shadow-md'
                                    : displayRank === 3
                                    ? 'bg-orange-600 text-white shadow-md'
                                    : 'bg-slate-800 text-slate-300'
                                }`}>
                                  {displayRank === 1 ? '🥇 1' : displayRank === 2 ? '🥈 2' : displayRank === 3 ? '🥉 3' : `#${displayRank}`}
                                </span>

                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    {isManualTrackEntry ? (
                                      <input
                                        type="text"
                                        value={lap.formattedTime}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setRecordedLaps(prev => {
                                            const copy = [...prev];
                                            copy[origIdx] = { ...copy[origIdx], formattedTime: val };
                                            return copy;
                                          });
                                        }}
                                        placeholder="00:00.00"
                                        className="text-sm font-black font-mono bg-slate-900 border border-slate-700 text-emerald-400 rounded-lg px-2 py-1 w-24 outline-none focus:ring-1 focus:ring-indigo-500"
                                      />
                                    ) : (
                                      <span className="text-sm font-black font-mono text-emerald-400 block">
                                        {lap.formattedTime}
                                      </span>
                                    )}

                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700">
                                      ⚡ س {lap.seriesNumber || 1}
                                    </span>

                                    <button
                                      onClick={() => {
                                        setRecordedLaps(prev => prev.filter((_, i) => i !== origIdx));
                                      }}
                                      className="p-1 text-slate-500 hover:text-red-500 transition-colors"
                                      title="حذف هذه المرتبة"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {lap.studentName ? (
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-xs font-bold text-white block">
                                        ✅ {lap.studentName} ({lap.schoolName})
                                      </span>
                                      <span className="text-[10px] text-slate-400 font-mono font-bold">
                                        #{lap.bibNumber}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-amber-400 font-bold block mt-0.5 animate-pulse">
                                      ⚠️ يرجى اختيار التلميذ(ة) يدوياً من القائمة ⬅️
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Manual Participant Selector Dropdown (اختيار يدوي إلزامي بدون تعيين تلقائي) */}
                              <div className="w-full sm:w-auto shrink-0">
                                <select
                                  value={lap.participantId || ''}
                                  onChange={(e) => handleAssignParticipantToLap(origIdx, e.target.value)}
                                  className={`w-full sm:w-52 px-2.5 py-1.5 rounded-xl text-xs font-bold outline-none cursor-pointer transition-all ${
                                    lap.participantId
                                      ? 'bg-slate-900 border border-emerald-700/80 text-emerald-300 focus:ring-1 focus:ring-emerald-500'
                                      : 'bg-slate-900 border border-amber-600 text-amber-300 focus:ring-2 focus:ring-amber-500 ring-1 ring-amber-500/30'
                                  }`}
                                >
                                  <option value="">-- اضغط لاختيار التلميذ(ة) يدوياً --</option>
                                  {sortedParticipantsForAssignment.map(p => {
                                    const att = attendanceMap[p.id];
                                    const isPresent = att?.status === 'present';
                                    const isAbsent = att?.status === 'absent';
                                    const mark = isPresent ? '✅ ' : isAbsent ? '❌ [غائب] ' : '⏳ ';
                                    const lane = att?.lane ? ` [ممر ${att.lane}]` : '';
                                    
                                    // Check if this participant is assigned in another lap
                                    const otherLap = recordedLaps.find((l, lIdx) => lIdx !== origIdx && l.participantId === p.id);
                                    const assignedNote = otherLap ? ` (تم اختياره بالسلسلة ${otherLap.seriesNumber || 1})` : '';

                                    return (
                                      <option key={p.id} value={p.id}>
                                        {mark}#{p.bibNumber} - {p.studentName} ({p.schoolName}){lane}{assignedNote}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Save Final Race Button */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <button
                        onClick={() => setIsAddParticipantOpen(true)}
                        className="p-2 sm:px-3.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        title="إضافة عداء"
                      >
                        <Plus className="w-4 h-4 text-blue-400" />
                        <span className="hidden sm:inline">إضافة عداء</span>
                      </button>

                      <button
                        onClick={() => setIsAttendanceModalOpen(true)}
                        className="p-2 sm:px-3.5 sm:py-2 bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        title="مناداة العدائين وتأكيد الحضور وتوزيع الممرات"
                      >
                        <ClipboardList className="w-4 h-4 text-indigo-400" />
                        <span className="hidden sm:inline">غرفة المناداة</span>
                        <span className="font-mono text-[10px] font-bold">({attendanceStats.present}/{attendanceStats.total})</span>
                      </button>

                      <button
                        onClick={handleClearCurrentRaceData}
                        className="p-2 sm:px-3.5 sm:py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                        title="تفريغ ومسح بيانات هذا السباق وإعادة ضبط الميقاتي"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                        <span className="hidden sm:inline">تفريغ السباق</span>
                      </button>
                    </div>

                    <button
                      onClick={handleSaveTrackResults}
                      disabled={recordedLaps.length === 0}
                      className="p-2 sm:px-5 sm:py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                      title="حفظ واعتماد نتائج السباق"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="hidden sm:inline">حفظ واعتماد نتائج السباق</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 4: FIELD EVENTS */}
          {/* ======================================================================= */}
          {activeTab === 'field' && activeDiscipline && (
            <div className="space-y-6">
              <div className="hidden sm:flex bg-slate-950 p-4 rounded-3xl border border-slate-800 flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-3 bg-indigo-950/60 border border-indigo-800 rounded-2xl text-indigo-400">
                    {activeDiscipline.icon}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-black text-white">{activeDiscipline.nameAr}</h3>
                      <span className="px-2.5 py-0.5 text-xs font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-lg">
                        {selectedCategory}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-black bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-lg">
                        {selectedGender === 'Male' ? 'ذكور' : 'إناث'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      اللجنة: <span className="text-amber-400 font-bold">{currentCommitteeDef?.titleAr}</span> • المسؤول: <span className="text-white font-bold">{currentCommitteeAssignment?.teacherName || 'غير معين'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  {currentCategoryGendersDisciplines.filter(d => d.type.startsWith('field')).map(disc => (
                    <button
                      key={disc.id}
                      onClick={() => setSelectedDiscipline(disc)}
                      className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        activeDiscipline?.id === disc.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                      title={disc.nameAr}
                    >
                      <span>{disc.icon}</span>
                      <span className="hidden sm:inline">{disc.nameAr}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => setIsAttendanceModalOpen(true)}
                    className="p-2 sm:px-3 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/20 active:scale-95"
                    title="غرفة المناداة وتأكيد حضور المتسابقين"
                  >
                    <ClipboardList className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">غرفة المناداة</span>
                    <span className="px-1.5 py-0.5 bg-indigo-800 rounded-md text-[10px] font-mono font-bold">
                      {attendanceStats.present}/{attendanceStats.total}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClearCurrentRaceData}
                    className="p-2 sm:px-3 sm:py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-800 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                    title="تفريغ ومسح بيانات ومحاولات هذه المسابقة للبدء من جديد"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-rose-500" />
                    <span className="hidden sm:inline">تفريغ المسابقة</span>
                  </button>

                  {!isTeacher && activeDiscipline && (
                    <button
                      type="button"
                      onClick={() => {
                        handleStartEditDiscipline(activeDiscipline);
                        setIsSettingsModalOpen(true);
                        setSettingsActiveTab('disciplines');
                      }}
                      className="p-2 sm:px-3 sm:py-2 bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-300 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="تعديل بيانات هذه المسابقة"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">تعديل المسابقة</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Field Attempts Matrix */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <span>جدول المحاولات والنتائج (3 محاولات قانونية)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {fieldTrials.length} متسابق(ة)
                      </span>
                    </h4>
                    <p className="mobile-hide-desc text-xs text-slate-400 font-medium mt-0.5">
                      يتم اختيار التلاميذ يدوياً للاختبار. أدخل المسافة بالمتر (مثال: 4.85) أو حرف X للمحاولة الملغاة.
                    </p>
                  </div>

                  {/* Top Actions: Add Manual Row, Quick Select */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      onChange={(e) => {
                        if (e.target.value) {
                          handleAddFieldTrial(e.target.value);
                          e.target.value = '';
                        }
                      }}
                      defaultValue=""
                      className="px-2.5 py-1.5 bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 rounded-xl text-xs font-bold cursor-pointer outline-none"
                    >
                      <option value="" disabled>+ اختيار تلميذ لبدء المحاولات</option>
                      {currentEventParticipants.map(p => (
                        <option key={p.id} value={p.id}>
                          #{p.bibNumber} - {p.studentName} ({p.schoolName})
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleAddFieldTrial()}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      title="إضافة خانة جديدة للاختبار"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-400" />
                      <span>إضافة خانة</span>
                    </button>
                  </div>
                </div>

                {fieldTrials.length === 0 ? (
                  <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-3">
                    <p className="text-xs font-bold text-slate-300">لم يتم إدراج تلاميذ في هذا الاختبار بعد</p>
                    <p className="mobile-hide-desc text-[11px] text-slate-500 max-w-md mx-auto">
                      اختر التلاميذ يدوياً واحداً تلو الآخر لبدء تسجيل المحاولات، أو انقر على "إضافة خانة".
                    </p>
                    <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                      <button
                        onClick={() => handleAddFieldTrial()}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        <span>إضافة تلميذ للاختبار يدوياً</span>
                      </button>

                      {currentEventParticipants.length === 0 && activeDiscipline && (
                        <button
                          type="button"
                          onClick={handleSeedCurrentEvent}
                          className="px-4 py-2 bg-purple-600/30 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                          title="دمج 10 متسابقين فوراً لهذه المسابقة للتجريب"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>دمج 10 متسابقين لهذه المسابقة الآن للتجريب</span>
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 font-black border-b border-slate-800">
                          <th className="py-3 px-3 text-center">الرتبة</th>
                          <th className="py-3 px-3">الصدرية</th>
                          <th className="py-3 px-3">اسم التلميذ(ة) والمؤسسة (اختيار يدوي)</th>
                          <th className="py-3 px-3 text-center">المحاولة 1 (م)</th>
                          <th className="py-3 px-3 text-center">المحاولة 2 (م)</th>
                          <th className="py-3 px-3 text-center">المحاولة 3 (م)</th>
                          <th className="py-3 px-3 text-center text-amber-400">أفضل إنجاز (م)</th>
                          <th className="py-3 px-2 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {fieldTrials.map((entry, eIdx) => (
                          <tr key={eIdx} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-3 text-center font-black">
                              {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : (entry.rank ? `#${entry.rank}` : '-')}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-300">
                              {entry.bibNumber ? `#${entry.bibNumber}` : '-'}
                            </td>
                            <td className="py-3 px-3">
                              {entry.studentName ? (
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white">✅ {entry.studentName}</span>
                                    <span className="text-[11px] text-slate-400">({entry.schoolName})</span>
                                  </div>
                                  <select
                                    value={entry.participantId}
                                    onChange={(e) => handleAssignParticipantToFieldTrial(eIdx, e.target.value)}
                                    className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-300 cursor-pointer"
                                  >
                                    <option value={entry.participantId}>تغيير التلميذ...</option>
                                    {currentEventParticipants.map(p => (
                                      <option key={p.id} value={p.id}>
                                        #{p.bibNumber} - {p.studentName} ({p.schoolName})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div className="space-y-1">
                                  <span className="text-[11px] text-amber-400 font-bold block animate-pulse">
                                    ⚠️ يرجى اختيار التلميذ(ة) يدوياً:
                                  </span>
                                  <select
                                    value=""
                                    onChange={(e) => handleAssignParticipantToFieldTrial(eIdx, e.target.value)}
                                    className="w-full sm:w-60 px-2.5 py-1.5 bg-slate-900 border border-amber-600 rounded-xl text-xs font-bold text-amber-300 outline-none cursor-pointer ring-1 ring-amber-500/30"
                                  >
                                    <option value="">-- اضغط لاختيار التلميذ(ة) يدوياً --</option>
                                    {currentEventParticipants.map(p => (
                                      <option key={p.id} value={p.id}>
                                        #{p.bibNumber} - {p.studentName} ({p.schoolName})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </td>
                            {[0, 1, 2].map((attIdx) => (
                              <td key={attIdx} className="py-3 px-3 text-center">
                                <input
                                  type="text"
                                  value={entry.attempts[attIdx] === 'X' ? 'X' : entry.attempts[attIdx] ?? ''}
                                  onChange={(e) => handleUpdateAttempt(eIdx, attIdx, e.target.value)}
                                  placeholder="0.00"
                                  className="w-16 text-center py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:ring-1 focus:ring-indigo-500"
                                />
                              </td>
                            ))}
                            <td className="py-3 px-3 text-center font-mono font-black text-sm text-amber-400 bg-amber-950/20">
                              {entry.bestAttempt !== null ? `${entry.bestAttempt.toFixed(2)} م` : '-'}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveFieldTrial(eIdx)}
                                className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                                title="حذف هذا الصف"
                              >
                                <Trash2 className="w-3.5 h-3.5 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <button
                      onClick={() => setIsAddParticipantOpen(true)}
                      className="p-2 sm:px-3.5 sm:py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      title="إضافة متسابق"
                    >
                      <Plus className="w-3.5 h-3.5 text-indigo-400" />
                      <span className="hidden sm:inline">إضافة متسابق</span>
                    </button>

                    <button
                      onClick={() => setIsAttendanceModalOpen(true)}
                      className="p-2 sm:px-3.5 sm:py-2 bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700 text-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      title="مناداة المتسابقين وتأكيد الحضور"
                    >
                      <ClipboardList className="w-4 h-4 text-indigo-400" />
                      <span className="hidden sm:inline">غرفة المناداة</span>
                      <span className="font-mono text-[10px] font-bold">({attendanceStats.present}/{attendanceStats.total})</span>
                    </button>

                    <button
                      onClick={handleClearCurrentRaceData}
                      className="p-2 sm:px-3.5 sm:py-2 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800 text-rose-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
                      title="تفريغ ومسح بيانات هذه المسابقة"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
                      <span className="hidden sm:inline">تفريغ المسابقة</span>
                    </button>
                  </div>

                  <button
                    onClick={handleSaveFieldResults}
                    disabled={fieldTrials.length === 0}
                    className="p-2 sm:px-6 sm:py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                    title={`حفظ واعتماد نتائج ${activeDiscipline.nameAr}`}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="hidden sm:inline">حفظ واعتماد نتائج {activeDiscipline.nameAr}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 5: PODIUM, RESULTS & OFFICIAL SCORESHEET */}
          {/* ======================================================================= */}
          {activeTab === 'podium' && activeDiscipline && (
            <div className="space-y-6">
              
              {/* Event Results Quick Filter Bar */}
              <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                   <h4 className="text-xs font-black text-slate-300 flex items-center gap-2">
                     <Filter className="w-3.5 h-3.5 text-indigo-400" />
                     <span>تصفية واختيار نتائج المسابقات المعتمدة:</span>
                   </h4>
                   <div className="flex items-center gap-2">
                     <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[9px] font-black">
                       {resultsList.filter(r => r.status === 'completed').length} نتائج معتمدة
                     </span>
                     <button
                       type="button"
                       onClick={() => handleOpenClearRaceModal(selectedDiscipline?.id, selectedCategory, selectedGender)}
                       className="p-1.5 sm:px-2.5 sm:py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-800 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                       title="تفريغ ومسح بيانات سباق من النتائج"
                     >
                       <RotateCcw className="w-3 h-3 text-rose-400" />
                       <span className="hidden sm:inline">تفريغ سباق</span>
                     </button>
                   </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  {/* Discipline Select */}
                  <div className="sm:col-span-5 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 pr-1 flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      <span>نوع المسابقة:</span>
                    </label>
                    <select
                      value={selectedDiscipline?.id}
                      onChange={(e) => {
                        const d = disciplines.find(item => item.id === e.target.value);
                        if (d) setSelectedDiscipline(d);
                      }}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white focus:ring-1 focus:ring-indigo-500 outline-none cursor-pointer"
                    >
                      {disciplines.map(d => {
                        // Check if this specific discipline has ANY results in ANY category/gender
                        const hasAnyResults = resultsList.some(r => r.disciplineId === d.id && r.status === 'completed');
                        return (
                          <option key={d.id} value={d.id}>
                            {d.icon} {d.nameAr} {hasAnyResults ? '✓' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Category Select */}
                  <div className="sm:col-span-4 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 pr-1 flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      <span>الفئة العمرية:</span>
                    </label>
                    <div className="flex items-center gap-1">
                      {['U12', 'U15', 'U18', 'U20'].map(cat => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat as any)}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${
                            selectedCategory === cat 
                              ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-400/30' 
                              : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Gender Select */}
                  <div className="sm:col-span-3 space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 pr-1 flex items-center gap-1">
                      <UserIcon className="w-3 h-3" />
                      <span>الجنس:</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setSelectedGender('Male')}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
                          selectedGender === 'Male' 
                            ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400/30' 
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        ذكور
                      </button>
                      <button
                        onClick={() => setSelectedGender('Female')}
                        className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all flex items-center justify-center gap-1 ${
                          selectedGender === 'Female' 
                            ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400/30' 
                            : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        إناث
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Podium View Card */}
              <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 text-center space-y-6 shadow-xl dark:shadow-none transition-colors">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center justify-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-500 dark:text-amber-400" />
                    <span>منصة التتويج والنتائج المعتمدة (Podium)</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {activeDiscipline.nameAr} • {selectedCategory} • {selectedGender === 'Male' ? 'ذكور' : 'إناث'}
                  </p>
                </div>

                {/* 3 Step Podium */}
                {currentEventResult ? (
                  <div className="space-y-8">
                    <div className="pt-8 pb-4 flex items-end justify-center gap-3 sm:gap-6 max-w-2xl mx-auto">
                      
                      {/* 2nd Place */}
                      <div className="flex-1 flex flex-col items-center">
                        <div className="text-2xl mb-1">🥈</div>
                        <span className="text-xs font-black text-slate-700 dark:text-slate-300">
                          {currentEventResult.type === 'track'
                            ? currentEventResult.trackLaps?.[1]?.studentName || 'لا يوجد'
                            : currentEventResult.fieldEntries?.[1]?.studentName || 'لا يوجد'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">
                          {currentEventResult.type === 'track'
                            ? currentEventResult.trackLaps?.[1]?.schoolName
                            : currentEventResult.fieldEntries?.[1]?.schoolName}
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1">
                          {currentEventResult.type === 'track'
                            ? (
                              <>
                                <span>{currentEventResult.trackLaps?.[1]?.formattedTime}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 dark:bg-slate-700 font-sans">
                                  س {currentEventResult.trackLaps?.[1]?.seriesNumber || 1}
                                </span>
                              </>
                            )
                            : currentEventResult.fieldEntries?.[1]?.bestAttempt ? `${currentEventResult.fieldEntries[1].bestAttempt}م` : ''}
                        </span>
                        <div className="w-full h-24 bg-gradient-to-t from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-700 rounded-t-2xl border-t-2 border-slate-300 dark:border-slate-400 flex items-center justify-center text-slate-500 dark:text-slate-200 font-black text-lg mt-2 shadow-sm">
                          2
                        </div>
                      </div>

                      {/* 1st Place (Champion) */}
                      <div className="flex-1 flex flex-col items-center -translate-y-4">
                        <div className="text-4xl mb-1 animate-bounce">👑</div>
                        <span className="text-sm font-black text-amber-600 dark:text-amber-300">
                          {currentEventResult.type === 'track'
                            ? currentEventResult.trackLaps?.[0]?.studentName || 'لا يوجد'
                            : currentEventResult.fieldEntries?.[0]?.studentName || 'لا يوجد'}
                        </span>
                        <span className="text-xs text-amber-700/80 dark:text-amber-500/80 font-bold truncate max-w-[140px]">
                          {currentEventResult.type === 'track'
                            ? currentEventResult.trackLaps?.[0]?.schoolName
                            : currentEventResult.fieldEntries?.[0]?.schoolName}
                        </span>
                        <span className="text-sm font-mono font-black text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1.5">
                          {currentEventResult.type === 'track'
                            ? (
                              <>
                                <span>{currentEventResult.trackLaps?.[0]?.formattedTime}</span>
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-500/20 text-amber-300 font-sans border border-amber-500/30">
                                  س {currentEventResult.trackLaps?.[0]?.seriesNumber || 1}
                                </span>
                              </>
                            )
                            : currentEventResult.fieldEntries?.[0]?.bestAttempt ? `${currentEventResult.fieldEntries[0].bestAttempt}م` : ''}
                        </span>
                        <div className="w-full h-32 bg-gradient-to-t from-amber-500 to-amber-400 dark:from-amber-600 dark:to-amber-500 rounded-t-2xl border-t-2 border-amber-200 dark:border-amber-300 flex items-center justify-center text-white dark:text-slate-950 font-black text-2xl mt-2 shadow-lg shadow-amber-500/30">
                          1 🥇
                        </div>
                      </div>

                      {/* 3rd Place */}
                      <div className="flex-1 flex flex-col items-center">
                        <div className="text-2xl mb-1">🥉</div>
                        <span className="text-xs font-black text-orange-600 dark:text-orange-300">
                          {currentEventResult.type === 'track'
                            ? currentEventResult.trackLaps?.[2]?.studentName || 'لا يوجد'
                            : currentEventResult.fieldEntries?.[2]?.studentName || 'لا يوجد'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">
                          {currentEventResult.type === 'track'
                            ? currentEventResult.trackLaps?.[2]?.schoolName
                            : currentEventResult.fieldEntries?.[2]?.schoolName}
                        </span>
                        <span className="text-xs font-mono font-bold text-orange-600 dark:text-orange-400 mt-1 flex items-center gap-1">
                          {currentEventResult.type === 'track'
                            ? (
                              <>
                                <span>{currentEventResult.trackLaps?.[2]?.formattedTime}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-200 dark:bg-slate-700 font-sans">
                                  س {currentEventResult.trackLaps?.[2]?.seriesNumber || 1}
                                </span>
                              </>
                            )
                            : currentEventResult.fieldEntries?.[2]?.bestAttempt ? `${currentEventResult.fieldEntries[2].bestAttempt}م` : ''}
                        </span>
                        <div className="w-full h-18 bg-gradient-to-t from-orange-200 to-orange-100 dark:from-orange-800 dark:to-orange-700 rounded-t-2xl border-t-2 border-orange-300 dark:border-orange-400 flex items-center justify-center text-orange-600 dark:text-orange-100 font-black text-base mt-2 shadow-sm">
                          3
                        </div>
                      </div>
                    </div>

                    {/* Full Results List Table */}
                    <div className="mt-8 space-y-4">
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                        <h4 className="text-sm font-black text-slate-800 dark:text-white flex items-center gap-2">
                          <Award className="w-4 h-4 text-indigo-500" />
                          <span>نتائج الترتيب الكامل للمتسابقين:</span>
                        </h4>
                        {userAccess.canManage && (
                          <div className="flex items-center gap-1.5 sm:gap-2">
                            <button
                              onClick={() => handleEditEventResult(currentEventResult)}
                              className="p-1.5 sm:px-3 sm:py-1 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                              title="تعديل النتائج"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span className="hidden sm:inline">تعديل النتائج</span>
                            </button>
                            <button
                              onClick={() => handleDeleteEventResult(currentEventResult.id)}
                              className="p-1.5 sm:px-3 sm:py-1 bg-red-500 hover:bg-red-600 text-white rounded-lg text-[10px] font-black flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                              title="حذف النتائج"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span className="hidden sm:inline">حذف النتائج</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-right text-xs">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 font-black border-b border-slate-200 dark:border-slate-800">
                              <th className="py-2.5 px-3 text-center w-16">الرتبة</th>
                              {currentEventResult.type === 'track' && (
                                <th className="py-2.5 px-2 text-center w-20">السلسلة</th>
                              )}
                              <th className="py-2.5 px-3 w-20">الصدرية</th>
                              <th className="py-2.5 px-3">الاسم والنسب</th>
                              <th className="py-2.5 px-3">المؤسسة التعليمية</th>
                              <th className="py-2.5 px-3 text-center">{currentEventResult.type === 'track' ? 'التوقيت المعتمد' : 'الإنجاز'}</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                            {(currentEventResult.type === 'track' 
                              ? currentEventResult.trackLaps || [] 
                              : currentEventResult.fieldEntries || []
                            ).map((entry, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                                <td className="py-2.5 px-3 text-center">
                                  <span className={`w-6 h-6 rounded-lg font-black text-[10px] flex items-center justify-center mx-auto ${
                                    idx === 0 ? 'bg-amber-500 text-white' :
                                    idx === 1 ? 'bg-slate-300 text-slate-800' :
                                    idx === 2 ? 'bg-orange-400 text-white' :
                                    'bg-slate-100 dark:bg-slate-800 text-slate-500'
                                  }`}>
                                    {idx + 1}
                                  </span>
                                </td>
                                {currentEventResult.type === 'track' && (
                                  <td className="py-2.5 px-2 text-center">
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                      س {(entry as TrackRankEntry).seriesNumber || 1}
                                    </span>
                                  </td>
                                )}
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-600 dark:text-slate-400">#{entry.bibNumber}</td>
                                <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{entry.studentName}</td>
                                <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{entry.schoolName}</td>
                                <td className="py-2.5 px-3 text-center font-mono font-black text-indigo-600 dark:text-indigo-400">
                                  {currentEventResult.type === 'track' 
                                    ? (entry as TrackRankEntry).formattedTime 
                                    : `${(entry as FieldAttemptEntry).bestAttempt?.toFixed(2)} م`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-3xl space-y-6 transition-colors">
                    <div className="space-y-2">
                      <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-3xl grayscale opacity-50 shadow-sm transition-all">🏆</div>
                      <h4 className="text-sm font-black text-slate-500 dark:text-slate-300">لم يتم اعتماد نتائج هذه المسابقة بعد</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        قم بفتح الميقاتي أو جدول المحاولات لهذه المسابقة وحفظ النتائج ليتم عرض منصة التتويج هنا.
                      </p>
                    </div>

                    {resultsList.filter(r => r.status === 'completed').length > 0 && (
                      <div className="space-y-3 pt-4 border-t border-slate-800/50">
                        <h5 className="text-[10px] font-black text-amber-500/80 flex items-center justify-center gap-1.5 uppercase tracking-wider">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>النتائج المتوفرة حالياً:</span>
                        </h5>
                        <div className="flex flex-wrap items-center justify-center gap-2">
                          {resultsList
                            .filter(r => r.status === 'completed')
                            .map(res => {
                              const d = disciplines.find(item => item.id === res.disciplineId);
                              return (
                                <button
                                  key={res.id}
                                  onClick={() => {
                                    if (d) setSelectedDiscipline(d);
                                    setSelectedCategory(res.category as any);
                                    setSelectedGender(res.gender as any);
                                  }}
                                  className="px-3 py-1.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-slate-300 border border-slate-700 rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1.5"
                                >
                                  <span>{d?.icon || '🏅'}</span>
                                  <span>{d?.nameAr || res.disciplineId}</span>
                                  <span className="opacity-60">•</span>
                                  <span>{res.category}</span>
                                  <span>{res.gender === 'Male' ? 'ذكر' : 'أنثى'}</span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800 flex items-center justify-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="p-2 sm:px-5 sm:py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer active:scale-95 shadow-sm"
                    title="طباعة المحضر الرسمي للبطولة"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline">طباعة المحضر الرسمي للبطولة</span>
                    <span className="inline sm:hidden text-[11px]">طباعة المحضر</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* ⭐ SETTINGS MODAL (نافذة الإعدادات الشاملة) ⭐ */}
        {/* ========================================================================= */}
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
              
              {/* Settings Header */}
              <div className="bg-slate-950 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                    <SettingsIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">إعدادات بطولة ألعاب القوى واللجان</h3>
                    <p className="text-xs text-slate-400">تخصيص اللجان، تعيين الأساتذة وتحديد مهامهم، وإضافة أو حذف المسابقات</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsSettingsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Settings Tabs */}
              <div className="bg-slate-900 px-6 py-2 border-b border-slate-800 flex items-center gap-2">
                {!isTeacher && (
                  <>
                    <button
                      onClick={() => setSettingsActiveTab('committees')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settingsActiveTab === 'committees'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      👥 إعدادات اللجان والمهام
                    </button>

                    <button
                      onClick={() => setSettingsActiveTab('disciplines')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        settingsActiveTab === 'disciplines'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ⚡ إعدادات المسابقات (إضافة / حذف)
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSettingsActiveTab('auto_import')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    settingsActiveTab === 'auto_import'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🛠️ البيانات والأدوات المساعدة
                </button>
              </div>

              {/* Settings Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* TAB A: COMMITTEES & TEACHER TASKS */}
                {settingsActiveTab === 'committees' && (
                  <div className="space-y-6">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-4">
                      <div>
                        <h4 className="text-sm font-black text-white mb-1">
                          اختيار الأساتذة وتحديد مهامهم من قاعدة بيانات المنظومة
                        </h4>
                        <p className="text-xs text-slate-400">
                          اختر أي لجنة لتعديل طاقمها، وتعيين أساتذة التربية البدنية المسجلين وتحديد مهمة كل أستاذ بدقة.
                        </p>
                      </div>

                      {/* Display Role Switcher inside Committees Settings */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-2 text-amber-400">
                          <ShieldCheck className="w-4 h-4" />
                          <span className="text-xs font-bold">تغيير وضع المعاينة (صلاحية العرض):</span>
                        </div>
                        <select
                          value={activeRoleMode}
                          onChange={(e) => setActiveRoleMode(e.target.value)}
                          className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-amber-300 font-black text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="AUTO" className="bg-slate-900 text-white">🔄 الكشف التلقائي (حسب الحساب)</option>
                          <option value="ADMIN" className="bg-slate-900 text-white">👑 الإدارة والمشرف العام (صلاحيات كاملة)</option>
                          <option value="TEACHER" className="bg-slate-900 text-white">🏫 أستاذ مؤسسة (تسجيل المشاركين فقط)</option>
                          <option value="long_jump_committee" className="bg-slate-900 text-white">🦘 لجنة القفز (مسابقة القفز فقط)</option>
                          <option value="shot_put_committee" className="bg-slate-900 text-white">☄️ لجنة دفع الجلة (مسابقة الجلة فقط)</option>
                          <option value="sprint_committee" className="bg-slate-900 text-white">⚡ لجنة الجري السريع (سباقات السرعة فقط)</option>
                          <option value="middle_distance_committee" className="bg-slate-900 text-white">🏃‍♂️ لجنة المسافات المتوسطة (المسافات المتوسطة فقط)</option>
                          <option value="podium_committee" className="bg-slate-900 text-white">🏆 لجنة التتويج والمراسيم (منصة التتويج فقط)</option>
                        </select>
                        <p className="text-[10px] text-slate-500 italic flex-1">
                          * هذا الإعداد يغير واجهة التطبيق الحالية لمحاكاة ما يراه صاحب الصلاحية.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {committees.map(comm => {
                        const assignment = assignments[comm.id];
                        const members = assignment?.members || [];

                        return (
                          <div
                            key={comm.id}
                            className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">{comm.icon}</span>
                                <h5 className="text-sm font-black text-white">{comm.titleAr}</h5>
                              </div>
                              <button
                                onClick={() => handleOpenCommitteeEdit(comm)}
                                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>تعديل الطاقم</span>
                              </button>
                            </div>

                            <div className="text-xs space-y-1 bg-slate-900 p-2.5 rounded-xl border border-slate-850">
                              <div className="flex items-center justify-between text-slate-300">
                                <span className="text-slate-400">رئيس اللجنة:</span>
                                <span className="font-bold text-amber-300">{assignment?.teacherName || 'غير معين'}</span>
                              </div>
                              <div className="flex items-center justify-between text-slate-400">
                                <span>أعضاء الطاقم:</span>
                                <span className="font-mono text-white font-bold">{members.length} أساتذة</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* TAB B: DISCIPLINES MANAGEMENT (ADD / DELETE) */}
                {settingsActiveTab === 'disciplines' && (
                  <div className="space-y-6">
                    
                    {/* Add New Event Box */}
                    <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-4">
                      <h4 className="text-sm font-black text-white flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          {editingDiscipline ? (
                            <>
                              <Edit2 className="w-4 h-4 text-amber-400" />
                              <span className="text-amber-400">تعديل مسابقة: «{editingDiscipline.nameAr}»</span>
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4 text-blue-400" />
                              <span>إضافة مسابقة رياضية جديدة للبطولة</span>
                            </>
                          )}
                        </div>
                        {editingDiscipline && (
                          <button
                            type="button"
                            onClick={handleCancelEditDiscipline}
                            className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 cursor-pointer"
                          >
                            إلغاء التعديل
                          </button>
                        )}
                      </h4>

                      <form onSubmit={handleCreateDiscipline} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        <div>
                          <label className="block text-slate-300 font-bold mb-1">اسم المسابقة بالعربية *</label>
                          <input
                            type="text"
                            required
                            value={newDiscNameAr}
                            onChange={(e) => setNewDiscNameAr(e.target.value)}
                            placeholder="مثال: سباق 200 متر مستوية"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">الاسم بالفرنسية</label>
                          <input
                            type="text"
                            value={newDiscNameFr}
                            onChange={(e) => setNewDiscNameFr(e.target.value)}
                            placeholder="Ex: Course 200m Plat"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">النوع</label>
                          <select
                            value={newDiscType}
                            onChange={(e) => setNewDiscType(e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold cursor-pointer"
                          >
                            <option value="track_sprint">🏃 سباقات السرعة (Sprint)</option>
                            <option value="track_middle">🏃‍♂️ مسافات متوسطة (Demi-fond)</option>
                            <option value="track_relay">🤝 سباقات التناوب (Relais)</option>
                            <option value="field_jump">🦘 مسابقات القفز (Saut)</option>
                            <option value="field_throw">☄️ مسابقات الرمي (Lancer)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">اللجنة المشرفة</label>
                          <select
                            value={newDiscCommitteeId}
                            onChange={(e) => setNewDiscCommitteeId(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold cursor-pointer"
                          >
                            {committees.map(c => (
                              <option key={c.id} value={c.id}>{c.titleAr}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">المسافة أو الوحدة</label>
                          <input
                            type="text"
                            value={newDiscDistance}
                            onChange={(e) => setNewDiscDistance(e.target.value)}
                            placeholder="مثال: 200م أو بالمتر"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-300 font-bold mb-1">الرمز التعبيري</label>
                          <select
                            value={newDiscIcon}
                            onChange={(e) => setNewDiscIcon(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold cursor-pointer"
                          >
                            <option value="⚡">⚡ سرعة</option>
                            <option value="🏃">🏃 جري</option>
                            <option value="🤝">🤝 تتابع</option>
                            <option value="🦘">🦘 قفز</option>
                            <option value="☄️">☄️ رمي</option>
                            <option value="🎯">🎯 هدف</option>
                          </select>
                        </div>

                        {/* Allowed Categories Customization */}
                        <div className="sm:col-span-2 md:col-span-3 space-y-1.5 bg-slate-900 p-3 rounded-xl border border-slate-800">
                          <label className="block text-xs font-bold text-amber-300">تخصيص الفئات العمرية المسموحة لهذه المسابقة:</label>
                          <div className="flex flex-wrap gap-4 text-xs font-bold text-slate-200">
                            {(['U12', 'U15', 'U18', 'U20'] as const).map(cat => (
                              <label key={cat} className="flex items-center gap-1.5 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={newDiscCats.includes(cat)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setNewDiscCats(prev => [...prev, cat]);
                                    } else {
                                      setNewDiscCats(prev => prev.filter(c => c !== cat));
                                    }
                                  }}
                                  className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer"
                                />
                                <span>{cat === 'U12' ? 'براعم (U12)' : cat === 'U15' ? 'صغار (U15)' : cat === 'U18' ? 'فتيان (U18)' : 'شبان (U20)'}</span>
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="sm:col-span-2 md:col-span-3 flex justify-end pt-2">
                          <button
                            type="submit"
                            className={`px-5 py-2.5 rounded-xl font-black text-xs shadow-md cursor-pointer flex items-center gap-1.5 ${
                              editingDiscipline 
                                ? 'bg-amber-600 hover:bg-amber-700 text-white animate-pulse' 
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            {editingDiscipline ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                            <span>{editingDiscipline ? 'حفظ تعديلات المسابقة' : 'إضافة المسابقة الآن'}</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    {/* Current Events List with Delete Action for All */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-black text-white">قائمة المسابقات المعتمدة ({disciplines.length}):</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {disciplines.map(disc => (
                          <div
                            key={disc.id}
                            className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="text-2xl shrink-0">{disc.icon}</span>
                              <div className="min-w-0">
                                <h5 className="text-xs font-black text-white truncate">{disc.nameAr}</h5>
                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                  <span className="text-[10px] text-slate-400">{disc.distanceOrUnit}</span>
                                  <div className="flex items-center gap-1">
                                    {disc.allowedCategories?.map(c => (
                                      <span key={c} className="text-[9px] font-extrabold bg-blue-900/60 text-blue-200 px-1.5 py-0.2 rounded border border-blue-700">
                                        {c}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleStartEditDiscipline(disc)}
                                className="p-2 bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-white rounded-xl transition-all cursor-pointer border border-amber-500/30 flex items-center justify-center"
                                title="تعديل هذه المسابقة"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteDiscipline(disc)}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white rounded-xl transition-all cursor-pointer border border-rose-500/30 flex items-center justify-center"
                                title="حذف هذه المسابقة"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB C: DATA & TOOLS */}
                {settingsActiveTab === 'auto_import' && (
                  <div className="space-y-6 max-w-2xl mx-auto py-4">
                    
                    {/* 1. School Specific Mock Data (For Teachers) */}
                    {(isTeacher || selectedSchoolForView !== 'ALL') && (
                      <div className="bg-slate-950 p-6 rounded-3xl border border-indigo-500/20 text-center space-y-4">
                        <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto text-2xl">
                          🏫
                        </div>
                        <div>
                          <h4 className="text-base font-black text-white">ملء لائحة المؤسسة ببيانات افتراضية</h4>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            تقوم هذه الأداة بتوليد مشاركين وهميين لمؤسسة «<strong className="text-indigo-300">{(isTeacher ? detectedTeacherSchool : selectedSchoolForView)}</strong>» وتوزيعهم على مختلف المسابقات لاختبار عملية التسجيل والطباعة.
                          </p>
                        </div>
                        <button
                          onClick={handleLoadSchoolDemoData}
                          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>تعبئة بيانات المؤسسة الافتراضية</span>
                        </button>
                      </div>
                    )}

                    {!isTeacher && (
                      <>
                        {/* 2. Auto Import Section */}
                        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-center space-y-4">
                          <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-2xl">
                            🔄
                          </div>
                          <div>
                            <h4 className="text-base font-black text-white">الاستيراد التلقائي للمشاركين من المنظومة</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              تقوم هذه الخاصية بالبحث في قاعدة بيانات التلاميذ المسجلين من طرف الأساتذة والمؤسسات في تخصصات ألعاب القوى والعدو، وإدراجهم وتوزيعهم تلقائياً.
                            </p>
                          </div>
                          <button
                            onClick={handleTriggerAutoImport}
                            className="w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>مزامنة واستيراد المشاركين الآن</span>
                          </button>
                        </div>

                        {/* 3. Demo Data Section */}
                        <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-center space-y-4">
                          <div className="w-16 h-16 rounded-3xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center mx-auto text-2xl">
                            ✨
                          </div>
                          <div>
                            <h4 className="text-base font-black text-white">تحميل وتوزيع بيانات افتراضية (10 متسابقين لكل سباق وفئة ولجنة)</h4>
                            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                              هذه الأداة مخصصة للمعاينة والتجريب الشامل؛ تقوم بتوليد 10 متسابقين في كل سباق، كل فئة، وكل جنس وتوزيعها بدقة حسب كل لجنة ومؤسسة.
                            </p>
                          </div>

                          <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setIsSettingsModalOpen(false);
                                setIsDemoRosterModalOpen(true);
                              }}
                              className="w-full sm:w-1/2 px-4 py-3 bg-purple-600/30 hover:bg-purple-600 border border-purple-500/50 text-purple-200 hover:text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                            >
                              <SlidersHorizontal className="w-4 h-4 text-purple-300" />
                              <span>توزيع وتخصيص حسب اللجان</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleLoadDemoData}
                              className="w-full sm:w-1/2 px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                            >
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              <span>تعبئة شاملة (10 لكل سباق)</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* EDIT COMMITTEE MODAL (تعديل طاقم اللجنة والمهام من الأساتذة المسجلين) */}
        {/* ========================================================================= */}
        {editingCommittee && (
          <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
              
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{editingCommittee.icon}</span>
                  <h4 className="text-base font-black text-white">
                    تعديل طاقم ومهام <span className="text-amber-400">{editingCommittee.titleAr}</span>
                  </h4>
                </div>
                <button
                  onClick={() => setEditingCommittee(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* 1. Main Head Teacher */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <label className="block text-xs font-bold text-amber-300">
                  👑 رئيس اللجنة الرئيسي (من قاعدة بيانات الأساتذة):
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedTeacherId(id);
                    const t = teachers.find(item => item.id === id);
                    if (t) {
                      setManualTeacherName(t.fullName);
                      setTeacherPhone(t.phone || '');
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer"
                >
                  <option value="">-- اختر أستاذاً من الأطر المسجلة بالمديرية --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} ({t.workLocation || 'المؤسسة'}) - SOM: {t.leaseNumber || 'N/A'}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Add Member with Task to Committee */}
              <div className="space-y-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <h5 className="text-xs font-black text-white flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-blue-400" />
                  <span>إضافة أستاذ لطاقم اللجنة وتحديد مهمته:</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs">
                  <div className="sm:col-span-6">
                    <select
                      value={newMemberTeacherId}
                      onChange={(e) => setNewMemberTeacherId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold cursor-pointer"
                    >
                      <option value="">-- اختر الأستاذ(ة) --</option>
                      {teachers.map(t => (
                        <option key={t.id} value={t.id}>{t.fullName} ({t.workLocation || 'المؤسسة'})</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-4">
                    <select
                      value={newMemberRole}
                      onChange={(e) => setNewMemberRole(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold cursor-pointer"
                    >
                      {COMMITTEE_ROLE_OPTIONS.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={handleAddMemberToCommittee}
                      className="w-full h-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold cursor-pointer"
                    >
                      إضافة
                    </button>
                  </div>
                </div>

                {/* Members List */}
                <div className="pt-2 space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-bold block">أعضاء اللجنة الحاليون ({committeeMembersList.length}):</span>
                  {committeeMembersList.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">لا يوجد أعضاء مضافون حتى الآن</p>
                  ) : (
                    <div className="space-y-1.5">
                      {committeeMembersList.map((m) => (
                        <div
                          key={m.teacherId}
                          className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-white block">{m.teacherName}</span>
                            <span className="text-[10px] text-slate-400">{m.schoolName} • 📞 {m.phone || 'بدون هاتف'}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-black">
                              {m.roleInCommittee}
                            </span>
                            <button
                              type="button"
                              onClick={() => handlePromptRemoveMember(m)}
                              className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer"
                              title="حذف العضو"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Save / Cancel */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCommittee(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveCommitteeDetails}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                >
                  حفظ وتطبيق التغييرات
                </button>
              </div>

            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* ADD PARTICIPANT MODAL */}
        {/* ========================================================================= */}
        {isAddParticipantOpen && activeDiscipline && (
          <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h4 className="text-base font-black text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-blue-400" />
                  <span>إضافة عداء / متسابق جديد</span>
                </h4>
                <button onClick={() => setIsAddParticipantOpen(false)} className="p-1 text-slate-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreateParticipant} className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المسابقة المحددة:</label>
                  <div className="px-3 py-2 bg-slate-800 rounded-xl text-xs font-black text-amber-400">
                    {activeDiscipline.nameAr} ({selectedCategory} - {selectedGender === 'Male' ? 'ذكور' : 'إناث'})
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الصدرية (Dossard) *:</label>
                  <input
                    type="text"
                    required
                    value={newBib}
                    onChange={(e) => setNewBib(e.target.value)}
                    placeholder="مثال: 105"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الاسم الكامل للتلميذ(ة) *:</label>
                  <input
                    type="text"
                    required
                    value={newStudentName}
                    onChange={(e) => setNewStudentName(e.target.value)}
                    placeholder="مثال: أيوب البوعناني"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">المؤسسة التعليمية *:</label>
                  <select
                    value={newSchoolName}
                    onChange={(e) => setNewSchoolName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    <option value="">-- اختر المؤسسة --</option>
                    {schools.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                    <option value="ثانوية الفتح التأهيلية">ثانوية الفتح التأهيلية</option>
                    <option value="إعدادية علال الفاسي">إعدادية علال الفاسي</option>
                    <option value="مدرسة ابن خلدون">مدرسة ابن خلدون</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAddParticipantOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer"
                  >
                    إضافة العداء
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Confirm Delete Discipline Modal */}
      <ConfirmDeleteModal
        isOpen={!!disciplineToDelete}
        onClose={() => setDisciplineToDelete(null)}
        onConfirm={handleConfirmDeleteDiscipline}
        title="حذف المسابقة الرياضية"
        message="هل أنت متأكد من رغبتك في حذف هذه المسابقة نهائياً من البطولة؟"
        itemName={disciplineToDelete?.nameAr}
      />

      {/* Confirm Delete Participant Modal */}
      <ConfirmDeleteModal
        isOpen={!!participantToDelete}
        onClose={() => setParticipantToDelete(null)}
        onConfirm={handleConfirmDeleteParticipant}
        title="حذف مشارك من اللائحة"
        message="هل أنت متأكد من رغبتك في حذف هذا التلميذ(ة) من لائحة المشاركة في بطولة ألعاب القوى؟"
        itemName={participantToDelete?.studentName}
      />

      {/* Confirm Remove Committee Member Modal */}
      <ConfirmDeleteModal
        isOpen={!!memberToDelete}
        onClose={() => setMemberToDelete(null)}
        onConfirm={handleConfirmRemoveMember}
        title="حذف عضو من اللجنة"
        message="هل أنت متأكد من رغبتك في إعفاء وحذف هذا الأستاذ من طاقم اللجنة؟"
        itemName={memberToDelete?.teacherName}
      />

      {/* ========================================================================= */}
      {/* 📝 MODAL: SCHOOL PARTICIPANT REGISTRATION & EDIT FORM 📝 */}
      {/* ========================================================================= */}
      {isSchoolRegModalOpen && (
        <div className="fixed inset-0 z-70 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir="rtl">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 w-full max-w-xl space-y-4 shadow-2xl my-auto text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-600/20 text-emerald-400 flex items-center justify-center font-bold">
                  🏃‍♂️
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-black text-white">
                    {editingParticipant ? 'تعديل بيانات التلميذ(ة) المشارك(ة)' : 'تسجيل تلميذ(ة) مشارك جديد في ألعاب القوى'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    المؤسسة: {isTeacher ? (detectedTeacherSchool || 'مؤسستي') : (selectedSchoolForView || 'المؤسسة')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSchoolRegModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSchoolParticipant} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Full Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-300 mb-1">الاسم والنسب الكامل للتلميذ(ة) *:</label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="مثال: يوسف الإدريسي"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Massar Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم مسار (Massar):</label>
                  <input
                    type="text"
                    value={regMassar}
                    onChange={(e) => setRegMassar(e.target.value.toUpperCase())}
                    placeholder="مثال: F134567890"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الجنس *:</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegGender('Male')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        regGender === 'Male'
                          ? 'bg-blue-600 text-white shadow-xs font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>🏃‍♂️ ذكر</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegGender('Female')}
                      className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        regGender === 'Female'
                          ? 'bg-pink-600 text-white shadow-xs font-black'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span>🏃‍♀️ أنثى</span>
                    </button>
                  </div>
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الفئة العمرية *:</label>
                  <select
                    value={regCategory}
                    onChange={(e) => setRegCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-emerald-500"
                  >
                    <option value="U12">براعم (U12) - مواليد 2013-2015</option>
                    <option value="U15">صغار (U15) - مواليد 2010-2012</option>
                    <option value="U18">فتيان (U18) - مواليد 2007-2009</option>
                    <option value="U20">شبان (U20) - مواليد 2005-2006</option>
                  </select>
                </div>

                {/* Birth Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">تاريخ الازدياد:</label>
                  <input
                    type="date"
                    value={regBirthDate}
                    onChange={(e) => setRegBirthDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Discipline 1 (Mandatory) */}
                <div>
                  <label className="block text-xs font-bold text-emerald-400 mb-1">
                    المسابقة الأولى (إجبارية) *:
                  </label>
                  <select
                    required
                    value={regDiscipline1}
                    onChange={(e) => setRegDiscipline1(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-emerald-600/70 rounded-xl text-xs font-black text-emerald-300 cursor-pointer focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">-- اختر المسابقة الأولى --</option>
                    {availableRegDisciplines.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.icon} {d.nameAr} ({d.distanceOrUnit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Discipline 2 (Optional, max 2 disciplines) */}
                <div>
                  <label className="block text-xs font-bold text-amber-400 mb-1">
                    المسابقة الثانية (اختيارية - حد أقصى مسابقتين):
                  </label>
                  <select
                    value={regDiscipline2}
                    onChange={(e) => setRegDiscipline2(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-amber-300 cursor-pointer focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- بدون مسابقة ثانية --</option>
                    {availableRegDisciplines
                      .filter(d => d.id !== regDiscipline1)
                      .map(d => (
                        <option key={d.id} value={d.id}>
                          {d.icon} {d.nameAr} ({d.distanceOrUnit})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Bib Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">رقم الصدرية (Dossard):</label>
                  <input
                    type="text"
                    value={regBibNumber}
                    onChange={(e) => setRegBibNumber(e.target.value)}
                    placeholder="مثال: 108"
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Affiliation */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">الصفة الرياضية:</label>
                  <select
                    value={regAffiliation}
                    onChange={(e) => setRegAffiliation(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    <option value="non_club">مدرسي فقط (غير منتمي لنادٍ)</option>
                    <option value="club_affiliated">منتمي لنادي رياضي أو عصبة</option>
                  </select>
                </div>
              </div>

              {/* Notice */}
              <div className="mobile-hide-desc p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-[11px] text-emerald-200 flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  تتيح لوائح ألعاب القوى المدرسية للتلميذ المشاركة في مسابقتين كحد أقصى (مثلاً: سباق 100م والقفز الطولي، أو 800م وتتابع).
                </span>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSchoolRegModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-98"
                >
                  {editingParticipant ? 'حفظ التعديلات' : 'تسجيل التلميذ(ة) في اللائحة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🖨️ MODAL: OFFICIAL PRINTABLE PARTICIPATION ROSTER SHEET 🖨️ */}
      {/* ========================================================================= */}
      {isPrintRosterModalOpen && (
        <div className="fixed inset-0 z-80 bg-black/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto" dir="rtl">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden my-auto flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-150">
            
            {/* Top Toolbar (No-Print) */}
            <div className="bg-slate-900 text-white p-4 flex items-center justify-between shrink-0 print:hidden">
              <div className="flex items-center gap-2">
                <Printer className="w-5 h-5 text-emerald-400" />
                <span className="text-sm font-black">معاينة وطباعة اللائحة الرسمية للمشاركة في ألعاب القوى</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportSchoolExcel}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/30"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الآن (Imprimer)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPrintRosterModalOpen(false)}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-6 sm:p-10 overflow-y-auto flex-1 font-sans text-slate-900 bg-white">
              
              {/* Official Moroccan National Education Header */}
              <div className="border-b-2 border-slate-900 pb-5 mb-5 flex flex-col md:flex-row items-center justify-between text-center md:text-right gap-4">
                <div className="space-y-1">
                  <h5 className="text-xs font-extrabold text-slate-800">المملكة المغربية</h5>
                  <h5 className="text-xs font-bold text-slate-800">وزارة التربية الوطنية والتعليم الأولي والرياضة</h5>
                  <h6 className="text-[11px] font-medium text-slate-700">الأكاديمية الجهوية للتربية والتكوين – جهة الشرق</h6>
                  <h6 className="text-[11px] font-bold text-slate-900">المديرية الإقليمية بتاوريرت</h6>
                  <p className="text-[10px] text-slate-600 font-semibold">الفرع الإقليمي للجامعة الملكية المغربية للرياضة المدرسية</p>
                </div>

                <div className="w-20 h-20 rounded-2xl border-2 border-slate-900 flex flex-col items-center justify-center p-2 text-center bg-slate-50 shrink-0">
                  <span className="text-2xl">🇲🇦</span>
                  <span className="text-[8px] font-black text-slate-900 mt-1">FRMSS</span>
                </div>

                <div className="space-y-1 text-center md:text-left" dir="ltr">
                  <h5 className="text-xs font-extrabold text-slate-800">Royaume du Maroc</h5>
                  <h6 className="text-[11px] font-semibold text-slate-700">Ministère de l'Éducation Nationale</h6>
                  <h6 className="text-[11px] font-semibold text-slate-700">Direction Provinciale de Taourirt</h6>
                  <p className="text-[10px] text-slate-600 font-bold">Championnat Provincial Scolaire d'Athlétisme</p>
                </div>
              </div>

              {/* Title Banner */}
              <div className="bg-slate-100 border border-slate-300 rounded-2xl p-4 text-center my-4 space-y-1">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  بطاقة المشاركة الرسمية في البطولة الإقليمية المدرسية لألعاب القوى
                </h3>
                <p className="text-xs font-bold text-slate-600 font-mono">
                  الموسم الرياضي: {season}
                </p>
              </div>

              {/* Institution Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs mb-5">
                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">المؤسسة التعليمية:</span>
                  <span className="font-black text-slate-900 text-sm">
                    {isTeacher ? (detectedTeacherSchool || 'المؤسسة') : (selectedSchoolForView || 'جميع المؤسسات')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">الأستاذ المؤطر:</span>
                  <span className="font-extrabold text-slate-900">
                    {currentUser?.fullName || 'ذ. التربية البدنية'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">رقم الهاتف:</span>
                  <span className="font-mono font-bold text-slate-800" dir="ltr">
                    {currentUser?.phone || '06XXXXXXXX'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-bold block text-[10px]">إجمالي المشاركين:</span>
                  <span className="font-black text-emerald-700">
                    {currentSchoolParticipants.length} تلميذ(ة)
                  </span>
                </div>
              </div>

              {/* Table of Athletes */}
              <div className="border border-slate-300 rounded-xl overflow-hidden mb-8">
                <table className="w-full text-right text-xs border-collapse">
                  <thead className="bg-slate-200 text-slate-900 font-black border-b border-slate-300">
                    <tr>
                      <th className="p-2 text-center border-l border-slate-300 w-10">الرقم</th>
                      <th className="p-2 border-l border-slate-300">الاسم والنسب الكامل</th>
                      <th className="p-2 border-l border-slate-300">رقم مسار</th>
                      <th className="p-2 border-l border-slate-300">تاريخ الازدياد</th>
                      <th className="p-2 border-l border-slate-300">الفئة</th>
                      <th className="p-2 border-l border-slate-300">الجنس</th>
                      <th className="p-2 border-l border-slate-300">المسابقة الأولى</th>
                      <th className="p-2 border-l border-slate-300">المسابقة الثانية</th>
                      <th className="p-2 text-center border-l border-slate-300 w-16">الصدرية</th>
                      <th className="p-2 text-center w-20">الصفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
                    {currentSchoolParticipants.map((p, idx) => {
                      const disc1 = disciplines.find(d => d.id === p.disciplineId);
                      const disc2 = p.secondDisciplineId ? disciplines.find(d => d.id === p.secondDisciplineId) : null;
                      return (
                        <tr key={p.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="p-2 text-center font-bold border-l border-slate-200">{idx + 1}</td>
                          <td className="p-2 font-black text-slate-900 border-l border-slate-200">{p.studentName}</td>
                          <td className="p-2 font-mono border-l border-slate-200">{p.massarNumber || '---'}</td>
                          <td className="p-2 font-mono border-l border-slate-200">{p.birthDate || p.birthYear || '---'}</td>
                          <td className="p-2 font-bold border-l border-slate-200">{p.category}</td>
                          <td className="p-2 border-l border-slate-200">{p.gender === 'Female' ? 'أنثى' : 'ذكر'}</td>
                          <td className="p-2 font-bold text-slate-900 border-l border-slate-200">
                            {disc1 ? `${disc1.nameAr} (${disc1.distanceOrUnit})` : p.disciplineId}
                          </td>
                          <td className="p-2 font-bold text-slate-700 border-l border-slate-200">
                            {disc2 ? `${disc2.nameAr} (${disc2.distanceOrUnit})` : '---'}
                          </td>
                          <td className="p-2 text-center font-mono font-black border-l border-slate-200 text-slate-900">
                            #{p.bibNumber}
                          </td>
                          <td className="p-2 text-center text-[10px] font-bold">
                            {p.affiliationType === 'club_affiliated' ? 'نادي' : 'مدرسي'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Official Signatures & Stamp Block */}
              <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-slate-400 text-center text-xs">
                <div className="space-y-14">
                  <p className="font-black text-slate-900">توقيع الأستاذ(ة) المؤطر(ة):</p>
                  <p className="text-[10px] text-slate-400">............................................</p>
                </div>

                <div className="space-y-14">
                  <p className="font-black text-slate-900">توقيع وخاتم السيد(ة) مدير(ة) المؤسسة:</p>
                  <p className="text-[10px] text-slate-400">............................................</p>
                </div>

                <div className="space-y-14">
                  <p className="font-black text-slate-900">تأشيرة الفرع الإقليمي للجامعة (FRMSS):</p>
                  <p className="text-[10px] text-slate-400">............................................</p>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🛡️ MODAL: CONFIGURE COMMITTEE PERMISSIONS & ACCESSIBLE BUTTONS 🛡️ */}
      {/* ========================================================================= */}
      {isPermissionsModalOpen && editingPermissionsCommittee && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2.5 bg-slate-800 border border-slate-700 rounded-2xl">
                  {editingPermissionsCommittee.icon}
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-400" />
                    <span>تحديد صلاحيات وأزرار «{editingPermissionsCommittee.titleAr}»</span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {editingPermissionsCommittee.titleFr}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPermissionsModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCommitteePermissions} className="space-y-5">
              {/* Section 1: Allowed Tabs */}
              <div className="space-y-2.5">
                <label className="text-xs font-black text-amber-300 block">
                  1. التبويبات المسموح بالولوج إليها لأعضاء هذه اللجنة:
                </label>
                <p className="text-[11px] text-slate-400">
                  عند تفعيل الصلاحية، ستظهر فقط التبويبات المحددة هنا ولن يتمكن العضو من رؤية التبويبات الأخرى.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {[
                    { id: 'stopwatch', label: 'الميقاتي الذكي للسباقات', icon: '⚡' },
                    { id: 'field', label: 'مسابقات الميدان (القفز والجلة)', icon: '🦘' },
                    { id: 'podium', label: 'منصة التتويج والنتائج الرسمية', icon: '🏆' },
                    { id: 'school_registration', label: 'تسجيل ومشاركو المؤسسات', icon: '🏫' },
                    { id: 'events', label: 'المسابقات والتخصصات', icon: '📑' },
                    { id: 'committees', label: 'اللجان وتوزيع المهام', icon: '👥' }
                  ].map(tab => {
                    const isChecked = tempAllowedTabs.includes(tab.id as any);
                    return (
                      <label
                        key={tab.id}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-slate-850 border-amber-500/80 ring-1 ring-amber-500/40 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="text-base">{tab.icon}</span>
                          <span className="text-xs font-bold">{tab.label}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempAllowedTabs(prev => [...prev, tab.id as any]);
                            } else {
                              setTempAllowedTabs(prev => prev.filter(t => t !== tab.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-amber-500 focus:ring-0 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Allowed Disciplines */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-blue-300 block">
                    2. المسابقات الخاصة بهذه اللجنة (تظهر له هذه المسابقات فقط):
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {tempAllowedDiscIds.length} مسابقة محددة
                  </span>
                </div>
                <p className="mobile-hide-desc text-[11px] text-slate-400">
                  مثال: عند تحديد مسابقات القفز فقط للجنة القفز، فلن تظهر له أي مسابقة أخرى كدفع الجلة أو سباقات الجري.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {disciplines.map(disc => {
                    const isChecked = tempAllowedDiscIds.includes(disc.id);
                    return (
                      <label
                        key={disc.id}
                        className={`p-2.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                          isChecked
                            ? 'bg-slate-850 border-blue-500/70 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{disc.icon}</span>
                          <span className="text-xs font-bold">{disc.nameAr}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTempAllowedDiscIds(prev => [...prev, disc.id]);
                            } else {
                              setTempAllowedDiscIds(prev => prev.filter(id => id !== disc.id));
                            }
                          }}
                          className="w-4 h-4 rounded text-blue-500 focus:ring-0 cursor-pointer"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Allowed Viewing Tabs */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <label className="text-xs font-black text-indigo-300 block">
                  3. تبويبات العرض المصرح بدخولها (صلاحيات العرض):
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'school_registration', label: 'لوائح المؤسسة', icon: <SchoolIcon className="w-3 h-3" /> },
                    { id: 'my_participations', label: 'مشاركات تلاميذي', icon: <UserCheck className="w-3 h-3" /> },
                    { id: 'stopwatch', label: 'الميقاتي الذكي', icon: <Timer className="w-3 h-3" /> },
                    { id: 'field', label: 'مسابقات الميدان', icon: <Award className="w-3 h-3" /> },
                    { id: 'podium', label: 'منصة التتويج', icon: <Trophy className="w-3 h-3" /> },
                    { id: 'events', label: 'إدارة المسابقات', icon: <Layers className="w-3 h-3" /> }
                  ].map(tab => (
                    <label 
                      key={tab.id}
                      className={`flex items-center gap-2 p-2 rounded-xl border transition-all cursor-pointer ${
                        tempAllowedTabs.includes(tab.id as any)
                          ? 'bg-indigo-500/10 border-indigo-500 text-indigo-200'
                          : 'bg-slate-950/60 border-slate-800 text-slate-500 hover:border-slate-700'
                      }`}
                    >
                      <input 
                        type="checkbox"
                        checked={tempAllowedTabs.includes(tab.id as any)}
                        onChange={(e) => {
                          if (e.target.checked) setTempAllowedTabs([...tempAllowedTabs, tab.id as any]);
                          else setTempAllowedTabs(tempAllowedTabs.filter(t => t !== tab.id));
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0"
                      />
                      <div className="flex items-center gap-1.5 overflow-hidden">
                        <span className="shrink-0 opacity-70">{tab.icon}</span>
                        <span className="text-[10px] font-bold truncate">{tab.label}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Section 4: Allowed Action Buttons */}
              <div className="space-y-2.5 pt-2 border-t border-slate-800">
                <label className="text-xs font-black text-emerald-300 block">
                  4. صلاحيات الأزرار والعمليات المتاحة لهذه اللجنة:
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-700">
                    <div>
                      <span className="text-xs font-black text-white block">تسجيل وإدخال النتائج والمحاولات</span>
                      <span className="text-[10px] text-slate-400 block">تفعيل أزرار إدخال المسافة / التوقيت</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempCanRecord}
                      onChange={(e) => setTempCanRecord(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-700">
                    <div>
                      <span className="text-xs font-black text-white block">اعتماد وإقفال النتائج الرسمية</span>
                      <span className="text-[10px] text-slate-400 block">تفعيل زر اعتماد وحفظ النتائج</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempCanValidate}
                      onChange={(e) => setTempCanValidate(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-700">
                    <div>
                      <span className="text-xs font-black text-white block">طباعة المحاضر والشواهد</span>
                      <span className="text-[10px] text-slate-400 block">إظهار أزرار الطباعة الرسمية</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempCanPrint}
                      onChange={(e) => setTempCanPrint(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </label>

                  <label className="p-3 bg-slate-950/70 border border-slate-800 rounded-2xl flex items-center justify-between cursor-pointer hover:border-slate-700">
                    <div>
                      <span className="text-xs font-black text-white block">تصدير البيانات إلى Excel</span>
                      <span className="text-[10px] text-slate-400 block">إظهار أزرار تصدير ملفات Excel</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={tempCanExport}
                      onChange={(e) => setTempCanExport(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black shadow-lg shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>حفظ الصلاحيات والأزرار</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* 📋 MODAL: CHAMBRE D'APPEL / ROLL CALL & ATTENDANCE (غرفة المناداة وتأكيد الحضور) 📋 */}
      {/* ========================================================================= */}
      {isAttendanceModalOpen && activeDiscipline && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2.5 bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 rounded-2xl text-indigo-600 dark:text-indigo-400">
                  <ClipboardList className="w-7 h-7" />
                </span>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>غرفة المناداة وتأكيد الحضور (Chambre d'Appel)</span>
                    </h3>
                    <span className="px-2.5 py-0.5 text-xs font-black bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-500/30 rounded-lg">
                      {activeDiscipline.nameAr}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-lg">
                      {selectedCategory}
                    </span>
                    <span className="px-2 py-0.5 text-xs font-bold bg-pink-100 dark:bg-pink-500/20 text-pink-700 dark:text-pink-300 rounded-lg">
                      {selectedGender === 'Male' ? 'ذكور' : 'إناث'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    المناداة على المتسابقين، تثبيت رقم الصدرية والممر (Couloir)، واستبعاد الغائبين قبل انطلاق السباق
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats & Action Toolbar */}
            <div className="space-y-3 shrink-0">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 dark:bg-slate-950/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
                {/* Badges Count */}
                <div className="flex items-center gap-2 flex-wrap text-xs font-bold">
                  <span className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-xl">
                    إجمالي المسجلين: <strong className="font-mono text-sm">{attendanceStats.total}</strong>
                  </span>
                  <span className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>حاضرون:</span>
                    <strong className="font-mono text-sm">{attendanceStats.present}</strong>
                  </span>
                  <span className="px-3 py-1.5 bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl flex items-center gap-1">
                    <UserX className="w-3.5 h-3.5" />
                    <span>غائبون:</span>
                    <strong className="font-mono text-sm">{attendanceStats.absent}</strong>
                  </span>
                  <span className="px-3 py-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center gap-1">
                    <span>قيد الانتظار:</span>
                    <strong className="font-mono text-sm">{attendanceStats.pending}</strong>
                  </span>
                </div>

                {/* Bulk Actions */}
                <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleMarkAllAttendance('present')}
                    className="p-1.5 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                    title="تأكيد حضور جميع المتسابقين في هذا السباق دفعة واحدة"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span className="hidden sm:inline">تأكيد حضور الجميع</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleMarkAllAttendance('absent')}
                    className="p-1.5 sm:px-3 sm:py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                    title="تسجيل غياب جميع غير المؤكدين"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">تسجيل غياب الجميع</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleResetAttendance}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                    title="إعادة ضبط المناداة لحالتها الأولية"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">إعادة ضبط</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintAttendanceSheet}
                    className="p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                    title="طباعة ورقة المناداة ولائحة الانطلاق"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">طباعة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAddParticipantOpen(true)}
                    className="p-1.5 sm:px-3 sm:py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                    title="إضافة عداء للسباق"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">إضافة عداء</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter Tabs */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500 dark:text-slate-400">التصفية:</span>
                  {(['ALL', 'present', 'absent', 'pending'] as const).map(st => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setAttendanceFilterStatus(st)}
                      className={`px-3 py-1 rounded-xl text-xs font-bold transition-all ${
                        attendanceFilterStatus === st
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      {st === 'ALL' ? `الكل (${attendanceStats.total})` :
                       st === 'present' ? `حاضر (${attendanceStats.present})` :
                       st === 'absent' ? `غائب (${attendanceStats.absent})` :
                       `انتظار (${attendanceStats.pending})`}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={attendanceSearchQuery}
                    onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                    placeholder="بحث برقم الصدرية، الاسم، أو المؤسسة..."
                    className="w-full pr-9 pl-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Participants Roll Call Table / Cards */}
            <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 min-h-[220px]">
              {sortedParticipantsForAssignment.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <Users className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">لا يوجد متسابقون مسجلون في هذه المسابقة بعد</p>
                  <button
                    type="button"
                    onClick={() => setIsAddParticipantOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة عداء للسباق الآن</span>
                  </button>
                </div>
              ) : (
                sortedParticipantsForAssignment
                  .filter(p => {
                    const rec = attendanceMap[p.id];
                    const status = rec?.status || 'pending';
                    if (attendanceFilterStatus !== 'ALL' && status !== attendanceFilterStatus) return false;
                    if (attendanceSearchQuery.trim()) {
                      const q = attendanceSearchQuery.toLowerCase();
                      return (
                        p.studentName.toLowerCase().includes(q) ||
                        p.bibNumber.includes(q) ||
                        p.schoolName.toLowerCase().includes(q)
                      );
                    }
                    return true;
                  })
                  .map((p, idx) => {
                    const rec = attendanceMap[p.id];
                    const status = rec?.status || 'pending';
                    const lane = rec?.lane || (idx + 1);
                    const isCalling = isCallingParticipantId === p.studentName;

                    return (
                      <div
                        key={p.id}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                          isCalling
                            ? 'bg-amber-100 dark:bg-amber-950/60 border-amber-500 ring-2 ring-amber-400 animate-pulse'
                            : status === 'present'
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/60'
                            : status === 'absent'
                            ? 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 opacity-75'
                            : 'bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        {/* Athlete Details */}
                        <div className="flex items-center gap-3">
                          {/* Bib Number Badge */}
                          <div className="w-12 h-12 rounded-2xl bg-slate-900 text-amber-400 font-mono font-black text-base flex flex-col items-center justify-center shrink-0 border border-amber-500/30 shadow-xs">
                            <span className="text-[9px] text-slate-400 leading-none">صدرية</span>
                            <span>#{p.bibNumber}</span>
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                {p.studentName}
                              </h4>
                              {status === 'present' && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                                  حاضر ✅
                                </span>
                              )}
                              {status === 'absent' && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300">
                                  غائب ❌
                                </span>
                              )}
                              {status === 'pending' && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300">
                                  قيد الانتظار ⏳
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5 flex items-center gap-2">
                              <span>🏢 {p.schoolName}</span>
                              {p.massarCode && (
                                <span className="font-mono text-[11px] text-slate-400">({p.massarCode})</span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Controls: Lane, Call Audio, Attendance Toggle */}
                        <div className="flex items-center gap-2 flex-wrap self-end md:self-auto">
                          {/* Lane Input (الممر / الحارة) */}
                          <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-800">
                            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">الممر:</span>
                            <input
                              type="number"
                              min="1"
                              max="12"
                              value={lane}
                              onChange={(e) => handleUpdateLane(p.id, parseInt(e.target.value) || 1)}
                              className="w-10 text-center font-mono font-black text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg py-0.5 text-slate-900 dark:text-white"
                            />
                          </div>

                          {/* Voice Call Button removed per user request */}

                          {/* Attendance Status Buttons */}
                          <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(p.id, 'present')}
                              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                status === 'present'
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="تسجيل الحضور (حاضر)"
                            >
                              <span>✅</span>
                              <span className="hidden sm:inline">حاضر</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(p.id, 'absent')}
                              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-1 ${
                                status === 'absent'
                                  ? 'bg-rose-600 text-white shadow-xs'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="تسجيل الغياب (غائب)"
                            >
                              <span>❌</span>
                              <span className="hidden sm:inline">غائب</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleAttendance(p.id, 'pending')}
                              className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                status === 'pending'
                                  ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                              title="قيد الانتظار"
                            >
                              <span>⏳</span>
                              <span className="hidden sm:inline">انتظار</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ✅ الحاضرون يظهرون تلقائياً في مقدمة قوائم التسجيل في الميقاتي.
              </span>

              <button
                type="button"
                onClick={() => setIsAttendanceModalOpen(false)}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                إغلاق والعودة إلى السباق
              </button>
            </div>

          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* 🎯 MODAL: ASSIGN PUPILS BY FINISH ORDER (اختيار أسماء التلاميذ حسب الترتيب عند انتهاء الاختبار) 🎯 */}
      {/* ========================================================================= */}
      {isAssignByOrderModalOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2.5 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-600 dark:text-amber-400">
                  🎯
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>تحديد واختيار أسماء التلاميذ حسب الترتيب</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    عند انتهاء الاختبار، يتم اختيار اسم كل تلميذ يدوياً حسب رتبة الوصول المحققة.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAssignByOrderModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Context Chips */}
            <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2.5 py-1 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-black">
                  {activeDiscipline?.nameAr}
                </span>
                <span className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold">
                  {selectedCategory}
                </span>
                <span className="px-2.5 py-1 bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800 rounded-xl text-xs font-bold">
                  {selectedGender === 'Male' ? 'ذكور' : 'إناث'}
                </span>
                <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold">
                  السلسلة {activeSeriesNumber}
                </span>
              </div>

              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                المحددون: <strong className="text-emerald-500">{recordedLaps.filter(l => l.participantId).length}</strong> / {recordedLaps.length}
              </span>
            </div>

            {/* Laps Assignment List */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1 min-h-[240px]">
              {recordedLaps.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-slate-950/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 space-y-2">
                  <Timer className="w-8 h-8 text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-500">لا توجد مراتب وصول مسجلة بعد في الميقاتي</p>
                </div>
              ) : (
                [...recordedLaps]
                  .map((lap, origIdx) => ({
                    ...lap,
                    origIdx,
                    effectiveTimeMs: lap.timeMs > 0 ? lap.timeMs : AthleticsService.parseTimeToMs(lap.formattedTime)
                  }))
                  .sort((a, b) => a.effectiveTimeMs - b.effectiveTimeMs)
                  .map((lap, orderIdx) => {
                    const officialRank = orderIdx + 1;
                    const origIdx = lap.origIdx;

                    return (
                      <div
                        key={origIdx}
                        className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          lap.participantId
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/80'
                            : 'bg-white dark:bg-slate-950 border-amber-300 dark:border-amber-800/80 ring-1 ring-amber-400/20'
                        }`}
                      >
                        {/* Rank Badge & Timing */}
                        <div className="flex items-center gap-3">
                          <span className={`w-10 h-10 rounded-2xl font-black text-sm flex items-center justify-center shrink-0 shadow-sm ${
                            officialRank === 1
                              ? 'bg-amber-500 text-slate-950 shadow-amber-500/30'
                              : officialRank === 2
                              ? 'bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white'
                              : officialRank === 3
                              ? 'bg-orange-500 text-white shadow-orange-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {officialRank === 1 ? '🥇 1' : officialRank === 2 ? '🥈 2' : officialRank === 3 ? '🥉 3' : `#${officialRank}`}
                          </span>

                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-black font-mono text-slate-900 dark:text-emerald-400">
                                ⏱️ {lap.formattedTime}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-amber-600 dark:text-amber-300 border border-slate-200 dark:border-slate-700">
                                س {lap.seriesNumber || 1}
                              </span>
                            </div>
                            {lap.studentName ? (
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-xs font-bold text-slate-800 dark:text-white">
                                  ✅ {lap.studentName} ({lap.schoolName})
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono font-bold">
                                  #{lap.bibNumber}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-amber-600 dark:text-amber-400 font-bold block mt-0.5 animate-pulse">
                                ⚠️ اختر صاحب المرتبة {officialRank} يدوياً ⬅️
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Manual Dropdown Selector */}
                        <div className="w-full sm:w-64 shrink-0">
                          <select
                            value={lap.participantId || ''}
                            onChange={(e) => handleAssignParticipantToLap(origIdx, e.target.value)}
                            className={`w-full px-3 py-2 rounded-xl text-xs font-bold outline-none cursor-pointer transition-all ${
                              lap.participantId
                                ? 'bg-white dark:bg-slate-900 border border-emerald-500 text-emerald-800 dark:text-emerald-300'
                                : 'bg-white dark:bg-slate-900 border-2 border-amber-500 text-amber-800 dark:text-amber-300 focus:ring-2 focus:ring-amber-400 ring-1 ring-amber-400/30'
                            }`}
                          >
                            <option value="">-- اضغط لاختيار صاحب المرتبة {officialRank} --</option>
                            {sortedParticipantsForAssignment.map(p => {
                              const att = attendanceMap[p.id];
                              const isPresent = att?.status === 'present';
                              const mark = isPresent ? '✅ ' : '';
                              const otherLap = recordedLaps.find((l, lIdx) => lIdx !== origIdx && l.participantId === p.id);
                              const assignedNote = otherLap ? ` (تم اختياره بالسلسلة ${otherLap.seriesNumber || 1})` : '';

                              return (
                                <option key={p.id} value={p.id}>
                                  {mark}#{p.bibNumber} - {p.studentName} ({p.schoolName}){assignedNote}
                                </option>
                              );
                            })}
                          </select>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                يتم حفظ كل اختيار يدوي فوراً في قائمة المراتب المعتمدة.
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssignByOrderModalOpen(false)}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  تم وحفظ التعيين
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🗑️ MODAL: CHOOSE & CONFIRM RACE DATA CLEARING (تفريغ بيانات السباق مع الاختيار والتأكيد) 🗑️ */}
      {/* ========================================================================= */}
      {isClearRaceModalOpen && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-2.5 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-600 dark:text-rose-400">
                  <RotateCcw className="w-6 h-6" />
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>تفريغ بيانات السباق وإعادة الضبط</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    اختر المسابقة التي تريد تفريغها ومسح نتائجها وتصفير الميقاتي الخاص بها
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsClearRaceModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Chips for Races with Existing Results */}
            {resultsList.filter(r => r.status === 'completed').length > 0 && (
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-700 dark:text-slate-300 block">
                  ⚡ اختيار سريع من السباقات المسجلة حالياً في قاعدة البيانات:
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                  {resultsList
                    .filter(r => r.status === 'completed')
                    .map(res => {
                      const d = disciplines.find(item => item.id === res.disciplineId);
                      const isSelected = clearRaceDisciplineId === res.disciplineId && clearRaceCategory === res.category && clearRaceGender === res.gender;
                      const lapsCount = res.trackLaps?.length || res.fieldEntries?.length || 0;

                      return (
                        <button
                          key={res.id}
                          type="button"
                          onClick={() => {
                            setClearRaceDisciplineId(res.disciplineId);
                            setClearRaceCategory(res.category as any);
                            setClearRaceGender(res.gender as any);
                            setClearConfirmedByUser(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500/30'
                              : 'bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{d?.icon || '🏅'}</span>
                          <span>{d?.nameAr || res.disciplineId}</span>
                          <span className="opacity-50">•</span>
                          <span>{res.category}</span>
                          <span>{res.gender === 'Male' ? 'ذكور' : 'إناث'}</span>
                          <span className="px-1.5 py-0.2 bg-rose-200 dark:bg-rose-900/60 rounded text-[10px] font-mono font-bold text-rose-800 dark:text-rose-200">
                            {lapsCount} نتائج
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Selectors for Discipline, Category, Gender */}
            <div className="space-y-3 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                تحديد المسابقة والفئة المراد تفريغها:
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {/* Discipline */}
                <div className="space-y-1 sm:col-span-1">
                  <span className="text-[10px] font-bold text-slate-500">المسابقة:</span>
                  <select
                    value={clearRaceDisciplineId}
                    onChange={(e) => {
                      setClearRaceDisciplineId(e.target.value);
                      setClearConfirmedByUser(false);
                    }}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    {disciplines.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.icon} {d.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500">الفئة العمرية:</span>
                  <select
                    value={clearRaceCategory}
                    onChange={(e) => {
                      setClearRaceCategory(e.target.value as any);
                      setClearConfirmedByUser(false);
                    }}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="U12">براعم (U12)</option>
                    <option value="U15">صغار (U15)</option>
                    <option value="U18">فتيان (U18)</option>
                    <option value="U20">شبان (U20)</option>
                  </select>
                </div>

                {/* Gender */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500">الجنس:</span>
                  <select
                    value={clearRaceGender}
                    onChange={(e) => {
                      setClearRaceGender(e.target.value as any);
                      setClearConfirmedByUser(false);
                    }}
                    className="w-full px-2.5 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none cursor-pointer"
                  >
                    <option value="Male">ذكور</option>
                    <option value="Female">إناث</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Selected Race Summary & Status */}
            {(() => {
              const targetDisc = disciplines.find(d => d.id === clearRaceDisciplineId);
              const targetKey = targetDisc ? `${targetDisc.id}_${clearRaceCategory}_${clearRaceGender}` : '';
              const targetResult = results[targetKey];
              const isTargetActive = activeDiscipline?.id === clearRaceDisciplineId && selectedCategory === clearRaceCategory && selectedGender === clearRaceGender;
              const hasActiveTrackLaps = isTargetActive && recordedLaps.length > 0;

              return (
                <div className="space-y-2">
                  <div className="p-3.5 bg-slate-100 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{targetDisc?.icon || '⚡'}</span>
                        <div>
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            {targetDisc?.nameAr}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-bold">
                            {clearRaceCategory} • {clearRaceGender === 'Male' ? 'ذكور' : 'إناث'}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs px-2.5 py-1 bg-slate-200 dark:bg-slate-700 font-mono font-bold rounded-lg text-slate-700 dark:text-slate-300">
                        {targetDisc?.type.startsWith('track') ? 'سباق مضمار' : 'مسابقة ميدان'}
                      </span>
                    </div>

                    {/* Data Status */}
                    {targetResult ? (
                      <div className="p-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                          <div>
                            <span className="font-black text-amber-800 dark:text-amber-300 block">
                              توجد نتائج معتمدة ومسجلة في قاعدة البيانات ({targetResult.trackLaps?.length || targetResult.fieldEntries?.length || 0} مراتب)
                            </span>
                            <span className="text-[10px] text-slate-500">
                              سجلت بواسطة: {targetResult.recordedByTeacherName || 'الحكم المسؤول'}
                            </span>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-amber-200 dark:bg-amber-900/80 text-amber-900 dark:text-amber-100 rounded text-[10px] font-black shrink-0">
                          سيتم حذفها
                        </span>
                      </div>
                    ) : hasActiveTrackLaps ? (
                      <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-xl flex items-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                        <Timer className="w-4 h-4 text-blue-600 shrink-0" />
                        <span>توجد {recordedLaps.length} وصول مسجل في الميقاتي حالياً سيتم مسحها وتصفير الميقاتي.</span>
                      </div>
                    ) : (
                      <div className="p-2 bg-slate-50 dark:bg-slate-900/60 rounded-xl text-xs text-slate-500">
                        ℹ️ هذا السباق فارغ حالياً، وسيتم تصفير أي توقيتات أو بيانات مؤقتة له.
                      </div>
                    )}
                  </div>

                  {/* Optional Options */}
                  <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-850 cursor-pointer text-xs">
                    <input
                      type="checkbox"
                      checked={clearIncludeAttendance}
                      onChange={(e) => setClearIncludeAttendance(e.target.checked)}
                      className="w-4 h-4 rounded text-rose-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      إعادة ضبط غرفة المناداة وحضور المشاركين لهذا السباق أيضاً
                    </span>
                  </label>
                </div>
              );
            })()}

            {/* Explicit Confirmation Message Box */}
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border-2 border-rose-300 dark:border-rose-900/60 rounded-2xl space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-rose-900 dark:text-rose-200">
                    تأكيد تفريغ بيانات السباق:
                  </h4>
                  <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-1 leading-relaxed">
                    سيتم مسح جميع توقيتات ومراتب الوصول المسجلة لسباق{' '}
                    <strong className="underline">
                      {disciplines.find(d => d.id === clearRaceDisciplineId)?.nameAr} ({clearRaceCategory} - {clearRaceGender === 'Male' ? 'ذكور' : 'إناث'})
                    </strong>{' '}
                    وإعادة ضبط الميقاتي للصفر. هذه العملية نهائية ولا يمكن التراجع عنها.
                  </p>
                </div>
              </div>

              <label className="flex items-center gap-2.5 p-2.5 bg-white dark:bg-slate-900 rounded-xl border border-rose-200 dark:border-rose-800/80 cursor-pointer">
                <input
                  type="checkbox"
                  checked={clearConfirmedByUser}
                  onChange={(e) => setClearConfirmedByUser(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                />
                <span className="text-xs font-black text-rose-900 dark:text-rose-200">
                  أؤكد موافقتي على تفريغ ومسح بيانات هذا السباق بالكامل
                </span>
              </label>
            </div>

            {/* Modal Footer Buttons */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsClearRaceModalOpen(false)}
                className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <span className="hidden sm:inline">إلغاء وتراجع</span>
                <span className="inline sm:hidden">إلغاء</span>
              </button>

              <button
                type="button"
                disabled={!clearConfirmedByUser}
                onClick={handleExecuteClearRace}
                className="px-4 sm:px-6 py-2 sm:py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black shadow-lg shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                title="تأكيد تفريغ بيانات السباق"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="hidden sm:inline">تأكيد تفريغ بيانات السباق</span>
                <span className="inline sm:hidden">تأكيد التفريغ</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎯 MODAL: DEMO ROSTER & TRIAL DATA GENERATOR (10 متسابقين لكل سباق وتوزيعها حسب اللجان) 🎯 */}
      {/* ========================================================================= */}
      {isDemoRosterModalOpen && (
        <div className="fixed inset-0 z-[75] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl space-y-6 animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-3xl p-3 bg-gradient-to-br from-purple-500/20 to-indigo-500/20 text-purple-600 dark:text-purple-300 border border-purple-500/30 rounded-2xl">
                  ✨
                </span>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>لوائح وبيانات التجريب الافتراضية (10 متسابقين لكل سباق وفئة وجنس)</span>
                  </h3>
                  <p className="mobile-hide-desc text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    توليد أو دمج 10 متسابقين حقيقيين في كل سباق ومسابقة، كل فئة عمرية، وكل جنس لاختبار الميقاتي، السلاسل، الترتيب، محاولات الميدان ومنصة التتويج مع إمكانية التوزيع والتطبيق حسب كل لجنة.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDemoRosterModalOpen(false)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body - Scrollable */}
            <div className="overflow-y-auto space-y-5 pr-1 flex-1">
              
              {/* Generation Mode Selector */}
              <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2.5">
                <label className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-purple-500" />
                  <span>طريقة المعالجة والدمج:</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setDemoSeedMode('replace')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      demoSeedMode === 'replace'
                        ? 'bg-purple-600/15 border-purple-500 text-purple-700 dark:text-purple-300 font-black shadow-xs ring-1 ring-purple-400/40'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-black block text-sm">🔄 استبدال شامل ونظيف</span>
                    <span className="text-[11px] opacity-80 mt-0.5 block">
                      مسح المشاركين القدامى وتوليد 10 متسابقين جدد بدقة لكل سباق وفئة وجنس.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDemoSeedMode('merge')}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                      demoSeedMode === 'merge'
                        ? 'bg-emerald-600/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-black shadow-xs ring-1 ring-emerald-400/40'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-black block text-sm">➕ دمج وإكمال (Merge)</span>
                    <span className="text-[11px] opacity-80 mt-0.5 block">
                      الاحتفاظ بالمسجلين الحاليين وإكمال أي سباق ينقصه عداؤون حتى يصل لـ 10.
                    </span>
                  </button>
                </div>
              </div>

              {/* Master Seed Card: All Committees */}
              <div className="bg-gradient-to-r from-purple-950/60 via-slate-900 to-indigo-950/60 p-5 rounded-2xl border-2 border-purple-500/40 space-y-3.5 shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl p-2 bg-purple-500/20 text-purple-300 rounded-xl">🚀</span>
                    <div>
                      <h4 className="text-sm font-black text-white">
                        توليد ودمج 10 متسابقين لكافة اللجان والمسابقات دفعة واحدة
                      </h4>
                      <p className="text-[11px] text-purple-200/80 mt-0.5">
                        يشمل جميع مسابقات الجري السريع، المسافات المتوسطة، القفز، والرمي بكافة الفئات والأجناس (86 سباقاً = 860 متسابقاً).
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSeedAllCommittees(demoSeedMode)}
                  className="w-full py-3 px-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>تطبيق التوليد الشامل لجميع اللجان (10 متسابقين في كل سباق)</span>
                </button>
              </div>

              {/* Committee by Committee Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-500" />
                    <span>توزيع وتجريب البيانات حسب كل لجنة تقنية:</span>
                  </h4>
                  <span className="text-[11px] text-slate-400 font-bold">
                    إجمالي المسجلين بالنظام حالياً: <strong className="text-purple-400">{participants.length}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {committees.filter(c => c.id !== 'podium_committee').map(comm => {
                    const stats = AthleticsService.getCommitteeParticipantStats(comm.id);
                    const commDiscs = disciplines.filter(d => d.committeeId === comm.id);

                    return (
                      <div
                        key={comm.id}
                        className="bg-white dark:bg-slate-950 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 hover:border-purple-400 dark:hover:border-purple-800/60 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl">
                                {comm.icon}
                              </span>
                              <div>
                                <h5 className="text-xs font-black text-slate-900 dark:text-white">{comm.titleAr}</h5>
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {commDiscs.length} مسابقات • {stats.eventsCount} سباقات فرعية
                                </span>
                              </div>
                            </div>
                            <span className="px-2 py-0.5 bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-lg text-[10px] font-black shrink-0">
                              {stats.totalParticipants} مسجل
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug line-clamp-2">
                            {comm.description}
                          </p>

                          <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-850 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                            <span>الهدف عند التعبئة: <strong>{stats.eventsCount * 10} متسابق</strong></span>
                            <span>(10 ذكور + 10 إناث لكل فئة)</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSeedCommittee(comm.id, comm.titleAr, demoSeedMode)}
                          className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md active:scale-95 mt-2"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                          <span>دمج 10 متسابقين لـ «{comm.titleAr.split(' ')[1] || comm.titleAr}»</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
              <span className="text-xs font-bold text-slate-400">
                يمكنك إعادة ضبط أو تفريغ البيانات في أي وقت من إعدادات المسابقات.
              </span>

              <button
                type="button"
                onClick={() => setIsDemoRosterModalOpen(false)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white border border-slate-700 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
