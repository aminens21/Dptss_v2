import QRCode from 'qrcode';
import { BibRunnerData } from '../components/BibGeneratorModal';
import { CrossCountryCategoryDef, CROSS_COUNTRY_CATEGORIES } from './crossCountryConfig';

export interface BibPrintHtmlOptions {
  runners: BibRunnerData[];
  bibsPerPage: 1 | 2 | 6;
  bibBgColor?: string;
  bibFont?: 'mono' | 'sans' | 'serif';
  qrScale?: number;
  bibNumberScale?: number;
  textScale?: number;
  separatePagesPerRace?: boolean;
  selectedRaces?: string[];
  filename?: string;
}

/**
 * Pre-generate QR code data URLs asynchronously and quickly in memory
 */
export async function pregenerateQrsForBibs(runners: BibRunnerData[]): Promise<Record<string, string>> {
  const qrMap: Record<string, string> = {};
  await Promise.all(
    runners.map(async (runner) => {
      const payload = String(runner.bibNumber || runner.id || '').trim();
      try {
        qrMap[runner.id] = await QRCode.toDataURL(payload, {
          width: 280,
          margin: 1,
          color: { dark: '#000000', light: '#ffffff' },
          errorCorrectionLevel: 'M'
        });
      } catch (e) {
        console.error('Failed to generate QR for runner', runner.id, e);
      }
    })
  );
  return qrMap;
}

/**
 * Builds ultra-fast, vector/text-native printable HTML for bibs.
 * Texts and numbers are pure selectable, scalable CSS/HTML typography.
 * Only the QR code itself is a lightweight SVG/PNG.
 * Generation happens in milliseconds with 0 MB bloat.
 */
