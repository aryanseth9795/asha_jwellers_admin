import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AgingBucket } from "../../utils/analytics/baki";
import { formatInr } from "../../utils/analytics/format";
import { AnalyticsCard } from "./StatTile";

const BaakiAgingCard: React.FC<{ aging: AgingBucket[] }> = ({ aging }) => {
  const max = Math.max(1, ...aging.map((b) => b.amount));
  return (
    <AnalyticsCard title="How old is the baaki (as of today)">
      {aging.map((b, i) => (
        <View key={b.label} style={styles.row}>
          <Text style={styles.label}>{b.label}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { flex: b.amount / max, backgroundColor: i >= 3 ? "#C62828" : "#B8860B" }]} />
            <View style={{ flex: 1 - b.amount / max }} />
          </View>
          <Text style={styles.amount}>{formatInr(b.amount)}</Text>
          <Text style={styles.count}>{b.count}</Text>
        </View>
      ))}
      <Text style={styles.note}>Open bills by age; last column is the number of bills.</Text>
    </AnalyticsCard>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  label: { width: 84, fontSize: 12, color: "#555" },
  track: { flex: 1, height: 10, flexDirection: "row", borderRadius: 5, backgroundColor: "#F2F2F2", overflow: "hidden" },
  fill: {},
  amount: { width: 86, textAlign: "right", fontSize: 12, fontWeight: "700", color: "#1A1A1A" },
  count: { width: 24, textAlign: "right", fontSize: 12, color: "#888" },
  note: { fontSize: 11, color: "#999", marginTop: 6 },
});

export default BaakiAgingCard;
