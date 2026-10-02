import React from "react";
import { StyleProp, StyleSheet, ViewStyle } from "react-native";
import { Edge, SafeAreaView } from "react-native-safe-area-context";
import { colors } from "./theme";

/** Below a native header: the header already covers the status bar. */
export const HEADER_EDGES: Edge[] = ["left", "right", "bottom"];
/** Header hidden (Home). */
export const ALL_EDGES: Edge[] = ["top", "left", "right", "bottom"];

/** Screen root that keeps content clear of the status bar, cutouts and the navigation bar (spec §6, rule 1). */
const Screen: React.FC<{ children: React.ReactNode; edges?: Edge[]; style?: StyleProp<ViewStyle> }> = ({
  children,
  edges = HEADER_EDGES,
  style,
}) => (
  <SafeAreaView edges={edges} style={[styles.root, style]}>
    {children}
  </SafeAreaView>
);

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: colors.bg } });

export default Screen;
