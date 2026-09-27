// Модели для этих языков копирует scripts/copy-tesseract.mjs — списки должны совпадать.
// Отдельно от ocr.ts: список нужен интерфейсу, а тот модуль тянет pdf-lib
export const OCR_LANGUAGES = [
  { code: "rus", label: "Русский" },
  { code: "eng", label: "English" },
  { code: "ukr", label: "Українська" },
  { code: "deu", label: "Deutsch" },
  { code: "fra", label: "Français" },
  { code: "spa", label: "Español" },
] as const;
