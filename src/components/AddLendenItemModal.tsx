import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Text, TextInput } from "../ui";
import { Ionicons } from "@expo/vector-icons";
import {
  JewelleryMetal,
  JEWELLERY_METAL_OPTIONS,
  NewLendenItem,
  Purity,
  PURITY_OPTIONS_BY_METAL,
} from "../types/entry";

interface AddLendenItemModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (item: NewLendenItem) => void;
  editMode?: boolean;
  initialItem?: NewLendenItem;
}

const AddLendenItemModal: React.FC<AddLendenItemModalProps> = ({
  visible,
  onClose,
  onSave,
  editMode = false,
  initialItem,
}) => {
  const [name, setName] = useState("");
  const [metal, setMetal] = useState<JewelleryMetal>("gold");
  const [purity, setPurity] = useState<Purity>("22KT");
  const [weight, setWeight] = useState("");
  const [qty, setQty] = useState("1");
  const [rate, setRate] = useState("");
  const [total, setTotal] = useState("");
  // Once the user edits the total by hand we stop recomputing it for them.
  const [totalTouched, setTotalTouched] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (editMode && initialItem) {
      const initialMetal: JewelleryMetal =
        initialItem.metal ??
        (initialItem.purity === "Silver" ? "silver" : "gold");
      setName(initialItem.name);
      setMetal(initialMetal);
      setPurity(
        initialItem.purity &&
          PURITY_OPTIONS_BY_METAL[initialMetal].includes(initialItem.purity)
          ? initialItem.purity
          : PURITY_OPTIONS_BY_METAL[initialMetal][0],
      );
      setWeight(initialItem.weight != null ? String(initialItem.weight) : "");
      setQty(initialItem.qty != null ? String(initialItem.qty) : "1");
      setRate(initialItem.rate != null ? String(initialItem.rate) : "");
      setTotal(String(initialItem.total));
      setTotalTouched(true);
    } else {
      setName("");
      setMetal("gold");
      setPurity("22KT");
      setWeight("");
      setQty("1");
      setRate("");
      setTotal("");
      setTotalTouched(false);
    }
  }, [visible, editMode, initialItem]);

  // Auto-fill total = weight x rate until the user overrides it.
  // Never in edit mode: a stored total is already the user's value, and
  // recomputing it would discard a deliberate rounding.
  useEffect(() => {
    if (totalTouched || editMode) return;
    const w = parseFloat(weight);
    const r = parseInt(rate, 10);
    if (w > 0 && r > 0) {
      setTotal(String(Math.round(w * r)));
    } else {
      setTotal("");
    }
  }, [weight, rate, totalTouched, editMode]);

  const totalNum = parseInt(total, 10) || 0;
  const canSave = name.trim().length > 0 && totalNum > 0;
  const purityOptions: Purity[] = PURITY_OPTIONS_BY_METAL[metal];

  const handleSave = () => {
    if (!canSave) return;
    const w = parseFloat(weight);
    const q = parseInt(qty, 10);
    const r = parseInt(rate, 10);
    onSave({
      name: name.trim(),
      metal,
      purity,
      weight: Number.isFinite(w) ? w : null,
      qty: Number.isFinite(q) && q > 0 ? q : 1,
      rate: Number.isFinite(r) ? r : null,
      total: totalNum,
    });
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {editMode ? "Edit Item" : "Add Item"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                विवरण / Description <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. मांगटीका"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Metal</Text>
              <View style={styles.metalRow}>
                {JEWELLERY_METAL_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.metalChip,
                      metal === option && styles.metalChipActive,
                    ]}
                    onPress={() => {
                      setMetal(option);
                      setPurity(PURITY_OPTIONS_BY_METAL[option][0]);
                    }}
                  >
                    <Text
                      style={[
                        styles.metalText,
                        metal === option && styles.metalTextActive,
                      ]}
                    >
                      {option === "gold" ? "Gold" : "Silver"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>शुद्धता / Purity</Text>
              <View style={styles.purityRow}>
                {purityOptions.map((option) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.purityChip,
                      purity === option && styles.purityChipActive,
                    ]}
                    onPress={() => setPurity(option)}
                  >
                    <Text
                      style={[
                        styles.purityText,
                        purity === option && styles.purityTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>वजन / Weight (g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="3.500"
                  placeholderTextColor="#999"
                  value={weight}
                  onChangeText={(t) => setWeight(t.replace(/[^0-9.]/g, ""))}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={[styles.inputGroup, { width: 75, marginHorizontal: 8 }]}>
                <Text style={styles.label}>मात्रा / Qty</Text>
                <TextInput
                  style={styles.input}
                  placeholder="1"
                  placeholderTextColor="#999"
                  value={qty}
                  onChangeText={(t) => setQty(t.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex1]}>
                <Text style={styles.label}>दर / Rate (₹/g)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="14500"
                  placeholderTextColor="#999"
                  value={rate}
                  onChangeText={(t) => setRate(t.replace(/[^0-9]/g, ""))}
                  keyboardType="numeric"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                कुल राशि / Total (₹) <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.totalInput]}
                placeholder="0"
                placeholderTextColor="#999"
                value={total}
                onChangeText={(t) => {
                  setTotalTouched(true);
                  setTotal(t.replace(/[^0-9]/g, ""));
                }}
                keyboardType="numeric"
              />
              {!totalTouched && (
                <Text style={styles.hint}>Auto-calculated from weight × rate</Text>
              )}
            </View>
          </ScrollView>

          <TouchableOpacity
            style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>
              {editMode ? "Update Item" : "Add Item"}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  content: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  title: { fontSize: 18, fontWeight: "700", color: "#1A1A1A" },
  body: { paddingHorizontal: 20, paddingTop: 16 },
  inputGroup: { marginBottom: 16 },
  row: { flexDirection: "row", gap: 12 },
  flex1: { flex: 1 },
  label: { fontSize: 14, fontWeight: "600", color: "#666", marginBottom: 8 },
  required: { color: "#FF3B30" },
  input: {
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#D0E4FF",
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: "#1A1A1A",
  },
  totalInput: { fontWeight: "700", fontSize: 18 },
  hint: { fontSize: 12, color: "#999", marginTop: 6 },
  metalRow: { flexDirection: "row", gap: 8 },
  metalChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D0E4FF",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  metalChipActive: { backgroundColor: "#B8860B", borderColor: "#B8860B" },
  metalText: { fontSize: 13, fontWeight: "700", color: "#8A6500" },
  metalTextActive: { color: "#fff" },
  purityRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  purityChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D0E4FF",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  purityChipActive: { backgroundColor: "#007AFF", borderColor: "#007AFF" },
  purityText: { fontSize: 13, fontWeight: "700", color: "#007AFF" },
  purityTextActive: { color: "#fff" },
  saveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#007AFF",
    marginHorizontal: 20,
    marginTop: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveButtonDisabled: { backgroundColor: "#A0C4FF" },
  saveButtonText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});

export default AddLendenItemModal;
