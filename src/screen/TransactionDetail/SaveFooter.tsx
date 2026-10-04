import React from "react";
import { TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text, FooterBar } from "../../ui";
import { styles } from "./styles";

interface Props {
  isEditMode: boolean;
  hasChanges: boolean;
  isSaving: boolean;
  handleSaveChanges: () => void | Promise<void>;
}

const SaveFooter: React.FC<Props> = ({
  isEditMode,
  hasChanges,
  isSaving,
  handleSaveChanges,
}) => {
  return (
    <>
      {/* Save Changes Button - only in edit mode with changes */}
      {isEditMode && hasChanges && (
        <FooterBar>
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </FooterBar>
      )}
    </>
  );
};

export default SaveFooter;
