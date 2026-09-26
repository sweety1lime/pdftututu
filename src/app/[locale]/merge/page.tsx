import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { MergeTool } from "@/features/merge/MergeTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/merge">) => toolMetadata(params, "merge");

export default async function Page({ params }: PageProps<"/[locale]/merge">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="merge">
      <MergeTool />
    </ToolPage>
  );
}
