import React from "react";
import { KeyboardAvoidingView, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { HeaderHeightContext } from "@react-navigation/elements";

/**
 * Keeps inputs and footer buttons above the keyboard (spec §6, rule 9). Edge-to-edge Android no longer resizes the
 * window for the keyboard, so this pads by the keyboard height. KeyboardAvoidingView measures itself relative to its
 * parent, so the native header above it is passed as the offset. Outside a navigator the context is undefined → 0.
 */
const KeyboardArea: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({ children, style }) => {
  const headerHeight = React.useContext(HeaderHeightContext) ?? 0;
  return (
    <KeyboardAvoidingView style={[styles.fill, style]} behavior="padding" keyboardVerticalOffset={headerHeight}>
      {children}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });

export default KeyboardArea;
