# UI revamp — two-business Home, Analytics regroup, overflow fixes (design)

Date: 2026-10-03 · Branch: `feat/old-jewellery-adjustments` · Status: **draft for owner review**

## 1. What the owner asked

> "Lets revamp the UI of App, as in diagram, first home page loaded with two options - Asha Jewellers and SSJ. In Asha
> jewellers its child and in ssj its child. Then rest flow will same. We need a better UI and UX in analytics, as well as
> in whole app, everything overflow. So analyse and fix it accordingly to android phone 2026. It must be responsive to all
> type of mobile phones Android from 2022 to 2026 latest phones as screen size."

Diagram:

```
Home ── AJ (Asha Jewellers) ── Existing Customer
   │                        ├── New Customer
   │                        └── Analytics ── Overview · Customer · Rehan · Lenden
   └── SSJ ─────────────────── Update Bhav · Category · Product
```

### Understanding (said vs assumed)

| | |
|---|---|
| **Said** | Home shows two businesses; each opens its own menu; all flows below the menus stay as they are; Analytics becomes four sections; fix overflow on every screen; work on every Android phone from 2022 to 2026 |
| **Assumed (correct me)** | "SSJ" is shown as **SSJ** with the subtitle "Bhav · Categories · Products" (no expansion of the name in the app). The data export button stays on Home. Every report that exists in Analytics today stays — the four sections regroup them, nothing is dropped. The colour refresh is limited to Home, the two business menus, the screen headers and Analytics; other screens keep their current colours but get the layout fixes. All colours become theme tokens, so a full re-colour later is a one-file change. No new native dependencies, so the release can go out over the air (expo-updates) |
| **Success** | On a 320 dp wide screen with font size at the largest Android setting, no text is cut off mid-word, no button hides under the gesture or 3-button navigation bar, no page scrolls sideways, and no form field hides under the keyboard. On a 412 dp phone the screens look intentional, not stretched |

## 2. Target devices

| Range (Android phones 2022–2026) | Width (dp) | Height (dp) | Examples |
|---|---|---|---|
| Narrow | 320–359 | 640–760 | "Display size: Large" on any phone, foldable cover screens |
| Standard | 360–392 | 740–860 | Galaxy S22–S25, Galaxy A series |
| Wide | 393–480 | 800–960 | Redmi / Poco / Realme, Pixel 7–10, OnePlus |

Other conditions: punch-hole cutouts. Gesture navigation and 3-button navigation. Font scale up to 2.0, since Android 14
scales fonts non-linearly. Portrait only (`app.json`). **Edge-to-edge is always on**: Expo SDK 54 draws the app behind
the status bar and the navigation bar, and Android 15+ enforces this. The layout floor is **320 dp wide**.

## 3. Why things overflow today (audit)

| Cause | Where |
|---|---|
| Edge-to-edge without safe-area insets: content and bottom bars sit under the navigation bar | AddTransaction, TransactionDetail, ExistingCustomers, BillPreview, Analytics, the four add-modals, CustomDatePicker |
| Absolute bottom bars with a hard-coded offset | TransactionDetail save bar (`bottom: 0`) and image-viewer footer (`bottom: 40`), UpdateBhav footer (`bottom: 0`), UserTransactions FAB (`bottom: 100`) |
| Top safe-area edge under a native header (doubled gap) | NewCustomer (`edges={["top","bottom"]}` with the header shown) |
| Screen width read once at module load | TransactionDetail media grid `(SCREEN_WIDTH - 44) / 3`: wrong after a rotation or a display-size change, and on foldables |
| No font-scale limit | Every `Text`; at 1.5–2.0× scale, 15–28 sp labels and amounts push rows past the edge |
| Rows of label + value with no shrink or line limit | TransactionDetail (17 rows, 0 line limits), UserTransactions, ExistingCustomers, BillTable, the modals |
| Large fixed sizes | Home cards `height: 120`, name 34 sp, Android top padding 40; hero numbers 24–40 sp |
| Analytics header | 7 tabs in a sideways scroller; the filter bar expands inline and pushes the content down; period chips wrap onto 2 lines at 360 dp |

## 4. Navigation

New routes in `RootStackParamList`. Every existing route and its params stay unchanged.

| Route | Title | Content |
|---|---|---|
| `Home` (header hidden) | — | Greeting, today's date, **Export** button (icon + label), two business cards: **Asha Jewellers** ("Customers · Rehan · Len-den · Analytics") and **SSJ** ("Bhav · Categories · Products") |
| `AshaHome` (new) | Asha Jewellers | Menu: Existing Customer → `ExistingCustomers`, New Customer → `NewCustomer`, Analytics → `Analytics` |
| `SsjHome` (new) | SSJ | Menu: Update Bhav → `UpdateBhav`, Category → `CategoryList`, Product → `ProductList` (params `{}`) |

- Back from a menu returns to Home. Deep flows (UserTransactions, AddTransaction, TransactionDetail, BillPreview,
  AddEditCategory, AddEditProduct) are reached exactly as today.
