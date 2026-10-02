import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Bucket } from "../../utils/analytics/periods";

export interface ChartSeries {
  label: string;
  color: string;
  values: number[];
}

interface BarChartProps {
  buckets: Bucket[];
  series: ChartSeries[];
  stacked?: boolean;
  formatValue: (value: number) => string;
  height?: number;
  labelEvery?: number;
}

const BarChart: React.FC<BarChartProps> = ({
  buckets,
  series,
  stacked = false,
  formatValue,
  height = 140,
  labelEvery = 1,
}) => {
  const columnTotals = buckets.map((_, i) =>
    stacked
      ? series.reduce((total, s) => total + s.values[i], 0)
      : Math.max(0, ...series.map((s) => s.values[i])),
  );
  const max = Math.max(0, ...columnTotals);

  if (max <= 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No data for this period</Text>
      </View>
    );
  }

  const barHeight = (value: number) => (value > 0 ? Math.max(2, (value / max) * height) : 0);

  return (
    <View>
      <Text style={styles.maxLabel}>{formatValue(max)}</Text>
      <View style={[styles.plot, { height }]}>
        {buckets.map((bucket, i) => (
          <View key={bucket.key} style={styles.column}>
            <View style={stacked ? styles.stack : styles.group}>
              {series.map((s) => (
                <View
                  key={s.label}
                  style={[
                    stacked ? styles.stackSegment : styles.bar,
                    { height: barHeight(s.values[i]), backgroundColor: s.color },
                  ]}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {buckets.map((bucket, i) => (
          <Text key={bucket.key} style={styles.label} numberOfLines={1}>
            {i % labelEvery === 0 ? bucket.label : ""}
          </Text>
        ))}
      </View>
      {series.length > 1 && (
        <View style={styles.legend}>
          {series.map((s) => (
            <View key={s.label} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: s.color }]} />
              <Text style={styles.legendText}>{s.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  maxLabel: { fontSize: 11, color: "#999", marginBottom: 4 },
  plot: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E5E5",
  },
  column: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  group: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  stack: { flexDirection: "column-reverse", alignItems: "center" },
  bar: { width: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  stackSegment: { width: 14 },
  labels: { flexDirection: "row", marginTop: 4 },
  label: { flex: 1, fontSize: 9, color: "#777", textAlign: "center" },
  legend: { flexDirection: "row", gap: 14, marginTop: 10, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 12, color: "#555" },
  empty: { paddingVertical: 32, alignItems: "center" },
  emptyText: { color: "#999", fontSize: 13 },
});

export default BarChart;
