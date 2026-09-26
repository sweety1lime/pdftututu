import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { degrees, PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { setFontLoader } from "@/lib/pdf/fonts";

/** В Node шрифты читаем с диска, а не через fetch. */
export function useDiskFonts() {
  setFontLoader(async (file) => new Uint8Array(await readFile(join(process.cwd(), "public", "fonts", file))));
}

/** Простой PDF: N страниц A4 с подписью «Page i». */
export async function makePdf(pages = 3, opts: { rotate?: number; size?: [number, number] } = {}) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage(opts.size ?? [595.28, 841.89]);
    page.drawText(`Page ${i}`, { x: 50, y: 780, size: 24, font });
    if (opts.rotate) page.setRotation(degrees(opts.rotate));
  }
  return doc.save();
}

/** Текст всех страниц через pdf.js (как его увидит пользователь при копировании/поиске). */
export async function extractText(bytes: Uint8Array): Promise<string[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const out: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "));
  }
  await doc.loadingTask.destroy();
  return out;
}
