"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox, Label } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/menu";
import { baseName, downloadBlob } from "@/lib/download";
import { rasterizePages } from "@/lib/pdf/rasterize";
import { applyRedactions } from "@/lib/pdf/redact";
import { useErrorToast } from "@/lib/useErrorToast";
import { exportEditedPdf } from "./exportPdf";
import { useEditor } from "./store";

export function ExportButton() {
  const t = useTranslations("editor.export");
  const tc = useTranslations("common");
  const showError = useErrorToast();
  const [busy, setBusy] = useState(false);
  const [rasterize, setRasterize] = useState(false);
  const [flatten, setFlatten] = useState(false);
  const [redactOcr, setRedactOcr] = useState(false);
  const hasTextEdits = useEditor((s) => s.objects.some((o) => o.type === "whiteout" && o.coversText));
  const hasForms = useEditor((s) => s.widgets.length > 0);
  const hasRedactions = useEditor((s) => s.objects.some((o) => o.type === "redact"));

  const run = async () => {
    const s = useEditor.getState();
    if (!s.source) return;
    // Закрыть редактирование текста, чтобы оно попало в файл
    (document.activeElement as HTMLElement | null)?.blur?.();
    setBusy(true);
    try {
      const st = useEditor.getState();
      let out = await exportEditedPdf({
        bytes: st.source!.bytes,
        pages: st.pages,
        objects: st.objects,
        formValues: st.formValues,
        assets: st.assets,
        flattenForms: flatten,
      });
      const pagesWith = (test: (o: (typeof st.objects)[number]) => boolean) =>
        new Set(st.objects.filter(test).map((o) => o.page));
      const redacted = pagesWith((o) => o.type === "redact");
      const textEdited = rasterize && hasTextEdits ? pagesWith((o) => o.type === "whiteout" && !!o.coversText) : new Set<number>();
      if (redacted.size) {
        out = await applyRedactions(out, new Set([...redacted, ...textEdited]), {
          ocrLanguages: redactOcr ? ["rus", "eng"] : undefined,
        });
      } else if (textEdited.size) {
        out = await rasterizePages(out, { dpi: 200, quality: 0.85, only: textEdited });
      }
      downloadBlob(out, `${baseName(st.source!.name)}_${redacted.size ? "redacted" : "edited"}.pdf`);
      toast.success(tc("done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const hasOptions = hasTextEdits || hasForms || hasRedactions;

  return (
    <div className="flex">
      <Button onClick={run} disabled={busy} className={hasOptions ? "rounded-r-none" : undefined}>
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        <span className="hidden sm:inline">{busy ? t("exporting") : t("download")}</span>
      </Button>
      {hasOptions && (
        <Popover>
          <PopoverTrigger asChild>
            <Button className="rounded-l-none border-l border-primary-foreground/20 px-2" aria-label={t("options")}>
              <ChevronDown />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 space-y-4">
            <p className="text-sm font-medium">{t("options")}</p>
            {hasRedactions && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">{t("redactNote")}</p>
                <Label className="font-normal">
                  <Checkbox checked={redactOcr} onCheckedChange={(v) => setRedactOcr(v === true)} />
                  {t("redactOcr")}
                </Label>
              </div>
            )}
            {hasTextEdits && (
              <div className="space-y-1.5">
                <Label className="font-normal">
                  <Checkbox checked={rasterize} onCheckedChange={(v) => setRasterize(v === true)} />
                  {t("rasterize")}
                </Label>
                <p className="pl-6 text-xs text-muted-foreground">{t("rasterizeHint")}</p>
              </div>
            )}
            {hasForms && (
              <Label className="font-normal">
                <Checkbox checked={flatten} onCheckedChange={(v) => setFlatten(v === true)} />
                {t("flattenForms")}
              </Label>
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
