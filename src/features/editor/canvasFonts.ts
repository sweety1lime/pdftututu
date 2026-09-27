"use client";

import { useEffect, useState } from "react";
import { cssFont } from "@/lib/pdf/textLayout";
import { withTextSize } from "./factory";
import { useEditor } from "./store";
import type { TextObject } from "./types";

/** Начертание для document.fonts: размер не важен. */
const faceOf = (s: Pick<TextObject, "family" | "bold" | "italic">) => cssFont({ ...s, fontSize: 16 });

/**
 * Шрифты для текста на холсте. Грузим только нужные начертания — шрифт по умолчанию и те,
 * которыми написан текст: все сразу весят 3,3 МБ. Когда начертание догрузилось, холст
 * перерисовываем, а блоки текста перемеряем: до этого их мерили запасным шрифтом.
 * @returns версия — меняется, когда загрузились новые начертания
 */
export function useCanvasFonts(): number {
  const [version, setVersion] = useState(0);
  const faces = useEditor((s) => {
    const set = new Set([faceOf(s.defaults.text)]);
    for (const o of s.objects) if (o.type === "text") set.add(faceOf(o));
    return [...set].sort().join("|");
  });

  useEffect(() => {
    const missing = faces.split("|").filter((f) => !document.fonts.check(f));
    if (!missing.length) return;
    let alive = true;
    Promise.all(missing.map((f) => document.fonts.load(f).catch(() => null))).then(() => {
      if (!alive) return;
      remeasureText();
      setVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, [faces]);

  return version;
}

/** Пересчитать размеры блоков текста — без отдельного шага в истории отмены. */
function remeasureText() {
  const s = useEditor.getState();
  const changed = new Map<string, { w: number; h: number }>();
  for (const o of s.objects) {
    if (o.type !== "text") continue;
    const { w, h } = withTextSize(o);
    if (w !== o.w || h !== o.h) changed.set(o.id, { w, h });
  }
  if (!changed.size) return;
  const history = useEditor.temporal.getState();
  history.pause();
  s.updateObjects([...changed.keys()], (o) => changed.get(o.id)!);
  history.resume();
}
