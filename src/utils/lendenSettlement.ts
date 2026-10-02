export interface HasOldJewelleryValue {
  value: number;
}

export interface LendenSettlementInput {
  grossTotal: number;
  oldJewelleryCredit?: number;
  discount?: number;
  jamaTotal?: number;
}

export interface LendenSettlement {
  grossTotal: number;
  oldJewelleryCredit: number;
  discount: number;
  netPayable: number;
  jamaTotal: number;
  baki: number;
}

export const sumOldJewelleryValues = (items: HasOldJewelleryValue[]): number =>
  items.reduce((sum, item) => sum + item.value, 0);

/**
 * Keeps every Len-Den screen and the bill on the same settlement formula.
 * Validation is intentionally separate so callers can show a useful message
 * instead of silently clamping a customer credit or payment.
 */
export const calculateLendenSettlement = ({
  grossTotal,
  oldJewelleryCredit = 0,
  discount = 0,
  jamaTotal = 0,
}: LendenSettlementInput): LendenSettlement => {
  const netPayable = grossTotal - oldJewelleryCredit - discount;
  return {
    grossTotal,
    oldJewelleryCredit,
    discount,
    netPayable,
    jamaTotal,
    baki: netPayable - jamaTotal,
  };
};
