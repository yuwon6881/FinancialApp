# Capacitor release setup

FinancialApp uses the bundled Vite build in Capacitor. Android is the first store target; iOS shares the app contracts and follows as a separate device and store validation phase.

## Local Android build

Install Node 24, JDK 21, Android SDK Platform 36, Android Build Tools 36.0.0, and Platform Tools. Then run from the FinancialApp directory:

```sh
npm ci
npm run native:assets
npm run native:sync:android
cd android
./gradlew lintDebug testDebugUnitTest assembleDebug
```

The app id is `com.financialapp.app`. The native build reads `.env.native`, which points directly to the Cloud Run API. It omits the PWA service worker and keeps the app WebView on the local bundled assets.

For push on a real device, register `com.financialapp.app` in the Firebase project used by the API and place its `google-services.json` at `android/app/google-services.json` before syncing. Android 13 and later ask the user for notification permission at runtime.
An APK built without this file remains installable, but its notification switches explain that push is not configured. Android must never call Firebase Messaging registration from that APK: the plugin throws an uncaught native exception when no default Firebase app exists.

## Signing and Play internal test

Create an upload key and keep the keystore outside the repository. Set these environment variables before `./gradlew bundleRelease`:

```text
ANDROID_KEYSTORE_PATH=<absolute path to keystore>
ANDROID_KEY_ALIAS=<upload key alias>
ANDROID_KEYSTORE_PASSWORD=<keystore password>
ANDROID_KEY_PASSWORD=<key password>
```

Use a Play upload key for AAB signing. Separately obtain the **Play App Signing** certificate SHA-256 fingerprint after creating the Play app. Set it as `ANDROID_APP_SIGNING_CERT_SHA256` in Vercel and in GitHub Actions. The frontend build writes `.well-known/assetlinks.json` with that fingerprint; deploy it on `financialapp-ecru.vercel.app` so Android passkeys can verify the relying-party association. Configure the same fingerprint in the API as `WebAuthn__AndroidSigningCertificateSha256`. Do not substitute the upload certificate fingerprint for the Play app-signing fingerprint.
Passkey enrollment in a sideloaded debug APK also needs the certificate that signed **that APK** in both the hosted Digital Asset Links file and the API origin configuration. Use a separate test relying-party domain and API environment for debug certificates; do not publish a debug certificate as a production passkey association. The native app's local biometric or device-PIN launch gate can be tested with a saved session independently of passkey enrollment.

The Android workflow builds and uploads a debug APK on pushes and pull requests. Run it manually with Actions → Android → Run workflow to build a signed release AAB. Configure these GitHub Actions secrets first:

- `ANDROID_APP_SIGNING_CERT_SHA256`: Play App Signing certificate fingerprint, hexadecimal with or without colons.
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`, and `ANDROID_KEY_PASSWORD`: upload key material and credentials.
- `FIREBASE_ANDROID_CONFIG_BASE64`: base64 encoded Firebase `google-services.json` for package `com.financialapp.app`.

Install the AAB through Play internal testing and verify passkeys, device authentication, push delivery in foreground/background/terminated states, camera upload recovery, file sharing, offline resume, and Back behavior on supported Android devices. Automated APK/AAB builds do not verify Play signing, FCM delivery, or physical device behavior.

## iOS phase

Set `IOS_APPLE_TEAM_ID` in Vercel to publish `/.well-known/apple-app-site-association` for `ABCDE12345.com.financialapp.app`. The file is served as JSON without a `.json` suffix; replace the example Team ID with the value configured for the Apple App ID.

The checked-in iOS project has Associated Domains for `financialapp-ecru.vercel.app`, Face ID/device passcode authentication, task-snapshot privacy, Capacitor FCM registration, file sharing, and native passkeys. From macOS, run `npm run native:sync:ios` to build the native bundle and sync plugins. The sync step normalizes generated Swift package paths for cross-platform checkouts. Configure the Apple App ID with Associated Domains and Push Notifications; enable Firebase Messaging and APNs for the same bundle ID; add `GoogleService-Info.plist`; and use an Apple distribution profile with the matching entitlements. Build and archive with Xcode, then verify passkey association, Face ID/passcode fallback, foreground/background/terminated push routing, privacy cover, and file sharing on physical devices before store submission.
