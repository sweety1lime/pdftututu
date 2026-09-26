import { getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import type { ToolId } from "@/lib/tools";

export interface FaqItem {
  q: string;
  a: string;
}

export interface Guide {
  howTo: string;
  steps: string[];
  /** Вопросы про сам инструмент, затем общие для всех */
  faq: FaqItem[];
}

/** Тексты инструкции из messages (guide.tools.<id> + guide.common). */
export async function loadGuide(id: ToolId, locale?: string): Promise<Guide> {
  const t = await (locale ? getTranslations({ locale, namespace: "guide" }) : getTranslations("guide"));
  return {
    howTo: t(`tools.${id}.howTo`),
    steps: t.raw(`tools.${id}.steps`) as string[],
    faq: [...(t.raw(`tools.${id}.faq`) as FaqItem[]), ...(t.raw("common") as FaqItem[])],
  };
}

/**
 * «Как это сделать» и частые вопросы под инструментом. Рендерится на сервере,
 * чтобы текст был в HTML для поисковиков; ответы свёрнуты в <details>.
 */
export async function ToolGuide({ id }: { id: ToolId }) {
  const t = await getTranslations("guide");
  const guide = await loadGuide(id);
  return (
    <section className="mx-auto mt-16 max-w-3xl space-y-12">
      <div>
        <h2 className="mb-5 text-2xl font-bold tracking-tight">{guide.howTo}</h2>
        <ol className="grid gap-4 sm:grid-cols-3">
          {guide.steps.map((step, i) => (
            <li key={i} className="rounded-xl border bg-card p-4">
              <span className="mb-3 flex size-7 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <p className="text-sm">{step}</p>
            </li>
          ))}
        </ol>
      </div>
      <div>
        <h2 className="mb-5 text-2xl font-bold tracking-tight">{t("faqTitle")}</h2>
        <div className="divide-y rounded-xl border bg-card">
          {guide.faq.map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
