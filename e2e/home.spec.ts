import { PDFDocument } from "@cantoo/pdf-lib";
import { makePdf } from "../tests/helpers";
import { download, dropPdf, expect, test } from "./fixtures";

test("несколько PDF с главной сразу попадают в «Объединить»", async ({ page }) => {
  await page.goto("/ru");
  await dropPdf(page, { name: "a.pdf", bytes: await makePdf(2) }, { name: "b.pdf", bytes: await makePdf(3) });
  await expect(page).toHaveURL(/\/ru\/merge$/);
  await expect(page.getByText("b.pdf")).toBeVisible();
  const out = await download(page, () => page.getByRole("button", { name: "Объединить", exact: true }).click());
  expect((await PDFDocument.load(out.bytes)).getPageCount()).toBe(5);
});

test("черновик: «Восстановить» на главной сразу открывает его в редакторе", async ({ page }) => {
  await page.goto("/ru/editor");
  await dropPdf(page, { name: "draft.pdf", bytes: await makePdf(1) });
  await page.getByRole("button", { name: "Текст (T)" }).click();
  await page.locator('[data-page-index="0"]').click({ position: { x: 120, y: 200 } });
  await page.keyboard.type("Черновик");
  await page.keyboard.press("Escape");
  // Автосохранение — через секунду после последней правки
  await page.waitForTimeout(1800);

  await page.goto("/ru");
  await expect(page.getByText("draft.pdf")).toBeVisible();
  await page.getByRole("link", { name: "Восстановить", exact: true }).click();
  await expect(page).toHaveURL(/\/ru\/editor$/);
  await expect(page.locator('[data-page-index="0"]')).toBeVisible();
  await expect(page.getByText("Найден несохранённый черновик")).toHaveCount(0);
});

test("один PDF на главной → «Сжать PDF»: файл уже открыт на странице сжатия", async ({ page }) => {
  await page.goto("/ru");
  await dropPdf(page, { name: "one.pdf", bytes: await makePdf(2) });
  await expect(page.getByRole("heading", { name: "Что сделать с файлом?" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "one.pdf" })).toBeVisible();
  await expect(page.getByText("Текст выделяется")).toBeVisible();

  await page.getByRole("link", { name: /Сжать PDF/ }).click();
  await expect(page).toHaveURL(/\/ru\/compress$/);
  await expect(page.getByText("one.pdf")).toBeVisible();
  await expect(page.getByRole("button", { name: "Сжать", exact: true })).toBeVisible();
});

test("экран действий: клавиша 1 открывает файл в редакторе", async ({ page }) => {
  await page.goto("/ru");
  await dropPdf(page, { name: "one.pdf", bytes: await makePdf(1) });
  await expect(page.getByRole("link", { name: /Редактор PDF/ })).toBeVisible();
  await page.keyboard.press("1");
  await expect(page).toHaveURL(/\/ru\/editor$/);
  await expect(page.locator('[data-page-index="0"]')).toBeVisible();
});

test("файл под паролем: пароль спрашивают один раз, «Снять пароль» сразу готово", async ({ page }) => {
  const doc = await PDFDocument.load(await makePdf(1));
  doc.encrypt({ userPassword: "s3cret", ownerPassword: "s3cret" });
  const locked = await doc.save();

  await page.goto("/ru");
  await dropPdf(page, { name: "locked.pdf", bytes: locked });
  const dialog = page.getByRole("dialog");
  await dialog.locator("input").fill("s3cret");
  await dialog.locator("input").press("Enter");
  await expect(page.getByText("Был под паролем")).toBeVisible();

  await page.getByRole("link", { name: "Снять пароль" }).click();
  await expect(page).toHaveURL(/\/ru\/unlock$/);
  await expect(page.getByText("Защита снята")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const out = await download(page, () => page.getByRole("button", { name: "Снять защиту" }).click());
  expect((await PDFDocument.load(out.bytes)).isEncrypted).toBe(false);
});
