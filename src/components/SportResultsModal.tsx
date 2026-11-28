import React, { useState, useMemo, useEffect } from 'react';
import { Sport, Tournament, Match, School, Venue, Student, User, Referee, AffiliationDisplayConfig } from '../types';
import { DataService, isClubTournament, GENDER_MAP, SPORTS_MAP, getAgeCategoriesForSeason, normalizeCategoryKey, canUserApproveSportResult, areSportIdsEquivalent, normalizeCanonicalSportId, normalizeTournamentAffiliation, isAffiliationAllowedByDisplayConfig, canUserEnterMatchScore, isUserTechHeadForSport, isMatchProgramPendingApproval, isTeamSport } from '../lib/dataService';
import { computeGroupStandings, formatTeamDisplayName, isPlaceholderTeamId, isKnockoutBracketMatch, ComputedGroupStandings, hasValidMatchTeams, extractMatchGroupLabel } from '../lib/drawTournamentUtils';
import { CrossCountryPodiumView } from './CrossCountryPodiumView';
import { AthleticsResultsView } from './AthleticsResultsView';
import { CrossCountryCategoryResult } from '../types';
import {
  X,
  Trophy,
  Calendar,
  Clock,
  MapPin,
  Plus,
  Edit3,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Users,
  ShieldCheck,
  Search,
  Filter,
  Maximize2,
  Minimize2,
  Award,
  Sparkles,
  Pencil,
  ChevronLeft,
  MessageCircle,
  Share2,
  Undo2,
  RotateCcw,
  AlertTriangle,
  Loader2,
  Shuffle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useRolePermissions } from '../hooks/useRolePermissions';
import { isSuperAdminEmail } from '../contexts/AuthContext';
import { cn, formatMatchDate } from '../lib/utils';
import {
  findRefereeContact,
  resolveHostSchoolForMatch
} from '../lib/whatsappService';
import { resolveMatchRefereesInfo, isOpaqueEntityId } from '../lib/programExportService';
import {
  MatchBroadcastDiffusionModal,
  MatchBroadcastDiffusionTarget
} from './MatchBroadcastDiffusionModal';

interface SportResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | null;
  tournaments: Tournament[];
  matches: Match[];
  schools: School[];
  venues: Venue[];
  students: Student[];
  teachers?: User[];
  referees?: Referee[];
  crossCountryResults: Record<string, CrossCountryCategoryResult>;
  onUpdateCrossCountryResult?: (res: CrossCountryCategoryResult) => Promise<void>;
  userProfile: User | null;
  activeSeason: string;
  onEditScore: (match: Match) => void;
  onEditMatch: (match: Match) => void;
  onDeleteMatch: (match: Match) => void;
  onCreateMatch: (sportId: string, initialAffiliation: 'non_club' | 'club_affiliated') => void;
  onEditTournament?: (tournament: Tournament) => void;
  onDeleteTournament?: (tournament: Tournament) => void;
  onBranchProgramCleared?: () => Promise<void> | void;
  onOpenElectronicDraw?: (sportId: string) => void;
}

