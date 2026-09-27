"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Eraser, EyeOff } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { DownloadsAs, MainAction, Summary, ToolWorkspace } from "@/components/ToolWorkspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { baseName, downloadBlob } from "@/lib/download";
import type { PdfMetadata } from "@/lib/pdf/metadata";
import { METADATA_FIELDS, type MetadataField } from "@/lib/pdf/metadataFields";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";

type Fields = Record<MetadataField, string>;

export function MetadataTool() {
  const t = useTranslations();
  const locale = useLocale();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [meta, setMeta] = useState<PdfMetadata | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [clearAll, setClearAll] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!file) return;
    let alive = true;
    import("@/lib/pdf/metadata")
      .then(({ readMetadata }) => readMetadata(file.bytes))
      .then(
        (m) => {
          if (!alive) return;
          setMeta(m);
          setFields(Object.fromEntries(METADATA_FIELDS.map((f) => [f, m[f]])) as Fields);
          setClearAll(false);
        },
        (e) => showError(e),
      );
    return () => {
      alive = false;
    };
  }, [file, showError]);

  const reset = () => {
    setMeta(null);
    setFields(null);
    clear();
  };

  const eraseAll = () => {
    setFields(Object.fromEntries(METADATA_FIELDS.map((f) => [f, ""])) as Fields);
    setClearAll(true);
  };

  const outName = file ? `${baseName(file.name)}${clearAll ? "_clean" : ""}.pdf` : "";

  const run = async () => {
    if (!file || !fields) return;
    setBusy(true);
    try {
      const { writeMetadata } = await import("@/lib/pdf/metadata");
      const out = await writeMetadata(file.bytes, fields, { clearAll });
      downloadBlob(out, outName);
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

  const date = (d?: Date) =>
    d && !clearAll ? d.toLocaleString(locale, { dateStyle: "long", timeStyle: "short" }) : "—";

  return (
    <ToolWorkspace
      summary={
        <Summary
          actions={
            <MainAction onClick={run} busy={busy} disabled={!fields}>
              {t("metadata.action")}
            </MainAction>
          }
        >
          <DownloadsAs name={outName} />
        </Summary>
      }
    >
      <div className="flex max-w-2xl flex-col gap-6">
        <FileCard file={file} onClose={reset} />

        {meta && fields && (
          <>
            <div className="space-y-4 rounded-xl border bg-card p-5">
              {METADATA_FIELDS.map((f) => (
                <div key={f} className="grid gap-1.5 sm:grid-cols-[10rem_1fr] sm:items-center">
                  <Label htmlFor={`meta-${f}`}>{t(`metadata.fields.${f}`)}</Label>
                  <Input
                    id={`meta-${f}`}
                    value={fields[f]}
                    placeholder="—"
                    onChange={(e) => {
                      setFields({ ...fields, [f]: e.target.value });
                      setClearAll(false);
                    }}
                  />
                </div>
              ))}
              <dl className="grid gap-x-4 gap-y-1.5 pt-1 text-sm sm:grid-cols-[10rem_1fr]">
                <dt className="font-medium">{t("metadata.created")}</dt>
                <dd className="text-muted-foreground">{date(meta.created)}</dd>
                <dt className="font-medium">{t("metadata.modified")}</dt>
                <dd className="text-muted-foreground">{date(meta.modified)}</dd>
              </dl>
            </div>

            {meta.hasHiddenData && !clearAll && (
              <p className="flex gap-2 text-sm text-muted-foreground">
                <EyeOff className="size-4 shrink-0 translate-y-0.5" />
                {t("metadata.hiddenData")}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={eraseAll} disabled={clearAll}>
                <Eraser />
                {t("metadata.clearAll")}
              </Button>
              <p className="text-sm text-muted-foreground">
                {clearAll ? t("metadata.clearAllReady") : t("metadata.clearAllHint")}
              </p>
            </div>
          </>
        )}

      </div>
    </ToolWorkspace>
  );
}
