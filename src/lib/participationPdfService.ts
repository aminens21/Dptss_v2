import { Student, School, User, Sport, Directorate } from '../types';
import { SPORTS_MAP, getAgeCategoriesForSeason, getCategoryGenderLabel, DataService } from './dataService';
import toast from 'react-hot-toast';

export interface ParticipationPdfOptions {
  sport: Sport | { id: string; name: string };
  schoolName: string;
  directorateName?: string;
  regionName?: string;
  season?: string;
  categoryLabel?: string;
  genderLabel?: string;
  teacher?: {
    fullName?: string;
    workLocation?: string;
    leaseNumber?: string;
    phone?: string;
    photoUrl?: string;
  };
  students: Student[];
  officialLogos?: {
    ministryLogo?: string;
    frmssLogo?: string;
    ministryLogoHeight?: number;
    frmssLogoHeight?: number;
  };
}

export function generateParticipationFormHtml(options: ParticipationPdfOptions): string {
  const {
    sport,
    schoolName,
    directorateName = 'المديرية الإقليمية بتاوريرت',
    regionName = 'الأكاديمية الجهوية للتربية والتكوين لجهة الشرق',
    season = '2025 – 2026',
    categoryLabel = 'جميع الفئات',
    genderLabel = 'ذكور وإناث',
    teacher = {},
    students,
    officialLogos
  } = options;

  const sportName = SPORTS_MAP[sport.id]?.name || sport.name || sport.id;

  // We want minimum 12 rows for official uniformity as shown in the template image
  const totalRowsCount = Math.max(12, students.length);
  const rows: (Student | null)[] = [];
  for (let i = 0; i < totalRowsCount; i++) {
    rows.push(students[i] || null);
  }

  const studentRowsHtml = rows.map((student, idx) => {
    const rowNum = idx + 1;
    if (student) {
      const bDate = student.birthDate || '';
      const massar = student.massarNumber || '—';
      const catLabel = getCategoryGenderLabel(student.category, student.gender, season, sport.id);
      const affiliationLabel = student.affiliationType === 'club_affiliated' 
        ? 'منتمي لنادي' 
        : 'لا منتمي';
      const photoHtml = student.photoUrl
        ? `<img src="${student.photoUrl}" style="width: 32px; height: 38px; object-fit: cover; border-radius: 3px; border: 1px solid #94a3b8; display: block; margin: 0 auto;" />`
        : `<div style="width: 32px; height: 38px; border: 1px dashed #cbd5e1; border-radius: 3px; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8;">صورة</div>`;

      return `
        <tr style="border-bottom: 1px solid #cbd5e1; height: 42px; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; text-align: center; font-size: 11px;">
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-weight: bold; width: 35px; color: #1e293b;">${rowNum}</td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-weight: bold; font-family: monospace; letter-spacing: 0.5px; color: #0369a1; width: 100px;">${massar}</td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 6px; font-weight: bold; text-align: center; color: #0f172a;">${student.fullName}</td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-family: monospace; color: #334155; width: 80px;">${bDate}</td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-weight: bold; color: #1e293b; width: 140px;">${catLabel}</td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-weight: bold; color: #475569; width: 95px;">${affiliationLabel}</td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 6px; text-align: center; color: #334155;">${student.schoolName || schoolName}</td>
          <td style="border: 1px solid #cbd5e1; padding: 2px; width: 45px;">
            ${photoHtml}
          </td>
        </tr>
      `;
    } else {
      return `
        <tr style="border-bottom: 1px solid #cbd5e1; height: 38px; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; text-align: center; font-size: 11px;">
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; font-weight: bold; color: #94a3b8; width: 35px;">${rowNum}</td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; width: 110px;"></td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 6px;"></td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; width: 85px;"></td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; width: 75px;"></td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 4px; width: 110px;"></td>
          <td style="border: 1px solid #cbd5e1; padding: 3px 6px;"></td>
          <td style="border: 1px solid #cbd5e1; padding: 2px; width: 45px;">
            <div style="width: 30px; height: 34px; border: 1px dashed #e2e8f0; border-radius: 3px; margin: 0 auto;"></div>
          </td>
        </tr>
      `;
    }
  }).join('');

  const teacherPhotoHtml = teacher.photoUrl
    ? `<img src="${teacher.photoUrl}" style="width: 44px; height: 52px; object-fit: cover; border-radius: 4px; border: 1px solid #64748b; display: block; margin: 0 auto;" />`
    : `<div style="width: 44px; height: 52px; border: 1px dashed #94a3b8; border-radius: 4px; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #64748b; line-height: 1.1; text-align: center;">صورة<br/>المؤطر</div>`;

  return `
    <div id="official-participation-form" dir="rtl" style="font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif; color: #0f172a; background-color: #ffffff; width: 100%; max-width: 800px; margin: 0 auto; padding: 20px 24px; box-sizing: border-box; line-height: 1.3;">
      
      <!-- Top Moroccan Official Header (Ministry in Center, FRMSS on Left and Right) -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 8px;">
        <tr>
          <td style="width: 25%; text-align: right; vertical-align: middle; padding-bottom: 8px;">
            ${officialLogos?.frmssLogo 
              ? `<img src="${officialLogos.frmssLogo}" alt="شعار الجامعة الملكية" style="height: ${Math.round((officialLogos.frmssLogoHeight || 60) * 0.9)}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 9px; font-weight: bold; color: #b45309; background: #fffbeb; padding: 4px 6px; border-radius: 6px; border: 1px solid #fde68a; display: inline-block;">الجامعة الملكية للرياضة المدرسية</div>`
            }
          </td>
          <td style="width: 50%; text-align: center; vertical-align: middle; padding-bottom: 8px;">
            ${officialLogos?.ministryLogo 
              ? `<img src="${officialLogos.ministryLogo}" alt="شعار الوزارة" style="height: ${Math.round((officialLogos.ministryLogoHeight || 80) * 0.9)}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 9px; font-weight: bold; color: #0369a1; background: #f0f9ff; padding: 4px 6px; border-radius: 6px; border: 1px solid #bae6fd; display: inline-block;">وزارة التربية الوطنية</div>`
            }
          </td>
          <td style="width: 25%; text-align: left; vertical-align: middle; padding-bottom: 8px;">
            ${officialLogos?.frmssLogo 
              ? `<img src="${officialLogos.frmssLogo}" alt="شعار الجامعة الملكية" style="height: ${Math.round((officialLogos.frmssLogoHeight || 60) * 0.9)}px; width: auto; object-fit: contain; display: inline-block;" />`
              : `<div style="font-size: 9px; font-weight: bold; color: #b45309; background: #fffbeb; padding: 4px 6px; border-radius: 6px; border: 1px solid #fde68a; display: inline-block;">الجامعة الملكية للرياضة المدرسية</div>`
            }
          </td>
        </tr>
      </table>

      <!-- Document Banner / Title -->
      <div style="border: 2px solid #0284c7; border-radius: 6px; background-color: #f0f9ff; text-align: center; padding: 10px; margin-bottom: 12px;">
        <h1 style="margin: 0; font-size: 15px; font-weight: 900; color: #0369a1; letter-spacing: 0.2px;">
          لائحة المشاركة في البطولة المدرسية برسم الموسم الدراسي: ${season}
        </h1>
      </div>

      <!-- Top Information Box: Sport, Category, School, Directorate -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; border: 1.5px solid #0284c7; border-radius: 4px; overflow: hidden; font-size: 11px;">
        <tr>
          <td style="width: 18%; background-color: #0284c7; color: #ffffff; font-weight: bold; padding: 6px 8px; text-align: right; border: 1px solid #0284c7;">
            النشاط الرياضي:
          </td>
          <td style="width: 32%; background-color: #ffffff; color: #0f172a; font-weight: 800; padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1;">
            ${sportName}
          </td>
          <td style="width: 20%; background-color: #0284c7; color: #ffffff; font-weight: bold; padding: 6px 8px; text-align: right; border: 1px solid #0284c7;">
            الفئة العمرية والجنس:
          </td>
          <td style="width: 30%; background-color: #ffffff; color: #0f172a; font-weight: 800; padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1;">
            ${categoryLabel} - ${genderLabel}
          </td>
        </tr>
        <tr>
          <td style="background-color: #0284c7; color: #ffffff; font-weight: bold; padding: 6px 8px; text-align: right; border: 1px solid #0284c7;">
            المؤسسة:
          </td>
          <td style="background-color: #ffffff; color: #0f172a; font-weight: 800; padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1;">
            ${schoolName}
          </td>
          <td style="background-color: #0284c7; color: #ffffff; font-weight: bold; padding: 6px 8px; text-align: right; border: 1px solid #0284c7;">
            المديرية الإقليمية:
          </td>
          <td style="background-color: #ffffff; color: #0f172a; font-weight: 800; padding: 6px 8px; text-align: right; border: 1px solid #cbd5e1;">
            ${directorateName}
          </td>
        </tr>
      </table>

      <!-- Teacher / Coach Supervisor Sub-Box -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border: 1.5px solid #0284c7; font-size: 11px;">
        <tr style="background-color: #0284c7; color: #ffffff; font-weight: bold; text-align: center;">
          <th style="padding: 5px 6px; border: 1px solid #0284c7; width: 28%;">الأستاذ(ة) المؤطر(ة)</th>
          <th style="padding: 5px 6px; border: 1px solid #0284c7; width: 25%;">مقر العمل</th>
          <th style="padding: 5px 6px; border: 1px solid #0284c7; width: 18%;">رقم التأجير (SOM)</th>
          <th style="padding: 5px 6px; border: 1px solid #0284c7; width: 17%;">رقم الهاتف</th>
          <th style="padding: 5px 6px; border: 1px solid #0284c7; width: 12%;">الصورة</th>
        </tr>
        <tr style="background-color: #ffffff; text-align: center; font-size: 11px;">
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: bold; color: #0f172a; text-align: center;">
            ${teacher.fullName || '—'}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 600; color: #334155; text-align: center;">
            ${teacher.workLocation || schoolName}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #0f172a;">
            ${teacher.leaseNumber || '—'}
          </td>
          <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-family: monospace; color: #0f172a;">
            ${teacher.phone || '—'}
          </td>
          <td style="padding: 4px; border: 1px solid #cbd5e1;">
            ${teacherPhotoHtml}
          </td>
        </tr>
      </table>

      <!-- Main Participants Table (Tableau des élèves) -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; border: 1.5px solid #0284c7;">
        <thead>
          <tr style="background-color: #0284c7; color: #ffffff; text-align: center; font-size: 11px; font-weight: 900;">
            <th style="border: 1px solid #0284c7; padding: 6px 4px; width: 35px;">ر.ت</th>
            <th style="border: 1px solid #0284c7; padding: 6px 4px; width: 100px;">رقم مسار</th>
            <th style="border: 1px solid #0284c7; padding: 6px 6px;">الاسم والنسب</th>
            <th style="border: 1px solid #0284c7; padding: 6px 4px; width: 80px;">تاريخ الازدياد</th>
            <th style="border: 1px solid #0284c7; padding: 6px 4px; width: 140px;">الفئة العمرية (التاريخ)</th>
            <th style="border: 1px solid #0284c7; padding: 6px 4px; width: 95px;">صنف المشاركة</th>
            <th style="border: 1px solid #0284c7; padding: 6px 6px;">المؤسسة</th>
            <th style="border: 1px solid #0284c7; padding: 6px 4px; width: 45px;">الصورة</th>
          </tr>
        </thead>
        <tbody>
          ${studentRowsHtml}
        </tbody>
      </table>

      <!-- Footer Stamp & Signature Areas -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; font-weight: bold; color: #1e293b;">
        <tr>
          <td style="width: 33%; text-align: center; vertical-align: top; padding: 8px;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 4px;">أستاذ(ة) مادة التربية البدنية المؤطر(ة)</div>
            <div style="font-size: 9.5px; color: #64748b;">(توقيع وخاتم الأستاذ)</div>
            <div style="height: 55px; border-bottom: 1px dashed #cbd5e1; margin-top: 4px;"></div>
          </td>
          <td style="width: 34%; text-align: center; vertical-align: top; padding: 8px;">
            <div style="font-weight: 800; color: #0f172a; margin-bottom: 4px;">رئيس(ة) المؤسسة التعليمية</div>
            <div style="font-size: 9.5px; color: #64748b;">(اسم وتوقيع وخاتم مدير المؤسسة)</div>
            <div style="height: 55px; border-bottom: 1px dashed #cbd5e1; margin-top: 4px;"></div>
          </td>
          <td style="width: 33%; text-align: center; vertical-align: top; padding: 8px;">
            <div style="font-weight: 800; color: #0369a1; margin-bottom: 4px;">المدير(ة) الإقليمي(ة) / رئيس فرع الجامعة</div>
            <div style="font-size: 9.5px; color: #64748b;">(اسم وتوقيع وخاتم رئيس الفرع الإقليمي)</div>
            <div style="height: 55px; border-bottom: 1px dashed #cbd5e1; margin-top: 4px;"></div>
          </td>
        </tr>
      </table>

      <div style="margin-top: 14px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px;">
        منظومة تدبير البطولات المدرسية • وثيقة رسمية معتمدة للمشاركة في المنافسات الإقليمية والجهوية للرياضة المدرسية
      </div>
    </div>
  `;
}

