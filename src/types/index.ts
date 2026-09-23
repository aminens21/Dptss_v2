export type Role = 'CENTRAL_ADMIN' | 'SPORT_MANAGER' | 'TEACHER' | 'REFEREE';

export const SUPER_ADMIN_EMAILS = [
  'aminens21@gmail.com',
  'omrhaman.figuig@gmail.com'
];

export interface Directorate {
  id: string;
  name: string; // e.g. 'المديرية الإقليمية بتاوريرت'
  shortName: string; // e.g. 'تاوريرت'
  region: string; // e.g. 'جهة الشرق'
  code: string; // e.g. '123456' or 'TAO2026' - PIN needed for teachers/staff to join this directorate
  adminEmails: string[]; // Central admins who manage this specific directorate
  logoUrl?: string;
  phone?: string;
  email?: string;
  address?: string;
  isActive: boolean;
  createdAt?: any;
}

export interface DirectorateTransferRequest {
  targetDirectorateId: string;
  targetDirectorateName: string;
  targetDirectorateRegion?: string;
  currentDirectorateId: string;
  currentDirectorateName: string;
  requestedAt: any;
  status: 'pending' | 'approved' | 'rejected';
  teacherId: string;
  teacherName: string;
  leaseNumber?: string;
  workLocation?: string;
  phone?: string;
  teachingCadre?: string;
  rejectionReason?: string;
  respondedAt?: any;
}

export interface User {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  role: Role;
  sportId?: string; // For SPORT_MANAGER e.g. 'basketball', 'football'
  assignedTournamentId?: string; // Specific assigned tournament
  directorateId?: string; // المعرف الخاص بالمديرية الإقليمية
  directorateName?: string;
  isSuperAdmin?: boolean; // هل هو مسير مركزي فائق الصلاحيات (aminens21 / printomrdesigne)
  isActive: boolean;
  createdAt: any; // Firestore Timestamp
  updatedAt: any;
  createdBy?: string;
  workLocation?: string; // مقر العمل
  schoolId?: string; // معرف المؤسسة التعليمية المعتمدة لربط الحساب
  leaseNumber?: string; // رقم التأجير
  refereeSpecialty?: string[]; // التخصصات الرياضية في التحكيم
  isTechCommitteeHead?: boolean; // رئيس لجنة تقنية
  techCommitteeSports?: string[]; // التخصصات الرياضية التي يترأس لجنتها التقنية
  isTechCommitteeMember?: boolean; // عضو لجنة تقنية
  techCommitteeSportsMemberOf?: string[]; // التخصصات الرياضية التي يشارك في لجنتها التقنية كعضو
  photoUrl?: string; // صورة الأستاذ الشخصية
  teachingCadre?: 'PRIMARY' | 'MIDDLE' | 'HIGH' | string; // الإطار التعليمي: أستاذ الابتدائي / ثانوي إعدادي / ثانوي تأهيلي
  pendingTransfer?: DirectorateTransferRequest | null; // طلب انتقال معلق إلى مديرية أخرى بانتظار موافقة مسيرها
}

export interface CustomAgeCategory {
  id: string;
  name: string;
  yearsExpression: string; // e.g. "2015 وما بعد" or "2012/2013/2014"
}

export interface Sport {
  id: string;
  name: string;
  description: string;
  icon?: string;
  managerId?: string;
  ageCategories?: string[]; // الفئات المعنية بالتخصص الرياضي التي حددها المسير الرئيسي
  customAgeCategories?: CustomAgeCategory[]; // الفئات العمرية المخصصة ديناميكياً مع مسمياتها وسنواتها
  studentLimit?: number; // السقف الأقصى لعدد التلاميذ المسموح بمشاركتهم من كل مؤسسة في هذا التخصص
  athleticsSpecialties?: string[]; // تخصصات ألعاب القوى المتاحة (القفز الطولي، القفز العلوي، جري 80 متر...)
  isCustom?: boolean; // رياضة مضافة من طرف المسير المركزي
  isProgrammed?: boolean; // وضع البطولة: مبرمجة (true) أو في طور الإعداد (false)
  createdAt?: any;
}

export type RoleKey = 'TEACHER' | 'TECH_COMMITTEE_HEAD' | 'SPORT_MANAGER' | 'CENTRAL_ADMIN' | 'REFEREE';

export interface RoleSidebarPermissions {
  TEACHER: string[];
  TECH_COMMITTEE_HEAD: string[];
  SPORT_MANAGER: string[];
  CENTRAL_ADMIN: string[];
  REFEREE: string[];
}

export type AffiliationType = 'non_club' | 'club_affiliated' | 'open';

