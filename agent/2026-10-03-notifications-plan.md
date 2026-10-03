# Notifications Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every system `Alert.alert` / `alert()` in the app with animated, branded banners (success / error / info)
and confirm dialogs.

**Architecture:**
- A pure notifier store (`src/ui/notify/notifier.ts`) holds the current banner, the confirm queue and the toast-host
  stack. Screens call `notify.*` and `await confirm(...)`.
- `ToastHost` and `ConfirmHost` render from the store with React Native `Animated`. `NotifyRoot` mounts both once in
  `App.tsx`.
- `BottomSheet` mounts its own `ToastHost`, so banners appear above open sheets.
- A source-audit rule forbids the system alert.

**Tech Stack:** React Native 0.81, Expo SDK 54, React 19.1 (`useSyncExternalStore`), `@expo/vector-icons`,
react-native-safe-area-context, Jest 29 + ts-jest (node env).

**Spec:** `agent/2026-10-03-notifications-design.md`

## Global Constraints

- Branch `feat/ui-revamp`. Commit messages plain, with **no `Co-Authored-By` or any other trailer**. Never stage
  `Rehan & Lenden Insights.html`; always `git add <explicit paths>`.
- No new dependencies of any kind. Motion uses `Animated` with `useNativeDriver: true`. No `Vibration`.
- No change to data, calculations, DB calls or navigation targets. Only how messages are shown changes.
- Text / TextInput come from `src/ui` (never react-native). Colours come from `src/ui/theme.ts`. Touch targets are at
  least 44 dp. The layout must work at 320 dp.
- Durations (ms): success 2200, info 2800, error 3500.
- Keep each file's line endings. App.tsx and most screens are CRLF.
- Every task ends with `npx tsc --noEmit` clean and `npx jest` passing.

## Review Focus

1. **A confirm called before the app has mounted its hosts** (the OTA check runs during the splash screen) must still
   be shown once the app loads. Pinned by the notifier test "queues confirms before any host".
2. **An error raised while a bottom sheet is open** (Add Variant, Edit Customer) must appear above the sheet. Pinned
   by the host-stack tests (Task 1), the BottomSheet `ToastHost` (Task 2) and the device checklist (Task 4).
3. **A success followed by `goBack()`** must still show the banner on the previous screen. The root host is outside
   the navigator (Task 2); device checklist.
4. **Double taps on a dialog button** must resolve the promise once. Pinned by the notifier test "answer twice
   resolves once", plus the `answered` guard in `ConfirmHost`.
5. **A stale banner timer** must not close a newer banner. Pinned by the notifier test "dismiss with a stale id is
   ignored".

---

### Task 1: Notifier store

**Files:**
- Create: `src/ui/notify/notifier.ts`, `src/ui/notify/notifier.test.ts`

**Interfaces — Produces:**
- `createNotifier()`, `notifier` (singleton), `notify.success/error/info(title, message?) → Toast`,
  `confirm(options) → Promise<boolean>`, `dismissResult(request) → boolean`
- `DURATIONS`, `CONFIRM_ICONS`
- Types `Toast`, `ToastKind`, `ConfirmTone`, `ConfirmOptions`, `ConfirmRequest`, `NotifyState`, `Notifier`

- [ ] **Step 1: Write the failing test** — `src/ui/notify/notifier.test.ts`

