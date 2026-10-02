import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MetalView, WeightValue } from "../../utils/analytics/metal";
import { formatGrams } from "../../utils/analytics/format";
import { formatRupees } from "../../utils/billFormat";
import BarChart from "./BarChart";
import { AnalyticsCard, StatGrid, StatTile } from "./StatTile";

const GOLD = "#D4A017";
const SILVER = "#9AA5B1";

const tileHint = (t: WeightValue) => formatRupees(t.value);

const MetalSection: React.FC<{ view: MetalView }> = ({ view }) => (
  <View>
    <StatGrid>
      <StatTile label="Gold sold" value={formatGrams(view.sold.gold.weight)} hint={tileHint(view.sold.gold)} tone="gold" />
      <StatTile label="Silver sold" value={formatGrams(view.sold.silver.weight)} hint={tileHint(view.sold.silver)} tone="silver" />
      <StatTile label="Old gold in" value={formatGrams(view.received.gold.weight)} hint={tileHint(view.received.gold)} tone="gold" />
      <StatTile label="Old silver in" value={formatGrams(view.received.silver.weight)} hint={tileHint(view.received.silver)} tone="silver" />
    </StatGrid>

    {(view.sold.unknown.value > 0 || view.received.unknown.value > 0) && (
      <Text style={styles.note}>
        Not counted above (metal not set): sold {formatRupees(view.sold.unknown.value)}, old received{" "}
        {formatRupees(view.received.unknown.value)}.
      </Text>
    )}

    <AnalyticsCard title="New jewellery sold (weight)">
      <BarChart
        stacked
        buckets={view.buckets}
        series={[
          { label: "Gold", color: GOLD, values: view.soldGold },
          { label: "Silver", color: SILVER, values: view.soldSilver },
        ]}
        formatValue={formatGrams}
      />
    </AnalyticsCard>

    <AnalyticsCard title="Old jewellery received (weight)">
      <BarChart
        stacked
        buckets={view.buckets}
        series={[
          { label: "Gold", color: GOLD, values: view.receivedGold },
          { label: "Silver", color: SILVER, values: view.receivedSilver },
        ]}
        formatValue={formatGrams}
      />
    </AnalyticsCard>
  </View>
);

const styles = StyleSheet.create({
  note: { fontSize: 12, color: "#7A4545", backgroundColor: "#FDF3F3", padding: 10, borderRadius: 10, marginBottom: 14 },
});

export default MetalSection;
