import type { RecurringPayment } from '../types'
import { normalizeRecurringFrequency } from './recurringPayments'

/**
 * Bill reminders: schedules OS-level local notifications a few days before each
 * upcoming recurring payment is due.
 *
 * The occurrence math (`computeUpcomingReminders`) is pure and unit-tested; the
 * scheduling side (`syncBillReminders`) talks to `@capacitor/local-notifications`
 * via a dynamic import so the plugin stays out of the main bundle and every call
 * degrades to a no-op when the plugin/permission is unavailable (plain desktop
 * browser, permission denied, etc.) — mirroring the resilient pattern in
 * `lib/haptics.ts`.
 *
 * Amounts are intentionally omitted from the notification body: reminders surface
 * on the lock screen, so leaking the value would defeat the app's sensitive mode.
 */

const TRACKED_IDS_KEY = 'bill_reminder_ids'
const DAY_MS = 24 * 60 * 60 * 1000

export interface BillReminderOptions {
  /** "Now" — injectable for tests. Defaults to the current time. */
  now?: Date
  /** How far ahead to schedule reminders. */
  horizonDays?: number
  /** How many days before the due date to fire the reminder. */
  leadDays?: number
  /** Local hour of day (0-23) to fire at. */
  hour?: number
}

export interface ComputedReminder {
  paymentId: string
  name: string
  dueDate: Date
  fireAt: Date
  notificationId: number
  title: string
  body: string
}

export type BillReminderPermission = 'granted' | 'denied' | 'unavailable'

export interface BillReminderSyncResult {
  permission: BillReminderPermission
  scheduled: number
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate()
}

function parseYmd(value?: string | null): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

function ymdKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

// Stable positive 31-bit id derived from the payment + occurrence date (djb2), so
// rescheduling the same occurrence reuses the same OS notification slot instead of
// stacking duplicates.
function reminderId(paymentId: string, dueKey: string): number {
  const source = `${paymentId}|${dueKey}`
  let hash = 5381
  for (let i = 0; i < source.length; i++) {
    hash = (((hash << 5) + hash) + source.charCodeAt(i)) | 0
  }
  return (Math.abs(hash) % 2_000_000_000) + 1
}

function monthlyDueDates(dom: number, hour: number, now: Date, horizonEnd: Date): Date[] {
  const result: Date[] = []
  const maxOffset = Math.ceil((horizonEnd.getTime() - now.getTime()) / DAY_MS / 28) + 2
  for (let offset = 0; offset <= maxOffset; offset++) {
    const anchor = new Date(now.getFullYear(), now.getMonth() + offset, 1)
    const day = Math.min(dom, daysInMonth(anchor.getFullYear(), anchor.getMonth()))
    const due = new Date(anchor.getFullYear(), anchor.getMonth(), day, hour, 0, 0, 0)
    if (due >= now && due <= horizonEnd) result.push(due)
  }
  return result
}

function annualDueDates(start: Date, dom: number, hour: number, now: Date, horizonEnd: Date): Date[] {
  const result: Date[] = []
  const monthIndex = start.getMonth()
  for (let year = now.getFullYear(); year <= horizonEnd.getFullYear(); year++) {
    const day = Math.min(dom, daysInMonth(year, monthIndex))
    const due = new Date(year, monthIndex, day, hour, 0, 0, 0)
    if (due >= now && due <= horizonEnd) result.push(due)
  }
  return result
}

/**
 * Pure: given the recurring payments, returns the reminders that should be
 * scheduled between now and the horizon, ordered by when they fire.
 */
