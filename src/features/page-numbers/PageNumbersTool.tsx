"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { ActionBar } from "@/components/ActionBar";
import { PdfThumb } from "@/components/PdfThumb";
import { Choice } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/misc";
import { baseName, downloadBlob } from "@/lib/download";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { addPageNumbers, POSITIONS, type Position } from "@/lib/pdf/stamp";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";

type PagesMode = "all" | "skipFirst" | "custom";
type Size = 10 | 12 | 16;

export function PageNumbersTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [position, setPosition] = useState<Position>("bottom-center");
  const [format, setFormat] = useState("{n}");
  const [start, setStart] = useState(1);
  const [pagesMode, setPagesMode] = useState<PagesMode>("all");
  const [ranges, setRanges] = useState("");
  const [size, setSize] = useState<Size>(12);
  const [busy, setBusy] = useState(false);

  // Шаблон с подстановками {n} и {total} — поэтому передаём их «как есть»
  const formats = ["{n}", "{n} / {total}", t("pageNumbers.formatPageOf", { n: "{n}", total: "{total}" })];

  const pages = useMemo((): { list: number[]; error?: string } => {
    if (!file) return { list: [] };
    const n = file.pageCount;
    if (pagesMode === "all") return { list: [...Array(n).keys()] };
    if (pagesMode === "skipFirst") return { list: [...Array(n).keys()].slice(1) };
    const parsed = parsePageRanges(ranges, n);
    if (!parsed.ok) {
      const error =
        parsed.error === "empty"
          ? t("split.errEmpty")
          : parsed.error === "invalid"
            ? t("split.errInvalid", { token: parsed.token ?? "" })
            : t("split.errOutOfRange", { token: parsed.token ?? "", total: n });
      return { list: [], error };
    }
    return { list: [...new Set(parsed.groups.flat())].sort((a, b) => a - b) };
  }, [file, pagesMode, ranges, t]);

  const sample = (fmt: string, k = 0) =>
    fmt.replaceAll("{n}", String(start + k)).replaceAll("{total}", String(start + Math.max(pages.list.length, 1) - 1));

  // Как в Word: без номера на первой странице вторая получает «2»
  const changePagesMode = (mode: PagesMode) => {
    if (mode === "skipFirst" && start === 1) setStart(2);
    if (mode !== "skipFirst" && pagesMode === "skipFirst" && start === 2) setStart(1);
    setPagesMode(mode);
  };

  const run = async () => {
    if (!file || !pages.list.length) return;
    setBusy(true);
    try {
      const out = await addPageNumbers(file.bytes, { position, format, start, pages: pages.list, fontSize: size });
      downloadBlob(out, `${baseName(file.name)}_numbered.pdf`);
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!file) return <FileDropzone onFiles={(f) => add(f.slice(0, 1))} disabled={loading} />;

  const previewPage = pages.list[0] ?? 0;

  return (
    <div className="space-y-6">
      <FileCard file={file} onClose={clear} />

      <div className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label>{t("pageNumbers.format")}</Label>
            <Choice value={format} onChange={setFormat} options={formats.map((f) => ({ value: f, label: sample(f) }))} />
          </div>

          <div className="space-y-2">
            <Label>{t("pageNumbers.pages")}</Label>
            <Choice
              value={pagesMode}
              onChange={changePagesMode}
              options={[
                { value: "all", label: t("pageNumbers.pagesAll") },
                { value: "skipFirst", label: t("pageNumbers.pagesSkipFirst") },
                { value: "custom", label: t("pageNumbers.pagesCustom") },
              ]}
            />
            {pagesMode === "custom" && (
              <div className="max-w-md space-y-1.5 pt-1">
                <Input
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                  placeholder={t("split.rangesPlaceholder")}
                  aria-label={t("pageNumbers.pagesCustom")}
                  aria-invalid={Boolean(ranges && pages.error)}
                  autoFocus
                />
                <p className={cn("text-sm", ranges && pages.error ? "text-destructive" : "text-muted-foreground")}>
                  {ranges && pages.error ? pages.error : t("split.rangesHelp")}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="space-y-2">
              <Label htmlFor="start">{t("pageNumbers.start")}</Label>
              <Input
                id="start"
                type="number"
                min={0}
                value={start}
                onChange={(e) => setStart(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                className="w-28"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("pageNumbers.size")}</Label>
              <Choice
                value={size}
                onChange={setSize}
                options={[
                  { value: 10, label: t("pageNumbers.sizeSmall") },
                  { value: 12, label: t("pageNumbers.sizeMedium") },
                  { value: 16, label: t("pageNumbers.sizeLarge") },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("pageNumbers.position")}</Label>
          <PdfThumb doc={file.doc} pageIndex={previewPage} width={208} className="w-52">
            <div role="radiogroup" aria-label={t("pageNumbers.position")} className="absolute inset-0 grid grid-rows-2">
              {[POSITIONS.slice(0, 3), POSITIONS.slice(3)].map((row, r) => (
                <div key={r} className={cn("flex justify-between px-1", r === 0 ? "items-start pt-1" : "items-end pb-1")}>
                  {row.map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={position === p}
                      aria-label={t(`pageNumbers.positions.${p}`)}
                      onClick={() => setPosition(p)}
                      className={cn(
                        "transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
                        position === p
                          ? "rounded-md bg-primary px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary-foreground shadow-sm"
                          : "size-4 rounded-full border-2 border-primary bg-white hover:bg-primary/30",
                      )}
                    >
                      {/* В выбранном месте — сам номер, как он встанет на страницу */}
                      {position === p && sample(format)}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </PdfThumb>
        </div>
      </div>

      <ActionBar action={t("pageNumbers.action")} onAction={run} busy={busy} disabled={!pages.list.length}>
        {pages.list.length > 0 && t("common.pages", { count: pages.list.length })}
      </ActionBar>
    </div>
  );
}
