import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  DataService,
  SPORTS_MAP,
  GENDER_MAP,
  areSportIdsEquivalent,
  deduplicateById,
  findMatchingSchoolForTeacher,
  resolveEffectiveTeacherCadre,
  isTeacherLevelAllowedForTournament,
  isCrossCountryU15OpenToPrimary,
  isSchoolSectorAllowedForTournament,
  isAffiliationAllowedByDisplayConfig,
  isClubTournament,
  isPrivateSchoolRecord
} from '../lib/dataService';
import { User, Sport, Tournament, Match, School, AffiliationDisplayConfig } from '../types';
import {
  ShieldCheck,
  Search,
  Plus,
  Trash2,
  Mail,
  Phone,
  MapPin,
  X,
  Trophy,
  RefreshCw,
  AlertCircle,
  Users,
  UserPlus,
  Edit2,
  Award,
  MessageCircle,
  Eye,
  LogIn,
  Calendar,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  BadgeCheck
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getWhatsAppUrl } from '../lib/whatsappService';

export const TechCommitteeHeads: React.FC = () => {
  const { userProfile, startTeacherImpersonation, isImpersonatingTeacher } = useAuth();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states for Heads
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editingHeadId, setEditingHeadId] = useState<string | null>(null);
  const [headTeacherSearch, setHeadTeacherSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States for confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'head' | 'member';
    id: string;
    sportKey?: string;
    name: string;
    title: string;
    message: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // States for Members
  const [addingMemberSport, setAddingMemberSport] = useState<string | null>(null);
  const [selectedMemberTeacherId, setSelectedMemberTeacherId] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Dedicated Member Modal for the Central Manager (المسير)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedMemberSport, setSelectedMemberSport] = useState('');
  const [selectedMemberIdForModal, setSelectedMemberIdForModal] = useState('');
  const [memberTeacherSearch, setMemberTeacherSearch] = useState('');
  const [isSubmittingMemberModal, setIsSubmittingMemberModal] = useState(false);
  const [viewingMembersHead, setViewingMembersHead] = useState<User | null>(null);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [affiliationDisplayConfig, setAffiliationDisplayConfig] = useState<AffiliationDisplayConfig>(
    () => DataService.getAffiliationDisplayConfigSync()
  );

  const effectiveSportsMap = useMemo(() => {
    const map: Record<string, { name: string; icon: string }> = { ...SPORTS_MAP };
    sportsConfig.forEach((s: Sport) => {
      if (s.id) {
        map[s.id] = { name: s.name, icon: s.icon };
      }
    });
    return map;
  }, [sportsConfig, SPORTS_MAP]);

  const isCentralAdmin = userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.isSuperAdmin || userProfile?.role === 'SPORT_MANAGER';
  const canManageTechCommittee = isCentralAdmin;
  const canImpersonateTechHead = Boolean(
    (userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.isSuperAdmin) && !isImpersonatingTeacher
  );

  const handleEnterAsTechHead = (head: User) => {
    startTeacherImpersonation(head, { preserveTechCommitteeRole: true });
    toast.success(`تم الدخول بصفة رئيس اللجنة التقنية ${head.fullName} مع الحفاظ على صفتك الأصلية`);
    navigate('/tournaments');
  };

  useEffect(() => {
    loadData();
    const handleDirChange = () => {
      loadData();
    };
    window.addEventListener('directorateChanged', handleDirChange);
    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
      const [allTeachers, allSports, allTournaments, allMatches, allSchools, activeSeason, affConfig] = await Promise.all([
        DataService.getTeachers(),
        DataService.getSportsConfig(),
        DataService.getTournaments().catch(() => [] as Tournament[]),
        DataService.getMatches().catch(() => [] as Match[]),
        DataService.getSchools().catch(() => [] as School[]),
        DataService.getActiveSeason().catch(() => ''),
        DataService.getAffiliationDisplayConfig().catch(() => DataService.getAffiliationDisplayConfigSync())
      ]);
      const dirTeachers = allTeachers.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      const dirTournaments = deduplicateById(allTournaments).filter(t =>
        (t.directorateId || 'taourirt') === activeDirId &&
        t.status !== 'Draft' &&
        (t as any).isActive !== false &&
        (!activeSeason || !t.seasonId || t.seasonId === activeSeason)
      );
      const dirMatches = allMatches.filter(m => !m.directorateId || m.directorateId === activeDirId);
      setTeachers(dirTeachers);
      setSportsConfig(allSports);
      setTournaments(dirTournaments);
      setMatches(dirMatches);
      setSchools(allSchools.filter(s => !s.directorateId || s.directorateId === activeDirId));
      setAffiliationDisplayConfig(affConfig);
    } catch (error) {
      console.error('Error loading teachers data:', error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveMemberModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberSport) {
      toast.error('يرجى اختيار الصنف الرياضي');
      return;
    }
    if (!selectedMemberIdForModal) {
      toast.error('يرجى اختيار الأستاذ المعني');
      return;
    }

    setIsSubmittingMemberModal(true);
    try {
      const teacherToUpdate = teachers.find(t => t.id === selectedMemberIdForModal);
      if (teacherToUpdate) {
        const currentSports = teacherToUpdate.techCommitteeSportsMemberOf || [];
        const updatedSports = [...new Set([...currentSports, selectedMemberSport])];
        
        await DataService.updateUserProfile(teacherToUpdate.id, {
          isTechCommitteeMember: true,
          techCommitteeSportsMemberOf: updatedSports
        });

        const sportInfo = effectiveSportsMap[selectedMemberSport]?.name || '';
        toast.success(`تمت إضافة الأستاذ ${teacherToUpdate.fullName} كعضو في لجنة ${sportInfo} بنجاح`);
        setIsMemberModalOpen(false);
        setSelectedMemberSport('');
        setSelectedMemberIdForModal('');
        loadData();
      }
    } catch (err) {
      console.error('Error adding tech committee member:', err);
      toast.error('حدث خطأ أثناء إضافة العضو للجنة الرياضية');
    } finally {
      setIsSubmittingMemberModal(false);
    }
  };

  // Detect if viewer is a pure Teacher (not Central Admin / Tech Head) and resolve their educational cycle
  const mergedViewerProfile = useMemo(() => {
    if (!userProfile) return null;
    const dirMatch = teachers.find(t =>
      (t.id && t.id === userProfile.id) ||
      (t.email && userProfile.email && t.email.trim().toLowerCase() === userProfile.email.trim().toLowerCase()) ||
      (t.leaseNumber && userProfile.leaseNumber && t.leaseNumber.trim() === userProfile.leaseNumber.trim())
    );
    if (!dirMatch) return userProfile;
    return {
      ...dirMatch,
      ...userProfile,
      workLocation: userProfile.workLocation || dirMatch.workLocation,
      schoolId: userProfile.schoolId || dirMatch.schoolId,
      teachingCadre: userProfile.teachingCadre || dirMatch.teachingCadre
    };
  }, [userProfile, teachers]);

  const teacherSchoolObj = useMemo(() => {
    return findMatchingSchoolForTeacher(schools, mergedViewerProfile);
  }, [schools, mergedViewerProfile]);

  const effectiveTeacherCadre = useMemo(() => {
    return resolveEffectiveTeacherCadre(mergedViewerProfile, teacherSchoolObj);
  }, [mergedViewerProfile, teacherSchoolObj]);

  const isScopedTeacher = useMemo(() => {
    if (!userProfile || userProfile.role !== 'TEACHER') return false;
    if (isCentralAdmin) return false;
    const isSelfHead = Boolean(
      userProfile.isTechCommitteeHead ||
      (userProfile.role as string) === 'TECH_HEAD' ||
      (userProfile.role as string) === 'TECH_COMMITTEE_HEAD'
    );
    if (isSelfHead) return false;
    return true;
  }, [userProfile, isCentralAdmin]);

  const teacherCycleLabels = useMemo(() => {
    if (isPrivateSchoolRecord(teacherSchoolObj)) {
      return { full: 'التعليم الخصوصي (الأسلاك الثلاثة)', short: 'التعليم الخصوصي' };
    }
    if (effectiveTeacherCadre === 'Primary') {
      return { full: 'التعليم الابتدائي', short: 'الابتدائي' };
    }
    if (effectiveTeacherCadre === 'Middle') {
      return { full: 'التعليم الثانوي الإعدادي', short: 'الإعدادي' };
    }
    if (effectiveTeacherCadre === 'High') {
      return { full: 'التعليم الثانوي التأهيلي', short: 'التأهيلي' };
    }
    return { full: 'سلك مؤسستك التعليمي', short: 'سلكك التعليمي' };
  }, [effectiveTeacherCadre, teacherSchoolObj]);

  // Regional school championships that the signed-in teacher's cycle/sector is eligible to participate in
  const eligibleTeacherTournaments = useMemo(() => {
    if (!isScopedTeacher) return tournaments;
    const activeTourns = tournaments.filter(t => t.status !== 'Draft' && (t as any).isActive !== false);
    return activeTourns.filter(t => {
      const tAff = t.affiliationType || (isClubTournament(t) ? 'club_affiliated' : 'non_club');
      if (!isAffiliationAllowedByDisplayConfig(tAff, affiliationDisplayConfig, t.sportId)) return false;
      const levelOk =
        isTeacherLevelAllowedForTournament(effectiveTeacherCadre, t.level, t.ageCategory, t.sportId) ||
        (effectiveTeacherCadre === 'Primary' && isCrossCountryU15OpenToPrimary(t, activeTourns));
      if (!levelOk) return false;
      if (teacherSchoolObj && !isSchoolSectorAllowedForTournament(teacherSchoolObj, t)) return false;
      return true;
    });
  }, [isScopedTeacher, tournaments, affiliationDisplayConfig, effectiveTeacherCadre, teacherSchoolObj]);

  const doesHeadOverseeTournament = (head: User, t: Tournament): boolean => {
    const headSports = Array.from(new Set([
      ...(head.techCommitteeSports || []),
      ...(head.sportId ? [head.sportId] : [])
    ].filter(Boolean)));
    const sportMatch = headSports.some(sk => areSportIdsEquivalent(t.sportId, sk, sportsConfig));
    const emailMatch = Boolean(t.managerEmail && head.email && t.managerEmail.toLowerCase() === head.email.toLowerCase());
    const nameMatch = Boolean(t.managerName && head.fullName && t.managerName.trim() === head.fullName.trim());
    return sportMatch || emailMatch || nameMatch;
  };

  const getVisibleTournamentsForHead = (head: User): Tournament[] => {
    const pool = isScopedTeacher ? eligibleTeacherTournaments : tournaments;
    return pool.filter(t => doesHeadOverseeTournament(head, t));
  };

  const getVisibleSportKeysForHead = (head: User): string[] => {
    const rawKeys = head.techCommitteeSports || [];
    if (!isScopedTeacher) return rawKeys;
    const eligibleFromAssigned = rawKeys.filter(sk =>
      eligibleTeacherTournaments.some(t => areSportIdsEquivalent(t.sportId, sk, sportsConfig))
    );
    if (eligibleFromAssigned.length > 0) return eligibleFromAssigned;
    return Array.from(new Set(getVisibleTournamentsForHead(head).map(t => t.sportId).filter(Boolean)));
  };

  // Tech committee heads list (scoped for regular teachers to their eligible championships only)
  const heads = teachers.filter(t => t.isTechCommitteeHead);
  const scopedHeads = useMemo(() => {
    if (!isScopedTeacher) return heads;
    return heads.filter(h => getVisibleTournamentsForHead(h).length > 0);
  }, [heads, isScopedTeacher, eligibleTeacherTournaments, sportsConfig]);

  // Filtered heads based on search term
  const filteredHeads = scopedHeads.filter(h => {
    const visibleSports = getVisibleSportKeysForHead(h);
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      h.fullName.toLowerCase().includes(q) ||
      h.email.toLowerCase().includes(q) ||
      (h.workLocation && h.workLocation.toLowerCase().includes(q)) ||
      visibleSports.some(s => {
        const sportInfo = effectiveSportsMap[s];
        return sportInfo && sportInfo.name.toLowerCase().includes(q);
      });
    return matchesSearch;
  });

  const handleOpenAssignModal = () => {
    setIsEditing(false);
    setEditingHeadId(null);
    setSelectedTeacherId('');
    setSelectedSports([]);
    setHeadTeacherSearch('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (head: User) => {
    setIsEditing(true);
    setEditingHeadId(head.id);
    setSelectedTeacherId(head.id);
    setSelectedSports(head.techCommitteeSports || []);
    setHeadTeacherSearch('');
    setIsModalOpen(true);
  };

  const handleToggleSport = (sportKey: string) => {
    setSelectedSports(prev =>
      prev.includes(sportKey) ? prev.filter(k => k !== sportKey) : [...prev, sportKey]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId) {
      toast.error('يرجى اختيار الأستاذ المعني أولاً');
      return;
    }
    if (selectedSports.length === 0) {
      toast.error('يرجى تحديد تخصص رياضي واحد على الأقل للجنة التقنية');
      return;
    }

    setIsSubmitting(true);
    try {
      // If editing an existing head and the user chose a replacement teacher, revoke the previous head first
      if (isEditing && editingHeadId && editingHeadId !== selectedTeacherId) {
        await DataService.updateUserProfile(editingHeadId, {
          isTechCommitteeHead: false,
          techCommitteeSports: []
        });
      }

      await DataService.updateUserProfile(selectedTeacherId, {
        isTechCommitteeHead: true,
        techCommitteeSports: selectedSports
      });

      const msg =
        isEditing && editingHeadId && editingHeadId !== selectedTeacherId
          ? 'تم تعويض رئيس اللجنة التقنية وتحديث الصلاحيات بنجاح'
          : isEditing
          ? 'تم تحديث تعيين رئيس اللجنة التقنية بنجاح'
          : 'تم تعيين رئيس لجنة تقنية جديد بنجاح';
      toast.success(msg);
      setIsModalOpen(false);
      loadData();
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحديث التعيين');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = (headId: string, headName: string) => {
    setDeleteConfirm({
      isOpen: true,
      type: 'head',
      id: headId,
      name: headName,
      title: 'تأكيد إلغاء تعيين رئيس اللجنة التقنية',
      message: `هل أنت متأكد من رغبتك في إلغاء تعيين الأستاذ "${headName}" كرئيس للجنة التقنية وحذف صلاحياته الإشرافية؟`
    });
  };

  // Member Operations
  const handleAddMember = async (sportKey: string) => {
    if (!selectedMemberTeacherId) {
      toast.error('يرجى اختيار أستاذ أولاً');
      return;
    }

    setIsAddingMember(true);
    try {
      const teacherToUpdate = teachers.find(t => t.id === selectedMemberTeacherId);
      if (teacherToUpdate) {
        const currentSports = teacherToUpdate.techCommitteeSportsMemberOf || [];
        const updatedSports = [...new Set([...currentSports, sportKey])];
        
        await DataService.updateUserProfile(teacherToUpdate.id, {
          isTechCommitteeMember: true,
          techCommitteeSportsMemberOf: updatedSports
        });

        toast.success(`تمت إضافة الأستاذ ${teacherToUpdate.fullName} كعضو لجنة تقنية بنجاح`);
        setAddingMemberSport(null);
        setSelectedMemberTeacherId('');
        loadData();
      }
    } catch (err) {
      console.error('Error adding tech committee member:', err);
      toast.error('حدث خطأ أثناء إضافة العضو');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = (teacherId: string, sportKey: string, teacherName: string) => {
    const sportName = effectiveSportsMap[sportKey]?.name || 'هذا الصنف الرياضي';
    setDeleteConfirm({
      isOpen: true,
      type: 'member',
      id: teacherId,
      sportKey,
      name: teacherName,
      title: 'تأكيد إزالة عضو من اللجنة التقنية',
      message: `هل أنت متأكد من رغبتك في إزالة الأستاذ "${teacherName}" من عضوية اللجنة التقنية لرياضة (${sportName})؟`
    });
  };

  const handleExecuteDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    setIsDeleting(true);
    try {
      if (deleteConfirm.type === 'head') {
        await DataService.updateUserProfile(deleteConfirm.id, {
          isTechCommitteeHead: false,
          techCommitteeSports: []
        });
        toast.success(`تم إلغاء تعيين الأستاذ "${deleteConfirm.name}" بنجاح`);
      } else if (deleteConfirm.type === 'member' && deleteConfirm.sportKey) {
        const teacherToUpdate = teachers.find(t => t.id === deleteConfirm.id);
        const currentSports = teacherToUpdate?.techCommitteeSportsMemberOf || [];
        const updatedSports = currentSports.filter(s => s !== deleteConfirm.sportKey);
        await DataService.updateUserProfile(deleteConfirm.id, {
          isTechCommitteeMember: updatedSports.length > 0,
          techCommitteeSportsMemberOf: updatedSports
        });
        toast.success(`تمت إزالة الأستاذ "${deleteConfirm.name}" من عضوية اللجنة التقنية بنجاح`);
      }
      setDeleteConfirm(null);
      await loadData();
    } catch (err) {
      console.error('Error during deletion execution:', err);
      toast.error('حدث خطأ أثناء تنفيذ الحذف، يرجى المحاولة مرة أخرى');
    } finally {
      setIsDeleting(false);
    }
  };

  // Get list of teachers who can be assigned as heads (excluding already assigned heads, unless in edit mode)
  const assignableTeachers = teachers.filter(t => !t.isTechCommitteeHead || t.id === editingHeadId);

  const filteredAssignableTeachers = useMemo(() => {
    const q = headTeacherSearch.trim().toLowerCase();
    if (!q) return assignableTeachers;
    return assignableTeachers.filter(t =>
      (t.fullName || '').toLowerCase().includes(q) ||
      (t.workLocation || '').toLowerCase().includes(q) ||
      (t.leaseNumber || '').toLowerCase().includes(q) ||
      (t.phone || '').toLowerCase().includes(q) ||
      (t.email || '').toLowerCase().includes(q)
    );
  }, [assignableTeachers, headTeacherSearch]);

  // Statistics
  const totalHeads = scopedHeads.length;
  const displayedSportsEntries = useMemo(() => {
    const entries = Object.entries(effectiveSportsMap);
    if (!isScopedTeacher) return entries;
    return entries.filter(([sportKey]) =>
      eligibleTeacherTournaments.some(t => areSportIdsEquivalent(t.sportId, sportKey, sportsConfig))
    );
  }, [effectiveSportsMap, isScopedTeacher, eligibleTeacherTournaments, sportsConfig]);
  const uniqueSportsCount = new Set(scopedHeads.flatMap(h => getVisibleSportKeysForHead(h))).size;

  // Detect signed-in Technical Committee Head (including Central Admin impersonation mode)
  const currentHeadProfile = useMemo(() => {
    if (!userProfile) return null;
    const matchedTeacher = teachers.find(t =>
      (t.id && t.id === userProfile.id) ||
      (t.email && userProfile.email && t.email.toLowerCase() === userProfile.email.toLowerCase()) ||
      (t.leaseNumber && userProfile.leaseNumber && t.leaseNumber === userProfile.leaseNumber)
    ) || null;
    const isUserHead =
      userProfile.isTechCommitteeHead === true ||
      matchedTeacher?.isTechCommitteeHead === true ||
      userProfile.role === 'TECH_HEAD' ||
      (userProfile.role as string) === 'TECH_COMMITTEE_HEAD' ||
      matchedTeacher?.role === 'TECH_HEAD' ||
      (matchedTeacher?.role as string) === 'TECH_COMMITTEE_HEAD';
    if (!isUserHead) return null;
    const mergedSports = Array.from(new Set([
      ...(userProfile.techCommitteeSports || []),
      ...(matchedTeacher?.techCommitteeSports || []),
      ...(userProfile.sportId ? [userProfile.sportId] : []),
      ...(matchedTeacher?.sportId ? [matchedTeacher.sportId] : [])
    ].filter(Boolean)));
    return {
      ...(matchedTeacher || {}),
      ...userProfile,
      techCommitteeSports: mergedSports
    };
  }, [userProfile, teachers]);

  const getTournamentsForHead = (head: User): Tournament[] => {
    const headSports = Array.from(new Set([
      ...(head.techCommitteeSports || []),
      ...(head.sportId ? [head.sportId] : [])
    ].filter(Boolean)));
    return tournaments.filter(t => {
      const sportMatch = headSports.some(sk => areSportIdsEquivalent(t.sportId, sk, sportsConfig));
      const emailMatch = Boolean(t.managerEmail && head.email && t.managerEmail.toLowerCase() === head.email.toLowerCase());
      const nameMatch = Boolean(t.managerName && head.fullName && t.managerName.trim() === head.fullName.trim());
      return sportMatch || emailMatch || nameMatch;
    });
  };

  const getMatchesCountForTournament = (t: Tournament): number => {
    return matches.filter(m => {
      if (m.tournamentId && m.tournamentId === t.id) return true;
      return areSportIdsEquivalent(m.sportId, t.sportId, sportsConfig) &&
        (!t.ageCategory || !m.ageCategory || m.ageCategory.toLowerCase() === t.ageCategory.toLowerCase()) &&
        (!t.gender || !m.gender || m.gender === t.gender);
    }).length;
  };

  const currentHeadTournaments = useMemo(() => {
    if (!currentHeadProfile) return [];
    return getTournamentsForHead(currentHeadProfile);
  }, [currentHeadProfile, tournaments, sportsConfig]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header and Quick Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
            <span>تدبير اللجان التقنية الرياضية</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة وتعيين رؤساء وأعضاء اللجان التقنية المشرفة على تأطير وتنظيم البطولات والأنشطة الرياضية الإقليمية.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer bg-white"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>تحديث</span>
          </button>

          {isCentralAdmin && (
            <>
              <button
                onClick={handleOpenAssignModal}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>تعيين رئيس لجنة جديد</span>
              </button>
              <button
                onClick={() => {
                  setSelectedMemberSport('');
                  setSelectedMemberIdForModal('');
                  setMemberTeacherSearch('');
                  setIsMemberModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer transition-colors"
              >
                <UserPlus className="h-4 w-4" />
                <span>تعيين عضو لجنة جديد</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Personal Appointment Card & Assigned Championships for Signed-In Tech Committee Head */}
      {currentHeadProfile && (
        <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl border border-indigo-400/30 shadow-xl overflow-hidden text-white">
          <div className="p-5 sm:p-6 space-y-5">
            {/* Top Identity Row */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
              <div className="flex items-start sm:items-center gap-3.5">
                {currentHeadProfile.photoUrl ? (
                  <img
                    src={currentHeadProfile.photoUrl}
                    alt={currentHeadProfile.fullName}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-amber-400 shadow-lg shrink-0 bg-slate-800"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400/25 to-indigo-500/35 border-2 border-amber-400/80 flex items-center justify-center shrink-0 shadow-lg">
                    <span className="text-2xl font-black text-amber-300">
                      {(currentHeadProfile.fullName || 'ر').trim().charAt(0)}
                    </span>
                  </div>
                )}

                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[11px] font-black">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      <span>بطاقة التعيين الرسمية — رئيس اللجنة التقنية الإقليمية</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-bold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>تكليف مفعّل</span>
                    </span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-black text-white leading-snug">
                    {currentHeadProfile.fullName}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                    {currentHeadProfile.workLocation && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{currentHeadProfile.workLocation}</span>
                      </span>
                    )}
                    {currentHeadProfile.leaseNumber && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-white/10 px-2 py-0.5 rounded-md">
                        <span>رقم التأجير:</span>
                        <strong className="text-amber-200">{currentHeadProfile.leaseNumber}</strong>
                      </span>
                    )}
                    {currentHeadProfile.email && (
                      <span className="inline-flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{currentHeadProfile.email}</span>
                      </span>
                    )}
                    {currentHeadProfile.phone && (
                      <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{currentHeadProfile.phone}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/tournaments')}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                >
                  <Trophy className="w-4 h-4" />
                  <span>تدبير البطولات</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/matches')}
                  className="px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-black transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Calendar className="w-4 h-4" />
                  <span>البرنامج والنتائج</span>
                </button>
              </div>
            </div>

            {/* Assigned Sports + Championships */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Assigned Sports */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                  <Award className="w-4 h-4" />
                  <span>التخصصات الرياضية المكلف بها</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(currentHeadProfile.techCommitteeSports || []).length > 0 ? (
                    (currentHeadProfile.techCommitteeSports || []).map(sk => {
                      const info = effectiveSportsMap[sk];
                      if (!info) return null;
                      return (
                        <span
                          key={sk}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white"
                        >
                          <span>{info.icon}</span>
                          <span>{info.name}</span>
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-slate-400">لم يتم ربط تخصص رياضي بعد</span>
                  )}
                </div>
              </div>

              {/* Assigned Championships */}
              <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-black text-emerald-300">
                    <ClipboardList className="w-4 h-4" />
                    <span>البطولات الإقليمية المكلف بها</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-[10px] font-black">
                    {currentHeadTournaments.length > 0
                      ? `${currentHeadTournaments.length} بطولة`
                      : `${(currentHeadProfile.techCommitteeSports || []).length} صنف رياضي`}
                  </span>
                </div>

                {currentHeadTournaments.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentHeadTournaments.map(t => {
                      const sInfo = effectiveSportsMap[t.sportId];
                      const gInfo = t.gender ? GENDER_MAP[t.gender] : null;
                      const mCount = getMatchesCountForTournament(t);
                      return (
                        <div
                          key={t.id}
                          onClick={() => navigate('/matches')}
                          className="p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition-all cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-black text-white truncate">
                              <span>{sInfo?.icon || '🏆'}</span>
                              <span className="truncate" title={t.name}>{t.name}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-300 font-bold">
                              {sInfo && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-100">
                                  {sInfo.name}
                                </span>
                              )}
                              {t.ageCategory && (
                                <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                                  {t.ageCategory}
                                </span>
                              )}
                              {gInfo && (
                                <span className="px-1.5 py-0.5 rounded bg-white/10 text-slate-200">
                                  {gInfo.icon} {gInfo.name}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="px-2 py-1 rounded-lg bg-amber-400/20 text-amber-200 border border-amber-400/30 text-[10px] font-black shrink-0">
                            {mCount} مباراة
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(currentHeadProfile.techCommitteeSports || []).map(sk => {
                      const sInfo = effectiveSportsMap[sk];
                      if (!sInfo) return null;
                      const sportMatchCount = matches.filter(m => areSportIdsEquivalent(m.sportId, sk, sportsConfig)).length;
                      return (
                        <div
                          key={`fallback-tourn-${sk}`}
                          onClick={() => navigate('/tournaments')}
                          className="p-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition-all cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white truncate">
                              {sInfo.icon} البطولة الإقليمية المدرسية لـ {sInfo.name}
                            </p>
                            <p className="text-[10px] text-slate-300 mt-0.5">بطولة إقليمية مكلف بالإشراف التقني عليها</p>
                          </div>
                          <span className="px-2 py-1 rounded-lg bg-amber-400/20 text-amber-200 border border-amber-400/30 text-[10px] font-black shrink-0">
                            {sportMatchCount} مباراة
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isScopedTeacher && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-2.5 text-xs text-blue-900 font-semibold shadow-3xs">
          <ShieldCheck className="h-4.5 w-4.5 text-blue-600 shrink-0" />
          <span>
            تُعرض لك حصرياً اللجان ورؤساء اللجن التقنية المشرفون على البطولات الإقليمية المدرسية المفتوحة لمؤسسات <strong className="font-black">{teacherCycleLabels.full}</strong> والمعنيّون بالمشاركة فيها.
          </span>
        </div>
      )}

      {/* Stats Cards Dashboard Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">
              {isScopedTeacher ? `رؤساء اللجن المعنيين ببطولات ${teacherCycleLabels.short}` : 'إجمالي رؤساء اللجن التقنية'}
            </p>
            <h3 className="text-2xl font-black text-slate-800">{totalHeads}</h3>
          </div>
          <span className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
            <ShieldCheck className="h-5.5 w-5.5" />
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">تخصصات رياضية مغطاة برئيس لجنة</p>
            <h3 className="text-2xl font-black text-emerald-600">{uniqueSportsCount} / {displayedSportsEntries.length}</h3>
          </div>
          <span className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
            <Trophy className="h-5.5 w-5.5" />
          </span>
        </div>
      </div>

      {/* Section: رؤساء اللجان التقنية */}
      <div className="space-y-4">
        <div className="border-b border-slate-200 pb-2">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
            <ShieldCheck className="h-4.5 w-4.5 text-blue-600" />
            <span>دليل رؤساء اللجان التقنية المعينين</span>
          </h3>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center">
          <div className="relative w-full md:w-80">
            <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              className="w-full text-xs pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
              placeholder="البحث باسم رئيس اللجنة أو الصنف الرياضي..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Tech Committee Heads List */}
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
            <p className="text-xs text-slate-500 font-medium">جاري تحميل لائحة اللجن التقنية...</p>
          </div>
        ) : filteredHeads.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-slate-300 mx-auto" />
            <p className="text-slate-500 text-xs font-semibold">
              {isScopedTeacher && !searchTerm.trim()
                ? `لا يوجد رؤساء لجن تقنية معينون حالياً للبطولات الإقليمية المدرسية الخاصة بسلك ${teacherCycleLabels.short}.`
                : 'لا يوجد أي رئيس لجنة تقنية معين حالياً يطابق تصفيتك.'}
            </p>
            {isCentralAdmin && (
              <button
                onClick={handleOpenAssignModal}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                اضغط هنا لتعيين أول رئيس لجنة تقنية الآن
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredHeads.map((head) => {
              const headSportKeys = getVisibleSportKeysForHead(head);
              const headMembers = teachers.filter(
                t =>
                  t.isTechCommitteeMember &&
                  t.id !== head.id &&
                  t.techCommitteeSportsMemberOf?.some(sk => headSportKeys.includes(sk))
              );
              const firstNameLetter = (head.fullName || 'ر').trim().charAt(0);

              return (
                <div
                  key={head.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-lg hover:border-indigo-300 transition-all duration-200 flex flex-col justify-between overflow-hidden group"
                >
                  <div>
                    {/* Prestigious Executive Card Header */}
                    <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-4 text-white relative">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {head.photoUrl ? (
                            <img
                              src={head.photoUrl}
                              alt={head.fullName}
                              className="w-13 h-13 rounded-2xl object-cover border-2 border-amber-400/80 shadow-md shrink-0 bg-slate-800"
                            />
                          ) : (
                            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-400/20 to-indigo-500/30 border-2 border-amber-400/70 flex items-center justify-center shrink-0 shadow-md">
                              <span className="text-lg font-black text-amber-300">{firstNameLetter}</span>
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-amber-300 text-[10px] font-bold">
                              <Award className="w-3.5 h-3.5 shrink-0" />
                              <span>رئيس اللجنة التقنية الإقليمية</span>
                            </div>
                            <h4 className="text-sm sm:text-base font-black text-white leading-snug truncate mt-0.5" title={head.fullName}>
                              {head.fullName}
                            </h4>
                            {head.workLocation && (
                              <p className="text-[11px] text-slate-300 flex items-center gap-1 truncate mt-0.5">
                                <MapPin className="w-3 h-3 text-amber-400/90 shrink-0" />
                                <span className="truncate">{head.workLocation}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {isCentralAdmin && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(head)}
                              className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer"
                              title="تعديل تعيين الأستاذ أو الأنشطة الرياضية"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevoke(head.id, head.fullName)}
                              className="p-1.5 text-rose-300 hover:text-white rounded-lg bg-white/10 hover:bg-rose-600/80 transition-colors cursor-pointer"
                              title="إلغاء التعيين"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Sports Managed */}
                    <div className="p-4 space-y-3.5">
                      <div>
                        <p className="text-[11px] text-slate-500 font-bold mb-2">اللجان والتخصصات المسندة إليه:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {headSportKeys.length > 0 ? (
                            headSportKeys.map(s => {
                              const sportInfo = effectiveSportsMap[s];
                              if (!sportInfo) return null;
                              return (
                                <span
                                  key={s}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/80 text-indigo-950 border border-indigo-200/80 rounded-xl text-[11px] font-bold"
                                >
                                  <span>{sportInfo.icon}</span>
                                  <span>{sportInfo.name}</span>
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-slate-400 italic text-xs">لا يوجد أصناف معينة</span>
                          )}
                        </div>
                      </div>

                      {/* Assigned Championships for this Head */}
                      {(() => {
                        const headTournaments = getVisibleTournamentsForHead(head);
                        return (
                          <div className="pt-2 border-t border-slate-100">
                            <p className="text-[11px] text-slate-500 font-bold mb-1.5 flex items-center gap-1">
                              <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              <span>البطولات المكلف بها:</span>
                            </p>
                            {headTournaments.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {headTournaments.slice(0, 4).map(t => (
                                  <span
                                    key={t.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-950 border border-amber-200 text-[10px] font-bold"
                                    title={t.name}
                                  >
                                    <span>{effectiveSportsMap[t.sportId]?.icon || '🏆'}</span>
                                    <span className="truncate max-w-[160px]">{t.name}</span>
                                  </span>
                                ))}
                                {headTournaments.length > 4 && (
                                  <span className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">
                                    +{headTournaments.length - 4} أخرى
                                  </span>
                                )}
                              </div>
                            ) : headSportKeys.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5">
                                {headSportKeys.map(sk => {
                                  const sInfo = effectiveSportsMap[sk];
                                  if (!sInfo) return null;
                                  return (
                                    <span
                                      key={`${head.id}-tourn-${sk}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-950 border border-amber-200 text-[10px] font-bold"
                                    >
                                      <span>{sInfo.icon}</span>
                                      <span>البطولة الإقليمية لـ {sInfo.name}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic text-[11px]">لا توجد بطولات مسندة</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* Contact Details */}
                      <div className="space-y-2 text-xs pt-3 border-t border-slate-100">
                        {head.phone && (
                          <div className="flex items-center justify-between gap-2 text-slate-700">
                            <div className="flex items-center gap-1.5 font-mono tabular-nums">
                              <Phone className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                              <span dir="ltr">{head.phone}</span>
                            </div>
                            <a
                              href={getWhatsAppUrl(head.phone, `السلام عليكم الأستاذ الفاضل ${head.fullName}، رئيس اللجنة التقنية،`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold transition-colors"
                              title="مراسلة رئيس اللجنة عبر واتساب"
                            >
                              <MessageCircle className="w-3 h-3" />
                              <span>واتساب</span>
                            </a>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-slate-500 truncate">
                          <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{head.email}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Committee Members & Impersonation Buttons on Card Footer */}
                  <div className="px-4 py-3 bg-slate-50/90 border-t border-slate-100 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setViewingMembersHead(head)}
                      className="w-full min-h-[40px] px-3 py-2 bg-white hover:bg-indigo-50 text-slate-800 hover:text-indigo-900 border border-slate-200 hover:border-indigo-300 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition-all cursor-pointer shadow-2xs"
                      title="عرض أعضاء اللجنة التقنية التابعة لهذا الرئيس"
                    >
                      <span className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4" />
                        </span>
                        <span>أعضاء اللجنة التقنية</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="px-2 py-0.5 rounded-lg bg-indigo-600 text-white text-[11px] font-black tabular-nums">
                          {headMembers.length}
                        </span>
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                      </span>
                    </button>

                    {canImpersonateTechHead && (
                      <button
                        type="button"
                        onClick={() => handleEnterAsTechHead(head)}
                        className="w-full min-h-[36px] px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        title="الدخول مؤقتاً بصفة رئيس اللجنة التقنية مع الاحتفاظ بصلاحيات المشرف المركزي"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>الدخول بصفة رئيس اللجنة</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section: أعضاء اللجان التقنية */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden mt-8">
        <div className="bg-slate-50/70 p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">أعضاء اللجان التقنية للأصناف الرياضية</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">أساتذة التربية البدنية المشكلون للجان التقنية والمكلفون بالتأطير والمتابعة ميدانياً</p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-6 space-y-6">
          {displayedSportsEntries.length === 0 ? (
            <div className="text-center py-8 text-xs font-semibold text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              لا توجد لجان تقنية مبرمجة حالياً للبطولات الخاصة بالسلك الابتدائي.
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {displayedSportsEntries.map(([sportKey, sportInfo]) => {
              const info = sportInfo as { name: string; icon: string };
              // Members of this specific sport committee
              const committeeMembers = teachers.filter(t => 
                t.isTechCommitteeMember && t.techCommitteeSportsMemberOf?.includes(sportKey)
              );

              // Find the head of this sport committee
              const sportHead = teachers.find(t => 
                t.isTechCommitteeHead && t.techCommitteeSports?.includes(sportKey)
              );

              const canManageThisSport = isCentralAdmin || (
                userProfile?.isTechCommitteeHead && 
                userProfile?.techCommitteeSports?.includes(sportKey)
              );

              // Teachers eligible to be added (not the head of this sport, and not already a member)
              const eligibleTeachers = teachers.filter(t => 
                t.id !== sportHead?.id &&
                (!t.techCommitteeSportsMemberOf || !t.techCommitteeSportsMemberOf.includes(sportKey))
              );

              return (
                <div 
                  key={sportKey} 
                  className="border border-slate-150 rounded-xl p-4 space-y-4 hover:border-slate-300 transition-colors bg-slate-50/30"
                >
                  {/* Sport Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{info.icon}</span>
                      <div>
                        <h4 className="text-xs font-black text-slate-800">لجنة {info.name}</h4>
                        <p className="text-[10px] text-slate-400">تنظيم وتدبير بطولات {info.name}</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 rounded-md text-[9px] font-bold">
                      {committeeMembers.length} أعضاء
                    </span>
                  </div>

                  {/* Sport Head Info */}
                  <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 bg-blue-50 text-blue-600 rounded">
                        <ShieldCheck className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[9px] text-slate-400 font-bold">رئيس اللجنة التقنية</p>
                        <p className="font-bold text-slate-800">{sportHead ? sportHead.fullName : 'لم يتم تعيين رئيس للجنة التقنية بعد'}</p>
                      </div>
                    </div>
                    {sportHead && (
                      <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 border border-slate-150 rounded">{sportHead.workLocation || 'بدون مؤسسة'}</span>
                    )}
                  </div>

                  {/* Committee Members List */}
                  <div className="space-y-2">
                    <p className="text-[10px] text-slate-400 font-bold">أعضاء اللجنة التقنية:</p>
                    {committeeMembers.length === 0 ? (
                      <p className="text-slate-400 italic text-xs py-2 text-center bg-white rounded-lg border border-dashed border-slate-200">
                        لا يوجد أعضاء مضافين حالياً لهذه اللجنة التقنية.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-2">
                        {committeeMembers.map(member => (
                          <div 
                            key={member.id} 
                            className="bg-white p-2.5 rounded-lg border border-slate-200 flex items-center justify-between text-xs hover:border-blue-200 transition-colors"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-[10px]">
                                👤
                              </div>
                              <div>
                                <p className="font-bold text-slate-800">{member.fullName}</p>
                                <p className="text-[9px] text-slate-400">{member.workLocation || 'أستاذ'}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1.5">
                              {member.phone && (
                                <span className="text-[9px] text-slate-400 font-mono hidden sm:inline">{member.phone}</span>
                              )}
                              {canManageThisSport && (
                                <button
                                  onClick={() => handleRemoveMember(member.id, sportKey, member.fullName)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                                  title="إزالة العضو من اللجنة"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add Member Quick Selector */}
                  {canManageThisSport && (
                    <div className="pt-2 border-t border-slate-100">
                      {addingMemberSport === sportKey ? (
                        <div className="space-y-2 bg-white p-3 rounded-lg border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
                          <label className="block text-[10px] font-bold text-slate-500">اختر أستاذاً لإضافته كعضو للجنة التقنية للـ {(sportInfo as any).name}:</label>
                          <select
                            value={selectedMemberTeacherId}
                            onChange={(e) => setSelectedMemberTeacherId(e.target.value)}
                            className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- اختر الأستاذ المعني --</option>
                            {eligibleTeachers.map(t => (
                              <option key={t.id} value={t.id}>
                                👨‍🏫 {t.fullName} ({t.workLocation || 'أستاذ'})
                              </option>
                            ))}
                          </select>
                          <div className="flex items-center justify-end gap-1.5 pt-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setAddingMemberSport(null);
                                setSelectedMemberTeacherId('');
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={() => handleAddMember(sportKey)}
                              disabled={isAddingMember}
                              className="px-3 py-1 text-[10px] font-bold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs cursor-pointer flex items-center gap-1"
                            >
                              <UserPlus className="h-3 w-3" />
                              <span>إضافة كعضو</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setAddingMemberSport(sportKey);
                            setSelectedMemberTeacherId('');
                          }}
                          className="w-full py-1.5 bg-white border border-dashed border-slate-250 hover:border-blue-400 hover:text-blue-600 text-slate-500 text-[11px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          <span>تعيين أستاذ كعضو في لجنة {(sportInfo as any).name}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>
      </div>

      {/* Appointment / Editing Modal for HEADS */}
      {isModalOpen && isCentralAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {isEditing ? 'تعديل تعيين اللجن الرياضية لـ رئيس اللجنة' : 'تعيين رئيس لجنة تقنية جديد'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="p-4 sm:p-5 space-y-4 max-h-[82vh] overflow-y-auto">
              {/* Select / Search / Replace Teacher */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    {isEditing
                      ? 'الأستاذ المكلف (يمكنك البحث وتعويضه بأستاذ آخر مباشرة)'
                      : 'اختر الأستاذ من لائحة هيئة التدريس'}{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <span className="text-[10px] font-bold text-slate-400">
                    {filteredAssignableTeachers.length} أستاذ متاح
                  </span>
                </div>

                {isEditing && editingHeadId && (
                  <div className="mb-2 px-3 py-2 bg-blue-50/80 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-center justify-between gap-2">
                    <span className="font-bold truncate">
                      المكلف حالياً: {teachers.find(t => t.id === editingHeadId)?.fullName}
                    </span>
                    {selectedTeacherId && selectedTeacherId !== editingHeadId && (
                      <span className="shrink-0 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full text-[10px] font-black border border-amber-300">
                        سيتم التعويض بـ {teachers.find(t => t.id === selectedTeacherId)?.fullName}
                      </span>
                    )}
                  </div>
                )}

                {/* Search Input */}
                <div className="relative mb-2">
                  <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={headTeacherSearch}
                    onChange={(e) => setHeadTeacherSearch(e.target.value)}
                    placeholder="ابحث بالاسم، المؤسسة، رقم التأجير (SOM)، أو الهاتف..."
                    className="w-full pr-8 pl-8 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {headTeacherSearch && (
                    <button
                      type="button"
                      onClick={() => setHeadTeacherSearch('')}
                      className="absolute left-2.5 top-2 text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="مسح البحث"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Searchable Teacher Picker List */}
                <div className="max-h-44 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100 bg-white">
                  {filteredAssignableTeachers.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 font-medium">
                      لا يوجد أستاذ مطابق للبحث "{headTeacherSearch}"
                    </div>
                  ) : (
                    filteredAssignableTeachers.map(teacher => {
                      const isPicked = selectedTeacherId === teacher.id;
                      return (
                        <button
                          key={teacher.id}
                          type="button"
                          onClick={() => setSelectedTeacherId(teacher.id)}
                          className={`w-full px-3 py-2 text-right flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                            isPicked
                              ? 'bg-blue-50 text-blue-950'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold truncate">
                                👨‍🏫 {teacher.fullName}
                              </span>
                              {teacher.id === editingHeadId && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                                  الحالي
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate mt-0.5">
                              {teacher.workLocation || 'بدون مؤسسة محددة'}
                              {teacher.leaseNumber ? ` • SOM: ${teacher.leaseNumber}` : ''}
                            </p>
                          </div>
                          <span
                            className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                              isPicked
                                ? 'border-blue-600 bg-blue-600 text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isPicked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  * يتم تعيين رئيس اللجنة التقنية حصراً من بين أساتذة التربية البدنية المسجلين بالنظام، ويمكن تغييره مباشرة دون حذف السجل.
                </p>
              </div>

              {/* Select Sports */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  تحديد الأنشطة واللجن الرياضية المشرف عليها <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-150 overflow-y-auto max-h-60">
                  {Object.entries(effectiveSportsMap).map(([key, sport]) => {
                    const isChecked = selectedSports.includes(key);
                    return (
                      <label
                        key={key}
                        className="flex items-center gap-2.5 px-2.5 py-2 bg-white rounded-lg border border-slate-200 hover:border-blue-400 cursor-pointer text-xs font-bold text-slate-700 transition-colors select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSport(key)}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                        />
                        <span>{(sport as any).icon} {(sport as any).name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs disabled:bg-blue-300 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>جاري حفظ البيانات...</span>
                    </>
                  ) : (
                    <span>تأكيد وحفظ التعيين</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointment Modal for MEMBERS */}
      {isMemberModalOpen && isCentralAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  إضافة عضو جديد للجنة تقنية رياضية
                </h3>
              </div>
              <button
                onClick={() => setIsMemberModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveMemberModal} className="p-5 space-y-4">
              {/* Select Sport */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اختر الصنف الرياضي / اللجنة <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedMemberSport}
                  onChange={(e) => setSelectedMemberSport(e.target.value)}
                  required
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- اختر الصنف الرياضي المعني --</option>
                  {Object.entries(effectiveSportsMap).map(([key, sport]) => (
                    <option key={key} value={key}>
                      {(sport as any).icon} {(sport as any).name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Teacher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اختر الأستاذ من لائحة هيئة التدريس <span className="text-red-500">*</span>
                </label>
                <div className="relative mb-2">
                  <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={memberTeacherSearch}
                    onChange={(e) => setMemberTeacherSearch(e.target.value)}
                    disabled={!selectedMemberSport}
                    placeholder="ابحث باسم الأستاذ، المؤسسة، أو رقم التأجير..."
                    className="w-full pr-8 pl-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-60"
                  />
                </div>
                <select
                  value={selectedMemberIdForModal}
                  onChange={(e) => setSelectedMemberIdForModal(e.target.value)}
                  required
                  disabled={!selectedMemberSport}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2.5 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                >
                  <option value="">
                    {!selectedMemberSport ? '-- يرجى تحديد الصنف الرياضي أولاً --' : '-- اختر أستاذاً لإضافته كعضو لجنة تقنية --'}
                  </option>
                  {teachers
                    .filter(t => {
                      if (selectedMemberSport && t.techCommitteeSportsMemberOf?.includes(selectedMemberSport)) {
                        return false;
                      }
                      const q = memberTeacherSearch.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        (t.fullName || '').toLowerCase().includes(q) ||
                        (t.workLocation || '').toLowerCase().includes(q) ||
                        (t.leaseNumber || '').toLowerCase().includes(q)
                      );
                    })
                    .map(teacher => (
                      <option key={teacher.id} value={teacher.id}>
                        👨‍🏫 {teacher.fullName} ({teacher.workLocation || 'بدون مؤسسة محددة'})
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                  * تظهر في هذه اللائحة أسماء هيئة التدريس غير المنتمين لعضوية اللجنة التقنية المحددة مسبقاً.
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingMemberModal}
                  className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs disabled:bg-emerald-300 cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmittingMemberModal ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>جاري إضافة العضو...</span>
                    </>
                  ) : (
                    <span>تأكيد الإضافة للجنة</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Interactive Delete / Revoke Confirmation Modal */}
      {deleteConfirm && deleteConfirm.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 text-right space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">{deleteConfirm.title}</h3>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">يرجى تأكيد هذا الإجراء للمتابعة</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed font-medium">
              {deleteConfirm.message}
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDeleteConfirm}
                className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 disabled:bg-red-300"
              >
                {isDeleting ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>جاري الحذف...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>نعم، تأكيد الحذف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Committee Members Modal for a Specific Head */}
      {viewingMembersHead && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          dir="rtl"
          onClick={() => setViewingMembersHead(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden max-h-[86vh] flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-amber-400/20 border border-amber-400/50 flex items-center justify-center shrink-0 text-amber-300">
                  <Users className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black truncate">
                    أعضاء اللجنة التقنية — {viewingMembersHead.fullName}
                  </h3>
                  <p className="text-[11px] text-slate-300 truncate mt-0.5">
                    {viewingMembersHead.workLocation || 'رئيس اللجنة التقنية الإقليمية'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingMembersHead(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-4 bg-slate-50/60">
              {getVisibleSportKeysForHead(viewingMembersHead).length === 0 ? (
                <div className="text-center py-8 bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
                  لم يتم إسناد أي صنف رياضي لهذا الرئيس بعد.
                </div>
              ) : (
                getVisibleSportKeysForHead(viewingMembersHead).map(sportKey => {
                  const sportInfo = effectiveSportsMap[sportKey] || { name: sportKey, icon: '🏆' };
                  const sportMembers = teachers.filter(
                    t =>
                      t.id !== viewingMembersHead.id &&
                      t.isTechCommitteeMember &&
                      t.techCommitteeSportsMemberOf?.includes(sportKey)
                  );
                  return (
                    <div key={`modal-sport-${sportKey}`} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 font-black text-slate-800 text-xs sm:text-sm">
                          <span>{sportInfo.icon}</span>
                          <span>لجنة {sportInfo.name}</span>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-black tabular-nums">
                          {sportMembers.length} أعضاء
                        </span>
                      </div>

                      <div className="p-3 space-y-2">
                        {sportMembers.length === 0 ? (
                          <p className="text-center text-xs text-slate-400 py-3">
                            لا يوجد أعضاء معينون في لجنة {sportInfo.name} حالياً.
                          </p>
                        ) : (
                          sportMembers.map(member => (
                            <div
                              key={`modal-member-${sportKey}-${member.id}`}
                              className="p-2.5 rounded-xl border border-slate-100 bg-slate-50/70 flex items-center justify-between gap-2 text-xs"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-800 truncate">{member.fullName}</p>
                                <p className="text-[11px] text-slate-500 truncate">
                                  {member.workLocation || 'أستاذ التربية البدنية'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {member.phone && (
                                  <a
                                    href={getWhatsAppUrl(member.phone, `السلام عليكم الأستاذ(ة) ${member.fullName}، عضو اللجنة التقنية لـ ${sportInfo.name}،`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span dir="ltr" className="hidden xs:inline">{member.phone}</span>
                                  </a>
                                )}
                                {(isCentralAdmin ||
                                  (userProfile?.isTechCommitteeHead &&
                                    userProfile?.techCommitteeSports?.includes(sportKey))) && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMember(member.id, sportKey, member.fullName)}
                                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="إزالة العضو"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3.5 bg-white border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
              {isCentralAdmin && (viewingMembersHead.techCommitteeSports || []).length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    const firstSport = viewingMembersHead.techCommitteeSports?.[0] || '';
                    setViewingMembersHead(null);
                    setSelectedMemberSport(firstSport);
                    setSelectedMemberIdForModal('');
                    setMemberTeacherSearch('');
                    setIsMemberModalOpen(true);
                  }}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>إضافة عضو لهذه اللجنة</span>
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setViewingMembersHead(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
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
