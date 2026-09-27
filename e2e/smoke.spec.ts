import { expect, test } from "./fixtures";

test("каждая страница из sitemap открывается", async ({ page, request }) => {
  const xml = await (await request.get("/sitemap.xml")).text();
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
  expect(paths.length).toBeGreaterThan(10);
  for (const path of paths) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page.locator("h1"), path).toBeVisible();
  }
});

test("корень ведёт на язык браузера", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/ru$/);
});

test.describe("английский браузер", () => {
  test.use({ locale: "en-US" });

  test("корень ведёт на /en", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
  });
});

test("неизвестный адрес — 404 с шапкой сайта и переводом", async ({ page }) => {
  const res = await page.goto("/en/no-such-page");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByRole("banner")).toBeVisible();
});

test("заголовки безопасности и CSP", async ({ request }) => {
  const res = await request.get("/ru");
  const headers = res.headers();
  expect(headers["content-security-policy"]).toContain("connect-src 'self'");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
});

test("старые адреса /editor?tool=… ведут на отдельные страницы", async ({ page }) => {
  await page.goto("/ru/editor?tool=sign");
  await expect(page).toHaveURL(/\/ru\/sign(\?|$)/);
  await expect(page.getByRole("heading", { name: "Подписать PDF", exact: true })).toBeVisible();
  await page.goto("/en/editor?tool=forms");
  await expect(page).toHaveURL(/\/en\/fill-form(\?|$)/);
});

test("разметка schema.org совпадает с вопросами на странице", async ({ page }) => {
  await page.goto("/ru/merge");
  const blocks = await page.locator('script[type="application/ld+json"]').allTextContents();
  const graph = blocks.flatMap((b) => JSON.parse(b)["@graph"] ?? []);
  const types = graph.map((n: { "@type": string }) => n["@type"]);
  expect(types).toEqual(expect.arrayContaining(["WebApplication", "FAQPage", "BreadcrumbList"]));

  const faq = graph.find((n: { "@type": string }) => n["@type"] === "FAQPage");
  const questions = faq.mainEntity.map((q: { name: string }) => q.name);
  await expect(page.locator("details summary")).toHaveText(questions);
});

test("картинка для превью ссылки отдаётся", async ({ page, request }) => {
  await page.goto("/ru/merge");
  const og = await page.locator('meta[property="og:image"]').getAttribute("content");
  const url = new URL(og!);
  const res = await request.get(url.pathname + url.search);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
});

test("поиск инструментов: Ctrl+K, ввод, Enter", async ({ page }) => {
  await page.goto("/ru");
  const input = page.getByRole("combobox", { name: "Найти инструмент" });
  // Пока страница не ожила, горячая клавиша не работает — повторяем
  await expect(async () => {
    await page.keyboard.press("Control+k");
    await expect(input).toBeFocused({ timeout: 500 });
  }).toPass();

  await input.fill("ЧЕРНО");
  await expect(page.getByRole("option")).toHaveText([/Чёрно-белый PDF/]);
  await input.fill("абракадабра");
  await expect(page.getByText("Ничего не нашлось")).toBeVisible();

  await input.fill("сжать");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/ru\/compress$/);
  await expect(page.getByRole("heading", { name: "Сжать PDF", exact: true })).toBeVisible();
});

test.describe("телефон", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("поиск открывается кнопкой в шапке", async ({ page }) => {
    await page.goto("/ru/merge");
    await page.getByRole("button", { name: "Найти инструмент", exact: true }).click();
    await page.getByRole("option", { name: /Сжать PDF/ }).click();
    await expect(page).toHaveURL(/\/ru\/compress$/);
  });
});
