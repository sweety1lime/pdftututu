"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { RotateCcw, TriangleAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StatusPage } from "@/components/StatusPage";
import { Button } from "@/components/ui/button";

/** Ошибка при отрисовке страницы: вместо белого экрана — объяснение и «Попробовать снова». */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusPage icon={<TriangleAlert />} title={t("errorPage.title")} description={t("errorPage.description")}>
      <Button onClick={reset}>
        <RotateCcw />
        {t("errorPage.retry")}
      </Button>
      <Button variant="outline" asChild>
        <Link href="/">{t("notFound.back")}</Link>
      </Button>
    </StatusPage>
  );
}
