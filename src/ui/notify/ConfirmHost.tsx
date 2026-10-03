import React, { useEffect, useRef, useSyncExternalStore } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../Text";
import { colors, fontSize } from "../theme";
import { ConfirmRequest, ConfirmTone, dismissResult, notifier } from "./notifier";

const TONES: Record<ConfirmTone, string> = {
  danger: colors.danger,
  warning: "#B26A00",
  primary: colors.primary,
};

/** Shows the first queued confirm as an animated dialog (notifications spec §3.3). */
const ConfirmHost: React.FC = () => {
  const { confirms } = useSyncExternalStore(notifier.subscribe, notifier.getState);
  const request = confirms[0];
  return request ? <ConfirmDialog key={request.id} request={request} /> : null;
};

const ConfirmDialog: React.FC<{ request: ConfirmRequest }> = ({ request }) => {
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const answered = useRef(false);
  const color = TONES[request.tone];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 7, tension: 120, useNativeDriver: true }),
      Animated.timing(halo, { toValue: 1, duration: 700, delay: 120, useNativeDriver: true }),
    ]).start();
  }, [fade, halo, scale]);

  const close = (ok: boolean) => {
    if (answered.current) return;
    answered.current = true;
    Animated.timing(fade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() =>
      notifier.answer(request.id, ok),
    );
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => close(dismissResult(request))}
    >
      <Animated.View style={[styles.backdrop, { opacity: fade }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => close(dismissResult(request))}
          accessibilityLabel="Dismiss"
          accessibilityRole="button"
        />
        <Animated.View
          style={[styles.card, { width: Math.min(width - 48, 360), transform: [{ scale }] }]}
          accessibilityViewIsModal
        >
          <View style={styles.iconWrap}>
            <Animated.View
              style={[
                styles.halo,
                {
                  backgroundColor: color,
                  opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                  transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
                },
              ]}
            />
            <View style={[styles.iconCircle, { backgroundColor: color }]}>
              <Ionicons name={request.icon as keyof typeof Ionicons.glyphMap} size={30} color={colors.white} />
            </View>
          </View>
          <Text style={styles.title} numberOfLines={2}>
            {request.title}
          </Text>
          {request.message ? (
            <ScrollView style={styles.messageBox} contentContainerStyle={styles.messageContent}>
              <Text style={styles.message}>{request.message}</Text>
            </ScrollView>
          ) : null}
          <TouchableOpacity
            style={[styles.button, { backgroundColor: color }]}
            onPress={() => close(true)}
            accessibilityRole="button"
          >
            <Text style={styles.confirmText} numberOfLines={1}>
              {request.confirmLabel}
            </Text>
          </TouchableOpacity>
          {request.cancelLabel !== null ? (
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={() => close(false)}
              accessibilityRole="button"
            >
              <Text style={styles.cancelText} numberOfLines={1}>
                {request.cancelLabel}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.backdrop, alignItems: "center", justifyContent: "center" },
  card: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    borderRadius: 24,
    backgroundColor: colors.surface,
    elevation: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },
  iconWrap: { width: 64, height: 64, marginBottom: 14, alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 64, height: 64, borderRadius: 32 },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  title: { fontSize: fontSize.heading, fontWeight: "800", color: colors.text, textAlign: "center" },
  messageBox: { maxHeight: 200, alignSelf: "stretch", flexGrow: 0, marginTop: 6 },
  messageContent: { paddingHorizontal: 4 },
  message: { fontSize: fontSize.body, color: colors.textDim, textAlign: "center", lineHeight: 20 },
  button: {
    alignSelf: "stretch",
    minHeight: 48,
    marginTop: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  cancelButton: { marginTop: 8, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
  confirmText: { fontSize: fontSize.bodyLg, fontWeight: "800", color: colors.white },
  cancelText: { fontSize: fontSize.bodyLg, fontWeight: "700", color: colors.textDim },
});

export default ConfirmHost;
