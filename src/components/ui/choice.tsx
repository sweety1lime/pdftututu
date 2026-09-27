"use client";

import { cn } from "@/lib/utils";

/**
 * Выбор одного варианта. С подсказками — карточки с кружком-радио,
 * без них — компактные кнопки-переключатели.
 */
export function Choice<T extends string | number>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; hint?: React.ReactNode; icon?: React.ReactNode }>;
  className?: string;
  "aria-label"?: string;
}) {
  const cards = options.some((o) => o.hint);
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        cards ? "grid gap-2 sm:grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] sm:gap-3" : "flex flex-wrap gap-2",
        className,
      )}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-lg border text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              cards ? "flex flex-col gap-1.5 rounded-xl border-input bg-card p-3.5 sm:min-h-26 sm:gap-2 sm:p-4" : "px-3 py-2",
              active ? "border-primary bg-primary/8 text-foreground" : "hover:bg-accent",
            )}
          >
            {cards ? (
              <>
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className={cn(
                      "size-4.5 shrink-0 rounded-full",
                      active ? "border-[5px] border-primary bg-background" : "border-[1.5px] border-muted-foreground/70",
                    )}
                  />
                  <span className="text-[15px] font-semibold">{o.label}</span>
                  {o.icon && <span className="ml-auto text-muted-foreground [&_svg]:size-4">{o.icon}</span>}
                </span>
                {o.hint && (
                  <span className="pl-7 text-[13px] leading-[1.45] text-muted-foreground sm:pl-0">{o.hint}</span>
                )}
              </>
            ) : (
              <span className="font-medium">{o.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
