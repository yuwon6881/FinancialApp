import type { PushChannel } from '../../types'

/**
 * This browser's record of which notification kinds the user switched on here, per account.
 *
 * The server row is the authoritative state, so this is not a second opinion — it is the *repair
 * key*. Two situations need it:
 *
 *  - An install whose subscription row was disabled by the old sign-out behaviour (logout used to
 *    unregister this device). Its row says "not registered" and no amount of refreshing will fix
 *    that, because the server cannot know the difference between a device that was signed out and
 *    a device whose user deliberately turned notifications off.
 *  - A token rotation on a device that is already opted in: re-registering must resend the same
 *    two choices, not guess them.
 *
 * `Notification.permission === 'granted'` alone cannot answer either: permission is granted per
 * origin, so it stays granted after the user turns every kind off, and re-enrolling on that basis
 * would resurrect a setting the user just switched off.
 *
 * Scoped by account because a shared browser must not re-register account B against the kinds
 * account A chose. Cleared for that account only when the user turns everything off here.
 */
const STORAGE_KEY_PREFIX = 'push_channel_intent:'

export interface PushChannelIntent {
  billReminders: boolean
  categoryAlerts: boolean
}

const NO_INTENT: PushChannelIntent = { billReminders: false, categoryAlerts: false }

function storageKey(account: string): string {
  return `${STORAGE_KEY_PREFIX}${account.trim().toUpperCase()}`
}

export function readPushChannelIntent(account: string | null | undefined): PushChannelIntent {
  if (!account?.trim()) return NO_INTENT
  try {
    const raw = localStorage.getItem(storageKey(account))
    if (!raw) return NO_INTENT
    const parsed = JSON.parse(raw) as Partial<PushChannelIntent>
    return {
      billReminders: parsed.billReminders === true,
      categoryAlerts: parsed.categoryAlerts === true,
    }
  } catch {
    // Unreadable or malformed storage costs the repair path, never the feature: the server row
    // still decides what is on.
    return NO_INTENT
  }
}

export function writePushChannelIntent(account: string | null | undefined, intent: PushChannelIntent): void {
  if (!account?.trim()) return
  try {
    if (!intent.billReminders && !intent.categoryAlerts) {
      localStorage.removeItem(storageKey(account))
      return
    }
    localStorage.setItem(storageKey(account), JSON.stringify(intent))
  } catch {
    // Non-fatal: without the marker the user re-taps the switch after a sign-out, which is the
    // behaviour this file exists to remove rather than a broken state.
  }
}

export function hasPushChannelIntent(intent: PushChannelIntent): boolean {
  return intent.billReminders || intent.categoryAlerts
}

export function withChannel(
  intent: PushChannelIntent,
  channel: PushChannel,
  enabled: boolean,
): PushChannelIntent {
  return channel === 'billReminders'
    ? { ...intent, billReminders: enabled }
    : { ...intent, categoryAlerts: enabled }
}
