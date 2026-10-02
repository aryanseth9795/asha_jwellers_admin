import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CategoryStat } from "../../utils/analytics/categories";
import { formatGrams, formatInr, formatPct } from "../../utils/analytics/format";
import { AnalyticsCard } from "./StatTile";
import { ChangeChip } from "./KpiTile";

const COLOR = { gold: "#D4A017", silver: "#9AA5B1", unknown: "#C9B8B8" } as const;

const CategoriesCard: React.FC<{ categories: CategoryStat[] }> = ({ categories }) => (
  <AnalyticsCard title="Categories (metal + purity)">
    {categories.length === 0 ? (
      <Text style={styles.muted}>No items sold in this period</Text>
    ) : (
      categories.map((c) => (
        <View key={c.key} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: COLOR[c.metal] }]} />
          <View style={styles.main}>
            <Text style={styles.name}>{c.label}</Text>
            <Text style={styles.sub}>
              {formatGrams(c.weight)} · {c.items} {c.items === 1 ? "item" : "items"} · {formatPct(c.share)}
            </Text>
          </View>
          <View style={styles.side}>
            <Text style={styles.value}>{formatInr(c.value)}</Text>
            <ChangeChip change={c.growth} format="rupees" upIsGood />
          </View>
        </View>
      ))
    )}
  </AnalyticsCard>
);

const styles = StyleSheet.create({
  muted: { color: "#999", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  dot: { width: 10, height: 10, borderRadius: 5 },
  main: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  side: { alignItems: "flex-end" },
  value: { fontSize: 14, fontWeight: "800", color: "#7C4A08" },
});

export default CategoriesCard;
