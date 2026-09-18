import { Sport } from '../types';

export const SPORTS_CONFIG: Sport[] = [
  {
    id: 'football',
    name: 'كرة القدم',
    icon: '⚽',
    description: 'منافسات كرة القدم المدرسية (ذكور وإناث)',
    ageCategories: ['U12', 'U15', 'U18', 'U20'],
    studentLimit: 14,
    isProgrammed: true
  },
  {
    id: 'futsal',
    name: 'فوتسال (داخل القاعة)',
    icon: '⚽',
    description: 'منافسات كرة القدم داخل القاعة',
    ageCategories: ['U12', 'U15', 'U18', 'U20'],
    studentLimit: 12,
    isProgrammed: true
  },
  {
    id: 'basketball',
    name: 'كرة السلة 5 ضد 5',
    icon: '🏀',
    description: 'منافسات كرة السلة التقليدية 5 ضد 5',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 12,
    isProgrammed: true
  },
  {
    id: 'basketball_3x3',
    name: 'كرة السلة 3 ضد 3',
    icon: '🏀',
    description: 'منافسات كرة السلة الثلاثية 3 ضد 3',
    ageCategories: ['U12', 'U15', 'U18', 'U20'],
    studentLimit: 5,
    isProgrammed: true
  },
  {
    id: 'volleyball',
    name: 'الكرة الطائرة',
    icon: '🏐',
    description: 'منافسات الكرة الطائرة المدرسية',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 12,
    isProgrammed: true
  },
  {
    id: 'mixed_volleyball',
    name: 'الكرة الطائرة مختلطة',
    icon: '🏐',
    description: 'منافسات الكرة الطائرة المختلطة',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 12,
    isProgrammed: true
  },
  {
    id: 'beach_volleyball',
    name: 'الكرة الطائرة الشاطئية',
    icon: '🏖️',
    description: 'منافسات الكرة الطائرة الشاطئية الثنائية',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 4,
    isProgrammed: true
  },
  {
    id: 'handball',
    name: 'كرة اليد',
    icon: '🤾',
    description: 'منافسات كرة اليد المدرسية',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 14,
    isProgrammed: true
  },
  {
    id: 'beach_handball',
    name: 'كرة اليد الشاطئية',
    icon: '🏖️',
    description: 'منافسات كرة اليد الشاطئية',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 8,
    isProgrammed: true
  },
  {
    id: 'cross_country',
    name: 'العدو الريفي',
    icon: '🏃‍♂️',
    description: 'البطولة الإقليمية والجهوية للعدو الريفي المدرسي (8 فئات)',
    ageCategories: ['U12', 'U15', 'U18', 'U20'],
    studentLimit: 40,
    isProgrammed: false
  },
  {
    id: 'athletics',
    name: 'ألعاب القوى',
    icon: '🏃',
    description: 'منافسات ألعاب القوى والمسابقات الميدانية والمضمار',
    ageCategories: ['U12', 'U15', 'U18', 'U20'],
    studentLimit: 20,
    athleticsSpecialties: [
      'سباق 60 متر سرعة',
      'سباق 80 متر سرعة',
      'سباق 100 متر سرعة',
      'سباق 1000 متر نصف طويل',
      'القفز الطولي',
      'القفز العلوي',
      'دفع الجلة (Poids)'
    ],
    isProgrammed: true
  },
  {
    id: 'badminton',
    name: 'البادمنتون',
    icon: '🏸',
    description: 'منافسات البادمنتون (كرة الريشة) فردي وزوجي',
    ageCategories: ['U12', 'U15', 'U18', 'U20'],
    studentLimit: 6,
    isProgrammed: true
  },
  {
    id: 'table_tennis',
    name: 'كرة الطاولة',
    icon: '🏓',
    description: 'منافسات تنس الطاولة المدرسية',
    ageCategories: ['U12', 'U15', 'U18', 'U20'],
    studentLimit: 6,
    isProgrammed: true
  },
  {
    id: 'chess',
    name: 'الشطرنج',
    icon: '♟️',
    description: 'منافسات الشطرنج المدرسي',
    ageCategories: ['U12', 'U15', 'U18', 'U20'],
    studentLimit: 6,
    isProgrammed: true
  },
  {
    id: 'judo',
    name: 'الجيدو',
    icon: '🥋',
    description: 'منافسات الجيدو المدرسية حسب الأوزان',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 8,
    isProgrammed: true
  },
  {
    id: 'karate',
    name: 'الكراطي',
    icon: '🥋',
    description: 'منافسات الكراطي (كاتا وكوميتي)',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 8,
    isProgrammed: true
  },
  {
    id: 'boxing',
    name: 'الملاكمة',
    icon: '🥊',
    description: 'منافسات الملاكمة المدرسية',
    ageCategories: ['U18', 'U20'],
    studentLimit: 6,
    isProgrammed: true
  },
  {
    id: 'rugby',
    name: 'الركبي',
    icon: '🏉',
    description: 'منافسات الركبي السباعي المدرسي',
    ageCategories: ['U15', 'U18', 'U20'],
    studentLimit: 12,
    isProgrammed: true
  }
];

export default SPORTS_CONFIG;
