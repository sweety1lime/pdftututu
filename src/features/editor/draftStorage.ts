import { del, get, keys } from "idb-keyval";
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

export type DraftInfo = Pick<DraftState, "name" | "savedAt">;

/** Без правок восстанавливать нечего. */
const hasEdits = (s: DraftState) => s.objects.length > 0 || Object.keys(s.formValues).length > 0;

export async function loadDraft(): Promise<Draft | null> {
  try {
    const [state, bytes] = await Promise.all([get<DraftState>(STATE_KEY), get<Uint8Array>(BYTES_KEY)]);
    if (!state || !bytes || !hasEdits(state)) return null;
    return { ...state, bytes };
  } catch {
    return null;
  }
}

/**
 * Имя и время черновика — для «Продолжить» на главной. Сам PDF (бывает и в сотни
 * мегабайт) не читаем: что он есть, видно по списку ключей.
 */
export async function loadDraftInfo(): Promise<DraftInfo | null> {
  try {
    const [state, stored] = await Promise.all([get<DraftState>(STATE_KEY), keys()]);
    if (!state || !stored.includes(BYTES_KEY) || !hasEdits(state)) return null;
    return { name: state.name, savedAt: state.savedAt };
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
