import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { languageAlternates, localizedPath, SITE_URL } from "@/lib/site";
import { TOOLS } from "@/lib/tools";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = ["", ...TOOLS.map((t) => t.href)];
  return paths.flatMap((path) =>
    routing.locales.map((locale) => ({
      url: SITE_URL + localizedPath(locale, path),
      changeFrequency: "monthly" as const,
      priority: path === "" ? 1 : 0.8,
      alternates: { languages: languageAlternates(path, SITE_URL) },
    })),
  );
}
