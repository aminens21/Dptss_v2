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
  Award
} from 'lucide-react';
import { Tournament, School, Team, Match, User, Venue, Sport, Referee, SchoolTournamentConfirmation } from '../types';
import { DataService, SPORTS_MAP, deduplicateById, normalizeCategoryKey, getCustomCategoryName } from '../lib/dataService';
import { cn } from '../lib/utils';
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
  refereeIds?: string[];
  refereeNames?: string[];
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
  const [confirmations, setConfirmations] = useState<SchoolTournamentConfirmation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Workflow State: 1 = Choose Tournament & Filter, 2 = Review Teams & Draw Config, 3 = Draw & Schedule Matches with Referees
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(initialTournamentId || '');

  // Step 1 Filtering Options
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>(initialSportId || 'ALL');
  const [selectedAgeCategoryFilter, setSelectedAgeCategoryFilter] = useState<string>('ALL');
  const [selectedGenderFilter, setSelectedGenderFilter] = useState<string>('ALL');
  const [tournamentSearchQuery, setTournamentSearchQuery] = useState<string>('');

  // Step 2: Draw Configuration & Participating Schools
  const [schoolFilterMode, setSchoolFilterMode] = useState<'CONFIRMED_ONLY' | 'ALL'>('CONFIRMED_ONLY');
  const [participatingSchoolIds, setParticipatingSchoolIds] = useState<string[]>([]);
  const [groupAssignments, setGroupAssignments] = useState<Record<string, number | 'AUTO'>>({});
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
  const [bulkRefereeIds, setBulkRefereeIds] = useState<string[]>([]);
  const [showAllRefereesFallback, setShowAllRefereesFallback] = useState<boolean>(false);

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
          loadedConfirmations
        ] = await Promise.all([
          DataService.getTournaments(),
          DataService.getSportsConfig(),
          DataService.getSchools(),
          DataService.getStudents(),
          DataService.getVenues(),
          DataService.getReferees(),
          DataService.getTeachers(),
          DataService.getSchoolConfirmations()
        ]);

        setTournaments(loadedTournaments);
        setSportsConfig(loadedSports);
        setSchools(loadedSchools);
        setVenues(loadedVenues);
        setReferees(loadedReferees);
        setTeachers(loadedTeachers);
        setConfirmations(loadedConfirmations);

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

  // Auto switch schoolFilterMode to 'ALL' if 0 confirmed schools so Groups System is immediately accessible
  useEffect(() => {
    if (selectedTournamentId) {
      const tourn = tournaments.find(t => t.id === selectedTournamentId);
      if (tourn) {
        const confs = confirmations.filter(c => c.sportId === tourn.sportId);
        if (confs.length === 0) {
          setSchoolFilterMode('ALL');
        }
      }
    }
  }, [selectedTournamentId, confirmations, tournaments]);

  // Combined Referees List (Official Referees + Qualified Teachers, strictly deduplicated by ID)
  const combinedRefereesList = useMemo(() => {
    const list: {
      id: string;
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
      const specs = r.specialty || [];
      const specLabels = specs.map(s => SPORTS_MAP[s]?.name || s).join('، ');
      list.push({
        id: r.id,
        name: `حكم رسمي: ${r.fullName}`,
        fullName: r.fullName,
        phone: r.phone,
        specialty: specLabels,
        specialtiesList: specs,
        type: 'referee'
      });
    });

    teachers.forEach(t => {
      if (!t || !t.id) return;
      const specs = t.refereeSpecialty || [];
      if (seenIds.has(t.id)) {
        // If already added via referees, merge any missing specialties
        const existing = list.find(item => item.id === t.id);
        if (existing) {
          const merged = Array.from(new Set([...existing.specialtiesList, ...specs]));
          existing.specialtiesList = merged;
          existing.specialty = merged.map(s => SPORTS_MAP[s]?.name || s).join('، ');
        }
        return;
      }
      seenIds.add(t.id);
      const specLabels = specs.map(s => SPORTS_MAP[s]?.name || s).join('، ');
      list.push({
        id: t.id,
        name: `أستاذ(ة): ${t.fullName} (${t.workLocation || 'مؤسسة'})`,
        fullName: t.fullName,
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

    const isTechHead = currentUser.isTechCommitteeHead || currentUser.role === 'SPORT_MANAGER';
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

  // Filter Tournaments based on User Role, Team Sports, Sport, Category & Gender
  const filteredTournaments = useMemo(() => {
    return tournaments.filter(t => {
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

      // 4. Age Category Filter
      if (selectedAgeCategoryFilter !== 'ALL') {
        const tournNormCat = normalizeCategoryKey(t.ageCategory || '');
        const filterNormCat = normalizeCategoryKey(selectedAgeCategoryFilter);
        const matches = tournNormCat === filterNormCat || (t.ageCategory && t.ageCategory.includes(selectedAgeCategoryFilter));
        if (!matches) {
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
    sportsConfig,
    userSportRestriction,
    selectedSportFilter,
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

  // Compute schools that confirmed participation for this specific tournament
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

      // 2. Age Category check (if specified in confirmation)
      if (c.categories && c.categories.length > 0 && selectedTournament.ageCategory) {
        const tournCatNorm = normalizeCategoryKey(selectedTournament.ageCategory);
        const matchesCat = c.categories.some(cat => 
          normalizeCategoryKey(cat) === tournCatNorm || cat === selectedTournament.ageCategory
        );
        if (!matchesCat) return false;
      }

      // 3. Gender check (if specified in confirmation)
      if (c.genders && c.genders.length > 0 && selectedTournament.gender && selectedTournament.gender !== 'Mixed') {
        if (!c.genders.includes(selectedTournament.gender as any)) return false;
      }

      // 4. Affiliation check (if specified in confirmation and tournament)
      if (selectedTournament.affiliationType && c.affiliationTypes && c.affiliationTypes.length > 0) {
        if (!c.affiliationTypes.includes(selectedTournament.affiliationType)) return false;
      }

      return true;
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
      // If no school confirmed yet, find teams excluding withdrawn schools
      const matchedTeams = teams.filter(t => {
        const sc = schools.find(s => s.id === t.schoolId);
        if (isWithdrawn(t.schoolId, sc?.name || t.name)) return false;

        if (t.tournamentId && t.tournamentId === selectedTournament.id) return true;
        if (t.sportId === selectedTournament.sportId) {
          const catMatch = !selectedTournament.ageCategory || normalizeCategoryKey(t.category) === normalizeCategoryKey(selectedTournament.ageCategory);
          const genMatch = !selectedTournament.gender || selectedTournament.gender === 'Mixed' || t.gender === selectedTournament.gender;
          return catMatch && genMatch;
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
    const q = schoolSearchQuery.toLowerCase();
    return baseList.filter(s => 
      (s.name || '').toLowerCase().includes(q) || 
      (s.commune || '').toLowerCase().includes(q) ||
      (s.type || '').toLowerCase().includes(q)
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
      const schoolName = school?.name || sId;

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

      if (school) {
        list.push({
          id: school.id,
          name: school.name,
          schoolName: school.name
        });
      } else {
        list.push({
          id: sId,
          name: sId,
          schoolName: sId
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
        const numGroups = Math.min(groupsCount, allDrawTeams.length);
        const groups: { groupName: string; teams: { id: string; name: string }[] }[] = [];

        for (let i = 0; i < numGroups; i++) {
          groups.push({
            groupName: alphabet[i] || `المجموعة ${i + 1}`,
            teams: []
          });
        }

        // 1. Place teams explicitly assigned to specific groups
        const unassignedTeams: typeof allDrawTeams = [];
        allDrawTeams.forEach(team => {
          const assignedIdx = groupAssignments[team.id];
          if (typeof assignedIdx === 'number' && assignedIdx >= 0 && assignedIdx < numGroups) {
            groups[assignedIdx].teams.push(team);
          } else {
            unassignedTeams.push(team);
          }
        });

        // 2. Distribute unassigned teams randomly to balance group sizes
        const shuffledUnassigned = [...unassignedTeams].sort(() => Math.random() - 0.5);
        shuffledUnassigned.forEach(team => {
          let minGroupIdx = 0;
          for (let i = 1; i < numGroups; i++) {
            if (groups[i].teams.length < groups[minGroupIdx].teams.length) {
              minGroupIdx = i;
            }
          }
          groups[minGroupIdx].teams.push(team);
        });

        // 3. 🌟 CRITICAL: "على أن تتم القرعة داخل كل مجموعة"
        // Perform the electronic draw / random shuffle WITHIN EACH GROUP
        groups.forEach(grp => {
          grp.teams = [...grp.teams].sort(() => Math.random() - 0.5);
        });

        setDrawnGroups(groups);

        // Generate matches for each group (Round robin in each group)
        const matchesList: GeneratedDrawMatch[] = [];
        let matchCounter = 1;
        const defaultVenue = venues[0]?.name || 'القاعة المغطاة';
        const defaultDate = new Date().toISOString().slice(0, 10);
        const defaultRef = sportSpecializedReferees[0] || (combinedRefereesList[0] || null);
        const initialRefIds = defaultRef ? [defaultRef.id] : [];
        const initialRefNames = defaultRef ? [defaultRef.fullName || defaultRef.name] : [];

        groups.forEach(grp => {
          const grpTeams = grp.teams;
          for (let i = 0; i < grpTeams.length; i++) {
            for (let j = i + 1; j < grpTeams.length; j++) {
              matchesList.push({
                id: `gen-match-${matchCounter++}`,
                stage: `${grp.groupName} - مواجهة الجولة ${i + 1}`,
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
                refereeName: defaultRef?.name,
                refereeIds: initialRefIds,
                refereeNames: initialRefNames
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
        const defaultRef = sportSpecializedReferees[0] || (combinedRefereesList[0] || null);
        const initialRefIds = defaultRef ? [defaultRef.id] : [];
        const initialRefNames = defaultRef ? [defaultRef.fullName || defaultRef.name] : [];

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
            refereeName: defaultRef?.name,
            refereeIds: initialRefIds,
            refereeNames: initialRefNames
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
      prev.map(m => {
        if (m.id !== matchId) return m;
        return { ...m, [field]: value };
      })
    );
  };

  // Add a referee to a specific match (supports multiple referees per match)
  const handleAddRefereeToMatch = (matchId: string, refereeId: string) => {
    if (!refereeId) return;
    const ref = combinedRefereesList.find(r => r.id === refereeId);
    if (!ref) return;

    setGeneratedMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m;
        const currentIds = m.refereeIds && m.refereeIds.length > 0
          ? [...m.refereeIds]
          : (m.refereeId ? [m.refereeId] : []);
        const currentNames = m.refereeNames && m.refereeNames.length > 0
          ? [...m.refereeNames]
          : (m.refereeName ? [m.refereeName] : []);

        if (currentIds.includes(refereeId)) return m;

        const updatedIds = [...currentIds, refereeId];
        const updatedNames = [...currentNames, ref.fullName || ref.name];

        return {
          ...m,
          refereeIds: updatedIds,
          refereeNames: updatedNames,
          refereeId: updatedIds[0] || undefined,
          refereeName: updatedNames[0] || undefined,
          referee2Id: updatedIds[1] || undefined,
          referee2Name: updatedNames[1] || undefined
        };
      })
    );
  };

  // Remove a referee from a specific match
  const handleRemoveRefereeFromMatch = (matchId: string, refereeIdToRemove: string) => {
    setGeneratedMatches(prev =>
      prev.map(m => {
        if (m.id !== matchId) return m;
        const currentIds = m.refereeIds && m.refereeIds.length > 0
          ? [...m.refereeIds]
          : (m.refereeId ? [m.refereeId] : []);
        const currentNames = m.refereeNames && m.refereeNames.length > 0
          ? [...m.refereeNames]
          : (m.refereeName ? [m.refereeName] : []);

        const newIds: string[] = [];
        const newNames: string[] = [];

        currentIds.forEach((id, idx) => {
          if (id !== refereeIdToRemove) {
            newIds.push(id);
            newNames.push(currentNames[idx] || '');
          }
        });

        return {
          ...m,
          refereeIds: newIds,
          refereeNames: newNames,
          refereeId: newIds[0] || undefined,
          refereeName: newNames[0] || undefined,
          referee2Id: newIds[1] || undefined,
          referee2Name: newNames[1] || undefined
        };
      })
    );
  };

  // Apply batch date, venue & multi-referee to all matches
  const handleApplyBatchSchedule = () => {
    if (!bulkDate && !bulkVenueName && bulkRefereeIds.length === 0 && !bulkRefereeId) {
      toast.error('يرجى تحديد التاريخ، المكان أو اختيار حكم واحد على الأقل لتعميمه');
      return;
    }

    const effectiveBulkIds = bulkRefereeIds.length > 0 
      ? bulkRefereeIds 
      : (bulkRefereeId ? [bulkRefereeId] : []);

    const bulkRefNames = effectiveBulkIds
      .map(id => {
        const r = combinedRefereesList.find(ref => ref.id === id);
        return r?.fullName || r?.name;
      })
      .filter(Boolean) as string[];

    setGeneratedMatches(prev => 
      prev.map(m => {
        const updatedRefIds = effectiveBulkIds.length > 0 
          ? effectiveBulkIds 
          : (m.refereeIds || (m.refereeId ? [m.refereeId] : []));
        const updatedRefNames = effectiveBulkIds.length > 0 
          ? bulkRefNames 
          : (m.refereeNames || (m.refereeName ? [m.refereeName] : []));

        return {
          ...m,
          date: bulkDate || m.date,
          time: bulkTime || m.time,
          venueName: bulkVenueName || m.venueName,
          refereeIds: updatedRefIds,
          refereeNames: updatedRefNames,
          refereeId: updatedRefIds[0] || undefined,
          refereeName: updatedRefNames[0] || undefined,
          referee2Id: updatedRefIds[1] || undefined,
          referee2Name: updatedRefNames[1] || undefined
        };
      })
    );
    toast.success('تم تعميم التوقيت والمكان والحكام المتخصصين على جميع المباريات');
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
        const allRefs = gm.refereeIds && gm.refereeIds.length > 0
          ? gm.refereeIds
          : (gm.refereeId ? [gm.refereeId] : []);

        await DataService.addMatch({
          tournamentId: selectedTournament.id,
          sportId: selectedTournament.sportId,
          stage: gm.stage,
          groupName: gm.groupName,
          team1Id: gm.team1Id,
          team2Id: gm.team2Id,
          ageCategory: selectedTournament.ageCategory,
          gender: selectedTournament.gender,
          date: gm.date,
          startTime: gm.time || '10:00',
          venueId: gm.venueId || 'default-venue',
          venueName: gm.venueName,
          referee1Id: allRefs[0] || undefined,
          referee2Id: allRefs[1] || undefined,
          referees: allRefs,
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
      'حكام المقابلة': (m.refereeNames && m.refereeNames.length > 0)
        ? m.refereeNames.join(' + ')
        : (m.refereeName || 'غير محدد')
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

                {/* Filter Row 2: Specific Sport, Age Category & Gender */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  
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
                    <h4 className={`text-sm font-black ${
                      selectedTournament.affiliationType === 'club_affiliated' ? 'text-amber-950' : 'text-emerald-950'
                    }`}>{selectedTournament.name}</h4>
                    <p className={`text-xs ${
                      selectedTournament.affiliationType === 'club_affiliated' ? 'text-amber-800' : 'text-emerald-800'
                    } font-bold`}>
                      {SPORTS_MAP[selectedTournament.sportId]?.name} • {selectedTournament.ageCategory} • {selectedTournament.gender === 'Female' ? 'إناث' : 'ذكور'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setStep(1)}
                  className={`px-3 py-1.5 bg-white ${
                    selectedTournament.affiliationType === 'club_affiliated' ? 'text-amber-800 border-amber-200 hover:bg-amber-100' : 'text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  } rounded-xl text-xs font-bold border cursor-pointer`}
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
                        ? selectedTournament.affiliationType === 'club_affiliated'
                          ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400/20'
                          : 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400/20'
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
                        ? selectedTournament.affiliationType === 'club_affiliated'
                          ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-400/20'
                          : 'bg-emerald-50 border-emerald-600 ring-2 ring-emerald-400/20'
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
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-3">
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

                    {/* Pre-assignment Controls & Group Summary Badges */}
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
                        يمكنك تحديد المجموعة لكل مؤسسة بالضغط على أزرار [أ، ب، ج، د] في بطاقتها أدناه. الفرق المتبقية ستوزع تلقائياً لتوازن المجموعات، والقرعة وسحب المباريات والمواعيد تجرى إلكترونياً داخل كل مجموعة.
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
                  </div>
                )}
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

                          {/* Group Assignment Buttons for Group Draw System */}
                          {isSelected && drawSystem === 'groups' && (
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
                          {drawSystem === 'groups' && (
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
                        {grp.teams.map((t, tIdx) => (
                          <div key={t.id} className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                            <span className={`w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center font-bold ${
                              selectedTournament.affiliationType === 'club_affiliated' ? 'bg-amber-600' : 'bg-emerald-600'
                            }`}>
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
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">إضافة حكام لتعميمهم:</label>
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value && !bulkRefereeIds.includes(e.target.value)) {
                          setBulkRefereeIds(prev => [...prev, e.target.value]);
                        }
                      }}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 cursor-pointer"
                    >
                      <option value="">+ إضافة حكم متخصص للتعميم...</option>
                      {activeRefereesList
                        .filter(ref => !bulkRefereeIds.includes(ref.id))
                        .map((ref, rIdx) => (
                          <option key={`bulk-ref-opt-${ref.id}-${rIdx}`} value={ref.id}>
                            {ref.name} {ref.specialty ? `[${ref.specialty}]` : ''}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Display selected bulk referee chips */}
                {bulkRefereeIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-emerald-200/60">
                    <span className="text-[10px] font-bold text-slate-600">الحكام المختارون للتعميم:</span>
                    {bulkRefereeIds.map((refId, idx) => {
                      const refObj = combinedRefereesList.find(r => r.id === refId);
                      return (
                        <span
                          key={`bulk-chip-${refId}-${idx}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-950 rounded-xl text-xs font-bold shadow-2xs"
                        >
                          <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                          <span>الحكم {idx + 1}: {refObj?.fullName || refObj?.name}</span>
                          <button
                            type="button"
                            onClick={() => setBulkRefereeIds(prev => prev.filter(id => id !== refId))}
                            className="hover:text-red-700 hover:bg-amber-200 rounded-full p-0.5 transition-colors cursor-pointer"
                            title="إزالة"
                          >
                            <X className="w-3 h-3 text-red-600" />
                          </button>
                        </span>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setBulkRefereeIds([])}
                      className="text-[10px] font-bold text-red-600 hover:text-red-800 underline mr-1 cursor-pointer"
                    >
                      مسح التحديد
                    </button>
                  </div>
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
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span>جدول المباريات وتعيين الحكام المتخصصين ({generatedMatches.length} مباراة):</span>
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
                <div className="space-y-3.5 max-h-[460px] overflow-y-auto pr-1">
                  {generatedMatches.map((match, mIdx) => {
                    const assignedRefIds = match.refereeIds && match.refereeIds.length > 0
                      ? match.refereeIds
                      : (match.refereeId ? [match.refereeId] : []);

                    return (
                      <div
                        key={match.id}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col gap-3 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                      >
                        {/* Match Header: Teams & Stage */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-2.5">
                          <div className="space-y-1">
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-bold text-[10px]">
                              {match.stage} • مقابلة #{mIdx + 1}
                            </span>
                            <div className="font-black text-sm text-slate-900 flex items-center gap-2">
                              <span className="text-emerald-700">{match.team1Name}</span>
                              <span className="text-slate-400 font-mono text-xs">ضد</span>
                              <span className="text-blue-700">{match.team2Name}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 text-[10px] font-bold">
                            <span className={`px-2 py-0.5 rounded-full ${
                              assignedRefIds.length > 0 
                                ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                                : 'bg-slate-200 text-slate-600'
                            }`}>
                              {assignedRefIds.length > 0 ? `${assignedRefIds.length} حكام معيّنون` : 'لم يعيّن حكام بعد'}
                            </span>
                          </div>
                        </div>

                        {/* Match Inputs: Date, Time, Venue & Multi-Referee */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">التاريخ:</label>
                            <input
                              type="date"
                              value={match.date}
                              onChange={(e) => handleUpdateMatchField(match.id, 'date', e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
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
                            <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الملعب / المكان:</label>
                            <input
                              type="text"
                              value={match.venueName}
                              onChange={(e) => handleUpdateMatchField(match.id, 'venueName', e.target.value)}
                              placeholder="اسم القاعة / الملعب"
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-bold text-slate-800"
                            />
                          </div>

                          {/* ⭐ MULTI-REFEREE ASSIGNMENT FIELD ⭐ */}
                          <div className="bg-amber-50/60 p-2.5 rounded-xl border border-amber-300/80 space-y-1.5">
                            <div className="flex items-center justify-between text-[10px] font-black text-amber-950">
                              <span className="flex items-center gap-1">
                                <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                                <span>حكام المقابلة ({currentSportName}):</span>
                              </span>
                              <span className="text-[9px] text-amber-700 font-bold">
                                (متعدد)
                              </span>
                            </div>

                            {/* Assigned Referee Chips */}
                            {assignedRefIds.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {assignedRefIds.map((refId, idx) => {
                                  const refObj = combinedRefereesList.find(r => r.id === refId);
                                  const displayName = refObj?.fullName || match.refereeNames?.[idx] || 'حكم';
                                  return (
                                    <span
                                      key={`match-${match.id}-chip-${refId}-${idx}`}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-white border border-amber-300 text-amber-950 rounded-lg text-[10px] font-bold shadow-2xs"
                                    >
                                      <span className="w-3.5 h-3.5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[8px] font-black shrink-0">
                                        {idx + 1}
                                      </span>
                                      <span className="truncate max-w-[110px]" title={displayName}>
                                        {displayName}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveRefereeFromMatch(match.id, refId)}
                                        className="text-slate-400 hover:text-red-600 rounded-full p-0.5 transition-colors cursor-pointer"
                                        title="إزالة الحكم"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Dropdown to add another specialized referee */}
                            <select
                              value=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleAddRefereeToMatch(match.id, e.target.value);
                                }
                              }}
                              className="w-full px-2 py-1 bg-white border border-amber-300 rounded-lg font-bold text-amber-950 cursor-pointer text-[10px] focus:ring-1 focus:ring-amber-500"
                            >
                              <option value="">
                                {assignedRefIds.length > 0
                                  ? `+ إضافة حكم آخر متخصص في ${currentSportName}...`
                                  : `-- تعيين حكم متخصص في ${currentSportName} --`}
                              </option>
                              {activeRefereesList
                                .filter(ref => !assignedRefIds.includes(ref.id))
                                .map((ref, rIdx) => (
                                  <option key={`match-${match.id}-ref-opt-${ref.id}-${rIdx}`} value={ref.id}>
                                    {ref.name} {ref.specialty ? `[${ref.specialty}]` : ''}
                                  </option>
                                ))}
                            </select>
                          </div>
                        </div>

                      </div>
                    );
                  })}
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
