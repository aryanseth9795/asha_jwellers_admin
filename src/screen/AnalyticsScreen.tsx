import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { Screen, Text, colors, useLayout } from "../ui";
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
import SectionBar from "../components/analytics/SectionBar";
import { DEFAULT_VIEW, FIRST_VIEWS, SECTIONS, SectionKey, ViewKey, controlsFor, sectionOf } from "../utils/analytics/report/sections";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "Analytics">;
};

const startOfMonth = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const AnalyticsScreen: React.FC<Props> = ({ navigation }) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [failed, setFailed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [section, setSection] = useState<SectionKey>(sectionOf(DEFAULT_VIEW));
  // Each section remembers its own sub-tab while the screen is open.
  const [views, setViews] = useState<Record<SectionKey, ViewKey>>(FIRST_VIEWS);
  const active = views[section];
  const controls = controlsFor(active);
  const current = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];
  const { gutter } = useLayout();
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

  const filtered = useMemo(() => {
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
    if (!data || !report || !filtered) return null;
    const now = new Date();
    const openCustomer = (userId: number, userName: string) =>
      navigation.navigate("UserTransactions", { userId, userName });
    switch (active) {
      case "overview/findings":
        return <OverviewTab pledges={filtered.pledges} bills={filtered.villageBills} names={report.names} customersOnFile={filters.village === "all" ? data.users.length : report.groups.customers.get(filters.village) ?? 0} />;
      case "overview/together":
        return (
          <TogetherTab
            pledges={filtered.pledges}
            bills={filtered.villageBills}
            sharePledges={filtered.byVillageRank}
            shareBills={report.bills}
            order={report.groups.order}
          />
        );
      case "overview/quality":
        return <DataQualityTab report={report.quality} />;
      case "customer/rehan":
        return (
          <CustomersVillagesTab
            pledges={filtered.pledges}
            rankingPledges={filtered.byVillageRank}
            allPledges={report.pledges}
            data={data}
            groups={report.groups}
            village={filters.village}
            onCustomerPress={openCustomer}
          />
        );
      case "customer/lenden":
        return (
          <>
            <KeyCustomersCard view={buildImportanceView(data, period)} onCustomerPress={openCustomer} />
            <CustomersSection view={buildCustomersView(data, period, now)} onCustomerPress={openCustomer} />
            <VillagesSection villages={buildVillageView(data, period, previous)} />
          </>
        );
      case "rehan/book":
        return <RehanBookTab pledges={filtered.pledges} now={report.now} />;
      case "rehan/items":
        return <ItemsTab pledges={filtered.pledges} rankingPledges={filtered.byItemRank} selectedItem={filters.item} now={report.now} />;
      case "lenden/summary":
        return <BillingSummaryTab bills={filtered.villageBills.filter((b) => inPeriod(b.date, period))} />;
      case "lenden/sales":
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
      case "lenden/metal":
        return (
          <>
            <MetalSection view={buildMetalView(data, period)} />
            <CategoriesCard categories={buildCategoryView(data, period, previous)} />
          </>
        );
      case "lenden/trends":
        return <TrendsSection rows={buildTrends(data, trendGrain, now)} />;
    }
  }, [data, report, filtered, active, filters.item, filters.village, period, previous, lastYear, trendGrain, navigation]);

  return (
    <Screen>
      <SectionBar sections={SECTIONS} value={section} onChange={setSection} />
      {failed ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.error}>Could not load analytics. Pull down to try again.</Text>
        </ScrollView>
      ) : !data || !report || !filtered ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.goldDeep} />
        </View>
      ) : (
        <ScrollView
          stickyHeaderIndices={[0]}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Sticky: sub-tabs and the filter / time-frame row stay reachable while the cards scroll. */}
          <View style={[styles.controls, { paddingHorizontal: gutter }]}>
            <Segmented
              fill
              options={current.subTabs.map((t) => ({ key: t.key, label: t.label }))}
              value={active}
              onChange={(v) => setViews((prev) => ({ ...prev, [section]: v }))}
            />
            {controls === "pledge" && (
              <PledgeFilterBar
                filters={filters}
                options={report.options}
                showing={filtered.pledges.length}
                total={report.pledges.length}
                onChange={setFilters}
              />
            )}
            {controls === "timeframe" && (
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
            )}
            {active === "lenden/summary" && filters.village !== "all" && (
              <Text style={styles.note}>Village: {filters.village} (Summary only)</Text>
            )}
          </View>
          <View style={[styles.body, { paddingHorizontal: gutter }]}>{content}</View>
        </ScrollView>
      )}
    </Screen>
  );
};

const styles = StyleSheet.create({
  controls: { backgroundColor: colors.bg, paddingTop: 10, paddingBottom: 8, gap: 8 },
  body: { paddingTop: 4 },
  scroll: { paddingBottom: 24 },
  note: { fontSize: 12, color: "#777" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});

export default AnalyticsScreen;
