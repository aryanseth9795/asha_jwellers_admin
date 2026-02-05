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
  UpdateBhav: undefined;
};
