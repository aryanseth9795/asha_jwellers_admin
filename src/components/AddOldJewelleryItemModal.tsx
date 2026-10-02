import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { NewOldJewelleryItem } from "../types/entry";

interface AddOldJewelleryItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (item: NewOldJewelleryItem) => void;
  editMode?: boolean;
  initialItem?: NewOldJewelleryItem;
}

const numericDecimal = (value: string): string => {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return `${cleaned.slice(0, firstDot + 1)}${cleaned
    .slice(firstDot + 1)
    .replace(/\./g, "")}`;
};

const AddOldJewelleryItemModal: React.FC<AddOldJewelleryItemModalProps> = ({
  visible,
  onClose,
  onSave,
  editMode = false,
  initialItem,
}) => {
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDescription(initialItem?.description ?? "");
    setWeight(
      initialItem?.weight != null ? String(initialItem.weight) : "",
    );
    setValue(initialItem ? String(initialItem.value) : "");
  }, [visible, initialItem]);

  const valueNumber = parseInt(value, 10);
  const canSave = description.trim().length > 0 && valueNumber > 0;

  const handleSave = () => {
    if (!canSave) return;
    const parsedWeight = parseFloat(weight);
    onSave({
      description: description.trim(),
      weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null,
      value: valueNumber,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>
                {editMode ? "Edit Old Jewellery" : "Old Jewellery"}
              </Text>
              <Text style={styles.subtitle}>Credit against this Len-Den sale</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color="#555" />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g. old gold chain"
              placeholderTextColor="#999"
              autoFocus
            />

            <Text style={styles.label}>Weight (grams, optional)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={(text) => setWeight(numericDecimal(text))}
              placeholder="e.g. 12.500"
              placeholderTextColor="#999"
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>
              Value (₹) <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.valueInputWrap}>
              <Text style={styles.rupee}>₹</Text>
              <TextInput
                style={styles.valueInput}
                value={value}
                onChangeText={(text) => setValue(text.replace(/[^0-9]/g, ""))}
                placeholder="0"
                placeholderTextColor="#999"
                keyboardType="numeric"
              />
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            disabled={!canSave}
            onPress={handleSave}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveText}>
              {editMode ? "Save Changes" : "Add Old Jewellery"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
  },
  sheet: {
    maxHeight: "82%",
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { color: "#1A1A1A", fontSize: 21, fontWeight: "800" },
  subtitle: { color: "#777", fontSize: 13, marginTop: 3 },
  closeButton: { padding: 5 },
  label: { color: "#333", fontSize: 14, fontWeight: "700", marginBottom: 7 },
  required: { color: "#D32F2F" },
  input: {
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    marginBottom: 18,
    color: "#1A1A1A",
    fontSize: 16,
  },
  valueInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DDD",
    borderRadius: 10,
    paddingHorizontal: 13,
    marginBottom: 20,
  },
  rupee: { color: "#8C5B14", fontSize: 19, fontWeight: "800", marginRight: 6 },
  valueInput: { flex: 1, paddingVertical: 11, color: "#1A1A1A", fontSize: 16 },
  saveButton: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#8C5B14",
  },
  saveButtonDisabled: { opacity: 0.45 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});

export default AddOldJewelleryItemModal;
