import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Нижняя панель с главной кнопкой действия инструмента. */
export function ActionBar({
  children,
  action,
  onAction,
  busy,
  disabled,
  className,
}: {
  children?: React.ReactNode;
  action: React.ReactNode;
  onAction: () => void;
  busy?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-4 z-20 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-background/90 p-3 shadow-lg backdrop-blur",
        className,
      )}
    >
      <div className="min-w-0 flex-1 text-sm text-muted-foreground">{children}</div>
      <Button size="lg" onClick={onAction} disabled={busy || disabled}>
        {busy && <Loader2 className="animate-spin" />}
        {action}
      </Button>
    </div>
  );
}
