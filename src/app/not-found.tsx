import Link from "next/link";
import "./globals.css";

// Сюда попадают только адреса вне /ru и /en — показываем простую страницу.
export default function GlobalNotFound() {
  return (
    <html lang="ru">
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <p className="text-6xl font-bold">404</p>
        <p className="text-muted-foreground">Страница не найдена · Page not found</p>
        <Link href="/" className="text-primary-ink underline underline-offset-4">
          PDFtutut
        </Link>
      </body>
    </html>
  );
}
