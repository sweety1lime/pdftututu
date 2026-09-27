import { getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { ToolSearch } from "./ToolSearch";

export async function SiteHeader() {
  const t = await getTranslations("meta");
  return (
    <header className="sticky top-0 z-40 h-14 shrink-0 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:h-15">
      <div className="flex h-full items-center gap-0.5 pr-1.5 pl-4 lg:gap-6 lg:px-6">
        <Link
          href="/"
          className="mr-auto flex shrink-0 items-center gap-2.5 text-base font-semibold tracking-[-0.01em] lg:mr-0 lg:text-[17px]"
        >
          <span className="flex size-7 items-center justify-center rounded-[7px] bg-primary text-primary-foreground lg:size-7.5">
            <FileText className="size-4 lg:size-4.5" />
          </span>
          {t("siteName")}
        </Link>
        <ToolSearch />
        <div className="flex items-center gap-0.5 lg:gap-1.5">
          <LocaleSwitcher />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
