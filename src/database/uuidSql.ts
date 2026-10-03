import { UUID_RE } from "../backup/format";

/**
 * SQLite expression that yields a lower-case UUID v4 per evaluated row.
 * randomblob() and random() are non-deterministic, so in a multi-row UPDATE
 * SQLite evaluates this once per row. Version nibble is fixed to 4 and the
 * variant nibble is one of 8, 9, a, b.
 *
 * The variant digit uses `random() & 3`, not `abs(random()) % 4`: abs() of the
 * smallest 64-bit integer overflows and raises an error.
 */
export const UUID_SQL =
  "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (random() & 3), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))";

/**
 * The uuid an item passed to a replace-all write may keep: a well-formed uuid
 * not already used earlier in the same call. Returns null when a fresh one must
 * be generated (new item, missing/odd uuid, or a duplicate that would break the
 * unique index). Adds the kept uuid to `taken`.
 */
export const reusableUuid = (uuid: string | undefined | null, taken: Set<string>): string | null => {
  if (typeof uuid !== "string" || !UUID_RE.test(uuid) || taken.has(uuid)) return null;
  taken.add(uuid);
  return uuid;
};
