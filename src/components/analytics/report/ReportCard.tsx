import React from "react";
import { StyleSheet, View } from "react-native";
import { Text } from "../../../ui";

/** A titled card with an optional one-line explanation and a control on the right. */
export const ReportCard: React.FC<{
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, subtitle, right, children }) => (
  <View style={styles.card}>
    <View style={styles.head}>
      <View style={styles.headText}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
    {right ? <View style={styles.right}>{right}</View> : null}
    {children}
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  head: { flexDirection: "row", marginBottom: 8 },
  headText: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: "#1A1A1A" },
  subtitle: { fontSize: 12, color: "#777", marginTop: 3, lineHeight: 17 },
  right: { marginBottom: 10 },
});

export default ReportCard;
