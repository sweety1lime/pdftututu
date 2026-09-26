"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { RenderTask } from "pdfjs-dist";
import { renderPage } from "@/lib/pdf/pdfjs";
import { EditTextLayer } from "./EditTextLayer";
import { FormLayer } from "./FormLayer";
import { ObjectsLayer } from "./ObjectsLayer";
import { TextEditOverlay } from "./TextEditOverlay";
import { useEditor } from "./store";
import type { TextObject } from "./types";

/** Не больше ~16 Мпикс на canvas — иначе на большом зуме браузеру не хватит памяти. */
const MAX_PIXELS = 16_000_000;

interface Props {
  index: number;
  fontsVersion: number;
  onNoText?: () => void;
}

export const PageView = memo(function PageView({ index, fontsVersion, onNoText }: Props) {
  const page = useEditor((s) => s.pages[index]);
  const zoom = useEditor((s) => s.zoom);
  const pdf = useEditor((s) => s.pdf);
  const tool = useEditor((s) => s.tool);
  const hasWidgets = useEditor((s) => s.widgets.some((w) => w.page === index));
  const editing = useEditor((s) =>
    s.editingTextId ? (s.objects.find((o) => o.id === s.editingTextId && o.page === index) as TextObject | undefined) : undefined,
  );

  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(index < 2);

  // Рисуем только страницы рядом с экраном
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setNear(e.isIntersecting), { rootMargin: "150% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || !pdf || !page) return;
    let task: RenderTask | null = null;
    let cancelled = false;
    // Небольшая задержка — чтобы при плавном зуме не перерисовывать каждый шаг
    const timer = setTimeout(async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const p = await pdf.getPage(index + 1);
      if (cancelled) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const maxScale = Math.sqrt(MAX_PIXELS / (page.width * page.height));
      // Рисуем во временный canvas, чтобы не мигало белым
      const tmp = document.createElement("canvas");
      task = await renderPage(p, tmp, { scale: Math.min(zoom * dpr, maxScale), hideForms: hasWidgets });
      try {
        await task.promise;
      } catch {
        return; // отменено
      }
      if (cancelled) return;
      canvas.width = tmp.width;
      canvas.height = tmp.height;
      canvas.getContext("2d")!.drawImage(tmp, 0, 0);
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      task?.cancel();
    };
  }, [near, pdf, page, zoom, index, hasWidgets]);

  const getCanvas = useCallback(() => canvasRef.current, []);

  if (!page) return null;
  const w = page.width * zoom;
  const h = page.height * zoom;

  return (
    <div
      ref={boxRef}
      data-page-index={index}
      className="relative mx-auto bg-white shadow-md ring-1 ring-black/5"
      style={{ width: w, height: h }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {near && (
        <>
          <ObjectsLayer pageIndex={index} width={page.width} height={page.height} zoom={zoom} fontsVersion={fontsVersion} />
          {hasWidgets && <FormLayer pageIndex={index} zoom={zoom} interactive={tool === "select" || tool === "forms"} />}
          {tool === "editText" && <EditTextLayer pageIndex={index} zoom={zoom} canvas={getCanvas} onEmpty={onNoText} />}
        </>
      )}
      {editing && <TextEditOverlay key={editing.id} obj={editing} zoom={zoom} />}
    </div>
  );
});
