import type { PDFDocumentProxy } from "pdfjs-dist";

/** Есть ли в документе текст (смотрим первые страницы — для сканов его нет). */
export async function hasTextLayer(pdf: PDFDocumentProxy): Promise<boolean> {
  for (let i = 1; i <= Math.min(3, pdf.numPages); i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    if (content.items.some((it) => "str" in it && it.str.trim())) return true;
  }
  return false;
}

/** Есть ли в документе поля формы (AcroForm). */
export async function hasFormFields(pdf: PDFDocumentProxy): Promise<boolean> {
  const fields = await pdf.getFieldObjects();
  return !!fields && Object.keys(fields).length > 0;
}
