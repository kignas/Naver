# Navereat

A fully static, demo-only Android app rebuilt from the original reference web UI.
It uses React 18, Vite, TypeScript, React Router, Framer Motion, plain CSS, and
Capacitor 6. There is no backend, no Firebase, no maps SDK, and no runtime
network access — fonts, icons, images, and data are all bundled locally.

## Run locally

```bash
cd navereat
npm install
npm run dev          # http://localhost:5173
```

Login is a demo: enter any 6–10 digit phone number and any 4–6 digit OTP.

Quality gates and audits:

```bash
npm run check        # tsc --noEmit + eslint
npm run build        # typecheck + production build
npm run scroll-check # every route + sheet at 390x844 and 360x640
npm run visual       # pixel diff against the original reference
npm run category-check # "What's on your mind?" filters Home in place (demo + api)
npm run perf-check        # cold start, CLS, transition FPS, bundle sizes
npm run perf-transitions  # three push transitions + pop, plus a frame strip
```

The production bundle is route-split: Home is eager, while Restaurant, Cart,
Orders, Tracking, Profile, Category, and ₹99 Store load on demand. Likely next
routes are preloaded during idle so the push animation starts with the target
chunk already available.

## Screens

- Login (demo phone + OTP)
- Home with categories, banners, 99 Store rail, restaurant list, cart bar
- Category results and Search
- Restaurant menu with veg/non-veg filters, ADD / quantity stepper
- Cart / checkout with bill, coupons, address, payment method
- Order success, Orders list, and live demo tracking (static map)
- ₹99 Store, Profile, and demo sub-actions

All app state is persisted in `localStorage` under the original keys
`nearbite_token`, `nearbite_cart`, and `nearbite_user` (plus `nearbite_orders`).

## Data source: demo or live API

Every page reads through one interface (`src/data/dataSource.ts`). The default
build is **demo**: bundled data, no network, and the pages render synchronously
exactly as before. A second implementation talks to the live customer API.

```bash
npm run build                              # demo (default)
VITE_DATA_SOURCE=api npm run dev           # live API
VITE_DATA_SOURCE=api VITE_API_FIXTURES=1 npm run build   # api mode, recorded responses, offline
```

In a debug build the field panel (7 taps on the version line in Profile) has a
**data demo / use api** switch that flips the same flag at runtime
(`localStorage.navereat_data_source`).

Wired to the API today: the home feed and category strip, the search overlay,
the restaurant page and its menu, and the ordering-closed gate. Cart pricing,
orders, profile, addresses and coupons still run on demo data; their methods
exist and are covered by the read-only pass. See
[`docs/DATA_SOURCE.md`](docs/DATA_SOURCE.md) for the interface, the error
contract, the cache keys, and how to add an endpoint, and
[`docs/API_VERIFICATION.md`](docs/API_VERIFICATION.md) for the live results and
the resolved open questions.

## Android

```bash
npm run android:prepare   # build web + npx cap sync android
npm run android:debug     # cd android && ./gradlew assembleDebug
```

The generated APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.
The `android/` folder is committed. Portrait only; the hardware back button runs
the pop transition and exits on Home. The status bar takes the colour of the
route header's top edge — Home's royal blue `#004AAD`, Login's yellow, ₹99
Store's `#B73950`, white elsewhere — with light or dark icons chosen by that
colour's contrast; the navigation bar stays white. Safe-area insets are applied
to the bottom nav, cart bar, and checkout footer.

The app icon and splash use a gold “N” on burgundy. Android disables overscroll
glow, text zoom, long-press selection outside inputs, and cleartext traffic.
Release builds enable R8 minification and resource shrinking.

Brand assets live in `assets/` and are regenerated with:

```bash
npm run assets   # sharp SVGs -> Android mipmaps + splash, then patch adaptive XML
```

## Performance and offline checks

