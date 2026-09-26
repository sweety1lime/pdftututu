/**
 * «Нанести что-то на страницы»: номера страниц, водяные знаки.
 * Всё рисуется в координатах вида (как видит пользователь), поэтому
 * повёрнутые страницы и страницы со смещённым CropBox обрабатываются правильно.
 */
import { concatTransformationMatrix, popGraphicsState, pushGraphicsState, type PDFPage } from "@cantoo/pdf-lib";
import { hexToRgb } from "./color";
import { objectMatrix, viewSize, type PageGeometry } from "./coords";
import { embedFont, type FontFamily } from "./fonts";
import { loadForEdit } from "./load";

/** Геометрия страницы pdf-lib в терминах coords.ts. */
export function pageGeometry(page: PDFPage): PageGeometry {
  const { x, y, width, height } = page.getCropBox();
  return { box: [x, y, x + width, y + height], rotation: page.getRotation().angle };
}

/**
 * Рисовать в прямоугольнике вида: внутри draw начало координат — левый нижний
 * угол прямоугольника, ось Y вверх (как привычно pdf-lib).
 */
export function drawInView(
  page: PDFPage,
  rect: { x: number; y: number; h: number; rotation?: number },
  draw: () => void,
) {
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...objectMatrix(pageGeometry(page), rect)));
  draw();
  page.pushOperators(popGraphicsState());
}

export type Position = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export const POSITIONS: Position[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

export interface PageNumberOptions {
  position: Position;
  /** Шаблон: {n} — номер, {total} — последний номер. Например «{n} / {total}». */
  format: string;
  /** Номер первой нумеруемой страницы */
  start: number;
  /** Какие страницы нумеровать (0-based, по порядку). По умолчанию все. */
  pages?: number[];
  fontSize: number;
  /** Отступ от края, pt */
  margin?: number;
  color?: string;
  family?: FontFamily;
}

export async function addPageNumbers(bytes: Uint8Array, opts: PageNumberOptions): Promise<Uint8Array> {
  const doc = await loadForEdit(bytes);
  const font = await embedFont(doc, { family: opts.family ?? "sans" });
  const all = doc.getPages();
  const targets = (opts.pages ?? all.map((_, i) => i)).filter((i) => i >= 0 && i < all.length);
  const last = opts.start + targets.length - 1;
  const { position, fontSize: size, margin = 28 } = opts;
  const color = hexToRgb(opts.color ?? "#000000");

  targets.forEach((pageIndex, k) => {
    const page = all[pageIndex];
    const text = opts.format.replaceAll("{n}", String(opts.start + k)).replaceAll("{total}", String(last));
    const { width, height } = viewSize(pageGeometry(page));
    const w = font.widthOfTextAtSize(text, size);
    const x = position.endsWith("left") ? margin : position.endsWith("right") ? width - margin - w : (width - w) / 2;
    // Базовая линия текста — по нижнему краю прямоугольника высотой size
    const y = position.startsWith("top") ? margin : height - margin - size;
    drawInView(page, { x, y, h: size }, () => page.drawText(text, { x: 0, y: 0, size, font, color }));
  });

  return doc.save();
}
