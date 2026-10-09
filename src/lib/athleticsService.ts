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
  FieldAttemptEntry,
  AthleticsAttendanceRecord
} from './athleticsConfig';
import { User, Student, School } from '../types';

const STORAGE_KEYS = {
  COMMITTEES_DEF: 'school_athletics_committees_def_v2',
  DISCIPLINES_DEF: 'school_athletics_disciplines_def_v2',
  COMMITTEE_ASSIGNMENTS: 'school_athletics_committee_assignments_v2',
  PARTICIPANTS: 'school_athletics_participants_v2',
  RESULTS: 'school_athletics_results_v2',
  ATTENDANCE: 'school_athletics_attendance_v2'
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
      if (data) {
        const parsed: AthleticsCommitteeDef[] = JSON.parse(data);
        // Ensure podium_committee exists
        const hasPodium = parsed.some(c => c.id === 'podium_committee');
        let updated = parsed;
        if (!hasPodium) {
          const podiumDef = INITIAL_ATHLETICS_COMMITTEES.find(c => c.id === 'podium_committee');
          if (podiumDef) {
            updated = [...parsed, podiumDef];
          }
        }
        // Ensure permissions property exists for all committees
        updated = updated.map(c => {
          if (!c.permissions) {
            const initial = INITIAL_ATHLETICS_COMMITTEES.find(ic => ic.id === c.id);
            return {
              ...c,
              permissions: initial?.permissions || {
                allowedTabs: ['events', 'committees'],
                allowedDisciplineIds: c.disciplines || [],
                canRecordResults: true,
                canValidateResults: true,
                canPrintReports: true,
                canExportData: true
              }
            };
          }
          return c;
        });
        return updated;
      }
    } catch (e) {
      console.error('Failed to parse athletics committees:', e);
    }
    return INITIAL_ATHLETICS_COMMITTEES;
  }

  static saveCommittees(committees: AthleticsCommitteeDef[]): void {
    localStorage.setItem(STORAGE_KEYS.COMMITTEES_DEF, JSON.stringify(committees));
    window.dispatchEvent(new CustomEvent('athleticsCommitteesChanged', { detail: committees }));
  }

  static updateCommitteePermissions(
    committeeId: string,
    permissions: import('./athleticsConfig').AthleticsCommitteePermissions
  ): AthleticsCommitteeDef | null {
    const list = this.getCommittees();
    const idx = list.findIndex(c => c.id === committeeId);
    if (idx === -1) return null;
    list[idx] = {
      ...list[idx],
      permissions
    };
    this.saveCommittees(list);
    return list[idx];
  }

  // 3. Committees Assignments & Teachers Tasks
  static getCommitteeAssignments(): Record<string, AthleticsCommitteeAssignment> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMMITTEE_ASSIGNMENTS);
      if (data) {
        const parsed = JSON.parse(data);
        if (!parsed.podium_committee) {
          parsed.podium_committee = {
            committeeId: 'podium_committee',
            teacherId: 'tch-default-5',
            teacherName: 'ذ. يوسف الشرايبي',
            teacherSchool: 'ثانوية الفتح التأهيلية',
            teacherPhone: '0665566778',
            members: [
              {
                teacherId: 'tch-default-5',
                teacherName: 'ذ. يوسف الشرايبي',
                schoolName: 'ثانوية الفتح التأهيلية',
                phone: '0665566778',
                roleInCommittee: 'رئيس لجنة التتويج والمراسيم'
              },
              {
                teacherId: 'tch-default-5b',
                teacherName: 'ذة. حسناء الودغيري',
                schoolName: 'ثانوية الفتح التأهيلية',
                phone: '0665991122',
                roleInCommittee: 'مكلفة بالميداليات والشواهد الرسمية'
              }
            ],
            updatedAt: new Date().toISOString()
          };
        }
        return parsed;
      }
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
      },
      podium_committee: {
        committeeId: 'podium_committee',
        teacherId: 'tch-default-5',
        teacherName: 'ذ. يوسف الشرايبي',
        teacherSchool: 'ثانوية الفتح التأهيلية',
        teacherPhone: '0665566778',
        members: [
          {
            teacherId: 'tch-default-5',
            teacherName: 'ذ. يوسف الشرايبي',
            schoolName: 'ثانوية الفتح التأهيلية',
            phone: '0665566778',
            roleInCommittee: 'رئيس لجنة التتويج والمراسيم'
          },
          {
            teacherId: 'tch-default-5b',
            teacherName: 'ذة. حسناء الودغيري',
            schoolName: 'ثانوية الفتح التأهيلية',
            phone: '0665991122',
            roleInCommittee: 'مكلفة بالميداليات والشواهد الرسمية'
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

  static deleteEventResult(resultId: string): void {
    const all = this.getAllResults();
    if (all[resultId]) {
      delete all[resultId];
      localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent('athleticsResultsUpdated', { detail: all }));
      window.dispatchEvent(new CustomEvent('resultsChanged'));
    }
  }

  // 6.5. Attendance & Roll Call Management (غرفة المناداة وتأكيد الحضور)
  static getAllAttendance(): Record<string, Record<string, AthleticsAttendanceRecord>> {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse athletics attendance:', e);
    }
    return {};
  }

  static getAttendanceForEvent(eventKey: string): Record<string, AthleticsAttendanceRecord> {
    const all = this.getAllAttendance();
    return all[eventKey] || {};
  }

  static saveAttendanceForEvent(eventKey: string, records: Record<string, AthleticsAttendanceRecord>): void {
    const all = this.getAllAttendance();
    all[eventKey] = records;
    localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(all));
    window.dispatchEvent(new CustomEvent('athleticsAttendanceUpdated', { detail: { eventKey, records } }));
  }

  static setParticipantAttendance(
    eventKey: string,
    participantId: string,
    status: 'present' | 'absent' | 'pending',
    lane?: number,
    notes?: string
  ): void {
    const records = this.getAttendanceForEvent(eventKey);
    records[participantId] = {
      participantId,
      status,
      lane: lane !== undefined ? lane : records[participantId]?.lane,
      checkInTime: new Date().toISOString(),
      notes: notes !== undefined ? notes : records[participantId]?.notes
    };
    this.saveAttendanceForEvent(eventKey, records);
  }

  static markAllAttendanceForEvent(
    eventKey: string,
    participantIds: string[],
    status: 'present' | 'absent'
  ): void {
    const records = this.getAttendanceForEvent(eventKey);
    participantIds.forEach((pId, idx) => {
      records[pId] = {
        participantId: pId,
        status,
        lane: records[pId]?.lane || (idx + 1),
        checkInTime: new Date().toISOString()
      };
    });
    this.saveAttendanceForEvent(eventKey, records);
  }

  static clearAttendanceForEvent(eventKey: string): void {
    const all = this.getAllAttendance();
    if (all[eventKey]) {
      delete all[eventKey];
      localStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(all));
      window.dispatchEvent(new CustomEvent('athleticsAttendanceUpdated', { detail: { eventKey, records: {} } }));
    }
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

  // 7. Generate & Seed Realistic Default Mock Data (بيانات افتراضية نموذجية)
  static loadDefaultMockData(): {
    participantsCount: number;
    committeesCount: number;
    disciplinesCount: number;
  } {
    // 1. Reset Disciplines to full official set
    this.saveDisciplines(INITIAL_ATHLETICS_DISCIPLINES);

    // 2. Reset Committees
    this.saveCommittees(INITIAL_ATHLETICS_COMMITTEES);

    // 3. Rich Default Committee Assignments with real teachers and tasks
    const defaultAssignments: Record<string, AthleticsCommitteeAssignment> = {
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
          },
          {
            teacherId: 'tch-default-1c',
            teacherName: 'ذ. سمير بنجلون',
            schoolName: 'مؤسسة النخبة الخاصة',
            phone: '0661334455',
            roleInCommittee: 'حكم الانطلاق (Starter)'
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
          },
          {
            teacherId: 'tch-default-2b',
            teacherName: 'ذ. عثمان التازي',
            schoolName: 'إعدادية علال الفاسي',
            phone: '0662778899',
            roleInCommittee: 'مسجل المراتب والتوقيت (Chronométreur)'
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
          },
          {
            teacherId: 'tch-default-3b',
            teacherName: 'ذة. مريم الصالحي',
            schoolName: 'مدرسة ابن خلدون الابتدائية',
            phone: '0663889900',
            roleInCommittee: 'قاضية المحاولات والراية (Juge de concours)'
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
          },
          {
            teacherId: 'tch-default-4b',
            teacherName: 'ذ. طارق العلمي',
            schoolName: 'ثانوية صلاح الدين الأيوبي',
            phone: '0664112233',
            roleInCommittee: 'مكلف بالأمانة والنتائج (Secrétariat)'
          }
        ],
        updatedAt: new Date().toISOString()
      },
      podium_committee: {
        committeeId: 'podium_committee',
        teacherId: 'tch-default-5',
        teacherName: 'ذ. يوسف الشرايبي',
        teacherSchool: 'ثانوية الفتح التأهيلية',
        teacherPhone: '0665566778',
        members: [
          {
            teacherId: 'tch-default-5',
            teacherName: 'ذ. يوسف الشرايبي',
            schoolName: 'ثانوية الفتح التأهيلية',
            phone: '0665566778',
            roleInCommittee: 'رئيس لجنة التتويج والمراسيم'
          },
          {
            teacherId: 'tch-default-5b',
            teacherName: 'ذة. حسناء الودغيري',
            schoolName: 'ثانوية الفتح التأهيلية',
            phone: '0665991122',
            roleInCommittee: 'مكلفة بالميداليات والشواهد الرسمية'
          }
        ],
        updatedAt: new Date().toISOString()
      }
    };
    localStorage.setItem(STORAGE_KEYS.COMMITTEE_ASSIGNMENTS, JSON.stringify(defaultAssignments));
    window.dispatchEvent(new CustomEvent('athleticsCommitteeUpdated', { detail: defaultAssignments }));

    // 4. Comprehensive Default Participants Roster (20 Moroccan student athletes)
    const mockParticipants: AthleticsParticipantRecord[] = [
      // Fath High School (U18 & U20)
      {
        id: 'ath-demo-1',
        disciplineId: 'sprint_100m',
        secondDisciplineId: 'long_jump',
        category: 'U18',
        gender: 'Male',
        bibNumber: '101',
        studentName: 'ياسين الفيلالي',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2008',
        birthDate: '2008-03-15',
        massarNumber: 'F132890432',
        affiliationType: 'non_club',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661122334',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-2',
        disciplineId: 'sprint_100m',
        secondDisciplineId: 'sprint_200m',
        category: 'U18',
        gender: 'Female',
        bibNumber: '102',
        studentName: 'أميمة بلحسن',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2008',
        birthDate: '2008-06-22',
        massarNumber: 'F139045612',
        affiliationType: 'non_club',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661122334',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-3',
        disciplineId: 'middle_1500m',
        secondDisciplineId: 'middle_800m',
        category: 'U18',
        gender: 'Male',
        bibNumber: '104',
        studentName: 'سفيان البوشيخي',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2008',
        birthDate: '2008-11-05',
        massarNumber: 'F138901234',
        affiliationType: 'club_affiliated',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661122334',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-4',
        disciplineId: 'shot_put',
        secondDisciplineId: 'discus_throw',
        category: 'U18',
        gender: 'Male',
        bibNumber: '301',
        studentName: 'بلال اليعقوبي',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2008',
        birthDate: '2008-02-28',
        massarNumber: 'F135678901',
        affiliationType: 'non_club',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661122334',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-5',
        disciplineId: 'sprint_200m',
        secondDisciplineId: 'middle_400m',
        category: 'U20',
        gender: 'Male',
        bibNumber: '501',
        studentName: 'رضا الوردي',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2006',
        birthDate: '2006-05-12',
        massarNumber: 'F121234567',
        affiliationType: 'non_club',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661122334',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-6',
        disciplineId: 'triple_jump',
        secondDisciplineId: 'long_jump',
        category: 'U20',
        gender: 'Male',
        bibNumber: '503',
        studentName: 'معاد الناصري',
        schoolName: 'ثانوية الفتح التأهيلية',
        birthYear: '2005',
        birthDate: '2005-12-14',
        massarNumber: 'F123456789',
        affiliationType: 'club_affiliated',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661122334',
        createdAt: new Date().toISOString()
      },

      // Salah Eddine High School
      {
        id: 'ath-demo-7',
        disciplineId: 'sprint_100m',
        secondDisciplineId: 'sprint_200m',
        category: 'U18',
        gender: 'Male',
        bibNumber: '103',
        studentName: 'أمين العمراني',
        schoolName: 'ثانوية صلاح الدين الأيوبي',
        birthYear: '2008',
        birthDate: '2008-01-10',
        massarNumber: 'F134590123',
        affiliationType: 'club_affiliated',
        coachName: 'ذ. رشيد الحسيني',
        coachPhone: '0664455667',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-8',
        disciplineId: 'middle_800m',
        secondDisciplineId: 'middle_400m',
        category: 'U18',
        gender: 'Female',
        bibNumber: '106',
        studentName: 'فاطمة الزهراء بنعلي',
        schoolName: 'ثانوية صلاح الدين الأيوبي',
        birthYear: '2008',
        birthDate: '2008-04-12',
        massarNumber: 'F136789012',
        affiliationType: 'non_club',
        coachName: 'ذ. رشيد الحسيني',
        coachPhone: '0664455667',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-9',
        disciplineId: 'middle_1500m',
        secondDisciplineId: 'middle_800m',
        category: 'U20',
        gender: 'Female',
        bibNumber: '502',
        studentName: 'خديجة برادة',
        schoolName: 'ثانوية صلاح الدين الأيوبي',
        birthYear: '2006',
        birthDate: '2006-09-08',
        massarNumber: 'F122345678',
        affiliationType: 'non_club',
        coachName: 'ذ. رشيد الحسيني',
        coachPhone: '0664455667',
        createdAt: new Date().toISOString()
      },

      // Allal El Fassi Middle School (U15)
      {
        id: 'ath-demo-10',
        disciplineId: 'sprint_80m',
        secondDisciplineId: 'long_jump',
        category: 'U15',
        gender: 'Male',
        bibNumber: '201',
        studentName: 'عمر القاسمي',
        schoolName: 'إعدادية علال الفاسي',
        birthYear: '2011',
        birthDate: '2011-05-14',
        massarNumber: 'F141234567',
        affiliationType: 'non_club',
        coachName: 'ذ. محمد المنصوري',
        coachPhone: '0662233445',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-11',
        disciplineId: 'sprint_80m',
        secondDisciplineId: 'middle_600m',
        category: 'U15',
        gender: 'Female',
        bibNumber: '202',
        studentName: 'مريم الشاوي',
        schoolName: 'إعدادية علال الفاسي',
        birthYear: '2011',
        birthDate: '2011-09-30',
        massarNumber: 'F142345678',
        affiliationType: 'non_club',
        coachName: 'ذ. محمد المنصوري',
        coachPhone: '0662233445',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-12',
        disciplineId: 'long_jump',
        secondDisciplineId: 'sprint_80m',
        category: 'U15',
        gender: 'Male',
        bibNumber: '203',
        studentName: 'أيوب البوعناني',
        schoolName: 'إعدادية علال الفاسي',
        birthYear: '2010',
        birthDate: '2010-12-08',
        massarNumber: 'F143456789',
        affiliationType: 'non_club',
        coachName: 'ذ. محمد المنصوري',
        coachPhone: '0662233445',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-13',
        disciplineId: 'long_jump',
        secondDisciplineId: 'sprint_80m',
        category: 'U15',
        gender: 'Female',
        bibNumber: '204',
        studentName: 'هدى الإدريسي',
        schoolName: 'إعدادية علال الفاسي',
        birthYear: '2011',
        birthDate: '2011-03-21',
        massarNumber: 'F144567890',
        affiliationType: 'non_club',
        coachName: 'ذ. محمد المنصوري',
        coachPhone: '0662233445',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-14',
        disciplineId: 'middle_1000m',
        secondDisciplineId: 'middle_600m',
        category: 'U15',
        gender: 'Male',
        bibNumber: '205',
        studentName: 'أنس الشرقاوي',
        schoolName: 'إعدادية علال الفاسي',
        birthYear: '2010',
        birthDate: '2010-07-16',
        massarNumber: 'F145678901',
        affiliationType: 'club_affiliated',
        coachName: 'ذ. محمد المنصوري',
        coachPhone: '0662233445',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-15',
        disciplineId: 'shot_put',
        category: 'U15',
        gender: 'Female',
        bibNumber: '206',
        studentName: 'سارة المنصوري',
        schoolName: 'إعدادية علال الفاسي',
        birthYear: '2011',
        birthDate: '2011-08-05',
        massarNumber: 'F146789012',
        affiliationType: 'non_club',
        coachName: 'ذ. محمد المنصوري',
        coachPhone: '0662233445',
        createdAt: new Date().toISOString()
      },

      // Ibn Khaldoun Primary School (U12)
      {
        id: 'ath-demo-16',
        disciplineId: 'sprint_60m',
        secondDisciplineId: 'long_jump',
        category: 'U12',
        gender: 'Male',
        bibNumber: '401',
        studentName: 'آدم الصالحي',
        schoolName: 'مدرسة ابن خلدون',
        birthYear: '2014',
        birthDate: '2014-04-18',
        massarNumber: 'F151234567',
        affiliationType: 'non_club',
        coachName: 'ذة. فاطمة الزهراء الإدريسي',
        coachPhone: '0663344556',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-17',
        disciplineId: 'sprint_60m',
        secondDisciplineId: 'middle_600m',
        category: 'U12',
        gender: 'Female',
        bibNumber: '402',
        studentName: 'ملاك الرحماني',
        schoolName: 'مدرسة ابن خلدون',
        birthYear: '2014',
        birthDate: '2014-07-25',
        massarNumber: 'F152345678',
        affiliationType: 'non_club',
        coachName: 'ذة. فاطمة الزهراء الإدريسي',
        coachPhone: '0663344556',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-18',
        disciplineId: 'middle_600m',
        category: 'U12',
        gender: 'Male',
        bibNumber: '403',
        studentName: 'إلياس بنجلون',
        schoolName: 'مدرسة ابن خلدون',
        birthYear: '2013',
        birthDate: '2013-11-10',
        massarNumber: 'F153456789',
        affiliationType: 'non_club',
        coachName: 'ذة. فاطمة الزهراء الإدريسي',
        coachPhone: '0663344556',
        createdAt: new Date().toISOString()
      },
      {
        id: 'ath-demo-19',
        disciplineId: 'long_jump',
        secondDisciplineId: 'sprint_60m',
        category: 'U12',
        gender: 'Female',
        bibNumber: '404',
        studentName: 'دعاء العلمي',
        schoolName: 'مدرسة ابن خلدون',
        birthYear: '2014',
        birthDate: '2014-01-30',
        massarNumber: 'F154567890',
        affiliationType: 'non_club',
        coachName: 'ذة. فاطمة الزهراء الإدريسي',
        coachPhone: '0663344556',
        createdAt: new Date().toISOString()
      },

      // Elite Private School
      {
        id: 'ath-demo-20',
        disciplineId: 'sprint_100m',
        secondDisciplineId: 'shot_put',
        category: 'U18',
        gender: 'Male',
        bibNumber: '105',
        studentName: 'حمزة التازي',
        schoolName: 'مؤسسة النخبة الخاصة',
        birthYear: '2008',
        birthDate: '2008-08-19',
        massarNumber: 'F137890456',
        affiliationType: 'non_club',
        coachName: 'ذ. سمير بنجلون',
        coachPhone: '0661334455',
        createdAt: new Date().toISOString()
      }
    ];
    this.saveParticipants(mockParticipants);

    // 5. Sample Live/Completed Event Results for Demo
    const sampleResults: Record<string, AthleticsEventResult> = {
      'sprint_100m_U18_Male': {
        id: 'sprint_100m_U18_Male',
        disciplineId: 'sprint_100m',
        category: 'U18',
        gender: 'Male',
        committeeId: 'sprint_committee',
        type: 'track',
        status: 'completed',
        trackLaps: [
          {
            rank: 1,
            timeMs: 11420,
            formattedTime: '00:11.42',
            participantId: 'ath-demo-1',
            bibNumber: '101',
            studentName: 'ياسين الفيلالي',
            schoolName: 'ثانوية الفتح التأهيلية',
            confirmed: true
          },
          {
            rank: 2,
            timeMs: 11680,
            formattedTime: '00:11.68',
            participantId: 'ath-demo-7',
            bibNumber: '103',
            studentName: 'أمين العمراني',
            schoolName: 'ثانوية صلاح الدين الأيوبي',
            confirmed: true
          },
          {
            rank: 3,
            timeMs: 11950,
            formattedTime: '00:11.95',
            participantId: 'ath-demo-20',
            bibNumber: '105',
            studentName: 'حمزة التازي',
            schoolName: 'مؤسسة النخبة الخاصة',
            confirmed: true
          },
          {
            rank: 4,
            timeMs: 12300,
            formattedTime: '00:12.30',
            participantId: 'ath-demo-3',
            bibNumber: '104',
            studentName: 'سفيان البوشيخي',
            schoolName: 'ثانوية الفتح التأهيلية',
            confirmed: true
          }
        ],
        recordedByTeacherName: 'ذ. عبد الرحيم بلقاسم',
        directorateName: 'المديرية الإقليمية تاوريرت',
        season: '2026/2027',
        lastUpdated: new Date().toISOString()
      },
      'long_jump_U15_Male': {
        id: 'long_jump_U15_Male',
        disciplineId: 'long_jump',
        category: 'U15',
        gender: 'Male',
        committeeId: 'long_jump_committee',
        type: 'field',
        status: 'completed',
        fieldEntries: [
          {
            participantId: 'ath-demo-10',
            bibNumber: '201',
            studentName: 'عمر القاسمي',
            schoolName: 'إعدادية علال الفاسي',
            attempts: [4.90, 5.15, 5.05],
            bestAttempt: 5.15,
            rank: 1
          },
          {
            participantId: 'ath-demo-12',
            bibNumber: '203',
            studentName: 'أيوب البوعناني',
            schoolName: 'إعدادية علال الفاسي',
            attempts: [4.60, 4.85, 'X'],
            bestAttempt: 4.85,
            rank: 2
          },
          {
            participantId: 'ath-demo-14',
            bibNumber: '205',
            studentName: 'أنس الشرقاوي',
            schoolName: 'إعدادية علال الفاسي',
            attempts: [4.40, 'X', 4.55],
            bestAttempt: 4.55,
            rank: 3
          }
        ],
        recordedByTeacherName: 'ذة. فاطمة الزهراء الإدريسي',
        directorateName: 'المديرية الإقليمية تاوريرت',
        season: '2026/2027',
        lastUpdated: new Date().toISOString()
      }
    };
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(sampleResults));
    window.dispatchEvent(new CustomEvent('athleticsResultsUpdated', { detail: sampleResults }));
    window.dispatchEvent(new CustomEvent('resultsChanged'));

    return {
      participantsCount: mockParticipants.length,
      committeesCount: INITIAL_ATHLETICS_COMMITTEES.length,
      disciplinesCount: INITIAL_ATHLETICS_DISCIPLINES.length
    };
  }

  static loadDefaultSchoolData(schoolName: string): { participantsCount: number } {
    const current = this.getParticipants();
    const disciplines = this.getDisciplines();
    
    // Generate 12-15 mock students for this specific school across different categories
    const mockStudents: AthleticsParticipantRecord[] = [
      { id: 'm-1', name: 'أحمد العلمي', cat: 'U12', gen: 'Male', d1: 'sprint_60m', d2: 'long_jump' },
      { id: 'm-2', name: 'فاطمة الزهراء بناني', cat: 'U12', gen: 'Female', d1: 'sprint_60m', d2: 'middle_600m' },
      { id: 'm-3', name: 'ياسين الوردي', cat: 'U15', gen: 'Male', d1: 'sprint_80m', d2: 'long_jump' },
      { id: 'm-4', name: 'سلمى الإدريسي', cat: 'U15', gen: 'Female', d1: 'sprint_80m', d2: 'middle_600m' },
      { id: 'm-5', name: 'مهدي القاسمي', cat: 'U15', gen: 'Male', d1: 'middle_1000m', d2: 'shot_put' },
      { id: 'm-6', name: 'ليلى الشاوي', cat: 'U18', gen: 'Female', d1: 'sprint_100m', d2: 'middle_800m' },
      { id: 'm-7', name: 'حمزة البوشيخي', cat: 'U18', gen: 'Male', d1: 'sprint_100m', d2: 'sprint_200m' },
      { id: 'm-8', name: 'سناء المتوكل', cat: 'U18', gen: 'Female', d1: 'middle_400m', d2: 'middle_800m' },
      { id: 'm-9', name: 'رضوان التازي', cat: 'U20', gen: 'Male', d1: 'sprint_200m', d2: 'middle_1500m' },
      { id: 'm-10', name: 'كوثر العمراني', cat: 'U20', gen: 'Female', d1: 'middle_800m', d2: 'middle_1500m' }
    ].map((m, idx) => ({
      id: `ath-mock-${Date.now()}-${idx}`,
      disciplineId: m.d1,
      secondDisciplineId: m.d2,
      category: m.cat as any,
      gender: m.gen as any,
      bibNumber: `${200 + current.length + idx}`,
      studentName: m.name,
      schoolName: schoolName,
      birthYear: m.cat === 'U12' ? '2014' : m.cat === 'U15' ? '2011' : m.cat === 'U18' ? '2008' : '2006',
      affiliationType: 'non_club',
      createdAt: new Date().toISOString()
    }));

    const updated = [...current, ...mockStudents];
    this.saveParticipants(updated);
    return { participantsCount: mockStudents.length };
  }
}