`npm run perf-check` writes `../verify/perf-<label>.json` with cold-start time to
first Home paint, FCP, DOMContentLoaded, CLS, push/pop/sheet FPS, and bundle
sizes. The default run is unthrottled and **exits non-zero if push or pop is
below 55 fps**, if the covered page drifts from an identity transform/opacity on
any frame of a push or pop (`gate.outgoing`), if Home re-renders more than once
under a push, if tap → first painted frame exceeds 60 ms, or if tap → slide start
exceeds 200 ms at 1×. Use `PERF_RATE=4 npm run perf-check stress` for the 4x CPU
stress run. `npm run perf-transitions` measures Home → Restaurant → Cart →
Tracking and the pop back, and writes the seven-frame strip to
`../verify/frames/home-restaurant-strip.png`.

Measured in this workspace, same harness, before (`7382fe9`) and after:

| Transition | 1x before | 1x after | 4x before | 4x after |
| --- | --- | --- | --- | --- |
| Home → Restaurant | 49.4 fps / 66.7 ms | **60.0 / 16.8** | 11.6 fps / 333.3 ms | **52.5 / 50.0** |
| Restaurant → Cart | 52.9 fps / 33.4 ms | **60.0 / 16.8** | 20.0 fps / 200.0 ms | **60.0 / 16.8** |
| Cart → Tracking | 60.0 fps / 16.7 ms | **60.0 / 16.8** | 49.4 fps / 66.6 ms | **60.0 / 16.8** |
| Tracking → Cart (pop) | 60.0 fps / 16.8 ms | **60.0 / 16.8** | 60.0 fps / 16.7 ms | **60.0 / 16.8** |

The fix starts the slide only after the real lazy page (not the Suspense
fallback) has committed, its route CSS is parsed and enabled, its images are
decoded, and the hidden page has painted once. Speculative preloads are
serialized and paused during a slide, so a second route chunk cannot compile
mid-animation. The committed evidence strip is
[`docs/performance/transition-strip.png`](docs/performance/transition-strip.png).

All fonts, icons, placeholders, and demo data are bundled. In the default
(demo) build the only `http` strings in the entry bundle are SVG `xmlns`
declarations and the Font Awesome license comment, and no request is made at
runtime. Only the opt-in api build reaches `https://api.eatswada.com/api`. The
Android manifest requests no permissions and blocks cleartext traffic.

## Pinned Home search bar

The Home header is split into two blocks: `.hero-header` (location row + search
row) and `.hero-sheet` (hero banner + offer strip). `.hero-header` is
`position: sticky` with `top: calc(--pin-inset - --pin-top)`, so the location row
scrolls out of view and the search row stays pinned near the top of the viewport
for the whole feed — no scroll range limit, no per-frame layout, no clone.

* `--pin-top` is measured once per resize in `src/lib/scrollHeaderMotion.ts`
  (59 px at 390 and 360 wide: 8 px padding + 44 px location row + 7 px gap).
* `--pin-inset: 6px` keeps a strip of the header's own burgundy (`#5D0D18`, the
  status-bar colour) above the pinned search box: the row pins at y = 6 and the
  strip is the header surface itself, so there is no seam and no gap. It is a
  constant, so the transform-only compaction is unaffected.
* `--hp` (0–1 collapse progress) and `--hsy` (parallax shift) are written once
  per frame from the same passive scroll listener. They live on `:root`, not on
  the screen element, because a route transition freezes and restores every
  inline style inside the page.
* Only `transform`/`opacity` are animated (search box and VEG card compact to
  0.94/0.92 with `transform-origin: top`), so the header's flow height is the
  same at every scroll position. `prefers-reduced-motion` keeps the pin and
  drops the compaction and the parallax.
* `npm run sticky-check` scrolls with real touch gestures (CDP
  `Input.dispatchTouchEvent`, no `scrollTop` writes) at 390×844 and 360×640,
  checks the row's viewport rect at ~100/400/1500/3000, a fling, the search
  overlay open/close, Home → Restaurant → back and background/foreground, and
  fails on any layout shift or a moved bar. Screenshots and the JSON report go
  to `../verify/item12b/`.
* `node scripts/scroll0-diff.mjs <tag>` captures Home at scrollTop 0 so two
  builds can be pixel-diffed; the pinned bar build is pixel-identical to the
  previous build at rest (0 px at 390×844 and 360×640).

## Route motion: only the new page moves

A push slides the **incoming** page in from the right; the page it covers keeps
its identity transform and full opacity for the whole slide (no parallax, no
dim, no scale, no fade). A pop slides the dismissed page away and leaves the
page underneath exactly where it was. Tab switches stay instant.

