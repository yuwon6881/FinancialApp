# App permissions

The native apps gather every permission FinancialApp can use into one sheet, **App permissions**.

## When it appears

- Once per installation, unprompted, shortly after the first signed-in screen paints. By then sign-in, the
  new-account security questions and the account setup gate have all finished, because the sheet lives
  inside the signed-in shell. It also waits while the app is locked or the privacy check is pending,
  and while a cycle summary, pending bills, failed syncs, search, Ask AI, quick add, the transaction
  form or the reveal prompt is open.
- Closing it any way (Not now, Close, Done, Escape, swipe) records the first showing in
  `localStorage` (`financialapp.permissionSetup.v1`), so it is not offered unprompted again on that
  installation, whichever account signs in next.
- Any time from **Settings → App permissions → Manage permissions**.
- The web app has no sheet; the browser asks for each permission at the moment a feature needs it.

## Rows

| Row | Platform | What Allow does |
| --- | --- | --- |
| Notifications | Android, iOS | Asks for the system notification permission and enrols this installation for bill reminders and category spending alerts. Blocked: opens the app's notification settings (Android). |
| Camera | Android, iOS | Asks for the camera permission. Android reports Allowed without asking: the manifest declares no `CAMERA` permission, so receipt photos go through the system camera app. |
| Transaction detection | Android | Shows the existing consent sheet, then opens Android's notification-access page, then the source-app picker. Requires financial data to be revealed, as in Settings. |
| Keep detection running | Android | Optional, shown once detection is on. Opens App info for the Unrestricted battery setting. |

**Allow all** runs the system dialogs for every row still to allow, then stops at the detection consent
for the user to read; it never agrees on their behalf. Rows return to their real state whenever the app
comes back from system settings.
