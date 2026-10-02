import React from "react";
import { StyleSheet } from "react-native";
import { Text } from "../../../ui";

const TONES: Record<string, { bg: string; fg: string }> = {
  Risk: { bg: "#FDECEC", fg: "#C62828" },
  Fix: { bg: "#FDECEC", fg: "#C62828" },
  red: { bg: "#FDECEC", fg: "#C62828" },
  Watch: { bg: "#FFF4E0", fg: "#B26A00" },
  Check: { bg: "#FFF4E0", fg: "#B26A00" },
  Upside: { bg: "#EEF8EF", fg: "#2E7D32" },
  Good: { bg: "#EEF8EF", fg: "#2E7D32" },
  Data: { bg: "#EEF2FB", fg: "#3557A7" },
  Note: { bg: "#EEF2FB", fg: "#3557A7" },
  grey: { bg: "#F1F1F1", fg: "#666" },
};

/** Small coloured label: finding and check tags, and bill flags (tone "red" / "grey"). */
export const TagPill: React.FC<{ label: string; tone?: string }> = ({ label, tone }) => {
  const t = TONES[tone ?? label] ?? TONES.grey;
  return <Text style={[styles.pill, { backgroundColor: t.bg, color: t.fg }]}>{label}</Text>;
};

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    fontSize: 11,
    fontWeight: "800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: "hidden",
  },
});

export default TagPill;
