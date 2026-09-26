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

export type WatermarkLayout = "center" | "tile";

/**
 * Где ставить водяной знак: левые верхние углы прямоугольников w×h в координатах
 * вида. Прямоугольник поворачивается на rotation° по часовой вокруг этого угла
 * (как в objectMatrix), поэтому угол считаем так, чтобы в нужной точке оказался центр.
 * Плиткой — ряды вдоль направления надписи, соседние ряды сдвинуты «кирпичиком».
 */
export function watermarkPlacements(
  page: { width: number; height: number },
  box: { w: number; h: number },
  rotation: number,
  layout: WatermarkLayout,
  gap: { x: number; y: number } = { x: box.w * 0.5 + 40, y: box.h * 3 },
): { x: number; y: number }[] {
  const r = (rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const rot = (x: number, y: number) => [cos * x - sin * y, sin * x + cos * y];
  const [hx, hy] = rot(box.w / 2, box.h / 2);
  const cx = page.width / 2;
  const cy = page.height / 2;
  if (layout === "center") return [{ x: cx - hx, y: cy - hy }];

  const sx = box.w + gap.x;
  const sy = box.h + gap.y;
  const reach = Math.hypot(page.width, page.height) / 2 + Math.hypot(box.w, box.h);
  const n = Math.ceil(reach / Math.min(sx, sy));
  const pad = Math.hypot(box.w, box.h) / 2;
  const out: { x: number; y: number }[] = [];
  for (let j = -n; j <= n; j++) {
    for (let i = -n; i <= n; i++) {
      const [dx, dy] = rot(i * sx + (j % 2 ? sx / 2 : 0), j * sy);
      const px = cx + dx;
      const py = cy + dy;
      // Центр должен быть на странице или рядом (чтобы край плитки не обрывался)
      if (px < -pad || px > page.width + pad || py < -pad || py > page.height + pad) continue;
      out.push({ x: px - hx, y: py - hy });
    }
  }
  return out;
}

export interface WatermarkImage {
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export interface WatermarkOptions {
  /** Текст надписи — или картинка */
  text?: string;
  image?: WatermarkImage;
  /** Кегль текста, pt */
  fontSize?: number;
  /** Ширина картинки как доля ширины страницы (0..1) */
  imageScale?: number;
  color?: string;
  bold?: boolean;
  /** 0..1 */
  opacity: number;
  /** Градусы по часовой; −45 — наискосок снизу вверх */
  rotation: number;
  layout: WatermarkLayout;
  /** Какие страницы (0-based). По умолчанию все. */
  pages?: number[];
}

export async function addWatermark(bytes: Uint8Array, opts: WatermarkOptions): Promise<Uint8Array> {
  const doc = await loadForEdit(bytes);
  const all = doc.getPages();
  const targets = (opts.pages ?? all.map((_, i) => i)).filter((i) => i >= 0 && i < all.length);
  const { rotation, layout, opacity } = opts;

  if (opts.image) {
    const img = opts.image;
    const embedded = img.mime === "image/png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
    for (const i of targets) {
      const page = all[i];
      const size = viewSize(pageGeometry(page));
      const w = size.width * (opts.imageScale ?? 0.5);
      const h = (w * img.height) / img.width;
      for (const p of watermarkPlacements(size, { w, h }, rotation, layout, { x: w * 0.6, y: h * 0.6 })) {
        drawInView(page, { ...p, h, rotation }, () => page.drawImage(embedded, { x: 0, y: 0, width: w, height: h, opacity }));
      }
    }
  } else if (opts.text?.trim()) {
    const text = opts.text.trim();
    const font = await embedFont(doc, { family: "sans", bold: opts.bold ?? true });
    const size = opts.fontSize ?? 48;
    const color = hexToRgb(opts.color ?? "#808080");
    const w = font.widthOfTextAtSize(text, size);
    for (const i of targets) {
      const page = all[i];
      for (const p of watermarkPlacements(viewSize(pageGeometry(page)), { w, h: size }, rotation, layout)) {
        // Базовая линия чуть выше низа прямоугольника — буквы по центру по высоте
        drawInView(page, { ...p, h: size, rotation }, () =>
          page.drawText(text, { x: 0, y: size * 0.2, size, font, color, opacity }),
        );
      }
    }
  }

  return doc.save();
}
