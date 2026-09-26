import { setRequestLocale } from "next-intl/server";
import { ToolPage, toolMetadata } from "@/components/ToolPage";
import { PageNumbersTool } from "@/features/page-numbers/PageNumbersTool";

export const generateMetadata = ({ params }: PageProps<"/[locale]/page-numbers">) => toolMetadata(params, "pageNumbers");

export default async function Page({ params }: PageProps<"/[locale]/page-numbers">) {
  setRequestLocale((await params).locale);
  return (
    <ToolPage id="pageNumbers">
      <PageNumbersTool />
    </ToolPage>
  );
}
