import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Onest } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import { Providers } from "@/components/Providers";
import { SiteHeader } from "@/components/SiteHeader";
import "../globals.css";

const ui = Onest({ subsets: ["latin", "cyrillic"], variable: "--font-ui", display: "swap" });

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

  return (
    <html lang={locale} className={ui.variable} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider>
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
