import { describe, expect, it } from 'vitest'
import { isReceiptCameraCancelled } from './receiptCamera'

describe('native receipt camera cancellation', () => {
  it('treats the Capacitor iOS cancellation message as a normal close action', () => {
    expect(isReceiptCameraCancelled({ message: 'User cancelled photos app' })).toBe(true)
    expect(isReceiptCameraCancelled({ code: 'UserCancelled' })).toBe(true)
    expect(isReceiptCameraCancelled({ message: 'Camera permission denied' })).toBe(false)
  })
})
