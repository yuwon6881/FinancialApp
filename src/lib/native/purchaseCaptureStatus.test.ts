import { describe, expect, it } from 'vitest'
import { formatAlertTime, purchaseCaptureStatus } from './purchaseCaptureStatus'

const ready = { enabled: true, access: true, listenerConnected: true, packages: ['bank'], notifications: true, candidates: [] }

describe('purchase capture status', () => {
  it('reports stalled recovery even when every setup permission is complete', () => {
    expect(purchaseCaptureStatus({ ...ready, batteryUnrestricted: true, listenerConnected: false, listenerRecovery: 'stalled' }))
      .toMatchObject({ label: 'Not listening', listening: false, tone: 'warning', detail: expect.stringContaining('off and back on') })
    expect(purchaseCaptureStatus({ ...ready, listenerRecovery: 'stalled' })).toMatchObject({ label: 'Listening', listening: true })
  })
  it('only reports listening when detection is on, access is granted and apps are chosen', () => {
    expect(purchaseCaptureStatus(null)).toMatchObject({ label: 'Checking', listening: false })
    expect(purchaseCaptureStatus({ ...ready, enabled: false })).toMatchObject({ label: 'Off', tone: 'neutral', listening: false })
    expect(purchaseCaptureStatus({ ...ready, access: false })).toMatchObject({ label: 'Setup needed', tone: 'warning', listening: false })
    expect(purchaseCaptureStatus({ ...ready, packages: [] })).toMatchObject({ label: 'Setup needed', listening: false })
    expect(purchaseCaptureStatus({ ...ready, listenerConnected: false })).toMatchObject({ label: 'Connecting', tone: 'warning', listening: false })
    expect(purchaseCaptureStatus({ ...ready, listenerConnected: undefined })).toMatchObject({ label: 'Listening', listening: true })
    expect(purchaseCaptureStatus(ready)).toMatchObject({ label: 'Listening', tone: 'success', listening: true, detail: expect.stringContaining('1 app') })
    expect(purchaseCaptureStatus({ ...ready, notifications: false }).detail).toMatch(/Review alerts are off/)
  })
  it('describes alert arrival relative to today without inventing a time', () => {
    const now = new Date(2026, 8, 27, 15, 0).getTime()
    expect(formatAlertTime(new Date(2026, 8, 27, 9, 5).getTime(), now)).toMatch(/^Today, /)
    expect(formatAlertTime(new Date(2026, 8, 26, 23, 59).getTime(), now)).toMatch(/^Yesterday, /)
    expect(formatAlertTime(new Date(2026, 8, 20, 12, 0).getTime(), now)).not.toMatch(/Today|Yesterday|2026/)
    expect(formatAlertTime(new Date(2025, 8, 20, 12, 0).getTime(), now)).toMatch(/2025/)
    expect(formatAlertTime(0, now)).toBe('Time unknown')
  })
})
