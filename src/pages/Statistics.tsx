import React, { useEffect, useState, useMemo } from 'react';
import { DataService, SPORTS_MAP, deduplicateById, normalizeSchoolCycleType, normalizeArabicMatchText, schoolNamesMatch, isClubTournament, isSchoolSectorAllowedForTournament, isAffiliationAllowedByDisplayConfig, getEffectiveConfirmedBranches, normalizeCategoryKey } from '../lib/dataService';
import { School, Match, Student, Tournament, Sport, Directorate, CrossCountryCategoryResult, SchoolTournamentConfirmation, Referee, User, AffiliationDisplayConfig } from '../types';
import { CROSS_COUNTRY_CATEGORIES, calculateTeamRankings } from '../lib/crossCountryConfig';
import {
  BarChart3,
  Trophy,
  Users,
  Medal,
  School as SchoolIcon,
  TrendingUp,
  Award,
  Filter,
  Search,
  Printer,
  Download,
  Calendar,
  Layers,
  Sparkles,
  ChevronDown,
  ChevronUp,
  PieChart,
  Activity,
  Flame,
  ShieldCheck,
  X,
  Eye,
  LayoutGrid,
  List,
  MapPin,
  Clock
} from 'lucide-react';

export const Statistics: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [activeDirObj, setActiveDirObj] = useState<Directorate | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [crossCountryResults, setCrossCountryResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [confirmations, setConfirmations] = useState<SchoolTournamentConfirmation[]>([]);
  const [refereesList, setRefereesList] = useState<Referee[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [affiliationDisplayConfig, setAffiliationDisplayConfig] = useState<AffiliationDisplayConfig>(() =>
    DataService.getAffiliationDisplayConfigSync()
  );
  const [loading, setLoading] = useState(true);
  const [selectedSchoolAchievements, setSelectedSchoolAchievements] = useState<{ schoolName: string; achievements: any[] } | null>(null);

  // Filters & View Mode
  const [activeTab, setActiveTab] = useState<'results' | 'participation' | 'tournaments_zones' | 'referees' | 'sports' | 'matches'>('results');
  const [activeKpiFocus, setActiveKpiFocus] = useState<'schools' | 'students' | 'matches' | 'sports' | null>(null);
  const [rankingViewMode, setRankingViewMode] = useState<'cards' | 'table'>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'cards' : 'table'
  );
  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL'); // Primary / Middle / High
  const [selectedCommune, setSelectedCommune] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const handleKpiCardClick = (
    focus: 'schools' | 'students' | 'matches' | 'sports',
    targetTab: 'results' | 'participation' | 'tournaments_zones' | 'referees' | 'sports' | 'matches'
  ) => {
    setActiveKpiFocus(focus);
    setActiveTab(targetTab);
    setTimeout(() => {
      const el = document.getElementById('stats-main-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  useEffect(() => {
    loadAllData();
    const handleDirChange = () => {
      loadAllData();
    };
    const handleCCChange = () => {
      loadAllData();
    };

    window.addEventListener('directorateChanged', handleDirChange);
    window.addEventListener('crossCountryResultsUpdated', handleCCChange);
    window.addEventListener('dataSynchronized', handleCCChange);
    window.addEventListener('schoolConfirmationsUpdated', handleCCChange);
    window.addEventListener('schoolWithdrawalsUpdated', handleCCChange);

    const unsubscribeCC = DataService.subscribeCrossCountryResults((liveResults) => {
      if (liveResults) {
        setCrossCountryResults(liveResults);
      }
    });

    const unsubscribeTournaments = DataService.subscribeToTournaments(() => {
      loadAllData();
    });

    const unsubscribeMatches = DataService.subscribeToMatches(() => {
      loadAllData();
    });

    const unsubscribeSchools = DataService.subscribeToSchools(() => {
      loadAllData();
    });

    const unsubscribeStudents = DataService.subscribeToStudents(() => {
      loadAllData();
    });

    const unsubscribeVenues = DataService.subscribeToVenues(() => {
      loadAllData();
    });

    const unsubscribeSportsConfig = DataService.subscribeToSportsConfig(() => {
      loadAllData();
    });

    const unsubscribeAffiliationCfg = DataService.subscribeToAffiliationDisplayConfig((cfg) => {
      setAffiliationDisplayConfig(cfg);
    });

    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
      window.removeEventListener('crossCountryResultsUpdated', handleCCChange);
      window.removeEventListener('dataSynchronized', handleCCChange);
      window.removeEventListener('schoolConfirmationsUpdated', handleCCChange);
      window.removeEventListener('schoolWithdrawalsUpdated', handleCCChange);
      if (unsubscribeCC) unsubscribeCC();
      if (unsubscribeTournaments) unsubscribeTournaments();
      if (unsubscribeMatches) unsubscribeMatches();
      if (unsubscribeSchools) unsubscribeSchools();
      if (unsubscribeStudents) unsubscribeStudents();
      if (unsubscribeVenues) unsubscribeVenues();
      if (unsubscribeSportsConfig) unsubscribeSportsConfig();
      if (unsubscribeAffiliationCfg) unsubscribeAffiliationCfg();
    };
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [sList, mList, stList, tList, cfgList, activeDir, ccRes, confList, refList, uList, affCfg] = await Promise.all([
        DataService.getSchools(),
        DataService.getMatches(),
        DataService.getStudents(),
        DataService.getTournaments(),
        DataService.getSportsConfig(),
        DataService.getActiveDirectorate(),
        DataService.getCrossCountryResults(),
        DataService.getSchoolConfirmations().catch(() => [] as SchoolTournamentConfirmation[]),
        DataService.getReferees().catch(() => [] as Referee[]),
        DataService.getUsers().catch(() => [] as User[]),
        DataService.getAffiliationDisplayConfig().catch(() => DataService.getAffiliationDisplayConfigSync())
      ]);

      const isAllDirs = !activeDirId || activeDirId === 'all';
      const dirSchools = isAllDirs ? sList : sList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      const dirMatches = isAllDirs ? mList : mList.filter(m => (m.directorateId || 'taourirt') === activeDirId || (!m.directorateId && activeDirId === 'taourirt'));
      const dirStudents = isAllDirs ? stList : stList.filter(st => (st.directorateId || 'taourirt') === activeDirId);
      const dirTournaments = isAllDirs ? tList : tList.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      const dirConfirmations = isAllDirs ? confList : confList.filter(c => !c.directorateId || c.directorateId === activeDirId);

      setActiveDirObj(activeDir);
      setSchools(deduplicateById<School>(dirSchools));
      setMatches(dirMatches);
      setStudents(dirStudents);
      setTournaments(deduplicateById<Tournament>(dirTournaments));
      setSportsConfig(cfgList);
      if (ccRes) setCrossCountryResults(ccRes);
      setConfirmations(dirConfirmations);
      setRefereesList(refList || []);
      setUsersList(uList || []);
      if (affCfg) setAffiliationDisplayConfig(affCfg);
    } catch (e) {
      console.error('Error loading stats data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Normalize commune names ("تنكرفا" -> "تنشرفي", "تاوريرت" -> "تاوريرت المركز") & resolve educational zone (Zone 1 vs Zone 2)
  const normalizeCommuneDisplay = (commune?: string): string => {
    const raw = (commune || '').trim();
    if (!raw) return 'تاوريرت المركز';
    const norm = normalizeArabicMatchText(raw);
    if (norm.includes('تنكرف') || norm.includes('تنكرفا') || norm.includes('تنشرف')) {
      return 'تنشرفي';
    }
    if (norm === 'تاوريرت' || norm === 'تاوريرت المركز') {
      return 'تاوريرت المركز';
    }
    if (norm.includes('العيون سيدي ملوك') || norm === 'العيون' || (norm.includes('العيون') && norm.includes('ملوك'))) {
      return 'العيون سيدي ملوك';
    }
    if (norm.includes('عين لحجر') || norm.includes('عين الحجر')) {
      return 'عين لحجر';
    }
    return raw;
  };

  const getEducationalZone = (commune?: string, schoolName?: string): 'zone1' | 'zone2' => {
    const clean = normalizeCommuneDisplay(commune);
    const norm = normalizeArabicMatchText(clean);
    const isElAioun = norm.includes('العيون سيدي ملوك') || norm === 'العيون' || (norm.includes('العيون') && norm.includes('ملوك'));
    const isAinLahjar = norm.includes('عين لحجر') || norm.includes('عين الحجر');
    if (isElAioun || isAinLahjar) return 'zone1';

    // Fallback when school commune is missing/defaulted to Taourirt Center but school name explicitly belongs to Zone 1
    if ((!commune || !commune.trim() || norm === 'تاوريرت المركز') && schoolName) {
      const nameNorm = normalizeArabicMatchText(schoolName);
      if (nameNorm.includes('العيون سيدي ملوك') || nameNorm.includes('عين لحجر') || nameNorm.includes('عين الحجر')) {
        return 'zone1';
      }
    }
    return 'zone2';
  };

  const matchesZoneOrCommuneFilter = (commune?: string, schoolName?: string): boolean => {
    if (selectedCommune === 'ALL') return true;
    if (selectedCommune === 'ZONE_1') return getEducationalZone(commune, schoolName) === 'zone1';
    if (selectedCommune === 'ZONE_2') return getEducationalZone(commune, schoolName) === 'zone2';
    return normalizeCommuneDisplay(commune) === selectedCommune;
  };

  // Distinct communes list
  const communes = useMemo(() => {
    const set = new Set<string>();
    schools.forEach((s) => {
      if (s.commune) set.add(normalizeCommuneDisplay(s.commune));
    });
    return Array.from(set).sort();
  }, [schools]);

  // 1. Calculate Results Table (ترتيب المؤسسات حسب النتائج والتتويجات في الفئات)
  const schoolResultsRanking = useMemo(() => {
    interface SchoolPodiumRank {
      schoolId: string;
      schoolName: string;
      type: string;
      commune: string;
      firstPlaces: number;
      secondPlaces: number;
      thirdPlaces: number;
      totalPodiums: number;
      points: number;
      achievements: Array<{
        title: string;
        sportId: string;
        category?: string;
        rank: 1 | 2 | 3;
        tournamentName?: string;
      }>;
    }

    const resultsMap: Record<string, SchoolPodiumRank> = {};

    // Initialize all schools
    schools.forEach((s) => {
      resultsMap[s.id] = {
        schoolId: s.id,
        schoolName: s.name,
        type: normalizeSchoolCycleType(s),
        commune: normalizeCommuneDisplay(s.commune),
        firstPlaces: 0,
        secondPlaces: 0,
        thirdPlaces: 0,
        totalPodiums: 0,
        points: 0,
        achievements: []
      };
    });

    const getSchoolId = (nameOrId?: string): string => {
      if (!nameOrId) return '';
      const clean = nameOrId.trim().toLowerCase();
      const found = schools.find(
        (s) =>
          s.id === nameOrId ||
          s.name.trim().toLowerCase() === clean ||
          clean.includes(s.name.trim().toLowerCase()) ||
          s.name.trim().toLowerCase().includes(clean)
      );
      if (found) return found.id;
      if (!resultsMap[nameOrId]) {
        resultsMap[nameOrId] = {
          schoolId: nameOrId,
          schoolName: nameOrId,
          type: 'مؤسسة تعليمية',
          commune: 'المديرية الإقليمية',
          firstPlaces: 0,
          secondPlaces: 0,
          thirdPlaces: 0,
          totalPodiums: 0,
          points: 0,
          achievements: []
        };
      }
      return nameOrId;
    };

    // Process tournaments and finished categories
    tournaments.forEach((t) => {
      // Sport filter if active
      if (selectedSport !== 'ALL' && t.sportId !== selectedSport) return;

      const tMatches = matches.filter((m) => m.tournamentId === t.id);
      const sportInfo = SPORTS_MAP[t.sportId] || { name: t.sportId || 'الرياضة', icon: '🏆' };
      const catLabel = `${sportInfo.name} - ${t.ageCategory || ''} (${t.gender === 'Female' ? 'إناث' : 'ذكور'})`.trim();

      // Check if tournament has a completed final match
      const finalMatch = tMatches.find(
        (m) =>
          m.status === 'Completed' &&
          m.stage &&
          (m.stage.includes('نهائي') || m.stage.toLowerCase().includes('final')) &&
          !m.stage.includes('نصف') &&
          !m.stage.includes('ربع') &&
          !m.stage.includes('ثمن')
      );

      // Check if tournament has a completed 3rd place match
      const thirdMatch = tMatches.find(
        (m) =>
          m.status === 'Completed' &&
          m.stage &&
          (m.stage.includes('ترتيب') || m.stage.includes('المركز الثالث') || m.stage.includes('الرتبة الثالثة') || m.stage.toLowerCase().includes('3rd'))
      );

      let foundFirst = false;
      let foundSecond = false;
      let foundThird = false;

      if (finalMatch) {
        const s1 = getSchoolId(finalMatch.team1Id);
        const s2 = getSchoolId(finalMatch.team2Id);
        const score1 = finalMatch.score1 ?? 0;
        const score2 = finalMatch.score2 ?? 0;

        let winnerId = finalMatch.winnerId ? getSchoolId(finalMatch.winnerId) : '';
        let runnerId = '';

        if (!winnerId) {
          if (score1 > score2) {
            winnerId = s1;
            runnerId = s2;
          } else if (score2 > score1) {
            winnerId = s2;
            runnerId = s1;
          }
        } else {
          runnerId = winnerId === s1 ? s2 : s1;
        }

        if (winnerId && resultsMap[winnerId]) {
          resultsMap[winnerId].firstPlaces += 1;
          resultsMap[winnerId].achievements.push({
            title: `بطل ${catLabel}`,
            sportId: t.sportId,
            category: t.ageCategory,
            rank: 1,
            tournamentName: t.name
          });
          foundFirst = true;
        }

        if (runnerId && resultsMap[runnerId]) {
          resultsMap[runnerId].secondPlaces += 1;
          resultsMap[runnerId].achievements.push({
            title: `وصيف ${catLabel}`,
            sportId: t.sportId,
            category: t.ageCategory,
            rank: 2,
            tournamentName: t.name
          });
          foundSecond = true;
        }
      }

      if (thirdMatch) {
        const s1 = getSchoolId(thirdMatch.team1Id);
        const s2 = getSchoolId(thirdMatch.team2Id);
        const score1 = thirdMatch.score1 ?? 0;
        const score2 = thirdMatch.score2 ?? 0;

        let thirdWinnerId = thirdMatch.winnerId ? getSchoolId(thirdMatch.winnerId) : '';
        if (!thirdWinnerId) {
          if (score1 > score2) thirdWinnerId = s1;
          else if (score2 > score1) thirdWinnerId = s2;
        }

        if (thirdWinnerId && resultsMap[thirdWinnerId]) {
          resultsMap[thirdWinnerId].thirdPlaces += 1;
          resultsMap[thirdWinnerId].achievements.push({
            title: `المرتبة الثالثة في ${catLabel}`,
            sportId: t.sportId,
            category: t.ageCategory,
            rank: 3,
            tournamentName: t.name
          });
          foundThird = true;
        }
      }

      // Check tournament explicit winnerId / runnerUpId / standings if not already found from matches
      if (!foundFirst && t.winnerId) {
        const wId = getSchoolId(t.winnerId);
        if (resultsMap[wId]) {
          resultsMap[wId].firstPlaces += 1;
          resultsMap[wId].achievements.push({
            title: `بطل ${catLabel}`,
            sportId: t.sportId,
            category: t.ageCategory,
            rank: 1,
            tournamentName: t.name
          });
          foundFirst = true;
        }
      }

      if (!foundSecond && t.runnerUpId) {
        const rId = getSchoolId(t.runnerUpId);
        if (resultsMap[rId]) {
          resultsMap[rId].secondPlaces += 1;
          resultsMap[rId].achievements.push({
            title: `وصيف ${catLabel}`,
            sportId: t.sportId,
            category: t.ageCategory,
            rank: 2,
            tournamentName: t.name
          });
          foundSecond = true;
        }
      }

      // Check tournament standings array
      if (t.standings && Array.isArray(t.standings) && t.standings.length > 0) {
        if (!foundFirst && t.standings[0]?.schoolId) {
          const id1 = getSchoolId(t.standings[0].schoolId);
          if (resultsMap[id1]) {
            resultsMap[id1].firstPlaces += 1;
            resultsMap[id1].achievements.push({
              title: `بطل ${catLabel}`,
              sportId: t.sportId,
              category: t.ageCategory,
              rank: 1,
              tournamentName: t.name
            });
            foundFirst = true;
          }
        }
        if (!foundSecond && t.standings[1]?.schoolId) {
          const id2 = getSchoolId(t.standings[1].schoolId);
          if (resultsMap[id2]) {
            resultsMap[id2].secondPlaces += 1;
            resultsMap[id2].achievements.push({
              title: `وصيف ${catLabel}`,
              sportId: t.sportId,
              category: t.ageCategory,
              rank: 2,
              tournamentName: t.name
            });
            foundSecond = true;
          }
        }
        if (!foundThird && t.standings[2]?.schoolId) {
          const id3 = getSchoolId(t.standings[2].schoolId);
          if (resultsMap[id3]) {
            resultsMap[id3].thirdPlaces += 1;
            resultsMap[id3].achievements.push({
              title: `المرتبة الثالثة في ${catLabel}`,
              sportId: t.sportId,
              category: t.ageCategory,
              rank: 3,
              tournamentName: t.name
            });
            foundThird = true;
          }
        }
      } else if (!finalMatch && tMatches.length >= 2 && tMatches.every((m) => m.status === 'Completed')) {
        // Fallback for mini-leagues without playoffs
        const leagueMap: Record<string, { pts: number; diff: number; scored: number }> = {};
        tMatches.forEach((m) => {
          const idA = getSchoolId(m.team1Id);
          const idB = getSchoolId(m.team2Id);
          if (!leagueMap[idA]) leagueMap[idA] = { pts: 0, diff: 0, scored: 0 };
          if (!leagueMap[idB]) leagueMap[idB] = { pts: 0, diff: 0, scored: 0 };
          const sA = m.score1 ?? 0;
          const sB = m.score2 ?? 0;
          leagueMap[idA].scored += sA;
          leagueMap[idA].diff += sA - sB;
          leagueMap[idB].scored += sB;
          leagueMap[idB].diff += sB - sA;
          if (sA > sB) leagueMap[idA].pts += 3;
          else if (sB > sA) leagueMap[idB].pts += 3;
          else {
            leagueMap[idA].pts += 1;
            leagueMap[idB].pts += 1;
          }
        });

        const sortedTeams = Object.keys(leagueMap).sort((a, b) => {
          if (leagueMap[b].pts !== leagueMap[a].pts) return leagueMap[b].pts - leagueMap[a].pts;
          if (leagueMap[b].diff !== leagueMap[a].diff) return leagueMap[b].diff - leagueMap[a].diff;
          return leagueMap[b].scored - leagueMap[a].scored;
        });

        if (!foundFirst && sortedTeams[0] && resultsMap[sortedTeams[0]]) {
          resultsMap[sortedTeams[0]].firstPlaces += 1;
          resultsMap[sortedTeams[0]].achievements.push({
            title: `بطل ${catLabel}`,
            sportId: t.sportId,
            category: t.ageCategory,
            rank: 1,
            tournamentName: t.name
          });
        }
        if (!foundSecond && sortedTeams[1] && resultsMap[sortedTeams[1]]) {
          resultsMap[sortedTeams[1]].secondPlaces += 1;
          resultsMap[sortedTeams[1]].achievements.push({
            title: `وصيف ${catLabel}`,
            sportId: t.sportId,
            category: t.ageCategory,
            rank: 2,
            tournamentName: t.name
          });
        }
        if (!foundThird && sortedTeams[2] && resultsMap[sortedTeams[2]]) {
          resultsMap[sortedTeams[2]].thirdPlaces += 1;
          resultsMap[sortedTeams[2]].achievements.push({
            title: `المرتبة الثالثة في ${catLabel}`,
            sportId: t.sportId,
            category: t.ageCategory,
            rank: 3,
            tournamentName: t.name
          });
        }
      }
    });

    // Process Cross Country Results (Individual Podiums + Team Championships)
    if (selectedSport === 'ALL' || selectedSport === 'cross_country') {
      (Object.values(crossCountryResults) as CrossCountryCategoryResult[]).forEach((ccRes) => {
        if (!ccRes || !ccRes.podium || ccRes.podium.length === 0) return;

        const catDef = CROSS_COUNTRY_CATEGORIES.find((c) => c.id === ccRes.categoryId);
        const catLabel = catDef ? `سباق ${catDef.shortLabel} (${catDef.distance})` : (ccRes.titleAr || 'سباق العدو الريفي');

        // 1. Individual Podium (الترتيب الفردي)
        const p1 = ccRes.podium.find((p) => p.rank === 1);
        const p2 = ccRes.podium.find((p) => p.rank === 2);
        const p3 = ccRes.podium.find((p) => p.rank === 3);

        if (p1 && p1.schoolName) {
          const sId = getSchoolId(p1.schoolName);
          if (resultsMap[sId]) {
            resultsMap[sId].firstPlaces += 1;
            resultsMap[sId].achievements.push({
              title: `بطل ${catLabel} (فردي - ${p1.fullName})`,
              sportId: 'cross_country',
              category: ccRes.category,
              rank: 1,
              tournamentName: 'البطولة الإقليمية للعدو الريفي'
            });
          }
        }

        if (p2 && p2.schoolName) {
          const sId = getSchoolId(p2.schoolName);
          if (resultsMap[sId]) {
            resultsMap[sId].secondPlaces += 1;
            resultsMap[sId].achievements.push({
              title: `وصيف ${catLabel} (فردي - ${p2.fullName})`,
              sportId: 'cross_country',
              category: ccRes.category,
              rank: 2,
              tournamentName: 'البطولة الإقليمية للعدو الريفي'
            });
          }
        }

        if (p3 && p3.schoolName) {
          const sId = getSchoolId(p3.schoolName);
          if (resultsMap[sId]) {
            resultsMap[sId].thirdPlaces += 1;
            resultsMap[sId].achievements.push({
              title: `المرتبة الثالثة في ${catLabel} (فردي - ${p3.fullName})`,
              sportId: 'cross_country',
              category: ccRes.category,
              rank: 3,
              tournamentName: 'البطولة الإقليمية للعدو الريفي'
            });
          }
        }

        // 2. Team Rankings (ترتيب المؤسسات الفائزة حسب الفرق)
        const teams = calculateTeamRankings(ccRes.podium, students);
        if (teams && teams.length > 0) {
          if (teams[0] && teams[0].schoolName) {
            const tId = getSchoolId(teams[0].schoolName);
            if (resultsMap[tId]) {
              resultsMap[tId].firstPlaces += 1;
              resultsMap[tId].achievements.push({
                title: `بطل ${catLabel} (حسب الفرق 🏆 - ${teams[0].totalPoints} ن)`,
                sportId: 'cross_country',
                category: ccRes.category,
                rank: 1,
                tournamentName: 'البطولة الإقليمية للعدو الريفي'
              });
            }
          }

          if (teams[1] && teams[1].schoolName) {
            const tId = getSchoolId(teams[1].schoolName);
            if (resultsMap[tId]) {
              resultsMap[tId].secondPlaces += 1;
              resultsMap[tId].achievements.push({
                title: `وصيف ${catLabel} (حسب الفرق 🥈 - ${teams[1].totalPoints} ن)`,
                sportId: 'cross_country',
                category: ccRes.category,
                rank: 2,
                tournamentName: 'البطولة الإقليمية للعدو الريفي'
              });
            }
          }

          if (teams[2] && teams[2].schoolName) {
            const tId = getSchoolId(teams[2].schoolName);
            if (resultsMap[tId]) {
              resultsMap[tId].thirdPlaces += 1;
              resultsMap[tId].achievements.push({
                title: `المرتبة الثالثة في ${catLabel} (حسب الفرق 🥉 - ${teams[2].totalPoints} ن)`,
                sportId: 'cross_country',
                category: ccRes.category,
                rank: 3,
                tournamentName: 'البطولة الإقليمية للعدو الريفي'
              });
            }
          }
        }
      });
    }

    // Calculate totals & points (1 point per podium rank: 🥇=1 pt, 🥈=1 pt, 🥉=1 pt)
    const list = Object.values(resultsMap).map((item) => {
      const totalPodiums = item.firstPlaces + item.secondPlaces + item.thirdPlaces;
      const points = item.firstPlaces * 1 + item.secondPlaces * 1 + item.thirdPlaces * 1;
      return {
        ...item,
        totalPodiums,
        points
      };
    });

    // Filter by type, commune, and query
    return list
      .filter((item) => {
        if (selectedType !== 'ALL' && item.type !== selectedType) return false;
        if (!matchesZoneOrCommuneFilter(item.commune, item.schoolName)) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          if (!item.schoolName.toLowerCase().includes(q) && !item.commune.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // 1. First priority: Total Points (1 point for each Gold, Silver, or Bronze)
        if (b.points !== a.points) return b.points - a.points;
        // 2. Tie-breaker Priority 1: Most Gold (1st places)
        if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
        // 3. Tie-breaker Priority 2: Most Silver (2nd places)
        if (b.secondPlaces !== a.secondPlaces) return b.secondPlaces - a.secondPlaces;
        // 4. Tie-breaker Priority 3: Most Bronze (3rd places)
        if (b.thirdPlaces !== a.thirdPlaces) return b.thirdPlaces - a.thirdPlaces;
        // 5. Total Podiums / School Name
        if (b.totalPodiums !== a.totalPodiums) return b.totalPodiums - a.totalPodiums;
        return a.schoolName.localeCompare(b.schoolName, 'ar');
      });
  }, [schools, tournaments, matches, crossCountryResults, selectedSport, selectedType, selectedCommune, searchQuery]);

  // 2. Calculate Participation Ranking (ترتيب المؤسسات حسب عدد المشاركين والفرق)
  const schoolParticipationRanking = useMemo(() => {
    const partMap: Record<
      string,
      {
        schoolId: string;
        schoolName: string;
        type: string;
        commune: string;
        maleStudents: number;
        femaleStudents: number;
        totalStudents: number;
        sportsCount: number;
        sportsList: Set<string>;
      }
    > = {};

    schools.forEach((s) => {
      partMap[s.name] = {
        schoolId: s.id,
        schoolName: s.name,
        type: normalizeSchoolCycleType(s),
        commune: normalizeCommuneDisplay(s.commune),
        maleStudents: 0,
        femaleStudents: 0,
        totalStudents: 0,
        sportsCount: 0,
        sportsList: new Set<string>()
      };
    });

    students.forEach((st) => {
      const targetSchoolName = st.schoolName || 'مؤسسة غير محددة';
      if (!partMap[targetSchoolName]) {
        const found = schools.find((s) => s.id === st.schoolId || s.name === targetSchoolName);
        partMap[targetSchoolName] = {
          schoolId: found?.id || st.schoolId,
          schoolName: targetSchoolName,
          type: found ? normalizeSchoolCycleType(found) : normalizeSchoolCycleType({ name: targetSchoolName }),
          commune: normalizeCommuneDisplay(found?.commune),
          maleStudents: 0,
          femaleStudents: 0,
          totalStudents: 0,
          sportsCount: 0,
          sportsList: new Set<string>()
        };
      }

      if (st.gender === 'Male') {
        partMap[targetSchoolName].maleStudents += 1;
      } else {
        partMap[targetSchoolName].femaleStudents += 1;
      }
      partMap[targetSchoolName].totalStudents += 1;

      if (st.sportId) {
        partMap[targetSchoolName].sportsList.add(st.sportId);
      }
    });

    const list = Object.values(partMap).map((item) => ({
      ...item,
      sportsCount: item.sportsList.size
    }));

    return list
      .filter((item) => {
        if (selectedType !== 'ALL' && item.type !== selectedType) return false;
        if (!matchesZoneOrCommuneFilter(item.commune, item.schoolName)) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          if (!item.schoolName.toLowerCase().includes(q) && !item.commune.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (b.totalStudents !== a.totalStudents) return b.totalStudents - a.totalStudents;
        if (b.sportsCount !== a.sportsCount) return b.sportsCount - a.sportsCount;
        return b.femaleStudents - a.femaleStudents;
      });
  }, [schools, students, selectedType, selectedCommune, searchQuery]);

  // 3. Sports stats breakdown
  const sportsStats = useMemo(() => {
    const map: Record<
      string,
      {
        sportId: string;
        name: string;
        icon: string;
        studentsCount: number;
        maleCount: number;
        femaleCount: number;
        schoolsCount: Set<string>;
        matchesCount: number;
      }
    > = {};

    Object.entries(SPORTS_MAP).forEach(([id, info]) => {
      map[id] = {
        sportId: id,
        name: info.name,
        icon: info.icon,
        studentsCount: 0,
        maleCount: 0,
        femaleCount: 0,
        schoolsCount: new Set<string>(),
        matchesCount: 0
      };
    });

    students.forEach((st) => {
      if (map[st.sportId]) {
        map[st.sportId].studentsCount += 1;
        if (st.gender === 'Male') {
          map[st.sportId].maleCount += 1;
        } else {
          map[st.sportId].femaleCount += 1;
        }
        if (st.schoolName) {
          map[st.sportId].schoolsCount.add(st.schoolName);
        }
      }
    });

    matches.forEach((m) => {
      const sId = m.sportId || 'football';
      if (map[sId]) {
        map[sId].matchesCount += 1;
      }
    });

    // For Cross Country: count completed race podiums ONLY if Cross Country tournament is active
    const hasCCTourn = tournaments.some(t => t.sportId === 'cross_country' && t.status !== 'Draft' && (t as any).isActive !== false);
    if (map['cross_country']) {
      const ccCompletedRaces = hasCCTourn
        ? CROSS_COUNTRY_CATEGORIES.filter(c => crossCountryResults[c.id]?.podium && crossCountryResults[c.id].podium.length > 0).length
        : 0;
      map['cross_country'].matchesCount = ccCompletedRaces;
    }

    return Object.values(map).sort((a, b) => b.studentsCount - a.studentsCount);
  }, [students, matches, tournaments, crossCountryResults]);

  // Total summary counts (no hardcoded CC ghost counts when Cross Country isn't programmed)
  const summaryCounts = useMemo(() => {
    const activeTourns = tournaments.filter(t => t.status !== 'Draft' && (t as any).isActive !== false);
    const hasCCTourn = activeTourns.some(t => t.sportId === 'cross_country');
    const totalStudents = students.length;
    const totalBoys = students.filter((s) => s.gender === 'Male').length;
    const totalGirls = students.filter((s) => s.gender === 'Female').length;
    const ccCompletedCount = hasCCTourn
      ? CROSS_COUNTRY_CATEGORIES.filter(c => crossCountryResults[c.id]?.podium && crossCountryResults[c.id].podium.length > 0).length
      : 0;
    const ccTotalCount = hasCCTourn ? 8 : 0;
    const completedMatches = matches.filter((m) => m.status === 'Completed').length + ccCompletedCount;
    const totalMatchesCount = matches.length + ccTotalCount;
    return {
      schools: schools.length,
      students: totalStudents,
      boys: totalBoys,
      girls: totalGirls,
      matches: totalMatchesCount,
      completedMatches,
      tournaments: activeTourns.length
    };
  }, [schools, students, matches, tournaments, crossCountryResults]);

  // 4. Championship Participation Rates by Educational Cycle & Zone (Zone 1: El Aioun & Ain Lahjar, Zone 2: Tansharfi/Tankarfa & Rest)
  const tournamentParticipationByCycleAndZone = useMemo(() => {
    const CYCLE_ORDER: Array<'ابتدائي' | 'إعدادي' | 'تأهيلي' | 'خصوصي'> = ['ابتدائي', 'إعدادي', 'تأهيلي', 'خصوصي'];

    const isSchoolCycleAllowedByTourn = (school: School, tourn: Tournament): boolean => {
      if (!isSchoolSectorAllowedForTournament(school, tourn)) return false;

      const sCycle = normalizeSchoolCycleType(school);
      const rawLevel = (tourn.level || '').trim();
      const normRawLevel = normalizeArabicMatchText(rawLevel);
      const isAllOrEmptyLevel = !rawLevel || rawLevel.toUpperCase() === 'ALL' || normRawLevel.includes('جميع');
      const levelTokens = rawLevel.split(/[,،/]+/).map(x => x.trim().toLowerCase()).filter(Boolean);

      const matchesLevelToken = (targetCycle: 'ابتدائي' | 'إعدادي' | 'تأهيلي') => {
        if (isAllOrEmptyLevel) return true;
        return levelTokens.some(tok => {
          if (targetCycle === 'ابتدائي') return tok === 'primary' || tok.includes('ابتدائ');
          if (targetCycle === 'إعدادي') return tok === 'middle' || tok.includes('إعداد') || tok.includes('اعداد');
          if (targetCycle === 'تأهيلي') return tok === 'high' || tok.includes('تأهيل') || tok.includes('تاهيل') || tok.includes('ثانوي');
          return false;
        });
      };

      const lvlPrimary = matchesLevelToken('ابتدائي');
      const lvlMiddle = matchesLevelToken('إعدادي');
      const lvlHigh = matchesLevelToken('تأهيلي');

      const rawAge = String(tourn.ageCategory || '').trim();
      const normAgeUpper = rawAge.toUpperCase();
      const normAgeAr = normalizeArabicMatchText(rawAge);
      const isAllAge = !rawAge || normAgeUpper === 'ALL' || normAgeAr.includes('جميع');
      const hasU12 = normAgeUpper.includes('U12') || normAgeUpper.includes('U13') || normAgeAr.includes('براعم') || normAgeAr.includes('برعمات');
      const hasU15 = normAgeUpper.includes('U15') || normAgeAr.includes('صغار') || normAgeAr.includes('صغيرات');
      const hasU18OrU20 =
        normAgeUpper.includes('U18') ||
        normAgeUpper.includes('U20') ||
        normAgeAr.includes('فتيان') ||
        normAgeAr.includes('فتيات') ||
        normAgeAr.includes('شبان') ||
        normAgeAr.includes('شابات');
      const hasExplicitStandardAge = hasU12 || hasU15 || hasU18OrU20;

      const isExclusivelyPrimaryLevel = !isAllOrEmptyLevel && lvlPrimary && !lvlMiddle && !lvlHigh;
      const isExclusivelyMiddleLevel = !isAllOrEmptyLevel && lvlMiddle && !lvlPrimary && !lvlHigh;
      const isExclusivelyHighLevel = !isAllOrEmptyLevel && lvlHigh && !lvlPrimary && !lvlMiddle;

      // Check whether the sport definition itself supports U12 (Primary)
      const sportMetaCfg = sportsConfig.find(sc => sc.id === tourn.sportId);
      const sportSupportsU12 =
        !sportMetaCfg?.ageCategories?.length ||
        sportMetaCfg.ageCategories.some(c => {
          const cu = String(c || '').toUpperCase();
          return cu.includes('U12') || cu.includes('U13');
        }) ||
        (sportMetaCfg.customAgeCategories || []).some(c => {
          const cu = String(c?.id || c?.name || '').toUpperCase();
          return cu.includes('U12') || cu.includes('U13');
        });

      const allowsPrimary =
        lvlPrimary &&
        (isExclusivelyPrimaryLevel ||
          (hasExplicitStandardAge ? hasU12 : isAllAge && sportSupportsU12));

      const allowsMiddle =
        lvlMiddle &&
        (isExclusivelyMiddleLevel || !hasExplicitStandardAge || isAllAge || hasU15);

      const allowsHigh =
        lvlHigh &&
        (isExclusivelyHighLevel || !hasExplicitStandardAge || isAllAge || hasU18OrU20);

      if (sCycle === 'ابتدائي') return allowsPrimary;
      if (sCycle === 'إعدادي') return allowsMiddle;
      if (sCycle === 'تأهيلي') return allowsHigh;
      if (sCycle === 'خصوصي') {
        const sTypeAndName = normalizeArabicMatchText(`${school.type || ''} ${school.name || ''}`);
        const hintsPrimary = sTypeAndName.includes('ابتدائ');
        const hintsMiddle = sTypeAndName.includes('اعداد') || sTypeAndName.includes('إعداد');
        const hintsHigh = sTypeAndName.includes('تاهيل') || sTypeAndName.includes('تأهيل');
        if (!hintsPrimary && !hintsMiddle && !hintsHigh) {
          return allowsPrimary || allowsMiddle || allowsHigh;
        }
        return (hintsPrimary && allowsPrimary) || (hintsMiddle && allowsMiddle) || (hintsHigh && allowsHigh);
      }
      return false;
    };

    const activeTourns = tournaments.filter(t => {
      if (t.status === 'Draft' || (t as any).isActive === false) return false;
      const tAff = t.affiliationType || (isClubTournament(t) ? 'club_affiliated' : 'non_club');
      if (!isAffiliationAllowedByDisplayConfig(tAff, affiliationDisplayConfig, t.sportId)) return false;
      if (selectedSport !== 'ALL' && t.sportId !== selectedSport) return false;
      return true;
    });

    const groupedBySport = new Map<string, Tournament[]>();
    activeTourns.forEach(t => {
      if (!t.sportId) return;
      if (!groupedBySport.has(t.sportId)) groupedBySport.set(t.sportId, []);
      groupedBySport.get(t.sportId)!.push(t);
    });

    const reports: Array<{
      sportId: string;
      sportName: string;
      sportIcon: string;
      tournamentsCount: number;
      overall: { eligible: number; participating: number; pct: number; z1Elig: number; z1Part: number; z1Pct: number; z2Elig: number; z2Part: number; z2Pct: number };
      cycles: Array<{
        cycle: 'ابتدائي' | 'إعدادي' | 'تأهيلي' | 'خصوصي';
        eligible: number;
        participating: number;
        pct: number;
        z1Elig: number;
        z1Part: number;
        z1Pct: number;
        z2Elig: number;
        z2Part: number;
        z2Pct: number;
        participatingSchoolNames: string[];
      }>;
    }> = [];

    groupedBySport.forEach((sportTourns, sportId) => {
      const sportMeta = SPORTS_MAP[sportId] || sportsConfig.find(s => s.id === sportId) || { name: sportId, icon: '🏆' };

      // Build canonical participating school ID/name set for this sport (excluding withdrawn & disallowed affiliations)
      const isSchoolParticipatingInSport = (school: School): boolean => {
        const hasStudent = students.some(st => {
          if (st.sportId !== sportId) return false;
          if (!isAffiliationAllowedByDisplayConfig(st.affiliationType, affiliationDisplayConfig, sportId)) return false;
          if (DataService.isSchoolWithdrawn(
            { sportId, ageCategory: st.category, gender: st.gender, affiliationType: st.affiliationType },
            st.schoolId,
            st.schoolName || ''
          )) {
            return false;
          }
          return (st.schoolId && st.schoolId === school.id) || schoolNamesMatch(st.schoolName || '', school.name);
        });
        if (hasStudent) return true;

        return confirmations.some(c => {
          if (c.sportId !== sportId || c.status !== 'confirmed') return false;
          const matchesSchool = (c.schoolId && c.schoolId === school.id) || schoolNamesMatch(c.schoolName || '', school.name);
          if (!matchesSchool) return false;
          const activeBranches = getEffectiveConfirmedBranches(c, true).filter(b =>
            isAffiliationAllowedByDisplayConfig(b.affiliationType, affiliationDisplayConfig, sportId)
          );
          return activeBranches.length > 0;
        });
      };

      const cycleBreakdown: typeof reports[number]['cycles'] = [];
      let overallEligSet = new Set<string>();
      let overallPartSet = new Set<string>();
      let overallZ1EligSet = new Set<string>();
      let overallZ1PartSet = new Set<string>();
      let overallZ2EligSet = new Set<string>();
      let overallZ2PartSet = new Set<string>();

      CYCLE_ORDER.forEach(cycle => {
        if (selectedType !== 'ALL' && selectedType !== cycle) return;

        const eligibleSchools = schools.filter(s => {
          if (normalizeSchoolCycleType(s) !== cycle) return false;
          if (!matchesZoneOrCommuneFilter(s.commune, s.name)) return false;
          return sportTourns.some(t => isSchoolCycleAllowedByTourn(s, t));
        });

        if (eligibleSchools.length === 0) return;

        let z1Elig = 0;
        let z1Part = 0;
        let z2Elig = 0;
        let z2Part = 0;
        const partNames: string[] = [];

        eligibleSchools.forEach(s => {
          const zone = getEducationalZone(s.commune, s.name);
          const participates = isSchoolParticipatingInSport(s);
          overallEligSet.add(s.id);
          if (zone === 'zone1') {
            z1Elig += 1;
            overallZ1EligSet.add(s.id);
            if (participates) {
              z1Part += 1;
              overallZ1PartSet.add(s.id);
              overallPartSet.add(s.id);
              partNames.push(s.name);
            }
          } else {
            z2Elig += 1;
            overallZ2EligSet.add(s.id);
            if (participates) {
              z2Part += 1;
              overallZ2PartSet.add(s.id);
              overallPartSet.add(s.id);
              partNames.push(s.name);
            }
          }
        });

        const totalElig = eligibleSchools.length;
        const totalPart = z1Part + z2Part;
        cycleBreakdown.push({
          cycle,
          eligible: totalElig,
          participating: totalPart,
          pct: totalElig > 0 ? Math.round((totalPart / totalElig) * 100) : 0,
          z1Elig,
          z1Part,
          z1Pct: z1Elig > 0 ? Math.round((z1Part / z1Elig) * 100) : 0,
          z2Elig,
          z2Part,
          z2Pct: z2Elig > 0 ? Math.round((z2Part / z2Elig) * 100) : 0,
          participatingSchoolNames: partNames
        });
      });

      if (cycleBreakdown.length === 0) return;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSport = sportMeta.name.toLowerCase().includes(q);
        const matchSchool = cycleBreakdown.some(c => c.participatingSchoolNames.some(n => n.toLowerCase().includes(q)));
        if (!matchSport && !matchSchool) return;
      }

      const oElig = overallEligSet.size;
      const oPart = overallPartSet.size;
      const oZ1Elig = overallZ1EligSet.size;
      const oZ1Part = overallZ1PartSet.size;
      const oZ2Elig = overallZ2EligSet.size;
      const oZ2Part = overallZ2PartSet.size;

      reports.push({
        sportId,
        sportName: sportMeta.name,
        sportIcon: sportMeta.icon || '🏆',
        tournamentsCount: sportTourns.length,
        overall: {
          eligible: oElig,
          participating: oPart,
          pct: oElig > 0 ? Math.round((oPart / oElig) * 100) : 0,
          z1Elig: oZ1Elig,
          z1Part: oZ1Part,
          z1Pct: oZ1Elig > 0 ? Math.round((oZ1Part / oZ1Elig) * 100) : 0,
          z2Elig: oZ2Elig,
          z2Part: oZ2Part,
          z2Pct: oZ2Elig > 0 ? Math.round((oZ2Part / oZ2Elig) * 100) : 0
        },
        cycles: cycleBreakdown
      });
    });

    return reports.sort((a, b) => b.overall.pct - a.overall.pct || b.overall.participating - a.overall.participating);
  }, [tournaments, schools, students, confirmations, sportsConfig, affiliationDisplayConfig, selectedSport, selectedType, selectedCommune, searchQuery]);

  // 5. Officiated Matches Statistics per Referee Teacher Broken Down by Sport
  const refereeOfficiatingStats = useMemo(() => {
    const cleanRefName = (raw: string): string =>
      String(raw || '')
        .replace(/الحكم المعتمد/gi, '')
        .replace(/حكم الأول|الحكم الأول|حكم أول/gi, '')
        .replace(/حكم الثاني|الحكم الثاني|حكم ثاني/gi, '')
        .replace(/حكم الساحة|حكام الساحة|حكم الطاولة|حكام الطاولة/gi, '')
        .replace(/\(?\s*أستاذ\s*\)?/gi, '')
        .replace(/^[:\-–—\s]+|[:\-–—\s]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    const refIdToName = new Map<string, string>();
    refereesList.forEach(r => {
      if (r.id && r.fullName) refIdToName.set(r.id.trim().toLowerCase(), cleanRefName(r.fullName));
    });
    usersList.forEach(u => {
      if (u.id && u.fullName && !refIdToName.has(u.id.trim().toLowerCase())) {
        refIdToName.set(u.id.trim().toLowerCase(), cleanRefName(u.fullName));
      }
    });

    interface RefAccumulator {
      key: string;
      displayName: string;
      allMatchIds: Set<string>;
      completedMatchIds: Set<string>;
      sportMatchIds: Record<string, Set<string>>;
    }

    const refMap = new Map<string, RefAccumulator>();

    matches.forEach(m => {
      if (!m || !m.id) return;
      if (selectedSport !== 'ALL' && m.sportId !== selectedSport) return;
      const mAff = (m as any).affiliationType || 'non_club';
      if (!isAffiliationAllowedByDisplayConfig(mAff, affiliationDisplayConfig, m.sportId)) return;

      const entries = [
        ...(Array.isArray(m.fieldReferees) ? m.fieldReferees : []),
        ...(Array.isArray(m.tableReferees) ? m.tableReferees : []),
        ...(Array.isArray(m.referees) ? m.referees : []),
        ...(m.referee1Id ? [m.referee1Id] : []),
        ...(m.referee2Id ? [m.referee2Id] : [])
      ];

      entries.forEach(rawEntry => {
        const trimmed = (rawEntry || '').trim();
        if (!trimmed) return;
        const resolvedById = refIdToName.get(trimmed.toLowerCase());
        const cleaned = cleanRefName(resolvedById || trimmed);
        if (!cleaned || cleaned.length < 2) return;
        const normKey = normalizeArabicMatchText(cleaned);
        if (!normKey) return;

        if (!refMap.has(normKey)) {
          refMap.set(normKey, {
            key: normKey,
            displayName: cleaned,
            allMatchIds: new Set<string>(),
            completedMatchIds: new Set<string>(),
            sportMatchIds: {}
          });
        }
        const acc = refMap.get(normKey)!;
        acc.allMatchIds.add(m.id);
        if (m.status === 'Completed') acc.completedMatchIds.add(m.id);
        const sId = m.sportId || 'football';
        if (!acc.sportMatchIds[sId]) acc.sportMatchIds[sId] = new Set<string>();
        acc.sportMatchIds[sId].add(m.id);
      });
    });

    return Array.from(refMap.values())
      .map(acc => {
        const sportsBreakdown = Object.entries(acc.sportMatchIds)
          .map(([sportId, idSet]) => {
            const spInfo = SPORTS_MAP[sportId] || sportsConfig.find(s => s.id === sportId) || { name: sportId, icon: '🏆' };
            return {
              sportId,
              sportName: spInfo.name,
              sportIcon: spInfo.icon || '🏆',
              count: idSet.size
            };
          })
          .sort((a, b) => b.count - a.count);

        return {
          key: acc.key,
          displayName: acc.displayName,
          totalMatches: acc.allMatchIds.size,
          completedMatches: acc.completedMatchIds.size,
          sportsBreakdown
        };
      })
      .filter(r => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const nameHit = r.displayName.toLowerCase().includes(q);
          const sportHit = r.sportsBreakdown.some(sb => sb.sportName.toLowerCase().includes(q));
          return nameHit || sportHit;
        }
        return true;
      })
      .sort((a, b) => b.totalMatches - a.totalMatches || b.completedMatches - a.completedMatches || a.displayName.localeCompare(b.displayName, 'ar'));
  }, [matches, refereesList, usersList, sportsConfig, affiliationDisplayConfig, selectedSport, searchQuery]);

  const handlePrint = () => {
    window.print();
  };

  // State to toggle Cross Country breakdown in Statistics
  const [showCCPodiums, setShowCCPodiums] = useState(true);

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 md:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="bg-indigo-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              لوحة الإحصائيات الشاملة 📊
            </span>
            <span className="text-slate-400 text-xs font-medium">| {activeDirObj?.name || 'المديرية الإقليمية'}</span>
          </div>
          <h2 className="text-lg md:text-xl font-black text-white">
            إحصائيات المشاركة والنتائج المسجلة للمؤسسات التعليمية
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
            استعراض دقيق وشامل لترتيب المؤسسات حسب النتائج والنقاط، وترتيب نسب المشاركة وعدد التلميذات والتلاميذ المسجلين في مختلف البطولات الرياضية المدرسية.
          </p>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="self-start md:self-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-xs"
        >
          <Printer className="w-4 h-4" />
          <span>طباعة التقرير الإحصائي</span>
        </button>
      </div>

      {/* Clickable KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <button
          type="button"
          onClick={() => handleKpiCardClick('schools', 'participation')}
          className={`text-right w-full bg-white p-3 sm:p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            activeTab === 'participation' && activeKpiFocus === 'schools'
              ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm'
              : 'border-slate-200 hover:border-blue-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] font-bold text-slate-500">المؤسسات المشاركة</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <SchoolIcon className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">{summaryCounts.schools}</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-1">مؤسسة تعليمية مسجلة</p>
        </button>

        <button
          type="button"
          onClick={() => handleKpiCardClick('students', 'participation')}
          className={`text-right w-full bg-white p-3 sm:p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            activeTab === 'participation' && activeKpiFocus === 'students'
              ? 'border-emerald-500 ring-2 ring-emerald-500/20 shadow-sm'
              : 'border-slate-200 hover:border-emerald-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] font-bold text-slate-500">التلاميذ المشاركون</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">{summaryCounts.students}</h3>
          <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] font-bold mt-1 flex-wrap">
            <span className="text-blue-600 tabular-nums">👦 {summaryCounts.boys} ذكور</span>
            <span className="text-slate-300">·</span>
            <span className="text-pink-600 tabular-nums">👧 {summaryCounts.girls} إناث</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleKpiCardClick('matches', 'matches')}
          className={`text-right w-full bg-white p-3 sm:p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            activeTab === 'matches'
              ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
              : 'border-slate-200 hover:border-amber-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] font-bold text-slate-500">المباريات المنجزة</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Trophy className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">
            {summaryCounts.completedMatches}{' '}
            <span className="text-xs text-slate-400 font-normal">/ {summaryCounts.matches}</span>
          </h3>
          <p className="text-[10px] text-amber-700 font-medium mt-1 tabular-nums">
            نسبة الإنجاز:{' '}
            {summaryCounts.matches > 0
              ? Math.round((summaryCounts.completedMatches / summaryCounts.matches) * 100)
              : 0}
            %
          </p>
        </button>

        <button
          type="button"
          onClick={() => handleKpiCardClick('sports', 'sports')}
          className={`text-right w-full bg-white p-3 sm:p-4 rounded-xl border transition-all cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] ${
            activeTab === 'sports'
              ? 'border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
              : 'border-slate-200 hover:border-purple-300 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5 sm:mb-2">
            <span className="text-[11px] font-bold text-slate-500">البطولات والتخصصات</span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-800 tabular-nums">{sportsStats.length}</h3>
          <p className="text-[10px] text-purple-700 font-medium mt-1 tabular-nums">
            {summaryCounts.tournaments} بطولة مبرمجة
          </p>
        </button>
      </div>

      {/* Main Container */}
      <div id="stats-main-section" className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden scroll-mt-4">
        {/* Navigation Tabs */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-stretch gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                activeTab === 'results'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>ترتيب المؤسسات حسب النتائج</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('participation')}
              className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                activeTab === 'participation'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>ترتيب المؤسسات حسب المشاركة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('matches')}
              className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                activeTab === 'matches'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>المباريات المنجزة والمبرمجة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('tournaments_zones')}
              className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                activeTab === 'tournaments_zones'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span>نسب المشاركة بالمناطق والأسلاك</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('referees')}
              className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                activeTab === 'referees'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>إحصائيات التحكيم والأساتذة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sports')}
              className={`min-h-[42px] px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer text-center ${
                activeTab === 'sports'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 shrink-0" />
              <span>إحصائيات التخصصات الرياضية</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full lg:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder={activeTab === 'referees' ? 'بحث باسم الأستاذ الحكم أو الرياضة...' : 'بحث باسم المؤسسة أو الجماعة...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-8 pl-3 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Dynamic Filters Bar + Table/Cards View Switcher */}
        <div className="p-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
            <div className="flex items-center justify-between sm:justify-start gap-1.5 font-bold text-slate-600 shrink-0">
              <span className="flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>تصفية:</span>
              </span>

              {/* Mobile View Mode Switcher inline with Filter label */}
              {(activeTab === 'results' || activeTab === 'participation') && (
                <div className="inline-flex sm:hidden items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                  <button
                    type="button"
                    onClick={() => setRankingViewMode('cards')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                      rankingViewMode === 'cards'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="عرض على شكل بطائق"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>بطائق</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingViewMode('table')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 transition-all cursor-pointer ${
                      rankingViewMode === 'table'
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    title="عرض على شكل جدول"
                  >
                    <List className="w-3.5 h-3.5" />
                    <span>جدول</span>
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-stretch sm:items-center gap-2 w-full sm:w-auto">
              {(activeTab === 'results' || activeTab === 'matches' || activeTab === 'tournaments_zones' || activeTab === 'referees') && (
                <select
                  value={selectedSport}
                  onChange={(e) => setSelectedSport(e.target.value)}
                  className="px-2.5 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-lg font-medium text-slate-700 w-full sm:w-auto cursor-pointer"
                >
                  <option value="ALL">جميع الرياضات</option>
                  {Object.entries(SPORTS_MAP).map(([id, info]) => (
                    <option key={id} value={id}>
                      {info.icon} {info.name}
                    </option>
                  ))}
                </select>
              )}

              {activeTab !== 'matches' && activeTab !== 'referees' && (
                <>
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="px-2.5 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-lg font-medium text-slate-700 w-full sm:w-auto cursor-pointer"
                  >
                    <option value="ALL">جميع الأسلاك (ابتدائي / إعدادي / تأهيلي / خصوصي)</option>
                    <option value="ابتدائي">التعليم الابتدائي</option>
                    <option value="إعدادي">الثانوي الإعدادي</option>
                    <option value="تأهيلي">الثانوي التأهيلي</option>
                    <option value="خصوصي">التعليم الخصوصي</option>
                  </select>

                  <select
                    value={selectedCommune}
                    onChange={(e) => setSelectedCommune(e.target.value)}
                    className="px-2.5 py-2 sm:py-1.5 bg-slate-50 border border-slate-200 rounded-xl sm:rounded-lg font-medium text-slate-700 w-full sm:w-auto cursor-pointer"
                  >
                    <option value="ALL">جميع المناطق والجماعات الترابية</option>
                    <option value="ZONE_1">📍 المنطقة التربوية 1 (العيون سيدي ملوك • عين لحجر)</option>
                    <option value="ZONE_2">📍 المنطقة التربوية 2 (تاوريرت المركز • تنشرفي • باقي الجماعات)</option>
                    {communes.map((c) => (
                      <option key={c} value={c}>
                        جماعة {c}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>

          {/* Desktop View Mode Switcher (Table vs Cards) */}
          {(activeTab === 'results' || activeTab === 'participation') && (
            <div className="hidden sm:inline-flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setRankingViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  rankingViewMode === 'table'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض على شكل جدول"
              >
                <List className="w-3.5 h-3.5" />
                <span>جدول</span>
              </button>
              <button
                type="button"
                onClick={() => setRankingViewMode('cards')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                  rankingViewMode === 'cards'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="عرض على شكل بطائق"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>بطائق</span>
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Results Leaderboard Table (ترتيب التتويجات والنتائج) */}
        {activeTab === 'results' && (
          <div>
            {/* Cross Country Championship Honor Roll & Winning Institutions (when sport filter is ALL or cross_country) */}
            {(selectedSport === 'ALL' || selectedSport === 'cross_country') && (
              <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-lg shadow-xs">
                      🏃‍♂️
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black text-white">
                          لوحة تتويجات البطولة الإقليمية للعدو الريفي المدرسي
                        </h3>
                        <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black px-2 py-0.5 rounded-full">
                          8 فئات مدمجة
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                        استعراض الأبطال المتوجين فردياً والمؤسسات الفائزة حسب الفرق المتأهلة للبطولة الجهوية
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCCPodiums(prev => !prev)}
                    className="self-start sm:self-auto text-xs font-bold text-slate-200 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <span>{showCCPodiums ? 'طي منصات العدو الريفي' : 'عرض منصات وتتويجات العدو الريفي'}</span>
                    {showCCPodiums ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>

                {showCCPodiums && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    {CROSS_COUNTRY_CATEGORIES.map(cat => {
                      const res = crossCountryResults[cat.id];
                      const p1 = res?.podium?.find(p => p.rank === 1);
                      const p2 = res?.podium?.find(p => p.rank === 2);
                      const p3 = res?.podium?.find(p => p.rank === 3);
                      const hasResult = p1 || p2 || p3;
                      const catTeams = res?.podium ? calculateTeamRankings(res.podium, students) : [];
                      const winningTeam = catTeams.length > 0 ? catTeams[0] : null;

                      return (
                        <div
                          key={cat.id}
                          className="bg-white/10 border border-white/15 rounded-xl p-3 backdrop-blur-xs flex flex-col justify-between hover:border-amber-400/50 transition-all group"
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-white/10 mb-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="text-base shrink-0">{cat.icon}</span>
                                <span className="text-xs font-black text-white truncate group-hover:text-amber-300 transition-colors">
                                  {cat.shortLabel}
                                </span>
                              </div>
                              <span className="text-[10px] font-bold text-amber-300 bg-amber-400/20 border border-amber-400/30 px-1.5 py-0.5 rounded-md shrink-0">
                                {cat.distance}
                              </span>
                            </div>

                            {/* Individual Podium */}
                            {hasResult ? (
                              <div className="space-y-1.5 text-xs">
                                {/* 1st */}
                                <div className="p-1.5 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm shrink-0">🥇</span>
                                    <div className="truncate">
                                      <p className="text-[11px] font-black text-amber-200 truncate">{p1?.fullName || 'غير محدد'}</p>
                                      <p className="text-[9px] text-slate-300 truncate font-medium">{p1?.schoolName || 'المؤسسة'}</p>
                                    </div>
                                  </div>
                                  {p1?.time && (
                                    <span className="text-[9px] font-mono font-black text-amber-300 shrink-0 bg-black/30 px-1 py-0.5 rounded">
                                      {p1.time}
                                    </span>
                                  )}
                                </div>

                                {/* 2nd */}
                                <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm shrink-0">🥈</span>
                                    <div className="truncate">
                                      <p className="text-[11px] font-bold text-slate-200 truncate">{p2?.fullName || 'غير محدد'}</p>
                                      <p className="text-[9px] text-slate-400 truncate">{p2?.schoolName || 'المؤسسة'}</p>
                                    </div>
                                  </div>
                                  {p2?.time && (
                                    <span className="text-[9px] font-mono text-slate-300 shrink-0 bg-black/20 px-1 py-0.5 rounded">
                                      {p2.time}
                                    </span>
                                  )}
                                </div>

                                {/* 3rd */}
                                <div className="p-1.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm shrink-0">🥉</span>
                                    <div className="truncate">
                                      <p className="text-[11px] font-bold text-slate-200 truncate">{p3?.fullName || 'غير محدد'}</p>
                                      <p className="text-[9px] text-slate-400 truncate">{p3?.schoolName || 'المؤسسة'}</p>
                                    </div>
                                  </div>
                                  {p3?.time && (
                                    <span className="text-[9px] font-mono text-amber-300 shrink-0 bg-black/20 px-1 py-0.5 rounded">
                                      {p3.time}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="py-4 text-center text-slate-400 text-[10px]">
                                في انتظار النتائج
                              </div>
                            )}

                            {/* Winning Institution / Team */}
                            {winningTeam && (
                              <div className="mt-2 p-2 rounded-lg bg-blue-900/60 border border-blue-500/40">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                  <span className="text-[9px] font-black text-amber-300">
                                    🏆 بطل الفئة (حسب الفرق)
                                  </span>
                                  <span className="text-[9px] font-mono font-black text-amber-300 bg-black/40 px-1.5 py-0.2 rounded">
                                    {winningTeam.totalPoints} ن
                                  </span>
                                </div>
                                <div className="text-[11px] font-black text-white truncate">
                                  {winningTeam.schoolName}
                                </div>
                                <div className="text-[9px] text-blue-200 mt-0.5 flex items-center justify-between font-medium">
                                  <span>تأهل للجهوية 🚀</span>
                                  <span>4 عداءين</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Scoring Rule Explanatory Banner */}
            <div className="p-3 bg-blue-50/70 border-b border-blue-100 flex items-center justify-between gap-2 text-xs text-blue-950 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] font-black">ضوابط الترتيب</span>
                <span className="font-semibold text-[11px] sm:text-xs">
                  كل رتبة محصل عليها في مختلف الرياضات والسباقات (🥇 ذهبية، 🥈 فضية، 🥉 برونزية) فردياً أو حسب الفرق تساوي <strong>نقطة واحدة (1ن)</strong>. وعند التعادل في النقط تكون الأولوية للذهب ثم الفضة ثم البرونز.
                </span>
              </div>
              <span className="text-[10px] text-blue-700 bg-white border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
                🥇=1ن | 🥈=1ن | 🥉=1ن
              </span>
            </div>

            {/* Results Cards View */}
            {rankingViewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50/40">
              {schoolResultsRanking.length === 0 ? (
                <div className="md:col-span-2 py-12 px-4 text-center text-slate-400 text-xs">
                  لا توجد نتائج مسجلة للمؤسسات في الفئات والبطولات المحددة
                </div>
              ) : (
                schoolResultsRanking.map((item, idx) => {
                  const rank = idx + 1;
                  const hasPodium = item.totalPodiums > 0;
                  return (
                    <div
                      key={`mob-res-${item.schoolId}`}
                      className={`p-3.5 rounded-xl border space-y-2.5 shadow-2xs ${
                        rank === 1 && hasPodium
                          ? 'bg-amber-50/70 border-amber-300'
                          : rank === 2 && hasPodium
                          ? 'bg-slate-50 border-slate-300'
                          : rank === 3 && hasPodium
                          ? 'bg-orange-50/50 border-orange-200'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <div className="shrink-0 mt-0.5">
                            {rank === 1 && item.firstPlaces > 0 ? (
                              <span className="w-8 h-8 rounded-full bg-amber-400 text-slate-950 font-black inline-flex items-center justify-center text-sm shadow-xs">
                                🥇
                              </span>
                            ) : rank === 2 && (item.firstPlaces > 0 || item.secondPlaces > 0) ? (
                              <span className="w-8 h-8 rounded-full bg-slate-300 text-slate-900 font-black inline-flex items-center justify-center text-sm shadow-xs">
                                🥈
                              </span>
                            ) : rank === 3 && item.totalPodiums > 0 ? (
                              <span className="w-8 h-8 rounded-full bg-amber-700 text-white font-black inline-flex items-center justify-center text-sm shadow-xs">
                                🥉
                              </span>
                            ) : (
                              <span className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-black inline-flex items-center justify-center text-xs tabular-nums">
                                {rank}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-slate-900 text-xs leading-snug break-words">
                              {item.schoolName}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {item.type} · جماعة {item.commune}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 text-left">
                          <span
                            className={`inline-flex items-center justify-center px-2.5 py-1 rounded-xl font-black text-xs tabular-nums ${
                              item.points > 0
                                ? 'bg-blue-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {item.points} ن
                          </span>
                        </div>
                      </div>

                      {/* Medals & Podiums Strip */}
                      <div className="grid grid-cols-4 gap-1.5 text-center text-[11px]">
                        <div className="bg-amber-50/90 border border-amber-200/80 rounded-lg py-1.5 px-1">
                          <div className="text-[10px] text-amber-800 font-bold">🥇 ذهب</div>
                          <div className="font-black text-amber-950 tabular-nums mt-0.5">{item.firstPlaces}</div>
                        </div>
                        <div className="bg-slate-100/90 border border-slate-200 rounded-lg py-1.5 px-1">
                          <div className="text-[10px] text-slate-600 font-bold">🥈 فضة</div>
                          <div className="font-black text-slate-900 tabular-nums mt-0.5">{item.secondPlaces}</div>
                        </div>
                        <div className="bg-orange-50/90 border border-orange-200/80 rounded-lg py-1.5 px-1">
                          <div className="text-[10px] text-orange-800 font-bold">🥉 برونز</div>
                          <div className="font-black text-orange-950 tabular-nums mt-0.5">{item.thirdPlaces}</div>
                        </div>
                        <div className="bg-indigo-50/90 border border-indigo-200/80 rounded-lg py-1.5 px-1">
                          <div className="text-[10px] text-indigo-800 font-bold">🏆 مجموع</div>
                          <div className="font-black text-indigo-950 tabular-nums mt-0.5">{item.totalPodiums}</div>
                        </div>
                      </div>

                      {item.achievements && item.achievements.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setSelectedSchoolAchievements({ schoolName: item.schoolName, achievements: item.achievements })}
                          className="w-full min-h-[40px] px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>عرض سجل التتويجات ({item.achievements.length})</span>
                        </button>
                      ) : (
                        <div className="text-[11px] text-slate-400 text-center py-1">في طور التباري ⏳</div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            )}

            {/* Results Table View */}
            {rankingViewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs min-w-[780px]">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold">
                <tr>
                  <th className="py-3.5 px-4 text-center w-14">الرتبة</th>
                  <th className="py-3.5 px-4">المؤسسة التعليمية</th>
                  <th className="py-3.5 px-4">السلك</th>
                  <th className="py-3.5 px-4">الجماعة</th>
                  <th className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-amber-700 font-black">
                      🥇 الرتبة 1 (ذهب)
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-slate-700 font-black">
                      🥈 الرتبة 2 (فضة)
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-amber-900 font-black">
                      🥉 الرتبة 3 (برونز)
                    </span>
                  </th>
                  <th className="py-3.5 px-4 text-center font-black text-indigo-900 bg-indigo-50/40">
                    🏆 إجمالي التتويجات
                  </th>
                  <th className="py-3.5 px-4 text-center font-black text-blue-800 bg-blue-50/40">
                    ⭐️ مجموع النقاط
                  </th>
                  <th className="py-3.5 px-4 text-center">سجل الفئات المتوج بها</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schoolResultsRanking.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      لا توجد نتائج مسجلة للمؤسسات في الفئات والبطولات المحددة
                    </td>
                  </tr>
                ) : (
                  schoolResultsRanking.map((item, idx) => {
                    const rank = idx + 1;
                    const hasPodium = item.totalPodiums > 0;
                    return (
                      <tr
                        key={item.schoolId}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          rank === 1 && hasPodium
                            ? 'bg-amber-50/50 font-bold'
                            : rank === 2 && hasPodium
                            ? 'bg-slate-100/50'
                            : rank === 3 && hasPodium
                            ? 'bg-orange-50/30'
                            : ''
                        }`}
                      >
                        <td className="py-3 px-4 text-center">
                          {rank === 1 && item.firstPlaces > 0 ? (
                            <span className="w-7 h-7 rounded-full bg-amber-400 text-slate-950 font-black inline-flex items-center justify-center text-sm shadow-xs">
                              🥇
                            </span>
                          ) : rank === 2 && (item.firstPlaces > 0 || item.secondPlaces > 0) ? (
                            <span className="w-7 h-7 rounded-full bg-slate-300 text-slate-900 font-black inline-flex items-center justify-center text-sm shadow-xs">
                              🥈
                            </span>
                          ) : rank === 3 && item.totalPodiums > 0 ? (
                            <span className="w-7 h-7 rounded-full bg-amber-700 text-white font-black inline-flex items-center justify-center text-sm shadow-xs">
                              🥉
                            </span>
                          ) : (
                            <span className="font-bold text-slate-500">{rank}</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-black text-slate-800 text-xs md:text-sm flex items-center justify-center gap-2">
                            <span>{item.schoolName}</span>
                            {item.firstPlaces > 0 && (
                              <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                🏆 بطل
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">{item.type}</td>
                        <td className="py-3 px-4 text-slate-600 font-medium">{item.commune}</td>
                        
                        {/* 1st Places */}
                        <td className="py-3 px-4 text-center">
                          {item.firstPlaces > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-black text-xs shadow-xs">
                              🥇 {item.firstPlaces}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">-</span>
                          )}
                        </td>

                        {/* 2nd Places */}
                        <td className="py-3 px-4 text-center">
                          {item.secondPlaces > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 bg-slate-200 border border-slate-300 text-slate-800 rounded-lg font-black text-xs shadow-xs">
                              🥈 {item.secondPlaces}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">-</span>
                          )}
                        </td>

                        {/* 3rd Places */}
                        <td className="py-3 px-4 text-center">
                          {item.thirdPlaces > 0 ? (
                            <span className="inline-flex items-center justify-center min-w-7 h-7 px-2 bg-orange-100 border border-orange-300 text-orange-900 rounded-lg font-black text-xs shadow-xs">
                              🥉 {item.thirdPlaces}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">-</span>
                          )}
                        </td>

                        {/* Total Podiums */}
                        <td className="py-3 px-4 text-center bg-indigo-50/20">
                          {item.totalPodiums > 0 ? (
                            <span className="inline-flex items-center justify-center px-2.5 py-1 bg-indigo-50 border border-indigo-200 text-indigo-800 rounded-lg font-black text-xs">
                              🏆 {item.totalPodiums}
                            </span>
                          ) : (
                            <span className="text-slate-300 font-bold">0</span>
                          )}
                        </td>

                        {/* Total Ranking Points */}
                        <td className="py-3 px-4 text-center bg-blue-50/20">
                          <span className={`inline-block px-3 py-1 rounded-lg font-black text-xs md:text-sm ${
                            item.points > 0 
                              ? 'bg-blue-600 text-white shadow-xs' 
                              : 'bg-slate-100 text-slate-400'
                          }`}>
                            {item.points} نقطة
                          </span>
                        </td>

                        {/* Achievements list */}
                        <td className="py-3 px-4">
                          {item.achievements && item.achievements.length > 0 ? (
                            <button
                              onClick={() => setSelectedSchoolAchievements({ schoolName: item.schoolName, achievements: item.achievements })}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 border border-indigo-200 hover:border-indigo-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 mx-auto transition-colors cursor-pointer shadow-3xs"
                              title="عرض تفاصيل وبيان التتويجات والجوائز لهذه المؤسسة"
                            >
                              <Trophy className="w-3.5 h-3.5 text-amber-500" />
                              <span>التتويجات ({item.achievements.length})</span>
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-normal">في طور التباري ⏳</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          )}
          </div>
        )}

        {/* Tab 2: Participation Ranking Table + Cards */}
        {activeTab === 'participation' && (
          <div>
            {/* Participation Cards View */}
            {rankingViewMode === 'cards' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-slate-50/40">
              {schoolParticipationRanking.length === 0 ? (
                <div className="md:col-span-2 py-10 px-4 text-center text-slate-400 text-xs">
                  لا توجد بيانات مشاركة مسجلة
                </div>
              ) : (
                schoolParticipationRanking.map((item, idx) => {
                  const rank = idx + 1;
                  return (
                    <div
                      key={`mob-part-${item.schoolName}`}
                      className={`p-3.5 rounded-xl border space-y-2.5 shadow-2xs ${
                        rank === 1
                          ? 'bg-emerald-50/70 border-emerald-300'
                          : rank === 2
                          ? 'bg-slate-50 border-slate-300'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                          <span
                            className={`w-8 h-8 rounded-full font-black inline-flex items-center justify-center text-xs shrink-0 mt-0.5 tabular-nums ${
                              rank === 1
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : rank === 2
                                ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                                : rank === 3
                                ? 'bg-teal-100 text-teal-900 border border-teal-300'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            #{rank}
                          </span>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-black text-slate-900 text-xs leading-snug break-words">
                              {item.schoolName}
                            </h4>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {item.type} · جماعة {item.commune}
                            </p>
                          </div>
                        </div>

                        <span className="shrink-0 px-2.5 py-1 bg-emerald-600 text-white rounded-xl font-black text-xs tabular-nums shadow-xs">
                          {item.totalStudents} تلميذ(ة)
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                        <div className="bg-blue-50/80 border border-blue-200/80 rounded-lg py-1.5 px-1">
                          <div className="text-[10px] text-blue-700 font-bold">👦 الذكور</div>
                          <div className="font-black text-blue-900 tabular-nums mt-0.5">{item.maleStudents}</div>
                        </div>
                        <div className="bg-pink-50/80 border border-pink-200/80 rounded-lg py-1.5 px-1">
                          <div className="text-[10px] text-pink-700 font-bold">👧 الإناث</div>
                          <div className="font-black text-pink-900 tabular-nums mt-0.5">{item.femaleStudents}</div>
                        </div>
                        <div className="bg-purple-50/80 border border-purple-200/80 rounded-lg py-1.5 px-1">
                          <div className="text-[10px] text-purple-700 font-bold">🏅 الرياضات</div>
                          <div className="font-black text-purple-900 tabular-nums mt-0.5">{item.sportsCount}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            )}

            {/* Participation Table View */}
            {rankingViewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs min-w-[680px]">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold">
                  <tr>
                    <th className="py-3 px-4 text-center w-12">الرتبة</th>
                    <th className="py-3 px-4">المؤسسة التعليمية</th>
                    <th className="py-3 px-4">السلك</th>
                    <th className="py-3 px-4">الجماعة</th>
                    <th className="py-3 px-4 text-center font-bold text-blue-600">👦 الذكور</th>
                    <th className="py-3 px-4 text-center font-bold text-pink-600">👧 الإناث</th>
                    <th className="py-3 px-4 text-center font-black text-emerald-700">مجموع التلاميذ</th>
                    <th className="py-3 px-4 text-center font-bold text-purple-700">الرياضات المشارك بها</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {schoolParticipationRanking.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        لا توجد بيانات مشاركة مسجلة
                      </td>
                    </tr>
                  ) : (
                    schoolParticipationRanking.map((item, idx) => {
                      const rank = idx + 1;
                      return (
                        <tr key={item.schoolName} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-center font-bold text-slate-500">#{rank}</td>
                          <td className="py-3 px-4 font-bold text-slate-800">{item.schoolName}</td>
                          <td className="py-3 px-4 text-slate-500">{item.type}</td>
                          <td className="py-3 px-4 text-slate-500">{item.commune}</td>
                          <td className="py-3 px-4 text-center font-bold text-blue-700">{item.maleStudents}</td>
                          <td className="py-3 px-4 text-center font-bold text-pink-700">{item.femaleStudents}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg font-black">
                              {item.totalStudents} تلميذ(ة)
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block px-2.5 py-1 bg-purple-50 border border-purple-200 text-purple-800 rounded-lg font-bold">
                              {item.sportsCount} رياضات
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            )}
          </div>
        )}

        {/* Tab: Participation Rate by Tournament, Educational Cycle & Educational Zone (1 vs 2) */}
        {activeTab === 'tournaments_zones' && (
          <div className="p-4 sm:p-5 space-y-5 bg-slate-50/40">
            {/* Educational Zones Explanatory Legend */}
            <div className="bg-indigo-50/90 border border-indigo-200 rounded-2xl p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-xs sm:text-sm font-black text-indigo-950 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>نسب مشاركة المؤسسات في كل بطولة حسب الأسلاك التعليمية المعنية والمناطق التربوية</span>
                </h3>
                <p className="text-[11px] text-indigo-800/80 font-medium">
                  يُحسب السلك المعني تلقائياً بناءً على إعدادات كل بطولة وعدد المؤسسات المؤهلة والمشاركة فعلياً في كل منطقة تربوية.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black shrink-0">
                <span className="px-2.5 py-1 rounded-xl bg-blue-600 text-white shadow-3xs">
                  المنطقة التربوية 1: العيون سيدي ملوك • عين لحجر
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white shadow-3xs">
                  المنطقة التربوية 2: تاوريرت المركز • تنشرفي • باقي الجماعات
                </span>
              </div>
            </div>

            {tournamentParticipationByCycleAndZone.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                لا توجد بطولات مبرمجة مطابقة لمعايير التصفية الحالية
              </div>
            ) : (
              <div className="space-y-4">
                {tournamentParticipationByCycleAndZone.map(report => (
                  <div key={report.sportId} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                    {/* Championship Header */}
                    <div className="p-3.5 sm:p-4 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-xl shrink-0">
                          {report.sportIcon}
                        </span>
                        <div>
                          <h4 className="text-sm font-black text-white">
                            بطولة {report.sportName}
                          </h4>
                          <p className="text-[10px] text-slate-300 font-medium mt-0.5">
                            الأسلاك المعنية: {report.cycles.map(c => c.cycle).join(' • ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-black">
                        <span className="px-2.5 py-1 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 tabular-nums">
                          م1: {report.overall.z1Part}/{report.overall.z1Elig} ({report.overall.z1Pct}%)
                        </span>
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 tabular-nums">
                          م2: {report.overall.z2Part}/{report.overall.z2Elig} ({report.overall.z2Pct}%)
                        </span>
                        <span className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 tabular-nums shadow-xs">
                          الإجمالي: {report.overall.participating}/{report.overall.eligible} ({report.overall.pct}%)
                        </span>
                      </div>
                    </div>

                    {/* Cycle x Zone Breakdown Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-center text-xs min-w-[640px]">
                        <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 font-bold text-[11px]">
                          <tr>
                            <th className="py-2.5 px-4 text-right">السلك التعليمي المعني</th>
                            <th className="py-2.5 px-3 bg-blue-50/50 text-blue-900">
                              المنطقة التربوية 1
                              <div className="text-[9px] font-normal text-blue-700">العيون سيدي ملوك وعين لحجر</div>
                            </th>
                            <th className="py-2.5 px-3 bg-emerald-50/50 text-emerald-900">
                              المنطقة التربوية 2
                              <div className="text-[9px] font-normal text-emerald-700">تاوريرت المركز، تنشرفي وباقي الجماعات</div>
                            </th>
                            <th className="py-2.5 px-4 bg-indigo-50/50 text-indigo-950">النسبة الإجمالية بالمديرية</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {report.cycles.map(c => (
                            <tr key={`${report.sportId}-${c.cycle}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-3 px-4 text-right font-black text-slate-800">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200">
                                  <span>🎓</span>
                                  <span>{c.cycle}</span>
                                </span>
                              </td>

                              <td className="py-3 px-3 bg-blue-50/20">
                                {c.z1Elig > 0 ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="font-black text-blue-800 tabular-nums">
                                      {c.z1Pct}% <span className="text-[10px] font-semibold text-slate-500">({c.z1Part} من {c.z1Elig})</span>
                                    </span>
                                    <div className="w-24 h-1.5 bg-blue-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, c.z1Pct)}%` }} />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">لا مؤسسات معنية</span>
                                )}
                              </td>

                              <td className="py-3 px-3 bg-emerald-50/20">
                                {c.z2Elig > 0 ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="font-black text-emerald-800 tabular-nums">
                                      {c.z2Pct}% <span className="text-[10px] font-semibold text-slate-500">({c.z2Part} من {c.z2Elig})</span>
                                    </span>
                                    <div className="w-24 h-1.5 bg-emerald-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.min(100, c.z2Pct)}%` }} />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">لا مؤسسات معنية</span>
                                )}
                              </td>

                              <td className="py-3 px-4 bg-indigo-50/20">
                                <div className="flex flex-col items-center gap-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white font-black tabular-nums">
                                    {c.pct}% ({c.participating}/{c.eligible})
                                  </span>
                                  <div className="w-28 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-600 rounded-full" style={{ width: `${Math.min(100, c.pct)}%` }} />
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab: Officiating Statistics per Referee Teacher Broken Down by Sport */}
        {activeTab === 'referees' && (
          <div className="p-4 sm:p-5 space-y-4 bg-slate-50/40">
            <div className="bg-teal-50/90 border border-teal-200 rounded-2xl p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-black text-teal-950 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>إحصائيات المباريات المحكمة لكل أستاذ حكم حسب نوع الرياضة</span>
                </h3>
                <p className="text-[11px] text-teal-800/80 font-medium mt-0.5">
                  يتم احتساب جميع التعيينات التحكيمية (حكام الساحة وحكام الطاولة) بدون تكرار، مع تفصيل العدد حسب كل نوع رياضة.
                </p>
              </div>
              <span className="self-start sm:self-auto px-3 py-1 rounded-xl bg-teal-600 text-white text-xs font-black tabular-nums shrink-0">
                {refereeOfficiatingStats.length} أستاذ حكم
              </span>
            </div>

            {refereeOfficiatingStats.length === 0 ? (
              <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                لا توجد مباريات معينة لحكام مطابقة للبحث أو التصفية الحالية
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {refereeOfficiatingStats.map((refStat, idx) => (
                  <div
                    key={refStat.key}
                    className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-3 hover:border-teal-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="w-8 h-8 rounded-xl bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0 tabular-nums">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 truncate">
                            {refStat.displayName}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            {refStat.sportsBreakdown.map(sb => `${sb.count} ${sb.sportName}`).join('، ')}
                          </p>
                        </div>
                      </div>

                      <div className="text-left shrink-0">
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-900 text-white text-xs font-black tabular-nums">
                          <span>{refStat.totalMatches}</span>
                          <span>{refStat.totalMatches === 1 ? 'مباراة' : 'مباريات'}</span>
                        </span>
                        {refStat.completedMatches > 0 && (
                          <div className="text-[10px] font-bold text-emerald-700 mt-1 text-center tabular-nums">
                            منجزة: {refStat.completedMatches}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                      {refStat.sportsBreakdown.map(sb => (
                        <span
                          key={`${refStat.key}-${sb.sportId}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-bold tabular-nums"
                        >
                          <span>{sb.sportIcon}</span>
                          <span>{sb.count}</span>
                          <span>{sb.sportName}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Matches Breakdown (Opened by clicking المباريات المنجزة KPI Card or Tab) */}
        {activeTab === 'matches' && (
          <div className="p-3.5 sm:p-5 space-y-3 bg-slate-50/40">
            {(() => {
              const filteredMatches = matches.filter(m => {
                if (selectedSport !== 'ALL' && m.sportId !== selectedSport) return false;
                if (searchQuery.trim()) {
                  const q = searchQuery.trim().toLowerCase();
                  const s1 = schools.find(s => s.id === m.team1Id)?.name || m.team1Name || '';
                  const s2 = schools.find(s => s.id === m.team2Id)?.name || m.team2Name || '';
                  const v = m.venueName || '';
                  if (!s1.toLowerCase().includes(q) && !s2.toLowerCase().includes(q) && !v.toLowerCase().includes(q)) {
                    return false;
                  }
                }
                return true;
              });

              if (filteredMatches.length === 0) {
                return (
                  <div className="py-12 text-center text-slate-400 text-xs bg-white rounded-2xl border border-slate-200">
                    لا توجد مباريات مسجلة مطابقة للبحث أو التصفية الحالية
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredMatches.map((m) => {
                    const t1Name = schools.find(s => s.id === m.team1Id)?.name || m.team1Name || 'الفريق الأول';
                    const t2Name = schools.find(s => s.id === m.team2Id)?.name || m.team2Name || 'الفريق الثاني';
                    const spInfo = SPORTS_MAP[m.sportId] || { name: m.sportId || 'رياضة', icon: '🏆' };
                    const isDone = m.status === 'Completed' || (m.score1 !== undefined && m.score1 !== null && m.score2 !== undefined && m.score2 !== null);
                    const dateDisplay = m.date instanceof Date
                      ? m.date.toISOString().split('T')[0]
                      : typeof m.date === 'string'
                      ? m.date.split('T')[0]
                      : '';
                    return (
                      <div
                        key={m.id}
                        className={`p-3.5 rounded-xl border space-y-2.5 shadow-2xs ${
                          isDone ? 'bg-emerald-50/40 border-emerald-200' : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="inline-flex items-center gap-1 font-black text-slate-700">
                            <span>{spInfo.icon}</span>
                            <span>{spInfo.name}</span>
                            {m.ageCategory && (
                              <span className="text-[10px] text-slate-500 font-bold">• {m.ageCategory}</span>
                            )}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                              isDone
                                ? 'bg-emerald-600 text-white'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {isDone ? 'منجزة ✓' : 'مبرمجة ⏳'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between gap-2 bg-white p-2.5 rounded-xl border border-slate-100 text-xs font-black text-slate-900">
                          <span className="truncate flex-1">{t1Name}</span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white font-mono tabular-nums shrink-0">
                            {isDone ? `${m.score1 ?? 0} - ${m.score2 ?? 0}` : 'VS'}
                          </span>
                          <span className="truncate flex-1 text-left">{t2Name}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
                          {dateDisplay && (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {dateDisplay}
                            </span>
                          )}
                          {m.startTime && (
                            <span className="inline-flex items-center gap-1 tabular-nums">
                              <Clock className="w-3 h-3 text-slate-400" />
                              {m.startTime}
                            </span>
                          )}
                          {m.venueName && (
                            <span className="inline-flex items-center gap-1 truncate">
                              <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                              <span className="truncate">{m.venueName}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* Tab 3: Sports Breakdown */}
        {activeTab === 'sports' && (
          <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sportsStats.map((sport) => (
              <button
                type="button"
                key={sport.sportId}
                onClick={() => {
                  setSelectedSport(sport.sportId);
                  setActiveTab('results');
                }}
                className="text-right bg-slate-50 hover:bg-white border border-slate-200 hover:border-purple-300 hover:shadow-md rounded-xl p-4 space-y-3 transition-all cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{sport.icon}</span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{sport.name}</h4>
                      <p className="text-[10px] text-slate-400 tabular-nums">{sport.schoolsCount.size} مؤسسة مشاركة</p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg tabular-nums">
                    {sport.studentsCount} مشارك
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">👦 الذكور:</span>
                    <span className="font-bold text-blue-600 tabular-nums">{sport.maleCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">👧 الإناث:</span>
                    <span className="font-bold text-pink-600 tabular-nums">{sport.femaleCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">🏆 المباريات المبرمجة:</span>
                    <span className="font-bold text-slate-700 tabular-nums">{sport.matchesCount}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Coronation Achievements Details Modal */}
      {selectedSchoolAchievements && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto" dir="rtl">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center text-lg shadow-sm">
                  🏆
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-white leading-none">
                    سجل تتويجات وإنجازات المؤسسة
                  </h3>
                  <p className="text-[10px] text-slate-300 font-medium mt-1">
                    {selectedSchoolAchievements.schoolName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSchoolAchievements(null)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Summary Counter */}
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900">إجمالي الصعود لمنصة التتويج:</span>
                <span className="px-3 py-1 bg-indigo-600 text-white font-black text-xs rounded-lg shadow-3xs">
                  {selectedSchoolAchievements.achievements.length} تتويج(ات) 🥇🥈🥉
                </span>
              </div>

              {/* Achievements List */}
              <div className="space-y-2.5">
                {selectedSchoolAchievements.achievements.map((ach, index) => {
                  const isGold = ach.rank === 1;
                  const isSilver = ach.rank === 2;
                  const isBronze = ach.rank === 3;

                  return (
                    <div
                      key={index}
                      className={`p-3.5 rounded-xl border flex items-start gap-3.5 transition-all hover:scale-[1.01] ${
                        isGold
                          ? 'bg-amber-50/70 border-amber-200 shadow-3xs'
                          : isSilver
                          ? 'bg-slate-50/70 border-slate-200'
                          : 'bg-orange-50/70 border-orange-200'
                      }`}
                    >
                      {/* Rank Medal Indicator */}
                      <span className="text-2xl shrink-0">
                        {isGold ? '🥇' : isSilver ? '🥈' : '🥉'}
                      </span>

                      {/* Achievement details */}
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                            isGold
                              ? 'bg-amber-100 text-amber-950 border border-amber-300'
                              : isSilver
                              ? 'bg-slate-200 text-slate-900 border border-slate-300'
                              : 'bg-orange-100 text-orange-950 border border-orange-300'
                          }`}>
                            {isGold ? 'المركز الأول • الذهب' : isSilver ? 'المركز الثاني • الفضة' : 'المركز الثالث • البرونز'}
                          </span>
                          {ach.category && (
                            <span className="text-[9px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.2 rounded border border-slate-200">
                              فئة {ach.category}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-black text-slate-900 leading-normal">
                          {ach.title}
                        </h4>
                        {ach.tournamentName && (
                          <p className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                            <span>🏆</span>
                            <span>{ach.tournamentName}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectedSchoolAchievements(null)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-black text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
