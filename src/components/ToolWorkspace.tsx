import { useTranslations } from "next-intl";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Рабочая область инструмента — два элемента сетки ToolPage: основное содержимое
 * и панель «Итог». На широком экране панель справа во всю высоту, на узком —
 * липкая полоса внизу экрана. Пока файла нет, панели нет.
 */
export function ToolWorkspace({ children, summary }: { children: React.ReactNode; summary?: React.ReactNode }) {
  const t = useTranslations("summary");
  return (
    <>
      <div className="w-full max-w-5xl px-4 pt-5 pb-6 lg:row-start-2 lg:px-8 lg:pt-6 lg:pb-10">
        {children}
        {!summary && <PrivacyNote className="mt-6 items-center justify-center text-center" />}
      </div>
      {summary && (
        <aside
          aria-label={t("title")}
          className="sticky bottom-0 z-20 border-t bg-panel lg:static lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:w-80 lg:border-t-0 lg:border-l"
        >
          <div className="flex flex-col gap-2.5 px-4 pt-3 pb-5 lg:sticky lg:top-15 lg:h-[calc(100dvh-3.75rem)] lg:gap-5.5 lg:overflow-y-auto lg:px-6 lg:pt-7 lg:pb-6">
            {summary}
          </div>
        </aside>
      )}
    </>
  );
}

/**
 * Содержимое панели «Итог». children — подробности (только на широком экране),
 * status — то, что видно всегда (прогресс, подсказка), actions — кнопки.
 */
export function Summary({
  children,
  status,
  actions,
}: {
  children?: React.ReactNode;
  status?: React.ReactNode;
  actions: React.ReactNode;
}) {
  const t = useTranslations("summary");
  return (
    <>
      <h2 className="hidden font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase lg:block">
        {t("title")}
      </h2>
      {children && <div className="hidden flex-col gap-5.5 lg:flex">{children}</div>}
      <div className="flex flex-col gap-2.5 lg:mt-auto">
        {status && <div className="text-sm text-muted-foreground">{status}</div>}
        {actions}
        <PrivacyNote className="order-first lg:order-last lg:mt-1" />
      </div>
    </>
  );
}

/** Строки «название — значение» в панели «Итог». */
export function SummaryList({ children }: { children: React.ReactNode }) {
  return <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3.5 text-sm">{children}</dl>;
}

export function SummaryRow({
  label,
  children,
  mono = true,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  /** Числа и размеры — моноширинным */
  mono?: boolean;
  className?: string;
}) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn(mono && "font-mono", className)}>{children}</dd>
    </>
  );
}

/** «Скачается как <имя файла>»; после строк итога — с разделителем. */
export function DownloadsAs({ name }: { name: string }) {
  const t = useTranslations("summary");
  return (
    <div className="flex flex-col gap-1.5 text-[13px] not-first:border-t not-first:pt-5.5">
      <p className="text-muted-foreground">{t("downloadsAs")}</p>
      <p className="font-mono break-all text-secondary-foreground">{name}</p>
    </div>
  );
}

/** Главная кнопка инструмента: во всю ширину панели. */
export function MainAction({
  busy,
  disabled,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Button> & { busy?: boolean }) {
  return (
    <Button size="xl" className={cn("w-full", className)} disabled={busy || disabled} {...props}>
      {busy && <Loader2 className="animate-spin" />}
      {children}
    </Button>
  );
}

/** Второстепенная кнопка под главной. */
export function SecondaryAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button variant="outline" className={cn("h-11 w-full rounded-[10px]", className)} {...props} />;
}

export function PrivacyNote({ className }: { className?: string }) {
  const t = useTranslations("common");
  return (
    <p className={cn("flex items-start gap-2 text-xs leading-normal text-muted-foreground", className)}>
      <ShieldCheck className="size-4 shrink-0 text-success" />
      {t("filesStayLocal")}
    </p>
  );
}
