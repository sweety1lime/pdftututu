import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { MetadataTool } from "@/features/metadata/MetadataTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/metadata">) => toolMetadata(params, "metadata");

export default async function Page({ params }: PageProps<"/[locale]/metadata">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="metadata">
      <MetadataTool />
    </ToolPage>
  );
}
