import React from "react";
import { View } from "react-native";
import { Text } from "../../ui";
import BillTable from "../../components/BillTable";
import { JamaEntry, Lenden } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  lenden: Lenden;
  oldJewelleryCredit: number;
  jamaEntries: JamaEntry[];
  isEditMode: boolean;
  onAddJama: () => void;
  onEditJama: (index: number) => void;
  onDeleteJama: (index: number) => void | Promise<void>;
}

const PaymentSummarySection: React.FC<Props> = ({
  lenden,
  oldJewelleryCredit,
  jamaEntries,
  isEditMode,
  onAddJama,
  onEditJama,
  onDeleteJama,
}) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Payment Summary</Text>
        {lenden.status === 1 && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedBadgeText}>CLOSED</Text>
          </View>
        )}
      </View>
      <BillTable
        amount={lenden.amount || 0}
        oldJewelleryCredit={oldJewelleryCredit}
        discount={lenden.discount || 0}
        jamaEntries={jamaEntries}
        editable={!isEditMode}
        onAddJama={onAddJama}
        onEditJama={onEditJama}
        onDeleteJama={onDeleteJama}
      />
    </View>
  );
};

export default PaymentSummarySection;
