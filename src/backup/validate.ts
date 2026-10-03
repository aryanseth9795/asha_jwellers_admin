/**
 * Validation of a parsed backup (backup spec §6). Pure: reads text and sets, writes nothing.
 */
import { fnv1a } from "./checksum";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupData,
  DATA_FILES,
  Manifest,
  TABLE_KEYS,
  TableKey,
  UUID_RE,
} from "./format";

const MAX_MESSAGES = 5;

type Kind = "str" | "strN" | "text" | "num" | "numN" | "media";
type Spec = Record<string, Kind>;

/**
 * Field kinds per table (uuid and relationship fields are checked separately).
 *  str: non-empty string · text: any string · strN: string or null · num: finite number · numN: number or null
 */
const SPECS: Record<TableKey, Spec> = {
  customers: {
    name: "str",
    address: "strN",
    mobileNumber: "strN",
    nickname: "strN",
    createdAt: "str",
    updatedAt: "str",
  },
  rehan: {
    productName: "strN",
    amount: "numN",
    status: "num",
    openDate: "str",
    closedDate: "strN",
    media: "media",
    updatedAt: "str",
  },
  rehanTransactions: { amount: "num", date: "str", updatedAt: "str" },
  lenden: {
    date: "str",
    amount: "numN",
    discount: "numN",
    remaining: "numN",
    jama: "numN",
    baki: "numN",
    status: "numN",
    billNo: "numN",
    amountOverridden: "numN",
    media: "media",
    updatedAt: "str",
  },
  lendenItems: {
    position: "num",
    name: "text",
    metal: "strN",
    purity: "strN",
    weight: "numN",
    qty: "numN",
    rate: "numN",
    total: "num",
    updatedAt: "str",
  },
  oldJewellery: {
    position: "num",
    description: "text",
    metal: "strN",
    purity: "strN",
    weight: "numN",
    value: "num",
    updatedAt: "str",
  },
  jamaEntries: { amount: "num", date: "str", updatedAt: "str" },
};

type Raw = Record<string, unknown>;

const isNum = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v);

/** Problem text for one field, or null when the value is fine. */
const checkKind = (kind: Kind, value: unknown, field: string): string | null => {
  switch (kind) {
    case "str":
      return typeof value === "string" && value !== "" ? null : `${field} is missing`;
    case "text":
      return typeof value === "string" ? null : `${field} is missing`;
    case "strN":
      return value === null || typeof value === "string" ? null : `${field} is missing`;
    case "num":
      return isNum(value) ? null : `${field} is not a number`;
    case "numN":
      return value === null || isNum(value) ? null : `${field} is not a number`;
    case "media":
      return Array.isArray(value) && value.every((p) => typeof p === "string") ? null : `${field} is not a list`;
  }
};

