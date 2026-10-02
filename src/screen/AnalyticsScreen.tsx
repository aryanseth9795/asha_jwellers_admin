import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/entry";
import { getAnalyticsData } from "../database/analyticsQueries";
import { AnalyticsData } from "../utils/analytics/types";
import { Period, allPeriod, periodFor, shiftPeriod } from "../utils/analytics/periods";
import { buildSalesView } from "../utils/analytics/sales";
import { buildCustomersView } from "../utils/analytics/customers";
import { buildRehanView } from "../utils/analytics/rehan";
import { buildMetalView } from "../utils/analytics/metal";
import SalesSection from "../components/analytics/SalesSection";
import CustomersSection from "../components/analytics/CustomersSection";
import RehanSection from "../components/analytics/RehanSection";
import MetalSection from "../components/analytics/MetalSection";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Analytics">;
};

const SECTIONS = ["Sales", "Customers", "Rehan", "Metal"] as const;
type Section = (typeof SECTIONS)[number];

const AnalyticsScreen: React.FC<Props> = ({ navigation }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [section, setSection] = useState<Section>("Sales");
  const latestFy = periodFor("fy", new Date());
  const [period, setPeriod] = useState<Period>(latestFy);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getAnalyticsData()
        .then((result) => {
          if (!active) return;
          setData(result);
          setFailed(false);
        })
        .catch((error) => {
          console.error("Error loading analytics:", error);
          if (active) setFailed(true);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  // Only the visible section is computed.
  const content = useMemo(() => {
    if (!data) return null;
    const openCustomer = (userId: number, userName: string) =>
      navigation.navigate("UserTransactions", { userId, userName });
    switch (section) {
      case "Sales":
        return <SalesSection view={buildSalesView(data, period)} onCustomerPress={openCustomer} />;
      case "Customers":
        return <CustomersSection view={buildCustomersView(data, period)} onCustomerPress={openCustomer} />;
      case "Rehan":
        return <RehanSection view={buildRehanView(data, period)} />;
      case "Metal":
        return <MetalSection view={buildMetalView(data, period)} />;
    }
  }, [data, period, section, navigation]);

  const shiftYear = (delta: number) =>
    period.grain === "fy" && setPeriod(shiftPeriod(period, delta));
  const atLatest = period.grain === "fy" && period.end.getTime() > Date.now();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.segment}>
          {SECTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.segmentItem, section === s && styles.segmentActive]}
              onPress={() => setSection(s)}
            >
              <Text style={[styles.segmentText, section === s && styles.segmentTextActive]}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.periodRow}>
          {period.grain === "fy" ? (
            <>
              <TouchableOpacity onPress={() => shiftYear(-1)} style={styles.arrow}>
                <Ionicons name="chevron-back" size={20} color="#8C5B14" />
              </TouchableOpacity>
              <Text style={styles.periodLabel}>{period.label}</Text>
              <TouchableOpacity onPress={() => shiftYear(1)} style={styles.arrow} disabled={atLatest}>
                <Ionicons name="chevron-forward" size={20} color={atLatest ? "#DDD" : "#8C5B14"} />
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.periodLabel}>All time</Text>
          )}
          <TouchableOpacity
            style={[styles.allChip, period.grain === "all" && styles.allChipActive]}
            onPress={() => setPeriod(
                period.grain === "all"
                  ? latestFy
                  : allPeriod(
                      data ? [...data.lenden.map((l) => l.date), ...data.rehan.map((r) => r.openDate)] : [],
                    ),
              )}
          >
            <Text style={[styles.allText, period.grain === "all" && styles.allTextActive]}>All time</Text>
          </TouchableOpacity>
        </View>
      </View>

      {failed ? (
        <View style={styles.centered}>
          <Text style={styles.error}>Could not load analytics. Go back and try again.</Text>
        </View>
      ) : !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8C5B14" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>{content}</ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { padding: 16, paddingBottom: 8, backgroundColor: "#F8F9FA" },
  segment: { flexDirection: "row", backgroundColor: "#EFE6D6", borderRadius: 12, padding: 3 },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 10 },
  segmentActive: { backgroundColor: "#fff" },
  segmentText: { fontSize: 13, fontWeight: "700", color: "#8C5B14" },
  segmentTextActive: { color: "#1A1A1A" },
  periodRow: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  arrow: { padding: 6 },
  periodLabel: { fontSize: 16, fontWeight: "800", color: "#1A1A1A", marginHorizontal: 4 },
  allChip: { marginLeft: "auto", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: "#E8D5AF" },
  allChipActive: { backgroundColor: "#8C5B14", borderColor: "#8C5B14" },
  allText: { fontSize: 12, fontWeight: "700", color: "#8C5B14" },
  allTextActive: { color: "#fff" },
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#C62828", fontSize: 14, textAlign: "center" },
});

export default AnalyticsScreen;
