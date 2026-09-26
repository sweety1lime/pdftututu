import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { OcrTool } from "@/features/ocr/OcrTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/ocr">) => toolMetadata(params, "ocr");

export default async function Page({ params }: PageProps<"/[locale]/ocr">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="ocr">
      <OcrTool />
    </ToolPage>
  );
}
