import { describe, expect, it } from "vitest";
import { relatedTools, TOOLS } from "@/lib/tools";

describe("другие инструменты", () => {
  it("для каждого — 4 разных, без него самого, сначала из той же группы", () => {
    for (const tool of TOOLS) {
      const related = relatedTools(tool.id);
      expect(related).toHaveLength(4);
      expect(new Set(related).size).toBe(4);
      expect(related).not.toContain(tool);
      const sameGroup = TOOLS.filter((t) => t.group === tool.group && t !== tool).length;
      expect(related.slice(0, Math.min(sameGroup, 4)).every((t) => t.group === tool.group)).toBe(true);
    }
  });
});