* CSS in `src/styles/global.css`: `routePushIn` on `.is-enter` (420 ms) and
  `routePopOut` on `.is-leave` (360 ms), both on
  `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease-route`). `.tab-stack` never moves.
  Timings live in `src/styles/tokens.css` (`--dur-push`, `--dur-pop`).
* The sliding page casts a soft leading-edge `box-shadow`, scoped to
  `.route-stage.is-animating` so a page at rest carries no shadow paint.
* The slide only starts once the incoming page is mounted, laid out, its images
  decoded and painted — the layer is still `visibility: hidden` at that point
  (`settleIncoming` in `src/components/PageTransition.tsx`), so the first frame
  of the slide already shows the finished page and nothing swaps a skeleton
  mid-slide. `PUSH_READY_TIMEOUT` (600 ms) is only a safety net for a route that
  never reports ready.
* The page underneath is frozen (`layoutSnapshot`) and does not re-render on
  every frame of the slide (at 4× CPU the click's own React commit can land one
  frame late, which is the one extra commit the gate tolerates); `perf-check`
  fails if any covered layer's transform/opacity leaves identity on any frame of
  a push/pop, or if Home renders more than once under a push.
* Left-edge swipe-back moves only the top page; the page underneath is revealed
  in place.
* Budgets: tap → first painted frame ≤ 60 ms, tap → slide start ≤ 200 ms at 1×
  (content-first cost: mount + layout + decode), push/pop FPS ≥ 55.

### The floating nav and covered pages (Item 13)

* The nav never animates. A pushed page is opaque and, while it slides, paints
  over the nav (`.route-stage.has-detail.is-animating` is lifted above it), so
  the nav is simply covered; it is hidden without any transform only after
  `navereat:transition-end`, and it is shown again on the render that starts a
  pop, so the departing page reveals it. The lift is scoped to the animation, so
  sheets, the cart bar and the search overlay keep their stacking at rest.
* A covered tab page does no work: Home's rotating search placeholder lives in
  its own component (`SearchPlaceholderText`) and its timer is paused whenever
  Home is not the visible top route or a sheet/search overlay is open.
* `perf-check` asserts both: `navMovedDuringSlide === false` on push and pop,
  the nav visible during the slide and hidden after it on a push, and a covered
  Home with 0 renders, 0 DOM mutations and 0 style recalculations over 6 s.
* A hash-only history pop (Android hardware back, browser back) is recognised
  even when the router commits the new hash before the popstate handler runs:
  leaving a detail page for a tab route is always a pop, so the reverse slide
  runs instead of an instant swap.

### Tab bar: the measured look, the glyphs, the haptics (Item 19, part 1)

The bar is a white floating pill, 14 px from the sides and floating above the
bottom inset, with a 1 px grey-lilac hairline and a soft shadow. Its whole
geometry is a ratio table of the container height `H = 64dp`
(`--nav-h` in `src/styles/tokens.css`):

| part | ratio | value |
| --- | --- | --- |
| container height | H | 64 dp |
| side margin | — | 14 px |
| shadow | 0.10·H offset, 0.35·H blur, 10 % black | `0 6.4px 22.4px rgba(0,0,0,.10)` |
| active pill inset (top/bottom/sides) | 0.067·H | 4.3 px |
| icon box | 0.34·H | 22 dp |
| icon → label gap | 0.19·H | 12 dp |
| label size / weight | 0.205·H | 13 sp / 500 |

Both tabs always show an icon and a label, stacked and centred: the active one
on the charcoal pill (`#2A2A2E → #1E1E22`, 1 px inner highlight
`rgba(255,255,255,.18)`, white label), the idle one on white with a `#1C1C28`
label. Every colour is a `--nav-*` custom property on `.bottom-nav.nav-float`;
there is no backdrop filter.

* The two glyphs are original SVGs (`src/components/NavGlyph.tsx`), not brand
  assets: a house (coral→red gradient) and a bag/receipt (gold→amber with coral
  lines). Each glyph stacks an outline layer and a gradient layer, so the state
  change is an opacity cross-fade and nothing re-mounts.
