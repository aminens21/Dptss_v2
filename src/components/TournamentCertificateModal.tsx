import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Download,
  Printer,
  Copy,
  Calendar,
  MapPin,
  Palette,
  Sparkles,
  Check,
  Upload,
  RotateCcw,
  Trophy,
  Award,
  Medal,
  FileImage,
  Building,
  UserCheck,
  Edit3,
  SlidersHorizontal,
  Settings,
  Eye,
  Move,
  PenTool,
  FileText,
  Type,
  ChevronDown
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import jsPDF from 'jspdf';
import toast from 'react-hot-toast';
import { AppLogo } from './AppLogo';
import { SportSilhouette } from './SportSilhouettes';
import { Tournament, Directorate, Sport } from '../types';
import { SPORTS_MAP, OfficialLogos } from '../lib/dataService';

interface TournamentCertificateModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | { id: string; name: string; icon?: string };
  directorateName?: string;
  directorateObj?: Directorate | null;
  tournaments?: Tournament[];
  officialLogos?: OfficialLogos;
  activeSeason?: string;
}

type CertificateTheme = 'crimson_gold' | 'orange_vibrant' | 'royal_blue' | 'morocco_emerald' | 'clean_slate';

export const CERTIFICATE_FONTS = [
  { id: 'Arabswell', name: 'Arabswell (خط عربسويل الرقعي)', sampleText: 'أ ب جـ د — Arabswell (خط عربسويل)', css: "'Arabswell', 'Aref Ruqaa Ink', 'Aref Ruqaa', cursive, serif" },
  { id: 'Amiri', name: 'Amiri (خط أميري الأصيل)', sampleText: 'أ ب جـ د — Amiri (خط أميري الأصيل)', css: "'Amiri', serif" },
  { id: 'Cairo', name: 'Cairo (خط القاهرة العصري)', sampleText: 'أ ب جـ د — Cairo (خط القاهرة العصري)', css: "'Cairo', sans-serif" },
  { id: 'Tajawal', name: 'Tajawal (خط تجوال الأنيق)', sampleText: 'أ ب جـ د — Tajawal (خط تجوال الأنيق)', css: "'Tajawal', sans-serif" },
  { id: 'Aref Ruqaa Ink', name: 'Aref Ruqaa Ink (خط حبر الرقعة)', sampleText: 'أ ب جـ د — Aref Ruqaa Ink (خط حبر الرقعة)', css: "'Aref Ruqaa Ink', 'Aref Ruqaa', serif" },
  { id: 'Aref Ruqaa', name: 'Aref Ruqaa (خط الرقعة التراثي)', sampleText: 'أ ب جـ د — Aref Ruqaa (خط الرقعة التراثي)', css: "'Aref Ruqaa', serif" },
  { id: 'Changa', name: 'Changa (خط تشانغا الرياضي)', sampleText: 'أ ب جـ د — Changa (خط تشانغا الرياضي)', css: "'Changa', sans-serif" },
  { id: 'Reem Kufi', name: 'Reem Kufi (خط ريم الكوفي)', sampleText: 'أ ب جـ د — Reem Kufi (خط ريم الكوفي)', css: "'Reem Kufi', sans-serif" },
  { id: 'El Messiri', name: 'El Messiri (خط المسيري الفني)', sampleText: 'أ ب جـ د — El Messiri (خط المسيري الفني)', css: "'El Messiri', sans-serif" },
  { id: 'Lalezar', name: 'Lalezar (خط لاليزار البارز)', sampleText: 'أ ب جـ د — Lalezar (خط لاليزار البارز)', css: "'Lalezar', cursive" },
  { id: 'Marhey', name: 'Marhey (خط مرحي الانسيابي)', sampleText: 'أ ب جـ د — Marhey (خط مرحي الانسيابي)', css: "'Marhey', cursive" },
  { id: 'Rakkas', name: 'Rakkas (خط رقاص المزخرف)', sampleText: 'أ ب جـ د — Rakkas (خط رقاص المزخرف)', css: "'Rakkas', cursive" },
  { id: 'Alexandria', name: 'Alexandria (خط الإسكندرية)', sampleText: 'أ ب جـ د — Alexandria (خط الإسكندرية)', css: "'Alexandria', sans-serif" },
  { id: 'Almarai', name: 'Almarai (خط المراعي الواضح)', sampleText: 'أ ب جـ د — Almarai (خط المراعي الواضح)', css: "'Almarai', sans-serif" },
  { id: 'Readex Pro', name: 'Readex Pro (خط ريديكس برو)', sampleText: 'أ ب جـ د — Readex Pro (خط ريديكس برو)', css: "'Readex Pro', sans-serif" },
  { id: 'Noto Kufi Arabic', name: 'Noto Kufi (خط كوفي عربي)', sampleText: 'أ ب جـ د — Noto Kufi (خط كوفي عربي)', css: "'Noto Kufi Arabic', sans-serif" }
];

