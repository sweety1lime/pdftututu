"use client";

import { useHotkeys } from "react-hotkeys-hook";
import { asOneStep, redo, undo, useEditor } from "./store";
import type { Tool } from "./types";

const TOOL_BY_KEY: Record<string, Tool> = {
  v: "select",
  t: "text",
  e: "editText",
  r: "rect",
  o: "ellipse",
  l: "line",
  a: "arrow",
  h: "highlight",
  w: "whiteout",
  p: "pen",
};

/** Все горячие клавиши редактора. В полях ввода не срабатывают (кроме явно указанных). */
export function useEditorHotkeys(actions: { pickImage: () => void; sign: () => void }) {
  const opts = { preventDefault: true };

  useHotkeys("mod+z", () => undo(), opts);
  useHotkeys("mod+y, mod+shift+z", () => redo(), opts);

  useHotkeys(
    "delete, backspace",
    () => {
      const s = useEditor.getState();
      s.removeObjects(s.selectedIds);
    },
    opts,
  );

  useHotkeys("mod+d", () => useEditor.getState().duplicate(useEditor.getState().selectedIds), opts);
  useHotkeys("mod+c", () => useEditor.getState().copy(useEditor.getState().selectedIds));
  useHotkeys("mod+a", () => {
    const s = useEditor.getState();
    s.setTool("select");
    s.select(s.objects.filter((o) => o.page === s.currentPage).map((o) => o.id));
  }, opts);

  useHotkeys("escape", () => {
    const s = useEditor.getState();
    if (s.selectedIds.length) s.select([]);
    else s.setTool("select");
  });

  useHotkeys(
    "enter",
    () => {
      const s = useEditor.getState();
      const only = s.selectedIds.length === 1 ? s.objects.find((o) => o.id === s.selectedIds[0]) : undefined;
      if (only?.type === "text") s.setEditingText(only.id);
    },
    opts,
  );

  const nudge = (dx: number, dy: number) => () => {
    const s = useEditor.getState();
    if (!s.selectedIds.length) return;
    asOneStep(() => s.updateObjects(s.selectedIds, (o) => ({ x: o.x + dx, y: o.y + dy })));
  };
  useHotkeys("left", nudge(-1, 0), opts);
  useHotkeys("right", nudge(1, 0), opts);
  useHotkeys("up", nudge(0, -1), opts);
  useHotkeys("down", nudge(0, 1), opts);
  useHotkeys("shift+left", nudge(-10, 0), opts);
  useHotkeys("shift+right", nudge(10, 0), opts);
  useHotkeys("shift+up", nudge(0, -10), opts);
  useHotkeys("shift+down", nudge(0, 10), opts);

  useHotkeys("equal, shift+equal, mod+equal", () => useEditor.getState().setZoom(useEditor.getState().zoom * 1.2), opts);
  useHotkeys("minus, mod+minus", () => useEditor.getState().setZoom(useEditor.getState().zoom / 1.2), opts);

  // По физической клавише (e.code), чтобы работало и на русской раскладке
  useHotkeys(Object.keys(TOOL_BY_KEY).join(", "), (e) => {
    const tool = TOOL_BY_KEY[e.code.replace(/^Key/, "").toLowerCase()];
    if (tool) useEditor.getState().setTool(tool);
  });
  useHotkeys("i", actions.pickImage);
  useHotkeys("s", actions.sign);
}
