import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { languageAlternates, localizedPath } from "@/lib/site";

/**
 * Метаданные, которые у каждой страницы свои: canonical, hreflang и Open Graph.
 * Next.js сливает метаданные layout и страницы поверхностно, поэтому их нельзя
 * задавать в layout — иначе все страницы получат адреса и превью главной.
 * @param path — путь без языка: "" (главная), "/merge"…
 */
export async function pageMetadata(opts: {
  locale: string;
  path: string;
  title: string;
  description: string;
}): Promise<Metadata> {
  const { locale, path, title, description } = opts;
  const t = await getTranslations({ locale, namespace: "meta" });
  const url = localizedPath(locale, path);
  return {
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: { title, description, url, siteName: t("siteName"), type: "website", locale },
  };
}