- The menus are data. A pure module `src/navigation/menus.ts` exports `BUSINESSES`, which lists each business's id, name,
  subtitle, accent and menu items. Each item has a label, a subtitle, an icon and a route plus params. Home, AshaHome and
  SsjHome render from it.
- **Header colour tells the owner which business they are in.** Asha Jewellers routes use navy `#0B1F4B` (the splash
  colour). SSJ routes use maroon `#7B1E3A`. Both have white titles. The header colour is set per screen from the business
  that owns the route; the route-to-business map lives in `menus.ts`.
- **Status bar.** Icons are light over the dark headers. Home shows dark icons on its light background, and renders its
  `StatusBar` only while focused (`useIsFocused`), so the setting doesn't leak to the screens above it.

## 5. Analytics: four sections

The numbers do not change. Every pure module under `src/utils/analytics/` stays untouched. Only the screen's tab
structure and the controls change.

| Section | Sub-tabs | Controls | Existing components shown |
|---|---|---|---|
| **Overview** | Findings · Together · Data quality | pledge filters (village also filters bills); none on Data quality | `OverviewTab` · `TogetherTab` · `DataQualityTab` |
| **Customer** | Rehan · Lenden | Rehan: pledge filters · Lenden: time frame | `CustomersVillagesTab` · `KeyCustomersCard` + `CustomersSection` + `VillagesSection` |
| **Rehan** | Book · Items | pledge filters | `RehanBookTab` · `ItemsTab` |
| **Lenden** | Summary · Sales · Metal · Trends | time frame (+ village note on Summary) | `BillingSummaryTab` · `OverviewSection` + `SalesSection` + `BaakiAgingCard` · `MetalSection` + `CategoriesCard` · `TrendsSection` |

