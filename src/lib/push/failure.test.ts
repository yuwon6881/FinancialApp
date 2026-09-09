import { describe, expect, it } from 'vitest'
import { classifyPushTokenError, pushErrorGuidance, PushTokenError } from './failure'
import {
  PUSH_DENIED_GUIDANCE,
  PUSH_OFFLINE_GUIDANCE,
  PUSH_SERVICE_BLOCKED_GUIDANCE,
  PUSH_STORAGE_BLOCKED_GUIDANCE,
  PUSH_UNSUPPORTED_GUIDANCE,
  pushUnknownFailureGuidance,
} from './messages'

const withCode = (code: string) => Object.assign(new Error(code), { code })
const withName = (name: string, message = name) => Object.assign(new Error(message), { name })

describe('classifyPushTokenError', () => {
  it('separates the reasons that have different remedies', () => {
    expect(classifyPushTokenError(withCode('messaging/permission-blocked'))).toBe('permissionBlocked')
    expect(classifyPushTokenError(withName('NotAllowedError'))).toBe('permissionBlocked')
    expect(classifyPushTokenError(withCode('messaging/indexed-db-unsupported'))).toBe('storageBlocked')
    expect(classifyPushTokenError(withCode('messaging/unsupported-browser'))).toBe('unsupported')
    expect(classifyPushTokenError(withName('NotSupportedError'))).toBe('unsupported')
    expect(classifyPushTokenError(withCode('messaging/token-subscribe-failed'))).toBe('pushServiceBlocked')
  })

  // Chromium's own wording for "this browser will not talk to its push service at all", which is
  // what Brave produces while "Use Google services for push messaging" is off.
  it('treats a bare AbortError from subscribe as the push service refusing', () => {
    const error = withName('AbortError', 'Registration failed - push service error')
    expect(classifyPushTokenError(error)).toBe('pushServiceBlocked')
    expect(pushErrorGuidance(error)).toBe(PUSH_SERVICE_BLOCKED_GUIDANCE)
  })

  it('keeps a reason that was already decided at the point of failure', () => {
    const error = new PushTokenError('storageBlocked', 'unavailable')
    expect(classifyPushTokenError(error)).toBe('storageBlocked')
    expect(pushErrorGuidance(error)).toBe(PUSH_STORAGE_BLOCKED_GUIDANCE)
  })

  it('falls back to a message that does not blame the browser, and carries the code', () => {
    const error = withName('WeirdError', 'something else went wrong')
    expect(classifyPushTokenError(error)).toBe('unknown')
    expect(pushErrorGuidance(error)).toBe(pushUnknownFailureGuidance('WeirdError'))
    expect(pushErrorGuidance(error)).not.toBe(PUSH_UNSUPPORTED_GUIDANCE)
  })

  it('reads an offline device as offline rather than as a broken browser', () => {
    const online = Object.getOwnPropertyDescriptor(Navigator.prototype, 'onLine')
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    try {
      expect(classifyPushTokenError(withCode('messaging/token-subscribe-failed'))).toBe('offline')
      expect(pushErrorGuidance(new Error('boom'))).toBe(PUSH_OFFLINE_GUIDANCE)
    } finally {
      if (online) Object.defineProperty(Navigator.prototype, 'onLine', online)
      Reflect.deleteProperty(navigator, 'onLine')
    }
  })

  it('routes a blocked permission to the message that names the browser setting', () => {
    expect(pushErrorGuidance(withCode('messaging/permission-blocked'))).toBe(PUSH_DENIED_GUIDANCE)
  })
})
