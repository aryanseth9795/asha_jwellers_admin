import React, { useState } from "react";
import { View } from "react-native";
import { AnalyticsData } from "../../../utils/analytics/types";
import { OTHER_VILLAGES, UNKNOWN_VILLAGE, VillageGroups } from "../../../utils/analytics/villages";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import {
  Exposure, VillageStat, concentration, customerSegments, customersAdded, exposures, repeatCustomers, villageStats,
} from "../../../utils/analytics/report/pledgeCustomers";
import { formatCompactRupees, formatPct } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import Segmented from "./Segmented";
import HBars from "./HBars";
import DataTable from "./DataTable";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;

type VillageMetric = "principal" | "open" | "pledges" | "customers" | "per" | "redeemed";
const VILLAGE_METRICS: { key: VillageMetric; label: string }[] = [
  { key: "principal", label: "Principal" },
  { key: "open", label: "Open" },
  { key: "pledges", label: "Pledges" },
  { key: "customers", label: "Customers" },
  { key: "per", label: "Per customer" },
  { key: "redeemed", label: "Redeemed" },
];
const villageValue = (v: VillageStat, m: VillageMetric) =>
  m === "principal" ? v.principal : m === "open" ? v.openPrincipal : m === "pledges" ? v.pledges
    : m === "customers" ? v.pledging : m === "per" ? (v.pledging ? v.principal / v.pledging : 0) : v.redeemedPct;
const villageText = (n: number, m: VillageMetric) =>
  m === "pledges" || m === "customers" ? String(n) : m === "redeemed" ? formatPct(n) : inrC(n);

