import React from "react";
import { View, TouchableOpacity, ScrollView } from "react-native";
import { Text } from "../../ui";
import { styles } from "./styles";
import type { TypeFilter, StatusFilter } from "./useUserTransactions";

interface Props {
  typeFilter: TypeFilter;
  setTypeFilter: (filter: TypeFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (filter: StatusFilter) => void;
}

const FilterBar: React.FC<Props> = ({
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
}) => (
  <View style={styles.filterSection}>
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterRow}
    >
      {/* Type Filters */}
      <TouchableOpacity
        style={[
          styles.filterChip,
          typeFilter === "all" && styles.filterChipActive,
        ]}
        onPress={() => {
          setTypeFilter("all");
        }}
      >
        <Text
          style={[
            styles.filterChipText,
            typeFilter === "all" && styles.filterChipTextActive,
          ]}
        >
          All
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterChip,
          typeFilter === "rehan" && styles.filterChipActive,
        ]}
        onPress={() => setTypeFilter("rehan")}
      >
        <Text
          style={[
            styles.filterChipText,
            typeFilter === "rehan" && styles.filterChipTextActive,
          ]}
        >
          Rehan
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterChip,
          typeFilter === "lenden" && styles.filterChipActive,
        ]}
        onPress={() => {
          setTypeFilter("lenden");
        }}
      >
        <Text
          style={[
            styles.filterChipText,
            typeFilter === "lenden" && styles.filterChipTextActive,
          ]}
        >
          Len-Den
        </Text>
      </TouchableOpacity>

      {/* Status Filters - Always show */}
      <View style={styles.filterDivider} />
      <TouchableOpacity
        style={[
          styles.filterChip,
          styles.openChip,
          statusFilter === "open" && styles.openChipActive,
        ]}
        onPress={() =>
          setStatusFilter(statusFilter === "open" ? "all" : "open")
        }
      >
        <View style={[styles.statusDotSmall, styles.dotOpenSmall]} />
        <Text
          style={[
            styles.filterChipText,
            statusFilter === "open" && styles.openChipTextActive,
          ]}
        >
          Open
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[
          styles.filterChip,
          styles.closedChip,
          statusFilter === "closed" && styles.closedChipActive,
        ]}
        onPress={() =>
          setStatusFilter(statusFilter === "closed" ? "all" : "closed")
        }
      >
        <View style={[styles.statusDotSmall, styles.dotClosedSmall]} />
        <Text
          style={[
            styles.filterChipText,
            statusFilter === "closed" && styles.closedChipTextActive,
          ]}
        >
          Closed
        </Text>
      </TouchableOpacity>
    </ScrollView>
  </View>
);

export default FilterBar;
