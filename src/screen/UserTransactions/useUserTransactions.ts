import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { confirm, notify } from "../../ui";
import {
  getTransactionsByUserId,
  getUserById,
  deleteRehan,
  deleteLenden,
  Transaction,
} from "../../database/entryDatabase";
import { User } from "../../types/entry";
import { toLocalDate } from "../../utils/dates";
import { UserTransactionsNavigationProp, UserTransactionsRouteProp } from "./types";

export type TypeFilter = "all" | "rehan" | "lenden";
export type StatusFilter = "all" | "open" | "closed";

export const useUserTransactions = (
  navigation: UserTransactionsNavigationProp,
  route: UserTransactionsRouteProp,
) => {
  const { userId, userName } = route.params;
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // A failed read shows a retry state, never an empty list or zero totals.
  const [loadError, setLoadError] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadTransactions = async () => {
    try {
      const userData = await getUserById(userId);
      const data = await getTransactionsByUserId(userId);
      setUser(userData);
      setTransactions(data);
      setLoadError(false);
    } catch (error) {
      console.error("Error loading transactions:", error);
      setLoadError(true);
      notify.error("Couldn't load transactions", "Pull down to try again.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [userId]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    loadTransactions();
  };

  const onRetry = () => {
    setIsLoading(true);
    loadTransactions();
  };

  const formatDate = (dateString: string) => {
    const date = toLocalDate(dateString);
    if (!date) return "—";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Filter transactions
  // Filter transactions
  const filteredTransactions = transactions.filter((t) => {
    // Type filter
    if (typeFilter !== "all" && t.type !== typeFilter) return false;

    // Status filter (for both Rehan and Lenden)
    if (statusFilter !== "all") {
      // Both Rehan and Lenden use status 0 for open and 1 for closed
      if (t.status === undefined) return false; // Should not happen for valid data
      if (statusFilter === "open" && t.status !== 0) return false;
      if (statusFilter === "closed" && t.status !== 1) return false;
    }
    return true;
  });

  const handleDeleteTransaction = async (transaction: Transaction) => {
    if (
      await confirm({
        title: "Delete transaction",
        message:
          "Are you sure you want to delete this transaction? This action cannot be undone.",
        confirmLabel: "Delete",
        tone: "danger",
      })
    ) {
      setIsLoading(true);
      try {
        if (transaction.type === "rehan") {
          await deleteRehan(transaction.id);
        } else {
          await deleteLenden(transaction.id);
        }
        await loadTransactions();
      } catch (error) {
        notify.error("Delete failed", "Failed to delete transaction");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Calculate stats
  const totalBaki = transactions
    .filter((t) => t.type === "lenden" && t.baki)
    .reduce((sum, t) => sum + (t.baki || 0), 0);

  const totalOpenRehanAmount = transactions
    .filter((t) => t.type === "rehan" && t.status === 0 && t.amount)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const openTransaction = (item: Transaction) => {
    navigation.navigate("TransactionDetail", {
      transactionId: item.id,
      transactionType: item.type,
    });
  };

  const addTransaction = () => {
    navigation.navigate("AddTransaction", {
      userId,
      userName,
      userAddress: user?.address || undefined,
      userMobileNumber: user?.mobileNumber || undefined,
    });
  };

  return {
    userName,
    transactions,
    user,
    isLoading,
    isRefreshing,
    loadError,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    onRefresh,
    onRetry,
    formatDate,
    filteredTransactions,
    handleDeleteTransaction,
    totalBaki,
    totalOpenRehanAmount,
    openTransaction,
    addTransaction,
  };
};
