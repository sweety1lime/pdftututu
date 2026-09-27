import { describe, expect, it } from "vitest";
import ru from "@/messages/ru.json";
import { relatedTools, searchTools, TOOLS, type Tool } from "@/lib/tools";

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

describe("поиск инструментов", () => {
  const text = ({ id }: Tool) => `${ru.tools[id].title} ${ru.tools[id].description}`;
  const ids = (query: string) => searchTools(query, text).map((t) => t.id);

  it("пустой запрос — все инструменты", () => {
    expect(ids("  ")).toHaveLength(TOOLS.length);
  });

  it("без учёта регистра и «ё»", () => {
    expect(ids("ЧЕРНО-БЕЛЫЙ")).toEqual(["grayscale"]);
  });

  it("нужны все слова запроса, в названии или в описании", () => {
    expect(ids("пароль")).toEqual(expect.arrayContaining(["protect", "unlock"]));
    expect(ids("сжать качества")).toEqual(["compress"]);
    expect(ids("сжать подпись")).toEqual([]);
  });
});
