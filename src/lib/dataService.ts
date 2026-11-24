import { Tournament, Match, School, Venue, User, Referee, Student, Sport, AppNotification, RoleSidebarPermissions, Directorate, DirectorateTransferRequest, SUPER_ADMIN_EMAILS, CrossCountryCategoryResult, PodiumWinner, CustomAgeCategory, AthleticsCategoryResult, AthleticsWinner, SchoolTournamentConfirmation, SchoolWithdrawalRecord, InternalMessage, CommunicationRecipientCategory, BlockedSchedulePeriod, EducationalCycleKey, AffiliationDisplayMode, AffiliationDisplayConfig, AdministrativeCadre } from '../types';
import { INITIAL_TOURNAMENTS, INITIAL_SCHOOLS, INITIAL_VENUES, INITIAL_DIRECTORATES } from './initialData';
import { db } from '../firebase/config';
import {
  collection,
  getDocs as fbGetDocs,
  addDoc as fbAddDoc,
  doc,
  getDoc as fbGetDoc,
  updateDoc as fbUpdateDoc,
  setDoc as fbSetDoc,
  deleteDoc as fbDeleteDoc,
  Timestamp,
  serverTimestamp,
  query,
  where,
  onSnapshot as fbOnSnapshot,
  writeBatch as fbWriteBatch,
  disableNetwork,
  enableNetwork,
  arrayUnion,
  deleteField
} from 'firebase/firestore';
import { isFlexibleEmailMatch, fixTeacherFieldJumble, normalizeArabicName, normalizeArabicSearch, normalizeDateToYmd, formatMatchDate, isAmineSanoussiIdentity, normalizeCentralAdminUser } from './utils';
import { isPlaceholderTeamId, makePlaceholderTeamId } from './drawTournamentUtils';
export { normalizeDateToYmd, normalizeArabicSearch };

/**
 * Determines whether a school record belongs to Private Education (التعليم الخصوصي)
 * based on its explicit sector, flag, type, or official Moroccan school naming conventions.
 */
export function isPrivateSchoolRecord(
  s?: { name?: string; type?: string; isPrivate?: boolean; educationSector?: 'public' | 'private' } | null
): boolean {
  if (!s) return false;
  if (s.educationSector === 'private') return true;
  if (s.educationSector === 'public') return false;
  if (s.isPrivate === true) return true;
  if (s.isPrivate === false) return false;
  const rawType = (s.type || '').trim().toLowerCase();
  const rawName = (s.name || '').trim();
  const lowerName = rawName.toLowerCase();

  if (
    rawType.includes('خصوص') ||
    rawType.includes('خاص') ||
    rawType.includes('prive') ||
    rawType.includes('privé') ||
    rawType.includes('private')
  ) {
    return true;
  }

  if (
    lowerName.includes('خصوصي') ||
    lowerName.includes('الخصوصي') ||
    lowerName.includes('الخصوصية') ||
    lowerName.includes('للتعليم الخصوصي') ||
    lowerName.includes('الخاصة') ||
    lowerName.includes('للتعليم الخاص') ||
    lowerName.includes('التعليم الخاص') ||
    /(^|\s)خاص($|\s)/.test(rawName) ||
    /(^|\s)الخاص($|\s)/.test(rawName) ||
    lowerName.includes('prive') ||
    lowerName.includes('privé')
  ) {
    return true;
  }

  // In Moroccan Massar directories, private institutions start with "مؤسسة ..." / "مؤسسات ..."
  // (excluding generic placeholders or public artistic centers "مؤسسة التفتح")
  if (
    (rawName.startsWith('مؤسسة ') || rawName.startsWith('مؤسسات ')) &&
    !rawName.includes('التفتح') &&
    !rawName.includes('غير محدد') &&
    rawName !== 'مؤسسة تعليمية' &&
    !rawName.includes('عمومي')
  ) {
    return true;
  }

  return false;
}

export function getSchoolEducationSector(
  s?: { name?: string; type?: string; isPrivate?: boolean; educationSector?: 'public' | 'private' } | null
): 'public' | 'private' {
  return isPrivateSchoolRecord(s) ? 'private' : 'public';
}

export function getSchoolEducationSectorAr(
  s?: { name?: string; type?: string; isPrivate?: boolean; educationSector?: 'public' | 'private' } | 'public' | 'private' | null
): string {
  const sector = (s === 'public' || s === 'private') ? s : getSchoolEducationSector(s);
  return sector === 'private' ? 'التعليم الخصوصي' : 'التعليم العمومي';
}

/**
 * Normalizes a school's cycle strictly into one of the 4 official categories:
 * 'خصوصي' | 'تأهيلي' | 'إعدادي' | 'ابتدائي'
 * Private schools are always placed exclusively in 'خصوصي' and excluded from public cycles.
 */
export function normalizeSchoolCycleType(
  s?: { name?: string; type?: string; isPrivate?: boolean; educationSector?: 'public' | 'private' } | null
): string {
  if (!s) return 'تأهيلي';
  if (isPrivateSchoolRecord(s)) return 'خصوصي';
  const rawType = (s.type || '').trim();
  const rawName = (s.name || '').trim();
  if (rawType.includes('إعداد') || rawType.includes('اعداد')) return 'إعدادي';
  if (rawType.includes('ابتدائ')) return 'ابتدائي';
  if (rawType.includes('تأهيل') || rawType.includes('تاهيل')) return 'تأهيلي';
  if (rawName.includes('إعدادي') || rawName.includes('اعدادي') || rawName.includes('إعدادية') || rawName.includes('اعدادية')) return 'إعدادي';
  if (rawName.includes('ابتدائي') || rawName.includes('مدرسة') || rawName.includes('م.م') || rawName.includes('م/م') || rawName.includes('مجموعة مدارس')) return 'ابتدائي';
  return 'تأهيلي';
}

export function normalizeSchoolPureCycleLabel(
  s?: { name?: string; type?: string } | null
): string {
  if (!s) return 'تأهيلي';
  const rawType = (s.type || '').trim();
  const rawName = (s.name || '').trim();
  if (rawType.includes('إعداد') || rawType.includes('اعداد')) return 'إعدادي';
  if (rawType.includes('ابتدائ')) return 'ابتدائي';
  if (rawType.includes('تأهيل') || rawType.includes('تاهيل')) return 'تأهيلي';
  if (rawName.includes('إعدادي') || rawName.includes('اعدادي') || rawName.includes('إعدادية') || rawName.includes('اعدادية')) return 'إعدادي';
  if (rawName.includes('ابتدائي') || rawName.includes('مدرسة') || rawName.includes('م.م') || rawName.includes('م/م') || rawName.includes('مجموعة مدارس')) return 'ابتدائي';
  return 'تأهيلي';
}

/**
 * Checks whether the given user has authority to officially approve/homologate results:
 * - Central Admin / Super Admin: full authority across ALL sports and competitions.
 * - Technical Committee Head / Sport Manager: authority strictly for their assigned sport(s).
 * - Referees & Teachers: record provisional results only (false).
 */
export function canUserApproveSportResult(
  user?: User | null,
  sportId?: string,
  teachersList?: User[]
): boolean {
  if (!user) return false;

  const cleanEmail = (user.email || '').trim().toLowerCase();
  const isCentralOrSuper =
    user.role === 'CENTRAL_ADMIN' ||
    (user.role as string) === 'SUPER_ADMIN' ||
    user.isSuperAdmin === true ||
    SUPER_ADMIN_EMAILS.some(e => e.toLowerCase() === cleanEmail);

  if (isCentralOrSuper) return true;

  if (!sportId) return false;
  const equivalentSportIds = new Set<string>([sportId]);
  if (sportId === 'athletics' || sportId === 'track_field') {
    equivalentSportIds.add('athletics');
    equivalentSportIds.add('track_field');
  }

  const checkProfileMatchesSport = (u: Partial<User>): boolean => {
    const isHeadRole =
      !!u.isTechCommitteeHead ||
      u.role === 'SPORT_MANAGER' ||
      (u.role as string) === 'TECH_HEAD' ||
      (u.role as string) === 'TECH_COMMITTEE_HEAD';
    if (!isHeadRole) return false;
    const assigned = new Set<string>([
      ...(Array.isArray(u.techCommitteeSports) ? u.techCommitteeSports : []),
      ...(u.sportId ? [u.sportId] : [])
    ]);
    for (const eq of equivalentSportIds) {
      if (assigned.has(eq)) return true;
    }
    return false;
  };

  if (checkProfileMatchesSport(user)) return true;

  if (Array.isArray(teachersList) && teachersList.length > 0) {
    const matchedTeacher = teachersList.find(t =>
      (t.id && user.id && t.id === user.id) ||
      (t.email && cleanEmail && isFlexibleEmailMatch(t.email, cleanEmail))
    );
    if (matchedTeacher && checkProfileMatchesSport(matchedTeacher)) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether a user is assigned as a referee (field, table, or general) on a specific match.
 */
export function isUserAssignedRefereeToMatch(
  user?: User | null,
  match?: Match | null,
  refereesList?: Referee[],
  teachersList?: User[]
): boolean {
  if (!user || !match) return false;

  const stripTeacherTag = (name?: string): string =>
    (name || '').replace(/\s*\(أستاذ\)\s*/g, '').replace(/\s+/g, ' ').trim();

  const candidateIds = new Set<string>();
  const candidateNames = new Set<string>();
  const candidateEmails = new Set<string>();
  const candidatePhones = new Set<string>();

  const collectUser = (u?: Partial<User> | null) => {
    if (!u) return;
    if (u.id) candidateIds.add(String(u.id).trim());
    if (u.email) candidateEmails.add(String(u.email).trim().toLowerCase());
    if (u.phone) candidatePhones.add(String(u.phone).replace(/\s+/g, '').trim());
    const stripped = stripTeacherTag(u.fullName);
    if (stripped) candidateNames.add(normalizeArabicName(stripped));
  };

  collectUser(user);

  if (Array.isArray(teachersList)) {
    const cleanEmail = (user.email || '').trim().toLowerCase();
    teachersList.forEach(t => {
      if (
        (t.id && user.id && t.id === user.id) ||
        (t.email && cleanEmail && isFlexibleEmailMatch(t.email, cleanEmail))
      ) {
        collectUser(t);
      }
    });
  }

  if (Array.isArray(refereesList)) {
    refereesList.forEach(r => {
      const rEmail = (r.email || '').trim().toLowerCase();
      const rPhone = (r.phone || '').replace(/\s+/g, '').trim();
      const rNormName = normalizeArabicName(stripTeacherTag(r.fullName));
      const matchesUser =
        (r.id && candidateIds.has(r.id)) ||
        (r.teacherId && candidateIds.has(r.teacherId)) ||
        ((r as any).userId && candidateIds.has((r as any).userId)) ||
        (rEmail && Array.from(candidateEmails).some(em => isFlexibleEmailMatch(rEmail, em))) ||
        (rPhone && candidatePhones.has(rPhone)) ||
        (rNormName && candidateNames.has(rNormName));
      if (matchesUser) {
        if (r.id) candidateIds.add(String(r.id).trim());
        if (r.teacherId) candidateIds.add(String(r.teacherId).trim());
        if ((r as any).userId) candidateIds.add(String((r as any).userId).trim());
        if (rNormName) candidateNames.add(rNormName);
      }
    });
  }

  const rawEntries = [
    ...(Array.isArray(match.fieldReferees) ? match.fieldReferees : []),
    ...(Array.isArray(match.tableReferees) ? match.tableReferees : []),
    ...(Array.isArray(match.referees) ? match.referees : []),
    ...(match.referee1Id ? [match.referee1Id] : []),
    ...(match.referee2Id ? [match.referee2Id] : [])
  ]
    .map(v => String(v || '').trim())
    .filter(Boolean);

  for (const raw of rawEntries) {
    if (candidateIds.has(raw)) return true;
    const strippedRaw = stripTeacherTag(raw);
    const normRaw = normalizeArabicName(strippedRaw);
    if (normRaw && candidateNames.has(normRaw)) return true;

    if (Array.isArray(refereesList)) {
      const refObj = refereesList.find(
        r => r.id === raw || r.teacherId === raw || (r as any).userId === raw
      );
      if (refObj) {
        if (
          (refObj.teacherId && candidateIds.has(refObj.teacherId)) ||
          ((refObj as any).userId && candidateIds.has((refObj as any).userId)) ||
          (refObj.email && Array.from(candidateEmails).some(em => isFlexibleEmailMatch(refObj.email!, em))) ||
          (refObj.fullName && candidateNames.has(normalizeArabicName(stripTeacherTag(refObj.fullName))))
        ) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Checks whether the user is the Technical Committee Head (رئيس اللجنة التقنية) for the given sport.
 */
export function isUserTechHeadForSport(
  user?: User | null,
  sportId?: string,
  teachersList?: User[]
): boolean {
  if (!user) return false;

  const checkProfile = (u: Partial<User>): boolean => {
    const isHead =
      u.isTechCommitteeHead === true ||
      u.role === 'TECH_HEAD' ||
      (u.role as string) === 'TECH_COMMITTEE_HEAD';
    if (!isHead) return false;
    if (!sportId) return true;
    const assigned = [
      ...(Array.isArray(u.techCommitteeSports) ? u.techCommitteeSports : []),
      ...(u.sportId ? [u.sportId] : [])
    ].filter(Boolean);
    if (assigned.length === 0) {
      return u.role === 'TECH_HEAD' || (u.role as string) === 'TECH_COMMITTEE_HEAD';
    }
    return assigned.some(id => areSportIdsEquivalent(id, sportId));
  };

  if (checkProfile(user)) return true;

  if (Array.isArray(teachersList) && teachersList.length > 0) {
    const cleanEmail = (user.email || '').trim().toLowerCase();
    const matchedTeacher = teachersList.find(
      t =>
        (t.id && user.id && t.id === user.id) ||
        (t.email && cleanEmail && isFlexibleEmailMatch(t.email, cleanEmail))
    );
    if (matchedTeacher && checkProfile(matchedTeacher)) {
      return true;
    }
  }

  return false;
}

/**
 * Strict score-entry permission check:
 * ONLY referees assigned to this match OR the Technical Committee Head for this sport can enter/update match results.
 */
export function canUserEnterMatchScore(
  user?: User | null,
  match?: Match | null,
  refereesList?: Referee[],
  teachersList?: User[]
): boolean {
  if (!user || !match) return false;
  return (
    isUserTechHeadForSport(user, match.sportId, teachersList) ||
    isUserAssignedRefereeToMatch(user, match, refereesList, teachersList)
  );
}

const CLOUD_SYNC_PAUSED_KEY = 'app_cloud_sync_paused_v1';
const EXCEL_CLOUD_SYNC_QUEUE_KEY = 'taourirt_excel_pending_cloud_sync_v1';

interface ManagedSubscriptionEntry {
  attach: () => void;
  detach: () => void;
}
const activeManagedSubscriptions = new Set<ManagedSubscriptionEntry>();

export function isCloudSyncPaused(): boolean {
  try {
    return localStorage.getItem(CLOUD_SYNC_PAUSED_KEY) === 'true';
  } catch {
    return false;
  }
}

export async function setCloudSyncPaused(paused: boolean): Promise<void> {
  try {
    localStorage.setItem(CLOUD_SYNC_PAUSED_KEY, paused ? 'true' : 'false');
  } catch {}

  if (paused) {
    activeManagedSubscriptions.forEach(entry => {
      try {
        entry.detach();
      } catch {}
    });
    try {
      await disableNetwork(db);
    } catch {}
  } else {
    try {
      await enableNetwork(db);
    } catch {}
    activeManagedSubscriptions.forEach(entry => {
      try {
        entry.attach();
      } catch {}
    });
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('cloudSyncPausedChanged', { detail: { paused } }));
  }
}

// Enforce paused network state immediately on boot if previously paused by user
if (typeof window !== 'undefined' && isCloudSyncPaused()) {
  disableNetwork(db).catch(() => {});
}

function withCloudTimeout<T>(promise: Promise<T>, ms = 4000, label = 'FIRESTORE_TIMEOUT'): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms);
    promise
      .then(val => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch(err => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

async function getDocs(queryRef: any): Promise<any> {
  if (isCloudSyncPaused()) {
    throw new Error('CLOUD_SYNC_PAUSED');
  }
  const snap: any = await withCloudTimeout(fbGetDocs(queryRef), 4000);
  // Prevent stale/partial offline IndexedDB cache (during 429 Quota Exceeded) from overwriting localStorage
  if (snap && snap.metadata?.fromCache) {
    throw new Error('FIRESTORE_OFFLINE_CACHE');
  }
  return snap;
}

async function getDoc(docRef: any): Promise<any> {
  if (isCloudSyncPaused()) {
    throw new Error('CLOUD_SYNC_PAUSED');
  }
  const snap: any = await withCloudTimeout(fbGetDoc(docRef), 4000);
  if (snap && snap.metadata?.fromCache) {
    throw new Error('FIRESTORE_OFFLINE_CACHE');
  }
  return snap;
}

async function setDoc(docRef: any, data: any, options?: any): Promise<void> {
  if (isCloudSyncPaused()) {
    throw new Error('CLOUD_SYNC_PAUSED');
  }
  if (options !== undefined) {
    await withCloudTimeout(fbSetDoc(docRef, data, options), 4500);
  } else {
    await withCloudTimeout(fbSetDoc(docRef, data), 4500);
  }
}

async function addDoc(colRef: any, data: any): Promise<any> {
  if (isCloudSyncPaused()) {
    throw new Error('CLOUD_SYNC_PAUSED');
  }
  return withCloudTimeout(fbAddDoc(colRef, data), 4500);
}

async function updateDoc(docRef: any, data: any): Promise<void> {
  if (isCloudSyncPaused()) {
    throw new Error('CLOUD_SYNC_PAUSED');
  }
  await withCloudTimeout(fbUpdateDoc(docRef, data), 4500);
}

async function deleteDoc(docRef: any): Promise<void> {
  if (isCloudSyncPaused()) {
    throw new Error('CLOUD_SYNC_PAUSED');
  }
  await withCloudTimeout(fbDeleteDoc(docRef), 4500);
}

function writeBatch(dbInst: any) {
  const rawBatch = fbWriteBatch(dbInst);
  return {
    set: (ref: any, data: any, options?: any) =>
      options !== undefined ? rawBatch.set(ref, data, options) : rawBatch.set(ref, data),
    update: (ref: any, data: any) => rawBatch.update(ref, data),
    delete: (ref: any) => rawBatch.delete(ref),
    commit: async () => {
      if (isCloudSyncPaused()) {
        throw new Error('CLOUD_SYNC_PAUSED');
      }
      await withCloudTimeout(rawBatch.commit(), 5000);
    }
  };
}

function onSnapshot(target: any, onNext: (snap: any) => void, onError?: (err: any) => void): () => void {
  let innerUnsub: (() => void) | null = null;

  const entry: ManagedSubscriptionEntry = {
    attach: () => {
      if (isCloudSyncPaused() || innerUnsub) return;
      try {
        innerUnsub = fbOnSnapshot(
          target,
          (snap: any) => {
            if (isCloudSyncPaused()) return;
            // Never allow stale/partial offline IndexedDB cache snapshots to overwrite localStorage
            if (snap && snap.metadata?.fromCache) {
              return;
            }
            onNext(snap);
          },
          (err: any) => {
            if (isCloudSyncPaused()) return;
            if (onError) onError(err);
          }
        );
      } catch (err) {
        if (onError && !isCloudSyncPaused()) onError(err);
      }
    },
    detach: () => {
      if (innerUnsub) {
        try {
          innerUnsub();
        } catch {}
        innerUnsub = null;
      }
    }
  };

  activeManagedSubscriptions.add(entry);
  if (!isCloudSyncPaused()) {
    entry.attach();
  }

  return () => {
    entry.detach();
    activeManagedSubscriptions.delete(entry);
  };
}

const STORAGE_KEYS = {
  TOURNAMENTS: 'taourirt_tournaments_data',
  MATCHES: 'taourirt_matches_data',
  SCHOOLS: 'taourirt_schools_data',
  VENUES: 'taourirt_venues_data',
  DIRECTORATES: 'app_directorates_data',
  CONFIRMATIONS: 'app_school_confirmations',
  WITHDRAWALS: 'app_school_tournament_withdrawals',
  ADMINISTRATIVE_CADRES: 'taourirt_administrative_cadres'
};

// Helper to deduplicate any array of objects by id
export function deduplicateById<T extends { id?: string }>(items: T[]): T[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    if (!item) continue;
    const id = item.id;
    if (id) {
      if (!seen.has(id)) {
        seen.add(id);
        result.push(item);
      }
    } else {
      result.push(item);
    }
  }
  return result;
}

export function normalizeMatchRecord(m: Match): Match {
  const s1 = m.score1 ?? m.team1Score;
  const s2 = m.score2 ?? m.team2Score;
  const cleanRef1 = typeof m.referee1Id === 'string' ? m.referee1Id.trim() : '';
  const cleanRef2 = typeof m.referee2Id === 'string' ? m.referee2Id.trim() : '';
  const cleanLegacyRefId = typeof (m as any).refereeId === 'string' ? (m as any).refereeId.trim() : '';
  const cleanLegacyRefIds = Array.isArray((m as any).refereeIds)
    ? (m as any).refereeIds.map((r: any) => String(r || '').trim()).filter(Boolean)
    : undefined;
  return {
    ...m,
    date: normalizeDateToYmd(m.date),
    directorateId: m.directorateId || 'taourirt',
    score1: s1,
    score2: s2,
    team1Score: s1,
    team2Score: s2,
    referee1Id: cleanRef1 || undefined,
    referee2Id: cleanRef2 || undefined,
    ...(cleanLegacyRefId !== '' ? { refereeId: cleanLegacyRefId } : { refereeId: undefined }),
    ...(cleanLegacyRefIds !== undefined ? { refereeIds: cleanLegacyRefIds } : {}),
    ...(Array.isArray(m.referees)
      ? { referees: m.referees.map(r => String(r || '').trim()).filter(Boolean) }
      : {}),
    ...(Array.isArray(m.refereeNames)
      ? { refereeNames: m.refereeNames.map(r => String(r || '').trim()).filter(Boolean) }
      : {}),
    ...(Array.isArray(m.tableReferees)
      ? { tableReferees: m.tableReferees.map(r => String(r || '').trim()).filter(Boolean) }
      : {}),
    ...(Array.isArray(m.tableRefereeNames)
      ? { tableRefereeNames: m.tableRefereeNames.map(r => String(r || '').trim()).filter(Boolean) }
      : {}),
    ...(Array.isArray(m.fieldReferees)
      ? { fieldReferees: m.fieldReferees.map(r => String(r || '').trim()).filter(Boolean) }
      : {}),
    ...(Array.isArray(m.fieldRefereeNames)
      ? { fieldRefereeNames: m.fieldRefereeNames.map(r => String(r || '').trim()).filter(Boolean) }
      : {})
  };
}

export function isMatchProgramPendingApproval(match?: Partial<Match> | null): boolean {
  if (!match) return false;
  if (
    match.programApprovalStatus === 'approved' ||
    Boolean(match.programApprovedAt) ||
    Boolean(match.programApprovedBy)
  ) {
    return false;
  }
  if (match.programApprovalStatus === 'pending') return true;
  const normalizedStatus = String(match.status || 'Scheduled').trim().toLowerCase();
  return normalizedStatus !== 'completed';
}

// Helper to recursively sanitize payloads for Firestore (removes/replaces undefined with empty string, preserves FieldValues)
export function sanitizeFirestorePayload<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return "" as any;
  }
  // DO NOT mutate FieldValues, Timestamps, Dates, or primitives!
  if (
    typeof obj !== 'object' ||
    obj instanceof Date ||
    (obj as any)?._methodName !== undefined ||
    (obj as any)?.toMillis !== undefined ||
    (obj as any)?.seconds !== undefined
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeFirestorePayload(item)) as any;
  }
  const cleaned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      cleaned[key] = val === undefined || val === null ? "" : sanitizeFirestorePayload(val);
    }
  }
  return cleaned as any;
}

// Helper to recursively omit undefined keys without altering numbers/booleans/FieldValues/Timestamps/Dates
export function stripUndefinedDeep<T>(obj: T): T {
  if (obj === undefined || obj === null) {
    return obj;
  }
  if (
    typeof obj !== 'object' ||
    obj instanceof Date ||
    (obj as any)?._methodName !== undefined ||
    (obj as any)?.toMillis !== undefined ||
    (obj as any)?.seconds !== undefined
  ) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => stripUndefinedDeep(item)) as any;
  }
  const cleaned: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        cleaned[key] = stripUndefinedDeep(val);
      }
    }
  }
  return cleaned as any;
}

const PENDING_WRITES_STORAGE_KEY = 'app_pending_firestore_writes_v1';
const RECENT_DELETES_TTL_MS = 60000;
const recentDeletesMemory: Record<string, Record<string, number>> = {};

function readPendingWritesMap(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(PENDING_WRITES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePendingWritesMap(map: Record<string, string[]>) {
  try {
    localStorage.setItem(PENDING_WRITES_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

function markPendingWrite(col: string, id?: string) {
  if (!id) return;
  const map = readPendingWritesMap();
  const list = Array.isArray(map[col]) ? map[col] : [];
  if (!list.includes(id)) {
    map[col] = [...list, id];
    writePendingWritesMap(map);
  }
  if (recentDeletesMemory[col]) {
    delete recentDeletesMemory[col][id];
  }
}

function isQueuedInExcelCloudSync(col: string, id?: string): boolean {
  if (!id) return false;
  try {
    const raw = localStorage.getItem(EXCEL_CLOUD_SYNC_QUEUE_KEY);
    if (!raw) return false;
    const queue = JSON.parse(raw);
    if (!Array.isArray(queue)) return false;
    return queue.some((item: any) => item && item.col === col && item.id === id);
  } catch {
    return false;
  }
}

function clearPendingWrite(col: string, id?: string) {
  if (!id) return;
  // Never clear pending write protection while the record is still queued for tomorrow's Excel cloud sync
  if (isQueuedInExcelCloudSync(col, id)) return;
  const map = readPendingWritesMap();
  if (Array.isArray(map[col]) && map[col].includes(id)) {
    map[col] = map[col].filter(x => x !== id);
    writePendingWritesMap(map);
  }
}

function isPendingWrite(col: string, id?: string): boolean {
  if (!id) return false;
  if (isQueuedInExcelCloudSync(col, id)) return true;
  const map = readPendingWritesMap();
  return Array.isArray(map[col]) && map[col].includes(id);
}

function markRecentlyDeleted(col: string, id?: string) {
  if (!id) return;
  clearPendingWrite(col, id);
  if (!recentDeletesMemory[col]) {
    recentDeletesMemory[col] = {};
  }
  recentDeletesMemory[col][id] = Date.now();
}

function isRecentlyDeleted(col: string, id?: string): boolean {
  if (!id) return false;
  const ts = recentDeletesMemory[col]?.[id];
  if (!ts) return false;
  if (Date.now() - ts > RECENT_DELETES_TTL_MS) {
    delete recentDeletesMemory[col][id];
    return false;
  }
  return true;
}

const inMemoryCollectionCache: Record<string, any[]> = {};
let hasSyncedUsersForSchoolFilter = false;

function purgeStaleFirestoreStorageKeys(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const toDelete: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('firestore_')) {
        toDelete.push(k);
      }
    }
    toDelete.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {}
    });
  } catch {}
}

function stripLargeInlineImagesForStorage<T>(items: T[]): T[] {
  return items.map((item) => {
    if (!item || typeof item !== 'object') return item;
    const copy: any = { ...item };
    if (typeof copy.photoUrl === 'string' && copy.photoUrl.startsWith('data:image/') && copy.photoUrl.length > 2048) {
      delete copy.photoUrl;
    }
    return copy;
  });
}

function safeSetLocalJson(key: string, items: any[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    purgeStaleFirestoreStorageKeys();
    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      try {
        const compacted = stripLargeInlineImagesForStorage(items);
        localStorage.setItem(key, JSON.stringify(compacted));
      } catch (err) {
        console.warn(`Local storage quota fallback active for "${key}":`, err);
      }
    }
  }
}

// Local storage helpers with automatic deduplication, self-healing, and quota protection
function getLocal<T extends { id?: string }>(key: string, fallback: T[]): T[] {
  if (Array.isArray(inMemoryCollectionCache[key])) {
    return deduplicateById<T>(inMemoryCollectionCache[key]);
  }
  try {
    const data = localStorage.getItem(key);
    if (!data) {
      const cleanFallback = deduplicateById(fallback);
      inMemoryCollectionCache[key] = cleanFallback;
      safeSetLocalJson(key, cleanFallback);
      return cleanFallback;
    }
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) {
      const clean = deduplicateById<T>(parsed);
      inMemoryCollectionCache[key] = clean;
      if (clean.length !== parsed.length) {
        safeSetLocalJson(key, clean);
      }
      return clean;
    }
    return fallback;
  } catch {
    return deduplicateById(fallback);
  }
}

function setLocal<T extends { id?: string }>(key: string, data: T[]) {
  try {
    const clean = deduplicateById(data);
    inMemoryCollectionCache[key] = clean;
    safeSetLocalJson(key, clean);
  } catch (e) {
    console.warn("Local storage error:", e);
  }
}

function getLocalStringArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? Array.from(new Set(parsed.map(v => String(v || '').trim()).filter(Boolean)))
      : [];
  } catch {
    return [];
  }
}

function setLocalStringArray(key: string, data: string[]): void {
  try {
    const clean = Array.from(new Set((data || []).map(v => String(v || '').trim()).filter(Boolean)));
    safeSetLocalJson(key, clean);
  } catch (e) {
    console.warn("Local storage error:", e);
  }
}

// Generate a 6-character secure PIN containing uppercase, lowercase, and numbers
export function generateSecureAccessCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const BASE_SPORTS: Record<string, { name: string; icon: string }> = {
  football: { name: 'كرة القدم', icon: '⚽' },
  basketball_3x3: { name: 'كرة السلة 3 ضد 3', icon: '🏀' },
  basketball: { name: 'كرة السلة 5 ضد 5', icon: '🏀' },
  volleyball: { name: 'الكرة الطائرة', icon: '🏐' },
  cross_country: { name: 'العدو الريفي', icon: '🏃‍♂️' },
  athletics: { name: 'ألعاب القوى', icon: '🏃' },
  beach_volleyball: { name: 'الكرة الطائرة الشاطئية', icon: '🏖️' },
  mixed_volleyball: { name: 'الكرة الطائرة مختلطة', icon: '🏐' },
  handball: { name: 'كرة اليد', icon: '🤾' },
  beach_handball: { name: 'كرة اليد الشاطئية', icon: '🏖️' },
  badminton: { name: 'البادمنتون', icon: '🏸' },
  chess: { name: 'الشطرنج', icon: '♟️' },
  boxing: { name: 'الملاكمة', icon: '🥊' },
  judo: { name: 'الجيدو', icon: '🥋' },
  weightlifting: { name: 'رفع الأثقال', icon: '🏋️' },
  karate: { name: 'الكراطي', icon: '🥋' },
  rugby: { name: 'الركبي', icon: '🏉' },
  futsal: { name: 'فوتسال (داخل القاعة)', icon: '⚽' },
  table_tennis: { name: 'كرة الطاولة', icon: '🏓' }
};

export const TEAM_SPORTS_IDS = ['football', 'basketball', 'handball', 'volleyball', 'futsal', 'rugby', 'basketball_3x3', 'mixed_volleyball', 'beach_volleyball', 'beach_handball'];

export function isTeamSport(sportIdOrName: string): boolean {
  if (!sportIdOrName) return false;
  const lower = sportIdOrName.toLowerCase();
  if (TEAM_SPORTS_IDS.includes(lower)) return true;
  if (lower.includes('football') || lower.includes('basketball') || lower.includes('handball') || lower.includes('volleyball') || lower.includes('futsal') || lower.includes('rugby')) {
    return true;
  }
  const sportName = SPORTS_MAP[sportIdOrName]?.name || sportIdOrName;
  if (sportName.includes('قدم') || sportName.includes('سلة') || sportName.includes('يد') || sportName.includes('طائرة') || sportName.includes('ركبي') || sportName.includes('فوتسال')) {
    return true;
  }
  return false;
}

export function getDefaultTeamAgeCategories(season: string): CustomAgeCategory[] {
  const match = season.match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 2026;
  return [
    {
      id: 'U12',
      name: 'أقل من 12 سنة (U12)',
      yearsExpression: `${startYear - 9}/${startYear - 10}/${startYear - 11}`
    },
    {
      id: 'U15',
      name: 'أقل من 15 سنة (U15)',
      yearsExpression: `${startYear - 12}/${startYear - 13}/${startYear - 14}`
    },
    {
      id: 'U18',
      name: 'أقل من 18 سنة (U18)',
      yearsExpression: `${startYear - 15}/${startYear - 16}/${startYear - 17}`
    }
  ];
}

export const SPORTS_MAP: Record<string, { name: string; icon: string }> = {
  ...BASE_SPORTS
};

// Immediately hydrate SPORTS_MAP from cached custom sports so synchronous accesses are complete
try {
  const cachedCustomSports = localStorage.getItem('taourirt_custom_sports');
  if (cachedCustomSports) {
    const parsed = JSON.parse(cachedCustomSports);
    if (Array.isArray(parsed)) {
      parsed.forEach((s: any) => {
        if (s && s.id && s.name) {
          SPORTS_MAP[s.id] = { name: s.name, icon: s.icon || '🏆' };
        }
      });
    }
  }
} catch {
  // Ignore in SSR/test environment
}

export function normalizeCanonicalSportId(sportIdOrName?: string, sportsList?: Sport[]): string {
  const raw = String(sportIdOrName || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'track_field') return 'athletics';
  if (SPORTS_MAP[raw]) return raw === 'track_field' ? 'athletics' : raw;
  if (SPORTS_MAP[lower]) return lower === 'track_field' ? 'athletics' : lower;

  const normInput = normalizeArabicSearch(raw);
  if (normInput === 'track_field' || normInput === 'العاب القوي' || normInput === 'العاب القوى') {
    return 'athletics';
  }
  for (const [id, info] of Object.entries(SPORTS_MAP)) {
    if (normalizeArabicSearch(info.name) === normInput) {
      return id === 'track_field' ? 'athletics' : id;
    }
  }
  if (Array.isArray(sportsList)) {
    for (const sp of sportsList) {
      if (!sp) continue;
      if (String(sp.id || '').trim().toLowerCase() === lower) {
        return sp.id === 'track_field' ? 'athletics' : sp.id;
      }
      if (sp.name && normalizeArabicSearch(sp.name) === normInput) {
        return sp.id === 'track_field' ? 'athletics' : sp.id;
      }
    }
  }
  return lower;
}

export function areSportIdsEquivalent(a?: string, b?: string, sportsList?: Sport[]): boolean {
  if (!a || !b) return false;
  const rawA = String(a).trim().toLowerCase();
  const rawB = String(b).trim().toLowerCase();
  if (rawA === rawB) return true;
  const normA = normalizeCanonicalSportId(a, sportsList);
  const normB = normalizeCanonicalSportId(b, sportsList);
  return Boolean(normA && normB && normA === normB);
}

function buildAllowedSportSet(allowedSportIds?: string[] | null, sportsList?: Sport[]): Set<string> | null {
  if (!Array.isArray(allowedSportIds)) return null;
  const set = new Set<string>();
  allowedSportIds.forEach(raw => {
    const clean = String(raw || '').trim();
    if (!clean) return;
    set.add(clean.toLowerCase());
    const canonical = normalizeCanonicalSportId(clean, sportsList);
    if (canonical) {
      set.add(canonical.toLowerCase());
      if (canonical === 'athletics') set.add('track_field');
    }
  });
  return set;
}

function isSportInAllowedSet(
  sportIdOrName: string | undefined,
  allowedSet: Set<string>,
  sportsList?: Sport[]
): boolean {
  const clean = String(sportIdOrName || '').trim();
  if (!clean) return false;
  if (allowedSet.has(clean.toLowerCase())) return true;
  const canonical = normalizeCanonicalSportId(clean, sportsList);
  if (canonical && allowedSet.has(canonical.toLowerCase())) return true;
  return false;
}

function doesMatchMatchSportScope(
  m: Match,
  allowedSet: Set<string> | null,
  targetSportId: string | undefined,
  tournamentSportMap: Map<string, string>,
  sportsList?: Sport[]
): boolean {
  const parentSportId = m.tournamentId ? tournamentSportMap.get(m.tournamentId) : undefined;
  const effectiveSportId = (m.sportId && String(m.sportId).trim()) || parentSportId;
  if (allowedSet !== null) {
    if (!effectiveSportId || !isSportInAllowedSet(effectiveSportId, allowedSet, sportsList)) {
      return false;
    }
  }
  if (targetSportId) {
    if (!effectiveSportId || !areSportIdsEquivalent(effectiveSportId, targetSportId, sportsList)) {
      return false;
    }
  }
  return true;
}

export interface OfficialLogos {
  ministryLogo?: string;
  frmssLogo?: string;
  ministryLogoHeight?: number;
  frmssLogoHeight?: number;
}

export function isTrackOrCrossCountrySport(val?: string | boolean | null): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.toLowerCase().trim();
    return s === 'cross_country' || s === 'athletics' || s === 'track_field' || s.includes('cross') || s.includes('عدو') || s.includes('athlet') || s.includes('ألعاب القوى') || s.includes('العاب القوى');
  }
  return false;
}

const isCc = isTrackOrCrossCountrySport;

const parseYearsExpression = (expr: string): number[] => {
  if (!expr) return [];
  const isPost = expr.includes('بعد') || expr.includes('>') || expr.includes('+');
  const yearsMatched = Array.from(expr.matchAll(/(\d{4})/g)).map(m => parseInt(m[1], 10));
  
  if (isPost && yearsMatched.length > 0) {
    const minYear = Math.min(...yearsMatched);
    return Array.from({ length: 15 }, (_, i) => minYear + i);
  }
  
  return yearsMatched;
};

function sanitizeCustomCategoryForSport(
  cat: CustomAgeCategory,
  sportId?: string,
  season: string = '2026/2027'
): CustomAgeCategory | null {
  if (!cat || !cat.name || /^CAT_/i.test(cat.name)) return null;
  const cleanId = normalizeCategoryKey(cat.id || cat.name);
  const match = season.match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 2026;

  // Never allow U17 on team sports or Cross Country / Athletics
  if (cleanId === 'U17' && sportId && (isTeamSport(sportId) || isTrackOrCrossCountrySport(sportId))) {
    return null;
  }

  const isLegacyGenericArabic = /^(?:البراعم(?:\s+والبرعمات)?|البرعمات|الصغار(?:\s+والصغيرات)?|الصغيرات|الفتيان(?:\s+والفتيات)?|الفتيات|الشبان(?:\s+والشابات)?|الشابات)$/i.test(
    cat.name.trim()
  );

  if (sportId && isTrackOrCrossCountrySport(sportId)) {
    if (cleanId === 'U12') {
      return { ...cat, id: 'U12', name: 'البراعم والبرعمات', yearsExpression: `${startYear - 12} وما بعد` };
    }
    if (cleanId === 'U15') {
      return { ...cat, id: 'U15', name: 'الصغار والصغيرات', yearsExpression: `${startYear - 14}-${startYear - 13}` };
    }
    if (cleanId === 'U18') {
      return { ...cat, id: 'U18', name: 'الفتيان والفتيات', yearsExpression: `${startYear - 16}-${startYear - 15}` };
    }
    if (cleanId === 'U20') {
      return { ...cat, id: 'U20', name: 'الشبان والشابات', yearsExpression: `${startYear - 18}-${startYear - 17}` };
    }
  } else if (sportId && isTeamSport(sportId)) {
    if (cleanId === 'U12' && (isLegacyGenericArabic || cat.name.includes('U12'))) {
      return {
        ...cat,
        id: 'U12',
        name: 'أقل من 12 سنة (U12)',
        yearsExpression: cat.yearsExpression && !cat.yearsExpression.includes('2014') ? cat.yearsExpression : `${startYear - 9}/${startYear - 10}/${startYear - 11}`
      };
    }
    if (cleanId === 'U15' && (isLegacyGenericArabic || cat.name.includes('U15'))) {
      return {
        ...cat,
        id: 'U15',
        name: 'أقل من 15 سنة (U15)',
        yearsExpression: cat.yearsExpression || `${startYear - 12}/${startYear - 13}/${startYear - 14}`
      };
    }
    if (cleanId === 'U18' && (isLegacyGenericArabic || cat.name.includes('U18'))) {
      return {
        ...cat,
        id: 'U18',
        name: 'أقل من 18 سنة (U18)',
        yearsExpression: cat.yearsExpression || `${startYear - 15}/${startYear - 16}/${startYear - 17}`
      };
    }
  } else if (sportId) {
    if (isLegacyGenericArabic) {
      if (cleanId === 'U12') return { ...cat, id: 'U12', name: 'أقل من 12 سنة (U12)', yearsExpression: `${startYear - 9}/${startYear - 10}/${startYear - 11}` };
      if (cleanId === 'U15') return { ...cat, id: 'U15', name: 'أقل من 15 سنة (U15)', yearsExpression: `${startYear - 12}/${startYear - 13}/${startYear - 14}` };
      if (cleanId === 'U17') return { ...cat, id: 'U17', name: 'أقل من 17 سنة (U17)', yearsExpression: `${startYear - 14}/${startYear - 15}/${startYear - 16}` };
      if (cleanId === 'U18') return { ...cat, id: 'U18', name: 'أقل من 18 سنة (U18)', yearsExpression: `${startYear - 15}/${startYear - 16}/${startYear - 17}` };
      if (cleanId === 'U20') return { ...cat, id: 'U20', name: `مواليد ${startYear - 17} وما بعد`, yearsExpression: `${startYear - 17} وما بعد` };
    }
  }

  return {
    ...cat,
    id: cleanId || cat.id,
    name: /^CAT_/i.test(cat.name) ? cleanId : cat.name
  };
}

export const getAgeCategoriesForSeason = (season: string, gender?: 'Male' | 'Female', sportIdOrIsCc?: string | boolean) => {
  const match = season.match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 2026;
  const isCrossCountryOrAthletics = isTrackOrCrossCountrySport(sportIdOrIsCc);
  const isTeam = typeof sportIdOrIsCc === 'string' && isTeamSport(sportIdOrIsCc);

  // Check if we have dynamic custom age categories configured for this sport
  if (typeof sportIdOrIsCc === 'string') {
    try {
      const localSports = JSON.parse(localStorage.getItem('taourirt_sports_config') || '[]');
      const foundSport = localSports.find((s: any) => s.id === sportIdOrIsCc);
      if (foundSport && foundSport.customAgeCategories && foundSport.customAgeCategories.length > 0) {
        const sanitized = foundSport.customAgeCategories
          .map((cat: any) => sanitizeCustomCategoryForSport(cat, sportIdOrIsCc, season))
          .filter((cat: any): cat is CustomAgeCategory => Boolean(cat));
        if (sanitized.length > 0) {
          return sanitized.map((cat: CustomAgeCategory) => {
            const cleanId = normalizeCategoryKey(cat.id || cat.name);
            const years = parseYearsExpression(cat.yearsExpression);
            return {
              id: cleanId,
              name: `${cat.name}${cat.yearsExpression ? ` - مواليد ${cat.yearsExpression}` : ''}`,
              shortName: cat.name,
              years
            };
          });
        }
      }
    } catch (e) {
      console.warn("Error loading custom age categories in getAgeCategoriesForSeason:", e);
    }
  }

  if (isCrossCountryOrAthletics) {
    // العدو الريفي وألعاب القوى:
    // البراعم والبرعمات: مواليد 2014 وما بعد (...../2016/2015/2014)
    // الصغار والصغيرات: مواليد 2012-2013
    // الفتيان والفتيات: مواليد 2010-2011
    // الشبان والشابات: مواليد 2008-2009
    const u12Label = gender === 'Female' ? 'البرعمات (إناث)' : gender === 'Male' ? 'البراعم (ذكور)' : 'البراعم والبرعمات';
    const u15Label = gender === 'Female' ? 'الصغيرات (إناث)' : gender === 'Male' ? 'الصغار (ذكور)' : 'الصغار والصغيرات';
    const u18Label = gender === 'Female' ? 'الفتيات (إناث)' : gender === 'Male' ? 'الفتيان (ذكور)' : 'الفتيان والفتيات';
    const u20Label = gender === 'Female' ? 'الشابات (إناث)' : gender === 'Male' ? 'الشبان (ذكور)' : 'الشبان والشابات';

    return [
      { 
        id: 'U12', 
        name: `${u12Label} - مواليد ${startYear - 12} وما بعد`, 
        shortName: u12Label, 
        years: Array.from({ length: 15 }, (_, i) => startYear - 12 + i)
      },
      { 
        id: 'U15', 
        name: `${u15Label} - مواليد ${startYear - 14}-${startYear - 13}`, 
        shortName: u15Label, 
        years: [startYear - 14, startYear - 13] 
      },
      { 
        id: 'U18', 
        name: `${u18Label} - مواليد ${startYear - 16}-${startYear - 15}`, 
        shortName: u18Label, 
        years: [startYear - 16, startYear - 15] 
      },
      { 
        id: 'U20', 
        name: `${u20Label} - مواليد ${startYear - 18}-${startYear - 17}`, 
        shortName: u20Label, 
        years: [startYear - 18, startYear - 17] 
      }
    ];
  }

  const gTag = gender === 'Female' ? ' إناث' : gender === 'Male' ? ' ذكور' : '';
  const u12TeamLabel = `أقل من 12 سنة (U12${gTag})`;
  const u15TeamLabel = `أقل من 15 سنة (U15${gTag})`;
  const u17Label = `أقل من 17 سنة (U17${gTag})`;
  const u18TeamLabel = `أقل من 18 سنة (U18${gTag})`;
  const u20Label = gender === 'Female' ? `مواليد ${startYear - 17} وما بعد (إناث)` : gender === 'Male' ? `مواليد ${startYear - 17} وما بعد (ذكور)` : `مواليد ${startYear - 17} وما بعد`;

  if (isTeam) {
    // الألعاب الجماعية: U12 و U15 و U18 فقط (بدون U17)
    // U12: 2017/2016/2015
    // U15: 2014/2013/2012
    // U18: 2011/2010/2009
    return [
      { 
        id: 'U12', 
        name: `${u12TeamLabel} - مواليد ${startYear - 9}/${startYear - 10}/${startYear - 11}`, 
        shortName: u12TeamLabel, 
        years: [startYear - 11, startYear - 10, startYear - 9] 
      },
      { 
        id: 'U15', 
        name: `${u15TeamLabel} - مواليد ${startYear - 12}/${startYear - 13}/${startYear - 14}`, 
        shortName: u15TeamLabel, 
        years: [startYear - 14, startYear - 13, startYear - 12] 
      },
      { 
        id: 'U18', 
        name: `${u18TeamLabel} - مواليد ${startYear - 15}/${startYear - 16}/${startYear - 17}`, 
        shortName: u18TeamLabel, 
        years: [startYear - 17, startYear - 16, startYear - 15] 
      }
    ];
  } else {
    // رياضات أخرى (رفع الأثقال، الجيدو، الكراطي، الملاكمة، البادمنتون، كرة الطاولة، الشطرنج...):
    // تشمل U17 (2012/2011/2010) بالإضافة إلى U12 و U15 و U18 و (2009 وما بعد)
    return [
      { 
        id: 'U12', 
        name: `${u12TeamLabel} - مواليد ${startYear - 9}/${startYear - 10}/${startYear - 11}`, 
        shortName: u12TeamLabel, 
        years: [startYear - 11, startYear - 10, startYear - 9] 
      },
      { 
        id: 'U15', 
        name: `${u15TeamLabel} - مواليد ${startYear - 12}/${startYear - 13}/${startYear - 14}`, 
        shortName: u15TeamLabel, 
        years: [startYear - 14, startYear - 13, startYear - 12] 
      },
      { 
        id: 'U17', 
        name: `${u17Label} - مواليد ${startYear - 14}/${startYear - 15}/${startYear - 16}`, 
        shortName: u17Label, 
        years: [startYear - 16, startYear - 15, startYear - 14] 
      },
      { 
        id: 'U18', 
        name: `${u18TeamLabel} - مواليد ${startYear - 15}/${startYear - 16}/${startYear - 17}`, 
        shortName: u18TeamLabel, 
        years: [startYear - 17, startYear - 16, startYear - 15] 
      },
      { 
        id: 'U20', 
        name: u20Label, 
        shortName: u20Label, 
        years: Array.from({ length: 15 }, (_, i) => startYear - 17 + i)
      }
    ];
  }
};

export function normalizeCategoryKey(catStr: any): string {
  if (!catStr) return 'U15';
  
  const s = String(catStr).trim();
  const upper = s.toUpperCase();
  
  if (upper.includes('U12') || upper.includes('أقل من 12') || upper.includes('اقل من 12') || upper.includes('براعم') || upper.includes('برعمات')) return 'U12';
  if (upper.includes('U17') || upper.includes('أقل من 17') || upper.includes('اقل من 17')) return 'U17';
  if (upper.includes('U15') || upper.includes('أقل من 15') || upper.includes('اقل من 15') || upper.includes('صغار') || upper.includes('صغيرات')) return 'U15';
  if (upper.includes('U18') || upper.includes('أقل من 18') || upper.includes('اقل من 18') || upper.includes('فتيان') || upper.includes('فتيات')) return 'U18';
  if (upper.includes('U20') || upper.includes('شبان') || upper.includes('شابات') || upper.includes('2009 وما بعد')) return 'U20';
  if (upper === 'U12' || upper === 'U15' || upper === 'U17' || upper === 'U18' || upper === 'U20') return upper;
  
  if (/^CAT_/i.test(s) || /^cat_/i.test(s) || s.length > 8) {
    if (s.includes('12')) return 'U12';
    if (s.includes('17')) return 'U17';
    if (s.includes('18')) return 'U18';
    if (s.includes('20')) return 'U20';
    return 'U15';
  }
  
  return s;
}

export function getCategoryYearsLabel(catId: any, season: string = '2026/2027', sportIdOrIsCc?: string | boolean): string {
  const normKey = normalizeCategoryKey(catId);
  const cats = getAgeCategoriesForSeason(season, undefined, sportIdOrIsCc);
  const matched = cats.find(c => normalizeCategoryKey(c.id) === normKey);
  if (matched) {
    const parts = matched.name.split(' - ');
    if (parts.length > 1) {
      return parts[1];
    }
    return matched.name;
  }
  return normKey;
}

export function getCategoryShortName(category: any, gender?: string, sportIdOrIsCc?: string | boolean): string {
  if (!category || typeof category !== 'string') return category || '';
  const normKey = normalizeCategoryKey(category);
  const isCC = isTrackOrCrossCountrySport(sportIdOrIsCc);

  if (isCC) {
    if (normKey === 'U12') {
      if (gender === 'Female' || gender === 'إناث') return 'البرعمات';
      if (gender === 'Male' || gender === 'ذكور') return 'البراعم';
      return 'البراعم والبرعمات';
    }
    if (normKey === 'U15') {
      if (gender === 'Female' || gender === 'إناث') return 'الصغيرات';
      if (gender === 'Male' || gender === 'ذكور') return 'الصغار';
      return 'الصغار والصغيرات';
    }
    if (normKey === 'U18') {
      if (gender === 'Female' || gender === 'إناث') return 'الفتيات';
      if (gender === 'Male' || gender === 'ذكور') return 'الفتيان';
      return 'الفتيان والفتيات';
    }
    if (normKey === 'U20') {
      if (gender === 'Female' || gender === 'إناث') return 'الشابات';
      if (gender === 'Male' || gender === 'ذكور') return 'الشبان';
      return 'الشبان والشابات';
    }
  } else {
    const gSuffix = (gender === 'Female' || gender === 'إناث') ? ' إناث' : (gender === 'Male' || gender === 'ذكور') ? ' ذكور' : '';
    if (normKey === 'U12') return gSuffix ? `U12${gSuffix}` : 'أقل من 12 سنة (U12)';
    if (normKey === 'U15') return gSuffix ? `U15${gSuffix}` : 'أقل من 15 سنة (U15)';
    if (normKey === 'U17') return gSuffix ? `U17${gSuffix}` : 'أقل من 17 سنة (U17)';
    if (normKey === 'U18') return gSuffix ? `U18${gSuffix}` : 'أقل من 18 سنة (U18)';
    if (normKey === 'U20') return gSuffix ? `مواليد 2009 وما بعد (${gSuffix.trim()})` : 'مواليد 2009 وما بعد';
  }

  if (/^CAT_/i.test(category) || /^cat_/i.test(category)) {
    return isCC ? 'الصغار والصغيرات' : 'U15';
  }
  return category;
}

export interface CustomCategoryDetails {
  id: string;
  name: string;
  yearsExpression?: string;
  studentLimit?: number;
}

export function getCustomCategoryDetails(
  catId: string,
  sportId?: string,
  sportsConfigList?: any[]
): CustomCategoryDetails | null {
  if (!catId) return null;

  let sports = sportsConfigList;
  if (!sports) {
    try {
      sports = JSON.parse(localStorage.getItem('taourirt_sports_config') || '[]');
    } catch {}
  }

  if (Array.isArray(sports) && sports.length > 0) {
    const targetSports = sportId ? sports.filter((s: any) => s.id === sportId) : sports;
    for (const sport of targetSports) {
      if (sport && Array.isArray(sport.customAgeCategories)) {
        for (const c of sport.customAgeCategories) {
          if (!c || !c.name) continue;
          if (
            c.id === catId ||
            c.name === catId ||
            c.name.trim() === catId.trim() ||
            (c.id && catId && normalizeCategoryKey(c.id) === normalizeCategoryKey(catId) && normalizeCategoryKey(catId) !== 'U15')
          ) {
            const sanitized = sanitizeCustomCategoryForSport(c, sportId || sport.id);
            if (!sanitized) continue;
            return {
              id: sanitized.id || catId,
              name: sanitized.name,
              yearsExpression: sanitized.yearsExpression,
              studentLimit: (sanitized as any).studentLimit ?? c.studentLimit
            };
          }
        }
      }
    }
  }

  return null;
}

export function getCustomCategoryName(catId: string, sportId?: string, sportsConfigList?: any[]): string {
  if (!catId) return '';
  const custom = getCustomCategoryDetails(catId, sportId, sportsConfigList);
  if (custom && custom.name) {
    return custom.name;
  }
  if (['U12', 'U15', 'U17', 'U18', 'U20'].includes(normalizeCategoryKey(catId))) {
    return getCategoryShortName(catId, undefined, sportId);
  }
  return catId;
}

export function normalizeCadreToLevelKey(value?: string | null): 'Primary' | 'Middle' | 'High' | '' {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();

  if (upper === 'PRIMARY' || raw.includes('ابتدائي') || raw.includes('ابتدائ')) {
    return 'Primary';
  }
  if (
    upper === 'MIDDLE' ||
    raw.includes('إعدادي') ||
    raw.includes('اعدادي') ||
    raw.includes('أعدادي') ||
    raw.includes('الإعدادي')
  ) {
    return 'Middle';
  }
  if (
    upper === 'HIGH' ||
    upper === 'SECONDARY' ||
    raw.includes('تأهيلي') ||
    raw.includes('تاهيلي') ||
    raw.includes('التأهيلي') ||
    (raw.includes('ثانوي') && !raw.includes('إعدادي') && !raw.includes('اعدادي') && !raw.includes('أعدادي'))
  ) {
    return 'High';
  }
  return '';
}

export function inferLevelFromSchoolName(schoolName?: string | null): 'Primary' | 'Middle' | 'High' | '' {
  const name = String(schoolName || '').trim();
  if (!name) return '';
  const lower = name.toLowerCase();
  if (
    name.includes('إعدادي') ||
    name.includes('اعدادي') ||
    name.includes('أعدادي') ||
    name.includes('الإعدادي') ||
    lower.includes('college') ||
    lower.includes('collège')
  ) {
    return 'Middle';
  }
  if (
    name.includes('تأهيلي') ||
    name.includes('تاهيلي') ||
    name.includes('التأهيلي') ||
    name.includes('ثانوي') ||
    name.includes('ليسي') ||
    lower.includes('lycee') ||
    lower.includes('lycée')
  ) {
    return 'High';
  }
  if (
    name.includes('ابتدائي') ||
    name.includes('ابتدائ') ||
    name.includes('م.م') ||
    name.includes('م م') ||
    name.includes('مجموعة مدارس') ||
    name.includes('فرعية') ||
    /^مدرسة\s/.test(name) ||
    lower.includes('ecole') ||
    lower.includes('école')
  ) {
    return 'Primary';
  }
  return '';
}

export function resolveEffectiveTeacherCadre(
  userProfile?: {
    teachingCadre?: string;
    workLocation?: string;
    schoolName?: string;
    isPrivate?: boolean;
    educationSector?: 'public' | 'private';
  } | null,
  schoolObj?: {
    type?: string;
    name?: string;
    isPrivate?: boolean;
    educationSector?: 'public' | 'private';
  } | null
): 'Primary' | 'Middle' | 'High' | '' {
  // مؤسسات التعليم الخصوصي يمكن أن تتوفر على الأسلاك الثلاثة (الابتدائي + الإعدادي + التأهيلي)
  // لذلك لا يتم حصر أساتذتها في سلك واحد، وتظهر لهم جميع البطولات المفتوحة
  if (schoolObj) {
    if (isPrivateSchoolRecord(schoolObj)) return '';
    if (
      schoolObj.educationSector !== 'public' &&
      schoolObj.isPrivate !== false &&
      isPrivateSchoolRecord({
        name: userProfile?.workLocation || userProfile?.schoolName,
        type: userProfile?.teachingCadre,
        isPrivate: userProfile?.isPrivate,
        educationSector: userProfile?.educationSector
      })
    ) {
      return '';
    }
  } else if (
    isPrivateSchoolRecord({
      name: userProfile?.workLocation || userProfile?.schoolName,
      type: userProfile?.teachingCadre,
      isPrivate: userProfile?.isPrivate,
      educationSector: userProfile?.educationSector
    })
  ) {
    return '';
  }

  // 1. Trust the matched school's official educational cycle first if available
  const fromSchoolType = normalizeCadreToLevelKey(schoolObj?.type);
  if (fromSchoolType) return fromSchoolType;

  // 2. Fallback to school name inference if unambiguous
  const schoolName = schoolObj?.name || userProfile?.workLocation || userProfile?.schoolName;
  const fromSchoolName = inferLevelFromSchoolName(schoolName);

  // 3. Teacher profile teachingCadre
  const fromProfile = normalizeCadreToLevelKey(userProfile?.teachingCadre);
  if (fromSchoolName) return fromSchoolName;
  if (fromProfile) return fromProfile;

  return '';
}

export function findMatchingSchoolForTeacher(
  schools: School[],
  userOrProfile?: {
    id?: string;
    schoolId?: string;
    workLocation?: string;
    schoolName?: string;
    teachingCadre?: string;
    directorateId?: string;
  } | null
): School | undefined {
  if (!Array.isArray(schools) || schools.length === 0 || !userOrProfile) return undefined;

  const targetDirId = userOrProfile.directorateId?.trim();
  const dirScopedSchools = targetDirId
    ? schools.filter(s => !s.directorateId || s.directorateId === targetDirId)
    : schools;
  const searchPools = dirScopedSchools.length > 0 && dirScopedSchools.length < schools.length
    ? [dirScopedSchools, schools]
    : [schools];

  const targetSchoolId = String(userOrProfile.schoolId || '').trim();
  if (targetSchoolId) {
    for (const pool of searchPools) {
      const byId = pool.find(s => s.id === targetSchoolId);
      if (byId) return byId;
    }
  }

  const rawLocation = String(userOrProfile.workLocation || userOrProfile.schoolName || '').trim();
  if (!rawLocation) return undefined;

  const normTarget = normalizeArabicMatchText(rawLocation);
  const coreTarget = normalizeCoreSchoolName(rawLocation);
  const preferredCycle =
    normalizeCadreToLevelKey(userOrProfile.teachingCadre) ||
    inferLevelFromSchoolName(rawLocation);

  const pickBestCycleMatch = (candidates: School[]): School | undefined => {
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1 || !preferredCycle) return candidates[0];
    const sameCycle = candidates.find(s => {
      const schoolCycle = normalizeCadreToLevelKey(s.type) || inferLevelFromSchoolName(s.name);
      return schoolCycle === preferredCycle;
    });
    return sameCycle || candidates[0];
  };

  for (const pool of searchPools) {
    const exactMatches = pool.filter(s => normalizeArabicMatchText(s.name) === normTarget);
    if (exactMatches.length > 0) return pickBestCycleMatch(exactMatches);

    const flexibleMatches = pool.filter(s => schoolNamesMatch(s.name, rawLocation));
    if (flexibleMatches.length > 0) return pickBestCycleMatch(flexibleMatches);

    if (coreTarget && coreTarget.length >= 3) {
      const coreMatches = pool.filter(s => {
        const sCore = normalizeCoreSchoolName(s.name);
        return sCore && (sCore === coreTarget || sCore.includes(coreTarget) || coreTarget.includes(sCore));
      });
      if (coreMatches.length > 0) return pickBestCycleMatch(coreMatches);
    }
  }

  return undefined;
}

function getAllowedLevelsForAgeCategory(
  ageCategory?: string,
  sportId?: string | null
): Set<'Primary' | 'Middle' | 'High'> | null {
  if (!ageCategory) return null;
  const normCat = normalizeCategoryKey(ageCategory);
  if (normCat === 'U12') return new Set(['Primary']);
  if (normCat === 'U15') {
    return sportId === 'cross_country' ? new Set(['Primary', 'Middle']) : new Set(['Middle']);
  }
  if (normCat === 'U17') return new Set(['Middle', 'High']);
  if (normCat === 'U18') return new Set(['Middle', 'High']);
  if (normCat === 'U20') return new Set(['High']);
  return null;
}

export function parseTournamentAllowedLevels(
  tournamentLevel?: string,
  ageCategory?: string,
  sportId?: string | null
): Set<'Primary' | 'Middle' | 'High'> | 'ALL' {
  const catAllowed = getAllowedLevelsForAgeCategory(ageCategory, sportId);

  const raw = String(tournamentLevel || '').trim();
  const isExplicitAll =
    !raw || raw === 'جميع الأسلاك' || raw.includes('جميع') || raw.toUpperCase() === 'ALL';

  let parsedFromLevel: Set<'Primary' | 'Middle' | 'High'> | 'ALL' = 'ALL';
  if (!isExplicitAll) {
    const tokens = raw.split(/[,،/|]+/).map(t => t.trim()).filter(Boolean);
    const parsed = new Set<'Primary' | 'Middle' | 'High'>();
    for (const token of tokens) {
      const key = normalizeCadreToLevelKey(token);
      if (key) parsed.add(key);
    }
    if (parsed.size > 0) {
      parsedFromLevel = parsed;
    }
  }

  if (!catAllowed) return parsedFromLevel;
  if (parsedFromLevel === 'ALL') return catAllowed;

  const intersection = new Set<'Primary' | 'Middle' | 'High'>();
  parsedFromLevel.forEach(lvl => {
    if (catAllowed.has(lvl)) intersection.add(lvl);
  });
  return intersection.size > 0 ? intersection : parsedFromLevel;
}

export function isSchoolLevelAllowedForTournament(
  schoolType: string,
  tournamentLevel?: string,
  ageCategory?: string,
  sportId?: string | null
): boolean {
  const allowedLevels = parseTournamentAllowedLevels(tournamentLevel, ageCategory, sportId);
  if (allowedLevels === 'ALL') return true;

  const schoolLevelKey = normalizeCadreToLevelKey(schoolType) || inferLevelFromSchoolName(schoolType);
  if (!schoolLevelKey) return true;

  return allowedLevels.has(schoolLevelKey);
}

export function isTeacherLevelAllowedForTournament(
  teachingCadre?: string,
  tournamentLevel?: string,
  ageCategory?: string,
  sportId?: string | null
): boolean {
  const allowedLevels = parseTournamentAllowedLevels(tournamentLevel, ageCategory, sportId);
  if (allowedLevels === 'ALL') return true;
  if (!teachingCadre) return true; // Flexible fallback when no cadre/school can be determined

  const teacherLevelKey = normalizeCadreToLevelKey(teachingCadre) || inferLevelFromSchoolName(teachingCadre);
  if (!teacherLevelKey) return true;

  return allowedLevels.has(teacherLevelKey);
}

export function isCrossCountryU15OpenToPrimary(
  tournament: Pick<Tournament, 'sportId' | 'level' | 'ageCategory'>,
  sportTournaments: Pick<Tournament, 'sportId' | 'level' | 'ageCategory' | 'status'>[]
): boolean {
  if (tournament.sportId !== 'cross_country') return false;
  if (normalizeCategoryKey(tournament.ageCategory) !== 'U15') return false;
  const raw = String(tournament.level || '').trim();
  if (!raw || raw.includes('جميع') || raw.toUpperCase() === 'ALL') return true;
  const tokens = raw
    .split(/[,،/|]+/)
    .map(x => normalizeCadreToLevelKey(x.trim()))
    .filter((x): x is 'Primary' | 'Middle' | 'High' => Boolean(x));
  if (tokens.includes('Primary')) return true;
  const primaryAllowedInCc = sportTournaments.some(
    other =>
      other.sportId === 'cross_country' &&
      other.status !== 'Draft' &&
      isTeacherLevelAllowedForTournament('Primary', other.level, other.ageCategory, 'cross_country')
  );
  return primaryAllowedInCc && tokens.length === 1 && tokens[0] === 'Middle';
}

export function getCategoryLevel(categoryId: string): 'Primary' | 'Middle' | 'High' | 'Other' {
  const norm = normalizeCategoryKey(categoryId);
  if (norm === 'U12') return 'Primary';
  if (norm === 'U15') return 'Middle';
  if (norm === 'U17' || norm === 'U18' || norm === 'U20') return 'High';
  return 'Other';
}

export function isCategoryAllowedForTeacherLevel(
  cadreOrLevel?: string | null,
  categoryId?: string | null,
  sportId?: string | null
): boolean {
  const levelKey = normalizeCadreToLevelKey(cadreOrLevel) || inferLevelFromSchoolName(cadreOrLevel);
  if (!levelKey) return true;
  const normCat = normalizeCategoryKey(categoryId || '');
  if (!normCat || !['U12', 'U15', 'U17', 'U18', 'U20'].includes(normCat)) return true;

  if (levelKey === 'Primary') {
    return sportId === 'cross_country' ? (normCat === 'U12' || normCat === 'U15') : normCat === 'U12';
  }
  if (levelKey === 'Middle') return normCat === 'U15' || normCat === 'U17' || normCat === 'U18';
  if (levelKey === 'High') return normCat === 'U17' || normCat === 'U18' || normCat === 'U20';
  return true;
}

export function getTournamentLevelAr(level?: string): string {
  if (!level) return 'جميع الأسلاك';
  return level.split(',')
    .map(l => {
      const trimmed = l.trim();
      if (trimmed === 'Primary') return 'الابتدائي';
      if (trimmed === 'Middle') return 'الإعدادي';
      if (trimmed === 'High') return 'التأهيلي';
      return trimmed;
    })
    .join(' و ');
}

export function normalizeTournamentEducationSectors(
  t?: { educationSectors?: ('public' | 'private')[] | string[] } | null
): ('public' | 'private')[] {
  if (t && Array.isArray(t.educationSectors) && t.educationSectors.length > 0) {
    const valid = Array.from(
      new Set(
        t.educationSectors
          .map(x => String(x || '').trim().toLowerCase())
          .filter((x): x is 'public' | 'private' => x === 'public' || x === 'private')
      )
    );
    if (valid.length > 0) return valid;
  }
  return ['public', 'private'];
}

export function isSchoolSectorAllowedForTournament(
  schoolOrSector?: { name?: string; type?: string; isPrivate?: boolean; educationSector?: 'public' | 'private' } | 'public' | 'private' | null,
  tournament?: { educationSectors?: ('public' | 'private')[] | string[] } | null
): boolean {
  if (!tournament || !Array.isArray(tournament.educationSectors) || tournament.educationSectors.length === 0) {
    return true;
  }
  if (!schoolOrSector) return true;
  const schoolSector: 'public' | 'private' =
    (schoolOrSector === 'public' || schoolOrSector === 'private')
      ? schoolOrSector
      : getSchoolEducationSector(schoolOrSector);
  const allowed = normalizeTournamentEducationSectors(tournament);
  return allowed.includes(schoolSector);
}

export function getTournamentEducationSectorsAr(sectors?: ('public' | 'private')[] | string[]): string {
  const norm = normalizeTournamentEducationSectors({ educationSectors: sectors });
  const hasPublic = norm.includes('public');
  const hasPrivate = norm.includes('private');
  if (hasPublic && hasPrivate) return 'العمومي والخصوصي';
  if (hasPrivate) return 'التعليم الخصوصي';
  return 'التعليم العمومي';
}

export function isSchoolEligibleForTournament(params: {
  school?: School | null;
  teachingCadre?: string;
  tournament?: (Pick<Tournament, 'level' | 'educationSectors'> & { ageCategory?: string; sportId?: string }) | null;
}): boolean {
  const { school, teachingCadre, tournament } = params;
  if (!tournament) return true;
  if (school && !isSchoolSectorAllowedForTournament(school, tournament)) {
    return false;
  }
  if (school && isPrivateSchoolRecord(school)) {
    return true;
  }
  if (school?.type) {
    if (!isSchoolLevelAllowedForTournament(school.type, tournament.level, tournament.ageCategory, tournament.sportId)) {
      return false;
    }
  } else if (teachingCadre) {
    if (!isTeacherLevelAllowedForTournament(teachingCadre, tournament.level, tournament.ageCategory, tournament.sportId)) {
      return false;
    }
  }
  return true;
}

export function normalizeArabicMatchText(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

export function schoolNamesMatch(a?: string | null, b?: string | null): boolean {
  const cleanA = normalizeArabicMatchText(a);
  const cleanB = normalizeArabicMatchText(b);
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    return true;
  }
  const coreA = normalizeCoreSchoolName(a);
  const coreB = normalizeCoreSchoolName(b);
  if (coreA && coreB && coreA.length >= 2 && coreA === coreB) {
    const cycleA = inferLevelFromSchoolName(a);
    const cycleB = inferLevelFromSchoolName(b);
    if (!cycleA || !cycleB || cycleA === cycleB) {
      return true;
    }
  }
  return false;
}

const SCHOOL_PREFIX_STOPWORDS = new Set([
  'الثانويه', 'ثانويه', 'التاهيليه', 'تاهيليه', 'التاهيلي', 'تاهيلي',
  'الاعداديه', 'اعداديه', 'الاعدادي', 'اعدادي',
  'الابتدائيه', 'ابتدائيه', 'الابتدائي', 'ابتدائي',
  'مؤسسه', 'المؤسسه', 'التعليميه', 'المدرسه', 'مدرسه',
  'مجموعه', 'مدارس', 'ثانوي', 'الثانوي'
]);

export function normalizeCoreSchoolName(name?: string | null): string {
  const clean = normalizeArabicMatchText(name)
    .replace(/[.\-_/()،,]+/g, ' ')
    .replace(/^(?:م\s+م|ثا\s+ت|ثا\s+اع)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean) return '';
  const tokens = clean.split(' ').filter(tok => tok && !SCHOOL_PREFIX_STOPWORDS.has(tok));
  return tokens.join(' ').trim();
}

export function isSchoolRepresentedInTeachers(school: School, teachersList: User[]): boolean {
  if (!school) return false;
  const schoolCycle = normalizeSchoolCycleType(school);
  // Only restrict public Secondary Qualifying (تأهيلي) and Middle (إعدادي) schools
  if (schoolCycle !== 'تأهيلي' && schoolCycle !== 'إعدادي') {
    return true;
  }

  const schoolDirId = school.directorateId || 'taourirt';
  const dirTeachers = (teachersList || []).filter(t => {
    if (!t) return false;
    if (t.role && t.role !== 'TEACHER') return false;
    return (t.directorateId || 'taourirt') === schoolDirId;
  });

  const assignedTeachers = dirTeachers.filter(t =>
    Boolean(
      (t.workLocation && t.workLocation.trim()) ||
      (t.schoolId && t.schoolId.trim()) ||
      ((t as any).schoolName && String((t as any).schoolName).trim())
    )
  );

  // Safety guard: never drop schools if teachers with assigned schools have not been loaded yet
  if (assignedTeachers.length === 0) {
    return true;
  }

  const fullSchoolClean = normalizeArabicMatchText(school.name);
  const coreSchool = normalizeCoreSchoolName(school.name);

  return assignedTeachers.some(t => {
    if (t.schoolId && school.id && t.schoolId.trim() === school.id.trim()) {
      return true;
    }

    const tLocRaw = (t.workLocation || (t as any).schoolName || '').trim();
    if (!tLocRaw) return false;

    const tLocNorm = normalizeArabicMatchText(tLocRaw);
    const tExplicitMiddle = tLocNorm.includes('اعداد');
    const tExplicitHigh = tLocNorm.includes('تاهيل') || (tLocNorm.includes('ثانويه') && !tExplicitMiddle);

    if (schoolCycle === 'تأهيلي' && tExplicitMiddle) return false;
    if (schoolCycle === 'إعدادي' && tExplicitHigh) return false;

    if (!tExplicitMiddle && !tExplicitHigh && t.teachingCadre) {
      if (schoolCycle === 'تأهيلي' && t.teachingCadre !== 'HIGH') return false;
      if (schoolCycle === 'إعدادي' && t.teachingCadre !== 'MIDDLE') return false;
    }

    if (fullSchoolClean && tLocNorm && fullSchoolClean === tLocNorm) {
      return true;
    }

    const coreTeacher = normalizeCoreSchoolName(tLocRaw);
    if (coreSchool.length >= 2 && coreTeacher.length >= 2 && coreSchool === coreTeacher) {
      return true;
    }

    if (
      coreSchool.length >= 4 &&
      coreTeacher.length >= 4 &&
      (coreSchool.includes(coreTeacher) || coreTeacher.includes(coreSchool))
    ) {
      return true;
    }

    return false;
  });
}

export function filterSchoolsRestrictedByTeachers(schoolsList: School[], usersList: User[]): School[] {
  if (!Array.isArray(schoolsList) || schoolsList.length === 0) return [];
  const teachersOnly = (usersList || []).filter(u => !u.role || u.role === 'TEACHER');
  if (teachersOnly.length === 0) return schoolsList;
  return schoolsList.filter(s => isSchoolRepresentedInTeachers(s, teachersOnly));
}

function stripCoachHonorifics(name?: string | null): string {
  let clean = normalizeArabicMatchText(name);
  if (!clean) return '';
  clean = clean
    .replace(/^(?:الاستاذه|الاستاذ|استاذه|استاذ|ذ\.|ذ\/|ذ\s+|ا\.|ا\/|prof\.?|mr\.?|mme\.?)\s*/i, '')
    .replace(/[.\-_/()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return clean;
}

export function coachNamesMatch(a?: string | null, b?: string | null): boolean {
  const cleanA = stripCoachHonorifics(a);
  const cleanB = stripCoachHonorifics(b);
  if (!cleanA || !cleanB) return false;
  if (cleanA === cleanB || cleanA.includes(cleanB) || cleanB.includes(cleanA)) {
    return true;
  }
  const compactA = normalizeArabicName(cleanA);
  const compactB = normalizeArabicName(cleanB);
  if (!compactA || !compactB) return false;
  return compactA === compactB || (compactA.length >= 6 && compactB.length >= 6 && (compactA.includes(compactB) || compactB.includes(compactA)));
}

export interface ResolvedSchoolCoach {
  fullName: string;
  leaseNumber: string;
  phone: string;
  workLocation: string;
  photoUrl?: string;
  source: 'student' | 'confirmation' | 'teacher' | 'school' | 'currentUser' | 'none';
}

export function resolveSchoolCoach(params: {
  schoolName?: string;
  sportId?: string;
  category?: string;
  gender?: string;
  affiliationType?: string;
  students?: Student[];
  schools?: School[];
  teachers?: User[];
  confirmations?: SchoolTournamentConfirmation[];
  currentUser?: User | null;
}): ResolvedSchoolCoach {
  const {
    schoolName = '',
    sportId,
    category,
    gender,
    affiliationType,
    students = [],
    schools = [],
    teachers = [],
    confirmations = [],
    currentUser
  } = params;

  const cleanSchool = schoolName.trim();
  const matchedSchool = cleanSchool
    ? schools.find(s => schoolNamesMatch(s.name, cleanSchool) || s.id === cleanSchool)
    : undefined;

  const currentUserInTeachers = currentUser
    ? teachers.find(
        u =>
          (currentUser.id && u.id === currentUser.id) ||
          (currentUser.email && u.email && isFlexibleEmailMatch(u.email, currentUser.email)) ||
          (currentUser.leaseNumber && u.leaseNumber && u.leaseNumber.trim() === currentUser.leaseNumber.trim())
      )
    : undefined;

  const effectiveCurrentUser = currentUser
    ? {
        ...currentUserInTeachers,
        ...currentUser,
        workLocation: currentUser.workLocation || currentUserInTeachers?.workLocation || '',
        schoolId: currentUser.schoolId || currentUserInTeachers?.schoolId || '',
        leaseNumber: currentUser.leaseNumber || currentUserInTeachers?.leaseNumber || '',
        phone: currentUser.phone || currentUserInTeachers?.phone || '',
        photoUrl:
          (currentUser.photoUrl && currentUser.photoUrl.trim()) ||
          (currentUserInTeachers?.photoUrl && currentUserInTeachers.photoUrl.trim()) ||
          undefined
      }
    : null;

  const isUserFromTargetSchool = Boolean(
    effectiveCurrentUser &&
      cleanSchool &&
      (schoolNamesMatch(effectiveCurrentUser.workLocation, cleanSchool) ||
        schoolNamesMatch((effectiveCurrentUser as any).schoolName, cleanSchool) ||
        (matchedSchool?.id && effectiveCurrentUser.schoolId === matchedSchool.id))
  );

  const filterSchoolStudents = students.filter(st => {
    if (!st) return false;
    if (!cleanSchool) return true;
    return (
      schoolNamesMatch(st.schoolName, cleanSchool) ||
      (matchedSchool?.id && st.schoolId === matchedSchool.id)
    );
  });

  const enrichFromUsers = (
    name: string,
    lease?: string,
    phone?: string,
    userId?: string
  ): { fullName: string; leaseNumber: string; phone: string; photoUrl?: string } => {
    const cleanName = (name || '').trim();
    const cleanLease = (lease || '').trim();
    const cleanPhone = (phone || '').trim();

    const findBestUser = (predicate: (u: User) => boolean): User | undefined => {
      const matches = teachers.filter(predicate);
      if (matches.length === 0) return undefined;
      return matches.find(u => Boolean(u.photoUrl && u.photoUrl.trim())) || matches[0];
    };

    const matchedUser =
      (userId ? findBestUser(u => u.id === userId) : undefined) ||
      (cleanLease
        ? findBestUser(u => Boolean(u.leaseNumber && u.leaseNumber.trim() === cleanLease))
        : undefined) ||
      (cleanName
        ? findBestUser(
            u =>
              Boolean(u.fullName) &&
              (!cleanSchool ||
                !u.workLocation ||
                schoolNamesMatch(u.workLocation, cleanSchool) ||
                Boolean(matchedSchool?.id && u.schoolId === matchedSchool.id)) &&
              coachNamesMatch(u.fullName, cleanName)
          )
        : undefined) ||
      (cleanName
        ? findBestUser(u => Boolean(u.fullName) && coachNamesMatch(u.fullName, cleanName))
        : undefined);

    const matchesCurrentUser = Boolean(
      effectiveCurrentUser &&
        ((userId && effectiveCurrentUser.id === userId) ||
          (cleanLease &&
            effectiveCurrentUser.leaseNumber &&
            effectiveCurrentUser.leaseNumber.trim() === cleanLease) ||
          (cleanName &&
            effectiveCurrentUser.fullName &&
            coachNamesMatch(effectiveCurrentUser.fullName, cleanName)))
    );

    const resolvedPhoto =
      (matchedUser?.photoUrl && matchedUser.photoUrl.trim()) ||
      (matchesCurrentUser && effectiveCurrentUser?.photoUrl ? effectiveCurrentUser.photoUrl : undefined);

    return {
      fullName: cleanName || matchedUser?.fullName?.trim() || '',
      leaseNumber: cleanLease || matchedUser?.leaseNumber?.trim() || '',
      phone: cleanPhone || matchedUser?.phone?.trim() || '',
      photoUrl: resolvedPhoto || undefined
    };
  };

  const normBranchCat = category && category !== 'ALL' ? normalizeCategoryKey(category) : undefined;
  const normBranchGen = gender && gender !== 'ALL' && gender !== 'Both' && gender !== 'Mixed' ? gender : undefined;
  const normBranchAff = affiliationType && affiliationType !== 'ALL' ? affiliationType : undefined;

  // 0. Exact branch match on student records or confirmation.branchTeachers
  if (normBranchCat || normBranchGen || normBranchAff) {
    const exactBranchStudent = filterSchoolStudents.find(s => {
      if (!s.coachName || !s.coachName.trim()) return false;
      if (sportId && s.sportId !== sportId) return false;
      if (normBranchCat && normalizeCategoryKey(s.category) !== normBranchCat) return false;
      if (normBranchGen && s.gender && s.gender.toLowerCase() !== normBranchGen.toLowerCase()) return false;
      if (normBranchAff && (s.affiliationType || 'non_club') !== normBranchAff) return false;
      return true;
    });
    if (exactBranchStudent) {
      const enriched = enrichFromUsers(
        exactBranchStudent.coachName || '',
        exactBranchStudent.coachLeaseNumber,
        exactBranchStudent.coachPhone
      );
      if (enriched.fullName) {
        return {
          ...enriched,
          workLocation: cleanSchool || matchedSchool?.name || '',
          source: 'student'
        };
      }
    }
  }

  // 1. Explicit coach recorded on participating students of this school (prefer matching sport)
  const sportStudentsWithCoach = filterSchoolStudents.filter(
    s => s.coachName && s.coachName.trim() !== '' && (!sportId || s.sportId === sportId)
  );
  const anyStudentsWithCoach =
    sportStudentsWithCoach.length > 0
      ? sportStudentsWithCoach
      : filterSchoolStudents.filter(s => s.coachName && s.coachName.trim() !== '');

  if (anyStudentsWithCoach.length > 0) {
    const first = anyStudentsWithCoach[0];
    const enriched = enrichFromUsers(
      first.coachName || '',
      first.coachLeaseNumber,
      first.coachPhone
    );
    if (enriched.fullName) {
      return {
        ...enriched,
        workLocation: cleanSchool || matchedSchool?.name || '',
        source: 'student'
      };
    }
  }

  // 2. Active confirmation record for this school (prefer matching branchTeachers, then sport)
  const matchingConfs = confirmations.filter(
    c =>
      c &&
      c.status === 'confirmed' &&
      (schoolNamesMatch(c.schoolName, cleanSchool) ||
        (matchedSchool?.id && c.schoolId === matchedSchool.id))
  );
  const targetConf =
    (sportId ? matchingConfs.find(c => c.sportId === sportId && Boolean(c.teacherName?.trim())) : undefined) ||
    matchingConfs.find(c => Boolean(c.teacherName?.trim()));

  if (targetConf && targetConf.branchTeachers && (normBranchCat || normBranchGen || normBranchAff)) {
    const btEntry = Object.entries(targetConf.branchTeachers).find(([bKey, info]) => {
      if (!info || !info.teacherName?.trim()) return false;
      const [aff, cat, gen] = bKey.split('__');
      if (normBranchAff && aff !== normBranchAff) return false;
      if (normBranchCat && normalizeCategoryKey(cat) !== normBranchCat) return false;
      if (normBranchGen && gen && gen.toLowerCase() !== normBranchGen.toLowerCase()) return false;
      return true;
    });
    if (btEntry) {
      const info = btEntry[1];
      const enriched = enrichFromUsers(
        info.teacherName,
        info.teacherLeaseNumber,
        info.teacherPhone,
        info.teacherId
      );
      if (enriched.fullName) {
        return {
          ...enriched,
          workLocation: cleanSchool || matchedSchool?.name || '',
          source: 'confirmation'
        };
      }
    }
  }

  if (targetConf && targetConf.teacherName?.trim()) {
    const enriched = enrichFromUsers(
      targetConf.teacherName,
      targetConf.teacherLeaseNumber,
      targetConf.teacherPhone,
      targetConf.teacherId
    );
    if (enriched.fullName) {
      return {
        ...enriched,
        workLocation: cleanSchool || matchedSchool?.name || '',
        source: 'confirmation'
      };
    }
  }

  // 3. Fallback to currentUser ONLY if currentUser actually belongs to target school
  if (isUserFromTargetSchool && effectiveCurrentUser?.fullName?.trim()) {
    return {
      fullName: effectiveCurrentUser.fullName.trim(),
      leaseNumber: (effectiveCurrentUser.leaseNumber || '').trim(),
      phone: (effectiveCurrentUser.phone || '').trim(),
      workLocation: cleanSchool || effectiveCurrentUser.workLocation || '',
      photoUrl: effectiveCurrentUser.photoUrl || undefined,
      source: 'currentUser'
    };
  }

  return {
    fullName: '',
    leaseNumber: '',
    phone: '',
    workLocation: cleanSchool || matchedSchool?.name || '',
    source: 'none'
  };
}


export function getCategoryGenderLabel(category: any, gender?: string, season: string = '2026/2027', sportIdOrIsCc?: string | boolean): string {
  if (!category || typeof category !== 'string') return category || '';
  const normKey = normalizeCategoryKey(category);
  const yearsMatch = (season || '').match(/\d{4}/g);
  const startYear = yearsMatch && yearsMatch.length > 0 ? parseInt(yearsMatch[0], 10) : 2026;
  const isCrossCountryOrAthletics = isTrackOrCrossCountrySport(sportIdOrIsCc);

  if (isCrossCountryOrAthletics) {
    const u12Years = ` - مواليد ${startYear - 12} وما بعد`;
    const u15Years = ` - مواليد ${startYear - 14}-${startYear - 13}`;
    const u18Years = ` - مواليد ${startYear - 16}-${startYear - 15}`;
    const u20Years = ` - مواليد ${startYear - 18}-${startYear - 17}`;

    if (normKey === 'U12') {
      if (gender === 'Female' || gender === 'إناث') return `البرعمات (إناث)${u12Years}`;
      if (gender === 'Male' || gender === 'ذكور') return `البراعم (ذكور)${u12Years}`;
      return `البراعم والبرعمات${u12Years}`;
    }
    if (normKey === 'U15') {
      if (gender === 'Female' || gender === 'إناث') return `الصغيرات (إناث)${u15Years}`;
      if (gender === 'Male' || gender === 'ذكور') return `الصغار (ذكور)${u15Years}`;
      return `الصغار والصغيرات${u15Years}`;
    }
    if (normKey === 'U18') {
      if (gender === 'Female' || gender === 'إناث') return `الفتيات (إناث)${u18Years}`;
      if (gender === 'Male' || gender === 'ذكور') return `الفتيان (ذكور)${u18Years}`;
      return `الفتيان والفتيات${u18Years}`;
    }
    if (normKey === 'U20') {
      if (gender === 'Female' || gender === 'إناث') return `الشابات (إناث)${u20Years}`;
      if (gender === 'Male' || gender === 'ذكور') return `الشبان (ذكور)${u20Years}`;
      return `الشبان والشابات${u20Years}`;
    }
    if (/^CAT_/i.test(category) || /^cat_/i.test(category)) {
      return `الصغار والصغيرات${u15Years}`;
    }
    return category;
  }

  const gSuffix = (gender === 'Female' || gender === 'إناث') ? ' إناث' : (gender === 'Male' || gender === 'ذكور') ? ' ذكور' : '';
  const u12Years = ` - مواليد ${startYear - 9}/${startYear - 10}/${startYear - 11}`;
  const u15Years = ` - مواليد ${startYear - 12}/${startYear - 13}/${startYear - 14}`;
  const u17Years = ` - مواليد ${startYear - 14}/${startYear - 15}/${startYear - 16}`;
  const u18Years = ` - مواليد ${startYear - 15}/${startYear - 16}/${startYear - 17}`;
  const u20Years = `مواليد ${startYear - 17} وما بعد${gSuffix ? ` (${gSuffix.trim()})` : ''}`;

  if (normKey === 'U12') return `أقل من 12 سنة (U12${gSuffix})${u12Years}`;
  if (normKey === 'U15') return `أقل من 15 سنة (U15${gSuffix})${u15Years}`;
  if (normKey === 'U17') return `أقل من 17 سنة (U17${gSuffix})${u17Years}`;
  if (normKey === 'U18') return `أقل من 18 سنة (U18${gSuffix})${u18Years}`;
  if (normKey === 'U20') return u20Years;
  if (/^CAT_/i.test(category) || /^cat_/i.test(category)) {
    return `أقل من 15 سنة (U15${gSuffix})${u15Years}`;
  }
  return category;
}

export interface BirthDateValidationResult {
  isValid: boolean;
  birthYear?: number;
  expectedYearsText?: string;
  errorMessage?: string;
  categoryLabel?: string;
}

export function validateBirthDateForCategory(
  birthDate: string,
  category: any,
  season: string = '2026/2027',
  gender?: string,
  sportIdOrIsCc?: string | boolean
): BirthDateValidationResult {
  if (!birthDate || !category) {
    return { isValid: true };
  }

  const birthYear = parseInt(birthDate.split('-')[0], 10);
  if (isNaN(birthYear) || birthYear < 1980 || birthYear > 2035) {
    return { isValid: false, errorMessage: 'يرجى إدخال تاريخ ازدياد صالح ومكتمل', birthYear };
  }

  const normCat = normalizeCategoryKey(category);
  const isCrossCountryOrAthletics = isTrackOrCrossCountrySport(sportIdOrIsCc);
  const cats = getAgeCategoriesForSeason(season, gender as any, sportIdOrIsCc);
  const catDef = cats.find(c => normalizeCategoryKey(c.id) === normCat);
  const catLabel = getCategoryShortName(normCat, gender, sportIdOrIsCc) || normCat;
  const match = (season || '').match(/(\d{4})/);
  const startYear = match ? parseInt(match[1], 10) : 2026;

  if (catDef) {
    if (normCat === 'U12' && isCrossCountryOrAthletics) {
      const minYear = catDef.years[0] ?? (startYear - 12);
      const expected = `مواليد سنة ${minYear} وما بعد`;
      if (birthYear < minYear) {
        return {
          isValid: false,
          birthYear,
          expectedYearsText: expected,
          categoryLabel: catLabel,
          errorMessage: `خطأ في تاريخ الازدياد: تاريخ الازدياد (سنة ${birthYear}) لا يتناسب مع الفئة المعنية (${catLabel} - مخصصة لـ ${expected}).`
        };
      }
      return { isValid: true, birthYear, expectedYearsText: expected, categoryLabel: catLabel };
    }

    if (normCat === 'U20' && !isCrossCountryOrAthletics) {
      const minYear = catDef.years[0] ?? (startYear - 17);
      const expected = `مواليد سنة ${minYear} وما بعد`;
      if (birthYear < minYear) {
        return {
          isValid: false,
          birthYear,
          expectedYearsText: expected,
          categoryLabel: catLabel,
          errorMessage: `خطأ في تاريخ الازدياد: تاريخ الازدياد (سنة ${birthYear}) لا يتناسب مع الفئة المعنية (${catLabel} - مخصصة لـ ${expected}).`
        };
      }
      return { isValid: true, birthYear, expectedYearsText: expected, categoryLabel: catLabel };
    }

    const allowed = catDef.years;
    const expected = `مواليد السنوات التالية: ${[...allowed].sort((a, b) => b - a).join(' / ')}`;
    if (!allowed.includes(birthYear)) {
      return {
        isValid: false,
        birthYear,
        expectedYearsText: expected,
        categoryLabel: catLabel,
        errorMessage: `خطأ في تاريخ الازدياد: تاريخ الازدياد (سنة ${birthYear}) لا يتناسب مع الفئة المعنية (${catLabel} - مخصصة لـ ${expected}).`
      };
    }
    return { isValid: true, birthYear, expectedYearsText: expected, categoryLabel: catLabel };
  }

  return { isValid: true, birthYear, categoryLabel: catLabel };
}

export const AGE_CATEGORIES = getAgeCategoriesForSeason('2026/2027');

export const isClubTournament = (t?: { affiliationType?: string; name?: string } | null): boolean => {
  if (!t) return false;
  if (t.affiliationType === 'club_affiliated') return true;
  if (t.affiliationType === 'non_club' || t.affiliationType === 'open') return false;
  if (t.name && (t.name.includes('للمنتمين للأندية') || t.name.includes('المنتمين للأندية') || t.name.includes('عصب وأندية') || t.name.includes('منتمي لنادي'))) return true;
  return false;
};

export const isOpenTournament = (t?: { affiliationType?: string; name?: string } | null): boolean => {
  if (!t) return false;
  if (t.affiliationType === 'open') return true;
  if (t.name && (t.name.includes('مفتوحة') || t.name.includes('المفتوحة') || t.name.includes('دوري مفتوح'))) return true;
  return false;
};

export const normalizeTournamentAffiliation = (raw?: string, name?: string): 'non_club' | 'club_affiliated' | 'open' => {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'club_affiliated' || val === 'espoir_club') return 'club_affiliated';
  if (val === 'open') return 'open';
  if (val === 'non_club' || val === 'espoir_non_club' || val === 'sports_tracks') return 'non_club';
  if (name) {
    if (name.includes('للمنتمين للأندية') || name.includes('المنتمين للأندية') || name.includes('عصب وأندية')) return 'club_affiliated';
    if (name.includes('مفتوحة') || name.includes('المفتوحة') || name.includes('دوري مفتوح')) return 'open';
  }
  return 'non_club';
};

export const GENDER_MAP: Record<string, { name: string; icon: string; badgeClass: string }> = {
  Male: { name: 'ذكور', icon: '👦', badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' },
  Female: { name: 'إناث', icon: '👧', badgeClass: 'bg-pink-50 text-pink-700 border-pink-200' },
  Mixed: { name: 'مختلط', icon: '👥', badgeClass: 'bg-purple-50 text-purple-700 border-purple-200' }
};

export const DataService = {
  isCloudSyncPaused,
  setCloudSyncPaused,
  getCustomCategoryName,
  getCustomCategoryDetails,
  // OFFICIAL LOGOS FOR PARTICIPATION LISTS
  async getOfficialLogos(): Promise<OfficialLogos> {
    try {
      const snap = await getDoc(doc(db, 'config', 'logos'));
      if (snap.exists()) {
        const logos = snap.data() as OfficialLogos;
        localStorage.setItem('taourirt_official_logos', JSON.stringify(logos));
        return logos;
      }
    } catch (e) {
      console.warn("Firestore load official logos error, falling back to cached:", e);
    }
    try {
      const data = localStorage.getItem('taourirt_official_logos');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  async saveOfficialLogos(logos: OfficialLogos): Promise<void> {
    try {
      localStorage.setItem('taourirt_official_logos', JSON.stringify(logos));
    } catch {}
    try {
      await setDoc(doc(db, 'config', 'logos'), {
        ...logos,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.error("Error saving official logos to Firestore:", e);
    }
  },

  // TOURNAMENTS
  async getTournaments(targetDirectorateId?: string, all?: boolean): Promise<Tournament[]> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    const tournsMap = new Map<string, Tournament>();
    const firestoreIds = new Set<string>();

    // 1. Fetch from Firestore first (source of truth)
    try {
      const snap = await getDocs(collection(db, 'tournaments'));
      if (!snap.empty) {
        snap.docs.forEach(d => {
          const data = d.data();
          const firestoreTourn: Tournament = {
            id: d.id,
            name: data.name || '',
            sportId: data.sportId || '',
            seasonId: data.seasonId || '',
            directorateId: data.directorateId || 'taourirt',
            ageCategory: data.ageCategory || '',
            gender: data.gender || 'Mixed',
            level: data.level || '',
            scope: data.scope || 'Provincial',
            status: data.status || 'Scheduled',
            description: data.description || '',
            managerName: data.managerName || '',
            managerPhone: data.managerPhone || '',
            managerEmail: data.managerEmail || '',
            accessCode: data.accessCode || '',
            ...data,
            affiliationType: normalizeTournamentAffiliation(data.affiliationType, data.name),
            startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
            endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
            registrationDeadline: data.registrationDeadline?.toDate ? data.registrationDeadline.toDate() : (data.registrationDeadline ? new Date(data.registrationDeadline) : undefined),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined),
          } as Tournament;

          tournsMap.set(d.id, firestoreTourn);
          firestoreIds.add(d.id);
        });
      }
    } catch (e) {
      console.warn("Firestore fetch tournaments error, falling back to cached local storage:", e);
    }

    // 2. Merge local cache for any items not yet in Firestore or newer local edits
    // Only use INITIAL_TOURNAMENTS fallback if Firestore is empty and we are on taourirt or requesting all
    const initialFallback = (tournsMap.size === 0 && (all === true || activeDirId === 'taourirt')) ? INITIAL_TOURNAMENTS : [];
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, tournsMap.size > 0 ? [] : initialFallback);
    localList.forEach(t => {
      if (t && t.id && !isRecentlyDeleted('tournaments', t.id)) {
        const existing = tournsMap.get(t.id);
        const normAff = normalizeTournamentAffiliation(t.affiliationType, t.name);
        if (!existing) {
          // If Firestore is loaded, only merge local items that are unsynced pending creations (do NOT inject stale tourn-* mocks when Firestore has data)
          if (tournsMap.size === 0 || isPendingWrite('tournaments', t.id)) {
            tournsMap.set(t.id, {
              ...t,
              affiliationType: normAff,
              directorateId: t.directorateId || 'taourirt',
              startDate: t.startDate ? (typeof t.startDate === 'object' && 'toDate' in t.startDate ? (t.startDate as any).toDate() : (t.startDate instanceof Date ? t.startDate : new Date(t.startDate))) : undefined,
              endDate: t.endDate ? (typeof t.endDate === 'object' && 'toDate' in t.endDate ? (t.endDate as any).toDate() : (t.endDate instanceof Date ? t.endDate : new Date(t.endDate))) : undefined,
              registrationDeadline: t.registrationDeadline ? (typeof t.registrationDeadline === 'object' && 'toDate' in t.registrationDeadline ? (t.registrationDeadline as any).toDate() : (t.registrationDeadline instanceof Date ? t.registrationDeadline : new Date(t.registrationDeadline))) : undefined
            });
          }
        } else if (isPendingWrite('tournaments', t.id)) {
          tournsMap.set(t.id, {
            ...existing,
            ...t,
            affiliationType: normAff,
            directorateId: t.directorateId || existing.directorateId || 'taourirt',
            startDate: t.startDate ? (typeof t.startDate === 'object' && 'toDate' in t.startDate ? (t.startDate as any).toDate() : (t.startDate instanceof Date ? t.startDate : new Date(t.startDate))) : existing.startDate,
            endDate: t.endDate ? (typeof t.endDate === 'object' && 'toDate' in t.endDate ? (t.endDate as any).toDate() : (t.endDate instanceof Date ? t.endDate : new Date(t.endDate))) : existing.endDate,
            registrationDeadline: t.registrationDeadline !== undefined 
              ? (t.registrationDeadline ? (typeof t.registrationDeadline === 'object' && 'toDate' in t.registrationDeadline ? (t.registrationDeadline as any).toDate() : (t.registrationDeadline instanceof Date ? t.registrationDeadline : new Date(t.registrationDeadline))) : undefined) 
              : existing.registrationDeadline
          });
        }
      }
    });

    const mergedList = Array.from(tournsMap.values()).filter(t => !isRecentlyDeleted('tournaments', t.id));
    const sanitizedList = mergedList.map(t => {
      let cleanCat = normalizeCategoryKey(t.ageCategory);
      if (/^CAT_/i.test(cleanCat) || /^cat_/i.test(cleanCat)) {
        cleanCat = 'U15';
      }
      let cleanName = t.name || '';
      if (/CAT_[0-9A-Za-z_]+/i.test(cleanName) || /cat_[0-9A-Za-z_]+/i.test(cleanName)) {
        cleanName = cleanName
          .replace(/CAT_[0-9A-Za-z_]+/gi, 'الصغار والصغيرات')
          .replace(/cat_[0-9A-Za-z_]+/gi, 'الصغار والصغيرات')
          .replace(/\s+-\s+-\s+/g, ' - ')
          .trim();
      }
      const normAff = normalizeTournamentAffiliation(t.affiliationType, cleanName);
      return {
        ...t,
        ageCategory: cleanCat,
        gender: t.gender || 'Mixed',
        affiliationType: normAff,
        name: cleanName
      };
    });

    // Semantic deduplication: guarantee at most ONE branch per (directorateId, sportId, seasonId, ageCategory, gender, affiliationType)
    const getTimestampMs = (v: any): number => {
      if (!v) return 0;
      if (v instanceof Date) return isNaN(v.getTime()) ? 0 : v.getTime();
      if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate().getTime();
      const d = new Date(v);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };
    const branchWinnerMap = new Map<string, Tournament>();
    deduplicateById(sanitizedList).forEach(t => {
      const dirKey = t.directorateId || 'taourirt';
      const seasonKey = (t.seasonId || '2026/2027').trim();
      const branchKey = `${dirKey}__${t.sportId}__${seasonKey}__${t.ageCategory}__${t.gender}__${t.affiliationType}`;
      const existing = branchWinnerMap.get(branchKey);
      if (!existing) {
        branchWinnerMap.set(branchKey, t);
        return;
      }
      const existingIsMock = existing.id.startsWith('tourn-');
      const currentIsMock = t.id.startsWith('tourn-');
      if (existingIsMock && !currentIsMock) {
        branchWinnerMap.set(branchKey, t);
        return;
      }
      if (!existingIsMock && currentIsMock) {
        return;
      }
      const existingInFs = firestoreIds.has(existing.id);
      const currentInFs = firestoreIds.has(t.id);
      if (!existingInFs && currentInFs) {
        branchWinnerMap.set(branchKey, t);
        return;
      }
      if (existingInFs && !currentInFs) {
        return;
      }
      const existingTs = Math.max(getTimestampMs(existing.updatedAt), getTimestampMs(existing.createdAt));
      const currentTs = Math.max(getTimestampMs(t.updatedAt), getTimestampMs(t.createdAt));
      if (currentTs > existingTs) {
        branchWinnerMap.set(branchKey, t);
      }
    });

    const semanticDeduped = Array.from(branchWinnerMap.values());
    setLocal(STORAGE_KEYS.TOURNAMENTS, semanticDeduped);

    if (all === true || !activeDirId || activeDirId === 'all') {
      return semanticDeduped;
    }

    // Isolate by active directorate
    return semanticDeduped.filter(t => (t.directorateId || 'taourirt') === activeDirId);
  },

  async deduplicateTournamentBranches(targetDirectorateId?: string): Promise<number> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId() || 'taourirt';
    const isAllDirs = !activeDirId || activeDirId === 'all';
    try {
      const rawDocs: Tournament[] = [];
      if (!isCloudSyncPaused()) {
        const snap = await getDocs(collection(db, 'tournaments'));
        snap.docs.forEach(d => {
          const data = d.data();
          if (isRecentlyDeleted('tournaments', d.id)) return;
          const dir = data.directorateId || 'taourirt';
          if (!isAllDirs && dir !== activeDirId) return;
          rawDocs.push({
            id: d.id,
            ...data,
            ageCategory: normalizeCategoryKey(data.ageCategory),
            gender: data.gender || 'Mixed',
            affiliationType: normalizeTournamentAffiliation(data.affiliationType, data.name),
            directorateId: dir
          } as Tournament);
        });
      }

      if (rawDocs.length === 0) return 0;

      const allMatches = await this.getMatches(isAllDirs ? 'all' : activeDirId, isAllDirs);
      const matchCountByTournId = new Map<string, number>();
      allMatches.forEach(m => {
        if (m.tournamentId) {
          matchCountByTournId.set(m.tournamentId, (matchCountByTournId.get(m.tournamentId) || 0) + 1);
        }
      });

      const groups = new Map<string, Tournament[]>();
      rawDocs.forEach(t => {
        const key = `${t.directorateId || 'taourirt'}__${t.sportId}__${(t.seasonId || '2026/2027').trim()}__${normalizeCategoryKey(t.ageCategory)}__${t.gender || 'Mixed'}__${normalizeTournamentAffiliation(t.affiliationType, t.name)}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(t);
      });

      let removedCount = 0;
      for (const [, list] of groups.entries()) {
        if (list.length <= 1) continue;
        const sorted = [...list].sort((a, b) => {
          const aMock = a.id.startsWith('tourn-') ? 1 : 0;
          const bMock = b.id.startsWith('tourn-') ? 1 : 0;
          if (aMock !== bMock) return aMock - bMock;
          const aMatches = matchCountByTournId.get(a.id) || 0;
          const bMatches = matchCountByTournId.get(b.id) || 0;
          if (aMatches !== bMatches) return bMatches - aMatches;
          const aTime = (a.updatedAt as any)?.toDate ? (a.updatedAt as any).toDate().getTime() : new Date(a.updatedAt || a.createdAt || 0).getTime();
          const bTime = (b.updatedAt as any)?.toDate ? (b.updatedAt as any).toDate().getTime() : new Date(b.updatedAt || b.createdAt || 0).getTime();
          return bTime - aTime;
        });

        const winner = sorted[0];
        const duplicates = sorted.slice(1);
        for (const dup of duplicates) {
          const linkedMatches = allMatches.filter(m => m.tournamentId === dup.id);
          for (const lm of linkedMatches) {
            await this.updateMatch(lm.id, { tournamentId: winner.id });
          }
          await this.deleteTournament(dup.id);
          removedCount++;
        }
      }
      return removedCount;
    } catch (e) {
      console.warn('deduplicateTournamentBranches warning:', e);
      return 0;
    }
  },

  async addTournament(tournament: Omit<Tournament, 'id'>): Promise<Tournament> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const effectiveDirId = tournament.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId);
    const normCat = normalizeCategoryKey(tournament.ageCategory);
    const normAff = normalizeTournamentAffiliation(tournament.affiliationType, tournament.name);
    const normGender = tournament.gender || 'Mixed';
    const normSeason = (tournament.seasonId || '2026/2027').trim();

    // Prevent duplicate branches for the exact same (directorate, sport, season, category, gender, affiliation)
    try {
      const existingList = await this.getTournaments(effectiveDirId);
      const duplicateMatch = existingList.find(t =>
        t.sportId === tournament.sportId &&
        (t.directorateId || 'taourirt') === effectiveDirId &&
        (t.seasonId || '2026/2027').trim() === normSeason &&
        normalizeCategoryKey(t.ageCategory) === normCat &&
        (t.gender || 'Mixed') === normGender &&
        normalizeTournamentAffiliation(t.affiliationType, t.name) === normAff
      );
      if (duplicateMatch) {
        const mergedUpdate: Partial<Tournament> = {
          ...tournament,
          ageCategory: normCat,
          gender: normGender,
          affiliationType: normAff,
          directorateId: effectiveDirId
        };
        await this.updateTournament(duplicateMatch.id, mergedUpdate);
        return { ...duplicateMatch, ...mergedUpdate, id: duplicateMatch.id };
      }
    } catch {
      // Proceed to create if lookup fails
    }

    const docRef = doc(collection(db, 'tournaments'));
    const realId = docRef.id;

    const tournamentWithDir = {
      ...tournament,
      ageCategory: normCat,
      gender: normGender,
      affiliationType: normAff,
      directorateId: effectiveDirId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const newTournament: Tournament = {
      ...tournamentWithDir,
      id: realId
    };

    // Always update local cache first with final Firestore ID
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const filtered = localList.filter(t => t.id !== realId);
    setLocal(STORAGE_KEYS.TOURNAMENTS, [newTournament, ...filtered]);
    markPendingWrite('tournaments', realId);

    // Sync to Firestore with clean payload (no undefined fields)
    try {
      const firestorePayload = stripUndefinedDeep({
        ...tournamentWithDir,
        id: realId,
        startDate: tournamentWithDir.startDate instanceof Date ? Timestamp.fromDate(tournamentWithDir.startDate) : (tournamentWithDir.startDate ? Timestamp.fromDate(new Date(tournamentWithDir.startDate)) : null),
        endDate: tournamentWithDir.endDate instanceof Date ? Timestamp.fromDate(tournamentWithDir.endDate) : (tournamentWithDir.endDate ? Timestamp.fromDate(new Date(tournamentWithDir.endDate)) : null),
        registrationDeadline: tournamentWithDir.registrationDeadline instanceof Date ? Timestamp.fromDate(tournamentWithDir.registrationDeadline) : (tournamentWithDir.registrationDeadline ? Timestamp.fromDate(new Date(tournamentWithDir.registrationDeadline)) : null),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(docRef, firestorePayload);
      clearPendingWrite('tournaments', realId);
    } catch (e) {
      console.warn("Saved tournament locally; Firestore sync pending:", e);
    }

    // Automatically set sport isProgrammed to true in database & cache when a tournament is created
    try {
      const sportId = tournament.sportId;
      const currentSports = getLocal<Sport>('taourirt_sports_config', []);
      const targetSport = currentSports.find(s => s.id === sportId);
      let newCats = (targetSport?.ageCategories && targetSport.ageCategories.length > 0)
        ? targetSport.ageCategories.map(normalizeCategoryKey)
        : [normCat];
      if (!newCats.includes(normCat) && ['U12', 'U15', 'U18', 'U20'].includes(normCat)) {
        newCats.push(normCat);
      }
      
      const updatedSports = currentSports.map(s => s.id === sportId ? { ...s, isProgrammed: true, ageCategories: newCats } : s);
      setLocal('taourirt_sports_config', updatedSports);

      await setDoc(doc(db, 'sports', sportId), {
        isProgrammed: true,
        ageCategories: newCats,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Could not update sport programmed status in Firestore:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
    }

    return newTournament;
  },

  async deleteTournament(id: string): Promise<void> {
    try {
      // 1. Get the tournament details first to know what students, matches, and results to delete
      const tournaments = await this.getTournaments();
      const tournament = tournaments.find(t => t.id === id);

      if (tournament) {
        const normTourAff = tournament.affiliationType === 'club_affiliated'
          ? 'club_affiliated'
          : tournament.affiliationType === 'open'
          ? 'open'
          : 'non_club';
        const normTourCat = normalizeCategoryKey(tournament.ageCategory);
        const remainingSameSportTournaments = tournaments.filter(
          t => t.id !== id && t.sportId === tournament.sportId
        );

        const isCoveredByRemainingTournament = (
          cat?: string,
          genderVal?: string,
          affVal?: string
        ): boolean => {
          const normCat = normalizeCategoryKey(cat);
          const normAff = affVal === 'club_affiliated' ? 'club_affiliated' : affVal === 'open' ? 'open' : 'non_club';
          return remainingSameSportTournaments.some(rt => {
            const rtAff = rt.affiliationType === 'club_affiliated' ? 'club_affiliated' : rt.affiliationType === 'open' ? 'open' : 'non_club';
            const rtCat = normalizeCategoryKey(rt.ageCategory);
            const catMatch = !normCat || !rtCat || rtCat === normCat || rtCat === 'جميع الفئات';
            const genderMatch = !genderVal || rt.gender === 'Mixed' || genderVal === 'Mixed' || rt.gender === genderVal;
            return catMatch && genderMatch && rtAff === normAff;
          });
        };

        // 2. Delete Matches strictly associated with this tournament (or orphaned/untagged matches matching its exact branch, or all matches of the sport when deleting its last tournament)
        const matches = await this.getMatches();
        const matchesToDelete = matches.filter(m => {
          if (m.tournamentId) {
            if (m.tournamentId === id) return true;
            // Also remove orphaned matches pointing to non-existent tournaments of the same deleted sport when no remaining tournament exists
            if (remainingSameSportTournaments.length === 0 && m.sportId === tournament.sportId) return true;
            return false;
          }
          if (m.sportId !== tournament.sportId) return false;
          if (remainingSameSportTournaments.length === 0) return true;
          const mCat = normalizeCategoryKey(m.ageCategory);
          const mAff = (m as any).affiliationType === 'club_affiliated'
            ? 'club_affiliated'
            : (m as any).affiliationType === 'open'
            ? 'open'
            : 'non_club';
          const catMatch = !normTourCat || !mCat || mCat === normTourCat;
          const genderMatch = tournament.gender === 'Mixed' || m.gender === 'Mixed' || m.gender === tournament.gender;
          if (!catMatch || !genderMatch || mAff !== normTourAff) return false;
          return !isCoveredByRemainingTournament(m.ageCategory, m.gender, mAff);
        });
        for (const m of matchesToDelete) {
          await this.deleteMatch(m.id);
        }

        // 3. Delete Students (Participants) strictly matching this deleted branch if no other active tournament covers them
        const allStudents = await this.getStudents();
        const studentsToDelete = allStudents.filter(s => {
          if (s.sportId !== tournament.sportId) return false;
          const sCat = normalizeCategoryKey(s.category);
          const sAff = s.affiliationType === 'club_affiliated' ? 'club_affiliated' : 'non_club';
          const catMatch = !normTourCat || !sCat || sCat === normTourCat;
          const genderMatch = tournament.gender === 'Mixed' || s.gender === 'Mixed' || s.gender === tournament.gender;
          if (!catMatch || !genderMatch || sAff !== normTourAff) return false;
          return !isCoveredByRemainingTournament(s.category, s.gender, sAff);
        });
        for (const s of studentsToDelete) {
          await this.deleteStudent(s.id);
        }

        // 4. Delete Cross Country Results matching this affiliation branch
        if (tournament.sportId === 'cross_country') {
          const activeDirId = this.getActiveDirectorateId();
          const resultsMap = await this.getCrossCountryResults();
          const resultsToDelete = (Object.values(resultsMap) as CrossCountryCategoryResult[]).filter(r => {
            if (remainingSameSportTournaments.length === 0) return true;
            const catMatch = normalizeCategoryKey(r.category) === normTourCat;
            const genderMatch = tournament.gender === 'Mixed' || r.gender === tournament.gender;
            if (!catMatch || !genderMatch) return false;
            const isClubResult = String(r.categoryId || '').endsWith('_club');
            if (normTourAff === 'club_affiliated') return isClubResult;
            if (normTourAff === 'non_club') return !isClubResult;
            return true;
          });
          
          for (const r of resultsToDelete) {
            const docId = `${activeDirId}_${r.categoryId}`;
            await deleteDoc(doc(db, 'cross_country_results', docId)).catch(() => {});
            
            // Update local cache for CC results
            const cacheKey = `taourirt_cc_results_${activeDirId}`;
            const localResults = localStorage.getItem(cacheKey);
            if (localResults) {
              const parsed = JSON.parse(localResults) as Record<string, CrossCountryCategoryResult>;
              delete parsed[r.categoryId];
              localStorage.setItem(cacheKey, JSON.stringify(parsed));
            }
          }
        }

        // 4b. Delete Athletics Results when no athletics tournaments remain
        if ((tournament.sportId === 'athletics' || tournament.sportId === 'track_field') && remainingSameSportTournaments.length === 0) {
          await this.resetMatchResultsByScope({ sportId: 'athletics' }).catch(() => {});
        }
      }

      // 5. Delete the tournament itself from local storage
      markRecentlyDeleted('tournaments', id);
      const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
      const updated = localList.filter(t => t.id !== id);
      setLocal(STORAGE_KEYS.TOURNAMENTS, updated);

      // 6. Delete from Firestore
      await deleteDoc(doc(db, 'tournaments', id));

      // 7. Update parent sport configuration (isProgrammed, ageCategories, targetAffiliations)
      if (tournament) {
        const remainingSportTournaments = updated.filter(t => t.sportId === tournament.sportId);
        const currentSports = getLocal<Sport>('taourirt_sports_config', []);
        
        if (remainingSportTournaments.length === 0) {
          // If no tournaments remain for this sport, turn it to unprogrammed / neutralized
          const updatedSports = currentSports.map(s => 
            s.id === tournament.sportId ? { ...s, isProgrammed: false, ageCategories: [], targetAffiliations: [] } : s
          );
          setLocal('taourirt_sports_config', updatedSports);
          await setDoc(doc(db, 'sports', tournament.sportId), {
            isProgrammed: false,
            ageCategories: [],
            targetAffiliations: [],
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        } else {
          // Update ageCategories & targetAffiliations to only remaining active tournament branches
          const remainingCats = Array.from(new Set(remainingSportTournaments.map(t => normalizeCategoryKey(t.ageCategory)).filter(Boolean)));
          const remainingAffs = Array.from(new Set(remainingSportTournaments.map(t => t.affiliationType || 'non_club'))) as Array<'non_club' | 'club_affiliated' | 'open'>;
          const updatedSports = currentSports.map(s => 
            s.id === tournament.sportId ? { ...s, isProgrammed: true, ageCategories: remainingCats, targetAffiliations: remainingAffs } : s
          );
          setLocal('taourirt_sports_config', updatedSports);
          await setDoc(doc(db, 'sports', tournament.sportId), {
            isProgrammed: true,
            ageCategories: remainingCats,
            targetAffiliations: remainingAffs,
            updatedAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        }
      }

      // 8. Dispatch synchronization events across all pages/components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tournamentDataChanged', { detail: { tournamentId: id } }));
        window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
        window.dispatchEvent(new CustomEvent('matchesDataChanged'));
        window.dispatchEvent(new CustomEvent('resultsChanged'));
        window.dispatchEvent(new CustomEvent('sportsConfigChanged'));
        window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
      }
    } catch (e) {
      console.warn("Error during cascade delete:", e);
      // Fallback: still delete the tournament locally even if cascade failed
      markRecentlyDeleted('tournaments', id);
      const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
      const updated = localList.filter(t => t.id !== id);
      setLocal(STORAGE_KEYS.TOURNAMENTS, updated);
      await deleteDoc(doc(db, 'tournaments', id)).catch(() => {});
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tournamentDataChanged', { detail: { tournamentId: id } }));
        window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
        window.dispatchEvent(new CustomEvent('matchesDataChanged'));
        window.dispatchEvent(new CustomEvent('sportsConfigChanged'));
      }
    }
  },

  async bulkDeleteTournamentsBySport(sportId: string): Promise<void> {
    const cachedSports = getLocal<Sport>('taourirt_sports_config', []);
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const tournamentsToDelete = localList.filter(t => t.sportId === sportId || areSportIdsEquivalent(t.sportId, sportId, cachedSports));
    tournamentsToDelete.forEach(t => markRecentlyDeleted('tournaments', t.id));
    const updatedTournaments = localList.filter(t => t.sportId !== sportId && !areSportIdsEquivalent(t.sportId, sportId, cachedSports));
    setLocal(STORAGE_KEYS.TOURNAMENTS, updatedTournaments);

    for (const tourn of tournamentsToDelete) {
      try {
        await deleteDoc(doc(db, 'tournaments', tourn.id));
      } catch (e) {
        console.warn(`Could not delete tournament ${tourn.id} in Firestore:`, e);
      }
    }

    // Delete associated matches cleanly
    try {
      const matches = await this.getMatches();
      const matchesToDelete = matches.filter(
        m => m.sportId === sportId || areSportIdsEquivalent(m.sportId, sportId, cachedSports) || tournamentsToDelete.some(t => t.id === m.tournamentId)
      );
      for (const m of matchesToDelete) {
        await this.deleteMatch(m.id);
      }
    } catch (e) {
      console.warn("Error deleting matches for sport:", e);
    }

    // Delete associated students
    try {
      const allStudents = await this.getStudents();
      const sportStudents = allStudents.filter(s => s.sportId === sportId || areSportIdsEquivalent(s.sportId, sportId, cachedSports));
      for (const s of sportStudents) {
        await this.deleteStudent(s.id);
      }
    } catch (e) {
      console.warn("Error deleting students for sport:", e);
    }

    // Delete cross country results if sport is cross_country
    if (areSportIdsEquivalent(sportId, 'cross_country', cachedSports)) {
      try {
        const activeDirId = this.getActiveDirectorateId();
        const resultsMap = await this.getCrossCountryResults();
        for (const catId of Object.keys(resultsMap)) {
          const docId = `${activeDirId}_${catId}`;
          await deleteDoc(doc(db, 'cross_country_results', docId)).catch(() => {});
        }
        const cacheKey = `taourirt_cc_results_${activeDirId}`;
        localStorage.setItem(cacheKey, '{}');
      } catch (e) {
        console.warn("Error deleting cross country results:", e);
      }
    }

    // Delete athletics results if sport is athletics
    if (areSportIdsEquivalent(sportId, 'athletics', cachedSports)) {
      await this.resetMatchResultsByScope({ sportId: 'athletics' }).catch(() => {});
    }

    try {
      const currentSports = getLocal<Sport>('taourirt_sports_config', []);
      const updatedSports = currentSports.map(s =>
        (s.id === sportId || areSportIdsEquivalent(s.id, sportId, cachedSports))
          ? { ...s, isProgrammed: false, ageCategories: [], targetAffiliations: [] }
          : s
      );
      setLocal('taourirt_sports_config', updatedSports);

      await setDoc(doc(db, 'sports', sportId), {
        isProgrammed: false,
        ageCategories: [],
        targetAffiliations: [],
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Could not reset sport programmed status in Firestore:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged', { detail: { sportId } }));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('resultsChanged'));
      window.dispatchEvent(new CustomEvent('sportsConfigChanged'));
      window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
    }
  },

  /**
   * Automatically restore missing 'club_affiliated' (المنتمين للأندية) tournament branches
   * for any programmed sports in the active directorate & season that currently only have 'non_club' branches.
   */
  async ensureClubAffiliatedBranchesForProgrammedSports(
    targetDirectorateId?: string,
    targetSeasonId?: string,
    forceCheck: boolean = false
  ): Promise<number> {
    // Do NOT silently auto-recreate deleted club_affiliated branches on page load;
    // only execute when explicitly requested with forceCheck = true.
    if (!forceCheck) {
      return 0;
    }

    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const activeSeason = targetSeasonId || (await this.getActiveSeason());
    const flagKey = `taourirt_restored_club_affiliated_v2_${effectiveDirId}_${activeSeason}`;

    const allTournaments = await this.getTournaments(undefined, true);
    const dirTournaments = allTournaments.filter(
      t =>
        (t.directorateId || 'taourirt') === effectiveDirId &&
        (!t.seasonId || t.seasonId === activeSeason) &&
        t.status !== 'Draft' &&
        t.status !== 'Archived'
    );

    if (dirTournaments.length === 0) {
      try {
        localStorage.setItem(flagKey, 'true');
      } catch {}
      return 0;
    }

    // Group active tournaments by sportId
    const bySport = new Map<string, Tournament[]>();
    dirTournaments.forEach(t => {
      if (!t.sportId) return;
      if (!bySport.has(t.sportId)) bySport.set(t.sportId, []);
      bySport.get(t.sportId)!.push(t);
    });

    const newlyCreated: Tournament[] = [];
    const currentLocal = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);

    for (const [sportId, sportTourns] of bySport.entries()) {
      // Cross country uses 'open' or dedicated branches; only restore if it has non_club without open/club_affiliated
      const hasOpen = sportTourns.some(t => t.affiliationType === 'open');
      if (sportId === 'cross_country' && hasOpen) {
        continue;
      }

      const existingClubKeys = new Set<string>();
      sportTourns.forEach(t => {
        if (t.affiliationType === 'club_affiliated') {
          existingClubKeys.add(`${normalizeCategoryKey(t.ageCategory)}__${t.gender}`);
        }
      });

      const nonClubBranches = sportTourns.filter(
        t => !t.affiliationType || t.affiliationType === 'non_club'
      );

      for (const refTourn of nonClubBranches) {
        const normCat = normalizeCategoryKey(refTourn.ageCategory || 'U15');
        const key = `${normCat}__${refTourn.gender}`;
        if (existingClubKeys.has(key)) continue;

        // Avoid duplicating inside same pass
        existingClubKeys.add(key);

        const docRef = doc(collection(db, 'tournaments'));
        const realId = docRef.id;
        const genLabel =
          refTourn.gender === 'Female' ? 'إناث' : refTourn.gender === 'Male' ? 'ذكور' : 'مختلط';
        const sportLabel = SPORTS_MAP[sportId]?.name || refTourn.sportName || sportId;

        const clubTournament: Tournament = {
          id: realId,
          name: `بطولة المنتمين للأندية ${normCat} ${genLabel}`,
          seasonId: refTourn.seasonId || activeSeason,
          sportId,
          sportName: sportLabel,
          ageCategory: normCat,
          gender: refTourn.gender,
          level: refTourn.level || (normCat === 'U12' ? 'Primary' : normCat === 'U15' ? (sportId === 'cross_country' ? 'Primary,Middle' : 'Middle') : (normCat === 'U18' || normCat === 'U20') ? 'High' : 'Middle,High'),
          scope: refTourn.scope || 'Provincial',
          affiliationType: 'club_affiliated',
          targetAffiliations: ['club_affiliated'],
          categoryStudentLimits: refTourn.categoryStudentLimits,
          startDate: refTourn.startDate || new Date(),
          endDate: refTourn.endDate || new Date(),
          registrationDeadline: refTourn.registrationDeadline || refTourn.endDate || new Date(),
          status: refTourn.status || 'Scheduled',
          description: `بطولة مدرسية رسمية (المنتمين للأندية والجمعيات الرياضية) (${sportLabel})`,
          directorateId: effectiveDirId,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        newlyCreated.push(clubTournament);
        markPendingWrite('tournaments', realId);
      }
    }

    if (newlyCreated.length > 0) {
      const mergedLocal = deduplicateById([...newlyCreated, ...currentLocal]);
      setLocal(STORAGE_KEYS.TOURNAMENTS, mergedLocal);

      // Ensure local sportsConfig also includes 'club_affiliated' in targetAffiliations for programmed sports
      try {
        const sportsLocal = getLocal<Sport>('taourirt_sports_config', []);
        const restoredSportIds = new Set(newlyCreated.map(t => t.sportId));
        const updatedSportsLocal = sportsLocal.map(s => {
          if (!restoredSportIds.has(s.id)) return s;
          const prevAffs = Array.isArray(s.targetAffiliations) ? s.targetAffiliations : [];
          const nextAffs = Array.from(
            new Set([
              ...prevAffs.filter(id => id === 'non_club' || id === 'club_affiliated'),
              'non_club',
              'club_affiliated'
            ])
          );
          return { ...s, targetAffiliations: nextAffs };
        });
        setLocal('taourirt_sports_config', updatedSportsLocal);
      } catch {}

      if (!isCloudSyncPaused()) {
        const batch = writeBatch(db);
        newlyCreated.forEach(item => {
          const firestorePayload = stripUndefinedDeep({
            ...item,
            startDate:
              item.startDate instanceof Date
                ? Timestamp.fromDate(item.startDate)
                : item.startDate
                ? Timestamp.fromDate(new Date(item.startDate))
                : null,
            endDate:
              item.endDate instanceof Date
                ? Timestamp.fromDate(item.endDate)
                : item.endDate
                ? Timestamp.fromDate(new Date(item.endDate))
                : null,
            registrationDeadline:
              item.registrationDeadline instanceof Date
                ? Timestamp.fromDate(item.registrationDeadline)
                : item.registrationDeadline
                ? Timestamp.fromDate(new Date(item.registrationDeadline))
                : null,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          batch.set(doc(db, 'tournaments', item.id), firestorePayload);
        });
        try {
          await batch.commit();
          newlyCreated.forEach(item => clearPendingWrite('tournaments', item.id));
        } catch (err) {
          console.warn('Restored club_affiliated branches locally; Firestore sync pending:', err);
        }
      }
    }

    try {
      localStorage.setItem(flagKey, 'true');
    } catch {}

    if (newlyCreated.length > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
    }

    return newlyCreated.length;
  },

  async updateTournament(id: string, updates: Partial<Tournament>): Promise<void> {
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const existing = localList.find(t => t.id === id);
    const targetSportId = updates.sportId || existing?.sportId || 'cross_country';

    // Format updates and strip undefined
    const cleanUpdates: Record<string, any> = {};
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanUpdates[key] = val;
      }
    });

    const fullUpdatedTournament: Tournament = {
      ...(existing || { 
        id, 
        sportId: targetSportId, 
        name: 'البطولة الرياضية', 
        seasonId: '2026/2027', 
        directorateId: this.getActiveDirectorateId(), 
        gender: 'Mixed', 
        ageCategory: 'جميع الفئات', 
        level: 'High', 
        scope: 'Provincial', 
        status: 'Scheduled',
        affiliationType: 'non_club'
      } as Tournament),
      ...cleanUpdates,
      id,
      updatedAt: new Date()
    };

    const updated = localList.map(t => t.id === id ? fullUpdatedTournament : t);
    if (!existing) {
      updated.push(fullUpdatedTournament);
    }
    setLocal(STORAGE_KEYS.TOURNAMENTS, updated);

    // If manager email was provided, sync user account to Firebase and local accounts
    if (updates.managerEmail && updates.managerEmail.trim()) {
      const cleanEmail = updates.managerEmail.trim().toLowerCase();
      const sanitizedId = `mgr_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`;
      const accessCode = updates.accessCode || '123456';
      const managerName = updates.managerName?.trim() || 'مسؤول البطولة';

      // 1. Sync to local registry
      try {
        const localAccountsRaw = localStorage.getItem('local_registered_users');
        const accounts: Array<{ email: string; pass: string; name: string; role: string; accessCode?: string; assignedTournamentId?: string; sportId?: string }> = localAccountsRaw ? JSON.parse(localAccountsRaw) : [];
        const existingIdx = accounts.findIndex(a => a.email.toLowerCase() === cleanEmail);
        const newAccount = {
          email: cleanEmail,
          pass: accessCode,
          name: managerName,
          role: 'SPORT_MANAGER',
          accessCode,
          assignedTournamentId: id,
          sportId: targetSportId
        };
        if (existingIdx >= 0) {
          accounts[existingIdx] = { ...accounts[existingIdx], ...newAccount };
        } else {
          accounts.push(newAccount);
        }
        localStorage.setItem('local_registered_users', JSON.stringify(accounts));
      } catch (err) {
        console.warn("Local storage manager save error:", err);
      }

      // 2. Sync to Firebase Firestore 'users' collection
      try {
        await setDoc(doc(db, 'users', sanitizedId), {
          id: sanitizedId,
          email: cleanEmail,
          fullName: managerName,
          phone: updates.managerPhone?.trim() || null,
          role: 'SPORT_MANAGER',
          accessCode: accessCode,
          assignedTournamentId: id,
          sportId: targetSportId,
          isActive: true,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
      } catch (fbErr) {
        console.warn("Firestore sync manager user document error:", fbErr);
      }
    }

    // Build clean Firestore payload with valid Timestamps for dates
    markPendingWrite('tournaments', id);
    const cleanFirestorePayload: Record<string, any> = stripUndefinedDeep({
      ...fullUpdatedTournament,
      updatedAt: serverTimestamp()
    });
    if (fullUpdatedTournament.startDate) {
      cleanFirestorePayload.startDate = fullUpdatedTournament.startDate instanceof Date 
        ? Timestamp.fromDate(fullUpdatedTournament.startDate) 
        : Timestamp.fromDate(new Date(fullUpdatedTournament.startDate));
    }
    if (fullUpdatedTournament.endDate) {
      cleanFirestorePayload.endDate = fullUpdatedTournament.endDate instanceof Date 
        ? Timestamp.fromDate(fullUpdatedTournament.endDate) 
        : Timestamp.fromDate(new Date(fullUpdatedTournament.endDate));
    }
    if (fullUpdatedTournament.registrationDeadline !== undefined) {
      cleanFirestorePayload.registrationDeadline = fullUpdatedTournament.registrationDeadline 
        ? (fullUpdatedTournament.registrationDeadline instanceof Date 
            ? Timestamp.fromDate(fullUpdatedTournament.registrationDeadline) 
            : Timestamp.fromDate(new Date(fullUpdatedTournament.registrationDeadline))) 
        : null;
    }

    try {
      await setDoc(doc(db, 'tournaments', id), cleanFirestorePayload, { merge: true });
      clearPendingWrite('tournaments', id);
    } catch (e) {
      console.warn("Firestore tournament update error:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
    }
  },

  async updateSportDates(
    sportId: string,
    dates: {
      startDate?: any;
      endDate?: any;
      registrationDeadline?: any;
      status?: Tournament['status'];
      description?: string;
      level?: string;
      educationSectors?: ('public' | 'private')[];
    }
  ): Promise<void> {
    const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const updated = localList.map(t => {
      if (t.sportId === sportId) {
        return {
          ...t,
          ...(dates.startDate !== undefined ? { startDate: dates.startDate instanceof Date ? dates.startDate : new Date(dates.startDate) } : {}),
          ...(dates.endDate !== undefined ? { endDate: dates.endDate instanceof Date ? dates.endDate : new Date(dates.endDate) } : {}),
          ...(dates.registrationDeadline !== undefined ? { registrationDeadline: dates.registrationDeadline instanceof Date ? dates.registrationDeadline : (dates.registrationDeadline ? new Date(dates.registrationDeadline) : null) } : {}),
          ...(dates.status !== undefined ? { status: dates.status } : {}),
          ...(dates.description !== undefined ? { description: dates.description } : {}),
          ...(dates.level !== undefined ? { level: dates.level } : {}),
          ...(dates.educationSectors !== undefined ? { educationSectors: dates.educationSectors } : {}),
          updatedAt: new Date()
        };
      }
      return t;
    });
    setLocal(STORAGE_KEYS.TOURNAMENTS, updated);

    try {
      const snap = await getDocs(query(collection(db, 'tournaments'), where('sportId', '==', sportId)));
      if (!snap.empty) {
        const promises = snap.docs.map(d => {
          const updatePayload: any = {
            updatedAt: serverTimestamp()
          };
          if (dates.startDate !== undefined) {
            updatePayload.startDate = dates.startDate instanceof Date ? Timestamp.fromDate(dates.startDate) : (dates.startDate ? Timestamp.fromDate(new Date(dates.startDate)) : null);
          }
          if (dates.endDate !== undefined) {
            updatePayload.endDate = dates.endDate instanceof Date ? Timestamp.fromDate(dates.endDate) : (dates.endDate ? Timestamp.fromDate(new Date(dates.endDate)) : null);
          }
          if (dates.registrationDeadline !== undefined) {
            updatePayload.registrationDeadline = dates.registrationDeadline instanceof Date ? Timestamp.fromDate(dates.registrationDeadline) : (dates.registrationDeadline ? Timestamp.fromDate(new Date(dates.registrationDeadline)) : null);
          }
          if (dates.status !== undefined) updatePayload.status = dates.status;
          if (dates.description !== undefined) updatePayload.description = dates.description;
          if (dates.level !== undefined) updatePayload.level = dates.level;
          if (dates.educationSectors !== undefined) updatePayload.educationSectors = dates.educationSectors;
          return setDoc(doc(db, 'tournaments', d.id), updatePayload, { merge: true });
        });
        await Promise.all(promises);
      } else {
        // No docs in Firestore yet for this sport, persist local items of this sport to Firestore
        const sportItems = updated.filter(t => t.sportId === sportId);
        for (const item of sportItems) {
          const payload: any = {
            ...item,
            startDate: item.startDate instanceof Date ? Timestamp.fromDate(item.startDate) : (item.startDate ? Timestamp.fromDate(new Date(item.startDate)) : null),
            endDate: item.endDate instanceof Date ? Timestamp.fromDate(item.endDate) : (item.endDate ? Timestamp.fromDate(new Date(item.endDate)) : null),
            registrationDeadline: item.registrationDeadline instanceof Date ? Timestamp.fromDate(item.registrationDeadline) : (item.registrationDeadline ? Timestamp.fromDate(new Date(item.registrationDeadline)) : null),
            updatedAt: serverTimestamp()
          };
          await setDoc(doc(db, 'tournaments', item.id), payload, { merge: true });
        }
      }
    } catch (e) {
      console.warn("Updated sport dates in Firestore:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
    }
  },

  async updateSportDeadline(sportId: string, registrationDeadline: any): Promise<void> {
    await this.updateSportDates(sportId, { registrationDeadline });
  },

  // MATCHES
  async getMatches(targetDirectorateId?: string, all?: boolean): Promise<Match[]> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();

    let allMatches: Match[] = [];
    let fetchedFromCloud = false;
    try {
      const snap = await getDocs(collection(db, 'matches'));
      fetchedFromCloud = true;
      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('matches', d.id))
          .map(d => normalizeMatchRecord({ ...d.data(), id: d.id } as Match));
        const filtered = firestoreList.filter(m => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3' && m.id !== 'demo-m1' && m.id !== 'demo-m2');
        const localPending = getLocal<Match>(STORAGE_KEYS.MATCHES, [])
          .filter(lm => lm && lm.id && isPendingWrite('matches', lm.id) && !isRecentlyDeleted('matches', lm.id))
          .map(normalizeMatchRecord);
        allMatches = deduplicateById([...localPending, ...filtered]);
        setLocal(STORAGE_KEYS.MATCHES, allMatches);
      } else {
        const localPending = getLocal<Match>(STORAGE_KEYS.MATCHES, [])
          .filter(lm => lm && lm.id && isPendingWrite('matches', lm.id) && !isRecentlyDeleted('matches', lm.id))
          .map(normalizeMatchRecord);
        allMatches = deduplicateById(localPending);
        setLocal(STORAGE_KEYS.MATCHES, allMatches);
      }
    } catch (e) {
      console.warn("Firestore fetch matches error, falling back to cache:", e);
    }

    if (!fetchedFromCloud && allMatches.length === 0) {
      const rawLocalList = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
      const localList = rawLocalList.map(normalizeMatchRecord);
      const cleaned = localList.filter(
        m => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3' && m.id !== 'demo-m1' && m.id !== 'demo-m2' && !isRecentlyDeleted('matches', m.id)
      );
      setLocal(STORAGE_KEYS.MATCHES, cleaned);
      allMatches = deduplicateById(cleaned);
    }

    if (all === true || !activeDirId || activeDirId === 'all') {
      return allMatches;
    }

    return allMatches.filter(m => (m.directorateId || 'taourirt') === activeDirId);
  },

  async resolveRefereeNamesList(ids: string[], providedNames?: string[]): Promise<string[]> {
    const cleanIds = (Array.isArray(ids) ? ids : []).map(v => String(v || '').trim()).filter(Boolean);
    if (cleanIds.length === 0) return [];

    const stripTag = (s?: string) => (s || '').replace(/\s*\(أستاذ\)\s*/g, '').replace(/\s+/g, ' ').trim();
    const looksLikeOpaqueId = (v: string): boolean => {
      if (!v) return false;
      if (/^(ref[-_]|usr[-_]|mgr[-_]|teacher[-_]|demo[-_]|sch[-_]|ven[-_]|mat[-_]|tourn[-_])/i.test(v)) return true;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return true;
      if (/^[A-Za-z0-9_-]{16,}$/.test(v) && !/\s/.test(v)) return true;
      if (/^[A-Za-z0-9_-]{12,}$/.test(v) && /[A-Za-z]/.test(v) && /\d/.test(v)) return true;
      return false;
    };

    const cachedPeople: any[] = [
      ...getLocal<any>('taourirt_referees_data', []),
      ...getLocal<any>('referees', []),
      ...(Array.isArray(inMemoryCollectionCache['local_registered_users']) ? inMemoryCollectionCache['local_registered_users'] : []),
      ...getLocal<any>('local_registered_users', [])
    ];
    try {
      const demoRaw = localStorage.getItem('demo_user_profile');
      if (demoRaw) {
        const parsed = JSON.parse(demoRaw);
        if (parsed && parsed.id) cachedPeople.push(parsed);
      }
    } catch {}

    const findNameInPool = (id: string, pool: any[]): string => {
      const match = pool.find(p => {
        if (!p) return false;
        if (p.id === id || p.uid === id || p.teacherId === id || p.userId === id) return true;
        if (Array.isArray(p.aliasIds) && p.aliasIds.includes(id)) return true;
        if (p.email && String(p.email).trim().toLowerCase() === id.toLowerCase()) return true;
        return false;
      });
      return match?.fullName ? stripTag(match.fullName) : '';
    };

    const preliminary = cleanIds.map((id, idx) => {
      const prov = stripTag(providedNames?.[idx]);
      if (prov && !looksLikeOpaqueId(prov)) return prov;
      const fromCache = findNameInPool(id, cachedPeople);
      if (fromCache) return fromCache;
      return looksLikeOpaqueId(id) ? '' : stripTag(id);
    });

    const hasUnresolvedId = cleanIds.some((id, idx) => !preliminary[idx] && looksLikeOpaqueId(id));
    if (!hasUnresolvedId) {
      return preliminary;
    }

    try {
      const [allRefs, allUsers] = await Promise.all([
        this.getReferees().catch(() => [] as Referee[]),
        this.getUsers().catch(() => [] as User[])
      ]);
      const fullPool = [...allRefs, ...allUsers, ...cachedPeople];
      return cleanIds.map((id, idx) => {
        if (preliminary[idx]) return preliminary[idx];
        const resolved = findNameInPool(id, fullPool);
        return resolved || (looksLikeOpaqueId(id) ? '' : stripTag(id));
      });
    } catch {
      return preliminary;
    }
  },

  async addMatch(match: Omit<Match, 'id'>): Promise<Match> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const docRef = doc(collection(db, 'matches'));
    const realId = docRef.id;

    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord);
    const activeDirNormalized = match.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId);
    const localTournaments = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
    const matchedTourn = match.tournamentId ? localTournaments.find(t => t.id === match.tournamentId) : undefined;
    const resolvedAgeCat = match.ageCategory
      ? normalizeCategoryKey(match.ageCategory)
      : matchedTourn?.ageCategory
      ? normalizeCategoryKey(matchedTourn.ageCategory)
      : undefined;
    const resolvedGender = match.gender || matchedTourn?.gender;
    const resolvedAff = normalizeTournamentAffiliation(
      match.affiliationType || matchedTourn?.affiliationType,
      matchedTourn?.name
    );

    let resolvedMatchNumber = match.drawMatchNumber && Number(match.drawMatchNumber) > 0
      ? Number(match.drawMatchNumber)
      : undefined;

    if (!resolvedMatchNumber) {
      const siblingNumbers = localList
        .filter(lm => {
          if ((lm.directorateId || 'taourirt') !== activeDirNormalized) return false;
          if (match.sportId && lm.sportId !== match.sportId) return false;
          if (resolvedAgeCat) {
            const lmCat = lm.ageCategory ? normalizeCategoryKey(lm.ageCategory) : (lm.category ? normalizeCategoryKey(lm.category) : '');
            if (lmCat !== resolvedAgeCat) return false;
          }
          if (resolvedGender && resolvedGender !== 'Mixed' && lm.gender && lm.gender !== resolvedGender) {
            return false;
          }
          const lmAff = normalizeTournamentAffiliation(lm.affiliationType);
          if (lmAff !== resolvedAff) return false;
          return true;
        })
        .map(lm => Number(lm.drawMatchNumber || 0))
        .filter(n => Number.isFinite(n) && n > 0);
      const maxExisting = siblingNumbers.length > 0 ? Math.max(...siblingNumbers) : 0;
      resolvedMatchNumber = maxExisting + 1;
    }

    const cleanFieldRefs = Array.isArray(match.fieldReferees)
      ? match.fieldReferees.map(r => String(r || '').trim()).filter(Boolean)
      : undefined;
    const cleanTableRefs = Array.isArray(match.tableReferees)
      ? match.tableReferees.map(r => String(r || '').trim()).filter(Boolean)
      : undefined;
    const cleanReferees = Array.isArray(match.referees)
      ? match.referees.map(r => String(r || '').trim()).filter(Boolean)
      : undefined;

    const [resolvedFieldNames, resolvedTableNames, resolvedAllNames] = await Promise.all([
      cleanFieldRefs && cleanFieldRefs.length > 0
        ? this.resolveRefereeNamesList(cleanFieldRefs, match.fieldRefereeNames)
        : Promise.resolve(undefined),
      cleanTableRefs && cleanTableRefs.length > 0
        ? this.resolveRefereeNamesList(cleanTableRefs, match.tableRefereeNames)
        : Promise.resolve(undefined),
      cleanReferees && cleanReferees.length > 0
        ? this.resolveRefereeNamesList(cleanReferees, match.refereeNames)
        : Promise.resolve(undefined)
    ]);

    const normalizedDate = normalizeDateToYmd(match.date);
    const matchWithDir = {
      ...match,
      ...(cleanFieldRefs ? { fieldReferees: cleanFieldRefs } : {}),
      ...(cleanTableRefs ? { tableReferees: cleanTableRefs } : {}),
      ...(cleanReferees ? { referees: cleanReferees } : {}),
      ...(resolvedFieldNames && resolvedFieldNames.length > 0 ? { fieldRefereeNames: resolvedFieldNames } : {}),
      ...(resolvedTableNames && resolvedTableNames.length > 0 ? { tableRefereeNames: resolvedTableNames } : {}),
      ...(resolvedAllNames && resolvedAllNames.length > 0 ? { refereeNames: resolvedAllNames } : {}),
      ...(resolvedAgeCat ? { ageCategory: resolvedAgeCat } : {}),
      ...(resolvedGender ? { gender: resolvedGender } : {}),
      affiliationType: resolvedAff,
      drawMatchNumber: resolvedMatchNumber,
      date: normalizedDate,
      directorateId: activeDirNormalized
    };
    const newMatch: Match = normalizeMatchRecord({
      ...matchWithDir,
      id: realId
    } as Match);
    const filtered = localList.filter(m => m.id !== realId);
    setLocal(STORAGE_KEYS.MATCHES, [newMatch, ...filtered]);
    markPendingWrite('matches', realId);

    try {
      const firestorePayload = stripUndefinedDeep({
        ...matchWithDir,
        id: realId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(docRef, firestorePayload);
      clearPendingWrite('matches', realId);
    } catch (e) {
      console.warn("Match saved locally; Firestore sync pending:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    // Trigger notification
    this.triggerMatchNotification('create', newMatch);

    return newMatch;
  },

  async updateMatch(matchId: string, matchData: Partial<Match>): Promise<void> {
    const hasRef1Key = Object.prototype.hasOwnProperty.call(matchData, 'referee1Id');
    const hasRef2Key = Object.prototype.hasOwnProperty.call(matchData, 'referee2Id');
    const hasRefereesKey = Object.prototype.hasOwnProperty.call(matchData, 'referees');
    const hasTableRefsKey = Object.prototype.hasOwnProperty.call(matchData, 'tableReferees');
    const hasFieldRefsKey = Object.prototype.hasOwnProperty.call(matchData, 'fieldReferees');
    const hasAnyRefereeUpdate = hasRef1Key || hasRef2Key || hasRefereesKey || hasTableRefsKey || hasFieldRefsKey;

    const cleanRef1 = hasRef1Key ? String(matchData.referee1Id || '').trim() : undefined;
    const cleanRef2 = hasRef2Key ? String(matchData.referee2Id || '').trim() : undefined;
    const cleanReferees = hasRefereesKey && Array.isArray(matchData.referees)
      ? matchData.referees.map(r => String(r || '').trim()).filter(Boolean)
      : undefined;
    const cleanTableRefs = hasTableRefsKey && Array.isArray(matchData.tableReferees)
      ? matchData.tableReferees.map(r => String(r || '').trim()).filter(Boolean)
      : undefined;
    const cleanFieldRefs = hasFieldRefsKey && Array.isArray(matchData.fieldReferees)
      ? matchData.fieldReferees.map(r => String(r || '').trim()).filter(Boolean)
      : undefined;

    const [resolvedFieldNames, resolvedTableNames, resolvedAllNames, resolvedRef1Arr, resolvedRef2Arr] =
      hasAnyRefereeUpdate
        ? await Promise.all([
            cleanFieldRefs && cleanFieldRefs.length > 0
              ? this.resolveRefereeNamesList(cleanFieldRefs, matchData.fieldRefereeNames)
              : Promise.resolve([] as string[]),
            cleanTableRefs && cleanTableRefs.length > 0
              ? this.resolveRefereeNamesList(cleanTableRefs, matchData.tableRefereeNames)
              : Promise.resolve([] as string[]),
            cleanReferees && cleanReferees.length > 0
              ? this.resolveRefereeNamesList(cleanReferees, matchData.refereeNames)
              : Promise.resolve([] as string[]),
            cleanRef1
              ? this.resolveRefereeNamesList([cleanRef1], (matchData as any).refereeName ? [(matchData as any).refereeName] : undefined)
              : Promise.resolve([] as string[]),
            cleanRef2
              ? this.resolveRefereeNamesList([cleanRef2], (matchData as any).referee2Name ? [(matchData as any).referee2Name] : undefined)
              : Promise.resolve([] as string[])
          ])
        : [[], [], [], [], []];

    const resolvedRef1Name = resolvedRef1Arr[0] || (resolvedAllNames[0] || '') || undefined;
    const resolvedRef2Name = resolvedRef2Arr[0] || (resolvedAllNames[1] || '') || undefined;

    const normalizedPatch: Partial<Match> & Record<string, any> = {
      ...matchData,
      ...(matchData.date !== undefined ? { date: normalizeDateToYmd(matchData.date) } : {}),
      ...(hasRef1Key ? { referee1Id: cleanRef1 || undefined } : {}),
      ...(hasRef2Key ? { referee2Id: cleanRef2 || undefined } : {}),
      ...(cleanReferees !== undefined ? { referees: cleanReferees } : {}),
      ...(cleanTableRefs !== undefined ? { tableReferees: cleanTableRefs } : {}),
      ...(cleanFieldRefs !== undefined ? { fieldReferees: cleanFieldRefs } : {}),
      ...(hasAnyRefereeUpdate
        ? {
            refereeId: cleanRef1 || (cleanReferees && cleanReferees[0]) || undefined,
            refereeIds: cleanReferees !== undefined ? cleanReferees : undefined,
            ...(resolvedRef1Name ? { refereeName: resolvedRef1Name } : {}),
            ...(resolvedRef2Name ? { referee2Name: resolvedRef2Name } : {}),
            ...(cleanReferees !== undefined ? { refereeNames: resolvedAllNames } : {}),
            ...(cleanTableRefs !== undefined ? { tableRefereeNames: resolvedTableNames } : {}),
            ...(cleanFieldRefs !== undefined ? { fieldRefereeNames: resolvedFieldNames } : {})
          }
        : {})
    };
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord);
    const existsLocally = localList.some(m => m.id === matchId);
    const updated = existsLocally
      ? localList.map(m => {
          if (m.id !== matchId) return m;
          const merged = { ...m, ...normalizedPatch } as any;
          if (hasAnyRefereeUpdate) {
            if (!resolvedRef1Name) delete merged.refereeName;
            if (!resolvedRef2Name) delete merged.referee2Name;
            if (cleanReferees !== undefined && resolvedAllNames.length === 0) delete merged.refereeNames;
            if (cleanTableRefs !== undefined && resolvedTableNames.length === 0) delete merged.tableRefereeNames;
            if (cleanFieldRefs !== undefined && resolvedFieldNames.length === 0) delete merged.fieldRefereeNames;
            delete merged.tableRefereeIds;
            delete merged.fieldRefereeIds;
          }
          return normalizeMatchRecord(merged);
        })
      : [normalizeMatchRecord({ id: matchId, ...normalizedPatch } as Match), ...localList];
    setLocal(STORAGE_KEYS.MATCHES, updated);
    markPendingWrite('matches', matchId);

    try {
      const { id, ...dataToUpdate } = normalizedPatch as any;
      const cleanData = stripUndefinedDeep(dataToUpdate);
      if (hasRef1Key && !cleanRef1) {
        cleanData.referee1Id = deleteField();
      }
      if (hasRef2Key && !cleanRef2) {
        cleanData.referee2Id = deleteField();
      }
      if (hasAnyRefereeUpdate) {
        const syncedPrimary = cleanRef1 || (cleanReferees && cleanReferees[0]) || '';
        cleanData.refereeId = syncedPrimary ? syncedPrimary : deleteField();
        if (cleanReferees !== undefined) {
          cleanData.refereeIds = cleanReferees;
          cleanData.refereeNames = resolvedAllNames.length > 0 ? resolvedAllNames : deleteField();
        } else if (!syncedPrimary) {
          cleanData.refereeIds = deleteField();
          cleanData.refereeNames = deleteField();
        }
        if (cleanTableRefs !== undefined) {
          cleanData.tableRefereeNames = resolvedTableNames.length > 0 ? resolvedTableNames : deleteField();
        }
        if (cleanFieldRefs !== undefined) {
          cleanData.fieldRefereeNames = resolvedFieldNames.length > 0 ? resolvedFieldNames : deleteField();
        }
        cleanData.refereeName = resolvedRef1Name ? resolvedRef1Name : deleteField();
        cleanData.referee2Name = resolvedRef2Name ? resolvedRef2Name : deleteField();
        cleanData.tableRefereeIds = deleteField();
        cleanData.fieldRefereeIds = deleteField();
      }
      await setDoc(doc(db, 'matches', matchId), {
        ...cleanData,
        id: matchId,
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('matches', matchId);
    } catch (e) {
      console.warn("Match updated locally; Firestore sync pending:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    const fullMatch = updated.find(m => m.id === matchId);
    if (fullMatch) {
      this.triggerMatchNotification('update', fullMatch);
    }
  },

  async updateMatchScore(
    matchId: string,
    score1: number,
    score2: number,
    status: Match['status'],
    extras?: {
      penalty1?: number;
      penalty2?: number;
      winnerId?: string;
      notes?: string;
      scorers?: string;
      updatedBy?: string;
      approvalStatus?: 'provisional' | 'approved';
      recordedByName?: string;
      recordedByRole?: string;
      approvedByName?: string;
      approvedAt?: string;
    }
  ): Promise<void> {
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
    const updated = localList.map(m => m.id === matchId ? {
      ...m,
      score1,
      score2,
      team1Score: score1,
      team2Score: score2,
      status,
      ...(extras || {})
    } : m);
    setLocal(STORAGE_KEYS.MATCHES, updated);
    markPendingWrite('matches', matchId);

    try {
      const cleanExtras = stripUndefinedDeep(extras || {});
      await setDoc(doc(db, 'matches', matchId), {
        id: matchId,
        score1,
        score2,
        team1Score: score1,
        team2Score: score2,
        status,
        ...cleanExtras,
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('matches', matchId);
    } catch (e) {
      console.warn("Match score updated locally; Firestore sync pending:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    const fullMatch = updated.find(m => m.id === matchId);
    if (status === 'Completed' && extras?.approvalStatus !== 'provisional') {
      await this.advanceKnockoutBracketWinner(matchId, fullMatch);
    }
    if (fullMatch && extras?.approvalStatus !== 'provisional') {
      this.triggerMatchNotification('result', fullMatch);
    }
  },

  async advanceKnockoutBracketWinner(matchId: string, matchHint?: Match): Promise<void> {
    try {
      const allMatches = await this.getMatches();
      let sourceMatch = allMatches.find(m => m.id === matchId) || matchHint;
      if (!sourceMatch) return;
      if (sourceMatch.status !== 'Completed' || sourceMatch.approvalStatus === 'provisional') return;

      const s1 = Number(sourceMatch.score1 ?? sourceMatch.team1Score ?? 0);
      const s2 = Number(sourceMatch.score2 ?? sourceMatch.team2Score ?? 0);
      const p1 = sourceMatch.penalty1;
      const p2 = sourceMatch.penalty2;

      let winnerId = sourceMatch.winnerId;
      if (!winnerId || isPlaceholderTeamId(winnerId)) {
        if (s1 > s2) winnerId = sourceMatch.team1Id;
        else if (s2 > s1) winnerId = sourceMatch.team2Id;
        else if (p1 !== undefined && p2 !== undefined) {
          if (p1 > p2) winnerId = sourceMatch.team1Id;
          else if (p2 > p1) winnerId = sourceMatch.team2Id;
        }
      }

      if (!winnerId || isPlaceholderTeamId(winnerId)) return;

      let winnerName =
        winnerId === sourceMatch.team1Id
          ? (sourceMatch.team1Name || sourceMatch.team1SchoolName)
          : winnerId === sourceMatch.team2Id
          ? (sourceMatch.team2Name || sourceMatch.team2SchoolName)
          : sourceMatch.winnerTeamName;

      if (!winnerName || isPlaceholderTeamId(winnerName)) {
        const schools = await this.getSchools().catch(() => []);
        const foundSch = schools.find(s => s.id === winnerId);
        if (foundSch?.name) winnerName = foundSch.name;
      }

      const dependents = allMatches.filter(m => {
        if (m.id === sourceMatch!.id) return false;
        const matchById = m.team1SourceMatchId === sourceMatch!.id || m.team2SourceMatchId === sourceMatch!.id;
        const matchByNum =
          Boolean(sourceMatch!.drawMatchNumber) &&
          m.tournamentId === sourceMatch!.tournamentId &&
          (m.team1SourceMatchNumber === sourceMatch!.drawMatchNumber ||
            m.team2SourceMatchNumber === sourceMatch!.drawMatchNumber);
        return matchById || matchByNum;
      });

      for (const dep of dependents) {
        const patch: Partial<Match> = {};
        if (
          dep.team1SourceMatchId === sourceMatch.id ||
          (sourceMatch.drawMatchNumber &&
            dep.tournamentId === sourceMatch.tournamentId &&
            dep.team1SourceMatchNumber === sourceMatch.drawMatchNumber)
        ) {
          patch.team1Id = winnerId;
          if (winnerName) patch.team1Name = winnerName;
        }
        if (
          dep.team2SourceMatchId === sourceMatch.id ||
          (sourceMatch.drawMatchNumber &&
            dep.tournamentId === sourceMatch.tournamentId &&
            dep.team2SourceMatchNumber === sourceMatch.drawMatchNumber)
        ) {
          patch.team2Id = winnerId;
          if (winnerName) patch.team2Name = winnerName;
        }
        if (Object.keys(patch).length > 0) {
          await this.updateMatch(dep.id, patch);
        }
      }
    } catch (err) {
      console.warn('advanceKnockoutBracketWinner warning:', err);
    }
  },

  async approveMatchResult(matchId: string, approverName: string): Promise<Match | null> {
    const approvedAt = new Date().toISOString();
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
    let approvedMatch: Match | null = null;
    const updated = localList.map(m => {
      if (m.id === matchId) {
        approvedMatch = {
          ...m,
          status: 'Completed',
          approvalStatus: 'approved',
          approvedByName: approverName,
          approvedAt
        };
        return approvedMatch;
      }
      return m;
    });
    setLocal(STORAGE_KEYS.MATCHES, updated);
    markPendingWrite('matches', matchId);

    try {
      await setDoc(doc(db, 'matches', matchId), {
        id: matchId,
        status: 'Completed',
        approvalStatus: 'approved',
        approvedByName: approverName,
        approvedAt,
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('matches', matchId);
    } catch (e) {
      console.warn("Match approval saved locally; Firestore sync pending:", e);
    }

    await this.advanceKnockoutBracketWinner(matchId, approvedMatch || undefined);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
      window.dispatchEvent(new CustomEvent('resultsChanged'));
    }

    if (approvedMatch) {
      this.triggerMatchNotification('result', approvedMatch);
    }
    return approvedMatch;
  },

  async approveMatchProgram(matchId: string, approverName: string): Promise<Match | null> {
    const programApprovedAt = new Date().toISOString();
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord);
    let approvedMatch: Match | null = null;
    const updated = localList.map(m => {
      if (m.id === matchId) {
        approvedMatch = normalizeMatchRecord({
          ...m,
          programApprovalStatus: 'approved',
          programApprovedBy: approverName,
          programApprovedAt
        });
        return approvedMatch;
      }
      return m;
    });
    setLocal(STORAGE_KEYS.MATCHES, updated);
    markPendingWrite('matches', matchId);

    try {
      await setDoc(doc(db, 'matches', matchId), {
        id: matchId,
        programApprovalStatus: 'approved',
        programApprovedBy: approverName,
        programApprovedAt,
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('matches', matchId);
    } catch (e) {
      console.warn("Program approval saved locally; Firestore sync pending:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    return approvedMatch;
  },

  async approveMatchesProgramBatch(matchIds: string[], approverName: string): Promise<number> {
    const uniqueIds = Array.from(new Set(matchIds.filter(Boolean)));
    if (uniqueIds.length === 0) return 0;

    const programApprovedAt = new Date().toISOString();
    const idSet = new Set(uniqueIds);
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord);
    const updated = localList.map(m => {
      if (idSet.has(m.id)) {
        return normalizeMatchRecord({
          ...m,
          programApprovalStatus: 'approved',
          programApprovedBy: approverName,
          programApprovedAt
        });
      }
      return m;
    });
    setLocal(STORAGE_KEYS.MATCHES, updated);
    uniqueIds.forEach(id => markPendingWrite('matches', id));

    await Promise.all(
      uniqueIds.map(async id => {
        try {
          await setDoc(doc(db, 'matches', id), {
            id,
            programApprovalStatus: 'approved',
            programApprovedBy: approverName,
            programApprovedAt,
            updatedAt: serverTimestamp()
          }, { merge: true });
          clearPendingWrite('matches', id);
        } catch (e) {
          console.warn(`Program approval sync pending for ${id}:`, e);
        }
      })
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    return uniqueIds.length;
  },

  async revertMatchProgram(matchId: string): Promise<Match | null> {
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord);
    let revertedMatch: Match | null = null;
    const updated = localList.map(m => {
      if (m.id === matchId) {
        revertedMatch = normalizeMatchRecord({
          ...m,
          programApprovalStatus: 'pending',
          programApprovedBy: '',
          programApprovedAt: ''
        });
        return revertedMatch;
      }
      return m;
    });
    setLocal(STORAGE_KEYS.MATCHES, updated);
    markPendingWrite('matches', matchId);

    try {
      await setDoc(doc(db, 'matches', matchId), {
        id: matchId,
        programApprovalStatus: 'pending',
        programApprovedBy: deleteField(),
        programApprovedAt: deleteField(),
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('matches', matchId);
    } catch (e) {
      console.warn("Program approval revert saved locally; Firestore sync pending:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    return revertedMatch;
  },

  async revertMatchesProgramBatch(matchIds: string[]): Promise<number> {
    const uniqueIds = Array.from(new Set(matchIds.filter(Boolean)));
    if (uniqueIds.length === 0) return 0;

    const idSet = new Set(uniqueIds);
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord);
    const updated = localList.map(m => {
      if (idSet.has(m.id)) {
        return normalizeMatchRecord({
          ...m,
          programApprovalStatus: 'pending',
          programApprovedBy: '',
          programApprovedAt: ''
        });
      }
      return m;
    });
    setLocal(STORAGE_KEYS.MATCHES, updated);
    uniqueIds.forEach(id => markPendingWrite('matches', id));

    await Promise.all(
      uniqueIds.map(async id => {
        try {
          await setDoc(doc(db, 'matches', id), {
            id,
            programApprovalStatus: 'pending',
            programApprovedBy: deleteField(),
            programApprovedAt: deleteField(),
            updatedAt: serverTimestamp()
          }, { merge: true });
          clearPendingWrite('matches', id);
        } catch (e) {
          console.warn(`Program approval revert sync pending for ${id}:`, e);
        }
      })
    );

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }

    return uniqueIds.length;
  },

  async deleteMatch(id: string): Promise<void> {
    markRecentlyDeleted('matches', id);
    const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
    const updated = localList.filter(m => m.id !== id);
    setLocal(STORAGE_KEYS.MATCHES, updated);

    try {
      await deleteDoc(doc(db, 'matches', id));
    } catch (e) {
      console.warn("Match deleted locally:", e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
    }
  },

  // SCHOOLS
  async getSchools(targetDirectorateId?: string, all?: boolean): Promise<School[]> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();

    try {
      const snap = await getDocs(collection(db, 'schools'));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('schools', d.id))
          .map(d => ({ id: d.id, ...d.data(), directorateId: d.data().directorateId || 'taourirt' } as School))
          .filter(s => s && s.name && !s.name.includes('غير محدد'));

        // Auto-heal accessCode, migrate private schools into dedicated 'خصوصي' cycle, and clean polluted central-admin teacher attribution
        const listWithCodes = firestoreList.map(s => {
          const normalizedType = normalizeSchoolCycleType(s);
          const hasValidCode = !!(s.accessCode && s.accessCode.trim().length === 6);
          const accessCode = hasValidCode ? s.accessCode! : generateSecureAccessCode();
          const needsTypeMigration = s.type !== normalizedType;

          const pollutedTeacher = Boolean(s.teacherName && isAmineSanoussiIdentity({ fullName: s.teacherName }));
          const pollutedCoordinator = Boolean(s.coordinatorName && isAmineSanoussiIdentity({ fullName: s.coordinatorName }));
          const pollutedCoordEmail = Boolean((s as any).coordinatorEmail && isFlexibleEmailMatch((s as any).coordinatorEmail, 'aminens21@gmail.com'));
          const fallbackAlFathName = (s.id === 'sch-1' || s.name.includes('الفتح')) ? 'ذ. عبد الرحيم بلقاسم' : '';

          if ((pollutedTeacher || pollutedCoordinator || pollutedCoordEmail || !hasValidCode || needsTypeMigration) && s.id && !isCloudSyncPaused()) {
            const patch: Record<string, any> = {};
            if (!hasValidCode) patch.accessCode = accessCode;
            if (needsTypeMigration) patch.type = normalizedType;
            if (pollutedTeacher) patch.teacherName = fallbackAlFathName;
            if (pollutedCoordinator) patch.coordinatorName = fallbackAlFathName;
            if (pollutedCoordEmail) patch.coordinatorEmail = '';
            setDoc(doc(db, 'schools', s.id), patch, { merge: true }).catch(err =>
              console.warn(`Failed to auto-update school ${s.name}:`, err)
            );
          }
          return {
            ...s,
            accessCode,
            type: normalizedType,
            ...(pollutedTeacher ? { teacherName: fallbackAlFathName } : {}),
            ...(pollutedCoordinator ? { coordinatorName: fallbackAlFathName } : {}),
            ...(pollutedCoordEmail ? { coordinatorEmail: '' } : {})
          };
        });

        // Merge ONLY genuinely pending local writes (not deleted schools)
        const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
        const localPending = localList.filter(ls => 
          ls && ls.id && ls.name &&
          isPendingWrite('schools', ls.id) &&
          !isRecentlyDeleted('schools', ls.id) &&
          !ls.name.includes('غير محدد')
        );

        if (localPending.length > 0 && !isCloudSyncPaused()) {
          localPending.forEach(ls => {
            if (isQueuedInExcelCloudSync('schools', ls.id)) return;
            const docRef = doc(db, 'schools', ls.id);
            const sanitized = stripUndefinedDeep({
              ...ls,
              id: docRef.id,
              directorateId: ls.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId),
              updatedAt: serverTimestamp()
            });
            setDoc(docRef, sanitized, { merge: true })
              .then(() => clearPendingWrite('schools', ls.id))
              .catch(() => {});
          });
        }

        const combinedList = deduplicateById<School>([...localPending, ...listWithCodes]);
        setLocal(STORAGE_KEYS.SCHOOLS, combinedList);
        if (all === true || !activeDirId || activeDirId === 'all') {
          return combinedList;
        }
        return combinedList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      } else {
        // Firestore collection is empty: preserve only genuinely pending local creations
        const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
        const pendingOnly = localList.filter(ls =>
          ls && ls.id && ls.name &&
          isPendingWrite('schools', ls.id) &&
          !isRecentlyDeleted('schools', ls.id) &&
          !ls.name.includes('غير محدد')
        );
        if (pendingOnly.length > 0 && !isCloudSyncPaused()) {
          pendingOnly.forEach(ls => {
            if (isQueuedInExcelCloudSync('schools', ls.id)) return;
            const docRef = doc(db, 'schools', ls.id);
            const sanitized = stripUndefinedDeep({
              ...ls,
              id: docRef.id,
              directorateId: ls.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
            setDoc(docRef, sanitized, { merge: true })
              .then(() => clearPendingWrite('schools', ls.id))
              .catch(() => {});
          });
        }
        setLocal(STORAGE_KEYS.SCHOOLS, pendingOnly);
        return (all === true || !activeDirId || activeDirId === 'all')
          ? pendingOnly
          : pendingOnly.filter(s => (s.directorateId || 'taourirt') === activeDirId);
      }
    } catch (e) {
      console.warn("Firestore schools fetch error:", e);
      const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []).filter(
        s => s && s.name && !s.name.includes('غير محدد') && !isRecentlyDeleted('schools', s.id)
      );
      if (all === true || !activeDirId || activeDirId === 'all') {
        return localList;
      }
      return localList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
    }
  },

  subscribeToSchools(callback: (schools: School[]) => void): () => void {
    const emitLocal = () => {
      const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []).filter(
        s => s && s.name && !s.name.includes('غير محدد') && !isRecentlyDeleted('schools', s.id)
      );
      callback(localList);
    };
    const handleLocalUpdate = () => {
      emitLocal();
    };
    window.addEventListener('schoolsUpdated', handleLocalUpdate);

    try {
      if (isCloudSyncPaused()) emitLocal();
      const unsubscribe = onSnapshot(collection(db, 'schools'), (snap) => {
        const firestoreList = snap.docs
          .filter((d: any) => !isRecentlyDeleted('schools', d.id))
          .map((d: any) => ({ id: d.id, ...d.data(), directorateId: d.data().directorateId || 'taourirt' } as School))
          .filter((s: School) => s && s.name && !s.name.includes('غير محدد'));

        const listWithCodes = firestoreList.map((s: School) => {
          const normalizedType = normalizeSchoolCycleType(s);
          const hasValidCode = !!(s.accessCode && s.accessCode.trim().length === 6);
          const accessCode = hasValidCode ? s.accessCode! : generateSecureAccessCode();
          const needsTypeMigration = s.type !== normalizedType;

          const pollutedTeacher = Boolean(s.teacherName && isAmineSanoussiIdentity({ fullName: s.teacherName }));
          const pollutedCoordinator = Boolean(s.coordinatorName && isAmineSanoussiIdentity({ fullName: s.coordinatorName }));
          const pollutedCoordEmail = Boolean((s as any).coordinatorEmail && isFlexibleEmailMatch((s as any).coordinatorEmail, 'aminens21@gmail.com'));
          const fallbackAlFathName = (s.id === 'sch-1' || s.name.includes('الفتح')) ? 'ذ. عبد الرحيم بلقاسم' : '';

          if ((pollutedTeacher || pollutedCoordinator || pollutedCoordEmail || !hasValidCode || needsTypeMigration) && s.id && !isCloudSyncPaused()) {
            const patch: Record<string, any> = {};
            if (!hasValidCode) patch.accessCode = accessCode;
            if (needsTypeMigration) patch.type = normalizedType;
            if (pollutedTeacher) patch.teacherName = fallbackAlFathName;
            if (pollutedCoordinator) patch.coordinatorName = fallbackAlFathName;
            if (pollutedCoordEmail) patch.coordinatorEmail = '';
            setDoc(doc(db, 'schools', s.id), patch, { merge: true }).catch(() => {});
          }
          return {
            ...s,
            accessCode,
            type: normalizedType,
            ...(pollutedTeacher ? { teacherName: fallbackAlFathName } : {}),
            ...(pollutedCoordinator ? { coordinatorName: fallbackAlFathName } : {}),
            ...(pollutedCoordEmail ? { coordinatorEmail: '' } : {})
          };
        });

        const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
        const localPending = localList.filter(ls =>
          ls && ls.id && ls.name &&
          isPendingWrite('schools', ls.id) &&
          !isRecentlyDeleted('schools', ls.id) &&
          !ls.name.includes('غير محدد')
        );

        const combined = deduplicateById<School>([...localPending, ...listWithCodes]);
        setLocal(STORAGE_KEYS.SCHOOLS, combined);
        callback(combined);
      }, (err) => {
        console.warn("Real-time schools listener error:", err);
      });
      return () => {
        window.removeEventListener('schoolsUpdated', handleLocalUpdate);
        unsubscribe();
      };
    } catch (err) {
      console.warn("Failed to subscribe to schools:", err);
      return () => {
        window.removeEventListener('schoolsUpdated', handleLocalUpdate);
      };
    }
  },

  async pruneExtraHighAndMiddleSchools(targetDirectorateId?: string): Promise<{ deletedCount: number; deletedSchools: School[] }> {
    if (isCloudSyncPaused()) {
      return { deletedCount: 0, deletedSchools: [] };
    }
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId() || 'taourirt';
    const isAllDirs = !activeDirId || activeDirId === 'all';

    try {
      const [teachersList, snap] = await Promise.all([
        this.getTeachers(),
        getDocs(collection(db, 'schools'))
      ]);

      const rawCloudSchools: School[] = snap.docs
        .filter(d => !isRecentlyDeleted('schools', d.id))
        .map(d => ({ id: d.id, ...d.data(), directorateId: d.data().directorateId || 'taourirt' } as School))
        .filter(s => s && s.name && !s.name.includes('غير محدد'));

      const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
      const combinedSchools = deduplicateById<School>([...rawCloudSchools, ...localList]);

      const dirSchools = isAllDirs
        ? combinedSchools
        : combinedSchools.filter(s => (s.directorateId || 'taourirt') === activeDirId);

      const extraSchools = dirSchools.filter(s => {
        const cycle = normalizeSchoolCycleType(s);
        if (cycle !== 'تأهيلي' && cycle !== 'إعدادي') return false;
        return !isSchoolRepresentedInTeachers(s, teachersList);
      });

      if (extraSchools.length === 0) {
        return { deletedCount: 0, deletedSchools: [] };
      }

      const deletedIdSet = new Set(extraSchools.map(s => s.id));
      extraSchools.forEach(s => {
        if (s.id) markRecentlyDeleted('schools', s.id);
      });

      const cloudIdSet = new Set(rawCloudSchools.map(s => s.id));
      const cloudToDelete = extraSchools.filter(s => s.id && cloudIdSet.has(s.id));

      if (cloudToDelete.length > 0) {
        let batch = writeBatch(db);
        let batchCount = 0;
        for (const sch of cloudToDelete) {
          batch.delete(doc(db, 'schools', sch.id));
          batchCount++;
          if (batchCount >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
        if (batchCount > 0) {
          await batch.commit();
        }
      }

      const remainingLocal = combinedSchools.filter(s => !deletedIdSet.has(s.id));
      setLocal(STORAGE_KEYS.SCHOOLS, remainingLocal);
      window.dispatchEvent(new CustomEvent('schoolsUpdated'));

      // Cascade-delete championship participations belonging to the pruned extra schools
      await this.pruneOrphanedParticipationsForDeletedSchools({
        targetDirectorateId: isAllDirs ? 'all' : activeDirId,
        deletedSchoolIds: extraSchools.map(s => s.id).filter(Boolean),
        deletedSchoolNames: extraSchools.map(s => s.name).filter(Boolean)
      });

      return { deletedCount: extraSchools.length, deletedSchools: extraSchools };
    } catch (e) {
      console.error('Error pruning extra High/Middle schools:', e);
      return { deletedCount: 0, deletedSchools: [] };
    }
  },

  subscribeToTournaments(callback: (tournaments: Tournament[]) => void): () => void {
    const normalizeAndDedupe = (rawList: Tournament[]): Tournament[] => {
      const activeDirId = this.getActiveDirectorateId() || 'taourirt';
      const branchWinnerMap = new Map<string, Tournament>();
      rawList.forEach((raw) => {
        if (!raw || !raw.id || isRecentlyDeleted('tournaments', raw.id)) return;
        const cleanCat = normalizeCategoryKey(raw.ageCategory || raw.name || 'U15');
        const cleanAff = normalizeTournamentAffiliation(raw.affiliationType, raw.name);
        const normT: Tournament = {
          ...raw,
          directorateId: raw.directorateId || 'taourirt',
          ageCategory: cleanCat,
          gender: raw.gender || 'Mixed',
          affiliationType: cleanAff
        };
        const branchKey = `${normT.directorateId}__${normT.sportId}__${(normT.seasonId || '2026/2027').trim()}__${cleanCat}__${normT.gender}__${cleanAff}`;
        const existing = branchWinnerMap.get(branchKey);
        if (!existing) {
          branchWinnerMap.set(branchKey, normT);
          return;
        }
        if (existing.id.startsWith('tourn-') && !normT.id.startsWith('tourn-')) {
          branchWinnerMap.set(branchKey, normT);
        }
      });
      const deduped = Array.from(branchWinnerMap.values());
      if (!activeDirId || activeDirId === 'all') return deduped;
      return deduped.filter(t => (t.directorateId || 'taourirt') === activeDirId);
    };

    const emitLocal = () => {
      const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []).filter(
        lt => lt && lt.id && !isRecentlyDeleted('tournaments', lt.id)
      );
      callback(normalizeAndDedupe(localList));
    };
    const handleLocalUpdate = () => {
      if (isCloudSyncPaused()) emitLocal();
    };
    window.addEventListener('tournamentsUpdated', handleLocalUpdate);

    try {
      const cachedTournaments = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
      if (isCloudSyncPaused() || cachedTournaments.length > 0) emitLocal();
      const unsubscribe = onSnapshot(collection(db, 'tournaments'), (snap) => {
        const tournsMap = new Map<string, Tournament>();
        snap.docs.forEach((d: any) => {
          if (isRecentlyDeleted('tournaments', d.id)) return;
          const data = d.data();
          const firestoreTourn: Tournament = {
            id: d.id,
            name: data.name || '',
            sportId: data.sportId || '',
            seasonId: data.seasonId || '',
            directorateId: data.directorateId || 'taourirt',
            level: data.level || '',
            scope: data.scope || 'Provincial',
            status: data.status || 'Scheduled',
            description: data.description || '',
            managerName: data.managerName || '',
            managerPhone: data.managerPhone || '',
            managerEmail: data.managerEmail || '',
            accessCode: data.accessCode || '',
            ...data,
            ageCategory: normalizeCategoryKey(data.ageCategory || data.name || 'U15'),
            gender: data.gender || 'Mixed',
            affiliationType: normalizeTournamentAffiliation(data.affiliationType, data.name),
            startDate: data.startDate?.toDate ? data.startDate.toDate() : (data.startDate ? new Date(data.startDate) : undefined),
            endDate: data.endDate?.toDate ? data.endDate.toDate() : (data.endDate ? new Date(data.endDate) : undefined),
            registrationDeadline: data.registrationDeadline?.toDate ? data.registrationDeadline.toDate() : (data.registrationDeadline ? new Date(data.registrationDeadline) : undefined),
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : undefined),
            updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt ? new Date(data.updatedAt) : undefined),
          } as Tournament;
          tournsMap.set(d.id, firestoreTourn);
        });
        const localPending = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []).filter(
          lt => lt && lt.id && isPendingWrite('tournaments', lt.id) && !isRecentlyDeleted('tournaments', lt.id)
        );
        localPending.forEach(lt => tournsMap.set(lt.id, lt));
        const allNormalized = Array.from(tournsMap.values());
        setLocal(STORAGE_KEYS.TOURNAMENTS, allNormalized);
        callback(normalizeAndDedupe(allNormalized));
      }, (err) => {
        console.warn("Real-time tournaments listener error:", err);
        emitLocal();
      });
      return () => {
        window.removeEventListener('tournamentsUpdated', handleLocalUpdate);
        unsubscribe();
      };
    } catch (err) {
      console.warn("Failed to subscribe to tournaments:", err);
      emitLocal();
      return () => {
        window.removeEventListener('tournamentsUpdated', handleLocalUpdate);
      };
    }
  },

  subscribeToMatches(callback: (matches: Match[]) => void): () => void {
    const scopeMatchesByDir = (list: Match[]) => {
      const activeDirId = this.getActiveDirectorateId() || 'taourirt';
      if (!activeDirId || activeDirId === 'all') return list;
      return list.filter(m => (m.directorateId || 'taourirt') === activeDirId);
    };
    const emitLocal = () => {
      const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, [])
        .filter(lm => lm && lm.id && !isRecentlyDeleted('matches', lm.id))
        .map(normalizeMatchRecord);
      callback(scopeMatchesByDir(localList));
    };
    const handleLocalUpdate = () => {
      if (isCloudSyncPaused()) emitLocal();
    };
    window.addEventListener('matchesUpdated', handleLocalUpdate);

    try {
      const cachedMatches = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
      if (isCloudSyncPaused() || cachedMatches.length > 0) emitLocal();
      const unsubscribe = onSnapshot(collection(db, 'matches'), (snap) => {
        const firestoreList = snap.docs
          .filter((d: any) => !isRecentlyDeleted('matches', d.id))
          .map((d: any) => normalizeMatchRecord({ ...d.data(), id: d.id } as Match));
        const filtered = firestoreList.filter((m: Match) => m.id !== 'mat-1' && m.id !== 'mat-2' && m.id !== 'mat-3');
        const localPending = getLocal<Match>(STORAGE_KEYS.MATCHES, [])
          .filter(lm => lm && lm.id && isPendingWrite('matches', lm.id) && !isRecentlyDeleted('matches', lm.id))
          .map(normalizeMatchRecord);
        const deduped = deduplicateById([...localPending, ...filtered]);
        setLocal(STORAGE_KEYS.MATCHES, deduped);
        callback(scopeMatchesByDir(deduped));
      }, (err) => {
        console.warn("Real-time matches listener error:", err);
        emitLocal();
      });
      return () => {
        window.removeEventListener('matchesUpdated', handleLocalUpdate);
        unsubscribe();
      };
    } catch (err) {
      console.warn("Failed to subscribe to matches:", err);
      emitLocal();
      return () => {
        window.removeEventListener('matchesUpdated', handleLocalUpdate);
      };
    }
  },

  subscribeToVenues(callback: (venues: Venue[]) => void): () => void {
    const emitLocal = () => {
      const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES).filter(
        lv => lv && lv.id && !isRecentlyDeleted('venues', lv.id)
      );
      callback(localList);
    };
    const handleLocalUpdate = () => {
      if (isCloudSyncPaused()) emitLocal();
    };
    window.addEventListener('venuesUpdated', handleLocalUpdate);

    try {
      if (isCloudSyncPaused()) emitLocal();
      const unsubscribe = onSnapshot(collection(db, 'venues'), (snap) => {
        const firestoreList = snap.docs
          .filter((d: any) => !isRecentlyDeleted('venues', d.id))
          .map((d: any) => ({ id: d.id, ...d.data() } as Venue));
        const localPending = getLocal<Venue>(STORAGE_KEYS.VENUES, []).filter(
          lv => lv && lv.id && isPendingWrite('venues', lv.id) && !isRecentlyDeleted('venues', lv.id)
        );
        const deduped = deduplicateById([...localPending, ...firestoreList]);
        setLocal(STORAGE_KEYS.VENUES, deduped);
        callback(deduped);
      }, (err) => {
        console.warn("Real-time venues listener error:", err);
        emitLocal();
      });
      return () => {
        window.removeEventListener('venuesUpdated', handleLocalUpdate);
        unsubscribe();
      };
    } catch (err) {
      console.warn("Failed to subscribe to venues:", err);
      emitLocal();
      return () => {
        window.removeEventListener('venuesUpdated', handleLocalUpdate);
      };
    }
  },

  subscribeToSportsConfig(callback: (sports: Sport[]) => void): () => void {
    const emitLocal = () => {
      callback(getLocal<Sport>('taourirt_sports_config', []));
    };
    const handleLocalUpdate = () => {
      if (isCloudSyncPaused()) emitLocal();
    };
    window.addEventListener('sportsConfigChanged', handleLocalUpdate);

    try {
      const cachedSports = getLocal<Sport>('taourirt_sports_config', []);
      if (isCloudSyncPaused() || cachedSports.length > 0) emitLocal();
      const unsubscribe = onSnapshot(collection(db, 'sports'), (snap) => {
        let fetchedSports: Sport[] = [];
        if (!snap.empty) {
          fetchedSports = snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Sport));
        }

        const localSports = getLocal<Sport>('taourirt_sports_config', []);
        if (fetchedSports.length === 0) {
          fetchedSports = localSports;
        } else if (localSports.length > 0) {
          const mergedMap = new Map<string, Sport>();
          fetchedSports.forEach(f => mergedMap.set(f.id, f));
          localSports.forEach(loc => {
            if (!loc || !loc.id) return;
            const remote = mergedMap.get(loc.id);
            if (!remote) {
              mergedMap.set(loc.id, loc);
            } else if (isPendingWrite('sports', loc.id)) {
              // Pending local changes (e.g. Excel import isProgrammed: true) ALWAYS win over stale remote
              mergedMap.set(loc.id, {
                ...remote,
                ...loc,
                isProgrammed: loc.isProgrammed ?? remote.isProgrammed,
                ageCategories: Array.from(new Set([...(remote.ageCategories || []), ...(loc.ageCategories || [])]))
              });
            } else {
              mergedMap.set(loc.id, {
                ...loc,
                ...remote,
                ageCategories: (remote.ageCategories && remote.ageCategories.length > 0) ? remote.ageCategories : loc.ageCategories
              });
            }
          });
          fetchedSports = Array.from(mergedMap.values());
        }

        setLocal('taourirt_sports_config', fetchedSports);
        callback(fetchedSports);
      }, (err) => {
        console.warn("Real-time sports listener error:", err);
        emitLocal();
      });
      return () => {
        window.removeEventListener('sportsConfigChanged', handleLocalUpdate);
        unsubscribe();
      };
    } catch (err) {
      console.warn("Failed to subscribe to sports configuration:", err);
      emitLocal();
      return () => {
        window.removeEventListener('sportsConfigChanged', handleLocalUpdate);
      };
    }
  },

  async addSchool(school: Omit<School, 'id'>): Promise<School> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const accessCode = (school.accessCode && school.accessCode.trim().length === 6)
      ? school.accessCode.trim()
      : generateSecureAccessCode();
    const cleanName = school.name?.trim() || '';
    
    const newDocRef = doc(collection(db, 'schools'));
    const realId = newDocRef.id;

    const resolvedSector = getSchoolEducationSector(school);
    const schoolWithDir: School = {
      ...school,
      id: realId,
      name: cleanName,
      type: school.type || (resolvedSector === 'private' ? 'خصوصي' : 'تأهيلي'),
      educationSector: resolvedSector,
      isPrivate: resolvedSector === 'private',
      commune: school.commune || 'تاوريرت المركز',
      accessCode,
      directorateId: school.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId),
      coordinatorName: school.coordinatorName || school.teacherName || '',
      teacherName: school.coordinatorName || school.teacherName || '',
      phone: school.phone || '',
      principalName: school.principalName || '',
      principalPhone: school.principalPhone || ''
    };

    // Update local state immediately and mark pending until Firestore confirms
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const filtered = localList.filter(s => s.id !== realId);
    setLocal(STORAGE_KEYS.SCHOOLS, [schoolWithDir, ...filtered]);
    markPendingWrite('schools', realId);

    const firestoreDocData: Record<string, any> = {
      id: realId,
      name: cleanName,
      type: schoolWithDir.type,
      educationSector: resolvedSector,
      isPrivate: resolvedSector === 'private',
      commune: schoolWithDir.commune,
      directorateId: schoolWithDir.directorateId,
      accessCode: schoolWithDir.accessCode,
      coordinatorName: schoolWithDir.coordinatorName || '',
      teacherName: schoolWithDir.teacherName || '',
      phone: schoolWithDir.phone || '',
      principalName: schoolWithDir.principalName || '',
      principalPhone: schoolWithDir.principalPhone || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    try {
      await setDoc(newDocRef, firestoreDocData);
      clearPendingWrite('schools', realId);
    } catch (e) {
      console.warn("Primary Firestore school save failed, retrying fallback:", e);
      try {
        await setDoc(newDocRef, {
          ...firestoreDocData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        clearPendingWrite('schools', realId);
      } catch (errFallback) {
        console.error("Critical: Firestore school save fallback failed (kept in pending queue):", errFallback);
      }
    }

    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
    return schoolWithDir;
  },

  async updateSchool(id: string, updates: Partial<School>): Promise<void> {
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const updated = localList.map(s => s.id === id ? { ...s, ...updates } : s);
    setLocal(STORAGE_KEYS.SCHOOLS, updated);
    markPendingWrite('schools', id);

    try {
      const cleanUpdates = stripUndefinedDeep({
        ...updates,
        id,
        updatedAt: serverTimestamp()
      });
      await setDoc(doc(db, 'schools', id), cleanUpdates, { merge: true });
      clearPendingWrite('schools', id);
    } catch (e) {
      console.warn("Primary Firestore school update failed, retrying fallback:", e);
      try {
        const cleanUpdates = stripUndefinedDeep({
          ...updates,
          id,
          updatedAt: new Date().toISOString()
        });
        await setDoc(doc(db, 'schools', id), cleanUpdates, { merge: true });
        clearPendingWrite('schools', id);
      } catch (err2) {
        console.error("Critical: Firestore school update fallback failed:", err2);
      }
    }

    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
  },

  async deleteSchool(id: string): Promise<void> {
    markRecentlyDeleted('schools', id);
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const targetSchool = localList.find(s => s.id === id);
    const updated = localList.filter(s => s.id !== id);
    setLocal(STORAGE_KEYS.SCHOOLS, updated);

    try {
      await deleteDoc(doc(db, 'schools', id));
    } catch (e) {
      console.error("Error deleting school from Firestore:", e);
    }

    // Cascade-delete participations of this deleted school
    await this.pruneOrphanedParticipationsForDeletedSchools({
      targetDirectorateId: targetSchool?.directorateId || this.getActiveDirectorateId() || 'taourirt',
      deletedSchoolIds: [id],
      deletedSchoolNames: targetSchool?.name ? [targetSchool.name] : []
    }).catch(() => {});

    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
  },

  async deleteAllSchools(): Promise<void> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const localList = getLocal<School>(STORAGE_KEYS.SCHOOLS, []);
    const dirSchools = localList.filter(s => activeDirId === 'all' || (s.directorateId || 'taourirt') === activeDirId);
    dirSchools.forEach(s => markRecentlyDeleted('schools', s.id));
    
    // 1. Delete from Firestore
    try {
      const snap = activeDirId === 'all'
        ? await getDocs(collection(db, 'schools'))
        : await getDocs(query(collection(db, 'schools'), where('directorateId', '==', activeDirId)));
      
      if (!snap.empty) {
        let batch = writeBatch(db);
        let count = 0;
        for (const d of snap.docs) {
          markRecentlyDeleted('schools', d.id);
          batch.delete(d.ref);
          count++;
          if (count >= 450) {
            await batch.commit();
            batch = writeBatch(db);
            count = 0;
          }
        }
        if (count > 0) {
          await batch.commit();
        }
      }
    } catch (e) {
      console.error("Error deleting all schools from Firestore:", e);
    }

    // 2. Delete from Local Storage
    const updated = activeDirId === 'all'
      ? []
      : localList.filter(s => (s.directorateId || 'taourirt') !== activeDirId);
    setLocal(STORAGE_KEYS.SCHOOLS, updated);

    // 3. Cascade-delete all participations for deleted directorate schools
    await this.pruneOrphanedParticipationsForDeletedSchools({
      targetDirectorateId: activeDirId,
      deletedSchoolIds: dirSchools.map(s => s.id).filter(Boolean),
      deletedSchoolNames: dirSchools.map(s => s.name).filter(Boolean),
      allowEmptySchools: true
    }).catch(() => {});
    
    // Trigger global UI refresh
    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
  },

  async addSchoolsBulk(newSchools: Omit<School, 'id'>[]): Promise<School[]> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const effectiveDirId = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const allExisting = await this.getSchools('all', true);
    const createdOrUpdatedList: School[] = [];
    const updatedByIdMap = new Map<string, School>();
    const existingByDirAndName = new Map<string, School>();

    allExisting.forEach(s => {
      if (!s || !s.id || !s.name) return;
      updatedByIdMap.set(s.id, s);
      const dir = s.directorateId || 'taourirt';
      existingByDirAndName.set(`${dir}__${s.name.trim().toLowerCase()}`, s);
    });

    const batchItems: { id: string; docRef: any; payload: Record<string, any> }[] = [];

    for (const item of newSchools) {
      const cleanName = item.name?.trim();
      if (!cleanName) continue;
      const itemDirId = item.directorateId || effectiveDirId;
      const lookupKey = `${itemDirId}__${cleanName.toLowerCase()}`;

      const cleanItem: any = {};
      Object.entries(item).forEach(([k, v]) => {
        if (v !== undefined) cleanItem[k] = v;
      });

      const resolvedSector = getSchoolEducationSector({
        name: cleanName,
        type: item.type,
        educationSector: item.educationSector,
        isPrivate: item.isPrivate
      });
      const normalizedCycle = normalizeSchoolPureCycleLabel({ name: cleanName, type: item.type });
      const resolvedType = item.type?.trim()
        ? (item.type.trim() === 'خصوصي' ? 'خصوصي' : normalizedCycle)
        : (resolvedSector === 'private' ? 'خصوصي' : normalizedCycle);

      const existingSchool = existingByDirAndName.get(lookupKey);
      const accessCode = existingSchool?.accessCode || cleanItem.accessCode || generateSecureAccessCode();
      const nowIso = new Date().toISOString();

      if (existingSchool) {
        const updatedItem: School = {
          ...existingSchool,
          ...cleanItem,
          id: existingSchool.id,
          name: cleanName,
          type: resolvedType,
          educationSector: resolvedSector,
          isPrivate: resolvedSector === 'private',
          commune: cleanItem.commune || existingSchool.commune || 'تاوريرت المركز',
          directorateId: itemDirId,
          accessCode,
          coordinatorName: cleanItem.coordinatorName || cleanItem.teacherName || existingSchool.coordinatorName || '',
          teacherName: cleanItem.coordinatorName || cleanItem.teacherName || existingSchool.teacherName || '',
          updatedAt: nowIso as any
        };

        updatedByIdMap.set(existingSchool.id, updatedItem);
        existingByDirAndName.set(lookupKey, updatedItem);
        createdOrUpdatedList.push(updatedItem);
        markPendingWrite('schools', existingSchool.id);

        const docRef = doc(db, 'schools', existingSchool.id);
        batchItems.push({
          id: existingSchool.id,
          docRef,
          payload: stripUndefinedDeep({
            ...updatedItem,
            updatedAt: serverTimestamp()
          })
        });
      } else {
        const docRef = doc(collection(db, 'schools'));
        const newSchool: School = {
          ...cleanItem,
          id: docRef.id,
          name: cleanName,
          type: resolvedType,
          educationSector: resolvedSector,
          isPrivate: resolvedSector === 'private',
          commune: cleanItem.commune || 'تاوريرت المركز',
          directorateId: itemDirId,
          accessCode,
          coordinatorName: cleanItem.coordinatorName || cleanItem.teacherName || '',
          teacherName: cleanItem.coordinatorName || cleanItem.teacherName || '',
          createdAt: nowIso as any,
          updatedAt: nowIso as any
        };

        updatedByIdMap.set(docRef.id, newSchool);
        existingByDirAndName.set(lookupKey, newSchool);
        createdOrUpdatedList.push(newSchool);
        markPendingWrite('schools', docRef.id);

        batchItems.push({
          id: docRef.id,
          docRef,
          payload: stripUndefinedDeep({
            ...newSchool,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          })
        });
      }
    }

    const finalList = Array.from(updatedByIdMap.values());
    setLocal(STORAGE_KEYS.SCHOOLS, finalList);
    window.dispatchEvent(new CustomEvent('schoolsUpdated'));

    for (let i = 0; i < batchItems.length; i += 450) {
      const chunk = batchItems.slice(i, i + 450);
      const batch = writeBatch(db);
      chunk.forEach(entry => {
        batch.set(entry.docRef, entry.payload, { merge: true });
      });
      try {
        await batch.commit();
        chunk.forEach(entry => clearPendingWrite('schools', entry.id));
      } catch (e) {
        console.warn("Firestore batch commit error (kept in pending queue):", e);
      }
    }

    window.dispatchEvent(new CustomEvent('schoolsUpdated'));
    return createdOrUpdatedList;
  },

  // VENUES
  async getVenues(): Promise<Venue[]> {
    try {
      const snap = await getDocs(collection(db, 'venues'));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('venues', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Venue));
        const localPending = getLocal<Venue>(STORAGE_KEYS.VENUES, []).filter(
          lv => lv && lv.id && isPendingWrite('venues', lv.id) && !isRecentlyDeleted('venues', lv.id)
        );
        const merged = deduplicateById([...localPending, ...firestoreList]);
        setLocal(STORAGE_KEYS.VENUES, merged);
        return merged;
      } else {
        const localPending = getLocal<Venue>(STORAGE_KEYS.VENUES, []).filter(
          lv => lv && lv.id && isPendingWrite('venues', lv.id) && !isRecentlyDeleted('venues', lv.id)
        );
        if (localPending.length > 0) {
          setLocal(STORAGE_KEYS.VENUES, localPending);
          return localPending;
        }
      }
    } catch (e) {
      console.warn("Firestore venues fetch error:", e);
    }
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES).filter(v => !isRecentlyDeleted('venues', v.id));
    return deduplicateById(localList);
  },

  async addVenue(venue: Omit<Venue, 'id'>): Promise<Venue> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const docRef = doc(collection(db, 'venues'));
    const realId = docRef.id;

    const venueWithDir = {
      ...venue,
      directorateId: venue.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId)
    };
    const newVenue: Venue = {
      ...venueWithDir,
      id: realId
    };
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const filtered = localList.filter(v => v.id !== realId);
    setLocal(STORAGE_KEYS.VENUES, [newVenue, ...filtered]);
    markPendingWrite('venues', realId);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...venueWithDir,
        id: realId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(docRef, cleanPayload);
      clearPendingWrite('venues', realId);
    } catch (e) {
      console.warn("Saved venue locally; Firestore sync pending:", e);
    }
    window.dispatchEvent(new CustomEvent('venuesUpdated'));
    return newVenue;
  },

  async updateVenue(id: string, updates: Partial<Venue>): Promise<void> {
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const updated = localList.map(v => v.id === id ? { ...v, ...updates } : v);
    setLocal(STORAGE_KEYS.VENUES, updated);
    markPendingWrite('venues', id);

    try {
      const cleanUpdates = stripUndefinedDeep({
        ...updates,
        id,
        updatedAt: serverTimestamp()
      });
      await setDoc(doc(db, 'venues', id), cleanUpdates, { merge: true });
      clearPendingWrite('venues', id);
    } catch (e) {
      console.warn("Updated venue locally; Firestore sync pending:", e);
    }
    window.dispatchEvent(new CustomEvent('venuesUpdated'));
  },

  async deleteVenue(id: string): Promise<void> {
    markRecentlyDeleted('venues', id);
    const localList = getLocal<Venue>(STORAGE_KEYS.VENUES, INITIAL_VENUES);
    const updated = localList.filter(v => v.id !== id);
    setLocal(STORAGE_KEYS.VENUES, updated);

    try {
      await deleteDoc(doc(db, 'venues', id));
    } catch (e) {
      console.warn("Deleted venue locally:", e);
    }
    window.dispatchEvent(new CustomEvent('venuesUpdated'));
  },

  // REFEREES
  async getReferees(): Promise<Referee[]> {
    let explicitReferees: Referee[] = [];
    const readCachedRefs = () => {
      const primary = getLocal<Referee>('taourirt_referees_data', []);
      const legacy = getLocal<Referee>('referees', []);
      return deduplicateById([...primary, ...legacy]).filter(r => !isRecentlyDeleted('referees', r.id));
    };

    try {
      const snap = await getDocs(collection(db, 'referees'));
      const firestoreRefs = snap.empty
        ? []
        : snap.docs
            .filter(d => !isRecentlyDeleted('referees', d.id))
            .map(d => ({ id: d.id, ...d.data() } as Referee));
      const pendingRefs = readCachedRefs().filter(r => isPendingWrite('referees', r.id));
      explicitReferees = deduplicateById([...pendingRefs, ...firestoreRefs]);
      setLocal('taourirt_referees_data', explicitReferees);
      setLocal('referees', explicitReferees);
    } catch (e) {
      console.warn("Firestore fetch referees error, falling back to local:", e);
      explicitReferees = readCachedRefs();
    }

    const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();

    let usersList: User[] = [];
    try {
      usersList = await this.getUsers();
    } catch (e) {
      console.warn("Failed to fetch users for referee merge:", e);
    }

    explicitReferees = explicitReferees.map(r => {
      const cleanRName = norm((r.fullName || '').replace(/\s*\(أستاذ\)\s*/g, ''));
      const matchedUser = usersList.find(u => {
        const aliasHit = Array.isArray(u.aliasIds) && (
          u.aliasIds.includes(r.id) ||
          (r.teacherId ? u.aliasIds.includes(r.teacherId) : false)
        );
        return (
          u.id === r.id ||
          aliasHit ||
          (r.teacherId && u.id === r.teacherId) ||
          (u.fullName && cleanRName && (norm(u.fullName) === cleanRName || norm(u.fullName).includes(cleanRName) || cleanRName.includes(norm(u.fullName))))
        );
      });
      if (matchedUser) {
        const mergedDiplomas = {
          ...(matchedUser.refereeDiplomas || {}),
          ...(r.specialtyDiplomas || {})
        };
        const mergedAliases = Array.from(new Set([
          ...(Array.isArray(r.aliasIds) ? r.aliasIds : []),
          ...(Array.isArray(matchedUser.aliasIds) ? matchedUser.aliasIds : []),
          r.id,
          r.teacherId,
          matchedUser.id
        ].filter(Boolean) as string[]));
        return {
          ...r,
          aliasIds: mergedAliases,
          fullName: (r.fullName || '').replace(/\s*\(أستاذ\)\s*/g, '').trim(),
          phone: (matchedUser.phone && matchedUser.phone.trim()) ? matchedUser.phone.trim() : r.phone,
          photoUrl: matchedUser.photoUrl || r.photoUrl,
          workLocation: r.workLocation || matchedUser.workLocation,
          teachingCadre: r.teachingCadre || matchedUser.teachingCadre,
          email: r.email || matchedUser.email,
          teacherId: r.teacherId || matchedUser.id,
          isTeacher: r.isTeacher ?? (matchedUser.role === 'TEACHER' || !!matchedUser.workLocation),
          diploma: r.diploma || matchedUser.refereeDiploma,
          specialtyDiplomas: Object.keys(mergedDiplomas).length > 0 ? mergedDiplomas : undefined
        };
      }
      return {
        ...r,
        fullName: (r.fullName || '').replace(/\s*\(أستاذ\)\s*/g, '').trim()
      };
    });

    const teacherReferees: Referee[] = usersList
      .filter(t => {
        if (!t || !t.id || isRecentlyDeleted('referees', t.id)) return false;
        const hasSpecs = Array.isArray(t.refereeSpecialty) ? t.refereeSpecialty.length > 0 : !!t.refereeSpecialty;
        const isTechRole = Boolean(
          t.isTechCommitteeHead ||
            t.role === 'TECH_HEAD' ||
            (t.role as string) === 'TECH_COMMITTEE_HEAD' ||
            t.role === 'SPORT_MANAGER'
        );
        const hasTechSports =
          (Array.isArray(t.techCommitteeSports) && t.techCommitteeSports.length > 0) ||
          Boolean(t.sportId);
        return hasSpecs || isTechRole || hasTechSports;
      })
      .map(t => {
        const baseSpecs = Array.isArray(t.refereeSpecialty)
          ? t.refereeSpecialty
          : (t.refereeSpecialty ? [t.refereeSpecialty] : []);
        const techSpecs = [
          ...(Array.isArray(t.techCommitteeSports) ? t.techCommitteeSports : []),
          ...(t.sportId ? [t.sportId] : [])
        ];
        const combinedSpecs = Array.from(new Set([...baseSpecs, ...(baseSpecs.length === 0 ? techSpecs : [])].filter(Boolean)));
        return {
          id: t.id,
          teacherId: t.id,
          aliasIds: Array.from(new Set([t.id, ...(Array.isArray(t.aliasIds) ? t.aliasIds : [])].filter(Boolean) as string[])),
          fullName: (t.fullName || '').replace(/\s*\(أستاذ\)\s*/g, '').trim(),
          phone: t.phone || 'غير محدد',
          specialty: combinedSpecs.length > 0 ? combinedSpecs : ['كرة القدم'],
          diploma: t.refereeDiploma,
          specialtyDiplomas: t.refereeDiplomas,
          workLocation: t.workLocation,
          teachingCadre: t.teachingCadre,
          email: t.email,
          directorateId: t.directorateId || 'taourirt',
          isActive: t.isActive !== false,
          isTeacher: t.role === 'TEACHER' || !!t.workLocation,
          photoUrl: t.photoUrl
        };
      });

    const idMap = new Map<string, Referee>();
    [...explicitReferees, ...teacherReferees].forEach(r => {
      if (!r || !r.id || isRecentlyDeleted('referees', r.id)) return;
      if (!idMap.has(r.id)) {
        idMap.set(r.id, r);
      } else {
        const existing = idMap.get(r.id)!;
        const mergedSpecialties = Array.from(new Set([
          ...(Array.isArray(existing.specialty) ? existing.specialty : (existing.specialty ? [existing.specialty] : [])),
          ...(Array.isArray(r.specialty) ? r.specialty : (r.specialty ? [r.specialty] : []))
        ]));
        const mergedDiplomas = {
          ...(r.specialtyDiplomas || {}),
          ...(existing.specialtyDiplomas || {})
        };
        const mergedAliases = Array.from(new Set([
          ...(Array.isArray(existing.aliasIds) ? existing.aliasIds : []),
          ...(Array.isArray(r.aliasIds) ? r.aliasIds : []),
          existing.id,
          r.id,
          existing.teacherId,
          r.teacherId
        ].filter(Boolean) as string[]));
        idMap.set(r.id, {
          ...existing,
          ...r,
          aliasIds: mergedAliases,
          specialty: mergedSpecialties,
          diploma: existing.diploma || r.diploma,
          specialtyDiplomas: Object.keys(mergedDiplomas).length > 0 ? mergedDiplomas : undefined,
          workLocation: existing.workLocation || r.workLocation,
          teachingCadre: existing.teachingCadre || r.teachingCadre,
          photoUrl: existing.photoUrl || r.photoUrl,
          isTeacher: existing.isTeacher || r.isTeacher,
          phone: (r.phone && r.phone !== 'غير محدد') ? r.phone : existing.phone,
          fullName: existing.fullName || r.fullName
        });
      }
    });

    const uniqueMap = new Map<string, Referee>();
    idMap.forEach(r => {
      const key = norm(r.fullName.replace(/\s*\(أستاذ\)\s*/g, ''));
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, r);
      } else {
        const prev = uniqueMap.get(key)!;
        const mergedSpecs = Array.from(new Set([
          ...(Array.isArray(prev.specialty) ? prev.specialty : (prev.specialty ? [prev.specialty] : [])),
          ...(Array.isArray(r.specialty) ? r.specialty : (r.specialty ? [r.specialty] : []))
        ]));
        const mergedDiplomas = {
          ...(r.specialtyDiplomas || {}),
          ...(prev.specialtyDiplomas || {})
        };
        const mergedAliases = Array.from(new Set([
          ...(Array.isArray(prev.aliasIds) ? prev.aliasIds : []),
          ...(Array.isArray(r.aliasIds) ? r.aliasIds : []),
          prev.id,
          r.id,
          prev.teacherId,
          r.teacherId
        ].filter(Boolean) as string[]));
        uniqueMap.set(key, {
          ...r,
          ...prev,
          aliasIds: mergedAliases,
          specialty: mergedSpecs,
          diploma: prev.diploma || r.diploma,
          specialtyDiplomas: Object.keys(mergedDiplomas).length > 0 ? mergedDiplomas : undefined,
          workLocation: prev.workLocation || r.workLocation,
          teachingCadre: prev.teachingCadre || r.teachingCadre,
          photoUrl: prev.photoUrl || r.photoUrl,
          isTeacher: prev.isTeacher || r.isTeacher,
          teacherId: prev.teacherId || r.teacherId,
          phone: (prev.phone && prev.phone !== 'غير محدد') ? prev.phone : r.phone
        });
      }
    });

    return deduplicateById(Array.from(uniqueMap.values()));
  },

  async addReferee(referee: Omit<Referee, 'id'>): Promise<Referee> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const targetDocId = referee.teacherId || undefined;
    const docRef = targetDocId ? doc(db, 'referees', targetDocId) : doc(collection(db, 'referees'));
    const realId = docRef.id;

    const refereeWithDir = {
      ...referee,
      directorateId: referee.directorateId || (activeDirId === 'all' ? 'taourirt' : activeDirId)
    };
    const newRef: Referee = { ...refereeWithDir, id: realId };
    const list = deduplicateById([...getLocal<Referee>('taourirt_referees_data', []), ...getLocal<Referee>('referees', [])]);
    const updated = [newRef, ...list.filter(r => r.id !== realId)];
    setLocal('taourirt_referees_data', updated);
    setLocal('referees', updated);
    markPendingWrite('referees', realId);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...refereeWithDir,
        id: realId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      await setDoc(docRef, cleanPayload, { merge: true });
      clearPendingWrite('referees', realId);
    } catch (e) {
      console.warn("Saved referee locally; Firestore sync pending:", e);
    }

    if (referee.teacherId) {
      try {
        await this.updateUserProfile(referee.teacherId, {
          ...(referee.phone && referee.phone !== 'غير محدد' ? { phone: referee.phone } : {}),
          ...(referee.specialty ? { refereeSpecialty: Array.isArray(referee.specialty) ? referee.specialty : [referee.specialty] } : {}),
          ...(referee.diploma !== undefined ? { refereeDiploma: referee.diploma } : {}),
          ...(referee.specialtyDiplomas !== undefined ? { refereeDiplomas: referee.specialtyDiplomas } : {})
        });
      } catch (err) {
        console.warn("Error syncing added referee to teacher profile:", err);
      }
    }

    window.dispatchEvent(new CustomEvent('refereesUpdated'));
    return newRef;
  },

  async removeRefereeFromScheduledMatches(params: {
    userId?: string;
    refereeIds?: string[];
    fullNames?: string[];
    removedSports?: string[];
    removeAll?: boolean;
  }): Promise<number> {
    const cleanRefToken = (raw?: string): string =>
      normalizeArabicMatchText(
        String(raw || '')
          .replace(/الحكم المعتمد/gi, '')
          .replace(/حكم الأول|الحكم الأول|حكم أول/gi, '')
          .replace(/حكم الثاني|الحكم الثاني|حكم ثاني/gi, '')
          .replace(/حكم الساحة|حكام الساحة|حكم الطاولة|حكام الطاولة/gi, '')
          .replace(/\(?\s*أستاذ\s*\)?/gi, '')
          .replace(/[():\-–—،,.]/g, ' ')
          .trim()
      );

    const targetIds = new Set<string>();
    const targetNames = new Set<string>();
    if (params.userId) targetIds.add(params.userId.trim().toLowerCase());
    (params.refereeIds || []).forEach(id => {
      if (id && id.trim()) targetIds.add(id.trim().toLowerCase());
    });
    (params.fullNames || []).forEach(name => {
      const cleaned = cleanRefToken(name);
      if (cleaned && cleaned.length >= 2) targetNames.add(cleaned);
    });

    // Also resolve linked explicit referee doc IDs / names from local & cloud referees
    const localRefs = deduplicateById([
      ...getLocal<Referee>('taourirt_referees_data', []),
      ...getLocal<Referee>('referees', [])
    ]);
    localRefs.forEach(r => {
      if (!r) return;
      const rIdLower = (r.id || '').trim().toLowerCase();
      const rTeacherIdLower = (r.teacherId || (r as any).userId || '').trim().toLowerCase();
      const rNameNorm = cleanRefToken(r.fullName);
      const matches =
        (rIdLower && targetIds.has(rIdLower)) ||
        (rTeacherIdLower && targetIds.has(rTeacherIdLower)) ||
        (rNameNorm && targetNames.has(rNameNorm));
      if (matches) {
        if (rIdLower) targetIds.add(rIdLower);
        if (rTeacherIdLower) targetIds.add(rTeacherIdLower);
        if (rNameNorm && rNameNorm.length >= 2) targetNames.add(rNameNorm);
      }
    });

    if (targetIds.size === 0 && targetNames.size === 0) return 0;

    const removedSports = (params.removedSports || []).filter(Boolean);
    if (!params.removeAll && removedSports.length === 0) return 0;

    const isTargetEntry = (entry?: string): boolean => {
      if (!entry) return false;
      const lower = entry.trim().toLowerCase();
      if (!lower) return false;
      if (targetIds.has(lower)) return true;

      const refRec = localRefs.find(r => r.id && r.id.trim().toLowerCase() === lower);
      if (refRec) {
        const refTeacherId = (refRec.teacherId || (refRec as any).userId || '').trim().toLowerCase();
        if (refTeacherId && targetIds.has(refTeacherId)) return true;
      }

      const cleaned = cleanRefToken(refRec ? refRec.fullName : entry);
      if (!cleaned) return false;
      return Array.from(targetNames).some(target => {
        if (cleaned === target) return true;
        if (cleaned.length >= 4 && target.length >= 4) {
          return cleaned.includes(target) || target.includes(cleaned);
        }
        return false;
      });
    };

    const allMatches = await this.getMatches().catch(() =>
      getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord)
    );
    const localMatchesMap = new Map<string, Match>();
    getLocal<Match>(STORAGE_KEYS.MATCHES, []).forEach(lm => {
      if (lm && lm.id) localMatchesMap.set(lm.id, normalizeMatchRecord(lm));
    });
    allMatches.forEach(m => {
      if (m && m.id) localMatchesMap.set(m.id, normalizeMatchRecord(m));
    });

    let updatedCount = 0;
    const matchesToPersist: {
      matchId: string;
      fieldReferees: string[];
      tableReferees: string[];
      referees: string[];
      referee1Id?: string;
      referee2Id?: string;
    }[] = [];

    for (const [mId, m] of localMatchesMap.entries()) {
      // Only remove from programmed/scheduled/postponed matches (preserve completed/live match history)
      if (m.status === 'Completed' || m.status === 'Ongoing') continue;

      if (!params.removeAll) {
        const sportMatches = removedSports.some(sp => areSportIdsEquivalent(m.sportId, sp));
        if (!sportMatches) continue;
      }

      const origField = Array.isArray(m.fieldReferees) ? m.fieldReferees.filter(Boolean) : [];
      const origTable = Array.isArray(m.tableReferees) ? m.tableReferees.filter(Boolean) : [];
      const origRefs = Array.isArray(m.referees) ? m.referees.filter(Boolean) : [];

      const hadMatch =
        origField.some(isTargetEntry) ||
        origTable.some(isTargetEntry) ||
        origRefs.some(isTargetEntry) ||
        isTargetEntry(m.referee1Id) ||
        isTargetEntry(m.referee2Id);

      if (!hadMatch) continue;

      const nextField = origField.filter(e => !isTargetEntry(e));
      const nextTable = origTable.filter(e => !isTargetEntry(e));
      const remainingExtraRefs = origRefs.filter(e => !isTargetEntry(e));
      const nextCombined = Array.from(new Set([...nextField, ...nextTable, ...remainingExtraRefs].filter(Boolean)));
      const nextRef1 = nextCombined[0] || undefined;
      const nextRef2 = nextCombined[1] || undefined;

      const cleanedMatch: Match = normalizeMatchRecord({
        ...m,
        fieldReferees: nextField,
        tableReferees: nextTable,
        referees: nextCombined,
        referee1Id: nextRef1,
        referee2Id: nextRef2,
        updatedAt: new Date()
      });

      localMatchesMap.set(mId, cleanedMatch);
      markPendingWrite('matches', mId);
      matchesToPersist.push({
        matchId: mId,
        fieldReferees: nextField,
        tableReferees: nextTable,
        referees: nextCombined,
        referee1Id: nextRef1,
        referee2Id: nextRef2
      });
      updatedCount++;
    }

    if (updatedCount > 0) {
      setLocal(STORAGE_KEYS.MATCHES, Array.from(localMatchesMap.values()));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('matchesDataChanged'));
        window.dispatchEvent(new CustomEvent('matchesUpdated'));
      }

      for (const item of matchesToPersist) {
        try {
          await setDoc(
            doc(db, 'matches', item.matchId),
            {
              fieldReferees: item.fieldReferees,
              tableReferees: item.tableReferees,
              referees: item.referees,
              referee1Id: item.referee1Id ? item.referee1Id : deleteField(),
              referee2Id: item.referee2Id ? item.referee2Id : deleteField(),
              updatedAt: serverTimestamp()
            },
            { merge: true }
          );
          clearPendingWrite('matches', item.matchId);
        } catch (err) {
          console.warn(`Scheduled match referee cleanup sync pending for ${item.matchId}:`, err);
        }
      }
    }

    return updatedCount;
  },

  async updateReferee(id: string, updates: Partial<Referee>): Promise<void> {
    const list = deduplicateById([...getLocal<Referee>('taourirt_referees_data', []), ...getLocal<Referee>('referees', [])]);
    const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
    
    const targetRef = list.find(r => r.id === id);
    const updated = list.some(r => r.id === id)
      ? list.map(r => r.id === id ? { ...r, ...updates } : r)
      : list;
    setLocal('taourirt_referees_data', updated);
    setLocal('referees', updated);

    // Check if this referee corresponds to a teacher user profile
    let matchedTeacherUser: User | undefined;
    try {
      const users = await this.getUsers();
      const refName = (updates.fullName || targetRef?.fullName || '').replace(/\s*\(أستاذ\)\s*/g, '');
      matchedTeacherUser = users.find(u => 
        u.id === id || 
        (targetRef?.teacherId && u.id === targetRef.teacherId) ||
        (refName && u.fullName && (norm(u.fullName) === norm(refName) || norm(u.fullName).includes(norm(refName)) || norm(refName).includes(norm(u.fullName))))
      );
    } catch (err) {
      console.warn("Error looking up teacher for referee update:", err);
    }

    // Update explicit referees collection if not purely a teacher-derived record (or if present in explicit list)
    if (!matchedTeacherUser || list.some(r => r.id === id)) {
      markPendingWrite('referees', id);
      try {
        const cleanUpdates = stripUndefinedDeep({
          ...updates,
          fullName: updates.fullName ? updates.fullName.replace(/\s*\(أستاذ\)\s*/g, '') : undefined,
          id,
          updatedAt: serverTimestamp()
        });
        await setDoc(doc(db, 'referees', id), cleanUpdates, { merge: true });
        clearPendingWrite('referees', id);
      } catch (e) {
        console.warn("Updated referee locally; Firestore sync pending:", e);
      }
    }

    // Bidirectional sync to user profile (including refereeSpecialty, diplomas, phone, and fullName)
    if (matchedTeacherUser) {
      try {
        const cleanTeacherName = updates.fullName ? updates.fullName.replace(/\s*\(أستاذ\)\s*/g, '').trim() : undefined;
        await this.updateUserProfile(matchedTeacherUser.id, {
          ...(updates.phone ? { phone: updates.phone } : {}),
          ...(cleanTeacherName ? { fullName: cleanTeacherName } : {}),
          ...(updates.specialty !== undefined ? { refereeSpecialty: Array.isArray(updates.specialty) ? updates.specialty : [updates.specialty] } : {}),
          ...(updates.diploma !== undefined ? { refereeDiploma: updates.diploma } : {}),
          ...(updates.specialtyDiplomas !== undefined ? { refereeDiplomas: updates.specialtyDiplomas } : {})
        });
      } catch (err) {
        console.warn("Error syncing referee update to user profile:", err);
      }
    } else if (updates.specialty !== undefined) {
      const prevSpecs = Array.isArray(targetRef?.specialty)
        ? targetRef.specialty
        : (targetRef?.specialty ? [targetRef.specialty] : []);
      const nextSpecs = Array.isArray(updates.specialty)
        ? updates.specialty
        : (updates.specialty ? [updates.specialty] : []);
      const removedSports = prevSpecs.filter(sp => !nextSpecs.some(ns => areSportIdsEquivalent(ns, sp)));
      if (removedSports.length > 0 || nextSpecs.length === 0) {
        await this.removeRefereeFromScheduledMatches({
          refereeIds: [id],
          fullNames: [targetRef?.fullName || '', updates.fullName || ''].filter(Boolean),
          removedSports,
          removeAll: nextSpecs.length === 0
        }).catch(() => 0);
      }
    }
    window.dispatchEvent(new CustomEvent('refereesUpdated'));
  },

  async deleteReferee(id: string): Promise<void> {
    markRecentlyDeleted('referees', id);
    const list = deduplicateById([...getLocal<Referee>('taourirt_referees_data', []), ...getLocal<Referee>('referees', [])]);
    const targetRef = list.find(r => r.id === id);
    const filtered = list.filter(r => r.id !== id);
    setLocal('taourirt_referees_data', filtered);
    setLocal('referees', filtered);
    try {
      await deleteDoc(doc(db, 'referees', id));
    } catch (e) {
      console.warn("Deleted referee locally:", e);
    }

    // If this referee was auto-derived from a teacher's refereeSpecialty, clear refereeSpecialty so they don't reappear
    let clearedViaProfile = false;
    try {
      const users = await this.getUsers();
      const matchedTeacher = users.find(u => u.id === id || (targetRef?.teacherId && u.id === targetRef.teacherId));
      if (matchedTeacher && matchedTeacher.refereeSpecialty) {
        await this.updateUserProfile(matchedTeacher.id, {
          refereeSpecialty: [],
          refereeDiploma: '',
          refereeDiplomas: {}
        });
        clearedViaProfile = true;
      }
    } catch (e) {
      console.warn("Could not clear teacher refereeSpecialty on referee delete:", e);
    }
    if (!clearedViaProfile) {
      await this.removeRefereeFromScheduledMatches({
        userId: targetRef?.teacherId || id,
        refereeIds: [id],
        fullNames: targetRef?.fullName ? [targetRef.fullName] : [],
        removeAll: true
      }).catch(() => 0);
    }
    window.dispatchEvent(new CustomEvent('refereesUpdated'));
  },

  // USERS / TEACHERS
  async getUsers(): Promise<User[]> {
    const activeDirId = this.getActiveDirectorateId();
    const usersMap = new Map<string, User>();

    const collectUserAliases = (...entries: any[]): string[] => {
      const set = new Set<string>();
      entries.forEach(entry => {
        if (!entry) return;
        if (typeof entry.id === 'string' && entry.id.trim()) set.add(entry.id.trim());
        if (typeof entry.uid === 'string' && entry.uid.trim()) set.add(entry.uid.trim());
        if (typeof entry.teacherId === 'string' && entry.teacherId.trim()) set.add(entry.teacherId.trim());
        if (Array.isArray(entry.aliasIds)) {
          entry.aliasIds.forEach((aid: any) => {
            if (typeof aid === 'string' && aid.trim()) set.add(aid.trim());
          });
        }
      });
      return Array.from(set);
    };

    // Helper to find existing map entry by id, aliasIds, email, leaseNumber, or normalized name
    const findMatchingKey = (u: any): string | null => {
      if (!u) return null;
      const cleanEmail = u.email ? String(u.email).trim().toLowerCase() : '';
      const cleanLease = u.leaseNumber ? String(u.leaseNumber).trim() : '';
      const cleanName = u.fullName ? normalizeArabicName(u.fullName) : '';

      for (const [k, existing] of usersMap.entries()) {
        const existingAliasSet = new Set([existing.id, ...(Array.isArray(existing.aliasIds) ? existing.aliasIds : [])].filter(Boolean));
        const incomingIds = [u.id, u.uid, u.teacherId, ...(Array.isArray(u.aliasIds) ? u.aliasIds : [])].filter(Boolean);
        const aliasHit = incomingIds.some((id: string) => existingAliasSet.has(id));
        if (
          k === u.id || existing.id === u.id || aliasHit ||
          (cleanEmail && existing.email && isFlexibleEmailMatch(existing.email, cleanEmail)) ||
          (cleanLease && existing.leaseNumber && existing.leaseNumber === cleanLease) ||
          (cleanName && existing.fullName && cleanName.length >= 6 && normalizeArabicName(existing.fullName) === cleanName)
        ) {
          return k;
        }
      }
      return null;
    };

    let firestoreSucceeded = false;
    let firestoreWasEmpty = true;

    // 1. Load from Firestore first so deleted users never resurrect from local cache
    try {
      const snap = await getDocs(collection(db, 'users'));
      firestoreSucceeded = true;
      firestoreWasEmpty = snap.empty;
      if (!snap.empty) {
        snap.docs.forEach(d => {
          const docId = d.id;
          if (isRecentlyDeleted('users', docId)) return;
          const data = d.data() as any;
          const matchedKey = findMatchingKey({ ...data, id: docId });

          if (matchedKey) {
            const existing = usersMap.get(matchedKey)!;
            const preferData = !docId.startsWith('mgr_') || (data.schoolAccessVerified && !existing.schoolAccessVerified);
            const dataPhoto = typeof data.photoUrl === 'string' ? data.photoUrl.trim() : '';
            const existingPhoto = typeof existing.photoUrl === 'string' ? existing.photoUrl.trim() : '';
            const mergedPhoto = preferData ? (dataPhoto || existingPhoto) : (existingPhoto || dataPhoto);
            const mergedAliases = collectUserAliases(existing, { ...data, id: docId });
            const merged: User = {
              ...existing,
              ...data,
              id: preferData ? docId : existing.id,
              aliasIds: mergedAliases,
              role: data.role || existing.role || 'TEACHER',
              fullName: data.fullName || data.name || existing.fullName || 'أستاذ',
              directorateId: data.directorateId || existing.directorateId || activeDirId,
              workLocation: preferData ? (data.workLocation || existing.workLocation || '') : (existing.workLocation || data.workLocation || ''),
              schoolId: preferData ? (data.schoolId || existing.schoolId || '') : (existing.schoolId || data.schoolId || ''),
              leaseNumber: data.leaseNumber || existing.leaseNumber || '',
              phone: data.phone || existing.phone || '',
              photoUrl: mergedPhoto,
              schoolAccessVerified: existing.schoolAccessVerified || data.schoolAccessVerified || false,
              isTechCommitteeHead: data.isTechCommitteeHead !== undefined ? !!data.isTechCommitteeHead : !!existing.isTechCommitteeHead,
              techCommitteeSports: data.techCommitteeSports !== undefined ? data.techCommitteeSports : (existing.techCommitteeSports || []),
              isTechCommitteeMember: data.isTechCommitteeMember !== undefined ? !!data.isTechCommitteeMember : !!existing.isTechCommitteeMember,
              techCommitteeSportsMemberOf: data.techCommitteeSportsMemberOf !== undefined ? data.techCommitteeSportsMemberOf : (existing.techCommitteeSportsMemberOf || [])
            };
            const targetKey = preferData ? docId : matchedKey;
            usersMap.set(targetKey, merged);
            if (matchedKey !== targetKey) {
              usersMap.delete(matchedKey);
            }
          } else {
            usersMap.set(docId, {
              ...data,
              id: docId,
              aliasIds: collectUserAliases({ ...data, id: docId }),
              fullName: data.fullName || data.name || 'أستاذ',
              email: data.email || '',
              role: data.role || 'TEACHER',
              directorateId: data.directorateId || activeDirId,
              workLocation: data.workLocation || '',
              leaseNumber: data.leaseNumber || '',
              phone: data.phone || '',
              isTechCommitteeHead: !!data.isTechCommitteeHead,
              techCommitteeSports: Array.isArray(data.techCommitteeSports) ? data.techCommitteeSports : [],
              isTechCommitteeMember: !!data.isTechCommitteeMember,
              techCommitteeSportsMemberOf: Array.isArray(data.techCommitteeSportsMemberOf) ? data.techCommitteeSportsMemberOf : []
            });
          }
        });
      }
    } catch (e) {
      console.warn("Firestore fetch users error, falling back to cached list:", e);
    }

    // 2. Merge local cache ONLY when offline, empty cloud, or pending write
    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      if (localUsersRaw) {
        const localUsers = JSON.parse(localUsersRaw) as any[];
        localUsers.forEach(u => {
          if (u && (u.id || u.email || u.leaseNumber || u.fullName)) {
            const uid = String(u.id || u.email || u.leaseNumber || '');
            if (uid && isRecentlyDeleted('users', uid)) return;
            if (firestoreSucceeded && !firestoreWasEmpty && !(uid && isPendingWrite('users', uid))) return;

            const matchedKey = findMatchingKey(u);
            const resolvedId = u.id || matchedKey || u.email || u.leaseNumber;
            const userObj: User = {
              ...u,
              id: resolvedId,
              aliasIds: collectUserAliases(u, { id: resolvedId }),
              fullName: u.fullName || u.name || 'أستاذ',
              email: u.email || '',
              role: u.role || 'TEACHER',
              directorateId: u.directorateId || activeDirId,
              workLocation: u.workLocation || '',
              leaseNumber: u.leaseNumber || '',
              phone: u.phone || '',
              isTechCommitteeHead: !!u.isTechCommitteeHead,
              techCommitteeSports: Array.isArray(u.techCommitteeSports) ? u.techCommitteeSports : [],
              isTechCommitteeMember: !!u.isTechCommitteeMember,
              techCommitteeSportsMemberOf: Array.isArray(u.techCommitteeSportsMemberOf) ? u.techCommitteeSportsMemberOf : []
            };

            if (matchedKey) {
              const existing = usersMap.get(matchedKey)!;
              const preferNew = (uid && isPendingWrite('users', uid)) || (u.schoolAccessVerified && !existing.schoolAccessVerified);
              const uPhoto = typeof u.photoUrl === 'string' ? u.photoUrl.trim() : '';
              const exPhoto = typeof existing.photoUrl === 'string' ? existing.photoUrl.trim() : '';
              const merged: User = {
                ...existing,
                ...(preferNew ? userObj : {}),
                id: preferNew ? userObj.id : existing.id,
                aliasIds: collectUserAliases(existing, userObj),
                workLocation: preferNew ? (u.workLocation || existing.workLocation) : (existing.workLocation || u.workLocation),
                schoolId: preferNew ? (u.schoolId || existing.schoolId) : (existing.schoolId || u.schoolId),
                photoUrl: preferNew ? (uPhoto || exPhoto) : (exPhoto || uPhoto),
                schoolAccessVerified: existing.schoolAccessVerified || u.schoolAccessVerified || false
              };
              const targetKey = preferNew ? userObj.id : matchedKey;
              usersMap.set(targetKey, merged);
              if (matchedKey !== targetKey) usersMap.delete(matchedKey);
            } else {
              usersMap.set(userObj.id, userObj);
            }
          }
        });
      }
    } catch {}

    // 3. Also check demo user profile
    try {
      const demoRaw = localStorage.getItem('demo_user_profile');
      if (demoRaw) {
        const demo = JSON.parse(demoRaw);
        if (demo && demo.id && !isRecentlyDeleted('users', String(demo.id))) {
          const existing = usersMap.get(demo.id);
          const dPhoto = typeof demo.photoUrl === 'string' ? demo.photoUrl.trim() : '';
          const ePhoto = typeof existing?.photoUrl === 'string' ? existing.photoUrl.trim() : '';
          usersMap.set(demo.id, {
            ...existing,
            ...demo,
            id: demo.id,
            aliasIds: collectUserAliases(existing, demo),
            role: demo.role || existing?.role || 'TEACHER',
            photoUrl: dPhoto || ePhoto
          });
        }
      }
    } catch {}

    // Ensure registered super admin مقتل نور الدين (meqnou@gmail.com) is always represented in central admins list
    const meqnouKey = findMatchingKey({ email: 'meqnou@gmail.com' });
    if (meqnouKey) {
      const existing = usersMap.get(meqnouKey)!;
      usersMap.set(meqnouKey, {
        ...existing,
        fullName: existing.fullName && existing.fullName !== 'أستاذ' && existing.fullName !== 'مستخدم' ? existing.fullName : 'مقتل نور الدين',
        email: existing.email || 'meqnou@gmail.com',
        role: 'CENTRAL_ADMIN',
        isSuperAdmin: true,
        isActive: existing.isActive !== false
      });
    } else if (!isRecentlyDeleted('users', 'admin_meqnou_gmail_com')) {
      usersMap.set('admin_meqnou_gmail_com', {
        id: 'admin_meqnou_gmail_com',
        fullName: 'مقتل نور الدين',
        email: 'meqnou@gmail.com',
        role: 'CENTRAL_ADMIN',
        isSuperAdmin: true,
        directorateId: 'taourirt',
        directorateName: 'المديرية الإقليمية بتاوريرت',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Ensure registered super admin أمين سنوسي (aminens21@gmail.com) is always represented as Central Admin & Educational Inspector, never as a school teacher
    const aminKey = findMatchingKey({ email: 'aminens21@gmail.com' }) || findMatchingKey({ fullName: 'أمين سنوسي' }) || findMatchingKey({ fullName: 'amine sanoussi' });
    if (aminKey) {
      const existing = usersMap.get(aminKey)!;
      const needsCloudHeal =
        existing.role !== 'CENTRAL_ADMIN' ||
        !existing.isSuperAdmin ||
        Boolean(existing.workLocation && existing.workLocation.trim()) ||
        Boolean(existing.schoolId && existing.schoolId.trim()) ||
        Boolean(existing.teachingCadre && existing.teachingCadre.trim()) ||
        existing.cadre !== 'مفتش تربوي';
      const normalizedAmin = normalizeCentralAdminUser(existing);
      usersMap.set(aminKey, normalizedAmin);
      if (needsCloudHeal && existing.id && !existing.id.startsWith('demo-') && !isCloudSyncPaused()) {
        setDoc(doc(db, 'users', existing.id), {
          fullName: normalizedAmin.fullName,
          email: 'aminens21@gmail.com',
          role: 'CENTRAL_ADMIN',
          isSuperAdmin: true,
          cadre: 'مفتش تربوي',
          workLocation: '',
          schoolId: '',
          teachingCadre: '',
          schoolAccessVerified: true,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      }
    } else if (!isRecentlyDeleted('users', 'admin_aminens21_gmail_com')) {
      usersMap.set('admin_aminens21_gmail_com', {
        id: 'admin_aminens21_gmail_com',
        fullName: 'أمين سنوسي',
        email: 'aminens21@gmail.com',
        role: 'CENTRAL_ADMIN',
        isSuperAdmin: true,
        cadre: 'مفتش تربوي',
        workLocation: '',
        schoolId: '',
        teachingCadre: '',
        schoolAccessVerified: true,
        directorateId: 'taourirt',
        directorateName: 'المديرية الإقليمية بتاوريرت',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    const mergedUsers = Array.from(usersMap.values()).map(u => fixTeacherFieldJumble(u));
    inMemoryCollectionCache['local_registered_users'] = mergedUsers;
    hasSyncedUsersForSchoolFilter = true;
    safeSetLocalJson('local_registered_users', mergedUsers);

    return deduplicateById(mergedUsers);
  },

  async getTeachers(): Promise<User[]> {
    try {
      const allUsers = await this.getUsers();
      return allUsers.filter(u =>
        (!u.role || u.role === 'TEACHER') &&
        !u.isSuperAdmin &&
        !(u.email && SUPER_ADMIN_EMAILS.some(e => isFlexibleEmailMatch(e, u.email!))) &&
        !isAmineSanoussiIdentity(u)
      );
    } catch (e) {
      console.warn("Firestore fetch teachers error:", e);
      return [];
    }
  },

  async cleanupDuplicateTeachers(primaryUser: Partial<User>): Promise<User | null> {
    if (!primaryUser || (!primaryUser.id && !primaryUser.email && !primaryUser.leaseNumber && !primaryUser.fullName)) {
      return null;
    }

    try {
      const allUsers = await this.getUsers();
      const primaryId = primaryUser.id;
      const cleanEmail = primaryUser.email?.trim().toLowerCase();
      const cleanLease = primaryUser.leaseNumber?.trim();
      const cleanName = primaryUser.fullName ? normalizeArabicName(primaryUser.fullName) : '';

      // Find all duplicate teacher records that represent the same teacher
      const duplicates = allUsers.filter(u => {
        if (primaryId && u.id === primaryId) return false;
        
        const emailMatch = !!(cleanEmail && u.email && isFlexibleEmailMatch(u.email, cleanEmail));
        const leaseMatch = !!(cleanLease && u.leaseNumber && u.leaseNumber === cleanLease);
        const nameMatch = !!(cleanName && u.fullName && normalizeArabicName(u.fullName) === cleanName && cleanName.length >= 6);

        return emailMatch || leaseMatch || nameMatch;
      });

      if (duplicates.length === 0) return null;

      let mergedPrimary: User = { ...primaryUser } as User;
      const idsToDelete: string[] = [];
      const collectedAliases = new Set<string>([
        ...(primaryId ? [primaryId] : []),
        ...(Array.isArray(primaryUser.aliasIds) ? primaryUser.aliasIds : [])
      ].filter(Boolean) as string[]);

      duplicates.forEach(dup => {
        if (dup.id) collectedAliases.add(dup.id);
        if (Array.isArray(dup.aliasIds)) {
          dup.aliasIds.forEach(aid => {
            if (aid) collectedAliases.add(aid);
          });
        }
        // Merge missing fields from duplicate into primary user
        mergedPrimary = {
          ...dup,
          ...mergedPrimary,
          aliasIds: Array.from(collectedAliases),
          workLocation: primaryUser.workLocation || dup.workLocation || '',
          schoolId: primaryUser.schoolId || dup.schoolId || '',
          leaseNumber: primaryUser.leaseNumber || dup.leaseNumber || '',
          phone: primaryUser.phone || dup.phone || '',
          email: primaryUser.email || dup.email || '',
          photoUrl: (primaryUser.photoUrl && String(primaryUser.photoUrl).trim()) || (dup.photoUrl && String(dup.photoUrl).trim()) || '',
          schoolAccessVerified: primaryUser.schoolAccessVerified ?? dup.schoolAccessVerified ?? false
        };

        if (dup.id && dup.id !== primaryId) {
          idsToDelete.push(dup.id);
        }
      });
      mergedPrimary.aliasIds = Array.from(collectedAliases);

      // Delete duplicates from local cache and Firestore
      for (const dupId of idsToDelete) {
        await this.deleteUser(dupId);
      }

      // Save the cleaned primary record
      if (primaryId) {
        await this.updateUserProfile(primaryId, mergedPrimary);
      }

      return mergedPrimary;
    } catch (err) {
      console.error("Error cleaning up duplicate teachers:", err);
      return null;
    }
  },

  async updateUserProfile(userId: string, profileData: Partial<User>): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();

    // Strip undefined values to prevent Firestore unsupported field value crashes
    const cleanProfileData: Record<string, any> = {};
    Object.entries(profileData).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanProfileData[key] = val;
      }
    });

    // 1. Update in local_registered_users list
    let users: User[] = [];
    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      users = localUsersRaw ? JSON.parse(localUsersRaw) : [];
    } catch {}
    if (users.length === 0 && Array.isArray(inMemoryCollectionCache['local_registered_users'])) {
      users = [...(inMemoryCollectionCache['local_registered_users'] as User[])];
    }

    const idx = users.findIndex((u: any) => 
      (userId && u.id === userId) || 
      (profileData.email && u.email?.toLowerCase() === profileData.email?.toLowerCase()) ||
      (profileData.leaseNumber && u.leaseNumber === profileData.leaseNumber)
    );

    let prevUserSnapshot: Partial<User> | null = idx >= 0 ? { ...users[idx] } : null;
    if (!prevUserSnapshot) {
      try {
        const demoRaw = localStorage.getItem('demo_user_profile');
        if (demoRaw) {
          const parsedDemo = JSON.parse(demoRaw) as User;
          if (parsedDemo && (parsedDemo.id === userId || (profileData.email && parsedDemo.email?.toLowerCase() === profileData.email?.toLowerCase()))) {
            prevUserSnapshot = parsedDemo;
          }
        }
      } catch {}
    }
    if (!prevUserSnapshot && profileData.refereeSpecialty !== undefined && userId) {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists()) {
          prevUserSnapshot = { id: snap.id, ...(snap.data() as any) };
        }
      } catch {}
    }

    const prevRefereeSpecialties: string[] = Array.isArray(prevUserSnapshot?.refereeSpecialty)
      ? prevUserSnapshot!.refereeSpecialty.filter(Boolean)
      : prevUserSnapshot?.refereeSpecialty
      ? [String(prevUserSnapshot.refereeSpecialty)]
      : [];

    let fullUserRecord: User;
    if (idx >= 0) {
      fullUserRecord = {
        ...users[idx],
        ...cleanProfileData,
        id: users[idx].id || userId,
        role: cleanProfileData.role || users[idx].role || 'TEACHER',
        directorateId: cleanProfileData.directorateId || users[idx].directorateId || activeDirId,
        isActive: users[idx].isActive !== undefined ? users[idx].isActive : true,
        updatedAt: new Date()
      };
      if (isAmineSanoussiIdentity(fullUserRecord)) {
        fullUserRecord = normalizeCentralAdminUser(fullUserRecord);
      }
      users[idx] = fullUserRecord;
    } else {
      fullUserRecord = {
        id: userId,
        fullName: cleanProfileData.fullName || (cleanProfileData as any).name || 'أستاذ',
        email: cleanProfileData.email || '',
        role: cleanProfileData.role || 'TEACHER',
        directorateId: cleanProfileData.directorateId || activeDirId,
        workLocation: cleanProfileData.workLocation || '',
        leaseNumber: cleanProfileData.leaseNumber || '',
        phone: cleanProfileData.phone || '',
        isActive: true,
        isTechCommitteeHead: !!cleanProfileData.isTechCommitteeHead,
        techCommitteeSports: cleanProfileData.techCommitteeSports || [],
        isTechCommitteeMember: !!cleanProfileData.isTechCommitteeMember,
        techCommitteeSportsMemberOf: cleanProfileData.techCommitteeSportsMemberOf || [],
        ...cleanProfileData,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      if (isAmineSanoussiIdentity(fullUserRecord)) {
        fullUserRecord = normalizeCentralAdminUser(fullUserRecord);
      }
      users.push(fullUserRecord);
    }
    inMemoryCollectionCache['local_registered_users'] = users;
    safeSetLocalJson('local_registered_users', users);

    // 2. Also sync demo user profile if matching
    try {
      const savedDemo = localStorage.getItem('demo_user_profile');
      if (savedDemo) {
        const parsed = JSON.parse(savedDemo) as User;
        if (parsed.id === userId || (profileData.email && parsed.email?.toLowerCase() === profileData.email?.toLowerCase()) || parsed.role === 'TEACHER') {
          const updatedDemo = { ...parsed, ...fullUserRecord, updatedAt: new Date() };
          localStorage.setItem('demo_user_profile', JSON.stringify(updatedDemo));
        }
      }
    } catch {}

    // 3. Sync full document to Firestore
    const targetDocId = fullUserRecord.id || userId;
    if (targetDocId) {
      markPendingWrite('users', targetDocId);
      try {
        await setDoc(doc(db, 'users', targetDocId), stripUndefinedDeep({
          ...fullUserRecord,
          id: targetDocId,
          updatedAt: serverTimestamp()
        }), { merge: true });
        clearPendingWrite('users', targetDocId);
      } catch (e) {
        console.warn("Firestore user profile update error:", e);
      }
    }

    try {
      // Trigger event for listeners
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('userDataChanged'));
        window.dispatchEvent(new CustomEvent('teacherProfileUpdated', { detail: fullUserRecord }));
      }

      // Synchronize changes to Schools (teacherName & teacher phone) ONLY for school teachers (never Central/Super Admins or Inspectors)
      const isCentralOrInspector =
        fullUserRecord.role === 'CENTRAL_ADMIN' ||
        fullUserRecord.role === 'SUPER_ADMIN' ||
        fullUserRecord.isSuperAdmin === true ||
        isAmineSanoussiIdentity(fullUserRecord);
      if (!isCentralOrInspector && (profileData.workLocation || profileData.fullName || profileData.phone)) {
        const schoolsList = getLocal<School>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
        let schoolChanged = false;
        const updatedSchools = schoolsList.map(sch => {
          const matchesWork = profileData.workLocation && (
            sch.name.trim().toLowerCase() === profileData.workLocation.trim().toLowerCase() ||
            sch.name.includes(profileData.workLocation) ||
            profileData.workLocation.includes(sch.name)
          );
          const matchesTeacherName = profileData.fullName && sch.teacherName && (
            sch.teacherName.trim().toLowerCase() === profileData.fullName.trim().toLowerCase()
          );

          if (matchesWork || matchesTeacherName) {
            schoolChanged = true;
            return {
              ...sch,
              ...(profileData.fullName ? { teacherName: profileData.fullName } : {}),
              ...(profileData.phone ? { phone: profileData.phone } : {})
            };
          }
          return sch;
        });

        if (schoolChanged) {
          setLocal(STORAGE_KEYS.SCHOOLS, updatedSchools);
          try {
            const matched = updatedSchools.filter(s => {
              const prev = schoolsList.find(ps => ps.id === s.id);
              return prev && (prev.phone !== s.phone || prev.teacherName !== s.teacherName);
            });
            for (const ms of matched) {
              await setDoc(doc(db, 'schools', ms.id), stripUndefinedDeep({
                teacherName: ms.teacherName,
                phone: ms.phone,
                updatedAt: Timestamp.now()
              }), { merge: true }).catch(() => {});
            }
          } catch (e) {
            console.warn("Error syncing teacher phone to schools Firestore:", e);
          }
        }
      }

      // Synchronize changes to Referees list
      const linkedRefIds: string[] = [];
      if (
        profileData.phone ||
        profileData.fullName ||
        profileData.refereeSpecialty !== undefined ||
        profileData.refereeDiplomas !== undefined ||
        profileData.refereeDiploma !== undefined
      ) {
        const norm = (s?: string) => (s || '').replace(/[\s\-\_\.]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').toLowerCase();
        const refList = deduplicateById([...getLocal<Referee>('taourirt_referees_data', []), ...getLocal<Referee>('referees', [])]);
        let refChanged = false;
        const candidateNames = Array.from(new Set([profileData.fullName, prevUserSnapshot?.fullName].filter(Boolean) as string[]));
        const normalizedSpecs = profileData.refereeSpecialty !== undefined
          ? (Array.isArray(profileData.refereeSpecialty) ? profileData.refereeSpecialty : (profileData.refereeSpecialty ? [profileData.refereeSpecialty] : []))
          : undefined;

        const isMatchingRef = (r: Referee) => {
          const matchId = r.id === userId || r.id === targetDocId || r.teacherId === userId || r.teacherId === targetDocId;
          const rClean = norm((r.fullName || '').replace(/\s*\(أستاذ\)\s*/g, ''));
          const matchName = candidateNames.some(tn => {
            const tClean = norm(tn);
            return tClean && rClean && (rClean === tClean || rClean.includes(tClean) || tClean.includes(rClean));
          });
          return matchId || matchName;
        };

        const updatedRefList = refList.map(r => {
          if (isMatchingRef(r)) {
            if (r.id) linkedRefIds.push(r.id);
            refChanged = true;
            return {
              ...r,
              ...(profileData.phone ? { phone: profileData.phone } : {}),
              ...(profileData.fullName ? { fullName: profileData.fullName } : {}),
              ...(normalizedSpecs !== undefined ? { specialty: normalizedSpecs } : {}),
              ...(profileData.refereeDiploma !== undefined ? { diploma: profileData.refereeDiploma } : {}),
              ...(profileData.refereeDiplomas !== undefined ? { specialtyDiplomas: profileData.refereeDiplomas } : {})
            };
          }
          return r;
        });

        if (refChanged) {
          setLocal('taourirt_referees_data', updatedRefList);
          setLocal('referees', updatedRefList);
          try {
            const matched = updatedRefList.filter(isMatchingRef);
            for (const mr of matched) {
              await setDoc(doc(db, 'referees', mr.id), stripUndefinedDeep({
                ...(profileData.phone ? { phone: profileData.phone } : {}),
                ...(profileData.fullName ? { fullName: profileData.fullName } : {}),
                ...(normalizedSpecs !== undefined ? { specialty: normalizedSpecs } : {}),
                ...(profileData.refereeDiploma !== undefined ? { diploma: profileData.refereeDiploma } : {}),
                ...(profileData.refereeDiplomas !== undefined ? { specialtyDiplomas: profileData.refereeDiplomas } : {}),
                updatedAt: Timestamp.now()
              }), { merge: true }).catch(() => {});
            }
          } catch (e) {
            console.warn("Error syncing referee updates to Firestore:", e);
          }
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('refereesUpdated'));
          }
        }
      }

      // Remove this teacher cleanly from scheduled matches whenever they withdraw from refereeing a sport
      if (profileData.refereeSpecialty !== undefined) {
        const nextSpecs: string[] = Array.isArray(profileData.refereeSpecialty)
          ? profileData.refereeSpecialty.filter(Boolean)
          : profileData.refereeSpecialty
          ? [String(profileData.refereeSpecialty)]
          : [];
        const removedSports = prevRefereeSpecialties.filter(
          prevSp => !nextSpecs.some(nextSp => areSportIdsEquivalent(nextSp, prevSp))
        );
        if (removedSports.length > 0 || nextSpecs.length === 0) {
          await this.removeRefereeFromScheduledMatches({
            userId: targetDocId || userId,
            refereeIds: Array.from(new Set([userId, targetDocId, ...linkedRefIds].filter(Boolean))),
            fullNames: Array.from(new Set([
              prevUserSnapshot?.fullName || '',
              fullUserRecord.fullName || '',
              profileData.fullName || ''
            ].filter(Boolean))),
            removedSports,
            removeAll: nextSpecs.length === 0
          });
        }
      }
    } catch (err) {
      console.warn("Local storage update profile error:", err);
    }
  },

  async deleteUser(userId: string): Promise<void> {
    markRecentlyDeleted('users', userId);
    try {
      await deleteDoc(doc(db, 'users', userId));
    } catch (e) {
      console.warn("Deleted from Firestore failed, proceeding with local:", e);
    }

    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      if (localUsersRaw) {
        const users = JSON.parse(localUsersRaw) as User[];
        const updated = users.filter(u => u.id !== userId);
        inMemoryCollectionCache['local_registered_users'] = updated;
        localStorage.setItem('local_registered_users', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Local storage delete user error:", e);
    }
    window.dispatchEvent(new CustomEvent('userDataChanged'));
  },

  async deleteAllTeachers(): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    
    // 1. Delete from Firestore
    try {
      const q = query(
        collection(db, 'users'), 
        where('role', '==', 'TEACHER'),
        where('directorateId', '==', activeDirId)
      );
      const snap = await getDocs(q);
      
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          markRecentlyDeleted('users', d.id);
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.error("Error deleting all teachers from Firestore:", e);
    }

    // 2. Delete from Local Storage
    try {
      const localUsersRaw = localStorage.getItem('local_registered_users');
      if (localUsersRaw) {
        const users = JSON.parse(localUsersRaw) as User[];
        users.forEach(u => {
          if (u.role === 'TEACHER' && (u.directorateId || 'taourirt') === activeDirId && u.id) {
            markRecentlyDeleted('users', u.id);
          }
        });
        const updated = users.filter(u => 
          !(u.role === 'TEACHER' && (u.directorateId || 'taourirt') === activeDirId)
        );
        inMemoryCollectionCache['local_registered_users'] = updated;
        localStorage.setItem('local_registered_users', JSON.stringify(updated));
      }
    } catch (e) {
      console.warn("Local storage delete all teachers error:", e);
    }
    window.dispatchEvent(new CustomEvent('userDataChanged'));
  },

  // DIRECTORATE TRANSFER WORKFLOW FOR TEACHERS
  async requestTeacherTransfer(
    userId: string,
    targetDirectorateId: string,
    targetDirectoratePin: string
  ): Promise<{ success: boolean; message: string; transfer?: DirectorateTransferRequest }> {
    // 1. Verify PIN for target directorate
    const isPinValid = await this.verifyDirectorateCode(targetDirectorateId, targetDirectoratePin.trim());
    if (!isPinValid) {
      return { success: false, message: 'القن السري للمديرية الإقليمية المستهدفة غير صحيح. يرجى التأكد وإعادة المحاولة.' };
    }

    // 2. Fetch target directorate details
    const directorates = await this.getDirectorates();
    const targetDir = directorates.find(d => d.id === targetDirectorateId);
    if (!targetDir) {
      return { success: false, message: 'المديرية الإقليمية المستهدفة غير موجودة.' };
    }

    // 3. Fetch user details
    const users = await this.getUsers();
    const currentUser = users.find(u => u.id === userId);
    if (!currentUser) {
      return { success: false, message: 'تعذر العثور على حساب الأستاذ.' };
    }

    const currentDirId = currentUser.directorateId || 'taourirt';
    if (currentDirId === targetDirectorateId) {
      return { success: false, message: 'أنت منتمٍ بالفعل لهذه المديرية الإقليمية.' };
    }

    const currentDir = directorates.find(d => d.id === currentDirId);

    // 4. Create pending transfer object
    const transferReq: DirectorateTransferRequest = {
      targetDirectorateId,
      targetDirectorateName: targetDir.name,
      targetDirectorateRegion: targetDir.region,
      currentDirectorateId: currentDirId,
      currentDirectorateName: currentDir?.name || 'المديرية الإقليمية بتاوريرت',
      requestedAt: new Date().toISOString(),
      status: 'pending',
      teacherId: currentUser.id,
      teacherName: currentUser.fullName,
      leaseNumber: currentUser.leaseNumber,
      workLocation: currentUser.workLocation,
      phone: currentUser.phone,
      teachingCadre: currentUser.teachingCadre
    };

    // 5. Update user profile with pendingTransfer (do NOT change directorateId yet!)
    await this.updateUserProfile(userId, {
      pendingTransfer: transferReq
    });

    // 6. Send system notification to the sport managers / coordinators of the target directorate
    try {
      await this.addNotification({
        title: `طلب انتقال أستاذ وارد: ${currentUser.fullName}`,
        body: `طلب الأستاذ ${currentUser.fullName} (رقم التأجير: ${currentUser.leaseNumber || 'غير محدد'}) الانتقال إلى ${targetDir.name}. بانتظار موافقتكم.`,
        role: 'SPORT_MANAGER',
        directorateId: targetDirectorateId
      });
    } catch (e) {
      console.warn("Notification dispatch for transfer request warning:", e);
    }

    return {
      success: true,
      message: `تم التحقق من القن السري وتقديم طلب الانتقال إلى مديرية ${targetDir.name} بنجاح. الطلب الآن قيد المعالجة في انتظار موافقة المسؤول الإقليمي.`,
      transfer: transferReq
    };
  },

  async cancelTeacherTransfer(userId: string): Promise<void> {
    await this.updateUserProfile(userId, {
      pendingTransfer: null
    });
  },

  async approveTeacherTransfer(
    teacherId: string,
    targetDirectorateId: string,
    targetDirectorateName: string
  ): Promise<void> {
    // Update teacher profile: assign new directorate and clear pending transfer
    await this.updateUserProfile(teacherId, {
      directorateId: targetDirectorateId,
      directorateName: targetDirectorateName,
      pendingTransfer: null
    });

    // Send confirmation notification to the teacher
    try {
      await this.addNotification({
        title: 'تهانينا! تمت الموافقة على طلب انتقالكم 🎉',
        body: `وافق المسؤول الإقليمي لـ (${targetDirectorateName}) على طلب انتقالك. يمكنك الآن الولوج والتفاعل مع كافة أنشطة مديريتك الجديدة.`,
        userIds: [teacherId],
        role: 'TEACHER',
        directorateId: targetDirectorateId
      });
    } catch (e) {
      console.warn("Approval notification error:", e);
    }
  },

  async rejectTeacherTransfer(teacherId: string, reason?: string): Promise<void> {
    await this.updateUserProfile(teacherId, {
      pendingTransfer: null
    });

    try {
      await this.addNotification({
        title: 'إشعار بشأن طلب الانتقال',
        body: `نأسف لإبلاغكم بأنه لم تتم الموافقة على طلب الانتقال إلى المديرية المطلوبة${reason ? `: ${reason}` : ' من قبل المسؤول الإقليمي.'}`,
        userIds: [teacherId],
        role: 'TEACHER'
      });
    } catch (e) {
      console.warn("Rejection notification error:", e);
    }
  },

  async getPendingTransfersForDirectorate(targetDirectorateId: string): Promise<User[]> {
    const users = await this.getUsers();
    return users.filter(u => 
      u.role === 'TEACHER' && 
      u.pendingTransfer && 
      u.pendingTransfer.status === 'pending' &&
      u.pendingTransfer.targetDirectorateId === targetDirectorateId
    );
  },

  // Direct phone update for teacher, school principal, or referee
  async updateContactPhone(target: {
    type: 'teacher' | 'school' | 'principal' | 'referee';
    id?: string;
    schoolId?: string;
    schoolName?: string;
    name?: string;
    phone: string;
  }): Promise<void> {
    const cleanPhone = target.phone.trim();
    if (!cleanPhone) return;

    // 1. If it's a School or Principal
    if (target.type === 'principal' || target.type === 'school') {
      const schoolsList = getLocal<School>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
      const targetSchool = schoolsList.find(s => 
        (target.schoolId && s.id === target.schoolId) ||
        (target.id && s.id === target.id) ||
        (target.schoolName && (s.name === target.schoolName || s.name.includes(target.schoolName)))
      );

      if (targetSchool) {
        const fieldToUpdate = target.type === 'principal' ? { principalPhone: cleanPhone } : { phone: cleanPhone };
        await this.updateSchool(targetSchool.id, fieldToUpdate);
      }
    }

    // 2. If it's a Teacher
    if (target.type === 'teacher') {
      const allUsers = await this.getUsers();
      const matchedUser = allUsers.find(u => 
        (target.id && u.id === target.id) ||
        (target.name && u.fullName === target.name) ||
        (target.schoolName && u.workLocation && (u.workLocation === target.schoolName || target.schoolName.includes(u.workLocation)))
      );

      if (matchedUser) {
        await this.updateUserProfile(matchedUser.id, { phone: cleanPhone });
      }

      // Also update matching school's teacher phone
      const schoolsList = getLocal<School>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
      const targetSchool = schoolsList.find(s => 
        (target.schoolId && s.id === target.schoolId) ||
        (target.schoolName && (s.name === target.schoolName || s.name.includes(target.schoolName))) ||
        (target.name && s.teacherName && s.teacherName === target.name)
      );
      if (targetSchool) {
        await this.updateSchool(targetSchool.id, { phone: cleanPhone });
      }
    }

    // 3. If it's a Referee
    if (target.type === 'referee') {
      const referees = await this.getReferees();
      const matchedRef = referees.find(r => 
        (target.id && r.id === target.id) ||
        (target.name && (r.fullName === target.name || r.fullName.includes(target.name)))
      );
      if (matchedRef && !matchedRef.isTeacher) {
        await this.updateReferee(matchedRef.id, { phone: cleanPhone });
      } else if (matchedRef && matchedRef.isTeacher) {
        await this.updateUserProfile(matchedRef.id, { phone: cleanPhone });
      }
    }
  },

  // ACTIVE SEASON CONFIGURATION
  async getSeasons(): Promise<string[]> {
    try {
      const snap = await getDocs(collection(db, 'config'));
      const seasonsDoc = snap.docs.find(d => d.id === 'seasons');
      if (seasonsDoc && seasonsDoc.data().list) {
        return seasonsDoc.data().list;
      }
    } catch (e) {
      console.warn("Error loading seasons list from Firestore:", e);
    }
    const local = localStorage.getItem('taourirt_sports_seasons_list');
    if (local) {
      try {
        return JSON.parse(local);
      } catch {}
    }
    return ['2025/2026', '2026/2027'];
  },

  async addSeason(season: string): Promise<void> {
    const current = await this.getSeasons();
    if (current.includes(season)) return;
    const newList = [...current, season].sort();
    localStorage.setItem('taourirt_sports_seasons_list', JSON.stringify(newList));
    try {
      await setDoc(doc(db, 'config', 'seasons'), {
        list: newList,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Error saving seasons list to Firestore:", e);
    }
  },

  async getActiveSeason(): Promise<string> {
    try {
      const snap = await getDoc(doc(db, 'config', 'season'));
      if (snap.exists()) {
        const season = snap.data().current || '2026/2027';
        localStorage.setItem('taourirt_sports_season', season);
        // Sync legacy key
        localStorage.setItem('active_season', season);
        return season;
      }
    } catch (e) {
      console.warn("Error loading active season from Firestore:", e);
    }
    return localStorage.getItem('taourirt_sports_season') || '2026/2027';
  },

  subscribeToActiveSeason(callback: (season: string) => void): () => void {
    try {
      return onSnapshot(doc(db, 'config', 'season'), (docSnap) => {
        if (docSnap.exists()) {
          const season = docSnap.data().current || '2026/2027';
          localStorage.setItem('taourirt_sports_season', season);
          localStorage.setItem('active_season', season);
          callback(season);
        }
      }, (error) => {
        console.warn("Firestore subscription error for active season:", error);
      });
    } catch (e) {
      console.warn("Error setting up onSnapshot for active season:", e);
      return () => {};
    }
  },

  async setActiveSeason(season: string): Promise<void> {
    localStorage.setItem('taourirt_sports_season', season);
    localStorage.setItem('active_season', season);
    window.dispatchEvent(new CustomEvent('seasonChanged', { detail: season }));
    try {
      await setDoc(doc(db, 'config', 'season'), {
        current: season,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Error saving season to Firestore:", e);
    }
  },

  // SPORTS CONFIGURATION
  async getSportsConfig(): Promise<Sport[]> {
    let fetchedSports: Sport[] = [];
    try {
      const snap = await getDocs(collection(db, 'sports'));
      if (!snap.empty) {
        fetchedSports = snap.docs.map(d => ({ id: d.id, ...d.data() } as Sport));
      }
    } catch (e) {
      console.warn("Firestore fetch sports error, falling back to local cache:", e);
    }

    const localSports = getLocal<Sport>('taourirt_sports_config', []);
    if (fetchedSports.length === 0) {
      fetchedSports = localSports;
    } else if (localSports.length > 0) {
      const map = new Map<string, Sport>();
      fetchedSports.forEach(s => map.set(s.id, s));
      localSports.forEach(loc => {
        const remote = map.get(loc.id);
        if (remote) {
          map.set(loc.id, {
            ...remote,
            ...loc,
            isDeleted: loc.isDeleted !== undefined ? loc.isDeleted : remote.isDeleted,
            ageCategories: (loc.ageCategories && loc.ageCategories.length > 0) ? loc.ageCategories : remote.ageCategories
          });
        } else {
          map.set(loc.id, loc);
        }
      });
      fetchedSports = Array.from(map.values());
    }

    const getDefaultCatIdsForSport = (sId: string): string[] => {
      if (isTeamSport(sId)) return ['U12', 'U15', 'U18'];
      if (isTrackOrCrossCountrySport(sId)) return ['U12', 'U15', 'U18', 'U20'];
      if (sId === 'judo' || sId === 'weightlifting' || sId === 'karate') return ['U15', 'U17', 'U18', 'U20'];
      if (sId === 'boxing') return ['U17', 'U18', 'U20'];
      return ['U12', 'U15', 'U17', 'U18', 'U20'];
    };

    // 1. Merge default base sports
    const mergedBase: Sport[] = Object.entries(BASE_SPORTS).map(([id, s]) => {
      const existing = fetchedSports.find(item => item.id === id);
      if (existing) {
        if (existing.isDeleted) {
          return {
            ...existing,
            id,
            name: s.name,
            icon: s.icon,
            isDeleted: true
          };
        }
        // Prevent tournament title corruption from ever overriding base sport discipline name
        const isTournamentTitle = existing.name && (
          existing.name.includes('البطولة') ||
          existing.name.includes('دوري') ||
          existing.name.includes('بطولة')
        );
        const cleanName = isTournamentTitle || !existing.name ? s.name : existing.name;

        return {
          ...existing,
          name: cleanName,
          icon: existing.icon || s.icon,
          description: existing.description || `منافسات ${s.name} الإقليمية`
        };
      }
      return {
        id,
        name: s.name,
        icon: s.icon,
        description: `منافسات ${s.name} الإقليمية`,
        ageCategories: getDefaultCatIdsForSport(id),
        studentLimit: 0,
        athleticsSpecialties: []
      };
    });

    // 2. Custom sports created by central admin (any sport in fetchedSports not in BASE_SPORTS)
    const customSports: Sport[] = fetchedSports
      .filter(item => !Object.prototype.hasOwnProperty.call(BASE_SPORTS, item.id))
      .map(item => {
        let cleanName = item.name || 'رياضة جديدة';
        if (cleanName.includes('البطولة الإقليمية لـ')) {
          cleanName = cleanName.replace(/البطولة الإقليمية لـ\s*/, '').trim();
        } else if (cleanName.includes('البطولة الإقليمية')) {
          cleanName = cleanName.replace(/البطولة الإقليمية\s*/, '').trim();
        }
        return {
          ...item,
          name: cleanName || 'رياضة جديدة',
          icon: item.icon || '🏆',
          description: item.description || `منافسات ${cleanName || 'رياضة جديدة'} المدرسية`,
          ageCategories: item.ageCategories || getDefaultCatIdsForSport(item.id),
          studentLimit: item.studentLimit !== undefined ? item.studentLimit : 0,
          athleticsSpecialties: item.athleticsSpecialties || [],
          isCustom: true
        };
      });

    const allSports: Sport[] = deduplicateById<Sport>([...mergedBase, ...customSports]).map(s => {
      const sportDefaultCats = getDefaultCatIdsForSport(s.id);
      const isTeam = isTeamSport(s.id);
      const isCC = isTrackOrCrossCountrySport(s.id);
      const rawCats = (Array.isArray(s.ageCategories) ? s.ageCategories : sportDefaultCats) as string[];
      const allowedPool = isTeam
        ? ['U12', 'U15', 'U18']
        : isCC
        ? ['U12', 'U15', 'U18', 'U20']
        : ['U12', 'U15', 'U17', 'U18', 'U20'];
      
      // Clean raw categories from technical hashes and enforce sport-type separation (no U17 in team sports)
      const normalizedCats = Array.from(new Set(
        rawCats
          .map(c => normalizeCategoryKey(c))
          .filter(c => !/^CAT_/i.test(c) && !/^cat_/i.test(c) && allowedPool.includes(c))
      ));
      const validCats = normalizedCats.length > 0 ? normalizedCats : sportDefaultCats;

      const cleanedCustom = (s.customAgeCategories || [])
        .map(cat => sanitizeCustomCategoryForSport(cat, s.id))
        .filter((cat): cat is CustomAgeCategory => Boolean(cat));

      // Clean category student limits keys
      const cleanCategoryLimits: Record<string, number> = {};
      if (s.categoryStudentLimits) {
        Object.entries(s.categoryStudentLimits).forEach(([k, v]) => {
          if (!/^CAT_/i.test(k) && !/^cat_/i.test(k)) {
            const cleanKey = normalizeCategoryKey(k);
            if (allowedPool.includes(cleanKey)) {
              cleanCategoryLimits[cleanKey] = v;
            }
          }
        });
      }

      // Normalize targetAffiliations so legacy IDs map cleanly to 'non_club' and 'club_affiliated'
      const rawAffs = Array.isArray(s.targetAffiliations) ? s.targetAffiliations : [];
      let normalizedAffs: string[] = ['non_club', 'club_affiliated'];
      if (rawAffs.length > 0) {
        const hasLegacy = rawAffs.some(id =>
          ['espoir_non_club', 'sports_tracks', 'espoir_club'].includes(id)
        );
        const mapped = Array.from(
          new Set(
            rawAffs.map(id =>
              id === 'club_affiliated' || id === 'espoir_club' ? 'club_affiliated' : 'non_club'
            )
          )
        );
        normalizedAffs = hasLegacy
          ? ['non_club', 'club_affiliated']
          : mapped.length > 0
          ? mapped
          : ['non_club', 'club_affiliated'];
      }

      return {
        ...s,
        ageCategories: validCats,
        targetAffiliations: normalizedAffs,
        customAgeCategories: cleanedCustom.length > 0 ? cleanedCustom : undefined,
        categoryStudentLimits: Object.keys(cleanCategoryLimits).length > 0 ? cleanCategoryLimits : undefined
      };
    });

    // Keep SPORTS_MAP in sync with all current sports
    allSports.forEach(s => {
      SPORTS_MAP[s.id] = { name: s.name, icon: s.icon || '🏆' };
    });

    // Cache custom sports in localStorage for instantaneous boot
    const customListOnly = allSports.filter(s => s.isCustom);
    if (customListOnly.length > 0) {
      localStorage.setItem('taourirt_custom_sports', JSON.stringify(customListOnly.map(s => ({ id: s.id, name: s.name, icon: s.icon || '🏆' }))));
    }

    setLocal('taourirt_sports_config', allSports);
    return allSports.filter(s => s && !s.isDeleted);
  },

  async addSport(sport: {
    name: string;
    id?: string;
    icon?: string;
    description?: string;
    ageCategories: string[];
    studentLimit?: number;
    athleticsSpecialties?: string[];
    customAgeCategories?: CustomAgeCategory[];
    categoryStudentLimits?: Record<string, number>;
    targetAffiliations?: string[];
  }): Promise<Sport> {
    const cleanName = sport.name.trim();
    // Unique ID from latin characters or sport_timestamp
    let sportId = (sport.id || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^_+|_+$/g, '');
    if (!sportId) {
      sportId = `sport_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    }

    const newSport: Sport = {
      id: sportId,
      name: cleanName,
      icon: sport.icon || '🏆',
      description: sport.description?.trim() || `منافسات ${cleanName} المدرسية الإقليمية`,
      ageCategories: sport.ageCategories,
      customAgeCategories: sport.customAgeCategories || [],
      studentLimit: sport.studentLimit !== undefined ? sport.studentLimit : 0,
      categoryStudentLimits: sport.categoryStudentLimits || {},
      targetAffiliations: sport.targetAffiliations || ['non_club', 'club_affiliated'],
      athleticsSpecialties: sport.athleticsSpecialties || [],
      isCustom: true,
      createdAt: new Date().toISOString()
    };

    // Register immediately in runtime SPORTS_MAP
    SPORTS_MAP[sportId] = { name: newSport.name, icon: newSport.icon || '🏆' };

    const currentSports = await this.getSportsConfig();
    const updatedSports = deduplicateById<Sport>([...currentSports.filter(s => s.id !== sportId), newSport]);
    setLocal('taourirt_sports_config', updatedSports);

    const customOnly = updatedSports.filter(s => s.isCustom);
    localStorage.setItem('taourirt_custom_sports', JSON.stringify(customOnly.map(s => ({ id: s.id, name: s.name, icon: s.icon || '🏆' }))));

    try {
      await setDoc(doc(db, 'sports', sportId), {
        ...newSport,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Added custom sport locally, Firestore pending:", e);
    }

    return newSport;
  },

  async deleteSport(sportId: string): Promise<void> {
    // Delete from runtime SPORTS_MAP
    delete SPORTS_MAP[sportId];

    // Load full local sports (including any previously deleted)
    const currentLocal = getLocal<Sport>('taourirt_sports_config', []);
    let updatedSports = currentLocal.map(s => {
      if (s.id === sportId) {
        return { ...s, isDeleted: true };
      }
      return s;
    });

    if (BASE_SPORTS[sportId]) {
      // If base sport not yet in local list, explicitly insert it with isDeleted: true
      if (!updatedSports.some(s => s.id === sportId)) {
        updatedSports.push({
          id: sportId,
          name: BASE_SPORTS[sportId].name,
          icon: BASE_SPORTS[sportId].icon,
          description: `منافسات ${BASE_SPORTS[sportId].name} الإقليمية`,
          ageCategories: [],
          isDeleted: true
        });
      }
    } else {
      // Custom sport: filter it out or mark isDeleted
      updatedSports = updatedSports.filter(s => s.id !== sportId);
    }

    setLocal('taourirt_sports_config', updatedSports);

    const customOnly = updatedSports.filter(s => s.isCustom && !s.isDeleted);
    localStorage.setItem('taourirt_custom_sports', JSON.stringify(customOnly.map(s => ({ id: s.id, name: s.name, icon: s.icon || '🏆' }))));

    // Dispatch event so any other components (e.g. SportsBar, Navigation) update immediately
    window.dispatchEvent(new CustomEvent('sportsConfigChanged', { detail: { deletedId: sportId } }));

    try {
      if (BASE_SPORTS[sportId]) {
        // For base sports, update the document to mark as deleted in Firestore
        await setDoc(doc(db, 'sports', sportId), { isDeleted: true }, { merge: true });
      } else {
        // For custom sports, delete the document
        await deleteDoc(doc(db, 'sports', sportId));
      }
    } catch (e) {
      console.warn("Deleted sport locally, Firestore pending:", e);
    }
  },

  async updateSportCategories(
    sportId: string,
    ageCategories: string[],
    studentLimit?: number,
    athleticsSpecialties?: string[],
    name?: string,
    icon?: string,
    isProgrammed?: boolean,
    customAgeCategories?: CustomAgeCategory[],
    categoryStudentLimits?: Record<string, number>,
    targetAffiliations?: string[]
  ): Promise<void> {
    const list = await this.getSportsConfig();
    const existingSport = list.find(s => s.id === sportId);

    // Prevent tournament title corruption from setting sport name
    const isTournamentTitle = name && (
      name.includes('البطولة') ||
      name.includes('دوري') ||
      name.includes('بطولة')
    );
    const validSportName = isTournamentTitle ? undefined : name;

    const updated = list.map(s => {
      if (s.id !== sportId) return s;
      return {
        ...s,
        ageCategories,
        customAgeCategories: customAgeCategories !== undefined ? customAgeCategories : s.customAgeCategories,
        studentLimit: studentLimit !== undefined ? studentLimit : s.studentLimit,
        categoryStudentLimits: categoryStudentLimits !== undefined ? categoryStudentLimits : s.categoryStudentLimits,
        targetAffiliations: targetAffiliations !== undefined ? targetAffiliations : (s.targetAffiliations || ['non_club', 'club_affiliated']),
        athleticsSpecialties: athleticsSpecialties !== undefined ? athleticsSpecialties : s.athleticsSpecialties,
        name: validSportName || s.name,
        icon: icon || s.icon,
        isProgrammed: isProgrammed !== undefined ? isProgrammed : s.isProgrammed
      };
    });
    setLocal('taourirt_sports_config', updated);

    if (validSportName || icon) {
      SPORTS_MAP[sportId] = {
        name: validSportName || SPORTS_MAP[sportId]?.name || 'الرياضة',
        icon: icon || SPORTS_MAP[sportId]?.icon || '🏆'
      };
    }

    try {
      await setDoc(doc(db, 'sports', sportId), {
        ageCategories,
        customAgeCategories: customAgeCategories !== undefined ? customAgeCategories : (existingSport?.customAgeCategories || null),
        studentLimit: studentLimit !== undefined ? studentLimit : (existingSport?.studentLimit || null),
        categoryStudentLimits: categoryStudentLimits !== undefined ? categoryStudentLimits : (existingSport?.categoryStudentLimits || null),
        targetAffiliations: targetAffiliations !== undefined ? targetAffiliations : (existingSport?.targetAffiliations || ['non_club', 'club_affiliated']),
        athleticsSpecialties: athleticsSpecialties !== undefined ? athleticsSpecialties : (existingSport?.athleticsSpecialties || null),
        ...(isProgrammed !== undefined ? { isProgrammed } : {}),
        ...(validSportName ? { name: validSportName } : {}),
        ...(icon ? { icon } : {}),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Updated sport categories locally, Firestore pending:", e);
    }
    window.dispatchEvent(new Event('sportsConfigUpdated'));
  },

  async updateSportRosterLimit(sportId: string, studentLimit: number): Promise<void> {
    const cleanLimit = Math.max(0, Math.floor(Number(studentLimit) || 0));
    const list = await this.getSportsConfig();
    const updated = list.map(s => {
      if (s.id !== sportId) return s;
      return {
        ...s,
        studentLimit: cleanLimit,
        categoryStudentLimits: {}
      };
    });
    setLocal('taourirt_sports_config', updated);

    try {
      await setDoc(doc(db, 'sports', sportId), {
        studentLimit: cleanLimit,
        categoryStudentLimits: {},
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Updated sport roster limit locally, Firestore pending:", e);
    }
    window.dispatchEvent(new Event('sportsConfigUpdated'));
  },

  // STUDENTS / TEAM ROSTERS
  async getStudents(targetDirectorateId?: string, all?: boolean): Promise<Student[]> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    let allStudents: Student[] = [];
    try {
      const snap = await getDocs(collection(db, 'students'));
      const localList = getLocal<Student>('taourirt_students_data', []).filter(s => s && !isRecentlyDeleted('students', s.id));
      const pendingLocal = localList.filter(s => isPendingWrite('students', s.id));

      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('students', d.id))
          .map(d => ({ id: d.id, ...d.data(), directorateId: d.data().directorateId || 'taourirt' } as Student));
        allStudents = deduplicateById([...pendingLocal, ...firestoreList]);
        setLocal('taourirt_students_data', allStudents);
      } else {
        allStudents = deduplicateById(pendingLocal);
        setLocal('taourirt_students_data', allStudents);
      }
    } catch (e) {
      console.warn("Firestore fetch students error, using local storage:", e);
      allStudents = getLocal<Student>('taourirt_students_data', []).filter(s => s && !isRecentlyDeleted('students', s.id));
    }
    const cleanList = deduplicateById(allStudents);
    if (all === true || !activeDirId || activeDirId === 'all') {
      return cleanList;
    }
    return cleanList.filter(s => (s.directorateId || 'taourirt') === activeDirId);
  },

  subscribeToStudents(callback: (students: Student[]) => void): () => void {
    const emitLocal = () => {
      const localList = getLocal<Student>('taourirt_students_data', []).filter(s => s && !isRecentlyDeleted('students', s.id));
      callback(localList);
    };
    const handleLocalUpdate = () => {
      if (isCloudSyncPaused()) emitLocal();
    };
    window.addEventListener('studentsUpdated', handleLocalUpdate);

    try {
      if (isCloudSyncPaused()) emitLocal();
      const unsubscribe = onSnapshot(collection(db, 'students'), (snap) => {
        const localList = getLocal<Student>('taourirt_students_data', []).filter(s => s && !isRecentlyDeleted('students', s.id));
        const pendingLocal = localList.filter(s => isPendingWrite('students', s.id));
        const firestoreList = snap.docs
          .filter((d: any) => !isRecentlyDeleted('students', d.id))
          .map((d: any) => ({ id: d.id, ...d.data() } as Student));
        const merged = deduplicateById([...pendingLocal, ...firestoreList]);
        setLocal('taourirt_students_data', merged);
        callback(merged);
      }, (err) => {
        console.warn("Real-time students listener error:", err);
      });
      return () => {
        window.removeEventListener('studentsUpdated', handleLocalUpdate);
        unsubscribe();
      };
    } catch (err) {
      console.warn("Failed to subscribe to students:", err);
      return () => {
        window.removeEventListener('studentsUpdated', handleLocalUpdate);
      };
    }
  },

  async addStudent(student: Omit<Student, 'id' | 'createdAt' | 'updatedAt'>): Promise<Student> {
    const activeDirId = this.getActiveDirectorateId();
    const studentWithDir = {
      ...student,
      directorateId: (student as any).directorateId || activeDirId
    };
    const studentId = `stud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newStudent: Student = {
      ...studentWithDir,
      id: studentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as any;

    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', [newStudent, ...localList.filter(s => s.id !== studentId)]);
    markPendingWrite('students', studentId);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...studentWithDir,
        id: studentId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await setDoc(doc(db, 'students', studentId), cleanPayload);
      clearPendingWrite('students', studentId);
    } catch (e) {
      console.warn("Student saved locally; Firestore sync pending:", e);
    }

    window.dispatchEvent(new CustomEvent('studentsUpdated'));
    return newStudent;
  },

  async addStudentsBulk(studentsList: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>>): Promise<Student[]> {
    const activeDirId = this.getActiveDirectorateId();
    const createdStudents: Student[] = [];
    const nowTime = Date.now();

    for (let i = 0; i < studentsList.length; i++) {
      const s = studentsList[i];
      const studentWithDir = {
        ...s,
        directorateId: (s as any).directorateId || activeDirId
      };
      const newStudent: Student = {
        ...studentWithDir,
        id: `stud-${nowTime}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as any;
      createdStudents.push(newStudent);
      markPendingWrite('students', newStudent.id);
    }

    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', deduplicateById([...createdStudents, ...localList]));

    try {
      let batch = writeBatch(db);
      let opCount = 0;
      let batchIds: string[] = [];

      for (const newStudent of createdStudents) {
        const studentRef = doc(db, 'students', newStudent.id);
        const cleanPayload = stripUndefinedDeep({
          ...newStudent,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        batch.set(studentRef, cleanPayload, { merge: true });
        batchIds.push(newStudent.id);
        opCount++;

        if (opCount >= 450) {
          await batch.commit();
          batchIds.forEach(id => clearPendingWrite('students', id));
          batch = writeBatch(db);
          opCount = 0;
          batchIds = [];
        }
      }

      if (opCount > 0) {
        await batch.commit();
        batchIds.forEach(id => clearPendingWrite('students', id));
      }
    } catch (e) {
      console.warn("Bulk students saved locally; Firestore sync pending:", e);
    }

    window.dispatchEvent(new CustomEvent('studentsUpdated'));
    return createdStudents;
  },

  async deleteStudent(id: string): Promise<void> {
    markRecentlyDeleted('students', id);
    const localList = getLocal<Student>('taourirt_students_data', []);
    setLocal('taourirt_students_data', localList.filter(s => s.id !== id));

    try {
      await deleteDoc(doc(db, 'students', id));
    } catch (e) {
      console.warn("Deleted student locally:", e);
    }
    window.dispatchEvent(new CustomEvent('studentsUpdated'));
  },

  async deleteStudentsBulk(ids: string[]): Promise<number> {
    if (!ids || ids.length === 0) return 0;
    const idSet = new Set(ids);
    ids.forEach(id => markRecentlyDeleted('students', id));
    const localList = getLocal<Student>('taourirt_students_data', []);
    const remaining = localList.filter(s => !idSet.has(s.id));
    const removedCount = localList.length - remaining.length;
    setLocal('taourirt_students_data', remaining);

    try {
      for (let i = 0; i < ids.length; i += 450) {
        const chunk = ids.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, 'students', id));
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn("Bulk deleted students locally; Firestore sync pending:", e);
    }
    window.dispatchEvent(new CustomEvent('studentsUpdated'));
    return removedCount > 0 ? removedCount : ids.length;
  },

  async updateStudent(id: string, student: Partial<Student>): Promise<void> {
    const localList = getLocal<Student>('taourirt_students_data', []);
    const existsLocally = localList.some(s => s.id === id);
    const updated = existsLocally
      ? localList.map(s => s.id === id ? { ...s, ...student, updatedAt: new Date().toISOString() } : s)
      : [{ ...(student as Student), id, updatedAt: new Date().toISOString() }, ...localList];
    setLocal('taourirt_students_data', updated);
    markPendingWrite('students', id);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...student,
        id,
        updatedAt: serverTimestamp()
      });

      await setDoc(doc(db, 'students', id), cleanPayload, { merge: true });
      clearPendingWrite('students', id);
    } catch (e) {
      console.warn("Updated student locally; Firestore sync pending:", e);
    }
    window.dispatchEvent(new CustomEvent('studentsUpdated'));
  },

  async updateBibNumbersBulk(items: Array<{ id: string; bibNumber: string | number }>): Promise<void> {
    if (!items || items.length === 0) return;
    const localList = getLocal<Student>('taourirt_students_data', []);
    const bibMap = new Map(items.map(it => [it.id, String(it.bibNumber)]));
    const nowIso = new Date().toISOString();
    const updated = localList.map(s => {
      if (bibMap.has(s.id)) {
        const b = bibMap.get(s.id)!;
        return {
          ...s,
          bibNumber: b,
          crossCountryBibNumber: b,
          updatedAt: nowIso
        } as Student;
      }
      return s;
    });
    setLocal('taourirt_students_data', updated);

    // Sync to Firestore in background
    try {
      await Promise.all(
        items.map(async (item) => {
          try {
            await setDoc(doc(db, 'students', item.id), {
              bibNumber: String(item.bibNumber),
              crossCountryBibNumber: String(item.bibNumber),
              updatedAt: serverTimestamp()
            }, { merge: true });
          } catch (err) {
            // ignore individual doc fail
          }
        })
      );
    } catch (e) {
      console.warn("Synced bib numbers locally; Firestore background sync:", e);
    }
    window.dispatchEvent(new CustomEvent('studentsUpdated'));
  },

  // NOTIFICATIONS SYSTEM
  async getNotifications(): Promise<AppNotification[]> {
    try {
      const snap = await getDocs(collection(db, 'notifications'));
      if (!snap.empty) {
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as AppNotification));
      }
    } catch (e) {
      console.warn("Firestore fetch notifications error:", e);
    }
    return getLocal<AppNotification>('taourirt_notifications_data', []);
  },

  async addNotification(notification: Omit<AppNotification, 'id' | 'createdAt'>): Promise<AppNotification> {
    const activeDirId = this.getActiveDirectorateId();
    const notificationWithDir = {
      ...notification,
      directorateId: notification.directorateId || activeDirId
    };
    const newNotification: AppNotification = {
      ...notificationWithDir,
      id: `notif-${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const localList = getLocal<AppNotification>('taourirt_notifications_data', []);
    setLocal('taourirt_notifications_data', [newNotification, ...localList]);

    try {
      await setDoc(doc(db, 'notifications', newNotification.id), {
        ...notificationWithDir,
        id: newNotification.id,
        createdAt: serverTimestamp()
      });
    } catch (e) {
      console.warn("Notification saved locally; Firestore sync pending:", e);
    }

    return newNotification;
  },

  async markNotificationAsRead(id: string, userId: string): Promise<void> {
    const localList = getLocal<AppNotification>('taourirt_notifications_data', []);
    const updated = localList.map(n => {
      if (n.id === id) {
        const readBy = n.readBy || [];
        if (!readBy.includes(userId)) {
          return { ...n, readBy: [...readBy, userId] };
        }
      }
      return n;
    });
    setLocal('taourirt_notifications_data', updated);

    try {
      const docRef = doc(db, 'notifications', id);
      await fbSetDoc(docRef, {
        readBy: arrayUnion(userId)
      }, { merge: true });
    } catch (e) {
      console.warn("Updated notification read state locally:", e);
    }
  },

  getLocalDeletedNotificationIds(userId: string): string[] {
    if (!userId) return [];
    try {
      const raw = localStorage.getItem(`taourirt_deleted_notifs_${userId}`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async deleteNotificationForUser(id: string, userId: string): Promise<void> {
    if (!id || !userId) return;
    try {
      const current = this.getLocalDeletedNotificationIds(userId);
      if (!current.includes(id)) {
        localStorage.setItem(`taourirt_deleted_notifs_${userId}`, JSON.stringify([...current, id]));
      }
    } catch {}

    const localList = getLocal<AppNotification>('taourirt_notifications_data', []);
    const updated = localList.map(n => {
      if (n.id === id) {
        const deletedBy = n.deletedBy || [];
        if (!deletedBy.includes(userId)) {
          return { ...n, deletedBy: [...deletedBy, userId] };
        }
      }
      return n;
    });
    setLocal('taourirt_notifications_data', updated);

    try {
      await fbSetDoc(doc(db, 'notifications', id), {
        deletedBy: arrayUnion(userId)
      }, { merge: true });
    } catch (e) {
      console.warn("Deleted notification for user locally:", e);
    }
  },

  async deleteAllNotificationsForUser(ids: string[], userId: string): Promise<void> {
    if (!userId || ids.length === 0) return;
    try {
      const current = this.getLocalDeletedNotificationIds(userId);
      const merged = Array.from(new Set([...current, ...ids]));
      localStorage.setItem(`taourirt_deleted_notifs_${userId}`, JSON.stringify(merged));
    } catch {}

    const localList = getLocal<AppNotification>('taourirt_notifications_data', []);
    const updated = localList.map(n => {
      if (ids.includes(n.id)) {
        const deletedBy = n.deletedBy || [];
        if (!deletedBy.includes(userId)) {
          return { ...n, deletedBy: [...deletedBy, userId] };
        }
      }
      return n;
    });
    setLocal('taourirt_notifications_data', updated);

    await Promise.all(
      ids.map(id =>
        fbSetDoc(doc(db, 'notifications', id), {
          deletedBy: arrayUnion(userId)
        }, { merge: true }).catch(() => {})
      )
    );
  },

  getLocalGlobalNotificationResetAt(): number {
    try {
      const raw = localStorage.getItem('taourirt_notifications_global_reset_at');
      const parsed = raw ? Number(raw) : 0;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    } catch {
      return 0;
    }
  },

  async resetAllNotificationsForAllUsers(resetByName?: string): Promise<{ deletedCount: number; resetAtMs: number }> {
    const resetAtMs = Date.now();
    // 1. Clear local notification cache immediately & store reset watermark
    setLocal('taourirt_notifications_data', []);
    try {
      localStorage.setItem('taourirt_notifications_global_reset_at', String(resetAtMs));
    } catch {}

    let deletedCount = 0;

    // 2. Delete all notification documents from Firestore in batches so all supervisors/teachers see empty bells
    try {
      const snap = await fbGetDocs(collection(db, 'notifications'));
      deletedCount = snap.size;
      if (!snap.empty) {
        const docs = snap.docs;
        for (let i = 0; i < docs.length; i += 400) {
          const chunk = docs.slice(i, i + 400);
          const batch = fbWriteBatch(db);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
    } catch (e) {
      console.warn('Error clearing Firestore notifications collection:', e);
    }

    // 3. Persist server-side globalResetAt timestamp so any offline/cached client also resets immediately on sync
    try {
      await fbSetDoc(
        doc(db, 'settings', 'notifications_meta'),
        {
          globalResetAt: serverTimestamp(),
          resetBy: resetByName || 'المسير المركزي',
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    } catch (e) {
      console.warn('Error saving notifications_meta globalResetAt:', e);
    }

    window.dispatchEvent(new CustomEvent('notificationsGloballyReset', { detail: { resetAtMs } }));
    return { deletedCount, resetAtMs };
  },

  async triggerMatchNotification(type: 'create' | 'update' | 'result', match: Match) {
    try {
      const schools = await this.getSchools();
      const s1Name = match.team1Name || schools.find(s => s.id === match.team1Id)?.name || 'الفريق الأول';
      const s2Name = match.team2Name || schools.find(s => s.id === match.team2Id)?.name || 'الفريق الثاني';
      const sportName = SPORTS_MAP[match.sportId]?.name || 'التخصص الرياضي';
      const venuePart = match.venueName ? ` بـ ${match.venueName}` : '';
      const formattedDate = match.date ? formatMatchDate(match.date) : '';

      const assignedRefUserIds = Array.from(
        new Set([
          ...(Array.isArray(match.tableReferees) ? match.tableReferees : []),
          ...(Array.isArray(match.fieldReferees) ? match.fieldReferees : []),
          ...(Array.isArray(match.referees) ? match.referees : []),
          ...(match.referee1Id ? [match.referee1Id] : []),
          ...(match.referee2Id ? [match.referee2Id] : [])
        ].filter(Boolean))
      );

      if (type === 'create' || type === 'update') {
        const refTitle =
          type === 'create'
            ? `🏁 تكليف تحكيمي: ${sportName}`
            : `🏁 تعديل تكليف تحكيمي: ${sportName}`;

        const assignmentSummaryParts: string[] = [];
        if (Array.isArray(match.tableReferees) && match.tableReferees.filter(Boolean).length > 0) {
          assignmentSummaryParts.push(`حكام الطاولة (${match.tableReferees.filter(Boolean).length})`);
        }
        if (Array.isArray(match.fieldReferees) && match.fieldReferees.filter(Boolean).length > 0) {
          assignmentSummaryParts.push(`حكام الساحة (${match.fieldReferees.filter(Boolean).length})`);
        }
        const assignmentSuffix = assignmentSummaryParts.length > 0 ? ` [${assignmentSummaryParts.join(' • ')}]` : '';

        const refBody =
          type === 'create'
            ? `تم تكليفكم ضمن طاقم التحكيم${assignmentSuffix} لإدارة مقابلة ${sportName} بين ${s1Name} و ${s2Name} يوم ${formattedDate} على الساعة ${match.startTime}${venuePart}. المرجو الحضور قبل موعد الانطلاق بوقت كافٍ لمعاينة الملعب وإعداد ورقة التحكيم.`
            : `تم تحديث تفاصيل أو موعد المقابلة المكلفين بتحكيمها${assignmentSuffix} في ${sportName} بين ${s1Name} و ${s2Name}. الموعد الجديد: يوم ${formattedDate} على الساعة ${match.startTime}${venuePart}.`;

        const stakeholdersTitle =
          type === 'create'
            ? `🏆 إشعار ببرمجة مباراة: ${sportName}`
            : `📅 تعديل موعد مباراة: ${sportName}`;
        const stakeholdersBody =
          type === 'create'
            ? `نخبر المؤسسات التعليمية المشاركة والأطر التربوية المؤطرة ببرمجة مقابلة ${sportName} بين ${s1Name} و ${s2Name} يوم ${formattedDate} على الساعة ${match.startTime}${venuePart}. المرجو اتخاذ الترتيبات التنظيمية وتيسير مشاركة التلاميذ.`
            : `نخبر المؤسسات والأطر التربوية المعنية بتحديث موعد المقابلة بين ${s1Name} و ${s2Name} في ${sportName}: يوم ${formattedDate} على الساعة ${match.startTime}${venuePart}.`;

        await Promise.all([
          this.addNotification({
            title: refTitle,
            body: refBody,
            sportId: match.sportId,
            role: 'REFEREE',
            userIds: assignedRefUserIds
          }),
          this.addNotification({
            title: stakeholdersTitle,
            body: stakeholdersBody,
            sportId: match.sportId,
            role: 'TEACHER',
            userIds: []
          })
        ]);
      } else if (type === 'result') {
        const title = `⚽ نتيجة مباراة معتمدة: ${sportName}`;
        const scoreText = match.score1 !== undefined && match.score2 !== undefined ? `(${match.score1} - ${match.score2})` : '';
        const body = `تم تسجيل واعتماد نتيجة المباراة في ${sportName} بين ${s1Name} و ${s2Name}: ${scoreText}. حالة المباراة: ${match.status === 'Completed' ? 'منتهية' : match.status}.`;
        await this.addNotification({
          title,
          body,
          sportId: match.sportId,
          role: 'ALL',
          userIds: []
        });
      }
    } catch (err) {
      console.error("Error triggering match notification:", err);
    }
  },

  async getRoleSidebarPermissions(): Promise<RoleSidebarPermissions> {
    const DEFAULT_PERMISSIONS: RoleSidebarPermissions = {
      CENTRAL_ADMIN: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config', '/permissions',
        'action:export_data', 'action:import_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule', 'action:delete_records'
      ],
      TECH_COMMITTEE_HEAD: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/tech-committee', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics', '/sports-config',
        'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
      ],
      SPORT_MANAGER: [
        '/dashboard', '/schools', '/tournaments', '/teachers', '/referees', '/matches', '/helper-apps', '/posters-certificates', '/statistics',
        'action:export_data', 'action:edit_results', 'action:register_students', 'action:manage_schedule'
      ],
      TEACHER: [
        '/dashboard', '/schools', '/tournaments', '/matches', '/posters-certificates', '/statistics',
        'action:export_data', 'action:register_students'
      ],
      REFEREE: [
        '/dashboard', '/matches', '/statistics',
        'action:edit_results'
      ]
    };

    try {
      const docSnap = await getDoc(doc(db, 'settings', 'role_sidebar_permissions'));
      if (docSnap.exists()) {
        const firestoreData = docSnap.data() as RoleSidebarPermissions;
        if (firestoreData && typeof firestoreData === 'object') {
          const merged = { ...DEFAULT_PERMISSIONS, ...firestoreData };
          localStorage.setItem('taourirt_role_sidebar_permissions', JSON.stringify(merged));
          return merged;
        }
      }
    } catch (e) {
      console.warn("Firestore fetch role_sidebar_permissions error, checking local storage:", e);
    }

    try {
      const local = localStorage.getItem('taourirt_role_sidebar_permissions');
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && typeof parsed === 'object') {
          return { ...DEFAULT_PERMISSIONS, ...parsed };
        }
      }
    } catch (e) {
      console.error("Error loading local role permissions:", e);
    }
    return DEFAULT_PERMISSIONS;
  },

  subscribeToReferees(callback: (referees: Referee[]) => void): () => void {
    const emitLocal = () => {
      const localRefs = deduplicateById([
        ...getLocal<Referee>('taourirt_referees_data', []),
        ...getLocal<Referee>('referees', [])
      ]).filter(r => r && !isRecentlyDeleted('referees', r.id));
      callback(localRefs);
    };
    const handleLocalUpdate = () => {
      if (isCloudSyncPaused()) emitLocal();
    };
    window.addEventListener('refereesUpdated', handleLocalUpdate);

    try {
      if (isCloudSyncPaused()) emitLocal();
      const unsub = onSnapshot(collection(db, 'referees'), (snap) => {
        const firestoreRefs = snap.docs
          .filter((d: any) => !isRecentlyDeleted('referees', d.id))
          .map((d: any) => ({ id: d.id, ...d.data() } as Referee));
        const pendingLocal = deduplicateById([
          ...getLocal<Referee>('taourirt_referees_data', []),
          ...getLocal<Referee>('referees', [])
        ]).filter(r => r && !isRecentlyDeleted('referees', r.id) && isPendingWrite('referees', r.id));
        const merged = deduplicateById([...pendingLocal, ...firestoreRefs]);
        callback(merged);
      }, (error) => {
        console.warn("Firestore subscription error for referees:", error);
        emitLocal();
      });
      return () => {
        window.removeEventListener('refereesUpdated', handleLocalUpdate);
        unsub();
      };
    } catch (e) {
      console.warn("Error setting up onSnapshot for referees:", e);
      emitLocal();
      return () => {
        window.removeEventListener('refereesUpdated', handleLocalUpdate);
      };
    }
  },

  subscribeToUsers(callback: (users: User[]) => void): () => void {
    const emitLocal = () => {
      const localUsers = getLocal<User>('local_registered_users', []).filter(
        u => u && !isRecentlyDeleted('users', u.id)
      );
      callback(localUsers);
    };
    const handleLocalUpdate = () => {
      if (isCloudSyncPaused()) emitLocal();
    };
    window.addEventListener('userDataChanged', handleLocalUpdate);

    try {
      if (isCloudSyncPaused()) emitLocal();
      const unsub = onSnapshot(collection(db, 'users'), (snap) => {
        const firestoreUsers = snap.docs
          .filter((d: any) => !isRecentlyDeleted('users', d.id))
          .map((d: any) => ({ id: d.id, ...d.data() } as User));
        const pendingLocal = getLocal<User>('local_registered_users', []).filter(
          u => u && u.id && !isRecentlyDeleted('users', u.id) && isPendingWrite('users', u.id)
        );
        const merged = deduplicateById([...pendingLocal, ...firestoreUsers]);
        callback(merged);
      }, (error) => {
        console.warn("Firestore subscription error for users:", error);
        emitLocal();
      });
      return () => {
        window.removeEventListener('userDataChanged', handleLocalUpdate);
        unsub();
      };
    } catch (e) {
      console.warn("Error setting up onSnapshot for users:", e);
      emitLocal();
      return () => {
        window.removeEventListener('userDataChanged', handleLocalUpdate);
      };
    }
  },

  subscribeToDirectorates(callback: (dirs: Directorate[]) => void): () => void {
    const emitLocal = () => {
      const localDirs = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES).filter(
        d => d && !isRecentlyDeleted('directorates', d.id)
      );
      callback(localDirs);
    };
    const handleLocalUpdate = () => {
      if (isCloudSyncPaused()) emitLocal();
    };
    window.addEventListener('directoratesListUpdated', handleLocalUpdate);

    try {
      if (isCloudSyncPaused()) emitLocal();
      const unsub = onSnapshot(collection(db, 'directorates'), (snap) => {
        const firestoreDirs = snap.docs
          .filter((d: any) => !isRecentlyDeleted('directorates', d.id))
          .map((d: any) => ({ id: d.id, ...d.data() } as Directorate));
        const pendingLocal = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, []).filter(
          d => d && d.id && !isRecentlyDeleted('directorates', d.id) && isPendingWrite('directorates', d.id)
        );
        callback(deduplicateById([...pendingLocal, ...firestoreDirs]));
      }, (error) => {
        console.warn("Firestore subscription error for directorates:", error);
      });
      return () => {
        window.removeEventListener('directoratesListUpdated', handleLocalUpdate);
        unsub();
      };
    } catch (e) {
      console.warn("Error setting up onSnapshot for directorates:", e);
      return () => {
        window.removeEventListener('directoratesListUpdated', handleLocalUpdate);
      };
    }
  },

  subscribeToRoleSidebarPermissions(callback: (permissions: RoleSidebarPermissions) => void): () => void {
    const docRef = doc(db, 'settings', 'role_sidebar_permissions');
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as RoleSidebarPermissions;
        if (data && typeof data === 'object') {
          const res = { ...data };
          localStorage.setItem('taourirt_role_sidebar_permissions', JSON.stringify(res));
          callback(res);
          window.dispatchEvent(new CustomEvent('sidebarPermissionsChanged', { detail: res }));
        }
      }
    }, (err) => {
      console.warn("Firestore role_sidebar_permissions subscription error:", err);
    });
  },

  async saveRoleSidebarPermissions(permissions: RoleSidebarPermissions): Promise<void> {
    try {
      localStorage.setItem('taourirt_role_sidebar_permissions', JSON.stringify(permissions));
      await setDoc(doc(db, 'settings', 'role_sidebar_permissions'), permissions, { merge: true });
      window.dispatchEvent(new CustomEvent('sidebarPermissionsChanged', { detail: permissions }));
    } catch (e) {
      console.warn("Saved permissions locally; Firestore sync pending:", e);
      window.dispatchEvent(new CustomEvent('sidebarPermissionsChanged', { detail: permissions }));
    }
  },

  // DIRECTORATES MANAGEMENT (Multi-Tenant Architecture)
  async getDirectorates(): Promise<Directorate[]> {
    const ensureTaourirtSuperAdmins = (list: Directorate[]): Directorate[] =>
      list.map(d => {
        if (d.id !== 'taourirt') return d;
        const emails = Array.isArray(d.adminEmails) ? [...d.adminEmails] : [];
        if (!emails.some(e => e && e.trim().toLowerCase() === 'meqnou@gmail.com')) {
          emails.push('meqnou@gmail.com');
        }
        return { ...d, adminEmails: emails };
      });

    try {
      const snap = await getDocs(collection(db, 'directorates'));
      const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES).filter(d => d && !isRecentlyDeleted('directorates', d.id));
      const pendingLocal = localList.filter(d => isPendingWrite('directorates', d.id));
      if (!snap.empty) {
        const firestoreList = snap.docs
          .filter(d => !isRecentlyDeleted('directorates', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Directorate));
        const merged = ensureTaourirtSuperAdmins(deduplicateById([...pendingLocal, ...firestoreList]));
        setLocal(STORAGE_KEYS.DIRECTORATES, merged);
        return merged;
      } else {
        console.log("Seeding initial directorates to new Firestore...");
        for (const dir of INITIAL_DIRECTORATES) {
          await this.addDirectorate(dir);
        }
        return INITIAL_DIRECTORATES;
      }
    } catch (e) {
      console.warn("Firestore directorates fetch error, falling back to cache:", e);
    }
    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES).filter(d => d && !isRecentlyDeleted('directorates', d.id));
    return ensureTaourirtSuperAdmins(deduplicateById(localList));
  },

  async addDirectorate(directorate: Omit<Directorate, 'id'> & { id?: string }): Promise<Directorate> {
    const rawId = directorate.id || `dir_${(directorate.shortName || directorate.name || 'dir').toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString(36)}`;
    const tempId = rawId;
    const newDir: Directorate = {
      ...directorate,
      id: tempId,
      isActive: directorate.isActive !== undefined ? directorate.isActive : true,
      adminEmails: (directorate.adminEmails || []).map(e => e.trim().toLowerCase()).filter(Boolean),
      createdAt: new Date()
    };

    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES);
    const updated = [newDir, ...localList.filter(d => d.id !== tempId)];
    setLocal(STORAGE_KEYS.DIRECTORATES, updated);
    markPendingWrite('directorates', tempId);

    try {
      const cleanPayload = stripUndefinedDeep({
        ...newDir,
        createdAt: Timestamp.now()
      });
      await setDoc(doc(db, 'directorates', tempId), cleanPayload, { merge: true });
      clearPendingWrite('directorates', tempId);
    } catch (e) {
      console.warn("Directorate saved locally; Firestore sync error:", e);
    }

    window.dispatchEvent(new CustomEvent('directoratesListUpdated', { detail: updated }));
    return newDir;
  },

  async updateDirectorate(id: string, updates: Partial<Directorate>): Promise<void> {
    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES);
    const cleanUpdates = stripUndefinedDeep({
      ...updates,
      ...(updates.adminEmails ? { adminEmails: updates.adminEmails.map(e => e.trim().toLowerCase()).filter(Boolean) } : {})
    });
    const updated = localList.map(d => d.id === id ? { ...d, ...cleanUpdates } : d);
    setLocal(STORAGE_KEYS.DIRECTORATES, updated);
    markPendingWrite('directorates', id);

    try {
      await setDoc(doc(db, 'directorates', id), {
        ...cleanUpdates,
        id,
        updatedAt: serverTimestamp()
      }, { merge: true });
      clearPendingWrite('directorates', id);
    } catch (e) {
      console.warn("Directorate updated locally:", e);
    }

    window.dispatchEvent(new CustomEvent('directoratesListUpdated', { detail: updated }));
  },

  async deleteDirectorate(id: string): Promise<void> {
    markRecentlyDeleted('directorates', id);
    const localList = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, INITIAL_DIRECTORATES);
    const updated = localList.filter(d => d.id !== id);
    setLocal(STORAGE_KEYS.DIRECTORATES, updated);

    try {
      await deleteDoc(doc(db, 'directorates', id));
    } catch (e) {
      console.warn("Directorate deleted locally:", e);
    }

    window.dispatchEvent(new CustomEvent('directoratesListUpdated', { detail: updated }));
  },

  getActiveDirectorateId(): string {
    return localStorage.getItem('active_directorate_id') || 'taourirt';
  },

  setActiveDirectorateId(id: string): void {
    localStorage.setItem('active_directorate_id', id);
    window.dispatchEvent(new CustomEvent('directorateChanged', { detail: id }));
  },

  async getActiveDirectorate(): Promise<Directorate> {
    const activeId = this.getActiveDirectorateId();
    const all = await this.getDirectorates();
    const found = all.find(d => d.id === activeId);
    return found || all[0] || INITIAL_DIRECTORATES[0];
  },

  async verifyDirectorateCode(directorateId: string, inputCode: string): Promise<boolean> {
    const all = await this.getDirectorates();
    const dir = all.find(d => d.id === directorateId);
    if (!dir) return false;
    const cleanDirCode = (dir.code || '').trim().toUpperCase();
    const cleanInput = (inputCode || '').trim().toUpperCase();
    return cleanDirCode === cleanInput;
  },

  _normalizeCrossCountryDoc(docId: string, data: any, activeDirId: string): CrossCountryCategoryResult {
    const rawCatId = (data.categoryId || data.category_id || data.id || docId || '').toLowerCase().trim();
    let normalizedId = rawCatId;
    
    // Check if this document represents a club-affiliated category
    const isClub = data.affiliationType === 'club_affiliated' || normalizedId.includes('_club') || normalizedId.includes('club');

    // Strip directorate prefix if present, e.g. taourirt_u13_male -> u13_male
    if (activeDirId && normalizedId.startsWith(`${activeDirId.toLowerCase()}_`)) {
      normalizedId = normalizedId.replace(`${activeDirId.toLowerCase()}_`, '');
    } else if (normalizedId.includes('_')) {
      const parts = normalizedId.split('_');
      if (parts.length >= 2) {
        // If it ends with 'club', look at the parts before it
        let lastPart = parts[parts.length - 1];
        let secondLast = parts[parts.length - 2];
        if (lastPart === 'club' && parts.length >= 3) {
          lastPart = parts[parts.length - 2];
          secondLast = parts[parts.length - 3];
        }

        if (['male', 'female', 'ذكور', 'إناث', 'اناث', 'm', 'f'].includes(lastPart)) {
          const gNorm = (lastPart === 'ذكور' || lastPart === 'm') ? 'male' : (lastPart === 'إناث' || lastPart === 'اناث' || lastPart === 'f') ? 'female' : lastPart;
          normalizedId = isClub ? `${secondLast}_${gNorm}_club` : `${secondLast}_${gNorm}`;
        }
      }
    }

    // Gender normalization
    let gender: 'Male' | 'Female' = 'Male';
    const rawGender = String(data.gender || data.sexe || data.genre || '').trim().toLowerCase();
    if (
      rawGender === 'female' ||
      rawGender === 'f' ||
      rawGender === 'أنثى' ||
      rawGender === 'انثى' ||
      rawGender === 'إناث' ||
      rawGender === 'فتيات' ||
      rawGender === 'صغيرات' ||
      rawGender === 'برعمات' ||
      rawGender === 'شابات' ||
      normalizedId.includes('female')
    ) {
      gender = 'Female';
    }

    // Category normalization
    let category = data.category || data.categorie || 'U15';
    const catStr = String(category).toLowerCase();
    const catNameStr = String(data.categoryName || data.nom_categorie || '').toLowerCase();
    if (
      normalizedId.includes('u12') ||
      normalizedId.includes('u13') ||
      catStr.includes('u12') ||
      catStr.includes('u13') ||
      catStr.includes('براعم') ||
      catNameStr.includes('براعم')
    ) {
      category = 'U12';
    } else if (
      normalizedId.includes('u15') ||
      catStr.includes('u15') ||
      catStr.includes('صغار') ||
      catStr.includes('صغيرات') ||
      catNameStr.includes('صغار') ||
      catNameStr.includes('صغيرات')
    ) {
      category = 'U15';
    } else if (
      normalizedId.includes('u18') ||
      catStr.includes('u18') ||
      catStr.includes('فتيان') ||
      catStr.includes('فتيات') ||
      catNameStr.includes('فتيان') ||
      catNameStr.includes('فتيات')
    ) {
      category = 'U18';
    } else if (
      normalizedId.includes('u20') ||
      catStr.includes('u20') ||
      catStr.includes('شبان') ||
      catStr.includes('شابات') ||
      catNameStr.includes('شبان') ||
      catNameStr.includes('شابات')
    ) {
      category = 'U20';
    }

    // Standard title
    let titleAr = data.titleAr || data.title || data.nom_course || (data as any).categoryName || '';
    if (!titleAr) {
      const suffix = isClub ? ' - المنتمين للأندية' : ' - مدرسي';
      if (category === 'U12' && gender === 'Male') titleAr = `سباق البراعم ذكور (U12)${suffix}`;
      else if (category === 'U12' && gender === 'Female') titleAr = `سباق البرعمات إناث (U12)${suffix}`;
      else if (category === 'U15' && gender === 'Male') titleAr = `سباق الصغار ذكور (U15)${suffix}`;
      else if (category === 'U15' && gender === 'Female') titleAr = `سباق الصغيرات إناث (U15)${suffix}`;
      else if (category === 'U18' && gender === 'Male') titleAr = `سباق الفتيان ذكور (U18)${suffix}`;
      else if (category === 'U18' && gender === 'Female') titleAr = `سباق الفتيات إناث (U18)${suffix}`;
      else if (category === 'U20' && gender === 'Male') titleAr = `سباق الشبان ذكور (U20)${suffix}`;
      else if (category === 'U20' && gender === 'Female') titleAr = `سباق الشابات إناث (U20)${suffix}`;
    }

    // Flexible extraction of podium/results/rankings array from external application
    let rawList: any[] = [];
    if (Array.isArray(data.podium)) rawList = data.podium;
    else if (Array.isArray(data.results)) rawList = data.results;
    else if (Array.isArray(data.rankings)) rawList = data.rankings;
    else if (Array.isArray(data.ranking)) rawList = data.ranking;
    else if (Array.isArray(data.winners)) rawList = data.winners;
    else if (Array.isArray(data.runners)) rawList = data.runners;
    else if (Array.isArray(data.participants)) rawList = data.participants;
    else if (Array.isArray(data.athletes)) rawList = data.athletes;
    else if (Array.isArray(data.classement)) rawList = data.classement;
    else if (data.podium && typeof data.podium === 'object') rawList = Object.values(data.podium);
    else if (data.results && typeof data.results === 'object') rawList = Object.values(data.results);

    const podium: PodiumWinner[] = rawList
      .filter(item => item && (item.fullName || item.name || item.nom || item.athleteName || item.studentName || item.runnerName || item.athlete_name))
      .map((item, idx) => {
        const rankVal = Number(item.rank ?? item.position ?? item.place ?? item.ordre ?? (idx + 1));
        return {
          rank: isNaN(rankVal) ? idx + 1 : rankVal,
          fullName: String(item.fullName || item.name || item.nom || item.athleteName || item.studentName || item.runnerName || item.athlete_name || '').trim(),
          schoolName: String(item.schoolName || item.school || item.etablissement || item.etab || item.school_name || item.institution || '').trim(),
          time: item.time || item.timing || item.temps || item.chrono || item.duration || undefined,
          bibNumber: item.bibNumber ? String(item.bibNumber) : (item.bib ? String(item.bib) : (item.dossard ? String(item.dossard) : (item.number ? String(item.number) : undefined))),
          notes: item.notes || item.observation || item.remarks || item.remarques || item.qualif || item.status || undefined,
          massarNumber: item.massarNumber || item.massar || item.cne || item.codeMassar || undefined,
          affiliationType: item.affiliationType || (isClub ? 'club_affiliated' : 'non_club')
        };
      })
      .sort((a, b) => a.rank - b.rank);

    return {
      categoryId: normalizedId,
      category,
      gender,
      titleAr,
      distance: data.distance || (category === 'U12' ? (gender === 'Male' ? '1500 م' : '1000 م') : category === 'U15' ? (gender === 'Male' ? '3000 م' : '2000 م') : category === 'U18' ? (gender === 'Male' ? '4000 م' : '3000 م') : (gender === 'Male' ? '5000 م' : '3000 م')),
      venueName: data.venueName || data.venue || data.lieu || 'مضمار حلبة ألعاب القوى بتاوريرت',
      directorateId: data.directorateId || activeDirId,
      affiliationType: isClub ? 'club_affiliated' : 'non_club',
      status: data.status,
      updatedAt: data.updatedAt ? (typeof data.updatedAt === 'string' ? data.updatedAt : (data.updatedAt.toDate ? data.updatedAt.toDate().toISOString() : new Date().toISOString())) : new Date().toISOString(),
      podium
    };
  },

  /**
   * Subscribe to real-time Cross Country results from Firestore (onSnapshot)
   */
  subscribeCrossCountryResults(callback: (results: Record<string, CrossCountryCategoryResult>) => void): () => void {
    const q = collection(db, 'cross_country_results');
    const unsubscribe = onSnapshot(q, async (snap) => {
      const activeDirId = this.getActiveDirectorateId();
      const activeSeason = await this.getActiveSeason();
      const cacheKey = `taourirt_cc_results_${activeDirId}`;
      const resultsMap: Record<string, CrossCountryCategoryResult> = {};
      
      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const docDirId = data.directorateId || (docSnap.id.includes('_') ? docSnap.id.substring(0, docSnap.id.lastIndexOf('_')) : docSnap.id);
        const docSeasonId = data.seasonId || '2026/2027';
        
        // Only process results for the current active season
        if (docSeasonId !== activeSeason) return;

        // Accept document for current directorate or global view
        if (!activeDirId || activeDirId === 'all' || activeDirId === 'taourirt' || docDirId === activeDirId) {
          const item = this._normalizeCrossCountryDoc(docSnap.id, data, activeDirId);
          resultsMap[docSnap.id] = item;
          
          // Priority for base keys (like 'u15_male') should be results from current directorate
          if (docDirId === activeDirId || (!activeDirId && docDirId === 'taourirt') || (activeDirId === 'all' && docDirId === 'taourirt')) {
            resultsMap[item.categoryId] = item;
            
            if (item.categoryId === 'u13_male' || item.categoryId === 'u12_male') {
              resultsMap['u12_male'] = item;
              resultsMap['u13_male'] = item;
            }
            if (item.categoryId === 'u13_female' || item.categoryId === 'u12_female') {
              resultsMap['u12_female'] = item;
              resultsMap['u13_female'] = item;
            }
          } else if (activeDirId === 'all') {
            // In 'all' view, use directorate-prefixed key or base key if none exists
            if (!resultsMap[item.categoryId]) {
               resultsMap[item.categoryId] = item;
            }
          }
        }
      });

      this._sanitizeCrossCountryResultsMap(resultsMap);
      localStorage.setItem(cacheKey, JSON.stringify(resultsMap));
      callback(resultsMap);
    }, (error) => {
      console.warn("Firestore real-time subscription error for cross_country_results:", error);
    });

    return unsubscribe;
  },

  _sanitizeCrossCountryResultsMap(resultsMap: Record<string, CrossCountryCategoryResult>): Record<string, CrossCountryCategoryResult> {
    if (!resultsMap) return resultsMap;
    const pairs = [
      { male: 'u12_male', female: 'u12_female' },
      { male: 'u12_male_club', female: 'u12_female_club' },
      { male: 'u13_male', female: 'u13_female' },
      { male: 'u15_male', female: 'u15_female' },
      { male: 'u15_male_club', female: 'u15_female_club' },
      { male: 'u18_male', female: 'u18_female' },
      { male: 'u18_male_club', female: 'u18_female_club' },
      { male: 'u20_male', female: 'u20_female' },
      { male: 'u20_male_club', female: 'u20_female_club' }
    ];

    pairs.forEach(({ male, female }) => {
      const m = resultsMap[male];
      const f = resultsMap[female];
      if (m && f && m.podium && f.podium && m.podium.length > 0 && f.podium.length > 0) {
        const mSig = m.podium.map(p => (p.studentId || p.fullName || '').trim().toLowerCase()).sort().join('|');
        const fSig = f.podium.map(p => (p.studentId || p.fullName || '').trim().toLowerCase()).sort().join('|');
        if (mSig && mSig === fSig) {
          f.podium = [];
        }
      }
    });

    return resultsMap;
  },

  /**
   * Reset or delete all results of a specific sport for the active directorate and season
   */
  async deleteSportResults(sportId: string, deleteMatchesCompletely: boolean = false): Promise<void> {
    const cleanSportId = String(sportId || '').trim();
    if (!cleanSportId) {
      throw new Error('INVALID_SPORT_ID');
    }
    const cachedSports = getLocal<Sport>('taourirt_sports_config', []);
    if (
      areSportIdsEquivalent(cleanSportId, 'cross_country', cachedSports) ||
      areSportIdsEquivalent(cleanSportId, 'athletics', cachedSports)
    ) {
      await this.resetMatchResultsByScope({ sportId: cleanSportId });
      return;
    }
    if (deleteMatchesCompletely) {
      await this.clearScheduledMatchesByScope({ sportId: cleanSportId });
    } else {
      await this.resetMatchResultsByScope({ sportId: cleanSportId });
    }
  },

  /**
   * Reset match scores & results (keeping scheduled fixtures intact) with optional sport/tournament & role scoping.
   */
  async resetMatchResultsByScope(options: {
    allowedSportIds?: string[] | null;
    sportId?: string;
    tournamentId?: string;
    gender?: string;
  } = {}): Promise<{ resetMatchesCount: number; resetCrossCountry: boolean; resetAthletics: boolean }> {
    const activeDirId = this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const { allowedSportIds } = options;
    if (options.sportId !== undefined && !String(options.sportId).trim()) {
      throw new Error('INVALID_SPORT_ID');
    }
    if (options.tournamentId !== undefined && !String(options.tournamentId).trim()) {
      throw new Error('INVALID_TOURNAMENT_ID');
    }
    const sportId = options.sportId ? String(options.sportId).trim() : undefined;
    const tournamentId = options.tournamentId ? String(options.tournamentId).trim() : undefined;
    const genderFilter = options.gender && options.gender !== 'ALL' ? String(options.gender).trim() : undefined;

    let cachedSports = getLocal<Sport>('taourirt_sports_config', []);
    if (cachedSports.length === 0) {
      cachedSports = await this.getSportsConfig().catch(() => []);
    }
    const allowedSet = buildAllowedSportSet(allowedSportIds, cachedSports);

    // Enforce allowedSportIds guard when role is scoped (e.g. Technical Committee Head)
    if (sportId && allowedSet !== null && !isSportInAllowedSet(sportId, allowedSet, cachedSports)) {
      throw new Error('UNAUTHORIZED_SPORT_RESET');
    }

    const allTourns = await this.getTournaments();
    const tournamentSportMap = new Map<string, string>();
    allTourns.forEach(t => {
      if (t && t.id && t.sportId) {
        tournamentSportMap.set(t.id, t.sportId);
      }
    });

    let targetTournamentObj: Tournament | undefined;
    if (tournamentId) {
      targetTournamentObj = allTourns.find(t => t.id === tournamentId);
      if (
        targetTournamentObj &&
        allowedSet !== null &&
        !isSportInAllowedSet(targetTournamentObj.sportId, allowedSet, cachedSports)
      ) {
        throw new Error('UNAUTHORIZED_SPORT_RESET');
      }
    }

    const effectiveSportScope = sportId || targetTournamentObj?.sportId;
    const hasExplicitScopeFilter = Boolean(sportId || tournamentId || genderFilter);
    const matchesToInspect = await this.getMatches();
    const targetMatchIds = new Set<string>();

    matchesToInspect.forEach(m => {
      if (!doesMatchMatchSportScope(m, allowedSet, effectiveSportScope, tournamentSportMap, cachedSports)) {
        return;
      }
      if (tournamentId) {
        const directMatch = m.tournamentId === tournamentId;
        const metaMatch =
          !m.tournamentId &&
          targetTournamentObj &&
          areSportIdsEquivalent(m.sportId, targetTournamentObj.sportId, cachedSports) &&
          normalizeCategoryKey(m.ageCategory) === normalizeCategoryKey(targetTournamentObj.ageCategory) &&
          (m.gender === targetTournamentObj.gender || targetTournamentObj.gender === 'Mixed') &&
          ((m as any).affiliationType || 'non_club') === (targetTournamentObj.affiliationType || 'non_club');
        if (!directMatch && !metaMatch) {
          return;
        }
      }
      if (genderFilter && genderFilter !== 'Mixed') {
        if (m.gender !== genderFilter && m.gender !== 'Mixed') {
          return;
        }
      }
      targetMatchIds.add(m.id);
    });

    if (targetMatchIds.size > 0) {
      const targetMatchMap = new Map<string, Match>();
      matchesToInspect.forEach(m => {
        if (targetMatchIds.has(m.id)) targetMatchMap.set(m.id, m);
      });
      const allCached = getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord);
      const updatedAll = allCached.map(m => {
        if (!targetMatchIds.has(m.id)) return m;
        const cleaned = { ...m } as any;
        cleaned.score1 = 0;
        cleaned.score2 = 0;
        cleaned.team1Score = 0;
        cleaned.team2Score = 0;
        cleaned.status = 'Scheduled';
        if (cleaned.team1Placeholder || cleaned.team1SourceMatchNumber) {
          const ph1 = cleaned.team1Placeholder || `الفائز من المباراة ${cleaned.team1SourceMatchNumber}`;
          cleaned.team1Id = makePlaceholderTeamId(ph1);
          cleaned.team1Name = ph1;
        }
        if (cleaned.team2Placeholder || cleaned.team2SourceMatchNumber) {
          const ph2 = cleaned.team2Placeholder || `الفائز من المباراة ${cleaned.team2SourceMatchNumber}`;
          cleaned.team2Id = makePlaceholderTeamId(ph2);
          cleaned.team2Name = ph2;
        }
        delete cleaned.penalty1;
        delete cleaned.penalty2;
        delete cleaned.team1Penalties;
        delete cleaned.team2Penalties;
        delete cleaned.winnerId;
        delete cleaned.scorers;
        delete cleaned.matchSheet;
        delete cleaned.approvalStatus;
        delete cleaned.approvedByName;
        delete cleaned.approvedAt;
        delete cleaned.recordedByName;
        delete cleaned.recordedByRole;
        return cleaned as Match;
      });
      setLocal(STORAGE_KEYS.MATCHES, updatedAll);
      targetMatchIds.forEach(id => markPendingWrite('matches', id));

      if (!isCloudSyncPaused()) {
        const idsArray = Array.from(targetMatchIds);
        for (let i = 0; i < idsArray.length; i += 400) {
          const chunk = idsArray.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            const orig = targetMatchMap.get(id);
            const resetPayload: any = {
              id,
              score1: 0,
              score2: 0,
              team1Score: 0,
              team2Score: 0,
              status: 'Scheduled',
              penalty1: null,
              penalty2: null,
              team1Penalties: null,
              team2Penalties: null,
              winnerId: '',
              scorers: '',
              matchSheet: null,
              approvalStatus: null,
              approvedByName: '',
              approvedAt: '',
              recordedByName: '',
              recordedByRole: '',
              updatedAt: serverTimestamp()
            };
            if (orig && (orig.team1Placeholder || orig.team1SourceMatchNumber)) {
              const ph1 = orig.team1Placeholder || `الفائز من المباراة ${orig.team1SourceMatchNumber}`;
              resetPayload.team1Id = makePlaceholderTeamId(ph1);
              resetPayload.team1Name = ph1;
            }
            if (orig && (orig.team2Placeholder || orig.team2SourceMatchNumber)) {
              const ph2 = orig.team2Placeholder || `الفائز من المباراة ${orig.team2SourceMatchNumber}`;
              resetPayload.team2Id = makePlaceholderTeamId(ph2);
              resetPayload.team2Name = ph2;
            }
            batch.set(doc(db, 'matches', id), resetPayload, { merge: true });
          });
          try {
            await batch.commit();
            chunk.forEach(id => clearPendingWrite('matches', id));
          } catch (e) {
            console.warn('Reset match scores saved locally; Firestore sync pending:', e);
          }
        }
      }
    }

    // Check if Cross Country results are within scope
    const effectiveSportIdForSpecial = targetTournamentObj?.sportId || sportId;
    const isCrossCountryInScope = effectiveSportIdForSpecial
      ? areSportIdsEquivalent(effectiveSportIdForSpecial, 'cross_country', cachedSports)
      : !hasExplicitScopeFilter && (allowedSet === null || isSportInAllowedSet('cross_country', allowedSet, cachedSports));

    let resetCrossCountry = false;
    if (isCrossCountryInScope) {
      const activeSeason = await this.getActiveSeason();
      const ccResults = await this.getCrossCountryResults(effectiveDirId);
      const resetMap: Record<string, CrossCountryCategoryResult> = {};
      let modifiedAnyCC = false;

      for (const [key, val] of Object.entries(ccResults)) {
        const catVal = (val || {}) as CrossCountryCategoryResult;
        const matchesSpecificTournament =
          !targetTournamentObj ||
          ((!targetTournamentObj.affiliationType ||
            targetTournamentObj.affiliationType === 'open' ||
            (catVal.affiliationType || 'non_club') === targetTournamentObj.affiliationType) &&
            (!targetTournamentObj.ageCategory ||
              targetTournamentObj.ageCategory.includes('جميع') ||
              normalizeCategoryKey(catVal.category) === normalizeCategoryKey(targetTournamentObj.ageCategory)) &&
            (targetTournamentObj.gender === 'Mixed' || catVal.gender === targetTournamentObj.gender));

        if (matchesSpecificTournament) {
          if (catVal.podium && catVal.podium.length > 0) modifiedAnyCC = true;
          resetMap[key] = {
            ...catVal,
            categoryId: catVal.categoryId || key,
            directorateId: effectiveDirId,
            seasonId: activeSeason,
            podium: [],
            status: 'setup',
            updatedAt: new Date().toISOString()
          };
          if (!isCloudSyncPaused()) {
            try {
              const docId = `${effectiveDirId}_${key}`;
              await setDoc(
                doc(db, 'cross_country_results', docId),
                {
                  ...resetMap[key],
                  podium: [],
                  status: 'setup',
                  updatedAt: serverTimestamp()
                },
                { merge: true }
              );
            } catch (e) {
              console.warn(`Error resetting cross country doc for ${key}:`, e);
            }
          }
        } else {
          resetMap[key] = catVal;
        }
      }

      const cacheKey = `taourirt_cc_results_${effectiveDirId}`;
      localStorage.setItem(cacheKey, JSON.stringify(resetMap));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
      }
      resetCrossCountry = modifiedAnyCC || isCrossCountryInScope;
    }

    // Check if Athletics results are within scope
    const isAthleticsInScope = effectiveSportIdForSpecial
      ? areSportIdsEquivalent(effectiveSportIdForSpecial, 'athletics', cachedSports)
      : !hasExplicitScopeFilter && (allowedSet === null || isSportInAllowedSet('athletics', allowedSet, cachedSports));

    let resetAthletics = false;
    if (isAthleticsInScope && !tournamentId) {
      try {
        const athKeys = [
          'school_athletics_results_v2',
          'taourirt_athletics_results',
          `taourirt_athletics_results_${effectiveDirId}`
        ];
        athKeys.forEach(k => {
          const existing = localStorage.getItem(k);
          if (existing && existing !== '{}') {
            resetAthletics = true;
          }
          localStorage.setItem(k, '{}');
        });
        if (!isCloudSyncPaused()) {
          const qAth = query(
            collection(db, 'athletics_results'),
            where('directorateId', '==', effectiveDirId)
          );
          const snapAth = await getDocs(qAth).catch(() => null);
          if (snapAth && !snapAth.empty) {
            const batch = writeBatch(db);
            snapAth.docs.forEach((d: any) => batch.delete(d.ref));
            await batch.commit().catch(() => {});
            resetAthletics = true;
          }
        }
        window.dispatchEvent(new CustomEvent('athleticsResultsUpdated', { detail: {} }));
      } catch (e) {
        console.warn('Error resetting athletics results:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
      window.dispatchEvent(new CustomEvent('resultsChanged'));
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
    }

    return {
      resetMatchesCount: targetMatchIds.size,
      resetCrossCountry,
      resetAthletics
    };
  },

  /**
   * Delete all scheduled/programmed matches within optional sport/tournament & role scoping.
   */
  async clearScheduledMatchesByScope(options: {
    allowedSportIds?: string[] | null;
    sportId?: string;
    tournamentId?: string;
    affiliationType?: 'non_club' | 'club_affiliated' | 'open';
    ageCategory?: string;
    gender?: string;
    matchIds?: string[];
  } = {}): Promise<{ deletedMatchesCount: number }> {
    const activeDirId = this.getActiveDirectorateId();
    const { allowedSportIds } = options;
    if (options.sportId !== undefined && !String(options.sportId).trim()) {
      throw new Error('INVALID_SPORT_ID');
    }
    if (options.tournamentId !== undefined && !String(options.tournamentId).trim()) {
      throw new Error('INVALID_TOURNAMENT_ID');
    }
    const sportId = options.sportId ? String(options.sportId).trim() : undefined;
    const tournamentId = options.tournamentId ? String(options.tournamentId).trim() : undefined;
    const affiliationFilter = options.affiliationType;
    const ageCategoryFilter = options.ageCategory ? normalizeCategoryKey(options.ageCategory) : undefined;
    const genderFilter = options.gender && options.gender !== 'ALL' ? String(options.gender).trim() : undefined;
    const explicitMatchIds = Array.isArray(options.matchIds) && options.matchIds.length > 0
      ? new Set(options.matchIds.filter(Boolean))
      : null;

    let cachedSports = getLocal<Sport>('taourirt_sports_config', []);
    if (cachedSports.length === 0) {
      cachedSports = await this.getSportsConfig().catch(() => []);
    }
    const allowedSet = buildAllowedSportSet(allowedSportIds, cachedSports);

    if (sportId && allowedSet !== null && !isSportInAllowedSet(sportId, allowedSet, cachedSports)) {
      throw new Error('UNAUTHORIZED_SPORT_RESET');
    }

    const allTourns = await this.getTournaments();
    const tournamentSportMap = new Map<string, string>();
    const tournamentByIdMap = new Map<string, Tournament>();
    allTourns.forEach(t => {
      if (t && t.id) {
        tournamentByIdMap.set(t.id, t);
        if (t.sportId) {
          tournamentSportMap.set(t.id, t.sportId);
        }
      }
    });

    let targetTournamentObj: Tournament | undefined;
    if (tournamentId) {
      targetTournamentObj = allTourns.find(t => t.id === tournamentId);
      if (
        targetTournamentObj &&
        allowedSet !== null &&
        !isSportInAllowedSet(targetTournamentObj.sportId, allowedSet, cachedSports)
      ) {
        throw new Error('UNAUTHORIZED_SPORT_RESET');
      }
    }

    const effectiveSportScope = sportId || targetTournamentObj?.sportId;
    const cloudMatches = await this.getMatches();
    const localCachedInDir = getLocal<Match>(STORAGE_KEYS.MATCHES, [])
      .map(normalizeMatchRecord)
      .filter(m => !activeDirId || activeDirId === 'all' || (m.directorateId || 'taourirt') === activeDirId);
    const matchesToInspect = deduplicateById([...cloudMatches, ...localCachedInDir]);

    const deleteIds = new Set<string>();

    matchesToInspect.forEach(m => {
      if (!m || !m.id) return;
      if (explicitMatchIds && !explicitMatchIds.has(m.id)) {
        return;
      }
      if (!doesMatchMatchSportScope(m, allowedSet, effectiveSportScope, tournamentSportMap, cachedSports)) {
        return;
      }
      if (tournamentId) {
        const directMatch = m.tournamentId === tournamentId;
        const metaMatch =
          !m.tournamentId &&
          targetTournamentObj &&
          areSportIdsEquivalent(m.sportId, targetTournamentObj.sportId, cachedSports) &&
          normalizeCategoryKey(m.ageCategory) === normalizeCategoryKey(targetTournamentObj.ageCategory) &&
          (m.gender === targetTournamentObj.gender || targetTournamentObj.gender === 'Mixed') &&
          ((m as any).affiliationType || 'non_club') === (targetTournamentObj.affiliationType || 'non_club');
        if (!directMatch && !metaMatch) {
          return;
        }
      }
      if (affiliationFilter) {
        const parentT = m.tournamentId ? tournamentByIdMap.get(m.tournamentId) : undefined;
        const resolvedAff =
          m.affiliationType ||
          (parentT ? normalizeTournamentAffiliation(parentT.affiliationType, parentT.name) : undefined) ||
          'non_club';
        if (resolvedAff !== affiliationFilter) {
          return;
        }
      }
      if (ageCategoryFilter) {
        if (normalizeCategoryKey(m.ageCategory || '') !== ageCategoryFilter) {
          return;
        }
      }
      if (genderFilter && genderFilter !== 'Mixed') {
        if (m.gender !== genderFilter && m.gender !== 'Mixed') {
          return;
        }
      }
      deleteIds.add(m.id);
    });

    if (deleteIds.size > 0) {
      deleteIds.forEach(id => markRecentlyDeleted('matches', id));
      const allCached = getLocal<Match>(STORAGE_KEYS.MATCHES, []);
      const remaining = allCached.filter(m => !deleteIds.has(m.id));
      setLocal(STORAGE_KEYS.MATCHES, remaining);

      if (!isCloudSyncPaused()) {
        const idsArray = Array.from(deleteIds);
        for (let i = 0; i < idsArray.length; i += 400) {
          const chunk = idsArray.slice(i, i + 400);
          const batch = writeBatch(db);
          chunk.forEach(id => {
            batch.delete(doc(db, 'matches', id));
          });
          try {
            await batch.commit();
          } catch (e) {
            console.warn('Firestore batch delete failed, falling back to per-document delete:', e);
            await Promise.allSettled(
              chunk.map(id => deleteDoc(doc(db, 'matches', id)).catch(err => {
                console.warn(`Failed to delete match ${id}:`, err);
              }))
            );
          }
        }
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('matchesDataChanged'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
      window.dispatchEvent(new CustomEvent('resultsChanged'));
      window.dispatchEvent(new CustomEvent('tournamentDataChanged'));
    }

    return {
      deletedMatchesCount: deleteIds.size
    };
  },

  async getCrossCountryResults(targetDirectorateId?: string): Promise<Record<string, CrossCountryCategoryResult>> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const activeSeason = await this.getActiveSeason();
    const cacheKey = `taourirt_cc_results_${effectiveDirId}`;
    try {
      const snap = await getDocs(collection(db, 'cross_country_results'));
      if (!snap.empty) {
        const resultsMap: Record<string, CrossCountryCategoryResult> = {};
        let foundAnyForDir = false;

        snap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const docDirId = data.directorateId || (docSnap.id.includes('_') ? docSnap.id.substring(0, docSnap.id.lastIndexOf('_')) : (effectiveDirId === 'taourirt' ? 'taourirt' : ''));
          const docSeasonId = data.seasonId || '2026/2027';

          // Only process results for the current active season
          if (docSeasonId !== activeSeason) return;

          if (docDirId === effectiveDirId) {
            foundAnyForDir = true;
            const item = this._normalizeCrossCountryDoc(docSnap.id, data, effectiveDirId);
            const keyToUse = item.categoryId || docSnap.id;
            resultsMap[keyToUse] = item;
          }
        });

        this._sanitizeCrossCountryResultsMap(resultsMap);
        localStorage.setItem(cacheKey, JSON.stringify(resultsMap));
        return resultsMap;
      }
    } catch (e) {
      console.warn("Firestore fetch cross_country_results error, using local storage:", e);
    }

    // Check local storage for this specific directorate
    try {
      const local = localStorage.getItem(cacheKey);
      if (local) {
        const parsed = JSON.parse(local);
        return this._sanitizeCrossCountryResultsMap(parsed || {});
      }
    } catch (e) {
      console.error("Local storage error reading cross country results:", e);
    }

    return {};
  },

  // Dispatch local and cross-tab updates
  _notifyCCUpdate(result: CrossCountryCategoryResult) {
    const event = new CustomEvent('crossCountryResultsUpdated', { detail: result });
    window.dispatchEvent(event);
    try {
      const bc = new BroadcastChannel('cc_results_sync');
      bc.postMessage({ type: 'UPDATE', result });
      bc.close();
    } catch (e) {}
  },

  async saveCrossCountryCategoryResult(result: CrossCountryCategoryResult): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const cacheKey = `taourirt_cc_results_${effectiveDirId}`;
    const activeSeason = await this.getActiveSeason();
    
    const resultWithDir: CrossCountryCategoryResult = {
      ...result,
      directorateId: result.directorateId || effectiveDirId,
      seasonId: result.seasonId || activeSeason,
      updatedAt: new Date().toISOString()
    };

    // Update local cache
    try {
      const current = await this.getCrossCountryResults();
      current[result.categoryId] = resultWithDir;
      localStorage.setItem(cacheKey, JSON.stringify(current));
    } catch (e) {
      console.error("Error updating local CC results:", e);
    }

    // Sync to Firestore
    try {
      const docId = `${effectiveDirId}_${result.categoryId}`;
      // Clean undefined values to prevent Firestore rejection
      const sanitized = JSON.parse(JSON.stringify(resultWithDir));
      await setDoc(doc(db, 'cross_country_results', docId), {
        ...sanitized,
        id: docId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore save CC result error:", e);
    }

    this._notifyCCUpdate(resultWithDir);
  },

  async approveCrossCountryCategoryResult(categoryId: string, approverName: string): Promise<CrossCountryCategoryResult | null> {
    const current = await this.getCrossCountryResults();
    const existing = current[categoryId];
    if (!existing) return null;
    const approved: CrossCountryCategoryResult = {
      ...existing,
      approvalStatus: 'approved',
      approvedByName: approverName,
      approvedAt: new Date().toISOString()
    };
    await this.saveCrossCountryCategoryResult(approved);
    return approved;
  },

  /**
   * Clear recorded arrivals / podium for a single Cross Country category
   */
  async clearCrossCountryCategoryResult(categoryId: string): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const cacheKey = `taourirt_cc_results_${activeDirId}`;

    // 1. Update local cache
    try {
      const current = await this.getCrossCountryResults();
      if (current[categoryId]) {
        current[categoryId] = {
          ...current[categoryId],
          podium: [],
          status: 'setup',
          updatedAt: new Date().toISOString()
        };
      }
      if (categoryId === 'u12_male' || categoryId === 'u13_male') {
        if (current['u12_male']) current['u12_male'] = { ...current['u12_male'], podium: [], status: 'setup', updatedAt: new Date().toISOString() };
        if (current['u13_male']) current['u13_male'] = { ...current['u13_male'], podium: [], status: 'setup', updatedAt: new Date().toISOString() };
      }
      if (categoryId === 'u12_female' || categoryId === 'u13_female') {
        if (current['u12_female']) current['u12_female'] = { ...current['u12_female'], podium: [], status: 'setup', updatedAt: new Date().toISOString() };
        if (current['u13_female']) current['u13_female'] = { ...current['u13_female'], podium: [], status: 'setup', updatedAt: new Date().toISOString() };
      }
      localStorage.setItem(cacheKey, JSON.stringify(current));
    } catch (e) {
      console.warn("Local clear CC category error:", e);
    }

    // 2. Sync to Firestore
    try {
      const docId = `${activeDirId}_${categoryId}`;
      await setDoc(doc(db, 'cross_country_results', docId), {
        podium: [],
        status: 'setup',
        updatedAt: serverTimestamp()
      }, { merge: true });

      // Also clean alias doc if applicable
      if (categoryId === 'u12_male') {
        await setDoc(doc(db, 'cross_country_results', `${activeDirId}_u13_male`), { podium: [], status: 'setup', updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      } else if (categoryId === 'u12_female') {
        await setDoc(doc(db, 'cross_country_results', `${activeDirId}_u13_female`), { podium: [], status: 'setup', updatedAt: serverTimestamp() }, { merge: true }).catch(() => {});
      }
    } catch (e) {
      console.warn("Firestore clear CC category error:", e);
    }

    window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
  },

  /**
   * Clear recorded arrivals / podium across ALL 8 Cross Country categories
   */
  async clearAllCrossCountryResults(): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const cacheKey = `taourirt_cc_results_${activeDirId}`;

    // 1. Reset local cache cleanly to empty object (no demo winners)
    localStorage.setItem(cacheKey, '{}');

    // 2. Clear all docs in Firestore
    try {
      const q = collection(db, 'cross_country_results');
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          const data = d.data();
          if (!data.directorateId || data.directorateId === activeDirId || activeDirId === 'taourirt' || !activeDirId) {
            batch.update(d.ref, {
              podium: [],
              status: 'setup',
              updatedAt: serverTimestamp()
            });
          }
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn("Firestore clear all CC results error:", e);
    }

    window.dispatchEvent(new CustomEvent('crossCountryResultsUpdated'));
  },

  /**
   * Clear all students/participants registered under sportId === 'cross_country'
   */
  async clearCrossCountryParticipants(): Promise<number> {
    const activeDirId = this.getActiveDirectorateId();

    // 1. Filter local cache
    const localList = getLocal<Student>('taourirt_students_data', []);
    const remaining = localList.filter(s => s.sportId !== 'cross_country');
    const removedCount = localList.length - remaining.length;
    setLocal('taourirt_students_data', remaining);

    // 2. Delete matching docs from Firestore
    try {
      const q = query(
        collection(db, 'students'),
        where('sportId', '==', 'cross_country')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => {
          batch.delete(d.ref);
        });
        await batch.commit();
      }
    } catch (e) {
      console.warn("Firestore clear CC participants error:", e);
    }

    window.dispatchEvent(new CustomEvent('studentsUpdated'));
    return removedCount;
  },

  /**
   * Get track & field / athletics results
   */
  async getAthleticsResults(targetDirectorateId?: string): Promise<Record<string, AthleticsCategoryResult>> {
    const activeDirId = targetDirectorateId || this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const cacheKey = `taourirt_athletics_results_${effectiveDirId}`;
    
    // 1. Try local cache
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Object.keys(parsed).length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Failed reading cached athletics results:", e);
    }

    // 2. Fetch from Firestore
    try {
      const q = query(
        collection(db, 'athletics_results'),
        where('directorateId', '==', effectiveDirId)
      );
      const snap = await getDocs(q);
      const map: Record<string, AthleticsCategoryResult> = {};
      snap.docs.forEach((d) => {
        const data = d.data() as AthleticsCategoryResult;
        if (data.id) {
          map[data.id] = data;
        }
      });
      
      if (Object.keys(map).length > 0) {
        localStorage.setItem(cacheKey, JSON.stringify(map));
        return map;
      }
    } catch (e) {
      console.warn("Firestore athletics results fetch error:", e);
    }

    // 3. Fallback to localStorage without filtering only if taourirt
    try {
      if (effectiveDirId === 'taourirt') {
        const globalCached = localStorage.getItem('taourirt_athletics_results');
        if (globalCached) return JSON.parse(globalCached);
      }
    } catch (e) {}

    return {};
  },

  async saveAthleticsCategoryResult(result: AthleticsCategoryResult): Promise<void> {
    const activeDirId = this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;
    const cacheKey = `taourirt_athletics_results_${effectiveDirId}`;
    const activeSeason = await this.getActiveSeason();

    const resultWithDir: AthleticsCategoryResult = {
      ...result,
      directorateId: result.directorateId || effectiveDirId,
      seasonId: result.seasonId || activeSeason,
      updatedAt: new Date().toISOString()
    };

    // Update local cache
    try {
      const current = await this.getAthleticsResults();
      current[result.id] = resultWithDir;
      localStorage.setItem(cacheKey, JSON.stringify(current));
      localStorage.setItem('taourirt_athletics_results', JSON.stringify(current));
    } catch (e) {
      console.error("Error updating local Athletics results:", e);
    }

    // Sync to Firestore
    try {
      const docId = `${effectiveDirId}_${result.id}`;
      const sanitized = JSON.parse(JSON.stringify(resultWithDir));
      await setDoc(doc(db, 'athletics_results', docId), {
        ...sanitized,
        id: docId,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn("Firestore save Athletics result error:", e);
    }

    window.dispatchEvent(new CustomEvent('athleticsResultsUpdated', { detail: resultWithDir }));
  },

  subscribeAthleticsResults(callback: (results: Record<string, AthleticsCategoryResult>) => void): () => void {
    const activeDirId = this.getActiveDirectorateId();
    const effectiveDirId = (!activeDirId || activeDirId === 'all') ? 'taourirt' : activeDirId;

    // Load initial
    this.getAthleticsResults().then(callback);

    // Event listener
    const handleUpdate = () => {
      this.getAthleticsResults().then(callback);
    };
    window.addEventListener('athleticsResultsUpdated', handleUpdate);

    // Firestore listener
    let unsubscribeFirestore = () => {};
    try {
      const q = query(
        collection(db, 'athletics_results'),
        where('directorateId', '==', effectiveDirId)
      );
      unsubscribeFirestore = onSnapshot(q, (snap) => {
        const map: Record<string, AthleticsCategoryResult> = {};
        snap.docs.forEach((d) => {
          const data = d.data() as AthleticsCategoryResult;
          if (data.id) {
            map[data.id] = data;
          }
        });
        if (Object.keys(map).length > 0) {
          localStorage.setItem(`taourirt_athletics_results_${effectiveDirId}`, JSON.stringify(map));
          callback(map);
        }
      }, (err) => console.warn("Athletics listener error:", err));
    } catch (e) {}

    return () => {
      window.removeEventListener('athleticsResultsUpdated', handleUpdate);
      unsubscribeFirestore();
    };
  },

  async syncAllDataFromCloud(): Promise<{
    success: boolean;
    schoolsCount: number;
    tournamentsCount: number;
    studentsCount: number;
    matchesCount: number;
    venuesCount: number;
    refereesCount: number;
    directoratesCount: number;
    timestamp: number;
  }> {
    // Immediately abort cloud sync if user paused Cloud Sync so localStorage stays 100% untouched
    if (isCloudSyncPaused()) {
      return {
        success: false,
        schoolsCount: getLocal<School>(STORAGE_KEYS.SCHOOLS, []).length,
        tournamentsCount: getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []).length,
        studentsCount: getLocal<Student>('taourirt_students_data', []).length,
        matchesCount: getLocal<Match>(STORAGE_KEYS.MATCHES, []).length,
        venuesCount: getLocal<Venue>(STORAGE_KEYS.VENUES, []).length,
        refereesCount: getLocal<Referee>('taourirt_referees_data', []).length,
        directoratesCount: getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, []).length,
        timestamp: Date.now()
      };
    }

    try {
      const [
        schoolsSnap,
        tournamentsSnap,
        studentsSnap,
        matchesSnap,
        venuesSnap,
        refereesSnap,
        directoratesSnap,
        sportsSnap,
        ccSnap,
        permsSnap,
        configSnap
      ] = await Promise.all([
        getDocs(collection(db, 'schools')).catch(() => null),
        getDocs(collection(db, 'tournaments')).catch(() => null),
        getDocs(collection(db, 'students')).catch(() => null),
        getDocs(collection(db, 'matches')).catch(() => null),
        getDocs(collection(db, 'venues')).catch(() => null),
        getDocs(collection(db, 'referees')).catch(() => null),
        getDocs(collection(db, 'directorates')).catch(() => null),
        getDocs(collection(db, 'sports')).catch(() => null),
        getDocs(collection(db, 'cross_country_results')).catch(() => null),
        getDoc(doc(db, 'settings', 'role_sidebar_permissions')).catch(() => null),
        getDocs(collection(db, 'config')).catch(() => null)
      ]);

      // If all primary queries failed (e.g. 429 Quota Exceeded or network offline), abort without firing noisy refresh events
      if (!schoolsSnap && !tournamentsSnap && !studentsSnap && !matchesSnap) {
        return {
          success: false,
          schoolsCount: getLocal<School>(STORAGE_KEYS.SCHOOLS, []).length,
          tournamentsCount: getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []).length,
          studentsCount: getLocal<Student>('taourirt_students_data', []).length,
          matchesCount: getLocal<Match>(STORAGE_KEYS.MATCHES, []).length,
          venuesCount: getLocal<Venue>(STORAGE_KEYS.VENUES, []).length,
          refereesCount: getLocal<Referee>('taourirt_referees_data', []).length,
          directoratesCount: getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, []).length,
          timestamp: Date.now()
        };
      }

      let schoolsCount = 0;
      const localSchools = getLocal<School>(STORAGE_KEYS.SCHOOLS, []).filter(
        s => s && s.name && !s.name.includes('غير محدد') && !isRecentlyDeleted('schools', s.id)
      );
      const pendingLocalSchools = localSchools.filter(ls => isPendingWrite('schools', ls.id));

      if (schoolsSnap) {
        const firestoreSchools = schoolsSnap.docs
          .filter((d: any) => !isRecentlyDeleted('schools', d.id))
          .map((d: any) => ({ id: d.id, ...d.data() } as School))
          .filter((s: School) => s && s.name && !s.name.includes('غير محدد'));

        if (pendingLocalSchools.length > 0 && !isCloudSyncPaused()) {
          for (const ls of pendingLocalSchools) {
            if (isQueuedInExcelCloudSync('schools', ls.id)) continue;
            const docRef = ls.id ? doc(db, 'schools', ls.id) : doc(collection(db, 'schools'));
            const sanitized = sanitizeFirestorePayload({
              ...ls,
              id: docRef.id,
              updatedAt: serverTimestamp()
            });
            setDoc(docRef, sanitized, { merge: true })
              .then(() => clearPendingWrite('schools', docRef.id))
              .catch(() => {});
          }
        }

        const merged = deduplicateById([...pendingLocalSchools, ...firestoreSchools]);
        setLocal(STORAGE_KEYS.SCHOOLS, merged);
        schoolsCount = merged.length;
      } else {
        schoolsCount = localSchools.length;
      }

      let tournamentsCount = 0;
      if (tournamentsSnap) {
        const firestoreTournaments = tournamentsSnap.docs
          .filter(d => !isRecentlyDeleted('tournaments', d.id))
          .map(d => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              startDate: data.startDate?.toDate ? data.startDate.toDate() : data.startDate,
              endDate: data.endDate?.toDate ? data.endDate.toDate() : data.endDate,
              registrationDeadline: data.registrationDeadline?.toDate ? data.registrationDeadline.toDate() : data.registrationDeadline,
            } as Tournament;
          });
        const pendingLocal = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []).filter(
          t => t && !isRecentlyDeleted('tournaments', t.id) && isPendingWrite('tournaments', t.id)
        );
        const merged = deduplicateById([...pendingLocal, ...firestoreTournaments]);
        setLocal(STORAGE_KEYS.TOURNAMENTS, merged);
        tournamentsCount = merged.length;
      } else {
        const localList = getLocal<Tournament>(STORAGE_KEYS.TOURNAMENTS, []);
        tournamentsCount = localList.length;
      }

      let studentsCount = 0;
      if (studentsSnap) {
        const firestoreStudents = studentsSnap.docs
          .filter(d => !isRecentlyDeleted('students', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Student));
        const pendingLocal = getLocal<Student>('taourirt_students_data', []).filter(
          s => s && !isRecentlyDeleted('students', s.id) && isPendingWrite('students', s.id)
        );
        const merged = deduplicateById([...pendingLocal, ...firestoreStudents]);
        setLocal('taourirt_students_data', merged);
        studentsCount = merged.length;
      } else {
        const localList = getLocal<Student>('taourirt_students_data', []);
        studentsCount = localList.length;
      }

      let matchesCount = 0;
      if (matchesSnap) {
        const firestoreMatches = matchesSnap.docs
          .filter(d => !isRecentlyDeleted('matches', d.id))
          .map(d => normalizeMatchRecord({ id: d.id, ...d.data() } as Match));
        const pendingLocal = getLocal<Match>(STORAGE_KEYS.MATCHES, [])
          .filter(m => m && !isRecentlyDeleted('matches', m.id) && isPendingWrite('matches', m.id))
          .map(normalizeMatchRecord);
        const merged = deduplicateById([...pendingLocal, ...firestoreMatches]);
        setLocal(STORAGE_KEYS.MATCHES, merged);
        matchesCount = merged.length;
      } else {
        const localList = getLocal<Match>(STORAGE_KEYS.MATCHES, []).map(normalizeMatchRecord);
        setLocal(STORAGE_KEYS.MATCHES, localList);
        matchesCount = localList.length;
      }

      let venuesCount = 0;
      if (venuesSnap) {
        const firestoreVenues = venuesSnap.docs
          .filter(d => !isRecentlyDeleted('venues', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Venue));
        const pendingLocal = getLocal<Venue>(STORAGE_KEYS.VENUES, []).filter(
          v => v && !isRecentlyDeleted('venues', v.id) && isPendingWrite('venues', v.id)
        );
        const baseVenues = venuesSnap.empty && pendingLocal.length === 0 ? INITIAL_VENUES.filter(v => !isRecentlyDeleted('venues', v.id)) : firestoreVenues;
        const merged = deduplicateById([...pendingLocal, ...baseVenues]);
        setLocal(STORAGE_KEYS.VENUES, merged);
        venuesCount = merged.length;
      }

      let refereesCount = 0;
      if (refereesSnap) {
        const firestoreReferees = refereesSnap.docs
          .filter(d => !isRecentlyDeleted('referees', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Referee));
        const pendingLocal = deduplicateById([
          ...getLocal<Referee>('taourirt_referees_data', []),
          ...getLocal<Referee>('referees', [])
        ]).filter(r => r && !isRecentlyDeleted('referees', r.id) && isPendingWrite('referees', r.id));
        const merged = deduplicateById([...pendingLocal, ...firestoreReferees]);
        setLocal('taourirt_referees_data', merged);
        setLocal('referees', merged);
        refereesCount = merged.length;
      }

      let directoratesCount = 0;
      if (directoratesSnap && !directoratesSnap.empty) {
        const firestoreDirs = directoratesSnap.docs
          .filter(d => !isRecentlyDeleted('directorates', d.id))
          .map(d => ({ id: d.id, ...d.data() } as Directorate));
        const pendingLocal = getLocal<Directorate>(STORAGE_KEYS.DIRECTORATES, []).filter(
          d => d && !isRecentlyDeleted('directorates', d.id) && isPendingWrite('directorates', d.id)
        );
        const merged = deduplicateById([...pendingLocal, ...firestoreDirs]);
        setLocal(STORAGE_KEYS.DIRECTORATES, merged);
        directoratesCount = merged.length;
      }

      if (sportsSnap && !sportsSnap.empty) {
        const firestoreSports = sportsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Sport));
        const localList = getLocal<Sport>('taourirt_sports_config', []);
        const pendingSports = localList.filter(ls => ls && ls.id && isPendingWrite('sports', ls.id));
        const merged = deduplicateById([...pendingSports, ...firestoreSports, ...localList]);
        setLocal('taourirt_sports_config', merged);
      }

      if (ccSnap && !ccSnap.empty) {
        const activeDirId = this.getActiveDirectorateId();
        const resultsMap: Record<string, CrossCountryCategoryResult> = {};
        ccSnap.docs.forEach(docSnap => {
          const data = docSnap.data() as CrossCountryCategoryResult;
          if (!data.directorateId || data.directorateId === activeDirId) {
            resultsMap[data.categoryId || docSnap.id] = { ...data, categoryId: data.categoryId || docSnap.id };
          }
        });
        const cacheKey = `taourirt_cc_results_${activeDirId}`;
        localStorage.setItem(cacheKey, JSON.stringify(resultsMap));
      }

      if (permsSnap && permsSnap.exists()) {
        const firestorePerms = permsSnap.data() as RoleSidebarPermissions;
        if (firestorePerms) {
          localStorage.setItem('taourirt_role_sidebar_permissions', JSON.stringify(firestorePerms));
          window.dispatchEvent(new CustomEvent('sidebarPermissionsChanged', { detail: firestorePerms }));
        }
      }

      if (configSnap && !configSnap.empty) {
        const seasonsDoc = configSnap.docs.find(d => d.id === 'seasons');
        if (seasonsDoc && seasonsDoc.data().list) {
          localStorage.setItem('taourirt_sports_seasons_list', JSON.stringify(seasonsDoc.data().list));
        }
        const seasonDoc = configSnap.docs.find(d => d.id === 'season');
        if (seasonDoc && seasonDoc.data().current) {
          localStorage.setItem('taourirt_sports_season', seasonDoc.data().current);
          window.dispatchEvent(new CustomEvent('seasonChanged', { detail: seasonDoc.data().current }));
        }
      }

      // Dispatch real-time global refresh events across all app components and open tabs
      window.dispatchEvent(new CustomEvent('dataSynchronized', {
        detail: {
          timestamp: Date.now(),
          schoolsCount,
          tournamentsCount,
          studentsCount,
          matchesCount
        }
      }));
      window.dispatchEvent(new CustomEvent('schoolsUpdated'));
      window.dispatchEvent(new CustomEvent('tournamentsUpdated'));
      window.dispatchEvent(new CustomEvent('studentsUpdated'));
      window.dispatchEvent(new CustomEvent('matchesUpdated'));
      window.dispatchEvent(new CustomEvent('directoratesListUpdated'));

      return {
        success: true,
        schoolsCount,
        tournamentsCount,
        studentsCount,
        matchesCount,
        venuesCount,
        refereesCount,
        directoratesCount,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error("syncAllDataFromCloud error:", error);
      return {
        success: false,
        schoolsCount: 0,
        tournamentsCount: 0,
        studentsCount: 0,
        matchesCount: 0,
        venuesCount: 0,
        refereesCount: 0,
        directoratesCount: 0,
        timestamp: Date.now()
      };
    }
  },

  // --- SCHOOL TOURNAMENT PARTICIPATION CONFIRMATIONS ---
  async getSchoolConfirmations(targetDirectorateId?: string): Promise<SchoolTournamentConfirmation[]> {
    try {
      const activeDirId = targetDirectorateId || this.getActiveDirectorateId() || 'taourirt';
      const snap = await getDocs(collection(db, 'school_confirmations'));
      let list: SchoolTournamentConfirmation[] = [];
      snap.forEach(docSnap => {
        if (!isRecentlyDeleted('school_confirmations', docSnap.id)) {
          list.push({ id: docSnap.id, ...docSnap.data() } as SchoolTournamentConfirmation);
        }
      });
      const pendingLocal = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
        c => c && !isRecentlyDeleted('school_confirmations', c.id) && isPendingWrite('school_confirmations', c.id)
      );
      list = deduplicateById([...pendingLocal, ...list]);
      setLocal(STORAGE_KEYS.CONFIRMATIONS, list);
      if (activeDirId === 'all') return list;
      return list.filter(c => !activeDirId || !c.directorateId || c.directorateId === activeDirId);
    } catch (e) {
      console.warn('Error fetching school confirmations from Firestore, using local storage:', e);
      const local = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
        c => c && !isRecentlyDeleted('school_confirmations', c.id)
      );
      return local;
    }
  },

  async confirmSchoolParticipation(data: {
    sportId: string;
    sportName?: string;
    tournamentId?: string;
    schoolId: string;
    schoolName: string;
    teacherId: string;
    teacherName: string;
    teacherPhone?: string;
    teacherLeaseNumber?: string;
    registrationDeadline?: string;
    notes?: string;
    directorateId?: string;
    seasonId?: string;
    categories?: string[];
    genders?: ('Male' | 'Female')[];
    affiliationTypes?: string[];
    selectedBranches?: Array<{
      category: string;
      gender: 'Male' | 'Female';
      affiliationType: string;
    }>;
  }): Promise<SchoolTournamentConfirmation> {
    const confirmationId = `${data.sportId}_${data.schoolId}`;

    let normalizedBranches: ConfirmedBranchTuple[] = [];
    if (Array.isArray(data.selectedBranches) && data.selectedBranches.length > 0) {
      const seen = new Set<string>();
      data.selectedBranches.forEach(b => {
        if (!b || !b.category) return;
        const cat = normalizeCategoryKey(b.category);
        const gen: 'Male' | 'Female' = b.gender === 'Female' ? 'Female' : 'Male';
        const aff = (b.affiliationType || 'non_club').trim();
        const key = `${aff}__${cat}__${gen}`;
        if (!seen.has(key)) {
          seen.add(key);
          normalizedBranches.push({ category: cat, gender: gen, affiliationType: aff });
        }
      });
    } else {
      const cats = (data.categories && data.categories.length > 0 ? data.categories : ['U15']).map(normalizeCategoryKey);
      const gens: ('Male' | 'Female')[] = data.genders && data.genders.length > 0 ? data.genders : ['Male', 'Female'];
      const affs = data.affiliationTypes && data.affiliationTypes.length > 0 ? data.affiliationTypes : ['non_club'];
      const seen = new Set<string>();
      affs.forEach(aff => {
        cats.forEach(cat => {
          gens.forEach(gen => {
            const key = `${aff}__${cat}__${gen}`;
            if (!seen.has(key)) {
              seen.add(key);
              normalizedBranches.push({ category: cat, gender: gen, affiliationType: aff });
            }
          });
        });
      });
    }

    const derivedCategories = Array.from(new Set(normalizedBranches.map(b => b.category)));
    const derivedGenders = Array.from(new Set(normalizedBranches.map(b => b.gender)));
    const derivedAffiliations = Array.from(new Set(normalizedBranches.map(b => b.affiliationType)));
    const resolvedDir = data.directorateId || this.getActiveDirectorateId() || 'taourirt';
    const effectiveDirId = resolvedDir === 'all' ? 'taourirt' : resolvedDir;
    const nowIso = new Date().toISOString();

    const current = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []);
    const existingConf = current.find(
      c =>
        c &&
        c.sportId === data.sportId &&
        (c.directorateId || 'taourirt') === effectiveDirId &&
        (
          c.id === confirmationId ||
          (data.schoolId && c.schoolId === data.schoolId) ||
          (data.schoolName && c.schoolName && schoolNamesMatch(c.schoolName, data.schoolName))
        )
    );

    const prevBranchTeachers = existingConf?.branchTeachers || {};
    const prevBranchKeys = new Set(
      existingConf
        ? getEffectiveConfirmedBranches(existingConf, false).map(
            b => `${b.affiliationType}__${normalizeCategoryKey(b.category)}__${b.gender}`
          )
        : []
    );

    const nextBranchTeachers: NonNullable<SchoolTournamentConfirmation['branchTeachers']> = {};
    normalizedBranches.forEach(b => {
      const bKey = `${b.affiliationType}__${normalizeCategoryKey(b.category)}__${b.gender}`;
      const isNewlyAddedBranch = !prevBranchKeys.has(bKey);
      const prevInfo = prevBranchTeachers[bKey];
      if (!isNewlyAddedBranch && prevInfo && prevInfo.teacherName) {
        nextBranchTeachers[bKey] = prevInfo;
      } else {
        nextBranchTeachers[bKey] = {
          teacherId: data.teacherId || '',
          teacherName: data.teacherName || '',
          ...(data.teacherPhone ? { teacherPhone: data.teacherPhone } : {}),
          ...(data.teacherLeaseNumber ? { teacherLeaseNumber: data.teacherLeaseNumber } : {}),
          confirmedAt: nowIso
        };
      }
    });

    const payload: SchoolTournamentConfirmation = {
      ...data,
      categories: derivedCategories,
      genders: derivedGenders,
      affiliationTypes: derivedAffiliations,
      selectedBranches: normalizedBranches,
      branchTeachers: nextBranchTeachers,
      id: confirmationId,
      status: 'confirmed',
      confirmedAt: nowIso,
      directorateId: effectiveDirId,
      seasonId: data.seasonId || '2026/2027'
    };

    const duplicateDocIds = new Set<string>();
    current.forEach(c => {
      if (
        c &&
        c.id !== confirmationId &&
        c.sportId === data.sportId &&
        (c.directorateId || 'taourirt') === effectiveDirId &&
        (
          (data.schoolId && c.schoolId === data.schoolId) ||
          (data.schoolName && c.schoolName && schoolNamesMatch(c.schoolName, data.schoolName))
        )
      ) {
        duplicateDocIds.add(c.id);
      }
    });

    duplicateDocIds.forEach(dupId => markRecentlyDeleted('school_confirmations', dupId));
    const updated = deduplicateById([
      payload,
      ...current.filter(c => c.id !== confirmationId && !duplicateDocIds.has(c.id))
    ]);
    setLocal(STORAGE_KEYS.CONFIRMATIONS, updated);
    markPendingWrite('school_confirmations', confirmationId);

    try {
      const cleanPayload = stripUndefinedDeep(payload);
      await setDoc(doc(db, 'school_confirmations', confirmationId), cleanPayload, { merge: false });
      clearPendingWrite('school_confirmations', confirmationId);
      if (duplicateDocIds.size > 0) {
        await Promise.all(
          Array.from(duplicateDocIds).map(dupId => deleteDoc(doc(db, 'school_confirmations', dupId)).catch(() => {}))
        );
      }
    } catch (err) {
      console.error('Error writing school confirmation to Firestore:', err);
    }

    window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated', { detail: payload }));
    return payload;
  },

  async cancelSchoolConfirmation(sportId: string, schoolId: string, schoolName?: string): Promise<void> {
    const confirmationId = `${sportId}_${schoolId}`;
    const cleanTargetName = (schoolName || schoolId || '').trim();
    const resolvedSchoolName = (schoolName || '').trim() || cleanTargetName;

    const current = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []);
    const matchedIds = new Set<string>([confirmationId]);
    let discoveredSchoolName = resolvedSchoolName;

    current.forEach(c => {
      if (c && c.sportId === sportId) {
        const idMatch = c.id === confirmationId || (schoolId && c.schoolId === schoolId);
        const nameMatch = Boolean(cleanTargetName && c.schoolName && schoolNamesMatch(c.schoolName, cleanTargetName));
        if (idMatch || nameMatch) {
          matchedIds.add(c.id);
          if (c.schoolName) discoveredSchoolName = c.schoolName;
        }
      }
    });

    // Also inspect Firestore confirmations for this sport so duplicate variants created under schoolId vs schoolName are all removed
    try {
      const snap = await getDocs(query(collection(db, 'school_confirmations'), where('sportId', '==', sportId)));
      snap.forEach((d: any) => {
        const data = d.data() || {};
        const idMatch = d.id === confirmationId || (schoolId && data.schoolId === schoolId);
        const nameMatch = Boolean(cleanTargetName && data.schoolName && schoolNamesMatch(data.schoolName, cleanTargetName));
        if (idMatch || nameMatch) {
          matchedIds.add(d.id);
          if (data.schoolName) discoveredSchoolName = data.schoolName;
        }
      });
    } catch {
      // ignore offline error
    }

    matchedIds.forEach(id => markRecentlyDeleted('school_confirmations', id));
    const updated = current.filter(c => !matchedIds.has(c.id));
    setLocal(STORAGE_KEYS.CONFIRMATIONS, updated);

    try {
      await Promise.all(
        Array.from(matchedIds).map(id => deleteDoc(doc(db, 'school_confirmations', id)).catch(() => {}))
      );
    } catch (err) {
      console.error('Error deleting school confirmation from Firestore:', err);
    }

    // Record a sport-wide withdrawal entry so even if students were registered under this school,
    // the school is immediately withdrawn from the championship until explicitly re-confirmed
    if (discoveredSchoolName) {
      const resolvedDir = this.getActiveDirectorateId() || 'taourirt';
      const wId = `${sportId}_sport_all_all_all_${discoveredSchoolName.trim()}`;
      const wRecord: SchoolWithdrawalRecord = {
        id: wId,
        schoolName: discoveredSchoolName.trim(),
        schoolId: schoolId || undefined,
        sportId,
        withdrawnAt: new Date().toISOString(),
        directorateId: resolvedDir === 'all' ? 'taourirt' : resolvedDir
      };
      const curWithdrawals = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);
      setLocal(STORAGE_KEYS.WITHDRAWALS, deduplicateById([wRecord, ...curWithdrawals]));
      try {
        await setDoc(doc(db, 'school_withdrawals', wId), stripUndefinedDeep(wRecord), { merge: true });
      } catch {}
      window.dispatchEvent(new CustomEvent('schoolWithdrawalsUpdated', { detail: wRecord }));
    }

    window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated'));
  },

  async convertAllParticipationsToNonClubAndDeduplicate(options?: {
    targetDirectorateId?: string;
    onlyIfNotMigrated?: boolean;
  }): Promise<{
    alreadyMigrated?: boolean;
    convertedConfirmationsCount: number;
    deletedDuplicateConfirmationsCount: number;
    convertedStudentsCount: number;
    deletedDuplicateStudentsCount: number;
  }> {
    const emptyResult = {
      alreadyMigrated: false,
      convertedConfirmationsCount: 0,
      deletedDuplicateConfirmationsCount: 0,
      convertedStudentsCount: 0,
      deletedDuplicateStudentsCount: 0
    };

    const activeDirId = options?.targetDirectorateId || this.getActiveDirectorateId() || 'taourirt';
    const isAllDirs = !activeDirId || activeDirId === 'all';
    const dirKey = isAllDirs ? 'all' : activeDirId;
    const migrationKey = `migration_participations_non_club_v1_${dirKey}`;

    if (options?.onlyIfNotMigrated) {
      try {
        if (typeof window !== 'undefined' && window.localStorage.getItem(migrationKey) === '1') {
          return { ...emptyResult, alreadyMigrated: true };
        }
      } catch {
        // ignore storage errors
      }
      if (!isCloudSyncPaused()) {
        try {
          const flagSnap = await getDoc(doc(db, 'settings', migrationKey));
          if (flagSnap.exists() && flagSnap.data()?.completed === true) {
            try {
              window.localStorage.setItem(migrationKey, '1');
            } catch {
              // ignore
            }
            return { ...emptyResult, alreadyMigrated: true };
          }
        } catch {
          // Proceed carefully or abort if offline
        }
      }
    }

    if (isCloudSyncPaused()) {
      return emptyResult;
    }

    try {
      const [schoolsList, confSnap, studSnap, allTournaments] = await Promise.all([
        this.getSchools(isAllDirs ? 'all' : activeDirId, isAllDirs),
        getDocs(collection(db, 'school_confirmations')),
        getDocs(collection(db, 'students')),
        this.getTournaments()
      ]);

      const resolveCanonicalSchool = (schoolId?: string, schoolName?: string, dirId?: string) => {
        const cleanId = (schoolId || '').trim();
        const cleanName = (schoolName || '').trim();
        const dirScoped = schoolsList.filter(s => !dirId || (s.directorateId || 'taourirt') === dirId);
        const searchPool = dirScoped.length > 0 ? dirScoped : schoolsList;

        let matched = cleanId ? searchPool.find(s => s.id === cleanId) : undefined;
        if (!matched && cleanName) {
          matched = searchPool.find(s => schoolNamesMatch(s.name, cleanName));
        }
        if (!matched && cleanName) {
          matched = schoolsList.find(s => schoolNamesMatch(s.name, cleanName));
        }

        if (matched) {
          return {
            canonicalKey: `id:${matched.id}`,
            canonicalId: matched.id,
            canonicalName: matched.name
          };
        }

        const normName = normalizeArabicMatchText(cleanName);
        if (normName) {
          return {
            canonicalKey: `name:${normName}`,
            canonicalId: cleanId || cleanName,
            canonicalName: cleanName
          };
        }

        return {
          canonicalKey: `raw:${cleanId.toLowerCase()}`,
          canonicalId: cleanId,
          canonicalName: cleanName
        };
      };

      // ------------------------------------------------------------------
      // 1. CONVERT & DEDUPLICATE SCHOOL CONFIRMATIONS (Phase 1)
      // ------------------------------------------------------------------
      const cloudConfs: SchoolTournamentConfirmation[] = [];
      confSnap.forEach((docSnap: any) => {
        if (!isRecentlyDeleted('school_confirmations', docSnap.id)) {
          cloudConfs.push({ id: docSnap.id, ...docSnap.data() } as SchoolTournamentConfirmation);
        }
      });

      const localConfs = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
        c => c && !isRecentlyDeleted('school_confirmations', c.id)
      );
      const allConfs = deduplicateById([...cloudConfs, ...localConfs]);
      const cloudConfIdSet = new Set(cloudConfs.map(c => c.id));

      const confsInScope: SchoolTournamentConfirmation[] = [];
      const confsOutOfScope: SchoolTournamentConfirmation[] = [];
      allConfs.forEach(c => {
        const cDir = c.directorateId || 'taourirt';
        if (isAllDirs || cDir === activeDirId) {
          confsInScope.push(c);
        } else {
          confsOutOfScope.push(c);
        }
      });

      const confGroups = new Map<string, SchoolTournamentConfirmation[]>();
      const nonConfirmedInScope: SchoolTournamentConfirmation[] = [];

      confsInScope.forEach(conf => {
        if (conf.status !== 'confirmed') {
          nonConfirmedInScope.push(conf);
          return;
        }
        const cDir = conf.directorateId || 'taourirt';
        const resolved = resolveCanonicalSchool(conf.schoolId, conf.schoolName, cDir);
        const gKey = `${cDir}__${conf.sportId}__${resolved.canonicalKey}`;
        if (!confGroups.has(gKey)) {
          confGroups.set(gKey, []);
        }
        confGroups.get(gKey)!.push(conf);
      });

      const finalConfirmedConfs: SchoolTournamentConfirmation[] = [];
      const confsToSave: SchoolTournamentConfirmation[] = [];
      const confIdsToDelete = new Set<string>();
      let convertedConfirmationsCount = 0;

      for (const groupDocs of confGroups.values()) {
        const cDir = groupDocs[0].directorateId || 'taourirt';
        const sportId = groupDocs[0].sportId;
        const resolved = resolveCanonicalSchool(groupDocs[0].schoolId, groupDocs[0].schoolName, cDir);
        const preferredId = `${sportId}_${resolved.canonicalId}`;

        // Pick primary confirmation doc deterministically
        const sorted = [...groupDocs].sort((a, b) => {
          if (a.id === preferredId && b.id !== preferredId) return -1;
          if (b.id === preferredId && a.id !== preferredId) return 1;
          const aLen = getEffectiveConfirmedBranches(a, false).length;
          const bLen = getEffectiveConfirmedBranches(b, false).length;
          if (aLen !== bLen) return bLen - aLen;
          return (a.confirmedAt || '').localeCompare(b.confirmedAt || '');
        });

        const primary = sorted[0];
        const duplicates = sorted.slice(1);
        duplicates.forEach(d => {
          if (d.id) confIdsToDelete.add(d.id);
        });

        // Merge all branches across duplicates and convert ALL to 'non_club', keeping strictly 1 per (category, gender)
        const branchMap = new Map<string, ConfirmedBranchTuple>();
        let hadNonNonClubOrDuplicateBranch = duplicates.length > 0;

        sorted.forEach(docItem => {
          const rawBranches = getEffectiveConfirmedBranches(docItem, false);
          rawBranches.forEach(b => {
            const normCat = normalizeCategoryKey(b.category);
            const normGen: 'Male' | 'Female' = b.gender === 'Female' ? 'Female' : 'Male';
            if ((b.affiliationType || 'non_club') !== 'non_club') {
              hadNonNonClubOrDuplicateBranch = true;
            }
            const bKey = `non_club__${normCat}__${normGen}`;
            if (branchMap.has(bKey)) {
              hadNonNonClubOrDuplicateBranch = true;
            } else {
              branchMap.set(bKey, {
                category: normCat,
                gender: normGen,
                affiliationType: 'non_club'
              });
            }
          });
        });

        // Also check legacy fields on primary
        if (
          (Array.isArray(primary.affiliationTypes) && primary.affiliationTypes.some(a => a !== 'non_club')) ||
          ((primary as any).affiliationType && (primary as any).affiliationType !== 'non_club')
        ) {
          hadNonNonClubOrDuplicateBranch = true;
        }

        const dedupedBranches = Array.from(branchMap.values());
        if (dedupedBranches.length === 0) {
          // Empty confirmation after merge -> remove cleanly
          if (primary.id) confIdsToDelete.add(primary.id);
          continue;
        }

        const mergedTeacherId = primary.teacherId || sorted.find(x => x.teacherId)?.teacherId || '';
        const mergedTeacherName = primary.teacherName || sorted.find(x => x.teacherName)?.teacherName || '';
        const mergedTeacherPhone = primary.teacherPhone || sorted.find(x => x.teacherPhone)?.teacherPhone;
        const mergedTeacherLease = primary.teacherLeaseNumber || sorted.find(x => x.teacherLeaseNumber)?.teacherLeaseNumber;
        const mergedNotes = sorted
          .map(x => (x.notes || '').trim())
          .filter(Boolean)
          .filter((v, i, arr) => arr.indexOf(v) === i)
          .join(' | ');

        const updatedConf: SchoolTournamentConfirmation = {
          ...primary,
          schoolId: resolved.canonicalId || primary.schoolId,
          schoolName: resolved.canonicalName || primary.schoolName,
          teacherId: mergedTeacherId,
          teacherName: mergedTeacherName,
          ...(mergedTeacherPhone ? { teacherPhone: mergedTeacherPhone } : {}),
          ...(mergedTeacherLease ? { teacherLeaseNumber: mergedTeacherLease } : {}),
          ...(mergedNotes ? { notes: mergedNotes } : {}),
          directorateId: cDir,
          categories: Array.from(new Set(dedupedBranches.map(b => b.category))),
          genders: Array.from(new Set(dedupedBranches.map(b => b.gender))),
          affiliationTypes: ['non_club'],
          selectedBranches: dedupedBranches,
          status: 'confirmed'
        };
        if ('affiliationType' in updatedConf) {
          delete (updatedConf as any).affiliationType;
        }

        finalConfirmedConfs.push(updatedConf);
        if (
          hadNonNonClubOrDuplicateBranch ||
          primary.schoolName !== updatedConf.schoolName ||
          primary.schoolId !== updatedConf.schoolId
        ) {
          confsToSave.push(updatedConf);
          convertedConfirmationsCount++;
        }
      }

      // ------------------------------------------------------------------
      // 2. CONVERT & DEDUPLICATE REGISTERED STUDENTS (Phase 2)
      // ------------------------------------------------------------------
      const cloudStudents: Student[] = [];
      studSnap.forEach((docSnap: any) => {
        if (!isRecentlyDeleted('students', docSnap.id)) {
          cloudStudents.push({ id: docSnap.id, ...docSnap.data(), directorateId: docSnap.data().directorateId || 'taourirt' } as Student);
        }
      });

      const localStudents = getLocal<Student>('taourirt_students_data', []).filter(
        s => s && !isRecentlyDeleted('students', s.id)
      );
      const allStudents = deduplicateById([...cloudStudents, ...localStudents]);
      const cloudStudentIdSet = new Set(cloudStudents.map(s => s.id));

      const clubTournamentIds = new Set(
        allTournaments
          .filter(t => t.affiliationType && t.affiliationType !== 'non_club')
          .map(t => t.id)
      );

      const nonClubTournByKey = new Map<string, Tournament>();
      allTournaments.forEach(t => {
        if ((t.affiliationType || 'non_club') !== 'non_club') return;
        const tDir = t.directorateId || 'taourirt';
        const tCat = normalizeCategoryKey(t.ageCategory);
        const key = `${tDir}__${t.sportId}__${tCat}__${t.gender}`;
        if (!nonClubTournByKey.has(key)) {
          nonClubTournByKey.set(key, t);
        }
      });

      const studentsInScope: Student[] = [];
      const studentsOutOfScope: Student[] = [];
      allStudents.forEach(st => {
        const stDir = st.directorateId || 'taourirt';
        if (isAllDirs || stDir === activeDirId) {
          studentsInScope.push(st);
        } else {
          studentsOutOfScope.push(st);
        }
      });

      const studentDedupGroups = new Map<string, Student[]>();
      studentsInScope.forEach(st => {
        const stDir = st.directorateId || 'taourirt';
        const normCat = normalizeCategoryKey(st.category || 'U15');
        const normGen: 'Male' | 'Female' = st.gender === 'Female' ? 'Female' : 'Male';
        const resolved = resolveCanonicalSchool(st.schoolId, st.schoolName, stDir);
        const cleanMassar = (st.massarNumber || '').trim().toUpperCase();
        const studentIdentity = cleanMassar.length >= 4
          ? `massar:${cleanMassar}`
          : `name:${normalizeArabicMatchText(st.fullName)}|${(st.birthDate || '').trim()}`;
        const key = `${stDir}__${st.sportId}__${resolved.canonicalKey}__${normCat}__${normGen}__${studentIdentity}`;
        if (!studentDedupGroups.has(key)) {
          studentDedupGroups.set(key, []);
        }
        studentDedupGroups.get(key)!.push(st);
      });

      const finalStudentsInScope: Student[] = [];
      const studentsToSave: Student[] = [];
      const studentIdsToDelete = new Set<string>();
      let convertedStudentsCount = 0;

      for (const group of studentDedupGroups.values()) {
        // Prefer existing non_club record with photo/massar/bib, else richest record
        const sorted = [...group].sort((a, b) => {
          const aScore =
            ((a.affiliationType || 'non_club') === 'non_club' ? 10 : 0) +
            (a.photoUrl ? 4 : 0) +
            (a.massarNumber ? 2 : 0) +
            (a.bibNumber ? 1 : 0);
          const bScore =
            ((b.affiliationType || 'non_club') === 'non_club' ? 10 : 0) +
            (b.photoUrl ? 4 : 0) +
            (b.massarNumber ? 2 : 0) +
            (b.bibNumber ? 1 : 0);
          return bScore - aScore;
        });

        const keeper = sorted[0];
        sorted.slice(1).forEach(dup => {
          if (dup.id) studentIdsToDelete.add(dup.id);
        });

        const stDir = keeper.directorateId || 'taourirt';
        const normCat = normalizeCategoryKey(keeper.category || 'U15');
        const normGen: 'Male' | 'Female' = keeper.gender === 'Female' ? 'Female' : 'Male';
        const resolved = resolveCanonicalSchool(keeper.schoolId, keeper.schoolName, stDir);

        let nextTournamentId = keeper.tournamentId;
        let nextTournamentName = keeper.tournamentName;
        const needsAffiliationFix = (keeper.affiliationType || 'non_club') !== 'non_club';
        const hasClubTournRef = !!(keeper.tournamentId && clubTournamentIds.has(keeper.tournamentId));

        if (needsAffiliationFix || hasClubTournRef) {
          const matchingNonClubTourn =
            nonClubTournByKey.get(`${stDir}__${keeper.sportId}__${normCat}__${normGen}`) ||
            nonClubTournByKey.get(`${stDir}__${keeper.sportId}__${normCat}__Mixed`) ||
            nonClubTournByKey.get(`${stDir}__${keeper.sportId}__${normCat}__Both`);
          if (matchingNonClubTourn) {
            nextTournamentId = matchingNonClubTourn.id;
            nextTournamentName = matchingNonClubTourn.name;
          } else if (hasClubTournRef) {
            nextTournamentId = '';
            nextTournamentName = '';
          }
        }

        const updatedStudent: Student = {
          ...keeper,
          schoolId: resolved.canonicalId || keeper.schoolId,
          schoolName: resolved.canonicalName || keeper.schoolName,
          category: normCat,
          gender: normGen,
          affiliationType: 'non_club',
          ...(nextTournamentId !== undefined ? { tournamentId: nextTournamentId } : {}),
          ...(nextTournamentName !== undefined ? { tournamentName: nextTournamentName } : {})
        };

        finalStudentsInScope.push(updatedStudent);

        if (
          needsAffiliationFix ||
          hasClubTournRef ||
          sorted.length > 1 ||
          keeper.schoolName !== updatedStudent.schoolName
        ) {
          studentsToSave.push(updatedStudent);
          if (needsAffiliationFix || hasClubTournRef) {
            convertedStudentsCount++;
          }
        }
      }

      // ------------------------------------------------------------------
      // 3. CLEAR CONFLICTING WITHDRAWALS FOR CONVERTED NON_CLUB BRANCHES
      // ------------------------------------------------------------------
      const currentWithdrawals = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);
      const withdrawalIdsToDelete = new Set<string>();
      const remainingWithdrawals = currentWithdrawals.filter(w => {
        if (!w || (w.affiliationType && w.affiliationType !== 'non_club')) return true;
        const wDir = w.directorateId || 'taourirt';
        if (!isAllDirs && wDir !== activeDirId) return true;
        const conflictsWithConfirmed = finalConfirmedConfs.some(conf => {
          if (conf.sportId !== w.sportId) return false;
          const schoolMatch =
            (w.schoolId && conf.schoolId && w.schoolId === conf.schoolId) ||
            (w.schoolName && conf.schoolName && schoolNamesMatch(w.schoolName, conf.schoolName));
          if (!schoolMatch) return false;
          return getEffectiveConfirmedBranches(conf, false).some(b => {
            const catMatch = !w.ageCategory || normalizeCategoryKey(w.ageCategory) === normalizeCategoryKey(b.category);
            const genMatch = !w.gender || w.gender === 'ALL' || w.gender === 'Both' || w.gender.toLowerCase() === b.gender.toLowerCase();
            return catMatch && genMatch;
          });
        });
        if (conflictsWithConfirmed && w.id) {
          withdrawalIdsToDelete.add(w.id);
          return false;
        }
        return true;
      });
      if (withdrawalIdsToDelete.size > 0) {
        setLocal(STORAGE_KEYS.WITHDRAWALS, remainingWithdrawals);
      }

      // ------------------------------------------------------------------
      // 4. COMMIT ALL UPDATES & DELETIONS IN FIRESTORE BATCHES
      // ------------------------------------------------------------------
      confIdsToDelete.forEach(id => markRecentlyDeleted('school_confirmations', id));
      studentIdsToDelete.forEach(id => markRecentlyDeleted('students', id));

      const batchOps: Array<() => { apply: (b: ReturnType<typeof writeBatch>) => void }> = [];

      confsToSave.forEach(conf => {
        const payload = stripUndefinedDeep({
          ...conf,
          updatedAt: serverTimestamp()
        });
        batchOps.push(() => ({
          apply: b => b.set(doc(db, 'school_confirmations', conf.id), payload, { merge: false })
        }));
      });

      confIdsToDelete.forEach(id => {
        if (cloudConfIdSet.has(id)) {
          batchOps.push(() => ({
            apply: b => b.delete(doc(db, 'school_confirmations', id))
          }));
        }
      });

      studentsToSave.forEach(stud => {
        const payload = stripUndefinedDeep({
          ...stud,
          updatedAt: serverTimestamp()
        });
        batchOps.push(() => ({
          apply: b => b.set(doc(db, 'students', stud.id), payload, { merge: true })
        }));
      });

      studentIdsToDelete.forEach(id => {
        if (cloudStudentIdSet.has(id)) {
          batchOps.push(() => ({
            apply: b => b.delete(doc(db, 'students', id))
          }));
        }
      });

      withdrawalIdsToDelete.forEach(id => {
        batchOps.push(() => ({
          apply: b => b.delete(doc(db, 'school_withdrawals', id))
        }));
      });

      for (let i = 0; i < batchOps.length; i += 400) {
        const chunk = batchOps.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(op => op().apply(batch));
        await batch.commit();
      }

      // Persist cleaned caches locally
      const mergedFinalConfs = deduplicateById([
        ...finalConfirmedConfs,
        ...nonConfirmedInScope.filter(c => !confIdsToDelete.has(c.id)),
        ...confsOutOfScope
      ]);
      setLocal(STORAGE_KEYS.CONFIRMATIONS, mergedFinalConfs);

      const mergedFinalStudents = deduplicateById([
        ...finalStudentsInScope,
        ...studentsOutOfScope
      ]);
      setLocal('taourirt_students_data', mergedFinalStudents);

      // Mark migration flag in Firestore & localStorage
      const statsPayload = {
        completed: true,
        directorateId: dirKey,
        convertedConfirmationsCount,
        deletedDuplicateConfirmationsCount: confIdsToDelete.size,
        convertedStudentsCount,
        deletedDuplicateStudentsCount: studentIdsToDelete.size,
        completedAt: serverTimestamp()
      };
      await setDoc(doc(db, 'settings', migrationKey), statsPayload, { merge: true }).catch(() => {});
      try {
        window.localStorage.setItem(migrationKey, '1');
      } catch {
        // ignore
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated'));
        window.dispatchEvent(new CustomEvent('studentsUpdated'));
        if (withdrawalIdsToDelete.size > 0) {
          window.dispatchEvent(new CustomEvent('schoolWithdrawalsUpdated'));
        }
      }

      return {
        alreadyMigrated: false,
        convertedConfirmationsCount,
        deletedDuplicateConfirmationsCount: confIdsToDelete.size,
        convertedStudentsCount,
        deletedDuplicateStudentsCount: studentIdsToDelete.size
      };
    } catch (err) {
      console.error('Error converting participations to non_club:', err);
      return emptyResult;
    }
  },

  async pruneOrphanedParticipationsForDeletedSchools(options?: {
    targetDirectorateId?: string;
    deletedSchoolIds?: string[];
    deletedSchoolNames?: string[];
    allowEmptySchools?: boolean;
    onlyIfNotCleaned?: boolean;
  }): Promise<{
    alreadyCleaned?: boolean;
    deletedConfirmationsCount: number;
    deletedStudentsCount: number;
    deletedWithdrawalsCount: number;
  }> {
    const emptyResult = {
      alreadyCleaned: false,
      deletedConfirmationsCount: 0,
      deletedStudentsCount: 0,
      deletedWithdrawalsCount: 0
    };

    const activeDirId = options?.targetDirectorateId || this.getActiveDirectorateId() || 'taourirt';
    const isAllDirs = !activeDirId || activeDirId === 'all';
    const dirKey = isAllDirs ? 'all' : activeDirId;
    const cleanupKey = `cleanup_orphaned_participations_v1_${dirKey}`;

    if (options?.onlyIfNotCleaned) {
      try {
        if (typeof window !== 'undefined' && window.localStorage.getItem(cleanupKey) === '1') {
          return { ...emptyResult, alreadyCleaned: true };
        }
      } catch {
        // ignore storage error
      }
      if (!isCloudSyncPaused()) {
        try {
          const flagSnap = await getDoc(doc(db, 'settings', cleanupKey));
          if (flagSnap.exists() && flagSnap.data()?.completed === true) {
            try {
              window.localStorage.setItem(cleanupKey, '1');
            } catch {
              // ignore
            }
            return { ...emptyResult, alreadyCleaned: true };
          }
        } catch {
          // continue cleanly
        }
      }
    }

    if (isCloudSyncPaused()) {
      return emptyResult;
    }

    try {
      const [registeredSchools, confSnap, studSnap] = await Promise.all([
        this.getSchools(isAllDirs ? 'all' : activeDirId, isAllDirs),
        getDocs(collection(db, 'school_confirmations')),
        getDocs(collection(db, 'students'))
      ]);

      // Safety guard: never wipe participations if no registered schools were returned unless explicitly allowed
      if (registeredSchools.length === 0 && !options?.allowEmptySchools) {
        return emptyResult;
      }

      const explicitDeletedIdSet = new Set((options?.deletedSchoolIds || []).map(x => x.trim()).filter(Boolean));
      const explicitDeletedNames = (options?.deletedSchoolNames || [])
        .map(n => normalizeArabicMatchText(n))
        .filter(Boolean);

      const doesRecordMatchSchool = (rawSchoolId: string | undefined, rawSchoolName: string | undefined, school: School): boolean => {
        const cleanId = (rawSchoolId || '').trim();
        if (cleanId && school.id === cleanId) return true;
        const cleanA = normalizeArabicMatchText(rawSchoolName);
        const cleanB = normalizeArabicMatchText(school.name);
        if (!cleanA || !cleanB) return false;
        if (cleanA === cleanB) return true;

        const aMiddle = cleanA.includes('اعداد');
        const aHigh = cleanA.includes('تاهيل') || (cleanA.includes('ثانويه') && !aMiddle);
        const aPrimary = cleanA.includes('ابتدائ') || cleanA.includes('مدرسه') || cleanA.includes('مجموعه') || cleanA.startsWith('م.م');
        const sCycle = normalizeSchoolCycleType(school);
        if (aMiddle && sCycle !== 'إعدادي' && sCycle !== 'خصوصي') return false;
        if (aHigh && sCycle !== 'تأهيلي' && sCycle !== 'خصوصي') return false;
        if (aPrimary && sCycle !== 'ابتدائي' && sCycle !== 'خصوصي') return false;

        return cleanA.length >= 4 && cleanB.length >= 4 && (cleanA.includes(cleanB) || cleanB.includes(cleanA));
      };

      const isSchoolActiveInDirectory = (rawSchoolId?: string, rawSchoolName?: string, recDirId?: string): boolean => {
        const cleanId = (rawSchoolId || '').trim();
        const cleanNormName = normalizeArabicMatchText(rawSchoolName);
        if (cleanId && explicitDeletedIdSet.has(cleanId)) return false;
        if (cleanNormName && explicitDeletedNames.some(dn => dn === cleanNormName)) return false;

        const targetDir = recDirId || 'taourirt';
        const dirSchools = isAllDirs
          ? registeredSchools
          : registeredSchools.filter(s => (s.directorateId || 'taourirt') === targetDir);

        return dirSchools.some(s => doesRecordMatchSchool(rawSchoolId, rawSchoolName, s));
      };

      // 1. Identify orphaned school_confirmations
      const cloudConfs: SchoolTournamentConfirmation[] = [];
      confSnap.forEach((docSnap: any) => {
        if (!isRecentlyDeleted('school_confirmations', docSnap.id)) {
          cloudConfs.push({ id: docSnap.id, ...docSnap.data() } as SchoolTournamentConfirmation);
        }
      });
      const localConfs = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
        c => c && !isRecentlyDeleted('school_confirmations', c.id)
      );
      const allConfs = deduplicateById([...cloudConfs, ...localConfs]);
      const cloudConfIdSet = new Set(cloudConfs.map(c => c.id));

      const confIdsToDelete = new Set<string>();
      const survivingConfs: SchoolTournamentConfirmation[] = [];
      allConfs.forEach(c => {
        const cDir = c.directorateId || 'taourirt';
        if (!isAllDirs && cDir !== activeDirId) {
          survivingConfs.push(c);
          return;
        }
        if (isSchoolActiveInDirectory(c.schoolId, c.schoolName, cDir)) {
          survivingConfs.push(c);
        } else if (c.id) {
          confIdsToDelete.add(c.id);
        }
      });

      // 2. Identify orphaned students
      const cloudStudents: Student[] = [];
      studSnap.forEach((docSnap: any) => {
        if (!isRecentlyDeleted('students', docSnap.id)) {
          cloudStudents.push({ id: docSnap.id, ...docSnap.data(), directorateId: docSnap.data().directorateId || 'taourirt' } as Student);
        }
      });
      const localStudents = getLocal<Student>('taourirt_students_data', []).filter(
        s => s && !isRecentlyDeleted('students', s.id)
      );
      const allStudents = deduplicateById([...cloudStudents, ...localStudents]);
      const cloudStudentIdSet = new Set(cloudStudents.map(s => s.id));

      const studentIdsToDelete = new Set<string>();
      const survivingStudents: Student[] = [];
      allStudents.forEach(st => {
        const stDir = st.directorateId || 'taourirt';
        if (!isAllDirs && stDir !== activeDirId) {
          survivingStudents.push(st);
          return;
        }
        if (isSchoolActiveInDirectory(st.schoolId, st.schoolName, stDir)) {
          survivingStudents.push(st);
        } else if (st.id) {
          studentIdsToDelete.add(st.id);
        }
      });

      // 3. Identify orphaned withdrawals
      const localWithdrawals = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);
      const withdrawalIdsToDelete = new Set<string>();
      const survivingWithdrawals: SchoolWithdrawalRecord[] = [];
      localWithdrawals.forEach(w => {
        if (!w) return;
        const wDir = w.directorateId || 'taourirt';
        if (!isAllDirs && wDir !== activeDirId) {
          survivingWithdrawals.push(w);
          return;
        }
        if (isSchoolActiveInDirectory(w.schoolId, w.schoolName, wDir)) {
          survivingWithdrawals.push(w);
        } else if (w.id) {
          withdrawalIdsToDelete.add(w.id);
        }
      });

      // Mark recently deleted locally so snapshots don't resurrect orphaned docs
      confIdsToDelete.forEach(id => markRecentlyDeleted('school_confirmations', id));
      studentIdsToDelete.forEach(id => markRecentlyDeleted('students', id));

      // Commit Firestore deletions in batches of 400
      const deleteRefs: any[] = [];
      confIdsToDelete.forEach(id => {
        if (cloudConfIdSet.has(id)) deleteRefs.push(doc(db, 'school_confirmations', id));
      });
      studentIdsToDelete.forEach(id => {
        if (cloudStudentIdSet.has(id)) deleteRefs.push(doc(db, 'students', id));
      });
      withdrawalIdsToDelete.forEach(id => {
        deleteRefs.push(doc(db, 'school_withdrawals', id));
      });

      for (let i = 0; i < deleteRefs.length; i += 400) {
        const chunk = deleteRefs.slice(i, i + 400);
        const batch = writeBatch(db);
        chunk.forEach(ref => batch.delete(ref));
        await batch.commit();
      }

      // Persist surviving caches locally
      if (confIdsToDelete.size > 0) {
        setLocal(STORAGE_KEYS.CONFIRMATIONS, survivingConfs);
      }
      if (studentIdsToDelete.size > 0) {
        setLocal('taourirt_students_data', survivingStudents);
      }
      if (withdrawalIdsToDelete.size > 0) {
        setLocal(STORAGE_KEYS.WITHDRAWALS, survivingWithdrawals);
      }

      // Record cleanup flag if running auto-cleanup
      if (options?.onlyIfNotCleaned) {
        await setDoc(
          doc(db, 'settings', cleanupKey),
          {
            completed: true,
            directorateId: dirKey,
            deletedConfirmationsCount: confIdsToDelete.size,
            deletedStudentsCount: studentIdsToDelete.size,
            deletedWithdrawalsCount: withdrawalIdsToDelete.size,
            completedAt: serverTimestamp()
          },
          { merge: true }
        ).catch(() => {});
        try {
          window.localStorage.setItem(cleanupKey, '1');
        } catch {
          // ignore
        }
      }

      if (typeof window !== 'undefined') {
        if (confIdsToDelete.size > 0) window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated'));
        if (studentIdsToDelete.size > 0) window.dispatchEvent(new CustomEvent('studentsUpdated'));
        if (withdrawalIdsToDelete.size > 0) window.dispatchEvent(new CustomEvent('schoolWithdrawalsUpdated'));
      }

      return {
        alreadyCleaned: false,
        deletedConfirmationsCount: confIdsToDelete.size,
        deletedStudentsCount: studentIdsToDelete.size,
        deletedWithdrawalsCount: withdrawalIdsToDelete.size
      };
    } catch (err) {
      console.error('Error pruning orphaned participations for deleted schools:', err);
      return emptyResult;
    }
  },

  subscribeToSchoolConfirmations(callback: (confirmations: SchoolTournamentConfirmation[]) => void): () => void {
    const emitCurrent = () => {
      const activeDirId = this.getActiveDirectorateId() || 'taourirt';
      const list = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
        c => c && !isRecentlyDeleted('school_confirmations', c.id)
      );
      if (activeDirId === 'all') {
        callback(list);
      } else {
        callback(list.filter(c => !activeDirId || !c.directorateId || c.directorateId === activeDirId));
      }
    };

    emitCurrent();

    const handleCustomEvent = () => {
      emitCurrent();
    };
    window.addEventListener('schoolConfirmationsUpdated', handleCustomEvent);
    window.addEventListener('directorateChanged', handleCustomEvent);

    try {
      const q = query(collection(db, 'school_confirmations'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const activeDirId = this.getActiveDirectorateId() || 'taourirt';
        const list: SchoolTournamentConfirmation[] = [];
        snapshot.forEach(docSnap => {
          if (!isRecentlyDeleted('school_confirmations', docSnap.id)) {
            list.push({ id: docSnap.id, ...docSnap.data() } as SchoolTournamentConfirmation);
          }
        });
        const pendingLocal = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []).filter(
          c => c && !isRecentlyDeleted('school_confirmations', c.id) && isPendingWrite('school_confirmations', c.id)
        );
        const clean = deduplicateById([...pendingLocal, ...list]);
        setLocal(STORAGE_KEYS.CONFIRMATIONS, clean);
        if (activeDirId === 'all') {
          callback(clean);
        } else {
          callback(clean.filter(c => !activeDirId || !c.directorateId || c.directorateId === activeDirId));
        }
      }, (err) => {
        console.warn('school_confirmations onSnapshot error, keeping local:', err);
      });

      return () => {
        unsubscribe();
        window.removeEventListener('schoolConfirmationsUpdated', handleCustomEvent);
        window.removeEventListener('directorateChanged', handleCustomEvent);
      };
    } catch (err) {
      return () => {
        window.removeEventListener('schoolConfirmationsUpdated', handleCustomEvent);
        window.removeEventListener('directorateChanged', handleCustomEvent);
      };
    }
  },

  async withdrawSchool(data: {
    sportId: string;
    schoolName: string;
    schoolId?: string;
    tournamentId?: string;
    ageCategory?: string;
    gender?: string;
    affiliationType?: string;
    withdrawnBy?: string;
  }): Promise<void> {
    const normCat = data.ageCategory ? normalizeCategoryKey(data.ageCategory) : undefined;
    const cleanSchool = data.schoolName.trim();
    const id = `${data.sportId}_${data.tournamentId || 'branch'}_${normCat || 'all'}_${data.gender || 'all'}_${data.affiliationType || 'all'}_${cleanSchool}`;
    const resolvedDir = this.getActiveDirectorateId() || 'taourirt';
    
    const record: SchoolWithdrawalRecord = {
      id,
      schoolName: cleanSchool,
      schoolId: data.schoolId,
      sportId: data.sportId,
      tournamentId: data.tournamentId,
      ageCategory: normCat,
      gender: data.gender,
      affiliationType: data.affiliationType,
      withdrawnAt: new Date().toISOString(),
      withdrawnBy: data.withdrawnBy,
      directorateId: resolvedDir === 'all' ? 'taourirt' : resolvedDir
    };

    const current = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);
    const updated = deduplicateById([record, ...current]);
    setLocal(STORAGE_KEYS.WITHDRAWALS, updated);

    try {
      await setDoc(doc(db, 'school_withdrawals', id), stripUndefinedDeep(record), { merge: true });
    } catch (err) {
      console.warn('Error saving withdrawal to Firestore:', err);
    }

    try {
      const confirmations = getLocal<SchoolTournamentConfirmation>(STORAGE_KEYS.CONFIRMATIONS, []);
      const matchedConf = confirmations.find(c => 
        c.sportId === data.sportId && (
          (data.schoolId && c.schoolId === data.schoolId) ||
          c.schoolName.trim().toLowerCase() === cleanSchool.toLowerCase() ||
          c.schoolName.includes(cleanSchool) ||
          cleanSchool.includes(c.schoolName)
        )
      );
      if (matchedConf) {
        if (matchedConf.tournamentId && data.tournamentId && matchedConf.tournamentId === data.tournamentId && (!matchedConf.selectedBranches || matchedConf.selectedBranches.length <= 1)) {
          await this.cancelSchoolConfirmation(data.sportId, matchedConf.schoolId || matchedConf.schoolName, matchedConf.schoolName);
        } else {
          const currentBranches = getEffectiveConfirmedBranches(matchedConf, false);
          const remainingBranches = currentBranches.filter(b => {
            const catMatches = !normCat || normalizeCategoryKey(b.category) === normCat;
            const genMatches = !data.gender || data.gender === 'Both' || data.gender === 'Mixed' || data.gender === 'ALL' || b.gender.toLowerCase() === data.gender.toLowerCase();
            const affMatches = !data.affiliationType || data.affiliationType === 'ALL' || b.affiliationType === data.affiliationType;
            return !(catMatches && genMatches && affMatches);
          });

          if (remainingBranches.length === 0) {
            await this.cancelSchoolConfirmation(data.sportId, matchedConf.schoolId || matchedConf.schoolName, matchedConf.schoolName);
          } else {
            const updatedConf: SchoolTournamentConfirmation = {
              ...matchedConf,
              selectedBranches: remainingBranches,
              categories: Array.from(new Set(remainingBranches.map(b => b.category))),
              genders: Array.from(new Set(remainingBranches.map(b => b.gender))),
              affiliationTypes: Array.from(new Set(remainingBranches.map(b => b.affiliationType)))
            };
            const updatedConfs = confirmations.map(c => c.id === matchedConf.id ? updatedConf : c);
            setLocal(STORAGE_KEYS.CONFIRMATIONS, updatedConfs);
            try {
              await setDoc(doc(db, 'school_confirmations', matchedConf.id), stripUndefinedDeep(updatedConf), { merge: false });
            } catch (e) {
              console.warn(e);
            }
            window.dispatchEvent(new CustomEvent('schoolConfirmationsUpdated', { detail: updatedConf }));
          }
        }
      }
    } catch (err) {
      console.warn('Error updating confirmation on withdrawal:', err);
    }

    window.dispatchEvent(new CustomEvent('schoolWithdrawalsUpdated', { detail: record }));
  },

  isSchoolWithdrawn(params: {
    sportId?: string;
    tournamentId?: string;
    ageCategory?: string;
    gender?: string;
    affiliationType?: string;
  }, schoolId?: string, schoolName?: string): boolean {
    if (!schoolName && !schoolId) return false;
    const cleanName = (schoolName || '').trim();
    const cleanId = (schoolId || '').trim().toLowerCase();
    const withdrawals = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);

    const normCat = params.ageCategory && params.ageCategory !== 'ALL' ? normalizeCategoryKey(params.ageCategory) : undefined;
    const targetGen = params.gender && params.gender !== 'ALL' && params.gender !== 'Both' && params.gender !== 'Mixed' ? params.gender : undefined;
    const targetAff = params.affiliationType && params.affiliationType !== 'ALL' ? params.affiliationType : undefined;
    const targetTournId = params.tournamentId;
    const targetSport = params.sportId;

    return withdrawals.some(w => {
      if (!w) return false;
      const wName = (w.schoolName || '').trim();
      const wId = (w.schoolId || '').trim().toLowerCase();
      const matchSchool =
        (cleanId && wId && wId === cleanId) ||
        (cleanName && wName && schoolNamesMatch(wName, cleanName)) ||
        (cleanId && wName && wName.toLowerCase() === cleanId);
      if (!matchSchool) return false;

      if (targetTournId && w.tournamentId && w.tournamentId === targetTournId) return true;
      if (targetSport && w.sportId && w.sportId !== targetSport) return false;
      if (normCat && w.ageCategory && normalizeCategoryKey(w.ageCategory) !== normCat) return false;
      if (targetGen && w.gender && w.gender !== 'Both' && w.gender !== 'Mixed' && w.gender !== 'ALL' && w.gender.toLowerCase() !== targetGen.toLowerCase()) return false;
      if (targetAff && w.affiliationType && w.affiliationType !== 'ALL' && w.affiliationType !== targetAff) return false;

      return true;
    });
  },

  async cancelSchoolWithdrawal(
    sportId: string,
    schoolNameOrId: string,
    tournamentId?: string,
    branch?: { ageCategory?: string; gender?: string; affiliationType?: string }
  ): Promise<void> {
    const clean = (schoolNameOrId || '').trim();
    const cleanLower = clean.toLowerCase();
    const current = getLocal<SchoolWithdrawalRecord>(STORAGE_KEYS.WITHDRAWALS, []);
    const removedIds: string[] = [];

    const normBranchCat = branch?.ageCategory ? normalizeCategoryKey(branch.ageCategory) : undefined;
    const branchGen = branch?.gender;
    const branchAff = branch?.affiliationType;

    const doesWithdrawalMatchTarget = (w: SchoolWithdrawalRecord): boolean => {
      const matchSchool =
        (w.schoolId && w.schoolId.toLowerCase() === cleanLower) ||
        (w.schoolName && (w.schoolName.toLowerCase() === cleanLower || schoolNamesMatch(w.schoolName, clean)));
      if (!matchSchool) return false;
      if (w.sportId !== sportId) return false;
      if (tournamentId && w.tournamentId && w.tournamentId !== tournamentId) return false;

      if (branch) {
        const isSportWide = !w.ageCategory && !w.gender && !w.affiliationType && !w.tournamentId;
        if (isSportWide) return true;
        const catMatches = !w.ageCategory || !normBranchCat || normalizeCategoryKey(w.ageCategory) === normBranchCat;
        const genMatches = !w.gender || !branchGen || w.gender === 'Both' || w.gender === 'Mixed' || w.gender.toLowerCase() === branchGen.toLowerCase();
        const affMatches = !w.affiliationType || !branchAff || w.affiliationType === branchAff;
        return catMatches && genMatches && affMatches;
      }
      return true;
    };

    const updated = current.filter(w => {
      if (doesWithdrawalMatchTarget(w)) {
        if (w.id) removedIds.push(w.id);
        return false;
      }
      return true;
    });
    setLocal(STORAGE_KEYS.WITHDRAWALS, updated);
    if (removedIds.length > 0) {
      await Promise.all(removedIds.map(id => deleteDoc(doc(db, 'school_withdrawals', id)).catch(() => {})));
    }
    window.dispatchEvent(new CustomEvent('schoolWithdrawalsUpdated'));
  },

  // ============================================================================
  // INTERNAL COMMUNICATION SYSTEM ("تواصل": البريد الوارد والمرسل)
  // ============================================================================
  async getInternalMessages(): Promise<InternalMessage[]> {
    const localList = getLocal<InternalMessage>('taourirt_internal_messages', []);
    if (this.isCloudSyncPaused()) {
      return localList;
    }
    try {
      const snap = await fbGetDocs(collection(db, 'announcements'));
      const cloudMsgs: InternalMessage[] = [];
      snap.forEach(d => {
        const data = d.data() as any;
        if (data && data.recordKind === 'internal_message') {
          let createdIso = new Date().toISOString();
          if (typeof data.createdAt === 'string') {
            createdIso = data.createdAt;
          } else if (data.createdAt?.toDate) {
            createdIso = data.createdAt.toDate().toISOString();
          } else if (data.createdAt?.seconds) {
            createdIso = new Date(data.createdAt.seconds * 1000).toISOString();
          }
          cloudMsgs.push({
            id: d.id,
            senderId: data.senderId || '',
            senderName: data.senderName || 'مستخدم',
            senderRoleLabel: data.senderRoleLabel || '',
            senderEmail: data.senderEmail || '',
            recipientId: data.recipientId || '',
            recipientName: data.recipientName || '',
            recipientCategory: (data.recipientCategory || 'TEACHER') as CommunicationRecipientCategory,
            recipientRoleLabel: data.recipientRoleLabel || '',
            subject: data.subject || 'رسالة جديدة',
            content: data.content || '',
            createdAt: createdIso,
            readBy: Array.isArray(data.readBy) ? data.readBy : [],
            deletedBy: Array.isArray(data.deletedBy) ? data.deletedBy : [],
            directorateId: data.directorateId
          });
        }
      });
      if (cloudMsgs.length > 0) {
        const map = new Map<string, InternalMessage>();
        [...localList, ...cloudMsgs].forEach(m => map.set(m.id, m));
        const merged = Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setLocal('taourirt_internal_messages', merged);
        return merged;
      }
    } catch (e) {
      console.warn('Firestore getInternalMessages fallback to local:', e);
    }
    return localList.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  subscribeToInternalMessages(callback: (msgs: InternalMessage[]) => void): () => void {
    const localInitial = getLocal<InternalMessage>('taourirt_internal_messages', []);
    callback(localInitial.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));

    const handleLocalUpdate = () => {
      const updated = getLocal<InternalMessage>('taourirt_internal_messages', []);
      callback(updated.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    };
    window.addEventListener('internalMessagesUpdated', handleLocalUpdate);

    if (this.isCloudSyncPaused()) {
      return () => {
        window.removeEventListener('internalMessagesUpdated', handleLocalUpdate);
      };
    }

    const unsub = fbOnSnapshot(
      collection(db, 'announcements'),
      (snap) => {
        const cloudMsgs: InternalMessage[] = [];
        snap.forEach(d => {
          const data = d.data() as any;
          if (data && data.recordKind === 'internal_message') {
            let createdIso = new Date().toISOString();
            if (typeof data.createdAt === 'string') {
              createdIso = data.createdAt;
            } else if (data.createdAt?.toDate) {
              createdIso = data.createdAt.toDate().toISOString();
            } else if (data.createdAt?.seconds) {
              createdIso = new Date(data.createdAt.seconds * 1000).toISOString();
            }
            cloudMsgs.push({
              id: d.id,
              senderId: data.senderId || '',
              senderName: data.senderName || 'مستخدم',
              senderRoleLabel: data.senderRoleLabel || '',
              senderEmail: data.senderEmail || '',
              recipientId: data.recipientId || '',
              recipientName: data.recipientName || '',
              recipientCategory: (data.recipientCategory || 'TEACHER') as CommunicationRecipientCategory,
              recipientRoleLabel: data.recipientRoleLabel || '',
              subject: data.subject || 'رسالة جديدة',
              content: data.content || '',
              createdAt: createdIso,
              readBy: Array.isArray(data.readBy) ? data.readBy : [],
              deletedBy: Array.isArray(data.deletedBy) ? data.deletedBy : [],
              directorateId: data.directorateId
            });
          }
        });
        const currentLocal = getLocal<InternalMessage>('taourirt_internal_messages', []);
        const map = new Map<string, InternalMessage>();
        currentLocal.forEach(m => map.set(m.id, m));
        cloudMsgs.forEach(m => map.set(m.id, m));
        const merged = Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setLocal('taourirt_internal_messages', merged);
        callback(merged);
      },
      () => {
        handleLocalUpdate();
      }
    );

    return () => {
      window.removeEventListener('internalMessagesUpdated', handleLocalUpdate);
      try {
        unsub();
      } catch {}
    };
  },

  async sendInternalMessage(
    msg: Omit<InternalMessage, 'id' | 'createdAt'>
  ): Promise<InternalMessage> {
    const activeDirId = this.getActiveDirectorateId() || 'taourirt';
    const newId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const record: InternalMessage = {
      ...msg,
      id: newId,
      createdAt: nowIso,
      readBy: msg.readBy || [msg.senderId],
      deletedBy: msg.deletedBy || [],
      directorateId: msg.directorateId || activeDirId
    };

    const current = getLocal<InternalMessage>('taourirt_internal_messages', []);
    setLocal('taourirt_internal_messages', [record, ...current]);
    window.dispatchEvent(new CustomEvent('internalMessagesUpdated'));

    try {
      await fbSetDoc(doc(db, 'announcements', newId), {
        ...stripUndefinedDeep(record),
        recordKind: 'internal_message',
        createdAt: nowIso
      });
    } catch (e) {
      console.warn('Internal message saved locally; Firestore sync pending:', e);
    }

    // Trigger a private targeted bell notification to recipient ONLY
    try {
      await this.addNotification({
        title: `📩 رسالة جديدة من: ${msg.senderName}`,
        body: `${msg.subject ? msg.subject + ' — ' : ''}${msg.content.slice(0, 140)}`,
        role: 'PRIVATE_MSG',
        isDirectMessage: true,
        userIds: [msg.recipientId],
        directorateId: activeDirId
      });
    } catch {}

    return record;
  },

  async markInternalMessageAsRead(id: string, userId: string): Promise<void> {
    if (!id || !userId) return;
    const current = getLocal<InternalMessage>('taourirt_internal_messages', []);
    const updated = current.map(m => {
      if (m.id === id) {
        const readBy = m.readBy || [];
        if (!readBy.includes(userId)) {
          return { ...m, readBy: [...readBy, userId] };
        }
      }
      return m;
    });
    setLocal('taourirt_internal_messages', updated);
    window.dispatchEvent(new CustomEvent('internalMessagesUpdated'));

    try {
      await fbSetDoc(doc(db, 'announcements', id), {
        readBy: arrayUnion(userId)
      }, { merge: true });
    } catch {}
  },

  async deleteInternalMessageForUser(id: string, userId: string): Promise<void> {
    if (!id || !userId) return;
    const current = getLocal<InternalMessage>('taourirt_internal_messages', []);
    const updated = current.map(m => {
      if (m.id === id) {
        const deletedBy = m.deletedBy || [];
        if (!deletedBy.includes(userId)) {
          return { ...m, deletedBy: [...deletedBy, userId] };
        }
      }
      return m;
    });
    setLocal('taourirt_internal_messages', updated);
    window.dispatchEvent(new CustomEvent('internalMessagesUpdated'));

    try {
      await fbSetDoc(doc(db, 'announcements', id), {
        deletedBy: arrayUnion(userId)
      }, { merge: true });
    } catch {}
  },

  async getCommunicationRecipients(): Promise<Array<{
    id: string;
    name: string;
    category: CommunicationRecipientCategory;
    roleLabel: string;
    subtitle: string;
    email?: string;
    phone?: string;
  }>> {
    const [allUsers, allReferees] = await Promise.all([
      this.getUsers().catch(() => [] as User[]),
      this.getReferees().catch(() => [] as Referee[])
    ]);

    const items: Array<{
      id: string;
      name: string;
      category: CommunicationRecipientCategory;
      roleLabel: string;
      subtitle: string;
      email?: string;
      phone?: string;
    }> = [];
    const seenKeys = new Set<string>();

    allUsers.forEach(u => {
      if (!u || !u.id || !u.fullName) return;

      const isAdmin =
        u.role === 'CENTRAL_ADMIN' ||
        u.role === 'SUPER_ADMIN' ||
        u.isSuperAdmin === true ||
        Boolean(u.email && SUPER_ADMIN_EMAILS.some(e => isFlexibleEmailMatch(e, u.email!)));

      if (isAdmin) {
        const key = `CENTRAL_ADMIN_${u.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          items.push({
            id: u.id,
            name: u.fullName,
            category: 'CENTRAL_ADMIN',
            roleLabel: u.isSuperAdmin ? 'المسؤول المركزي' : 'المسير المركزي / الإقليمي',
            subtitle: u.directorateName || u.workLocation || 'المديرية الإقليمية',
            email: u.email,
            phone: u.phone
          });
        }
      }

      if (u.isTechCommitteeHead || u.role === 'TECH_HEAD' || (u.role as string) === 'TECH_COMMITTEE_HEAD') {
        const key = `TECH_COMMITTEE_HEAD_${u.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const sportsText = (u.techCommitteeSports || [])
            .map(sid => SPORTS_MAP[sid]?.name || sid)
            .join('، ');
          items.push({
            id: u.id,
            name: u.fullName,
            category: 'TECH_COMMITTEE_HEAD',
            roleLabel: 'رئيس اللجنة التقنية',
            subtitle: sportsText ? `التخصص: ${sportsText}` : (u.workLocation || 'رئيس لجنة تقنية'),
            email: u.email,
            phone: u.phone
          });
        }
      }

      const isRefUser = u.role === 'REFEREE' || (Array.isArray(u.refereeSpecialty) && u.refereeSpecialty.length > 0);
      if (isRefUser) {
        const key = `REFEREE_${u.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const specText = (u.refereeSpecialty || [])
            .map(sid => SPORTS_MAP[sid]?.name || sid)
            .join('، ');
          items.push({
            id: u.id,
            name: u.fullName,
            category: 'REFEREE',
            roleLabel: 'حكم معتمد',
            subtitle: specText ? `التحكيم: ${specText}` : (u.workLocation || 'حكم'),
            email: u.email,
            phone: u.phone
          });
        }
      }

      if (!u.role || u.role === 'TEACHER' || u.role === 'SPORT_MANAGER') {
        const key = `TEACHER_${u.id}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          items.push({
            id: u.id,
            name: u.fullName,
            category: 'TEACHER',
            roleLabel: u.role === 'SPORT_MANAGER' ? 'منسق / مسير رياضي' : 'أستاذ(ة) التربية البدنية',
            subtitle: u.workLocation || 'مؤسسة تعليمية',
            email: u.email,
            phone: u.phone
          });
        }
      }
    });

    allReferees.forEach(ref => {
      if (!ref || !ref.fullName) return;
      const targetId = ref.teacherId || ref.id;
      const key = `REFEREE_${targetId}`;
      const matchedByName = items.some(
        i => i.category === 'REFEREE' && normalizeArabicName(i.name) === normalizeArabicName(ref.fullName)
      );
      if (!seenKeys.has(key) && !matchedByName) {
        seenKeys.add(key);
        const specs = Array.isArray(ref.specialty)
          ? ref.specialty.map(sid => SPORTS_MAP[sid]?.name || sid).join('، ')
          : '';
        items.push({
          id: targetId,
          name: ref.fullName,
          category: 'REFEREE',
          roleLabel: 'حكم معتمد',
          subtitle: specs ? `التحكيم: ${specs}` : (ref.workLocation || 'حكم معتمد'),
          email: ref.email,
          phone: ref.phone
        });
      }
    });

    return items.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  },

  // ============================================================================
  // REGIONAL HOLIDAYS & EXAM DATES BLOCKLIST ("لائحة العطل وتواريخ الفروض")
  // ============================================================================
  async getBlockedScheduleDates(directorateId?: string): Promise<BlockedSchedulePeriod[]> {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const localKey = `taourirt_blocked_schedule_${activeDirId}`;
    const dismissedKey = `taourirt_blocked_schedule_dismissed_${activeDirId}`;
    const localList = getLocal<BlockedSchedulePeriod>(localKey, []);
    const localDismissed = getLocalStringArray(dismissedKey);

    if (this.isCloudSyncPaused()) {
      return mergeBlockedWithOfficialHolidays(localList, localDismissed, activeDirId);
    }

    try {
      const snap = await fbGetDoc(doc(db, 'settings', `blocked_schedule_dates_${activeDirId}`));
      if (snap.exists()) {
        const data = snap.data() as any;
        const periods = Array.isArray(data?.periods) ? data.periods : localList;
        const dismissed = Array.isArray(data?.dismissedDefaultIds) ? data.dismissedDefaultIds : localDismissed;
        setLocal(localKey, periods);
        setLocalStringArray(dismissedKey, dismissed);
        return mergeBlockedWithOfficialHolidays(periods, dismissed, activeDirId);
      }
    } catch (e) {
      console.warn('getBlockedScheduleDates fallback to local:', e);
    }

    return mergeBlockedWithOfficialHolidays(localList, localDismissed, activeDirId);
  },

  subscribeToBlockedScheduleDates(
    callback: (periods: BlockedSchedulePeriod[]) => void,
    directorateId?: string
  ): () => void {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const localKey = `taourirt_blocked_schedule_${activeDirId}`;
    const dismissedKey = `taourirt_blocked_schedule_dismissed_${activeDirId}`;
    const emitMerged = () => {
      const localList = getLocal<BlockedSchedulePeriod>(localKey, []);
      const localDismissed = getLocalStringArray(dismissedKey);
      callback(mergeBlockedWithOfficialHolidays(localList, localDismissed, activeDirId));
    };

    emitMerged();

    const handleLocal = () => {
      emitMerged();
    };
    window.addEventListener('blockedScheduleDatesUpdated', handleLocal);

    if (this.isCloudSyncPaused()) {
      return () => {
        window.removeEventListener('blockedScheduleDatesUpdated', handleLocal);
      };
    }

    const unsub = fbOnSnapshot(
      doc(db, 'settings', `blocked_schedule_dates_${activeDirId}`),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const periods = Array.isArray(data?.periods) ? data.periods : [];
          const dismissed = Array.isArray(data?.dismissedDefaultIds) ? data.dismissedDefaultIds : [];
          setLocal(localKey, periods);
          setLocalStringArray(dismissedKey, dismissed);
          callback(mergeBlockedWithOfficialHolidays(periods, dismissed, activeDirId));
        } else {
          emitMerged();
        }
      },
      () => {
        handleLocal();
      }
    );

    return () => {
      window.removeEventListener('blockedScheduleDatesUpdated', handleLocal);
      try {
        unsub();
      } catch {}
    };
  },

  async saveBlockedScheduleDates(
    periods: BlockedSchedulePeriod[],
    directorateId?: string
  ): Promise<void> {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const localKey = `taourirt_blocked_schedule_${activeDirId}`;
    const dismissedKey = `taourirt_blocked_schedule_dismissed_${activeDirId}`;
    const cleanPeriods = periods
      .filter(p => !OBSOLETE_DEFAULT_BLOCKED_IDS_2026_2027.has(p.id))
      .map(p => ({
        ...p,
        startDate: normalizeDateToYmd(p.startDate) || p.startDate,
        endDate: normalizeDateToYmd(p.endDate || p.startDate) || p.endDate || p.startDate,
        directorateId: activeDirId
      }));

    const presentIds = new Set(cleanPeriods.map(p => p.id));
    const dismissedDefaultIds = OFFICIAL_DEFAULT_BLOCKED_PERIODS_2026_2027
      .filter(h => !presentIds.has(h.id))
      .map(h => h.id);

    setLocal(localKey, cleanPeriods);
    setLocalStringArray(dismissedKey, dismissedDefaultIds);
    const mergedForEvent = mergeBlockedWithOfficialHolidays(cleanPeriods, dismissedDefaultIds, activeDirId);
    window.dispatchEvent(new CustomEvent('blockedScheduleDatesUpdated', { detail: mergedForEvent }));

    try {
      await fbSetDoc(doc(db, 'settings', `blocked_schedule_dates_${activeDirId}`), {
        periods: cleanPeriods,
        dismissedDefaultIds,
        directorateId: activeDirId,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('saveBlockedScheduleDates saved locally; Firestore sync pending:', e);
    }
  },

  async restoreOfficialBlockedScheduleDates(
    directorateId?: string,
    keepCustomPeriods: boolean = true
  ): Promise<BlockedSchedulePeriod[]> {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const localKey = `taourirt_blocked_schedule_${activeDirId}`;
    const dismissedKey = `taourirt_blocked_schedule_dismissed_${activeDirId}`;

    const officialIds = new Set(OFFICIAL_DEFAULT_BLOCKED_PERIODS_2026_2027.map(p => p.id));
    const existing = await this.getBlockedScheduleDates(activeDirId).catch(() => []);
    const customOnly = keepCustomPeriods
      ? existing.filter(p => !officialIds.has(p.id) && !OBSOLETE_DEFAULT_BLOCKED_IDS_2026_2027.has(p.id))
      : [];

    const restored = mergeBlockedWithOfficialHolidays(customOnly, [], activeDirId);
    setLocal(localKey, restored);
    setLocalStringArray(dismissedKey, []);
    window.dispatchEvent(new CustomEvent('blockedScheduleDatesUpdated', { detail: restored }));

    try {
      await fbSetDoc(doc(db, 'settings', `blocked_schedule_dates_${activeDirId}`), {
        periods: restored,
        dismissedDefaultIds: [],
        directorateId: activeDirId,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('restoreOfficialBlockedScheduleDates saved locally; Firestore sync pending:', e);
    }
    return restored;
  },

  // ============================================================================
  // AFFILIATION DISPLAY CONFIGURATION (إعدادات عرض الأصناف: منتمين / غير منتمين)
  // ============================================================================
  getAffiliationDisplayConfigSync(directorateId?: string): AffiliationDisplayConfig {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const effectiveDir = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const localKey = `taourirt_affiliation_display_config_${effectiveDir}`;
    try {
      const raw = localStorage.getItem(localKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.globalMode === 'both' || parsed.globalMode === 'non_club' || parsed.globalMode === 'club_affiliated')) {
          return {
            directorateId: effectiveDir,
            globalMode: parsed.globalMode,
            sportModes: parsed.sportModes || {},
            updatedAt: parsed.updatedAt,
            updatedBy: parsed.updatedBy
          };
        }
      }
    } catch {}
    return {
      directorateId: effectiveDir,
      globalMode: 'both',
      sportModes: {}
    };
  },

  async getAffiliationDisplayConfig(directorateId?: string): Promise<AffiliationDisplayConfig> {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const effectiveDir = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const localKey = `taourirt_affiliation_display_config_${effectiveDir}`;
    const localFallback = this.getAffiliationDisplayConfigSync(effectiveDir);

    if (this.isCloudSyncPaused()) {
      return localFallback;
    }

    try {
      const snap = await fbGetDoc(doc(db, 'settings', `affiliation_display_${effectiveDir}`));
      if (snap.exists()) {
        const data = snap.data() as any;
        const cfg: AffiliationDisplayConfig = {
          directorateId: effectiveDir,
          globalMode: data.globalMode === 'non_club' || data.globalMode === 'club_affiliated' ? data.globalMode : 'both',
          sportModes: data.sportModes && typeof data.sportModes === 'object' ? data.sportModes : {},
          updatedAt: data.updatedAt,
          updatedBy: data.updatedBy
        };
        try {
          localStorage.setItem(localKey, JSON.stringify(cfg));
        } catch {}
        return cfg;
      }
    } catch (e) {
      console.warn('Error fetching affiliation display config:', e);
    }

    return localFallback;
  },

  subscribeToAffiliationDisplayConfig(
    callback: (config: AffiliationDisplayConfig) => void,
    directorateId?: string
  ): () => void {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const effectiveDir = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const localKey = `taourirt_affiliation_display_config_${effectiveDir}`;

    callback(this.getAffiliationDisplayConfigSync(effectiveDir));

    const handleLocal = () => {
      callback(this.getAffiliationDisplayConfigSync(effectiveDir));
    };
    window.addEventListener('affiliationDisplayConfigUpdated', handleLocal);
    window.addEventListener('directorateChanged', handleLocal);

    if (this.isCloudSyncPaused()) {
      return () => {
        window.removeEventListener('affiliationDisplayConfigUpdated', handleLocal);
        window.removeEventListener('directorateChanged', handleLocal);
      };
    }

    const unsub = fbOnSnapshot(
      doc(db, 'settings', `affiliation_display_${effectiveDir}`),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as any;
          const cfg: AffiliationDisplayConfig = {
            directorateId: effectiveDir,
            globalMode: data.globalMode === 'non_club' || data.globalMode === 'club_affiliated' ? data.globalMode : 'both',
            sportModes: data.sportModes && typeof data.sportModes === 'object' ? data.sportModes : {},
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy
          };
          try {
            localStorage.setItem(localKey, JSON.stringify(cfg));
          } catch {}
          callback(cfg);
        }
      },
      () => {
        handleLocal();
      }
    );

    return () => {
      window.removeEventListener('affiliationDisplayConfigUpdated', handleLocal);
      window.removeEventListener('directorateChanged', handleLocal);
      try {
        unsub();
      } catch {}
    };
  },

  async saveAffiliationDisplayConfig(
    config: AffiliationDisplayConfig,
    directorateId?: string
  ): Promise<void> {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const effectiveDir = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const localKey = `taourirt_affiliation_display_config_${effectiveDir}`;

    const cleanConfig: AffiliationDisplayConfig = {
      directorateId: effectiveDir,
      globalMode: config.globalMode === 'non_club' || config.globalMode === 'club_affiliated' ? config.globalMode : 'both',
      sportModes: config.sportModes || {},
      updatedAt: new Date().toISOString(),
      updatedBy: config.updatedBy || ''
    };

    try {
      localStorage.setItem(localKey, JSON.stringify(cleanConfig));
    } catch {}
    window.dispatchEvent(new CustomEvent('affiliationDisplayConfigUpdated', { detail: cleanConfig }));

    try {
      await fbSetDoc(doc(db, 'settings', `affiliation_display_${effectiveDir}`), {
        ...cleanConfig,
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.warn('saveAffiliationDisplayConfig saved locally; Firestore sync pending:', e);
    }
  },

  // --- ADMINISTRATIVE CADRES (الأطر الإدارية: المفتشون، رئيس مكتب التربية البدنية، إلخ) ---
  getDefaultAdministrativeCadres(directorateId?: string): AdministrativeCadre[] {
    const dirId = directorateId && directorateId !== 'all' ? directorateId : (this.getActiveDirectorateId() || 'taourirt');
    const normalizedDir = dirId === 'all' ? 'taourirt' : dirId;
    return [
      {
        id: `default_admin_cadre_amin_${normalizedDir}`,
        fullName: 'أمين سنوسي',
        leaseNumber: '',
        cadre: 'مفتش تربوي',
        phone: '',
        email: 'aminens21@gmail.com',
        category: 'INSPECTOR',
        directorateId: normalizedDir,
        isDefault: true
      },
      {
        id: `default_admin_cadre_meqnou_${normalizedDir}`,
        fullName: 'نور الدين مقتل',
        leaseNumber: '',
        cadre: 'مفتش تربوي',
        phone: '',
        email: 'meqnou@gmail.com',
        category: 'INSPECTOR',
        directorateId: normalizedDir,
        isDefault: true
      },
      {
        id: `default_admin_cadre_office_head_${normalizedDir}`,
        fullName: 'رئيس مكتب التربية البدنية',
        leaseNumber: '',
        cadre: 'رئيس مكتب التربية البدنية',
        phone: '',
        email: '',
        category: 'OFFICE_HEAD',
        directorateId: normalizedDir,
        isDefault: true
      }
    ];
  },

  _resolveAdminCadreCategory(cadre?: string, explicitCategory?: AdministrativeCadre['category']): AdministrativeCadre['category'] {
    if (explicitCategory) return explicitCategory;
    const raw = (cadre || '').trim();
    if (raw.includes('مفتش')) return 'INSPECTOR';
    if (raw.includes('رئيس مكتب') || raw.includes('التربية البدنية')) return 'OFFICE_HEAD';
    return 'OTHER';
  },

  _mergeAdministrativeCadres(records: AdministrativeCadre[], directorateId?: string): AdministrativeCadre[] {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const effectiveDir = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const defaults = this.getDefaultAdministrativeCadres(effectiveDir);

    const byId = new Map<string, AdministrativeCadre>();
    defaults.forEach(def => {
      if (!isRecentlyDeleted('administrative_cadres', def.id)) {
        byId.set(def.id, def);
      }
    });

    records.forEach(rec => {
      if (!rec || !rec.id) return;
      const recDir = rec.directorateId || 'taourirt';
      if (activeDirId !== 'all' && recDir !== activeDirId) return;
      if (rec.isDeleted || isRecentlyDeleted('administrative_cadres', rec.id)) {
        byId.delete(rec.id);
        return;
      }
      const prev = byId.get(rec.id);
      const isAmineCadre = rec.id.startsWith('default_admin_cadre_amin_') || isAmineSanoussiIdentity(rec);
      const resolvedCadreTitle =
        isAmineCadre && (!rec.cadre || rec.cadre.trim() === 'مفتش')
          ? 'مفتش تربوي'
          : (rec.cadre || prev?.cadre || 'إطار إداري');
      byId.set(rec.id, {
        ...prev,
        ...rec,
        fullName: isAmineCadre ? 'أمين سنوسي' : rec.fullName,
        cadre: resolvedCadreTitle,
        category: this._resolveAdminCadreCategory(resolvedCadreTitle, rec.category || prev?.category),
        directorateId: recDir
      });
    });

    return Array.from(byId.values());
  },

  async getAdministrativeCadres(directorateId?: string): Promise<AdministrativeCadre[]> {
    const activeDirId = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const localList = getLocal<AdministrativeCadre>(STORAGE_KEYS.ADMINISTRATIVE_CADRES, []);

    try {
      const snap = await getDocs(collection(db, 'administrative_cadres'));
      const cloudList = snap.empty
        ? []
        : snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AdministrativeCadre));

      const cloudIds = new Set(cloudList.map(c => c.id));
      const pendingLocal = localList.filter(
        c => c && c.id && (isPendingWrite('administrative_cadres', c.id) || !cloudIds.has(c.id))
      );

      // Deduplicate preferring pending local writes, otherwise cloud docs
      const mergedRawMap = new Map<string, AdministrativeCadre>();
      cloudList.forEach(c => {
        if (c?.id) mergedRawMap.set(c.id, c);
      });
      pendingLocal.forEach(c => {
        if (c?.id && isPendingWrite('administrative_cadres', c.id)) {
          mergedRawMap.set(c.id, c);
        }
      });

      const mergedAllRaw = Array.from(mergedRawMap.values());
      if (mergedAllRaw.length > 0) {
        setLocal(STORAGE_KEYS.ADMINISTRATIVE_CADRES, mergedAllRaw);
      }
      return this._mergeAdministrativeCadres(mergedAllRaw, activeDirId);
    } catch (e) {
      console.warn('Could not fetch administrative_cadres from Firestore, using local cache + defaults:', e);
      return this._mergeAdministrativeCadres(localList, activeDirId);
    }
  },

  async addAdministrativeCadre(cadre: Omit<AdministrativeCadre, 'id'>): Promise<AdministrativeCadre> {
    const activeDirId = cadre.directorateId || this.getActiveDirectorateId() || 'taourirt';
    const effectiveDir = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const docRef = doc(collection(db, 'administrative_cadres'));
    const realId = docRef.id;

    const record: AdministrativeCadre = {
      ...cadre,
      id: realId,
      fullName: (cadre.fullName || '').trim(),
      leaseNumber: (cadre.leaseNumber || '').trim(),
      cadre: (cadre.cadre || '').trim() || 'إطار إداري',
      phone: (cadre.phone || '').trim(),
      email: (cadre.email || '').trim().toLowerCase(),
      category: this._resolveAdminCadreCategory(cadre.cadre, cadre.category),
      directorateId: effectiveDir,
      isDefault: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const localList = getLocal<AdministrativeCadre>(STORAGE_KEYS.ADMINISTRATIVE_CADRES, []);
    setLocal(STORAGE_KEYS.ADMINISTRATIVE_CADRES, deduplicateById([record, ...localList]));
    markPendingWrite('administrative_cadres', realId);

    try {
      await setDoc(docRef, stripUndefinedDeep({
        ...record,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }));
      clearPendingWrite('administrative_cadres', realId);
    } catch (e) {
      console.warn('Administrative cadre saved locally; Firestore sync pending:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('administrativeCadresUpdated'));
    }
    return record;
  },

  async updateAdministrativeCadre(id: string, data: Partial<AdministrativeCadre>): Promise<AdministrativeCadre> {
    const activeDirId = data.directorateId || this.getActiveDirectorateId() || 'taourirt';
    const effectiveDir = activeDirId === 'all' ? 'taourirt' : activeDirId;
    const localList = getLocal<AdministrativeCadre>(STORAGE_KEYS.ADMINISTRATIVE_CADRES, []);
    const defaultItem = this.getDefaultAdministrativeCadres(effectiveDir).find(d => d.id === id);
    const existingItem = localList.find(c => c.id === id) || defaultItem;

    const nextCadreTitle = data.cadre !== undefined ? data.cadre.trim() : (existingItem?.cadre || 'إطار إداري');
    const updatedRecord: AdministrativeCadre = {
      ...existingItem,
      ...data,
      id,
      fullName: (data.fullName !== undefined ? data.fullName : existingItem?.fullName || '').trim(),
      leaseNumber: (data.leaseNumber !== undefined ? data.leaseNumber : existingItem?.leaseNumber || '').trim(),
      cadre: nextCadreTitle,
      phone: (data.phone !== undefined ? data.phone : existingItem?.phone || '').trim(),
      email: (data.email !== undefined ? data.email : existingItem?.email || '').trim().toLowerCase(),
      category: this._resolveAdminCadreCategory(nextCadreTitle, data.category),
      directorateId: existingItem?.directorateId || effectiveDir,
      isDeleted: false,
      updatedAt: new Date().toISOString()
    };

    const nextLocal = [updatedRecord, ...localList.filter(c => c.id !== id)];
    setLocal(STORAGE_KEYS.ADMINISTRATIVE_CADRES, deduplicateById(nextLocal));
    markPendingWrite('administrative_cadres', id);

    try {
      await setDoc(doc(db, 'administrative_cadres', id), stripUndefinedDeep({
        ...updatedRecord,
        updatedAt: serverTimestamp()
      }), { merge: true });
      clearPendingWrite('administrative_cadres', id);
    } catch (e) {
      console.warn('Administrative cadre update saved locally; Firestore sync pending:', e);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('administrativeCadresUpdated'));
    }
    return updatedRecord;
  },

  async deleteAdministrativeCadre(id: string): Promise<void> {
    markRecentlyDeleted('administrative_cadres', id);
    const localList = getLocal<AdministrativeCadre>(STORAGE_KEYS.ADMINISTRATIVE_CADRES, []);
    const isDefaultId = id.startsWith('default_admin_cadre_');

    if (isDefaultId) {
      const tombstone: AdministrativeCadre = {
        id,
        fullName: '',
        cadre: '',
        directorateId: this.getActiveDirectorateId() || 'taourirt',
        isDefault: true,
        isDeleted: true,
        updatedAt: new Date().toISOString()
      };
      setLocal(STORAGE_KEYS.ADMINISTRATIVE_CADRES, [tombstone, ...localList.filter(c => c.id !== id)]);
      try {
        await setDoc(doc(db, 'administrative_cadres', id), {
          ...tombstone,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (e) {
        console.warn('Default administrative cadre tombstone saved locally:', e);
      }
    } else {
      setLocal(STORAGE_KEYS.ADMINISTRATIVE_CADRES, localList.filter(c => c.id !== id));
      try {
        await deleteDoc(doc(db, 'administrative_cadres', id));
      } catch (e) {
        console.warn('Administrative cadre deleted locally:', e);
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('administrativeCadresUpdated'));
    }
  },

  subscribeToAdministrativeCadres(
    callback: (cadres: AdministrativeCadre[]) => void,
    directorateId?: string
  ): () => void {
    const effectiveDir = directorateId || this.getActiveDirectorateId() || 'taourirt';
    const emitLocal = () => {
      const localList = getLocal<AdministrativeCadre>(STORAGE_KEYS.ADMINISTRATIVE_CADRES, []);
      callback(this._mergeAdministrativeCadres(localList, effectiveDir));
    };

    const handleLocalUpdate = () => emitLocal();
    window.addEventListener('administrativeCadresUpdated', handleLocalUpdate);
    window.addEventListener('directorateChanged', handleLocalUpdate);

    if (isCloudSyncPaused()) {
      emitLocal();
      return () => {
        window.removeEventListener('administrativeCadresUpdated', handleLocalUpdate);
        window.removeEventListener('directorateChanged', handleLocalUpdate);
      };
    }

    const unsub = onSnapshot(
      collection(db, 'administrative_cadres'),
      (snap) => {
        const cloudList = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AdministrativeCadre));
        const localList = getLocal<AdministrativeCadre>(STORAGE_KEYS.ADMINISTRATIVE_CADRES, []);
        const pendingLocal = localList.filter(c => c && c.id && isPendingWrite('administrative_cadres', c.id));
        const map = new Map<string, AdministrativeCadre>();
        cloudList.forEach(c => { if (c?.id) map.set(c.id, c); });
        pendingLocal.forEach(c => { if (c?.id) map.set(c.id, c); });
        const rawAll = Array.from(map.values());
        if (rawAll.length > 0) {
          setLocal(STORAGE_KEYS.ADMINISTRATIVE_CADRES, rawAll);
        }
        callback(this._mergeAdministrativeCadres(rawAll, effectiveDir));
      },
      () => {
        emitLocal();
      }
    );

    return () => {
      window.removeEventListener('administrativeCadresUpdated', handleLocalUpdate);
      window.removeEventListener('directorateChanged', handleLocalUpdate);
      try {
        unsub();
      } catch {}
    };
  }
};

export interface ConfirmedBranchTuple {
  category: string;
  gender: 'Male' | 'Female';
  affiliationType: string;
}

/**
 * Returns the exact list of confirmed (category, gender, affiliationType) branch tuples for a school confirmation.
 * Uses `selectedBranches` when present (eliminating Cartesian-product false positives), with fallback to legacy arrays.
 */
export function getEffectiveConfirmedBranches(
  conf?: SchoolTournamentConfirmation | null,
  excludeWithdrawn = true
): ConfirmedBranchTuple[] {
  if (!conf || conf.status !== 'confirmed') return [];

  const raw: ConfirmedBranchTuple[] = [];
  const seen = new Set<string>();

  const pushTuple = (category: string, gender: 'Male' | 'Female', affiliationType: string) => {
    const normCat = normalizeCategoryKey(category);
    if (!normCat) return;
    const normGen: 'Male' | 'Female' = gender === 'Female' ? 'Female' : 'Male';
    const normAff = (affiliationType || 'non_club').trim();
    const key = `${normAff}__${normCat}__${normGen}`;
    if (seen.has(key)) return;
    seen.add(key);
    raw.push({ category: normCat, gender: normGen, affiliationType: normAff });
  };

  if (Array.isArray(conf.selectedBranches) && conf.selectedBranches.length > 0) {
    conf.selectedBranches.forEach(b => {
      if (!b || !b.category) return;
      pushTuple(b.category, b.gender === 'Female' ? 'Female' : 'Male', b.affiliationType || 'non_club');
    });
  } else {
    const cats = conf.categories && conf.categories.length > 0 ? conf.categories : [];
    const gens: ('Male' | 'Female')[] = conf.genders && conf.genders.length > 0 ? conf.genders : ['Male', 'Female'];
    const affs = conf.affiliationTypes && conf.affiliationTypes.length > 0
      ? conf.affiliationTypes
      : ((conf as any).affiliationType ? [(conf as any).affiliationType] : ['non_club']);

    affs.forEach(aff => {
      cats.forEach(cat => {
        gens.forEach(gen => {
          pushTuple(cat, gen, aff);
        });
      });
    });
  }

  if (!excludeWithdrawn) return raw;

  return raw.filter(b => !DataService.isSchoolWithdrawn({
    sportId: conf.sportId,
    ageCategory: b.category,
    gender: b.gender,
    affiliationType: b.affiliationType
  }, conf.schoolId, conf.schoolName));
}

/**
 * Checks whether a school confirmation explicitly includes a target championship branch
 * (affiliationType, category, gender).
 */
export function doesConfirmationMatchBranch(
  conf: SchoolTournamentConfirmation | undefined | null,
  branch: {
    category?: string;
    gender?: string;
    affiliationType?: string;
  }
): boolean {
  const tuples = getEffectiveConfirmedBranches(conf, true);
  if (tuples.length === 0) return false;

  const targetAff = branch.affiliationType && branch.affiliationType !== 'ALL' ? branch.affiliationType : undefined;
  const targetCat = branch.category && branch.category !== 'ALL' ? normalizeCategoryKey(branch.category) : undefined;
  const targetGen = branch.gender && branch.gender !== 'ALL' && branch.gender !== 'Both' && branch.gender !== 'Mixed'
    ? branch.gender.toLowerCase()
    : undefined;

  return tuples.some(b => {
    if (targetAff && b.affiliationType !== targetAff) return false;
    if (targetCat && normalizeCategoryKey(b.category) !== targetCat) return false;
    if (targetGen && b.gender.toLowerCase() !== targetGen) return false;
    return true;
  });
}

/**
 * Returns a strictly gender-separated Arabic category title:
 * U12: البراعم / البرعمات
 * U15: الصغار / الصغيرات
 * U18: الفتيان / الفتيات
 * U20: الشبان / الشابات
 */
export function getGenderSpecificCategoryTitle(
  category: string,
  gender: 'Male' | 'Female',
  sportId?: string
): string {
  const norm = normalizeCategoryKey(category);
  const isFem = gender === 'Female';
  const isCC = isTrackOrCrossCountrySport(sportId);

  if (isCC) {
    if (norm === 'U12') return isFem ? 'البرعمات (إناث)' : 'البراعم (ذكور)';
    if (norm === 'U15') return isFem ? 'الصغيرات (إناث)' : 'الصغار (ذكور)';
    if (norm === 'U18') return isFem ? 'الفتيات (إناث)' : 'الفتيان (ذكور)';
    if (norm === 'U20') return isFem ? 'الشابات (إناث)' : 'الشبان (ذكور)';
  } else {
    if (norm === 'U12') return isFem ? 'U12 إناث (أقل من 12 سنة)' : 'U12 ذكور (أقل من 12 سنة)';
    if (norm === 'U15') return isFem ? 'U15 إناث (أقل من 15 سنة)' : 'U15 ذكور (أقل من 15 سنة)';
    if (norm === 'U17') return isFem ? 'U17 إناث (أقل من 17 سنة)' : 'U17 ذكور (أقل من 17 سنة)';
    if (norm === 'U18') return isFem ? 'U18 إناث (أقل من 18 سنة)' : 'U18 ذكور (أقل من 18 سنة)';
    if (norm === 'U20') return isFem ? 'مواليد 2009 وما بعد (إناث)' : 'مواليد 2009 وما بعد (ذكور)';
  }

  const rawCustom = getCustomCategoryName(norm, sportId) || norm;
  const separated = rawCustom
    .replace(/البراعم والبرعمات/g, isFem ? 'البرعمات' : 'البراعم')
    .replace(/الصغار والصغيرات/g, isFem ? 'الصغيرات' : 'الصغار')
    .replace(/الفتيان والفتيات/g, isFem ? 'الفتيات' : 'الفتيان')
    .replace(/الشبان والشابات/g, isFem ? 'الشابات' : 'الشبان');

  const genWord = isFem ? 'إناث' : 'ذكور';
  if (separated.includes(genWord)) return separated;
  return `${separated} (${genWord})`;
}

/**
 * Formats an exact branch tuple in clear gender-separated Arabic,
 * e.g. "لا منتمين — الصغار (U15 ذكور)" or "لا منتمين — الفتيات (U18 إناث)"
 */
export function formatBranchLabelAr(branch: ConfirmedBranchTuple, sportId?: string): string {
  const affLabel = branch.affiliationType === 'club_affiliated'
    ? 'منتمين للأندية'
    : branch.affiliationType === 'open'
    ? 'مفتوحة'
    : 'لا منتمين';
  const catGenderTitle = getGenderSpecificCategoryTitle(branch.category, branch.gender, sportId);
  return `${affLabel} — ${catGenderTitle}`;
}

export const EDUCATIONAL_CYCLE_LABELS: Record<EducationalCycleKey, string> = {
  'ابتدائي': 'التعليم الابتدائي',
  'إعدادي': 'الثانوي الإعدادي',
  'تأهيلي': 'الثانوي التأهيلي',
  'خصوصي': 'التعليم الخصوصي',
  'ALL': 'جميع الأسلاك التعليمية'
};

/**
 * Resolves the educational cycle(s) involved in a match based on the participating schools
 * and (as fallback) tournament level / age category.
 */
export function getMatchEducationalCycles(
  params: {
    team1Id?: string;
    team2Id?: string;
    ageCategory?: string;
    level?: string;
    tournamentId?: string;
  },
  schools: School[] = [],
  tournaments: Tournament[] = []
): ('ابتدائي' | 'إعدادي' | 'تأهيلي' | 'خصوصي')[] {
  const cycles = new Set<'ابتدائي' | 'إعدادي' | 'تأهيلي' | 'خصوصي'>();

  const inferPrivateCycleHint = (s: School): 'ابتدائي' | 'إعدادي' | 'تأهيلي' | null => {
    const combined = normalizeArabicSearch(`${s.type || ''} ${s.name || ''}`);
    if (combined.includes('تاهيل')) return 'تأهيلي';
    if (combined.includes('اعداد')) return 'إعدادي';
    if (combined.includes('ابتدائ') || combined.includes('مدرسه')) return 'ابتدائي';
    return null;
  };

  const s1 = params.team1Id ? schools.find(s => s.id === params.team1Id || s.name === params.team1Id) : undefined;
  const s2 = params.team2Id ? schools.find(s => s.id === params.team2Id || s.name === params.team2Id) : undefined;

  [s1, s2].forEach(sch => {
    if (!sch) return;
    const cyc = normalizeSchoolCycleType(sch) as 'ابتدائي' | 'إعدادي' | 'تأهيلي' | 'خصوصي';
    cycles.add(cyc);
    if (cyc === 'خصوصي') {
      const hint = inferPrivateCycleHint(sch);
      if (hint) cycles.add(hint);
    }
  });

  const tourn = params.tournamentId ? tournaments.find(t => t.id === params.tournamentId) : undefined;
  const rawLevel = (params.level || tourn?.level || '').toLowerCase();
  if (rawLevel.includes('primary') || rawLevel.includes('ابتدائ')) cycles.add('ابتدائي');
  if (rawLevel.includes('middle') || rawLevel.includes('إعداد') || rawLevel.includes('اعداد')) cycles.add('إعدادي');
  if (rawLevel.includes('high') || rawLevel.includes('تأهيل') || rawLevel.includes('تاهيل')) cycles.add('تأهيلي');

  const hasStandardCycle = cycles.has('ابتدائي') || cycles.has('إعدادي') || cycles.has('تأهيلي');
  if (!hasStandardCycle && (params.ageCategory || tourn?.ageCategory)) {
    const cat = normalizeCategoryKey(params.ageCategory || tourn?.ageCategory || '');
    if (cat === 'U12') cycles.add('ابتدائي');
    else if (cat === 'U15') cycles.add('إعدادي');
    else if (cat === 'U18' || cat === 'U20') cycles.add('تأهيلي');
  }

  return Array.from(cycles);
}

export const OFFICIAL_SCHOOL_HOLIDAYS_2026_2027: BlockedSchedulePeriod[] = [
  {
    id: 'holiday-2026-bayniya-1',
    title: 'الفترة البينية الأولى',
    type: 'holiday',
    startDate: '2026-10-18',
    endDate: '2026-10-25',
    targetCycles: ['ALL'],
    notes: '8 أيام — من الأحد 18 أكتوبر 2026 إلى الأحد 25 أكتوبر 2026'
  },
  {
    id: 'holiday-2026-unity-day',
    title: 'عيد الوحدة',
    type: 'holiday',
    startDate: '2026-10-31',
    endDate: '2026-10-31',
    targetCycles: ['ALL'],
    notes: '1 يوم — السبت 31 أكتوبر 2026'
  },
  {
    id: 'holiday-2026-green-march',
    title: 'ذكرى المسيرة الخضراء',
    type: 'holiday',
    startDate: '2026-11-06',
    endDate: '2026-11-06',
    targetCycles: ['ALL'],
    notes: '1 يوم — الجمعة 6 نونبر 2026'
  },
  {
    id: 'holiday-2026-independence',
    title: 'عيد الاستقلال',
    type: 'holiday',
    startDate: '2026-11-18',
    endDate: '2026-11-18',
    targetCycles: ['ALL'],
    notes: '1 يوم — الأربعاء 18 نونبر 2026'
  },
  {
    id: 'holiday-2026-bayniya-2',
    title: 'الفترة البينية الثانية',
    type: 'holiday',
    startDate: '2026-12-06',
    endDate: '2026-12-13',
    targetCycles: ['ALL'],
    notes: '8 أيام — من الأحد 6 دجنبر 2026 إلى الأحد 13 دجنبر 2026'
  },
  {
    id: 'holiday-2027-new-year',
    title: 'فاتح السنة الميلادية',
    type: 'holiday',
    startDate: '2027-01-01',
    endDate: '2027-01-01',
    targetCycles: ['ALL'],
    notes: '1 يوم — الجمعة 1 يناير 2027'
  },
  {
    id: 'holiday-2027-manifesto',
    title: 'ذكرى تقديم وثيقة الاستقلال',
    type: 'holiday',
    startDate: '2027-01-11',
    endDate: '2027-01-11',
    targetCycles: ['ALL'],
    notes: '1 يوم — الاثنين 11 يناير 2027'
  },
  {
    id: 'holiday-2027-amazigh',
    title: 'فاتح السنة الأمازيغية',
    type: 'holiday',
    startDate: '2027-01-14',
    endDate: '2027-01-14',
    targetCycles: ['ALL'],
    notes: '1 يوم — الخميس 14 يناير 2027'
  },
  {
    id: 'holiday-2027-midyear',
    title: 'عطلة منتصف السنة الدراسية',
    type: 'holiday',
    startDate: '2027-01-24',
    endDate: '2027-01-31',
    targetCycles: ['ALL'],
    notes: '8 أيام — من الأحد 24 يناير 2027 إلى الأحد 31 يناير 2027'
  },
  {
    id: 'holiday-2027-eid-fitr',
    title: 'عيد الفطر',
    type: 'holiday',
    startDate: '2027-03-08',
    endDate: '2027-03-11',
    targetCycles: ['ALL'],
    notes: '3 أو 4 أيام — من الاثنين 8 مارس إلى الأربعاء 10 أو الخميس 11 مارس 2027'
  },
  {
    id: 'holiday-2027-bayniya-3',
    title: 'الفترة البينية الثالثة',
    type: 'holiday',
    startDate: '2027-03-21',
    endDate: '2027-03-28',
    targetCycles: ['ALL'],
    notes: '8 أيام — من الأحد 21 مارس 2027 إلى الأحد 28 مارس 2027'
  },
  {
    id: 'holiday-2027-labor-day',
    title: 'عيد الشغل',
    type: 'holiday',
    startDate: '2027-05-01',
    endDate: '2027-05-01',
    targetCycles: ['ALL'],
    notes: '1 يوم — السبت 1 ماي 2027'
  },
  {
    id: 'holiday-2027-bayniya-4',
    title: 'الفترة البينية الرابعة',
    type: 'holiday',
    startDate: '2027-05-09',
    endDate: '2027-05-16',
    targetCycles: ['ALL'],
    notes: '8 أيام — من الأحد 9 ماي 2027 إلى الأحد 16 ماي 2027'
  },
  {
    id: 'holiday-2027-eid-adha',
    title: 'عيد الأضحى',
    type: 'holiday',
    startDate: '2027-05-15',
    endDate: '2027-05-17',
    targetCycles: ['ALL'],
    notes: '3 أيام — من السبت 15 ماي 2027 إلى الاثنين 17 ماي 2027'
  },
  {
    id: 'holiday-2027-hijri',
    title: 'فاتح محرم',
    type: 'holiday',
    startDate: '2027-06-06',
    endDate: '2027-06-06',
    targetCycles: ['ALL'],
    notes: '1 يوم — الأحد 6 يونيو 2027'
  }
];

const OBSOLETE_DEFAULT_BLOCKED_IDS_2026_2027 = new Set<string>([
  'exam-2027-prim-cc-1',
  'exam-2027-prim-cc-2',
  'exam-2027-mid-cc-1',
  'exam-2027-mid-cc-2',
  'exam-2027-high-cc-1',
  'exam-2027-high-2bac-cc-2',
  'exam-2027-high-cc-2'
]);

export const OFFICIAL_EXAM_PERIODS_2026_2027: BlockedSchedulePeriod[] = [
  // السلك الابتدائي
  {
    id: 'exam-2027-prim-local',
    title: 'الامتحان الموحد المحلي لنيل شهادة الدروس الابتدائية',
    type: 'exams',
    startDate: '2027-01-18',
    endDate: '2027-01-19',
    targetCycles: ['ابتدائي'],
    notes: 'السلك الابتدائي — يومي 18 و19 يناير 2027'
  },
  {
    id: 'exam-2027-prim-provincial',
    title: 'الامتحان الموحد الإقليمي لنيل شهادة الدروس الابتدائية',
    type: 'exams',
    startDate: '2027-06-25',
    endDate: '2027-06-26',
    targetCycles: ['ابتدائي'],
    notes: 'السلك الابتدائي — يومي 25 و26 يونيو 2027'
  },

  // السلك الإعدادي
  {
    id: 'exam-2027-mid-local',
    title: 'الامتحان الموحد المحلي لنيل شهادة السلك الإعدادي',
    type: 'exams',
    startDate: '2027-01-18',
    endDate: '2027-01-19',
    targetCycles: ['إعدادي'],
    notes: 'السلك الإعدادي — يومي 18 و19 يناير 2027'
  },
  {
    id: 'exam-2027-mid-regional',
    title: 'الامتحان الموحد الجهوي لنيل شهادة السلك الإعدادي',
    type: 'exams',
    startDate: '2027-06-23',
    endDate: '2027-06-24',
    targetCycles: ['إعدادي'],
    notes: 'السلك الإعدادي — يومي 23 و24 يونيو 2027'
  },

  // السلك التأهيلي (السنة الأولى بكالوريا + السنة الثانية بكالوريا)
  {
    id: 'exam-2027-high-1bac-reg-norm',
    title: 'الدورة العادية للامتحان الجهوي الموحد لنيل شهادة البكالوريا للممدرسين والأحرار (الأولى بكالوريا)',
    type: 'exams',
    startDate: '2027-05-28',
    endDate: '2027-05-29',
    targetCycles: ['تأهيلي'],
    notes: 'السلك التأهيلي (السنة الأولى بكالوريا للممدرسين والأحرار) — 28 و29 ماي 2027'
  },
  {
    id: 'exam-2027-high-2bac-nat-norm',
    title: 'الدورة العادية للامتحان الوطني الموحد لنيل شهادة البكالوريا (الثانية بكالوريا)',
    type: 'exams',
    startDate: '2027-06-01',
    endDate: '2027-06-03',
    targetCycles: ['تأهيلي'],
    notes: 'السلك التأهيلي (السنة الثانية بكالوريا) — من 1 إلى 3 يونيو 2027'
  },
  {
    id: 'exam-2027-high-1bac-reg-rat',
    title: 'الدورة الاستدراكية للامتحان الجهوي الموحد لنيل شهادة البكالوريا للممدرسين والأحرار (الأولى بكالوريا)',
    type: 'exams',
    startDate: '2027-06-28',
    endDate: '2027-06-29',
    targetCycles: ['تأهيلي'],
    notes: 'السلك التأهيلي (السنة الأولى بكالوريا للممدرسين والأحرار) — 28 و29 يونيو 2027'
  },
  {
    id: 'exam-2027-high-2bac-nat-rat',
    title: 'الدورة الاستدراكية للامتحان الوطني الموحد لنيل شهادة البكالوريا (الثانية بكالوريا)',
    type: 'exams',
    startDate: '2027-07-01',
    endDate: '2027-07-03',
    targetCycles: ['تأهيلي'],
    notes: 'السلك التأهيلي (السنة الثانية بكالوريا) — من 1 إلى 3 يوليوز 2027'
  }
];

const OFFICIAL_DEFAULT_BLOCKED_PERIODS_2026_2027: BlockedSchedulePeriod[] = [
  ...OFFICIAL_SCHOOL_HOLIDAYS_2026_2027,
  ...OFFICIAL_EXAM_PERIODS_2026_2027
];

function mergeBlockedWithOfficialHolidays(
  storedPeriods: BlockedSchedulePeriod[],
  dismissedDefaultIds: string[],
  directorateId: string
): BlockedSchedulePeriod[] {
  const safeStored = (Array.isArray(storedPeriods) ? storedPeriods : []).filter(
    p => p && !OBSOLETE_DEFAULT_BLOCKED_IDS_2026_2027.has(p.id)
  );
  const storedIds = new Set(safeStored.map(p => p.id));
  const dismissedSet = new Set(Array.isArray(dismissedDefaultIds) ? dismissedDefaultIds : []);

  const merged: BlockedSchedulePeriod[] = [...safeStored];
  for (const def of OFFICIAL_DEFAULT_BLOCKED_PERIODS_2026_2027) {
    if (!storedIds.has(def.id) && !dismissedSet.has(def.id)) {
      merged.push({ ...def, directorateId });
    }
  }

  return merged.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
}

/**
 * Returns ALL blocked holiday or exam periods covering a target date (YYYY-MM-DD)
 * for the given educational cycle(s).
 */
export function findAllBlockedPeriodsForDate(
  dateStr: string,
  matchCycles: string[],
  periods: BlockedSchedulePeriod[]
): BlockedSchedulePeriod[] {
  const ymd = normalizeDateToYmd(dateStr);
  if (!ymd || !Array.isArray(periods) || periods.length === 0) return [];

  const matches: BlockedSchedulePeriod[] = [];
  for (const period of periods) {
    const start = normalizeDateToYmd(period.startDate) || period.startDate;
    const end = normalizeDateToYmd(period.endDate || period.startDate) || period.endDate || start;
    if (!start || !end) continue;

    if (ymd >= start && ymd <= end) {
      const targets = Array.isArray(period.targetCycles) && period.targetCycles.length > 0
        ? period.targetCycles
        : (['ALL'] as EducationalCycleKey[]);
      if (matchCycles.includes('ALL') || targets.includes('ALL') || matchCycles.some(c => targets.includes(c as EducationalCycleKey))) {
        matches.push(period);
      }
    }
  }

  return matches;
}

/**
 * Checks whether a target date (YYYY-MM-DD) falls inside any blocked holiday or exam period
 * for the given educational cycle(s), prioritizing strict school holidays.
 */
export function findBlockedPeriodForDate(
  dateStr: string,
  matchCycles: string[],
  periods: BlockedSchedulePeriod[]
): BlockedSchedulePeriod | null {
  const all = findAllBlockedPeriodsForDate(dateStr, matchCycles, periods);
  if (all.length === 0) return null;
  return all.find(p => p.type === 'holiday') || all[0];
}

export function resolveEffectiveAffiliationMode(
  config: AffiliationDisplayConfig | null | undefined,
  sportId?: string
): AffiliationDisplayMode {
  if (!config) return 'both';
  if (sportId && config.sportModes && config.sportModes[sportId]) {
    const sm = config.sportModes[sportId];
    if (sm === 'both' || sm === 'non_club' || sm === 'club_affiliated') {
      return sm;
    }
  }
  if (config.globalMode === 'non_club' || config.globalMode === 'club_affiliated') {
    return config.globalMode;
  }
  return 'both';
}

export function isAffiliationAllowedByDisplayConfig(
  affiliationType: string | undefined,
  config: AffiliationDisplayConfig | null | undefined,
  sportId?: string
): boolean {
  const mode = resolveEffectiveAffiliationMode(config, sportId);
  if (mode === 'both') return true;
  const aff = (affiliationType || 'non_club').trim();
  if (aff === 'open') return true;
  if (mode === 'non_club') return aff !== 'club_affiliated';
  if (mode === 'club_affiliated') return aff === 'club_affiliated';
  return true;
}




