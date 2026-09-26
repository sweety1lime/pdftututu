/**
 * Геометрия страниц.
 *
 * «Вид» (view) — то, что видит пользователь: CropBox, повёрнутый на /Rotate,
 * начало координат в левом верхнем углу, ось Y вниз, единицы — PDF-точки (1/72").
 * Все объекты редактора хранятся в координатах вида.
 *
 * Матрицы — в PDF-формате [a, b, c, d, e, f]:
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 */
export type Matrix = [number, number, number, number, number, number];

/** [x0, y0, x1, y1] — прямоугольник в пространстве PDF (y вверх). */
export type Box = [number, number, number, number];

export interface PageGeometry {
  box: Box; // CropBox
  rotation: number; // 0 | 90 | 180 | 270
}

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

export function normalizeRotation(deg: number): 0 | 90 | 180 | 270 {
  const r = (((Math.round(deg / 90) * 90) % 360) + 360) % 360;
  return r as 0 | 90 | 180 | 270;
}

/** Размер страницы в координатах вида. */
export function viewSize(g: PageGeometry): { width: number; height: number } {
  const w = g.box[2] - g.box[0];
  const h = g.box[3] - g.box[1];
  const r = normalizeRotation(g.rotation);
  return r === 90 || r === 270 ? { width: h, height: w } : { width: w, height: h };
}

/** Матрица «вид → пространство PDF». */
export function viewToPdfMatrix(g: PageGeometry): Matrix {
  const [x0, y0, x1, y1] = g.box;
  switch (normalizeRotation(g.rotation)) {
    case 0:
      return [1, 0, 0, -1, x0, y1];
    case 90:
      return [0, 1, 1, 0, x0, y0];
    case 180:
      return [-1, 0, 0, 1, x1, y0];
    case 270:
      return [0, -1, -1, 0, x1, y1];
  }
}

/** Композиция: сначала применяется n, потом m. */
export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

export function invert(m: Matrix): Matrix {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) throw new Error("Matrix is not invertible");
  const a = m[3] / det;
  const b = -m[1] / det;
  const c = -m[2] / det;
  const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
}

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export const translate = (x: number, y: number): Matrix => [1, 0, 0, 1, x, y];

/** Поворот по часовой стрелке (в системе с осью Y вниз), градусы. */
export function rotateCw(deg: number): Matrix {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [cos, sin, -sin, cos, 0, 0];
}

/**
 * Матрица для рисования объекта редактора средствами pdf-lib.
 * Локальная система объекта: начало в его левом нижнем углу, ось Y вверх
 * (как ожидает pdf-lib), размер w×h. Учитывает поворот страницы и объекта.
 */
export function objectMatrix(
  g: PageGeometry,
  obj: { x: number; y: number; h: number; rotation?: number },
): Matrix {
  const flip: Matrix = [1, 0, 0, -1, 0, obj.h];
  return multiply(
    viewToPdfMatrix(g),
    multiply(translate(obj.x, obj.y), multiply(rotateCw(obj.rotation ?? 0), flip)),
  );
}

/** Прямоугольник из пространства PDF → прямоугольник в координатах вида. */
export function pdfRectToView(
  g: PageGeometry,
  rect: Box,
): { x: number; y: number; w: number; h: number } {
  const inv = invert(viewToPdfMatrix(g));
  const [ax, ay] = apply(inv, rect[0], rect[1]);
  const [bx, by] = apply(inv, rect[2], rect[3]);
  return {
    x: Math.min(ax, bx),
    y: Math.min(ay, by),
    w: Math.abs(bx - ax),
    h: Math.abs(by - ay),
  };
}
