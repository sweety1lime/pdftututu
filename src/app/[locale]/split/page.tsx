import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { SplitTool } from "@/features/split/SplitTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/split">) => toolMetadata(params, "split");

export default async function Page({ params }: PageProps<"/[locale]/split">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="split">
      <SplitTool />
    </ToolPage>
  );
}
