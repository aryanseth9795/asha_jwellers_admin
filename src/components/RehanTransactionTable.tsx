import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { RehanTransaction } from "../types/entry";

interface RehanTransactionTableProps {
  transactions: RehanTransaction[];
  onDeleteTransaction: (id: number) => void;
  isLoading?: boolean;
}

const RehanTransactionTable: React.FC<RehanTransactionTableProps> = ({
  transactions,
  onDeleteTransaction,
  isLoading = false,
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

  if (transactions.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No transactions available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.dateCol]}>Date</Text>
        <Text style={[styles.headerCell, styles.typeCol]}>Type</Text>
        <Text style={[styles.headerCell, styles.amountCol]}>Amount</Text>
        <Text style={[styles.headerCell, styles.actionCol]}>Action</Text>
      </View>

      {transactions.map((transaction, index) => (
        <View key={transaction.id} style={styles.row}>
          <Text style={[styles.cell, styles.dateCol]}>
            {formatDate(transaction.date)}
          </Text>
          <View
            style={[styles.cellView, styles.typeCol, styles.badgeContainer]}
          >
            <View
              style={[
                styles.badge,
                transaction.type === "diya"
                  ? styles.diyaBadge
                  : styles.jamaBadge,
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  transaction.type === "diya"
                    ? styles.diyaText
                    : styles.jamaText,
                ]}
              >
                {transaction.type === "diya" ? "Diya" : "Jama"}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.cell,
              styles.amountCol,
              transaction.type === "diya" ? styles.diyaText : styles.jamaText,
            ]}
          >
            {transaction.type === "diya" ? "+" : "-"}₹
            {transaction.amount.toLocaleString()}
          </Text>
          <View style={[styles.cellView, styles.actionCol]}>
            <TouchableOpacity
              onPress={() => onDeleteTransaction(transaction.id)}
              disabled={isLoading}
              style={styles.deleteButton}
            >
              <Ionicons name="trash-outline" size={18} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    overflow: "hidden",
  },
  emptyContainer: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E5E5",
    borderRadius: 12,
    borderStyle: "dashed",
  },
  emptyText: {
    color: "#999",
    fontSize: 14,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#F8F9FA",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  row: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
    alignItems: "center",
  },
  headerCell: {
    fontSize: 12,
    fontWeight: "600",
    color: "#666",
  },
  cell: {
    fontSize: 14,
    color: "#1A1A1A",
  },
  cellView: {
    justifyContent: "center",
  },
  dateCol: {
    flex: 2,
  },
  typeCol: {
    flex: 2,
    alignItems: "center",
  },
  amountCol: {
    flex: 3,
    textAlign: "right",
    fontWeight: "600",
  },
  actionCol: {
    flex: 1,
    alignItems: "flex-end",
  },
  badgeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  diyaBadge: {
    backgroundColor: "#FFEBEE",
  },
  jamaBadge: {
    backgroundColor: "#E8F5E9",
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  diyaText: {
    color: "#C62828",
  },
  jamaText: {
    color: "#2E7D32",
  },
  deleteButton: {
    padding: 4,
  },
});

export default RehanTransactionTable;
