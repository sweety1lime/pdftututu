"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";
import type { EditorEntry } from "./types";

// Редактор (pdf.js + Konva) работает только в браузере — на сервере не рендерим
const Editor = dynamic(() => import("./Editor"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center py-24 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" />
    </div>
  ),
});

/**
 * Пока файл не открыт — обычная страница инструмента: заголовок и инструкция
 * отрисованы на сервере (их видят поисковики). С открытым файлом — только редактор.
 */
export function EditorLoader({
  entry,
  header,
  footer,
}: {
  entry?: EditorEntry;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <main className="flex flex-1 flex-col">
      {!open && <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:pt-12">{header}</div>}
      {/* Обёртка одна и та же: иначе React пересоздаст редактор при открытии файла */}
      <div className={open ? "flex flex-1 flex-col" : "px-4"}>
        <Editor entry={entry} onOpenChange={setOpen} />
      </div>
      {!open && <div className="mx-auto w-full max-w-5xl px-4 pb-12">{footer}</div>}
    </main>
  );
}
