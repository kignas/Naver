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

## Android

```bash
npm run android:prepare   # build web + npx cap sync android
npm run android:debug     # cd android && ./gradlew assembleDebug
```

The generated APK is at `android/app/build/outputs/apk/debug/app-debug.apk`.
The `android/` folder is committed. Portrait only; the hardware back button runs
the pop transition and exits on Home. The status bar is burgundy with light icons
on themed pages (Home, Login, Orders, Restaurant) and white with dark icons
elsewhere; the navigation bar stays white. Safe-area insets are applied to the
bottom nav, cart bar, and checkout footer.

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

All fonts, icons, placeholders, and demo data are bundled. The only `http`
strings in `src/` are SVG `xmlns` declarations and the Font Awesome license
comment; no request is made at runtime. The Android manifest requests no
permissions and blocks cleartext traffic.

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

`npm run route-motion-check` records real frames of Home → Restaurant and back,
writes 8-frame strips plus `route-motion.json` to `../verify/item12c/`, and
asserts all of the above. Measured at 1× in this workspace: push 420 ms / 59.4
fps, pop 361 ms / 61.0 fps, covered page identity on every sampled frame, tap →
first painted frame 23 ms.

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
