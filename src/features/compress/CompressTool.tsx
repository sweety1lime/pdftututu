"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import * as Comlink from "comlink";
import { ArrowRight, Download, TriangleAlert } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { ActionBar } from "@/components/ActionBar";
import { Button } from "@/components/ui/button";
import { Label, Progress } from "@/components/ui/misc";
import { Choice } from "@/components/ui/choice";
import { baseName, downloadBlob, formatBytes } from "@/lib/download";
import { COMPRESS_PRESETS } from "@/lib/pdf/compress";
import { rasterizePages } from "@/lib/pdf/rasterize";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";
import type { CompressWorkerApi } from "@/workers/compress.worker";

type Level = "light" | "recommended" | "extreme";

async function compressInWorker(bytes: Uint8Array, level: "light" | "recommended", onProgress: (p: number) => void) {
  const worker = new Worker(new URL("../../workers/compress.worker.ts", import.meta.url), { type: "module" });
  try {
    const api = Comlink.wrap<CompressWorkerApi>(worker);
    const copy = bytes.slice();
    const result = await api.compress(
      Comlink.transfer(copy, [copy.buffer]),
      COMPRESS_PRESETS[level],
      Comlink.proxy((done: number, total: number) => onProgress(total ? (done / total) * 100 : 100)),
    );
    return result.bytes;
  } finally {
    worker.terminate();
  }
}

export function CompressTool() {
  const t = useTranslations();
  const locale = useLocale();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [level, setLevel] = useState<Level>("recommended");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ bytes: Uint8Array; level: Level } | null>(null);

  const run = async () => {
    if (!file) return;
    setResult(null);
    setProgress(0);
    try {
      const out =
        level === "extreme"
          ? await rasterizePages(file.bytes, { dpi: 110, quality: 0.6 }, (d, n) => setProgress((d / n) * 100))
          : await compressInWorker(file.bytes, level, setProgress);
      setResult({ bytes: out, level });
    } catch (e) {
      showError(e);
    } finally {
      setProgress(null);
    }
  };

  const reset = () => {
    setResult(null);
    clear();
  };

  if (!file) return <FileDropzone onFiles={(f) => add(f.slice(0, 1))} disabled={loading} />;

  const before = file.size;
  const after = result?.bytes.length ?? 0;
  const gained = result && after < before * 0.98;
  const percent = result ? Math.round((1 - after / before) * 100) : 0;

  return (
    <div className="space-y-6">
      <FileCard file={file} onClose={reset} />
      <div className="space-y-2">
        <Label>{t("compress.level")}</Label>
        <Choice
          value={level}
          onChange={(v) => {
            setLevel(v);
            setResult(null);
          }}
          options={[
            { value: "light", label: t("compress.light"), hint: t("compress.lightDesc") },
            { value: "recommended", label: t("compress.recommended"), hint: t("compress.recommendedDesc") },
            { value: "extreme", label: t("compress.extreme"), hint: t("compress.extremeDesc") },
          ]}
        />
        {level === "extreme" && (
          <p className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
            <TriangleAlert className="size-4 shrink-0" />
            {t("compress.extremeDesc")}
          </p>
        )}
      </div>

      {result && (
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center">
          <div className="flex items-center gap-3 text-2xl font-semibold">
            <span className="text-muted-foreground">{formatBytes(before, locale)}</span>
            <ArrowRight className="size-5 text-muted-foreground" />
            <span className={gained ? "text-emerald-600 dark:text-emerald-400" : undefined}>
              {formatBytes(after, locale)}
            </span>
          </div>
          <p className="text-muted-foreground">
            {gained ? t("compress.saved", { percent }) : t("compress.noGain")}
          </p>
          {gained && (
            <Button size="lg" onClick={() => downloadBlob(result.bytes, `${baseName(file.name)}_compressed.pdf`)}>
              <Download />
              {t("common.download")}
            </Button>
          )}
        </div>
      )}

      <ActionBar action={t("compress.action")} onAction={run} busy={progress !== null}>
        {progress !== null && <Progress value={progress} className="max-w-xs" />}
      </ActionBar>
    </div>
  );
}
