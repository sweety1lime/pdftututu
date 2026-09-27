"use client";

import { create } from "zustand";
import { temporal } from "zundo";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { PdfSource } from "@/lib/pdf/read";
import { closePdfjs } from "@/lib/pdf/pdfjs";
import { newId } from "@/lib/id";
import type { Asset, EditorObject, FormValue, FormWidget, PageInfo, StyleDefaults, Tool } from "./types";

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 5;

const DEFAULTS: StyleDefaults = {
  text: { family: "sans", bold: false, italic: false, fontSize: 14, color: "#111111", lineHeight: 1.2, align: "left" },
  shape: { fill: null, stroke: "#e11d48", strokeWidth: 2, opacity: 1 },
  line: { stroke: "#e11d48", strokeWidth: 2, opacity: 1 },
  pen: { stroke: "#1d4ed8", strokeWidth: 2, marker: false },
  highlight: { fill: "#fde047" },
};

interface History {
  objects: EditorObject[];
  formValues: Record<string, FormValue>;
}

export interface EditorState extends History {
  source: PdfSource | null;
  /** Документ pdf.js для отрисовки (не входит в историю) */
  pdf: PDFDocumentProxy | null;
  pages: PageInfo[];
  widgets: FormWidget[];
  assets: Record<string, Asset>;
  selectedIds: string[];
  tool: Tool;
  zoom: number;
  currentPage: number;
  editingTextId: string | null;
  defaults: StyleDefaults;
  clipboard: EditorObject[];

  load: (data: {
    source: PdfSource;
    pdf: PDFDocumentProxy;
    pages: PageInfo[];
    widgets: FormWidget[];
    formValues?: Record<string, FormValue>;
    objects?: EditorObject[];
    assets?: Record<string, Asset>;
  }) => void;
  close: () => void;
  setTool: (tool: Tool) => void;
  setZoom: (zoom: number) => void;
  setCurrentPage: (page: number) => void;
  select: (ids: string[], additive?: boolean) => void;
  addObject: (obj: EditorObject, opts?: { select?: boolean }) => void;
  addObjects: (objs: EditorObject[], opts?: { select?: boolean }) => void;
  updateObject: (id: string, patch: Partial<EditorObject>) => void;
  updateObjects: (ids: string[], patch: (o: EditorObject) => Partial<EditorObject>) => void;
  removeObjects: (ids: string[]) => void;
  duplicate: (ids: string[]) => void;
  moveZ: (ids: string[], dir: 1 | -1) => void;
  copy: (ids: string[]) => void;
  paste: () => void;
  setFormValue: (name: string, value: FormValue) => void;
  addAsset: (asset: Asset) => void;
  setEditingText: (id: string | null) => void;
  setDefaults: <K extends keyof StyleDefaults>(key: K, patch: Partial<StyleDefaults[K]>) => void;
}

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

