import { getTranslations } from "next-intl/server";
import { FileQuestion } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StatusPage } from "@/components/StatusPage";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <StatusPage icon={<FileQuestion />} title={t("title")}>
      <Button asChild>
        <Link href="/">{t("back")}</Link>
      </Button>
    </StatusPage>
  );
}
