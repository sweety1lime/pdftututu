/**
 * Удаление данных из PDF без следов.
 *
 * pdf-lib при сохранении пишет в файл ВСЕ объекты документа, даже те, на которые
 * уже никто не ссылается. Поэтому «удалить страницу» или «заменить контент» мало:
 * старый content stream с текстом остаётся в файле и извлекается любым парсером.
 */
import {
  PDFAcroTerminal,
  PDFArray,
  PDFDict,
  PDFName,
  PDFNumber,
  PDFRef,
  PDFStream,
  type PDFDocument,
  type PDFImage,
} from "@cantoo/pdf-lib";

const N = {
  Type: PDFName.of("Type"),
  Parent: PDFName.of("Parent"),
  Annots: PDFName.of("Annots"),
  MediaBox: PDFName.of("MediaBox"),
  CropBox: PDFName.of("CropBox"),
  Rotate: PDFName.of("Rotate"),
  Resources: PDFName.of("Resources"),
  Contents: PDFName.of("Contents"),
  StructTreeRoot: PDFName.of("StructTreeRoot"),
  MarkInfo: PDFName.of("MarkInfo"),
  XFA: PDFName.of("XFA"),
};

/**
 * Заменить содержимое страницы картинкой на месте. Ссылка на страницу сохраняется,
 * поэтому закладки и ссылки на неё продолжают работать. Всё прочее (контент, ресурсы,
 * аннотации, миниатюра, данные программ) удаляется, как и поля форм, которые были
 * только на этой странице.
 *
 * После всех замен вызовите {@link removeUnreachableObjects}, иначе старые данные
 * останутся в файле.
 */
export function replacePageWithImage(doc: PDFDocument, index: number, image: PDFImage, width: number, height: number) {
  const ctx = doc.context;
  const node = doc.getPage(index).node;

  const annots = new Set<PDFDict>();
  for (const ref of node.lookupMaybe(N.Annots, PDFArray)?.asArray() ?? []) {
    const annot = ctx.lookup(ref);
    if (annot instanceof PDFDict) annots.add(annot);
  }
  removeFieldsWithin(doc, annots);

  for (const key of node.keys()) {
    if (key !== N.Type && key !== N.Parent) node.delete(key);
  }
  // CropBox и Rotate наследуются от родителя — задаём явно
  const box = ctx.obj([0, 0, width, height]);
  node.set(N.MediaBox, box);
  node.set(N.CropBox, box);
  node.set(N.Rotate, PDFNumber.of(0));
  node.set(N.Resources, ctx.obj({ XObject: { Im0: image.ref } }));
  node.set(N.Contents, ctx.register(ctx.flateStream(`q ${width} 0 0 ${height} 0 0 cm /Im0 Do Q`)));

  // Дерево тегов ссылается на разметку старого контента и может хранить его текст
  // (/ActualText, /Alt) — после растрирования оно всё равно недействительно.
  doc.catalog.delete(N.StructTreeRoot);
  doc.catalog.delete(N.MarkInfo);
}

/** Удалить поля формы, все виджеты которых — среди этих аннотаций. */
function removeFieldsWithin(doc: PDFDocument, annots: Set<PDFDict>) {
  const acroForm = doc.catalog.getAcroForm();
  if (!acroForm || !annots.size) return;
  let removed = false;
  for (const [field] of acroForm.getAllFields()) {
    if (!(field instanceof PDFAcroTerminal)) continue;
    const widgets = field.getWidgets();
    if (widgets.length && widgets.every((w) => annots.has(w.dict))) {
      // Опустевших родителей pdf-lib удаляет сам
      acroForm.removeField(field);
      removed = true;
    }
  }
  // XFA хранит значения полей отдельно от AcroForm
  if (removed) acroForm.dict.delete(N.XFA);
}

/**
 * Удалить объекты, до которых нельзя добраться от корня документа. Заодно уходят
 * контейнеры ObjStm и XRef-потоки исходного файла: pdf-lib распаковывает их при
 * загрузке, но сами потоки (с прежними копиями объектов) оставляет и пишет снова.
 * @returns сколько объектов удалено
 */
export function removeUnreachableObjects(doc: PDFDocument): number {
  const ctx = doc.context;
  const reached = new Set<PDFRef>();
  const { Root, Info, Encrypt } = ctx.trailerInfo;
  const stack: unknown[] = [Root, Info, Encrypt];
  while (stack.length) {
    const obj = stack.pop();
    if (obj instanceof PDFRef) {
      if (reached.has(obj)) continue;
      reached.add(obj);
      stack.push(ctx.lookup(obj));
    } else if (obj instanceof PDFDict) {
      for (const v of obj.values()) stack.push(v);
    } else if (obj instanceof PDFArray) {
      for (const v of obj.asArray()) stack.push(v);
    } else if (obj instanceof PDFStream) {
      stack.push(obj.dict);
    }
  }

  let removed = 0;
  for (const [ref] of ctx.enumerateIndirectObjects()) {
    if (!reached.has(ref)) {
      ctx.delete(ref);
      removed++;
    }
  }
  return removed;
}
