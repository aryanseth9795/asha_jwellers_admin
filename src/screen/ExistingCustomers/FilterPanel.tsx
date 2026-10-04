import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text, TextInput } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { FilterTransactionType } from "./useExistingCustomers";
import { styles } from "./styles";

interface Props {
  filterAddress: string;
  setFilterAddress: (value: string) => void;
  filterMobile: string;
  setFilterMobile: (value: string) => void;
  filterDateFrom: Date | null;
  setFilterDateFrom: (value: Date | null) => void;
  filterDateTo: Date | null;
  setFilterDateTo: (value: Date | null) => void;
  setShowDateFromPicker: (value: boolean) => void;
  setShowDateToPicker: (value: boolean) => void;
  filterTransactionType: FilterTransactionType;
  setFilterTransactionType: (value: FilterTransactionType) => void;
}

const formatDate = (date: Date | null) => {
  if (!date) return "";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

/** Collapsible Filter Panel */
export const FilterPanel: React.FC<Props> = ({
  filterAddress,
  setFilterAddress,
  filterMobile,
  setFilterMobile,
  filterDateFrom,
  setFilterDateFrom,
  filterDateTo,
  setFilterDateTo,
  setShowDateFromPicker,
  setShowDateToPicker,
  filterTransactionType,
  setFilterTransactionType,
}) => (
  <View style={styles.filterPanel}>
    {/* Address Filter */}
    <View style={styles.filterRow}>
      <View style={styles.filterInputContainer}>
        <Ionicons name="location-outline" size={18} color="#666" />
        <TextInput
          style={styles.filterInput}
          placeholder="Filter by address..."
          placeholderTextColor="#999"
          value={filterAddress}
          onChangeText={setFilterAddress}
        />
        {filterAddress.length > 0 && (
          <TouchableOpacity onPress={() => setFilterAddress("")}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>
    </View>

    {/* Mobile Number Filter */}
    <View style={styles.filterRow}>
      <View style={styles.filterInputContainer}>
        <Ionicons name="call-outline" size={18} color="#666" />
        <TextInput
          style={styles.filterInput}
          placeholder="Filter by mobile..."
          placeholderTextColor="#999"
          value={filterMobile}
          onChangeText={setFilterMobile}
          keyboardType="phone-pad"
        />
        {filterMobile.length > 0 && (
          <TouchableOpacity onPress={() => setFilterMobile("")}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        )}
      </View>
    </View>

    {/* Date Range Filter */}
    <View style={styles.dateFilterRow}>
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={() => setShowDateFromPicker(true)}
      >
        <Ionicons name="calendar-outline" size={18} color="#666" />
        <Text
          style={[
            styles.datePickerText,
            filterDateFrom && styles.datePickerTextActive,
          ]}
        >
          {filterDateFrom ? formatDate(filterDateFrom) : "From Date"}
        </Text>
        {filterDateFrom && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              setFilterDateFrom(null);
            }}
          >
            <Ionicons name="close-circle" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Text style={styles.dateSeparator}>—</Text>

      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={() => setShowDateToPicker(true)}
      >
        <Ionicons name="calendar-outline" size={18} color="#666" />
        <Text
          style={[
            styles.datePickerText,
            filterDateTo && styles.datePickerTextActive,
          ]}
        >
          {filterDateTo ? formatDate(filterDateTo) : "To Date"}
        </Text>
        {filterDateTo && (
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              setFilterDateTo(null);
            }}
          >
            <Ionicons name="close-circle" size={16} color="#999" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </View>

    {/* Transaction Type Switch */}
    <View style={styles.transactionTypeContainer}>
      <Text style={styles.transactionTypeLabel}>Transaction Type:</Text>
      <View style={styles.transactionTypeSwitches}>
        <TouchableOpacity
          style={[
            styles.typeButton,
            filterTransactionType === "both" && styles.typeButtonActive,
          ]}
          onPress={() => setFilterTransactionType("both")}
        >
          <Text
            style={[
              styles.typeButtonText,
              filterTransactionType === "both" &&
                styles.typeButtonTextActive,
            ]}
          >
            Both
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeButton,
            styles.rehanTypeButton,
            filterTransactionType === "rehan" &&
              styles.rehanTypeButtonActive,
          ]}
          onPress={() => setFilterTransactionType("rehan")}
        >
          <Text
            style={[
              styles.typeButtonText,
              filterTransactionType === "rehan" &&
                styles.typeButtonTextActive,
            ]}
          >
            Rehan
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.typeButton,
            styles.lendenTypeButton,
            filterTransactionType === "lenden" &&
              styles.lendenTypeButtonActive,
          ]}
          onPress={() => setFilterTransactionType("lenden")}
        >
          <Text
            style={[
              styles.typeButtonText,
              filterTransactionType === "lenden" &&
                styles.typeButtonTextActive,
            ]}
          >
            Lenden
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);
