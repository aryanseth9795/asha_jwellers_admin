import React from "react";
import { View } from "react-native";
import { RehanView } from "../../utils/analytics/rehan";
import { formatCompactRupees } from "../../utils/analytics/format";
import { formatRupees } from "../../utils/billFormat";
import BarChart from "./BarChart";
import { AnalyticsCard, StatGrid, StatTile } from "./StatTile";

const GIVEN = "#E65100";
const RECOVERED = "#2E7D32";

const RehanSection: React.FC<{ view: RehanView }> = ({ view }) => (
  <View>
    <StatGrid>
      <StatTile label="Open rehan" value={String(view.openCount)} hint="as of today" />
      <StatTile label="Open balance" value={formatRupees(view.openBalance)} hint="as of today" tone="warn" />
      <StatTile label="Given" value={formatRupees(view.given)} hint={`${view.opened} opened`} tone="gold" />
      <StatTile label="Recovered" value={formatRupees(view.recovered)} hint={`${view.closed} closed`} tone="good" />
      <StatTile
        label="Days to close"
        value={view.medianDaysToClose === null ? "—" : String(Math.round(view.medianDaysToClose))}
        hint={view.avgDaysToClose === null ? "no closed rehan" : `typical · avg ${view.avgDaysToClose}`}
      />
    </StatGrid>

    <AnalyticsCard title="Given vs recovered">
      <BarChart
        buckets={view.buckets}
        series={[
          { label: "Given", color: GIVEN, values: view.givenSeries },
          { label: "Recovered", color: RECOVERED, values: view.recoveredSeries },
        ]}
        formatValue={formatCompactRupees}
      />
    </AnalyticsCard>

    <AnalyticsCard title="Year by year">
      <BarChart
        buckets={view.annual.map((a) => ({ key: a.label, label: a.label }))}
        series={[
          { label: "Given", color: GIVEN, values: view.annual.map((a) => a.given) },
          { label: "Recovered", color: RECOVERED, values: view.annual.map((a) => a.recovered) },
        ]}
        formatValue={formatCompactRupees}
      />
    </AnalyticsCard>
  </View>
);

export default RehanSection;