export function computeUpcomingReminders(
  payments: RecurringPayment[],
  options: BillReminderOptions = {},
): ComputedReminder[] {
  const now = options.now ?? new Date()
  const horizonDays = options.horizonDays ?? 62
  const leadDays = options.leadDays ?? 2
  const hour = options.hour ?? 9
  const horizonEnd = new Date(now.getTime() + horizonDays * DAY_MS)

  const reminders: ComputedReminder[] = []

  for (const payment of payments) {
    if (!payment.active || payment.isPendingDelete) continue
    const start = parseYmd(payment.startDate)
    if (!start) continue
    const end = parseYmd(payment.endDate)
    const endOfEndDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59) : null
    const dom = Math.min(Math.max(Math.trunc(payment.dueDate) || 1, 1), 31)

    const dueDates = normalizeRecurringFrequency(payment.frequency) === 'Annually'
      ? annualDueDates(start, dom, hour, now, horizonEnd)
      : monthlyDueDates(dom, hour, now, horizonEnd)

    for (const due of dueDates) {
      if (due < start) continue
      if (endOfEndDay && due > endOfEndDay) continue

      let fireAt = new Date(due.getTime() - leadDays * DAY_MS)
      if (fireAt <= now) fireAt = due
      if (fireAt <= now) continue

      const dueLabel = due.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
      reminders.push({
        paymentId: payment.id,
        name: payment.name,
        dueDate: due,
        fireAt,
        notificationId: reminderId(payment.id, ymdKey(due)),
        title: `Upcoming bill: ${payment.name}`,
        body: `${payment.name} is due ${dueLabel}.`,
      })
    }
  }

  reminders.sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime())
  return reminders
}

function readTrackedIds(): number[] {
  try {
    const raw = localStorage.getItem(TRACKED_IDS_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is number => typeof id === 'number') : []
  } catch {
    return []
  }
}

function writeTrackedIds(ids: number[]): void {
  try {
    localStorage.setItem(TRACKED_IDS_KEY, JSON.stringify(ids))
  } catch {
    /* storage full / unavailable — ignore, worst case a stale reminder lingers */
  }
}

type LocalNotificationsPlugin = typeof import('@capacitor/local-notifications')['LocalNotifications']

async function cancelTracked(plugin: LocalNotificationsPlugin): Promise<void> {
  const ids = readTrackedIds()
  if (ids.length > 0) {
    await plugin.cancel({ notifications: ids.map(id => ({ id })) })
  }
  writeTrackedIds([])
}

/**
 * Requests the OS notification permission without scheduling anything. Used by the
 * settings toggle so it can gate enabling the feature on an explicit grant.
 */
export async function requestBillReminderPermission(): Promise<BillReminderPermission> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    let status = await LocalNotifications.checkPermissions()
    if (status.display !== 'granted') {
      status = await LocalNotifications.requestPermissions()
    }
    return status.display === 'granted' ? 'granted' : 'denied'
  } catch {
    return 'unavailable'
  }
}

/**
 * Cancels any previously scheduled bill reminders and reschedules the current set.
 * Safe to call repeatedly; a no-op when notifications are unavailable/denied.
 */
export async function syncBillReminders(
  payments: RecurringPayment[],
  options: BillReminderOptions = {},
): Promise<BillReminderSyncResult> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')

    let status = await LocalNotifications.checkPermissions()
    if (status.display !== 'granted') {
      status = await LocalNotifications.requestPermissions()
    }
    if (status.display !== 'granted') {
      await cancelTracked(LocalNotifications)
      return { permission: 'denied', scheduled: 0 }
    }

    await cancelTracked(LocalNotifications)

    const reminders = computeUpcomingReminders(payments, options)
    if (reminders.length > 0) {
      await LocalNotifications.schedule({
        notifications: reminders.map(reminder => ({
          id: reminder.notificationId,
          title: reminder.title,
          body: reminder.body,
          schedule: { at: reminder.fireAt, allowWhileIdle: true },
        })),
      })
      writeTrackedIds(reminders.map(reminder => reminder.notificationId))
    }

    return { permission: 'granted', scheduled: reminders.length }
  } catch (error) {
    console.warn('Bill reminders are unavailable on this device.', error)
    return { permission: 'unavailable', scheduled: 0 }
  }
}

/** Cancels every scheduled bill reminder (used when the feature is turned off). */
export async function cancelAllBillReminders(): Promise<void> {
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await cancelTracked(LocalNotifications)
  } catch {
    /* plugin unavailable — nothing to cancel */
  }
}
