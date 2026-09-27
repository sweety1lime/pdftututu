"use client";

import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from "pdfjs-dist";

type PdfJs = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJs> | null = null;

/** Ленивая загрузка pdf.js (≈1 МБ) только там, где он нужен. */
export function getPdfjs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((pdfjs) => {
      // Файлы копируются из node_modules в public/pdfjs скриптом scripts/copy-pdfjs.mjs
      pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs/pdf.worker.min.mjs";
      return pdfjs;
    });
  }
  return pdfjsPromise;
}

export async function openPdfjs(bytes: Uint8Array): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  return pdfjs.getDocument({
    // pdf.js передаёт буфер в воркер и «отбирает» его — поэтому отдаём копию
    data: bytes.slice(),
    cMapUrl: "/pdfjs/cmaps/",
    cMapPacked: true,
    standardFontDataUrl: "/pdfjs/standard_fonts/",
    wasmUrl: "/pdfjs/wasm/",
    iccUrl: "/pdfjs/iccs/",
    // Нужны реальные имена шрифтов (Arial-Bold и т.п.) для «Править текст»
    fontExtraProperties: true,
  }).promise;
}

/** Закрыть документ pdf.js и освободить память воркера. */
export function closePdfjs(doc: PDFDocumentProxy | null | undefined): void {
  doc?.loadingTask.destroy().catch(() => {});
}

export interface RenderOptions {
  /** Масштаб относительно PDF-точек (1 = 72 DPI). Плотность пикселей экрана учитывайте сами. */
  scale: number;
  /** Не рисовать значения полей форм (их показывает редактор поверх). */
  hideForms?: boolean;
}

/** Нарисовать страницу в canvas. Возвращает задачу, которую можно отменить. */
export async function renderPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  { scale, hideForms }: RenderOptions,
): Promise<RenderTask> {
  const pdfjs = await getPdfjs();
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  return page.render({
    canvas,
    viewport,
    annotationMode: hideForms ? pdfjs.AnnotationMode.ENABLE_FORMS : pdfjs.AnnotationMode.ENABLE,
  });
}

/** Отрисовать страницу в новый canvas (для экспорта в картинку, OCR, миниатюр). */
export async function renderPageToNewCanvas(
  page: PDFPageProxy,
  scale: number,
  background = "#ffffff",
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const viewport = page.getViewport({ scale });
  canvas.width = Math.max(1, Math.floor(viewport.width));
  canvas.height = Math.max(1, Math.floor(viewport.height));
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport, background }).promise;
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/png", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), type, quality),
  );
}

export async function canvasToBytes(canvas: HTMLCanvasElement, type = "image/png", quality?: number) {
  return new Uint8Array(await (await canvasToBlob(canvas, type, quality)).arrayBuffer());
}

/**
 * Очередь рендера миниатюр: не больше N одновременно, чтобы 500-страничный
 * документ не подвесил вкладку.
 */
class RenderQueue {
  private running = 0;
  private queue: Array<() => void> = [];
  constructor(private limit: number) {}

  run<T>(job: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const start = () => {
        this.running++;
        job()
          .then(resolve, reject)
          .finally(() => {
            this.running--;
            this.queue.shift()?.();
          });
      };
      if (this.running < this.limit) start();
      else this.queue.push(start);
    });
  }
}

const thumbQueue = new RenderQueue(3);

/** Миниатюра страницы как object URL (ширина ≈ width CSS-пикселей с учётом ретины). */
export function renderThumbnail(doc: PDFDocumentProxy, pageIndex: number, width: number): Promise<string> {
  return thumbQueue.run(async () => {
    const page = await doc.getPage(pageIndex + 1);
    const base = page.getViewport({ scale: 1 });
    const dpr = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
    const canvas = await renderPageToNewCanvas(page, (width * dpr) / base.width);
    const blob = await canvasToBlob(canvas, "image/jpeg", 0.8);
    canvas.width = canvas.height = 0; // освобождаем память (на iPhone её мало)
    return URL.createObjectURL(blob);
  });
}
