import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/SiteHeader";
import { fontVariables } from "../fonts";
import "../globals.css";

/**
 * Разделы переводов, нужные только на сервере: инструкции с частыми вопросами и тексты
 * для поисковиков. Они уже в HTML, а в данных для браузера занимали бы ~20 КБ на каждой странице.
 */
const SERVER_ONLY_MESSAGES = new Set(["guide", "meta"]);

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<"/[locale]">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  // canonical, hreflang и Open Graph — у каждой страницы свои (см. pageMetadata)
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    // Подтверждение прав в Google Search Console и Яндекс.Вебмастере: коды из их панелей
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
      yandex: process.env.YANDEX_VERIFICATION,
    },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<"/[locale]">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = Object.fromEntries(
    Object.entries(await getMessages()).filter(([namespace]) => !SERVER_ONLY_MESSAGES.has(namespace)),
  );

  return (
    <html lang={locale} className={fontVariables} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <SiteHeader />
            {children}
          </Providers>
        </NextIntlClientProvider>
        {/* Без cookies; скрипты и отправка — через /_vercel на этом же домене */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
