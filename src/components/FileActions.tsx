"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useHotkeys } from "react-hotkeys-hook";
import { Check, ChevronRight, Minus, Plus, RefreshCw, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { PdfThumb } from "@/components/PdfThumb";
import { PrivacyNote } from "@/components/ToolWorkspace";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { formatBytes } from "@/lib/download";
import { closePdfjs } from "@/lib/pdf/pdfjs";
import { openLoadedPdf, type LoadedPdf } from "@/lib/pdf/useLoadedPdfs";
import { hasFormFields, hasTextLayer } from "@/lib/pdfInfo";
import { setPendingFiles } from "@/lib/pendingFiles";
import { getTool, TOOL_GROUPS, TOOL_ICON_CLASS, TOOLS, type Tool, type ToolId } from "@/lib/tools";
import { useErrorToast } from "@/lib/useErrorToast";
import { cn } from "@/lib/utils";

interface Info {
  hasText: boolean;
  hasForms: boolean;
}

/** Три главных действия: обычно редактор, сжать, подписать; для анкеты и скана — своё первым. */
function topActions(info: Info): Tool[] {
  const ids: ToolId[] = [
    ...(info.hasForms ? (["forms"] as const) : []),
    ...(info.hasText ? [] : (["ocr"] as const)),
    "editor",
    "compress",
    "sign",
  ];
  return ids.slice(0, 3).map(getTool);
}

/**
 * «Файл открыт — что сделать»: на главную бросили один PDF. Файл открывается здесь
 * (с паролем, если нужно) и уходит в выбранный инструмент уже открытым.
 */
export function FileActions({
  file,
  onReplace,
  onClose,
}: {
  file: File;
  onReplace: (file: File) => void;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const showError = useErrorToast();
  const [pdf, setPdf] = useState<LoadedPdf | null>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const loading = useRef<{ file: File; promise: Promise<LoadedPdf> } | null>(null);
  const opened = useRef<LoadedPdf | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const fail = useRef((e: unknown) => {
    showError(e);
    onClose();
  });
  useEffect(() => {
    fail.current = (e) => {
      showError(e);
      onClose();
    };
  });

  useEffect(() => {
    window.scrollTo(0, 0);
    heading.current?.focus();
  }, []);

  useEffect(() => {
    // В разработке React вызывает эффект дважды — файл открываем один раз, иначе пароль спросят дважды
    if (loading.current?.file !== file) loading.current = { file, promise: openLoadedPdf(file) };
    let alive = true;
    loading.current.promise.then(
      (p) => {
        opened.current = p;
        if (alive) setPdf(p);
      },
      (e) => alive && fail.current(e),
    );
    return () => {
      alive = false;
    };
  }, [file]);

  // Свой экземпляр pdf.js закрываем при уходе: инструмент откроет файл заново из байтов
  useEffect(() => () => closePdfjs(opened.current?.doc), []);

  useEffect(() => {
    if (!pdf) return;
    let alive = true;
    Promise.all([hasTextLayer(pdf.doc), hasFormFields(pdf.doc)]).then(
      ([hasText, hasForms]) => alive && setInfo({ hasText, hasForms }),
      () => alive && setInfo({ hasText: true, hasForms: false }),
    );
    return () => {
      alive = false;
    };
  }, [pdf]);

  const top = info ? topActions(info) : [];
  const others = TOOLS.filter(
    (tool) =>
      !top.includes(tool) && tool.id !== "imagesToPdf" && (tool.id !== "unlock" || pdf?.wasEncrypted === true),
  );

  // Инструмент заберёт уже открытый файл — второй раз пароль не спросят
  const handOff = () => {
    if (pdf) setPendingFiles([pdf]);
  };
  const go = (i: number) => {
    const tool = top[i];
    if (!tool || !pdf) return;
    handOff();
    router.push(tool.href);
  };
  // Клавиши 1–3; в полях ввода не срабатывают
  useHotkeys("1", () => go(0), [top, pdf]);
  useHotkeys("2", () => go(1), [top, pdf]);
  useHotkeys("3", () => go(2), [top, pdf]);

  const size = formatBytes(file.size, locale);
  const title = (tool: Tool) => (tool.id === "merge" ? t("actions.mergeWithOthers") : t(`tools.${tool.id}.title`));

  return (
    <div className="flex flex-1 flex-col lg:min-h-[calc(100dvh-3.75rem)] lg:flex-row">
      <aside className="relative mx-4 mt-4 flex flex-col gap-3 rounded-xl border bg-card p-3.5 lg:m-0 lg:w-110 lg:shrink-0 lg:gap-5 lg:rounded-none lg:border-0 lg:border-r lg:bg-panel lg:px-8 lg:py-7">
        <p className="hidden font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase lg:block">
          {t("actions.opened")}
        </p>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t("common.close")}
          onClick={onClose}
          className="absolute top-2 right-2 size-10 text-muted-foreground lg:top-5 lg:right-5 lg:size-9"
        >
          <X />
        </Button>

        <div className="hidden h-100 items-center justify-center rounded-xl border bg-canvas lg:flex">
          {pdf ? (
            <PdfThumb
              doc={pdf.doc}
              pageIndex={0}
              width={250}
              tight
              className="w-62.5 [&>div]:shadow-[0_18px_40px_-16px_rgb(0_0_0/0.35)] dark:[&>div]:shadow-[0_18px_40px_-12px_rgb(0_0_0/0.7)]"
            />
          ) : (
            <div className="h-88 w-62.5 animate-pulse rounded-sm bg-muted" />
          )}
        </div>

        <div className="flex items-center gap-3.5 pr-10 lg:pr-0">
          <div className="w-14 shrink-0 lg:hidden">
            {pdf ? (
              <PdfThumb doc={pdf.doc} pageIndex={0} width={56} tight className="w-14" />
            ) : (
              <div className="h-19 w-14 animate-pulse rounded-sm bg-muted" />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-1 lg:gap-1.5">
            <h1 className="text-[17px] font-semibold tracking-[-0.01em] [overflow-wrap:anywhere] lg:text-[22px]">
              {file.name}
            </h1>
            <p className="font-mono text-xs text-muted-foreground lg:text-[13px]">
              {pdf ? `${t("common.pages", { count: pdf.pageCount })} · ${size}` : size}
            </p>
          </div>
        </div>

        {pdf && info && (
          <ul className="flex flex-wrap gap-1.5 lg:gap-2">
            <Tag ok={info.hasText}>{info.hasText ? t("actions.hasText") : t("actions.noText")}</Tag>
            <Tag ok={!pdf.wasEncrypted}>{pdf.wasEncrypted ? t("actions.wasEncrypted") : t("actions.noPassword")}</Tag>
            <Tag ok={info.hasForms}>{info.hasForms ? t("actions.hasForms") : t("actions.noForms")}</Tag>
          </ul>
        )}

        <div className="grid grid-cols-2 gap-2 lg:mt-auto lg:flex">
          <input
            ref={picker}
            type="file"
            accept="application/pdf,.pdf"
            hidden
            onChange={(e) => {
              const next = e.target.files?.[0];
              e.target.value = "";
              if (next) onReplace(next);
            }}
          />
          <Button variant="outline" onClick={() => picker.current?.click()} className="h-11 lg:h-10">
            <RefreshCw className="max-lg:hidden" />
            {t("actions.replace")}
          </Button>
          <Button asChild variant="outline" className="h-11 lg:h-10">
            <Link href="/merge" onClick={handOff}>
              <Plus className="max-lg:hidden" />
              <span className="lg:hidden">{t("common.addMore")}</span>
              <span className="max-lg:hidden">{t("actions.addMore")}</span>
            </Link>
          </Button>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-4 px-4 pt-6 pb-8 lg:gap-7 lg:px-10 lg:py-8">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <h2
            ref={heading}
            tabIndex={-1}
            className="text-[22px] font-semibold tracking-[-0.01em] outline-none lg:text-[32px] lg:tracking-[-0.02em]"
          >
            {t("actions.title")}
          </h2>
          <p className="hidden items-center gap-2 text-[13px] text-muted-foreground lg:flex pointer-coarse:hidden">
            {t.rich("actions.keysHint", { k: (chunks) => <Kbd>{chunks}</Kbd> })}
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="hidden font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase lg:block">
            {t("home.popular")}
          </h3>
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-3 lg:gap-4">
            {info
              ? top.map((tool, i) => (
                  <Link
                    key={tool.id}
                    href={tool.href}
                    onClick={handOff}
                    aria-keyshortcuts={String(i + 1)}
                    className={cn(
                      "grid grid-cols-[44px_minmax(0,1fr)_20px] items-center gap-x-3 rounded-xl border border-input bg-card p-3.5 transition-colors outline-none hover:bg-accent/60 focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:flex lg:min-h-40 lg:flex-col lg:items-stretch lg:gap-3 lg:rounded-[14px] lg:p-5",
                      i === 0 && "border-primary",
                    )}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={cn(
                          "flex size-11 items-center justify-center rounded-[10px]",
                          i === 0 ? "bg-primary/13 text-primary-ink" : TOOL_ICON_CLASS,
                        )}
                      >
                        <tool.icon className="size-5" />
                      </span>
                      <Kbd aria-hidden className="max-lg:hidden">
                        {i + 1}
                      </Kbd>
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5 lg:gap-3">
                      <span className="text-base font-semibold lg:text-lg">{title(tool)}</span>
                      <span className="text-[13px] leading-snug text-muted-foreground lg:text-sm lg:leading-[1.45]">
                        {t(`tools.${tool.id}.description`)}
                      </span>
                    </span>
                    <ChevronRight className="size-5 text-muted-foreground lg:hidden" />
                  </Link>
                ))
              : [0, 1, 2].map((i) => (
                  <div key={i} className="h-19 animate-pulse rounded-xl border bg-card lg:h-40 lg:rounded-[14px]" />
                ))}
          </div>
        </section>

        {info && (
          <section className="mt-2 flex flex-col gap-3 lg:mt-0">
            <h3 className="font-mono text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase lg:text-xs">
              {t("actions.all")}
            </h3>
            <div className="grid items-start gap-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
              {TOOL_GROUPS.map((group) => {
                const tools = others.filter((tool) => tool.group === group);
                if (!tools.length) return null;
                return (
                  <div
                    key={group}
                    className="flex flex-col gap-2 rounded-xl border bg-card p-3 lg:gap-1.5 lg:border-0 lg:bg-transparent lg:p-0"
                  >
                    <p className="mb-0.5 text-[13px] font-semibold text-secondary-foreground">
                      {t(`home.groups.${group}`)}
                    </p>
                    <div className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-1.5">
                      {tools.map((tool) => (
                        <Link
                          key={tool.id}
                          href={tool.href}
                          onClick={handOff}
                          className="flex min-h-13 items-center gap-2.5 rounded-lg bg-secondary px-2.5 py-2 text-sm leading-tight transition-colors outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:h-10 lg:min-h-0 lg:border lg:bg-card lg:px-3 lg:py-0"
                        >
                          <tool.icon className="size-4 shrink-0 text-secondary-foreground" />
                          {title(tool)}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <PrivacyNote className="lg:mt-auto lg:items-center lg:text-[13px]" />
      </main>
    </div>
  );
}

function Tag({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? Check : Minus;
  return (
    <li
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md bg-secondary px-2.5 text-[13px] lg:border lg:bg-card",
        ok ? "text-secondary-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </li>
  );
}
