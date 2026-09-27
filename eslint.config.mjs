import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // pdf-lib (~570 КБ) и fontkit (~370 КБ) не должны попадать в первую загрузку страниц:
    // интерфейс берёт их через await import(...) в момент действия
    files: ["src/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex:
                "^(@cantoo/(pdf-lib|fontkit)|@/lib/ocr|@/lib/pdf/(load|pages|security|compress|rasterize|redact|scrub|metadata|stamp|grayscale|color|textLayer)|(\\./|@/features/editor/)exportPdf)$",
              allowTypeImports: true,
              message: "Модуль тянет pdf-lib в первую загрузку страницы — импортируйте его через await import(...) (типы можно).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Копии pdf.js и tesseract.js из node_modules (scripts/copy-*.mjs)
    "public/pdfjs/**",
    "public/tesseract/**",
  ]),
]);

export default eslintConfig;
