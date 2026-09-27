"use client";

import { PDFDict, PDFDocument, PDFName, PDFRawStream } from "@cantoo/pdf-lib";
import { askPassword } from "@/lib/passwordPrompt";
import { PdfError } from "./errors";
import type { PdfSource } from "./read";

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

/**
 * Расшифровать файл, спрашивая пароль при необходимости. null — файл на самом деле не зашифрован.
 * Вызывается из readPdfFile (read.ts), только когда в файле есть /Encrypt.
 */
export async function decrypt(bytes: Uint8Array, name: string): Promise<{ bytes: Uint8Array; password: string } | null> {
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
