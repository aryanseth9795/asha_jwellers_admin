import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SalesView } from "../../utils/analytics/sales";
import { formatCompactRupees } from "../../utils/analytics/format";
import { formatRupees } from "../../utils/billFormat";
import BarChart from "./BarChart";
import { AnalyticsCard, StatGrid, StatTile } from "./StatTile";

const SalesSection: React.FC<{
  view: SalesView;
  onCustomerPress: (userId: number, name: string) => void;
}> = ({ view, onCustomerPress }) => (
  <View>
    <StatGrid>
      <StatTile label="Sales" value={formatRupees(view.sales)} hint={`${view.bills} bills`} tone="gold" />
      <StatTile label="Collected" value={formatRupees(view.collected)} hint="by payment date" tone="good" />
      <StatTile
        label="Net sales"
        value={formatRupees(view.netSales)}
        hint={`after old ${formatCompactRupees(view.oldCredit)} · discount ${formatCompactRupees(view.discount)}`}
      />
      <StatTile label="Avg bill" value={formatRupees(view.avgBill)} />
      <StatTile label="Baaki (open)" value={formatRupees(view.baakiOutstanding)} hint="as of today" tone="warn" />
    </StatGrid>

    <AnalyticsCard title="Sales vs collected">
      <BarChart
        buckets={view.buckets}
        series={[
          { label: "Sales", color: "#B8860B", values: view.salesSeries },
          { label: "Collected", color: "#2E7D32", values: view.collectedSeries },
        ]}
        formatValue={formatCompactRupees}
      />
    </AnalyticsCard>

    <AnalyticsCard title="Highest baaki">
      {view.topBaaki.length === 0 ? (
        <Text style={styles.muted}>No open baaki</Text>
      ) : (
        view.topBaaki.map((c) => (
          <TouchableOpacity key={c.userId} style={styles.row} onPress={() => onCustomerPress(c.userId, c.name)}>
            <Text style={styles.name}>{c.name}</Text>
            <Text style={styles.baki}>{formatRupees(c.baki)}</Text>
          </TouchableOpacity>
        ))
      )}
    </AnalyticsCard>
  </View>
);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F2F5",
  },
  name: { fontSize: 15, color: "#1A1A1A", fontWeight: "600" },
  baki: { fontSize: 15, color: "#C62828", fontWeight: "700" },
  muted: { color: "#999", fontSize: 13 },
});

export default SalesSection;