export interface Tournament {
  id: string;
  name: string;
  seasonId: string;
  sportId: string;
  ageCategory: string;
  gender: 'Male' | 'Female' | 'Mixed';
  level: 'Primary' | 'Middle' | 'High' | string;
  scope: 'Provincial' | 'Regional' | 'National' | string;
  affiliationType?: 'non_club' | 'club_affiliated' | 'open' | string; // فئة: غير منتمين للأندية (أبيض) أو منتمين للأندية (أصفر فاتح)
  startDate: any;
  endDate: any;
  registrationDeadline?: any; // آخر أجل للتسجيل في البطولة
  status: 'Draft' | 'Scheduled' | 'Ongoing' | 'Completed' | 'Archived';
  description?: string;
  circuitLocation?: string; // مكان المطاف / الحلبة (خاص بالعدو الريفي)
  managerName?: string;
  managerPhone?: string;
  managerEmail?: string;
  accessCode?: string; // القن السري المخصص لمسؤول البطولة
  directorateId?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface School {
  id: string;
  name: string;
  type: string;
  commune: string;
  teacherName: string; // اسم المنسق (أو الأستاذ المنسق)
  coordinatorName?: string; // اسم منسق مادة التربية البدنية بالمؤسسة
  phone?: string; // هاتف المنسق
  principalName?: string; // اسم مدير المؤسسة
  principalPhone?: string; // هاتف مدير المؤسسة
  directorateId?: string;
  accessCode?: string; // القن السري لولوج وإدارة المؤسسة من طرف الأستاذ المنسق
}

export interface Team {
  id: string;
  name: string;
  schoolId: string;
  sportId: string;
  gender: 'Male' | 'Female' | 'Mixed';
  category: string;
  directorateId?: string;
}

export interface Referee {
  id: string;
  fullName: string;
  phone: string;
  specialty?: string[];
  isActive: boolean;
  isTeacher?: boolean;
  photoUrl?: string;
  directorateId?: string;
}

export interface Match {
  id: string;
  tournamentId: string;
  sportId: string;
  stage: string;
  team1Id: string;
  team2Id: string;
  ageCategory?: string;
  gender?: 'Male' | 'Female' | 'Mixed';
  date: any;
  startTime: string;
  endTime?: string;
  venueId: string;
  referee1Id?: string;
  referee2Id?: string;
  referees?: string[]; // Array to support more than 2 referees
  status: 'Scheduled' | 'Ongoing' | 'Completed' | 'Postponed' | 'Cancelled';
  score1?: number;
  score2?: number;
  penalty1?: number;
  penalty2?: number;
  winnerId?: string;
  notes?: string;
  scorers?: string;
  updatedBy?: string;
  updatedAt: any;
  directorateId?: string;
}

export interface Venue {
  id: string;
  name: string;
  city: string;
  address: string;
  capacity?: number;
  notes?: string;
  directorateId?: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: any;
  priority: 'Low' | 'Medium' | 'High';
  expiryDate: any;
  authorId: string;
  directorateId?: string;
}

export interface Student {
  id: string;
  fullName: string;
  massarNumber?: string; // رقم مسار للتلميذ (مثال: G134567890)
  gender: 'Male' | 'Female'; // ذكر ، أنثى
  birthDate: string; // YYYY-MM-DD
  category: string; // e.g. 'U12', 'U15', 'U18', 'U20', 'OPEN'
  schoolId: string; // link to school (teacher's school)
  schoolName: string; // cache school name
  sportId: string; // chosen sport
  photoUrl?: string; // photo data url or URL
  affiliationType?: 'non_club' | 'club_affiliated'; // غير منتمي لنادي / منتمي لنادي
  participationType?: 'individual' | 'school_team'; // نوع المشاركة في العدو الريفي: فردي أو فريق المؤسسة
  distance?: string; // المسافة للعدو الريفي (مثلا: 1000 م، 1500 م)
  athleticsSpecialty?: string; // تخصص ألعاب القوى المحدد (القفز الطولي، القفز العلوي، جري 80 متر...)
  coachName?: string; // اسم الأستاذ المؤطر لهذه الفئة/الرياضة
  coachLeaseNumber?: string; // رقم تأجير الأستاذ المؤطر
  coachPhone?: string; // هاتف الأستاذ المؤطر
  createdAt: any;
  updatedAt: any;
  directorateId?: string;
  directorateName?: string;
  academyName?: string;
  bibNumber?: string | number;
  crossCountryBibNumber?: string | number;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  sportId?: string; // التخصص الرياضي المعني
  role?: Role | 'ALL'; // الصفة المعنية (أستاذ، حكم، إلخ)
  userIds?: string[]; // مستخدمين محددين مستهدفين بالخصوص
  createdAt: any;
  readBy?: string[]; // قائمة معرفات المستخدمين الذين قرأوا الإشعار
  directorateId?: string;
}

export interface PodiumWinner {
  rank: number; // 1, 2, 3, 4, 5... (رتبة الفئة الرسمية)
  fullName: string;
  schoolName: string;
  studentId?: string;
  time?: string;
  bibNumber?: string;
  notes?: string;
  directorateName?: string;
  academyName?: string;
  supervisorName?: string;
  participationType?: string;
  categoryId?: string; // معرف الفئة، مثل: 'u12_male' أو 'u12_female'
  categoryTitle?: string; // التسمية العربية للفئة، مثل: 'سباق البراعم ذكور'
  overallRank?: number; // الترتيب العام في السباق المشترك
}

export interface CrossCountryCategoryResult {
  categoryId: string; // e.g. 'u12_male', 'u15_female'
  category: string; // 'U12' | 'U15' | 'U18' | 'U20'
  gender: 'Male' | 'Female';
  titleAr: string;
  distance: string;
  seasonId?: string;
  directorateId?: string;
  venueName?: string;
  podium: PodiumWinner[];
  updatedAt?: any;
  updatedBy?: string;
}


