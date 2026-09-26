/**
 * Парсер строк вида "1-3, 5, 8-" → группы 0-based индексов страниц.
 * "8-" означает «с 8-й до конца», "-3" — «с первой по 3-ю».
 */
export type RangeParseResult =
  | { ok: true; groups: number[][] }
  | { ok: false; error: "empty" | "invalid" | "outOfRange"; token?: string };

export function parsePageRanges(input: string, pageCount: number): RangeParseResult {
  const tokens = input
    .split(/[,;]/)
    .map((t) => t.replace(/\s+/g, ""))
    .filter(Boolean);
  if (tokens.length === 0) return { ok: false, error: "empty" };

  const groups: number[][] = [];
  for (const token of tokens) {
    const m = /^(\d*)[-–—](\d*)$/.exec(token);
    let from: number;
    let to: number;
    if (m) {
      if (!m[1] && !m[2]) return { ok: false, error: "invalid", token };
      from = m[1] ? Number(m[1]) : 1;
      to = m[2] ? Number(m[2]) : pageCount;
    } else if (/^\d+$/.test(token)) {
      from = to = Number(token);
    } else {
      return { ok: false, error: "invalid", token };
    }
    if (from < 1 || to < 1 || from > pageCount || to > pageCount) {
      return { ok: false, error: "outOfRange", token };
    }
    const group: number[] = [];
    const step = from <= to ? 1 : -1;
    for (let p = from; step > 0 ? p <= to : p >= to; p += step) group.push(p - 1);
    groups.push(group);
  }
  return { ok: true, groups };
}

/** Разбить документ на куски по N страниц. */
export function chunkPages(pageCount: number, size: number): number[][] {
  const n = Math.max(1, Math.floor(size));
  const out: number[][] = [];
  for (let i = 0; i < pageCount; i += n) {
    out.push(Array.from({ length: Math.min(n, pageCount - i) }, (_, k) => i + k));
  }
  return out;
}

/** Компактная запись группы индексов: [0,1,2,4] → "1-3,5". */
export function formatGroup(group: number[]): string {
  const parts: string[] = [];
  let i = 0;
  while (i < group.length) {
    let j = i;
    while (j + 1 < group.length && group[j + 1] === group[j] + 1) j++;
    parts.push(j > i ? `${group[i] + 1}-${group[j] + 1}` : `${group[i] + 1}`);
    i = j + 1;
  }
  return parts.join(",");
}
