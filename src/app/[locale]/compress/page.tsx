import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { CompressTool } from "@/features/compress/CompressTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/compress">) => toolMetadata(params, "compress");

export default async function Page({ params }: PageProps<"/[locale]/compress">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="compress">
      <CompressTool />
    </ToolPage>
  );
}
