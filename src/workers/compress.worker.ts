import * as Comlink from "comlink";
import { compressPdfImages, type CompressOptions } from "@/lib/pdf/compress";

const api = {
  compress: (bytes: Uint8Array, opts: CompressOptions, onProgress?: (done: number, total: number) => void) =>
    compressPdfImages(bytes, opts, onProgress).then((r) => Comlink.transfer(r, [r.bytes.buffer as ArrayBuffer])),
};

export type CompressWorkerApi = typeof api;

Comlink.expose(api);
