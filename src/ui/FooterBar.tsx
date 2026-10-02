import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { colors, space } from "./theme";

/**
 * Bottom action bar placed after the scroll view in a flex column (spec §6, rule 2). It is in the layout flow, so it
 * never covers content, and `Screen` keeps it above the navigation bar.
 */
const FooterBar: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => (
  <View style={[styles.bar, style]}>{children}</View>
);

const styles = StyleSheet.create({
  bar: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});

export default FooterBar;
