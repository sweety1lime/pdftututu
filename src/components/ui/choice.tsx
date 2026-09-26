"use client";

import { cn } from "@/lib/utils";

/** Группа кнопок-переключателей (как radio, но компактнее). */
export function Choice<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: React.ReactNode; hint?: React.ReactNode }>;
  className?: string;
}) {
  return (
    <div role="radiogroup" className={cn("flex flex-wrap gap-2", className)}>
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
              "rounded-lg border px-3 py-2 text-left text-sm transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              active ? "border-primary bg-primary/10 text-foreground" : "hover:bg-accent",
              o.hint && "flex-1 basis-40",
            )}
          >
            <span className="font-medium">{o.label}</span>
            {o.hint && <span className="mt-0.5 block text-xs text-muted-foreground">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
