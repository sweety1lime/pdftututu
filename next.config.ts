import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Подключает src/i18n/request.ts (переводы для серверных компонентов)
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  async headers() {
    return [
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
