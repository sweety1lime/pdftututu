"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDownAZ, GripVertical, Trash2, X } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { PdfThumb } from "@/components/PdfThumb";
import { SortableGrid } from "@/components/SortableGrid";
import { ActionBar } from "@/components/ActionBar";
import { Button } from "@/components/ui/button";
import { downloadBlob, formatBytes } from "@/lib/download";
import { mergePdfs } from "@/lib/pdf/pages";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";

export function MergeTool() {
  const t = useTranslations();
  const locale = useLocale();
  const showError = useErrorToast();
  const { files, setFiles, add, remove, clear, loading } = useLoadedPdfs();
  const [busy, setBusy] = useState(false);

  const totalPages = files.reduce((n, f) => n + f.pageCount, 0);

  const merge = async () => {
    setBusy(true);
    try {
      const out = await mergePdfs(files.map((f) => f.bytes));
      downloadBlob(out, "merged.pdf");
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!files.length) {
    return <FileDropzone multiple onFiles={add} disabled={loading} />;
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FileDropzone compact multiple onFiles={add} disabled={loading} />
        <Button
          variant="outline"
          onClick={() => setFiles((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name, locale, { numeric: true })))}
        >
          <ArrowDownAZ />
          {t("merge.sortByName")}
        </Button>
        <Button variant="ghost" onClick={clear} className="ml-auto text-muted-foreground">
          <Trash2 />
          {t("common.clear")}
        </Button>
      </div>
      <p className="mb-4 text-sm text-muted-foreground">{t("merge.hint")}</p>

      <SortableGrid
        items={files}
        onReorder={setFiles}
        renderItem={(f, i) => (
          <div className="group relative flex h-full cursor-grab flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs active:cursor-grabbing">
            <span className="absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {i + 1}
            </span>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => remove(f.id)}
              aria-label={t("common.remove")}
              className="absolute top-2 right-2 z-10 rounded-full bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
            >
              <X className="size-4" />
            </button>
            <PdfThumb doc={f.doc} pageIndex={0} width={180} className="mx-auto" />
            <div className="flex items-start gap-1">
              <GripVertical className="mt-0.5 size-4 shrink-0 text-muted-foreground/60" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium" title={f.name}>
                  {f.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("common.pages", { count: f.pageCount })} · {formatBytes(f.size, locale)}
                </p>
              </div>
            </div>
          </div>
        )}
      />

      <ActionBar
        action={t("merge.action")}
        onAction={merge}
        busy={busy}
        disabled={files.length < 2 || loading}
      >
        {files.length < 2
          ? t("merge.needTwo")
          : `${t("common.files", { count: files.length })} · ${t("merge.total", { pages: t("common.pages", { count: totalPages }) })}`}
      </ActionBar>
    </div>
  );
}
