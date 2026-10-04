import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

interface DateSectionProps {
  selectedDate: Date;
  formatDisplayDate: (date: Date) => string;
  onOpenPicker: () => void;
}

const DateSection: React.FC<DateSectionProps> = ({
  selectedDate,
  formatDisplayDate,
  onOpenPicker,
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>
      Date <Text style={styles.required}>*</Text>
    </Text>

    <TouchableOpacity style={styles.dateButton} onPress={onOpenPicker}>
      <Ionicons name="calendar" size={20} color="#007AFF" />
      <Text style={styles.dateButtonText}>
        {formatDisplayDate(selectedDate)}
      </Text>
      <Ionicons name="chevron-down" size={20} color="#999" />
    </TouchableOpacity>
  </View>
);

export default DateSection;
