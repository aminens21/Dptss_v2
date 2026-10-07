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
  CheckCircle
} from 'lucide-react';
import {
  AthleticsCommitteeDef,
  AthleticsDisciplineDef,
  AthleticsCommitteeAssignment,
  CommitteeTeacherMember,
  AthleticsParticipantRecord,
  AthleticsEventResult,
  TrackRankEntry,
  FieldAttemptEntry,
  COMMITTEE_ROLE_OPTIONS
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
  // Role determination
  const isSuperOrAdmin = currentUser?.isSuperAdmin === true || 
                         currentUser?.role === 'SUPER_ADMIN' || 
                         currentUser?.role === 'CENTRAL_ADMIN' || 
                         currentUser?.role === 'SPORT_MANAGER' || 
                         currentUser?.isTechCommitteeHead === true;
  const isTeacher = currentUser?.role === 'TEACHER' && !isSuperOrAdmin;

  // Navigation Tabs: 'school_registration' | 'events' | 'committees' | 'stopwatch' | 'field' | 'podium'
  type AthleticsTab = 'school_registration' | 'events' | 'committees' | 'stopwatch' | 'field' | 'podium';
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

  // Filtered disciplines list allowed for the currently selected category & gender
  const currentCategoryGendersDisciplines = useMemo(() => {
    return disciplines.filter(d => 
      (!d.allowedCategories || d.allowedCategories.includes(selectedCategory)) &&
      (!d.allowedGenders || d.allowedGenders.includes(selectedGender))
    );
  }, [disciplines, selectedCategory, selectedGender]);

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

  // Permission Check for current user on the active event/committee
  const userAccess = useMemo(() => {
    if (!currentCommitteeDef) return { canManage: true };
    return AthleticsService.canUserManageCommittee(currentUser, currentCommitteeDef.id, assignments);
  }, [currentUser, currentCommitteeDef, assignments]);

  // Sync field trials when selecting discipline/category/gender
  useEffect(() => {
    if (!activeDiscipline) return;
    if (activeDiscipline.type.startsWith('field')) {
      const eventRes = results[currentEventKey];
      if (eventRes && eventRes.fieldEntries && eventRes.fieldEntries.length > 0) {
        setFieldTrials(eventRes.fieldEntries);
      } else {
        const registered = participants.filter(
          p => p.disciplineId === activeDiscipline.id && p.category === selectedCategory && p.gender === selectedGender
        );
        const entries: FieldAttemptEntry[] = registered.map(p => ({
          participantId: p.id,
          bibNumber: p.bibNumber,
          studentName: p.studentName,
          schoolName: p.schoolName,
          attempts: [null, null, null],
          bestAttempt: null
        }));
        setFieldTrials(entries);
      }
    } else {
      const eventRes = results[currentEventKey];
      if (eventRes && eventRes.trackLaps && eventRes.trackLaps.length > 0) {
        setRecordedLaps(eventRes.trackLaps);
      }
    }
  }, [activeDiscipline, selectedCategory, selectedGender, results, participants]);

  // Filtered Participants for Current Event
  const currentEventParticipants = useMemo(() => {
    if (!activeDiscipline) return [];
    return participants.filter(
      p => p.disciplineId === activeDiscipline.id && p.category === selectedCategory && p.gender === selectedGender
    );
  }, [participants, activeDiscipline, selectedCategory, selectedGender]);

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
    return list;
  }, [participants, selectedSchoolForView, schoolSearchQuery, schoolCategoryFilter, schoolGenderFilter]);

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
  };

  const handleResetStopwatch = () => {
    setIsTimerRunning(false);
    setElapsedMs(0);
    setRecordedLaps([]);
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

    const nextRank = recordedLaps.length + 1;
    const formatted = AthleticsService.formatMilliseconds(elapsedMs);
    const candidateParticipant = currentEventParticipants[nextRank - 1];

    const newLap: TrackRankEntry = {
      rank: nextRank,
      timeMs: elapsedMs,
      formattedTime: formatted,
      participantId: candidateParticipant?.id || '',
      bibNumber: candidateParticipant?.bibNumber || '',
      studentName: candidateParticipant?.studentName || '',
      schoolName: candidateParticipant?.schoolName || '',
      confirmed: !!candidateParticipant
    };

    const updated = [...recordedLaps, newLap];
    setRecordedLaps(updated);

    const rankTitles = ['🥇 المرتبة الأولى', '🥈 المرتبة الثانية', '🥉 المرتبة الثالثة'];
    const title = rankTitles[nextRank - 1] || `المرتبة ${nextRank}`;
    toast.success(`تم تسجيل ${title}: ${formatted}`);
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

    const eventResult: AthleticsEventResult = {
      id: currentEventKey,
      disciplineId: activeDiscipline.id,
      category: selectedCategory,
      gender: selectedGender,
      committeeId: activeDiscipline.committeeId,
      type: 'track',
      status: 'completed',
      trackLaps: recordedLaps,
      recordedByTeacherName: currentCommitteeAssignment?.teacherName || currentUser?.fullName || 'أستاذ التحكيم',
      directorateName,
      season,
      lastUpdated: new Date().toISOString()
    };

    AthleticsService.saveEventResult(eventResult);
    setResults(AthleticsService.getAllResults());
    toast.success(`تم حفظ واعتماد نتائج ${activeDiscipline.nameAr} (${selectedCategory} - ${selectedGender === 'Male' ? 'ذكور' : 'إناث'}) بنجاح!`);
    setActiveTab('podium');
  };

  // --- FIELD ATTEMPTS HANDLERS ---
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
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-7xl h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* ========================================================================= */}
        {/* MODAL HEADER WITH APP IDENTITY & SETTINGS BUTTON */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 border-b border-slate-800 px-4 sm:px-6 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 text-white flex items-center justify-center shadow-lg shadow-orange-500/20 text-2xl font-black">
              🏃‍♂️
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-white">
                  تدبير البطولة المدرسية لألعاب القوى (Athletics Manager)
                </h2>
                <span className="px-2.5 py-0.5 text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-full">
                  الموسم الرياضي {season}
                </span>

                {/* User Role & Access Status Badge */}
                {currentUser && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border flex items-center gap-1 ${
                    userAccess.canManage
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-amber-950/80 text-amber-300 border-amber-800'
                  }`}>
                    {userAccess.canManage ? <Unlock className="w-3 h-3 text-emerald-400" /> : <Lock className="w-3 h-3 text-amber-400" />}
                    <span>{userAccess.canManage ? 'صلاحية التحكيم مفعلة' : 'وضع القراءة فقط'}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-medium">
                إدارة اللجان، توزيع مهام الأساتذة، تسجيل المشاركين، والميقاتي الذكي للسباقات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            
            {/* If Teacher, prominent Action buttons */}
            {isTeacher ? (
              <>
                <button
                  type="button"
                  onClick={handleOpenAddSchoolParticipant}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  title="تسجيل تلميذ مشارك جديد لمؤسستي"
                >
                  <Plus className="w-4 h-4" />
                  <span>تسجيل مشارك جديد</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPrintRosterModalOpen(true)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                  title="طبع لائحة المشاركة الرسمية للمؤسسة"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">طبع لائحة المشاركة</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportSchoolExcel}
                  className="px-3 py-2 bg-emerald-700/80 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="تصدير لائحة المشاركين إلى ملف Excel"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
                  <span className="hidden md:inline">تصدير Excel</span>
                </button>
              </>
            ) : (
              <>
                {/* For Admins: Settings and Auto-import */}
                <button
                  onClick={() => setIsSettingsModalOpen(true)}
                  className="px-3.5 py-2 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-orange-500/20 transition-all cursor-pointer group"
                  title="إعدادات اللجان والمسابقات وتوزيع المهام"
                >
                  <SettingsIcon className="w-4 h-4 group-hover:rotate-45 transition-transform" />
                  <span>الإعدادات</span>
                </button>

                <button
                  onClick={handleTriggerAutoImport}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="مزامنة واستيراد المشاركين من المنظومة"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">مزامنة المشاركين</span>
                </button>
              </>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TOP TAB NAVIGATION BAR */}
        {/* ========================================================================= */}
        <div className="bg-slate-950 px-4 sm:px-6 py-2 border-b border-slate-800 flex items-center justify-between gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <div className="flex items-center gap-1.5">
            {/* If Teacher, ONLY show School Registration Tab */}
            {isTeacher ? (
              <button
                onClick={() => setActiveTab('school_registration')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'school_registration'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <Building className="w-4 h-4 text-emerald-200" />
                <span>تسجيل مشاركي المؤسسة واللائحة الرسمية</span>
                <span className="px-2 py-0.5 bg-emerald-500/40 text-emerald-100 rounded-full text-[10px] font-black">
                  {currentSchoolParticipants.length} مشارك
                </span>
              </button>
            ) : (
              <>
                {/* For Admins / Tech Heads: Show ALL tabs including School Registration */}
                <button
                  onClick={() => setActiveTab('school_registration')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'school_registration'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Building className="w-4 h-4" />
                  <span>لوائح ومشاركو المؤسسات</span>
                  <span className="px-1.5 py-0.2 bg-emerald-500/30 text-emerald-200 rounded text-[10px]">{participants.length}</span>
                </button>

                <button
                  onClick={() => setActiveTab('events')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'events'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                  <span>المسابقات والتخصصات</span>
                  <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-200 rounded text-[10px]">{disciplines.length}</span>
                </button>

                <button
                  onClick={() => setActiveTab('committees')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'committees'
                      ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Users className="w-4 h-4" />
                  <span>اللجان ومهام الأساتذة</span>
                  <span className="px-1.5 py-0.2 bg-amber-500/30 text-amber-200 rounded text-[10px]">{committees.length}</span>
                </button>

                <button
                  onClick={() => setActiveTab('stopwatch')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'stopwatch'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Timer className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>الميقاتي الذكي للسباقات</span>
                </button>

                <button
                  onClick={() => setActiveTab('field')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'field'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Award className="w-4 h-4" />
                  <span>مسابقات الميدان (القفز والجلة)</span>
                </button>

                <button
                  onClick={() => setActiveTab('podium')}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                    activeTab === 'podium'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>منصة التتويج والنتائج</span>
                </button>
              </>
            )}
          </div>

          {/* Quick Active Event Summary Pill */}
          {activeDiscipline && (
            <div className="hidden lg:flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs">
              <span className="text-slate-400">المسابقة:</span>
              <span className="font-black text-amber-400">{activeDiscipline.nameAr}</span>
              <span className="text-slate-600">•</span>
              <span className="font-bold text-blue-400">{selectedCategory}</span>
              <span className="text-slate-600">•</span>
              <span className="font-bold text-pink-400">{selectedGender === 'Male' ? 'ذكور' : 'إناث'}</span>
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

                  {/* Action Buttons: Add, Print, Excel */}
                  <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto">
                    <button
                      type="button"
                      onClick={handleOpenAddSchoolParticipant}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/30 cursor-pointer active:scale-98"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                      <span>تسجيل تلميذ(ة) جديد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsPrintRosterModalOpen(true)}
                      className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-600/30 cursor-pointer active:scale-98"
                    >
                      <Printer className="w-4 h-4" />
                      <span>طبع اللائحة الرسمية</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportSchoolExcel}
                      className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-700 cursor-pointer"
                      title="تصدير إلى Excel"
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
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-300">الفئة العمرية:</span>
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    {(['U12', 'U15', 'U18', 'U20'] as const).map(cat => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {cat === 'U12' ? 'براعم (U12)' : cat === 'U15' ? 'صغار (U15)' : cat === 'U18' ? 'فتيان (U18)' : 'شبان (U20)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-black text-slate-300">الجنس:</span>
                  <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      onClick={() => setSelectedGender('Male')}
                      className={`px-3.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        selectedGender === 'Male'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🏃‍♂️ ذكور
                    </button>
                    <button
                      onClick={() => setSelectedGender('Female')}
                      className={`px-3.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                        selectedGender === 'Female'
                          ? 'bg-pink-600 text-white shadow-xs'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      🏃‍♀️ إناث
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
                          ? 'bg-slate-800/90 border-blue-500 shadow-lg ring-2 ring-blue-500/20'
                          : 'bg-slate-950 hover:bg-slate-850 border-slate-800'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-2xl">{disc.icon}</span>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                              isCompleted
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
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
                                  className="p-1 bg-amber-500/10 hover:bg-amber-500 text-amber-300 hover:text-white rounded-lg transition-colors border border-amber-500/30 cursor-pointer"
                                  title="تعديل هذا السباق"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteDiscipline(disc)}
                                  className="p-1 bg-rose-500/10 hover:bg-rose-500 text-rose-300 hover:text-white rounded-lg transition-colors border border-rose-500/30 cursor-pointer"
                                  title="حذف هذا السباق"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        <h3 className="text-base font-black text-white group-hover:text-blue-400 transition-colors">
                          {disc.nameAr}
                        </h3>
                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                          {disc.nameFr} • {disc.distanceOrUnit}
                        </p>

                        <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                          <div className="flex items-center justify-between">
                            <span>اللجنة المشرفة:</span>
                            <span className="font-bold text-amber-300">{committee?.titleAr.replace('لجنة ', '')}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span>الأستاذ المسؤول:</span>
                            <span className="font-bold text-slate-200">{assignment?.teacherName || 'لم يعين بعد'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-400">
                          {partCount} مشارك مسجل
                        </span>
                        <div className="flex items-center gap-1 text-xs font-black text-blue-400 group-hover:translate-x-[-2px] transition-transform">
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950 p-4 rounded-2xl border border-slate-800">
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-amber-500" />
                    <span>اللجان وتوزيع المهام على الأساتذة المؤطرين</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    الأساتذة يتم استدعاؤهم مباشرة من قاعدة بيانات الأطر المسجلة مع تحديد دور ومهمة كل أستاذ في لجنته
                  </p>
                </div>

                <button
                  onClick={() => {
                    setIsSettingsModalOpen(true);
                    setSettingsActiveTab('committees');
                  }}
                  className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>تعديل اللجان والمهام</span>
                </button>
              </div>

              {/* Committees Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {committees.map(comm => {
                  const assignment = assignments[comm.id];
                  const commDisciplines = disciplines.filter(d => d.committeeId === comm.id);
                  const totalCommParticipants = participants.filter(p => comm.disciplines.includes(p.disciplineId)).length;
                  const members = assignment?.members || [];

                  return (
                    <div
                      key={comm.id}
                      className="bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between hover:border-slate-700 transition-all relative overflow-hidden"
                    >
                      <div>
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl p-2.5 bg-slate-900 border border-slate-800 rounded-2xl">
                              {comm.icon}
                            </span>
                            <div>
                              <h4 className="text-base font-black text-white">{comm.titleAr}</h4>
                              <p className="text-xs text-slate-400 font-mono">{comm.titleFr}</p>
                            </div>
                          </div>
                          <span className="px-2.5 py-1 text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-xl">
                            {commDisciplines.length} مسابقات
                          </span>
                        </div>

                        {/* Head of Committee */}
                        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 mb-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>رئيس اللجنة الرئيسي:</span>
                            </span>
                            <span className="text-xs font-black text-amber-400">
                              {assignment?.teacherName || 'لم يعين بعد'}
                            </span>
                          </div>
                          {assignment?.teacherSchool && (
                            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                              🏢 {assignment.teacherSchool}
                            </p>
                          )}
                        </div>

                        {/* Members & Tasks in Committee */}
                        <div className="space-y-1.5 mb-4">
                          <span className="text-[11px] text-slate-400 font-bold block">
                            طاقم التحكيم والمهام المحددة ({members.length} أستاذ):
                          </span>
                          {members.length === 0 ? (
                            <p className="text-[11px] text-slate-500 italic">
                              لم يتم تعيين أعضاء إضافيين بعد. افتح الإعدادات لإضافة أساتذة وتحديد مهامهم.
                            </p>
                          ) : (
                            <div className="space-y-1.5">
                              {members.map((m, idx) => (
                                <div
                                  key={idx}
                                  className="px-3 py-1.5 bg-slate-900/80 border border-slate-800/80 rounded-xl flex items-center justify-between text-xs"
                                >
                                  <div>
                                    <span className="font-bold text-white block">{m.teacherName}</span>
                                    {m.schoolName && (
                                      <span className="text-[10px] text-slate-400">{m.schoolName}</span>
                                    )}
                                  </div>
                                  <span className="px-2 py-0.5 bg-blue-950/80 border border-blue-800 text-blue-300 rounded-lg text-[10px] font-black">
                                    {m.roleInCommittee}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400">
                          👥 إجمالي المشاركين: <span className="text-white font-black">{totalCommParticipants}</span>
                        </span>
                        <button
                          onClick={() => handleOpenCommitteeEdit(comm)}
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-amber-400" />
                          <span>تعديل الطاقم والمهام</span>
                        </button>
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
              
              {/* Event Selector & Info Header */}
              <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-3 bg-emerald-950/60 border border-emerald-800 rounded-2xl text-emerald-400">
                    ⚡
                  </span>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-white">
                        {activeDiscipline.nameAr}
                      </h3>
                      <span className="px-2.5 py-0.5 text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg">
                        {selectedCategory}
                      </span>
                      <span className="px-2.5 py-0.5 text-xs font-black bg-pink-500/20 text-pink-300 border border-pink-500/30 rounded-lg">
                        {selectedGender === 'Male' ? 'ذكور' : 'إناث'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      الأستاذ المسؤول: <span className="text-amber-400 font-bold">{currentCommitteeAssignment?.teacherName || 'غير معين'}</span>
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
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    {currentCategoryGendersDisciplines.filter(d => d.type.startsWith('track')).map(d => (
                      <option key={d.id} value={d.id}>{d.nameAr}</option>
                    ))}
                  </select>

                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value as any)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    <option value="U12">براعم (U12)</option>
                    <option value="U15">صغار (U15)</option>
                    <option value="U18">فتيان (U18)</option>
                    <option value="U20">شبان (U20)</option>
                  </select>

                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value as any)}
                    className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer"
                  >
                    <option value="Male">ذكور</option>
                    <option value="Female">إناث</option>
                  </select>

                  {!isTeacher && activeDiscipline && (
                    <button
                      type="button"
                      onClick={() => {
                        handleStartEditDiscipline(activeDiscipline);
                        setIsSettingsModalOpen(true);
                        setSettingsActiveTab('disciplines');
                      }}
                      className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-300 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="تعديل بيانات هذا السباق"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل هذا السباق</span>
                    </button>
                  )}
                </div>
              </div>

              {/* --- BIG SMART STOPWATCH CONSOLE --- */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left (Stopwatch Screen & Main Trigger Button) */}
                <div className="lg:col-span-6 bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-emerald-900/60 rounded-3xl p-6 flex flex-col items-center justify-between shadow-2xl space-y-6">
                  
                  {/* Digital Clock Display */}
                  <div className="w-full text-center py-6 bg-slate-950/80 border border-slate-800 rounded-2xl shadow-inner relative overflow-hidden">
                    <span className="text-xs font-mono font-bold text-emerald-500 uppercase tracking-wider block mb-1">
                      CHRONO SMART CHIPS • 1/100s
                    </span>
                    <div className="text-5xl sm:text-6xl font-black font-mono tracking-tight text-white select-none">
                      {AthleticsService.formatMilliseconds(elapsedMs)}
                    </div>
                    {isTimerRunning && (
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 mt-2 bg-emerald-950/80 px-3 py-0.5 rounded-full border border-emerald-700 animate-pulse">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span>السباق جاري والتوقيت نشط</span>
                      </div>
                    )}
                  </div>

                  {/* Stopwatch Base Controls (Start / Stop / Reset) */}
                  <div className="flex items-center gap-3 w-full">
                    {!isTimerRunning ? (
                      <button
                        onClick={handleStartStopwatch}
                        className="flex-1 py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 cursor-pointer transition-all"
                      >
                        <Play className="w-5 h-5 fill-white" />
                        <span>{elapsedMs === 0 ? 'إطلاق الميقاتي (Départ)' : 'استئناف التوقيت'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleStopStopwatch}
                        className="flex-1 py-3.5 px-4 bg-rose-600 hover:bg-rose-700 active:scale-98 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer transition-all"
                      >
                        <Square className="w-5 h-5 fill-white" />
                        <span>إيقاف الميقاتي</span>
                      </button>
                    )}

                    <button
                      onClick={handleResetStopwatch}
                      disabled={isTimerRunning && elapsedMs > 0}
                      className="py-3.5 px-4 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-2xl font-black text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                      title="إعادة ضبط الصفر"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>تصفير</span>
                    </button>
                  </div>

                  {/* ⭐ THE REQUESTED SMART ONE-TAP MULTI-RANK BUTTON ⭐ */}
                  <div className="w-full pt-2">
                    <button
                      onClick={handleTriggerRankSplit}
                      disabled={!isTimerRunning && elapsedMs === 0}
                      className="w-full py-6 px-4 bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 hover:from-amber-400 hover:to-rose-500 active:scale-97 disabled:opacity-50 text-white rounded-3xl font-black text-lg sm:text-xl flex flex-col items-center justify-center gap-1 shadow-2xl shadow-orange-600/30 transition-all cursor-pointer ring-4 ring-orange-500/20"
                    >
                      <div className="flex items-center gap-2">
                        <Flag className="w-6 h-6 animate-bounce" />
                        <span>
                          {recordedLaps.length === 0
                            ? '🥇 تسجيل المرتبة الأولى (1st)'
                            : recordedLaps.length === 1
                            ? '🥈 تسجيل المرتبة الثانية (2nd)'
                            : recordedLaps.length === 2
                            ? '🥉 تسجيل المرتبة الثالثة (3rd)'
                            : `تسجيل المرتبة (${recordedLaps.length + 1})`}
                        </span>
                      </div>
                      <span className="text-xs text-orange-100 font-medium">
                        اضغط عند وصول العداء لخط النهاية لحفظ توقيته آلياً
                      </span>
                    </button>
                  </div>

                  {/* Summary info */}
                  <div className="w-full text-center text-xs text-slate-400 font-bold">
                    تم تسجيل <span className="text-emerald-400 font-black">{recordedLaps.length}</span> مرتبة حتى الآن
                  </div>
                </div>

                {/* Right (Recorded Ranks & Fast Participant Assignment) */}
                <div className="lg:col-span-6 bg-slate-950 border border-slate-800 rounded-3xl p-5 flex flex-col justify-between space-y-4">
                  
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Trophy className="w-5 h-5 text-amber-500" />
                        <h4 className="text-sm font-black text-white">المراتب المسجلة وتعيين التلاميذ</h4>
                      </div>
                      <span className="text-xs font-bold text-slate-400">
                        {recordedLaps.length} وصول مسجل
                      </span>
                    </div>

                    {/* Laps List */}
                    {recordedLaps.length === 0 ? (
                      <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-2">
                        <Timer className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-xs font-bold text-slate-400">لم يتم تسجيل أي توقيت بعد</p>
                        <p className="text-[11px] text-slate-500">
                          أطلق الميقاتي واضغط على الزر البرتقالي الموحد عند وصول كل عداء
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                        {recordedLaps.map((lap, idx) => (
                          <div
                            key={idx}
                            className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              idx === 0
                                ? 'bg-amber-950/40 border-amber-800/80 ring-1 ring-amber-500/30'
                                : idx === 1
                                ? 'bg-slate-850 border-slate-700'
                                : idx === 2
                                ? 'bg-orange-950/30 border-orange-900/60'
                                : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                                idx === 0
                                  ? 'bg-amber-500 text-slate-950'
                                  : idx === 1
                                  ? 'bg-slate-300 text-slate-900'
                                  : idx === 2
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-slate-800 text-slate-300'
                              }`}>
                                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${lap.rank}`}
                              </span>

                              <div>
                                <span className="text-sm font-black font-mono text-emerald-400 block">
                                  {lap.formattedTime}
                                </span>
                                {lap.studentName ? (
                                  <span className="text-xs font-bold text-white block">
                                    {lap.studentName} ({lap.schoolName})
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-amber-400/80 font-bold block">
                                    ⚠️ يرجى تعيين التلميذ
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Participant Selector Dropdown */}
                            <div className="w-full sm:w-auto shrink-0">
                              <select
                                value={lap.participantId || ''}
                                onChange={(e) => handleAssignParticipantToLap(idx, e.target.value)}
                                className="w-full sm:w-48 px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs font-bold text-white cursor-pointer"
                              >
                                <option value="">-- تعيين العداء --</option>
                                {participants
                                  .filter(p => p.disciplineId === activeDiscipline.id && p.category === selectedCategory && p.gender === selectedGender)
                                  .map(p => (
                                    <option key={p.id} value={p.id}>
                                      #{p.bibNumber} - {p.studentName} ({p.schoolName})
                                    </option>
                                  ))}
                              </select>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Save Final Race Button */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
                    <button
                      onClick={() => setIsAddParticipantOpen(true)}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-blue-400" />
                      <span>إضافة عداء</span>
                    </button>

                    <button
                      onClick={handleSaveTrackResults}
                      disabled={recordedLaps.length === 0}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center gap-2 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ واعتماد نتائج السباق</span>
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
              <div className="bg-slate-950 p-4 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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

                <div className="flex items-center gap-2 flex-wrap">
                  {currentCategoryGendersDisciplines.filter(d => d.type.startsWith('field')).map(disc => (
                    <button
                      key={disc.id}
                      onClick={() => setSelectedDiscipline(disc)}
                      className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        activeDiscipline?.id === disc.id
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      {disc.icon} {disc.nameAr}
                    </button>
                  ))}

                  {!isTeacher && activeDiscipline && (
                    <button
                      type="button"
                      onClick={() => {
                        handleStartEditDiscipline(activeDiscipline);
                        setIsSettingsModalOpen(true);
                        setSettingsActiveTab('disciplines');
                      }}
                      className="px-3 py-2 bg-amber-500/20 hover:bg-amber-500 border border-amber-500/40 text-amber-300 hover:text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                      title="تعديل بيانات هذه المسابقة"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل المسابقة</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Field Attempts Matrix */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black text-white">جدول المحاولات والنتائج (3 محاولات قانونية)</h4>
                    <p className="text-xs text-slate-500 font-medium">
                      أدخل المسافة بالمتر (مثال: 4.85) أو حرف X للمحاولة الملغاة.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsAddParticipantOpen(true)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-400" />
                    <span>إضافة متسابق</span>
                  </button>
                </div>

                {fieldTrials.length === 0 ? (
                  <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-2">
                    <p className="text-xs font-bold text-slate-400">لا يوجد متسابقون مسجلون في هذه المسابقة</p>
                    <button
                      onClick={() => setIsAddParticipantOpen(true)}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer"
                    >
                      إضافة متسابق الآن
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead>
                        <tr className="bg-slate-900 text-slate-400 font-black border-b border-slate-800">
                          <th className="py-3 px-3 text-center">الرتبة</th>
                          <th className="py-3 px-3">الصدرية</th>
                          <th className="py-3 px-3">اسم التلميذ(ة)</th>
                          <th className="py-3 px-3">المؤسسة التعليمية</th>
                          <th className="py-3 px-3 text-center">المحاولة 1 (م)</th>
                          <th className="py-3 px-3 text-center">المحاولة 2 (م)</th>
                          <th className="py-3 px-3 text-center">المحاولة 3 (م)</th>
                          <th className="py-3 px-3 text-center text-amber-400">أفضل إنجاز (م)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 font-medium">
                        {fieldTrials.map((entry, eIdx) => (
                          <tr key={entry.participantId || eIdx} className="hover:bg-slate-900/50 transition-colors">
                            <td className="py-3 px-3 text-center font-black">
                              {entry.rank === 1 ? '🥇 1' : entry.rank === 2 ? '🥈 2' : entry.rank === 3 ? '🥉 3' : (entry.rank ? `#${entry.rank}` : '-')}
                            </td>
                            <td className="py-3 px-3 font-mono font-bold text-slate-300">
                              #{entry.bibNumber}
                            </td>
                            <td className="py-3 px-3 font-bold text-white">
                              {entry.studentName}
                            </td>
                            <td className="py-3 px-3 text-slate-400">
                              {entry.schoolName}
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
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 flex items-center justify-end">
                  <button
                    onClick={handleSaveFieldResults}
                    disabled={fieldTrials.length === 0}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>حفظ واعتماد نتائج {activeDiscipline.nameAr}</span>
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
              
              {/* Podium View Card */}
              <div className="bg-slate-950 border border-slate-800 rounded-3xl p-6 text-center space-y-6">
                <div>
                  <h3 className="text-xl font-black text-white flex items-center justify-center gap-2">
                    <Trophy className="w-6 h-6 text-amber-400" />
                    <span>منصة التتويج والنتائج المعتمدة (Podium)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {activeDiscipline.nameAr} • {selectedCategory} • {selectedGender === 'Male' ? 'ذكور' : 'إناث'}
                  </p>
                </div>

                {/* 3 Step Podium */}
                {currentEventResult ? (
                  <div className="pt-8 pb-4 flex items-end justify-center gap-3 sm:gap-6 max-w-2xl mx-auto">
                    
                    {/* 2nd Place */}
                    <div className="flex-1 flex flex-col items-center">
                      <div className="text-2xl mb-1">🥈</div>
                      <span className="text-xs font-black text-slate-300">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[1]?.studentName || 'لا يوجد'
                          : currentEventResult.fieldEntries?.[1]?.studentName || 'لا يوجد'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[1]?.schoolName
                          : currentEventResult.fieldEntries?.[1]?.schoolName}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300 mt-1">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[1]?.formattedTime
                          : currentEventResult.fieldEntries?.[1]?.bestAttempt ? `${currentEventResult.fieldEntries[1].bestAttempt}م` : ''}
                      </span>
                      <div className="w-full h-24 bg-gradient-to-t from-slate-800 to-slate-700 rounded-t-2xl border-t-2 border-slate-400 flex items-center justify-center text-slate-200 font-black text-lg mt-2">
                        2
                      </div>
                    </div>

                    {/* 1st Place (Champion) */}
                    <div className="flex-1 flex flex-col items-center -translate-y-4">
                      <div className="text-4xl mb-1 animate-bounce">👑</div>
                      <span className="text-sm font-black text-amber-300">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[0]?.studentName || 'لا يوجد'
                          : currentEventResult.fieldEntries?.[0]?.studentName || 'لا يوجد'}
                      </span>
                      <span className="text-xs text-amber-500/80 font-bold truncate max-w-[140px]">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[0]?.schoolName
                          : currentEventResult.fieldEntries?.[0]?.schoolName}
                      </span>
                      <span className="text-sm font-mono font-black text-amber-400 mt-1">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[0]?.formattedTime
                          : currentEventResult.fieldEntries?.[0]?.bestAttempt ? `${currentEventResult.fieldEntries[0].bestAttempt}م` : ''}
                      </span>
                      <div className="w-full h-32 bg-gradient-to-t from-amber-600 to-amber-500 rounded-t-2xl border-t-2 border-amber-300 flex items-center justify-center text-slate-950 font-black text-2xl mt-2 shadow-lg shadow-amber-500/30">
                        1 🥇
                      </div>
                    </div>

                    {/* 3rd Place */}
                    <div className="flex-1 flex flex-col items-center">
                      <div className="text-2xl mb-1">🥉</div>
                      <span className="text-xs font-black text-orange-300">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[2]?.studentName || 'لا يوجد'
                          : currentEventResult.fieldEntries?.[2]?.studentName || 'لا يوجد'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-bold truncate max-w-[120px]">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[2]?.schoolName
                          : currentEventResult.fieldEntries?.[2]?.schoolName}
                      </span>
                      <span className="text-xs font-mono font-bold text-orange-400 mt-1">
                        {currentEventResult.type === 'track'
                          ? currentEventResult.trackLaps?.[2]?.formattedTime
                          : currentEventResult.fieldEntries?.[2]?.bestAttempt ? `${currentEventResult.fieldEntries[2].bestAttempt}م` : ''}
                      </span>
                      <div className="w-full h-18 bg-gradient-to-t from-orange-800 to-orange-700 rounded-t-2xl border-t-2 border-orange-400 flex items-center justify-center text-orange-100 font-black text-base mt-2">
                        3
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl">
                    <p className="text-xs font-bold text-slate-400">
                      لم يتم اعتماد نتائج هذه المسابقة بعد. قم بفتح الميقاتي أو جدول المحاولات وحفظ النتائج أولاً.
                    </p>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-800 flex items-center justify-center gap-3">
                  <button
                    onClick={() => window.print()}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-amber-400" />
                    <span>طباعة المحضر الرسمي للبطولة</span>
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

                <button
                  onClick={() => setSettingsActiveTab('auto_import')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    settingsActiveTab === 'auto_import'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔄 استيراد ومزامنة المشاركين
                </button>
              </div>

              {/* Settings Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">

                {/* TAB A: COMMITTEES & TEACHER TASKS */}
                {settingsActiveTab === 'committees' && (
                  <div className="space-y-6">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                      <h4 className="text-sm font-black text-white mb-1">
                        اختيار الأساتذة وتحديد مهامهم من قاعدة بيانات المنظومة
                      </h4>
                      <p className="text-xs text-slate-400">
                        اختر أي لجنة لتعديل طاقمها، وتعيين أساتذة التربية البدنية المسجلين وتحديد مهمة كل أستاذ بدقة.
                      </p>
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

                {/* TAB C: AUTO IMPORT & SYNC */}
                {settingsActiveTab === 'auto_import' && (
                  <div className="bg-slate-950 p-6 rounded-3xl border border-slate-800 text-center space-y-4 max-w-xl mx-auto">
                    <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto text-2xl">
                      🔄
                    </div>
                    <div>
                      <h4 className="text-base font-black text-white">الاستيراد التلقائي للمشاركين من المنظومة</h4>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                        تقوم هذه الخاصية بالبحث في قاعدة بيانات التلاميذ المسجلين من طرف الأساتذة والمؤسسات في تخصصات ألعاب القوى والعدو، وإدراجهم وتوزيعهم تلقائياً على المسابقات المتوافقة مع فئاتهم العمرية وجنسهم.
                      </p>
                    </div>

                    <div className="p-4 bg-slate-900 rounded-2xl border border-slate-850 text-xs text-slate-300 flex items-center justify-around">
                      <div>
                        <span className="text-slate-500 block">التلاميذ في المنظومة:</span>
                        <span className="text-base font-black text-white">{students.length}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">المشاركون الحاليون:</span>
                        <span className="text-base font-black text-emerald-400">{participants.length}</span>
                      </div>
                    </div>

                    <button
                      onClick={handleTriggerAutoImport}
                      className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 mx-auto cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>بدء الاستيراد والمزامنة التلقائية الآن</span>
                    </button>
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
              <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-[11px] text-emerald-200 flex items-start gap-2">
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
    </div>
  );
};
