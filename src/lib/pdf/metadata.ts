/**
 * Свойства документа: название, автор и т.п.
 *
 * Хранятся в двух местах: словарь Info (его читают почти все программы) и XMP-поток
 * в каталоге (/Metadata — его предпочитает Acrobat). pdf-lib меняет только Info,
 * поэтому устаревший XMP при сохранении удаляем — иначе в разных программах
 * были бы видны разные значения, а в файле осталось бы старое.
 */
import { PDFDict, PDFName, type PDFDocument } from "@cantoo/pdf-lib";
import { loadForEdit } from "./load";
import { METADATA_FIELDS, type MetadataField } from "./metadataFields";
import { removeUnreachableObjects } from "./scrub";

export interface PdfMetadata extends Record<MetadataField, string> {
  created?: Date;
  modified?: Date;
  /** Есть XMP-поток или служебные данные программ (PieceInfo) */
  hasHiddenData: boolean;
}

const N = {
  Metadata: PDFName.of("Metadata"),
  PieceInfo: PDFName.of("PieceInfo"),
};

const KEYS: Record<MetadataField, string> = {
  title: "Title",
  author: "Author",
  subject: "Subject",
  keywords: "Keywords",
  creator: "Creator",
  producer: "Producer",
};

function infoDict(doc: PDFDocument): PDFDict | undefined {
  const info = doc.context.lookup(doc.context.trailerInfo.Info);
  return info instanceof PDFDict ? info : undefined;
}

function hiddenData(doc: PDFDocument): boolean {
  const onPages = doc.getPages().some((p) => p.node.has(N.Metadata) || p.node.has(N.PieceInfo));
  return doc.catalog.has(N.Metadata) || doc.catalog.has(N.PieceInfo) || onPages;
}

export async function readMetadata(bytes: Uint8Array): Promise<PdfMetadata> {
  const doc = await loadForEdit(bytes);
  // getKeywords() вернёт строку как есть — pdf-lib склеивает ключевые слова через пробел
  return {
    title: doc.getTitle() ?? "",
    author: doc.getAuthor() ?? "",
    subject: doc.getSubject() ?? "",
    keywords: doc.getKeywords() ?? "",
    creator: doc.getCreator() ?? "",
    producer: doc.getProducer() ?? "",
    created: doc.getCreationDate(),
    modified: doc.getModificationDate(),
    hasHiddenData: hiddenData(doc),
  };
}

/**
 * Записать свойства. Пустое поле — удалить. С clearAll удаляются ещё даты,
 * XMP и служебные данные программ на всех страницах.
 */
export async function writeMetadata(
  bytes: Uint8Array,
  fields: Record<MetadataField, string>,
  { clearAll = false } = {},
): Promise<Uint8Array> {
  const doc = await loadForEdit(bytes);
  const ctx = doc.context;

  if (clearAll) {
    delete ctx.trailerInfo.Info;
    doc.catalog.delete(N.PieceInfo);
    for (const page of doc.getPages()) {
      page.node.delete(N.Metadata);
      page.node.delete(N.PieceInfo);
    }
  } else {
    for (const field of METADATA_FIELDS) {
      const value = fields[field].trim();
      const key = PDFName.of(KEYS[field]);
      if (!value) infoDict(doc)?.delete(key);
      else if (field === "title") doc.setTitle(value);
      else if (field === "author") doc.setAuthor(value);
      else if (field === "subject") doc.setSubject(value);
      else if (field === "keywords") doc.setKeywords([value]);
      else if (field === "creator") doc.setCreator(value);
      else doc.setProducer(value);
    }
  }
  doc.catalog.delete(N.Metadata);
  // Удалённые потоки иначе остались бы в файле
  removeUnreachableObjects(doc);
  return doc.save();
}
