"use client";

import { newId } from "@/lib/id";
import { PdfError } from "./errors";

/**
 * Чтение PDF-файла. pdf-lib (~570 КБ) здесь не нужен: он загружается, только если
 * файл зашифрован (см. load.ts), — чтобы страницы не тянули его до выбора файла.
 */
export interface PdfSource {
  id: string;
  name: string;
  /** Байты PDF. Если файл был зашифрован — уже расшифрованные. */
  bytes: Uint8Array;
  wasEncrypted: boolean;
  /** Пароль, которым открыли файл (нужен инструменту «Снять пароль»). */
  password?: string;
}

function indexOfBytes(haystack: Uint8Array, needle: number[], from = 0, to = haystack.length): number {
  const first = needle[0];
  const end = Math.min(to, haystack.length) - needle.length;
  outer: for (let i = from; i <= end; i++) {
    if (haystack[i] !== first) continue;
    for (let j = 1; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return i;
  }
  return -1;
}

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const PDF_HEADER = ascii("%PDF-");
const ENCRYPT_KEY = ascii("/Encrypt");

export function looksLikePdf(bytes: Uint8Array): boolean {
  return indexOfBytes(bytes, PDF_HEADER, 0, 1024) !== -1;
}

/** Быстрая проверка: есть ли в файле словарь шифрования (/Encrypt в trailer). */
export function hasEncryptMarker(bytes: Uint8Array): boolean {
  return indexOfBytes(bytes, ENCRYPT_KEY) !== -1;
}

/**
 * Загрузить pdf-lib заранее, когда файл уже открыт: пока человек выбирает настройки,
 * он скачается, и главная кнопка сработает без задержки.
 */
export function preloadPdfLib() {
  const load = () => void import("./load").catch(() => {});
  if ("requestIdleCallback" in window) requestIdleCallback(load);
  else setTimeout(load, 200);
}

/** Прочитать PDF-файл: проверка формата + расшифровка, если нужно. */
export async function readPdfFile(file: File | { name: string; bytes: Uint8Array }): Promise<PdfSource> {
  const name = file.name;
  const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : file.bytes;
  if (!looksLikePdf(bytes)) throw new PdfError("notPdf", name);

  if (hasEncryptMarker(bytes)) {
    const { decrypt } = await import("./load");
    let result: Awaited<ReturnType<typeof decrypt>>;
    try {
      result = await decrypt(bytes, name);
    } catch (e) {
      if (e instanceof PdfError) throw e;
      throw new PdfError("corrupted", name, e);
    }
    if (result) {
      return { id: newId("pdf"), name, bytes: result.bytes, wasEncrypted: true, password: result.password };
    }
  }
  return { id: newId("pdf"), name, bytes, wasEncrypted: false };
}
