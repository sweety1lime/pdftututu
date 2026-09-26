"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TOOL_KEYS } from "./Toolbar";
import type { Tool } from "./types";

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex flex-wrap justify-end gap-1">
      {keys.map((k) => (
        <kbd key={k} className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs">
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("editor");
  const rows: Array<[string, string[]]> = [
    [t("shortcuts.undo"), ["Ctrl+Z"]],
    [t("shortcuts.redo"), ["Ctrl+Y", "Ctrl+Shift+Z"]],
    [t("shortcuts.delete"), ["Del", "Backspace"]],
    [t("shortcuts.duplicate"), ["Ctrl+D"]],
    [t("shortcuts.copyPaste"), ["Ctrl+C", "Ctrl+V"]],
    [t("shortcuts.nudge"), ["←↑→↓", "Shift"]],
    [t("shortcuts.deselect"), ["Esc"]],
    [t("shortcuts.zoom"), ["+", "−", "Ctrl+🖱"]],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("shortcuts.title")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-2 text-sm">
          {rows.map(([label, keys]) => (
            <div key={label} className="flex items-center justify-between gap-4">
              <span>{label}</span>
              <Keys keys={keys} />
            </div>
          ))}
        </div>
        <p className="border-t pt-3 text-sm font-medium">{t("shortcuts.tools")}</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {(Object.entries(TOOL_KEYS) as Array<[Tool, string]>).map(([tool, key]) => (
            <div key={tool} className="flex items-center justify-between">
              <span>{t(`tools.${tool}`)}</span>
              <Keys keys={[key]} />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