* On a tab change the entering glyph pops (scale 0.7 → 1.12 → 1), the house
  roof lifts and settles, its door fades in, the bag body bounces and its handle
  swings; the leaving glyph shrinks through 0.85 and settles while the cross-fade
  turns it into its outline; the label fades and slides 6 px. All of it is
  `transform`/`opacity` on `transform-box: fill-box` groups over 420 ms, and
  `prefers-reduced-motion: reduce` drops every keyframe and transition, leaving
  the instant state swap.
* The sliding pill and drag-to-switch are unchanged: the indicator box is the
  tab slot minus `--nav-gap`, measured from the nav's padding box.
* `src/lib/haptics.ts` has one `HAPTICS_ENABLED` switch, a throttled (80 ms)
  `lightImpact()` that uses `@capacitor/haptics` natively and `navigator.vibrate`
  in a browser, and fails silently. It fires only on a user-initiated change to a
  *different* tab — a tap or a drag-snap commit — never on a programmatic route
  change, never on the already-active tab, and never on first paint. The debug
  panel shows the running impact count (`haptics N`).
* `@capacitor/haptics` is the only new dependency. Its Android manifest declares
  the same `android.permission.VIBRATE` the app already had, so the built APK's
  permission set is unchanged.
* `npm run nav-check` asserts the ratios above, the two-tone icon states, the
  haptic call counts (with `navigator.vibrate` mocked), the reduced-motion
  behaviour, and writes an 8-frame strip of each direction plus a side-by-side
  against a reference drawn from the same ratios to `verify/item19/`.

### Route stylesheets stay inside their own page (Item 13, follow-up)

* Route bundles are legacy global stylesheets: they carry a reset (`*`, `body`,
  `button`, `h1…h6`) and rules for other pages' class names. Two layers are
  mounted together for the whole slide, so enabling a bundle used to restyle the
  page underneath it. The cart bundle's `.res-name{font-size:20px!important}`
  won over the restaurant bundle's `28px` the moment the cart sheet turned on:
  the restaurant header shrank 9 px and its disclaimer footer moved with it,
  while the slide was still running (CLS 0.1505 with the footer on screen).
* The cross-page rules are gone from the cart bundle (they matched nothing in
  the cart page — verified by DOM query) and the back-button restyle now names
  only the cart's own `.ct-dh-back`.
* The restaurant page no longer renders its disclaimer footer while the menu is
  still being prepared: it was laid out under a short pane and then dropped when
  the groups arrived, a visible jump of the footer on the push into the route.
* Proof: every route is pixel-identical before and after (7 routes, 0 differing
  pixels), and no route sheet changes a single layout property of another
  page's elements (7 pages × 7 sheets, 0 leaks).

`npm run stress-walk` gates the exact path a user takes from a menu to the cart
in one scenario — `restaurant -> customise -> add -> cart` — at every font scale
and in the debug-panel context, and exits 0 at both 1× and 4× CPU.

`npm run route-motion-check` records real frames of Home → Restaurant and back,
writes 8-frame strips plus `route-motion.json` to `../verify/item12c/`, and
asserts all of the above. Measured at 1× in this workspace: push 420 ms / 59.4
fps, pop 361 ms / 61.0 fps, covered page identity on every sampled frame, tap →
first painted frame 23 ms.

## Layout-shift stress walk (Item 12D)

Real devices reported a page that "jumps sometimes" after navigation. The gate
for that class of bug is now CLS at 4× CPU, and a script that walks every route,
sheet and lifecycle event under stress.

* `npm run perf-check` measures the three content routes (Home → Restaurant →
  Cart → Tracking) a second time with `Emulation.setCPUThrottlingRate 4` and
  fails when any non-input layout shift there exceeds `PERF_CLS_BUDGET`
  (0.01). The result is `gate.maxTransitionCls4x`.
* `npm run stress-walk` (`scripts/stress-walk.mjs`) runs the whole app in
  Chromium at 390×844@2.75 with slow 3G (400 ms latency, 400 kbit/s) **and** 4×
  CPU throttling, for font scales 1, 1.15 and 1.3 (`STRESS_FONT_SCALES`). Each
  scenario measures only shifts that were *not* caused by the tap that started
  it. It covers: cold load of Home; tab switch; Home filter sheet; search
  overlay; Home → Restaurant; the customisation sheet; Restaurant → Cart; the
  coupon sheet; Cart → Tracking (checkout + order-success sheet); success →
  Tracking; Tracking → back; and background → foreground.
