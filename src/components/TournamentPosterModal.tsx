import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  Copy,
  Calendar,
  MapPin,
  Clock,
  Palette,
  Sparkles,
  Check,
  Upload,
  RotateCcw,
  Trophy,
  Share2,
  FileImage,
  Layers,
  Building,
  Users,
  SlidersHorizontal,
  Type,
  ChevronDown
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import toast from 'react-hot-toast';
import { AppLogo } from './AppLogo';
import { Tournament, Directorate, Sport } from '../types';
import { SPORTS_MAP, OfficialLogos } from '../lib/dataService';

interface TournamentPosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | { id: string; name: string; icon?: string };
  directorateName?: string;
  directorateObj?: Directorate | null;
  tournaments?: Tournament[];
  officialLogos?: OfficialLogos;
}

type PosterTheme =
  | 'orange_vibrant'
  | 'royal_blue'
  | 'morocco_emerald'
  | 'crimson_gold'
  | 'golden_luxury'
  | 'purple_majesty'
  | 'deep_cyan'
  | 'sunset_warm'
  | 'moroccan_flag'
  | 'midnight_dark'
  | 'clean_slate';

export const POSTER_THEME_OPTIONS: {
  id: PosterTheme;
  label: string;
  desc: string;
  previewColor: string;
  activeBg: string;
  activeText: string;
  activeBorder: string;
  ringColor: string;
}[] = [
  {
    id: 'orange_vibrant',
    label: 'برتقالي رياضي',
    desc: 'برتقالي مشرق وحيوي مقتبس من النماذج الرسمية',
    previewColor: '#f97316',
    activeBg: 'bg-orange-50',
    activeText: 'text-orange-950',
    activeBorder: 'border-orange-500',
    ringColor: 'ring-orange-500'
  },
  {
    id: 'royal_blue',
    label: 'أزرق ملكي',
    desc: 'أزرق رسمي وقور للبطولات الوطنية الإقليمية',
    previewColor: '#2563eb',
    activeBg: 'bg-blue-50',
    activeText: 'text-blue-950',
    activeBorder: 'border-blue-500',
    ringColor: 'ring-blue-500'
  },
  {
    id: 'morocco_emerald',
    label: 'أخضر زمردي',
    desc: 'أخضر راقي مستوحى من الهوية الوطنية',
    previewColor: '#10b981',
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-950',
    activeBorder: 'border-emerald-500',
    ringColor: 'ring-emerald-500'
  },
  {
    id: 'crimson_gold',
    label: 'قرمزي ملكي',
    desc: 'أحمر قرمزي فخم يرمز للشغف والتحدي',
    previewColor: '#dc2626',
    activeBg: 'bg-rose-50',
    activeText: 'text-rose-950',
    activeBorder: 'border-red-500',
    ringColor: 'ring-red-500'
  },
  {
    id: 'golden_luxury',
    label: 'ذهبي فاخر',
    desc: 'لون الذهبي والبرونز للبطولات الكبرى والنهائيات',
    previewColor: '#d97706',
    activeBg: 'bg-amber-50',
    activeText: 'text-amber-950',
    activeBorder: 'border-amber-500',
    ringColor: 'ring-amber-500'
  },
  {
    id: 'purple_majesty',
    label: 'بنفسجي ملوكي',
    desc: 'بنفسجي ملكي فاخر وأنيق جداً',
    previewColor: '#9333ea',
    activeBg: 'bg-purple-50',
    activeText: 'text-purple-950',
    activeBorder: 'border-purple-500',
    ringColor: 'ring-purple-500'
  },
  {
    id: 'deep_cyan',
    label: 'فيروزي أطلسي',
    desc: 'فيروزي منعش وحيوي يناسب الألعاب المائية والمختلفة',
    previewColor: '#0891b2',
    activeBg: 'bg-cyan-50',
    activeText: 'text-cyan-950',
    activeBorder: 'border-cyan-500',
    ringColor: 'ring-cyan-500'
  },
  {
    id: 'sunset_warm',
    label: 'غروب دافئ',
    desc: 'تدرج دافئ بين الوردي والأحمر والبرتقالي',
    previewColor: '#e11d48',
    activeBg: 'bg-rose-50',
    activeText: 'text-rose-950',
    activeBorder: 'border-rose-500',
    ringColor: 'ring-rose-500'
  },
  {
    id: 'moroccan_flag',
    label: 'أحمر وأخضر وطني',
    desc: 'مزيج ألوان الراية الوطنية المغربية (الأحمر والأخضر)',
    previewColor: '#059669',
    activeBg: 'bg-emerald-50',
    activeText: 'text-emerald-950',
    activeBorder: 'border-emerald-600',
    ringColor: 'ring-emerald-600'
  },
  {
    id: 'midnight_dark',
    label: 'ليلي أسود وذهبي',
    desc: 'خلفية داكنة ملكية مع نصوص ذهبية متألقة',
    previewColor: '#fbbf24',
    activeBg: 'bg-slate-900',
    activeText: 'text-amber-300',
    activeBorder: 'border-amber-400',
    ringColor: 'ring-amber-400'
  },
  {
    id: 'clean_slate',
    label: 'رمادي عصري',
    desc: 'تصميم هادئ وعصري بالرمادي والأبيض',
    previewColor: '#475569',
    activeBg: 'bg-slate-100',
    activeText: 'text-slate-950',
    activeBorder: 'border-slate-600',
    ringColor: 'ring-slate-600'
  }
];

export const POSTER_FONTS = [
  { id: 'Cairo', name: 'خط القاهرة (Cairo) - عصري وإعلاني بارز', css: "'Cairo', sans-serif" },
  { id: 'Tajawal', name: 'خط تجوال (Tajawal) - أنيق ومقروء', css: "'Tajawal', sans-serif" },
  { id: 'Amiri', name: 'خط أميري (Amiri) - كلاسيكي ورسمي', css: "'Amiri', serif" },
  { id: 'Changa', name: 'خط تشانغا (Changa) - رياضي قوي وعريض', css: "'Changa', sans-serif" },
  { id: 'Readex Pro', name: 'خط ريديكس برو (Readex Pro) - دقيق ومتوازن', css: "'Readex Pro', sans-serif" },
  { id: 'Noto Kufi Arabic', name: 'خط كوفي عربي (Noto Kufi) - هندسي ملفت', css: "'Noto Kufi Arabic', sans-serif" },
  { id: 'Aref Ruqaa', name: 'خط الرقعة (Aref Ruqaa) - تقليدي فني', css: "'Aref Ruqaa', serif" }
];

const QUICK_SLOGANS = [
  'الرياضة المدرسية من أجل تلميذات وتلاميذ منفتحين وناجحين',
  'من أجل تلامذة منفتحين وناجحين',
  'الرياضة المدرسية مشتل للأبطال ومدرسة للقيم النبيلة',
  'الرياضة المدرسية رافعة لبناء الشخصية والارتقاء بالفرد'
];