/** Structural + referential checks on parsed rows. Returns readable problems (empty = valid). */
export const validateData = (data: BackupData, mediaPaths: Set<string>): string[] => {
  const problems: string[] = [];
  const uuids = {} as Record<TableKey, Set<string>>;
  for (const k of TABLE_KEYS) uuids[k] = new Set<string>();

  const rows = (k: TableKey): unknown[] => (Array.isArray(data[k]) ? (data[k] as unknown[]) : []);

  // Pass 1: structure, uuid format and uniqueness (so references can resolve against every table).
  for (const key of TABLE_KEYS) {
    rows(key).forEach((row, i) => {
      const at = `${key} row ${i + 1}`;
      if (typeof row !== "object" || row === null || Array.isArray(row)) {
        problems.push(`${at}: is not a record`);
        return;
      }
      const r = row as Raw;
      if (typeof r.uuid !== "string" || !UUID_RE.test(r.uuid)) {
        problems.push(`${at}: uuid is not valid`);
      } else if (uuids[key].has(r.uuid)) {
        problems.push(`${at}: uuid is used by more than one record`);
      } else {
        uuids[key].add(r.uuid);
      }
      for (const [field, kind] of Object.entries(SPECS[key])) {
        const bad = checkKind(kind, r[field], field);
        if (bad) problems.push(`${at}: ${bad}`);
      }
      if (key === "rehanTransactions" && r.type !== "diya" && r.type !== "jama") {
        problems.push(`${at}: type must be "diya" or "jama"`);
      }
    });
  }

  // Pass 2: relationships and photos.
  const link = (key: TableKey, field: string, target: TableKey, label: string, nullable: boolean) => {
    rows(key).forEach((row, i) => {
      if (typeof row !== "object" || row === null) return;
      const v = (row as Raw)[field];
      if (v === null && nullable) return;
      if (typeof v !== "string" || !uuids[target].has(v)) {
        problems.push(`${key} row ${i + 1}: ${field} does not match any ${label}`);
      }
    });
  };
  link("rehan", "customerUuid", "customers", "customer", true);
  link("rehanTransactions", "rehanUuid", "rehan", "rehan", false);
  link("lenden", "customerUuid", "customers", "customer", true);
  link("lendenItems", "lendenUuid", "lenden", "len-den", false);
  link("oldJewellery", "lendenUuid", "lenden", "len-den", false);
  link("jamaEntries", "lendenUuid", "lenden", "len-den", false);

  for (const key of ["rehan", "lenden"] as TableKey[]) {
    rows(key).forEach((row, i) => {
      const media = typeof row === "object" && row !== null ? (row as Raw).media : null;
      if (!Array.isArray(media)) return;
      for (const p of media) {
        if (typeof p === "string" && !mediaPaths.has(p)) {
          problems.push(`${key} row ${i + 1}: photo ${p} is not in the backup`);
        }
      }
    });
  }

  return problems;
};

type Result = { ok: true; manifest: Manifest; data: BackupData } | { ok: false; errors: string[] };

const fail = (errors: string[]): Result => ({ ok: false, errors: errors.slice(0, MAX_MESSAGES) });

export const validateBackup = (input: {
  manifestText: string | null;
  files: Record<string, string | undefined>;
  mediaPaths: Set<string>;
}): Result => {
  // 1. Manifest
  if (input.manifestText === null) return fail(["Not an AJ backup"]);
  let manifest: Manifest;
  try {
    manifest = JSON.parse(input.manifestText) as Manifest;
  } catch {
    return fail(["Not an AJ backup"]);
  }
  if (typeof manifest !== "object" || manifest === null || manifest.format !== BACKUP_FORMAT) {
    return fail(["Not an AJ backup"]);
  }
  if (manifest.version !== BACKUP_VERSION) return fail([`Unsupported backup version ${manifest.version}`]);

  // 2. Files present
  const missing = TABLE_KEYS.map((k) => DATA_FILES[k]).filter((p) => input.files[p] === undefined);
  if (missing.length > 0) return fail(missing.map((p) => `Backup is incomplete: ${p} is missing`));

  // 3. Checksums
  const listed = (path: string) => (manifest.files && typeof manifest.files === "object" ? manifest.files[path] : undefined);
  const damaged = TABLE_KEYS.map((k) => DATA_FILES[k]).filter((p) => {
    const entry = listed(p);
    return !entry || fnv1a(input.files[p] as string) !== entry.checksum;
  });
  if (damaged.length > 0) return fail(damaged.map((p) => `Backup is damaged: ${p} failed its check`));

  // 4. JSON and counts
  const data = {} as Record<TableKey, unknown[]>;
  const shape: string[] = [];
  for (const k of TABLE_KEYS) {
    const path = DATA_FILES[k];
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.files[path] as string);
    } catch {
      parsed = null;
    }
    if (!Array.isArray(parsed)) {
      shape.push(`Backup is damaged: ${path} is not a list of records`);
      continue;
    }
    const expected = (listed(path) as { count: number }).count;
    if (parsed.length !== expected) {
      shape.push(`Backup is damaged: ${path} has ${parsed.length} records but the backup lists ${expected}`);
      continue;
    }
    data[k] = parsed;
  }
  if (shape.length > 0) return fail(shape);

  // 5. Rows
  const backupData = data as unknown as BackupData;
  const problems = validateData(backupData, input.mediaPaths);
  if (problems.length > 0) return fail(problems);

  return { ok: true, manifest, data: backupData };
};
