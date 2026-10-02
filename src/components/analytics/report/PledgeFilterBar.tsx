import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ALL_PLEDGES, PledgeFilters } from "../../../utils/analytics/report/pledges";
import { BottomSheet, Text, colors } from "../../../ui";
import Segmented from "./Segmented";

const ChipGroup: React.FC<{
  label: string;
  allLabel: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, allLabel, values, value, onChange }) => (
  <View style={styles.group}>
    <Text style={styles.groupLabel}>{label}</Text>
    <View style={styles.chips}>
      {["all", ...values].map((v) => (
        <TouchableOpacity key={v} style={[styles.chip, value === v && styles.active]} onPress={() => onChange(v)}>
          <Text style={[styles.chipText, value === v && styles.activeText]} numberOfLines={1}>
            {v === "all" ? allLabel : v}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

/** The report's pledge filters (spec §12.1): one summary line; the choices open in a bottom sheet (UI revamp §5). */
const PledgeFilterBar: React.FC<{
  filters: PledgeFilters;
  options: { villages: string[]; items: string[]; years: string[] };
  showing: number;
  total: number;
  onChange: (f: PledgeFilters) => void;
}> = ({ filters, options, showing, total, onChange }) => {
  const [open, setOpen] = useState(false);
  const active =
    filters.village !== "all" || filters.item !== "all" || filters.year !== "all" || filters.status !== "all";
  const summary = [
    filters.village === "all" ? "All villages" : filters.village,
    filters.item === "all" ? "All items" : filters.item,
    filters.year === "all" ? "All years" : filters.year,
    filters.status === "all" ? "All" : filters.status === "open" ? "Open" : "Redeemed",
  ].join(" · ");
  const showingText = `Showing ${showing} of ${total} pledges`;
  return (
    <>
      <TouchableOpacity style={styles.bar} onPress={() => setOpen(true)} accessibilityLabel="Filter pledges">
        <View style={styles.summaryText}>
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
          <Text style={styles.showing} numberOfLines={1}>
            {showingText}
          </Text>
        </View>
        <View style={[styles.filterButton, active && styles.filterButtonActive]}>
          <Ionicons name="options-outline" size={16} color={active ? colors.white : colors.goldDeep} />
          <Text style={[styles.filterText, active && styles.activeText]}>Filter</Text>
        </View>
      </TouchableOpacity>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Filter pledges"
        subtitle={showingText}
        footer={
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.footerButton, styles.resetButton]}
              onPress={() => onChange(ALL_PLEDGES)}
              disabled={!active}
            >
              <Text style={[styles.resetText, !active && styles.disabledText]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerButton, styles.doneButton]} onPress={() => setOpen(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <ChipGroup label="Village" allLabel="All villages" values={options.villages} value={filters.village} onChange={(village) => onChange({ ...filters, village })} />
        <ChipGroup label="Item" allLabel="All items" values={options.items} value={filters.item} onChange={(item) => onChange({ ...filters, item })} />
        <ChipGroup label="Opened in" allLabel="All years" values={options.years} value={filters.year} onChange={(year) => onChange({ ...filters, year })} />
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Status</Text>
          <Segmented
            fill
            options={[
              { key: "all", label: "All" },
              { key: "open", label: "Open" },
              { key: "redeemed", label: "Redeemed" },
            ]}
            value={filters.status}
            onChange={(status) => onChange({ ...filters, status })}
          />
        </View>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryText: { flex: 1, minWidth: 0 },
  summary: { fontSize: 13, fontWeight: "700", color: colors.text },
  showing: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.goldLine,
  },
  filterButtonActive: { backgroundColor: colors.goldDeep, borderColor: colors.goldDeep },
  filterText: { fontSize: 13, fontWeight: "800", color: colors.goldDeep },
  group: { marginBottom: 16 },
  groupLabel: { fontSize: 10, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    maxWidth: "100%",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.goldLine,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.goldDeep, borderColor: colors.goldDeep },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.goldDeep },
  activeText: { color: colors.white },
  footerRow: { flexDirection: "row", gap: 12 },
  footerButton: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  resetButton: { borderWidth: 1.5, borderColor: "#F2C4C4" },
  resetText: { fontSize: 15, fontWeight: "800", color: colors.danger },
  disabledText: { color: "#CCC" },
  doneButton: { backgroundColor: colors.goldDeep },
  doneText: { fontSize: 15, fontWeight: "800", color: colors.white },
});

export default PledgeFilterBar;
