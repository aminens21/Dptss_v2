import { DrawSystemType, Match, School } from '../types';

export const TBD_TEAM_PREFIX = 'TBD::';

export function isPlaceholderTeamId(teamId?: string): boolean {
  if (!teamId) return false;
  const trimmed = teamId.trim();
  return (
    trimmed.startsWith(TBD_TEAM_PREFIX) ||
    trimmed.startsWith('الفائز من المباراة') ||
    trimmed.startsWith('متأهل') ||
    trimmed === 'TBD'
  );
}

export function makePlaceholderTeamId(label: string): string {
  const clean = label.trim();
  return clean.startsWith(TBD_TEAM_PREFIX) ? clean : `${TBD_TEAM_PREFIX}${clean}`;
}

export function stripPlaceholderPrefix(value?: string): string {
  if (!value) return '';
  return value.startsWith(TBD_TEAM_PREFIX) ? value.slice(TBD_TEAM_PREFIX.length) : value;
}

export function formatTeamDisplayName(
  teamId: string | undefined,
  fallbackName: string | undefined,
  schools: School[]
): string {
  if (teamId && isPlaceholderTeamId(teamId)) {
    return fallbackName?.trim() || stripPlaceholderPrefix(teamId);
  }
  if (teamId) {
    const sch = schools.find((s) => s.id === teamId);
    if (sch?.name) return sch.name;
  }
  if (fallbackName && fallbackName.trim()) {
    return stripPlaceholderPrefix(fallbackName.trim());
  }
  if (teamId && teamId.trim()) {
    return stripPlaceholderPrefix(teamId.trim());
  }
  return 'غير محدد';
}

export interface DrawTeamInput {
  id: string;
  name: string;
}

export interface DrawGroupInput {
  groupName: string;
  teams: DrawTeamInput[];
}

export interface DrawGenerationDefaults {
  defaultDate: string;
  defaultVenueId: string;
  defaultVenueName: string;
  defaultRefId?: string;
  defaultRefName?: string;
  initialRefIds: string[];
  initialRefNames: string[];
  schools: School[];
}

export interface GeneratedBracketMatch {
  id: string;
  stage: string;
  groupName?: string;
  drawSystem: DrawSystemType;
  drawMatchNumber: number;
  roundIndex: number;
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
  venueMode: 'school' | 'custom';
  hostSchoolId: string;
  venueId: string;
  venueName: string;
  refereeId?: string;
  refereeName?: string;
  refereeIds: string[];
  refereeNames: string[];
}

function buildVenueForMatch(
  team1Id: string,
  team2Id: string,
  defaults: DrawGenerationDefaults
): {
  venueMode: 'school' | 'custom';
  hostSchoolId: string;
  venueId: string;
  venueName: string;
} {
  const hostCandidate1 = !isPlaceholderTeamId(team1Id)
    ? defaults.schools.find((s) => s.id === team1Id)
    : undefined;
  const hostCandidate2 = !hostCandidate1 && !isPlaceholderTeamId(team2Id)
    ? defaults.schools.find((s) => s.id === team2Id)
    : undefined;
  const hostSch = hostCandidate1 || hostCandidate2;
  if (hostSch) {
    return {
      venueMode: 'school',
      hostSchoolId: hostSch.id,
      venueId: hostSch.id,
      venueName: hostSch.name
    };
  }
  return {
    venueMode: 'custom',
    hostSchoolId: '',
    venueId: defaults.defaultVenueId || 'v1',
    venueName: defaults.defaultVenueName || 'القاعة المغطاة'
  };
}

/**
 * Generates clean Berger round-robin rounds so every team plays at most once per round.
 */
function buildBergerRounds(teams: DrawTeamInput[]): Array<Array<{ t1: DrawTeamInput; t2: DrawTeamInput }>> {
  if (teams.length < 2) return [];
  const padded: Array<DrawTeamInput | null> = [...teams];
  if (padded.length % 2 === 1) {
    padded.push(null);
  }
  const n = padded.length;
  const numRounds = n - 1;
  const rounds: Array<Array<{ t1: DrawTeamInput; t2: DrawTeamInput }>> = [];
  const arr = [...padded];

  for (let r = 0; r < numRounds; r++) {
    const roundPairs: Array<{ t1: DrawTeamInput; t2: DrawTeamInput }> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i];
      const b = arr[n - 1 - i];
      if (a && b) {
        if (i === 0 && r % 2 === 1) {
          roundPairs.push({ t1: b, t2: a });
        } else {
          roundPairs.push({ t1: a, t2: b });
        }
      }
    }
    if (roundPairs.length > 0) {
      rounds.push(roundPairs);
    }
    // Rotate all elements except index 0
    const last = arr.pop();
    if (last !== undefined) {
      arr.splice(1, 0, last);
    }
  }

  return rounds;
}

