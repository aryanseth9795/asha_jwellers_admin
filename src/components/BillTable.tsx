import React from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { Text } from "../ui";
import { Ionicons } from "@expo/vector-icons";

interface JamaEntryDisplay {
  id?: number;
  amount: number;
  date: string;
}

interface BillTableProps {
  amount: number;
  oldJewelleryCredit?: number;
  discount: number;
  jamaEntries: JamaEntryDisplay[];
  onAddJama?: () => void;
  onDeleteJama?: (index: number) => void;
  onEditJama?: (index: number) => void;
  editable?: boolean;
}

const BillTable: React.FC<BillTableProps> = ({
  amount,
  oldJewelleryCredit = 0,
  discount,
  jamaEntries,
  onAddJama,
  onDeleteJama,
  onEditJama,
  editable = false,
}) => {
  const remaining = amount - oldJewelleryCredit - discount;
  const totalJama = jamaEntries.reduce((sum, entry) => sum + entry.amount, 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Calculate running baki
  let runningBaki = remaining;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="receipt-outline" size={18} color="#007AFF" />
        <Text style={styles.headerText} numberOfLines={1}>Bill Summary</Text>
      </View>

      {/* Amount Row */}
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={2}>Amount</Text>
        <Text style={styles.value} numberOfLines={1}>₹{amount.toLocaleString()}</Text>
      </View>

      {oldJewelleryCredit > 0 && (
        <View style={styles.row}>
          <Text style={styles.label} numberOfLines={2}>Old Jewellery Credit</Text>
          <Text style={[styles.value, styles.oldJewelleryValue]} numberOfLines={1}>
            -₹{oldJewelleryCredit.toLocaleString()}
          </Text>
        </View>
      )}

      {/* Discount Row */}
      <View style={styles.row}>
        <Text style={styles.label} numberOfLines={2}>Discount</Text>
        <Text style={[styles.value, styles.discountValue]} numberOfLines={1}>
          -₹{discount.toLocaleString()}
        </Text>
      </View>

      {/* Remaining Row */}
      <View style={[styles.row, styles.remainingRow]}>
        <Text style={[styles.label, styles.remainingLabel]} numberOfLines={2}>REMAINING</Text>
        <Text style={[styles.value, styles.remainingValue]} numberOfLines={1}>
          ₹{remaining.toLocaleString()}
        </Text>
      </View>

      {/* Jama Entries */}
      {jamaEntries.map((entry, index) => {
        const bakiAfterJama = runningBaki - entry.amount;
        runningBaki = bakiAfterJama;

        return (
          <View key={entry.id || index}>
            {/* Jama Row */}
            <View style={styles.jamaRow}>
              <View style={styles.jamaInfo}>
                <Text style={styles.jamaLabel} numberOfLines={1}>Jama</Text>
                <Text style={styles.jamaDate} numberOfLines={1}>({formatDate(entry.date)})</Text>
              </View>
              <View style={styles.jamaAmountContainer}>
                <Text style={[styles.value, styles.jamaValue]} numberOfLines={1}>
                  -₹{entry.amount.toLocaleString()}
                </Text>
                {editable && onEditJama && (
                  <TouchableOpacity
                    style={styles.editButton}
                    onPress={() => onEditJama(index)}
                  >
                    <Ionicons name="pencil" size={16} color="#007AFF" />
                  </TouchableOpacity>
                )}
                {editable && onDeleteJama && (
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => onDeleteJama(index)}
                  >
                    <Ionicons name="close-circle" size={20} color="#FF3B30" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Baki Row after this Jama */}
            <View style={styles.bakiRow}>
              <Text style={styles.bakiLabel} numberOfLines={2}>Baki</Text>
              <Text style={styles.bakiValue} numberOfLines={1}>
                ₹{bakiAfterJama.toLocaleString()}
              </Text>
            </View>
          </View>
        );
      })}

      {/* Total Jama Row - only show if there are entries */}
      {jamaEntries.length > 0 && (
        <View style={[styles.row, styles.totalJamaRow]}>
          <Text style={[styles.label, styles.totalJamaLabel]} numberOfLines={2}>TOTAL JAMA</Text>
          <Text style={[styles.value, styles.totalJamaValue]} numberOfLines={1}>
            -₹{totalJama.toLocaleString()}
          </Text>
        </View>
      )}

      {/* Final Baki if no jama entries */}
      {jamaEntries.length === 0 && (
        <View style={[styles.row, styles.finalBakiRow]}>
          <Text style={[styles.label, styles.finalBakiLabel]} numberOfLines={2}>BAKI</Text>
          <Text style={[styles.value, styles.finalBakiValue]} numberOfLines={1}>
            ₹{remaining.toLocaleString()}
          </Text>
        </View>
      )}

      {/* Final Baki Summary if there are jama entries */}
      {jamaEntries.length > 0 && (
        <View style={[styles.row, styles.finalBakiRow]}>
          <Text style={[styles.label, styles.finalBakiLabel]} numberOfLines={2}>FINAL BAKI</Text>
          <Text style={[styles.value, styles.finalBakiValue]} numberOfLines={1}>
            ₹{runningBaki.toLocaleString()}
          </Text>
        </View>
      )}

      {/* Add Jama Button */}
      {editable && onAddJama && (
        <TouchableOpacity style={styles.addJamaButton} onPress={onAddJama}>
          <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.addJamaText}>Add Jama Payment</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#F0F7FF",
    borderBottomWidth: 1,
    borderBottomColor: "#D0E4FF",
  },
  headerText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#007AFF",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  label: {
    flexShrink: 1,
    fontSize: 15,
    color: "#666",
  },
  value: {
    flexShrink: 0,
    textAlign: "right",
    fontSize: 15,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  discountValue: {
    color: "#F9A825",
  },
  oldJewelleryValue: {
    color: "#8C5B14",
  },
  remainingRow: {
    backgroundColor: "#F8F9FA",
    borderBottomWidth: 2,
    borderBottomColor: "#E0E0E0",
  },
  remainingLabel: {
    fontWeight: "700",
    color: "#1A1A1A",
    textTransform: "uppercase",
    fontSize: 13,
  },
  remainingValue: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1976D2",
  },
  jamaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#E8F5E9",
  },
  jamaInfo: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  jamaLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
  },
  jamaDate: {
    fontSize: 12,
    color: "#666",
  },
  jamaAmountContainer: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  jamaValue: {
    color: "#2E7D32",
  },
  deleteButton: {
    padding: 2,
  },
  bakiRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  bakiLabel: {
    flexShrink: 1,
    fontSize: 13,
    color: "#999",
  },
  bakiValue: {
    flexShrink: 0,
    textAlign: "right",
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  finalBakiRow: {
    backgroundColor: "#FFEBEE",
    borderBottomWidth: 0,
  },
  finalBakiLabel: {
    fontWeight: "700",
    color: "#C62828",
    textTransform: "uppercase",
    fontSize: 13,
  },
  finalBakiValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#C62828",
  },
  addJamaButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: "#F0F7FF",
    borderTopWidth: 1,
    borderTopColor: "#D0E4FF",
  },
  addJamaText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#007AFF",
  },
  editButton: {
    padding: 4,
  },
  totalJamaRow: {
    backgroundColor: "#E8F5E9",
    borderBottomWidth: 2,
    borderBottomColor: "#C8E6C9",
  },
  totalJamaLabel: {
    fontWeight: "700",
    color: "#2E7D32",
    textTransform: "uppercase",
    fontSize: 13,
  },
  totalJamaValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2E7D32",
  },
});

export default BillTable;
