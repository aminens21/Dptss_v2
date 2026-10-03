import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Printer,
  Download,
  Search,
  Filter,
  Check,
  Award,
  Users,
  Eye,
  SlidersHorizontal,
  Type,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Sparkles,
  QrCode as QrCodeIcon,
  MapPin,
  Building,
  GraduationCap,
  ShieldCheck,
  Palette,
  FileImage,
  Layers,
  Scissors
} from 'lucide-react';
import { toPng, toJpeg } from 'html-to-image';
import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { User, School, Directorate } from '../types';
import { DataService, OfficialLogos } from '../lib/dataService';

export interface TeacherBadgesModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: User[];
  schools: School[];
  directorateObj?: Directorate | null;
  officialLogos?: OfficialLogos;
  activeSeason?: string;
  preselectedTeacherId?: string;
}

export type BadgeTheme = 'royal_emerald' | 'crimson_gold' | 'royal_navy' | 'imperial_dark' | 'clean_white';

export const BADGE_FONTS = [
  { id: 'Cairo', name: 'Cairo (خط القاهرة العصري)', css: "'Cairo', sans-serif" },
  { id: 'Amiri', name: 'Amiri (خط أميري الأصيل)', css: "'Amiri', serif" },
  { id: 'Tajawal', name: 'Tajawal (خط تجوال الأنيق)', css: "'Tajawal', sans-serif" },
  { id: 'Almarai', name: 'Almarai (خط المراعي الواضح)', css: "'Almarai', sans-serif" },
  { id: 'Readex Pro', name: 'Readex Pro (خط ريديكس برو)', css: "'Readex Pro', sans-serif" },
  { id: 'Alexandria', name: 'Alexandria (خط الإسكندرية)', css: "'Alexandria', sans-serif" },
  { id: 'El Messiri', name: 'El Messiri (خط المسيري الفني)', css: "'El Messiri', sans-serif" },
  { id: 'Changa', name: 'Changa (خط تشانغا الرياضي)', css: "'Changa', sans-serif" }
];

