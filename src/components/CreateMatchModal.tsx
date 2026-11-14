import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Match, School, Venue, Tournament, Referee, Student, User } from '../types';
import { X, CalendarDays, Clock, MapPin, Trophy, AlertTriangle, AlertCircle, Calendar, ArrowRight, ShieldCheck, Lock, Users, Tag, UserCheck, Plus, Building, Info, Search, CheckCircle2, MessageCircle } from 'lucide-react';
import { SPORTS_MAP, AGE_CATEGORIES, GENDER_MAP, DataService, getAgeCategoriesForSeason, normalizeCategoryKey, normalizeDateToYmd } from '../lib/dataService';
import { resolveHostSchoolForMatch, findRefereeContact, generateRefereeMatchNotificationMessage, getWhatsAppUrl } from '../lib/whatsappService';
import { MatchBroadcastDiffusionModal, MatchBroadcastDiffusionTarget } from './MatchBroadcastDiffusionModal';
import toast from 'react-hot-toast';

interface CreateMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  venues: Venue[];
  students?: Student[];
  teachers?: User[];
  tournaments?: Tournament[];
  matches?: Match[];
  managerSportId?: string; // If set, user is restricted to this sport only
  allowedSportIds?: string[] | null; // If set & non-null, user is restricted to these sports
  initialSportId?: string;
  initialTournamentId?: string; // Pre-select a tournament if opened from inside it
  initialAffiliation?: 'non_club' | 'club_affiliated' | 'open';
  initialCategory?: string;
  initialGender?: 'Male' | 'Female' | 'Mixed';
  onSave: (match: Omit<Match, 'id'>, matchId?: string) => Promise<void>;
  editingMatch?: Match | null;
}

