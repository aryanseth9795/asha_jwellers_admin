// TypeScript interfaces for the database schema

export interface User {
  id: number;
  name: string;
  address: string | null;
  mobileNumber: string | null;
  nickname: string | null;
  createdAt: string;
}

export interface NewUser {
  name: string;
  address?: string;
  mobileNumber?: string;
  nickname?: string;
}

export interface Rehan {
  id: number;
  userId: number;
  media: string; // JSON stringified array of image paths
  status: number; // 0 = open, 1 = closed
  openDate: string;
  closedDate: string | null;
  productName?: string;
  amount?: number;
}

export interface NewRehan {
  userId: number;
  media?: string[];
  openDate?: string; // Optional - defaults to current date if not provided
  productName?: string;
  amount?: number; // Initial amount / Current balance
}

export interface RehanTransaction {
  id: number;
  rehanId: number;
  type: "jama" | "diya";
  amount: number;
  date: string;
}

export interface NewRehanTransaction {
  rehanId: number;
  type: "jama" | "diya";
  amount: number;
  date: string;
}

export interface Lenden {
  id: number;
  userId: number;
  date: string;
  media: string; // JSON stringified array of image paths
  amount?: number;
  discount?: number;
  remaining?: number;
  jama?: number;
  baki?: number;
  status: number; // 0 = open, 1 = closed
  billNo?: number | null;
  amountOverridden?: number | null;
}

export interface NewLenden {
  userId: number;
  date: string;
  media?: string[];
  amount?: number;
  discount?: number;
  remaining?: number;
  jama?: number; // Legacy - now jama entries are stored in separate table
  baki?: number;
  status?: number; // 0 = open, 1 = closed
  billNo?: number;
  amountOverridden?: number;
}

export type JewelleryMetal = "gold" | "silver";

export const JEWELLERY_METAL_OPTIONS: JewelleryMetal[] = ["gold", "silver"];

// "Silver" is retained for items created before metal was tracked separately.
export type Purity = "24KT" | "22KT" | "18KT" | "999" | "925" | "800" | "Silver";

export const PURITY_OPTIONS_BY_METAL: Record<JewelleryMetal, Purity[]> = {
  gold: ["24KT", "22KT", "18KT"],
  silver: ["24KT", "22KT", "18KT"],
  // silver: ["999", "925", "800"],
};

// Jewellery line item on a Len-Den entry
export interface LendenItem {
  id: number;
  lendenId: number;
  position: number; // 1-based, kept contiguous
  name: string;
  metal: JewelleryMetal | null;
  purity: Purity | null;
  weight: number | null; // grams
  rate: number | null; // rupees per gram
  total: number; // rupees
}

export interface NewLendenItem {
  name: string;
  metal?: JewelleryMetal | null;
  purity?: Purity | null;
  weight?: number | null;
  rate?: number | null;
  total: number;
}

// Jama Entry - multiple payments per Lenden
export interface JamaEntry {
  id: number;
  lendenId: number;
  amount: number;
  date: string;
}

export interface NewJamaEntry {
  lendenId: number;
  amount: number;
  date: string;
}

// Entry type selection
export type EntryType = "rehan" | "lenden";

// Navigation types
export type RootStackParamList = {
  Home: undefined;
  NewCustomer: undefined;
  ExistingCustomers: undefined;
  UserTransactions: {
    userId: number;
    userName: string;
  };
  AddTransaction: {
    userId: number;
    userName: string;
    userAddress?: string;
    userMobileNumber?: string;
  };
  TransactionDetail: {
    transactionId: number;
    transactionType: "rehan" | "lenden";
  };
  BillPreview: {
    lendenId: number;
  };
  UpdateBhav: undefined;
  // Category management screens
  CategoryList: undefined;
  AddEditCategory: {
    categoryId?: string; // If provided, edit mode; otherwise, create mode
  };
  // Product management screens
  ProductList: {
    categoryId?: string; // Optional filter by category
  };
  AddEditProduct: {
    productId?: string; // If provided, edit mode; otherwise, create mode
  };
};