export const TeacherBadgesModal: React.FC<TeacherBadgesModalProps> = ({
  isOpen,
  onClose,
  teachers = [],
  schools = [],
  directorateObj,
  officialLogos,
  activeSeason = '2026/2027',
  preselectedTeacherId
}) => {
  const dirName = directorateObj?.name || 'المديرية الإقليمية بتاوريرت';
  const cleanDirCity = dirName.replace(/^المديرية الإقليمية (ب|في )?/, '');

  // Active Tab in Modal: 'customizer' | 'preview' | 'selection'
  const [activeTab, setActiveTab] = useState<'preview' | 'customizer' | 'selection'>('preview');

  // Teacher Selection States
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<Set<string>>(() => {
    if (preselectedTeacherId) return new Set([preselectedTeacherId]);
    return new Set(teachers.map(t => t.id));
  });

  const [cycleFilter, setCycleFilter] = useState<'ALL' | 'PRIMARY' | 'MIDDLE' | 'HIGH'>('ALL');
  const [schoolFilter, setSchoolFilter] = useState<string>('ALL');
  const [teacherSearch, setTeacherSearch] = useState<string>('');

  // Badge Content & Title Customization
  const [badgeMainTitle, setBadgeMainTitle] = useState('بطاقة اعتماد أستاذ(ة) التربية البدنية');
  const [badgeSubTitle, setBadgeSubTitle] = useState('مؤطر ومسؤول الأنشطة والفرق المدرسية');
  const [organizationHeader, setOrganizationHeader] = useState(`الفرع الإقليمي للجامعة الملكية للرياضة المدرسية ب${cleanDirCity}`);
  const [seasonText, setSeasonText] = useState(activeSeason);
  const [theme, setTheme] = useState<BadgeTheme>('royal_emerald');
  const [selectedFont, setSelectedFont] = useState<string>('Cairo');

  // Badge Elements Visibility Toggles
  const [showQrCode, setShowQrCode] = useState(true);
  const [qrCodeType, setQrCodeType] = useState<'SOM_ONLY' | 'SOM_FORMATTED' | 'SOM_FULL'>('SOM_ONLY');
  const [showPhoto, setShowPhoto] = useState(true);
  const [showSom, setShowSom] = useState(true);
  const [showCycleBadge, setShowCycleBadge] = useState(true);
  const [showCutLines, setShowCutLines] = useState(true);
  const [showStampArea, setShowStampArea] = useState(true);
  const [showMinistryLogo, setShowMinistryLogo] = useState(true);
  const [showFrmssLogo, setShowFrmssLogo] = useState(true);

  // Font Sizes (pt / px)
  const [headerFontSize, setHeaderFontSize] = useState<number>(7.5);
  const [titleFontSize, setTitleFontSize] = useState<number>(9.5);
  const [nameFontSize, setNameFontSize] = useState<number>(12);
  const [detailsFontSize, setDetailsFontSize] = useState<number>(8.5);
  const [footerFontSize, setFooterFontSize] = useState<number>(7);

  // Page Margins & Layout Dimensions (in mm)
  // Standard A4 is 210mm x 297mm. 8 badges = 2 columns x 4 rows
  const [pageMarginTop, setPageMarginTop] = useState<number>(6);
  const [pageMarginBottom, setPageMarginBottom] = useState<number>(6);
  const [pageMarginX, setPageMarginX] = useState<number>(6);
  const [gapX, setGapX] = useState<number>(5);
  const [gapY, setGapY] = useState<number>(4);
  const [badgeWidthMm, setBadgeWidthMm] = useState<number>(95);
  const [badgeHeightMm, setBadgeHeightMm] = useState<number>(66);
  const [badgeBorderRadius, setBadgeBorderRadius] = useState<number>(3);

  // Preview & Pagination State
  const [previewZoom, setPreviewZoom] = useState<number>(100);
  const [currentPreviewPage, setCurrentPreviewPage] = useState<number>(1);
  const [isExporting, setIsExporting] = useState(false);

  // Generated QR codes cache (TeacherId -> DataURL)
  const [qrCodeUrls, setQrCodeUrls] = useState<Record<string, string>>({});

  // Print sheets container ref
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Reset selected teachers when preselectedTeacherId changes
  useEffect(() => {
    if (preselectedTeacherId) {
      setSelectedTeacherIds(new Set([preselectedTeacherId]));
    } else if (teachers.length > 0 && selectedTeacherIds.size === 0) {
      setSelectedTeacherIds(new Set(teachers.map(t => t.id)));
    }
  }, [preselectedTeacherId, teachers]);

  // Generate QR code data URLs for teachers based on their SOM / leaseNumber
  useEffect(() => {
    let isMounted = true;
    const generateQrs = async () => {
      const qrs: Record<string, string> = {};
      for (const t of teachers) {
        const somVal = (t.leaseNumber || '').trim();
        let payload = '';

        if (qrCodeType === 'SOM_ONLY') {
          // Pure SOM lease number for fast scanning and lookup
          payload = somVal || t.id || 'SOM_PENDING';
        } else if (qrCodeType === 'SOM_FORMATTED') {
          payload = `SOM:${somVal || 'N/A'}|${t.fullName}|${t.workLocation || ''}|${cleanDirCity}`;
        } else {
          payload = `رقم التأجير SOM: ${somVal || 'N/A'}\nالأستاذ(ة): ${t.fullName}\nالمؤسسة: ${t.workLocation || 'غير محددة'}\nالمديرية: ${cleanDirCity}\nالموسم: ${seasonText}`;
        }

        try {
          const url = await QRCode.toDataURL(payload, {
            width: 130,
            margin: 1,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          });
          qrs[t.id] = url;
        } catch (e) {
          // ignore error
        }
      }
      if (isMounted) {
        setQrCodeUrls(qrs);
      }
    };

    if (teachers.length > 0) {
      generateQrs();
    }
    return () => {
      isMounted = false;
    };
  }, [teachers, qrCodeType, cleanDirCity, seasonText]);

  // Filtered teachers list based on selection panel filters
  const filteredTeacherList = useMemo(() => {
    return teachers.filter(t => {
      // Cycle Filter
      if (cycleFilter !== 'ALL') {
        const c = String(t.teachingCadre || '').toUpperCase();
        if (cycleFilter === 'PRIMARY' && !c.includes('PRIMARY') && !c.includes('ابتدائي')) return false;
        if (cycleFilter === 'MIDDLE' && !c.includes('MIDDLE') && !c.includes('إعدادي')) return false;
        if (cycleFilter === 'HIGH' && !c.includes('HIGH') && !c.includes('تأهيلي')) return false;
      }

      // School Filter
      if (schoolFilter !== 'ALL') {
        if (t.schoolId !== schoolFilter && t.workLocation !== schoolFilter) return false;
      }

      // Search
      if (teacherSearch.trim()) {
        const q = teacherSearch.toLowerCase();
        const mName = (t.fullName || '').toLowerCase().includes(q);
        const mSchool = (t.workLocation || '').toLowerCase().includes(q);
        const mSom = (t.leaseNumber || '').toLowerCase().includes(q);
        const mPhone = (t.phone || '').includes(q);
        if (!mName && !mSchool && !mSom && !mPhone) return false;
      }

      return true;
    });
  }, [teachers, cycleFilter, schoolFilter, teacherSearch]);

  // Selected teachers array in deterministic order
  const activeSelectedTeachers = useMemo(() => {
    return teachers.filter(t => selectedTeacherIds.has(t.id));
  }, [teachers, selectedTeacherIds]);

  // Badges chunked by 8 (8 badges per A4 sheet)
  const BADGES_PER_PAGE = 8;
  const paginatedSheets = useMemo(() => {
    const sheets: User[][] = [];
    for (let i = 0; i < activeSelectedTeachers.length; i += BADGES_PER_PAGE) {
      sheets.push(activeSelectedTeachers.slice(i, i + BADGES_PER_PAGE));
    }
    return sheets;
  }, [activeSelectedTeachers]);

  const totalPages = Math.max(1, paginatedSheets.length);

  // Quick selection handlers
  const handleSelectAllFiltered = () => {
    const newSet = new Set(selectedTeacherIds);
    filteredTeacherList.forEach(t => newSet.add(t.id));
    setSelectedTeacherIds(newSet);
    toast.success(`تم تحديد ${filteredTeacherList.length} أستاذ(ة)`);
  };

  const handleDeselectAllFiltered = () => {
    const newSet = new Set(selectedTeacherIds);
    filteredTeacherList.forEach(t => newSet.delete(t.id));
    setSelectedTeacherIds(newSet);
  };

  // Custom quantity state
  const [customQuantity, setCustomQuantity] = useState<number>(8);

  const handleApplyCustomQuantity = () => {
    if (customQuantity <= 0) {
      toast.error('يرجى إدخال عدد صالح أكبر من صفر');
      return;
    }
    const subset = filteredTeacherList.slice(0, customQuantity);
    setSelectedTeacherIds(new Set(subset.map(t => t.id)));
    toast.success(`تم تحديد أول ${subset.length} أستاذ(ة) للطباعة (${Math.ceil(subset.length / 8)} ورقة A4)`);
  };

  const handleToggleTeacher = (id: string) => {
    setSelectedTeacherIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Get Cycle display badge
  const getCycleBadgeInfo = (cadre?: string) => {
    const c = String(cadre || '').toUpperCase();
    if (c.includes('PRIMARY') || c.includes('ابتدائي')) {
      return { label: 'سلك التعليم الابتدائي', short: 'ابتدائي', color: 'bg-amber-500 text-white' };
    }
    if (c.includes('MIDDLE') || c.includes('إعدادي')) {
      return { label: 'سلك الثانوي الإعدادي', short: 'إعدادي', color: 'bg-blue-600 text-white' };
    }
    return { label: 'سلك الثانوي التأهيلي', short: 'تأهيلي', color: 'bg-emerald-600 text-white' };
  };

  // Get active font CSS
  const activeFontCss = useMemo(() => {
    return BADGE_FONTS.find(f => f.id === selectedFont)?.css || "'Cairo', sans-serif";
  }, [selectedFont]);

  // Theme styling definitions
  const themeStyles = useMemo(() => {
    switch (theme) {
      case 'crimson_gold':
        return {
          cardBg: 'bg-gradient-to-b from-white via-rose-50/20 to-amber-50/30',
          cardBorder: 'border-red-600',
          headerBg: 'bg-gradient-to-r from-red-700 via-rose-800 to-red-900 text-white',
          headerAccent: 'text-amber-300',
          ribbonBg: 'bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black',
          subBarBg: 'bg-red-50 border-red-200 text-red-950',
          footerBg: 'bg-gradient-to-r from-red-800 to-slate-900 text-white',
          accentColor: '#b91c1c',
          badgeCornerDecor: 'border-amber-400'
        };
      case 'royal_navy':
        return {
          cardBg: 'bg-gradient-to-b from-white via-blue-50/20 to-indigo-50/30',
          cardBorder: 'border-blue-700',
          headerBg: 'bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white',
          headerAccent: 'text-blue-300',
          ribbonBg: 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-black',
          subBarBg: 'bg-blue-50 border-blue-200 text-blue-950',
          footerBg: 'bg-gradient-to-r from-slate-900 to-blue-950 text-white',
          accentColor: '#1d4ed8',
          badgeCornerDecor: 'border-cyan-400'
        };
      case 'imperial_dark':
        return {
          cardBg: 'bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 text-white',
          cardBorder: 'border-amber-500',
          headerBg: 'bg-gradient-to-r from-slate-950 via-slate-900 to-amber-950 text-amber-300',
          headerAccent: 'text-amber-400',
          ribbonBg: 'bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black',
          subBarBg: 'bg-slate-800 border-amber-500/30 text-amber-200',
          footerBg: 'bg-slate-950 text-slate-300 border-t border-amber-500/40',
          accentColor: '#f59e0b',
          badgeCornerDecor: 'border-amber-500'
        };
      case 'clean_white':
        return {
          cardBg: 'bg-white text-slate-900',
          cardBorder: 'border-slate-300',
          headerBg: 'bg-slate-100 text-slate-800 border-b border-slate-200',
          headerAccent: 'text-slate-600',
          ribbonBg: 'bg-emerald-600 text-white font-black',
          subBarBg: 'bg-slate-50 border-slate-200 text-slate-800',
          footerBg: 'bg-slate-100 text-slate-700 border-t border-slate-200',
          accentColor: '#059669',
          badgeCornerDecor: 'border-slate-400'
        };
      case 'royal_emerald':
      default:
        return {
          cardBg: 'bg-gradient-to-b from-white via-emerald-50/20 to-teal-50/30',
          cardBorder: 'border-emerald-600',
          headerBg: 'bg-gradient-to-r from-emerald-800 via-teal-800 to-emerald-900 text-white',
          headerAccent: 'text-emerald-300',
          ribbonBg: 'bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 text-slate-950 font-black',
          subBarBg: 'bg-emerald-50 border-emerald-200 text-emerald-950',
          footerBg: 'bg-gradient-to-r from-emerald-950 to-slate-900 text-white',
          accentColor: '#047857',
          badgeCornerDecor: 'border-amber-400'
        };
    }
  }, [theme]);

  // Direct Browser Print
  const handlePrint = () => {
    window.print();
  };

  // Download PDF (Multi-page A4)
  const handleDownloadPdf = async () => {
    if (activeSelectedTeachers.length === 0) {
      toast.error('يرجى تحديد أستاذ واحد على الأقل للطباعة');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('جاري توليد ملف PDF بجودة عالية للطباعة...');

    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      for (let pageIdx = 0; pageIdx < paginatedSheets.length; pageIdx++) {
        const sheetElement = document.getElementById(`printable-badge-sheet-${pageIdx}`);
        if (!sheetElement) continue;

        if (pageIdx > 0) {
          pdf.addPage('a4', 'portrait');
        }

        const dataUrl = await toJpeg(sheetElement, {
          quality: 0.95,
          pixelRatio: 2.5,
          backgroundColor: '#ffffff'
        });

        pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      }

      const fileName = `شارات_الاساتذة_${cleanDirCity}_${activeSeason.replace('/', '-')}.pdf`;
      pdf.save(fileName);
      toast.success('تم تنزيل ملف PDF للشارات بنجاح! 🪪', { id: toastId });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('حدث خطأ أثناء تصدير PDF. يمكنك استخدام زر الطباعة المباشرة.', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  // Download Current Sheet as PNG
  const handleDownloadCurrentPageImage = async () => {
    const sheetElement = document.getElementById(`printable-badge-sheet-${currentPreviewPage - 1}`);
    if (!sheetElement) {
      toast.error('تعذر الوصول إلى صفحة الشارات');
      return;
    }

    setIsExporting(true);
    const toastId = toast.loading('جاري استخراج صورة عالية الدقة...');

    try {
      const dataUrl = await toPng(sheetElement, {
        pixelRatio: 3,
        backgroundColor: '#ffffff'
      });

      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `شارات_الاساتذة_صفحة_${currentPreviewPage}_${cleanDirCity}.png`;
      a.click();
      toast.success('تم حفظ صورة الورقة بنجاح!', { id: toastId });
    } catch (e) {
      toast.error('تعذر حفظ الصورة', { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-hidden" dir="rtl">
      {/* Hidden Global Print Style Override for A4 */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          #print-root-badge-container,
          #print-root-badge-container * {
            visibility: visible;
          }
          #print-root-badge-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            margin: 0;
            padding: 0;
            background: white !important;
          }
          .print-a4-sheet {
            page-break-after: always;
            break-after: page;
            page-break-inside: avoid;
            break-inside: avoid;
            width: 210mm !important;
            height: 297mm !important;
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
      `}</style>

      {/* Main Modal Dialog */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-7xl h-[94vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md font-bold text-xl">
              🪪
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  إنشاء وطباعة شارات وبادجات الأساتذة (A4)
                </h3>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                  8 شارات بالورقة
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                توليد شارات الاعتماد الرسمية لأطر الرياضة المدرسية بـ {dirName} ({activeSeason})
              </p>
            </div>
          </div>

          {/* Navigation Tabs between Preview, Customizer, and Teacher Selection */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-2xl border border-slate-700/80">
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'preview'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>معاينة الشارات</span>
              <span className="bg-white/20 text-[10px] px-1.5 py-0.2 rounded-md">
                {activeSelectedTeachers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('selection')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'selection'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>اختيار الأساتذة</span>
              <span className="bg-white/20 text-[10px] px-1.5 py-0.2 rounded-md">
                {selectedTeacherIds.size}/{teachers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('customizer')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'customizer'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>إعدادات الورقة والخط</span>
            </button>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={activeSelectedTeachers.length === 0 || isExporting}
              className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
              title="طباعة ورقية مباشرة A4"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة فورية</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={activeSelectedTeachers.length === 0 || isExporting}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-black rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="تحميل كملف PDF متعدد الصفحات"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">تحميل PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Main Content Workspace */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT/RIGHT CONTENT ACCORDING TO ACTIVE TAB */}

          {/* TAB 1: TEACHER SELECTION PANEL */}
          {activeTab === 'selection' && (
            <div className="w-full flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900">
              <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 shadow-md">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <span>تحديد الأطر التربوية للطباعة</span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      حدد الأساتذة المطلوب توليد شاراتهم أو اختر السلك أو عدداً محدداً
                    </p>
                  </div>

                  {/* Quick Quantity Buttons & Custom Number Input */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <span className="text-[11px] text-slate-400 font-bold px-1.5">تحديد عدد مخصص:</span>
                      <input
                        type="number"
                        min={1}
                        max={filteredTeacherList.length || 100}
                        value={customQuantity}
                        onChange={(e) => setCustomQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-16 px-2 py-1 bg-slate-800 border border-slate-700 text-white font-mono font-bold text-xs rounded-lg text-center focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCustomQuantity}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition-colors cursor-pointer"
                      >
                        تطبيق
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setCustomQuantity(8);
                          const subset = filteredTeacherList.slice(0, 8);
                          setSelectedTeacherIds(new Set(subset.map(t => t.id)));
                          toast.success(`تم تحديد أول 8 أساتذة (ورقة واحدة A4)`);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      >
                        8 (ورقة 1)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomQuantity(16);
                          const subset = filteredTeacherList.slice(0, 16);
                          setSelectedTeacherIds(new Set(subset.map(t => t.id)));
                          toast.success(`تم تحديد أول 16 أستاذ (ورقتان A4)`);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      >
                        16 (ورقتان)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomQuantity(24);
                          const subset = filteredTeacherList.slice(0, 24);
                          setSelectedTeacherIds(new Set(subset.map(t => t.id)));
                          toast.success(`تم تحديد أول 24 أستاذ (3 ورقات A4)`);
                        }}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-blue-600 text-slate-200 hover:text-white text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      >
                        24 (3 ورقات)
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectAllFiltered}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        تحديد الكل ({filteredTeacherList.length})
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAllFiltered}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      >
                        إلغاء التحديد
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filter Controls Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800">
                  {/* Cycle Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">تصفية حسب السلك التعليمي:</label>
                    <select
                      value={cycleFilter}
                      onChange={(e) => setCycleFilter(e.target.value as any)}
                      className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="ALL">🏫 جميع الأسلاك التعليمية</option>
                      <option value="HIGH">🎓 الثانوي التأهيلي</option>
                      <option value="MIDDLE">📘 الثانوي الإعدادي</option>
                      <option value="PRIMARY">🏫 التعليم الابتدائي</option>
                    </select>
                  </div>

                  {/* School Filter */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">تصفية حسب المؤسسة:</label>
                    <select
                      value={schoolFilter}
                      onChange={(e) => setSchoolFilter(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                      <option value="ALL">🏢 جميع المؤسسات التعليمية</option>
                      {schools.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.type || 'مؤسسة'})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Bar */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">بحث بالاسم أو رقم التأجير (SOM):</label>
                    <div className="relative">
                      <Search className="absolute right-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={teacherSearch}
                        onChange={(e) => setTeacherSearch(e.target.value)}
                        placeholder="ابحث باسم الأستاذ، المؤسسة، رقم SOM..."
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200 rounded-xl pr-9 pl-3 py-2 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Teachers Grid Table */}
              <div className="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-md">
                <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs font-bold text-slate-300">
                  <span>قائمة الأساتذة ({filteredTeacherList.length} أستاذ متاح)</span>
                  <span className="text-emerald-400">
                    تم تحديد {selectedTeacherIds.size} شارة ({Math.ceil(selectedTeacherIds.size / 8)} ورقة A4)
                  </span>
                </div>

                <div className="divide-y divide-slate-800/80 max-h-[55vh] overflow-y-auto">
                  {filteredTeacherList.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      لا يوجد أساتذة مطابقون لشروط التصفية الحالية
                    </div>
                  ) : (
                    filteredTeacherList.map((t, idx) => {
                      const isSelected = selectedTeacherIds.has(t.id);
                      const cycleInfo = getCycleBadgeInfo(t.teachingCadre);
                      return (
                        <label
                          key={t.id}
                          className={`flex items-center justify-between p-3 transition-colors cursor-pointer ${
                            isSelected ? 'bg-blue-950/40 hover:bg-blue-950/60' : 'hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleTeacher(t.id)}
                              className="w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            
                            {/* Photo / Avatar */}
                            <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                              {t.photoUrl ? (
                                <img src={t.photoUrl} alt={t.fullName} className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-base font-bold text-slate-400">
                                  {t.fullName ? t.fullName.charAt(0) : '👨‍🏫'}
                                </span>
                              )}
                            </div>

                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{t.fullName}</span>
                                <span className={`text-[9px] font-black px-2 py-0.5 rounded ${cycleInfo.color}`}>
                                  {cycleInfo.short}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                                <span>🏢 {t.workLocation || 'مؤسسة غير محددة'}</span>
                                {t.leaseNumber && <span>🔢 SOM: {t.leaseNumber}</span>}
                              </div>
                            </div>
                          </div>

                          <div className="text-left">
                            <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CUSTOMIZER / SETTINGS PANEL */}
          {activeTab === 'customizer' && (
            <div className="w-full flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Theme & Font Selector */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <Palette className="w-4 h-4 text-amber-400" />
                    <span>طابع وهوية الشارة والخطوط</span>
                  </h4>

                  {/* Theme Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">طابع وألوان الشارة:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { id: 'royal_emerald', label: 'الأخضر الملكي', color: 'bg-emerald-700' },
                        { id: 'crimson_gold', label: 'القرمزي والذهبي', color: 'bg-red-700' },
                        { id: 'royal_navy', label: 'الأزرق الملكي', color: 'bg-blue-700' },
                        { id: 'imperial_dark', label: 'الأسود والذهبي', color: 'bg-slate-900 border border-amber-500' },
                        { id: 'clean_white', label: 'الأبيض النقي', color: 'bg-white text-slate-900' }
                      ].map(th => (
                        <button
                          key={th.id}
                          type="button"
                          onClick={() => setTheme(th.id as BadgeTheme)}
                          className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            theme === th.id
                              ? 'border-emerald-400 ring-2 ring-emerald-500/30 bg-slate-800'
                              : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className={`w-3.5 h-3.5 rounded-full ${th.color}`} />
                          <span className="text-[11px]">{th.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Font Family Selector */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1.5">نوع الخط العربي:</label>
                    <select
                      value={selectedFont}
                      onChange={(e) => setSelectedFont(e.target.value)}
                      className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                      {BADGE_FONTS.map(f => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Text inputs */}
                  <div className="space-y-2 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">عنوان الشارة الرئيسي:</label>
                      <input
                        type="text"
                        value={badgeMainTitle}
                        onChange={(e) => setBadgeMainTitle(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">الصفة / المهمة الفرعية:</label>
                      <input
                        type="text"
                        value={badgeSubTitle}
                        onChange={(e) => setBadgeSubTitle(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">الهيئة المنظمة:</label>
                      <input
                        type="text"
                        value={organizationHeader}
                        onChange={(e) => setOrganizationHeader(e.target.value)}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. Margins, Page Layout & Dimensions (Marge et mise en page) */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <Scissors className="w-4 h-4 text-emerald-400" />
                    <span>تحديد أبعاد الورقة والهوامش (Marge et mise en page)</span>
                  </h4>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">الهامش العلوي (mm):</label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={pageMarginTop}
                        onChange={(e) => setPageMarginTop(Number(e.target.value))}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">الهامش السفلي (mm):</label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={pageMarginBottom}
                        onChange={(e) => setPageMarginBottom(Number(e.target.value))}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">الهامش الجانبي (mm):</label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={pageMarginX}
                        onChange={(e) => setPageMarginX(Number(e.target.value))}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">التباعد الأفقي Gap X (mm):</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={gapX}
                        onChange={(e) => setGapX(Number(e.target.value))}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">التباعد العمودي Gap Y (mm):</label>
                      <input
                        type="number"
                        min={0}
                        max={20}
                        value={gapY}
                        onChange={(e) => setGapY(Number(e.target.value))}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">ارتفاع الشارة (mm):</label>
                      <input
                        type="number"
                        min={50}
                        max={80}
                        value={badgeHeightMm}
                        onChange={(e) => setBadgeHeightMm(Number(e.target.value))}
                        className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-1.5"
                      />
                    </div>
                  </div>

                  {/* Element toggles */}
                  <div className="pt-2 border-t border-slate-800 space-y-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showCutLines}
                        onChange={(e) => setShowCutLines(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>إظهار خطوط القص المتقطعة لتسهيل التقطيع (Cut Marks)</span>
                    </label>

                    {/* QR Code configuration based on SOM */}
                    <div className="p-2.5 bg-slate-900/90 rounded-xl border border-slate-800 space-y-2">
                      <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showQrCode}
                          onChange={(e) => setShowQrCode(e.target.checked)}
                          className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span>إظهار رمز الاستجابة السريع (QR Code)</span>
                      </label>
                      
                      {showQrCode && (
                        <div className="pt-1">
                          <label className="block text-[10px] font-bold text-slate-400 mb-1">
                            صيغة الكود المولد (حسب رقم التأجير SOM):
                          </label>
                          <select
                            value={qrCodeType}
                            onChange={(e) => setQrCodeType(e.target.value as any)}
                            className="w-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                          >
                            <option value="SOM_ONLY">🔢 رقم التأجير المباشر (SOM - للمسح التلقائي الفوري)</option>
                            <option value="SOM_FORMATTED">📋 رقم التأجير مع الاسم والمؤسسة (SOM: 123456 | ...)</option>
                            <option value="SOM_FULL">🪪 بطاقة الأستاذ الرقمية الكاملة برقم التأجير</option>
                          </select>
                        </div>
                      )}
                    </div>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showStampArea}
                        onChange={(e) => setShowStampArea(e.target.checked)}
                        className="rounded border-slate-700 text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>إظهار خانة الخاتم والتوقيع الرسمي</span>
                    </label>
                  </div>
                </div>

                {/* 3. Font Sizes Tuning */}
                <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3 col-span-full">
                  <h4 className="text-xs font-black text-white flex items-center gap-2">
                    <Type className="w-4 h-4 text-blue-400" />
                    <span>التحكم في أحجام الخطوط (Font Sizes)</span>
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">اسم الأستاذ(ة): {nameFontSize}pt</label>
                      <input
                        type="range"
                        min={9}
                        max={16}
                        step={0.5}
                        value={nameFontSize}
                        onChange={(e) => setNameFontSize(Number(e.target.value))}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">عنوان الشارة: {titleFontSize}pt</label>
                      <input
                        type="range"
                        min={7}
                        max={13}
                        step={0.5}
                        value={titleFontSize}
                        onChange={(e) => setTitleFontSize(Number(e.target.value))}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">المعطيات والمؤسسة: {detailsFontSize}pt</label>
                      <input
                        type="range"
                        min={7}
                        max={11}
                        step={0.5}
                        value={detailsFontSize}
                        onChange={(e) => setDetailsFontSize(Number(e.target.value))}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 mb-1">الترويسة والوزارة: {headerFontSize}pt</label>
                      <input
                        type="range"
                        min={6}
                        max={10}
                        step={0.5}
                        value={headerFontSize}
                        onChange={(e) => setHeaderFontSize(Number(e.target.value))}
                        className="w-full accent-emerald-500"
                      />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: LIVE PREVIEW & PRINT RENDERER */}
          {activeTab === 'preview' && (
            <div className="w-full flex-1 flex flex-col overflow-hidden bg-slate-950">
              
              {/* Preview Toolbar */}
              <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold">معاينة ورقة A4:</span>
                  <span className="text-emerald-400 font-black">
                    ورقة {currentPreviewPage} من {totalPages}
                  </span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-300">
                    مجموع الشارات: {activeSelectedTeachers.length} شارة
                  </span>
                </div>

                {/* Page switchers & Zoom */}
                <div className="flex items-center gap-2">
                  {/* Pagination Buttons */}
                  <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      disabled={currentPreviewPage <= 1}
                      onClick={() => setCurrentPreviewPage(p => Math.max(1, p - 1))}
                      className="p-1 rounded-lg hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <span className="px-2 text-xs font-mono font-bold">
                      {currentPreviewPage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPreviewPage >= totalPages}
                      onClick={() => setCurrentPreviewPage(p => Math.min(totalPages, p + 1))}
                      className="p-1 rounded-lg hover:bg-slate-700 disabled:opacity-30 cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Zoom controls */}
                  <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(z => Math.max(50, z - 15))}
                      className="p-1 rounded-lg hover:bg-slate-700 cursor-pointer"
                      title="تصغير"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-1 text-[11px] font-mono font-bold text-slate-300">
                      {previewZoom}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(z => Math.min(150, z + 15))}
                      className="p-1 rounded-lg hover:bg-slate-700 cursor-pointer"
                      title="تكبير"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewZoom(100)}
                      className="px-1.5 py-0.5 text-[10px] font-bold text-slate-400 hover:text-white rounded hover:bg-slate-700"
                    >
                      100%
                    </button>
                  </div>

                  {/* Save Image of current sheet */}
                  <button
                    type="button"
                    onClick={handleDownloadCurrentPageImage}
                    disabled={isExporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl border border-slate-700 font-bold transition-colors cursor-pointer"
                    title="حفظ الصفحة الحالية كصورة PNG عالية الدقة"
                  >
                    <FileImage className="w-3.5 h-3.5 text-amber-400" />
                    <span className="hidden sm:inline">حفظ كصورة</span>
                  </button>
                </div>
              </div>

              {/* Preview Canvas Container */}
              <div className="flex-1 overflow-auto p-4 flex items-start justify-center bg-slate-950">
                <div
                  style={{
                    transform: `scale(${previewZoom / 100})`,
                    transformOrigin: 'top center',
                    transition: 'transform 0.15s ease-out'
                  }}
                  className="shadow-2xl"
                >
                  {/* Render Current Preview Sheet */}
                  {paginatedSheets.length > 0 && paginatedSheets[currentPreviewPage - 1] ? (
                    <div
                      id={`preview-badge-sheet-${currentPreviewPage - 1}`}
                      style={{
                        width: '210mm',
                        height: '297mm',
                        paddingTop: `${pageMarginTop}mm`,
                        paddingBottom: `${pageMarginBottom}mm`,
                        paddingLeft: `${pageMarginX}mm`,
                        paddingRight: `${pageMarginX}mm`,
                        fontFamily: activeFontCss,
                        boxSizing: 'border-box'
                      }}
                      className="bg-white text-slate-900 shadow-2xl relative overflow-hidden"
                    >
                      {/* Grid Container for 8 Badges (2 columns x 4 rows) */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(2, 1fr)',
                          gridTemplateRows: 'repeat(4, 1fr)',
                          columnGap: `${gapX}mm`,
                          rowGap: `${gapY}mm`,
                          height: '100%',
                          width: '100%'
                        }}
                      >
                        {paginatedSheets[currentPreviewPage - 1].map((teacher, bIndex) => {
                          const cycle = getCycleBadgeInfo(teacher.teachingCadre);
                          const qrData = qrCodeUrls[teacher.id];

                          return (
                            <div
                              key={`badge-${teacher.id}-${bIndex}`}
                              style={{
                                height: `${badgeHeightMm}mm`,
                                borderRadius: `${badgeBorderRadius}mm`,
                                boxSizing: 'border-box'
                              }}
                              className={`relative overflow-hidden border ${themeStyles.cardBorder} ${themeStyles.cardBg} flex flex-col justify-between shadow-2xs ${
                                showCutLines ? 'ring-1 ring-dashed ring-slate-300' : ''
                              }`}
                            >
                              {/* BADGE TOP HEADER */}
                              <div className={`${themeStyles.headerBg} px-2 py-1 flex items-center justify-between shrink-0 border-b border-white/20`}>
                                <div className="flex items-center gap-1">
                                  {showMinistryLogo && (
                                    <div className="w-5 h-5 rounded bg-white/10 p-0.5 flex items-center justify-center shrink-0">
                                      <img
                                        src={officialLogos?.ministryLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Emblem_of_Morocco.svg/1200px-Emblem_of_Morocco.svg.png"}
                                        alt="Ministry"
                                        className="w-full h-full object-contain"
                                        crossOrigin="anonymous"
                                      />
                                    </div>
                                  )}
                                  <div className="text-right leading-tight">
                                    <p style={{ fontSize: `${headerFontSize}pt` }} className="font-bold tracking-tight">
                                      المملكة المغربية — وزارة التربية الوطنية
                                    </p>
                                    <p style={{ fontSize: `${headerFontSize - 1.2}pt` }} className={`${themeStyles.headerAccent} opacity-90`}>
                                      {organizationHeader}
                                    </p>
                                  </div>
                                </div>

                                {showFrmssLogo && (
                                  <div className="w-5 h-5 rounded bg-white/10 p-0.5 flex items-center justify-center shrink-0">
                                    <img
                                      src={officialLogos?.frmssLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Emblem_of_Morocco.svg/1200px-Emblem_of_Morocco.svg.png"}
                                      alt="FRMSS"
                                      className="w-full h-full object-contain"
                                      crossOrigin="anonymous"
                                    />
                                  </div>
                                )}
                              </div>

                              {/* BADGE TITLE RIBBON */}
                              <div className={`${themeStyles.ribbonBg} px-2 py-0.5 flex items-center justify-between text-center`}>
                                <span style={{ fontSize: `${titleFontSize}pt` }} className="truncate w-full font-black">
                                  {badgeMainTitle}
                                </span>
                              </div>

                              {/* BADGE MAIN BODY */}
                              <div className="px-2 py-1 flex-1 flex items-center gap-2">
                                
                                {/* Teacher Photo */}
                                {showPhoto && (
                                  <div className="w-14 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-300 shadow-2xs flex items-center justify-center shrink-0 relative">
                                    {teacher.photoUrl ? (
                                      <img
                                        src={teacher.photoUrl}
                                        alt={teacher.fullName}
                                        className="w-full h-full object-cover"
                                        crossOrigin="anonymous"
                                      />
                                    ) : (
                                      <div className="text-center">
                                        <span className="text-2xl">👨‍🏫</span>
                                        <span className="block text-[7px] text-slate-500 font-bold mt-0.5">مؤطر</span>
                                      </div>
                                    )}
                                    {/* Small flag stamp badge */}
                                    <span className="absolute bottom-0 right-0 bg-red-600 text-[6px] text-white px-1 font-bold">
                                      MAR
                                    </span>
                                  </div>
                                )}

                                {/* Teacher Personal & Institutional Details */}
                                <div className="flex-1 text-right min-w-0 space-y-0.5">
                                  {/* Full Name */}
                                  <p
                                    style={{ fontSize: `${nameFontSize}pt` }}
                                    className="font-black text-slate-900 leading-tight truncate"
                                  >
                                    {teacher.fullName || 'الأستاذ(ة)'}
                                  </p>

                                  {/* School */}
                                  <div className="flex items-center gap-1 text-slate-700 truncate">
                                    <span className="text-[10px]">🏢</span>
                                    <span style={{ fontSize: `${detailsFontSize}pt` }} className="font-bold truncate">
                                      {teacher.workLocation || 'المؤسسة التعليمية'}
                                    </span>
                                  </div>

                                  {/* Cycle Badge & SOM */}
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {showCycleBadge && (
                                      <span
                                        style={{ fontSize: `${detailsFontSize - 1.5}pt` }}
                                        className={`font-black px-1.5 py-0.2 rounded ${cycle.color} shadow-2xs`}
                                      >
                                        {cycle.label}
                                      </span>
                                    )}
                                    {showSom && teacher.leaseNumber && (
                                      <span
                                        style={{ fontSize: `${detailsFontSize - 1.5}pt` }}
                                        className="font-mono font-bold bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded border border-slate-300"
                                      >
                                        SOM: {teacher.leaseNumber}
                                      </span>
                                    )}
                                  </div>

                                  {/* Subtitle / Role */}
                                  <p style={{ fontSize: `${footerFontSize}pt` }} className="text-slate-500 font-bold truncate">
                                    {badgeSubTitle}
                                  </p>
                                </div>

                                {/* QR Code & Stamp */}
                                <div className="flex flex-col items-center justify-center shrink-0 gap-0.5">
                                  {showQrCode && qrData && (
                                    <div className="w-11 h-11 p-0.5 bg-white border border-slate-300 rounded shadow-2xs">
                                      <img src={qrData} alt="QR" className="w-full h-full object-contain" />
                                    </div>
                                  )}
                                  <span style={{ fontSize: `${footerFontSize - 1.5}pt` }} className="font-mono text-slate-500 font-bold">
                                    {teacher.leaseNumber ? `SOM:${teacher.leaseNumber}` : seasonText}
                                  </span>
                                </div>
                              </div>

                              {/* BADGE FOOTER BAR */}
                              <div className={`${themeStyles.footerBg} px-2 py-0.5 flex items-center justify-between shrink-0`}>
                                <span style={{ fontSize: `${footerFontSize}pt` }} className="font-bold truncate">
                                  {dirName}
                                </span>
                                {showStampArea ? (
                                  <span style={{ fontSize: `${footerFontSize - 1}pt` }} className="text-amber-300 font-bold tracking-tight">
                                    توقيع وخاتم الفرع الإقليمي ✍️
                                  </span>
                                ) : (
                                  <span style={{ fontSize: `${footerFontSize - 1}pt` }} className="text-slate-400 font-mono">
                                    بطاقة اعتماد رسمية
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800">
                      لم يتم تحديد أي أستاذ للطباعة. يرجى اختيار الأساتذة من تبويب "اختيار الأساتذة".
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM GLOBAL STATUS BAR */}
        <div className="px-5 py-2.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>✅ الجاهزية:</span>
            <strong className="text-white font-black">{activeSelectedTeachers.length}</strong>
            <span>شارات محددة</span>
            <span>•</span>
            <strong className="text-emerald-400 font-black">{totalPages}</strong>
            <span>ورقة A4 (8 شارات بالورقة)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              disabled={activeSelectedTeachers.length === 0 || isExporting}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold cursor-pointer transition-all shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة الكل ({activeSelectedTeachers.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* HIDDEN PRINT CONTAINER (Render all pages for window.print()) */}
      <div id="print-root-badge-container" className="hidden print:block">
        {paginatedSheets.map((sheetTeachers, pageIdx) => (
          <div
            key={`printable-sheet-${pageIdx}`}
            id={`printable-badge-sheet-${pageIdx}`}
            style={{
              width: '210mm',
              height: '297mm',
              paddingTop: `${pageMarginTop}mm`,
              paddingBottom: `${pageMarginBottom}mm`,
              paddingLeft: `${pageMarginX}mm`,
              paddingRight: `${pageMarginX}mm`,
              fontFamily: activeFontCss,
              boxSizing: 'border-box'
            }}
            className="print-a4-sheet bg-white text-slate-900 relative overflow-hidden"
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gridTemplateRows: 'repeat(4, 1fr)',
                columnGap: `${gapX}mm`,
                rowGap: `${gapY}mm`,
                height: '100%',
                width: '100%'
              }}
            >
              {sheetTeachers.map((teacher, bIndex) => {
                const cycle = getCycleBadgeInfo(teacher.teachingCadre);
                const qrData = qrCodeUrls[teacher.id];

                return (
                  <div
                    key={`print-badge-${teacher.id}-${bIndex}`}
                    style={{
                      height: `${badgeHeightMm}mm`,
                      borderRadius: `${badgeBorderRadius}mm`,
                      boxSizing: 'border-box'
                    }}
                    className={`relative overflow-hidden border ${themeStyles.cardBorder} ${themeStyles.cardBg} flex flex-col justify-between shadow-none ${
                      showCutLines ? 'ring-1 ring-dashed ring-slate-300' : ''
                    }`}
                  >
                    {/* BADGE TOP HEADER */}
                    <div className={`${themeStyles.headerBg} px-2 py-1 flex items-center justify-between shrink-0 border-b border-white/20`}>
                      <div className="flex items-center gap-1">
                        {showMinistryLogo && (
                          <div className="w-5 h-5 rounded bg-white/10 p-0.5 flex items-center justify-center shrink-0">
                            <img
                              src={officialLogos?.ministryLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Emblem_of_Morocco.svg/1200px-Emblem_of_Morocco.svg.png"}
                              alt="Ministry"
                              className="w-full h-full object-contain"
                              crossOrigin="anonymous"
                            />
                          </div>
                        )}
                        <div className="text-right leading-tight">
                          <p style={{ fontSize: `${headerFontSize}pt` }} className="font-bold tracking-tight">
                            المملكة المغربية — وزارة التربية الوطنية
                          </p>
                          <p style={{ fontSize: `${headerFontSize - 1.2}pt` }} className={`${themeStyles.headerAccent} opacity-90`}>
                            {organizationHeader}
                          </p>
                        </div>
                      </div>

                      {showFrmssLogo && (
                        <div className="w-5 h-5 rounded bg-white/10 p-0.5 flex items-center justify-center shrink-0">
                          <img
                            src={officialLogos?.frmssLogo || "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/Emblem_of_Morocco.svg/1200px-Emblem_of_Morocco.svg.png"}
                            alt="FRMSS"
                            className="w-full h-full object-contain"
                            crossOrigin="anonymous"
                          />
                        </div>
                      )}
                    </div>

                    {/* BADGE TITLE RIBBON */}
                    <div className={`${themeStyles.ribbonBg} px-2 py-0.5 flex items-center justify-between text-center`}>
                      <span style={{ fontSize: `${titleFontSize}pt` }} className="truncate w-full font-black">
                        {badgeMainTitle}
                      </span>
                    </div>

                    {/* BADGE MAIN BODY */}
                    <div className="px-2 py-1 flex-1 flex items-center gap-2">
                      
                      {/* Teacher Photo */}
                      {showPhoto && (
                        <div className="w-14 h-16 rounded-lg overflow-hidden bg-slate-100 border border-slate-300 shadow-none flex items-center justify-center shrink-0 relative">
                          {teacher.photoUrl ? (
                            <img
                              src={teacher.photoUrl}
                              alt={teacher.fullName}
                              className="w-full h-full object-cover"
                              crossOrigin="anonymous"
                            />
                          ) : (
                            <div className="text-center">
                              <span className="text-2xl">👨‍🏫</span>
                              <span className="block text-[7px] text-slate-500 font-bold mt-0.5">مؤطر</span>
                            </div>
                          )}
                          <span className="absolute bottom-0 right-0 bg-red-600 text-[6px] text-white px-1 font-bold">
                            MAR
                          </span>
                        </div>
                      )}

                      {/* Teacher Personal Details */}
                      <div className="flex-1 text-right min-w-0 space-y-0.5">
                        <p
                          style={{ fontSize: `${nameFontSize}pt` }}
                          className="font-black text-slate-900 leading-tight truncate"
                        >
                          {teacher.fullName || 'الأستاذ(ة)'}
                        </p>

                        <div className="flex items-center gap-1 text-slate-700 truncate">
                          <span className="text-[10px]">🏢</span>
                          <span style={{ fontSize: `${detailsFontSize}pt` }} className="font-bold truncate">
                            {teacher.workLocation || 'المؤسسة التعليمية'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {showCycleBadge && (
                            <span
                              style={{ fontSize: `${detailsFontSize - 1.5}pt` }}
                              className={`font-black px-1.5 py-0.2 rounded ${cycle.color}`}
                            >
                              {cycle.label}
                            </span>
                          )}
                          {showSom && teacher.leaseNumber && (
                            <span
                              style={{ fontSize: `${detailsFontSize - 1.5}pt` }}
                              className="font-mono font-bold bg-slate-100 text-slate-800 px-1.5 py-0.2 rounded border border-slate-300"
                            >
                              SOM: {teacher.leaseNumber}
                            </span>
                          )}
                        </div>

                        <p style={{ fontSize: `${footerFontSize}pt` }} className="text-slate-500 font-bold truncate">
                          {badgeSubTitle}
                        </p>
                      </div>

                      {/* QR Code & Stamp */}
                      <div className="flex flex-col items-center justify-center shrink-0 gap-0.5">
                        {showQrCode && qrData && (
                          <div className="w-11 h-11 p-0.5 bg-white border border-slate-300 rounded">
                            <img src={qrData} alt="QR" className="w-full h-full object-contain" />
                          </div>
                        )}
                        <span style={{ fontSize: `${footerFontSize - 1.5}pt` }} className="font-mono text-slate-500 font-bold">
                          {teacher.leaseNumber ? `SOM:${teacher.leaseNumber}` : seasonText}
                        </span>
                      </div>
                    </div>

                    {/* BADGE FOOTER BAR */}
                    <div className={`${themeStyles.footerBg} px-2 py-0.5 flex items-center justify-between shrink-0`}>
                      <span style={{ fontSize: `${footerFontSize}pt` }} className="font-bold truncate">
                        {dirName}
                      </span>
                      {showStampArea ? (
                        <span style={{ fontSize: `${footerFontSize - 1}pt` }} className="text-amber-300 font-bold tracking-tight">
                          توقيع وخاتم الفرع الإقليمي ✍️
                        </span>
                      ) : (
                        <span style={{ fontSize: `${footerFontSize - 1}pt` }} className="text-slate-400 font-mono">
                          بطاقة اعتماد رسمية
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
