import { describe, expect, it } from "vitest";
import { groupPieces, joinPieces, type Piece } from "@/lib/pdf/textLines";

const piece = (text: string, x: number, right: number, baseline: number, fontSize = 12): Piece => ({
  text,
  x,
  right,
  baseline,
  top: baseline - fontSize * 0.8,
  bottom: baseline + fontSize * 0.2,
  fontSize,
  fontName: "",
});

const lines = (pieces: Piece[]) => groupPieces(pieces).map(joinPieces);

describe("сборка строк из кусков текста", () => {
  it("слова с чуть разной базовой линией — одна строка в правильном порядке", () => {
    // Так OCR расставил слова скана в CI: первое слово на полпункта ниже остальных
    const pieces = [
      piece("SCANNED", 40, 380, 100.4, 60),
      piece("TEXT", 400, 560, 100.0, 60),
      piece("42", 580, 650, 100.1, 60),
    ];
    expect(lines(pieces)).toEqual(["SCANNED TEXT 42"]);
  });

  it("разные строки и колонки не склеиваются", () => {
    const pieces = [
      piece("Вторая строка", 72, 180, 130),
      piece("Левая колонка", 72, 180, 100),
      piece("Правая колонка", 320, 430, 100),
    ];
    expect(lines(pieces)).toEqual(["Левая колонка", "Правая колонка", "Вторая строка"]);
  });

  it("куски без промежутка склеиваются без пробела", () => {
    expect(lines([piece("При", 72, 90, 100), piece("вет", 90, 110, 100)])).toEqual(["Привет"]);
  });
});
