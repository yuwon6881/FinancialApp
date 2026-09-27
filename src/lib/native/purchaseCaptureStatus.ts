import type { CaptureState } from './purchaseCapture'

export interface CaptureStatus {
  /** Short badge word. */
  label: string
  /** One plain sentence explaining what the device is doing. */
  detail: string
  tone: 'neutral' | 'warning' | 'success'
  listening: boolean
}

/** One reading of the device setup, shared by the Settings card, the setup sheet and tests. */
export function purchaseCaptureStatus(state: CaptureState | null): CaptureStatus {
  if (!state) return { label: 'Checking', detail: 'Checking this device’s setup…', tone: 'neutral', listening: false }
  if (!state.enabled) return { label: 'Off', detail: 'Payment alerts on this phone are not read.', tone: 'neutral', listening: false }
  if (!state.access) return { label: 'Setup needed', detail: 'Not listening yet — allow notification access in Android settings.', tone: 'warning', listening: false }
  if (!state.packages.length) return { label: 'Setup needed', detail: 'Not listening yet — choose the banking or wallet apps to read.', tone: 'warning', listening: false }
  const apps = `${state.packages.length} ${state.packages.length === 1 ? 'app' : 'apps'}`
  if (!state.notifications) return { label: 'Listening', detail: `Reading alerts from ${apps}. Review alerts are off, so check Ledger for new items.`, tone: 'success', listening: true }
  return { label: 'Listening', detail: `Reading alerts from ${apps}. You’ll get a private alert to review each one.`, tone: 'success', listening: true }
}

const DAY = 24 * 60 * 60 * 1000

/** "Today, 3:45 pm", "Yesterday, 9:02 am" or "27 Sep, 3:45 pm" — the alert's arrival, in local time. */
export function formatAlertTime(capturedAt: number, now: number = Date.now()): string {
  if (!Number.isFinite(capturedAt) || capturedAt <= 0) return 'Time unknown'
  const at = new Date(capturedAt)
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  if (capturedAt >= startOfToday.getTime()) return `Today, ${time}`
  if (capturedAt >= startOfToday.getTime() - DAY) return `Yesterday, ${time}`
  const sameYear = at.getFullYear() === startOfToday.getFullYear()
  const day = at.toLocaleDateString(undefined, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
  return `${day}, ${time}`
}
