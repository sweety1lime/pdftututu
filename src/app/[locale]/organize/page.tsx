import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { OrganizeTool } from "@/features/organize/OrganizeTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/organize">) => toolMetadata(params, "organize");

export default async function Page({ params }: PageProps<"/[locale]/organize">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="organize">
      <OrganizeTool />
    </ToolPage>
  );
}
