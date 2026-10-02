import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Change } from "../../utils/analytics/compare";
import { KpiFormat } from "../../utils/analytics/overview";
import { formatGrams, formatInr, formatPct } from "../../utils/analytics/format";

export const formatKpi = (value: number | null, format: KpiFormat): string => {
  if (value === null) return "—";
  switch (format) {
    case "rupees":
      return formatInr(value);
    case "grams":
      return formatGrams(value);
    case "percent":
      return formatPct(value);
    case "count":
      return String(Math.round(value));
  }
};

const GOOD = "#2E7D32";
const BAD = "#C62828";
const NEUTRAL = "#888";

/** ▲/▼ with % (or the raw difference when there is no previous value), coloured by meaning. */
export const ChangeChip: React.FC<{
  change: Change | null;
  format: KpiFormat;
  upIsGood: boolean;
  prefix?: string;
}> = ({ change, format, upIsGood, prefix = "" }) => {
  if (!change || change.delta === 0) {
    return change ? <Text style={[styles.chip, { color: NEUTRAL }]}>{prefix}no change</Text> : null;
  }
  const up = change.delta > 0;
  const color = up === upIsGood ? GOOD : BAD;
  const amount =
    change.pct === null
      ? formatKpi(Math.abs(change.delta), format)
      : formatPct(Math.abs(change.pct));
  return (
    <Text style={[styles.chip, { color }]}>
      {prefix}
      {up ? "▲" : "▼"} {amount}
    </Text>
  );
};

export const KpiTile: React.FC<{
  label: string;
  value: number | null;
  format: KpiFormat;
  upIsGood: boolean;
  change: Change | null;
  yoy: Change | null;
}> = ({ label, value, format, upIsGood, change, yoy }) => (
  <View style={styles.tile}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
      {formatKpi(value, format)}
    </Text>
    <ChangeChip change={change} format={format} upIsGood={upIsGood} />
    <ChangeChip change={yoy} format={format} upIsGood={upIsGood} prefix="LY " />
  </View>
);

const styles = StyleSheet.create({
  tile: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  label: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  value: { fontSize: 19, fontWeight: "800", color: "#1A1A1A" },
  chip: { fontSize: 12, fontWeight: "700", marginTop: 3 },
});
