import {
  INITIAL_ATHLETICS_COMMITTEES,
  INITIAL_ATHLETICS_DISCIPLINES,
  AthleticsCommitteeDef,
  AthleticsDisciplineDef,
  AthleticsCommitteeAssignment,
  CommitteeTeacherMember,
  AthleticsParticipantRecord,
  AthleticsEventResult,
  TrackRankEntry,
  FieldAttemptEntry
} from './athleticsConfig';
import { User, Student, School } from '../types';

const STORAGE_KEYS = {
  COMMITTEES_DEF: 'school_athletics_committees_def_v2',
  DISCIPLINES_DEF: 'school_athletics_disciplines_def_v2',
  COMMITTEE_ASSIGNMENTS: 'school_athletics_committee_assignments_v2',
  PARTICIPANTS: 'school_athletics_participants_v2',
  RESULTS: 'school_athletics_results_v2'
};

export class AthleticsService {
  // 1. Disciplines List (Custom + Built-in)
  static getDisciplines(): AthleticsDisciplineDef[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DISCIPLINES_DEF);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse athletics disciplines:', e);
    }
    return INITIAL_ATHLETICS_DISCIPLINES;
  }

  static saveDisciplines(disciplines: AthleticsDisciplineDef[]): void {
    localStorage.setItem(STORAGE_KEYS.DISCIPLINES_DEF, JSON.stringify(disciplines));
    window.dispatchEvent(new CustomEvent('athleticsDisciplinesChanged', { detail: disciplines }));
  }

  static addDiscipline(discipline: Omit<AthleticsDisciplineDef, 'id'>): AthleticsDisciplineDef {
    const list = this.getDisciplines();
    const newDisc: AthleticsDisciplineDef = {
      ...discipline,
      id: `custom_disc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      isCustom: true
    };
    list.push(newDisc);
    this.saveDisciplines(list);
    return newDisc;
  }

  static deleteDiscipline(disciplineId: string): void {
    const list = this.getDisciplines().filter(d => d.id !== disciplineId);
    this.saveDisciplines(list);
  }

  // 2. Committees List (Custom + Built-in)
  static getCommittees(): AthleticsCommitteeDef[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMMITTEES_DEF);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse athletics committees:', e);
    }
    return INITIAL_ATHLETICS_COMMITTEES;
  }

  static saveCommittees(committees: AthleticsCommitteeDef[]): void {
    localStorage.setItem(STORAGE_KEYS.COMMITTEES_DEF, JSON.stringify(committees));
    window.dispatchEvent(new CustomEvent('athleticsCommitteesChanged', { detail: committees }));
  }

  // 3. Committees Assignments & Teachers Tasks
  static getCommitteeAssignments(): Record<string, AthleticsCommitteeAssignment> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMMITTEE_ASSIGNMENTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse committee assignments:', e);
    }
    // Default initial mock/fallback assignments with role tasks
    return {
      sprint_committee: {
        committeeId: 'sprint_committee',
        teacherId: 'tch-default-1',
        teacherName: 'ذ. عبد الرحيم بلقاسم',
        teacherSchool: 'ثانوية الفتح التأهيلية',
        teacherPhone: '0661122334',
        members: [
          {
            teacherId: 'tch-default-1',
            teacherName: 'ذ. عبد الرحيم بلقاسم',
            schoolName: 'ثانوية الفتح التأهيلية',
            phone: '0661122334',
            roleInCommittee: 'رئيس اللجنة'
          },
          {
            teacherId: 'tch-default-1b',
            teacherName: 'ذ. كريم الإدريسي',
            schoolName: 'ثانوية الفتح التأهيلية',
            phone: '0661998877',
            roleInCommittee: 'حكم خط النهاية (Juge d\'arrivée)'
          }
        ],
        updatedAt: new Date().toISOString()
      },
      middle_distance_committee: {
        committeeId: 'middle_distance_committee',
        teacherId: 'tch-default-2',
        teacherName: 'ذ. محمد المنصوري',
        teacherSchool: 'إعدادية علال الفاسي',
        teacherPhone: '0662233445',
        members: [
          {
            teacherId: 'tch-default-2',
            teacherName: 'ذ. محمد المنصوري',
            schoolName: 'إعدادية علال الفاسي',
            phone: '0662233445',
            roleInCommittee: 'رئيس اللجنة'
          }
        ],
        updatedAt: new Date().toISOString()
      },
      long_jump_committee: {
        committeeId: 'long_jump_committee',
        teacherId: 'tch-default-3',
        teacherName: 'ذة. فاطمة الزهراء الإدريسي',
        teacherSchool: 'مدرسة ابن خلدون الابتدائية',
        teacherPhone: '0663344556',
        members: [
          {
            teacherId: 'tch-default-3',
            teacherName: 'ذة. فاطمة الزهراء الإدريسي',
            schoolName: 'مدرسة ابن خلدون الابتدائية',
            phone: '0663344556',
            roleInCommittee: 'رئيسة اللجنة وقاضية القياس'
          }
        ],
        updatedAt: new Date().toISOString()
      },
      shot_put_committee: {
        committeeId: 'shot_put_committee',
        teacherId: 'tch-default-4',
        teacherName: 'ذ. رشيد الحسيني',
        teacherSchool: 'ثانوية صلاح الدين الأيوبي',
        teacherPhone: '0664455667',
        members: [
          {
            teacherId: 'tch-default-4',
            teacherName: 'ذ. رشيد الحسيني',
            schoolName: 'ثانوية صلاح الدين الأيوبي',
            phone: '0664455667',
            roleInCommittee: 'رئيس اللجنة وقاضي الرمي'
          }
        ],
        updatedAt: new Date().toISOString()
      }
    };
  }

  static saveCommitteeAssignment(assignment: AthleticsCommitteeAssignment): void {
    const current = this.getCommitteeAssignments();
    current[assignment.committeeId] = {
      ...assignment,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.COMMITTEE_ASSIGNMENTS, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent('athleticsCommitteeUpdated', { detail: current }));
  }

  // 4. Role-based Permission Check (Security & Access Control)
  static canUserManageCommittee(
    userProfile: User | null | undefined,
    committeeId: string,
    assignments?: Record<string, AthleticsCommitteeAssignment>
  ): { canManage: boolean; reason?: string } {
    if (!userProfile) {
      return { canManage: false, reason: 'يرجى تسجيل الدخول أولاً للتحكيم' };
    }

    // Central admin, Super admin, Technical Committee Head, or Sport Manager have full access
    if (
      userProfile.role === 'CENTRAL_ADMIN' ||
      userProfile.isSuperAdmin ||
      userProfile.role === 'SPORT_MANAGER' ||
      userProfile.isTechCommitteeHead
    ) {
      return { canManage: true };
    }

    const currentAssignments = assignments || this.getCommitteeAssignments();
    const assignment = currentAssignments[committeeId];

    if (!assignment) {
      return { canManage: true }; // Open if unassigned or fallback
    }

    // Match by teacher ID or name or email
    const isHead = assignment.teacherId === userProfile.id || assignment.teacherName === userProfile.fullName;
    const isMember = assignment.members?.some(
      m => m.teacherId === userProfile.id || m.teacherName === userProfile.fullName
    );

    if (isHead || isMember) {
      return { canManage: true };
    }

    return {
      canManage: false,
      reason: `عذراً، هذه اللجنة مخصصة للأستاذ المسؤول (${assignment.teacherName}) وأعضاء لجنته فقط، ولا تملك صلاحية تعديل بياناتها.`
    };
  }

  // 5. Participants Management & Auto-Import from System
  static getParticipants(): AthleticsParticipantRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PARTICIPANTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse athletics participants:', e);
    }
    const initial: AthleticsParticipantRecord[] = [
      {
        id: 'ath-part-1',
        disciplineId: 'sprint_100m',
        category: 'U18',
        gender: 'Male',
        bibNumber: '101',
        studentName: 'ياسين الفيلالي',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2008',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-part-2',
        disciplineId: 'sprint_100m',
        category: 'U18',
        gender: 'Male',
        bibNumber: '102',
        studentName: 'أمين العمراني',
        schoolName: 'ثانوية صلاح الدين الأيوبي',
        birthYear: '2008',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-part-3',
        disciplineId: 'sprint_100m',
        category: 'U18',
        gender: 'Male',
        bibNumber: '103',
        studentName: 'حمزة التازي',
        schoolName: 'مؤسسة النخبة الخاصة',
        birthYear: '2009',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-part-4',
        disciplineId: 'sprint_100m',
        category: 'U18',
        gender: 'Male',
        bibNumber: '104',
        studentName: 'سفيان البوشيخي',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2008',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-part-5',
        disciplineId: 'long_jump',
        category: 'U15',
        gender: 'Male',
        bibNumber: '201',
        studentName: 'عمر القاسمي',
        schoolName: 'إعدادية علال الفاسي',
        birthYear: '2010',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-part-6',
        disciplineId: 'shot_put',
        category: 'U18',
        gender: 'Male',
        bibNumber: '301',
        studentName: 'بلال اليعقوبي',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2008',
        createdAt: new Date().toISOString()
      }
    ];
    this.saveParticipants(initial);
    return initial;
  }

  static saveParticipants(participants: AthleticsParticipantRecord[]): void {
    localStorage.setItem(STORAGE_KEYS.PARTICIPANTS, JSON.stringify(participants));
    window.dispatchEvent(new CustomEvent('athleticsParticipantsUpdated', { detail: participants }));
  }

  static addParticipant(participant: Omit<AthleticsParticipantRecord, 'id' | 'createdAt'>): AthleticsParticipantRecord {
    const participants = this.getParticipants();
    const newRecord: AthleticsParticipantRecord = {
      ...participant,
      id: `ath-part-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString()
    };
    participants.push(newRecord);
    this.saveParticipants(participants);
    return newRecord;
  }

  static updateParticipant(id: string, updates: Partial<AthleticsParticipantRecord>): AthleticsParticipantRecord | null {
    const participants = this.getParticipants();
    const index = participants.findIndex(p => p.id === id);
    if (index === -1) return null;
    participants[index] = { ...participants[index], ...updates };
    this.saveParticipants(participants);
    return participants[index];
  }

  static deleteParticipant(id: string): void {
    const participants = this.getParticipants().filter(p => p.id !== id);
    this.saveParticipants(participants);
  }

  // Auto-import registered students from database into Athletics disciplines
  static autoImportSystemStudents(
    students: Student[],
    schools: School[]
  ): { importedCount: number; updatedParticipants: AthleticsParticipantRecord[] } {
    const current = this.getParticipants();
    const existingIds = new Set(current.map(p => p.studentId || `${p.studentName}_${p.schoolName}_${p.disciplineId}`));
    const disciplines = this.getDisciplines();

    let count = 0;
    const schoolMap = new Map(schools.map(s => [s.id, s.name]));

    for (const student of students) {
      // Check if student belongs to athletics or cross country or has a category
      const sportMatch =
        student.sportId === 'athletics' ||
        student.sportId === 'cross_country' ||
        student.sportId === 'track_field' ||
        !student.sportId;

      if (!sportMatch && student.sportId !== 'general') continue;

      const rawCat = (student.category || '').toUpperCase();
      let normCat: 'U12' | 'U15' | 'U18' | 'U20' = 'U15';
      if (rawCat.includes('12') || rawCat.includes('براعم')) normCat = 'U12';
      else if (rawCat.includes('15') || rawCat.includes('صغار')) normCat = 'U15';
      else if (rawCat.includes('18') || rawCat.includes('فتيان')) normCat = 'U18';
      else if (rawCat.includes('20') || rawCat.includes('شبان')) normCat = 'U20';

      const rawGen = (student.gender || '').toLowerCase();
      const normGen: 'Male' | 'Female' = (rawGen.includes('f') || rawGen.includes('أنثى') || rawGen.includes('انثى') || rawGen.includes('إناث')) ? 'Female' : 'Male';

      const schoolName = student.schoolName || (student.schoolId ? schoolMap.get(student.schoolId) : '') || 'المؤسسة التعليمية';

      // Find compatible default sprint and field disciplines
      const targetDiscipline = disciplines.find(d => 
        d.allowedCategories.includes(normCat) && d.allowedGenders.includes(normGen)
      ) || disciplines[0];

      if (!targetDiscipline) continue;

      const key = `${student.id || student.fullName}_${schoolName}_${targetDiscipline.id}`;
      if (!existingIds.has(key) && !existingIds.has(student.id)) {
        current.push({
          id: `ath-imp-${student.id || Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
          disciplineId: targetDiscipline.id,
          category: normCat,
          gender: normGen,
          bibNumber: student.bibNumber ? String(student.bibNumber) : `${100 + current.length}`,
          studentName: student.fullName,
          schoolName,
          birthYear: student.birthDate ? String(new Date(student.birthDate).getFullYear()) : '2008',
          studentId: student.id,
          isAutoImported: true,
          createdAt: new Date().toISOString()
        });
        existingIds.add(key);
        count++;
      }
    }

    this.saveParticipants(current);
    return { importedCount: count, updatedParticipants: current };
  }

  // 6. Results
  static getAllResults(): Record<string, AthleticsEventResult> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.RESULTS);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse athletics results:', e);
    }
    return {};
  }

  static getResultForEvent(disciplineId: string, category: string, gender: string): AthleticsEventResult | null {
    const all = this.getAllResults();
    const key = `${disciplineId}_${category}_${gender}`;
    return all[key] || null;
  }

  static saveEventResult(result: AthleticsEventResult): void {
    const all = this.getAllResults();
    all[result.id] = {
      ...result,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('athleticsResultsUpdated', { detail: all }));
    window.dispatchEvent(new CustomEvent('resultsChanged'));
  }

  static formatMilliseconds(ms: number): string {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    const hundredths = Math.floor((ms % 1000) / 10);
    if (minutes > 0) {
      return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
    }
    return `${String(seconds).padStart(2, '0')}.${String(hundredths).padStart(2, '0')}`;
  }
}
