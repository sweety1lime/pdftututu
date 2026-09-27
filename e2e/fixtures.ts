import { readFile } from "node:fs/promises";
import { expect, test as base, type Page } from "@playwright/test";

/** Упавший на странице JS, заблокированное CSP или пропавший перевод — всегда ошибка теста. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    // Параметр не называем use: линтер примет его за хук React
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (msg) => {
        // MISSING_MESSAGE — перевод не дошёл до браузера (например, раздел не передан клиенту)
        if (msg.type() === "error" && /Content Security Policy|MISSING_MESSAGE/.test(msg.text())) errors.push(msg.text());
      });
      await provide(errors);
      expect(errors, "ошибки JS, CSP и переводов на странице").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Положить PDF-файлы в дропзону. */
export async function dropPdf(page: Page, ...files: Array<{ name: string; bytes: Uint8Array }>) {
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(files.map((f) => ({ name: f.name, mimeType: "application/pdf", buffer: Buffer.from(f.bytes) })));
}

/** Нажать кнопку и дождаться скачанного файла. */
export async function download(page: Page, click: () => Promise<void>) {
  const [file] = await Promise.all([page.waitForEvent("download"), click()]);
  return { name: file.suggestedFilename(), bytes: new Uint8Array(await readFile(await file.path())) };
}

/**
 * Цвет миниатюры страницы (её рисует pdf.js) в точке (fx, fy) — доли ширины и высоты.
 * Миниатюры есть, например, на странице «Разделить PDF».
 */
export async function pixelOfThumb(page: Page, pdf: Uint8Array, fx: number, fy: number) {
  await page.goto("/ru/split");
  await dropPdf(page, { name: "check.pdf", bytes: pdf });
  const img = page.locator('img[src^="blob:"]').last();
  await expect(img).toBeVisible();
  return img.evaluate(
    (el: HTMLImageElement, [x, y]) => {
      const c = document.createElement("canvas");
      c.width = el.naturalWidth;
      c.height = el.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(el, 0, 0);
      const [r, g, b] = ctx.getImageData(Math.round(x * c.width), Math.round(y * c.height), 1, 1).data;
      return { r, g, b };
    },
    [fx, fy],
  );
}
