import { routing } from "@/i18n/routing";

/**
 * Адрес сайта для sitemap и превью в соцсетях.
 * На Vercel берётся из системной переменной VERCEL_PROJECT_PRODUCTION_URL,
 * а свой домен можно задать через NEXT_PUBLIC_SITE_URL.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

/** Адрес страницы на языке locale; path — без языка: "" (главная), "/merge"… */
export const localizedPath = (locale: string, path: string) => `/${locale}${path}`;

/** hreflang-ссылки на все языковые версии страницы (base — домен для абсолютных адресов). */
export function languageAlternates(path: string, base = ""): Record<string, string> {
  return {
    ...Object.fromEntries(routing.locales.map((l) => [l, base + localizedPath(l, path)])),
    "x-default": base + localizedPath(routing.defaultLocale, path),
  };
}
