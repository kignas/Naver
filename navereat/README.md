# Navereat

A fully static, demo-only Android app rebuilt from the original Nearbite web UI.
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
below 55 fps**. Use `PERF_RATE=4 npm run perf-check stress` for the 4x CPU
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

## Visual reference

The original Eatswada frontend is kept outside this public repository as a
read-only reference, for example `/workspace/reference/Nearbite-main/`. Run the
screenshot comparison with:

```bash
ORIGINAL_DIR=/workspace/reference/Nearbite-main npm run visual
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

The APK is debug-signed, so it installs directly on a phone. A commented
signed-release section is included in the workflow for later use.

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
