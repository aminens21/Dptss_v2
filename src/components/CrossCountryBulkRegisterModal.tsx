import React, { useState, useEffect, useMemo, useRef } from 'react';
import { School, Student, User, Tournament } from '../types';
import { DataService, validateBirthDateForCategory, normalizeCategoryKey, getCategoryGenderLabel, getCategoryYearsLabel, isSchoolLevelAllowedForTournament, getTournamentLevelAr } from '../lib/dataService';
import { CROSS_COUNTRY_CATEGORIES, CrossCountryCategoryDef } from '../lib/crossCountryConfig';
import { useAuth } from '../contexts/AuthContext';
import * as XLSX from 'xlsx';
import {
  X,
  Users,
  FileSpreadsheet,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Building2,
  Sparkles,
  ClipboardPaste,
  Info,
  Lock,
  RefreshCw,
  FileText,
  Check,
  Award,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface ParticipantSlot {
  slotIndex: number; // 0..7
  participationType: 'individual' | 'school_team';
  existingStudentId?: string;
  fullName: string;
  massarNumber: string;
  birthDate: string;
  photoUrl?: string;
}

interface CrossCountryBulkRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  schools: School[];
  initialCategoryDefId?: string;
  preselectedSchoolId?: string;
  preselectedSchoolName?: string;
  allExistingStudents?: Student[];
  onRegistered: () => void;
  currentSeason?: string;
  affiliationType?: 'non_club' | 'club_affiliated' | 'open';
  tournaments?: Tournament[];
}

