import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { VillageStat } from "../../utils/analytics/villages";
import { formatInr, formatPct } from "../../utils/analytics/format";
import { AnalyticsCard } from "./StatTile";
import { ChangeChip } from "./KpiTile";

const VillagesSection: React.FC<{ villages: VillageStat[] }> = ({ villages }) => (
  <AnalyticsCard title="Villages by sales">
    {villages.length === 0 ? (
      <Text style={styles.muted}>No customers yet</Text>
    ) : (
      villages.map((v) => (
        <View key={v.key || "none"} style={styles.row}>
          <View style={styles.top}>
            <Text style={styles.name} numberOfLines={1}>{v.name}</Text>
            <Text style={styles.sales}>{formatInr(v.sales)}</Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { flex: v.share }]} />
            <View style={{ flex: 1 - v.share }} />
          </View>
          <View style={styles.bottom}>
            <Text style={styles.sub}>
              {formatPct(v.share)} · {v.buyers}/{v.customers} customers bought
              {v.openBaaki > 0 ? ` · baaki ${formatInr(v.openBaaki)}` : ""}
            </Text>
            <ChangeChip change={v.growth} format="rupees" upIsGood />
          </View>
        </View>
      ))
    )}
  </AnalyticsCard>
);

const styles = StyleSheet.create({
  muted: { color: "#999", fontSize: 13 },
  row: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  top: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  name: { flex: 1, fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  sales: { fontSize: 15, fontWeight: "800", color: "#7C4A08" },
  track: { flexDirection: "row", height: 6, borderRadius: 3, backgroundColor: "#F2F2F2", overflow: "hidden", marginVertical: 6 },
  fill: { backgroundColor: "#B8860B" },
  bottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  sub: { flex: 1, fontSize: 12, color: "#777" },
});

export default VillagesSection;
