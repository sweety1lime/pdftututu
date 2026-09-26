"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { get as idbGet, set as idbSet } from "idb-keyval";
import { Eraser, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox, Label } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { cn } from "@/lib/utils";

export interface SignatureImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const SAVED_KEY = "pdftutut:signatures";
const INK = ["#111111", "#1d4ed8", "#0f766e"];
const FONTS = ['"Signature Marck"', '"Signature Bad"'];
const W = 560;
const H = 200;

/** Обрезать прозрачные поля и вернуть PNG. */
async function trimToPng(canvas: HTMLCanvasElement): Promise<SignatureImage | null> {
  const ctx = canvas.getContext("2d")!;
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) return null;
  const pad = 4;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(width - 1, x1 + pad);
  y1 = Math.min(height - 1, y1 + pad);
  const out = document.createElement("canvas");
  out.width = x1 - x0 + 1;
  out.height = y1 - y0 + 1;
  out.getContext("2d")!.drawImage(canvas, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/png"));
  if (!blob) return null;
  return { bytes: new Uint8Array(await blob.arrayBuffer()), width: out.width, height: out.height };
}

function toDataUrl(s: SignatureImage) {
  let bin = "";
  for (let i = 0; i < s.bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...s.bytes.subarray(i, i + 0x8000));
  }
  return `data:image/png;base64,${btoa(bin)}`;
}

