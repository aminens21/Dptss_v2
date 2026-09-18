import React, { useState, useMemo } from 'react';
import { Tournament, Match, School, User, Venue } from '../types';
import { SPORTS_MAP } from '../lib/dataService';
import { SPORTS_CONFIG } from '../config/sportsConfig';
import { ProgramExportModal } from './ProgramExportModal';
import {
  downloadProgramAsPdf,
  downloadProgramAsWord,
  printProgram
} from '../lib/programExportService';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Download,
  Printer,
  Filter,
  Trophy,
  MapPin,
  Clock,
  Users,
  Medal,
  CalendarDays,
  FileText,
  Sparkles,
  Search,
  CheckCircle2,
  ExternalLink,
  Plus,
  Layers,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface CalendarEventItem {
  id: string;
  title: string;
  sportId: string;
  sportName: string;
  sportIcon: string;
  scope: 'provincial' | 'regional' | 'national';
  date: string; // YYYY-MM-DD
  time?: string;
  venue: string;
  category: string;
  gender: 'Male' | 'Female' | 'Mixed';
  organizer: string;
  coordinator?: string;
  notes?: string;
  isRealData?: boolean;
  rawTournament?: Tournament;
  rawMatch?: Match;
}

interface ChampionshipCalendarViewProps {
  tournaments: Tournament[];
  matches: Match[];
  schools: School[];
  venues?: Venue[];
  userProfile?: User | null;
  activeSeason: string;
  onNavigateToTournament?: (tournamentId: string) => void;
  onOpenCreateMatch?: (initialDate?: string) => void;
  onOpenMatchDetail?: (match: Match) => void;
}

