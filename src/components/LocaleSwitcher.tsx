"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/menu";

const NAMES: Record<Locale, string> = { ru: "Русский", en: "English" };

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (next: Locale) => {
    // Параметры адреса читаем в момент клика — useSearchParams
    // в шапке сломал бы статическую генерацию страниц
    const query = window.location.search;
    router.replace(`${pathname}${query}`, { locale: next });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t("language")} className="gap-1.5 uppercase">
          <Languages />
          {locale}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((l) => (
          <DropdownMenuCheckItem key={l} checked={l === locale} onSelect={() => switchTo(l)}>
            {NAMES[l]}
          </DropdownMenuCheckItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
