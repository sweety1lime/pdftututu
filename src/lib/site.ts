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
