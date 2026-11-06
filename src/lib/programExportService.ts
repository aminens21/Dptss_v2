import { Tournament, Match, School, Sport } from '../types';
import { SPORTS_MAP } from './dataService';
import toast from 'react-hot-toast';

export interface CalendarExportEvent {
  id: string;
  title: string;
  sportId: string;
  sportName: string;
  sportIcon?: string;
  scope: 'provincial' | 'regional' | 'national';
  date: string;
  time?: string;
  venue: string;
  category?: string;
  gender?: string;
  organizer?: string;
  coordinator?: string;
  notes?: string;
}

// Proposed official annual program for Moroccan School Sports in Taourirt & Oriental region
export const OFFICIAL_PROPOSED_PROGRAM: Omit<CalendarExportEvent, 'sportName' | 'sportIcon'>[] = [
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
    coordinator: 'اللجنة المركزية للرياضة المدرسية',
    notes: 'تظاهرة وطنية كبرى تجمع أبطال كافة الأكاديميات الجهوية بالمملكة'
  },
  {
    id: 'prop-vb-prov',
    title: 'البطولة الإقليمية للكرة الطائرة المدرسية',
    sportId: 'volleyball',
    scope: 'provincial',
    date: '2027-01-20',
    time: '10:00 صباحاً',
    venue: 'القاعة المغطاة بمدينة تاوريرت',
    category: 'فئة الفتيات والفتيان (U15 - U18)',
    gender: 'Mixed',
    organizer: 'فرع تاوريرت للجامعة الملكية للرياضة المدرسية',
    coordinator: 'ذ. كمال اليعقوبي',
    notes: 'دوريات تمهيدية ونهائيات تتويج أبطال الإقليم'
  },
  // February 2027
  {
    id: 'prop-tt-prov',
    title: 'البطولة الإقليمية المدرسية لكرة الطاولة والشطرنج',
    sportId: 'table_tennis',
    scope: 'provincial',
    date: '2027-02-11',
    time: '09:30 صباحاً',
    venue: 'دار الشباب تاوريرت / النادي الرياضي المعتمد',
    category: 'فردي ذكور وإناث (جميع الأسلاك)',
    gender: 'Mixed',
    organizer: 'مكتب التربية البدنية والرياضة المدرسية بالمديرية',
    coordinator: 'ذ. سمير بنجلون',
    notes: 'منافسات الذكاء وسرعة البديهة والتركيز العالي'
  },
  {
    id: 'prop-chess-prov',
    title: 'البطولة الإقليمية للشطرنج المدرسي',
    sportId: 'chess',
    scope: 'provincial',
    date: '2027-02-18',
    time: '10:00 صباحاً',
    venue: 'المركز الإقليمي للتكوينات والملتقيات تاوريرت',
    category: 'جميع الفئات المدرسية (ابتدائي، إعدادي، تأهيلي)',
    gender: 'Mixed',
    organizer: 'اللجنة التقنية للشطرنج المدرسي',
    coordinator: 'ذ. طارق المحمدي',
    notes: 'نظام الجولات السويسرية وفق القواعد الفيدرالية'
  },
  // March 2027
  {
    id: 'prop-badm-prov',
    title: 'البطولة الإقليمية للبادمنتون (كرة الريشة المدرسية)',
    sportId: 'badminton',
    scope: 'provincial',
    date: '2027-03-04',
    time: '10:00 صباحاً',
    venue: 'القاعة المغطاة المتعددة الرياضات تاوريرت',
    category: 'فئة البراعم والصغار (U12 - U15)',
    gender: 'Mixed',
    organizer: 'فرع الجامعة الملكية للرياضة المدرسية',
    coordinator: 'ذ. فاطمة الزهراء العلوي',
    notes: 'مسابقات الفردي والزوجي'
  },
  {
    id: 'prop-gym-prov',
    title: 'البطولة الإقليمية للجمباز المدرسي والرياضات الحضرية',
    sportId: 'gymnastics',
    scope: 'provincial',
    date: '2027-03-18',
    time: '10:00 صباحاً',
    venue: 'القاعة الرياضية المجهزة تاوريرت',
    category: 'التعليم الابتدائي والإعدادي',
    gender: 'Mixed',
    organizer: 'اللجنة التقنية للجمباز والحركات الإيقاعية',
    coordinator: 'ذة. خديجة بوزيان',
    notes: 'عروض الحركات الإجبارية والحرة الفردية والجماعية'
  },
  // April 2027
  {
    id: 'prop-ath-prov',
    title: 'البطولة الإقليمية المدرسية لألعاب القوى',
    sportId: 'athletics',
    scope: 'provincial',
    date: '2027-04-14',
    time: '08:30 صباحاً',
    venue: 'حلبة ألعاب القوى بالمركب الرياضي تاوريرت',
    category: 'السباقات السريعة، الرمي، الوثب لجميع الفئات',
    gender: 'Mixed',
    organizer: 'الفرع الإقليمي للجامعة والمديرية الإقليمية',
    coordinator: 'ذ. الحسين العمراني',
    notes: 'مشاركة قياسية وتأهيل الأبطال للأولمبياد المدرسي الجهوي'
  },
  {
    id: 'prop-fb-prov-final',
    title: 'نهائيات البطولة الإقليمية لكرة القدم المدرسية',
    sportId: 'football',
    scope: 'provincial',
    date: '2027-04-28',
    time: '15:00 بعد الزوال',
    venue: 'الملعب البلدي بتاوريرت',
    category: 'نهائيات فئات الصغار والفتيان والشبان',
    gender: 'Male',
    organizer: 'اللجنة التقنية المشتركة لكرة القدم المدرسية',
    coordinator: 'ذ. إبراهيم بنعلي',
    notes: 'المباراة الختامية وتوزيع الكؤوس والميداليات وشهادات الاستحقاق'
  },
  // May 2027
  {
    id: 'prop-multi-reg-final',
    title: 'البطولات الجهوية المدرسية للألعاب الجماعية (الجهة الشرقية)',
    sportId: 'basketball',
    scope: 'regional',
    date: '2027-05-12',
    time: '09:00 صباحاً',
    venue: 'القاعات المغطاة بوجدة وبركان والناظور',
    category: 'الفرق المتوجة إقليمياً (كرة السلة، كرة اليد، الطائرة)',
    gender: 'Mixed',
    organizer: 'الأكاديمية الجهوية للتربية والتكوين لجهة الشرق',
    coordinator: 'الفرع الجهوي للجامعة الملكية للرياضة المدرسية',
    notes: 'المرحلة التأهيلية المباشرة للبطولة الوطنية المدرسية'
  }
];

