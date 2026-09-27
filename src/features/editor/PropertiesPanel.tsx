"use client";

import { useTranslations } from "next-intl";
import { useShallow } from "zustand/react/shallow";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Copy,
  Italic,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Slider, Switch, Tip } from "@/components/ui/misc";
import { Choice } from "@/components/ui/choice";
import { cn } from "@/lib/utils";
import type { FontFamily } from "@/lib/pdf/fonts";
import { withTextSize } from "./factory";
import { beginGesture, endGesture, selectedObjects, useEditor } from "./store";
import type { EditorObject, TextObject } from "./types";

const COLORS = ["#111111", "#6b7280", "#ffffff", "#e11d48", "#f97316", "#eab308", "#16a34a", "#0ea5e9", "#2563eb", "#7c3aed"];
const HIGHLIGHTS = ["#fde047", "#86efac", "#f9a8d4", "#93c5fd", "#fdba74"];

export function PropertiesPanel() {
  const t = useTranslations("editor");
  const tool = useEditor((s) => s.tool);
  const selected = useEditor(useShallow(selectedObjects));
  const defaults = useEditor((s) => s.defaults);

  // Что показываем: выделенные объекты или настройки активного инструмента
  const kind: string | null = selected.length
    ? new Set(selected.map((o) => groupOf(o.type))).size === 1
      ? groupOf(selected[0].type)
      : "mixed"
    : tool === "text"
      ? "text"
      : tool === "rect" || tool === "ellipse"
        ? "shape"
        : tool === "line" || tool === "arrow"
          ? "line"
          : tool === "pen"
            ? "pen"
            : tool === "highlight"
              ? "highlight"
              : tool === "redact"
                ? "redact"
                : null;

  const first = selected[0];

  /** Изменить выделенные объекты и запомнить стиль для следующих. */
  const patch = (fn: (o: EditorObject) => Partial<EditorObject>, def?: () => void) => {
    const s = useEditor.getState();
    if (s.selectedIds.length) {
      s.updateObjects(s.selectedIds, (o) => {
        const p = fn(o);
        return o.type === "text" ? withTextSize({ ...o, ...p } as TextObject) : p;
      });
    }
    def?.();
  };

  const setDefaults = useEditor.getState().setDefaults;

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l bg-background p-4 md:flex">
      {!kind && <p className="text-sm text-muted-foreground">{t("props.nothing")}</p>}

      {kind === "text" && (
        <TextProps
          o={(first as TextObject | undefined) ?? { ...defaults.text }}
          onChange={(p) => patch(() => p, () => setDefaults("text", p as Partial<typeof defaults.text>))}
        />
      )}

      {kind === "shape" && (
        <>
          <ColorField
            label={t("props.fill")}
            value={first && "fill" in first ? first.fill : defaults.shape.fill}
            allowNone
            onChange={(fill) => patch(() => ({ fill }), () => setDefaults("shape", { fill }))}
          />
          <ColorField
            label={t("props.stroke")}
            value={first && "stroke" in first ? first.stroke : defaults.shape.stroke}
            allowNone
            onChange={(stroke) => patch(() => ({ stroke }), () => setDefaults("shape", { stroke }))}
          />
          <RangeField
            label={t("props.strokeWidth")}
            min={0.5}
            max={20}
            step={0.5}
            value={first && "strokeWidth" in first ? first.strokeWidth : defaults.shape.strokeWidth}
            onChange={(strokeWidth) => patch(() => ({ strokeWidth }), () => setDefaults("shape", { strokeWidth }))}
          />
        </>
      )}

      {(kind === "line" || kind === "pen") && (
        <>
          <ColorField
            label={t("props.color")}
            value={first && "stroke" in first ? first.stroke : kind === "pen" ? defaults.pen.stroke : defaults.line.stroke}
            onChange={(stroke) =>
              patch(() => ({ stroke: stroke ?? "#000000" }), () => setDefaults(kind === "pen" ? "pen" : "line", { stroke: stroke ?? "#000000" }))
            }
          />
          <RangeField
            label={t("props.strokeWidth")}
            min={0.5}
            max={30}
            step={0.5}
            value={first && "strokeWidth" in first ? first.strokeWidth : kind === "pen" ? defaults.pen.strokeWidth : defaults.line.strokeWidth}
            onChange={(strokeWidth) =>
              patch(() => ({ strokeWidth }), () => setDefaults(kind === "pen" ? "pen" : "line", { strokeWidth }))
            }
          />
          {kind === "pen" && !selected.length && (
            <Label className="justify-between font-normal">
              {t("tools.highlight")}
              <Switch checked={defaults.pen.marker} onCheckedChange={(marker) => setDefaults("pen", { marker })} />
            </Label>
          )}
        </>
      )}

      {kind === "highlight" && (
        <ColorField
          label={t("props.color")}
          palette={HIGHLIGHTS}
          value={first && "fill" in first ? first.fill : defaults.highlight.fill}
          onChange={(fill) => patch(() => ({ fill }), () => setDefaults("highlight", { fill: fill ?? HIGHLIGHTS[0] }))}
        />
      )}

      {kind === "whiteout" && (
        <ColorField
          label={t("props.fill")}
          value={first && "fill" in first ? first.fill : "#ffffff"}
          onChange={(fill) => patch(() => ({ fill: fill ?? "#ffffff" }))}
        />
      )}

      {kind === "redact" && <p className="text-sm text-muted-foreground">{t("redactHint")}</p>}

      {selected.length > 0 && (
        <>
          {/* Полупрозрачная закраска оставила бы текст видимым на картинке */}
          {kind !== "redact" && (
            <RangeField
              label={t("props.opacity")}
              min={0.05}
              max={1}
              step={0.05}
              percent
              value={first.opacity}
              onChange={(opacity) => patch(() => ({ opacity }))}
            />
          )}
          <ObjectActions />
        </>
      )}
    </aside>
  );
}

