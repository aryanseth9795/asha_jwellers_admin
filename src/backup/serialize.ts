import { fnv1a } from "./checksum";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupData,
  CustomerRow,
  DATA_FILES,
  JamaEntryRow,
  LendenItemRow,
  LendenRow,
  LocalSnapshot,
  Manifest,
  ManifestFileEntry,
  OldJewelleryRow,
  RehanRow,
  RehanTransactionRow,
  TABLE_KEYS,
  TableKey,
} from "./format";

export interface SerializeResult {
  /** zip-relative path → exact JSON text written to the zip */
  files: Record<string, string>;
  manifest: Manifest;
  /** photos to copy into the staging folder: absolute phone path → zip-relative path */
  mediaCopies: { from: string; to: string }[];
}

/** Table names as used in the user-visible warnings. */
const TABLE_LABEL: Record<TableKey, string> = {
  customers: "customers",
  rehan: "rehan",
  rehanTransactions: "rehan_transactions",
  lenden: "lenden",
  lendenItems: "lenden_items",
  oldJewellery: "lenden_old_jewellery_items",
  jamaEntries: "jama_entries",
};

const baseName = (path: string): string => {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || "photo";
};

export const serializeSnapshot = (
  snapshot: LocalSnapshot,
  options: { createdAt: string; mediaExists: (absolutePath: string) => boolean },
): SerializeResult => {
  const mediaCopies: { from: string; to: string }[] = [];
  let missing = 0;
  const droppedRows: Partial<Record<TableKey, number>> = {};
  const drop = (table: TableKey) => {
    droppedRows[table] = (droppedRows[table] ?? 0) + 1;
  };

  const customerUuid = new Map(snapshot.customers.map((c) => [c.id, c.uuid]));
  const rehanUuid = new Map(snapshot.rehan.map((r) => [r.id, r.uuid]));
  const lendenUuid = new Map(snapshot.lenden.map((l) => [l.id, l.uuid]));

  /** Copies the photos that still exist and returns their zip-relative paths, in order. */
  const exportMedia = (recordUuid: string, paths: string[]): string[] => {
    const out: string[] = [];
    for (const from of paths) {
      if (!options.mediaExists(from)) {
        missing++;
        continue;
      }
      const to = `media/${recordUuid}/${out.length + 1}-${baseName(from)}`;
      mediaCopies.push({ from, to });
      out.push(to);
    }
    return out;
  };

  const customers: CustomerRow[] = snapshot.customers.map((c) => ({
    uuid: c.uuid,
    name: c.name,
    address: c.address,
    mobileNumber: c.mobileNumber,
    nickname: c.nickname,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  const rehan: RehanRow[] = snapshot.rehan.map((r) => ({
    uuid: r.uuid,
    customerUuid: customerUuid.get(r.userId) ?? null,
    productName: r.productName,
    amount: r.amount,
    status: r.status,
    openDate: r.openDate,
    closedDate: r.closedDate,
    media: exportMedia(r.uuid, r.media),
    updatedAt: r.updatedAt,
  }));

  const rehanTransactions: RehanTransactionRow[] = [];
  for (const t of snapshot.rehanTransactions) {
    const parent = rehanUuid.get(t.rehanId);
    if (!parent) {
      drop("rehanTransactions");
      continue;
    }
    rehanTransactions.push({
      uuid: t.uuid,
      rehanUuid: parent,
      type: t.type,
      amount: t.amount,
      date: t.date,
      updatedAt: t.updatedAt,
    });
  }

  const lenden: LendenRow[] = snapshot.lenden.map((l) => ({
    uuid: l.uuid,
    customerUuid: customerUuid.get(l.userId) ?? null,
    date: l.date,
    amount: l.amount,
    discount: l.discount,
    remaining: l.remaining,
    jama: l.jama,
    baki: l.baki,
    status: l.status,
    billNo: l.billNo,
    amountOverridden: l.amountOverridden,
    media: exportMedia(l.uuid, l.media),
    updatedAt: l.updatedAt,
  }));

  const lendenItems: LendenItemRow[] = [];
  for (const i of snapshot.lendenItems) {
    const parent = lendenUuid.get(i.lendenId);
    if (!parent) {
      drop("lendenItems");
      continue;
    }
    lendenItems.push({
      uuid: i.uuid,
      lendenUuid: parent,
      position: i.position,
      name: i.name,
      metal: i.metal,
      purity: i.purity,
      weight: i.weight,
      qty: i.qty,
      rate: i.rate,
      total: i.total,
      updatedAt: i.updatedAt,
    });
  }

  const oldJewellery: OldJewelleryRow[] = [];
  for (const o of snapshot.oldJewellery) {
    const parent = lendenUuid.get(o.lendenId);
    if (!parent) {
      drop("oldJewellery");
      continue;
    }
    oldJewellery.push({
      uuid: o.uuid,
      lendenUuid: parent,
      position: o.position,
      description: o.description,
      metal: o.metal,
      purity: o.purity,
      weight: o.weight,
      value: o.value,
      updatedAt: o.updatedAt,
    });
  }

  const jamaEntries: JamaEntryRow[] = [];
  for (const j of snapshot.jamaEntries) {
    const parent = lendenUuid.get(j.lendenId);
    if (!parent) {
      drop("jamaEntries");
      continue;
    }
    jamaEntries.push({ uuid: j.uuid, lendenUuid: parent, amount: j.amount, date: j.date, updatedAt: j.updatedAt });
  }

  const data: BackupData = { customers, rehan, rehanTransactions, lenden, lendenItems, oldJewellery, jamaEntries };

  const files: Record<string, string> = {};
  const manifestFiles: Record<string, ManifestFileEntry> = {};
  for (const key of TABLE_KEYS) {
    const path = DATA_FILES[key];
    const text = JSON.stringify(data[key], null, 2);
    files[path] = text;
    manifestFiles[path] = { count: data[key].length, checksum: fnv1a(text) };
  }

  const warnings: string[] = [];
  for (const key of TABLE_KEYS) {
    const n = droppedRows[key];
    if (n) warnings.push(`${n} ${TABLE_LABEL[key]} rows had no parent record and were left out`);
  }
  if (missing > 0) {
    warnings.push(`${missing} photos listed on records were not found on the phone and were left out`);
  }

  const manifest: Manifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: options.createdAt,
    files: manifestFiles,
    media: { count: mediaCopies.length, missing },
    warnings,
  };

  return { files, manifest, mediaCopies };
};
