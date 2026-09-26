import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { extractText, fileContains, makePdf, makePng } from "../tests/helpers";
import { download, dropPdf, expect, test } from "./fixtures";

test("объединение двух файлов", async ({ page }) => {
  await page.goto("/ru/merge");
  await dropPdf(page, { name: "a.pdf", bytes: await makePdf(2) }, { name: "b.pdf", bytes: await makePdf(3) });
  const out = await download(page, () => page.getByRole("button", { name: "Объединить", exact: true }).click());
  expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(5);
});

test("пароль: поставить и снять", async ({ page }) => {
  await page.goto("/ru/protect");
  await dropPdf(page, { name: "doc.pdf", bytes: await makePdf(1) });
  await page.locator("#pw").fill("s3cret");
  await page.locator("#pw2").fill("s3cret");
  const locked = await download(page, () => page.getByRole("button", { name: "Защитить PDF" }).click());
  await expect(PDFDocument.load(locked.bytes)).rejects.toThrow(/encrypt/i);

  await page.goto("/ru/unlock");
  await dropPdf(page, { name: "locked.pdf", bytes: locked.bytes });
  const dialog = page.getByRole("dialog");
  const input = dialog.locator("input");
  await input.fill("wrong");
  await input.press("Enter");
  await expect(input).toHaveAttribute("aria-invalid", "true");
  await input.fill("s3cret");
  await input.press("Enter");

  const open = await download(page, () => page.getByRole("button", { name: "Снять защиту" }).click());
  const doc = await PDFDocument.load(open.bytes);
  expect(doc.isEncrypted).toBe(false);
  expect(doc.getPageCount()).toBe(1);
});

test("максимальное сжатие не оставляет в файле исходный текст", async ({ page }) => {
  // «Скан»: несжимаемая картинка на всю страницу и текст поверх
  const doc = await PDFDocument.create();
  const p = doc.addPage([595, 842]);
  p.drawImage(await doc.embedPng(makePng(1200, 1200, { noise: true })), { x: 0, y: 0, width: 595, height: 842 });
  p.drawText("SECRET TEXT", { x: 50, y: 780, size: 24, font: await doc.embedFont(StandardFonts.Helvetica) });
  const src = await doc.save();
  expect(await fileContains(src, "SECRET TEXT")).toBe(true);

  await page.goto("/ru/compress");
  await dropPdf(page, { name: "scan.pdf", bytes: src });
  await page.getByRole("radio", { name: /Максимальное/ }).click();
  await page.getByRole("button", { name: "Сжать", exact: true }).click();
  const out = await download(page, () => page.getByRole("button", { name: "Скачать", exact: true }).click());

  expect(out.bytes.length).toBeLessThan(src.length);
  expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(1);
  expect(await fileContains(out.bytes, "SECRET TEXT")).toBe(false);
});

test("редактор: добавить текст с кириллицей и скачать", async ({ page }) => {
  await page.goto("/ru/editor");
  await dropPdf(page, { name: "doc.pdf", bytes: await makePdf(1) });
  await page.getByRole("button", { name: "Текст (T)" }).click();
  await page.locator('[data-page-index="0"]').click({ position: { x: 120, y: 200 } });
  await expect(page.locator("textarea")).toBeFocused();
  await page.keyboard.type("Привет, мир");
  await page.keyboard.press("Escape");

  const out = await download(page, () => page.getByRole("button", { name: "Скачать PDF" }).click());
  const [text] = await extractText(out.bytes);
  expect(text).toContain("Page 1");
  expect(text).toContain("Привет, мир");
});
