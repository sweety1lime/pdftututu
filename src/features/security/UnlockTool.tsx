"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CircleCheck, Download, Info } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { DownloadsAs, MainAction, Summary, ToolWorkspace } from "@/components/ToolWorkspace";
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
      <ToolWorkspace>
        <FileDropzone
          onFiles={async (f) => {
            setDownloaded(false);
            await add(f.slice(0, 1));
          }}
          disabled={loading}
        />
      </ToolWorkspace>
    );
  }

  const outName = `${baseName(file.name)}_unlocked.pdf`;
  const save = () => {
    downloadBlob(file.bytes, outName);
    setDownloaded(true);
    toast.success(t("unlock.unlocked"));
  };

  return (
    <ToolWorkspace
      summary={
        file.wasEncrypted && (
          <Summary
            actions={
              <MainAction onClick={save}>
                <Download />
                {downloaded ? t("common.download") : t("unlock.action")}
              </MainAction>
            }
          >
            <DownloadsAs name={outName} />
          </Summary>
        )
      }
    >
      <div className="flex flex-col gap-6">
        <FileCard file={file} onClose={clear} />
        {file.wasEncrypted ? (
          <p className="flex items-center gap-3 rounded-xl border bg-card p-5 font-medium">
            <CircleCheck className="size-6 shrink-0 text-success" />
            {t("unlock.unlocked")}
          </p>
        ) : (
          <p className="flex items-center gap-3 rounded-xl border bg-card p-5 text-muted-foreground">
            <Info className="size-5 shrink-0" />
            {t("unlock.notEncrypted")}
          </p>
        )}
      </div>
    </ToolWorkspace>
  );
}
