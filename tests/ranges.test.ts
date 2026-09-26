import { describe, expect, it } from "vitest";
import { chunkPages, formatGroup, parsePageRanges } from "@/lib/pdf/ranges";

describe("parsePageRanges", () => {
  it("разбирает одиночные страницы и диапазоны", () => {
    expect(parsePageRanges("1-3, 5", 10)).toEqual({ ok: true, groups: [[0, 1, 2], [4]] });
  });

  it("понимает открытые диапазоны", () => {
    expect(parsePageRanges("8-", 10)).toEqual({ ok: true, groups: [[7, 8, 9]] });
    expect(parsePageRanges("-2", 10)).toEqual({ ok: true, groups: [[0, 1]] });
  });

  it("допускает обратный порядок и лишние пробелы", () => {
    expect(parsePageRanges(" 3 - 1 ;", 5)).toEqual({ ok: true, groups: [[2, 1, 0]] });
  });

  it("сообщает об ошибках", () => {
    expect(parsePageRanges("", 5)).toEqual({ ok: false, error: "empty" });
    expect(parsePageRanges("abc", 5)).toMatchObject({ ok: false, error: "invalid", token: "abc" });
    expect(parsePageRanges("2-9", 5)).toMatchObject({ ok: false, error: "outOfRange", token: "2-9" });
    expect(parsePageRanges("0", 5)).toMatchObject({ ok: false, error: "outOfRange" });
  });
});

describe("chunkPages / formatGroup", () => {
  it("делит на куски по N", () => {
    expect(chunkPages(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("компактно записывает группу", () => {
    expect(formatGroup([0, 1, 2, 4, 6, 7])).toBe("1-3,5,7-8");
  });
});