export function buildAllCalendarEvents(
  tournaments: Tournament[],
  matches: Match[],
  schools: School[]
): CalendarExportEvent[] {
  const list: CalendarExportEvent[] = [];

  // 1. Proposed program events
  OFFICIAL_PROPOSED_PROGRAM.forEach(item => {
    const sp = SPORTS_MAP[item.sportId] || { name: 'رياضة مدرسية', icon: '🏆' };
    list.push({
      ...item,
      sportName: sp.name,
      sportIcon: sp.icon
    });
  });

  // 2. Real Tournaments
  tournaments.forEach(t => {
    if (!t.startDate) return;
    const sp = SPORTS_MAP[t.sportId] || { name: t.name, icon: '🏆' };

    let sc: 'provincial' | 'regional' | 'national' = 'provincial';
    if (t.scope === 'national' || t.name.includes('وطني') || t.name.includes('الوطنية')) sc = 'national';
    else if (t.scope === 'regional' || t.name.includes('جهوي') || t.name.includes('الجهوية')) sc = 'regional';

    const dateStr = typeof t.startDate === 'string'
      ? t.startDate.split('T')[0]
      : (t.startDate as any)?.toDate?.()?.toISOString()?.split('T')[0] || '';

    if (dateStr) {
      list.push({
        id: `tourn-${t.id}`,
        title: t.name,
        sportId: t.sportId,
        sportName: sp.name,
        sportIcon: sp.icon,
        scope: sc,
        date: dateStr,
        time: '10:00 صباحاً',
        venue: (t as any).location || 'القاعة المغطاة بتاوريرت',
        category: t.ageCategory || (t as any).category || 'كافة الفئات العمرية المعتمدة',
        gender: (t.gender as any) || 'Mixed',
        organizer: 'المديرية الإقليمية تاوريرت - الفرع الإقليمي',
        coordinator: t.managerName || 'المسؤول التقني المركزي',
        notes: t.description || 'بطولة رسمية مبرمجة بالنظام'
      });
    }
  });

  // 3. Real Matches
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

      list.push({
        id: `match-${m.id}`,
        title: `مباراة: ${school1} ضد ${school2}`,
        sportId: m.sportId || 'football',
        sportName: sp.name,
        sportIcon: sp.icon,
        scope: 'provincial',
        date: dateStr,
        time: m.startTime || (m as any).time || '15:00',
        venue: (m as any).location || m.venueId || 'الملعب الإقليمي بتاوريرت',
        category: m.ageCategory || (m.stage ? `دور ${m.stage}` : 'مباراة رسمية'),
        gender: m.gender || 'Male',
        organizer: 'لجنة التحكيم والبرمجة بالمديرية',
        notes: `المباراة: ${m.stage || ''} • الحالة: ${m.status === 'Completed' ? 'منتهية' : 'مبرمجة'}`
      });
    }
  });

  return list;
}

