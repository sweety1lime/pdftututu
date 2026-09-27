import { setRequestLocale } from "next-intl/server";
import { ToolFooter, ToolHeader, toolMetadata } from "@/components/ToolPage";
import { ToolSidebar } from "@/components/ToolSidebar";
import { EditorLoader } from "@/features/editor/EditorLoader";

export const generateMetadata = ({ params }: PageProps<"/[locale]/editor">) => toolMetadata(params, "editor");

export default async function Page({ params }: PageProps<"/[locale]/editor">) {
  setRequestLocale((await params).locale);
  return (
    <EditorLoader
      sidebar={<ToolSidebar current="editor" />}
      header={<ToolHeader id="editor" />}
      footer={<ToolFooter id="editor" />}
    />
  );
}
