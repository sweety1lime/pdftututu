import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { PdfToWordTool } from "@/features/pdf-to-word/PdfToWordTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/pdf-to-word">) => toolMetadata(params, "pdfToWord");

export default async function Page({ params }: PageProps<"/[locale]/pdf-to-word">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="pdfToWord">
      <PdfToWordTool />
    </ToolPage>
  );
}
