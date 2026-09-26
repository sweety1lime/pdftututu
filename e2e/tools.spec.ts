import { PDFDict, PDFDocument, PDFName, StandardFonts } from "@cantoo/pdf-lib";
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

/** «Скан»: несжимаемая картинка на всю страницу и текст поверх. */
async function makeScan() {
  const doc = await PDFDocument.create();
  const p = doc.addPage([595, 842]);
  p.drawImage(await doc.embedPng(makePng(1200, 1200, { noise: true })), { x: 0, y: 0, width: 595, height: 842 });
  p.drawText("SECRET TEXT", { x: 50, y: 780, size: 24, font: await doc.embedFont(StandardFonts.Helvetica) });
  return doc.save();
}

test("обычное сжатие (в воркере) уменьшает файл и сохраняет текст", async ({ page }) => {
  const src = await makeScan();
  await page.goto("/ru/compress");
  await dropPdf(page, { name: "scan.pdf", bytes: src });
  await page.getByRole("button", { name: "Сжать", exact: true }).click();
  const out = await download(page, () => page.getByRole("button", { name: "Скачать", exact: true }).click());
  expect(out.bytes.length).toBeLessThan(src.length / 2);
  expect((await extractText(out.bytes))[0]).toContain("SECRET TEXT");
});

test("максимальное сжатие не оставляет в файле исходный текст", async ({ page }) => {
  const src = await makeScan();
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

test("OCR распознаёт текст и не ходит на сторонние сайты", async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const external: string[] = [];
  await page.context().route(
    (url) => url.origin !== new URL(baseURL!).origin,
    (route) => {
      external.push(route.request().url());
      return route.abort();
    },
  );

  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawText("HELLO OCR 2026", {
    x: 60,
    y: 700,
    size: 40,
    font: await doc.embedFont(StandardFonts.Helvetica),
  });
  await page.goto("/ru/ocr");
  await dropPdf(page, { name: "scan.pdf", bytes: await doc.save() });
  // На странице уже есть текст — без этого её пропустят
  await page.getByLabel("Пропускать страницы, где уже есть текст").uncheck();
  await page.getByRole("button", { name: "Распознать" }).click();

  const txt = await download(page, () => page.getByRole("button", { name: "Скачать .txt" }).click());
  expect(Buffer.from(txt.bytes).toString("utf8")).toContain("HELLO OCR 2026");
  expect(external).toEqual([]);
});

test("подпись: напечатать имя, вставить и скачать", async ({ page }) => {
  await page.goto("/ru/sign");
  await dropPdf(page, { name: "doc.pdf", bytes: await makePdf(1) });
  // На странице подписи диалог открывается сам
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Напечатать" }).click();
  await dialog.getByPlaceholder("Ваше имя").fill("Иван Петров");
  await dialog.getByRole("button", { name: "Вставить" }).click();
  await expect(dialog).toBeHidden();

  const out = await download(page, () => page.getByRole("button", { name: "Скачать PDF" }).click());
  const res = (await PDFDocument.load(out.bytes)).getPage(0).node.Resources();
  expect(res?.lookup(PDFName.of("XObject"), PDFDict).keys().length).toBeGreaterThan(0);
});

test("номера страниц: «2 / 3» в правом верхнем углу", async ({ page }) => {
  await page.goto("/ru/page-numbers");
  await dropPdf(page, { name: "doc.pdf", bytes: await makePdf(3) });
  await page.getByRole("radio", { name: "1 / 3" }).click();
  await page.getByRole("radio", { name: "Сверху справа" }).click();
  const out = await download(page, () => page.getByRole("button", { name: "Пронумеровать" }).click());
  const text = await extractText(out.bytes);
  expect(text[1]).toContain("2 / 3");
});

test("водяной знак: надпись плиткой на всех страницах", async ({ page }) => {
  await page.goto("/ru/watermark");
  await dropPdf(page, { name: "doc.pdf", bytes: await makePdf(2) });
  await page.getByLabel("Надпись").fill("ЧЕРНОВИК");
  await page.getByRole("radio", { name: "Плиткой по всей странице" }).click();
  // Превью показывает надписи на миниатюре
  await expect(page.getByText("ЧЕРНОВИК").first()).toBeVisible();
  const out = await download(page, () => page.getByRole("button", { name: "Добавить водяной знак" }).click());
  const text = await extractText(out.bytes);
  expect(text.every((t) => t.includes("ЧЕРНОВИК"))).toBe(true);
});

test("метаданные: видно автора, «Очистить всё» убирает его из файла", async ({ page }) => {
  const doc = await PDFDocument.load(await makePdf(1));
  doc.setAuthor("Иван Петров");
  doc.setTitle("Договор");
  await page.goto("/ru/metadata");
  await dropPdf(page, { name: "doc.pdf", bytes: await doc.save() });
  await expect(page.getByLabel("Автор")).toHaveValue("Иван Петров");
  await page.getByRole("button", { name: "Очистить всё" }).click();
  const out = await download(page, () => page.getByRole("button", { name: "Сохранить PDF" }).click());
  const clean = await PDFDocument.load(out.bytes);
  expect(clean.getAuthor()).toBeUndefined();
  expect(clean.getTitle()).toBeUndefined();
});
