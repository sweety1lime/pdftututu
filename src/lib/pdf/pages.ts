import { degrees, PDFDocument } from "@cantoo/pdf-lib";
import { normalizeRotation } from "./coords";

const load = (bytes: Uint8Array) => PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });

async function newDoc() {
  const doc = await PDFDocument.create();
  doc.setProducer("PDFtutut");
  doc.setCreator("PDFtutut");
  return doc;
}

export async function getPageCount(bytes: Uint8Array): Promise<number> {
  return (await load(bytes)).getPageCount();
}

/** Склеить несколько PDF в один. */
export async function mergePdfs(files: Uint8Array[]): Promise<Uint8Array> {
  const out = await newDoc();
  for (const bytes of files) {
    const src = await load(bytes);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const p of pages) out.addPage(p);
  }
  return out.save();
}

/** Каждую группу индексов — в отдельный PDF. Исходник загружается один раз. */
export async function splitPdf(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const src = await load(bytes);
  const result: Uint8Array[] = [];
  for (const group of groups) {
    const out = await newDoc();
    const pages = await out.copyPages(src, group);
    for (const p of pages) out.addPage(p);
    result.push(await out.save());
  }
  return result;
}

export type PageItem =
  | { id: string; kind: "page"; sourceId: string; pageIndex: number; rotation: number }
  | { id: string; kind: "blank"; width: number; height: number; rotation: number };

/**
 * Собрать документ из списка страниц (инструмент «Страницы»).
 * Страницы одного источника копируются одним вызовом copyPages,
 * чтобы общие ресурсы (шрифты, картинки) не дублировались.
 */
export async function buildFromItems(items: PageItem[], sources: Record<string, Uint8Array>): Promise<Uint8Array> {
  const out = await newDoc();

  const bySource = new Map<string, number[]>();
  for (const it of items) {
    if (it.kind !== "page") continue;
    const list = bySource.get(it.sourceId) ?? [];
    if (!list.includes(it.pageIndex)) list.push(it.pageIndex);
    bySource.set(it.sourceId, list);
  }

  const copied = new Map<string, Map<number, import("@cantoo/pdf-lib").PDFPage>>();
  for (const [sourceId, indices] of bySource) {
    const src = await load(sources[sourceId]);
    const pages = await out.copyPages(src, indices);
    copied.set(sourceId, new Map(indices.map((idx, k) => [idx, pages[k]])));
  }

  const used = new Set<import("@cantoo/pdf-lib").PDFPage>();
  for (const it of items) {
    if (it.kind === "blank") {
      const page = out.addPage([it.width, it.height]);
      page.setRotation(degrees(normalizeRotation(it.rotation)));
      continue;
    }
    let page = copied.get(it.sourceId)!.get(it.pageIndex)!;
    if (used.has(page)) {
      // Та же страница второй раз (дубликат) — нужна отдельная копия
      const src = await load(sources[it.sourceId]);
      [page] = await out.copyPages(src, [it.pageIndex]);
    }
    used.add(page);
    page.setRotation(degrees(normalizeRotation(page.getRotation().angle + it.rotation)));
    out.addPage(page);
  }
  return out.save();
}

export const PAGE_SIZES = {
  a4: [595.28, 841.89] as const,
  letter: [612, 792] as const,
};

export interface PreparedImage {
  bytes: Uint8Array;
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

export interface ImagesToPdfOptions {
  pageSize: "fit" | "a4" | "letter";
  orientation: "auto" | "portrait" | "landscape";
  /** Поля в PDF-точках */
  margin: number;
}

/** Картинки → PDF: по одной картинке на страницу, с сохранением пропорций. */
export async function imagesToPdf(images: PreparedImage[], opts: ImagesToPdfOptions): Promise<Uint8Array> {
  const out = await newDoc();
  for (const img of images) {
    const embedded = img.mime === "image/png" ? await out.embedPng(img.bytes) : await out.embedJpg(img.bytes);
    // Размер «как у картинки»: 96 DPI → точки
    const natW = (img.width * 72) / 96;
    const natH = (img.height * 72) / 96;
    let pageW: number;
    let pageH: number;
    if (opts.pageSize === "fit") {
      pageW = natW + opts.margin * 2;
      pageH = natH + opts.margin * 2;
    } else {
      const [w, h] = PAGE_SIZES[opts.pageSize];
      const landscape = opts.orientation === "landscape" || (opts.orientation === "auto" && img.width > img.height);
      [pageW, pageH] = landscape ? [h, w] : [w, h];
    }
    const page = out.addPage([pageW, pageH]);
    const boxW = pageW - opts.margin * 2;
    const boxH = pageH - opts.margin * 2;
    const scale = opts.pageSize === "fit" ? 1 : Math.min(boxW / natW, boxH / natH);
    const w = natW * scale;
    const h = natH * scale;
    page.drawImage(embedded, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
  }
  return out.save();
}
