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
