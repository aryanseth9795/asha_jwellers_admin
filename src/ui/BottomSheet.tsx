import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "./Text";
import { colors, fontSize, radius, space } from "./theme";

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  /** Pinned under the body (Save / Cancel); padded clear of the navigation bar. */
  footer?: React.ReactNode;
  /** false when the body is short or scrolls itself (e.g. a calendar). Default true. */
  scroll?: boolean;
  children: React.ReactNode;
}

/**
 * The one pop-up shape in the app (spec §6): slides up, never taller than 90 % of the window, keeps its buttons above
 * the navigation bar and its inputs above the keyboard. With edge-to-edge on, Android draws every Modal behind the
 * system bars, so the sheet pads itself by the bottom inset.
 */
const BottomSheet: React.FC<BottomSheetProps> = ({ visible, onClose, title, subtitle, footer, scroll = true, children }) => {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const bottomPad = Math.max(insets.bottom, space.lg);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView style={styles.fill} behavior="padding">
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheet, { maxHeight: Math.round(height * 0.9), paddingBottom: footer ? 0 : bottomPad }]}>
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
                {subtitle ? (
                  <Text style={styles.subtitle} numberOfLines={2}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.textDim} />
              </TouchableOpacity>
            </View>
          ) : null}
          {scroll ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.bodyContent]}>{children}</View>
          )}
          {footer ? <View style={[styles.footer, { paddingBottom: bottomPad }]}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.backdrop },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
    flexShrink: 1,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: space.sm,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingLeft: space.xl,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSize.heading - 2, fontWeight: "800", color: colors.text },
  subtitle: { fontSize: fontSize.caption + 1, color: colors.textDim, marginTop: 2 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: space.xl, paddingVertical: space.lg },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});

export default BottomSheet;
