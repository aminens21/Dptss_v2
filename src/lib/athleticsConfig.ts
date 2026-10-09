export interface AthleticsDisciplineDef {
  id: string;
  nameAr: string;
  nameFr: string;
  type: 'track_sprint' | 'track_middle' | 'track_relay' | 'field_jump' | 'field_throw';
  committeeId: string;
  distanceOrUnit: string;
  icon: string;
  allowedCategories: ('U12' | 'U15' | 'U18' | 'U20')[];
  allowedGenders: ('Male' | 'Female')[];
  isCustom?: boolean;
}

export interface CommitteeTeacherMember {
  teacherId: string;
  teacherName: string;
  schoolName?: string;
  phone?: string;
  roleInCommittee: string; // 'رئيس اللجنة', 'حكم الانطلاق', 'حكم خط النهاية', 'مسجل المراتب والتوقيت', 'قاضي المحاولات والقياس', 'مؤطر الفريق'
}

export interface AthleticsCommitteePermissions {
  allowedTabs: ('events' | 'committees' | 'stopwatch' | 'field' | 'podium' | 'school_registration')[];
  allowedDisciplineIds: string[];
  canRecordResults: boolean;
  canValidateResults: boolean;
  canPrintReports: boolean;
  canExportData: boolean;
}

export interface AthleticsCommitteeDef {
  id: string;
  titleAr: string;
  titleFr: string;
  description: string;
  icon: string;
  colorTheme: string;
  gradientBg: string;
  disciplines: string[];
  permissions?: AthleticsCommitteePermissions;
  isCustom?: boolean;
}

export const INITIAL_ATHLETICS_COMMITTEES: AthleticsCommitteeDef[] = [
  {
    id: 'sprint_committee',
    titleAr: 'لجنة الجري السريع للمسافات القصيرة',
    titleFr: 'Commission des Courses de Vitesse / Sprint',
    description: 'الإشراف والتحكيم في سباقات السرعة القصيرة (60م، 80م، 100م، 200م) وإدارة الانطلاقة وخط النهاية.',
    icon: '⚡',
    colorTheme: 'from-amber-500 to-orange-600',
    gradientBg: 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-amber-200 dark:border-amber-800',
    disciplines: ['sprint_60m', 'sprint_80m', 'sprint_100m', 'sprint_200m'],
    permissions: {
      allowedTabs: ['stopwatch'],
      allowedDisciplineIds: ['sprint_60m', 'sprint_80m', 'sprint_100m', 'sprint_200m'],
      canRecordResults: true,
      canValidateResults: true,
      canPrintReports: true,
      canExportData: true
    }
  },
  {
    id: 'middle_distance_committee',
    titleAr: 'لجنة المسافات المتوسطة والجري بالتناوب',
    titleFr: 'Commission Demi-fond & Relais',
    description: 'الإشراف على سباقات النصف طويل (400م، 600م، 800م، 1000م، 1500م) وسباقات التتابع للفرق المدرسية.',
    icon: '🏃‍♂️',
    colorTheme: 'from-emerald-500 to-teal-600',
    gradientBg: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 border-emerald-200 dark:border-emerald-800',
    disciplines: ['middle_400m', 'middle_600m', 'middle_800m', 'middle_1000m', 'middle_1500m', 'relay_4x60m', 'relay_4x100m', 'relay_4x400m'],
    permissions: {
      allowedTabs: ['stopwatch'],
      allowedDisciplineIds: ['middle_400m', 'middle_600m', 'middle_800m', 'middle_1000m', 'middle_1500m', 'relay_4x60m', 'relay_4x100m', 'relay_4x400m'],
      canRecordResults: true,
      canValidateResults: true,
      canPrintReports: true,
      canExportData: true
    }
  },
  {
    id: 'long_jump_committee',
    titleAr: 'لجنة مسابقة القفز (الطولي والثلاثي والعالي)',
    titleFr: 'Commission des Concours de Sauts',
    description: 'تحكيم مسابقات القفز، قياس المسافات والارتفاعات بالمتر والسنتيمتر، وإدارة المحاولات الرسمية.',
    icon: '🦘',
    colorTheme: 'from-blue-500 to-indigo-600',
    gradientBg: 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border-blue-200 dark:border-blue-800',
    disciplines: ['long_jump', 'triple_jump', 'high_jump'],
    permissions: {
      allowedTabs: ['field'],
      allowedDisciplineIds: ['long_jump', 'triple_jump', 'high_jump'],
      canRecordResults: true,
      canValidateResults: true,
      canPrintReports: true,
      canExportData: true
    }
  },
  {
    id: 'shot_put_committee',
    titleAr: 'لجنة مسابقة الرمي ودفع الجلة',
    titleFr: 'Commission Lancers & Poids',
    description: 'الإشراف على محاولات دفع الجلة بالأوزان القانونية المعتمدة لكل فئة عمرية وتحديد الفائزين.',
    icon: '☄️',
    colorTheme: 'from-rose-500 to-red-600',
    gradientBg: 'bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-950/40 dark:to-red-950/40 border-rose-200 dark:border-rose-800',
    disciplines: ['shot_put'],
    permissions: {
      allowedTabs: ['field'],
      allowedDisciplineIds: ['shot_put'],
      canRecordResults: true,
      canValidateResults: true,
      canPrintReports: true,
      canExportData: true
    }
  },
  {
    id: 'podium_committee',
    titleAr: 'لجنة التتويج والمراسيم والجوائز',
    titleFr: 'Commission du Podium, Cérémonies & Récompenses',
    description: 'الإشراف على منصة التتويج، تسليم الميداليات، إعداد المحاضر الرسمية للنتائج النهائية، وتكريم الأبطال والفرق الفائزة.',
    icon: '🏆',
    colorTheme: 'from-amber-500 to-yellow-600',
    gradientBg: 'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border-amber-200 dark:border-amber-800',
    disciplines: [],
    permissions: {
      allowedTabs: ['podium'],
      allowedDisciplineIds: [],
      canRecordResults: false,
      canValidateResults: true,
      canPrintReports: true,
      canExportData: true
    }
  }
];

