import { getTranslations, setRequestLocale } from "next-intl/server";
import { DraftCard } from "@/components/DraftCard";
import { HomeDropzone } from "@/components/HomeDropzone";
import { SiteStructuredData } from "@/components/StructuredData";
import { Link } from "@/i18n/navigation";
import { pageMetadata } from "@/lib/metadata";
import { REPO_URL } from "@/lib/site";
import { getTool, POPULAR_TOOLS, TOOL_GROUPS, TOOLS } from "@/lib/tools";

export async function generateMetadata({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return pageMetadata({ locale, path: "", title: t("title"), description: t("description") });
}

const groupLabel = "font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase lg:text-xs";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <>
      <main className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col gap-4 px-4 pt-4 pb-6 lg:gap-10 lg:px-10 lg:pt-8 lg:pb-10">
        <SiteStructuredData />

        <div className="grid gap-4 lg:h-[490px] lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:gap-5">
          <HomeDropzone />
          <aside className="flex flex-col gap-3.5 lg:rounded-2xl lg:border lg:bg-card lg:p-5">
            <DraftCard />
            <div className="hidden flex-col gap-2 lg:flex">
              <h2 className={`${groupLabel} mt-1.5`}>{t("home.popular")}</h2>
              <nav aria-label={t("home.popular")} className="flex flex-col gap-0.5">
                {POPULAR_TOOLS.map(getTool).map((tool) => (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    className="flex h-10 items-center gap-3 rounded-lg px-2.5 text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <tool.icon className="size-4 text-muted-foreground" />
                    {t(`tools.${tool.id}.title`)}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>
        </div>

        <section className="mt-2 flex flex-col gap-3 lg:mt-0 lg:gap-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-[-0.01em] lg:text-xl">{t("common.allTools")}</h2>
            <span className="font-mono text-xs text-muted-foreground">
              <span className="lg:hidden">{TOOLS.length}</span>
              <span className="max-lg:hidden">{t("home.toolsCount", { count: TOOLS.length })}</span>
            </span>
          </div>
          {/* Описание сайта для поисковиков: на первом экране его заменила зона загрузки */}
          <p className="max-w-3xl text-sm text-muted-foreground">{t("home.subtitle")}</p>
          <div className="grid items-start gap-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {TOOL_GROUPS.map((group) => (
              <div key={group} className="flex flex-col gap-2 rounded-xl border bg-card p-3 lg:gap-0 lg:p-2">
                <h3 className={`${groupLabel} mb-0.5 lg:mb-0 lg:px-2.5 lg:pt-2.5 lg:pb-2`}>
                  {t(`home.groups.${group}`)}
                </h3>
                <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-0">
                  {TOOLS.filter((tool) => tool.group === group).map((tool) => (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      className="flex min-h-13 items-center gap-2.5 rounded-lg bg-secondary px-2.5 py-2 text-sm leading-tight transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:grid lg:min-h-0 lg:grid-cols-[32px_minmax(0,1fr)] lg:items-start lg:gap-x-3 lg:bg-transparent lg:p-2.5"
                    >
                      <span className="flex shrink-0 items-center justify-center text-secondary-foreground lg:size-8 lg:rounded-lg lg:bg-secondary">
                        <tool.icon className="size-4" />
                      </span>
                      <span className="flex flex-col gap-0.5">
                        <span className="lg:font-semibold">{t(`tools.${tool.id}.title`)}</span>
                        <span className="hidden text-[13px] leading-snug text-muted-foreground lg:block">
                          {t(`tools.${tool.id}.description`)}
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="flex flex-col gap-2.5 border-t px-4 pt-5 pb-7 text-[13px] leading-normal text-muted-foreground lg:h-13 lg:flex-row lg:items-center lg:justify-between lg:px-10 lg:py-0">
        <span>{t("home.footer")}</span>
        <a href={REPO_URL} className="text-secondary-foreground underline underline-offset-4 hover:text-foreground">
          {t("common.sourceCode")} · MIT
        </a>
      </footer>
    </>
  );
}
