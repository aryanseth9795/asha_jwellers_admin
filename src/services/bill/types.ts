import { LendenItem, OldJewelleryItem } from "../../types/entry";

export interface BillCustomer {
  name: string;
  address: string | null;
  mobile: string | null;
}

export interface BillJama {
  amount: number;
  date: string;
}

export interface BillData {
  billNo: number;
  date: string; // the entry's own date, not today: a plain YYYY-MM-DD (older rows may hold an ISO timestamp)
  customer: BillCustomer;
  items: LendenItem[];
  oldJewelleryItems: OldJewelleryItem[];
  amount: number; // effective amount, per resolveEffectiveAmount
  discount: number;
  jamaEntries: BillJama[];
  baki: number;
  pichlaBaki: number; // sum of baki across other transactions (except current)
  totalBaki: number; // sum of baki across ALL customer transactions
  showPaymentDetails: boolean;
  showTotalBaki: boolean;
  templateDataUri: string;
}
