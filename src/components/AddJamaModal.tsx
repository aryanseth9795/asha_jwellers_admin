import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import CustomDatePicker from "./CustomDatePicker";

interface AddJamaModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (amount: number, date: Date) => void;
  editMode?: boolean;
  initialAmount?: number;
  initialDate?: string;
}

const AddJamaModal: React.FC<AddJamaModalProps> = ({
  visible,
  onClose,
  onAdd,
  editMode = false,
  initialAmount,
  initialDate,
}) => {
  const insets = useSafeAreaInsets();
  const [amount, setAmount] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Initialize values when modal opens
  useEffect(() => {
    if (visible) {
      if (editMode && initialAmount) {
        setAmount(initialAmount.toString());
      } else {
        setAmount("");
      }
      if (editMode && initialDate) {
        setSelectedDate(new Date(initialDate));
      } else {
        setSelectedDate(new Date());
      }
    }
  }, [visible, editMode, initialAmount, initialDate]);

  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 5);

  const formatDisplayDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const handleAdd = () => {
    const amountNum = parseInt(amount, 10);
    if (amountNum > 0) {
      onAdd(amountNum, selectedDate);
      setAmount("");
      setSelectedDate(new Date());
      onClose();
    }
  };

  const handleClose = () => {
    setAmount("");
    setSelectedDate(new Date());
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editMode ? "Edit Jama Payment" : "Add Jama Payment"}
            </Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <View style={styles.body}>
            {/* Amount Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Amount (₹) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Enter jama amount"
                placeholderTextColor="#999"
                value={amount}
                onChangeText={(text) => setAmount(text.replace(/[^0-9]/g, ""))}
                keyboardType="numeric"
                autoFocus
              />
            </View>

            {/* Date Selection */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Date <Text style={styles.required}>*</Text>
              </Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons name="calendar" size={20} color="#007AFF" />
                <Text style={styles.dateButtonText}>
                  {formatDisplayDate(selectedDate)}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 20) },
            ]}
          >
            <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.addButton, !amount && styles.addButtonDisabled]}
              onPress={handleAdd}
              disabled={!amount}
            >
              <Ionicons name="checkmark" size={20} color="#fff" />
              <Text style={styles.addButtonText}>
                {editMode ? "Save" : "Add"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CustomDatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onClose={() => setShowDatePicker(false)}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
        minimumDate={minDate}
        maximumDate={new Date()}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  content: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1A1A1A",
  },
  body: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#444",
    marginBottom: 8,
  },
  required: {
    color: "#FF3B30",
  },
  input: {
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    color: "#1A1A1A",
  },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F0F7FF",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#D0E4FF",
  },
  dateButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#1A1A1A",
  },
  footer: {
    flexDirection: "row",
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "#F0F2F5",
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#F0F2F5",
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  addButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2E7D32",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addButtonDisabled: {
    backgroundColor: "#A5D6A7",
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

export default AddJamaModal;
