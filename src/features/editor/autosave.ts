"use client";

import { useEffect } from "react";
import { del, get, set } from "idb-keyval";
import { useEditor } from "./store";
import type { Asset, EditorObject, FormValue } from "./types";

/**
 * Черновик в IndexedDB: исходный PDF + правки. Если вкладку случайно закрыли,
 * при следующем открытии редактор предложит восстановить работу.
 */
const BYTES_KEY = "pdftutut:draft-bytes";
const STATE_KEY = "pdftutut:draft-state";

export interface DraftState {
  sourceId: string;
  name: string;
  savedAt: number;
  objects: EditorObject[];
  formValues: Record<string, FormValue>;
  assets: Record<string, Asset>;
}

export interface Draft extends DraftState {
  bytes: Uint8Array;
}

export async function loadDraft(): Promise<Draft | null> {
  try {
    const [state, bytes] = await Promise.all([get<DraftState>(STATE_KEY), get<Uint8Array>(BYTES_KEY)]);
    if (!state || !bytes || (!state.objects.length && !Object.keys(state.formValues).length)) return null;
    return { ...state, bytes };
  } catch {
    return null;
  }
}

export async function clearDraft() {
  try {
    await Promise.all([del(STATE_KEY), del(BYTES_KEY)]);
  } catch {
    /* IndexedDB недоступен (приватный режим) — не страшно */
  }
}

/** Подписка: сохраняем с задержкой в 1 секунду после последнего изменения. */
export function useAutosave() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let savedSourceId: string | null = null;

    const unsub = useEditor.subscribe((s, prev) => {
      if (!s.source) return;
      if (s.objects === prev.objects && s.formValues === prev.formValues && s.source === prev.source) return;
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const st = useEditor.getState();
        if (!st.source) return;
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
