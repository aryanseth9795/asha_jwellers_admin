/**
 * Converts an old (v1) backup — users / rehan / lenden rows — into the v2 shape (backup spec §7).
 * Pure: the caller supplies the uuid generator.
 */
import { BackupData, BackupError, CustomerRow, LendenRow, RehanRow, UUID_RE } from "./format";

export const LEGACY_WARNING =
  "This is an old backup: jama payments, rehan diya/jama, bill items and old jewellery are not in it and cannot be restored.";

const EPOCH = "1970-01-01T00:00:00.000Z";

type Raw = Record<string, unknown>;

const isRecord = (v: unknown): v is Raw => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const validUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

export const convertLegacy = (
  input: { users: unknown; rehan: unknown; lenden: unknown },
  newUuid: () => string,
): { data: BackupData; warnings: string[] } => {
  const { users, rehan, lenden } = input;
  if (!Array.isArray(users) || !Array.isArray(rehan) || !Array.isArray(lenden)) {
    throw new BackupError("Not an AJ backup");
  }

  const used = new Set<string>();
  /** Keep the row's own uuid when valid and not already taken; otherwise mint one. */
  const uuidFor = (raw: Raw): string => {
    if (validUuid(raw.uuid) && !used.has(raw.uuid)) {
      used.add(raw.uuid);
      return raw.uuid;
    }
    let fresh = newUuid();
    while (used.has(fresh)) fresh = newUuid();
    used.add(fresh);
    return fresh;
  };

  let badMedia = 0;
  const parseMedia = (value: unknown): string[] => {
    if (value === null || value === undefined || value === "") return [];
    let parsed: unknown = value;
    if (typeof value === "string") {
      try {
        parsed = JSON.parse(value);
      } catch {
        badMedia++;
        return [];
      }
    }
    if (!Array.isArray(parsed)) {
      badMedia++;
      return [];
    }
    return parsed.filter((p): p is string => typeof p === "string" && p !== "");
  };

  const customers: CustomerRow[] = [];
  const byId = new Map<number, string>();
  const customerUuids = new Set<string>();
  for (const u of users) {
    if (!isRecord(u)) continue;
    const uuid = uuidFor(u);
    const createdAt = str(u.createdAt) ?? EPOCH;
    customers.push({
      uuid,
      name: str(u.name) ?? "",
      address: str(u.address),
      mobileNumber: str(u.mobileNumber),
      nickname: str(u.nickname),
      createdAt,
      updatedAt: createdAt,
    });
    customerUuids.add(uuid);
    const id = num(u.id);
    if (id !== null) byId.set(id, uuid);
  }

  const customerOf = (raw: Raw): string | null => {
    if (validUuid(raw.userUuid) && customerUuids.has(raw.userUuid)) return raw.userUuid;
    const id = num(raw.userId);
    return id !== null ? (byId.get(id) ?? null) : null;
  };

  const rehanRows: RehanRow[] = [];
  for (const r of rehan) {
    if (!isRecord(r)) continue;
    const openDate = str(r.openDate) ?? EPOCH;
    rehanRows.push({
      uuid: uuidFor(r),
      customerUuid: customerOf(r),
      productName: str(r.productName),
      amount: num(r.amount),
      status: num(r.status) ?? 0,
      openDate,
      closedDate: str(r.closedDate),
      media: parseMedia(r.media),
      updatedAt: openDate,
    });
  }

  const lendenRows: LendenRow[] = [];
  for (const l of lenden) {
    if (!isRecord(l)) continue;
    const date = str(l.date) ?? EPOCH;
    lendenRows.push({
      uuid: uuidFor(l),
      customerUuid: customerOf(l),
      date,
      amount: num(l.amount),
      discount: num(l.discount),
      remaining: num(l.remaining),
      jama: num(l.jama),
      baki: num(l.baki),
      status: num(l.status),
      billNo: num(l.billNo),
      // Old rows predate line items, so their stored amount is authoritative.
      amountOverridden: num(l.amountOverridden) ?? 1,
      media: parseMedia(l.media),
      updatedAt: date,
    });
  }

  const warnings = [LEGACY_WARNING];
  if (badMedia > 0) {
    warnings.push(
      `${badMedia} old ${badMedia === 1 ? "record" : "records"} had unreadable photo lists and ${
        badMedia === 1 ? "was" : "were"
      } restored without photos`,
    );
  }

  return {
    data: {
      customers,
      rehan: rehanRows,
      rehanTransactions: [],
      lenden: lendenRows,
      lendenItems: [],
      oldJewellery: [],
      jamaEntries: [],
    },
    warnings,
  };
};
