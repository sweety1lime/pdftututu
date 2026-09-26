"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/menu";

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { theme, setTheme } = useTheme();
  const options = [
    { value: "light", label: t("themeLight"), icon: Sun },
    { value: "dark", label: t("themeDark"), icon: Moon },
    { value: "system", label: t("themeSystem"), icon: Monitor },
  ];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme")}>
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuCheckItem key={value} checked={theme === value} onSelect={() => setTheme(value)}>
            <Icon />
            {label}
          </DropdownMenuCheckItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
