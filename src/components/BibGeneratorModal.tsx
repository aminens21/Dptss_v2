import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Eye, 
  Filter, 
  Palette, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Users,
  QrCode,
  Sparkles,
  Loader2,
  Type,
  Maximize2,
  Sliders,
  Grid2X2,
  Layers,
  FileText,
  Search,
  CheckSquare,
  Square,
  RotateCcw,
  Palette as PaletteIcon
} from 'lucide-react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';
import { Student, School } from '../types';
import { CROSS_COUNTRY_CATEGORIES, CrossCountryCategoryDef } from '../lib/crossCountryConfig';
import { DataService } from '../lib/dataService';
import { printBibsAsNativeText, pregenerateQrsForBibs } from '../lib/crossCountryBibPdfService';
import toast from 'react-hot-toast';

export interface BibRunnerData {
  id: string;
  bibNumber: string | number;
  fullName: string;
  massarNumber: string;
  birthDate?: string;
  birthYear?: string | number;
  schoolName: string;
  commune?: string;
  directorateName: string;
  category: string;
  categoryLabel: string;
  gender: 'Male' | 'Female' | string;
  genderLabel: string;
  affiliationType?: string;
  qrDataUrl?: string;
}

interface BibGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: Student[];
  schools?: School[];
  directorateName?: string;
  initialCategoryId?: string;
  initialSelectedRaces?: string[];
}

