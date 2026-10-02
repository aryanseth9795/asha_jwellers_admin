# UI Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two-business Home (Asha Jewellers / SSJ), Analytics regrouped into Overview · Customer · Rehan · Lenden, and no
layout overflow on any Android phone from 2022 to 2026 (320–480 dp wide, font scale up to 2.0, gesture or 3-button
navigation, edge-to-edge).

**Architecture:** A small shared UI layer in `src/ui/` (tokens, a font-capped `Text`, `Screen`, `FooterBar`,
`KeyboardArea`, `BottomSheet`, `MenuCard`, `useLayout`) that every screen adopts. Navigation menus and Analytics
sections are pure data modules with Jest tests. A source-audit Jest test pins the layout rules, so a later edit that
brings back a raw `Text` import, a `Dimensions` read or a bare `Modal` fails `npm test`.

**Tech Stack:** React Native 0.81.5, Expo SDK 54 (Android edge-to-edge always on), React 19.1,
`@react-navigation/native-stack` 7, `react-native-safe-area-context` 5, Jest 29 + ts-jest (node env, `src/**/*.test.ts`).

**Spec:** `agent/2026-10-03-ui-revamp-design.md`

## Global Constraints

- Branch `feat/ui-revamp`. Commit messages are plain, with **no `Co-Authored-By` or any other trailer** (owner's instruction).
- Never stage, move or delete `Rehan & Lenden Insights.html` at the repo root. Always `git add <explicit paths>`, never
  `git add -A` or `git add .`.
- No new native dependencies (the release goes out over the air). The only new package is the JS-only
  `@react-navigation/elements`, which is already installed as a dependency of native-stack (2.9.3). Task 1 adds it to
  `package.json`.
- Do not change anything under `src/utils/analytics/` except adding `report/sections.ts` and its test. Do not touch
  `src/database/`, `src/services/` or `assets/`. Numbers, data and the bill HTML stay exactly as they are.
- Keep every route name and its params. Keep every handler, state variable and database call in the screens. This is a
  layout change, not a behaviour change.
- The layout floor is **320 dp wide**. `Text` / `TextInput` cap font scaling at **1.3×** (`MAX_FONT_SCALE`). Touch
  targets are at least **44 dp**.
- Colours come from `src/ui/theme.ts` for new or rewritten code. Inner screens keep their existing colour literals
  unless a step says otherwise.
- **Line endings:** 32 files are CRLF (App.tsx, homeScreen, most screens and modals). Keep each file's existing line
  endings. The Edit tool preserves them; scripts must restore `\r\n` when the original had it.
- Every task ends with `npx tsc --noEmit` clean and `npx jest` passing (currently 27 suites / 212 tests).

## Review Focus

1. **Keyboard open on a form or sheet:** the focused field and the Save button stay above the keyboard. Edge-to-edge
   Android no longer resizes the window. Pinned by audit rules: the form screens use `KeyboardArea` (Task 7, Task 8),
   and the input pop-ups are `BottomSheet`s (Task 6). Also a device check in Task 10.
2. **3-button navigation bar (48 dp) instead of gestures:** no footer, FAB or sheet button sits under it. Pinned by audit
   rules: every screen roots in `Screen` and no screen imports `SafeAreaView` directly (Task 9), and `Modal` appears
   only inside `BottomSheet` and the image viewer (Task 9).
3. **Largest system font (Android 14+, up to 200 %):** text grows to 1.3× at most, so labels never push amounts off the
   card. Pinned by the audit rule that nothing imports `Text` / `TextInput` from `react-native` (Task 2).
4. **Width changes while the app is open** (unfolding a foldable, changing display size): grids and tile columns
   re-flow. Pinned by the `layoutFor` tests (Task 1) and the audit rule against `Dimensions` (Task 9).
5. **Long customer or village names and crore-sized amounts** in rows, chips and tables: names end with "…", amounts
   stay on one line, and nothing overlaps. Pinned by rule-4 edits (Tasks 8–10) and the device check with the exact
   strings in Task 10.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `src/ui/theme.ts` | colour / spacing / radius / type tokens, `MAX_FONT_SCALE`, `MIN_TOUCH` (pure) | 1 |
| `src/ui/layout.ts` + `layout.test.ts` | pure `layoutFor(width)`, `barLabelWidth(cardWidth, max)` | 1 |
| `src/ui/useLayout.ts` | hook: `layoutFor(useWindowDimensions().width)` (kept apart from `layout.ts` so Jest can load the pure part without react-native) | 1 |
| `src/ui/Text.tsx` | `Text`, `TextInput` with `maxFontSizeMultiplier = 1.3` | 1 |
| `src/ui/Screen.tsx` | safe-area screen root (`HEADER_EDGES`, `ALL_EDGES`) | 1 |
| `src/ui/FooterBar.tsx` | in-flow bottom action bar | 1 |
| `src/ui/KeyboardArea.tsx` | `KeyboardAvoidingView` padded by keyboard minus header height | 1 |
| `src/ui/BottomSheet.tsx` | inset- and keyboard-aware bottom sheet on `Modal` | 1 |
| `src/ui/MenuCard.tsx` | card for Home and the business menus | 1 |
| `src/ui/index.ts` | barrel | 1 |
| `src/ui/sourceAudit.test.ts` | static rules over the source tree | 2, 6, 7, 9 |
| `src/navigation/menus.ts` + `menus.test.ts` | `BUSINESSES`, `ROUTE_BUSINESS`, `headerColorFor` | 3 |
| `src/screen/BusinessMenuScreen.tsx` | AshaHome / SsjHome menu screen | 3 |
| `src/utils/analytics/report/sections.ts` + test | `SECTIONS`, `controlsFor`, `FIRST_VIEWS` | 4 |
| `src/components/analytics/SectionBar.tsx` | the 4 equal-width Analytics tabs | 4 |

---

### Task 1: Shared UI layer

**Files:**
- Create: `src/ui/theme.ts`, `src/ui/layout.ts`, `src/ui/layout.test.ts`, `src/ui/useLayout.ts`, `src/ui/Text.tsx`,
  `src/ui/Screen.tsx`, `src/ui/FooterBar.tsx`, `src/ui/KeyboardArea.tsx`, `src/ui/BottomSheet.tsx`,
  `src/ui/MenuCard.tsx`, `src/ui/index.ts`
- Modify: `package.json`, `package-lock.json` (add `@react-navigation/elements`)

**Interfaces:**
- Produces (every later task imports these from `src/ui`, through the barrel):
  - `colors`, `space`, `radius`, `fontSize`, `MAX_FONT_SCALE`, `MIN_TOUCH`
  - `layoutFor(width: number): Layout` and `barLabelWidth(cardWidth: number, max?: number): number`
  - `useLayout(): Layout`, where `Layout = { width; narrow; compact; tileColumns: 1 | 2; gutter; mediaTile }`
  - `Text`, `TextInput` (each works as a value and as a type)
  - `Screen` (props `children`, `edges?`, `style?`), `HEADER_EDGES`, `ALL_EDGES`
  - `FooterBar` (props `children`, `style?`)
  - `KeyboardArea` (props `children`, `style?`)
  - `BottomSheet` (props `visible`, `onClose`, `title?`, `subtitle?`, `footer?`, `scroll?` defaulting to true,
    `children`)
  - `MenuCard` (props `title`, `subtitle`, `icon: string`, `accent`, `tint`, `onPress`, `size?: "regular" | "large"`)

- [ ] **Step 1: Write the failing layout test** — `src/ui/layout.test.ts`

```ts
import { barLabelWidth, layoutFor } from "./layout";

describe("layoutFor (spec §6)", () => {
  it("treats 320 dp as narrow and compact with one tile column", () => {
    expect(layoutFor(320)).toEqual({ width: 320, narrow: true, compact: true, tileColumns: 1, gutter: 12, mediaTile: 92 });
  });
  it("switches to two tile columns at exactly 340 dp", () => {
    expect(layoutFor(339).tileColumns).toBe(1);
    expect(layoutFor(339).narrow).toBe(true);
    expect(layoutFor(340).tileColumns).toBe(2);
    expect(layoutFor(340).narrow).toBe(false);
  });
  it("stops being compact at exactly 360 dp and widens the gutter", () => {
    expect(layoutFor(359)).toMatchObject({ compact: true, gutter: 12 });
    expect(layoutFor(360)).toMatchObject({ compact: false, gutter: 16, mediaTile: 105 });
  });
  it("sizes three media tiles from the live width", () => {
    expect(layoutFor(412).mediaTile).toBe(122);
    expect(layoutFor(0).mediaTile).toBe(0);
  });
});

describe("barLabelWidth (spec §5)", () => {
  it("is 30 % of the card, clamped to 84–120 dp", () => {
    expect(barLabelWidth(0)).toBe(84);
    expect(barLabelWidth(264)).toBe(84);
    expect(barLabelWidth(356)).toBe(107);
    expect(barLabelWidth(500)).toBe(120);
  });
  it("lets a caller raise the maximum for long names", () => {
    expect(barLabelWidth(600, 150)).toBe(150);
    expect(barLabelWidth(400, 150)).toBe(120);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/layout.test.ts`
Expected: FAIL, "Cannot find module './layout'"

- [ ] **Step 3: Write `src/ui/theme.ts` and `src/ui/layout.ts`**

`src/ui/theme.ts`:

```ts
/** Design tokens (UI revamp spec §6). Pure — no react-native import — so Jest can load it. */
export const colors = {
  ajNavy: "#0B1F4B",
  ssjMaroon: "#7B1E3A",
  gold: "#B8860B",
  goldDeep: "#8C5B14",
  goldSoft: "#FAF1E2",
  goldLine: "#E8D5AF",
  primary: "#007AFF",
  bg: "#F8F9FA",
  surface: "#FFFFFF",
  border: "#EEF0F2",
  text: "#1A1A1A",
  textDim: "#666666",
  textMuted: "#888888",
  danger: "#C62828",
  success: "#2E7D32",
  white: "#FFFFFF",
  backdrop: "rgba(0,0,0,0.5)",
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 20 } as const;
/** Type scale in sp. `hero` is only used with adjustsFontSizeToFit. */
export const fontSize = { caption: 12, body: 14, bodyLg: 15, title: 17, heading: 20, display: 26, hero: 32 } as const;

/** Text grows with the phone's font size up to this factor. */
export const MAX_FONT_SCALE = 1.3;
/** Smallest touch target. */
export const MIN_TOUCH = 44;
```

`src/ui/layout.ts`:

```ts
/** Responsive layout values for a window width in dp (spec §6). Pure, so it is unit-tested. */
export interface Layout {
  width: number;
  /** Narrower than 340 dp: one tile column. */
  narrow: boolean;
  /** Narrower than 360 dp: tighter gutters. */
  compact: boolean;
  tileColumns: 1 | 2;
  gutter: number;
  /** Side of one tile in a three-column media grid with 16 dp padding and 12 dp gaps. */
  mediaTile: number;
}

export const layoutFor = (width: number): Layout => ({
  width,
  narrow: width < 340,
  compact: width < 360,
  tileColumns: width >= 340 ? 2 : 1,
  gutter: width < 360 ? 12 : 16,
  mediaTile: Math.max(0, Math.floor((width - 44) / 3)),
});

/** Label column of a horizontal bar chart: 30 % of the card, at least 84 dp, at most `max`. */
export const barLabelWidth = (cardWidth: number, max = 120): number =>
  Math.max(84, Math.min(max, Math.round(cardWidth * 0.3)));
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx jest src/ui/layout.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Add the header-height package**

Run: `npm install @react-navigation/elements@^2.9.3`
Expected: `package.json` dependencies gain `"@react-navigation/elements": "^2.9.3"`. Then run
`npm ls @react-navigation/elements` and check that native-stack's copy shows as `deduped` (one shared copy; otherwise
the header-height context would not match).

- [ ] **Step 6: Write the components**

`src/ui/useLayout.ts`:

```ts
import { useWindowDimensions } from "react-native";
import { Layout, layoutFor } from "./layout";

/** Live layout values; re-renders when the window width changes (fold/unfold, display size). */
export const useLayout = (): Layout => layoutFor(useWindowDimensions().width);
```

`src/ui/Text.tsx`:

```tsx
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
export type Text = RNText;

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>((props, ref) => (
  <RNTextInput maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} ref={ref} />
));
TextInput.displayName = "TextInput";
export type TextInput = RNTextInput;
```

`src/ui/Screen.tsx`:

```tsx
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
```

`src/ui/FooterBar.tsx`:

```tsx
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
```

`src/ui/KeyboardArea.tsx`:

```tsx
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
```

`src/ui/BottomSheet.tsx`:

```tsx
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
```

`src/ui/MenuCard.tsx`:

```tsx
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./Text";
import { colors, fontSize, radius, space } from "./theme";

