import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../ui";

export type TileTone = "default" | "good" | "warn" | "gold" | "silver";

const TONES: Record<TileTone, { bg: string; fg: string }> = {
  default: { bg: "#fff", fg: "#1A1A1A" },
  good: { bg: "#EEF8EF", fg: "#2E7D32" },
  warn: { bg: "#FDF0F0", fg: "#C62828" },
  gold: { bg: "#FFF8E8", fg: "#8A6500" },
  silver: { bg: "#F3F5F8", fg: "#4A5562" },
};

export const StatTile: React.FC<{
  label: string;
  value: string;
  hint?: string;
  tone?: TileTone;
}> = ({ label, value, hint, tone = "default" }) => (
  <View style={[styles.tile, { backgroundColor: TONES[tone].bg }]}>
    <Text style={styles.tileLabel}>{label}</Text>
    <Text style={[styles.tileValue, { color: TONES[tone].fg }]} numberOfLines={1} adjustsFontSizeToFit>
      {value}
    </Text>
    {hint ? <Text style={styles.tileHint}>{hint}</Text> : null}
  </View>
);

export const StatGrid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.grid}>{children}</View>
);

export const AnalyticsCard: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <View style={styles.card}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  tile: {
    width: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  tileLabel: {
    fontSize: 11,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  tileValue: { fontSize: 19, fontWeight: "800" },
  tileHint: { fontSize: 11, color: "#999", marginTop: 3 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#1A1A1A", marginBottom: 10 },
});
