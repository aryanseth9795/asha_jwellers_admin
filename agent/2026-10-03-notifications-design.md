# Notifications revamp — animated banners and confirm dialogs (design)

Date: 2026-10-03 · Branch: `feat/ui-revamp` · Status: approved in chat ("Yes go ahead")

## 1. What the owner asked

> "Revamp the notification style, like if I save the transaction the pop-up will come in a better UI format… use some
> graphics and motion for better UI UX experience for alerts also and implement in the whole app."

**Today:** there are 69 plain Android `Alert.alert` / `alert()` boxes across 12 screens and `App.tsx`:
- ~35 errors or validations
- ~12 successes, usually followed by an OK button that triggers `navigation.goBack()`
- ~12 questions: 6 deletes, Close Rehan, Remove Image, duplicate warnings, permission notices and the OTA "Update Available"

**Success:**
- No grey system box remains anywhere in the app.
- Saving shows an animated success banner and returns to the previous screen without an OK tap.
- Every destructive question shows a branded dialog with a clear red action.
- Nothing ever appears behind an open pop-up.

## 2. Constraints

- No new native dependencies, so the update ships over the air.
  - Motion uses React Native's `Animated` with the native driver.
  - Graphics are Ionicons inside animated circles.
- No vibration, because `Vibration` needs a manifest permission and therefore a new native build.
- Text uses the font-capped `Text` from `src/ui`, colours come from `theme.ts`, touch targets are at least 44 dp, and the
  layout works down to 320 dp (UI revamp spec §6).
- No change to data, calculations or navigation targets. Only the way messages are shown changes.

## 3. Pieces

| Unit | Responsibility |
|---|---|
| `src/ui/notify/notifier.ts` (pure, tested) | Store: current banner, confirm queue, toast-host stack. Exports a singleton `notifier`, the helpers `notify.success/error/info(title, message?)` and `confirm(options): Promise<boolean>`, and `DURATIONS` |
| `src/ui/notify/ToastHost.tsx` | Draws the banner, but only when it is the top-most registered host |
| `src/ui/notify/ConfirmHost.tsx` | Draws the first queued confirm as an animated dialog in a `Modal` |
| `src/ui/notify/NotifyRoot.tsx` | `ToastHost` + `ConfirmHost`, mounted once in `App.tsx` above the navigator |
| `BottomSheet` | Renders its own `ToastHost` while visible, so errors raised inside a sheet show on top of it |
| `src/ui/sourceAudit.test.ts` | New rule: no `Alert.alert` / `alert(` outside `src/ui` |

### 3.1 Notifier rules (pure)

- **One banner at a time.** `show` replaces the current banner and gives it a new id.
- **Dismissing** with a stale id does nothing, so a timer from an older banner can't close a newer one.
- **Durations (ms):** success 2200, info 2800, error 3500.
- **Confirms** queue first-in, first-out. A host shows `confirms[0]`. `answer(id, ok)` resolves that promise and removes
  it from the queue. Requests made before any host mounts wait in the queue (for example the OTA question during the
  splash screen).
- **Confirm defaults:**
  - `confirmLabel` "OK", `cancelLabel` "Cancel", `tone` "primary".
  - Icon by tone: danger `trash-outline`, warning `alert-circle-outline`, primary `help-circle-outline`.
  - `cancelLabel: null` gives a single-button acknowledgement, which resolves `true`.
- **Host stack:** `registerToastHost()` returns `{ id, release }`. The last registered and not yet released host is
  active. Releasing the top host makes the previous one active again.
- `subscribe(listener)` returns an unsubscribe function, and `getState()` returns
  `{ toast, confirms, activeHost }`. `getState()` returns a new object reference after every change, so it works with
  `useSyncExternalStore`.

### 3.2 Banner (ToastHost)

- **Position:** absolute, top = safe-area top + 8, side gutter 12–16, up to 520 wide. The host itself passes touches
  through (`pointerEvents="box-none"`).