const CustomersVillagesTab: React.FC<{
  pledges: PledgeRow[];
  rankingPledges: PledgeRow[];
  allPledges: PledgeRow[];
  data: AnalyticsData;
  groups: VillageGroups;
  village: string;
  onCustomerPress: (userId: number, name: string) => void;
}> = ({ pledges, rankingPledges, allPledges, data, groups, village, onCustomerPress }) => {
  const [metric, setMetric] = useState<VillageMetric>("principal");
  const villages = villageStats(rankingPledges, groups);
  const conc = concentration(pledges);
  const top = exposures(pledges, data.users, 12);
  const watch = exposures(pledges, data.users, 15);
  const repeat = repeatCustomers(pledges);
  const repeaters = repeat.slice(1).reduce((n, b) => n + b.customers, 0);
  const added = customersAdded(data.users, new Date());
  const segments = customerSegments(data, allPledges, groups, village);
  return (
    <View>
      <ReportCard
        title="Villages ranked"
        subtitle="Villages with fewer than 5 customers are grouped as Other villages."
        right={<Segmented options={VILLAGE_METRICS} value={metric} onChange={setMetric} />}
      >
        <HBars
          rows={villages.map((v) => ({
            key: v.village,
            label: v.village,
            value: villageValue(v, metric),
            display: villageText(villageValue(v, metric), metric),
            muted: v.village === OTHER_VILLAGES || v.village === UNKNOWN_VILLAGE,
            highlight: v.village === village,
          }))}
        />
      </ReportCard>

      <ReportCard
        title="How concentrated is the principal?"
        subtitle={`Top 10% of customers hold ${formatPct(conc.top10)} of principal, top 20% hold ${formatPct(conc.top20)}.`}
      >
        <StatGrid>
          <StatTile label="Top 10% of customers" value={formatPct(conc.top10)} hint="of principal" tone="gold" />
          <StatTile label="Top 20%" value={formatPct(conc.top20)} hint="of principal" />
          <StatTile label="Top 50%" value={formatPct(conc.top50)} hint="of principal" />
          <StatTile label="Ten largest customers" value={formatPct(conc.tenLargest)} hint={`${conc.customers} customers in view`} />
        </StatGrid>
      </ReportCard>

      <ReportCard title="Village scorecard" subtitle="Tap a column to sort.">
        <DataTable<VillageStat>
          rows={villages}
          rowKey={(v) => v.village}
          initialSort={{ key: "principal", desc: true }}
          columns={[
            { key: "village", title: "Village", width: 116, text: (v) => v.village, sortValue: (v) => v.village },
            { key: "onfile", title: "On file", width: 60, align: "right", text: (v) => String(v.customersOnFile), sortValue: (v) => v.customersOnFile },
            { key: "pledging", title: "Pledging", width: 66, align: "right", text: (v) => String(v.pledging), sortValue: (v) => v.pledging },
            { key: "pledges", title: "Pledges", width: 62, align: "right", text: (v) => String(v.pledges), sortValue: (v) => v.pledges },
            { key: "per", title: "Per customer", width: 86, align: "right", text: (v) => v.perCustomer.toFixed(1), sortValue: (v) => v.perCustomer },
            { key: "principal", title: "Principal", width: 84, align: "right", text: (v) => inrC(v.principal), sortValue: (v) => v.principal },
            { key: "open", title: "Open", width: 80, align: "right", text: (v) => inrC(v.openPrincipal), sortValue: (v) => v.openPrincipal },
            { key: "share", title: "Share of open", width: 92, align: "right", text: (v) => formatPct(v.openShare), sortValue: (v) => v.openShare, shade: (v) => v.openShare },
            { key: "avg", title: "Avg ticket", width: 80, align: "right", text: (v) => inrC(v.avgTicket), sortValue: (v) => v.avgTicket },
            { key: "red", title: "Redeemed", width: 76, align: "right", text: (v) => formatPct(v.redeemedPct), sortValue: (v) => v.redeemedPct },
          ]}
        />
      </ReportCard>

      <ReportCard
        title="Largest open exposures by customer"
        subtitle={`Top ${top.length} by open principal. Together ${inrC(top.reduce((n, e) => n + e.openPrincipal, 0))}.`}
      >
        <HBars
          labelWidth={120}
          rows={top.map((e) => ({
            key: String(e.userId),
            label: e.name,
            value: e.openPrincipal,
            display: inrC(e.openPrincipal),
            onPress: () => onCustomerPress(e.userId, e.name),
          }))}
        />
      </ReportCard>

      <ReportCard
        title="Repeat customers"
        subtitle={`${formatPct(conc.customers ? repeaters / conc.customers : 0)} of customers pledged more than once (${repeaters} of ${conc.customers}).`}
      >
        <BarChart
          buckets={repeat.map((b) => ({ key: b.label, label: b.label }))}
          series={[
            { label: "Share of customers", color: "#B8860B", values: repeat.map((b) => b.customerShare * 100) },
            { label: "Share of principal", color: "#E65100", values: repeat.map((b) => b.principalShare * 100) },
          ]}
          formatValue={(v) => `${Math.round(v)}%`}
        />
      </ReportCard>

      <ReportCard
        title="Customers added over time"
        subtitle={`${added.length ? added[added.length - 1].total : 0} customers on file. A one-month spike is usually a paper ledger being entered, not growth.`}
      >
        <BarChart
          buckets={added.map((a) => ({ key: a.key, label: a.label }))}
          labelEvery={Math.max(1, Math.ceil(added.length / 6))}
          series={[{ label: "New customers", color: "#B8860B", values: added.map((a) => a.added) }]}
          formatValue={(v) => String(Math.round(v))}
        />
      </ReportCard>

      <ReportCard title="Customers by what they do with the shop" subtitle="Follows the village filter only.">
        <HBars
          labelWidth={150}
          rows={segments.map((s) => ({ key: s.label, label: s.label, value: s.customers, display: String(s.customers) }))}
        />
      </ReportCard>

      <ReportCard title="Customer watchlist" subtitle="The 15 customers with the most open principal in this view. Tap a row to open the customer.">
        <DataTable<Exposure>
          rows={watch}
          rowKey={(e) => String(e.userId)}
          initialSort={{ key: "open", desc: true }}
          onRowPress={(e) => onCustomerPress(e.userId, e.name)}
          columns={[
            { key: "name", title: "Customer", width: 140, text: (e) => e.name, sortValue: (e) => e.name },
            { key: "village", title: "Village", width: 100, text: (e) => e.village, sortValue: (e) => e.village },
            { key: "openn", title: "Open pledges", width: 86, align: "right", text: (e) => String(e.openPledges), sortValue: (e) => e.openPledges },
            { key: "open", title: "Open principal", width: 100, align: "right", text: (e) => inrC(e.openPrincipal), sortValue: (e) => e.openPrincipal, shade: (e) => (watch[0] ? e.openPrincipal / watch[0].openPrincipal : 0) },
            { key: "oldest", title: "Oldest open (days)", width: 116, align: "right", text: (e) => String(e.oldestOpenDays), sortValue: (e) => e.oldestOpenDays },
            { key: "red", title: "Redeemed", width: 76, align: "right", text: (e) => String(e.redeemed), sortValue: (e) => e.redeemed },
            { key: "total", title: "Total pledges", width: 90, align: "right", text: (e) => String(e.totalPledges), sortValue: (e) => e.totalPledges },
          ]}
        />
      </ReportCard>
    </View>
  );
};

export default CustomersVillagesTab;
