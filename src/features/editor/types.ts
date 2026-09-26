import type { FontFamily } from "@/lib/pdf/fonts";
import type { PageGeometry } from "@/lib/pdf/coords";

/**
 * Модель редактора. Координаты — PDF-точки в системе «вида» страницы
 * (левый верхний угол, ось Y вниз). См. lib/pdf/coords.ts.
 */
interface BaseObject {
  id: string;
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Поворот по часовой стрелке вокруг (x, y), градусы */
  rotation: number;
  opacity: number;
}

export type TextAlign = "left" | "center" | "right";

export interface TextObject extends BaseObject {
  type: "text";
  text: string;
  family: FontFamily;
  bold: boolean;
  italic: boolean;
  fontSize: number;
  color: string;
  lineHeight: number;
  align: TextAlign;
}

export interface ImageObject extends BaseObject {
  type: "image";
  assetId: string;
}

export interface BoxObject extends BaseObject {
  /** redact — «скрыть навсегда»: всегда чёрный и непрозрачный, страница при сохранении растрируется */
  type: "rect" | "ellipse" | "highlight" | "whiteout" | "redact";
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
  /** Появился из инструмента «Править текст» — закрывает исходный текст */
  coversText?: boolean;
}

export interface StrokeObject extends BaseObject {
  type: "line" | "arrow" | "path";
  /** Точки [x1, y1, x2, y2, …] относительно (x, y) */
  points: number[];
  stroke: string;
  strokeWidth: number;
  /** Маркер: полупрозрачный, режим наложения «умножение» */
  marker?: boolean;
}

export type EditorObject = TextObject | ImageObject | BoxObject | StrokeObject;
export type ObjectType = EditorObject["type"];

export interface Asset {
  id: string;
  mime: "image/png" | "image/jpeg";
  bytes: Uint8Array;
  width: number;
  height: number;
}

export type Tool =
  | "select"
  | "text"
  | "editText"
  | "image"
  | "rect"
  | "ellipse"
  | "line"
  | "arrow"
  | "highlight"
  | "whiteout"
  | "redact"
  | "pen"
  | "sign"
  | "forms";

/** Страницы сайта, которые открывают редактор (у каждой свой адрес в поиске) */
export type EditorEntry = "editor" | "editText" | "sign" | "forms" | "redact";

export interface PageInfo extends PageGeometry {
  /** Размер в координатах вида (с учётом поворота) */
  width: number;
  height: number;
}

export type FormValue = string | boolean | string[];

/** Виджет поля формы (из pdf.js) в координатах вида страницы. */
export interface FormWidget {
  id: string;
  page: number;
  name: string;
  kind: "text" | "checkbox" | "radio" | "select" | "list";
  x: number;
  y: number;
  w: number;
  h: number;
  /** Значение «включено» для чекбокса/радиокнопки */
  exportValue?: string;
  options?: Array<{ value: string; label: string }>;
  multiline?: boolean;
  multiSelect?: boolean;
  maxLen?: number;
  readOnly?: boolean;
  fontSize?: number;
  align?: "left" | "center" | "right";
  initial: FormValue;
}

export interface StyleDefaults {
  text: Pick<TextObject, "family" | "bold" | "italic" | "fontSize" | "color" | "lineHeight" | "align">;
  shape: { fill: string | null; stroke: string | null; strokeWidth: number; opacity: number };
  line: { stroke: string; strokeWidth: number; opacity: number };
  pen: { stroke: string; strokeWidth: number; marker: boolean };
  highlight: { fill: string };
}
