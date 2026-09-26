"use client";

import { PDFDocument } from "@cantoo/pdf-lib";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { canvasToBytes, closePdfjs, openPdfjs, renderPageToNewCanvas } from "./pdfjs";
import { removeUnreachableObjects, replacePageWithImage } from "./scrub";

/**
 * Превратить страницы в картинки (JPEG). Текст перестаёт быть текстом —
 * это и способ сильно сжать скан, и способ «по-настоящему» удалить закрашенное.
 * @param only — индексы страниц для растрирования (по умолчанию все)
 */
export async function rasterizePages(
  bytes: Uint8Array,
  opts: { dpi: number; quality: number; only?: Set<number> },
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const pdf: PDFDocumentProxy = await openPdfjs(bytes);
  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const total = pdf.numPages;
    const targets = opts.only ? [...opts.only].filter((i) => i < total) : [...Array(total).keys()];

    for (let k = 0; k < targets.length; k++) {
      const i = targets[k];
      const page = await pdf.getPage(i + 1);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = await renderPageToNewCanvas(page, opts.dpi / 72);
      const jpeg = await canvasToBytes(canvas, "image/jpeg", opts.quality);
      canvas.width = canvas.height = 0;

      const image = await doc.embedJpg(jpeg);
      // Тот же видимый размер (поворот уже «запечён» в картинку)
      replacePageWithImage(doc, i, image, viewport.width, viewport.height);
      onProgress?.(k + 1, targets.length);
    }
    // Иначе старый контент страниц останется в файле
    removeUnreachableObjects(doc);
    return await doc.save({ useObjectStreams: true });
  } finally {
    closePdfjs(pdf);
  }
}
