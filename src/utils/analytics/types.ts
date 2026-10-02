// Flat rows fetched by analyticsQueries.ts. Pure types so the analytics
// modules stay importable from Jest without expo-sqlite.

export interface UserRow {
  id: number;
  name: string;
  address?: string | null;
  mobileNumber?: string | null;
  createdAt?: string | null;
}

export interface LendenRow {
  id: number;
  userId: number;
  date: string;
  amount: number | null;
  discount: number | null;
  jama: number | null; // legacy total; duplicates jama_entries when they exist
  baki: number | null;
  status: number | null; // 0 open, 1 closed
  remaining?: number | null; // net payable
  billNo?: number | null;
  amountOverridden?: number | null;
  media?: string | null;
}

export interface JamaRow {
  lendenId: number;
  amount: number;
  date: string;
}

export interface RehanRow {
  id: number;
  userId: number;
  openDate: string;
  closedDate: string | null;
  status: number | null;
  amount: number | null; // running balance, not the opening principal
  productName?: string | null;
  media?: string | null; // JSON array of image paths
}

export interface RehanTxRow {
  rehanId: number;
  type: string; // "jama" | "diya"
  amount: number;
  date: string;
}

// metal is the raw column: anything but "gold"/"silver" counts as unknown.
export interface SoldItemRow {
  lendenId: number;
  metal: string | null;
  purity?: string | null;
  weight: number | null;
  total: number;
}

export interface OldItemRow {
  lendenId: number;
  metal: string | null;
  weight: number | null;
  value: number;
}

export interface AnalyticsData {
  users: UserRow[];
  lenden: LendenRow[];
  jama: JamaRow[];
  rehan: RehanRow[];
  rehanTx: RehanTxRow[];
  soldItems: SoldItemRow[];
  oldItems: OldItemRow[];
}
