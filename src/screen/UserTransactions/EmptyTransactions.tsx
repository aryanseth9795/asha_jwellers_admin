import React from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { styles } from "./styles";

const EmptyTransactions: React.FC = () => (
  <View style={styles.emptyContainer}>
    <Ionicons name="document-outline" size={64} color="#CCC" />
    <Text style={styles.emptyTitle}>No Transactions</Text>
    <Text style={styles.emptySubtitle}>
      This customer has no transactions yet
    </Text>
  </View>
);

export default EmptyTransactions;
