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

Login accepts any 6–10 digit phone number and any 4–6 digit OTP.

```bash
npm run check            # tsc --noEmit + eslint
npm run build            # typecheck + production build
npm run visual           # pixel diff against the reference copy
npm run scroll-check     # route and sheet scroll audit
npm run perf-check       # cold start, CLS, transition FPS, bundle sizes
npm run android:prepare  # build + npx cap sync android
npm run android:debug    # assemble the debug APK
```

## Visual reference / screenshot diff

The original reference frontend is **not** part of this public repo and must
never be committed here. Keep a read-only copy outside the repository, for
example at `/workspace/reference/`, then run:

```bash
cd navereat
ORIGINAL_DIR=/workspace/reference npm run visual
```

`scripts/visual-check.ts` serves the original pages from `ORIGINAL_DIR` and
compares them against the app at 360px, 390px and 430px. Screenshots and diff
images are written to `verify/`, which is gitignored along with `reference/`
and copies of the original HTML/JS/CSS files.

## CI

`.github/workflows/build-apk.yml` builds the debug APK on every push to `main`
that touches `navereat/**`, and on manual dispatch. It publishes a release
tagged `v1.0.<run_number>` with the APK renamed to `Navereat.apk`.
README/docs-only pushes are ignored by `paths-ignore`.

Every CI build uses one fixed debug keystore so a new APK installs over the
previous build. The keystore is supplied through repository secrets:

| Secret | Purpose |
| --- | --- |
| `KEYSTORE_BASE64` | base64 of `navereat-debug.keystore` |
| `KEYSTORE_PASSWORD` | keystore password |
| `KEY_ALIAS` | key alias (`navereat`) |
| `KEY_PASSWORD` | key password |

The keystore is never committed. Local signing material is written to
`.secrets/`, which is gitignored.

`versionName` is `1.0.0`; `versionCode` is the GitHub Actions run number.
