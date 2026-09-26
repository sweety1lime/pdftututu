import { setRequestLocale } from "next-intl/server";
import { toolMetadata } from "@/components/ToolPage";
import { EditorLoader } from "@/features/editor/EditorLoader";

export const generateMetadata = ({ params }: PageProps<"/[locale]/editor">) => toolMetadata(params, "editor");

export default async function Page({ params }: PageProps<"/[locale]/editor">) {
  setRequestLocale((await params).locale);
  return <EditorLoader />;
}