export function generateRoundRobinDrawMatches(
  groups: DrawGroupInput[],
  system: 'groups_home_away' | 'groups_single',
  defaults: DrawGenerationDefaults
): GeneratedBracketMatch[] {
  const matchesList: GeneratedBracketMatch[] = [];
  let matchCounter = 1;

  groups.forEach((grp) => {
    const rounds = buildBergerRounds(grp.teams);

    // First leg (ذهاب)
    rounds.forEach((pairs, rIdx) => {
      pairs.forEach(({ t1, t2 }) => {
        const venue = buildVenueForMatch(t1.id, t2.id, defaults);
        const num = matchCounter++;
        matchesList.push({
          id: `gen-match-${num}`,
          stage:
            system === 'groups_home_away'
              ? `${grp.groupName} - ذهاب (الجولة ${rIdx + 1})`
              : `${grp.groupName} - ذهاب (الجولة ${rIdx + 1})`,
          groupName: grp.groupName,
          drawSystem: system,
          drawMatchNumber: num,
          roundIndex: rIdx,
          leg: 'first',
          team1Id: t1.id,
          team1Name: t1.name,
          team2Id: t2.id,
          team2Name: t2.name,
          date: defaults.defaultDate,
          time: `${9 + (num % 6)}:00`,
          ...venue,
          refereeId: defaults.defaultRefId,
          refereeName: defaults.defaultRefName,
          refereeIds: [...defaults.initialRefIds],
          refereeNames: [...defaults.initialRefNames]
        });
      });
    });

    // Second leg (إياب) with home/away reversed
    if (system === 'groups_home_away') {
      rounds.forEach((pairs, rIdx) => {
        pairs.forEach(({ t1, t2 }) => {
          const awayFirst = t2;
          const homeSecond = t1;
          const venue = buildVenueForMatch(awayFirst.id, homeSecond.id, defaults);
          const num = matchCounter++;
          matchesList.push({
            id: `gen-match-${num}`,
            stage: `${grp.groupName} - إياب (الجولة ${rIdx + 1})`,
            groupName: grp.groupName,
            drawSystem: system,
            drawMatchNumber: num,
            roundIndex: rounds.length + rIdx,
            leg: 'second',
            team1Id: awayFirst.id,
            team1Name: awayFirst.name,
            team2Id: homeSecond.id,
            team2Name: homeSecond.name,
            date: defaults.defaultDate,
            time: `${9 + (num % 6)}:00`,
            ...venue,
            refereeId: defaults.defaultRefId,
            refereeName: defaults.defaultRefName,
            refereeIds: [...defaults.initialRefIds],
            refereeNames: [...defaults.initialRefNames]
          });
        });
      });
    }
  });

  return matchesList;
}

type BracketSlot =
  | { kind: 'team'; team: DrawTeamInput; groupIndex: number; groupName: string }
  | BracketMatchNode;

interface BracketMatchNode {
  kind: 'match';
  tempId: string;
  left: BracketSlot;
  right: BracketSlot;
  groupIndex: number;
  groupName: string;
  isCrossGroup: boolean;
  distFromFinal: number;
  orderIndex: number;
  drawMatchNumber: number;
}

/**
 * Builds a complete single-elimination bracket inside each group and merges
 * group winners into Semi-Finals / Final so every future match (e.g. "الفائز من المباراة 1 ضد المؤسسة 4",
 * "النهائي: الفائز من المباراة 2 ضد الفائز من المباراة 3") is generated immediately.
 */
