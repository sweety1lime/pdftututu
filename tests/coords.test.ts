import { describe, expect, it } from "vitest";
import { apply, invert, objectMatrix, pdfRectToView, viewSize, viewToPdfMatrix, type Box } from "@/lib/pdf/coords";

const box: Box = [10, 20, 610, 820]; // 600×800, со смещением как у CropBox

describe("viewToPdfMatrix", () => {
  it.each([
    // [поворот, точка вида (левый верхний угол), ожидаемая точка PDF]
    [0, [0, 0], [10, 820]],
    [90, [0, 0], [10, 20]],
    [180, [0, 0], [610, 20]],
    [270, [0, 0], [610, 820]],
  ])("поворот %i: левый верхний угол вида", (rotation, [vx, vy], [px, py]) => {
    const m = viewToPdfMatrix({ box, rotation });
    expect(apply(m, vx, vy)).toEqual([px, py]);
  });

  it("правый нижний угол вида попадает в противоположный угол", () => {
    for (const rotation of [0, 90, 180, 270]) {
      const g = { box, rotation };
      const { width, height } = viewSize(g);
      const tl = apply(viewToPdfMatrix(g), 0, 0);
      const br = apply(viewToPdfMatrix(g), width, height);
      // Противоположные углы CropBox
      expect(Math.abs(tl[0] - br[0])).toBe(600);
      expect(Math.abs(tl[1] - br[1])).toBe(800);
    }
  });

  it("размер вида меняет стороны при 90/270", () => {
    expect(viewSize({ box, rotation: 90 })).toEqual({ width: 800, height: 600 });
    expect(viewSize({ box, rotation: 0 })).toEqual({ width: 600, height: 800 });
  });
});

describe("pdfRectToView", () => {
  it("обратное преобразование прямоугольника", () => {
    for (const rotation of [0, 90, 180, 270]) {
      const g = { box, rotation };
      const m = viewToPdfMatrix(g);
      const [x0, y0] = apply(m, 100, 50);
      const [x1, y1] = apply(m, 160, 80);
      const r = pdfRectToView(g, [x0, y0, x1, y1]);
      expect(r.x).toBeCloseTo(100);
      expect(r.y).toBeCloseTo(50);
      expect(r.w).toBeCloseTo(60);
      expect(r.h).toBeCloseTo(30);
    }
  });
});

describe("objectMatrix", () => {
  it("левый нижний угол объекта (0,0 в локальной системе) — это (x, y+h) вида", () => {
    const g = { box, rotation: 0 };
    const m = objectMatrix(g, { x: 100, y: 200, h: 50 });
    expect(apply(m, 0, 0)).toEqual(apply(viewToPdfMatrix(g), 100, 250));
    // Ось Y локальной системы смотрит вверх — к верхнему краю объекта
    expect(apply(m, 0, 50)).toEqual(apply(viewToPdfMatrix(g), 100, 200));
  });

  it("матрица обратима и сохраняет ориентацию (не зеркалит)", () => {
    for (const rotation of [0, 90, 180, 270]) {
      const m = objectMatrix({ box, rotation }, { x: 5, y: 7, h: 10, rotation: 30 });
      expect(m[0] * m[3] - m[1] * m[2]).toBeGreaterThan(0);
      const inv = invert(m);
      const [x, y] = apply(inv, ...apply(m, 3, 4));
      expect(x).toBeCloseTo(3);
      expect(y).toBeCloseTo(4);
    }
  });
});
