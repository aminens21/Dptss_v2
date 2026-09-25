import React, { useState, useEffect, useMemo, useRef } from 'react';
import { School, Student, Sport, User, Tournament } from '../types';
import { DataService, validateBirthDateForCategory, normalizeCategoryKey, getCategoryGenderLabel, getCategoryYearsLabel, isSchoolLevelAllowedForTournament, getTournamentLevelAr, isTeacherLevelAllowedForTournament } from '../lib/dataService';
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
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';

export interface SportParticipantSlot {
  slotIndex: number;
  fullName: string;
  massarNumber: string;
  birthDate: string;
  photoUrl?: string;
  athleticsSpecialty?: string;
}

interface SportBulkRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: Sport | null;
  schools: School[];
  preselectedCategory?: string;
  preselectedGender?: 'Male' | 'Female';
  preselectedSchoolName?: string;
  allExistingStudents?: Student[];
  onRegistered: () => void;
  currentSeason?: string;
  tournaments?: Tournament[];
}

export const SportBulkRegisterModal: React.FC<SportBulkRegisterModalProps> = ({
  isOpen,
  onClose,
  sport,
  schools,
  preselectedCategory,
  preselectedGender = 'Male',
  preselectedSchoolName,
  allExistingStudents = [],
  onRegistered,
  currentSeason: initialSeason = '2026/2027',
  tournaments = []
}) => {
  const { userProfile } = useAuth();
  const isTeacher = userProfile?.role === 'TEACHER';
  const [currentSeason, setCurrentSeason] = useState(initialSeason);

  // Available categories for selection
  const availableCategories = useMemo(() => {
    const baseCats = (sport?.ageCategories && sport.ageCategories.length > 0)
      ? sport.ageCategories.map(normalizeCategoryKey)
      : ['U12', 'U15', 'U18', 'U20'];

    if (!isTeacher || !userProfile?.teachingCadre) return baseCats;

    const cadre = userProfile.teachingCadre.toUpperCase();
    return baseCats.filter(catId => {
      const norm = normalizeCategoryKey(catId);
      if (cadre.includes('PRIMARY')) return norm === 'U12';
      if (cadre.includes('MIDDLE')) return norm === 'U15';
      if (cadre.includes('HIGH') || cadre.includes('SECONDARY')) return norm === 'U18' || norm === 'U20';
      return true;
    });
  }, [sport, isTeacher, userProfile]);

  // Selected age category
  const [selectedCategory, setSelectedCategory] = useState<string>('U15');
  // Selected gender
  const [selectedGender, setSelectedGender] = useState<'Male' | 'Female'>(preselectedGender);
  
  // Sync category & gender from props on open
  useEffect(() => {
    if (isOpen) {
      if (preselectedCategory) {
        setSelectedCategory(normalizeCategoryKey(preselectedCategory));
      } else if (availableCategories.length > 0) {
        // If U15 is not available for this teacher, pick the first available one
        if (!availableCategories.includes('U15')) {
          setSelectedCategory(availableCategories[0]);
        } else {
          setSelectedCategory('U15');
        }
      } else {
        setSelectedCategory('U15');
      }
      setSelectedGender(preselectedGender);
    }
  }, [isOpen, preselectedCategory, preselectedGender, availableCategories]);

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

  // Dynamic slot count based on the sport limit (default 10 slots)
  const slotCount = useMemo(() => {
    if (sport?.studentLimit && sport.studentLimit > 0) {
      return Math.max(4, sport.studentLimit);
    }
    return 10;
  }, [sport]);

  // Pre-initialize empty slots
  const [slots, setSlots] = useState<SportParticipantSlot[]>([]);

  useEffect(() => {
    if (isOpen) {
      const initialSlots: SportParticipantSlot[] = Array.from({ length: slotCount }, (_, idx) => ({
        slotIndex: idx,
        fullName: '',
        massarNumber: '',
        birthDate: '',
        athleticsSpecialty: sport?.athleticsSpecialties?.[0] || 'القفز الطولي'
      }));
      setSlots(initialSlots);
    }
  }, [isOpen, slotCount, sport]);

  // Fetch active season
  useEffect(() => {
    DataService.getActiveSeason().then(s => {
      if (s) setCurrentSeason(s);
    });
  }, []);

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
  }, [isOpen, isTeacher, userProfile, schools, preselectedSchoolName]);

  // Resolved school object and name
  const resolvedSchool = useMemo(() => {
    return schools.find(s => s.id === selectedSchoolId);
  }, [schools, selectedSchoolId]);

  const resolvedSchoolName = useMemo(() => {
    if (isTeacher && userProfile?.workLocation) return userProfile.workLocation;
    return resolvedSchool?.name || preselectedSchoolName || userProfile?.workLocation || 'المؤسسة التعليمية';
  }, [isTeacher, userProfile, resolvedSchool, preselectedSchoolName]);

  // Auto-populate slots from existing students matching this school, category, and gender
  useEffect(() => {
    if (!isOpen || !sport) return;

    // Filter existing students of this school in this category/gender for this sport
    const matchingStudents = allExistingStudents.filter(s => {
      if (s.sportId !== sport.id) return false;
      const sCat = normalizeCategoryKey(s.category);
      if (sCat !== normalizeCategoryKey(selectedCategory) || s.gender !== selectedGender) return false;

      // School match
      if (selectedSchoolId && s.schoolId && s.schoolId === selectedSchoolId) return true;
      if (resolvedSchoolName && s.schoolName && (
        s.schoolName.trim().toLowerCase() === resolvedSchoolName.trim().toLowerCase() ||
        s.schoolName.includes(resolvedSchoolName) ||
        resolvedSchoolName.includes(s.schoolName)
      )) return true;

      return false;
    });

    setSlots(prev => {
      return prev.map((slot, index) => {
        const student = matchingStudents[index];
        if (student) {
          return {
            ...slot,
            fullName: student.fullName || '',
            massarNumber: student.massarNumber || '',
            birthDate: student.birthDate || '',
            photoUrl: student.photoUrl,
            athleticsSpecialty: student.athleticsSpecialty || slot.athleticsSpecialty
          };
        }
        return {
          ...slot,
          fullName: '',
          massarNumber: '',
          birthDate: '',
          photoUrl: undefined
        };
      });
    });

    // Populate coach info if present
    const firstWithCoach = matchingStudents.find(s => s.coachName);
    if (firstWithCoach) {
      if (firstWithCoach.coachName) setCoachName(firstWithCoach.coachName);
      if (firstWithCoach.coachLeaseNumber) setCoachLeaseNumber(firstWithCoach.coachLeaseNumber);
      if (firstWithCoach.coachPhone) setCoachPhone(firstWithCoach.coachPhone);
    }
  }, [isOpen, selectedCategory, selectedGender, selectedSchoolId, resolvedSchoolName, allExistingStudents, sport]);

  // Update a single slot
  const handleUpdateSlot = (slotIndex: number, field: keyof SportParticipantSlot, value: any) => {
    setSlots(prev => prev.map(s => {
      if (s.slotIndex !== slotIndex) return s;
      if (field === 'massarNumber') {
        const clean = (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 10);
        return { ...s, massarNumber: clean };
      }
      return { ...s, [field]: value };
    }));
  };

  // Image upload
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
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
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
      return { ...s, fullName: '', massarNumber: '', birthDate: '', photoUrl: undefined };
    }));
  };

  // Check validity of a slot
  const getSlotValidation = (slot: SportParticipantSlot) => {
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

    const birthVal = validateBirthDateForCategory(slot.birthDate, selectedCategory, currentSeason, selectedGender, sport?.id);
    if (!birthVal.isValid) {
      return { isBlank: false, isValid: false, error: birthVal.errorMessage || 'تاريخ الازدياد غير متوافق مع الفئة' };
    }

    return { isBlank: false, isValid: true, error: null };
  };

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
      for (let i = 0; i < slotCount && i < parsedRows.length; i++) {
        updated[i] = {
          ...updated[i],
          fullName: parsedRows[i].name || updated[i].fullName,
          massarNumber: parsedRows[i].massar || updated[i].massarNumber,
          birthDate: parsedRows[i].birthDate || updated[i].birthDate
        };
      }
      return updated;
    });

    toast.success(`تم استخلاص وتوزيع بيانات ${Math.min(parsedRows.length, slotCount)} تلاميذ بنجاح! ✨`);
    setIsPasteModalOpen(false);
    setPasteText('');
  };

  // Download Excel Template
  const handleDownloadTemplate = () => {
    if (!sport) return;

    const templateData = Array.from({ length: slotCount }, (_, idx) => ({
      'الرقم': idx + 1,
      'رقم مسار (Massar)': `G${100000000 + idx}`,
      'الاسم الكامل للتلميذ(ة)': `الاسم والنسب للتلميذ ${idx + 1}`,
      'تاريخ الازدياد': '2012-05-14',
      ...(sport.id === 'athletics' ? { 'التخصص الفرعي': sport.athleticsSpecialties?.[0] || 'القفز الطولي' } : {})
    }));

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!views'] = [{ RTL: true }];
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 28 },
      { wch: 16 },
      ...(sport.id === 'athletics' ? [{ wch: 20 }] : [])
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج_التسجيل');
    XLSX.writeFile(workbook, `نموذج_تسجيل_مجمّع_لـ_${sport.name.replace(/\s+/g, '_')}.xlsx`);
    toast.success('تم تحميل نموذج Excel الفارغ بنجاح! 📥');
  };

  // Upload Excel File
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
        const importedSlots: Array<{ massar: string; name: string; birthDate: string; specialty?: string }> = [];

        jsonRows.forEach(row => {
          let m = '';
          let n = '';
          let b = '';
          let s = '';

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
            } else if (key.includes('تخصص') || key.includes('فرعي') || key.toLowerCase().includes('specialty')) {
              s = val;
            }
          });

          if (m || n) {
            importedSlots.push({ massar: m, name: n, birthDate: b, specialty: s });
          }
        });

        if (importedSlots.length === 0) {
          toast.error('لم يتم العثور على أسطر متوافقة مع التلاميذ في الملف');
          return;
        }

        setSlots(prev => {
          const updated = [...prev];
          for (let i = 0; i < slotCount && i < importedSlots.length; i++) {
            updated[i] = {
              ...updated[i],
              massarNumber: importedSlots[i].massar || updated[i].massarNumber,
              fullName: importedSlots[i].name || updated[i].fullName,
              birthDate: importedSlots[i].birthDate || updated[i].birthDate,
              athleticsSpecialty: importedSlots[i].specialty || updated[i].athleticsSpecialty
            };
          }
          return updated;
        });

        toast.success(`تم استيراد بيانات ${Math.min(importedSlots.length, slotCount)} تلاميذ من ملف Excel بنجاح!`);
      } catch (err) {
        console.error('Error reading excel file:', err);
        toast.error('حدث خطأ أثناء قراءة ملف Excel');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit all slots
  const handleSubmitAll = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!sport) return;

    const filledSlots = slots.filter(s => s.fullName.trim() || s.massarNumber.trim() || s.birthDate.trim());

    if (filledSlots.length === 0) {
      toast.error('يرجى إدخال بيانات تلميذ واحد على الأقل في القائمة');
      return;
    }

    // Validation
    const massarRegex = /^[A-Z]\d{9}$/i;
    const seenMassars = new Set<string>();

    for (const slot of filledSlots) {
      const slotLabel = `المقعد ${slot.slotIndex + 1}`;
      if (!slot.fullName.trim()) {
        toast.error(`الاسم الكامل إجباري للخانة (${slotLabel})`);
        return;
      }
      if (!slot.massarNumber.trim()) {
        toast.error(`رقم مسار إجباري للخانة (${slotLabel})`);
        return;
      }
      if (!massarRegex.test(slot.massarNumber.trim())) {
        toast.error(`رقم مسار التلميذ (${slot.fullName}) غير صحيح (مثال: G123456789)`);
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

      const birthVal = validateBirthDateForCategory(slot.birthDate, selectedCategory, currentSeason, selectedGender, sport?.id);
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
        : schools.find(s => s.id === selectedSchoolId);

      if (activeSchoolObj && tournaments && tournaments.length > 0) {
        const normCategory = normalizeCategoryKey(selectedCategory);
        const relevantTournament = tournaments.find(t => 
          t.sportId === sport.id && 
          (normalizeCategoryKey(t.ageCategory) === normCategory || normalizeCategoryKey(t.ageCategory) === 'جميع الفئات') &&
          (t.gender === selectedGender || t.gender === 'Mixed')
        );
        if (relevantTournament && relevantTournament.level) {
          const isAllowed = isSchoolLevelAllowedForTournament(activeSchoolObj.type, relevantTournament.level);
          if (!isAllowed) {
            toast.error(`عذراً، السلك التعليمي لمؤسسة "${activeSchoolObj.name}" (${activeSchoolObj.type}) غير مسموح له بالمشاركة في هذه البطولة المخصصة لـ (${getTournamentLevelAr(relevantTournament.level)})`);
            setIsSubmitting(false);
            return;
          }

          // Check teacher cadre (extra safety)
          if (userProfile?.teachingCadre && !isTeacherLevelAllowedForTournament(userProfile.teachingCadre, relevantTournament.level)) {
            const cadreAr = userProfile.teachingCadre.includes('PRIMARY') ? 'ابتدائي' : userProfile.teachingCadre.includes('MIDDLE') ? 'إعدادي' : 'تأهيلي';
            toast.error(`عذراً، بصفتك أستاذ سلك (${cadreAr})، لا يمكنك التسجيل في بطولة مخصصة لـ (${getTournamentLevelAr(relevantTournament.level)})`);
            setIsSubmitting(false);
            return;
          }
        }
      }

      const studentsToCreate: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>> = [];
      const studentsToUpdate: Array<{ id: string; data: Partial<Student> }> = [];

      for (const slot of filledSlots) {
        // Check if student already exists in this sport under this school
        const existingStudent = allExistingStudents.find(
          s => s.sportId === sport.id && s.massarNumber.toUpperCase() === slot.massarNumber.trim().toUpperCase()
        );

        const payload: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> = {
          fullName: slot.fullName.trim(),
          massarNumber: slot.massarNumber.trim().toUpperCase(),
          gender: selectedGender,
          birthDate: slot.birthDate.trim(),
          category: normalizeCategoryKey(selectedCategory),
          affiliationType: 'non_club',
          schoolId: schoolIdToUse,
          schoolName: schoolNameToUse,
          sportId: sport.id,
          participationType: 'school_team',
          coachName: coachName.trim() || userProfile?.fullName || undefined,
          coachLeaseNumber: coachLeaseNumber.trim() || userProfile?.leaseNumber || undefined,
          coachPhone: coachPhone.trim() || userProfile?.phone || undefined,
          photoUrl: slot.photoUrl,
          ...(sport.id === 'athletics' ? { athleticsSpecialty: slot.athleticsSpecialty } : {})
        };

        if (existingStudent) {
          studentsToUpdate.push({ id: existingStudent.id, data: payload });
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

      toast.success(`تم بنجاح تسجيل وتحديث ${filledSlots.length} مشاركين في منافسات ${sport.name}! 🎉`, {
        duration: 5000
      });

      onRegistered();
      onClose();
    } catch (err) {
      console.error('Error saving bulk students:', err);
      toast.error('حدث خطأ أثناء حفظ لائحة المشاركين. يرجى المحاولة ثانية.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !sport) return null;

  return (
    <div className="fixed inset-0 z-[150] overflow-y-auto" id="sport-bulk-modal" dir="rtl">
      <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm transition-opacity" onClick={onClose} />

        <div className="relative transform overflow-hidden rounded-3xl bg-slate-50 dark:bg-slate-900 text-right shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-6xl flex flex-col max-h-[92vh]">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-indigo-800 px-6 py-5 text-white flex items-center justify-between shadow-md shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-3xl">
                {sport.icon || '🏆'}
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-black leading-6">
                  تسجيل مشاركي {sport.name} دفعة واحدة ⚡
                </h3>
                <p className="text-xs text-blue-100 font-medium mt-1">
                  تعبئة جماعية سريعة وتوفير الوقت مع إمكانية استخدام ملفات Excel أو خاصية اللصق السريع
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-2xl p-2 text-white/80 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Quick Info & Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/30 px-6 py-3 border-b border-blue-100 dark:border-blue-800 flex flex-wrap items-center justify-between gap-3 text-xs text-blue-900 dark:text-blue-200 font-bold shrink-0">
            <span className="flex items-center gap-1.5">
              <Info className="w-4 h-4 text-blue-600" />
              قم بتنزيل النموذج وتعبئته ثم رفعه، أو الصق الأسماء والمقاعد مباشرة في الحقول أدناه.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPasteModalOpen(true)}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>📋 اللصق السريع للائحة</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تنزيل نموذج Excel 📥</span>
              </button>
              <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1 transition-colors cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                <span>رفع ملف Excel المعبأ 📤</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".xlsx, .xls"
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <form onSubmit={handleSubmitAll} className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable Container */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
            {/* Quick Paste Modal State */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-3xs transition-colors">
              {/* Age Category */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">الفئة العمرية المقررة *</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 dark:text-slate-100 shadow-2xs transition-colors"
                >
                  {availableCategories.map(catId => (
                    <option key={catId} value={catId}>
                      {getCategoryYearsLabel(catId, currentSeason, sport?.id)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5">الجنس *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedGender('Male')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      selectedGender === 'Male'
                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 border-blue-400 dark:border-blue-600 ring-2 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    👦 ذكور
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedGender('Female')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      selectedGender === 'Female'
                        ? 'bg-pink-50 dark:bg-pink-900/40 text-pink-700 dark:text-pink-200 border-pink-400 dark:border-pink-600 ring-2 ring-pink-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    👧 إناث
                  </button>
                </div>
              </div>

              {/* School Select */}
              <div>
                <label className="block text-xs font-black text-slate-800 dark:text-slate-200 mb-1.5 flex items-center justify-between">
                  <span>المؤسسة التعليمية *</span>
                  {isTeacher && (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 transition-colors">
                      <Lock className="w-3 h-3" /> مؤسستك الرسمية
                    </span>
                  )}
                </label>
                {isTeacher ? (
                  <div className="w-full text-xs font-bold px-3 py-2.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 flex items-center justify-between transition-colors">
                    <span>{resolvedSchoolName}</span>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">مغلق للأساتذة</span>
                  </div>
                ) : (
                  <select
                    value={selectedSchoolId}
                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                    className="w-full text-xs font-bold px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-800 dark:text-slate-100 shadow-2xs transition-colors"
                  >
                    <option value="">-- اختر المؤسسة التعليمية --</option>
                    {schools.map(sch => (
                      <option key={sch.id} value={sch.id}>
                        {sch.name} ({sch.type})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

              {/* Coach Details */}
              <div className="pt-2 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setIsCoachCollapsed(!isCoachCollapsed)}
                  className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>👨‍🏫 بيانات الأستاذ المؤطر للمؤسسة</span>
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
                        className="w-full text-xs font-bold px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">رقم التأجير (Lease number)</label>
                      <input
                        type="text"
                        value={coachLeaseNumber}
                        onChange={(e) => setCoachLeaseNumber(e.target.value)}
                        placeholder="مثال: 1245789"
                        className="w-full text-xs font-bold px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">رقم الهاتف للاتصال والطوارئ</label>
                      <input
                        type="text"
                        value={coachPhone}
                        onChange={(e) => setCoachPhone(e.target.value)}
                        placeholder="مثال: 0661123456"
                        className="w-full text-xs font-bold px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-left"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Slots Grid */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-500" />
                  <span>لوحة التعبئة وإدخال لائحة التلاميذ ({slotCount} مقاعد متاحة):</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {slots.map((slot, index) => {
                    const validation = getSlotValidation(slot);
                    return (
                      <div
                        key={slot.slotIndex}
                        className={`p-4 rounded-2xl border transition-all ${
                          validation.isBlank
                            ? 'bg-white border-slate-200 shadow-2xs'
                            : !validation.isValid
                            ? 'bg-rose-50/40 border-rose-300 shadow-xs'
                            : 'bg-emerald-50/10 border-emerald-300 shadow-xs ring-1 ring-emerald-500/10'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 text-[10px] font-black rounded-md flex items-center gap-1">
                            👤 المقعد {index + 1}
                          </span>
                          {!validation.isBlank && (
                            <button
                              type="button"
                              onClick={() => handleClearSlot(slot.slotIndex)}
                              className="text-[10px] text-rose-500 hover:text-rose-700 font-bold transition-colors cursor-pointer flex items-center gap-0.5"
                            >
                              <Trash2 className="w-3 h-3" /> مسح البيانات
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* Full Name */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">الاسم والنسب للتلميذ(ة)</label>
                            <input
                              type="text"
                              value={slot.fullName}
                              onChange={(e) => handleUpdateSlot(slot.slotIndex, 'fullName', e.target.value)}
                              placeholder="مثال: أحمد أمين"
                              className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>

                          {/* Massar Number */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">رقم مسار (Massar)</label>
                            <input
                              type="text"
                              value={slot.massarNumber}
                              onChange={(e) => handleUpdateSlot(slot.slotIndex, 'massarNumber', e.target.value)}
                              placeholder="مثال: G123456789"
                              className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 uppercase focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-left font-mono"
                            />
                          </div>

                          {/* Birth Date */}
                          <div>
                            <label className="block text-[10px] font-bold text-slate-500 mb-1">تاريخ الازدياد</label>
                            <input
                              type="date"
                              value={slot.birthDate}
                              onChange={(e) => handleUpdateSlot(slot.slotIndex, 'birthDate', e.target.value)}
                              className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-left font-mono"
                            />
                          </div>

                          {/* Specialty (only if athletics) */}
                          {sport.id === 'athletics' && (
                            <div>
                              <label className="block text-[10px] font-bold text-slate-500 mb-1">التخصص الفرعي</label>
                              <select
                                value={slot.athleticsSpecialty || ''}
                                onChange={(e) => handleUpdateSlot(slot.slotIndex, 'athleticsSpecialty', e.target.value)}
                                className="w-full text-xs font-bold px-2.5 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-blue-500"
                              >
                                {(sport.athleticsSpecialties || ['القفز الطولي', 'القفز الطولي العلوي', 'جري 80 متر']).map(spec => (
                                  <option key={spec} value={spec}>{spec}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Photo Upload with compressing */}
                          <div className="sm:col-span-2 flex items-center justify-between gap-3 p-2 bg-slate-50 rounded-lg border border-slate-200 mt-1">
                            <div className="flex items-center gap-2">
                              {slot.photoUrl ? (
                                <img
                                  src={slot.photoUrl}
                                  alt="Participant"
                                  className="w-9 h-9 rounded-lg object-cover border border-slate-300 bg-white"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-slate-200 border border-slate-300 flex items-center justify-center text-lg">
                                  📷
                                </div>
                              )}
                              <div>
                                <p className="text-[9px] font-black text-slate-700">الصورة الشخصية للبطاقة</p>
                                <p className="text-[8px] text-slate-400 font-medium">مستحسنة لبطاقة المشارك</p>
                              </div>
                            </div>
                            <label className="px-2.5 py-1 bg-white hover:bg-slate-100 text-[10px] font-bold text-slate-700 rounded-md border border-slate-300 transition-colors cursor-pointer shrink-0">
                              تحميل الصورة
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleImageFile(f, slot.slotIndex);
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>
                        </div>

                        {/* Error Warning display */}
                        {!validation.isValid && validation.error && (
                          <div className="mt-2 text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded border border-rose-200 flex items-center gap-1 animate-pulse">
                            <AlertCircle className="w-3.5 h-3.5" />
                            <span>{validation.error}</span>
                          </div>
                        )}

                        {/* Valid Green badge */}
                        {!validation.isBlank && validation.isValid && (
                          <div className="mt-2 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>البيانات مكتملة ومتوافقة ومستعدة للحفظ في البطولة</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-100 border-t border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-inner shrink-0">
              <span className="text-xs text-slate-500 font-bold">
                ملحوظة: سيقوم النظام بتجاهل الخانات الفارغة وحفظ فقط المقاعد التي تحتوي على بيانات كاملة.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>جاري حفظ البيانات ومزامنتها... ⚙️</span>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>حفظ وتسجيل لائحة المشاركين دفعة واحدة 💾</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Sub-Modal: Quick Paste */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-[160] overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4 text-center sm:p-0">
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity" onClick={() => setIsPasteModalOpen(false)} />

            <div className="relative transform overflow-hidden rounded-3xl bg-white text-right shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-xl p-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                  <ClipboardPaste className="w-4 h-4 text-indigo-600" />
                  <span>📋 اللصق السريع لبيانات التلاميذ المجمعة</span>
                </h4>
                <button
                  onClick={() => setIsPasteModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mb-3">
                انسخ صفوفاً كاملة من ملف Excel أو ملف Word (يجب أن يحتوي كل سطر على: <span className="font-bold text-indigo-600">رقم مسار، الاسم الكامل، وتاريخ الازدياد</span>) ثم الصقها في المستطيل أدناه. سيقوم النظام بتحليلها تلقائياً وتوزيعها على المقاعد!
              </p>

              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="مثال:&#10;G123456789	يوسف العلوي	2012-05-14&#10;G987654321	أروى الفاضلي	2012-03-20"
                rows={8}
                className="w-full text-xs font-bold p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-slate-800 text-left font-mono"
              />

              <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsPasteModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                >
                  تطبيق واستخلاص البيانات ⚡
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
