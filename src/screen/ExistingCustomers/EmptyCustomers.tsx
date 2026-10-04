import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

interface Props {
  hasActiveFilters: boolean;
  onClearFilters: () => void;
}

export const EmptyCustomers: React.FC<Props> = ({ hasActiveFilters, onClearFilters }) => (
  <View style={styles.emptyContainer}>
    <Ionicons name="people-outline" size={64} color="#CCC" />
    <Text style={styles.emptyTitle}>No Customers Found</Text>
    <Text style={styles.emptySubtitle}>
      {hasActiveFilters
        ? "Try adjusting your filters"
        : "Add your first customer to get started"}
    </Text>
    {hasActiveFilters && (
      <TouchableOpacity
        style={styles.clearFiltersButton}
        onPress={onClearFilters}
      >
        <Ionicons name="refresh" size={18} color="#007AFF" />
        <Text style={styles.clearFiltersButtonText}>Clear Filters</Text>
      </TouchableOpacity>
    )}
  </View>
);
