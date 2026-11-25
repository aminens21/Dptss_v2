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
  Volleyball,
  Award,
  MessageCircle,
  Share2,
  Undo2,
  BookmarkPlus
} from 'lucide-react';
import { Tournament, School, Team, Match, User, Venue, Sport, Referee, SchoolTournamentConfirmation, BlockedSchedulePeriod, DrawSystemType } from '../types';
import { DataService, SPORTS_MAP, GENDER_MAP, deduplicateById, normalizeCategoryKey, getCustomCategoryName, doesConfirmationMatchBranch, EDUCATIONAL_CYCLE_LABELS, getMatchEducationalCycles, findBlockedPeriodForDate, findAllBlockedPeriodsForDate, normalizeArabicSearch, normalizeDateToYmd, schoolNamesMatch, normalizeTournamentAffiliation, normalizeSchoolCycleType } from '../lib/dataService';
import { generateRoundRobinDrawMatches, generateKnockoutGroupsDrawMatches, isPlaceholderTeamId, hasValidMatchTeams, extractMatchGroupLabel } from '../lib/drawTournamentUtils';
import { isOpaqueEntityId } from '../lib/programExportService';
import { isSuperAdminEmail } from '../contexts/AuthContext';
import {
  resolveHostSchoolForMatch,
  findRefereeContact,
  generateRefereeMatchNotificationMessage,
  getWhatsAppUrl
} from '../lib/whatsappService';
import {
  MatchBroadcastDiffusionModal,
  MatchBroadcastDiffusionTarget
} from './MatchBroadcastDiffusionModal';
import { cn } from '../lib/utils';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';

export const TEAM_SPORTS_IDS = ['football', 'basketball', 'handball', 'volleyball', 'rugby', 'futsal'];

export interface GeneratedDrawMatch {
  id: string;
  stage: string;
  groupName?: string;
  drawSystem?: DrawSystemType;
  drawMatchNumber?: number;
  roundIndex?: number;
  leg?: 'first' | 'second';
  team1Id: string;
  team1Name: string;
  team2Id: string;
  team2Name: string;
  team1SourceTempId?: string;
  team2SourceTempId?: string;
  team1SourceMatchNumber?: number;
  team2SourceMatchNumber?: number;
  team1Placeholder?: string;
  team2Placeholder?: string;
  date: string;
  time: string;
  venueId: string;
  venueName: string;
  hostSchoolId?: string;
  venueMode?: 'school' | 'custom';
  refereeId?: string;
  refereeName?: string;
  referee2Id?: string;
  referee2Name?: string;
  refereeIds?: string[];
  refereeNames?: string[];
  tableRefereeIds?: string[];
  tableRefereeNames?: string[];
  fieldRefereeIds?: string[];
  fieldRefereeNames?: string[];
  notes?: string;
}

// Helper to check if a teacher or referee has declared specialization in a given sport
export function isSpecializedInSport(
  specialties: string[] | undefined,
  targetSportId?: string,
  targetSportName?: string
): boolean {
  if (!specialties || !Array.isArray(specialties) || specialties.length === 0) return false;
  if (!targetSportId && !targetSportName) return false;

  const normalizeStr = (s: string) =>
    (s || '')
      .toLowerCase()
      .trim()
      .replace(/[أإآ]/g, 'ا')
      .replace(/ة/g, 'ه')
      .replace(/ى/g, 'ي')
      .replace(/[\s\-_]+/g, '');

  const normTargetId = normalizeStr(targetSportId || '');
  const normTargetName = normalizeStr(targetSportName || '');

  // Determine target family keywords
  const isVolleyball = normTargetId.includes('volleyball') || normTargetName.includes('طايره');
  const isFootball = (normTargetId === 'football' || normTargetId.includes('futsal')) || normTargetName.includes('قدم') || normTargetName.includes('فوتسال');
  const isBasketball = normTargetId.includes('basketball') || normTargetName.includes('سله');
  const isHandball = normTargetId.includes('handball') || normTargetName.includes('يد');
  const isAthletics = normTargetId.includes('athletic') || normTargetId.includes('cross') || normTargetName.includes('قوي') || normTargetName.includes('عدو');
  const isTableTennis = normTargetId.includes('tabletennis') || normTargetName.includes('طاوله');
  const isBadminton = normTargetId.includes('badminton') || normTargetName.includes('بادمنتون');
  const isChess = normTargetId.includes('chess') || normTargetName.includes('شطرنج');
  const isGymnastics = normTargetId.includes('gymnastic') || normTargetName.includes('جمباز');
  const isJudo = normTargetId.includes('judo') || normTargetName.includes('جيدو');
  const isKarate = normTargetId.includes('karate') || normTargetName.includes('كراطي') || normTargetName.includes('كاراتيه');

  return specialties.some(rawSpec => {
    if (!rawSpec || typeof rawSpec !== 'string') return false;
    const normSpec = normalizeStr(rawSpec);

    // 1. Direct match on ID or sport name
    if (normTargetId && normSpec === normTargetId) return true;
    if (normTargetName && normSpec === normTargetName) return true;

    // 2. Check if rawSpec is in SPORTS_MAP
    const mapped = SPORTS_MAP[rawSpec.trim().toLowerCase()];
    if (mapped) {
      const normMappedName = normalizeStr(mapped.name);
      if (normTargetName && normMappedName === normTargetName) return true;
      if (normTargetId && normalizeStr(rawSpec) === normTargetId) return true;
    }

    // 3. Sport family match (e.g. Volleyball matches volleyball, beach_volleyball, mixed_volleyball, الكرة الطائرة, كرة طائرة)
    if (isVolleyball && (normSpec.includes('volleyball') || normSpec.includes('طايره'))) return true;
    if (isFootball && (normSpec === 'football' || normSpec.includes('futsal') || normSpec.includes('قدم') || normSpec.includes('فوتسال'))) return true;
    if (isBasketball && (normSpec.includes('basketball') || normSpec.includes('سله'))) return true;
    if (isHandball && (normSpec.includes('handball') || normSpec.includes('يد'))) return true;
    if (isAthletics && (normSpec.includes('athletic') || normSpec.includes('cross') || normSpec.includes('قوي') || normSpec.includes('عدو'))) return true;
    if (isTableTennis && (normSpec.includes('tabletennis') || normSpec.includes('طاوله'))) return true;
    if (isBadminton && (normSpec.includes('badminton') || normSpec.includes('بادمنتون'))) return true;
    if (isChess && (normSpec.includes('chess') || normSpec.includes('شطرنج'))) return true;
    if (isGymnastics && (normSpec.includes('gymnastic') || normSpec.includes('جمباز'))) return true;
    if (isJudo && (normSpec.includes('judo') || normSpec.includes('جيدو'))) return true;
    if (isKarate && (normSpec.includes('karate') || normSpec.includes('كراطي') || normSpec.includes('كاراتيه'))) return true;

    // 4. Substring inclusion if length >= 4
    if (normTargetId.length >= 4 && normSpec.includes(normTargetId)) return true;
    if (normTargetName.length >= 4 && normSpec.includes(normTargetName)) return true;

    return false;
  });
}

interface ElectronicDrawModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: User | null;
  onMatchesCreated?: () => void;
  initialTournamentId?: string;
  initialSportId?: string;
  initialAffiliation?: 'non_club' | 'club_affiliated' | 'open';
  initialCategory?: string;
  initialGender?: string;
  lockToInitialBranch?: boolean;
}

