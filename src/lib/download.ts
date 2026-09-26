import { zipSync, type Zippable } from "fflate";

/** Скачать данные как файл (через временную ссылку). */
export function downloadBlob(data: Uint8Array | Blob, fileName: string, type = "application/pdf") {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Даём браузеру начать скачивание, потом освобождаем память
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export interface NamedFile {
  name: string;
  data: Uint8Array;
}

/** Упаковать файлы в ZIP. PDF/PNG/JPG уже сжаты, поэтому без повторного сжатия. */
export function zipFiles(files: NamedFile[]): Uint8Array {
  const used = new Set<string>();
  const entries: Zippable = {};
  for (const f of files) {
    let name = f.name;
    let i = 2;
    while (used.has(name)) {
      const dot = f.name.lastIndexOf(".");
      name = dot > 0 ? `${f.name.slice(0, dot)} (${i})${f.name.slice(dot)}` : `${f.name} (${i})`;
      i++;
    }
    used.add(name);
    entries[name] = [f.data, { level: 0 }];
  }
  return zipSync(entries);
}

/** Скачать один файл как есть или несколько — ZIP-архивом. */
export function downloadFiles(files: NamedFile[], zipName: string, type = "application/pdf") {
  if (files.length === 1) downloadBlob(files[0].data, files[0].name, type);
  else downloadBlob(zipFiles(files), zipName, "application/zip");
}

/** "report.final.PDF" → "report.final" */
export function baseName(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{1,5}$/i, "") || "document";
}

export function formatBytes(bytes: number, locale = "ru"): string {
  const units = locale === "ru" ? ["Б", "КБ", "МБ", "ГБ"] : ["B", "KB", "MB", "GB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  const digits = i === 0 || v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toLocaleString(locale, { maximumFractionDigits: digits })} ${units[i]}`;
}
