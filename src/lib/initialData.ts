import { Tournament, Match, School, Team, Venue, Directorate } from '../types';

export const INITIAL_DIRECTORATES: Directorate[] = [
  {
    id: 'taourirt',
    name: 'المديرية الإقليمية بتاوريرت',
    shortName: 'تاوريرت',
    region: 'جهة الشرق',
    code: '123456',
    adminEmails: ['omrhaman.figuig@gmail.com', 'aminens21@gmail.com'],
    phone: '0536680000',
    email: 'dp.taourirt@men.gov.ma',
    address: 'شارع محمد الخامس، تاوريرت',
    isActive: true,
    createdAt: new Date('2026-01-01')
  },
  {
    id: 'oujda',
    name: 'المديرية الإقليمية بوجدة أنجاد',
    shortName: 'وجدة أنجاد',
    region: 'جهة الشرق',
    code: 'OUJ2026',
    adminEmails: [],
    phone: '0536681111',
    email: 'dp.oujda@men.gov.ma',
    address: 'شارع علال بن عبد الله، وجدة',
    isActive: true,
    createdAt: new Date('2026-01-01')
  },
  {
    id: 'berkane',
    name: 'المديرية الإقليمية ببركان',
    shortName: 'بركان',
    region: 'جهة الشرق',
    code: 'BER2026',
    adminEmails: [],
    phone: '0536612222',
    email: 'dp.berkane@men.gov.ma',
    address: 'شارع الحسن الثاني، بركان',
    isActive: true,
    createdAt: new Date('2026-01-01')
  },
  {
    id: 'nador',
    name: 'المديرية الإقليمية بالناظور',
    shortName: 'الناظور',
    region: 'جهة الشرق',
    code: 'NAD2026',
    adminEmails: [],
    phone: '0536603333',
    email: 'dp.nador@men.gov.ma',
    address: 'شارع الجيش الملكي، الناظور',
    isActive: true,
    createdAt: new Date('2026-01-01')
  },
  {
    id: 'guercif',
    name: 'المديرية الإقليمية بجرسيف',
    shortName: 'جرسيف',
    region: 'جهة الشرق',
    code: 'GUE2026',
    adminEmails: [],
    phone: '0535674444',
    email: 'dp.guercif@men.gov.ma',
    address: 'شارع محمد السادس، جرسيف',
    isActive: true,
    createdAt: new Date('2026-01-01')
  },
  {
    id: 'rabat',
    name: 'المديرية الإقليمية بالرباط',
    shortName: 'الرباط',
    region: 'جهة الرباط سلا القنيطرة',
    code: 'RAB2026',
    adminEmails: [],
    phone: '0537705555',
    email: 'dp.rabat@men.gov.ma',
    address: 'شارع النصر، الرباط',
    isActive: true,
    createdAt: new Date('2026-01-01')
  },
  {
    id: 'fes',
    name: 'المديرية الإقليمية بفاس',
    shortName: 'فاس',
    region: 'جهة فاس مكناس',
    code: 'FES2026',
    adminEmails: [],
    phone: '0535606666',
    email: 'dp.fes@men.gov.ma',
    address: 'شارع القدس، فاس',
    isActive: true,
    createdAt: new Date('2026-01-01')
  }
];

export const INITIAL_TOURNAMENTS: Tournament[] = [
  {
    id: 'tourn-1',
    name: 'البطولة الإقليمية المدرسية لكرة القدم (ذكور)',
    seasonId: '2026/2027',
    sportId: 'football',
    ageCategory: 'U15',
    gender: 'Male',
    level: 'High',
    scope: 'Provincial',
    affiliationType: 'non_club',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-25'),
    status: 'Scheduled',
    description: 'البطولة الإقليمية الرسمية المؤهلة للبطولة الجهوية للرياضة المدرسية بجهة الشرق.',
    managerName: 'ذ. عبد الرحيم بلقاسم',
    managerPhone: '0661234567',
    managerEmail: 'belkacem.foot@taourirt.ma',
    accessCode: 'FB-2026',
    directorateId: 'taourirt'
  },
  {
    id: 'tourn-2',
    name: 'دوري كرة اليد للإناث - السلك الإعدادي',
    seasonId: '2026/2027',
    sportId: 'handball',
    ageCategory: 'U15',
    gender: 'Female',
    level: 'Middle',
    scope: 'Provincial',
    affiliationType: 'non_club',
    startDate: new Date('2026-03-05'),
    endDate: new Date('2026-03-20'),
    status: 'Scheduled',
    description: 'المنافسات الإقليمية لكرة اليد إناث بالمركب الرياضي بتاوريرت.',
    managerName: 'ذة. فاطمة الزهراء بنعلي',
    managerPhone: '0663456789',
    managerEmail: 'benali.hand@taourirt.ma',
    accessCode: 'HB-7740',
    directorateId: 'taourirt'
  },
  {
    id: 'tourn-3',
    name: 'البطولة الإقليمية للكرة الطائرة (مختلط)',
    seasonId: '2026/2027',
    sportId: 'volleyball',
    ageCategory: 'U18',
    gender: 'Mixed',
    level: 'High',
    scope: 'Provincial',
    affiliationType: 'non_club',
    startDate: new Date('2026-03-10'),
    endDate: new Date('2026-03-30'),
    status: 'Scheduled',
    description: 'إقصائيات الكرة الطائرة للثانويات التأهيلية بتاوريرت والعيون سيدي ملوك.',
    managerName: 'ذ. رشيد الداودي',
    managerPhone: '0662345678',
    managerEmail: 'daoudi.volley@taourirt.ma',
    accessCode: 'VB-5512',
    directorateId: 'taourirt'
  },
  {
    id: 'tourn-4',
    name: 'دوري كرة السلة 3x3 - فئة الفتيان',
    seasonId: '2026/2027',
    sportId: 'basketball',
    ageCategory: 'U15',
    gender: 'Male',
    level: 'Middle',
    scope: 'Provincial',
    affiliationType: 'non_club',
    startDate: new Date('2026-03-15'),
    endDate: new Date('2026-03-28'),
    status: 'Scheduled',
    description: 'المنافسات المفتوحة لكرة السلة 3x3 لفرق المؤسسات الإعدادية.',
    managerName: 'ذ. مصطفى الغازي',
    managerPhone: '0666789012',
    managerEmail: 'ghazi.basket@taourirt.ma',
    accessCode: 'BB-9031',
    directorateId: 'taourirt'
  },
  {
    id: 'tourn-cross-country',
    name: 'البطولة الإقليمية المدرسية للعدو الريفي (جميع الفئات)',
    seasonId: '2026/2027',
    sportId: 'cross_country',
    ageCategory: 'جميع الفئات (U12 / U15 / U18 / U20)',
    gender: 'Mixed',
    level: 'جميع الأسلاك',
    scope: 'Provincial',
    affiliationType: 'non_club',
    startDate: new Date('2026-03-01'),
    endDate: new Date('2026-03-30'),
    status: 'Scheduled',
    description: 'البطولة الإقليمية الرسمية للعدو الريفي المدرسي لجميع الفئات ذكورا وإناثا.',
    managerName: 'ذ. المشرف على العدو الريفي',
    managerPhone: '0660001122',
    managerEmail: 'cross.country@taourirt.ma',
    accessCode: 'CC-2026',
    directorateId: 'taourirt'
  }
];