export const TournamentCertificateModal: React.FC<TournamentCertificateModalProps> = ({
  isOpen,
  onClose,
  sport,
  directorateName = 'المديرية الإقليمية بتاوريرت',
  directorateObj,
  tournaments = [],
  officialLogos,
  activeSeason = '2026/2027'
}) => {
  const sportName = sport.name || SPORTS_MAP[sport.id]?.name || 'البطولة الرياضية المدرسية';
  const resolvedDirName = directorateObj?.name || directorateName || 'المديرية الإقليمية';
  const cleanDirCity = resolvedDirName.replace(/^المديرية الإقليمية (ب|في )?/, '');

  // Form states
  const [championshipTitle, setChampionshipTitle] = useState(`البطولة الإقليمية المدرسية لـ ${sportName}`);
  const [headerOrganization, setHeaderOrganization] = useState(`الفرع الإقليمي للجامعة الملكية المغربية للرياضة المدرسية للمديرية الإقليمية ب${cleanDirCity}`);
  const [seasonText, setSeasonText] = useState(activeSeason);
  const [theme, setTheme] = useState<CertificateTheme>('crimson_gold');
  const [selectedFont, setSelectedFont] = useState<string>('Amiri');
  // Font sizes (in px)
  const [titleFontSize, setTitleFontSize] = useState<number>(36);
  const [recipientFontSize, setRecipientFontSize] = useState<number>(28);
  const [bodyFontSize, setBodyFontSize] = useState<number>(15);
  // Logo sizes (in px)
  const [ministryLogoSize, setMinistryLogoSize] = useState<number>(48);
  const [frmssLogoSize, setFrmssLogoSize] = useState<number>(48);

  // Certificate intro/honorific sentence (fully customizable)
  const defaultHonorific = `يتشرف رئيس الفرع الإقليمي للجامعة الملكية المغربية للرياضة المدرسية بالمديرية الإقليمية ب${cleanDirCity}`;
  const [honorificText, setHonorificText] = useState(defaultHonorific);

  // Medal rank/number (controllable)
  const [medalNumber, setMedalNumber] = useState<string>('1');
  const [showMedal, setShowMedal] = useState<boolean>(true);

  // Signatory role (controllable)
  const [signatoryRole, setSignatoryRole] = useState<string>('رئيس الفرع الإقليمي');
  const [signatorySubRole, setSignatorySubRole] = useState<string>('المدير الإقليمي');

  // Mode: Blank (فارغة للملء اليدوي) or Filled (بيانات محددة)
  const [isFormBlank, setIsFormBlank] = useState<boolean>(true);

  // Filled mode fields
  const [studentName, setStudentName] = useState('');
  const [schoolName, setSchoolName] = useState('');
  const [rankText, setRankText] = useState('الرتبة الأولى');
  const [categoryGenderText, setCategoryGenderText] = useState('');

  // Sport Visual Silhouette
  const [sportVisual, setSportVisual] = useState<string>(() => {
    if (sport.id === 'chess') return 'chess';
    if (sport.id === 'football' || sport.id === 'futsal') return 'football';
    if (sport.id === 'athletics' || sport.id === 'cross_country') return 'athletics';
    if (sport.id === 'basketball' || sport.id === 'basketball_3x3') return 'basketball';
    if (sport.id === 'handball' || sport.id === 'beach_handball') return 'handball';
    if (sport.id === 'volleyball' || sport.id === 'beach_volleyball' || sport.id === 'mixed_volleyball') return 'volleyball';
    if (sport.id === 'table_tennis') return 'table_tennis';
    return 'trophy';
  });

  const [customBgImage, setCustomBgImage] = useState<string | null>(null);
  const [customSilhouette, setCustomSilhouette] = useState<string | null>(null);
  const [silhouetteScale, setSilhouetteScale] = useState<number>(50);
  const [silhouetteOpacity, setSilhouetteOpacity] = useState<number>(40);
  const [silhouettePosition, setSilhouettePosition] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
  const silhouetteFileInputRef = useRef<HTMLInputElement>(null);

  const handleSilhouetteUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم صورة الرسم الظلي كبير، يرجى اختيار صورة أقل من 5 ميغابايت');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCustomSilhouette(reader.result as string);
        toast.success('تم رفع صورة الرسم الظلي المخصصة للشهادة بنجاح!');
      };
      reader.readAsDataURL(file);
    }
  };
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'settings'>('split');
  const [previewZoom, setPreviewZoom] = useState<number>(1);
  const [activeMobileTab, setActiveMobileTab] = useState<'controls' | 'preview'>('controls');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleAllSections = (collapse: boolean) => {
    setCollapsedSections({
      templateMode: collapse,
      studentData: collapse,
      medalRank: collapse,
      font: collapse,
      honorific: collapse,
      signatory: collapse,
      theme: collapse,
      logoSizes: collapse,
      tournamentInfo: collapse,
      sportVisual: collapse
    });
  };

  const certificateRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state if sport changes
  useEffect(() => {
    setChampionshipTitle(`البطولة الإقليمية المدرسية لـ ${sport.name || SPORTS_MAP[sport.id]?.name || 'البطولة'}`);
    if (sport.id === 'chess') setSportVisual('chess');
    else if (sport.id === 'football' || sport.id === 'futsal') setSportVisual('football');
    else if (sport.id === 'athletics' || sport.id === 'cross_country') setSportVisual('athletics');
    else if (sport.id === 'basketball' || sport.id === 'basketball_3x3') setSportVisual('basketball');
    else if (sport.id === 'handball' || sport.id === 'beach_handball') setSportVisual('handball');
    else if (sport.id === 'volleyball' || sport.id === 'beach_volleyball') setSportVisual('volleyball');
    else if (sport.id === 'table_tennis') setSportVisual('table_tennis');
    else setSportVisual('trophy');
  }, [sport]);

  if (!isOpen) return null;

  // Custom Background Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        toast.error('حجم الصورة كبير، يرجى اختيار صورة أقل من 4 ميغابايت');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setCustomBgImage(reader.result as string);
        toast.success('تم تحميل صورة الخلفية للشهادة بنجاح!');
      };
      reader.readAsDataURL(file);
    }
  };

  // Export as PNG (Pure Certificate Card Only - No Preview Canvas or Shadow)
  const handleDownloadImage = async () => {
    if (!certificateRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading('جاري توليد وتحميل الشهادة التقديرية بدقة عالية (PNG)...');
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      const dataUrl = await toPng(certificateRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        quality: 1.0,
        style: {
          transform: 'none',
          boxShadow: 'none',
          borderRadius: '0px',
          margin: '0px'
        }
      });

      const link = document.createElement('a');
      link.download = `شهادة_تقديرية-${sportName.replace(/\s+/g, '_')}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('تم تحميل الشهادة التقديرية كصورة PNG بنجاح!', { id: toastId });
    } catch (error) {
      console.error('Error exporting certificate image:', error);
      toast.error('تعذر تصدير الشهادة، يرجى المحاولة ثانية', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Export as PDF (A4 Landscape - Certificate Only)
  const handleDownloadPdf = async () => {
    if (!certificateRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading('جاري توليد وتحميل ملف PDF للشهادة التقديرية...');
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      const dataUrl = await toPng(certificateRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        quality: 1.0,
        style: {
          transform: 'none',
          boxShadow: 'none',
          borderRadius: '0px',
          margin: '0px'
        }
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Fill A4 Landscape (297mm x 210mm) completely
      pdf.addImage(dataUrl, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
      pdf.save(`شهادة_تقديرية-${sportName.replace(/\s+/g, '_')}-${Date.now()}.pdf`);

      toast.success('تم تحميل ملف PDF للشهادة بنجاح!', { id: toastId });
    } catch (error) {
      console.error('Error exporting certificate PDF:', error);
      toast.error('تعذر تصدير ملف PDF، يرجى المحاولة ثانية', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Copy to Clipboard
  const handleCopyToClipboard = async () => {
    if (!certificateRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading('جاري نسخ الشهادة إلى الحافظة...');
    try {
      const blob = await toBlob(certificateRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        quality: 1.0,
        style: {
          transform: 'none',
          boxShadow: 'none',
          borderRadius: '0px',
          margin: '0px'
        }
      });
      if (blob && navigator.clipboard && (window as any).ClipboardItem) {
        await navigator.clipboard.write([
          new (window as any).ClipboardItem({ 'image/png': blob })
        ]);
        toast.success('تم نسخ صورة الشهادة! يمكنك لصقها (Ctrl+V) مباشرة في واتساب.', { id: toastId });
      } else {
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

  // Print Certificate (A4 Landscape)
  const handlePrint = async () => {
    if (!certificateRef.current) return;
    const toastId = toast.loading('جاري تجهيز الشهادة للطباعة بجودة عالية...');
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      const dataUrl = await toPng(certificateRef.current, {
        pixelRatio: 3,
        cacheBust: true,
        quality: 1.0,
        style: {
          transform: 'none',
          boxShadow: 'none',
          borderRadius: '0px',
          margin: '0px'
        }
      });

      const printWindow = window.open('', '_blank', 'width=1100,height=800');
      if (!printWindow) {
        toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة', { id: toastId });
        return;
      }

      printWindow.document.write(`
        <!DOCTYPE html>
        <html dir="rtl" lang="ar">
          <head>
            <meta charset="utf-8" />
            <title>طباعة شهادة تقديرية - ${championshipTitle}</title>
            <style>
              @page {
                size: A4 landscape;
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
            <img src="${dataUrl}" alt="Certificate to Print" />
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
      toast.error('تعذر تحضير الشهادة للطباعة، يرجى المحاولة مرة أخرى', { id: toastId });
    }
  };

  // Themes helper
  const getThemeClasses = () => {
    switch (theme) {
      case 'orange_vibrant':
        return {
          borderOuter: 'border-orange-600',
          borderInner: 'border-amber-400',
          cornerAccents: 'text-orange-600',
          bg: 'bg-gradient-to-br from-amber-50/80 via-white to-orange-50/70',
          titleColor: 'text-orange-950',
          highlightText: 'text-orange-700',
          subHeaderColor: 'text-amber-900',
          silhouetteColor: '#ea580c',
          mapFill: '#ea580c',
          badgeFill: 'bg-orange-50 text-orange-900 border-orange-200'
        };
      case 'royal_blue':
        return {
          borderOuter: 'border-blue-700',
          borderInner: 'border-sky-400',
          cornerAccents: 'text-blue-700',
          bg: 'bg-gradient-to-br from-sky-50/80 via-white to-blue-50/70',
          titleColor: 'text-blue-950',
          highlightText: 'text-blue-700',
          subHeaderColor: 'text-blue-900',
          silhouetteColor: '#0284c7',
          mapFill: '#0369a1',
          badgeFill: 'bg-blue-50 text-blue-900 border-blue-200'
        };
      case 'morocco_emerald':
        return {
          borderOuter: 'border-emerald-700',
          borderInner: 'border-teal-400',
          cornerAccents: 'text-emerald-700',
          bg: 'bg-gradient-to-br from-emerald-50/80 via-white to-teal-50/70',
          titleColor: 'text-emerald-950',
          highlightText: 'text-emerald-700',
          subHeaderColor: 'text-emerald-900',
          silhouetteColor: '#059669',
          mapFill: '#047857',
          badgeFill: 'bg-emerald-50 text-emerald-900 border-emerald-200'
        };
      case 'clean_slate':
        return {
          borderOuter: 'border-slate-800',
          borderInner: 'border-slate-400',
          cornerAccents: 'text-slate-800',
          bg: 'bg-gradient-to-br from-slate-50/80 via-white to-slate-100/70',
          titleColor: 'text-slate-950',
          highlightText: 'text-slate-700',
          subHeaderColor: 'text-slate-900',
          silhouetteColor: '#334155',
          mapFill: '#475569',
          badgeFill: 'bg-slate-100 text-slate-900 border-slate-300'
        };
      case 'crimson_gold':
      default:
        return {
          borderOuter: 'border-red-700',
          borderInner: 'border-amber-500',
          cornerAccents: 'text-amber-600',
          bg: 'bg-gradient-to-br from-rose-50/80 via-white to-amber-50/70',
          titleColor: 'text-red-950',
          highlightText: 'text-red-700',
          subHeaderColor: 'text-red-900',
          silhouetteColor: '#dc2626',
          mapFill: '#b91c1c',
          badgeFill: 'bg-red-50 text-red-900 border-red-200'
        };
    }
  };

  const currentTheme = getThemeClasses();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Top Bar */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3.5 bg-gradient-to-r from-red-950 via-slate-900 to-red-950 text-white flex items-center justify-between border-b border-red-900 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shrink-0">
              <Award className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-base font-extrabold flex items-center gap-1.5 sm:gap-2 flex-wrap truncate">
                <span>تخصيص الشهادة التقديرية</span>
                <span className="bg-amber-500/20 text-amber-300 text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full border border-amber-500/30 truncate">
                  {sportName}
                </span>
                <span className="hidden sm:inline bg-white/10 text-white/90 text-[10px] px-2 py-0.5 rounded-md font-mono">
                  A4 أفقي (Landscape)
                </span>
              </h2>
              <p className="hidden sm:block text-[11px] text-slate-300 truncate">
                شهادة تقديرية رسمية للمشاركين بنفس خلفية ملصق البطولة، مطابقة للنموذج المعتمد بالميدالية وخريطة المملكة
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="تحميل الشهادة كصورة PNG عالية الدقة بدون إطار المعاينة"
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>تحميل PNG</span>
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isExporting}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
              title="تحميل الشهادة كملف PDF قياس A4 للمستند فقط"
            >
              <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>تحميل PDF</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isExporting}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-all cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة A4</span>
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>

        {/* Mobile Tabs Switcher - Visible only on small screens */}
        <div className="md:hidden flex border-b border-slate-200 bg-white sticky top-0 z-[60] shrink-0">
          <button
            onClick={() => setActiveMobileTab('controls')}
            className={`flex-1 py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeMobileTab === 'controls' 
                ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/30' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            تعديل البيانات والتصميم
          </button>
          <button
            onClick={() => setActiveMobileTab('preview')}
            className={`flex-1 py-3 px-2 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              activeMobileTab === 'preview' 
                ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/30' 
                : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            معاينة الشهادة
          </button>
        </div>

        {/* Modal Body: Split Layout */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-y-auto md:overflow-hidden bg-white">
          
          {/* Controls Panel */}
          <div className={`col-span-1 md:col-span-5 border-l border-slate-200 overflow-y-auto p-4 sm:p-5 space-y-4 bg-white order-1 block ${
            activeMobileTab === 'controls' ? 'block' : 'hidden md:block'
          }`}>
            
            {/* Live Synchronized Banner */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-950 font-bold gap-2">
              <span className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse shrink-0" />
                <span className="truncate">التعديلات تنعكس فورياً ومباشرة</span>
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => toggleAllSections(true)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/60 font-bold transition-colors cursor-pointer"
                  title="طي جميع الخصائص"
                >
                  طي الكل
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllSections(false)}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/60 font-bold transition-colors cursor-pointer"
                  title="إظهار جميع الخصائص"
                >
                  إظهار الكل
                </button>
              </div>
            </div>
            
            {/* Mode Selector: Blank for Handwriting vs Custom Typed */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Edit3 className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">نمط ملء الشهادة</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('templateMode')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['templateMode'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['templateMode'] ? 'rotate-180 text-amber-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['templateMode'] && (
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsFormBlank(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      isFormBlank
                        ? 'bg-amber-50 border-amber-500 text-amber-950 font-black shadow-3xs ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">✍️ فارغة للملء اليدوي</span>
                    <span className="text-[9px] text-slate-500 font-normal">خطوط منقطة لكتابة الأسماء لاحقاً</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFormBlank(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                      !isFormBlank
                        ? 'bg-amber-50 border-amber-500 text-amber-950 font-black shadow-3xs ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-sm">📝 ملء بيانات مطبوعة</span>
                    <span className="text-[9px] text-slate-500 font-normal">طباعة اسم التلميذ والرتبة مباشرة</span>
                  </button>
                </div>
              )}
            </div>

            {/* Filled Mode Specific Inputs */}
            {!isFormBlank && (
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 shadow-3xs space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-900 truncate">
                    بيانات التلميذ(ة) المكرم(ة):
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleSection('studentData')}
                    className="p-1 text-amber-700 hover:text-amber-900 hover:bg-amber-100/60 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                    title={collapsedSections['studentData'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                  >
                    <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['studentData'] ? 'rotate-180 font-bold' : ''}`} />
                  </button>
                </div>
                {!collapsedSections['studentData'] && (
                  <div className="space-y-2.5 pt-0.5">
                    <div>
                      <span className="text-[10px] font-bold text-slate-600 block mb-0.5">اسم التلميذ(ة):</span>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        placeholder="مثال: نور اليوسفي"
                        className="w-full text-xs font-bold px-2.5 py-1.5 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">الرتبة / التتويج:</span>
                        <select
                          value={rankText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRankText(val);
                            if (val.includes('الأولى')) setMedalNumber('1');
                            else if (val.includes('الثانية')) setMedalNumber('2');
                            else if (val.includes('الثالثة')) setMedalNumber('3');
                            else if (val.includes('الرابعة')) setMedalNumber('4');
                          }}
                          className="w-full text-xs font-bold px-2 py-1.5 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        >
                          <option value="الرتبة الأولى">الرتبة الأولى 🥇</option>
                          <option value="الرتبة الثانية">الرتبة الثانية 🥈</option>
                          <option value="الرتبة الثالثة">الرتبة الثالثة 🥉</option>
                          <option value="الرتبة الرابعة">الرتبة الرابعة</option>
                          <option value="مشاركة فعالة ومتميزة">مشاركة فعالة ومتميزة 🌟</option>
                        </select>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-600 block mb-0.5">الفئة / الجنس (اختياري):</span>
                        <input
                          type="text"
                          value={categoryGenderText}
                          onChange={(e) => setCategoryGenderText(e.target.value)}
                          placeholder="مثال: فئة الإناث أو صغار"
                          className="w-full text-xs px-2 py-1.5 border border-amber-300 rounded-lg bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Medal Rank & Number Control (Controllable) */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Medal className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate">الميدالية ورقم الرتبة</span>
                  <label className="flex items-center gap-1 cursor-pointer text-[11px] font-bold text-slate-600 shrink-0">
                    <input
                      type="checkbox"
                      checked={showMedal}
                      onChange={(e) => setShowMedal(e.target.checked)}
                      className="rounded accent-amber-600 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>إظهار</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSection('medalRank')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['medalRank'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['medalRank'] ? 'rotate-180 text-amber-600 font-bold' : ''}`} />
                </button>
              </div>

              {!collapsedSections['medalRank'] && showMedal && (
                <div className="space-y-2 pt-1 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-600">رقم الميدالية حسب الرتبة:</span>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={medalNumber}
                        onChange={(e) => setMedalNumber(e.target.value)}
                        placeholder="1"
                        className="w-16 text-center text-xs font-black px-2 py-1 border border-amber-400 rounded-lg bg-amber-50/60 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-1 pt-0.5">
                    {[
                      { num: '1', label: '1 🥇 ذهبية' },
                      { num: '2', label: '2 🥈 فضية' },
                      { num: '3', label: '3 🥉 برونزية' },
                      { num: '4', label: '4 🏅 رابعة' }
                    ].map((item) => (
                      <button
                        key={item.num}
                        type="button"
                        onClick={() => setMedalNumber(item.num)}
                        className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                          medalNumber === item.num
                            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Editable Font Selector - Dropdown List with Arabic Letters */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Type className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">خط الشهادة التقديرية (قائمة منسدلة)</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('font')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['font'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['font'] ? 'rotate-180 text-amber-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['font'] && (
                <div className="space-y-2 pt-0.5">
                  <select
                    value={selectedFont}
                    onChange={(e) => setSelectedFont(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden cursor-pointer shadow-3xs text-slate-800"
                  >
                    {CERTIFICATE_FONTS.map(f => (
                      <option key={f.id} value={f.id} style={{ fontFamily: f.css }}>
                        {f.sampleText}
                      </option>
                    ))}
                  </select>

                  {/* Live Font Sample */}
                  <div
                    className="p-2.5 bg-amber-50/50 rounded-xl border border-amber-200 text-center text-slate-900 text-sm font-bold transition-all shadow-3xs"
                    style={{ fontFamily: CERTIFICATE_FONTS.find(f => f.id === selectedFont)?.css || "'Amiri', serif" }}
                  >
                    أ ب جـ د هـ و ز — (معاينة الخط: {selectedFont})
                  </div>
                </div>
              )}
            </div>

            {/* Font Size Controls (التحكم في أحجام خطوط الشهادة) */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate">التحكم في أحجام خطوط الشهادة</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTitleFontSize(36);
                    setRecipientFontSize(28);
                    setBodyFontSize(15);
                  }}
                  className="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer shrink-0"
                >
                  إعادة الضبط
                </button>
              </div>

              <div className="space-y-2.5 pt-0.5">
                {/* Title Size */}
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>حجم عنوان "شهادة تقديرية":</span>
                    <span className="font-mono text-amber-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">{titleFontSize}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold">صغير</span>
                    <input
                      type="range"
                      min="20"
                      max="60"
                      step="1"
                      value={titleFontSize}
                      onChange={(e) => setTitleFontSize(Number(e.target.value))}
                      className="flex-1 accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">كبير</span>
                  </div>
                </div>

                {/* Recipient / Student Name Size */}
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>حجم اسم التلميذ / المكرم:</span>
                    <span className="font-mono text-amber-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">{recipientFontSize}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold">صغير</span>
                    <input
                      type="range"
                      min="16"
                      max="48"
                      step="1"
                      value={recipientFontSize}
                      onChange={(e) => setRecipientFontSize(Number(e.target.value))}
                      className="flex-1 accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">كبير</span>
                  </div>
                </div>

                {/* Body Text Size */}
                <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                    <span>حجم نص الديباجة والتفاصيل:</span>
                    <span className="font-mono text-amber-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">{bodyFontSize}px</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-bold">صغير</span>
                    <input
                      type="range"
                      min="10"
                      max="36"
                      step="1"
                      value={bodyFontSize}
                      onChange={(e) => setBodyFontSize(Number(e.target.value))}
                      className="flex-1 accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                    />
                    <span className="text-[10px] text-slate-400 font-bold">كبير</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Editable Honorific / Introductory text */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate">ديباجة الشهادة (نص التقديم)</span>
                  <button
                    type="button"
                    onClick={() => setHonorificText(defaultHonorific)}
                    className="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer shrink-0"
                  >
                    استعادة
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => toggleSection('honorific')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['honorific'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['honorific'] ? 'rotate-180 text-amber-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['honorific'] && (
                <div className="space-y-2.5 pt-0.5">
                  <textarea
                    rows={3}
                    value={honorificText}
                    onChange={(e) => setHonorificText(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-hidden leading-relaxed resize-none bg-amber-50/20"
                    placeholder="اكتب هنا النص الكامل لديباجة الشهادة..."
                  />
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 block">نماذج وصيغ ديباجة جاهزة (انقر للتطبيق):</span>
                    <div className="flex flex-col gap-1">
                      {[
                        `يتشرف رئيس الفرع الإقليمي للجامعة الملكية المغربية للرياضة المدرسية بالمديرية الإقليمية ب${cleanDirCity}`,
                        `تتشرف اللجنة المنظمة للبطولة الإقليمية المدرسية بالمديرية الإقليمية ب${cleanDirCity}`,
                        `يتشرف السيد المدير الإقليمي لوزارة التربية الوطنية والتعليم الأولي والرياضة ب${cleanDirCity}`,
                        `يتشرف مكتب فرع الجامعة الملكية المغربية للرياضة المدرسية ب${cleanDirCity}`,
                        `يتشرف السيد رئيس مصلحة الارتقاء بالرياضة المدرسية ب${cleanDirCity}`
                      ].map((presetText, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setHonorificText(presetText)}
                          className={`text-[10px] text-right p-1.5 rounded-lg border transition-all cursor-pointer font-medium truncate ${
                            honorificText === presetText
                              ? 'bg-amber-100 text-amber-950 border-amber-400 font-bold'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                          title={presetText}
                        >
                          {presetText}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Signatory Role Controls */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <PenTool className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">صفة الموقّع على الشهادة</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('signatory')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['signatory'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['signatory'] ? 'rotate-180 text-amber-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['signatory'] && (
                <div className="space-y-2 pt-0.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">الصفة (توقيع ...):</span>
                    <input
                      type="text"
                      value={signatoryRole}
                      onChange={(e) => setSignatoryRole(e.target.value)}
                      placeholder="مثال: رئيس الفرع الإقليمي"
                      className="w-full text-xs font-bold px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-[9px] font-bold text-slate-400">خيارات جاهزة:</span>
                    {['رئيس الفرع الإقليمي', 'المدير الإقليمي', 'رئيس مصلحة الارتقاء بالرياضة المدرسية', 'الكاتب العام'].map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => setSignatoryRole(role)}
                        className={`text-[9px] px-1.5 py-0.5 rounded border font-bold cursor-pointer transition-colors ${
                          signatoryRole === role
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">الصفة الفرعية / التفويض (اختياري):</span>
                    <input
                      type="text"
                      value={signatorySubRole}
                      onChange={(e) => setSignatorySubRole(e.target.value)}
                      placeholder="مثال: المدير الإقليمي (أو اتركه فارغاً)"
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Quick Themes - Color dots without names */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Palette className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <span className="truncate">ألوان الشهادة (نقط ألوان دائرية)</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('theme')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['theme'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['theme'] ? 'rotate-180 text-red-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['theme'] && (
                <div className="flex flex-wrap items-center gap-2.5 p-2.5 bg-slate-50/80 rounded-2xl border border-slate-200/80 justify-start">
                  {[
                    { id: 'crimson_gold', label: 'قرمزي ملكي', color: '#dc2626', ring: 'ring-red-500' },
                    { id: 'orange_vibrant', label: 'برتقالي رياضي', color: '#f97316', ring: 'ring-orange-500' },
                    { id: 'royal_blue', label: 'أزرق ملكي', color: '#2563eb', ring: 'ring-blue-500' },
                    { id: 'morocco_emerald', label: 'أخضر زمردي', color: '#10b981', ring: 'ring-emerald-500' },
                    { id: 'clean_slate', label: 'رمادي عصري', color: '#475569', ring: 'ring-slate-600' },
                  ].map(t => {
                    const isActive = theme === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTheme(t.id as CertificateTheme)}
                        className={`w-8 h-8 rounded-full transition-all transform cursor-pointer relative flex items-center justify-center shrink-0 border-2 border-white shadow-xs hover:scale-115 ${
                          isActive
                            ? `ring-3 ${t.ring} scale-110 shadow-md`
                            : 'hover:ring-2 hover:ring-slate-300'
                        }`}
                        style={{ backgroundColor: t.color }}
                        title={t.label}
                      >
                        {isActive && (
                          <span className="w-2.5 h-2.5 rounded-full bg-white shadow-xs" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Logo Sizes Controls */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-slate-800 truncate">التحكم في حجم الشعارات (الشهادة)</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMinistryLogoSize(48);
                      setFrmssLogoSize(48);
                    }}
                    className="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer shrink-0"
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
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['logoSizes'] ? 'rotate-180 text-amber-600 font-bold' : ''}`} />
                </button>
              </div>

              {!collapsedSections['logoSizes'] && (
                <div className="space-y-3 pt-0.5">
                  {/* Ministry Logo Size */}
                  <div className="space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                      <span>شعار الوزارة (الوسط):</span>
                      <span className="font-mono text-amber-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">{ministryLogoSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">صغير</span>
                      <input
                        type="range"
                        min="30"
                        max="90"
                        value={ministryLogoSize}
                        onChange={(e) => setMinistryLogoSize(Number(e.target.value))}
                        className="flex-1 accent-amber-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400">كبير</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[36, 48, 62, 78].map((sz, idx) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setMinistryLogoSize(sz)}
                          className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                            ministryLogoSize === sz ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
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
                      <span>شعار الجامعة (الجانب):</span>
                      <span className="font-mono text-red-700 bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">{frmssLogoSize}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400">صغير</span>
                      <input
                        type="range"
                        min="30"
                        max="90"
                        value={frmssLogoSize}
                        onChange={(e) => setFrmssLogoSize(Number(e.target.value))}
                        className="flex-1 accent-red-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-400">كبير</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[36, 48, 62, 78].map((sz, idx) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setFrmssLogoSize(sz)}
                          className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                            frmssLogoSize === sz ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
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

            {/* Championship Title & Directorate */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <Trophy className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="truncate">عنوان البطولة والموسم الدراسي</span>
                </label>
                <button
                  type="button"
                  onClick={() => toggleSection('tournamentInfo')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer shrink-0 ms-auto"
                  title={collapsedSections['tournamentInfo'] ? "إظهار الخاصية" : "إخفاء الخاصية"}
                >
                  <ChevronDown className={`h-4 w-4 transform transition-transform duration-200 ${collapsedSections['tournamentInfo'] ? 'rotate-180 text-amber-600 font-bold' : ''}`} />
                </button>
              </div>
              {!collapsedSections['tournamentInfo'] && (
                <div className="space-y-2.5 pt-0.5">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 block mb-0.5">عنوان البطولة:</span>
                    <input
                      type="text"
                      value={championshipTitle}
                      onChange={(e) => setChampionshipTitle(e.target.value)}
                      className="w-full text-xs font-bold px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-hidden"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5">الموسم الدراسي:</span>
                      <input
                        type="text"
                        value={seasonText}
                        onChange={(e) => setSeasonText(e.target.value)}
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-hidden font-medium"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-500 block mb-0.5">الفرع الإقليمي:</span>
                      <input
                        type="text"
                        value={cleanDirCity}
                        readOnly
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-medium"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sport Silhouette Visual */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 min-w-0">
                  <FileImage className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">الرسم التعبيري الرياضي (أسفل يمين الشهادة)</span>
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
                      onClick={() => { setSportVisual('chess'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'chess' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      ♟️ الشطرنج
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
                      onClick={() => { setSportVisual('football'); setCustomBgImage(null); }}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${
                        sportVisual === 'football' && !customBgImage ? 'bg-indigo-50 border-indigo-500 text-indigo-800' : 'border-slate-200 bg-white'
                      }`}
                    >
                      ⚽ كرة القدم
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

                  {/* Upload custom silhouette image & size control */}
                  <div className="pt-2.5 border-t border-slate-100 space-y-2.5">
                    <div className="bg-indigo-50/60 p-2.5 rounded-xl border border-indigo-100 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                          <FileImage className="h-3.5 w-3.5 text-indigo-600" />
                          <span>رفع صورة رسم ظلي مخصص للشهادة:</span>
                        </span>
                        {customSilhouette && (
                          <button
                            type="button"
                            onClick={() => setCustomSilhouette(null)}
                            className="text-[10px] text-red-600 hover:text-red-800 font-bold hover:underline flex items-center gap-0.5 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>افتراضي</span>
                          </button>
                        )}
                      </div>

                      <input
                        type="file"
                        ref={silhouetteFileInputRef}
                        onChange={handleSilhouetteUpload}
                        accept="image/*"
                        className="hidden"
                      />

                      <button
                        type="button"
                        onClick={() => silhouetteFileInputRef.current?.click()}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                          customSilhouette 
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs' 
                            : 'bg-white hover:bg-indigo-50 text-indigo-800 border-indigo-200 shadow-2xs'
                        }`}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{customSilhouette ? 'تغيير صورة الرسم الظلي المرفوعة' : 'رفع رسم ظلي للشهادة (PNG/صورة)'}</span>
                      </button>

                      {customSilhouette && (
                        <p className="text-[10px] font-medium text-emerald-700 bg-emerald-50 p-1.5 rounded-lg border border-emerald-200 text-center">
                          ✓ تم تفعيل صورة الرسم الظلي المخصصة
                        </p>
                      )}
                    </div>

                    {/* Silhouette Size / Scale Control Slider */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                        <span className="flex items-center gap-1">
                          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
                          <span>حجم الرسم الظلي بالشهادة:</span>
                        </span>
                        <span className="text-indigo-700 font-mono font-extrabold bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                          {silhouetteScale}%
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-bold">صغير</span>
                        <input
                          type="range"
                          min="20"
                          max="200"
                          step="5"
                          value={silhouetteScale}
                          onChange={(e) => setSilhouetteScale(Number(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                        />
                        <span className="text-[10px] text-slate-400 font-bold">كبير جداً</span>
                      </div>

                      <div className="grid grid-cols-4 gap-1 pt-1">
                        {[35, 50, 70, 85].map((sc, idx) => (
                          <button
                            key={sc}
                            type="button"
                            onClick={() => setSilhouetteScale(sc)}
                            className={`py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                              silhouetteScale === sc ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {idx === 0 ? 'صغير' : idx === 1 ? 'عادي' : idx === 2 ? 'كبير' : 'ضخم'}
                          </button>
                        ))}
                      </div>

                      {/* Silhouette Opacity Control */}
                      <div className="pt-2 border-t border-slate-200/80 space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span>شفافية الرسم الظلي بالشهادة:</span>
                          <span className="text-indigo-700 font-mono font-extrabold bg-white px-2 py-0.5 rounded border border-slate-200 text-[10px]">
                            {silhouetteOpacity}%
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-bold">خفيف</span>
                          <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={silhouetteOpacity}
                            onChange={(e) => setSilhouetteOpacity(Number(e.target.value))}
                            className="flex-1 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                          />
                          <span className="text-[10px] text-slate-400 font-bold">واضح</span>
                        </div>
                      </div>

                      {/* Silhouette Position Controls */}
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                          <span className="flex items-center gap-1">
                            <Move className="h-3.5 w-3.5 text-slate-500" />
                            <span>موقع الرسم الظلي:</span>
                          </span>
                          <button 
                            onClick={() => setSilhouettePosition({ x: 0, y: 0 })}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 underline"
                          >
                            توسيط
                          </button>
                        </div>
                        
                        <div className="space-y-2">
                          {/* X Position */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 font-bold w-6">أفقي:</span>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              step="1"
                              value={silhouettePosition.x}
                              onChange={(e) => setSilhouettePosition(prev => ({ ...prev, x: Number(e.target.value) }))}
                              className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <span className="text-[10px] text-slate-600 font-mono w-8 text-left">{silhouettePosition.x}%</span>
                          </div>
                          
                          {/* Y Position */}
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-slate-500 font-bold w-6">عمودي:</span>
                            <input
                              type="range"
                              min="-100"
                              max="100"
                              step="1"
                              value={silhouettePosition.y}
                              onChange={(e) => setSilhouettePosition(prev => ({ ...prev, y: Number(e.target.value) }))}
                              className="flex-1 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                            />
                            <span className="text-[10px] text-slate-600 font-mono w-8 text-left">{silhouettePosition.y}%</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Upload custom background */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
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
                        <span>رفع خلفية مخصصة للشهادة</span>
                      </button>
                      {customBgImage && (
                        <button
                          type="button"
                          onClick={() => setCustomBgImage(null)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg text-[10px] font-bold border border-red-200 cursor-pointer"
                          title="الرجوع للتصميم الأصلي"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Certificate Preview Panel */}
          <div className={`col-span-1 md:col-span-7 bg-slate-100/50 p-3 sm:p-5 flex flex-col items-center justify-start md:justify-center order-2 shrink-0 md:flex-1 md:overflow-y-auto md:overflow-x-hidden pb-6 sm:pb-8 ${
            activeMobileTab === 'preview' ? 'block' : 'hidden md:block'
          }`}>
            
            {/* Action & Zoom Bar Above Preview */}
            <div className="w-full max-w-[700px] mb-2 sm:mb-3 flex items-center justify-between gap-1.5 text-xs shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-800 text-[11px] sm:text-xs flex items-center gap-1">
                  <span>معاينة الشهادة</span>
                  {isFormBlank && (
                    <span className="hidden sm:inline bg-amber-100 text-amber-900 text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      فارغة
                    </span>
                  )}
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
                      className="px-1 py-0.5 text-[8px] sm:text-[9px] bg-slate-100 hover:bg-slate-200 rounded text-amber-800 font-bold"
                    >
                      100%
                    </button>
                  )}
                  {previewZoom !== 0.8 && (
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(0.8)}
                      className="px-1 py-0.5 text-[8px] sm:text-[9px] bg-amber-50 hover:bg-amber-100 rounded text-amber-900 font-bold"
                      title="ملاءمة الشاشة"
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
                  className="text-[10px] sm:text-[11px] font-bold text-white bg-amber-600 px-2 py-1 rounded-lg hover:bg-amber-700 flex items-center gap-1 shadow-3xs cursor-pointer disabled:opacity-50"
                  title="تحميل كصورة PNG"
                >
                  <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>PNG</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={isExporting}
                  className="text-[10px] sm:text-[11px] font-bold text-white bg-red-600 px-2 py-1 rounded-lg hover:bg-red-700 flex items-center gap-1 shadow-3xs cursor-pointer disabled:opacity-50"
                  title="تحميل كملف PDF"
                >
                  <FileText className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* Certificate Canvas Element (A4 Landscape: Aspect Ratio 1.414 : 1) */}
            <div className="w-full flex justify-center overflow-x-auto py-0.5">
              <div
                ref={certificateRef}
                id="tournament-certificate-canvas"
                className={`w-full max-w-[285px] xs:max-w-[335px] sm:max-w-[540px] md:max-w-[640px] lg:max-w-[700px] aspect-[1.414/1] rounded-2xl sm:rounded-3xl shadow-2xl border-2 sm:border-4 ${currentTheme.borderOuter} ${currentTheme.bg} p-2.5 xs:p-3 sm:p-5 md:p-6 flex flex-col justify-between relative overflow-hidden select-none transition-all duration-150`}
                style={{
                  fontFamily: (CERTIFICATE_FONTS.find(f => f.id === selectedFont)?.css || "'Amiri', serif"),
                  backgroundImage: customBgImage ? `url(${customBgImage})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  transform: previewZoom !== 1 ? `scale(${previewZoom})` : undefined,
                  transformOrigin: 'top center'
                }}
              >
              {/* Optional overlay when custom background image is used */}
              {customBgImage && (
                <div className="absolute inset-0 bg-white/88 backdrop-blur-[1px] pointer-events-none z-0" />
              )}

              {/* Background Watermark Silhouette Layer (Behind Text, above bg) */}
              <div 
                className="absolute inset-0 pointer-events-none flex items-center justify-center z-[5]"
                style={{ padding: '0px' }}
              >
                <div className="w-full h-full flex items-center justify-center max-w-full max-h-full">
                  <SportSilhouette
                    sportVisual={sportVisual}
                    color={currentTheme.silhouetteColor}
                    className="w-full h-full"
                    isCertificate={true}
                    customSilhouetteUrl={customSilhouette}
                    silhouetteScale={silhouetteScale / 100}
                    opacity={silhouetteOpacity}
                    position={silhouettePosition}
                  />
                </div>
              </div>

              {/* Inner Delicate Gold Border */}
              <div className={`absolute inset-1.5 sm:inset-3 border sm:border-2 ${currentTheme.borderInner} rounded-lg sm:rounded-xl pointer-events-none z-0`} />

              {/* Corner Ornamental Flourishes */}
              <div className="absolute top-1.5 right-1.5 sm:top-3 sm:right-3 w-3 sm:w-6 h-3 sm:h-6 border-t sm:border-t-2 border-r sm:border-r-2 border-amber-600 pointer-events-none z-0" />
              <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 w-3 sm:w-6 h-3 sm:h-6 border-t sm:border-t-2 border-l sm:border-l-2 border-amber-600 pointer-events-none z-0" />
              <div className="absolute bottom-1.5 right-1.5 sm:bottom-3 sm:right-3 w-3 sm:w-6 h-3 sm:h-6 border-b sm:border-b-2 border-r sm:border-r-2 border-amber-600 pointer-events-none z-0" />
              <div className="absolute bottom-1.5 left-1.5 sm:bottom-3 sm:left-3 w-3 sm:w-6 h-3 sm:h-6 border-b sm:border-b-2 border-l sm:border-l-2 border-amber-600 pointer-events-none z-0" />

              {/* Top-Right Hanging Ribbon & Golden/Silver/Bronze Medal (Controllable) */}
              {showMedal && (
                <div className="absolute top-0 right-4 sm:right-9 z-20 pointer-events-none flex flex-col items-center">
                  {/* Red Ribbon */}
                  <svg className="w-6 sm:w-12 h-5 sm:h-9" viewBox="0 0 50 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <polygon points="5,0 25,28 45,0 35,0 25,16 15,0" fill="#dc2626" />
                    <polygon points="10,0 25,26 40,0 35,0 25,18 15,0" fill="#b91c1c" />
                  </svg>
                  {/* Medal based on medalNumber */}
                  <div className={`w-7 h-7 xs:w-8 xs:h-8 sm:w-13 sm:h-13 -mt-1 sm:-mt-2 rounded-full border sm:border-2 shadow-md flex items-center justify-center ${
                    medalNumber === '2'
                      ? 'bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 border-slate-100'
                      : medalNumber === '3'
                        ? 'bg-gradient-to-br from-amber-600 via-amber-700 to-amber-900 border-amber-300'
                        : 'bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 border-yellow-100'
                  }`}>
                    <div className={`w-5.5 h-5.5 xs:w-6.5 xs:h-6.5 sm:w-10 sm:h-10 rounded-full border flex items-center justify-center ${
                      medalNumber === '2'
                        ? 'border-slate-500/40 bg-gradient-to-tr from-slate-300 to-slate-100'
                        : medalNumber === '3'
                          ? 'border-amber-900/40 bg-gradient-to-tr from-amber-700 to-amber-500'
                          : 'border-amber-600/40 bg-gradient-to-tr from-amber-400 to-yellow-200'
                    }`}>
                      <span className={`font-black text-[9px] xs:text-[10px] sm:text-base font-serif drop-shadow-xs ${
                        medalNumber === '3' ? 'text-white' : medalNumber === '2' ? 'text-slate-800' : 'text-amber-950'
                      }`}>
                        {medalNumber}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom-Right Moroccan Full Map Silhouette */}
              <div className="absolute bottom-0.5 right-1 sm:bottom-2 sm:right-3 w-16 sm:w-36 h-16 sm:h-36 pointer-events-none z-0 opacity-20 sm:opacity-25">
                <svg viewBox="0 0 200 200" className="w-full h-full" fill={currentTheme.mapFill} xmlns="http://www.w3.org/2000/svg">
                  <path d="M 120 10 L 150 15 L 170 30 L 165 45 L 140 55 L 130 75 L 115 95 L 90 120 L 70 145 L 50 175 L 35 190 L 30 180 L 45 150 L 55 125 L 65 100 L 80 70 L 95 40 L 110 20 Z" />
                  <polygon points="140,25 155,30 148,42 135,38" opacity="0.6" />
                </svg>
              </div>

              {/* --- 1. Top Header: Space for Medal (Right) | Ministry Logo (Center) | FRMSS Logo (Left) --- */}
              <div className="relative z-10 w-full flex items-center justify-between pb-0.5 sm:pb-1.5 border-b border-amber-300/50">
                {/* Right Space for the hanging ribbon & medal so no logo is obscured */}
                <div style={{ width: `${Math.max(Math.round(frmssLogoSize * 0.7) + 12, 44)}px` }} className="shrink-0" />

                {/* Center: Kingdom of Morocco Ministry Logo ONLY */}
                <div className="text-center flex flex-col items-center justify-center flex-1 px-1">
                  {officialLogos?.ministryLogo ? (
                    <img
                      src={officialLogos.ministryLogo}
                      alt="شعار الوزارة"
                      style={{ height: `${Math.max(ministryLogoSize, 24)}px` }}
                      className="mx-auto object-contain drop-shadow-xs transition-all"
                    />
                  ) : (
                    <svg
                      style={{
                        width: `${Math.max(Math.round(ministryLogoSize * 0.5), 20)}px`,
                        height: `${Math.max(Math.round(ministryLogoSize * 0.5), 20)}px`
                      }}
                      className="transition-all"
                      viewBox="0 0 100 100"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M40 12 L50 4 L60 12 L56 22 L44 22 Z" fill="#ca8a04" stroke="#854d0e" strokeWidth="1.5" />
                      <circle cx="50" cy="8" r="2.5" fill="#dc2626" />
                      <path d="M30 26 Q50 20 70 26 Q72 58 50 78 Q28 58 30 26 Z" fill="#dc2626" stroke="#ca8a04" strokeWidth="3" />
                      <circle cx="50" cy="46" r="14" fill="#15803d" />
                      <polygon points="50,36 53,44 62,44 55,49 57,58 50,53 43,58 45,49 38,44 47,44" fill="#fef08a" />
                    </svg>
                  )}
                </div>

                {/* Left Side: FRMSS Logo on the Left */}
                <div
                  style={{ width: `${Math.max(Math.round(frmssLogoSize * 0.7) + 12, 44)}px` }}
                  className="flex items-center justify-end shrink-0"
                >
                  {officialLogos?.frmssLogo ? (
                    <img
                      src={officialLogos.frmssLogo}
                      alt="Logo"
                      style={{ height: `${Math.max(frmssLogoSize, 24)}px` }}
                      className="object-contain drop-shadow-xs transition-all"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <AppLogo size={Math.max(Math.round(frmssLogoSize * 0.65), 20)} />
                      <span className="text-[5px] sm:text-[7px] font-black text-slate-700 tracking-tighter mt-0.5">2026 / 2027</span>
                    </div>
                  )}
                </div>
              </div>

              {/* --- 2. Title: « شــــهـــــادة تـــــقـــــديـــــريـــــة » --- */}
              <div className="relative z-10 text-center my-0.5 sm:my-1.5">
                <div className="inline-block relative">
                  <h1 
                    className={`font-black ${currentTheme.titleColor} tracking-widest leading-tight drop-shadow-xs`}
                    style={{ fontSize: `clamp(14px, calc(${titleFontSize}px * 0.75), ${titleFontSize}px)` }}
                  >
                    شــهــادة تـقـديـريـة
                  </h1>
                  <div className="w-16 sm:w-40 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mt-0.5" />
                </div>
              </div>

              {/* --- 3. Body Text --- */}
              <div className="relative z-10 my-auto text-center px-1 sm:px-8 space-y-0.5 sm:space-y-3">
                {/* Honorific Sentence */}
                <div 
                  className="font-bold text-slate-800 leading-tight sm:leading-relaxed max-w-xl mx-auto truncate"
                  style={{ fontSize: `${bodyFontSize * 0.9}px` }}
                >
                  {honorificText}
                </div>

                {/* Grant Sentence to Student */}
                <div 
                  className="font-extrabold text-slate-800 flex items-center justify-center flex-wrap gap-1 sm:gap-2 leading-tight"
                  style={{ fontSize: `${bodyFontSize * 0.9}px` }}
                >
                  <span>بمنح هذه الشهادة للتلميذ(ة):</span>
                  {isFormBlank ? (
                    <span className="inline-block min-w-[90px] xs:min-w-[120px] sm:min-w-[280px] border-b sm:border-b-2 border-dotted border-slate-700 text-transparent select-none">
                      ..................................................................
                    </span>
                  ) : (
                    <span 
                      className="font-black text-amber-950 font-serif border-b border-amber-900/40 px-1 sm:px-3 bg-white/60 rounded"
                      style={{ fontSize: `clamp(10px, calc(${recipientFontSize}px * 0.75), ${recipientFontSize}px)` }}
                    >
                      {studentName || '................................................'}
                    </span>
                  )}
                </div>

                {/* Appreciation & Rank */}
                <div 
                  className="font-bold text-slate-800 flex items-center justify-center flex-wrap gap-1 sm:gap-2 leading-tight"
                  style={{ fontSize: `${bodyFontSize * 0.85}px` }}
                >
                  <span>تقديراً لمشاركتها الفعالة وفوزها بالرتبة:</span>
                  {isFormBlank ? (
                    <span className="inline-block min-w-[60px] xs:min-w-[80px] sm:min-w-[160px] border-b sm:border-b-2 border-dotted border-red-700 text-transparent select-none">
                      ............................
                    </span>
                  ) : (
                    <span className={`font-black text-[8px] xs:text-[9.5px] sm:text-base ${currentTheme.highlightText}`}>
                      {rankText}
                    </span>
                  )}
                </div>

                {/* Championship Name & Category */}
                <div 
                  className="font-bold text-slate-800 flex items-center justify-center flex-wrap gap-0.5 sm:gap-1.5 leading-tight"
                  style={{ fontSize: `${bodyFontSize * 0.85}px` }}
                >
                  <span>في</span>
                  <span 
                    className="font-black text-slate-900 bg-white/70 px-1 sm:px-2 py-0.5 rounded-md border border-slate-200/80 truncate max-w-[140px] sm:max-w-none"
                    style={{ fontSize: `${bodyFontSize * 0.8}px` }}
                  >
                    {championshipTitle}
                  </span>
                  <span>فئة:</span>
                  {isFormBlank ? (
                    <span className="inline-block min-w-[40px] xs:min-w-[60px] sm:min-w-[120px] border-b sm:border-b-2 border-dotted border-red-700 text-transparent select-none">
                      ....................
                    </span>
                  ) : (
                    <span 
                      className={`font-bold ${currentTheme.highlightText}`}
                      style={{ fontSize: `${bodyFontSize * 0.85}px` }}
                    >
                      {categoryGenderText || '....................'}
                    </span>
                  )}
                </div>

                {/* Academic Season */}
                <div 
                  className="font-bold text-slate-600"
                  style={{ fontSize: `${bodyFontSize * 0.8}px` }}
                >
                  <span>خلال الموسم الدراسي: </span>
                  <span className="font-extrabold text-slate-800 font-mono">{seasonText}</span>
                </div>
              </div>

              {/* --- 4. Bottom Row: Sport Visual (Left) | Signature & Stamp (Center) | Map Corner (Right) --- */}
              <div className="relative z-10 w-full flex items-end justify-between pt-0.5 sm:pt-1">
                
                {/* Bottom-Left: Sport Visual Graphics */}
                <div className="w-14 sm:w-32 h-8 sm:h-20 flex items-center justify-start overflow-hidden">
                  {/* Note: Silhouette was moved to background layer z-[5] for better readability */}
                </div>

                {/* Center: Official Signature Box */}
                <div className="text-center flex flex-col items-center min-w-[100px] sm:min-w-[150px]">
                  <div 
                    className="font-extrabold text-slate-800"
                    style={{ fontSize: `${bodyFontSize * 0.8}px` }}
                  >
                    توقيع {signatoryRole}
                  </div>
                  {signatorySubRole && (
                    <div 
                      className="font-bold text-slate-600 mb-0.5"
                      style={{ fontSize: `${bodyFontSize * 0.7}px` }}
                    >
                      {signatorySubRole}
                    </div>
                  )}
                  <div className="h-4 sm:h-11 w-16 sm:w-36 border-b border-dashed border-slate-300/80 mx-auto mt-0.5" />
                </div>

                {/* Right Placeholder for symmetry with Map */}
                <div className="w-14 sm:w-32 text-left">
                </div>
              </div>

            </div>
          </div>

          </div>

        </div>

        {/* Modal Bottom Sticky Footer */}
        <div className="px-3 sm:px-5 py-2.5 sm:py-3 bg-slate-100 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 shrink-0">
          <div className="hidden sm:block text-xs text-slate-600 font-medium">
            💡 <span className="font-bold">نصيحة:</span> اضغط على <span className="font-bold text-amber-700">"تحميل كصورة"</span> لحفظ الشهادة أو طباعتها مباشرة بحجم A4 أفقي.
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
              disabled={isExporting}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 sm:gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>طباعة A4</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadImage}
              disabled={isExporting}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1 sm:gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] sm:text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
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
