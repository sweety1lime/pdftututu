"use client";

import { useDropzone, type Accept } from "react-dropzone";
import { useTranslations } from "next-intl";
import { FileUp, Image as ImageIcon } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { IMAGE_ACCEPT } from "@/lib/images";
import { setPendingFiles } from "@/lib/pendingFiles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PrivacyNote } from "@/components/ToolWorkspace";
import { useOpenFile } from "@/components/HomeShell";

const ACCEPT: Accept = { "application/pdf": [".pdf"], ...IMAGE_ACCEPT };
const isPdf = (f: File) => f.type === "application/pdf" || /\.pdf$/i.test(f.name);

/**
 * Первый экран главной: сначала файл, потом выбор действия.
 * Один PDF — экран «Что сделать с файлом?», несколько — сразу в «Объединить»,
 * картинки — в «Картинки в PDF».
 */
export function HomeDropzone() {
  const t = useTranslations();
  const router = useRouter();
  const openFile = useOpenFile();

  const go = (href: string, files: File[]) => {
    setPendingFiles(files);
    router.push(href);
  };

  const onFiles = (files: File[]) => {
    const pdfs = files.filter(isPdf);
    if (pdfs.length > 1) go("/merge", pdfs);
    else if (pdfs.length === 1) openFile(pdfs[0]);
    else if (files.length) go("/images-to-pdf", files);
  };

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: ACCEPT,
    multiple: true,
    // Выбор файла — кнопкой; клик по пустому месту зоны ничего не делает
    noClick: true,
    noKeyboard: true,
    onDrop: (accepted) => accepted.length && onFiles(accepted),
  });

  // На телефоне заголовок стоит над пунктирной зоной, на широком экране — внутри неё:
  // внутренний блок там «растворяется» (display: contents), и зоной становится корень
  return (
    <div
      {...getRootProps({
        className: cn(
          "group flex flex-col gap-4 lg:h-full lg:items-center lg:justify-center lg:gap-6 lg:rounded-2xl lg:border-[1.5px] lg:border-dashed lg:border-muted-foreground/45 lg:bg-panel lg:p-10 lg:text-center lg:transition-colors",
          isDragActive && "lg:border-primary lg:bg-primary/5",
        ),
      })}
    >
      <input {...getInputProps()} />
      <h1 className="mt-1 text-[15px] leading-snug font-medium text-secondary-foreground lg:mt-0 lg:font-mono lg:text-[13px] lg:tracking-[0.08em] lg:text-muted-foreground lg:uppercase">
        {t("home.title")}
      </h1>
      <div
        className={cn(
          "flex flex-col items-center gap-4.5 rounded-2xl border-[1.5px] border-dashed border-muted-foreground/45 bg-panel px-5 pt-7 pb-6 text-center transition-colors lg:contents",
          isDragActive && "border-primary bg-primary/5",
        )}
      >
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/12 text-primary-ink lg:size-19 lg:rounded-[18px]">
          <FileUp className="size-8 stroke-[1.75] lg:size-9" />
        </span>
        <div className="flex flex-col gap-2 lg:gap-2.5">
          <p className="text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] lg:text-[52px] lg:leading-[1.05] lg:tracking-[-0.025em]">
            {isDragActive ? (
              t("common.dropActive")
            ) : (
              <>
                <span className="pointer-coarse:hidden">{t("home.dropTitle")}</span>
                <span className="hidden pointer-coarse:inline">{t("home.dropTitleTouch")}</span>
              </>
            )}
          </p>
          <p className="text-[15px] leading-[1.45] text-secondary-foreground lg:text-[17px]">
            {t("home.dropSubtitle")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2.5 lg:w-auto lg:flex-row lg:gap-3">
          <Button size="xl" onClick={open} className="w-full lg:h-12 lg:w-auto lg:rounded-lg">
            {t("common.chooseFile")}
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 w-full rounded-[10px] text-[15px] lg:w-auto lg:rounded-lg lg:px-5 lg:text-base"
          >
            <Link href="/images-to-pdf">
              <ImageIcon />
              {t("home.imagesInstead")}
            </Link>
          </Button>
        </div>
        <PrivacyNote className="text-left lg:items-center lg:text-[13px]" />
      </div>
    </div>
  );
}
