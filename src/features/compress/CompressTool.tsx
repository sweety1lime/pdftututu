"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import * as Comlink from "comlink";
import { ArrowRight, Download, RefreshCw, TriangleAlert } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import {
  DownloadsAs,
  MainAction,
  SecondaryAction,
  Summary,
  SummaryList,
  SummaryRow,
  ToolWorkspace,
} from "@/components/ToolWorkspace";
import { Label, Progress } from "@/components/ui/misc";
import { Choice } from "@/components/ui/choice";
import { baseName, downloadBlob, formatBytes } from "@/lib/download";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";
import type { CompressLevel, CompressWorkerApi } from "@/workers/compress.worker";

type Level = "light" | "recommended" | "extreme";

async function compressInWorker(bytes: Uint8Array, level: CompressLevel, onProgress: (p: number) => void) {
  const worker = new Worker(new URL("../../workers/compress.worker.ts", import.meta.url), { type: "module" });
  try {
    const api = Comlink.wrap<CompressWorkerApi>(worker);
    const copy = bytes.slice();
    const result = await api.compress(
      Comlink.transfer(copy, [copy.buffer]),
      level,
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
      let out: Uint8Array;
      if (level === "extreme") {
        const { rasterizePages } = await import("@/lib/pdf/rasterize");
        out = await rasterizePages(file.bytes, { dpi: 110, quality: 0.6 }, (d, n) => setProgress((d / n) * 100));
      } else {
        out = await compressInWorker(file.bytes, level, setProgress);
      }
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

  if (!file) {
    return (
      <ToolWorkspace>
        <FileDropzone onFiles={(f) => add(f.slice(0, 1))} disabled={loading} />
      </ToolWorkspace>
    );
  }

  const before = file.size;
  const after = result?.bytes.length ?? 0;
  const gained = !!result && after < before * 0.98;
  const percent = result ? Math.round((1 - after / before) * 100) : 0;
  const outName = `${baseName(file.name)}_compressed.pdf`;
  const size = (n: number) => formatBytes(n, locale);

  return (
    <ToolWorkspace
      summary={
        <Summary
          status={progress !== null && <Progress value={progress} />}
          actions={
            result ? (
              <>
                {gained && (
                  <MainAction onClick={() => downloadBlob(result.bytes, outName)}>
                    <Download />
                    {t("common.download")}
                  </MainAction>
                )}
                {/* Вернуться к выбору степени: сжатие с теми же настройками дало бы тот же файл */}
                <SecondaryAction onClick={() => setResult(null)}>
                  <RefreshCw />
                  {t("compress.again")}
                </SecondaryAction>
              </>
            ) : (
              <MainAction onClick={run} busy={progress !== null}>
                {t("compress.action")}
              </MainAction>
            )
          }
        >
          <SummaryList>
            <SummaryRow label={t("summary.before")}>{size(before)}</SummaryRow>
            {result && (
              <SummaryRow label={t("summary.after")} className={cn(gained && "text-success")}>
                {size(after)}
              </SummaryRow>
            )}
            {gained && <SummaryRow label={t("summary.saved")}>{size(before - after)}</SummaryRow>}
            <SummaryRow label={t("summary.level")} mono={false}>
              {t(`compress.${result?.level ?? level}`)}
            </SummaryRow>
          </SummaryList>
          <DownloadsAs name={outName} />
        </Summary>
      }
    >
      <div className="flex flex-col gap-6">
        <FileCard file={file} onClose={reset} />

        <div className="flex flex-col gap-2.5">
          <Label className="font-semibold">{t("compress.level")}</Label>
          <Choice
            aria-label={t("compress.level")}
            value={level}
            onChange={(v) => {
              setLevel(v);
              setResult(null);
            }}
            options={[
              { value: "light", label: t("compress.light"), hint: t("compress.lightDesc") },
              { value: "recommended", label: t("compress.recommended"), hint: t("compress.recommendedDesc") },
              {
                value: "extreme",
                label: t("compress.extreme"),
                hint: t("compress.extremeDesc"),
                icon: <TriangleAlert />,
              },
            ]}
          />
        </div>

        {result && (
          <section
            aria-label={t("summary.after")}
            className="flex flex-col gap-5 rounded-[14px] border bg-card p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-2xl font-medium sm:text-3xl">
              <span className="text-muted-foreground">{size(before)}</span>
              <ArrowRight className="size-5 text-muted-foreground" />
              <span className={cn(gained && "text-success")}>{size(after)}</span>
              {gained && (
                <span className="ml-auto rounded-md bg-success/12 px-3 py-1 text-sm text-success">−{percent}%</span>
              )}
            </div>
            <SizeBars before={before} after={after} gained={gained} />
            <p className="text-[15px] text-secondary-foreground">
              {gained ? t("compress.saved", { percent }) : t("compress.noGain")}
            </p>
          </section>
        )}
      </div>
    </ToolWorkspace>
  );
}

/** Две полосы «Было / Стало» в масштабе большего из размеров. */
function SizeBars({ before, after, gained }: { before: number; after: number; gained: boolean }) {
  const t = useTranslations("summary");
  const max = Math.max(before, after);
  const bars = [
    { label: t("before"), value: before, color: "bg-input" },
    { label: t("after"), value: after, color: gained ? "bg-success" : "bg-input" },
  ];
  return (
    <div className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-x-3.5 gap-y-2.5 text-[13px] text-muted-foreground">
      {bars.map((b) => (
        <div key={b.label} className="contents">
          <span>{b.label}</span>
          <span className="flex">
            <span className={cn("h-2.5 rounded-full", b.color)} style={{ width: `${(b.value / max) * 100}%` }} />
          </span>
        </div>
      ))}
    </div>
  );
}