export const CreateMatchModal: React.FC<CreateMatchModalProps> = ({
  isOpen,
  onClose,
  schools,
  venues,
  students = [],
  teachers = [],
  tournaments = [],
  matches = [],
  managerSportId,
  allowedSportIds = null,
  initialSportId,
  initialTournamentId,
  initialAffiliation,
  initialCategory,
  initialGender,
  onSave,
  editingMatch
}) => {
  // Restricted sports list for Technical Committee Head / Sport Manager (null = unrestricted)
  const effectiveAllowedSportIds = useMemo<string[] | null>(() => {
    if (managerSportId) return [managerSportId];
    if (allowedSportIds && allowedSportIds.length > 0) return allowedSportIds;
    return null;
  }, [managerSportId, allowedSportIds]);

  const singleLockedSportId = effectiveAllowedSportIds && effectiveAllowedSportIds.length === 1
    ? effectiveAllowedSportIds[0]
    : undefined;

  // Filter tournaments if manager/tech head has restricted sport(s) or sport was requested
  const effectiveSportId = singleLockedSportId || (
    initialSportId && (!effectiveAllowedSportIds || effectiveAllowedSportIds.includes(initialSportId))
      ? initialSportId
      : effectiveAllowedSportIds?.[0]
  );

  const availableTournaments = useMemo(() => {
    let list = tournaments;
    if (effectiveAllowedSportIds) {
      const allowedMatching = tournaments.filter(t => effectiveAllowedSportIds.includes(t.sportId));
      list = allowedMatching;
    } else if (effectiveSportId) {
      const matching = tournaments.filter(t => t.sportId === effectiveSportId);
      if (matching.length > 0) {
        list = matching;
      }
    }
    const seen = new Set<string>();
    return list.filter(t => {
      if (!t || !t.id) return false;
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });
  }, [tournaments, effectiveSportId, effectiveAllowedSportIds]);

  const [tournamentId, setTournamentId] = useState(availableTournaments[0]?.id || 'tourn-1');
  const [team1Id, setTeam1Id] = useState(schools[0]?.id || 'sch-1');
  const [team2Id, setTeam2Id] = useState(schools[1]?.id || 'sch-2');
  const [stage, setStage] = useState('دور المجموعات');
  const [sportId, setSportId] = useState(effectiveSportId || availableTournaments[0]?.sportId || 'football');
  const [ageCategory, setAgeCategory] = useState<string>(initialCategory || availableTournaments[0]?.ageCategory || 'U12');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Mixed'>(initialGender || availableTournaments[0]?.gender || 'Male');
  const [affiliationType, setAffiliationType] = useState<'non_club' | 'club_affiliated' | 'open'>(initialAffiliation || 'non_club');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('10:00');
  const [venueMode, setVenueMode] = useState<'school' | 'custom'>('school');
  const [hostSchoolId, setHostSchoolId] = useState<string>(schools[0]?.id || '');
  const [hostSchoolSearch, setHostSchoolSearch] = useState<string>('');
  const [venueId, setVenueId] = useState(venues[0]?.id || 'ven-1');
  const [customVenueName, setCustomVenueName] = useState<string>('');
  const [referees, setReferees] = useState<string[]>(['']);
  const [allReferees, setAllReferees] = useState<Referee[]>([]);
  const [status, setStatus] = useState<Match['status']>('Scheduled');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSeason, setCurrentSeason] = useState('2026/2027');
  const [showAllSchools, setShowAllSchools] = useState<boolean>(false);

  // Post-scheduling unified WhatsApp Nouvelle diffusion state
  const [savedMatchSummary, setSavedMatchSummary] = useState<MatchBroadcastDiffusionTarget | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShowAllSchools(false);
      setSavedMatchSummary(null);
      setHostSchoolSearch('');
      DataService.getActiveSeason()
        .then(season => setCurrentSeason(season))
        .catch(err => console.warn("Error loading season in match modal:", err));
    }
  }, [isOpen]);

  // Load referees from DataService
  useEffect(() => {
    if (isOpen) {
      DataService.getReferees().then(data => {
        setAllReferees(data);
      }).catch(err => {
        console.warn("Failed to load referees:", err);
      });
    }
  }, [isOpen]);

  // Current match sport
  const currentSport = singleLockedSportId || sportId;

  // Filter referees by specialty in the current sport
  const specializedReferees = useMemo(() => {
    return allReferees.filter(r => {
      if (r.isActive === false) return false;
      if (Array.isArray(r.specialty)) {
        return r.specialty.includes(currentSport);
      }
      return r.specialty === currentSport;
    });
  }, [allReferees, currentSport]);

  const otherReferees = useMemo(() => {
    return allReferees.filter(r => {
      if (r.isActive === false) return false;
      if (Array.isArray(r.specialty)) {
        return !r.specialty.includes(currentSport);
      }
      return r.specialty !== currentSport;
    });
  }, [allReferees, currentSport]);

  // Sync sport and tournament when managerSportId or tournaments change
  useEffect(() => {
    if (editingMatch) {
      setTournamentId(editingMatch.tournamentId);
      setTeam1Id(editingMatch.team1Id);
      setTeam2Id(editingMatch.team2Id);
      setStage(editingMatch.stage);
      setSportId(editingMatch.sportId || 'football');
      if (editingMatch.ageCategory) setAgeCategory(editingMatch.ageCategory);
      if (editingMatch.gender) setGender(editingMatch.gender);
      
      if (editingMatch.date) {
        const parsedYmd = normalizeDateToYmd(editingMatch.date);
        if (parsedYmd) setDate(parsedYmd);
      }
      
      setStartTime(editingMatch.startTime);
      const matchedHostSchool = resolveHostSchoolForMatch(editingMatch, schools);
      if (matchedHostSchool) {
        setVenueMode('school');
        setHostSchoolId(matchedHostSchool.id);
        setVenueId(matchedHostSchool.id);
        setCustomVenueName('');
      } else {
        setVenueMode('custom');
        setHostSchoolId('');
        setVenueId(editingMatch.venueId || 'custom');
        const matchedVen = venues.find(v => v.id === editingMatch.venueId);
        setCustomVenueName(editingMatch.venueName || matchedVen?.name || editingMatch.venueId || '');
      }
      
      // Load existing referees
      if (editingMatch.referees && editingMatch.referees.length > 0) {
        setReferees(editingMatch.referees);
      } else {
        const legacyReferees = [];
        if (editingMatch.referee1Id) legacyReferees.push(editingMatch.referee1Id);
        if (editingMatch.referee2Id) legacyReferees.push(editingMatch.referee2Id);
        setReferees(legacyReferees.length > 0 ? legacyReferees : ['']);
      }
      
      setStatus(editingMatch.status);
      setNotes(editingMatch.notes || '');
      if (editingMatch.affiliationType) setAffiliationType(editingMatch.affiliationType);
    } else {
      setNotes('');
      if (schools.length > 0) {
        setVenueMode('school');
        setHostSchoolId(schools[0].id);
        setVenueId(schools[0].id);
        setCustomVenueName('');
      } else {
        setVenueMode('custom');
        setHostSchoolId('');
        setVenueId(venues[0]?.id || 'custom');
        setCustomVenueName(venues[0]?.name || 'القاعة المغطاة');
      }
      if (singleLockedSportId) {
        setSportId(singleLockedSportId);
      } else if (initialSportId && (!effectiveAllowedSportIds || effectiveAllowedSportIds.includes(initialSportId))) {
        setSportId(initialSportId);
      } else if (effectiveAllowedSportIds && effectiveAllowedSportIds.length > 0) {
        setSportId(effectiveAllowedSportIds[0]);
      }
      if (initialCategory) {
        setAgeCategory(initialCategory);
      }
      if (initialGender) {
        setGender(initialGender);
      }
      if (initialAffiliation) {
        setAffiliationType(initialAffiliation);
      }

      if (initialTournamentId && availableTournaments.some(t => t.id === initialTournamentId)) {
        const target = availableTournaments.find(t => t.id === initialTournamentId)!;
        setTournamentId(target.id);
        if (target.sportId && !singleLockedSportId) setSportId(target.sportId);
        if (target.ageCategory) setAgeCategory(target.ageCategory);
        if (target.gender) setGender(target.gender);
        if (target.affiliationType) setAffiliationType(target.affiliationType);
      } else if (availableTournaments.length > 0) {
        // Find best matching tournament
        const matchingTourn = availableTournaments.find(t => 
          (!initialSportId || t.sportId === initialSportId) &&
          (!initialCategory || normalizeCategoryKey(t.ageCategory) === normalizeCategoryKey(initialCategory)) &&
          (!initialGender || t.gender === initialGender)
        ) || availableTournaments[0];

        if (matchingTourn) {
          setTournamentId(matchingTourn.id);
          if (matchingTourn.sportId && !singleLockedSportId) setSportId(matchingTourn.sportId);
          if (matchingTourn.ageCategory) setAgeCategory(matchingTourn.ageCategory);
          if (matchingTourn.gender) setGender(matchingTourn.gender);
          if (matchingTourn.affiliationType) setAffiliationType(matchingTourn.affiliationType);
        }
      }
    }
  }, [managerSportId, singleLockedSportId, effectiveAllowedSportIds, availableTournaments, isOpen, editingMatch, initialTournamentId, initialSportId, initialCategory, initialGender, initialAffiliation, schools, venues]);

  // Effective venue ID & name based on venueMode ('school' vs 'custom')
  const selectedHostSchool = useMemo(
    () => (venueMode === 'school' ? schools.find(s => s.id === hostSchoolId) : undefined),
    [venueMode, schools, hostSchoolId]
  );

  const selectedVenue = useMemo(() => venues.find(v => v.id === venueId), [venues, venueId]);

  const effectiveVenueKey = useMemo(() => {
    if (venueMode === 'school') return hostSchoolId || '';
    const matchedVenue = venues.find(v => v.name.trim() === customVenueName.trim() || v.id === venueId);
    return matchedVenue?.id || customVenueName.trim() || venueId;
  }, [venueMode, hostSchoolId, venues, customVenueName, venueId]);

  const effectiveVenueDisplayName = useMemo(() => {
    if (venueMode === 'school') {
      return selectedHostSchool?.name || 'المؤسسة المحتضنة';
    }
    return customVenueName.trim() || selectedVenue?.name || 'الفضاء الرياضي';
  }, [venueMode, selectedHostSchool, customVenueName, selectedVenue]);

  const filteredHostSchools = useMemo(() => {
    const q = hostSchoolSearch.trim().toLowerCase();
    if (!q) return schools;
    return schools.filter(
      s =>
        s.name.toLowerCase().includes(q) ||
        (s.commune || '').toLowerCase().includes(q) ||
        (s.principalName || '').toLowerCase().includes(q)
    );
  }, [schools, hostSchoolSearch]);

  const parseTimeToMinutes = (timeStr: string): number => {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  };

  const conflictingMatches = useMemo(() => {
    if (!effectiveVenueKey || !date) return [];
    return matches.filter(m => {
      const sameVenue =
        (venueMode === 'school' && (m.hostSchoolId === hostSchoolId || m.venueId === hostSchoolId || m.venueName === selectedHostSchool?.name)) ||
        (venueMode === 'custom' && (m.venueId === effectiveVenueKey || (customVenueName.trim() && m.venueName === customVenueName.trim())));
      if (!sameVenue) return false;
      if (m.status === 'Cancelled' || m.status === 'Postponed') return false;
      if (editingMatch && m.id === editingMatch.id) return false;

      // Check date equality (YYYY-MM-DD)
      const matchDateStr = normalizeDateToYmd(m.date);
      if (matchDateStr !== date) return false;

      // Same day, check if time difference is less than 60 minutes
      if (m.startTime && startTime) {
        const t1 = parseTimeToMinutes(m.startTime);
        const t2 = parseTimeToMinutes(startTime);
        return Math.abs(t1 - t2) < 60;
      }
      return true; // fallback if no times defined
    });
  }, [matches, effectiveVenueKey, venueMode, hostSchoolId, selectedHostSchool, customVenueName, date, startTime, editingMatch]);

  const hasConflict = conflictingMatches.length > 0;
  const [forceScheduleDespiteConflict, setForceScheduleDespiteConflict] = useState(false);

  useEffect(() => {
    setForceScheduleDespiteConflict(false);
  }, [effectiveVenueKey, date, startTime, isOpen]);

  // Filter schools to only show those registered in the selected tournament with students
  const eligibleSchools = useMemo(() => {
    const currentActiveSport = managerSportId || sportId || 'football';
    const normTournCat = normalizeCategoryKey(ageCategory || 'U12');
    const targetGender = gender || 'Male';
    const selectedTourn = availableTournaments.find(t => t.id === tournamentId);
    const targetAffiliation = selectedTourn?.affiliationType || affiliationType || initialAffiliation || 'non_club';

    // Map of matching registered students grouped by school
    const schoolStats = new Map<string, { count: number; schoolName: string; hasCoach: boolean; schoolObj?: School }>();

    students.forEach(s => {
      if (!s) return;
      // Sport check
      if (s.sportId && s.sportId !== currentActiveSport) return;
      // Category check
      if (normalizeCategoryKey(s.category) !== normTournCat) return;
      // Gender check
      if (targetGender !== 'Mixed' && s.gender && s.gender !== targetGender) return;
      // Affiliation check (default to non_club if empty)
      const sAffiliation = s.affiliationType || 'non_club';
      if (targetAffiliation !== 'open' && sAffiliation !== targetAffiliation) return;

      const schoolKey = (s.schoolId || s.schoolName || '').trim();
      if (!schoolKey) return;

      const existing = schoolStats.get(schoolKey) || {
        count: 0,
        schoolName: s.schoolName || '',
        hasCoach: false
      };
      existing.count += 1;
      if (s.coachName && s.coachName.trim() !== '') {
        existing.hasCoach = true;
      }
      if (s.schoolName) existing.schoolName = s.schoolName;
      schoolStats.set(schoolKey, existing);
    });

    const result: (School & { studentCount: number; hasCoach: boolean })[] = [];
    const matchedKeys = new Set<string>();

    // Match with existing schools list
    schools.forEach(sch => {
      const byId = schoolStats.get(sch.id);
      const byName = sch.name ? schoolStats.get(sch.name.trim()) : undefined;
      const stat = byId || byName;
      if (stat && stat.count > 0) {
        result.push({
          ...sch,
          studentCount: stat.count,
          hasCoach: stat.hasCoach
        });
        matchedKeys.add(sch.id);
        if (sch.name) matchedKeys.add(sch.name.trim());
      }
    });

    // Also match any school present in students but not in schools array
    schoolStats.forEach((stat, key) => {
      if (!matchedKeys.has(key) && stat.count > 0) {
        result.push({
          id: key.startsWith('sch-') ? key : `sch-registered-${key}`,
          name: stat.schoolName || key,
          commune: 'المؤسسة المسجلة',
          type: 'مؤسسة تعليمية',
          teacherName: 'مؤطر المؤسسة',
          studentCount: stat.count,
          hasCoach: stat.hasCoach
        });
        matchedKeys.add(key);
      }
    });

    return result;
  }, [schools, students, tournamentId, availableTournaments, sportId, managerSportId, ageCategory, gender, affiliationType, initialAffiliation]);

  // Schools to show in team dropdowns when showAllSchools is false
  const availableSchoolsForTeam1 = useMemo(() => {
    if (!showAllSchools && eligibleSchools.length > 0) {
      const list: (School & { studentCount?: number; hasCoach?: boolean })[] = [...eligibleSchools];
      if (team1Id && !list.some(s => s.id === team1Id)) {
        const selectedSch = schools.find(s => s.id === team1Id);
        if (selectedSch) {
          list.push({
            ...selectedSch,
            studentCount: 0,
            hasCoach: false
          });
        }
      }
      return list;
    }
    return schools;
  }, [showAllSchools, eligibleSchools, schools, team1Id]);

  const availableSchoolsForTeam2 = useMemo(() => {
    if (!showAllSchools && eligibleSchools.length > 0) {
      const list: (School & { studentCount?: number; hasCoach?: boolean })[] = [...eligibleSchools];
      if (team2Id && !list.some(s => s.id === team2Id)) {
        const selectedSch = schools.find(s => s.id === team2Id);
        if (selectedSch) {
          list.push({
            ...selectedSch,
            studentCount: 0,
            hasCoach: false
          });
        }
      }
      return list;
    }
    return schools;
  }, [showAllSchools, eligibleSchools, schools, team2Id]);

  // Update selection if eligible schools change
  useEffect(() => {
    if (!editingMatch && eligibleSchools.length > 0) {
      if (!eligibleSchools.some(s => s.id === team1Id)) {
        setTeam1Id(eligibleSchools[0]?.id || schools[0]?.id || '');
      }
      if (eligibleSchools.length > 1) {
        if (!eligibleSchools.some(s => s.id === team2Id) || team2Id === eligibleSchools[0]?.id) {
          setTeam2Id(eligibleSchools[1]?.id || '');
        }
      } else if (eligibleSchools.length === 1 && schools.length > 1) {
        const otherSchool = schools.find(s => s.id !== eligibleSchools[0]?.id);
        if (otherSchool) setTeam2Id(otherSchool.id);
      }
    }
  }, [eligibleSchools, editingMatch]);

  if (!isOpen) return null;

  const handleNextDay = () => {
    try {
      const current = new Date(date);
      current.setDate(current.getDate() + 1);
      const nextDateStr = current.toISOString().split('T')[0];
      setDate(nextDateStr);
      toast.success(`تم تغيير التاريخ إلى ${nextDateStr}`);
    } catch {
      // fallback
    }
  };

  const getSchoolName = (id?: string) => {
    return schools.find(s => s.id === id)?.name || 'مؤسسة تعليمية';
  };

  const handleAddRefereeQuick = (refName: string) => {
    // Check if already in the list
    if (referees.includes(refName)) {
      toast('هذا الحكم مضاف بالفعل إلى الطاقم', { icon: 'ℹ️' });
      return;
    }
    // If first element is empty string, replace it, otherwise append
    if (referees.length === 1 && referees[0] === '') {
      setReferees([refName]);
    } else {
      setReferees([...referees, refName]);
    }
    toast.success(`تمت إضافة الحكم: ${refName}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (team1Id === team2Id) {
      toast.error('يرجى اختيار مؤسستين مختلفتين للتباري');
      return;
    }

    if (venueMode === 'school' && !hostSchoolId) {
      toast.error('يرجى اختيار المؤسسة المحتضنة للمقابلة من القائمة');
      return;
    }
    if (venueMode === 'custom' && !customVenueName.trim()) {
      toast.error('يرجى كتابة اسم الفضاء الرياضي (مثال: القاعة المغطاة)');
      return;
    }

    // Sport Manager / Tech Head validation
    const resolvedCheckSportId = singleLockedSportId || sportId;
    if (effectiveAllowedSportIds && !effectiveAllowedSportIds.includes(resolvedCheckSportId)) {
      const allowedNames = effectiveAllowedSportIds.map(id => SPORTS_MAP[id]?.name || id).join('، ');
      toast.error(`أنت مخول لبرمجة وتعديل مباريات (${allowedNames}) فقط.`);
      return;
    }

    if (hasConflict && !forceScheduleDespiteConflict) {
      setForceScheduleDespiteConflict(true);
      toast('مركز التباري محجوز في هذا التوقيت — اضغط على الزر مرة أخرى لتأكيد البرمجة رغم التعارض', { icon: '⚠️' });
      return;
    }

    setIsSubmitting(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
      const resolvedSportId = singleLockedSportId || sportId || availableTournaments.find(t => t.id === tournamentId)?.sportId || 'football';
      const hostSch = venueMode === 'school' ? schools.find(s => s.id === hostSchoolId) : undefined;
      const matchedCustomVen = venueMode === 'custom'
        ? venues.find(v => v.name.trim() === customVenueName.trim() || v.id === venueId)
        : undefined;

      const resolvedVenueId = venueMode === 'school'
        ? (hostSch?.id || hostSchoolId)
        : (matchedCustomVen?.id || 'custom');
      const resolvedVenueName = venueMode === 'school'
        ? (hostSch?.name || getSchoolName(hostSchoolId))
        : (customVenueName.trim() || matchedCustomVen?.name || '');
      const resolvedHostSchoolId = venueMode === 'school' ? (hostSch?.id || hostSchoolId) : '';
      
      const selectedTourn = availableTournaments.find(t => t.id === tournamentId);
      const cleanReferees = referees.map(r => r.trim()).filter(r => r !== '');
      const normalizedDate = normalizeDateToYmd(date) || date;

      await onSave({
        tournamentId,
        sportId: resolvedSportId,
        directorateId: editingMatch?.directorateId || activeDirId,
        stage,
        team1Id,
        team2Id,
        ageCategory,
        gender,
        affiliationType: selectedTourn?.affiliationType || affiliationType || editingMatch?.affiliationType || 'non_club',
        date: normalizedDate,
        startTime,
        venueId: resolvedVenueId,
        venueName: resolvedVenueName,
        hostSchoolId: resolvedHostSchoolId,
        referees: cleanReferees,
        referee1Id: cleanReferees[0] || undefined,
        referee2Id: cleanReferees[1] || undefined,
        status,
        notes: notes.trim(),
        score1: editingMatch?.score1 ?? 0,
        score2: editingMatch?.score2 ?? 0,
        updatedAt: new Date()
      }, editingMatch?.id);

      setSavedMatchSummary({
        matchId: editingMatch?.id,
        sportId: resolvedSportId,
        sportName: SPORTS_MAP[resolvedSportId]?.name || resolvedSportId,
        ageCategory,
        gender: GENDER_MAP[gender]?.name || gender,
        stageName: stage,
        team1Id,
        team2Id,
        team1Name: getSchoolName(team1Id),
        team2Name: getSchoolName(team2Id),
        hostSchoolId: resolvedHostSchoolId || undefined,
        venueId: resolvedVenueId,
        venueName: resolvedVenueName,
        dateStr: normalizedDate,
        timeStr: startTime || '10:00',
        referees: cleanReferees,
        notes: notes.trim() || undefined
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sportInfo = SPORTS_MAP[currentSport] || { name: 'الرياضة', icon: '🏆' };

  const modalContent = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
      <div className="relative bg-white rounded-2xl border border-slate-200 shadow-xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-5 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                {editingMatch ? 'تعديل برمجة المقابلة' : 'برمجة مباراة ونشاط رياضي جديد'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">تحديد الفئة العمرية، المؤسسات المتبارية، وتعيين الحكام مباشرة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Manager / Tech Committee Head Specialty Notice */}
          {effectiveAllowedSportIds && (
            <div className="p-3.5 bg-linear-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg font-bold shadow-xs shrink-0">
                {sportInfo.icon}
              </div>
              <div className="flex-1 text-xs">
                <div className="flex items-center gap-1.5 font-bold text-emerald-950">
                  <ShieldCheck className="h-4 w-4 text-emerald-700" />
                  <span>
                    تخصصك المعتمد:{' '}
                    {effectiveAllowedSportIds.map(id => `${SPORTS_MAP[id]?.name || id} ${SPORTS_MAP[id]?.icon || ''}`).join(' • ')}
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  بصفتك رئيس اللجنة التقنية / مسؤولاً عن هذا النشاط، يمكنك برمجة وتعديل مقابلات تخصصك وإشعار الحكام عبر الواتساب.
                </p>
              </div>
            </div>
          )}

          {/* Tournament Selection */}
          {availableTournaments.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                البطولة المنظمة <span className="text-red-500">*</span>
              </label>
              <select
                value={tournamentId}
                onChange={(e) => {
                  setTournamentId(e.target.value);
                  const selectedTourn = availableTournaments.find(t => t.id === e.target.value);
                  if (selectedTourn) {
                    if (selectedTourn.sportId && !managerSportId) {
                      setSportId(selectedTourn.sportId);
                    }
                    if (selectedTourn.ageCategory) {
                      setAgeCategory(selectedTourn.ageCategory);
                    }
                    if (selectedTourn.gender) {
                      setGender(selectedTourn.gender);
                    }
                  }
                }}
                className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
              >
                {availableTournaments.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.managerName ? `(المسؤول: ${t.managerName})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Age Category & Gender */}
          <div className="p-3.5 bg-emerald-50/40 rounded-2xl border border-emerald-100 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-950">
              <Tag className="h-3.5 w-3.5 text-emerald-700" />
              <span>الفئة العمرية والجنس للمشاركين:</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  الفئة العمرية <span className="text-red-500">*</span>
                </label>
                <select
                  value={ageCategory}
                  onChange={(e) => setAgeCategory(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold cursor-pointer"
                >
                  {getAgeCategoriesForSeason(currentSeason).map(cat => (
                    <option key={cat.id} value={cat.shortName}>
                      {cat.name}
                    </option>
                  ))}
                  <option value="U17 (15-17 سنة)">U17 (15-17 سنة)</option>
                  <option value="U15 (13-15 سنة)">U15 (13-15 سنة)</option>
                  <option value="U13 (11-13 سنة)">U13 (11-13 سنة)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  الجنس (الفئة) <span className="text-red-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold cursor-pointer"
                >
                  <option value="Male">👦 ذكور (فئة الذكور)</option>
                  <option value="Female">👧 إناث (فئة الإناث)</option>
                  <option value="Mixed">👥 مختلط (فئة مشتركة)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Teams */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-blue-600" />
                <span>المؤسسات التعليمية المتبارية:</span>
              </span>
              {eligibleSchools.length > 0 ? (
                <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                  ✓ {eligibleSchools.length} مؤسسة مسجلة في هذه الفئة
                </span>
              ) : (
                <span className="text-[10px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded border border-amber-200 shrink-0">
                  لا توجد لوائح مسجلة مسبقاً
                </span>
              )}
            </div>

            {/* Checkbox Toggle to Show All Schools */}
            <div className="flex items-center justify-between bg-white p-2.5 rounded-lg border border-slate-200 text-xs text-slate-700">
              <label className="flex items-center gap-2 cursor-pointer select-none font-bold">
                <input
                  type="checkbox"
                  checked={showAllSchools}
                  onChange={(e) => setShowAllSchools(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                />
                <span>إظهار جميع المؤسسات التعليمية (المسجلة وغير المسجلة)</span>
              </label>
              {!showAllSchools && eligibleSchools.length > 0 && (
                <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-100 hidden sm:inline-block">
                  عرض المسجلة فقط ({eligibleSchools.length})
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  المؤسسة 1 (المستضيف) <span className="text-red-500">*</span>
                </label>
                <select
                  value={team1Id}
                  onChange={(e) => setTeam1Id(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  {!showAllSchools && eligibleSchools.length > 0 ? (
                    availableSchoolsForTeam1.map(s => (
                      <option key={`elig-1-${s.id}`} value={s.id}>
                        {s.name} {'studentCount' in s && s.studentCount && s.studentCount > 0 ? `(${s.studentCount} مشارك مسجل)` : `(${s.commune})`}
                      </option>
                    ))
                  ) : (
                    <>
                      {eligibleSchools.length > 0 && (
                        <optgroup label="✨ المؤسسات المسجلة في هذه الفئة (مؤهلة للتباري)">
                          {eligibleSchools.map(s => (
                            <option key={`elig-group-1-${s.id}`} value={s.id}>
                              {s.name} ({s.studentCount} مشارك مسجل)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label={eligibleSchools.length > 0 ? "🏛️ باقي المؤسسات التعليمية" : "🏛️ جميع المؤسسات التعليمية"}>
                        {schools.filter(s => !eligibleSchools.some(es => es.id === s.id)).map(s => (
                          <option key={`all-1-${s.id}`} value={s.id}>
                            {s.name} ({s.commune})
                          </option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  المؤسسة 2 (الضيف) <span className="text-red-500">*</span>
                </label>
                <select
                  value={team2Id}
                  onChange={(e) => setTeam2Id(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold"
                >
                  {!showAllSchools && eligibleSchools.length > 0 ? (
                    availableSchoolsForTeam2.map(s => (
                      <option key={`elig-2-${s.id}`} value={s.id}>
                        {s.name} {'studentCount' in s && s.studentCount && s.studentCount > 0 ? `(${s.studentCount} مشارك مسجل)` : `(${s.commune})`}
                      </option>
                    ))
                  ) : (
                    <>
                      {eligibleSchools.length > 0 && (
                        <optgroup label="✨ المؤسسات المسجلة في هذه الفئة (مؤهلة للتباري)">
                          {eligibleSchools.map(s => (
                            <option key={`elig-group-2-${s.id}`} value={s.id}>
                              {s.name} ({s.studentCount} مشارك مسجل)
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label={eligibleSchools.length > 0 ? "🏛️ باقي المؤسسات التعليمية" : "🏛️ جميع المؤسسات التعليمية"}>
                        {schools.filter(s => !eligibleSchools.some(es => es.id === s.id)).map(s => (
                          <option key={`all-2-${s.id}`} value={s.id}>
                            {s.name} ({s.commune})
                          </option>
                        ))}
                      </optgroup>
                    </>
                  )}
                </select>
              </div>
            </div>

            {eligibleSchools.length >= 2 && !showAllSchools ? (
              <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-lg flex items-center justify-between gap-2 text-[11px] text-emerald-900 font-bold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    تم إظهار المؤسسات المسجلة بمشاركين في فئة {ageCategory} ({gender === 'Male' ? 'ذكور' : 'إناث'}) فقط تلقائياً.
                  </span>
                </div>
              </div>
            ) : eligibleSchools.length === 1 && !showAllSchools ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-2 text-[11px] text-amber-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>توجد مؤسسة واحدة مسجلة في هذه الفئة (<strong>{eligibleSchools[0].name}</strong>). قم بالتأشير على الخيار أعلاه لاختيار المؤسسة المنافسة.</span>
                </div>
              </div>
            ) : eligibleSchools.length === 0 ? (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-[11px] text-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>لم يتم تسجيل مشاركين مسبقاً في هذه الفئة المحددة. قم بالتأشير على "إظهار جميع المؤسسات التعليمية" لبرمجة المباراة مسبقاً.</span>
              </div>
            ) : null}
          </div>

          {/* Sport & Stage */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">الرياضة</label>
                {singleLockedSportId && (
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded flex items-center gap-1 font-medium">
                    <Lock className="h-3 w-3 text-slate-400" />
                    محدد حسب تخصصك
                  </span>
                )}
              </div>

              {singleLockedSportId ? (
                <div className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 font-bold flex items-center justify-between">
                  <span>{sportInfo.icon} {sportInfo.name}</span>
                  <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded">معتمد</span>
                </div>
              ) : (
                <select
                  value={sportId}
                  onChange={(e) => setSportId(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {Object.entries(SPORTS_MAP)
                    .filter(([id]) => !effectiveAllowedSportIds || effectiveAllowedSportIds.includes(id))
                    .map(([id, info]) => (
                      <option key={id} value={id}>
                        {info.icon} {info.name}
                      </option>
                    ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الدور / المرحلة</label>
              <input
                type="text"
                value={stage}
                onChange={(e) => setStage(e.target.value)}
                placeholder="مثال: ربع النهائي أو دور المجموعات"
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Venue Selection: School from App OR Another Custom Space */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>مكان إجراء المقابلة (مؤسسة محتضنة أو فضاء رياضي آخر) *</span>
              </label>
            </div>

            {/* Segmented Mode Toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setVenueMode('school');
                  if (!hostSchoolId && (team1Id || schools[0]?.id)) {
                    setHostSchoolId(team1Id || schools[0]?.id || '');
                  }
                }}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  venueMode === 'school'
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Building className="h-3.5 w-3.5 shrink-0" />
                <span>مؤسسة تعليمية محتضنة</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVenueMode('custom');
                  if (!customVenueName.trim() && venues[0]?.name) {
                    setCustomVenueName(venues[0].name);
                  }
                }}
                className={`py-2 px-2.5 rounded-lg text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  venueMode === 'custom'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>فضاء رياضي آخر (كتابة)</span>
              </button>
            </div>

            {venueMode === 'school' ? (
              <div className="space-y-2.5">
                {/* Quick Chips for Competing Team 1 & Team 2 */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-500">اختيار سريع:</span>
                  {team1Id && schools.some(s => s.id === team1Id) && (
                    <button
                      type="button"
                      onClick={() => setHostSchoolId(team1Id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        hostSchoolId === team1Id
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      🏫 بمؤسسة الطرف 1 ({getSchoolName(team1Id)})
                    </button>
                  )}
                  {team2Id && schools.some(s => s.id === team2Id) && (
                    <button
                      type="button"
                      onClick={() => setHostSchoolId(team2Id)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                        hostSchoolId === team2Id
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      🏫 بمؤسسة الطرف 2 ({getSchoolName(team2Id)})
                    </button>
                  )}
                </div>

                {/* Search + School Dropdown */}
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={hostSchoolSearch}
                    onChange={(e) => setHostSchoolSearch(e.target.value)}
                    placeholder="ابحث في المؤسسات الموجودة في التطبيق..."
                    className="w-full pr-8 pl-3 py-1.5 text-[11px] font-bold bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <select
                  value={hostSchoolId}
                  onChange={(e) => setHostSchoolId(e.target.value)}
                  className={`w-full text-xs font-bold rounded-xl border px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 ${
                    hasConflict ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-300' : 'border-slate-200 focus:ring-emerald-500'
                  }`}
                >
                  <option value="">-- اختر المؤسسة المحتضنة من مؤسسات التطبيق --</option>
                  {filteredHostSchools.map(sch => (
                    <option key={`host-sch-${sch.id}`} value={sch.id}>
                      🏫 {sch.name} {sch.commune ? `(${sch.commune})` : ''}
                    </option>
                  ))}
                </select>

                {selectedHostSchool && (
                  <div className="p-2.5 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between gap-2 text-[11px] text-emerald-950">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span className="font-bold truncate">
                        المركز المعتمد: {selectedHostSchool.name} — سيتم إتاحة إشعار مدير المؤسسة المحتضنة عبر الواتساب بعد الحفظ.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={customVenueName}
                  onChange={(e) => setCustomVenueName(e.target.value)}
                  placeholder="اكتب اسم الفضاء الرياضي (مثال: القاعة المغطاة، الملعب البلدي، حلبة ألعاب القوى...)"
                  className={`w-full text-xs font-bold rounded-xl border px-3 py-2.5 text-slate-800 bg-white focus:outline-none focus:ring-2 ${
                    hasConflict ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-300' : 'border-slate-200 focus:ring-slate-900'
                  }`}
                />
                {venues.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-500">فضاءات مقترحة:</span>
                    {venues.map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVenueId(v.id);
                          setCustomVenueName(v.name);
                        }}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-colors cursor-pointer ${
                          customVenueName.trim() === v.name.trim()
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        🏟️ {v.name}
                      </button>
                    ))}
                    {!venues.some(v => v.name.includes('القاعة المغطاة')) && (
                      <button
                        type="button"
                        onClick={() => setCustomVenueName('القاعة المغطاة')}
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold border bg-white text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer"
                      >
                        🏟️ القاعة المغطاة
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">تاريخ المقابلة *</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full text-xs rounded-lg border px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 ${
                  hasConflict ? 'border-amber-400 bg-amber-50/30 ring-2 ring-amber-300' : 'border-slate-200 focus:ring-blue-500'
                }`}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">توقيت الانطلاق</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Referees Assignment Section */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                <label className="block text-xs font-bold text-slate-800">
                  طاقم التحكيم (اختيار مباشر من قائمة حكام التخصص)
                </label>
              </div>
              <button
                type="button"
                onClick={() => setReferees([...referees, ''])}
                className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 bg-white hover:bg-blue-50 border border-slate-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
              >
                <Plus className="h-3 w-3" />
                <span>إضافة حكم</span>
              </button>
            </div>

            {/* Specialized Referees Quick Tags */}
            {specializedReferees.length > 0 && (
              <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-blue-100">
                <p className="text-[10px] font-bold text-blue-800 flex items-center gap-1">
                  <span>🎯 حكام مسجلون متخصصون في ({sportInfo.name} {sportInfo.icon}):</span>
                  <span className="bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-extrabold">{specializedReferees.length}</span>
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {specializedReferees.map((ref, rIdx) => {
                    const isAlreadyAssigned = referees.includes(ref.fullName);
                    return (
                      <button
                        key={`quick-ref-${ref.id}-${rIdx}`}
                        type="button"
                        onClick={() => handleAddRefereeQuick(ref.fullName)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                          isAlreadyAssigned
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-300 ring-1 ring-emerald-200'
                            : 'bg-blue-50/70 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300'
                        }`}
                      >
                        <span>{isAlreadyAssigned ? '✓' : '+'}</span>
                        <span>{ref.fullName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Referee Slots Inputs with Dropdown, Manual Input & Direct WhatsApp Notification */}
            <div className="space-y-2">
              {referees.map((ref, idx) => {
                const contact = ref.trim()
                  ? findRefereeContact(ref.trim(), allReferees, teachers)
                  : null;
                const refWhatsappMsg = contact
                  ? generateRefereeMatchNotificationMessage({
                      refereeName: contact.name || ref.trim(),
                      sportName: sportInfo.name,
                      ageCategory,
                      gender: GENDER_MAP[gender]?.name || gender,
                      stageName: stage,
                      team1SchoolName: getSchoolName(team1Id),
                      team2SchoolName: getSchoolName(team2Id),
                      dateStr: date,
                      timeStr: startTime || '10:00',
                      venueName: effectiveVenueDisplayName
                    })
                  : '';

                return (
                <div key={`ref-slot-${idx}`} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Dropdown selector */}
                    <select
                      value={allReferees.some(r => r.fullName === ref) ? ref : ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newRefs = [...referees];
                        newRefs[idx] = val;
                        setReferees(newRefs);
                      }}
                      className="w-full text-xs rounded-lg border border-slate-200 px-2.5 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    >
                      <option value="">-- اختيار من لائحة الحكام --</option>
                      {specializedReferees.length > 0 && (
                        <optgroup label={`حكام تخصص ${sportInfo.name} (${specializedReferees.length})`}>
                          {specializedReferees.map((r, sIdx) => (
                            <option key={`opt-spec-${r.id}-${sIdx}`} value={r.fullName}>
                              ⭐ {r.fullName} ({r.phone})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherReferees.length > 0 && (
                        <optgroup label="باقي الحكام والأساتذة المسجلين">
                          {otherReferees.map((r, oIdx) => (
                            <option key={`opt-oth-${r.id}-${oIdx}`} value={r.fullName}>
                              👤 {r.fullName}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>

                    {/* Text input / Custom Name */}
                    <input
                      type="text"
                      value={ref}
                      onChange={(e) => {
                        const newRefs = [...referees];
                        newRefs[idx] = e.target.value;
                        setReferees(newRefs);
                      }}
                      placeholder={`أو اكتب اسم الحكم ${idx + 1} يدوياً`}
                      className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                  </div>

                  {contact && (
                    <a
                      href={getWhatsAppUrl(contact.phone, refWhatsappMsg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={contact.phone ? `إرسال إشعار واتساب للحكم ${contact.name} (${contact.phone})` : `إرسال إشعار واتساب للحكم ${contact.name} (تحديد الرقم في واتساب)`}
                      className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 shrink-0 transition-colors shadow-2xs"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">واتساب</span>
                    </a>
                  )}

                  {referees.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const newRefs = referees.filter((_, i) => i !== idx);
                        setReferees(newRefs);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer shrink-0"
                      title="حذف هذا الحكم"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          </div>

          {/* Optional Match Notes Field */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              ملاحظات حول المباراة <span className="text-[10px] font-medium text-slate-400">(اختياري — تظهر في البرنامج عند كتابتها)</span>
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="اكتب ملاحظة تنظيمية أو تحكيمية اختيارية..."
              className="w-full text-xs rounded-xl border border-slate-200 px-3 py-2 text-slate-800 bg-slate-50/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* CRITICAL OCCUPANCY CONFLICT WARNING ALERT */}
          {hasConflict && (
            <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-amber-50/80 p-3.5 space-y-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-2.5">
                <div className="p-1 bg-red-100 text-red-600 rounded-lg shrink-0 mt-0.5">
                  <AlertTriangle className="h-5 w-5 animate-bounce" />
                </div>
                <div className="flex-1">
                  <h4 className="text-xs font-bold text-red-900 flex items-center gap-1">
                    <span>تنبيه: مركز التباري غير شاغر في هذا التاريخ!</span>
                  </h4>
                  <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">
                    تم برمجة نشاط/مقابلة أخرى بـ <strong className="font-bold underline">{effectiveVenueDisplayName}</strong> في تاريخ <span className="font-mono font-bold" dir="ltr">{date}</span>.
                  </p>
                </div>
              </div>

              {/* Conflicting matches list */}
              <div className="bg-white/80 border border-red-100 rounded-lg p-2.5 space-y-1.5 text-xs">
                <p className="text-[10px] font-bold text-slate-600">المباريات المبرمجة مسبقاً بنفس المركز:</p>
                {conflictingMatches.map(cm => (
                  <div key={cm.id} className="flex items-center justify-between text-[11px] text-slate-700 bg-red-50/50 px-2 py-1 rounded border border-red-100/60">
                    <span className="font-bold">
                      {getSchoolName(cm.team1Id)} ضد {getSchoolName(cm.team2Id)}
                    </span>
                    <span className="text-[10px] text-red-600 font-bold bg-white px-1.5 py-0.5 rounded border border-red-200">
                      ⏰ {cm.startTime || '10:00'} ({cm.stage || 'مباراة'})
                    </span>
                  </div>
                ))}
              </div>

              {/* Quick helper button to change date */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-amber-800 font-medium">المرجو تغيير التاريخ لتفادي تضارب المواعيد:</span>
                <button
                  type="button"
                  onClick={handleNextDay}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer shadow-xs"
                >
                  <Calendar className="h-3 w-3" />
                  <span>تأجيل لليوم الموالي (+1)</span>
                </button>
              </div>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
            {editingMatch ? (
              <button
                type="button"
                onClick={() => {
                  const cleanRefs = referees.map(r => r.trim()).filter(Boolean);
                  setSavedMatchSummary({
                    sportName: sportInfo.name,
                    ageCategory,
                    genderLabel: GENDER_MAP[gender]?.name || gender,
                    stageName: stage,
                    team1Id,
                    team2Id,
                    team1Name: getSchoolName(team1Id),
                    team2Name: getSchoolName(team2Id),
                    hostSchoolId: venueMode === 'school' ? hostSchoolId : undefined,
                    venueName: effectiveVenueDisplayName,
                    dateStr: normalizeDateToYmd(date) || date,
                    timeStr: startTime || '10:00',
                    referees: cleanRefs
                  });
                }}
                className="px-3 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <MessageCircle className="h-3.5 w-3.5 text-emerald-600" />
                <span>إشعارات الواتساب</span>
              </button>
            ) : <span />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`px-5 py-2.5 text-xs font-bold text-white rounded-xl transition-all shadow-md active:scale-95 disabled:bg-slate-300 cursor-pointer ${
                  hasConflict
                    ? forceScheduleDespiteConflict
                      ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                      : 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                {isSubmitting
                  ? 'جاري الحفظ...'
                  : hasConflict
                  ? forceScheduleDespiteConflict
                    ? 'نعم، تثبيت البرمجة رغم التعارض'
                    : 'برمجة رغم التعارض (تأكيد)'
                  : editingMatch
                  ? 'حفظ التعديلات'
                  : 'تأكيد برمجة المباراة'}
              </button>
            </div>
          </div>
        </form>

        {/* POST-SCHEDULING UNIFIED NOUVELLE DIFFUSION MODAL */}
        <MatchBroadcastDiffusionModal
          isOpen={Boolean(savedMatchSummary)}
          onClose={onClose}
          target={savedMatchSummary}
          schools={schools}
          refereesList={allReferees}
          teachersList={teachers}
          studentsList={students}
        />
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};

