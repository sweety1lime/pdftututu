import { setRequestLocale } from "next-intl/server";
import { ToolFooter, ToolHeader, toolMetadata } from "@/components/ToolPage";
import { EditorLoader } from "@/features/editor/EditorLoader";

export const generateMetadata = ({ params }: PageProps<"/[locale]/sign">) => toolMetadata(params, "sign");

export default async function Page({ params }: PageProps<"/[locale]/sign">) {
  setRequestLocale((await params).locale);
  return <EditorLoader entry="sign" header={<ToolHeader id="sign" />} footer={<ToolFooter id="sign" />} />;
}
