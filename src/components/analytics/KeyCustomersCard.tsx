import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "../../ui";
import { ImportanceView } from "../../utils/analytics/importance";
import { formatInr, formatPct } from "../../utils/analytics/format";
import { AnalyticsCard } from "./StatTile";

const KeyCustomersCard: React.FC<{
  view: ImportanceView;
  onCustomerPress: (userId: number, name: string) => void;
}> = ({ view, onCustomerPress }) => (
  <AnalyticsCard title="Most important customers">
    {view.buyers >= 5 && (
      <Text style={styles.headline}>
        Top 20% of buyers bring {formatPct(view.topFifthShare)} of sales
      </Text>
    )}
    {view.top.length === 0 ? (
      <Text style={styles.muted}>No purchases in this period</Text>
    ) : (
      view.top.map((c, i) => (
        <TouchableOpacity key={c.userId} style={styles.row} onPress={() => onCustomerPress(c.userId, c.name)}>
          <Text style={styles.rank}>{i + 1}</Text>
          <View style={styles.main}>
            <Text style={styles.name} numberOfLines={1}>{c.name}</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {c.village} · {c.visits} {c.visits === 1 ? "visit" : "visits"} · lifetime {formatInr(c.lifetimeSales)}
              {c.openBaaki > 0 ? ` · baaki ${formatInr(c.openBaaki)}` : ""}
            </Text>
          </View>
          <View style={styles.side}>
            <Text style={styles.sales}>{formatInr(c.periodSales)}</Text>
            <Text style={styles.share}>{formatPct(c.share)}</Text>
          </View>
        </TouchableOpacity>
      ))
    )}
  </AnalyticsCard>
);

const styles = StyleSheet.create({
  headline: { fontSize: 13, color: "#7C4A08", fontWeight: "700", marginBottom: 8 },
  muted: { color: "#999", fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  rank: { width: 20, fontSize: 13, fontWeight: "800", color: "#B8860B" },
  main: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  side: { alignItems: "flex-end" },
  sales: { fontSize: 14, fontWeight: "800", color: "#7C4A08" },
  share: { fontSize: 11, color: "#888" },
});

export default KeyCustomersCard;
