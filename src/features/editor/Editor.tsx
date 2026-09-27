"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { History, Info } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { PdfThumb } from "@/components/PdfThumb";
import { PrivacyNote } from "@/components/ToolWorkspace";
import { Button } from "@/components/ui/button";
import { prepareImage } from "@/lib/images";
import { newId, readPdfFile, type PdfSource } from "@/lib/pdf/load";
import { CSS_FAMILY } from "@/lib/pdf/fonts";
import { takeDraftRestore, usePendingFiles } from "@/lib/pendingFiles";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";
import { assetFromImage, fitSize } from "./assets";
import { clearDraft, loadDraft, useAutosave, type Draft } from "./autosave";
import { ExportButton } from "./ExportButton";
import { useEditorHotkeys } from "./hotkeys";
import { openDocument } from "./openDocument";
import { PageView } from "./PageView";
import { PropertiesPanel } from "./PropertiesPanel";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { SignatureDialog, type SignatureImage } from "./SignatureDialog";
import { useEditor } from "./store";
import { Toolbar, useImagePicker } from "./Toolbar";
import type { Asset, EditorEntry, ImageObject } from "./types";

interface Props {
  /** С какой страницы открыт редактор — от неё зависит стартовый инструмент */
  entry?: EditorEntry;
  /** Открыт ли документ (страница прячет заголовок и инструкцию) */
  onOpenChange?: (open: boolean) => void;
}

const draftSource = (d: Draft): PdfSource => ({ id: d.sourceId, name: d.name, bytes: d.bytes, wasEncrypted: false });

export default function Editor({ entry = "editor", onOpenChange }: Props) {
  const t = useTranslations("editor");
  const tRoot = useTranslations();
  const source = useEditor((s) => s.source);
  const showError = useErrorToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(false);
  const [signOpen, setSignOpen] = useState(false);

  useAutosave();

  useEffect(() => onOpenChange?.(!!source), [source, onOpenChange]);


  const open = useCallback(
    async (src: PdfSource, restore?: Draft) => {
      setLoading(true);
      try {
        const doc = await openDocument(src);
        if (doc.isXfa) toast.warning(tRoot("errors.xfa"));
        useEditor.getState().load({
          source: src,
          pdf: doc.pdf,
          pages: doc.pages,
          widgets: doc.widgets,
          objects: restore?.objects,
          formValues: restore?.formValues,
          assets: restore?.assets,
        });
        const s = useEditor.getState();
        if (entry === "sign") setSignOpen(true);
        else if (entry === "forms" && !doc.widgets.length) toast.info(t("formsNone"));
        else if (entry === "forms" || entry === "editText" || entry === "redact") s.setTool(entry);
        setDraft(null);
      } catch (e) {
        showError(e);
      } finally {
        setLoading(false);
      }
    },
    [showError, entry, t, tRoot],
  );

  const openFile = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setLoading(true);
    try {
      const src = await readPdfFile(file);
      await clearDraft();
      await open(src);
    } catch (e) {
      showError(e);
      setLoading(false);
    }
  };

  usePendingFiles(openFile);

  // Черновик: предложить восстановить, а если нажали «Восстановить» на главной — сразу открыть
  useEffect(() => {
    if (useEditor.getState().source) return;
    const restore = takeDraftRestore();
    loadDraft().then((d) => {
      if (d && restore) open(draftSource(d), d);
      else setDraft(d);
    });
  }, [open]);

  if (!source) {
    return (
      <div className="w-full">
        {draft && <DraftBanner draft={draft} onRestore={() => open(draftSource(draft), draft)} onDiscard={() => clearDraft().then(() => setDraft(null))} />}
        <FileDropzone onFiles={openFile} disabled={loading} />
        <PrivacyNote className="mt-6 items-center justify-center text-center" />
      </div>
    );
  }

  return <Workspace signOpen={signOpen} setSignOpen={setSignOpen} />;
}

function DraftBanner({ draft, onRestore, onDiscard }: { draft: Draft; onRestore: () => void; onDiscard: () => void }) {
  const t = useTranslations("editor.draft");
  const locale = useLocale();
  const date = new Date(draft.savedAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
      <History className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{t("title")}</p>
        <p className="truncate text-sm text-muted-foreground">{t("description", { name: draft.name, date })}</p>
      </div>
      <Button variant="ghost" onClick={onDiscard}>
        {t("discard")}
      </Button>
      <Button onClick={onRestore}>{t("restore")}</Button>
    </div>
  );
}

