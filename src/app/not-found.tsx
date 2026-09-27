import Link from "next/link";
import { fontVariables } from "./fonts";
import { StoredTheme } from "./StoredTheme";
import "./globals.css";

// Сюда попадают только адреса вне /ru и /en — показываем простую страницу.
export default function GlobalNotFound() {
  return (
    <html lang="ru" className={`${fontVariables} dark`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <StoredTheme />
        <p className="font-mono text-6xl font-medium">404</p>
        <p className="text-muted-foreground">Страница не найдена · Page not found</p>
        <Link href="/" className="text-primary-ink underline underline-offset-4">
          PDFtutut
        </Link>
      </body>
    </html>
  );
}
