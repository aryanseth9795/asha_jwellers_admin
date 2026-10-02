import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity } from "react-native";

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

/** A row of small chips; scrolls sideways when there are many. */
const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
}) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {options.map((o) => (
      <TouchableOpacity key={o.key} style={[styles.chip, value === o.key && styles.active]} onPress={() => onChange(o.key)}>
        <Text style={[styles.text, value === o.key && styles.activeText]}>{o.label}</Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const styles = StyleSheet.create({
  row: { gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E8D5AF",
    backgroundColor: "#fff",
  },
  active: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  text: { fontSize: 12, fontWeight: "700", color: "#8C5B14" },
  activeText: { color: "#fff" },
});

export default Segmented;
