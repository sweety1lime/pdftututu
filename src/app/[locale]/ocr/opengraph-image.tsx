import { routing } from "@/i18n/routing";
import { ogImage, OG_SIZE } from "@/lib/og";

export const alt = "PDFtutut";
export const size = OG_SIZE;
export const contentType = "image/png";

// Рисуем при сборке, а не на каждый запрос
export const generateStaticParams = () => routing.locales.map((locale) => ({ locale }));

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  return ogImage((await params).locale, "ocr");
}
