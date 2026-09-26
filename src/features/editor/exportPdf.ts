import {
  BlendMode,
  concatTransformationMatrix,
  LineCapStyle,
  LineJoinStyle,
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
  popGraphicsState,
  pushGraphicsState,
  setLineJoin,
  type PDFImage,
  type PDFPage,
} from "@cantoo/pdf-lib";
import { objectMatrix, type PageGeometry } from "@/lib/pdf/coords";
import { hexToRgb } from "@/lib/pdf/color";
import { embedFont } from "@/lib/pdf/fonts";
import { alignOffset, baselineOffset, lineHeightPt, splitLines } from "@/lib/pdf/textLayout";
import type { Asset, EditorObject, FormValue, StrokeObject } from "./types";

export interface ExportInput {
  bytes: Uint8Array;
  pages: PageGeometry[];
  objects: EditorObject[];
  formValues: Record<string, FormValue>;
  assets: Record<string, Asset>;
  flattenForms?: boolean;
}

/** Применить все правки редактора к исходному PDF и вернуть новый файл. */
export async function exportEditedPdf(input: ExportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.load(input.bytes, { ignoreEncryption: true, updateMetadata: false });
  doc.setModificationDate(new Date());
  doc.setProducer("PDFtutut");

  if (Object.keys(input.formValues).length || input.flattenForms) {
    await applyFormValues(doc, input.formValues, input.flattenForms ?? false);
  }

  const pdfPages = doc.getPages();
  const images = new Map<string, Promise<PDFImage>>();
  const getImage = (asset: Asset) => {
    let p = images.get(asset.id);
    if (!p) {
      p = asset.mime === "image/png" ? doc.embedPng(asset.bytes) : doc.embedJpg(asset.bytes);
      images.set(asset.id, p);
    }
    return p;
  };

  for (const obj of input.objects) {
    const page = pdfPages[obj.page];
    const geom = input.pages[obj.page];
    if (!page || !geom) continue;
    await drawObject(doc, page, geom, obj, input.assets, getImage);
  }

  return doc.save();
}

async function drawObject(
  doc: PDFDocument,
  page: PDFPage,
  geom: PageGeometry,
  obj: EditorObject,
  assets: Record<string, Asset>,
  getImage: (a: Asset) => Promise<PDFImage>,
) {
  // Локальная система объекта: (0,0) — левый нижний угол, ось Y вверх
  const m = objectMatrix(geom, obj);
  page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m));
  const opacity = obj.opacity;

  switch (obj.type) {
    case "redact":
      // Всегда чёрный и непрозрачный — страницу потом растрируют, и под закраской не должно быть видно ничего
      page.drawRectangle({ x: 0, y: 0, width: obj.w, height: obj.h, color: hexToRgb("#000000") });
      break;
    case "rect":
    case "whiteout":
    case "highlight": {
      const isHighlight = obj.type === "highlight";
      page.drawRectangle({
        x: 0,
        y: 0,
        width: obj.w,
        height: obj.h,
        color: obj.fill ? hexToRgb(obj.fill) : undefined,
        opacity,
        borderColor: obj.stroke && obj.strokeWidth > 0 ? hexToRgb(obj.stroke) : undefined,
        borderWidth: obj.stroke ? obj.strokeWidth : 0,
        borderOpacity: opacity,
        blendMode: isHighlight ? BlendMode.Multiply : undefined,
      });
      break;
    }
    case "ellipse": {
      page.drawEllipse({
        x: obj.w / 2,
        y: obj.h / 2,
        xScale: obj.w / 2,
        yScale: obj.h / 2,
        color: obj.fill ? hexToRgb(obj.fill) : undefined,
        opacity,
        borderColor: obj.stroke && obj.strokeWidth > 0 ? hexToRgb(obj.stroke) : undefined,
        borderWidth: obj.stroke ? obj.strokeWidth : 0,
        borderOpacity: opacity,
      });
      break;
    }
    case "image": {
      const asset = assets[obj.assetId];
      if (asset) {
        const img = await getImage(asset);
        page.drawImage(img, { x: 0, y: 0, width: obj.w, height: obj.h, opacity });
      }
      break;
    }
    case "text": {
      const font = await embedFont(doc, obj);
      const lines = splitLines(obj.text);
      const widths = lines.map((l) => font.widthOfTextAtSize(l, obj.fontSize));
      const boxW = Math.max(obj.w, ...widths);
      lines.forEach((line, i) => {
        if (!line) return;
        page.drawText(line, {
          x: alignOffset(obj.align, boxW, widths[i]),
          y: obj.h - baselineOffset(obj, i),
          size: obj.fontSize,
          font,
          color: hexToRgb(obj.color),
          opacity,
          lineHeight: lineHeightPt(obj),
        });
      });
      break;
    }
    case "line":
    case "arrow":
    case "path": {
      drawStroke(page, obj);
      break;
    }
  }

  page.pushOperators(popGraphicsState());
}