export const INITIAL_SCHOOLS: School[] = [
  { id: 'sch-1', name: 'ثانوية الفتح التأهيلية', type: 'تأهيلي', commune: 'تاوريرت المركز', teacherName: 'ذ. عبد الرحيم بلقاسم', coordinatorName: 'ذ. عبد الرحيم بلقاسم', phone: '0661234567', principalName: 'ذ. محمد اليعقوبي', principalPhone: '0661998877', directorateId: 'taourirt' },
  { id: 'sch-2', name: 'ثانوية علال الفاسي التأهيلية', type: 'تأهيلي', commune: 'العيون سيدي ملوك', teacherName: 'ذ. رشيد الداودي', coordinatorName: 'ذ. رشيد الداودي', phone: '0662345678', principalName: 'ذ. أحمد المريني', principalPhone: '0662887766', directorateId: 'taourirt' },
  { id: 'sch-3', name: 'إعدادية ابن سينا', type: 'إعدادي', commune: 'تاوريرت', teacherName: 'ذة. فاطمة الزهراء بنعلي', coordinatorName: 'ذة. فاطمة الزهراء بنعلي', phone: '0663456789', principalName: 'ذ. حسن المنصوري', principalPhone: '0663776655', directorateId: 'taourirt' },
  { id: 'sch-4', name: 'إعدادية سيدي لحسن', type: 'إعدادي', commune: 'سيدي لحسن', teacherName: 'ذ. حميد بنعيسى', coordinatorName: 'ذ. حميد بنعيسى', phone: '0664567890', principalName: 'ذ. إبراهيم الزايدي', principalPhone: '0664665544', directorateId: 'taourirt' },
  { id: 'sch-5', name: 'مجموعة مدارس دبدو', type: 'ابتدائي', commune: 'دبدو', teacherName: 'ذ. يوسف المراكشي', coordinatorName: 'ذ. يوسف المراكشي', phone: '0665678901', principalName: 'ذ. عبد القادر الفاسي', principalPhone: '0665554433', directorateId: 'taourirt' },
  { id: 'sch-6', name: 'ثانوية الزيتون التأهيلية', type: 'تأهيلي', commune: 'تاوريرت', teacherName: 'ذ. مصطفى الغازي', coordinatorName: 'ذ. مصطفى الغازي', phone: '0666789012', principalName: 'ذ. عمر الشريف', principalPhone: '0666443322', directorateId: 'taourirt' }
];

export const INITIAL_VENUES: Venue[] = [
  { id: 'ven-1', name: 'القاعة المغطاة للرياضات بتاوريرت', city: 'تاوريرت', address: 'شارع الحسن الثاني، تاوريرت', capacity: 1500, directorateId: 'taourirt' },
  { id: 'ven-2', name: 'الملعب البلدي تاوريرت', city: 'تاوريرت', address: 'حي المسيرة، تاوريرت', capacity: 3000, directorateId: 'taourirt' },
  { id: 'ven-3', name: 'القاعة الرياضية بالعيون سيدي ملوك', city: 'العيون سيدي ملوك', address: 'طريق وجدة، العيون', capacity: 800, directorateId: 'taourirt' },
  { id: 'ven-4', name: 'ملاعب ثانوية الفتح', city: 'تاوريرت', address: 'قرب المديرية الإقليمية', capacity: 400, directorateId: 'taourirt' }
];

export const INITIAL_MATCHES: Match[] = [];
