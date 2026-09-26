export type PdfErrorCode = "notPdf" | "corrupted" | "cancelled" | "unsupportedImage" | "xfa";

/** Ошибка с кодом — UI превращает код в понятный текст на нужном языке. */
export class PdfError extends Error {
  constructor(
    public code: PdfErrorCode,
    public fileName = "",
    cause?: unknown,
  ) {
    super(`${code}: ${fileName}`, { cause });
    this.name = "PdfError";
  }
}

export function isCancelled(e: unknown): boolean {
  return e instanceof PdfError && e.code === "cancelled";
}
