import {
  resolveEffectiveAmount,
  sumItemTotals,
  isAmountOverridden,
} from "../../src/utils/lendenAmount";

describe("sumItemTotals", () => {
  it("sums totals", () => {
    expect(sumItemTotals([{ total: 50750 }, { total: 118900 }])).toBe(169650);
  });

  it("returns 0 for an empty list", () => {
    expect(sumItemTotals([])).toBe(0);
  });
});

describe("resolveEffectiveAmount", () => {
  it("sums the items when there are items and no override", () => {
    const lenden = { amount: 999, amountOverridden: 0 };
    const items = [{ total: 50750 }, { total: 118900 }];
    expect(resolveEffectiveAmount(lenden, items)).toBe(169650);
  });

  it("uses the stored amount when overridden", () => {
    const lenden = { amount: 169000, amountOverridden: 1 };
    const items = [{ total: 50750 }, { total: 118900 }];
    expect(resolveEffectiveAmount(lenden, items)).toBe(169000);
  });

  // The regression that would destroy every historical entry.
  it("NEVER zeroes a legacy entry that has no items", () => {
    const legacy = { amount: 45000, amountOverridden: 0 };
    expect(resolveEffectiveAmount(legacy, [])).toBe(45000);
  });

  it("survives a null amount", () => {
    expect(resolveEffectiveAmount({ amount: null }, [])).toBe(0);
    expect(resolveEffectiveAmount({}, [])).toBe(0);
  });
});

describe("isAmountOverridden", () => {
  it("is true when the typed amount differs from the item sum", () => {
    expect(isAmountOverridden({ amount: 50000 }, [{ total: 50750 }])).toBe(true);
  });

  it("is false when the typed amount equals the item sum", () => {
    expect(isAmountOverridden({ amount: 50750 }, [{ total: 50750 }])).toBe(
      false,
    );
  });

  it("is false when there are no items to compare against", () => {
    expect(isAmountOverridden({ amount: 50000 }, [])).toBe(false);
  });
});
