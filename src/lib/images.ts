"use client";

import { PdfError } from "./pdf/errors";
import type { PreparedImage } from "./pdf/pages";

/** Ориентация из EXIF у JPEG (1 — нормальная). Телефоны часто пишут 6 или 8. */
export function jpegOrientation(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 < view.byteLength) {
    const marker = view.getUint16(offset);
    const size = view.getUint16(offset + 2);
    if (marker === 0xffe1 && view.getUint32(offset + 4) === 0x45786966 /* Exif */) {
      const tiff = offset + 10;
      const little = view.getUint16(tiff) === 0x4949;
      const ifd = tiff + view.getUint32(tiff + 4, little);
      const count = view.getUint16(ifd, little);
      for (let i = 0; i < count; i++) {
        const entry = ifd + 2 + i * 12;
        if (entry + 10 > view.byteLength) break;
        if (view.getUint16(entry, little) === 0x0112) return view.getUint16(entry + 8, little);
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    offset += 2 + size;
  }
  return 1;
}

async function decodeToCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  // createImageBitmap сам применяет EXIF-поворот
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

async function canvasBytes(canvas: HTMLCanvasElement, type: string, quality?: number) {
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), type, quality),
  );
  return new Uint8Array(await blob.arrayBuffer());
}

function hasAlpha(canvas: HTMLCanvasElement): boolean {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4 * 7) if (data[i] < 255) return true;
  return false;
}

/**
 * Привести картинку к виду, который умеет встраивать pdf-lib (PNG/JPEG),
 * учесть EXIF-поворот и узнать размеры.
 */
export async function prepareImage(file: Blob & { name?: string }): Promise<PreparedImage> {
  const name = file.name ?? "image";
  const type = file.type || "";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = type === "image/jpeg" || (bytes[0] === 0xff && bytes[1] === 0xd8);
  const isPng = type === "image/png" || (bytes[0] === 0x89 && bytes[1] === 0x50);

  let canvas: HTMLCanvasElement;
  try {
    canvas = await decodeToCanvas(new Blob([bytes], { type: type || undefined }));
  } catch (e) {
    throw new PdfError("unsupportedImage", name, e);
  }

  if (isJpeg && jpegOrientation(bytes) === 1) {
    return { bytes, mime: "image/jpeg", width: canvas.width, height: canvas.height };
  }
  if (isPng) {
    return { bytes, mime: "image/png", width: canvas.width, height: canvas.height };
  }
  // Повёрнутый JPEG, WebP, GIF, BMP… — перекодируем
  const alpha = hasAlpha(canvas);
  const out = alpha ? await canvasBytes(canvas, "image/png") : await canvasBytes(canvas, "image/jpeg", 0.92);
  return { bytes: out, mime: alpha ? "image/png" : "image/jpeg", width: canvas.width, height: canvas.height };
}

export const IMAGE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/bmp": [".bmp"],
};
