// Exact user-facing copy for the push notification feature. Centralized so the Settings rows,
// the Recurring card editor, and their tests all reference the same source of truth.
export const NOTIFY_ON_LOGIN_DESCRIPTION = 'Show unpaid-bill alerts when you open the app.'

export const PUSH_DESCRIPTION =
  'Let this device show bill reminders and spending alerts, even when the app is closed.'

export const CATEGORY_LIMIT_PUSH_DESCRIPTION =
  'A heads-up as a category nears what you planned, and again when it gets there.'

export const PUSH_DENIED_GUIDANCE =
  'Notifications are blocked for this site. Allow notifications for this app in your browser settings, then try again.'

export const PUSH_UNSUPPORTED_GUIDANCE =
  'Push notifications are not supported in this browser or app. Try a supported desktop or Android browser.'

export const PUSH_ENABLED_ELSEWHERE_MESSAGE =
  'Push notifications are already enabled on another device. Enable them here to also receive alerts on this device.'

// Shown after this device is dropped because the browser no longer allows notifications. The
// server said the device was registered, so silently leaving the switch on would have promised
// alerts that can never arrive.
export const PUSH_PERMISSION_REVOKED_GUIDANCE =
  'This device stopped receiving notifications because your browser no longer allows them. Allow notifications for this app, then turn this back on.'

export const CATEGORY_ALERTS_NEED_DEVICE =
  'Turn on notifications for this device first. Spending alerts go to every device you turn on.'

// Scope chips. Which devices a switch applies to is the single most confusing thing about this
// panel, so every row states it rather than leaving it to be inferred from the wording.
export const SCOPE_THIS_DEVICE = 'This device'
export const SCOPE_ALL_DEVICES = 'All devices'

export const RECURRING_PAUSED_LABEL = 'Paused—no device is set up to receive notifications'

// A bill reminder is delivered to every enabled device, so "on" and "on here" are different
// answers. Saying only "active" on a phone that will never ring is the more misleading one.
export const RECURRING_OTHER_DEVICES_ONLY_LABEL =
  'On your other devices—this one is not set up to receive notifications'
