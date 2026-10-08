import { BUSINESSES, ROUTE_BUSINESS, businessById, headerColorFor } from "../../src/navigation/menus";
import { colors } from "../../src/ui/theme";

describe("business menus (UI revamp spec §4)", () => {
  it("offers Asha Jewellers first, then SSJ", () => {
    expect(BUSINESSES.map((b) => [b.id, b.name, b.hubRoute])).toEqual([
      ["aj", "Asha Jewellers", "AshaHome"],
      ["ssj", "SSJ", "SsjHome"],
    ]);
  });
  it("gives Asha Jewellers the customer flows and analytics", () => {
    expect(businessById("aj").items.map((i) => [i.label, i.route])).toEqual([
      ["Existing Customer", "ExistingCustomers"],
      ["New Customer", "NewCustomer"],
      ["Analytics", "Analytics"],
    ]);
  });
  it("gives SSJ bhav, categories and products", () => {
    expect(businessById("ssj").items.map((i) => [i.label, i.route])).toEqual([
      ["Update Bhav", "UpdateBhav"],
      ["Category", "CategoryList"],
      ["Product", "ProductList"],
    ]);
  });
  it("assigns each menu and its items to its own business", () => {
    for (const b of BUSINESSES) {
      expect(ROUTE_BUSINESS[b.hubRoute]).toBe(b.id);
      for (const item of b.items) expect(ROUTE_BUSINESS[item.route]).toBe(b.id);
    }
  });
  it("keeps the deep customer flows under Asha Jewellers and catalogue edits under SSJ", () => {
    for (const r of ["UserTransactions", "AddTransaction", "TransactionDetail", "BillPreview"] as const) {
      expect(ROUTE_BUSINESS[r]).toBe("aj");
    }
    for (const r of ["AddEditCategory", "AddEditProduct"] as const) expect(ROUTE_BUSINESS[r]).toBe("ssj");
  });
  it("colours headers navy for Asha Jewellers and maroon for SSJ", () => {
    expect(headerColorFor("TransactionDetail")).toBe(colors.ajNavy);
    expect(headerColorFor("AddEditProduct")).toBe(colors.ssjMaroon);
    expect(headerColorFor("Home")).toBe(colors.ajNavy);
  });
  it("uses unique menu keys", () => {
    const keys = BUSINESSES.flatMap((b) => b.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