export const useEditor = create<EditorState>()(
  temporal(
    (set, get) => ({
      source: null,
      pdf: null,
      pages: [],
      widgets: [],
      objects: [],
      formValues: {},
      assets: {},
      selectedIds: [],
      tool: "select",
      zoom: 1,
      currentPage: 0,
      editingTextId: null,
      defaults: DEFAULTS,
      clipboard: [],

      load: ({ source, pdf, pages, widgets, formValues = {}, objects = [], assets = {} }) => {
        closePdfjs(get().pdf);
        set({
          source,
          pdf,
          pages,
          widgets,
          formValues,
          objects,
          assets,
          selectedIds: [],
          editingTextId: null,
          currentPage: 0,
        });
        // История начинается с открытого документа
        useEditor.temporal.getState().clear();
      },

      close: () => {
        closePdfjs(get().pdf);
        set({
          source: null,
          pdf: null,
          pages: [],
          widgets: [],
          objects: [],
          formValues: {},
          assets: {},
          selectedIds: [],
          editingTextId: null,
        });
        useEditor.temporal.getState().clear();
      },

      setTool: (tool) => set({ tool, editingTextId: null, selectedIds: tool === "select" ? get().selectedIds : [] }),
      setZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
      setCurrentPage: (currentPage) => set({ currentPage }),

      select: (ids, additive) =>
        set((s) => {
          if (!additive) return { selectedIds: ids };
          const next = new Set(s.selectedIds);
          for (const id of ids) {
            if (next.has(id)) next.delete(id);
            else next.add(id);
          }
          return { selectedIds: [...next] };
        }),

      addObject: (obj, opts) => get().addObjects([obj], opts),
      addObjects: (objs, { select = true } = {}) =>
        set((s) => ({
          objects: [...s.objects, ...objs],
          selectedIds: select ? objs.map((o) => o.id) : s.selectedIds,
        })),

      updateObject: (id, patch) =>
        set((s) => ({
          objects: s.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as EditorObject) : o)),
        })),

      updateObjects: (ids, patch) => {
        const idSet = new Set(ids);
        set((s) => ({
          objects: s.objects.map((o) => (idSet.has(o.id) ? ({ ...o, ...patch(o) } as EditorObject) : o)),
        }));
      },

      removeObjects: (ids) => {
        if (!ids.length) return;
        const idSet = new Set(ids);
        set((s) => ({
          objects: s.objects.filter((o) => !idSet.has(o.id)),
          selectedIds: s.selectedIds.filter((id) => !idSet.has(id)),
          editingTextId: s.editingTextId && idSet.has(s.editingTextId) ? null : s.editingTextId,
        }));
      },

      duplicate: (ids) => {
        const idSet = new Set(ids);
        const copies = get()
          .objects.filter((o) => idSet.has(o.id))
          .map((o) => ({ ...o, id: newId("obj"), x: o.x + 10, y: o.y + 10 }));
        if (copies.length) get().addObjects(copies);
      },

      moveZ: (ids, dir) =>
        set((s) => {
          const arr = [...s.objects];
          const idSet = new Set(ids);
          const order = dir === 1 ? [...arr.keys()].reverse() : [...arr.keys()];
          for (const i of order) {
            const j = i + dir;
            if (!idSet.has(arr[i].id) || j < 0 || j >= arr.length || idSet.has(arr[j].id)) continue;
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return { objects: arr };
        }),

      copy: (ids) => {
        const idSet = new Set(ids);
        set({ clipboard: get().objects.filter((o) => idSet.has(o.id)) });
      },

      paste: () => {
        const { clipboard, currentPage } = get();
        if (!clipboard.length) return;
        const samePage = clipboard.every((o) => o.page === currentPage);
        const copies = clipboard.map((o) => ({
          ...o,
          id: newId("obj"),
          page: currentPage,
          x: o.x + (samePage ? 10 : 0),
          y: o.y + (samePage ? 10 : 0),
        }));
        get().addObjects(copies);
        // Следующая вставка сдвинется ещё раз
        set({ clipboard: copies });
      },

      setFormValue: (name, value) => set((s) => ({ formValues: { ...s.formValues, [name]: value } })),
      addAsset: (asset) => set((s) => ({ assets: { ...s.assets, [asset.id]: asset } })),
      setEditingText: (editingTextId) => set({ editingTextId }),
      setDefaults: (key, patch) => set((s) => ({ defaults: { ...s.defaults, [key]: { ...s.defaults[key], ...patch } } })),
    }),
    {
      limit: 200,
      // В историю попадают только изменения документа, не выделение/зум
      partialize: (s): History => ({ objects: s.objects, formValues: s.formValues }),
      equality: (a, b) => a.objects === b.objects && a.formValues === b.formValues,
    },
  ),
);

export const undo = () => useEditor.temporal.getState().undo();
export const redo = () => useEditor.temporal.getState().redo();

/**
 * «Жест» — серия непрерывных изменений (перетаскивание ползунка, выбор цвета),
 * которая должна стать ОДНИМ шагом истории.
 */
let gestureSnapshot: History | null = null;

export function beginGesture() {
  if (gestureSnapshot) return;
  const s = useEditor.getState();
  gestureSnapshot = { objects: s.objects, formValues: s.formValues };
  useEditor.temporal.getState().pause();
}

export function endGesture() {
  if (!gestureSnapshot) return;
  const snapshot = gestureSnapshot;
  gestureSnapshot = null;
  const t = useEditor.temporal;
  t.getState().resume();
  const s = useEditor.getState();
  if (!sameArray(s.objects, snapshot.objects) || s.formValues !== snapshot.formValues) {
    t.setState((ts) => ({ pastStates: [...ts.pastStates, snapshot].slice(-200), futureStates: [] }));
  }
}

const sameArray = <T,>(a: T[], b: T[]) => a === b || (a.length === b.length && a.every((x, i) => x === b[i]));

/** Выполнить несколько изменений как один шаг истории. */
export function asOneStep(fn: () => void) {
  beginGesture();
  try {
    fn();
  } finally {
    endGesture();
  }
}

export function selectedObjects(s: EditorState): EditorObject[] {
  const ids = new Set(s.selectedIds);
  return s.objects.filter((o) => ids.has(o.id));
}
