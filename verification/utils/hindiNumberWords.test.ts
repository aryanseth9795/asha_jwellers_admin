import { toHindiWords, toHindiRupeesWords } from "../../src/utils/hindiNumberWords";

describe("toHindiWords", () => {
  it.each([
    [0, "शून्य"],
    [1, "एक"],
    [11, "ग्यारह"],
    [19, "उन्नीस"],
    [21, "इक्कीस"],
    [45, "पैंतालीस"],
    [50, "पचास"],
    [51, "इक्यावन"],
    [69, "उनहत्तर"],
    [99, "निन्यानवे"],
    [100, "एक सौ"],
    [750, "सात सौ पचास"],
    [1000, "एक हजार"],
    [50750, "पचास हजार सात सौ पचास"],
    [100000, "एक लाख"],
    [169650, "एक लाख उनहत्तर हजार छह सौ पचास"],
    [10000000, "एक करोड़"],
  ])("converts %i", (input, expected) => {
    expect(toHindiWords(input)).toBe(expected);
  });

  it("gives every value 0-99 a distinct, non-empty Devanagari word", () => {
    const words = Array.from({ length: 100 }, (_, i) => toHindiWords(i));
    // All 100 Hindi number words are distinct, so a duplicate IS a transcription bug
    // (transposition, copy-paste, or a skipped line in the table).
    expect(new Set(words).size).toBe(100);
    for (const word of words) {
      // Devanagari block only — catches mojibake, empty strings and Latin leakage.
      expect(word).toMatch(/^[\u0900-\u097F\s]+$/);
    }
  });

  it("rounds and takes the absolute value of odd inputs", () => {
    expect(toHindiWords(50750.4)).toBe("पचास हजार सात सौ पचास");
    expect(toHindiWords(-50)).toBe("पचास");
  });
});

describe("toHindiRupeesWords", () => {
  it("matches the wording on the reference bill", () => {
    expect(toHindiRupeesWords(50750)).toBe(
      "पचास हजार सात सौ पचास रुपये मात्र",
    );
  });
});
