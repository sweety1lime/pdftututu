import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { relatedTools, TOOL_ICON_CLASS, type ToolId } from "@/lib/tools";
import { cn } from "@/lib/utils";

/** Ссылки на соседние инструменты внизу страницы. */
export async function RelatedTools({ id }: { id: ToolId }) {
  const t = await getTranslations();
  return (
    <section className="mt-16">
      <h2 className="mb-5 text-xl font-semibold">{t("guide.relatedTitle")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {relatedTools(id).map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className="group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", TOOL_ICON_CLASS)}>
              <tool.icon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block font-medium">{t(`tools.${tool.id}.title`)}</span>
              <span className="block truncate text-sm text-muted-foreground">{t(`tools.${tool.id}.description`)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
