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

// --- MOROCCAN DEMO DATA POOLS (بيانات مغربية واقعية للتجريب الشامل) ---
export const MOROCCAN_DEMO_SCHOOLS = [
  'ثانوية الفتح التأهيلية',
  'ثانوية صلاح الدين الأيوبي',
  'إعدادية علال الفاسي',
  'إعدادية القدس',
  'إعدادية ابن خلدون',
  'مدرسة ابن خلدون الابتدائية',
  'مدرسة النجاح الابتدائية',
  'مؤسسة النخبة الخاصة',
  'ثانوية ابن رشد التأهيلية',
  'إعدادية المسيرة الخضراء',
  'ثانوية الزيتون التأهيلية',
  'مدرسة 11 يناير الابتدائية'
];

export const MOROCCAN_DEMO_MALE_NAMES = [
  'ياسين الفيلالي', 'أمين العمراني', 'حمزة التازي', 'سفيان البوشيخي', 'معاد الناصري',
  'رضا الوردي', 'عثمان التازي', 'طارق العلمي', 'أيوب البوعناني', 'أنس الشرقاوي',
  'عمر القاسمي', 'آدم الصالحي', 'إلياس بنجلون', 'يوسف بناني', 'بدر الصنهاجي',
  'بلال اليعقوبي', 'زكرياء المرابط', 'مهدي القاسمي', 'ريان العلوي', 'مروان الشرايبي',
  'هيثم الودغيري', 'سعد الفاسي', 'أشرف الحداوي', 'وليد البودالي', 'هشام الداودي',
  'عبد الرحمان بنجلون', 'صلاح الدين المنصوري', 'طه الصالحي', 'إسماعيل بلحسن', 'زياد العمراني'
];

