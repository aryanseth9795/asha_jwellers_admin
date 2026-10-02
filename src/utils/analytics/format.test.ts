import { formatCompactRupees, formatGrams, formatInr, formatPct, roundGrams } from "./format";

describe("formatCompactRupees", () => {
  it("uses Indian units", () => {
    expect(formatCompactRupees(950)).toBe("950");
    expect(formatCompactRupees(45000)).toBe("45K");
    expect(formatCompactRupees(182500)).toBe("1.8L");
    expect(formatCompactRupees(12000000)).toBe("1.2Cr");
  });

  it("handles zero and negatives", () => {
    expect(formatCompactRupees(0)).toBe("0");
    expect(formatCompactRupees(-150000)).toBe("-1.5L");
  });
});

describe("formatGrams", () => {
  it("shows grams below a kilo and kilos above", () => {
    expect(formatGrams(12.5)).toBe("12.5 g");
    expect(formatGrams(0)).toBe("0 g");
    expect(formatGrams(1250)).toBe("1.25 kg");
  });
});

describe("roundGrams", () => {
  it("rounds to milligrams", () => {
    expect(roundGrams(0.1 + 0.2)).toBe(0.3);
    expect(roundGrams(1.23456)).toBe(1.235);
  });
});

describe("formatInr", () => {
  it("uses Indian grouping with a rupee sign", () => {
    expect(formatInr(182500)).toBe("₹1,82,500");
    expect(formatInr(950)).toBe("₹950");
    expect(formatInr(-5000)).toBe("-₹5,000");
  });
});

describe("formatPct", () => {
  it("rounds to a whole percent", () => {
    expect(formatPct(0.1234)).toBe("12%");
    expect(formatPct(1)).toBe("100%");
    expect(formatPct(-0.4)).toBe("-40%");
  });
});