All 11 views of the current screen (7 tabs, Billing's 5 sub-tabs folded in) appear exactly once. The screen opens on
Overview → Findings. One pledge-filter state and one time-frame state are shared by every section, as now.

`src/utils/analytics/report/sections.ts` (pure, tested) exports:
- `SECTIONS`: each section's sub-tabs in order.
- `controlsFor(section, sub): "pledge" | "timeframe" | "none"`.

### UX changes

- **Section bar:** 4 equal-width tabs that always fit (icon above label). They replace the 7-tab sideways scroller. The
  bar is fixed under the header.
- **Sub-tabs:** `Segmented` changes to equal-width segments that fill the row (2–4 short labels). No sideways scrolling.
- **Pledge filters:** the summary row stays ("All villages · All items · All years · All" + "Showing N of M pledges").
  Tapping it opens a **bottom sheet** instead of expanding inline. In the sheet, chips wrap onto several lines instead of
  scrolling sideways. Changes still apply at once, and Reset and Done stay.
- **Time frame:** one compact row. A grain chip ("Month ▾") opens a bottom sheet with Week / Month / Quarter / FY /
  Custom / All, followed by ◀ period label ▶. For Custom, a From / To row sits below. The row fits 320 dp.
- **Sticky controls:** the sub-tabs and the filter / time-frame row form the scroll view's sticky header. They stay
  reachable while the cards scroll under them.
- **Hero numbers** (OverviewTab 40 sp, KPI tiles): one line, `adjustsFontSizeToFit`, maximum 32 sp.
- **KPI / stat grids:** 2 columns at 340 dp or wider, 1 column below.
- **`HBars` label width:** 30 % of the card width, clamped to 84–120 dp. It is no longer a fixed 104.
- **Wide tables** (`DataTable`, Trends): keep their fixed columns and scroll sideways inside their card, with the
  scrollbar visible. The page itself never scrolls sideways.
- **Bottom padding** clears the navigation bar.

## 6. Shared UI layer — `src/ui/`

| File | Purpose |
|---|---|
| `theme.ts` | Tokens. **Colours**: `ajNavy #0B1F4B`, `ssjMaroon #7B1E3A`, `gold #B8860B`, `goldDeep #8C5B14`, `primary #007AFF` (kept for existing flows), `bg #F8F9FA`, `surface #FFFFFF`, `border #EEF0F2`, `text #1A1A1A`, `textDim #666666`, `danger #C62828`, `success #2E7D32`. **Spacing** 4 / 8 / 12 / 16 / 20 / 24. **Radius** 8 / 12 / 16 / 20. **Type scale (sp)** caption 12 · body 14 · bodyLg 15 · title 17 · heading 20 · display 26 · hero 32 (fit-to-width) |
| `Text.tsx` | `Text` and `TextInput` with `maxFontSizeMultiplier={1.3}` by default (a prop can override it). Every screen and component imports `Text` / `TextInput` from `src/ui` instead of `react-native`. React 19 no longer applies `defaultProps` to function components, so a wrapper is the only global switch |
| `layout.ts` | Pure `layoutFor(width: number)` → `narrow` (width < 340), `compact` (width < 360), `tileColumns` (2 at ≥ 340, else 1), `gutter` (12 below 360, else 16), `mediaTile` (`Math.floor((width − 44) / 3)`), plus the hook `useLayout()` built on `useWindowDimensions` |
| `Screen.tsx` | Screen root: `SafeAreaView` with background. `edges` defaults to `["left","right","bottom"]` because the native header already covers the top. Home passes `["top","left","right","bottom"]` |
| `FooterBar.tsx` | In-flow bottom action bar (surface, top border, padding 16). Placed after the scroll view in a flex column, so it can't cover content and sits above the navigation bar. Replaces every absolute bottom bar |
| `BottomSheet.tsx` | `Modal` (transparent, slide, `statusBarTranslucent`, `navigationBarTranslucent`) + backdrop that closes on tap + sheet with handle, title, close button, `maxHeight` 90 % of the window, scrollable body, bottom padding = bottom inset, and `KeyboardAvoidingView` (`behavior="padding"`) so inputs stay above the keyboard |
| `MenuCard.tsx` | Home, AshaHome and SsjHome card: icon tile, title (1 line), subtitle (2 lines max), chevron. Minimum height 72, no fixed height |

### Layout rules every screen follows

1. The root is `Screen`, with the edges right for its header.
2. No absolute bottom bars: actions go in `FooterBar`. A floating button sits 16 dp above the safe area, never at a
   magic offset.
3. No module-scope `Dimensions.get`: use `useLayout()`.
4. In a row, the text beside another element gets `flexShrink: 1`. Names and labels get `numberOfLines` (1, or 2 for
   descriptions) with an ellipsis. Amounts never wrap: `numberOfLines={1}`, and hero amounts also get
   `adjustsFontSizeToFit`.
5. Font sizes come from the type scale (largest 26 sp, hero 32 sp fit-to-width).
6. Touch targets are at least 44 dp.
7. Tile grids use `useLayout().tileColumns`.
8. Wide tables scroll sideways inside their card. The page never does.
9. Forms: a `ScrollView` with `keyboardShouldPersistTaps="handled"` inside `KeyboardAvoidingView` (`behavior="padding"`
   on both platforms, because edge-to-edge Android no longer resizes the window for the keyboard). Footer actions stay
   above the keyboard.
10. Scroll content ends with 24 dp of padding. The safe area is handled by `Screen`.

## 7. Screen by screen

| Screen / component | Fix (beyond rules 1–10) |
|---|---|
| Home | Rebuilt as the business picker (§4) from `MenuCard` and `BUSINESSES`. The existing date-badge styles are finally used |
| AshaHome, SsjHome (new) | Menu list from `BUSINESSES`, with the business accent on the icon tiles |
| NewCustomer | Drop the top safe-area edge (it doubled the gap under the header). Title 28 → heading. Save in `FooterBar` |
| ExistingCustomers | `Screen`. Customer rows: name 1 line with ellipsis, amounts 1 line. The filter modal moves to `BottomSheet` |
| UserTransactions | FAB 16 dp above the safe area (was `bottom: 100`). Summary amounts (24 sp) fit to width on one line |
| AddTransaction | `Screen`. Keyboard handling per rule 9. Amount 28 → display, single line |
| TransactionDetail | `Screen`. The save bar becomes `FooterBar` (no more `paddingBottom` guesswork). The media grid uses `useLayout().mediaTile` (live width). The image viewer's footer is offset by the bottom inset (was `bottom: 40`). Its 17 label/value rows follow rule 4 |
| BillPreview | `Screen`, so the share and print actions sit above the navigation bar |
| UpdateBhav | The footer becomes `FooterBar`. 28 / 22 sp rates → display / heading, single line |
| CategoryList, ProductList | FAB per rule 2. ProductList's filter modal moves to `BottomSheet` |
| AddEditCategory, AddEditProduct | Keyboard handling per rule 9. AddEditProduct's two picker modals move to `BottomSheet`. Badge overlays inside images stay absolute, because they are positioned within their own box |
| AddJama, AddLendenItem, AddOldJewelleryItem, AddRehanTransaction modals, CustomDatePicker | Rebuilt on `BottomSheet` (inset-aware, keyboard-aware, 90 % max height) |
| BillTable, LendenItemsTable, OldJewelleryItemsTable, RehanTransactionTable | Rule 4 on every label/value row |
| Analytics | §5 |

## 8. Testing

- **Jest (pure):**
  - `layoutFor` at 320, 339, 340, 359, 360 and 412 dp, including the column switch.
  - `BUSINESSES`: two businesses, the exact routes from §4, and every route maps to one business. Menu routes are typed as
    `keyof RootStackParamList`, so `tsc` rejects a route that does not exist.
  - `SECTIONS` / `controlsFor`: each of the 11 former views appears exactly once with the controls listed in §5, and
    Overview → Findings is the default.
- **`npx tsc --noEmit`** stays clean, and the existing 212 tests keep passing.
- **Device checklist** (owner, before release). Run on a 360 dp phone and, via "Display size: Large", a ~320 dp phone:
  font size default and largest; gesture and 3-button navigation; keyboard open on every form and sheet; every route in
  §4 and every Analytics section and sub-tab.

## 9. Out of scope

- Dark mode (`app.json` is light).
- Landscape and tablets (portrait is locked).
- Re-colouring the inner screens beyond the tokens.
- New native dependencies (for example `react-native-keyboard-controller`).
- Any change to data, calculations, the bill HTML or the database.
