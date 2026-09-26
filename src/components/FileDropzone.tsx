"use client";

import { useDropzone, type Accept } from "react-dropzone";
import { useTranslations } from "next-intl";
import { FileUp, ImageUp, Plus } from "lucide-react";
import { IMAGE_ACCEPT } from "@/lib/images";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const PDF_ACCEPT: Accept = { "application/pdf": [".pdf"] };

interface Props {
  kind?: "pdf" | "images";
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  /** Компактная кнопка «Добавить ещё» вместо большой зоны */
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FileDropzone({ kind = "pdf", multiple = false, onFiles, compact, disabled, className }: Props) {
  const t = useTranslations("common");
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: kind === "pdf" ? PDF_ACCEPT : IMAGE_ACCEPT,
    multiple,
    disabled,
    noClick: compact,
    onDrop: (accepted) => accepted.length && onFiles(accepted),
  });
  const Icon = kind === "pdf" ? FileUp : ImageUp;

  if (compact) {
    return (
      <div {...getRootProps({ className: cn("inline-flex", className) })}>
        <input {...getInputProps()} />
        <Button type="button" variant="outline" onClick={open} disabled={disabled}>
          <Plus />
          {t("addMore")}
        </Button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps({
        className: cn(
          "group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-colors",
          "hover:border-primary/60 hover:bg-primary/5",
          isDragActive && "border-primary bg-primary/10",
          disabled && "pointer-events-none opacity-60",
          className,
        ),
      })}
    >
      <input {...getInputProps()} />
      <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary transition-transform group-hover:scale-105">
        <Icon className="size-8" />
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold">
          {isDragActive ? t("dropActive") : multiple ? t("dropHereMany") : t("dropHere")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t("orClick")} · {kind === "pdf" ? t("acceptPdf") : t("acceptImages")}
        </p>
      </div>
      <Button type="button" size="lg" className="pointer-events-none">
        {multiple ? t("chooseFiles") : t("chooseFile")}
      </Button>
    </div>
  );
}
