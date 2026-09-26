// Копирует воркер и ресурсы pdf.js из node_modules в public/pdfjs.
// Запускается автоматически после `npm install` (postinstall) — в том числе на Vercel.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "pdfjs-dist");
const dest = join(root, "public", "pdfjs");

if (!existsSync(src)) {
  console.warn("[copy-pdfjs] pdfjs-dist не установлен — пропускаю");
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });

cpSync(join(src, "build", "pdf.worker.min.mjs"), join(dest, "pdf.worker.min.mjs"));
for (const dir of ["cmaps", "standard_fonts", "wasm", "iccs"]) {
  const from = join(src, dir);
  if (existsSync(from)) cpSync(from, join(dest, dir), { recursive: true });
}
console.log("[copy-pdfjs] готово → public/pdfjs");
