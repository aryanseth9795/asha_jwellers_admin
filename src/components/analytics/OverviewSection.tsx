import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import { OverviewView } from "../../utils/analytics/overview";
import { formatCompactRupees } from "../../utils/analytics/format";
import BarChart, { ChartSeries } from "./BarChart";
import { AnalyticsCard, StatGrid } from "./StatTile";
import { KpiTile } from "./KpiTile";

const TONE = {
  good: { icon: "trending-up", color: "#2E7D32" },
  bad: { icon: "alert-circle", color: "#C62828" },
  info: { icon: "bulb", color: "#B8860B" },
} as const;

const OverviewSection: React.FC<{
  view: OverviewView;
  previousLabel: string | null;
  lastYearLabel: string | null;
}> = ({ view, previousLabel, lastYearLabel }) => {
  const series: ChartSeries[] = [{ label: "This period", color: "#B8860B", values: view.salesSeries }];
  if (view.previousSalesSeries) {
    series.push({ label: previousLabel ?? "Previous", color: "#E3D3B0", values: view.previousSalesSeries });
  }
  return (
    <View>
      {(previousLabel || lastYearLabel) && (
        <Text style={styles.legend}>
          {previousLabel ? `▲▼ vs ${previousLabel}` : ""}
          {lastYearLabel ? `  ·  LY = ${lastYearLabel}` : ""}
        </Text>
      )}
      <StatGrid>
        {view.kpis.map((k) => (
          <KpiTile
            key={k.key}
            label={k.label}
            value={k.value}
            format={k.format}
            upIsGood={k.upIsGood}
            change={k.change}
            yoy={k.yoy}
          />
        ))}
      </StatGrid>

      <AnalyticsCard title="Insights">
        {view.insights.length === 0 ? (
          <Text style={styles.muted}>Not enough data in this period yet</Text>
        ) : (
          view.insights.map((insight, i) => (
            <View key={i} style={styles.insight}>
              <Ionicons name={TONE[insight.tone].icon} size={18} color={TONE[insight.tone].color} />
              <Text style={styles.insightText}>{insight.text}</Text>
            </View>
          ))
        )}
      </AnalyticsCard>

      <AnalyticsCard title="Sales">
        <BarChart buckets={view.buckets} series={series} formatValue={formatCompactRupees} />
      </AnalyticsCard>
    </View>
  );
};

const styles = StyleSheet.create({
  legend: { fontSize: 12, color: "#777", marginBottom: 8 },
  muted: { color: "#999", fontSize: 13 },
  insight: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingVertical: 7 },
  insightText: { flex: 1, fontSize: 14, color: "#1A1A1A", lineHeight: 20 },
});

export default OverviewSection;
