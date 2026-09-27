"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useHotkeys } from "react-hotkeys-hook";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { CommandPalette } from "./CommandPalette";

const isMacNow = () => /Mac|iPhone|iPad/.test(navigator.platform);
const neverChanges = () => () => {};

/** Поиск в шапке: на широком экране — поле, на телефоне — кнопка. Ctrl/⌘+K открывает его откуда угодно. */
export function ToolSearch() {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  // На сервере платформа неизвестна — там всегда «Ctrl»
  const isMac = useSyncExternalStore(neverChanges, isMacNow, () => false);

  useHotkeys("mod+k", () => setOpen((o) => !o), { preventDefault: true, enableOnFormTags: true });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
        className="mx-auto hidden h-10 w-full max-w-[560px] min-w-0 items-center gap-2.5 rounded-lg border bg-card pr-2 pl-3.5 text-sm text-muted-foreground transition-colors outline-none hover:border-input focus-visible:ring-[3px] focus-visible:ring-ring/50 lg:flex"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1 truncate text-left">{t("searchTools")}</span>
        <Kbd aria-hidden>{isMac ? "⌘ K" : "Ctrl K"}</Kbd>
      </button>
      <Button
        variant="ghost"
        size="icon"
        aria-label={t("findTool")}
        onClick={() => setOpen(true)}
        className="size-11 rounded-[10px] text-secondary-foreground lg:hidden [&_svg:not([class*='size-'])]:size-5"
      >
        <Search />
      </Button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}
