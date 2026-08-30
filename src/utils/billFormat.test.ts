import { formatWeight, formatRupees, formatBillDate } from "./billFormat";

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
});

describe("formatBillDate", () => {
  it("renders dd/mm/yyyy", () => {
    expect(formatBillDate("2026-08-27T10:30:00.000Z")).toBe("27/08/2026");
  });
});
