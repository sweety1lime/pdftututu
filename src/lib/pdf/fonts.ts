import type { PDFDocument, PDFFont } from "@cantoo/pdf-lib";

/**
 * Шрифты с кириллицей. Стандартные 14 шрифтов PDF (Helvetica и т.п.) кириллицу
 * не умеют, поэтому всё, что мы пишем в PDF, идёт через встроенные TTF.
 * Те же файлы подключены в CSS (globals.css), чтобы в редакторе было «как в файле».
 */
export type FontFamily = "sans" | "serif" | "mono";

export interface FontVariant {
  family: FontFamily;
  bold?: boolean;
  italic?: boolean;
}

const FILES: Record<FontFamily, [regular: string, bold: string, italic: string, boldItalic: string]> = {
  sans: ["PT_Sans-Web-Regular.ttf", "PT_Sans-Web-Bold.ttf", "PT_Sans-Web-Italic.ttf", "PT_Sans-Web-BoldItalic.ttf"],
  serif: ["PT_Serif-Web-Regular.ttf", "PT_Serif-Web-Bold.ttf", "PT_Serif-Web-Italic.ttf", "PT_Serif-Web-BoldItalic.ttf"],
  // У PT Mono есть только обычное начертание
  mono: ["PTM55FT.ttf", "PTM55FT.ttf", "PTM55FT.ttf", "PTM55FT.ttf"],
};

/** Имя семейства в CSS (@font-face в globals.css). */
export const CSS_FAMILY: Record<FontFamily, string> = {
  sans: "PDF Sans",
  serif: "PDF Serif",
  mono: "PDF Mono",
};

export function fontFile({ family, bold, italic }: FontVariant): string {
  const idx = (bold ? 1 : 0) + (italic ? 2 : 0);
  return FILES[family][idx];
}

/** Базовый URL для шрифтов; в тестах (Node) подменяется на путь к файлам. */
let fontLoader: (file: string) => Promise<Uint8Array> = async (file) => {
  const res = await fetch(`/fonts/${file}`);
  if (!res.ok) throw new Error(`Font ${file}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
};

export function setFontLoader(loader: (file: string) => Promise<Uint8Array>) {
  fontLoader = loader;
  bytesCache.clear();
}

const bytesCache = new Map<string, Promise<Uint8Array>>();

export function loadFontBytes(file: string): Promise<Uint8Array> {
  let p = bytesCache.get(file);
  if (!p) {
    p = fontLoader(file);
    p.catch(() => bytesCache.delete(file));
    bytesCache.set(file, p);
  }
  return p;
}

const docFonts = new WeakMap<PDFDocument, Map<string, Promise<PDFFont>>>();

// fontkit (~370 КБ) нужен только для встраивания шрифта — грузим его в этот момент,
// а не вместе со страницей, которой хватает имён шрифтов и их файлов
let fontkitPromise: Promise<typeof import("@cantoo/fontkit").default> | null = null;
const getFontkit = () => (fontkitPromise ??= import("@cantoo/fontkit").then((m) => m.default));

/** Встроить шрифт в документ (один раз на документ, подмножество глифов). */
export function embedFont(doc: PDFDocument, variant: FontVariant): Promise<PDFFont> {
  let map = docFonts.get(doc);
  if (!map) {
    map = new Map();
    docFonts.set(doc, map);
  }
  const file = fontFile(variant);
  let p = map.get(file);
  if (!p) {
    p = Promise.all([getFontkit(), loadFontBytes(file)]).then(([fontkit, bytes]) => {
      doc.registerFontkit(fontkit);
      return doc.embedFont(bytes, { subset: true });
    });
    map.set(file, p);
  }
  return p;
}

/** Грубое определение семейства по имени шрифта из PDF. */
export function guessFamily(fontName: string, cssFallback?: string): FontVariant {
  const n = `${fontName} ${cssFallback ?? ""}`.toLowerCase();
  const family: FontFamily = /mono|courier|consol|menlo|typewriter/.test(n)
    ? "mono"
    : /serif|times|georgia|garamond|cambria|roman|book|minion|pt serif/.test(n) && !/sans/.test(n)
      ? "serif"
      : "sans";
  return {
    family,
    bold: /bold|black|heavy|semibold|demi|,b\b/.test(n),
    italic: /italic|oblique|,i\b/.test(n),
  };
}
