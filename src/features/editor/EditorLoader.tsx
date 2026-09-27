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
 * Пока файл не открыт — обычная страница инструмента: список инструментов слева,
 * заголовок и инструкция отрисованы на сервере (их видят поисковики).
 * С открытым файлом — только редактор во всю ширину.
 */
export function EditorLoader({
  entry,
  sidebar,
  header,
  footer,
}: {
  entry?: EditorEntry;
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-1">
      {!open && sidebar}
      <main className="flex min-w-0 flex-1 flex-col">
        {!open && header}
        {/* Обёртка одна и та же: иначе React пересоздаст редактор при открытии файла */}
        <div className={open ? "flex flex-1 flex-col" : "w-full max-w-5xl px-4 pt-5 pb-6 lg:px-8 lg:pt-6 lg:pb-10"}>
          <Editor entry={entry} onOpenChange={setOpen} />
        </div>
        {!open && footer}
      </main>
    </div>
  );
}
