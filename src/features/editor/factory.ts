import { newId } from "@/lib/pdf/load";
import { lineHeightPt, measureTextBrowser } from "@/lib/pdf/textLayout";
import type { BoxObject, EditorObject, StrokeObject, StyleDefaults, TextObject } from "./types";

/** Пересчитать размер текстового блока по содержимому. */
export function withTextSize<T extends TextObject>(o: T): T {
  const { w, h } = measureTextBrowser(o.text || " ", o);
  return { ...o, w, h };
}

export function makeText(page: number, x: number, y: number, d: StyleDefaults, text = ""): TextObject {
  const lh = lineHeightPt(d.text);
  return withTextSize({
    id: newId("obj"),
    type: "text",
    page,
    x,
    y: y - lh / 2,
    w: 0,
    h: lh,
    rotation: 0,
    opacity: 1,
    text,
    ...d.text,
  });
}

export function makeBox(
  type: BoxObject["type"],
  page: number,
  rect: { x: number; y: number; w: number; h: number },
  d: StyleDefaults,
): BoxObject {
  const base = { id: newId("obj"), page, ...rect, rotation: 0 };
  switch (type) {
    case "highlight":
      return { ...base, type, fill: d.highlight.fill, stroke: null, strokeWidth: 0, opacity: 0.45 };
    case "whiteout":
      return { ...base, type, fill: "#ffffff", stroke: null, strokeWidth: 0, opacity: 1 };
    default:
      return { ...base, type, ...d.shape };
  }
}

/** Линия/стрелка/штрих из абсолютных точек → объект с bbox и относительными точками. */
export function makeStroke(
  type: StrokeObject["type"],
  page: number,
  absPoints: number[],
  d: StyleDefaults,
): StrokeObject {
  const xs = absPoints.filter((_, i) => i % 2 === 0);
  const ys = absPoints.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const points = absPoints.map((v, i) => v - (i % 2 === 0 ? minX : minY));
  const style =
    type === "path"
      ? d.pen.marker
        ? { stroke: d.pen.stroke, strokeWidth: Math.max(8, d.pen.strokeWidth), opacity: 0.4, marker: true }
        : { stroke: d.pen.stroke, strokeWidth: d.pen.strokeWidth, opacity: 1, marker: false }
      : { ...d.line };
  return {
    id: newId("obj"),
    type,
    page,
    x: minX,
    y: minY,
    w: Math.max(1, Math.max(...xs) - minX),
    h: Math.max(1, Math.max(...ys) - minY),
    rotation: 0,
    points,
    ...style,
  };
}

/** Применить масштаб трансформера к объекту. */
export function scaleObject(o: EditorObject, sx: number, sy: number): Partial<EditorObject> {
  switch (o.type) {
    case "text": {
      const fontSize = Math.max(3, Math.round(o.fontSize * sy * 10) / 10);
      return withTextSize({ ...o, fontSize });
    }
    case "line":
    case "arrow":
    case "path":
      return {
        points: o.points.map((v, i) => v * (i % 2 === 0 ? sx : sy)),
        w: Math.max(1, o.w * sx),
        h: Math.max(1, o.h * sy),
      };
    default:
      return { w: Math.max(2, o.w * sx), h: Math.max(2, o.h * sy) };
  }
}

/** Инструменты, после использования которых возвращаемся к «Выбору». */
export const ONE_SHOT_TOOLS = new Set(["text", "rect", "ellipse", "line", "arrow"]);
