"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronDown, Info } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { DownloadsAs, MainAction, Summary, ToolWorkspace } from "@/components/ToolWorkspace";
import { Input } from "@/components/ui/input";
import { Checkbox, Label } from "@/components/ui/misc";
import { baseName, downloadBlob } from "@/lib/download";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";

export function ProtectTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [owner, setOwner] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [perms, setPerms] = useState({ allowPrint: true, allowCopy: true, allowModify: true, allowAnnotate: true });
  const [busy, setBusy] = useState(false);

  const mismatch = repeat.length > 0 && password !== repeat;
  const valid = password.length > 0 && password === repeat;

  const outName = file ? `${baseName(file.name)}_protected.pdf` : "";

  const run = async () => {
    if (!file || !valid) return;
    setBusy(true);
    try {
      const { protectPdf } = await import("@/lib/pdf/security");
      const out = await protectPdf(file.bytes, { userPassword: password, ownerPassword: owner || undefined, ...perms });
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

  const permItems = [
    ["allowPrint", t("protect.allowPrint")],
    ["allowCopy", t("protect.allowCopy")],
    ["allowModify", t("protect.allowModify")],
    ["allowAnnotate", t("protect.allowAnnotate")],
  ] as const;

  return (
    <ToolWorkspace
      summary={
        <Summary
          actions={
            <MainAction onClick={run} busy={busy} disabled={!valid}>
              {t("protect.action")}
            </MainAction>
          }
        >
          <DownloadsAs name={outName} />
        </Summary>
      }
    >
      <div className="flex max-w-xl flex-col gap-6">
        <FileCard file={file} onClose={clear} />
        <form
          className="space-y-4 rounded-xl border bg-card p-5"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="pw">{t("protect.userPassword")}</Label>
            <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pw2">{t("protect.repeat")}</Label>
            <Input id="pw2" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} aria-invalid={mismatch} />
            {mismatch && <p className="text-sm text-destructive">{t("protect.mismatch")}</p>}
          </div>

          <button
            type="button"
            onClick={() => setAdvanced((a) => !a)}
            className="flex items-center gap-1 text-sm font-medium text-primary-ink"
          >
            <ChevronDown className={cn("size-4 transition-transform", advanced && "rotate-180")} />
            {t("protect.advanced")}
          </button>
          {advanced && (
            <div className="space-y-4 border-l-2 pl-4">
              <div className="space-y-2">
                <Label htmlFor="owner">{t("protect.ownerPassword")}</Label>
                <Input id="owner" type="password" autoComplete="new-password" value={owner} onChange={(e) => setOwner(e.target.value)} />
                <p className="text-xs text-muted-foreground">{t("protect.ownerHint")}</p>
              </div>
              {permItems.map(([key, label]) => (
                <Label key={key} className="font-normal">
                  <Checkbox checked={perms[key]} onCheckedChange={(v) => setPerms((p) => ({ ...p, [key]: v === true }))} />
                  {label}
                </Label>
              ))}
            </div>
          )}
          <p className="flex gap-2 text-xs text-muted-foreground">
            <Info className="size-4 shrink-0" />
            {t("protect.note")}
          </p>
          <button type="submit" hidden />
        </form>

      </div>
    </ToolWorkspace>
  );
}
