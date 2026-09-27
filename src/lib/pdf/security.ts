import { PDFDocument } from "@cantoo/pdf-lib";

export interface ProtectOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrint: boolean;
  allowCopy: boolean;
  allowModify: boolean;
  allowAnnotate: boolean;
}

/**
 * Пароль владельца. Кто его знает, тот не связан ограничениями, поэтому при ограничениях
 * он не может совпадать с паролем на открытие — иначе запреты ничего не запрещают.
 * Если его не задали, берём случайный: ограничения действуют, а снять защиту целиком
 * по-прежнему можно паролем на открытие («Снять пароль»).
 */
export function ownerPasswordFor(o: ProtectOptions): string {
  if (o.ownerPassword) return o.ownerPassword;
  const restricted = !o.allowPrint || !o.allowCopy || !o.allowModify || !o.allowAnnotate;
  if (!restricted) return o.userPassword;
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Зашифровать PDF (AES-256). */
export async function protectPdf(bytes: Uint8Array, o: ProtectOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  doc.encrypt({
    userPassword: o.userPassword,
    ownerPassword: ownerPasswordFor(o),
    permissions: {
      printing: o.allowPrint ? "highResolution" : false,
      copying: o.allowCopy,
      modifying: o.allowModify,
      annotating: o.allowAnnotate,
      fillingForms: o.allowAnnotate,
      contentAccessibility: true,
      documentAssembly: o.allowModify,
    },
  });
  return doc.save();
}
