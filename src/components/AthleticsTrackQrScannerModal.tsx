import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Camera,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Trophy,
  UserCheck,
  Search,
  ArrowRight,
  Layers,
  Flag,
  Keyboard,
  RefreshCw,
  Zap,
  Info
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import toast from 'react-hot-toast';
import {
  AthleticsDisciplineDef,
  AthleticsParticipantRecord,
  TrackRankEntry,
  AthleticsAttendanceRecord
} from '../lib/athleticsConfig';

interface AthleticsTrackQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDiscipline: AthleticsDisciplineDef | null;
  selectedCategory: 'U12' | 'U15' | 'U18' | 'U20';
  selectedGender: 'Male' | 'Female';
  currentEventParticipants: AthleticsParticipantRecord[];
  allParticipants: AthleticsParticipantRecord[];
  attendanceMap: Record<string, AthleticsAttendanceRecord>;
  recordedLaps: TrackRankEntry[];
  onAssignParticipantToLap: (lapIndex: number, participantId: string) => void;
  initialTargetRank?: number;
}

// Arabic text normalizer for fuzzy search matching
function normalizeArabic(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[ة]/g, 'ه')
    .replace(/[ى]/g, 'ي')
    .replace(/[ًٌٍَُِّْ]/g, '');
}

export const AthleticsTrackQrScannerModal: React.FC<AthleticsTrackQrScannerModalProps> = ({
  isOpen,
  onClose,
  activeDiscipline,
  selectedCategory,
  selectedGender,
  currentEventParticipants,
  allParticipants,
  attendanceMap,
  recordedLaps,
  onAssignParticipantToLap,
  initialTargetRank
}) => {
  // Sound feedback toggle
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Auto-advance to next rank toggle
  const [autoAdvance, setAutoAdvance] = useState(true);

  // Camera & scanner state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [availableCameras, setAvailableCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [scanCooldown, setScanCooldown] = useState(false);

  // Manual code input (for handheld USB/Bluetooth barcode guns or manual keyboard entry)
  const [manualCodeInput, setManualCodeInput] = useState('');
  const manualInputRef = useRef<HTMLInputElement>(null);

  // Last scanned details banner
  const [lastScannedResult, setLastScannedResult] = useState<{
    participant: AthleticsParticipantRecord;
    rank: number;
    matchType: string;
    lane?: number;
    timestamp: number;
  } | null>(null);

  // Warning when participant was already assigned
  const [duplicateWarning, setDuplicateWarning] = useState<{
    participant: AthleticsParticipantRecord;
    existingRank: number;
    targetRank: number;
    targetLapOrigIdx: number;
  } | null>(null);

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null);
  const qrRegionId = 'athletics-track-qr-reader-region';

  // Sort recorded laps by finish time to find effective ranks
  const sortedLapsWithOrigIdx = useMemo(() => {
    return recordedLaps
      .map((lap, origIdx) => ({
        ...lap,
        origIdx
      }))
      .sort((a, b) => a.rank - b.rank);
  }, [recordedLaps]);

  // Determine initial target rank: find the first unassigned rank or fallback to initialTargetRank or 1
  const [selectedRankNumber, setSelectedRankNumber] = useState<number>(1);

  useEffect(() => {
    if (!isOpen) return;

    if (initialTargetRank && initialTargetRank > 0 && initialTargetRank <= recordedLaps.length) {
      setSelectedRankNumber(initialTargetRank);
      return;
    }

    // Default to first unassigned rank
    const firstUnassigned = sortedLapsWithOrigIdx.find(l => !l.participantId);
    if (firstUnassigned) {
      setSelectedRankNumber(firstUnassigned.rank);
    } else if (sortedLapsWithOrigIdx.length > 0) {
      setSelectedRankNumber(1);
    }
  }, [isOpen, initialTargetRank, sortedLapsWithOrigIdx]);

  // Current active lap being assigned
  const currentTargetLap = useMemo(() => {
    return sortedLapsWithOrigIdx.find(l => l.rank === selectedRankNumber) || sortedLapsWithOrigIdx[0] || null;
  }, [sortedLapsWithOrigIdx, selectedRankNumber]);

  // Web Audio chime for success
  const playSuccessChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      // Two-tone success melody
      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.12); // A5
      gain2.gain.setValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.35);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  };

  // Web Audio low warning tone
  const playWarningTone = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now); // A3
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  };

  // Stop camera function
  const stopCamera = async () => {
    if (html5QrcodeRef.current) {
      try {
        if (html5QrcodeRef.current.isScanning) {
          await html5QrcodeRef.current.stop();
        }
        html5QrcodeRef.current.clear();
      } catch (err) {
        console.warn('Error stopping html5-qrcode:', err);
      } finally {
        html5QrcodeRef.current = null;
        setIsCameraActive(false);
      }
    }
  };

  // Start camera scanner
  const startCamera = async (cameraId?: string) => {
    setCameraError(null);
    try {
      // If already running, stop first
      if (html5QrcodeRef.current) {
        await stopCamera();
      }

      // Check if container element is mounted
      const element = document.getElementById(qrRegionId);
      if (!element) {
        setTimeout(() => startCamera(cameraId), 150);
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

      // Detect available cameras if not yet populated
      try {
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) {
          setAvailableCameras(devices.map(d => ({ id: d.id, label: d.label || `كاميرا ${d.id.slice(0, 5)}` })));
          if (!selectedCameraId && !cameraId) {
            // Prefer back camera if available
            const backCam = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear') || d.label.toLowerCase().includes('خلفية'));
            if (backCam) {
              setSelectedCameraId(backCam.id);
            } else {
              setSelectedCameraId(devices[0].id);
            }
          }
        }
      } catch (camListErr) {
        console.warn('Could not list cameras:', camListErr);
      }

      const targetCamera = cameraId || selectedCameraId;
      const cameraConfig = targetCamera ? targetCamera : { facingMode: 'environment' };

      const scanConfig = {
        fps: 20,
        qrbox: (w: number, h: number) => {
          const minDim = Math.min(w, h);
          const size = Math.max(180, Math.floor(minDim * 0.78));
          return { width: size, height: size };
        }
      };

      try {
        await qrScanner.start(
          cameraConfig,
          scanConfig,
          (decodedText) => {
            handleDecodedQr(decodedText);
          },
          () => {}
        );
        setIsCameraActive(true);
      } catch (startErr) {
        console.warn('Initial camera start failed, trying user camera fallback:', startErr);
        await qrScanner.start(
          { facingMode: 'user' },
          scanConfig,
          (decodedText) => {
            handleDecodedQr(decodedText);
          },
          () => {}
        );
        setIsCameraActive(true);
      }
    } catch (err: any) {
      console.error('Failed to start camera scanner:', err);
      const errStr = String(err?.message || err || '');
      if (errStr.includes('NotAllowedError') || errStr.includes('Permission denied')) {
        setCameraError('تم رفض الإذن بالكاميرا. يرجى تفعيل صلاحية الكاميرا من إعدادات المتصفح.');
      } else {
        setCameraError('تعذر فتح الكاميرا (ربما هي قيد الاستخدام من تطبيق آخر). يمكنك استخدام القارئ اليدوي أو كتابة رقم مسار / الصدرية.');
      }
      setIsCameraActive(false);
    }
  };

  // Effect to manage camera lifecycle when modal opens / closes
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        startCamera();
      }, 250);
      return () => {
        clearTimeout(timer);
        stopCamera();
      };
    } else {
      stopCamera();
    }
  }, [isOpen]);

  // Decode and match participant from QR / Barcode / Handheld Scanner
  const handleDecodedQr = (rawText: string) => {
    if (scanCooldown) return;
    const cleaned = (rawText || '').trim();
    if (!cleaned) return;

    // Apply quick debounce cooldown
    setScanCooldown(true);
    setTimeout(() => {
      setScanCooldown(false);
    }, 1200);

    // 1. Try parsing JSON payload if available (created by BibGenerator)
    let parsedJson: any = null;
    try {
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        parsedJson = JSON.parse(cleaned);
      }
    } catch (e) {
      parsedJson = null;
    }

    const massarQuery = (parsedJson?.massar || parsedJson?.massarNumber || (!parsedJson ? cleaned : '')).trim();
    const bibQuery = (parsedJson?.bib !== undefined ? String(parsedJson.bib) : (!parsedJson ? cleaned.replace(/^#/, '') : '')).trim();
    const nameQuery = (parsedJson?.name || parsedJson?.fullName || parsedJson?.studentName || (!parsedJson ? cleaned : '')).trim();

    // 2. Matching logic prioritizing current event participants
    let matched: AthleticsParticipantRecord | undefined;
    let matchReason = '';

    // A. Match by Massar Number (رقم مسار: Case insensitive)
    if (massarQuery && massarQuery.length >= 3) {
      const cleanMassar = massarQuery.replace(/^(مسار-|MASSAR-)/i, '').trim().toUpperCase();
      matched = currentEventParticipants.find(p => p.massarNumber && p.massarNumber.trim().toUpperCase() === cleanMassar);
      if (matched) matchReason = `رقم مسار (${matched.massarNumber})`;
    }

    // B. Match by Bib Number (رقم الصدرية)
    if (!matched && bibQuery && !isNaN(Number(bibQuery))) {
      const numBib = Number(bibQuery);
      matched = currentEventParticipants.find(p => Number(p.bibNumber) === numBib || String(p.bibNumber).trim() === bibQuery);
      if (matched) matchReason = `رقم الصدرية (#${matched.bibNumber})`;
    }

    // C. Match by Lane Number (رقم الممر / المسار في الحلبة)
    if (!matched) {
      // Check if scanned code represents lane e.g. "ممر 3" or "LANE:3" or a single digit
      let laneNum: number | null = null;
      const laneMatch = cleaned.match(/(?:ممر|حارة|lane)[:\s-]*(\d+)/i);
      if (laneMatch) {
        laneNum = parseInt(laneMatch[1], 10);
      }
      if (laneNum !== null) {
        matched = currentEventParticipants.find(p => attendanceMap[p.id]?.lane === laneNum);
        if (matched) matchReason = `ممر السباق (ممر ${laneNum})`;
      }
    }

    // D. Match by Name (fuzzy normalized)
    if (!matched && nameQuery && nameQuery.length >= 3) {
      const normQuery = normalizeArabic(nameQuery);
      matched = currentEventParticipants.find(p => {
        const normP = normalizeArabic(p.studentName);
        return normP === normQuery || normP.includes(normQuery) || normQuery.includes(normP);
      });
      if (matched) matchReason = `الاسم (${matched.studentName})`;
    }

    // E. Search across all registered participants in championship as fallback
    if (!matched && (massarQuery || bibQuery || nameQuery)) {
      const cleanMassar = massarQuery.replace(/^(مسار-|MASSAR-)/i, '').trim().toUpperCase();
      matched = allParticipants.find(p =>
        (p.massarNumber && p.massarNumber.trim().toUpperCase() === cleanMassar) ||
        (bibQuery && String(p.bibNumber).trim() === bibQuery) ||
        (nameQuery && normalizeArabic(p.studentName) === normalizeArabic(nameQuery))
      );
      if (matched) matchReason = `قاعدة بيانات البطولة (${matched.studentName})`;
    }

    // Handled outcome
    if (!matched) {
      playWarningTone();
      toast.error(`⚠️ لم يتم العثور على متسابق برمز: "${cleaned}"`);
      return;
    }

    // Target lap check
    if (!currentTargetLap) {
      playWarningTone();
      toast.error('لا توجد مراتب وصول متاحة للتعيين حالياً');
      return;
    }

    // Check if participant is already assigned to a DIFFERENT rank
    const existingLap = recordedLaps.find(
      (l, idx) => idx !== currentTargetLap.origIdx && l.participantId === matched!.id
    );

    if (existingLap) {
      playWarningTone();
      setDuplicateWarning({
        participant: matched,
        existingRank: existingLap.rank,
        targetRank: currentTargetLap.rank,
        targetLapOrigIdx: currentTargetLap.origIdx
      });
      return;
    }

    // Proceed with assignment
    confirmAssignment(matched, currentTargetLap.origIdx, currentTargetLap.rank, matchReason);
  };

  // Perform assignment & trigger audio, toasts, auto-advance
  const confirmAssignment = (
    participant: AthleticsParticipantRecord,
    lapOrigIdx: number,
    rankNum: number,
    matchReason: string
  ) => {
    // Call parent handler
    onAssignParticipantToLap(lapOrigIdx, participant.id);

    // Audio & Visual feedback
    playSuccessChime();

    const assignedLane = attendanceMap[participant.id]?.lane;
    setLastScannedResult({
      participant,
      rank: rankNum,
      matchType: matchReason,
      lane: assignedLane,
      timestamp: Date.now()
    });

    toast.success(`🥇 المرتبة ${rankNum}: تم تعيين ${participant.studentName} بنجاح!`, {
      icon: '✅',
      duration: 3500
    });

    // Clear manual input
    setManualCodeInput('');

    // Auto-advance to the next unassigned rank if enabled
    if (autoAdvance) {
      setTimeout(() => {
        // Look for the next unassigned rank after current rank
        const remainingUnassigned = sortedLapsWithOrigIdx.filter(
          l => l.rank !== rankNum && (!l.participantId || l.origIdx === lapOrigIdx)
        );

        const nextEmpty = remainingUnassigned.find(l => l.rank > rankNum) || remainingUnassigned[0];
        if (nextEmpty) {
          setSelectedRankNumber(nextEmpty.rank);
        } else {
          // If all ranks are assigned, notify the user
          toast.success('🎉 تم تعيين كافة مراتب الوصول في هذا السباق بنجاح!', {
            icon: '🏆',
            duration: 4000
          });
        }
      }, 700);
    }
  };

  // Handle manual submit via barcode scanner gun or typing
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCodeInput.trim()) return;
    handleDecodedQr(manualCodeInput);
    if (manualInputRef.current) {
      manualInputRef.current.focus();
    }
  };

  // Navigation handlers between ranks
  const handlePrevRank = () => {
    const idx = sortedLapsWithOrigIdx.findIndex(l => l.rank === selectedRankNumber);
    if (idx > 0) {
      setSelectedRankNumber(sortedLapsWithOrigIdx[idx - 1].rank);
    }
  };

  const handleNextRank = () => {
    const idx = sortedLapsWithOrigIdx.findIndex(l => l.rank === selectedRankNumber);
    if (idx < sortedLapsWithOrigIdx.length - 1) {
      setSelectedRankNumber(sortedLapsWithOrigIdx[idx + 1].rank);
    }
  };

  if (!isOpen) return null;

  const totalAssigned = recordedLaps.filter(l => l.participantId).length;
  const totalLaps = recordedLaps.length;

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto">
      <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl flex flex-col max-h-[95vh] space-y-4 animate-in fade-in zoom-in-95 duration-150">
        
        {/* ========================================================================= */}
        {/* TOP HEADER BAR - Centered & Responsive on Mobile */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-2.5 sm:gap-4 border-b border-slate-800 pb-3 shrink-0">
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 text-center sm:text-right w-full sm:w-auto">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 shrink-0">
                <QrCode className="w-4 h-4 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-xs sm:text-lg font-black text-white tracking-tight">
                مسح كود الاستجابة (QR) لتحديد المتسابقين
              </h3>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                مسابقات الجري 🏃‍♂️
              </span>
            </div>
            {/* Details: hidden on mobile */}
            <p className="hidden sm:block text-xs text-slate-400 mt-0.5">
              مسح كود الصدرية أو رقم مسار لاختيار المتسابق تلقائياً حسب ترتيب وصوله عوض البحث بالاسم
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 w-full sm:w-auto shrink-0">
            {/* Sound Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                soundEnabled
                  ? 'bg-slate-800 text-emerald-400 border-slate-700 hover:bg-slate-700'
                  : 'bg-slate-800/50 text-slate-500 border-slate-800'
              }`}
              title={soundEnabled ? 'كتم الصوت' : 'تفعيل التنبيه الصوتي'}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SUBHEADER: RACE CONTEXT CHIPS & PROGRESS */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between gap-3 flex-wrap bg-slate-950/70 p-3 rounded-2xl border border-slate-800 shrink-0 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-1 bg-indigo-950/60 text-indigo-300 border border-indigo-800/80 rounded-xl font-black">
              🏁 {activeDiscipline?.nameAr || 'سباق الجري'}
            </span>
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-xl font-bold">
              الفئة: {selectedCategory}
            </span>
            <span className="px-2.5 py-1 bg-purple-950/60 text-purple-300 border border-purple-800/80 rounded-xl font-bold">
              {selectedGender === 'Male' ? 'ذكر (فتيان/شبان)' : 'أنثى (فتيات/شابات)'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto Advance Toggle */}
            <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-bold text-slate-300 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-700">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="w-3.5 h-3.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>انتقال تلقائي للمرتبة التالية</span>
              </span>
            </label>

            {/* Progress Badge */}
            <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-xl font-mono font-bold text-slate-300">
              تم التعيين: <span className="text-emerald-400 font-black">{totalAssigned}</span> / <span className="text-amber-400 font-black">{totalLaps}</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN BODY: 2-COLUMN LAYOUT (SCANNER / TARGET RANK + RANKS LIST) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 overflow-y-auto pr-0.5">
          
          {/* LEFT COLUMN: SCANNER VIEWPORT & CURRENT ACTIVE RANK (7 Cols) */}
          <div className="md:col-span-7 flex flex-col space-y-3.5">
            
            {/* Active Target Rank Indicator Card */}
            {currentTargetLap && (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-slate-950 border-2 border-emerald-500/50 shadow-lg flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`w-12 h-12 rounded-2xl font-black text-base flex items-center justify-center shrink-0 shadow-md ${
                    currentTargetLap.rank === 1
                      ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-400/50'
                      : currentTargetLap.rank === 2
                      ? 'bg-slate-300 text-slate-900'
                      : currentTargetLap.rank === 3
                      ? 'bg-orange-600 text-white'
                      : 'bg-emerald-600 text-white'
                  }`}>
                    {currentTargetLap.rank === 1 ? '🥇 1' : currentTargetLap.rank === 2 ? '🥈 2' : currentTargetLap.rank === 3 ? '🥉 3' : `#${currentTargetLap.rank}`}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-amber-300">
                        المرتبة المستهدفة للمسح الآن
                      </span>
                      <span className="text-sm font-mono font-black text-emerald-400 bg-slate-950 px-2.5 py-0.5 rounded-lg border border-slate-800">
                        ⏱️ {currentTargetLap.formattedTime}
                      </span>
                    </div>

                    {currentTargetLap.studentName ? (
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-white font-bold">
                        <span>✅ معين لـ:</span>
                        <span className="text-emerald-300 underline font-black">{currentTargetLap.studentName}</span>
                        <span className="text-slate-400">({currentTargetLap.schoolName})</span>
                        <span className="text-amber-400 font-mono">#{currentTargetLap.bibNumber}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-amber-400 font-bold block mt-1 animate-pulse">
                        ⚠️ بانتظار مسح كود QR أو إدخال رقم مسار للتعيين...
                      </span>
                    )}
                  </div>
                </div>

                {/* Prev / Next buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={handlePrevRank}
                    disabled={sortedLapsWithOrigIdx.findIndex(l => l.rank === selectedRankNumber) <= 0}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 cursor-pointer transition-colors"
                    title="المرتبة السابقة"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={handleNextRank}
                    disabled={sortedLapsWithOrigIdx.findIndex(l => l.rank === selectedRankNumber) >= sortedLapsWithOrigIdx.length - 1}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 cursor-pointer transition-colors"
                    title="المرتبة التالية"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Camera Viewport Container */}
            <div className="relative bg-black rounded-3xl overflow-hidden border-2 border-slate-800 min-h-[260px] sm:min-h-[300px] flex items-center justify-center flex-col shadow-inner">
              
              {/* HTML5 QR Code Mount Node */}
              <div
                id={qrRegionId}
                className="w-full h-full min-h-[260px] sm:min-h-[300px] [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
              />

              {/* Viewfinder Overlay Targeting Frame */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-56 h-56 sm:w-64 sm:h-64 border-2 border-emerald-400/70 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  {/* Corner accents */}
                  <span className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                  <span className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                  <span className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                  
                  {/* Scanning Laser Line */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
                  
                  <div className="absolute bottom-3 inset-x-0 text-center">
                    <span className="px-2.5 py-1 bg-black/70 backdrop-blur-md rounded-lg text-[10px] font-black text-emerald-300 border border-emerald-500/30">
                      وجّه الكاميرا نحو كود الصدرية أو رقم مسار
                    </span>
                  </div>
                </div>
              </div>

              {/* Camera Error Message Overlay */}
              {cameraError && (
                <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm p-5 flex flex-col items-center justify-center text-center space-y-3">
                  <AlertTriangle className="w-10 h-10 text-amber-500" />
                  <p className="text-xs font-bold text-slate-300 max-w-sm">
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>إعادة محاولة تشغيل الكاميرا</span>
                  </button>
                </div>
              )}

              {/* Floating Camera Controls (Switch camera) */}
              {availableCameras.length > 1 && (
                <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                  <select
                    value={selectedCameraId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedCameraId(id);
                      startCamera(id);
                    }}
                    className="px-2.5 py-1 bg-black/70 backdrop-blur-md border border-slate-700 text-white rounded-xl text-[11px] font-bold outline-none cursor-pointer"
                  >
                    {availableCameras.map(cam => (
                      <option key={cam.id} value={cam.id}>
                        📷 {cam.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Handheld Barcode Scanner / Manual Code Input Bar */}
            <form onSubmit={handleManualSubmit} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Keyboard className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    ref={manualInputRef}
                    type="text"
                    value={manualCodeInput}
                    onChange={(e) => setManualCodeInput(e.target.value)}
                    placeholder="امسح بالقارئ اليدوي (Barcode Gun) أو اكتب رقم مسار / الصدرية..."
                    className="w-full pr-9 pl-3 py-2.5 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-xs font-mono font-bold text-white placeholder-slate-500 outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!manualCodeInput.trim()}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-xs font-black cursor-pointer shadow-md flex items-center gap-1.5 transition-all shrink-0 active:scale-95"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>تأكيد التعيين</span>
                </button>
              </div>
              <span className="text-[10px] text-slate-500 block px-1">
                💡 يدعم قارئ الباركود اللاسلكي USB/Bluetooth مباشرة، ورقم مسار (Massar)، ورقم الصدرية، والاسم.
              </span>
            </form>

            {/* Last Scanned Result Banner */}
            {lastScannedResult && (
              <div className="p-3 bg-emerald-950/40 border border-emerald-600/60 rounded-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-center gap-2.5">
                  <span className="text-xl p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
                    ✅
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-white">
                        {lastScannedResult.participant.studentName}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded-md">
                        المرتبة #{lastScannedResult.rank}
                      </span>
                      {lastScannedResult.lane && (
                        <span className="text-[10px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md">
                          ممر {lastScannedResult.lane}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      🏫 {lastScannedResult.participant.schoolName} • الصدرية #{lastScannedResult.participant.bibNumber} • تم التعرف عبر {lastScannedResult.matchType}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Duplicate Warning Prompt */}
            {duplicateWarning && (
              <div className="p-3.5 bg-amber-950/50 border-2 border-amber-600/70 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h5 className="text-xs font-black text-amber-200">
                      تنبيه: المتسابق معين مسبقاً في وصول آخر!
                    </h5>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      المتسابق <strong className="text-white">{duplicateWarning.participant.studentName}</strong> معين حالياً في <strong className="text-amber-300">المرتبة {duplicateWarning.existingRank}</strong>. هل ترغب بنقله إلى <strong className="text-emerald-300">المرتبة {duplicateWarning.targetRank}</strong>؟
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setDuplicateWarning(null)}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      confirmAssignment(
                        duplicateWarning.participant,
                        duplicateWarning.targetLapOrigIdx,
                        duplicateWarning.targetRank,
                        'نقل المتسابق'
                      );
                      setDuplicateWarning(null);
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black transition-colors cursor-pointer shadow-md"
                  >
                    نعم، نقل المتسابق للمرتبة {duplicateWarning.targetRank}
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT COLUMN: ALL RECORDED RANKS LIST (5 Cols) */}
          <div className="md:col-span-5 bg-slate-950/80 border border-slate-800 rounded-3xl p-3.5 flex flex-col space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <h4 className="text-xs font-black text-white">ترتيب وصولات السباق</h4>
              </div>
              <span className="text-[10px] text-slate-400">
                اضغط على أي مرتبة لتوجيه المسح إليها
              </span>
            </div>

            {/* Ranks Scrollable List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-0.5 max-h-[380px] md:max-h-[460px]">
              {sortedLapsWithOrigIdx.map((lap) => {
                const isCurrent = lap.rank === selectedRankNumber;
                const isAssigned = !!lap.participantId;
                const lane = lap.participantId ? attendanceMap[lap.participantId]?.lane : null;

                return (
                  <button
                    key={lap.origIdx}
                    type="button"
                    onClick={() => setSelectedRankNumber(lap.rank)}
                    className={`w-full text-right p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                      isCurrent
                        ? 'bg-emerald-950/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/20'
                        : isAssigned
                        ? 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        : 'bg-slate-900/40 border-dashed border-amber-500/40 hover:border-amber-400/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      {/* Rank Badge */}
                      <span className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                        lap.rank === 1
                          ? 'bg-amber-500 text-slate-950'
                          : lap.rank === 2
                          ? 'bg-slate-300 text-slate-900'
                          : lap.rank === 3
                          ? 'bg-orange-600 text-white'
                          : isAssigned
                          ? 'bg-slate-800 text-slate-300'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {lap.rank === 1 ? '🥇 1' : lap.rank === 2 ? '🥈 2' : lap.rank === 3 ? '🥉 3' : `#${lap.rank}`}
                      </span>

                      <div className="overflow-hidden">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-black text-xs text-emerald-400">
                            {lap.formattedTime}
                          </span>
                          {lane && (
                            <span className="text-[9px] font-bold text-amber-300 bg-amber-950/70 border border-amber-600/40 px-1.5 py-0.2 rounded">
                              ممر {lane}
                            </span>
                          )}
                        </div>

                        {lap.studentName ? (
                          <span className="text-xs font-bold text-white truncate block">
                            ✅ {lap.studentName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400 font-bold block animate-pulse">
                            ⚠️ بانتظار التعيين عبر المسح
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      {isCurrent ? (
                        <span className="px-2 py-0.5 bg-emerald-600 text-white rounded-lg text-[9px] font-black">
                          🎯 الحالية
                        </span>
                      ) : isAssigned ? (
                        <span className="text-xs text-emerald-400">
                          ✓
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded text-[9px] font-bold">
                          مسح
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quick Helper Tip */}
            <div className="pt-2 border-t border-slate-800/80 flex items-start gap-1.5 text-[10px] text-slate-400">
              <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                يمكن مسح الصدريات الواحدة تلو الأخرى؛ وسيقوم النظام بتعيين المتسابق والانتقال التلقائي للمرتبة التالية.
              </span>
            </div>
          </div>

        </div>

        {/* ========================================================================= */}
        {/* MODAL FOOTER */}
        {/* ========================================================================= */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-3 shrink-0">
          <div className="text-xs text-slate-400">
            <span>إجمالي الوصولات: <strong className="text-white">{recordedLaps.length}</strong></span>
            <span className="mx-2">•</span>
            <span>المحددون: <strong className="text-emerald-400">{totalAssigned}</strong></span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-700/20 cursor-pointer active:scale-95 transition-all flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>إنهاء المسح والعودة للسباق</span>
          </button>
        </div>

      </div>
    </div>
  );
};
