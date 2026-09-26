import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ToolsMenu } from "./ToolsMenu";

export async function SiteHeader() {
  const t = await getTranslations("meta");
  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-full max-w-7xl items-center gap-2 px-4">
        <Link href="/" className="mr-auto flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <FileText className="size-4.5" />
          </span>
          <span className="text-lg">{t("siteName")}</span>
        </Link>
        <ToolsMenu />
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
