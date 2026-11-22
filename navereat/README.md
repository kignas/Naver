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

Quality gates:

```bash
npm run check        # tsc --noEmit + eslint
npm run build        # typecheck + production build
```

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
the pop transition and exits on Home. Status bar is white with dark icons and
the layout respects safe-area insets.

Brand assets live in `assets/` and are regenerated with:

```bash
npm run assets
```

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

## Download

GitHub → **Releases** → open the latest `v1.0.*` release → download
**`Navereat.apk`**.

## Notes

- App id `com.navereat.app`; app name **Navereat**.
- The Android manifest requests no permissions, so the app cannot make network
  calls even by accident.
- Old pages and the old static site are kept only as a visual reference and are
  not part of this app.
