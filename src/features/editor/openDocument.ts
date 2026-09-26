"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { pdfRectToView, viewSize, type Box } from "@/lib/pdf/coords";
import { PdfError } from "@/lib/pdf/errors";
import type { PdfSource } from "@/lib/pdf/load";
import { openPdfjs } from "@/lib/pdf/pdfjs";
import type { FormValue, FormWidget, PageInfo } from "./types";

export interface OpenedDocument {
  pdf: PDFDocumentProxy;
  pages: PageInfo[];
  widgets: FormWidget[];
  isXfa: boolean;
}

/** Минимальный набор полей аннотации pdf.js, который мы используем. */
interface WidgetAnnotation {
  id: string;
  subtype?: string;
  fieldType?: string;
  fieldName?: string;
  fieldValue?: unknown;
  rect: number[];
  checkBox?: boolean;
  radioButton?: boolean;
  pushButton?: boolean;
  exportValue?: string;
  buttonValue?: string;
  options?: Array<{ exportValue: string; displayValue: string }>;
  combo?: boolean;
  multiSelect?: boolean;
  multiLine?: boolean;
  maxLen?: number;
  readOnly?: boolean;
  hidden?: boolean;
  textAlignment?: number;
  defaultAppearanceData?: { fontSize?: number };
}

export async function openDocument(source: PdfSource): Promise<OpenedDocument> {
  let pdf: PDFDocumentProxy;
  try {
    pdf = await openPdfjs(source.bytes);
  } catch (e) {
    throw new PdfError("corrupted", source.name, e);
  }

  const pages: PageInfo[] = [];
  const widgets: FormWidget[] = [];
  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const box = page.view as Box;
    const geom = { box, rotation: page.rotate };
    pages.push({ ...geom, ...viewSize(geom) });

    const annotations = (await page.getAnnotations({ intent: "display" })) as WidgetAnnotation[];
    for (const a of annotations) {
      const w = toWidget(a, i, geom);
      if (w) widgets.push(w);
    }
  }

  const isXfa = Boolean((pdf as unknown as { isPureXfa?: boolean }).isPureXfa);
  return { pdf, pages, widgets, isXfa };
}

function toWidget(a: WidgetAnnotation, page: number, geom: { box: Box; rotation: number }): FormWidget | null {
  if (a.subtype !== "Widget" || !a.fieldName || a.hidden || a.pushButton) return null;
  const rect = pdfRectToView(geom, a.rect as Box);
  if (rect.w < 2 || rect.h < 2) return null;

  const base = {
    id: a.id,
    page,
    name: a.fieldName,
    ...rect,
    readOnly: a.readOnly,
    fontSize: a.defaultAppearanceData?.fontSize || undefined,
    align: (["left", "center", "right"] as const)[a.textAlignment ?? 0] ?? "left",
  };

  switch (a.fieldType) {
    case "Tx":
      return {
        ...base,
        kind: "text",
        multiline: a.multiLine,
        maxLen: a.maxLen || undefined,
        initial: typeof a.fieldValue === "string" ? a.fieldValue : "",
      };
    case "Btn":
      if (a.checkBox) {
        return {
          ...base,
          kind: "checkbox",
          exportValue: a.exportValue,
          initial: a.fieldValue != null && a.fieldValue !== "Off" && a.fieldValue === a.exportValue,
        };
      }
      if (a.radioButton) {
        return {
          ...base,
          kind: "radio",
          exportValue: a.buttonValue,
          initial: typeof a.fieldValue === "string" ? a.fieldValue : "",
        };
      }
      return null;
    case "Ch": {
      const options = (a.options ?? []).map((o) => ({ value: o.exportValue, label: o.displayValue }));
      const value = Array.isArray(a.fieldValue) ? (a.fieldValue as string[]) : a.fieldValue ? [String(a.fieldValue)] : [];
      return a.combo
        ? { ...base, kind: "select", options, initial: value[0] ?? "" }
        : { ...base, kind: "list", options, multiSelect: a.multiSelect, initial: a.multiSelect ? value : (value[0] ?? "") };
    }
    default:
      return null;
  }
}

/** Текущее значение поля: изменённое пользователем или исходное. */
export function widgetValue(w: FormWidget, values: Record<string, FormValue>): FormValue {
  return w.name in values ? values[w.name] : w.initial;
}
