import {
  formatWeight,
  formatRupees,
  formatBillDate,
  formatMetalPurity,
} from "./billFormat";

describe("formatWeight", () => {
  it("formats grams with three decimals and a milligram sub-line", () => {
    expect(formatWeight(3.5)).toEqual({
      main: "3.500 ग्राम",
      sub: "(3 ग्राम 500 मिली)",
    });
  });

  it("omits the sub-line for whole grams", () => {
    expect(formatWeight(3)).toEqual({ main: "3.000 ग्राम", sub: "" });
  });

  it("handles zero", () => {
    expect(formatWeight(0)).toEqual({ main: "0.000 ग्राम", sub: "" });
  });

  it("sums to three decimals without float drift", () => {
    expect(formatWeight(0.1 + 0.2).main).toBe("0.300 ग्राम");
  });
});

describe("formatRupees", () => {
  it.each([
    [0, "0/-"],
    [750, "750/-"],
    [50750, "50,750/-"],
    [169650, "1,69,650/-"],
    [10000000, "1,00,00,000/-"],
  ])("groups %i in the Indian style", (input, expected) => {
    expect(formatRupees(input)).toBe(expected);
  });

  it("handles NaN defensively", () => {
    expect(formatRupees(NaN)).toBe("0/-");
  });

  it("handles Infinity defensively", () => {
    expect(formatRupees(Infinity)).toBe("0/-");
  });
});

describe("formatBillDate", () => {
  it("renders dd/mm/yyyy", () => {
    expect(formatBillDate("2026-08-27T10:30:00.000Z")).toBe("27/08/2026");
  });

  it("handles invalid dates gracefully", () => {
    expect(formatBillDate("garbage")).toBe("");
  });

  it("renders a plain stored day as that same day, in any timezone", () => {
    // A plain YYYY-MM-DD must be read as a local calendar day; read as UTC midnight it is the previous evening west of UTC.
    expect(formatBillDate("2026-08-27")).toBe("27/08/2026");
    expect(formatBillDate("2026-01-01")).toBe("01/01/2026");
  });

  it("handles an empty value gracefully", () => {
    expect(formatBillDate("")).toBe("");
  });
});

describe("formatMetalPurity", () => {
  it("joins metal and purity", () => {
    expect(formatMetalPurity("gold", "22KT")).toBe("Gold / 22KT");
    expect(formatMetalPurity("silver", "Desi")).toBe("Silver / Desi");
  });

  it("shows whichever part is known", () => {
    expect(formatMetalPurity("silver", null)).toBe("Silver");
    expect(formatMetalPurity(null, "22KT")).toBe("22KT");
  });

  it("is empty when neither is known", () => {
    expect(formatMetalPurity(null, null)).toBe("");
    expect(formatMetalPurity(undefined, undefined)).toBe("");
  });
});
