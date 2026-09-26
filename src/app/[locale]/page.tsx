import { getTranslations, setRequestLocale } from "next-intl/server";
import { BadgeCheck, ShieldCheck, UserX } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TOOL_GROUPS, TOOLS } from "@/lib/tools";
import { cn } from "@/lib/utils";

export default async function HomePage({ params }: PageProps<"/[locale]">) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  const features = [
    { icon: BadgeCheck, text: t("home.feature1") },
    { icon: UserX, text: t("home.feature2") },
    { icon: ShieldCheck, text: t("home.feature3") },
  ];

  return (
    <main className="flex-1">
      <section className="relative overflow-hidden border-b bg-gradient-to-b from-primary/10 via-primary/5 to-transparent">
        <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:py-20">
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">{t("home.title")}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-balance text-muted-foreground">{t("home.subtitle")}</p>
          <ul className="mt-8 flex flex-wrap justify-center gap-3">
            {features.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-center gap-2 rounded-full border bg-background/70 px-4 py-1.5 text-sm font-medium shadow-xs"
              >
                <Icon className="size-4 text-primary" />
                {text}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12">
        {TOOL_GROUPS.map((group) => (
          <section key={group}>
            <h2 className="mb-4 text-sm font-semibold tracking-wider text-muted-foreground uppercase">
              {t(`home.groups.${group}`)}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TOOLS.filter((tool) => tool.group === group).map((tool) => (
                <Link
                  key={tool.id}
                  href={tool.href}
                  className="group flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  <span
                    className={cn(
                      "flex size-11 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
                      tool.accent,
                    )}
                  >
                    <tool.icon className="size-5.5" />
                  </span>
                  <span className="font-semibold">{t(`tools.${tool.id}.title`)}</span>
                  <span className="text-sm text-muted-foreground">{t(`tools.${tool.id}.description`)}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">{t("home.footer")}</footer>
    </main>
  );
}
