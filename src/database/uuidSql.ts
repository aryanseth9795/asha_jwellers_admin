/**
 * SQLite expression that yields a lower-case UUID v4 per evaluated row.
 * randomblob() and random() are non-deterministic, so in a multi-row UPDATE
 * SQLite evaluates this once per row. Version nibble is fixed to 4 and the
 * variant nibble is one of 8, 9, a, b.
 */
export const UUID_SQL =
  "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))), 2) || '-' || substr('89ab', 1 + (abs(random()) % 4), 1) || substr(lower(hex(randomblob(2))), 2) || '-' || lower(hex(randomblob(6)))";