// Proposed official annual program for Moroccan School Sports in Taourirt & Oriental region
const OFFICIAL_PROPOSED_PROGRAM: Omit<CalendarEventItem, 'sportName' | 'sportIcon'>[] = [
  // November 2026
  {
    id: 'prop-cc-prov',
    title: 'البطولة الإقليمية المدرسية للعدو الريفي',
    sportId: 'cross_country',
    scope: 'provincial',
    date: '2026-11-12',
    time: '09:00 صباحاً',
    venue: 'مطاف وحلبة العدو الريفي بتاوريرت',
    category: 'جميع الفئات (U12, U15, U18, U20)',
    gender: 'Mixed',
    organizer: 'الفرع الإقليمي للجامعة الملكية المغربية للرياضة المدرسية بتاوريرت',
    coordinator: 'ذ. عبد الرحيم بلقاسم',
    notes: 'مشاركة جميع المؤسسات التعليمية الابتدائية، الإعدادية والتأهيلية بالإقليم'
  },
  {
    id: 'prop-fb-prov-qual',
    title: 'تصفيات البطولة الإقليمية لكرة القدم المصغرة',
    sportId: 'football',
    scope: 'provincial',
    date: '2026-11-25',
    time: '14:30 بعد الزوال',
    venue: 'ملاعب القرب والقاعة المغطاة تاوريرت',
    category: 'فئة البراعم والصغار (U12 - U15)',
    gender: 'Male',
    organizer: 'اللجنة التقنية الإقليمية لكرة القدم المدرسية',
    coordinator: 'ذ. إبراهيم بنعلي',
    notes: 'إقصائيات تمهيدية بين أحواض تاوريرت، العيون سيدي ملوك ودبدو'
  },
  // December 2026
  {
    id: 'prop-cc-reg',
    title: 'البطولة الجهوية المدرسية للعدو الريفي (جهة الشرق)',
    sportId: 'cross_country',
    scope: 'regional',
    date: '2026-12-06',
    time: '09:30 صباحاً',
    venue: 'مطاف السعيدية / حلبة وجدة سيدي يحيى',
    category: 'المتأهلون من البطولات الإقليمية (U15, U18, U20)',
    gender: 'Mixed',
    organizer: 'الأكاديمية الجهوية للتربية والتكوين لجهة الشرق والفرع الجهوي للجامعة',
    coordinator: 'اللجنة التقنية الجهوية للعدو الريفي',
    notes: 'تأهيل أحسن العدائين والفرق لتمثيل جهة الشرق في البطولة الوطنية'
  },
  {
    id: 'prop-bb-prov',
    title: 'نهائيات البطولة الإقليمية لكرة السلة 3x3',
    sportId: 'basketball',
    scope: 'provincial',
    date: '2026-12-16',
    time: '10:00 صباحاً',
    venue: 'القاعة المغطاة تاوريرت',
    category: 'فئة الفتيان والشبان (U18 - U20)',
    gender: 'Mixed',
    organizer: 'فرع تاوريرت للجامعة الملكية للرياضة المدرسية',
    coordinator: 'ذ. محمد القادري',
    notes: 'مباريات حماسية بمشاركة 16 مؤسسة تعليمية إعدادية وتأهيلية'
  },
  {
    id: 'prop-hb-prov',
    title: 'تصفيات البطولة الإقليمية لكرة اليد المدرسية',
    sportId: 'handball',
    scope: 'provincial',
    date: '2026-12-23',
    time: '14:00 زوالاً',
    venue: 'ملاعب ثانوية الفتح التأهيلية وثانوية 9 أبريل',
    category: 'فئة الصغار والفتيان (U15 - U18)',
    gender: 'Male',
    organizer: 'اللجنة التقنية الإقليمية لكرة اليد',
    coordinator: 'ذ. رشيد المنصوري',
    notes: 'مباريات بنظام خروج المغلوب'
  },
  // January 2027
  {
    id: 'prop-cc-nat',
    title: 'البطولة الوطنية المدرسية للعدو الريفي (المستوى الوطني)',
    sportId: 'cross_country',
    scope: 'national',
    date: '2027-01-10',
    time: '09:00 صباحاً',
    venue: 'حلبة باب جديد بمراكش / الرباط',
    category: 'نخبة أبطال جهات المملكة المتأهلون (U15, U18, U20)',
    gender: 'Mixed',
    organizer: 'وزارة التربية الوطنية والجامعة الملكية المغربية للرياضة المدرسية',
    coordinator: 'المسؤول الوطني للجامعة',
    notes: 'تتويج أبطال المغرب المدرسيين بحضور شخصيات وازنة'
  },
  {
    id: 'prop-vb-prov',
    title: 'البطولة الإقليمية المدرسية للكرة الطائرة',
    sportId: 'volleyball',
    scope: 'provincial',
    date: '2027-01-18',
    time: '14:30 زوالاً',
    venue: 'القاعة المغطاة المسيرة تاوريرت',
    category: 'فئة الفتيات والشابات (U15 - U18)',
    gender: 'Female',
    organizer: 'لجنة تطوير الرياضة النسوية المدرسية بتاوريرت',
    coordinator: 'الأستاذة فاطمة الزهراء المرابط',
    notes: 'تشجيع الممارسة الرياضية النسوية المدرسية'
  },
  {
    id: 'prop-tt-prov',
    title: 'إقصائيات كرة الطاولة المدرسية (فردي وزوجي)',
    sportId: 'table_tennis',
    scope: 'provincial',
    date: '2027-01-25',
    time: '09:30 صباحاً',
    venue: 'النادي الرياضي البلدي وقاعة الأنشطة بالثانوية التأهيلية المرينيين',
    category: 'جميع الفئات (ذكور وإناث)',
    gender: 'Mixed',
    organizer: 'اللجنة التقنية الإقليمية لكرة الطاولة',
    coordinator: 'ذ. طارق العلمي',
    notes: 'بطولة مفتوحة وتأهيل الفائزين للبطولة الجهوية'
  },
  // February 2027
  {
    id: 'prop-team-reg-1',
    title: 'البطولة الجهوية للرياضات الجماعية (شطر الناظور - تاوريرت - جرسيف - الدريوش)',
    sportId: 'football',
    scope: 'regional',
    date: '2027-02-08',
    time: '10:00 صباحاً',
    venue: 'المركب الرياضي بتاوريرت والقاعة المغطاة بالناظور',
    category: 'فئة الصغار والفتيان (كرة قدم، كرة سلة، كرة يد)',
    gender: 'Mixed',
    organizer: 'الأكاديمية الجهوية للتربية والتكوين لجهة الشرق',
    coordinator: 'ممثلو المديريات الإقليمية الأربعة',
    notes: 'نصف نهائيات جهة الشرق'
  },
  {
    id: 'prop-chess-prov',
    title: 'البطولة الإقليمية للشطرنج والرياضات الذهنية المدرسية',
    sportId: 'athletics',
    scope: 'provincial',
    date: '2027-02-15',
    time: '09:00 صباحاً',
    venue: 'مركز التفتح الفني والأدبي والرياضي بتاوريرت',
    category: 'التعليم الابتدائي، الإعدادي والتأهيلي',
    gender: 'Mixed',
    organizer: 'الفرع الإقليمي لجامعة الرياضة المدرسية',
    coordinator: 'ذ. يوسف الشريف',
    notes: 'تعزيز الذكاء الاستراتيجي لدى المتعلمات والمتعلمين'
  },
  {
    id: 'prop-badm-gym-prov',
    title: 'البطولة الإقليمية للبادمنتون والجمباز المدرسي',
    sportId: 'volleyball',
    scope: 'provincial',
    date: '2027-02-22',
    time: '14:00 زوالاً',
    venue: 'القاعة المغطاة المسيرة تاوريرت',
    category: 'فئة البراعم والصغار',
    gender: 'Mixed',
    organizer: 'اللجنة التقنية للجمباز والريشة الطائرة',
    coordinator: 'الأستاذة سناء الوهابي',
    notes: 'عروض فردية وجماعية ومنافسات البادمنتون'
  },
  // March 2027
  {
    id: 'prop-ath-prov',
    title: 'البطولة الإقليمية المدرسية لألعاب القوى (المضمار والميدان)',
    sportId: 'athletics',
    scope: 'provincial',
    date: '2027-03-07',
    time: '08:30 صباحاً',
    venue: 'الملعب البلدي وحلبة ألعاب القوى تاوريرت',
    category: 'السرعة، الوثب، رمي الجلة، والمسافات المتوسطة',
    gender: 'Mixed',
    organizer: 'فرع تاوريرت للجامعة الملكية للرياضة المدرسية',
    coordinator: 'ذ. عبد الرحيم بلقاسم وذ. كريم الناصري',
    notes: 'تحديد المنتخب الإقليمي لألعاب القوى'
  },
  {
    id: 'prop-ath-reg',
    title: 'البطولة الجهوية المدرسية لألعاب القوى',
    sportId: 'athletics',
    scope: 'regional',
    date: '2027-03-18',
    time: '09:00 صباحاً',
    venue: 'الملعب الشرفي بوجدة / حلبة بركان الأولمبية',
    category: 'أبطال الأقاليم الثمانية لجهة الشرق',
    gender: 'Mixed',
    organizer: 'الأكاديمية الجهوية لجهة الشرق والفرع الجهوي للجامعة',
    coordinator: 'اللجنة التقنية الجهوية لألعاب القوى',
    notes: 'التأهيل للبطولة الوطنية المدرسية'
  },
  {
    id: 'prop-team-reg-finals',
    title: 'نهائيات البطولة الجهوية للرياضات الجماعية (كرة القدم، السلة، اليد، الطائرة)',
    sportId: 'basketball',
    scope: 'regional',
    date: '2027-03-28',
    time: '10:00 صباحاً',
    venue: 'القاعات المغطاة والملاعب الكبرى بوجدة',
    category: 'المتأهلون لنهائي جهة الشرق',
    gender: 'Mixed',
    organizer: 'أكاديمية جهة الشرق',
    coordinator: 'المكتب المديري الجهوي للرياضة المدرسية',
    notes: 'تتويج أبطال جهة الشرق المتأهلين للبطولة الوطنية'
  },
  // April 2027
  {
    id: 'prop-nat-teams',
    title: 'البطولة الوطنية المدرسية للرياضات الجماعية',
    sportId: 'football',
    scope: 'national',
    date: '2027-04-12',
    time: '09:00 صباحاً',
    venue: 'المركبات الرياضية والقاعات المغطاة بطنجة وتطوان',
    category: 'أبطال جهات المملكة الـ 12',
    gender: 'Mixed',
    organizer: 'وزارة التربية الوطنية والجامعة الملكية المغربية للرياضة المدرسية',
    coordinator: 'اللجنة المركزية للبطولات الوطنية',
    notes: 'تتويج أبطال المغرب المدرسيين في الرياضات الجماعية'
  },
  {
    id: 'prop-nat-indiv',
    title: 'البطولة الوطنية المدرسية لألعاب القوى وكرة الطاولة',
    sportId: 'athletics',
    scope: 'national',
    date: '2027-04-24',
    time: '09:00 صباحاً',
    venue: 'المركب الرياضي أدرار بأكادير',
    category: 'نخبة أبطال ألعاب القوى بالمملكة',
    gender: 'Mixed',
    organizer: 'الجامعة الملكية المغربية للرياضة المدرسية',
    coordinator: 'الجامعة الملكية المغربية للرياضة المدرسية',
    notes: 'تحطيم أرقام قياسية وطنية مدرسية'
  },
  // May 2027
  {
    id: 'prop-gymnasiade-nat',
    title: 'الجمنزياد الوطني للرياضة المدرسية والمهرجان الختامي',
    sportId: 'athletics',
    scope: 'national',
    date: '2027-05-10',
    time: '10:00 صباحاً',
    venue: 'المجمع الرياضي الأمير مولاي عبد الله بالرباط',
    category: 'مختلف الرياضات الفردية والجماعية',
    gender: 'Mixed',
    organizer: 'الوزارة الوصية والجامعة الملكية المغربية للرياضة المدرسية',
    coordinator: 'المسؤولون المركزيون',
    notes: 'اختتام الموسم الرياضي المدرسي الوطني'
  },
  {
    id: 'prop-closing-prov',
    title: 'الحفل الإقليمي الختامي وتتويج الفرق والأساتذة والتلاميذ المتوجين',
    sportId: 'cross_country',
    scope: 'provincial',
    date: '2027-05-20',
    time: '16:00 مساءً',
    venue: 'قاعة الأنشطة الكبرى بالمديرية الإقليمية تاوريرت',
    category: 'جميع المؤسسات المتوجة والأطر المكرمة',
    gender: 'Mixed',
    organizer: 'المديرية الإقليمية لوزارة التربية الوطنية بتاوريرت',
    coordinator: 'السيد المدير الإقليمي ورئيس الفرع الإقليمي',
    notes: 'توزيع الجوائز والشواهد التقديرية والكؤوس والميداليات'
  }
];