export interface ProgramHtmlOptions {
  events: CalendarExportEvent[];
  selectedSportIds: string[]; // empty or ['ALL'] means all sports
  scopeFilter: 'ALL' | 'provincial' | 'regional' | 'national';
  activeSeason: string;
  customTitle?: string;
}

function getActiveDirectorateSync() {
  try {
    const activeId = localStorage.getItem('active_directorate_id') || 'taourirt';
    const raw = localStorage.getItem('taourirt_directorates');
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list)) {
        const found = list.find((d: any) => d.id === activeId);
        if (found) {
          return {
            name: found.name || 'المديرية الإقليمية',
            shortName: found.shortName || found.name || 'المديرية الإقليمية',
            region: found.region || 'جهة الشرق'
          };
        }
      }
    }
  } catch {}
  return { name: 'المديرية الإقليمية بتاوريرت', shortName: 'تاوريرت', region: 'جهة الشرق' };
}

function getOfficialLogosSync(): { ministryLogo?: string; frmssLogo?: string; ministryLogoHeight?: number; frmssLogoHeight?: number } {
  try {
    const raw = localStorage.getItem('taourirt_official_logos');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return {};
}

export function generateProgramHtml({
  events,
  selectedSportIds,
  scopeFilter,
  activeSeason,
  customTitle
}: ProgramHtmlOptions): { html: string; title: string; filenameBase: string } {
  const activeDirInfo = getActiveDirectorateSync();

  // 1. Filter events
  let filtered = events.slice();

  // Sport Filter
  const isAllSports = selectedSportIds.length === 0 || selectedSportIds.includes('ALL');
  if (!isAllSports) {
    filtered = filtered.filter(ev => selectedSportIds.includes(ev.sportId));
  }

  // Scope Filter
  if (scopeFilter !== 'ALL') {
    filtered = filtered.filter(ev => ev.scope === scopeFilter);
  }

  // Sort chronologically
  filtered.sort((a, b) => a.date.localeCompare(b.date));

  // Determine Title & Subtitle
  let title = customTitle || '';
  let filenameBase = 'برنامج_البطولات_المدرسية';

  if (!title) {
    if (isAllSports) {
      if (scopeFilter === 'provincial') {
        title = `البرنامج الرياضي المدرسي الإقليمي الشامل (${activeDirInfo.name})`;
        filenameBase = 'برنامج_البطولات_المدرسية_الاقليمي';
      } else if (scopeFilter === 'regional') {
        title = `البرنامج الرياضي المدرسي الجهوي (${activeDirInfo.region || 'جهة الشرق'})`;
        filenameBase = 'برنامج_البطولات_المدرسية_الجهوي';
      } else if (scopeFilter === 'national') {
        title = 'البرنامج الرياضي المدرسي الوطني (الجامعة الملكية للرياضة المدرسية)';
        filenameBase = 'برنامج_البطولات_المدرسية_الوطني';
      } else {
        title = 'البرنامج الرياضي المدرسي السنوي الشامل (كافة البطولات والتظاهرات)';
        filenameBase = 'برنامج_البطولات_المدرسية_الشامل';
      }
    } else if (selectedSportIds.length === 1) {
      const spId = selectedSportIds[0];
      const spName = SPORTS_MAP[spId]?.name || spId;
      title = `البرنامج والمواعيد الرسمية لبطولة ${spName}`;
      filenameBase = `برنامج_بطولة_${spName.replace(/\s+/g, '_')}`;
    } else if (selectedSportIds.length === 2) {
      const sp1 = SPORTS_MAP[selectedSportIds[0]]?.name || selectedSportIds[0];
      const sp2 = SPORTS_MAP[selectedSportIds[1]]?.name || selectedSportIds[1];
      title = `برنامج البطولتين المدرسيتين: ${sp1} و ${sp2}`;
      filenameBase = `برنامج_بطولتي_${sp1.replace(/\s+/g, '_')}_و_${sp2.replace(/\s+/g, '_')}`;
    } else {
      const names = selectedSportIds.map(id => SPORTS_MAP[id]?.name || id).join(' • ');
      title = `برنامج البطولات الرياضية المحددة: ${names}`;
      filenameBase = `برنامج_بطولات_مختارة`;
    }
  }

  const rowsHtml = filtered.length > 0 ? filtered.map((ev, index) => {
    const scopeBadge = ev.scope === 'national' ? 'بطولة وطنية' : ev.scope === 'regional' ? 'بطولة جهوية' : 'بطولة إقليمية';
    const scopeColor = ev.scope === 'national' ? '#b45309' : ev.scope === 'regional' ? '#047857' : '#1d4ed8';

    return `
      <tr style="background-color: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'};">
        <td style="border: 1px solid #cbd5e1; padding: 7px 5px; text-align: center; font-weight: bold; font-size: 11px;">${index + 1}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; text-align: center; white-space: nowrap; font-weight: bold; color: #1e3a8a; font-size: 11px;">${ev.date}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-weight: bold; color: #0f172a; font-size: 11px;">${ev.title}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 6px; text-align: center; font-size: 11px; font-weight: bold; color: #334155;">${ev.sportName}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 6px; text-align: center; font-weight: bold; font-size: 10.5px; color: ${scopeColor};">
          ${scopeBadge}
        </td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 6px; font-size: 10.5px; color: #334155;">${ev.category || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10.5px; color: #334155;">${ev.venue || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 10.5px; color: #1e293b;">${ev.coordinator || ev.organizer || '-'}</td>
        <td style="border: 1px solid #cbd5e1; padding: 7px 6px; font-size: 10px; color: #64748b;">${ev.notes || '-'}</td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="9" style="border: 1px solid #cbd5e1; padding: 25px; text-align: center; font-size: 13px; color: #64748b; font-weight: bold;">
        لا توجد مواعيد أو أنشطة مبرمجة حالياً وفق الاختيارات المحددة
      </td>
    </tr>
  `;

  const officialLogos = getOfficialLogosSync();

  const html = `
    <div style="direction: rtl; text-align: right; font-family: 'Traditional Arabic', 'Amiri', 'Cairo', Arial, sans-serif; padding: 15px 25px; background: #ffffff; color: #0f172a; max-width: 1100px; margin: 0 auto; box-sizing: border-box;">
      
      <!-- Official Header (Ministry in Center, FRMSS on Left and Right) -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; border-bottom: 2px solid #1e3a8a; padding-bottom: 12px;">
        <tr>
          <td style="width: 25%; text-align: right; vertical-align: middle; padding-bottom: 10px;">
            ${officialLogos.frmssLogo 
              ? `<img src="${officialLogos.frmssLogo}" alt="شعار الجامعة الملكية" style="height: ${officialLogos.frmssLogoHeight || 60}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 11px; font-weight: bold; color: #b45309; background-color: #fffbeb; padding: 6px 10px; border-radius: 8px; border: 1px solid #fde68a; display: inline-block;">الجامعة الملكية للرياضة المدرسية</div>`
            }
          </td>
          <td style="width: 50%; text-align: center; vertical-align: middle; padding-bottom: 10px;">
            ${officialLogos.ministryLogo 
              ? `<img src="${officialLogos.ministryLogo}" alt="شعار الوزارة" style="height: ${officialLogos.ministryLogoHeight || 80}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 11px; font-weight: bold; color: #0369a1; background-color: #f0f9ff; padding: 6px 10px; border-radius: 8px; border: 1px solid #bae6fd; display: inline-block;">وزارة التربية الوطنية</div>`
            }
          </td>
          <td style="width: 25%; text-align: left; vertical-align: middle; padding-bottom: 10px;">
            ${officialLogos.frmssLogo 
              ? `<img src="${officialLogos.frmssLogo}" alt="شعار الجامعة الملكية" style="height: ${officialLogos.frmssLogoHeight || 60}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 11px; font-weight: bold; color: #b45309; background-color: #fffbeb; padding: 6px 10px; border-radius: 8px; border: 1px solid #fde68a; display: inline-block;">الجامعة الملكية للرياضة المدرسية</div>`
            }
          </td>
        </tr>
      </table>

      <!-- Main Document Title -->
      <div style="text-align: center; margin: 15px 0 10px 0;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 900; color: #1e3a8a; text-decoration: underline; text-underline-offset: 6px;">
          ${title}
        </h1>
        <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: bold; color: #475569;">
          رزنامة وجدول المواعيد والأنشطة الرياضية المدرسية الرسمية للموسم الدراسي ${activeSeason} • إجمالي الأنشطة: (${filtered.length})
        </p>
      </div>

      <!-- Scope / Filter Tag Pills for Print View -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 11px; font-weight: bold; color: #334155; border-bottom: 1px dashed #cbd5e1; padding-bottom: 6px;">
        <div>
          <span>نطاق التغطية: </span>
          <span style="color: #1e3a8a;">
            ${scopeFilter === 'ALL' ? 'الشامل (إقليمي، جهوي، وطني)' : scopeFilter === 'provincial' ? 'بطولة إقليمية (تاوريرت)' : scopeFilter === 'regional' ? 'بطولة جهوية (جهة الشرق)' : 'بطولة وطنية (المملكة)'}
          </span>
        </div>
        <div>
          <span>الرياضات المشمولة: </span>
          <span style="color: #047857;">
            ${isAllSports ? 'كافة الرياضات المعتمدة' : selectedSportIds.map(id => SPORTS_MAP[id]?.name || id).join('، ')}
          </span>
        </div>
        <div>
          <span>تاريخ الاستخراج: </span>
          <span>${new Date().toLocaleDateString('ar-MA')}</span>
        </div>
      </div>

      <!-- Data Table -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 11px; line-height: 1.4;">
        <thead>
          <tr style="background-color: #1e3a8a; color: #ffffff;">
            <th style="border: 1px solid #0f172a; padding: 8px 4px; text-align: center; width: 4%; font-weight: bold;">ر.ت</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: center; width: 11%; font-weight: bold;">تاريخ الإجراء</th>
            <th style="border: 1px solid #0f172a; padding: 8px 8px; text-align: right; width: 23%; font-weight: bold;">اسم البطولة أو التظاهرة</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: center; width: 10%; font-weight: bold;">نوع الرياضة</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: center; width: 10%; font-weight: bold;">المستوى</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: center; width: 12%; font-weight: bold;">الفئة المستهدفة</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: right; width: 13%; font-weight: bold;">مكان الإجراء</th>
            <th style="border: 1px solid #0f172a; padding: 8px 6px; text-align: right; width: 11%; font-weight: bold;">المؤطر / المشرف</th>
            <th style="border: 1px solid #0f172a; padding: 8px 4px; text-align: center; width: 6%; font-weight: bold;">ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <!-- Signatures Footer -->
      <table style="width: 100%; margin-top: 35px; border-collapse: collapse; page-break-inside: avoid;">
        <tr>
          <td style="width: 50%; text-align: center; vertical-align: top; font-size: 12px; line-height: 1.8; color: #0f172a; font-weight: bold;">
            رئيس الفرع الإقليمي للجامعة الملكية للرياضة المدرسية<br/>
            (المدير الإقليمي بتاوريرت)<br/>
            <div style="height: 45px;"></div>
            <span>................................................</span>
          </td>
          <td style="width: 50%; text-align: center; vertical-align: top; font-size: 12px; line-height: 1.8; color: #0f172a; font-weight: bold;">
            مكتب التربية البدنية والرياضة المدرسية<br/>
            واللجان التقنية الإقليمية<br/>
            <div style="height: 45px;"></div>
            <span>................................................</span>
          </td>
        </tr>
      </table>

      <div style="text-align: center; margin-top: 25px; padding-top: 8px; border-top: 1px solid #e2e8f0; font-size: 9.5px; color: #94a3b8;">
        منظومة تدبير الأنشطة والبطولات الرياضية المدرسية - المديرية الإقليمية تاوريرت © ${new Date().getFullYear()}
      </div>

    </div>
  `;

  return { html, title, filenameBase };
}

// ----------------------------------------------------
// 1. Direct PDF Download (SEPARATE from printing!)
// ----------------------------------------------------
export async function downloadProgramAsPdf(options: ProgramHtmlOptions): Promise<void> {
  const { html, filenameBase } = generateProgramHtml(options);
  const toastId = toast.loading('جاري فتح نافذة الطباعة...');
  const filename = `${filenameBase}_${options.activeSeason.replace('/', '-')}.pdf`;

  return new Promise((resolve) => {
    toast.dismiss(toastId);
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback if popup blocked
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <html dir="rtl" lang="ar">
            <head>
              <title>${filename}</title>
              <meta charset="utf-8" />
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                @page { size: A4 landscape; margin: 8mm; }
                body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                @media print { body { width: 100%; } }
              </style>
            </head>
            <body>
              ${html}
              <script>
                window.onload = () => {
                  setTimeout(() => {
                    window.focus();
                    window.print();
                  }, 500);
                };
              </script>
            </body>
          </html>
        `);
        doc.close();
      }
      resolve();
      return;
    }

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${filename}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
            @page { size: A4 landscape; margin: 8mm; }
            body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @media print { body { width: 100%; } }
          </style>
        </head>
        <body>
          ${html}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    resolve();
  });
}

// ----------------------------------------------------
// 2. Direct Word Download (.doc)
// ----------------------------------------------------
export function downloadProgramAsWord(options: ProgramHtmlOptions): void {
  const { html, filenameBase } = generateProgramHtml(options);
  const filename = `${filenameBase}_${options.activeSeason.replace('/', '-')}.doc`;

  const wordContent = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>${filenameBase}</title>
      <style>
        body {
          font-family: 'Traditional Arabic', 'Arial', sans-serif;
          direction: rtl;
          text-align: right;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + wordContent], { type: 'application/msword;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast.success('تم تحميل البرنامج بصيغة Word (.doc) بنجاح!');
}

// ----------------------------------------------------
// 3. Print Program (SEPARATE from file download!)
// ----------------------------------------------------
export function printProgram(options: ProgramHtmlOptions): void {
  const { html, title } = generateProgramHtml(options);

  const printWindow = window.open('', '_blank', 'width=1150,height=850');
  if (printWindow) {
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          @page {
            size: A4 landscape;
            margin: 8mm;
          }
          body {
            margin: 0;
            padding: 10px;
            font-family: 'Traditional Arabic', 'Amiri', 'Cairo', Arial, sans-serif;
            direction: rtl;
            background: #fff;
            color: #000;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${html}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.focus();
              window.print();
            }, 350);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  } else {
    // Fallback if popup blocked
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);

    const doc = printFrame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8">
          <title>${title}</title>
          <style>
            @page { size: A4 landscape; margin: 8mm; }
            body { font-family: 'Traditional Arabic', Arial, sans-serif; direction: rtl; margin: 0; padding: 10px; }
          </style>
        </head>
        <body>
          ${html}
        </body>
        </html>
      `);
      doc.close();

      setTimeout(() => {
        printFrame.contentWindow?.focus();
        printFrame.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(printFrame)) {
            document.body.removeChild(printFrame);
          }
        }, 3000);
      }, 500);
    }
  }
}
