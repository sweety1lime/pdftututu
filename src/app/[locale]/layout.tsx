import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Onest } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
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
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    applicationName: t("siteName"),
    openGraph: { title: t("title"), description: t("description"), siteName: t("siteName"), type: "website", locale },
    alternates: { languages: { ru: "/ru", en: "/en" } },
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
      </body>
    </html>
  );
}
