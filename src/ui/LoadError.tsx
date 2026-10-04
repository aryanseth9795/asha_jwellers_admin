import React from "react";
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, fontSize, MIN_TOUCH, radius, space } from "./theme";

export interface LoadErrorProps {
  /** What failed, e.g. "Couldn't load customers". */
  title: string;
  message?: string;
  onRetry: () => void;
  /** Screens that already have pull-to-refresh pass both, so pulling down on the error state retries too. */
  refreshing?: boolean;
  onRefresh?: () => void;
}

/**
 * Shown where a screen would otherwise look empty after a read failed: a failed load must never look like
 * "no data" or "not found". A centred message and a Retry button of at least 44 dp.
 */
const LoadError: React.FC<LoadErrorProps> = ({ title, message, onRetry, refreshing = false, onRefresh }) => {
  const body = (
    <View style={styles.body}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.danger} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>
        {message ?? (onRefresh ? "Pull down or tap Retry to try again." : "Tap Retry to try again.")}
      </Text>
      <TouchableOpacity style={styles.retry} onPress={onRetry} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Retry">
        <Text style={styles.retryText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  if (!onRefresh) return <View style={styles.fill}>{body}</View>;
  return (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={styles.scrollFill}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
      }
    >
      {body}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  scrollFill: { flexGrow: 1 },
  body: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.xxl, paddingVertical: space.xxl },
  title: { marginTop: space.md, fontSize: fontSize.title, fontWeight: "700", color: colors.text, textAlign: "center" },
  message: { marginTop: space.xs, fontSize: fontSize.body, color: colors.textDim, textAlign: "center" },
  retry: {
    marginTop: space.xl,
    minWidth: 120,
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.xl,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: colors.primary,
  },
  retryText: { fontSize: fontSize.bodyLg, fontWeight: "700", color: colors.white },
});

export default LoadError;
