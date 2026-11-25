import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  X, 
  Printer, 
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
  Palette as PaletteIcon,
  Trash2,
  Save,
  Lock,
  CheckCircle2,
  Building2
} from 'lucide-react';
import QRCode from 'qrcode';
import { Student, School, CrossCountryBibsStatus } from '../types';
import {
  CROSS_COUNTRY_CATEGORIES,
  CrossCountryCategoryDef,
  CrossCountryBibRunnerData,
  filterCrossCountryStudents,
  computeCrossCountrySequentialBibs
} from '../lib/crossCountryConfig';
import { DataService, schoolNamesMatch } from '../lib/dataService';
import { useAuth } from '../contexts/AuthContext';
import { printBibsAsNativeText, pregenerateQrsForBibs } from '../lib/crossCountryBibPdfService';
import toast from 'react-hot-toast';

export type BibRunnerData = CrossCountryBibRunnerData;

interface BibGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  students?: Student[];
  schools?: School[];
  directorateName?: string;
  initialCategoryId?: string;
  initialSelectedRaces?: string[];
  teacherSchoolScope?: {
    schoolId?: string;
    schoolName: string;
  };
}

export const BibGeneratorModal: React.FC<BibGeneratorModalProps> = ({
  isOpen,
  onClose,
  students: propStudents,
  schools: propSchools,
  directorateName: propDirectorateName,
  initialCategoryId,
  initialSelectedRaces,
  teacherSchoolScope
}) => {
  const { userProfile } = useAuth();
  const isTeacherLockedMode = Boolean(
    teacherSchoolScope && (teacherSchoolScope.schoolName?.trim() || teacherSchoolScope.schoolId?.trim())
  );
  const isCentralManager = Boolean(
    !isTeacherLockedMode &&
    userProfile &&
    (userProfile.role === 'CENTRAL_ADMIN' || userProfile.role === 'SUPER_ADMIN' || userProfile.isSuperAdmin)
  );
  const [students, setStudents] = useState<Student[]>(propStudents || []);
  const [schools, setSchools] = useState<School[]>(propSchools || []);
  const [directorateName, setDirectorateName] = useState<string>(propDirectorateName || 'تاوريرت');
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false);
  const [bibsPublishStatus, setBibsPublishStatus] = useState<CrossCountryBibsStatus>(() =>
    DataService.getCrossCountryBibsStatusSync()
  );

  // Cross Country Races Multi-Selection State (كل سباق على حدا مع إمكانية تحديد أكثر من سباق)
  const [selectedRaces, setSelectedRaces] = useState<string[]>(CROSS_COUNTRY_CATEGORIES.map(c => c.id));
  const [isEmptied, setIsEmptied] = useState<boolean>(false);
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
  const [isCustomizationVisible, setIsCustomizationVisible] = useState<boolean>(false);
  const hasSyncedInitialStyleRef = useRef<boolean>(false);

  // Preview Pagination
  const [previewPage, setPreviewPage] = useState<number>(1);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
  const [isSyncingBibs, setIsSyncingBibs] = useState<boolean>(false);
  const [qrCodeMap, setQrCodeMap] = useState<Record<string, string>>({});

  // Printable container ref
  const printContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isCentralManager && isCustomizationVisible) {
      setIsCustomizationVisible(false);
    }
  }, [isCentralManager, isCustomizationVisible]);

  // Allow closing via Escape key at any time
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    hasSyncedInitialStyleRef.current = false;
    const unsub = DataService.subscribeToCrossCountryBibsStatus((status) => {
      setBibsPublishStatus(status);
      if (status.styleConfig) {
        if (!isCentralManager || !hasSyncedInitialStyleRef.current) {
          hasSyncedInitialStyleRef.current = true;
          if (status.styleConfig.bibBgColor) setBibBgColor(status.styleConfig.bibBgColor);
          if (typeof status.styleConfig.qrScale === 'number') setQrScale(status.styleConfig.qrScale);
          if (typeof status.styleConfig.bibNumberScale === 'number') setBibNumberScale(status.styleConfig.bibNumberScale);
          if (typeof status.styleConfig.textScale === 'number') setTextScale(status.styleConfig.textScale);
          if (status.styleConfig.bibFont) setBibFont(status.styleConfig.bibFont);
        }
      }
    });
    return () => unsub();
  }, [isOpen, isCentralManager]);

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
          const cc = filterCrossCountryStudents(loadedStudents);
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
        const ccProp = filterCrossCountryStudents(propStudents);
        setStudents(ccProp.length > 0 ? ccProp : propStudents);
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

  // Build list of all runners sorted sequentially by category order using shared canonical helper
  // starting from 0001 continuously across categories so BibGenerator & FinishLineScanner always match 100%
  const { allRunners, raceRanges } = useMemo(() => {
    const computed = computeCrossCountrySequentialBibs(students, schools, directorateName);
    return {
      allRunners: computed.runners,
      raceRanges: computed.raceRanges
    };
  }, [students, schools, directorateName]);

  // Auto-sync sequential bib numbers silently to database whenever any runner differs from stored bibNumber (Manager only)
  const lastAutoSyncedSigRef = useRef<string>('');
  useEffect(() => {
    if (!isOpen || isLoadingData || isTeacherLockedMode || allRunners.length === 0) return;

    const studentMap = new Map<string, Student>();
    students.forEach(s => {
      if (s.id) studentMap.set(s.id, s);
    });

    const outOfSyncItems = allRunners
      .filter(r => {
        const orig = studentMap.get(r.id);
        if (!orig) return false;
        const storedBib = String(orig.bibNumber ?? (orig as any).crossCountryBibNumber ?? '').trim();
        return storedBib !== String(r.bibNumber).trim();
      })
      .map(r => ({ id: r.id, bibNumber: r.bibNumber }));

    if (outOfSyncItems.length === 0) return;

    const sig = outOfSyncItems.map(i => `${i.id}:${i.bibNumber}`).join('|');
    if (lastAutoSyncedSigRef.current === sig) return;
    lastAutoSyncedSigRef.current = sig;

    let cancelled = false;
    DataService.updateBibNumbersBulk(outOfSyncItems)
      .then(() => {
        if (cancelled) return;
        const bibById = new Map(outOfSyncItems.map(it => [it.id, String(it.bibNumber)]));
        setStudents(prev =>
          prev.map(s =>
            bibById.has(s.id)
              ? { ...s, bibNumber: bibById.get(s.id), crossCountryBibNumber: bibById.get(s.id) }
              : s
          )
        );
      })
      .catch(err => console.warn('Silent bib auto-sync skipped:', err));

    return () => {
      cancelled = true;
    };
  }, [isOpen, isLoadingData, isTeacherLockedMode, allRunners, students]);

  // Strict school isolation in teacher mode while preserving exact canonical sequential bib numbers
  const scopedRunners = useMemo(() => {
    if (!isTeacherLockedMode || !teacherSchoolScope) return allRunners;
    const targetId = String(teacherSchoolScope.schoolId || '').trim();
    const targetName = String(teacherSchoolScope.schoolName || '').trim();
    return allRunners.filter(runner => {
      if (targetId && runner.schoolId && runner.schoolId === targetId) return true;
      if (targetName && schoolNamesMatch(runner.schoolName || '', targetName)) return true;
      return false;
    });
  }, [allRunners, isTeacherLockedMode, teacherSchoolScope]);

  // Filter runners based on selected races (multi-race selection), gender, search query, and empty state
  const filteredRunners = useMemo(() => {
    if (isEmptied) return [];
    if (isTeacherLockedMode && !bibsPublishStatus.generated) return [];

    return scopedRunners.filter(runner => {
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
  }, [scopedRunners, selectedRaces, selectedGender, selectedAffiliation, searchQuery, isEmptied, isTeacherLockedMode, bibsPublishStatus.generated]);

  // Race counts for each of the 8 individual races
  const raceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    CROSS_COUNTRY_CATEGORIES.forEach(cat => {
      counts[cat.id] = scopedRunners.filter(r => {
        return (
          r.category === cat.id ||
          (r.categoryLabel.includes(cat.titleAr.replace('سباق ', '')) && r.gender === cat.gender) ||
          (r.category.toUpperCase() === cat.category.toUpperCase() && r.gender.toLowerCase() === cat.gender.toLowerCase())
        );
      }).length;
    });
    return counts;
  }, [scopedRunners]);

  // Gender counts
  const genderCounts = useMemo(() => {
    const maleCount = scopedRunners.filter(r => r.gender === 'Male').length;
    const femaleCount = scopedRunners.filter(r => r.gender === 'Female').length;
    return {
      ALL: scopedRunners.length,
      Male: maleCount,
      Female: femaleCount
    };
  }, [scopedRunners]);

  // Affiliation counts
  const affiliationCounts = useMemo(() => {
    const clubCount = scopedRunners.filter(r => r.affiliationType === 'club_affiliated').length;
    const schoolCount = scopedRunners.filter(r => r.affiliationType === 'non_club').length;
    return {
      ALL: scopedRunners.length,
      club_affiliated: clubCount,
      non_club: schoolCount
    };
  }, [scopedRunners]);

  // Toggle single race selection
  const toggleRace = (raceId: string) => {
    setIsEmptied(false);
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
    setIsEmptied(false);
    setSelectedRaces([raceId]);
    setPreviewRaceFilter('ALL');
    setPreviewPage(1);
  };

  const selectAllRaces = () => {
    setIsEmptied(false);
    setSelectedRaces(CROSS_COUNTRY_CATEGORIES.map(c => c.id));
    setPreviewPage(1);
  };

  const deselectAllRaces = () => {
    setSelectedRaces([]);
    setPreviewPage(1);
  };

  const selectMaleRaces = () => {
    setIsEmptied(false);
    setSelectedRaces(CROSS_COUNTRY_CATEGORIES.filter(c => c.gender === 'Male').map(c => c.id));
    setPreviewPage(1);
  };

  const selectFemaleRaces = () => {
    setIsEmptied(false);
    setSelectedRaces(CROSS_COUNTRY_CATEGORIES.filter(c => c.gender === 'Female').map(c => c.id));
    setPreviewPage(1);
  };

  // Function to empty / reset the bib generator app ("تفريغ تطبيق إنشاء الصدريات")
  const handleClearBibApp = () => {
    setSelectedRaces([]);
    setSearchQuery('');
    setSelectedGender('ALL');
    setSelectedAffiliation('ALL');
    setPreviewRaceFilter('ALL');
    setPreviewPage(1);
    setIsEmptied(true);
    toast.success('تم تفريغ تطبيق إنشاء الصدريات بنجاح. يمكنك الآن اختيار وتحديد السباق المراد من قاعدة البيانات.', {
      icon: '🗑️',
      duration: 4000
    });
  };

  // Function to restore / reload from database
  const handleReloadDatabase = async () => {
    setIsLoadingData(true);
    try {
      const [loadedStudents, loadedSchools, loadedDir] = await Promise.all([
        DataService.getStudents(),
        DataService.getSchools(),
        DataService.getActiveDirectorate()
      ]);
      const cc = filterCrossCountryStudents(loadedStudents);
      setStudents(cc.length > 0 ? cc : loadedStudents);
      setSchools(loadedSchools);
      if (loadedDir?.name) {
        setDirectorateName(loadedDir.shortName || loadedDir.name);
      }
      setSelectedRaces(CROSS_COUNTRY_CATEGORIES.map(c => c.id));
      setIsEmptied(false);
      setPreviewRaceFilter('ALL');
      setPreviewPage(1);
      toast.success('تمت إعادة تعبئة وتحميل كافة بيانات المشاركين من قاعدة البيانات بنجاح! 🔄');
    } catch (err) {
      console.error(err);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setIsLoadingData(false);
    }
  };

  // Function to select race from entered database ("إنشاء الصدريات حسب السباق الذي تم تحديده من قاعدة البيانات التي تم إدخالها")
  const handleSelectRaceFromDatabase = (raceId: string) => {
    if (!raceId) return;
    setIsEmptied(false);
    if (raceId === 'ALL') {
      setSelectedRaces(CROSS_COUNTRY_CATEGORIES.map(c => c.id));
      setPreviewRaceFilter('ALL');
      toast.success(`تم اختيار جميع السباقات (${allRunners.length} مشارك في قاعدة البيانات)`);
    } else {
      setSelectedRaces([raceId]);
      setPreviewRaceFilter(raceId);
      const cat = CROSS_COUNTRY_CATEGORIES.find(c => c.id === raceId);
      const count = raceCounts[raceId] || 0;
      toast.success(`تم تحديد "${cat?.titleAr || raceId}" (${count} مشارك مسجل في قاعدة البيانات)`, {
        icon: '🎯'
      });
    }
    setPreviewPage(1);
  };

  // Publish or unpublish bibs availability for teachers (Manager action)
  const markBibsGeneratedForTeachers = async (generated = true, silent = true) => {
    if (isTeacherLockedMode) return;
    try {
      const updated = await DataService.setCrossCountryBibsStatus({
        generated,
        totalCount: allRunners.length,
        generatedBy: userProfile?.fullName || 'المسير',
        ...(isCentralManager
          ? {
              styleConfig: {
                bibBgColor,
                qrScale,
                bibNumberScale,
                textScale,
                bibFont
              }
            }
          : {})
      });
      setBibsPublishStatus(updated);
      if (!silent) {
        toast.success(
          generated
            ? 'تمت إتاحة الصدريات للأساتذة — يمكن لكل أستاذ الآن تحميل أو طباعة صدريات مؤسسته فقط 🎽'
            : 'تم إخفاء الصدريات عن الأساتذة مؤقتاً'
        );
      }
    } catch (err) {
      console.warn('Could not update Cross Country bibs publish status:', err);
    }
  };

  // Save / Sync assigned bib numbers to database for seamless coordination with Finish Line Scanner
  const handleSyncBibsToDatabase = async () => {
    if (isTeacherLockedMode) return;
    if (filteredRunners.length === 0) {
      toast.error('لا توجد صدريات محددة لحفظها');
      return;
    }
    setIsSyncingBibs(true);
    const toastId = toast.loading('جاري حفظ ومزامنة أرقام الصدريات في قاعدة البيانات...');
    try {
      const items = filteredRunners.map(r => ({
        id: r.id,
        bibNumber: r.bibNumber
      }));
      await DataService.updateBibNumbersBulk(items);
      await markBibsGeneratedForTeachers(true, true);
      const bibById = new Map(items.map(it => [it.id, String(it.bibNumber)]));
      setStudents(prev =>
        prev.map(s =>
          bibById.has(s.id)
            ? { ...s, bibNumber: bibById.get(s.id), crossCountryBibNumber: bibById.get(s.id) }
            : s
        )
      );
      toast.dismiss(toastId);
      toast.success(`تم حفظ ومزامنة ${items.length} رقم صدرية وإتاحتها للأساتذة حسب مؤسساتهم بنجاح 🎯`);
    } catch (e) {
      console.error(e);
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء مزامنة أرقام الصدريات');
    } finally {
      setIsSyncingBibs(false);
    }
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

  // Invalidate cached QR codes when sequential bib numbers change
  useEffect(() => {
    setQrCodeMap({});
  }, [allRunners]);

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

    // Try opening the print window synchronously during the user click gesture before any async awaits;
    // if blocked by popup blocker or sandbox iframe, printBibsAsNativeText falls back automatically to an iframe.
    let preOpenedWindow: Window | null = null;
    try {
      preOpenedWindow = window.open('', '_blank', 'width=1150,height=850');
      if (preOpenedWindow && !preOpenedWindow.closed) {
        preOpenedWindow.document.open();
        preOpenedWindow.document.write(
          '<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" /><title>جاري تجهيز الصدريات...</title></head><body style="font-family: system-ui, sans-serif; display:flex; align-items:center; justify-content:center; height:100vh; margin:0; color:#0f172a;">جاري تجهيز الصدريات للطباعة...</body></html>'
        );
        preOpenedWindow.document.close();
      }
    } catch {
      preOpenedWindow = null;
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
      const schoolTag = isTeacherLockedMode && teacherSchoolScope?.schoolName
        ? `_${teacherSchoolScope.schoolName.replace(/[\\/:*?"<>|]/g, '_').trim()}`
        : '';
      const filename = `صدريات_العدو_الريفي${schoolTag}_${layoutLabel}_${new Date().toISOString().slice(0, 10)}`;

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
      }, neededQrs, preOpenedWindow);

      if (!isTeacherLockedMode) {
        await markBibsGeneratedForTeachers(true, true);
      }

      toast.dismiss(toastId);
      toast.success('تم فتح نافذة الطباعة / الحفظ كـ PDF (كتابة ونصوص نقية) بنجاح!', {
        id: 'bib-fast-print-success',
        duration: 2200
      });
    } catch (error) {
      console.error('Error generating fast text bibs:', error);
      if (preOpenedWindow && !preOpenedWindow.closed) {
        try {
          preOpenedWindow.close();
        } catch {}
      }
      toast.dismiss(toastId);
      toast.error('حدث خطأ أثناء إعداد الصدريات للطباعة أو الحفظ');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-0 overflow-hidden"
      dir="rtl"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border-0 rounded-none shadow-2xl w-full h-[100dvh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Modal Top Header - Polished, High Contrast, Responsive (Centered on Mobile) */}
        <div className="px-3.5 sm:px-6 py-2.5 sm:py-4 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white flex flex-col sm:flex-row items-center sm:justify-between gap-2.5 sm:gap-4 border-b border-slate-800 shrink-0 shadow-md">
          {/* Main Title - Centered & Compact on Mobile */}
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-right w-full sm:w-auto">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center text-sm sm:text-lg shadow-inner shrink-0">
                🎽
              </div>
              <h3 className="text-xs sm:text-base font-black text-white tracking-wide">
                {isTeacherLockedMode ? `صدريات مؤسستي — العدو الريفي (${teacherSchoolScope?.schoolName || ''})` : 'إعداد وإنشاء صدريات العدو الريفي'}
              </h3>
              <span className="hidden sm:inline-block text-[9px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                {isTeacherLockedMode
                  ? (!bibsPublishStatus.generated ? 'في انتظار التوليد' : `${filteredRunners.length} صدرية لمؤسستك`)
                  : (isEmptied ? 'التطبيق مفرغ' : `${filteredRunners.length} صدرية جاهزة`)}
              </span>
            </div>
            {/* Details subtitle: Hidden on mobile */}
            <p className="hidden sm:block text-[10px] sm:text-xs text-slate-300 font-medium">
              {isTeacherLockedMode
                ? 'تحميل وطباعة صدريات المتعلمين المسجلين بمؤسستك فقط بأرقامهم الرسمية المعتمدة'
                : 'توليد وطباعة بطاقات الصدريات بدقة عالية ومطابقة للمواصفات الرسمية'}
            </p>
          </div>

          {/* Action Buttons: Centered Underneath on Mobile, Row on Desktop */}
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto shrink-0">
            {!isTeacherLockedMode && (
              <>
                {/* Toggle Availability for Teachers */}
                <button
                  type="button"
                  onClick={() => markBibsGeneratedForTeachers(!bibsPublishStatus.generated, false)}
                  className={`p-2 sm:px-3 sm:py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs active:scale-95 border ${
                    bibsPublishStatus.generated
                      ? 'bg-sky-600/85 hover:bg-sky-600 text-white border-sky-400/50'
                      : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border-amber-400/40'
                  }`}
                  title={
                    bibsPublishStatus.generated
                      ? 'الصدريات متاحة حالياً للأساتذة لتحميل صدريات مؤسساتهم — انقر لإيقاف الإتاحة'
                      : 'انقر لإتاحة الصدريات للأساتذة ليتمكن كل أستاذ من تحميل صدريات مؤسسته فقط'
                  }
                >
                  {bibsPublishStatus.generated ? (
                    <>
                      <CheckCircle2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-sky-100" />
                      <span className="hidden lg:inline">متاحة للأساتذة ✓</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-amber-300" />
                      <span className="hidden lg:inline">نشر للأساتذة</span>
                    </>
                  )}
                </button>

                {/* Sync with Scanner button */}
                <button
                  type="button"
                  onClick={handleSyncBibsToDatabase}
                  disabled={isSyncingBibs || filteredRunners.length === 0}
                  className="p-2 sm:px-3 sm:py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white border border-emerald-400/40 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs active:scale-95 disabled:opacity-40"
                  title="مزامنة وحفظ أرقام الصدريات في قاعدة البيانات للماسح وإتاحتها للأساتذة"
                  aria-label="مزامنة مع الماسح"
                >
                  <Save className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-200" />
                  <span className="hidden md:inline">{isSyncingBibs ? 'جاري المزامنة...' : 'مزامنة مع الماسح 💾'}</span>
                </button>

                {/* Reload Database button */}
                <button
                  type="button"
                  onClick={handleReloadDatabase}
                  className="p-2 sm:px-3 sm:py-2 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white border border-white/20 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-3xs active:scale-95"
                  title="إعادة تعبئة وتحميل كافة بيانات المشاركين من قاعدة البيانات"
                  aria-label="إعادة تعبئة البيانات"
                >
                  <RotateCcw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                  <span className="hidden md:inline">إعادة تعبئة 🔄</span>
                </button>

                {/* Clear Bib App Button - ICON ONLY without text as requested */}
                <button
                  type="button"
                  onClick={handleClearBibApp}
                  className="p-2 sm:p-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-400/40 rounded-xl transition-all cursor-pointer shadow-3xs active:scale-95"
                  title="تفريغ تطبيق إنشاء الصدريات وإلغاء أي تحديد سابق"
                  aria-label="تفريغ تطبيق إنشاء الصدريات"
                >
                  <Trash2 className="w-4 h-4 text-rose-300" />
                </button>
              </>
            )}

            {/* Close Modal button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 sm:p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title="إغلاق"
              aria-label="إغلاق"
            >
              <X className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body Container */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-50 space-y-4">

          {isTeacherLockedMode && !bibsPublishStatus.generated ? (
            <div className="bg-white border border-amber-200 rounded-2xl p-8 sm:p-12 text-center max-w-xl mx-auto my-8 shadow-sm space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                <Lock className="w-8 h-8" />
              </div>
              <h4 className="text-base sm:text-lg font-black text-slate-900">
                الصدريات غير متاحة للتحميل بعد
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-medium">
                لم يقم مسير البطولة بتوليد ونشر صدريات البطولة الإقليمية المدرسية للعدو الريفي بعد. ستتمكن فور توليدها من تحميل أو طبع صدريات مؤسسة <strong className="text-slate-900">{teacherSchoolScope?.schoolName}</strong> فقط في ملف PDF.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          ) : (
            <>
          {/* Teacher School Isolation Notice */}
          {isTeacherLockedMode && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2.5 text-emerald-950">
                <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-black">
                    ملف صدريات خاص بمؤسسة: {teacherSchoolScope?.schoolName}
                  </div>
                  <div className="text-[11px] font-semibold text-emerald-800">
                    يتضمن هذا الملف فقط التلاميذ المسجلين بمؤسستكم بأرقامهم التسلسلية الرسمية المعتمدة من طرف المسير.
                  </div>
                </div>
              </div>
              <span className="text-xs font-black px-3 py-1 rounded-xl bg-white border border-emerald-200 text-emerald-800">
                {scopedRunners.length} صدرية خاصة بمؤسستك
              </span>
            </div>
          )}

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

                      {/* Bottom Row: Runner Count Badge + Bib Range + Gender Pill */}
                      <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-[10px] gap-1">
                        <span className={`font-bold px-1.5 py-0.2 rounded-sm ${
                          isFemale ? 'bg-rose-100/70 text-rose-800' : 'bg-blue-100/70 text-blue-800'
                        }`}>
                          {cat.gender === 'Female' ? 'إناث' : 'ذكور'}
                        </span>
                        {!isTeacherLockedMode && raceRanges[cat.id] && (
                          <span className="font-mono font-black text-[9.5px] px-1.5 py-0.2 rounded bg-white/90 border border-slate-300/70 text-slate-800" dir="ltr">
                            {raceRanges[cat.id].start} - {raceRanges[cat.id].end}
                          </span>
                        )}
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

            {/* Row 2: Visual Customization & Sliders (خاص بالمسير المركزي فقط) */}
            {isCentralManager && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsCustomizationVisible(!isCustomizationVisible)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer border border-slate-200 dark:border-slate-700 shadow-2xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-blue-600" />
                  <span>تخصيص المقاسات والألوان والخطوط</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                    {isCustomizationVisible ? 'إخفاء ▴' : 'إظهار ▾'}
                  </span>
                </button>

                {isCustomizationVisible && (qrScale !== 1.0 || bibNumberScale !== 1.0 || textScale !== 1.0 || bibBgColor !== '#FFFFFF' || bibFont !== 'mono') && (
                  <button
                    type="button"
                    onClick={() => {
                      setQrScale(1.0);
                      setBibNumberScale(1.0);
                      setTextScale(1.0);
                      setBibFont('mono');
                      setBibBgColor('#FFFFFF');
                    }}
                    className="text-[10px] font-bold text-slate-500 hover:text-blue-700 flex items-center gap-1 cursor-pointer transition-colors bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                    title="إعادة ضبط كافة المقاسات والألوان إلى الوضع الافتراضي"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>إعادة الضبط</span>
                  </button>
                )}
              </div>

              {isCustomizationVisible && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 animate-fadeIn">
                  
                  {/* Customization 1: Slider for QR Code Size */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <QrCode className="w-3.5 h-3.5 text-amber-600" />
                        <span>حجم QR:</span>
                      </label>
                      <span className="text-[10px] font-black text-amber-700 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800 font-mono">
                        {Math.round(qrScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="1.6"
                      step="0.05"
                      value={qrScale}
                      onChange={(e) => setQrScale(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-600"
                    />
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono px-0.5">
                      <span>50%</span>
                      <button type="button" onClick={() => setQrScale(1.0)} className="hover:text-amber-600 cursor-pointer">افتراضي</button>
                      <span>160%</span>
                    </div>
                  </div>

                  {/* Customization 2: Slider for Bib Number Size */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Maximize2 className="w-3.5 h-3.5 text-blue-600" />
                        <span>حجم رقم الصدرية:</span>
                      </label>
                      <span className="text-[10px] font-black text-blue-700 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-200 dark:border-blue-800 font-mono">
                        {Math.round(bibNumberScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="2.5"
                      step="0.05"
                      value={bibNumberScale}
                      onChange={(e) => setBibNumberScale(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <div className="grid grid-cols-4 gap-1 pt-1">
                      {[
                        { val: 1.0, label: '100%' },
                        { val: 1.35, label: '135%' },
                        { val: 1.7, label: '170%' },
                        { val: 2.1, label: '210%' }
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setBibNumberScale(item.val)}
                          className={`py-0.5 text-[9px] font-black rounded border transition-all cursor-pointer text-center ${
                            bibNumberScale === item.val
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Customization 3: Slider for Runner Info Text Size */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Type className="w-3.5 h-3.5 text-emerald-600" />
                        <span>حجم خط البيانات:</span>
                      </label>
                      <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-200 dark:border-emerald-800 font-mono">
                        {Math.round(textScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.7"
                      max="1.4"
                      step="0.05"
                      value={textScale}
                      onChange={(e) => setTextScale(parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between text-[9px] font-bold text-slate-400 font-mono px-0.5 pt-1">
                      <span>70%</span>
                      <button type="button" onClick={() => setTextScale(1.0)} className="hover:text-emerald-600 cursor-pointer">افتراضي (100%)</button>
                      <span>140%</span>
                    </div>
                  </div>

                  {/* Customization 4: Font Family & Color */}
                  <div className="space-y-1.5 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-3xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <Palette className="w-3.5 h-3.5 text-purple-600" />
                        <span>اللون والخط:</span>
                      </label>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={bibBgColor}
                          onChange={(e) => setBibBgColor(e.target.value)}
                          className="w-5 h-5 rounded border border-slate-300 p-0 cursor-pointer bg-white"
                          title="اختر لون الخلفية"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {[
                        { color: '#FFFFFF', label: 'أبيض' },
                        { color: '#E0F2FE', label: 'أزرق' },
                        { color: '#DCFCE7', label: 'أخضر' },
                        { color: '#FEF9C3', label: 'أصفر' },
                        { color: '#FFE4E6', label: 'وردي' },
                      ].map((preset) => (
                        <button
                          key={preset.color}
                          type="button"
                          onClick={() => setBibBgColor(preset.color)}
                          className={`w-4 h-4 rounded-full border border-slate-300 cursor-pointer transition-transform hover:scale-110 ${
                            bibBgColor === preset.color ? 'ring-2 ring-purple-500' : ''
                          }`}
                          style={{ backgroundColor: preset.color }}
                          title={preset.label}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-3 gap-1 pt-1">
                      {[
                        { id: 'mono', label: 'رقمي' },
                        { id: 'sans', label: 'عصري' },
                        { id: 'serif', label: 'رسمي' }
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setBibFont(item.id as 'mono' | 'sans' | 'serif')}
                          className={`py-0.5 text-[9px] font-bold rounded border transition-all cursor-pointer text-center ${
                            bibFont === item.id
                              ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
            )}

            {/* Subtitle / Status text */}
            <div className="text-center text-xs font-bold text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
                <span>السباقات المحددة:</span>
                <strong className="font-mono">{selectedRaces.length}</strong>
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>مجموع الصدريات: <strong className="text-blue-600 dark:text-blue-400 font-black text-sm">{filteredRunners.length}</strong></span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                <FileText className="w-3 h-3" />
                <span>{bibsPerPage === 6 ? '6 صدريات في الصفحة (اقتصادي)' : '2 صدريات في الصفحة (A5)'}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span>عدد الصفحات المتوقعة: <strong className="font-mono text-slate-900 dark:text-slate-100">{Math.max(1, Math.ceil(filteredRunners.length / bibsPerPage))}</strong></span>
              {separatePagesPerRace && selectedRaces.length > 1 && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">•</span>
                  <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 text-[11px]">
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

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 active:scale-98 rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                إلغاء
              </button>
            </div>

          </div>

          {/* Direct Live Preview Box (معاينة مباشرة) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-2 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-700 dark:text-slate-200">معاينة مباشرة للصفحة</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300">
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
              className="light-surface-always bg-slate-200/90 p-4 sm:p-6 rounded-2xl flex flex-col items-center justify-center overflow-x-auto shadow-inner"
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
                  isEmptied ? (
                    <div className="py-20 text-center text-slate-500 space-y-3">
                      <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 text-rose-500 border border-rose-200 flex items-center justify-center text-2xl shadow-inner">
                        🗑️
                      </div>
                      <h4 className="text-base font-black text-slate-800">تطبيق إنشاء الصدريات فارغ حالياً</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        تم تفريغ التطبيق بنجاح. يمكنك الآن اختيار وتحديد السباق المراد من القائمة العلوية لتوليد صدرياته من قاعدة البيانات أو الضغط على زر إعادة التعبئة.
                      </p>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={handleReloadDatabase}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>إعادة تعبئة البيانات من قاعدة البيانات</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-20 text-center text-slate-400 space-y-2">
                      <Users className="w-12 h-12 mx-auto mb-2 opacity-40" />
                      <p className="text-xs font-bold text-slate-600">لا يوجد مشاركون يطابقون خيارات التصفية أو السباق المحدد</p>
                      <p className="text-[11px] text-slate-400">تأكد من اختيار السباق الصحيح من قاعدة البيانات أو إعادة تعيين الفلاتر</p>
                      <button
                        type="button"
                        onClick={() => { setSelectedRaces(CROSS_COUNTRY_CATEGORIES.map(c => c.id)); setSearchQuery(''); }}
                        className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all cursor-pointer"
                      >
                        عرض جميع السباقات
                      </button>
                    </div>
                  )
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
                          <div className="grid grid-cols-12 border-b-2 border-black h-[88px] bg-white text-slate-950">
                            
                            {/* Left Column (3 Rows): الفئة / تاريخ الازدياد / الجنس */}
                            <div className="col-span-4 border-l border-black flex flex-col justify-between text-center font-black text-slate-950 bg-white divide-y border-black divide-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.categoryLabel}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.birthDate || runner.birthYear}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 leading-tight text-slate-950" style={textBaseStyle}>
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
                            <div className="col-span-4 border-r border-black flex flex-col justify-between text-center font-black text-slate-950 bg-white divide-y border-black divide-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.fullName}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.massarNumber}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight text-slate-950" style={textSmallStyle}>
                                {runner.schoolName}
                              </div>
                            </div>

                          </div>

                          {/* BOTTOM SECTION: Prominent Massive Bib Number */}
                          <div className="flex-1 flex items-center justify-center bg-white text-slate-950 py-1 overflow-visible">
                            <span 
                              className={`text-slate-950 leading-none font-black tracking-tighter ${fontClass} transition-all select-all`}
                              style={{ fontSize: `${bibNumberPx}px`, lineHeight: 0.9, color: '#000000' }}
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
                          <div className="grid grid-cols-12 border-b-4 border-black h-[120px] bg-white text-slate-950">
                            
                            {/* Left Column (4 Rows): الفئة / تاريخ الازدياد / الجنس / الجماعة */}
                            <div className="col-span-4 border-l-2 border-black flex flex-col justify-between text-center font-black text-slate-950 bg-white divide-y-2 divide-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.categoryLabel}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.birthDate || runner.birthYear}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.genderLabel}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight text-slate-950" style={textSmallStyle}>
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
                            <div className="col-span-4 border-r-2 border-black flex flex-col justify-between text-center font-black text-slate-950 bg-white divide-y-2 divide-black">
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.fullName}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 font-mono leading-tight text-slate-950" style={textBaseStyle}>
                                {runner.massarNumber}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight text-slate-950" style={textSmallStyle}>
                                {runner.schoolName}
                              </div>
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight text-slate-950" style={textSmallStyle}>
                                {runner.affiliationTypeLabel || runner.directorateName}
                              </div>
                            </div>

                          </div>

                          {/* BOTTOM SECTION: Prominent Giant Bib Number with font & size control */}
                          <div className="flex-1 flex items-center justify-center bg-white text-slate-950 overflow-visible">
                            <span 
                              className={`text-slate-950 leading-none font-black tracking-tighter ${fontClass} py-1 transition-all select-all`}
                              style={{ fontSize: `${bibNumberPx}px`, lineHeight: 0.9, color: '#000000' }}
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
                              <div className="flex-1 flex items-center justify-center px-1 truncate leading-tight" style={textSmallStyle}>{runner.affiliationTypeLabel || runner.directorateName}</div>
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
          </>
          )}

        </div>
      </div>
    </div>
  );
};
