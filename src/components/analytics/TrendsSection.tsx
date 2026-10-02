import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { TrendRow } from "../../utils/analytics/trends";
import { formatCompactRupees, formatGrams, formatInr, formatPct } from "../../utils/analytics/format";
import { Change } from "../../utils/analytics/compare";
import BarChart from "./BarChart";
import { AnalyticsCard } from "./StatTile";

const pctText = (c: Change | null, upIsGood: boolean) => {
  if (!c || c.pct === null || c.delta === 0) return { text: "", color: "#888" };
  const up = c.delta > 0;
  return { text: `${up ? "▲" : "▼"}${formatPct(Math.abs(c.pct))}`, color: up === upIsGood ? "#2E7D32" : "#C62828" };
};

const COLUMNS = [
  { title: "Period", width: 120 },
  { title: "Bills", width: 50 },
  { title: "Sales", width: 110 },
  { title: "Collected", width: 110 },
  { title: "Rate", width: 56 },
  { title: "Old ret.", width: 90 },
  { title: "Baaki end", width: 110 },
  { title: "Gold", width: 90 },
  { title: "Silver", width: 90 },
];

const Cell: React.FC<{ width: number; text: string; change?: { text: string; color: string }; bold?: boolean }> = ({
  width, text, change, bold,
}) => (
  <View style={[styles.cell, { width }]}>
    <Text style={[styles.cellText, bold && styles.bold]} numberOfLines={1}>{text}</Text>
    {change?.text ? <Text style={[styles.change, { color: change.color }]}>{change.text}</Text> : null}
  </View>
);

const TrendsSection: React.FC<{ rows: TrendRow[] }> = ({ rows }) => {
  const newestFirst = [...rows].reverse();
  return (
    <View>
      <AnalyticsCard title="Sales and collections">
        <BarChart
          buckets={rows.map((r) => ({ key: r.label, label: r.label.split(" ")[0] }))}
          series={[
            { label: "Sales", color: "#B8860B", values: rows.map((r) => r.sales) },
            { label: "Collected", color: "#2E7D32", values: rows.map((r) => r.collected) },
          ]}
          formatValue={formatCompactRupees}
        />
      </AnalyticsCard>

      <AnalyticsCard title="Period by period">
        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            <View style={[styles.row, styles.header]}>
              {COLUMNS.map((c) => (
                <Text key={c.title} style={[styles.headerText, { width: c.width }]}>{c.title}</Text>
              ))}
            </View>
            {newestFirst.map((r) => (
              <View key={r.label} style={styles.row}>
                <Cell width={120} text={r.label} bold />
                <Cell width={50} text={String(r.bills)} />
                <Cell width={110} text={formatInr(r.sales)} change={pctText(r.change.sales, true)} />
                <Cell width={110} text={formatInr(r.collected)} change={pctText(r.change.collected, true)} />
                <Cell width={56} text={r.collectionRate === null ? "—" : formatPct(r.collectionRate)} />
                <Cell width={90} text={formatInr(r.oldReturned)} />
                <Cell width={110} text={formatInr(r.baakiAtEnd)} change={pctText(r.change.baakiAtEnd, false)} />
                <Cell width={90} text={formatGrams(r.goldGrams)} change={pctText(r.change.goldGrams, true)} />
                <Cell width={90} text={formatGrams(r.silverGrams)} change={pctText(r.change.silverGrams, true)} />
              </View>
            ))}
          </View>
        </ScrollView>
        <Text style={styles.note}>Newest first. ▲▼ compare with the period before. Baaki end of the current period is as of today.</Text>
      </AnalyticsCard>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  header: { backgroundColor: "#FAF1E2" },
  headerText: { fontSize: 11, fontWeight: "800", color: "#8C5B14", paddingVertical: 8, paddingHorizontal: 6 },
  cell: { paddingVertical: 8, paddingHorizontal: 6 },
  cellText: { fontSize: 13, color: "#1A1A1A" },
  bold: { fontWeight: "700" },
  change: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  note: { fontSize: 11, color: "#999", marginTop: 8 },
});

export default TrendsSection;
