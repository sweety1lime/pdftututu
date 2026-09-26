import { getLocale, getTranslations } from "next-intl/server";
import { loadGuide } from "@/components/ToolGuide";
import { localizedPath, SITE_URL } from "@/lib/site";
import { getTool, type ToolId } from "@/lib/tools";

/** Разметка schema.org для поисковиков. `<` экранируем, чтобы текст не закрыл тег. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
  );
}

/** Инструмент как веб-приложение + вопросы с ответами (те же, что на странице) + хлебные крошки. */
export async function ToolStructuredData({ id }: { id: ToolId }) {
  const locale = await getLocale();
  const t = await getTranslations();
  const guide = await loadGuide(id);
  const home = SITE_URL + localizedPath(locale, "");
  const url = SITE_URL + localizedPath(locale, getTool(id).href);
  const name = t(`tools.${id}.title`);
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebApplication",
            name,
            description: t(`tools.${id}.description`),
            url,
            applicationCategory: "UtilitiesApplication",
            operatingSystem: "Any",
            browserRequirements: "Requires JavaScript",
            isAccessibleForFree: true,
            inLanguage: locale,
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          },
          {
            "@type": "FAQPage",
            mainEntity: guide.faq.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: t("meta.siteName"), item: home },
              { "@type": "ListItem", position: 2, name, item: url },
            ],
          },
        ],
      }}
    />
  );
}

/** Сайт целиком — для главной. */
export async function SiteStructuredData() {
  const locale = await getLocale();
  const t = await getTranslations("meta");
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: t("siteName"),
        description: t("description"),
        url: SITE_URL + localizedPath(locale, ""),
        inLanguage: locale,
      }}
    />
  );
}