```ts
import { CONFIRM_ICONS, DURATIONS, createNotifier, dismissResult } from "./notifier";

describe("notifier banners (notifications spec §3.1)", () => {
  it("shows one banner at a time and replaces it with a new id", () => {
    const n = createNotifier();
    const a = n.show("success", "Saved", "Transaction added");
    const b = n.show("error", "Amount required");
    expect(n.getState().toast).toEqual(b);
    expect(b.id).not.toBe(a.id);
    expect(a).toMatchObject({ kind: "success", title: "Saved", message: "Transaction added", duration: 2200 });
  });
  it("uses the spec durations", () => {
    expect(DURATIONS).toEqual({ success: 2200, info: 2800, error: 3500 });
  });
  it("dismiss with a stale id is ignored", () => {
    const n = createNotifier();
    const a = n.show("info", "A");
    const b = n.show("info", "B");
    n.dismiss(a.id);
    expect(n.getState().toast).toEqual(b);
    n.dismiss(b.id);
    expect(n.getState().toast).toBeNull();
  });
  it("gives getState a new object after every change and notifies subscribers", () => {
    const n = createNotifier();
    const calls: number[] = [];
    const unsubscribe = n.subscribe(() => calls.push(1));
    const before = n.getState();
    n.show("info", "Hi");
    expect(n.getState()).not.toBe(before);
    unsubscribe();
    n.show("info", "Again");
    expect(calls).toHaveLength(1);
  });
});

describe("notifier confirms (notifications spec §3.1)", () => {
  it("fills defaults and picks the icon from the tone", () => {
    const n = createNotifier();
    void n.confirm({ title: "Delete customer?", tone: "danger", confirmLabel: "Delete" });
    void n.confirm({ title: "Continue?" });
    const [del, plain] = n.getState().confirms;
    expect(del).toMatchObject({ title: "Delete customer?", confirmLabel: "Delete", cancelLabel: "Cancel", tone: "danger", icon: CONFIRM_ICONS.danger });
    expect(plain).toMatchObject({ confirmLabel: "OK", cancelLabel: "Cancel", tone: "primary", icon: "help-circle-outline" });
    expect(CONFIRM_ICONS).toEqual({ danger: "trash-outline", warning: "alert-circle-outline", primary: "help-circle-outline" });
  });
  it("answers first-in first-out and resolves each promise with the choice", async () => {
    const n = createNotifier();
    const first = n.confirm({ title: "One" });
    const second = n.confirm({ title: "Two" });
    const [a, b] = n.getState().confirms;
    n.answer(a.id, true);
    expect(n.getState().confirms.map((c) => c.title)).toEqual(["Two"]);
    n.answer(b.id, false);
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
    expect(n.getState().confirms).toEqual([]);
  });
  it("answer twice resolves once", async () => {
    const n = createNotifier();
    const p = n.confirm({ title: "Once" });
    const id = n.getState().confirms[0].id;
    n.answer(id, true);
    n.answer(id, false);
    await expect(p).resolves.toBe(true);
  });
  it("queues confirms before any host mounts", () => {
    const n = createNotifier();
    void n.confirm({ title: "Update available" });
    expect(n.getState().activeHost).toBeNull();
    expect(n.getState().confirms).toHaveLength(1);
  });
  it("treats back/backdrop as Cancel, or as OK for a single-button dialog", () => {
    const n = createNotifier();
    void n.confirm({ title: "Two buttons" });
    void n.confirm({ title: "Notice", cancelLabel: null });
    const [two, one] = n.getState().confirms;
    expect(dismissResult(two)).toBe(false);
    expect(one.cancelLabel).toBeNull();
    expect(dismissResult(one)).toBe(true);
  });
});

describe("toast host stack (notifications spec §3.1)", () => {
  it("activates the last registered host and falls back when it is released", () => {
    const n = createNotifier();
    const root = n.registerToastHost();
    expect(n.getState().activeHost).toBe(root.id);
    const sheet = n.registerToastHost();
    expect(n.getState().activeHost).toBe(sheet.id);
    sheet.release();
    expect(n.getState().activeHost).toBe(root.id);
    sheet.release();
    expect(n.getState().activeHost).toBe(root.id);
    root.release();
    expect(n.getState().activeHost).toBeNull();
  });
  it("keeps the newer host active when an older one is released first", () => {
    const n = createNotifier();
    const a = n.registerToastHost();
    const b = n.registerToastHost();
    a.release();
    expect(n.getState().activeHost).toBe(b.id);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/notify/notifier.test.ts`
Expected: FAIL, "Cannot find module './notifier'".

- [ ] **Step 3: Write `src/ui/notify/notifier.ts`**

