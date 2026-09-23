import React, { useEffect, useState, useMemo } from 'react';
import { DataService, SPORTS_MAP, deduplicateById } from '../lib/dataService';
import { School, Match, Student, Tournament, Sport, Directorate, CrossCountryCategoryResult } from '../types';
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
  ShieldCheck
} from 'lucide-react';

export const Statistics: React.FC = () => {
  const [schools, setSchools] = useState<School[]>([]);
  const [activeDirObj, setActiveDirObj] = useState<Directorate | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [crossCountryResults, setCrossCountryResults] = useState<Record<string, CrossCountryCategoryResult>>({});
  const [loading, setLoading] = useState(true);

  // Filters
  const [activeTab, setActiveTab] = useState<'results' | 'participation' | 'sports'>('results');
  const [selectedSport, setSelectedSport] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL'); // Primary / Middle / High
  const [selectedCommune, setSelectedCommune] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

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

    const unsubscribeCC = DataService.subscribeCrossCountryResults((liveResults) => {
      if (liveResults) {
        setCrossCountryResults(liveResults);
      }
    });

    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
      window.removeEventListener('crossCountryResultsUpdated', handleCCChange);
      window.removeEventListener('dataSynchronized', handleCCChange);
      if (unsubscribeCC) unsubscribeCC();
    };
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [sList, mList, stList, tList, cfgList, activeDir, ccRes] = await Promise.all([
        DataService.getSchools(),
        DataService.getMatches(),
        DataService.getStudents(),
        DataService.getTournaments(),
        DataService.getSportsConfig(),
        DataService.getActiveDirectorate(),
        DataService.getCrossCountryResults()
      ]);

      const dirSchools = sList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      const dirMatches = mList.filter(m => !activeDirId || activeDirId === 'all' || (m.directorateId || 'taourirt') === activeDirId || (!m.directorateId && activeDirId === 'taourirt'));
      const dirStudents = stList.filter(st => (st.directorateId || 'taourirt') === activeDirId);
      const dirTournaments = tList.filter(t => (t.directorateId || 'taourirt') === activeDirId);

      setActiveDirObj(activeDir);
      setSchools(deduplicateById<School>(dirSchools));
      setMatches(dirMatches);
      setStudents(dirStudents);
      setTournaments(deduplicateById<Tournament>(dirTournaments));
      setSportsConfig(cfgList);
      if (ccRes) setCrossCountryResults(ccRes);
    } catch (e) {
      console.error('Error loading stats data:', e);
    } finally {
      setLoading(false);
    }
  };

  // Distinct communes list
  const communes = useMemo(() => {
    const set = new Set<string>();
    schools.forEach((s) => {
      if (s.commune) set.add(s.commune);
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
        type: s.type || 'إعدادي',
        commune: s.commune || 'تاوريرت',
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
        const teams = calculateTeamRankings(ccRes.podium);
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
        if (selectedCommune !== 'ALL' && item.commune !== selectedCommune) return false;
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
        type: s.type || 'إعدادي',
        commune: s.commune || 'تاوريرت',
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
          type: found?.type || 'إعدادي',
          commune: found?.commune || 'تاوريرت',
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
        if (selectedCommune !== 'ALL' && item.commune !== selectedCommune) return false;
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

    // For Cross Country: count completed race podiums
    if (map['cross_country']) {
      const ccCompletedRaces = CROSS_COUNTRY_CATEGORIES.filter(c => crossCountryResults[c.id]?.podium && crossCountryResults[c.id].podium.length > 0).length;
      map['cross_country'].matchesCount = ccCompletedRaces;
    }

    return Object.values(map).sort((a, b) => b.studentsCount - a.studentsCount);
  }, [students, matches, crossCountryResults]);

  // Total summary counts
  const summaryCounts = useMemo(() => {
    const totalStudents = students.length;
    const totalBoys = students.filter((s) => s.gender === 'Male').length;
    const totalGirls = students.filter((s) => s.gender === 'Female').length;
    const ccCompletedCount = CROSS_COUNTRY_CATEGORIES.filter(c => crossCountryResults[c.id]?.podium && crossCountryResults[c.id].podium.length > 0).length;
    const completedMatches = matches.filter((m) => m.status === 'Completed').length + ccCompletedCount;
    const totalMatchesCount = matches.length + 8; // Including 8 Cross Country races
    return {
      schools: schools.length,
      students: totalStudents,
      boys: totalBoys,
      girls: totalGirls,
      matches: totalMatchesCount,
      completedMatches,
      tournaments: tournaments.length + 1 // Including Cross Country Championship
    };
  }, [schools, students, matches, tournaments, crossCountryResults]);

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

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500">المؤسسات المشاركة</span>
            <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <SchoolIcon className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-800">{summaryCounts.schools}</h3>
          <p className="text-[10px] text-slate-400 font-medium mt-1">مؤسسة تعليمية مسجلة</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500">التلاميذ المشاركون</span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-800">{summaryCounts.students}</h3>
          <div className="flex items-center gap-2 text-[10px] font-bold mt-1">
            <span className="text-blue-600">👦 {summaryCounts.boys} ذكور</span>
            <span className="text-slate-300">|</span>
            <span className="text-pink-600">👧 {summaryCounts.girls} إناث</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500">المباريات المنجزة</span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <Trophy className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-800">
            {summaryCounts.completedMatches}{' '}
            <span className="text-xs text-slate-400 font-normal">/ {summaryCounts.matches}</span>
          </h3>
          <p className="text-[10px] text-amber-700 font-medium mt-1">
            نسبة الإنجاز:{' '}
            {summaryCounts.matches > 0
              ? Math.round((summaryCounts.completedMatches / summaryCounts.matches) * 100)
              : 0}
            %
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-500">البطولات والتخصصات</span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <Activity className="w-4 h-4" />
            </span>
          </div>
          <h3 className="text-2xl font-black text-slate-800">{sportsStats.length}</h3>
          <p className="text-[10px] text-purple-700 font-medium mt-1">
            {summaryCounts.tournaments} بطولة مبرمجة
          </p>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'results'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>ترتيب المؤسسات حسب النتائج</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('participation')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'participation'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>ترتيب المؤسسات حسب المشاركة</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sports')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shrink-0 ${
                activeTab === 'sports'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>إحصائيات التخصصات الرياضية</span>
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث باسم المؤسسة أو الجماعة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Dynamic Filters Bar */}
        <div className="p-3 bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-600 shrink-0">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>تصفية:</span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            {activeTab === 'results' && (
              <select
                value={selectedSport}
                onChange={(e) => setSelectedSport(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 w-full sm:w-auto cursor-pointer"
              >
                <option value="ALL">جميع الرياضات</option>
                {Object.entries(SPORTS_MAP).map(([id, info]) => (
                  <option key={id} value={id}>
                    {info.icon} {info.name}
                  </option>
                ))}
              </select>
            )}

            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 w-full sm:w-auto cursor-pointer"
            >
              <option value="ALL">جميع الأسلاك (ابتدائي / إعدادي / تأهيلي)</option>
              <option value="ابتدائي">السلك الابتدائي</option>
              <option value="ثانوي إعدادي">السلك الثانوي الإعدادي</option>
              <option value="ثانوي تأهيلي">السلك الثانوي التأهيلي</option>
            </select>

            <select
              value={selectedCommune}
              onChange={(e) => setSelectedCommune(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-700 w-full sm:w-auto cursor-pointer"
            >
              <option value="ALL">جميع الجماعات الترابية</option>
              {communes.map((c) => (
                <option key={c} value={c}>
                  جماعة {c}
                </option>
              ))}
            </select>
          </div>
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
                      const catTeams = res?.podium ? calculateTeamRankings(res.podium) : [];
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

            <div className="overflow-x-auto">
              <table className="w-full text-center text-xs">
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
                            <div className="flex flex-wrap gap-1 max-w-xs">
                              {item.achievements.slice(0, 3).map((ach, aIdx) => (
                                <span
                                  key={aIdx}
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                    ach.rank === 1
                                      ? 'bg-amber-50 text-amber-900 border-amber-200'
                                      : ach.rank === 2
                                      ? 'bg-slate-100 text-slate-800 border-slate-200'
                                      : 'bg-orange-50 text-orange-900 border-orange-200'
                                  }`}
                                  title={ach.title}
                                >
                                  {ach.rank === 1 ? '🥇 ' : ach.rank === 2 ? '🥈 ' : '🥉 '}
                                  {ach.title}
                                </span>
                              ))}
                              {item.achievements.length > 3 && (
                                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  +{item.achievements.length - 3} تتويجات
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 font-normal">في طور التباري</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </div>
        )}

        {/* Tab 2: Participation Ranking Table */}
        {activeTab === 'participation' && (
          <div className="overflow-x-auto">
            <table className="w-full text-center text-xs">
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

        {/* Tab 3: Sports Breakdown */}
        {activeTab === 'sports' && (
          <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sportsStats.map((sport) => (
              <div
                key={sport.sportId}
                className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3 hover:border-purple-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{sport.icon}</span>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{sport.name}</h4>
                      <p className="text-[10px] text-slate-400">{sport.schoolsCount.size} مؤسسة مشاركة</p>
                    </div>
                  </div>
                  <span className="text-xs font-black bg-purple-100 text-purple-800 px-2.5 py-1 rounded-lg">
                    {sport.studentsCount} مشارك
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-200 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">👦 الذكور:</span>
                    <span className="font-bold text-blue-600">{sport.maleCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">👧 الإناث:</span>
                    <span className="font-bold text-pink-600">{sport.femaleCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">🏆 المباريات المبرمجة:</span>
                    <span className="font-bold text-slate-700">{sport.matchesCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
