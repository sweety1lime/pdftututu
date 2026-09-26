"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { ActionBar } from "@/components/ActionBar";
import { Input } from "@/components/ui/input";
import { Label, Progress } from "@/components/ui/misc";
import { Choice } from "@/components/ui/choice";
import { baseName, downloadFiles, type NamedFile } from "@/lib/download";
import { canvasToBytes, renderPageToNewCanvas } from "@/lib/pdf/pdfjs";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";

type Format = "png" | "jpg";

export function PdfToImagesTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [format, setFormat] = useState<Format>("png");
  const [dpi, setDpi] = useState(150);
  const [pagesMode, setPagesMode] = useState<"all" | "range">("all");
  const [range, setRange] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  const pages = useMemo(() => {
    if (!file) return [];
    if (pagesMode === "all") return Array.from({ length: file.pageCount }, (_, i) => i);
    const r = parsePageRanges(range, file.pageCount);
    return r.ok ? [...new Set(r.groups.flat())] : [];
  }, [file, pagesMode, range]);

  const run = async () => {
    if (!file) return;
    setProgress(0);
    try {
      const out: NamedFile[] = [];
      const base = baseName(file.name);
      const pad = String(file.pageCount).length;
      for (let k = 0; k < pages.length; k++) {
        const i = pages[k];
        const page = await file.doc.getPage(i + 1);
        const canvas = await renderPageToNewCanvas(page, dpi / 72);
        const data =
          format === "png" ? await canvasToBytes(canvas, "image/png") : await canvasToBytes(canvas, "image/jpeg", 0.9);
        canvas.width = canvas.height = 0;
        out.push({ name: `${base}_${String(i + 1).padStart(pad, "0")}.${format}`, data });
        setProgress(((k + 1) / pages.length) * 100);
      }
      downloadFiles(out, `${base}_images.zip`, format === "png" ? "image/png" : "image/jpeg");
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setProgress(null);
    }
  };

  if (!file) return <FileDropzone onFiles={(f) => add(f.slice(0, 1))} disabled={loading} />;

  return (
    <div className="space-y-6">
      <FileCard file={file} onClose={clear} />
      <div className="grid gap-6 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("pdfToImages.format")}</Label>
          <Choice
            value={format}
            onChange={setFormat}
            options={[
              { value: "png", label: "PNG" },
              { value: "jpg", label: "JPG" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <Label>{t("pdfToImages.dpi")}</Label>
          <Choice
            value={dpi}
            onChange={setDpi}
            options={[
              { value: 72, label: t("pdfToImages.dpiLow") },
              { value: 150, label: t("pdfToImages.dpiMid") },
              { value: 300, label: t("pdfToImages.dpiHigh") },
            ]}
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>{t("pdfToImages.pages")}</Label>
          <div className="flex flex-wrap items-center gap-3">
            <Choice
              value={pagesMode}
              onChange={setPagesMode}
              options={[
                { value: "all", label: t("pdfToImages.pagesAll") },
                { value: "range", label: t("pdfToImages.pagesRange") },
              ]}
            />
            {pagesMode === "range" && (
              <Input
                className="max-w-60"
                value={range}
                onChange={(e) => setRange(e.target.value)}
                placeholder={t("split.rangesPlaceholder")}
                autoFocus
              />
            )}
          </div>
        </div>
      </div>

      <ActionBar action={t("pdfToImages.action")} onAction={run} busy={progress !== null} disabled={!pages.length}>
        {progress !== null ? <Progress value={progress} className="max-w-xs" /> : t("common.pages", { count: pages.length })}
      </ActionBar>
    </div>
  );
}
