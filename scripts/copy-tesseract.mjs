// Копирует воркер, ядро и языковые модели tesseract.js в public/tesseract,
// чтобы OCR не ходил на сторонние CDN. Запускается после `npm install` (postinstall).
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dest = join(root, "public", "tesseract");
const require = createRequire(join(root, "package.json"));

// Должны совпадать с OCR_LANGUAGES в src/lib/ocrLanguages.ts (модели — из пакетов @tesseract.js-data/*)
const LANGS = ["rus", "eng", "ukr", "deu", "fra", "spa"];
// OCR работает только в режиме LSTM; вариант ядра воркер выбирает по поддержке SIMD в браузере
const CORES = ["tesseract-core-relaxedsimd-lstm.wasm.js", "tesseract-core-simd-lstm.wasm.js", "tesseract-core-lstm.wasm.js"];

let tesseractDir;
try {
  tesseractDir = dirname(require.resolve("tesseract.js/package.json"));
} catch {
  console.warn("[copy-tesseract] tesseract.js не установлен — пропускаю");
  process.exit(0);
}
const coreDir = dirname(createRequire(join(tesseractDir, "package.json")).resolve("tesseract.js-core/package.json"));

rmSync(dest, { recursive: true, force: true });
mkdirSync(join(dest, "core"), { recursive: true });
mkdirSync(join(dest, "lang"), { recursive: true });

cpSync(join(tesseractDir, "dist", "worker.min.js"), join(dest, "worker.min.js"));
for (const file of CORES) cpSync(join(coreDir, file), join(dest, "core", file));
for (const lang of LANGS) {
  const model = join(dirname(require.resolve(`@tesseract.js-data/${lang}/package.json`)), "4.0.0_best_int", `${lang}.traineddata.gz`);
  if (!existsSync(model)) throw new Error(`[copy-tesseract] нет модели ${model}`);
  cpSync(model, join(dest, "lang", `${lang}.traineddata.gz`));
}
console.log("[copy-tesseract] готово → public/tesseract");
