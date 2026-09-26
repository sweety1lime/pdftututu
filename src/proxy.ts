import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Определяет язык по браузеру и перенаправляет "/" → "/ru" или "/en".
export default createMiddleware(routing);

export const config = {
  // Всё, кроме API, служебных путей Next/Vercel и файлов с расширением (шрифты, воркеры…)
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
