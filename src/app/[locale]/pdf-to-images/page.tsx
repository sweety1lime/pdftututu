import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { PdfToImagesTool } from "@/features/pdf-to-images/PdfToImagesTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/pdf-to-images">) =>
  toolMetadata(params, "pdfToImages");

export default async function Page({ params }: PageProps<"/[locale]/pdf-to-images">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="pdfToImages">
      <PdfToImagesTool />
    </ToolPage>
  );
}
