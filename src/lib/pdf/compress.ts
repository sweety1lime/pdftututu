/**
 * Сжатие PDF пережатием встроенных картинок.
 * Работает и в Web Worker (OffscreenCanvas + createImageBitmap), без DOM.
 */
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream, PDFRef } from "@cantoo/pdf-lib";
import { unzlibSync } from "fflate";

export interface CompressOptions {
  /** Качество JPEG 0..1 */
  quality: number;
  /** Максимальная сторона картинки в пикселях */
  maxDim: number;
}

export const COMPRESS_PRESETS = {
  light: { quality: 0.85, maxDim: 3000 },
  recommended: { quality: 0.68, maxDim: 1800 },
} satisfies Record<string, CompressOptions>;

export interface CompressResult {
  bytes: Uint8Array;
  images: number;
  replaced: number;
}

const N = {
  Subtype: PDFName.of("Subtype"),
  Image: PDFName.of("Image"),
  Filter: PDFName.of("Filter"),
  DecodeParms: PDFName.of("DecodeParms"),
  DCTDecode: PDFName.of("DCTDecode"),
  FlateDecode: PDFName.of("FlateDecode"),
  Width: PDFName.of("Width"),
  Height: PDFName.of("Height"),
  BitsPerComponent: PDFName.of("BitsPerComponent"),
  ColorSpace: PDFName.of("ColorSpace"),
  DeviceRGB: PDFName.of("DeviceRGB"),
  DeviceGray: PDFName.of("DeviceGray"),
  ICCBased: PDFName.of("ICCBased"),
  N: PDFName.of("N"),
  ImageMask: PDFName.of("ImageMask"),
  Mask: PDFName.of("Mask"),
  Decode: PDFName.of("Decode"),
  Length: PDFName.of("Length"),
  Predictor: PDFName.of("Predictor"),
  Colors: PDFName.of("Colors"),
  Columns: PDFName.of("Columns"),
};

type Ctx = PDFDocument["context"];

function num(ctx: Ctx, dict: PDFDict, key: PDFName): number | undefined {
  const v = ctx.lookup(dict.get(key));
  return v instanceof PDFNumber ? v.asNumber() : undefined;
}

/** Сколько компонент у цветового пространства (1 — серый, 3 — RGB), иначе null. */
function components(ctx: Ctx, dict: PDFDict): { comps: 1 | 3; keepColorSpace: boolean } | null {
  const cs = ctx.lookup(dict.get(N.ColorSpace));
  if (cs === N.DeviceRGB) return { comps: 3, keepColorSpace: true };
  if (cs === N.DeviceGray) return { comps: 1, keepColorSpace: false };
  if (cs instanceof PDFArray && cs.size() === 2 && ctx.lookup(cs.get(0)) === N.ICCBased) {
    const icc = ctx.lookup(cs.get(1));
    const dictOf = icc instanceof PDFRawStream ? icc.dict : null;
    const n = dictOf ? num(ctx, dictOf, N.N) : undefined;
    if (n === 3) return { comps: 3, keepColorSpace: true };
    if (n === 1) return { comps: 1, keepColorSpace: false };
  }
  return null;
}

function singleFilter(ctx: Ctx, dict: PDFDict): PDFName | null {
  const f = ctx.lookup(dict.get(N.Filter));
  if (f instanceof PDFName) return f;
  if (f instanceof PDFArray && f.size() === 1) {
    const inner = ctx.lookup(f.get(0));
    return inner instanceof PDFName ? inner : null;
  }
  return null;
}

/** Снять PNG-предиктор (DecodeParms /Predictor ≥ 10). */
function unpredictPng(data: Uint8Array, columns: number, bpp: number): Uint8Array {
  const rowLen = columns * bpp;
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  for (let r = 0; r < rows; r++) {
    const type = data[r * (rowLen + 1)];
    const src = r * (rowLen + 1) + 1;
    const dst = r * rowLen;
    const prev = dst - rowLen;
    for (let i = 0; i < rowLen; i++) {
      const raw = data[src + i];
      const left = i >= bpp ? out[dst + i - bpp] : 0;
      const up = r > 0 ? out[prev + i] : 0;
      const upLeft = r > 0 && i >= bpp ? out[prev + i - bpp] : 0;
      let v: number;
      switch (type) {
        case 1:
          v = raw + left;
          break;
        case 2:
          v = raw + up;
          break;
        case 3:
          v = raw + ((left + up) >> 1);
          break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          v = raw + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default:
          v = raw;
      }
      out[dst + i] = v & 255;
    }
  }
  return out;
}

