import { CSS_FAMILY, type FontFamily } from "./fonts";

/**
 * Единая раскладка многострочного текста — одинаковая в редакторе (canvas)
 * и при экспорте (pdf-lib), чтобы «что видишь, то и получишь».
 * Метрики (ascent/descent в долях em) взяты из таблиц hhea наших TTF.
 */
export const FONT_METRICS: Record<FontFamily, { ascent: number; descent: number }> = {
  sans: { ascent: 1.018, descent: 0.276 },
  serif: { ascent: 1.039, descent: 0.286 },
  mono: { ascent: 0.885, descent: 0.235 },
};

export interface TextStyle {
  family: FontFamily;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  lineHeight: number;
  align: "left" | "center" | "right";
}

export const splitLines = (text: string) => text.split(/\r?\n/);

export const lineHeightPt = (s: TextStyle) => s.fontSize * s.lineHeight;

/** Расстояние от верха текстового блока до базовой линии строки i. */
export function baselineOffset(s: TextStyle, i: number): number {
  const lh = lineHeightPt(s);
  const { ascent, descent } = FONT_METRICS[s.family];
  return i * lh + (lh + (ascent - descent) * s.fontSize) / 2;
}

export function alignOffset(align: TextStyle["align"], boxWidth: number, lineWidth: number): number {
  if (align === "center") return (boxWidth - lineWidth) / 2;
  if (align === "right") return boxWidth - lineWidth;
  return 0;
}

/** Размер блока по ширинам строк. */
export function measureBlock(
  text: string,
  s: TextStyle,
  measureLine: (line: string) => number,
): { w: number; h: number; lineWidths: number[] } {
  const lines = splitLines(text);
  const lineWidths = lines.map((l) => measureLine(l));
  const w = Math.max(s.fontSize * 0.3, ...lineWidths);
  return { w, h: lines.length * lineHeightPt(s), lineWidths };
}

/** CSS-шрифт для canvas/HTML (px = PDF-точки при масштабе 1). */
export function cssFont(s: Pick<TextStyle, "family" | "bold" | "italic" | "fontSize">, scale = 1): string {
  const weight = s.bold && s.family !== "mono" ? 700 : 400;
  const style = s.italic && s.family !== "mono" ? "italic " : "";
  return `${style}${weight} ${s.fontSize * scale}px "${CSS_FAMILY[s.family]}"`;
}

let measureCtx: CanvasRenderingContext2D | null = null;

/** Ширина строки в PDF-точках (только в браузере). */
export function measureLineBrowser(line: string, s: TextStyle): number {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d")!;
  }
  // Меряем на крупном кегле для точности, потом масштабируем
  const probe = 100;
  measureCtx.font = cssFont({ ...s, fontSize: probe });
  if ("fontKerning" in measureCtx) measureCtx.fontKerning = "none";
  return (measureCtx.measureText(line).width * s.fontSize) / probe;
}

export function measureTextBrowser(text: string, s: TextStyle) {
  return measureBlock(text, s, (l) => measureLineBrowser(l, s));
}
