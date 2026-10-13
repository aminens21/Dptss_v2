import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Printer,
  Download,
  Eye,
  Filter,
  Check,
  ChevronRight,
  ChevronLeft,
  Users,
  QrCode,
  Sparkles,
  Loader2,
  Maximize2,
  Layers,
  Search,
  CheckSquare,
  Square,
  RotateCcw,
  Palette,
  Award,
  Trophy,
  Flame,
  FileSpreadsheet,
  Type,
  Upload
} from 'lucide-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { AthleticsService } from '../lib/athleticsService';
import { AthleticsDisciplineDef, AthleticsParticipantRecord } from '../lib/athleticsConfig';
import { School, Student } from '../types';
import { DataService, OfficialLogos } from '../lib/dataService';
import { AppLogo } from './AppLogo';
import toast from 'react-hot-toast';

export interface BibFontOption {
  id: string;
  nameAr: string;
  family: string;
  badge: string;
}

export const BIB_FONTS: BibFontOption[] = [
  { id: 'Changa', nameAr: 'تشانغا الرياضي (Changa)', family: "'Changa', sans-serif", badge: 'رياضي' },
  { id: 'Impact', nameAr: 'إمباكت العريض (Impact)', family: "Impact, 'Arial Black', sans-serif", badge: 'عريض' },
  { id: 'Cairo', nameAr: 'كايرو البارز (Cairo)', family: "'Cairo', sans-serif", badge: 'حديث' },
  { id: 'Arial Black', nameAr: 'أريال بلاك (Arial Black)', family: "'Arial Black', Gadget, sans-serif", badge: 'كلاسيكي' },
  { id: 'Courier New', nameAr: 'رقمي تقني (Monospace)', family: "'Courier New', Courier, monospace", badge: 'رقمي' },
  { id: 'Alexandria', nameAr: 'الإسكندرية (Alexandria)', family: "'Alexandria', sans-serif", badge: 'هندسي' },
  { id: 'Lalezar', nameAr: 'لاليزار عريض (Lalezar)', family: "'Lalezar', cursive, sans-serif", badge: 'بارز' },
  { id: 'Tajawal', nameAr: 'تجوال الحديث (Tajawal)', family: "'Tajawal', sans-serif", badge: 'عصري' },
];

