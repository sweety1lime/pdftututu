import { setRequestLocale } from "next-intl/server";
import { toolMetadata } from "@/components/ToolPage";
import { EditorLoader } from "@/features/editor/EditorLoader";

export const generateMetadata = ({ params }: PageProps<"/[locale]/fill-form">) => toolMetadata(params, "forms");

export default async function Page({ params }: PageProps<"/[locale]/fill-form">) {
  setRequestLocale((await params).locale);
  return <EditorLoader entry="forms" />;
}
