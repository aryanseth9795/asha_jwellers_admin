import React from "react";
import { View, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import RehanTransactionTable from "../../components/RehanTransactionTable";
import { Rehan, RehanTransaction } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  rehan: Rehan;
  rehanTransactions: RehanTransaction[];
  onAddTransaction: () => void;
  onDeleteTransaction: (id: number) => void | Promise<void>;
}

const RehanHistorySection: React.FC<Props> = ({
  rehan,
  rehanTransactions,
  onAddTransaction,
  onDeleteTransaction,
}) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Transaction History</Text>
        {rehan.status === 0 && (
          <TouchableOpacity
            style={styles.addTransactionButton}
            onPress={onAddTransaction}
          >
            <Ionicons name="add-circle" size={16} color="#007AFF" />
            <Text style={styles.addTransactionText}>Add Transaction</Text>
          </TouchableOpacity>
        )}
      </View>
      <RehanTransactionTable
        transactions={rehanTransactions}
        onDeleteTransaction={onDeleteTransaction}
      />
    </View>
  );
};

export default RehanHistorySection;
