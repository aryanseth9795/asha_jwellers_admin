import React, { useState, useEffect } from "react";
import { View, StyleSheet, TouchableOpacity } from "react-native";
import { BottomSheet, Text, TextInput } from "../ui";
import { Ionicons } from "@expo/vector-icons";
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
  minDate.setFullYear(minDate.getFullYear() - 15);

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
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={editMode ? "Edit Jama Payment" : "Add Jama Payment"}
      footer={
        <View style={styles.footer}>
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
      }
    >
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
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
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
    gap: 12,
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
