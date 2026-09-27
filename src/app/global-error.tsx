"use client";

import { fontVariables } from "./fonts";
import { StoredTheme } from "./StoredTheme";
import "./globals.css";

// Сюда попадают ошибки самого layout — переводов и провайдеров здесь нет,
// поэтому текст сразу на двух языках (как в not-found.tsx).
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="ru" className={`${fontVariables} dark`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <StoredTheme />
        <p className="text-2xl font-bold">Что-то сломалось · Something broke</p>
        <p className="text-muted-foreground">Ваши файлы никуда не отправлялись · Your files were not sent anywhere</p>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Попробовать снова · Try again
        </button>
      </body>
    </html>
  );
}
