import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { ProtectTool } from "@/features/security/ProtectTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/protect">) => toolMetadata(params, "protect");

export default async function Page({ params }: PageProps<"/[locale]/protect">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="protect">
      <ProtectTool />
    </ToolPage>
  );
}
