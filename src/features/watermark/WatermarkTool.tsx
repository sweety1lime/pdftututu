"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ImagePlus } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { FileCard } from "@/components/FileCard";
import { ActionBar } from "@/components/ActionBar";
import { PdfThumb } from "@/components/PdfThumb";
import { Button } from "@/components/ui/button";
import { Choice } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Label, Slider } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/menu";
import { baseName, downloadBlob } from "@/lib/download";
import { prepareImage } from "@/lib/images";
import { CSS_FAMILY } from "@/lib/pdf/fonts";
import { parsePageRanges } from "@/lib/pdf/ranges";
import { addWatermark, watermarkPlacements, type WatermarkImage, type WatermarkLayout } from "@/lib/pdf/stamp";
import { useLoadedPdfs } from "@/lib/pdf/useLoadedPdfs";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";

type Kind = "text" | "image";
const COLORS = ["#808080", "#dc2626", "#2563eb", "#000000"];
const FONT = `700 100px "${CSS_FAMILY.sans}"`;

export function WatermarkTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  const { files, add, clear, loading } = useLoadedPdfs();
  const file = files[0];
  const [kind, setKind] = useState<Kind>("text");
  const [text, setText] = useState(() => t("watermark.defaultText"));
  const [color, setColor] = useState(COLORS[0]);
  const [image, setImage] = useState<WatermarkImage | null>(null);
  const [fontSize, setFontSize] = useState(60);
  const [imageScale, setImageScale] = useState(50);
  // Прозрачность в процентах — так понятнее, чем «непрозрачность»
  const [transparency, setTransparency] = useState(70);
  const [rotation, setRotation] = useState(-45);
  const [layout, setLayout] = useState<WatermarkLayout>("center");
  const [pagesMode, setPagesMode] = useState<"all" | "custom">("all");
  const [ranges, setRanges] = useState("");
  const [busy, setBusy] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const pages = useMemo((): { list?: number[]; error?: string } => {
    if (!file || pagesMode === "all") return {};
    const parsed = parsePageRanges(ranges, file.pageCount);
    if (!parsed.ok) {
      const error =
        parsed.error === "empty"
          ? t("split.errEmpty")
          : parsed.error === "invalid"
            ? t("split.errInvalid", { token: parsed.token ?? "" })
            : t("split.errOutOfRange", { token: parsed.token ?? "", total: file.pageCount });
      return { list: [], error };
    }
    return { list: [...new Set(parsed.groups.flat())].sort((a, b) => a - b) };
  }, [file, pagesMode, ranges, t]);

  const ready = (kind === "text" ? text.trim().length > 0 : image !== null) && (pages.list?.length ?? 1) > 0;

  const pickImage = async (f: File | undefined) => {
    if (!f) return;
    try {
      setImage(await prepareImage(f));
    } catch (e) {
      showError(e);
    }
  };

  const run = async () => {
    if (!file || !ready) return;
    setBusy(true);
    try {
      const out = await addWatermark(file.bytes, {
        ...(kind === "text" ? { text, color, fontSize } : { image: image!, imageScale: imageScale / 100 }),
        opacity: 1 - transparency / 100,
        rotation,
        layout,
        pages: pages.list,
      });
      downloadBlob(out, `${baseName(file.name)}_watermark.pdf`);
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  if (!file) return <FileDropzone onFiles={(f) => add(f.slice(0, 1))} disabled={loading} />;

  return (
    <div className="space-y-6">
      <FileCard file={file} onClose={clear} />

      <div className="grid gap-8 md:grid-cols-[1fr_auto]">
        <div className="space-y-6">
          <Tabs value={kind} onValueChange={(v) => setKind(v as Kind)} className="space-y-4">
            <TabsList>
              <TabsTrigger value="text">{t("watermark.text")}</TabsTrigger>
              <TabsTrigger value="image">{t("watermark.image")}</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="space-y-4">
              <div className="max-w-md space-y-2">
                <Label htmlFor="wm-text">{t("watermark.textLabel")}</Label>
                <Input id="wm-text" value={text} onChange={(e) => setText(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label>{t("watermark.color")}</Label>
                <div role="radiogroup" aria-label={t("watermark.color")} className="flex items-center gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={color === c}
                      aria-label={c}
                      onClick={() => setColor(c)}
                      className={cn(
                        "size-7 rounded-full border border-black/15",
                        color === c && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  <label
                    className={cn(
                      "relative size-7 cursor-pointer overflow-hidden rounded-full border",
                      !COLORS.includes(color) && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    )}
                    style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
                  >
                    <input
                      type="color"
                      aria-label={t("watermark.customColor")}
                      className="absolute inset-0 cursor-pointer opacity-0"
                      value={color}
                      onChange={(e) => setColor(e.target.value)}
                    />
                  </label>
                </div>
              </div>
              <SliderField label={t("watermark.size")} value={fontSize} min={16} max={140} onChange={setFontSize} unit=" pt" />
            </TabsContent>
            <TabsContent value="image" className="space-y-4">
              <input
                ref={picker}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
                hidden
                onChange={(e) => {
                  pickImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" onClick={() => picker.current?.click()}>
                <ImagePlus />
                {image ? t("watermark.changeImage") : t("watermark.chooseImage")}
              </Button>
              <SliderField label={t("watermark.size")} value={imageScale} min={10} max={100} onChange={setImageScale} unit="%" />
            </TabsContent>
          </Tabs>

          <SliderField label={t("watermark.transparency")} value={transparency} min={0} max={95} onChange={setTransparency} unit="%" />

          <div className="space-y-2">
            <Label>{t("watermark.angle")}</Label>
            <Choice
              value={rotation}
              onChange={setRotation}
              options={[
                { value: -45, label: t("watermark.angleDiagonal") },
                { value: 0, label: t("watermark.angleNone") },
                { value: -90, label: t("watermark.angleVertical") },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("watermark.layout")}</Label>
            <Choice
              value={layout}
              onChange={setLayout}
              options={[
                { value: "center", label: t("watermark.layoutCenter") },
                { value: "tile", label: t("watermark.layoutTile") },
              ]}
            />
          </div>

          <div className="space-y-2">
            <Label>{t("watermark.pages")}</Label>
            <Choice
              value={pagesMode}
              onChange={setPagesMode}
              options={[
                { value: "all", label: t("watermark.pagesAll") },
                { value: "custom", label: t("watermark.pagesCustom") },
              ]}
            />
            {pagesMode === "custom" && (
              <div className="max-w-md space-y-1.5 pt-1">
                <Input
                  value={ranges}
                  onChange={(e) => setRanges(e.target.value)}
                  placeholder={t("split.rangesPlaceholder")}
                  aria-label={t("watermark.pagesCustom")}
                  aria-invalid={Boolean(ranges && pages.error)}
                  autoFocus
                />
                <p className={cn("text-sm", ranges && pages.error ? "text-destructive" : "text-muted-foreground")}>
                  {ranges && pages.error ? pages.error : t("split.rangesHelp")}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label>{t("watermark.preview")}</Label>
          <Preview
            file={file}
            pageIndex={pages.list?.[0] ?? 0}
            kind={kind}
            text={text.trim()}
            color={color}
            fontSize={fontSize}
            image={image}
            imageScale={imageScale / 100}
            opacity={1 - transparency / 100}
            rotation={rotation}
            layout={layout}
          />
        </div>
      </div>

      <ActionBar action={t("watermark.action")} onAction={run} busy={busy} disabled={!ready} />
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="max-w-md space-y-2">
      <div className="flex justify-between text-sm">
        <Label>{label}</Label>
        <span className="text-muted-foreground tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={([v]) => onChange(v)} aria-label={label} />
    </div>
  );
}

/**
 * Превью на миниатюре страницы. Места считает та же watermarkPlacements, что и
 * при сохранении; размеры переводим из pt в доли страницы (%, cqw).
 */
function Preview(props: {
  file: NonNullable<ReturnType<typeof useLoadedPdfs>["files"][number]>;
  pageIndex: number;
  kind: Kind;
  text: string;
  color: string;
  fontSize: number;
  image: WatermarkImage | null;
  imageScale: number;
  opacity: number;
  rotation: number;
  layout: WatermarkLayout;
}) {
  const { file, pageIndex, kind, text, color, fontSize, image, imageScale, opacity, rotation, layout } = props;
  const [page, setPage] = useState<{ width: number; height: number } | null>(null);
  const [fontReady, setFontReady] = useState(0);

  useEffect(() => {
    let alive = true;
    file.doc.getPage(pageIndex + 1).then((p) => {
      const v = p.getViewport({ scale: 1 });
      if (alive) setPage({ width: v.width, height: v.height });
    });
    return () => {
      alive = false;
    };
  }, [file, pageIndex]);

  // Ширину надписи меряем тем же шрифтом, что пойдёт в PDF
  useEffect(() => {
    document.fonts.load(FONT).then(() => setFontReady((v) => v + 1), () => {});
  }, []);

  const imageUrl = useMemo(
    () => (image ? URL.createObjectURL(new Blob([image.bytes as BlobPart], { type: image.mime })) : null),
    [image],
  );
  useEffect(() => () => void (imageUrl && URL.revokeObjectURL(imageUrl)), [imageUrl]);

  const box = useMemo(() => {
    if (!page) return null;
    if (kind === "image") {
      if (!image) return null;
      const w = page.width * imageScale;
      return { w, h: (w * image.height) / image.width };
    }
    if (!text) return null;
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.font = FONT;
    return { w: (ctx.measureText(text).width / 100) * fontSize, h: fontSize };
    // fontReady — пересчитать, когда шрифт загрузится
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, kind, image, imageScale, text, fontSize, fontReady]);

  const spots = page && box
    ? watermarkPlacements(page, box, rotation, layout, kind === "image" ? { x: box.w * 0.6, y: box.h * 0.6 } : undefined)
    : [];

  return (
    <PdfThumb doc={file.doc} pageIndex={pageIndex} width={240} className="w-60">
      {page && box && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" style={{ containerType: "inline-size" }}>
          {spots.map((p, i) => {
            const style: React.CSSProperties = {
              left: `${(p.x / page.width) * 100}%`,
              top: `${(p.y / page.height) * 100}%`,
              width: `${(box.w / page.width) * 100}%`,
              height: `${(box.h / page.height) * 100}%`,
              transform: `rotate(${rotation}deg)`,
              transformOrigin: "0 0",
              opacity,
            };
            return kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={imageUrl ?? ""} alt="" className="absolute" style={style} />
            ) : (
              <span
                key={i}
                className="absolute flex items-center whitespace-nowrap"
                style={{ ...style, color, font: FONT, fontSize: `${(fontSize / page.width) * 100}cqw`, lineHeight: 1 }}
              >
                {text}
              </span>
            );
          })}
        </div>
      )}
    </PdfThumb>
  );
}
