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
  PenTool,
  FileText,
  Type
} from 'lucide-react';
import { toPng, toBlob } from 'html-to-image';
import toast from 'react-hot-toast';
import { AppLogo } from './AppLogo';
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
  { id: 'Amiri', name: 'خط أميري (Amiri) - كلاسيكي أصيل ورسمي', css: "'Amiri', serif" },
  { id: 'Cairo', name: 'خط القاهرة (Cairo) - حديث وواضح', css: "'Cairo', sans-serif" },
  { id: 'Tajawal', name: 'خط تجوال (Tajawal) - عصري وأنيق', css: "'Tajawal', sans-serif" },
  { id: 'Aref Ruqaa', name: 'خط الرقعة (Aref Ruqaa) - تراثي فخري', css: "'Aref Ruqaa', serif" },
  { id: 'Noto Kufi Arabic', name: 'خط كوفي عربي (Noto Kufi) - هندسي ورسمي', css: "'Noto Kufi Arabic', sans-serif" },
  { id: 'Changa', name: 'خط تشانغا (Changa) - بارز وقوي', css: "'Changa', sans-serif" },
  { id: 'Readex Pro', name: 'خط ريديكس برو (Readex Pro) - دقيق ومتناسق', css: "'Readex Pro', sans-serif" },
  { id: 'Lateef', name: 'خط لطيف (Lateef) - نسخي رشيق', css: "'Lateef', serif" },
  { id: 'Scheherazade New', name: 'خط شهرزاد (Scheherazade) - عريق', css: "'Scheherazade New', serif" }
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
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'split' | 'preview' | 'settings'>('split');
  const [previewZoom, setPreviewZoom] = useState<number>(1);
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

  // Export as PNG
  const handleDownloadImage = async () => {
    if (!certificateRef.current) return;
    setIsExporting(true);
    const toastId = toast.loading('جاري توليد وتحميل الشهادة التقديرية بدقة عالية...');
    try {
      await new Promise(resolve => setTimeout(resolve, 150));
      const dataUrl = await toPng(certificateRef.current, {
        pixelRatio: 2.5,
        cacheBust: true,
        quality: 0.98
      });

      const link = document.createElement('a');
      link.download = `شهادة_تقديرية-${sportName.replace(/\s+/g, '_')}-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();

      toast.success('تم تحميل الشهادة التقديرية بنجاح!', { id: toastId });
    } catch (error) {
      console.error('Error exporting certificate image:', error);
      toast.error('تعذر تصدير الشهادة، يرجى المحاولة ثانية', { id: toastId });
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
      const blob = await toBlob(certificateRef.current, { pixelRatio: 2, cacheBust: true });
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
  const handlePrint = () => {
    if (!certificateRef.current) return;
    const printContent = certificateRef.current.outerHTML;
    const printWindow = window.open('', '_blank', 'width=1100,height=800');
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }

    const fontDef = CERTIFICATE_FONTS.find(f => f.id === selectedFont) || CERTIFICATE_FONTS[0];

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>شهادة تقديرية - ${championshipTitle}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400;1,700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;500;600;700;800;900&family=Changa:wght@400;500;600;700;800&family=Lateef:wght@400;700&family=Noto+Kufi+Arabic:wght@400;500;600;700;800;900&family=Readex+Pro:wght@400;500;600;700&family=Scheherazade+New:wght@400;700&family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
          <style>
            @page {
              size: A4 landscape;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              font-family: ${fontDef.css}, 'Amiri', 'Cairo', sans-serif;
              background: #fff;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
            }
            .cert-box {
              width: 100vw;
              height: 100vh;
              box-sizing: border-box;
            }
          </style>
        </head>
        <body>
          <div class="cert-box">
            ${printContent}
          </div>
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
            >
              <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">تحميل كصورة</span>
              <span className="sm:hidden">تحميل</span>
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

        {/* View Mode Selector (Unified / Full Preview / Settings Only) */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/90 px-3 py-1.5 gap-2 shrink-0">
          <div className="flex items-center gap-1 bg-slate-200/80 p-0.5 rounded-xl border border-slate-300/70 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'split'
                  ? 'bg-white text-amber-800 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5 text-amber-600" />
              <span>⚡ تعديل ومعاينة معاً (مدمج)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'preview'
                  ? 'bg-white text-amber-800 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👁️ معاينة الشهادة (A4)</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('settings')}
              className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'settings'
                  ? 'bg-white text-amber-800 shadow-xs border border-slate-200/80 font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-700" />
              <span>⚙️ لوحة التعديل فقط</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-3xs">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>ورقة A4 أفقي (297 × 210 مم)</span>
          </div>
        </div>

        {/* Modal Body: Split or Single Layout */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto lg:overflow-hidden">
          
          {/* Controls Panel */}
          <div className={`border-l border-slate-200 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/70 order-2 lg:order-1 ${
            viewMode === 'settings'
              ? 'col-span-1 lg:col-span-12 block'
              : viewMode === 'split'
              ? 'col-span-1 lg:col-span-5 block'
              : 'hidden'
          }`}>
            
            {/* Live Synchronized Banner */}
            <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-950 font-bold">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-600" />
                <span>التعديلات تنعكس فورياً ومباشرة على الشهادة A4</span>
              </span>
              {viewMode === 'split' && (
                <button
                  type="button"
                  onClick={() => setViewMode('preview')}
                  className="text-amber-700 underline text-[11px] hover:text-amber-900 cursor-pointer"
                >
                  معاينة بحجم كامل
                </button>
              )}
            </div>
            
            {/* Mode Selector: Blank for Handwriting vs Custom Typed */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Edit3 className="h-3.5 w-3.5 text-amber-600" />
                <span>نمط ملء الشهادة</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
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
            </div>

            {/* Filled Mode Specific Inputs */}
            {!isFormBlank && (
              <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200 shadow-3xs space-y-2.5 animate-in fade-in duration-200">
                <div className="text-[11px] font-bold text-amber-900 flex items-center gap-1">
                  <span>بيانات التلميذ(ة) المكرم(ة):</span>
                </div>
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

            {/* Medal Rank & Number Control (Controllable) */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Medal className="h-3.5 w-3.5 text-amber-600" />
                  <span>الميدالية ورقم الرتبة</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={showMedal}
                    onChange={(e) => setShowMedal(e.target.checked)}
                    className="rounded accent-amber-600 h-3.5 w-3.5 cursor-pointer"
                  />
                  <span>إظهار الميدالية</span>
                </label>
              </div>

              {showMedal && (
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

            {/* Editable Font Selector */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Type className="h-3.5 w-3.5 text-amber-600" />
                <span>نوع خط الشهادة التقديرية (Font)</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {CERTIFICATE_FONTS.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFont(f.id)}
                    className={`p-2 rounded-xl text-xs border transition-all cursor-pointer text-center flex flex-col items-center justify-center ${
                      selectedFont === f.id
                        ? 'bg-amber-50 text-amber-950 border-amber-500 ring-2 ring-amber-500/20 shadow-3xs font-black'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 font-medium'
                    }`}
                    style={{ fontFamily: f.css }}
                  >
                    <span className="text-sm font-bold">أ ب جـ</span>
                    <span className="text-[10px] text-slate-600 truncate max-w-full">{f.id}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Editable Honorific / Introductory text */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-amber-600" />
                  <span>ديباجة الشهادة (نص التقديم كاملاً قابل للتعديل)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setHonorificText(defaultHonorific)}
                  className="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer"
                >
                  استعادة الافتراضي
                </button>
              </div>
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

            {/* Signatory Role Controls */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <PenTool className="h-3.5 w-3.5 text-amber-600" />
                <span>صفة الموقّع على الشهادة</span>
              </label>
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

            {/* Quick Themes */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Palette className="h-3.5 w-3.5 text-red-600" />
                <span>السمة اللونية والخلفية</span>
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                <button
                  type="button"
                  onClick={() => setTheme('crimson_gold')}
                  className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${
                    theme === 'crimson_gold' ? 'ring-2 ring-red-500 border-red-500 bg-red-50 text-red-950 font-black' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  title="قرمزي ذهبي (مثل النموذج المرفق)"
                >
                  🔴 قرمزي
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('orange_vibrant')}
                  className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${
                    theme === 'orange_vibrant' ? 'ring-2 ring-orange-500 border-orange-500 bg-orange-50 text-orange-950 font-black' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  title="برتقالي رياضي"
                >
                  🟠 برتقالي
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('royal_blue')}
                  className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${
                    theme === 'royal_blue' ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 text-blue-950 font-black' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  title="أزرق ملكي"
                >
                  🔵 أزرق
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('morocco_emerald')}
                  className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${
                    theme === 'morocco_emerald' ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50 text-emerald-950 font-black' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  title="أخضر مغربي"
                >
                  🟢 أخضر
                </button>
                <button
                  type="button"
                  onClick={() => setTheme('clean_slate')}
                  className={`h-9 rounded-xl flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${
                    theme === 'clean_slate' ? 'ring-2 ring-slate-600 border-slate-600 bg-slate-100 text-slate-950 font-black' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                  title="رمادي أنيق"
                >
                  ⚪ رمادي
                </button>
              </div>
            </div>

            {/* Logo Sizes Controls */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-amber-600" />
                  <span>التحكم في حجم الشعارات (الشهادة)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMinistryLogoSize(48);
                    setFrmssLogoSize(48);
                  }}
                  className="text-[10px] text-amber-700 hover:underline font-bold cursor-pointer"
                >
                  إعادة ضبط (48px)
                </button>
              </div>

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

            {/* Championship Title & Directorate */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-amber-600" />
                <span>عنوان البطولة والموسم الدراسي</span>
              </label>
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

            {/* Sport Silhouette Visual */}
            <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-3xs space-y-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <FileImage className="h-3.5 w-3.5 text-indigo-600" />
                <span>الرسم التعبيري الرياضي (أسفل يمين الشهادة)</span>
              </label>
              
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

          {/* Certificate Preview Panel */}
          <div className={`bg-slate-200/90 p-2 sm:p-5 overflow-y-auto overflow-x-hidden flex flex-col items-center justify-start lg:justify-center order-1 lg:order-2 flex-1 pb-24 sm:pb-8 ${
            viewMode === 'preview'
              ? 'col-span-1 lg:col-span-12 flex'
              : viewMode === 'split'
              ? 'col-span-1 lg:col-span-7 flex'
              : 'hidden'
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
                  className="text-[10px] sm:text-[11px] font-bold text-white bg-amber-600 px-2.5 py-1 rounded-lg hover:bg-amber-700 flex items-center gap-1 shadow-3xs cursor-pointer disabled:opacity-50"
                >
                  <Download className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  <span>PNG</span>
                </button>
              </div>
            </div>

            {/* Certificate Canvas Element (A4 Landscape: Aspect Ratio 1.414 : 1) */}
            <div className="w-full flex justify-center overflow-x-auto py-0.5">
              <div
                ref={certificateRef}
                id="tournament-certificate-canvas"
                className={`w-full max-w-[310px] xs:max-w-[350px] sm:max-w-[540px] md:max-w-[640px] lg:max-w-[700px] aspect-[1.414/1] rounded-xl sm:rounded-3xl shadow-2xl border-2 sm:border-4 ${currentTheme.borderOuter} ${currentTheme.bg} p-2 xs:p-2.5 sm:p-5 md:p-6 flex flex-col justify-between relative overflow-hidden select-none transition-transform`}
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
                      className="mx-auto object-contain drop-shadow-xs transition-all max-h-6 sm:max-h-12"
                    />
                  ) : (
                    <svg
                      style={{
                        width: `${Math.round(ministryLogoSize * 0.5)}px`,
                        height: `${Math.round(ministryLogoSize * 0.5)}px`
                      }}
                      className="transition-all max-w-[24px] sm:max-w-[42px]"
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
                      alt="FRMSS"
                      style={{ height: `${Math.max(frmssLogoSize, 24)}px` }}
                      className="object-contain drop-shadow-xs transition-all max-h-6 sm:max-h-12"
                    />
                  ) : (
                    <div className="flex flex-col items-center">
                      <AppLogo size={Math.max(Math.round(frmssLogoSize * 0.65), 20)} />
                      <span className="text-[5px] sm:text-[7px] font-black text-slate-700 tracking-tighter mt-0.5">FRMSS</span>
                    </div>
                  )}
                </div>
              </div>

              {/* --- 2. Title: « شــــهـــــادة تـــــقـــــديـــــريـــــة » --- */}
              <div className="relative z-10 text-center my-0.5 sm:my-1.5">
                <div className="inline-block relative">
                  <h1 className={`text-sm xs:text-base sm:text-3xl font-black ${currentTheme.titleColor} tracking-widest leading-tight font-serif drop-shadow-xs`}>
                    شــهــادة تـقـديـريـة
                  </h1>
                  <div className="w-16 sm:w-40 h-0.5 bg-gradient-to-r from-transparent via-amber-500 to-transparent mx-auto mt-0.5" />
                </div>
              </div>

              {/* --- 3. Body Text --- */}
              <div className="relative z-10 my-auto text-center px-1 sm:px-8 space-y-0.5 sm:space-y-3">
                {/* Honorific Sentence */}
                <div className="text-[7.5px] xs:text-[8.5px] sm:text-sm font-bold text-slate-800 leading-tight sm:leading-relaxed max-w-xl mx-auto truncate">
                  {honorificText}
                </div>

                {/* Grant Sentence to Student */}
                <div className="text-[8px] xs:text-[9.5px] sm:text-base font-extrabold text-slate-800 flex items-center justify-center flex-wrap gap-1 sm:gap-2 leading-tight">
                  <span>بمنح هذه الشهادة للتلميذ(ة):</span>
                  {isFormBlank ? (
                    <span className="inline-block min-w-[90px] xs:min-w-[120px] sm:min-w-[280px] border-b sm:border-b-2 border-dotted border-slate-700 text-transparent select-none">
                      ..................................................................
                    </span>
                  ) : (
                    <span className="font-black text-amber-950 font-serif text-[8.5px] xs:text-[10px] sm:text-lg border-b border-amber-900/40 px-1 sm:px-3 bg-white/60 rounded">
                      {studentName || '................................................'}
                    </span>
                  )}
                </div>

                {/* Appreciation & Rank */}
                <div className="text-[7.5px] xs:text-[9px] sm:text-sm font-bold text-slate-800 flex items-center justify-center flex-wrap gap-1 sm:gap-2 leading-tight">
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
                <div className="text-[7.5px] xs:text-[8.5px] sm:text-sm font-bold text-slate-800 flex items-center justify-center flex-wrap gap-0.5 sm:gap-1.5 leading-tight">
                  <span>في</span>
                  <span className="font-black text-slate-900 bg-white/70 px-1 sm:px-2 py-0.5 rounded-md border border-slate-200/80 text-[7px] xs:text-[8px] sm:text-xs truncate max-w-[140px] sm:max-w-none">
                    {championshipTitle}
                  </span>
                  <span>فئة:</span>
                  {isFormBlank ? (
                    <span className="inline-block min-w-[40px] xs:min-w-[60px] sm:min-w-[120px] border-b sm:border-b-2 border-dotted border-red-700 text-transparent select-none">
                      ....................
                    </span>
                  ) : (
                    <span className={`font-bold ${currentTheme.highlightText} text-[7.5px] xs:text-[8.5px] sm:text-sm`}>
                      {categoryGenderText || '....................'}
                    </span>
                  )}
                </div>

                {/* Academic Season */}
                <div className="text-[7px] xs:text-[8px] sm:text-xs font-bold text-slate-600">
                  <span>خلال الموسم الدراسي: </span>
                  <span className="font-extrabold text-slate-800 font-mono">{seasonText}</span>
                </div>
              </div>

              {/* --- 4. Bottom Row: Sport Visual (Left) | Signature & Stamp (Center) | Map Corner (Right) --- */}
              <div className="relative z-10 w-full flex items-end justify-between pt-0.5 sm:pt-1">
                
                {/* Bottom-Left: Sport Visual Graphics */}
                <div className="w-14 sm:w-32 h-8 sm:h-20 flex items-center justify-start">
                  {sportVisual === 'chess' ? (
                    <div className="flex items-center">
                      <svg viewBox="0 0 100 80" className="w-10 sm:w-20 h-8 sm:h-16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <polygon points="10,65 50,50 90,65 50,78" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
                        <polygon points="10,65 30,57 50,65 30,72" fill="#b91c1c" opacity="0.8" />
                        <polygon points="50,65 70,57 90,65 70,72" fill="#b91c1c" opacity="0.8" />
                        
                        <path d="M45,22 Q50,15 55,22 L53,35 L47,35 Z" fill="#ca8a04" stroke="#854d0e" strokeWidth="1" />
                        <path d="M42,35 Q50,32 58,35 L56,56 Q50,58 44,56 Z" fill="#eab308" stroke="#a16207" strokeWidth="1" />
                        <rect x="40" y="56" width="20" height="4" rx="1" fill="#ca8a04" />
                        <circle cx="50" cy="16" r="3.5" fill="#facc15" stroke="#a16207" />
                        <line x1="50" y1="9" x2="50" y2="15" stroke="#a16207" strokeWidth="1.5" />
                        <line x1="47" y1="12" x2="53" y2="12" stroke="#a16207" strokeWidth="1.5" />
                      </svg>
                    </div>
                  ) : sportVisual === 'athletics' ? (
                    <svg viewBox="0 0 100 60" className="w-10 sm:w-20 h-7 sm:h-14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g fill={currentTheme.silhouetteColor}>
                        <circle cx="50" cy="15" r="4" />
                        <path d="M50 20 L47 32 L40 48 M50 20 L54 34 L62 50" stroke={currentTheme.silhouetteColor} strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M50 22 L40 14 M50 22 L60 14" stroke={currentTheme.silhouetteColor} strokeWidth="2.5" strokeLinecap="round" />
                        <path d="M30 26 Q50 32 70 26" stroke="#ef4444" strokeWidth="2" />
                      </g>
                    </svg>
                  ) : sportVisual === 'football' ? (
                    <svg viewBox="0 0 100 60" className="w-10 sm:w-20 h-7 sm:h-14" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <g fill={currentTheme.silhouetteColor}>
                        <circle cx="40" cy="15" r="4" />
                        <path d="M40 20 L35 32 L25 48 M40 20 L52 30 L65 32" stroke={currentTheme.silhouetteColor} strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="75" cy="30" r="5" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
                      </g>
                    </svg>
                  ) : (
                    <div className="flex items-center text-amber-500">
                      <Trophy className="h-5 w-5 sm:h-9 sm:w-9 text-amber-500" />
                    </div>
                  )}
                </div>

                {/* Center: Official Signature Box */}
                <div className="text-center flex flex-col items-center min-w-[100px] sm:min-w-[150px]">
                  <div className="text-[7.5px] xs:text-[8.5px] sm:text-[11px] font-extrabold text-slate-800">
                    توقيع {signatoryRole}
                  </div>
                  {signatorySubRole && (
                    <div className="text-[6.5px] xs:text-[7.5px] sm:text-[9px] font-bold text-slate-600 mb-0.5">
                      {signatorySubRole}
                    </div>
                  )}
                  <div className="h-4 sm:h-11 w-16 sm:w-36 border-b border-dashed border-slate-300/80 mx-auto mt-0.5" />
                </div>

                {/* Right Placeholder for symmetry with Map */}
                <div className="w-14 sm:w-32 text-left">
                  <span className="text-[6px] sm:text-[8px] text-slate-400 block font-mono">FRMSS • {activeSeason}</span>
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
