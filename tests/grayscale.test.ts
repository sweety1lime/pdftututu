import { describe, expect, it } from "vitest";
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, rgb } from "@cantoo/pdf-lib";
import { toGrayscale } from "@/lib/pdf/grayscale";
import { extractText, makePdf } from "./helpers";

async function contentOf(doc: PDFDocument, index: number) {
  const contents = doc.getPage(index).node.Contents();
  const refs = contents instanceof PDFArray ? contents.asArray() : [];
  return refs
    .map((r) => doc.context.lookup(r))
    .map((s) => Buffer.from(s instanceof PDFRawStream ? decodePDFRawStream(s).decode() : new Uint8Array()).toString("latin1"))
    .join("\n");
}

describe("чёрно-белый PDF", () => {
  it("накрывает выбранные страницы серым в режиме Saturation, текст остаётся текстом", async () => {
    const src = await PDFDocument.load(await makePdf(2));
    src.getPage(0).drawRectangle({ x: 50, y: 50, width: 200, height: 100, color: rgb(1, 0, 0) });
    const out = await PDFDocument.load(await toGrayscale(await src.save(), { pages: [0] }));

    const gsDict = out.getPage(0).node.Resources()!.lookup(PDFName.of("ExtGState"), PDFDict);
    const modes = gsDict.keys().map((k) => gsDict.lookup(k, PDFDict).get(PDFName.of("BM"))?.toString());
    expect(modes).toContain("/Saturation");
    expect(await contentOf(out, 0)).toMatch(/gs\s+0\.5 g\s+0 0 595\.28 841\.89 re\s+f\s+Q\s*$/);
    // Вторую страницу не трогали
    expect(await contentOf(out, 1)).not.toContain("0.5 g");

    const text = await extractText(await out.save());
    expect(text[0]).toContain("Page 1");
  });
});