```ts
/**
 * App-wide banners and confirm dialogs (notifications spec §3.1). Pure — no react-native import — so it is unit-tested.
 * Screens call notify.* and confirm(); ToastHost / ConfirmHost draw from this store.
 */
export type ToastKind = "success" | "error" | "info";
export type ConfirmTone = "danger" | "warning" | "primary";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  duration: number;
}

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  /** null = single-button acknowledgement. */
  cancelLabel?: string | null;
  tone?: ConfirmTone;
  /** Ionicons glyph name; defaults by tone. */
  icon?: string;
}

export interface ConfirmRequest {
  id: number;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel: string | null;
  tone: ConfirmTone;
  icon: string;
}

export interface NotifyState {
  toast: Toast | null;
  confirms: ConfirmRequest[];
  /** The toast host that draws banners: the last registered one still mounted. */
  activeHost: number | null;
}

export const DURATIONS: Record<ToastKind, number> = { success: 2200, info: 2800, error: 3500 };

export const CONFIRM_ICONS: Record<ConfirmTone, string> = {
  danger: "trash-outline",
  warning: "alert-circle-outline",
  primary: "help-circle-outline",
};

/** What Android back or a backdrop tap means: Cancel, or OK when there is no Cancel button. */
export const dismissResult = (request: ConfirmRequest): boolean => request.cancelLabel === null;

export const createNotifier = () => {
  let state: NotifyState = { toast: null, confirms: [], activeHost: null };
  let nextId = 1;
  const hosts: number[] = [];
  const resolvers = new Map<number, (ok: boolean) => void>();
  const listeners = new Set<() => void>();

  const set = (patch: Partial<NotifyState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };

  return {
    getState: (): NotifyState => state,

    subscribe: (listener: () => void): (() => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    show: (kind: ToastKind, title: string, message?: string): Toast => {
      const toast: Toast = { id: nextId++, kind, title, message, duration: DURATIONS[kind] };
      set({ toast });
      return toast;
    },

    dismiss: (id: number): void => {
      if (state.toast?.id === id) set({ toast: null });
    },

    confirm: (options: ConfirmOptions): Promise<boolean> => {
      const tone = options.tone ?? "primary";
      const request: ConfirmRequest = {
        id: nextId++,
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "OK",
        cancelLabel: options.cancelLabel === undefined ? "Cancel" : options.cancelLabel,
        tone,
        icon: options.icon ?? CONFIRM_ICONS[tone],
      };
      return new Promise<boolean>((resolve) => {
        resolvers.set(request.id, resolve);
        set({ confirms: [...state.confirms, request] });
      });
    },

    answer: (id: number, ok: boolean): void => {
      const resolve = resolvers.get(id);
      if (!resolve) return;
      resolvers.delete(id);
      set({ confirms: state.confirms.filter((c) => c.id !== id) });
      resolve(ok);
    },

    registerToastHost: (): { id: number; release: () => void } => {
      const id = nextId++;
      hosts.push(id);
      set({ activeHost: id });
      return {
        id,
        release: () => {
          const index = hosts.indexOf(id);
          if (index < 0) return;
          hosts.splice(index, 1);
          set({ activeHost: hosts.length > 0 ? hosts[hosts.length - 1] : null });
        },
      };
    },
  };
};

export type Notifier = ReturnType<typeof createNotifier>;

/** The app's one notifier. */
export const notifier = createNotifier();

export const notify = {
  success: (title: string, message?: string) => notifier.show("success", title, message),
  error: (title: string, message?: string) => notifier.show("error", title, message),
  info: (title: string, message?: string) => notifier.show("info", title, message),
};

export const confirm = (options: ConfirmOptions): Promise<boolean> => notifier.confirm(options);
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx jest src/ui/notify/notifier.test.ts`
Expected: PASS (11 tests).

- [ ] **Step 5: Verify and commit**

Run `npx tsc --noEmit` (clean) and `npx jest` (all pass).

```bash
git add src/ui/notify/notifier.ts src/ui/notify/notifier.test.ts
git commit -m "Add the notifier store for app banners and confirm dialogs"
```

---

### Task 2: Animated banner and dialog hosts

**Files:**
- Create: `src/ui/notify/ToastHost.tsx`, `src/ui/notify/ConfirmHost.tsx`, `src/ui/notify/NotifyRoot.tsx`
- Modify: `src/ui/index.ts` (exports), `src/ui/BottomSheet.tsx` (mount a `ToastHost`), `App.tsx` (mount
  `NotifyRoot`, CRLF)

**Interfaces:**
- Consumes: `notifier`, `dismissResult`, `Toast`, `ToastKind`, `ConfirmRequest`, `ConfirmTone` (Task 1)
- Produces:
  - From `src/ui`: `notify`, `confirm`, `notifier`, `NotifyRoot`, and the types `ConfirmOptions`, `Toast`
  - `ToastHost` (default export, no props)

- [ ] **Step 1: Write `src/ui/notify/ToastHost.tsx`**

```tsx
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
```

