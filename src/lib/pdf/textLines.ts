"use client";

import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "pdfjs-dist/types/src/display/api";
import { guessFamily, type FontVariant } from "@/lib/pdf/fonts";
import { getPdfjs } from "@/lib/pdf/pdfjs";
import { toHex } from "@/lib/pdf/color";

/** Строка существующего текста на странице (координаты вида, PDF-точки). */
export interface TextLine {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  baseline: number;
  fontSize: number;
  text: string;
  variant: FontVariant;
}

const cache = new WeakMap<PDFDocumentProxy, Map<number, Promise<TextLine[]>>>();

export function getTextLines(pdf: PDFDocumentProxy, pageIndex: number): Promise<TextLine[]> {
  let map = cache.get(pdf);
  if (!map) cache.set(pdf, (map = new Map()));
  let p = map.get(pageIndex);
  if (!p) {
    p = extract(pdf, pageIndex);
    map.set(pageIndex, p);
  }
  return p;
}

/** Кусок текста из pdf.js: слово или фрагмент строки (координаты вида). */
export interface Piece {
  x: number;
  right: number;
  baseline: number;
  top: number;
  bottom: number;
  fontSize: number;
  text: string;
  fontName: string;
}

function realFontName(page: PDFPageProxy, fontName: string, fallback: string): string {
  try {
    const objs = page.commonObjs as unknown as { has(id: string): boolean; get(id: string): { name?: string } };
    if (objs.has(fontName)) return `${objs.get(fontName)?.name ?? ""} ${fallback}`;
  } catch {
    /* шрифт ещё не загружен */
  }
  return fallback;
}