export function generateKnockoutGroupsDrawMatches(
  groups: DrawGroupInput[],
  defaults: DrawGenerationDefaults
): {
  matches: GeneratedBracketMatch[];
  byeTeams: { groupName: string; teamName: string }[];
} {
  let nodeSeq = 1;
  const allMatchNodes: BracketMatchNode[] = [];
  const byeTeams: { groupName: string; teamName: string }[] = [];

  const combineSlotsToRoot = (
    slots: BracketSlot[],
    groupIndex: number,
    groupName: string,
    isCrossGroup: boolean,
    recordByesForGroup: boolean
  ): BracketSlot | null => {
    if (slots.length === 0) return null;
    if (slots.length === 1) return slots[0];

    // Highest power of 2 strictly less than slots.length -> gives exact number of Round-1 matches so remainder is a power of 2
    const halfP = Math.pow(2, Math.floor(Math.log2(slots.length - 1)));
    const prelimCount = slots.length - halfP;

    const currentRoundNodes: BracketSlot[] = [];
    for (let i = 0; i < prelimCount; i++) {
      const left = slots[i * 2];
      const right = slots[i * 2 + 1];
      const mNode: BracketMatchNode = {
        kind: 'match',
        tempId: `node-${nodeSeq}`,
        left,
        right,
        groupIndex,
        groupName,
        isCrossGroup,
        distFromFinal: 0,
        orderIndex: nodeSeq++,
        drawMatchNumber: 0
      };
      allMatchNodes.push(mNode);
      currentRoundNodes.push(mNode);
    }

    const byeSlots = slots.slice(prelimCount * 2);
    if (recordByesForGroup && prelimCount > 0 && byeSlots.length > 0) {
      byeSlots.forEach((bs) => {
        if (bs.kind === 'team') {
          byeTeams.push({ groupName, teamName: bs.team.name });
        }
      });
    }

    let nextSlots: BracketSlot[] = [...currentRoundNodes, ...byeSlots];

    while (nextSlots.length > 1) {
      const paired: BracketSlot[] = [];
      for (let i = 0; i < nextSlots.length; i += 2) {
        const left = nextSlots[i];
        const right = nextSlots[i + 1];
        if (!right) {
          paired.push(left);
        } else {
          const mNode: BracketMatchNode = {
            kind: 'match',
            tempId: `node-${nodeSeq}`,
            left,
            right,
            groupIndex,
            groupName,
            isCrossGroup,
            distFromFinal: 0,
            orderIndex: nodeSeq++,
            drawMatchNumber: 0
          };
          allMatchNodes.push(mNode);
          paired.push(mNode);
        }
      }
      nextSlots = paired;
    }

    return nextSlots[0] || null;
  };

  const groupRoots: BracketSlot[] = [];
  groups.forEach((grp, gIdx) => {
    if (grp.teams.length === 0) return;
    const teamSlots: BracketSlot[] = grp.teams.map((t) => ({
      kind: 'team',
      team: t,
      groupIndex: gIdx,
      groupName: grp.groupName
    }));
    const root = combineSlotsToRoot(teamSlots, gIdx, grp.groupName, false, true);
    if (root) {
      if (root.kind === 'team' && groups.filter((g) => g.teams.length > 0).length > 1) {
        byeTeams.push({ groupName: grp.groupName, teamName: root.team.name });
      }
      groupRoots.push(root);
    }
  });

  let tournamentRoot: BracketSlot | null = null;
  if (groupRoots.length === 1) {
    tournamentRoot = groupRoots[0];
  } else if (groupRoots.length > 1) {
    tournamentRoot = combineSlotsToRoot(
      groupRoots,
      99,
      'الأدوار الإقصائية النهائية',
      true,
      false
    );
  }

  if (!tournamentRoot || allMatchNodes.length === 0) {
    return { matches: [], byeTeams };
  }

  // Assign distance from the Overall Final (Final = 0, Semi-Finals = 1, etc.)
  const assignDistances = (slot: BracketSlot, dist: number) => {
    if (slot.kind === 'match') {
      slot.distFromFinal = dist;
      assignDistances(slot.left, dist + 1);
      assignDistances(slot.right, dist + 1);
    }
  };
  assignDistances(tournamentRoot, 0);

  const maxDist = allMatchNodes.reduce((max, n) => Math.max(max, n.distFromFinal), 0);

  // Order matches from earliest round down to Final, ordered by group index inside each round
  const sortedNodes = [...allMatchNodes].sort((a, b) => {
    if (b.distFromFinal !== a.distFromFinal) return b.distFromFinal - a.distFromFinal;
    if (a.groupIndex !== b.groupIndex) return a.groupIndex - b.groupIndex;
    return a.orderIndex - b.orderIndex;
  });

  sortedNodes.forEach((n, idx) => {
    n.drawMatchNumber = idx + 1;
  });

  const nonEmptyGroupCount = groups.filter((g) => g.teams.length > 0).length;

  const getKnockoutStageLabel = (n: BracketMatchNode): string => {
    const prefix = `المباراة ${n.drawMatchNumber}`;
    if (n.distFromFinal === 0) {
      return `النهائي (${prefix})`;
    }
    if (n.distFromFinal === 1) {
      if (!n.isCrossGroup && nonEmptyGroupCount > 1 && n.groupName) {
        return `نصف النهائي - ${n.groupName} (${prefix})`;
      }
      return `نصف النهائي (${prefix})`;
    }
    if (n.distFromFinal === 2) {
      if (!n.isCrossGroup && nonEmptyGroupCount > 1 && n.groupName) {
        return `دور المجموعات - ${n.groupName} (${prefix})`;
      }
      return `ربع النهائي (${prefix})`;
    }
    if (!n.isCrossGroup && nonEmptyGroupCount > 1 && n.groupName) {
      return `دور المجموعات - ${n.groupName} (${prefix})`;
    }
    return `الدور التمهيدي (${prefix})`;
  };

  const resolveSlotDisplay = (
    slot: BracketSlot
  ): {
    id: string;
    name: string;
    sourceTempId?: string;
    sourceMatchNumber?: number;
    placeholder?: string;
  } => {
    if (slot.kind === 'team') {
      return {
        id: slot.team.id,
        name: slot.team.name
      };
    }
    const label = `الفائز من المباراة ${slot.drawMatchNumber}`;
    return {
      id: makePlaceholderTeamId(label),
      name: label,
      sourceTempId: `gen-match-${slot.drawMatchNumber}`,
      sourceMatchNumber: slot.drawMatchNumber,
      placeholder: label
    };
  };

  const matches: GeneratedBracketMatch[] = sortedNodes.map((n) => {
    const side1 = resolveSlotDisplay(n.left);
    const side2 = resolveSlotDisplay(n.right);
    const venue = buildVenueForMatch(side1.id, side2.id, defaults);

    return {
      id: `gen-match-${n.drawMatchNumber}`,
      stage: getKnockoutStageLabel(n),
      groupName: n.isCrossGroup ? 'الأدوار الإقصائية النهائية' : n.groupName,
      drawSystem: 'knockout_groups',
      drawMatchNumber: n.drawMatchNumber,
      roundIndex: maxDist - n.distFromFinal,
      team1Id: side1.id,
      team1Name: side1.name,
      team2Id: side2.id,
      team2Name: side2.name,
      team1SourceTempId: side1.sourceTempId,
      team2SourceTempId: side2.sourceTempId,
      team1SourceMatchNumber: side1.sourceMatchNumber,
      team2SourceMatchNumber: side2.sourceMatchNumber,
      team1Placeholder: side1.placeholder,
      team2Placeholder: side2.placeholder,
      date: defaults.defaultDate,
      time: `${9 + (n.drawMatchNumber % 6)}:00`,
      ...venue,
      refereeId: defaults.defaultRefId,
      refereeName: defaults.defaultRefName,
      refereeIds: [...defaults.initialRefIds],
      refereeNames: [...defaults.initialRefNames]
    };
  });

  return { matches, byeTeams };
}

