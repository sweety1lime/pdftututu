import { beforeAll, describe, expect, it } from "vitest";
import { PDFDict, PDFDocument, PDFName } from "@cantoo/pdf-lib";
import { addPageNumbers, addWatermark } from "@/lib/pdf/stamp";
import { watermarkPlacements } from "@/lib/pdf/placement";
import { makePdf, makePng, textInView, useDiskFonts } from "./helpers";

beforeAll(() => useDiskFonts());

describe("номера страниц", () => {
  it("нумерует выбранные страницы с нужного числа по шаблону", async () => {
    const out = await addPageNumbers(await makePdf(4), {
      position: "bottom-center",
      format: "Страница {n} из {total}",
      start: 1,
      pages: [1, 2, 3], // обложку не нумеруем
      fontSize: 12,
    });
    const pages = await textInView(out);
    const numbers = pages.map((p) => p.items.find((i) => i.str.startsWith("Страница"))?.str);
    expect(numbers).toEqual([undefined, "Страница 1 из 3", "Страница 2 из 3", "Страница 3 из 3"]);
  });

  it("ставит номер в выбранный угол — и на повёрнутой странице тоже", async () => {
    for (const rotate of [0, 90, 180, 270]) {
      for (const position of ["top-left", "bottom-right"] as const) {
        const out = await addPageNumbers(await makePdf(1, { rotate }), {
          position,
          format: "{n}",
          start: 7,
          fontSize: 12,
          margin: 30,
        });
        const [page] = await textInView(out);
        const num = page.items.find((i) => i.str === "7")!;
        const where = `${rotate}° ${position}`;
        expect(num, where).toBeDefined();
        expect(num.upright, where).toBe(true);
        if (position === "top-left") {
          expect(num.x, where).toBeCloseTo(30, 0);
          expect(num.y, where).toBeCloseTo(42, 0); // отступ + высота строки
        } else {
          expect(num.x, where).toBeGreaterThan(page.width - 50);
          expect(num.y, where).toBeCloseTo(page.height - 30, 0);
        }
      }
    }
  });
});

describe("водяной знак", () => {
  it("по центру: надпись посередине страницы — и на повёрнутой тоже", async () => {
    for (const rotate of [0, 90]) {
      const out = await addWatermark(await makePdf(1, { rotate }), {
        text: "ЧЕРНОВИК",
        fontSize: 40,
        opacity: 0.3,
        rotation: 0,
        layout: "center",
      });
      const [page] = await textInView(out);
      const mark = page.items.find((i) => i.str === "ЧЕРНОВИК")!;
      expect(mark.upright, `${rotate}°`).toBe(true);
      expect(mark.x + mark.width / 2, `${rotate}°`).toBeCloseTo(page.width / 2, 0);
      expect(Math.abs(mark.y - page.height / 2), `${rotate}°`).toBeLessThan(20);
    }
  });

  it("наискосок и плиткой: много надписей под нужным углом, только на выбранных страницах", async () => {
    const out = await addWatermark(await makePdf(3), {
      text: "COPY",
      fontSize: 36,
      opacity: 0.3,
      rotation: -45,
      layout: "tile",
      pages: [0, 2],
    });
    const pages = await textInView(out);
    const marks = pages.map((p) => p.items.filter((i) => i.str === "COPY"));
    expect(marks[0].length).toBeGreaterThan(6);
    expect(marks[1]).toHaveLength(0);
    expect(marks[2].length).toBe(marks[0].length);
    expect(marks[0].every((m) => m.angle === -45)).toBe(true);
  });

  it("плитка покрывает всю страницу, центры рядом со страницей", () => {
    const page = { width: 595, height: 842 };
    const box = { w: 120, h: 36 };
    const spots = watermarkPlacements(page, box, 0, "tile");
    const centers = spots.map((p) => ({ x: p.x + box.w / 2, y: p.y + box.h / 2 }));
    // Есть надписи во всех четырёх четвертях
    for (const [qx, qy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      expect(centers.some((c) => Math.floor((c.x / page.width) * 2) === qx && Math.floor((c.y / page.height) * 2) === qy)).toBe(true);
    }
    const pad = Math.hypot(box.w, box.h) / 2;
    expect(centers.every((c) => c.x > -pad && c.x < page.width + pad && c.y > -pad && c.y < page.height + pad)).toBe(true);
  });

  it("картинкой: встраивается с прозрачностью", async () => {
    const out = await addWatermark(await makePdf(1), {
      image: { bytes: makePng(20, 10), mime: "image/png", width: 20, height: 10 },
      imageScale: 0.4,
      opacity: 0.25,
      rotation: 0,
      layout: "center",
    });
    const res = (await PDFDocument.load(out)).getPage(0).node.Resources()!;
    expect(res.lookup(PDFName.of("XObject"), PDFDict).keys().length).toBeGreaterThan(0);
    const gs = res.lookup(PDFName.of("ExtGState"), PDFDict);
    const alphas = gs.keys().map((k) => gs.lookup(k, PDFDict).get(PDFName.of("ca"))?.toString());
    expect(alphas).toContain("0.25");
  });
});
