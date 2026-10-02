import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import {
  Cohort, ageBuckets, cohorts, interestWhatIf, monthlyBook, pledgeStats, redeemBuckets, sizeBands, weekdays,
} from "../../../utils/analytics/report/pledgeBook";
import { formatCompactRupees, formatInr, formatPct } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import Segmented from "./Segmented";
import DataTable from "./DataTable";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const days = (n: number | null) => (n === null ? "—" : String(Math.round(n)));
const count = (n: number) => String(Math.round(n));
type Metric = "principal" | "pledges";
const METRICS: { key: Metric; label: string }[] = [
  { key: "principal", label: "Principal" },
  { key: "pledges", label: "Pledges" },
];
const asBuckets = (labels: string[]) => labels.map((label) => ({ key: label, label }));

const RehanBookTab: React.FC<{ pledges: PledgeRow[]; now: Date }> = ({ pledges, now }) => {
  const [flowMetric, setFlowMetric] = useState<Metric>("principal");
  const [ageMetric, setAgeMetric] = useState<Metric>("principal");
  const [sizeMetric, setSizeMetric] = useState<Metric>("pledges");
  const [rate, setRate] = useState(0.02);

  const s = pledgeStats(pledges);
  const months = monthlyBook(pledges, now);
  const monthBuckets = months.map((m) => ({ key: m.key, label: m.label }));
  const every = Math.max(1, Math.ceil(months.length / 6));
  const age = ageBuckets(pledges);
  const redeem = redeemBuckets(pledges);
  const size = sizeBands(pledges);
  const interest = interestWhatIf(pledges, rate);
  const money = flowMetric === "principal";

  return (
    <View>
      <ReportCard
        title="Opened and redeemed per month"
        subtitle={`${s.pledges} pledges opened, ${s.redeemed} redeemed.`}
        right={<Segmented options={METRICS} value={flowMetric} onChange={setFlowMetric} />}
      >
        <BarChart
          buckets={monthBuckets}
          labelEvery={every}
          series={[
            { label: "Opened", color: "#B8860B", values: months.map((m) => (money ? m.opened : m.openedCount)) },
            { label: "Redeemed", color: "#2E7D32", values: months.map((m) => (money ? m.redeemed : m.redeemedCount)) },
          ]}
          formatValue={money ? formatCompactRupees : count}
        />
      </ReportCard>

      <ReportCard
        title="Open principal at month-end"
        subtitle={`Principal on open pledges at each month-end. Now ${inrC(months.length ? months[months.length - 1].openAtEnd : 0)}.`}
      >
        <BarChart
          buckets={monthBuckets}
          labelEvery={every}
          series={[{ label: "Open principal", color: "#8C5B14", values: months.map((m) => m.openAtEnd) }]}
          formatValue={formatCompactRupees}
        />
      </ReportCard>

      <ReportCard
        title="How long open pledges have been open"
        subtitle={`${formatPct(s.openYearPlusShare)} of open principal is a year old or more (${inrC(s.openYearPlus)}).`}
        right={<Segmented options={METRICS} value={ageMetric} onChange={setAgeMetric} />}
      >
        <BarChart
          buckets={asBuckets(age.map((b) => b.label))}
          series={[{ label: "Open", color: "#8C5B14", values: age.map((b) => (ageMetric === "principal" ? b.principal : b.count)) }]}
          formatValue={ageMetric === "principal" ? formatCompactRupees : count}
        />
      </ReportCard>

      <ReportCard
        title="Time taken to redeem"
        subtitle={`Median ${days(s.medianDaysToRedeem)} days, mean ${days(s.meanDaysToRedeem)}. ${s.redeemed} pledges redeemed.`}
      >
        <BarChart
          buckets={asBuckets(redeem.map((b) => b.label))}
          series={[{ label: "Redeemed", color: "#2E7D32", values: redeem.map((b) => b.count) }]}
          formatValue={count}
        />
      </ReportCard>

      <ReportCard
        title="Pledge size"
        subtitle={`Median ${formatInr(s.medianPledge)}, average ${formatInr(s.avgPledge)}. Largest ${formatInr(s.largestPledge)}.`}
        right={
          <Segmented
            options={[
              { key: "pledges" as Metric, label: "Pledges" },
              { key: "principal" as Metric, label: "Principal" },
            ]}
            value={sizeMetric}
            onChange={setSizeMetric}
          />
        }
      >
        <BarChart
          buckets={asBuckets(size.map((b) => b.label))}
          series={[{ label: "Pledges", color: "#B8860B", values: size.map((b) => (sizeMetric === "principal" ? b.principal : b.count)) }]}
          formatValue={sizeMetric === "principal" ? formatCompactRupees : count}
        />
      </ReportCard>

      <ReportCard title="Cohorts by year opened" subtitle="Each year's pledges: how much is still open and how fast the rest came back.">
        <DataTable<Cohort>
          rows={cohorts(pledges)}
          rowKey={(c) => c.year}
          columns={[
            { key: "year", title: "Opened", width: 64, text: (c) => c.year },
            { key: "pledges", title: "Pledges", width: 66, align: "right", text: (c) => String(c.pledges) },
            { key: "principal", title: "Principal", width: 86, align: "right", text: (c) => inrC(c.principal) },
            { key: "open", title: "Still open", width: 86, align: "right", text: (c) => inrC(c.stillOpen) },
            { key: "red", title: "Redeemed", width: 76, align: "right", text: (c) => formatPct(c.redeemedPct) },
            { key: "days", title: "Median days", width: 88, align: "right", text: (c) => days(c.medianDaysToRedeem) },
            { key: "avg", title: "Avg ticket", width: 82, align: "right", text: (c) => inrC(c.avgPledge) },
          ]}
        />
      </ReportCard>

      <ReportCard title="Day of the week opened" subtitle="Dates are ledger dates, not entry times.">
        <BarChart
          buckets={asBuckets(weekdays(pledges).map((d) => d.label))}
          series={[{ label: "Pledges", color: "#B8860B", values: weekdays(pledges).map((d) => d.count) }]}
          formatValue={count}
        />
      </ReportCard>

      <ReportCard
        title="Interest what-if"
        subtitle="Interest terms are not recorded. This applies a rate you choose to the open book, as an illustration only."
      >
        <View style={styles.rateRow}>
          <TouchableOpacity style={styles.rateButton} onPress={() => setRate((r) => Math.max(0.005, +(r - 0.005).toFixed(3)))}>
            <Text style={styles.rateButtonText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.rate}>{(rate * 100).toFixed(1)}% per month</Text>
          <TouchableOpacity style={styles.rateButton} onPress={() => setRate((r) => Math.min(0.05, +(r + 0.005).toFixed(3)))}>
            <Text style={styles.rateButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        <StatGrid>
          <StatTile label="Per month" value={inrC(interest.perMonth)} hint="on the open book" tone="gold" />
          <StatTile label="Per year" value={inrC(interest.perYear)} hint="at the same rate" />
          <StatTile label="Accrued to date" value={inrC(interest.accrued)} hint="on open pledges, simple interest" />
        </StatGrid>
      </ReportCard>
    </View>
  );
};

const styles = StyleSheet.create({
  rateRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 12 },
  rateButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FAF1E2", alignItems: "center", justifyContent: "center" },
  rateButtonText: { fontSize: 22, fontWeight: "800", color: "#8C5B14" },
  rate: { fontSize: 16, fontWeight: "800", color: "#1A1A1A", minWidth: 130, textAlign: "center" },
});

export default RehanBookTab;
