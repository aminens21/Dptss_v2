import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DataService, SPORTS_MAP, AGE_CATEGORIES, getAgeCategoriesForSeason, getCategoryGenderLabel, isClubTournament, normalizeCategoryKey, validateBirthDateForCategory, isTeacherLevelAllowedForTournament } from '../lib/dataService';
import { Student, Sport, Tournament, School, Directorate } from '../types';
import { ParticipationFormPdfModal } from '../components/ParticipationFormPdfModal';
import { CrossCountryBulkRegisterModal } from '../components/CrossCountryBulkRegisterModal';
import { SportBulkRegisterModal } from '../components/SportBulkRegisterModal';
import { CROSS_COUNTRY_CATEGORIES } from '../lib/crossCountryConfig';
import * as XLSX from 'xlsx';
import {
  Users,
  Plus,
  Trash2,
  CalendarDays,
  User,
  GraduationCap,
  Building,
  Upload,
  UserPlus,
  ArrowRight,
  AlertCircle,
  Clock,
  Sparkles,
  RefreshCw,
  Search,
  CheckCircle2,
  Trophy,
  FileText,
  Download,
  Printer,
  Lock,
  Edit,
  FileSpreadsheet
} from 'lucide-react';
import toast from 'react-hot-toast';

export const TeacherTeams: React.FC = () => {
  const { userProfile, openProfileModal } = useAuth();
  const [searchParams] = useSearchParams();
  const urlSport = searchParams.get('sport');
  const urlSchool = searchParams.get('school');
  
  // Data State
  const [sportsConfig, setSportsConfig] = useState<Sport[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState('2026/2027');

  // Selected Context & Categorization Filter
  const [selectedSportId, setSelectedSportId] = useState<string | null>(urlSport || null);
  const [sportTabFilter, setSportTabFilter] = useState<'PROGRAMMED' | 'NON_PROGRAMMED' | 'ALL'>('PROGRAMMED');

  const isTeacherRole = userProfile?.role === 'TEACHER';
  const canManage = userProfile?.role === 'CENTRAL_ADMIN' || userProfile?.role === 'REGIONAL_ADMIN' || userProfile?.role === 'PROVINCIAL_ADMIN' || userProfile?.isTechCommitteeHead;

  const teacherCadre = useMemo(() => {
    if (userProfile?.teachingCadre) return userProfile.teachingCadre;
    if (userProfile?.schoolId || userProfile?.schoolName) {
      const userSchool = (schools || []).find(s => 
        (userProfile.schoolId && s.id === userProfile.schoolId) || 
        (userProfile.schoolName && s.name === userProfile.schoolName)
      );
      if (userSchool?.type) return userSchool.type;
    }
    return undefined;
  }, [userProfile, schools]);

  const teacherAllowedTournaments = useMemo(() => {
    if (!isTeacherRole || canManage) return tournaments;
    return tournaments.filter(t => isTeacherLevelAllowedForTournament(teacherCadre, t.level));
  }, [tournaments, isTeacherRole, canManage, teacherCadre]);

  const isSportProgrammed = (s: Sport): boolean => {
    if (teacherAllowedTournaments.some(t => t.sportId === s.id)) return true;
    if (canManage) {
      if (s.isProgrammed !== undefined) return s.isProgrammed;
      return (s.ageCategories && s.ageCategories.length > 0 && s.studentLimit !== undefined && s.studentLimit > 0) || false;
    }
    return false;
  };

  // Classified Sports
  const programmedSports = useMemo(() => {
    return sportsConfig.filter(s => isSportProgrammed(s));
  }, [sportsConfig, teacherAllowedTournaments]);

  const nonProgrammedSports = useMemo(() => {
    return sportsConfig.filter(s => !isSportProgrammed(s));
  }, [sportsConfig, teacherAllowedTournaments]);

  // New Student Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [fullName, setFullName] = useState('');
  const [massarNumber, setMassarNumber] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [gender, setGender] = useState<'Male' | 'Female'>('Male');
  const [birthDate, setBirthDate] = useState('');
  const [category, setCategory] = useState('');
  const [affiliationType, setAffiliationType] = useState<'non_club' | 'club_affiliated'>('non_club');
  const [participationType, setParticipationType] = useState<'individual' | 'school_team'>('individual');
  const [athleticsSpecialty, setAthleticsSpecialty] = useState('');
  const [photo, setPhoto] = useState<string>('');
  const [coachName, setCoachName] = useState('');
  const [coachLeaseNumber, setCoachLeaseNumber] = useState('');
  const [coachPhone, setCoachPhone] = useState('');
  const [uploading, setUploading] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [studentToEditConfirm, setStudentToEditConfirm] = useState<Student | null>(null);
  const [isDeletingStudent, setIsDeletingStudent] = useState(false);
  const formCardRef = useRef<HTMLDivElement>(null);

  // Locked registration constraint state (for preselected / programmed tournament contexts)
  const [lockedCategory, setLockedCategory] = useState<string | null>(null);
  const [lockedGender, setLockedGender] = useState<'Male' | 'Female' | null>(null);
  const [lockedAffiliation, setLockedAffiliation] = useState<'non_club' | 'club_affiliated' | null>(null);

  // Category Selection for Drill-down student view (catId_gender)
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<string | null>(null);

  // Category Coaches states
  const [predefinedCoaches, setPredefinedCoaches] = useState<Record<string, { coachName: string; coachLeaseNumber: string; coachPhone: string }>>({});
  const [editingCoachKey, setEditingCoachKey] = useState<string | null>(null);
  const [tempCoachName, setTempCoachName] = useState('');
  const [tempCoachLease, setTempCoachLease] = useState('');
  const [tempCoachPhone, setTempCoachPhone] = useState('');

  // PDF Export Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isCrossCountryBulkOpen, setIsCrossCountryBulkOpen] = useState(false);
  const [isSportBulkOpen, setIsSportBulkOpen] = useState(false);
  const [crossCountryInitialRaceId, setCrossCountryInitialRaceId] = useState('u15_male');
  const [crossCountryInitialAffiliation, setCrossCountryInitialAffiliation] = useState<'non_club' | 'club_affiliated'>('non_club');
  const [activeDirectorateObj, setActiveDirectorateObj] = useState<Directorate | null>(null);
  const [showOnlyParticipatingCoaches, setShowOnlyParticipatingCoaches] = useState(true);
  const [rosterGenderFilter, setRosterGenderFilter] = useState<'ALL' | 'Male' | 'Female'>('ALL');

  // Verification: Teacher profile completeness
  const isTeacher = userProfile?.role === 'TEACHER';
  const isProfileIncomplete = isTeacher && (!userProfile.workLocation || !userProfile.leaseNumber) &&
    sessionStorage.getItem('teacher_profile_prompt_dismissed') !== 'true' &&
    localStorage.getItem('teacher_profile_prompt_dismissed_global') !== 'true';
  const schoolName = userProfile?.workLocation || urlSchool || '';

  useEffect(() => {
    loadInitialData();
    const handleDirChange = () => {
      loadInitialData();
    };
    window.addEventListener('directorateChanged', handleDirChange);

    // Real-time live synchronization for students and schools across devices
    const unsubStudents = DataService.subscribeToStudents((allStudents) => {
      const activeDirId = DataService.getActiveDirectorateId();
      const dirStudents = allStudents.filter(st => (st.directorateId || 'taourirt') === activeDirId);
      const targetSchool = isTeacher ? userProfile?.workLocation : (userProfile?.workLocation || urlSchool);
      if (isTeacher) {
        if (userProfile?.workLocation || userProfile?.schoolId) {
          const cleanLoc = (userProfile?.workLocation || '').trim().toLowerCase();
          setStudents(dirStudents.filter(s => {
            const sName = (s.schoolName || '').trim().toLowerCase();
            return (
              (cleanLoc && (sName === cleanLoc || sName.includes(cleanLoc) || cleanLoc.includes(sName))) ||
              (userProfile?.schoolId && s.schoolId === userProfile.schoolId)
            );
          }));
        } else {
          setStudents([]);
        }
      } else if (targetSchool) {
        setStudents(dirStudents.filter(s => s.schoolName === targetSchool));
      } else {
        setStudents(dirStudents);
      }
    });

    const unsubSchools = DataService.subscribeToSchools((schoolList) => {
      const activeDirId = DataService.getActiveDirectorateId();
      const dirSchools = schoolList.filter(sch => (sch.directorateId || 'taourirt') === activeDirId);
      setSchools(dirSchools);
    });

    const unsubTournaments = DataService.subscribeToTournaments((tournList) => {
      const activeDirId = DataService.getActiveDirectorateId();
      const dirTournaments = tournList.filter(t => (t.directorateId || 'taourirt') === activeDirId);
      setTournaments(dirTournaments);
    });

    const unsubSportsConfig = DataService.subscribeToSportsConfig((sportsList) => {
      setSportsConfig(sportsList);
    });

    return () => {
      window.removeEventListener('directorateChanged', handleDirChange);
      unsubStudents();
      unsubSchools();
      unsubTournaments();
      unsubSportsConfig();
    };
  }, [userProfile, urlSchool]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const activeDirId = DataService.getActiveDirectorateId();
      const [config, allStudents, season, tournList, schoolList, activeDir] = await Promise.all([
        DataService.getSportsConfig(),
        DataService.getStudents(),
        DataService.getActiveSeason(),
        DataService.getTournaments(),
        DataService.getSchools(),
        DataService.getActiveDirectorate()
      ]);

      setActiveDirectorateObj(activeDir);
      const dirSchools = schoolList.filter(sch => (sch.directorateId || 'taourirt') === activeDirId);
      const dirStudents = allStudents.filter(st => (st.directorateId || 'taourirt') === activeDirId);

      const dirTournaments = tournList.filter(t => (t.directorateId || 'taourirt') === activeDirId);

      setSportsConfig(config);
      setCurrentSeason(season);
      setTournaments(dirTournaments);
      setSchools(dirSchools);
      
      // For teachers, strictly lock school to their registered workLocation
      const targetSchool = isTeacher ? userProfile?.workLocation : (userProfile?.workLocation || urlSchool);
      if (targetSchool) {
        const targetStr = String(targetSchool).trim().toLowerCase();
        const matched = dirSchools.find(s => {
          const sName = String(s.name || '').trim().toLowerCase();
          return sName && (
            sName === targetStr ||
            sName.includes(targetStr) ||
            targetStr.includes(sName)
          );
        });
        if (matched) {
          setSelectedSchoolId(matched.id);
        } else if (dirSchools.length > 0) {
          setSelectedSchoolId(dirSchools[0].id);
        }
      } else if (dirSchools.length > 0) {
        setSelectedSchoolId(dirSchools[0].id);
      }

      // Filter students: Teachers can ONLY see and manage students of their own institution
      if (isTeacher) {
        if (userProfile?.workLocation || userProfile?.schoolId) {
          const cleanLoc = (userProfile?.workLocation || '').trim().toLowerCase();
          setStudents(dirStudents.filter(s => {
            const sName = (s.schoolName || '').trim().toLowerCase();
            return (
              (cleanLoc && (sName === cleanLoc || sName.includes(cleanLoc) || cleanLoc.includes(sName))) ||
              (userProfile?.schoolId && s.schoolId === userProfile.schoolId)
            );
          }));
        } else {
          setStudents([]);
        }
      } else if (targetSchool) {
        setStudents(dirStudents.filter(s => s.schoolName === targetSchool));
      } else {
        setStudents(dirStudents);
      }

      if (urlSport) {
        setSelectedSportId(urlSport);
      }
    } catch (error) {
      console.error('Error loading teacher team data:', error);
      toast.error('حدث خطأ أثناء تحميل معطيات الفريق');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSport = (sportId: string) => {
    setSelectedSportId(sportId);
    setSelectedCategoryKey(null);
    
    // Automatically pre-select first active category of this sport if any
    const sportTourns = tournaments.filter(t => t.sportId === sportId);
    const tournCats = Array.from(new Set(sportTourns.map(t => normalizeCategoryKey(t.ageCategory)).filter(Boolean)));
    if (tournCats.length > 0) {
      setCategory(tournCats[0]);
    } else {
      const sport = sportsConfig.find(s => s.id === sportId);
      if (sport && sport.ageCategories && sport.ageCategories.length > 0) {
        setCategory(sport.ageCategories[0]);
      } else {
        setCategory('');
      }
    }
  };

  // Helper to compress image on client-side to extremely small file size
  const compressImage = (dataUrl: string, maxWidth = 300, maxHeight = 300, quality = 0.5): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(compressedDataUrl);
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  // Drag and Drop/File Upload handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Support up to 12MB since we compress it anyway
    if (file.size > 12 * 1024 * 1024) {
      toast.error('حجم الصورة كبير جداً. يرجى اختيار صورة أقل من 12 ميغابايت.');
      return;
    }

    setUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const originalBase64 = reader.result as string;
        // Compress base64 to under 20-30KB
        const compressedBase64 = await compressImage(originalBase64);
        
        // Calculate size for logging/display
        const rawLength = compressedBase64.length - 'data:image/jpeg;base64,'.length;
        const sizeInKB = Math.round((rawLength * 3) / 4 / 1024);

        setPhoto(compressedBase64);
        toast.success(`تم حفظ الصورة وحجمها مخفض جداً (${sizeInKB} KB)`);
      } catch (err) {
        console.error("Compression error:", err);
        toast.error('حدث خطأ أثناء معالجة وضغط الصورة');
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      toast.error('حدث خطأ أثناء قراءة الملف');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const getCrossCountryDistance = (catId: string, g: 'Male' | 'Female'): string => {
    if (catId === 'U12') return g === 'Female' ? '1000 م' : '1500 م';
    if (catId === 'U15') return g === 'Female' ? '2000 م' : '3000 م';
    if (catId === 'U18') return g === 'Female' ? '3000 م' : '4000 م';
    if (catId === 'U20') return g === 'Female' ? '3000 م' : '5000 م';
    return '3000 م';
  };

  // Helpers for checking regional tournament existence
  const hasActiveTournament = (sportId: string): boolean => {
    return tournaments.some(t => t.sportId === sportId);
  };

  const getSportTournament = (sportId: string): Tournament | undefined => {
    return tournaments.find(t => t.sportId === sportId);
  };

  const handleOpenNewStudentForm = (initialCat?: string, initialGender?: 'Male' | 'Female', initialAffiliation?: 'non_club' | 'club_affiliated') => {
    // Sanitize parameters in case handler is invoked as an event callback
    const cleanCat = typeof initialCat === 'string' ? initialCat : undefined;
    const cleanGender = typeof initialGender === 'string' && (initialGender === 'Male' || initialGender === 'Female') ? initialGender : undefined;
    const cleanAffiliation = typeof initialAffiliation === 'string' && (initialAffiliation === 'non_club' || initialAffiliation === 'club_affiliated') ? initialAffiliation : undefined;

    if (!selectedSportId) return;

    const selectedSportObj = sportsConfig.find(s => s.id === selectedSportId);
    if (!selectedSportObj || !isSportProgrammed(selectedSportObj)) {
      const sportName = SPORTS_MAP[selectedSportId]?.name || selectedSportObj?.name || selectedSportId;
      toast.error(`البطولة الخاصة بـ (${sportName}) في طور الإعداد والتجهيز حالياً وغير مفتوحة للتسجيل. لا يمكن إضافة التلاميذ إلا بعد تفعيل البرمجة رسمياً من طرف الإدارة واللجنة التقنية.`);
      return;
    }

    const activeTourn = getSportTournament(selectedSportId);
    if (activeTourn?.status === 'Completed' || activeTourn?.status === 'Archived') {
      toast.error('البطولة منتهية ومؤرشفة نهائياً للنتائج، ولا يمكن إضافة تلاميذ جديدين.');
      return;
    }

    if (activeTourn?.status === 'Ongoing' && isTeacher) {
      toast.error('البطولة جارية حالياً ومغلقة أمام تسجيل الأساتذة، ومتاحة فقط للمسؤول الإقليمي أو المركزي لاستكمال اللوائح.');
      return;
    }

    setEditingStudentId(null);
    setFullName('');
    setMassarNumber('');
    setBirthDate('');
    setPhoto('');
    setAthleticsSpecialty('');

    const sportTourns = tournaments.filter(t => t.sportId === selectedSportId);

    // 1. Calculate & Lock Affiliation
    let targetAff: 'non_club' | 'club_affiliated' = 'non_club';
    let isAffLocked = false;
    if (selectedSportId === 'cross_country') {
      if (cleanAffiliation) {
        targetAff = cleanAffiliation;
        isAffLocked = true;
      } else {
        const hasClubCC = sportTourns.some(t => t.affiliationType === 'club_affiliated' || t.affiliationType === 'open' || t.affiliationType === 'both');
        const hasNonClubCC = sportTourns.some(t => !t.affiliationType || t.affiliationType === 'non_club' || t.affiliationType === 'open' || t.affiliationType === 'both');
        if (hasClubCC && !hasNonClubCC) {
          targetAff = 'club_affiliated';
          isAffLocked = true;
        } else if (hasNonClubCC && !hasClubCC) {
          targetAff = 'non_club';
          isAffLocked = true;
        } else {
          targetAff = 'non_club';
          isAffLocked = false;
        }
      }
    } else if (cleanAffiliation) {
      targetAff = cleanAffiliation;
      isAffLocked = true;
    } else {
      const affTypes = Array.from(new Set(sportTourns.map(t => t.affiliationType || 'non_club')));
      if (affTypes.length === 1) {
        targetAff = affTypes[0] === 'club_affiliated' ? 'club_affiliated' : 'non_club';
        isAffLocked = true;
      } else {
        targetAff = isClubTournament(getSportTournament(selectedSportId)) ? 'club_affiliated' : 'non_club';
      }
    }
    setAffiliationType(targetAff);
    setLockedAffiliation(isAffLocked ? targetAff : null);

    // 2. Calculate & Lock Gender
    let targetGender: 'Male' | 'Female' = 'Male';
    let isGenderLocked = false;
    if (cleanGender) {
      targetGender = cleanGender;
      isGenderLocked = true;
    } else {
      const genders = Array.from(new Set(sportTourns.map(t => t.gender).filter(g => g === 'Male' || g === 'Female')));
      if (genders.length === 1) {
        targetGender = genders[0] as 'Male' | 'Female';
        isGenderLocked = true;
      }
    }
    setGender(targetGender);
    setLockedGender(isGenderLocked ? targetGender : null);

    // 3. Calculate & Lock Category
    let targetCategory = '';
    let isCatLocked = false;
    if (cleanCat) {
      targetCategory = cleanCat;
      isCatLocked = true;
    } else {
      const cats: string[] = Array.from(new Set(sportTourns.map(t => normalizeCategoryKey(t.ageCategory)).filter(Boolean))) as string[];
      if (cats.length === 1) {
        targetCategory = cats[0];
        isCatLocked = true;
      } else if (activeSportCategories.length === 1) {
        targetCategory = activeSportCategories[0];
        isCatLocked = true;
      } else if (activeSportCategories.length > 0) {
        targetCategory = activeSportCategories[0];
      }
    }
    setCategory(targetCategory);
    setLockedCategory(isCatLocked ? targetCategory : null);
    
    // Default the coach fields to current user profile
    setCoachName(userProfile?.fullName || '');
    setCoachLeaseNumber(userProfile?.leaseNumber || '');
    setCoachPhone(userProfile?.phone || '');
    
    // Auto-select school: for teachers, strictly their workLocation
    const targetSchool = isTeacher ? userProfile?.workLocation : (userProfile?.workLocation || urlSchool);
    if (targetSchool) {
      const matched = schools.find(s => 
        s.name && (
          s.name.trim().toLowerCase() === targetSchool.trim().toLowerCase() ||
          s.name.includes(targetSchool) ||
          targetSchool.includes(s.name)
        )
      );
      if (matched) {
        setSelectedSchoolId(matched.id);
      } else if (schools.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(schools[0].id);
      }
    } else if (schools.length > 0 && !selectedSchoolId) {
      setSelectedSchoolId(schools[0].id);
    }
    
    setIsFormOpen(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const canTeacherManageStudent = (student: Student) => {
    if (!isTeacher) return true; // Central admin, etc. can manage everything
    if (!userProfile) return false;
    
    // Verify student belongs to the teacher's institution
    const cleanStudentSchool = String(student.schoolName || '').trim().toLowerCase();
    const cleanTeacherSchool = String(userProfile.workLocation || '').trim().toLowerCase();
    const isSameSchoolName = cleanStudentSchool && cleanTeacherSchool && (
      cleanStudentSchool === cleanTeacherSchool ||
      cleanStudentSchool.includes(cleanTeacherSchool) ||
      cleanTeacherSchool.includes(cleanStudentSchool)
    );

    const matched = schools.find(s => s.name === userProfile.workLocation || s.name.includes(userProfile.workLocation || ''));
    const teacherSchoolId = matched ? matched.id : (userProfile.id || `sch-${(userProfile.workLocation || '').replace(/\s+/g, '-')}`);
    const isSameSchoolId = student.schoolId && teacherSchoolId && student.schoolId === teacherSchoolId;

    if (!isSameSchoolName && !isSameSchoolId) {
      return false;
    }

    // Teacher can edit and delete ANY participant belonging to their institution
    return true;
  };

  // Step 1: Open Confirmation Modal before editing
  const handleRequestEditStudent = (student: Student) => {
    if (!canTeacherManageStudent(student)) {
      toast.error('غير مسموح لك بتعديل مشاركة لا تنتمي لمؤسستك التعليمية.');
      return;
    }
    setStudentToEditConfirm(student);
  };

  // Step 2: Proceed with loading data into the form after confirmation
  const confirmStartEdit = (student: Student) => {
    setEditingStudentId(student.id);
    setFullName(student.fullName);
    setMassarNumber(student.massarNumber || '');
    setGender(student.gender);
    setBirthDate(student.birthDate);
    setCategory(normalizeCategoryKey(student.category));
    
    // Unlock any temporary locks so teacher can correct data freely
    setLockedGender(null);
    setLockedCategory(null);
    setLockedAffiliation(null);

    if (student.schoolId) {
      setSelectedSchoolId(student.schoolId);
    } else if (student.schoolName) {
      const matched = schools.find(s => s.name === student.schoolName || s.id === student.schoolId);
      if (matched) setSelectedSchoolId(matched.id);
    }
    if (student.participationType) {
      setParticipationType(student.participationType);
    }
    if (student.affiliationType) {
      setAffiliationType(student.affiliationType);
    } else {
      setAffiliationType('non_club');
    }
    setPhoto(student.photoUrl || '');
    if (student.athleticsSpecialty) {
      setAthleticsSpecialty(student.athleticsSpecialty);
    } else {
      setAthleticsSpecialty('');
    }
    
    // Load saved coach details or default to logged-in user profile
    setCoachName(student.coachName || userProfile?.fullName || '');
    setCoachLeaseNumber(student.coachLeaseNumber || userProfile?.leaseNumber || '');
    setCoachPhone(student.coachPhone || userProfile?.phone || '');
    
    setStudentToEditConfirm(null);
    setIsFormOpen(true);

    toast.success(`تم فتح نموذج تعديل بيانات المشارك(ة): ${student.fullName}`, {
      icon: '✏️',
      duration: 3500
    });

    setTimeout(() => {
      if (formCardRef.current) {
        formCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 60);
  };

  const handleBirthDateChange = (newDate: string) => {
    setBirthDate(newDate);
    // If category is strictly locked by tournament context, validate against it
    if (!newDate) return;

    if (lockedCategory) {
      const validation = validateBirthDateForCategory(newDate, lockedCategory, currentSeason, gender, selectedSportId);
      if (!validation.isValid && validation.errorMessage) {
        toast.error(validation.errorMessage, { duration: 4000 });
      }
      return;
    }

    const parts = newDate.split('-');
    const year = parseInt(parts[0], 10);
    if (isNaN(year) || year < 1990 || year > 2030) return;

    const match = currentSeason.match(/(\d{4})/);
    const startYear = match ? parseInt(match[1], 10) : 2026;

    let detectedCatId = '';
    if (year >= startYear - 11) {
      detectedCatId = 'U12';
    } else if (year >= startYear - 14 && year <= startYear - 12) {
      detectedCatId = 'U15';
    } else if (year >= startYear - 17 && year <= startYear - 15) {
      detectedCatId = 'U18';
    } else {
      detectedCatId = 'U20';
    }

    if (detectedCatId) {
      if (activeSportCategories.includes(detectedCatId)) {
        setCategory(detectedCatId);
      } else if (activeSportCategories.includes('OPEN')) {
        setCategory('OPEN');
      } else if (activeSportCategories.length > 0) {
        setCategory(activeSportCategories[0]);
      }
    }
  };

  const birthDateValidation = useMemo(() => {
    if (!birthDate || !category) return { isValid: true };
    return validateBirthDateForCategory(birthDate, category, currentSeason, gender, selectedSportId);
  }, [birthDate, category, currentSeason, gender, selectedSportId]);

  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedSportId) return;

    const activeSportConfig = sportsConfig.find(s => s.id === selectedSportId);
    if (!activeSportConfig || !isSportProgrammed(activeSportConfig)) {
      const sportName = SPORTS_MAP[selectedSportId]?.name || selectedSportId;
      toast.error(`خطأ في التسجيل: البطولة الخاصة بـ (${sportName}) في طور الإعداد حالياً وغير مفتوحة للتسجيل.`);
      return;
    }

    if (!fullName.trim()) {
      toast.error('يرجى إدخال الإسم والنسب للتلميذ');
      return;
    }
    if (!birthDate) {
      toast.error('يرجى تحديد تاريخ الازدياد');
      return;
    }
    if (!category) {
      toast.error('يرجى تحديد الفئة الرياضية');
      return;
    }

    if (selectedSportId === 'athletics' && !athleticsSpecialty) {
      toast.error('يرجى تحديد تخصص ألعاب القوى');
      return;
    }

    // 1. General Limit Checked
    if (activeSportConfig?.studentLimit && activeSportConfig.studentLimit > 0) {
      const activeCount = editingStudentId 
        ? activeSportStudents.filter(s => s.id !== editingStudentId).length
        : activeSportStudents.length;
      if (activeCount >= activeSportConfig.studentLimit) {
        toast.error(`خطأ في التسجيل: تم بلوغ السقف الأقصى المسموح به للتسجيل في هذا التخصص وهو ${activeSportConfig.studentLimit} تلاميذ.`);
        return;
      }
    }

    // 2. Cross Country Specific Limit Checked
    if (selectedSportId === 'cross_country') {
      const normalizedCat = normalizeCategoryKey(category);
      const studentAff = affiliationType || 'non_club';
      const sameGroupStudents = activeSportStudents.filter(
        s => s.id !== editingStudentId && 
             normalizeCategoryKey(s.category) === normalizedCat && 
             s.gender === gender && 
             (s.affiliationType || 'non_club') === studentAff &&
             s.participationType === participationType
      );
      const limitVal = participationType === 'individual' ? 3 : 5;
      if (sameGroupStudents.length >= limitVal) {
        const typeLabel = participationType === 'individual' ? 'مشاركة فردية (3 كحد أقصى)' : 'مشاركة فريق المؤسسة (5 كحد أقصى)';
        const affLabel = studentAff === 'club_affiliated' ? 'لصنف المنتمين للأندية' : 'لصنف غير المنتمين للأندية';
        toast.error(`خطأ في التسجيل: لقد بلغت السقف الأقصى للتسجيل لهذه الفئة والجنس ${affLabel} لـ (${typeLabel}) وهو ${limitVal} تلاميذ.`);
        return;
      }
      const totalAffCatStudents = activeSportStudents.filter(
        s => s.id !== editingStudentId && 
             normalizeCategoryKey(s.category) === normalizedCat && 
             s.gender === gender &&
             (s.affiliationType || 'non_club') === studentAff
      );
      if (totalAffCatStudents.length >= 8) {
        const affLabel = studentAff === 'club_affiliated' ? 'المنتمين للأندية' : 'غير المنتمين للأندية';
        toast.error(`خطأ في التسجيل: لقد بلغت السقف الإجمالي الأقصى المسموح به لهذه الفئة والجنس لصنف ${affLabel} وهو 8 تلاميذ (3 فردي + 5 فريق المؤسسة).`);
        return;
      }
    }

    // Validation for Massar code (Letter + 9 digits)
    const massarRegex = /^[A-Z]\d{9}$/;
    const cleanMassar = massarNumber.trim().toUpperCase();
    if (!cleanMassar) {
      toast.error('يرجى إدخال رقم مسار للتلميذ(ة)');
      return;
    }
    if (!massarRegex.test(cleanMassar)) {
      toast.error('رقم مسار إجباري ويجب أن يتكون من حرف لاتيني كبير متبوعاً بـ 9 أرقام (مثال: F212121212)');
      return;
    }

    // Strict validation for birth date matching category
    const validation = validateBirthDateForCategory(birthDate, category, currentSeason, gender, selectedSportId);
    if (!validation.isValid) {
      toast.error(validation.errorMessage || 'خطأ في تاريخ الازدياد لا يتناسب مع الفئة المعنية');
      return;
    }

    try {
      let resolvedSchoolName = schoolName;
      let resolvedSchoolId = selectedSchoolId;

      if (isTeacher) {
        if (!userProfile?.workLocation) {
          toast.error('يرجى استكمال مقر العمل (المؤسسة التعليمية) في ملفكم الشخصي أولاً.');
          return;
        }
        resolvedSchoolName = userProfile.workLocation;
        const matched = schools.find(s => s.name === userProfile.workLocation || s.name.includes(userProfile.workLocation!));
        resolvedSchoolId = matched ? matched.id : (userProfile.id || `sch-${userProfile.workLocation.replace(/\s+/g, '-')}`);
      } else {
        const chosenSchool = schools.find(s => s.id === selectedSchoolId);
        resolvedSchoolName = chosenSchool ? chosenSchool.name : (userProfile?.workLocation || schoolName);
        resolvedSchoolId = chosenSchool ? chosenSchool.id : (userProfile?.id || 'unknown_school');
      }

      const normalizedCat = normalizeCategoryKey(category);
      const coachKey = `${normalizedCat}_${gender}`;
      const coachInfo = effectiveCoaches[coachKey] || {
        coachName: userProfile?.fullName || '',
        coachLeaseNumber: userProfile?.leaseNumber || '',
        coachPhone: userProfile?.phone || ''
      };

      if (editingStudentId) {
        const studentData: Partial<Student> = {
          fullName: fullName.trim(),
          massarNumber: massarNumber.trim() || undefined,
          gender,
          birthDate,
          category: normalizeCategoryKey(category),
          affiliationType,
          schoolId: resolvedSchoolId,
          schoolName: resolvedSchoolName,
          photoUrl: photo || undefined,
          coachName: (coachInfo.coachName || userProfile?.fullName || '').trim() || undefined,
          coachLeaseNumber: (coachInfo.coachLeaseNumber || userProfile?.leaseNumber || '').trim() || undefined,
          coachPhone: (coachInfo.coachPhone || userProfile?.phone || '').trim() || undefined,
          ...(selectedSportId === 'cross_country' ? {
            participationType,
            distance: getCrossCountryDistance(category, gender)
          } : {}),
          ...(selectedSportId === 'athletics' ? {
            athleticsSpecialty: athleticsSpecialty || undefined
          } : {})
        };

        await DataService.updateStudent(editingStudentId, studentData);
        setStudents(prev => prev.map(s => s.id === editingStudentId ? { ...s, ...studentData } : s));
        
        toast.success('تم تعديل بيانات التلميذ بنجاح!');
      } else {
        const studentData: Omit<Student, 'id' | 'createdAt' | 'updatedAt'> = {
          fullName: fullName.trim(),
          massarNumber: massarNumber.trim() || undefined,
          gender,
          birthDate,
          category: normalizeCategoryKey(category),
          affiliationType,
          schoolId: resolvedSchoolId,
          schoolName: resolvedSchoolName,
          sportId: selectedSportId,
          photoUrl: photo || undefined,
          coachName: (coachInfo.coachName || userProfile?.fullName || '').trim() || undefined,
          coachLeaseNumber: (coachInfo.coachLeaseNumber || userProfile?.leaseNumber || '').trim() || undefined,
          coachPhone: (coachInfo.coachPhone || userProfile?.phone || '').trim() || undefined,
          ...(selectedSportId === 'cross_country' ? {
            participationType,
            distance: getCrossCountryDistance(category, gender)
          } : {}),
          ...(selectedSportId === 'athletics' ? {
            athleticsSpecialty: athleticsSpecialty || undefined
          } : {})
        };

        const newStudent = await DataService.addStudent(studentData);
        setStudents(prev => [newStudent, ...prev]);
        
        toast.success('تم تسجيل وإضافة التلميذ إلى الفريق بنجاح!');
      }
      
      // Reset Form
      setFullName('');
      setMassarNumber('');
      setBirthDate('');
      setPhoto('');
      setAthleticsSpecialty('');
      setCoachName('');
      setCoachLeaseNumber('');
      setCoachPhone('');
      setEditingStudentId(null);
      setIsFormOpen(false);
    } catch (error) {
      console.error('Error saving student:', error);
      toast.error('تعذر حفظ بيانات التلميذ حالياً');
    }
  };

  const handleRequestDeleteStudent = (student: Student) => {
    if (!canTeacherManageStudent(student)) {
      toast.error('غير مسموح لك بحذف مشاركة لا تنتمي لمؤسستك التعليمية.');
      return;
    }
    setStudentToDelete(student);
  };

  const executeDeleteStudent = async () => {
    if (!studentToDelete) return;
    setIsDeletingStudent(true);
    const toastId = toast.loading(`جاري حذف المشارك(ة) ${studentToDelete.fullName}...`);
    try {
      await DataService.deleteStudent(studentToDelete.id);
      setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
      toast.dismiss(toastId);
      toast.success(`تم حذف المشارك "${studentToDelete.fullName}" من اللائحة بنجاح`);
    } catch (error) {
      console.error('Error deleting student:', error);
      toast.dismiss(toastId);
      toast.error('تعذر حذف التلميذ حالياً');
    } finally {
      setIsDeletingStudent(false);
      setStudentToDelete(null);
    }
  };

  // Helpers
  const getSportName = (id: string) => SPORTS_MAP[id]?.name || id;
  const getSportIcon = (id: string) => SPORTS_MAP[id]?.icon || '🏆';
  
  const getCategoryLabel = (catId: string, gender?: string) => {
    return getCategoryGenderLabel(catId, gender, currentSeason, selectedSportId);
  };

  // Filter students for the currently selected sport
  const activeSportStudents = students.filter(s => s.sportId === selectedSportId);

  // Filter by selected category card drill-down (if selected) or gender
  const displayedSportStudents = useMemo(() => {
    return activeSportStudents.filter(s => {
      if (selectedCategoryKey) {
        const parts = selectedCategoryKey.split('_');
        const catId = parts[0];
        const g = parts[1];
        const aff = parts[2];
        
        const normStudentCat = normalizeCategoryKey(s.category);
        if (normStudentCat !== catId || s.gender !== g) return false;
        if (aff && s.affiliationType !== aff) return false;
      } else {
        // If no category card is selected, do not display any student list
        return false;
      }
      return true;
    });
  }, [activeSportStudents, selectedCategoryKey]);

  const effectiveCoaches = useMemo(() => {
    const coaches: Record<string, { coachName: string; coachLeaseNumber: string; coachPhone: string }> = {};
    
    // First, fill using the existing student data (from DB)
    activeSportStudents.forEach(s => {
      const normCat = normalizeCategoryKey(s.category);
      // For cross country, we might want to split coaches by affiliation if we split cards
      const key = (selectedSportId === 'cross_country' && s.affiliationType)
        ? `${normCat}_${s.gender}_${s.affiliationType}`
        : `${normCat}_${s.gender}`;
        
      if (s.coachName && !coaches[key]) {
        coaches[key] = {
          coachName: s.coachName,
          coachLeaseNumber: s.coachLeaseNumber || '',
          coachPhone: s.coachPhone || ''
        };
      }
    });

    // Second, merge with predefinedCoaches set by the user during this session
    Object.keys(predefinedCoaches).forEach(key => {
      if (predefinedCoaches[key]?.coachName) {
        coaches[key] = predefinedCoaches[key];
      }
    });

    return coaches;
  }, [activeSportStudents, predefinedCoaches, selectedSportId]);

  // Cross Country Bulk Modal & Excel Export Handlers
  const handleOpenCrossCountryBulk = (catKey?: string | null, aff?: 'non_club' | 'club_affiliated') => {
    if (aff) {
      setCrossCountryInitialAffiliation(aff);
    }
    if (catKey) {
      const parts = catKey.split('_');
      const cat = parts[0]?.toLowerCase();
      const g = parts[1]?.toLowerCase();
      const match = CROSS_COUNTRY_CATEGORIES.find(c => 
        c.category.toLowerCase() === cat && c.gender.toLowerCase() === g
      );
      if (match) {
        setCrossCountryInitialRaceId(match.id);
      }
    }
    setIsCrossCountryBulkOpen(true);
  };

  const handleExportStudentsListToExcel = (studentList: Student[], title: string) => {
    if (!studentList || studentList.length === 0) {
      toast.error('لا يوجد تلاميذ في هذه اللائحة لتصديرهم إلى Excel.');
      return;
    }

    const excelData = studentList.map((s, index) => {
      const roleLabel = s.sportId === 'cross_country'
        ? (s.participationType === 'school_team' ? 'فريق المؤسسة (جماعي)' : 'مشاركة فردية (فردي)')
        : (s.participationType === 'individual' ? 'فردي' : 'فريق');
      const affLabel = s.affiliationType === 'club_affiliated' ? 'منتمي لعصبة / جمعية' : 'لا منتمي (مدرسي فقط)';

      return {
        'الرقم الترتيبي': index + 1,
        'الاسم الكامل': s.fullName,
        'رقم مسار (Massar)': s.massarNumber || '—',
        'الجنس': s.gender === 'Male' ? 'ذكر' : 'أنثى',
        'الفئة الرياضية': getCategoryLabel(s.category, s.gender),
        'تاريخ الازدياد': s.birthDate,
        'نوع المشاركة': roleLabel,
        'المسافة المقررة': s.distance || (s.sportId === 'cross_country' ? getCrossCountryDistance(s.category, s.gender) : '—'),
        'صفة الانتماء': affLabel,
        'المؤسسة التعليمية': s.schoolName || schoolName || '—',
        'الأستاذ المؤطر': s.coachName || userProfile?.fullName || '—',
        'رقم تأجير المؤطر': s.coachLeaseNumber || userProfile?.leaseNumber || '—',
        'هاتف المؤطر': s.coachPhone || userProfile?.phone || '—',
        'الموسم الدراسي': currentSeason
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    worksheet['!views'] = [{ RTL: true }];
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 24 },
      { wch: 16 },
      { wch: 8 },
      { wch: 18 },
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 20 },
      { wch: 26 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 14 }
    ];

    const workbook = XLSX.utils.book_new();
    const safeSheetName = title.replace(/[/\\?%*:|"<>]/g, '-').substring(0, 30);
    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);

    const cleanTitle = title.replace(/\s+/g, '_').replace(/[/\\?%*:|"<>]/g, '-');
    const cleanSchool = (schoolName || 'المؤسسة').replace(/\s+/g, '_').replace(/[/\\?%*:|"<>]/g, '-');
    const fileName = `لائحة_${cleanTitle}_${cleanSchool}_${currentSeason.replace(/[/\\?%*:|"<>]/g, '-')}.xlsx`;

    XLSX.writeFile(workbook, fileName);
    toast.success(`تم استخراج ${studentList.length} تلميذ(ة) إلى ملف Excel بنجاح! 📊`, { duration: 4000 });
  };

  const handleExportCurrentCategoryExcel = () => {
    if (!selectedCategoryKey) return;
    const parts = selectedCategoryKey.split('_');
    const catLabel = getCategoryLabel(parts[0], parts[1]);
    handleExportStudentsListToExcel(displayedSportStudents, `فئة_${catLabel}`);
  };

  const handleExportSportStudentsExcel = () => {
    const sportObj = sportsConfig.find(s => s.id === selectedSportId);
    const sportName = sportObj ? sportObj.name : 'الرياضة';
    handleExportStudentsListToExcel(activeSportStudents, `جميع_تلاميذ_${sportName}`);
  };

  // Active Sport Configuration
  const activeSportConfig = sportsConfig.find(s => s.id === selectedSportId);
  const activeSportCategories = useMemo(() => {
    const rawCats = (activeSportConfig?.ageCategories && activeSportConfig.ageCategories.length > 0)
      ? activeSportConfig.ageCategories
      : getAgeCategoriesForSeason(currentSeason).map(c => c.id);
    const normalized = rawCats.map(c => normalizeCategoryKey(c));
    return Array.from(new Set(normalized));
  }, [activeSportConfig, currentSeason]);

  // Real-time limit checking for rendering warning indicators
  const isGeneralLimitReached = (() => {
    if (activeSportConfig?.studentLimit && activeSportConfig.studentLimit > 0) {
      const activeCount = editingStudentId 
        ? activeSportStudents.filter(s => s.id !== editingStudentId).length
        : activeSportStudents.length;
      return activeCount >= activeSportConfig.studentLimit;
    }
    return false;
  })();

  const crossCountryLimitDetails = (() => {
    if (selectedSportId === 'cross_country') {
      const normalizedCat = normalizeCategoryKey(category);
      const studentAff = affiliationType || 'non_club';
      const sameGroupStudents = activeSportStudents.filter(
        s => s.id !== editingStudentId && 
             normalizeCategoryKey(s.category) === normalizedCat && 
             s.gender === gender && 
             (s.affiliationType || 'non_club') === studentAff &&
             s.participationType === participationType
      );
      const limitVal = participationType === 'individual' ? 3 : 5;
      return {
        count: sameGroupStudents.length,
        limitVal,
        isReached: sameGroupStudents.length >= limitVal
      };
    }
    return null;
  })();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[50vh]">
        <div className="h-7 w-7 animate-spin rounded-full border-3 border-blue-600 border-t-transparent mb-3"></div>
        <p className="text-xs text-slate-500 font-medium">جاري تحميل لوحة فرق المؤسسة...</p>
      </div>
    );
  }

  // Render sports cards distinguishing white (non-club) vs yellow (club-affiliated)
  const renderSportCard = (sport: Sport) => {
    const mapped = SPORTS_MAP[sport.id] || { name: sport.name, icon: '🏆' };
    const count = students.filter(s => s.sportId === sport.id).length;
    const hasConfiguredCategories = sport.ageCategories && sport.ageCategories.length > 0;
    const isProgrammed = isSportProgrammed(sport);

    const sportTourns = tournaments.filter(t => t.sportId === sport.id);
    const mainTourn = sportTourns.length > 0 ? sportTourns[0] : null;
    
    const hasClubTournaments = sportTourns.some(t => isClubTournament(t));
    const hasSchoolOnlyTournaments = sportTourns.some(t => !isClubTournament(t));
    const hasBothClasses = hasClubTournaments && hasSchoolOnlyTournaments;

    const sportStudents = students.filter(s => s.sportId === sport.id);
    const isClub = sportStudents.length > 0 
      ? sportStudents.some(s => s.affiliationType === 'club_affiliated')
      : (isClubTournament(mainTourn) && !hasBothClasses);

    return (
      <div
        key={sport.id}
        onClick={() => handleSelectSport(sport.id)}
        className={`rounded-2xl border p-5 transition-all cursor-pointer flex flex-col justify-between h-52 group relative overflow-hidden shadow-xs ${
          isClub && !hasBothClasses
            ? 'bg-amber-50/90 border-amber-300 hover:border-amber-500 hover:shadow-md'
            : 'bg-white border-slate-200/90 hover:border-blue-400 hover:shadow-md'
        }`}
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8 group-hover:scale-125 transition-transform" />
        
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-1 flex-wrap">
            <span className="text-3xl block">{mapped.icon}</span>
            <div className="flex items-center gap-1">
              {hasBothClasses ? (
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 shadow-3xs">
                    🟡 للمنتمين للأندية
                  </span>
                  <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 shadow-3xs">
                    ⚪ لا منتمين
                  </span>
                </div>
              ) : isClub ? (
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 border border-amber-400 shadow-3xs">
                  🟡 للمنتمين للأندية
                </span>
              ) : (
                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-300 shadow-3xs">
                  ⚪ لا منتمين (العموميون)
                </span>
              )}
              {isProgrammed && (
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  ✅ مبرمجة
                </span>
              )}
            </div>
          </div>
          
          <h4 className="text-xs md:text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
            {mapped.name}
          </h4>
          <p className="text-[10px] text-slate-500 font-medium line-clamp-1">
            {(() => {
              const sportStudents = students.filter(s => s.sportId === sport.id);
              const uniqueParticipatingCats = Array.from(new Set(sportStudents.map(s => s.category).filter(Boolean))) as string[];
              if (uniqueParticipatingCats.length > 0) {
                return `الفئات المشارك فيها: ${uniqueParticipatingCats.map(c => getCategoryGenderLabel(c, undefined, currentSeason, sport.id)).join(' - ')}`;
              }
              return hasConfiguredCategories
                ? `الفئات المتاحة: ${sport.ageCategories?.map(c => getCategoryGenderLabel(c, undefined, currentSeason, sport.id)).join(' - ')}`
                : 'لم يتم تفعيل أي فئة';
            })()}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-bold">المسجلون بالفريق:</span>
          <span className={`font-bold px-2 py-0.5 rounded border ${
            count > 0 ? 'text-blue-700 bg-blue-50 border-blue-200' : 'text-slate-400 bg-slate-50 border-slate-200'
          }`}>
            {count} تلاميذ
          </span>
        </div>
      </div>
    );
  };

  if (isProfileIncomplete) {
    return (
      <div className="max-w-xl mx-auto mt-8 bg-white p-6 md:p-8 rounded-2xl border border-slate-200/80 shadow-md text-center space-y-4" dir="rtl">
        <div className="w-14 h-14 bg-amber-50 text-amber-600 border border-amber-100 rounded-full flex items-center justify-center mx-auto text-2xl font-black">
          ⚠️
        </div>
        <div>
          <h3 className="text-base font-extrabold text-slate-800">يرجى استكمال معلوماتكم الشخصية أولاً</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">
            قبل البدء في تسجيل وتشكيل فرق مؤسستكم ودخول التخصصات الرياضية، يتطلب منكم النظام ملء البيانات الضرورية في ملفكم الشخصي (مقر العمل ورقم التأجير).
          </p>
        </div>
        <button
          onClick={openProfileModal}
          className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-3 rounded-xl shadow-xs transition-all cursor-pointer"
        >
          <span>استكمال بيانات الأستاذ الآن</span>
          <ArrowRight className="h-4 w-4 rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base md:text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              <span>فضاء تسجيل الفرق والتلاميذ (المؤطرون والتلاميذ)</span>
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-0.5 rounded border border-emerald-200">
              {schoolName}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            مرحباً بك يا أستاذ (مؤطر المؤسسة). يتم التسجيل القبلي لمؤطري المؤسسات بالمنصة، ويمكنك هنا تسجيل وتشكيل لائحة فرق وتلاميذ مؤسستك في البطولات الإقليمية المبرمجة.
          </p>
        </div>
        <button
          onClick={loadInitialData}
          className="self-start md:self-auto flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer transition-all bg-white"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>تحديث المعطيات</span>
        </button>
      </div>

      {/* Main Layout Screen */}
      {!selectedSportId ? (
        // Mode 1: Selection of Programmed Sports Only
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-emerald-600" />
                <span>الرياضات المبرمجة المتاحة لتسجيل الفرق والتلاميذ</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                تُعرض هنا حصرياً الرياضات التي قام المسير المركزي ورؤساء اللجن التقنية ببرمجة بطولاتها الإقليمية رسمياً.
              </p>
            </div>
            <span className="self-start sm:self-auto text-[10px] bg-emerald-50 text-emerald-800 font-bold px-3 py-1 rounded-full border border-emerald-200 shrink-0">
              {programmedSports.length} رياضات مبرمجة
            </span>
          </div>

          {programmedSports.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {programmedSports.map(renderSportCard)}
            </div>
          ) : (
            <div className="p-10 text-center bg-white rounded-2xl border border-slate-200/80 space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mx-auto text-amber-600 text-xl font-bold">
                ⏳
              </div>
              <h4 className="text-sm font-bold text-slate-800">لا توجد بطولات أو رياضات مبرمجة حالياً</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                لم يتم إدراج أي رياضة أو بطولة إقليمية جديدة بعد من طرف المسير المركزي واللجن التقنية. سيتم فتح باب تسجيل الفرق والتلاميذ فور إدراج البطولات بالمنصة.
              </p>
            </div>
          )}
        </div>
      ) : (
        // Mode 2: Sport Workspace
        <div className="space-y-5">
          {/* Back button and sport header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-4 md:p-5 rounded-2xl shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedSportId(null)}
                className="p-2 hover:bg-slate-800 rounded-xl transition-all border border-slate-700 shrink-0"
                title="رجوع"
              >
                <ArrowRight className="h-4 w-4" />
              </button>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getSportIcon(selectedSportId)}</span>
                  <h3 className="text-base font-bold">فريق {getSportName(selectedSportId)}</h3>
                </div>
                <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                  تأطير وإدخال لوائح التلاميذ الخاصة بـ <span className="font-bold text-blue-400">{schoolName}</span> للمشاركة في منافسات هذه الرياضة.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700 font-bold">
                إجمالي التلاميذ: {activeSportStudents.length}
              </span>
              <button
                type="button"
                onClick={handleExportSportStudentsExcel}
                disabled={activeSportStudents.length === 0}
                title={activeSportStudents.length === 0 ? 'يرجى تسجيل تلاميذ أولاً لتصديرهم' : 'تصدير لائحة المشاركين إلى ملف Excel'}
                className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>استخراج اللائحة Excel 📊</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                disabled={activeSportStudents.length === 0}
                title={activeSportStudents.length === 0 ? 'يرجى تسجيل تلاميذ أولاً لعرض المطبوع' : 'معاينة وعرض لائحة المشاركة الرسمية للطباعة والتحميل'}
                className="bg-sky-700 hover:bg-sky-600 text-white font-bold text-xs px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <FileText className="h-4 w-4" />
                <span>عرض لائحة المشاركة</span>
              </button>
              {selectedSportId === 'cross_country' ? (
                <button
                  type="button"
                  onClick={() => handleOpenCrossCountryBulk(selectedCategoryKey)}
                  disabled={!activeSportCategories || activeSportCategories.length === 0 || !activeSportConfig || !isSportProgrammed(activeSportConfig)}
                  title="تسجيل 8 مشاركين في آن واحد (3 فردي + 5 فريق المؤسسة)"
                  className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-102 active:scale-98"
                >
                  <Sparkles className="h-4 w-4 text-slate-950" />
                  <span>تسجيل 8 مشاركين (3 فردي + 5 فريق) ⚡</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSportBulkOpen(true)}
                  disabled={!activeSportCategories || activeSportCategories.length === 0 || !activeSportConfig || !isSportProgrammed(activeSportConfig)}
                  title="تسجيل عدة مشاركين دفعة واحدة لتوفير الوقت"
                  className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:scale-102 active:scale-98"
                >
                  <Sparkles className="h-4 w-4 text-slate-950" />
                  <span>تسجيل جماعي دفعة واحدة ⚡</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleOpenNewStudentForm()}
                disabled={!activeSportCategories || activeSportCategories.length === 0 || !activeSportConfig || !isSportProgrammed(activeSportConfig)}
                title={activeSportConfig && !isSportProgrammed(activeSportConfig) ? 'هذه البطولة في طور الإعداد وغير مفتوحة للتسجيل' : 'إضافة تلميذ جديد'}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة تلميذ جديد</span>
              </button>
            </div>
          </div>

          {/* Alert if sport is in draft / not programmed */}
          {activeSportConfig && !isSportProgrammed(activeSportConfig) && (
            <div className="p-4 bg-amber-50 border border-amber-200/90 rounded-2xl flex items-start gap-3 text-amber-950 text-xs leading-relaxed shadow-3xs">
              <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <p className="font-extrabold text-sm text-amber-950">⚠️ البطولة في طور الإعداد والتجهيز حالياً لـ ({getSportName(selectedSportId)})!</p>
                <p className="mt-1 text-amber-900 font-medium">
                  هذه الرياضة في مرحلة الإعداد ولم تُفعل للتسجيل بعد من طرف المسير المركزي أو رئيس اللجنة التقنية المكلّف. ستتمكن من تسجيل وتأطير لائحة فرق مؤسستك فور تفعيل وضعية البرمجة (🟢) لهذه الرياضة.
                </p>
              </div>
            </div>
          )}

          {/* Status Banners: Open (🟢), Ongoing (🔵), Completed (🏆) */}
          {activeSportConfig && isSportProgrammed(activeSportConfig) && (() => {
            const activeTourn = getSportTournament(selectedSportId);
            const statusVal = activeTourn?.status || 'Scheduled';

            if (statusVal === 'Ongoing') {
              return (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-start gap-3 text-blue-950 text-xs leading-relaxed shadow-3xs">
                  <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-sm text-blue-950">🔵 بطولة جارية حالياً (In Progress)</p>
                    <p className="mt-1 text-blue-900 font-medium">
                      تُعرض هذه البطولة لجميع الأطر والأساتذة لمتابعة المنافسات والبرمجة.
                      {isTeacher
                        ? ' تم إقفال باب الإضافة والعدل النهائي أمام الأساتذة، ويُتاح التعديل الاستثنائي فقط للمسؤول الإقليمي أو المركزي.'
                        : ' بصفتك مسؤولاً إقليمياً أو مركزياً، يُمكِنُك الاستمرار في استكمال وتعديل اللوائح للأساتذة.'}
                    </p>
                  </div>
                </div>
              );
            } else if (statusVal === 'Completed' || statusVal === 'Archived') {
              return (
                <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl flex items-start gap-3 text-amber-950 text-xs leading-relaxed shadow-3xs">
                  <Trophy className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-extrabold text-sm text-amber-950">🏆 بطولة منتهية ومؤرشفة للنتائج (Completed)</p>
                    <p className="mt-1 text-amber-900 font-medium">
                      هذه البطولة منتهية ومؤرشفة نهائياً لعرض نتائج المباريات والتتويجات، وتم إغلاق التسجيل نهائياً لجميع المستخدمين.
                    </p>
                  </div>
                </div>
              );
            } else {
              return (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3 text-emerald-950 text-xs shadow-3xs">
                  <span className="text-base">🟢</span>
                  <p className="font-bold text-emerald-900 text-xs">
                    مفتوحة للتسجيل: تظهر لجميع الأطر والأساتذة ومفتوحة لتسجيل المؤسسات واللوائح حتى انتهاء الأجل.
                  </p>
                </div>
              );
            }
          })()}

          {/* Alert if sport categories aren't configured yet */}
          {(!activeSportCategories || activeSportCategories.length === 0) && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl flex gap-3 text-red-800 text-xs leading-relaxed max-w-2xl">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>
                <p className="font-bold">تنبيه: لا توجد فئات مفعلة حالياً لهذه الرياضة!</p>
                <p className="mt-0.5 opacity-90">
                  لم يقم المسؤول الرئيسي للمديرية بتفعيل وتعيين فئات عمرية محددة لتخصص {getSportName(selectedSportId)} بعد. يرجى الاتصال بالمسير المركزي لتخصيص الفئات حتى تتمكن من إدخال لوائح التلاميذ.
                </p>
              </div>
            </div>
          )}

          {/* Register Student Form (as inline card when open) */}
          {isFormOpen && (
            <div
              ref={formCardRef}
              id="student-edit-form-card"
              className={`bg-white rounded-2xl p-5 md:p-6 shadow-sm max-w-2xl transition-all ${
                editingStudentId
                  ? 'border-2 border-blue-600 ring-4 ring-blue-500/20 shadow-xl'
                  : 'border border-slate-200'
              }`}
            >
              {editingStudentId && (
                <div className="mb-4 p-3.5 bg-gradient-to-r from-blue-700 to-indigo-800 text-white rounded-xl shadow-xs flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                      <Edit className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black">جاري تعديل بيانات التلميذ: {fullName}</h4>
                      <p className="text-[10.5px] text-blue-100">
                        الفئة، الجنس، والصنف مقفلة وفق شروط البطولة (البراعم - ذكور - لا منتمي). يمكنك تعديل الاسم، الصورة، وباقي المعطيات أدناه.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFormOpen(false);
                      setEditingStudentId(null);
                    }}
                    className="px-2.5 py-1 bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    إلغاء التعديل
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <h4 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-2">
                  {editingStudentId ? <Edit className="h-4 w-4 text-blue-600" /> : <UserPlus className="h-4 w-4 text-blue-600" />}
                  <span>{editingStudentId ? `تعديل بيانات: ${fullName}` : 'تسجيل تلميذ جديد في الفريق'}</span>
                </h4>
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingStudentId(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>

              <form onSubmit={handleAddStudent} className="space-y-4">
                {/* Active Edit Mode Banner */}
                {editingStudentId && (
                  <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-3 shadow-xs animate-in fade-in">
                    <div className="flex items-center gap-2.5 text-xs text-blue-950 font-bold">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-3xs">
                        <Edit className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-blue-900 font-black">وضع تعديل بيانات المشارك(ة)</p>
                        <p className="text-[11px] text-blue-700 font-medium">
                          جاري مراجعة وتعديل بيانات: <strong className="text-blue-950 underline">{fullName}</strong>
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingStudentId(null);
                        setFullName('');
                        setMassarNumber('');
                        setBirthDate('');
                        setPhoto('');
                        setAthleticsSpecialty('');
                        toast('تم إلغاء وضع التعديل', { icon: '↩️' });
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold rounded-xl border border-slate-200 transition-colors shadow-3xs cursor-pointer shrink-0"
                    >
                      إلغاء التعديل
                    </button>
                  </div>
                )}
                {/* Dynamic limit warning alert */}
                {isGeneralLimitReached && (
                  <div className="p-4 bg-red-50 border border-red-200 text-red-950 rounded-xl flex gap-3 text-xs leading-relaxed animate-pulse">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                    <div>
                      <p className="font-bold">تنبيه بالوصول للحد الأقصى للتسجيل!</p>
                      <p className="mt-0.5 opacity-90 font-medium">
                        لقد تم بلوغ الحد الأقصى المسموح به للتسجيل في هذا التخصص وهو <span className="font-bold underline">{activeSportConfig?.studentLimit}</span> تلاميذ. لا يمكن تسجيل تلاميذ إضافيين حتى تقوم بحذف أو تعديل أحد المشاركين الحاليين.
                      </p>
                    </div>
                  </div>
                )}

                {selectedSportId === 'cross_country' && crossCountryLimitDetails?.isReached && (
                  <div className="p-4 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl flex gap-3 text-xs leading-relaxed animate-pulse">
                    <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-bold">تنبيه بالوصول للحد الأقصى للفئة المحددة!</p>
                      <p className="mt-0.5 opacity-90 font-medium">
                        لقد تم بلوغ الحد الأقصى للتسجيل لهذه الفئة والجنس ونوع المشاركة وهو <span className="font-bold underline">{crossCountryLimitDetails.limitVal}</span> تلاميذ. لا يمكن إضافة تلميذ آخر في هذه الفئة ({getCategoryLabel(category)} - {gender === 'Male' ? 'ذكر' : 'أنثى'} - {participationType === 'individual' ? 'مشاركة فردية' : 'مشاركة فريق'}) حتى يتم تعديل أو حذف مشارك حالي.
                      </p>
                    </div>
                  </div>
                )}

                {/* Automatic Tournament Constraints Banner */}
                {(lockedCategory || lockedGender || lockedAffiliation) && (
                  <div className="p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-2xl flex items-center justify-between gap-2 shadow-3xs">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-950">
                      <span className="text-base">🔒</span>
                      <span>
                        محدد ومقفل تلقائياً وفق شروط فرع البطولة المفتوح:{' '}
                        <strong className="text-blue-700">
                          {lockedGender ? (gender === 'Male' ? 'ذكور 👦' : 'إناث 👧') : ''}
                          {lockedGender && lockedCategory ? ' • ' : ''}
                          {lockedCategory ? `فئة ${getCategoryLabel(category, gender)} 🏅` : ''}
                          {(lockedGender || lockedCategory) && lockedAffiliation ? ' • ' : ''}
                          {lockedAffiliation ? (affiliationType === 'club_affiliated' ? 'منتمين للأندية 🟡' : 'لا منتمين (مدرسي فقط) ⚪') : ''}
                        </strong>
                      </span>
                    </div>
                    <span className="text-[10px] font-black bg-blue-600 text-white px-2.5 py-0.5 rounded-full shrink-0">
                      التزام إجباري
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* School Selection: Locked for teachers to their registered institution */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-blue-600" />
                        <span>المؤسسة التعليمية *</span>
                      </span>
                      {isTeacher ? (
                        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          مؤسستك المعتمدة فقط
                        </span>
                      ) : (
                        <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                          اختيار من المؤسسات المعتمدة بالإقليم
                        </span>
                      )}
                    </label>
                    {isTeacher ? (
                      <div className="w-full text-xs px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-emerald-600" />
                          <span className="font-bold text-slate-800">{userProfile?.workLocation || schoolName}</span>
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-bold">مؤسستك المسجلة</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">مغلق (حصراً لمؤسستك)</span>
                      </div>
                    ) : (
                      <select
                        required
                        className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold text-slate-700"
                        value={selectedSchoolId}
                        onChange={(e) => setSelectedSchoolId(e.target.value)}
                      >
                        <option value="">-- اختر المؤسسة التعليمية للتلميذ --</option>
                        {schools.map((sch) => (
                          <option key={sch.id} value={sch.id}>
                            {sch.name} ({sch.type === 'تأهيلي' ? 'ثانوي تأهيلي' : sch.type === 'إعدادي' ? 'ثانوي إعدادي' : 'ابتدائي'} - {sch.commune})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Name and Surname */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      الاسم الكامل للتلميذ(ة) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: عمر البقالي"
                      className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>

                  {/* Massar Number */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        رقم مسار (Code Massar) *
                      </label>
                      <span className="text-[10px] text-blue-600 font-extrabold">
                        إجباري: حرف + 9 أرقام (مثال: F212121212)
                      </span>
                    </div>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      placeholder="مثال: F212121212"
                      className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono uppercase font-bold"
                      value={massarNumber}
                      onChange={(e) => setMassarNumber(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
                      <span>الجنس *</span>
                      {lockedGender ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>مقفل وفق شروط البطولة ({gender === 'Male' ? 'ذكور' : 'إناث'})</span>
                        </span>
                      ) : (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                          gender === 'Male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'
                        }`}>
                          {gender === 'Male' ? '👦 فئات الذكور (البراعم / الصغار / الفتيان / الشبان)' : '👧 فئات الإناث (البرعمات / الصغيرات / الفتيات / الشابات)'}
                        </span>
                      )}
                    </label>
                    {lockedGender ? (
                      <div className="w-full text-xs px-3.5 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-slate-800 font-bold flex items-center justify-between cursor-not-allowed">
                        <span className="flex items-center gap-2">
                          <span>{gender === 'Male' ? '👦' : '👧'}</span>
                          <span>{gender === 'Male' ? 'ذكر (فئات الذكور)' : 'أنثى (فئات الإناث)'}</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                          <Lock className="w-3 h-3" /> مقفل
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setGender('Male')}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            gender === 'Male'
                              ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-3xs ring-1 ring-blue-400'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <span>👦</span>
                          <span>ذكر (فئات الذكور)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setGender('Female')}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                            gender === 'Female'
                              ? 'bg-pink-50 border-pink-500 text-pink-700 shadow-3xs ring-1 ring-pink-400'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <span>👧</span>
                          <span>أنثى (فئات الإناث)</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        تاريخ الازدياد *
                      </label>
                      <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {lockedCategory ? 'مطابق لشروط الفئة المفتوحة' : 'إحالة تلقائية للفئة'}
                      </span>
                    </div>
                    <input
                      type="date"
                      required
                      className={`w-full text-xs px-3 py-2.5 bg-slate-50 border rounded-xl focus:bg-white focus:ring-2 transition-all font-mono ${
                        birthDate && !birthDateValidation.isValid
                          ? 'border-red-400 ring-2 ring-red-200 focus:ring-red-500 bg-red-50/40 text-red-900'
                          : 'border-slate-200 focus:ring-blue-500 focus:border-blue-500'
                      }`}
                      value={birthDate}
                      onChange={(e) => handleBirthDateChange(e.target.value)}
                    />
                    {birthDate && !birthDateValidation.isValid && (
                      <div className="mt-2 p-2.5 rounded-xl border border-red-200 bg-red-50 text-red-800 flex items-start gap-2 text-[11px] font-bold animate-in fade-in slide-in-from-top-1 duration-150">
                        <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-red-900 font-black">{birthDateValidation.errorMessage}</p>
                          <p className="text-red-700 text-[10px] font-semibold mt-0.5">
                            ⚠️ يرجى تصحيح تاريخ الازدياد ليتوافق مع السن المعتمد لفئة {getCategoryLabel(category, gender)}.
                          </p>
                        </div>
                      </div>
                    )}
                    {birthDate && birthDateValidation.isValid && category && (
                      <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg border ${
                        gender === 'Male'
                          ? 'text-blue-800 bg-blue-50/90 border-blue-200'
                          : 'text-pink-800 bg-pink-50/90 border-pink-200'
                      }`}>
                        <span className={gender === 'Male' ? 'text-blue-600' : 'text-pink-600'}>✓</span>
                        <span>
                          {lockedCategory ? 'فئة التلميذ(ة) المقفلة بالبطولة:' : (gender === 'Male' ? 'تمت إحالة التلميذ مباشرة إلى فئة:' : 'تمت إحالة التلميذة مباشرة إلى فئة:')}{' '}
                          <strong className="underline">{getCategoryLabel(category, gender)}</strong>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Category Selection */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        الفئة الرياضية المعنية ({gender === 'Male' ? 'فئات الذكور فقط' : 'فئات الإناث فقط'}) *
                      </label>
                      {lockedCategory ? (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>مقفل وفق شروط البطولة ({getCategoryLabel(category, gender)})</span>
                        </span>
                      ) : (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                          gender === 'Male' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-pink-50 text-pink-700 border-pink-200'
                        }`}>
                          {gender === 'Male' ? 'فئات الذكور' : 'فئات الإناث'}
                        </span>
                      )}
                    </div>
                    {lockedCategory ? (
                      <div className="w-full text-xs px-3.5 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-slate-800 font-bold flex items-center justify-between cursor-not-allowed">
                        <span className="font-extrabold text-blue-900">{getCategoryLabel(category, gender)}</span>
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                          <Lock className="w-3 h-3" /> مقفل
                        </span>
                      </div>
                    ) : (
                      <select
                        required
                        className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold text-slate-700"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {activeSportCategories.map((catId) => (
                          <option key={catId} value={catId}>
                            {getCategoryLabel(catId, gender)}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Athletics Specialty Selection */}
                  {selectedSportId === 'athletics' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        تخصص ألعاب القوى المعني *
                      </label>
                      <select
                        required
                        className="w-full text-xs px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-semibold text-slate-700"
                        value={athleticsSpecialty}
                        onChange={(e) => setAthleticsSpecialty(e.target.value)}
                      >
                        <option value="">-- اختر التخصص --</option>
                        {(activeSportConfig?.athleticsSpecialties || ['القفز الطولي العلوي', 'القفز الطولي', 'جري 80 متر']).map((spec) => (
                          <option key={spec} value={spec}>
                            {spec}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedSportId === 'cross_country' && (
                    <>
                      {/* Participation Type (Cross Country) */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          نوع المشاركة في العدو الريفي *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => setParticipationType('individual')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              participationType === 'individual'
                                ? 'bg-amber-50 border-amber-500 text-amber-700 shadow-3xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <span>🏃</span>
                            <span>مشاركة فردية (الحد: 3)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setParticipationType('school_team')}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              participationType === 'school_team'
                                ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-3xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-white'
                            }`}
                          >
                            <span>👥</span>
                            <span>فريق المؤسسة (الحد: 5)</span>
                          </button>
                        </div>
                      </div>

                      {/* Calculated Distance display */}
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5">
                          المسافة المحددة بالفئة والجنس
                        </label>
                        <div className="w-full text-xs px-3 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 font-extrabold flex items-center gap-2">
                          <span>📈</span>
                          <span>المسافة المقررة للتلميذ(ة): {getCrossCountryDistance(category, gender)}</span>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Affiliation Type: non_club vs club_affiliated */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        صفة الانتماء الرياضي للتلميذ(ة) *
                      </label>
                      {lockedAffiliation && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded border bg-slate-100 text-slate-700 border-slate-300 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>مقفل وفق معايير البطولة ({affiliationType === 'club_affiliated' ? 'منتمي لنادي' : 'لا منتمي فقط'})</span>
                        </span>
                      )}
                    </div>
                    {lockedAffiliation ? (
                      <div className="w-full text-xs px-3.5 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-slate-800 font-bold flex items-center justify-between cursor-not-allowed">
                        <span className="flex items-center gap-2">
                          <span>{affiliationType === 'club_affiliated' ? '🟡' : '⚪'}</span>
                          <span>
                            {affiliationType === 'club_affiliated'
                              ? 'منتمي لنادي / عصبة رياضية معتمدة'
                              : 'لا منتمي (مدرسي فقط - غير منخرط بالجامعات)'}
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-slate-200">
                          <Lock className="w-3 h-3" /> مقفل
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setAffiliationType('non_club')}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            affiliationType === 'non_club'
                              ? 'bg-slate-900 text-white border-slate-900 shadow-3xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                          }`}
                        >
                          <span>⚪</span>
                          <span>لا منتمي (مدرسي فقط)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setAffiliationType('club_affiliated')}
                          className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                            affiliationType === 'club_affiliated'
                              ? 'bg-amber-400 text-amber-950 font-extrabold border-amber-500 shadow-3xs ring-2 ring-amber-300'
                              : 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                          }`}
                        >
                          <span>🟡</span>
                          <span>منتمي لنادي / عصبة</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Photo Upload */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      صورة التلميذ (اختياري)
                    </label>
                    <div className="flex flex-col sm:flex-row items-center gap-4 p-4 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                      <div className="w-16 h-16 rounded-full border bg-white flex items-center justify-center overflow-hidden shrink-0 shadow-3xs">
                        {photo ? (
                          <img src={photo} alt="Preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      
                      <div className="flex-1 text-center sm:text-right space-y-1">
                        <p className="text-[11px] font-bold text-slate-700">التقاط صورة مباشرة أو رفع ملف صورة التلميذ</p>
                        <p className="text-[10px] text-slate-400">سيتم ضغط وتصغير حجم الصورة تلقائياً للحفاظ على مساحة التخزين وسرعة التصفح</p>
                        
                        <div className="pt-2 flex flex-wrap gap-2 justify-center sm:justify-start">
                          <label className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all shadow-3xs cursor-pointer">
                            <Upload className="h-3.5 w-3.5 text-white/80" />
                            <span>التقاط بالكاميرا 📸</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={handlePhotoUpload}
                            />
                          </label>

                          <label className="inline-flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-lg text-[10px] font-extrabold text-slate-600 transition-colors shadow-3xs cursor-pointer">
                            <Upload className="h-3.5 w-3.5 text-slate-400" />
                            <span>اختر صورة من الجهاز</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handlePhotoUpload}
                            />
                          </label>

                          {photo && (
                            <button
                              type="button"
                              onClick={() => setPhoto('')}
                              className="text-[10px] text-red-500 hover:text-red-700 hover:underline font-bold self-center px-1"
                            >
                              إلغاء الصورة
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>


                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    className="px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={uploading}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                  >
                    <UserPlus className="h-4 w-4" />
                    <span>{uploading ? 'جاري رفع الملف...' : (editingStudentId ? 'تعديل وحفظ بيانات التلميذ' : 'حفظ وتسجيل التلميذ')}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Category Coaches Management Section */}
          {selectedSportId && activeSportCategories && activeSportCategories.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span>👨‍🏫</span>
                    <span>الأساتذة المؤطرون حسب فئات وصنوف الفريق</span>
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    انقر على بطاقة الفئة أدناه للدخول إليها وتصفح تلاميذها. قم بتعيين الأستاذ المؤطر لكل فئة لتطبيق بياناته تلقائياً بمطبوع المشاركة.
                  </p>
                </div>

                {/* Active Categories Indicator */}
                {activeSportStudents.length > 0 && (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 shrink-0 select-none">
                    ⭐ الفئات المشارك فيها فقط ({
                      Array.from(new Set(activeSportStudents.map(s => `${s.category}_${s.gender}`))).length
                    })
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(() => {
                  const allItems: { catId: string; gender: 'Male' | 'Female'; affiliationType?: string; label: string }[] = [];
                  
                  activeSportCategories.forEach(catId => {
                    if (selectedSportId === 'cross_country') {
                      allItems.push({ catId, gender: 'Male', affiliationType: 'non_club', label: `${getCategoryLabel(catId, 'Male')} (اللامنتمين)` });
                      allItems.push({ catId, gender: 'Male', affiliationType: 'club_affiliated', label: `${getCategoryLabel(catId, 'Male')} (المنتمين)` });
                      allItems.push({ catId, gender: 'Female', affiliationType: 'non_club', label: `${getCategoryLabel(catId, 'Female')} (اللامنتميات)` });
                      allItems.push({ catId, gender: 'Female', affiliationType: 'club_affiliated', label: `${getCategoryLabel(catId, 'Female')} (المنتميات)` });
                    } else {
                      allItems.push({ catId, gender: 'Male', label: getCategoryLabel(catId, 'Male') });
                      allItems.push({ catId, gender: 'Female', label: getCategoryLabel(catId, 'Female') });
                    }
                  });
                  
                  const sportTourns = tournaments.filter(t => t.sportId === selectedSportId);

                  const filteredItems = allItems.filter(item => {
                    const { catId, gender: g, affiliationType: aff } = item;
                    
                    // 1. If students are already registered in this category/gender/affiliation, keep it so teacher can view/manage
                    const hasStudents = activeSportStudents.some(s => 
                      normalizeCategoryKey(s.category) === catId && 
                      s.gender === g && 
                      (!aff || s.affiliationType === aff)
                    );
                    if (hasStudents) return true;

                    // 2. If no active tournaments are programmed for this sport, show all categories by default
                    if (sportTourns.length === 0) return true;

                    // 3. Otherwise, strictly keep items that match at least one active programmed tournament
                    return sportTourns.some(t => {
                      // Gender check
                      const genderMatch = t.gender === 'Mixed' || t.gender === g;
                      if (!genderMatch) return false;

                      // Category check
                      const tCatKey = normalizeCategoryKey(t.ageCategory);
                      const categoryMatch = !tCatKey || tCatKey === 'OPEN' || tCatKey === catId || (
                        t.ageCategory && (
                          t.ageCategory.includes(catId) ||
                          (catId === 'U12' && (t.ageCategory.includes('البراعم') || t.ageCategory.includes('البرعمات'))) ||
                          (catId === 'U15' && (t.ageCategory.includes('الصغار') || t.ageCategory.includes('الصغيرات'))) ||
                          (catId === 'U18' && (t.ageCategory.includes('الفتيان') || t.ageCategory.includes('الفتيات'))) ||
                          (catId === 'U20' && (t.ageCategory.includes('الشبان') || t.ageCategory.includes('الشابات')))
                        )
                      );
                      if (!categoryMatch) return false;

                      // Affiliation check
                      if (aff) {
                        const tAff = t.affiliationType || (isClubTournament(t) ? 'club_affiliated' : 'non_club');
                        if (tAff !== 'open' && tAff !== aff) return false;
                      }

                      return true;
                    });
                  });

                  return filteredItems.length > 0 ? filteredItems : allItems;
                })().map((item) => {
                  const { catId, gender: g, label, affiliationType: aff } = item;
                  const key = aff ? `${catId}_${g}_${aff}` : `${catId}_${g}`;
                  const currentCoach = effectiveCoaches[key] || {
                    coachName: userProfile?.fullName || '',
                    coachLeaseNumber: userProfile?.leaseNumber || '',
                    coachPhone: userProfile?.phone || ''
                  };
                  const matchingStudents = activeSportStudents.filter(s => 
                    normalizeCategoryKey(s.category) === catId && 
                    s.gender === g &&
                    (!aff || s.affiliationType === aff)
                  );
                  const isEditing = editingCoachKey === key;
                  const isSelected = selectedCategoryKey === key;
                  const isCategoryClub = aff === 'club_affiliated' || (!aff && matchingStudents.some(s => s.affiliationType === 'club_affiliated'));

                  const cardStyle = isCategoryClub
                    ? `${isSelected ? 'bg-amber-100/90 border-amber-500 ring-2 ring-amber-400 shadow-md scale-[1.01]' : 'bg-amber-50 border-amber-300 hover:bg-amber-100/40 hover:border-amber-400 hover:shadow-sm shadow-3xs'}`
                    : `${isSelected ? 'bg-slate-50 border-blue-500 ring-2 ring-blue-300 shadow-md scale-[1.01]' : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:shadow-sm shadow-3xs'}`;

                  return (
                    <div 
                      key={key} 
                      onClick={() => setSelectedCategoryKey(isSelected ? null : key)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer space-y-3 ${cardStyle}`}
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-black text-slate-800 flex items-center gap-1.5 font-bold">
                          <span className={`w-2.5 h-2.5 rounded-full ${isCategoryClub ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'}`} />
                          {label}
                          {matchingStudents.length > 0 && (
                            <span className="text-[10px] text-slate-500 font-mono font-normal">
                              ({matchingStudents.length} مشارك)
                            </span>
                          )}
                        </span>
                        
                        <div className="flex items-center gap-1.5">
                          {isSelected && (
                            <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-blue-600 text-white shadow-3xs">
                              🟢 معروضة حالياً
                            </span>
                          )}
                          {!isSelected && matchingStudents.length > 0 && (
                            <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                              انقر للعرض 📂
                            </span>
                          )}

                          {matchingStudents.length > 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportStudentsListToExcel(matchingStudents, `فئة_${label}`);
                              }}
                              className="text-[10px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 cursor-pointer transition-colors shadow-3xs"
                              title="تصدير هذه الفئة إلى ملف Excel"
                            >
                              <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                              <span>Excel</span>
                            </button>
                          )}

                          {matchingStudents.length > 0 && (
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!window.confirm(`هل أنت متأكد من حذف فئة "${label}" بالكامل وجميع المشاركين المسجلين بها (${matchingStudents.length} مشارك)؟`)) return;
                                const toastId = toast.loading(`جاري حذف فئة ${label}...`);
                                try {
                                  for (const s of matchingStudents) {
                                    await DataService.deleteStudent(s.id);
                                  }
                                  setStudents(prev => prev.filter(s => {
                                    const match = s.sportId === selectedSportId && normalizeCategoryKey(s.category) === catId && s.gender === g;
                                    if (match && aff) {
                                      return s.affiliationType !== aff;
                                    }
                                    return !match;
                                  }));
                                  setPredefinedCoaches(prev => {
                                    const next = { ...prev };
                                    delete next[key];
                                    return next;
                                  });
                                  if (selectedCategoryKey === key) {
                                    setSelectedCategoryKey(null);
                                  }
                                  toast.dismiss(toastId);
                                  toast.success(`تم حذف فئة ${label} بنجاح`);
                                } catch (err) {
                                  toast.dismiss(toastId);
                                  toast.error('حدث خطأ أثناء حذف الفئة');
                                }
                              }}
                              className="text-[10px] text-red-600 hover:text-red-800 font-extrabold flex items-center gap-1 px-2 py-1 rounded bg-red-50 border border-red-200 cursor-pointer"
                              title="حذف هذه الفئة ومشاركيها"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>حذف</span>
                            </button>
                          )}

                          {!isEditing && (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCoachKey(key);
                                  setTempCoachName(currentCoach.coachName);
                                  setTempCoachLease(currentCoach.coachLeaseNumber);
                                  setTempCoachPhone(currentCoach.coachPhone);
                                }}
                                className="text-[10px] text-blue-600 hover:text-blue-800 font-extrabold flex items-center gap-1 px-2 py-1 rounded bg-blue-50 border border-blue-100 cursor-pointer transition-colors shadow-3xs"
                              >
                                <span>تعديل المؤطر</span>
                              </button>
                              {selectedSportId === 'cross_country' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenCrossCountryBulk(`${catId}_${g}`, aff as any);
                                  }}
                                  className="text-[10px] text-amber-900 hover:text-amber-950 font-black flex items-center gap-1 px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 border border-amber-300 cursor-pointer transition-colors shadow-3xs"
                                  title="تسجيل 8 مشاركين في هذه الفئة (3 فردي + 5 فريق المؤسسة)"
                                >
                                  <Sparkles className="w-3 h-3 text-amber-700" />
                                  <span>تسجيل 8 ⚡</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const defaultAff = aff || (isCategoryClub ? 'club_affiliated' : 'non_club');
                                  handleOpenNewStudentForm(catId, g, defaultAff as any);
                                }}
                                className="text-[10px] text-green-700 hover:text-green-900 font-extrabold flex items-center gap-1 px-2 py-1 rounded bg-green-50 border border-green-200 cursor-pointer transition-colors shadow-3xs"
                              >
                                <span>إضافة مشارك</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1" onClick={(e) => e.stopPropagation()}>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 mb-1">الاسم الكامل *</label>
                              <input
                                type="text"
                                className="w-full text-[11px] px-2.5 py-1.5 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                                value={tempCoachName}
                                onChange={(e) => setTempCoachName(e.target.value)}
                                placeholder="الاسم والنسب"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 mb-1">رقم التأجير *</label>
                              <input
                                type="text"
                                className="w-full text-[11px] px-2.5 py-1.5 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                                value={tempCoachLease}
                                onChange={(e) => setTempCoachLease(e.target.value)}
                                placeholder="رقم التأجير"
                                required
                              />
                            </div>
                            <div>
                              <label className="block text-[9px] font-bold text-slate-500 mb-1">الهاتف *</label>
                              <input
                                type="tel"
                                className="w-full text-[11px] px-2.5 py-1.5 bg-white border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                                value={tempCoachPhone}
                                onChange={(e) => setTempCoachPhone(e.target.value)}
                                placeholder="الهاتف"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCoachKey(null);
                              }}
                              className="text-[10px] text-slate-500 hover:text-slate-700 font-bold px-2.5 py-1"
                            >
                              إلغاء
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!tempCoachName.trim() || !tempCoachLease.trim() || !tempCoachPhone.trim()) {
                                  toast.error('يرجى ملء جميع حقول المؤطر');
                                  return;
                                }
                                // Update local predefined coaches state
                                setPredefinedCoaches(prev => ({
                                  ...prev,
                                  [key]: {
                                    coachName: tempCoachName.trim(),
                                    coachLeaseNumber: tempCoachLease.trim(),
                                    coachPhone: tempCoachPhone.trim()
                                  }
                                }));

                                // Propagate updates to all existing students in this category/gender combo
                                const studentsToUpdate = activeSportStudents.filter(s => 
                                  s.category === catId && 
                                  s.gender === g &&
                                  (!aff || s.affiliationType === aff)
                                );
                                if (studentsToUpdate.length > 0) {
                                  try {
                                    const updates = {
                                      coachName: tempCoachName.trim(),
                                      coachLeaseNumber: tempCoachLease.trim(),
                                      coachPhone: tempCoachPhone.trim()
                                    };
                                    await Promise.all(studentsToUpdate.map(s => 
                                      DataService.updateStudent(s.id, updates)
                                    ));
                                setStudents(prev => prev.map(s => {
                                      const match = s.sportId === selectedSportId && normalizeCategoryKey(s.category) === catId && s.gender === g;
                                      const affMatch = !aff || s.affiliationType === aff;
                                      if (match && affMatch) {
                                        return { ...s, ...updates };
                                      }
                                      return s;
                                    }));
                                    toast.success('تم تحديث بيانات مؤطر الفئة لجميع التلاميذ المسجلين!');
                                  } catch (err) {
                                    console.error(err);
                                    toast.error('حدث خطأ أثناء تحديث بيانات التلاميذ');
                                  }
                                } else {
                                  toast.success('تم حفظ بيانات المؤطر للفئة. سيتم تطبيقها تلقائياً على أي تلميذ جديد تسجله!');
                                }
                                setEditingCoachKey(null);
                              }}
                              className="text-[10px] bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1 rounded cursor-pointer"
                            >
                              حفظ المؤطر
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-3 gap-2 text-[10px] font-bold text-slate-600 pt-1">
                          <div className="bg-white p-2 rounded border border-slate-100">
                            <span className="block text-slate-400 text-[9px] mb-0.5">الاسم الكامل:</span>
                            <span className="text-slate-800 line-clamp-1">{currentCoach.coachName || '---'}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-100">
                            <span className="block text-slate-400 text-[9px] mb-0.5">رقم التأجير:</span>
                            <span className="text-slate-800 font-mono">{currentCoach.coachLeaseNumber || '---'}</span>
                          </div>
                          <div className="bg-white p-2 rounded border border-slate-100">
                            <span className="block text-slate-400 text-[9px] mb-0.5">الهاتف:</span>
                            <span className="text-slate-800 font-mono">{currentCoach.coachPhone || '---'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Student Roster Table/Grid */}
          {selectedCategoryKey ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-blue-600 shrink-0" />
                    <h4 className="text-xs md:text-sm font-bold text-slate-800 flex items-center gap-2 flex-wrap">
                      <span>لائحة التلاميذ المسجلين في فئة:</span>
                      <span className="text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 font-extrabold text-[11px] flex items-center gap-1 shadow-3xs">
                        <span>🏷️</span>
                        <span>
                          {getCategoryLabel(selectedCategoryKey.split('_')[0], selectedCategoryKey.split('_')[1])}
                          {selectedCategoryKey.split('_')[2] && (
                            ` (${selectedCategoryKey.split('_')[2] === 'club_affiliated' 
                              ? (selectedCategoryKey.split('_')[1] === 'Female' ? 'المنتميات' : 'المنتمين')
                              : (selectedCategoryKey.split('_')[1] === 'Female' ? 'اللامنتميات' : 'اللامنتمين')
                            })`
                          )}
                        </span>
                      </span>
                      <span className="text-slate-400 font-normal">({displayedSportStudents.length} تلاميذ)</span>
                    </h4>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExportCurrentCategoryExcel}
                      disabled={displayedSportStudents.length === 0}
                      className="text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shadow-3xs"
                      title="استخراج لائحة تلاميذ هذه الفئة إلى ملف Excel"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>استخراج الفئة Excel 📊</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPdfModalOpen(true)}
                      className="text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shadow-3xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>مطبوع المشاركة</span>
                    </button>
                    {selectedSportId === 'cross_country' && (
                      <button
                        type="button"
                        onClick={() => handleOpenCrossCountryBulk(selectedCategoryKey)}
                        className="text-[10px] font-black bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-xs hover:scale-102"
                        title="تسجيل 8 مشاركين في آن واحد (3 فردي + 5 فريق المؤسسة)"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                        <span>تسجيل 8 مشاركين ⚡</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Close Button to Deselect/Reset */}
                <button
                  type="button"
                  onClick={() => setSelectedCategoryKey(null)}
                  className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all cursor-pointer flex items-center gap-1 bg-white shrink-0 shadow-3xs"
                >
                  <span>❌</span>
                  <span>إغلاق تفاصيل الفئة</span>
                </button>
              </div>

              {displayedSportStudents.length > 0 ? (
                <>
                  {/* 1. Mobile Cards View (Visible on Small Screens) */}
                  <div className="block md:hidden p-3 space-y-3 bg-slate-50/50">
                    <div className="text-[11px] text-slate-500 font-medium pb-1 flex items-center justify-between">
                      <span>بطاقات التلاميذ المعروضين:</span>
                      <span className="font-bold text-slate-700">{displayedSportStudents.length} مشارك</span>
                    </div>
                    {displayedSportStudents.map((stud, idx) => {
                      const isStudentClub = stud.affiliationType === 'club_affiliated';
                      return (
                        <div
                          key={stud.id}
                          className={`p-3.5 rounded-xl border shadow-2xs space-y-2.5 transition-all ${
                            isStudentClub
                              ? 'bg-amber-50 border-amber-200 shadow-3xs'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-12 h-12 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-3xs">
                              {stud.photoUrl ? (
                                <img src={stud.photoUrl} alt={stud.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-xl">
                                  {stud.gender === 'Female' ? '👧' : '👦'}
                                </span>
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-1">
                                <h5 className="text-xs font-bold text-slate-900 truncate">
                                  {idx + 1}. {stud.fullName}
                                </h5>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                                  stud.gender === 'Male'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-pink-50 text-pink-700 border-pink-200'
                                }`}>
                                  {stud.gender === 'Male' ? 'ذكر' : 'أنثى'}
                                </span>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                                {stud.massarNumber && (
                                  <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-blue-900 font-mono font-bold">
                                    {stud.massarNumber}
                                  </span>
                                )}
                                <span className={`font-black px-2 py-0.5 rounded border ${
                                  stud.gender === 'Female'
                                    ? 'bg-pink-50 text-pink-800 border-pink-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  {getCategoryLabel(stud.category, stud.gender)}
                                </span>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                                  stud.affiliationType === 'club_affiliated'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {stud.affiliationType === 'club_affiliated' ? 'منتمي لنادي / عصبة' : 'لا منتمي'}
                                </span>
                                {stud.birthDate && (
                                  <span className="text-slate-500 font-mono font-medium">
                                    📅 {stud.birthDate}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Extra Details row if available */}
                          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-600">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {selectedSportId === 'cross_country' && (
                                <>
                                  <span className={`px-2 py-0.5 rounded font-bold border ${
                                    stud.participationType === 'school_team'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : 'bg-amber-50 text-amber-700 border-amber-200'
                                  }`}>
                                    {stud.participationType === 'school_team' ? 'فريق المؤسسة' : 'فردي'}
                                  </span>
                                  <span className="font-bold text-blue-700">
                                    المسافة: {stud.distance || getCrossCountryDistance(stud.category, stud.gender)}
                                  </span>
                                </>
                              )}
                              {selectedSportId === 'athletics' && stud.athleticsSpecialty && (
                                <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                  {stud.athleticsSpecialty}
                                </span>
                              )}
                              {stud.coachName && (
                                <span className="text-slate-500">
                                  المؤطر: <strong className="text-slate-700">{stud.coachName}</strong>
                                </span>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 shrink-0 mr-auto">
                              {canTeacherManageStudent(stud) && (
                                <>
                                  <button
                                    onClick={() => handleRequestEditStudent(stud)}
                                    title="تعديل بيانات التلميذ"
                                    className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                  >
                                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleRequestDeleteStudent(stud)}
                                    title="حذف التلميذ"
                                    className="p-1.5 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 2. Desktop Table View (Visible on Medium and Large Screens) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-right border-collapse min-w-[880px]">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 bg-slate-50/20 uppercase tracking-wider">
                          <th className="p-4">الصورة</th>
                          <th className="p-4">الاسم والنسب</th>
                          <th className="p-4">رقم مسار</th>
                          <th className="p-4">الجنس</th>
                          <th className="p-4">تاريخ الازدياد</th>
                          <th className="p-4">الفئة</th>
                          <th className="p-4">الانتماء الرياضي</th>
                          {selectedSportId === 'cross_country' && (
                            <>
                              <th className="p-4">نوع المشاركة</th>
                              <th className="p-4">المسافة</th>
                            </>
                          )}
                          {selectedSportId === 'athletics' && (
                            <th className="p-4">التخصص</th>
                          )}
                          <th className="p-4">المؤسسة</th>
                          <th className="p-4">الأستاذ المؤطر</th>
                          <th className="p-4 text-left">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                        {displayedSportStudents.map((stud) => {
                          const isStudentClub = stud.affiliationType === 'club_affiliated';
                          return (
                            <tr 
                              key={stud.id} 
                              className={`transition-colors ${
                                isStudentClub
                                  ? 'bg-amber-50/65 hover:bg-amber-100/60'
                                  : 'hover:bg-slate-50/50 bg-white'
                              }`}
                            >
                              <td className="p-4 whitespace-nowrap">
                                <div className="w-10 h-10 rounded-full border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 shadow-3xs">
                                  {stud.photoUrl ? (
                                    <img src={stud.photoUrl} alt={stud.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <span className="text-sm font-bold text-slate-400">
                                      {stud.gender === 'Male' ? '👦' : '👧'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 whitespace-nowrap font-bold text-slate-800">
                                {stud.fullName}
                              </td>
                              <td className="p-4 whitespace-nowrap font-mono text-xs font-bold text-slate-600">
                                {stud.massarNumber ? (
                                  <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-blue-900 font-mono">
                                    {stud.massarNumber}
                                  </span>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  stud.gender === 'Male'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-pink-50 text-pink-700 border-pink-200'
                                }`}>
                                  {stud.gender === 'Male' ? 'ذكر' : 'أنثى'}
                                </span>
                              </td>
                              <td className="p-4 whitespace-nowrap font-mono font-bold text-slate-600">
                                {stud.birthDate}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className={`font-black text-[11px] px-2.5 py-1 rounded-lg border ${
                                  stud.gender === 'Female'
                                    ? 'bg-pink-50 text-pink-800 border-pink-200'
                                    : 'bg-blue-50 text-blue-800 border-blue-200'
                                }`}>
                                  {getCategoryLabel(stud.category, stud.gender)}
                                </span>
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold border ${
                                  stud.affiliationType === 'club_affiliated'
                                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}>
                                  {stud.affiliationType === 'club_affiliated' ? 'منتمي لنادي / عصبة' : 'لا منتمي'}
                                </span>
                              </td>
                              {selectedSportId === 'cross_country' && (
                                <>
                                  <td className="p-4 whitespace-nowrap">
                                    <span className={`inline-flex px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                                      stud.participationType === 'school_team'
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                      {stud.participationType === 'school_team' ? 'فريق المؤسسة' : 'فردي'}
                                    </span>
                                  </td>
                                  <td className="p-4 whitespace-nowrap font-bold text-blue-600">
                                    {stud.distance || getCrossCountryDistance(stud.category, stud.gender)}
                                  </td>
                                </>
                              )}
                              {selectedSportId === 'athletics' && (
                                <td className="p-4 whitespace-nowrap font-bold text-blue-600">
                                  {stud.athleticsSpecialty || 'غير محدد'}
                                </td>
                              )}
                              <td className="p-4 whitespace-nowrap text-slate-500 font-bold">
                                {stud.schoolName}
                              </td>
                              <td className="p-4 whitespace-nowrap">
                                {stud.coachName ? (
                                  <div className="space-y-0.5">
                                    <p className="font-extrabold text-slate-800">{stud.coachName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">رقم التأجير: {stud.coachLeaseNumber || '—'}</p>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[10px] italic">تلقائي (المنسق)</span>
                                )}
                              </td>
                              <td className="p-4 whitespace-nowrap text-left">
                                <div className="flex items-center justify-end gap-1.5">
                                  {canTeacherManageStudent(stud) && (
                                    <>
                                      <button
                                        onClick={() => handleRequestEditStudent(stud)}
                                        title="تعديل بيانات التلميذ"
                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                      >
                                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleRequestDeleteStudent(stud)}
                                        title="حذف التلميذ"
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer inline-flex items-center"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div className="p-12 text-center text-slate-500 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-xl">
                    📋
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-700">لا يوجد أي تلاميذ مسجلين حالياً في هذه الفئة</p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-xs mx-auto">
                      اضغط على زر "إضافة تلميذ جديد" بالأعلى للبدء في إضافة تلاميذ لهذه الفئة المحددة.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-lg">
                📂
              </div>
              <p className="text-xs font-bold text-slate-700">يرجى الضغط على إحدى بطاقات الفئات أعلاه لعرض لائحة التلاميذ</p>
              <p className="text-[10px] text-slate-400">انقر على بطاقة الفئة للدخول إليها وتصفح أو تعديل قائمة التلاميذ المسجلين في تلك الفئة المحددة.</p>
            </div>
          )}
        </div>
      )}

      {/* Custom Confirmation Modal for Editing */}
      {studentToEditConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center gap-3 text-blue-600">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-xl shrink-0">
                ✏️
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">تأكيد فتح تعديل بيانات المشارك</h3>
                <p className="text-[11px] text-slate-500">حساب الأستاذ: إدارة وتعديل لوائح المشاركين</p>
              </div>
            </div>
            
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs relative">
              {/* Photo Thumbnail if exists */}
              <div className="absolute top-3.5 left-3.5 w-12 h-12 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden flex items-center justify-center shadow-3xs">
                {studentToEditConfirm.photoUrl ? (
                  <img src={studentToEditConfirm.photoUrl} alt="صورة المشارك" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl text-slate-400">👤</span>
                )}
              </div>

              <div className="space-y-1.5 pl-14">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">اسم التلميذ(ة):</span>
                  <span className="font-extrabold text-slate-900 truncate max-w-[180px]">{studentToEditConfirm.fullName}</span>
                </div>
                {studentToEditConfirm.massarNumber && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold shrink-0">رقم مسار:</span>
                    <span className="font-mono font-bold text-slate-700">{studentToEditConfirm.massarNumber}</span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">تاريخ الازدياد:</span>
                  <span className="font-mono font-bold text-slate-700">{studentToEditConfirm.birthDate || 'غير محدد'}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">الفئة والجنس:</span>
                  <span className="font-bold text-blue-700">
                    {getCategoryLabel(studentToEditConfirm.category, studentToEditConfirm.gender)} ({studentToEditConfirm.gender === 'Male' ? 'ذكور' : 'إناث'})
                  </span>
                </div>
                {studentToEditConfirm.participationType && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold shrink-0">نوع المشاركة:</span>
                    <span className="font-bold text-blue-800">
                      {studentToEditConfirm.participationType === 'school_team' ? '👥 فريق المؤسسة' : '👤 مشاركة فردية'}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500 font-semibold shrink-0">صنف العداء:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                    studentToEditConfirm.affiliationType === 'club_affiliated'
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    {studentToEditConfirm.affiliationType === 'club_affiliated' ? '🏆 مدرسي منخرط (نادي)' : '🏃 مدرسي (غير منخرط)'}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              هل ترغب في تعديل بيانات هذا التلميذ؟ بالضغط على تأكيد، سيتم تحميل بياناته في استمارة التسجيل بأعلى الصفحة لتحديثها وحفظها.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStudentToEditConfirm(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => confirmStartEdit(studentToEditConfirm)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer shadow-3xs transition-all flex items-center gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>نعم، تعديل البيانات</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirmation Modal for Deletion */}
      {studentToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs" dir="rtl">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-5 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-xl shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-800">تأكيد حذف المشارك نهائياً</h3>
                <p className="text-[11px] text-slate-500">حساب الأستاذ: إدارة وتطهير لوائح المؤسسة</p>
              </div>
            </div>
            
            <div className="p-3 bg-red-50/50 rounded-xl border border-red-100 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">اسم التلميذ(ة):</span>
                <span className="font-extrabold text-red-950">{studentToDelete.fullName}</span>
              </div>
              {studentToDelete.massarNumber && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold">رقم مسار:</span>
                  <span className="font-mono font-bold text-slate-700">{studentToDelete.massarNumber}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">الفئة والجنس:</span>
                <span className="font-bold text-slate-800">
                  {getCategoryLabel(studentToDelete.category, studentToDelete.gender)} ({studentToDelete.gender === 'Male' ? 'ذكور' : 'إناث'})
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              هل أنت متأكد من رغبتك في حذف هذا التلميذ من لائحة المؤسسة بشكل نهائي؟ سيتم تحرير المقعد للتسجيل ولن يمكن التراجع عن هذا الإجراء لاحقاً.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={() => setStudentToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={isDeletingStudent}
                onClick={executeDeleteStudent}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-red-600 text-white hover:bg-red-700 cursor-pointer shadow-3xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeletingStudent ? 'جاري الحذف...' : 'نعم، حذف المشارك نهائياً'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
      {/* PDF Export Modal */}
      {isPdfModalOpen && selectedSportId && (
        <ParticipationFormPdfModal
          isOpen={isPdfModalOpen}
          onClose={() => setIsPdfModalOpen(false)}
          students={activeSportStudents}
          sport={sportsConfig.find(s => s.id === selectedSportId) || null}
          schoolName={schoolName}
          season={currentSeason}
          directorateName={activeDirectorateObj?.name}
          regionName={activeDirectorateObj?.regionName}
          preselectedCategory={selectedCategoryKey ? selectedCategoryKey.split('_')[0] : undefined}
          preselectedGender={selectedCategoryKey ? selectedCategoryKey.split('_')[1] as 'Male' | 'Female' : undefined}
          preselectedAffiliation={selectedCategoryKey ? selectedCategoryKey.split('_')[2] as 'non_club' | 'club_affiliated' : undefined}
        />
      )}

      {/* Cross Country 8-Participant Bulk Registration Modal */}
      {isCrossCountryBulkOpen && (
        <CrossCountryBulkRegisterModal
          isOpen={isCrossCountryBulkOpen}
          onClose={() => setIsCrossCountryBulkOpen(false)}
          schools={schools}
          initialCategoryDefId={crossCountryInitialRaceId}
          affiliationType={crossCountryInitialAffiliation}
          tournaments={tournaments}
          preselectedSchoolName={schoolName}
          allExistingStudents={students}
          currentSeason={currentSeason}
          onRegistered={async () => {
            await loadInitialData();
          }}
        />
      )}

      {/* Generic Sport Bulk Registration Modal */}
      {isSportBulkOpen && (
        <SportBulkRegisterModal
          isOpen={isSportBulkOpen}
          onClose={() => setIsSportBulkOpen(false)}
          sport={activeSportConfig}
          schools={schools}
          preselectedCategory={selectedCategoryKey ? selectedCategoryKey.split('_')[0] : undefined}
          preselectedGender={
            selectedCategoryKey
              ? (selectedCategoryKey.split('_')[1]?.toLowerCase() === 'female' ? 'Female' : 'Male')
              : 'Male'
          }
          preselectedSchoolName={schoolName}
          allExistingStudents={students}
          currentSeason={currentSeason}
          onRegistered={async () => {
            await loadInitialData();
          }}
        />
      )}
    </div>
  );
};
