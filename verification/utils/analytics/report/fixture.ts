// Shared test ledger for the report modules (spec §12). Not a test file.
// Dates are local noon so local-time bucketing is exercised in any time zone.
// The same ledger is also offered with plain-day dates and local-midnight timestamps below,
// the two other forms a stored calendar date can take.
import { normalizeDay, parseDay, toDay } from "../../../../src/utils/dates";
import { AnalyticsData, LendenRow, RehanRow, UserRow } from "../../../../src/utils/analytics/types";

export const iso = (y: number, m: number, d: number): string =>
  new Date(y, m - 1, d, 12).toISOString();

export const NOW = new Date(2026, 9, 2, 12); // 2 Oct 2026

const user = (
  id: number,
  name: string,
  address: string,
  createdAt: string,
  mobileNumber: string | null = null,
): UserRow => ({ id, name, address, mobileNumber, createdAt });

const pledge = (
  id: number,
  userId: number,
  openDate: string,
  amount: number,
  productName: string,
  o: Partial<RehanRow> = {},
): RehanRow => ({
  id, userId, openDate, closedDate: null, status: 0, amount, productName, media: "[]", ...o,
});

const bill = (id: number, userId: number, date: string, amount: number, o: Partial<LendenRow> = {}): LendenRow => ({
  id, userId, date, amount, discount: null, remaining: amount, jama: null, baki: 0, status: 1,
  billNo: null, amountOverridden: 0, media: "[]", ...o,
});

export const fixtureData: AnalyticsData = {
  users: [
    user(1, "Ram", "Manwal .", iso(2025, 12, 28)),
    user(2, "Shyam", "manwal", iso(2026, 1, 5), "9999999999"),
    user(3, "Gita", "Kanja, Jaunpur", iso(2026, 1, 5)),
    user(4, "Sita", "Kanja", iso(2026, 1, 5)),
    user(5, "Mohan", "Kanja", iso(2026, 1, 5)),
    user(6, "Sohan", "Kanja", iso(2026, 1, 5)),
    user(7, "Rita", "Kanja", iso(2026, 1, 5)),
    user(8, "Lata", "Manwal", iso(2026, 1, 5)),
    user(9, "Hari", "Manwal", iso(2026, 1, 5)),
    user(10, "Ravi", "Manwal", iso(2026, 1, 5)),
    user(11, "Ramu", "Bhatewra", iso(2026, 1, 5)),
    user(12, "Ram", "manwal", iso(2026, 2, 1)),
    user(13, "Kavi", "", iso(2026, 3, 1)),
  ],
  rehan: [
    pledge(1, 1, iso(2024, 9, 1), 10000, "Hk Payal", { media: '["a.jpg"]' }),
    pledge(2, 1, iso(2025, 6, 10), 5000, "Chain 7.900"),
    pledge(3, 2, iso(2025, 10, 2), 8000, "Locket payal", { status: 1, closedDate: iso(2026, 3, 31) }),
    pledge(4, 3, iso(2026, 1, 10), 25000, "Krdhn hath mehndi"), // 5000 diya on top of 20000 lent
    pledge(5, 4, iso(2026, 1, 10), 3000, "Tika", { status: 1, closedDate: iso(2026, 7, 10) }),
    pledge(6, 11, iso(2026, 8, 5), 50000, "Desi chain"),
    pledge(7, 13, iso(2026, 9, 20), 2000, "3.800"),
    pledge(8, 99, iso(2026, 9, 25), 1000, "Mina 6"), // customer 99 is not on file
    pledge(9, 1, iso(2026, 9, 28), 0, "Payal"),
  ],
  rehanTx: [{ rehanId: 4, type: "diya", amount: 5000, date: iso(2026, 2, 1) }],
  lenden: [
    bill(1, 3, iso(2026, 9, 8), 10000, { discount: 500, remaining: 9500, baki: 9500, status: 0, billNo: 1 }),
    bill(2, 99, iso(2026, 9, 8), 43500, { discount: 1000, remaining: 42500, baki: 42500, status: 0, billNo: 2 }),
    bill(3, 5, iso(2026, 9, 25), 44545, { baki: 2045, status: 0, billNo: 3 }),
    bill(4, 6, iso(2026, 9, 30), 8200, { jama: 8000, billNo: 6 }),
    bill(5, 7, iso(2026, 1, 7), 16000, {
      discount: 500, remaining: 15500, baki: 7000, status: 0, amountOverridden: 1, media: '["x.jpg"]',
    }),
    bill(6, 8, iso(2025, 12, 29), 20300, { discount: 800, remaining: 19500, jama: 10000, amountOverridden: 1 }),
  ],
  jama: [{ lendenId: 3, amount: 42500, date: iso(2026, 9, 25) }],
  soldItems: [],
  oldItems: [],
};

/** A stored calendar day as the migrated database holds it: plain `YYYY-MM-DD`, the local day. */
export const day = (y: number, m: number, d: number): string => toDay(new Date(y, m - 1, d));

/** What the old date picker stored for a picked day: the ISO text of local midnight. */
export const midnightIso = (y: number, m: number, d: number): string =>
  new Date(y, m - 1, d).toISOString();

/** `data` with every calendar-date column rewritten by `convert`. `users.createdAt` stays a timestamp. */
export const mapDates = (data: AnalyticsData, convert: (stored: string) => string): AnalyticsData => ({
  ...data,
  lenden: data.lenden.map((b) => ({ ...b, date: convert(b.date) })),
  jama: data.jama.map((j) => ({ ...j, date: convert(j.date) })),
  rehan: data.rehan.map((r) => ({
    ...r,
    openDate: convert(r.openDate),
    closedDate: r.closedDate === null ? null : convert(r.closedDate),
  })),
  rehanTx: data.rehanTx.map((t) => ({ ...t, date: convert(t.date) })),
});

/** The ledger as the migration leaves it: the same days, each a plain local `YYYY-MM-DD`. */
export const fixtureDataPlain: AnalyticsData = mapDates(fixtureData, normalizeDay);

/** The ledger as the old picker wrote it: the same days, each the ISO text of local midnight. */
export const fixtureDataMidnight: AnalyticsData = mapDates(fixtureData, (stored) =>
  parseDay(normalizeDay(stored)).toISOString(),
);