export function generateIndividualCardHtml(student: Student, sport: Sport | { id: string; name: string }, season: string, officialLogos?: any): string {
  const sportName = SPORTS_MAP[sport.id]?.name || sport.name || sport.id;
  const affiliationLabel = student.affiliationType === 'club_affiliated' ? 'منتمي لنادي / عصبة' : 'لا منتمي (مدرسي)';
  
  return `
    <div dir="rtl" style="font-family: 'Cairo', sans-serif; width: 100%; max-width: 400px; margin: 0 auto; border: 3px solid #0369a1; border-radius: 15px; padding: 15px; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1); position: relative; overflow: hidden;">
      <!-- Watermark/Background Decoration -->
      <div style="position: absolute; top: -20px; right: -20px; font-size: 150px; opacity: 0.03; pointer-events: none; transform: rotate(-15deg);">🏃</div>
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 15px;">
        <div style="text-align: right;">
          <div style="font-size: 10px; font-weight: 800; color: #64748b; margin-bottom: 2px;">وزارة التربية الوطنية والتعليم الأولي والرياضة</div>
          <div style="font-size: 12px; font-weight: 900; color: #0369a1;">بطاقة مشارك فردي - العدو الريفي</div>
        </div>
        ${officialLogos?.frmssLogo ? `<img src="${officialLogos.frmssLogo}" style="height: 31.5px;" />` : ''}
      </div>

      <!-- Main Body -->
      <div style="display: flex; gap: 15px;">
        <!-- Photo -->
        <div style="width: 100px; height: 120px; border: 2px solid #cbd5e1; border-radius: 10px; background: #f8fafc; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0;">
          ${student.photoUrl 
            ? `<img src="${student.photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" />`
            : `<span style="font-size: 40px; opacity: 0.2;">🏃‍♀️</span>`
          }
        </div>

        <!-- Details -->
        <div style="flex: 1; min-width: 0;">
          <div style="margin-bottom: 8px;">
            <div style="font-size: 9px; color: #64748b; font-weight: 700;">الاسم والنسب:</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a; line-height: 1.2;">${student.fullName}</div>
          </div>
          
          <div style="margin-bottom: 8px;">
            <div style="font-size: 9px; color: #64748b; font-weight: 700;">رقم مسار:</div>
            <div style="font-size: 13px; font-weight: 800; color: #0369a1; font-family: monospace;">${student.massarNumber || '—'}</div>
          </div>

          <div style="display: grid; grid-cols: 2 gap: 10px;">
            <div>
              <div style="font-size: 9px; color: #64748b; font-weight: 700;">الفئة:</div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${student.category}</div>
            </div>
            <div>
              <div style="font-size: 9px; color: #64748b; font-weight: 700;">الموسم:</div>
              <div style="font-size: 11px; font-weight: 800; color: #0f172a;">${season}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Additional Info -->
      <div style="margin-top: 15px; padding: 10px; background: #f0f9ff; border-radius: 10px; border: 1px solid #bae6fd;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
          <span style="font-size: 10px; font-weight: 700; color: #0369a1;">المؤسسة:</span>
          <span style="font-size: 10px; font-weight: 800; color: #0f172a;">${student.schoolName}</span>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span style="font-size: 10px; font-weight: 700; color: #0369a1;">الصفة:</span>
          <span style="font-size: 10px; font-weight: 900; color: #b45309;">${affiliationLabel}</span>
        </div>
      </div>

      <!-- Footer / Signature -->
      <div style="margin-top: 15px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div style="text-align: center; width: 45%;">
          <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-bottom: 25px;">خاتم وتوقيع المؤسسة</div>
          <div style="border-top: 1px dashed #cbd5e1; width: 80%; margin: 0 auto;"></div>
        </div>
        <div style="text-align: center; width: 45%;">
          <div style="font-size: 9px; font-weight: 700; color: #64748b; margin-bottom: 25px;">خاتم الفرع الإقليمي</div>
          <div style="border-top: 1px dashed #cbd5e1; width: 80%; margin: 0 auto;"></div>
        </div>
      </div>
      
      <div style="margin-top: 10px; text-align: center; font-size: 8px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 5px;">
        منظومة تدبير البطولات المدرسية - المديرية الإقليمية تاوريرت
      </div>
    </div>
  `;
}

