"use client";

import { useEffect } from "react";
import { set } from "idb-keyval";
import type { PdfSource } from "@/lib/pdf/load";
import { useEditor } from "./store";
import { BYTES_KEY, STATE_KEY, type DraftState } from "./draftStorage";

/**
 * Черновик в IndexedDB: исходный PDF + правки. Если вкладку случайно закрыли,
 * при следующем открытии редактор предложит восстановить работу.
 */
export { clearDraft, loadDraft, type Draft, type DraftState } from "./draftStorage";

/**
 * Черновик возможен, только если файл был без пароля: байты зашифрованного PDF
 * хранятся уже расшифрованными и остались бы в браузере без защиты.
 */
const canSaveDraft = (source: PdfSource | null): source is PdfSource => !!source && !source.wasEncrypted;

/** Подписка: сохраняем с задержкой в 1 секунду после последнего изменения. */
export function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let savedSourceId: string | null = null;

    const unsub = useEditor.subscribe((s, prev) => {
      if (!canSaveDraft(s.source)) return;
      if (s.objects === prev.objects && s.formValues === prev.formValues && s.source === prev.source) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const st = useEditor.getState();
        // Пока ждали, могли открыть другой файл
        if (!canSaveDraft(st.source)) return;
        try {
          if (savedSourceId !== st.source.id) {
            await set(BYTES_KEY, st.source.bytes);
            savedSourceId = st.source.id;
          }
          // Сохраняем только картинки, которые реально используются
          const used = new Set(st.objects.flatMap((o) => (o.type === "image" ? [o.assetId] : [])));
          const assets = Object.fromEntries(Object.entries(st.assets).filter(([id]) => used.has(id)));
          await set(STATE_KEY, {
            sourceId: st.source.id,
            name: st.source.name,
            savedAt: Date.now(),
            objects: st.objects,
            formValues: st.formValues,
            assets,
          } satisfies DraftState);
        } catch {
          /* нет места или IndexedDB запрещён */
        }
      }, 1000);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, []);
}
