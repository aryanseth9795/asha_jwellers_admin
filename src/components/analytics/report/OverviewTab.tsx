import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import { BillRow, billingSummary } from "../../../utils/analytics/report/billing";
import { pledgeStats } from "../../../utils/analytics/report/pledgeBook";
import { keyFindings } from "../../../utils/analytics/report/findings";
import { formatCompactRupees, formatInr, formatPct } from "../../../utils/analytics/format";
import { StatGrid, StatTile } from "../StatTile";
import ReportCard from "./ReportCard";
import TagPill from "./TagPill";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;

const OverviewTab: React.FC<{
  pledges: PledgeRow[];
  bills: BillRow[];
  names: Map<number, string>;
  customersOnFile: number;
}> = ({ pledges, bills, names, customersOnFile }) => {
  const s = pledgeStats(pledges);
  const b = billingSummary(bills);
  const findings = keyFindings(pledges, bills, names);
  const openCustomers = new Set(pledges.filter((p) => p.open).map((p) => p.userId)).size;
  const openShare = s.principal ? s.openBook / s.principal : 0;
  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>OPEN PLEDGE BOOK</Text>
        <Text style={styles.big}>{inrC(s.openBook)}</Text>
        <Text style={styles.exact}>{formatInr(s.openBook)}</Text>
        <Text style={styles.lede}>
          {s.open} open {s.open === 1 ? "pledge" : "pledges"} held for {openCustomers}{" "}
          {openCustomers === 1 ? "customer" : "customers"}. That is {formatPct(openShare)} of the {inrC(s.principal)} principal in
          this view.
        </Text>
        <View style={styles.track}>
          <View style={{ flex: openShare, backgroundColor: "#8C5B14" }} />
          <View style={{ flex: 1 - openShare, backgroundColor: "#2E7D32" }} />
        </View>
        <View style={styles.trackLabels}>
          <Text style={styles.trackLabel}>Open {inrC(s.openBook)}</Text>
          <Text style={styles.trackLabel}>Redeemed {inrC(s.redeemedPrincipal)}</Text>
        </View>
      </View>

      <StatGrid>
        <StatTile label="Customers pledging" value={String(s.customers)} hint={`of ${customersOnFile} on file`} />
        <StatTile label="Median pledge" value={formatInr(s.medianPledge)} hint={`Average ${formatInr(s.avgPledge)}`} />
        <StatTile label="Redeemed" value={formatPct(s.redeemedPct)} hint={`${s.redeemed} of ${s.pledges} pledges`} tone="good" />
        <StatTile
          label="Median days to redeem"
          value={s.medianDaysToRedeem === null ? "—" : String(Math.round(s.medianDaysToRedeem))}
          hint={s.meanDaysToRedeem === null ? "nothing redeemed yet" : `mean ${Math.round(s.meanDaysToRedeem)}`}
        />
        <StatTile
          label="Open a year or more"
          value={inrC(s.openYearPlus)}
          hint={`${formatPct(s.openYearPlusShare)} of the open book`}
          tone="warn"
        />
        <StatTile label="Pending bill dues" value={inrC(b.pending)} hint={`of ${inrC(b.net)} net billed`} tone="warn" />
      </StatGrid>

      <ReportCard
        title="Key findings"
        subtitle={`Worked out from the current filters. Billing findings follow the village filter only. ${s.pledges} pledges in view.`}
      >
        {findings.length === 0 ? (
          <Text style={styles.muted}>Nothing stands out in this view yet.</Text>
        ) : (
          findings.map((f, i) => (
            <View key={i} style={styles.finding}>
              <TagPill label={f.tag} />
              <Text style={styles.findingTitle}>{f.title}</Text>
              <Text style={styles.findingDetail}>{f.detail}</Text>
            </View>
          ))
        )}
      </ReportCard>
    </View>
  );
};

const styles = StyleSheet.create({
  hero: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#EEF0F2" },
  eyebrow: { fontSize: 11, fontWeight: "800", letterSpacing: 1, color: "#8C5B14" },
  big: { fontSize: 40, fontWeight: "900", color: "#1A1A1A", marginTop: 4 },
  exact: { fontSize: 13, color: "#777" },
  lede: { fontSize: 13, color: "#444", marginTop: 8, lineHeight: 19 },
  track: { flexDirection: "row", height: 8, borderRadius: 4, overflow: "hidden", marginTop: 12, backgroundColor: "#EEE" },
  trackLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
  trackLabel: { fontSize: 11, color: "#777" },
  muted: { color: "#999", fontSize: 13 },
  finding: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F0F2F5", gap: 4 },
  findingTitle: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  findingDetail: { fontSize: 13, color: "#555", lineHeight: 19 },
});

export default OverviewTab;
