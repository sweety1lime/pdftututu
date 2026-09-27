"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { searchTools, TOOL_GROUPS, TOOL_ICON_CLASS, type Tool } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/misc";

/** Поиск инструмента по названию и описанию: стрелки выбирают, Enter открывает. */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showClose={false}
        aria-describedby={undefined}
        className="top-4 flex max-h-[min(36rem,calc(100dvh-2rem))] translate-y-0 flex-col gap-0 overflow-hidden bg-card p-0 sm:top-[12vh] sm:max-w-xl"
      >
        <DialogTitle className="sr-only">{t("findTool")}</DialogTitle>
        {/* Внутри диалога — чтобы запрос сбрасывался при каждом открытии */}
        <Palette onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

function Palette({ onDone }: { onDone: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const id = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const found = searchTools(query, (tool) => `${t(`tools.${tool.id}.title`)} ${t(`tools.${tool.id}.description`)}`);
  const groups = TOOL_GROUPS.map((group) => ({ group, tools: found.filter((tool) => tool.group === group) })).filter(
    (g) => g.tools.length,
  );
  const flat = groups.flatMap((g) => g.tools);
  const current = flat[active];
  const optionId = (tool: Tool) => `${id}-${tool.id}`;

  const go = (tool: Tool) => {
    onDone();
    router.push(tool.href);
  };

  const move = (delta: number) => {
    if (!flat.length) return;
    const next = (active + delta + flat.length) % flat.length;
    setActive(next);
    document.getElementById(optionId(flat[next]))?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") move(1);
    else if (e.key === "ArrowUp") move(-1);
    else if (e.key === "Enter" && current) go(current);
    else return;
    e.preventDefault();
  };

  return (
    <>
      <div className="flex items-center gap-3 border-b px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          type="text"
          role="combobox"
          aria-expanded
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={current ? optionId(current) : undefined}
          aria-label={t("common.findTool")}
          // Примеры запросов уже видны в шапке, а на телефоне длинная подсказка не помещается
          placeholder={t("common.findTool")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-13 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <Kbd className="hidden sm:inline-block">Esc</Kbd>
      </div>

      <div id={`${id}-list`} role="listbox" aria-label={t("common.allTools")} className="overflow-y-auto p-2">
        {!flat.length && <p className="px-3 py-10 text-center text-sm text-muted-foreground">{t("common.searchEmpty")}</p>}
        {groups.map(({ group, tools }) => (
          <div key={group} role="group" aria-labelledby={`${id}-${group}`} className="pb-1">
            <div
              id={`${id}-${group}`}
              className="px-2 pt-2 pb-1.5 font-mono text-xs font-medium tracking-[0.08em] text-muted-foreground uppercase"
            >
              {t(`home.groups.${group}`)}
            </div>
            {tools.map((tool) => (
              <div
                key={tool.id}
                id={optionId(tool)}
                role="option"
                aria-selected={tool === current}
                onClick={() => go(tool)}
                onMouseMove={() => setActive(flat.indexOf(tool))}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-1.5",
                  tool === current && "bg-accent",
                )}
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", TOOL_ICON_CLASS)}>
                  <tool.icon className="size-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{t(`tools.${tool.id}.title`)}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">
                    {t(`tools.${tool.id}.description`)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
