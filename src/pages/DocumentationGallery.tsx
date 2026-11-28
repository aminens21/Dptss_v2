import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Camera,
  Plus,
  Trash2,
  Calendar,
  User,
  Filter,
  X,
  Eye,
  FileText,
  Download,
  ExternalLink,
  Link as LinkIcon,
  Check,
  UploadCloud,
  Trophy,
  RefreshCw,
  Image as ImageIcon
} from 'lucide-react';
import {
  DocumentationService,
  DocumentationPhoto,
  DocumentationItemType,
  compressImageFileToCode,
  DataService,
  SPORTS_MAP,
  areSportIdsEquivalent,
  normalizeCanonicalSportId,
  isTeamSport,
  isTrackOrCrossCountrySport
} from '../lib/dataService';
import { formatTeamDisplayName } from '../lib/drawTournamentUtils';
import { useNavigate } from 'react-router-dom';
import { useAuth, isSuperAdminEmail } from '../contexts/AuthContext';
import { Match, School, Sport, User as AppUser } from '../types';
import { isFlexibleEmailMatch } from '../lib/utils';
import toast from 'react-hot-toast';

export const DocumentationGallery: React.FC = () => {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<DocumentationPhoto[]>([]);
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [teachers, setTeachers] = useState<AppUser[]>([]);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<'ALL' | DocumentationItemType>('ALL');
  const [selectedSportFilter, setSelectedSportFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  // Add Modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [itemType, setItemType] = useState<DocumentationItemType>('match_photo');
  const [title, setTitle] = useState('');
  const [sportId, setSportId] = useState('ALL');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedPhotos, setSelectedPhotos] = useState<
    Array<{ id: string; preview: string; fileName: string; fileMimeType: string }>
  >([]);
  const [fileDataUrl, setFileDataUrl] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [fileMimeType, setFileMimeType] = useState<string>('');
  const [externalUrl, setExternalUrl] = useState<string>('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Live Camera Capture state
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Delete inline confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Full view / preview modal state
  const [viewItem, setViewItem] = useState<DocumentationPhoto | null>(null);

  const isCentralAdmin = useMemo(() => {
    if (!userProfile) return false;
    return (
      userProfile.role === 'CENTRAL_ADMIN' ||
      userProfile.role === 'SUPER_ADMIN' ||
      userProfile.isSuperAdmin === true ||
      isSuperAdminEmail(userProfile.email)
    );
  }, [userProfile]);

  const matchedTeacher = useMemo(() => {
    if (!userProfile || teachers.length === 0) return null;
    return (
      teachers.find(
        t =>
          (t.id && userProfile.id && t.id === userProfile.id) ||
          (t.email && userProfile.email && isFlexibleEmailMatch(t.email, userProfile.email)) ||
          (t.leaseNumber && userProfile.leaseNumber && t.leaseNumber === userProfile.leaseNumber)
      ) || null
    );
  }, [userProfile, teachers]);

  const isTechCommitteeHead = useMemo(() => {
    if (!userProfile) return false;
    return (
      userProfile.isTechCommitteeHead === true ||
      matchedTeacher?.isTechCommitteeHead === true ||
      userProfile.role === 'TECH_HEAD' ||
      (userProfile.role as string) === 'TECH_COMMITTEE_HEAD' ||
      matchedTeacher?.role === 'TECH_HEAD' ||
      (matchedTeacher?.role as string) === 'TECH_COMMITTEE_HEAD'
    );
  }, [userProfile, matchedTeacher]);

  const isScopedTechHead = isTechCommitteeHead && !isCentralAdmin;

  const assignedTechSports = useMemo(() => {
    if (!userProfile || !isScopedTechHead) return [] as string[];
    return Array.from(
      new Set(
        [
          ...(Array.isArray(userProfile.techCommitteeSports) ? userProfile.techCommitteeSports : []),
          ...(Array.isArray(matchedTeacher?.techCommitteeSports) ? matchedTeacher.techCommitteeSports : []),
          ...(userProfile.sportId ? [userProfile.sportId] : []),
          ...(matchedTeacher?.sportId ? [matchedTeacher.sportId] : [])
        ].filter(Boolean)
      )
    );
  }, [userProfile, matchedTeacher, isScopedTechHead]);

  // Restricted strictly to Technical Committee Head and Central Admin
  const canManage = isCentralAdmin || isTechCommitteeHead;

  const visibleSports = useMemo<Sport[]>(() => {
    if (!isScopedTechHead) return sportsConfig;
    if (assignedTechSports.length === 0) return [];
    const matched = sportsConfig.filter(s =>
      assignedTechSports.some(a => areSportIdsEquivalent(a, s.id, sportsConfig))
    );
    if (matched.length > 0) return matched;
    return assignedTechSports.map(key => ({
      id: key,
      name: SPORTS_MAP[key]?.name || key,
      icon: SPORTS_MAP[key]?.icon || '🏆',
      isIndividual: false,
      active: true
    }));
  }, [isScopedTechHead, assignedTechSports, sportsConfig]);

  const allowedSportsForUpload = visibleSports;

  useEffect(() => {
    if (!isScopedTechHead) return;
    if (visibleSports.length === 1) {
      if (selectedSportFilter !== visibleSports[0].id) {
        setSelectedSportFilter(visibleSports[0].id);
      }
    } else if (visibleSports.length > 1) {
      const stillValid =
        selectedSportFilter === 'ALL' ||
        visibleSports.some(s => areSportIdsEquivalent(s.id, selectedSportFilter, sportsConfig));
      if (!stillValid) {
        setSelectedSportFilter('ALL');
      }
    }
  }, [isScopedTechHead, visibleSports, selectedSportFilter, sportsConfig]);

  useEffect(() => {
    const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
    setLoading(true);

    const unsubDocs = DocumentationService.subscribeToDocumentationPhotos((list) => {
      setItems(list);
      setLoading(false);
    }, activeDirId);

    Promise.all([
      DataService.getSportsConfig().catch(() => [] as Sport[]),
      DataService.getMatches(activeDirId).catch(() => [] as Match[]),
      DataService.getSchools(activeDirId).catch(() => [] as School[]),
      DataService.getTeachers().catch(() => [] as AppUser[])
    ]).then(([sports, mtchs, schs, tchrs]) => {
      setSportsConfig(sports || []);
      setMatches(mtchs || []);
      setSchools(schs || []);
      setTeachers(tchrs || []);
    });

    return () => {
      unsubDocs();
    };
  }, []);

  const canDeleteItem = (item: DocumentationPhoto): boolean => {
    if (!canManage) return false;
    if (isCentralAdmin) return true;
    const myEmail = (userProfile?.email || currentUser?.email || '').trim().toLowerCase();
    if (myEmail && item.authorEmail && isFlexibleEmailMatch(item.authorEmail, myEmail)) return true;
    if (assignedTechSports.length > 0 && item.sportId) {
      return assignedTechSports.some(a => areSportIdsEquivalent(a, item.sportId, sportsConfig));
    }
    return false;
  };

  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOpen(false);
    setCameraError('');
  }, []);

  const startCameraStream = useCallback(async (mode: 'environment' | 'user' = cameraFacingMode) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast.error('المتصفح لا يدعم فتح العدسة المباشرة، استخدم زر "التقاط بالهاتف مباشرة"');
      return;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraError('');
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Camera access error:', err);
      setCameraError('تعذر تشغيل الكاميرا المباشرة. تأكد من منح الإذن للكاميرا أو استخدم زر "التقاط بالهاتف مباشرة".');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
    }
  }, [cameraFacingMode]);

  useEffect(() => {
    if (isCameraOpen && streamRef.current && videoRef.current && videoRef.current.srcObject !== streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => {});
    }
  }, [isCameraOpen, cameraError]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCaptureFrame = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      toast.error('يرجى الانتظار حتى تظهر صورة الكاميرا');
      return;
    }
    const maxWidth = 1000;
    const scale = video.videoWidth > maxWidth ? maxWidth / video.videoWidth : 1;
    const width = Math.round(video.videoWidth * scale);
    const height = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      toast.error('تعذر التقاط الصورة');
      return;
    }
    ctx.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const quota = getRemainingPhotoSlots();
    if (quota.remaining !== null && selectedPhotos.length >= quota.remaining) {
      toast.error(`تم بلوغ الحد الأقصى المسموح به (${quota.limit} صور)`);
      stopCameraStream();
      return;
    }
    setImagePreview(dataUrl);
    setSelectedPhotos(prev => [
      ...prev,
      {
        id: `cam-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        preview: dataUrl,
        fileName: `camera_${stamp}.jpg`,
        fileMimeType: 'image/jpeg'
      }
    ]);
    setFileName(`camera_${stamp}.jpg`);
    setFileMimeType('image/jpeg');
    stopCameraStream();
    toast.success('تم التقاط الصورة بنجاح 📸');
  };

  const resetModalForm = (targetType: DocumentationItemType) => {
    stopCameraStream();
    setItemType(targetType);
    setTitle('');
    setSelectedMatchId('');
    setDescription('');
    setImagePreview('');
    setSelectedPhotos([]);
    setFileDataUrl('');
    setFileName('');
    setFileMimeType('');
    setExternalUrl('');
    if (!isCentralAdmin && allowedSportsForUpload.length > 0) {
      setSportId(allowedSportsForUpload[0].id);
    } else {
      setSportId('ALL');
    }
  };

  const openAddModal = (targetType: DocumentationItemType) => {
    resetModalForm(targetType);
    setIsAddModalOpen(true);
  };

  const sportMatchesForDropdown = useMemo(() => {
    if (!sportId || sportId === 'ALL') {
      if (isScopedTechHead) {
        return matches
          .filter(m => assignedTechSports.some(a => areSportIdsEquivalent(m.sportId, a, sportsConfig)))
          .slice(0, 60);
      }
      return matches.slice(0, 40);
    }
    return matches
      .filter(m => areSportIdsEquivalent(m.sportId, sportId, sportsConfig))
      .slice(0, 60);
  }, [matches, sportId, isScopedTechHead, assignedTechSports, sportsConfig]);

  const scopedItems = useMemo(() => {
    if (!isScopedTechHead) return items;
    const myEmail = (userProfile?.email || currentUser?.email || '').trim().toLowerCase();
    if (assignedTechSports.length === 0) {
      return items.filter(item => Boolean(myEmail && item.authorEmail && isFlexibleEmailMatch(item.authorEmail, myEmail)));
    }
    return items.filter(item =>
      assignedTechSports.some(a => areSportIdsEquivalent(a, item.sportId, sportsConfig))
    );
  }, [items, isScopedTechHead, assignedTechSports, sportsConfig, userProfile, currentUser]);

  const counts = useMemo(() => {
    const photosCount = scopedItems.filter(i => (i.itemType || 'match_photo') === 'match_photo').length;
    const guidesCount = scopedItems.filter(i => i.itemType === 'guide_minutes').length;
    return { total: scopedItems.length, photosCount, guidesCount };
  }, [scopedItems]);

  const filteredItems = useMemo(() => {
    return scopedItems.filter(item => {
      const normalizedType: DocumentationItemType = item.itemType || 'match_photo';
      if (selectedTypeFilter !== 'ALL' && normalizedType !== selectedTypeFilter) return false;
      if (selectedSportFilter !== 'ALL' && item.sportId !== 'ALL' && !areSportIdsEquivalent(item.sportId, selectedSportFilter, sportsConfig)) {
        return false;
      }
      return true;
    });
  }, [scopedItems, selectedTypeFilter, selectedSportFilter, sportsConfig]);

  const getRemainingPhotoSlots = useCallback((): { limit: number | null; used: number; remaining: number | null } => {
    const canonicalSport = sportId === 'ALL' ? 'ALL' : normalizeCanonicalSportId(sportId, sportsConfig);
    if (canonicalSport !== 'ALL' && isTrackOrCrossCountrySport(canonicalSport)) {
      const used = items.filter(
        it => (it.itemType || 'match_photo') === 'match_photo' && areSportIdsEquivalent(it.sportId, canonicalSport, sportsConfig)
      ).length;
      return { limit: 16, used, remaining: Math.max(0, 16 - used) };
    }
    if (canonicalSport !== 'ALL' && isTeamSport(canonicalSport)) {
      if (selectedMatchId) {
        const used = items.filter(
          it => (it.itemType || 'match_photo') === 'match_photo' && it.matchId === selectedMatchId
        ).length;
        return { limit: 4, used, remaining: Math.max(0, 4 - used) };
      }
      const trimmedTitle = title.trim();
      const used = trimmedTitle
        ? items.filter(
            it =>
              (it.itemType || 'match_photo') === 'match_photo' &&
              !it.matchId &&
              areSportIdsEquivalent(it.sportId, canonicalSport, sportsConfig) &&
              it.title.trim() === trimmedTitle
          ).length
        : 0;
      return { limit: 4, used, remaining: Math.max(0, 4 - used) };
    }
    return { limit: null, used: 0, remaining: null };
  }, [sportId, selectedMatchId, title, items, sportsConfig]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pickedFiles: File[] = e.target.files ? Array.from<File>(e.target.files) : [];
    e.target.value = '';
    if (pickedFiles.length === 0) return;

    const validSizeFiles = pickedFiles.filter(f => f.size <= 15 * 1024 * 1024);
    if (validSizeFiles.length < pickedFiles.length) {
      toast.error('تم تجاهل بعض الصور لأن حجمها يتجاوز 15 ميجابايت');
    }
    if (validSizeFiles.length === 0) return;

    const quota = getRemainingPhotoSlots();
    let filesToProcess = validSizeFiles;
    if (quota.remaining !== null) {
      const slotsLeft = Math.max(0, quota.remaining - selectedPhotos.length);
      if (slotsLeft <= 0) {
        toast.error(`تم بلوغ الحد الأقصى المسموح به (${quota.limit} صور)`);
        return;
      }
      if (validSizeFiles.length > slotsLeft) {
        filesToProcess = validSizeFiles.slice(0, slotsLeft);
        toast.error(`الرصيد المتبقي يسمح بإضافة ${slotsLeft} صور فقط من أصل ${validSizeFiles.length}`);
      }
    }

    setIsProcessingFile(true);
    try {
      const processed: Array<{ id: string; preview: string; fileName: string; fileMimeType: string }> = [];
      for (let i = 0; i < filesToProcess.length; i++) {
        const file = filesToProcess[i];
        const compressedCode = await compressImageFileToCode(file, 1000, 0.72);
        processed.push({
          id: `img-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
          preview: compressedCode,
          fileName: file.name || `photo_${Date.now()}_${i}.jpg`,
          fileMimeType: 'image/jpeg'
        });
      }
      if (processed.length > 0) {
        setSelectedPhotos(prev => [...prev, ...processed]);
        setImagePreview(processed[0].preview);
        setFileName(processed[0].fileName);
        setFileMimeType('image/jpeg');
        stopCameraStream();
      }
    } catch (err) {
      console.error('Error compressing images:', err);
      toast.error('حدث خطأ أثناء ضغط الصور');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleDocumentChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setIsProcessingFile(true);
      try {
        const compressed = await compressImageFileToCode(file, 1200, 0.78);
        setImagePreview(compressed);
        setFileDataUrl(compressed);
        setFileName(file.name);
        setFileMimeType('image/jpeg');
      } catch {
        toast.error('تعذر معالجة صورة المحضر');
      } finally {
        setIsProcessingFile(false);
      }
      return;
    }

    // Firestore document limit ~1MB; cap raw binary files at ~650KB before base64 encoding
    if (file.size > 650 * 1024) {
      toast.error('حجم الملف يتجاوز 650 كيلوبايت. يرجى ضغط ملف PDF أو وضع رابطه السحابي (Google Drive) في خانة الرابط.');
      return;
    }

    setIsProcessingFile(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
      setFileDataUrl(dataUrl);
      setImagePreview('');
      setFileName(file.name);
      setFileMimeType(file.type || 'application/pdf');
    } catch {
      toast.error('تعذر قراءة الملف المرفق');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleMatchSelect = (mId: string) => {
    setSelectedMatchId(mId);
    if (!mId) return;
    const m = matches.find(item => item.id === mId);
    if (!m) return;
    const t1 = formatTeamDisplayName(m.team1Id, m.team1Name, schools, m.team1Placeholder, m.team1SourceMatchNumber);
    const t2 = formatTeamDisplayName(m.team2Id, m.team2Name, schools, m.team2Placeholder, m.team2SourceMatchNumber);
    const label = `${t1} ≠ ${t2}${m.stage ? ` (${m.stage})` : ''}`;
    if (!title.trim() || title.trim().startsWith('لقطات من')) {
      setTitle(`لقطات من المقابلة: ${t1} × ${t2}`);
    }
    if (!description.trim() && m.ageCategory) {
      setDescription(`${SPORTS_MAP[m.sportId]?.name || ''} — ${m.ageCategory}${m.stage ? ` • ${m.stage}` : ''}`);
    }
    void label;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      toast.error('النشر مقتصر فقط على رئيس اللجنة التقنية أو المسير المركزي');
      return;
    }
    if (!title.trim()) {
      toast.error('يرجى إدخال العنوان');
      return;
    }
    if (itemType === 'match_photo') {
      if (selectedPhotos.length === 0) {
        toast.error('يرجى إرفاق صورة واحدة على الأقل للمقابلة');
        return;
      }
      const canonicalSport = sportId === 'ALL' ? 'ALL' : normalizeCanonicalSportId(sportId, sportsConfig);
      if (canonicalSport !== 'ALL' && isTrackOrCrossCountrySport(canonicalSport)) {
        const existingPhotosCount = items.filter(
          it => (it.itemType || 'match_photo') === 'match_photo' && areSportIdsEquivalent(it.sportId, canonicalSport, sportsConfig)
        ).length;
        if (existingPhotosCount + selectedPhotos.length > 16) {
          const sportLabel = SPORTS_MAP[canonicalSport]?.name || SPORTS_MAP[sportId]?.name || sportId;
          const remaining = Math.max(0, 16 - existingPhotosCount);
          toast.error(`لا يمكن نشر أكثر من 16 صورة لألبوم ${sportLabel} (المتبقي المتاح: ${remaining}).`);
          return;
        }
      } else if (canonicalSport !== 'ALL' && isTeamSport(canonicalSport)) {
        if (selectedMatchId) {
          const existingForMatch = items.filter(
            it => (it.itemType || 'match_photo') === 'match_photo' && it.matchId === selectedMatchId
          ).length;
          if (existingForMatch + selectedPhotos.length > 4) {
            const remaining = Math.max(0, 4 - existingForMatch);
            toast.error(`الحد الأقصى لهذه المقابلة هو 4 صور (المتبقي المتاح: ${remaining}).`);
            return;
          }
        } else {
          const existingSameTitle = items.filter(
            it =>
              (it.itemType || 'match_photo') === 'match_photo' &&
              !it.matchId &&
              areSportIdsEquivalent(it.sportId, canonicalSport, sportsConfig) &&
              it.title.trim() === title.trim()
          ).length;
          if (existingSameTitle + selectedPhotos.length > 4) {
            const remaining = Math.max(0, 4 - existingSameTitle);
            toast.error(`الحد الأقصى لكل مقابلة هو 4 صور (المتبقي المتاح: ${remaining}).`);
            return;
          }
        }
      }
    }
    if (itemType === 'guide_minutes' && !fileDataUrl && !imagePreview && !externalUrl.trim() && !description.trim()) {
      toast.error('يرجى إرفاق ملف الدليل/المحضر أو رابط خارجي أو كتابة ملخص المحضر');
      return;
    }

    let matchLabel: string | undefined;
    if (selectedMatchId) {
      const m = matches.find(x => x.id === selectedMatchId);
      if (m) {
        const t1 = formatTeamDisplayName(m.team1Id, m.team1Name, schools, m.team1Placeholder, m.team1SourceMatchNumber);
        const t2 = formatTeamDisplayName(m.team2Id, m.team2Name, schools, m.team2Placeholder, m.team2SourceMatchNumber);
        matchLabel = `${t1} ≠ ${t2}`;
      }
    }

    setSubmitting(true);
    try {
      const now = Date.now();
      const baseDate = new Date(now).toISOString().split('T')[0];
      const authorName = userProfile?.fullName || currentUser?.displayName || (isCentralAdmin ? 'المسير المركزي' : 'رئيس اللجنة التقنية');
      const authorRole = isCentralAdmin ? 'المسير المركزي' : 'رئيس اللجنة التقنية';
      const authorEmail = userProfile?.email || currentUser?.email || '';
      const directorateId = DataService.getActiveDirectorateId() || 'taourirt';

      if (itemType === 'match_photo') {
        for (let idx = 0; idx < selectedPhotos.length; idx++) {
          const photoItem = selectedPhotos[idx];
          const newItem: DocumentationPhoto = {
            id: `doc-${now}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
            itemType: 'match_photo',
            title: title.trim(),
            sportId,
            imageCode: photoItem.preview,
            fileName: photoItem.fileName || undefined,
            fileMimeType: photoItem.fileMimeType || 'image/jpeg',
            matchId: selectedMatchId || undefined,
            matchLabel,
            description: description.trim() || undefined,
            date: baseDate,
            authorName,
            authorRole,
            authorEmail,
            directorateId,
            createdAt: new Date(now + idx).toISOString()
          };
          await DocumentationService.saveDocumentationPhoto(newItem);
        }
        toast.success(
          selectedPhotos.length > 1
            ? `تم نشر ${selectedPhotos.length} صور بنجاح في ألبوم الصور للعموم 📸`
            : 'تم نشر صورة المقابلة بنجاح في ألبوم الصور للعموم 📸'
        );
      } else {
        const newItem: DocumentationPhoto = {
          id: `doc-${now}-${Math.random().toString(36).substring(2, 7)}`,
          itemType: 'guide_minutes',
          title: title.trim(),
          sportId,
          imageCode: imagePreview || '',
          fileDataUrl: fileDataUrl || undefined,
          fileName: fileName || undefined,
          fileMimeType: fileMimeType || undefined,
          externalUrl: externalUrl.trim() || undefined,
          matchId: selectedMatchId || undefined,
          matchLabel,
          description: description.trim() || undefined,
          date: baseDate,
          authorName,
          authorRole,
          authorEmail,
          directorateId,
          createdAt: new Date(now).toISOString()
        };
        await DocumentationService.saveDocumentationPhoto(newItem);
        toast.success('تم نشر الدليل/المحضر بنجاح في قسم دلائل ومحاضر للعموم ✅');
      }
      resetModalForm(itemType);
      setIsAddModalOpen(false);
    } catch (err) {
      console.error('Error saving documentation item:', err);
      toast.error('حدث خطأ أثناء الحفظ والمزامنة السحابية');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const activeDirId = DataService.getActiveDirectorateId() || 'taourirt';
      await DocumentationService.deleteDocumentationPhoto(id, activeDirId);
      setConfirmDeleteId(null);
      toast.success('تم الحذف بنجاح');
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    }
  };

  const isImageDocument = (item: DocumentationPhoto) => {
    const src = item.imageCode || item.fileDataUrl || '';
    return src.startsWith('data:image/') || (item.fileMimeType || '').startsWith('image/');
  };

  const isPdfDocument = (item: DocumentationPhoto) => {
    const src = item.fileDataUrl || '';
    return src.startsWith('data:application/pdf') || (item.fileMimeType || '').includes('pdf') || (item.fileName || '').toLowerCase().endsWith('.pdf');
  };

  const handleCloseWindow = () => {
    stopCameraStream();
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(currentUser ? '/dashboard' : '/results');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 pb-10" dir="rtl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xl border border-slate-800 space-y-3.5 sm:space-y-0 sm:flex sm:flex-col lg:flex-row sm:items-center sm:justify-between sm:gap-5">
        <div className="space-y-1.5 sm:space-y-2 flex-1">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1.5 bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black">
              <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-400 shrink-0" />
              <span>فضاء النشر الرسمي للعموم</span>
            </div>
            <button
              type="button"
              onClick={handleCloseWindow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-rose-600 text-white border border-white/20 text-xs font-black transition-colors cursor-pointer shrink-0"
              title="إغلاق النافذة والعودة"
            >
              <X className="h-3.5 w-3.5" />
              <span>إغلاق</span>
            </button>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-right">التوثيق والصور</h1>
          <p className="text-[11px] sm:text-sm text-slate-300 max-w-2xl font-medium leading-relaxed text-right">
            {canManage
              ? 'نشر الدلائل والمحاضر الرسمية في قسم «دلائل ومحاضر» أو صور المقابلات في «ألبوم الصور» الموجه للعموم.'
              : 'استعراض الدلائل والمحاضر الرسمية وصور المقابلات المنشورة للعموم.'}
          </p>
        </div>

        {canManage && (
          <div className="grid grid-cols-2 sm:flex sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2.5 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={() => openAddModal('guide_minutes')}
              className="px-3 sm:px-4 py-2.5 sm:py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[11px] sm:text-sm rounded-xl sm:rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer border border-emerald-400/30"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">إضافة دليل أو محضر</span>
            </button>
            <button
              type="button"
              onClick={() => openAddModal('match_photo')}
              className="px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-black text-[11px] sm:text-sm rounded-xl sm:rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer border border-blue-400/30"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">إضافة صورة مقابلة</span>
            </button>
          </div>
        )}
      </div>

      {/* Type Tabs + Sport Filter Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-3xs space-y-2.5 sm:space-y-3">
        <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 pb-2.5 sm:pb-3 border-b border-slate-100">
          <button
            type="button"
            onClick={() => setSelectedTypeFilter('ALL')}
            className={`px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer text-center ${
              selectedTypeFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            الكل ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setSelectedTypeFilter('guide_minutes')}
            className={`px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
              selectedTypeFilter === 'guide_minutes'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate">دلائل ومحاضر ({counts.guidesCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedTypeFilter('match_photo')}
            className={`px-2 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
              selectedTypeFilter === 'match_photo'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
            }`}
          >
            <Camera className="h-3.5 w-3.5 shrink-0 hidden sm:inline" />
            <span className="truncate">صور ({counts.photosCount})</span>
          </button>
        </div>

        {/* Mobile Compact Sport Filter */}
        <div className="sm:hidden">
          {isScopedTechHead && visibleSports.length === 1 ? (
            <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
              <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold">
                <Filter className="h-3.5 w-3.5 text-blue-600" />
                <span>الرياضة المعنية:</span>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-black flex items-center gap-1">
                <span>{visibleSports[0].icon || '🏆'}</span>
                <span>{visibleSports[0].name}</span>
              </span>
            </div>
          ) : isScopedTechHead && visibleSports.length === 0 ? (
            <span className="block text-center px-3 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              لم يتم تعيين رياضة محددة لحسابك بعد
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-slate-600 text-xs font-bold shrink-0">
                <Filter className="h-3.5 w-3.5 text-blue-600" />
                <span>الرياضة:</span>
              </div>
              <select
                value={selectedSportFilter}
                onChange={(e) => setSelectedSportFilter(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden"
              >
                {!isScopedTechHead && <option value="ALL">🌟 جميع الرياضات</option>}
                {isScopedTechHead && visibleSports.length > 1 && (
                  <option value="ALL">🌟 رياضاتي المعنية</option>
                )}
                {visibleSports.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.icon || '🏆'} {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Desktop / Tablet Sport Filter Pills */}
        <div className="hidden sm:flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 ml-2 text-slate-500 text-xs font-bold">
            <Filter className="h-4 w-4 text-blue-600" />
            <span>{isScopedTechHead ? 'الرياضة المعنية:' : 'تصفية حسب الرياضة:'}</span>
          </div>
          {!isScopedTechHead && (
            <button
              type="button"
              onClick={() => setSelectedSportFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedSportFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              🌟 جميع الرياضات
            </button>
          )}
          {isScopedTechHead && visibleSports.length > 1 && (
            <button
              type="button"
              onClick={() => setSelectedSportFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedSportFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              🌟 رياضاتي المعنية
            </button>
          )}
          {visibleSports.map(s => (
            <button
              type="button"
              key={s.id}
              onClick={() => setSelectedSportFilter(s.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedSportFilter === s.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{s.icon || '🏆'}</span>
              <span>{s.name}</span>
            </button>
          ))}
          {isScopedTechHead && visibleSports.length === 0 && (
            <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
              لم يتم تعيين رياضة محددة لحسابك بعد
            </span>
          )}
        </div>
      </div>

      {/* Items Grid */}
      {loading ? (
        <div className="flex justify-center p-16">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-blue-600 border-t-transparent"></div>
        </div>
      ) : filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-5">
          {filteredItems.map((item) => {
            const isGuide = item.itemType === 'guide_minutes';
            const sportObj = sportsConfig.find(s => s.id === item.sportId);
            const sportName = item.sportId === 'ALL' ? 'جميع الرياضات' : (sportObj?.name || SPORTS_MAP[item.sportId]?.name || item.sportId);
            const sportIcon = item.sportId === 'ALL' ? '🌟' : (sportObj?.icon || SPORTS_MAP[item.sportId]?.icon || '🏆');
            const allowDelete = canDeleteItem(item);
            const downloadHref = item.fileDataUrl || item.imageCode || '';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border shadow-3xs overflow-hidden hover:shadow-lg transition-all flex flex-col group ${
                  isGuide ? 'border-emerald-200/80 hover:border-emerald-400' : 'border-slate-200 hover:border-blue-400'
                }`}
              >
                {!isGuide || item.imageCode ? (
                  <div
                    onClick={() => setViewItem(item)}
                    className="relative aspect-[4/3] bg-slate-900 overflow-hidden cursor-pointer"
                  >
                    <img
                      src={item.imageCode}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
                      <span className="text-white text-xs font-bold bg-blue-600/90 px-2.5 py-1 rounded-xl backdrop-blur-xs flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" />
                        <span>معاينة مكبرة</span>
                      </span>
                    </div>
                    <div className="absolute top-2.5 right-2.5 flex flex-wrap gap-1">
                      <span className="bg-slate-900/80 backdrop-blur-xs text-white border border-white/20 text-[10px] font-bold px-2 py-1 rounded-xl flex items-center gap-1">
                        <span>{sportIcon}</span>
                        <span>{sportName}</span>
                      </span>
                      {isGuide && (
                        <span className="bg-emerald-600/90 text-white text-[10px] font-black px-2 py-1 rounded-xl">
                          دليل / محضر
                        </span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setViewItem(item)}
                    className="relative aspect-[4/3] bg-gradient-to-br from-emerald-50 via-teal-50 to-slate-100 border-b border-emerald-100 flex flex-col items-center justify-center p-4 text-center cursor-pointer group-hover:from-emerald-100/70 transition-colors"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-white border border-emerald-200 shadow-sm flex items-center justify-center text-emerald-700 mb-2">
                      <FileText className="h-7 w-7" />
                    </div>
                    <span className="text-[11px] font-black text-emerald-900 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      دليل أو محضر رسمي
                    </span>
                    {item.fileName && (
                      <span className="text-[10px] font-bold text-slate-600 mt-1.5 truncate max-w-full px-2">
                        {item.fileName}
                      </span>
                    )}
                    <div className="absolute top-2.5 right-2.5">
                      <span className="bg-white/90 text-slate-800 border border-slate-200 text-[10px] font-bold px-2 py-1 rounded-xl flex items-center gap-1 shadow-2xs">
                        <span>{sportIcon}</span>
                        <span>{sportName}</span>
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1.5">
                    <h3 className="text-sm font-black text-slate-900 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                      {item.title}
                    </h3>
                    {item.matchLabel && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                        <Trophy className="w-3 h-3 shrink-0" />
                        <span className="truncate">{item.matchLabel}</span>
                      </span>
                    )}
                    {item.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-medium">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2.5 pt-2.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                      <div className="flex items-center gap-1.5 truncate">
                        <User className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                        <span className="truncate">{item.authorName}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        <span>{item.date}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewItem(item)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="h-3 w-3" />
                          <span>معاينة</span>
                        </button>
                        {downloadHref && (
                          <a
                            href={downloadHref}
                            download={item.fileName || `${item.title}.${isPdfDocument(item) ? 'pdf' : 'jpg'}`}
                            className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1"
                          >
                            <Download className="h-3 w-3" />
                            <span>تحميل</span>
                          </a>
                        )}
                        {item.externalUrl && (
                          <a
                            href={item.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[11px] font-bold transition-colors flex items-center gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>فتح الرابط</span>
                          </a>
                        )}
                      </div>

                      {allowDelete && (
                        confirmDeleteId === item.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDelete(item.id)}
                              className="px-2 py-1 bg-rose-600 text-white rounded-lg text-[10px] font-black cursor-pointer"
                            >
                              تأكيد الحذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-slate-100 text-slate-600 rounded-lg text-[10px] font-bold cursor-pointer"
                            >
                              تراجع
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>حذف</span>
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
            {selectedTypeFilter === 'guide_minutes' ? '📄' : '🖼️'}
          </div>
          <h3 className="text-base font-black text-slate-800">لا توجد عناصر منشورة بعد في هذا القسم</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto font-medium">
            {canManage
              ? 'اضغط على "إضافة دليل أو محضر" أو "إضافة صورة مقابلة" لنشر المحتوى مباشرة للعموم.'
              : 'سيظهر هنا كل ما يتم نشره من دلائل ومحاضر وصور مقابلات من طرف رئيس اللجنة التقنية أو المسير المركزي.'}
          </p>
        </div>
      )}

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4" dir="rtl">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold">
                  {itemType === 'guide_minutes' ? <FileText className="h-5 w-5" /> : <Camera className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-base font-black">
                    {itemType === 'guide_minutes' ? 'إضافة دليل أو محضر للعموم' : 'إضافة صورة مقابلة لألبوم الصور'}
                  </h3>
                  <p className="text-xs text-slate-300">
                    {itemType === 'guide_minutes'
                      ? 'سيظهر مباشرة في قسم "دلائل ومحاضر" على الواجهة العمومية'
                      : 'ستظهر مباشرة في "ألبوم الصور" الموجه للعموم'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setIsAddModalOpen(false);
                }}
                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4 flex-1">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                <button
                  type="button"
                  onClick={() => resetModalForm('match_photo')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    itemType === 'match_photo'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Camera className="h-4 w-4" />
                  <span>صورة مقابلة (ألبوم الصور)</span>
                </button>
                <button
                  type="button"
                  onClick={() => resetModalForm('guide_minutes')}
                  className={`py-2.5 px-3 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    itemType === 'guide_minutes'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  <span>دليل أو محضر رسمي</span>
                </button>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  {itemType === 'guide_minutes' ? 'عنوان الدليل أو المحضر *' : 'عنوان الصورة أو المقابلة *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    itemType === 'guide_minutes'
                      ? 'مثال: محضر اجتماع اللجنة التقنية لكرة اليد / دليل البطولة الإقليمية'
                      : 'مثال: لقطات من نهائي كرة اليد إناث أقل من 15 سنة'
                  }
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">الرياضة المعنية *</label>
                <select
                  value={sportId}
                  onChange={(e) => {
                    setSportId(e.target.value);
                    setSelectedMatchId('');
                  }}
                  disabled={isScopedTechHead && allowedSportsForUpload.length === 1}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all cursor-pointer disabled:opacity-80 disabled:cursor-not-allowed"
                >
                  {!isScopedTechHead && (
                    <option value="ALL">🌟 عام (يظهر في جميع الرياضات)</option>
                  )}
                  {allowedSportsForUpload.map(s => (
                    <option key={s.id} value={s.id}>{s.icon || '🏆'} {s.name}</option>
                  ))}
                </select>
                {itemType === 'match_photo' && sportId !== 'ALL' && (() => {
                  const canonical = normalizeCanonicalSportId(sportId, sportsConfig);
                  if (isTrackOrCrossCountrySport(canonical)) {
                    const count = items.filter(
                      it => (it.itemType || 'match_photo') === 'match_photo' && areSportIdsEquivalent(it.sportId, canonical, sportsConfig)
                    ).length;
                    const isFull = count >= 16;
                    return (
                      <div className={`mt-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between border ${
                        isFull
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}>
                        <span>
                          {isFull
                            ? 'تم بلوغ الحد الأقصى لألبوم هذه الرياضة (16 صورة)'
                            : 'الرصيد المتاح في ألبوم هذه الرياضة:'}
                        </span>
                        <span className="font-mono font-black">{count} / 16</span>
                      </div>
                    );
                  }
                  if (isTeamSport(canonical)) {
                    return (
                      <div className="mt-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between border bg-blue-50 text-blue-800 border-blue-200">
                        <span>الرصيد المتاح في الألبوم:</span>
                        <span className="font-black">4 صور لكل مقابلة</span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Optional match link for match photos */}
              {itemType === 'match_photo' && sportMatchesForDropdown.length > 0 && (
                <div>
                  <label className="block text-xs font-black text-slate-700 mb-1">ربط بمقابلة مبرمجة (اختياري)</label>
                  <select
                    value={selectedMatchId}
                    onChange={(e) => handleMatchSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all cursor-pointer"
                  >
                    <option value="">-- بدون ربط بمقابلة محددة --</option>
                    {sportMatchesForDropdown.map(m => {
                      const t1 = formatTeamDisplayName(m.team1Id, m.team1Name, schools, m.team1Placeholder, m.team1SourceMatchNumber);
                      const t2 = formatTeamDisplayName(m.team2Id, m.team2Name, schools, m.team2Placeholder, m.team2SourceMatchNumber);
                      const matchPhotoCount = items.filter(
                        it => (it.itemType || 'match_photo') === 'match_photo' && it.matchId === m.id
                      ).length;
                      return (
                        <option key={m.id} value={m.id}>
                          {SPORTS_MAP[m.sportId]?.icon || '🏆'} {t1} ≠ {t2} {m.ageCategory ? `(${m.ageCategory})` : ''} — [{matchPhotoCount}/4 صور]
                        </option>
                      );
                    })}
                  </select>
                  {selectedMatchId && (() => {
                    const matchCount = items.filter(
                      it => (it.itemType || 'match_photo') === 'match_photo' && it.matchId === selectedMatchId
                    ).length;
                    const isMatchFull = matchCount >= 4;
                    return (
                      <div className={`mt-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center justify-between border ${
                        isMatchFull
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      }`}>
                        <span>
                          {isMatchFull
                            ? 'تم بلوغ الحد الأقصى لهذه المقابلة (4 صور)'
                            : 'الرصيد المتاح لهذه المقابلة:'}
                        </span>
                        <span className="font-mono font-black">{matchCount} / 4</span>
                      </div>
                    );
                  })()}
                </div>
              )}

              {itemType === 'match_photo' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-black text-slate-700">صورة المقابلة *</label>

                  {/* Native Mobile Camera + Device Gallery Picker */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-amber-400 hover:border-amber-500 rounded-2xl bg-amber-50/70 hover:bg-amber-50 transition-colors cursor-pointer text-center gap-1.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                        <Camera className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-black text-slate-800">التقاط صورة بكاميرا الهاتف</span>
                      <span className="text-[10px] text-slate-500">يفتح كاميرا الهاتف الخلفية مباشرة</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>

                    <label className="flex flex-col items-center justify-center p-3.5 border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl bg-slate-50 hover:bg-blue-50/40 transition-colors cursor-pointer text-center gap-1.5">
                      <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-black text-slate-800">اختيار من المعرض / الجهاز</span>
                      <span className="text-[10px] text-slate-500">يمكنك تحديد أكثر من صورة دفعة واحدة</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* Direct In-App Camera Viewfinder Toggle */}
                  {!isCameraOpen && (
                    <button
                      type="button"
                      onClick={() => void startCameraStream(cameraFacingMode)}
                      className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-black transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Camera className="h-3.5 w-3.5 text-amber-400" />
                      <span>أو فتح عدسة الكاميرا المباشرة هنا لالتقاط الصورة</span>
                    </button>
                  )}

                  {/* Live Camera Viewfinder Box */}
                  {isCameraOpen && (
                    <div className="rounded-2xl overflow-hidden border-2 border-blue-500 bg-slate-950 p-2 space-y-2">
                      {cameraError ? (
                        <div className="p-4 text-center space-y-2">
                          <p className="text-xs font-bold text-rose-300">{cameraError}</p>
                          <button
                            type="button"
                            onClick={stopCameraStream}
                            className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold cursor-pointer"
                          >
                            إغلاق
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="relative aspect-video rounded-xl overflow-hidden bg-black">
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={handleCaptureFrame}
                              className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                            >
                              <Camera className="h-4 w-4" />
                              <span>التقاط الصورة الآن</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const nextMode = cameraFacingMode === 'environment' ? 'user' : 'environment';
                                setCameraFacingMode(nextMode);
                                void startCameraStream(nextMode);
                              }}
                              title="تبديل الكاميرا الأمامية/الخلفية"
                              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">تبديل العدسة</span>
                            </button>
                            <button
                              type="button"
                              onClick={stopCameraStream}
                              className="py-2.5 px-3 bg-rose-600/90 hover:bg-rose-600 text-white rounded-xl text-xs font-bold cursor-pointer"
                            >
                              إلغاء
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {isProcessingFile && (
                    <p className="text-[11px] text-blue-600 font-bold mt-1.5">جاري ضغط ومعالجة الصور المختارة...</p>
                  )}
                  {selectedPhotos.length > 0 && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-black text-slate-700">
                        <span>الصور المحددة للنشر ({selectedPhotos.length})</span>
                        {selectedPhotos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPhotos([]);
                              setImagePreview('');
                              setFileName('');
                            }}
                            className="text-rose-600 hover:text-rose-700 font-bold cursor-pointer"
                          >
                            إزالة الكل
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {selectedPhotos.map((ph) => (
                          <div
                            key={ph.id}
                            className="relative aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-slate-900"
                          >
                            <img src={ph.preview} alt={ph.fileName} className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPhotos(prev => {
                                  const next = prev.filter(p => p.id !== ph.id);
                                  setImagePreview(next[0]?.preview || '');
                                  setFileName(next[0]?.fileName || '');
                                  return next;
                                });
                              }}
                              title="إزالة الصورة"
                              className="absolute top-1.5 left-1.5 w-6 h-6 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg flex items-center justify-center cursor-pointer shadow-sm"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      إرفاق ملف الدليل أو المحضر (PDF، Word، أو صورة المحضر)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="sm:col-span-2 flex flex-col items-center justify-center p-4 border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-2xl bg-emerald-50/40 hover:bg-emerald-50 transition-colors cursor-pointer text-center gap-1.5">
                        <UploadCloud className="h-6 w-6 text-emerald-600" />
                        <span className="text-xs font-black text-slate-700">
                          {fileName ? `تم اختيار الملف: ${fileName}` : 'اضغط لاختيار ملف PDF / Word / صورة'}
                        </span>
                        <span className="text-[10px] text-slate-500">الحد الأقصى لملفات PDF/Word المباشرة: 650 كيلوبايت</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,image/*"
                          onChange={handleDocumentChange}
                          className="hidden"
                        />
                      </label>
                      <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-amber-300 hover:border-amber-500 rounded-2xl bg-amber-50/50 hover:bg-amber-50 transition-colors cursor-pointer text-center gap-1.5">
                        <Camera className="h-5 w-5 text-amber-600" />
                        <span className="text-xs font-black text-slate-800">تصوير المحضر بالهاتف</span>
                        <span className="text-[10px] text-slate-500">التقاط مباشر بالكاميرا</span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handleDocumentChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                    {isProcessingFile && (
                      <p className="text-[11px] text-emerald-600 font-bold mt-1.5">جاري تجهيز الملف...</p>
                    )}
                    {imagePreview && (
                      <div className="mt-3 relative aspect-video rounded-xl overflow-hidden border border-slate-200 bg-slate-900">
                        <img src={imagePreview} alt="Document preview" className="w-full h-full object-contain" />
                      </div>
                    )}
                    {fileDataUrl && !imagePreview && (
                      <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <Check className="h-4 w-4 shrink-0" />
                        <span className="truncate">الملف جاهز للنشر: {fileName}</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-black text-slate-700 mb-1">
                      أو رابط خارجي للدليل / المحضر (Google Drive / PDF — اختياري)
                    </label>
                    <div className="relative">
                      <LinkIcon className="h-4 w-4 text-slate-400 absolute right-3 top-3" />
                      <input
                        type="url"
                        placeholder="https://..."
                        value={externalUrl}
                        onChange={(e) => setExternalUrl(e.target.value)}
                        className="w-full pr-9 pl-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-black text-slate-700 mb-1">
                  {itemType === 'guide_minutes' ? 'ملخص أو مضمون المحضر / الدليل (اختياري)' : 'وصف تفصيلي (اختياري)'}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    itemType === 'guide_minutes'
                      ? 'أدخل خلاصة القرارات التقنية أو توصيات المحضر...'
                      : 'أدخل تفاصيل موجزة عن المقابلة أو المؤسسات المشاركة...'
                  }
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:border-blue-600 focus:outline-hidden transition-all"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    stopCameraStream();
                    setIsAddModalOpen(false);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={submitting || isProcessingFile}
                  className={`px-5 py-2 text-white font-black text-xs rounded-xl transition-colors shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-1.5 ${
                    itemType === 'guide_minutes' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {submitting
                    ? 'جاري النشر...'
                    : itemType === 'guide_minutes'
                    ? 'نشر الدليل / المحضر للعموم'
                    : selectedPhotos.length > 1
                    ? `نشر ${selectedPhotos.length} صور في الألبوم للعموم`
                    : 'نشر الصورة في الألبوم للعموم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Size Preview Modal */}
      {viewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-md p-3 sm:p-6" dir="rtl">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] border border-slate-800">
            <div className="p-4 bg-slate-900 text-white flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-black truncate">{viewItem.title}</h3>
                <span className="text-[11px] text-blue-300 font-medium">
                  بواسطة: {viewItem.authorName} — {viewItem.date}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(viewItem.fileDataUrl || viewItem.imageCode) && (
                  <a
                    href={viewItem.fileDataUrl || viewItem.imageCode}
                    download={viewItem.fileName || `${viewItem.title}.${isPdfDocument(viewItem) ? 'pdf' : 'jpg'}`}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>تحميل</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setViewItem(null)}
                  className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="bg-slate-950 flex-1 flex items-center justify-center p-2 sm:p-4 overflow-auto min-h-[240px]">
              {isImageDocument(viewItem) || viewItem.imageCode ? (
                <img
                  src={viewItem.imageCode || viewItem.fileDataUrl}
                  alt={viewItem.title}
                  className="max-h-[70vh] max-w-full object-contain rounded-xl"
                />
              ) : isPdfDocument(viewItem) && viewItem.fileDataUrl ? (
                <iframe
                  src={viewItem.fileDataUrl}
                  title={viewItem.title}
                  className="w-full h-[65vh] rounded-xl bg-white"
                />
              ) : (
                <div className="bg-white rounded-2xl p-6 max-w-lg w-full text-center space-y-3">
                  <FileText className="h-12 w-12 text-emerald-600 mx-auto" />
                  <p className="text-sm font-black text-slate-900">{viewItem.fileName || viewItem.title}</p>
                  {viewItem.description && (
                    <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line text-right bg-slate-50 p-3 rounded-xl border border-slate-200">
                      {viewItem.description}
                    </p>
                  )}
                  <div className="flex items-center justify-center gap-2 pt-2">
                    {viewItem.fileDataUrl && (
                      <a
                        href={viewItem.fileDataUrl}
                        download={viewItem.fileName || `${viewItem.title}`}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5"
                      >
                        <Download className="h-4 w-4" />
                        <span>تحميل الملف</span>
                      </a>
                    )}
                    {viewItem.externalUrl && (
                      <a
                        href={viewItem.externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-1.5"
                      >
                        <ExternalLink className="h-4 w-4" />
                        <span>فتح الرابط الخارجي</span>
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>

            {viewItem.description && (isImageDocument(viewItem) || isPdfDocument(viewItem)) && (
              <div className="p-4 bg-slate-50 border-t border-slate-200 text-xs text-slate-700 font-medium whitespace-pre-line">
                {viewItem.description}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
