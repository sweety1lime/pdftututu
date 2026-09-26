import { beforeAll, describe, expect, it } from "vitest";
import { degrees, PDFArray, PDFDict, PDFDocument, PDFName, PDFString, StandardFonts } from "@cantoo/pdf-lib";
import { removeUnreachableObjects, replacePageWithImage } from "@/lib/pdf/scrub";
import { extractText, fileContains, makePdf, makePng, useDiskFonts } from "./helpers";

beforeAll(() => useDiskFonts());

/**
 * Две страницы. На первой — «секреты» во всех местах, где их можно спрятать:
 * текст страницы, поле формы, заметка, тег с /ActualText. На второй — то,
 * что должно уцелеть, и ссылка на первую страницу.
 */
async function makeSecretPdf() {
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  const p2 = doc.addPage([595, 842]);
  p1.drawText("SECRET TEXT", { x: 50, y: 780, size: 24, font });
  p2.drawText("Page 2", { x: 50, y: 780, size: 24, font });

  const form = doc.getForm();
  const secret = form.createTextField("secret");
  secret.setText("SECRET-VALUE");
  secret.addToPage(p1, { x: 50, y: 700, width: 200, height: 24 });
  const keep = form.createTextField("keep");
  keep.setText("KEEP-VALUE");
  keep.addToPage(p2, { x: 50, y: 700, width: 200, height: 24 });

  const note = ctx.obj({ Type: "Annot", Subtype: "Text", Rect: [0, 0, 20, 20], Contents: PDFString.of("SECRET-NOTE") });
  p1.node.addAnnot(ctx.register(note));
  const link = ctx.obj({ Type: "Annot", Subtype: "Link", Rect: [0, 0, 20, 20], Dest: [p1.ref, "Fit"] });
  p2.node.addAnnot(ctx.register(link));

  const tag = ctx.obj({ S: "P", Pg: p1.ref, ActualText: PDFString.of("SECRET-TAG") });
  doc.catalog.set(PDFName.of("StructTreeRoot"), ctx.register(ctx.obj({ Type: "StructTreeRoot", K: tag })));

  return doc.save();
}

async function rasterizeFirstPage(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const image = await doc.embedPng(makePng());
  replacePageWithImage(doc, 0, image, 300, 400);
  removeUnreachableObjects(doc);
  return doc.save({ useObjectStreams: true });
}

describe("растрирование страницы", () => {
  it("не оставляет в файле ничего от старой страницы", async () => {
    const src = await makeSecretPdf();
    const secrets = ["SECRET TEXT", "SECRET-VALUE", "SECRET-NOTE", "SECRET-TAG"];
    // Проверяем, что поиск вообще видит эти строки
    for (const s of secrets) expect(await fileContains(src, s), s).toBe(true);

    const out = await rasterizeFirstPage(src);
    for (const s of secrets) expect(await fileContains(out, s), s).toBe(false);
  });

  it("сохраняет остальные страницы, поля и ссылки", async () => {
    const out = await rasterizeFirstPage(await makeSecretPdf());
    expect(await fileContains(out, "KEEP-VALUE")).toBe(true);
    const text = await extractText(out);
    expect(text[0].trim()).toBe("");
    expect(text[1]).toContain("Page 2");

    const doc = await PDFDocument.load(out);
    expect(doc.getForm().getFields().map((f) => f.getName())).toEqual(["keep"]);
    // Ссылка со второй страницы по-прежнему ведёт на первую
    const annots = doc.getPage(1).node.lookup(PDFName.of("Annots"), PDFArray);
    const link = annots
      .asArray()
      .map((ref) => doc.context.lookup(ref, PDFDict))
      .find((a) => a.get(PDFName.of("Subtype")) === PDFName.of("Link"))!;
    expect(link.lookup(PDFName.of("Dest"), PDFArray).get(0)).toBe(doc.getPage(0).ref);
  });

  it("задаёт размер явно: поворот и унаследованные поля страницы не мешают", async () => {
    const doc = await PDFDocument.load(await makePdf(1, { rotate: 90 }));
    doc.catalog.Pages().set(PDFName.of("CropBox"), doc.context.obj([0, 0, 100, 100]));
    replacePageWithImage(doc, 0, await doc.embedPng(makePng()), 300, 400);
    const page = (await PDFDocument.load(await doc.save())).getPage(0);
    expect(page.getRotation()).toEqual(degrees(0));
    expect(page.getMediaBox()).toEqual({ x: 0, y: 0, width: 300, height: 400 });
    expect(page.getCropBox()).toEqual({ x: 0, y: 0, width: 300, height: 400 });
  });

  it("чистка не трогает объекты, на которые есть ссылки", async () => {
    const src = await makePdf(3);
    const doc = await PDFDocument.load(src);
    // Первый проход убирает контейнеры ObjStm/XRef, оставшиеся от загрузки
    expect(removeUnreachableObjects(doc)).toBeGreaterThan(0);
    doc.context.register(PDFString.of("ORPHAN"));
    expect(removeUnreachableObjects(doc)).toBe(1);
    const out = await doc.save();
    expect(await fileContains(out, "ORPHAN")).toBe(false);
    expect(await extractText(out)).toEqual(await extractText(src));
  });
});