export interface GroupStandingRow {
  rank: number;
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  hasExactTieWithPrev?: boolean;
}

export interface ComputedGroupStandings {
  groupName: string;
  systemLabel: string;
  isHomeAndAway: boolean;
  totalMatches: number;
  completedMatches: number;
  rows: GroupStandingRow[];
}

export function isKnockoutBracketMatch(m: Match): boolean {
  if (m.drawSystem === 'knockout_groups' || m.drawSystem === 'knockout') return true;
  if (m.team1SourceMatchId || m.team2SourceMatchId || m.team1SourceMatchNumber || m.team2SourceMatchNumber) {
    return true;
  }
  if (isPlaceholderTeamId(m.team1Id) || isPlaceholderTeamId(m.team2Id)) return true;
  const stage = (m.stage || '').trim();
  if (
    stage.includes('إقصاء مباشر') ||
    stage.includes('النهائي') ||
    stage.includes('نصف النهائي') ||
    stage.includes('ربع النهائي') ||
    stage.includes('المباراة النهائية')
  ) {
    // Only treat as knockout if it is not strictly a group league leg
    if (!stage.includes('ذهاب') && !stage.includes('إياب') && !stage.includes('الجولة')) {
      return true;
    }
  }
  return false;
}

/**
 * Determines whether a match requires penalty shootout resolution on a draw:
 * - Always true for EVERY match in "نظام المجموعات إقصاء مباشر"
 * - True for final knockout stages (ربع النهائي / نصف النهائي / النهائي / الترتيب)
 *   of "ذهاب وإياب" and "ذهاب فقط"
 */
