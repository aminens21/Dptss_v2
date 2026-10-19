import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Camera,
  RotateCcw,
  Play,
  Pause,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Trophy,
  Users,
  Search,
  Volume2,
  VolumeX,
  Keyboard,
  QrCode,
  Zap,
  Save,
  ArrowUp,
  ArrowDown,
  Upload,
  Sparkles,
  Check,
  Settings,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  FileSpreadsheet,
  Layers,
  Download,
  CheckSquare,
  Square,
  Loader2,
  Activity,
  Eye,
  Printer,
  Clock,
  Flag
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { CROSS_COUNTRY_CATEGORIES, CrossCountryCategoryDef, calculateTeamRankings, resolveRunnerParticipationType } from '../lib/crossCountryConfig';
import { CrossCountryCategoryResult, PodiumWinner, Student } from '../types';
import { DataService } from '../lib/dataService';

interface FinishLineScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRaceId?: string;
  initialRaceIds?: string[];
  existingResults?: Record<string, CrossCountryCategoryResult>;
  onResultsUpdated?: () => void;
}

const EMPTY_RESULTS: Record<string, CrossCountryCategoryResult> = {};

export const FinishLineScannerModal: React.FC<FinishLineScannerModalProps> = ({
  isOpen,
  onClose,
  initialRaceId = 'u15_male',
  initialRaceIds,
  existingResults = EMPTY_RESULTS,
  onResultsUpdated
}) => {
  // Phase State: 'setup' | 'running' | 'summary'
  const [phase, setPhase] = useState<'setup' | 'running' | 'summary'>('setup');

  // Multi-race selection state: array of category IDs
  const [selectedRaceIds, setSelectedRaceIds] = useState<string[]>(() => {
    if (initialRaceIds && initialRaceIds.length > 0) return initialRaceIds;
    return [initialRaceId || 'u15_male'];
  });

  // Primary focused category (for fallback or single-view references)
  const [selectedRaceId, setSelectedRaceId] = useState<string>(initialRaceId || 'u15_male');
  const activeCategory = CROSS_COUNTRY_CATEGORIES.find(c => c.id === selectedRaceId) || CROSS_COUNTRY_CATEGORIES[0];

  // Race Affiliation: non_club (مدرسي) vs club_affiliated (المنتمين للأندية)
  const [raceAffiliation, setRaceAffiliation] = useState<'non_club' | 'club_affiliated'>('non_club');

  // Active category filter tab in live arrivals view: 'ALL' or a specific category ID
  const [viewCategoryFilter, setViewCategoryFilter] = useState<string>('ALL');

  // Manual category selector for walk-in / unregistered runners during multi-race run
  const [manualCategory, setManualCategory] = useState<string>(initialRaceId || 'u15_male');

  // Category summary tab in Phase 3
  const [summaryCategoryTab, setSummaryCategoryTab] = useState<string>(initialRaceId || 'u15_male');

  const [inputMode, setInputMode] = useState<'camera' | 'manual'>('manual');
  const [manualBib, setManualBib] = useState<string>('');
  const [manualName, setManualName] = useState<string>('');
  const [manualSchool, setManualSchool] = useState<string>('');

  // Race Timer State
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Audio Beep
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Registered Students List for Lookup
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState<boolean>(true);

  // Live Arrivals Stream
  const [arrivals, setArrivals] = useState<PodiumWinner[]>([]);

  // Local cache of all CC results to show completion status icons and handle multi-race status
  const [resultsMap, setResultsMap] = useState<Record<string, CrossCountryCategoryResult>>(existingResults || {});

  // Subscribe to real-time CC results to show status icons (Green dots / Completed states)
  useEffect(() => {
    if (!isOpen) return;
    const unsubscribe = DataService.subscribeCrossCountryResults((live) => {
      if (live) setResultsMap(live);
    });
    return () => unsubscribe();
  }, [isOpen]);

  // Stable refs to eliminate stale closure bugs during live camera & barcode scanning
  const arrivalsRef = useRef<PodiumWinner[]>(arrivals);
  useEffect(() => {
    arrivalsRef.current = arrivals;
  }, [arrivals]);

  const allStudentsRef = useRef<Student[]>(allStudents);
  useEffect(() => {
    allStudentsRef.current = allStudents;
  }, [allStudents]);

  const elapsedMsRef = useRef<number>(elapsedMs);
  useEffect(() => {
    elapsedMsRef.current = elapsedMs;
  }, [elapsedMs]);

  const manualBibInputRef = useRef<HTMLInputElement | null>(null);

  // Barcode Scanner Gun Buffer (for USB / Bluetooth handheld scanners)
  const barcodeBufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  // Multi-race selection toggle helpers
  const toggleRaceSelection = (catId: string) => {
    setSelectedRaceIds(prev => {
      let next: string[];
      if (prev.includes(catId)) {
        if (prev.length <= 1) {
          toast.error('يجب الإبقاء على سباق واحد على الأقل محدد');
          return prev;
        }
        next = prev.filter(id => id !== catId);
      } else {
        next = [...prev, catId];
      }
      if (!next.includes(selectedRaceId)) {
        setSelectedRaceId(next[0]);
      }
      if (!next.includes(manualCategory)) {
        setManualCategory(next[0]);
      }
      return next;
    });
  };

  const selectSingleRace = (catId: string) => {
    setSelectedRaceIds([catId]);
    setSelectedRaceId(catId);
    setManualCategory(catId);
    setSummaryCategoryTab(catId);
  };

  const selectAllRaces = () => {
    const allIds = CROSS_COUNTRY_CATEGORIES.map(c => c.id);
    setSelectedRaceIds(allIds);
    toast.success('تم تحديد جميع السباقات الـ 8 (انطلاق مشترك مع نتائج منفصلة لكل فئة)');
  };

  const selectMaleRaces = () => {
    const maleIds = CROSS_COUNTRY_CATEGORIES.filter(c => c.gender.toLowerCase() === 'male').map(c => c.id);
    setSelectedRaceIds(maleIds);
    if (!maleIds.includes(selectedRaceId)) setSelectedRaceId(maleIds[0]);
    if (!maleIds.includes(manualCategory)) setManualCategory(maleIds[0]);
    toast.success('تم تحديد فئات الذكور (4 سباقات مشتركة مع نتائج منفصلة)');
  };

  const selectFemaleRaces = () => {
    const femaleIds = CROSS_COUNTRY_CATEGORIES.filter(c => c.gender.toLowerCase() === 'female').map(c => c.id);
    setSelectedRaceIds(femaleIds);
    if (!femaleIds.includes(selectedRaceId)) setSelectedRaceId(femaleIds[0]);
    if (!femaleIds.includes(manualCategory)) setManualCategory(femaleIds[0]);
    toast.success('تم تحديد فئات الإناث (4 سباقات مشتركة مع نتائج منفصلة)');
  };

  // Toggles for Live Arrivals View
  const [showWinningTeams, setShowWinningTeams] = useState<boolean>(true);
  const [showParticipantStats, setShowParticipantStats] = useState<boolean>(true);

  // Clear Scanner Application State & Dialog
  const [showClearModal, setShowClearModal] = useState<boolean>(false);
  const [clearScope, setClearScope] = useState<'current' | 'all_races' | 'participants' | 'everything'>('current');
  const [isClearing, setIsClearing] = useState<boolean>(false);

  // Participant Details Modal State (إجمالي المسجلين، الواصلين، المتبقي في السباق)
  type ParticipantDetailsTab = 'registered' | 'arrivals' | 'remaining';
  const [detailsModalTab, setDetailsModalTab] = useState<ParticipantDetailsTab | null>(null);
  const [detailsScope, setDetailsScope] = useState<'current_race' | 'all_races'>('current_race');
  const [detailsSearchQuery, setDetailsSearchQuery] = useState<string>('');

  // Drag and drop / file upload state
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Camera State
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = 'qr-reader-finish-line-new';
  const lastScannedBib = useRef<string | null>(null);
  const lastScanTime = useRef<number>(0);

  // Audio Beep generator via Web Audio API
  const playBeep = () => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // 880Hz A5 note
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.22);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.22);
    } catch (e) {
      console.error('Audio play error:', e);
    }
  };

  // Audio Error Tone generator via Web Audio API (low buzz warning for invalid bib or wrong category)
  const playErrorTone = () => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, audioCtx.currentTime); // 180Hz low buzz
      gain.gain.setValueAtTime(0.28, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.38);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.38);
    } catch (e) {
      console.error('Audio error tone play error:', e);
    }
  };

  // Resolve Student Category ID strictly and accurately (avoiding 'female'.includes('male'))
  const resolveStudentCategoryId = (student?: Partial<Student> | null, defaultCatId?: string): string => {
    if (!student) return defaultCatId || activeCategory.id;

    const rawCat = String(student.category || '').toLowerCase().trim();
    const rawGen = String(student.gender || '').toLowerCase().trim();

    // Exact ID already?
    if (['u12_male', 'u12_female', 'u15_male', 'u15_female', 'u18_male', 'u18_female', 'u20_male', 'u20_female'].includes(rawCat)) {
      return rawCat;
    }

    // Determine Gender STRICTLY (avoiding 'female'.includes('male'))
    const isFemale =
      rawGen === 'female' ||
      rawGen === 'f' ||
      rawGen.includes('أنثى') ||
      rawGen.includes('انثى') ||
      rawGen.includes('إناث') ||
      rawGen.includes('اناث') ||
      rawGen.includes('بنت') ||
      (rawCat.includes('برعمات') && !rawCat.includes('البراعم')) ||
      (rawCat.includes('صغيرات') && !rawCat.includes('الصغار')) ||
      (rawCat.includes('فتيات') && !rawCat.includes('الفتيان')) ||
      (rawCat.includes('شابات') && !rawCat.includes('الشبان')) ||
      rawCat.includes('female');

    const isMale = !isFemale && (
      rawGen === 'male' ||
      rawGen === 'm' ||
      rawGen.includes('ذكر') ||
      rawGen.includes('ذكور') ||
      rawGen.includes('ولد') ||
      (rawCat.includes('براعم') && !rawCat.includes('برعمات')) ||
      (rawCat.includes('صغار') && !rawCat.includes('صغيرات')) ||
      (rawCat.includes('فتيان') && !rawCat.includes('فتيات')) ||
      (rawCat.includes('شبان') && !rawCat.includes('شابات')) ||
      rawCat.includes('male')
    );

    const effectiveMale = isFemale ? false : (isMale ? true : (activeCategory.gender === 'Male'));

    if (rawCat.includes('براعم') || rawCat.includes('برعمات') || rawCat.includes('u12') || rawCat.includes('12')) {
      return effectiveMale ? 'u12_male' : 'u12_female';
    }
    if (rawCat.includes('صغار') || rawCat.includes('صغيرات') || rawCat.includes('u15') || rawCat.includes('15')) {
      return effectiveMale ? 'u15_male' : 'u15_female';
    }
    if (rawCat.includes('فتيان') || rawCat.includes('فتيات') || rawCat.includes('u18') || rawCat.includes('18')) {
      return effectiveMale ? 'u18_male' : 'u18_female';
    }
    if (rawCat.includes('شبان') || rawCat.includes('شابات') || rawCat.includes('u20') || rawCat.includes('20')) {
      return effectiveMale ? 'u20_male' : 'u20_female';
    }

    // Check birth year / date fallback (Moroccan School Sports official categories)
    let bYear: number | null = null;
    if ((student as any).birthYear && !isNaN(Number((student as any).birthYear))) {
      bYear = Number((student as any).birthYear);
    } else if (student.birthDate) {
      const match = String(student.birthDate).match(/\b(19\d\d|20\d\d)\b/);
      if (match) bYear = Number(match[1]);
    }
    if (bYear !== null) {
      if (bYear >= 2014) return effectiveMale ? 'u12_male' : 'u12_female';
      if (bYear >= 2012) return effectiveMale ? 'u15_male' : 'u15_female';
      if (bYear >= 2009) return effectiveMale ? 'u18_male' : 'u18_female';
      return effectiveMale ? 'u20_male' : 'u20_female';
    }

    const baseAge = activeCategory.id.split('_')[0] || 'u12';
    return `${baseAge}_${effectiveMale ? 'male' : 'female'}`;
  };

  // Match Excel Arabic Category/Gender names to active Category IDs
  const getCategoryFromArabic = (categoryAr: string, genderAr: string): string => {
    return resolveStudentCategoryId({ category: categoryAr, gender: genderAr as any });
  };

  // Track initial load to prevent clobbering arrivals during active scanning
  const isInitialLoadDone = useRef<boolean>(false);

  // Load Students & Existing Category Results on Mount / selectedRaceIds Change
  useEffect(() => {
    if (!isOpen) {
      isInitialLoadDone.current = false;
      return;
    }

    // Never overwrite arrivals during an active running race
    if (isInitialLoadDone.current && (phase === 'running' || arrivalsRef.current.length > 0)) {
      return;
    }

    const loadAllSelectedResults = async () => {
      try {
        const liveResults = (existingResults && Object.keys(existingResults).length > 0)
          ? existingResults 
          : await DataService.getCrossCountryResults();

        if (liveResults) {
          setResultsMap(liveResults);
        }

        const combinedArrivals: PodiumWinner[] = [];
        selectedRaceIds.forEach(catId => {
          const targetKey = raceAffiliation === 'club_affiliated' ? `${catId}_club` : catId;
          const catRes = liveResults[targetKey];
          const catDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === catId);
          if (catRes && catRes.podium && catRes.podium.length > 0) {
            catRes.podium.forEach((item, idx) => {
              combinedArrivals.push({
                ...item,
                rank: item.rank || (idx + 1),
                categoryId: item.categoryId || targetKey,
                categoryTitle: item.categoryTitle || catDef?.titleAr || catRes.titleAr,
                affiliationType: item.affiliationType || raceAffiliation
              });
            });
          }
        });

        const mappedArrivals = combinedArrivals.map((arr, i) => ({
          ...arr,
          overallRank: arr.overallRank || (i + 1),
          participationType: resolveRunnerParticipationType(arr, allStudentsRef.current)
        }));
        
        // Only set arrivals if no live arrivals have been scanned yet
        if (arrivalsRef.current.length === 0 || !isInitialLoadDone.current) {
          setArrivals(mappedArrivals);
          arrivalsRef.current = mappedArrivals;
        }
        isInitialLoadDone.current = true;
      } catch (err) {
        console.error('Error fetching cross country results in scanner modal:', err);
      }
    };

    loadAllSelectedResults();
  }, [selectedRaceIds, isOpen, raceAffiliation]);

  // Load registered students list (both cross_country and all available students)
  const fetchStudents = async () => {
    setLoadingStudents(true);
    try {
      const list = await DataService.getStudents();
      // Prioritize cross country students, but fallback to all students if no specific tag
      const ccStudents = list.filter(s => 
        !s.sportId || 
        s.sportId === 'cross_country' || 
        s.sportId === 'cross-country' || 
        s.sportId.toLowerCase().includes('cross') || 
        s.sportId.includes('عدو') ||
        s.sportId === 'athletics'
      );
      const effectiveList = ccStudents.length > 0 ? ccStudents : list;
      setAllStudents(effectiveList);
      allStudentsRef.current = effectiveList;
    } catch (err) {
      console.error('Failed to load students for finish line scanner:', err);
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStudents();
    }
  }, [isOpen]);

  // Race Stopwatch logic
  useEffect(() => {
    if (timerRunning) {
      const startTime = Date.now() - elapsedMs;
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const formatElapsedTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  // Camera QR/Barcode Scanning Effect (starts whenever camera mode is chosen and modal is open)
  useEffect(() => {
    const isCameraPhase = phase === 'setup' || phase === 'running';
    if (isOpen && isCameraPhase && inputMode === 'camera' && !cameraActive) {
      startCamera();
    } else if ((!isOpen || !isCameraPhase || inputMode !== 'camera') && cameraActive) {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, phase, inputMode]);

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (html5QrcodeRef.current) {
        await stopCamera();
      }

      // Check if target container exists in DOM before creating scanner
      const container = document.getElementById(qrRegionId);
      if (!container) {
        // Element not yet mounted, wait 150ms and retry
        setTimeout(() => {
          const isCameraPhase = phase === 'setup' || phase === 'running';
          if (isOpen && isCameraPhase && inputMode === 'camera') {
            startCamera();
          }
        }, 150);
        return;
      }

      const qrScanner = new Html5Qrcode(qrRegionId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A
        ],
        verbose: false
      });
      html5QrcodeRef.current = qrScanner;

      const scanConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const w = viewfinderWidth > 0 ? viewfinderWidth : 320;
          const h = viewfinderHeight > 0 ? viewfinderHeight : 320;
          const minEdge = Math.min(w, h);
          const size = Math.max(180, Math.floor(minEdge * 0.8));
          return { width: size, height: size };
        }
      };

      try {
        await qrScanner.start(
          { facingMode: 'environment' },
          scanConfig,
          (decodedText) => {
            handleQrScanSuccess(decodedText);
          },
          () => {}
        );
      } catch (camErr) {
        console.warn('Environment camera failed, falling back to front/default camera:', camErr);
        // Fallback for laptops/webcams where facingMode 'environment' is unavailable
        await qrScanner.start(
          { facingMode: 'user' },
          scanConfig,
          (decodedText) => {
            handleQrScanSuccess(decodedText);
          },
          () => {}
        );
      }
      setCameraActive(true);
    } catch (err: any) {
      const errStr = String(err || '');
      console.warn('[Camera Scanner] Error starting camera:', err);
      if (err?.name === 'NotAllowedError' || errStr.includes('NotAllowedError') || errStr.includes('Permission denied')) {
        setCameraError('تم رفض صلاحية الكاميرا. يرجى تفعيل إذن الكاميرا من إعدادات المتصفح عن طريق النقر على أيقونة القفل 🔒 بجانب رابط الموقع في شريط العنوان.');
      } else {
        setCameraError('لم نتمكن من تشغيل الكاميرا. يرجى التأكد من أن الكاميرا ليست قيد الاستخدام من تطبيق آخر، أو استخدم الإدخال اليدوي.');
      }
      setCameraActive(false);
    }
  };

  const stopCamera = async () => {
    if (html5QrcodeRef.current && cameraActive) {
      try {
        await html5QrcodeRef.current.stop();
        html5QrcodeRef.current.clear();
      } catch (e) {
        console.error('Error stopping camera scanner:', e);
      } finally {
        html5QrcodeRef.current = null;
        setCameraActive(false);
      }
    }
  };

  // Parse Excel File uploaded by user
  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processExcelFile(file);
  };

  const processExcelFile = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet) as any[];

        if (json.length === 0) {
          toast.error('ملف الاكسل فارغ أو غير صحيح!');
          return;
        }

        const importedList: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>> = [];

        json.forEach((row: any) => {
          const getVal = (possibleKeys: string[]) => {
            const foundKey = Object.keys(row).find(k => 
              possibleKeys.some(pk => String(k).trim().includes(pk))
            );
            return foundKey ? String(row[foundKey]).trim() : '';
          };

          const bibNum = getVal(['رقم الصدرية', 'الصدرية', 'الرقم', 'bib', 'bibNumber', 'bib_number']);
          const fullName = getVal(['الاسم الكامل', 'الاسم', 'التلميذ', 'name', 'fullName', 'full_name']);
          const massarNumber = getVal(['رقم المسار', 'مسار', 'massar', 'massarNumber', 'massar_number']);
          const birthDate = getVal(['تاريخ الازدياد', 'تاريخ الميلاد', 'تاريخ الازدياد', 'birthDate', 'birth_date', 'dateOfBirth']);
          const schoolName = getVal(['المؤسسة', 'مؤسسة', 'مدرسة', 'schoolName', 'school']);
          const teacherName = getVal(['المؤطر', 'الأستاذ', 'المدرب', 'teacher', 'coachName', 'coach']);
          const categoryAr = getVal(['الفئة', 'category']);
          const genderAr = getVal(['الجنس', 'gender']);
          const partTypeAr = getVal(['نوع المشاركة', 'المشاركة', 'participationType', 'participation']);
          const dirName = getVal(['المديرية', 'directorate']);
          const acadName = getVal(['الأكاديمية', 'academy']);

          if (!fullName) return; // Skip empty names

          const resolvedCatId = getCategoryFromArabic(categoryAr, genderAr);
          const catDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === resolvedCatId) || CROSS_COUNTRY_CATEGORIES[0];

          const genderVal: 'Male' | 'Female' = (genderAr.includes('أنثى') || genderAr.includes('إناث') || genderAr.includes('بنت') || genderAr.includes('Female')) ? 'Female' : 'Male';
          const partTypeVal: 'individual' | 'school_team' = partTypeAr.includes('فردي') ? 'individual' : 'school_team';

          importedList.push({
            fullName,
            massarNumber,
            gender: genderVal,
            birthDate: birthDate || '2015-01-15',
            category: catDef.category,
            schoolId: `sch-${schoolName.replace(/\s+/g, '_') || 'unknown'}`,
            schoolName: schoolName || 'مؤسسة غير محددة',
            sportId: 'cross_country',
            affiliationType: 'non_club',
            participationType: partTypeVal,
            distance: catDef.distance,
            coachName: teacherName || '-',
            bibNumber: bibNum,
            directorateName: dirName || 'مديرية تاوريرت',
            academyName: acadName || 'الأكاديمية الجهوية'
          } as any);
        });

        if (importedList.length === 0) {
          toast.error('لم نتمكن من العثور على حقول مطابقة في الملف. يرجى التأكد من تسميات الأعمدة.');
          return;
        }

        const newStudents = await DataService.addStudentsBulk(importedList);
        setAllStudents(prev => [...newStudents, ...prev]);
        toast.success(`تم استيراد وحفظ ${newStudents.length} عداء(ة) بنجاح في قاعدة البيانات! 📂🔥`);
      } catch (error) {
        console.error('Error importing Excel:', error);
        toast.error('حدث خطأ أثناء قراءة ملف الاكسل. يرجى التأكد من الهيكلية الصحيحة.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processExcelFile(file);
    }
  };

  // Normalize Eastern Arabic numerals (٠-٩) to standard (0-9)
  const normalizeArabicDigits = (str: string) => {
    return String(str || '').replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
  };

  // Global Barcode Scanner Listener (for USB / Bluetooth handheld scanner guns)
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      const isBibInput = target && target.getAttribute('data-bib-input') === 'true';

      const now = Date.now();
      const timeDiff = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      // When Enter is pressed
      if (e.key === 'Enter') {
        const buffer = barcodeBufferRef.current.trim();
        barcodeBufferRef.current = '';

        if (buffer.length > 0) {
          e.preventDefault();
          handleQrScanSuccess(buffer);
          return;
        }
        return;
      }

      // If user is actively typing in a non-bib input, reset buffer
      if (isInput && !isBibInput) {
        barcodeBufferRef.current = '';
        return;
      }

      // Rapid scanner gun keystrokes check (< 250ms)
      if (timeDiff > 250 && !isBibInput) {
        barcodeBufferRef.current = '';
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        barcodeBufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [isOpen, phase]);

  // Helper to extract clean bib number from any scan, barcode, QR, or text input
  const extractBibNumber = (raw: string): { bib: string; nameOverride?: string; schoolOverride?: string } => {
    if (!raw) return { bib: '' };
    let text = normalizeArabicDigits(String(raw).trim());
    // Strip zero-width chars, quotes, and whitespace
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/["']/g, '').trim();

    // 1. If it's a JSON payload (for backwards compatibility with previously generated cards)
    if (text.includes('{') && text.includes('}')) {
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          const extractedBib = normalizeArabicDigits(String(parsed.bibNumber ?? parsed.bib ?? parsed.dossard ?? parsed.number ?? parsed.id ?? '')).trim();
          if (extractedBib) {
            return {
              bib: extractedBib,
              nameOverride: parsed.fullName || parsed.name || '',
              schoolOverride: parsed.schoolName || parsed.school || ''
            };
          }
        }
      } catch (e) {
        // Fallback to text parsing
      }
    }

    // 2. If it contains a URL or query parameter like ?bib=12 or &bib=12 or &id=12
    if (text.includes('bib=') || text.includes('dossard=') || text.includes('id=')) {
      const match = text.match(/(?:bib|dossard|id)=([a-zA-Z0-9_\-]+)/i);
      if (match) {
        return { bib: match[1].trim() };
      }
    }

    // 3. If it's a URL ending in an ID or number (e.g. /runners/104 or #104)
    if (text.startsWith('http://') || text.startsWith('https://')) {
      const urlParts = text.split(/[/?#]/).filter(Boolean);
      const lastPart = urlParts[urlParts.length - 1];
      if (lastPart) {
        return { bib: lastPart.trim() };
      }
    }

    // 4. Strip common prefixes: '#', '№', 'No.', 'BIB:', 'dossard', 'صدرية', etc.
    text = text
      .replace(/^[#№]+/, '')
      .replace(/^(bib|no|n°|dossard|num|number|صدرية|رقم|الصدرية)\s*[:\-\s]*/i, '')
      .trim();

    return { bib: text };
  };

  // Process QR Code or Bib Scan
  const handleQrScanSuccess = (scannedText: string) => {
    if (!scannedText) return;
    const now = Date.now();

    // If modal is in setup phase, auto-activate race so the scan registers immediately!
    if (phase === 'setup') {
      handleStartRace(false);
    }

    // Extract the bib number from the scanned code
    const { bib, nameOverride, schoolOverride } = extractBibNumber(scannedText);
    if (!bib) {
      toast.error(`تعذر قراءة رقم الصدرية من المسح: "${scannedText.slice(0, 25)}"`, { id: 'qr-err' });
      return;
    }

    // Cooldown check 1.0s for the exact same bib number to avoid accidental double trigger
    if (lastScannedBib.current === bib && now - lastScanTime.current < 1000) {
      return;
    }
    lastScannedBib.current = bib;
    lastScanTime.current = now;

    processArrival(bib, nameOverride, schoolOverride);
  };

  // Main Logic: Record Runner Arrival & SAVE LIVE INSTANTLY
  const processArrival = async (bibInput: string, nameInput = '', schoolInput = '') => {
    // If modal was in setup phase, activate running race mode immediately
    if (phase === 'setup') {
      setPhase('running');
      setTimerRunning(true);
    }

    const { bib: cleanBib, nameOverride, schoolOverride } = extractBibNumber(bibInput);
    const finalName = nameInput.trim() || nameOverride || '';
    const finalSchool = schoolInput.trim() || schoolOverride || '';

    if (!cleanBib) {
      toast.error('يرجى إدخال أو مسح رقم الصدرية أولاً');
      return;
    }

    const currentArrivals = arrivalsRef.current;
    const bibNum = !isNaN(Number(cleanBib)) ? Number(cleanBib) : null;

    // Check if bib is already in current race arrivals list
    const existingIndex = currentArrivals.findIndex(a => {
      if (!a.bibNumber && !a.studentId) return false;
      const aBib = String(a.bibNumber || '').trim();
      if (aBib === cleanBib) return true;
      if (bibNum !== null && aBib && !isNaN(Number(aBib)) && Number(aBib) === bibNum) return true;
      if (a.studentId && a.studentId === cleanBib) return true;
      return false;
    });

    if (existingIndex !== -1) {
      playBeep();
      const existing = currentArrivals[existingIndex];
      toast.error(`رقم الصدرية #${cleanBib} (${existing.fullName}) مسجل مسبقاً في قائمة الواصلين بالمرتبة #${existingIndex + 1}!`, {
        id: `dup-${cleanBib}`,
        duration: 4000
      });
      setManualBib('');
      setTimeout(() => manualBibInputRef.current?.focus(), 50);
      return;
    }

    // Match runner in database (allStudentsRef.current)
    const studentsPool = allStudentsRef.current;
    let matchedStudent: Student | undefined;

    // 1. Prioritize runner in EXACT active race (matching category, gender, affiliation, and bib)
    matchedStudent = studentsPool.find(s => {
      const resolvedCatId = resolveStudentCategoryId(s);
      if (resolvedCatId !== activeCategory.id) return false;
      const sAff = s.affiliationType || 'non_club';
      if (sAff !== raceAffiliation) return false;
      const sBib = String(s.bibNumber ?? (s as any).crossCountryBibNumber ?? '').trim();
      if (sBib && sBib === cleanBib) return true;
      if (bibNum !== null && sBib && !isNaN(Number(sBib)) && Number(sBib) === bibNum) return true;
      return false;
    });

    // 2. Search in current active race category & gender (any affiliation)
    if (!matchedStudent) {
      matchedStudent = studentsPool.find(s => {
        const resolvedCatId = resolveStudentCategoryId(s);
        if (resolvedCatId !== activeCategory.id) return false;
        const sBib = String(s.bibNumber ?? (s as any).crossCountryBibNumber ?? '').trim();
        if (sBib && sBib === cleanBib) return true;
        if (bibNum !== null && sBib && !isNaN(Number(sBib)) && Number(sBib) === bibNum) return true;
        return false;
      });
    }

    // 3. Search across ALL students in database by bibNumber or crossCountryBibNumber
    if (!matchedStudent) {
      matchedStudent = studentsPool.find(s => {
        const sBib = String(s.bibNumber ?? (s as any).crossCountryBibNumber ?? '').trim();
        if (sBib && sBib === cleanBib) return true;
        if (bibNum !== null && sBib && !isNaN(Number(sBib)) && Number(sBib) === bibNum) return true;
        return false;
      });
    }

    // 4. If still not found, check by id (UUID)
    if (!matchedStudent) {
      matchedStudent = studentsPool.find(s => s.id === cleanBib);
    }

    // 5. Check by massarNumber
    if (!matchedStudent) {
      matchedStudent = studentsPool.find(s => s.massarNumber && s.massarNumber.trim().toUpperCase() === cleanBib.toUpperCase());
    }

    // 6. Fallback for systematic numbering generated by BibGeneratorModal (101 + index)
    if (!matchedStudent && bibNum !== null && bibNum >= 101) {
      const categoryRunners = studentsPool.filter(s => {
        const resolvedCatId = resolveStudentCategoryId(s);
        return resolvedCatId === activeCategory.id && (s.affiliationType || 'non_club') === raceAffiliation;
      });
      const systematicIdx = bibNum - 101;
      if (systematicIdx >= 0 && systematicIdx < categoryRunners.length) {
        matchedStudent = categoryRunners[systematicIdx];
      }
    }

    const nextRank = currentArrivals.length + 1;
    const currentMs = elapsedMsRef.current;
    const currentTimeStr = currentMs > 0 ? formatElapsedTime(currentMs) : (elapsedMs > 0 ? formatElapsedTime(elapsedMs) : '00:00.0');

    const studentCatId = matchedStudent 
      ? resolveStudentCategoryId(matchedStudent, manualCategory || activeCategory.id)
      : (manualCategory || activeCategory.id);

    const targetCatDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === studentCatId) || activeCategory;

    const displayBib = (matchedStudent?.bibNumber || (matchedStudent as any)?.crossCountryBibNumber)
      ? String(matchedStudent.bibNumber || (matchedStudent as any).crossCountryBibNumber)
      : cleanBib;

    // 🛑 VALIDATION 1: Check category and gender mismatch!
    if (matchedStudent) {
      const isCategoryAllowed = selectedRaceIds.includes(studentCatId);
      if (!isCategoryAllowed) {
        playErrorTone();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([300, 100, 300]); } catch (e) {}
        }
        const activeRaceTitles = selectedRaceIds
          .map(id => CROSS_COUNTRY_CATEGORIES.find(c => c.id === id)?.titleAr || id)
          .join(' أو ');
        const studentCatDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === studentCatId) || targetCatDef;
        const studentGenderLabel = studentCatId.includes('female') ? 'إناث 🚺' : 'ذكور 🚹';
        toast.error(
          `🚫 هذه الصدرية لا تنتمي لهاته الفئة!\nالصدرية #${displayBib} (${matchedStudent.fullName}) تنتمي لفئة "${studentCatDef.titleAr}" [${studentGenderLabel}]، بينما السباق الحالي مخصص لـ "${activeRaceTitles}". لا يمكن احتسابها في هذا السباق!`,
          {
            id: `cat-mismatch-${cleanBib}`,
            duration: 7000,
            icon: '⛔'
          }
        );
        setManualBib('');
        setTimeout(() => manualBibInputRef.current?.focus(), 50);
        return;
      }

      // 🛑 VALIDATION 2: Check affiliation mismatch (non_club vs club_affiliated)
      const studentAff = matchedStudent.affiliationType || 'non_club';
      if (raceAffiliation && studentAff !== raceAffiliation) {
        playErrorTone();
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate([300, 100, 300]); } catch (e) {}
        }
        const expectedAffLabel = raceAffiliation === 'club_affiliated' ? 'المنتمين للأندية 🟡' : 'غير المنتمين للأندية ⚪';
        const actualAffLabel = studentAff === 'club_affiliated' ? 'المنتمين للأندية 🟡' : 'غير المنتمين للأندية ⚪';
        toast.error(
          `🚫 خطأ في الصنف: الصدرية #${displayBib} (${matchedStudent.fullName}) مسجل في صنف "${actualAffLabel}"، بينما السباق الحالي مخصص لصنف "${expectedAffLabel}". يتنافس المنتمين لوحدهم وغير المنتمين لوحدهم ولا يمكن احتساب نتائج صنف مع صنف آخر!`,
          {
            id: `aff-mismatch-${cleanBib}`,
            duration: 7000,
            icon: '⛔'
          }
        );
        setManualBib('');
        setTimeout(() => manualBibInputRef.current?.focus(), 50);
        return;
      }
    }

    // 🛑 VALIDATION 3: Unregistered bib protection for automated / scanned input
    if (!matchedStudent && !finalName) {
      playErrorTone();
      toast.error(
        `⚠️ الصدرية #${cleanBib} غير مسجلة في قاعدة بيانات العداءين! يرجى التأكد من رقم الصدرية أو تسجيل التلميذ أو إدخال الاسم والمؤسسة يدوياً.`,
        {
          id: `not-found-${cleanBib}`,
          duration: 5000,
          icon: '❓'
        }
      );
      setManualBib('');
      setTimeout(() => manualBibInputRef.current?.focus(), 50);
      return;
    }

    const newArrival: PodiumWinner = {
      rank: nextRank,
      overallRank: nextRank,
      studentId: matchedStudent?.id || '',
      categoryId: studentCatId,
      categoryTitle: targetCatDef.titleAr,
      fullName: finalName || (matchedStudent ? matchedStudent.fullName : `عداء صدرية #${displayBib}`),
      schoolName: finalSchool || (matchedStudent ? matchedStudent.schoolName : 'مؤسسة تعليمية'),
      time: currentTimeStr,
      bibNumber: displayBib,
      participationType: resolveRunnerParticipationType(
        matchedStudent || {
          studentId: matchedStudent?.id,
          fullName: finalName,
          participationType: (matchedStudent as any)?.participationType
        },
        allStudents
      ),
      affiliationType: matchedStudent?.affiliationType || raceAffiliation,
      directorateName: matchedStudent?.directorateName || 'مديرية تاوريرت',
      academyName: matchedStudent?.academyName || 'الأكاديمية الجهوية',
      supervisorName: matchedStudent?.coachName || '-',
      notes: nextRank <= 3 ? `مؤهل(ة) للبطولة الجهوية ${nextRank === 1 ? '🥇' : nextRank === 2 ? '🥈' : '🥉'}` : ''
    };

    const updatedArrivals = [...currentArrivals, newArrival];
    arrivalsRef.current = updatedArrivals;
    setArrivals(updatedArrivals);
    playBeep();

    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([120, 60, 120]);
      } catch (e) {}
    }

    toast.success(`🏁 وصل العداء #${displayBib}: ${newArrival.fullName} (المرتبة #${nextRank})`, {
      icon: '🏃‍♂️',
      duration: 3500
    });

    // Save LIVE to database immediately
    try {
      await saveLiveResults(updatedArrivals);
    } catch (saveErr) {
      console.error('Failed to save arrival to database:', saveErr);
    }

    // Reset manual form inputs & refocus
    setManualBib('');
    setManualName('');
    setManualSchool('');
    setTimeout(() => {
      manualBibInputRef.current?.focus();
    }, 50);
  };

  // Remove Arrival Item & SAVE LIVE INSTANTLY
  const handleRemoveArrival = async (index: number) => {
    const updated = arrivalsRef.current.filter((_, i) => i !== index).map((arr, i) => ({
      ...arr,
      rank: i + 1,
      overallRank: i + 1,
      notes: (i + 1) <= 3 ? `مؤهل(ة) للبطولة الجهوية ${i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : '🥉'}` : ''
    }));
    arrivalsRef.current = updated;
    setArrivals(updated);
    toast.success('تم حذف العداء وإعادة ترتيب الواصلين');

    // Save LIVE
    await saveLiveResults(updated);
  };

  // Move Arrival Up or Down & SAVE LIVE INSTANTLY
  const handleMoveArrival = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === arrivals.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...arrivals];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    const reordered = updated.map((arr, i) => ({
      ...arr,
      rank: i + 1,
      notes: (i + 1) <= 3 ? `مؤهل(ة) للبطولة الجهوية ${i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : '🥉'}` : ''
    }));

    setArrivals(reordered);
    // Save LIVE
    await saveLiveResults(reordered);
  };

  // Save Results Live to Database for All Arrived Runners
  const [isSavingLive, setIsSavingLive] = useState<boolean>(false);
  const saveLiveResults = async (updatedArrivals: PodiumWinner[], showSuccessToast = false, statusOverride?: CrossCountryCategoryResult['status']) => {
    setIsSavingLive(true);
    try {
      const activeSeason = await DataService.getActiveSeason();

      // Determine final status
      let finalStatus: CrossCountryCategoryResult['status'] = statusOverride;
      if (!finalStatus) {
        if (phase === 'running') finalStatus = 'running';
        else if (phase === 'summary') finalStatus = 'completed';
        else finalStatus = 'setup';
      }

      const targetActiveKey = raceAffiliation === 'club_affiliated' ? `${activeCategory.id}_club` : activeCategory.id;
      const affSuffix = raceAffiliation === 'club_affiliated' ? ' (المنتمين للأندية)' : ' (مدرسي)';

      // 1. Save all arrivals for the activeCategory
      const categoryResult: CrossCountryCategoryResult = {
        categoryId: targetActiveKey,
        category: activeCategory.category,
        gender: activeCategory.gender,
        titleAr: `${activeCategory.titleAr}${affSuffix}`,
        distance: activeCategory.distance,
        seasonId: activeSeason,
        affiliationType: raceAffiliation,
        podium: updatedArrivals,
        status: finalStatus,
        updatedAt: new Date().toISOString()
      };

      await DataService.saveCrossCountryCategoryResult(categoryResult);

      // Also update local resultsMap state for instant UI feedback
      setResultsMap(prev => ({
        ...prev,
        [targetActiveKey]: categoryResult
      }));

      // 2. Also distribute to each category found in the arrivals
      const categoriesInArrivals = Array.from(new Set(updatedArrivals.map(a => a.categoryId).filter(Boolean)));
      for (const catId of categoriesInArrivals) {
        if (!catId) continue;
        const cleanBaseId = catId.replace(/_club(_affiliated)?$/, '');
        if (cleanBaseId === activeCategory.id) continue;
        const targetMultiKey = raceAffiliation === 'club_affiliated' ? `${cleanBaseId}_club` : cleanBaseId;
        const catDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === cleanBaseId);
        if (catDef) {
          const catArrivals = updatedArrivals.filter(a => (a.categoryId || '').replace(/_club(_affiliated)?$/, '') === cleanBaseId);
          if (catArrivals.length > 0) {
            const multiRes: CrossCountryCategoryResult = {
              categoryId: targetMultiKey,
              category: catDef.category,
              gender: catDef.gender,
              titleAr: `${catDef.titleAr}${affSuffix}`,
              distance: catDef.distance,
              seasonId: activeSeason,
              affiliationType: raceAffiliation,
              podium: catArrivals.map((arr, i) => ({ ...arr, rank: i + 1 })),
              status: finalStatus,
              updatedAt: new Date().toISOString()
            };
            await DataService.saveCrossCountryCategoryResult(multiRes);
            setResultsMap(prev => ({ ...prev, [targetMultiKey]: multiRes }));
          }
        }
      }

      // 4. Propagate final status to all selected race IDs
      // This ensures all categories in a multi-race run show the same status (running or completed)
      if (finalStatus === 'running' || finalStatus === 'completed') {
        for (const raceId of selectedRaceIds) {
          if (raceId === activeCategory.id) continue;
          
          const targetPropKey = raceAffiliation === 'club_affiliated' ? `${raceId}_club` : raceId;
          const catDef = CROSS_COUNTRY_CATEGORIES.find(c => c.id === raceId);
          if (catDef) {
            const catArrivals = updatedArrivals.filter(a => (a.categoryId || '').replace(/_club(_affiliated)?$/, '') === raceId);
            
            // Only update if there are actual arrivals matching this category to avoid creating false duplicates
            if (catArrivals.length > 0) {
              await DataService.saveCrossCountryCategoryResult({
                categoryId: targetPropKey,
                category: catDef.category,
                gender: catDef.gender,
                titleAr: `${catDef.titleAr}${affSuffix}`,
                distance: catDef.distance,
                seasonId: activeSeason,
                affiliationType: raceAffiliation,
                podium: catArrivals.map((arr, i) => ({ ...arr, rank: i + 1 })),
                status: finalStatus,
                updatedAt: new Date().toISOString()
              });
              // Update local resultsMap for instant feedback
              setResultsMap(prev => ({
                ...prev,
                [targetPropKey]: {
                  categoryId: targetPropKey,
                  category: catDef.category,
                  gender: catDef.gender,
                  titleAr: `${catDef.titleAr}${affSuffix}`,
                  distance: catDef.distance,
                  seasonId: activeSeason,
                  affiliationType: raceAffiliation,
                  podium: catArrivals.map((arr, i) => ({ ...arr, rank: i + 1 })),
                  status: finalStatus,
                  updatedAt: new Date().toISOString()
                }
              }));
            }
          }
        }
      }

      // 3. Backup to localStorage directly so nothing can be lost
      try {
        localStorage.setItem(`cc_scanner_arrivals_${targetActiveKey}`, JSON.stringify(updatedArrivals));
      } catch (e) {
        console.warn('Local storage backup error:', e);
      }

      if (onResultsUpdated) {
        onResultsUpdated();
      }

      if (showSuccessToast) {
        toast.success(`تم حفظ جميع المتسابقين الواصلين (${updatedArrivals.length} عداء) بنجاح في قاعدة البيانات 💾✨`);
      }
    } catch (err) {
      console.error('Failed to save category live results:', err);
      if (showSuccessToast) {
        toast.error('حدث خطأ أثناء حفظ النتائج');
      }
    } finally {
      setIsSavingLive(false);
    }
  };

  // Safe Close Handler: Always ensure all arrivals are saved before closing
  const handleSafeClose = async () => {
    if (arrivals.length > 0) {
      await saveLiveResults(arrivals);
    }
    onClose();
  };

  // Clear Scanner App Data Handler
  const handleExecuteClear = async () => {
    setIsClearing(true);
    try {
      if (clearScope === 'current') {
        // 1. Clear arrivals for the currently active category only
        setArrivals([]);
        setElapsedMs(0);
        setTimerRunning(false);
        setPhase('setup');
        const targetClearKey = raceAffiliation === 'club_affiliated' ? `${activeCategory.id}_club` : activeCategory.id;
        await DataService.clearCrossCountryCategoryResult(targetClearKey);
        if (onResultsUpdated) onResultsUpdated();
        toast.success(`تم تفريغ نتائج سباق (${activeCategory.titleAr}) وتصفير التوقيت بنجاح 🗑️`);
      } else if (clearScope === 'all_races') {
        // 2. Clear all 8 cross country races
        setArrivals([]);
        setElapsedMs(0);
        setTimerRunning(false);
        setPhase('setup');
        await DataService.clearAllCrossCountryResults();
        if (onResultsUpdated) onResultsUpdated();
        toast.success('تم تفريغ نتائج جميع سباقات العدو الريفي الـ 8 بالكامل 🔄');
      } else if (clearScope === 'participants') {
        // 3. Clear imported cross country participants (Excel)
        const removedCount = await DataService.clearCrossCountryParticipants();
        setAllStudents([]);
        toast.success(`تم تفريغ ${removedCount} عداء(ة) من لائحة المشاركين المسجلين بنجاح. يمكنك استيراد ملف جديد 📂`);
      } else if (clearScope === 'everything') {
        // 4. Factory reset: clear all 8 races + participants
        setArrivals([]);
        setElapsedMs(0);
        setTimerRunning(false);
        await DataService.clearAllCrossCountryResults();
        const removedCount = await DataService.clearCrossCountryParticipants();
        setAllStudents([]);
        setPhase('setup');
        if (onResultsUpdated) onResultsUpdated();
        toast.success(`تم تفريغ وإعادة ضبط تطبيق المسح بالكامل (كافة السباقات + ${removedCount} مشارك) بنجاح ✨`);
      }
      setShowClearModal(false);
    } catch (err) {
      console.error('Error during scanner clearing operation:', err);
      toast.error('حدث خطأ أثناء تفريغ البيانات. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsClearing(false);
    }
  };

  // Start the race officially
  const handleStartRace = async (clearExisting = false) => {
    if (clearExisting) {
      setArrivals([]);
      arrivalsRef.current = [];
      setElapsedMs(0);
      elapsedMsRef.current = 0;
    }
    setTimerRunning(true);
    setPhase('running');
    
    // Notify platform that race has started (Green Dot logic)
    await saveLiveResults(clearExisting ? [] : arrivalsRef.current, false, 'running');
    
    toast.success(`انطلق سباق (${activeCategory.titleAr})! بالتوفيق لجميع المشاركين 🏃‍♂️💨`);
  };

  // End the Race & Transition to Summary View
  const handleEndRace = async () => {
    setTimerRunning(false);
    setPhase('summary');
    await saveLiveResults(arrivals, false, 'completed');
    toast.success(`تم إنهاء السباق بنجاح! تم حفظ النتائج والترتيب النهائي للفئة 🏆`);
  };

  // Merge Save & Adopt Results in one unified action
  const handleSaveAndAdoptResults = async () => {
    if (arrivals.length === 0) {
      toast.error('لا يوجد أي واصلين مسجلين لحفظهم واعتماد نتائجهم');
      return;
    }
    setTimerRunning(false);
    setIsSavingLive(true);
    try {
      await saveLiveResults(arrivals, false, 'completed');
      setPhase('summary');
      toast.success(`تم حفظ جميع الواصلين (${arrivals.length}) واعتماد النتائج والترتيب النهائي بنجاح! 🏆💾`);
    } catch {
      toast.error('حدث خطأ أثناء حفظ واعتماد النتائج');
    } finally {
      setIsSavingLive(false);
    }
  };

  // Transition to Another Race (Resets states for another category)
  const handleTransitionToAnotherRace = () => {
    setPhase('setup');
    setArrivals([]);
    setElapsedMs(0);
    setTimerRunning(false);
  };

  // Calculate live team standings matching public results space rules:
  // 1. School teams are strictly for non-club (school) participants
  // 2. Filtered to current category / race
  // 3. Runners ranked within category (1, 2, 3...)
  // 4. Only runners with participationType === 'school_team'
  // 5. Team total points = sum of top 4 runner ranks (lowest points = 1st place)
  const liveTeamRankings = useMemo(() => {
    if (raceAffiliation === 'club_affiliated') return [];

    const targetCatId = viewCategoryFilter !== 'ALL' ? viewCategoryFilter : activeCategory.id;
    const catArrivals = arrivals.filter(a => {
      const aCatId = (a.categoryId || '').replace(/_club(_affiliated)?$/, '');
      if (viewCategoryFilter !== 'ALL') {
        return aCatId === targetCatId;
      }
      return !a.categoryId || aCatId === activeCategory.id;
    });

    const nonClubRunners = catArrivals.filter(a => {
      const s = allStudents.find(stud => stud.id === a.studentId || stud.fullName === a.fullName);
      const isClub = s?.affiliationType === 'club_affiliated' || a.affiliationType === 'club_affiliated';
      return !isClub;
    });

    const rankedNonClub = nonClubRunners.map((r) => ({
      ...r,
      participationType: resolveRunnerParticipationType(r, allStudents),
      rank: r.rank,
      overallRank: r.overallRank || r.rank
    }));

    return calculateTeamRankings(rankedNonClub, allStudents, true);
  }, [arrivals, allStudents, raceAffiliation, viewCategoryFilter, activeCategory.id]);

  // Robust matching helper to count participants for any category
  const getCategoryRunnersCount = (cat: CrossCountryCategoryDef, aff?: 'non_club' | 'club_affiliated') => {
    const targetAff = aff || raceAffiliation;
    return allStudents.filter(s => {
      const sAff = s.affiliationType || 'non_club';
      if (targetAff && sAff !== targetAff) return false;
      const resolved = resolveStudentCategoryId(s);
      return resolved === cat.id;
    }).length;
  };

  // Filter students for the selected active category
  const filteredStudentsCount = getCategoryRunnersCount(activeCategory);

  // Active Race Registered Students list (respecting category & affiliation)
  const activeRaceRegisteredStudents = useMemo(() => {
    return allStudents.filter(s => {
      const sAff = s.affiliationType || 'non_club';
      if (raceAffiliation && sAff !== raceAffiliation) return false;
      const resolved = resolveStudentCategoryId(s);
      if (selectedRaceIds.length > 1) {
        return selectedRaceIds.includes(resolved);
      }
      return resolved === activeCategory.id;
    });
  }, [allStudents, raceAffiliation, selectedRaceIds, activeCategory.id]);

  // Check if current race/category has school team participants
  const hasSchoolTeamParticipants = useMemo(() => {
    return activeRaceRegisteredStudents.some(s => s.participationType === 'school_team') ||
           arrivals.some(a => resolveRunnerParticipationType(a, allStudents) === 'school_team');
  }, [activeRaceRegisteredStudents, arrivals, allStudents]);

  // Check if a student has arrived at the finish line
  const checkIsStudentArrived = (student: Student) => {
    const sBib = String(student.bibNumber ?? (student as any).crossCountryBibNumber ?? '').trim();
    const sMassar = student.massarNumber ? student.massarNumber.trim().toUpperCase() : '';
    const sId = student.id;

    return arrivals.some(a => {
      const aBib = String(a.bibNumber || '').trim();
      if (sBib && aBib && sBib === aBib) return true;
      if (a.studentId && sId && a.studentId === sId) return true;
      if (sMassar && a.massarNumber && a.massarNumber.trim().toUpperCase() === sMassar) return true;
      return false;
    });
  };

  const getStudentArrival = (student: Student) => {
    const sBib = String(student.bibNumber ?? (student as any).crossCountryBibNumber ?? '').trim();
    const sMassar = student.massarNumber ? student.massarNumber.trim().toUpperCase() : '';
    const sId = student.id;

    return arrivals.find(a => {
      const aBib = String(a.bibNumber || '').trim();
      if (sBib && aBib && sBib === aBib) return true;
      if (a.studentId && sId && a.studentId === sId) return true;
      if (sMassar && a.massarNumber && a.massarNumber.trim().toUpperCase() === sMassar) return true;
      return false;
    });
  };

  // Active Race Remaining Students list (who haven't arrived yet)
  const activeRaceRemainingStudents = useMemo(() => {
    return activeRaceRegisteredStudents.filter(s => !checkIsStudentArrived(s));
  }, [activeRaceRegisteredStudents, arrivals]);

  // Filtered items in the Details Modal based on search query
  const detailsRegisteredFiltered = useMemo(() => {
    const baseList = detailsScope === 'current_race' ? activeRaceRegisteredStudents : allStudents;
    if (!detailsSearchQuery.trim()) return baseList;
    const q = detailsSearchQuery.toLowerCase().trim();
    return baseList.filter(s => {
      const nameMatch = (s.fullName || '').toLowerCase().includes(q);
      const bibMatch = String(s.bibNumber ?? (s as any).crossCountryBibNumber ?? '').includes(q);
      const schoolMatch = (s.schoolName || '').toLowerCase().includes(q);
      const massarMatch = (s.massarNumber || '').toLowerCase().includes(q);
      return nameMatch || bibMatch || schoolMatch || massarMatch;
    });
  }, [detailsScope, activeRaceRegisteredStudents, allStudents, detailsSearchQuery]);

  const detailsArrivalsFiltered = useMemo(() => {
    if (!detailsSearchQuery.trim()) return arrivals;
    const q = detailsSearchQuery.toLowerCase().trim();
    return arrivals.filter(a => {
      const nameMatch = (a.fullName || '').toLowerCase().includes(q);
      const bibMatch = String(a.bibNumber || '').includes(q);
      const schoolMatch = (a.schoolName || '').toLowerCase().includes(q);
      return nameMatch || bibMatch || schoolMatch;
    });
  }, [arrivals, detailsSearchQuery]);

  const detailsRemainingFiltered = useMemo(() => {
    if (!detailsSearchQuery.trim()) return activeRaceRemainingStudents;
    const q = detailsSearchQuery.toLowerCase().trim();
    return activeRaceRemainingStudents.filter(s => {
      const nameMatch = (s.fullName || '').toLowerCase().includes(q);
      const bibMatch = String(s.bibNumber ?? (s as any).crossCountryBibNumber ?? '').includes(q);
      const schoolMatch = (s.schoolName || '').toLowerCase().includes(q);
      const massarMatch = (s.massarNumber || '').toLowerCase().includes(q);
      return nameMatch || bibMatch || schoolMatch || massarMatch;
    });
  }, [activeRaceRemainingStudents, detailsSearchQuery]);

  // Export Details to Excel
  const handleExportDetailsToExcel = () => {
    const isRegistered = detailsModalTab === 'registered';
    const isArrivals = detailsModalTab === 'arrivals';
    const isRemaining = detailsModalTab === 'remaining';

    let sheetData: any[] = [];
    let fileName = '';

    if (isRegistered) {
      sheetData = detailsRegisteredFiltered.map((s, idx) => {
        const arr = getStudentArrival(s);
        const bib = s.bibNumber ?? (s as any).crossCountryBibNumber ?? '-';
        return {
          'الرقم الترتيبي': idx + 1,
          'رقم الصدرية': bib,
          'الاسم الكامل': s.fullName,
          'رقم مسار': s.massarNumber || '-',
          'المؤسسة': s.schoolName,
          'الفئة': CROSS_COUNTRY_CATEGORIES.find(c => c.id === resolveStudentCategoryId(s))?.titleAr || s.category || '-',
          'الجنس': s.gender === 'Female' ? 'أنثى' : 'ذكر',
          'نوع المشاركة': s.participationType === 'school_team' ? 'فريق مؤسسة' : 'فردي',
          'حالة الوصول': arr ? `وصل (المرتبة ${arr.rank} - توقيت ${arr.time || '-'})` : 'في الحلبة (لم يصل بعد)'
        };
      });
      fileName = `لائحة_المسجلين_${activeCategory.shortLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else if (isArrivals) {
      sheetData = detailsArrivalsFiltered.map((a, idx) => ({
        'الترتيب': a.rank || idx + 1,
        'التوقيت الرسمي': a.time || '-',
        'رقم الصدرية': a.bibNumber || '-',
        'الاسم الكامل': a.fullName,
        'المؤسسة': a.schoolName,
        'الفئة': a.categoryTitle || activeCategory.titleAr,
        'نوع المشاركة': a.participationType === 'school_team' ? 'فريق مؤسسة' : 'فردي',
        'صنف المشاركة': a.affiliationType === 'club_affiliated' ? 'منتمي لنادي' : 'مدرسي'
      }));
      fileName = `لائحة_الواصلين_${activeCategory.shortLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    } else if (isRemaining) {
      sheetData = detailsRemainingFiltered.map((s, idx) => {
        const bib = s.bibNumber ?? (s as any).crossCountryBibNumber ?? '-';
        return {
          'الرقم': idx + 1,
          'رقم الصدرية': bib,
          'الاسم الكامل': s.fullName,
          'المؤسسة': s.schoolName,
          'الفئة': activeCategory.titleAr,
          'الجنس': s.gender === 'Female' ? 'أنثى' : 'ذكر',
          'حالة السباق': 'قيد السباق (في انتظار الوصول)'
        };
      });
      fileName = `لائحة_المتبقي_في_السباق_${activeCategory.shortLabel}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    }

    if (sheetData.length === 0) {
      toast.error('لا توجد بيانات لتصديرها');
      return;
    }

    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'البيانات');
    XLSX.writeFile(wb, fileName);
    toast.success('تم تصدير ملف Excel بنجاح! 📊');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh] my-auto">
        
        {/* Modal Main Header - Centered & Responsive on Mobile */}
        <div className="bg-gradient-to-r from-emerald-800 via-teal-900 to-slate-900 dark:from-emerald-950 dark:via-teal-950 dark:to-slate-950 text-white p-2.5 sm:p-5 flex flex-col sm:flex-row items-center sm:justify-between gap-2.5 sm:gap-4 shrink-0 relative border-b border-emerald-900/50">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-right w-full sm:w-auto">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-base sm:text-2xl shrink-0 shadow-inner">
                🏁
              </div>
              <h2 className="text-xs sm:text-lg font-black tracking-tight text-white">مدير توقيت العدو الريفي</h2>
              <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-full text-[8px] sm:text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 whitespace-nowrap">
                تحديث فوري ⚡
              </span>
            </div>
            {/* Details subtitle: Hidden on mobile */}
            <p className="hidden sm:block text-[10px] sm:text-xs text-emerald-100 dark:text-emerald-200/90 mt-0.5">
              استيراد المشاركين، ضبط السباقات والتوثيق الآني للنتائج
            </p>
          </div>

          <div className="flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto shrink-0">
            {/* Quick Save All Arrivals Button */}
            {arrivals.length > 0 && (
              <button
                type="button"
                onClick={() => saveLiveResults(arrivals, true)}
                disabled={isSavingLive}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] sm:text-xs font-black transition-all shadow-md cursor-pointer active:scale-95 disabled:opacity-50 border border-emerald-400/40"
                title="حفظ جميع المتسابقين الذين عبروا خط الوصول في قاعدة البيانات"
              >
                <Save className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">حفظ الواصلين</span>
                <span className="bg-emerald-800 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold">{arrivals.length}</span>
              </button>
            )}

            {/* Clear Scanner Application button - Icon only */}
            <button
              type="button"
              onClick={() => {
                setClearScope('current');
                setShowClearModal(true);
              }}
              className="p-2 sm:p-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-200 hover:text-white border border-red-400/30 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
              title="تفريغ وإعادة ضبط بيانات تطبيق المسح"
              aria-label="تفريغ وإعادة ضبط بيانات تطبيق المسح"
            >
              <Trash2 className="w-4 h-4 text-red-400" />
            </button>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'إيقاف الصافرة' : 'تشغيل الصافرة'}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-emerald-400" /> : <VolumeX className="w-3.5 sm:w-4 h-3.5 sm:h-4 text-slate-400" />}
            </button>

            <button
              onClick={handleSafeClose}
              className="p-2 bg-white/10 hover:bg-red-500/30 text-white rounded-xl transition-colors cursor-pointer"
              title="إغلاق النافذة"
            >
              <X className="w-4 sm:w-5 h-4 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Phase 1: Setup View */}
        {phase === 'setup' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Excel Import Panel (7 cols) */}
              <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/60 p-3 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 sm:gap-2">
                    <FileSpreadsheet className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>خطوة 1: استيراد المشاركين (Excel)</span>
                  </h3>
                  <span className="text-[8px] sm:text-[10px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-extrabold px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 whitespace-nowrap">
                    نموذج معتمد
                  </span>
                </div>

                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 sm:p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center space-y-2 sm:space-y-3 ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/40'
                      : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-slate-50/50 dark:hover:bg-slate-750'
                  }`}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Upload className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div>
                    <p className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-slate-200">اسحب ملف إكسل أو اضغط للاستيراد</p>
                    <p className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-400 mt-0.5">يدعم .xlsx أو .xls</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelImport}
                    className="hidden"
                  />
                </div>

                {/* Info about column names */}
                <div className="p-2.5 sm:p-3 bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-1 text-[10px] sm:text-[11px] text-amber-900 dark:text-amber-200 hidden xs:block">
                  <p className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>الأعمدة المطلوبة:</span>
                  </p>
                  <p className="leading-relaxed opacity-80">
                    الصدرية، الاسم الكامل، مسار، تاريخ الميلاد، المؤسسة، المؤطر، الفئة، الجنس.
                  </p>
                </div>

                {/* Loaded Statistics */}
                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 shadow-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setDetailsScope('all_races');
                      setDetailsModalTab('registered');
                    }}
                    className="min-w-0 text-right hover:opacity-85 transition-opacity cursor-pointer group"
                    title="انقر لعرض لائحة المشاركين المسجلين في نافذة منبثقة"
                  >
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 block truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      إجمالي المسجلين (انقر للعرض 📋):
                    </span>
                    <span className="text-base sm:text-xl font-black text-blue-900 dark:text-blue-400 font-mono group-hover:underline">
                      {allStudents.length}
                    </span>
                  </button>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setDetailsScope('all_races');
                        setDetailsModalTab('registered');
                      }}
                      className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-lg text-xs font-bold transition-all cursor-pointer border border-blue-200 dark:border-blue-800 flex items-center gap-1 shadow-2xs"
                      title="عرض لائحة المشاركين المسجلين"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">عرض اللائحة</span>
                    </button>
                    {allStudents.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setClearScope('participants');
                          setShowClearModal(true);
                        }}
                        className="p-1.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg transition-colors cursor-pointer border border-red-200 dark:border-red-800"
                        title="تفريغ لائحة المشاركين"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    )}
                    <button
                      onClick={fetchStudents}
                      className="p-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg transition-colors cursor-pointer border border-slate-200 dark:border-slate-600"
                      title="تحديث القائمة"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Race Setup and Category Selection Panel (5 cols) */}
              <div className="lg:col-span-5 bg-blue-50/50 dark:bg-slate-800/80 p-5 rounded-2xl border border-blue-200/60 dark:border-slate-700 flex flex-col justify-between space-y-4">
                <div className="space-y-4">
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-blue-700 dark:text-blue-400" />
                    <span>خطوة 2: تحديد السباق وتفعيله</span>
                  </h3>

                  <div className="space-y-3">
                    {/* Race Affiliation Selector */}
                    <div>
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">صنف المشاركة للسباق:</label>
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                          type="button"
                          onClick={() => setRaceAffiliation('non_club')}
                          className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                            raceAffiliation === 'non_club'
                              ? 'bg-blue-600 dark:bg-blue-600 text-white border-blue-700 dark:border-blue-500 shadow-xs'
                              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span>⚪</span>
                          <span>غير المنتمين (مدرسي)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRaceAffiliation('club_affiliated')}
                          className={`py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border cursor-pointer ${
                            raceAffiliation === 'club_affiliated'
                              ? 'bg-amber-500 dark:bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-2 ring-amber-300'
                              : 'bg-white dark:bg-slate-900 text-amber-900 dark:text-amber-300 border-amber-200 dark:border-amber-800/60 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                          }`}
                        >
                          <span>🟡</span>
                          <span>المنتمين للأندية</span>
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-black text-slate-700 dark:text-slate-300 block mb-1.5">اختر الفئة والعمر والجنس للسباق:</label>
                      <div className="grid grid-cols-1 gap-2 max-h-[260px] overflow-y-auto pr-1">
                        {CROSS_COUNTRY_CATEGORIES.map((cat) => {
                          const isSelected = selectedRaceId === cat.id;
                          const count = getCategoryRunnersCount(cat, raceAffiliation);
                          const targetKey = raceAffiliation === 'club_affiliated' ? `${cat.id}_club` : cat.id;
                          const catResult = resultsMap[targetKey];
                          const isCompleted = catResult?.status === 'completed' || (catResult && catResult.podium && catResult.podium.length > 0 && catResult.status !== 'running');
                          const isRunning = catResult?.status === 'running';

                          return (
                            <button
                              key={cat.id}
                              onClick={() => selectSingleRace(cat.id)}
                              className={`p-2.5 rounded-xl text-right text-xs transition-all flex items-center justify-between border cursor-pointer group ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-700 dark:border-blue-500 text-white font-black shadow-sm ring-2 ring-blue-400/40'
                                  : isCompleted
                                  ? 'bg-emerald-600 border-emerald-700 dark:border-emerald-500 text-white shadow-md'
                                  : isRunning
                                  ? 'bg-emerald-500 border-emerald-400 text-white animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                                  : 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <span className={`text-xl shrink-0 ${isCompleted || isRunning ? 'grayscale-0' : 'grayscale group-hover:grayscale-0 transition-all'}`}>{cat.icon}</span>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="block text-[11px] font-black">{cat.titleAr}</span>
                                    {isCompleted && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-white text-emerald-700 px-1.5 py-0.2 rounded-md font-bold shadow-xs">
                                        <CheckCircle2 className="w-2.5 h-2.5" />
                                        <span>مكتمل</span>
                                      </span>
                                    )}
                                    {isRunning && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] bg-white text-emerald-600 px-1.5 py-0.2 rounded-md font-bold animate-pulse">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></div>
                                        <span>جارٍ...</span>
                                      </span>
                                    )}
                                  </div>
                                  <span className={`text-[9px] font-bold ${isSelected || isCompleted || isRunning ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'}`}>
                                    مسافة: {cat.distance}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 ${
                                  isSelected || isCompleted || isRunning
                                    ? 'bg-white/20 text-white border border-white/30'
                                    : count > 0
                                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                                }`}>
                                  <span>{count}</span>
                                  <span className="text-[9px]">عداء(ة)</span>
                                </span>
                                {isSelected && <Check className="w-4 h-4 text-white" />}
                                {!isSelected && isCompleted && <CheckCircle2 className="w-4 h-4 text-white" />}
                                {!isSelected && isRunning && <Activity className="w-4 h-4 text-white animate-pulse" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Existing arrivals alert with quick clear */}
                  {arrivals.length > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-2 text-amber-950 dark:text-amber-200">
                        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                        <span>يتوفر هذا السباق على <strong>{arrivals.length}</strong> واصل(ة) مسجل(ة) مسبقاً.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setClearScope('current');
                          setShowClearModal(true);
                        }}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold shrink-0 cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>تفريغ نتائج السباق</span>
                      </button>
                    </div>
                  )}

                  {/* Registered Count Banner */}
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-blue-200 dark:border-slate-700 flex items-center justify-between text-xs shadow-xs">
                    <span className="font-bold text-slate-600 dark:text-slate-400">المسجلين المؤهلين لهذه الفئة:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDetailsScope('current_race');
                        setDetailsModalTab('registered');
                      }}
                      className="px-2.5 py-1 bg-blue-100 dark:bg-blue-950/80 hover:bg-blue-200 dark:hover:bg-blue-900 text-blue-900 dark:text-blue-300 rounded-lg font-black transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs active:scale-95"
                      title="انقر لعرض لائحة المسجلين المؤهلين"
                    >
                      <span>{filteredStudentsCount} عداء(ة)</span>
                      <span className="text-[10px] font-bold bg-blue-200 dark:bg-blue-900 px-1.5 py-0.5 rounded">📋 استعراض</span>
                    </button>
                  </div>
                </div>

                {arrivals.length > 0 ? (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleStartRace(false)}
                      className="w-full py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/30"
                    >
                      <Play className="w-5 h-5 fill-white" />
                      <span>متابعة تسجيل الواصلين ({arrivals.length} عداء مسجل حالياً) ▶️</span>
                    </button>
                    <button
                      onClick={() => handleStartRace(true)}
                      className="w-full py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-slate-300 dark:border-slate-700"
                    >
                      <RotateCcw className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                      <span>بدء سباق جديد وتصفير الواصلين والتوقيت 🔄</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleStartRace(true)}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 via-indigo-700 to-indigo-800 hover:from-blue-700 hover:to-indigo-950 text-white font-black text-sm rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-blue-400/20"
                  >
                    <Play className="w-5 h-5" />
                    <span>بدء تسجيل واصلي السباق وتفعيل ساعة التوقيت 🚀</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Phase 2: Live Race View */}
        {phase === 'running' && (
          <>
            {/* Race & Stopwatch Bar */}
            <div className="bg-slate-100 dark:bg-slate-800/90 p-2.5 sm:p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-3 shrink-0">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-[10px] sm:text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0 hidden xs:inline">السباق المفعل:</span>
                <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-[10px] sm:text-xs font-black truncate flex-1 sm:flex-none">
                  {activeCategory.icon} {activeCategory.titleAr} ({activeCategory.distance})
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black whitespace-nowrap border shadow-xs ${
                  raceAffiliation === 'club_affiliated'
                    ? 'bg-amber-400 text-slate-950 border-amber-500 ring-1 ring-amber-300'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                }`}>
                  {raceAffiliation === 'club_affiliated' ? '🟡 المنتمين للأندية' : '⚪ غير المنتمين (مدرسي)'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] bg-red-100 dark:bg-red-950/80 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 font-extrabold animate-pulse whitespace-nowrap">
                  جارٍ 🏃‍♂️
                </span>
              </div>

              {/* Master Race Stopwatch */}
              <div className="flex items-center gap-2 sm:gap-3 bg-white dark:bg-slate-900 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-3xs w-full sm:w-auto justify-between sm:justify-end">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="text-[9px] sm:text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">الساعة:</span>
                  <span className="font-mono text-sm sm:text-lg font-black text-blue-900 dark:text-blue-400 tracking-wider">
                    {formatElapsedTime(elapsedMs)}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setTimerRunning(!timerRunning)}
                    className={`p-1 sm:p-1.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs flex items-center gap-1 transition-all cursor-pointer ${
                      timerRunning
                        ? 'bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
                    }`}
                  >
                    {timerRunning ? <Pause className="w-3 sm:w-3.5 h-3 sm:h-3.5" /> : <Play className="w-3 sm:w-3.5 h-3 sm:h-3.5" />}
                    <span>{timerRunning ? 'إيقاف' : 'بدء'}</span>
                  </button>

                  <button
                    onClick={() => {
                      setTimerRunning(false);
                      setElapsedMs(0);
                    }}
                    title="تصفير الساعة"
                    className="p-1 sm:p-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg sm:rounded-xl transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content Area: Left Input/Camera Panel + Right Stream */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Left Panel: Scanner & Input (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                
                {/* Toggle Input Mode */}
                <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setInputMode('manual')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      inputMode === 'manual'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <Keyboard className="w-4 h-4" />
                    <span>إدخال الصدرية يدوياً</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInputMode('camera')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      inputMode === 'camera'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>مسح كود QR بالكاميرا</span>
                  </button>
                </div>

                {/* Input Mode A: Manual Bib Entry Form & Touch Numpad */}
                {inputMode === 'manual' && (
                  <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] sm:text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 min-w-0">
                        <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
                        <span className="truncate">كود الصدرية الواصلة:</span>
                      </label>
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800 whitespace-nowrap">
                        المرتبة القادمة: #{arrivals.length + 1}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <input
                        ref={manualBibInputRef}
                        data-bib-input="true"
                        type="text"
                        inputMode="numeric"
                        value={manualBib}
                        onChange={(e) => setManualBib(normalizeArabicDigits(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            barcodeBufferRef.current = '';
                            processArrival(manualBib, manualName, manualSchool);
                          }
                        }}
                        placeholder="رقم الصدرية (104)"
                        autoFocus
                        className="flex-1 bg-white dark:bg-slate-900 border-2 border-blue-500 dark:border-blue-500 rounded-xl sm:rounded-2xl px-3 sm:px-4 py-2 sm:py-3 text-base sm:text-lg font-mono font-black text-slate-900 dark:text-white shadow-inner focus:outline-none focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900 placeholder:text-slate-400 dark:placeholder:text-slate-500 placeholder:font-sans placeholder:text-[10px]"
                      />

                      <button
                        type="button"
                        onClick={() => processArrival(manualBib, manualName, manualSchool)}
                        className="px-4 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm rounded-xl sm:rounded-2xl shadow-md transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>تسجيل</span>
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center justify-between">
                      <span>💡 كود المسح هو رقم الصدرية مباشرة (يدعم قارئ الباركود اليدوي USB/Bluetooth أو الكاميرا)</span>
                    </div>

                    {/* Optional Custom Name / School override */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">اسم العداء (اختياري للعداء غير المسجل):</label>
                        <input
                          type="text"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="اسم التلميذ(ة)"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1">المؤسسة التعليمية (اختياري):</label>
                        <input
                          type="text"
                          value={manualSchool}
                          onChange={(e) => setManualSchool(e.target.value)}
                          placeholder="اسم المدرسة"
                          className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
                        />
                      </div>
                    </div>

                    {/* Touch Onscreen Keypad for Quick Mobile / Tablet Use (Hidden on phone view as requested) */}
                    <div className="pt-2 hidden md:block">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 block mb-1.5">لوحة لمسية سريعة:</span>
                      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setManualBib(prev => prev + String(num))}
                            className="py-2 sm:py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-black text-sm sm:text-base rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 shadow-3xs active:bg-blue-100 dark:active:bg-blue-900 cursor-pointer touch-manipulation"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          key="clear"
                          type="button"
                          onClick={() => setManualBib('')}
                          className="py-2 sm:py-2.5 bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl border border-amber-200 dark:border-amber-800 shadow-3xs active:scale-95 cursor-pointer touch-manipulation"
                        >
                          مسح 🗑️
                        </button>
                        <button
                          key="zero"
                          type="button"
                          onClick={() => setManualBib(prev => prev + '0')}
                          className="py-2 sm:py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 font-black text-sm sm:text-base rounded-lg sm:rounded-xl border border-slate-200 dark:border-slate-700 shadow-3xs active:bg-blue-100 dark:active:bg-blue-900 cursor-pointer touch-manipulation"
                        >
                          0
                        </button>
                        <button
                          key="backspace"
                          type="button"
                          onClick={() => setManualBib(prev => prev.slice(0, -1))}
                          className="py-2 sm:py-2.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-[10px] sm:text-xs rounded-lg sm:rounded-xl border border-slate-300 dark:border-slate-600 shadow-3xs active:scale-95 cursor-pointer touch-manipulation"
                        >
                          تراجع ⌫
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Input Mode B: Camera QR Scanner */}
                {inputMode === 'camera' && (
                  <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 text-white space-y-3 shadow-lg relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                        <Camera className="w-4 h-4" />
                        <span>ماسح الكاميرا (كود QR أو باركود الصدرية):</span>
                      </span>
                      <span className="text-[10px] text-slate-300">وجه الكاميرا نحو كود الصدرية لقراءتها فورياً</span>
                    </div>

                    {cameraError && (
                      <div className="space-y-2">
                        <div className="p-3 bg-red-950/80 border border-red-700 rounded-xl text-red-200 text-xs flex items-center justify-between gap-2">
                          <p className="font-bold flex-1">{cameraError}</p>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-lg cursor-pointer shrink-0"
                          >
                            إعادة المحاولة 🔄
                          </button>
                        </div>
                        <div className="p-3.5 bg-slate-850/95 border border-slate-750 rounded-xl text-slate-300 text-[11px] space-y-1.5 leading-relaxed">
                          <p className="font-black text-amber-400 flex items-center gap-1">
                            <span>💡</span>
                            <span>طريقة تفعيل صلاحية الكاميرا للموقع:</span>
                          </p>
                          <ul className="list-disc list-inside space-y-1 text-slate-300 pr-1">
                            <li><strong>على الهاتف (أندرويد / آيفون):</strong> اضغط على رمز القفل 🔒 أو أيقونة الإعدادات بجانب رابط الموقع في شريط عنوان المتصفح، ثم فعل إذن الكاميرا.</li>
                            <li><strong>على الكمبيوتر:</strong> اضغط على أيقونة القفل 🔒 يسار رابط الموقع في المتصفح، ثم قم بتفعيل زر "الكاميرا" (Camera) وأعد تحميل الصفحة.</li>
                            <li><strong>حل بديل فوري:</strong> يمكنك التبديل إلى "إدخال الصدرية يدوياً" أو استخدام قارئ باركود خارجي وهو يعمل بموثوقية تامة دون الحاجة للكاميرا.</li>
                          </ul>
                        </div>
                      </div>
                    )}

                    <div className="relative rounded-2xl overflow-hidden border-2 border-amber-400/40 bg-black min-h-[260px] flex items-center justify-center">
                      <div id={qrRegionId} className="w-full"></div>
                      {!cameraActive && !cameraError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-slate-300 gap-2">
                          <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                          <span className="text-xs font-bold">جاري تشغيل الكاميرا...</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Live Team Progress Summary Card */}
                {showWinningTeams && (
                  <div className="bg-blue-50/80 dark:bg-slate-800/80 p-3.5 rounded-2xl border border-blue-200 dark:border-slate-700 space-y-2">
                    <h4 className="text-xs font-black text-blue-950 dark:text-blue-200 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>متابعة وصول عداءي المؤسسات المباشرة:</span>
                    </h4>

                    {liveTeamRankings.length === 0 ? (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">في انتظار وصول 4 عداءين على الأقل لتحديد ترتيب الفرق المكتملة.</p>
                    ) : (
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {liveTeamRankings.filter(t => t.isValidTeam).map((team, idx) => {
                          const formulaStr = team.top4Runners.map(r => r.rank).join(' + ');
                          return (
                            <div
                              key={team.schoolName}
                              className={`p-2.5 rounded-xl text-xs border ${
                                team.isWinnerTeam
                                  ? 'bg-amber-100 dark:bg-amber-950/80 border-amber-300 dark:border-amber-700 font-bold text-amber-950 dark:text-amber-200 shadow-2xs'
                                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <span className="font-black text-slate-900 dark:text-slate-100 shrink-0">
                                    {idx === 0 ? '🥇 #1' : idx === 1 ? '🥈 #2' : idx === 2 ? '🥉 #3' : `#${idx + 1}`}
                                  </span>
                                  <span className="font-black truncate text-slate-900 dark:text-slate-100" title={team.schoolName}>
                                    {team.schoolName}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-mono text-[10px] bg-blue-100 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 font-black px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                                    {team.totalPoints} نقطة ({formulaStr} = {team.totalPoints})
                                  </span>
                                </div>
                              </div>

                              {/* 4 Runners Breakdown: Ranks (1, 5, 7, 10...) */}
                              <div className="mt-2 pt-1.5 border-t border-slate-200/70 dark:border-slate-700/70 grid grid-cols-1 sm:grid-cols-2 gap-1 text-[10px]">
                                {team.top4Runners.map((r, rIdx) => (
                                  <div key={r.id || rIdx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/80 px-2 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/50">
                                    <span className="font-black text-amber-700 dark:text-amber-400">
                                      المرتبة {r.rank}
                                    </span>
                                    <span className="truncate max-w-[110px] font-medium text-slate-700 dark:text-slate-300" title={r.fullName}>
                                      {r.fullName}
                                    </span>
                                    <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400">
                                      #{r.bibNumber}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right Panel: Live Arrivals Stream Table (7 cols) */}
              <div className="lg:col-span-7 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">
                        جدول خط الوصول الحية ({arrivals.length} عداء)
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        مباشر 🔴
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSaveAndAdoptResults}
                        disabled={isSavingLive || arrivals.length === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs rounded-xl shadow-sm transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        title="حفظ الواصلين في قاعدة البيانات واعتماد النتائج فورياً"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>حفظ واعتماد النتائج ({arrivals.length}) 💾 🏁</span>
                      </button>

                      {arrivals.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setClearScope('current');
                            setShowClearModal(true);
                          }}
                          className="p-1.5 text-red-600 dark:text-red-400 hover:text-red-800 cursor-pointer flex items-center justify-center bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg border border-red-200 dark:border-red-800 transition-colors shadow-3xs active:scale-95"
                          title="تفريغ جميع الواصلين في هذا السباق"
                          aria-label="تفريغ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Toggles and Stats Selector Bar */}
                  <div className="flex flex-wrap items-center gap-4 bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 p-2.5 rounded-xl mb-3 text-[11px] shadow-3xs">
                    <div className="text-[10px] font-black text-slate-400 dark:text-slate-400 uppercase tracking-wider pl-1.5 border-l border-slate-200 dark:border-slate-700">خيارات العرض الحية:</div>
                    
                    <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100">
                      <input
                        type="checkbox"
                        checked={showWinningTeams}
                        onChange={(e) => setShowWinningTeams(e.target.checked)}
                        className="h-3.5 w-3.5 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1">🏆 <span>إظهار الفرق الفائزة</span></span>
                    </label>

                    <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100">
                      <input
                        type="checkbox"
                        checked={showParticipantStats}
                        onChange={(e) => setShowParticipantStats(e.target.checked)}
                        className="h-3.5 w-3.5 rounded text-blue-600 border-slate-300 dark:border-slate-600 focus:ring-blue-500 cursor-pointer"
                      />
                      <span className="flex items-center gap-1">📊 <span>إحصاءات المشاركين</span></span>
                    </label>
                  </div>

                  {/* Live Participant Stats Dashboard */}
                  {showParticipantStats && (
                    <div className="bg-blue-50/40 dark:bg-slate-900/50 border border-blue-100/50 dark:border-slate-700 p-2.5 rounded-xl mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-right shadow-3xs">
                      <button
                        type="button"
                        onClick={() => {
                          setDetailsScope('current_race');
                          setDetailsModalTab('registered');
                        }}
                        className="bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-750 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-3xs text-right transition-all cursor-pointer group"
                        title="انقر لعرض لائحة المسجلين في السباق الحالي"
                      >
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-400 block group-hover:text-blue-600">إجمالي المسجلين 📋</span>
                        <span className="text-xs font-black text-blue-950 dark:text-blue-300 font-mono group-hover:underline">{filteredStudentsCount}</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-400 font-medium mr-1">عداء</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDetailsScope('current_race');
                          setDetailsModalTab('arrivals');
                        }}
                        className="bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-750 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-3xs text-right transition-all cursor-pointer group"
                        title="انقر لعرض لائحة الواصلين في السباق الحالي"
                      >
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-400 block group-hover:text-emerald-600">الواصلين حالياً 🏁</span>
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 font-mono group-hover:underline">{arrivals.length}</span>
                        <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-bold mr-1 font-mono">
                          ({filteredStudentsCount > 0 ? Math.min(100, Math.round((arrivals.length / filteredStudentsCount) * 100)) : 0}%)
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDetailsScope('current_race');
                          setDetailsModalTab('remaining');
                        }}
                        className="bg-white dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-slate-750 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-3xs text-right transition-all cursor-pointer group"
                        title="انقر لعرض لائحة المتبقي في السباق"
                      >
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-400 block group-hover:text-amber-600">المتبقي في السباق ⏳</span>
                        <span className="text-xs font-black text-amber-700 dark:text-amber-400 font-mono group-hover:underline">
                          {Math.max(0, filteredStudentsCount - arrivals.length)}
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-400 font-medium mr-1">عداء</span>
                      </button>

                      <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-100 dark:border-slate-700 shadow-3xs">
                        <span className="text-[9px] font-black text-slate-400 dark:text-slate-400 block">المؤسسات المشاركة</span>
                        <span className="text-xs font-black text-indigo-950 dark:text-indigo-300 font-mono font-bold">
                          {new Set(arrivals.map(r => r.schoolName).filter(Boolean)).size}
                        </span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-400 font-medium mr-1">مؤسسة</span>
                      </div>
                    </div>
                  )}

                  {/* Live Winning Teams Dashboard - Show only if participation condition is school team */}
                  {showWinningTeams && hasSchoolTeamParticipants && (
                    <div className="bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50 p-2.5 rounded-xl mb-3 space-y-1.5 shadow-3xs">
                      <div className="flex items-center gap-1 text-[10px] font-black text-amber-950 dark:text-amber-200">
                        <span>🏆</span>
                        <span>الترتيب المؤقت للفرق الفائزة (اكتمال 4 عداءين):</span>
                      </div>
                      {liveTeamRankings.filter(t => t.isValidTeam).length === 0 ? (
                        <p className="text-[10px] text-amber-800/70 dark:text-amber-300/70 font-medium">في انتظار وصول 4 عداءين من أي مؤسسة لاحتساب ترتيب الفرق.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {liveTeamRankings.filter(t => t.isValidTeam).slice(0, 3).map((team, idx) => {
                            const formulaStr = team.top4Runners.map(r => r.rank).join(' + ');
                            return (
                              <div key={team.schoolName} className="bg-white dark:bg-slate-800 border border-amber-200/80 dark:border-amber-800/60 p-2.5 rounded-xl text-[11px] shadow-3xs space-y-1.5">
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1 overflow-hidden">
                                    <span className="font-extrabold text-xs">
                                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                                    </span>
                                    <span className="font-black text-slate-800 dark:text-slate-200 truncate max-w-[120px]" title={team.schoolName}>
                                      {team.schoolName}
                                    </span>
                                  </div>
                                  <span className="font-black text-amber-950 dark:text-amber-200 bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 rounded-md text-[10px] shrink-0 font-mono">
                                    {team.totalPoints} ن ({formulaStr})
                                  </span>
                                </div>
                                <div className="text-[9px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/50 pt-1 space-y-0.5">
                                  {team.top4Runners.map((r, rIdx) => (
                                    <div key={r.id || rIdx} className="flex items-center justify-between">
                                      <span className="font-bold text-amber-800 dark:text-amber-400">المرتبة {r.rank}:</span>
                                      <span className="truncate max-w-[100px] text-slate-700 dark:text-slate-300">{r.fullName}</span>
                                      <span className="font-mono text-[8.5px]">#{r.bibNumber}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {arrivals.length === 0 ? (
                    <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-400 space-y-2">
                      <Trophy className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="text-xs font-bold text-slate-600 dark:text-slate-300">لم يتم تسجيل أي وصول عند خط النهاية بعد</p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-400">امسح كود الصدرية بالكاميرا أو اكتب رقم الصدرية يدوياً بالجانب الأيمن.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-black text-[10px] sm:text-[11px] sticky top-0 z-10 border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="p-2 sm:p-2.5 text-center">الرتبة</th>
                            <th className="p-2 sm:p-2.5">الصدرية</th>
                            <th className="p-2 sm:p-2.5">العداء(ة)</th>
                            <th className="p-2 sm:p-2.5 hidden xs:table-cell">المؤسسة</th>
                            <th className="p-2 sm:p-2.5 text-center">نوع المشاركة</th>
                            <th className="p-2 sm:p-2.5 text-center">تعديل</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {arrivals.map((runner, index) => (
                            <tr
                              key={index}
                              className={`transition-colors ${
                                index === 0
                                  ? 'bg-amber-50/60 dark:bg-amber-950/40 hover:bg-amber-100/60 dark:hover:bg-amber-900/50 font-bold'
                                  : index === 1
                                  ? 'bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100/80 dark:hover:bg-slate-700/60 font-bold'
                                  : index === 2
                                  ? 'bg-amber-50/30 dark:bg-amber-950/20 hover:bg-amber-100/30 dark:hover:bg-amber-900/30'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                              }`}
                            >
                              <td className="p-2 sm:p-2.5 text-center font-black text-slate-800 dark:text-slate-200">
                                {index === 0 ? '🥇 1' : index === 1 ? '🥈 2' : index === 2 ? '🥉 3' : `#${index + 1}`}
                              </td>

                              <td className="p-2 sm:p-2.5 font-mono font-black text-blue-900 dark:text-blue-400">
                                #{runner.bibNumber || '-'}
                              </td>

                              <td className="p-2 sm:p-2.5 font-bold text-slate-900 dark:text-slate-100 truncate max-w-[80px] sm:max-w-none">
                                {runner.fullName}
                              </td>

                              <td className="p-2 sm:p-2.5 text-slate-600 dark:text-slate-400 text-[10px] sm:text-[11px] hidden xs:table-cell truncate max-w-[100px]">
                                {runner.schoolName}
                              </td>

                              <td className="p-2 sm:p-2.5 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  resolveRunnerParticipationType(runner, allStudents) === 'school_team'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}>
                                  {resolveRunnerParticipationType(runner, allStudents) === 'school_team' ? 'فريق المؤسسة' : 'فردي'}
                                </span>
                              </td>

                              <td className="p-2 sm:p-2.5 text-center">
                                <div className="flex items-center justify-center gap-0.5 sm:gap-1">
                                  <button
                                    onClick={() => handleMoveArrival(index, 'up')}
                                    disabled={index === 0}
                                    title="تقديم مرتبة"
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 disabled:opacity-20 cursor-pointer"
                                  >
                                    <ArrowUp className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleMoveArrival(index, 'down')}
                                    disabled={index === arrivals.length - 1}
                                    title="تأخير مرتبة"
                                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-400 disabled:opacity-20 cursor-pointer"
                                  >
                                    <ArrowDown className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                                  </button>

                                  <button
                                    onClick={() => handleRemoveArrival(index)}
                                    title="حذف"
                                    className="p-1 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Bottom Final Action Bar with live-save indicator */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400">
                    <span>الواصلين: <span className="text-blue-900 dark:text-blue-400 font-black">{arrivals.length}</span></span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>تم الحفظ تلقائياً في قاعدة البيانات</span>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => setPhase('setup')}
                      className="px-3.5 py-2.5 text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-300/30 dark:border-slate-700 shrink-0"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>رجوع للإعداد</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveAndAdoptResults}
                      disabled={isSavingLive || arrivals.length === 0}
                      className="flex-1 sm:flex-none px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      title="حفظ جميع المتسابقين الواصلين في قاعدة البيانات واعتماد النتائج فورياً"
                    >
                      <Save className="w-4 h-4" />
                      <span>حفظ واعتماد النتائج ({arrivals.length}) 💾 🏁</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Phase 3: Summary View */}
        {phase === 'summary' && (
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
            <div className="text-center space-y-2 max-w-lg mx-auto">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/80 border border-amber-300 dark:border-amber-700 rounded-full flex items-center justify-center text-3xl mx-auto shadow-md">
                🏆
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100">انتهى السباق وتم توثيق البوديوم والترتيب</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                لقد تم حفظ نتائج فئة (<strong className="text-slate-800 dark:text-slate-200">{activeCategory.titleAr}</strong>) بنجاح وبشكل فوري داخل قاعدة البيانات المركزية لوزارة التربية الوطنية والتعليم الأولي والرياضة.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Podium podium visual (Individual) */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <Trophy className="w-4 h-4 text-amber-500" />
                  <span>منصة التتويج الفردي المعتمدة (Top 3):</span>
                </h4>

                {arrivals.slice(0, 3).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">لا يتوفر واصلين حالياً.</p>
                ) : (
                  <div className="space-y-2">
                    {arrivals.slice(0, 3).map((runner, index) => (
                      <div
                        key={index}
                        className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs font-bold"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-base">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                          <div>
                            <span className="text-slate-900 dark:text-slate-100 block">{runner.fullName}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">{runner.schoolName}</span>
                          </div>
                        </div>
                        <span className="font-mono text-blue-900 dark:text-blue-400">{runner.time || '-'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Live Team rankings visual */}
              <div className="bg-slate-50 dark:bg-slate-800/80 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                <h4 className="text-xs font-black text-slate-900 dark:text-slate-100 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-700 pb-2">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>ترتيب فرق المؤسسات (تأهيل الجهوية):</span>
                </h4>

                {liveTeamRankings.slice(0, 3).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">في انتظار واصلين لحساب نقاط الفرق.</p>
                ) : (
                  <div className="space-y-2">
                    {liveTeamRankings.slice(0, 3).map((team, idx) => {
                      const formulaStr = team.top4Runners.map(r => r.rank).join(' + ');
                      return (
                        <div
                          key={team.schoolName}
                          className="bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold space-y-2 shadow-xs"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                              <span className="font-black text-slate-900 dark:text-slate-100 text-sm">{team.schoolName}</span>
                            </div>
                            <span className="text-blue-900 dark:text-blue-300 font-mono font-black bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800">
                              {team.totalPoints} نقطة ({formulaStr} = {team.totalPoints})
                            </span>
                          </div>

                          {/* Top 4 Runners list */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                            {team.top4Runners.map((r, rIdx) => (
                              <div key={r.id || rIdx} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
                                <span className="font-black text-amber-700 dark:text-amber-400">المرتبة {r.rank}</span>
                                <span className="truncate max-w-[120px] font-semibold text-slate-800 dark:text-slate-200" title={r.fullName}>{r.fullName}</span>
                                <span className="font-mono text-[9px] text-slate-500">#{r.bibNumber}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setClearScope('current');
                  setShowClearModal(true);
                }}
                className="px-4 py-2.5 bg-red-50 dark:bg-red-950/50 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                title="تفريغ نتائج هذا السباق وإعادة إطلاقه"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                <span>تفريغ نتائج هذا السباق 🗑️</span>
              </button>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={handleTransitionToAnotherRace}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer border border-blue-400/20"
                >
                  <RefreshCw className="w-4 h-4 text-amber-300" />
                  <span>الذهاب إلى سباق آخر 🔄</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 sm:flex-initial px-5 py-2.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Clear Application Data Confirmation & Scope Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-red-200 dark:border-red-900/50 w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white text-xl shrink-0 shadow-inner">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black">تفريغ وإعادة ضبط تطبيق المسح</h3>
                  <p className="text-xs text-red-100">حدد نطاق البيانات التي ترغب في تفريغها من التطبيق</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="p-1.5 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scope Selection */}
            <div className="p-4 sm:p-6 space-y-3 max-h-[70vh] overflow-y-auto">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                اختر نوع ونطاق التفريغ المطلوب:
              </label>

              {/* Option 1: Current race */}
              <div
                onClick={() => setClearScope('current')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  clearScope === 'current'
                    ? 'bg-red-50/70 dark:bg-red-950/50 border-red-400 dark:border-red-700 ring-2 ring-red-300 dark:ring-red-900'
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                  clearScope === 'current' ? 'border-red-600 bg-red-600 text-white' : 'border-slate-400'
                }`}>
                  {clearScope === 'current' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                      تفريغ نتائج السباق الحالي فقط ({activeCategory.titleAr})
                    </span>
                    <span className="text-[10px] bg-red-100 dark:bg-red-950/80 text-red-800 dark:text-red-300 font-bold px-2 py-0.5 rounded-full font-mono">
                      {arrivals.length} واصلين
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    يمسح جدول واصلي خط النهاية للفئة الحالية فقط، يصفر ساعة التوقيت، ويسجل نتيجة فارغة في قاعدة البيانات المركزية.
                  </p>
                </div>
              </div>

              {/* Option 2: All 8 races */}
              <div
                onClick={() => setClearScope('all_races')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  clearScope === 'all_races'
                    ? 'bg-red-50/70 dark:bg-red-950/50 border-red-400 dark:border-red-700 ring-2 ring-red-300 dark:ring-red-900'
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                  clearScope === 'all_races' ? 'border-red-600 bg-red-600 text-white' : 'border-slate-400'
                }`}>
                  {clearScope === 'all_races' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                      تفريغ جميع سباقات العدو الريفي الـ 8 بالكامل
                    </span>
                    <span className="text-[10px] bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 font-bold px-2 py-0.5 rounded-full">
                      كافة الفئات 8
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    يمسح كافة النتائج والوصولات ومنصات التتويج المسجلة لجميع الفئات، مع الإبقاء على لائحة المشاركين المسجلين.
                  </p>
                </div>
              </div>

              {/* Option 3: Participants */}
              <div
                onClick={() => setClearScope('participants')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  clearScope === 'participants'
                    ? 'bg-red-50/70 dark:bg-red-950/50 border-red-400 dark:border-red-700 ring-2 ring-red-300 dark:ring-red-900'
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                  clearScope === 'participants' ? 'border-red-600 bg-red-600 text-white' : 'border-slate-400'
                }`}>
                  {clearScope === 'participants' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                      تفريغ لائحة المشاركين المسجلين (Excel)
                    </span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full font-mono">
                      {allStudents.length} مشارك
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    يحذف المشاركين والعدائين المستوردين من ملف Excel، لتتمكن من استيراد ملف جديد ونظيف دون تكرار.
                  </p>
                </div>
              </div>

              {/* Option 4: Everything */}
              <div
                onClick={() => setClearScope('everything')}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                  clearScope === 'everything'
                    ? 'bg-rose-100/80 dark:bg-rose-950/80 border-rose-500 dark:border-rose-600 ring-2 ring-rose-400 dark:ring-rose-800'
                    : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 shrink-0 ${
                  clearScope === 'everything' ? 'border-red-700 bg-red-700 text-white' : 'border-slate-400'
                }`}>
                  {clearScope === 'everything' && <div className="w-2 h-2 rounded-full bg-white"></div>}
                </div>
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-red-900 dark:text-red-200">
                      تفريغ شامل لكافة بيانات تطبيق المسح (السباقات + المشاركين)
                    </span>
                    <span className="text-[10px] bg-red-200 dark:bg-red-950/80 text-red-900 dark:text-red-200 font-extrabold px-2 py-0.5 rounded-full">
                      إعادة ضبط كامل ⚠️
                    </span>
                  </div>
                  <p className="text-[11px] text-red-700 dark:text-red-300 mt-1 leading-relaxed">
                    إعادة ضبط مصنعي كامل لتطبيق مسح خط الوصول، يمسح كافة نتائج السباقات الـ 8 ولائحة المشاركين المستوردين بالكامل.
                  </p>
                </div>
              </div>

              {/* Danger Warning Box */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="leading-relaxed">
                  تنبيه: هذا الإجراء سيتم مزامنته وتطبيقه فورياً في قاعدة البيانات السحابية المركزية.
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                disabled={isClearing}
                className="px-4 py-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                إلغاء وتراجع
              </button>
              <button
                type="button"
                onClick={handleExecuteClear}
                disabled={isClearing}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black transition-all active:scale-95 flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري التفريغ...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>تأكيد تفريغ البيانات</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Participant Details Modal (إجمالي المسجلين، الواصلين، المتبقي في السباق) */}
      {detailsModalTab !== null && (
        <div className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center text-xl shrink-0 shadow-inner">
                  {detailsModalTab === 'registered' ? '📋' : detailsModalTab === 'arrivals' ? '🏁' : '⏳'}
                </div>
                <div>
                  <h3 className="text-base font-black flex items-center gap-2">
                    <span>
                      {detailsModalTab === 'registered' ? 'لائحة المسجلين' : detailsModalTab === 'arrivals' ? 'لائحة الواصلين حالياً' : 'لائحة المتبقي في السباق'}
                    </span>
                    <span className="text-[10px] font-mono bg-white/20 px-2.5 py-0.5 rounded-full">
                      {detailsModalTab === 'registered' ? detailsRegisteredFiltered.length : detailsModalTab === 'arrivals' ? detailsArrivalsFiltered.length : detailsRemainingFiltered.length} عداء(ة)
                    </span>
                  </h3>
                  <p className="text-xs text-indigo-200">
                    {activeCategory.icon} {activeCategory.titleAr} ({raceAffiliation === 'club_affiliated' ? 'منتمين للأندية' : 'مدرسي'})
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportDetailsToExcel}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  title="تصدير اللائحة إلى Excel"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span className="hidden sm:inline">تصدير Excel 📊</span>
                </button>

                <button
                  type="button"
                  onClick={() => setDetailsModalTab(null)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                  title="إغلاق"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sub-header / Tabs & Search */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
              
              {/* Tab Selector */}
              <div className="flex items-center gap-1.5 bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setDetailsModalTab('registered')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    detailsModalTab === 'registered'
                      ? 'bg-white dark:bg-slate-900 text-blue-900 dark:text-blue-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  إجمالي المسجلين ({detailsScope === 'current_race' ? activeRaceRegisteredStudents.length : allStudents.length})
                </button>

                <button
                  type="button"
                  onClick={() => setDetailsModalTab('arrivals')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    detailsModalTab === 'arrivals'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  الواصلين ({arrivals.length})
                </button>

                <button
                  type="button"
                  onClick={() => setDetailsModalTab('remaining')}
                  className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    detailsModalTab === 'remaining'
                      ? 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                  }`}
                >
                  المتبقي ({activeRaceRemainingStudents.length})
                </button>
              </div>

              {/* Search & Scope toggles */}
              <div className="flex items-center gap-2">
                {detailsModalTab === 'registered' && (
                  <select
                    value={detailsScope}
                    onChange={(e) => setDetailsScope(e.target.value as any)}
                    className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-2 border border-slate-300 dark:border-slate-700 cursor-pointer"
                  >
                    <option value="current_race">مسجلي السباق الحالي ({activeCategory.titleAr})</option>
                    <option value="all_races">كافة مسجلي البطولة ({allStudents.length})</option>
                  </select>
                )}

                <div className="relative flex-1 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={detailsSearchQuery}
                    onChange={(e) => setDetailsSearchQuery(e.target.value)}
                    placeholder="بحث بالاسم، الصدرية، المؤسسة..."
                    className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs rounded-xl pr-9 pl-3 py-2 border border-slate-300 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Modal Body: List View */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-2 bg-slate-50 dark:bg-slate-950/50">
              
              {/* Tab 1: Registered Students */}
              {detailsModalTab === 'registered' && (
                detailsRegisteredFiltered.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-3xl">📭</p>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">لا توجد نتائج مطابقة للبحث أو اللائحة فارغة.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailsRegisteredFiltered.map((student, idx) => {
                      const arr = getStudentArrival(student);
                      const bib = student.bibNumber ?? (student as any).crossCountryBibNumber ?? (idx + 1 + 100);
                      const partType = resolveRunnerParticipationType(student, allStudents);
                      return (
                        <div key={student.id || idx} className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-3xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/80 text-blue-900 dark:text-blue-300 font-mono font-black flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-800 text-xs shadow-3xs" title="رقم الصدرية">
                              #{bib}
                            </span>
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 dark:text-slate-100 truncate flex items-center gap-2">
                                <span>{student.fullName}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  partType === 'school_team'
                                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                                    : 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                }`}>
                                  {partType === 'school_team' ? 'فريق المؤسسة' : 'فردي'}
                                </span>
                              </p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                🏫 {student.schoolName || 'مؤسسة غير محددة'} • مسار: {student.massarNumber || '-'} • <strong className="font-mono text-blue-700 dark:text-blue-400">الصدرية: #{bib}</strong>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {arr ? (
                              <span className="px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black rounded-lg text-[10px] border border-emerald-300 dark:border-emerald-800">
                                وصل 🏁 (المرتبة {arr.rank} - {arr.time || '-'})
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 font-bold rounded-lg text-[10px] border border-amber-200 dark:border-amber-800">
                                في الحلبة ⏳
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {/* Tab 2: Arrivals */}
              {detailsModalTab === 'arrivals' && (
                detailsArrivalsFiltered.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-3xl">🏁</p>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">لم يتم تسجيل أي وصول في هذا السباق بعد.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailsArrivalsFiltered.map((arrival, idx) => (
                      <div key={idx} className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-3xs">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/80 text-emerald-900 dark:text-emerald-300 font-mono font-black flex items-center justify-center shrink-0 border border-emerald-200 dark:border-emerald-800">
                            #{arrival.rank || idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="font-black text-slate-900 dark:text-slate-100 truncate">{arrival.fullName}</p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              🏫 {arrival.schoolName} • صدرية #{arrival.bibNumber || '-'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 font-mono font-black text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-200 dark:border-emerald-800">
                          ⏱️ {arrival.time || '00:00.0'}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {/* Tab 3: Remaining in Race */}
              {detailsModalTab === 'remaining' && (
                detailsRemainingFiltered.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <p className="text-3xl">🎉</p>
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-400">رائع! لقد وصل جميع مسجلي هذا السباق إلى خط النهاية.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {detailsRemainingFiltered.map((student, idx) => {
                      const bib = student.bibNumber ?? (student as any).crossCountryBibNumber ?? '-';
                      return (
                        <div key={student.id || idx} className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-xs shadow-3xs">
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-mono font-black flex items-center justify-center shrink-0 border border-amber-200 dark:border-amber-800">
                              #{bib}
                            </span>
                            <div className="min-w-0">
                              <p className="font-black text-slate-900 dark:text-slate-100 truncate">{student.fullName}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                🏫 {student.schoolName || 'مؤسسة غير محددة'} • مسار: {student.massarNumber || '-'}
                              </p>
                            </div>
                          </div>

                          <span className="px-2.5 py-1 bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-300 font-bold rounded-lg text-[10px] border border-amber-300 dark:border-amber-800 shrink-0">
                            قيد السباق (في انتظار الوصول) ⏳
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                يمكنك النقر على أي عداء أو تصدير اللائحة مباشرة لإكسل.
              </span>
              <button
                type="button"
                onClick={() => setDetailsModalTab(null)}
                className="px-5 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-bold text-xs rounded-xl transition-colors cursor-pointer"
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