/** Точки заданы в системе «Y вниз» относительно левого верхнего угла объекта. */
function drawStroke(page: PDFPage, obj: StrokeObject) {
  const pts = obj.points;
  if (pts.length < 4) {
    if (pts.length === 2) {
      // Одиночная точка пера — рисуем кружок
      page.drawCircle({
        x: pts[0],
        y: obj.h - pts[1],
        size: obj.strokeWidth / 2,
        color: hexToRgb(obj.stroke),
        opacity: obj.opacity,
      });
    }
    return;
  }
  let d = `M ${pts[0]} ${pts[1]}`;
  for (let i = 2; i < pts.length; i += 2) d += ` L ${pts[i]} ${pts[i + 1]}`;

  page.pushOperators(setLineJoin(LineJoinStyle.Round));
  // drawSvgPath переворачивает ось Y сам: ставим начало в левый верхний угол
  page.drawSvgPath(d, {
    x: 0,
    y: obj.h,
    borderColor: hexToRgb(obj.stroke),
    borderWidth: obj.strokeWidth,
    borderOpacity: obj.opacity,
    borderLineCap: LineCapStyle.Round,
    blendMode: obj.marker ? BlendMode.Multiply : undefined,
  });

  if (obj.type === "arrow") {
    const n = pts.length;
    const [x1, y1, x2, y2] = [pts[n - 4], pts[n - 3], pts[n - 2], pts[n - 1]];
    const head = arrowHead(x1, y1, x2, y2, obj.strokeWidth);
    page.drawSvgPath(head, { x: 0, y: obj.h, color: hexToRgb(obj.stroke), opacity: obj.opacity });
  }
}

/** Треугольник наконечника стрелки (SVG-путь). Используется и в редакторе. */
export function arrowHeadPoints(x1: number, y1: number, x2: number, y2: number, strokeWidth: number): number[] {
  const len = Math.max(8, strokeWidth * 4);
  const width = len * 0.6;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const bx = x2 - len * Math.cos(angle);
  const by = y2 - len * Math.sin(angle);
  const nx = -Math.sin(angle) * width;
  const ny = Math.cos(angle) * width;
  return [x2, y2, bx + nx, by + ny, bx - nx, by - ny];
}

function arrowHead(x1: number, y1: number, x2: number, y2: number, strokeWidth: number): string {
  const p = arrowHeadPoints(x1, y1, x2, y2, strokeWidth);
  return `M ${p[0]} ${p[1]} L ${p[2]} ${p[3]} L ${p[4]} ${p[5]} Z`;
}

async function applyFormValues(doc: PDFDocument, values: Record<string, FormValue>, flatten: boolean) {
  const form = doc.getForm();
  for (const [name, value] of Object.entries(values)) {
    const field = form.getFieldMaybe(name);
    if (!field) continue;
    try {
      if (field instanceof PDFTextField) {
        const text = String(value ?? "");
        const max = field.getMaxLength();
        field.setText(max !== undefined ? text.slice(0, max) : text);
      } else if (field instanceof PDFCheckBox) {
        if (value) field.check();
        else field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        if (typeof value === "string" && value && field.getOptions().includes(value)) field.select(value);
      } else if (field instanceof PDFDropdown) {
        if (typeof value === "string" && value) field.select(value);
        else if (Array.isArray(value) && value.length) field.select(value);
      } else if (field instanceof PDFOptionList) {
        if (Array.isArray(value)) field.select(value);
        else if (typeof value === "string" && value) field.select(value);
      }
    } catch (e) {
      console.warn(`Form field "${name}" not filled`, e);
    }
  }
  // Внешний вид полей перестраиваем шрифтом с кириллицей
  const font = await embedFont(doc, { family: "sans" });
  try {
    form.updateFieldAppearances(font);
  } catch (e) {
    console.warn("updateFieldAppearances failed", e);
  }
  if (form.hasXFA()) form.deleteXFA();
  if (flatten) form.flatten();
}
