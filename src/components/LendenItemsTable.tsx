import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NewLendenItem } from "../types/entry";
import { sumItemTotals } from "../utils/lendenAmount";
import { formatRupees, formatWeight } from "../utils/billFormat";
import { COMPACT_ITEM_THRESHOLD } from "../services/BillHtmlService";

const metalLabel = (metal: NewLendenItem["metal"]): string | null => {
  if (metal === "gold") return "Gold";
  if (metal === "silver") return "Silver";
  return null;
};

interface LendenItemsTableProps {
  items: NewLendenItem[];
  editable?: boolean;
  onAdd?: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

const LendenItemsTable: React.FC<LendenItemsTableProps> = ({
  items,
  editable = false,
  onAdd,
  onEdit,
  onDelete,
}) => {
  const total = sumItemTotals(items);
  const totalWeight = items.reduce((sum, i) => sum + (i.weight ?? 0), 0);
  const overflowing = items.length > COMPACT_ITEM_THRESHOLD;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="diamond-outline" size={18} color="#007AFF" />
        <Text style={styles.headerText}>Items ({items.length})</Text>
      </View>

      {items.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No items added yet</Text>
        </View>
      )}

      {items.map((item, index) => (
        <View key={index} style={styles.itemRow}>
          <View style={styles.serial}>
            <Text style={styles.serialText}>{index + 1}</Text>
          </View>

          <View style={styles.itemBody}>
            <Text style={styles.itemName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.itemMeta}>
              {[
                metalLabel(item.metal),
                item.purity ?? null,
                item.qty != null ? `Qty: ${item.qty}` : null,
                item.weight != null ? formatWeight(item.weight).main : null,
                item.rate != null ? `@ ${formatRupees(item.rate)}` : null,
              ]
                .filter(Boolean)
                .join("  ·  ")}
            </Text>
          </View>

          <Text style={styles.itemTotal}>{formatRupees(item.total)}</Text>

          {editable && onEdit && (
            <TouchableOpacity style={styles.iconButton} onPress={() => onEdit(index)}>
              <Ionicons name="pencil" size={16} color="#007AFF" />
            </TouchableOpacity>
          )}
          {editable && onDelete && (
            <TouchableOpacity style={styles.iconButton} onPress={() => onDelete(index)}>
              <Ionicons name="close-circle" size={20} color="#FF3B30" />
            </TouchableOpacity>
          )}
        </View>
      ))}

      {items.length > 0 && (
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>
            TOTAL AMOUNT {totalWeight > 0 ? `· ${formatWeight(totalWeight).main}` : ""}
          </Text>
          <Text style={styles.totalValue}>{formatRupees(total)}</Text>
        </View>
      )}

      {overflowing && (
        <View style={styles.warning}>
          <Ionicons name="warning-outline" size={16} color="#B26A00" />
          <Text style={styles.warningText}>
            More than {COMPACT_ITEM_THRESHOLD} items may not fit on one A5 page.
          </Text>
        </View>
      )}

      {editable && onAdd && (
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <Ionicons name="add-circle-outline" size={20} color="#007AFF" />
          <Text style={styles.addText}>Add Item</Text>
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
  headerText: { fontSize: 16, fontWeight: "700", color: "#007AFF" },
  empty: { padding: 20, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#999" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  serial: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  serialText: { fontSize: 12, fontWeight: "700", color: "#007AFF" },
  itemBody: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  itemMeta: { fontSize: 12, color: "#666", marginTop: 2 },
  itemTotal: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  iconButton: { padding: 2 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#F8F9FA",
  },
  totalLabel: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  totalValue: { fontSize: 17, fontWeight: "700", color: "#1976D2" },
  warning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFF8E1",
  },
  warningText: { flex: 1, fontSize: 12, color: "#B26A00" },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    backgroundColor: "#F0F7FF",
    borderTopWidth: 1,
    borderTopColor: "#D0E4FF",
  },
  addText: { fontSize: 15, fontWeight: "600", color: "#007AFF" },
});

export default LendenItemsTable;
