import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Easing, PanResponder, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "../Text";
import { colors, fontSize, radius } from "../theme";
import { Toast, ToastKind, notifier } from "./notifier";

const KINDS: Record<ToastKind, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  success: { color: colors.success, icon: "checkmark" },
  error: { color: colors.danger, icon: "close" },
  info: { color: colors.primary, icon: "information" },
};

/**
 * Draws the current banner (notifications spec §3.2) when this host is the top-most one: the app root, or an open
 * BottomSheet, so a banner is never hidden behind a sheet.
 */
const ToastHost: React.FC = () => {
  const [hostId, setHostId] = useState<number | null>(null);
  useEffect(() => {
    const host = notifier.registerToastHost();
    setHostId(host.id);
    return host.release;
  }, []);
  const { toast, activeHost } = useSyncExternalStore(notifier.subscribe, notifier.getState);
  if (hostId === null || activeHost !== hostId || !toast) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <ToastCard key={toast.id} toast={toast} />
    </View>
  );
};

const ToastCard: React.FC<{ toast: Toast }> = ({ toast }) => {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const gutter = width < 360 ? 12 : 16;
  const { color, icon } = KINDS[toast.kind];
  const slide = useRef(new Animated.Value(-120)).current;
  const fade = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(1)).current;
  const leaving = useRef(false);

  const leave = useCallback(() => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.parallel([
      Animated.timing(slide, { toValue: -120, duration: 180, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => notifier.dismiss(toast.id));
  }, [fade, slide, toast.id]);

  useEffect(() => {
    Animated.parallel([
      Animated.spring(slide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(120),
        Animated.spring(pop, { toValue: 1, friction: 4, tension: 160, useNativeDriver: true }),
      ]),
    ]).start();
    Animated.timing(progress, {
      toValue: 0,
      duration: toast.duration,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(leave, toast.duration);
    return () => clearTimeout(timer);
  }, [fade, leave, pop, progress, slide, toast.duration]);

  // Swipe up to dismiss; a short drag springs back.
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy < -6,
        onPanResponderMove: (_, g) => slide.setValue(Math.min(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy < -20) leave();
          else Animated.spring(slide, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [leave, slide],
  );

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.wrap,
        { top: insets.top + 8, left: gutter, right: gutter, opacity: fade, transform: [{ translateY: slide }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Pressable style={styles.card} onPress={leave} accessibilityHint="Dismisses the message">
        <View style={[styles.accent, { backgroundColor: color }]} />
        <Animated.View style={[styles.iconCircle, { backgroundColor: `${color}26`, transform: [{ scale: pop }] }]}>
          <Ionicons name={icon} size={22} color={color} />
        </Animated.View>
        <View style={styles.body}>
          <Text style={styles.title} numberOfLines={1}>
            {toast.title}
          </Text>
          {toast.message ? (
            <Text style={styles.message} numberOfLines={3}>
              {toast.message}
            </Text>
          ) : null}
        </View>
        <Animated.View style={[styles.progress, { backgroundColor: color, transform: [{ scaleX: progress }] }]} />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: "absolute", alignItems: "center" },
  card: {
    width: "100%",
    maxWidth: 520,
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
  },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSize.bodyLg, fontWeight: "800", color: colors.text },
  message: { fontSize: fontSize.caption + 1, color: colors.textDim, marginTop: 2, lineHeight: 18 },
  progress: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3, transformOrigin: "left" },
});

export default ToastHost;