export const MOROCCAN_DEMO_FEMALE_NAMES = [
  'أميمة بلحسن', 'فاطمة الزهراء بنعلي', 'خديجة برادة', 'مريم الشاوي', 'هدى الإدريسي',
  'سارة المنصوري', 'دعاء العلمي', 'ملاك الرحماني', 'سلمى الإدريسي', 'ليلى الشاوي',
  'سناء المتوكل', 'كوثر العمراني', 'آية الفيلالي', 'نهال الوردي', 'إيمان الناصري',
  'ياسمين القاسمي', 'شيماء التازي', 'حفصة البوعناني', 'وفاء الشرقاوي', 'رانية الصالحي',
  'هبة الرحماني', 'وصال بنجلون', 'ريم بناني', 'زينب الصنهاجي', 'ابتسام المرابط',
  'نسرين العلوي', 'نادية الشرايبي', 'إكرام الودغيري', 'بسمة الفاسي', 'غيثة الحداوي'
];

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

  static parseTimeToMs(str: string): number {
    if (!str || typeof str !== 'string') return 0;
    const clean = str.trim().replace(',', '.');
    if (clean.includes(':')) {
      const parts = clean.split(':');
      const mins = parseFloat(parts[0]) || 0;
      const secs = parseFloat(parts[1]) || 0;
      return Math.round(mins * 60000 + secs * 1000);
    }
    const secs = parseFloat(clean);
    return isNaN(secs) ? 0 : Math.round(secs * 1000);
  }

  static getDraftTrackLaps(eventKey: string): TrackRankEntry[] {
    try {
      const data = localStorage.getItem(`athletics_draft_laps_${eventKey}`);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse draft track laps:', e);
    }
    return [];
  }

  static saveDraftTrackLaps(eventKey: string, laps: TrackRankEntry[]): void {
    try {
      localStorage.setItem(`athletics_draft_laps_${eventKey}`, JSON.stringify(laps));
    } catch (e) {
      console.error('Failed to save draft track laps:', e);
    }
  }

  static clearDraftTrackLaps(eventKey: string): void {
    try {
      localStorage.removeItem(`athletics_draft_laps_${eventKey}`);
    } catch (e) {
      console.error('Failed to clear draft track laps:', e);
    }
  }

  // 7. Generate & Seed Realistic Default Mock Data (بيانات افتراضية نموذجية)
  static loadDefaultMockData(): {
    participantsCount: number;
    committeesCount: number;
    disciplinesCount: number;
    breakdown?: Record<string, { committeeTitle: string; count: number; eventsCount: number }>;
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

    // 4. Generate 10 Participants for Every Race, Category, and Gender Across All Committees
    // (توليد ودمج 10 متسابقين حقيقيين في كل سباق، كل فئة عمرية، وكل جنس موزعين على اللجان والمؤسسات)
    const seedResult = this.seedAllCommitteesParticipants(10, 'replace');

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
      participantsCount: seedResult.totalParticipants,
      committeesCount: INITIAL_ATHLETICS_COMMITTEES.length,
      disciplinesCount: INITIAL_ATHLETICS_DISCIPLINES.length,
      breakdown: seedResult.breakdown
    };
  }

  // --- 8. REALISTIC 10 COMPETITORS PER RACE, CATEGORY & GENDER GENERATION & COMMITTEE SEEDING ---
  static generate10ParticipantsForEvent(
    discipline: AthleticsDisciplineDef,
    category: 'U12' | 'U15' | 'U18' | 'U20',
    gender: 'Male' | 'Female',
    eventIndex: number,
    startingBib: number
  ): AthleticsParticipantRecord[] {
    const isFemale = gender === 'Female';
    const namePool = isFemale ? MOROCCAN_DEMO_FEMALE_NAMES : MOROCCAN_DEMO_MALE_NAMES;
    const records: AthleticsParticipantRecord[] = [];

    const birthYear = category === 'U12' ? '2014' : category === 'U15' ? '2011' : category === 'U18' ? '2008' : '2006';
    const massarPrefix = category === 'U12' ? 'F15' : category === 'U15' ? 'F14' : category === 'U18' ? 'F13' : 'F12';

    // Preserve the exact 4 IDs and details for sprint_100m U18 Male used in sample results
    if (discipline.id === 'sprint_100m' && category === 'U18' && gender === 'Male') {
      const top4 = [
        { id: 'ath-demo-1', bib: '101', name: 'ياسين الفيلالي', school: 'ثانوية الفتح التأهيلية' },
        { id: 'ath-demo-7', bib: '103', name: 'أمين العمراني', school: 'ثانوية صلاح الدين الأيوبي' },
        { id: 'ath-demo-20', bib: '105', name: 'حمزة التازي', school: 'مؤسسة النخبة الخاصة' },
        { id: 'ath-demo-3', bib: '104', name: 'سفيان البوشيخي', school: 'ثانوية الفتح التأهيلية' }
      ];
      top4.forEach((d, idx) => {
        records.push({
          id: d.id,
          disciplineId: discipline.id,
          secondDisciplineId: idx % 2 === 0 ? 'long_jump' : 'sprint_200m',
          category,
          gender,
          bibNumber: d.bib,
          studentName: d.name,
          schoolName: d.school,
          birthYear,
          birthDate: `${birthYear}-03-${String(10 + idx)}`,
          massarNumber: `${massarPrefix}${1328900 + idx}`,
          affiliationType: idx % 2 === 0 ? 'non_club' : 'club_affiliated',
          coachName: 'ذ. عبد الرحيم بلقاسم',
          coachPhone: '0661122334',
          createdAt: new Date().toISOString()
        });
      });
      // Fill remaining 6 to complete 10
      for (let i = 4; i < 10; i++) {
        const name = namePool[(eventIndex * 7 + i) % namePool.length];
        const school = MOROCCAN_DEMO_SCHOOLS[(eventIndex * 3 + i) % MOROCCAN_DEMO_SCHOOLS.length];
        records.push({
          id: `ath-demo-${discipline.id}-${category}-${gender}-${i + 1}`,
          disciplineId: discipline.id,
          category,
          gender,
          bibNumber: String(106 + i - 4),
          studentName: name,
          schoolName: school,
          birthYear,
          birthDate: `${birthYear}-04-${String(10 + i)}`,
          massarNumber: `${massarPrefix}${1328900 + i}`,
          affiliationType: 'non_club',
          coachName: 'ذ. عبد الرحيم بلقاسم',
          coachPhone: '0661122334',
          createdAt: new Date().toISOString()
        });
      }
      return records;
    }

    // Preserve the exact 3 IDs and details for long_jump U15 Male used in sample results
    if (discipline.id === 'long_jump' && category === 'U15' && gender === 'Male') {
      const top3 = [
        { id: 'ath-demo-10', bib: '201', name: 'عمر القاسمي', school: 'إعدادية علال الفاسي' },
        { id: 'ath-demo-12', bib: '203', name: 'أيوب البوعناني', school: 'إعدادية علال الفاسي' },
        { id: 'ath-demo-14', bib: '205', name: 'أنس الشرقاوي', school: 'إعدادية علال الفاسي' }
      ];
      top3.forEach((d, idx) => {
        records.push({
          id: d.id,
          disciplineId: discipline.id,
          secondDisciplineId: 'sprint_80m',
          category,
          gender,
          bibNumber: d.bib,
          studentName: d.name,
          schoolName: d.school,
          birthYear,
          birthDate: `${birthYear}-05-${String(10 + idx)}`,
          massarNumber: `${massarPrefix}${1412300 + idx}`,
          affiliationType: idx === 2 ? 'club_affiliated' : 'non_club',
          coachName: 'ذ. محمد المنصوري',
          coachPhone: '0662233445',
          createdAt: new Date().toISOString()
        });
      });
      // Fill remaining 7 to complete 10
      for (let i = 3; i < 10; i++) {
        const name = namePool[(eventIndex * 7 + i) % namePool.length];
        const school = MOROCCAN_DEMO_SCHOOLS[(eventIndex * 3 + i) % MOROCCAN_DEMO_SCHOOLS.length];
        records.push({
          id: `ath-demo-${discipline.id}-${category}-${gender}-${i + 1}`,
          disciplineId: discipline.id,
          category,
          gender,
          bibNumber: String(206 + i - 3),
          studentName: name,
          schoolName: school,
          birthYear,
          birthDate: `${birthYear}-06-${String(10 + i)}`,
          massarNumber: `${massarPrefix}${1412300 + i}`,
          affiliationType: 'non_club',
          coachName: 'ذ. محمد المنصوري',
          coachPhone: '0662233445',
          createdAt: new Date().toISOString()
        });
      }
      return records;
    }

    // General standard generator for all other events (10 competitors each)
    for (let i = 0; i < 10; i++) {
      const name = namePool[(eventIndex * 7 + i) % namePool.length];
      const school = MOROCCAN_DEMO_SCHOOLS[(eventIndex * 3 + i) % MOROCCAN_DEMO_SCHOOLS.length];
      const bib = String(startingBib + i);
      const birthMonth = String((i % 12) + 1).padStart(2, '0');
      const birthDay = String(((i * 3 + 2) % 27) + 1).padStart(2, '0');

      records.push({
        id: `ath-demo-${discipline.id}-${category}-${gender}-${i + 1}`,
        disciplineId: discipline.id,
        category,
        gender,
        bibNumber: bib,
        studentName: name,
        schoolName: school,
        birthYear,
        birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
        massarNumber: `${massarPrefix}${String(1000000 + (eventIndex * 10) + i).slice(1)}`,
        affiliationType: i % 4 === 0 ? 'club_affiliated' : 'non_club',
        coachName: 'ذ. أستاذ التربية البدنية',
        coachPhone: '0661000000',
        createdAt: new Date().toISOString()
      });
    }

    return records;
  }

  static generateParticipantsForCommittee(
    committeeId: string,
    countPerEvent: number = 10,
    startBibOffset: number = 100
  ): AthleticsParticipantRecord[] {
    const disciplines = this.getDisciplines().filter(d => d.committeeId === committeeId);
    const records: AthleticsParticipantRecord[] = [];
    let eventIdx = 0;
    let currentBib = startBibOffset;

    disciplines.forEach(disc => {
      disc.allowedCategories.forEach(cat => {
        disc.allowedGenders.forEach(gen => {
          const eventParticipants = this.generate10ParticipantsForEvent(disc, cat, gen, eventIdx, currentBib);
          records.push(...eventParticipants);
          eventIdx++;
          currentBib += countPerEvent;
        });
      });
    });

    return records;
  }

  static generateAllCommitteesParticipants(countPerEvent: number = 10): AthleticsParticipantRecord[] {
    const committees = this.getCommittees();
    const records: AthleticsParticipantRecord[] = [];
    let globalBib = 101;
    let eventIdx = 0;

    committees.forEach(comm => {
      if (comm.id === 'podium_committee') return;
      const commDisciplines = this.getDisciplines().filter(d => d.committeeId === comm.id);
      commDisciplines.forEach(disc => {
        disc.allowedCategories.forEach(cat => {
          disc.allowedGenders.forEach(gen => {
            const eventParticipants = this.generate10ParticipantsForEvent(disc, cat, gen, eventIdx, globalBib);
            records.push(...eventParticipants);
            eventIdx++;
            globalBib += countPerEvent;
          });
        });
      });
    });

    return records;
  }

  static seedAllCommitteesParticipants(
    countPerEvent: number = 10,
    mode: 'replace' | 'merge' = 'replace'
  ): {
    totalParticipants: number;
    totalEvents: number;
    committeesCount: number;
    breakdown: Record<string, { committeeTitle: string; count: number; eventsCount: number }>;
  } {
    const generated = this.generateAllCommitteesParticipants(countPerEvent);
    const breakdown: Record<string, { committeeTitle: string; count: number; eventsCount: number }> = {};
    const committees = this.getCommittees();

    committees.forEach(comm => {
      if (comm.id === 'podium_committee') return;
      const commDisc = this.getDisciplines().filter(d => d.committeeId === comm.id);
      let count = 0;
      let eventsCount = 0;
      commDisc.forEach(d => {
        d.allowedCategories.forEach(() => {
          d.allowedGenders.forEach(() => {
            eventsCount++;
            count += countPerEvent;
          });
        });
      });
      breakdown[comm.id] = {
        committeeTitle: comm.titleAr,
        count,
        eventsCount
      };
    });

    let finalParticipants: AthleticsParticipantRecord[];
    if (mode === 'replace') {
      finalParticipants = generated;
    } else {
      const current = this.getParticipants();
      const existingKeys = new Set(current.map(p => `${p.disciplineId}_${p.category}_${p.gender}_${p.studentName}`));
      const newItems = generated.filter(p => !existingKeys.has(`${p.disciplineId}_${p.category}_${p.gender}_${p.studentName}`));
      finalParticipants = [...current, ...newItems];
    }

    this.saveParticipants(finalParticipants);

    return {
      totalParticipants: finalParticipants.length,
      totalEvents: Object.values(breakdown).reduce((acc, b) => acc + b.eventsCount, 0),
      committeesCount: committees.filter(c => c.id !== 'podium_committee').length,
      breakdown
    };
  }

  static seedCommitteeParticipants(
    committeeId: string,
    countPerEvent: number = 10,
    mode: 'merge' | 'replace' = 'merge'
  ): {
    committeeId: string;
    addedCount: number;
    totalCommitteeParticipants: number;
    eventsCount: number;
    disciplinesCount: number;
  } {
    const disciplines = this.getDisciplines().filter(d => d.committeeId === committeeId);
    const current = this.getParticipants();
    const currentDiscIds = new Set(disciplines.map(d => d.id));
    const generated = this.generateParticipantsForCommittee(committeeId, countPerEvent, 100 + current.length);

    let finalParticipants: AthleticsParticipantRecord[];
    let addedCount = 0;

    if (mode === 'replace') {
      const retained = current.filter(p => !currentDiscIds.has(p.disciplineId));
      finalParticipants = [...retained, ...generated];
      addedCount = generated.length;
    } else {
      const newItems: AthleticsParticipantRecord[] = [];
      disciplines.forEach(disc => {
        disc.allowedCategories.forEach(cat => {
          disc.allowedGenders.forEach(gen => {
            const existingForEvent = current.filter(
              p => p.disciplineId === disc.id && p.category === cat && p.gender === gen
            );
            if (existingForEvent.length < countPerEvent) {
              const needed = countPerEvent - existingForEvent.length;
              const fresh = this.generate10ParticipantsForEvent(
                disc,
                cat,
                gen,
                Math.floor(Math.random() * 100),
                200 + current.length + newItems.length
              ).slice(0, needed);
              newItems.push(...fresh);
            }
          });
        });
      });
      finalParticipants = [...current, ...newItems];
      addedCount = newItems.length;
    }

    this.saveParticipants(finalParticipants);

    const totalCommittee = finalParticipants.filter(
      p => currentDiscIds.has(p.disciplineId) || (p.secondDisciplineId && currentDiscIds.has(p.secondDisciplineId))
    ).length;

    let totalEvents = 0;
    disciplines.forEach(d => {
      totalEvents += d.allowedCategories.length * d.allowedGenders.length;
    });

    return {
      committeeId,
      addedCount,
      totalCommitteeParticipants: totalCommittee,
      eventsCount: totalEvents,
      disciplinesCount: disciplines.length
    };
  }

  static seedSingleEventParticipants(
    disciplineId: string,
    category: 'U12' | 'U15' | 'U18' | 'U20',
    gender: 'Male' | 'Female',
    count: number = 10
  ): AthleticsParticipantRecord[] {
    const disc = this.getDisciplines().find(d => d.id === disciplineId);
    if (!disc) return [];

    const current = this.getParticipants();
    const generated = this.generate10ParticipantsForEvent(
      disc,
      category,
      gender,
      Math.floor(Math.random() * 50),
      300 + current.length
    ).slice(0, count);

    const retained = current.filter(
      p => !(p.disciplineId === disciplineId && p.category === category && p.gender === gender)
    );
    const updated = [...retained, ...generated];
    this.saveParticipants(updated);
    return generated;
  }

  static getCommitteeParticipantStats(committeeId: string): {
    totalParticipants: number;
    maleCount: number;
    femaleCount: number;
    u12Count: number;
    u15Count: number;
    u18Count: number;
    u20Count: number;
    disciplinesCount: number;
    eventsCount: number;
  } {
    const participants = this.getParticipants();
    const disciplines = this.getDisciplines().filter(d => d.committeeId === committeeId);
    const discIds = new Set(disciplines.map(d => d.id));

    const committeeParticipants = participants.filter(
      p => discIds.has(p.disciplineId) || (p.secondDisciplineId && discIds.has(p.secondDisciplineId))
    );

    let eventsCount = 0;
    disciplines.forEach(d => {
      eventsCount += d.allowedCategories.length * d.allowedGenders.length;
    });

    return {
      totalParticipants: committeeParticipants.length,
      maleCount: committeeParticipants.filter(p => p.gender === 'Male').length,
      femaleCount: committeeParticipants.filter(p => p.gender === 'Female').length,
      u12Count: committeeParticipants.filter(p => p.category === 'U12').length,
      u15Count: committeeParticipants.filter(p => p.category === 'U15').length,
      u18Count: committeeParticipants.filter(p => p.category === 'U18').length,
      u20Count: committeeParticipants.filter(p => p.category === 'U20').length,
      disciplinesCount: disciplines.length,
      eventsCount
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

  static getRefereeAthleticsAssignments(user: User | null): { committeeId: string; committeeTitle: string; roleInCommittee: string }[] {
    if (!user) return [];
    try {
      const assignments = this.getCommitteeAssignments();
      const committees = this.getCommittees();
      const results: { committeeId: string; committeeTitle: string; roleInCommittee: string }[] = [];

      for (const [cId, assign] of Object.entries(assignments)) {
        const comm = committees.find(c => c.id === cId);
        const title = comm ? comm.titleAr : cId;
        
        const isMain = assign.teacherId === user.id || (assign.teacherName && user.fullName && assign.teacherName.trim().toLowerCase() === user.fullName.trim().toLowerCase());
        const matchingMember = assign.members?.find(m => m.teacherId === user.id || (m.teacherName && user.fullName && m.teacherName.trim().toLowerCase() === user.fullName.trim().toLowerCase()));

        if (isMain || matchingMember) {
          results.push({
            committeeId: cId,
            committeeTitle: title,
            roleInCommittee: matchingMember?.roleInCommittee || (isMain ? 'رئيس اللجنة' : 'عضو لجنة')
          });
        }
      }
      return results;
    } catch {
      return [];
    }
  }
}