function groupOf(type: EditorObject["type"]): string {
  if (type === "rect" || type === "ellipse") return "shape";
  if (type === "line" || type === "arrow") return "line";
  if (type === "path") return "pen";
  return type;
}

function TextProps({ o, onChange }: { o: Partial<TextObject>; onChange: (p: Partial<TextObject>) => void }) {
  const t = useTranslations("editor.props");
  return (
    <>
      <div className="space-y-2">
        <Label>{t("font")}</Label>
        <Choice<FontFamily>
          value={o.family ?? "sans"}
          onChange={(family) => onChange({ family })}
          className="grid grid-cols-1 gap-1.5"
          options={[
            { value: "sans", label: <span style={{ fontFamily: '"PDF Sans"' }}>{t("fontSans")}</span> },
            { value: "serif", label: <span style={{ fontFamily: '"PDF Serif"' }}>{t("fontSerif")}</span> },
            { value: "mono", label: <span style={{ fontFamily: '"PDF Mono"' }}>{t("fontMono")}</span> },
          ]}
        />
      </div>
      <RangeField label={t("size")} min={4} max={96} step={0.5} value={o.fontSize ?? 14} onChange={(fontSize) => onChange({ fontSize })} />
      <div className="flex flex-wrap gap-1">
        <ToggleIcon label={t("bold")} active={Boolean(o.bold)} onClick={() => onChange({ bold: !o.bold })} disabled={o.family === "mono"}>
          <Bold />
        </ToggleIcon>
        <ToggleIcon label={t("italic")} active={Boolean(o.italic)} onClick={() => onChange({ italic: !o.italic })} disabled={o.family === "mono"}>
          <Italic />
        </ToggleIcon>
        <div className="mx-1 w-px bg-border" />
        {(
          [
            ["left", AlignLeft, t("alignLeft")],
            ["center", AlignCenter, t("alignCenter")],
            ["right", AlignRight, t("alignRight")],
          ] as const
        ).map(([align, Icon, label]) => (
          <ToggleIcon key={align} label={label} active={(o.align ?? "left") === align} onClick={() => onChange({ align })}>
            <Icon />
          </ToggleIcon>
        ))}
      </div>
      <ColorField label={t("color")} value={o.color ?? "#111111"} onChange={(color) => onChange({ color: color ?? "#111111" })} />
      <RangeField label={t("lineHeight")} min={0.8} max={3} step={0.05} value={o.lineHeight ?? 1.2} onChange={(lineHeight) => onChange({ lineHeight })} />
    </>
  );
}