export const CrossCountryBulkRegisterModal: React.FC<CrossCountryBulkRegisterModalProps> = ({
  isOpen,
  onClose,
  schools,
  initialCategoryDefId = 'u15_male',
  preselectedSchoolId,
  preselectedSchoolName,
  allExistingStudents = [],
  onRegistered,
  currentSeason: initialSeason = '2026/2027',
  affiliationType = 'non_club',
  tournaments = []
}) => {
  const { userProfile } = useAuth();
  const isTeacher = userProfile?.role === 'TEACHER';
  const [currentSeason, setCurrentSeason] = useState(initialSeason);

  // Filter categories based on programmed tournaments
  const availableRaceCategories = useMemo(() => {
    if (!tournaments || tournaments.length === 0) {
      return CROSS_COUNTRY_CATEGORIES;
    }
    const ccTournaments = tournaments.filter(t => t.sportId === 'cross_country');
    if (ccTournaments.length === 0) {
      return CROSS_COUNTRY_CATEGORIES;
    }

    return CROSS_COUNTRY_CATEGORIES.filter(cat => {
      return ccTournaments.some(t => {
        const matchesCategory = normalizeCategoryKey(t.ageCategory) === normalizeCategoryKey(cat.category);
        const matchesGender = t.gender === 'Both' || t.gender === 'Mixed' || t.gender === cat.gender;
        return matchesCategory && matchesGender;
      });
    });
  }, [tournaments]);

  const finalCategories = useMemo(() => {
    return availableRaceCategories.length > 0 ? availableRaceCategories : CROSS_COUNTRY_CATEGORIES;
  }, [availableRaceCategories]);

  // Selected race definition
  const [selectedRaceId, setSelectedRaceId] = useState<string>(initialCategoryDefId);
  const activeRaceDef: CrossCountryCategoryDef = useMemo(() => {
    return finalCategories.find(c => c.id === selectedRaceId) || finalCategories[0] || CROSS_COUNTRY_CATEGORIES[0];
  }, [selectedRaceId, finalCategories]);

  const activeYearsLabel = useMemo(() => {
    return getCategoryYearsLabel(activeRaceDef.category, currentSeason, 'cross_country');
  }, [activeRaceDef.category, currentSeason]);

  // Filter programmed affiliation types for cross country
  const ccTourns = useMemo(() => {
    if (!tournaments) return [];
    return tournaments.filter(t => t.sportId === 'cross_country');
  }, [tournaments]);

  const hasClub = useMemo(() => {
    if (ccTourns.length === 0) return true;
    return ccTourns.some(t => t.affiliationType === 'club_affiliated' || t.affiliationType === 'open' || t.affiliationType === 'both');
  }, [ccTourns]);

  const hasSchool = useMemo(() => {
    if (ccTourns.length === 0) return true;
    return ccTourns.some(t => !t.affiliationType || t.affiliationType === 'non_club' || t.affiliationType === 'open' || t.affiliationType === 'both');
  }, [ccTourns]);

  const [selectedAffiliation, setSelectedAffiliation] = useState<'non_club' | 'club_affiliated'>('non_club');

  // Sync selected race when opened
  useEffect(() => {
    if (isOpen) {
      if (initialCategoryDefId && finalCategories.some(c => c.id === initialCategoryDefId)) {
        setSelectedRaceId(initialCategoryDefId);
      } else if (finalCategories.length > 0) {
        setSelectedRaceId(finalCategories[0].id);
      }
    }
  }, [isOpen, initialCategoryDefId, finalCategories]);

  // Sync affiliation when modal opens, adaptive to programmed settings
  useEffect(() => {
    if (isOpen) {
      if (hasSchool && !hasClub) {
        setSelectedAffiliation('non_club');
      } else if (hasClub && !hasSchool) {
        setSelectedAffiliation('club_affiliated');
      } else {
        setSelectedAffiliation(affiliationType === 'club_affiliated' ? 'club_affiliated' : 'non_club');
      }
    }
  }, [isOpen, hasClub, hasSchool, affiliationType]);

  // Computed custom championship title
  const customTitle = useMemo(() => {
    if (tournaments && tournaments.length > 0) {
      const ccTourn = tournaments.find(t => t.sportId === 'cross_country');
      if (ccTourn && ccTourn.name) {
        const raw = ccTourn.name;
        const clean = raw.split(/\s*-\s*(?:البرعمات|البراعم|الصغيرات|الصغار|الفتيات|الفتيان|الشابات|الشبان|ذكور|إناث|مختلط|U12|U15|U18|U20|جميع الفئات|فئة|صغار|فتيان|شبان|براعم|صغيرات|فتيات|شابات|برعمات|لا منتمين|للمنتمين للأندية|مفتوحة|مواليد|السلك|دوري)/i)[0].trim();
        if (clean && clean.length >= 3) return clean;
        return raw.split(/\s*-\s*/)[0].trim() || raw;
      }
    }
    return 'البطولة الإقليمية المدرسية للعدو الريفي';
  }, [tournaments]);

  // Selected school
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');

  // Coach Details
  const [coachName, setCoachName] = useState<string>('');
  const [coachLeaseNumber, setCoachLeaseNumber] = useState<string>('');
  const [coachPhone, setCoachPhone] = useState<string>('');
  const [isCoachCollapsed, setIsCoachCollapsed] = useState<boolean>(true);

  // Quick Paste Modal State
  const [isPasteModalOpen, setIsPasteModalOpen] = useState<boolean>(false);
  const [pasteText, setPasteText] = useState<string>('');

  // Submitting state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // File input ref for Excel upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize 8 slots: 3 individual (slots 0, 1, 2) and 5 school_team (slots 3, 4, 5, 6, 7)
  const defaultSlots: ParticipantSlot[] = useMemo(() => [
    { slotIndex: 0, participationType: 'individual', fullName: '', massarNumber: '', birthDate: '' },
    { slotIndex: 1, participationType: 'individual', fullName: '', massarNumber: '', birthDate: '' },
    { slotIndex: 2, participationType: 'individual', fullName: '', massarNumber: '', birthDate: '' },
    { slotIndex: 3, participationType: 'school_team', fullName: '', massarNumber: '', birthDate: '' },
    { slotIndex: 4, participationType: 'school_team', fullName: '', massarNumber: '', birthDate: '' },
    { slotIndex: 5, participationType: 'school_team', fullName: '', massarNumber: '', birthDate: '' },
    { slotIndex: 6, participationType: 'school_team', fullName: '', massarNumber: '', birthDate: '' },
    { slotIndex: 7, participationType: 'school_team', fullName: '', massarNumber: '', birthDate: '' },
  ], []);

  const [slots, setSlots] = useState<ParticipantSlot[]>(defaultSlots);

  // Fetch active season
  useEffect(() => {
    DataService.getActiveSeason().then(s => {
      if (s) setCurrentSeason(s);
    });
  }, []);

  // Sync initial category def when opened
  useEffect(() => {
    if (isOpen && initialCategoryDefId) {
      setSelectedRaceId(initialCategoryDefId);
    }
  }, [isOpen, initialCategoryDefId]);

  // Sync selected school on open
  useEffect(() => {
    if (!isOpen) return;

    if (isTeacher) {
      if (userProfile?.workLocation) {
        const match = schools.find(s =>
          s.name && (
            s.name.trim().toLowerCase() === userProfile.workLocation!.trim().toLowerCase() ||
            s.name.includes(userProfile.workLocation!) ||
            userProfile.workLocation!.includes(s.name)
          )
        );
        setSelectedSchoolId(match ? match.id : (userProfile.id || 'teacher_school'));
      }
    } else if (preselectedSchoolId) {
      setSelectedSchoolId(preselectedSchoolId);
    } else if (preselectedSchoolName) {
      const match = schools.find(s =>
        s.name && (
          s.name.trim().toLowerCase() === preselectedSchoolName.trim().toLowerCase() ||
          s.name.includes(preselectedSchoolName) ||
          preselectedSchoolName.includes(s.name)
        )
      );
      if (match) setSelectedSchoolId(match.id);
      else if (schools.length > 0) setSelectedSchoolId(schools[0].id);
    } else if (schools.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(schools[0].id);
    }

    // Default coach info
    setCoachName(userProfile?.fullName || '');
    setCoachLeaseNumber(userProfile?.leaseNumber || '');
    setCoachPhone(userProfile?.phone || '');
  }, [isOpen, isTeacher, userProfile, schools, preselectedSchoolId, preselectedSchoolName]);

  // Resolved school object and name
  const resolvedSchool = useMemo(() => {
    return schools.find(s => s.id === selectedSchoolId);
  }, [schools, selectedSchoolId]);

  const resolvedSchoolName = useMemo(() => {
    if (isTeacher && userProfile?.workLocation) return userProfile.workLocation;
    return resolvedSchool?.name || preselectedSchoolName || userProfile?.workLocation || 'المؤسسة التعليمية';
  }, [isTeacher, userProfile, resolvedSchool, preselectedSchoolName]);

  // Auto-populate slots from existing students matching this school, race category, and gender
  useEffect(() => {
    if (!isOpen) return;

    const normCat = normalizeCategoryKey(activeRaceDef.category);
    const raceGender = activeRaceDef.gender;

    // Filter existing students of this school in this category/gender and affiliation for cross country
    const matchingStudents = allExistingStudents.filter(s => {
      if (s.sportId !== 'cross_country') return false;
      const sCat = normalizeCategoryKey(s.category);
      if (sCat !== normCat || s.gender !== raceGender) return false;

      // Affiliation match: non_club vs club_affiliated
      const sAff = s.affiliationType || 'non_club';
      if (sAff !== selectedAffiliation) return false;

      // School match
      if (selectedSchoolId && s.schoolId && s.schoolId === selectedSchoolId) return true;
      if (resolvedSchoolName && s.schoolName && (
        s.schoolName.trim().toLowerCase() === resolvedSchoolName.trim().toLowerCase() ||
        s.schoolName.includes(resolvedSchoolName) ||
        resolvedSchoolName.includes(s.schoolName)
      )) return true;

      return false;
    });

    const individualStudents = matchingStudents.filter(s => s.participationType !== 'school_team');
    const teamStudents = matchingStudents.filter(s => s.participationType === 'school_team');

    // Populate the 8 slots
    const newSlots: ParticipantSlot[] = [
      // 3 Individual
      {
        slotIndex: 0,
        participationType: 'individual',
        existingStudentId: individualStudents[0]?.id,
        fullName: individualStudents[0]?.fullName || '',
        massarNumber: individualStudents[0]?.massarNumber || '',
        birthDate: individualStudents[0]?.birthDate || '',
        photoUrl: individualStudents[0]?.photoUrl
      },
      {
        slotIndex: 1,
        participationType: 'individual',
        existingStudentId: individualStudents[1]?.id,
        fullName: individualStudents[1]?.fullName || '',
        massarNumber: individualStudents[1]?.massarNumber || '',
        birthDate: individualStudents[1]?.birthDate || '',
        photoUrl: individualStudents[1]?.photoUrl
      },
      {
        slotIndex: 2,
        participationType: 'individual',
        existingStudentId: individualStudents[2]?.id,
        fullName: individualStudents[2]?.fullName || '',
        massarNumber: individualStudents[2]?.massarNumber || '',
        birthDate: individualStudents[2]?.birthDate || '',
        photoUrl: individualStudents[2]?.photoUrl
      },
      // 5 School Team
      {
        slotIndex: 3,
        participationType: 'school_team',
        existingStudentId: teamStudents[0]?.id,
        fullName: teamStudents[0]?.fullName || '',
        massarNumber: teamStudents[0]?.massarNumber || '',
        birthDate: teamStudents[0]?.birthDate || '',
        photoUrl: teamStudents[0]?.photoUrl
      },
      {
        slotIndex: 4,
        participationType: 'school_team',
        existingStudentId: teamStudents[1]?.id,
        fullName: teamStudents[1]?.fullName || '',
        massarNumber: teamStudents[1]?.massarNumber || '',
        birthDate: teamStudents[1]?.birthDate || '',
        photoUrl: teamStudents[1]?.photoUrl
      },
      {
        slotIndex: 5,
        participationType: 'school_team',
        existingStudentId: teamStudents[2]?.id,
        fullName: teamStudents[2]?.fullName || '',
        massarNumber: teamStudents[2]?.massarNumber || '',
        birthDate: teamStudents[2]?.birthDate || '',
        photoUrl: teamStudents[2]?.photoUrl
      },
      {
        slotIndex: 6,
        participationType: 'school_team',
        existingStudentId: teamStudents[3]?.id,
        fullName: teamStudents[3]?.fullName || '',
        massarNumber: teamStudents[3]?.massarNumber || '',
        birthDate: teamStudents[3]?.birthDate || '',
        photoUrl: teamStudents[3]?.photoUrl
      },
      {
        slotIndex: 7,
        participationType: 'school_team',
        existingStudentId: teamStudents[4]?.id,
        fullName: teamStudents[4]?.fullName || '',
        massarNumber: teamStudents[4]?.massarNumber || '',
        birthDate: teamStudents[4]?.birthDate || '',
        photoUrl: teamStudents[4]?.photoUrl
      }
    ];

    setSlots(newSlots);

    // If existing students have coach info, use it if our coach fields are blank
    const firstWithCoach = matchingStudents.find(s => s.coachName);
    if (firstWithCoach) {
      if (firstWithCoach.coachName) setCoachName(firstWithCoach.coachName);
      if (firstWithCoach.coachLeaseNumber) setCoachLeaseNumber(firstWithCoach.coachLeaseNumber);
      if (firstWithCoach.coachPhone) setCoachPhone(firstWithCoach.coachPhone);
    }
  }, [isOpen, selectedRaceId, selectedSchoolId, resolvedSchoolName, allExistingStudents, activeRaceDef, selectedAffiliation]);

  // Update a single slot
  const handleUpdateSlot = (slotIndex: number, field: 'fullName' | 'massarNumber' | 'birthDate' | 'photoUrl', value: string | undefined) => {
    setSlots(prev => prev.map(s => {
      if (s.slotIndex !== slotIndex) return s;
      if (field === 'massarNumber') {
        const clean = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
        return { ...s, massarNumber: clean };
      }
      return { ...s, [field]: value };
    }));
  };

  // Process selected image or camera picture, compressing client-side
  const handleImageFile = (file: File, slotIndex: number) => {
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7); // compress to 70% quality JPEG
          handleUpdateSlot(slotIndex, 'photoUrl', dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Clear a single slot
  const handleClearSlot = (slotIndex: number) => {
    setSlots(prev => prev.map(s => {
      if (s.slotIndex !== slotIndex) return s;
      return { ...s, fullName: '', massarNumber: '', birthDate: '', existingStudentId: undefined, photoUrl: undefined };
    }));
  };

  // Check validity of a slot
  const getSlotValidation = (slot: ParticipantSlot) => {
    const isBlank = !slot.fullName.trim() && !slot.massarNumber.trim() && !slot.birthDate.trim();
    if (isBlank) return { isBlank: true, isValid: true, error: null };

    const massarRegex = /^[A-Z]\d{9}$/;
    if (!slot.massarNumber.trim()) {
      return { isBlank: false, isValid: false, error: 'رقم مسار إجباري' };
    }
    if (!massarRegex.test(slot.massarNumber.trim())) {
      return { isBlank: false, isValid: false, error: 'صيغة مسار: حرف لاتيني + 9 أرقام' };
    }
    if (!slot.fullName.trim()) {
      return { isBlank: false, isValid: false, error: 'الاسم الكامل إجباري' };
    }
    if (!slot.birthDate.trim()) {
      return { isBlank: false, isValid: false, error: 'تاريخ الازدياد إجباري' };
    }

    const birthVal = validateBirthDateForCategory(slot.birthDate, activeRaceDef.category, currentSeason, activeRaceDef.gender, true);
    if (!birthVal.isValid) {
      return { isBlank: false, isValid: false, error: birthVal.errorMessage || 'تاريخ الازدياد غير متوافق مع الفئة' };
    }

    return { isBlank: false, isValid: true, error: null };
  };

  // Filled count summary
  const filledSlotsCount = useMemo(() => {
    return slots.filter(s => s.fullName.trim() || s.massarNumber.trim() || s.birthDate.trim()).length;
  }, [slots]);

  const filledIndividualCount = useMemo(() => {
    return slots.slice(0, 3).filter(s => s.fullName.trim() || s.massarNumber.trim()).length;
  }, [slots]);

  const filledTeamCount = useMemo(() => {
    return slots.slice(3, 8).filter(s => s.fullName.trim() || s.massarNumber.trim()).length;
  }, [slots]);

  // Quick Paste parsing
  const handleApplyPaste = () => {
    if (!pasteText.trim()) {
      toast.error('يرجى لصق بيانات التلاميذ أولاً');
      return;
    }

    const lines = pasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error('لم يتم العثور على أسطر صالحة');
      return;
    }

    const massarRegex = /[A-Z]\d{9}/i;
    const dateRegex = /\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/;

    const parsedRows: Array<{ massar: string; name: string; birthDate: string }> = [];

    for (const line of lines) {
      // Split by tab, comma, or multiple spaces
      const tokens = line.split(/[\t;,]+/).map(t => t.trim()).filter(Boolean);
      let foundMassar = '';
      let foundDate = '';
      const nameTokens: string[] = [];

      tokens.forEach(tok => {
        const massarMatch = tok.match(massarRegex);
        const dateMatch = tok.match(dateRegex);

        if (massarMatch && !foundMassar) {
          foundMassar = massarMatch[0].toUpperCase();
        } else if (dateMatch && !foundDate) {
          // Normalize date to YYYY-MM-DD
          const raw = dateMatch[0].replace(/[/.]/g, '-');
          const parts = raw.split('-');
          if (parts.length === 3) {
            const y = parts[0].padStart(4, '20');
            const m = parts[1].padStart(2, '0');
            const d = parts[2].padStart(2, '0');
            foundDate = `${y}-${m}-${d}`;
          } else {
            foundDate = raw;
          }
        } else if (!/^\d+$/.test(tok) && tok.length > 1) {
          nameTokens.push(tok);
        }
      });

      const parsedName = nameTokens.join(' ').replace(/['"]/g, '').trim();

      if (foundMassar || parsedName) {
        parsedRows.push({
          massar: foundMassar,
          name: parsedName,
          birthDate: foundDate
        });
      }
    }

    if (parsedRows.length === 0) {
      toast.error('تعذر استخراج بيانات التلاميذ تلقائياً. تأكد من احتواء الأسطر على رقم مسار والاسم الكامل.');
      return;
    }

    setSlots(prev => {
      const updated = [...prev];
      let pasteIdx = 0;
      for (let i = 0; i < 8 && pasteIdx < parsedRows.length; i++) {
        // If current slot is empty or we overwrite sequentially
        const row = parsedRows[pasteIdx];
        updated[i] = {
          ...updated[i],
          massarNumber: row.massar || updated[i].massarNumber,
          fullName: row.name || updated[i].fullName,
          birthDate: row.birthDate || updated[i].birthDate
        };
        pasteIdx++;
      }
      return updated;
    });

    toast.success(`تم استيراد وتوزيع ${Math.min(parsedRows.length, 8)} تلاميذ على الخانات بنجاح!`);
    setIsPasteModalOpen(false);
    setPasteText('');
  };

  // EXCEL EXPORT (استخراج اللائحة اكسل)
  const handleExportToExcel = () => {
    const filled = slots.filter(s => s.fullName.trim() || s.massarNumber.trim());
    if (filled.length === 0) {
      toast.error('لا يوجد مشاركون في القائمة لتصديرهم إلى Excel.');
      return;
    }

    const excelData = slots.map((s, idx) => {
      const isFilled = Boolean(s.fullName.trim() || s.massarNumber.trim());
      const roleLabel = s.participationType === 'individual' ? 'مشاركة فردية (فردي)' : 'فريق المؤسسة (جماعي)';
      const slotName = s.participationType === 'individual' ? `فردي ${idx + 1}` : `فريق المؤسسة ${idx - 2}`;

      return {
        'الرقم': idx + 1,
        'الصفة / المقعد': slotName,
        'نوع المشاركة': roleLabel,
        'رقم مسار (Massar)': s.massarNumber || (isFilled ? '—' : '(خانة شاغرة)'),
        'الاسم الكامل للتلميذ(ة)': s.fullName || (isFilled ? '—' : '(خانة شاغرة)'),
        'الجنس': activeRaceDef.genderLabel,
        'الفئة الرياضية': activeRaceDef.shortLabel,
        'المسافة المقررة': activeRaceDef.distance,
        'تاريخ الازدياد': s.birthDate || '—',
        'المؤسسة التعليمية': resolvedSchoolName,
        'الأستاذ المؤطر': coachName || userProfile?.fullName || '—',
        'رقم تأجير المؤطر': coachLeaseNumber || userProfile?.leaseNumber || '—',
        'هاتف المؤطر': coachPhone || userProfile?.phone || '—',
        'الموسم الدراسي': currentSeason
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!views'] = [{ RTL: true }];

    // Auto fit columns width
    const colWidths = [
      { wch: 6 },
      { wch: 18 },
      { wch: 22 },
      { wch: 16 },
      { wch: 26 },
      { wch: 10 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 },
      { wch: 26 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 }
    ];
    worksheet['!cols'] = colWidths;

    const workbook = XLSX.utils.book_new();
    const sheetTitle = `${activeRaceDef.category}_${activeRaceDef.gender === 'Male' ? 'G' : 'F'}_8مشاركين`;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetTitle.substring(0, 30));

    const cleanSchool = resolvedSchoolName.replace(/[/\\?%*:|"<>]/g, '-').trim();
    const fileName = `لائحة_العدو_الريفي_8_مشاركين_${cleanSchool}_${activeRaceDef.shortLabel.replace(/\s+/g, '_')}_${currentSeason.replace(/[/\\?%*:|"<>]/g, '-')}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    toast.success('تم استخراج لائحة المشاركين إلى ملف Excel بنجاح! 📊', { duration: 4000 });
  };

  // Download Empty Excel Template
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'الرقم': 1,
        'المقعد': 'فردي 1',
        'نوع المشاركة': 'مشاركة فردية',
        'رقم مسار (Massar)': 'G123456789',
        'الاسم الكامل': 'الاسم والنسب للتلميذ 1',
        'تاريخ الازدياد': '2012-05-14'
      },
      {
        'الرقم': 2,
        'المقعد': 'فردي 2',
        'نوع المشاركة': 'مشاركة فردية',
        'رقم مسار (Massar)': 'G987654321',
        'الاسم الكامل': 'الاسم والنسب للتلميذ 2',
        'تاريخ الازدياد': '2012-03-20'
      },
      {
        'الرقم': 3,
        'المقعد': 'فردي 3',
        'نوع المشاركة': 'مشاركة فردية',
        'رقم مسار (Massar)': 'G456123789',
        'الاسم الكامل': 'الاسم والنسب للتلميذ 3',
        'تاريخ الازدياد': '2012-08-11'
      },
      {
        'الرقم': 4,
        'المقعد': 'فريق المؤسسة 1',
        'نوع المشاركة': 'فريق المؤسسة',
        'رقم مسار (Massar)': 'G111222333',
        'الاسم الكامل': 'الاسم والنسب للتلميذ 4',
        'تاريخ الازدياد': '2012-01-15'
      },
      {
        'الرقم': 5,
        'المقعد': 'فريق المؤسسة 2',
        'نوع المشاركة': 'فريق المؤسسة',
        'رقم مسار (Massar)': 'G444555666',
        'الاسم الكامل': 'الاسم والنسب للتلميذ 5',
        'تاريخ الازدياد': '2012-09-09'
      },
      {
        'الرقم': 6,
        'المقعد': 'فريق المؤسسة 3',
        'نوع المشاركة': 'فريق المؤسسة',
        'رقم مسار (Massar)': 'G777888999',
        'الاسم الكامل': 'الاسم والنسب للتلميذ 6',
        'تاريخ الازدياد': '2012-07-22'
      },
      {
        'الرقم': 7,
        'المقعد': 'فريق المؤسسة 4',
        'نوع المشاركة': 'فريق المؤسسة',
        'رقم مسار (Massar)': 'G123789456',
        'الاسم الكامل': 'الاسم والنسب للتلميذ 7',
        'تاريخ الازدياد': '2012-11-03'
      },
      {
        'الرقم': 8,
        'المقعد': 'فريق المؤسسة 5',
        'نوع المشاركة': 'فريق المؤسسة',
        'رقم مسار (Massar)': 'G654987321',
        'الاسم الكامل': 'الاسم والنسب للتلميذ 8',
        'تاريخ الازدياد': '2012-04-18'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!views'] = [{ RTL: true }];
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 18 },
      { wch: 20 },
      { wch: 28 },
      { wch: 16 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج_8_مشاركين');
    XLSX.writeFile(workbook, `نموذج_تسجيل_8_مشاركي_العدو_الريفي_${activeRaceDef.shortLabel.replace(/\s+/g, '_')}.xlsx`);
    toast.success('تم تحميل نموذج Excel الفارغ بنجاح! 📥');
  };

  // Upload and Parse Excel File
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!jsonRows || jsonRows.length === 0) {
          toast.error('الملف المرفوع فارغ أو تعذر قراءة محتواه');
          return;
        }

        const massarRegex = /[A-Z]\d{9}/i;

        const importedSlots: Array<{ massar: string; name: string; birthDate: string }> = [];

        jsonRows.forEach(row => {
          let m = '';
          let n = '';
          let b = '';

          // Look through row keys
          Object.keys(row).forEach(key => {
            const val = String(row[key] || '').trim();
            const massarMatch = val.match(massarRegex);

            if (massarMatch && !m) {
              m = massarMatch[0].toUpperCase();
            } else if ((key.includes('مسار') || key.toLowerCase().includes('massar')) && !m) {
              m = val.toUpperCase();
            } else if (key.includes('الاسم') || key.includes('النسب') || key.toLowerCase().includes('name')) {
              n = val;
            } else if (key.includes('ازدياد') || key.includes('تاريخ') || key.toLowerCase().includes('birth')) {
              b = val;
            }
          });

          if (m || n) {
            importedSlots.push({ massar: m, name: n, birthDate: b });
          }
        });

        if (importedSlots.length === 0) {
          toast.error('لم يتم العثور على أسطر متوافقة مع التلاميذ في الملف');
          return;
        }

        setSlots(prev => {
          const updated = [...prev];
          for (let i = 0; i < 8 && i < importedSlots.length; i++) {
            updated[i] = {
              ...updated[i],
              massarNumber: importedSlots[i].massar || updated[i].massarNumber,
              fullName: importedSlots[i].name || updated[i].fullName,
              birthDate: importedSlots[i].birthDate || updated[i].birthDate
            };
          }
          return updated;
        });

        toast.success(`تم استيراد بيانات ${Math.min(importedSlots.length, 8)} تلاميذ من ملف Excel بنجاح!`);
      } catch (err) {
        console.error('Error reading excel file:', err);
        toast.error('حدث خطأ أثناء قراءة ملف Excel');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // SAVE AND SUBMIT ALL 8 PARTICIPANTS
  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Gather all slots that have at least one field filled
    const filledSlots = slots.filter(s => s.fullName.trim() || s.massarNumber.trim() || s.birthDate.trim());

    if (filledSlots.length === 0) {
      toast.error('يرجى إدخال بيانات تلميذ واحد على الأقل في القائمة');
      return;
    }

    // 2. Validate all filled slots
    const massarRegex = /^[A-Z]\d{9}$/;
    const seenMassars = new Set<string>();

    for (const slot of filledSlots) {
      const slotNum = slot.slotIndex + 1;
      const slotLabel = slot.participationType === 'individual' ? `فردي ${slotNum}` : `فريق المؤسسة ${slotNum - 3}`;

      if (!slot.fullName.trim()) {
        toast.error(`الاسم الكامل إجباري للخانة (${slotLabel})`);
        return;
      }
      if (!slot.massarNumber.trim()) {
        toast.error(`رقم مسار إجباري للخانة (${slotLabel})`);
        return;
      }
      if (!massarRegex.test(slot.massarNumber.trim())) {
        toast.error(`رقم مسار التلميذ (${slot.fullName}) غير صحيح: يجب أن يتكون من حرف لاتيني كبير متبوعاً بـ 9 أرقام (مثال: G123456789)`);
        return;
      }
      if (seenMassars.has(slot.massarNumber.trim())) {
        toast.error(`رقم مسار مكرر: (${slot.massarNumber}) مستعمل لأكثر من تلميذ في هذه اللائحة`);
        return;
      }
      seenMassars.add(slot.massarNumber.trim());

      if (!slot.birthDate.trim()) {
        toast.error(`تاريخ الازدياد إجباري للخانة (${slotLabel}) التلميذ (${slot.fullName})`);
        return;
      }

      const birthVal = validateBirthDateForCategory(slot.birthDate, activeRaceDef.category, currentSeason, activeRaceDef.gender, true);
      if (!birthVal.isValid) {
        toast.error(`تاريخ ازدياد التلميذ (${slot.fullName}): ${birthVal.errorMessage}`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isTeacher && !userProfile?.workLocation) {
        toast.error('يرجى استكمال مقر العمل (المؤسسة التعليمية) في ملفكم الشخصي أولاً.');
        setIsSubmitting(false);
        return;
      }

      let schoolIdToUse = selectedSchoolId || resolvedSchool?.id || (userProfile?.id || 'school-main');
      let schoolNameToUse = resolvedSchoolName;

      if (isTeacher) {
        schoolNameToUse = userProfile!.workLocation!;
        const matched = schools.find(s =>
          s.name && (
            s.name.trim().toLowerCase() === userProfile!.workLocation!.trim().toLowerCase() ||
            s.name.includes(userProfile!.workLocation!) ||
            userProfile!.workLocation!.includes(s.name)
          )
        );
        schoolIdToUse = matched ? matched.id : (userProfile!.id || 'teacher_school');
      }

      const activeSchoolObj = isTeacher
        ? schools.find(s =>
            s.name && (
              s.name.trim().toLowerCase() === userProfile!.workLocation!.trim().toLowerCase() ||
              s.name.includes(userProfile!.workLocation!) ||
              userProfile!.workLocation!.includes(s.name)
            )
          )
        : schools.find(s => s.id === schoolIdToUse);

      if (activeSchoolObj && tournaments && tournaments.length > 0) {
        const normCategory = normalizeCategoryKey(activeRaceDef.category);
        const relevantTournament = tournaments.find(t => 
          t.sportId === 'cross_country' && 
          normalizeCategoryKey(t.ageCategory) === normCategory &&
          (t.gender === activeRaceDef.gender || t.gender === 'Mixed')
        );
        if (relevantTournament && relevantTournament.level) {
          const isAllowed = isSchoolLevelAllowedForTournament(activeSchoolObj.type, relevantTournament.level);
          if (!isAllowed) {
            toast.error(`عذراً، السلك التعليمي لمؤسسة "${activeSchoolObj.name}" (${activeSchoolObj.type}) غير مسموح له بالمشاركة في هذه البطولة المخصصة لـ (${getTournamentLevelAr(relevantTournament.level)})`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      // Split into slots that are existing updates vs new creations
      const studentsToCreate: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>> = [];
      const studentsToUpdate: Array<{ id: string; data: Partial<Student> }> = [];

      for (const slot of filledSlots) {
        const payload: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> = {
          fullName: slot.fullName.trim(),
          massarNumber: slot.massarNumber.trim().toUpperCase(),
          gender: activeRaceDef.gender,
          birthDate: slot.birthDate.trim(),
          category: normalizeCategoryKey(activeRaceDef.category),
          affiliationType: selectedAffiliation,
          schoolId: schoolIdToUse,
          schoolName: schoolNameToUse,
          sportId: 'cross_country',
          participationType: slot.participationType,
          distance: activeRaceDef.distance,
          coachName: coachName.trim() || userProfile?.fullName || undefined,
          coachLeaseNumber: coachLeaseNumber.trim() || userProfile?.leaseNumber || undefined,
          coachPhone: coachPhone.trim() || userProfile?.phone || undefined,
          photoUrl: slot.photoUrl
        };

        if (slot.existingStudentId) {
          studentsToUpdate.push({ id: slot.existingStudentId, data: payload });
        } else {
          studentsToCreate.push(payload);
        }
      }

      // Execute updates
      for (const item of studentsToUpdate) {
        await DataService.updateStudent(item.id, item.data);
      }

      // Execute creations in bulk
      if (studentsToCreate.length > 0) {
        await DataService.addStudentsBulk(studentsToCreate);
      }

      toast.success(`تم بنجاح تسجيل وتحديث ${filledSlots.length} مشاركين في ${activeRaceDef.titleAr} (${filledIndividualCount} فردي + ${filledTeamCount} فريق المؤسسة)! 🎉`, {
        duration: 5000
      });

      onRegistered();
      onClose();
    } catch (err) {
      console.error('Error saving cross country bulk students:', err);
      toast.error('حدث خطأ أثناء حفظ لائحة المشاركين. يرجى المحاولة ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-xs overflow-y-auto" dir="rtl">
      <div className="relative w-full max-w-5xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-4 sm:my-8 flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:p-5 border-b border-slate-800">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-2xl shadow-lg shrink-0">
                🏃‍♂️
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base sm:text-lg font-black tracking-tight">
                    {customTitle} (8 مشاركين دفعة واحدة)
                  </h3>
                  <span className="text-[11px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 px-2.5 py-0.5 rounded-full">
                    3 فردي + 5 فريق المؤسسة
                  </span>
                  <span className="text-[11px] font-bold bg-white/10 text-white/90 border border-white/10 px-2.5 py-0.5 rounded-full">
                    الموسم: {currentSeason}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                  تعبئة لائحة العدائين الثمانية لمؤسسة <span className="font-bold text-amber-300">{resolvedSchoolName}</span> في السباق المحدد، مع إمكانية استخراج اللائحة Excel أو الاستيراد المباشر.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Action Toolbar inside Header */}
          <div className="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-slate-300">المجموع الحالي:</span>
              <span className="bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-lg font-black text-[11px] shadow-3xs">
                {filledSlotsCount} من أصل 8 مقاعد
              </span>
              <span className="bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-lg text-[11px]">
                🏃 فردي: <strong className="text-amber-300">{filledIndividualCount}/3</strong>
              </span>
              <span className="bg-white/10 text-slate-200 px-2.5 py-0.5 rounded-lg text-[11px]">
                👥 فريق: <strong className="text-emerald-300">{filledTeamCount}/5</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Excel Export Button */}
              <button
                type="button"
                onClick={handleExportToExcel}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="تصدير هذه اللائحة إلى ملف Excel منسق"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>استخراج اللائحة Excel 📊</span>
              </button>

              {/* Quick Paste Button */}
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                title="لصق سريع من Excel أو منظومة مسار"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>لصق سريع من مسار / Excel</span>
              </button>

              {/* Template Download */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                title="تحميل نموذج تعبئة فارغ بصيغة Excel"
              >
                <Download className="w-3.5 h-3.5" />
                <span>نموذج فارغ</span>
              </button>

              {/* Excel Upload Trigger */}
              <label className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-medium rounded-xl transition-colors flex items-center gap-1 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>استيراد ملف</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Main Body Form */}
        <form onSubmit={handleSubmitAll} className="p-4 sm:p-6 space-y-5 overflow-y-auto max-h-[calc(88vh-140px)]">
          
          {/* Controls: Race Selector & School & Affiliation */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
            {/* Race Selection (Category & Gender) */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5 flex items-center justify-between">
                <span>اختر السباق والفئة العمرية *</span>
                <span className="text-[11px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  المسافة: {activeRaceDef.distance}
                </span>
              </label>
              <select
                value={selectedRaceId}
                onChange={(e) => setSelectedRaceId(e.target.value)}
                className="w-full text-xs font-bold px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 shadow-2xs"
              >
                {finalCategories.map(cat => {
                  const years = getCategoryYearsLabel(cat.category, currentSeason, 'cross_country');
                  return (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.titleAr} (مواليد {years})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Affiliation selection (Non-Club vs Club) */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5 flex items-center justify-between">
                <span>نوع الانتماء الرياضي *</span>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                  {selectedAffiliation === 'club_affiliated' ? 'بطاقة صفراء' : 'بطاقة بيضاء'}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!hasSchool}
                  onClick={() => setSelectedAffiliation('non_club')}
                  className={`py-2 px-2 text-[11px] font-bold rounded-xl border transition-all flex items-center justify-center gap-1 ${
                    !hasSchool
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                      : selectedAffiliation === 'non_club'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-2 ring-slate-400/40'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer'
                  }`}
                  title={!hasSchool ? 'غير مبرمج في ضوابط البطولة الحالية' : undefined}
                >
                  <span>⚪</span>
                  <span>لا منتمين (مدرسي)</span>
                </button>
                <button
                  type="button"
                  disabled={!hasClub}
                  onClick={() => setSelectedAffiliation('club_affiliated')}
                  className={`py-2 px-2 text-[11px] font-bold rounded-xl border transition-all flex items-center justify-center gap-1 ${
                    !hasClub
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-50'
                      : selectedAffiliation === 'club_affiliated'
                      ? 'bg-amber-400 text-amber-950 border-amber-500 shadow-xs ring-2 ring-amber-400/60 font-black'
                      : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100 cursor-pointer'
                  }`}
                  title={!hasClub ? 'غير مبرمج في ضوابط البطولة الحالية' : undefined}
                >
                  <span>⚽</span>
                  <span>منتمين لأندية</span>
                </button>
              </div>
            </div>

            {/* School selection */}
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5 flex items-center justify-between">
                <span>المؤسسة التعليمية *</span>
                {isTeacher && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> مؤسستك الرسمية
                  </span>
                )}
              </label>
              {isTeacher ? (
                <div className="w-full text-xs font-bold px-3 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-800 flex items-center justify-between">
                  <span>{resolvedSchoolName}</span>
                  <span className="text-[10px] text-slate-400 font-medium">مغلق للأساتذة</span>
                </div>
              ) : (
                <select
                  value={selectedSchoolId}
                  onChange={(e) => setSelectedSchoolId(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 shadow-2xs"
                >
                  <option value="">-- اختر المؤسسة التعليمية --</option>
                  {schools.map(sch => (
                    <option key={sch.id} value={sch.id}>
                      {sch.name} ({sch.type} - {sch.commune})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Collapsible Coach Info Panel */}
            <div className="md:col-span-2 pt-2 border-t border-slate-200/80">
              <button
                type="button"
                onClick={() => setIsCoachCollapsed(!isCoachCollapsed)}
                className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>👨‍🏫 بيانات الأستاذ المؤطر (المسؤول عن مرافقة الفريق وتطبيق بياناته بالمطبوع)</span>
                <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 font-mono">
                  {coachName || 'اضغط للتعديل'}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isCoachCollapsed ? '' : 'rotate-180'}`} />
              </button>

              {!isCoachCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 p-3 bg-white rounded-xl border border-slate-200 shadow-2xs">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">اسم الأستاذ المؤطر</label>
                    <input
                      type="text"
                      value={coachName}
                      onChange={(e) => setCoachName(e.target.value)}
                      placeholder="مثال: يوسف العلوي"
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">رقم التأجير (PPR)</label>
                    <input
                      type="text"
                      value={coachLeaseNumber}
                      onChange={(e) => setCoachLeaseNumber(e.target.value)}
                      placeholder="مثال: 1234567"
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">رقم الهاتف للتواصل</label>
                    <input
                      type="text"
                      value={coachPhone}
                      onChange={(e) => setCoachPhone(e.target.value)}
                      placeholder="مثال: 0612345678"
                      className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Guidelines Banner */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-blue-900 leading-relaxed shadow-3xs">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black">قواعد التوزيع المعتمدة في العدو الريفي:</span>{' '}
              تخصص الخانات الثلاث الأولى (1، 2، 3) للمشاركين بصفة <strong className="text-amber-800 underline">فردية</strong>، بينما تخصص الخانات الخمس المتبقية (4، 5، 6، 7، 8) لـ <strong className="text-emerald-800 underline">فريق المؤسسة</strong> لاحتساب النقط الجماعية. يمكنك ملء الخانات كلياً أو جزئياً واستخراج اللائحة في أي وقت.
            </div>
          </div>

          {/* Section 1: Individual Participants (3 Slots) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-amber-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-900 font-black text-xs flex items-center justify-center border border-amber-300">
                  🏃
                </span>
                <h4 className="text-xs sm:text-sm font-black text-slate-900">
                  المشاركة الفردية (3 مقاعد كحد أقصى)
                </h4>
                <span className="text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full">
                  السباق الفردي
                </span>
              </div>
              <span className="text-xs font-bold text-slate-500">
                المسجلون: <strong className="text-amber-700">{filledIndividualCount} / 3</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {slots.slice(0, 3).map((slot, idx) => {
                const val = getSlotValidation(slot);
                const slotNumber = idx + 1;
                return (
                  <div
                    key={slot.slotIndex}
                    className={`p-3.5 rounded-2xl border transition-all space-y-2.5 relative ${
                      !val.isValid
                        ? 'bg-red-50/50 border-red-300 ring-2 ring-red-400/20'
                        : !val.isBlank
                        ? 'bg-amber-50/40 border-amber-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-black text-amber-900 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span>🏃</span>
                          <span>فردي {slotNumber}</span>
                        </span>
                        <span className="text-[9px] font-bold text-amber-700/70 mr-1">
                          (مواليد {activeYearsLabel})
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {slot.existingStudentId && (
                          <span className="text-[9.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            مسجل مسبقاً
                          </span>
                        )}
                        {!val.isBlank && (
                          <button
                            type="button"
                            onClick={() => handleClearSlot(slot.slotIndex)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                            title="مسح هذه الخانة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Massar Input */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        رقم مسار (Code Massar) *
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: G123456789"
                        maxLength={10}
                        value={slot.massarNumber}
                        onChange={(e) => handleUpdateSlot(slot.slotIndex, 'massarNumber', e.target.value)}
                        className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase shadow-3xs"
                      />
                    </div>

                    {/* Full Name */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        الاسم الكامل للتلميذ(ة) *
                      </label>
                      <input
                        type="text"
                        placeholder="مثال: عمر البقالي"
                        value={slot.fullName}
                        onChange={(e) => handleUpdateSlot(slot.slotIndex, 'fullName', e.target.value)}
                        className="w-full text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 shadow-3xs"
                      />
                    </div>

                    {/* Birth Date */}
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">
                        تاريخ الازدياد *
                      </label>
                      <input
                        type="date"
                        value={slot.birthDate}
                        onChange={(e) => handleUpdateSlot(slot.slotIndex, 'birthDate', e.target.value)}
                        className="w-full text-xs font-mono font-bold px-3 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 shadow-3xs text-slate-800"
                      />
                    </div>

                    {/* Participant Photo */}
                    <div className="space-y-1">
                      <label className="block text-[10px] font-bold text-slate-600">
                        صورة المشارك (اختياري)
                      </label>
                      <div className="flex items-center gap-2">
                        {/* Photo Preview Thumbnail */}
                        <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative shadow-3xs">
                          {slot.photoUrl ? (
                            <img src={slot.photoUrl} alt="صورة المشارك" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg text-slate-400">👤</span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-1.5 flex-1">
                          {slot.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateSlot(slot.slotIndex, 'photoUrl', undefined)}
                              className="text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2 py-1 rounded-lg transition-colors cursor-pointer w-full text-center"
                            >
                              حذف 🗑️
                            </button>
                          ) : (
                            <>
                              <label className="text-[10px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 text-center flex items-center justify-center gap-1">
                                <Upload className="w-3 h-3" />
                                <span>ملف</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageFile(file, slot.slotIndex);
                                  }}
                                  className="hidden"
                                />
                              </label>
                              <label className="text-[10px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer flex-1 text-center flex items-center justify-center gap-1">
                                <span>📸 كاميرا</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageFile(file, slot.slotIndex);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Validation warning if any */}
                    {val.error && (
                      <div className="text-[10px] text-red-600 font-bold flex items-center gap-1 pt-1">
                        <AlertCircle className="w-3 h-3 shrink-0" />
                        <span>{val.error}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 2: School Team Participants (5 Slots) */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-900 font-black text-xs flex items-center justify-center border border-emerald-300">
                  👥
                </span>
                <h4 className="text-xs sm:text-sm font-black text-slate-900">
                  فريق المؤسسة (5 مقاعد جماعية)
                </h4>
                <span className="text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full">
                  ترتيب الفرق الجماعي
                </span>
              </div>
              <span className="text-xs font-bold text-slate-500">
                المسجلون: <strong className="text-emerald-700">{filledTeamCount} / 5</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {slots.slice(3, 8).map((slot, idx) => {
                const val = getSlotValidation(slot);
                const slotNumber = idx + 1;
                return (
                  <div
                    key={slot.slotIndex}
                    className={`p-3 rounded-2xl border transition-all space-y-2 relative ${
                      !val.isValid
                        ? 'bg-red-50/50 border-red-300 ring-2 ring-red-400/20'
                        : !val.isBlank
                        ? 'bg-emerald-50/40 border-emerald-300 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-black text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span>👥</span>
                          <span>فريق {slotNumber}</span>
                        </span>
                        <span className="text-[9px] font-bold text-emerald-700/70 mr-1">
                          (مواليد {activeYearsLabel})
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {slot.existingStudentId && (
                          <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded">
                            مسجل
                          </span>
                        )}
                        {!val.isBlank && (
                          <button
                            type="button"
                            onClick={() => handleClearSlot(slot.slotIndex)}
                            className="text-slate-400 hover:text-red-600 p-0.5 rounded transition-colors cursor-pointer"
                            title="مسح هذه الخانة"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Massar Input */}
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">
                        رقم مسار *
                      </label>
                      <input
                        type="text"
                        placeholder="G123456789"
                        maxLength={10}
                        value={slot.massarNumber}
                        onChange={(e) => handleUpdateSlot(slot.slotIndex, 'massarNumber', e.target.value)}
                        className="w-full text-xs font-mono font-bold px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 uppercase shadow-3xs"
                      />
                    </div>

                    {/* Full Name */}
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">
                        الاسم الكامل *
                      </label>
                      <input
                        type="text"
                        placeholder="الاسم والنسب"
                        value={slot.fullName}
                        onChange={(e) => handleUpdateSlot(slot.slotIndex, 'fullName', e.target.value)}
                        className="w-full text-xs font-semibold px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 shadow-3xs"
                      />
                    </div>

                    {/* Birth Date */}
                    <div>
                      <label className="block text-[9.5px] font-bold text-slate-600 mb-0.5">
                        تاريخ الازدياد *
                      </label>
                      <input
                        type="date"
                        value={slot.birthDate}
                        onChange={(e) => handleUpdateSlot(slot.slotIndex, 'birthDate', e.target.value)}
                        className="w-full text-xs font-mono font-bold px-2 py-1.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 shadow-3xs text-slate-800"
                      />
                    </div>

                    {/* Participant Photo */}
                    <div className="space-y-1">
                      <label className="block text-[9.5px] font-bold text-slate-600">
                        صورة المشارك (اختياري)
                      </label>
                      <div className="flex items-center gap-1.5">
                        {/* Photo Preview Thumbnail */}
                        <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden relative shadow-3xs">
                          {slot.photoUrl ? (
                            <img src={slot.photoUrl} alt="صورة المشارك" className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-sm text-slate-400">👤</span>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-1 flex-1">
                          {slot.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => handleUpdateSlot(slot.slotIndex, 'photoUrl', undefined)}
                              className="text-[9px] font-bold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-1.5 py-1 rounded-lg transition-colors cursor-pointer w-full text-center"
                            >
                              حذف 🗑️
                            </button>
                          ) : (
                            <>
                              <label className="text-[9px] font-bold bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 px-1.5 py-1 rounded-lg transition-colors cursor-pointer flex-1 text-center flex items-center justify-center gap-0.5">
                                <Upload className="w-2.5 h-2.5" />
                                <span>ملف</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageFile(file, slot.slotIndex);
                                  }}
                                  className="hidden"
                                />
                              </label>
                              <label className="text-[9px] font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-1.5 py-1 rounded-lg transition-colors cursor-pointer flex-1 text-center flex items-center justify-center gap-0.5">
                                <span>📸 كاميرا</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  capture="environment"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleImageFile(file, slot.slotIndex);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Validation warning if any */}
                    {val.error && (
                      <div className="text-[9.5px] text-red-600 font-bold flex items-center gap-1 pt-0.5">
                        <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate">{val.error}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              سيتم حفظ جميع الخانات المعبأة مباشرة في قاعدة بيانات العدو الريفي للمؤسسة.
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                إلغاء
              </button>

              <button
                type="button"
                onClick={handleExportToExcel}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير Excel 📊</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting || filledSlotsCount === 0}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>جاري الحفظ والتسجيل...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>حفظ وتسجيل المشاركين ({filledSlotsCount} تلميذ)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Quick Paste Modal */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xl">
                  📋
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">لصق سريع من مسار أو Excel</h4>
                  <p className="text-[11px] text-slate-500">انسخ أعمدة التلاميذ من Excel والصقها هنا مباشرة لتوزيعها تلقائياً.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 text-slate-600">
              <span className="font-bold text-slate-800">الصيغ المدعومة لكل سطر:</span>
              <div>• رقم مسار + الاسم الكامل + تاريخ الازدياد (مفصولة بـ Tab أو فاصلة)</div>
              <div>• مثال: <code className="font-mono bg-white px-1.5 py-0.5 rounded text-blue-900">G123456789	ياسين المنصوري	2012-05-14</code></div>
            </div>

            <textarea
              rows={8}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={`G123456789\tعمر البقالي\t2012-04-12\nG987654321\tيوسف العلمي\t2012-06-25`}
              className="w-full text-xs font-mono p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 leading-relaxed text-slate-800"
            />

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleApplyPaste}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>تطبيق وتوزيع على الخانات الثمانية</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