// Helper to generate a crisp fallback federation circular emblem in PNG for PDF export
const createFederationEmblemPng = (): string => {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    // Background circle - crisp white with royal border
    ctx.beginPath();
    ctx.arc(80, 80, 76, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#c2410c'; // royal orange/amber
    ctx.stroke();

    // Secondary inner circle
    ctx.beginPath();
    ctx.arc(80, 80, 68, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#047857'; // emerald
    ctx.stroke();

    // Green 5-pointed Moroccan Star
    ctx.save();
    ctx.translate(80, 82);
    ctx.beginPath();
    const spikes = 5;
    const outerRadius = 32;
    const innerRadius = 13;
    let rot = (Math.PI / 2) * 3;
    let x = 0;
    let y = 0;
    const step = Math.PI / spikes;

    ctx.moveTo(0, -outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = Math.cos(rot) * outerRadius;
      y = Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = Math.cos(rot) * innerRadius;
      y = Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(0, -outerRadius);
    ctx.closePath();
    ctx.fillStyle = '#047857';
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#dc2626'; // red outline
    ctx.stroke();
    ctx.restore();

    // Royal Crown on top
    ctx.fillStyle = '#eab308';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('👑', 80, 34);

    // Text: FRMSS
    ctx.fillStyle = '#991b1b';
    ctx.font = 'bold 15px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('FRMSS', 80, 134);

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Failed to create federation emblem canvas:', e);
    return '';
  }
};

export interface AthleticsBibRunnerData {
  id: string;
  bibNumber: string | number;
  fullName: string;
  massarNumber?: string;
  schoolName: string;
  disciplineId: string;
  disciplineNameAr: string;
  disciplineType: string;
  category: string;
  categoryLabel: string;
  gender: 'Male' | 'Female' | string;
  genderLabel: string;
  qrDataUrl?: string;
}

// 🧪 DEMO / SAMPLE ATHLETES FOR EASY APP TESTING (مشاركون تجريبيون لاختبار التطبيق)
export const DEMO_ATHLETICS_PARTICIPANTS: AthleticsBibRunnerData[] = [
  {
    id: 'demo-ath-1',
    bibNumber: 101,
    fullName: 'سفيان البقالي',
    massarNumber: 'G134098712',
    schoolName: 'ثانوية مولاي علي الشريف',
    disciplineId: 'sprint_100m',
    disciplineNameAr: '100م سرعة (جري)',
    disciplineType: 'track_sprint',
    category: 'فتيان',
    categoryLabel: 'فتيان (U18)',
    gender: 'Male',
    genderLabel: 'ذكور (M)'
  },
  {
    id: 'demo-ath-2',
    bibNumber: 102,
    fullName: 'فاطمة الزهراء الإدريسي',
    massarNumber: 'D139876541',
    schoolName: 'إعدادية علال الفاسي',
    disciplineId: 'sprint_100m',
    disciplineNameAr: '100م سرعة (جري)',
    disciplineType: 'track_sprint',
    category: 'فتيات',
    categoryLabel: 'فتيات (U18)',
    gender: 'Female',
    genderLabel: 'إناث (F)'
  },
  {
    id: 'demo-ath-3',
    bibNumber: 103,
    fullName: 'أنس العمراني',
    massarNumber: 'F142091823',
    schoolName: 'ثانوية المنصور الذهبي',
    disciplineId: 'long_jump',
    disciplineNameAr: 'الوثب الطولي (قفز)',
    disciplineType: 'field_jump',
    category: 'فتيان',
    categoryLabel: 'فتيان (U18)',
    gender: 'Male',
    genderLabel: 'ذكور (M)'
  },
  {
    id: 'demo-ath-4',
    bibNumber: 104,
    fullName: 'مريم الصقلي',
    massarNumber: 'K131092837',
    schoolName: 'إعدادية طارق بن زياد',
    disciplineId: 'long_jump',
    disciplineNameAr: 'الوثب الطولي (قفز)',
    disciplineType: 'field_jump',
    category: 'صغيرات',
    categoryLabel: 'صغيرات (U15)',
    gender: 'Female',
    genderLabel: 'إناث (F)'
  },
  {
    id: 'demo-ath-5',
    bibNumber: 105,
    fullName: 'حمزة التازي',
    massarNumber: 'G135678912',
    schoolName: 'ثانوية ابن رشد',
    disciplineId: 'shot_put',
    disciplineNameAr: 'دفع الجلة (رمي)',
    disciplineType: 'field_throw',
    category: 'شبان',
    categoryLabel: 'شبان (U20)',
    gender: 'Male',
    genderLabel: 'ذكور (M)'
  },
  {
    id: 'demo-ath-6',
    bibNumber: 106,
    fullName: 'سناء المرابط',
    massarNumber: 'M134567890',
    schoolName: 'إعدادية القدس',
    disciplineId: 'shot_put',
    disciplineNameAr: 'دفع الجلة (رمي)',
    disciplineType: 'field_throw',
    category: 'فتيات',
    categoryLabel: 'فتيات (U18)',
    gender: 'Female',
    genderLabel: 'إناث (F)'
  },
  {
    id: 'demo-ath-7',
    bibNumber: 107,
    fullName: 'ياسين العلمي',
    massarNumber: 'G139823411',
    schoolName: 'مؤسسة النور التعليمية',
    disciplineId: 'sprint_60m',
    disciplineNameAr: '60م سرعة (جري)',
    disciplineType: 'track_sprint',
    category: 'براعم',
    categoryLabel: 'براعم (U12)',
    gender: 'Male',
    genderLabel: 'ذكور (M)'
  },
  {
    id: 'demo-ath-8',
    bibNumber: 108,
    fullName: 'سلمى بنجلون',
    massarNumber: 'P130987652',
    schoolName: 'إعدادية وادي المخازن',
    disciplineId: 'sprint_60m',
    disciplineNameAr: '60م سرعة (جري)',
    disciplineType: 'track_sprint',
    category: 'برعومات',
    categoryLabel: 'برعومات (U12)',
    gender: 'Female',
    genderLabel: 'إناث (F)'
  },
  {
    id: 'demo-ath-9',
    bibNumber: 109,
    fullName: 'عمر القادري',
    massarNumber: 'R140982341',
    schoolName: 'ثانوية الحسن الثاني',
    disciplineId: 'high_jump',
    disciplineNameAr: 'الوثب العالي (قفز)',
    disciplineType: 'field_jump',
    category: 'فتيان',
    categoryLabel: 'فتيان (U18)',
    gender: 'Male',
    genderLabel: 'ذكور (M)'
  },
  {
    id: 'demo-ath-10',
    bibNumber: 110,
    fullName: 'خديجة الفاسي',
    massarNumber: 'N138765432',
    schoolName: 'ثانوية خديجة أم المؤمنين',
    disciplineId: 'high_jump',
    disciplineNameAr: 'الوثب العالي (قفز)',
    disciplineType: 'field_jump',
    category: 'فتيات',
    categoryLabel: 'فتيات (U18)',
    gender: 'Female',
    genderLabel: 'إناث (F)'
  },
  {
    id: 'demo-ath-11',
    bibNumber: 111,
    fullName: 'أشرف بلحاج',
    massarNumber: 'G131122334',
    schoolName: 'إعدادية الفارابي',
    disciplineId: 'sprint_200m',
    disciplineNameAr: '200م سرعة (جري)',
    disciplineType: 'track_sprint',
    category: 'صغار',
    categoryLabel: 'صغار (U15)',
    gender: 'Male',
    genderLabel: 'ذكور (M)'
  },
  {
    id: 'demo-ath-12',
    bibNumber: 112,
    fullName: 'نورا اليعقوبي',
    massarNumber: 'B139988776',
    schoolName: 'ثانوية المسيرة الخضراء',
    disciplineId: 'sprint_200m',
    disciplineNameAr: '200م سرعة (جري)',
    disciplineType: 'track_sprint',
    category: 'فتيات',
    categoryLabel: 'فتيات (U18)',
    gender: 'Female',
    genderLabel: 'إناث (F)'
  }
];

interface AthleticsBibGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDisciplineId?: string;
  initialCategory?: string;
  initialGender?: 'Male' | 'Female' | 'ALL';
}

export const AthleticsBibGeneratorModal: React.FC<AthleticsBibGeneratorModalProps> = ({
  isOpen,
  onClose,
  initialDisciplineId,
  initialCategory,
  initialGender = 'ALL'
}) => {
  // 1. Data sources
  const [disciplines, setDisciplines] = useState<AthleticsDisciplineDef[]>([]);
  const [participants, setParticipants] = useState<AthleticsParticipantRecord[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 2. Filters
  // Event group filter: 'ALL' | 'track' | 'jump' | 'throw'
  const [disciplineGroupFilter, setDisciplineGroupFilter] = useState<'ALL' | 'track' | 'jump' | 'throw'>('ALL');
  // Specific discipline ID: 'ALL' or specific id like 'sprint_60m', 'long_jump', 'shot_put'
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string>(initialDisciplineId || 'ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'ALL');
  const [selectedGender, setSelectedGender] = useState<string>(initialGender || 'ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 3. Generation Mode:
  // 'registered' = use actual registered athletes in athletics championship
  // 'demo' = use realistic demo participants for testing
  // 'sequential' = generate numbered bibs (e.g. 1 to 50) for the chosen discipline
  // 'all_students' = generate for all students in school database
  const [generationSource, setGenerationSource] = useState<'demo' | 'registered' | 'sequential' | 'all_students'>('registered');
  const [seqStartNumber, setSeqStartNumber] = useState<number>(1);
  const [seqCount, setSeqCount] = useState<number>(30);
  const [seqPrefix, setSeqPrefix] = useState<string>('');

  // 4. Bib Customization Options:
  // "مع إمكانية إظهار نوع المسابقة المشاركة فيها في الصدرية" -> CRITICAL USER REQUIREMENT
  const [showDisciplineName, setShowDisciplineName] = useState<boolean>(true);
  const [showCategoryGender, setShowCategoryGender] = useState<boolean>(true);
  const [showGender, setShowGender] = useState<boolean>(true); // إظهار الجنس بوضوح
  const [showAthleteName, setShowAthleteName] = useState<boolean>(true);
  const [showSchoolName, setShowSchoolName] = useState<boolean>(true);
  const [showQrCode, setShowQrCode] = useState<boolean>(true);

  // QR Code Content Mode: بالاسم | برقم مسار | برقم الصدرية | شامل
  const [qrContentMode, setQrContentMode] = useState<'name' | 'massar' | 'bib' | 'all'>('bib');

  const [championshipHeaderTitle, setChampionshipHeaderTitle] = useState<string>('البطولة المدرسية لألعاب القوى');
  const [subHeaderTitle, setSubHeaderTitle] = useState<string>('الجامعة الملكية المغربية للرياضة المدرسية');

  // NEW USER REQUIREMENTS:
  // 1. University / Federation Logo on Top Right & Left (لوغو الجامعة فوق على اليمين واليسار)
  const [showUniversityLogo, setShowUniversityLogo] = useState<boolean>(true);
  const [universityLogo, setUniversityLogo] = useState<string>('');
  const [universityLogoDataUrl, setUniversityLogoDataUrl] = useState<string>('');
  const [officialLogos, setOfficialLogos] = useState<OfficialLogos | null>(null);

  // 2. Maximize bib number proportionally to fill empty space + Custom font family & Slider
  // (تكبير حجم رقم الصدرية بشريط تمرير ديناميكي حسب رغبة الأستاذ مع إمكانية التعديل في نوعية الخط)
  const [isMaximizedNumber, setIsMaximizedNumber] = useState<boolean>(true);
  const [bibNumberScale, setBibNumberScale] = useState<number>(1.0); // Slider: 0.7x to 2.5x
  const [bibNumberFont, setBibNumberFont] = useState<string>('Changa');

  // Page layout & appearance
  const [bibsPerPage, setBibsPerPage] = useState<1 | 2 | 4>(2);
  const [bibThemeColor, setBibThemeColor] = useState<string>('amber'); // 'amber', 'emerald', 'indigo', 'rose', 'mono'
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);
  const [qrCache, setQrCache] = useState<Record<string, string>>({});

  const printContainerRef = useRef<HTMLDivElement>(null);

  // Load official logos from database / settings
  useEffect(() => {
    if (!isOpen) return;
    DataService.getOfficialLogos().then(logos => {
      if (logos) {
        setOfficialLogos(logos);
        if (logos.frmssLogo) {
          setUniversityLogo(logos.frmssLogo);
        }
      }
    }).catch(err => {
      console.warn('Failed to load official logos for bib generator:', err);
    });
  }, [isOpen]);

  // Sync university logo to data URL for smooth jsPDF insertion
  useEffect(() => {
    let isCancelled = false;
    const fallbackPng = createFederationEmblemPng();

    if (!universityLogo) {
      setUniversityLogoDataUrl(fallbackPng);
      return;
    }

    if (universityLogo.startsWith('data:image/png') || universityLogo.startsWith('data:image/jpeg')) {
      setUniversityLogoDataUrl(universityLogo);
      return;
    }

    // Try converting image URL to canvas PNG DataURL
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (isCancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width || 120;
        canvas.height = img.height || 120;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setUniversityLogoDataUrl(canvas.toDataURL('image/png'));
          return;
        }
      } catch {
        // Fallback on CORS taint
      }
      setUniversityLogoDataUrl(fallbackPng);
    };
    img.onerror = () => {
      if (!isCancelled) setUniversityLogoDataUrl(fallbackPng);
    };
    img.src = universityLogo;

    return () => {
      isCancelled = true;
    };
  }, [universityLogo]);

  // Load disciplines & participants
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      const discs = AthleticsService.getDisciplines();
      setDisciplines(discs);

      const parts = AthleticsService.getParticipants();
      setParticipants(parts);

      const schs = DataService.getSchools();
      setSchools(schs);

      const studs = DataService.getStudents();
      setStudents(studs);

      if (initialDisciplineId) {
        setSelectedDisciplineId(initialDisciplineId);
      }
    } catch (e) {
      console.error('Error loading athletics data for bib generator:', e);
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, initialDisciplineId]);

  // Filtered disciplines based on group (الجري، القفز، دفع الجلة والرمي)
  const filteredDisciplines = useMemo(() => {
    return disciplines.filter(d => {
      if (disciplineGroupFilter === 'ALL') return true;
      if (disciplineGroupFilter === 'track') {
        return d.type === 'track_sprint' || d.type === 'track_middle' || d.type === 'track_relay';
      }
      if (disciplineGroupFilter === 'jump') {
        return d.type === 'field_jump';
      }
      if (disciplineGroupFilter === 'throw') {
        return d.type === 'field_throw';
      }
      return true;
    });
  }, [disciplines, disciplineGroupFilter]);

  // Selected discipline object
  const activeDisciplineObj = useMemo(() => {
    if (selectedDisciplineId === 'ALL') return null;
    return disciplines.find(d => d.id === selectedDisciplineId) || null;
  }, [disciplines, selectedDisciplineId]);

  // Build the list of bib items to display & print
  const bibRunners = useMemo<AthleticsBibRunnerData[]>(() => {
    const defaultDiscName = activeDisciplineObj ? activeDisciplineObj.nameAr : (
      disciplineGroupFilter === 'track' ? 'مسابقات الجري والسرعة' :
      disciplineGroupFilter === 'jump' ? 'مسابقات القفز' :
      disciplineGroupFilter === 'throw' ? 'مسابقات الرمي ودفع الجلة' :
      'ألعاب القوى المدرسية'
    );

    const defaultDiscType = activeDisciplineObj ? activeDisciplineObj.type : 'track_sprint';

    if (generationSource === 'demo') {
      let filtered = DEMO_ATHLETICS_PARTICIPANTS;
      if (selectedDisciplineId !== 'ALL') {
        filtered = filtered.filter(p => p.disciplineId === selectedDisciplineId);
      } else if (disciplineGroupFilter !== 'ALL') {
        if (disciplineGroupFilter === 'track') {
          filtered = filtered.filter(p => p.disciplineType.startsWith('track'));
        } else if (disciplineGroupFilter === 'jump') {
          filtered = filtered.filter(p => p.disciplineType === 'field_jump');
        } else if (disciplineGroupFilter === 'throw') {
          filtered = filtered.filter(p => p.disciplineType === 'field_throw');
        }
      }
      if (selectedCategory !== 'ALL') {
        filtered = filtered.filter(p => p.category === selectedCategory);
      }
      if (selectedGender !== 'ALL') {
        filtered = filtered.filter(p => p.gender === selectedGender);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(p =>
          p.fullName.toLowerCase().includes(q) ||
          p.schoolName.toLowerCase().includes(q) ||
          String(p.bibNumber).includes(q)
        );
      }
      return filtered;
    }

    if (generationSource === 'sequential') {
      const items: AthleticsBibRunnerData[] = [];
      const count = Math.max(1, Math.min(seqCount, 200));
      for (let i = 0; i < count; i++) {
        const numVal = seqStartNumber + i;
        const bibNumStr = seqPrefix ? `${seqPrefix}-${numVal}` : `${numVal}`;
        items.push({
          id: `seq-${i}-${numVal}`,
          bibNumber: bibNumStr,
          fullName: 'متسابق(ة)',
          schoolName: 'المؤسسة التعليمية',
          disciplineId: selectedDisciplineId,
          disciplineNameAr: defaultDiscName,
          disciplineType: defaultDiscType,
          category: selectedCategory !== 'ALL' ? selectedCategory : 'فئات متنوعة',
          categoryLabel: selectedCategory !== 'ALL' ? selectedCategory : 'فئات متنوعة',
          gender: selectedGender !== 'ALL' ? (selectedGender as any) : 'Male',
          genderLabel: selectedGender === 'Male' ? 'ذكور (M)' : selectedGender === 'Female' ? 'إناث (F)' : 'مختلط'
        });
      }
      return items;
    }

    if (generationSource === 'registered') {
      let filtered = participants;

      // FIXED: Properly match against participant's disciplineId or secondDisciplineId
      if (selectedDisciplineId !== 'ALL') {
        filtered = filtered.filter(p => {
          if (p.disciplineId === selectedDisciplineId) return true;
          if (p.secondDisciplineId === selectedDisciplineId) return true;
          if (Array.isArray((p as any).disciplines) && (p as any).disciplines.includes(selectedDisciplineId)) return true;
          if ((p as any).discipline === selectedDisciplineId) return true;
          return false;
        });
      } else if (disciplineGroupFilter !== 'ALL') {
        const allowedIds = new Set(filteredDisciplines.map(d => d.id));
        filtered = filtered.filter(p => {
          if (p.disciplineId && allowedIds.has(p.disciplineId)) return true;
          if (p.secondDisciplineId && allowedIds.has(p.secondDisciplineId)) return true;
          if (Array.isArray((p as any).disciplines) && (p as any).disciplines.some((id: string) => allowedIds.has(id))) return true;
          return false;
        });
      }

      // FIXED: Properly normalize category (U12 / براعم, U15 / صغار, U18 / فتيان وفتيات, U20 / شبان)
      if (selectedCategory !== 'ALL') {
        filtered = filtered.filter(p => {
          if (!p.category) return false;
          if (p.category === selectedCategory) return true;
          const normalizeCat = (c?: string) => {
            if (!c) return '';
            if (c === 'U12' || c.includes('براعم') || c.includes('برعومات')) return 'U12';
            if (c === 'U15' || c.includes('صغار') || c.includes('صغيرات')) return 'U15';
            if (c === 'U18' || c.includes('فتيان') || c.includes('فتيات')) return 'U18';
            if (c === 'U20' || c.includes('شبان') || c.includes('شابات')) return 'U20';
            return c;
          };
          return normalizeCat(p.category) === normalizeCat(selectedCategory);
        });
      }

      if (selectedGender !== 'ALL') {
        filtered = filtered.filter(p => p.gender === selectedGender);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(p =>
          (p.studentName && p.studentName.toLowerCase().includes(q)) ||
          (p.schoolName && p.schoolName.toLowerCase().includes(q)) ||
          (p.bibNumber && p.bibNumber.toString().includes(q)) ||
          (p.massarNumber && p.massarNumber.toLowerCase().includes(q))
        );
      }

      return filtered.map((p, idx) => {
        let pDiscipline: AthleticsDisciplineDef | undefined;
        if (selectedDisciplineId !== 'ALL') {
          pDiscipline = disciplines.find(d => d.id === selectedDisciplineId);
        }
        if (!pDiscipline && p.disciplineId) {
          pDiscipline = disciplines.find(d => d.id === p.disciplineId);
        }
        if (!pDiscipline && p.secondDisciplineId) {
          pDiscipline = disciplines.find(d => d.id === p.secondDisciplineId);
        }
        if (!pDiscipline) {
          pDiscipline = activeDisciplineObj || undefined;
        }

        const catLabel = p.category === 'U12' ? 'براعم (U12)' :
          p.category === 'U15' ? 'صغار (U15)' :
          p.category === 'U18' ? (p.gender === 'Female' ? 'فتيات (U18)' : 'فتيان (U18)') :
          p.category === 'U20' ? (p.gender === 'Female' ? 'شابات (U20)' : 'شبان (U20)') :
          (p.category || 'عام');

        return {
          id: p.id || `reg-${idx}`,
          bibNumber: p.bibNumber || (idx + 1),
          fullName: p.studentName || 'تلميذ(ة)',
          massarNumber: p.massarNumber,
          schoolName: p.schoolName || '',
          disciplineId: pDiscipline ? pDiscipline.id : (selectedDisciplineId !== 'ALL' ? selectedDisciplineId : 'general'),
          disciplineNameAr: pDiscipline ? pDiscipline.nameAr : defaultDiscName,
          disciplineType: pDiscipline ? pDiscipline.type : defaultDiscType,
          category: p.category || selectedCategory,
          categoryLabel: catLabel,
          gender: p.gender || 'Male',
          genderLabel: p.gender === 'Female' ? 'إناث (F)' : 'ذكور (M)'
        };
      });
    }

    if (generationSource === 'all_students') {
      let filtered = students;
      if (selectedGender !== 'ALL') {
        filtered = filtered.filter(s => s.gender === selectedGender);
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        filtered = filtered.filter(s =>
          (s.fullName && s.fullName.toLowerCase().includes(q)) ||
          (s.schoolName && s.schoolName.toLowerCase().includes(q)) ||
          (s.massarNumber && s.massarNumber.toLowerCase().includes(q))
        );
      }

      return filtered.slice(0, 100).map((s, idx) => ({
        id: s.id || `stud-${idx}`,
        bibNumber: idx + 1,
        fullName: s.fullName,
        massarNumber: s.massarNumber,
        schoolName: s.schoolName,
        disciplineId: selectedDisciplineId,
        disciplineNameAr: defaultDiscName,
        disciplineType: defaultDiscType,
        category: selectedCategory !== 'ALL' ? selectedCategory : 'تلاميذ',
        categoryLabel: selectedCategory !== 'ALL' ? selectedCategory : 'تلاميذ',
        gender: s.gender || 'Male',
        genderLabel: s.gender === 'Female' ? 'إناث (F)' : 'ذكور (M)'
      }));
    }

    return [];
  }, [
    participants,
    disciplines,
    activeDisciplineObj,
    filteredDisciplines,
    selectedDisciplineId,
    disciplineGroupFilter,
    selectedCategory,
    selectedGender,
    generationSource,
    seqStartNumber,
    seqCount,
    seqPrefix,
    searchQuery,
    students
  ]);

  // Generate QR Codes based on selected QR Mode (بالاسم | برقم مسار | برقم الصدرية | شامل)
  useEffect(() => {
    if (!showQrCode || bibRunners.length === 0) return;
    let isMounted = true;

    const generateQrs = async () => {
      const newCache: Record<string, string> = { ...qrCache };
      let updated = false;

      // Generate for the current page runners first
      const start = (currentPage - 1) * 12;
      const visibleRunners = bibRunners.slice(start, start + 24);

      for (const runner of visibleRunners) {
        const cacheKey = `${runner.id}-${qrContentMode}`;
        if (!newCache[cacheKey]) {
          try {
            let qrText = '';
            if (qrContentMode === 'name') {
              // بالاسم
              qrText = runner.fullName;
            } else if (qrContentMode === 'massar') {
              // برقم مسار
              qrText = runner.massarNumber || `مسار-${runner.bibNumber}`;
            } else if (qrContentMode === 'bib') {
              // برقم الصدرية
              qrText = String(runner.bibNumber);
            } else {
              // شامل كافة البيانات
              qrText = JSON.stringify({
                app: 'ATHLETICS_BIB',
                bib: runner.bibNumber,
                name: runner.fullName,
                event: runner.disciplineNameAr,
                gender: runner.genderLabel,
                cat: runner.category,
                massar: runner.massarNumber || '',
                school: runner.schoolName
              });
            }

            const url = await QRCode.toDataURL(qrText, {
              margin: 1,
              width: 140,
              errorCorrectionLevel: 'M',
              color: {
                dark: '#000000',
                light: '#ffffff'
              }
            });
            newCache[cacheKey] = url;
            newCache[runner.id] = url; // Fallback key
            updated = true;
          } catch (e) {
            console.error('QR code generation error:', e);
          }
        }
      }

      if (isMounted && updated) {
        setQrCache(newCache);
      }
    };

    generateQrs();
    return () => {
      isMounted = false;
    };
  }, [bibRunners, currentPage, showQrCode, qrContentMode]);

  // Helper to draw text with pure native Arabic shaping onto canvas and embed into jsPDF
  const drawArabicTextToPdf = (
    doc: jsPDF,
    text: string,
    tx: number,
    ty: number,
    tw: number,
    th: number,
    fontSizePt: number,
    fontWeight: string = 'bold',
    colorHex: string = '#000000',
    align: 'center' | 'right' | 'left' = 'center',
    fontFamily: string = "Arial, Tahoma, 'Cairo', sans-serif"
  ) => {
    if (!text || text.trim() === '') return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 3.5; // Very sharp print quality
    const fontPx = Math.max(16, Math.round(fontSizePt * 1.33 * scale));
    ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
    const metrics = ctx.measureText(text);
    const textWidth = Math.ceil(metrics.width);
    const textHeight = Math.ceil(fontPx * 1.35);

    canvas.width = textWidth + 24;
    canvas.height = textHeight + 20;

    // Re-apply properties after resizing canvas
    ctx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
    ctx.fillStyle = colorHex;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const imgData = canvas.toDataURL('image/png');
    const aspect = canvas.width / canvas.height;

    const maxW = tw;
    const maxH = th;
    let drawW = maxW;
    let drawH = drawW / aspect;
    if (drawH > maxH) {
      drawH = maxH;
      drawW = drawH * aspect;
    }

    let finalX = tx;
    if (align === 'center') {
      finalX = tx + (tw - drawW) / 2;
    } else if (align === 'right') {
      finalX = tx + tw - drawW;
    }
    const finalY = ty + (th - drawH) / 2;

    doc.addImage(imgData, 'PNG', finalX, finalY, drawW, drawH, undefined, 'FAST');
  };

  const getThemeRgb = (theme: string) => {
    switch (theme) {
      case 'emerald':
        return { r: 5, g: 150, b: 105, hex: '#059669' };
      case 'indigo':
        return { r: 79, g: 70, b: 229, hex: '#4f46e5' };
      case 'rose':
        return { r: 225, g: 29, b: 72, hex: '#e11d48' };
      case 'mono':
        return { r: 15, g: 23, b: 42, hex: '#0f172a' };
      case 'amber':
      default:
        return { r: 234, g: 88, b: 12, hex: '#ea580c' };
    }
  };

  // Helper function to draw a bib card in jsPDF with 100% Arabic support
  const drawPdfBib = (
    doc: jsPDF,
    runner: AthleticsBibRunnerData,
    x: number,
    y: number,
    w: number,
    h: number,
    showDisc: boolean,
    showCat: boolean,
    showAthl: boolean,
    showSch: boolean,
    showQr: boolean,
    qrUrl?: string,
    headerTitle?: string,
    isCompact?: boolean
  ) => {
    // Outer border & background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(30, 41, 59);
    doc.setLineWidth(1.2);
    doc.roundedRect(x, y, w, h, 4, 4, 'FD');

    // Punch hole guides in 4 corners for safety pins
    doc.setDrawColor(160, 160, 160);
    doc.setLineWidth(0.5);
    doc.circle(x + 6, y + 6, 2, 'S');
    doc.circle(x + w - 6, y + 6, 2, 'S');
    doc.circle(x + 6, y + h - 6, 2, 'S');
    doc.circle(x + w - 6, y + h - 6, 2, 'S');

    // Header Bar in selected theme color
    const headerHeight = isCompact ? 13 : 17;
    const themeRgb = getThemeRgb(bibThemeColor);
    doc.setFillColor(themeRgb.r, themeRgb.g, themeRgb.b);
    doc.roundedRect(x + 1, y + 1, w - 2, headerHeight, 3, 3, 'F');

    // Right & Left University / Federation Logo (لوغو الجامعة فوق على اليمين واليسار)
    const logoSize = isCompact ? 9 : 12;
    const logoY = y + 1 + (headerHeight - logoSize) / 2;

    if (showUniversityLogo && universityLogoDataUrl) {
      try {
        // Logo Top Right (على اليمين)
        doc.addImage(universityLogoDataUrl, 'PNG', x + 3, logoY, logoSize, logoSize, undefined, 'FAST');
        // Logo Top Left (على اليسار)
        doc.addImage(universityLogoDataUrl, 'PNG', x + w - logoSize - 3, logoY, logoSize, logoSize, undefined, 'FAST');
      } catch (e) {
        console.warn('PDF logo render issue:', e);
      }
    }

    // Arabic Header Title (No Symbols!) centered between logos
    const titlePadding = (showUniversityLogo && universityLogoDataUrl) ? logoSize + 4 : 5;
    drawArabicTextToPdf(
      doc,
      headerTitle || 'البطولة المدرسية لألعاب القوى',
      x + titlePadding,
      y + 1,
      w - (titlePadding * 2),
      headerHeight,
      isCompact ? 9 : 12,
      'bold',
      '#FFFFFF',
      'center'
    );

    // Competition Discipline Banner (CRITICAL USER REQUIREMENT)
    let currentY = y + headerHeight + 3.5;
    if (showDisc) {
      const bannerH = isCompact ? 8.5 : 11.5;
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(x + 4, currentY, w - 8, bannerH, 2, 2, 'FD');

      drawArabicTextToPdf(
        doc,
        `مسابقة: ${runner.disciplineNameAr}`,
        x + 6,
        currentY,
        w - 12,
        bannerH,
        isCompact ? 8.5 : 11,
        'bold',
        '#0F172A',
        'center'
      );
      currentY += bannerH + 3;
    }

    // Category and Gender Banner (CRITICAL USER REQUIREMENT: إظهار الفئة والجنس)
    if (showCat) {
      const catH = isCompact ? 7 : 9;
      doc.setFillColor(254, 243, 199);
      doc.setDrawColor(251, 191, 36);
      doc.roundedRect(x + 6, currentY, w - 12, catH, 2, 2, 'FD');

      const genderTxt = showGender ? ` • الجنس: ${runner.genderLabel}` : '';
      drawArabicTextToPdf(
        doc,
        `الفئة: ${runner.categoryLabel}${genderTxt}`,
        x + 8,
        currentY,
        w - 16,
        catH,
        isCompact ? 7 : 9,
        'bold',
        '#92400E',
        'center'
      );
      currentY += catH + 2;
    }

    // Bottom info area definition first to calculate exact empty space in center
    const bottomH = isCompact ? 25 : 33;
    const bottomY = y + h - bottomH - 3;

    // Huge Bib Number in Center - PROPORTIONALLY MAXIMIZED TO EMPTY SPACE
    const bannerBottom = currentY;
    const emptySpaceH = Math.max(20, bottomY - bannerBottom - 4);

    const baseNumH = isMaximizedNumber
      ? (isCompact ? Math.min(emptySpaceH - 2, 36) : Math.min(emptySpaceH - 2, w > 120 ? 62 : 48))
      : (isCompact ? 24 : (w > 120 ? 40 : 30));

    const baseFontSizePt = isMaximizedNumber
      ? (isCompact ? 46 : (w > 120 ? 82 : 62))
      : (isCompact ? 30 : (w > 120 ? 52 : 38));

    // Apply teacher's custom scale slider (من 70% إلى 250%)
    const numH = Math.min(emptySpaceH, Math.max(16, baseNumH * bibNumberScale));
    const fontSizePt = Math.round(baseFontSizePt * bibNumberScale);

    const numY = bannerBottom + (emptySpaceH - numH) / 2;

    const activeFontDef = BIB_FONTS.find(f => f.id === bibNumberFont) || BIB_FONTS[0];

    drawArabicTextToPdf(
      doc,
      String(runner.bibNumber),
      x + 6,
      numY,
      w - 12,
      numH,
      fontSizePt,
      'bold',
      themeRgb.hex,
      'center',
      activeFontDef.family
    );

    // Bottom info area with QR and details
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(x + 4, bottomY, w - 8, bottomH, 2, 2, 'FD');

    // QR Code on one side
    const qrSize = isCompact ? 19 : 25;
    const qrX = x + 6;
    const qrY = bottomY + (bottomH - qrSize) / 2;

    const activeQrUrl = qrCache[`${runner.id}-${qrContentMode}`] || qrUrl || qrCache[runner.id];
    if (showQr && activeQrUrl) {
      try {
        doc.addImage(activeQrUrl, 'PNG', qrX, qrY, qrSize, qrSize, undefined, 'FAST');
      } catch (e) {
        // ignore
      }
    }

    // Metadata lines on the other side
    const infoX = qrX + qrSize + 3;
    const infoW = x + w - infoX - 6;
    const lineH = isCompact ? 5.2 : 7.2;
    let lineY = bottomY + 2;

    if (showAthl && runner.fullName) {
      drawArabicTextToPdf(
        doc,
        `👤 ${runner.fullName}`,
        infoX,
        lineY,
        infoW,
        lineH,
        isCompact ? 7.5 : 9.5,
        'bold',
        '#0F172A',
        'right'
      );
      lineY += lineH;
    }

    if (showSch && runner.schoolName) {
      drawArabicTextToPdf(
        doc,
        `🏫 ${runner.schoolName}`,
        infoX,
        lineY,
        infoW,
        lineH,
        isCompact ? 7 : 8.5,
        'bold',
        '#334155',
        'right'
      );
      lineY += lineH;
    }

    // Sub-line: Gender + Massar / Lane / QR Mode label
    const massarText = runner.massarNumber ? `مسار: ${runner.massarNumber}` : '';
    const genderTag = showGender ? runner.genderLabel : '';
    const qrModeTag = qrContentMode === 'name' ? 'QR: بالاسم' : qrContentMode === 'massar' ? 'QR: برقم مسار' : qrContentMode === 'bib' ? 'QR: بالصدرية' : 'QR: شامل';
    const bottomTags = [genderTag, massarText, qrModeTag].filter(Boolean).join(' • ');

    drawArabicTextToPdf(
      doc,
      bottomTags,
      infoX,
      lineY,
      infoW,
      lineH,
      isCompact ? 6 : 7.5,
      'bold',
      '#64748B',
      'right'
    );
  };

  // Pagination for preview
  const itemsPerPagePreview = 6;
  const totalPreviewPages = Math.max(1, Math.ceil(bibRunners.length / itemsPerPagePreview));
  const currentPreviewRunners = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPagePreview;
    return bibRunners.slice(start, start + itemsPerPagePreview);
  }, [bibRunners, currentPage]);

  // Handle browser direct print
  const handlePrint = () => {
    if (bibRunners.length === 0) {
      toast.error('لا توجد صدريات متاحة للطباعة');
      return;
    }
    toast.success('جاري تحضير الصدريات للطباعة... 🖨️');
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // Handle PDF Export using jsPDF with pure Arabic text
  const handleExportPdf = async () => {
    if (bibRunners.length === 0) {
      toast.error('لا توجد صدريات لتصديرها');
      return;
    }
    setIsExportingPdf(true);
    const toastId = toast.loading('جاري توليد ملف الصدريات بصيغة PDF عالية الدقة باللغة العربية...');

    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const runners = bibRunners;
      const perPage = bibsPerPage;
      const totalPages = Math.ceil(runners.length / perPage);

      for (let p = 0; p < totalPages; p++) {
        if (p > 0) doc.addPage();

        const pageRunners = runners.slice(p * perPage, (p + 1) * perPage);

        if (perPage === 1) {
          // 1 bib full A4
          const r = pageRunners[0];
          drawPdfBib(doc, r, 10, 15, 190, 267, showDisciplineName, showCategoryGender, showAthleteName, showSchoolName, showQrCode, qrCache[`${r.id}-${qrContentMode}`] || qrCache[r.id], championshipHeaderTitle);
        } else if (perPage === 2) {
          // 2 bibs per A4 (horizontal cut)
          const r1 = pageRunners[0];
          drawPdfBib(doc, r1, 10, 10, 190, 130, showDisciplineName, showCategoryGender, showAthleteName, showSchoolName, showQrCode, qrCache[`${r1.id}-${qrContentMode}`] || qrCache[r1.id], championshipHeaderTitle);

          // Scissors cutting guideline line
          doc.setDrawColor(180, 180, 180);
          doc.setLineDashPattern([2, 2], 0);
          doc.line(5, 148.5, 205, 148.5);
          doc.setLineDashPattern([], 0);

          if (pageRunners[1]) {
            const r2 = pageRunners[1];
            drawPdfBib(doc, r2, 10, 155, 190, 130, showDisciplineName, showCategoryGender, showAthleteName, showSchoolName, showQrCode, qrCache[`${r2.id}-${qrContentMode}`] || qrCache[r2.id], championshipHeaderTitle);
          }
        } else if (perPage === 4) {
          // 4 bibs per A4 (2x2 grid)
          const bW = 90;
          const bH = 130;
          const coords = [
            { x: 10, y: 10 },
            { x: 110, y: 10 },
            { x: 10, y: 155 },
            { x: 110, y: 155 }
          ];
          pageRunners.forEach((r, idx) => {
            const c = coords[idx];
            drawPdfBib(doc, r, c.x, c.y, bW, bH, showDisciplineName, showCategoryGender, showAthleteName, showSchoolName, showQrCode, qrCache[`${r.id}-${qrContentMode}`] || qrCache[r.id], championshipHeaderTitle, true);
          });
          // Guidelines
          doc.setDrawColor(180, 180, 180);
          doc.setLineDashPattern([2, 2], 0);
          doc.line(105, 5, 105, 292);
          doc.line(5, 148.5, 205, 148.5);
          doc.setLineDashPattern([], 0);
        }
      }

      doc.save(`صدريات_العاب_القوى_${selectedDisciplineId !== 'ALL' ? selectedDisciplineId : 'شامل'}.pdf`);
      toast.success('تم تحميل ملف PDF الصدريات بنجاح باللغة العربية! 📄🎉', { id: toastId });
    } catch (e) {
      console.error('PDF export failed:', e);
      toast.error('حدث خطأ أثناء إنشاء ملف PDF', { id: toastId });
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Color theme class helper
  const getThemeClasses = () => {
    switch (bibThemeColor) {
      case 'emerald':
        return {
          headerBg: 'bg-gradient-to-r from-emerald-600 to-teal-700',
          badgeBg: 'bg-emerald-50 text-emerald-900 border-emerald-300',
          numberColor: 'text-emerald-950',
          borderColor: 'border-emerald-600'
        };
      case 'indigo':
        return {
          headerBg: 'bg-gradient-to-r from-indigo-600 to-blue-700',
          badgeBg: 'bg-indigo-50 text-indigo-900 border-indigo-300',
          numberColor: 'text-indigo-950',
          borderColor: 'border-indigo-600'
        };
      case 'rose':
        return {
          headerBg: 'bg-gradient-to-r from-rose-600 to-red-700',
          badgeBg: 'bg-rose-50 text-rose-900 border-rose-300',
          numberColor: 'text-rose-950',
          borderColor: 'border-rose-600'
        };
      case 'mono':
        return {
          headerBg: 'bg-slate-900',
          badgeBg: 'bg-slate-100 text-slate-900 border-slate-300',
          numberColor: 'text-black',
          borderColor: 'border-slate-800'
        };
      case 'amber':
      default:
        return {
          headerBg: 'bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600',
          badgeBg: 'bg-orange-50 text-orange-950 border-orange-300',
          numberColor: 'text-slate-950',
          borderColor: 'border-orange-500'
        };
    }
  };

  const themeClasses = getThemeClasses();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-7xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden text-right select-none" 
        dir="rtl"
      >
        
        {/* ========================================================================= */}
        {/* HEADER BAR */}
        {/* ========================================================================= */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-600 to-rose-600 px-6 py-4 flex items-center justify-between text-white shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner">
              <span className="text-2xl">🎽</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black">تطبيق إعداد صدريات ألعاب القوى</h2>
                <span className="px-2 py-0.5 text-[10px] font-black bg-white/20 rounded-full border border-white/30">
                  الجري • القفز • دفع الجلة
                </span>
              </div>
              <p className="text-xs text-orange-100 font-medium mt-0.5">
                توليد بطاقات الصدريات لمسابقات ألعاب القوى مع إظهار نوع وتخصص المسابقة وتجهيزها للطباعة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={bibRunners.length === 0}
              className="px-3.5 py-2 bg-white text-orange-700 hover:bg-orange-50 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              title="طباعة الصدريات مباشرة"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة مباشرة</span>
            </button>

            <button
              onClick={handleExportPdf}
              disabled={bibRunners.length === 0 || isExportingPdf}
              className="px-3.5 py-2 bg-black/20 hover:bg-black/30 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
              title="تصدير الصدريات إلى PDF"
            >
              {isExportingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>تصدير PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BODY: SIDEBAR CONTROLS + LIVE PREVIEW */}
        {/* ========================================================================= */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-slate-200 dark:divide-slate-800">
          
          {/* ======================================================================= */}
          {/* LEFT/RIGHT SIDEBAR: CONTROLS & SELECTION (4 COLS) */}
          {/* ======================================================================= */}
          <div className="lg:col-span-4 p-5 space-y-5 bg-slate-50 dark:bg-slate-950/50 overflow-y-auto">
            
            {/* 1. SELECTION OF COMPETITION (الجري / القفز / دفع الجلة) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  <span>1. نوع وتخصص المسابقة</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {filteredDisciplines.length} تخصص متاح
                </span>
              </div>

              {/* Event Groups: All / Running / Jumps / Throws */}
              <div className="grid grid-cols-4 gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setDisciplineGroupFilter('ALL');
                    setSelectedDisciplineId('ALL');
                  }}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                    disciplineGroupFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisciplineGroupFilter('track');
                    setSelectedDisciplineId('ALL');
                  }}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                    disciplineGroupFilter === 'track'
                      ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  🏃‍♂️ الجري
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisciplineGroupFilter('jump');
                    setSelectedDisciplineId('ALL');
                  }}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                    disciplineGroupFilter === 'jump'
                      ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  🦘 القفز
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDisciplineGroupFilter('throw');
                    setSelectedDisciplineId('ALL');
                  }}
                  className={`py-1.5 px-1 rounded-lg text-center transition-all ${
                    disciplineGroupFilter === 'throw'
                      ? 'bg-white dark:bg-slate-700 text-orange-600 dark:text-orange-400 shadow-xs font-black'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  ☄️ دفع الجلة
                </button>
              </div>

              {/* Specific Discipline Dropdown */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1">
                  المسابقة المحددة للصدرية:
                </label>
                <select
                  value={selectedDisciplineId}
                  onChange={(e) => setSelectedDisciplineId(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-200 outline-none"
                >
                  <option value="ALL">⭐ جميع مسابقات {disciplineGroupFilter === 'track' ? 'الجري' : disciplineGroupFilter === 'jump' ? 'القفز' : disciplineGroupFilter === 'throw' ? 'الرمي والجلة' : 'ألعاب القوى'}</option>
                  {filteredDisciplines.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.icon} {d.nameAr} ({d.distanceOrUnit})
                    </option>
                  ))}
                </select>
              </div>

              {/* Category & Gender Filters */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الفئة العمرية:</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">كافة الفئات</option>
                    <option value="براعم">براعم (U12)</option>
                    <option value="صغار">صغار (U15)</option>
                    <option value="فتيان">فتيان (U18)</option>
                    <option value="شبان">شبان (U20)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">الجنس:</label>
                  <select
                    value={selectedGender}
                    onChange={(e) => setSelectedGender(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-200"
                  >
                    <option value="ALL">الكل (ذكور وإناث)</option>
                    <option value="Male">ذكور فقط</option>
                    <option value="Female">إناث فقط</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 2. PARTICIPANTS SOURCE (المسجلون أو ترقيم متسلسل أو مشاركون تجريبيون) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-500" />
                  <span>2. مصدر المتسابقين والأرقام</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setGenerationSource('demo');
                    toast.success('تم تفعيل 12 مشاركاً تجريبياً بكافة المسابقات لتجربة الصدريات! 🧪');
                  }}
                  className="px-2 py-0.5 bg-purple-100 hover:bg-purple-200 dark:bg-purple-950 dark:hover:bg-purple-900 text-purple-900 dark:text-purple-200 rounded-lg text-[10px] font-black transition-colors cursor-pointer"
                  title="عرض متسابقين تجريبيين للتجربة فوراً"
                >
                  🧪 تجربة نموذج تجريبي
                </button>
              </div>

              <div className="space-y-2">
                {/* 🧪 Option: Demo Participants */}
                <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-black transition-all ${
                  generationSource === 'demo'
                    ? 'bg-purple-50 dark:bg-purple-950/50 border-purple-400 dark:border-purple-600 text-purple-950 dark:text-purple-100 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="genSource"
                    checked={generationSource === 'demo'}
                    onChange={() => setGenerationSource('demo')}
                    className="text-purple-600 focus:ring-purple-500"
                  />
                  <div className="flex items-center justify-between flex-1">
                    <span>🧪 مشاركون بصيغة تجريبية للتجربة ({DEMO_ATHLETICS_PARTICIPANTS.length} عداء(ة))</span>
                    <span className="px-1.5 py-0.2 bg-purple-200 dark:bg-purple-900 text-purple-950 dark:text-purple-200 rounded text-[9px] font-bold">
                      نموذج تجريبي
                    </span>
                  </div>
                </label>

                {/* Option: Registered Participants */}
                <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                  generationSource === 'registered'
                    ? 'bg-orange-50 dark:bg-orange-950/50 border-orange-400 dark:border-orange-600 text-orange-950 dark:text-orange-100 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="genSource"
                    checked={generationSource === 'registered'}
                    onChange={() => setGenerationSource('registered')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span>المشاركون المسجلون في ألعاب القوى ({participants.length} مسجل)</span>
                </label>

                {/* Option: Sequential numbers */}
                <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                  generationSource === 'sequential'
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-950 dark:text-amber-100 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="genSource"
                    checked={generationSource === 'sequential'}
                    onChange={() => setGenerationSource('sequential')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span>توليد أرقام متسلسلة للمسابقة (مثال: من 1 إلى 50)</span>
                </label>

                {/* Option: All students */}
                <label className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs font-bold transition-all ${
                  generationSource === 'all_students'
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-600 text-blue-950 dark:text-blue-100 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  <input
                    type="radio"
                    name="genSource"
                    checked={generationSource === 'all_students'}
                    onChange={() => setGenerationSource('all_students')}
                    className="text-orange-600 focus:ring-orange-500"
                  />
                  <span>توليد لتلاميذ المؤسسات المسجلين ({students.length} تلميذ)</span>
                </label>
              </div>

              {/* Sequential controls */}
              {generationSource === 'sequential' && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 mb-0.5">الرقم الأول:</label>
                      <input
                        type="number"
                        min="1"
                        value={seqStartNumber}
                        onChange={(e) => setSeqStartNumber(parseInt(e.target.value) || 1)}
                        className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1 font-bold text-center"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 mb-0.5">عدد الصدريات:</label>
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={seqCount}
                        onChange={(e) => setSeqCount(parseInt(e.target.value) || 10)}
                        className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1 font-bold text-center"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-amber-900 dark:text-amber-200 mb-0.5">بادئة قبل الرقم (اختياري - مثلاً: A أو J):</label>
                    <input
                      type="text"
                      placeholder="مثال: A أو J أو فارغ"
                      value={seqPrefix}
                      onChange={(e) => setSeqPrefix(e.target.value)}
                      className="w-full bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg px-2.5 py-1 text-center font-bold"
                    />
                  </div>
                </div>
              )}

              {/* Search input for registered / demo */}
              {generationSource !== 'sequential' && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="بحث باسم التلميذ أو المؤسسة أو الصدرية..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pr-8 pl-3 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                  />
                </div>
              )}
            </div>

            {/* 3. BIB DESIGN & COMPETITION DISPLAY OPTIONS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-500" />
                <span>3. خيارات إظهار المسابقة والبيانات على الصدرية</span>
              </span>

              {/* The Critical Requirement: إظهار نوع المسابقة المشاركة فيها في الصدرية */}
              <label className="flex items-center justify-between p-2.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-xl cursor-pointer">
                <div>
                  <span className="text-xs font-black text-orange-950 dark:text-orange-200 block">
                    إظهار نوع واسم المسابقة في الصدرية
                  </span>
                  <span className="text-[10px] text-orange-800/80 dark:text-orange-300">
                    (مثل: القفز الطولي، سباق 100م، دفع الجلة...)
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={showDisciplineName}
                  onChange={(e) => setShowDisciplineName(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                />
              </label>

              {/* Selection for QR Content Mode (بالاسم | برقم مسار | برقم الصدرية | شامل) */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-slate-800 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <QrCode className="w-4 h-4 text-orange-600" />
                    <span>تشفير رمز الاستجابة السريعة (QR):</span>
                  </span>
                  <span className="text-[10px] text-orange-600 font-black bg-orange-100 dark:bg-orange-950/60 px-2 py-0.5 rounded-md">
                    {qrContentMode === 'name' ? 'بالاسم' : qrContentMode === 'massar' ? 'برقم مسار' : qrContentMode === 'bib' ? 'برقم الصدرية' : 'شامل'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setQrContentMode('bib')}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                      qrContentMode === 'bib'
                        ? 'bg-orange-600 text-white border-orange-600 font-black shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🔢 برقم الصدرية
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrContentMode('name')}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                      qrContentMode === 'name'
                        ? 'bg-orange-600 text-white border-orange-600 font-black shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    👤 بالاسم
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrContentMode('massar')}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                      qrContentMode === 'massar'
                        ? 'bg-orange-600 text-white border-orange-600 font-black shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    🆔 برقم مسار
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrContentMode('all')}
                    className={`py-1.5 px-2 rounded-lg border text-center transition-all cursor-pointer ${
                      qrContentMode === 'all'
                        ? 'bg-orange-600 text-white border-orange-600 font-black shadow-xs'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    📋 شامل كافة المعطيات
                  </button>
                </div>
              </div>

              {/* Other display toggles */}
              <div className="space-y-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <label className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                  <span>إظهار الفئة (براعم / صغار / فتيان)</span>
                  <input
                    type="checkbox"
                    checked={showCategoryGender}
                    onChange={(e) => setShowCategoryGender(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                </label>

                {/* CRITICAL: إظهار الجنس بوضوح */}
                <label className="flex items-center justify-between p-1.5 bg-amber-50/60 dark:bg-amber-950/30 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg cursor-pointer border border-amber-200/50 dark:border-amber-900/50">
                  <span className="text-amber-950 dark:text-amber-200 font-black flex items-center gap-1">
                    <span>إظهار الجنس بوضوح (👦 ذكور / 👧 إناث)</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={showGender}
                    onChange={(e) => setShowGender(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                  <span>إظهار اسم المتسابق(ة)</span>
                  <input
                    type="checkbox"
                    checked={showAthleteName}
                    onChange={(e) => setShowAthleteName(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                  <span>إظهار اسم المؤسسة التعليمية</span>
                  <input
                    type="checkbox"
                    checked={showSchoolName}
                    onChange={(e) => setShowSchoolName(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer">
                  <span>رمز الاستجابة السريعة (QR Code) للمسح الآلي</span>
                  <input
                    type="checkbox"
                    checked={showQrCode}
                    onChange={(e) => setShowQrCode(e.target.checked)}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                </label>
              </div>

              {/* Custom Header Title Input */}
              <div className="pt-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">عنوان التظاهرة أعلى الصدرية:</label>
                <input
                  type="text"
                  value={championshipHeaderTitle}
                  onChange={(e) => setChampionshipHeaderTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Theme color and layout */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">لون تصميم الصدرية:</label>
                  <select
                    value={bibThemeColor}
                    onChange={(e) => setBibThemeColor(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-[11px] font-bold"
                  >
                    <option value="amber">برتقالي رياضي (Athletics)</option>
                    <option value="emerald">أخضر زمردي</option>
                    <option value="indigo">أزرق ملكي</option>
                    <option value="rose">أحمر قرمزي</option>
                    <option value="mono">أبيض وأسود (توفير الحبر)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">توزيع الطباعة بالورقة:</label>
                  <select
                    value={bibsPerPage}
                    onChange={(e) => setBibsPerPage(parseInt(e.target.value) as any)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1 text-[11px] font-bold"
                  >
                    <option value={1}>صدرية واحدة (A4 كبير)</option>
                    <option value={2}>صدريتان بالورقة (A5 قياسي)</option>
                    <option value={4}>4 صدريات بالورقة (2x2 اقتصادي)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 4. NEW: BIB NUMBER MAXIMIZE & FONT SELECTION (تكبير الرقم وتعديل نوع الخط) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Maximize2 className="w-4 h-4 text-amber-500" />
                  <span>4. حجم رقم الصدرية ونوع الخط</span>
                </span>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  {isMaximizedNumber ? 'أقصى ملائم للمساحة 📐' : 'حجم قياسي'}
                </span>
              </div>

              {/* Interactive Slider for Bib Number Size (شريط تحريك تكبير حجم رقم الصدرية حسب رغبة الأستاذ) */}
              <div className="space-y-2.5 bg-amber-50/60 dark:bg-amber-950/30 p-3 rounded-xl border border-amber-200/80 dark:border-amber-800/60 shadow-3xs">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <Maximize2 className="w-3.5 h-3.5 text-amber-600" />
                    <span>شريط تكبير رقم الصدرية:</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-black text-amber-700 dark:text-amber-300 bg-amber-100/80 dark:bg-amber-900/50 px-2 py-0.5 rounded-md border border-amber-300 dark:border-amber-700 font-mono">
                      {Math.round(bibNumberScale * 100)}%
                    </span>
                    {bibNumberScale !== 1.0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setBibNumberScale(1.0);
                          toast.success('تمت استعادة حجم الرقم الافتراضي (100%)');
                        }}
                        className="text-slate-400 hover:text-amber-600 p-0.5 rounded cursor-pointer transition-colors"
                        title="إعادة للحجم الافتراضي 100%"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Range Slider for Bib Number (من 70% إلى 250%) */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0.7"
                    max="2.5"
                    step="0.05"
                    value={bibNumberScale}
                    onChange={(e) => setBibNumberScale(parseFloat(e.target.value))}
                    className="w-full h-2.5 bg-amber-200 dark:bg-amber-900/60 rounded-lg appearance-none cursor-pointer accent-amber-600 focus:outline-hidden"
                    title={`حجم رقم الصدرية الحالي: ${Math.round(bibNumberScale * 100)}%`}
                  />
                  <div className="flex justify-between text-[9px] font-bold text-slate-500 dark:text-slate-400 font-mono px-0.5">
                    <span>70% (أصغر)</span>
                    <button 
                      type="button" 
                      onClick={() => setBibNumberScale(1.0)} 
                      className="hover:text-amber-600 font-black cursor-pointer underline decoration-dotted"
                    >
                      100% (افتراضي)
                    </button>
                    <span>250% (عملاق بارز)</span>
                  </div>
                </div>

                {/* Quick Presets Buttons */}
                <div className="grid grid-cols-4 gap-1 pt-0.5">
                  {[
                    { label: '100% عادي', scale: 1.0 },
                    { label: '130% كبير', scale: 1.3 },
                    { label: '170% بارز', scale: 1.7 },
                    { label: '220% أقصى', scale: 2.2 }
                  ].map(p => (
                    <button
                      key={p.scale}
                      type="button"
                      onClick={() => {
                        setBibNumberScale(p.scale);
                        toast.success(`تم ضبط الحجم على ${p.label}`);
                      }}
                      className={`py-1 px-1 text-[9px] font-black rounded-lg transition-all cursor-pointer text-center ${
                        bibNumberScale === p.scale
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-amber-100/50 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Family Selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                  <Type className="w-3.5 h-3.5 text-blue-500" />
                  <span>نوعية خط رقم الصدرية:</span>
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {BIB_FONTS.map(font => (
                    <button
                      key={font.id}
                      type="button"
                      onClick={() => {
                        setBibNumberFont(font.id);
                        toast.success(`تم اختيار خط ${font.nameAr} للصدريات! ✍️`);
                      }}
                      className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center justify-between ${
                        bibNumberFont === font.id
                          ? 'bg-orange-50 dark:bg-orange-950/50 border-orange-500 text-orange-900 dark:text-orange-200 font-black shadow-xs ring-1 ring-orange-400'
                          : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div className="truncate">
                        <span className="block text-[10px] truncate text-slate-600 dark:text-slate-400 font-bold">{font.nameAr}</span>
                        <span 
                          style={{ fontFamily: font.family }} 
                          className="text-base font-black text-slate-900 dark:text-white"
                        >
                          123
                        </span>
                      </div>
                      {bibNumberFont === font.id && (
                        <Check className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 5. NEW: UNIVERSITY / FEDERATION LOGO (لوغو الجامعة فوق على اليمين واليسار) */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-orange-500" />
                  <span>5. شعار الجامعة (فوق على اليمين واليسار)</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {showUniversityLogo ? 'مفعل 🏅' : 'مخفي'}
                </span>
              </div>

              <label className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>إظهار لوغو الجامعة في أعلى اليمين واليسار</span>
                <input
                  type="checkbox"
                  checked={showUniversityLogo}
                  onChange={(e) => setShowUniversityLogo(e.target.checked)}
                  className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500 cursor-pointer"
                />
              </label>

              {showUniversityLogo && (
                <div className="flex items-center gap-3 p-2.5 bg-orange-50/50 dark:bg-orange-950/30 rounded-xl border border-orange-200 dark:border-orange-900/50">
                  <div className="w-12 h-12 rounded-xl bg-white p-1 border border-slate-300 shadow-xs flex items-center justify-center shrink-0 overflow-hidden">
                    {universityLogo ? (
                      <img src={universityLogo} alt="لوغو الجامعة" className="w-full h-full object-contain" />
                    ) : (
                      <AppLogo size={32} />
                    )}
                  </div>
                  <div className="flex-1 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    <span className="block text-slate-900 dark:text-white font-black">
                      {universityLogo ? 'شعار الجامعة الملكية المغربية للرياضة المدرسية' : 'الشعار الرسمي المعتمد'}
                    </span>
                    <label className="inline-block mt-1 text-[10px] text-orange-600 hover:text-orange-700 font-black cursor-pointer">
                      <span>📁 رفع شعار مخصص</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (event) => {
                              const res = event.target?.result as string;
                              if (res) {
                                setUniversityLogo(res);
                                toast.success('تم تحميل وتعيين شعار الجامعة الجديد للصدريات! 🏅');
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {universityLogo && officialLogos?.frmssLogo && universityLogo !== officialLogos.frmssLogo && (
                      <button
                        type="button"
                        onClick={() => setUniversityLogo(officialLogos.frmssLogo || '')}
                        className="block text-[9px] text-slate-400 hover:text-slate-600 mt-0.5 cursor-pointer"
                      >
                        استعادة الشعار الأصلي
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* ======================================================================= */}
          {/* MAIN PREVIEW AREA (8 COLS) */}
          {/* ======================================================================= */}
          <div className="lg:col-span-8 p-5 flex flex-col justify-between space-y-4 bg-slate-100 dark:bg-slate-900 overflow-y-auto">
            
            {/* Top Toolbar */}
            <div className="flex items-center justify-between flex-wrap gap-2 bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-orange-100 dark:bg-orange-950/60 text-orange-600 rounded-lg">
                  <Eye className="w-4 h-4" />
                </span>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    معاينة الصدريات المجهزة ({bibRunners.length} صدرية)
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {selectedDisciplineId !== 'ALL' ? `تخصص: ${activeDisciplineObj?.nameAr}` : 'كافة تخصصات ألعاب القوى'} • جاهزة للطباعة فوراً
                  </p>
                </div>
              </div>

              {/* Quick Toolbar Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Quick bib size slider on toolbar */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                  <Maximize2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hidden sm:inline">حجم الرقم:</span>
                  <input
                    type="range"
                    min="0.7"
                    max="2.5"
                    step="0.05"
                    value={bibNumberScale}
                    onChange={(e) => setBibNumberScale(parseFloat(e.target.value))}
                    className="w-20 sm:w-28 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    title={`تكبير الخط: ${Math.round(bibNumberScale * 100)}%`}
                  />
                  <span className="text-[10px] font-black font-mono text-amber-600 dark:text-amber-400 min-w-8 text-center">
                    {Math.round(bibNumberScale * 100)}%
                  </span>
                  {bibNumberScale !== 1.0 && (
                    <button
                      type="button"
                      onClick={() => setBibNumberScale(1.0)}
                      className="text-slate-400 hover:text-amber-600 p-0.5 rounded cursor-pointer"
                      title="استعادة 100%"
                    >
                      <RotateCcw className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>

                {/* Pagination controls */}
                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                    صفحة {currentPage} من {totalPreviewPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage >= totalPreviewPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPreviewPages, p + 1))}
                    className="p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg disabled:opacity-40 cursor-pointer"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Empty state with helpful recovery actions */}
            {bibRunners.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-white dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800">
                <span className="text-5xl mb-3">🎽</span>
                <h4 className="text-base font-black text-slate-800 dark:text-slate-200">
                  {generationSource === 'registered' && selectedDisciplineId !== 'ALL'
                    ? `لا يوجد مسجلون في مسابقة «${activeDisciplineObj?.nameAr || selectedDisciplineId}»`
                    : 'لا توجد صدريات مطابقة للفلترة المحددة'}
                </h4>
                <p className="text-xs mt-1.5 max-w-md text-slate-500">
                  {generationSource === 'registered'
                    ? `يوجد ${participants.length} مشارك مسجل في قاعدة بيانات ألعاب القوى. يمكنك اختيار مسابقة أخرى أو عرض كافة المسابقات.`
                    : 'يمكنك تغيير المسابقة أو توليد أرقام متسلسلة فوراً.'}
                </p>

                <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
                  {generationSource === 'registered' && selectedDisciplineId !== 'ALL' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDisciplineId('ALL');
                        setDisciplineGroupFilter('ALL');
                      }}
                      className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer transition-all"
                    >
                      ⭐ عرض كافة المسجلين في ألعاب القوى ({participants.length})
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setGenerationSource('demo');
                      toast.success('تم تفعيل المشاركين التجريبيين للمعاينة والتجربة! 🧪');
                    }}
                    className="px-3.5 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 rounded-xl text-xs font-black cursor-pointer transition-all"
                  >
                    🧪 تجربة مشاركين تجريبيين (Demo)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setGenerationSource('sequential');
                      toast.success('تم التحويل إلى الترقيم المتسلسل المباشر للمسابقة!');
                    }}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black cursor-pointer transition-all"
                  >
                    🔢 توليد أرقام متسلسلة للمسابقة
                  </button>
                </div>
              </div>
            )}

            {/* Grid of Preview Bibs */}
            {bibRunners.length > 0 && (
              <div 
                ref={printContainerRef}
                className="grid grid-cols-1 md:grid-cols-2 gap-5 flex-1 items-start"
              >
                {currentPreviewRunners.map((runner, idx) => (
                  <div
                    key={`bib-runner-${runner.id}-${idx}`}
                    className="bg-white rounded-3xl border-2 border-slate-900 shadow-xl overflow-hidden relative flex flex-col justify-between transition-all hover:shadow-2xl select-none"
                    style={{ minHeight: '300px' }}
                  >
                    {/* Punch hole indicators (4 corners for safety pins) */}
                    <div className="absolute top-2.5 right-2.5 w-3 h-3 rounded-full border border-slate-400 bg-slate-100 z-10 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-slate-400" />
                    </div>
                    <div className="absolute top-2.5 left-2.5 w-3 h-3 rounded-full border border-slate-400 bg-slate-100 z-10 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-slate-400" />
                    </div>
                    <div className="absolute bottom-2.5 right-2.5 w-3 h-3 rounded-full border border-slate-400 bg-slate-100 z-10 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-slate-400" />
                    </div>
                    <div className="absolute bottom-2.5 left-2.5 w-3 h-3 rounded-full border border-slate-400 bg-slate-100 z-10 flex items-center justify-center">
                      <div className="w-1 h-1 rounded-full bg-slate-400" />
                    </div>

                    {/* Top Header Bar with Right and Left University Logos */}
                    <div className={`${themeClasses.headerBg} text-white px-3 py-2 flex items-center justify-between text-center relative overflow-hidden`}>
                      {/* Right Logo (لوغو الجامعة على اليمين) */}
                      {showUniversityLogo ? (
                        <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs p-1 shrink-0 border border-white/30 flex items-center justify-center shadow-xs">
                          {universityLogo ? (
                            <img src={universityLogo} alt="شعار الجامعة" className="w-full h-full object-contain" />
                          ) : (
                            <AppLogo size={20} />
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-black tracking-wider uppercase opacity-90">
                          ATHLETICS
                        </span>
                      )}

                      {/* Center Title */}
                      <div className="flex flex-col items-center justify-center flex-1 px-2 min-w-0">
                        <span className="text-xs sm:text-sm font-black truncate max-w-[220px] drop-shadow-xs">
                          {championshipHeaderTitle}
                        </span>
                        {subHeaderTitle && (
                          <span className="text-[9px] text-white/80 font-bold truncate max-w-[200px]">
                            {subHeaderTitle}
                          </span>
                        )}
                      </div>

                      {/* Left Logo (لوغو الجامعة على اليسار) */}
                      {showUniversityLogo ? (
                        <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-xs p-1 shrink-0 border border-white/30 flex items-center justify-center shadow-xs">
                          {universityLogo ? (
                            <img src={universityLogo} alt="شعار الجامعة" className="w-full h-full object-contain" />
                          ) : (
                            <AppLogo size={20} />
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] font-black tracking-wider uppercase opacity-90">
                          BIB
                        </span>
                      )}
                    </div>

                    {/* THE CRITICAL REQUIREMENT: Competition Name Banner on Bib */}
                    {showDisciplineName && (
                      <div className="mx-4 mt-2 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 flex items-center justify-between gap-1 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">
                            {runner.disciplineType === 'field_jump' ? '🦘' : runner.disciplineType === 'field_throw' ? '☄️' : '🏃‍♂️'}
                          </span>
                          <span className="text-xs font-black text-slate-900">
                            مسابقة: {runner.disciplineNameAr}
                          </span>
                        </div>
                        {showCategoryGender && (
                          <div className="flex items-center gap-1">
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-800 rounded-md text-[10px] font-black">
                              {runner.category}
                            </span>
                            {showGender && (
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 ${
                                runner.gender === 'Female' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}>
                                {runner.gender === 'Female' ? '👧 إناث' : '👦 ذكور'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Huge Bib Number in Center - Proportionally Maximized to Empty Space with dynamic scale slider */}
                    <div className="flex-1 my-auto py-2 px-2 flex items-center justify-center text-center overflow-hidden">
                      <span 
                        style={{ 
                          fontFamily: BIB_FONTS.find(f => f.id === bibNumberFont)?.family || "'Changa', sans-serif",
                          fontSize: `calc(${
                            isMaximizedNumber 
                              ? (String(runner.bibNumber).length <= 2 ? 'clamp(5rem, 15vw, 7.5rem)' : String(runner.bibNumber).length === 3 ? 'clamp(4.2rem, 12vw, 6.2rem)' : 'clamp(3.2rem, 9vw, 4.8rem)')
                              : (String(runner.bibNumber).length <= 2 ? 'clamp(3.8rem, 10vw, 5.2rem)' : String(runner.bibNumber).length === 3 ? 'clamp(3rem, 8vw, 4.2rem)' : 'clamp(2.4rem, 6vw, 3.4rem)')
                          } * ${bibNumberScale})`,
                          lineHeight: 0.95
                        }}
                        className={`font-black tracking-tight select-none transition-all duration-150 ${themeClasses.numberColor}`}
                      >
                        {runner.bibNumber}
                      </span>
                    </div>

                    {/* Bottom Metadata Area: Name, School, QR */}
                    <div className="px-4 pb-3 pt-1 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
                      <div className="space-y-0.5 text-right flex-1 truncate">
                        {showAthleteName && (
                          <div className="text-xs font-black text-slate-900 truncate">
                            👤 {runner.fullName}
                          </div>
                        )}
                        {showSchoolName && (
                          <div className="text-[10px] font-bold text-slate-600 truncate">
                            🏫 {runner.schoolName || 'المؤسسة التعليمية'}
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold truncate">
                          {showGender && (
                            <span className={`font-black ${runner.gender === 'Female' ? 'text-rose-600' : 'text-blue-600'}`}>
                              {runner.gender === 'Female' ? '👧 إناث' : '👦 ذكور'}
                            </span>
                          )}
                          {runner.massarNumber && (
                            <span className="font-mono text-[9px] bg-slate-200 px-1.5 py-0.2 rounded">
                              مسار: {runner.massarNumber}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Scannable QR Code */}
                      {showQrCode && (
                        <div className="shrink-0 flex flex-col items-center">
                          <div className="bg-white p-1 rounded-xl border border-slate-300 shadow-xs">
                            {qrCache[`${runner.id}-${qrContentMode}`] || qrCache[runner.id] ? (
                              <img
                                src={qrCache[`${runner.id}-${qrContentMode}`] || qrCache[runner.id]}
                                alt={`QR for ${runner.bibNumber}`}
                                className="w-14 h-14 object-contain"
                              />
                            ) : (
                              <div className="w-14 h-14 bg-slate-100 flex items-center justify-center">
                                <QrCode className="w-8 h-8 text-slate-400" />
                              </div>
                            )}
                          </div>
                          <span className="text-[9px] font-black text-slate-500 mt-1">
                            {qrContentMode === 'name' ? 'QR: بالاسم' : qrContentMode === 'massar' ? 'QR: برقم مسار' : qrContentMode === 'bib' ? 'QR: بالصدرية' : 'QR: شامل'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom summary bar */}
            <div className="bg-white dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-bold">
              <span>
                إجمالي الصدريات المجهزة: <strong className="text-orange-600 font-black">{bibRunners.length}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrint}
                  className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5 active:scale-95 transition-all"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>طباعة فورية</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
