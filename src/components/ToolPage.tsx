import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { RelatedTools } from "@/components/RelatedTools";
import { ToolSidebar } from "@/components/ToolSidebar";
import { ToolStructuredData } from "@/components/StructuredData";
import { ToolGuide } from "@/components/ToolGuide";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import { getTool, type ToolId } from "@/lib/tools";

/** Страница инструмента: заголовок, сам инструмент, под ним инструкция и вопросы. */
export async function ToolPage({ id, children }: { id: ToolId; children: React.ReactNode }) {
  return (
    <ToolShell id={id}>
      <ToolHeader id={id} />
      {children}
      <ToolFooter id={id} />
    </ToolShell>
  );
}

/**
 * Слева все инструменты, справа — сетка страницы. На широком экране в ней две колонки:
 * заголовок, рабочая область и подвал в первой, панель «Итог» (aside из ToolWorkspace)
 * во второй во всю высоту. Всё, кроме панели, попадает в первую колонку.
 */
export async function ToolShell({ id, children }: { id: ToolId; children: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      <ToolSidebar current={id} />
      <main className="flex min-w-0 flex-1 flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_1fr_auto] lg:[&>:not(aside)]:col-start-1">
        {children}
      </main>
    </div>
  );
}

/** Группа, название, описание. На телефоне вместо группы — кнопка «Назад» рядом с названием. */
export async function ToolHeader({ id }: { id: ToolId }) {
  const t = await getTranslations();
  const tool = getTool(id);
  return (
    <div className="flex w-full max-w-5xl flex-col gap-1 px-4 pt-3 lg:row-start-1 lg:gap-1.5 lg:px-8 lg:pt-7">
      <p className="hidden font-mono text-xs tracking-[0.08em] text-muted-foreground uppercase lg:block">
        {t(`home.groups.${tool.group}`)}
      </p>
      <div className="flex items-center gap-1">
        <Link
          href="/"
          aria-label={t("common.back")}
          className="-ml-3 flex size-11 shrink-0 items-center justify-center rounded-[10px] transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.015em] lg:text-3xl">
          {t(`tools.${id}.title`)}
        </h1>
      </div>
      <p className="text-sm text-muted-foreground lg:text-[15px]">{t(`tools.${id}.description`)}</p>
    </div>
  );
}

/** Как пользоваться, частые вопросы, другие инструменты. */
export async function ToolFooter({ id }: { id: ToolId }) {
  return (
    <div className="w-full max-w-5xl px-4 pb-16 lg:row-start-3 lg:px-8">
      <ToolGuide id={id} />
      <RelatedTools id={id} />
      <ToolStructuredData id={id} />
    </div>
  );
}

/** Метаданные страницы инструмента (title/description, адреса и превью для поисковиков). */
export async function toolMetadata(params: Promise<{ locale: string }>, id: ToolId): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: `tools.${id}` });
  const title = t("title");
  return { title, ...(await pageMetadata({ locale, path: getTool(id).href, title, description: t("description") })) };
}
