// Exact user-facing copy for the push notification feature. Centralized so the Settings rows,
// the Recurring card editor, and their tests all reference the same source of truth.
// The two kinds are separate settings, each opted into on the device you are holding. Neither
// description mentions the other, and neither promises anything about your other devices.
export const BILL_REMINDER_PUSH_TITLE = 'Bill reminders'
export const BILL_REMINDER_PUSH_DESCRIPTION =
  'A reminder before each bill is due, even when this app is closed.'

export const CATEGORY_LIMIT_PUSH_TITLE = 'Category spending alerts'
export const CATEGORY_LIMIT_PUSH_DESCRIPTION =
  'A heads-up as a category nears, then reaches, your planned amount.'

// Shown under a switch that is off here while another device has that same kind on. It is a
// statement about the other device, never about this one -- the switch beside it stays off,
// because nothing will arrive here until it is turned on here.
export const otherDevicesHaveItOn = (kind: string): string =>
  `${kind} are on for another of your devices. Turn this on to get them here too.`

export const PUSH_DENIED_GUIDANCE =
  'Notifications are blocked for this site. Allow notifications for this app in your browser settings, then try again.'

export const PUSH_UNSUPPORTED_GUIDANCE =
  'Push notifications are not supported in this browser or app. Try a supported desktop or Android browser.'

// Shown when this deployment carries no Firebase/VAPID configuration at all. The browser is fine
// and there is nothing for the user to change, so this one does not send them looking.
export const PUSH_NOT_CONFIGURED_GUIDANCE =
  'Push notifications are not set up for this app yet, so there is nothing to turn on here.'

// The browser can do push and notifications are allowed, but it refused to register this device
// with its own push service. Brave -- and other Chromium browsers carrying the same privacy
// setting -- keep that off, which is why an install that used to work can stop after a browser
// update with permission still granted. Naming the setting is the whole value of this message.
export const PUSH_SERVICE_BLOCKED_GUIDANCE =
  'This browser would not register this device for notifications. Brave and similar browsers keep '
  + '"Use Google services for push messaging" switched off in their privacy settings; switch it on, '
  + 'restart the browser, then try again.'

// Firebase keeps this device's notification registration in local site storage. Blocked cookies
// and site data, or a private window, look exactly like an unsupported browser from the inside.
export const PUSH_STORAGE_BLOCKED_GUIDANCE =
  'Notifications need this app to be allowed to store data on this device. Allow cookies and site '
  + 'data for this app, leave private browsing, then try again.'

export const PUSH_OFFLINE_GUIDANCE =
  'This device could not reach the notification service. Check your connection, then try again.'

// Last resort. It deliberately does not blame the browser -- the reasons above are the only ones
// entitled to -- and carries the underlying code so a report about it can be acted on.
export const pushUnknownFailureGuidance = (detail?: string): string =>
  'Notifications could not be set up on this device just now. Please try again.'
  + (detail ? ` (reason: ${detail})` : '')

// Shown after this device is dropped because the browser no longer allows notifications. The
// server said the device was registered, so silently leaving the switch on would have promised
// alerts that can never arrive.
export const PUSH_PERMISSION_REVOKED_GUIDANCE =
  'This device stopped receiving notifications because your browser no longer allows them. Allow notifications for this app, then turn this back on.'

// Shown when the devices roster could not be read. It used to fail into the "no device is set up"
// empty state, which is a different and confidently wrong answer -- it reads as proof that the
// switch above did nothing.
export const PUSH_DEVICES_UNAVAILABLE =
  'The list of devices could not be loaded. This does not change what your devices receive.'

export const RECURRING_PAUSED_LABEL = 'Paused—no device is set up to receive bill reminders'

// A bill reminder is delivered to every device opted into bill reminders, so "on" and "on here"
// are different answers. Saying only "active" on a phone that will never ring is the more
// misleading one.
export const RECURRING_OTHER_DEVICES_ONLY_LABEL =
  'On your other devices—this one is not set up to receive bill reminders'