* A modal that animates its own exit is reported separately (`modal-exit`) and
  does not count, because nothing behind it moves.
* A shift in a page that has already been left is reported separately
  (`covered`) and does not count, under a documented assertion: the route stage
  is not animating, the top layer is opaque, untransformed and covers the
  viewport, and every source of the shift is either in a non-top layer or no
  longer in the document. Anything that moves on the visible page is attached
  and inside the top layer, so it still fails.
* A scenario that cannot run (a tap that never lands, a selector that times
  out) is a **failure**, not a skip: `[SKIPPED: …]` fails the gate with the
  error that caused it.
* Each journey runs **three** times per font scale (`STRESS_REPEAT`). The gate
  is per entry, not per average: **any single non-input shift above 0.01 in any
  pass fails**, and the failure line names the scenario, the entry value and the
  source selector. Per-scenario sums are still printed for context.
* The walk also asserts that the in-app debug panel itself is free: with
  `STRESS_DEBUG_PANEL` on (the default) one extra pass runs the same Home →
  Restaurant → ADD → CLOSE → CART sequence with `nbp-debug = '1'` and is gated
  like any other scenario. The panel mounts in its **own React root** on
  `document.body` (`DebugPanelRoot` in `src/App.tsx`), so its 500 ms stats
  updates and rAF loop cannot re-render or re-time the app it measures.
* Motion rule the gate enforces: the trip map animates the rider with CSS
  `transform` on a `<g>` (never SVG geometry attributes such as `d`, `cx` or
  `points`, which Chrome counts as layout), and the outgoing route layer is
  `visibility: hidden` once its slide ends (`.route-stage:not(.is-animating)
  .route-layer.is-leave`) so a page that is being torn down cannot move
  anything visible.
* Closing the customisation sheet uses its own `.ewcs-close` control, and the
  cart-bar tap falls back to adding one plain item when a completed checkout has
  emptied the cart. Without those two steps the rest of the pass — including the
  cart-entry scenario — was silently *skipped*, which is how the shift below
  stayed invisible.
* Output: `../verify/item12d/probe/stress-walk.{json,md}` — a table of
  *route/action | shifts > 0.001 | source selector and rects | fix*.
* `src/dev/StressDebugPanel.tsx` puts the same numbers on a real phone. It is
  off by default; **tap the version line at the bottom of Profile seven times**
  (within 4 s) to unlock it, `?debug=1` / `#/cart?debug=1` also work, and
  `localStorage['nbp-debug']` keeps it on across relaunches. It shows route,
  accumulated CLS with the worst entry, fps, dpr/visual viewport, open sheets and
  a scrolling event log: every non-input layout shift with its source selector
  and previous/current rects *captured at event time* (that is what isolated the
  shift below), frames over 50 ms, `body` class changes, route changes and
  viewport changes. **Copy log** / **Share** export a compact text report with
  UA, dpr, font scale and safe-area values. While it is enabled it also exposes
  `window.__nbpDebugEvents()` for harness runs; **Disable debug** clears the flag
  and unmounts it.

Two long-lived causes were removed while building this:

1. **The incoming page rendered its final state too late.** `PageTransition`
   now mounts the real page (never a skeleton), waits for `prefers`-safe
   fonts, and only starts the slide once the page height has been stable for two
   consecutive frames (≤ 200 ms). Home → Restaurant at 4× went from 0.068 to
   0.0000.
2. **Route stylesheets restyled pages that were already on screen.** Each
   bundle declares `:root` font tokens (`--ew-font-family`, `--ew-font-heading`
   …); attaching or detaching the sheet changed every element that used them, so
   text re-measured and shifted by 1–9 px. Those tokens are now declared once in
   `src/styles/tokens.css` with the bundles' own values, and every bundled face
   is primed before React renders (`src/lib/fonts.ts`), so no face arrives after
   the first paint.

### Cart entry: what is fixed and what is still open

