import React from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { styles } from "./styles";

interface SaveButtonProps {
  isLoading: boolean;
  onSave: () => void;
}

const SaveButton: React.FC<SaveButtonProps> = ({ isLoading, onSave }) => (
  <TouchableOpacity
    style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
    onPress={onSave}
    disabled={isLoading}
  >
    {isLoading ? (
      <ActivityIndicator color="#fff" />
    ) : (
      <>
        <Ionicons name="checkmark-circle" size={22} color="#fff" />
        <Text style={styles.saveButtonText}>Save Transaction</Text>
      </>
    )}
  </TouchableOpacity>
);

export default SaveButton;
