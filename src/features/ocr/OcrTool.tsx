"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Download, FileText, Info } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { MainAction, SecondaryAction, Summary, SummaryList, SummaryRow, ToolWorkspace } from "@/components/ToolWorkspace";
import { Checkbox, Label, Progress } from "@/components/ui/misc";
import { baseName, downloadBlob } from "@/lib/download";
import type { OcrProgress, OcrResult } from "@/lib/ocr";
import { OCR_LANGUAGES } from "@/lib/ocrLanguages";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";

export function OcrTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [langs, setLangs] = useState<string[]>(["rus", "eng"]);
  const [skipText, setSkipText] = useState(true);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [result, setResult] = useState<OcrResult | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Другие настройки — другой результат: снова показываем «Распознать»
  const toggleLang = (code: string) => {
    setLangs((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
    setResult(null);
  };

  const run = async () => {
    if (!file || !langs.length) return;
    setResult(null);
    abort.current = new AbortController();
    try {
      const { runOcr } = await import("@/lib/ocr");
      const r = await runOcr(
        file.bytes,
        file.doc,
        { languages: langs, skipPagesWithText: skipText, signal: abort.current.signal },
        setProgress,
      );
      setResult(r);
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const reset = () => {
    abort.current?.abort();
    setResult(null);
    clear();
  };

  if (!file) {
    return (
      <ToolWorkspace>
        <FileDropzone onFiles={(f) => add(f.slice(0, 1))} disabled={loading} />
      </ToolWorkspace>
    );
  }

  const overall = progress
    ? progress.stage === "loading"
      ? 0
      : ((progress.page - 1 + progress.pageProgress) / progress.total) * 100
    : 0;

  return (
    <ToolWorkspace
      summary={
        <Summary
          status={
            progress && (
              <div className="space-y-1.5">
                <p>
                  {progress.stage === "loading"
                    ? t("ocr.loadingModel")
                    : t("ocr.progress", { page: Math.max(1, progress.page), total: progress.total })}
                </p>
                <Progress value={overall} />
              </div>
            )
          }
          actions={
            result ? (
              <>
                <MainAction onClick={() => downloadBlob(result.pdf, `${baseName(file.name)}_ocr.pdf`)}>
                  <Download />
                  {t("ocr.downloadPdf")}
                </MainAction>
                <SecondaryAction
                  onClick={() =>
                    downloadBlob(
                      new Blob([result.text], { type: "text/plain;charset=utf-8" }),
                      `${baseName(file.name)}.txt`,
                    )
                  }
                >
                  <FileText />
                  {t("ocr.downloadTxt")}
                </SecondaryAction>
              </>
            ) : (
              <MainAction onClick={run} busy={progress !== null} disabled={!langs.length}>
                {t("ocr.action")}
              </MainAction>
            )
          }
        >
          <SummaryList>
            <SummaryRow label={t("summary.pages")}>{file.pageCount}</SummaryRow>
          </SummaryList>
        </Summary>
      }
    >
      <div className="flex flex-col gap-6">
        <FileCard file={file} onClose={reset} />
        <div className="space-y-4 rounded-xl border bg-card p-5">
          <div className="space-y-2">
            <Label>{t("ocr.languages")}</Label>
            <div className="flex flex-wrap gap-2">
              {OCR_LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  aria-pressed={langs.includes(l.code)}
                  onClick={() => toggleLang(l.code)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm transition-colors",
                    langs.includes(l.code) ? "border-primary bg-primary/10 font-medium" : "hover:bg-accent",
                  )}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </div>
          <Label className="font-normal">
            <Checkbox
              checked={skipText}
              onCheckedChange={(v) => {
                setSkipText(v === true);
                setResult(null);
              }}
            />
            {t("ocr.skipText")}
          </Label>
          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" />
            {t("ocr.note")}
          </p>
        </div>

        {result && (
          <div className="space-y-3 rounded-xl border bg-card p-5">
            <Label>{t("ocr.preview")}</Label>
            <textarea
              readOnly
              value={result.text || t("ocr.nothing")}
              className="h-64 w-full resize-y rounded-md border bg-muted/40 p-3 font-mono text-sm"
            />
          </div>
        )}

      </div>
    </ToolWorkspace>
  );
}
