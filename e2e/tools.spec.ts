import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import { strFromU8, unzipSync } from "fflate";
import { PDFDict, PDFDocument, PDFName, PDFRawStream, rgb, StandardFonts } from "@cantoo/pdf-lib";
import { extractText, fileContains, makePdf, makePng } from "../tests/helpers";
import { download, dropPdf, expect, pixelOfThumb, test } from "./fixtures";

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

/**
 * Картинка с мягкой тенью: цвет и маска прозрачности (/SMask) — отдельные картинки,
 * как их пишут PowerPoint и браузеры (у pdf-lib маска другая, с /Decode). Обе из шума,
 * чтобы сжатие за них взялось: маске хватает лёгкого шума, JPEG сжал бы её намного лучше.
 */
async function makeSoftMaskPdf() {
  const doc = await PDFDocument.create();
  const ctx = doc.context;
  const size = 800;
  const image = (data: Uint8Array, dict: Record<string, unknown>) => {
    const packed = deflateSync(data);
    const obj = { Type: "XObject", Subtype: "Image", Width: size, Height: size, BitsPerComponent: 8, ...dict };
    return ctx.register(PDFRawStream.of(ctx.obj({ ...obj, Filter: "FlateDecode", Length: packed.length }), packed));
  };
  const alpha = randomBytes(size * size).map((v) => 200 + (v & 15));
  const smask = image(alpha, { ColorSpace: "DeviceGray" });
  const img = image(randomBytes(size * size * 3), { ColorSpace: "DeviceRGB", SMask: smask });
  const page = doc.addPage([600, 600]);
  page.node.setXObject(PDFName.of("Im0"), img);
  page.node.set(PDFName.of("Contents"), ctx.register(ctx.flateStream("q 600 0 0 600 0 0 cm /Im0 Do Q")));
  return doc.save();
}

