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
  const hasTextEdits = useEditor((s) => s.objects.some((o) => o.type === "whiteout" && o.coversText));
  const hasForms = useEditor((s) => s.widgets.length > 0);

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
      if (rasterize && hasTextEdits) {
        const pages = new Set(st.objects.filter((o) => o.type === "whiteout" && o.coversText).map((o) => o.page));
        out = await rasterizePages(out, { dpi: 200, quality: 0.85, only: pages });
      }
      downloadBlob(out, `${baseName(st.source!.name)}_edited.pdf`);
      toast.success(tc("done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const hasOptions = hasTextEdits || hasForms;

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
