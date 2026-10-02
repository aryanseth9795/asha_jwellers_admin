import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NewOldJewelleryItem } from "../types/entry";
import {
  formatMetalPurity,
  formatRupees,
  formatWeight,
} from "../utils/billFormat";

interface OldJewelleryItemsTableProps {
  items: NewOldJewelleryItem[];
  editable?: boolean;
  onAdd?: () => void;
  onEdit?: (index: number) => void;
  onDelete?: (index: number) => void;
}

const OldJewelleryItemsTable: React.FC<OldJewelleryItemsTableProps> = ({
  items,
  editable = false,
  onAdd,
  onEdit,
  onDelete,
}) => {
  if (items.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyText}>No old jewellery added</Text>
        {editable && onAdd && (
          <TouchableOpacity style={styles.addButton} onPress={onAdd}>
            <Ionicons name="add-circle-outline" size={19} color="#8C5B14" />
            <Text style={styles.addButtonText}>Add old jewellery</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.card}>
      {items.map((item, index) => (
        <View key={`${item.description}-${index}`} style={styles.itemRow}>
          <View style={styles.position}>
            <Text style={styles.positionText}>{index + 1}</Text>
          </View>
          <View style={styles.itemContent}>
            <Text style={styles.description}>{item.description}</Text>
            <View style={styles.metaRow}>
              {item.metal ? (
                <View
                  style={[
                    styles.metalBadge,
                    item.metal === "silver" && styles.silverBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.metalBadgeText,
                      item.metal === "silver" && styles.silverBadgeText,
                    ]}
                  >
                    {formatMetalPurity(item.metal, item.purity)}
                  </Text>
                </View>
              ) : (
                <View style={styles.unknownBadge}>
                  <Text style={styles.unknownBadgeText}>Metal not set</Text>
                </View>
              )}
              {item.weight != null && (
                <Text style={styles.weight}>
                  {formatWeight(item.weight).main}
                </Text>
              )}
            </View>
          </View>
          <Text style={styles.value}>{formatRupees(item.value)}</Text>
          {editable && (
            <View style={styles.actions}>
              {onEdit && (
                <TouchableOpacity
                  accessibilityLabel={`Edit old jewellery ${index + 1}`}
                  style={styles.actionButton}
                  onPress={() => onEdit(index)}
                >
                  <Ionicons name="pencil" size={17} color="#007AFF" />
                </TouchableOpacity>
              )}
              {onDelete && (
                <TouchableOpacity
                  accessibilityLabel={`Remove old jewellery ${index + 1}`}
                  style={styles.actionButton}
                  onPress={() => onDelete(index)}
                >
                  <Ionicons name="trash-outline" size={17} color="#D32F2F" />
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      ))}

      {editable && onAdd && (
        <TouchableOpacity style={styles.addButton} onPress={onAdd}>
          <Ionicons name="add-circle-outline" size={19} color="#8C5B14" />
          <Text style={styles.addButtonText}>Add old jewellery</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#E8D5AF",
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#FFFCF6",
  },
  emptyCard: {
    alignItems: "center",
    padding: 16,
    borderWidth: 1,
    borderColor: "#E8D5AF",
    borderRadius: 12,
    backgroundColor: "#FFFCF6",
    gap: 10,
  },
  emptyText: { color: "#7A6B58", fontSize: 14 },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#F0E5D0",
  },
  position: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5E8CF",
  },
  positionText: { fontWeight: "700", fontSize: 12, color: "#8C5B14" },
  itemContent: { flex: 1 },
  description: { color: "#332719", fontSize: 15, fontWeight: "600" },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 3,
  },
  metalBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#FBEFD5",
  },
  metalBadgeText: { color: "#8A6500", fontSize: 11, fontWeight: "700" },
  silverBadge: { backgroundColor: "#ECEFF3" },
  silverBadgeText: { color: "#4A5562" },
  unknownBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E0C9C9",
  },
  unknownBadgeText: { color: "#A15C5C", fontSize: 11, fontWeight: "600" },
  weight: { color: "#7A6B58", fontSize: 12 },
  value: { color: "#7C4A08", fontSize: 14, fontWeight: "800" },
  actions: { flexDirection: "row", marginLeft: 2 },
  actionButton: { padding: 6 },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
  },
  addButtonText: { color: "#8C5B14", fontSize: 14, fontWeight: "700" },
});

export default OldJewelleryItemsTable;
