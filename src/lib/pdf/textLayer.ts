import {
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSqueeze,
  setTextRenderingMode,
  TextRenderingMode,
  type PDFFont,
  type PDFPage,
} from "@cantoo/pdf-lib";
import { multiply, viewToPdfMatrix, type PageGeometry } from "./coords";
import { FONT_METRICS } from "./textLayout";

/** Слово с рамкой в координатах вида (PDF-точки, Y вниз). */
export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Базовая линия (Y), если известна */
  baseline?: number;
  /** Высота строки — для единого кегля в строке */
  lineHeight?: number;
}

/**
 * Добавить на страницу невидимый текст (режим отрисовки 3): он не виден,
 * но выделяется, копируется и находится поиском — как в «сканах с OCR».
 */
export function addInvisibleText(page: PDFPage, geom: PageGeometry, words: OcrWord[], font: PDFFont) {
  if (!words.length) return;
  const { ascent, descent } = FONT_METRICS.sans;
  const viewH = geom.rotation % 180 === 0 ? geom.box[3] - geom.box[1] : geom.box[2] - geom.box[0];
  // Система «вид, но ось Y вверх» — в ней pdf-lib рисует текст не зеркально
  const m = multiply(viewToPdfMatrix(geom), [1, 0, 0, -1, 0, viewH]);

  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(...m),
    setTextRenderingMode(TextRenderingMode.Invisible),
  );
  for (const w of words) {
    const text = w.text.trim();
    if (!text) continue;
    const boxH = w.lineHeight ?? w.y1 - w.y0;
    const size = Math.max(1, boxH / (ascent + descent));
    const baseline = w.baseline ?? w.y1 - descent * size;
    let natural: number;
    try {
      natural = font.widthOfTextAtSize(text, size);
    } catch {
      continue;
    }
    if (natural <= 0) continue;
    const squeeze = Math.min(500, Math.max(10, ((w.x1 - w.x0) / natural) * 100));
    page.pushOperators(setCharacterSqueeze(squeeze));
    page.drawText(text, { x: w.x0, y: viewH - baseline, size, font });
  }
  page.pushOperators(setCharacterSqueeze(100), popGraphicsState());
}
