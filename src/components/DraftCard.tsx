"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { clearDraft, loadDraftInfo, type DraftInfo } from "@/features/editor/draftStorage";
import { requestDraftRestore } from "@/lib/pendingFiles";
import { Button } from "@/components/ui/button";

/** «Продолжить» на главной: несохранённый черновик редактора, если он есть. */
export function DraftCard() {
  const t = useTranslations();
  const locale = useLocale();
  const [draft, setDraft] = useState<DraftInfo | null>(null);

  useEffect(() => {
    loadDraftInfo().then(setDraft);
  }, []);

  if (!draft) return null;

  const date = new Date(draft.savedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <section className="flex flex-col gap-3 max-lg:rounded-xl max-lg:border max-lg:bg-card max-lg:p-3.5 lg:gap-3.5">
      <h2 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase lg:text-xs">
        {t("home.continue")}
      </h2>
      <div className="flex flex-col gap-3 lg:rounded-xl lg:border lg:border-input lg:bg-secondary lg:p-3.5">
        <div className="flex items-center gap-3">
          <span className="flex h-11.5 w-8.5 shrink-0 items-center justify-center rounded-[3px] bg-white text-neutral-400 ring-1 ring-black/10">
            <FileText className="size-4" />
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-[15px] font-semibold" title={draft.name}>
              {draft.name}
            </p>
            <p className="text-[13px] text-muted-foreground">{t("home.draftMeta", { date })}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <Button asChild className="h-11 font-semibold lg:h-9">
            <Link href="/editor" onClick={requestDraftRestore}>
              {t("editor.draft.restore")}
            </Link>
          </Button>
          <Button
            variant="outline"
            className="h-11 text-secondary-foreground lg:h-9"
            onClick={() => clearDraft().then(() => setDraft(null))}
          >
            {t("editor.draft.discard")}
          </Button>
        </div>
      </div>
    </section>
  );
}
