import { toHindiWords, toHindiRupeesWords } from "./hindiNumberWords";

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

  it("has an entry for every value 0-99", () => {
    for (let i = 0; i <= 99; i++) {
      expect(toHindiWords(i)).not.toBe("");
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
