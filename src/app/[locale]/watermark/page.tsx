import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { WatermarkTool } from "@/features/watermark/WatermarkTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/watermark">) => toolMetadata(params, "watermark");

export default async function Page({ params }: PageProps<"/[locale]/watermark">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="watermark">
      <WatermarkTool />
    </ToolPage>
  );
}
