"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { renderThumbnail } from "@/lib/pdf/pdfjs";
import { cn } from "@/lib/utils";

interface Props {
  doc: PDFDocumentProxy | null;
  pageIndex: number;
  /** Ширина миниатюры в CSS-пикселях */
  width?: number;
  /** Дополнительный поворот (градусы, кратно 90) — применяется через CSS */
  rotation?: number;
  className?: string;
  /** Что нарисовать поверх самой страницы (не всего квадратного контейнера) */
  children?: React.ReactNode;
  /** Контейнер по форме страницы, а не квадратный — для лент миниатюр без поворота */
  tight?: boolean;
}

/** Миниатюра страницы. Рисуется, только когда появляется на экране. */
export function PdfThumb({ doc, pageIndex, width = 160, rotation = 0, className, children, tight }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1 / Math.SQRT2);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), {
      rootMargin: "300px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !doc) return;
    let cancelled = false;
    let created: string | null = null;
    doc
      .getPage(pageIndex + 1)
      .then((page) => {
        const vp = page.getViewport({ scale: 1 });
        if (!cancelled) setAspect(vp.width / vp.height);
        return renderThumbnail(doc, pageIndex, width);
      })
      .then((u) => {
        created = u;
        if (cancelled) URL.revokeObjectURL(u);
        else setUrl(u);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [visible, doc, pageIndex, width]);

  // Контейнер квадратный: страница вписана в него и после поворота на 90° тоже влезает
  return (
    <div
      ref={ref}
      className={cn("flex w-full items-center justify-center", !tight && "aspect-square", className)}
      style={{ maxWidth: width, aspectRatio: tight ? String(aspect) : undefined }}
    >
      <div
        className="relative overflow-hidden rounded-sm bg-white shadow-sm ring-1 ring-black/10 transition-transform duration-200"
        style={{
          aspectRatio: String(aspect),
          width: tight || aspect >= 1 ? "100%" : `${aspect * 100}%`,
          transform: `rotate(${rotation}deg)`,
        }}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="size-full object-contain" draggable={false} />
        ) : (
          <div className="size-full animate-pulse bg-muted" />
        )}
        {children}
      </div>
    </div>
  );
}
