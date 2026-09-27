import * as Comlink from "comlink";
import { COMPRESS_PRESETS, compressPdfImages } from "@/lib/pdf/compress";

export type CompressLevel = keyof typeof COMPRESS_PRESETS;

const api = {
  // Настройки по степени сжатия берёт сам воркер — интерфейсу не нужен модуль сжатия с pdf-lib
  compress: (bytes: Uint8Array, level: CompressLevel, onProgress?: (done: number, total: number) => void) =>
    compressPdfImages(bytes, COMPRESS_PRESETS[level], onProgress).then((r) =>
      Comlink.transfer(r, [r.bytes.buffer as ArrayBuffer]),
    ),
};

export type CompressWorkerApi = typeof api;

Comlink.expose(api);
