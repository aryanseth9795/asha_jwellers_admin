import React, { useState } from "react";
import { View } from "react-native";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import { ItemStat, bundleStats, itemMixByQuarter, itemStats, rankItems } from "../../../utils/analytics/report/itemsView";
import { formatCompactRupees, formatPct } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import Segmented from "./Segmented";
import HBars from "./HBars";
import DataTable from "./DataTable";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const days = (n: number | null) => (n === null ? "—" : String(Math.round(n)));
const MIX_COLORS = ["#B8860B", "#E65100", "#2E7D32", "#9AA5B1"];

type ItemMetric = "principal" | "open" | "pledges" | "avg" | "redeemed";
const ITEM_METRICS: { key: ItemMetric; label: string }[] = [
  { key: "principal", label: "Principal" },
  { key: "open", label: "Open" },
  { key: "pledges", label: "Pledges" },
  { key: "avg", label: "Avg ticket" },
  { key: "redeemed", label: "Redeemed" },
];
const metricValue = (s: ItemStat, m: ItemMetric) =>
  m === "principal" ? s.principal : m === "open" ? s.openPrincipal : m === "pledges" ? s.pledges : m === "avg" ? s.avgTicket : s.redeemedPct;
const metricText = (v: number, m: ItemMetric) => (m === "pledges" ? String(v) : m === "redeemed" ? formatPct(v) : inrC(v));

const ItemsTab: React.FC<{
  pledges: PledgeRow[];
  rankingPledges: PledgeRow[];
  selectedItem: string;
  now: Date;
}> = ({ pledges, rankingPledges, selectedItem, now }) => {
  const [metric, setMetric] = useState<ItemMetric>("principal");
  const ranked = rankItems(rankingPledges);
  const mix = itemMixByQuarter(rankingPledges, now, 8, 3);
  const bundles = bundleStats(pledges);
  return (
    <View>
      <ReportCard
        title="Items ranked"
        subtitle="Item names are grouped by keyword. Items with fewer than 5 pledges are grouped together."
        right={<Segmented options={ITEM_METRICS} value={metric} onChange={setMetric} />}
      >
        <HBars
          rows={ranked.map((s) => ({
            key: s.item,
            label: s.item,
            value: metricValue(s, metric),
            display: metricText(metricValue(s, metric), metric),
            muted: s.item.startsWith("All other items"),
            highlight: s.item === selectedItem,
          }))}
        />
      </ReportCard>

      <ReportCard title="Which items are pledged, quarter by quarter" subtitle="Pledges opened per calendar quarter, last 8 quarters.">
        <BarChart
          stacked
          buckets={mix.buckets}
          series={mix.series.map((s, i) => ({ label: s.label, color: MIX_COLORS[i] ?? "#9AA5B1", values: s.values }))}
          formatValue={(v) => String(Math.round(v))}
        />
      </ReportCard>

      <ReportCard title="Single items and bundles" subtitle='A bundle is a pledge whose name lists two or more items, such as "Locket payal".'>
        <StatGrid>
          <StatTile label="Bundled pledges" value={formatPct(bundles.bundleShare)} hint={`${bundles.bundles} with two or more items`} />
          <StatTile label="Average bundle" value={inrC(bundles.avgBundle)} hint={`${bundles.bundles} pledges`} />
          <StatTile label="Average single item" value={inrC(bundles.avgSingle)} hint={`${bundles.singles} pledges`} />
          <StatTile
            label="Bundle premium"
            value={bundles.premium === null ? "—" : `${bundles.premium >= 0 ? "+" : ""}${formatPct(bundles.premium)}`}
            hint="average bundle vs a single item"
            tone="gold"
          />
        </StatGrid>
      </ReportCard>

      <ReportCard title="Item scorecard" subtitle="Tap a column to sort.">
        <DataTable<ItemStat>
          rows={itemStats(rankingPledges)}
          rowKey={(s) => s.item}
          initialSort={{ key: "principal", desc: true }}
          columns={[
            { key: "item", title: "Item", width: 120, text: (s) => s.item, sortValue: (s) => s.item },
            { key: "pledges", title: "Pledges", width: 64, align: "right", text: (s) => String(s.pledges), sortValue: (s) => s.pledges },
            { key: "principal", title: "Principal", width: 84, align: "right", text: (s) => inrC(s.principal), sortValue: (s) => s.principal },
            { key: "avg", title: "Avg ticket", width: 80, align: "right", text: (s) => inrC(s.avgTicket), sortValue: (s) => s.avgTicket },
            { key: "open", title: "Open", width: 80, align: "right", text: (s) => inrC(s.openPrincipal), sortValue: (s) => s.openPrincipal },
            { key: "share", title: "Share of open", width: 92, align: "right", text: (s) => formatPct(s.openShare), sortValue: (s) => s.openShare, shade: (s) => s.openShare },
            { key: "red", title: "Redeemed", width: 76, align: "right", text: (s) => formatPct(s.redeemedPct), sortValue: (s) => s.redeemedPct },
            { key: "days", title: "Median days", width: 86, align: "right", text: (s) => days(s.medianDaysToRedeem), sortValue: (s) => s.medianDaysToRedeem ?? -1 },
          ]}
        />
      </ReportCard>
    </View>
  );
};

export default ItemsTab;