export function doesMatchRequirePenaltyOnDraw(m: Match): boolean {
  if (m.drawSystem === 'knockout_groups' || m.drawSystem === 'knockout') return true;
  if (m.team1SourceMatchId || m.team2SourceMatchId || m.team1SourceMatchNumber || m.team2SourceMatchNumber) {
    return true;
  }
  const stage = (m.stage || '').trim();
  if (!stage) return false;
  if (
    stage.includes('النهائي') ||
    stage.includes('نصف النهائي') ||
    stage.includes('ربع النهائي') ||
    stage.includes('المباراة النهائية') ||
    stage.includes('مباراة الترتيب') ||
    stage.includes('الترتيب') ||
    stage.includes('إقصاء مباشر') ||
    stage.includes('الأدوار النهائية')
  ) {
    return true;
  }
  return false;
}

/**
 * Computes Group Standings for "نظام المجموعات ذهاب فقط" and "نظام المجموعات ذهاب وإياب".
 * Rules: Win = 3 pts, Draw = 1 pt, Loss = 0 pts.
 * Tie-breakers:
 *   1. Total Points DESC
 *   2. Head-to-Head among tied teams (Points -> GD -> GF across both legs if Home & Away)
 *   3. Overall Goal Difference (GD) DESC
 *   4. Overall Goals Scored (GF) DESC
 *   5. School Name ASC
 */
