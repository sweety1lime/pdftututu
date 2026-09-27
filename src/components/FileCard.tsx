"use client";

import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfThumb } from "@/components/PdfThumb";
import { formatBytes } from "@/lib/download";
import type { LoadedPdf } from "@/lib/pdf/useLoadedPdfs";

/** Строка открытого файла: миниатюра, имя, «N страниц · размер», «Начать заново». */
export function FileCard({ file, onClose }: { file: LoadedPdf; onClose: () => void }) {
  const t = useTranslations("common");
  const locale = useLocale();
  return (
    <div className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 rounded-xl border bg-card py-3 pr-1.5 pl-3 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:gap-x-4 sm:py-3.5 sm:pr-3.5 sm:pl-4">
      <PdfThumb doc={file.doc} pageIndex={0} width={44} tight className="w-10 sm:w-11" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-[15px] font-semibold" title={file.name}>
          {file.name}
        </p>
        <p className="font-mono text-xs text-muted-foreground">
          {t("pages", { count: file.pageCount })} · {formatBytes(file.size, locale)}
        </p>
      </div>
      <Button
        variant="ghost"
        onClick={onClose}
        aria-label={t("startOver")}
        className="size-11 rounded-[10px] text-muted-foreground sm:h-9 sm:w-auto sm:px-3"
      >
        <X />
        <span className="hidden sm:inline">{t("startOver")}</span>
      </Button>
    </div>
  );
}