export const BibGeneratorModal: React.FC<BibGeneratorModalProps> = ({
  isOpen,
  onClose,
  students: propStudents,
  schools: propSchools,
  directorateName: propDirectorateName,
  initialCategoryId,
  initialSelectedRaces
}) => {
  const [students, setStudents] = useState<Student[]>(propStudents || []);
  const [schools, setSchools] = useState<School[]>(propSchools || []);
  const [directorateName, setDirectorateName] = useState<string>(propDirectorateName || 'تاوريرت');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);

  // Cross Country Races Multi-Selection State (كل سباق على حدا مع إمكانية تحديد أكثر من سباق)
  const [selectedRaces, setSelectedRaces] = useState<string[]>(CROSS_COUNTRY_CATEGORIES.map(c => c.id));
  const [separatePagesPerRace, setSeparatePagesPerRace] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [selectedAffiliation, setSelectedAffiliation] = useState<string>('ALL');
  const [previewRaceFilter, setPreviewRaceFilter] = useState<string>('ALL');
  const [bibBgColor, setBibBgColor] = useState<string>('#FFFFFF');

  // Page layout: 1 bib per page (A4), 2 bibs per page (A5) or 6 bibs per page (2x3 compact)
  const [bibsPerPage, setBibsPerPage] = useState<1 | 2 | 6>(2);

  // QR code size scale (0.75: صغير, 1.0: عادي, 1.25: كبير, 1.4: ضخم)
  const [qrScale, setQrScale] = useState<number>(1.0);

  // Bib number font family ('mono' | 'sans' | 'serif')
  const [bibFont, setBibFont] = useState<'mono' | 'sans' | 'serif'>('mono');

  // Bib number font size scale (0.6: 60% to 1.8: 180%)
  const [bibNumberScale, setBibNumberScale] = useState<number>(1.0);

  // Runner details font size scale (0.7: 70% to 1.4: 140%)
  const [textScale, setTextScale] = useState<number>(1.0);

  // Preview Pagination
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, string>>({});

  // Printable container ref
  const printContainerRef = useRef<HTMLDivElement>(null);

  // Load data if not provided
  useEffect(() => {
    if (!isOpen) return;
    
    const loadInitial = async () => {
      if (!propStudents || propStudents.length === 0 || !propSchools || propSchools.length === 0) {
        setIsLoadingData(true);
        try {
          const [loadedStudents, loadedSchools, loadedDir] = await Promise.all([
            DataService.getStudents(),
            DataService.getSchools(),
            DataService.getActiveDirectorate()
          ]);
          // Filter cross country or all registered
          const cc = loadedStudents.filter(s => s.sportId === 'cross_country' || !s.sportId);
          setStudents(cc.length > 0 ? cc : loadedStudents);
          setSchools(loadedSchools);
          if (loadedDir?.name) {
            setDirectorateName(loadedDir.shortName || loadedDir.name);
          }
        } catch (err) {
          console.error('Error loading bib data:', err);
        } finally {
          setIsLoadingData(false);
        }
      } else {
        setStudents(propStudents);
        setSchools(propSchools);
        if (propDirectorateName) setDirectorateName(propDirectorateName);
      }
    };

    loadInitial();
  }, [isOpen, propStudents, propSchools, propDirectorateName]);

  // If initialSelectedRaces or initialCategoryId is passed, initialize selected races
  useEffect(() => {
    if (initialSelectedRaces && initialSelectedRaces.length > 0) {
      setSelectedRaces(initialSelectedRaces);
    } else if (initialCategoryId) {
      setSelectedRaces([initialCategoryId]);
      const foundCat = CROSS_COUNTRY_CATEGORIES.find(c => c.id === initialCategoryId);
      if (foundCat) {
        setSelectedGender(foundCat.gender);
      }
    }
  }, [initialCategoryId, initialSelectedRaces]);

  // School lookup map
  const schoolMap = useMemo(() => {
    const map = new Map<string, School>();
    schools.forEach(s => map.set(s.id, s));
    return map;
  }, [schools]);

  // Helper to normalize and match category
  const matchCategoryDef = (student: Student): CrossCountryCategoryDef | undefined => {
    const sCat = (student.category || '').toLowerCase().trim();
    const sGen = (student.gender || '').toLowerCase().trim();

    return CROSS_COUNTRY_CATEGORIES.find(cat => {
      const cCat = cat.category.toLowerCase().trim();
      const cGen = cat.gender.toLowerCase().trim();

      const catMatches = sCat === cCat ||
        (cCat === 'u12' && (sCat.includes('براعم') || sCat.includes('12') || sCat.includes('برعم'))) ||
        (cCat === 'u15' && (sCat.includes('صغار') || sCat.includes('15') || sCat.includes('صغير'))) ||
        (cCat === 'u18' && (sCat.includes('فتيان') || sCat.includes('18') || sCat.includes('فتيات') || sCat.includes('فتي'))) ||
        (cCat === 'u20' && (sCat.includes('شبان') || sCat.includes('20') || sCat.includes('شابات') || sCat.includes('شب')));

      const genMatches = sGen === cGen ||
        (cGen === 'male' && (sGen.includes('ذكر') || sGen.includes('ذكور') || sGen === 'm' || sGen === 'male' || sGen.includes('ولد'))) ||
        (cGen === 'female' && (sGen.includes('أنثى') || sGen.includes('انثى') || sGen.includes('إناث') || sGen.includes('اناث') || sGen === 'f' || sGen === 'female' || sGen.includes('بنت')));

      return catMatches && genMatches;
    });
  };

  // Build list of all runners with normalized bib numbers
  const allRunners: BibRunnerData[] = useMemo(() => {
    return students.map((student, idx) => {
      const catDef = matchCategoryDef(student);
      const school = student.schoolId ? schoolMap.get(student.schoolId) : undefined;
      const schoolName = student.schoolName || school?.name || 'مؤسسة تعليمية';
      const commune = school?.commune || '';
      
      const isFemale = student.gender === 'Female' || (student.gender as string)?.includes('أنثى') || (student.gender as string)?.includes('إناث');
      const genderLabel = isFemale ? 'أنثى' : 'ذكر';
      
      // Category display name
      let categoryLabel = catDef ? catDef.titleAr.replace('سباق ', '') : (student.category || 'مشارك');

      // Bib number: use assigned bibNumber if exists, otherwise generate systematic starting from 101
      const bibNumber = student.bibNumber || (101 + idx);

      return {
        id: student.id || `runner-${idx}`,
        bibNumber,
        fullName: student.fullName || student.name || `متسابق ${idx + 1}`,
        massarNumber: student.massarNumber || student.nationalId || `${150000 + idx}`,
        birthDate: student.birthDate || (student.birthYear ? `01/01/${student.birthYear}` : '2012/01/01'),
        birthYear: student.birthYear || '2012',
        schoolName,
        commune,
        directorateName,
        category: catDef?.id || student.category || 'U12',
        categoryLabel,
        gender: isFemale ? 'Female' : 'Male',
        genderLabel,
        affiliationType: student.affiliationType || 'non_club'
      };
    });
  }, [students, schoolMap, directorateName]);

  // Filter runners based on selected races (multi-race selection), gender, and search query
  const filteredRunners = useMemo(() => {
    return allRunners.filter(runner => {
      // Race filter (multi-race selection)
      if (selectedRaces.length > 0) {
        const matchesAnyRace = selectedRaces.some(raceId => {
          const catDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === raceId);
          if (!catDef) return false;
          return (
            runner.category === catDef.id ||
            (runner.categoryLabel.includes(catDef.titleAr.replace('سباق ', '')) && runner.gender === catDef.gender) ||
            (runner.category.toUpperCase() === catDef.category.toUpperCase() && runner.gender.toLowerCase() === catDef.gender.toLowerCase())
          );
        });
        if (!matchesAnyRace) return false;
      } else {
        return false;
      }

      // Gender filter
      if (selectedGender !== 'ALL' && runner.gender !== selectedGender) {
        return false;
      }

      // Affiliation filter
      if (selectedAffiliation !== 'ALL' && runner.affiliationType !== selectedAffiliation) {
        return false;
      }

      // Search query filter (name, massar, school, bib)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const mName = (runner.fullName || '').toLowerCase().includes(q);
        const mMassar = (runner.massarNumber || '').toLowerCase().includes(q);
        const mSchool = (runner.schoolName || '').toLowerCase().includes(q);
        const mBib = String(runner.bibNumber).includes(q);
        if (!mName && !mMassar && !mSchool && !mBib) return false;
      }

      return true;
    });
  }, [allRunners, selectedRaces, selectedGender, selectedAffiliation, searchQuery]);

  // Race counts for each of the 8 individual races
  const raceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CROSS_COUNTRY_CATEGORIES.forEach(cat => {
      counts[cat.id] = allRunners.filter(r => {
        return (
          r.category === cat.id ||
          (r.categoryLabel.includes(cat.titleAr.replace('سباق ', '')) && r.gender === cat.gender) ||
          (r.category.toUpperCase() === cat.category.toUpperCase() && r.gender.toLowerCase() === cat.gender.toLowerCase())
        );
      }).length;
    });
    return counts;
  }, [allRunners]);

  // Gender counts
  const genderCounts = useMemo(() => {
    const maleCount = allRunners.filter(r => r.gender === 'Male').length;
    const femaleCount = allRunners.filter(r => r.gender === 'Female').length;
    return {
      ALL: allRunners.length,
      Male: maleCount,
      Female: femaleCount
    };
  }, [allRunners]);

  // Affiliation counts
  const affiliationCounts = useMemo(() => {
    const clubCount = allRunners.filter(r => r.affiliationType === 'club_affiliated').length;
    const schoolCount = allRunners.filter(r => r.affiliationType === 'non_club').length;
    return {
      ALL: allRunners.length,
      club_affiliated: clubCount,
      non_club: schoolCount
    };
  }, [allRunners]);

  // Toggle single race selection
  const toggleRace = (raceId: string) => {
    setSelectedRaces(prev => {
      if (prev.includes(raceId)) {
        return prev.filter(id => id !== raceId);
      } else {
        return [...prev, raceId];
      }
    });
    setPreviewPage(1);
  };

  // Solo select a single race
  const selectSingleRace = (raceId: string) => {
    setSelectedRaces([raceId]);
    setPreviewRaceFilter('ALL');
    setPreviewPage(1);
  };

  const selectAllRaces = () => {
    setSelectedRaces(CROSS_COUNTRY_CATEGORIES.map(c => c.id));
    setPreviewPage(1);
  };

  const deselectAllRaces = () => {
    setSelectedRaces([]);
    setPreviewPage(1);
  };

  const selectMaleRaces = () => {
    setSelectedRaces(CROSS_COUNTRY_CATEGORIES.filter(c => c.gender === 'Male').map(c => c.id));
    setPreviewPage(1);
  };

  const selectFemaleRaces = () => {
    setSelectedRaces(CROSS_COUNTRY_CATEGORIES.filter(c => c.gender === 'Female').map(c => c.id));
    setPreviewPage(1);
  };

  // Runners displayed in preview (can be narrowed by previewRaceFilter)
  const previewRunners = useMemo(() => {
    if (previewRaceFilter === 'ALL') return filteredRunners;
    const catDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === previewRaceFilter);
    if (!catDef) return filteredRunners;
    return filteredRunners.filter(r => 
      r.category === catDef.id ||
      (r.categoryLabel.includes(catDef.titleAr.replace('سباق ', '')) && r.gender === catDef.gender) ||
      (r.category.toUpperCase() === catDef.category.toUpperCase() && r.gender.toLowerCase() === catDef.gender.toLowerCase())
    );
  }, [filteredRunners, previewRaceFilter]);

  // Total preview pages based on bibsPerPage (2 or 6)
  const totalPreviewPages = Math.max(1, Math.ceil(previewRunners.length / bibsPerPage));

  // Current page runners (2 or 6 max)
  const currentPageRunners = useMemo(() => {
    const startIdx = (previewPage - 1) * bibsPerPage;
    return previewRunners.slice(startIdx, startIdx + bibsPerPage);
  }, [previewRunners, previewPage, bibsPerPage]);

  // Pre-generate QR codes for current page runners
  useEffect(() => {
    const generateQrs = async () => {
      const newMap = { ...qrCodeMap };
      for (const runner of currentPageRunners) {
        if (!newMap[runner.id]) {
          try {
            // كود المسح هو رقم الصدرية مباشرة
            const qrPayload = String(runner.bibNumber || runner.id || '').trim();
            const url = await QRCode.toDataURL(qrPayload, {
              width: 280,
              margin: 1,
              color: {
                dark: '#000000',
                light: '#ffffff'
              },
              errorCorrectionLevel: 'M'
            });
            newMap[runner.id] = url;
          } catch (e) {
            console.error('Failed to generate QR for runner', runner.id, e);
          }
        }
      }
      setQrCodeMap(newMap);
    };

    if (currentPageRunners.length > 0) {
      generateQrs();
    }
  }, [currentPageRunners]);

  // Reset preview page if filter or layout changes
  useEffect(() => {
    setPreviewPage(1);
  }, [selectedRaces, selectedGender, selectedAffiliation, searchQuery, bibsPerPage, previewRaceFilter]);

  // Generate and Download Bibs as pure Native Typography / Text (Instant, Vector Quality, No Rasterization lag)
  const handleFastTextDownloadOrPrint = async () => {
    if (filteredRunners.length === 0) {
      toast.error('لا يوجد متسابقون لتوليد الصدريات حسب التصفية المحددة');
      return;
    }

    setIsGeneratingPdf(true);
    const toastId = toast.loading(`جاري تجهيز الصدريات ككتابة ونصوص نقية فائقة السرعة...`);

    try {
      // 1. Pre-generate or use cached QR codes
      const neededQrs: Record<string, string> = { ...qrCodeMap };
      const missingRunners = filteredRunners.filter(r => !neededQrs[r.id]);

      if (missingRunners.length > 0) {
        const generated = await pregenerateQrsForBibs(missingRunners);
        Object.assign(neededQrs, generated);
        setQrCodeMap(prev => ({ ...prev, ...generated }));
      }

      const layoutLabel = bibsPerPage === 1 ? 'A4' : (bibsPerPage === 6 ? 'اقتصادي' : 'A5');
      const filename = `صدريات_العدو_الريفي_${layoutLabel}_${new Date().toISOString().slice(0, 10)}`;

      await printBibsAsNativeText({
        runners: filteredRunners,
        bibsPerPage,
        bibBgColor,
        bibFont,
        qrScale,
        bibNumberScale,
        textScale,
        separatePagesPerRace,
        selectedRaces,
        filename
      }, neededQrs);

      toast.dismiss(toastId);
      toast.success('تم فتح نافذة الطباعة / الحفظ كـ PDF (كتابة ونصوص نقية) بنجاح!');
    } catch (error) {
      console.error('Error generating fast text bibs:', error);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء إعداد الصدريات للطباعة أو الحفظ');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Generate and Download PDF using Native jsPDF Drawing (Fast, High Quality, No Stretching)
  const handleDownloadPdf = async () => {
    if (filteredRunners.length === 0) {
      toast.error('لا يوجد متسابقون لتوليد الصدريات حسب التصفية المحددة');
      return;
    }

    setIsGeneratingPdf(true);
    const toastId = toast.loading(`جاري استخراج ${filteredRunners.length} صدرية بنصوص وكتابة نقية...`);

    try {
      // If runner count is large (> 40), or if user preferred text, also offer instant native print/save
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const pageWidth = 210;
      const pageHeight = 297;
      
      // Re-usable single canvas instance to avoid memory bloat and garbage collection pauses
      const sharedCanvas = document.createElement('canvas');
      const sharedCtx = sharedCanvas.getContext('2d', { willReadFrequently: true });
      
      // Helper to draw text by rendering to the reusable canvas
      const drawStyledText = async (
        text: string, 
        tx: number, 
        ty: number, 
        tw: number, 
        th: number, 
        fontSize: number,
        fontWeight: string = 'bold',
        fontFamily: string = 'Tahoma, Arial, sans-serif'
      ) => {
        if (!sharedCtx || !text) return;

        const scale = 3; // Optimized scale: super sharp, 60% faster than scale 5
        const fontPx = Math.max(16, Math.round(fontSize * scale * 3.2));
        sharedCtx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
        
        const metrics = sharedCtx.measureText(text);
        const textWidth = Math.ceil(metrics.width);
        const textHeight = Math.ceil(fontPx * 1.35);

        sharedCanvas.width = textWidth + 20;
        sharedCanvas.height = textHeight + 20;

        // Re-apply font after resize
        sharedCtx.font = `${fontWeight} ${fontPx}px ${fontFamily}`;
        sharedCtx.textBaseline = 'middle';
        sharedCtx.textAlign = 'center';
        sharedCtx.fillStyle = '#000000';
        sharedCtx.fillText(text, sharedCanvas.width / 2, sharedCanvas.height / 2);

        const imgData = sharedCanvas.toDataURL('image/png');
        const aspect = sharedCanvas.width / sharedCanvas.height;
        
        // Target dimensions in mm
        const maxW = tw * 0.95;
        const maxH = th * 0.92;
        
        let drawW = maxW;
        let drawH = drawW / aspect;
        
        if (drawH > maxH) {
          drawH = maxH;
          drawW = drawH * aspect;
        }

        pdf.addImage(
          imgData, 
          'PNG', 
          tx + (tw - drawW) / 2, 
          ty + (th - drawH) / 2, 
          drawW, 
          drawH, 
          undefined, 
          'FAST'
        );
      };

      // Draw a single Bib natively
      const drawBibNative = async (
        runner: BibRunnerData, 
        bx: number, 
        by: number, 
        bw: number, 
        bh: number, 
        qrUrl: string
      ) => {
        // 1. Background
        if (bibBgColor && bibBgColor.toLowerCase() !== '#ffffff') {
          pdf.setFillColor(bibBgColor);
          pdf.rect(bx, by, bw, bh, 'F');
        }

        // 2. Main Border
        pdf.setDrawColor(0);
        pdf.setLineWidth(bibsPerPage === 6 ? 0.4 : 0.7);
        pdf.rect(bx, by, bw, bh, 'S');

        // 3. Horizontal Line separating Top/Bottom
        const topRatio = bibsPerPage === 6 ? 0.45 : 0.42;
        const topH = bh * topRatio;
        pdf.line(bx, by + topH, bx + bw, by + topH);

        // 4. Vertical Lines for 3 columns
        const colW = bw / 3;
        pdf.line(bx + colW, by, bx + colW, by + topH);
        pdf.line(bx + 2 * colW, by, bx + 2 * colW, by + topH);

        // 5. Horizontal sub-lines for info rows (4 rows)
        const rowH = topH / 4;
        for (let i = 1; i < 4; i++) {
          pdf.line(bx, by + i * rowH, bx + colW, by + i * rowH);
          pdf.line(bx + 2 * colW, by + i * rowH, bx + bw, by + i * rowH);
        }

        // 6. QR Code (Native high-res) with qrScale
        if (qrUrl) {
          const qPad = 1.5;
          const maxQSize = Math.min(colW, topH) - qPad * 2;
          const qSize = maxQSize * Math.min(1.2, Math.max(0.6, qrScale));
          
          pdf.addImage(
            qrUrl, 
            'PNG', 
            bx + colW + (colW - qSize) / 2, 
            by + (topH - qSize) / 2, 
            qSize, 
            qSize, 
            undefined, 
            'FAST'
          );
        }

        // 7. Arabic Text Information (Table content) with textScale
        const baseFSize = bibsPerPage === 6 ? 2.6 : (bibsPerPage === 2 ? 3.8 : 5.2);
        const fSize = baseFSize * textScale;
        
        // RIGHT COLUMN (Category, Date, Gender, Directorate)
        await drawStyledText(runner.categoryLabel, bx + 2 * colW, by, colW, rowH, fSize);
        await drawStyledText(runner.birthDate || String(runner.birthYear), bx + 2 * colW, by + rowH, colW, rowH, fSize);
        await drawStyledText(runner.genderLabel, bx + 2 * colW, by + 2 * rowH, colW, rowH, fSize);
        await drawStyledText(runner.directorateName, bx + 2 * colW, by + 3 * rowH, colW, rowH, fSize);

        // LEFT COLUMN (Name, Massar, School, Directorate)
        await drawStyledText(runner.fullName, bx, by, colW, rowH, fSize);
        await drawStyledText(runner.massarNumber, bx, by + rowH, colW, rowH, fSize);
        await drawStyledText(runner.schoolName, bx, by + 2 * rowH, colW, rowH, fSize);
        await drawStyledText(runner.directorateName, bx, by + 3 * rowH, colW, rowH, fSize);

        // 8. Bib Number (Bottom Large) - Unconstrained, huge size for maximum legibility
        const bibStr = String(runner.bibNumber);
        const bibFontSize = (bibsPerPage === 6 ? 82 : (bibsPerPage === 2 ? 140 : 220)) * bibNumberScale;
        const bottomAreaH = bh - topH;
        
        // Map bibFont to browser-compatible font families for the canvas rendering
        const fontFamily = bibFont === 'mono' ? 'monospace' : (bibFont === 'serif' ? 'serif' : 'sans-serif');
        const fontWeight = bibFont === 'sans' ? '900' : 'bold'; // 900 for font-black parity

        await drawStyledText(
          bibStr, 
          bx, 
          by + topH, 
          bw, 
          bottomAreaH, 
          bibFontSize, 
          fontWeight,
          fontFamily
        );
      };

      // Pre-generate all QR codes concurrently in parallel (10x faster)
      const allQrs: Record<string, string> = { ...qrCodeMap };
      const missingRunners = filteredRunners.filter(r => !allQrs[r.id]);
      if (missingRunners.length > 0) {
        await Promise.all(
          missingRunners.map(async (runner) => {
            const qrPayload = String(runner.bibNumber || runner.id || '').trim();
            try {
              allQrs[runner.id] = await QRCode.toDataURL(qrPayload, {
                width: 280, // 280 is sharp and generates 3x faster than 400
                margin: 1,
                errorCorrectionLevel: 'M'
              });
            } catch (e) {
              console.error(e);
            }
          })
        );
        setQrCodeMap(prev => ({ ...prev, ...allQrs }));
      }

      // Organize runners by race if requested
      const activeDefs = CROSS_COUNTRY_CATEGORIES.filter(c => selectedRaces.includes(c.id));
      const raceGroups: { catDef: CrossCountryCategoryDef; runners: BibRunnerData[] }[] = [];

      if (separatePagesPerRace && activeDefs.length > 1) {
        activeDefs.forEach(catDef => {
          const rList = filteredRunners.filter(r =>
            r.category === catDef.id ||
            (r.categoryLabel.includes(catDef.titleAr.replace('سباق ', '')) && r.gender === catDef.gender) ||
            (r.category.toUpperCase() === catDef.category.toUpperCase() && r.gender.toLowerCase() === catDef.gender.toLowerCase())
          );
          if (rList.length > 0) {
            raceGroups.push({ catDef, runners: rList });
          }
        });
      } else {
        raceGroups.push({
          catDef: activeDefs[0] || CROSS_COUNTRY_CATEGORIES[0],
          runners: filteredRunners
        });
      }

      let isFirstPage = true;

      for (const group of raceGroups) {
        const groupRunners = group.runners;
        const perPage = bibsPerPage;
        const totalPages = Math.ceil(groupRunners.length / perPage);

        for (let pIdx = 0; pIdx < totalPages; pIdx++) {
          if (!isFirstPage) pdf.addPage();
          isFirstPage = false;

          const runnersOnPage = groupRunners.slice(pIdx * perPage, (pIdx + 1) * perPage);

          for (let bIdx = 0; bIdx < runnersOnPage.length; bIdx++) {
            const runner = runnersOnPage[bIdx];
            const qrUrl = allQrs[runner.id];

            // Calculate exact position on A4 sheet
            if (bibsPerPage === 1) {
              const margin = 10;
              const bw = pageWidth - margin * 2;
              const bh = pageHeight - margin * 2;
              await drawBibNative(runner, margin, margin, bw, bh, qrUrl);
            } else if (bibsPerPage === 2) {
              const margin = 10;
              const bw = pageWidth - margin * 2;
              const bh = (pageHeight - margin * 3) / 2;
              const by = margin + bIdx * (bh + margin);
              await drawBibNative(runner, margin, by, bw, bh, qrUrl);
              
              // Cut line
              if (bIdx === 0 && runnersOnPage.length > 1) {
                pdf.setDrawColor(200);
                pdf.setLineWidth(0.2);
                pdf.setLineDashPattern([2, 2], 0);
                pdf.line(5, by + bh + margin / 2, pageWidth - 5, by + bh + margin / 2);
                pdf.setLineDashPattern([], 0);
              }
            } else {
              // 6 per page (2x3)
              const mx = 8;
              const my = 8;
              const gx = 4;
              const gy = 4;
              const bw = (pageWidth - mx * 2 - gx) / 2;
              const bh = (pageHeight - my * 2 - gy * 2) / 3;
              
              const col = bIdx % 2;
              const row = Math.floor(bIdx / 2);
              const bx = mx + col * (bw + gx);
              const by = my + row * (bh + gy);
              
              await drawBibNative(runner, bx, by, bw, bh, qrUrl);

              // Cut lines
              pdf.setDrawColor(220);
              pdf.setLineWidth(0.1);
              pdf.setLineDashPattern([1, 1], 0);
              if (bIdx === 0) {
                pdf.line(pageWidth / 2, my, pageWidth / 2, pageHeight - my);
                pdf.line(mx, my + bh + gy / 2, pageWidth - mx, my + bh + gy / 2);
                pdf.line(mx, my + 2 * (bh + gy) - gy / 2, pageWidth - mx, my + 2 * (bh + gy) - gy / 2);
              }
              pdf.setLineDashPattern([], 0);
            }
          }
        }
      }

      const layoutLabel = bibsPerPage === 1 ? 'A4' : (bibsPerPage === 6 ? 'اقتصادي' : 'A5');
      const fileName = `صدريات_العدو_الريفي_${layoutLabel}_${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(fileName);

      toast.dismiss(toastId);
      toast.success(`تم استخراج وتحميل الملف بنجاح!`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء إنشاء ملف PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Direct Print Dialog with pure native text
  const handleDirectPrint = () => {
    handleFastTextDownloadOrPrint();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto" dir="rtl">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Top Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center text-base shadow-xs">
              <Eye className="w-4 h-4" />
            </div>
            <h3 className="text-base font-black text-white">إنشاء الصدريات (PDF)</h3>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer"
            title="إغلاق"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50 space-y-5">
          
          {/* Top Control Card */}
          <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
            
            {/* Section A: Multi-Race Selection Grid (تحديد سباقات العدو الريفي - كل سباق على حدا) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Filter className="w-3.5 h-3.5" />
                  </div>
                  <label className="text-xs font-black text-slate-800">
                    سباقات العدو الريفي (كل سباق على حدا مع إمكانية تحديد أكثر من سباق):
                  </label>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {selectedRaces.length === CROSS_COUNTRY_CATEGORIES.length 
                      ? 'جميع السباقات (8)' 
                      : `${selectedRaces.length} من 8 سباقات`}
                  </span>
                </div>

                {/* Quick Selection Actions */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <button
                    type="button"
                    onClick={selectAllRaces}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-all cursor-pointer"
                  >
                    تحديد الكل
                  </button>
                  <button
                    type="button"
                    onClick={selectMaleRaces}
                    className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold transition-all cursor-pointer"
                  >
                    الذكور فقط
                  </button>
                  <button
                    type="button"
                    onClick={selectFemaleRaces}
                    className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold transition-all cursor-pointer"
                  >
                    الإناث فقط
                  </button>
                  <button
                    type="button"
                    onClick={deselectAllRaces}
                    className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 font-bold transition-all cursor-pointer"
                  >
                    إلغاء التحديد
                  </button>
                </div>
              </div>

              {/* 8 Race Cards / Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CROSS_COUNTRY_CATEGORIES.map(cat => {
                  const isSelected = selectedRaces.includes(cat.id);
                  const count = raceCounts[cat.id] || 0;
                  const isFemale = cat.gender === 'Female';

                  return (
                    <div
                      key={cat.id}
                      onClick={() => toggleRace(cat.id)}
                      className={`relative p-2.5 rounded-xl border transition-all cursor-pointer select-none text-right flex flex-col justify-between gap-1.5 ${
                        isSelected
                          ? isFemale
                            ? 'bg-rose-50/70 border-rose-400 ring-1 ring-rose-400/40 shadow-xs'
                            : 'bg-blue-50/70 border-blue-400 ring-1 ring-blue-400/40 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50 opacity-70 hover:opacity-100'
                      }`}
                    >
                      {/* Top Row: Checkbox + Distance + Solo Button */}
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-all ${
                            isSelected
                              ? isFemale ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white'
                              : 'border border-slate-300 bg-white'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <span className="text-[10px] font-black text-slate-700 font-mono">
                            {cat.distance}
                          </span>
                        </div>

                        {/* Quick Solo Select button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectSingleRace(cat.id);
                          }}
                          className="text-[9px] px-1.5 py-0.5 rounded-md bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold shadow-2xs"
                          title="تحديد هذا السباق وحده فقط"
                        >
                          فقط
                        </button>
                      </div>

                      {/* Race Title */}
                      <div>
                        <div className="text-xs font-black text-slate-900 leading-tight">
                          {cat.titleAr}
                        </div>
                        <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
                          {cat.shortLabel} • المسافة: {cat.distance}
                        </div>
                      </div>

                      {/* Bottom Row: Runner Count Badge + Gender Pill */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px]">
                        <span className={`font-bold px-1.5 py-0.2 rounded-sm ${
                          isFemale ? 'bg-rose-100/70 text-rose-800' : 'bg-blue-100/70 text-blue-800'
                        }`}>
                          {cat.gender === 'Female' ? 'إناث' : 'ذكور'}
                        </span>
                        <span className={`font-extrabold font-mono ${count > 0 ? 'text-slate-900' : 'text-slate-400'}`}>
                          {count} مشارك
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedRaces.length === 0 && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold text-center">
                  ⚠️ تنبيه: لم تقم بتحديد أي سباق. الرجاء تحديد سباق واحد على الأقل لتوليد وطباعة الصدريات.
                </div>
              )}
            </div>

            {/* Section B: Secondary Filters & Layout & Race Page Separation */}
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3">
              
              {/* Search filter (name, massar, school, bib) */}
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-1.5">
                  <Search className="w-3.5 h-3.5 text-slate-600" />
                  <span>بحث سريع بالاسم / مسار / رقم الصدرية</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم، رقم مسار، المؤسسة..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all pl-8"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Gender Filter */}
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-indigo-600" />
                  <span>تصفية حسب الجنس</span>
                </label>
                <select
                  value={selectedGender}
                  onChange={(e) => setSelectedGender(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                  <option value="ALL">جميع الأجناس ({genderCounts.ALL})</option>
                  <option value="Male">ذكور ({genderCounts.Male})</option>
                  <option value="Female">إناث ({genderCounts.Female})</option>
                </select>
              </div>

              {/* Affiliation Filter */}
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>تصفية حسب الانتماء للأندية</span>
                </label>
                <select
                  value={selectedAffiliation}
                  onChange={(e) => setSelectedAffiliation(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                >
                  <option value="ALL">جميع الفئات ({affiliationCounts.ALL})</option>
                  <option value="club_affiliated">منتمي للأندية ({affiliationCounts.club_affiliated})</option>
                  <option value="non_club">غير منتمي للأندية ({affiliationCounts.non_club})</option>
                </select>
              </div>

              {/* Page Layout Selector (2 vs 6 bibs) */}
              <div>
                <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 mb-1.5">
                  <Grid2X2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تخطيط الصفحة (عدد الصدريات)</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setBibsPerPage(1)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      bibsPerPage === 1
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>A4 (واحدة)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBibsPerPage(2)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      bibsPerPage === 2
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>A5 (اثنتان)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setBibsPerPage(6)}
                    className={`px-2 py-1.5 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      bibsPerPage === 6
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    <Grid2X2 className="w-3.5 h-3.5" />
                    <span>اقتصادي (6)</span>
                  </button>
                </div>
              </div>

            </div>

            {/* Per-Race Page Separation Option */}
            {selectedRaces.length > 1 && (
              <div className="pt-2 px-1 flex items-center justify-between flex-wrap gap-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer select-none text-slate-800 font-bold">
                  <input
                    type="checkbox"
                    checked={separatePagesPerRace}
                    onChange={(e) => setSeparatePagesPerRace(e.target.checked)}
                    className="w-4 h-4 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>بدء كل سباق في صفحة مستقلة جديدة في ملف PDF (تنظيم كل سباق على حدا)</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  {separatePagesPerRace ? 'مفعل: لا تختلط صدريات السباقات في نفس الصفحة' : 'غير مفعل: تعبئة متواصلة للصفحات'}
                </span>
              </div>
            )}

            {/* Row 2: Visual Customization with Range Sliders (أشرطة إزاحة لتغيير الأحجام بدقة وتكييفها حسب الفراغ) */}
            <div className="pt-3 border-t border-slate-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>تعديل المقاسات والخطوط (أشرطة إزاحة لتكييف الأحجام مع الفراغ المتاح):</span>
                </span>
                {(qrScale !== 1.0 || bibNumberScale !== 1.0 || textScale !== 1.0 || bibBgColor !== '#FFFFFF' || bibFont !== 'mono') && (
                  <button
                    type="button"
                    onClick={() => {
                      setQrScale(1.0);
                      setBibNumberScale(1.0);
                      setTextScale(1.0);
                      setBibFont('mono');
                      setBibBgColor('#FFFFFF');
                    }}
                    className="text-[10px] font-bold text-slate-500 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors"
                    title="إعادة ضبط كافة المقاسات والألوان إلى الوضع الافتراضي"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة الضبط الافتراضي</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-200/70">
                
                {/* Customization 1: Slider for QR Code Size (شريط حجم كود المسح) */}
                <div className="space-y-2 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                      <QrCode className="w-3.5 h-3.5 text-amber-600" />
                      <span>حجم كود المسح (QR):</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200 font-mono">
                        {Math.round(qrScale * 100)}%
                      </span>
                      {qrScale !== 1.0 && (
                        <button
                          type="button"
                          onClick={() => setQrScale(1.0)}
                          className="text-slate-400 hover:text-amber-600 p-0.5 rounded cursor-pointer transition-colors"
                          title="إعادة للحجم الافتراضي 100%"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Range Slider for QR */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="0.5"
                      max="1.6"
                      step="0.05"
                      value={qrScale}
                      onChange={(e) => setQrScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600 focus:outline-hidden"
                      title={`حجم كود المسح الحالي: ${Math.round(qrScale * 100)}%`}
                    />
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono px-0.5">
                      <span>50%</span>
                      <button 
                        type="button" 
                        onClick={() => setQrScale(1.0)} 
                        className="hover:text-amber-600 cursor-pointer"
                      >
                        100% (افتراضي)
                      </button>
                      <span>160%</span>
                    </div>
                  </div>
                </div>

                {/* Customization 2: Slider for Bib Number Size (شريط حجم رقم الصدرية - تكبير بدون قيود) */}
                <div className="space-y-2.5 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                      <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>حجم رقم الصدرية (تكبير بارز):</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200 font-mono">
                        {Math.round(bibNumberScale * 100)}%
                      </span>
                      {bibNumberScale !== 1.0 && (
                        <button
                          type="button"
                          onClick={() => setBibNumberScale(1.0)}
                          className="text-slate-400 hover:text-blue-600 p-0.5 rounded cursor-pointer transition-colors"
                          title="إعادة للحجم الافتراضي 100%"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Range Slider for Bib Number (up to 250%) */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="0.7"
                      max="2.5"
                      step="0.05"
                      value={bibNumberScale}
                      onChange={(e) => setBibNumberScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-hidden"
                      title={`حجم رقم الصدرية الحالي: ${Math.round(bibNumberScale * 100)}%`}
                    />
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono px-0.5">
                      <span>70%</span>
                      <button 
                        type="button" 
                        onClick={() => setBibNumberScale(1.0)} 
                        className="hover:text-blue-600 cursor-pointer"
                      >
                        100% (افتراضي)
                      </button>
                      <span>250% (عملاق)</span>
                    </div>
                  </div>

                  {/* Quick Preset Buttons for Bib Size */}
                  <div className="grid grid-cols-4 gap-1 pt-1">
                    <button
                      type="button"
                      onClick={() => setBibNumberScale(1.0)}
                      className={`py-1 px-1 text-[9px] font-black rounded-lg transition-all cursor-pointer text-center ${
                        bibNumberScale === 1.0 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      100% قياسي
                    </button>
                    <button
                      type="button"
                      onClick={() => setBibNumberScale(1.35)}
                      className={`py-1 px-1 text-[9px] font-black rounded-lg transition-all cursor-pointer text-center ${
                        bibNumberScale === 1.35 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      135% كبير
                    </button>
                    <button
                      type="button"
                      onClick={() => setBibNumberScale(1.7)}
                      className={`py-1 px-1 text-[9px] font-black rounded-lg transition-all cursor-pointer text-center ${
                        bibNumberScale === 1.7 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      170% بارز جداً
                    </button>
                    <button
                      type="button"
                      onClick={() => setBibNumberScale(2.1)}
                      className={`py-1 px-1 text-[9px] font-black rounded-lg transition-all cursor-pointer text-center ${
                        bibNumberScale === 2.1 ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      210% أقصى حجم
                    </button>
                  </div>
                </div>

                {/* Customization 3: Slider for Runner Info Text Size (شريط حجم خط البيانات والاسم والمؤسسة) */}
                <div className="space-y-2 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                      <Type className="w-3.5 h-3.5 text-emerald-600" />
                      <span>حجم خط البيانات (الاسم/المؤسسة):</span>
                    </label>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 font-mono">
                        {Math.round(textScale * 100)}%
                      </span>
                      {textScale !== 1.0 && (
                        <button
                          type="button"
                          onClick={() => setTextScale(1.0)}
                          className="text-slate-400 hover:text-emerald-600 p-0.5 rounded cursor-pointer transition-colors"
                          title="إعادة للحجم الافتراضي 100%"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Range Slider for Text Scale */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min="0.7"
                      max="1.4"
                      step="0.05"
                      value={textScale}
                      onChange={(e) => setTextScale(parseFloat(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-hidden"
                      title={`حجم خط البيانات الحالي: ${Math.round(textScale * 100)}%`}
                    />
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono px-0.5">
                      <span>70%</span>
                      <button 
                        type="button" 
                        onClick={() => setTextScale(1.0)} 
                        className="hover:text-emerald-600 cursor-pointer"
                      >
                        100% (افتراضي)
                      </button>
                      <span>140%</span>
                    </div>
                  </div>
                </div>

                {/* Customization 4: Font Family & Color (نوع الخط ولون الصدرية) */}
                <div className="space-y-2 bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-3xs">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black text-slate-800 flex items-center gap-1">
                      <PaletteIcon className="w-3.5 h-3.5 text-purple-600" />
                      <span>لون خلفية الصدرية:</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={bibBgColor}
                        onChange={(e) => setBibBgColor(e.target.value)}
                        className="w-5 h-5 rounded-md border border-slate-300 p-0 cursor-pointer bg-white"
                        title="اختر لون خلفية الصدرية"
                      />
                      {bibBgColor !== '#FFFFFF' && (
                        <button
                          type="button"
                          onClick={() => setBibBgColor('#FFFFFF')}
                          className="text-[9px] text-blue-600 hover:underline font-bold"
                          title="إعادة للأبيض"
                        >
                          أبيض
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Color Presets */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { color: '#FFFFFF', label: 'أبيض' },
                      { color: '#E0F2FE', label: 'أزرق' },
                      { color: '#DCFCE7', label: 'أخضر' },
                      { color: '#FEF9C3', label: 'أصفر' },
                      { color: '#FFE4E6', label: 'وردي' },
                      { color: '#F3E8FF', label: 'بنفسجي' },
                      { color: '#FFEDD5', label: 'برتقالي' },
                    ].map((preset) => (
                      <button
                        key={preset.color}
                        type="button"
                        onClick={() => setBibBgColor(preset.color)}
                        className={`w-5 h-5 rounded-full border border-slate-200 cursor-pointer transition-transform hover:scale-110 ${
                          bibBgColor === preset.color ? 'ring-2 ring-purple-500 ring-offset-1' : ''
                        }`}
                        style={{ backgroundColor: preset.color }}
                        title={preset.label}
                      />
                    ))}
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <label className="text-[11px] font-black text-slate-800 flex items-center gap-1 mb-1.5">
                      <Type className="w-3.5 h-3.5 text-purple-600" />
                      <span>نوع خط رقم الصدرية:</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'mono', label: 'رقمي', fontClass: 'font-mono' },
                        { id: 'sans', label: 'عصري', fontClass: 'font-sans font-black' },
                        { id: 'serif', label: 'رسمي', fontClass: 'font-serif' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setBibFont(item.id as 'mono' | 'sans' | 'serif')}
                          className={`py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer ${item.fontClass} ${
                            bibFont === item.id
                              ? 'bg-purple-600 text-white border-purple-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* Subtitle / Status text */}
            <div className="text-center text-xs font-bold text-slate-600 pt-2 border-t border-slate-100 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                <span>السباقات المحددة:</span>
                <strong className="font-mono">{selectedRaces.length}</strong>
              </span>
              <span className="text-slate-300">•</span>
              <span>مجموع الصدريات: <strong className="text-blue-600 font-black text-sm">{filteredRunners.length}</strong></span>
              <span className="text-slate-300">•</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <FileText className="w-3 h-3" />
                <span>{bibsPerPage === 6 ? '6 صدريات في الصفحة (اقتصادي)' : '2 صدريات في الصفحة (A5)'}</span>
              </span>
              <span className="text-slate-300">•</span>
              <span>عدد الصفحات المتوقعة: <strong className="font-mono text-slate-900">{Math.max(1, Math.ceil(filteredRunners.length / bibsPerPage))}</strong></span>
              {separatePagesPerRace && selectedRaces.length > 1 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 text-[11px]">
                    صفحات منفصلة لكل سباق
                  </span>
                </>
              )}
            </div>

            {/* Action Buttons Row */}
            <div className="flex items-center justify-center gap-2.5 sm:gap-3 pt-1 flex-wrap">
              {/* Primary Instant Action: Native Text / Vector Mode (تحميل وطباعة الصدريات ككتابة ونصوص نقية فائقة السرعة) */}
              <button
                type="button"
                onClick={handleFastTextDownloadOrPrint}
                disabled={isGeneratingPdf || filteredRunners.length === 0}
                className="px-5 sm:px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 active:scale-98 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50 border border-emerald-400/30"
                title="توليد وتحميل فوري ككتابة ونصوص حقيقية (Vector) بدون أي تأخير"
              >
                {isGeneratingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري التجهيز...</span>
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 text-emerald-100" />
                    <span>طباعة / حفظ كـ PDF نصوص وكتابة (فائق السرعة) ⚡</span>
                  </>
                )}
              </button>

              {/* Direct PDF File Download */}
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isGeneratingPdf || filteredRunners.length === 0}
                className="px-4 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-50"
                title="تحميل ملف PDF مباشرة إلى جهازك"
              >
                <Download className="w-4 h-4" />
                <span>تحميل ملف PDF مباشر</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 active:scale-98 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>

          </div>

          {/* Direct Live Preview Box (معاينة مباشرة) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-700">معاينة مباشرة للصفحة</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                  {bibsPerPage === 6 ? 'شبكة 6 صدريات (2×3)' : 'صدرية مزدوجة (2 في الصفحة)'}
                </span>
              </div>

              {/* Preview race tabs filter if multiple races selected */}
              {selectedRaces.length > 1 && (
                <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewRaceFilter('ALL');
                      setPreviewPage(1);
                    }}
                    className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                      previewRaceFilter === 'ALL'
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    كل السباقات المحددة ({filteredRunners.length})
                  </button>
                  {CROSS_COUNTRY_CATEGORIES.filter(c => selectedRaces.includes(c.id)).map(cat => {
                    const cnt = raceCounts[cat.id] || 0;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setPreviewRaceFilter(cat.id);
                          setPreviewPage(1);
                        }}
                        className={`px-2 py-0.5 rounded-lg font-bold transition-all cursor-pointer whitespace-nowrap ${
                          previewRaceFilter === cat.id
                            ? 'bg-blue-600 text-white shadow-2xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cat.shortLabel} ({cnt})
                      </button>
                    );
                  })}
                </div>
              )}
              
              {/* Pagination Controls */}
              {totalPreviewPages > 1 && (
                <div className="flex items-center gap-2 mr-auto sm:mr-0">
                  <button
                    onClick={() => setPreviewPage(p => Math.max(1, p - 1))}
                    disabled={previewPage === 1}
                    className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-slate-700"
                    title="الصفحة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-slate-600 font-mono">
                    صفحة {previewPage} من {totalPreviewPages}
                  </span>
                  <button
                    onClick={() => setPreviewPage(p => Math.min(totalPreviewPages, p + 1))}
                    disabled={previewPage === totalPreviewPages}
                    className="p-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 disabled:opacity-30 cursor-pointer text-slate-700"
                    title="الصفحة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* A4 Sheet Container */}
            <div 
              ref={printContainerRef}
              className="bg-slate-200/90 p-4 sm:p-6 rounded-2xl flex flex-col items-center justify-center overflow-x-auto shadow-inner"
            >
              <div 
                className={`w-full bg-white shadow-2xl p-4 sm:p-5 select-none border border-slate-300 transition-all ${
                  bibsPerPage === 6 ? 'max-w-[760px]' : (bibsPerPage === 2 ? 'max-w-[500px]' : 'max-w-[650px]')
                }`}
                style={{
                  minHeight: '620px',
                  backgroundColor: '#ffffff'
                }}
              >
                {currentPageRunners.length === 0 ? (
                  <div className="py-20 text-center text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
                    <p className="text-xs font-bold">لا يوجد مشاركون يطابقون خيارات التصفية الحالية</p>
                  </div>
                ) : bibsPerPage === 6 ? (
                  // ===============================================
                  // 🎽 PREVIEW: 6 BIBS PER PAGE (2 COLS x 3 ROWS)
                  // ===============================================
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {currentPageRunners.map((runner) => {
                      const qrUrl = qrCodeMap[runner.id];
                      const qrWidthPx = Math.round(58 * qrScale);
                      const bibNumberPx = Math.round(76 * bibNumberScale);
                      const fontClass = bibFont === 'mono' ? 'font-mono font-bold' : (bibFont === 'serif' ? 'font-serif font-bold' : 'font-sans font-black');
                      const textBaseStyle = { fontSize: `${Math.max(7, Math.round(9 * textScale))}px` };
                      const textSmallStyle = { fontSize: `${Math.max(6.5, Math.round(8.5 * textScale))}px` };

                      return (
                        <div 
                          key={runner.id}
                          className="w-full border-2 border-black flex flex-col shadow-xs relative overflow-visible rounded-xs"
                          style={{
                            backgroundColor: bibBgColor || '#ffffff',
                            minHeight: '200px'
                          }}
                        >
                          {/* TOP SECTION: 3 Columns Grid */}
                          <div className="grid grid-cols-12 border-b-2 border-black h-[88px] bg-inherit">
                            
                            {/* Left Column (3 Rows): الفئة / تاريخ الازدياد / الجنس */}
                            <div className="col-span-4 border-l border-black flex flex-col justify-between text-center font-black text-slate-900 bg-inherit divide-y border-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textBaseStyle}>
                                {runner.categoryLabel}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight" style={textBaseStyle}>
                                {runner.birthDate || runner.birthYear}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 leading-tight" style={textBaseStyle}>
                                {runner.genderLabel}
                              </div>
                            </div>

                            {/* Center Column: Crisp QR Code with controllable size via range slider */}
                            <div className="col-span-4 flex items-center justify-center p-1 bg-white border-l border-r border-black overflow-hidden">
                              {qrUrl ? (
                                <img 
                                  src={qrUrl} 
                                  alt={`QR-${runner.bibNumber}`} 
                                  style={{ 
                                    width: `${qrWidthPx}px`, 
                                    height: `${qrWidthPx}px`,
                                    maxWidth: '100%',
                                    maxHeight: '100%'
                                  }}
                                  className="object-contain transition-all"
                                />
                              ) : (
                                <div className="w-12 h-12 bg-slate-100 animate-pulse flex items-center justify-center">
                                  <QrCode className="w-6 h-6 text-slate-400" />
                                </div>
                              )}
                            </div>

                            {/* Right Column (3 Rows): الاسم الكامل / رقم مسار / المؤسسة */}
                            <div className="col-span-4 border-r border-black flex flex-col justify-between text-center font-black text-slate-900 bg-inherit divide-y border-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textBaseStyle}>
                                {runner.fullName}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight" style={textBaseStyle}>
                                {runner.massarNumber}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textSmallStyle}>
                                {runner.schoolName}
                              </div>
                            </div>

                          </div>

                          {/* BOTTOM SECTION: Prominent Massive Bib Number */}
                          <div className="flex-1 flex items-center justify-center bg-inherit py-1 overflow-visible">
                            <span 
                              className={`text-black leading-none font-black tracking-tighter ${fontClass} transition-all select-all`}
                              style={{ fontSize: `${bibNumberPx}px`, lineHeight: 0.9 }}
                            >
                              {runner.bibNumber}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : bibsPerPage === 2 ? (
                  // ===============================================
                  // 🎽 PREVIEW: 2 BIBS PER PAGE (A5 per bib)
                  // ===============================================
                  <div className="space-y-6">
                    {currentPageRunners.map((runner) => {
                      const qrUrl = qrCodeMap[runner.id];
                      const qrWidthPx = Math.round(92 * qrScale);
                      const bibNumberPx = Math.round(130 * bibNumberScale);
                      const fontClass = bibFont === 'mono' ? 'font-mono font-bold' : (bibFont === 'serif' ? 'font-serif font-bold' : 'font-sans font-black');
                      const textBaseStyle = { fontSize: `${Math.max(8, Math.round(11 * textScale))}px` };
                      const textSmallStyle = { fontSize: `${Math.max(7.5, Math.round(10 * textScale))}px` };

                      return (
                        <div 
                          key={runner.id}
                          className="w-full border-4 border-black flex flex-col shadow-xs relative overflow-visible"
                          style={{
                            backgroundColor: bibBgColor || '#ffffff',
                            height: '280px'
                          }}
                        >
                          {/* TOP SECTION: 3 Columns Grid */}
                          <div className="grid grid-cols-12 border-b-4 border-black h-[120px] bg-inherit">
                            
                            {/* Left Column (4 Rows): الفئة / تاريخ الازدياد / الجنس / الجماعة */}
                            <div className="col-span-4 border-l-2 border-black flex flex-col justify-between text-center font-black text-slate-900 bg-inherit divide-y-2 divide-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textBaseStyle}>
                                {runner.categoryLabel}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight" style={textBaseStyle}>
                                {runner.birthDate || runner.birthYear}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 leading-tight" style={textBaseStyle}>
                                {runner.genderLabel}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textSmallStyle}>
                                {runner.commune || runner.directorateName}
                              </div>
                            </div>

                            {/* Center Column: Crisp QR Code with controllable size via range slider */}
                            <div className="col-span-4 flex items-center justify-center p-1 bg-white border-l-2 border-r-2 border-black overflow-hidden">
                              {qrUrl ? (
                                <img 
                                  src={qrUrl} 
                                  alt={`QR-${runner.bibNumber}`} 
                                  style={{ 
                                    width: `${qrWidthPx}px`, 
                                    height: `${qrWidthPx}px`,
                                    maxWidth: '100%',
                                    maxHeight: '100%'
                                  }}
                                  className="object-contain transition-all"
                                />
                              ) : (
                                <div className="w-20 h-20 bg-slate-100 animate-pulse flex items-center justify-center">
                                  <QrCode className="w-8 h-8 text-slate-400" />
                                </div>
                              )}
                            </div>

                            {/* Right Column (4 Rows): الاسم الكامل / رقم مسار / المؤسسة / المديرية */}
                            <div className="col-span-4 border-r-2 border-black flex flex-col justify-between text-center font-black text-slate-900 bg-inherit divide-y-2 divide-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textBaseStyle}>
                                {runner.fullName}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight" style={textBaseStyle}>
                                {runner.massarNumber}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textSmallStyle}>
                                {runner.schoolName}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textSmallStyle}>
                                {runner.directorateName}
                              </div>
                            </div>

                          </div>

                          {/* BOTTOM SECTION: Prominent Giant Bib Number with font & size control */}
                          <div className="flex-1 flex items-center justify-center bg-inherit overflow-visible">
                            <span 
                              className={`text-black leading-none font-black tracking-tighter ${fontClass} py-1 transition-all select-all`}
                              style={{ fontSize: `${bibNumberPx}px`, lineHeight: 0.9 }}
                            >
                              {runner.bibNumber}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // ===============================================
                  // 🎽 PREVIEW: 1 BIB PER PAGE (A4 Full)
                  // ===============================================
                  <div className="space-y-6">
                    {currentPageRunners.map((runner) => {
                      const qrUrl = qrCodeMap[runner.id];
                      const qrWidthPx = Math.round(140 * qrScale);
                      const bibNumberPx = Math.round(205 * bibNumberScale);
                      const fontClass = bibFont === 'mono' ? 'font-mono font-bold' : (bibFont === 'serif' ? 'font-serif font-bold' : 'font-sans font-black');
                      const textBaseStyle = { fontSize: `${Math.max(12, Math.round(16 * textScale))}px` };
                      const textSmallStyle = { fontSize: `${Math.max(11, Math.round(14 * textScale))}px` };

                      return (
                        <div 
                          key={runner.id}
                          className="w-full border-4 border-black flex flex-col shadow-xs relative overflow-hidden"
                          style={{
                            backgroundColor: bibBgColor || '#ffffff',
                            height: '420px'
                          }}
                        >
                          {/* TOP SECTION: 3 Columns Grid */}
                          <div className="grid grid-cols-12 border-b-4 border-black h-[180px] bg-inherit">
                            
                            {/* Left Column (4 Rows) */}
                            <div className="col-span-4 border-l-2 border-black flex flex-col justify-between text-center font-black text-slate-900 bg-inherit divide-y-2 divide-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textBaseStyle}>{runner.categoryLabel}</div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight" style={textBaseStyle}>{runner.birthDate || runner.birthYear}</div>
                              <div className="flex-1 flex items-center justify-center px-1 leading-tight" style={textBaseStyle}>{runner.genderLabel}</div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textSmallStyle}>{runner.commune || runner.directorateName}</div>
                            </div>

                            {/* Center Column: QR Code */}
                            <div className="col-span-4 flex items-center justify-center p-1 bg-white border-l-2 border-r-2 border-black overflow-hidden">
                              {qrUrl && <img src={qrUrl} alt="QR" style={{ width: `${qrWidthPx}px`, height: `${qrWidthPx}px` }} className="object-contain" />}
                            </div>

                            {/* Right Column (4 Rows) */}
                            <div className="col-span-4 border-r-2 border-black flex flex-col justify-between text-center font-black text-slate-900 bg-inherit divide-y-2 divide-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textBaseStyle}>{runner.fullName}</div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight" style={textBaseStyle}>{runner.massarNumber}</div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textSmallStyle}>{runner.schoolName}</div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textSmallStyle}>{runner.directorateName}</div>
                            </div>
                          </div>

                          {/* BOTTOM SECTION: Giant Bib Number */}
                          <div className="flex-1 flex items-center justify-center bg-inherit overflow-visible py-2">
                            <span className={`text-black leading-none font-black tracking-tighter ${fontClass} transition-all select-all`} style={{ fontSize: `${bibNumberPx}px`, lineHeight: 0.9 }}>{runner.bibNumber}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
