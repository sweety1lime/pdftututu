"use client";

import { useLocale, useTranslations } from "next-intl";
import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PdfThumb } from "@/components/PdfThumb";
import { formatBytes } from "@/lib/download";
import type { LoadedPdf } from "@/lib/pdf/useLoadedPdfs";

/** Карточка открытого файла с кнопкой «закрыть». */
export function FileCard({ file, onClose }: { file: LoadedPdf; onClose: () => void }) {
  const t = useTranslations("common");
  const locale = useLocale();
  return (
    <div className="flex items-center gap-4 rounded-xl border bg-card p-3 shadow-xs">
      <div className="w-14 shrink-0">
        <PdfThumb doc={file.doc} pageIndex={0} width={56} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate font-medium" title={file.name}>
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{file.name}</span>
        </p>
        <p className="text-sm text-muted-foreground">
          {t("pages", { count: file.pageCount })} · {formatBytes(file.size, locale)}
        </p>
      </div>
      <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("startOver")}>
        <X />
      </Button>
    </div>
  );
}
