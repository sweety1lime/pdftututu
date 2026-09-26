import { beforeAll, describe, expect, it } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import { buildFromItems, mergePdfs, splitPdf } from "@/lib/pdf/pages";
import { protectPdf } from "@/lib/pdf/security";
import { decryptWithPassword } from "@/lib/pdf/load";
import { embedFont } from "@/lib/pdf/fonts";
import { addInvisibleText } from "@/lib/pdf/textLayer";
import { exportEditedPdf } from "@/features/editor/exportPdf";
import type { EditorObject } from "@/features/editor/types";
import { extractText, makePdf, useDiskFonts } from "./helpers";

beforeAll(() => useDiskFonts());

const A4 = { box: [0, 0, 595.28, 841.89] as [number, number, number, number], rotation: 0 };

describe("страницы", () => {
  it("объединяет документы в заданном порядке", async () => {
    const a = await makePdf(2);
    const b = await makePdf(3);
    const out = await PDFDocument.load(await mergePdfs([b, a]));
    expect(out.getPageCount()).toBe(5);
    const text = await extractText(await out.save());
    expect(text[0]).toContain("Page 1");
    expect(text[3]).toContain("Page 1"); // первая страница второго файла
  });

  it("разделяет по группам", async () => {
    const parts = await splitPdf(await makePdf(5), [[0, 1], [4]]);
    expect(parts).toHaveLength(2);
    expect((await PDFDocument.load(parts[0])).getPageCount()).toBe(2);
    expect((await extractText(parts[1]))[0]).toContain("Page 5");
  });

  it("собирает страницы: порядок, поворот, пустая страница, дубликат", async () => {
    const src = await makePdf(3);
    const out = await PDFDocument.load(
      await buildFromItems(
        [
          { id: "1", kind: "page", sourceId: "s", pageIndex: 2, rotation: 90 },
          { id: "2", kind: "blank", width: 300, height: 400, rotation: 0 },
          { id: "3", kind: "page", sourceId: "s", pageIndex: 0, rotation: -90 },
          { id: "4", kind: "page", sourceId: "s", pageIndex: 2, rotation: 0 },
        ],
        { s: src },
      ),
    );
    const pages = out.getPages();
    expect(pages).toHaveLength(4);
    expect(pages[0].getRotation().angle).toBe(90);
    expect(pages[1].getSize()).toEqual({ width: 300, height: 400 });
    expect(pages[2].getRotation().angle).toBe(270);
    expect(pages[3].getRotation().angle).toBe(0);
    const text = await extractText(await out.save());
    expect(text[0]).toContain("Page 3");
    expect(text[3]).toContain("Page 3");
  });
});

