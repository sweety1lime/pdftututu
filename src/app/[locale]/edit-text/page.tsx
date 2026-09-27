import { setRequestLocale } from "next-intl/server";
import { ToolFooter, ToolHeader, toolMetadata } from "@/components/ToolPage";
import { ToolSidebar } from "@/components/ToolSidebar";
import { EditorLoader } from "@/features/editor/EditorLoader";

export const generateMetadata = ({ params }: PageProps<"/[locale]/edit-text">) => toolMetadata(params, "editText");

export default async function Page({ params }: PageProps<"/[locale]/edit-text">) {
  setRequestLocale((await params).locale);
  return (
    <EditorLoader
      entry="editText"
      sidebar={<ToolSidebar current="editText" />}
      header={<ToolHeader id="editText" />}
      footer={<ToolFooter id="editText" />}
    />
  );
}
