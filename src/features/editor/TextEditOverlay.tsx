"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cssFont, lineHeightPt, measureTextBrowser } from "@/lib/pdf/textLayout";
import { beginGesture, endGesture, useEditor } from "./store";
import type { TextObject } from "./types";

/** Поле ввода поверх текстового объекта во время редактирования. */
export function TextEditOverlay({ obj, zoom }: { obj: TextObject; zoom: number }) {
  const [value, setValue] = useState(obj.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);
  const alive = useRef(false);
  const latest = useRef(obj.text);

  useEffect(() => {
    alive.current = true;
    beginGesture(); // если жест уже начат (создание текста) — ничего не делает
    const el = ref.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
      if (obj.text) el.select();
    }
    return () => {
      alive.current = false;
      // Strict Mode в dev сразу монтирует компонент заново — сохраняем,
      // только если поле действительно исчезло (например, удалили объект)
      setTimeout(() => {
        if (!alive.current) commit();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obj.id]);

  const size = measureTextBrowser(value || " ", obj);

  useLayoutEffect(() => {
    // Поле не должно прокручиваться — текст всегда виден целиком
    if (ref.current) ref.current.scrollTop = 0;
  });

  function commit() {
    if (done.current) return;
    done.current = true;
    const s = useEditor.getState();
    const text = ref.current?.value ?? latest.current;
    if (!s.objects.some((o) => o.id === obj.id)) {
      // Объект уже удалён (например, Undo во время ввода)
      if (s.editingTextId === obj.id) s.setEditingText(null);
      endGesture();
      return;
    }
    if (!text.trim()) {
      s.removeObjects([obj.id]);
    } else {
      const m = measureTextBrowser(text, obj);
      s.updateObject(obj.id, { text, w: m.w, h: m.h });
    }
    if (s.editingTextId === obj.id) s.setEditingText(null);
    endGesture();
  }

  const lh = lineHeightPt(obj) * zoom;
  const extra = obj.fontSize * zoom; // место под курсор
  const width = size.w * zoom + extra;
  const shift = obj.align === "center" ? extra / 2 : obj.align === "right" ? extra : 0;

  return (
    <textarea
      ref={ref}
      value={value}
      wrap="off"
      spellCheck={false}
      onChange={(e) => {
        latest.current = e.target.value;
        setValue(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape" || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
          e.preventDefault();
          ref.current?.blur();
        }
      }}
      onPointerDown={(e) => e.stopPropagation()}
      className="absolute z-30 m-0 resize-none overflow-hidden border-0 bg-transparent p-0 outline-2 outline-offset-2 outline-[#e3a21a] outline-dashed"
      style={{
        left: obj.x * zoom - shift,
        top: obj.y * zoom,
        width,
        height: size.h * zoom + 1,
        font: cssFont(obj, zoom),
        lineHeight: `${lh}px`,
        color: obj.color,
        opacity: obj.opacity,
        textAlign: obj.align,
        whiteSpace: "pre",
        fontKerning: "none",
        transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
        transformOrigin: `${shift}px 0`,
        caretColor: obj.color,
      }}
    />
  );
}
