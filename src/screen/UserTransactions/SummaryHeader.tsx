import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { formatInr } from "../../utils/analytics/format";
import { Transaction } from "../../database/entryDatabase";
import { User } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  user: User | null;
  userName: string;
  transactions: Transaction[];
  totalOpenRehanAmount: number;
  totalBaki: number;
}

const SummaryHeader: React.FC<Props> = ({
  user,
  userName,
  transactions,
  totalOpenRehanAmount,
  totalBaki,
}) => (
  <View style={styles.summaryHeader}>
    <Text style={styles.summaryTitle} numberOfLines={2}>
      {user ? user.name : userName}
      {user?.nickname ? ` (${user.nickname})` : ""}
      's Transactions
    </Text>
    {user?.address && (
      <View style={styles.addressRow}>
        <Ionicons name="location" size={14} color="#666" />
        <Text style={styles.addressText} numberOfLines={1}>
          {user.address}
        </Text>
      </View>
    )}

    {/* Transaction Counts Row */}
    <View style={styles.summaryRow}>
      <View style={styles.summaryItem}>
        <Text
          style={styles.summaryCount}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {transactions.filter((t) => t.type === "rehan").length}
        </Text>
        <Text style={styles.summaryLabel}>Rehan</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.summaryItem}>
        <Text
          style={styles.summaryCount}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {transactions.filter((t) => t.type === "lenden").length}
        </Text>
        <Text style={styles.summaryLabel}>Len-Den</Text>
      </View>
    </View>

    {/* Financial Stats Row */}
    <View style={[styles.summaryRow, styles.statsRow]}>
      <View style={styles.statItem}>
        <View style={[styles.statIcon, styles.openRehanIcon]}>
          <Ionicons name="document-text" size={16} color="#2E7D32" />
        </View>
        <View>
          <Text
            style={[styles.statAmount, styles.openRehanAmount]}
            numberOfLines={1}
          >
            {formatInr(totalOpenRehanAmount)}
          </Text>
          <Text style={styles.statLabel}>Open Rehan</Text>
        </View>
      </View>
      <View style={styles.statItem}>
        <View style={[styles.statIcon, styles.bakiIcon]}>
          <Ionicons name="arrow-up-circle" size={16} color="#C62828" />
        </View>
        <View>
          <Text
            style={[styles.statAmount, styles.bakiAmount]}
            numberOfLines={1}
          >
            {formatInr(totalBaki)}
          </Text>
          <Text style={styles.statLabel}>Total Baki</Text>
        </View>
      </View>
    </View>
  </View>
);

export default SummaryHeader;