export interface MenuCardProps {
  title: string;
  subtitle: string;
  /** Ionicons glyph name. */
  icon: string;
  /** Icon and chevron colour. */
  accent: string;
  /** Icon tile background. */
  tint: string;
  onPress: () => void;
  size?: "regular" | "large";
}

/** A tappable menu row for Home and the business menus (spec §6). Grows with its text; no fixed height. */
const MenuCard: React.FC<MenuCardProps> = ({ title, subtitle, icon, accent, tint, onPress, size = "regular" }) => {
  const large = size === "large";
  return (
    <TouchableOpacity
      style={[styles.card, large && styles.cardLarge]}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.icon, large && styles.iconLarge, { backgroundColor: tint }]}>
        <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={large ? 30 : 24} color={accent} />
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, large && styles.titleLarge]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={accent} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    minHeight: 72,
    padding: space.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  cardLarge: { minHeight: 104, padding: space.xl, borderRadius: radius.xl },
  icon: { width: 48, height: 48, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  iconLarge: { width: 60, height: 60, borderRadius: radius.lg },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: fontSize.title, fontWeight: "700", color: colors.text },
  titleLarge: { fontSize: fontSize.heading, fontWeight: "800" },
  subtitle: { fontSize: fontSize.caption + 1, color: colors.textDim, marginTop: 2 },
});

export default MenuCard;
```

`src/ui/index.ts`:

```ts
export * from "./theme";
export * from "./layout";
export { useLayout } from "./useLayout";
export { Text, TextInput } from "./Text";
export { default as Screen, HEADER_EDGES, ALL_EDGES } from "./Screen";
export { default as FooterBar } from "./FooterBar";
export { default as KeyboardArea } from "./KeyboardArea";
export { default as BottomSheet } from "./BottomSheet";
export type { BottomSheetProps } from "./BottomSheet";
export { default as MenuCard } from "./MenuCard";
export type { MenuCardProps } from "./MenuCard";
```

- [ ] **Step 7: Type-check and run all tests**

Run: `npx tsc --noEmit` → no output. Run: `npx jest` → all suites pass (213+ tests).
If tsc rejects `export type Text = RNText` in `Text.tsx`, the cause is the react-native type shape: use
`export type Text = React.ElementRef<typeof RNText>` (and the same for `TextInput`).

- [ ] **Step 8: Commit**

```bash
git add src/ui package.json package-lock.json
git commit -m "Add shared UI layer: tokens, layout, capped Text, Screen, FooterBar, KeyboardArea, BottomSheet, MenuCard"
```

---

### Task 2: Every screen uses the font-capped Text

**Files:**
- Modify: every `.tsx` under `src/` (outside `src/ui/`) plus `App.tsx` that imports `Text` or `TextInput` from
  `react-native` (46 files today)
- Create: `src/ui/sourceAudit.test.ts`

**Interfaces:**
- Consumes: `Text`, `TextInput` from `src/ui` (Task 1)
- Produces: `src/ui/sourceAudit.test.ts` with helpers `read(rel)`, `appFiles` and `rnImports(src)`. Tasks 6, 7 and 9
  append `it(...)` rules to this file.

- [ ] **Step 1: Write the failing audit test** — `src/ui/sourceAudit.test.ts`

```ts
import * as fs from "fs";
import * as path from "path";

/** Static checks that pin the UI revamp's layout rules (spec §6) on the whole source tree. */
const ROOT = path.join(__dirname, "..", "..");
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const tsxUnder = (dir: string): string[] =>
  fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return tsxUnder(rel);
    return rel.endsWith(".tsx") ? [rel] : [];
  });
