"use client";

import { useEffect, useState } from "react";
import { newId } from "@/lib/pdf/load";
import type { PreparedImage } from "@/lib/pdf/pages";
import type { Asset } from "./types";

export function assetFromImage(img: PreparedImage): Asset {
  return { id: newId("asset"), mime: img.mime, bytes: img.bytes, width: img.width, height: img.height };
}

const cache = new Map<string, Promise<HTMLImageElement>>();

function loadAssetImage(asset: Asset): Promise<HTMLImageElement> {
  let p = cache.get(asset.id);
  if (!p) {
    p = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(new Blob([asset.bytes as BlobPart], { type: asset.mime }));
    });
    cache.set(asset.id, p);
  }
  return p;
}

/** HTMLImageElement для отрисовки картинки в Konva. */
export function useAssetImage(asset: Asset | undefined): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!asset) return;
    let alive = true;
    loadAssetImage(asset).then((i) => alive && setImg(i));
    return () => {
      alive = false;
    };
  }, [asset]);
  return img;
}

/** Размер вставляемой картинки: не больше доли страницы, с сохранением пропорций. */
export function fitSize(w: number, h: number, maxW: number, maxH: number) {
  // Пиксели → точки (96 DPI)
  let width = (w * 72) / 96;
  let height = (h * 72) / 96;
  const k = Math.min(1, maxW / width, maxH / height);
  width *= k;
  height *= k;
  return { w: width, h: height };
}