export const TournamentPosterModal: React.FC<TournamentPosterModalProps> = ({
  isOpen,
  onClose,
  sport,
  directorateName = 'المديرية الإقليمية بتاوريرت',
  directorateObj,
  tournaments = [],
  officialLogos
}) => {
  // Pre-calculate sport info
  const sportName = sport.name || SPORTS_MAP[sport.id]?.name || 'البطولة الرياضية';
  const resolvedDirName = directorateObj?.name || directorateName || 'المديرية الإقليمية';

  // Find any existing tournament dates
  const sportTourns = tournaments.filter(t => t.sportId === sport.id);
  const earliestStart = sportTourns.find(t => t.startDate)?.startDate;

  // Form State
  const [organizer, setOrganizer] = useState(`المديرية الإقليمية لوزارة التربية الوطنية والتعليم الأولي والرياضة ب${resolvedDirName.replace(/^المديرية الإقليمية (ب|في )?/, '')}`);
  const [partner, setPartner] = useState(`الفرع الإقليمي للجامعة الملكية المغربية للرياضة المدرسية ب${resolvedDirName.replace(/^المديرية الإقليمية (ب|في )?/, '')}`);
  const [organizerPrefix, setOrganizerPrefix] = useState('تنظم');
  const [partnerPrefix, setPartnerPrefix] = useState('بتعاون مع');

  // Championship Title (No category, no school level)
  const [championshipTitle, setChampionshipTitle] = useState(`البطولة الإقليمية المدرسية لـ ${sportName}`);
  
  // Slogan
  const [slogan, setSlogan] = useState('الرياضة المدرسية من أجل تلميذات وتلاميذ منفتحين وناجحين');

  // Date & Time (safely handles strings, numbers, Dates, or Firestore Timestamps)
  const defaultDateStr = (() => {
    if (!earliestStart) return 'يوم الأربعاء 15 أكتوبر 2026';
    let d: Date | null = null;
    if (typeof (earliestStart as any)?.toDate === 'function') {
      try { d = (earliestStart as any).toDate(); } catch { /* ignore */ }
    } else if (typeof (earliestStart as any)?.seconds === 'number') {
      try { d = new Date((earliestStart as any).seconds * 1000); } catch { /* ignore */ }
    } else if (earliestStart instanceof Date) {
      d = earliestStart;
    } else if (typeof earliestStart === 'string' || typeof earliestStart === 'number') {
      try { d = new Date(earliestStart); } catch { /* ignore */ }
    }
    if (d && !isNaN(d.getTime())) {
      return `يوم ${d.toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
    }
    return typeof earliestStart === 'string' ? earliestStart : 'يوم الأربعاء 15 أكتوبر 2026';
  })();
  const [dateText, setDateText] = useState(defaultDateStr);
  const [timeText, setTimeText] = useState('ابتداء من الساعة 09:00 صباحاً');

  // Location / Venue
  const [venueText, setVenueText] = useState('بالقاعة المغطاة للرياضات');

  // Visual Theme & Styling
  const [theme, setTheme] = useState<PosterTheme>('orange_vibrant');
  const [selectedFont, setSelectedFont] = useState<string>('Cairo');
  // Logo Sizes (in px)
  const [ministryLogoSize, setMinistryLogoSize] = useState<number>(60);
  const [frmssLogoSize, setFrmssLogoSize] = useState<number>(60);
  const [sportVisual, setSportVisual] = useState<string>(() => {
    if (sport.id === 'football' || sport.id === 'futsal') return 'football';
    if (sport.id === 'athletics' || sport.id === 'cross_country') return 'athletics';
    if (sport.id === 'basketball' || sport.id === 'basketball_3x3') return 'basketball';
    if (sport.id === 'handball' || sport.id === 'beach_handball') return 'handball';
    if (sport.id === 'volleyball' || sport.id === 'beach_volleyball' || sport.id === 'mixed_volleyball') return 'volleyball';
    if (sport.id === 'chess') return 'chess';
    if (sport.id === 'table_tennis') return 'table_tennis';
    return 'trophy';
  });

  const [customBgImage, setCustomBgImage] = useState<string | null>(null);
  const [bgOverlayOpacity, setBgOverlayOpacity] = useState<number>(75);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'settings'>('split');
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllSections = (collapse: boolean) => {
    setCollapsedSections({
      theme: collapse,
      font: collapse,
      logoSizes: collapse,
      title: collapse,
      organizer: collapse,
      slogan: collapse,
      datetime: collapse,
      sportVisual: collapse
    });
  };

  const posterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if sport changes
  useEffect(() => {
    setChampionshipTitle(`البطولة الإقليمية المدرسية لـ ${sport.name || SPORTS_MAP[sport.id]?.name || 'البطولة'}`);
    if (sport.id === 'football' || sport.id === 'futsal') setSportVisual('football');
    else if (sport.id === 'athletics' || sport.id === 'cross_country') setSportVisual('athletics');
    else if (sport.id === 'basketball' || sport.id === 'basketball_3x3') setSportVisual('basketball');
    else if (sport.id === 'handball' || sport.id === 'beach_handball') setSportVisual('handball');
    else if (sport.id === 'volleyball' || sport.id === 'beach_volleyball') setSportVisual('volleyball');
    else if (sport.id === 'chess') setSportVisual('chess');
    else if (sport.id === 'table_tennis') setSportVisual('table_tennis');
    else setSportVisual('trophy');
  }, [sport]);

  if (!isOpen) return null;

  // Handle Custom Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error('حجم الصورة كبير جداً، يرجى اختيار صورة أقل من 4 ميغابايت');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCustomBgImage(reader.result as string);
        toast.success('تم تحميل صورة الخلفية بنجاح!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Export as PNG
  const handleDownloadImage = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading('جاري توليد وتحميل الملصق بدقة عالية...');
    try {
      // Small pause to ensure rendering
      await new Promise(resolve => setTimeout(resolve, 150));
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        quality: 0.98
      });

      const link = document.createElement('a');
      link.download = `ملصق-${sportName.replace(/\s+/g, '_')}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('تم تحميل ملصق البطولة بنجاح!', { id: toastId });
    } catch (error) {
      console.error('Error exporting poster image:', error);
      toast.error('تعذر تصدير الملصق، يرجى المحاولة مرة أخرى', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Copy to Clipboard
  const handleCopyToClipboard = async () => {
    if (!posterRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading('جاري نسخ صورة الملصق إلى الحافظة...');
    try {
      const blob = await toBlob(posterRef.current, { pixelRatio: 2, cacheBust: true });
      if (blob && navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ 'image/png': blob })
        ]);
        toast.success('تم نسخ صورة الملصق! يمكنك الآن لصقها (Ctrl+V) مباشرة في واتساب.', { id: toastId });
      } else {
        // Fallback: download
        handleDownloadImage();
      }
    } catch (err) {
      console.warn('Clipboard write error:', err);
      toast.error('المتصفح لا يدعم النسخ المباشر للصور، سيتم تنزيل الصورة بدلاً من ذلك.', { id: toastId });
      handleDownloadImage();
    } finally {
      setIsExporting(false);
    }
  };

  // Print Poster
  const handlePrint = async () => {
    if (!posterRef.current) return;
    const toastId = toast.loading('جاري تجهيز الملصق للطباعة بجودة عالية...');
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      const dataUrl = await toPng(posterRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        quality: 0.98
      });

      const printWindow = window.open('', '_blank', 'width=800,height=1000');
      if (!printWindow) {
        toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة', { id: toastId });
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>طباعة ملصق ${championshipTitle}</title>
            <style>
              @page {
                size: A4 portrait;
                margin: 0;
              }
              html, body {
                margin: 0;
                padding: 0;
                width: 100%;
                height: 100%;
                background-color: #ffffff;
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: hidden;
              }
              img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                display: block;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            </style>
          </head>
          <body>
            <img src="${dataUrl}" alt="Poster to Print" />
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                  window.close();
                }, 400);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
      toast.success('تم فتح نافذة الطباعة بنجاح!', { id: toastId });
    } catch (error) {
      console.error('Error preparing print:', error);
      toast.error('تعذر تحضير الملصق للطباعة، يرجى المحاولة مرة أخرى', { id: toastId });
    }
  };

  // Theme styles helper
  const getThemeClasses = () => {
    switch (theme) {
      case 'orange_vibrant':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-amber-50/70 via-white to-orange-100/80',
          accentBorder: 'border-orange-500',
          titleBg: 'bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white shadow-md',
          titleBadgeBg: 'bg-orange-500/15 border-orange-400/40 text-orange-950',
          subHeaderColor: 'text-amber-900',
          partnerColor: 'text-orange-700',
          badgeBg: 'bg-white/95 border-orange-300/80 text-orange-950 shadow-xs',
          iconColor: 'text-orange-600',
          sloganPrefix: 'text-orange-600',
          silhouetteColor: '#ea580c',
          accentFill: '#f97316',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-slate-800 border-slate-300/80'
        };
      case 'royal_blue':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-sky-50/70 via-white to-blue-100/80',
          accentBorder: 'border-blue-600',
          titleBg: 'bg-gradient-to-r from-blue-700 via-sky-700 to-indigo-800 text-white shadow-md',
          titleBadgeBg: 'bg-blue-500/15 border-blue-400/40 text-blue-950',
          subHeaderColor: 'text-blue-900',
          partnerColor: 'text-blue-700',
          badgeBg: 'bg-white/95 border-blue-300/80 text-blue-950 shadow-xs',
          iconColor: 'text-blue-600',
          sloganPrefix: 'text-blue-600',
          silhouetteColor: '#0284c7',
          accentFill: '#2563eb',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-slate-800 border-slate-300/80'
        };
      case 'morocco_emerald':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-emerald-50/70 via-white to-teal-100/80',
          accentBorder: 'border-emerald-600',
          titleBg: 'bg-gradient-to-r from-emerald-700 via-teal-700 to-green-800 text-white shadow-md',
          titleBadgeBg: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-950',
          subHeaderColor: 'text-emerald-900',
          partnerColor: 'text-emerald-700',
          badgeBg: 'bg-white/95 border-emerald-300/80 text-emerald-950 shadow-xs',
          iconColor: 'text-emerald-600',
          sloganPrefix: 'text-emerald-600',
          silhouetteColor: '#059669',
          accentFill: '#10b981',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-slate-800 border-slate-300/80'
        };
      case 'crimson_gold':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-rose-50/70 via-white to-red-100/80',
          accentBorder: 'border-rose-600',
          titleBg: 'bg-gradient-to-r from-red-700 via-rose-700 to-amber-700 text-white shadow-md',
          titleBadgeBg: 'bg-rose-500/15 border-rose-400/40 text-rose-950',
          subHeaderColor: 'text-rose-900',
          partnerColor: 'text-red-700',
          badgeBg: 'bg-white/95 border-rose-300/80 text-rose-950 shadow-xs',
          iconColor: 'text-rose-600',
          sloganPrefix: 'text-rose-600',
          silhouetteColor: '#dc2626',
          accentFill: '#b91c1c',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-slate-800 border-slate-300/80'
        };
      case 'golden_luxury':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-yellow-50/90 via-white to-amber-100/90',
          accentBorder: 'border-amber-500',
          titleBg: 'bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 text-white shadow-md',
          titleBadgeBg: 'bg-amber-500/20 border-amber-400/50 text-amber-950',
          subHeaderColor: 'text-amber-950',
          partnerColor: 'text-yellow-800',
          badgeBg: 'bg-white/95 border-amber-300/90 text-amber-950 shadow-xs',
          iconColor: 'text-amber-600',
          sloganPrefix: 'text-amber-700',
          silhouetteColor: '#d97706',
          accentFill: '#f59e0b',
          headerTextColor: 'text-amber-950',
          headerSubTextColor: 'text-amber-900',
          partnerPrefixColor: 'text-amber-800',
          sloganBoxBg: 'bg-white/95 text-amber-950 border-amber-300/80'
        };
      case 'purple_majesty':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-purple-50/70 via-white to-fuchsia-100/80',
          accentBorder: 'border-purple-600',
          titleBg: 'bg-gradient-to-r from-purple-700 via-fuchsia-700 to-indigo-800 text-white shadow-md',
          titleBadgeBg: 'bg-purple-500/15 border-purple-400/40 text-purple-950',
          subHeaderColor: 'text-purple-900',
          partnerColor: 'text-fuchsia-800',
          badgeBg: 'bg-white/95 border-purple-300/80 text-purple-950 shadow-xs',
          iconColor: 'text-purple-600',
          sloganPrefix: 'text-purple-700',
          silhouetteColor: '#7e22ce',
          accentFill: '#a855f7',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-purple-950 border-purple-300/80'
        };
      case 'deep_cyan':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-cyan-50/70 via-white to-teal-100/80',
          accentBorder: 'border-cyan-600',
          titleBg: 'bg-gradient-to-r from-cyan-700 via-teal-700 to-sky-800 text-white shadow-md',
          titleBadgeBg: 'bg-cyan-500/15 border-cyan-400/40 text-cyan-950',
          subHeaderColor: 'text-cyan-900',
          partnerColor: 'text-teal-700',
          badgeBg: 'bg-white/95 border-cyan-300/80 text-cyan-950 shadow-xs',
          iconColor: 'text-cyan-600',
          sloganPrefix: 'text-cyan-700',
          silhouetteColor: '#0891b2',
          accentFill: '#06b6d4',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-cyan-950 border-cyan-300/80'
        };
      case 'sunset_warm':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-orange-100/60 via-amber-50/50 to-rose-100/80',
          accentBorder: 'border-rose-500',
          titleBg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-rose-700 text-white shadow-md',
          titleBadgeBg: 'bg-orange-500/20 border-rose-300/50 text-rose-950',
          subHeaderColor: 'text-orange-950',
          partnerColor: 'text-rose-800',
          badgeBg: 'bg-white/95 border-rose-300/80 text-rose-950 shadow-xs',
          iconColor: 'text-rose-600',
          sloganPrefix: 'text-rose-600',
          silhouetteColor: '#e11d48',
          accentFill: '#f43f5e',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-rose-950 border-rose-300/80'
        };
      case 'moroccan_flag':
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-rose-50/80 via-white to-emerald-100/80',
          accentBorder: 'border-red-600',
          titleBg: 'bg-gradient-to-r from-red-700 via-rose-700 to-emerald-700 text-white shadow-md',
          titleBadgeBg: 'bg-red-500/15 border-emerald-400/40 text-emerald-950',
          subHeaderColor: 'text-red-950',
          partnerColor: 'text-emerald-800',
          badgeBg: 'bg-white/95 border-emerald-300/80 text-emerald-950 shadow-xs',
          iconColor: 'text-red-600',
          sloganPrefix: 'text-emerald-700',
          silhouetteColor: '#15803d',
          accentFill: '#16a34a',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-emerald-950 border-emerald-300/80'
        };
      case 'midnight_dark':
        return {
          isDark: true,
          bg: 'bg-gradient-to-b from-slate-900 via-slate-850 to-zinc-900 text-white',
          accentBorder: 'border-amber-400',
          titleBg: 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-500 text-slate-950 font-black shadow-md',
          titleBadgeBg: 'bg-amber-400/20 border-amber-400/50 text-amber-300',
          subHeaderColor: 'text-amber-200',
          partnerColor: 'text-amber-400',
          badgeBg: 'bg-slate-800/95 border-slate-700 text-slate-100 shadow-xs',
          iconColor: 'text-amber-400',
          sloganPrefix: 'text-amber-400',
          silhouetteColor: '#f59e0b',
          accentFill: '#fbbf24',
          headerTextColor: 'text-slate-100',
          headerSubTextColor: 'text-slate-300',
          partnerPrefixColor: 'text-slate-400',
          sloganBoxBg: 'bg-slate-800/95 text-amber-200 border-amber-500/30'
        };
      case 'clean_slate':
      default:
        return {
          isDark: false,
          bg: 'bg-gradient-to-b from-slate-50/70 via-white to-slate-200/80',
          accentBorder: 'border-slate-700',
          titleBg: 'bg-gradient-to-r from-slate-800 via-slate-700 to-slate-900 text-white shadow-md',
          titleBadgeBg: 'bg-slate-500/15 border-slate-400/40 text-slate-950',
          subHeaderColor: 'text-slate-900',
          partnerColor: 'text-slate-700',
          badgeBg: 'bg-white/95 border-slate-300/80 text-slate-950 shadow-xs',
          iconColor: 'text-slate-700',
          sloganPrefix: 'text-slate-700',
          silhouetteColor: '#334155',
          accentFill: '#475569',
          headerTextColor: 'text-slate-800',
          headerSubTextColor: 'text-slate-700',
          partnerPrefixColor: 'text-slate-600',
          sloganBoxBg: 'bg-white/95 text-slate-800 border-slate-300/80'
        };
    }
  };

  const currentTheme = getThemeClasses();

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl my-auto flex flex-col overflow-visible lg:overflow-hidden lg:max-h-[96vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar - Ultra sleek on mobile */}
        <div className="px-3.5 py-2 sm:px-5 sm:py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-orange-400 shrink-0">
              <Palette className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div>
              <h2 className="text-xs sm:text-base font-extrabold flex items-center gap-1.5 sm:gap-2">
                <span>ملصق البطولة</span>
                <span className="bg-orange-500/20 text-orange-300 text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-full border border-orange-500/30">
                  {sportName}
                </span>
              </h2>
              <p className="hidden sm:block text-[11px] text-slate-300">
                توليد ملصق رسمي وأنيق للبطولة قابل للتحميل كصورة (PNG) للواتساب أو الطباعة المباشرة (A4)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>تحميل PNG</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body: Split Layout (Always Unified) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-visible lg:overflow-hidden">
          
          {/* Controls Panel */}
          <div className="col-span-1 lg:col-span-5 border-l border-slate-200 shrink-0 lg:flex-1 lg:overflow-y-auto p-3.5 sm:p-5 space-y-3.5 sm:space-y-4 bg-slate-50 order-2 lg:order-1 block pb-12 sm:pb-8">
            
            {/* Live Synchronized Banner */}
            <div className="bg-orange-50 border border-orange-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs text-orange-950 font-bold gap-2">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-orange-600 animate-pulse shrink-0" />
                <span className="truncate">التعديلات تنعكس فورياً ومباشرة</span>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleAllSections(true)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300/60 font-bold transition-colors cursor-pointer"
                  title="طي جميع الخصائص"
                >
                  طي الكل
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllSections(false)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-orange-100 hover:bg-orange-200 text-orange-900 border border-orange-300/60 font-bold transition-colors cursor-pointer"
                  title="إظهار جميع الخصائص"
                >
                  إظهار الكل
                </button>
              </div>
            </div>
            
            {/* Quick Themes */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Palette className="h-4 w-4 text-orange-600 shrink-0" />
                  <span className="truncate">السمة اللونية وتصميم الملصق</span>
                  <span className="text-[10px] font-extrabold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full shrink-0 hidden xs:inline-block">
                    {POSTER_THEME_OPTIONS.length} ألوان
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('theme')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['theme'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['theme'] ? 'rotate-180 text-orange-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['theme'] && (
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3 gap-1.5 pt-0.5">
                  {POSTER_THEME_OPTIONS.map(t => {
                    const isActive = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id)}
                        className={`h-9 px-2 rounded-xl flex items-center justify-start gap-2 text-xs font-bold border transition-all cursor-pointer ${
                          isActive
                            ? `ring-2 ${t.ringColor} ${t.activeBorder} ${t.activeBg} ${t.activeText} font-black shadow-xs`
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                        title={t.desc}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10 shadow-2xs"
                          style={{ backgroundColor: t.previewColor }}
                        />
                        <span className="truncate text-[11px]">{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Font Selection Control */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Type className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">نوع خط الملصق الإعلاني (Font)</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('font')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['font'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['font'] ? 'rotate-180 text-blue-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['font'] && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-0.5">
                  {POSTER_FONTS.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setSelectedFont(f.id)}
                      className={`p-2 rounded-xl text-xs border transition-all cursor-pointer text-center flex flex-col items-center justify-center ${
                        selectedFont === f.id
                          ? 'bg-blue-50 text-blue-950 border-blue-500 ring-2 ring-blue-500/20 shadow-3xs font-black'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                      }`}
                      style={{ fontFamily: f.css }}
                    >
                      <span className="text-sm font-bold">أ ب جـ</span>
                      <span className="text-[10px] text-slate-600 truncate max-w-full">{f.id}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Logo Sizes Controls */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate">التحكم في حجم الشعارات (الرأسية)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMinistryLogoSize(60);
                      setFrmssLogoSize(60);
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer shrink-0"
                  >
                    إعادة ضبط
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSection('logoSizes')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['logoSizes'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['logoSizes'] ? 'rotate-180 text-blue-600 font-bold' : ''}`} />
                </button>
              </div>

              {!collapsedSections['logoSizes'] && (
                <div className="space-y-3 pt-0.5">
                  {/* Ministry Logo Size */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span>شعار الوزارة (في الوسط):</span>
                      <span className="font-mono text-blue-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">{ministryLogoSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">صغير</span>
                      <input
                        type="range"
                        min="35"
                        max="115"
                        value={ministryLogoSize}
                        onChange={(e) => setMinistryLogoSize(Number(e.target.value))}
                        className="flex-1 accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400">كبير</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[45, 60, 80, 100].map((sz, idx) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setMinistryLogoSize(sz)}
                          className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                            ministryLogoSize === sz ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {idx === 0 ? 'صغير' : idx === 1 ? 'افتراضي' : idx === 2 ? 'كبير' : 'كبير جداً'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* FRMSS Logo Size */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span>شعار الجامعة (اليمين واليسار):</span>
                      <span className="font-mono text-amber-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">{frmssLogoSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">صغير</span>
                      <input
                        type="range"
                        min="35"
                        max="115"
                        value={frmssLogoSize}
                        onChange={(e) => setFrmssLogoSize(Number(e.target.value))}
                        className="flex-1 accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400">كبير</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[45, 60, 80, 100].map((sz, idx) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setFrmssLogoSize(sz)}
                          className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                            frmssLogoSize === sz ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {idx === 0 ? 'صغير' : idx === 1 ? 'افتراضي' : idx === 2 ? 'كبير' : 'كبير جداً'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Title Section */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">عنوان البطولة الرئيسي (وسط الملصق)</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('title')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['title'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['title'] ? 'rotate-180 text-amber-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['title'] && (
                <div className="pt-0.5">
                  <input
                    type="text"
                    value={championshipTitle}
                    onChange={(e) => setChampionshipTitle(e.target.value)}
                    placeholder="مثال: البطولة الإقليمية المدرسية لكرة القدم"
                    className="w-full text-xs font-extrabold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-hidden"
                  />
                </div>
              )}
            </div>

            {/* Organizer & Partner */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Building className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="truncate">الجهة المنظمة والفرع الإقليمي</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('organizer')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['organizer'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['organizer'] ? 'rotate-180 text-blue-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['organizer'] && (
                <div className="space-y-2 pt-0.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">الجهة المنظمة:</span>
                    <input
                      type="text"
                      value={organizer}
                      onChange={(e) => setOrganizer(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">الفرع الإقليمي الشريك:</span>
                    <input
                      type="text"
                      value={partner}
                      onChange={(e) => setPartner(e.target.value)}
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Slogan */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                  <span className="truncate">شعار الدورة</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('slogan')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['slogan'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['slogan'] ? 'rotate-180 text-purple-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['slogan'] && (
                <div className="space-y-2 pt-0.5">
                  <input
                    type="text"
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    placeholder="أدخل شعار البطولة..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-hidden font-bold text-purple-900"
                  />
                  <div className="flex flex-wrap gap-1 pt-1">
                    {QUICK_SLOGANS.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSlogan(s)}
                        className="text-[9px] px-2 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-md border border-purple-200 cursor-pointer text-right transition-colors"
                      >
                        "{s.substring(0, 32)}..."
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Date, Time & Venue */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  <span className="truncate">موعد ومكان إجراء المنافسات</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('datetime')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['datetime'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['datetime'] ? 'rotate-180 text-emerald-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['datetime'] && (
                <div className="space-y-2 pt-0.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                      <Calendar className="h-3 w-3 text-emerald-600" /> تاريخ البطولة:
                    </span>
                    <input
                      type="text"
                      value={dateText}
                      onChange={(e) => setDateText(e.target.value)}
                      placeholder="مثال: يوم الأربعاء 12/09/2026"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                      <Clock className="h-3 w-3 text-emerald-600" /> التوقيت:
                    </span>
                    <input
                      type="text"
                      value={timeText}
                      onChange={(e) => setTimeText(e.target.value)}
                      placeholder="مثال: ابتداء من الساعة التاسعة صباحاً"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden font-medium"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mb-0.5">
                      <MapPin className="h-3 w-3 text-red-600" /> مكان التباري (الفضاء الرياضي):
                    </span>
                    <input
                      type="text"
                      value={venueText}
                      onChange={(e) => setVenueText(e.target.value)}
                      placeholder="مثال: بالقاعة المغطاة للرياضات"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-hidden font-medium"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Sport Silhouette Visual & Custom Photo */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <FileImage className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">الرسم الظلي الرياضي أو صورة الخلفية</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('sportVisual')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['sportVisual'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['sportVisual'] ? 'rotate-180 text-indigo-600 font-bold' : ''}`} />
                </button>
              </div>
              
              {!collapsedSections['sportVisual'] && (
                <div className="space-y-2 pt-0.5">
                  <div className="grid grid-cols-4 gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setSportVisual('football'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'football' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      ⚽ كرة القدم
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSportVisual('athletics'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'athletics' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      🏃 عدو وقوى
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSportVisual('basketball'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'basketball' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      🏀 كرة السلة
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSportVisual('handball'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'handball' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      🤾 كرة اليد
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSportVisual('volleyball'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'volleyball' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      🏐 كرة الطائرة
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSportVisual('chess'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'chess' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      ♟️ الشطرنج
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSportVisual('table_tennis'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'table_tennis' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      🏓 كرة الطاولة
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSportVisual('trophy'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'trophy' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      🏆 كأس البطولة
                    </button>
                  </div>

                  {/* Upload custom background optional */}
                  <div className="pt-2 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                        accept="image/*"
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{customBgImage ? 'تغيير صورة الخلفية المخصصة' : 'رفع صورة مخصصة للخلفية'}</span>
                      </button>
                      {customBgImage && (
                        <button
                          type="button"
                          onClick={() => setCustomBgImage(null)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-[10px] font-bold border border-red-200 cursor-pointer"
                          title="إلغاء الصورة المخصصة"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    {customBgImage && (
                      <div className="bg-slate-100/80 p-2 rounded-xl border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-700">
                          <span>وضوح نصوص الملصق فوق الصورة:</span>
                          <span className="text-orange-600 font-mono">{bgOverlayOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min="30"
                          max="95"
                          step="5"
                          value={bgOverlayOpacity}
                          onChange={(e) => setBgOverlayOpacity(Number(e.target.value))}
                          className="w-full h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-orange-600"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Poster Preview Panel (Always Unified) */}
          <div className="col-span-1 lg:col-span-7 bg-slate-200/90 p-3 sm:p-5 flex flex-col items-center justify-start lg:justify-center order-1 lg:order-2 shrink-0 lg:flex-1 lg:overflow-y-auto lg:overflow-x-hidden pb-6 sm:pb-8">
            
            {/* Action & Zoom Bar Above Preview */}
            <div className="w-full max-w-[480px] mb-2 sm:mb-3 flex items-center justify-between gap-1.5 text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-800 text-[11px] sm:text-xs flex items-center gap-1">
                  <span>معاينة الملصق</span>
                </span>
                {/* Zoom Controls */}
                <div className="flex items-center bg-white rounded-lg border border-slate-300 p-0.5 text-[10px] sm:text-[11px] shadow-3xs">
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(Math.max(0.5, Number((previewZoom - 0.15).toFixed(2))))}
                    className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold"
                    title="تصغير المعاينة"
                  >
                    -
                  </button>
                  <span className="px-1 font-mono text-[9px] sm:text-[10px] text-slate-600 font-bold">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewZoom(Math.min(1.5, Number((previewZoom + 0.15).toFixed(2))))}
                    className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-slate-700 font-bold"
                    title="تكبير المعاينة"
                  >
                    +
                  </button>
                  {previewZoom !== 1 && (
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(1)}
                      className="px-1 py-0.5 text-[8px] sm:text-[9px] bg-slate-100 hover:bg-slate-200 rounded text-orange-700 font-bold"
                    >
                      100%
                    </button>
                  )}
                  {previewZoom !== 0.8 && (
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(0.8)}
                      className="px-1 py-0.5 text-[8px] sm:text-[9px] bg-orange-50 hover:bg-orange-100 rounded text-orange-800 font-bold"
                      title="ملاءمة الشاشة بالكامل"
                    >
                      ملاءمة
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleCopyToClipboard}
                  className="text-[10px] sm:text-[11px] font-bold text-slate-700 bg-white px-2 py-1 rounded-lg border border-slate-300 hover:bg-slate-50 flex items-center gap-1 shadow-3xs cursor-pointer"
                  title="نسخ الصورة للحافظة للصقها في واتساب مباشرة"
                >
                  <Copy className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-blue-600" />
                  <span>واتساب</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  disabled={isExporting}
                  className="text-[10px] sm:text-[11px] font-bold text-white bg-orange-600 px-2.5 py-1 rounded-lg hover:bg-orange-700 flex items-center gap-1 shadow-3xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>PNG</span>
                </button>
              </div>
            </div>

            {/* Poster Canvas Element */}
            <div className="w-full flex justify-center overflow-x-auto py-0.5">
              <div
                ref={posterRef}
                id="tournament-poster-canvas"
                className={`w-full max-w-[285px] xs:max-w-[330px] sm:max-w-[420px] md:max-w-[480px] aspect-[1/1.414] rounded-2xl sm:rounded-3xl shadow-2xl border-2 sm:border-4 ${currentTheme.accentBorder} ${currentTheme.bg} p-1.5 xs:p-2.5 sm:p-5 md:p-6 flex flex-col justify-between relative overflow-hidden select-none transition-all duration-150`}
                style={{
                  fontFamily: (POSTER_FONTS.find(f => f.id === selectedFont)?.css || "'Cairo', sans-serif"),
                  backgroundImage: customBgImage ? `url(${customBgImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transform: previewZoom !== 1 ? `scale(${previewZoom})` : undefined,
                  transformOrigin: 'top center'
                }}
              >
              {/* Optional overlay when custom background image is used */}
              {customBgImage && (
                <div
                  className="absolute inset-0 pointer-events-none z-0 transition-opacity"
                  style={{ backgroundColor: `rgba(255, 255, 255, ${bgOverlayOpacity / 100})` }}
                />
              )}

              {/* Decorative Subtle Corner Ribbons / Geometric Accents */}
              <div className="absolute top-0 right-0 w-16 sm:w-32 h-16 sm:h-32 bg-gradient-to-bl from-orange-400/10 to-transparent rounded-bl-full pointer-events-none z-0" />
              <div className="absolute top-0 left-0 w-16 sm:w-32 h-16 sm:h-32 bg-gradient-to-br from-blue-400/10 to-transparent rounded-br-full pointer-events-none z-0" />

              {/* --- 1. Official Header: Ministry in Center, FRMSS on Right and Left --- */}
              <div className="relative z-10 w-full flex items-center justify-between pb-1 sm:pb-2.5 border-b sm:border-b-2 border-slate-300/60">
                
                {/* Right: FRMSS Logo */}
                <div
                  className="flex items-center justify-start shrink-0 transition-all"
                  style={{ width: `${Math.max(Math.round(frmssLogoSize * 0.75), 32)}px` }}
                >
                  {officialLogos?.frmssLogo ? (
                    <img
                      src={officialLogos.frmssLogo}
                      alt="FRMSS"
                      style={{ height: `${frmssLogoSize}px`, maxHeight: '68px' }}
                      className="object-contain drop-shadow-xs transition-all w-auto"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <AppLogo size={Math.max(Math.round(frmssLogoSize * 0.6), 18)} />
                      <span className="text-[5px] sm:text-[8px] font-black text-slate-700 tracking-tighter mt-0.5">FRMSS</span>
                    </div>
                  )}
                </div>

                {/* Center: Ministry Logo */}
                <div className="flex-1 flex flex-col items-center justify-center px-0.5 text-center">
                  {officialLogos?.ministryLogo ? (
                    <img
                      src={officialLogos.ministryLogo}
                      alt="شعار الوزارة"
                      style={{ height: `${ministryLogoSize}px`, maxHeight: '68px' }}
                      className="mx-auto object-contain drop-shadow-xs transition-all w-auto"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      {/* Crisp Kingdom Coat of Arms Vector */}
                      <svg
                        style={{
                          width: `${Math.round(ministryLogoSize * 0.55)}px`,
                          height: `${Math.round(ministryLogoSize * 0.55)}px`
                        }}
                        className="mb-0.5 transition-all mx-auto"
                        viewBox="0 0 100 100"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        {/* Crown */}
                        <path d="M40 12 L50 4 L60 12 L56 22 L44 22 Z" fill="#ca8a04" stroke="#854d0e" strokeWidth="1.5" />
                        <circle cx="50" cy="8" r="2.5" fill="#dc2626" />
                        {/* Shield */}
                        <path d="M30 26 Q50 20 70 26 Q72 58 50 78 Q28 58 30 26 Z" fill="#dc2626" stroke="#ca8a04" strokeWidth="3" />
                        <circle cx="50" cy="46" r="14" fill="#15803d" />
                        {/* Star */}
                        <polygon points="50,36 53,44 62,44 55,49 57,58 50,53 43,58 45,49 38,44 47,44" fill="#fef08a" />
                        {/* Lions Supporters */}
                        <path d="M22 34 C16 42 16 56 26 64" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" />
                        <path d="M78 34 C84 42 84 56 74 64" stroke="#ca8a04" strokeWidth="3" strokeLinecap="round" />
                        {/* Banner Ribbon */}
                        <path d="M24 82 Q50 74 76 82 L72 88 Q50 82 28 88 Z" fill="#ca8a04" />
                      </svg>
                      <span className="text-[6.5px] xs:text-[7.5px] sm:text-[11px] font-black text-slate-800 leading-tight">المملكة المغربية</span>
                      <span className="text-[5.5px] xs:text-[6.5px] sm:text-[10px] font-bold text-slate-700 leading-tight">وزارة التربية الوطنية والتعليم الأولي والرياضة</span>
                    </div>
                  )}
                </div>

                {/* Left: FRMSS Logo */}
                <div
                  className="flex items-center justify-end shrink-0 transition-all"
                  style={{ width: `${Math.max(Math.round(frmssLogoSize * 0.75), 32)}px` }}
                >
                  {officialLogos?.frmssLogo ? (
                    <img
                      src={officialLogos.frmssLogo}
                      alt="FRMSS"
                      style={{ height: `${frmssLogoSize}px`, maxHeight: '68px' }}
                      className="object-contain drop-shadow-xs transition-all w-auto"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <AppLogo size={Math.max(Math.round(frmssLogoSize * 0.6), 18)} />
                      <span className="text-[5px] sm:text-[8px] font-black text-slate-700 tracking-tighter mt-0.5">FRMSS</span>
                    </div>
                  )}
                </div>
              </div>

              {/* --- 2. Organization Lines --- */}
              <div className="relative z-10 text-center my-1 xs:my-1.5 sm:my-3.5 space-y-0.5 sm:space-y-1">
                <div className={`text-[7.5px] xs:text-[8.5px] sm:text-sm font-black ${currentTheme.sloganPrefix}`}>
                  {organizerPrefix}
                </div>
                <div className={`text-[8.5px] xs:text-[10.5px] sm:text-base font-extrabold ${currentTheme.subHeaderColor} tracking-tight leading-snug`}>
                  {organizer}
                </div>
                <div className="text-[6.5px] xs:text-[7.5px] sm:text-xs font-black text-slate-600">
                  {partnerPrefix}
                </div>
                <div className={`text-[7.5px] xs:text-[9px] sm:text-sm font-extrabold ${currentTheme.partnerColor} leading-tight`}>
                  {partner}
                </div>
              </div>

              {/* --- 3. Prominent Championship Title Badge --- */}
              <div className="relative z-10 my-1 xs:my-1.5 sm:my-4 flex justify-center">
                <div className="relative w-full max-w-[98%]">
                  {/* Outer glow / border shape */}
                  <div className={`py-1.5 xs:py-2.5 sm:py-5 px-2 sm:px-6 rounded-xl sm:rounded-3xl ${currentTheme.titleBg} text-center border sm:border-2 border-white/40 transform transition-transform shadow-xs sm:shadow-xl`}>
                    <div className="text-[6.5px] xs:text-[8px] sm:text-xs font-extrabold tracking-wider opacity-90 mb-0.5 sm:mb-1">
                      منافسات الرياضة المدرسية
                    </div>
                    <div className="text-[9.5px] xs:text-[12px] sm:text-2xl font-black tracking-tight leading-tight drop-shadow-xs">
                      {championshipTitle}
                    </div>
                  </div>
                </div>
              </div>

              {/* --- 4. Slogan Section --- */}
              <div className="relative z-10 text-center my-1 xs:my-1.5 sm:my-3">
                <span className={`text-[6.5px] xs:text-[8px] sm:text-[11px] font-black ${currentTheme.sloganPrefix} uppercase tracking-widest block mb-0.5`}>
                  تحت شعار
                </span>
                <div className="inline-block bg-white/95 backdrop-blur-xs px-2 xs:px-3 sm:px-5 py-0.5 sm:py-1.5 rounded-full border border-slate-300/80 shadow-2xs">
                  <span className="text-[7.5px] xs:text-[9.5px] sm:text-sm font-extrabold text-slate-800 tracking-tight">
                    "{slogan}"
                  </span>
                </div>
              </div>

              {/* --- 5. Date & Location Badges --- */}
              <div className="relative z-10 grid grid-cols-2 gap-1 sm:gap-3 my-1 xs:my-1.5 sm:my-4">
                {/* Date & Time Badge */}
                <div className={`p-1.5 xs:p-2 sm:p-3.5 rounded-lg sm:rounded-2xl border ${currentTheme.badgeBg} flex items-center gap-1.5 sm:gap-3`}>
                  <div className={`w-5 h-5 xs:w-6 xs:h-6 sm:w-10 sm:h-10 rounded-md sm:rounded-xl bg-orange-100 flex items-center justify-center ${currentTheme.iconColor} shrink-0`}>
                    <Calendar className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[7px] xs:text-[8px] sm:text-xs font-black text-slate-900 leading-tight truncate">{dateText}</div>
                    <div className="text-[6px] xs:text-[7px] sm:text-[10px] font-extrabold text-orange-600 truncate mt-0.5">{timeText}</div>
                  </div>
                </div>

                {/* Location / Venue Badge */}
                <div className={`p-1.5 xs:p-2 sm:p-3.5 rounded-lg sm:rounded-2xl border ${currentTheme.badgeBg} flex items-center gap-1.5 sm:gap-3`}>
                  <div className={`w-5 h-5 xs:w-6 xs:h-6 sm:w-10 sm:h-10 rounded-md sm:rounded-xl bg-red-100 flex items-center justify-center text-red-600 shrink-0`}>
                    <MapPin className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-5 sm:w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[7px] xs:text-[8px] sm:text-xs font-black text-slate-900 leading-tight truncate">{venueText}</div>
                    <div className="text-[6px] xs:text-[7px] sm:text-[10px] font-extrabold text-slate-600 truncate mt-0.5">{resolvedDirName}</div>
                  </div>
                </div>
              </div>

              {/* --- 6. Dynamic Sport Silhouette & Track Graphic --- */}
              <div className="relative z-10 mt-auto pt-1 sm:pt-1.5 flex items-end justify-center min-h-[48px] xs:min-h-[60px] sm:min-h-[110px] overflow-hidden">
                {/* Athletic Finish line / Running Silhouette */}
                {sportVisual === 'athletics' && (
                  <div className="w-full relative flex flex-col items-center">
                    <svg viewBox="0 0 500 160" className="w-full h-12 xs:h-16 sm:h-28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Running Track Lanes */}
                      <path d="M0 150 Q250 120 500 150" stroke="#f97316" strokeWidth="6" opacity="0.6" />
                      <path d="M0 135 Q250 108 500 135" stroke="#ea580c" strokeWidth="4" opacity="0.4" />
                      <path d="M0 120 Q250 96 500 120" stroke="#c2410c" strokeWidth="3" opacity="0.2" />

                      {/* Center Runner Silhouettes crossing finish tape */}
                      <g fill={currentTheme.silhouetteColor}>
                        {/* Winner runner with hands raised */}
                        <circle cx="250" cy="40" r="10" />
                        <path d="M250 52 L242 78 L230 115 M250 52 L260 82 L275 118" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        {/* Raised arms */}
                        <path d="M250 55 L225 35 L215 20 M250 55 L275 35 L285 20" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        {/* Torso */}
                        <path d="M246 50 L254 50 L252 82 L244 82 Z" />

                        {/* Finish Ribbon */}
                        <path d="M160 65 Q250 78 340 65" stroke="#ef4444" strokeWidth="5" strokeLinecap="round" opacity="0.9" />

                        {/* Left Runner */}
                        <circle cx="150" cy="60" r="8" />
                        <path d="M150 70 L144 92 L132 120 M150 70 L158 96 L168 122 M150 74 L135 84 M150 74 L165 78" stroke={currentTheme.silhouetteColor} strokeWidth="5" strokeLinecap="round" opacity="0.75" />

                        {/* Right Runner */}
                        <circle cx="350" cy="62" r="8" />
                        <path d="M350 72 L342 94 L330 122 M350 72 L360 98 L370 124 M350 76 L335 86 M350 76 L365 80" stroke={currentTheme.silhouetteColor} strokeWidth="5" strokeLinecap="round" opacity="0.75" />
                      </g>
                    </svg>
                  </div>
                )}

                {/* Football Silhouette */}
                {sportVisual === 'football' && (
                  <div className="w-full relative flex items-center justify-between px-3 sm:px-6">
                    <svg viewBox="0 0 400 130" className="w-full h-12 xs:h-16 sm:h-28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Football Striker Kicking */}
                      <g fill={currentTheme.silhouetteColor}>
                        <circle cx="160" cy="35" r="10" />
                        <path d="M160 48 L145 74 L125 105 M160 48 L185 68 L220 72" stroke={currentTheme.silhouetteColor} strokeWidth="7" strokeLinecap="round" />
                        <path d="M160 52 L135 48 M160 52 L175 42" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        <path d="M155 46 L165 46 L155 76 L145 76 Z" />
                      </g>

                      {/* Speed lines */}
                      <path d="M220 70 L260 55" stroke="#f97316" strokeWidth="4" strokeDasharray="6 4" />
                      <path d="M210 80 L250 65" stroke="#ea580c" strokeWidth="3" strokeDasharray="4 4" />

                      {/* Soccer Ball */}
                      <g transform="translate(265, 40)">
                        <circle cx="20" cy="20" r="18" fill="#ffffff" stroke="#0f172a" strokeWidth="2.5" />
                        <polygon points="20,10 28,16 25,25 15,25 12,16" fill="#0f172a" />
                        <polygon points="20,10 12,16 8,14 13,8 20,8" fill="#0f172a" opacity="0.6" />
                        <polygon points="28,16 25,25 32,30 36,22 30,16" fill="#0f172a" opacity="0.6" />
                      </g>
                    </svg>
                  </div>
                )}

                {/* Basketball Silhouette */}
                {sportVisual === 'basketball' && (
                  <div className="w-full flex items-center justify-center">
                    <svg viewBox="0 0 350 130" className="w-full h-12 xs:h-16 sm:h-28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Hoop */}
                      <rect x="260" y="20" width="8" height="50" fill="#334155" />
                      <line x1="260" y1="35" x2="225" y2="35" stroke="#ef4444" strokeWidth="4" />
                      <path d="M225 35 L230 65 L255 65 L260 35 Z" fill="none" stroke="#e2e8f0" strokeWidth="2" strokeDasharray="4 3" />

                      {/* Dunker */}
                      <g fill={currentTheme.silhouetteColor}>
                        <circle cx="160" cy="30" r="9" />
                        <path d="M160 40 L165 70 L150 105 M160 40 L180 75 L195 110" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        <path d="M160 45 L195 28 L220 28" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        <circle cx="218" cy="24" r="12" fill="#ea580c" stroke="#fff" strokeWidth="1.5" />
                      </g>
                    </svg>
                  </div>
                )}

                {/* Handball Silhouette */}
                {sportVisual === 'handball' && (
                  <div className="w-full flex items-center justify-center">
                    <svg viewBox="0 0 350 130" className="w-full h-12 xs:h-16 sm:h-28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g fill={currentTheme.silhouetteColor}>
                        <circle cx="160" cy="35" r="9" />
                        <path d="M160 46 L150 75 L135 110 M160 46 L175 75 L200 100" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        <path d="M160 50 L135 55 M160 50 L195 35 L210 25" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        <circle cx="215" cy="22" r="7" fill="#f59e0b" stroke="#fff" strokeWidth="1" />
                      </g>
                    </svg>
                  </div>
                )}

                {/* Volleyball Silhouette */}
                {sportVisual === 'volleyball' && (
                  <div className="w-full flex items-center justify-center">
                    <svg viewBox="0 0 350 130" className="w-full h-12 xs:h-16 sm:h-28" fill="none" xmlns="http://www.w3.org/2000/svg">
                      {/* Net */}
                      <line x1="200" y1="30" x2="200" y2="120" stroke="#64748b" strokeWidth="4" />
                      <rect x="195" y="30" width="10" height="40" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" strokeDasharray="3 3" />

                      {/* Spiker */}
                      <g fill={currentTheme.silhouetteColor}>
                        <circle cx="150" cy="32" r="9" />
                        <path d="M150 42 L145 72 L130 105 M150 42 L165 72 L180 105" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        <path d="M150 46 L130 50 M150 46 L175 25 L190 15" stroke={currentTheme.silhouetteColor} strokeWidth="6" strokeLinecap="round" />
                        <circle cx="196" cy="12" r="10" fill="#0284c7" stroke="#fff" strokeWidth="1.5" />
                      </g>
                    </svg>
                  </div>
                )}

                {/* Table Tennis / Chess / Trophy Fallback */}
                {(sportVisual === 'table_tennis' || sportVisual === 'chess' || sportVisual === 'trophy') && (
                  <div className="w-full flex items-center justify-center py-0.5">
                    <div className="flex items-center gap-2 sm:gap-6">
                      <div className="w-6 h-6 sm:w-14 sm:h-14 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-xs sm:text-3xl shadow-xs">
                        🏆
                      </div>
                      <div className="text-center">
                        <div className="text-[8.5px] sm:text-sm font-black text-slate-800">تنافس رياضي شريف</div>
                        <div className="text-[7px] sm:text-[10px] font-extrabold text-amber-700">قيم التعاون والتميز المدرسي</div>
                      </div>
                      <div className="w-6 h-6 sm:w-14 sm:h-14 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-xs sm:text-3xl shadow-xs">
                        🥇
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* --- Bottom Footer Strip --- */}
              <div className="relative z-10 pt-0.5 sm:pt-2 border-t border-slate-300/60 text-center space-y-0.5">
                <div className="text-[6.5px] xs:text-[7.5px] sm:text-[10px] font-bold text-slate-700 leading-tight">
                  البوابة الرقمية لتدبير البطولات المدرسية الاقليمية والجهوية والوطنية
                </div>
                <div className="text-[5.5px] xs:text-[6.5px] sm:text-[9px] font-medium text-slate-500">
                  كل الحقوق محفوظة 2026
                </div>
              </div>
            </div>
          </div>

        </div>

        </div>

        {/* Modal Bottom Sticky Footer */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="hidden sm:block text-xs text-slate-600 font-medium">
            💡 <span className="font-bold">نصيحة:</span> اضغط على <span className="font-bold text-orange-600">"تحميل كصورة"</span> لحفظ الملصق وإرساله فوراً للأساتذة عبر مجموعات الواتساب الرسمية.
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCopyToClipboard}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-[11px] sm:text-xs font-bold transition-all shadow-3xs cursor-pointer"
            >
              <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-blue-600" />
              <span>نسخ للواتساب</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>طباعة A4</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{isExporting ? 'جاري التوليد...' : 'تحميل PNG'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