export const SportResultsModal: React.FC<SportResultsModalProps> = ({
  isOpen,
  onClose,
  sport,
  tournaments,
  matches,
  schools,
  venues,
  students,
  teachers: teachersProp,
  referees: refereesProp,
  crossCountryResults,
  onUpdateCrossCountryResult,
  userProfile,
  activeSeason,
  onEditScore,
  onEditMatch,
  onDeleteMatch,
  onCreateMatch,
  onEditTournament,
  onDeleteTournament,
  onBranchProgramCleared,
  onOpenElectronicDraw
}) => {
  const [selectedAffiliation, setSelectedAffiliation] = useState<'non_club' | 'club_affiliated' | 'open'>('non_club');
  const [activeBranchModal, setActiveBranchModal] = useState<'non_club' | 'club_affiliated' | 'open' | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [loadedReferees, setLoadedReferees] = useState<Referee[]>([]);
  const [loadedTeachers, setLoadedTeachers] = useState<User[]>([]);
  const [loadedUsers, setLoadedUsers] = useState<User[]>([]);
  const [editingNoteMatchId, setEditingNoteMatchId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  const [savingNoteMatchId, setSavingNoteMatchId] = useState<string | null>(null);
  const [diffusionTarget, setDiffusionTarget] = useState<MatchBroadcastDiffusionTarget | null>(null);
  const [togglingLiveMatchId, setTogglingLiveMatchId] = useState<string | null>(null);
  const [approvingProgramMatchId, setApprovingProgramMatchId] = useState<string | null>(null);
  const [revertingProgramMatchId, setRevertingProgramMatchId] = useState<string | null>(null);
  const [isBatchApprovingProgram, setIsBatchApprovingProgram] = useState(false);
  const [isBatchRevertingProgram, setIsBatchRevertingProgram] = useState(false);
  const [pendingBranchReset, setPendingBranchReset] = useState<{
    key: string;
    label: string;
    matchIds: string[];
    knockoutCount: number;
    totalCount: number;
  } | null>(null);
  const [isResettingBranchProgram, setIsResettingBranchProgram] = useState(false);
  const [affiliationDisplayConfig, setAffiliationDisplayConfig] = useState<AffiliationDisplayConfig>(() =>
    DataService.getAffiliationDisplayConfigSync()
  );

  useEffect(() => {
    const unsub = DataService.subscribeToAffiliationDisplayConfig((cfg) => {
      setAffiliationDisplayConfig(cfg);
    });
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, []);

  const handleToggleLiveMatchStatus = async (match: Match, nextStatus: 'Ongoing' | 'Scheduled') => {
    const matchWithSport = match.sportId ? match : { ...match, sportId: sport?.id || '' };
    if (!canUserEnterMatchScore(userProfile, matchWithSport, effectiveReferees, effectiveUsers)) {
      toast.error(
        isTeamSport(matchWithSport.sportId || '')
          ? 'تحديث حالة أو نتيجة مقابلات الرياضات الجماعية مقتصر فقط على رئيس اللجنة التقنية المعنية'
          : 'غير مصرح بتعديل حالة هذه المباراة'
      );
      return;
    }
    setTogglingLiveMatchId(match.id);
    try {
      await DataService.updateMatch(match.id, {
        status: nextStatus,
        updatedAt: new Date()
      });
      toast.success(nextStatus === 'Ongoing' ? 'تم تفعيل حالة المباراة: 🔴 جارية الآن' : 'تمت إعادة المباراة إلى حالة مبرمجة');
    } catch (err) {
      console.error('Failed to update live status:', err);
      toast.error('تعذر تحديث حالة المباراة');
    } finally {
      setTogglingLiveMatchId(null);
    }
  };

  const handleApproveMatchProgram = async (match: Match) => {
    if (!isCentralAdmin) return;
    const approverName = userProfile?.fullName || matchedTeacher?.fullName || userProfile?.email || 'المسير المركزي';
    setApprovingProgramMatchId(match.id);
    try {
      await DataService.approveMatchProgram(match.id, approverName);
      toast.success('تمت المصادقة على برنامج المقابلة بنجاح ✅');
    } catch (err) {
      console.error('Failed to approve match program:', err);
      toast.error('تعذرت المصادقة على البرنامج');
    } finally {
      setApprovingProgramMatchId(null);
    }
  };

  const handleRevertMatchProgram = async (match: Match) => {
    if (!isCentralAdmin) return;
    setRevertingProgramMatchId(match.id);
    try {
      await DataService.revertMatchProgram(match.id);
      toast.success('تم التراجع عن مصادقة المقابلة وإعادتها إلى انتظار المصادقة 🔄');
    } catch (err) {
      console.error('Failed to revert match program:', err);
      toast.error('تعذر التراجع عن مصادقة المقابلة');
    } finally {
      setRevertingProgramMatchId(null);
    }
  };

  const handleBatchApproveBranchProgram = async (branchMatches: Match[]) => {
    if (!isCentralAdmin) return;
    const pendingIds = branchMatches.filter(m => isMatchProgramPendingApproval(m)).map(m => m.id);
    if (pendingIds.length === 0) return;
    const approverName = userProfile?.fullName || matchedTeacher?.fullName || userProfile?.email || 'المسير المركزي';
    setIsBatchApprovingProgram(true);
    try {
      await DataService.approveMatchesProgramBatch(pendingIds, approverName);
      toast.success(`تمت المصادقة على ${pendingIds.length} مباراة في هذا البرنامج بنجاح ✅`);
    } catch (err) {
      console.error('Failed to batch approve branch program:', err);
      toast.error('تعذرت المصادقة الجماعية على البرنامج');
    } finally {
      setIsBatchApprovingProgram(false);
    }
  };

  const handleBatchRevertBranchProgram = async (branchMatches: Match[]) => {
    if (!isCentralAdmin) return;
    const approvedIds = branchMatches.filter(m => !isMatchProgramPendingApproval(m)).map(m => m.id);
    if (approvedIds.length === 0) return;
    setIsBatchRevertingProgram(true);
    try {
      await DataService.revertMatchesProgramBatch(approvedIds);
      toast.success(`تم التراجع عن مصادقة ${approvedIds.length} مباراة في هذا البرنامج بنجاح 🔄`);
    } catch (err) {
      console.error('Failed to batch revert branch program:', err);
      toast.error('تعذر التراجع عن مصادقة البرنامج');
    } finally {
      setIsBatchRevertingProgram(false);
    }
  };

  const handleSaveInlineNote = async (match: Match) => {
    setSavingNoteMatchId(match.id);
    try {
      const cleaned = noteDraft.trim();
      await DataService.updateMatch(match.id, {
        notes: cleaned,
        updatedAt: new Date()
      });
      toast.success(cleaned ? 'تم حفظ الملاحظة بنجاح' : 'تم مسح الملاحظة');
      setEditingNoteMatchId(null);
      setNoteDraft('');
    } catch (err) {
      console.error('Failed to save match note:', err);
      toast.error('تعذر حفظ الملاحظة');
    } finally {
      setSavingNoteMatchId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const syncDirectories = () => {
      if (!refereesProp) {
        DataService.getReferees().then(setLoadedReferees).catch(() => {});
      }
      if (!teachersProp) {
        DataService.getTeachers().then(setLoadedTeachers).catch(() => {});
      }
      DataService.getUsers().then(setLoadedUsers).catch(() => {});
    };
    syncDirectories();
    window.addEventListener('refereesUpdated', syncDirectories);
    window.addEventListener('userDataChanged', syncDirectories);
    return () => {
      window.removeEventListener('refereesUpdated', syncDirectories);
      window.removeEventListener('userDataChanged', syncDirectories);
    };
  }, [isOpen, refereesProp, teachersProp]);

  const effectiveReferees = refereesProp || loadedReferees;
  const effectiveTeachers = teachersProp || loadedTeachers;
  const effectiveUsers = useMemo(() => {
    const map = new Map<string, User>();
    [...effectiveTeachers, ...loadedUsers].forEach(u => {
      if (u?.id) map.set(u.id, u);
    });
    return Array.from(map.values());
  }, [effectiveTeachers, loadedUsers]);

  const { canDo } = useRolePermissions();

  const matchedTeacher = useMemo(() => {
    if (!userProfile) return null;
    return effectiveTeachers.find(t =>
      (t.id && t.id === userProfile.id) ||
      (t.email && userProfile.email && t.email.toLowerCase() === userProfile.email.toLowerCase()) ||
      (t.leaseNumber && userProfile.leaseNumber && t.leaseNumber === userProfile.leaseNumber)
    ) || null;
  }, [userProfile, effectiveTeachers]);

  const isSuperAdmin =
    userProfile?.isSuperAdmin === true ||
    matchedTeacher?.isSuperAdmin === true ||
    userProfile?.role === 'SUPER_ADMIN' ||
    isSuperAdminEmail(userProfile?.email);
  const effectiveRole = matchedTeacher?.role || userProfile?.role;
  const isCentralAdmin = effectiveRole === 'CENTRAL_ADMIN' || isSuperAdmin;
  const isSportManager = effectiveRole === 'SPORT_MANAGER';
  const isTechHead =
    userProfile?.isTechCommitteeHead === true ||
    matchedTeacher?.isTechCommitteeHead === true ||
    effectiveRole === 'TECH_HEAD' ||
    (effectiveRole as string) === 'TECH_COMMITTEE_HEAD';

  const allowedSportsForUser = useMemo(() => {
    const set = new Set<string>();
    const addId = (raw?: string) => {
      if (!raw) return;
      set.add(raw);
      const norm = normalizeCanonicalSportId(raw);
      if (norm) set.add(norm);
    };
    userProfile?.techCommitteeSports?.forEach(addId);
    matchedTeacher?.techCommitteeSports?.forEach(addId);
    addId(userProfile?.sportId);
    addId(matchedTeacher?.sportId);
    tournaments.forEach(t => {
      const emailMatch = t.managerEmail && userProfile?.email && t.managerEmail.toLowerCase() === userProfile.email.toLowerCase();
      const nameMatch = t.managerName && userProfile?.fullName && t.managerName.trim() === userProfile.fullName.trim();
      if ((emailMatch || nameMatch) && t.sportId) {
        addId(t.sportId);
      }
    });
    return Array.from(set);
  }, [userProfile, matchedTeacher, tournaments]);

  const canApproveThisSport = useMemo(() => {
    if (!sport) return false;
    return canUserApproveSportResult(userProfile, sport.id, effectiveTeachers);
  }, [userProfile, sport, effectiveTeachers]);

  const isTechHeadForThisSport = useMemo(() => {
    if (!sport) return false;
    return isUserTechHeadForSport(userProfile, sport.id, effectiveUsers);
  }, [userProfile, sport, effectiveUsers]);

  const canManage = isCentralAdmin
    ? true
    : isTechHeadForThisSport
      ? true
      : (isTechHead || isSportManager)
        ? (sport ? allowedSportsForUser.some(id => areSportIdsEquivalent(id, sport.id)) : false)
        : canDo('action:edit_results') && userProfile?.role !== 'REFEREE';

  const canResetBranchProgram = Boolean(
    isCentralAdmin || isTechHeadForThisSport || (isSportManager && canManage)
  );

  const handleConfirmBranchProgramReset = async () => {
    if (!pendingBranchReset || !sport || !canResetBranchProgram || isResettingBranchProgram) return;
    if (pendingBranchReset.matchIds.length === 0) {
      setPendingBranchReset(null);
      return;
    }

    setIsResettingBranchProgram(true);
    try {
      const scopedSportIds = isCentralAdmin
        ? null
        : Array.from(
            new Set(
              [...allowedSportsForUser, ...(isTechHeadForThisSport ? [sport.id] : [])].filter(Boolean)
            )
          );

      const res = await DataService.clearScheduledMatchesByScope({
        allowedSportIds: scopedSportIds,
        sportId: sport.id,
        matchIds: pendingBranchReset.matchIds
      });

      const clearedLabel = pendingBranchReset.label;
      setPendingBranchReset(null);
      if (onBranchProgramCleared) {
        await Promise.resolve(onBranchProgramCleared());
      }
      if (res.deletedMatchesCount > 0) {
        toast.success(
          `تم مسح برمجة «${clearedLabel}» وشجرة مقابلاتها (${res.deletedMatchesCount} مباراة) بنجاح. يمكنك الآن إعادة برمجتها من جديد.`
        );
      } else {
        toast('لم يتم العثور على مباريات مطابقة للمسح في هذا الفرع.', { icon: 'ℹ️' });
      }
    } catch (err: any) {
      console.error('Failed to reset branch program:', err);
      if (err?.message === 'UNAUTHORIZED_SPORT_RESET') {
        toast.error('غير مسموح لك بمسح برمجة رياضة خارج تخصصك المسند.');
      } else {
        toast.error('تعذر مسح برمجة هذا الفرع');
      }
    } finally {
      setIsResettingBranchProgram(false);
    }
  };

  const isUserAssignedReferee = (m: Match): boolean => {
    if (!userProfile) return false;
    const myId = (userProfile.id || '').trim().toLowerCase();
    const myName = (userProfile.fullName || '').trim().toLowerCase();
    const myLinkedRefIds = new Set(
      effectiveReferees
        .filter(
          r =>
            (userProfile.id && (r.teacherId === userProfile.id || (r as any).userId === userProfile.id)) ||
            (userProfile.email && r.email && r.email.trim().toLowerCase() === userProfile.email.trim().toLowerCase()) ||
            (myName && (r.fullName || '').trim().toLowerCase() === myName)
        )
        .map(r => (r.id || '').trim().toLowerCase())
        .filter(Boolean)
    );
    if (myId) myLinkedRefIds.add(myId);

    const rawEntries = [
      ...(Array.isArray(m.fieldReferees) ? m.fieldReferees : []),
      ...(Array.isArray(m.tableReferees) ? m.tableReferees : []),
      ...(Array.isArray(m.referees) ? m.referees : []),
      ...(m.referee1Id ? [m.referee1Id] : []),
      ...(m.referee2Id ? [m.referee2Id] : []),
      ...resolveMatchRefereesInfo(m, effectiveReferees, effectiveUsers).allRefs
    ];
    return rawEntries.some(r => {
      const rawLower = (r || '').trim().toLowerCase();
      if (rawLower && myLinkedRefIds.has(rawLower)) return true;
      const clean = (r || '').replace(/[()]/g, '').replace('الحكم المعتمد', '').trim().toLowerCase();
      return Boolean(myName && clean && (clean === myName || clean.includes(myName) || myName.includes(clean)));
    });
  };

  const handleApproveMatchInline = async (m: Match, openNotifyModal: boolean) => {
    if (!canApproveThisSport || !sport) return;
    const approverName = userProfile?.fullName || matchedTeacher?.fullName || userProfile?.email || 'رئيس اللجنة التقنية';
    try {
      await DataService.approveMatchResult(m.id, approverName);
      toast.success('تمت المصادقة النهائية على نتيجة المقابلة بنجاح ✅');
      if (openNotifyModal) {
        const t1Obj = schools.find(s => s.id === m.team1Id);
        const t2Obj = schools.find(s => s.id === m.team2Id);
        const t1Name = t1Obj?.name || m.team1Name || m.team1Id || 'المؤسسة 1';
        const t2Name = t2Obj?.name || m.team2Name || m.team2Id || 'المؤسسة 2';
        const hostSchoolObj = resolveHostSchoolForMatch(m, schools);
        const vObj = venues.find(v => v.id === m.venueId);
        const rawVenueFallback = m.venueId && !isOpaqueEntityId(m.venueId) ? m.venueId : '';
        const vName = m.venueName?.trim() || hostSchoolObj?.name || vObj?.name || rawVenueFallback || 'ملعب غير محدد';
        const resolvedRefs = resolveMatchRefereesInfo(m, effectiveReferees, effectiveUsers);
        setDiffusionTarget({
          matchId: m.id,
          mode: 'result',
          sportId: m.sportId || sport.id,
          sportName: sport.name || SPORTS_MAP[m.sportId]?.name || '',
          ageCategory: m.ageCategory,
          gender: m.gender && GENDER_MAP[m.gender] ? GENDER_MAP[m.gender].name : m.gender,
          stageName: m.stage,
          team1Id: m.team1Id,
          team2Id: m.team2Id,
          team1Name: t1Name,
          team2Name: t2Name,
          hostSchoolId: m.hostSchoolId || hostSchoolObj?.id,
          venueId: m.venueId,
          venueName: vName,
          dateStr: formatMatchDate(m.date),
          timeStr: m.startTime || '10:00',
          referees: resolvedRefs.allRefs,
          tableReferees: resolvedRefs.tableRefs,
          fieldReferees: resolvedRefs.fieldRefs,
          notes: m.notes,
          score1: m.score1 ?? m.team1Score ?? 0,
          score2: m.score2 ?? m.team2Score ?? 0,
          penalty1: m.penalty1,
          penalty2: m.penalty2,
          scorers: m.scorers,
          approvedByName: approverName
        });
      }
    } catch (err) {
      console.error('Failed to approve match result:', err);
      toast.error('تعذرت المصادقة على النتيجة');
    }
  };

  const seasonalCategories = useMemo(() => {
    return getAgeCategoriesForSeason(activeSeason);
  }, [activeSeason]);

  // Sport categories list
  const sportCategories = useMemo(() => {
    if (!sport) return seasonalCategories.map(c => c.id);
    const tournCats = Array.from(new Set(tournaments.filter(t => t.sportId === sport.id).map(t => normalizeCategoryKey(t.ageCategory)).filter(Boolean)));
    if (tournCats.length > 0) return tournCats;
    if (sport.ageCategories && sport.ageCategories.length > 0) return sport.ageCategories.map(normalizeCategoryKey);
    return seasonalCategories.map(c => c.id);
  }, [sport, tournaments, seasonalCategories]);

  // Tournaments for this sport (excluding Draft/inactive/other directorates & hidden affiliations)
  const sportTournaments = useMemo(() => {
    if (!sport) return [];
    const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
    return tournaments.filter(t => {
      if (t.sportId !== sport.id) return false;
      if (t.status === 'Draft' || (t as any).isActive === false) return false;
      if (activeDirId && activeDirId !== 'all') {
        const tDir = t.directorateId || 'taourirt';
        if (tDir !== activeDirId) return false;
      }
      const tAff = normalizeTournamentAffiliation(t.affiliationType, t.name);
      return isAffiliationAllowedByDisplayConfig(tAff, affiliationDisplayConfig, sport.id);
    });
  }, [tournaments, sport, affiliationDisplayConfig]);

  // Non-club tournaments vs Club-affiliated tournaments
  const nonClubTournaments = useMemo(() => {
    return sportTournaments.filter(t => normalizeTournamentAffiliation(t.affiliationType, t.name) === 'non_club');
  }, [sportTournaments]);

  const clubTournaments = useMemo(() => {
    return sportTournaments.filter(t => normalizeTournamentAffiliation(t.affiliationType, t.name) === 'club_affiliated');
  }, [sportTournaments]);

  const openTournaments = useMemo(() => {
    return sportTournaments.filter(t => normalizeTournamentAffiliation(t.affiliationType, t.name) === 'open');
  }, [sportTournaments]);

  // Helper: check match affiliation
  const getMatchAffiliation = (match: Match): 'non_club' | 'club_affiliated' | 'open' => {
    if (
      match.affiliationType === 'club_affiliated' ||
      match.affiliationType === 'open' ||
      match.affiliationType === 'non_club'
    ) {
      return match.affiliationType;
    }
    if (match.tournamentId) {
      const parentT = tournaments.find(t => t.id === match.tournamentId);
      if (parentT) {
        return normalizeTournamentAffiliation(parentT.affiliationType, parentT.name);
      }
    }
    // Fallback: check match notes or title
    if (match.notes && (match.notes.includes('مفتوحة') || match.notes.includes('المفتوحة'))) return 'open';
    if (match.notes && (match.notes.includes('منتمين') || match.notes.includes('أندية'))) {
      return match.notes.includes('غير المنتمين') ? 'non_club' : 'club_affiliated';
    }
    return 'non_club';
  };

  // Matches for this sport (strictly limited to active programmed tournaments, active directorate & allowed affiliation)
  const sportMatches = useMemo(() => {
    if (!sport || sportTournaments.length === 0) return [];
    const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
    return matches.filter(m => {
      if (activeDirId && activeDirId !== 'all') {
        const mDir = m.directorateId || 'taourirt';
        if (mDir !== activeDirId) return false;
      }
      const mAff = getMatchAffiliation(m);
      if (!isAffiliationAllowedByDisplayConfig(mAff, affiliationDisplayConfig, sport.id)) return false;

      if (m.tournamentId) {
        return sportTournaments.some(t => t.id === m.tournamentId);
      }
      if (m.sportId === sport.id) {
        return sportTournaments.some(t => {
          const tAff = normalizeTournamentAffiliation(t.affiliationType, t.name);
          const catMatch = normalizeCategoryKey(t.ageCategory) === normalizeCategoryKey(m.ageCategory);
          const genderMatch = t.gender === 'Mixed' || m.gender === 'Mixed' || t.gender === m.gender;
          const affMatch = tAff === 'open' || mAff === tAff;
          return catMatch && genderMatch && affMatch;
        });
      }
      return false;
    });
  }, [matches, sport, sportTournaments, affiliationDisplayConfig, tournaments]);

  const isMatchClubAffiliated = (match: Match): boolean => {
    return getMatchAffiliation(match) === 'club_affiliated';
  };

  const currentBranch = activeBranchModal || selectedAffiliation;

  const matchesScopedToBranchAndFiltersExceptStatus = useMemo(() => {
    return sportMatches.filter(m => {
      if (!hasValidMatchTeams(m, schools)) return false;

      const mAff = getMatchAffiliation(m);
      if (currentBranch !== mAff) return false;

      // Category filter
      if (selectedCategory !== 'ALL') {
        const normM = normalizeCategoryKey(m.ageCategory || '');
        const normSel = normalizeCategoryKey(selectedCategory);
        const mCat = (m.ageCategory || '').toLowerCase();
        const selCat = selectedCategory.toLowerCase();
        if (normM !== normSel && mCat !== selCat && !mCat.includes(selCat) && !selCat.includes(mCat)) return false;
      }

      // Gender filter
      if (selectedGender !== 'ALL' && m.gender !== selectedGender) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const t1 = formatTeamDisplayName(m.team1Id, m.team1Name, schools, m.team1Placeholder, m.team1SourceMatchNumber);
        const t2 = formatTeamDisplayName(m.team2Id, m.team2Name, schools, m.team2Placeholder, m.team2SourceMatchNumber);
        const v = venues.find(v => v.id === m.venueId)?.name || m.venueName || '';
        const stage = m.stage || '';
        const group = extractMatchGroupLabel(m);
        const matchStr = `${t1} ${t2} ${v} ${stage} ${group} ${m.drawMatchNumber || ''}`.toLowerCase();
        if (!matchStr.includes(q)) return false;
      }

      return true;
    });
  }, [sportMatches, currentBranch, selectedCategory, selectedGender, searchQuery, schools, venues, tournaments]);

  const branchStatusCounts = useMemo(() => {
    let ongoing = 0;
    let scheduled = 0;
    let completed = 0;
    matchesScopedToBranchAndFiltersExceptStatus.forEach(m => {
      const s = String(m.status || 'Scheduled').trim().toLowerCase();
      if (s === 'ongoing') ongoing++;
      else if (s === 'completed') completed++;
      else scheduled++;
    });
    return {
      all: matchesScopedToBranchAndFiltersExceptStatus.length,
      ongoing,
      scheduled,
      completed
    };
  }, [matchesScopedToBranchAndFiltersExceptStatus]);

  // Filtered matches for active branch (currentBranch) and active filters including statusFilter
  const activeBranchMatches = useMemo(() => {
    return matchesScopedToBranchAndFiltersExceptStatus
      .filter(m => {
        if (statusFilter !== 'ALL') {
          const s = String(m.status || 'Scheduled').trim().toLowerCase();
          const target = statusFilter.trim().toLowerCase();
          if (s !== target) return false;
        }
        return true;
      })
      .sort((a, b) => (a.drawMatchNumber ?? 9999) - (b.drawMatchNumber ?? 9999));
  }, [matchesScopedToBranchAndFiltersExceptStatus, statusFilter]);

  // Matches for standings & knockout bracket in current branch + category + gender (shown on statusFilter === 'ALL')
  const branchStandingsBuckets = useMemo(() => {
    const scoped = sportMatches.filter(m => {
      if (!hasValidMatchTeams(m, schools)) return false;
      if (getMatchAffiliation(m) !== currentBranch) return false;
      if (selectedCategory !== 'ALL') {
        const normM = normalizeCategoryKey(m.ageCategory || '');
        const normSel = normalizeCategoryKey(selectedCategory);
        const mCat = (m.ageCategory || '').toLowerCase();
        const selCat = selectedCategory.toLowerCase();
        if (normM !== normSel && mCat !== selCat && !mCat.includes(selCat) && !selCat.includes(mCat)) return false;
      }
      if (selectedGender !== 'ALL' && m.gender !== selectedGender) return false;
      return true;
    });

    const buckets = new Map<string, { label: string; matches: Match[] }>();
    scoped.forEach(m => {
      const catKey = normalizeCategoryKey(m.ageCategory || '') || 'عام';
      const genKey = m.gender || 'Mixed';
      const key = `${catKey}__${genKey}`;
      const catLabel = seasonalCategories.find(c => c.id === catKey)?.name || m.ageCategory || '';
      const genLabel = genKey && GENDER_MAP[genKey] ? GENDER_MAP[genKey].name : '';
      const label = [catLabel, genLabel].filter(Boolean).join(' — ');
      const existing = buckets.get(key) || { label, matches: [] };
      existing.matches.push(m);
      buckets.set(key, existing);
    });

    return Array.from(buckets.entries()).map(([key, bucket]) => {
      const standings: ComputedGroupStandings[] = computeGroupStandings(bucket.matches, schools);
      const knockoutMatches = bucket.matches
        .filter(isKnockoutBracketMatch)
        .sort((a, b) => (a.drawMatchNumber || 999) - (b.drawMatchNumber || 999));
      return {
        key,
        label: bucket.label,
        standings,
        knockoutMatches,
        allMatches: bucket.matches
      };
    }).filter(b => b.standings.length > 0 || b.knockoutMatches.length > 0);
  }, [sportMatches, currentBranch, selectedCategory, selectedGender, schools, seasonalCategories, tournaments]);

  // Determine branch card visibility based on display config AND existing matches or tournaments
  const hasNonClub = useMemo(() => {
    if (!sport || !isAffiliationAllowedByDisplayConfig('non_club', affiliationDisplayConfig, sport.id)) return false;
    return sportMatches.some(m => getMatchAffiliation(m) === 'non_club') || nonClubTournaments.length > 0;
  }, [sport, affiliationDisplayConfig, sportMatches, nonClubTournaments]);

  const hasClub = useMemo(() => {
    if (!sport || !isAffiliationAllowedByDisplayConfig('club_affiliated', affiliationDisplayConfig, sport.id)) return false;
    return sportMatches.some(m => getMatchAffiliation(m) === 'club_affiliated') || clubTournaments.length > 0;
  }, [sport, affiliationDisplayConfig, sportMatches, clubTournaments]);

  const hasOpen = useMemo(() => {
    if (!sport || !isAffiliationAllowedByDisplayConfig('open', affiliationDisplayConfig, sport.id)) return false;
    return sportMatches.some(m => getMatchAffiliation(m) === 'open') || openTournaments.length > 0;
  }, [sport, affiliationDisplayConfig, sportMatches, openTournaments]);

  // Reset filters & sub-modal when opening/changing sport
  React.useEffect(() => {
    if (isOpen) {
      setActiveBranchModal(null);
      setSelectedCategory('ALL');
      setSelectedGender('ALL');
      setStatusFilter('ALL');
      setSearchQuery('');
      setPendingBranchReset(null);
    }
  }, [isOpen, sport?.id]);

  // Keep selectedAffiliation / activeBranchModal valid against allowed branches
  React.useEffect(() => {
    if (!isOpen) return;
    if (activeBranchModal === 'non_club' && !hasNonClub) setActiveBranchModal(null);
    else if (activeBranchModal === 'club_affiliated' && !hasClub) setActiveBranchModal(null);
    else if (activeBranchModal === 'open' && !hasOpen) setActiveBranchModal(null);

    if (!activeBranchModal) {
      if (selectedAffiliation === 'non_club' && !hasNonClub) {
        if (hasOpen) setSelectedAffiliation('open');
        else if (hasClub) setSelectedAffiliation('club_affiliated');
      } else if (selectedAffiliation === 'club_affiliated' && !hasClub) {
        if (hasOpen) setSelectedAffiliation('open');
        else if (hasNonClub) setSelectedAffiliation('non_club');
      } else if (selectedAffiliation === 'open' && !hasOpen) {
        if (hasNonClub) setSelectedAffiliation('non_club');
        else if (hasClub) setSelectedAffiliation('club_affiliated');
      }
    }
  }, [isOpen, hasOpen, hasNonClub, hasClub, activeBranchModal, selectedAffiliation]);

  // Non-club vs Club match counters
  const nonClubMatchesCount = useMemo(() => {
    return sportMatches.filter(m => getMatchAffiliation(m) === 'non_club').length;
  }, [sportMatches]);

  const clubMatchesCount = useMemo(() => {
    return sportMatches.filter(m => getMatchAffiliation(m) === 'club_affiliated').length;
  }, [sportMatches]);

  const openMatchesCount = useMemo(() => {
    return sportMatches.filter(m => getMatchAffiliation(m) === 'open').length;
  }, [sportMatches]);

  const nonClubPendingCount = useMemo(() => {
    return sportMatches.filter(m => getMatchAffiliation(m) === 'non_club' && isMatchProgramPendingApproval(m)).length;
  }, [sportMatches]);

  const clubPendingCount = useMemo(() => {
    return sportMatches.filter(m => getMatchAffiliation(m) === 'club_affiliated' && isMatchProgramPendingApproval(m)).length;
  }, [sportMatches]);

  const openPendingCount = useMemo(() => {
    return sportMatches.filter(m => getMatchAffiliation(m) === 'open' && isMatchProgramPendingApproval(m)).length;
  }, [sportMatches]);

  if (!isOpen || !sport) return null;

  const getSchoolName = (id: string, fallbackName?: string) => {
    return formatTeamDisplayName(id, fallbackName, schools);
  };

  const getVenueName = (id: string, fallbackName?: string, hostSchoolId?: string) => {
    if (fallbackName && fallbackName.trim() && !isOpaqueEntityId(fallbackName)) return fallbackName.trim();
    if (hostSchoolId) {
      const hs = schools.find(s => s.id === hostSchoolId);
      if (hs) return hs.name;
    }
    const v = venues.find(ven => ven.id === id);
    if (v) return v.name;
    const sch = schools.find(s => s.id === id || s.id === (id || '').replace(/^school:/, ''));
    if (sch) return sch.name;
    if (id && !isOpaqueEntityId(id)) return id;
    return 'ملعب غير محدد';
  };

  const getCategoryName = (catId: string) => {
    const catObj = seasonalCategories.find(c => c.id === catId);
    return catObj ? catObj.name : catId;
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs dir-rtl ${
      isFullScreen ? 'p-0 overflow-hidden' : 'p-1.5 sm:p-4 overflow-hidden'
    }`}>
      <div
        className={`w-full bg-white shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullScreen ? 'h-[100dvh] max-w-none m-0 rounded-none border-0' : 'rounded-2xl sm:rounded-3xl border border-slate-200 max-w-6xl max-h-[94dvh] sm:max-h-[92vh] my-auto'
        }`}
      >
        {/* Modal Header */}
        <div className="px-3 sm:px-5 py-3 sm:py-4 bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b border-white/10 shrink-0">
          <div className="flex items-start sm:items-center justify-between gap-2.5 min-w-0 w-full sm:w-auto">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-lg sm:text-2xl shadow-md border border-amber-300/40 shrink-0">
                {sport.icon || '🏆'}
              </div>
              <div className="min-w-0 text-right">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap">
                    نتائج ومباريات الرياضة
                  </span>
                  <span className="text-[9px] sm:text-[10px] text-emerald-100 font-bold whitespace-nowrap">{activeSeason}</span>
                </div>
                <h2 className="text-xs sm:text-base md:text-lg font-black text-white mt-0.5 leading-snug break-words">
                  البطولة الإقليمية المدرسية لـ {sport.name}
                </h2>
              </div>
            </div>

            <div className="flex sm:hidden items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="text-slate-300 hover:text-white p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors cursor-pointer min-w-[34px] min-h-[34px] flex items-center justify-center"
                title="إغلاق"
              >
                <X className="h-4.5 w-4.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 justify-end w-full sm:w-auto shrink-0">
            {canManage && (
              sport.id === 'cross_country' ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-400/30 rounded-xl text-[11px] font-black">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>لوحة التتويج والبوديوم الإقليمي</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onCreateMatch(sport.id, selectedAffiliation)}
                  className="flex-1 sm:flex-none justify-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>برمجة مباراة جديدة</span>
                </button>
              )
            )}

            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="hidden sm:flex text-slate-300 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer min-w-[36px] min-h-[36px] items-center justify-center"
              title={isFullScreen ? 'استعادة الحجم الطبيعي' : 'ملء الشاشة'}
            >
              {isFullScreen ? <Minimize2 className="h-4.5 w-4.5" /> : <Maximize2 className="h-4.5 w-4.5" />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="hidden sm:flex text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition-colors cursor-pointer min-w-[36px] min-h-[36px] items-center justify-center"
              title="إغلاق"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-2.5 sm:p-6 overflow-y-auto overflow-x-hidden overscroll-contain flex-1 min-h-0 bg-slate-50/60 space-y-4 sm:space-y-6">

          {/* Special view for Athletics */}
          {sport.id === 'athletics' || sport.id === 'track_field' ? (
            <AthleticsResultsView
              onBack={onClose}
              canEdit={canManage}
              activeSeason={activeSeason}
              directorateName="المديرية الإقليمية"
              students={students}
              schools={schools}
              currentUser={userProfile}
            />
          ) : sport.id === 'cross_country' ? (
            <CrossCountryPodiumView
              results={crossCountryResults}
              onUpdateResult={onUpdateCrossCountryResult || (async () => {})}
              onBack={onClose}
              canEdit={canManage}
              activeSeason={activeSeason}
              directorateName="المديرية الإقليمية"
              students={students}
              schools={schools}
              currentUser={userProfile}
            />
          ) : (
            <>
              {/* Central Admin Sport-Wide Program Approval / Revert Bar */}
              {isCentralAdmin && sportMatches.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2 flex-wrap text-xs font-black text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>تحكم المسير المركزي في برنامج {sport.name}:</span>
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px]">
                      ⏳ في الانتظار: {sportMatches.filter(m => isMatchProgramPendingApproval(m)).length}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                      ✅ مصادق عليها: {sportMatches.filter(m => !isMatchProgramPendingApproval(m)).length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {sportMatches.some(m => isMatchProgramPendingApproval(m)) && (
                      <button
                        type="button"
                        disabled={isBatchApprovingProgram}
                        onClick={() => handleBatchApproveBranchProgram(sportMatches)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {isBatchApprovingProgram
                            ? 'جاري المصادقة...'
                            : `المصادقة على كامل برنامج ${sport.name} (${sportMatches.filter(m => isMatchProgramPendingApproval(m)).length})`}
                        </span>
                      </button>
                    )}
                    {sportMatches.some(m => !isMatchProgramPendingApproval(m)) && (
                      <button
                        type="button"
                        disabled={isBatchRevertingProgram}
                        onClick={() => handleBatchRevertBranchProgram(sportMatches)}
                        className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>
                          {isBatchRevertingProgram
                            ? 'جاري التراجع...'
                            : `التراجع عن مصادقة كامل برنامج ${sport.name} (${sportMatches.filter(m => !isMatchProgramPendingApproval(m)).length})`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* BRANCH CARDS (Show only if corresponding matches or tournaments exist) */}
              <div className={`grid gap-5 ${
                [hasNonClub, hasClub, hasOpen].filter(Boolean).length === 1 
                  ? 'grid-cols-1 max-w-md mx-auto' 
                  : [hasNonClub, hasClub, hasOpen].filter(Boolean).length === 2
                  ? 'grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto'
                  : 'grid-cols-1 lg:grid-cols-3'
              }`}>
                {/* ⚪ Non-club Tournament Branch (White Card) */}
                {hasNonClub && (
                  <div
                    id="results-non-club-championship-card"
                    onClick={() => {
                      setSelectedAffiliation('non_club');
                      setActiveBranchModal('non_club');
                    }}
                    className="text-right p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-sm hover:shadow-xl bg-white border-blue-200 hover:border-blue-500 group"
                  >
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between w-full gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-blue-50 text-blue-800 border-blue-200 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                          ⚪ بطولة غير المنتمين للأندية
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {nonClubPendingCount > 0 && (
                            <span className="text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-xl border border-red-200">
                              ⏳ {nonClubPendingCount} في انتظار المصادقة
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-xl border border-blue-100">
                            {nonClubMatchesCount} مباراة
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-black text-slate-900 mt-1 group-hover:text-blue-600 transition-colors">
                        نتائج صنف غير المنتمين للأندية
                      </h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight">
                        البرمجة والنتائج الخاصة بالتلاميذ المتمدرسين غير المنخرطين بالأندية.
                      </p>

                      {/* Category matches count breakdown */}
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-slate-100 pt-2">
                        {sportCategories.slice(0, 4).map(catId => {
                          const count = sportMatches.filter(m => {
                            const mAff = getMatchAffiliation(m);
                            if (mAff !== 'non_club') return false;
                            const mCat = (m.ageCategory || '').toLowerCase();
                            return mCat === catId.toLowerCase() || mCat.includes(catId.toLowerCase());
                          }).length;
                          if (count === 0) return null;
                          return (
                            <span key={catId} className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-blue-50 text-blue-700 border border-blue-100">
                              {getCategoryName(catId)}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3 w-full mt-3">
                      <span className="text-[10px] text-slate-400 font-bold">التفاصيل</span>
                      <button type="button" className="p-1.5 rounded-xl bg-blue-600 text-white shadow-sm group-hover:bg-blue-700">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 🟡 Club-affiliated Tournament Branch (Yellow Card) */}
                {hasClub && (
                  <div
                    id="results-club-affiliated-championship-card"
                    onClick={() => {
                      setSelectedAffiliation('club_affiliated');
                      setActiveBranchModal('club_affiliated');
                    }}
                    className="text-right p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-sm hover:shadow-xl bg-amber-50/70 hover:bg-amber-50 border-amber-300/80 hover:border-amber-500 text-amber-950 group"
                  >
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between w-full gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-amber-100 text-amber-900 border-amber-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500" />
                          🟡 بطولة المنتمين للأندية
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {clubPendingCount > 0 && (
                            <span className="text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-xl border border-red-200">
                              ⏳ {clubPendingCount} في انتظار المصادقة
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-amber-900 bg-amber-200/80 px-2 py-0.5 rounded-xl border border-amber-200">
                            {clubMatchesCount} مباراة
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-black text-amber-950 mt-1 group-hover:text-amber-800 transition-colors">
                        نتائج صنف المنتمين للأندية والجمعيات
                      </h4>
                      <p className="text-[11px] text-amber-900/80 font-medium leading-tight">
                        البرمجة والنتائج الخاصة بالتلاميذ المنخرطين بالنوادي والجامعات الرياضية.
                      </p>

                      {/* Category matches count breakdown */}
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-amber-200/60 pt-2">
                        {sportCategories.slice(0, 4).map(catId => {
                          const count = sportMatches.filter(m => {
                            const mAff = getMatchAffiliation(m);
                            if (mAff !== 'club_affiliated') return false;
                            const mCat = (m.ageCategory || '').toLowerCase();
                            return mCat === catId.toLowerCase() || mCat.includes(catId.toLowerCase());
                          }).length;
                          if (count === 0) return null;
                          return (
                            <span key={catId} className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-amber-100 text-amber-900 border border-amber-200">
                              {getCategoryName(catId)}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-amber-200/60 pt-3 w-full mt-3">
                      <span className="text-[10px] text-amber-800 font-bold">التفاصيل</span>
                      <button type="button" className="p-1.5 rounded-xl bg-amber-500 text-white shadow-sm group-hover:bg-amber-600">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}

                {/* 🟢 Open Tournament Branch (Green Card) */}
                {hasOpen && (
                  <div
                    id="results-open-championship-card"
                    onClick={() => {
                      setSelectedAffiliation('open');
                      setActiveBranchModal('open');
                    }}
                    className="text-right p-5 rounded-3xl border-2 transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[220px] relative overflow-hidden shadow-sm hover:shadow-xl bg-emerald-50/70 hover:bg-emerald-50 border-emerald-300/80 hover:border-emerald-500 text-emerald-950 group"
                  >
                    <div className="space-y-3 w-full">
                      <div className="flex items-center justify-between w-full gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black px-2.5 py-1 rounded-full border bg-emerald-100 text-emerald-900 border-emerald-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          🟢 البطولات المفتوحة
                        </span>
                        <div className="flex items-center gap-1 flex-wrap">
                          {openPendingCount > 0 && (
                            <span className="text-[10px] font-black text-red-700 bg-red-50 px-2 py-0.5 rounded-xl border border-red-200">
                              ⏳ {openPendingCount} في انتظار المصادقة
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-emerald-900 bg-emerald-200/80 px-2 py-0.5 rounded-xl border border-emerald-200">
                            {openMatchesCount} مباراة
                          </span>
                        </div>
                      </div>

                      <h4 className="text-sm font-black text-emerald-950 mt-1 group-hover:text-emerald-800 transition-colors">
                        نتائج البطولات المفتوحة
                      </h4>
                      <p className="text-[11px] text-emerald-900/80 font-medium leading-tight">
                        البرمجة والنتائج الخاصة بالدوريات والبطولات المفتوحة لجميع الفئات والمشاركين.
                      </p>

                      {/* Category matches count breakdown */}
                      <div className="mt-2 flex flex-wrap gap-1 border-t border-emerald-200/60 pt-2">
                        {sportCategories.slice(0, 4).map(catId => {
                          const count = sportMatches.filter(m => {
                            const mAff = getMatchAffiliation(m);
                            if (mAff !== 'open') return false;
                            const mCat = (m.ageCategory || '').toLowerCase();
                            return mCat === catId.toLowerCase() || mCat.includes(catId.toLowerCase());
                          }).length;
                          if (count === 0) return null;
                          return (
                            <span key={catId} className="text-[9px] px-1.5 py-0.5 rounded-lg font-bold bg-emerald-100 text-emerald-900 border border-emerald-200">
                              {getCategoryName(catId)}: {count}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-emerald-200/60 pt-3 w-full mt-3">
                      <span className="text-[10px] text-emerald-800 font-bold">التفاصيل</span>
                      <button type="button" className="p-1.5 rounded-xl bg-emerald-500 text-white shadow-sm group-hover:bg-emerald-600">
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* INNER BRANCH MODAL WINDOW (نافذة نتائج الصنف المحددة) */}
              {activeBranchModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-1.5 sm:p-5 overflow-hidden dir-rtl">
                  <div className="w-full max-w-5xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto max-h-[95dvh] sm:max-h-[92vh] flex flex-col">
                    {/* Inner Modal Header */}
                    <div
                      className={cn(
                        "px-3 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 border-b shrink-0 text-white",
                        activeBranchModal === 'club_affiliated'
                          ? 'bg-gradient-to-r from-yellow-600 via-yellow-700 to-yellow-800 border-yellow-500/30'
                          : activeBranchModal === 'open'
                          ? 'bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 border-emerald-500/30'
                          : 'bg-gradient-to-r from-blue-700 via-indigo-800 to-slate-900 border-blue-500/30'
                      )}
                    >
                      <div className="flex items-start sm:items-center justify-between gap-2.5 min-w-0 w-full sm:w-auto">
                        <div className="flex items-start sm:items-center gap-2.5 sm:gap-3 min-w-0">
                          <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center text-lg sm:text-2xl shadow-inner border border-white/20 shrink-0">
                            {activeBranchModal === 'club_affiliated' ? '🟡' : activeBranchModal === 'open' ? '🟢' : '⚪'}
                          </div>
                          <div className="min-w-0 text-right">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-white/20 text-white whitespace-nowrap">
                                {activeBranchModal === 'club_affiliated' ? 'بطولة المنتمين للأندية' : activeBranchModal === 'open' ? 'البطولة المفتوحة' : 'بطولة غير المنتمين للأندية'}
                              </span>
                              <span className="text-[10px] text-white/85 font-bold whitespace-nowrap">{sport.name} - {activeSeason}</span>
                            </div>
                            <h3 className="text-xs sm:text-base font-black text-white mt-1 leading-snug break-words">
                              {activeBranchModal === 'club_affiliated'
                                ? `نافذة نتائج ومباريات صنف المنتمين للأندية والجمعيات (${clubMatchesCount} مباراة)`
                                : activeBranchModal === 'open'
                                ? `نافذة نتائج ومباريات البطولة المفتوحة (${openMatchesCount} مباراة)`
                                : `نافذة نتائج ومباريات صنف غير المنتمين للأندية (${nonClubMatchesCount} مباراة)`}
                            </h3>
                          </div>
                        </div>

                        {/* Mobile Close Button pinned cleanly to top corner */}
                        <button
                          type="button"
                          onClick={() => {
                            setPendingBranchReset(null);
                            setActiveBranchModal(null);
                          }}
                          className="sm:hidden p-1.5 bg-white/15 hover:bg-white/25 text-white rounded-full transition-colors cursor-pointer border border-white/25 shrink-0"
                          title="إغلاق"
                        >
                          <X className="w-4.5 h-4.5" />
                        </button>
                      </div>

                      <div className={cn(
                        "items-center gap-1.5 sm:gap-2 shrink-0",
                        canManage ? "grid grid-cols-2 sm:flex w-full sm:w-auto" : "hidden sm:flex"
                      )}>
                        {canManage && onOpenElectronicDraw && (
                          <button
                            type="button"
                            onClick={() => onOpenElectronicDraw(sport.id)}
                            className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl text-[11px] sm:text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                            title="فتح القرعة الإلكترونية لإعادة برمجة هذا الفرع"
                          >
                            <Shuffle className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span>القرعة الإلكترونية</span>
                          </button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => onCreateMatch(sport.id, activeBranchModal)}
                            className="px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[11px] sm:text-xs font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="sm:hidden">برمجة مباراة</span>
                            <span className="hidden sm:inline">برمجة مباراة بهذا الصنف</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setPendingBranchReset(null);
                            setActiveBranchModal(null);
                          }}
                          className="hidden sm:flex p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors cursor-pointer border border-white/25 shrink-0"
                          title="إغلاق"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    {/* Inner Modal Content */}
                    <div className="p-3 sm:p-6 overflow-y-auto overscroll-contain flex-1 min-h-0 bg-slate-50 space-y-4 sm:space-y-5">
                      {/* Branch Tournaments Management Box for Central Admin & Tech Head */}
                      {canManage && (
                        <div className="p-3 sm:p-4 bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-slate-900/10 rounded-2xl border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                          <div className="flex items-start sm:items-center gap-2 min-w-0">
                            <ShieldCheck className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-blue-700 shrink-0 mt-0.5 sm:mt-0" />
                            <div className="min-w-0">
                              <h5 className="text-xs font-black text-slate-800 leading-snug">
                                إدارة بطولات {sport.name} ({activeBranchModal === 'club_affiliated' ? 'المنتمين للأندية' : activeBranchModal === 'open' ? 'البطولة المفتوحة' : 'غير المنتمين للأندية'})
                              </h5>
                              <p className="text-[11px] text-slate-600 font-medium leading-snug">
                                يمكنك تعديل بيانات البطولات المحدثة لهذا الصنف أو حذفها نهائياً
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                            {(activeBranchModal === 'non_club' ? nonClubTournaments : activeBranchModal === 'club_affiliated' ? clubTournaments : openTournaments).map(t => {
                              const tCatLabel = t.ageCategory ? getCategoryName(normalizeCategoryKey(t.ageCategory)) : '';
                              const tGenLabel = t.gender && GENDER_MAP[t.gender] ? GENDER_MAP[t.gender].name : '';
                              const hasMetaInName = tCatLabel && t.name.includes(tCatLabel);
                              return (
                                <div key={t.id} className="flex items-center justify-between sm:justify-start gap-2 px-2.5 py-1.5 sm:py-1 bg-white rounded-xl border border-slate-300 shadow-2xs text-[11px] sm:text-xs font-bold text-slate-800">
                                  <span className="break-words leading-snug min-w-0">
                                    {t.name}
                                    {!hasMetaInName && (tCatLabel || tGenLabel) ? (
                                      <span className="text-[10px] font-semibold text-slate-500 mr-1">
                                        ({[tCatLabel, tGenLabel].filter(Boolean).join(' • ')})
                                      </span>
                                    ) : null}
                                  </span>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    {onEditTournament && (
                                      <button
                                        type="button"
                                        onClick={() => onEditTournament(t)}
                                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                                        title="تعديل البطولة"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                    {onDeleteTournament && (
                                      <button
                                        type="button"
                                        onClick={() => onDeleteTournament(t)}
                                        className="p-1 text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                        title="حذف البطولة"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Filter Controls for Level 3 (Category Tabs, Gender, Search) */}
                      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5 sm:space-y-3">
                        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                          {/* Category Pills */}
                          <div className="relative flex items-center gap-1.5 w-full">
                            <button
                              type="button"
                              onClick={() => {
                                const container = document.getElementById('category-container');
                                if (container) container.scrollBy({ left: -150, behavior: 'smooth' });
                              }}
                              className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </button>
                            <div id="category-container" className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none flex-1">
                              <span className="text-xs font-bold text-slate-500 whitespace-nowrap ml-1">الفئة:</span>
                              <button
                                type="button"
                                onClick={() => setSelectedCategory('ALL')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                  selectedCategory === 'ALL'
                                    ? 'bg-slate-900 dark:bg-blue-600 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                              >
                                جميع الفئات
                              </button>
                              {sportCategories.map(catId => (
                                <button
                                  key={catId}
                                  type="button"
                                  onClick={() => setSelectedCategory(catId)}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                                    selectedCategory === catId
                                      ? 'bg-blue-600 text-white shadow-xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {getCategoryName(catId)}
                                </button>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const container = document.getElementById('category-container');
                                if (container) container.scrollBy({ left: 150, behavior: 'smooth' });
                              }}
                              className="p-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0"
                            >
                              <ChevronLeft className="w-4 h-4 rotate-180" />
                            </button>
                          </div>

                          {/* Gender & Status Filters */}
                          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
                            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 flex-1 sm:flex-none justify-between sm:justify-start">
                              <button
                                type="button"
                                onClick={() => setSelectedGender('ALL')}
                                className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                  selectedGender === 'ALL' ? 'bg-white text-slate-900 shadow-2xs ring-1 ring-slate-300 dark:ring-blue-500/60' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                الكل
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedGender('Male')}
                                className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                  selectedGender === 'Male' ? 'bg-white text-blue-700 shadow-2xs ring-1 ring-blue-300 dark:ring-blue-500/60' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                👦 ذكور
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedGender('Female')}
                                className={`flex-1 sm:flex-none px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                                  selectedGender === 'Female' ? 'bg-white text-pink-700 shadow-2xs ring-1 ring-pink-300 dark:ring-pink-500/60' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                👧 إناث
                              </button>
                            </div>

                            <select
                              value={statusFilter}
                              onChange={(e) => setStatusFilter(e.target.value)}
                              aria-label="تصفية حسب حالة المباراة"
                              className={cn(
                                "flex-1 sm:flex-none min-w-[140px] px-3 py-1.5 text-xs font-bold rounded-xl border focus:outline-none focus:ring-2 cursor-pointer transition-colors",
                                statusFilter === 'Ongoing'
                                  ? 'bg-red-50 text-red-700 border-red-300 focus:ring-red-400'
                                  : statusFilter === 'Scheduled'
                                  ? 'bg-blue-50 text-blue-800 border-blue-300 focus:ring-blue-400'
                                  : statusFilter === 'Completed'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-400'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 focus:ring-blue-400'
                              )}
                            >
                              <option value="ALL">جميع الحالات ({branchStatusCounts.all})</option>
                              <option value="Ongoing">🔴 جارية الآن ({branchStatusCounts.ongoing})</option>
                              <option value="Scheduled">📅 مبرمجة ({branchStatusCounts.scheduled})</option>
                              <option value="Completed">🏆 مكتملة ({branchStatusCounts.completed})</option>
                            </select>
                          </div>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-2.5" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="البحث باسم المؤسسة المنافسة، القاعة الرياضية، أو الدور..."
                            className="w-full pr-9 pl-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      {/* GROUP STANDINGS (3/1/0) & KNOCKOUT BRACKET TREE (only shown in full 'ALL' view so status filters immediately show filtered matches) */}
                      {statusFilter === 'ALL' && branchStandingsBuckets.length > 0 && (
                        <div className="space-y-4">
                          {branchStandingsBuckets.map(bucket => (
                            <div key={bucket.key} className="space-y-4">
                              {/* 1. Group Standings Tables (ذهاب فقط / ذهاب وإياب) */}
                              {bucket.standings.length > 0 && (
                                <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                                  <div className="px-4 py-3 bg-gradient-to-l from-slate-900 via-blue-950 to-slate-900 text-white flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Trophy className="w-4 h-4 text-amber-400" />
                                      <span className="text-xs font-black">
                                        الترتيب والنقط {bucket.label ? `— ${bucket.label}` : ''}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                                      <span className="px-2 py-0.5 rounded-full bg-white/15 border border-white/20">
                                        {bucket.standings[0]?.systemLabel}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/30 text-emerald-200">
                                        فوز: 3ن • تعادل: 1ن • هزيمة: 0ن
                                      </span>
                                      {canResetBranchProgram && bucket.knockoutMatches.length === 0 && (
                                        <button
                                          type="button"
                                          disabled={isResettingBranchProgram}
                                          onClick={() =>
                                            setPendingBranchReset({
                                              key: `bucket_standings_${bucket.key}`,
                                              label: bucket.label || 'هذا الفرع',
                                              matchIds: bucket.allMatches.map(m => m.id),
                                              knockoutCount: bucket.knockoutMatches.length,
                                              totalCount: bucket.allMatches.length
                                            })
                                          }
                                          className="px-2.5 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white border border-rose-400/50 text-[10px] font-black transition-all cursor-pointer inline-flex items-center gap-1 disabled:opacity-50"
                                          title="مسح برمجة هذا الفرع لإعادة برمجتها من جديد"
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                          <span>مسح البرمجة لإعادة البرمجة</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {pendingBranchReset?.key === `bucket_standings_${bucket.key}` && (
                                    <div className="p-3 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="flex items-start gap-2 text-xs font-bold text-rose-950">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                        <span>
                                          هل أنت متأكد من مسح برمجة «{pendingBranchReset.label}» بالكامل ({pendingBranchReset.totalCount} مباراة) لإعادة برمجتها من جديد؟
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 justify-end">
                                        <button
                                          type="button"
                                          disabled={isResettingBranchProgram}
                                          onClick={() => setPendingBranchReset(null)}
                                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                                        >
                                          تراجع
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isResettingBranchProgram}
                                          onClick={handleConfirmBranchProgramReset}
                                          className="px-3.5 py-1.5 rounded-lg text-[11px] font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                                        >
                                          {isResettingBranchProgram ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>جاري المسح...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Trash2 className="w-3.5 h-3.5" />
                                              <span>تأكيد المسح الآن</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="p-3 sm:p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {bucket.standings.map(grp => (
                                      <div key={grp.groupName} className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50/40">
                                        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
                                          <span className="font-black text-slate-800">{grp.groupName}</span>
                                          <span className="text-[10px] font-bold text-slate-500">
                                            {grp.completedMatches}/{grp.totalMatches} مباريات مصادق عليها
                                          </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-[11px] text-right">
                                            <thead className="bg-white border-b border-slate-200 text-slate-500 font-black">
                                              <tr>
                                                <th className="py-2 px-2 text-center w-8 whitespace-nowrap">#</th>
                                                <th className="py-2 px-2 min-w-[120px] whitespace-nowrap">المؤسسة</th>
                                                <th className="py-2 px-1.5 text-center">ل</th>
                                                <th className="py-2 px-1.5 text-center">ف</th>
                                                <th className="py-2 px-1.5 text-center">ت</th>
                                                <th className="py-2 px-1.5 text-center">هـ</th>
                                                <th className="py-2 px-1.5 text-center">له</th>
                                                <th className="py-2 px-1.5 text-center">عليه</th>
                                                <th className="py-2 px-1.5 text-center">+/-</th>
                                                <th className="py-2 px-2 text-center text-blue-800">النقط</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 bg-white">
                                              {grp.rows.map(row => (
                                                <tr
                                                  key={row.teamId}
                                                  className={cn(
                                                    row.rank === 1 && grp.completedMatches > 0 ? 'bg-emerald-50/60' : ''
                                                  )}
                                                >
                                                  <td className="py-2 px-2 text-center font-black">
                                                    <span
                                                      className={cn(
                                                        'inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px]',
                                                        row.rank === 1 && grp.completedMatches > 0
                                                          ? 'bg-emerald-600 text-white'
                                                          : 'bg-slate-100 text-slate-700'
                                                      )}
                                                    >
                                                      {row.rank}
                                                    </span>
                                                  </td>
                                                  <td className="py-2 px-2 font-bold text-slate-800">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                      <span>{row.teamName}</span>
                                                      {row.rank === 1 && grp.completedMatches > 0 && (
                                                        <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                          متصدر
                                                        </span>
                                                      )}
                                                      {row.hasExactTieWithPrev && (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800">
                                                          تعادل تام
                                                        </span>
                                                      )}
                                                    </div>
                                                  </td>
                                                  <td className="py-2 px-1.5 text-center font-mono">{row.played}</td>
                                                  <td className="py-2 px-1.5 text-center font-mono text-emerald-700 font-bold">{row.won}</td>
                                                  <td className="py-2 px-1.5 text-center font-mono text-amber-700">{row.drawn}</td>
                                                  <td className="py-2 px-1.5 text-center font-mono text-rose-600">{row.lost}</td>
                                                  <td className="py-2 px-1.5 text-center font-mono">{row.gf}</td>
                                                  <td className="py-2 px-1.5 text-center font-mono">{row.ga}</td>
                                                  <td className="py-2 px-1.5 text-center font-mono font-bold" dir="ltr">
                                                    {row.gd > 0 ? `+${row.gd}` : row.gd}
                                                  </td>
                                                  <td className="py-2 px-2 text-center font-mono font-black text-blue-800 bg-blue-50/50">
                                                    {row.points}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* 2. Knockout Bracket Tree Overview (نظام المجموعات إقصاء مباشر) */}
                              {bucket.knockoutMatches.length > 0 && (
                                <div className="bg-white rounded-2xl border border-indigo-200 shadow-2xs overflow-hidden">
                                  <div className="px-4 py-3 bg-gradient-to-l from-indigo-900 via-slate-900 to-indigo-950 text-white flex flex-wrap items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <Award className="w-4 h-4 text-amber-400" />
                                      <span className="text-xs font-black">
                                        شجرة ومواجهات الإقصاء المباشر {bucket.label ? `— ${bucket.label}` : ''}
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/15 border border-white/20">
                                        الترقية التلقائية للفائزين نحو النهائي
                                      </span>
                                      {canResetBranchProgram && (
                                        <button
                                          type="button"
                                          disabled={isResettingBranchProgram}
                                          onClick={() =>
                                            setPendingBranchReset({
                                              key: `bucket_ko_${bucket.key}`,
                                              label: bucket.label || 'هذا الفرع',
                                              matchIds: bucket.allMatches.map(m => m.id),
                                              knockoutCount: bucket.knockoutMatches.length,
                                              totalCount: bucket.allMatches.length
                                            })
                                          }
                                          className="px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-700 text-white border border-rose-400/50 text-[10px] font-black transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                                          title="مسح برمجة هذا الفرع وشجرة مقابلاته لإعادة برمجتها من جديد"
                                        >
                                          <RotateCcw className="w-3 h-3" />
                                          <span>مسح البرمجة والشجرة لإعادة البرمجة</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  {pendingBranchReset?.key === `bucket_ko_${bucket.key}` && (
                                    <div className="p-3 bg-rose-50 border-b border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                      <div className="flex items-start gap-2 text-xs font-bold text-rose-950">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                        <span>
                                          تحذير: سيتم مسح برمجة «{pendingBranchReset.label}» وشجرة مقابلاتها بالكامل ({pendingBranchReset.totalCount} مباراة، منها {pendingBranchReset.knockoutCount} في شجرة الإقصاء المباشر) لإعادة برمجتها من جديد. هل تريد المتابعة؟
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0 justify-end">
                                        <button
                                          type="button"
                                          disabled={isResettingBranchProgram}
                                          onClick={() => setPendingBranchReset(null)}
                                          className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                                        >
                                          تراجع
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isResettingBranchProgram}
                                          onClick={handleConfirmBranchProgramReset}
                                          className="px-3.5 py-1.5 rounded-lg text-[11px] font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                                        >
                                          {isResettingBranchProgram ? (
                                            <>
                                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                              <span>جاري المسح...</span>
                                            </>
                                          ) : (
                                            <>
                                              <Trash2 className="w-3.5 h-3.5" />
                                              <span>تأكيد المسح وإعادة البرمجة</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  <div className="p-3 sm:p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                    {bucket.knockoutMatches.map((km, kIdx) => {
                                      const kt1 = getSchoolName(km.team1Id, km.team1Name);
                                      const kt2 = getSchoolName(km.team2Id, km.team2Name);
                                      const kComp = km.status === 'Completed' && km.approvalStatus !== 'provisional';
                                      const ks1 = km.score1 ?? km.team1Score ?? 0;
                                      const ks2 = km.score2 ?? km.team2Score ?? 0;
                                      const kW1 = kComp && (km.winnerId === km.team1Id || ks1 > ks2 || (ks1 === ks2 && (km.penalty1 ?? 0) > (km.penalty2 ?? 0)));
                                      const kW2 = kComp && (km.winnerId === km.team2Id || ks2 > ks1 || (ks1 === ks2 && (km.penalty2 ?? 0) > (km.penalty1 ?? 0)));

                                      return (
                                        <div key={km.id} className="rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 space-y-2">
                                          <div className="flex items-center justify-between gap-1 text-[10px] font-black">
                                            <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-900">
                                              {km.stage || `المباراة ${km.drawMatchNumber || kIdx + 1}`}
                                            </span>
                                            <span className={cn(
                                              'px-1.5 py-0.5 rounded-full text-[9px]',
                                              kComp ? 'bg-emerald-100 text-emerald-800' : 'bg-white text-slate-500 border border-slate-200'
                                            )}>
                                              {kComp ? '✅ حُسمت' : '⏳ مبرمجة'}
                                            </span>
                                          </div>
                                          <div className="space-y-1 text-[11px] font-bold">
                                            <div className={cn(
                                              'flex items-center justify-between gap-2 px-2 py-1 rounded-lg border',
                                              kW1 ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black' : 'bg-white border-slate-200 text-slate-800'
                                            )}>
                                              <span className="break-words leading-snug">{kt1}</span>
                                              <span className="font-mono shrink-0">{km.status === 'Completed' || km.status === 'Ongoing' ? ks1 : '—'}</span>
                                            </div>
                                            <div className={cn(
                                              'flex items-center justify-between gap-2 px-2 py-1 rounded-lg border',
                                              kW2 ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-black' : 'bg-white border-slate-200 text-slate-800'
                                            )}>
                                              <span className="break-words leading-snug">{kt2}</span>
                                              <span className="font-mono shrink-0">{km.status === 'Completed' || km.status === 'Ongoing' ? ks2 : '—'}</span>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* MATCHES LIST / GRID */}
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h4 className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                            <span>قائمة المقابلات المبرمجة والنتائج</span>
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                              {activeBranchMatches.length} مباراة
                            </span>
                          </h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            {isCentralAdmin && activeBranchMatches.some(m => isMatchProgramPendingApproval(m)) && (
                              <button
                                type="button"
                                disabled={isBatchApprovingProgram}
                                onClick={() => handleBatchApproveBranchProgram(activeBranchMatches)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>
                                  {isBatchApprovingProgram
                                    ? 'جاري المصادقة...'
                                    : `المصادقة على البرنامج (${activeBranchMatches.filter(m => isMatchProgramPendingApproval(m)).length})`}
                                </span>
                              </button>
                            )}
                            {isCentralAdmin && activeBranchMatches.some(m => !isMatchProgramPendingApproval(m)) && (
                              <button
                                type="button"
                                disabled={isBatchRevertingProgram}
                                onClick={() => handleBatchRevertBranchProgram(activeBranchMatches)}
                                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                                <span>
                                  {isBatchRevertingProgram
                                    ? 'جاري التراجع...'
                                    : `التراجع عن المصادقة (${activeBranchMatches.filter(m => !isMatchProgramPendingApproval(m)).length})`}
                                </span>
                              </button>
                            )}
                            {canResetBranchProgram && activeBranchMatches.length > 0 && (
                              <button
                                type="button"
                                disabled={isResettingBranchProgram}
                                onClick={() =>
                                  setPendingBranchReset({
                                    key: 'active_branch_list',
                                    label: `${
                                      activeBranchModal === 'non_club'
                                        ? 'غير المنتمين للأندية'
                                        : activeBranchModal === 'club_affiliated'
                                        ? 'المنتمين للأندية'
                                        : 'البطولة المفتوحة'
                                    }${selectedCategory !== 'ALL' ? ` — ${getCategoryName(selectedCategory)}` : ''}${
                                      selectedGender === 'Male' ? ' — ذكور' : selectedGender === 'Female' ? ' — إناث' : ''
                                    }`,
                                    matchIds: activeBranchMatches.map(m => m.id),
                                    knockoutCount: activeBranchMatches.filter(isKnockoutBracketMatch).length,
                                    totalCount: activeBranchMatches.length
                                  })
                                }
                                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                                title="مسح كافة المباريات المبرمجة وشجرة المواجهات الظاهرة في هذا التحديد لإعادة برمجتها من جديد"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>مسح البرمجة والشجرة ({activeBranchMatches.length})</span>
                              </button>
                            )}
                            <span className="text-[11px] text-slate-500 font-bold">
                              الصنف: {activeBranchModal === 'non_club' ? '⚪ غير المنتمين للأندية' : activeBranchModal === 'club_affiliated' ? '🟡 المنتمين للأندية' : '🟢 البطولة المفتوحة'}
                            </span>
                          </div>
                        </div>

                        {pendingBranchReset?.key === 'active_branch_list' && (
                          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-2 text-xs font-bold text-rose-950">
                              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                              <span>
                                تحذير: سيتم مسح برمجة «{pendingBranchReset.label}» بالكامل ({pendingBranchReset.totalCount} مباراة{pendingBranchReset.knockoutCount > 0 ? ` تشمل ${pendingBranchReset.knockoutCount} مباراة في شجرة الإقصاء` : ''}) لإعادة برمجتها من جديد. هل تريد المتابعة؟
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 justify-end">
                              <button
                                type="button"
                                disabled={isResettingBranchProgram}
                                onClick={() => setPendingBranchReset(null)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                              >
                                تراجع
                              </button>
                              <button
                                type="button"
                                disabled={isResettingBranchProgram}
                                onClick={handleConfirmBranchProgramReset}
                                className="px-4 py-1.5 rounded-lg text-xs font-black bg-rose-600 hover:bg-rose-700 text-white shadow-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                              >
                                {isResettingBranchProgram ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>جاري المسح...</span>
                                  </>
                                ) : (
                                  <>
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>تأكيد المسح وإعادة البرمجة</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}

                        {activeBranchMatches.length === 0 ? (
                          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 space-y-3">
                            <Trophy className="w-10 h-10 text-slate-300 mx-auto" />
                            {statusFilter !== 'ALL' ? (
                              <>
                                <div>
                                  <p className="text-sm font-bold text-slate-700">
                                    {statusFilter === 'Ongoing'
                                      ? 'لا توجد مباريات جارية الآن (مباشر) في هذا التصنيف حالياً'
                                      : statusFilter === 'Completed'
                                      ? 'لا توجد مباريات مكتملة النتائج في هذا التصنيف بعد'
                                      : 'لا توجد مباريات مبرمجة قادمة في هذا التصنيف'}
                                  </p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {statusFilter === 'Ongoing'
                                      ? 'تظهر هنا المقابلات التي يتم تشغيل وضعها المباشر («جارية الآن») أثناء اللعب من طرف الحكم أو اللجنة التقنية.'
                                      : 'يمكنك العودة لعرض جميع الحالات للاطلاع على باقي المقابلات المبرمجة في هذا الصنف.'}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setStatusFilter('ALL')}
                                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                  <span>عرض جميع الحالات ({branchStatusCounts.all})</span>
                                </button>
                              </>
                            ) : (
                              <>
                                <div>
                                  <p className="text-sm font-bold text-slate-700">لا توجد مباريات مبرمجة في هذا التصنيف بعد</p>
                                  <p className="text-xs text-slate-500 mt-1">
                                    يمكنك إضافة مباراة جديدة لهذا الصنف بالضغط على زر "برمجة مباراة لهذا الصنف".
                                  </p>
                                </div>
                                {canManage && (
                                  <button
                                    type="button"
                                    onClick={() => onCreateMatch(sport.id, activeBranchModal)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer"
                                  >
                                    <Plus className="w-4 h-4" />
                                    <span>برمجة مباراة الآن</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {activeBranchMatches.map((m, idx) => {
                              const t1Name = formatTeamDisplayName(m.team1Id, m.team1Name || m.team1SchoolName, schools, m.team1Placeholder, m.team1SourceMatchNumber);
                              const t2Name = formatTeamDisplayName(m.team2Id, m.team2Name || m.team2SchoolName, schools, m.team2Placeholder, m.team2SourceMatchNumber);
                              const groupLabel = extractMatchGroupLabel(m);
                              const matchNum = m.drawMatchNumber ?? (idx + 1);
                              const hasPendingSlot = isPlaceholderTeamId(m.team1Id) || isPlaceholderTeamId(m.team2Id);
                              const vName = getVenueName(m.venueId, m.venueName, m.hostSchoolId);
                              const hostSchoolObj = resolveHostSchoolForMatch(m, schools);
                              const rawResolvedRefs = resolveMatchRefereesInfo(m, effectiveReferees, effectiveUsers);
                              const visibleResolvedRefs = rawResolvedRefs;
                              const matchReferees = rawResolvedRefs.allRefs;
                              const visibleMatchReferees = visibleResolvedRefs.allRefs;
                              const isProgramPending = isMatchProgramPendingApproval(m);
                              const matchForPermCheck = m.sportId ? m : { ...m, sportId: sport.id };
                              const canScoreThisMatch = canUserEnterMatchScore(userProfile, matchForPermCheck, effectiveReferees, effectiveUsers);
                              const isTechHeadForMatchSport = isUserTechHeadForSport(userProfile, m.sportId || sport.id, effectiveUsers);

                              const normalizedMatchStatus = String(m.status || 'Scheduled').trim().toLowerCase();
                              const isCompleted = normalizedMatchStatus === 'completed';
                              const isOngoing = normalizedMatchStatus === 'ongoing';
                              const canShowScoreButtons =
                                canScoreThisMatch && (isTechHeadForMatchSport || !(isCompleted && m.approvalStatus === 'approved'));

                              const s1 = m.score1 ?? 0;
                              const s2 = m.score2 ?? 0;
                              const isT1Winner = isCompleted && (
                                m.winnerId === m.team1Id ||
                                (s1 > s2) ||
                                (s1 === s2 && m.penalty1 !== undefined && m.penalty2 !== undefined && m.penalty1 > m.penalty2)
                              );
                              const isT2Winner = isCompleted && (
                                m.winnerId === m.team2Id ||
                                (s2 > s1) ||
                                (s1 === s2 && m.penalty1 !== undefined && m.penalty2 !== undefined && m.penalty2 > m.penalty1)
                              );

                              return (
                                <div
                                  key={m.id}
                                  className={cn(
                                    "p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between space-y-2.5 shadow-3xs hover:shadow-xs",
                                    isProgramPending
                                      ? 'bg-slate-200/95 border-slate-300 hover:border-slate-400'
                                      : activeBranchModal === 'club_affiliated'
                                      ? 'bg-yellow-50/10 border-yellow-200 hover:border-yellow-300'
                                      : activeBranchModal === 'open'
                                      ? 'bg-emerald-50/10 border-emerald-200 hover:border-emerald-300'
                                      : 'bg-white border-slate-150 hover:border-blue-300'
                                  )}
                                >
                                  {/* Compact Header: Match Number, Group, Round, Category, Gender, Program Approval, Status */}
                                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[10px] font-bold text-slate-500 border-b border-slate-100/80 pb-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-900 font-black">
                                        المباراة رقم {matchNum}
                                      </span>
                                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-black">
                                        الدور: {m.stage || 'دور المجموعات'}
                                      </span>
                                      {groupLabel && (
                                        <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-black">
                                          {groupLabel}
                                        </span>
                                      )}
                                      {m.ageCategory && (
                                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-extrabold">
                                          {m.ageCategory}
                                        </span>
                                      )}
                                      {m.gender && GENDER_MAP[m.gender] && (
                                        <span className="px-1.5 py-0.5 rounded bg-slate-50 text-slate-600 font-extrabold">
                                          {GENDER_MAP[m.gender].icon} {GENDER_MAP[m.gender].name}
                                        </span>
                                      )}
                                    </div>

                                    {isProgramPending && (
                                      <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-300 text-[10px] font-black text-center shrink-0">
                                        في انتظار المصادقة على البرنامج
                                      </span>
                                    )}

                                    {/* Status Badge */}
                                    <span
                                      className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-black inline-flex items-center gap-1 border shrink-0",
                                        isOngoing
                                          ? "bg-red-50 text-red-700 border-red-200 animate-pulse"
                                          : isCompleted && m.approvalStatus === 'provisional'
                                          ? "bg-amber-50 text-amber-800 border-amber-300"
                                          : isCompleted
                                          ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                                          : "bg-blue-50 text-blue-700 border-blue-150"
                                      )}
                                    >
                                      {isOngoing && <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-ping" />}
                                      {isOngoing
                                        ? '🔴 جارية'
                                        : isCompleted && m.approvalStatus === 'provisional'
                                        ? '⏳ نتيجة أولية'
                                        : isCompleted
                                        ? '✅ نتيجة مصادق عليها'
                                        : '📅 مبرمجة'}
                                    </span>
                                  </div>

                                  {/* Compact Unified Scoreboard (Responsive: Stacked rows on mobile, side-by-side on desktop) */}
                                  <div className={cn(
                                    "py-2 px-2.5 rounded-xl border",
                                    isProgramPending ? "bg-slate-100/90 border-slate-300 grayscale opacity-80" : "bg-slate-50/60 border-slate-100/80"
                                  )}>
                                    {/* Desktop view (sm:flex side-by-side) */}
                                    <div className="hidden sm:flex items-center justify-between">
                                      {/* Team 1 Side (RTL Right) */}
                                      <div className="w-[43%] flex items-center gap-1.5 justify-start min-w-0">
                                        <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                                          🏫
                                        </span>
                                        <span
                                          className={cn(
                                            "text-xs font-black text-slate-800 truncate leading-none",
                                            isCompleted && isT1Winner && "text-blue-700 font-black"
                                          )}
                                          title={t1Name}
                                        >
                                          {t1Name}
                                        </span>
                                        {isCompleted && isT1Winner && (
                                          <Trophy className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" title="الفائز" />
                                        )}
                                      </div>

                                      {/* Scores Box */}
                                      <div className="w-[14%] flex flex-col items-center justify-center shrink-0">
                                        {isCompleted || isOngoing ? (
                                          <div className="bg-white px-2 py-0.5 rounded-lg border border-slate-200 shadow-3xs font-mono font-black text-xs text-slate-800 flex items-center gap-1">
                                            <span className={cn(isCompleted && isT1Winner && "text-blue-600 font-black")}>
                                              {m.score1 ?? 0}
                                            </span>
                                            <span className="text-slate-400 font-normal">:</span>
                                            <span className={cn(isCompleted && isT2Winner && "text-blue-600 font-black")}>
                                              {m.score2 ?? 0}
                                            </span>
                                          </div>
                                        ) : (
                                          <span className="text-[10px] font-black text-slate-400">VS</span>
                                        )}
                                      </div>

                                      {/* Team 2 Side (RTL Left) */}
                                      <div className="w-[43%] flex items-center gap-1.5 justify-end min-w-0">
                                        {isCompleted && isT2Winner && (
                                          <Trophy className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" title="الفائز" />
                                        )}
                                        <span
                                          className={cn(
                                            "text-xs font-black text-slate-800 truncate leading-none",
                                            isCompleted && isT2Winner && "text-blue-700 font-black"
                                          )}
                                          title={t2Name}
                                        >
                                          {t2Name}
                                        </span>
                                        <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[10px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                                          🏫
                                        </span>
                                      </div>
                                    </div>

                                    {/* Mobile View (sm:hidden stacked rows) */}
                                    <div className="flex sm:hidden flex-col gap-1.5 w-full">
                                      {/* Team 1 (Top Row on Mobile) */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[9px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                                            🏫
                                          </span>
                                          <span
                                            className={cn(
                                              "text-[11px] font-black text-slate-800 break-words leading-snug",
                                              isCompleted && isT1Winner && "text-blue-700"
                                            )}
                                            title={t1Name}
                                          >
                                            {t1Name}
                                          </span>
                                          {isCompleted && isT1Winner && (
                                            <Trophy className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                                          )}
                                        </div>
                                        <div className="shrink-0 font-mono text-[11px] font-black">
                                          {isCompleted || isOngoing ? (
                                            <span className={cn(
                                              "px-1.5 py-0.5 rounded border block text-center min-w-[22px]",
                                              isCompleted && isT1Winner ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-white text-slate-600 border-slate-200"
                                            )}>
                                              {m.score1 ?? 0}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 font-bold">—</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Team 2 (Bottom Row on Mobile) */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          <span className="w-5 h-5 rounded-full bg-blue-50 text-blue-700 text-[9px] flex items-center justify-center border border-blue-100 shrink-0 font-bold">
                                            🏫
                                          </span>
                                          <span
                                            className={cn(
                                              "text-[11px] font-black text-slate-800 break-words leading-snug",
                                              isCompleted && isT2Winner && "text-blue-700"
                                            )}
                                            title={t2Name}
                                          >
                                            {t2Name}
                                          </span>
                                          {isCompleted && isT2Winner && (
                                            <Trophy className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                                          )}
                                        </div>
                                        <div className="shrink-0 font-mono text-[11px] font-black">
                                          {isCompleted || isOngoing ? (
                                            <span className={cn(
                                              "px-1.5 py-0.5 rounded border block text-center min-w-[22px]",
                                              isCompleted && isT2Winner ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-white text-slate-600 border-slate-200"
                                            )}>
                                              {m.score2 ?? 0}
                                            </span>
                                          ) : (
                                            <span className="text-slate-400 font-bold">—</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Penalties or Scorers compact details */}
                                  {(m.penalty1 !== undefined || m.penalty2 !== undefined || m.scorers) && (
                                    <div className="text-[10px] sm:text-[9px] text-slate-500 font-bold bg-amber-50/55 border border-amber-100 p-1.5 rounded-lg flex flex-col gap-0.5">
                                      {(m.penalty1 !== undefined || m.penalty2 !== undefined) && (
                                        <div className="flex items-center justify-center gap-1 text-amber-900 font-black">
                                          🎯 ركلات الترجيح: ({m.penalty1 ?? 0} - {m.penalty2 ?? 0})
                                        </div>
                                      )}
                                      {m.scorers && (
                                        <div className="text-center break-words leading-snug" title={m.scorers}>
                                          ⚽ الهدافون: <span className="font-medium text-slate-600">{m.scorers}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Assigned Referees Summary (Separated into Field & Table Referees) */}
                                  <div className={cn(
                                    "border rounded-xl px-2.5 py-2 space-y-1.5",
                                    isProgramPending ? "bg-slate-100/80 border-slate-300 grayscale opacity-80" : "bg-slate-50 border-slate-200/80"
                                  )}>
                                    {(visibleResolvedRefs.fieldRefs.length > 0 || visibleResolvedRefs.tableRefs.length > 0) ? (
                                      <>
                                        {visibleResolvedRefs.fieldRefs.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-black shrink-0">
                                              <ShieldCheck className="w-3 h-3 text-emerald-700 shrink-0" />
                                              <span>حكام الساحة:</span>
                                            </span>
                                            {visibleResolvedRefs.fieldRefs.map((refEntry, rIdx) => {
                                              const contact = findRefereeContact(refEntry, effectiveReferees, effectiveUsers);
                                              const displayName = contact.name || (!isOpaqueEntityId(refEntry) ? refEntry : '');
                                              if (!displayName) return null;
                                              return (
                                                <span
                                                  key={`${m.id}-field-ref-${rIdx}`}
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-emerald-200/80 text-[10px] font-bold text-slate-700"
                                                >
                                                  <span>🏁 {displayName}</span>
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                        {visibleResolvedRefs.tableRefs.length > 0 && (
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-800 border border-sky-200 text-[10px] font-black shrink-0">
                                              <span>📋 حكام الطاولة:</span>
                                            </span>
                                            {visibleResolvedRefs.tableRefs.map((refEntry, rIdx) => {
                                              const contact = findRefereeContact(refEntry, effectiveReferees, effectiveUsers);
                                              const displayName = contact.name || (!isOpaqueEntityId(refEntry) ? refEntry : '');
                                              if (!displayName) return null;
                                              return (
                                                <span
                                                  key={`${m.id}-table-ref-${rIdx}`}
                                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-sky-200/80 text-[10px] font-bold text-slate-700"
                                                >
                                                  <span>📋 {displayName}</span>
                                                </span>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </>
                                    ) : visibleMatchReferees.length > 0 ? (
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-700">
                                          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <span>الحكام:</span>
                                        </span>
                                        {visibleMatchReferees.map((refEntry, rIdx) => {
                                          const contact = findRefereeContact(refEntry, effectiveReferees, effectiveUsers);
                                          const displayName = contact.name || (!isOpaqueEntityId(refEntry) ? refEntry : '');
                                          if (!displayName) return null;
                                          return (
                                            <span
                                              key={`${m.id}-ref-${rIdx}`}
                                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[10px] font-bold text-slate-700"
                                            >
                                              <span>🏁 {displayName}</span>
                                            </span>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5">
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-slate-700">
                                          <ShieldCheck className="w-3 h-3 text-emerald-600 shrink-0" />
                                          <span>التحكيم:</span>
                                        </span>
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] font-black text-amber-800">
                                          يعين لاحقاً
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {isCentralAdmin && (
                                    isProgramPending ? (
                                      <button
                                        type="button"
                                        disabled={approvingProgramMatchId === m.id}
                                        onClick={() => handleApproveMatchProgram(m)}
                                        className="w-full py-2 px-3 rounded-xl bg-gradient-to-l from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white text-[11px] font-black shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>{approvingProgramMatchId === m.id ? 'جاري المصادقة...' : 'المصادقة على البرنامج'}</span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={revertingProgramMatchId === m.id}
                                        onClick={() => handleRevertMatchProgram(m)}
                                        className="w-full py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                      >
                                        <Undo2 className="w-3.5 h-3.5 shrink-0" />
                                        <span>{revertingProgramMatchId === m.id ? 'جاري التراجع...' : 'التراجع عن مصادقة برمجة المقابلة'}</span>
                                      </button>
                                    )
                                  )}

                                  {/* Provisional Result Notice & Homologation Controls */}
                                  {isCompleted && m.approvalStatus === 'provisional' && (
                                    <div className="bg-amber-50/90 border border-amber-300 rounded-xl p-2.5 space-y-2">
                                      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-amber-950">
                                        <span>
                                          ⏳ نتيجة أولية مدونة من طرف <strong className="font-black">{m.recordedByName || 'حكم المقابلة'}</strong> — في انتظار المصادقة الرسمية
                                        </span>
                                      </div>
                                      {canApproveThisSport && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => handleApproveMatchInline(m, true)}
                                            className="flex-1 min-w-[170px] py-1.5 px-2.5 rounded-lg bg-gradient-to-l from-emerald-600 to-green-700 hover:from-emerald-700 hover:to-green-800 text-white text-[10px] font-black shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-1"
                                          >
                                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                            <span>مصادقة وإخبار المعنيين بالنتيجة</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleApproveMatchInline(m, false)}
                                            className="py-1.5 px-2.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-[10px] font-black transition-all cursor-pointer"
                                          >
                                            مصادقة فقط
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Unified One-Click Match Broadcast Buttons (Schedule & Final Approved Result) */}
                                  {(canManage || canApproveThisSport) && (
                                    <div className="flex flex-col gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const sportName = sport.name || SPORTS_MAP[m.sportId]?.name || '';
                                          setDiffusionTarget({
                                            matchId: m.id,
                                            mode: 'schedule',
                                            sportId: m.sportId || sport.id,
                                            sportName,
                                            ageCategory: m.ageCategory,
                                            gender: m.gender && GENDER_MAP[m.gender] ? GENDER_MAP[m.gender].name : m.gender,
                                            stageName: m.stage,
                                            team1Id: m.team1Id,
                                            team2Id: m.team2Id,
                                            team1Name: t1Name,
                                            team2Name: t2Name,
                                            hostSchoolId: m.hostSchoolId || hostSchoolObj?.id,
                                            venueId: m.venueId,
                                            venueName: vName,
                                            dateStr: formatMatchDate(m.date),
                                            timeStr: m.startTime || '10:00',
                                              referees: matchReferees,
                                              tableReferees: rawResolvedRefs.tableRefs,
                                              fieldReferees: rawResolvedRefs.fieldRefs,
                                              notes: m.notes,
                                              score1: m.score1 ?? m.team1Score,
                                              score2: m.score2 ?? m.team2Score,
                                              penalty1: m.penalty1,
                                              penalty2: m.penalty2,
                                              scorers: m.scorers,
                                              approvedByName: m.approvedByName || userProfile?.fullName
                                            });
                                          }}
                                          className="w-full py-2 px-3 rounded-xl bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white shadow-2xs transition-all cursor-pointer flex items-center justify-between gap-2 active:scale-[0.99]"
                                        >
                                          <span className="flex items-center gap-1.5 text-[11px] font-black min-w-0 text-right">
                                            <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                                            <span className="leading-snug break-words">إشعار المعنيين ببرمجة المقابلة</span>
                                          </span>
                                          <span className="hidden xs:inline-flex sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 border border-white/25 text-[9px] font-extrabold shrink-0" dir="ltr">
                                            <Share2 className="w-2.5 h-2.5" />
                                            <span>Nouvelle diffusion</span>
                                          </span>
                                        </button>

                                        {isCompleted && m.approvalStatus !== 'provisional' && canApproveThisSport && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              const sportName = sport.name || SPORTS_MAP[m.sportId]?.name || '';
                                              setDiffusionTarget({
                                                matchId: m.id,
                                                mode: 'result',
                                                sportId: m.sportId || sport.id,
                                                sportName,
                                                ageCategory: m.ageCategory,
                                                gender: m.gender && GENDER_MAP[m.gender] ? GENDER_MAP[m.gender].name : m.gender,
                                                stageName: m.stage,
                                                team1Id: m.team1Id,
                                                team2Id: m.team2Id,
                                                team1Name: t1Name,
                                                team2Name: t2Name,
                                                hostSchoolId: m.hostSchoolId || hostSchoolObj?.id,
                                                venueId: m.venueId,
                                                venueName: vName,
                                                dateStr: formatMatchDate(m.date),
                                                timeStr: m.startTime || '10:00',
                                                referees: matchReferees,
                                                tableReferees: rawResolvedRefs.tableRefs,
                                                fieldReferees: rawResolvedRefs.fieldRefs,
                                                notes: m.notes,
                                                score1: m.score1 ?? m.team1Score ?? 0,
                                                score2: m.score2 ?? m.team2Score ?? 0,
                                                penalty1: m.penalty1,
                                                penalty2: m.penalty2,
                                                scorers: m.scorers,
                                                approvedByName: m.approvedByName || userProfile?.fullName || 'رئيس اللجنة التقنية'
                                              });
                                          }}
                                          className="w-full py-2 px-3 rounded-xl bg-gradient-to-l from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white shadow-2xs transition-all cursor-pointer flex items-center justify-between gap-2 active:scale-[0.99]"
                                        >
                                          <span className="flex items-center gap-1.5 text-[11px] font-black min-w-0 text-right">
                                            <Trophy className="w-3.5 h-3.5 shrink-0 text-amber-300" />
                                            <span className="leading-snug break-words">إخبار المعنيين بالنتيجة النهائية المصادق عليها</span>
                                          </span>
                                          <span className="hidden xs:inline-flex sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/15 border border-white/25 text-[9px] font-extrabold shrink-0">
                                            6 فئات معنية
                                          </span>
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {/* Optional Match Notes Display / Inline Editor */}
                                  {(m.notes?.trim() || editingNoteMatchId === m.id || canManage) && (
                                    <div className="pt-1">
                                      {editingNoteMatchId === m.id ? (
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl p-1.5">
                                          <input
                                            type="text"
                                            value={noteDraft}
                                            onChange={(e) => setNoteDraft(e.target.value)}
                                            placeholder="اكتب ملاحظة اختيارية حول هذه المباراة..."
                                            className="flex-1 min-w-0 px-2 py-1 text-[10px] font-medium bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            autoFocus
                                          />
                                          <div className="flex items-center gap-1 self-end sm:self-auto shrink-0">
                                            <button
                                              type="button"
                                              disabled={savingNoteMatchId === m.id}
                                              onClick={() => handleSaveInlineNote(m)}
                                              className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-bold cursor-pointer disabled:opacity-50"
                                            >
                                              {savingNoteMatchId === m.id ? 'جاري الحفظ...' : 'حفظ'}
                                            </button>
                                            <button
                                              type="button"
                                              disabled={savingNoteMatchId === m.id}
                                              onClick={() => {
                                                setEditingNoteMatchId(null);
                                                setNoteDraft('');
                                              }}
                                              className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[9px] font-bold cursor-pointer"
                                            >
                                              إلغاء
                                            </button>
                                          </div>
                                        </div>
                                      ) : m.notes?.trim() ? (
                                        <div className="flex items-center justify-between gap-2 bg-amber-50/70 border border-amber-200/80 rounded-lg px-2 py-1 text-[10px] text-amber-950">
                                          <span className="font-medium break-words">📝 {m.notes}</span>
                                          {canManage && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingNoteMatchId(m.id);
                                                setNoteDraft(m.notes || '');
                                              }}
                                              className="text-[9px] font-bold text-amber-800 hover:text-amber-950 underline shrink-0 cursor-pointer"
                                            >
                                              تعديل
                                            </button>
                                          )}
                                        </div>
                                      ) : canManage ? (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingNoteMatchId(m.id);
                                            setNoteDraft('');
                                          }}
                                          className="text-[10px] font-bold text-slate-400 hover:text-blue-600 transition-colors cursor-pointer flex items-center gap-1"
                                        >
                                          <span>+ إضافة ملاحظة (اختياري)</span>
                                        </button>
                                      ) : null}
                                    </div>
                                  )}

                                  {/* Venue, Date & Compact Action Buttons Footer */}
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between text-[10px] text-slate-500 font-bold pt-2 border-t border-slate-100/70 gap-2">
                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-slate-500 w-full sm:flex-1 min-w-0">
                                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                      <span className="break-words sm:truncate" title={vName}>{vName}</span>
                                      <span className="text-slate-300 shrink-0">•</span>
                                      <span className="shrink-0">{formatMatchDate(m.date)}</span>
                                      {m.startTime && (
                                        <>
                                          <span className="text-slate-300 shrink-0">•</span>
                                          <span className="shrink-0">{m.startTime}</span>
                                        </>
                                      )}
                                    </div>

                                    {/* Inline Actions */}
                                    {(canManage || canShowScoreButtons) ? (
                                      <div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto flex-wrap justify-end">
                                        {canShowScoreButtons && !hasPendingSlot && !isCompleted && (
                                          <button
                                            type="button"
                                            disabled={togglingLiveMatchId === m.id}
                                            onClick={() => handleToggleLiveMatchStatus(m, isOngoing ? 'Scheduled' : 'Ongoing')}
                                            title={isOngoing ? 'إعادة الحالة إلى مبرمجة' : 'تشغيل وضع المباراة الجارية الآن (مباشر)'}
                                            className={cn(
                                              "px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-lg text-[10px] sm:text-[9px] font-black transition-all flex items-center gap-1 shadow-3xs cursor-pointer disabled:opacity-50",
                                              isOngoing
                                                ? "bg-red-100 hover:bg-red-200 text-red-700 border border-red-300"
                                                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                                            )}
                                          >
                                            <span>{isOngoing ? '⏸️ إيقاف المباشر' : '🔴 مباشر الآن'}</span>
                                          </button>
                                        )}

                                        {canShowScoreButtons && (
                                          <button
                                            type="button"
                                            disabled={hasPendingSlot}
                                            onClick={() => onEditScore(m)}
                                            title={hasPendingSlot ? 'بانتظار حسم المباراة السابقة لتحديد المتأهل' : 'تسجيل أو تعديل النتيجة'}
                                            className={cn(
                                              "px-2.5 py-1.5 sm:py-1 rounded-lg text-[10px] sm:text-[9px] font-black transition-all flex items-center gap-1 shadow-3xs",
                                              hasPendingSlot
                                                ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                                                : isTechHeadForMatchSport
                                                ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                                                : "bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                                            )}
                                          >
                                            <Edit3 className="w-3 h-3 sm:w-2.5 sm:h-2.5" />
                                            <span>
                                              {hasPendingSlot
                                                ? 'بانتظار المتأهل'
                                                : isTechHeadForMatchSport
                                                ? (isCompleted && m.approvalStatus === 'provisional'
                                                  ? 'مراجعة ومصادقة النتيجة'
                                                  : isCompleted
                                                  ? 'تعديل النتيجة'
                                                  : 'تسجيل النتيجة')
                                                : (isCompleted ? 'تعديل النتيجة الأولية' : 'تدوين النتيجة الأولية')}
                                            </span>
                                          </button>
                                        )}

                                        {canManage && (
                                          <button
                                            type="button"
                                            onClick={() => onEditMatch(m)}
                                            className="p-1.5 sm:p-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-all cursor-pointer"
                                            title="تعديل تفاصيل المباراة"
                                          >
                                            <Pencil className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                                          </button>
                                        )}

                                        {(isCentralAdmin || canManage) && (
                                          <button
                                            type="button"
                                            onClick={() => onDeleteMatch(m)}
                                            className="p-1.5 sm:p-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all cursor-pointer"
                                            title="حذف المباراة والنتيجة"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 sm:w-3 sm:h-3" />
                                          </button>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-[9px] text-slate-400 font-normal">عرض فقط</span>
                                    )}
                                  </div>
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
            </>
          )}
        </div>
      </div>

      <MatchBroadcastDiffusionModal
        isOpen={Boolean(diffusionTarget)}
        onClose={() => setDiffusionTarget(null)}
        target={diffusionTarget}
        schools={schools}
        refereesList={effectiveReferees}
        teachersList={effectiveUsers}
        studentsList={students}
      />
    </div>
  );
};
