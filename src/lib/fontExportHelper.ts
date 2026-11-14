/**
 * Helper to ensure selected Google Fonts (and Aliases like Arabswell) are fully loaded
 * and embedded as inline Base64 data URIs inside @font-face rules when exporting
 * Certificates and Posters via html-to-image (PNG, PDF, Clipboard, Print).
 */

const GOOGLE_FONT_QUERIES: Record<string, string[]> = {
  'Arabswell': ['Aref+Ruqaa+Ink:wght@400;700', 'Aref+Ruqaa:wght@400;700'],
  'Cairo': ['Cairo:wght@400;600;700;800;900'],
  'Tajawal': ['Tajawal:wght@400;500;700;800;900'],
  'Amiri': ['Amiri:wght@400;700'],
  'Aref Ruqaa Ink': ['Aref+Ruqaa+Ink:wght@400;700', 'Aref+Ruqaa:wght@400;700'],
  'Aref Ruqaa': ['Aref+Ruqaa:wght@400;700'],
  'Changa': ['Changa:wght@400;600;700;800'],
  'Reem Kufi': ['Reem+Kufi:wght@400;600;700'],
  'El Messiri': ['El+Messiri:wght@400;600;700'],
  'Lalezar': ['Lalezar'],
  'Marhey': ['Marhey:wght@400;600;700'],
  'Rakkas': ['Rakkas'],
  'Alexandria': ['Alexandria:wght@400;600;700;800;900'],
  'Almarai': ['Almarai:wght@400;700;800'],
  'Readex Pro': ['Readex+Pro:wght@400;600;700'],
  'Noto Kufi Arabic': ['Noto+Kufi+Arabic:wght@400;600;700;800;900'],
  'Lateef': ['Lateef:wght@400;700'],
  'Scheherazade New': ['Scheherazade+New:wght@400;700'],
};

const embeddedCssCache = new Map<string, string>();

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function inlineFontUrlsInCss(cssText: string): Promise<string> {
  const urlMatches = Array.from(cssText.matchAll(/url\((['"]?)(https?:\/\/[^)'"]+)\1\)/g));
  if (urlMatches.length === 0) return cssText;

  const uniqueUrls = Array.from(new Set(urlMatches.map(m => m[2])));
  const replacements = new Map<string, string>();

  await Promise.all(
    uniqueUrls.map(async (url) => {
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (!res.ok) return;
        const contentType = res.headers.get('content-type') || (url.endsWith('.woff2') ? 'font/woff2' : 'font/ttf');
        const buf = await res.arrayBuffer();
        const b64 = arrayBufferToBase64(buf);
        replacements.set(url, `data:${contentType};base64,${b64}`);
      } catch {
        // Ignore single font chunk failure
      }
    })
  );

  let out = cssText;
  replacements.forEach((dataUri, origUrl) => {
    out = out.split(origUrl).join(dataUri);
  });
  return out;
}

/**
 * Ensures the browser has loaded the font faces and returns embedded @font-face CSS
 * ready to pass to html-to-image's `fontEmbedCSS` option.
 */
export async function prepareFontEmbedCss(fontId: string): Promise<string> {
  try {
    // 1. Trigger document.fonts.load so browser renders the preview glyphs before capture
    if (typeof document !== 'undefined' && document.fonts) {
      const targetFontNames =
        fontId === 'Arabswell'
          ? ['Aref Ruqaa Ink', 'Aref Ruqaa', 'Amiri']
          : [fontId];

      await Promise.all(
        targetFontNames.flatMap(name => [
          document.fonts.load(`400 24px "${name}"`).catch(() => []),
          document.fonts.load(`700 24px "${name}"`).catch(() => []),
          document.fonts.load(`800 24px "${name}"`).catch(() => []),
          document.fonts.load(`900 24px "${name}"`).catch(() => []),
        ])
      );
      await document.fonts.ready.catch(() => undefined);
    }

    // 2. Return cached CSS if already fetched & inlined
    const cached = embeddedCssCache.get(fontId);
    if (cached !== undefined) {
      return cached;
    }

    const families = GOOGLE_FONT_QUERIES[fontId] || [`${encodeURIComponent(fontId)}:wght@400;700`];
    const query = families.map(f => `family=${f}`).join('&');
    const googleCssUrl = `https://fonts.googleapis.com/css2?${query}&display=swap`;

    const res = await fetch(googleCssUrl, { mode: 'cors', credentials: 'omit' });
    if (!res.ok) {
      return '';
    }

    const rawCss = await res.text();
    let inlinedCss = await inlineFontUrlsInCss(rawCss);

    // If user picked Arabswell, alias Aref Ruqaa Ink / Aref Ruqaa blocks to 'Arabswell'
    // so both SVG <foreignObject> and strict fontFamily resolution pick it cleanly.
    if (fontId === 'Arabswell' && inlinedCss) {
      const aliasedBlocks = inlinedCss
        .replace(/font-family:\s*['"]?Aref Ruqaa Ink['"]?/g, "font-family: 'Arabswell'")
        .replace(/font-family:\s*['"]?Aref Ruqaa['"]?/g, "font-family: 'Arabswell'");
      inlinedCss = `${inlinedCss}\n${aliasedBlocks}`;
    }

    embeddedCssCache.set(fontId, inlinedCss);
    return inlinedCss;
  } catch (err) {
    console.warn('prepareFontEmbedCss fallback:', err);
    return '';
  }
}
