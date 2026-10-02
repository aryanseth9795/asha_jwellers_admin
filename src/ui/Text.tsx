import React from "react";
import { Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps } from "react-native";
import { MAX_FONT_SCALE } from "./theme";

/**
 * Text and TextInput that grow with the phone's font size up to 1.3× (spec §6). React 19 ignores defaultProps on
 * function components, so a wrapper is the only global switch. A caller can still pass maxFontSizeMultiplier.
 */
export const Text = React.forwardRef<RNText, TextProps>((props, ref) => (
  <RNText maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />
));
Text.displayName = "Text";
export type Text = React.ElementRef<typeof RNText>;

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>((props, ref) => (
  <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />
));
TextInput.displayName = "TextInput";
export type TextInput = React.ElementRef<typeof RNTextInput>;
