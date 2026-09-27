import { useEffect, useRef } from "react";
import type { PdfSource } from "@/lib/pdf/load";

/** PDF, уже прочитанный и при необходимости расшифрованный: второй раз пароль не спросят. */
export type ReadPdf = PdfSource & { size: number };

/** Файл с главной: как есть или уже открытый на экране «Что сделать с файлом?». */
export type PendingItem = File | ReadPdf;

/**
 * Файлы, брошенные на главную, по дороге в инструмент. Живут только в памяти вкладки:
 * при переходе без перезагрузки страницы инструмент забирает их при появлении.
 */
let pendingFiles: PendingItem[] = [];
let pendingDraft = false;

export function setPendingFiles(files: PendingItem[]) {
  pendingFiles = files;
}

export function takePendingFiles(): PendingItem[] {
  const files = pendingFiles;
  pendingFiles = [];
  return files;
}

/** «Восстановить» на главной: редактор сразу откроет черновик, без второго вопроса. */
export function requestDraftRestore() {
  pendingDraft = true;
}

export function takeDraftRestore(): boolean {
  const restore = pendingDraft;
  pendingDraft = false;
  return restore;
}

/** Один раз при появлении инструмента отдать ему отложенные файлы, если они есть. */
export function usePendingFiles(onFiles: (files: PendingItem[]) => void, enabled = true) {
  const handler = useRef(onFiles);
  useEffect(() => {
    handler.current = onFiles;
  });
  useEffect(() => {
    if (!enabled) return;
    const files = takePendingFiles();
    if (files.length) handler.current(files);
  }, [enabled]);
}
