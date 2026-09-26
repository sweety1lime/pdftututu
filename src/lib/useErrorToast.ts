"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PdfError } from "./pdf/errors";

/** Показывает понятную ошибку. Отмену ввода пароля молча игнорирует. */
export function useErrorToast() {
  const t = useTranslations("errors");
  return useCallback(
    (e: unknown) => {
      if (e instanceof PdfError) {
        if (e.code === "cancelled") return;
        toast.error(t(e.code, { name: e.fileName }));
        return;
      }
      if (e instanceof DOMException && e.name === "AbortError") return;
      console.error(e);
      const message = e instanceof Error ? e.message : String(e);
      toast.error(t("generic", { message }));
    },
    [t],
  );
}
