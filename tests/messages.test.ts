import { describe, expect, it } from "vitest";
import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import { TOOLS } from "@/lib/tools";

/** Все пути к строкам: "tools.merge.title", "guide.common" (массивы — целиком). */
function keys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}

describe("переводы", () => {
  it("в ru и en одинаковые ключи", () => {
    expect(keys(en).sort()).toEqual(keys(ru).sort());
  });

  it("у каждого инструмента есть название, описание и инструкция", () => {
    for (const messages of [ru, en] as const) {
      for (const { id } of TOOLS) {
        const tool = (messages.tools as Record<string, { title?: string; description?: string }>)[id];
        const guide = (messages.guide.tools as Record<string, { steps?: string[]; faq?: unknown[] }>)[id];
        expect(tool?.title, id).toBeTruthy();
        expect(tool?.description, id).toBeTruthy();
        expect(guide?.steps, id).toHaveLength(3);
        expect(guide?.faq?.length, id).toBeGreaterThan(0);
      }
    }
  });
});
