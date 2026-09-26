import { readFile } from "node:fs/promises";
import { expect, test as base, type Page } from "@playwright/test";

/** Упавший на странице JS или заблокированное CSP — всегда ошибка теста. */
export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: [
    // Параметр не называем use: линтер примет его за хук React
    async ({ page }, provide) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("console", (msg) => {
        if (msg.type() === "error" && msg.text().includes("Content Security Policy")) errors.push(msg.text());
      });
      await provide(errors);
      expect(errors, "ошибки JS и нарушения CSP на странице").toEqual([]);
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