export function generateBibsPrintHtml(
  options: BibPrintHtmlOptions,
  qrMap: Record<string, string>
): string {
  const {
    runners,
    bibsPerPage,
    bibBgColor = '#ffffff',
    bibFont = 'mono',
    qrScale = 1.0,
    bibNumberScale = 1.0,
    textScale = 1.0,
    separatePagesPerRace = false,
    selectedRaces = []
  } = options;

  // Determine font families
  const fontFamilyCss =
    bibFont === 'mono'
      ? "'Courier New', Courier, monospace"
      : bibFont === 'serif'
      ? "Georgia, 'Times New Roman', serif"
      : "'Cairo', system-ui, -apple-system, sans-serif";

  const fontHeavyWeight = bibFont === 'sans' ? '900' : 'bold';

  // Group runners by race if separatePagesPerRace is true
  const activeDefs = CROSS_COUNTRY_CATEGORIES.filter(c => selectedRaces.includes(c.id));
  const raceGroups: { catDef: CrossCountryCategoryDef; runners: BibRunnerData[] }[] = [];

  if (separatePagesPerRace && activeDefs.length > 1) {
    activeDefs.forEach(catDef => {
      const rList = runners.filter(r =>
        r.category === catDef.id ||
        (r.categoryLabel.includes(catDef.titleAr.replace('سباق ', '')) && r.gender === catDef.gender) ||
        (r.category.toUpperCase() === catDef.category.toUpperCase() && r.gender.toLowerCase() === catDef.gender.toLowerCase())
      );
      if (rList.length > 0) {
        raceGroups.push({ catDef, runners: rList });
      }
    });
  } else {
    raceGroups.push({
      catDef: activeDefs[0] || CROSS_COUNTRY_CATEGORIES[0],
      runners
    });
  }

  // Pre-chunk into pages
  const pages: { groupTitle?: string; runnersOnPage: BibRunnerData[] }[] = [];
  for (const group of raceGroups) {
    const groupRunners = group.runners;
    const totalPages = Math.ceil(groupRunners.length / bibsPerPage);
    for (let p = 0; p < totalPages; p++) {
      pages.push({
        groupTitle: group.catDef?.titleAr,
        runnersOnPage: groupRunners.slice(p * bibsPerPage, (p + 1) * bibsPerPage)
      });
    }
  }

  // Render individual bib card HTML
  const renderBibCardHtml = (runner: BibRunnerData, layout: 1 | 2 | 6) => {
    const qrUrl = qrMap[runner.id] || '';
    const is6 = layout === 6;
    const is2 = layout === 2;

    const qrSizeMm = Math.round((is6 ? 24 : is2 ? 38 : 55) * qrScale);
    // Extra-large bib number sizes to make numbers huge and clearly legible from a distance
    const bibNumPt = Math.round((is6 ? 84 : is2 ? 140 : 220) * bibNumberScale);
    const textPt = (is6 ? 8 : is2 ? 10.5 : 14) * textScale;
    const textSmallPt = (is6 ? 7 : is2 ? 9.5 : 12) * textScale;

    const rowCount = is6 ? 3 : 4;
    const borderThickness = is6 ? '2px' : '3px';

    return `
      <div class="bib-card ${is6 ? 'bib-card-6' : is2 ? 'bib-card-2' : 'bib-card-1'}" style="background-color: ${bibBgColor}; border-width: ${borderThickness};">
        <!-- Top Info Header (3 Columns) -->
        <div class="bib-top-header" style="border-bottom-width: ${borderThickness};">
          
          <!-- Column 1 (Left): Category, Birth, Gender, Commune -->
          <div class="bib-col bib-col-left" style="border-left-width: ${borderThickness};">
            <div class="bib-cell" style="font-size: ${textPt}pt; font-weight: 800;">${runner.categoryLabel || ''}</div>
            <div class="bib-cell font-mono" style="font-size: ${textPt}pt; font-weight: 700;">${runner.isBlankSlot ? '' : (runner.birthDate || runner.birthYear || '')}</div>
            <div class="bib-cell" style="font-size: ${textPt}pt; font-weight: 800;">${runner.isBlankSlot ? '' : (runner.genderLabel || '')}</div>
            ${rowCount === 4 ? `<div class="bib-cell" style="font-size: ${textSmallPt}pt; font-weight: 700;">${runner.isBlankSlot ? '' : (runner.commune || runner.directorateName || '')}</div>` : ''}
          </div>

          <!-- Column 2 (Center): QR Code -->
          <div class="bib-col bib-col-center">
            ${qrUrl ? `<img src="${qrUrl}" alt="QR" style="width: ${qrSizeMm}mm; height: ${qrSizeMm}mm; max-width: 95%; max-height: 95%; object-fit: contain;" />` : ''}
          </div>

          <!-- Column 3 (Right): Full Name, Massar, School, Directorate -->
          <div class="bib-col bib-col-right" style="border-right-width: ${borderThickness};">
            <div class="bib-cell" style="font-size: ${textPt}pt; font-weight: 800;">${runner.isBlankSlot ? '' : (runner.fullName || '')}</div>
            <div class="bib-cell font-mono" style="font-size: ${textPt}pt; font-weight: 700;">${runner.isBlankSlot ? '' : (runner.massarNumber || '')}</div>
            <div class="bib-cell" style="font-size: ${textSmallPt}pt; font-weight: 700;">${runner.isBlankSlot ? '' : (runner.schoolName || '')}</div>
            ${rowCount === 4 ? `<div class="bib-cell" style="font-size: ${textSmallPt}pt; font-weight: 700;">${runner.isBlankSlot ? '' : (runner.affiliationTypeLabel || runner.directorateName || '')}</div>` : ''}
          </div>

        </div>

        <!-- Bottom Large Bib Number (Pure Vector / Typography) -->
        <div class="bib-bottom-number">
          <span class="bib-number-text" style="font-family: ${fontFamilyCss}; font-size: ${bibNumPt}pt; font-weight: ${fontHeavyWeight};">
            ${runner.bibNumber}
          </span>
        </div>
      </div>
    `;
  };

  const pagesHtml = pages.map((page, pIdx) => {
    let pageContent = '';

    if (bibsPerPage === 6) {
      pageContent = `
        <div class="sheet-grid-6">
          ${page.runnersOnPage.map(r => renderBibCardHtml(r, 6)).join('')}
        </div>
      `;
    } else if (bibsPerPage === 2) {
      pageContent = `
        <div class="sheet-grid-2">
          ${page.runnersOnPage.map((r, idx) => `
            ${renderBibCardHtml(r, 2)}
            ${idx === 0 && page.runnersOnPage.length > 1 ? '<div class="cut-line-horizontal"></div>' : ''}
          `).join('')}
        </div>
      `;
    } else {
      pageContent = `
        <div class="sheet-grid-1">
          ${page.runnersOnPage.map(r => renderBibCardHtml(r, 1)).join('')}
        </div>
      `;
    }

    return `
      <div class="print-page ${pIdx > 0 ? 'page-break-before' : ''}">
        ${pageContent}
      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>${options.filename || 'صدريات_العدو_الريفي'}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

        @page {
          size: A4 portrait;
          margin: 6mm;
        }

        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }

        body {
          margin: 0;
          padding: 0;
          font-family: 'Cairo', system-ui, -apple-system, sans-serif;
          background: #ffffff;
          color: #000000;
          direction: rtl;
        }

        .print-page {
          width: 100%;
          min-height: 280mm;
          position: relative;
          box-sizing: border-box;
        }

        .page-break-before {
          page-break-before: always;
          break-before: page;
        }

        /* 1 Bib per page */
        .sheet-grid-1 {
          display: flex;
          flex-direction: column;
          height: 280mm;
          padding: 2mm;
        }

        /* 2 Bibs per page (A5) */
        .sheet-grid-2 {
          display: flex;
          flex-direction: column;
          height: 280mm;
          justify-content: space-between;
          position: relative;
        }

        .cut-line-horizontal {
          border-top: 1px dashed #94a3b8;
          width: 100%;
          margin: 2mm 0;
        }

        /* 6 Bibs per page (2x3) */
        .sheet-grid-6 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: 1fr 1fr 1fr;
          gap: 4mm;
          height: 280mm;
        }

        /* Common Bib Card Styles */
        .bib-card {
          border-style: solid;
          border-color: #000000;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: #ffffff;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .bib-card-1 {
          height: 275mm;
        }

        .bib-card-2 {
          height: 136mm;
        }

        .bib-card-6 {
          height: 89mm;
        }

        /* Top 3-Columns Table Header */
        .bib-top-header {
          display: flex;
          width: 100%;
          border-bottom-style: solid;
          border-bottom-color: #000000;
          background: inherit;
        }

        .bib-card-1 .bib-top-header {
          height: 95mm;
        }

        .bib-card-2 .bib-top-header {
          height: 52mm;
        }

        .bib-card-6 .bib-top-header {
          height: 38mm;
        }

        .bib-col {
          display: flex;
          flex-direction: column;
          justify-content: space-around;
          text-align: center;
          background: inherit;
          box-sizing: border-box;
        }

        .bib-col-left, .bib-col-right {
          width: 33.333%;
          border-color: #000000;
          border-style: solid;
          border-top: none;
          border-bottom: none;
        }

        .bib-col-left {
          border-right: none;
        }

        .bib-col-right {
          border-left: none;
        }

        .bib-col-center {
          width: 33.334%;
          align-items: center;
          justify-content: center;
          padding: 2px;
          background: #ffffff;
        }

        .bib-cell {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1px 3px;
          border-bottom: 1px solid #000000;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.15;
        }

        .bib-cell:last-child {
          border-bottom: none;
        }

        .font-mono {
          font-family: 'Courier New', Courier, monospace;
        }

        /* Bottom Large Number Section (Unconstrained for maximum visual prominence) */
        .bib-bottom-number {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: inherit;
          overflow: visible;
          padding: 0;
          text-align: center;
        }

        .bib-number-text {
          line-height: 0.88;
          letter-spacing: -0.04em;
          color: #000000;
          white-space: nowrap;
          font-weight: 900 !important;
          transform: scaleY(1.05);
        }
      </style>
    </head>
    <body>
      ${pagesHtml}
    </body>
    </html>
  `;
}

/**
 * Downloads or prints the bibs using native browser high-speed typography engine.
 * Generates in less than half a second even for hundreds of runners!
 * Uses a pre-opened popup window when allowed, and seamlessly falls back to a
 * layout-intact off-screen iframe when popups are blocked (never throws a popup error).
 */
export async function printBibsAsNativeText(
  options: BibPrintHtmlOptions,
  cachedQrs?: Record<string, string>,
  existingPrintWindow?: Window | null
): Promise<void> {
  const qrMap = cachedQrs && Object.keys(cachedQrs).length > 0
    ? cachedQrs
    : await pregenerateQrsForBibs(options.runners);

  const html = generateBibsPrintHtml(options, qrMap);

  let printWindow: Window | null = existingPrintWindow || null;
  if (!printWindow) {
    try {
      printWindow = window.open('', '_blank', 'width=1150,height=850');
    } catch {
      printWindow = null;
    }
  }

  const triggerPrintOnDocWindow = (targetWin: Window, onDone?: () => void) => {
    const runPrint = () => {
      try {
        targetWin.focus();
        targetWin.print();
      } catch (e) {
        console.error('Print failed:', e);
      }
      if (onDone) onDone();
    };

    const doc = targetWin.document;
    const fontsReady = doc?.fonts?.ready
      ? Promise.race([doc.fonts.ready, new Promise(res => setTimeout(res, 500))])
      : Promise.resolve();

    fontsReady.then(() => {
      setTimeout(runPrint, 250);
    });
  };

  if (printWindow && !printWindow.closed) {
    try {
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();

      return await new Promise((resolve) => {
        triggerPrintOnDocWindow(printWindow!, () => resolve());
      });
    } catch {
      // Fall through to off-screen iframe fallback if cross-origin/closed
    }
  }

  // Fallback when popups are blocked or inside restricted iframes:
  // Use a layout-intact (A4-sized) off-screen iframe so browsers never render blank 0x0 pages.
  const existingFrame = document.getElementById('cc-bib-print-iframe');
  if (existingFrame && existingFrame.parentNode) {
    existingFrame.parentNode.removeChild(existingFrame);
  }

  const printFrame = document.createElement('iframe');
  printFrame.id = 'cc-bib-print-iframe';
  printFrame.setAttribute('aria-hidden', 'true');
  printFrame.style.position = 'fixed';
  printFrame.style.left = '-10000px';
  printFrame.style.top = '0';
  printFrame.style.width = '210mm';
  printFrame.style.height = '297mm';
  printFrame.style.border = 'none';
  printFrame.style.opacity = '0';
  printFrame.style.pointerEvents = 'none';
  document.body.appendChild(printFrame);

  const frameWin = printFrame.contentWindow;
  const frameDoc = frameWin?.document;
  if (!frameWin || !frameDoc) {
    throw new Error('تعذر تهيئة إطار الطباعة في المتصفح');
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  return new Promise((resolve) => {
    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      if (printFrame.parentNode) {
        printFrame.parentNode.removeChild(printFrame);
      }
    };

    try {
      frameWin.addEventListener('afterprint', cleanup, { once: true });
    } catch {}
    setTimeout(cleanup, 60000);

    triggerPrintOnDocWindow(frameWin, () => resolve());
  });
}
