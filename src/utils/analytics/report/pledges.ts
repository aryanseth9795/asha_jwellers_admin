import { AnalyticsData, RehanTxRow } from "../types";
import { daysBetween } from "../periods";
import { principalOf } from "../rehan";
import { VillageGroups, UNKNOWN_VILLAGE, groupVillages, villageOfUser } from "../villages";
import { isBundle, itemTypeOf } from "./items";

/** One rehan entry, enriched for the report (spec §12.2). */
export interface PledgeRow {
  id: number;
  userId: number;
  openDate: string;
  closedDate: string | null;
  open: boolean;
  principal: number; // amount lent
  balance: number; // current running balance
  name: string; // product name as typed
  item: string; // item type
  bundle: boolean;
  village: string;
  onFile: boolean; // customer exists in users
  photo: boolean;
  daysOpen: number | null; // open pledges only
  daysToRedeem: number | null; // redeemed pledges only
  year: string; // year opened, e.g. "2026"
  month: string; // month opened, e.g. "2026-01"
  weekday: number; // day opened, 0 = Sunday
}

export interface PledgeFilters {
  village: string; // "all" or a grouped village
  item: string; // "all" or an item type
  year: string; // "all" or "2026"
  status: "all" | "open" | "redeemed";
}

export const ALL_PLEDGES: PledgeFilters = { village: "all", item: "all", year: "all", status: "all" };

/** A non-empty JSON array of image paths; anything else (empty, "[]", bad JSON) is no photo. */
export const hasPhoto = (media: string | null | undefined): boolean => {
  if (!media) return false;
  try {
    const value = JSON.parse(media);
    return Array.isArray(value) && value.length > 0;
  } catch {
    return false;
  }
};

const pad = (n: number) => String(n).padStart(2, "0");

export const buildPledgeRows = (
  data: AnalyticsData,
  now: Date = new Date(),
  groups: VillageGroups = groupVillages(data.users),
): PledgeRow[] => {
  const onFile = new Set(data.users.map((u) => u.id));
  const txByRehan = new Map<number, RehanTxRow[]>();
  for (const tx of data.rehanTx) {
    const list = txByRehan.get(tx.rehanId) ?? [];
    list.push(tx);
    txByRehan.set(tx.rehanId, list);
  }
  const nowIso = now.toISOString();
  return data.rehan.map((r) => {
    const opened = new Date(r.openDate);
    const open = (r.status ?? 0) === 0;
    return {
      id: r.id,
      userId: r.userId,
      openDate: r.openDate,
      closedDate: r.closedDate,
      open,
      principal: principalOf(r, txByRehan.get(r.id) ?? []),
      balance: r.amount ?? 0,
      name: r.productName ?? "",
      item: r.category?.trim() || itemTypeOf(r.productName),
      bundle: isBundle(r.productName),
      village: onFile.has(r.userId) ? villageOfUser(groups, r.userId) : UNKNOWN_VILLAGE,
      onFile: onFile.has(r.userId),
      photo: hasPhoto(r.media),
      daysOpen: open ? Math.max(0, daysBetween(r.openDate, nowIso)) : null,
      daysToRedeem: !open && r.closedDate ? daysBetween(r.openDate, r.closedDate) : null,
      year: String(opened.getFullYear()),
      month: `${opened.getFullYear()}-${pad(opened.getMonth() + 1)}`,
      weekday: opened.getDay(),
    };
  });
};

/** Applies the report filters; `ignore` drops one dimension (for rankings). */
export const filterPledges = (
  rows: PledgeRow[],
  f: PledgeFilters,
  ignore?: "village" | "item",
): PledgeRow[] =>
  rows.filter(
    (r) =>
      (ignore === "village" || f.village === "all" || r.village === f.village) &&
      (ignore === "item" || f.item === "all" || r.item === f.item) &&
      (f.year === "all" || r.year === f.year) &&
      (f.status === "all" || (f.status === "open") === r.open),
  );

export const filterOptions = (rows: PledgeRow[], groups: VillageGroups) => {
  const principalByItem = new Map<string, number>();
  for (const r of rows) principalByItem.set(r.item, (principalByItem.get(r.item) ?? 0) + r.principal);
  const withPledges = new Set(rows.map((r) => r.village));
  const villages = groups.order.filter((v) => withPledges.has(v));
  if (rows.some((r) => r.village === UNKNOWN_VILLAGE) && !villages.includes(UNKNOWN_VILLAGE)) {
    villages.push(UNKNOWN_VILLAGE);
  }
  return {
    villages,
    items: [...principalByItem]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([item]) => item),
    years: [...new Set(rows.map((r) => r.year))].sort(),
  };
};
