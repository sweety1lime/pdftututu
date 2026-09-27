import { del, get } from "idb-keyval";
import type { Asset, EditorObject, FormValue } from "./types";

/**
 * Где лежит черновик редактора (IndexedDB). Отдельно от autosave.ts, чтобы главная
 * могла показать «Продолжить», не загружая редактор и pdf.js.
 */
export const BYTES_KEY = "pdftutut:draft-bytes";
export const STATE_KEY = "pdftutut:draft-state";

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
