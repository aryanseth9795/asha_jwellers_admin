import { AnalyticsData } from "../types";
import { daysBetween, sum } from "../periods";
import { UNKNOWN_VILLAGE, VillageGroups, villageOfUser } from "../villages";
import { hasPhoto } from "./pledges";

export interface BillFlag {
  label: string;
  severity: "red" | "grey"; // red needs a decision; grey is information
}

export interface BillRow {
  id: number;
  billNo: number | null;
  userId: number;
  customer: string;
  village: string;
  onFile: boolean;
  date: string;
  gross: number;
  discount: number;
  net: number;
  received: number; // jama entries, or legacy jama
  collected: number; // net − baki (spec §12.3)
  pending: number; // baki on open bills
  open: boolean;
  daysOpen: number | null; // open bills with a balance
  overridden: boolean;
  photo: boolean;
  flags: BillFlag[];
}

export interface BillingSummary {
  bills: number;
  withBalance: number;
  gross: number;
  discount: number;
  discountPct: number;
  net: number;
  collected: number;
  collectedPct: number;
  pending: number;
  pendingOffFilePct: number; // share of pending on customers not on file
}

export interface BillGroup {
  bills: number;
  gross: number;
  net: number;
  avgNet: number;
  discountRate: number;
  collectedShare: number;
  pending: number;
  customers: number;
  withPhoto: number;
  from: string | null;
  to: string | null;
}

export const buildBillRows = (data: AnalyticsData, groups: VillageGroups, now: Date = new Date()): BillRow[] => {
  const users = new Map(data.users.map((u) => [u.id, u]));
  const entries = new Map<number, number>();
  for (const j of data.jama) entries.set(j.lendenId, (entries.get(j.lendenId) ?? 0) + j.amount);
  const nowIso = now.toISOString();
  return data.lenden
    .map((b) => {
      const user = users.get(b.userId);
      const gross = b.amount ?? 0;
      const discount = b.discount ?? 0;
      const net = b.remaining ?? gross - discount;
      const baki = b.baki ?? 0;
      const open = (b.status ?? 0) === 0;
      const collected = Math.max(0, net - baki);
      const received = entries.has(b.id) ? (entries.get(b.id) as number) : b.jama ?? 0;
      const pending = open ? baki : 0;
      const flags: BillFlag[] = [];
      if (!user) flags.push({ label: "Customer not on file", severity: "red" });
      if (received === 0 && collected > 0) flags.push({ label: "Received field blank", severity: "red" });
      else if (received > 0 && received < collected) flags.push({ label: "Received field short", severity: "red" });
      if (b.amountOverridden === 1) flags.push({ label: "Amount overridden", severity: "grey" });
      if (b.billNo == null) flags.push({ label: "No bill number", severity: "grey" });
      return {
        id: b.id,
        billNo: b.billNo ?? null,
        userId: b.userId,
        customer: user?.name ?? `Customer #${b.userId}`,
        village: user ? villageOfUser(groups, b.userId) : UNKNOWN_VILLAGE,
        onFile: !!user,
        date: b.date,
        gross,
        discount,
        net,
        received,
        collected,
        pending,
        open,
        daysOpen: open && pending > 0 ? Math.max(0, daysBetween(b.date, nowIso)) : null,
        overridden: b.amountOverridden === 1,
        photo: hasPhoto(b.media),
        flags,
      };
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
};

export const billLabel = (row: BillRow): string => (row.billNo != null ? `#${row.billNo}` : `ID ${row.id}`);

export const billingSummary = (rows: BillRow[]): BillingSummary => {
  const gross = sum(rows.map((r) => r.gross));
  const discount = sum(rows.map((r) => r.discount));
  const net = sum(rows.map((r) => r.net));
  const collected = sum(rows.map((r) => r.collected));
  const pending = sum(rows.map((r) => r.pending));
  const offFile = sum(rows.filter((r) => !r.onFile).map((r) => r.pending));
  return {
    bills: rows.length,
    withBalance: rows.filter((r) => r.pending > 0).length,
    gross,
    discount,
    discountPct: gross ? discount / gross : 0,
    net,
    collected,
    collectedPct: net ? collected / net : 0,
    pending,
    pendingOffFilePct: pending ? offFile / pending : 0,
  };
};

export const waterfall = (s: BillingSummary) => [
  { label: "Gross billed", value: s.gross },
  { label: "Discount", value: s.discount },
  { label: "Net billed", value: s.net },
  { label: "Collected", value: s.collected },
  { label: "Pending dues", value: s.pending },
];

const oldestFirst = (rows: BillRow[]) =>
  [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || a.id - b.id);

export const discountPerBill = (rows: BillRow[]) => ({
  bills: oldestFirst(rows).map((r) => ({ label: billLabel(r), pct: r.gross ? r.discount / r.gross : 0 })),
  weighted: billingSummary(rows).discountPct,
});

const groupOf = (rows: BillRow[]): BillGroup => {
  const s = billingSummary(rows);
  const sorted = oldestFirst(rows);
  return {
    bills: s.bills,
    gross: s.gross,
    net: s.net,
    avgNet: s.bills ? s.net / s.bills : 0,
    discountRate: s.discountPct,
    collectedShare: s.collectedPct,
    pending: s.pending,
    customers: new Set(rows.map((r) => r.userId)).size,
    withPhoto: rows.filter((r) => r.photo).length,
    from: sorted[0]?.date ?? null,
    to: sorted[sorted.length - 1]?.date ?? null,
  };
};

export const numberedVsEarlier = (rows: BillRow[]) => ({
  numbered: groupOf(rows.filter((r) => r.billNo != null)),
  earlier: groupOf(rows.filter((r) => r.billNo == null)),
});
