import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { FilterTransactionType } from "./useExistingCustomers";
import { styles } from "./styles";

interface Props {
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
  filterAddress: string;
  filterMobile: string;
  filterDateFrom: Date | null;
  filterDateTo: Date | null;
  filterTransactionType: FilterTransactionType;
  loadError: boolean;
  userCount: number;
}

/** Filter Toggle Header */
export const FilterHeader: React.FC<Props> = ({
  showFilters,
  setShowFilters,
  hasActiveFilters,
  clearAllFilters,
  filterAddress,
  filterMobile,
  filterDateFrom,
  filterDateTo,
  filterTransactionType,
  loadError,
  userCount,
}) => (
  <View style={styles.filterHeader}>
    <TouchableOpacity
      style={[
        styles.filterToggleButton,
        showFilters && styles.filterToggleActive,
      ]}
      onPress={() => setShowFilters(!showFilters)}
    >
      <Ionicons
        name={showFilters ? "options" : "options-outline"}
        size={20}
        color={showFilters || hasActiveFilters ? "#007AFF" : "#666"}
      />
      <Text
        style={[
          styles.filterToggleText,
          (showFilters || hasActiveFilters) &&
            styles.filterToggleTextActive,
        ]}
      >
        More Filters
      </Text>
      {hasActiveFilters && (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>
            {
              [
                filterAddress.trim(),
                filterMobile.trim(),
                filterDateFrom,
                filterDateTo,
                filterTransactionType !== "both"
                  ? filterTransactionType
                  : "",
              ].filter(Boolean).length
            }
          </Text>
        </View>
      )}
      <Ionicons
        name={showFilters ? "chevron-up" : "chevron-down"}
        size={18}
        color="#666"
      />
    </TouchableOpacity>

    {hasActiveFilters && (
      <TouchableOpacity
        style={styles.clearAllButton}
        onPress={clearAllFilters}
      >
        <Ionicons name="close-circle" size={16} color="#FF3B30" />
        <Text style={styles.clearAllText}>Clear All</Text>
      </TouchableOpacity>
    )}

    <Text style={styles.resultCount}>
      {loadError
        ? "—"
        : `${userCount} customer${userCount !== 1 ? "s" : ""}`}
    </Text>
  </View>
);