function ObjectActions() {
  const t = useTranslations("editor.actions");
  const s = useEditor.getState();
  return (
    <div className="grid grid-cols-4 gap-1 border-t pt-4">
      <Tip label={`${t("duplicate")} (Ctrl+D)`}>
        <Button variant="outline" size="icon-sm" onClick={() => s.duplicate(useEditor.getState().selectedIds)}>
          <Copy />
        </Button>
      </Tip>
      <Tip label={t("bringForward")}>
        <Button variant="outline" size="icon-sm" onClick={() => s.moveZ(useEditor.getState().selectedIds, 1)}>
          <ArrowUp />
        </Button>
      </Tip>
      <Tip label={t("sendBackward")}>
        <Button variant="outline" size="icon-sm" onClick={() => s.moveZ(useEditor.getState().selectedIds, -1)}>
          <ArrowDown />
        </Button>
      </Tip>
      <Tip label={`${t("delete")} (Del)`}>
        <Button
          variant="outline"
          size="icon-sm"
          className="hover:text-destructive"
          onClick={() => s.removeObjects(useEditor.getState().selectedIds)}
        >
          <Trash2 />
        </Button>
      </Tip>
    </div>
  );
}

function ToggleIcon({
  label,
  active,
  onClick,
  disabled,
  children,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tip label={label}>
      <Button
        variant="outline"
        size="icon-sm"
        aria-pressed={active}
        disabled={disabled}
        onClick={onClick}
        className={cn(active && "border-primary bg-primary/10 text-primary-ink")}
      >
        {children}
      </Button>
    </Tip>
  );
}

function RangeField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  percent,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  percent?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {percent ? (
          <span className="text-xs text-muted-foreground tabular-nums">{Math.round(value * 100)}%</span>
        ) : (
          <input
            type="number"
            className="h-7 w-16 rounded-md border bg-transparent px-2 text-right text-xs tabular-nums"
            min={min}
            max={max}
            step={step}
            value={Math.round(value * 10) / 10}
            onFocus={beginGesture}
            onBlur={endGesture}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= min && v <= max) onChange(v);
            }}
          />
        )}
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onPointerDown={beginGesture}
        onValueChange={([v]) => onChange(v)}
        onValueCommit={endGesture}
      />
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
  allowNone,
  palette = COLORS,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  allowNone?: boolean;
  palette?: string[];
}) {
  const t = useTranslations("editor.props");
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-1.5">
        {allowNone && (
          <button
            type="button"
            title={t("noFill")}
            onClick={() => onChange(null)}
            className={cn(
              "relative size-6 overflow-hidden rounded-full border bg-background",
              value === null && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
          >
            <span className="absolute top-1/2 left-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 -rotate-45 bg-destructive" />
          </button>
        )}
        {palette.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => onChange(c)}
            className={cn(
              "size-6 rounded-full border border-black/15",
              value?.toLowerCase() === c && "ring-2 ring-primary ring-offset-2 ring-offset-background",
            )}
            style={{ background: c }}
          />
        ))}
        <label
          className="relative size-6 cursor-pointer overflow-hidden rounded-full border"
          style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
          title="…"
        >
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={value ?? "#000000"}
            onFocus={beginGesture}
            onBlur={endGesture}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
      </div>
    </div>
  );
}
