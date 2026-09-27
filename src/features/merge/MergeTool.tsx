"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowDownAZ, Download, GripVertical, Trash2, X } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { PdfThumb } from "@/components/PdfThumb";
import { SortableGrid } from "@/components/SortableGrid";
import { MainAction, Summary, SummaryList, SummaryRow, ToolWorkspace } from "@/components/ToolWorkspace";
import { Button } from "@/components/ui/button";
import { downloadBlob, formatBytes } from "@/lib/download";
import { useLoadedPdfs, type LoadedPdf } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";

export function MergeTool() {
  const t = useTranslations();
  const locale = useLocale();
  const showError = useErrorToast();
  const { files, setFiles, add, remove, clear, loading } = useLoadedPdfs();
  const [busy, setBusy] = useState(false);

  const totalPages = files.reduce((n, f) => n + f.pageCount, 0);
  const totalSize = files.reduce((n, f) => n + f.size, 0);

  const merge = async () => {
    setBusy(true);
    try {
      const { mergePdfs } = await import("@/lib/pdf/pages");
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
    return (
      <ToolWorkspace>
        <FileDropzone multiple onFiles={add} disabled={loading} />
      </ToolWorkspace>
    );
  }

  return (
    <ToolWorkspace
      summary={
        <Summary
          status={
            files.length < 2 ? (
              t("merge.needTwo")
            ) : (
              <span className="lg:hidden">
                {t("common.files", { count: files.length })} · {t("common.pages", { count: totalPages })}
              </span>
            )
          }
          actions={
            <MainAction onClick={merge} busy={busy} disabled={files.length < 2 || loading}>
              {t("merge.action")}
              <Download />
            </MainAction>
          }
        >
          <SummaryList>
            <SummaryRow label={t("summary.files")}>{files.length}</SummaryRow>
            <SummaryRow label={t("summary.pages")}>{totalPages}</SummaryRow>
            <SummaryRow label={t("summary.totalSize")}>{formatBytes(totalSize, locale)}</SummaryRow>
          </SummaryList>
        </Summary>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="mr-auto text-[13px] text-muted-foreground">{t("merge.hint")}</p>
          <FileDropzone compact multiple onFiles={add} disabled={loading} />
          <Button
            variant="outline"
            onClick={() =>
              setFiles((prev) => [...prev].sort((a, b) => a.name.localeCompare(b.name, locale, { numeric: true })))
            }
          >
            <ArrowDownAZ />
            {t("merge.sortByName")}
          </Button>
          <Button variant="ghost" onClick={clear} className="text-muted-foreground">
            <Trash2 />
            {t("common.clear")}
          </Button>
        </div>

        <SortableGrid
          layout="list"
          items={files}
          onReorder={setFiles}
          renderItem={(f, i) => <MergeRow file={f} index={i} onRemove={() => remove(f.id)} />}
        />

        <FileDropzone more multiple onFiles={add} disabled={loading} />
      </div>
    </ToolWorkspace>
  );
}

/** Сколько миниатюр страниц показать в строке файла: на телефоне меньше. */
const THUMBS = 12;
const THUMBS_PHONE = 3;

function MergeRow({ file, index, onRemove }: { file: LoadedPdf; index: number; onRemove: () => void }) {
  const t = useTranslations("common");
  const locale = useLocale();
  const shown = Math.min(file.pageCount, THUMBS);
  const more = (limit: number) => file.pageCount - limit;
  const moreBadge = "flex h-14 w-10 shrink-0 items-center justify-center rounded-sm bg-accent font-mono text-xs text-muted-foreground";

  return (
    <div className="grid cursor-grab grid-cols-[16px_28px_minmax(0,1fr)_36px] items-center gap-x-3 rounded-xl border bg-card p-3 active:cursor-grabbing sm:gap-x-3.5">
      <GripVertical className="size-4 text-muted-foreground" />
      <span className="flex size-7 items-center justify-center rounded-md bg-accent font-mono text-[13px] font-medium">
        {index + 1}
      </span>
      <div className="flex min-w-0 flex-col gap-2.5">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <span className="max-w-full truncate text-[15px] font-semibold" title={file.name}>
            {file.name}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {t("pages", { count: file.pageCount })} · {formatBytes(file.size, locale)}
          </span>
        </p>
        <div className="flex gap-1.5">
          {Array.from({ length: shown }, (_, p) => (
            <PdfThumb
              key={p}
              doc={file.doc}
              pageIndex={p}
              width={40}
              tight
              className={cn("w-10 shrink-0", p >= THUMBS_PHONE && "max-sm:hidden")}
            />
          ))}
          {more(THUMBS_PHONE) > 0 && <span className={cn(moreBadge, "sm:hidden")}>+{more(THUMBS_PHONE)}</span>}
          {more(THUMBS) > 0 && <span className={cn(moreBadge, "max-sm:hidden")}>+{more(THUMBS)}</span>}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onClick={onRemove}
        aria-label={t("remove")}
        className="text-muted-foreground hover:text-destructive"
      >
        <X />
      </Button>
    </div>
  );
}
