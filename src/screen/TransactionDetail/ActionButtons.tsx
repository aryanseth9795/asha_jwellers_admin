import React from "react";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../../ui";
import { Rehan } from "../../types/entry";
import { styles } from "./styles";

interface Props {
  transactionType: "rehan" | "lenden";
  rehan: Rehan | null;
  isEditMode: boolean;
  lendenItemCount: number;
  handleCloseRehan: () => void | Promise<void>;
  openGenerateBill: () => void;
}

const ActionButtons: React.FC<Props> = ({
  transactionType,
  rehan,
  isEditMode,
  lendenItemCount,
  handleCloseRehan,
  openGenerateBill,
}) => {
  return (
    <>
      {/* Close Rehan Button - only for open Rehan entries */}
      {transactionType === "rehan" && rehan?.status === 0 && !isEditMode && (
        <TouchableOpacity
          style={styles.closeRehanButton}
          onPress={handleCloseRehan}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.closeRehanButtonText}>Mark as Closed</Text>
        </TouchableOpacity>
      )}

      {transactionType === "lenden" && !isEditMode && (
        <TouchableOpacity
          style={[
            styles.billButton,
            lendenItemCount === 0 && styles.billButtonDisabled,
          ]}
          onPress={openGenerateBill}
          disabled={lendenItemCount === 0}
        >
          <Ionicons name="receipt" size={20} color="#fff" />
          <Text style={styles.billButtonText} numberOfLines={1}>
            बिल बनाएं / Generate Bill
          </Text>
        </TouchableOpacity>
      )}
    </>
  );
};

export default ActionButtons;
