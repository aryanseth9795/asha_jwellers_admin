import React from "react";
import { View } from "react-native";
import { PledgeRow } from "../../../utils/analytics/report/pledges";
import { BillRow } from "../../../utils/analytics/report/billing";
import { ledgerScale, villageShares } from "../../../utils/analytics/report/together";
import { formatCompactRupees } from "../../../utils/analytics/format";
import BarChart from "../BarChart";
import ReportCard from "./ReportCard";
import HBars from "./HBars";

const inrC = (n: number) => `₹${formatCompactRupees(n)}`;

const TogetherTab: React.FC<{ pledges: PledgeRow[]; bills: BillRow[]; order: string[] }> = ({ pledges, bills, order }) => {
  const scale = ledgerScale(pledges, bills);
  const shares = villageShares(pledges, bills, order);
  return (
    <View>
      <ReportCard
        title="Scale of the two ledgers"
        subtitle={
          scale.ratio === null
            ? "Nothing has been billed yet."
            : `The open pledge book is ${scale.ratio.toFixed(1)} times everything billed so far.`
        }
      >
        <HBars
          labelWidth={150}
          rows={[
            { key: "open", label: "Open pledge book", value: scale.openBook, display: inrC(scale.openBook), color: "#8C5B14" },
            { key: "red", label: "Redeemed pledge principal", value: scale.redeemedPrincipal, display: inrC(scale.redeemedPrincipal), color: "#2E7D32" },
            { key: "net", label: "Net billed", value: scale.netBilled, display: inrC(scale.netBilled), color: "#B8860B" },
            { key: "pend", label: "Pending bill dues", value: scale.pending, display: inrC(scale.pending), color: "#E65100" },
          ]}
        />
      </ReportCard>

      <ReportCard
        title="Where each ledger is concentrated, by village"
        subtitle="Each village as a share of its own ledger, so the bars compare where business happens, not how big each ledger is."
      >
        <BarChart
          buckets={shares.map((s) => ({ key: s.village, label: s.village.slice(0, 7) }))}
          series={[
            { label: "Share of pledge principal", color: "#8C5B14", values: shares.map((s) => s.pledgeShare * 100) },
            { label: "Share of net billed", color: "#E65100", values: shares.map((s) => s.billShare * 100) },
          ]}
          formatValue={(v) => `${Math.round(v)}%`}
        />
      </ReportCard>
    </View>
  );
};

export default TogetherTab;
