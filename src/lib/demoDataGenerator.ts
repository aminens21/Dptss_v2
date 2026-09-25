import { Tournament, School, Student, Match, Venue, CrossCountryCategoryResult, Sport } from '../types';
import { DataService, SPORTS_MAP, normalizeCategoryKey } from './dataService';
import { db } from '../firebase/config';
import { collection, doc, writeBatch, setDoc, getDocs, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';

export interface DemoDataCounts {
  tournamentsCount: number;
  schoolsCount: number;
  studentsCount: number;
  matchesCount: number;
  venuesCount: number;
  ccResultsCount: number;
}

export const DemoDataService = {
  /**
   * Generates and commits a complete set of rich, realistic demo data for testing the application.
   */
  async populateDemoData(
    activeDirId: string = 'taourirt',
    activeSeason: string = '2026/2027',
    overwrite: boolean = false
  ): Promise<DemoDataCounts> {
    const dirId = activeDirId || 'taourirt';
    const seasonId = activeSeason || '2026/2027';

    // 1. If overwrite is requested, clear existing demo records first
    if (overwrite) {
      await this.clearDirectorateData(dirId);
    }

    // -------------------------------------------------------------
    // 2. VENUES (الملاعب والقاعات الرياضية)
    // -------------------------------------------------------------
    const demoVenues: Venue[] = [
      {
        id: `demo-ven-1-${dirId}`,
        name: 'القاعة المغطاة للرياضات',
        city: 'تاوريرت المركز',
        address: 'شارع الحسن الثاني، قرب المركب الثقافي',
        capacity: 1500,
        notes: 'مجهزة بأرضية خشبية معتمدة ومدرجات',
        directorateId: dirId
      },
      {
        id: `demo-ven-2-${dirId}`,
        name: 'الملعب البلدي تاوريرت',
        city: 'تاوريرت',
        address: 'حي المسيرة الخضراء',
        capacity: 3500,
        notes: 'عشب اصطناعي من الجيل الجديد وحلبة مطاطية',
        directorateId: dirId
      },
      {
        id: `demo-ven-3-${dirId}`,
        name: 'القاعة الرياضية بالعيون سيدي ملوك',
        city: 'العيون سيدي ملوك',
        address: 'طريق وجدة الرئيسية',
        capacity: 800,
        notes: 'مخصصة لكرة اليد والكرة الطائرة والكرة الطائرة المختلطة',
        directorateId: dirId
      },
      {
        id: `demo-ven-4-${dirId}`,
        name: 'ملاعب ثانوية الفتح التأهيلية',
        city: 'تاوريرت',
        address: 'شارع محمد الخامس',
        capacity: 400,
        notes: 'ملاعب متعددة الرياضات وكرة السلة 3x3',
        directorateId: dirId
      },
      {
        id: `demo-ven-5-${dirId}`,
        name: 'مطاف غابة النخيل للعدو الريفي',
        city: 'تاوريرت',
        address: 'الضاحية الغربية لمدينة تاوريرت',
        capacity: 2000,
        notes: 'مسار ترابي طبيعي مطابق لمعايير الجامعة الملكية المغربية للرياضة المدرسية',
        directorateId: dirId
      }
    ];

    // Save Venues
    try {
      const currentVenues = await DataService.getVenues();
      const existingVenueIds = new Set(currentVenues.map(v => v.id));
      const newVenues = demoVenues.filter(v => !existingVenueIds.has(v.id));
      
      const updatedVenues = [...currentVenues, ...newVenues];
      localStorage.setItem('taourirt_venues_data', JSON.stringify(updatedVenues));
      
      const vBatch = writeBatch(db);
      for (const v of demoVenues) {
        vBatch.set(doc(db, 'venues', v.id), { ...v, updatedAt: serverTimestamp() });
      }
      await vBatch.commit().catch(e => console.warn('Venues Firestore sync non-fatal:', e));
    } catch (e) {
      console.warn('Error saving demo venues:', e);
    }

    // -------------------------------------------------------------
    // 3. SCHOOLS (المؤسسات التعليمية)
    // -------------------------------------------------------------
    const demoSchools: School[] = [
      {
        id: `demo-sch-1-${dirId}`,
        name: 'ثانوية الفتح التأهيلية',
        type: 'تأهيلي',
        commune: 'تاوريرت المركز',
        teacherName: 'ذ. عبد الرحيم بلقاسم',
        coordinatorName: 'ذ. عبد الرحيم بلقاسم',
        phone: '0661234567',
        principalName: 'ذ. محمد اليعقوبي',
        principalPhone: '0661998877',
        accessCode: 'SCH101',
        directorateId: dirId
      },
      {
        id: `demo-sch-2-${dirId}`,
        name: 'ثانوية علال الفاسي التأهيلية',
        type: 'تأهيلي',
        commune: 'العيون سيدي ملوك',
        teacherName: 'ذ. رشيد الداودي',
        coordinatorName: 'ذ. رشيد الداودي',
        phone: '0662345678',
        principalName: 'ذ. أحمد المريني',
        principalPhone: '0662887766',
        accessCode: 'SCH102',
        directorateId: dirId
      },
      {
        id: `demo-sch-3-${dirId}`,
        name: 'إعدادية ابن سينا',
        type: 'إعدادي',
        commune: 'تاوريرت',
        teacherName: 'ذة. فاطمة الزهراء بنعلي',
        coordinatorName: 'ذة. فاطمة الزهراء بنعلي',
        phone: '0663456789',
        principalName: 'ذ. حسن المنصوري',
        principalPhone: '0663776655',
        accessCode: 'SCH103',
        directorateId: dirId
      },
      {
        id: `demo-sch-4-${dirId}`,
        name: 'إعدادية سيدي لحسن',
        type: 'إعدادي',
        commune: 'سيدي لحسن',
        teacherName: 'ذ. حميد بنعيسى',
        coordinatorName: 'ذ. حميد بنعيسى',
        phone: '0664567890',
        principalName: 'ذ. إبراهيم الزايدي',
        principalPhone: '0664665544',
        accessCode: 'SCH104',
        directorateId: dirId
      },
      {
        id: `demo-sch-5-${dirId}`,
        name: 'ثانوية الزيتون التأهيلية',
        type: 'تأهيلي',
        commune: 'تاوريرت',
        teacherName: 'ذ. مصطفى الغازي',
        coordinatorName: 'ذ. مصطفى الغازي',
        phone: '0666789012',
        principalName: 'ذ. عمر الشريف',
        principalPhone: '0666443322',
        accessCode: 'SCH105',
        directorateId: dirId
      },
      {
        id: `demo-sch-6-${dirId}`,
        name: 'مجموعة مدارس دبدو الابتدائية',
        type: 'ابتدائي',
        commune: 'دبدو',
        teacherName: 'ذ. يوسف المراكشي',
        coordinatorName: 'ذ. يوسف المراكشي',
        phone: '0665678901',
        principalName: 'ذ. عبد القادر الفاسي',
        principalPhone: '0665554433',
        accessCode: 'SCH106',
        directorateId: dirId
      }
    ];

    // Save Schools
    try {
      const existingSchools = await DataService.getSchools();
      const existingSchoolMap = new Map(existingSchools.map(s => [s.name, s]));
      const schoolsToInsert: School[] = [];

      for (const ds of demoSchools) {
        if (!existingSchoolMap.has(ds.name)) {
          schoolsToInsert.push(ds);
        }
      }

      if (schoolsToInsert.length > 0) {
        const updatedSchools = [...existingSchools, ...schoolsToInsert];
        localStorage.setItem('taourirt_schools_data', JSON.stringify(updatedSchools));
        const sBatch = writeBatch(db);
        for (const s of schoolsToInsert) {
          sBatch.set(doc(db, 'schools', s.id), { ...s, createdAt: serverTimestamp() });
        }
        await sBatch.commit().catch(e => console.warn('Schools Firestore sync non-fatal:', e));
      }
    } catch (e) {
      console.warn('Error saving demo schools:', e);
    }

    // -------------------------------------------------------------
    // 4. TOURNAMENTS (البطولات المبرمجة)
    // -------------------------------------------------------------
    const demoTournaments: Tournament[] = [
      {
        id: `demo-tourn-foot-u15-${dirId}`,
        name: 'البطولة الإقليمية المدرسية لكرة القدم (صغار ذكور)',
        seasonId,
        sportId: 'football',
        ageCategory: 'U15',
        gender: 'Male',
        level: 'Middle',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: '2026-03-01',
        endDate: '2026-03-26',
        registrationDeadline: '2026-02-28',
        status: 'Ongoing',
        description: 'البطولة الإقليمية الرسمية لكرة القدم فئة الصغار، مؤهلة مباشرة لنهائيات البطولة الجهوية للرياضة المدرسية بجهة الشرق.',
        managerName: 'ذ. عبد الرحيم بلقاسم',
        managerPhone: '0661234567',
        managerEmail: 'belkacem.foot@taourirt.ma',
        accessCode: 'FB-2026',
        directorateId: dirId
      },
      {
        id: `demo-tourn-foot-u18-${dirId}`,
        name: 'البطولة الإقليمية المدرسية لكرة القدم (فتيان ذكور)',
        seasonId,
        sportId: 'football',
        ageCategory: 'U18',
        gender: 'Male',
        level: 'High',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: '2026-03-05',
        endDate: '2026-03-30',
        registrationDeadline: '2026-03-02',
        status: 'Ongoing',
        description: 'منافسات فئة الفتيان لكرة القدم للثانويات التأهيلية، تجرى مبارياتها بالمركب الرياضي البلدي بتاوريرت.',
        managerName: 'ذ. هشام العمراني',
        managerPhone: '0662223344',
        managerEmail: 'omrani.foot@taourirt.ma',
        accessCode: 'FB-1818',
        directorateId: dirId
      },
      {
        id: `demo-tourn-hand-u15-${dirId}`,
        name: 'دوري كرة اليد للإناث (صغيرات)',
        seasonId,
        sportId: 'handball',
        ageCategory: 'U15',
        gender: 'Female',
        level: 'Middle',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: '2026-03-10',
        endDate: '2026-03-24',
        registrationDeadline: '2026-03-05',
        status: 'Scheduled',
        description: 'المنافسات الإقليمية لكرة اليد إناث بالقاعة المغطاة للرياضات بتاوريرت.',
        managerName: 'ذة. فاطمة الزهراء بنعلي',
        managerPhone: '0663456789',
        managerEmail: 'benali.hand@taourirt.ma',
        accessCode: 'HB-7740',
        directorateId: dirId
      },
      {
        id: `demo-tourn-basket-u18-${dirId}`,
        name: 'دوري كرة السلة - فئة الفتيات (إناث)',
        seasonId,
        sportId: 'basketball',
        ageCategory: 'U18',
        gender: 'Female',
        level: 'High',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: '2026-02-18',
        endDate: '2026-03-15',
        registrationDeadline: '2026-02-14',
        status: 'Ongoing',
        description: 'البطولة الإقليمية لكرة السلة للفتيات بملاعب ثانوية الفتح والقاعة المغطاة.',
        managerName: 'ذ. مصطفى الغازي',
        managerPhone: '0666789012',
        managerEmail: 'ghazi.basket@taourirt.ma',
        accessCode: 'BB-9031',
        directorateId: dirId
      },
      {
        id: `demo-tourn-volley-u18-${dirId}`,
        name: 'البطولة الإقليمية للكرة الطائرة (مختلط)',
        seasonId,
        sportId: 'volleyball',
        ageCategory: 'U18',
        gender: 'Mixed',
        level: 'High',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: '2026-03-12',
        endDate: '2026-03-28',
        registrationDeadline: '2026-03-08',
        status: 'Scheduled',
        description: 'إقصائيات الكرة الطائرة للثانويات التأهيلية بتاوريرت والعيون سيدي ملوك.',
        managerName: 'ذ. رشيد الداودي',
        managerPhone: '0662345678',
        managerEmail: 'daoudi.volley@taourirt.ma',
        accessCode: 'VB-5512',
        directorateId: dirId
      },
      {
        id: `demo-tourn-cross-country-${dirId}`,
        name: 'البطولة الإقليمية المدرسية للعدو الريفي (جميع الفئات)',
        seasonId,
        sportId: 'cross_country',
        ageCategory: 'جميع الفئات (U12 / U15 / U18 / U20)',
        gender: 'Mixed',
        level: 'جميع الأسلاك',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: '2026-01-15',
        endDate: '2026-01-16',
        registrationDeadline: '2026-01-10',
        status: 'Completed',
        description: 'البطولة الإقليمية الرسمية للعدو الريفي المدرسي لجميع الفئات ذكورا وإناثا بمطاف غابة النخيل.',
        managerName: 'ذ. المشرف على العدو الريفي',
        managerPhone: '0660001122',
        managerEmail: 'cross.country@taourirt.ma',
        accessCode: 'CC-2026',
        directorateId: dirId
      },
      {
        id: `demo-tourn-table-tennis-${dirId}`,
        name: 'البطولة الإقليمية لكرة الطاولة (فردي وزوجي)',
        seasonId,
        sportId: 'table_tennis',
        ageCategory: 'U15',
        gender: 'Mixed',
        level: 'Middle',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: '2026-03-20',
        endDate: '2026-03-22',
        registrationDeadline: '2026-03-15',
        status: 'Scheduled',
        description: 'منافسات كرة الطاولة الفردية والزوجية لمؤسسات التعليم الإعدادي والتأهيلي.',
        managerName: 'ذ. أمين اليعقوبي',
        managerPhone: '0664445566',
        managerEmail: 'yaacoubi.tt@taourirt.ma',
        accessCode: 'TT-3030',
        directorateId: dirId
      }
    ];

    // Save Tournaments
    try {
      const existingTourns = await DataService.getTournaments();
      const existingTournIds = new Set(existingTourns.map(t => t.id));
      const tournsToInsert = demoTournaments.filter(t => !existingTournIds.has(t.id));
      const updatedTourns = [...tournsToInsert, ...existingTourns];

      localStorage.setItem('taourirt_tournaments', JSON.stringify(updatedTourns));
      
      const tBatch = writeBatch(db);
      for (const t of tournsToInsert) {
        tBatch.set(doc(db, 'tournaments', t.id), { ...t, createdAt: serverTimestamp() });
      }
      await tBatch.commit().catch(e => console.warn('Tournaments Firestore sync non-fatal:', e));
    } catch (e) {
      console.warn('Error saving demo tournaments:', e);
    }

    // -------------------------------------------------------------
    // 5. UPDATE SPORTS PROGRAMMED STATUS (تفعيل وضع البرمجة للرياضات)
    // -------------------------------------------------------------
    try {
      const programmedSportIds = ['football', 'handball', 'basketball', 'volleyball', 'cross_country', 'table_tennis'];
      const currentSports = await DataService.getSportsConfig();
      const updatedSports = currentSports.map(s => {
        if (programmedSportIds.includes(s.id)) {
          return {
            ...s,
            isProgrammed: true,
            ageCategories: ['U12', 'U15', 'U18', 'U20'],
            studentLimit: s.studentLimit && s.studentLimit > 0 ? s.studentLimit : 16
          };
        }
        return s;
      });

      localStorage.setItem('taourirt_sports_config', JSON.stringify(updatedSports));

      const spBatch = writeBatch(db);
      for (const sportId of programmedSportIds) {
        spBatch.set(doc(db, 'sports', sportId), {
          isProgrammed: true,
          ageCategories: ['U12', 'U15', 'U18', 'U20'],
          studentLimit: 16,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      await spBatch.commit().catch(e => console.warn('Sports Firestore sync non-fatal:', e));
    } catch (e) {
      console.warn('Error updating sports config:', e);
    }

    // -------------------------------------------------------------
    // 6. STUDENTS & ATHLETES (التلاميذ والرياضيون مع أرقام مسار)
    // -------------------------------------------------------------
    const demoStudentsRaw: Array<Omit<Student, 'id' | 'createdAt' | 'updatedAt'>> = [
      // Cross-Country Runners (U15 - صغار ذكور)
      {
        fullName: 'ياسين الفاسي الفهري',
        massarNumber: 'G134098214',
        gender: 'Male',
        birthDate: '2012-04-15',
        category: 'U15',
        schoolId: `demo-sch-3-${dirId}`,
        schoolName: 'إعدادية ابن سينا',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '3000 م',
        coachName: 'ذة. فاطمة الزهراء بنعلي',
        coachPhone: '0663456789',
        directorateId: dirId
      },
      {
        fullName: 'حمزة المريني السجلماسي',
        massarNumber: 'G138765432',
        gender: 'Male',
        birthDate: '2012-07-22',
        category: 'U15',
        schoolId: `demo-sch-4-${dirId}`,
        schoolName: 'إعدادية سيدي لحسن',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '3000 م',
        coachName: 'ذ. حميد بنعيسى',
        coachPhone: '0664567890',
        directorateId: dirId
      },
      {
        fullName: 'أمين الناصري الإدريسي',
        massarNumber: 'M130098451',
        gender: 'Male',
        birthDate: '2013-02-18',
        category: 'U15',
        schoolId: `demo-sch-3-${dirId}`,
        schoolName: 'إعدادية ابن سينا',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'school_team',
        distance: '3000 م',
        coachName: 'ذة. فاطمة الزهراء بنعلي',
        coachPhone: '0663456789',
        directorateId: dirId
      },

      // Cross-Country Runners (U15 - صغيرات إناث)
      {
        fullName: 'فاطمة الزهراء العلوي',
        massarNumber: 'R145028192',
        gender: 'Female',
        birthDate: '2012-09-10',
        category: 'U15',
        schoolId: `demo-sch-3-${dirId}`,
        schoolName: 'إعدادية ابن سينا',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '2000 م',
        coachName: 'ذة. فاطمة الزهراء بنعلي',
        coachPhone: '0663456789',
        directorateId: dirId
      },
      {
        fullName: 'سارة الإدريسي الحسني',
        massarNumber: 'F139876543',
        gender: 'Female',
        birthDate: '2013-05-14',
        category: 'U15',
        schoolId: `demo-sch-4-${dirId}`,
        schoolName: 'إعدادية سيدي لحسن',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '2000 م',
        coachName: 'ذ. حميد بنعيسى',
        coachPhone: '0664567890',
        directorateId: dirId
      },
      {
        fullName: 'مريم التازي البوزيدي',
        massarNumber: 'K142095812',
        gender: 'Female',
        birthDate: '2012-11-30',
        category: 'U15',
        schoolId: `demo-sch-3-${dirId}`,
        schoolName: 'إعدادية ابن سينا',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'school_team',
        distance: '2000 م',
        coachName: 'ذة. فاطمة الزهراء بنعلي',
        coachPhone: '0663456789',
        directorateId: dirId
      },

      // Cross-Country Runners (U18 - فتيان ذكور)
      {
        fullName: 'أيوب برادة العلمي',
        massarNumber: 'N136789012',
        gender: 'Male',
        birthDate: '2009-03-25',
        category: 'U18',
        schoolId: `demo-sch-1-${dirId}`,
        schoolName: 'ثانوية الفتح التأهيلية',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '4500 م',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661234567',
        directorateId: dirId
      },
      {
        fullName: 'أنس التلمساني الصالحي',
        massarNumber: 'D132456789',
        gender: 'Male',
        birthDate: '2009-08-12',
        category: 'U18',
        schoolId: `demo-sch-2-${dirId}`,
        schoolName: 'ثانوية علال الفاسي التأهيلية',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '4500 م',
        coachName: 'ذ. رشيد الداودي',
        coachPhone: '0662345678',
        directorateId: dirId
      },
      {
        fullName: 'يوسف بنسليمان اليعقوبي',
        massarNumber: 'G139876123',
        gender: 'Male',
        birthDate: '2010-01-19',
        category: 'U18',
        schoolId: `demo-sch-5-${dirId}`,
        schoolName: 'ثانوية الزيتون التأهيلية',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'school_team',
        distance: '4500 م',
        coachName: 'ذ. مصطفى الغازي',
        coachPhone: '0666789012',
        directorateId: dirId
      },

      // Cross-Country Runners (U18 - فتيات إناث)
      {
        fullName: 'آية الرحماني الشرقاوي',
        massarNumber: 'M134567812',
        gender: 'Female',
        birthDate: '2009-06-08',
        category: 'U18',
        schoolId: `demo-sch-1-${dirId}`,
        schoolName: 'ثانوية الفتح التأهيلية',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '3000 م',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661234567',
        directorateId: dirId
      },
      {
        fullName: 'خديجة الصالحي بنجلون',
        massarNumber: 'R142345678',
        gender: 'Female',
        birthDate: '2009-12-04',
        category: 'U18',
        schoolId: `demo-sch-2-${dirId}`,
        schoolName: 'ثانوية علال الفاسي التأهيلية',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '3000 م',
        coachName: 'ذ. رشيد الداودي',
        coachPhone: '0662345678',
        directorateId: dirId
      },

      // Cross-Country Runners (U12 - براعم ذكور وإناث)
      {
        fullName: 'عمر البوشيخي الوردي',
        massarNumber: 'F131234567',
        gender: 'Male',
        birthDate: '2015-04-10',
        category: 'U12',
        schoolId: `demo-sch-6-${dirId}`,
        schoolName: 'مجموعة مدارس دبدو الابتدائية',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '1500 م',
        coachName: 'ذ. يوسف المراكشي',
        coachPhone: '0665678901',
        directorateId: dirId
      },
      {
        fullName: 'ندى الوزاني الحسني',
        massarNumber: 'K149876543',
        gender: 'Female',
        birthDate: '2015-09-27',
        category: 'U12',
        schoolId: `demo-sch-6-${dirId}`,
        schoolName: 'مجموعة مدارس دبدو الابتدائية',
        sportId: 'cross_country',
        affiliationType: 'non_club',
        participationType: 'individual',
        distance: '1500 م',
        coachName: 'ذ. يوسف المراكشي',
        coachPhone: '0665678901',
        directorateId: dirId
      },

      // Football Players (كرة القدم - U15)
      {
        fullName: 'إلياس الشاوي بناني',
        massarNumber: 'N134567890',
        gender: 'Male',
        birthDate: '2012-03-12',
        category: 'U15',
        schoolId: `demo-sch-3-${dirId}`,
        schoolName: 'إعدادية ابن سينا',
        sportId: 'football',
        affiliationType: 'non_club',
        coachName: 'ذة. فاطمة الزهراء بنعلي',
        coachPhone: '0663456789',
        directorateId: dirId
      },
      {
        fullName: 'مهدي الزروالي الكتاني',
        massarNumber: 'D138765432',
        gender: 'Male',
        birthDate: '2012-08-19',
        category: 'U15',
        schoolId: `demo-sch-4-${dirId}`,
        schoolName: 'إعدادية سيدي لحسن',
        sportId: 'football',
        affiliationType: 'non_club',
        coachName: 'ذ. حميد بنعيسى',
        coachPhone: '0664567890',
        directorateId: dirId
      },

      // Football Players (كرة القدم - U18)
      {
        fullName: 'وليد القادري بودريقة',
        massarNumber: 'G132345678',
        gender: 'Male',
        birthDate: '2009-05-16',
        category: 'U18',
        schoolId: `demo-sch-1-${dirId}`,
        schoolName: 'ثانوية الفتح التأهيلية',
        sportId: 'football',
        affiliationType: 'non_club',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661234567',
        directorateId: dirId
      },
      {
        fullName: 'سليمان بلمقدم البقالي',
        massarNumber: 'M138765432',
        gender: 'Male',
        birthDate: '2009-11-20',
        category: 'U18',
        schoolId: `demo-sch-2-${dirId}`,
        schoolName: 'ثانوية علال الفاسي التأهيلية',
        sportId: 'football',
        affiliationType: 'non_club',
        coachName: 'ذ. رشيد الداودي',
        coachPhone: '0662345678',
        directorateId: dirId
      },

      // Handball Players (كرة اليد - U15 إناث)
      {
        fullName: 'صفاء المنصوري الصديقي',
        massarNumber: 'R149876543',
        gender: 'Female',
        birthDate: '2012-06-25',
        category: 'U15',
        schoolId: `demo-sch-3-${dirId}`,
        schoolName: 'إعدادية ابن سينا',
        sportId: 'handball',
        affiliationType: 'non_club',
        coachName: 'ذة. فاطمة الزهراء بنعلي',
        coachPhone: '0663456789',
        directorateId: dirId
      },
      {
        fullName: 'هند العمراني الحسني',
        massarNumber: 'F134567890',
        gender: 'Female',
        birthDate: '2013-01-14',
        category: 'U15',
        schoolId: `demo-sch-4-${dirId}`,
        schoolName: 'إعدادية سيدي لحسن',
        sportId: 'handball',
        affiliationType: 'non_club',
        coachName: 'ذ. حميد بنعيسى',
        coachPhone: '0664567890',
        directorateId: dirId
      },

      // Basketball Players (كرة السلة - U18 إناث)
      {
        fullName: 'زينب اليعقوبي التازي',
        massarNumber: 'K141234567',
        gender: 'Female',
        birthDate: '2009-04-03',
        category: 'U18',
        schoolId: `demo-sch-1-${dirId}`,
        schoolName: 'ثانوية الفتح التأهيلية',
        sportId: 'basketball',
        affiliationType: 'non_club',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661234567',
        directorateId: dirId
      },
      {
        fullName: 'سلمى الشريف الوزاني',
        massarNumber: 'N138765432',
        gender: 'Female',
        birthDate: '2010-07-29',
        category: 'U18',
        schoolId: `demo-sch-5-${dirId}`,
        schoolName: 'ثانوية الزيتون التأهيلية',
        sportId: 'basketball',
        affiliationType: 'non_club',
        coachName: 'ذ. مصطفى الغازي',
        coachPhone: '0666789012',
        directorateId: dirId
      },

      // Volleyball Players (الكرة الطائرة - U18 مختلط)
      {
        fullName: 'محمد أمين بنجلون التلمساني',
        massarNumber: 'D134567890',
        gender: 'Male',
        birthDate: '2009-09-17',
        category: 'U18',
        schoolId: `demo-sch-1-${dirId}`,
        schoolName: 'ثانوية الفتح التأهيلية',
        sportId: 'volleyball',
        affiliationType: 'non_club',
        coachName: 'ذ. عبد الرحيم بلقاسم',
        coachPhone: '0661234567',
        directorateId: dirId
      },
      {
        fullName: 'كوثر الداودي العلمي',
        massarNumber: 'G136789012',
        gender: 'Female',
        birthDate: '2010-03-05',
        category: 'U18',
        schoolId: `demo-sch-2-${dirId}`,
        schoolName: 'ثانوية علال الفاسي التأهيلية',
        sportId: 'volleyball',
        affiliationType: 'non_club',
        coachName: 'ذ. رشيد الداودي',
        coachPhone: '0662345678',
        directorateId: dirId
      }
    ];

    let insertedStudentsCount = 0;
    try {
      const existingStudents = await DataService.getStudents();
      const existingMassars = new Set(existingStudents.map(s => s.massarNumber));
      const studentsToAdd = demoStudentsRaw.filter(s => !existingMassars.has(s.massarNumber));

      if (studentsToAdd.length > 0) {
        const added = await DataService.addStudentsBulk(studentsToAdd);
        insertedStudentsCount = added.length;
      }
    } catch (e) {
      console.warn('Error inserting demo students:', e);
    }

    // -------------------------------------------------------------
    // 7. MATCHES (المباريات المجدولة والمنتهية والجارية)
    // -------------------------------------------------------------
    const demoMatches: Match[] = [
      // Football Match 1 (Completed)
      {
        id: `demo-mat-1-${dirId}`,
        tournamentId: `demo-tourn-foot-u15-${dirId}`,
        sportId: 'football',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-3-${dirId}`,
        team2Id: `demo-sch-4-${dirId}`,
        ageCategory: 'U15',
        gender: 'Male',
        date: '2026-03-15',
        startTime: '10:30',
        endTime: '12:00',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 3,
        score2: 1,
        winnerId: `demo-sch-3-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'إلياس الشاوي (د 18، 54) - مهدي الزروالي (د 37) - أيوب برادة (د 78)',
        notes: 'مباراة قوية بحضور جماهيري وازن، تأهلت على إثرها إعدادية ابن سينا للنهائي.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football Match 2 (Ongoing / Live)
      {
        id: `demo-mat-2-${dirId}`,
        tournamentId: `demo-tourn-foot-u18-${dirId}`,
        sportId: 'football',
        stage: 'دور المجموعات',
        team1Id: `demo-sch-1-${dirId}`,
        team2Id: `demo-sch-2-${dirId}`,
        ageCategory: 'U18',
        gender: 'Male',
        date: new Date().toISOString().slice(0, 10),
        startTime: '15:00',
        endTime: '16:45',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Ongoing',
        score1: 1,
        score2: 1,
        referees: ['محمد العلوي', 'أستاذ التربية البدنية (ثانوية الفتح)'],
        referee1Id: 'محمد العلوي',
        scorers: 'وليد القادري (د 22) - سليمان بلمقدم (د 41)',
        notes: 'المباراة جارية حاليا في شوطها الثاني بتكافؤ تام بين الفريقين.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Handball Match 3 (Scheduled)
      {
        id: `demo-mat-3-${dirId}`,
        tournamentId: `demo-tourn-hand-u15-${dirId}`,
        sportId: 'handball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-3-${dirId}`,
        team2Id: `demo-sch-4-${dirId}`,
        ageCategory: 'U15',
        gender: 'Female',
        date: '2026-03-24',
        startTime: '11:00',
        endTime: '12:15',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Scheduled',
        referees: ['محمد العلوي', 'أستاذ التربية البدنية (ثانوية الفتح)'],
        referee1Id: 'محمد العلوي',
        notes: 'المباراة النهائية لتحديد بطلة الإقليم لكرة اليد والتأهل للنهائيات الجهوية.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Basketball Match 4 (Completed)
      {
        id: `demo-mat-4-${dirId}`,
        tournamentId: `demo-tourn-basket-u18-${dirId}`,
        sportId: 'basketball',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-1-${dirId}`,
        team2Id: `demo-sch-5-${dirId}`,
        ageCategory: 'U18',
        gender: 'Female',
        date: '2026-02-28',
        startTime: '14:30',
        endTime: '16:00',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 52,
        score2: 46,
        winnerId: `demo-sch-1-${dirId}`,
        notes: 'فوز ثانوية الفتح بعد التمديد إثر تعادل الفريقين في الوقت الأصلي 44-44.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Volleyball Match 5 (Scheduled)
      {
        id: `demo-mat-5-${dirId}`,
        tournamentId: `demo-tourn-volley-u18-${dirId}`,
        sportId: 'volleyball',
        stage: 'الدور الأول',
        team1Id: `demo-sch-1-${dirId}`,
        team2Id: `demo-sch-2-${dirId}`,
        ageCategory: 'U18',
        gender: 'Mixed',
        date: '2026-03-20',
        startTime: '10:00',
        endTime: '11:30',
        venueId: `demo-ven-3-${dirId}`,
        status: 'Scheduled',
        notes: 'مباراة افتتاح دوري الكرة الطائرة المختلطة بالقاعة الرياضية بالعيون سيدي ملوك.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      }
    ];

    // Save Matches
    try {
      const existingMatches = await DataService.getMatches();
      const existingMatchIds = new Set(existingMatches.map(m => m.id));
      const matchesToInsert = demoMatches.filter(m => !existingMatchIds.has(m.id));

      if (matchesToInsert.length > 0) {
        const updatedMatches = [...matchesToInsert, ...existingMatches];
        localStorage.setItem('taourirt_matches_data', JSON.stringify(updatedMatches));

        const mBatch = writeBatch(db);
        for (const m of matchesToInsert) {
          mBatch.set(doc(db, 'matches', m.id), { ...m, updatedAt: serverTimestamp() });
        }
        await mBatch.commit().catch(e => console.warn('Matches Firestore sync non-fatal:', e));
      }
    } catch (e) {
      console.warn('Error saving demo matches:', e);
    }

    // -------------------------------------------------------------
    // 8. CROSS-COUNTRY RESULTS (منصات التتويج والتوقيتات للعدو الريفي)
    // -------------------------------------------------------------
    const demoCCResults: CrossCountryCategoryResult[] = [
      {
        categoryId: 'u15_male',
        category: 'U15',
        gender: 'Male',
        titleAr: 'سباق فئة الصغار (ذكور) - 3000 متر',
        distance: '3000 م',
        seasonId,
        directorateId: dirId,
        venueName: 'مطاف غابة النخيل تاوريرت',
        podium: [
          {
            rank: 1,
            fullName: 'ياسين الفاسي الفهري',
            schoolName: 'إعدادية ابن سينا',
            bibNumber: '101',
            time: '10:42',
            directorateName: 'تاوريرت',
            notes: 'بطل الإقليم - تأهل مباشر للبطولة الجهوية'
          },
          {
            rank: 2,
            fullName: 'حمزة المريني السجلماسي',
            schoolName: 'إعدادية سيدي لحسن',
            bibNumber: '102',
            time: '10:58',
            directorateName: 'تاوريرت',
            notes: 'وصيف البطل'
          },
          {
            rank: 3,
            fullName: 'أمين الناصري الإدريسي',
            schoolName: 'إعدادية ابن سينا',
            bibNumber: '103',
            time: '11:15',
            directorateName: 'تاوريرت',
            notes: 'الرتبة الثالثة'
          }
        ]
      },
      {
        categoryId: 'u15_female',
        category: 'U15',
        gender: 'Female',
        titleAr: 'سباق فئة الصغيرات (إناث) - 2000 متر',
        distance: '2000 م',
        seasonId,
        directorateId: dirId,
        venueName: 'مطاف غابة النخيل تاوريرت',
        podium: [
          {
            rank: 1,
            fullName: 'فاطمة الزهراء العلوي',
            schoolName: 'إعدادية ابن سينا',
            bibNumber: '201',
            time: '07:35',
            directorateName: 'تاوريرت',
            notes: 'بطلة الإقليم'
          },
          {
            rank: 2,
            fullName: 'سارة الإدريسي الحسني',
            schoolName: 'إعدادية سيدي لحسن',
            bibNumber: '202',
            time: '07:51',
            directorateName: 'تاوريرت',
            notes: 'الميدالية الفضية'
          },
          {
            rank: 3,
            fullName: 'مريم التازي البوزيدي',
            schoolName: 'إعدادية ابن سينا',
            bibNumber: '203',
            time: '08:04',
            directorateName: 'تاوريرت',
            notes: 'الميدالية البرونزية'
          }
        ]
      },
      {
        categoryId: 'u18_male',
        category: 'U18',
        gender: 'Male',
        titleAr: 'سباق فئة الفتيان (ذكور) - 4500 متر',
        distance: '4500 م',
        seasonId,
        directorateId: dirId,
        venueName: 'مطاف غابة النخيل تاوريرت',
        podium: [
          {
            rank: 1,
            fullName: 'أيوب برادة العلمي',
            schoolName: 'ثانوية الفتح التأهيلية',
            bibNumber: '301',
            time: '15:18',
            directorateName: 'تاوريرت',
            notes: 'بطل الإقليم للفتيان'
          },
          {
            rank: 2,
            fullName: 'أنس التلمساني الصالحي',
            schoolName: 'ثانوية علال الفاسي التأهيلية',
            bibNumber: '302',
            time: '15:34',
            directorateName: 'تاوريرت',
            notes: 'وصيف بطل الإقليم'
          }
        ]
      }
    ];

    try {
      for (const res of demoCCResults) {
        await DataService.saveCrossCountryCategoryResult(res);
      }
    } catch (e) {
      console.warn('Error saving demo CC results:', e);
    }

    return {
      tournamentsCount: demoTournaments.length,
      schoolsCount: demoSchools.length,
      studentsCount: insertedStudentsCount || demoStudentsRaw.length,
      matchesCount: demoMatches.length,
      venuesCount: demoVenues.length,
      ccResultsCount: demoCCResults.length
    };
  },

  /**
   * Clears only demo records for the current directorate to return to a fresh slate.
   */
  async clearDirectorateData(activeDirId: string = 'taourirt'): Promise<void> {
    const dirId = activeDirId || 'taourirt';

    // 1. Tournaments
    try {
      const allTourns = await DataService.getTournaments();
      const remainingTourns = allTourns.filter(t => (t.directorateId || 'taourirt') !== dirId || !t.id.startsWith('demo-'));
      localStorage.setItem('taourirt_tournaments', JSON.stringify(remainingTourns));
      
      // Delete demo from Firestore
      const snap = await getDocs(query(collection(db, 'tournaments'), where('directorateId', '==', dirId)));
      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        if (docSnap.id.startsWith('demo-')) {
          batch.delete(docSnap.ref);
        }
      });
      await batch.commit().catch(() => {});
    } catch (e) {
      console.warn('Error clearing demo tournaments:', e);
    }

    // 2. Matches
    try {
      const allMatches = await DataService.getMatches();
      const remainingMatches = allMatches.filter(m => (m.directorateId || 'taourirt') !== dirId || !m.id.startsWith('demo-'));
      localStorage.setItem('taourirt_matches_data', JSON.stringify(remainingMatches));

      const snap = await getDocs(query(collection(db, 'matches'), where('directorateId', '==', dirId)));
      const batch = writeBatch(db);
      snap.forEach(docSnap => {
        if (docSnap.id.startsWith('demo-')) {
          batch.delete(docSnap.ref);
        }
      });
      await batch.commit().catch(() => {});
    } catch (e) {
      console.warn('Error clearing demo matches:', e);
    }

    // 3. Students
    try {
      const allStudents = await DataService.getStudents();
      const remainingStudents = allStudents.filter(s => (s.directorateId || 'taourirt') !== dirId || (!s.id.startsWith('demo-') && !s.massarNumber?.startsWith('G134098214')));
      localStorage.setItem('taourirt_students_data', JSON.stringify(remainingStudents));
    } catch (e) {
      console.warn('Error clearing demo students:', e);
    }
  }
};
