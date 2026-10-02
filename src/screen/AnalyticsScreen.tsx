import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "../types/entry";
import { getAnalyticsData } from "../database/analyticsQueries";
import { AnalyticsData } from "../utils/analytics/types";
import {
  Grain,
  Period,
  allPeriod,
  customPeriod,
  inPeriod,
  periodFor,
  previousPeriod,
  samePeriodLastYear,
  shiftPeriod,
} from "../utils/analytics/periods";
import { buildSalesView } from "../utils/analytics/sales";
import { buildCustomersView } from "../utils/analytics/customers";
import { buildMetalView } from "../utils/analytics/metal";
import { buildOverview } from "../utils/analytics/overview";
import { baakiAging } from "../utils/analytics/baki";
import { buildCategoryView } from "../utils/analytics/categories";
import { buildVillageView, groupVillages } from "../utils/analytics/villages";
import { buildImportanceView } from "../utils/analytics/importance";
import { TrendGrain, buildTrends } from "../utils/analytics/trends";
import {
  ALL_PLEDGES,
  PledgeFilters,
  buildPledgeRows,
  filterOptions,
  filterPledges,
} from "../utils/analytics/report/pledges";
import { buildBillRows } from "../utils/analytics/report/billing";
import { dataQuality } from "../utils/analytics/report/quality";
import PeriodPicker from "../components/analytics/PeriodPicker";
import OverviewSection from "../components/analytics/OverviewSection";
import SalesSection from "../components/analytics/SalesSection";
import BaakiAgingCard from "../components/analytics/BaakiAgingCard";
import CustomersSection from "../components/analytics/CustomersSection";
import KeyCustomersCard from "../components/analytics/KeyCustomersCard";
import VillagesSection from "../components/analytics/VillagesSection";
import MetalSection from "../components/analytics/MetalSection";
import CategoriesCard from "../components/analytics/CategoriesCard";
import TrendsSection from "../components/analytics/TrendsSection";
import OverviewTab from "../components/analytics/report/OverviewTab";
import RehanBookTab from "../components/analytics/report/RehanBookTab";
import ItemsTab from "../components/analytics/report/ItemsTab";
import CustomersVillagesTab from "../components/analytics/report/CustomersVillagesTab";
import BillingSummaryTab from "../components/analytics/report/BillingSummaryTab";
import TogetherTab from "../components/analytics/report/TogetherTab";
import DataQualityTab from "../components/analytics/report/DataQualityTab";
import PledgeFilterBar from "../components/analytics/report/PledgeFilterBar";
import Segmented from "../components/analytics/report/Segmented";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Analytics">;
};

const TABS = ["Overview", "Rehan book", "Items", "Customers & Villages", "Billing", "Together", "Data quality"] as const;
type Tab = (typeof TABS)[number];
const BILLING_TABS = ["Summary", "Sales", "Metal", "Trends", "Customers"] as const;
type BillingTab = (typeof BILLING_TABS)[number];

