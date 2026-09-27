import { describe, expect, it } from 'vitest'
import { NativeAppResumeLock, shouldLockNativeAppForStateChange } from './nativeAppLifecyclePolicy'

describe('native app lifecycle lock policy', () => {
  it('waits for return to the app before requesting unlock, including Android settings trips', () => {
    const policy = new NativeAppResumeLock()
    expect(policy.onStateChange(false, false)).toBe(false)
    expect(policy.onStateChange(false, false)).toBe(false)
    expect(policy.onStateChange(true, false)).toBe(true)
    expect(policy.onStateChange(true, false)).toBe(false)
  })
  it('does not request another unlock after a passkey handoff', () => {
    const policy = new NativeAppResumeLock()
    expect(policy.onStateChange(false, true)).toBe(false)
    expect(policy.onStateChange(true, false)).toBe(false)
  })
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