- [ ] **Step 2: Write `src/ui/notify/ConfirmHost.tsx`**

```tsx
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
```

- [ ] **Step 3: Write `src/ui/notify/NotifyRoot.tsx`**

```tsx
import React from "react";
import ToastHost from "./ToastHost";
import ConfirmHost from "./ConfirmHost";

/** Mount once at the app root, outside the navigator, so banners survive navigation (notifications spec §3). */
const NotifyRoot: React.FC = () => (
  <>
    <ToastHost />
    <ConfirmHost />
  </>
);

export default NotifyRoot;
```

- [ ] **Step 4: Wire it in**
  - `src/ui/index.ts`: append

```ts
export { notify, confirm, notifier } from "./notify/notifier";
export type { ConfirmOptions, Toast } from "./notify/notifier";
export { default as NotifyRoot } from "./notify/NotifyRoot";
```

  - `src/ui/BottomSheet.tsx`: `import ToastHost from "./notify/ToastHost";`. Render `<ToastHost />` as the **last**
    child of the `KeyboardAvoidingView` (after the sheet `View`), so banners raised while a sheet is open draw above
    it.
  - `App.tsx`: add `NotifyRoot` to the existing `./src/ui` import. Render `<NotifyRoot />` inside `<SafeAreaProvider>`,
    right after `</NavigationContainer>`.

- [ ] **Step 5: Verify and commit**

Run: `npx tsc --noEmit` (clean) and `npx jest` (all pass). If tsc rejects `transformOrigin: "left"` in a StyleSheet,
use `transformOrigin: "left center"`.

```bash
git add src/ui/notify/ToastHost.tsx src/ui/notify/ConfirmHost.tsx src/ui/notify/NotifyRoot.tsx src/ui/index.ts src/ui/BottomSheet.tsx App.tsx
git commit -m "Add animated banner and confirm dialog hosts and mount them app-wide"
```

---

### Task 3: Migrate the app root, Home, and the transaction and customer forms

**Files (modify):**
- `App.tsx` (1 alert)
- `src/screen/homeScreen.tsx` (1)
- `src/screen/TransactionDetailScreen.tsx` (15)
- `src/screen/AddTransactionScreen.tsx` (9)
- `src/screen/NewCustomerScreen.tsx` (8)

**Interfaces:** Consumes `notify`, `confirm` from `src/ui` (Task 2).

Apply the spec §4 migration table to **every** `Alert.alert(` and bare `alert(` call in these files:

| Old | New |
|---|---|
| `Alert.alert("Success", msg, [{ text: "OK", onPress: () => navigation.goBack() }])` | `notify.success(<short title>, msg); navigation.goBack();` |
| `Alert.alert("Success", msg)` | `notify.success(<short title>, msg)` |
| Error / validation / failure / "Permission Required" / duplicate warning | `notify.error(<title>, msg)` |
| One-button info with no follow-up (e.g. "No Changes") | `notify.info(title, msg)` |
| Two or more buttons with an action | `if (await confirm({ title, message, confirmLabel, tone })) { …old action onPress body… }`. A cancel `onPress` body goes in an `else`. The enclosing function becomes `async` if it isn't already |

**Titles:** short and specific ("Transaction saved", "Amount required", "Couldn't save"). Keep the old message text as
the banner message where it reads well.

**Tones and labels:**
- Deletes: `tone: "danger"`, `confirmLabel: "Delete"`.
- "Close Rehan Entry": `tone: "warning"`, `confirmLabel: "Close entry"`.
- "Remove Image": `tone: "danger"`, `confirmLabel: "Remove"`.
- `App.tsx` "Update Available":

```tsx
        const restart = await confirm({
          title: "Update available",
          message: "A new version has been downloaded. Restart the app to apply the update.",
          confirmLabel: "Restart now",
          cancelLabel: "Later",
          tone: "primary",
          icon: "cloud-download-outline",
        });
        if (restart) await Updates.reloadAsync();
        else setIsUpdating(false);
```

- `homeScreen.tsx`: `Alert.alert("Export failed", "Please try again.")` → `notify.error("Export failed", "Please try again.")`.

**Rules:**
- Behaviour is unchanged. The same branches run and the same navigation happens. The only exception is that a success
  followed by `goBack` no longer waits for an OK tap.
- Remove `Alert` from the react-native import when it is no longer used.
- Keep CRLF in the CRLF files. `git diff -w --stat` must show only real changes.