describe("экспорт редактора", () => {
  it("добавляет текст с кириллицей, который потом извлекается", async () => {
    const objects: EditorObject[] = [
      {
        id: "t1",
        type: "text",
        page: 0,
        x: 72,
        y: 100,
        w: 200,
        h: 20,
        rotation: 0,
        opacity: 1,
        text: "Привет, мир!\nВторая строка",
        family: "sans",
        bold: false,
        italic: false,
        fontSize: 16,
        color: "#112233",
        lineHeight: 1.2,
        align: "left",
      },
      { id: "r1", type: "rect", page: 0, x: 50, y: 300, w: 100, h: 50, rotation: 15, opacity: 0.8, fill: "#ff0000", stroke: "#000000", strokeWidth: 2 },
      { id: "h1", type: "highlight", page: 0, x: 50, y: 400, w: 100, h: 14, rotation: 0, opacity: 0.45, fill: "#fde047", stroke: null, strokeWidth: 0 },
      { id: "a1", type: "arrow", page: 1, x: 10, y: 10, w: 100, h: 100, rotation: 0, opacity: 1, points: [0, 0, 100, 100], stroke: "#0000ff", strokeWidth: 3 },
      { id: "p1", type: "path", page: 1, x: 200, y: 200, w: 30, h: 10, rotation: 0, opacity: 0.4, points: [0, 0, 10, 5, 30, 10], stroke: "#ffff00", strokeWidth: 12, marker: true },
    ];
    const out = await exportEditedPdf({
      bytes: await makePdf(2),
      pages: [A4, A4],
      objects,
      formValues: {},
      assets: {},
    });
    const text = await extractText(out);
    expect(text[0]).toContain("Привет, мир!");
    expect(text[0]).toContain("Вторая строка");
    expect(text[0]).toContain("Page 1"); // исходный текст на месте
  });

  it("правильно ставит текст на повёрнутой странице (не зеркально)", async () => {
    const src = await makePdf(1, { rotate: 90 });
    const out = await exportEditedPdf({
      bytes: src,
      pages: [{ box: A4.box, rotation: 90 }],
      objects: [
        {
          id: "t",
          type: "text",
          page: 0,
          x: 50,
          y: 50,
          w: 100,
          h: 20,
          rotation: 0,
          opacity: 1,
          text: "Горизонтально",
          family: "serif",
          bold: true,
          italic: false,
          fontSize: 14,
          color: "#000000",
          lineHeight: 1.2,
          align: "left",
        },
      ],
      formValues: {},
      assets: {},
    });
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const doc = await pdfjs.getDocument({ data: out.slice() }).promise;
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const item = (await page.getTextContent()).items.find((i) => "str" in i && i.str === "Горизонтально");
    expect(item).toBeDefined();
    // В системе вида текст должен идти слева направо, без поворота
    const m = pdfjs.Util.transform(viewport.transform, (item as { transform: number[] }).transform);
    expect(m[0]).toBeGreaterThan(0);
    expect(Math.abs(m[1])).toBeLessThan(1e-6);
    // Базовая линия ≈ y + baselineOffset в координатах вида
    expect(m[4]).toBeCloseTo(50, 0);
    expect(m[5]).toBeGreaterThan(50);
    expect(m[5]).toBeLessThan(70);
    await doc.loadingTask.destroy();
  });

  it("заполняет поля формы кириллицей", async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const form = doc.getForm();
    form.createTextField("name").addToPage(page, { x: 50, y: 700, width: 200, height: 24 });
    form.createCheckBox("agree").addToPage(page, { x: 50, y: 650, width: 16, height: 16 });
    const out = await exportEditedPdf({
      bytes: await doc.save(),
      pages: [{ box: [0, 0, 595, 842], rotation: 0 }],
      objects: [],
      formValues: { name: "Иван Петров", agree: true },
      assets: {},
    });
    const filled = (await PDFDocument.load(out)).getForm();
    expect(filled.getTextField("name").getText()).toBe("Иван Петров");
    expect(filled.getCheckBox("agree").isChecked()).toBe(true);
  });
});

describe("пароль", () => {
  it("шифрует так, что без пароля не открыть, а с паролем — открывается", async () => {
    const src = await makePdf(2);
    const locked = await protectPdf(src, {
      userPassword: "секрет123",
      allowPrint: true,
      allowCopy: false,
      allowModify: false,
      allowAnnotate: false,
    });
    const probe = await PDFDocument.load(locked, { ignoreEncryption: true });
    expect(probe.isEncrypted).toBe(true);
    await expect(decryptWithPassword(locked, "wrong")).rejects.toThrow();
    // Так работает «Снять пароль»: результат открывается без пароля
    const plain = await decryptWithPassword(locked, "секрет123");
    const unlocked = await PDFDocument.load(plain);
    expect(unlocked.isEncrypted).toBe(false);
    expect(unlocked.getPageCount()).toBe(2);
    expect((await extractText(plain))[1]).toContain("Page 2");
  });

  it("снимает пароль и с уже изменённого файла повторно", async () => {
    const locked = await protectPdf(await makePdf(1), {
      userPassword: "1",
      allowPrint: true,
      allowCopy: true,
      allowModify: true,
      allowAnnotate: true,
    });
    const once = await decryptWithPassword(locked, "1");
    // Повторное шифрование уже расшифрованного файла тоже должно работать
    const again = await protectPdf(once, { userPassword: "2", allowPrint: true, allowCopy: true, allowModify: true, allowAnnotate: true });
    const plain = await decryptWithPassword(again, "2");
    expect((await PDFDocument.load(plain)).isEncrypted).toBe(false);
  });
});

describe("OCR-слой", () => {
  it("невидимый текст извлекается и ищется", async () => {
    const doc = await PDFDocument.load(await makePdf(1));
    const font = await embedFont(doc, { family: "sans" });
    addInvisibleText(doc.getPage(0), A4, [
      { text: "Распознанное", x0: 72, y0: 200, x1: 180, y1: 216 },
      { text: "слово", x0: 190, y0: 200, x1: 230, y1: 216 },
    ], font);
    const text = await extractText(await doc.save());
    expect(text[0]).toContain("Распознанное");
    expect(text[0]).toContain("слово");
  });
});
