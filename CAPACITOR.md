# Native app (Capacitor)

The existing React/Vite PWA is wrapped as a native Android app with
[Capacitor](https://capacitorjs.com). The same web codebase powers both the
PWA and the native app — native-only behaviour is guarded by
`Capacitor.isNativePlatform()` (see `src/lib/native.ts`), so the web build is
unaffected.

## Why
Fixes two PWA-on-Android pain points at the OS level instead of working around
them in the browser:
- **Launch flash** → a real native splash screen (obsidian `#0a0d14`), hidden
  only once React has painted (`hideSplash()` in `App.tsx`).
- **Keyboard jitter** → the native Keyboard plugin (`resize: 'native'`) resizes
  the WebView for the keyboard; no JS/CSS keyboard tracking on our side.

## Prerequisites
- Android Studio (with an SDK + an emulator or a device in USB-debug mode).
- JDK 17+ (bundled with recent Android Studio).

## Build & run
```bash
# Point the build at the PRODUCTION api (native apps can't reach localhost).
# Must be HTTPS — Android blocks cleartext HTTP by default.
VITE_API_URL="https://your-api.example.com/api" npm run build

npm run cap:android   # builds web, syncs, opens Android Studio
# then press Run ▶ in Android Studio (or `npm run cap:run` with a device attached)
```

Day-to-day after web changes: `npm run cap:sync` (rebuilds web + copies into
the native project).

## App identity
- appId: `net.ogglobal.financialapp`
- appName: `FinancialApp`
- config: `capacitor.config.ts`

## Still to do (polish)
- **App icon & splash image**: generate from a source logo with
  `npm i -D @capacitor/assets` then `npx capacitor-assets generate`.
  The splash *background* is already obsidian, so there's no white flash even
  before a splash image is added.
- **iOS**: `npx cap add ios` (needs a Mac + Xcode) — the web code is shared.
- **Release signing**: configure a keystore in Android Studio to produce a
  signed AAB for the Play Store.

## Note
`android/` is committed (native project + config). Build artifacts
(`.gradle/`, `build/`, `local.properties`, `*.apk/*.aab`) are gitignored.