- **Card:** surface background, 16 radius, shadow, 4 dp accent bar on the left in the kind colour (success
  `colors.success`, error `colors.danger`, info `colors.primary`).
  - 40 dp icon circle tinted with the kind colour at about 15 % opacity. The icons are `checkmark` (success),
    `close` (error) and `information` (info).
  - Title (1 line, bold) and message (up to 3 lines).
  - A 3 dp progress line along the bottom that shrinks from full to empty over the banner's duration.
- **Motion:**
  - Enter: slides down from −120 with a spring and fades in.
  - Icon: pops in after the card (scale 0 → 1.15 → 1).
  - Exit: slides up and fades out over 180 ms, then `dismiss(id)`.
- **Interaction:** tap, or swipe up more than 20 dp, dismisses early. A new banner restarts the animation.
- **Accessibility:** `accessibilityLiveRegion="polite"` and `accessibilityRole="alert"`.

### 3.3 Confirm dialog (ConfirmHost)

- **Window:** transparent `Modal` with `statusBarTranslucent` and `navigationBarTranslucent`. The backdrop
  (`colors.backdrop`) fades in.
- **Card:** centred, width `min(window − 48, 360)`, 24 radius. Its contents, top to bottom:
  - A 64 dp icon circle in the tone colour (danger `colors.danger`, warning `#B26A00`, primary `colors.primary`) with
    a soft halo ring that pulses once.
  - Title (heading, centred, up to 2 lines) and message (body, centred, scrolls if long).
  - Two full-width buttons stacked, each 48 dp tall: the confirm button filled in the tone colour, Cancel as an outline
    below it.
- **Motion:** the card scales 0.9 → 1 with a spring, and its opacity goes 0 → 1.
- **Closing:** Android back, or a tap on the backdrop, counts as Cancel. With a single button they count as OK.

## 4. Migration rules (every call site)

| Old | New |
|---|---|
| `Alert.alert("Success", msg, [{ text: "OK", onPress: () => navigation.goBack() }])` | `notify.success(<short title>, msg); navigation.goBack();` (the banner survives navigation) |
| `Alert.alert("Success", msg)` | `notify.success(<short title>, msg)` |
| `Alert.alert("Error" \| "Validation Error" \| "Update Failed" …, msg)` | `notify.error(<title>, msg)` |
| Information with one OK button and no follow-up (e.g. "No Changes", "Permission Required", duplicate warning) | `notify.info(title, msg)`. Permission and duplicate warnings use `notify.error` |
| Two-button question with a destructive or affirmative action | `if (await confirm({ title, message, confirmLabel, tone })) { …the old onPress body… }`. A cancel-only `onPress` (e.g. `setIsUpdating(false)`) goes in the `else` branch |
| `alert(...)` (bare) | Same rules |

**Titles:** short and specific, e.g. "Transaction saved", "Customer deleted", "Amount required". The old message text
becomes the banner message, unchanged where it makes sense.

**Tones and labels:**
- Deletes: `tone: "danger"`, `confirmLabel: "Delete"`.
- Close Rehan: `tone: "warning"`, `confirmLabel: "Close entry"`.
- Remove Image: `"danger"` / `"Remove"`.
- OTA update: `"primary"`, "Restart now" / "Later".

## 5. Testing

- **Jest, `notifier.test.ts`:**
  - replace semantics and stale-id dismiss
  - the durations
  - confirm FIFO and resolution, defaults and icons, single-button mode
  - queueing before a host mounts
  - host stack activation and release
  - `getState()` identity changes
- **Source audit:** no `Alert.alert` / `alert(` in app files.
- **`npx tsc --noEmit`** stays clean.
- **Device checklist:** add rows for a success banner after saving a transaction, an error banner inside the Add
  Variant sheet, the delete-customer dialog, and the OTA dialog.

## 6. Out of scope

Sound, vibration, notification history, system (push) notifications, Lottie or SVG animation.