- [ ] **Step 1:** Migrate the five files.
- [ ] **Step 2:** Verify that `grep -nE "Alert\.alert\(|(^|[^.A-Za-z])alert\(" App.tsx src/screen/homeScreen.tsx src/screen/TransactionDetailScreen.tsx src/screen/AddTransactionScreen.tsx src/screen/NewCustomerScreen.tsx` prints nothing. Then run `npx tsc --noEmit` (clean) and `npx jest` (all pass).
- [ ] **Step 3:** Commit.

```bash
git add App.tsx src/screen/homeScreen.tsx src/screen/TransactionDetailScreen.tsx src/screen/AddTransactionScreen.tsx src/screen/NewCustomerScreen.tsx
git commit -m "Show transaction, customer and update messages as animated banners and dialogs"
```

---

### Task 4: Migrate the remaining screens and pin the rule

**Files (modify):**
- `src/screen/AddEditCategoryScreen.tsx` (6)
- `src/screen/AddEditProductScreen.tsx` (7)
- `src/screen/BillPreviewScreen.tsx` (3)
- `src/screen/CategoryListScreen.tsx` (4)
- `src/screen/ExistingCustomersScreen.tsx` (6)
- `src/screen/ProductListScreen.tsx` (4)
- `src/screen/UpdateBhavScreen.tsx` (3)
- `src/screen/UserTransactionsScreen.tsx` (2)
- `src/ui/sourceAudit.test.ts`
- `agent/2026-10-03-ui-revamp-device-checklist.md`

**Interfaces:** Consumes `notify`, `confirm` from `src/ui` (Task 2).

- [ ] **Step 1: Append the failing audit rule** to the `describe` block in `src/ui/sourceAudit.test.ts`:

```ts
  it("shows messages through notify / confirm, never the system alert box (notifications spec §4)", () => {
    const systemAlert = /\bAlert\.alert\(|(^|[^.\w])alert\(/m;
    expect(appFiles.filter((f) => systemAlert.test(read(f)))).toEqual([]);
  });
```

- [ ] **Step 2:** Run `npx jest src/ui/sourceAudit.test.ts`. Expected: FAIL, listing the 8 screens.

- [ ] **Step 3: Migrate the 8 screens.** Use exactly the Task 3 migration table, titles, tones and rules:
  - Deletes: `tone: "danger"`, `confirmLabel: "Delete"`.
  - Successes that went back: `notify.success(...); navigation.goBack();`.
  - A delete followed by a success alert inside the confirmed branch:
    `notify.success("Category deleted")` etc.
  - Remove unused `Alert` imports, and keep CRLF.

- [ ] **Step 4: Add rows to the device checklist** (`agent/2026-10-03-ui-revamp-device-checklist.md`, append to the
  table):

```markdown
| 13 | Add Transaction → Save | A green "Transaction saved" banner slides down with a ticking icon and a shrinking line, and you are back on the customer's list without tapping OK |
| 14 | Add Transaction → Save with no amount | A red banner explains what is missing; tap or swipe up closes it early |
| 15 | Product → Add Variant sheet → save empty | The red banner appears above the open sheet |
| 16 | Existing Customers → Delete | A centred dialog with a red trash icon; Delete removes, Cancel / back / tapping outside keeps |
| 17 | After an over-the-air update downloads | The "Update available" dialog offers Restart now / Later |
```

- [ ] **Step 5: Verify.** `npx jest` passes, including the new audit rule. `npx tsc --noEmit` is clean. Then run
  `grep -rnE "Alert\.alert\(|(^|[^.A-Za-z])alert\(" src App.tsx --include=*.tsx | grep -v "^src/ui/"`, which must
  print nothing.

- [ ] **Step 6: Commit**

```bash
git add src/screen/AddEditCategoryScreen.tsx src/screen/AddEditProductScreen.tsx src/screen/BillPreviewScreen.tsx src/screen/CategoryListScreen.tsx src/screen/ExistingCustomersScreen.tsx src/screen/ProductListScreen.tsx src/screen/UpdateBhavScreen.tsx src/screen/UserTransactionsScreen.tsx src/ui/sourceAudit.test.ts agent/2026-10-03-ui-revamp-device-checklist.md
git commit -m "Move the remaining screens to animated banners and dialogs and forbid the system alert"
```
