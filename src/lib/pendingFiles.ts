import { useEffect, useRef } from "react";

/**
 * Файлы, брошенные на главную, по дороге в инструмент. Живут только в памяти вкладки:
 * при переходе без перезагрузки страницы инструмент забирает их при появлении.
 */
let pendingFiles: File[] = [];
let pendingDraft = false;

export function setPendingFiles(files: File[]) {
  pendingFiles = files;
}

export function takePendingFiles(): File[] {
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
export function usePendingFiles(onFiles: (files: File[]) => void, enabled = true) {
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
