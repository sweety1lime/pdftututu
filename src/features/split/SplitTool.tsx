"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { MainAction, Summary, SummaryList, SummaryRow, ToolWorkspace } from "@/components/ToolWorkspace";
import { PdfThumb } from "@/components/PdfThumb";
import { Input } from "@/components/ui/input";
import { Checkbox, Label } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { baseName, downloadFiles } from "@/lib/download";
import { splitPdf } from "@/lib/pdf/pages";
import { chunkPages, formatGroup, parsePageRanges } from "@/lib/pdf/ranges";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";

type Mode = "ranges" | "every" | "each";

export function SplitTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [mode, setMode] = useState<Mode>("ranges");
  const [ranges, setRanges] = useState("");
  const [every, setEvery] = useState(1);
  const [mergeRanges, setMergeRanges] = useState(false);
  const [busy, setBusy] = useState(false);

  const plan = useMemo((): { groups: number[][]; error?: string } => {
    if (!file) return { groups: [] };
    const n = file.pageCount;
    if (mode === "each") return { groups: chunkPages(n, 1) };
    if (mode === "every") return { groups: chunkPages(n, every) };
    const parsed = parsePageRanges(ranges, n);
    if (!parsed.ok) {
      const error =
        parsed.error === "empty"
          ? t("split.errEmpty")
          : parsed.error === "invalid"
            ? t("split.errInvalid", { token: parsed.token ?? "" })
            : t("split.errOutOfRange", { token: parsed.token ?? "", total: n });
      return { groups: [], error };
    }
    return { groups: mergeRanges ? [parsed.groups.flat()] : parsed.groups };
  }, [file, mode, every, ranges, mergeRanges, t]);

  const selected = useMemo(() => new Set(plan.groups.flat()), [plan]);

  const run = async () => {
    if (!file || !plan.groups.length) return;
    setBusy(true);
    try {
      const parts = await splitPdf(file.bytes, plan.groups);
      const base = baseName(file.name);
      downloadFiles(
        parts.map((data, i) => ({ name: `${base}_${formatGroup(plan.groups[i])}.pdf`, data })),
        `${base}_split.zip`,
      );
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!file) {
    return (
      <ToolWorkspace>
        <FileDropzone onFiles={(f) => add(f.slice(0, 1))} disabled={loading} />
      </ToolWorkspace>
    );
  }

  return (
    <ToolWorkspace
      summary={
        <Summary
          status={
            plan.groups.length > 0 && (
              <span className="lg:hidden">
                {t("split.willCreate", { files: t("common.files", { count: plan.groups.length }) })}
              </span>
            )
          }
          actions={
            <MainAction onClick={run} busy={busy} disabled={!plan.groups.length}>
              {t("split.action")}
            </MainAction>
          }
        >
          <SummaryList>
            <SummaryRow label={t("summary.files")}>{plan.groups.length}</SummaryRow>
            <SummaryRow label={t("summary.pages")}>{selected.size}</SummaryRow>
          </SummaryList>
        </Summary>
      }
    >
      <div className="flex flex-col gap-6">
        <FileCard file={file} onClose={clear} />

        <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap sm:w-fit">
            <TabsTrigger value="ranges">{t("split.modeRanges")}</TabsTrigger>
            <TabsTrigger value="every">{t("split.modeEvery")}</TabsTrigger>
            <TabsTrigger value="each">{t("split.modeEach")}</TabsTrigger>
          </TabsList>
          <TabsContent value="ranges" className="max-w-md space-y-3">
            <Label htmlFor="ranges">{t("split.rangesLabel")}</Label>
            <Input
              id="ranges"
              value={ranges}
              onChange={(e) => setRanges(e.target.value)}
              placeholder={t("split.rangesPlaceholder")}
              aria-invalid={Boolean(ranges && plan.error)}
              autoFocus
            />
            <p className={cn("text-sm", ranges && plan.error ? "text-destructive" : "text-muted-foreground")}>
              {ranges && plan.error ? plan.error : t("split.rangesHelp")}
            </p>
            <Label className="font-normal">
              <Checkbox checked={mergeRanges} onCheckedChange={(v) => setMergeRanges(v === true)} />
              {t("split.mergeRanges")}
            </Label>
          </TabsContent>
          <TabsContent value="every" className="max-w-md space-y-3">
            <Label htmlFor="every">{t("split.everyLabel")}</Label>
            <Input
              id="every"
              type="number"
              min={1}
              max={file.pageCount}
              value={every}
              onChange={(e) => setEvery(Math.max(1, Math.min(file.pageCount, Number(e.target.value) || 1)))}
              className="w-32"
            />
          </TabsContent>
          <TabsContent value="each" />
        </Tabs>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
          {Array.from({ length: file.pageCount }, (_, i) => (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-1.5 transition-colors",
                selected.has(i) ? "border-primary bg-primary/5" : "opacity-45",
              )}
            >
              <PdfThumb doc={file.doc} pageIndex={i} width={110} className="mx-auto" />
              <p className="mt-1 text-center text-xs text-muted-foreground">{i + 1}</p>
            </div>
          ))}
        </div>

      </div>
    </ToolWorkspace>
  );
}
