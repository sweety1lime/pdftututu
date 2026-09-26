"use client";

import type { PDFDocumentProxy } from "pdfjs-dist";
import { embedFont } from "./pdf/fonts";
import { loadForEdit } from "./pdf/load";
import { renderPageToNewCanvas } from "./pdf/pdfjs";
import { addInvisibleText, type OcrWord } from "./pdf/textLayer";

// Модели для этих языков копирует scripts/copy-tesseract.mjs — списки должны совпадать
export const OCR_LANGUAGES = [
  { code: "rus", label: "Русский" },
  { code: "eng", label: "English" },
  { code: "ukr", label: "Українська" },
  { code: "deu", label: "Deutsch" },
  { code: "fra", label: "Français" },
  { code: "spa", label: "Español" },
] as const;

export interface OcrProgress {
  stage: "loading" | "recognizing" | "saving";
  page: number;
  total: number;
  /** 0..1 внутри текущей страницы */
  pageProgress: number;
}

export interface OcrResult {
  pdf: Uint8Array;
  text: string;
  pagesProcessed: number;
}

// Масштаб рендера для распознавания: 300 DPI / 72
const OCR_SCALE = 300 / 72;

interface TessBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
interface TessLine {
  bbox: TessBBox;
  baseline?: TessBBox & { has_baseline?: boolean };
  words: Array<{ text: string; bbox: TessBBox; confidence: number }>;
}

export async function runOcr(
  bytes: Uint8Array,
  pdf: PDFDocumentProxy,
  opts: { languages: string[]; skipPagesWithText: boolean; signal?: AbortSignal },
  onProgress: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const total = pdf.numPages;
  onProgress({ stage: "loading", page: 0, total, pageProgress: 0 });

  // tesseract.js (~ и языковые модели) грузим только сейчас
  const { createWorker } = await import("tesseract.js");
  let currentPage = 0;
  const worker = await createWorker(opts.languages, 1, {
    // Всё со своего сайта, без CDN: файлы копирует scripts/copy-tesseract.mjs
    workerPath: "/tesseract/worker.min.js",
    corePath: "/tesseract/core",
    langPath: "/tesseract/lang",
    // Воркер прямо по адресу, а не через blob: — так проще с CSP
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === "recognizing text") {
        onProgress({ stage: "recognizing", page: currentPage, total, pageProgress: m.progress });
      }
    },
  });

  try {
    const doc = await loadForEdit(bytes);
    const font = await embedFont(doc, { family: "sans" });
    const pages = doc.getPages();
    const texts: string[] = [];
    let processed = 0;

    for (let i = 0; i < total; i++) {
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");
      currentPage = i + 1;
      onProgress({ stage: "recognizing", page: currentPage, total, pageProgress: 0 });
      const page = await pdf.getPage(i + 1);

      if (opts.skipPagesWithText) {
        const content = await page.getTextContent();
        const chars = content.items.reduce((n, it) => n + ("str" in it ? it.str.trim().length : 0), 0);
        if (chars > 30) {
          texts.push(content.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join(""));
          continue;
        }
      }

      const canvas = await renderPageToNewCanvas(page, OCR_SCALE);
      const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
      canvas.width = canvas.height = 0; // освобождаем память
      texts.push(data.text ?? "");

      const words: OcrWord[] = [];
      for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs) {
          for (const line of para.lines as TessLine[]) {
            const lineH = (line.bbox.y1 - line.bbox.y0) / OCR_SCALE;
            for (const w of line.words) {
              if (!w.text.trim() || w.confidence < 20) continue;
              let baseline: number | undefined;
              const b = line.baseline;
              if (b && b.has_baseline !== false && b.x1 !== b.x0) {
                const cx = (w.bbox.x0 + w.bbox.x1) / 2;
                baseline = (b.y0 + ((b.y1 - b.y0) * (cx - b.x0)) / (b.x1 - b.x0)) / OCR_SCALE;
              }
              words.push({
                text: w.text,
                x0: w.bbox.x0 / OCR_SCALE,
                y0: w.bbox.y0 / OCR_SCALE,
                x1: w.bbox.x1 / OCR_SCALE,
                y1: w.bbox.y1 / OCR_SCALE,
                baseline,
                lineHeight: lineH,
              });
            }
          }
        }
      }
      const [x0, y0, x1, y1] = page.view;
      addInvisibleText(pages[i], { box: [x0, y0, x1, y1], rotation: page.rotate }, words, font);
      processed++;
    }

    onProgress({ stage: "saving", page: total, total, pageProgress: 1 });
    const out = await doc.save();
    return { pdf: out, text: texts.join("\n\n").trim(), pagesProcessed: processed };
  } finally {
    await worker.terminate();
  }
}