async function extract(pdf: PDFDocumentProxy, pageIndex: number): Promise<TextLine[]> {
  const pdfjs = await getPdfjs();
  const page = await pdf.getPage(pageIndex + 1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  const pieces: Piece[] = [];
  for (const raw of content.items) {
    const item = raw as TextItem;
    if (!("str" in item) || !item.str || !item.str.trim()) continue;
    const m = pdfjs.Util.transform(viewport.transform, item.transform) as number[];
    // Только горизонтальный (для зрителя) текст
    if (Math.abs(m[1]) > 0.01 * Math.abs(m[0]) || Math.abs(m[2]) > 0.01 * Math.abs(m[3]) || m[0] <= 0) continue;
    const fontSize = Math.abs(m[3]);
    if (fontSize < 2) continue;
    const style = content.styles[item.fontName] as { ascent?: number; descent?: number; fontFamily?: string } | undefined;
    const ascent = style?.ascent || 0.85;
    const descent = style?.descent || -0.22;
    pieces.push({
      x: m[4],
      right: m[4] + item.width,
      baseline: m[5],
      top: m[5] - ascent * fontSize,
      bottom: m[5] - descent * fontSize,
      fontSize,
      text: item.str,
      fontName: realFontName(page, item.fontName, style?.fontFamily ?? ""),
    });
  }

  return groupPieces(pieces).map((parts, i) => {
    const text = joinPieces(parts);
    const x = Math.min(...parts.map((p) => p.x));
    const right = Math.max(...parts.map((p) => p.right));
    const top = Math.min(...parts.map((p) => p.top));
    const bottom = Math.max(...parts.map((p) => p.bottom));
    // Основной шрифт строки — самый частый по длине текста
    const main = parts.reduce((a, b) => (b.text.length > a.text.length ? b : a));
    return {
      key: `${pageIndex}-${i}`,
      x,
      y: top,
      w: right - x,
      h: bottom - top,
      baseline: parts[0].baseline,
      fontSize: main.fontSize,
      text: text.trim(),
      variant: guessFamily(main.fontName),
    };
  });
}

/**
 * Собрать куски в строки. Базовые линии слов на одной строке могут чуть
 * отличаться (особенно у распознанного OCR текста), поэтому сначала находим
 * строку с допуском по высоте, а порядок слов внутри неё — по x.
 */
export function groupPieces(pieces: Piece[]): Piece[][] {
  const lines: Piece[][] = [];
  for (const p of [...pieces].sort((a, b) => a.baseline - b.baseline || a.x - b.x)) {
    const line = lines.find((l) => {
      const ref = l[0];
      const sameBaseline = Math.abs(ref.baseline - p.baseline) < ref.fontSize * 0.3;
      const similarSize = Math.max(ref.fontSize, p.fontSize) / Math.min(ref.fontSize, p.fontSize) < 1.35;
      // Расстояние до строки слева или справа (отрицательное — перекрываются)
      const left = Math.min(...l.map((q) => q.x));
      const right = Math.max(...l.map((q) => q.right));
      const gap = p.x >= right ? p.x - right : p.right <= left ? left - p.right : -Math.min(p.right - left, right - p.x);
      return sameBaseline && similarSize && gap > -ref.fontSize * 0.5 && gap < ref.fontSize * 1.5;
    });
    if (line) line.push(p);
    else lines.push([p]);
  }
  for (const line of lines) line.sort((a, b) => a.x - b.x);
  return lines;
}

/** Текст строки: пробел там, где между кусками есть заметный промежуток. */
export function joinPieces(parts: Piece[]): string {
  let text = "";
  for (let k = 0; k < parts.length; k++) {
    const p = parts[k];
    if (k > 0) {
      const gap = p.x - parts[k - 1].right;
      if (gap > p.fontSize * 0.2 && !text.endsWith(" ") && !p.text.startsWith(" ")) text += " ";
    }
    text += p.text;
  }
  return text;
}

/**
 * Цвет фона вокруг прямоугольника и цвет текста внутри — по пикселям
 * отрисованной страницы. scale — пикселей canvas на одну PDF-точку.
 */
export function sampleColors(
  canvas: HTMLCanvasElement,
  rect: { x: number; y: number; w: number; h: number },
  scale: number,
): { background: string; text: string } {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return { background: "#ffffff", text: "#000000" };
  const pad = 2;
  const x0 = Math.max(0, Math.floor(rect.x * scale) - pad);
  const y0 = Math.max(0, Math.floor(rect.y * scale) - pad);
  const x1 = Math.min(canvas.width, Math.ceil((rect.x + rect.w) * scale) + pad);
  const y1 = Math.min(canvas.height, Math.ceil((rect.y + rect.h) * scale) + pad);
  const w = x1 - x0;
  const h = y1 - y0;
  if (w <= 0 || h <= 0) return { background: "#ffffff", text: "#000000" };
  const { data } = ctx.getImageData(x0, y0, w, h);
  const px = (x: number, y: number) => {
    const o = (y * w + x) * 4;
    return [data[o], data[o + 1], data[o + 2]] as const;
  };

  // Фон — самый частый цвет по краю области
  const counts = new Map<number, { n: number; rgb: readonly [number, number, number] }>();
  const edge = (x: number, y: number) => {
    const c = px(x, y);
    const k = ((c[0] >> 3) << 10) | ((c[1] >> 3) << 5) | (c[2] >> 3);
    const e = counts.get(k);
    if (e) e.n++;
    else counts.set(k, { n: 1, rgb: c });
  };
  for (let x = 0; x < w; x++) {
    edge(x, 0);
    edge(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    edge(0, y);
    edge(w - 1, y);
  }
  const bg = [...counts.values()].sort((a, b) => b.n - a.n)[0]?.rgb ?? [255, 255, 255];

  // Текст — пиксели, сильнее всего отличающиеся от фона
  const far: Array<{ d: number; c: readonly [number, number, number] }> = [];
  for (let y = pad; y < h - pad; y++) {
    for (let x = pad; x < w - pad; x++) {
      const c = px(x, y);
      const d = Math.abs(c[0] - bg[0]) + Math.abs(c[1] - bg[1]) + Math.abs(c[2] - bg[2]);
      if (d > 90) far.push({ d, c });
    }
  }
  let text = "#000000";
  if (far.length) {
    far.sort((a, b) => b.d - a.d);
    const top = far.slice(0, Math.max(1, Math.ceil(far.length * 0.25)));
    const avg = [0, 1, 2].map((i) => top.reduce((s, p) => s + p.c[i], 0) / top.length);
    text = toHex(avg[0], avg[1], avg[2]);
  }
  return { background: toHex(bg[0], bg[1], bg[2]), text };
}
