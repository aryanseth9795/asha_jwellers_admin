# Audit — Services, Product Subsystem, Configuration

Repo: `D:\Desktop\asha` · branch `feat/lenden-itemised-billing` (working tree clean at audit time) · read-only audit, no files in the repo were modified and no network requests were made.

## Summary

`ProductService.ts` was written fresh against the new `modifyPlan.md` spec in commit `8c0cbf5` and gets the big things right: every documented endpoint exists at the right path and method, the variants model is correct (no top-level `images`/`weight`/`size`), `variantWeight`/`variantSize`/`variantImages` are named per spec, and `existingImages` is JSON-stringified into the FormData. The drift is in the seams, not the shape. Five mutating endpoints silently fall back to a JSON body when no file is attached, contrary to the document's blanket `multipart/form-data` contract — which means `existingImages` goes over the wire two different ways on the same endpoint depending on whether a file happened to be attached. The FormData builder reads `img.fileName`, a property neither screen ever sets, so every uploaded file is named `image.jpg` regardless of its real type. `AddEditProductScreen.handleSubmit` performs an unbounded sequence of un-rolled-back writes (create product → N × addVariant → M × updateVariant) with no idempotency, so any mid-sequence failure leaves partial server state and a retry duplicates the variants that already landed — and because variant weight is required by the spec but unvalidated in the modal, that mid-sequence failure is easy to trigger deliberately. Separately, the admin key `ayushseth958` is a string literal in two service files, present in three commits already on `origin/main` and compiled into the shipped bundle; it grants full destructive CRUD over products/categories/variants plus write access to the gold/silver/RTGS rates that billing is priced from. Finally, an unrelated but severe defect reachable from in-scope code: `initDatabase()` (called unawaited and uncaught at `App.tsx:74`) throws on every fresh install because the `users` CREATE TABLE declares `address` twice — verified empirically — leaving the app running with no tables at all.

**Counts:** 5 Critical · 12 Important · 8 Minor

---

# API contract drift vs `modifyPlan.md`

## What matches (verified, no action needed)

All 13 documented routes are implemented at the correct path and method — categories `GET /api/categories`, `GET /:id`, `POST`, `PUT /:id`, `DELETE /:id`; products `GET /api/products` (+`?category=`), `GET /api/products/by-category/:categoryId`, `GET /:id`, `POST`, `PUT /:id`, `DELETE /:id`; variants `POST|PUT|DELETE /api/products/:id/variants[/:variantId]`. **No endpoint has moved and none is missing.** The `Product` interface (`ProductService.ts:36-48`) carries `variants: Variant[]` with no top-level `images`/`weight`/`size`, matching the `[!NOTE]` at spec line 98. `CreateProductPayload` (`:50-58`) uses the spec's `variantWeight`/`variantSize`/`variantImages` names. `UpdateProductPayload` (`:60-65`) correctly excludes variant fields. Every product/category screen reads variant data through `variants[]` (`ProductListScreen.tsx:136-148`, `AddEditProductScreen.tsx:106-113`) — no screen reads a removed top-level field. `existingImages` is JSON-stringified (`:137-140`) as spec line 194 requires. `createProduct` (`:375-397`) unconditionally uses multipart and sets no manual `Content-Type`, exactly per the spec's frontend guide at line 235.

## D1 — Five mutating endpoints send `application/json` instead of `multipart/form-data`

