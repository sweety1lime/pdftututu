import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Подключает src/i18n/request.ts (переводы для серверных компонентов)
const withNextIntl = createNextIntlPlugin();

/**
 * CSP: всё грузится и отправляется только на свой сайт. Благодаря connect-src 'self'
 * браузер сам не даст странице передать файл на чужой сервер — «файлы никуда
 * не загружаются» подкреплено технически.
 * - 'unsafe-inline' в script-src — из-за встроенных скриптов Next.js и next-themes
 *   (nonce сделал бы все страницы динамическими вместо статических);
 * - 'wasm-unsafe-eval' — WebAssembly в pdf.js и tesseract.js.
 * В режиме разработки не включаем: там нужен eval для горячей перезагрузки.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self' data:",
  "connect-src 'self' blob: data:",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CSP }] : []),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
];

const nextConfig: NextConfig = {
  async redirects() {
    // Раньше подпись, правка текста и формы открывались как /editor?tool=…
    // Старые ссылки (закладки, поиск) ведём на отдельные страницы.
    const moved = { sign: "sign", editText: "edit-text", forms: "fill-form" };
    return Object.entries(moved).map(([tool, path]) => ({
      source: "/:locale(ru|en)/editor",
      has: [{ type: "query" as const, key: "tool", value: tool }],
      destination: `/:locale/${path}`,
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // Шрифты не меняются — пусть браузер кеширует навсегда
        source: "/fonts/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        // Файлы pdf.js и tesseract.js меняются только при обновлении библиотек
        source: "/:dir(pdfjs|tesseract)/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
