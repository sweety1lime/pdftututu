"use client";

import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "@cantoo/pdf-lib";
import { askPassword } from "@/lib/passwordPrompt";
import { PdfError } from "./errors";

export interface PdfSource {
  id: string;
  name: string;
  /** Байты PDF. Если файл был зашифрован — уже расшифрованные. */
  bytes: Uint8Array;
  wasEncrypted: boolean;
  /** Пароль, которым открыли файл (нужен инструменту «Снять пароль»). */
  password?: string;
}

let counter = 0;
export const newId = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

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
 * Расшифровать PDF паролем и вернуть файл БЕЗ шифрования.
 * pdf-lib убирает /Encrypt из trailer, но сам словарь шифрования остаётся
 * в документе и при следующем открытии файл снова выглядит зашифрованным —
 * поэтому удаляем такие «хвосты» вручную.
 */
export async function decryptWithPassword(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { password, updateMetadata: false });
  const ctx = doc.context;
  const Filter = PDFName.of("Filter");
  const Standard = PDFName.of("Standard");
  const XRef = PDFName.of("XRef");
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    const dict = obj instanceof PDFDict ? obj : obj instanceof PDFRawStream ? obj.dict : null;
    if (!dict) continue;
    const isEncryptDict = dict.get(Filter) === Standard && dict.has(PDFName.of("O")) && dict.has(PDFName.of("U"));
    const isOldXref = dict.get(PDFName.of("Type")) === XRef;
    if (isEncryptDict || isOldXref) ctx.delete(ref);
  }
  delete ctx.trailerInfo.Encrypt;
  return doc.save();
}

/** Открыть pdf-lib документом, спрашивая пароль при необходимости. */
async function decrypt(bytes: Uint8Array, name: string): Promise<{ bytes: Uint8Array; password: string } | null> {
  // Проверяем по-честному: /Encrypt мог встретиться случайно
  const probe = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  if (!probe.isEncrypted) return null;

  // Многие файлы зашифрованы только паролем владельца (пустой пароль на открытие)
  let password = "";
  let wrong = false;
  for (;;) {
    try {
      return { bytes: await decryptWithPassword(bytes, password), password };
    } catch (e) {
      if (!isPasswordError(e)) throw new PdfError("corrupted", name, e);
      const answer = await askPassword(name, wrong);
      if (answer === null) throw new PdfError("cancelled", name);
      password = answer;
      wrong = true;
    }
  }
}

function isPasswordError(e: unknown): boolean {
  const msg = e instanceof Error ? `${e.name} ${e.message}` : String(e);
  return /password|decrypt|encrypt/i.test(msg);
}

/** Прочитать PDF-файл: проверка формата + расшифровка, если нужно. */
export async function readPdfFile(file: File | { name: string; bytes: Uint8Array }): Promise<PdfSource> {
  const name = file.name;
  const bytes = file instanceof File ? new Uint8Array(await file.arrayBuffer()) : file.bytes;
  if (!looksLikePdf(bytes)) throw new PdfError("notPdf", name);

  if (hasEncryptMarker(bytes)) {
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

/** Загрузить уже расшифрованный PDF в pdf-lib для изменений. */
export async function loadForEdit(src: PdfSource | Uint8Array): Promise<PDFDocument> {
  const bytes = src instanceof Uint8Array ? src : src.bytes;
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  } catch (e) {
    throw new PdfError("corrupted", src instanceof Uint8Array ? "" : src.name, e);
  }
}

/** Создать новый документ с проставленными метаданными. */
export async function createPdf(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  doc.setProducer("PDFtutut");
  doc.setCreator("PDFtutut");
  return doc;
}
