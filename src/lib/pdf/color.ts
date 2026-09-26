import { rgb, type RGB } from "@cantoo/pdf-lib";

/** "#rgb" | "#rrggbb" → [r, g, b] 0..255 */
export function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.replace(/(.)/g, "$1$1");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgb(hex: string): RGB {
  const [r, g, b] = parseHex(hex);
  return rgb(r / 255, g / 255, b / 255);
}

export function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}