function Workspace({ signOpen, setSignOpen }: { signOpen: boolean; setSignOpen: (o: boolean) => void }) {
  const t = useTranslations("editor");
  const showError = useErrorToast();
  const pages = useEditor((s) => s.pages);
  const pdf = useEditor((s) => s.pdf);
  const tool = useEditor((s) => s.tool);
  const hasForms = useEditor((s) => s.widgets.length > 0);
  const currentPage = useEditor((s) => s.currentPage);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [fontsVersion, setFontsVersion] = useState(0);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const noTextWarned = useRef(false);

  // Шрифты для текста на холсте: когда загрузятся — перерисовать
  useEffect(() => {
    const faces = Object.values(CSS_FAMILY).flatMap((f) => [
      `400 16px "${f}"`,
      `700 16px "${f}"`,
      `italic 400 16px "${f}"`,
      `italic 700 16px "${f}"`,
    ]);
    Promise.all(faces.map((f) => document.fonts.load(f).catch(() => null))).then(() => setFontsVersion((v) => v + 1));
  }, []);

  // Начальный масштаб — по ширине окна
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !pages.length) return;
    const maxW = Math.max(...pages.map((p) => p.width));
    const fit = (el.clientWidth - 48) / maxW;
    useEditor.getState().setZoom(Math.min(1.5, Math.max(0.3, fit)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdf]);

  // Сохраняем точку прокрутки при изменении масштаба
  const prevZoom = useRef(useEditor.getState().zoom);
  useEffect(
    () =>
      useEditor.subscribe((s) => {
        const el = scrollRef.current;
        if (!el || s.zoom === prevZoom.current) return;
        const k = s.zoom / prevZoom.current;
        prevZoom.current = s.zoom;
        requestAnimationFrame(() => {
          el.scrollTop = el.scrollTop * k;
          el.scrollLeft = el.scrollLeft * k;
        });
      }),
    [],
  );

  // Ctrl + колесо — масштаб
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const s = useEditor.getState();
      s.setZoom(s.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Текущая страница — та, что ближе к центру экрана
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const mid = el.scrollTop + el.clientHeight / 2;
    let best = 0;
    el.querySelectorAll<HTMLElement>("[data-page-index]").forEach((p) => {
      if (p.offsetTop <= mid) best = Number(p.dataset.pageIndex);
    });
    if (best !== useEditor.getState().currentPage) useEditor.getState().setCurrentPage(best);
  };

  const scrollToPage = (i: number) => {
    const el = scrollRef.current?.querySelector<HTMLElement>(`[data-page-index="${i}"]`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    useEditor.getState().setCurrentPage(i);
  };

  /** Вставить картинку (или подпись) в центр текущей страницы. */
  const insertAsset = useCallback((asset: Asset, maxFraction = 0.5) => {
    const s = useEditor.getState();
    const page = s.pages[s.currentPage];
    if (!page) return;
    const { w, h } = fitSize(asset.width, asset.height, page.width * maxFraction, page.height * maxFraction);
    const obj: ImageObject = {
      id: newId("obj"),
      type: "image",
      page: s.currentPage,
      assetId: asset.id,
      x: (page.width - w) / 2,
      y: (page.height - h) / 2,
      w,
      h,
      rotation: 0,
      opacity: 1,
    };
    s.addAsset(asset);
    s.setTool("select");
    s.addObject(obj);
  }, []);

  const addImageFile = useCallback(
    async (file: Blob) => {
      try {
        insertAsset(assetFromImage(await prepareImage(file)));
      } catch (e) {
        showError(e);
      }
    },
    [insertAsset, showError],
  );

  const picker = useImagePicker(addImageFile);

  const insertSignature = (sig: SignatureImage) => {
    // Подпись поменьше: ~ 1/3 ширины страницы
    insertAsset({ id: newId("asset"), mime: "image/png", ...sig, width: sig.width / 2, height: sig.height / 2 }, 0.33);
    toast.info(t("signature.placeHint"));
  };

  useEditorHotkeys({ pickImage: picker.open, sign: () => setSignOpen(true) });

  // Вставка из буфера обмена: картинка → объект, иначе — наши скопированные объекты
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      e.preventDefault();
      if (file) addImageFile(file);
      else useEditor.getState().paste();
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [addImageFile]);

  const hint =
    tool === "editText" ? t("editTextHint") : tool === "forms" ? (hasForms ? t("formsHint") : t("formsNone")) : null;

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden">
      {picker.input}
      <Toolbar
        onPickImage={picker.open}
        onSign={() => setSignOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
        onClose={() => {
          clearDraft();
          useEditor.getState().close();
        }}
        hasForms={hasForms}
        exportButton={<ExportButton />}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-36 shrink-0 overflow-y-auto border-r bg-background p-3 lg:block">
          <div className="space-y-3">
            {pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => scrollToPage(i)}
                className={cn(
                  "block w-full rounded-lg border-2 p-1 transition-colors",
                  i === currentPage ? "border-primary" : "border-transparent hover:border-border",
                )}
              >
                <PdfThumb doc={pdf} pageIndex={i} width={100} className="mx-auto" />
                <span className="text-xs text-muted-foreground">{i + 1}</span>
              </button>
            ))}
          </div>
        </aside>

        <div ref={scrollRef} onScroll={onScroll} className="relative min-w-0 flex-1 overflow-auto bg-canvas">
          {hint && (
            <div className="pointer-events-none sticky top-3 z-40 flex justify-center">
              <p className="flex items-center gap-2 rounded-full bg-foreground px-4 py-1.5 text-sm text-background shadow-lg">
                <Info className="size-4" />
                {hint}
              </p>
            </div>
          )}
          <div className="flex w-max min-w-full flex-col gap-6 p-6">
            {pages.map((_, i) => (
              <PageView
                key={i}
                index={i}
                fontsVersion={fontsVersion}
                onNoText={() => {
                  if (noTextWarned.current) return;
                  noTextWarned.current = true;
                  toast.info(t("editTextNone"));
                }}
              />
            ))}
          </div>
        </div>

        <PropertiesPanel />
      </div>

      <SignatureDialog open={signOpen} onOpenChange={setSignOpen} onInsert={insertSignature} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}
