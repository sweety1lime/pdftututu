import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { languageAlternates, localizedPath, SITE_URL } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  // Главная + страницы инструментов (без ?tool=… — это вкладки редактора)
  const paths = ["", ...new Set(TOOLS.map((t) => t.href.split("?")[0]))];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: SITE_URL + localizedPath(locale, path),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
      alternates: { languages: languageAlternates(path, SITE_URL) },
    })),
  );
}
