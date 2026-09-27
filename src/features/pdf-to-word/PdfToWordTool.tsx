"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Info, ScanText } from "lucide-react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { DownloadsAs, MainAction, Summary, ToolWorkspace } from "@/components/ToolWorkspace";
import { Choice } from "@/components/ui/choice";
import { Checkbox, Label, Progress } from "@/components/ui/misc";
import { baseName, downloadBlob } from "@/lib/download";
import { closePdfjs, openPdfjs } from "@/lib/pdf/pdfjs";
import { getTextLines } from "@/lib/pdf/textLines";
import { blocksToDocx, blocksToText, linesToBlocks, type LineInput } from "@/lib/pdf/toWord";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";

type Format = "docx" | "txt";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Есть ли в документе текст (смотрим первые страницы — для сканов его нет). */
async function hasTextLayer(pdf: PDFDocumentProxy): Promise<boolean> {
  for (let i = 1; i <= Math.min(3, pdf.numPages); i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    if (content.items.some((it) => "str" in it && it.str.trim())) return true;
  }
  return false;
}

/** Строки всех страниц. getOperatorList загружает шрифты — без него не узнать жирный и курсив. */
async function extractLines(pdf: PDFDocumentProxy, onPage: (done: number) => void): Promise<LineInput[][]> {
  const pages: LineInput[][] = [];
  for (let i = 0; i < pdf.numPages; i++) {
    await (await pdf.getPage(i + 1)).getOperatorList();
    const lines = await getTextLines(pdf, i);
    pages.push(lines.map((l) => ({ ...l, bold: !!l.variant.bold, italic: !!l.variant.italic })));
    onPage(i + 1);
  }
  return pages;
}

export function PdfToWordTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [format, setFormat] = useState<Format>("docx");
  const [hasText, setHasText] = useState<boolean | null>(null);
  const [ocr, setOcr] = useState(false);
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    hasTextLayer(file.doc).then((found) => {
      if (!alive) return;
      setHasText(found);
      setOcr(!found);
    });
    return () => {
      alive = false;
    };
  }, [file]);

  const run = async () => {
    if (!file) return;
    let recognized: PDFDocumentProxy | null = null;
    setProgress({ label: t("common.processing"), value: 0 });
    try {
      let pdf = file.doc;
      if (ocr) {
        const { runOcr } = await import("@/lib/ocr");
        const result = await runOcr(file.bytes, file.doc, { languages: ["rus", "eng"], skipPagesWithText: true }, (p) =>
          setProgress({
            label: t("pdfToWord.recognizing", { page: p.page, total: p.total }),
            value: ((p.page - 1 + p.pageProgress) / p.total) * 100,
          }),
        );
        recognized = await openPdfjs(result.pdf);
        pdf = recognized;
      }
      const pages = await extractLines(pdf, (done) =>
        setProgress({ label: t("common.processing"), value: (done / pdf.numPages) * 100 }),
      );
      const blocks = linesToBlocks(pages);
      if (!blocks.length) {
        toast.warning(t("pdfToWord.nothing"));
        return;
      }
      const base = baseName(file.name);
      if (format === "docx") downloadBlob(blocksToDocx(blocks), `${base}.docx`, DOCX);
      else downloadBlob(new Blob([blocksToText(blocks)], { type: "text/plain;charset=utf-8" }), `${base}.txt`);
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      closePdfjs(recognized);
      setProgress(null);
    }
  };

  const reset = () => {
    setHasText(null);
    clear();
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
            progress && (
              <div className="space-y-1.5">
                <p>{progress.label}</p>
                <Progress value={progress.value} />
              </div>
            )
          }
          actions={
            <MainAction onClick={run} busy={progress !== null} disabled={hasText === null}>
              {t("pdfToWord.action")}
            </MainAction>
          }
        >
          <DownloadsAs name={`${baseName(file.name)}.${format}`} />
        </Summary>
      }
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <FileCard file={file} onClose={reset} />

        <div className="space-y-2">
          <Label>{t("pdfToWord.format")}</Label>
          <Choice
            value={format}
            onChange={setFormat}
            options={[
              { value: "docx", label: t("pdfToWord.formatDocx"), hint: t("pdfToWord.formatDocxHint") },
              { value: "txt", label: t("pdfToWord.formatTxt"), hint: t("pdfToWord.formatTxtHint") },
            ]}
          />
        </div>

        {hasText === false && (
          <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
            <p className="flex gap-2 text-sm">
              <ScanText className="size-4 shrink-0 translate-y-0.5 text-amber-600 dark:text-amber-400" />
              {t("pdfToWord.noText")}
            </p>
            <Label className="font-normal">
              <Checkbox checked={ocr} onCheckedChange={(v) => setOcr(v === true)} />
              {t("pdfToWord.ocr")}
            </Label>
          </div>
        )}

        <p className="flex gap-2 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0 translate-y-0.5" />
          {t("pdfToWord.limits")}
        </p>

      </div>
    </ToolWorkspace>
  );
}