export function SignatureDialog({
  open,
  onOpenChange,
  onInsert,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onInsert: (s: SignatureImage) => void;
}) {
  const t = useTranslations("editor.signature");
  const [tab, setTab] = useState("draw");
  const [ink, setInk] = useState(INK[0]);
  const [typed, setTyped] = useState("");
  const [font, setFont] = useState(FONTS[0]);
  const [remember, setRemember] = useState(true);
  const [saved, setSaved] = useState<SignatureImage[]>([]);
  const [uploaded, setUploaded] = useState<HTMLImageElement | null>(null);
  const drawRef = useRef<HTMLCanvasElement>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    if (!open) return;
    idbGet<SignatureImage[]>(SAVED_KEY)
      .then((s) => setSaved(s ?? []))
      .catch(() => {});
  }, [open]);

  // ---- Рисование ----
  useEffect(() => {
    if (!open || tab !== "draw") return;
    const canvas = drawRef.current;
    if (!canvas) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    setHasInk(false);
  }, [open, tab]);

  const drawing = useRef<{ x: number; y: number; w: number; t: number } | null>(null);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pos(e);
    drawing.current = { ...p, w: 2.6, t: performance.now() };
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
    setHasInk(true);
  };

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const last = drawing.current;
    if (!last) return;
    const p = pos(e);
    const now = performance.now();
    // Быстрее ведём — линия тоньше, как у настоящей ручки
    const speed = Math.hypot(p.x - last.x, p.y - last.y) / Math.max(1, now - last.t);
    const w = Math.max(1.2, Math.min(3.4, last.w * 0.7 + (3.4 - speed * 1.6) * 0.3));
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.strokeStyle = ink;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    drawing.current = { ...p, w, t: now };
  };

  const onUp = () => {
    drawing.current = null;
  };

  const clearDraw = () => {
    const c = drawRef.current;
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setHasInk(false);
  };

  // ---- Итоговая картинка ----
  const buildTyped = async () => {
    await document.fonts.load(`64px ${font}`);
    const c = document.createElement("canvas");
    c.width = 1400;
    c.height = 360;
    const ctx = c.getContext("2d")!;
    ctx.font = `140px ${font}`;
    ctx.fillStyle = ink;
    ctx.textBaseline = "middle";
    ctx.fillText(typed, 30, 180, 1340);
    return trimToPng(c);
  };

  const buildUploaded = async () => {
    if (!uploaded) return null;
    const scale = Math.min(1, 1600 / Math.max(uploaded.naturalWidth, uploaded.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(uploaded.naturalWidth * scale);
    c.height = Math.round(uploaded.naturalHeight * scale);
    const ctx = c.getContext("2d")!;
    ctx.drawImage(uploaded, 0, 0, c.width, c.height);
    // Светлый фон делаем прозрачным — подпись со скана ляжет на документ аккуратно
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      if (lum > 225) d[i + 3] = 0;
      else if (lum > 170) d[i + 3] = Math.min(d[i + 3], Math.round(((225 - lum) / 55) * 255));
    }
    ctx.putImageData(img, 0, 0);
    return trimToPng(c);
  };

  const insert = async (sig?: SignatureImage | null) => {
    const result =
      sig ??
      (tab === "draw" && drawRef.current
        ? await trimToPng(drawRef.current)
        : tab === "type"
          ? await buildTyped()
          : await buildUploaded());
    if (!result) return;
    if (!sig && remember) {
      const next = [result, ...saved].slice(0, 6);
      setSaved(next);
      idbSet(SAVED_KEY, next).catch(() => {});
    }
    onInsert(result);
    onOpenChange(false);
  };

  const removeSaved = (i: number) => {
    const next = saved.filter((_, k) => k !== i);
    setSaved(next);
    idbSet(SAVED_KEY, next).catch(() => {});
  };

  const canInsert = tab === "draw" ? hasInk : tab === "type" ? typed.trim().length > 0 : Boolean(uploaded);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        {saved.length > 0 && (
          <div className="space-y-2">
            <Label>{t("saved")}</Label>
            <div className="flex flex-wrap gap-2">
              {saved.map((s, i) => (
                <SavedSignature key={i} sig={s} onPick={() => insert(s)} onRemove={() => removeSaved(i)} />
              ))}
            </div>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab} className="space-y-3">
          <TabsList>
            <TabsTrigger value="draw">{t("draw")}</TabsTrigger>
            <TabsTrigger value="type">{t("type")}</TabsTrigger>
            <TabsTrigger value="upload">{t("upload")}</TabsTrigger>
          </TabsList>

          {tab !== "upload" && (
            <div className="flex items-center gap-2">
              {INK.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setInk(c)}
                  className={cn("size-6 rounded-full", ink === c && "ring-2 ring-primary ring-offset-2 ring-offset-background")}
                  style={{ background: c }}
                  aria-label={c}
                />
              ))}
            </div>
          )}

          <TabsContent value="draw" className="space-y-2">
            <div className="relative overflow-hidden rounded-lg border bg-white">
              <canvas
                ref={drawRef}
                className="block aspect-[560/200] w-full touch-none"
                onPointerDown={onDown}
                onPointerMove={onMove}
                onPointerUp={onUp}
                onPointerCancel={onUp}
              />
              <div className="pointer-events-none absolute inset-x-8 bottom-10 border-b border-dashed border-neutral-300" />
              <Button variant="ghost" size="sm" className="absolute top-2 right-2 text-neutral-500" onClick={clearDraw}>
                <Eraser />
                {t("clear")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("drawHint")}</p>
          </TabsContent>

          <TabsContent value="type" className="space-y-3">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t("typePlaceholder")} autoFocus />
            <div className="grid gap-2 sm:grid-cols-2">
              {FONTS.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFont(f)}
                  className={cn(
                    "h-20 truncate rounded-lg border bg-white px-4 text-4xl text-black",
                    font === f && "ring-2 ring-primary",
                  )}
                  style={{ fontFamily: f, color: ink }}
                >
                  {typed || t("typePlaceholder")}
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="upload" className="space-y-2">
            <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-white text-neutral-500 hover:border-primary/60">
              {uploaded ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={uploaded.src} alt="" className="max-h-32 max-w-[90%] object-contain" />
              ) : (
                <>
                  <Upload className="size-6" />
                  <span className="text-sm">{t("uploadHint")}</span>
                </>
              )}
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const img = new Image();
                  img.onload = () => setUploaded(img);
                  img.src = URL.createObjectURL(f);
                }}
              />
            </label>
          </TabsContent>
        </Tabs>

        <DialogFooter className="items-center sm:justify-between">
          <Label className="font-normal">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(v === true)} />
            {t("remember")}
          </Label>
          <Button onClick={() => insert()} disabled={!canInsert}>
            {t("insert")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SavedSignature({ sig, onPick, onRemove }: { sig: SignatureImage; onPick: () => void; onRemove: () => void }) {
  // data: URL — не нужно освобождать память, подписи маленькие
  const url = useMemo(() => toDataUrl(sig), [sig]);
  return (
    <div className="group relative">
      <button type="button" onClick={onPick} className="flex h-14 w-32 items-center justify-center rounded-lg border bg-white p-1 hover:ring-2 hover:ring-primary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {url && <img src={url} alt="" className="max-h-full max-w-full object-contain" />}
      </button>
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-2 -right-2 hidden rounded-full border bg-background p-1 text-muted-foreground shadow-sm group-hover:block hover:text-destructive"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}
