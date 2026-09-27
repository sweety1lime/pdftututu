"use client";

import { writeMetadata } from "./metadata";
import { METADATA_FIELDS } from "./metadataFields";
import { closePdfjs, openPdfjs } from "./pdfjs";
import { rasterizePages } from "./rasterize";

const NO_FIELDS = Object.fromEntries(METADATA_FIELDS.map((f) => [f, ""])) as Parameters<typeof writeMetadata>[1];

/**
 * Довести «скрыть навсегда» до конца: страницы с закраской превратить в картинки
 * (всё, что было на странице — текст, ссылки, поля форм, — исчезает из файла),
 * удалить свойства документа и скрытые данные. По желанию — вернуть поиск по
 * тексту распознаванием (OCR) этих страниц.
 */
export async function applyRedactions(
  bytes: Uint8Array,
  pages: Set<number>,
  opts: { ocrLanguages?: string[] } = {},
): Promise<Uint8Array> {
  let out = await rasterizePages(bytes, { dpi: 200, quality: 0.85, only: pages });
  out = await writeMetadata(out, NO_FIELDS, { clearAll: true });
  if (opts.ocrLanguages?.length) {
    const { runOcr } = await import("@/lib/ocr");
    const pdf = await openPdfjs(out);
    try {
      // Страницы с текстом пропускаются — распознаются только ставшие картинками (и сканы)
      out = (await runOcr(out, pdf, { languages: opts.ocrLanguages, skipPagesWithText: true }, () => {})).pdf;
    } finally {
      closePdfjs(pdf);
    }
  }
  return out;
}
