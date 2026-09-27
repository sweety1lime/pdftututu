"use client";

import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { newId } from "@/lib/pdf/load";
import { baselineOffset } from "@/lib/pdf/textLayout";
import { withTextSize } from "./factory";
import { beginGesture, useEditor } from "./store";
import { getTextLines, sampleColors, type TextLine } from "@/lib/pdf/textLines";
import type { BoxObject, TextObject } from "./types";

/**
 * Режим «Править текст»: подсвечиваем строки исходного текста.
 * Клик по строке → белая (цвета фона) заплатка + новый редактируемый текст сверху.
 */
export function EditTextLayer({
  pageIndex,
  zoom,
  canvas,
  onEmpty,
}: {
  pageIndex: number;
  zoom: number;
  canvas: () => HTMLCanvasElement | null;
  onEmpty?: () => void;
}) {
  const pdf = useEditor((s) => s.pdf);
  const [lines, setLines] = useState<TextLine[] | null>(null);
  const covers = useEditor(
    useShallow((s) => s.objects.filter((o): o is BoxObject => o.page === pageIndex && o.type === "whiteout" && Boolean(o.coversText))),
  );

  useEffect(() => {
    if (!pdf) return;
    let alive = true;
    getTextLines(pdf, pageIndex).then((l) => {
      if (!alive) return;
      setLines(l);
      if (!l.length) onEmpty?.();
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf, pageIndex]);

  if (!lines) return null;

  const isCovered = (l: TextLine) => {
    const cx = l.x + l.w / 2;
    const cy = l.y + l.h / 2;
    return covers.some((c) => cx >= c.x && cx <= c.x + c.w && cy >= c.y && cy <= c.y + c.h);
  };

  const replace = (line: TextLine) => {
    const s = useEditor.getState();
    const cv = canvas();
    const page = s.pages[pageIndex];
    const colors = cv && page ? sampleColors(cv, line, cv.width / page.width) : { background: "#ffffff", text: "#000000" };
    const pad = Math.max(1, line.fontSize * 0.08);
    const cover: BoxObject = {
      id: newId("obj"),
      type: "whiteout",
      page: pageIndex,
      x: line.x - pad,
      y: line.y - pad,
      w: line.w + pad * 2,
      h: line.h + pad * 2,
      rotation: 0,
      opacity: 1,
      fill: colors.background,
      stroke: null,
      strokeWidth: 0,
      coversText: true,
    };
    const style = {
      family: line.variant.family,
      bold: Boolean(line.variant.bold),
      italic: Boolean(line.variant.italic),
      fontSize: Math.round(line.fontSize * 10) / 10,
      lineHeight: 1.2,
      align: "left" as const,
    };
    const text: TextObject = withTextSize({
      id: newId("obj"),
      type: "text",
      page: pageIndex,
      x: line.x,
      y: line.baseline - baselineOffset(style, 0),
      w: 0,
      h: 0,
      rotation: 0,
      opacity: 1,
      text: line.text,
      color: colors.text,
      ...style,
    });
    // Заплатка + текст + редактирование = один шаг истории
    beginGesture();
    s.addObjects([cover, text], { select: false });
    // Инструмент не меняем — можно сразу править следующую строку
    useEditor.setState({ selectedIds: [text.id], editingTextId: text.id });
  };

  return (
    <div className="absolute inset-0 z-20">
      {lines.map((l) =>
        isCovered(l) ? null : (
          <button
            key={l.key}
            type="button"
            title={l.text}
            onClick={() => replace(l)}
            className="absolute cursor-text rounded-[2px] outline-1 outline-[#e3a21a]/60 outline-dashed transition-colors hover:bg-[#f2b53a]/20 hover:outline-[#e3a21a] hover:outline-solid"
            style={{ left: l.x * zoom - 1, top: l.y * zoom - 1, width: l.w * zoom + 2, height: l.h * zoom + 2 }}
          />
        ),
      )}
    </div>
  );
}
