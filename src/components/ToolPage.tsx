import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { pageMetadata } from "@/lib/metadata";
import { getTool, type ToolId } from "@/lib/tools";
import { cn } from "@/lib/utils";

/** Общая «шапка» страницы инструмента: иконка, название, описание. */
export async function ToolPage({ id, children }: { id: ToolId; children: React.ReactNode }) {
  const t = await getTranslations();
  const tool = getTool(id);
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:py-12">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <span className={cn("flex size-14 items-center justify-center rounded-2xl", tool.accent)}>
          <tool.icon className="size-7" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t(`tools.${id}.title`)}</h1>
        <p className="max-w-xl text-muted-foreground">{t(`tools.${id}.description`)}</p>
      </div>
      {children}
      <p className="mt-10 flex items-center justify-center gap-2 text-center text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
        {t("common.filesStayLocal")}
      </p>
    </main>
  );
}

/** Метаданные страницы инструмента (title/description, адреса и превью для поисковиков). */
export async function toolMetadata(params: Promise<{ locale: string }>, id: ToolId): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: `tools.${id}` });
  const title = t("title");
  const path = getTool(id).href.split("?")[0];
  return { title, ...(await pageMetadata({ locale, path, title, description: t("description") })) };
}
