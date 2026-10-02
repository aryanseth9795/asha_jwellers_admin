import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "../../../ui";

export interface HBarRow {
  key: string;
  label: string;
  value: number;
  display: string;
  muted?: boolean; // e.g. "All other items", "Other villages"
  highlight?: boolean; // the row picked in the filters
  color?: string;
  onPress?: () => void;
}

/** Horizontal bars, one row each, scaled to the largest value. */
const HBars: React.FC<{ rows: HBarRow[]; emptyText?: string; labelWidth?: number }> = ({
  rows,
  emptyText = "No data in this view",
  labelWidth = 104,
}) => {
  const max = rows.reduce((m, r) => Math.max(m, r.value), 0);
  if (max <= 0) return <Text style={styles.empty}>{emptyText}</Text>;
  return (
    <View>
      {rows.map((r) => {
        const fill = Math.max(0, r.value) / max;
        const body = (
          <View style={styles.row}>
            <Text style={[styles.label, { width: labelWidth }, r.highlight && styles.bold]} numberOfLines={1}>
              {r.label}
            </Text>
            <View style={styles.track}>
              <View
                style={{
                  flex: fill,
                  backgroundColor: r.color ?? (r.muted ? "#B9B2A6" : r.highlight ? "#8C5B14" : "#B8860B"),
                  borderRadius: 3,
                }}
              />
              <View style={{ flex: 1 - fill }} />
            </View>
            <Text style={[styles.value, r.highlight && styles.bold]}>{r.display}</Text>
          </View>
        );
        return r.onPress ? (
          <TouchableOpacity key={r.key} onPress={r.onPress}>
            {body}
          </TouchableOpacity>
        ) : (
          <View key={r.key}>{body}</View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  label: { fontSize: 12, color: "#444" },
  track: { flex: 1, height: 12, flexDirection: "row" },
  value: { minWidth: 64, textAlign: "right", fontSize: 12, fontWeight: "700", color: "#1A1A1A" },
  bold: { fontWeight: "800", color: "#1A1A1A" },
  empty: { color: "#999", fontSize: 13, paddingVertical: 12 },
});

export default HBars;
