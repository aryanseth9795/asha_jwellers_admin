import React from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "../../../ui";

export interface SegmentOption<T extends string> {
  key: T;
  label: string;
}

/** Small chips that scroll sideways; with `fill`, equal segments that fill the row (sub-tabs, status). */
const Segmented = <T extends string>({
  options,
  value,
  onChange,
  fill = false,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
  fill?: boolean;
}) => {
  const chips = options.map((o) => {
    const active = value === o.key;
    return (
      <TouchableOpacity
        key={o.key}
        style={[styles.chip, fill && styles.fillChip, active && styles.active]}
        onPress={() => onChange(o.key)}
        hitSlop={fill ? undefined : 6}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text
          style={[styles.text, active && styles.activeText]}
          numberOfLines={1}
          adjustsFontSizeToFit={fill}
          minimumFontScale={fill ? 0.8 : undefined}
        >
          {o.label}
        </Text>
      </TouchableOpacity>
    );
  });
  return fill ? (
    <View style={styles.fillRow}>{chips}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  row: { gap: 6 },
  fillRow: { flexDirection: "row", gap: 6 },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#E8D5AF",
    backgroundColor: "#fff",
  },
  fillChip: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderRadius: 10 },
  active: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  text: { fontSize: 12, fontWeight: "700", color: "#8C5B14" },
  activeText: { color: "#fff" },
});

export default Segmented;
