/**
 * Где на странице что ставить: номера страниц и водяные знаки. Чистая геометрия
 * без pdf-lib — её использует и превью в интерфейсе (см. stamp.ts).
 */

export type Position = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";

export const POSITIONS: Position[] = ["top-left", "top-center", "top-right", "bottom-left", "bottom-center", "bottom-right"];

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