export async function downloadIndividualCardPdf(student: Student, sport: Sport | { id: string; name: string }, season: string, filename?: string): Promise<void> {
  const logos = await DataService.getOfficialLogos();
  const htmlString = generateIndividualCardHtml(student, sport, season, logos);
  const finalFilename = filename || `بطاقة_مشارك_${student.fullName.replace(/\s+/g, '_')}.pdf`;

  return new Promise((resolve) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة لتحميل البطاقة');
      resolve();
      return;
    }

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${finalFilename}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
            @page { size: auto; margin: 5mm; }
            body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 20px; display: flex; justify-content: center; }
          </style>
        </head>
        <body>
          ${htmlString}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.focus();
                window.print();
                // Close after a delay in some browsers
                // window.close(); 
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    resolve();
  });
}

export async function downloadParticipationFormPdf(options: ParticipationPdfOptions, filename?: string): Promise<void> {
  const defaultFilename = `مطبوع_مشاركة_${options.schoolName || 'فريق'}_${options.sport.name || options.sport.id}.pdf`;
  const finalFilename = filename || defaultFilename;
  const htmlString = generateParticipationFormHtml(options);

  return new Promise((resolve) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // Fallback if popup blocked
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(`
          <html dir="rtl" lang="ar">
            <head>
              <title>${finalFilename}</title>
              <meta charset="utf-8" />
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                @page { size: A4 portrait; margin: 8mm; }
                body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                @media print { body { width: 100%; } }
              </style>
            </head>
            <body>
              ${htmlString}
              <script>
                window.onload = () => {
                  setTimeout(() => {
                    window.focus();
                    window.print();
                  }, 500);
                };
              </script>
            </body>
          </html>
        `);
        doc.close();
      }
      resolve();
      return;
    }

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>${finalFilename}</title>
          <meta charset="utf-8" />
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
            @page { size: A4 portrait; margin: 8mm; }
            body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            @media print { body { width: 100%; } }
          </style>
        </head>
        <body>
          ${htmlString}
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.focus();
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    resolve();
  });
}
