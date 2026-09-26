import { PDFDocument } from "@cantoo/pdf-lib";

export interface ProtectOptions {
  userPassword: string;
  ownerPassword?: string;
  allowPrint: boolean;
  allowCopy: boolean;
  allowModify: boolean;
  allowAnnotate: boolean;
}

/** Зашифровать PDF (AES-256). */
export async function protectPdf(bytes: Uint8Array, o: ProtectOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  doc.encrypt({
    userPassword: o.userPassword,
    ownerPassword: o.ownerPassword || o.userPassword,
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
