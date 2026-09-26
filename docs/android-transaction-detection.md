# Android transaction detection

This feature is optional and local to a FinancialApp account on an Android installation. Enable it in Settings → Transaction detection, choose banking/wallet apps, and explicitly grant Android notification access. Review alerts also require FinancialApp notification permission. Android may require **Allow restricted settings** in the app's Android App info menu for sideloaded APKs before notification access can be granted.

Android grants access to the listener as a whole; the source selection is enforced by FinancialApp before notification content is inspected. The first parser recognizes conservative English purchase/payment confirmations and explicit RM/MYR/USD/EUR/GBP/SGD amounts. It does not guarantee support for every selected app or language. Ambiguous amounts, currencies, merchant names, and dates stay absent. Requests, declines, OTPs, incoming payments, refunds, and transfers are excluded.

The Android listener stores candidates using Android Keystore AES-GCM and an atomic file in the app's no-backup directory. No notification stream is uploaded. The local review notification contains generic copy and a candidate ID, not financial details. Capture pauses on sign-out and retains candidates for their originating account. The explicit local-data wipe removes captures. Up to 200 pending candidates are retained; completed notification identities are retained for 30 days with a bounded store.

Tapping a review notification waits for the existing native/session gates and sensitive-mode reveal, then opens the Ledger form. Category and description AI requests run only in authenticated review and offer choices, never automatic assignments. Foreign/unknown-currency amounts require explicit entry in the account currency. Closing preserves review edits. Dismissing an Android notification does not discard its candidate; use Ledger → Detected transactions to review or explicitly discard it.

Approved purchases use a native write-ahead approval and a stable transaction UUID. The outbox must persist before capture completion. Interrupted approvals resume after unlock using the original payload/UUID; the API's existing create-by-ID idempotency prevents duplicate transactions. The initial capture form does not attach receipts; documents can be added later using normal Ledger editing.

## Verification

- Frontend: `npm run lint`, `npm run check:design-system`, `npm run typecheck:strict`, `npm run deadcode`, `npm test -- --maxWorkers=4`, `npm run build`, `npm run test:visual`.
- Native: `npm run native:sync:android`, then `android/gradlew lintDebug testDebugUnitTest assembleDebug` with Java 21 and SDK 36.
- Browser native-bridge simulations verify the shipped review/settings UI, but do not establish handset notification delivery or provider coverage.
- Handset acceptance: upgrade the stable-signed APK; grant access; compare selected/unselected app alerts; test foreground/background/cold-start taps, unlock cancellation, sensitive mode, offline editing/saving, dismissal, duplicate alerts, permission revocation, reboot, sign-out/account switching, and source formats from real banks/wallets.

The GitHub Android workflow bundles the native web app, syncs Capacitor, runs Android checks, and publishes the stable-signed device-test APK as an Actions artifact. Downloadable GitHub release assets must come from that workflow's exact commit rather than a locally signed debug build.
