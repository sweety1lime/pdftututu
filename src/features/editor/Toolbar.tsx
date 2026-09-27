"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useStore } from "zustand";
import {
  ArrowUpRight,
  Circle,
  Eraser,
  EyeOff,
  FormInput,
  Highlighter,
  ImagePlus,
  Keyboard,
  Minus,
  MousePointer2,
  PenLine,
  Redo2,
  Signature,
  Square,
  TextCursorInput,
  Type,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import { redo, undo, useEditor } from "./store";
import type { Tool } from "./types";

export const TOOL_KEYS: Partial<Record<Tool, string>> = {
  select: "V",
  text: "T",
  editText: "E",
  image: "I",
  rect: "R",
  ellipse: "O",
  line: "L",
  arrow: "A",
  highlight: "H",
  whiteout: "W",
  redact: "X",
  pen: "P",
  sign: "S",
};

const TOOL_ICONS: Array<[Tool, React.ComponentType<{ className?: string }>]> = [
  ["select", MousePointer2],
  ["text", Type],
  ["editText", TextCursorInput],
  ["image", ImagePlus],
  ["sign", Signature],
  ["rect", Square],
  ["ellipse", Circle],
  ["line", Minus],
  ["arrow", ArrowUpRight],
  ["highlight", Highlighter],
  ["whiteout", Eraser],
  ["redact", EyeOff],
  ["pen", PenLine],
];

interface Props {
  onPickImage: () => void;
  onSign: () => void;
  onShortcuts: () => void;
  onClose: () => void;
  hasForms: boolean;
  exportButton: React.ReactNode;
}

export function Toolbar({ onPickImage, onSign, onShortcuts, onClose, hasForms, exportButton }: Props) {
  const t = useTranslations("editor");
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);
  const name = useEditor((s) => s.source?.name);
  const canUndo = useStore(useEditor.temporal, (s) => s.pastStates.length > 0);
  const canRedo = useStore(useEditor.temporal, (s) => s.futureStates.length > 0);

  const choose = (id: Tool) => {
    if (id === "image") return onPickImage();
    if (id === "sign") return onSign();
    setTool(id);
  };

  const tools = hasForms ? [...TOOL_ICONS, ["forms", FormInput] as [Tool, typeof FormInput]] : TOOL_ICONS;

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 overflow-x-auto border-b bg-background px-2">
      <div className="mr-1 hidden max-w-48 min-w-0 items-center gap-1 lg:flex">
        <span className="truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <Tip label={t("actions.closeFile")}>
          <Button variant="ghost" size="icon-sm" onClick={onClose}>
            <X />
          </Button>
        </Tip>
      </div>
      <Divider className="hidden lg:block" />
      {tools.map(([id, Icon]) => (
        <Tip key={id} label={`${t(`tools.${id}`)}${TOOL_KEYS[id] ? ` (${TOOL_KEYS[id]})` : ""}`}>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={tool === id}
            onClick={() => choose(id)}
            className={cn(tool === id && "bg-primary/15 text-primary-ink hover:bg-primary/20 hover:text-primary-ink")}
          >
            <Icon />
          </Button>
        </Tip>
      ))}
      <Divider />
      <Tip label={`${t("actions.undo")} (Ctrl+Z)`}>
        <Button variant="ghost" size="icon-sm" disabled={!canUndo} onClick={undo}>
          <Undo2 />
        </Button>
      </Tip>
      <Tip label={`${t("actions.redo")} (Ctrl+Y)`}>
        <Button variant="ghost" size="icon-sm" disabled={!canRedo} onClick={redo}>
          <Redo2 />
        </Button>
      </Tip>
      <Divider />
      <Tip label={t("actions.zoomOut")}>
        <Button variant="ghost" size="icon-sm" onClick={() => setZoom(zoom / 1.2)}>
          <ZoomOut />
        </Button>
      </Tip>
      <span className="w-12 text-center text-xs tabular-nums">{Math.round(zoom * 100)}%</span>
      <Tip label={t("actions.zoomIn")}>
        <Button variant="ghost" size="icon-sm" onClick={() => setZoom(zoom * 1.2)}>
          <ZoomIn />
        </Button>
      </Tip>
      <Divider />
      <Tip label={t("actions.shortcuts")}>
        <Button variant="ghost" size="icon-sm" onClick={onShortcuts}>
          <Keyboard />
        </Button>
      </Tip>
      <div className="ml-auto pl-2">{exportButton}</div>
    </div>
  );
}

function Divider({ className }: { className?: string }) {
  return <div className={cn("mx-1 h-6 w-px shrink-0 bg-border", className)} />;
}

/** Скрытый input для выбора картинки. */
export function useImagePicker(onFile: (file: File) => void) {
  const ref = useRef<HTMLInputElement>(null);
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
      hidden
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (f) onFile(f);
      }}
    />
  );
  return { input, open: () => ref.current?.click() };
}
