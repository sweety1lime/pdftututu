/**
 * PDF → текст и Word (.docx). В PDF нет абзацев — только строки с координатами,
 * поэтому абзацы и заголовки угадываем по отступам, отбивкам и размеру шрифта.
 * Сохраняются текст, абзацы, заголовки, жирный и курсив; таблицы, колонки
 * и картинки — нет.
 */
import { strToU8, zipSync } from "fflate";

/** Строка текста на странице: координаты вида (y вниз), PDF-точки. */
export interface LineInput {
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  text: string;
  bold: boolean;
  italic: boolean;
}

export type Block =
  | { type: "heading"; level: 1 | 2; text: string }
  | { type: "paragraph"; text: string; bold: boolean; italic: boolean };

/** Маркер пункта списка: «•», «–», «1.», «2)», «а)»… */
const LIST_ITEM = /^([•·▪‣◦*–—-]|\d{1,3}[.)]|[a-zа-яё][.)])\s/i;
const SENTENCE_END = /[.!?:;…»"”)]$/;

export function linesToBlocks(pages: LineInput[][]): Block[] {
  const all = pages.flat().filter((l) => l.text.trim());
  if (!all.length) return [];
  const body = bodySize(all);
  const blocks: Block[] = [];

  for (const page of pages) {
    const lines = page.filter((l) => l.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
    if (!lines.length) continue;
    const left = Math.min(...lines.map((l) => l.x));
    const right = Math.max(...lines.map((l) => l.x + l.w));
    let current: LineInput[] = [];
    for (const line of lines) {
      const prev = current[current.length - 1];
      if (prev && startsNewBlock(prev, line, left, right)) {
        blocks.push(toBlock(current, body));
        current = [];
      }
      current.push(line);
    }
    blocks.push(toBlock(current, body));
  }
  return blocks;
}

/** Основной кегль документа: медиана по количеству текста. */
function bodySize(lines: LineInput[]): number {
  const sorted = [...lines].sort((a, b) => a.fontSize - b.fontSize);
  const total = sorted.reduce((n, l) => n + l.text.length, 0);
  let acc = 0;
  for (const l of sorted) {
    acc += l.text.length;
    if (acc >= total / 2) return l.fontSize;
  }
  return sorted[sorted.length - 1].fontSize;
}

function startsNewBlock(prev: LineInput, line: LineInput, left: number, right: number): boolean {
  const size = Math.max(prev.fontSize, line.fontSize);
  // Отбивка между абзацами
  if (line.y - (prev.y + prev.h) > size * 0.6) return true;
  // Другой кегль или начертание всей строки — заголовок начался или кончился
  if (Math.abs(line.fontSize - prev.fontSize) > Math.min(line.fontSize, prev.fontSize) * 0.15) return true;
  if (line.bold !== prev.bold) return true;
  if (LIST_ITEM.test(line.text.trim())) return true;
  // Красная строка
  if (line.x - prev.x > size * 1.2 && line.x - left > size * 0.8) return true;
  // Предыдущая строка короткая и кончается точкой — абзац закончился
  return prev.x + prev.w < right - size * 4 && SENTENCE_END.test(prev.text.trim());
}

function joinLines(lines: LineInput[]): string {
  let text = "";
  for (const line of lines) {
    const t = line.text.trim();
    if (!text) text = t;
    // Перенос по слогам: «приме-» + «ром» → «примером»
    else if (/\p{L}-$/u.test(text) && /^\p{Ll}/u.test(t)) text = text.slice(0, -1) + t;
    else text += " " + t;
  }
  return text;
}

function toBlock(lines: LineInput[], body: number): Block {
  const text = joinLines(lines);
  const size = Math.max(...lines.map((l) => l.fontSize));
  if (text.length < 200 && size >= body * 1.6) return { type: "heading", level: 1, text };
  if (text.length < 200 && size >= body * 1.25) return { type: "heading", level: 2, text };
  return { type: "paragraph", text, bold: lines.every((l) => l.bold), italic: lines.every((l) => l.italic) };
}

export function blocksToText(blocks: Block[]): string {
  return blocks.map((b) => b.text).join("\n\n") + "\n";
}

// ---- .docx: минимальный набор частей WordprocessingML ----

const xml = (s: string) =>
  s
    // Управляющие символы в XML запрещены, а в тексте PDF встречаются
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

function run(text: string, { bold = false, italic = false } = {}) {
  const props = bold || italic ? `<w:rPr>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}</w:rPr>` : "";
  return `<w:r>${props}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`;
}

function paragraph(b: Block) {
  if (b.type === "heading") return `<w:p><w:pPr><w:pStyle w:val="Heading${b.level}"/></w:pPr>${run(b.text)}</w:p>`;
  return `<w:p>${run(b.text, b)}</w:p>`;
}

function stylesXml(lang: string) {
  const heading = (level: 1 | 2, size: number) =>
    `<w:style w:type="paragraph" w:styleId="Heading${level}"><w:name w:val="heading ${level}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/>` +
    `<w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${level - 1}"/></w:pPr>` +
    `<w:rPr><w:b/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/></w:rPr></w:style>`;
  return (
    HEAD +
    `<w:styles ${W}>` +
    `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri" w:eastAsia="Calibri"/>` +
    `<w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="${lang}"/></w:rPr></w:rPrDefault>` +
    `<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>` +
    `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>` +
    heading(1, 32) +
    heading(2, 26) +
    `</w:styles>`
  );
}

/** Собрать .docx (A4, поля как в Word по умолчанию для A4). */
export function blocksToDocx(blocks: Block[], lang = "ru-RU"): Uint8Array {
  const body = blocks.map(paragraph).join("") || "<w:p/>";
  const sect =
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>';
  const files: Record<string, string> = {
    "[Content_Types].xml":
      HEAD +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      "</Types>",
    "_rels/.rels":
      HEAD +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      "</Relationships>",
    "word/_rels/document.xml.rels":
      HEAD +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      "</Relationships>",
    "word/document.xml": HEAD + `<w:document ${W}><w:body>${body}${sect}</w:body></w:document>`,
    "word/styles.xml": stylesXml(lang),
  };
  return zipSync(Object.fromEntries(Object.entries(files).map(([name, text]) => [name, strToU8(text)])));
}
