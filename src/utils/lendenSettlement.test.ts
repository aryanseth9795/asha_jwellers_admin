import {
  calculateLendenSettlement,
  sumOldJewelleryValues,
} from "./lendenSettlement";

describe("Len-Den settlement", () => {
  it("subtracts all old-jewellery credits, discount, and jama from the new sale", () => {
    const oldJewelleryCredit = sumOldJewelleryValues([
      { value: 12000 },
      { value: 8500 },
    ]);

    expect(
      calculateLendenSettlement({
        grossTotal: 75000,
        oldJewelleryCredit,
        discount: 1500,
        jamaTotal: 10000,
      }),
    ).toEqual({
      grossTotal: 75000,
      oldJewelleryCredit: 20500,
      discount: 1500,
      netPayable: 53000,
      jamaTotal: 10000,
      baki: 43000,
    });
  });

  it("keeps the existing calculation when no old jewellery is supplied", () => {
    expect(
      calculateLendenSettlement({ grossTotal: 50000, discount: 5000 }),
    ).toMatchObject({ netPayable: 45000, baki: 45000 });
  });
});
