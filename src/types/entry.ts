// TypeScript interfaces for the database schema

export interface User {
  id: number;
  name: string;
  address: string | null;
  mobileNumber: string | null;
  createdAt: string;
}

export interface NewUser {
  name: string;
  address?: string;
  mobileNumber?: string;
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
  media: string[];
  openDate?: string; // Optional - defaults to current date if not provided
  productName?: string;
  amount?: number;
}

export interface Lenden {
  id: number;
  userId: number;
  date: string;
  media: string; // JSON stringified array of image paths
  amount?: number;
}

export interface NewLenden {
  userId: number;
  date: string;
  media: string[];
  amount?: number;
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
};

// Legacy Entry types (can be removed after migration)
export interface Entry {
  id: number;
  name: string;
  address: string;
  imagePaths: string;
  createdAt: string;
}

export interface NewEntry {
  name: string;
  address: string;
  imagePaths: string[];
}