export const INITIAL_ATHLETICS_DISCIPLINES: AthleticsDisciplineDef[] = [
  {
    id: 'sprint_60m',
    nameAr: 'سباق 60 متر مستوية',
    nameFr: 'Course 60m Plat',
    type: 'track_sprint',
    committeeId: 'sprint_committee',
    distanceOrUnit: '60 متر',
    icon: '⚡',
    allowedCategories: ['U12', 'U15'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'sprint_80m',
    nameAr: 'سباق 80 متر مستوية',
    nameFr: 'Course 80m Plat',
    type: 'track_sprint',
    committeeId: 'sprint_committee',
    distanceOrUnit: '80 متر',
    icon: '⚡',
    allowedCategories: ['U15'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'sprint_100m',
    nameAr: 'سباق 100 متر مستوية',
    nameFr: 'Course 100m Plat',
    type: 'track_sprint',
    committeeId: 'sprint_committee',
    distanceOrUnit: '100 متر',
    icon: '⚡',
    allowedCategories: ['U15', 'U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'sprint_200m',
    nameAr: 'سباق 200 متر مستوية',
    nameFr: 'Course 200m Plat',
    type: 'track_sprint',
    committeeId: 'sprint_committee',
    distanceOrUnit: '200 متر',
    icon: '⚡',
    allowedCategories: ['U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'middle_400m',
    nameAr: 'سباق 400 متر',
    nameFr: 'Course 400m',
    type: 'track_middle',
    committeeId: 'middle_distance_committee',
    distanceOrUnit: '400 متر',
    icon: '🏃',
    allowedCategories: ['U15', 'U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'middle_600m',
    nameAr: 'سباق 600 متر',
    nameFr: 'Course 600m',
    type: 'track_middle',
    committeeId: 'middle_distance_committee',
    distanceOrUnit: '600 متر',
    icon: '🏃',
    allowedCategories: ['U12', 'U15'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'middle_800m',
    nameAr: 'سباق 800 متر',
    nameFr: 'Course 800m',
    type: 'track_middle',
    committeeId: 'middle_distance_committee',
    distanceOrUnit: '800 متر',
    icon: '🏃',
    allowedCategories: ['U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'middle_1000m',
    nameAr: 'سباق 1000 متر',
    nameFr: 'Course 1000m',
    type: 'track_middle',
    committeeId: 'middle_distance_committee',
    distanceOrUnit: '1000 متر',
    icon: '🏃',
    allowedCategories: ['U15', 'U18'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'middle_1500m',
    nameAr: 'سباق 1500 متر',
    nameFr: 'Course 1500m',
    type: 'track_middle',
    committeeId: 'middle_distance_committee',
    distanceOrUnit: '1500 متر',
    icon: '🏃',
    allowedCategories: ['U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'relay_4x60m',
    nameAr: 'سباق التناوب 4 × 60 متر',
    nameFr: 'Relais 4 x 60m',
    type: 'track_relay',
    committeeId: 'middle_distance_committee',
    distanceOrUnit: '4 × 60م',
    icon: '🤝',
    allowedCategories: ['U12', 'U15'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'relay_4x100m',
    nameAr: 'سباق التناوب 4 × 100 متر',
    nameFr: 'Relais 4 x 100m',
    type: 'track_relay',
    committeeId: 'middle_distance_committee',
    distanceOrUnit: '4 × 100م',
    icon: '🤝',
    allowedCategories: ['U15', 'U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'relay_4x400m',
    nameAr: 'سباق التناوب 4 × 400 متر',
    nameFr: 'Relais 4 x 400m',
    type: 'track_relay',
    committeeId: 'middle_distance_committee',
    distanceOrUnit: '4 × 400م',
    icon: '🤝',
    allowedCategories: ['U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'long_jump',
    nameAr: 'مسابقة القفز الطولي',
    nameFr: 'Saut en Longueur',
    type: 'field_jump',
    committeeId: 'long_jump_committee',
    distanceOrUnit: 'بالمتر (m)',
    icon: '🦘',
    allowedCategories: ['U12', 'U15', 'U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'triple_jump',
    nameAr: 'مسابقة القفز الثلاثي',
    nameFr: 'Triple Saut',
    type: 'field_jump',
    committeeId: 'long_jump_committee',
    distanceOrUnit: 'بالمتر (m)',
    icon: '🦘',
    allowedCategories: ['U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'high_jump',
    nameAr: 'مسابقة القفز العالي',
    nameFr: 'Saut en Hauteur',
    type: 'field_jump',
    committeeId: 'long_jump_committee',
    distanceOrUnit: 'بالمتر (m)',
    icon: '🤸‍♂️',
    allowedCategories: ['U15', 'U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'shot_put',
    nameAr: 'مسابقة دفع الجلة',
    nameFr: 'Lancer de Poids',
    type: 'field_throw',
    committeeId: 'shot_put_committee',
    distanceOrUnit: 'بالمتر (m)',
    icon: '☄️',
    allowedCategories: ['U12', 'U15', 'U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'discus_throw',
    nameAr: 'مسابقة رمي القرص',
    nameFr: 'Lancer du Disque',
    type: 'field_throw',
    committeeId: 'shot_put_committee',
    distanceOrUnit: 'بالمتر (m)',
    icon: '🥏',
    allowedCategories: ['U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  },
  {
    id: 'javelin_throw',
    nameAr: 'مسابقة رمي الرمح',
    nameFr: 'Lancer du Javelot',
    type: 'field_throw',
    committeeId: 'shot_put_committee',
    distanceOrUnit: 'بالمتر (m)',
    icon: '🎯',
    allowedCategories: ['U18', 'U20'],
    allowedGenders: ['Male', 'Female']
  }
];

export const COMMITTEE_ROLE_OPTIONS = [
  'رئيس اللجنة',
  'نائب رئيس اللجنة',
  'حكم الانطلاق (Starter)',
  'حكم خط النهاية (Juge d\'arrivée)',
  'مسجل المراتب والتوقيت (Chronométreur)',
  'قاضي المحاولات والقياس (Juge de concours)',
  'مكلف بالأمانة والنتائج (Secrétariat)',
  'مؤطر ومرافق الفريق (Encadrant)'
];

export interface AthleticsCommitteeAssignment {
  committeeId: string;
  teacherId: string;
  teacherName: string;
  teacherSchool?: string;
  teacherPhone?: string;
  members?: CommitteeTeacherMember[];
  notes?: string;
  updatedAt: string;
}

export interface AthleticsParticipantRecord {
  id: string;
  disciplineId: string;
  secondDisciplineId?: string;
  category: 'U12' | 'U15' | 'U18' | 'U20';
  gender: 'Male' | 'Female';
  bibNumber: string;
  studentName: string;
  schoolName: string;
  birthYear?: string;
  birthDate?: string;
  massarNumber?: string;
  affiliationType?: 'non_club' | 'club_affiliated';
  photo?: string;
  coachName?: string;
  coachPhone?: string;
  addedByTeacherId?: string;
  studentId?: string;
  isAutoImported?: boolean;
  createdAt: string;
}

export interface TrackRankEntry {
  rank: number;
  timeMs: number;
  formattedTime: string;
  participantId?: string;
  bibNumber?: string;
  studentName?: string;
  schoolName?: string;
  confirmed: boolean;
}

export interface FieldAttemptEntry {
  participantId: string;
  bibNumber: string;
  studentName: string;
  schoolName: string;
  attempts: (number | 'X' | null)[];
  bestAttempt: number | null;
  rank?: number;
}

export interface AthleticsEventResult {
  id: string; // key: `${disciplineId}_${category}_${gender}`
  disciplineId: string;
  category: 'U12' | 'U15' | 'U18' | 'U20';
  gender: 'Male' | 'Female';
  committeeId: string;
  type: 'track' | 'field';
  status: 'draft' | 'running' | 'completed';
  trackLaps?: TrackRankEntry[];
  fieldEntries?: FieldAttemptEntry[];
  recordedByTeacherName?: string;
  directorateName?: string;
  season?: string;
  lastUpdated: string;
}

export interface AthleticsAttendanceRecord {
  participantId: string;
  status: 'present' | 'absent' | 'pending';
  lane?: number;
  checkInTime?: string;
  notes?: string;
}