Entering the cart **from the restaurant page right after closing the
customisation sheet** was producing one non-input shift of ~0.036 (≈9 px) about a
second after entry. In this round:

* **Fixed: text that re-wrapped under a fallback face.** The order-info card's
  secondary captions (`.ct-oi-sub`) had no width guard, so the contact row was
  two lines while a fallback face was in use and one line after the swap — a
  17.4 px change that pushed everything below it. They are now single-line with
  ellipsis, like the address row already was (`src/styles/pages/cart.css`).
* **Fixed: primed variation instances.** `fonts.ts` primed every declared face
  in 100-weight steps, but the pages use 550/650/750/850; an un-primed instance
  of a variable font is instantiated on demand, i.e. after paint. Priming now
  steps by 50 and lists the half weights.
* **Fixed: the veg mark changing size under the cart.** `.nb-veg-mark` is styled
  by both the restaurant and the cart bundles with different sizes, so the marks
  resized when the restaurant stylesheet detached; the cart now pins its own
  sizes with page scope. (Observed 13 → 12 px.)
* **Cart entry at font scale 1 is clean** after those fixes: three passes, three
  clean entries at 0.0000/0.00001. Font scale 1.15 keeps one marginal entry
  (0.0109, sources `h2#ct-cym-title` / `.ct-item-card` / `.ct-group-actions`)
  and 1.3 is clean.
* **What the 0.03598 entry looked like** (kept for the next round): the five
  source rects all moved up by exactly 9 px, `#cart-has-items` grew 9 px upward
  with its bottom pinned at the viewport edge, and the delivery header was a
  constant 68 px throughout. Hiding `#ct-meal` or `#ct-order-info` did not change
  the value. Reading sources a moment later found them detached (React re-created
  those rows in a re-render ~1 s after entry), so the next step is to tag the
  rows with stable `data-*` attributes and trace the state update.
* **Now visible because the gate is per entry** (these were hidden by the old
  "one pass only" rule): `pop: order success -> Tracking` reports 0.027–0.041
  from `section.map-stage svg rect` — the trip map animates SVG geometry
  attributes, which Chrome counts as layout; and the debug-panel pass reports
  0.15 with source `#menu-footer` when the outgoing restaurant layer unmounts.
  Both need a decision: animate the map with transforms instead of attributes,
  and/or teach the probe that a leaving layer's internal collapse is not a page
  shift (it is already excluded when a modal is open).

## Visual reference

The original reference frontend is kept outside this public repository as a
read-only reference, for example `/workspace/reference/`. Run the
screenshot comparison with:

```bash
ORIGINAL_DIR=/workspace/reference npm run visual
```

The script writes screenshots and diffs to `../verify/`; both `verify/` and
`reference/` are gitignored, as are copies of the original HTML/JS/CSS files.

## GitHub Actions

`.github/workflows/build-apk.yml` (repository root) runs on pushes to `main`
that touch `navereat/**`, and manually via **Actions → Build Navereat APK → Run
workflow**. It installs Node 22, Java 17, and the Android SDK, runs
`npm ci → npm run build → npx cap sync android → ./gradlew assembleDebug`,
uploads the `Navereat-debug-apk` artifact, and publishes a GitHub Release tagged
`v1.0.<run_number>` with the APK renamed to `Navereat.apk`.

Every CI build is signed with the committed debug keystore
`android/app/navereat-debug.keystore` (password `android`, alias `navereat`), so
a new APK installs over the previous build. It is debug-only and must never be
used for a Play Store release. `versionName` is `1.0.0`; `versionCode` is the
Actions run number. The workflow runs `apksigner verify --print-certs` and
prints the signing certificate SHA-256 fingerprint.

`.github/workflows/perf.yml` runs the unthrottled push/pop FPS gate on pushes
and pull requests that touch `navereat/**`, using a downloaded Chromium and
uploading `verify/perf-ci.json` as the `Navereat-perf` artifact.

## Download

GitHub → **Releases** → open the latest `v1.0.*` release → download
**`Navereat.apk`**.

## Notes

- App id `com.navereat.app`; app name **Navereat**.
- The Android manifest requests no permissions, so the app cannot make network
  calls even by accident.
- Old pages and the old static site are kept only as a visual reference and are
  not part of this app.