test("сжатие не портит картинки с прозрачностью", async ({ page }) => {
  const src = await makeSoftMaskPdf();
  await page.goto("/ru/compress");
  await dropPdf(page, { name: "shadow.pdf", bytes: src });
  await page.getByRole("button", { name: "Сжать", exact: true }).click();
  const out = await download(page, () => page.getByRole("button", { name: "Скачать", exact: true }).click());
  expect(out.bytes.length).toBeLessThan(src.length);

  // Маска осталась серой: с цветной pdf.js не рисует картинку совсем
  const doc = await PDFDocument.load(out.bytes);
  const masks = [...doc.context.enumerateIndirectObjects()].flatMap(([, obj]) => {
    const mask = obj instanceof PDFRawStream ? doc.context.lookup(obj.dict.get(PDFName.of("SMask"))) : undefined;
    return mask instanceof PDFRawStream ? [mask] : [];
  });
  expect(masks).toHaveLength(1);
  expect(masks[0].dict.get(PDFName.of("ColorSpace"))).toBe(PDFName.of("DeviceGray"));

  // И картинка видна: страница не белая
  const { r, g, b } = await pixelOfThumb(page, out.bytes, 0.5, 0.5);
  expect(r + g + b).toBeLessThan(600);
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

test("чёрно-белый: красное становится серым при отрисовке", async ({ page }) => {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawRectangle({ x: 50, y: 50, width: 200, height: 100, color: rgb(1, 0, 0) });
  const src = await doc.save();
  // Точка внутри прямоугольника: x ≈ 25% ширины, y ≈ 88% высоты (сверху)
  const before = await pixelOfThumb(page, src, 0.25, 0.88);
  expect(before.r).toBeGreaterThan(200);
  expect(before.g).toBeLessThan(80);

  await page.goto("/ru/grayscale");
  await dropPdf(page, { name: "color.pdf", bytes: src });
  const out = await download(page, () => page.getByRole("button", { name: "Сделать чёрно-белым" }).click());
  const after = await pixelOfThumb(page, out.bytes, 0.25, 0.88);
  expect(Math.abs(after.r - after.g)).toBeLessThan(10);
  expect(Math.abs(after.g - after.b)).toBeLessThan(10);
  expect(after.r).toBeLessThan(200); // серый, а не белый — прямоугольник на месте
});

test("скрыть навсегда: закрытое исчезает из файла, остальное ищется через OCR", async ({ page }) => {
  test.setTimeout(120_000);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p = doc.addPage([595, 842]);
  p.drawText("SECRET 1234", { x: 60, y: 760, size: 28, font });
  p.drawText("VISIBLE 5678", { x: 60, y: 500, size: 28, font });
  doc.setAuthor("Ivan Petrov");
  const src = await doc.save();

  await page.goto("/ru/redact");
  await dropPdf(page, { name: "passport.pdf", bytes: src });
  await expect(page.getByRole("button", { name: "Скрыть навсегда (X)" })).toHaveAttribute("aria-pressed", "true");

  // Обводим верхнюю строку: в координатах страницы это примерно x 50–300, y 40–100 (сверху)
  const box = (await page.locator('[data-page-index="0"]').boundingBox())!;
  const k = box.width / 595;
  await page.mouse.move(box.x + 50 * k, box.y + 40 * k);
  await page.mouse.down();
  await page.mouse.move(box.x + 300 * k, box.y + 100 * k, { steps: 5 });
  await page.mouse.up();

  await page.getByRole("button", { name: "Параметры сохранения" }).click();
  await page.getByLabel(/Вернуть поиск по тексту/).check();
  await page.keyboard.press("Escape");
  const out = await download(page, () => page.getByRole("button", { name: "Скачать PDF" }).click());

  expect(await fileContains(out.bytes, "SECRET")).toBe(false);
  expect(await fileContains(out.bytes, "Ivan Petrov")).toBe(false);
  const [text] = await extractText(out.bytes);
  expect(text).toContain("VISIBLE");
  expect(text).not.toContain("SECRET");
});

test("PDF в Word: заголовок, абзацы и жирный, XML корректный", async ({ page }) => {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const p = doc.addPage([595, 842]);
  p.drawText("Annual report", { x: 72, y: 760, size: 26, font: bold });
  p.drawText("First paragraph of the report.", { x: 72, y: 700, size: 12, font: regular });
  p.drawText("Important bold statement.", { x: 72, y: 660, size: 12, font: bold });

  await page.goto("/ru/pdf-to-word");
  await dropPdf(page, { name: "report.pdf", bytes: await doc.save() });
  const out = await download(page, () => page.getByRole("button", { name: "Конвертировать" }).click());
  expect(out.name).toBe("report.docx");

  const zip = unzipSync(out.bytes);
  const xml = strFromU8(zip["word/document.xml"]);
  expect(xml).toContain('<w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t xml:space="preserve">Annual report</w:t>');
  expect(xml).toContain("First paragraph of the report.");
  expect(xml).toContain('<w:rPr><w:b/></w:rPr><w:t xml:space="preserve">Important bold statement.</w:t>');
  for (const [name, data] of Object.entries(zip)) {
    const errors = await page.evaluate(
      (text) => new DOMParser().parseFromString(text, "application/xml").getElementsByTagName("parsererror").length,
      strFromU8(data),
    );
    expect(errors, name).toBe(0);
  }
});

test("PDF в Word: скан распознаётся, текст попадает в .txt", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/ru/pdf-to-word");
  // «Скан»: картинка с текстом, нарисованная в браузере
  const dataUrl = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 300;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#000";
    ctx.font = "bold 90px Arial";
    ctx.fillText("SCANNED TEXT 42", 40, 180);
    return c.toDataURL("image/png");
  });
  const doc = await PDFDocument.create();
  const img = await doc.embedPng(Buffer.from(dataUrl.split(",")[1], "base64"));
  doc.addPage([595, 842]).drawImage(img, { x: 40, y: 600, width: 515, height: 110 });

  await dropPdf(page, { name: "scan.pdf", bytes: await doc.save() });
  await expect(page.getByText("Похоже, это скан")).toBeVisible();
  await expect(page.getByLabel(/Сначала распознать текст/)).toBeChecked();
  await page.getByRole("radio", { name: /Текст \(\.txt\)/ }).click();
  const out = await download(page, () => page.getByRole("button", { name: "Конвертировать" }).click());
  expect(Buffer.from(out.bytes).toString("utf8")).toContain("SCANNED TEXT 42");
});
