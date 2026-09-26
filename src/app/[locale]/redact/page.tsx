import { setRequestLocale } from "next-intl/server";
import { ToolFooter, ToolHeader, toolMetadata } from "@/components/ToolPage";
import { EditorLoader } from "@/features/editor/EditorLoader";

export const generateMetadata = ({ params }: PageProps<"/[locale]/redact">) => toolMetadata(params, "redact");

export default async function Page({ params }: PageProps<"/[locale]/redact">) {
  setRequestLocale((await params).locale);
  return <EditorLoader entry="redact" header={<ToolHeader id="redact" />} footer={<ToolFooter id="redact" />} />;
}
