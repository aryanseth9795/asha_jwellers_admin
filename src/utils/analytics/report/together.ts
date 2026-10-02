import { sum } from "../periods";
import { BillRow } from "./billing";
import { PledgeRow } from "./pledges";

export interface LedgerScale {
  openBook: number;
  redeemedPrincipal: number;
  netBilled: number;
  pending: number;
  ratio: number | null; // open book ÷ net billed
}

export interface VillageShare {
  village: string;
  pledgeShare: number; // of pledge principal
  billShare: number; // of net billed
}

export const ledgerScale = (pledges: PledgeRow[], bills: BillRow[]): LedgerScale => {
  const openBook = sum(pledges.filter((p) => p.open).map((p) => p.principal));
  const netBilled = sum(bills.map((b) => b.net));
  return {
    openBook,
    redeemedPrincipal: sum(pledges.filter((p) => !p.open).map((p) => p.principal)),
    netBilled,
    pending: sum(bills.map((b) => b.pending)),
    ratio: netBilled ? openBook / netBilled : null,
  };
};

/** Each village as a share of its own ledger, so the two can be compared side by side. */
export const villageShares = (pledges: PledgeRow[], bills: BillRow[], order: string[]): VillageShare[] => {
  const principal = sum(pledges.map((p) => p.principal));
  const net = sum(bills.map((b) => b.net));
  const extra = [...new Set([...pledges.map((p) => p.village), ...bills.map((b) => b.village)])].filter(
    (v) => !order.includes(v),
  );
  return [...order, ...extra].map((village) => ({
    village,
    pledgeShare: principal ? sum(pledges.filter((p) => p.village === village).map((p) => p.principal)) / principal : 0,
    billShare: net ? sum(bills.filter((b) => b.village === village).map((b) => b.net)) / net : 0,
  }));
};
