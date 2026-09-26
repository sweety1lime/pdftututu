import { describe, expect, it } from "vitest";
import { PDFDocument, PDFName } from "@cantoo/pdf-lib";
import { readMetadata, writeMetadata } from "@/lib/pdf/metadata";
import { fileContains, makePdf } from "./helpers";

/** PDF с заполненными свойствами, XMP-потоком и данными программы на странице. */
async function makeDocWithMetadata() {
  const doc = await PDFDocument.load(await makePdf(2));
  doc.setTitle("Отчёт");
  doc.setAuthor("SECRET-AUTHOR");
  doc.setSubject("Квартал");
  doc.setCreator("Word");
  doc.setCreationDate(new Date("2024-03-01T10:00:00Z"));
  const ctx = doc.context;
  const xmp = ctx.stream("<x:xmpmeta><dc:creator>SECRET-AUTHOR</dc:creator></x:xmpmeta>", { Type: "Metadata", Subtype: "XML" });
  doc.catalog.set(PDFName.of("Metadata"), ctx.register(xmp));
  doc.getPage(0).node.set(PDFName.of("PieceInfo"), ctx.obj({ Illustrator: { Private: "SECRET-SOURCE" } }));
  return doc.save();
}

describe("метаданные", () => {
  it("читает свойства и видит скрытые данные", async () => {
    const meta = await readMetadata(await makeDocWithMetadata());
    expect(meta).toMatchObject({ title: "Отчёт", author: "SECRET-AUTHOR", subject: "Квартал", creator: "Word", hasHiddenData: true });
    expect(meta.created?.toISOString()).toBe("2024-03-01T10:00:00.000Z");
  });

  it("меняет и удаляет отдельные поля, устаревший XMP уходит из файла", async () => {
    const src = await makeDocWithMetadata();
    const out = await writeMetadata(src, {
      ...(await readMetadata(src)),
      title: "Новый отчёт",
      author: "",
      keywords: "pdf, отчёт",
    });
    const meta = await readMetadata(out);
    expect(meta).toMatchObject({ title: "Новый отчёт", author: "", subject: "Квартал", keywords: "pdf, отчёт" });
    expect(meta.created?.toISOString()).toBe("2024-03-01T10:00:00.000Z");
    expect(await fileContains(out, "SECRET-AUTHOR")).toBe(false);
  });

  it("очистка всего не оставляет в файле ни свойств, ни скрытых данных", async () => {
    const src = await makeDocWithMetadata();
    for (const s of ["SECRET-AUTHOR", "SECRET-SOURCE", "Отчёт"]) expect(await fileContains(src, s), s).toBe(true);
    const out = await writeMetadata(src, await readMetadata(src), { clearAll: true });
    const meta = await readMetadata(out);
    expect(meta).toMatchObject({ title: "", author: "", subject: "", creator: "", producer: "", hasHiddenData: false });
    expect(meta.created).toBeUndefined();
    for (const s of ["SECRET-AUTHOR", "SECRET-SOURCE", "Отчёт"]) expect(await fileContains(out, s), s).toBe(false);
    expect((await PDFDocument.load(out)).getPageCount()).toBe(2);
  });
});
