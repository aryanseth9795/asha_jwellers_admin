import React from "react";
import { View, TouchableOpacity, ActivityIndicator } from "react-native";
import { Text, TextInput, BottomSheet } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import VillagePicker from "../../components/VillagePicker";
import { styles } from "./styles";

interface Props {
  visible: boolean;
  isSaving: boolean;
  editName: string;
  setEditName: (value: string) => void;
  editNickname: string;
  setEditNickname: (value: string) => void;
  editAddress: string;
  setEditAddress: (value: string) => void;
  editMobile: string;
  setEditMobile: (value: string) => void;
  closeEditModal: () => void;
  handleSaveEdit: () => void;
}

/** Edit Customer Modal */
export const EditCustomerSheet: React.FC<Props> = ({
  visible,
  isSaving,
  editName,
  setEditName,
  editNickname,
  setEditNickname,
  editAddress,
  setEditAddress,
  editMobile,
  setEditMobile,
  closeEditModal,
  handleSaveEdit,
}) => (
  <BottomSheet
    visible={visible}
    onClose={closeEditModal}
    title="Edit Customer"
    footer={
      <View style={styles.modalFooter}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={closeEditModal}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.saveButton,
            isSaving && styles.saveButtonDisabled,
          ]}
          onPress={handleSaveEdit}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    }
  >
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>
        Name <Text style={styles.required}>*</Text>
      </Text>
      <TextInput
        style={styles.modalInput}
        value={editName}
        onChangeText={setEditName}
        placeholder="Customer name"
        placeholderTextColor="#999"
      />
    </View>

    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>Nick Name</Text>
      <TextInput
        style={styles.modalInput}
        value={editNickname}
        onChangeText={setEditNickname}
        placeholder="Nick name (optional)"
        placeholderTextColor="#999"
      />
    </View>

    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>Village</Text>
      <VillagePicker
        value={editAddress}
        onChange={setEditAddress}
        placeholder="Choose or type a village"
      />
    </View>

    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>Mobile Number</Text>
      <TextInput
        style={styles.modalInput}
        value={editMobile}
        onChangeText={setEditMobile}
        placeholder="Mobile number"
        placeholderTextColor="#999"
        keyboardType="phone-pad"
      />
    </View>
  </BottomSheet>
);