export const ElectronicDrawModal: React.FC<ElectronicDrawModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onMatchesCreated,
  initialTournamentId,
  initialSportId,
  initialAffiliation,
  initialCategory,
  initialGender,
  lockToInitialBranch = false
}) => {
  // Data State
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [referees, setReferees] = useState<Referee[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [confirmations, setConfirmations] = useState<SchoolTournamentConfirmation[]>([]);
  const [allExistingMatches, setAllExistingMatches] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Workflow State: 1 = Choose Tournament & Filter, 2 = Review Teams & Draw Config, 3 = Draw & Schedule Matches with Referees, 4 = Post-Save WhatsApp Notifications
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(initialTournamentId || '');

  // Step 1 Filtering Options
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>(initialSportId || 'ALL');
  const [selectedAffiliationFilter, setSelectedAffiliationFilter] = useState<string>(
    initialAffiliation && initialAffiliation !== 'open' ? initialAffiliation : 'ALL'
  );
  const [selectedAgeCategoryFilter, setSelectedAgeCategoryFilter] = useState<string>(initialCategory || 'ALL');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>(initialGender || 'ALL');
  const [tournamentSearchQuery, setTournamentSearchQuery] = useState<string>('');

  // Step 2: Draw Configuration & Participating Schools
  const [schoolFilterMode, setSchoolFilterMode] = useState<'CONFIRMED_ONLY' | 'ALL'>('CONFIRMED_ONLY');
  const [participatingSchoolIds, setParticipatingSchoolIds] = useState<string[]>([]);
  const [groupAssignments, setGroupAssignments] = useState<Record<string, number | 'AUTO'>>({});
  const [customTeamNames, setCustomTeamNames] = useState<string[]>([]);
  const [newTeamInput, setNewTeamInput] = useState<string>('');
  const [drawSystem, setDrawSystem] = useState<DrawSystemType>('knockout_groups');
  const [groupsCount, setGroupsCount] = useState<number>(1);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState<string>('');

  // Step 3: Draw Result & Scheduled Matches with Referees
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawnGroups, setDrawnGroups] = useState<{ groupName: string; teams: { id: string; name: string }[] }[]>([]);
  const [byeTeams, setByeTeams] = useState<{ groupName: string; teamName: string }[]>([]);
  const [generatedMatches, setGeneratedMatches] = useState<GeneratedDrawMatch[]>([]);
  const [matchHistory, setMatchHistory] = useState<GeneratedDrawMatch[][]>([]);
  const [savedMatchIds, setSavedMatchIds] = useState<string[]>([]);
  const [savedByTempId, setSavedByTempId] = useState<Record<string, string>>({});
  const [savingSingleMatchId, setSavingSingleMatchId] = useState<string | null>(null);
  const [isRevertingSave, setIsRevertingSave] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Step 3 Search & Manual Match Builder state
  const [step3SchoolSearchQuery, setStep3SchoolSearchQuery] = useState<string>('');
  const [bulkHostSchoolSearch, setBulkHostSchoolSearch] = useState<string>('');
  const [bulkHostSchoolCycleFilter, setBulkHostSchoolCycleFilter] = useState<'ALL' | 'ابتدائي' | 'إعدادي' | 'تأهيلي'>('ALL');
  const [hostSchoolSearchByMatchId, setHostSchoolSearchByMatchId] = useState<Record<string, string>>({});
  const [hostSchoolCycleFilterByMatchId, setHostSchoolCycleFilterByMatchId] = useState<Record<string, 'ALL' | 'ابتدائي' | 'إعدادي' | 'تأهيلي'>>({});
  const [showManualBuilder, setShowManualBuilder] = useState<boolean>(false);
  const [manualIncludeAllSchools, setManualIncludeAllSchools] = useState<boolean>(false);
  const [manualTeam1Id, setManualTeam1Id] = useState<string>('');
  const [manualTeam2Id, setManualTeam2Id] = useState<string>('');
  const [manualMatchNumber, setManualMatchNumber] = useState<string>('');
  const [manualStage, setManualStage] = useState<string>('دور المجموعات');
  const [manualGroupName, setManualGroupName] = useState<string>('');
  const [manualDate, setManualDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [manualTime, setManualTime] = useState<string>('10:00');
  const [manualVenueMode, setManualVenueMode] = useState<'school' | 'custom'>('school');
  const [manualHostSchoolId, setManualHostSchoolId] = useState<string>('');
  const [manualVenueName, setManualVenueName] = useState<string>('');
  const [manualHostSchoolSearch, setManualHostSchoolSearch] = useState<string>('');
  const [manualHostSchoolCycleFilter, setManualHostSchoolCycleFilter] = useState<'ALL' | 'ابتدائي' | 'إعدادي' | 'تأهيلي'>('ALL');

  const matchesHostSchoolCycle = (s: School, cycleFilter: 'ALL' | 'ابتدائي' | 'إعدادي' | 'تأهيلي'): boolean => {
    if (cycleFilter === 'ALL') return true;
    const sc = normalizeSchoolCycleType(s);
    if (sc === cycleFilter) return true;
    if (sc === 'خصوصي') {
      const combined = normalizeArabicSearch(`${s.type || ''} ${s.name || ''}`);
      if (cycleFilter === 'ابتدائي') return combined.includes('ابتدائ') || combined.includes('مدرسه');
      if (cycleFilter === 'إعدادي') return combined.includes('اعداد');
      if (cycleFilter === 'تأهيلي') return combined.includes('تاهيل');
    }
    return false;
  };

  // Batch edit helpers
  const [bulkDate, setBulkDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [bulkTime, setBulkTime] = useState<string>('10:00');
  const [bulkVenueMode, setBulkVenueMode] = useState<'school' | 'custom'>('school');
  const [bulkHostSchoolId, setBulkHostSchoolId] = useState<string>('');
  const [bulkVenueName, setBulkVenueName] = useState<string>('');
  const [bulkRefereeId, setBulkRefereeId] = useState<string>('');
  const [bulkRefereeIds, setBulkRefereeIds] = useState<string[]>([]);
  const [bulkTableRefereeIds, setBulkTableRefereeIds] = useState<string[]>(['', '']);
  const [bulkFieldRefereeIds, setBulkFieldRefereeIds] = useState<string[]>(['', '']);
  const [showAllRefereesFallback, setShowAllRefereesFallback] = useState<boolean>(false);
  const [diffusionTarget, setDiffusionTarget] = useState<MatchBroadcastDiffusionTarget | null>(null);
  const [blockedPeriods, setBlockedPeriods] = useState<BlockedSchedulePeriod[]>([]);
  const [isSavingVenue, setIsSavingVenue] = useState<boolean>(false);

  const uniqueSavedVenues = useMemo(() => {
    const seen = new Set<string>();
    return venues.filter(v => {
      const norm = normalizeArabicSearch(v?.name || '');
      if (!norm || seen.has(norm)) return false;
      seen.add(norm);
      return true;
    });
  }, [venues]);

  const isVenueNameSaved = (rawName: string): boolean => {
    const norm = normalizeArabicSearch(rawName || '');
    if (!norm) return false;
    return uniqueSavedVenues.some(v => normalizeArabicSearch(v.name || '') === norm);
  };

  const saveCustomVenueIfNeeded = async (rawName: string, showFeedback = false): Promise<Venue | undefined> => {
    const cleanName = (rawName || '').trim();
    if (!cleanName) {
      if (showFeedback) toast.error('يرجى كتابة اسم الفضاء الرياضي أولاً');
      return undefined;
    }
    const normTarget = normalizeArabicSearch(cleanName);
    const existing = venues.find(v => normalizeArabicSearch(v.name || '') === normTarget);
    if (existing) {
      if (showFeedback) toast.success(`الفضاء "${existing.name}" محفوظ بالفعل في القائمة`);
      return existing;
    }
    try {
      setIsSavingVenue(true);
      const activeDirId = currentUser?.directorateId || DataService.getActiveDirectorateId() || 'taourirt';
      const created = await DataService.addVenue({
        name: cleanName,
        city: activeDirId === 'all' ? 'تاوريرت' : activeDirId,
        address: 'فضاء رياضي إقليمي',
        directorateId: activeDirId === 'all' ? 'taourirt' : activeDirId
      });
      setVenues(prev => [created, ...prev.filter(v => v.id !== created.id)]);
      if (showFeedback) toast.success(`تم حفظ الفضاء "${cleanName}" وسيظل متاحاً للاختيار في كل مرة ✅`);
      return created;
    } catch (err) {
      console.warn('Error saving custom venue:', err);
      if (showFeedback) toast.error('تعذر حفظ الفضاء في القائمة');
      return undefined;
    } finally {
      setIsSavingVenue(false);
    }
  };

  const isRegionalOrCentralAdmin = useMemo(() => {
    if (!currentUser) return false;
    return (
      currentUser.role === 'CENTRAL_ADMIN' ||
      currentUser.role === 'SUPER_ADMIN' ||
      currentUser.isSuperAdmin === true ||
      isSuperAdminEmail(currentUser.email)
    );
  }, [currentUser]);

  useEffect(() => {
    if (!isOpen) return;
    const unsubBlocked = DataService.subscribeToBlockedScheduleDates((periods) => {
      setBlockedPeriods(periods);
    });
    const unsubVenues = DataService.subscribeToVenues((liveVenues) => {
      if (Array.isArray(liveVenues)) {
        setVenues(liveVenues);
      }
    });
    return () => {
      unsubBlocked();
      unsubVenues();
    };
  }, [isOpen]);

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
          loadedTeachers,
          loadedConfirmations,
          loadedMatches
        ] = await Promise.all([
          DataService.getTournaments(),
          DataService.getSportsConfig(),
          DataService.getSchools(),
          DataService.getStudents(),
          DataService.getVenues(),
          DataService.getReferees(),
          DataService.getUsers(),
          DataService.getSchoolConfirmations(),
          DataService.getMatches()
        ]);

        const activeDirId = currentUser?.directorateId || DataService.getActiveDirectorateId() || 'taourirt';
        const dirMatches = activeDirId === 'all'
          ? loadedMatches
          : loadedMatches.filter(m => !m.directorateId || m.directorateId === activeDirId);

        setTournaments(loadedTournaments);
        setSportsConfig(loadedSports);
        setSchools(loadedSchools);
        setVenues(loadedVenues);
        setReferees(loadedReferees);
        setTeachers(loadedTeachers);
        setConfirmations(loadedConfirmations);
        setAllExistingMatches(dirMatches);

        // Derive team records from students (strictly preserving branch affiliation, category, and gender)
        const derivedTeams: Team[] = [];
        const seenTeamKeys = new Set<string>();
        loadedStudents.forEach(st => {
          if (st.schoolId && st.sportId) {
            const stCat = normalizeCategoryKey(st.category || 'U15');
            const stGender = st.gender === 'Female' ? 'Female' : 'Male';
            const stAff = normalizeTournamentAffiliation(st.affiliationType);
            const key = `${st.schoolId}_${st.sportId}_${stCat}_${stGender}_${stAff}`;
            if (!seenTeamKeys.has(key)) {
              seenTeamKeys.add(key);
              const sc = loadedSchools.find(s => s.id === st.schoolId);
              derivedTeams.push({
                id: `team_${st.schoolId}_${st.sportId}_${stCat}_${stAff}`,
                name: sc?.name || st.schoolName || 'فريق مدرسي',
                schoolId: st.schoolId,
                sportId: st.sportId,
                gender: stGender as any,
                category: stCat,
                affiliationType: stAff,
                directorateId: st.directorateId
              } as any);
            }
          }
        });
        setTeams(derivedTeams);

        if (loadedVenues.length > 0) {
          setBulkVenueName(loadedVenues[0].name);
        }

        setSelectedAffiliationFilter(initialAffiliation || 'ALL');
        setSelectedAgeCategoryFilter(initialCategory ? normalizeCategoryKey(initialCategory) : 'ALL');
        setSelectedGenderFilter(initialGender || 'ALL');

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

        // Resolve exact initial tournament branch if passed
        const resolvedById = initialTournamentId ? loadedTournaments.find(t => t.id === initialTournamentId) : undefined;
        const resolvedByBranch = !resolvedById && initialSportId && initialCategory
          ? loadedTournaments.find(t =>
              t.sportId === initialSportId &&
              normalizeCategoryKey(t.ageCategory) === normalizeCategoryKey(initialCategory) &&
              (!initialGender || initialGender === 'ALL' || !t.gender || t.gender === initialGender) &&
              (!initialAffiliation || normalizeTournamentAffiliation(t.affiliationType, t.name) === initialAffiliation)
            )
          : undefined;
        const preselectedTourn = resolvedById || resolvedByBranch;

        if (preselectedTourn) {
          setSelectedTournamentId(preselectedTourn.id);
          setSelectedSportFilter(preselectedTourn.sportId);
          const resolvedAff = normalizeTournamentAffiliation(preselectedTourn.affiliationType, preselectedTourn.name);
          setSelectedAffiliationFilter(resolvedAff === 'open' ? 'ALL' : resolvedAff);
          setSelectedAgeCategoryFilter(normalizeCategoryKey(preselectedTourn.ageCategory || ''));
          setSelectedGenderFilter(preselectedTourn.gender || 'ALL');
          setStep(2);
        } else if (initialSportId) {
          setSelectedSportFilter(initialSportId);
          const matchingTourns = loadedTournaments.filter(t => t.sportId === initialSportId);
          if (matchingTourns.length === 1) {
            setSelectedTournamentId(matchingTourns[0].id);
            setStep(2);
          } else {
            setSelectedTournamentId('');
            setStep(1);
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
  }, [isOpen, initialTournamentId, initialSportId, initialAffiliation, initialCategory, initialGender, currentUser]);

  // Auto switch schoolFilterMode to 'ALL' if 0 confirmed schools in THIS EXACT BRANCH
  useEffect(() => {
    if (selectedTournamentId) {
      const tourn = tournaments.find(t => t.id === selectedTournamentId);
      if (tourn) {
        const branchConfs = confirmations.filter(c =>
          c.status === 'confirmed' &&
          (c.sportId === tourn.sportId || (c.tournamentId && c.tournamentId === tourn.id)) &&
          doesConfirmationMatchBranch(c, {
            category: tourn.ageCategory,
            gender: tourn.gender,
            affiliationType: normalizeTournamentAffiliation(tourn.affiliationType, tourn.name)
          })
        );
        if (branchConfs.length === 0) {
          setSchoolFilterMode('ALL');
        } else {
          setSchoolFilterMode('CONFIRMED_ONLY');
        }
      }
    }
  }, [selectedTournamentId, confirmations, tournaments]);

  // Combined Referees List (Official Referees + Qualified Teachers & Tech Committee Heads, strictly deduplicated, no (أستاذ) suffix)
  const combinedRefereesList = useMemo(() => {
    const cleanRefName = (val?: string) => (val || '').replace(/\s*\(أستاذ\)\s*/g, '').replace(/\s+/g, ' ').trim();
    const list: {
      id: string;
      aliasIds?: string[];
      name: string;
      fullName: string;
      phone?: string;
      specialty?: string;
      specialtiesList: string[];
      type: 'referee' | 'teacher';
    }[] = [];
    const seenIds = new Set<string>();

    referees.forEach(r => {
      if (!r || !r.id || seenIds.has(r.id)) return;
      seenIds.add(r.id);
      if (Array.isArray(r.aliasIds)) {
        r.aliasIds.forEach(aid => seenIds.add(aid));
      }
      const cleanFull = cleanRefName(r.fullName);
      const specs = Array.isArray(r.specialty) ? r.specialty : (r.specialty ? [r.specialty] : []);
      const specLabels = specs.map(s => SPORTS_MAP[s]?.name || s).join('، ');
      list.push({
        id: r.id,
        aliasIds: r.aliasIds,
        name: cleanFull,
        fullName: cleanFull,
        phone: r.phone,
        specialty: specLabels,
        specialtiesList: specs,
        type: 'referee'
      });
    });

    teachers.forEach(t => {
      if (!t || !t.id) return;
      const baseSpecs = Array.isArray(t.refereeSpecialty) ? t.refereeSpecialty : (t.refereeSpecialty ? [t.refereeSpecialty] : []);
      const isQualifiedTechOrTeacher =
        t.role === 'TEACHER' ||
        t.role === 'SPORT_MANAGER' ||
        baseSpecs.length > 0 ||
        Boolean(t.isTechCommitteeHead || t.role === 'TECH_HEAD' || (t.role as string) === 'TECH_COMMITTEE_HEAD');
      if (!isQualifiedTechOrTeacher) return;

      const techSpecs = Array.isArray(t.techCommitteeSports) ? t.techCommitteeSports : [];
      const managerSpecs = t.sportId ? [t.sportId] : [];
      const specs = Array.from(
        new Set([
          ...baseSpecs,
          ...(baseSpecs.length === 0 && (t.isTechCommitteeHead || t.role === 'SPORT_MANAGER' || t.role === 'TECH_HEAD') ? [...techSpecs, ...managerSpecs] : [])
        ].filter(Boolean))
      );
      const tAliases = Array.isArray(t.aliasIds) ? t.aliasIds : [];
      const existingMatch = list.find(
        item =>
          item.id === t.id ||
          tAliases.includes(item.id) ||
          (Array.isArray(item.aliasIds) && (item.aliasIds.includes(t.id) || tAliases.some(aid => item.aliasIds!.includes(aid))))
      );
      if (existingMatch || seenIds.has(t.id)) {
        if (existingMatch) {
          const merged = Array.from(new Set([...existingMatch.specialtiesList, ...specs]));
          existingMatch.specialtiesList = merged;
          existingMatch.specialty = merged.map(s => SPORTS_MAP[s]?.name || s).join('، ');
          existingMatch.aliasIds = Array.from(new Set([...(existingMatch.aliasIds || []), t.id, ...tAliases]));
        }
        return;
      }
      seenIds.add(t.id);
      tAliases.forEach(aid => seenIds.add(aid));
      const cleanFull = cleanRefName(t.fullName);
      const specLabels = specs.map(s => SPORTS_MAP[s]?.name || s).join('، ');
      list.push({
        id: t.id,
        aliasIds: [t.id, ...tAliases],
        name: t.workLocation ? `${cleanFull} (${t.workLocation})` : cleanFull,
        fullName: cleanFull,
        phone: t.phone,
        specialty: specLabels,
        specialtiesList: specs,
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

    const isTechHead = currentUser.isTechCommitteeHead || currentUser.role === 'SPORT_MANAGER' || currentUser.role === 'TECH_HEAD' || (currentUser.role as string) === 'TECH_COMMITTEE_HEAD';
    if (isTechHead) {
      const allowedSports = new Set<string>();
      if (currentUser.sportId) allowedSports.add(currentUser.sportId);
      if (currentUser.techCommitteeSports) currentUser.techCommitteeSports.forEach(s => allowedSports.add(s));
      return Array.from(allowedSports);
    }

    return null;
  }, [currentUser]);

  // Dynamically compute participating age categories programmed in tournament/sport settings
  const availableAgeCategories = useMemo(() => {
    if (selectedSportFilter !== 'ALL') {
      const sp = sportsConfig.find(s => s.id === selectedSportFilter);
      if (sp?.customAgeCategories && sp.customAgeCategories.length > 0) {
        return sp.customAgeCategories.map(c => ({
          id: normalizeCategoryKey(c.id),
          label: `${c.name}${c.yearsExpression ? ` (${c.yearsExpression})` : ''}`
        }));
      }
      if (sp?.ageCategories && sp.ageCategories.length > 0) {
        return sp.ageCategories.map(cat => ({
          id: normalizeCategoryKey(cat),
          label: getCustomCategoryName(cat, sp.id) || cat
        }));
      }
      // For team sports default to U15 and U18
      return [
        { id: 'U15', label: 'صغار (U15)' },
        { id: 'U18', label: 'فتيان (U18)' }
      ];
    }

    // When ALL sports selected: collect categories actually programmed in team sports config or tournaments
    const allProgrammedCats = new Map<string, string>();
    sportsConfig.forEach(sp => {
      const isTeam = TEAM_SPORTS_IDS.includes(sp.id) || (sp.name && (
        sp.name.includes('قدم') || sp.name.includes('سلة') || sp.name.includes('يد') || sp.name.includes('طائرة') || sp.name.includes('ريكبي')
      ));
      if (!isTeam) return;

      if (sp.customAgeCategories && sp.customAgeCategories.length > 0) {
        sp.customAgeCategories.forEach(c => allProgrammedCats.set(normalizeCategoryKey(c.id), c.name));
      } else if (sp.ageCategories && sp.ageCategories.length > 0) {
        sp.ageCategories.forEach(cat => allProgrammedCats.set(normalizeCategoryKey(cat), getCustomCategoryName(cat, sp.id) || cat));
      } else {
        allProgrammedCats.set('U15', 'صغار (U15)');
        allProgrammedCats.set('U18', 'فتيان (U18)');
      }
    });

    if (allProgrammedCats.size > 0) {
      return Array.from(allProgrammedCats.entries()).map(([id, label]) => ({ id, label }));
    }

    return [
      { id: 'U15', label: 'صغار (U15)' },
      { id: 'U18', label: 'فتيان (U18)' }
    ];
  }, [selectedSportFilter, sportsConfig]);

  // Keep selectedAgeCategoryFilter synced
  useEffect(() => {
    if (selectedAgeCategoryFilter !== 'ALL') {
      const exists = availableAgeCategories.some(c => 
        c.id === selectedAgeCategoryFilter || normalizeCategoryKey(c.id) === normalizeCategoryKey(selectedAgeCategoryFilter)
      );
      if (!exists) {
        setSelectedAgeCategoryFilter('ALL');
      }
    }
  }, [availableAgeCategories, selectedAgeCategoryFilter]);

  // Filter Tournaments based on User Role, Team Sports, Sport, Category & Gender (+ semantic branch deduplication)
  const filteredTournaments = useMemo(() => {
    const filtered = tournaments.filter(t => {
      // 1. Role-Based Permission Filter
      if (userSportRestriction && userSportRestriction.length > 0) {
        if (!userSportRestriction.includes(t.sportId)) {
          return false;
        }
      }

      // 2. Electronic Draw is strictly for Team Sports
      if (t.sportId === 'athletics' || t.sportId === 'cross_country' || t.sportId === 'table_tennis') {
        return false;
      }

      const isTeam = TEAM_SPORTS_IDS.includes(t.sportId) || (t.name && (
        t.name.includes('قدم') || t.name.includes('سلة') || t.name.includes('يد') || t.name.includes('طائرة') || t.name.includes('ريكبي')
      ));
      if (!isTeam) return false;

      // Check if tournament category is programmed in sportsConfig
      const spConfig = sportsConfig.find(s => s.id === t.sportId);
      const normTournCat = normalizeCategoryKey(t.ageCategory || '');
      if (spConfig) {
        let allowedCatKeys: string[] = [];
        if (spConfig.customAgeCategories && spConfig.customAgeCategories.length > 0) {
          allowedCatKeys = spConfig.customAgeCategories.map(c => normalizeCategoryKey(c.id));
        } else if (spConfig.ageCategories && spConfig.ageCategories.length > 0) {
          allowedCatKeys = spConfig.ageCategories.map(c => normalizeCategoryKey(c));
        } else {
          allowedCatKeys = ['U15', 'U18'];
        }

        if (!allowedCatKeys.includes(normTournCat)) {
          return false; // Exclude tournaments like U20 (الشبان) if not programmed for this sport
        }
      } else if (normTournCat === 'U20' || normTournCat === 'U12') {
        return false;
      }

      // 3. Sport Type Filter
      if (selectedSportFilter !== 'ALL' && t.sportId !== selectedSportFilter) {
        return false;
      }

      // 3.5. Affiliation Filter (non_club vs club_affiliated vs open)
      if (selectedAffiliationFilter !== 'ALL') {
        const tAff = normalizeTournamentAffiliation(t.affiliationType, t.name);
        if (tAff !== selectedAffiliationFilter) {
          return false;
        }
      }

      // 4. Age Category Filter
      if (selectedAgeCategoryFilter !== 'ALL') {
        const tournNormCat = normalizeCategoryKey(t.ageCategory || '');
        const filterNormCat = normalizeCategoryKey(selectedAgeCategoryFilter);
        if (tournNormCat !== filterNormCat) {
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
        const q = normalizeArabicSearch(tournamentSearchQuery);
        const matchName = normalizeArabicSearch(t.name || '').includes(q);
        const matchSport = normalizeArabicSearch(SPORTS_MAP[t.sportId]?.name || '').includes(q);
        if (!matchName && !matchSport) return false;
      }

      return true;
    });

    // Guarantee unique branch per (sportId, ageCategory, gender, affiliationType)
    const dedupMap = new Map<string, Tournament>();
    filtered.forEach(t => {
      const aff = normalizeTournamentAffiliation(t.affiliationType, t.name);
      const key = `${t.sportId}__${normalizeCategoryKey(t.ageCategory || '')}__${t.gender || 'Mixed'}__${aff}`;
      const existing = dedupMap.get(key);
      if (!existing) {
        dedupMap.set(key, t);
        return;
      }
      if (existing.id.startsWith('tourn-') && !t.id.startsWith('tourn-')) {
        dedupMap.set(key, t);
      }
    });
    return Array.from(dedupMap.values());
  }, [
    tournaments,
    sportsConfig,
    userSportRestriction,
    selectedSportFilter,
    selectedAffiliationFilter,
    selectedAgeCategoryFilter,
    selectedGenderFilter,
    tournamentSearchQuery
  ]);

  // Selected Tournament Object
  const selectedTournament = useMemo(() => {
    return tournaments.find(t => t.id === selectedTournamentId);
  }, [tournaments, selectedTournamentId]);

  // Referees and teachers specialized in this tournament's sport (expressed in their profile)
  const sportSpecializedReferees = useMemo(() => {
    if (!selectedTournament) return [];
    const sportId = selectedTournament.sportId;
    const sportName = selectedTournament.sportName || SPORTS_MAP[sportId]?.name;
    return combinedRefereesList.filter(item =>
      isSpecializedInSport(item.specialtiesList, sportId, sportName)
    );
  }, [combinedRefereesList, selectedTournament]);

  // Active referees list for assignment: strictly specialized by default
  const activeRefereesList = useMemo(() => {
    if (showAllRefereesFallback || sportSpecializedReferees.length === 0) {
      return combinedRefereesList;
    }
    return sportSpecializedReferees;
  }, [showAllRefereesFallback, sportSpecializedReferees, combinedRefereesList]);

  // Current tournament sport name helper
  const currentSportName = useMemo(() => {
    if (!selectedTournament) return '';
    return selectedTournament.sportName || SPORTS_MAP[selectedTournament.sportId]?.name || selectedTournament.sportId;
  }, [selectedTournament]);

  // Compute schools that confirmed participation for this specific tournament branch
  const confirmedSchoolsForTournament = useMemo(() => {
    if (!selectedTournament) return [];
    return confirmations.filter(c => {
      if (c.status !== 'confirmed') return false;

      // Check if school has withdrawn from this tournament or branch
      if (DataService.isSchoolWithdrawn({
        sportId: selectedTournament.sportId,
        tournamentId: selectedTournament.id,
        ageCategory: selectedTournament.ageCategory,
        gender: selectedTournament.gender,
        affiliationType: selectedTournament.affiliationType
      }, c.schoolId, c.schoolName)) {
        return false;
      }

      // 1. Sport check
      const matchesSport = c.sportId === selectedTournament.sportId || (c.tournamentId && c.tournamentId === selectedTournament.id);
      if (!matchesSport) return false;

      // 2. Exact Branch tuple check (Category + Gender + Affiliation)
      return doesConfirmationMatchBranch(c, {
        category: selectedTournament.ageCategory,
        gender: selectedTournament.gender,
        affiliationType: selectedTournament.affiliationType || 'non_club'
      });
    });
  }, [confirmations, selectedTournament]);

  // Map of confirmed schools for quick lookup
  const confirmedSchoolsMap = useMemo(() => {
    const map = new Map<string, SchoolTournamentConfirmation>();
    confirmedSchoolsForTournament.forEach(c => {
      map.set(c.schoolId, c);
      if (c.schoolName) map.set(c.schoolName, c);
    });
    return map;
  }, [confirmedSchoolsForTournament]);

  // When Tournament is selected, automatically detect participating schools/teams
  useEffect(() => {
    if (!selectedTournament) {
      setParticipatingSchoolIds([]);
      setCustomTeamNames([]);
      return;
    }

    const isWithdrawn = (sId: string, sName?: string) => DataService.isSchoolWithdrawn({
      sportId: selectedTournament.sportId,
      tournamentId: selectedTournament.id,
      ageCategory: selectedTournament.ageCategory,
      gender: selectedTournament.gender,
      affiliationType: selectedTournament.affiliationType
    }, sId, sName);

    // Prioritize institutions that explicitly confirmed participation and have NOT withdrawn
    const confirmedIds = confirmedSchoolsForTournament
      .filter(c => !isWithdrawn(c.schoolId, c.schoolName))
      .map(c => {
        const matchSchool = schools.find(s => s.id === c.schoolId || s.name === c.schoolName || s.name === c.schoolId);
        return matchSchool ? matchSchool.id : c.schoolId;
      })
      .filter(Boolean);

    if (confirmedIds.length > 0) {
      setParticipatingSchoolIds(Array.from(new Set(confirmedIds)));
      setSchoolFilterMode('CONFIRMED_ONLY');
    } else {
      // If no school confirmed yet, find teams strictly within THIS EXACT branch excluding withdrawn schools
      const targetNormCat = normalizeCategoryKey(selectedTournament.ageCategory || '');
      const targetAff = normalizeTournamentAffiliation(selectedTournament.affiliationType, selectedTournament.name);
      const matchedTeams = teams.filter(t => {
        const sc = schools.find(s => s.id === t.schoolId);
        if (isWithdrawn(t.schoolId, sc?.name || t.name)) return false;

        if (t.tournamentId && t.tournamentId === selectedTournament.id) return true;
        if (t.sportId === selectedTournament.sportId) {
          const catMatch = !targetNormCat || normalizeCategoryKey(t.category) === targetNormCat;
          const genMatch = !selectedTournament.gender || selectedTournament.gender === 'Mixed' || t.gender === selectedTournament.gender;
          const teamAff = normalizeTournamentAffiliation((t as any).affiliationType);
          const affMatch = targetAff === 'open' || teamAff === targetAff;
          return catMatch && genMatch && affMatch;
        }
        return false;
      });

      let autoSchoolIds = matchedTeams.map(t => t.schoolId).filter(Boolean);
      autoSchoolIds = autoSchoolIds.filter(sId => {
        const sc = schools.find(s => s.id === sId);
        return !isWithdrawn(sId, sc?.name);
      });

      setParticipatingSchoolIds(Array.from(new Set(autoSchoolIds)));
      setSchoolFilterMode('ALL');
    }
  }, [selectedTournament, confirmedSchoolsForTournament, teams, schools]);

  // Toggle school participation
  const toggleSchoolParticipation = (schoolId: string) => {
    setParticipatingSchoolIds(prev => 
      prev.includes(schoolId) ? prev.filter(id => id !== schoolId) : [...prev, schoolId]
    );
  };

  // Filtered Schools for step 2: by mode ('CONFIRMED_ONLY' vs 'ALL') and search
  const filteredSchoolsList = useMemo(() => {
    let baseList = schools;

    if (schoolFilterMode === 'CONFIRMED_ONLY') {
      // Show ONLY institutions that confirmed participation and haven't withdrawn
      baseList = schools.filter(s => 
        (confirmedSchoolsMap.has(s.id) || confirmedSchoolsMap.has(s.name)) &&
        (!selectedTournament || !DataService.isSchoolWithdrawn({
          sportId: selectedTournament.sportId,
          tournamentId: selectedTournament.id,
          ageCategory: selectedTournament.ageCategory,
          gender: selectedTournament.gender,
          affiliationType: selectedTournament.affiliationType
        }, s.id, s.name))
      );
    }

    if (!schoolSearchQuery.trim()) return baseList;
    const q = normalizeArabicSearch(schoolSearchQuery);
    return baseList.filter(s => 
      normalizeArabicSearch(s.name || '').includes(q) || 
      normalizeArabicSearch(s.commune || '').includes(q) ||
      normalizeArabicSearch(s.type || '').includes(q)
    );
  }, [schools, schoolFilterMode, confirmedSchoolsMap, schoolSearchQuery, selectedTournament]);

  const handleSelectAllSchools = () => {
    const idsToAdd = filteredSchoolsList.map(s => s.id);
    setParticipatingSchoolIds(prev => Array.from(new Set([...prev, ...idsToAdd])));
  };

  const handleDeselectAllSchools = () => {
    const idsToRemove = new Set(filteredSchoolsList.map(s => s.id));
    setParticipatingSchoolIds(prev => prev.filter(id => !idsToRemove.has(id)));
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
      if (!school) return; // Skip if school was deleted from schools list

      const schoolName = school.name;

      // Exclude any school that has withdrawn from this tournament
      if (selectedTournament && DataService.isSchoolWithdrawn({
        sportId: selectedTournament.sportId,
        tournamentId: selectedTournament.id,
        ageCategory: selectedTournament.ageCategory,
        gender: selectedTournament.gender,
        affiliationType: selectedTournament.affiliationType
      }, sId, schoolName)) {
        return;
      }

      list.push({
        id: school.id,
        name: school.name,
        schoolName: school.name
      });
    });

    customTeamNames.forEach((cName, idx) => {
      list.push({
        id: `custom-team-${idx}`,
        name: cName,
        schoolName: cName
      });
    });

    return list;
  }, [participatingSchoolIds, customTeamNames, schools, selectedTournament]);

  // Group counts calculation
  const groupCounts = useMemo(() => {
    const counts = Array.from({ length: groupsCount }, () => 0);
    let unassignedCount = 0;

    allDrawTeams.forEach(team => {
      const val = groupAssignments[team.id];
      if (typeof val === 'number' && val >= 0 && val < groupsCount) {
        counts[val]++;
      } else {
        unassignedCount++;
      }
    });

    return { counts, unassignedCount };
  }, [allDrawTeams, groupAssignments, groupsCount]);

  // Helper: auto distribute all teams evenly across groups
  const handleAutoDistributeGroups = () => {
    const shuffled = [...allDrawTeams].sort(() => Math.random() - 0.5);
    const next: Record<string, number> = {};
    shuffled.forEach((team, idx) => {
      next[team.id] = idx % groupsCount;
    });
    setGroupAssignments(next);
    toast.success('تم توزيع المؤسسات المشاركة عشوائياً بالتساوي على المجموعات');
  };

  // Helper: reset group assignments
  const handleResetGroupAssignments = () => {
    setGroupAssignments({});
    toast.success('تمت إعادة الضبط: سيتم توزيع الفرق المتبقية وسحب القرعة آلياً');
  };

  // Push current generatedMatches snapshot to undo stack
  const pushMatchHistorySnapshot = (snapshot: GeneratedDrawMatch[]) => {
    setMatchHistory(prev => [...prev.slice(-19), snapshot.map(m => ({ ...m }))]);
  };

  const handleUndoStep3Edit = () => {
    if (matchHistory.length === 0) return;
    const previous = matchHistory[matchHistory.length - 1];
    setGeneratedMatches(previous);
    setMatchHistory(prev => prev.slice(0, -1));
    toast.success('تم التراجع عن آخر تعديل في جدول المباريات');
  };

  // Enter Manual Programming directly from Step 2 (using branch participating teams)
  const handleEnterManualProgramming = () => {
    setMatchHistory([]);
    setSavedMatchIds([]);
    setSavedByTempId({});
    setByeTeams([]);
    if (allDrawTeams.length > 0) {
      setDrawnGroups([
        {
          groupName: 'الفرق المشاركة في الفرع (برمجة يدوية)',
          teams: [...allDrawTeams]
        }
      ]);
      setManualTeam1Id(allDrawTeams[0]?.id || '');
      setManualTeam2Id(allDrawTeams[1]?.id || '');
    } else {
      setDrawnGroups([]);
      setManualTeam1Id('');
      setManualTeam2Id('');
    }
    setGeneratedMatches([]);
    setShowManualBuilder(true);
    setStep3SchoolSearchQuery('');
    setStep(3);
    toast.success('تم الانتقال إلى البرمجة اليدوية للمباريات انطلاقاً من الفرق المشاركة في الفرع');
  };

  // Team pool available for manual programming (participating branch teams by default, or all directorate schools)
  const manualAvailableTeams = useMemo(() => {
    const base = [...allDrawTeams];
    if (!manualIncludeAllSchools) return base;
    const seenIds = new Set(base.map(t => t.id));
    schools.forEach(s => {
      if (!seenIds.has(s.id)) {
        seenIds.add(s.id);
        base.push({ id: s.id, name: s.name, schoolName: s.name });
      }
    });
    return base;
  }, [allDrawTeams, manualIncludeAllSchools, schools]);

  const nextBranchMatchNumber = useMemo(() => {
    if (!selectedTournament) return generatedMatches.length + 1;
    const tCat = normalizeCategoryKey(selectedTournament.ageCategory || '');
    const tAff = normalizeTournamentAffiliation(selectedTournament.affiliationType, selectedTournament.name);
    const existingNums = allExistingMatches
      .filter(m => {
        if (m.sportId !== selectedTournament.sportId) return false;
        const mCat = m.ageCategory ? normalizeCategoryKey(m.ageCategory) : (m.category ? normalizeCategoryKey(m.category) : '');
        if (mCat && mCat !== tCat) return false;
        if (selectedTournament.gender && selectedTournament.gender !== 'Mixed' && m.gender && m.gender !== selectedTournament.gender) return false;
        const mAff = normalizeTournamentAffiliation(m.affiliationType);
        if (mAff !== tAff) return false;
        return true;
      })
      .map(m => Number(m.drawMatchNumber || 0))
      .filter(n => Number.isFinite(n) && n > 0);
    const generatedNums = generatedMatches
      .map(gm => Number(gm.drawMatchNumber || 0))
      .filter(n => Number.isFinite(n) && n > 0);
    const maxNum = Math.max(0, ...existingNums, ...generatedNums, generatedMatches.length);
    return maxNum + 1;
  }, [selectedTournament, allExistingMatches, generatedMatches]);

  // Add a single manually programmed match in Step 3 (and optionally publish it directly to the program)
  const handleAddManualMatch = async (publishImmediately = false) => {
    if (!manualTeam1Id || !manualTeam2Id) {
      toast.error('يرجى اختيار الفريق الأول والفريق الثاني');
      return;
    }
    if (manualTeam1Id === manualTeam2Id) {
      toast.error('لا يمكن برمجة مباراة بين نفس المؤسسة!');
      return;
    }
    const t1 = manualAvailableTeams.find(t => t.id === manualTeam1Id);
    const t2 = manualAvailableTeams.find(t => t.id === manualTeam2Id);
    if (!t1 || !t2) {
      toast.error('تعذر العثور على بيانات أحد الفريقين المختارين');
      return;
    }

    const targetManualDate = manualDate || new Date().toISOString().slice(0, 10);
    const manualDateConflicts = findAllBlockedPeriodsForDate(
      targetManualDate,
      selectedTournament ? getMatchEducationalCycles({ team1Id: t1.id, team2Id: t2.id, ageCategory: selectedTournament.ageCategory, level: selectedTournament.level, tournamentId: selectedTournament.id }, schools, [selectedTournament]) : ['ALL'],
      blockedPeriods
    );
    const manualStrictHoliday = manualDateConflicts.find(p => p.type === 'holiday');
    const manualExamBlock = manualDateConflicts.find(p => p.type === 'exams');
    if (manualStrictHoliday || manualExamBlock) {
      const blockedItem = manualStrictHoliday || manualExamBlock!;
      const kindLabel = blockedItem.type === 'holiday' ? 'عطلة مدرسية' : 'فترة الامتحانات للسلك المعني';
      toast.error(`ممنوع برمجة المباراة في تاريخ ${targetManualDate}: يصادف ${kindLabel} (${blockedItem.title}).`);
      return;
    }

    const parsedManualNum = Number(manualMatchNumber);
    const resolvedMatchNumber = Number.isFinite(parsedManualNum) && parsedManualNum > 0
      ? Math.floor(parsedManualNum)
      : nextBranchMatchNumber;

    const selectedHost = manualVenueMode === 'school'
      ? schools.find(s => s.id === manualHostSchoolId) || schools.find(s => s.id === t1.id)
      : undefined;

    let resolvedManualVenueId = venues[0]?.id || 'custom';
    let resolvedManualVenueName = manualVenueName.trim() || venues[0]?.name || 'القاعة المغطاة';
    if (manualVenueMode === 'custom' && manualVenueName.trim()) {
      const savedVen = await saveCustomVenueIfNeeded(manualVenueName, false);
      if (savedVen) {
        resolvedManualVenueId = savedVen.id;
        resolvedManualVenueName = savedVen.name;
      }
    }

    const newMatch: GeneratedDrawMatch = {
      id: `manual-match-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      drawMatchNumber: resolvedMatchNumber,
      stage: manualStage.trim() || 'دور المجموعات',
      groupName: manualGroupName.trim() || undefined,
      team1Id: t1.id,
      team1Name: t1.name,
      team2Id: t2.id,
      team2Name: t2.name,
      date: manualDate || new Date().toISOString().slice(0, 10),
      time: manualTime || '10:00',
      venueMode: manualVenueMode === 'custom' ? 'custom' : (selectedHost ? 'school' : 'custom'),
      hostSchoolId: manualVenueMode === 'school' && selectedHost ? selectedHost.id : '',
      venueId: manualVenueMode === 'school' && selectedHost ? selectedHost.id : resolvedManualVenueId,
      venueName:
        manualVenueMode === 'custom'
          ? resolvedManualVenueName
          : (selectedHost?.name || venues[0]?.name || 'القاعة المغطاة'),
      refereeIds: [],
      refereeNames: [],
      tableRefereeIds: ['', ''],
      tableRefereeNames: ['', ''],
      fieldRefereeIds: ['', ''],
      fieldRefereeNames: ['', '']
    };

    pushMatchHistorySnapshot(generatedMatches);
    setGeneratedMatches(prev => [...prev, newMatch]);
    setManualTeam1Id('');
    setManualTeam2Id('');
    setManualMatchNumber('');

    if (publishImmediately) {
      await handleSaveSingleMatchToDatabase(newMatch);
    } else {
      toast.success(`تمت إضافة المباراة رقم ${resolvedMatchNumber}: ${t1.name} ضد ${t2.name}`);
    }
  };

  const handleDeleteGeneratedMatch = (matchId: string) => {
    pushMatchHistorySnapshot(generatedMatches);
    setGeneratedMatches(prev => prev.filter(m => m.id !== matchId));
    toast.success('تم حذف المباراة من الجدول (يمكنك التراجع من زر التراجع)');
  };

  // Step 3 school search filtered matches (only matches with both teams present or winner placeholders)
  const displayedGeneratedMatches = useMemo(() => {
    const validMatches = generatedMatches.filter(m => hasValidMatchTeams(m, schools));
    const q = normalizeArabicSearch(step3SchoolSearchQuery.trim());
    if (!q) return validMatches;
    return validMatches.filter(m =>
      normalizeArabicSearch(m.team1Name || '').includes(q) ||
      normalizeArabicSearch(m.team2Name || '').includes(q) ||
      normalizeArabicSearch(m.venueName || '').includes(q) ||
      normalizeArabicSearch(m.stage || '').includes(q) ||
      normalizeArabicSearch(extractMatchGroupLabel(m) || '').includes(q)
    );
  }, [generatedMatches, schools, step3SchoolSearchQuery]);

  // Execute Electronic Draw (سحب القرعة آلياً)
  const handleExecuteDraw = () => {
    if (allDrawTeams.length < 2) {
      toast.error('يرجى تحديد فريقين على الأقل لإجراء القرعة');
      return;
    }

    setIsDrawing(true);

    setTimeout(() => {
      const alphabet = ['المجموعة أ (Groupe A)', 'المجموعة ب (Groupe B)', 'المجموعة ج (Groupe C)', 'المجموعة د (Groupe D)'];
      const effectiveGroupCount = drawSystem === 'knockout_groups'
        ? Math.min(Math.max(1, groupsCount), allDrawTeams.length)
        : Math.min(Math.max(2, groupsCount), allDrawTeams.length);

      const defaultVenue = venues[0]?.name || 'القاعة المغطاة';
      const defaultDate = new Date().toISOString().slice(0, 10);

      const groups: { groupName: string; teams: { id: string; name: string }[] }[] = [];
      for (let i = 0; i < effectiveGroupCount; i++) {
        groups.push({
          groupName:
            drawSystem === 'knockout_groups' && effectiveGroupCount === 1
              ? 'مسار الإقصاء المباشر'
              : (alphabet[i] || `المجموعة ${i + 1}`),
          teams: []
        });
      }

      if (effectiveGroupCount === 1) {
        groups[0].teams = [...allDrawTeams].sort(() => Math.random() - 0.5);
      } else {
        // 1. Place teams explicitly assigned to specific groups
        const unassignedTeams: typeof allDrawTeams = [];
        allDrawTeams.forEach(team => {
          const assignedIdx = groupAssignments[team.id];
          if (typeof assignedIdx === 'number' && assignedIdx >= 0 && assignedIdx < effectiveGroupCount) {
            groups[assignedIdx].teams.push(team);
          } else {
            unassignedTeams.push(team);
          }
        });

        // 2. Distribute unassigned teams randomly to balance group sizes
        const shuffledUnassigned = [...unassignedTeams].sort(() => Math.random() - 0.5);
        shuffledUnassigned.forEach(team => {
          let minGroupIdx = 0;
          for (let i = 1; i < effectiveGroupCount; i++) {
            if (groups[i].teams.length < groups[minGroupIdx].teams.length) {
              minGroupIdx = i;
            }
          }
          groups[minGroupIdx].teams.push(team);
        });

        // 3. Random shuffle WITHIN EACH GROUP
        groups.forEach(grp => {
          grp.teams = [...grp.teams].sort(() => Math.random() - 0.5);
        });
      }

      const drawDefaults = {
        defaultDate,
        defaultVenueId: venues[0]?.id || 'v1',
        defaultVenueName: defaultVenue,
        defaultRefId: undefined,
        defaultRefName: undefined,
        initialRefIds: [] as string[],
        initialRefNames: [] as string[],
        schools
      };

      let matchesList: GeneratedDrawMatch[] = [];
      let newByeTeams: { groupName: string; teamName: string }[] = [];

      if (drawSystem === 'knockout_groups') {
        const koResult = generateKnockoutGroupsDrawMatches(groups, drawDefaults);
        matchesList = koResult.matches;
        newByeTeams = koResult.byeTeams;
      } else {
        matchesList = generateRoundRobinDrawMatches(groups, drawSystem, drawDefaults);
      }

      const initializedMatches = matchesList.map(m => ({
        ...m,
        tableRefereeIds: ['', ''],
        tableRefereeNames: ['', ''],
        fieldRefereeIds: ['', ''],
        fieldRefereeNames: ['', '']
      }));

      setDrawnGroups(groups);
      setByeTeams(newByeTeams);
      setMatchHistory([]);
      setSavedMatchIds([]);
      setSavedByTempId({});
      setShowManualBuilder(false);
      setStep3SchoolSearchQuery('');
      setGeneratedMatches(initializedMatches);
      setIsDrawing(false);
      setStep(3);
      toast.success(
        drawSystem === 'knockout_groups'
          ? 'تمت القرعة بنظام المجموعات إقصاء مباشر وتوليد شجرة المباريات كاملة!'
          : drawSystem === 'groups_home_away'
          ? 'تمت القرعة بنظام المجموعات ذهاب وإياب وتوليد جدول المباريات بنجاح!'
          : 'تمت القرعة بنظام المجموعات ذهاب فقط وتوليد جدول المباريات بنجاح!'
      );
    }, 700);
  };

  // Update match details (date, time, venue, match number)
  const handleUpdateMatchField = (matchId: string, field: keyof GeneratedDrawMatch, value: string | number) => {
    pushMatchHistorySnapshot(generatedMatches);
    setGeneratedMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m;
        return { ...m, [field]: value };
      })
    );
  };

  const getRefOrdinalLabel = (idx: number) => {
    if (idx === 0) return 'حكم الأول';
    if (idx === 1) return 'حكم الثاني';
    if (idx === 2) return 'حكم الثالث';
    if (idx === 3) return 'حكم الرابع';
    return `حكم ${idx + 1}`;
  };

  const resolveRefCleanName = (refId: string) => {
    const clean = (refId || '').replace(/\s*\(أستاذ\)\s*/g, '').trim();
    if (!clean) return '';
    const refObj = combinedRefereesList.find(
      r =>
        r.id === clean ||
        (Array.isArray(r.aliasIds) && r.aliasIds.includes(clean)) ||
        r.fullName === clean
    );
    if (refObj) {
      return (refObj.fullName || refObj.name || '').replace(/\s*\(أستاذ\)\s*/g, '').trim();
    }
    return isOpaqueEntityId(clean) ? '' : clean;
  };

  const buildSyncedRefereeFields = (nextTableSlots: string[], nextFieldSlots: string[]) => {
    const nextTableNames = nextTableSlots.map(id => resolveRefCleanName(id));
    const nextFieldNames = nextFieldSlots.map(id => resolveRefCleanName(id));

    const validFieldIds = nextFieldSlots.filter(Boolean);
    const validTableIds = nextTableSlots.filter(Boolean);
    const combinedIds = Array.from(new Set([...validFieldIds, ...validTableIds]));
    const combinedNames = combinedIds.map(id => resolveRefCleanName(id)).filter(Boolean);

    return {
      tableRefereeIds: nextTableSlots,
      tableRefereeNames: nextTableNames,
      fieldRefereeIds: nextFieldSlots,
      fieldRefereeNames: nextFieldNames,
      refereeIds: combinedIds,
      refereeNames: combinedNames,
      refereeId: combinedIds[0] || undefined,
      refereeName: combinedNames[0] || undefined,
      referee2Id: combinedIds[1] || undefined,
      referee2Name: combinedNames[1] || undefined
    };
  };

  const handleSetMatchCategoryReferee = (
    matchId: string,
    role: 'table' | 'field',
    slotIdx: number,
    refereeId: string
  ) => {
    pushMatchHistorySnapshot(generatedMatches);
    setGeneratedMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m;
        const curTable = m.tableRefereeIds ? [...m.tableRefereeIds] : ['', ''];
        const curField = m.fieldRefereeIds ? [...m.fieldRefereeIds] : ['', ''];
        if (role === 'table') {
          curTable[slotIdx] = refereeId;
        } else {
          curField[slotIdx] = refereeId;
        }
        return {
          ...m,
          ...buildSyncedRefereeFields(curTable, curField)
        };
      })
    );
  };

  const handleAddCategorySlotToMatch = (matchId: string, role: 'table' | 'field') => {
    pushMatchHistorySnapshot(generatedMatches);
    setGeneratedMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m;
        const curTable = m.tableRefereeIds ? [...m.tableRefereeIds] : ['', ''];
        const curField = m.fieldRefereeIds ? [...m.fieldRefereeIds] : ['', ''];
        if (role === 'table') {
          curTable.push('');
        } else {
          curField.push('');
        }
        return {
          ...m,
          ...buildSyncedRefereeFields(curTable, curField)
        };
      })
    );
  };

  const handleRemoveCategorySlotFromMatch = (
    matchId: string,
    role: 'table' | 'field',
    slotIdx: number
  ) => {
    pushMatchHistorySnapshot(generatedMatches);
    setGeneratedMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m;
        const curTable = m.tableRefereeIds ? [...m.tableRefereeIds] : ['', ''];
        const curField = m.fieldRefereeIds ? [...m.fieldRefereeIds] : ['', ''];
        if (role === 'table') {
          curTable.splice(slotIdx, 1);
        } else {
          curField.splice(slotIdx, 1);
        }
        return {
          ...m,
          ...buildSyncedRefereeFields(curTable, curField)
        };
      })
    );
  };

  // Apply batch date, venue & structured table/field referees to all matches
  const handleApplyBatchSchedule = () => {
    const selectedBulkHostSchool = bulkVenueMode === 'school'
      ? schools.find(s => s.id === bulkHostSchoolId)
      : undefined;
    const hasBulkVenue = bulkVenueMode === 'school'
      ? Boolean(selectedBulkHostSchool)
      : Boolean(bulkVenueName.trim());

    const hasBulkTableRefs = bulkTableRefereeIds.some(Boolean);
    const hasBulkFieldRefs = bulkFieldRefereeIds.some(Boolean);
    const hasLegacyBulkRefs = bulkRefereeIds.length > 0 || Boolean(bulkRefereeId);

    if (!bulkDate && !hasBulkVenue && !hasBulkTableRefs && !hasBulkFieldRefs && !hasLegacyBulkRefs) {
      toast.error('يرجى تحديد التاريخ، المكان أو اختيار حكم واحد على الأقل لتعميمه');
      return;
    }

    if (bulkDate) {
      const tournamentCycles = selectedTournament
        ? getMatchEducationalCycles(
            {
              ageCategory: selectedTournament.ageCategory,
              level: selectedTournament.level,
              tournamentId: selectedTournament.id
            },
            schools,
            [selectedTournament]
          )
        : (['ALL'] as string[]);
      const bulkCycles = tournamentCycles.length > 0 ? tournamentCycles : (['ALL'] as string[]);
      const bulkConflicts = findAllBlockedPeriodsForDate(bulkDate, bulkCycles, blockedPeriods);
      const bulkHoliday = bulkConflicts.find(p => p.type === 'holiday');
      if (bulkHoliday) {
        toast.error(`ممنوع تعميم تاريخ ${bulkDate}: يصادف عطلة مدرسية (${bulkHoliday.title}).`);
        return;
      }
      const bulkExam = bulkConflicts.find(p => p.type === 'exams');
      if (bulkExam) {
        toast.error(`ممنوع تعميم تاريخ ${bulkDate}: يصادف فترة الامتحانات للسلك المعني (${bulkExam.title}).`);
        return;
      }
    }

    if (bulkVenueMode === 'custom' && bulkVenueName.trim()) {
      void saveCustomVenueIfNeeded(bulkVenueName, false);
    }

    pushMatchHistorySnapshot(generatedMatches);
    setGeneratedMatches(prev =>
      prev.map(m => {
        const nextTable = hasBulkTableRefs
          ? [...bulkTableRefereeIds]
          : (m.tableRefereeIds ? [...m.tableRefereeIds] : ['', '']);
        const nextField = hasBulkFieldRefs
          ? [...bulkFieldRefereeIds]
          : (m.fieldRefereeIds ? [...m.fieldRefereeIds] : ['', '']);

        let syncedRefs = buildSyncedRefereeFields(nextTable, nextField);
        if (!hasBulkTableRefs && !hasBulkFieldRefs && hasLegacyBulkRefs) {
          const effectiveBulkIds = bulkRefereeIds.length > 0 ? bulkRefereeIds : (bulkRefereeId ? [bulkRefereeId] : []);
          syncedRefs = buildSyncedRefereeFields(nextTable, effectiveBulkIds);
        }

        let nextVenueMode = m.venueMode || 'school';
        let nextHostSchoolId = m.hostSchoolId || '';
        let nextVenueId = m.venueId;
        let nextVenueName = m.venueName;

        if (hasBulkVenue) {
          if (bulkVenueMode === 'school' && selectedBulkHostSchool) {
            nextVenueMode = 'school';
            nextHostSchoolId = selectedBulkHostSchool.id;
            nextVenueId = selectedBulkHostSchool.id;
            nextVenueName = selectedBulkHostSchool.name;
          } else if (bulkVenueMode === 'custom' && bulkVenueName.trim()) {
            const matchedVen = uniqueSavedVenues.find(v => normalizeArabicSearch(v.name) === normalizeArabicSearch(bulkVenueName));
            nextVenueMode = 'custom';
            nextHostSchoolId = '';
            nextVenueId = matchedVen?.id || 'custom';
            nextVenueName = matchedVen?.name || bulkVenueName.trim();
          }
        }

        return {
          ...m,
          date: bulkDate || m.date,
          time: bulkTime || m.time,
          venueMode: nextVenueMode,
          hostSchoolId: nextHostSchoolId,
          venueId: nextVenueId,
          venueName: nextVenueName,
          ...syncedRefs
        };
      })
    );
    toast.success('تم تعميم التوقيت والمكان وحكام الطاولة والساحة على جميع المباريات');
  };

  // Blocked date lookup helper for any generated match
  const getBlockedConflictForMatch = (match: GeneratedDrawMatch): BlockedSchedulePeriod | null => {
    if (!match.date || blockedPeriods.length === 0) return null;
    const cycles = getMatchEducationalCycles(
      {
        team1Id: match.team1Id,
        team2Id: match.team2Id,
        ageCategory: selectedTournament?.ageCategory,
        level: selectedTournament?.level,
        tournamentId: selectedTournament?.id
      },
      schools,
      selectedTournament ? [selectedTournament] : []
    );
    return findBlockedPeriodForDate(match.date, cycles, blockedPeriods);
  };

  const blockedGeneratedMatches = useMemo(() => {
    return generatedMatches
      .map((m) => ({ match: m, period: getBlockedConflictForMatch(m) }))
      .filter((x): x is { match: GeneratedDrawMatch; period: BlockedSchedulePeriod } => Boolean(x.period));
  }, [generatedMatches, blockedPeriods, selectedTournament, schools]);

  const hasStrictHolidayMatches = blockedGeneratedMatches.some(x => x.period.type === 'holiday');
  const hasBlockedMatchesRestriction = blockedGeneratedMatches.length > 0;

  const selectedTournamentCycles = useMemo(() => {
    if (!selectedTournament) return ['ALL'] as string[];
    const cyc = getMatchEducationalCycles(
      {
        ageCategory: selectedTournament.ageCategory,
        level: selectedTournament.level,
        tournamentId: selectedTournament.id
      },
      schools,
      [selectedTournament]
    );
    return cyc.length > 0 ? cyc : (['ALL'] as string[]);
  }, [selectedTournament, schools]);

  const bulkDateConflict = useMemo(() => {
    if (!bulkDate || blockedPeriods.length === 0) return null;
    return findBlockedPeriodForDate(bulkDate, selectedTournamentCycles, blockedPeriods);
  }, [bulkDate, selectedTournamentCycles, blockedPeriods]);

  const manualDateConflict = useMemo(() => {
    if (!manualDate || blockedPeriods.length === 0) return null;
    const manualCycles = selectedTournament
      ? getMatchEducationalCycles(
          {
            team1Id: manualTeam1Id || undefined,
            team2Id: manualTeam2Id || undefined,
            ageCategory: selectedTournament.ageCategory,
            level: selectedTournament.level,
            tournamentId: selectedTournament.id
          },
          schools,
          [selectedTournament]
        )
      : (['ALL'] as string[]);
    return findBlockedPeriodForDate(manualDate, manualCycles.length > 0 ? manualCycles : selectedTournamentCycles, blockedPeriods);
  }, [manualDate, manualTeam1Id, manualTeam2Id, selectedTournament, selectedTournamentCycles, schools, blockedPeriods]);

  const parseDrawTimeToMinutes = (timeStr?: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  };

  const findVenueOccupancyConflicts = (params: {
    date?: string;
    time?: string;
    venueMode?: 'school' | 'custom';
    hostSchoolId?: string;
    venueId?: string;
    venueName?: string;
    excludeGeneratedMatchId?: string;
  }) => {
    const targetDate = normalizeDateToYmd(params.date || '') || (params.date || '').trim();
    const targetTime = (params.time || '10:00').trim();
    const mode = params.venueMode || (params.hostSchoolId ? 'school' : 'custom');
    const selectedHostSch = mode === 'school' && params.hostSchoolId
      ? schools.find(s => s.id === params.hostSchoolId)
      : undefined;
    const normalizedCustomName = normalizeArabicSearch(params.venueName || '');

    const hasVenueSelection =
      mode === 'school'
        ? Boolean(params.hostSchoolId)
        : Boolean(normalizedCustomName || (params.venueId && params.venueId !== 'custom'));

    if (!targetDate || !hasVenueSelection) {
      return {
        hasVenueSelection: false,
        conflictingExisting: [] as Match[],
        conflictingSibling: [] as GeneratedDrawMatch[],
        sameDayOtherExisting: [] as Match[]
      };
    }

    const matchesSameVenue = (
      otherHostSchoolId?: string,
      otherVenueId?: string,
      otherVenueName?: string
    ) => {
      if (mode === 'school' && params.hostSchoolId) {
        if (otherHostSchoolId === params.hostSchoolId || otherVenueId === params.hostSchoolId) {
          return true;
        }
        if (selectedHostSch?.name) {
          if (schoolNamesMatch(otherVenueName, selectedHostSch.name)) return true;
          const otherSch = schools.find(s => s.id === (otherHostSchoolId || otherVenueId));
          if (otherSch && schoolNamesMatch(otherSch.name, selectedHostSch.name)) return true;
        }
        return false;
      }

      if (params.venueId && params.venueId !== 'custom' && otherVenueId === params.venueId) return true;
      if (normalizedCustomName) {
        if (
          schoolNamesMatch(otherVenueName, params.venueName) ||
          normalizeArabicSearch(otherVenueName || '') === normalizedCustomName
        ) {
          return true;
        }
      }
      return false;
    };

    const conflictingExisting: Match[] = [];
    const sameDayOtherExisting: Match[] = [];
    const targetMins = parseDrawTimeToMinutes(targetTime);

    allExistingMatches.forEach(m => {
      if (m.status === 'Cancelled' || m.status === 'Postponed') return;
      const mDate = normalizeDateToYmd(m.date || '') || (m.date || '').trim();
      if (mDate !== targetDate) return;
      if (!matchesSameVenue(m.hostSchoolId, m.venueId, m.venueName)) return;

      if (m.startTime && targetTime) {
        const diff = Math.abs(parseDrawTimeToMinutes(m.startTime) - targetMins);
        if (diff < 60) {
          conflictingExisting.push(m);
        } else {
          sameDayOtherExisting.push(m);
        }
      } else {
        conflictingExisting.push(m);
      }
    });

    const conflictingSibling: GeneratedDrawMatch[] = [];
    generatedMatches.forEach(gm => {
      if (params.excludeGeneratedMatchId && gm.id === params.excludeGeneratedMatchId) return;
      const gmDate = normalizeDateToYmd(gm.date || '') || (gm.date || '').trim();
      if (gmDate !== targetDate) return;
      if (!matchesSameVenue(gm.hostSchoolId, gm.venueId, gm.venueName)) return;

      if (gm.time && targetTime) {
        const diff = Math.abs(parseDrawTimeToMinutes(gm.time) - targetMins);
        if (diff < 60) {
          conflictingSibling.push(gm);
        }
      } else {
        conflictingSibling.push(gm);
      }
    });

    return {
      hasVenueSelection: true,
      conflictingExisting,
      conflictingSibling,
      sameDayOtherExisting
    };
  };

  const bulkOccupancy = useMemo(() => {
    return findVenueOccupancyConflicts({
      date: bulkDate,
      time: bulkTime,
      venueMode: bulkVenueMode,
      hostSchoolId: bulkHostSchoolId,
      venueName: bulkVenueName
    });
  }, [bulkDate, bulkTime, bulkVenueMode, bulkHostSchoolId, bulkVenueName, allExistingMatches, schools, generatedMatches]);

  const buildMatchPayloadFromGenerated = (
    gm: GeneratedDrawMatch,
    tempIdToFirestoreId: Record<string, string>
  ): Omit<Match, 'id'> => {
    const cleanTablePairs = (gm.tableRefereeIds || [])
      .map((rawId, idx) => {
        const id = (rawId || '').trim();
        if (!id) return null;
        const name = (
          resolveRefCleanName(id) ||
          (gm.tableRefereeNames?.[idx] || '')
        ).replace(/\s*\(أستاذ\)\s*/g, '').trim();
        return { id, name };
      })
      .filter((p): p is { id: string; name: string } => p !== null);

    const cleanFieldPairs = (gm.fieldRefereeIds || [])
      .map((rawId, idx) => {
        const id = (rawId || '').trim();
        if (!id) return null;
        const name = (
          resolveRefCleanName(id) ||
          (gm.fieldRefereeNames?.[idx] || '')
        ).replace(/\s*\(أستاذ\)\s*/g, '').trim();
        return { id, name };
      })
      .filter((p): p is { id: string; name: string } => p !== null);

    const cleanTableRefs = cleanTablePairs.map(p => p.id);
    const cleanTableRefNames = cleanTablePairs.map(p => p.name);
    const cleanFieldRefs = cleanFieldPairs.map(p => p.id);
    const cleanFieldRefNames = cleanFieldPairs.map(p => p.name);

    const refNameById = new Map<string, string>();
    [...cleanFieldPairs, ...cleanTablePairs].forEach(p => {
      if (p.id && p.name) refNameById.set(p.id, p.name);
    });
    (gm.refereeIds || []).forEach((rawId, idx) => {
      const id = (rawId || '').trim();
      if (!id || refNameById.has(id)) return;
      const nm = (resolveRefCleanName(id) || (gm.refereeNames?.[idx] || '')).replace(/\s*\(أستاذ\)\s*/g, '').trim();
      if (nm) refNameById.set(id, nm);
    });
    if (gm.refereeId && gm.refereeId.trim() && !refNameById.has(gm.refereeId.trim())) {
      const nm = (resolveRefCleanName(gm.refereeId) || gm.refereeName || '').replace(/\s*\(أستاذ\)\s*/g, '').trim();
      if (nm) refNameById.set(gm.refereeId.trim(), nm);
    }

    const allRefs = Array.from(new Set([
      ...cleanFieldRefs,
      ...cleanTableRefs,
      ...(gm.refereeIds || []),
      ...(gm.refereeId ? [gm.refereeId] : [])
    ].map(v => (v || '').trim()).filter(Boolean)));
    const allRefNames = allRefs.map(id => refNameById.get(id) || resolveRefCleanName(id) || '');

    const resolvedHost = gm.venueMode !== 'custom'
      ? resolveHostSchoolForMatch({ hostSchoolId: gm.hostSchoolId, venueId: gm.venueId, venueName: gm.venueName }, schools)
      : undefined;

    return {
      tournamentId: selectedTournament!.id,
      sportId: selectedTournament!.sportId,
      stage: gm.stage,
      groupName: gm.groupName,
      drawSystem: gm.drawSystem || drawSystem,
      drawMatchNumber: gm.drawMatchNumber,
      roundIndex: gm.roundIndex,
      leg: gm.leg,
      team1Id: gm.team1Id,
      team1Name: gm.team1Name,
      team2Id: gm.team2Id,
      team2Name: gm.team2Name,
      team1SourceMatchId: gm.team1SourceTempId ? tempIdToFirestoreId[gm.team1SourceTempId] : undefined,
      team2SourceMatchId: gm.team2SourceTempId ? tempIdToFirestoreId[gm.team2SourceTempId] : undefined,
      team1SourceMatchNumber: gm.team1SourceMatchNumber,
      team2SourceMatchNumber: gm.team2SourceMatchNumber,
      team1Placeholder: gm.team1Placeholder,
      team2Placeholder: gm.team2Placeholder,
      ageCategory: normalizeCategoryKey(selectedTournament!.ageCategory || ''),
      gender: selectedTournament!.gender || 'Male',
      affiliationType: normalizeTournamentAffiliation(selectedTournament!.affiliationType, selectedTournament!.name),
      date: gm.date,
      startTime: gm.time || '10:00',
      hostSchoolId: resolvedHost?.id || '',
      venueId: resolvedHost?.id || gm.venueId || 'default-venue',
      venueName: resolvedHost?.name || gm.venueName,
      referee1Id: allRefs[0] || '',
      referee2Id: allRefs[1] || '',
      referees: allRefs,
      refereeNames: allRefNames,
      tableReferees: cleanTableRefs,
      tableRefereeNames: cleanTableRefNames,
      fieldReferees: cleanFieldRefs,
      fieldRefereeNames: cleanFieldRefNames,
      notes: gm.notes?.trim() || '',
      status: 'Scheduled',
      programApprovalStatus: 'pending',
      updatedAt: new Date()
    };
  };

  // Publish or update a single match directly into the program without waiting for the rest of the branch
  const handleSaveSingleMatchToDatabase = async (gm: GeneratedDrawMatch) => {
    if (!selectedTournament) {
      toast.error('يرجى اختيار البطولة أولاً');
      return;
    }
    const blockedPeriod = getBlockedConflictForMatch(gm);
    if (blockedPeriod) {
      const kindLabel = blockedPeriod.type === 'exams' ? 'فترة الامتحانات للسلك المعني' : 'عطلة مدرسية';
      toast.error(`ممنوع وضع المباراة في البرنامج: تاريخ ${gm.date} يصادف ${kindLabel} (${blockedPeriod.title}).`);
      return;
    }

    setSavingSingleMatchId(gm.id);
    try {
      if (gm.venueMode === 'custom' && gm.venueName?.trim()) {
        await saveCustomVenueIfNeeded(gm.venueName, false);
      }
      const existingFirestoreId = savedByTempId[gm.id];
      const payload = buildMatchPayloadFromGenerated(gm, savedByTempId);

      if (existingFirestoreId) {
        const { programApprovalStatus: _keepExistingStatus, ...updatePayload } = payload;
        await DataService.updateMatch(existingFirestoreId, updatePayload);
        toast.success(`تم تحديث المباراة رقم ${gm.drawMatchNumber || ''} في البرنامج بنجاح`);
      } else {
        const created = await DataService.addMatch(payload);
        if (created?.id) {
          setSavedByTempId(prev => ({ ...prev, [gm.id]: created.id }));
          setSavedMatchIds(prev => (prev.includes(created.id) ? prev : [...prev, created.id]));
          setAllExistingMatches(prev => [created, ...prev.filter(x => x.id !== created.id)]);
        }
        toast.success('تم وضع المباراة في البرنامج (في انتظار مصادقة المسير المركزي)');
      }

      if (onMatchesCreated) onMatchesCreated();
    } catch (err) {
      console.error('Failed to save single match:', err);
      toast.error('حدث خطأ أثناء وضع المباراة في البرنامج');
    } finally {
      setSavingSingleMatchId(null);
    }
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
    if (hasBlockedMatchesRestriction) {
      const first = blockedGeneratedMatches.find(x => x.period.type === 'holiday') || blockedGeneratedMatches[0];
      const kindLabel = first.period.type === 'exams' ? 'فترة الامتحانات' : 'عطلة مدرسية';
      toast.error(
        `ممنوع حفظ البرمجة: مقابلة (${first.match.team1Name} ضد ${first.match.team2Name}) بتاريخ ${first.match.date} تصادف ${kindLabel} (${first.period.title}).`,
        { duration: 6000 }
      );
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading(`جاري حفظ ${generatedMatches.length} مباراة مع تعيين الحكام في جدول البطولة...`);

    try {
      const uniqueCustomVenueNames: string[] = Array.from(
        new Set<string>(
          generatedMatches
            .filter(gm => gm.venueMode === 'custom' && gm.venueName?.trim())
            .map(gm => gm.venueName.trim())
        )
      );
      for (const vName of uniqueCustomVenueNames) {
        await saveCustomVenueIfNeeded(vName, false);
      }

      const createdIds: string[] = [];
      const tempIdToFirestoreId: Record<string, string> = { ...savedByTempId };
      for (const gm of generatedMatches) {
        const existingId = tempIdToFirestoreId[gm.id];
        const payload = buildMatchPayloadFromGenerated(gm, tempIdToFirestoreId);

        if (existingId) {
          const { programApprovalStatus: _keepExistingStatus, ...updatePayload } = payload;
          await DataService.updateMatch(existingId, updatePayload);
          createdIds.push(existingId);
        } else {
          const created = await DataService.addMatch(payload);
          if (created?.id) {
            createdIds.push(created.id);
            tempIdToFirestoreId[gm.id] = created.id;
          }
        }
      }

      setSavedByTempId(tempIdToFirestoreId);
      setSavedMatchIds(createdIds);
      toast.dismiss(toastId);
      toast.success('تم حفظ جميع المباريات في البرنامج (في انتظار مصادقة المسير المركزي)!');
      if (onMatchesCreated) onMatchesCreated();
      setStep(4);
    } catch (err) {
      console.error('Failed to save matches:', err);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء حفظ المباريات في قاعدة البيانات');
    } finally {
      setIsSaving(false);
    }
  };

  // Undo Step 4: delete newly saved matches from database and return cleanly to Step 3
  const handleRevertSavedMatchesAndGoBack = async () => {
    if (savedMatchIds.length === 0) {
      setStep(3);
      return;
    }
    setIsRevertingSave(true);
    const toastId = toast.loading(`جاري التراجع وإلغاء ${savedMatchIds.length} مباراة محفوظة للعودة إلى التعديل...`);
    try {
      for (const mId of savedMatchIds) {
        await DataService.deleteMatch(mId);
      }
      const savedSet = new Set(savedMatchIds);
      setAllExistingMatches(prev => prev.filter(m => !savedSet.has(m.id)));
      setSavedMatchIds([]);
      setSavedByTempId({});
      if (onMatchesCreated) onMatchesCreated();
      toast.dismiss(toastId);
      toast.success('تم التراجع عن الحفظ بنجاح! يمكنك الآن تعديل المباريات أو المواعيد في المرحلة 3.');
      setStep(3);
    } catch (err) {
      console.error('Failed to revert saved matches:', err);
      toast.dismiss(toastId);
      toast.error('تعذر إلغاء بعض المباريات المحفوظة تلقائياً');
    } finally {
      setIsRevertingSave(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (generatedMatches.length === 0) return;

    const data = generatedMatches.map((m, idx) => {
      const tableRefs = (m.tableRefereeIds || [])
        .map((id, i) => {
          const nm = resolveRefCleanName(id) || (m.tableRefereeNames?.[i] || '').replace(/\s*\(أستاذ\)\s*/g, '').trim();
          return nm ? `${getRefOrdinalLabel(i)}: ${nm}` : '';
        })
        .filter(Boolean);
      const fieldRefs = (m.fieldRefereeIds || [])
        .map((id, i) => {
          const nm = resolveRefCleanName(id) || (m.fieldRefereeNames?.[i] || '').replace(/\s*\(أستاذ\)\s*/g, '').trim();
          return nm ? `${getRefOrdinalLabel(i)}: ${nm}` : '';
        })
        .filter(Boolean);

      return {
        'رقم المقابلة': m.drawMatchNumber ?? (idx + 1),
        'البطولة': selectedTournament?.name || '',
        'المرحلة / الدور': m.stage,
        'الفريق الأول': m.team1Name,
        'الفريق الثاني': m.team2Name,
        'التاريخ': m.date,
        'توقيت الانطلاق': m.time,
        'مركز التباري': m.venueName,
        'حكام الطاولة': tableRefs.length > 0 ? tableRefs.join(' • ') : 'يعين لاحقاً',
        'حكام الساحة': fieldRefs.length > 0 ? fieldRefs.join(' • ') : 'يعين لاحقاً'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'برنامج المباريات والحكام');
    XLSX.writeFile(wb, `برنامج_مباريات_${selectedTournament?.name || 'القرعة'}.xlsx`);
    toast.success('تم تصدير ملف Excel بنجاح');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-0 overflow-hidden" dir="rtl">
      <div className="bg-white border-0 rounded-none shadow-2xl w-full h-[100dvh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Modal Header - Responsive & Dynamic Color */}
        <div className={cn(
          "px-3.5 sm:px-5 py-2.5 sm:py-4 flex flex-col sm:flex-row items-center sm:justify-between gap-2.5 sm:gap-4 border-b shrink-0 text-white transition-colors duration-300",
          selectedTournament?.affiliationType === 'club_affiliated'
            ? "bg-gradient-to-r from-yellow-600 via-yellow-700 to-yellow-800 border-yellow-800/40"
            : "bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 border-slate-800"
        )}>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-right w-full sm:w-auto">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-base sm:text-xl shadow-xs font-black shrink-0">
                <Shuffle className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <h3 className="text-xs sm:text-base font-black text-white tracking-tight">
                <span className="hidden sm:inline">القرعة الإلكترونية وبرمجة المباريات وتعيين الحكام</span>
                <span className="sm:hidden">القرعة الإلكترونية وبرمجة المباريات</span>
              </h3>
              {userSportRestriction && userSportRestriction.length > 0 && (
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-amber-400 text-slate-950 items-center gap-1">
                  <Lock className="w-3 h-3" />
                  <span>صلاحية محددة برياضتك</span>
                </span>
              )}
            </div>
            {/* Details: hidden on mobile */}
            <p className="hidden sm:block text-xs text-emerald-100/90 mt-0.5 font-medium">
              فلترة الرياضات الجماعية، إجراء القرعة العادلة، تحديد المواعيد والملاعب وتعيين الحكام
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
            <button
              onClick={onClose}
              className="p-1.5 sm:w-8 sm:h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer"
              title="إغلاق"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar (Clickable to step back/undo any stage) */}
        <div className="bg-slate-100 px-4 sm:px-6 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold shrink-0 gap-1 overflow-x-auto">
          <button
            type="button"
            disabled={step <= 1}
            onClick={() => step > 1 && setStep(1)}
            title={step > 1 ? 'العودة إلى المرحلة 1: اختيار نوع البطولة' : undefined}
            className={`flex items-center gap-2 shrink-0 transition-opacity ${step >= 1 ? 'text-emerald-800 font-black' : 'text-slate-400'} ${step > 1 ? 'cursor-pointer hover:opacity-75 underline-offset-4 hover:underline' : 'cursor-default'}`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>1</span>
            <span>1. اختيار نوع البطولة والفلترة</span>
          </button>

          <div className="w-8 sm:w-12 h-0.5 bg-slate-300 shrink-0" />

          <button
            type="button"
            disabled={step <= 2}
            onClick={() => step > 2 && setStep(2)}
            title={step > 2 ? 'التراجع إلى المرحلة 2: المؤسسات ونظام القرعة' : undefined}
            className={`flex items-center gap-2 shrink-0 transition-opacity ${step >= 2 ? 'text-emerald-800 font-black' : 'text-slate-400'} ${step > 2 ? 'cursor-pointer hover:opacity-75 underline-offset-4 hover:underline' : 'cursor-default'}`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>2</span>
            <span>2. المؤسسات ونظام القرعة</span>
          </button>

          <div className="w-8 sm:w-12 h-0.5 bg-slate-300 shrink-0" />

          <button
            type="button"
            disabled={step <= 3}
            onClick={() => step > 3 && setStep(3)}
            title={step > 3 ? 'العودة إلى المرحلة 3: المواعيد والملاعب والحكام' : undefined}
            className={`flex items-center gap-2 shrink-0 transition-opacity ${step >= 3 ? 'text-emerald-800 font-black' : 'text-slate-400'} ${step > 3 ? 'cursor-pointer hover:opacity-75 underline-offset-4 hover:underline' : 'cursor-default'}`}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>3</span>
            <span>3. المواعيد والملاعب والحكام</span>
          </button>

          <div className="hidden sm:block w-8 h-0.5 bg-slate-300 shrink-0" />

          <div className={`hidden sm:flex items-center gap-2 shrink-0 ${step >= 4 ? 'text-emerald-800 font-black' : 'text-slate-400'}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 4 ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'}`}>4</span>
            <span>4. إشعارات الواتساب</span>
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

                {/* Filter Row 2: Specific Sport, Affiliation, Age Category & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                  
                  {/* Specific Sport Select */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      {initialSportId ? '🏆 الرياضة المعنية بالبطولة (مفعلة تلقائياً):' : (userSportRestriction && userSportRestriction.length > 0 ? '🔒 رياضتك المصرح بها فقط:' : 'نوع الرياضة:')}
                    </label>
                    <select
                      value={selectedSportFilter}
                      onChange={(e) => setSelectedSportFilter(e.target.value)}
                      disabled={Boolean(initialSportId || (userSportRestriction && userSportRestriction.length === 1))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer disabled:bg-slate-100 disabled:opacity-80"
                    >
                      {!initialSportId && (!userSportRestriction || userSportRestriction.length > 1) && (
                        <option value="ALL">-- كل الرياضات --</option>
                      )}
                      {sportsConfig
                      .filter(s => !initialSportId || s.id === initialSportId)
                      .filter(s => !userSportRestriction || userSportRestriction.length === 0 || userSportRestriction.includes(s.id))
                      .map(s => (
                        <option key={s.id} value={s.id}>
                          {s.icon || '🏆'} {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Affiliation Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">الصنف (الانتماء):</label>
                    <select
                      value={selectedAffiliationFilter}
                      onChange={(e) => setSelectedAffiliationFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="ALL">-- جميع الأصناف --</option>
                      <option value="non_club">⚪ غير المنتمين للأندية</option>
                      <option value="club_affiliated">🟡 المنتمين للأندية</option>
                    </select>
                  </div>

                  {/* Age Category Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">الفئة العمرية المشاركة (المبرمجة):</label>
                    <select
                      value={selectedAgeCategoryFilter}
                      onChange={(e) => setSelectedAgeCategoryFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="ALL">-- جميع الفئات المبرمجة ({availableAgeCategories.length}) --</option>
                      {availableAgeCategories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
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
                            ? t.affiliationType === 'club_affiliated'
                              ? 'bg-amber-50 border-amber-600 shadow-md ring-2 ring-amber-400/30'
                              : 'bg-emerald-50/80 border-emerald-600 shadow-md ring-2 ring-emerald-400/30'
                            : 'bg-white hover:bg-slate-50 border-slate-200 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className={`text-2xl p-2 rounded-xl border ${
                              t.affiliationType === 'club_affiliated' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100'
                            }`}>{sportInfo.icon}</span>
                            <span className={`px-2.5 py-0.5 text-[10px] font-black rounded-full border ${
                              t.affiliationType === 'club_affiliated' ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {t.scope || 'إقليمية'}
                            </span>
                          </div>

                            <div>
                              <h5 className="font-black text-sm text-slate-900 leading-snug">{t.name}</h5>
                              <p className="text-xs text-slate-500 font-bold mt-1">
                                {sportInfo.name} • {t.ageCategory || 'عامة'} • {t.gender === 'Female' ? 'إناث' : t.gender === 'Male' ? 'ذكور' : 'مختلط'}
                              </p>
                              <div className="mt-1.5">
                                {(() => {
                                  const aff = normalizeTournamentAffiliation(t.affiliationType, t.name);
                                  if (aff === 'club_affiliated') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-200">
                                        🟡 منتمين للأندية
                                      </span>
                                    );
                                  }
                                  if (aff === 'open') {
                                    return (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-200">
                                        🌐 بطولة مفتوحة
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-700 border border-slate-200">
                                      ⚪ غير منتمين للأندية
                                    </span>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                          <span className="text-slate-400 font-medium">{t.seasonId || '2026/2027'}</span>
                          <span className={`font-black ${
                            isSelected 
                              ? t.affiliationType === 'club_affiliated' ? 'text-amber-700' : 'text-emerald-700' 
                              : 'text-slate-600'
                          }`}>
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
              <div className={`${
                selectedTournament.affiliationType === 'club_affiliated'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-emerald-50 border-emerald-200'
              } border rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-2xl ${
                    selectedTournament.affiliationType === 'club_affiliated' ? 'bg-yellow-600' : 'bg-emerald-600'
                  } text-white flex items-center justify-center text-xl shadow-xs`}>
                    {SPORTS_MAP[selectedTournament.sportId]?.icon || '🏆'}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h4 className={`text-sm font-black ${
                        selectedTournament.affiliationType === 'club_affiliated' ? 'text-amber-950' : 'text-emerald-950'
                      }`}>{selectedTournament.name}</h4>
                      {lockToInitialBranch && (
                        <span className="px-2 py-0.5 rounded-full bg-white/80 text-slate-700 border border-slate-200 text-[10px] font-black">
                          🔒 فرع معزول للقرعة فقط
                        </span>
                      )}
                    </div>
                    <p className={`text-xs ${
                      selectedTournament.affiliationType === 'club_affiliated' ? 'text-amber-800' : 'text-emerald-800'
                    } font-bold`}>
                      {SPORTS_MAP[selectedTournament.sportId]?.name} • {selectedTournament.ageCategory} • {selectedTournament.gender === 'Female' ? 'إناث' : 'ذكور'} • {normalizeTournamentAffiliation(selectedTournament.affiliationType, selectedTournament.name) === 'club_affiliated' ? 'منتمين للأندية' : normalizeTournamentAffiliation(selectedTournament.affiliationType, selectedTournament.name) === 'open' ? 'مفتوحة' : 'غير منتمين للأندية'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`px-3 py-1.5 bg-white ${
                    selectedTournament.affiliationType === 'club_affiliated' ? 'text-amber-800 border-amber-200 hover:bg-amber-100' : 'text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  } rounded-xl text-xs font-bold border cursor-pointer`}
                >
                  تغيير الفرع / البطولة
                </button>
              </div>

              {/* Draw System Selector (مجموعات أو خروج مغلوب) */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <Shuffle className="w-4 h-4 text-emerald-600" />
                  <span>نظام القرعة والتوزيع:</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div
                    onClick={() => {
                      setDrawSystem('groups_home_away');
                      if (groupsCount < 2) setGroupsCount(2);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      drawSystem === 'groups_home_away'
                        ? selectedTournament.affiliationType === 'club_affiliated'
                          ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400/20'
                          : 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl">🔁</span>
                    <div>
                      <h5 className="font-black text-xs text-slate-900">نظام المجموعات ذهاب وإياب</h5>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                        يلعب كل فريق ضد كل فريق آخر في مجموعته مرتين (ذهاب + إياب) لتحديد المتأهل بالنقط (فوز 3 • تعادل 1 • هزيمة 0).
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      setDrawSystem('groups_single');
                      if (groupsCount < 2) setGroupsCount(2);
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      drawSystem === 'groups_single'
                        ? selectedTournament.affiliationType === 'club_affiliated'
                          ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400/20'
                          : 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl">👥</span>
                    <div>
                      <h5 className="font-black text-xs text-slate-900">نظام المجموعات ذهاب فقط</h5>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                        يلعب كل فريق ضد كل فريق آخر في مجموعته مرة واحدة فقط لتحديد المتأهل بالنقط (فوز 3 • تعادل 1 • هزيمة 0).
                      </p>
                    </div>
                  </div>

                  <div
                    onClick={() => setDrawSystem('knockout_groups')}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                      drawSystem === 'knockout_groups'
                        ? selectedTournament.affiliationType === 'club_affiliated'
                          ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400/20'
                          : 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400/20'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="text-2xl">⚔️</span>
                    <div>
                      <h5 className="font-black text-xs text-slate-900">نظام المجموعات إقصاء مباشر</h5>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5 leading-relaxed">
                        توليد شجرة الإقصاء المباشر كاملة داخل كل مجموعة وصولاً للنهائي (بما في ذلك مباريات «الفائز من المباراة ...»).
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-bold text-slate-700">
                      {drawSystem === 'knockout_groups' ? 'عدد المجموعات / المسارات (1 = مسار موحد):' : 'عدد المجموعات المراد تكوينها:'}
                    </span>
                    <div className="flex items-center gap-2">
                      {(drawSystem === 'knockout_groups' ? [1, 2, 3, 4] : [2, 3, 4]).map(num => (
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

                  {/* Pre-assignment Controls & Group Summary Badges */}
                  {groupsCount > 1 && (
                    <div className="bg-slate-50/90 p-3.5 rounded-2xl border border-slate-200/90 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs font-black text-slate-800">
                            تحديد مؤسسات معينة في كل مجموعة (على أن تجرى القرعة داخل كل مجموعة):
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={handleAutoDistributeGroups}
                            className="text-[10px] font-black text-emerald-700 hover:text-emerald-800 bg-white border border-emerald-300 px-2.5 py-1 rounded-lg cursor-pointer shadow-3xs"
                          >
                            توزيع الفرق عشوائياً بالتساوي
                          </button>
                          <button
                            type="button"
                            onClick={handleResetGroupAssignments}
                            className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded-lg cursor-pointer"
                          >
                            إلغاء التخصيص اليدوي
                          </button>
                        </div>
                      </div>

                      <p className="text-[10.5px] text-slate-500 font-medium">
                        يمكنك تحديد المجموعة لكل مؤسسة بالضغط على أزرار [أ، ب، ج، د] في بطاقتها أدناه. الفرق المتبقية ستوزع تلقائياً لتوازن المجموعات، ثم تجرى قرعة {drawSystem === 'knockout_groups' ? 'الإقصاء المباشر' : drawSystem === 'groups_home_away' ? 'الذهاب والإياب' : 'الذهاب فقط'} داخل كل مجموعة.
                      </p>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                        {Array.from({ length: groupsCount }).map((_, gIdx) => {
                          const colors = [
                            'bg-blue-50/90 border-blue-200 text-blue-950',
                            'bg-emerald-50/90 border-emerald-200 text-emerald-950',
                            'bg-purple-50/90 border-purple-200 text-purple-950',
                            'bg-amber-50/90 border-amber-200 text-amber-950'
                          ][gIdx];
                          const letter = ['أ', 'ب', 'ج', 'د'][gIdx];
                          return (
                            <div key={gIdx} className={`p-2 rounded-xl border flex items-center justify-between text-xs ${colors}`}>
                              <span className="font-black text-[11px]">المجموعة {letter}</span>
                              <span className="font-mono font-black text-xs bg-white/90 px-2 py-0.5 rounded-md border border-black/5">
                                {groupCounts.counts[gIdx] || 0} فرق
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Participating Schools Selection Box */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span>تحديد المؤسسات المشاركة في القرعة ({allDrawTeams.length} فريق محدد):</span>
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {schoolFilterMode === 'CONFIRMED_ONLY'
                        ? 'تظهر حصرياً المؤسسات التي أكد أساتذتها المشاركة في هذه البطولة رسمياً.'
                        : 'عرض جميع مؤسسات الإقليم مع إمكانية انتقاء أي مؤسسة إضافية.'}
                    </p>
                  </div>

                  {/* Mode Selector Tabs (المؤسسات المؤكدة فقط vs جميع المؤسسات) */}
                  <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setSchoolFilterMode('CONFIRMED_ONLY')}
                      className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        schoolFilterMode === 'CONFIRMED_ONLY'
                          ? 'bg-emerald-600 text-white shadow-xs font-black'
                          : 'text-slate-600 hover:text-slate-900 font-bold'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>المؤسسات المشاركة فقط ({confirmedSchoolsForTournament.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSchoolFilterMode('ALL')}
                      className={`px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 ${
                        schoolFilterMode === 'ALL'
                          ? 'bg-slate-800 text-white shadow-xs font-black'
                          : 'text-slate-600 hover:text-slate-900 font-bold'
                      }`}
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>جميع المؤسسات ({schools.length})</span>
                    </button>
                  </div>
                </div>

                {/* Filter and Action bar */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-1">
                  {/* School Search */}
                  <div className="relative w-full sm:flex-1">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3" />
                    <input
                      type="text"
                      value={schoolSearchQuery}
                      onChange={(e) => setSchoolSearchQuery(e.target.value)}
                      placeholder={schoolFilterMode === 'CONFIRMED_ONLY' ? 'ابحث في المؤسسات المشاركة...' : 'ابحث باسم المؤسسة أو الجماعة...'}
                      className="w-full pr-8 pl-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <button
                      type="button"
                      onClick={handleSelectAllSchools}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      تحديد المعروض ({filteredSchoolsList.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllSchools}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      إلغاء التحديد
                    </button>
                  </div>
                </div>

                {/* Empty State when in CONFIRMED_ONLY and 0 confirmed */}
                {schoolFilterMode === 'CONFIRMED_ONLY' && confirmedSchoolsForTournament.length === 0 ? (
                  <div className="p-6 bg-amber-50/70 border border-amber-200 rounded-2xl text-center space-y-2.5">
                    <div className="text-3xl">📋</div>
                    <h5 className="font-black text-amber-950 text-xs">لا توجد مؤسسات قامت بتأكيد مشاركتها بعد في هذه البطولة</h5>
                    <p className="text-[11px] text-amber-800 leading-relaxed max-w-md mx-auto">
                      لم يتم تسجيل أي تأكيد لمشاركة المؤسسات من طرف الأساتذة حتى الآن. يمكنك التبديل لعرض جميع مؤسسات الإقليم لاختيار المؤسسات المشاركة في القرعة يدوياً.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSchoolFilterMode('ALL')}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <Building2 className="w-3.5 h-3.5" />
                      <span>عرض واختيار من جميع مؤسسات الإقليم ({schools.length})</span>
                    </button>
                  </div>
                ) : (
                  /* Schools Grid */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-72 overflow-y-auto pr-1">
                    {filteredSchoolsList.map(school => {
                      const isSelected = participatingSchoolIds.includes(school.id);
                      const confirmation = confirmedSchoolsMap.get(school.id) || confirmedSchoolsMap.get(school.name);
                      const isConfirmed = !!confirmation;

                      return (
                        <div
                          key={school.id}
                          onClick={() => toggleSchoolParticipation(school.id)}
                          className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1 text-xs ${
                            isSelected
                              ? 'bg-emerald-50/90 border-emerald-500 text-emerald-950 shadow-xs ring-1 ring-emerald-400/30'
                              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-2 truncate font-bold">
                              <span className="text-base shrink-0">🏫</span>
                              <span className="truncate">{school.name}</span>
                            </div>
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                          </div>

                          {/* Confirmation Status Tag */}
                          <div className="flex items-center justify-between text-[10px] pt-1 border-t border-slate-200/60 mt-1">
                            {isConfirmed ? (
                              <span className="text-emerald-700 font-black flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>مشاركة مؤكدة</span>
                                {confirmation.teacherName && (
                                  <span className="text-slate-500 font-medium truncate max-w-[90px]">({confirmation.teacherName})</span>
                                )}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-medium">غير مؤكدة</span>
                            )}

                            {school.commune && (
                              <span className="text-slate-400 truncate max-w-[80px]">{school.commune}</span>
                            )}
                          </div>

                          {/* Group Assignment Buttons for Both Systems when >1 Group */}
                          {isSelected && (drawSystem !== 'knockout_groups' || groupsCount > 1) && (
                            <div
                              className="mt-1.5 pt-1.5 border-t border-slate-200/80 flex items-center justify-between text-[10px]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="font-bold text-slate-600 flex items-center gap-1">
                                <span>المجموعة:</span>
                                {typeof groupAssignments[school.id] === 'number' && (
                                  <span className={`px-1.5 py-0.5 rounded font-black text-[9px] ${
                                    [
                                      'bg-blue-100 text-blue-900',
                                      'bg-emerald-100 text-emerald-900',
                                      'bg-purple-100 text-purple-900',
                                      'bg-amber-100 text-amber-900'
                                    ][groupAssignments[school.id] as number]
                                  }`}>
                                    المجموعة {['أ', 'ب', 'ج', 'د'][groupAssignments[school.id] as number]}
                                  </span>
                                )}
                              </span>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: groupsCount }).map((_, gIdx) => {
                                  const isCurrent = groupAssignments[school.id] === gIdx;
                                  const letter = ['أ', 'ب', 'ج', 'د'][gIdx];
                                  const activeColor = [
                                    'bg-blue-600 text-white shadow-xs',
                                    'bg-emerald-600 text-white shadow-xs',
                                    'bg-purple-600 text-white shadow-xs',
                                    'bg-amber-600 text-white shadow-xs'
                                  ][gIdx];
                                  return (
                                    <button
                                      key={gIdx}
                                      type="button"
                                      onClick={() => setGroupAssignments(prev => ({
                                        ...prev,
                                        [school.id]: isCurrent ? 'AUTO' : gIdx
                                      }))}
                                      className={`w-6 h-5 rounded text-[10px] font-black transition-all cursor-pointer ${
                                        isCurrent ? activeColor : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                                      }`}
                                      title={`تحديد لمجموعة ${letter}`}
                                    >
                                      {letter}
                                    </button>
                                  );
                                })}
                                <button
                                  type="button"
                                  onClick={() => setGroupAssignments(prev => {
                                    const next = { ...prev };
                                    delete next[school.id];
                                    return next;
                                  })}
                                  className="px-1.5 h-5 rounded text-[9px] font-bold bg-white border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                                  title="توزيع عشوائي آلي"
                                >
                                  آلي
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

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
                  <div className="flex flex-wrap gap-2 pt-1">
                    {customTeamNames.map((cName, idx) => {
                      const cId = `custom-team-${idx}`;
                      return (
                        <div
                          key={idx}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-bold"
                        >
                          <span>{cName}</span>
                          {(drawSystem !== 'knockout_groups' || groupsCount > 1) && (
                            <div className="flex items-center gap-1 border-r border-amber-200 pr-1.5 mr-1">
                              {Array.from({ length: groupsCount }).map((_, gIdx) => {
                                const isCurrent = groupAssignments[cId] === gIdx;
                                const letter = ['أ', 'ب', 'ج', 'د'][gIdx];
                                return (
                                  <button
                                    key={gIdx}
                                    type="button"
                                    onClick={() => setGroupAssignments(prev => ({
                                      ...prev,
                                      [cId]: isCurrent ? 'AUTO' : gIdx
                                    }))}
                                    className={`w-5 h-4 rounded text-[9px] font-black cursor-pointer ${
                                      isCurrent ? 'bg-amber-700 text-white' : 'bg-white/80 text-amber-900 border border-amber-300'
                                    }`}
                                    title={`تحديد لمجموعة ${letter}`}
                                  >
                                    {letter}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                          <X
                            onClick={() => handleRemoveCustomTeam(cName)}
                            className="w-3.5 h-3.5 hover:text-rose-600 cursor-pointer"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span>التراجع للمرحلة 1</span>
                </button>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <button
                    type="button"
                    onClick={handleEnterManualProgramming}
                    className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-300 rounded-xl text-xs font-black flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    title="اختيار الفريقين والبرمجة يدوياً من الفرق المشاركة في هذا الفرع"
                  >
                    <Plus className="w-4 h-4" />
                    <span>البرمجة يدوياً من الفرق المشاركة</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleExecuteDraw}
                    disabled={allDrawTeams.length < 2 || isDrawing}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                  >
                    <Shuffle className={`w-4 h-4 ${isDrawing ? 'animate-spin' : ''}`} />
                    <span>{isDrawing ? 'جاري السحب العشوائي...' : 'إجراء القرعة الإلكترونية وتوليد المباريات'}</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: DRAW RESULTS, DATES, VENUES & REFEREES ASSIGNMENT */}
          {/* ========================================================================= */}
          {step === 3 && selectedTournament && (
            <div className="space-y-6">
              
              {/* Step 3 Quick Navigation & School Search Bar */}
              <div className="bg-white p-3.5 rounded-3xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-emerald-600 absolute right-3 top-2.5" />
                  <input
                    type="text"
                    value={step3SchoolSearchQuery}
                    onChange={(e) => setStep3SchoolSearchQuery(e.target.value)}
                    placeholder="ابحث عن مؤسسة في نتائج القرعة، جدول المباريات، أو الملاعب المحتضنة..."
                    className="w-full pr-9 pl-16 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  />
                  {step3SchoolSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStep3SchoolSearchQuery('')}
                      className="absolute left-2 top-1.5 px-2 py-1 text-[10px] font-black text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                    >
                      مسح
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {matchHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUndoStep3Edit}
                      className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer"
                      title="التراجع عن آخر تعديل في المواعيد أو الملاعب أو الحكام"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>تراجع عن آخر تعديل ({matchHistory.length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>المرحلة 2</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>المرحلة 1</span>
                  </button>
                </div>
              </div>

              {/* Groups Distribution Overview */}
              {drawnGroups.length > 0 && (
                <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-amber-500" />
                      <span>
                        {drawSystem === 'knockout_groups'
                          ? 'نتائج القرعة — نظام المجموعات إقصاء مباشر:'
                          : drawSystem === 'groups_home_away'
                          ? 'نتائج القرعة — نظام المجموعات ذهاب وإياب:'
                          : 'نتائج القرعة — نظام المجموعات ذهاب فقط:'}
                      </span>
                    </h4>
                    <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                      {drawnGroups.length} {drawnGroups.length === 1 ? 'مسار' : 'مجموعات'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {drawnGroups.map((grp, idx) => {
                      const q = normalizeArabicSearch(step3SchoolSearchQuery.trim());
                      return (
                        <div key={idx} className={`border rounded-2xl p-3.5 space-y-2 ${
                          selectedTournament.affiliationType === 'club_affiliated'
                            ? 'bg-amber-50/50 border-amber-200'
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className={`flex items-center justify-between pb-1.5 border-b ${
                            selectedTournament.affiliationType === 'club_affiliated' ? 'border-amber-200' : 'border-slate-200'
                          }`}>
                            <span className={`text-xs font-black ${
                              selectedTournament.affiliationType === 'club_affiliated' ? 'text-amber-900' : 'text-slate-900'
                            }`}>{grp.groupName}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              selectedTournament.affiliationType === 'club_affiliated' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {grp.teams.length} فرق
                            </span>
                          </div>

                          <div className="space-y-1">
                            {grp.teams.map((t, tIdx) => {
                              const isMatch = q ? normalizeArabicSearch(t.name).includes(q) : false;
                              return (
                                <div
                                  key={t.id}
                                  className={`text-xs font-bold flex items-center gap-1.5 px-1.5 py-0.5 rounded-lg transition-colors ${
                                    isMatch
                                      ? 'bg-amber-200/80 text-amber-950 ring-1 ring-amber-400'
                                      : q
                                      ? 'text-slate-400 opacity-60'
                                      : 'text-slate-700'
                                  }`}
                                >
                                  <span className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold shrink-0 ${
                                    selectedTournament.affiliationType === 'club_affiliated' ? 'bg-amber-600' : 'bg-emerald-600'
                                  }`}>
                                    {tIdx + 1}
                                  </span>
                                  <span className="truncate">{t.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {byeTeams.length > 0 && (
                    <div className="p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-950 flex flex-wrap items-center gap-2">
                      <span className="font-black">🎖️ تأهل تلقائي للدور الموالي (Bye — عدد فردي في المجموعة):</span>
                      {byeTeams.map((bt, bIdx) => (
                        <span key={bIdx} className="px-2.5 py-0.5 bg-white border border-indigo-200 rounded-full font-bold text-[11px]">
                          {bt.teamName} ({bt.groupName})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SPORT SPECIALIZATION STATUS BANNER */}
              <div className={`p-4 rounded-3xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-xs ${
                sportSpecializedReferees.length > 0
                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50/80 border-amber-200 text-amber-950'
              }`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    sportSpecializedReferees.length > 0 ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                  }`}>
                    <Award className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-black text-xs sm:text-sm flex items-center gap-2">
                      <span>حكام رياضة {currentSportName} المتخصصون:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        sportSpecializedReferees.length > 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                      }`}>
                        {sportSpecializedReferees.length} حكم / أستاذ متخصص
                      </span>
                    </div>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      {sportSpecializedReferees.length > 0
                        ? `تقتصر خيارات التعيين حصراً على الحكام والأساتذة الذين صرحوا بتخصصهم في تحكيم (${currentSportName}) في ملفاتهم الشخصية، مع إمكانية تعيين أكثر من حكم لكل مقابلة.`
                        : `لم يصرّح أي أستاذ أو حكم رسمي بتخصصه في تحكيم (${currentSportName}) في ملفه الشخصي بعد. يتم إتاحة جميع الأطر التعليمية لتفادي تعطيل البرمجة.`}
                    </p>
                  </div>
                </div>

                {sportSpecializedReferees.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllRefereesFallback(prev => !prev)}
                    className="shrink-0 px-3 py-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-[11px] transition-colors cursor-pointer"
                  >
                    {showAllRefereesFallback ? 'العودة للمتخصصين فقط' : 'عرض كافة الأطر التعليمية (استثنائياً)'}
                  </button>
                )}
              </div>

              {/* BATCH SCHEDULING & MULTI-REFEREE TOOLBAR */}
              <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-blue-50 p-4 rounded-3xl border border-emerald-200 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-950">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    <span>تعميم التاريخ، الملعب، وتعيين الحكام على جميع المباريات دفعة واحدة:</span>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-white/80 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    حكام {currentSportName} ({activeRefereesList.length})
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">التاريخ الموحد:</label>
                    <input
                      type="date"
                      value={bulkDate}
                      onChange={(e) => setBulkDate(e.target.value)}
                      className={`w-full px-2.5 py-1.5 bg-white border rounded-xl font-bold text-slate-800 ${
                        bulkDateConflict
                          ? bulkDateConflict.type === 'holiday'
                            ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40'
                            : 'border-blue-500 ring-1 ring-blue-300 bg-blue-50/40'
                          : 'border-slate-200'
                      }`}
                    />
                    {bulkDateConflict && (
                      <p className={`text-[10px] font-black mt-1 ${bulkDateConflict.type === 'holiday' ? 'text-rose-700' : 'text-blue-700'}`}>
                        ⛔ {bulkDateConflict.type === 'holiday' ? 'عطلة مدرسية' : 'أيام الامتحانات'}: {bulkDateConflict.title}
                      </p>
                    )}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold text-slate-600">مركز التباري الموحد:</label>
                      <div className="inline-flex rounded-lg bg-white border border-slate-200 p-0.5 text-[9px] font-bold">
                        <button
                          type="button"
                          onClick={() => setBulkVenueMode('school')}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${bulkVenueMode === 'school' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                        >
                          🏫 مؤسسة
                        </button>
                        <button
                          type="button"
                          onClick={() => setBulkVenueMode('custom')}
                          className={`px-1.5 py-0.5 rounded cursor-pointer ${bulkVenueMode === 'custom' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                        >
                          🏟️ فضاء آخر
                        </button>
                      </div>
                    </div>
                    {bulkVenueMode === 'school' ? (
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1">
                          {(['ALL', 'ابتدائي', 'إعدادي', 'تأهيلي'] as const).map(cyc => (
                            <button
                              key={`bulk-host-cyc-${cyc}`}
                              type="button"
                              onClick={() => setBulkHostSchoolCycleFilter(cyc)}
                              className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-colors cursor-pointer ${
                                bulkHostSchoolCycleFilter === cyc
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {cyc === 'ALL' ? 'الكل' : cyc}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <Search className="w-3 h-3 text-slate-400 absolute right-2 top-2" />
                          <input
                            type="text"
                            value={bulkHostSchoolSearch}
                            onChange={(e) => setBulkHostSchoolSearch(e.target.value)}
                            placeholder="بحث عن مؤسسة محتضنة..."
                            className="w-full pr-6 pl-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                          />
                        </div>
                        <select
                          value={bulkHostSchoolId}
                          onChange={(e) => setBulkHostSchoolId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="">-- اختر المؤسسة المحتضنة --</option>
                          {schools
                            .filter(s => {
                              if (s.id === bulkHostSchoolId) return true;
                              if (!matchesHostSchoolCycle(s, bulkHostSchoolCycleFilter)) return false;
                              if (!bulkHostSchoolSearch.trim()) return true;
                              const q = normalizeArabicSearch(bulkHostSchoolSearch);
                              return normalizeArabicSearch(s.name || '').includes(q) || normalizeArabicSearch(s.commune || '').includes(q);
                            })
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {uniqueSavedVenues.length > 0 && (
                          <select
                            value={uniqueSavedVenues.find(v => normalizeArabicSearch(v.name) === normalizeArabicSearch(bulkVenueName))?.id || ''}
                            onChange={(e) => {
                              const found = uniqueSavedVenues.find(v => v.id === e.target.value);
                              if (found) setBulkVenueName(found.name);
                            }}
                            className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                          >
                            <option value="">-- اختر من الفضاءات المحفوظة --</option>
                            {uniqueSavedVenues.map(v => (
                              <option key={`bulk-ven-${v.id}`} value={v.id}>🏟️ {v.name}</option>
                            ))}
                          </select>
                        )}
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={bulkVenueName}
                            onChange={(e) => setBulkVenueName(e.target.value)}
                            placeholder="اكتب فضاءً جديداً..."
                            className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                          />
                          <button
                            type="button"
                            onClick={() => saveCustomVenueIfNeeded(bulkVenueName, true)}
                            disabled={isSavingVenue || !bulkVenueName.trim() || isVenueNameSaved(bulkVenueName)}
                            className={`px-2 py-1.5 rounded-xl text-[10px] font-black border shrink-0 transition-all cursor-pointer disabled:cursor-default ${
                              isVenueNameSaved(bulkVenueName)
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 disabled:opacity-40'
                            }`}
                            title="حفظ هذا الفضاء في القائمة ليبقى متاحاً في المرات القادمة"
                          >
                            {isVenueNameSaved(bulkVenueName) ? 'محفوظ ✓' : '+ حفظ'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="sm:col-span-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-emerald-200/70">
                    {/* Bulk Table Referees */}
                    <div className="bg-sky-50/90 border border-sky-200 rounded-2xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-sky-950">📋 حكام الطاولة (للتعميم):</span>
                        <button
                          type="button"
                          onClick={() => setBulkTableRefereeIds(prev => [...prev, ''])}
                          className="px-2 py-0.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>إضافة حكم</span>
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {bulkTableRefereeIds.map((slotVal, sIdx) => {
                          const isRegisteredRef = activeRefereesList.some(r => r.id === slotVal);
                          const manualTextVal = slotVal && !isRegisteredRef && !isOpaqueEntityId(slotVal) ? slotVal : '';
                          return (
                            <div key={`bulk-table-slot-${sIdx}`} className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                              <span className="text-[10px] font-black text-sky-900 w-16 shrink-0">
                                {getRefOrdinalLabel(sIdx)}:
                              </span>
                              <select
                                value={isRegisteredRef ? slotVal : ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBulkTableRefereeIds(prev => prev.map((x, i) => (i === sIdx ? v : x)));
                                }}
                                className="flex-1 min-w-[120px] px-2 py-1 bg-white border border-sky-200 rounded-lg font-bold text-slate-800 text-[10px] cursor-pointer"
                              >
                                <option value="">-- اختر {getRefOrdinalLabel(sIdx)} --</option>
                                {activeRefereesList
                                  .filter(ref => ref.id === slotVal || (!bulkTableRefereeIds.includes(ref.id) && !bulkFieldRefereeIds.includes(ref.id)))
                                  .map((ref, rIdx) => (
                                    <option key={`bulk-tbl-${sIdx}-${ref.id}-${rIdx}`} value={ref.id}>
                                      {ref.name} {ref.specialty ? `[${ref.specialty}]` : ''}
                                    </option>
                                  ))}
                              </select>
                              <input
                                type="text"
                                value={manualTextVal}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBulkTableRefereeIds(prev => prev.map((x, i) => (i === sIdx ? v : x)));
                                }}
                                placeholder="أو اكتب الاسم يدوياً..."
                                className="w-full sm:w-32 px-2 py-1 bg-white border border-sky-200 rounded-lg font-bold text-slate-800 text-[10px] placeholder:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => setBulkTableRefereeIds(prev => prev.filter((_, i) => i !== sIdx))}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                                title="حذف الحكم"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Bulk Field Referees */}
                    <div className="bg-amber-50/90 border border-amber-200 rounded-2xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black text-amber-950">🏁 حكام الساحة (للتعميم):</span>
                        <button
                          type="button"
                          onClick={() => setBulkFieldRefereeIds(prev => [...prev, ''])}
                          className="px-2 py-0.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>إضافة حكم</span>
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {bulkFieldRefereeIds.map((slotVal, sIdx) => {
                          const isRegisteredRef = activeRefereesList.some(r => r.id === slotVal);
                          const manualTextVal = slotVal && !isRegisteredRef && !isOpaqueEntityId(slotVal) ? slotVal : '';
                          return (
                            <div key={`bulk-field-slot-${sIdx}`} className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                              <span className="text-[10px] font-black text-amber-900 w-16 shrink-0">
                                {getRefOrdinalLabel(sIdx)}:
                              </span>
                              <select
                                value={isRegisteredRef ? slotVal : ''}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBulkFieldRefereeIds(prev => prev.map((x, i) => (i === sIdx ? v : x)));
                                }}
                                className="flex-1 min-w-[120px] px-2 py-1 bg-white border border-amber-200 rounded-lg font-bold text-slate-800 text-[10px] cursor-pointer"
                              >
                                <option value="">-- اختر {getRefOrdinalLabel(sIdx)} --</option>
                                {activeRefereesList
                                  .filter(ref => ref.id === slotVal || (!bulkTableRefereeIds.includes(ref.id) && !bulkFieldRefereeIds.includes(ref.id)))
                                  .map((ref, rIdx) => (
                                    <option key={`bulk-fld-${sIdx}-${ref.id}-${rIdx}`} value={ref.id}>
                                      {ref.name} {ref.specialty ? `[${ref.specialty}]` : ''}
                                    </option>
                                  ))}
                              </select>
                              <input
                                type="text"
                                value={manualTextVal}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setBulkFieldRefereeIds(prev => prev.map((x, i) => (i === sIdx ? v : x)));
                                }}
                                placeholder="أو اكتب الاسم يدوياً..."
                                className="w-full sm:w-32 px-2 py-1 bg-white border border-amber-200 rounded-lg font-bold text-slate-800 text-[10px] placeholder:text-slate-400"
                              />
                              <button
                                type="button"
                                onClick={() => setBulkFieldRefereeIds(prev => prev.filter((_, i) => i !== sIdx))}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                                title="حذف الحكم"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Live Cross-Sport Bulk Venue Availability Banner */}
                {bulkOccupancy.hasVenueSelection && (
                  (bulkOccupancy.conflictingExisting.length > 0) ? (
                    <div className="p-3 rounded-2xl bg-red-50 border border-red-300 text-red-900 space-y-1.5 text-[11px]">
                      <div className="flex items-center gap-1.5 font-black text-red-900">
                        <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                        <span>
                          ⚠️ تنبيه: مركز التباري المختار غير شاغر في {bulkDate} على الساعة {bulkTime || '10:00'}! ({bulkOccupancy.conflictingExisting.length} مقابلة مبرمجة)
                        </span>
                      </div>
                      <div className="space-y-1 pr-5">
                        {bulkOccupancy.conflictingExisting.map(cm => {
                          const s1 = schools.find(s => s.id === cm.team1Id)?.name || cm.team1Id;
                          const s2 = schools.find(s => s.id === cm.team2Id)?.name || cm.team2Id;
                          const sp = SPORTS_MAP[cm.sportId];
                          return (
                            <div key={cm.id} className="flex flex-wrap items-center justify-between gap-2 bg-white/80 px-2 py-1 rounded-lg border border-red-200">
                              <span className="font-bold">
                                {sp?.icon || '🏆'} {sp?.name || cm.sportId}: {s1} ضد {s2}
                              </span>
                              <span className="font-mono font-bold text-red-700">⏰ {cm.startTime || '10:00'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-2xl bg-emerald-100/80 border border-emerald-300 text-emerald-950 flex flex-wrap items-center justify-between gap-2 text-[11px] font-bold">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          ✓ مركز التباري شاغر في {bulkDate} على الساعة {bulkTime || '10:00'} على مستوى جميع الرياضات
                        </span>
                      </span>
                      {bulkOccupancy.sameDayOtherExisting.length > 0 && (
                        <span className="text-[10px] text-emerald-800 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-200">
                          توجد {bulkOccupancy.sameDayOtherExisting.length} مقابلة بأوقات أخرى في نفس اليوم
                        </span>
                      )}
                    </div>
                  )
                )}

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleApplyBatchSchedule}
                    className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer shadow-xs transition-colors"
                  >
                    تطبيق على كل المباريات
                  </button>
                </div>
              </div>

              {/* GENERATED MATCHES LIST WITH DATES, VENUES & REFEREES */}
              <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-600" />
                      <span>جدول المباريات وتعيين الحكام المتخصصين ({generatedMatches.length} مباراة):</span>
                    </h4>
                    {step3SchoolSearchQuery.trim() && (
                      <p className="text-[11px] font-bold text-emerald-700">
                        تصفية البحث: عرض {displayedGeneratedMatches.length} من أصل {generatedMatches.length} مباراة
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowManualBuilder(prev => !prev)}
                      className={`px-3 py-1.5 border rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer transition-colors ${
                        showManualBuilder
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                      }`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{showManualBuilder ? 'إخفاء البرمجة اليدوية' : 'برمجة مباراة يدوياً من فرق الفرع'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>تصدير Excel</span>
                    </button>
                  </div>
                </div>

                {/* MANUAL MATCH BUILDER FROM PARTICIPATING TEAMS IN BRANCH */}
                {showManualBuilder && (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200 space-y-3 text-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-indigo-200/80">
                      <div>
                        <h5 className="font-black text-indigo-950 flex items-center gap-1.5">
                          <Plus className="w-4 h-4 text-indigo-700" />
                          <span>إضافة مباراة مبرمجة يدوياً (اختيار الفرق المشاركة في فرع البطولة)</span>
                        </h5>
                        <p className="text-[11px] text-indigo-800 mt-0.5">
                          اختر الفريق الأول والفريق الثاني من الفرق المشاركة في هذا الفرع ({allDrawTeams.length} فريق مشارك) وحدد الدور والتوقيت والملعب.
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-indigo-200 text-[11px] font-bold text-indigo-900 cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={manualIncludeAllSchools}
                          onChange={(e) => setManualIncludeAllSchools(e.target.checked)}
                          className="rounded border-indigo-300 text-indigo-600"
                        />
                        <span>تضمين كل مؤسسات المديرية ({schools.length})</span>
                      </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">الفريق الأول (من المشاركين):</label>
                        <select
                          value={manualTeam1Id}
                          onChange={(e) => setManualTeam1Id(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="">-- اختر الفريق الأول --</option>
                          {manualAvailableTeams.map(t => (
                            <option key={`man-t1-${t.id}`} value={t.id} disabled={t.id === manualTeam2Id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">الفريق الثاني (من المشاركين):</label>
                        <select
                          value={manualTeam2Id}
                          onChange={(e) => setManualTeam2Id(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                        >
                          <option value="">-- اختر الفريق الثاني --</option>
                          {manualAvailableTeams.map(t => (
                            <option key={`man-t2-${t.id}`} value={t.id} disabled={t.id === manualTeam1Id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">الدور / المرحلة:</label>
                        <div className="flex gap-1.5">
                          <input
                            type="text"
                            value={manualStage}
                            onChange={(e) => setManualStage(e.target.value)}
                            placeholder="مثال: دور المجموعات، نصف النهائي..."
                            className="flex-1 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800"
                          />
                          <select
                            value=""
                            onChange={(e) => { if (e.target.value) setManualStage(e.target.value); }}
                            className="px-2 py-1.5 bg-white border border-indigo-200 rounded-xl font-bold text-indigo-800 text-[10px] cursor-pointer"
                            title="اختيار دور جاهز"
                          >
                            <option value="">قالب...</option>
                            <option value="دور المجموعات">دور المجموعات</option>
                            <option value="إقصاء مباشر">إقصاء مباشر</option>
                            <option value="ربع النهائي">ربع النهائي</option>
                            <option value="نصف النهائي">نصف النهائي</option>
                            <option value="المباراة النهائية">المباراة النهائية</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">التاريخ:</label>
                        <input
                          type="date"
                          value={manualDate}
                          onChange={(e) => setManualDate(e.target.value)}
                          className={`w-full px-2.5 py-1.5 bg-white border rounded-xl font-bold text-slate-800 ${
                            manualDateConflict
                              ? manualDateConflict.type === 'holiday'
                                ? 'border-rose-500 ring-1 ring-rose-300 bg-rose-50/40'
                                : 'border-blue-500 ring-1 ring-blue-300 bg-blue-50/40'
                              : 'border-indigo-200'
                          }`}
                        />
                        {manualDateConflict && (
                          <p className={`text-[10px] font-black mt-1 ${manualDateConflict.type === 'holiday' ? 'text-rose-700' : 'text-blue-700'}`}>
                            ⛔ ممنوع البرمجة ({manualDateConflict.type === 'holiday' ? 'عطلة مدرسية' : 'أيام الامتحانات'}: {manualDateConflict.title})
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-1">التوقيت:</label>
                        <input
                          type="time"
                          value={manualTime}
                          onChange={(e) => setManualTime(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold text-slate-600">المكان / المؤسسة المحتضنة:</label>
                          <div className="inline-flex rounded-md bg-white border border-indigo-200 p-0.5 text-[9px] font-bold">
                            <button
                              type="button"
                              onClick={() => setManualVenueMode('school')}
                              className={`px-1.5 py-0.5 rounded cursor-pointer ${manualVenueMode === 'school' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                            >
                              🏫 مؤسسة
                            </button>
                            <button
                              type="button"
                              onClick={() => setManualVenueMode('custom')}
                              className={`px-1.5 py-0.5 rounded cursor-pointer ${manualVenueMode === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-600'}`}
                            >
                              🏟️ فضاء آخر
                            </button>
                          </div>
                        </div>
                        {manualVenueMode === 'school' ? (
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-1">
                              {(['ALL', 'ابتدائي', 'إعدادي', 'تأهيلي'] as const).map(cyc => (
                                <button
                                  key={`manual-host-cyc-${cyc}`}
                                  type="button"
                                  onClick={() => setManualHostSchoolCycleFilter(cyc)}
                                  className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-colors cursor-pointer ${
                                    manualHostSchoolCycleFilter === cyc
                                      ? 'bg-indigo-600 text-white border-indigo-600'
                                      : 'bg-white text-slate-600 border-indigo-200 hover:bg-indigo-50'
                                  }`}
                                >
                                  {cyc === 'ALL' ? 'الكل' : cyc}
                                </button>
                              ))}
                            </div>
                            <div className="relative">
                              <Search className="w-3 h-3 text-slate-400 absolute right-2 top-2" />
                              <input
                                type="text"
                                value={manualHostSchoolSearch}
                                onChange={(e) => setManualHostSchoolSearch(e.target.value)}
                                placeholder="بحث عن مؤسسة محتضنة..."
                                className="w-full pr-6 pl-2 py-1 bg-white border border-indigo-200 rounded-lg text-[10px] font-bold text-slate-700"
                              />
                            </div>
                            <select
                              value={manualHostSchoolId}
                              onChange={(e) => setManualHostSchoolId(e.target.value)}
                              className="w-full px-2 py-1.5 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800 cursor-pointer text-[11px]"
                            >
                              <option value="">-- افتراضي (مؤسسة الفريق الأول) --</option>
                              {schools
                                .filter(s => {
                                  if (s.id === manualHostSchoolId) return true;
                                  if (!matchesHostSchoolCycle(s, manualHostSchoolCycleFilter)) return false;
                                  if (!manualHostSchoolSearch.trim()) return true;
                                  const q = normalizeArabicSearch(manualHostSchoolSearch);
                                  return normalizeArabicSearch(s.name || '').includes(q) || normalizeArabicSearch(s.commune || '').includes(q);
                                })
                                .map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {uniqueSavedVenues.length > 0 && (
                              <select
                                value={uniqueSavedVenues.find(v => normalizeArabicSearch(v.name) === normalizeArabicSearch(manualVenueName))?.id || ''}
                                onChange={(e) => {
                                  const found = uniqueSavedVenues.find(v => v.id === e.target.value);
                                  if (found) setManualVenueName(found.name);
                                }}
                                className="w-full px-2 py-1 bg-white border border-indigo-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                              >
                                <option value="">-- اختر من الفضاءات المحفوظة --</option>
                                {uniqueSavedVenues.map(v => (
                                  <option key={`manual-ven-${v.id}`} value={v.id}>🏟️ {v.name}</option>
                                ))}
                              </select>
                            )}
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={manualVenueName}
                                onChange={(e) => setManualVenueName(e.target.value)}
                                placeholder="مثال: القاعة المغطاة..."
                                className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800"
                              />
                              <button
                                type="button"
                                onClick={() => saveCustomVenueIfNeeded(manualVenueName, true)}
                                disabled={isSavingVenue || !manualVenueName.trim() || isVenueNameSaved(manualVenueName)}
                                className={`px-2 py-1.5 rounded-xl text-[10px] font-black border shrink-0 transition-all cursor-pointer disabled:cursor-default ${
                                  isVenueNameSaved(manualVenueName)
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 disabled:opacity-40'
                                }`}
                                title="حفظ هذا الفضاء في القائمة ليبقى متاحاً في المرات القادمة"
                              >
                                {isVenueNameSaved(manualVenueName) ? 'محفوظ ✓' : '+ حفظ'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded-xl px-2.5 py-1">
                          <label className="text-[10px] font-black text-indigo-800 whitespace-nowrap">رقم المباراة:</label>
                          <input
                            type="number"
                            min={1}
                            value={manualMatchNumber}
                            onChange={(e) => setManualMatchNumber(e.target.value)}
                            placeholder={String(nextBranchMatchNumber)}
                            className="w-16 text-xs font-black text-center text-slate-900 focus:outline-none"
                          />
                        </div>
                        <input
                          type="text"
                          value={manualGroupName}
                          onChange={(e) => setManualGroupName(e.target.value)}
                          placeholder="اسم المجموعة (اختياري، مثال: المجموعة أ)"
                          className="w-full sm:w-56 px-2.5 py-1.5 bg-white border border-indigo-200 rounded-xl font-bold text-slate-800 text-[11px]"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddManualMatch(false)}
                          disabled={!manualTeam1Id || !manualTeam2Id || Boolean(manualDateConflict)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>إضافة المباراة إلى الجدول</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddManualMatch(true)}
                          disabled={!manualTeam1Id || !manualTeam2Id || Boolean(savingSingleMatchId) || Boolean(manualDateConflict)}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                        >
                          <Save className="w-4 h-4" />
                          <span>إضافة ووضع في البرنامج مباشرة</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Match Cards */}
                <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                  {displayedGeneratedMatches.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-300 rounded-2xl text-xs text-slate-500 font-bold">
                      {generatedMatches.length === 0
                        ? 'لا توجد مباريات مبرمجة حالياً — استخدم لوحة «البرمجة اليدوية» أعلاه لإضافة المباريات من الفرق المشاركة.'
                        : 'لا توجد مباريات مطابقة لاسم المؤسسة التي تبحث عنها.'}
                    </div>
                  ) : displayedGeneratedMatches.map((match, mIdx) => {
                    const assignedRefIds = match.refereeIds && match.refereeIds.length > 0
                      ? match.refereeIds
                      : (match.refereeId ? [match.refereeId] : []);
                    const matchBlockedPeriod = getBlockedConflictForMatch(match);
                    const matchOccupancy = findVenueOccupancyConflicts({
                      date: match.date,
                      time: match.time,
                      venueMode: match.venueMode || (match.hostSchoolId ? 'school' : 'custom'),
                      hostSchoolId: match.hostSchoolId,
                      venueId: match.venueId,
                      venueName: match.venueName,
                      excludeGeneratedMatchId: match.id
                    });
                    const hasVenueConflict =
                      matchOccupancy.conflictingExisting.length > 0 ||
                      matchOccupancy.conflictingSibling.length > 0;

                    return (
                      <div
                        key={match.id}
                        className={`p-4 rounded-2xl flex flex-col gap-3 text-xs shadow-2xs transition-colors border ${
                          matchBlockedPeriod
                            ? 'bg-rose-50/70 border-rose-300'
                            : hasVenueConflict
                            ? 'bg-amber-50/60 border-amber-300'
                            : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        {matchBlockedPeriod && (
                          <div className="p-2.5 rounded-xl bg-rose-100 border border-rose-300 text-rose-950 text-[11px] font-bold flex items-center gap-2">
                            <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>
                              ⛔ التاريخ <span className="font-mono font-black" dir="ltr">{match.date}</span> محظور للسلك المعني:{' '}
                              <strong>
                                {matchBlockedPeriod.type === 'exams' ? 'أيام الامتحانات' : 'عطلة مدرسية'} ({matchBlockedPeriod.title})
                              </strong>
                            </span>
                          </div>
                        )}
                        {hasVenueConflict && (
                          <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-950 text-[11px] space-y-1">
                            <div className="flex items-center gap-1.5 font-black text-red-900">
                              <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                              <span>
                                ⚠️ تنبيه تنسيقي: مركز التباري ({match.venueName || 'المحدد'}) غير شاغر في {match.date} حوالي {match.time || '10:00'}!
                              </span>
                            </div>
                            {matchOccupancy.conflictingExisting.map(cm => {
                              const s1 = schools.find(s => s.id === cm.team1Id)?.name || cm.team1Id;
                              const s2 = schools.find(s => s.id === cm.team2Id)?.name || cm.team2Id;
                              const sp = SPORTS_MAP[cm.sportId];
                              return (
                                <div key={cm.id} className="flex flex-wrap items-center justify-between gap-1.5 bg-white/90 px-2 py-1 rounded-lg border border-red-200 text-[10.5px]">
                                  <span className="font-bold">
                                    {sp?.icon || '🏆'} {sp?.name || cm.sportId}: {s1} ضد {s2}
                                  </span>
                                  <span className="font-mono font-bold text-red-700">⏰ {cm.startTime || '10:00'}</span>
                                </div>
                              );
                            })}
                            {matchOccupancy.conflictingSibling.map(gm => (
                              <div key={gm.id} className="flex flex-wrap items-center justify-between gap-1.5 bg-amber-100/80 px-2 py-1 rounded-lg border border-amber-300 text-[10.5px] text-amber-950">
                                <span className="font-bold">
                                  ⚠️ تداخل داخل هذه القرعة: {gm.team1Name} ضد {gm.team2Name}
                                </span>
                                <span className="font-mono font-bold">⏰ {gm.time || '10:00'}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Match Header: Teams & Stage */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                          <div className="space-y-1">
                            <div className="flex items-center flex-wrap gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-900 border border-blue-200 rounded-md font-black text-[10px]">
                                <span>المباراة رقم</span>
                                <input
                                  type="number"
                                  min={1}
                                  value={match.drawMatchNumber ?? mIdx + 1}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    handleUpdateMatchField(match.id, 'drawMatchNumber', Number.isFinite(val) && val > 0 ? val : mIdx + 1);
                                  }}
                                  className="w-10 bg-white/90 border border-blue-300 rounded px-1 text-center font-black text-[10px] text-blue-950 focus:outline-none"
                                  title="تعديل رقم المباراة"
                                />
                              </span>
                              {extractMatchGroupLabel(match) && (
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-900 border border-purple-200 rounded-md font-black text-[10px]">
                                  {extractMatchGroupLabel(match)}
                                </span>
                              )}
                              <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-bold text-[10px]">
                                الدور: {match.stage || 'دور المجموعات'}
                              </span>
                              {match.leg && (
                                <span className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                                  match.leg === 'second'
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-blue-100 text-blue-900 border border-blue-300'
                                }`}>
                                  {match.leg === 'second' ? '🔁 إياب' : '➡️ ذهاب'}
                                </span>
                              )}
                              {(isPlaceholderTeamId(match.team1Id) || isPlaceholderTeamId(match.team2Id)) && (
                                <span className="px-2 py-0.5 rounded-md font-black text-[10px] bg-indigo-100 text-indigo-900 border border-indigo-200">
                                  ⏳ مباراة إقصائية مستقبلية
                                </span>
                              )}
                            </div>
                            <div className="font-black text-sm text-slate-900 flex flex-wrap items-center gap-2">
                              <span className={isPlaceholderTeamId(match.team1Id) ? 'text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 text-xs' : 'text-emerald-700'}>
                                {match.team1Name}
                              </span>
                              <span className="text-slate-400 font-mono text-xs">ضد</span>
                              <span className={isPlaceholderTeamId(match.team2Id) ? 'text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200 text-xs' : 'text-blue-700'}>
                                {match.team2Name}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-bold">
                            {matchOccupancy.hasVenueSelection && (
                              <span className={`px-2 py-0.5 rounded-full border ${
                                hasVenueConflict
                                  ? 'bg-red-100 text-red-900 border-red-300'
                                  : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              }`}>
                                {hasVenueConflict ? '⚠️ المركز غير شاغر' : '✓ المركز شاغر'}
                              </span>
                            )}
                            <span className={`px-2 py-0.5 rounded-full ${
                              assignedRefIds.length > 0 
                                ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {assignedRefIds.length > 0 ? `${assignedRefIds.length} حكام معيّنون` : 'يعين لاحقاً'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleSaveSingleMatchToDatabase(match)}
                              disabled={savingSingleMatchId === match.id || Boolean(matchBlockedPeriod)}
                              className={`px-2.5 py-1 rounded-lg font-black text-[10px] flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                                savedByTempId[match.id]
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                              }`}
                              title="وضع هذه المباراة في البرنامج فوراً دون انتظار برمجة باقي المباريات"
                            >
                              <Save className="w-3 h-3" />
                              <span>
                                {savingSingleMatchId === match.id
                                  ? 'جاري الوضع...'
                                  : savedByTempId[match.id]
                                  ? '✓ في البرنامج (تحديث)'
                                  : 'وضع في البرنامج'}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGeneratedMatch(match.id)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف هذه المباراة من الجدول"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Match Inputs: Date & Time & Venue */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">التاريخ:</label>
                            <input
                              type="date"
                              value={match.date}
                              onChange={(e) => handleUpdateMatchField(match.id, 'date', e.target.value)}
                              className={`w-full px-2.5 py-1.5 bg-white border rounded-xl font-bold text-slate-800 ${
                                matchBlockedPeriod ? 'border-rose-500 ring-1 ring-rose-300' : 'border-slate-200'
                              }`}
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">التوقيت:</label>
                            <input
                              type="time"
                              value={match.time}
                              onChange={(e) => handleUpdateMatchField(match.id, 'time', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                            />
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-0.5">
                              <label className="text-[10px] font-bold text-slate-500">مكان المقابلة:</label>
                              <div className="inline-flex rounded-md bg-white border border-slate-200 p-0.5 text-[9px] font-bold">
                                <button
                                  type="button"
                                  onClick={() => {
                                    pushMatchHistorySnapshot(generatedMatches);
                                    const fallbackSchool = schools.find(s => s.id === match.hostSchoolId) || schools.find(s => s.id === match.team1Id) || schools[0];
                                    setGeneratedMatches(prev =>
                                      prev.map(gm =>
                                        gm.id === match.id
                                          ? {
                                              ...gm,
                                              venueMode: 'school',
                                              hostSchoolId: fallbackSchool?.id || '',
                                              venueId: fallbackSchool?.id || gm.venueId,
                                              venueName: fallbackSchool?.name || gm.venueName
                                            }
                                          : gm
                                      )
                                    );
                                  }}
                                  className={`px-1.5 py-0.5 rounded cursor-pointer ${(match.venueMode || 'school') === 'school' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                                >
                                  🏫 مؤسسة
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    pushMatchHistorySnapshot(generatedMatches);
                                    setGeneratedMatches(prev =>
                                      prev.map(gm =>
                                        gm.id === match.id
                                          ? {
                                              ...gm,
                                              venueMode: 'custom',
                                              hostSchoolId: '',
                                              venueId: 'custom',
                                              venueName: gm.venueMode === 'custom' ? gm.venueName : ''
                                            }
                                          : gm
                                      )
                                    );
                                  }}
                                  className={`px-1.5 py-0.5 rounded cursor-pointer ${match.venueMode === 'custom' ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                                >
                                  🏟️ فضاء آخر
                                </button>
                              </div>
                            </div>
                            {(match.venueMode || 'school') === 'school' ? (
                              <div className="space-y-1">
                                <div className="flex flex-wrap items-center gap-1">
                                  {(['ALL', 'ابتدائي', 'إعدادي', 'تأهيلي'] as const).map(cyc => {
                                    const activeCyc = hostSchoolCycleFilterByMatchId[match.id] || 'ALL';
                                    return (
                                      <button
                                        key={`m-host-cyc-${match.id}-${cyc}`}
                                        type="button"
                                        onClick={() =>
                                          setHostSchoolCycleFilterByMatchId(prev => ({ ...prev, [match.id]: cyc }))
                                        }
                                        className={`px-1.5 py-0.5 rounded-md text-[9px] font-bold border transition-colors cursor-pointer ${
                                          activeCyc === cyc
                                            ? 'bg-emerald-600 text-white border-emerald-600'
                                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                      >
                                        {cyc === 'ALL' ? 'الكل' : cyc}
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="relative">
                                  <Search className="w-3 h-3 text-slate-400 absolute right-2 top-2" />
                                  <input
                                    type="text"
                                    value={hostSchoolSearchByMatchId[match.id] || ''}
                                    onChange={(e) => {
                                      const qVal = e.target.value;
                                      setHostSchoolSearchByMatchId(prev => ({ ...prev, [match.id]: qVal }));
                                    }}
                                    placeholder="بحث عن مؤسسة..."
                                    className="w-full pr-6 pl-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700"
                                  />
                                </div>
                                <select
                                  value={match.hostSchoolId || ''}
                                  onChange={(e) => {
                                    pushMatchHistorySnapshot(generatedMatches);
                                    const sch = schools.find(s => s.id === e.target.value);
                                    setGeneratedMatches(prev =>
                                      prev.map(gm =>
                                        gm.id === match.id
                                          ? {
                                              ...gm,
                                              venueMode: 'school',
                                              hostSchoolId: sch?.id || '',
                                              venueId: sch?.id || '',
                                              venueName: sch?.name || ''
                                            }
                                          : gm
                                      )
                                    );
                                  }}
                                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer text-[11px]"
                                >
                                  <option value="">-- اختر المؤسسة المحتضنة --</option>
                                  {schools
                                    .filter(s => {
                                      if (s.id === match.hostSchoolId) return true;
                                      const activeCyc = hostSchoolCycleFilterByMatchId[match.id] || 'ALL';
                                      if (!matchesHostSchoolCycle(s, activeCyc)) return false;
                                      const rawQ = (hostSchoolSearchByMatchId[match.id] || '').trim();
                                      if (!rawQ) return true;
                                      const q = normalizeArabicSearch(rawQ);
                                      return normalizeArabicSearch(s.name || '').includes(q) || normalizeArabicSearch(s.commune || '').includes(q);
                                    })
                                    .map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {uniqueSavedVenues.length > 0 && (
                                  <select
                                    value={uniqueSavedVenues.find(v => normalizeArabicSearch(v.name) === normalizeArabicSearch(match.venueName))?.id || ''}
                                    onChange={(e) => {
                                      const found = uniqueSavedVenues.find(v => v.id === e.target.value);
                                      if (found) {
                                        pushMatchHistorySnapshot(generatedMatches);
                                        setGeneratedMatches(prev =>
                                          prev.map(gm =>
                                            gm.id === match.id
                                              ? { ...gm, venueMode: 'custom', hostSchoolId: '', venueId: found.id, venueName: found.name }
                                              : gm
                                          )
                                        );
                                      }
                                    }}
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 cursor-pointer"
                                  >
                                    <option value="">-- اختر من الفضاءات المحفوظة --</option>
                                    {uniqueSavedVenues.map(v => (
                                      <option key={`row-ven-${match.id}-${v.id}`} value={v.id}>🏟️ {v.name}</option>
                                    ))}
                                  </select>
                                )}
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={match.venueName}
                                    onChange={(e) => handleUpdateMatchField(match.id, 'venueName', e.target.value)}
                                    placeholder="مثال: القاعة المغطاة..."
                                    className="flex-1 min-w-0 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                                  />
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const savedVen = await saveCustomVenueIfNeeded(match.venueName, true);
                                      if (savedVen) {
                                        setGeneratedMatches(prev =>
                                          prev.map(gm =>
                                            gm.id === match.id
                                              ? { ...gm, venueId: savedVen.id, venueName: savedVen.name }
                                              : gm
                                          )
                                        );
                                      }
                                    }}
                                    disabled={isSavingVenue || !match.venueName?.trim() || isVenueNameSaved(match.venueName)}
                                    className={`px-2 py-1.5 rounded-xl text-[10px] font-black border shrink-0 flex items-center gap-1 transition-all cursor-pointer disabled:cursor-default ${
                                      isVenueNameSaved(match.venueName)
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 disabled:opacity-40'
                                    }`}
                                    title="حفظ هذا الفضاء في القائمة ليبقى متاحاً في المرات القادمة"
                                  >
                                    {isVenueNameSaved(match.venueName) ? (
                                      <span>محفوظ ✓</span>
                                    ) : (
                                      <>
                                        <BookmarkPlus className="w-3 h-3 shrink-0" />
                                        <span>حفظ</span>
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ⭐ STRUCTURED TABLE & FIELD REFEREES ASSIGNMENT PANEL ⭐ */}
                        {(() => {
                          const tableSlots = match.tableRefereeIds ?? ['', ''];
                          const fieldSlots = match.fieldRefereeIds ?? ['', ''];
                          const allTakenInMatch = [...tableSlots, ...fieldSlots].filter(Boolean);

                          const renderCategoryBox = (
                            role: 'table' | 'field',
                            slots: string[],
                            title: string,
                            accentStyle: { box: string; header: string; addBtn: string; label: string; selectBorder: string }
                          ) => (
                            <div className={`${accentStyle.box} p-2.5 rounded-xl border space-y-2`}>
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-[11px] font-black flex items-center gap-1.5 ${accentStyle.header}`}>
                                  <UserCheck className="w-3.5 h-3.5 shrink-0" />
                                  <span>{title}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleAddCategorySlotToMatch(match.id, role)}
                                  className={`px-2 py-0.5 rounded-lg text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${accentStyle.addBtn}`}
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>إضافة حكم</span>
                                </button>
                              </div>

                              {slots.length === 0 ? (
                                <p className="text-[10px] text-slate-500 font-bold text-center py-1">
                                  لا يوجد حكام في هذه الفئة — اضغط «إضافة حكم» للتعيين
                                </p>
                              ) : (
                                <div className="space-y-1.5">
                                  {slots.map((slotRefId, slotIdx) => {
                                    const ordLabel = getRefOrdinalLabel(slotIdx);
                                    const refObj = slotRefId ? combinedRefereesList.find(r => r.id === slotRefId) : undefined;
                                    const displayName = refObj?.fullName || (slotRefId ? resolveRefCleanName(slotRefId) : '');
                                    const fallbackContact = refObj?.phone
                                      ? { name: displayName, phone: refObj.phone }
                                      : (displayName ? findRefereeContact(displayName, referees, teachers) : { name: '', phone: '' });
                                    const roleTitle = `${role === 'table' ? 'حكم الطاولة' : 'حكم الساحة'} • ${ordLabel}`;
                                    const waMsg = displayName
                                      ? generateRefereeMatchNotificationMessage({
                                          refereeName: fallbackContact.name || displayName,
                                          refereeRole: roleTitle,
                                          sportName: currentSportName,
                                          ageCategory: selectedTournament?.ageCategory,
                                          gender: selectedTournament?.gender ? (GENDER_MAP[selectedTournament.gender]?.name || selectedTournament.gender) : undefined,
                                          stageName: match.stage,
                                          team1SchoolName: match.team1Name,
                                          team2SchoolName: match.team2Name,
                                          dateStr: match.date,
                                          timeStr: match.time || '10:00',
                                          venueName: match.venueName || 'المكان المحدد'
                                        })
                                      : '';

                                    const isRegisteredSlotRef = activeRefereesList.some(r => r.id === slotRefId);
                                    const manualSlotText = slotRefId && !isRegisteredSlotRef && !isOpaqueEntityId(slotRefId) ? slotRefId : '';

                                    return (
                                      <div key={`${match.id}-${role}-slot-${slotIdx}`} className="flex flex-wrap sm:flex-nowrap items-center gap-1.5">
                                        <span className={`text-[10px] font-black w-16 shrink-0 ${accentStyle.label}`}>
                                          {ordLabel} -
                                        </span>
                                        <select
                                          value={isRegisteredSlotRef ? slotRefId : ''}
                                          onChange={(e) => handleSetMatchCategoryReferee(match.id, role, slotIdx, e.target.value)}
                                          className={`flex-1 min-w-[120px] px-2 py-1 bg-white border rounded-lg font-bold text-slate-800 text-[10px] cursor-pointer ${accentStyle.selectBorder}`}
                                        >
                                          <option value="">-- اختر {ordLabel} ({currentSportName}) --</option>
                                          {activeRefereesList
                                            .filter(ref => ref.id === slotRefId || !allTakenInMatch.includes(ref.id))
                                            .map((ref, rIdx) => (
                                              <option key={`${match.id}-${role}-${slotIdx}-${ref.id}-${rIdx}`} value={ref.id}>
                                                {ref.name} {ref.specialty ? `[${ref.specialty}]` : ''}
                                              </option>
                                            ))}
                                        </select>
                                        <input
                                          type="text"
                                          value={manualSlotText}
                                          onChange={(e) => handleSetMatchCategoryReferee(match.id, role, slotIdx, e.target.value)}
                                          placeholder="أو اكتب الاسم يدوياً..."
                                          className={`w-full sm:w-32 px-2 py-1 bg-white border rounded-lg font-bold text-slate-800 text-[10px] placeholder:text-slate-400 ${accentStyle.selectBorder}`}
                                        />

                                        {displayName && (
                                          <a
                                            href={getWhatsAppUrl(fallbackContact.phone, waMsg)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={fallbackContact.phone ? `إرسال تكليف واتساب للحكم ${displayName} (${fallbackContact.phone})` : `إرسال تكليف واتساب للحكم ${displayName}`}
                                            className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors shrink-0"
                                          >
                                            <MessageCircle className="w-3.5 h-3.5" />
                                          </a>
                                        )}

                                        <button
                                          type="button"
                                          onClick={() => handleRemoveCategorySlotFromMatch(match.id, role, slotIdx)}
                                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                                          title={`حذف ${ordLabel}`}
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );

                          return (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {renderCategoryBox('table', tableSlots, 'حكام الطاولة', {
                                box: 'bg-sky-50/70 border-sky-200',
                                header: 'text-sky-950',
                                addBtn: 'bg-sky-600 hover:bg-sky-700',
                                label: 'text-sky-900',
                                selectBorder: 'border-sky-300 focus:ring-1 focus:ring-sky-500'
                              })}
                              {renderCategoryBox('field', fieldSlots, 'حكام الساحة', {
                                box: 'bg-amber-50/70 border-amber-300/80',
                                header: 'text-amber-950',
                                addBtn: 'bg-amber-600 hover:bg-amber-700',
                                label: 'text-amber-950',
                                selectBorder: 'border-amber-300 focus:ring-1 focus:ring-amber-500'
                              })}
                            </div>
                          );
                        })()}

                        {/* Optional Match Notes Field */}
                        <div className="pt-2 border-t border-slate-100">
                          <input
                            type="text"
                            value={match.notes || ''}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGeneratedMatches(prev =>
                                prev.map(gm => gm.id === match.id ? { ...gm, notes: val } : gm)
                              );
                            }}
                            placeholder="📝 ملاحظة اختيارية لهذه المباراة (اختياري)..."
                            className="w-full px-2.5 py-1.5 bg-slate-50 focus:bg-white border border-slate-200 rounded-lg text-[10px] font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Blocked Matches Restriction Summary */}
              {blockedGeneratedMatches.length > 0 && (
                <div className="p-3.5 rounded-2xl border-2 border-rose-300 bg-rose-50 text-xs font-bold text-rose-950 flex items-center gap-2.5">
                  <Lock className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>
                    {hasBlockedMatchesRestriction
                      ? `⛔ توجد ${blockedGeneratedMatches.length} مقابلة مبرمجة في تواريخ عطل أو امتحانات محظورة للسلك المعني. يرجى تعديل تواريخها قبل الحفظ.`
                      : `⚠️ تنبيه: توجد ${blockedGeneratedMatches.length} مقابلة تصادف تواريخ عطل أو امتحانات مسجلة في المنظومة.`}
                  </span>
                </div>
              )}

              {/* Final Submit & Save to Database */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-4 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>التراجع للمرحلة 2</span>
                  </button>
                  {matchHistory.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUndoStep3Edit}
                      className="px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>تراجع عن آخر تعديل</span>
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleSaveMatchesToDatabase}
                  disabled={isSaving || generatedMatches.length === 0 || hasBlockedMatchesRestriction}
                  className="px-7 py-3 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-4 h-4" />
                  <span>
                    {isSaving
                      ? 'جاري الحفظ والاعتماد...'
                      : hasBlockedMatchesRestriction
                      ? 'ممنوع الحفظ في تاريخ عطلة أو امتحانات'
                      : `حفظ واعتماد جدول المباريات والحكام (${generatedMatches.length} مباراة)`}
                  </span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: POST-SCHEDULING UNIFIED NOUVELLE DIFFUSION NOTIFICATIONS */}
          {/* ========================================================================= */}
          {step === 4 && selectedTournament && (
            <div className="space-y-5">
              <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-700 via-teal-800 to-slate-900 rounded-3xl text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-emerald-400/20 border border-emerald-300/40 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6 text-emerald-300" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-black text-white">
                      تم حفظ برمجة ({generatedMatches.length}) مقابلة بنجاح!
                    </h4>
                    <p className="text-xs text-emerald-100/90 mt-0.5">
                      أخبر جميع المعنيين بكل مقابلة (الحكام، مدير المؤسسة المحتضنة، ومديري وأساتذة الفريقين) بضغطة زر موحدة عبر لائحة البث (Nouvelle diffusion).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-white text-slate-900 hover:bg-emerald-50 rounded-xl text-xs font-black transition-colors cursor-pointer shrink-0"
                >
                  إنهاء وإغلاق
                </button>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {generatedMatches.map((gm, idx) => {
                  const tableNames = (gm.tableRefereeIds || []).map((rId, i) => resolveRefCleanName(rId) || (gm.tableRefereeNames?.[i] || '').replace(/\s*\(أستاذ\)\s*/g, '').trim()).filter(Boolean);
                  const fieldNames = (gm.fieldRefereeIds || []).map((rId, i) => resolveRefCleanName(rId) || (gm.fieldRefereeNames?.[i] || '').replace(/\s*\(أستاذ\)\s*/g, '').trim()).filter(Boolean);
                  const assignedIds = gm.refereeIds && gm.refereeIds.length > 0
                    ? gm.refereeIds
                    : (gm.refereeId ? [gm.refereeId] : []);
                  const resolvedRefereeNames = assignedIds.map((rId, rIdx) => {
                    return resolveRefCleanName(rId) || (gm.refereeNames?.[rIdx] || '').replace(/\s*\(أستاذ\)\s*/g, '').trim() || rId;
                  }).filter(Boolean);
                  const hostSch = gm.venueMode !== 'custom'
                    ? resolveHostSchoolForMatch({ hostSchoolId: gm.hostSchoolId, venueId: gm.venueId, venueName: gm.venueName }, schools)
                    : undefined;
                  const genderLabel = selectedTournament.gender ? (GENDER_MAP[selectedTournament.gender]?.name || selectedTournament.gender) : undefined;
                  const effectiveVenueName = hostSch?.name || gm.venueName || 'المكان المحدد';

                  return (
                    <div key={`wa-summary-${gm.id}`} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-black">
                            مقابلة #{gm.drawMatchNumber ?? idx + 1} • {gm.stage}
                          </span>
                          <span className="text-xs sm:text-sm font-black text-slate-900">
                            {gm.team1Name} <span className="text-slate-400 font-normal">ضد</span> {gm.team2Name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                          <span>📅 {gm.date}</span>
                          <span>⏰ {gm.time || '10:00'}</span>
                          <span>📍 {effectiveVenueName}</span>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600">
                          {tableNames.length > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-sky-50 text-sky-900 border border-sky-200">
                              📋 حكام الطاولة: {tableNames.map((n, i) => `${getRefOrdinalLabel(i)}: ${n}`).join(' ، ')}
                            </span>
                          )}
                          {fieldNames.length > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                              🏁 حكام الساحة: {fieldNames.map((n, i) => `${getRefOrdinalLabel(i)}: ${n}`).join(' ، ')}
                            </span>
                          )}
                          {tableNames.length === 0 && fieldNames.length === 0 && resolvedRefereeNames.length > 0 && (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                              🏁 الحكام: {resolvedRefereeNames.join(' ، ')}
                            </span>
                          )}
                          {hostSch && (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200">
                              🏫 المحتضنة: {hostSch.name}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setDiffusionTarget({
                              matchId: gm.id,
                              sportId: selectedTournament.sportId,
                              sportName: currentSportName,
                              ageCategory: selectedTournament.ageCategory,
                              gender: genderLabel,
                              stageName: gm.stage,
                              team1Id: gm.team1Id,
                              team2Id: gm.team2Id,
                              team1Name: gm.team1Name,
                              team2Name: gm.team2Name,
                              hostSchoolId: hostSch?.id || gm.hostSchoolId,
                              venueId: gm.venueId,
                              venueName: effectiveVenueName,
                              dateStr: gm.date,
                              timeStr: gm.time || '10:00',
                              referees: resolvedRefereeNames,
                              tableReferees: tableNames,
                              fieldReferees: fieldNames,
                              notes: gm.notes
                            });
                          }}
                          className="px-4 py-2 rounded-xl bg-gradient-to-l from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-black shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0"
                        >
                          <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>إخبار المعنيين بالمباراة</span>
                          <span className="px-1.5 py-0.5 rounded bg-white/15 border border-white/25 text-[9px] font-extrabold" dir="ltr">
                            <Share2 className="w-2.5 h-2.5 inline mr-1" />
                            Nouvelle diffusion
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  {savedMatchIds.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRevertSavedMatchesAndGoBack}
                      disabled={isRevertingSave}
                      className="px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="إلغاء حفظ هذه المباريات من الجدول والعودة إلى المرحلة 3 لتعديلها"
                    >
                      <Undo2 className="w-4 h-4" />
                      <span>
                        {isRevertingSave
                          ? 'جاري التراجع عن الحفظ...'
                          : `التراجع عن حفظ المباريات (${savedMatchIds.length}) والعودة للمرحلة 3`}
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>العودة للمرحلة 3 بدون حذف</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="px-7 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black cursor-pointer shadow-md"
                >
                  إتمام وإغلاق النافذة
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      <MatchBroadcastDiffusionModal
        isOpen={Boolean(diffusionTarget)}
        onClose={() => setDiffusionTarget(null)}
        target={diffusionTarget}
        schools={schools}
        refereesList={referees}
        teachersList={teachers}
      />
    </div>
  );
};
