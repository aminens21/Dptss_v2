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
    const todayStr = new Date().toISOString().slice(0, 10);
    const getOffsetDate = (days: number) => {
      const d = new Date();
      d.setDate(d.getDate() + days);
      return d.toISOString().slice(0, 10);
    };

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
      },
      {
        id: `demo-sch-7-${dirId}`,
        name: 'إعدادية ابن رشد',
        type: 'إعدادي',
        commune: 'تاوريرت المركز',
        teacherName: 'ذ. طارق بنزيان',
        coordinatorName: 'ذ. طارق بنزيان',
        phone: '0667889900',
        principalName: 'ذ. عبد الحق التازي',
        principalPhone: '0667112233',
        accessCode: 'SCH107',
        directorateId: dirId
      },
      {
        id: `demo-sch-8-${dirId}`,
        name: 'إعدادية القدس',
        type: 'إعدادي',
        commune: 'تاوريرت',
        teacherName: 'ذة. مريم الصادقي',
        coordinatorName: 'ذة. مريم الصادقي',
        phone: '0668990011',
        principalName: 'ذ. كمال البوشيخي',
        principalPhone: '0668223344',
        accessCode: 'SCH108',
        directorateId: dirId
      },
      {
        id: `demo-sch-9-${dirId}`,
        name: 'ثانوية عبد الكريم الخطابي التأهيلية',
        type: 'تأهيلي',
        commune: 'العيون سيدي ملوك',
        teacherName: 'ذ. يونس البكاي',
        coordinatorName: 'ذ. يونس البكاي',
        phone: '0669001122',
        principalName: 'ذ. رضوان القادري',
        principalPhone: '0669334455',
        accessCode: 'SCH109',
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
        startDate: getOffsetDate(-5),
        endDate: getOffsetDate(5),
        registrationDeadline: getOffsetDate(-6),
        status: 'Ongoing',
        description: 'البطولة الإقليمية الرسمية لكرة القدم فئة الصغار. المؤسسات التعليمية المشاركة: إعدادية ابن سينا، إعدادية سيدي لحسن، إعدادية ابن رشد، إعدادية القدس.',
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
        startDate: getOffsetDate(-5),
        endDate: getOffsetDate(5),
        registrationDeadline: getOffsetDate(-6),
        status: 'Ongoing',
        description: 'منافسات فئة الفتيان لكرة القدم للثانويات التأهيلية. المؤسسات التعليمية المشاركة: ثانوية الفتح التأهيلية، ثانوية علال الفاسي التأهيلية، ثانوية الزيتون التأهيلية، ثانوية عبد الكريم الخطابي.',
        managerName: 'ذ. هشام العمراني',
        managerPhone: '0662223344',
        managerEmail: 'omrani.foot@taourirt.ma',
        accessCode: 'FB-1818',
        directorateId: dirId
      },
      {
        id: `demo-tourn-foot-u15-club-${dirId}`,
        name: 'دوري كرة القدم للمنتمين للأندية (صغار ذكور)',
        seasonId,
        sportId: 'football',
        ageCategory: 'U15',
        gender: 'Male',
        level: 'Middle',
        scope: 'Provincial',
        affiliationType: 'club_affiliated',
        startDate: getOffsetDate(-4),
        endDate: getOffsetDate(6),
        registrationDeadline: getOffsetDate(-5),
        status: 'Ongoing',
        description: 'منافسات كرة القدم للتلاميذ المنخرطين في الأندية الرياضية المعتمدة.',
        managerName: 'ذ. عبد الرحيم بلقاسم',
        managerPhone: '0661234567',
        managerEmail: 'belkacem.foot@taourirt.ma',
        accessCode: 'FB-CLUB-15',
        directorateId: dirId
      },
      {
        id: `demo-tourn-foot-u18-fem-${dirId}`,
        name: 'البطولة الإقليمية لكرة القدم النسوية (فتيات)',
        seasonId,
        sportId: 'football',
        ageCategory: 'U18',
        gender: 'Female',
        level: 'High',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: getOffsetDate(-3),
        endDate: getOffsetDate(7),
        registrationDeadline: getOffsetDate(-4),
        status: 'Ongoing',
        description: 'دوري كرة القدم المصغرة للفتيات بالثانويات التأهيلية.',
        managerName: 'ذة. خديجة التازي',
        managerPhone: '0667778899',
        managerEmail: 'tazi.footfem@taourirt.ma',
        accessCode: 'FB-FEM-18',
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
        startDate: getOffsetDate(-6),
        endDate: getOffsetDate(4),
        registrationDeadline: getOffsetDate(-7),
        status: 'Ongoing',
        description: 'المنافسات الإقليمية لكرة اليد إناث بالقاعة المغطاة للرياضات بتاوريرت. المؤسسات التعليمية المشاركة: إعدادية ابن سينا، إعدادية سيدي لحسن، إعدادية ابن رشد، مجموعة مدارس دبدو.',
        managerName: 'ذة. فاطمة الزهراء بنعلي',
        managerPhone: '0663456789',
        managerEmail: 'benali.hand@taourirt.ma',
        accessCode: 'HB-7740',
        directorateId: dirId
      },
      {
        id: `demo-tourn-hand-u15-male-${dirId}`,
        name: 'البطولة الإقليمية لكرة اليد (صغار ذكور)',
        seasonId,
        sportId: 'handball',
        ageCategory: 'U15',
        gender: 'Male',
        level: 'Middle',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: getOffsetDate(-4),
        endDate: getOffsetDate(6),
        registrationDeadline: getOffsetDate(-5),
        status: 'Ongoing',
        description: 'منافسات كرة اليد لفئة الصغار ذكور بين الإعداديات.',
        managerName: 'ذ. طارق المريني',
        managerPhone: '0663112233',
        managerEmail: 'merini.hand@taourirt.ma',
        accessCode: 'HB-MALE-15',
        directorateId: dirId
      },
      {
        id: `demo-tourn-hand-u18-${dirId}`,
        name: 'البطولة الإقليمية لكرة اليد (فتيان ذكور)',
        seasonId,
        sportId: 'handball',
        ageCategory: 'U18',
        gender: 'Male',
        level: 'High',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: getOffsetDate(-5),
        endDate: getOffsetDate(5),
        registrationDeadline: getOffsetDate(-6),
        status: 'Ongoing',
        description: 'دوري كرة اليد للثانويات التأهيلية بتاوريرت والعيون سيدي ملوك.',
        managerName: 'ذ. طارق المريني',
        managerPhone: '0663112233',
        managerEmail: 'merini.hand@taourirt.ma',
        accessCode: 'HB-MALE-18',
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
        startDate: getOffsetDate(-10),
        endDate: getOffsetDate(10),
        registrationDeadline: getOffsetDate(-12),
        status: 'Ongoing',
        description: 'البطولة الإقليمية لكرة السلة للفتيات بملاعب ثانوية الفتح والقاعة المغطاة. المؤسسات المشاركة: ثانوية الفتح، ثانوية الزيتون، ثانوية علال الفاسي، ثانوية عبد الكريم الخطابي.',
        managerName: 'ذ. مصطفى الغازي',
        managerPhone: '0666789012',
        managerEmail: 'ghazi.basket@taourirt.ma',
        accessCode: 'BB-9031',
        directorateId: dirId
      },
      {
        id: `demo-tourn-basket-u18-male-${dirId}`,
        name: 'البطولة الإقليمية لكرة السلة (فتيان ذكور)',
        seasonId,
        sportId: 'basketball',
        ageCategory: 'U18',
        gender: 'Male',
        level: 'High',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: getOffsetDate(-8),
        endDate: getOffsetDate(8),
        registrationDeadline: getOffsetDate(-10),
        status: 'Ongoing',
        description: 'منافسات كرة السلة فئة الفتيان للثانويات التأهيلية.',
        managerName: 'ذ. مصطفى الغازي',
        managerPhone: '0666789012',
        managerEmail: 'ghazi.basket@taourirt.ma',
        accessCode: 'BB-MALE-18',
        directorateId: dirId
      },
      {
        id: `demo-tourn-basket-u15-${dirId}`,
        name: 'البطولة الإقليمية لكرة السلة (صغار)',
        seasonId,
        sportId: 'basketball',
        ageCategory: 'U15',
        gender: 'Male',
        level: 'Middle',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: getOffsetDate(-4),
        endDate: getOffsetDate(6),
        registrationDeadline: getOffsetDate(-5),
        status: 'Ongoing',
        description: 'منافسات كرة السلة لمؤسسات التعليم الثانوي الإعدادي.',
        managerName: 'ذ. مصطفى الغازي',
        managerPhone: '0666789012',
        managerEmail: 'ghazi.basket@taourirt.ma',
        accessCode: 'BB-MID-15',
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
        startDate: getOffsetDate(-6),
        endDate: getOffsetDate(6),
        registrationDeadline: getOffsetDate(-7),
        status: 'Ongoing',
        description: 'إقصائيات الكرة الطائرة للثانويات التأهيلية بتاوريرت والعيون سيدي ملوك. المؤسسات المشاركة: ثانوية الفتح، ثانوية علال الفاسي، ثانوية الزيتون، ثانوية عبد الكريم الخطابي.',
        managerName: 'ذ. رشيد الداودي',
        managerPhone: '0662345678',
        managerEmail: 'daoudi.volley@taourirt.ma',
        accessCode: 'VB-5512',
        directorateId: dirId
      },
      {
        id: `demo-tourn-volley-u18-fem-${dirId}`,
        name: 'دوري الكرة الطائرة للفتيات (إناث)',
        seasonId,
        sportId: 'volleyball',
        ageCategory: 'U18',
        gender: 'Female',
        level: 'High',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: getOffsetDate(-5),
        endDate: getOffsetDate(5),
        registrationDeadline: getOffsetDate(-6),
        status: 'Ongoing',
        description: 'منافسات الكرة الطائرة إناث للثانويات التأهيلية.',
        managerName: 'ذ. رشيد الداودي',
        managerPhone: '0662345678',
        managerEmail: 'daoudi.volley@taourirt.ma',
        accessCode: 'VB-FEM-18',
        directorateId: dirId
      },
      {
        id: `demo-tourn-volley-u15-${dirId}`,
        name: 'البطولة الإقليمية للكرة الطائرة (صغار)',
        seasonId,
        sportId: 'volleyball',
        ageCategory: 'U15',
        gender: 'Mixed',
        level: 'Middle',
        scope: 'Provincial',
        affiliationType: 'non_club',
        startDate: getOffsetDate(-4),
        endDate: getOffsetDate(6),
        registrationDeadline: getOffsetDate(-5),
        status: 'Ongoing',
        description: 'منافسات الكرة الطائرة لفئة الإعدادي.',
        managerName: 'ذ. رشيد الداودي',
        managerPhone: '0662345678',
        managerEmail: 'daoudi.volley@taourirt.ma',
        accessCode: 'VB-MID-15',
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
        startDate: getOffsetDate(-30),
        endDate: getOffsetDate(-29),
        registrationDeadline: getOffsetDate(-35),
        status: 'Completed',
        description: 'البطولة الإقليمية الرسمية للعدو الريفي المدرسي لجميع الفئات ذكورا وإناثا بمطاف غابة النخيل. المؤسسات التعليمية المشاركة: إعدادية ابن سينا، إعدادية سيدي لحسن، ثانوية الفتح، ثانوية علال الفاسي، ثانوية الزيتون، مجموعة مدارس دبدو.',
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
        startDate: getOffsetDate(-2),
        endDate: getOffsetDate(5),
        registrationDeadline: getOffsetDate(-4),
        status: 'Scheduled',
        description: 'منافسات كرة الطاولة الفردية والزوجية لمؤسسات التعليم الإعدادي والتأهيلي. المؤسسات التعليمية المشاركة: إعدادية ابن سينا، إعدادية سيدي لحسن، إعدادية ابن رشد.',
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

      localStorage.setItem('taourirt_tournaments_data', JSON.stringify(updatedTourns));
      
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
      // =============================================================
      // ⚽ 1. FOOTBALL (كرة القدم)
      // =============================================================
      // Football U15 - Semi-Final 1 (Completed)
      {
        id: `demo-mat-foot-1-${dirId}`,
        tournamentId: `demo-tourn-foot-u15-${dirId}`,
        sportId: 'football',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-3-${dirId}`,
        team1Name: 'إعدادية ابن سينا',
        team1SchoolName: 'إعدادية ابن سينا',
        team2Id: `demo-sch-4-${dirId}`,
        team2Name: 'إعدادية سيدي لحسن',
        team2SchoolName: 'إعدادية سيدي لحسن',
        ageCategory: 'U15',
        gender: 'Male',
        date: getOffsetDate(-4),
        startTime: '10:00',
        endTime: '11:30',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 3,
        score2: 1,
        winnerId: `demo-sch-3-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'إلياس الشاوي (د 18، 54) - مهدي الزروالي (د 37) / أيوب برادة (د 78)',
        notes: 'مباراة قوية بحضور جماهيري وازن، تأهلت على إثرها إعدادية ابن سينا للنهائي.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U15 - Semi-Final 2 (Completed)
      {
        id: `demo-mat-foot-2-${dirId}`,
        tournamentId: `demo-tourn-foot-u15-${dirId}`,
        sportId: 'football',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-7-${dirId}`,
        team1Name: 'إعدادية ابن رشد',
        team1SchoolName: 'إعدادية ابن رشد',
        team2Id: `demo-sch-8-${dirId}`,
        team2Name: 'إعدادية القدس',
        team2SchoolName: 'إعدادية القدس',
        ageCategory: 'U15',
        gender: 'Male',
        date: getOffsetDate(-4),
        startTime: '11:45',
        endTime: '13:15',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 2,
        score2: 0,
        winnerId: `demo-sch-7-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'سامي المنصوري (د 25) - يوسف بنعمر (د 62)',
        notes: 'فوز مستحق لإعدادية ابن رشد وبلوغها النهائي الإقليمي.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U15 - 3rd Place Match (Completed)
      {
        id: `demo-mat-foot-3-${dirId}`,
        tournamentId: `demo-tourn-foot-u15-${dirId}`,
        sportId: 'football',
        stage: 'مباراة الترتيب (المركز الثالث)',
        team1Id: `demo-sch-4-${dirId}`,
        team1Name: 'إعدادية سيدي لحسن',
        team1SchoolName: 'إعدادية سيدي لحسن',
        team2Id: `demo-sch-8-${dirId}`,
        team2Name: 'إعدادية القدس',
        team2SchoolName: 'إعدادية القدس',
        ageCategory: 'U15',
        gender: 'Male',
        date: getOffsetDate(-2),
        startTime: '09:30',
        endTime: '11:00',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 4,
        score2: 2,
        winnerId: `demo-sch-4-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'أيوب برادة (د 12، 44) - رضى بنعيسى (د 60) - كريم الصادق (د 75) / بلال الهاشمي (د 33، 58)',
        notes: 'حصول إعدادية سيدي لحسن على الميدالية البرونزية والمركز الثالث إقليمياً.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U15 - Final (Completed - Championship Decided)
      {
        id: `demo-mat-foot-4-${dirId}`,
        tournamentId: `demo-tourn-foot-u15-${dirId}`,
        sportId: 'football',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-3-${dirId}`,
        team1Name: 'إعدادية ابن سينا',
        team1SchoolName: 'إعدادية ابن سينا',
        team2Id: `demo-sch-7-${dirId}`,
        team2Name: 'إعدادية ابن رشد',
        team2SchoolName: 'إعدادية ابن رشد',
        ageCategory: 'U15',
        gender: 'Male',
        date: getOffsetDate(-1),
        startTime: '11:00',
        endTime: '12:45',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 2,
        score2: 1,
        winnerId: `demo-sch-3-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'إلياس الشاوي (د 31) - مهدي الزروالي (د 81) / سامي المنصوري (د 65)',
        notes: 'تتويج إعدادية ابن سينا بلقب البطولة الإقليمية المدرسية لكرة القدم لفئة الصغار والتأهل للبطولة الجهوية.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U18 - Group Match 1 (Completed)
      {
        id: `demo-mat-foot-5-${dirId}`,
        tournamentId: `demo-tourn-foot-u18-${dirId}`,
        sportId: 'football',
        stage: 'دور المجموعات',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-2-${dirId}`,
        team2Name: 'ثانوية علال الفاسي التأهيلية',
        team2SchoolName: 'ثانوية علال الفاسي التأهيلية',
        ageCategory: 'U18',
        gender: 'Male',
        date: getOffsetDate(-5),
        startTime: '15:00',
        endTime: '16:45',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 2,
        score2: 1,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'وليد القادري (د 22، 70) / سليمان بلمقدم (د 41)',
        notes: 'انتصار ثانوية الفتح في افتتاح دوري الفتيان.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U18 - Group Match 2 (Completed)
      {
        id: `demo-mat-foot-6-${dirId}`,
        tournamentId: `demo-tourn-foot-u18-${dirId}`,
        sportId: 'football',
        stage: 'دور المجموعات',
        team1Id: `demo-sch-5-${dirId}`,
        team1Name: 'ثانوية الزيتون التأهيلية',
        team1SchoolName: 'ثانوية الزيتون التأهيلية',
        team2Id: `demo-sch-9-${dirId}`,
        team2Name: 'ثانوية عبد الكريم الخطابي التأهيلية',
        team2SchoolName: 'ثانوية عبد الكريم الخطابي التأهيلية',
        ageCategory: 'U18',
        gender: 'Male',
        date: getOffsetDate(-4),
        startTime: '15:00',
        endTime: '16:45',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 3,
        score2: 2,
        winnerId: `demo-sch-5-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'ياسين بنسعيد (د 15، 60) - مروان الداودي (د 79) / عماد البكاي (د 40) - زكرياء الفاسي (د 88)',
        notes: 'مباراة حماسية انتهت بفوز ثانوية الزيتون.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U18 - Semi-Final (Completed)
      {
        id: `demo-mat-foot-7-${dirId}`,
        tournamentId: `demo-tourn-foot-u18-${dirId}`,
        sportId: 'football',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-5-${dirId}`,
        team2Name: 'ثانوية الزيتون التأهيلية',
        team2SchoolName: 'ثانوية الزيتون التأهيلية',
        ageCategory: 'U18',
        gender: 'Male',
        date: getOffsetDate(-2),
        startTime: '15:30',
        endTime: '17:15',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 3,
        score2: 0,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'وليد القادري (د 10) - حمزة اليعقوبي (د 45) - عثمان العلمي (د 72)',
        notes: 'تأهل ثانوية الفتح للمباراة النهائية بجدارة.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U18 - Final (Completed)
      {
        id: `demo-mat-foot-8-${dirId}`,
        tournamentId: `demo-tourn-foot-u18-${dirId}`,
        sportId: 'football',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-2-${dirId}`,
        team2Name: 'ثانوية علال الفاسي التأهيلية',
        team2SchoolName: 'ثانوية علال الفاسي التأهيلية',
        ageCategory: 'U18',
        gender: 'Male',
        date: getOffsetDate(-1),
        startTime: '15:00',
        endTime: '17:00',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 1,
        score2: 1,
        penalty1: 5,
        penalty2: 4,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'وليد القادري (د 35) / سليمان بلمقدم (د 75) [ركلات الترجيح 5-4 لصالح ثانوية الفتح]',
        notes: 'تتويج ثانوية الفتح بطلة للإقليم لكرة القدم فئة الفتيان بعد اللجوء لركلات الترجيح المثيرة.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U18 - Live / Ongoing Match
      {
        id: `demo-mat-foot-9-${dirId}`,
        tournamentId: `demo-tourn-foot-u18-${dirId}`,
        sportId: 'football',
        stage: 'دوري التميز الودي',
        team1Id: `demo-sch-5-${dirId}`,
        team1Name: 'ثانوية الزيتون التأهيلية',
        team1SchoolName: 'ثانوية الزيتون التأهيلية',
        team2Id: `demo-sch-9-${dirId}`,
        team2Name: 'ثانوية عبد الكريم الخطابي التأهيلية',
        team2SchoolName: 'ثانوية عبد الكريم الخطابي التأهيلية',
        ageCategory: 'U18',
        gender: 'Male',
        date: todayStr,
        startTime: '15:00',
        endTime: '16:45',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Ongoing',
        score1: 1,
        score2: 1,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'ياسين بنسعيد (د 20) / عماد البكاي (د 38)',
        notes: 'المباراة جارية حاليا في شوطها الثاني بتكافؤ تام بين الفريقين.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Football U15 - Club Affiliated Final (Completed)
      {
        id: `demo-mat-foot-10-${dirId}`,
        tournamentId: `demo-tourn-foot-u15-club-${dirId}`,
        sportId: 'football',
        stage: 'المباراة النهائية (منتمين للأندية)',
        team1Id: `demo-sch-3-${dirId}`,
        team1Name: 'إعدادية ابن سينا (نادي الأمل)',
        team1SchoolName: 'إعدادية ابن سينا',
        team2Id: `demo-sch-4-${dirId}`,
        team2Name: 'إعدادية سيدي لحسن (نادي النجم)',
        team2SchoolName: 'إعدادية سيدي لحسن',
        ageCategory: 'U15',
        gender: 'Male',
        date: getOffsetDate(-2),
        startTime: '16:00',
        endTime: '17:30',
        venueId: `demo-ven-2-${dirId}`,
        status: 'Completed',
        score1: 2,
        score2: 1,
        winnerId: `demo-sch-3-${dirId}`,
        referees: ['محمد العلوي'],
        referee1Id: 'محمد العلوي',
        scorers: 'ياسين الفاسي (د 40) - أحمد الصديقي (د 72) / حمزة المريني (د 55)',
        notes: 'نهائي فئة المنتمين للأندية مع تأهل الفائز للبطولة الجهوية للجمعيات والنوادي المدرسية.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },

      // =============================================================
      // 🏀 2. BASKETBALL (كرة السلة)
      // =============================================================
      // Basketball U18 Female - Semi-Final 1 (Completed)
      {
        id: `demo-mat-bask-1-${dirId}`,
        tournamentId: `demo-tourn-basket-u18-${dirId}`,
        sportId: 'basketball',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-5-${dirId}`,
        team2Name: 'ثانوية الزيتون التأهيلية',
        team2SchoolName: 'ثانوية الزيتون التأهيلية',
        ageCategory: 'U18',
        gender: 'Female',
        date: getOffsetDate(-5),
        startTime: '14:30',
        endTime: '16:00',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 52,
        score2: 46,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['ذ. مصطفى الغازي'],
        referee1Id: 'ذ. مصطفى الغازي',
        notes: 'فوز ثانوية الفتح بعد التمديد إثر تعادل الفريقين في الوقت الأصلي 44-44.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Basketball U18 Female - Semi-Final 2 (Completed)
      {
        id: `demo-mat-bask-2-${dirId}`,
        tournamentId: `demo-tourn-basket-u18-${dirId}`,
        sportId: 'basketball',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-2-${dirId}`,
        team1Name: 'ثانوية علال الفاسي التأهيلية',
        team1SchoolName: 'ثانوية علال الفاسي التأهيلية',
        team2Id: `demo-sch-9-${dirId}`,
        team2Name: 'ثانوية عبد الكريم الخطابي التأهيلية',
        team2SchoolName: 'ثانوية عبد الكريم الخطابي التأهيلية',
        ageCategory: 'U18',
        gender: 'Female',
        date: getOffsetDate(-5),
        startTime: '16:15',
        endTime: '17:45',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 48,
        score2: 40,
        winnerId: `demo-sch-2-${dirId}`,
        referees: ['ذ. مصطفى الغازي'],
        referee1Id: 'ذ. مصطفى الغازي',
        notes: 'تألق لافت للاعبات ثانوية علال الفاسي في الرميات الثلاثية.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Basketball U18 Female - Final (Completed - Championship Decided)
      {
        id: `demo-mat-bask-3-${dirId}`,
        tournamentId: `demo-tourn-basket-u18-${dirId}`,
        sportId: 'basketball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-2-${dirId}`,
        team2Name: 'ثانوية علال الفاسي التأهيلية',
        team2SchoolName: 'ثانوية علال الفاسي التأهيلية',
        ageCategory: 'U18',
        gender: 'Female',
        date: getOffsetDate(-2),
        startTime: '15:00',
        endTime: '16:30',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 58,
        score2: 54,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['ذ. مصطفى الغازي'],
        referee1Id: 'ذ. مصطفى الغازي',
        notes: 'تتويج ثانوية الفتح التأهيلية بلقب بطولة كرة السلة فتيات بالإقليم والتأهل للبطولة الجهوية.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Basketball U18 Male - Semi-Final (Completed)
      {
        id: `demo-mat-bask-4-${dirId}`,
        tournamentId: `demo-tourn-basket-u18-male-${dirId}`,
        sportId: 'basketball',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-2-${dirId}`,
        team2Name: 'ثانوية علال الفاسي التأهيلية',
        team2SchoolName: 'ثانوية علال الفاسي التأهيلية',
        ageCategory: 'U18',
        gender: 'Male',
        date: getOffsetDate(-3),
        startTime: '10:00',
        endTime: '11:30',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 66,
        score2: 62,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['ذ. مصطفى الغازي'],
        referee1Id: 'ذ. مصطفى الغازي',
        notes: 'مباراة شيقة تفوق فيها فريق ثانوية الفتح في الربع الأخير.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Basketball U18 Male - Final (Completed)
      {
        id: `demo-mat-bask-5-${dirId}`,
        tournamentId: `demo-tourn-basket-u18-male-${dirId}`,
        sportId: 'basketball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-5-${dirId}`,
        team2Name: 'ثانوية الزيتون التأهيلية',
        team2SchoolName: 'ثانوية الزيتون التأهيلية',
        ageCategory: 'U18',
        gender: 'Male',
        date: getOffsetDate(-1),
        startTime: '16:00',
        endTime: '17:45',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 71,
        score2: 68,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['ذ. مصطفى الغازي'],
        referee1Id: 'ذ. مصطفى الغازي',
        notes: 'تتويج ثانوية الفتح بطلاً لإقليم تاوريرت لكرة السلة فتيان.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Basketball U15 Male - Final (Completed)
      {
        id: `demo-mat-bask-6-${dirId}`,
        tournamentId: `demo-tourn-basket-u15-${dirId}`,
        sportId: 'basketball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-3-${dirId}`,
        team1Name: 'إعدادية ابن سينا',
        team1SchoolName: 'إعدادية ابن سينا',
        team2Id: `demo-sch-4-${dirId}`,
        team2Name: 'إعدادية سيدي لحسن',
        team2SchoolName: 'إعدادية سيدي لحسن',
        ageCategory: 'U15',
        gender: 'Male',
        date: getOffsetDate(-2),
        startTime: '11:00',
        endTime: '12:30',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 42,
        score2: 38,
        winnerId: `demo-sch-3-${dirId}`,
        referees: ['ذ. مصطفى الغازي'],
        referee1Id: 'ذ. مصطفى الغازي',
        notes: 'فوز إعدادية ابن سينا بكأس البطولة الإقليمية لكرة السلة صغار.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },

      // =============================================================
      // 🤾 3. HANDBALL (كرة اليد)
      // =============================================================
      // Handball U15 Female - Semi-Final 1 (Completed)
      {
        id: `demo-mat-hand-1-${dirId}`,
        tournamentId: `demo-tourn-hand-u15-${dirId}`,
        sportId: 'handball',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-3-${dirId}`,
        team1Name: 'إعدادية ابن سينا',
        team1SchoolName: 'إعدادية ابن سينا',
        team2Id: `demo-sch-6-${dirId}`,
        team2Name: 'مجموعة مدارس دبدو الابتدائية',
        team2SchoolName: 'مجموعة مدارس دبدو الابتدائية',
        ageCategory: 'U15',
        gender: 'Female',
        date: getOffsetDate(-4),
        startTime: '10:00',
        endTime: '11:15',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 16,
        score2: 10,
        winnerId: `demo-sch-3-${dirId}`,
        referees: ['ذة. فاطمة الزهراء بنعلي'],
        referee1Id: 'ذة. فاطمة الزهراء بنعلي',
        scorers: 'صفاء المنصوري (6 أهداف) - نادية التازي (5 أهداف) / سلمى الدبدوبي (4 أهداف)',
        notes: 'تأهل إعدادية ابن سينا للمباراة النهائية بعد سيطرة على مجريات اللقاء.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Handball U15 Female - Semi-Final 2 (Completed)
      {
        id: `demo-mat-hand-2-${dirId}`,
        tournamentId: `demo-tourn-hand-u15-${dirId}`,
        sportId: 'handball',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-4-${dirId}`,
        team1Name: 'إعدادية سيدي لحسن',
        team1SchoolName: 'إعدادية سيدي لحسن',
        team2Id: `demo-sch-7-${dirId}`,
        team2Name: 'إعدادية ابن رشد',
        team2SchoolName: 'إعدادية ابن رشد',
        ageCategory: 'U15',
        gender: 'Female',
        date: getOffsetDate(-4),
        startTime: '11:30',
        endTime: '12:45',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 14,
        score2: 12,
        winnerId: `demo-sch-4-${dirId}`,
        referees: ['ذة. فاطمة الزهراء بنعلي'],
        referee1Id: 'ذة. فاطمة الزهراء بنعلي',
        scorers: 'هند العمراني (7 أهداف) / دنيا بنزيان (5 أهداف)',
        notes: 'فوز صعب ومثير لإعدادية سيدي لحسن في الدقائق الأخيرة.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Handball U15 Female - Final (Completed - Championship Decided)
      {
        id: `demo-mat-hand-3-${dirId}`,
        tournamentId: `demo-tourn-hand-u15-${dirId}`,
        sportId: 'handball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-3-${dirId}`,
        team1Name: 'إعدادية ابن سينا',
        team1SchoolName: 'إعدادية ابن سينا',
        team2Id: `demo-sch-4-${dirId}`,
        team2Name: 'إعدادية سيدي لحسن',
        team2SchoolName: 'إعدادية سيدي لحسن',
        ageCategory: 'U15',
        gender: 'Female',
        date: getOffsetDate(-1),
        startTime: '11:00',
        endTime: '12:15',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 18,
        score2: 15,
        winnerId: `demo-sch-3-${dirId}`,
        referees: ['ذة. فاطمة الزهراء بنعلي'],
        referee1Id: 'ذة. فاطمة الزهراء بنعلي',
        scorers: 'صفاء المنصوري (8 أهداف) - خلود المريني (4 أهداف) / هند العمراني (6 أهداف)',
        notes: 'تتويج إعدادية ابن سينا بلقب بطولة كرة اليد صغيرات والتأهل للنهائيات الجهوية بوجدة.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Handball U15 Male - Final (Completed)
      {
        id: `demo-mat-hand-4-${dirId}`,
        tournamentId: `demo-tourn-hand-u15-male-${dirId}`,
        sportId: 'handball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-4-${dirId}`,
        team1Name: 'إعدادية سيدي لحسن',
        team1SchoolName: 'إعدادية سيدي لحسن',
        team2Id: `demo-sch-3-${dirId}`,
        team2Name: 'إعدادية ابن سينا',
        team2SchoolName: 'إعدادية ابن سينا',
        ageCategory: 'U15',
        gender: 'Male',
        date: getOffsetDate(-2),
        startTime: '15:00',
        endTime: '16:15',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 22,
        score2: 19,
        winnerId: `demo-sch-4-${dirId}`,
        referees: ['ذ. طارق المريني'],
        referee1Id: 'ذ. طارق المريني',
        scorers: 'معاذ الزايدي (9 أهداف) / أسامة بلقاسم (7 أهداف)',
        notes: 'تتويج إعدادية سيدي لحسن بالبطولة الإقليمية لكرة اليد صغار ذكور.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Handball U18 Male - Final (Completed)
      {
        id: `demo-mat-hand-5-${dirId}`,
        tournamentId: `demo-tourn-hand-u18-${dirId}`,
        sportId: 'handball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-2-${dirId}`,
        team1Name: 'ثانوية علال الفاسي التأهيلية',
        team1SchoolName: 'ثانوية علال الفاسي التأهيلية',
        team2Id: `demo-sch-1-${dirId}`,
        team2Name: 'ثانوية الفتح التأهيلية',
        team2SchoolName: 'ثانوية الفتح التأهيلية',
        ageCategory: 'U18',
        gender: 'Male',
        date: getOffsetDate(-1),
        startTime: '17:00',
        endTime: '18:30',
        venueId: `demo-ven-1-${dirId}`,
        status: 'Completed',
        score1: 25,
        score2: 23,
        winnerId: `demo-sch-2-${dirId}`,
        referees: ['ذ. طارق المريني'],
        referee1Id: 'ذ. طارق المريني',
        scorers: 'سفيان المريني (8 أهداف) / مروان الفتحي (7 أهداف)',
        notes: 'فوز ثمين لثانوية علال الفاسي والتتويج بلقب كرة اليد فتيان بالإقليم.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },

      // =============================================================
      // 🏐 4. VOLLEYBALL (الكرة الطائرة)
      // =============================================================
      // Volleyball U18 Mixed - Semi-Final 1 (Completed)
      {
        id: `demo-mat-voll-1-${dirId}`,
        tournamentId: `demo-tourn-volley-u18-${dirId}`,
        sportId: 'volleyball',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-5-${dirId}`,
        team2Name: 'ثانوية الزيتون التأهيلية',
        team2SchoolName: 'ثانوية الزيتون التأهيلية',
        ageCategory: 'U18',
        gender: 'Mixed',
        date: getOffsetDate(-4),
        startTime: '10:00',
        endTime: '11:15',
        venueId: `demo-ven-3-${dirId}`,
        status: 'Completed',
        score1: 2,
        score2: 0,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['ذ. رشيد الداودي'],
        referee1Id: 'ذ. رشيد الداودي',
        notes: 'فوز ثانوية الفتح بشوطين دون رد (25-18، 25-21) وبلوغها النهائي.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Volleyball U18 Mixed - Semi-Final 2 (Completed)
      {
        id: `demo-mat-voll-2-${dirId}`,
        tournamentId: `demo-tourn-volley-u18-${dirId}`,
        sportId: 'volleyball',
        stage: 'نصف النهائي',
        team1Id: `demo-sch-2-${dirId}`,
        team1Name: 'ثانوية علال الفاسي التأهيلية',
        team1SchoolName: 'ثانوية علال الفاسي التأهيلية',
        team2Id: `demo-sch-9-${dirId}`,
        team2Name: 'ثانوية عبد الكريم الخطابي التأهيلية',
        team2SchoolName: 'ثانوية عبد الكريم الخطابي التأهيلية',
        ageCategory: 'U18',
        gender: 'Mixed',
        date: getOffsetDate(-4),
        startTime: '11:30',
        endTime: '13:00',
        venueId: `demo-ven-3-${dirId}`,
        status: 'Completed',
        score1: 2,
        score2: 1,
        winnerId: `demo-sch-2-${dirId}`,
        referees: ['ذ. رشيد الداودي'],
        referee1Id: 'ذ. رشيد الداودي',
        notes: 'مباراة نارية انتهت بفوز ثانوية علال الفاسي بشوطين مقابل شوط واحد (25-22، 20-25، 15-12).',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Volleyball U18 Mixed - Final (Completed - Championship Decided)
      {
        id: `demo-mat-voll-3-${dirId}`,
        tournamentId: `demo-tourn-volley-u18-${dirId}`,
        sportId: 'volleyball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-1-${dirId}`,
        team1Name: 'ثانوية الفتح التأهيلية',
        team1SchoolName: 'ثانوية الفتح التأهيلية',
        team2Id: `demo-sch-2-${dirId}`,
        team2Name: 'ثانوية علال الفاسي التأهيلية',
        team2SchoolName: 'ثانوية علال الفاسي التأهيلية',
        ageCategory: 'U18',
        gender: 'Mixed',
        date: getOffsetDate(-1),
        startTime: '15:00',
        endTime: '16:45',
        venueId: `demo-ven-3-${dirId}`,
        status: 'Completed',
        score1: 3,
        score2: 1,
        winnerId: `demo-sch-1-${dirId}`,
        referees: ['ذ. رشيد الداودي'],
        referee1Id: 'ذ. رشيد الداودي',
        notes: 'تتويج ثانوية الفتح التأهيلية بلقب البطولة الإقليمية للكرة الطائرة المختلطة (25-20، 22-25، 25-19، 25-22) والتأهل للبطولة الجهوية.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Volleyball U18 Female - Final (Completed)
      {
        id: `demo-mat-voll-4-${dirId}`,
        tournamentId: `demo-tourn-volley-u18-fem-${dirId}`,
        sportId: 'volleyball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-5-${dirId}`,
        team1Name: 'ثانوية الزيتون التأهيلية',
        team1SchoolName: 'ثانوية الزيتون التأهيلية',
        team2Id: `demo-sch-1-${dirId}`,
        team2Name: 'ثانوية الفتح التأهيلية',
        team2SchoolName: 'ثانوية الفتح التأهيلية',
        ageCategory: 'U18',
        gender: 'Female',
        date: getOffsetDate(-2),
        startTime: '10:30',
        endTime: '12:00',
        venueId: `demo-ven-3-${dirId}`,
        status: 'Completed',
        score1: 2,
        score2: 1,
        winnerId: `demo-sch-5-${dirId}`,
        referees: ['ذ. رشيد الداودي'],
        referee1Id: 'ذ. رشيد الداودي',
        notes: 'تتويج فتيات ثانوية الزيتون بلقب الكرة الطائرة إناث بالإقليم.',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      },
      // Volleyball U15 Mixed - Final (Completed)
      {
        id: `demo-mat-voll-5-${dirId}`,
        tournamentId: `demo-tourn-volley-u15-${dirId}`,
        sportId: 'volleyball',
        stage: 'المباراة النهائية',
        team1Id: `demo-sch-3-${dirId}`,
        team1Name: 'إعدادية ابن سينا',
        team1SchoolName: 'إعدادية ابن سينا',
        team2Id: `demo-sch-4-${dirId}`,
        team2Name: 'إعدادية سيدي لحسن',
        team2SchoolName: 'إعدادية سيدي لحسن',
        ageCategory: 'U15',
        gender: 'Mixed',
        date: getOffsetDate(-2),
        startTime: '14:00',
        endTime: '15:15',
        venueId: `demo-ven-3-${dirId}`,
        status: 'Completed',
        score1: 2,
        score2: 0,
        winnerId: `demo-sch-3-${dirId}`,
        referees: ['ذ. رشيد الداودي'],
        referee1Id: 'ذ. رشيد الداودي',
        notes: 'فوز إعدادية ابن سينا ببطولة الكرة الطائرة صغار (25-16، 25-19).',
        updatedAt: new Date().toISOString(),
        directorateId: dirId
      }
    ];

    // Save Matches
    try {
      const existingMatches = await DataService.getMatches();
      const existingMatchIds = new Set(existingMatches.map(m => m.id));
      const matchesToInsert = overwrite ? demoMatches : demoMatches.filter(m => !existingMatchIds.has(m.id));

      if (matchesToInsert.length > 0) {
        const updatedMatches = overwrite ? matchesToInsert : [...matchesToInsert, ...existingMatches];
        localStorage.setItem('taourirt_matches_data', JSON.stringify(updatedMatches));

        const mBatch = writeBatch(db);
        for (const m of matchesToInsert) {
          // If overwrite, we might need to delete old ones first, but setDoc handles update/insert
          mBatch.set(doc(db, 'matches', m.id), { ...m, updatedAt: serverTimestamp() });
        }
        await mBatch.commit();
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

    // -------------------------------------------------------------
    // 7. ATHLETICS DEMO RESULTS (نتائج ألعاب القوى)
    // -------------------------------------------------------------
    const demoAthleticsResults = [
      {
        id: 'u15_male_100m',
        category: 'U15',
        gender: 'Male' as const,
        specialtyName: 'سباق 100 متر (ذكور)',
        specialtyType: 'track' as const,
        venueName: 'الملعب البلدي تاوريرت',
        seasonId,
        directorateId: dirId,
        status: 'completed' as const,
        podium: [
          { rank: 1, fullName: 'ياسين الفيلالي', schoolName: 'إعدادية ابن سينا', performance: '11.85 ث', bibNumber: '112', affiliation: 'non_club' as const },
          { rank: 2, fullName: 'طارق الزياني', schoolName: 'إعدادية سيدي لحسن', performance: '12.10 ث', bibNumber: '114', affiliation: 'non_club' as const },
          { rank: 3, fullName: 'حمزة المراكشي', schoolName: 'ثانوية علال الفاسي التأهيلية', performance: '12.35 ث', bibNumber: '118', affiliation: 'club_affiliated' as const }
        ]
      },
      {
        id: 'u15_female_longjump',
        category: 'U15',
        gender: 'Female' as const,
        specialtyName: 'القفز الطولي (إناث)',
        specialtyType: 'field' as const,
        venueName: 'الملعب البلدي تاوريرت',
        seasonId,
        directorateId: dirId,
        status: 'completed' as const,
        podium: [
          { rank: 1, fullName: 'إيمان المنصوري', schoolName: 'إعدادية ابن سينا', performance: '4.85 م', bibNumber: '205', affiliation: 'non_club' as const },
          { rank: 2, fullName: 'زينب الشاوي', schoolName: 'إعدادية سيدي لحسن', performance: '4.62 م', bibNumber: '208', affiliation: 'non_club' as const },
          { rank: 3, fullName: 'أسماء البصري', schoolName: 'مجموعة مدارس دبدو الابتدائية', performance: '4.40 م', bibNumber: '211', affiliation: 'non_club' as const }
        ]
      },
      {
        id: 'u18_male_800m',
        category: 'U18',
        gender: 'Male' as const,
        specialtyName: 'سباق 800 متر (فتيان)',
        specialtyType: 'track' as const,
        venueName: 'الملعب البلدي تاوريرت',
        seasonId,
        directorateId: dirId,
        status: 'completed' as const,
        podium: [
          { rank: 1, fullName: 'أمين العلمي', schoolName: 'ثانوية الفتح التأهيلية', performance: '01:58.4', bibNumber: '304', affiliation: 'club_affiliated' as const },
          { rank: 2, fullName: 'وليد السوسي', schoolName: 'ثانوية الزيتون التأهيلية', performance: '02:01.2', bibNumber: '309', affiliation: 'non_club' as const },
          { rank: 3, fullName: 'مهدي الحساني', schoolName: 'ثانوية علال الفاسي التأهيلية', performance: '02:03.8', bibNumber: '315', affiliation: 'non_club' as const }
        ]
      },
      {
        id: 'u18_female_shotput',
        category: 'U18',
        gender: 'Female' as const,
        specialtyName: 'دفع الجلة 3 كغم (فتيات)',
        specialtyType: 'field' as const,
        venueName: 'الملعب البلدي تاوريرت',
        seasonId,
        directorateId: dirId,
        status: 'completed' as const,
        podium: [
          { rank: 1, fullName: 'خديجة العمراني', schoolName: 'ثانوية الفتح التأهيلية', performance: '11.45 م', bibNumber: '401', affiliation: 'non_club' as const },
          { rank: 2, fullName: 'سناء المتوكل', schoolName: 'ثانوية الزيتون التأهيلية', performance: '10.80 م', bibNumber: '406', affiliation: 'non_club' as const },
          { rank: 3, fullName: 'دعاء الصابر', schoolName: 'ثانوية علال الفاسي التأهيلية', performance: '10.15 م', bibNumber: '412', affiliation: 'club_affiliated' as const }
        ]
      }
    ];

    try {
      for (const aRes of demoAthleticsResults) {
        await DataService.saveAthleticsCategoryResult(aRes);
      }
    } catch (e) {
      console.warn('Error saving demo Athletics results:', e);
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
      localStorage.setItem('taourirt_tournaments_data', JSON.stringify(remainingTourns));
      
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
