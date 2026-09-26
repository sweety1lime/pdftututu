"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { usePasswordPrompt } from "@/lib/passwordPrompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Глобальный диалог пароля: его вызывает lib/pdf/load.ts через askPassword(). */
export function PasswordDialog() {
  const { open, fileName, wrong, attempt, answer } = usePasswordPrompt();
  return (
    <Dialog open={open} onOpenChange={(o) => !o && answer(null)}>
      <DialogContent className="sm:max-w-md">
        {/* key — новая форма (пустое поле) на каждый запрос пароля */}
        <PasswordForm key={attempt} fileName={fileName} wrong={wrong} onAnswer={answer} />
      </DialogContent>
    </Dialog>
  );
}

function PasswordForm({
  fileName,
  wrong,
  onAnswer,
}: {
  fileName: string;
  wrong: boolean;
  onAnswer: (password: string | null) => void;
}) {
  const t = useTranslations();
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onAnswer(value);
      }}
    >
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <KeyRound className="size-5 text-primary" />
          {t("password.title")}
        </DialogTitle>
        <DialogDescription>{t("password.description", { name: fileName })}</DialogDescription>
      </DialogHeader>
      <div className="relative">
        <Input
          autoFocus
          type={show ? "text" : "password"}
          placeholder={t("password.placeholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-invalid={wrong}
          className="pr-10"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
          aria-label={t("password.show")}
        >
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {wrong && <p className="-mt-2 text-sm text-destructive">{t("password.wrong")}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onAnswer(null)}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={!value}>
          {t("password.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
