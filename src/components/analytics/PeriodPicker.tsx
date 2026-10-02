import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { BottomSheet, Text, colors } from "../../ui";
import { Ionicons } from "@expo/vector-icons";
import CustomDatePicker from "../CustomDatePicker";
import { Grain, Period } from "../../utils/analytics/periods";

const GRAINS: { key: Grain; label: string; short: string }[] = [
  { key: "week", label: "Week", short: "Week" },
  { key: "month", label: "Month", short: "Month" },
  { key: "quarter", label: "Quarter", short: "Quarter" },
  { key: "fy", label: "Financial year (Apr–Mar)", short: "FY" },
  { key: "custom", label: "Custom dates", short: "Custom" },
  { key: "all", label: "All time", short: "All" },
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
  const [choosing, setChoosing] = useState(false);
  const grainShort = GRAINS.find((g) => g.key === grain)?.short ?? "Month";
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.grainChip} onPress={() => setChoosing(true)} accessibilityLabel="Change time frame">
          <Text style={styles.grainText} numberOfLines={1}>{grainShort}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.goldDeep} />
        </TouchableOpacity>
        {grain !== "all" && (
          <TouchableOpacity style={styles.arrow} onPress={() => onStep(-1)} accessibilityLabel="Previous period">
            <Ionicons name="chevron-back" size={20} color={colors.goldDeep} />
          </TouchableOpacity>
        )}
        <Text style={styles.periodLabel} numberOfLines={1} adjustsFontSizeToFit>
          {period.label}
        </Text>
        {grain !== "all" && (
          <TouchableOpacity style={styles.arrow} onPress={() => onStep(1)} disabled={!canGoForward} accessibilityLabel="Next period">
            <Ionicons name="chevron-forward" size={20} color={canGoForward ? colors.goldDeep : "#DDD"} />
          </TouchableOpacity>
        )}
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

      <BottomSheet visible={choosing} onClose={() => setChoosing(false)} title="Time frame">
        {GRAINS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.option, grain === g.key && styles.optionActive]}
            onPress={() => {
              onGrainChange(g.key);
              setChoosing(false);
            }}
          >
            <Text style={[styles.optionText, grain === g.key && styles.optionTextActive]}>{g.label}</Text>
            {grain === g.key && <Ionicons name="checkmark" size={18} color={colors.goldDeep} />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

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
  wrap: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  grainChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.goldSoft,
  },
  grainText: { fontSize: 13, fontWeight: "800", color: colors.goldDeep },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  periodLabel: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: colors.text },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionActive: { backgroundColor: colors.goldSoft },
  optionText: { fontSize: 15, color: colors.text },
  optionTextActive: { fontWeight: "800", color: colors.goldDeep },
  customRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  dateButton: { flex: 1, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: "#E8D5AF", backgroundColor: "#fff" },
  dateLabel: { fontSize: 11, color: "#888" },
  dateValue: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
});

export default PeriodPicker;
