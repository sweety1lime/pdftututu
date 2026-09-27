"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleCheck, Download, Info } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { Button } from "@/components/ui/button";
import { baseName, downloadBlob } from "@/lib/download";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";

/**
 * Снятие пароля: сама расшифровка происходит при открытии файла
 * (lib/pdf/load.ts спросит пароль), здесь остаётся только скачать результат.
 */
export function UnlockTool() {
  const t = useTranslations();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [downloaded, setDownloaded] = useState(false);

  if (!file) {
    return (
      <FileDropzone
        onFiles={async (f) => {
          setDownloaded(false);
          await add(f.slice(0, 1));
        }}
        disabled={loading}
      />
    );
  }

  const save = () => {
    downloadBlob(file.bytes, `${baseName(file.name)}_unlocked.pdf`);
    setDownloaded(true);
    toast.success(t("unlock.unlocked"));
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <FileCard file={file} onClose={clear} />
      {file.wasEncrypted ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center">
          <CircleCheck className="size-10 text-success" />
          <p className="font-medium">{t("unlock.unlocked")}</p>
          <Button size="lg" onClick={save}>
            <Download />
            {downloaded ? t("common.download") : t("unlock.action")}
          </Button>
        </div>
      ) : (
        <p className="flex items-center justify-center gap-2 rounded-xl border bg-card p-6 text-muted-foreground">
          <Info className="size-5" />
          {t("unlock.notEncrypted")}
        </p>
      )}
    </div>
  );
}
