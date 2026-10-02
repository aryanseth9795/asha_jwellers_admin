import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { ALL_PLEDGES, PledgeFilters } from "../../../utils/analytics/report/pledges";
import Segmented from "./Segmented";

const ChipRow: React.FC<{
  label: string;
  allLabel: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, allLabel, values, value, onChange }) => (
  <View style={styles.group}>
    <Text style={styles.groupLabel}>{label}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {["all", ...values].map((v) => (
        <TouchableOpacity key={v} style={[styles.chip, value === v && styles.active]} onPress={() => onChange(v)}>
          <Text style={[styles.chipText, value === v && styles.activeText]}>{v === "all" ? allLabel : v}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  </View>
);

/** The report's pledge filters (spec §12.1), folded into one line until opened. */
const PledgeFilterBar: React.FC<{
  filters: PledgeFilters;
  options: { villages: string[]; items: string[]; years: string[] };
  showing: number;
  total: number;
  onChange: (f: PledgeFilters) => void;
}> = ({ filters, options, showing, total, onChange }) => {
  const [open, setOpen] = useState(false);
  const active = filters.village !== "all" || filters.item !== "all" || filters.year !== "all" || filters.status !== "all";
  const summary = [
    filters.village === "all" ? "All villages" : filters.village,
    filters.item === "all" ? "All items" : filters.item,
    filters.year === "all" ? "All years" : filters.year,
    filters.status === "all" ? "All" : filters.status === "open" ? "Open" : "Redeemed",
  ].join(" · ");
  return (
    <View style={styles.bar}>
      <TouchableOpacity style={styles.summaryRow} onPress={() => setOpen((o) => !o)}>
        <View style={styles.summaryText}>
          <Text style={styles.summary} numberOfLines={1}>{summary}</Text>
          <Text style={styles.showing}>
            Showing {showing} of {total} pledges
          </Text>
        </View>
        <Text style={styles.toggle}>{open ? "Done" : "Filter"}</Text>
      </TouchableOpacity>
      {open && (
        <View>
          <ChipRow label="Village" allLabel="All villages" values={options.villages} value={filters.village} onChange={(village) => onChange({ ...filters, village })} />
          <ChipRow label="Item" allLabel="All items" values={options.items} value={filters.item} onChange={(item) => onChange({ ...filters, item })} />
          <ChipRow label="Opened in" allLabel="All years" values={options.years} value={filters.year} onChange={(year) => onChange({ ...filters, year })} />
          <View style={styles.statusRow}>
            <Segmented
              options={[
                { key: "all", label: "All" },
                { key: "open", label: "Open" },
                { key: "redeemed", label: "Redeemed" },
              ]}
              value={filters.status}
              onChange={(status) => onChange({ ...filters, status })}
            />
            {active && (
              <TouchableOpacity onPress={() => onChange(ALL_PLEDGES)}>
                <Text style={styles.reset}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#EEF0F2", padding: 10 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryText: { flex: 1 },
  summary: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  showing: { fontSize: 11, color: "#888", marginTop: 2 },
  toggle: { fontSize: 13, fontWeight: "800", color: "#8C5B14" },
  group: { marginTop: 10 },
  groupLabel: { fontSize: 10, fontWeight: "800", color: "#888", letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 5 },
  chips: { gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: "#E8D5AF", backgroundColor: "#fff" },
  active: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  chipText: { fontSize: 12, fontWeight: "700", color: "#8C5B14" },
  activeText: { color: "#fff" },
  statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  reset: { fontSize: 13, fontWeight: "800", color: "#C62828", paddingHorizontal: 8 },
});

export default PledgeFilterBar;
