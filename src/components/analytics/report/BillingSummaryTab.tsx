import React from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  BillGroup, BillRow, billLabel, billingSummary, discountPerBill, numberedVsEarlier, waterfall,
} from "../../../utils/analytics/report/billing";
import { formatCompactRupees, formatInr, formatPct } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import DataTable from "./DataTable";
import TagPill from "./TagPill";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;
const pct1 = (r: number) => `${(r * 100).toFixed(1)}%`;
const shortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const COMPARE: { label: string; value: (g: BillGroup) => string }[] = [
  { label: "Bills", value: (g) => String(g.bills) },
  { label: "Gross billed", value: (g) => formatInr(g.gross) },
  { label: "Net billed", value: (g) => formatInr(g.net) },
  { label: "Average net per bill", value: (g) => formatInr(g.avgNet) },
  { label: "Discount rate", value: (g) => pct1(g.discountRate) },
  { label: "Collected share", value: (g) => formatPct(g.collectedShare) },
  { label: "Pending dues", value: (g) => formatInr(g.pending) },
  { label: "Customers", value: (g) => String(g.customers) },
  { label: "Bills with a photo", value: (g) => String(g.withPhoto) },
];

const BillingSummaryTab: React.FC<{ bills: BillRow[] }> = ({ bills }) => {
  const s = billingSummary(bills);
  const steps = waterfall(s);
  const discounts = discountPerBill(bills);
  const { numbered, earlier } = numberedVsEarlier(bills);
  const maxNet = bills.reduce((m, b) => Math.max(m, b.net), 0);
  return (
    <View>
      <ReportCard title="Billing summary" subtitle="Collected is net billed minus the balance field.">
        <StatGrid>
          <StatTile label="Bills" value={String(s.bills)} hint={`${s.withBalance} with a balance due`} />
          <StatTile label="Gross billed" value={inrC(s.gross)} hint={formatInr(s.gross)} tone="gold" />
          <StatTile label="Discount" value={inrC(s.discount)} hint={`${pct1(s.discountPct)} of gross`} />
          <StatTile label="Net billed" value={inrC(s.net)} hint={formatInr(s.net)} />
          <StatTile label="Collected" value={inrC(s.collected)} hint={`${formatPct(s.collectedPct)} of net`} tone="good" />
          <StatTile
            label="Pending dues"
            value={inrC(s.pending)}
            hint={s.pendingOffFilePct > 0 ? `${formatPct(s.pendingOffFilePct)} on customers missing from the file` : "all customers on file"}
            tone="warn"
          />
        </StatGrid>
      </ReportCard>

      <ReportCard title="From gross bill to cash" subtitle="Gross, less discount and old jewellery, is net; net splits into collected and pending.">
        <BarChart
          buckets={steps.map((x) => ({ key: x.label, label: x.label.split(" ")[0] }))}
          series={[{ label: "Amount", color: "#B8860B", values: steps.map((x) => x.value) }]}
          formatValue={formatCompactRupees}
        />
      </ReportCard>

      <ReportCard title="Collected and pending by bill" subtitle="Each bar is the net bill: green collected, orange still due.">
        {bills.length === 0 ? (
          <Text style={styles.muted}>No bills in this period</Text>
        ) : (
          bills.map((b) => (
            <View key={b.id} style={styles.billRow}>
              <Text style={styles.billLabel} numberOfLines={1}>
                {billLabel(b)}  {b.customer}
              </Text>
              <Text style={styles.billSub}>
                {shortDate(b.date)} · {inrC(b.net)}
              </Text>
              <View style={styles.track}>
                <View style={{ flex: maxNet ? b.collected / maxNet : 0, backgroundColor: "#2E7D32" }} />
                <View style={{ flex: maxNet ? b.pending / maxNet : 0, backgroundColor: "#E65100" }} />
                <View style={{ flex: maxNet ? Math.max(0, 1 - (b.collected + b.pending) / maxNet) : 1 }} />
              </View>
            </View>
          ))
        )}
      </ReportCard>

      <ReportCard title="Discount given per bill" subtitle={`Weighted average ${pct1(discounts.weighted)} of gross. Oldest bill first.`}>
        <BarChart
          buckets={discounts.bills.map((d, i) => ({ key: `${d.label}-${i}`, label: d.label }))}
          labelEvery={Math.max(1, Math.ceil(discounts.bills.length / 8))}
          series={[{ label: "Discount % of gross", color: "#B8860B", values: discounts.bills.map((d) => d.pct * 100) }]}
          formatValue={(v) => `${v.toFixed(1)}%`}
        />
      </ReportCard>

      <ReportCard title="Numbered bills against earlier bills" subtitle="Bills with a bill number compared with bills entered without one.">
        <DataTable<{ label: string; value: (g: BillGroup) => string }>
          rows={COMPARE}
          rowKey={(r) => r.label}
          columns={[
            { key: "metric", title: "", width: 150, text: (r) => r.label },
            { key: "numbered", title: `Numbered (${numbered.bills})`, width: 120, align: "right", text: (r) => r.value(numbered) },
            { key: "earlier", title: `Earlier (${earlier.bills})`, width: 120, align: "right", text: (r) => r.value(earlier) },
          ]}
        />
      </ReportCard>

      <ReportCard title="All bills" subtitle="Red flags need a decision. Grey flags are for information. Tap a column to sort.">
        <DataTable<BillRow>
          rows={bills}
          rowKey={(b) => String(b.id)}
          initialSort={{ key: "date", desc: true }}
          columns={[
            { key: "date", title: "Date", width: 96, text: (b) => shortDate(b.date), sortValue: (b) => new Date(b.date).getTime() },
            { key: "bill", title: "Bill", width: 56, text: (b) => billLabel(b) },
            { key: "customer", title: "Customer", width: 130, text: (b) => b.customer, sortValue: (b) => b.customer },
            { key: "village", title: "Village", width: 96, text: (b) => b.village, sortValue: (b) => b.village },
            { key: "gross", title: "Gross", width: 80, align: "right", text: (b) => formatInr(b.gross), sortValue: (b) => b.gross },
            { key: "disc", title: "Discount", width: 72, align: "right", text: (b) => formatInr(b.discount), sortValue: (b) => b.discount },
            { key: "net", title: "Net", width: 80, align: "right", text: (b) => formatInr(b.net), sortValue: (b) => b.net },
            { key: "coll", title: "Collected", width: 80, align: "right", text: (b) => formatInr(b.collected), sortValue: (b) => b.collected },
            { key: "pend", title: "Pending", width: 76, align: "right", text: (b) => formatInr(b.pending), sortValue: (b) => b.pending },
            { key: "days", title: "Days open", width: 70, align: "right", text: (b) => (b.daysOpen === null ? "–" : String(b.daysOpen)), sortValue: (b) => b.daysOpen ?? -1 },
            {
              key: "flags",
              title: "Flags",
              width: 300,
              text: (b) => b.flags.map((f) => f.label).join(", "),
              render: (b) => (
                <View style={styles.flags}>
                  {b.flags.map((f) => (
                    <TagPill key={f.label} label={f.label} tone={f.severity} />
                  ))}
                </View>
              ),
            },
          ]}
        />
      </ReportCard>
    </View>
  );
};

const styles = StyleSheet.create({
  muted: { color: "#999", fontSize: 13 },
  billRow: { paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: "#F0F2F5" },
  billLabel: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  billSub: { fontSize: 11, color: "#888", marginBottom: 4 },
  track: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: "#F2F2F2" },
  flags: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
});

export default BillingSummaryTab;
