import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

// Шрифты интерфейса. next/font скачивает их при сборке и отдаёт с нашего домена
const ui = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-ui",
  display: "swap",
});
// Цифры, размеры файлов, подписи групп, клавиши
const uiMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin", "cyrillic"],
  variable: "--font-ui-mono",
  display: "swap",
});

/** Классы для <html>: CSS-переменные шрифтов интерфейса. */
export const fontVariables = `${ui.variable} ${uiMono.variable}`;

/**
 * Страницы вне /ru и /en (404, ошибка корневого layout) живут без next-themes.
 * Тёмная тема там по умолчанию, светлая — если её выбрали на сайте (next-themes хранит выбор
 * в localStorage.theme).
 */
export function prefersLight(): boolean {
  try {
    const t = localStorage.getItem("theme");
    return t === "light" || (t === "system" && matchMedia("(prefers-color-scheme: light)").matches);
  } catch {
    return false;
  }
}