export function computeGroupStandings(
  matches: Match[],
  schools: School[]
): ComputedGroupStandings[] {
  const leagueMatches = matches.filter((m) => !isKnockoutBracketMatch(m));
  if (leagueMatches.length === 0) return [];

  const groupsMap = new Map<string, Match[]>();

  leagueMatches.forEach((m) => {
    let grp = (m.groupName || '').trim();
    if (!grp) {
      const stage = (m.stage || '').trim();
      const dashIdx = stage.indexOf(' - ');
      if (dashIdx > 0 && stage.slice(0, dashIdx).includes('المجموعة')) {
        grp = stage.slice(0, dashIdx).trim();
      } else if (stage.includes('المجموعة')) {
        grp = stage;
      } else {
        grp = 'المجموعة العامة';
      }
    }
    const existing = groupsMap.get(grp) || [];
    existing.push(m);
    groupsMap.set(grp, existing);
  });

  const results: ComputedGroupStandings[] = [];

  Array.from(groupsMap.entries())
    .sort(([a], [b]) => a.localeCompare(b, 'ar'))
    .forEach(([groupName, grpMatches]) => {
      const isHomeAndAway = grpMatches.some(
        (m) =>
          m.drawSystem === 'groups_home_away' ||
          m.leg === 'second' ||
          (m.stage || '').includes('إياب')
      );

      const statsMap = new Map<string, GroupStandingRow>();

      const ensureTeam = (teamId: string, fallbackName?: string) => {
        if (!teamId || isPlaceholderTeamId(teamId)) return;
        if (!statsMap.has(teamId)) {
          statsMap.set(teamId, {
            rank: 0,
            teamId,
            teamName: formatTeamDisplayName(teamId, fallbackName, schools),
            played: 0,
            won: 0,
            drawn: 0,
            lost: 0,
            gf: 0,
            ga: 0,
            gd: 0,
            points: 0
          });
        }
      };

      const officialCompletedMatches = grpMatches.filter((m) => {
        const isComp = m.status === 'Completed' && m.approvalStatus !== 'provisional';
        const validTeams =
          m.team1Id && m.team2Id && !isPlaceholderTeamId(m.team1Id) && !isPlaceholderTeamId(m.team2Id);
        return isComp && validTeams;
      });

      grpMatches.forEach((m) => {
        ensureTeam(m.team1Id, m.team1Name || m.team1SchoolName);
        ensureTeam(m.team2Id, m.team2Name || m.team2SchoolName);
      });

      officialCompletedMatches.forEach((m) => {
        const row1 = statsMap.get(m.team1Id);
        const row2 = statsMap.get(m.team2Id);
        if (!row1 || !row2) return;

        const s1 = Number(m.score1 ?? m.team1Score ?? 0);
        const s2 = Number(m.score2 ?? m.team2Score ?? 0);

        row1.played += 1;
        row2.played += 1;
        row1.gf += s1;
        row1.ga += s2;
        row2.gf += s2;
        row2.ga += s1;
        row1.gd = row1.gf - row1.ga;
        row2.gd = row2.gf - row2.ga;

        if (s1 > s2) {
          row1.won += 1;
          row1.points += 3;
          row2.lost += 1;
        } else if (s2 > s1) {
          row2.won += 1;
          row2.points += 3;
          row1.lost += 1;
        } else {
          row1.drawn += 1;
          row2.drawn += 1;
          row1.points += 1;
          row2.points += 1;
        }
      });

      const allRows = Array.from(statsMap.values());
      if (allRows.length === 0) return;

      // Compute head-to-head stats for teams tied on total points
      const pointsBuckets = new Map<number, GroupStandingRow[]>();
      allRows.forEach((row) => {
        const arr = pointsBuckets.get(row.points) || [];
        arr.push(row);
        pointsBuckets.set(row.points, arr);
      });

      const h2hScores = new Map<string, { pts: number; gd: number; gf: number }>();
      pointsBuckets.forEach((tiedRows) => {
        if (tiedRows.length < 2) return;
        const tiedSet = new Set(tiedRows.map((r) => r.teamId));
        const mini = new Map<string, { pts: number; gd: number; gf: number }>();
        tiedRows.forEach((r) => mini.set(r.teamId, { pts: 0, gd: 0, gf: 0 }));

        officialCompletedMatches.forEach((m) => {
          if (!tiedSet.has(m.team1Id) || !tiedSet.has(m.team2Id)) return;
          const s1 = Number(m.score1 ?? m.team1Score ?? 0);
          const s2 = Number(m.score2 ?? m.team2Score ?? 0);
          const m1 = mini.get(m.team1Id)!;
          const m2 = mini.get(m.team2Id)!;
          m1.gf += s1;
          m1.gd += s1 - s2;
          m2.gf += s2;
          m2.gd += s2 - s1;
          if (s1 > s2) m1.pts += 3;
          else if (s2 > s1) m2.pts += 3;
          else {
            m1.pts += 1;
            m2.pts += 1;
          }
        });

        mini.forEach((val, key) => h2hScores.set(key, val));
      });

      allRows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;

        const hA = h2hScores.get(a.teamId);
        const hB = h2hScores.get(b.teamId);
        if (hA && hB) {
          if (hB.pts !== hA.pts) return hB.pts - hA.pts;
          if (hB.gd !== hA.gd) return hB.gd - hA.gd;
          if (hB.gf !== hA.gf) return hB.gf - hA.gf;
        }

        if (b.gd !== a.gd) return b.gd - a.gd;
        if (b.gf !== a.gf) return b.gf - a.gf;
        return a.teamName.localeCompare(b.teamName, 'ar');
      });

      allRows.forEach((row, idx) => {
        row.rank = idx + 1;
        if (idx > 0) {
          const prev = allRows[idx - 1];
          const hA = h2hScores.get(row.teamId);
          const hPrev = h2hScores.get(prev.teamId);
          const sameH2H =
            (!hA && !hPrev) ||
            (hA && hPrev && hA.pts === hPrev.pts && hA.gd === hPrev.gd && hA.gf === hPrev.gf);
          if (
            prev.points === row.points &&
            sameH2H &&
            prev.gd === row.gd &&
            prev.gf === row.gf
          ) {
            row.hasExactTieWithPrev = true;
          }
        }
      });

      results.push({
        groupName,
        systemLabel: isHomeAndAway ? 'نظام المجموعات ذهاب وإياب' : 'نظام المجموعات ذهاب فقط',
        isHomeAndAway,
        totalMatches: grpMatches.length,
        completedMatches: officialCompletedMatches.length,
        rows: allRows
      });
    });

  return results;
}
