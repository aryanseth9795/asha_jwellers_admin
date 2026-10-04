import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { Rehan, Lenden } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  transactionType: "rehan" | "lenden";
  rehan: Rehan | null;
  lenden: Lenden | null;
  formatDate: (dateString: string) => string;
}

const DateInfoSection: React.FC<Props> = ({
  transactionType,
  rehan,
  lenden,
  formatDate,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Date Information</Text>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="calendar" size={20} color="#007AFF" />
          </View>
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>
              {transactionType === "rehan" ? "Open Date" : "Entry Date"}
            </Text>
            <Text style={styles.infoValue}>
              {formatDate(
                transactionType === "rehan"
                  ? rehan?.openDate || ""
                  : lenden?.date || "",
              )}
            </Text>
          </View>
        </View>

        {transactionType === "rehan" && rehan?.closedDate && (
          <View style={styles.infoRow}>
            <View style={styles.iconContainer}>
              <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
            </View>
            <View style={styles.infoContent}>
              <Text style={styles.infoLabel}>Closed Date</Text>
              <Text style={styles.infoValue}>
                {formatDate(rehan.closedDate)}
              </Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

export default DateInfoSection;
