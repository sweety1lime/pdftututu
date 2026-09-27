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

const TOOL_ICONS: Record<Tool, React.ComponentType<{ className?: string }>> = {
  select: MousePointer2,
  text: Type,
  editText: TextCursorInput,
  forms: FormInput,
  image: ImagePlus,
  sign: Signature,
  rect: Square,
  ellipse: Circle,
  line: Minus,
  arrow: ArrowUpRight,
  highlight: Highlighter,
  whiteout: Eraser,
  redact: EyeOff,
  pen: PenLine,
};

/** Инструменты группами: выбор | текст | картинки | фигуры | пометки. */
const TOOL_GROUPS: Tool[][] = [
  ["select"],
  ["text", "editText", "forms"],
  ["image", "sign"],
  ["rect", "ellipse", "line", "arrow"],
  ["highlight", "whiteout", "redact", "pen"],
];

const iconButton = "size-9 rounded-lg text-secondary-foreground";

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

  // «Форма» — только если в документе есть поля
  const groups = TOOL_GROUPS.map((g) => g.filter((id) => id !== "forms" || hasForms));

  return (
    <div className="flex h-13 shrink-0 items-center gap-1 overflow-x-auto border-b bg-panel px-3">
      <div className="hidden max-w-48 min-w-0 items-center gap-1 pr-1 lg:flex">
        <span className="truncate text-sm font-medium" title={name}>
          {name}
        </span>
        <Tip label={t("actions.closeFile")}>
          <Button variant="ghost" size="icon-sm" onClick={onClose} className="rounded-lg text-muted-foreground">
            <X />
          </Button>
        </Tip>
      </div>
      <Divider className="hidden lg:block" />
      {groups.map((group, gi) => (
        <div key={gi} className={cn("flex shrink-0 items-center gap-0.5", gi > 0 && "ml-2")}>
          {group.map((id) => {
            const Icon = TOOL_ICONS[id];
            return (
              <Tip key={id} label={`${t(`tools.${id}`)}${TOOL_KEYS[id] ? ` (${TOOL_KEYS[id]})` : ""}`}>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-pressed={tool === id}
                  onClick={() => choose(id)}
                  className={cn(
                    iconButton,
                    tool === id && "bg-primary/15 text-primary-ink hover:bg-primary/20 hover:text-primary-ink",
                  )}
                >
                  <Icon />
                </Button>
              </Tip>
            );
          })}
        </div>
      ))}
      <Divider />
      <Tip label={`${t("actions.undo")} (Ctrl+Z)`}>
        <Button variant="ghost" size="icon" disabled={!canUndo} onClick={undo} className={iconButton}>
          <Undo2 />
        </Button>
      </Tip>
      <Tip label={`${t("actions.redo")} (Ctrl+Y)`}>
        <Button variant="ghost" size="icon" disabled={!canRedo} onClick={redo} className={iconButton}>
          <Redo2 />
        </Button>
      </Tip>
      <Divider />
      <Tip label={t("actions.zoomOut")}>
        <Button variant="ghost" size="icon" onClick={() => setZoom(zoom / 1.2)} className={iconButton}>
          <ZoomOut />
        </Button>
      </Tip>
      <span className="w-12 shrink-0 text-center font-mono text-xs text-secondary-foreground">
        {Math.round(zoom * 100)}%
      </span>
      <Tip label={t("actions.zoomIn")}>
        <Button variant="ghost" size="icon" onClick={() => setZoom(zoom * 1.2)} className={iconButton}>
          <ZoomIn />
        </Button>
      </Tip>
      <Divider />
      <Tip label={t("actions.shortcuts")}>
        <Button variant="ghost" size="icon" onClick={onShortcuts} className={iconButton}>
          <Keyboard />
        </Button>
      </Tip>
      <div className="ml-auto shrink-0 pl-2">{exportButton}</div>
    </div>
  );
}

function Divider({ className }: { className?: string }) {
  return <div className={cn("mx-1.5 h-6 w-px shrink-0 bg-border", className)} />;
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
