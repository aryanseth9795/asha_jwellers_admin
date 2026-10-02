import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../../ui";
import { QualityReport } from "../../../utils/analytics/report/quality";
import { formatPct } from "../../../utils/analytics/format";
import ReportCard from "./ReportCard";
import TagPill from "./TagPill";

const DataQualityTab: React.FC<{ report: QualityReport }> = ({ report }) => (
  <View>
    <ReportCard title="Findings from the checks" subtitle="Checks run on the whole ledger, so they ignore the filters.">
      {report.checks.map((c) => (
        <View key={c.title} style={styles.check}>
          <View style={styles.checkHead}>
            <TagPill label={c.tag} />
            <Text style={styles.badge}>{c.badge}</Text>
          </View>
          <Text style={styles.title}>{c.title}</Text>
          <Text style={styles.detail}>{c.detail}</Text>
        </View>
      ))}
    </ReportCard>

    <ReportCard title="Field coverage" subtitle="Orange bars are below 50% coverage.">
      {report.coverage.map((c) => (
        <View key={c.label} style={styles.coverage}>
          <View style={styles.coverageHead}>
            <Text style={styles.coverageLabel}>{c.label}</Text>
            <Text style={styles.coveragePct}>{formatPct(c.share)}</Text>
          </View>
          <View style={styles.track}>
            <View style={{ flex: c.share, backgroundColor: c.share < 0.5 ? "#E65100" : "#3557A7" }} />
            <View style={{ flex: 1 - c.share }} />
          </View>
        </View>
      ))}
    </ReportCard>
  </View>
);

const styles = StyleSheet.create({
  check: { paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#F0F2F5", gap: 4 },
  checkHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: { fontSize: 12, color: "#555", fontVariant: ["tabular-nums"] },
  title: { fontSize: 14, fontWeight: "700", color: "#1A1A1A" },
  detail: { fontSize: 13, color: "#555", lineHeight: 19 },
  coverage: { paddingVertical: 6 },
  coverageHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  coverageLabel: { fontSize: 13, color: "#1A1A1A", flex: 1 },
  coveragePct: { fontSize: 13, fontWeight: "700", color: "#1A1A1A" },
  track: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: "#E8ECF4" },
});

export default DataQualityTab;
