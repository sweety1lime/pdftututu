import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import { decodePDFRawStream, degrees, PDFDocument, PDFRawStream, StandardFonts } from "@cantoo/pdf-lib";
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

/**
 * Встречается ли строка где-нибудь в файле — в распакованных потоках или строковых
 * объектах, обычных или hex. Так её нашёл бы любой, кто полезет внутрь PDF.
 */
export async function fileContains(bytes: Uint8Array, text: string): Promise<boolean> {
  const hex = Buffer.from(text, "latin1").toString("hex");
  // Не-латинские строки PDF хранит в UTF-16BE (обычно как hex-строку)
  const utf16 = Buffer.from(text, "utf16le").swap16();
  const found = (s: string) =>
    s.includes(text) || s.toLowerCase().includes(hex) || s.toLowerCase().includes(utf16.toString("hex")) || s.includes(utf16.toString("latin1"));
  if (found(Buffer.from(bytes).toString("latin1"))) return true;
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    let s = obj.toString();
    if (obj instanceof PDFRawStream) {
      try {
        s = Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1");
      } catch {
        s = Buffer.from(obj.contents).toString("latin1");
      }
    }
    if (found(s)) return true;
  }
  return false;
}

/** Картинка PNG w×h: серая или из шума (шум почти не сжимается — «тяжёлый» файл). */
export function makePng(width = 2, height = 2, { noise = false } = {}): Uint8Array {
  const crc32 = (buf: Uint8Array) => {
    let c = ~0;
    for (const b of buf) {
      c ^= b;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return ~c >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc32(body), body.length + 4);
    return out;
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // бит на канал
  ihdr[9] = 2; // RGB
  // Каждая строка: байт фильтра (0) + пиксели
  const row = () => Buffer.concat([Buffer.from([0]), noise ? randomBytes(width * 3) : Buffer.alloc(width * 3, 0x80)]);
  const raw = Buffer.concat(Array.from({ length: height }, row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export interface ViewText {
  str: string;
  /** Начало базовой линии в координатах вида (как видит пользователь: y вниз) */
  x: number;
  y: number;
  /** Текст идёт слева направо, без поворота */
  upright: boolean;
  /** Угол наклона на экране, градусы по часовой (0 — горизонтально) */
  angle: number;
  width: number;
}

/** Текст страниц с положением на экране — чтобы проверять, куда что нарисовано. */
export async function textInView(bytes: Uint8Array): Promise<{ width: number; height: number; items: ViewText[] }[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: false }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const items: ViewText[] = [];
    for (const it of (await page.getTextContent()).items) {
      if (!("str" in it) || !it.str.trim()) continue;
      const m = pdfjs.Util.transform(viewport.transform, it.transform);
      const angle = Math.round((Math.atan2(m[1], m[0]) * 180) / Math.PI);
      items.push({ str: it.str, x: m[4], y: m[5], upright: m[0] > 0 && Math.abs(m[1]) < 1e-6, angle, width: it.width });
    }
    out.push({ width: viewport.width, height: viewport.height, items });
  }
  await doc.loadingTask.destroy();
  return out;
}