/** App code: App.tsx and every .tsx under src except the UI layer itself. */
const appFiles = ["App.tsx", ...tsxUnder("src").filter((f) => !f.startsWith("src/ui/"))];
/** Names imported with `import { … } from "react-native"`. */
const rnImports = (src: string): string[] =>
  [...src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["']react-native["']/g)].flatMap((m) =>
    m[1].split(",").map((s) => s.trim()).filter(Boolean),
  );

describe("source audit (UI revamp spec §6)", () => {
  it("imports Text and TextInput from src/ui, never straight from react-native", () => {
    const offenders = appFiles.filter((f) => rnImports(read(f)).some((s) => s === "Text" || s === "TextInput"));
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/sourceAudit.test.ts`
Expected: FAIL, with the offenders array listing about 46 files.

- [ ] **Step 3: Run the codemod**

Save this as `tmp-codemod-text.js` at the repo root. Run `node tmp-codemod-text.js`, then delete the file (it is never
committed).

```js
// Moves Text / TextInput from `import { … } from "react-native"` to src/ui (UI revamp spec §6). Keeps CRLF files CRLF.
const fs = require("fs");
const path = require("path");
const ROOT = process.cwd();
const UI = path.join(ROOT, "src", "ui");
const files = [path.join(ROOT, "App.tsx")];
const walk = (dir) => {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) {
      if (p !== UI) walk(p);
    } else if (p.endsWith(".tsx")) files.push(p);
  }
};
walk(path.join(ROOT, "src"));
const IMPORT = /import\s*\{([^}]*)\}\s*from\s*["']react-native["'];?/;
let changed = 0;
for (const file of files) {
  const raw = fs.readFileSync(file, "utf8");
  const crlf = raw.includes("\r\n");
  let src = raw.replace(/\r\n/g, "\n");
  const m = src.match(IMPORT);
  if (!m) continue;
  const specs = m[1].split(",").map((s) => s.trim()).filter(Boolean);
  const moved = specs.filter((s) => s === "Text" || s === "TextInput");
  if (moved.length === 0) continue;
  const kept = specs.filter((s) => s !== "Text" && s !== "TextInput");
  let rel = path.relative(path.dirname(file), UI).split(path.sep).join("/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  const rnImport =
    kept.length === 0
      ? ""
      : m[0].includes("\n")
        ? `import {\n${kept.map((s) => `  ${s},`).join("\n")}\n} from "react-native";`
        : `import { ${kept.join(", ")} } from "react-native";`;
  const uiImport = `import { ${moved.sort().join(", ")} } from "${rel}";`;
  src = src.replace(m[0], rnImport ? `${rnImport}\n${uiImport}` : uiImport);
  fs.writeFileSync(file, crlf ? src.replace(/\n/g, "\r\n") : src);
  changed++;
  console.log("updated", path.relative(ROOT, file));
}
console.log(`${changed} files updated`);
```

Expected output: about 46 "updated" lines. `App.tsx` gets `import { Text } from "./src/ui";`.

- [ ] **Step 4: Verify**

Run: `npx jest src/ui/sourceAudit.test.ts` → PASS. Run: `npx tsc --noEmit` → clean. Run: `npx jest` → all pass.
Run: `git diff --stat` → only import lines changed (2–4 lines per file). Spot-check one CRLF file with
`git diff src/screen/UpdateBhavScreen.tsx`: the diff must show only the import lines, not every line.

- [ ] **Step 5: Commit**

```bash
git add App.tsx src/screen src/components src/ui/sourceAudit.test.ts
git commit -m "Route every Text and TextInput through the font-capped UI wrapper"
```

---

### Task 3: Two-business Home and menus

**Files:**
- Create: `src/navigation/menus.ts`, `src/navigation/menus.test.ts`, `src/screen/BusinessMenuScreen.tsx`
- Modify: `src/types/entry.ts` (RootStackParamList, CRLF), `App.tsx` (CRLF), `src/screen/homeScreen.tsx` (full
  rewrite, keep CRLF)

**Interfaces:**
- Consumes: `colors`, `Screen`, `ALL_EDGES`, `MenuCard`, `Text`, `space`, `fontSize`, `radius` from `src/ui`
- Produces:
  - `RootStackParamList` gains `AshaHome: undefined; SsjHome: undefined;`
  - `BUSINESSES: Business[]`, `businessById(id)`, `ROUTE_BUSINESS`, `headerColorFor(route)`
  - Types `BusinessId = "aj" | "ssj"`, `MenuRoute`, `MenuItem`

- [ ] **Step 1: Add the routes** — in `src/types/entry.ts`, inside `RootStackParamList` right after `Home: undefined;`:

```ts
  AshaHome: undefined;
  SsjHome: undefined;
```

- [ ] **Step 2: Write the failing test** — `src/navigation/menus.test.ts`

```ts
import { BUSINESSES, ROUTE_BUSINESS, businessById, headerColorFor } from "./menus";
import { colors } from "../ui/theme";

describe("business menus (UI revamp spec §4)", () => {
  it("offers Asha Jewellers first, then SSJ", () => {
    expect(BUSINESSES.map((b) => [b.id, b.name, b.hubRoute])).toEqual([
      ["aj", "Asha Jewellers", "AshaHome"],
      ["ssj", "SSJ", "SsjHome"],
    ]);
  });
  it("gives Asha Jewellers the customer flows and analytics", () => {
    expect(businessById("aj").items.map((i) => [i.label, i.route])).toEqual([
      ["Existing Customer", "ExistingCustomers"],
      ["New Customer", "NewCustomer"],
      ["Analytics", "Analytics"],
    ]);
  });
  it("gives SSJ bhav, categories and products", () => {
    expect(businessById("ssj").items.map((i) => [i.label, i.route])).toEqual([
      ["Update Bhav", "UpdateBhav"],
      ["Category", "CategoryList"],
      ["Product", "ProductList"],
    ]);
  });
  it("assigns each menu and its items to its own business", () => {
    for (const b of BUSINESSES) {
      expect(ROUTE_BUSINESS[b.hubRoute]).toBe(b.id);
      for (const item of b.items) expect(ROUTE_BUSINESS[item.route]).toBe(b.id);
    }
  });
  it("keeps the deep customer flows under Asha Jewellers and catalogue edits under SSJ", () => {
    for (const r of ["UserTransactions", "AddTransaction", "TransactionDetail", "BillPreview"] as const) {
      expect(ROUTE_BUSINESS[r]).toBe("aj");
    }
    for (const r of ["AddEditCategory", "AddEditProduct"] as const) expect(ROUTE_BUSINESS[r]).toBe("ssj");
  });
  it("colours headers navy for Asha Jewellers and maroon for SSJ", () => {
    expect(headerColorFor("TransactionDetail")).toBe(colors.ajNavy);
    expect(headerColorFor("AddEditProduct")).toBe(colors.ssjMaroon);
    expect(headerColorFor("Home")).toBe(colors.ajNavy);
  });
  it("uses unique menu keys", () => {
    const keys = BUSINESSES.flatMap((b) => b.items.map((i) => i.key));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx jest src/navigation/menus.test.ts`
Expected: FAIL, "Cannot find module './menus'"

- [ ] **Step 4: Write `src/navigation/menus.ts`**

```ts
import type { RootStackParamList } from "../types/entry";
import { colors } from "../ui/theme";

/** The owner's two businesses and their menus (UI revamp spec §4). Pure data, so it is unit-tested. */
type RouteName = keyof RootStackParamList;
/** Compile-time check that every listed name is a real route. */
type Routes<T extends RouteName> = T;

export type BusinessId = "aj" | "ssj";
export type HubRoute = Routes<"AshaHome" | "SsjHome">;
export type MenuRoute = Routes<
  "ExistingCustomers" | "NewCustomer" | "Analytics" | "UpdateBhav" | "CategoryList" | "ProductList"
>;

export interface MenuItem {
  key: string;
  label: string;
  subtitle: string;
  /** Ionicons glyph name. */
  icon: string;
  route: MenuRoute;
}

export interface Business {
  id: BusinessId;
  name: string;
  subtitle: string;
  icon: string;
  /** Header colour, icon colour. */
  accent: string;
  /** Icon tile background. */
  tint: string;
  hubRoute: HubRoute;
  items: MenuItem[];
}

export const BUSINESSES: Business[] = [
  {
    id: "aj",
    name: "Asha Jewellers",
    subtitle: "Customers · Rehan · Len-den · Analytics",
    icon: "diamond-outline",
    accent: colors.ajNavy,
    tint: "#E7ECF7",
    hubRoute: "AshaHome",
    items: [
      { key: "existing", label: "Existing Customer", subtitle: "View and manage entries", icon: "folder-open-outline", route: "ExistingCustomers" },
      { key: "new", label: "New Customer", subtitle: "Create a new entry", icon: "person-add-outline", route: "NewCustomer" },
      { key: "analytics", label: "Analytics", subtitle: "Overview · Customer · Rehan · Lenden", icon: "bar-chart-outline", route: "Analytics" },
    ],
  },
  {
    id: "ssj",
    name: "SSJ",
    subtitle: "Bhav · Categories · Products",
    icon: "storefront-outline",
    accent: colors.ssjMaroon,
    tint: "#F7E8EC",
    hubRoute: "SsjHome",
    items: [
      { key: "bhav", label: "Update Bhav", subtitle: "Update commodity rates", icon: "trending-up-outline", route: "UpdateBhav" },
      { key: "category", label: "Category", subtitle: "Manage product categories", icon: "folder-outline", route: "CategoryList" },
      { key: "product", label: "Product", subtitle: "Manage products & variants", icon: "cube-outline", route: "ProductList" },
    ],
  },
];

/** Which business owns each route below Home; drives the header colour. tsc enforces that every route is listed. */
export const ROUTE_BUSINESS: Record<Exclude<RouteName, "Home">, BusinessId> = {
  AshaHome: "aj",
  NewCustomer: "aj",
  ExistingCustomers: "aj",
  UserTransactions: "aj",
  AddTransaction: "aj",
  TransactionDetail: "aj",
  BillPreview: "aj",
  Analytics: "aj",
  SsjHome: "ssj",
  UpdateBhav: "ssj",
  CategoryList: "ssj",
  AddEditCategory: "ssj",
  ProductList: "ssj",
  AddEditProduct: "ssj",
};

export const businessById = (id: BusinessId): Business => {
  const business = BUSINESSES.find((b) => b.id === id);
  if (!business) throw new Error(`Unknown business ${id}`);
  return business;
};

export const headerColorFor = (route: RouteName): string =>
  route === "Home" ? colors.ajNavy : businessById(ROUTE_BUSINESS[route]).accent;
```

- [ ] **Step 5: Run the test to see it pass**

Run: `npx jest src/navigation/menus.test.ts` → PASS (7 tests).

- [ ] **Step 6: Write `src/screen/BusinessMenuScreen.tsx`** (new file, LF)

```tsx
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/entry";
import { BUSINESSES, MenuRoute } from "../navigation/menus";
import { MenuCard, Screen, Text, colors, fontSize, space } from "../ui";

type Props = NativeStackScreenProps<RootStackParamList, "AshaHome" | "SsjHome">;

/** One business's menu: Asha Jewellers or SSJ (spec §4). */
const BusinessMenuScreen: React.FC<Props> = ({ navigation, route }) => {
  const business = BUSINESSES.find((b) => b.hubRoute === route.name) ?? BUSINESSES[0];
  const open = (target: MenuRoute) => {
    switch (target) {
      case "ExistingCustomers":
        return navigation.navigate("ExistingCustomers");
      case "NewCustomer":
        return navigation.navigate("NewCustomer");
      case "Analytics":
        return navigation.navigate("Analytics");
      case "UpdateBhav":
        return navigation.navigate("UpdateBhav");
      case "CategoryList":
        return navigation.navigate("CategoryList");
      case "ProductList":
        return navigation.navigate("ProductList", {});
    }
  };
  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.lede}>{business.subtitle}</Text>
        <View style={styles.list}>
          {business.items.map((item) => (
            <MenuCard
              key={item.key}
              title={item.label}
              subtitle={item.subtitle}
              icon={item.icon}
              accent={business.accent}
              tint={business.tint}
              onPress={() => open(item.route)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { padding: space.lg, paddingBottom: space.xxl },
  lede: { fontSize: fontSize.body, color: colors.textDim, marginBottom: space.lg },
  list: { gap: space.md },
});

export default BusinessMenuScreen;
```

- [ ] **Step 7: Rewrite `src/screen/homeScreen.tsx`** (keep CRLF; replace the whole file)

```tsx
import React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useIsFocused } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../types/entry";
import { exportData } from "../services/ExportService";
import { BUSINESSES, BusinessId } from "../navigation/menus";
import { ALL_EDGES, MenuCard, Screen, Text, colors, fontSize, radius, space } from "../ui";

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, "Home">;

interface Props {
  navigation: HomeScreenNavigationProp;
}

/** Business picker: Asha Jewellers or SSJ (spec §4). */
const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const isFocused = useIsFocused();
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportData();
    } catch (error) {
      console.error("Export failed:", error);
      Alert.alert("Export failed", "Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const openBusiness = (id: BusinessId) =>
    id === "aj" ? navigation.navigate("AshaHome") : navigation.navigate("SsjHome");

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Screen edges={ALL_EDGES}>
      {/* Only while Home is on top, so the dark icons don't leak onto the navy headers. */}
      {isFocused && <StatusBar style="dark" />}
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.name} numberOfLines={1}>
              Ayush
            </Text>
            <View style={styles.dateBadge}>
              <Ionicons name="calendar-outline" size={14} color={colors.textDim} />
              <Text style={styles.dateText} numberOfLines={1}>
                {today}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
            disabled={isExporting}
            accessibilityLabel="Export data"
          >
            {isExporting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="cloud-upload-outline" size={22} color={colors.primary} />
            )}
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.sectionTitle}>Choose business</Text>
        <View style={styles.list}>
          {BUSINESSES.map((b) => (
            <MenuCard
              key={b.id}
              size="large"
              title={b.name}
              subtitle={b.subtitle}
              icon={b.icon}
              accent={b.accent}
              tint={b.tint}
              onPress={() => openBusiness(b.id)}
            />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.xxl,
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  headerText: { flex: 1, minWidth: 0 },
  greeting: { fontSize: fontSize.bodyLg, color: colors.textDim, fontWeight: "500" },
  name: { fontSize: fontSize.display, fontWeight: "800", color: colors.text, marginTop: 2 },
  dateBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    gap: 6,
    marginTop: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F0F2F5",
  },
  dateText: { flexShrink: 1, fontSize: fontSize.caption + 1, color: colors.textDim, fontWeight: "600" },
  exportButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 64,
    minHeight: 56,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    backgroundColor: "#F0F7FF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 2,
  },
  exportText: { fontSize: fontSize.caption, fontWeight: "700", color: colors.primary },
  sectionTitle: {
    fontSize: fontSize.title,
    fontWeight: "700",
    color: "#333",
    marginTop: space.xxl,
    marginBottom: space.md,
    paddingHorizontal: space.xl,
  },
  list: { gap: space.lg, paddingHorizontal: space.xl },
});

export default HomeScreen;
```

- [ ] **Step 8: Wire `App.tsx`** (CRLF; use the Edit tool)

1. Imports: add `import BusinessMenuScreen from "./src/screen/BusinessMenuScreen";`,
   `import { headerColorFor } from "./src/navigation/menus";` and `import { colors } from "./src/ui";`. Task 2 already
   added `import { Text } from "./src/ui";`, so merge them into `import { Text, colors } from "./src/ui";`.
2. In the navigator, change `<StatusBar style="auto" />` to `<StatusBar style="light" />`.
3. Replace the static `screenOptions={{ … }}` with:

```tsx
          screenOptions={({ route }) => ({
            headerStyle: { backgroundColor: headerColorFor(route.name) },
            headerTintColor: colors.white,
            headerTitleStyle: { fontWeight: "bold" },
          })}
```

4. Right after the `Home` `<Stack.Screen>`, add:

```tsx
          <Stack.Screen
            name="AshaHome"
            component={BusinessMenuScreen}
            options={{ title: "Asha Jewellers" }}
          />
          <Stack.Screen
            name="SsjHome"
            component={BusinessMenuScreen}
            options={{ title: "SSJ" }}
          />
```

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npx jest` → all pass.
Run: `grep -n "Dimensions" src/screen/homeScreen.tsx` → no output.

- [ ] **Step 10: Commit**

```bash
git add src/navigation src/screen/BusinessMenuScreen.tsx src/screen/homeScreen.tsx src/types/entry.ts App.tsx
git commit -m "Open the app on a two-business Home with Asha Jewellers and SSJ menus and per-business headers"
```

---

### Task 4: Analytics in four sections

**Files:**
- Create: `src/utils/analytics/report/sections.ts`, `src/utils/analytics/report/sections.test.ts`,
  `src/components/analytics/SectionBar.tsx`
- Modify: `src/components/analytics/report/Segmented.tsx` (add `fill`), `src/screen/AnalyticsScreen.tsx` (rewrite
  the tab structure and render)

**Interfaces:**
- Consumes: `Screen`, `Text`, `useLayout`, `colors`, `fontSize`, `space` from `src/ui`
- Produces:
  - `SECTIONS: Section[]`, `DEFAULT_VIEW`, `FIRST_VIEWS: Record<SectionKey, ViewKey>`, `sectionOf(view)`,
    `controlsFor(view): Controls`
  - Types `SectionKey`, `ViewKey`, `Controls`, `Section`, `SubTab`
  - `Segmented` gains `fill?: boolean`
  - `SectionBar` (props `sections`, `value`, `onChange`)

- [ ] **Step 1: Write the failing test** — `src/utils/analytics/report/sections.test.ts`

```ts
import { DEFAULT_VIEW, FIRST_VIEWS, SECTIONS, controlsFor, sectionOf } from "./sections";

const views = SECTIONS.flatMap((s) => s.subTabs.map((t) => t.key));

describe("Analytics sections (UI revamp spec §5)", () => {
  it("has the four sections from the owner's diagram, in order", () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(["Overview", "Customer", "Rehan", "Lenden"]);
  });
  it("lists each section's sub-tabs in order", () => {
    expect(SECTIONS.map((s) => s.subTabs.map((t) => t.label))).toEqual([
      ["Findings", "Together", "Data quality"],
      ["Rehan", "Lenden"],
      ["Book", "Items"],
      ["Summary", "Sales", "Metal", "Trends"],
    ]);
  });
  it("shows each of the 11 former views exactly once", () => {
    expect(views).toHaveLength(11);
    expect(new Set(views).size).toBe(11);
  });
  it("uses pledge filters on pledge views, the time frame on billing views and nothing on data quality", () => {
    expect(Object.fromEntries(views.map((v) => [v, controlsFor(v)]))).toEqual({
      "overview/findings": "pledge",
      "overview/together": "pledge",
      "overview/quality": "none",
      "customer/rehan": "pledge",
      "customer/lenden": "timeframe",
      "rehan/book": "pledge",
      "rehan/items": "pledge",
      "lenden/summary": "timeframe",
      "lenden/sales": "timeframe",
      "lenden/metal": "timeframe",
      "lenden/trends": "timeframe",
    });
  });
  it("keeps every sub-tab inside its own section", () => {
    for (const s of SECTIONS) for (const t of s.subTabs) expect(sectionOf(t.key)).toBe(s.key);
  });
  it("opens on Overview → Findings and each section on its first sub-tab", () => {
    expect(DEFAULT_VIEW).toBe("overview/findings");
    expect(FIRST_VIEWS).toEqual({
      overview: "overview/findings",
      customer: "customer/rehan",
      rehan: "rehan/book",
      lenden: "lenden/summary",
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/utils/analytics/report/sections.test.ts`
Expected: FAIL, "Cannot find module './sections'"

- [ ] **Step 3: Write `src/utils/analytics/report/sections.ts`**

```ts
/** The four Analytics sections and their sub-tabs (UI revamp spec §5). Every report of insights v3 appears once. */
export type SectionKey = "overview" | "customer" | "rehan" | "lenden";
export type ViewKey =
  | "overview/findings"
  | "overview/together"
  | "overview/quality"
  | "customer/rehan"
  | "customer/lenden"
  | "rehan/book"
  | "rehan/items"
  | "lenden/summary"
  | "lenden/sales"
  | "lenden/metal"
  | "lenden/trends";
/** Which control row a view shows: the pledge filters, the billing time frame, or nothing. */
export type Controls = "pledge" | "timeframe" | "none";

export interface SubTab {
  key: ViewKey;
  label: string;
  controls: Controls;
}

export interface Section {
  key: SectionKey;
  label: string;
  /** Ionicons glyph name. */
  icon: string;
  subTabs: SubTab[];
}

export const SECTIONS: Section[] = [
  {
    key: "overview",
    label: "Overview",
    icon: "pie-chart-outline",
    subTabs: [
      { key: "overview/findings", label: "Findings", controls: "pledge" },
      { key: "overview/together", label: "Together", controls: "pledge" },
      { key: "overview/quality", label: "Data quality", controls: "none" },
    ],
  },
  {
    key: "customer",
    label: "Customer",
    icon: "people-outline",
    subTabs: [
      { key: "customer/rehan", label: "Rehan", controls: "pledge" },
      { key: "customer/lenden", label: "Lenden", controls: "timeframe" },
    ],
  },
  {
    key: "rehan",
    label: "Rehan",
    icon: "lock-closed-outline",
    subTabs: [
      { key: "rehan/book", label: "Book", controls: "pledge" },
      { key: "rehan/items", label: "Items", controls: "pledge" },
    ],
  },
  {
    key: "lenden",
    label: "Lenden",
    icon: "receipt-outline",
    subTabs: [
      { key: "lenden/summary", label: "Summary", controls: "timeframe" },
      { key: "lenden/sales", label: "Sales", controls: "timeframe" },
      { key: "lenden/metal", label: "Metal", controls: "timeframe" },
      { key: "lenden/trends", label: "Trends", controls: "timeframe" },
    ],
  },
];

export const DEFAULT_VIEW: ViewKey = "overview/findings";

/** The sub-tab each section shows the first time it is opened. */
export const FIRST_VIEWS = Object.fromEntries(SECTIONS.map((s) => [s.key, s.subTabs[0].key])) as Record<
  SectionKey,
  ViewKey
>;

export const sectionOf = (view: ViewKey): SectionKey => view.slice(0, view.indexOf("/")) as SectionKey;

export const controlsFor = (view: ViewKey): Controls => {
  for (const s of SECTIONS) for (const t of s.subTabs) if (t.key === view) return t.controls;
  return "none";
};
```

- [ ] **Step 4: Run the test to see it pass**

Run: `npx jest src/utils/analytics/report/sections.test.ts` → PASS (6 tests).

- [ ] **Step 5: Give `Segmented` a full-width mode** — replace the component in
  `src/components/analytics/report/Segmented.tsx` (keep the `SegmentOption` export):

```tsx
/** Small chips that scroll sideways; with `fill`, equal segments that fill the row (sub-tabs, status). */
const Segmented = <T extends string>({
  options,
  value,
  onChange,
  fill = false,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (key: T) => void;
  fill?: boolean;
}) => {
  const chips = options.map((o) => {
    const active = value === o.key;
    return (
      <TouchableOpacity
        key={o.key}
        style={[styles.chip, fill && styles.fillChip, active && styles.active]}
        onPress={() => onChange(o.key)}
        hitSlop={fill ? undefined : 6}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Text style={[styles.text, active && styles.activeText]} numberOfLines={1}>
          {o.label}
        </Text>
      </TouchableOpacity>
    );
  });
  return fill ? (
    <View style={styles.fillRow}>{chips}</View>
  ) : (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips}
    </ScrollView>
  );
};
```

Add `View` to the react-native import, and add these styles:

```ts
  fillRow: { flexDirection: "row", gap: 6 },
  fillChip: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderRadius: 10 },
```

- [ ] **Step 6: Write `src/components/analytics/SectionBar.tsx`**

```tsx
import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Section, SectionKey } from "../../utils/analytics/report/sections";
import { Text, colors, fontSize } from "../../ui";

/** The four Analytics sections as equal-width tabs that always fit, icon above label (spec §5). */
const SectionBar: React.FC<{
  sections: Section[];
  value: SectionKey;
  onChange: (key: SectionKey) => void;
}> = ({ sections, value, onChange }) => (
  <View style={styles.bar}>
    {sections.map((s) => {
      const active = s.key === value;
      return (
        <TouchableOpacity
          key={s.key}
          style={[styles.tab, active && styles.tabActive]}
          onPress={() => onChange(s.key)}
          accessibilityRole="tab"
          accessibilityState={{ selected: active }}
        >
          <Ionicons
            name={s.icon as keyof typeof Ionicons.glyphMap}
            size={20}
            color={active ? colors.goldDeep : colors.textMuted}
          />
          <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>
            {s.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 2,
    borderBottomWidth: 3,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.goldDeep },
  label: { fontSize: fontSize.caption, fontWeight: "700", color: colors.textMuted },
  labelActive: { color: colors.goldDeep },
});

export default SectionBar;
```

- [ ] **Step 7: Restructure `src/screen/AnalyticsScreen.tsx`**

Keep the data loading, period state, `onStep`, the `report` memo and every builder call exactly as they are. Change
only these parts:

1. **Imports:**
   - Add `import { Screen, Text, colors, useLayout } from "../ui";` (merge with the `Text` import Task 2 added).
   - Add `import SectionBar from "../components/analytics/SectionBar";`.
   - Add `import { DEFAULT_VIEW, FIRST_VIEWS, SECTIONS, SectionKey, ViewKey, controlsFor, sectionOf } from "../utils/analytics/report/sections";`.
   - Remove `TouchableOpacity` from the react-native import.
2. **Delete** the `TABS`, `Tab`, `BILLING_TABS`, `BillingTab` and `FILTERED_TABS` declarations, and the `tab` and
   `billingTab` state.
3. **Add state** in their place:

```tsx
  const [section, setSection] = useState<SectionKey>(sectionOf(DEFAULT_VIEW));
  // Each section remembers its own sub-tab while the screen is open.
  const [views, setViews] = useState<Record<SectionKey, ViewKey>>(FIRST_VIEWS);
  const active = views[section];
  const controls = controlsFor(active);
  const current = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];
  const { gutter } = useLayout();
```

4. **Rename** the memo currently called `view` (filtered pledges / bills) to `filtered`, and update its uses
   (`view.pledges` → `filtered.pledges`, and so on).
5. **Replace the `content` memo's switch** with one over `active`. The component props are the same as today's code;
   only the case labels change:

```tsx
    switch (active) {
      case "overview/findings":
        return <OverviewTab pledges={filtered.pledges} bills={filtered.villageBills} names={report.names} customersOnFile={filters.village === "all" ? data.users.length : report.groups.customers.get(filters.village) ?? 0} />;
      case "overview/together":
        return (
          <TogetherTab
            pledges={filtered.pledges}
            bills={filtered.villageBills}
            sharePledges={filtered.byVillageRank}
            shareBills={report.bills}
            order={report.groups.order}
          />
        );
      case "overview/quality":
        return <DataQualityTab report={report.quality} />;
      case "customer/rehan":
        return (
          <CustomersVillagesTab
            pledges={filtered.pledges}
            rankingPledges={filtered.byVillageRank}
            allPledges={report.pledges}
            data={data}
            groups={report.groups}
            village={filters.village}
            onCustomerPress={openCustomer}
          />
        );
      case "customer/lenden":
        return (
          <>
            <KeyCustomersCard view={buildImportanceView(data, period)} onCustomerPress={openCustomer} />
            <CustomersSection view={buildCustomersView(data, period, now)} onCustomerPress={openCustomer} />
            <VillagesSection villages={buildVillageView(data, period, previous)} />
          </>
        );
      case "rehan/book":
        return <RehanBookTab pledges={filtered.pledges} now={report.now} />;
      case "rehan/items":
        return <ItemsTab pledges={filtered.pledges} rankingPledges={filtered.byItemRank} selectedItem={filters.item} now={report.now} />;
      case "lenden/summary":
        return <BillingSummaryTab bills={filtered.villageBills.filter((b) => inPeriod(b.date, period))} />;
      case "lenden/sales":
        return (
          <>
            <OverviewSection
              view={buildOverview(data, period, previous, lastYear, now)}
              previousLabel={previous?.label ?? null}
              lastYearLabel={lastYear?.label ?? null}
            />
            <SalesSection view={buildSalesView(data, period)} onCustomerPress={openCustomer} />
            <BaakiAgingCard aging={baakiAging(data, now)} />
          </>
        );
      case "lenden/metal":
        return (
          <>
            <MetalSection view={buildMetalView(data, period)} />
            <CategoriesCard categories={buildCategoryView(data, period, previous)} />
          </>
        );
      case "lenden/trends":
        return <TrendsSection rows={buildTrends(data, trendGrain, now)} />;
    }
```

   Update the memo's dependency list: replace `tab, billingTab` with `active`, and `view` with `filtered`.

6. **Replace the returned JSX** with:

```tsx
  return (
    <Screen>
      <SectionBar sections={SECTIONS} value={section} onChange={setSection} />
      {failed ? (
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <Text style={styles.error}>Could not load analytics. Pull down to try again.</Text>
        </ScrollView>
      ) : !data || !report || !filtered ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.goldDeep} />
        </View>
      ) : (
        <ScrollView
          stickyHeaderIndices={[0]}
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Sticky: sub-tabs and the filter / time-frame row stay reachable while the cards scroll. */}
          <View style={[styles.controls, { paddingHorizontal: gutter }]}>
            <Segmented
              fill
              options={current.subTabs.map((t) => ({ key: t.key, label: t.label }))}
              value={active}
              onChange={(v) => setViews((prev) => ({ ...prev, [section]: v }))}
            />
            {controls === "pledge" && (
              <PledgeFilterBar
                filters={filters}
                options={report.options}
                showing={filtered.pledges.length}
                total={report.pledges.length}
                onChange={setFilters}
              />
            )}
            {controls === "timeframe" && (
              <PeriodPicker
                grain={grain}
                period={period}
                canGoForward={canGoForward}
                customFrom={customFrom}
                customTo={customTo}
                onGrainChange={(g) => {
                  setGrain(g);
                  setAnchor(new Date());
                }}
                onStep={onStep}
                onCustomChange={(from, to) => {
                  // a backwards pick is stored the right way round
                  setCustomFrom(to < from ? to : from);
                  setCustomTo(to < from ? from : to);
                }}
              />
            )}
            {active === "lenden/summary" && filters.village !== "all" && (
              <Text style={styles.note}>Village: {filters.village} (Summary only)</Text>
            )}
          </View>
          <View style={[styles.body, { paddingHorizontal: gutter }]}>{content}</View>
        </ScrollView>
      )}
    </Screen>
  );
```

7. **Replace the styles** with:

```ts
const styles = StyleSheet.create({
  controls: { backgroundColor: colors.bg, paddingTop: 10, paddingBottom: 8, gap: 8 },
  body: { paddingTop: 4 },
  scroll: { paddingBottom: 24 },
  note: { fontSize: 12, color: "#777" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: colors.danger, fontSize: 14, textAlign: "center" },
});
```

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npx jest` → all pass.
Run: `grep -n "TABS\|billingTab\|FILTERED_TABS" src/screen/AnalyticsScreen.tsx` → no output.

- [ ] **Step 9: Commit**

```bash
git add src/utils/analytics/report/sections.ts src/utils/analytics/report/sections.test.ts src/components/analytics/SectionBar.tsx src/components/analytics/report/Segmented.tsx src/screen/AnalyticsScreen.tsx
git commit -m "Regroup Analytics into Overview, Customer, Rehan and Lenden with fitted tabs and sticky controls"
```

---

### Task 5: Analytics controls and cards fit narrow phones

**Files:**
- Modify: `src/components/analytics/report/PledgeFilterBar.tsx`, `src/components/analytics/PeriodPicker.tsx`,
  `src/components/analytics/report/HBars.tsx`, `src/components/analytics/StatTile.tsx`,
  `src/components/analytics/KpiTile.tsx`, `src/components/analytics/report/OverviewTab.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `Text`, `useLayout`, `barLabelWidth`, `colors`, `fontSize` from `src/ui`, and
  `Segmented` with `fill` (Task 4)
- Produces: the same component props as before, so callers don't change. `HBars`' `labelWidth` now means the largest
  label width; the default is 120.

- [ ] **Step 1: `PledgeFilterBar` opens a bottom sheet** — replace the file body (keep the props unchanged):

```tsx
import React, { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ALL_PLEDGES, PledgeFilters } from "../../../utils/analytics/report/pledges";
import { BottomSheet, Text, colors } from "../../../ui";
import Segmented from "./Segmented";

const ChipGroup: React.FC<{
  label: string;
  allLabel: string;
  values: string[];
  value: string;
  onChange: (v: string) => void;
}> = ({ label, allLabel, values, value, onChange }) => (
  <View style={styles.group}>
    <Text style={styles.groupLabel}>{label}</Text>
    <View style={styles.chips}>
      {["all", ...values].map((v) => (
        <TouchableOpacity key={v} style={[styles.chip, value === v && styles.active]} onPress={() => onChange(v)}>
          <Text style={[styles.chipText, value === v && styles.activeText]} numberOfLines={1}>
            {v === "all" ? allLabel : v}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

/** The report's pledge filters (spec §12.1): one summary line; the choices open in a bottom sheet (UI revamp §5). */
const PledgeFilterBar: React.FC<{
  filters: PledgeFilters;
  options: { villages: string[]; items: string[]; years: string[] };
  showing: number;
  total: number;
  onChange: (f: PledgeFilters) => void;
}> = ({ filters, options, showing, total, onChange }) => {
  const [open, setOpen] = useState(false);
  const active =
    filters.village !== "all" || filters.item !== "all" || filters.year !== "all" || filters.status !== "all";
  const summary = [
    filters.village === "all" ? "All villages" : filters.village,
    filters.item === "all" ? "All items" : filters.item,
    filters.year === "all" ? "All years" : filters.year,
    filters.status === "all" ? "All" : filters.status === "open" ? "Open" : "Redeemed",
  ].join(" · ");
  const showingText = `Showing ${showing} of ${total} pledges`;
  return (
    <>
      <TouchableOpacity style={styles.bar} onPress={() => setOpen(true)} accessibilityLabel="Filter pledges">
        <View style={styles.summaryText}>
          <Text style={styles.summary} numberOfLines={1}>
            {summary}
          </Text>
          <Text style={styles.showing} numberOfLines={1}>
            {showingText}
          </Text>
        </View>
        <View style={[styles.filterButton, active && styles.filterButtonActive]}>
          <Ionicons name="options-outline" size={16} color={active ? colors.white : colors.goldDeep} />
          <Text style={[styles.filterText, active && styles.activeText]}>Filter</Text>
        </View>
      </TouchableOpacity>

      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Filter pledges"
        subtitle={showingText}
        footer={
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.footerButton, styles.resetButton]}
              onPress={() => onChange(ALL_PLEDGES)}
              disabled={!active}
            >
              <Text style={[styles.resetText, !active && styles.disabledText]}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.footerButton, styles.doneButton]} onPress={() => setOpen(false)}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
        }
      >
        <ChipGroup label="Village" allLabel="All villages" values={options.villages} value={filters.village} onChange={(village) => onChange({ ...filters, village })} />
        <ChipGroup label="Item" allLabel="All items" values={options.items} value={filters.item} onChange={(item) => onChange({ ...filters, item })} />
        <ChipGroup label="Opened in" allLabel="All years" values={options.years} value={filters.year} onChange={(year) => onChange({ ...filters, year })} />
        <View style={styles.group}>
          <Text style={styles.groupLabel}>Status</Text>
          <Segmented
            fill
            options={[
              { key: "all", label: "All" },
              { key: "open", label: "Open" },
              { key: "redeemed", label: "Redeemed" },
            ]}
            value={filters.status}
            onChange={(status) => onChange({ ...filters, status })}
          />
        </View>
      </BottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 52,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  summaryText: { flex: 1, minWidth: 0 },
  summary: { fontSize: 13, fontWeight: "700", color: colors.text },
  showing: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.goldLine,
  },
  filterButtonActive: { backgroundColor: colors.goldDeep, borderColor: colors.goldDeep },
  filterText: { fontSize: 13, fontWeight: "800", color: colors.goldDeep },
  group: { marginBottom: 16 },
  groupLabel: { fontSize: 10, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.6, textTransform: "uppercase", marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    maxWidth: "100%",
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.goldLine,
    backgroundColor: colors.surface,
  },
  active: { backgroundColor: colors.goldDeep, borderColor: colors.goldDeep },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.goldDeep },
  activeText: { color: colors.white },
  footerRow: { flexDirection: "row", gap: 12 },
  footerButton: { flex: 1, minHeight: 48, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  resetButton: { borderWidth: 1.5, borderColor: "#F2C4C4" },
  resetText: { fontSize: 15, fontWeight: "800", color: colors.danger },
  disabledText: { color: "#CCC" },
  doneButton: { backgroundColor: colors.goldDeep },
  doneText: { fontSize: 15, fontWeight: "800", color: colors.white },
});

export default PledgeFilterBar;
```

- [ ] **Step 2: `PeriodPicker` becomes one compact row**

Keep the props, the `CustomDatePicker` block and the custom From / To row. Replace `GRAINS`, the grain chips row, the
step row and the styles:

```tsx
const GRAINS: { key: Grain; label: string; short: string }[] = [
  { key: "week", label: "Week", short: "Week" },
  { key: "month", label: "Month", short: "Month" },
  { key: "quarter", label: "Quarter", short: "Quarter" },
  { key: "fy", label: "Financial year (Apr–Mar)", short: "FY" },
  { key: "custom", label: "Custom dates", short: "Custom" },
  { key: "all", label: "All time", short: "All" },
];
```

Inside the component, add `const [choosing, setChoosing] = useState(false);` and
`const grainShort = GRAINS.find((g) => g.key === grain)?.short ?? "Month";`. Return:

```tsx
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity style={styles.grainChip} onPress={() => setChoosing(true)} accessibilityLabel="Change time frame">
          <Text style={styles.grainText} numberOfLines={1}>{grainShort}</Text>
          <Ionicons name="chevron-down" size={14} color={colors.goldDeep} />
        </TouchableOpacity>
        {grain !== "all" && (
          <TouchableOpacity style={styles.arrow} onPress={() => onStep(-1)} accessibilityLabel="Previous period">
            <Ionicons name="chevron-back" size={20} color={colors.goldDeep} />
          </TouchableOpacity>
        )}
        <Text style={styles.periodLabel} numberOfLines={1} adjustsFontSizeToFit>
          {period.label}
        </Text>
        {grain !== "all" && (
          <TouchableOpacity style={styles.arrow} onPress={() => onStep(1)} disabled={!canGoForward} accessibilityLabel="Next period">
            <Ionicons name="chevron-forward" size={20} color={canGoForward ? colors.goldDeep : "#DDD"} />
          </TouchableOpacity>
        )}
      </View>

      {/* the existing `grain === "custom"` From / To row goes here, unchanged */}

      <BottomSheet visible={choosing} onClose={() => setChoosing(false)} title="Time frame">
        {GRAINS.map((g) => (
          <TouchableOpacity
            key={g.key}
            style={[styles.option, grain === g.key && styles.optionActive]}
            onPress={() => {
              onGrainChange(g.key);
              setChoosing(false);
            }}
          >
            <Text style={[styles.optionText, grain === g.key && styles.optionTextActive]}>{g.label}</Text>
            {grain === g.key && <Ionicons name="checkmark" size={18} color={colors.goldDeep} />}
          </TouchableOpacity>
        ))}
      </BottomSheet>

      {/* the existing <CustomDatePicker … /> goes here, unchanged */}
    </View>
```

Imports: `import { BottomSheet, Text, colors } from "../../ui";` (merge with the existing `Text` import). Styles
(keep `customRow`, `dateButton`, `dateLabel`, `dateValue` as they are; drop `chips`, `chip`, `chipActive`, `chipText`,
`chipTextActive` and `stepRow`):

```ts
  wrap: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 2 },
  grainChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 40,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: colors.goldSoft,
  },
  grainText: { fontSize: 13, fontWeight: "800", color: colors.goldDeep },
  arrow: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  periodLabel: { flex: 1, textAlign: "center", fontSize: 15, fontWeight: "800", color: colors.text },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  optionActive: { backgroundColor: colors.goldSoft },
  optionText: { fontSize: 15, color: colors.text },
  optionTextActive: { fontWeight: "800", color: colors.goldDeep },
```

- [ ] **Step 3: `HBars` sizes its label column from its own width.** In `src/components/analytics/report/HBars.tsx`:
  - Import `useState`, and `barLabelWidth` from `"../../../ui"`.
  - Remove the default `labelWidth = 104` and type the prop as `labelWidth?: number` (now the maximum).
  - In the body, add `const [width, setWidth] = useState(0);` and
    `const label = barLabelWidth(width, labelWidth ?? 120);`.
  - Give the outer `<View>` `onLayout={(e) => setWidth(e.nativeEvent.layout.width)}`.
  - Use `{ width: label }` where `{ width: labelWidth }` was.

  The early `return <Text style={styles.empty}>…` stays as it is.

- [ ] **Step 4: Tiles follow the column count.**
  - `StatTile` (`src/components/analytics/StatTile.tsx`): turn the arrow function into a function body. Add
    `const { tileColumns } = useLayout();` (import `useLayout` from `"../../ui"`), and set the tile style to
    `[styles.tile, { width: tileColumns === 2 ? "48%" : "100%", backgroundColor: TONES[tone].bg }]`. Delete
    `width: "48%"` from `styles.tile`.
  - `KpiTile` (`src/components/analytics/KpiTile.tsx`): same change, with `[styles.tile, { width: … }]`, and delete
    `width: "48%"` from `styles.tile`.

- [ ] **Step 5: Overview hero number fits on one line.** In `src/components/analytics/report/OverviewTab.tsx`:
  - Give the `<Text style={styles.big}>` element `numberOfLines={1} adjustsFontSizeToFit`.
  - Change `big.fontSize` from 40 to 32.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npx jest` → all pass.
Run: `grep -n "width: \"48%\"" src/components/analytics/StatTile.tsx src/components/analytics/KpiTile.tsx` → only the
inline expression, no style entry.

- [ ] **Step 7: Commit**

```bash
git add src/components/analytics
git commit -m "Move Analytics filters and time frame into bottom sheets and fit tiles, bars and the hero number to narrow phones"
```

---

### Task 6: Input pop-ups become bottom sheets

**Files:**
- Modify (all CRLF): `src/components/AddJamaModal.tsx`, `src/components/AddLendenItemModal.tsx`,
  `src/components/AddRehanTransactionModal.tsx`, `src/components/CustomDatePicker.tsx`
- Modify (LF): `src/components/AddOldJewelleryItemModal.tsx`
- Modify: `src/ui/sourceAudit.test.ts` (append one rule)

**Interfaces:**
- Consumes: `BottomSheet` (Task 1). Props: `visible`, `onClose`, `title?`, `subtitle?`, `footer?`, `scroll?`,
  `children`.
- Produces: the same component props as today, so every caller stays unchanged.

The same conversion applies to each file. Keep all state, handlers, validation, input props and the nested
`<CustomDatePicker>`:

1. Replace the outer `<Modal …>` and `<KeyboardAvoidingView …>` and the frame views (`overlay` / `backdrop`,
   `content` / `sheet`, and the `header` row with its title and close button) with a single `<BottomSheet>`:
   - `visible` comes from the same prop.
   - `onClose` is the same close handler the header's close button used.
   - `title` (and `subtitle`) carry the same text.
2. The body's children become `BottomSheet` children. Drop the wrapping `<ScrollView style={styles.body}>` /
   `<View style={styles.body}>`, because the sheet scrolls and pads its body.
3. The Save / Cancel / Add buttons move into `footer={…}`. Remove any `paddingBottom: Math.max(insets.bottom, 20)` and
   the `useSafeAreaInsets` call, since the sheet pads its footer.
4. A nested `<CustomDatePicker … />` stays inside, as the last child of `BottomSheet`.
5. Delete the now-unused styles: `overlay`, `backdrop`, `content`, `sheet`, `header`, `title`, `subtitle`,
   `closeButton`, `body`. In the kept `footer` style, drop its `padding*`, `borderTop*` and `backgroundColor`, and keep
   `flexDirection` and `gap`.
6. Remove the unused imports: `Modal`, `KeyboardAvoidingView`, `Platform` (if nothing else uses it) and
   `useSafeAreaInsets`. Add `import { BottomSheet } from "../ui";` and merge it with the `Text` / `TextInput` import
   from Task 2.

Worked example — `AddJamaModal`'s return becomes:

```tsx
  return (
    <BottomSheet
      visible={visible}
      onClose={handleClose}
      title={editMode ? "Edit Jama Payment" : "Add Jama Payment"}
      footer={
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, !amount && styles.addButtonDisabled]}
            onPress={handleAdd}
            disabled={!amount}
          >
            <Ionicons name="checkmark" size={20} color="#fff" />
            <Text style={styles.addButtonText}>{editMode ? "Save" : "Add"}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      {/* the two existing `inputGroup` blocks (Amount, Date), unchanged */}
      <CustomDatePicker
        visible={showDatePicker}
        selectedDate={selectedDate}
        onClose={() => setShowDatePicker(false)}
        onDateSelect={(date) => {
          setSelectedDate(date);
          setShowDatePicker(false);
        }}
        minimumDate={minDate}
        maximumDate={new Date()}
      />
    </BottomSheet>
  );
```

Per file:

| File | `title` / `subtitle` | `footer` | Notes |
|---|---|---|---|
| AddJamaModal | above | Cancel + Save/Add row | above |
| AddRehanTransactionModal | the header `<Text style={styles.title}>` text, unchanged | the bottom button row (the one with `paddingBottom: Math.max(insets.bottom, 20)`) | `CustomDatePicker` stays as the last child |
| AddLendenItemModal | `editMode ? "Edit Item" : "Add Item"` | the `saveButton` TouchableOpacity | delete `content.maxHeight: "88%"`, because the sheet caps itself at 90 % |
| AddOldJewelleryItemModal | `editMode ? "Edit Old Jewellery" : "Old Jewellery"` / `"Credit against this Len-Den sale"` | the `saveButton` TouchableOpacity | delete `sheet.maxHeight: "82%"` |
| CustomDatePicker | `"Select Date"`; pass `scroll={false}` | the `quickActions` row (Today / Yesterday) | children: the month/year row, then the year picker or the day names and grid. Add `nestedScrollEnabled` to the year picker's ScrollView. Delete `container.paddingBottom: 30` with `container` |

- [ ] **Step 1: Append the failing audit rule** to the `describe` block in `src/ui/sourceAudit.test.ts`:

```ts
  it("builds every input pop-up on BottomSheet, never a bare Modal (spec §6)", () => {
    const sheets = [
      "src/components/AddJamaModal.tsx",
      "src/components/AddLendenItemModal.tsx",
      "src/components/AddOldJewelleryItemModal.tsx",
      "src/components/AddRehanTransactionModal.tsx",
      "src/components/CustomDatePicker.tsx",
    ];
    const state = sheets.map((f) => ({ f, sheet: read(f).includes("<BottomSheet"), modal: /<Modal\b/.test(read(f)) }));
    expect(state).toEqual(sheets.map((f) => ({ f, sheet: true, modal: false })));
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/sourceAudit.test.ts`
Expected: FAIL, with every file showing `sheet: false, modal: true`.

- [ ] **Step 3: Convert the five files** as described above.

- [ ] **Step 4: Verify**

Run: `npx jest src/ui/sourceAudit.test.ts` → PASS. Run: `npx tsc --noEmit` → clean. Run: `npx jest` → all pass.
Run: `grep -n "insets\|KeyboardAvoidingView\|<Modal" src/components/Add*.tsx src/components/CustomDatePicker.tsx`
→ no output.

- [ ] **Step 5: Commit**

```bash
git add src/components/AddJamaModal.tsx src/components/AddLendenItemModal.tsx src/components/AddOldJewelleryItemModal.tsx src/components/AddRehanTransactionModal.tsx src/components/CustomDatePicker.tsx src/ui/sourceAudit.test.ts
git commit -m "Rebuild the jama, item, old jewellery, rehan and date pop-ups as inset-aware bottom sheets"
```

---

### Task 7: Form screens keep their buttons above the keyboard and the navigation bar

**Files:**
- Modify: `src/screen/NewCustomerScreen.tsx`, `src/screen/AddTransactionScreen.tsx`, `src/screen/UpdateBhavScreen.tsx`,
  `src/screen/AddEditCategoryScreen.tsx`, `src/screen/AddEditProductScreen.tsx`. All are CRLF except
  `AddTransactionScreen`.
- Modify: `src/ui/sourceAudit.test.ts` (append one rule)

**Interfaces:**
- Consumes: `Screen`, `KeyboardArea`, `FooterBar`, `BottomSheet`, `fontSize` (Task 1)
- Produces: nothing new. Screen props and routes are unchanged.

The target shape for a form screen (rules 1, 2, 9, 10):

```tsx
    <Screen style={styles.container}>
      <KeyboardArea>
        <ScrollView /* existing props, keep keyboardShouldPersistTaps="handled" */>
          {/* fields */}
        </ScrollView>
        <FooterBar>{/* the primary action button */}</FooterBar>
      </KeyboardArea>
      {/* date pickers and sheets stay here, as siblings */}
    </Screen>
```

- [ ] **Step 1: Append the failing audit rule** to `src/ui/sourceAudit.test.ts`:

```ts
  it("keeps form inputs above the keyboard with KeyboardArea (spec §6 rule 9)", () => {
    const forms = [
      "src/screen/NewCustomerScreen.tsx",
      "src/screen/AddTransactionScreen.tsx",
      "src/screen/UpdateBhavScreen.tsx",
      "src/screen/AddEditCategoryScreen.tsx",
      "src/screen/AddEditProductScreen.tsx",
    ];
    expect(forms.filter((f) => !read(f).includes("<KeyboardArea"))).toEqual([]);
  });
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest src/ui/sourceAudit.test.ts` → FAIL, listing all five forms.

- [ ] **Step 3: NewCustomerScreen**
  - Change `<SafeAreaView style={styles.container} edges={["top", "bottom"]}>` to `<Screen style={styles.container}>`.
    The top edge doubled the gap under the header.
  - Wrap the `ScrollView` in `<KeyboardArea>`.
  - Move the `{/* Save Button */}` TouchableOpacity out of the ScrollView into a `<FooterBar>` placed right after the
    ScrollView, inside `KeyboardArea`. Drop any `marginTop` / `marginBottom` from `styles.saveButton`.
  - `<CustomDatePicker>` stays after `KeyboardArea`, inside `Screen`.
  - Styles: `title.fontSize` 28 → `fontSize.heading` (20). `contentContainer.paddingBottom` 40 → 24.
  - Imports: remove `SafeAreaView`. Add `Screen`, `KeyboardArea`, `FooterBar` and `fontSize` from `"../ui"`.

- [ ] **Step 4: AddTransactionScreen**
  - Wrap the root `<ScrollView style={styles.container} …>` as
    `<Screen style={styles.container}><KeyboardArea>…</KeyboardArea></Screen>`.
  - The Save Transaction button stays at the end of the form, inside the ScrollView (the spec gives this screen no
    footer).
  - Remove the unused `KeyboardAvoidingView` import.
  - Styles: `title.fontSize` 28 → `fontSize.heading` (20). It is the "New Transaction" heading, the 28 sp text the spec
    lists. `contentContainer.paddingBottom` 40 → 24.

- [ ] **Step 5: UpdateBhavScreen**
  - All three `<SafeAreaView style={styles.container} edges={["bottom"]}>` (loading, error, main) become
    `<Screen style={styles.container}>`.
  - Replace `<KeyboardAvoidingView behavior={…} …>` with `<KeyboardArea>`.
  - Replace `<View style={styles.footer}>` with `<FooterBar>`, and delete the absolute `footer` style.
  - Styles: `scrollContent.paddingBottom` → 24 (it only made room for the absolute footer). `headerTitle.fontSize`
    28 → 20. `cardLabel.fontSize` 20 → 17. `input.fontSize` 22 → 20. Give the rate `input` Text/TextInput
    `numberOfLines={1}`.
  - Imports: remove `SafeAreaView`, `KeyboardAvoidingView` and `Platform` (if unused).

- [ ] **Step 6: AddEditCategoryScreen**
  - Both `SafeAreaView`s (loading and main) become `<Screen style={styles.container}>`.
  - `KeyboardAvoidingView` becomes `KeyboardArea`.
  - `<View style={styles.buttonContainer}>` becomes `<FooterBar>`; delete `buttonContainer`.
  - `scrollContent.paddingBottom` 100 → 24.
  - The `editBadge` (absolute inside the image box) stays.

- [ ] **Step 7: AddEditProductScreen**
  - Apply the Step 6 changes (Screen ×2, `KeyboardArea`, `FooterBar` in place of `buttonContainer`,
    `scrollContent.paddingBottom` → 24).
  - **Category modal** → `<BottomSheet visible={showCategoryModal} onClose={() => setShowCategoryModal(false)} title="Select Category">`.
    Its children are the `categories.map(…)` rows; drop the inner `<ScrollView style={styles.modalList}>`.
  - **Variant modal** →
    `<BottomSheet visible={showVariantModal} onClose={() => setShowVariantModal(false)} title={editingVariant ? "Edit Variant" : "Add Variant"} footer={<TouchableOpacity style={styles.modalSaveButton} onPress={handleSaveVariant}>…</TouchableOpacity>}>`.
    The `modalBody` contents (minus the save button) are the children.
  - Delete `modalOverlay`, `modalContent` (and its `maxHeight: "80%"`), `modalHeader`, `modalTitle`, `modalList` and
    `modalBody` if unused.
  - Remove the `Modal`, `SafeAreaView`, `KeyboardAvoidingView` and `Platform` imports if unused.

- [ ] **Step 8: Verify**

Run: `npx jest src/ui/sourceAudit.test.ts` → PASS. Run: `npx tsc --noEmit` → clean. Run: `npx jest` → all pass.
Run: `grep -n "position: \"absolute\"" -A2 src/screen/UpdateBhavScreen.tsx` → no footer match.

- [ ] **Step 9: Commit**

```bash
git add src/screen/NewCustomerScreen.tsx src/screen/AddTransactionScreen.tsx src/screen/UpdateBhavScreen.tsx src/screen/AddEditCategoryScreen.tsx src/screen/AddEditProductScreen.tsx src/ui/sourceAudit.test.ts
git commit -m "Keep form fields and save buttons above the keyboard and the navigation bar"
```

---

### Task 8: Transaction detail and bill preview

**Files:**
- Modify (CRLF): `src/screen/TransactionDetailScreen.tsx`, `src/screen/BillPreviewScreen.tsx`

**Interfaces:**
- Consumes: `Screen`, `KeyboardArea`, `FooterBar`, `useLayout` (Task 1). `AddJamaModal` / `AddRehanTransactionModal`
  are already sheets (Task 6).
- Produces: nothing new.

**Rule 4 pattern** (label + value rows; used here and in Tasks 9–10):

```tsx
<View style={styles.row}>
  <Text style={styles.label} numberOfLines={2}>{label}</Text>
  <Text style={styles.value} numberOfLines={1}>{value}</Text>
</View>
// styles
row:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, /* existing */ },
label: { flexShrink: 1, /* existing */ },
value: { flexShrink: 0, textAlign: "right", /* existing */ },
```

A name next to an icon or avatar: `numberOfLines={1}` and `flexShrink: 1` (or `flex: 1`). A hero amount:
`numberOfLines={1} adjustsFontSizeToFit`.

- [ ] **Step 1: TransactionDetailScreen — width and insets**
  - Delete `Dimensions` from the import and delete `const { width: SCREEN_WIDTH } = Dimensions.get("window");`.
  - In the component, add `const { mediaTile } = useLayout();` and `const insets = useSafeAreaInsets();` (import from
    `react-native-safe-area-context`).
  - In `styles.mediaItem`, delete `width` and `height`. Where `styles.mediaItem` is applied, use
    `[styles.mediaItem, { width: mediaTile, height: mediaTile }]`.
  - Image viewer `<Modal>`: add `statusBarTranslucent navigationBarTranslucent`. Then:
    - Close button style: `[styles.modalCloseButton, { top: insets.top + 8 }]`, and delete `top: 50` from the style.
    - Footer: `[styles.footerContainer, { bottom: insets.bottom + 16 }]`, and delete `bottom: 40` from the style.

- [ ] **Step 2: TransactionDetailScreen — root and footer**
  - The three root returns (two loading/error states around lines 575/584 and the main one) change from
    `<View style={styles.container}>` to `<Screen style={styles.container}>`.
  - In the main return, wrap the `ScrollView` and the save footer in `<KeyboardArea>`: edit mode has inputs.
  - Change `{isEditMode && hasChanges && (<View style={styles.saveContainer}>…</View>)}` to
    `{isEditMode && hasChanges && (<FooterBar>…same button…</FooterBar>)}`, and delete `styles.saveContainer`.
  - `scrollContent.paddingBottom` 100 → 24.
  - The image-viewer `Modal` stays outside `KeyboardArea`, inside `Screen`.
  - Remove the unused `KeyboardAvoidingView` import.

- [ ] **Step 3: TransactionDetailScreen — rows**
  - Apply the rule-4 pattern to every label/value row in the detail cards. These are the styles with
    `flexDirection: "row"` and `justifyContent: "space-between"` whose children are two `Text`s.
  - `amountValue` (24 sp): add `numberOfLines={1} adjustsFontSizeToFit`.
  - Customer name and address texts in the header card: `numberOfLines={1}` / `numberOfLines={2}`.
  - Button labels like `बिल बनाएं / Generate Bill`: `numberOfLines={1}`, and the label style gets `flexShrink: 1`.

- [ ] **Step 4: BillPreviewScreen**
  - The loading return and the main return: `<View style={styles.container}>` → `<Screen style={styles.container}>`.
  - The bottom `actions` row stays an in-flow `View`; `Screen` now keeps it above the navigation bar.
  - In the top controls (`controlRow`, `nestedControlRow`), labels get `flexShrink: 1` and `numberOfLines={1}`, so the
    bill-number input keeps its width on 320 dp.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` → clean. Run: `npx jest` → all pass.
Run: `grep -n "Dimensions\|SCREEN_WIDTH\|top: 50\|bottom: 40\|saveContainer" src/screen/TransactionDetailScreen.tsx`
→ no output.

- [ ] **Step 6: Commit**

```bash
git add src/screen/TransactionDetailScreen.tsx src/screen/BillPreviewScreen.tsx
git commit -m "Fit transaction detail and bill preview to any width and keep their actions clear of the system bars"
```

---

### Task 9: Customer and catalogue lists, and the final audit rules

**Files:**
- Modify (CRLF): `src/screen/ExistingCustomersScreen.tsx`, `src/screen/UserTransactionsScreen.tsx`,
  `src/screen/CategoryListScreen.tsx`, `src/screen/ProductListScreen.tsx`
- Modify: `src/ui/sourceAudit.test.ts` (append four rules)

**Interfaces:**
- Consumes: `Screen`, `BottomSheet` (Task 1), and the rule-4 pattern (Task 8)
- Produces: nothing new.

- [ ] **Step 1: Append the failing audit rules** to `src/ui/sourceAudit.test.ts`:

```ts
  const screens = tsxUnder("src/screen");

  it("roots every screen in Screen (spec §6 rule 1)", () => {
    expect(screens.filter((f) => !read(f).includes("<Screen"))).toEqual([]);
  });

  it("never uses SafeAreaView or KeyboardAvoidingView directly outside the UI layer", () => {
    expect(appFiles.filter((f) => /\bSafeAreaView\b/.test(read(f)))).toEqual([]);
    expect(appFiles.filter((f) => rnImports(read(f)).includes("KeyboardAvoidingView"))).toEqual([]);
  });

  it("reads the window size through useLayout, never Dimensions (spec §6 rule 3)", () => {
    expect(appFiles.filter((f) => rnImports(read(f)).includes("Dimensions"))).toEqual([]);
  });

  it("opens pop-ups only through BottomSheet; the photo viewer is the one full-screen Modal", () => {
    expect(appFiles.filter((f) => /<Modal\b/.test(read(f)))).toEqual(["src/screen/TransactionDetailScreen.tsx"]);
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest src/ui/sourceAudit.test.ts`
Expected: FAIL.
- `<Screen` is missing in the four list screens.
- `SafeAreaView` is still in UserTransactions, CategoryList and ProductList. `App.tsx` uses `SafeAreaProvider`, not
  `SafeAreaView`, so it doesn't match `\bSafeAreaView\b`.
- `<Modal` is still in ExistingCustomers and ProductList.

- [ ] **Step 3: ExistingCustomersScreen**
  - The root `<View style={styles.container}>` → `<Screen style={styles.container}>`.
  - **Edit Customer modal** →
    `<BottomSheet visible={isEditModalVisible} onClose={closeEditModal} title="Edit Customer" footer={<View style={styles.modalFooter}>…Cancel + Save, unchanged…</View>}>`.
    The `modalBody` contents are the children.
  - In `styles.modalFooter`, keep `flexDirection` / `gap` and drop `padding*` / `borderTop*`. Delete `modalOverlay`,
    `modalContent` (`maxHeight: "80%"`), `modalHeader`, `modalTitle` and `modalBody`. Remove the `Modal` import.
  - Customer list rows (rule 4): the name gets `numberOfLines={1}` with `flexShrink: 1`; address and village
    `numberOfLines={1}`; amounts `numberOfLines={1}`. Any summary or stat chip row at the top that is a row of `Text`s
    gets `flexWrap: "wrap"`.

- [ ] **Step 4: UserTransactionsScreen**
  - `<SafeAreaView style={styles.container} edges={["bottom"]}>` → `<Screen style={styles.container}>`.
  - `fab.bottom` 100 → 16. `listContent.paddingBottom` 100 → 88 (the FAB is 60 tall, plus 16 + 12 clearance).
  - `summaryCount` (24 sp) and `highlightedAmount` (20 sp) texts: `numberOfLines={1} adjustsFontSizeToFit`.
  - Transaction rows (rule 4): the title / product name gets `numberOfLines={1}`, amounts `numberOfLines={1}`.
  - The filter chip `ScrollView` stays horizontal (intended).

- [ ] **Step 5: CategoryListScreen and ProductListScreen**
  - Both `SafeAreaView`s (loading and main) in each file → `<Screen style={styles.container}>`. The FABs stay at
    `bottom: 24`, which is now measured from above the navigation bar.
  - Row names `numberOfLines={1}` with `flexShrink: 1`; descriptions `numberOfLines={2}`.
  - **ProductList filter modal** → `<BottomSheet visible={showFilterModal} onClose={() => setShowFilterModal(false)} title="Filter by Category">`.
    Its children are the option rows; drop the inner `<ScrollView style={styles.modalList}>`. Delete `modalOverlay`,
    `modalContent` (`maxHeight: "60%"`), `modalHeader`, `modalTitle` and `modalList`, and remove the `Modal` import.

- [ ] **Step 6: Verify**

Run: `npx jest src/ui/sourceAudit.test.ts` → PASS (all rules). Run: `npx tsc --noEmit` → clean. Run: `npx jest` →
all pass.

- [ ] **Step 7: Commit**

```bash
git add src/screen/ExistingCustomersScreen.tsx src/screen/UserTransactionsScreen.tsx src/screen/CategoryListScreen.tsx src/screen/ProductListScreen.tsx src/ui/sourceAudit.test.ts
git commit -m "Fit customer and catalogue lists to narrow phones and pin the layout rules in the source audit"
```

---

### Task 10: Ledger tables and the owner's device checklist

**Files:**
- Modify (CRLF): `src/components/BillTable.tsx`, `src/components/LendenItemsTable.tsx`,
  `src/components/RehanTransactionTable.tsx`
- Modify (LF): `src/components/OldJewelleryItemsTable.tsx`
- Create: `agent/2026-10-03-ui-revamp-device-checklist.md`

**Interfaces:**
- Consumes: the rule-4 pattern (Task 8)
- Produces: nothing new.

- [ ] **Step 1: BillTable**
  - Every `styles.row` (label + value) follows rule 4: `row` gains `gap: 12`, `label` gains `flexShrink: 1` with
    `numberOfLines={2}` on the label `Text`s, and `value` gains `flexShrink: 0, textAlign: "right"` with
    `numberOfLines={1}` on the value `Text`s.
  - Jama entry rows (date + amount) get the same treatment.
  - `headerText` gets `numberOfLines={1}`.

- [ ] **Step 2: LendenItemsTable and OldJewelleryItemsTable**
  - The item description `Text` (inside `itemBody` / `itemContent`, which are already `flex: 1`) gets
    `numberOfLines={2}`.
  - Weight / rate / amount `Text`s get `numberOfLines={1}`.
  - Any meta row of several `Text`s side by side gets `flexWrap: "wrap"` and `columnGap: 8`.

- [ ] **Step 3: RehanTransactionTable**
  - The header and cell `Text`s in the flex columns (2 / 2 / 3 / 1) get `numberOfLines={1}`.
  - The amount cells also get `adjustsFontSizeToFit`.

- [ ] **Step 4: Write `agent/2026-10-03-ui-revamp-device-checklist.md`**

```markdown
# UI revamp — device checklist (owner, before release)

Phones: one ~360 dp phone (e.g. Galaxy S22–S25 / A-series) and the same phone with **Settings → Display → Display
size: Large** (≈320 dp). Repeat with **Font size** at default and at the largest step, and once with **3-button
navigation** (Settings → Navigation mode).

Test data: a customer named **Shrimati Rameshwari Devi Kushwaha Prajapati** in village **Bhagwantnagar Purvi**, with a
len-den bill of **₹1,23,45,678** and a rehan of **₹12,34,567**.

| # | Where | Check |
|---|---|---|
| 1 | Home | Two cards, Asha Jewellers and SSJ, plus the date and Export. Nothing cut off |
| 2 | Asha Jewellers | Navy header. Existing Customer, New Customer and Analytics open their screens; back returns to the menu |
| 3 | SSJ | Maroon header. Update Bhav, Category and Product open; back returns to the menu |
| 4 | New Customer | Type into the last field: it and **Save Entry** stay above the keyboard |
| 5 | Existing Customers | The long name ends with "…"; amounts stay on one line; Edit Customer opens as a sheet above the keyboard |
| 6 | Customer → transactions | The + button sits above the navigation bar; the last row is not hidden behind it |
| 7 | Add Transaction | Add Item, Old Jewellery and Jama sheets: fields and buttons above the keyboard and the navigation bar |
| 8 | Transaction detail | Photos form three equal squares; Save Changes sits above the navigation bar; the photo viewer's close and arrows clear the camera cut-out and the navigation bar |
| 9 | Bill preview | Share and Print sit above the navigation bar |
| 10 | Update Bhav | The Update button sits above the keyboard and the navigation bar |
| 11 | Analytics | Four tabs fit on one row; sub-tabs fit; Filter and the time frame open as sheets; the controls stay visible while scrolling; no page scrolls sideways (tables may, inside their card) |
| 12 | Category / Product | Lists, + button, product filter sheet, add/edit forms with their pickers |
```

- [ ] **Step 5: Final verification**

Run: `npx tsc --noEmit` → clean. Run: `npx jest` → all suites pass, including the full source audit.
Run: `git status --short` → only `?? "Rehan & Lenden Insights.html"` remains untracked.

- [ ] **Step 6: Commit**

```bash
git add src/components/BillTable.tsx src/components/LendenItemsTable.tsx src/components/RehanTransactionTable.tsx src/components/OldJewelleryItemsTable.tsx agent/2026-10-03-ui-revamp-device-checklist.md
git commit -m "Keep ledger table rows on screen at any width and add the owner's device checklist"
```
