import { beforeAll, describe, expect, it } from "vitest";
import { addPageNumbers } from "@/lib/pdf/stamp";
import { makePdf, textInView, useDiskFonts } from "./helpers";

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
