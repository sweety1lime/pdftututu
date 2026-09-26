"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRight } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { ActionBar } from "@/components/ActionBar";
import { PdfThumb } from "@/components/PdfThumb";
import { baseName, downloadBlob } from "@/lib/download";
import { toGrayscale } from "@/lib/pdf/grayscale";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";

export function GrayscaleTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (!file) return;
    setBusy(true);
    try {
      downloadBlob(await toGrayscale(file.bytes), `${baseName(file.name)}_bw.pdf`);
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!file) return <FileDropzone onFiles={(f) => add(f.slice(0, 1))} disabled={loading} />;

  return (
    <div className="space-y-6">
      <FileCard file={file} onClose={clear} />
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <figure className="space-y-2 text-center">
          <PdfThumb doc={file.doc} pageIndex={0} width={200} className="w-40 sm:w-50" />
          <figcaption className="text-sm text-muted-foreground">{t("grayscale.before")}</figcaption>
        </figure>
        <ArrowRight className="size-6 shrink-0 text-muted-foreground" />
        <figure className="space-y-2 text-center">
          {/* Превью — CSS-фильтр; в файле то же даёт режим наложения Saturation */}
          <PdfThumb doc={file.doc} pageIndex={0} width={200} className="w-40 grayscale sm:w-50" />
          <figcaption className="text-sm text-muted-foreground">{t("grayscale.after")}</figcaption>
        </figure>
      </div>
      <ActionBar action={t("grayscale.action")} onAction={run} busy={busy}>
        {t("common.pages", { count: file.pageCount })}
      </ActionBar>
    </div>
  );
}
