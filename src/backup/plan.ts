/**
 * Merge planner (backup spec §6.1). Pure: compares a parsed backup with a snapshot of the phone and says which rows
 * to insert, which are already there, and which differ (those stay as they are on the phone).
 */
import {
  BackupData,
  LocalSnapshot,
  MergePlan,
  TABLE_KEYS,
  TableKey,
  emptySummary,
} from "./format";

export const countRows = (data: BackupData): Record<TableKey, number> =>
  Object.fromEntries(TABLE_KEYS.map((k) => [k, data[k].length])) as Record<TableKey, number>;

const emptyData = (): BackupData => ({
  customers: [],
  rehan: [],
  rehanTransactions: [],
  lenden: [],
  lendenItems: [],
  oldJewellery: [],
  jamaEntries: [],
});

/** null and undefined are the same "no value". */
const eq = (a: unknown, b: unknown): boolean => (a ?? null) === (b ?? null);

const indexBy = <T extends { uuid: string }>(rows: T[]): Map<string, T> => new Map(rows.map((r) => [r.uuid, r]));

export const planMerge = (backup: BackupData, local: LocalSnapshot): MergePlan => {
  // Local customer links are resolved through the numeric ids; an unknown userId gives null.
  const customerUuidById = new Map(local.customers.map((c) => [c.id, c.uuid]));

  const localCustomers = indexBy(local.customers);
  const localRehan = indexBy(local.rehan);
  const localLenden = indexBy(local.lenden);
  const localTx = indexBy(local.rehanTransactions);
  const localItems = indexBy(local.lendenItems);
  const localOld = indexBy(local.oldJewellery);
  const localJama = indexBy(local.jamaEntries);

  const localRehanCustomer = (r: { userId: number }) => customerUuidById.get(r.userId) ?? null;

  const summary = emptySummary();
  const insert = emptyData();
  const applyToBalance: string[] = [];
  const recomputeLenden: string[] = [];
  const conflicts: MergePlan["conflicts"] = [];

  const mark = (table: TableKey, uuid: string, result: "insert" | "same" | "conflict") => {
    summary[table].total += 1;
    summary[table][result] += 1;
    if (result === "conflict") conflicts.push({ table, uuid });
  };
  const addRecompute = (lendenUuid: string) => {
    if (!recomputeLenden.includes(lendenUuid)) recomputeLenden.push(lendenUuid);
  };

  // Customers
  for (const c of backup.customers) {
    const l = localCustomers.get(c.uuid);
    if (!l) {
      insert.customers.push(c);
      mark("customers", c.uuid, "insert");
    } else if (
      eq(l.name, c.name) &&
      eq(l.address, c.address) &&
      eq(l.mobileNumber, c.mobileNumber) &&
      eq(l.nickname, c.nickname) &&
      eq(l.createdAt, c.createdAt)
    ) {
      mark("customers", c.uuid, "same");
    } else {
      mark("customers", c.uuid, "conflict");
    }
  }

  // Rehan
  for (const r of backup.rehan) {
    const l = localRehan.get(r.uuid);
    if (!l) {
      insert.rehan.push(r);
      mark("rehan", r.uuid, "insert");
    } else if (
      eq(localRehanCustomer(l), r.customerUuid) &&
      eq(l.productName, r.productName) &&
      eq(l.category, r.category) &&
      eq(l.status, r.status) &&
      eq(l.openDate, r.openDate) &&
      eq(l.closedDate, r.closedDate)
    ) {
      mark("rehan", r.uuid, "same");
    } else {
      mark("rehan", r.uuid, "conflict");
    }
  }

  // Rehan transactions
  for (const t of backup.rehanTransactions) {
    const parentPresent = localRehan.has(t.rehanUuid);
    const l = localTx.get(t.uuid);
    if (!l) {
      insert.rehanTransactions.push(t);
      mark("rehanTransactions", t.uuid, "insert");
      // A transaction under a new rehan arrives with that rehan's stored balance; only a present rehan needs it applied.
      if (parentPresent) applyToBalance.push(t.uuid);
    } else if (eq(l.type, t.type) && eq(l.amount, t.amount) && eq(l.date, t.date)) {
      mark("rehanTransactions", t.uuid, "same");
    } else {
      mark("rehanTransactions", t.uuid, "conflict");
    }
  }

  // Len-den
  for (const d of backup.lenden) {
    const l = localLenden.get(d.uuid);
    if (!l) {
      insert.lenden.push(d);
      mark("lenden", d.uuid, "insert");
    } else if (
      eq(customerUuidById.get(l.userId) ?? null, d.customerUuid) &&
      eq(l.date, d.date) &&
      eq(l.amount, d.amount) &&
      eq(l.discount, d.discount) &&
      eq(l.remaining, d.remaining) &&
      eq(l.status, d.status) &&
      eq(l.billNo, d.billNo) &&
      eq(l.amountOverridden, d.amountOverridden)
    ) {
      mark("lenden", d.uuid, "same");
    } else {
      mark("lenden", d.uuid, "conflict");
    }
  }

  // Items and old jewellery: inserted only with a new len-den; never added to a present one.
  for (const [table, rows, localRows] of [
    ["lendenItems", backup.lendenItems, localItems],
    ["oldJewellery", backup.oldJewellery, localOld],
  ] as const) {
    for (const row of rows) {
      const exists = localRows.has(row.uuid);
      if (!localLenden.has(row.lendenUuid)) {
        if (!exists) {
          (insert[table] as typeof rows).push(row as never);
          mark(table, row.uuid, "insert");
        } else {
          mark(table, row.uuid, "same");
        }
      } else {
        mark(table, row.uuid, exists ? "same" : "conflict");
      }
    }
  }

  // Jama entries
  for (const j of backup.jamaEntries) {
    const parentPresent = localLenden.has(j.lendenUuid);
    const l = localJama.get(j.uuid);
    if (!l) {
      insert.jamaEntries.push(j);
      mark("jamaEntries", j.uuid, "insert");
      if (parentPresent) addRecompute(j.lendenUuid);
    } else if (eq(l.amount, j.amount) && eq(l.date, j.date)) {
      mark("jamaEntries", j.uuid, "same");
    } else {
      mark("jamaEntries", j.uuid, "conflict");
    }
  }

  // Bill numbers of inserted bills that another bill on the phone already uses.
  const localBillOwners = new Map<number, Set<string>>();
  for (const l of local.lenden) {
    if (l.billNo === null || l.billNo === undefined) continue;
    const owners = localBillOwners.get(l.billNo) ?? new Set<string>();
    owners.add(l.uuid);
    localBillOwners.set(l.billNo, owners);
  }
  const clashes = new Set<number>();
  for (const d of insert.lenden) {
    if (d.billNo === null || d.billNo === undefined) continue;
    const owners = localBillOwners.get(d.billNo);
    if (owners && [...owners].some((uuid) => uuid !== d.uuid)) clashes.add(d.billNo);
  }

  return {
    summary,
    insert,
    applyToBalance,
    recomputeLenden,
    conflicts,
    billNoClashes: [...clashes].sort((a, b) => a - b),
  };
};