const FILTERED_TABS: Tab[] = ["Overview", "Rehan book", "Items", "Customers & Villages", "Together"];

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const AnalyticsScreen: React.FC<Props> = ({ navigation }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("Overview");
  const [billingTab, setBillingTab] = useState<BillingTab>("Summary");
  const [filters, setFilters] = useState<PledgeFilters>(ALL_PLEDGES);
  const [grain, setGrain] = useState<Grain>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [customFrom, setCustomFrom] = useState(startOfMonth);
  const [customTo, setCustomTo] = useState(() => new Date());

  // Every load re-reads the ledger, so new transactions show up on their own.
  const load = useCallback(async () => {
    try {
      setData(await getAnalyticsData());
      setFailed(false);
    } catch (error) {
      console.error("Error loading analytics:", error);
      setFailed(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const period: Period = useMemo(() => {
    if (grain === "all") {
      return allPeriod(
        data
          ? [
              ...data.lenden.map((l) => l.date),
              ...data.jama.map((j) => j.date),
              ...data.rehan.map((r) => r.openDate),
              ...data.rehan.flatMap((r) => (r.closedDate ? [r.closedDate] : [])),
              ...data.rehanTx.map((t) => t.date),
            ]
          : [],
      );
    }
    if (grain === "custom") return customPeriod(customFrom, customTo);
    return periodFor(grain, anchor);
  }, [grain, anchor, customFrom, customTo, data]);
  const previous = useMemo(() => previousPeriod(period), [period]);
  const lastYear = useMemo(
    () => (grain === "month" || grain === "quarter" ? samePeriodLastYear(period) : null),
    [grain, period],
  );
  const canGoForward = grain !== "all" && period.end.getTime() <= Date.now();
  const trendGrain: TrendGrain =
    grain === "custom" ? "month" : grain === "all" ? "fy" : grain;

  const onStep = (steps: number) => {
    const next = shiftPeriod(period, steps);
    if (grain === "custom") {
      setCustomFrom(next.start);
      setCustomTo(new Date(next.end.getFullYear(), next.end.getMonth(), next.end.getDate() - 1));
    } else {
      setAnchor(next.start);
    }
  };

  const report = useMemo(() => {
    if (!data) return null;
    const now = new Date();
    const groups = groupVillages(data.users);
    const pledges = buildPledgeRows(data, now, groups);
    return {
      now,
      groups,
      pledges,
      bills: buildBillRows(data, groups, now),
      names: new Map(data.users.map((u) => [u.id, u.name])),
      options: filterOptions(pledges, groups),
      quality: dataQuality(data, now),
    };
  }, [data]);

  const view = useMemo(() => {
    if (!report) return null;
    const villageBills =
      filters.village === "all" ? report.bills : report.bills.filter((b) => b.village === filters.village);
    return {
      pledges: filterPledges(report.pledges, filters),
      byItemRank: filterPledges(report.pledges, filters, "item"),
      byVillageRank: filterPledges(report.pledges, filters, "village"),
      villageBills,
    };
  }, [report, filters]);

  const content = useMemo(() => {
    if (!data || !report || !view) return null;
    const now = new Date();
    const openCustomer = (userId: number, userName: string) =>
      navigation.navigate("UserTransactions", { userId, userName });
    switch (tab) {
      case "Overview":
        return <OverviewTab pledges={view.pledges} bills={view.villageBills} names={report.names} customersOnFile={filters.village === "all" ? data.users.length : report.groups.customers.get(filters.village) ?? 0} />;
      case "Rehan book":
        return <RehanBookTab pledges={view.pledges} now={report.now} />;
      case "Items":
        return <ItemsTab pledges={view.pledges} rankingPledges={view.byItemRank} selectedItem={filters.item} now={report.now} />;
      case "Customers & Villages":
        return (
          <CustomersVillagesTab
            pledges={view.pledges}
            rankingPledges={view.byVillageRank}
            allPledges={report.pledges}
            data={data}
            groups={report.groups}
            village={filters.village}
            onCustomerPress={openCustomer}
          />
        );
      case "Together":
        return <TogetherTab
            pledges={view.pledges}
            bills={view.villageBills}
            sharePledges={view.byVillageRank}
            shareBills={report.bills}
            order={report.groups.order}
          />;
      case "Data quality":
        return <DataQualityTab report={report.quality} />;
      case "Billing":
        switch (billingTab) {
          case "Summary":
            return <BillingSummaryTab bills={view.villageBills.filter((b) => inPeriod(b.date, period))} />;
          case "Sales":
            return (
              <>
                <OverviewSection
                  view={buildOverview(data, period, previous, lastYear, now)}
                  previousLabel={previous?.label ?? null}
                  lastYearLabel={lastYear?.label ?? null}
                />
                <SalesSection view={buildSalesView(data, period)} onCustomerPress={openCustomer} />
                <BaakiAgingCard aging={baakiAging(data, now)} />
              </>
            );
          case "Metal":
            return (
              <>
                <MetalSection view={buildMetalView(data, period)} />
                <CategoriesCard categories={buildCategoryView(data, period, previous)} />
              </>
            );
          case "Trends":
            return <TrendsSection rows={buildTrends(data, trendGrain, now)} />;
          case "Customers":
            return (
              <>
                <KeyCustomersCard view={buildImportanceView(data, period)} onCustomerPress={openCustomer} />
                <CustomersSection view={buildCustomersView(data, period, now)} onCustomerPress={openCustomer} />
                <VillagesSection villages={buildVillageView(data, period, previous)} />
              </>
            );
        }
    }
  }, [data, report, view, tab, billingTab, filters.item, filters.village, period, previous, lastYear, trendGrain, navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {report && view && FILTERED_TABS.includes(tab) && (
          <PledgeFilterBar
            filters={filters}
            options={report.options}
            showing={view.pledges.length}
            total={report.pledges.length}
            onChange={setFilters}
          />
        )}
        {tab === "Billing" && (
          <>
            <PeriodPicker
              grain={grain}
              period={period}
              canGoForward={canGoForward}
              customFrom={customFrom}
              customTo={customTo}
              onGrainChange={(g) => {
                setGrain(g);
                setAnchor(new Date());
              }}
              onStep={onStep}
              onCustomChange={(from, to) => {
                // a backwards pick is stored the right way round
                setCustomFrom(to < from ? to : from);
                setCustomTo(to < from ? from : to);
              }}
            />
            <Segmented
              options={BILLING_TABS.map((t) => ({ key: t, label: t }))}
              value={billingTab}
              onChange={setBillingTab}
            />
            {filters.village !== "all" && (
              <Text style={styles.trendNote}>Village: {filters.village} (Summary only)</Text>
            )}
          </>
        )}
      </View>

      {failed ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.error}>Could not load analytics. Pull down to try again.</Text>
        </ScrollView>
      ) : !data ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8C5B14" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {content}
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F9FA" },
  header: { padding: 16, paddingBottom: 8, gap: 10 },
  tabs: { gap: 6 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: "#EFE6D6" },
  tabActive: { backgroundColor: "#8C5B14" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#8C5B14" },
  tabTextActive: { color: "#fff" },
  trendNote: { fontSize: 12, color: "#777" },
  content: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#C62828", fontSize: 14, textAlign: "center" },
});

export default AnalyticsScreen;
