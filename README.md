# Navereat

A fully static, demo-only Android app built with React 18, Vite, TypeScript,
Framer Motion, and Capacitor 6. No backend, no Firebase, no maps SDK, and no
runtime network calls — fonts, icons, images, and demo data are bundled locally.

The app source is in [`navereat/`](navereat/).

## Download the APK

GitHub → **Releases** → open the latest `v1.0.*` release → download
**`Navereat.apk`**.

The same APK is attached to each workflow run as the `Navereat-debug-apk`
artifact under **Actions → Build Navereat APK**.

## Run locally

```bash
cd navereat
npm install
npm run dev
```

Login accepts any 10-digit phone number and any 4–6 digit OTP.

```bash
npm run check          # tsc --noEmit + eslint
npm run build          # typecheck + production build
npm run android:prepare
npm run android:debug
```

## CI

`.github/workflows/build-apk.yml` builds the debug APK on every push to `main`
that touches `navereat/**`, and on manual dispatch. It publishes a release
tagged `v1.0.<run_number>` with the APK renamed to `Navereat.apk`.
