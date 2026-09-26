"use client";

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

export function EditorLoader({ entry }: { entry?: EditorEntry }) {
  return <Editor entry={entry} />;
}
