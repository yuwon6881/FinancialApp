import { describe, expect, it } from 'vitest'
import { shouldLockNativeAppForStateChange } from './nativeAppLifecyclePolicy'

describe('native app lifecycle lock policy', () => {
  it('does not lock when the app becomes active', () => {
    expect(shouldLockNativeAppForStateChange(true, false)).toBe(false)
  })

  it('does not lock while the passkey provider owns the foreground handoff', () => {
    expect(shouldLockNativeAppForStateChange(false, true)).toBe(false)
  })

  it('locks when the app is backgrounded outside device authentication', () => {
    expect(shouldLockNativeAppForStateChange(false, false)).toBe(true)
  })
})
