"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckSquare, FilePlus2, RotateCcw, RotateCw, Square, SquareDashed, Trash2, Undo2 } from "lucide-react";
import { FileDropzone } from "@/components/FileDropzone";
import { PdfThumb } from "@/components/PdfThumb";
import { SortableGrid } from "@/components/SortableGrid";
import { MainAction, SecondaryAction, Summary, SummaryList, SummaryRow, ToolWorkspace } from "@/components/ToolWorkspace";
import { Button } from "@/components/ui/button";
import { Tip } from "@/components/ui/misc";
import { baseName, downloadBlob } from "@/lib/download";
import { newId } from "@/lib/pdf/load";
import { buildFromItems, PAGE_SIZES, type PageItem } from "@/lib/pdf/pages";
import { useLoadedPdfs, type LoadedPdf } from "@/lib/pdf/useLoadedPdfs";
import { usePendingFiles, type PendingItem } from "@/lib/pendingFiles";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";

const pagesOf = (f: LoadedPdf): PageItem[] =>
  Array.from({ length: f.pageCount }, (_, i) => ({
    id: newId("pg"),
    kind: "page" as const,
    sourceId: f.id,
    pageIndex: i,
    rotation: 0,
  }));

export function OrganizeTool() {
  const t = useTranslations();
  const showError = useErrorToast();
  // Файлы с главной забираем сами: для них ещё нужно построить список страниц
  const { files, add, clear, loading } = useLoadedPdfs({ pickUpPending: false });
  const [items, setItemsRaw] = useState<PageItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const history = useRef<PageItem[][]>([]);
  const lastClicked = useRef<string | null>(null);

  const sources = useMemo(() => Object.fromEntries(files.map((f) => [f.id, f])), [files]);

  const setItems = useCallback((next: PageItem[] | ((prev: PageItem[]) => PageItem[])) => {
    setItemsRaw((prev) => {
      history.current = [...history.current.slice(-49), prev];
      return typeof next === "function" ? next(prev) : next;
    });
  }, []);

  const undo = useCallback(() => {
    const prev = history.current.pop();
    if (prev) setItemsRaw(prev);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const addFiles = async (incoming: PendingItem[]) => {
    const loaded = await add(incoming);
    if (loaded.length) setItems((prev) => [...prev, ...loaded.flatMap(pagesOf)]);
  };

  usePendingFiles(addFiles);

  const targets = (id?: string) => (id ? [id] : [...selected]);

  const rotate = (delta: number, id?: string) => {
    const ids = new Set(targets(id));
    setItems((prev) => prev.map((it) => (ids.has(it.id) ? { ...it, rotation: it.rotation + delta } : it)));
  };

  const remove = (id?: string) => {
    const ids = new Set(targets(id));
    setItems((prev) => prev.filter((it) => !ids.has(it.id)));
    setSelected((s) => new Set([...s].filter((x) => !ids.has(x))));
  };

  const insertBlank = () => {
    const [w, h] = PAGE_SIZES.a4;
    const blank: PageItem = { id: newId("pg"), kind: "blank", width: w, height: h, rotation: 0 };
    setItems((prev) => {
      const lastSelected = prev.reduce((acc, it, i) => (selected.has(it.id) ? i : acc), -1);
      const at = lastSelected >= 0 ? lastSelected + 1 : prev.length;
      return [...prev.slice(0, at), blank, ...prev.slice(at)];
    });
  };

  const onItemClick = (e: React.MouseEvent, id: string) => {
    if (e.shiftKey && lastClicked.current) {
      const a = items.findIndex((i) => i.id === lastClicked.current);
      const b = items.findIndex((i) => i.id === id);
      const [from, to] = a < b ? [a, b] : [b, a];
      setSelected(new Set(items.slice(from, to + 1).map((i) => i.id)));
    } else if (e.ctrlKey || e.metaKey) {
      setSelected((s) => {
        const n = new Set(s);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      });
    } else {
      setSelected((s) => (s.size === 1 && s.has(id) ? new Set() : new Set([id])));
    }
    lastClicked.current = id;
  };

  const save = async () => {
    setBusy(true);
    try {
      const out = await buildFromItems(
        items,
        Object.fromEntries(files.map((f) => [f.id, f.bytes])),
      );
      downloadBlob(out, `${baseName(files[0]?.name ?? "document")}_pages.pdf`);
      toast.success(t("common.done"));
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
    }
  };

  const startOver = () => {
    clear();
    setItemsRaw([]);
    setSelected(new Set());
    history.current = [];
  };

if (!files.length) {
    return (
      <ToolWorkspace>
        <FileDropzone multiple onFiles={addFiles} disabled={loading} />
      </ToolWorkspace>
    );
  }

  const hasSel = selected.size > 0;

  return (
    <ToolWorkspace
      summary={
        <Summary
          status={<span className="lg:hidden">{t("common.pages", { count: items.length })}</span>}
          actions={
            <>
              <MainAction onClick={save} busy={busy} disabled={!items.length}>
                {t("organize.action")}
              </MainAction>
              <SecondaryAction onClick={startOver}>{t("common.startOver")}</SecondaryAction>
            </>
          }
        >
          <SummaryList>
            <SummaryRow label={t("summary.files")}>{files.length}</SummaryRow>
            <SummaryRow label={t("summary.pages")}>{items.length}</SummaryRow>
          </SummaryList>
        </Summary>
      }
    >
      <div>
        <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center gap-1.5 rounded-xl border bg-background/90 p-2 shadow-sm backdrop-blur">
          <Tip label={t("organize.rotateLeft")}>
            <Button variant="ghost" size="icon" disabled={!hasSel} onClick={() => rotate(-90)}>
              <RotateCcw />
            </Button>
          </Tip>
          <Tip label={t("organize.rotateRight")}>
            <Button variant="ghost" size="icon" disabled={!hasSel} onClick={() => rotate(90)}>
              <RotateCw />
            </Button>
          </Tip>
          <Tip label={t("organize.delete")}>
            <Button variant="ghost" size="icon" disabled={!hasSel} onClick={() => remove()}>
              <Trash2 />
            </Button>
          </Tip>
          <Tip label={t("editor.actions.undo")}>
            <Button variant="ghost" size="icon" onClick={undo}>
              <Undo2 />
            </Button>
          </Tip>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button variant="ghost" size="sm" onClick={insertBlank}>
            <SquareDashed />
            {t("organize.insertBlank")}
          </Button>
          <FileAddButton onFiles={addFiles} label={t("organize.addPdf")} disabled={loading} />
          <div className="mx-1 h-6 w-px bg-border" />
          {hasSel ? (
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              <Square />
              {t("organize.deselect")}
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(items.map((i) => i.id)))}>
              <CheckSquare />
              {t("organize.selectAll")}
            </Button>
          )}
          <span className="ml-auto px-2 text-sm text-muted-foreground">
            {hasSel ? t("organize.selected", { count: selected.size }) : t("common.pages", { count: items.length })}
          </span>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t("organize.hint")}</p>

        {items.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">{t("organize.empty")}</p>
        ) : (
          <SortableGrid
            items={items}
            onReorder={setItems}
            className="md:grid-cols-5 lg:grid-cols-6"
            renderItem={(it, i) => {
              const isSel = selected.has(it.id);
              return (
                <div
                  onClick={(e) => onItemClick(e, it.id)}
                  className={cn(
                    "group relative cursor-pointer rounded-xl border-2 bg-card p-2 transition-colors select-none",
                    isSel ? "border-primary bg-primary/5" : "border-transparent hover:border-border",
                  )}
                >
                  {it.kind === "page" ? (
                    <PdfThumb doc={sources[it.sourceId]?.doc ?? null} pageIndex={it.pageIndex} width={150} rotation={it.rotation} className="mx-auto" />
                  ) : (
                    <div className="mx-auto flex aspect-square max-w-[150px] items-center justify-center">
                      <div
                        className="flex h-full items-center justify-center rounded-sm bg-white text-xs text-neutral-400 shadow-sm ring-1 ring-black/10 transition-transform"
                        style={{ aspectRatio: `${it.width / it.height}`, transform: `rotate(${it.rotation}deg)` }}
                      >
                        {t("organize.blank")}
                      </div>
                    </div>
                  )}
                  <p className="mt-1 text-center text-xs text-muted-foreground">{i + 1}</p>
                  <div
                    className="absolute top-1.5 right-1.5 flex gap-0.5 rounded-lg bg-background/95 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MiniButton label={t("organize.rotateLeft")} onClick={() => rotate(-90, it.id)}>
                      <RotateCcw />
                    </MiniButton>
                    <MiniButton label={t("organize.rotateRight")} onClick={() => rotate(90, it.id)}>
                      <RotateCw />
                    </MiniButton>
                    <MiniButton label={t("organize.delete")} onClick={() => remove(it.id)} danger>
                      <Trash2 />
                    </MiniButton>
                  </div>
                </div>
              );
            }}
          />
        )}

      </div>
    </ToolWorkspace>
  );
}

function MiniButton({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "rounded-md p-1 text-muted-foreground hover:bg-accent [&_svg]:size-3.5",
        danger ? "hover:text-destructive" : "hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function FileAddButton({ onFiles, label, disabled }: { onFiles: (f: File[]) => void; label: string; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        hidden
        onChange={(e) => {
          const list = Array.from(e.target.files ?? []);
          e.target.value = "";
          if (list.length) onFiles(list);
        }}
      />
      <Button variant="ghost" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
        <FilePlus2 />
        {label}
      </Button>
    </>
  );
}
