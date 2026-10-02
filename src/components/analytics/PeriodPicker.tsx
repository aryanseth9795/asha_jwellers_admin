import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import CustomDatePicker from "../CustomDatePicker";
import { Grain, Period } from "../../utils/analytics/periods";

const GRAINS: { key: Grain; label: string }[] = [
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "quarter", label: "Quarter" },
  { key: "fy", label: "FY" },
  { key: "custom", label: "Custom" },
  { key: "all", label: "All" },
];

const formatDay = (d: Date) =>
  d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const PeriodPicker: React.FC<{
  grain: Grain;
  period: Period;
  canGoForward: boolean;
  customFrom: Date;
  customTo: Date;
  onGrainChange: (grain: Grain) => void;
  onStep: (steps: number) => void;
  onCustomChange: (from: Date, to: Date) => void;
}> = ({ grain, period, canGoForward, customFrom, customTo, onGrainChange, onStep, onCustomChange }) => {
  const [picking, setPicking] = useState<"from" | "to" | null>(null);
  return (
    <View>
      <View style={styles.chips}>
        {GRAINS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.chip, grain === g.key && styles.chipActive]}
            onPress={() => onGrainChange(g.key)}
          >
            <Text style={[styles.chipText, grain === g.key && styles.chipTextActive]}>{g.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {grain === "custom" && (
        <View style={styles.customRow}>
          {(["from", "to"] as const).map((which) => (
            <TouchableOpacity key={which} style={styles.dateButton} onPress={() => setPicking(which)}>
              <Text style={styles.dateLabel}>{which === "from" ? "From" : "To"}</Text>
              <Text style={styles.dateValue}>{formatDay(which === "from" ? customFrom : customTo)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.stepRow}>
        {grain !== "all" && (
          <TouchableOpacity style={styles.arrow} onPress={() => onStep(-1)}>
            <Ionicons name="chevron-back" size={20} color="#8C5B14" />
          </TouchableOpacity>
        )}
        <Text style={styles.periodLabel} numberOfLines={1}>{period.label}</Text>
        {grain !== "all" && (
          <TouchableOpacity style={styles.arrow} onPress={() => onStep(1)} disabled={!canGoForward}>
            <Ionicons name="chevron-forward" size={20} color={canGoForward ? "#8C5B14" : "#DDD"} />
          </TouchableOpacity>
        )}
      </View>

      <CustomDatePicker
        visible={picking !== null}
        selectedDate={picking === "to" ? customTo : customFrom}
        maximumDate={new Date()}
        onClose={() => setPicking(null)}
        onDateSelect={(date) => {
          if (picking === "from") onCustomChange(date, customTo);
          else onCustomChange(customFrom, date);
          setPicking(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  chips: { flexDirection: "row", gap: 6 },
  chip: { flex: 1, alignItems: "center", paddingVertical: 7, borderRadius: 9, borderWidth: 1.5, borderColor: "#E8D5AF", backgroundColor: "#fff" },
  chipActive: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  chipText: { fontSize: 11, fontWeight: "700", color: "#8C5B14" },
  chipTextActive: { color: "#fff" },
  customRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  dateButton: { flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#E8D5AF", backgroundColor: "#fff" },
  dateLabel: { fontSize: 11, color: "#888" },
  dateValue: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  stepRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 8 },
  arrow: { padding: 6 },
  periodLabel: { flexShrink: 1, fontSize: 16, fontWeight: "800", color: "#1A1A1A", marginHorizontal: 6 },
});

export default PeriodPicker;
