import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { RelatedTools } from "@/components/RelatedTools";
import { ToolStructuredData } from "@/components/StructuredData";
import { ToolGuide } from "@/components/ToolGuide";
import { pageMetadata } from "@/lib/metadata";
import { getTool, TOOL_ICON_CLASS, type ToolId } from "@/lib/tools";
import { cn } from "@/lib/utils";

/** Страница инструмента: шапка, сам инструмент, подвал с инструкцией и вопросами. */
export async function ToolPage({ id, children }: { id: ToolId; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <ToolHeader id={id} />
      {children}
      <ToolFooter id={id} />
    </main>
  );
}

/** Иконка, название, описание. */
export async function ToolHeader({ id }: { id: ToolId }) {
  const t = await getTranslations("tools");
  const tool = getTool(id);
  return (
    <div className="mb-8 flex flex-col items-center gap-3 text-center">
      <span className={cn("flex size-14 items-center justify-center rounded-2xl", TOOL_ICON_CLASS)}>
        <tool.icon className="size-7" />
      </span>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t(`${id}.title`)}</h1>
      <p className="max-w-xl text-muted-foreground">{t(`${id}.description`)}</p>
    </div>
  );
}

/** «Файлы остаются у вас», как пользоваться, частые вопросы, другие инструменты. */
export async function ToolFooter({ id }: { id: ToolId }) {
  const t = await getTranslations("common");
  return (
    <>
      <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-success" />
        {t("filesStayLocal")}
      </p>
      <ToolGuide id={id} />
      <RelatedTools id={id} />
      <ToolStructuredData id={id} />
    </>
  );
}

/** Метаданные страницы инструмента (title/description, адреса и превью для поисковиков). */
export async function toolMetadata(params: Promise<{ locale: string }>, id: ToolId): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: `tools.${id}` });
  const title = t("title");
  return { title, ...(await pageMetadata({ locale, path: getTool(id).href, title, description: t("description") })) };
}
