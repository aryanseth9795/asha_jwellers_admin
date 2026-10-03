import React, { useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BottomSheet, Text, TextInput } from "../ui";
import { Ionicons } from "@expo/vector-icons";
import {
  JEWELLERY_METAL_OPTIONS,
  JewelleryMetal,
  NewOldJewelleryItem,
  PURITY_OPTIONS_BY_METAL,
  Purity,
} from "../types/entry";

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
  // No default metal: a wrong preselection would silently skew gold/silver
  // totals, so the user must pick one.
  const [metal, setMetal] = useState<JewelleryMetal | null>(null);
  const [purity, setPurity] = useState<Purity | null>(null);
  const [weight, setWeight] = useState("");
  const [value, setValue] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDescription(initialItem?.description ?? "");
    const initialMetal = initialItem?.metal ?? null;
    setMetal(initialMetal);
    setPurity(
      initialMetal &&
        initialItem?.purity &&
        PURITY_OPTIONS_BY_METAL[initialMetal].includes(initialItem.purity)
        ? initialItem.purity
        : null,
    );
    setWeight(
      initialItem?.weight != null ? String(initialItem.weight) : "",
    );
    setValue(initialItem ? String(initialItem.value) : "");
  }, [visible, initialItem]);

  const valueNumber = parseInt(value, 10);
  const canSave =
    description.trim().length > 0 && metal !== null && valueNumber > 0;

  const handleSave = () => {
    if (!canSave) return;
    const parsedWeight = parseFloat(weight);
    onSave({
      // Keep the item's identity on edit; a new item gets its uuid when it is stored.
      uuid: editMode ? initialItem?.uuid : undefined,
      description: description.trim(),
      metal,
      purity,
      weight: Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : null,
      value: valueNumber,
    });
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={editMode ? "Edit Old Jewellery" : "Old Jewellery"}
      subtitle="Credit against this Len-Den sale"
      footer={
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
      }
    >
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

      <Text style={styles.label}>
        Metal <Text style={styles.required}>*</Text>
      </Text>
      <View style={styles.chipRow}>
        {JEWELLERY_METAL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.chip, metal === option && styles.metalChipActive]}
            onPress={() => {
              if (option !== metal) setPurity(null);
              setMetal(option);
            }}
          >
            <Text
              style={[
                styles.metalText,
                metal === option && styles.chipTextActive,
              ]}
            >
              {option === "gold" ? "Gold" : "Silver"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {metal && (
        <>
          <Text style={styles.label}>शुद्धता / Purity (optional)</Text>
          <View style={styles.chipRow}>
            {PURITY_OPTIONS_BY_METAL[metal].map((option) => (
              <TouchableOpacity
                key={option}
                style={[
                  styles.chip,
                  purity === option && styles.purityChipActive,
                ]}
                onPress={() =>
                  setPurity((current) => (current === option ? null : option))
                }
              >
                <Text
                  style={[
                    styles.purityText,
                    purity === option && styles.chipTextActive,
                  ]}
                >
                  {option}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

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
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
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
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  chip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E8D5AF",
    backgroundColor: "#fff",
    alignItems: "center",
  },
  metalChipActive: { backgroundColor: "#B8860B", borderColor: "#B8860B" },
  purityChipActive: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  metalText: { fontSize: 13, fontWeight: "700", color: "#8A6500" },
  purityText: { fontSize: 13, fontWeight: "700", color: "#8C5B14" },
  chipTextActive: { color: "#fff" },
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
