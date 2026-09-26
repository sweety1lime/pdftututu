import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { ImagesToPdfTool } from "@/features/images-to-pdf/ImagesToPdfTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/images-to-pdf">) =>
  toolMetadata(params, "imagesToPdf");

export default async function Page({ params }: PageProps<"/[locale]/images-to-pdf">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="imagesToPdf">
      <ImagesToPdfTool />
    </ToolPage>
  );
}
