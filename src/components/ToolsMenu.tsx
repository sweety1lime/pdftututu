"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, LayoutGrid } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { TOOL_GROUPS, TOOL_ICON_CLASS, TOOLS } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";

export function ToolsMenu() {
  const t = useTranslations();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5">
          <LayoutGrid />
          <span className="hidden sm:inline">{t("common.allTools")}</span>
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      {/* На широком экране — две колонки групп, чтобы весь список помещался без прокрутки */}
      <DropdownMenuContent
        align="end"
        className="max-h-[70vh] w-64 overflow-y-auto sm:grid sm:max-h-none sm:w-[34rem] sm:grid-cols-2 sm:gap-x-1"
      >
        {TOOL_GROUPS.map((group, gi) => (
          <div key={group}>
            {gi > 0 && <DropdownMenuSeparator className="sm:hidden" />}
            <DropdownMenuLabel>{t(`home.groups.${group}`)}</DropdownMenuLabel>
            {TOOLS.filter((tool) => tool.group === group).map((tool) => (
              <DropdownMenuItem key={tool.id} asChild>
                <Link href={tool.href}>
                  <span className={cn("flex size-6 items-center justify-center rounded-md", TOOL_ICON_CLASS)}>
                    <tool.icon className="size-3.5" />
                  </span>
                  {t(`tools.${tool.id}.title`)}
                </Link>
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
