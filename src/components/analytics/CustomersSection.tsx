import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "../../ui";
import { CustomersView, Tier } from "../../utils/analytics/customers";
import { formatRupees } from "../../utils/billFormat";
import { AnalyticsCard, StatGrid, StatTile } from "./StatTile";

const TIERS: { key: Tier; label: string; color: string }[] = [
  { key: "good", label: "Good", color: "#2E7D32" },
  { key: "medium", label: "Medium", color: "#F9A825" },
  { key: "low", label: "Low", color: "#9E9E9E" },
];

const CustomersSection: React.FC<{
  view: CustomersView;
  onCustomerPress: (userId: number, name: string) => void;
}> = ({ view, onCustomerPress }) => {
  const [tier, setTier] = useState<Tier>("good");
  const maxGap = Math.max(1, ...view.gapBins.map((b) => b.count));
  const inTier = view.customers.filter((c) => c.tier === tier);
  const listed = inTier.slice(0, 25);

  return (
    <View>
      <StatGrid>
        <StatTile label="Customers" value={String(view.totalCustomers)} hint="all time" />
        <StatTile label="Active" value={String(view.activeInPeriod)} hint={`${view.newInPeriod} new`} tone="good" />
        <StatTile label="Buyers" value={String(view.buyers)} />
        <StatTile
          label="Repeat"
          value={`${Math.round(view.repeatRate * 100)}%`}
          hint={`${view.repeatCustomers} came back`}
          tone="gold"
        />
      </StatGrid>

      <AnalyticsCard title="Time before buying again">
        <Text style={styles.muted}>
          {view.medianGapDays === null
            ? "No repeat purchases yet"
            : `Typical gap: ${Math.round(view.medianGapDays)} days`}
        </Text>
        {view.gapBins.map((bin) => (
          <View key={bin.label} style={styles.gapRow}>
            <Text style={styles.gapLabel}>{bin.label}</Text>
            <View style={styles.gapTrack}>
              <View style={[styles.gapFill, { flex: bin.count / maxGap }]} />
              <View style={{ flex: 1 - bin.count / maxGap }} />
            </View>
            <Text style={styles.gapCount}>{bin.count}</Text>
          </View>
        ))}
      </AnalyticsCard>

      <AnalyticsCard title="Customer nature">
        {view.buyers > 0 && (
          <View style={styles.tierBar}>
            {TIERS.map((t) =>
              view.tierCounts[t.key] > 0 ? (
                <View key={t.key} style={{ flex: view.tierCounts[t.key], backgroundColor: t.color }} />
              ) : null,
            )}
          </View>
        )}
        <View style={styles.chips}>
          {TIERS.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.chip, tier === t.key && { backgroundColor: t.color, borderColor: t.color }]}
              onPress={() => setTier(t.key)}
            >
              <Text style={[styles.chipText, tier === t.key && styles.chipTextActive]}>
                {t.label} · {view.tierCounts[t.key]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {listed.length === 0 ? (
          <Text style={styles.muted}>No customers in this group</Text>
        ) : (
          listed.map((c) => (
            <TouchableOpacity key={c.userId} style={styles.row} onPress={() => onCustomerPress(c.userId, c.name)}>
              <View style={styles.rowMain}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.sub}>
                  {c.visits} {c.visits === 1 ? "visit" : "visits"} · last {c.daysSinceLastVisit} days ago
                </Text>
              </View>
              {c.highBaaki && <Text style={styles.baakiBadge}>High baaki</Text>}
              <Text style={styles.sales}>{formatRupees(c.sales)}</Text>
            </TouchableOpacity>
          ))
        )}
        {inTier.length > listed.length && (
          <Text style={styles.muted}>Showing {listed.length} of {inTier.length}</Text>
        )}
        <Text style={styles.footnote}>
          Score = recent visit + how often + how much, compared with your other customers.
        </Text>
      </AnalyticsCard>
    </View>
  );
};

const styles = StyleSheet.create({
  muted: { color: "#777", fontSize: 13, marginBottom: 8 },
  gapRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  gapLabel: { width: 58, fontSize: 12, color: "#555" },
  gapTrack: { flex: 1, height: 10, flexDirection: "row", backgroundColor: "#F2F2F2", borderRadius: 5, overflow: "hidden" },
  gapFill: { backgroundColor: "#B8860B" },
  gapCount: { width: 28, textAlign: "right", fontSize: 12, color: "#333", fontWeight: "700" },
  tierBar: { flexDirection: "row", height: 12, borderRadius: 6, overflow: "hidden", marginBottom: 12 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 8 },
  chip: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: "#DDD" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#555" },
  chipTextActive: { color: "#fff" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  rowMain: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", color: "#1A1A1A" },
  sub: { fontSize: 12, color: "#888", marginTop: 2 },
  sales: { fontSize: 14, fontWeight: "700", color: "#7C4A08" },
  baakiBadge: { fontSize: 10, fontWeight: "700", color: "#C62828", backgroundColor: "#FDF0F0", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  footnote: { fontSize: 11, color: "#999", marginTop: 10 },
});

export default CustomersSection;