**Rank: Important** (Critical if the server's `req.body` is populated only by multer)

**File:line**
- `src/services/ProductService.ts:201-215` (`createCategory`)
- `src/services/ProductService.ts:240-253` (`updateCategory`)
- `src/services/ProductService.ts:407-422` (`updateProduct`)
- `src/services/ProductService.ts:473-486` (`addVariant`)
- `src/services/ProductService.ts:514-530` (`updateVariant`)

**What.** Each of these branches on "is there a file?" and, when there isn't, abandons multipart:

```ts
// updateProduct, :417-422
if (hasFile) {
  body = createFormData(payload);
} else {
  body = JSON.stringify(payload);
  headers["Content-Type"] = "application/json";
}
```

`modifyPlan.md` marks **every one** of these endpoints `**Content-Type:** multipart/form-data` (lines 49, 59, 116, 155, 178, 188) and its frontend guide says explicitly "*do NOT set Content-Type manually*" (line 235). The client does exactly that, on the most common paths: editing a product's name or category without touching the thumbnail, renaming a category, changing a variant's weight.

**Failure scenario.** Whether this fails loudly or silently depends on server middleware, which is not in this repo:
- If the admin routes rely on multer to populate `req.body` (i.e. `express.json()` is not mounted ahead of them), `req.body` is `{}`. `PUT /api/products/:id` then either 400s on a missing required field — **fails loudly** — or, if all fields are optional per spec lines 159-164, updates nothing and returns 200. The client shows "Product updated successfully" and the edit is **silently discarded**; the user only discovers it on the next screen focus, when `useFocusEffect` refetches and the old values reappear.
- If `express.json()` is mounted globally, both branches work today and this is a latent inconsistency that breaks the day the middleware order changes.

**Suggested fix.** Delete the branch. Always `createFormData(payload)` and never set `Content-Type` on these five, matching `createProduct` which already does the right thing.

## D2 — `existingImages` is encoded two different ways on the same endpoint

**Rank: Important** — silent corruption

**File:line** `src/services/ProductService.ts:514-530` with `:137-140`

**What.** `PUT /api/products/:id/variants/:variantId` sends `existingImages` as a JSON **string** inside FormData when a file is attached (`formData.append(key, JSON.stringify(value))`, `:139`), and as a native JSON **array** when no file is attached (`JSON.stringify(payload)` at `:528` nests it as a real array). The server can only be written to parse one of these. The spec (line 194) documents exactly one encoding: `Text (JSON)`, i.e. the string form.

**Failure scenario.** A server doing `JSON.parse(req.body.existingImages)` succeeds on the multipart branch and throws on the JSON branch (`JSON.parse` of an array is a type error, or `existingImages` is already an array and `.parse` receives `[object Object]`). The user edits a variant's weight without touching images → 400 or 500. The user edits weight *and* adds one photo → succeeds. Same button, different outcome depending on whether a photo was attached.

**Suggested fix.** Same as D1 — one code path, always multipart, always `JSON.stringify`.

## D3 — "delete every image on this variant" cannot be expressed

**Rank: Critical** — broken user-facing flow

**File:line** `src/screen/AddEditProductScreen.tsx:344-347`

```ts
existingImages:
  existingImageUrls && existingImageUrls.length > 0
    ? existingImageUrls
    : undefined,
```

**What.** Spec line 194 defines `existingImages` as "JSON array of existing image URLs **to keep**". The empty array is therefore meaningful — it means keep none. The screen converts it to `undefined`, and `createFormData` skips `undefined` (`ProductService.ts:114`) while `JSON.stringify` drops it. So the field is omitted precisely when the user's intent is "remove all of them".

**Failure scenario.** Concrete and fully client-side: a variant has 3 images, the user opens the variant modal, taps the ✕ on all three (`handleRemoveImage`, `:155-157`), saves the variant, saves the product. `existingImageUrls` is `[]` → `existingImages` omitted → and since `newImageFiles` is also empty, `updateVariant` takes the JSON branch (D1) and sends `{"weight":"5g"}`. Nothing about images reaches the server. A "keep only what's listed" server has nothing listed and either keeps all (deletion silently lost) or wipes all (correct by accident); a merge-style server keeps all. The user is told "Product updated successfully", reopens the product, and all three images are back.

**Suggested fix.** Send `existingImages` whenever the variant is being updated, including the empty array: `existingImages: existingImageUrls ?? []`. Add an `Array.isArray` branch in `createFormData` that stringifies `[]` rather than falling through.

## D4 — FormData filenames are always `image.jpg`; the real filename is never read

**Rank: Important** — silent corruption of upload metadata

**File:line** `src/services/ProductService.ts:122` and `:134` vs `src/screen/AddEditProductScreen.tsx:141-145` and `src/screen/AddEditCategoryScreen.tsx:100-104`

**What.** The builder reads `fileName`:

```ts
name: img.fileName || `image_${index}.jpg`,   // :122
name: value.fileName || "image.jpg",          // :134
```

Both screens construct the file object with `name`, not `fileName`:

```ts
const file = {
  uri: asset.uri,
  name: asset.fileName || "photo.jpg",   // AddEditProductScreen.tsx:143
  type: asset.mimeType || "image/jpeg",
};
```

`value.fileName` is `undefined` on every call, so the fallback always wins. Verified by grep: `fileName` appears in exactly four places repo-wide, and the two producers spell it `name`.

**Failure scenario.** Silent. A user picks a PNG or an iOS HEIC. The part is sent as `filename="image_0.jpg"` with `Content-Type: image/heic`. Spec line 55 says the server accepts "jpg, png, webp" — a multer `fileFilter` using `path.extname(originalname)` passes it as `.jpg` and Cloudinary then either rejects the HEIC payload or stores it with a wrong format/extension. Every uploaded asset also lands with an identical, non-descriptive name, so multi-image variants are indistinguishable server-side.

**Suggested fix.** Read `img.name ?? img.fileName` in both branches of `createFormData`, and derive the extension from `type` rather than hardcoding `.jpg`.

## D5 — Documented 10-image cap is not enforced client-side

**Rank: Important**

**File:line** `src/screen/AddEditProductScreen.tsx:150` (`setVariantImages([...variantImages, file])`), rendered at `:685-709`

**What.** Spec lines 128 and 184 both say "up to 10". Nothing in the screen caps the array; the "Add Image" button (`:676-682`) can be tapped indefinitely.

**Failure scenario.** Loud, but at the worst moment. In edit mode a user adds 11 images to the *second* variant. `handleSubmit` runs `updateProduct` (succeeds), `addVariant` for variant #1 (succeeds), then `addVariant` for #2 → server rejects on the count. The user sees "Failed to save product" while the product and one variant were already written. Retrying re-adds variant #1 (see C3).

**Suggested fix.** Disable the button and show the count at 10; validate before the first network call.

## D6 — Variant `weight` is required by the spec but unvalidated in the UI

**Rank: Critical** — see C4 below (listed there in full).

## D7 — Server error messages are discarded

**Rank: Important**

**File:line** `src/services/ProductService.ts:164, 187, 226, 264, 288, 317, 343, 364, 392, 433, 457, 499, 544, 573` — the pattern `error.error || \`Failed to …: ${response.status}\``

**What.** Every handler reads `.error` off the parsed error body. The only response envelope `modifyPlan.md` documents (lines 132-149) uses `message` as its human-readable key. If the server errors with `{ "message": "Weight is required" }` — the natural counterpart to its documented success shape — `error.error` is `undefined` and the fallback wins.

**Failure scenario.** Silent loss of diagnostics. A user submits a variant the server rejects for a specific, fixable reason; the alert reads `Failed to update variant: 400`. Nothing anywhere logs the response body, so the actual reason is unrecoverable from the device.

**Suggested fix.** `error.message || error.error || \`…: ${response.status}\``, and log the raw body.

## D8 — `getProductsByCategory` is implemented but never called

**Rank: Minor**

**File:line** `src/services/ProductService.ts:327-348`; zero call sites (verified by grep across `src/`).

**What.** `ProductListScreen` filters via `getProducts(selectedCategory)` (`:56`), which maps to the `?category=` query on `GET /api/products` (spec line 104). The dedicated `by-category` route (spec line 106) is dead code.

**Failure scenario.** No runtime failure. It matters only as unexercised contract surface: if that route changes server-side, nothing here will notice.

**Suggested fix.** Delete it, or route the filter through it and drop the query-param call.

---

# Secrets & configuration

## S1 — Admin API key hardcoded in two service files

**Rank: Critical**

**File:line** `src/services/ProductService.ts:4` and `src/services/BhavService.ts:4`

```ts
const ADMIN_KEY = "ayushseth958";
```

**What it grants.** This is the `x-admin-key` value from spec line 15, sent on 11 call sites across the two services. Reading only what is in this repo, it authorises:
- **Products & categories** — create, update, and delete any product, category, or variant (`ProductService.ts:206, 245, 281, 380, 414, 450, 478, 522, 564`). The deletes are unconditional and the client offers no undo.
- **Pricing** — `GET` and `PUT /api/admin/static` (`BhavService.ts:39, 60`), i.e. read and overwrite `silver_bhav`, `gold_995_bhav`, `gold_999_bhav`, `rtgs_bhav`. These are the metal rates the shop's billing is computed from.
- **Cloudinary uploads** — every image endpoint stores to Cloudinary per spec line 6, so the key also reaches a paid storage/bandwidth backend.

There is no per-user authentication anywhere in the app; this single shared static string is the entire authorisation model for writes.

**Is it in git history.** Yes. `git log -S"ayushseth958" --all` returns three commits: `d8a92bd` (2026-01-15, "updated bhav"), `0984546` (2026-02-05), `8c0cbf5` (2026-02-10, "updated product section"). All three are reachable from both `main` and `origin/main`, so the value has already been pushed to `https://github.com/aryanseth9795/asha_jwellers_admin.git`. I did not check the repository's visibility — that would require a network request, which was out of bounds for this audit; the owner should confirm it directly.

**Where else it exists.** The local `dist/` export contains the literal in the compiled Hermes bundles and, notably, in their sourcemaps: `dist/_expo/static/js/android/index-*.hbc`, the matching `.hbc.map`, and the iOS equivalents. `dist/` **is** correctly gitignored (`.gitignore:8`) and `git ls-files dist` returns nothing, so it is not committed — but that directory is the artifact published for OTA updates, which means the key ships to every installed device regardless of git. Any string literal placed here is extractable from the APK; this is structural, not a mistake in how the constant was written.

**What rotating it requires.**
1. Set a new key in the server's environment and invalidate the old one.
2. Remove both literals and source the value from something not committed (`app.config.ts` reading `process.env`, or EAS build secrets). Note this only removes it from the *repo* — a client-embedded key is still recoverable from the binary.
3. Rebuild and publish an OTA update, because a server-side rotation alone bricks every installed copy of the app until clients receive the new key. Sequence the server switch and the OTA push accordingly, or accept a write outage.
4. History rewrite (`git filter-repo`) plus a force-push removes it from this repo, but not from existing clones, forks, or CI caches. Treat the current key as burned regardless of what the history looks like afterwards.

**The durable fix**, beyond rotation: move admin writes behind per-user authentication that issues a short-lived token, so that compromising one device does not hand over permanent destructive access to the catalogue and the pricing table.

## S2 — `BASE_URL` hardcoded to production in both services

**Rank: Important**

**File:line** `src/services/ProductService.ts:3`, `src/services/BhavService.ts:3` — `https://ssj-server-om8r.onrender.com`

**What.** No environment switching exists. `App.tsx:40` uses `__DEV__` to skip the OTA check, proving the flag is available, but the services ignore it.

**Failure scenario.** A developer running `expo start` against a dev build and tapping through the product screens writes to, and deletes from, the live catalogue and the live bhav rates. There is no staging target to point at.

**Suggested fix.** Read the base URL from `expo-constants` / `app.config.ts` `extra`, defaulting to a staging host under `__DEV__`.

## S3 — `.gitignore` does not cover a plain `.env`

**Rank: Minor**

**File:line** `.gitignore:33-34` — `# local env files` / `.env*.local`

**What.** `.env*.local` matches `.env.local` and `.env.production.local`, but not `.env`, `.env.local` is covered while `.env` itself is not. No `.env` currently exists (verified), so nothing is leaking today.

**Failure scenario.** The obvious remediation for S1 — creating a `.env` — would commit the new key on the next `git add .`.

**Suggested fix.** Add a bare `.env` line before doing anything else about S1.

## S4 — `RECORD_AUDIO` permission requested with no audio code in the app

**Rank: Minor**

**File:line** `app.json:36`

**What.** `android.permissions` declares `android.permission.RECORD_AUDIO`. Grep across `src/` finds no `expo-av`, no `Audio`, no microphone API; the only media access is `expo-image-picker` (camera + library) in `AddTransactionScreen`, `NewCustomerScreen`, `TransactionDetailScreen`, and the two product/category screens.

**Failure scenario.** No runtime failure. It surfaces as a microphone permission prompt users cannot account for, and as a Play Console data-safety declaration that will not match the app's actual behaviour. `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` (`:33-34`) are likewise unnecessary for `expo-image-picker` on modern Android.

**Suggested fix.** Drop `RECORD_AUDIO`; re-test the picker before dropping the storage pair.

## S5 — iOS is half-configured

**Rank: Minor**

**File:line** `app.json:23-25` vs `eas.json:5-27`

**What.** `app.json` sets `ios.supportsTablet: true` but no `ios.bundleIdentifier`. All three `eas.json` build profiles contain only an `android` block.

**Failure scenario.** `eas build -p ios` on any profile prompts for or fails on the missing bundle identifier — the iOS intent implied by `supportsTablet` is not actually buildable.

**Suggested fix.** Either add `ios.bundleIdentifier` plus `ios` blocks in `eas.json`, or drop `ios.supportsTablet` so the config states the truth.

## S6 — Production profile builds an APK, not an AAB

**Rank: Minor**

**File:line** `eas.json:21-26` — `"production": { "android": { "buildType": "apk" } }`

**What.** Correct and intentional if the app is sideloaded onto shop devices, which the `expo-updates` channel setup suggests. Noted only because Play Store upload requires `app-bundle`; there is no failure if distribution is manual.

**Config that lines up (verified).** `app.json:21` `updates.url` embeds project id `7245c873-…`, which matches `extra.eas.projectId` at `:51`. All three `eas.json` profiles declare a `channel`, so EAS Update channel routing is coherent. `updates.enabled: true` with `fallbackToCacheTimeout: 0` means the automatic check never blocks launch, so `App.tsx`'s manual `checkForUpdateAsync` is the effective path — redundant but not harmful. `userInterfaceStyle: "light"` matches the hardcoded light palette in every screen. Every native module needing a config plugin (`expo-sqlite`, `expo-file-system`, `expo-image-picker`, `expo-updates`, `expo-font`, `datetimepicker`, `expo-dev-client`) is listed in `plugins`. `tsconfig.json` sets `strict: true`, and `npx tsc --noEmit` passes clean over everything in scope (the single reported error is `src/utils/billFormat.test.ts` importing a module another agent has not written yet).

---

# General findings

## CRITICAL

### C1 — `initDatabase()` throws on every fresh install; the rejection is unhandled and the app boots with no tables

**File:line** `App.tsx:72-92` (call site at `:74`), defect at `src/database/entryDatabase.ts:32-33`, re-throw at `:171-174`

**What.** The `users` table declares `address` twice:

```sql
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  address TEXT,          -- entryDatabase.ts:33
  ...
```

`git blame` puts the duplicate line in commit `0984546` (2026-02-05, "rehan table updated") — a paste error. I verified SQLite's behaviour empirically rather than assuming it:

```
FRESH DB error: duplicate column name: address
EXISTING TABLE: no error
```

`IF NOT EXISTS` short-circuits before column parsing when the table already exists, so **existing installs are unaffected** — which is why this has gone unnoticed. On a fresh install the statement throws. It is the *first* `execAsync` in `initDatabase`, so `rehan`, `lenden`, and `jama` are never created either. The outer handler logs and re-throws (`:171-174`), and `App.tsx:74` calls `initDatabase()` with no `await` and no `.catch()`.

**Failure scenario.** New phone, or a user clears app data. The rejection is unhandled. The splash still fades out on its 1-second timer (`App.tsx:80-89`) because nothing gates rendering on the database, and the app opens to Home looking healthy. Every customer, rehan, len-den and jama screen then fails against a database with zero tables. Because each CRUD function has its own `try/catch` that logs and returns a default, most of these present as empty lists rather than crashes — the app looks like a brand-new install with no data, permanently.

**Suggested fix.** Delete `entryDatabase.ts:33`. Then `await initDatabase()` in `App.tsx` behind a state flag and render an error screen on rejection rather than proceeding — the unawaited call is what turned a one-line typo into a silent total failure.

### C2 — Hardcoded admin key

See **S1**. Ranked Critical for security exposure.

### C3 — `handleSubmit` performs unrolled-back sequential writes and duplicates variants on retry

**File:line** `src/screen/AddEditProductScreen.tsx:264-368`

**What.** One tap of "Update Product" issues, in order: one `updateProduct` (or `createProduct`), then one `addVariant` per new variant (`:316-325`), then one `updateVariant` per existing variant (`:332-353`). There is no transaction, no rollback, and — critically — **the local `variants` state is never updated with the `_id`s the server returns**. `addVariant`'s response is discarded entirely at `:320`.

**Failure scenario.** Two independent paths, both reachable:

1. *Partial write.* A product with three new variants; the third `addVariant` fails (bad weight per C4, an 11th image per D5, or the connection drops mid-loop). The catch at `:362` shows "Failed to save product" — but the product update and two variants have already been committed server-side. The message is actively wrong about what happened.
2. *Duplicate write on retry.* Following the above, the user taps Update again. `variantsToAdd` (`:310-314`) still filters on `v.isNew`, which is still `true` for all three because nothing reconciled state with the server. Variants 1 and 2 are **created a second time**. The catalogue now has duplicate variants and, per the spec's `[!WARNING]` at line 200, cleaning them up requires leaving at least one behind.

The same double-submit is reachable without any error at all: `isLoading` is cleared in the `finally` at `:365-367`, *before* the success `Alert` at `:357-361` is dismissed. On Android that alert is dismissible with the back button without ever firing `onPress`, so the user lands back on a live form with an enabled button and every variant still flagged `isNew`.

**Suggested fix.** After each successful `addVariant`, write the returned `_id` back into state and clear `isNew`. Keep the submit button disabled until navigation actually occurs. On partial failure, report precisely what succeeded rather than "Failed to save product".

### C4 — Variant `weight` is required by the API but the modal accepts it empty

**File:line** `src/screen/AddEditProductScreen.tsx:209-232` (`handleSaveVariant`), `:159-191` (`validateForm`), `:662-671` (the field)

**What.** `modifyPlan.md` marks `weight` **Required** for both `POST /variants` (line 182) and `PUT /variants/:variantId` (line 192). `handleSaveVariant` performs no validation whatsoever — it trims and stores. The Weight input at `:663` is labelled without the `styles.required` asterisk that Name and Category get, so the UI signals it is optional. `validateForm` checks weight only for `variants[0]`, and only when `!isEditMode`:

```ts
if (!isEditMode && variants.length === 0) { … }
else if (!isEditMode && variants.length > 0 && !variants[0].weight.trim()) { … }
```

So: every variant after the first is unchecked in create mode, and **no variant at all is checked in edit mode**. The submit path then sends it anyway — `weight: variant.weight || ""` at `:321` and `:342` passes the empty string straight through, defeating `CreateVariantPayload.weight`'s non-optional type.

**Failure scenario.** Edit an existing product, add a variant, fill in only Size, save. `updateProduct` succeeds. `addVariant` posts `weight=""` → server 400 → alert says "Failed to save product" even though the product was updated. Combined with C3, the retry duplicates anything that landed before the failure.

**Suggested fix.** Require a non-empty weight in `handleSaveVariant` before closing the modal, mark the field required in the UI, and validate all variants in `validateForm` in both modes.

### C5 — Deleting all of a variant's images does nothing

See **D3**. Ranked Critical for a broken user-facing flow.

## IMPORTANT

### I1 — No timeout, no cancellation, on any request in either service

**File:line** every `fetch` in `src/services/ProductService.ts` (14 calls) and `src/services/BhavService.ts` (`:39`, `:60`). Grep for `AbortController` and `signal:` across `src/` returns nothing.

**What.** React Native's `fetch` has no default timeout. The backend is on Render (`ssj-server-om8r.onrender.com`), where an idle free-tier service cold-starts on the first request.

**Failure scenario.** Opening the Products screen after the backend has idled: `ProductListScreen`'s `isLoading` starts `true` (`:49`) and the full-screen spinner at `:161-170` is the only thing rendered. There is no elapsed-time feedback, no cancel, and no way to leave except the system back gesture. On a captive-portal or half-open connection the socket can hang far longer than the OS timeout, and `handleRefresh` (`:76-79`) lets the user stack additional identical requests behind it.

**Suggested fix.** A shared `fetchWithTimeout` wrapper using `AbortController` (15-30s), plus a distinct "server waking up" message past ~5s.

### I2 — Fetch failures are indistinguishable from an empty catalogue

**File:line** `src/screen/ProductListScreen.tsx:53-68` and `:202-208`; same shape at `src/screen/CategoryListScreen.tsx:38-49`, `:156-164`

**What.** `fetchData`'s catch alerts and swallows; the `finally` sets `isLoading = false` while `products` stays `[]`. The list then renders its empty state:

```
No products yet
Tap the + button to add one
```

**Failure scenario.** The backend is down. The user dismisses the alert (or misses it — `Alert.alert` is easy to dismiss reflexively) and is looking at a screen that positively asserts the shop has no products. There is no error state and no retry affordance other than pull-to-refresh, which is not discoverable from an empty list.

**Suggested fix.** Track an `error` state and render a distinct error view with a Retry button.

### I3 — Stale-response race when switching category filters

**File:line** `src/screen/ProductListScreen.tsx:53-74`

**What.** `useFocusEffect(useCallback(() => { fetchData(); }, [selectedCategory]))` re-fires on every filter change, and `fetchData` has no cleanup, no cancellation, and no guard on whether its result is still current:

```ts
setProducts(productsResponse.data);
setCategories(categoriesResponse.data);
```

**Failure scenario.** The user picks "Rings" then quickly picks "Chains" from the modal. Two `Promise.all`s are in flight. If the Rings response lands second — entirely possible, since each call also refetches the full category list — the screen displays Rings' products under a "Chains" filter label. Nothing corrects this until the next focus or pull-to-refresh. The same absence of cleanup means the `finally` block writes state after unmount if the user navigates away mid-request (a no-op under React 19, but the discarded-response bug is real).

**Suggested fix.** Standard `let isActive = true` guard with a cleanup function returned from the `useFocusEffect` callback, or an `AbortController` per request (pairs with I1).

### I4 — Emptying a description or size never reaches the server

**File:line** `src/screen/AddEditProductScreen.tsx:288` and `:291`, `src/screen/AddEditCategoryScreen.tsx:135`

```ts
description: description.trim() || undefined,
variantSize: firstVariant.size?.trim() || undefined,
```

**What.** An empty string collapses to `undefined`, which `JSON.stringify` drops and `createFormData` skips at `:114`. Only *changing* a field to new text is transmissible; *clearing* it is not.

**Failure scenario.** Silent, and fully verifiable client-side. A product has a description with a typo the owner wants gone entirely. They select all, delete, save. "Product updated successfully". The description is unchanged on the server, and reappears the moment the screen is reopened.

**Suggested fix.** Send `""` when the field was non-empty on load and is empty now. Reserve `undefined` for "not edited".

### I5 — No file size or type validation on any upload

**File:line** `src/screen/AddEditProductScreen.tsx:123-153`, `src/screen/AddEditCategoryScreen.tsx:80-107`

**What.** Both pickers take `result.assets[0]` and build a file object from `uri`/`fileName`/`mimeType`. `ImagePickerAsset` exposes `fileSize` (verified in `node_modules/expo-image-picker/build/ImagePicker.types.d.ts:274`) and `mimeType` (`:303`); neither is checked. `quality: 0.8` reduces but does not bound the result, and `quality` does not apply to non-JPEG sources.

**Failure scenario.** A modern phone camera photo is routinely 5-12 MB. Ten of them on one variant is an ~80 MB multipart POST from a mobile connection, with no timeout (I1), no progress indicator, and no cancel — the submit button just spins. If the server or Cloudinary enforces a per-file cap the whole request fails after minutes of upload, and in edit mode it fails *after* the product-level write already succeeded (C3).

**Suggested fix.** Reject assets over a few MB with a clear message, and check `mimeType` against the jpg/png/webp set the spec declares.

### I6 — Five endpoints send JSON where the spec says multipart

See **D1**.

### I7 — `existingImages` has two wire encodings

See **D2**.

### I8 — Upload filenames are always `image.jpg`

See **D4**.

### I9 — The 10-image cap is unenforced

See **D5**.

### I10 — Server error messages are discarded

See **D7**.

### I11 — `BhavService` discards error bodies entirely

**File:line** `src/services/BhavService.ts:47-51` and `:69-72`

```ts
if (!response.ok) {
  throw new Error(`Failed to update bhav rates: ${response.status}`);
}
```

**What.** Unlike `ProductService`, which at least attempts `await response.json().catch(() => ({}))`, `BhavService` never reads the body on failure. This is the endpoint that writes the gold and silver rates.

**Failure scenario.** A `PUT /api/admin/static` rejected for a specific validation reason (a rate out of range, a key not in `validKeys`) surfaces to the user as `Failed to update bhav rates: 400`. The response explaining why is read off the socket and thrown away. Rates are the highest-consequence data the app writes; this is the worst place to lose the reason for a rejection.

**Suggested fix.** Mirror `ProductService`'s pattern, including the `message` key from D7.

### I12 — `BASE_URL` hardcoded to production

See **S2**.

## MINOR

### M1 — `Updates.reloadAsync()` rejection is unhandled

**File:line** `App.tsx:54-58`

```ts
onPress: async () => {
  await Updates.reloadAsync();
},
```

No `try/catch`. If the reload fails, the promise rejects unhandled and the user is left on a dismissed alert with `isUpdating` still `true` and no way to apply the downloaded update short of killing the app. Wrap it and surface a message.

### M2 — The "Downloading update…" indicator is unmounted mid-download

**File:line** `App.tsx:80-89` vs `:103-108`

The indicator lives inside the `isLoading` splash branch, but `setIsLoading(false)` fires on a fixed 1-second timer that is entirely independent of `fetchUpdateAsync`. Any download longer than ~1.3s (i.e. all of them) has its progress UI ripped away while it continues in the background, and the `setIsUpdating(false)` on "Later" (`:62`) then updates state nothing renders.

### M3 — `MediaTypeOptions` is deprecated

**File:line** `src/screen/AddEditProductScreen.tsx:133`, `src/screen/AddEditCategoryScreen.tsx:91`

`node_modules/expo-image-picker/build/ImagePicker.types.d.ts:19` carries `@deprecated To set media types available in the image picker use an array of MediaType instead`. Installed version is 17.0.10, where the enum still works. Replace with `mediaTypes: ['images']` before the next major.

### M4 — Delete confirmations close over a stale `variants` array

**File:line** `src/screen/AddEditProductScreen.tsx:234-262`

`setVariants(variants.filter((_, i) => i !== index))` inside the Alert callback uses the array captured when the alert opened, and deletes by positional index rather than identity. The modal blocks interaction so this is not currently reachable, but it breaks the moment a background refresh or a second code path can mutate `variants`. Use the functional updater and filter by `_id`.

### M5 — `getProductsByCategory` is dead code

See **D8**.

### M6 — `.gitignore` misses a bare `.env`

See **S3**.

### M7 — `RECORD_AUDIO` and the storage permissions are unused

See **S4**.

### M8 — iOS build config is incomplete

See **S5**.

---

# Verified vs. suspected

**Verified by reading the code (and, where noted, by execution):**
- Every endpoint path/method in `ProductService.ts` against `modifyPlan.md`, line by line.
- The five JSON-fallback branches (D1) and the resulting dual encoding of `existingImages` (D2).
- The `fileName`/`name` mismatch (D4) — grep confirms only four occurrences of `fileName` repo-wide, and both producers spell it `name`.
- `existingImages` collapsing to `undefined` on empty (D3).
- The absence of weight validation (C4) and of any image count/size/type check (D5, I5).
- The unrolled-back write sequence and the `isNew` flag never being cleared (C3).
- The duplicate `address` column (C1) — reproduced with `node:sqlite`: `duplicate column name: address` on a fresh database, no error when the table pre-exists. `git blame` attributes line 33 to `0984546`.
- `initDatabase` re-throwing (`entryDatabase.ts:173`) into an unawaited, uncaught call at `App.tsx:74`.
- The admin key's three commits and their reachability from `origin/main`; the key's presence in `dist/`'s Hermes bundles and sourcemaps; `dist/` being gitignored and untracked (`git ls-files dist` → 0 entries).
- `expo-image-picker` 17.0.10 exposing `fileSize`/`mimeType`, and `MediaTypeOptions` being marked deprecated.
- `tsc --noEmit` passing over all in-scope files.
- No `AbortController`, `signal:`, or timeout anywhere in `src/`.

**Suspected, not confirmed — requires the server repo or the repo settings:**
- Whether the JSON-fallback branches (D1) currently fail. This turns entirely on whether `express.json()` is mounted ahead of the admin routes. If it is, D1 is latent rather than live. I could not determine this from the client.
- How the server interprets an **absent** `existingImages` — keep-all or delete-all. Either way the client cannot express "keep none" (D3), but which specific wrong outcome the user sees depends on the server.
- Whether the server's error envelope uses `message` (D7). The spec documents `message` only for success responses; I inferred the error shape by analogy.
- Whether `https://github.com/aryanseth9795/asha_jwellers_admin.git` is public. Determining this requires a network request, which was out of scope for this audit — the owner should check directly, since it decides how urgent S1's rotation is.
- Whether Cloudinary or the server enforces a per-file size limit, which governs how I5 actually manifests.
