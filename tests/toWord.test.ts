import { describe, expect, it } from "vitest";
import { strFromU8, unzipSync } from "fflate";
import { blocksToDocx, blocksToText, linesToBlocks, type LineInput } from "@/lib/pdf/toWord";

const line = (y: number, text: string, o: Partial<LineInput> = {}): LineInput => ({
  x: 72,
  y,
  w: 450,
  h: 14,
  fontSize: 12,
  text,
  bold: false,
  italic: false,
  ...o,
});

describe("PDF → абзацы", () => {
  const page = [
    line(40, "Договор аренды", { fontSize: 22, bold: true, h: 26, w: 200 }),
    line(90, "Первый абзац начинается с красной строки и продолжается", { x: 90, w: 432 }),
    line(105, "на следующей строке, где встречается приме-"),
    line(120, "ром перенос по слогам."),
    line(135, "Второй абзац идёт сразу, без отбивки: предыдущая строка кончилась точкой", { x: 90, w: 432 }),
    line(150, "и была короткой.", { w: 110 }),
    line(185, "Третий абзац — после отбивки.", { w: 200 }),
    line(200, "• первый пункт", { w: 120 }),
    line(215, "• второй пункт", { w: 120 }),
  ];
  const blocks = linesToBlocks([page]);

  it("находит заголовок, абзацы и пункты списка", () => {
    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Договор аренды" },
      {
        type: "paragraph",
        text: "Первый абзац начинается с красной строки и продолжается на следующей строке, где встречается примером перенос по слогам.",
        bold: false,
        italic: false,
      },
      {
        type: "paragraph",
        text: "Второй абзац идёт сразу, без отбивки: предыдущая строка кончилась точкой и была короткой.",
        bold: false,
        italic: false,
      },
      { type: "paragraph", text: "Третий абзац — после отбивки.", bold: false, italic: false },
      { type: "paragraph", text: "• первый пункт", bold: false, italic: false },
      { type: "paragraph", text: "• второй пункт", bold: false, italic: false },
    ]);
  });

  it("текст — абзацы через пустую строку", () => {
    expect(blocksToText(blocks).split("\n\n")).toHaveLength(6);
  });

  it(".docx: нужные части, стили заголовков, экранирование и жирный", () => {
    const zip = unzipSync(
      blocksToDocx([
        ...blocks,
        { type: "paragraph", text: "A & B < C > D\u0001", bold: true, italic: true },
      ]),
    );
    expect(Object.keys(zip).sort()).toEqual(
      ["[Content_Types].xml", "_rels/.rels", "word/_rels/document.xml.rels", "word/document.xml", "word/styles.xml"].sort(),
    );
    const doc = strFromU8(zip["word/document.xml"]);
    expect(doc).toContain('<w:pStyle w:val="Heading1"/>');
    expect(doc).toContain("примером перенос");
    expect(doc).toContain("<w:rPr><w:b/><w:i/></w:rPr><w:t xml:space=\"preserve\">A &amp; B &lt; C &gt; D</w:t>");
    expect(strFromU8(zip["word/styles.xml"])).toContain('w:styleId="Heading1"');
  });
});
