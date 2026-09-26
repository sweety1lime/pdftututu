import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { UnlockTool } from "@/features/security/UnlockTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/unlock">) => toolMetadata(params, "unlock");

export default async function Page({ params }: PageProps<"/[locale]/unlock">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="unlock">
      <UnlockTool />
    </ToolPage>
  );
}
