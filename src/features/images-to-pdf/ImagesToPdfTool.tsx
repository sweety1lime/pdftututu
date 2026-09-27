"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2, X } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { SortableGrid } from "@/components/SortableGrid";
import { DownloadsAs, MainAction, Summary, SummaryList, SummaryRow, ToolWorkspace } from "@/components/ToolWorkspace";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/misc";
import { Choice } from "@/components/ui/choice";
import { downloadBlob } from "@/lib/download";
import { prepareImage } from "@/lib/images";
import { newId } from "@/lib/pdf/load";
import { imagesToPdf, type ImagesToPdfOptions, type PreparedImage } from "@/lib/pdf/pages";
import { usePendingFiles } from "@/lib/pendingFiles";
import { useErrorToast } from "@/lib/useErrorToast";

interface Item extends PreparedImage {
  id: string;
  name: string;
  url: string;
}

export function ImagesToPdfTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<ImagesToPdfOptions>({ pageSize: "a4", orientation: "auto", margin: 0 });
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.url)), []);

  const add = async (files: File[]) => {
    setLoading(true);
    for (const file of files) {
      try {
        const img = await prepareImage(file);
        const url = URL.createObjectURL(new Blob([img.bytes as BlobPart], { type: img.mime }));
        setItems((prev) => [...prev, { ...img, id: newId("img"), name: file.name, url }]);
      } catch (e) {
        showError(e);
      }
    }
    setLoading(false);
  };

  usePendingFiles(add);

  const remove = (id: string) =>
    setItems((prev) => {
      const it = prev.find((i) => i.id === id);
      if (it) URL.revokeObjectURL(it.url);
      return prev.filter((i) => i.id !== id);
    });

  const outName = items.length === 1 ? `${items[0].name.replace(/\.[^.]+$/, "")}.pdf` : "images.pdf";

  const create = async () => {
    setBusy(true);
    try {
      const out = await imagesToPdf(items, opts);
      downloadBlob(out, outName);
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

if (!items.length) {
    return (
      <ToolWorkspace>
        <FileDropzone kind="images" multiple onFiles={add} disabled={loading} />
      </ToolWorkspace>
    );
  }

  return (
    <ToolWorkspace
      summary={
        <Summary
          status={<span className="lg:hidden">{t("common.pages", { count: items.length })}</span>}
          actions={
            <MainAction onClick={create} busy={busy} disabled={loading}>
              {t("imagesToPdf.action")}
            </MainAction>
          }
        >
          <SummaryList>
            <SummaryRow label={t("summary.pages")}>{items.length}</SummaryRow>
          </SummaryList>
          <DownloadsAs name={outName} />
        </Summary>
      }
    >
      <div>
        <div className="mb-6 grid gap-5 rounded-xl border bg-card p-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{t("imagesToPdf.pageSize")}</Label>
            <Choice
              value={opts.pageSize}
              onChange={(pageSize) => setOpts((o) => ({ ...o, pageSize }))}
              options={[
                { value: "a4", label: t("imagesToPdf.sizeA4") },
                { value: "letter", label: t("imagesToPdf.sizeLetter") },
                { value: "fit", label: t("imagesToPdf.sizeFit") },
              ]}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("imagesToPdf.orientation")}</Label>
            <Choice
              value={opts.orientation}
              onChange={(orientation) => setOpts((o) => ({ ...o, orientation }))}
              options={[
                { value: "auto", label: t("imagesToPdf.orientationAuto") },
                { value: "portrait", label: t("imagesToPdf.orientationPortrait") },
                { value: "landscape", label: t("imagesToPdf.orientationLandscape") },
              ]}
              className={opts.pageSize === "fit" ? "pointer-events-none opacity-50" : undefined}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("imagesToPdf.margin")}</Label>
            <Choice
              value={opts.margin}
              onChange={(margin) => setOpts((o) => ({ ...o, margin }))}
              options={[
                { value: 0, label: t("imagesToPdf.marginNone") },
                { value: 18, label: t("imagesToPdf.marginSmall") },
                { value: 42, label: t("imagesToPdf.marginBig") },
              ]}
            />
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <FileDropzone kind="images" compact multiple onFiles={add} disabled={loading} />
          <Button variant="ghost" className="ml-auto text-muted-foreground" onClick={() => [...items].forEach((i) => remove(i.id))}>
            <Trash2 />
            {t("common.clear")}
          </Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t("imagesToPdf.hint")}</p>

        <SortableGrid
          items={items}
          onReorder={setItems}
          renderItem={(it, i) => (
            <div className="group relative flex cursor-grab flex-col gap-2 rounded-xl border bg-card p-3 shadow-xs active:cursor-grabbing">
              <span className="absolute top-2 left-2 z-10 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => remove(it.id)}
                aria-label={t("common.remove")}
                className="absolute top-2 right-2 z-10 rounded-full bg-background/90 p-1 text-muted-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
              >
                <X className="size-4" />
              </button>
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.name} className="max-h-full max-w-full object-contain" draggable={false} />
              </div>
              <p className="truncate text-xs text-muted-foreground" title={it.name}>
                {it.name}
              </p>
            </div>
          )}
        />

      </div>
    </ToolWorkspace>
  );
}
