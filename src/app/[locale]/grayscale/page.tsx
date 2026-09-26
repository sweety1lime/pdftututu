import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { GrayscaleTool } from "@/features/grayscale/GrayscaleTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/grayscale">) => toolMetadata(params, "grayscale");

export default async function Page({ params }: PageProps<"/[locale]/grayscale">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="grayscale">
      <GrayscaleTool />
    </ToolPage>
  );
}
