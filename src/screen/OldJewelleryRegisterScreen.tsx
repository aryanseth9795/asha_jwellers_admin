import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/entry";
import { getOldJewelleryRegister } from "../database/lendenOldJewelleryItems";
import {
  OldJewelleryRegisterRow,
  RegisterMetalFilter,
  RegisterPeriod,
  RegisterTotals,
  filterRegister,
  summarizeRegister,
} from "../utils/oldJewelleryRegister";
import {
  formatMetalPurity,
  formatRupees,
  formatWeight,
} from "../utils/billFormat";

type NavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "OldJewelleryRegister"
>;

interface Props {
  navigation: NavigationProp;
}

const METAL_FILTERS: { key: RegisterMetalFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "gold", label: "Gold" },
  { key: "silver", label: "Silver" },
];

const PERIOD_FILTERS: { key: RegisterPeriod; label: string }[] = [
  { key: "month", label: "This Month" },
  { key: "year", label: "This FY" },
  { key: "all", label: "All Time" },
];

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const TotalsCard: React.FC<{
  title: string;
  totals: RegisterTotals;
  tone: "gold" | "silver";
}> = ({ title, totals, tone }) => (
  <View style={[styles.totalsCard, styles[`${tone}Card`]]}>
    <Text style={[styles.totalsTitle, styles[`${tone}Title`]]}>{title}</Text>
    <Text style={styles.totalsWeight}>{formatWeight(totals.weight).main}</Text>
    <Text style={styles.totalsValue}>{formatRupees(totals.value)}</Text>
    <Text style={styles.totalsCount}>
      {totals.count} {totals.count === 1 ? "item" : "items"}
    </Text>
  </View>
);

const OldJewelleryRegisterScreen: React.FC<Props> = ({ navigation }) => {
  const [rows, setRows] = useState<OldJewelleryRegisterRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metal, setMetal] = useState<RegisterMetalFilter>("all");
  const [period, setPeriod] = useState<RegisterPeriod>("year");

  // Reload whenever the screen regains focus so edits made on an entry's
  // detail screen show up on return.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getOldJewelleryRegister().then((result) => {
        if (!active) return;
        setRows(result);
        setIsLoading(false);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  // Totals follow the period but not the metal chip, so gold and silver stay
  // comparable side by side while the list narrows to one metal.
  const periodRows = useMemo(
    () => filterRegister(rows, { metal: "all", period }),
    [rows, period],
  );
  const summary = useMemo(() => summarizeRegister(periodRows), [periodRows]);
  const visibleRows = useMemo(
    () => filterRegister(periodRows, { metal, period: "all" }),
    [periodRows, metal],
  );

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#8C5B14" />
      </View>
    );
  }

  const header = (
    <View>
      <View style={styles.chipRow}>
        {PERIOD_FILTERS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, period === key && styles.chipActive]}
            onPress={() => setPeriod(key)}
          >
            <Text
              style={[styles.chipText, period === key && styles.chipTextActive]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.totalsRow}>
        <TotalsCard title="Gold" totals={summary.gold} tone="gold" />
        <TotalsCard title="Silver" totals={summary.silver} tone="silver" />
      </View>
      {summary.unknown.count > 0 && (
        <View style={styles.unknownNote}>
          <Ionicons name="alert-circle-outline" size={16} color="#A15C5C" />
          <Text style={styles.unknownNoteText}>
            {summary.unknown.count} older{" "}
            {summary.unknown.count === 1 ? "item has" : "items have"} no metal
            set ({formatRupees(summary.unknown.value)}). Edit the entry to add
            it.
          </Text>
        </View>
      )}

      <View style={[styles.chipRow, styles.metalChipRow]}>
        {METAL_FILTERS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.chip, metal === key && styles.chipActive]}
            onPress={() => setMetal(key)}
          >
            <Text
              style={[styles.chipText, metal === key && styles.chipTextActive]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={visibleRows}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={header}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="repeat" size={40} color="#D8C79A" />
          <Text style={styles.emptyText}>
            No old jewellery received in this period
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          activeOpacity={0.8}
          onPress={() =>
            navigation.navigate("TransactionDetail", {
              transactionId: item.lendenId,
              transactionType: "lenden",
            })
          }
        >
          <View style={styles.rowMain}>
            <Text style={styles.rowDescription}>{item.description}</Text>
            <Text style={styles.rowCustomer}>
              {item.userName}
              {item.billNo != null ? ` · Bill #${item.billNo}` : ""}
            </Text>
            <View style={styles.rowMeta}>
              <Text
                style={[
                  styles.metalTag,
                  item.metal === "gold" && styles.goldTag,
                  item.metal === "silver" && styles.silverTag,
                ]}
              >
                {item.metal
                  ? formatMetalPurity(item.metal, item.purity)
                  : "Metal not set"}
              </Text>
              {item.weight != null && (
                <Text style={styles.rowWeight}>
                  {formatWeight(item.weight).main}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.rowSide}>
            <Text style={styles.rowValue}>{formatRupees(item.value)}</Text>
            <Text style={styles.rowDate}>{formatDate(item.date)}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  chipRow: { flexDirection: "row", gap: 8, marginBottom: 14 },
  metalChipRow: { marginTop: 4 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#E8D5AF",
    backgroundColor: "#fff",
  },
  chipActive: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  chipText: { color: "#8C5B14", fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  totalsRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  totalsCard: { flex: 1, borderRadius: 14, padding: 14, borderWidth: 1 },
  goldCard: { backgroundColor: "#FFF8E8", borderColor: "#EBD49E" },
  silverCard: { backgroundColor: "#F3F5F8", borderColor: "#D5DBE3" },
  totalsTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  goldTitle: { color: "#8A6500" },
  silverTitle: { color: "#4A5562" },
  totalsWeight: { fontSize: 20, fontWeight: "800", color: "#1A1A1A" },
  totalsValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#333",
    marginTop: 2,
  },
  totalsCount: { fontSize: 12, color: "#777", marginTop: 4 },
  unknownNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: 10,
    marginBottom: 12,
    borderRadius: 10,
    backgroundColor: "#FDF3F3",
  },
  unknownNoteText: { flex: 1, color: "#7A4545", fontSize: 12 },
  row: {
    flexDirection: "row",
    gap: 12,
    padding: 14,
    marginBottom: 10,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#F0E5D0",
  },
  rowMain: { flex: 1 },
  rowDescription: { fontSize: 15, fontWeight: "700", color: "#332719" },
  rowCustomer: { fontSize: 13, color: "#666", marginTop: 2 },
  rowMeta: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 6,
  },
  metalTag: {
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
    color: "#A15C5C",
    backgroundColor: "#FDF3F3",
  },
  goldTag: { color: "#8A6500", backgroundColor: "#FBEFD5" },
  silverTag: { color: "#4A5562", backgroundColor: "#ECEFF3" },
  rowWeight: { fontSize: 12, color: "#7A6B58" },
  rowSide: { alignItems: "flex-end", justifyContent: "space-between" },
  rowValue: { fontSize: 15, fontWeight: "800", color: "#7C4A08" },
  rowDate: { fontSize: 12, color: "#999" },
  empty: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptyText: { color: "#7A6B58", fontSize: 14 },
});

export default OldJewelleryRegisterScreen;
