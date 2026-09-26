"use client";

import { useShallow } from "zustand/react/shallow";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { widgetValue } from "./openDocument";
import { beginGesture, endGesture, useEditor } from "./store";
import type { FormWidget } from "./types";

/** Поля формы PDF поверх страницы — обычные HTML-элементы. */
export function FormLayer({ pageIndex, zoom, interactive }: { pageIndex: number; zoom: number; interactive: boolean }) {
  const widgets = useEditor(useShallow((s) => s.widgets.filter((w) => w.page === pageIndex)));
  const values = useEditor((s) => s.formValues);
  const setValue = useEditor((s) => s.setFormValue);
  if (!widgets.length) return null;

  return (
    <div className={cn("absolute inset-0 z-10", !interactive && "pointer-events-none")}>
      {widgets.map((w) => (
        <Field key={w.id} w={w} zoom={zoom} value={widgetValue(w, values)} onChange={(v) => setValue(w.name, v)} />
      ))}
    </div>
  );
}

const fieldClass =
  "absolute m-0 border border-sky-500/40 bg-sky-500/10 text-black outline-none transition-colors hover:bg-sky-500/15 focus:border-sky-500 focus:bg-sky-50/90 disabled:cursor-not-allowed disabled:opacity-60";

function Field({
  w,
  zoom,
  value,
  onChange,
}: {
  w: FormWidget;
  zoom: number;
  value: FormWidget["initial"];
  onChange: (v: FormWidget["initial"]) => void;
}) {
  const style: React.CSSProperties = { left: w.x * zoom, top: w.y * zoom, width: w.w * zoom, height: w.h * zoom };
  // Авторазмер шрифта, если в PDF задан 0
  const fontSize = (w.fontSize || Math.min(12, Math.max(6, w.h * (w.multiline ? 0.35 : 0.65)))) * zoom;
  const text = { fontSize, fontFamily: '"PDF Sans", sans-serif', textAlign: w.align, padding: `0 ${2 * zoom}px` } as const;
  const gesture = { onFocus: beginGesture, onBlur: endGesture };

  switch (w.kind) {
    case "text":
      return w.multiline ? (
        <textarea
          className={cn(fieldClass, "resize-none")}
          style={{ ...style, ...text, lineHeight: 1.2 }}
          value={String(value ?? "")}
          maxLength={w.maxLen}
          disabled={w.readOnly}
          onChange={(e) => onChange(e.target.value)}
          {...gesture}
        />
      ) : (
        <input
          className={fieldClass}
          style={{ ...style, ...text }}
          value={String(value ?? "")}
          maxLength={w.maxLen}
          disabled={w.readOnly}
          onChange={(e) => onChange(e.target.value)}
          {...gesture}
        />
      );
    case "checkbox":
    case "radio": {
      const checked = w.kind === "checkbox" ? value === true : value === w.exportValue && Boolean(value);
      return (
        <button
          type="button"
          role={w.kind}
          aria-checked={checked}
          disabled={w.readOnly}
          className={cn(fieldClass, "flex items-center justify-center", w.kind === "radio" && "rounded-full")}
          style={style}
          onClick={() => onChange(w.kind === "checkbox" ? !checked : checked ? "" : (w.exportValue ?? ""))}
        >
          {checked &&
            (w.kind === "checkbox" ? (
              <Check style={{ width: "85%", height: "85%" }} strokeWidth={3} />
            ) : (
              <span className="rounded-full bg-black" style={{ width: "50%", height: "50%" }} />
            ))}
        </button>
      );
    }
    case "select":
      return (
        <select
          className={fieldClass}
          style={{ ...style, ...text }}
          value={String(value ?? "")}
          disabled={w.readOnly}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="" />
          {w.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "list": {
      const selected = Array.isArray(value) ? value : value ? [String(value)] : [];
      return (
        <select
          multiple
          className={fieldClass}
          style={{ ...style, ...text }}
          value={w.multiSelect ? selected : selected.slice(0, 1)}
          disabled={w.readOnly}
          onChange={(e) => {
            const vals = Array.from(e.target.selectedOptions, (o) => o.value);
            onChange(w.multiSelect ? vals : (vals[0] ?? ""));
          }}
        >
          {w.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
  }
}
