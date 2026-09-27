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