async function decodeImage(
  ctx: Ctx,
  stream: PDFRawStream,
  filter: PDFName,
  width: number,
  height: number,
  comps: 1 | 3,
): Promise<ImageBitmap | null> {
  if (filter === N.DCTDecode) {
    return createImageBitmap(new Blob([stream.contents as BlobPart], { type: "image/jpeg" }));
  }
  // FlateDecode: сырые пиксели
  let data: Uint8Array = unzlibSync(stream.contents);
  const parms = ctx.lookup(stream.dict.get(N.DecodeParms));
  if (parms instanceof PDFDict) {
    const predictor = num(ctx, parms, N.Predictor) ?? 1;
    if (predictor >= 10) {
      const colors = num(ctx, parms, N.Colors) ?? 1;
      const columns = num(ctx, parms, N.Columns) ?? 1;
      if (colors !== comps || columns !== width) return null;
      data = unpredictPng(data, columns, comps);
    } else if (predictor !== 1) {
      return null;
    }
  } else if (parms) {
    return null;
  }
  if (data.length < width * height * comps) return null;

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let i = 0, j = 0; i < width * height; i++, j += comps) {
    const o = i * 4;
    if (comps === 3) {
      rgba[o] = data[j];
      rgba[o + 1] = data[j + 1];
      rgba[o + 2] = data[j + 2];
    } else {
      rgba[o] = rgba[o + 1] = rgba[o + 2] = data[j];
    }
    rgba[o + 3] = 255;
  }
  return createImageBitmap(new ImageData(rgba, width, height));
}

async function encodeJpeg(bitmap: ImageBitmap, w: number, h: number, quality: number): Promise<Uint8Array> {
  const canvas = new OffscreenCanvas(w, h);
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#fff";
  c.fillRect(0, 0, w, h);
  c.imageSmoothingQuality = "high";
  c.drawImage(bitmap, 0, 0, w, h);
  const blob = await canvas.convertToBlob({ type: "image/jpeg", quality });
  return new Uint8Array(await blob.arrayBuffer());
}

export async function compressPdfImages(
  bytes: Uint8Array,
  opts: CompressOptions,
  onProgress?: (done: number, total: number) => void,
): Promise<CompressResult> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ctx = doc.context;

  const candidates: Array<[PDFRef, PDFRawStream]> = [];
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream && obj.dict.get(N.Subtype) === N.Image) candidates.push([ref, obj]);
  }

  let replaced = 0;
  for (let i = 0; i < candidates.length; i++) {
    const [ref, stream] = candidates[i];
    onProgress?.(i, candidates.length);
    try {
      const next = await recompress(ctx, stream, opts);
      if (next) {
        ctx.assign(ref, next);
        replaced++;
      }
    } catch (e) {
      // Картинку, которую не смогли разобрать, просто оставляем как есть
      console.warn("skip image", e);
    }
  }
  onProgress?.(candidates.length, candidates.length);

  const out = await doc.save({ useObjectStreams: true });
  return { bytes: out, images: candidates.length, replaced };
}

async function recompress(ctx: Ctx, stream: PDFRawStream, opts: CompressOptions): Promise<PDFRawStream | null> {
  const dict = stream.dict;
  if (stream.contents.length < 16 * 1024) return null; // мелочь не трогаем
  if (ctx.lookup(dict.get(N.ImageMask))?.toString() === "true") return null;
  if (dict.has(N.Decode)) return null;
  if (ctx.lookup(dict.get(N.Mask)) instanceof PDFArray) return null; // маска по цвету
  if (num(ctx, dict, N.BitsPerComponent) !== 8) return null;

  const filter = singleFilter(ctx, dict);
  if (filter !== N.DCTDecode && filter !== N.FlateDecode) return null;
  const cs = components(ctx, dict);
  if (!cs) return null;

  const width = num(ctx, dict, N.Width);
  const height = num(ctx, dict, N.Height);
  if (!width || !height) return null;

  const bitmap = await decodeImage(ctx, stream, filter, width, height, cs.comps);
  if (!bitmap) return null;

  const scale = Math.min(1, opts.maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const jpeg = await encodeJpeg(bitmap, w, h, opts.quality);
  bitmap.close();

  // Для «чистых» (Flate) картинок требуем заметный выигрыш — JPEG портит чертежи и скриншоты
  const threshold = filter === N.FlateDecode ? 0.6 : 0.9;
  if (jpeg.length >= stream.contents.length * threshold) return null;

  const newDict = dict.clone(ctx);
  newDict.set(N.Filter, N.DCTDecode);
  newDict.delete(N.DecodeParms);
  newDict.set(N.Width, PDFNumber.of(w));
  newDict.set(N.Height, PDFNumber.of(h));
  newDict.set(N.BitsPerComponent, PDFNumber.of(8));
  if (!cs.keepColorSpace) newDict.set(N.ColorSpace, N.DeviceRGB);
  newDict.set(N.Length, PDFNumber.of(jpeg.length));
  return PDFRawStream.of(newDict, jpeg);
}
