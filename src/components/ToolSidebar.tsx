import { Fragment } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { TOOL_GROUPS, TOOLS, type ToolId } from "@/lib/tools";
import { cn } from "@/lib/utils";

/**
 * Все инструменты слева на странице инструмента (только на широком экране).
 * Рендерится на сервере — ссылки на соседние страницы есть в HTML для поисковиков.
 */
export async function ToolSidebar({ current }: { current: ToolId }) {
  const t = await getTranslations();
  return (
    <nav
      aria-label={t("common.allTools")}
      className="sticky top-15 hidden h-[calc(100dvh-3.75rem)] w-64 shrink-0 flex-col gap-0.5 overflow-y-auto border-r bg-panel px-2.5 pt-2 pb-3 lg:flex"
    >
      {TOOL_GROUPS.map((group) => (
        <Fragment key={group}>
          <p className="mx-2.5 mt-3 mb-1 font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase first:mt-2">
            {t(`home.groups.${group}`)}
          </p>
          {TOOLS.filter((tool) => tool.group === group).map((tool) => {
            const active = tool.id === current;
            return (
              <Link
                key={tool.id}
                href={tool.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2.5 rounded-md px-2.5 text-sm text-secondary-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                  active && "bg-primary/13 font-semibold text-primary-ink hover:bg-primary/13 hover:text-primary-ink",
                )}
              >
                <tool.icon className="size-4 shrink-0" />
                <span className="truncate">{t(`tools.${tool.id}.title`)}</span>
              </Link>
            );
          })}
        </Fragment>
      ))}
    </nav>
  );
}