export const ChampionshipCalendarView: React.FC<ChampionshipCalendarViewProps> = ({
  tournaments,
  matches,
  schools,
  venues,
  userProfile,
  activeSeason,
  onNavigateToTournament,
  onOpenCreateMatch,
  onOpenMatchDetail
}) => {
  // Hover Popover & Quick Modal States
  const [hoveredDateKey, setHoveredDateKey] = useState<string | null>(null);
  const [activeQuickModalDate, setActiveQuickModalDate] = useState<string | null>(null);

  // Calendar Navigation State
  // Default to November 2026 or current active date in Moroccan school calendar
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    // If today is within 2026/2027 school year, use today, otherwise default to November 2026
    const yr = today.getFullYear();
    if (yr === 2026 || yr === 2027) return today;
    return new Date(2026, 10, 12); // Nov 12, 2026
  });

  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    // Default to '2026-11-12' (Cross Country date) or today
    const today = new Date();
    const yr = today.getFullYear();
    if (yr === 2026 || yr === 2027) {
      return today.toISOString().split('T')[0];
    }
    return '2026-11-12';
  });

  // Filter States
  const [scopeFilter, setScopeFilter] = useState<'ALL' | 'provincial' | 'regional' | 'national'>('ALL');
  const [sportFilter, setSportFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportModalInitialSports, setExportModalInitialSports] = useState<string[]>([]);

  // Unify and build all events from:
  // 1. Official Proposed program
  // 2. Real tournaments in the database
  // 3. Real scheduled matches in the database
  const allEvents = useMemo<CalendarEventItem[]>(() => {
    const list: CalendarEventItem[] = [];

    // 1. Add Proposed Program items
    OFFICIAL_PROPOSED_PROGRAM.forEach(item => {
      const sp = SPORTS_MAP[item.sportId] || { name: 'رياضة مدرسية', icon: '🏆' };
      list.push({
        ...item,
        sportName: sp.name,
        sportIcon: sp.icon,
        isRealData: false
      });
    });

    // 2. Add Real Tournaments from database
    tournaments.forEach(t => {
      if (!t.startDate) return;
      const sp = SPORTS_MAP[t.sportId] || { name: t.name, icon: '🏆' };
      
      // Determine scope
      let sc: 'provincial' | 'regional' | 'national' = 'provincial';
      if (t.scope === 'national') sc = 'national';
      else if (t.scope === 'regional') sc = 'regional';
      else if (t.name.includes('وطني') || t.name.includes('الوطنية')) sc = 'national';
      else if (t.name.includes('جهوي') || t.name.includes('الجهوية')) sc = 'regional';

      const dateStr = typeof t.startDate === 'string'
        ? t.startDate.split('T')[0]
        : (t.startDate as any)?.toDate?.()?.toISOString()?.split('T')[0] || '';

      if (dateStr) {
        list.push({
          id: `real-t-${t.id}`,
          title: t.name,
          sportId: t.sportId,
          sportName: sp.name,
          sportIcon: sp.icon,
          scope: sc,
          date: dateStr,
          time: '10:00 صباحاً',
          venue: t.location || 'القاعة الرياضية بتاوريرت',
          category: t.category || 'جميع الفئات المعتمدة',
          gender: (t.gender as any) || 'Mixed',
          organizer: 'المديرية الإقليمية تاوريرت',
          coordinator: t.managerName || 'المسؤول المركزي',
          notes: t.description || 'بطولة مبرمجة بالنظام',
          isRealData: true,
          rawTournament: t
        });
      }
    });

    // 3. Add Real Matches from database
    matches.forEach(m => {
      if (!m.date) return;
      const sp = SPORTS_MAP[m.sportId || 'football'] || { name: 'كرة القدم', icon: '⚽' };
      let dateStr = '';
      if (typeof m.date === 'string') dateStr = m.date.split('T')[0];
      else if ((m.date as any)?.toDate) dateStr = (m.date as any).toDate().toISOString().split('T')[0];
      else if (m.date instanceof Date) dateStr = m.date.toISOString().split('T')[0];

      if (dateStr) {
        const school1 = schools.find(s => s.id === m.team1Id)?.name || 'فريق 1';
        const school2 = schools.find(s => s.id === m.team2Id)?.name || 'فريق 2';
        const venueObj = venues?.find(v => v.id === m.venueId);
        const venueName = venueObj?.name || (m as any).location || 'مركز التباري بتاوريرت';

        list.push({
          id: `real-m-${m.id}`,
          title: `مباراة: ${school1} ضد ${school2}`,
          sportId: m.sportId || 'football',
          sportName: sp.name,
          sportIcon: sp.icon,
          scope: 'provincial',
          date: dateStr,
          time: m.startTime || (m as any).time || '15:00',
          venue: venueName,
          category: m.ageCategory ? `${m.ageCategory} (${m.stage ? `دور ${m.stage}` : ''})` : (m.stage ? `دور ${m.stage}` : 'مباراة رسمية'),
          gender: m.gender || 'Male',
          organizer: 'لجنة التحكيم والبرمجة بالمديرية',
          notes: `الحالة: ${m.status === 'Completed' ? `منتهية (النتيجة: ${m.score1} - ${m.score2})` : 'مبرمجة'}${m.referees && m.referees.length > 0 ? ` • الحكام: ${m.referees.join(', ')}` : ''}`,
          isRealData: true,
          rawMatch: m
        });
      }
    });

    return list;
  }, [tournaments, matches, schools, venues]);

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const matchesScope = scopeFilter === 'ALL' || ev.scope === scopeFilter;
      const matchesSport = sportFilter === 'ALL' || ev.sportId === sportFilter;
      const matchesSearch = !searchQuery ||
        ev.title.includes(searchQuery) ||
        ev.sportName.includes(searchQuery) ||
        ev.venue.includes(searchQuery) ||
        (ev.coordinator && ev.coordinator.includes(searchQuery)) ||
        (ev.category && ev.category.includes(searchQuery));
      return matchesScope && matchesSport && matchesSearch;
    });
  }, [allEvents, scopeFilter, sportFilter, searchQuery]);

  // Map of date string -> events list for fast lookup in calendar days
  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEventItem[]> = {};
    filteredEvents.forEach(ev => {
      if (!map[ev.date]) {
        map[ev.date] = [];
      }
      map[ev.date].push(ev);
    });
    return map;
  }, [filteredEvents]);

  // Events on the currently selected date
  const selectedDateEvents = useMemo(() => {
    return eventsByDate[selectedDateStr] || [];
  }, [eventsByDate, selectedDateStr]);

  // Days in month logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'ماي', 'يونيو',
    'يوليوز', 'غشت', 'شتنبر', 'أكتوبر', 'نونبر', 'دجنبر'
  ];

  const weekdaysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sunday

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDateStr(today.toISOString().split('T')[0]);
  };

  const formatFullArabicDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      const dayName = weekdaysArabic[dateObj.getDay()];
      const monthName = monthNamesArabic[m - 1];
      return `${dayName} ${d} ${monthName} ${y}`;
    } catch {
      return dateStr;
    }
  };

  const getScopeBadge = (scope: 'provincial' | 'regional' | 'national') => {
    switch (scope) {
      case 'provincial':
        return (
          <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
            🏆 بطولة إقليمية (تاوريرت)
          </span>
        );
      case 'regional':
        return (
          <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-200">
            🏅 بطولة جهوية (جهة الشرق)
          </span>
        );
      case 'national':
        return (
          <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300">
            🥇 بطولة وطنية (المملكة المغربية)
          </span>
        );
    }
  };

  // ==========================================
  // EXPORT HANDLERS (PDF / WORD / PRINT)
  // ==========================================
  const getCalendarExportOptions = () => ({
    events: allEvents.map(e => ({
      ...e,
      sportName: e.sportName || SPORTS_MAP[e.sportId]?.name || e.sportId,
      sportIcon: e.sportIcon || SPORTS_MAP[e.sportId]?.icon || '🏆'
    })),
    selectedSportIds: sportFilter !== 'ALL' ? [sportFilter] : [],
    scopeFilter,
    activeSeason
  });

  // 1. Direct PDF Download (SEPARATE from window.print!)
  const handleDirectPdfDownload = async () => {
    await downloadProgramAsPdf(getCalendarExportOptions());
  };

  // 2. Direct Word Download (.doc)
  const handleExportWord = () => {
    downloadProgramAsWord(getCalendarExportOptions());
  };

  // 3. Print Program (Dedicated printer screen)
  const handlePrintPdf = () => {
    printProgram(getCalendarExportOptions());
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-4 sm:p-6 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-blue-400" />
                <span>رزنامة البرنامج الرياضي المدرسي (Calendrier)</span>
              </span>
              <span className="bg-white/10 text-slate-200 text-xs font-bold px-2.5 py-1 rounded border border-white/10">
                الموسم {activeSeason}
              </span>
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold px-2.5 py-1 rounded-full">
                إقليمي • جهوي • وطني
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl font-black text-white mt-2 flex items-center gap-2.5">
              <span>البرنامج والمواعيد الرسمية للمنافسات والبطولات</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-3xl font-medium leading-relaxed">
              جدول زمني تفاعلي (Calendrier) لكافة البطولات والمباريات المدرسية. اضغط على أي يوم في الرزنامة لاكتشاف المنافسات المبرمجة فيه، مع إمكانية تحميل البرنامج بصيغة PDF أو Word أو طباعته، وتخصيص تحميل بطولة معينة.
            </p>
          </div>

          {/* Download & Print Actions - Distinct & Granular */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* 1. SEPARATE PDF DOWNLOAD */}
            <button
              onClick={handleDirectPdfDownload}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 active:bg-red-800 text-white text-xs font-bold shadow-md transition-all cursor-pointer hover:scale-102 active:scale-98"
              title="تحميل البرنامج بصيغة PDF مباشرة إلى جهازك"
            >
              <Download className="h-4 w-4" />
              <span>تحميل (PDF)</span>
            </button>

            {/* 2. WORD DOWNLOAD */}
            <button
              onClick={handleExportWord}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md transition-all cursor-pointer hover:scale-102 active:scale-98"
              title="تحميل البرنامج بصيغة Microsoft Word قابلة للتعديل"
            >
              <FileText className="h-4 w-4" />
              <span>تحميل (Word)</span>
            </button>

            {/* 3. PRINT BUTTON (SEPARATE) */}
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold shadow-xs transition-all cursor-pointer"
              title="طباعة البرنامج ورقية فورية"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة البرنامج</span>
            </button>

            {/* 4. GRANULAR SELECTION MODAL BUTTON */}
            <button
              onClick={() => {
                setExportModalInitialSports(sportFilter !== 'ALL' ? [sportFilter] : []);
                setIsExportModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-md transition-all cursor-pointer hover:scale-102"
              title="تخصيص استخراج وتنزيل برنامج بطولة واحدة معينة أو بطولتين أو أكثر"
            >
              <Layers className="h-4 w-4" />
              <span>تخصيص بطولة معينة...</span>
            </button>
          </div>
        </div>

        {/* Filter Pills Ribbon */}
        <div className="mt-5 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Level Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
            {[
              { id: 'ALL', label: 'جميع المستويات (الشامل)', icon: '🌐' },
              { id: 'provincial', label: 'بطولة إقليمية (تاوريرت)', icon: '🏆' },
              { id: 'regional', label: 'بطولة جهوية (الجهة الشرقية)', icon: '🏅' },
              { id: 'national', label: 'بطولة وطنية (المملكة)', icon: '🥇' },
            ].map(tab => {
              const isActive = scopeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setScopeFilter(tab.id as any)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sport Filter Dropdown */}
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/15">
            <span className="text-slate-300 font-bold text-xs">نوع الرياضة:</span>
            <select
              value={sportFilter}
              onChange={e => setSportFilter(e.target.value)}
              className="bg-slate-900/90 text-white font-bold text-xs rounded-lg px-2.5 py-1 border border-white/20 focus:outline-hidden cursor-pointer"
            >
              <option value="ALL">كافة الرياضات (الشامل)</option>
              {SPORTS_CONFIG.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Quick Search Field */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search className="absolute right-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث عن بطولة، رياضة، مكان أو مؤطر..."
              className="w-full bg-white/10 border border-white/15 rounded-xl pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-400"
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Calendar on Right (8 cols) + Selected Day Events on Left (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* ======================================================== */}
        {/* Interactive Calendar Grid (8 cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-3xs p-4 sm:p-5 flex flex-col">
          {/* Calendar Header: Month Navigator & Quick Jump */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <CalendarIcon className="h-5 w-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-black text-slate-800">
                  {monthNamesArabic[month]} {year}
                </h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  الموسم الرياضي المدرسي {activeSeason}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={goToToday}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors cursor-pointer"
              >
                اليوم
              </button>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80">
                <button
                  onClick={nextMonth}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
                  title="الشهر القادم"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={prevMonth}
                  className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition-colors cursor-pointer"
                  title="الشهر السابق"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Weekday Names Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 my-2.5 text-center">
            {weekdaysArabic.map((dayName, idx) => (
              <div
                key={dayName}
                className={`py-2 text-xs font-black rounded-lg ${
                  idx === 5 || idx === 6 ? 'text-amber-700 bg-amber-50/60' : 'text-slate-600 bg-slate-50'
                }`}
              >
                {dayName}
              </div>
            ))}
          </div>

          {/* Calendar Days Matrix */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 flex-1 auto-rows-fr">
            {/* Blank leading days from previous month */}
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[75px] sm:min-h-[90px] p-1 bg-slate-50/30 rounded-xl border border-dashed border-slate-100 opacity-40"
              />
            ))}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNumber = i + 1;
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
              const dayEvents = eventsByDate[dateKey] || [];
              const isSelected = selectedDateStr === dateKey;
              const hasEvents = dayEvents.length > 0;

              return (
                <div
                  key={dateKey}
                  onMouseEnter={() => setHoveredDateKey(dateKey)}
                  onMouseLeave={() => setHoveredDateKey(null)}
                  onClick={() => {
                    setSelectedDateStr(dateKey);
                    if (hasEvents) {
                      setActiveQuickModalDate(dateKey);
                    }
                  }}
                  className={`min-h-[75px] sm:min-h-[95px] p-1.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between group relative ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/30 shadow-xs'
                      : hasEvents
                      ? 'border-blue-200 bg-white hover:bg-blue-50/30 hover:border-blue-300 shadow-3xs'
                      : 'border-slate-100 bg-white hover:bg-slate-50 hover:border-slate-200'
                  }`}
                >
                  {/* Hover Popover preview tooltip on hover */}
                  {hoveredDateKey === dateKey && hasEvents && (
                    <div className="absolute z-40 bottom-full mb-2 right-0 w-64 bg-slate-900 text-white rounded-xl p-3 shadow-2xl border border-slate-700 animate-in fade-in zoom-in-95 duration-100 pointer-events-none" dir="rtl">
                      <div className="flex items-center justify-between pb-1.5 border-b border-slate-700 text-[10px] text-blue-300 font-bold">
                        <span className="flex items-center gap-1">
                          <CalendarDays className="w-3 h-3 text-blue-400" />
                          <span>{dateKey}</span>
                        </span>
                        <span className="bg-blue-600 text-white px-1.5 py-0.5 rounded-full text-[9px]">
                          {dayEvents.length} {dayEvents.length === 1 ? 'مباراة' : 'مباريات'}
                        </span>
                      </div>
                      <div className="mt-2 space-y-1.5 max-h-36 overflow-y-auto">
                        {dayEvents.slice(0, 3).map(ev => (
                          <div key={`hov-${ev.id}`} className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-[10px]">
                            <div className="flex items-center gap-1 font-bold text-blue-200 truncate">
                              <span>{ev.sportIcon}</span>
                              <span className="truncate">{ev.title}</span>
                            </div>
                            <div className="text-[9px] text-slate-300 mt-1 flex items-center justify-between font-medium">
                              <span className="truncate max-w-[120px]">📍 {ev.venue}</span>
                              <span>⏰ {ev.time}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 text-[9px] text-blue-400 font-extrabold text-center border-t border-slate-800 pt-1">
                        ✨ انقر لالتقاط الخلية واقتطاع النافذة المنبثقة
                      </div>
                    </div>
                  )}

                  {/* Day number & indicators */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs sm:text-sm font-black w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : hasEvents
                          ? 'text-blue-700 font-black'
                          : 'text-slate-700'
                      }`}
                    >
                      {dayNumber}
                    </span>

                    {hasEvents && (
                      <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.5 rounded-full">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Event Badges inside calendar cell */}
                  <div className="mt-1 space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map(ev => {
                      const scopeColor =
                        ev.scope === 'national'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : ev.scope === 'regional'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : 'bg-blue-100 text-blue-800 border-blue-300';

                      return (
                        <div
                          key={ev.id}
                          className={`text-[9px] sm:text-[10px] font-bold px-1 py-0.5 rounded truncate border ${scopeColor}`}
                          title={`${ev.sportName}: ${ev.title}`}
                        >
                          <span className="ml-1">{ev.sportIcon}</span>
                          <span>{ev.title}</span>
                        </div>
                      );
                    })}

                    {dayEvents.length > 2 && (
                      <div className="text-[9px] font-bold text-slate-400 text-center">
                        +{dayEvents.length - 2} المزيد...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Legend */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 font-medium">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                <span>بطولة إقليمية</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>بطولة جهوية</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-600" />
                <span>بطولة وطنية</span>
              </span>
            </div>

            <span>إجمالي المواعيد والأنشطة المسجلة: <strong>{filteredEvents.length} تظاهرة</strong></span>
          </div>
        </div>

        {/* ======================================================== */}
        {/* Selected Date Event Details Panel (4 cols) */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-3xs p-4 sm:p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider block">
                  البرنامج المبرمج في هذا التاريخ:
                </span>
                <h4 className="text-sm sm:text-base font-black text-slate-800 mt-0.5">
                  {formatFullArabicDate(selectedDateStr)}
                </h4>
              </div>

              {selectedDateEvents.length > 0 && (
                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full border border-blue-200">
                  {selectedDateEvents.length} أنشطة
                </span>
              )}
            </div>

            {/* List of Events on Selected Day */}
            <div className="mt-4 space-y-3">
              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-8 px-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2 text-xl">
                    📅
                  </div>
                  <h5 className="text-xs font-bold text-slate-700">لا توجد بطولات أو مباريات في هذا اليوم</h5>
                  <p className="text-[11px] text-slate-400 mt-1">
                    يمكنك استعراض الأيام المميزة في الرزنامة، أو برمجة نشاط أو مباراة جديدة في هذا التاريخ.
                  </p>

                  {onOpenCreateMatch && (
                    <button
                      onClick={() => onOpenCreateMatch(selectedDateStr)}
                      className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>برمجة مباراة في هذا اليوم</span>
                    </button>
                  )}
                </div>
              ) : (
                selectedDateEvents.map(ev => (
                  <div
                    key={ev.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/50 hover:border-blue-300 transition-all shadow-3xs space-y-2.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 text-lg flex items-center justify-center shrink-0 border border-blue-100">
                          {ev.sportIcon}
                        </span>
                        <div>
                          <h5 className="text-xs font-black text-slate-800 leading-tight">
                            {ev.title}
                          </h5>
                          <span className="text-[10px] text-slate-400 font-bold block">
                            رياضة: {ev.sportName}
                          </span>
                        </div>
                      </div>

                      {getScopeBadge(ev.scope)}
                    </div>

                    <div className="text-[11px] text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-slate-700">{ev.venue}</span>
                      </div>

                      {ev.time && (
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>التوقيت: {ev.time}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span>الفئة: <strong>{ev.category}</strong></span>
                      </div>

                      {ev.coordinator && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                          <Medal className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          <span>المؤطر المكلف: <strong className="text-slate-700">{ev.coordinator}</strong></span>
                        </div>
                      )}
                    </div>

                    {ev.notes && (
                      <div className="text-[10px] bg-white p-2 rounded-lg border border-slate-200/80 text-slate-500 leading-relaxed">
                        ℹ️ {ev.notes}
                      </div>
                    )}

                    {ev.rawTournament && onNavigateToTournament && (
                      <button
                        onClick={() => onNavigateToTournament(ev.rawTournament!.id)}
                        className="w-full mt-2 py-1.5 px-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>عرض تفاصيل ومشاركي البطولة</span>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Quick Info Box */}
          <div className="bg-gradient-to-r from-blue-50 via-indigo-50/50 to-blue-50 p-4 rounded-2xl border border-blue-200/80 text-xs text-blue-950 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-blue-900">
              <Sparkles className="h-4 w-4 text-blue-600" />
              <span>ميزة التحميل الرسمي للبرنامج</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              يمكنك تحميل البرنامج بصيغة <strong>PDF</strong> منفصلة، أو بصيغة <strong>Word (.doc)</strong>، أو طباعته ورقياً، كما يمكنك اختيار برنامج بطولة واحدة معينة أو بطولتين أو أكثر عوض الشامل فقط.
            </p>
          </div>
        </div>
      </div>

      {/* Program Export Modal (PDF / Word / Print with Granular Tournament Selection) */}
      <ProgramExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        tournaments={tournaments}
        matches={matches}
        schools={schools}
        activeSeason={activeSeason}
        initialSelectedSportIds={exportModalInitialSports}
        initialScopeFilter={scopeFilter}
      />

      {/* Interactive Popup Modal for Date Match Details */}
      {activeQuickModalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center backdrop-blur-xs text-xl shadow-inner">
                  📅
                </div>
                <div>
                  <h3 className="text-sm md:text-base font-black">
                    تفاصيل البرمجة ليوم {activeQuickModalDate}
                  </h3>
                  <p className="text-[11px] text-blue-100 font-medium">
                    {(eventsByDate[activeQuickModalDate] || []).length > 0 
                      ? `يتضمن ${(eventsByDate[activeQuickModalDate] || []).length} مبارة/تظاهرة مدرسية` 
                      : 'لا توجد أنشطة مبرمجة في هذا التاريخ'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveQuickModalDate(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 overflow-y-auto flex-1 bg-slate-50/50">
              {(eventsByDate[activeQuickModalDate] || []).length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-slate-200 p-6">
                  <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">لم يتم تسجيل أية مباراة مبرمجة لهذا اليوم</p>
                  {onOpenCreateMatch && (
                    <button
                      onClick={() => {
                        const d = activeQuickModalDate;
                        setActiveQuickModalDate(null);
                        onOpenCreateMatch(d);
                      }}
                      className="mt-4 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center gap-2 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                      <span>برمجة مباراة في هذا اليوم</span>
                    </button>
                  )}
                </div>
              ) : (
                (eventsByDate[activeQuickModalDate] || []).map(ev => {
                  const rawM = ev.rawMatch;
                  return (
                    <div
                      key={`modal-ev-${ev.id}`}
                      className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3 hover:border-blue-300 transition-all"
                    >
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 font-black flex items-center justify-center text-lg border border-blue-100">
                            {ev.sportIcon}
                          </span>
                          <div>
                            <h4 className="text-xs md:text-sm font-black text-slate-900">{ev.title}</h4>
                            <span className="text-[10px] text-slate-500 font-bold">الرياضة: {ev.sportName}</span>
                          </div>
                        </div>
                        {getScopeBadge(ev.scope)}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 font-medium bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span>التوقيت: <strong>{ev.time || '15:00'}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="truncate" title={ev.venue}>المركز: <strong>{ev.venue}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>الفئة: <strong>{ev.category}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Trophy className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>الجنس: <strong>{ev.gender === 'Male' ? 'ذكور' : ev.gender === 'Female' ? 'إناث' : 'مختلط'}</strong></span>
                        </div>
                      </div>

                      {ev.notes && (
                        <div className="text-[10px] bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl text-amber-900 font-medium leading-relaxed">
                          ℹ️ {ev.notes}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center justify-between pt-1">
                        {rawM && onOpenMatchDetail ? (
                          <button
                            onClick={() => {
                              setActiveQuickModalDate(null);
                              onOpenMatchDetail(rawM);
                            }}
                            className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer border border-blue-200"
                          >
                            <span>تعديل برمجة المقابلة والنتيجة ✏️</span>
                          </button>
                        ) : ev.rawTournament && onNavigateToTournament ? (
                          <button
                            onClick={() => {
                              setActiveQuickModalDate(null);
                              onNavigateToTournament(ev.rawTournament!.id);
                            }}
                            className="w-full py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer border border-blue-200"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>عرض تفاصيل البطولة المشاركة</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              {onOpenCreateMatch ? (
                <button
                  onClick={() => {
                    const d = activeQuickModalDate;
                    setActiveQuickModalDate(null);
                    onOpenCreateMatch(d);
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة مباراة في هذا التاريخ</span>
                </button>
              ) : <div />}
              <button
                onClick={() => setActiveQuickModalDate(null)}
                className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
