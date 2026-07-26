import { describe, it, expect } from 'vitest'
import { getStatus, hasHttpStatus, isAuthError, isLockError, JUST_LOGGED_IN_WINDOW_MS } from './errors'

class ApiErrorLike extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

describe('error status classification', () => {
  it('reads a numeric status off an error-like object', () => {
    expect(getStatus({ status: 401 })).toBe(401)
    expect(getStatus({ status: '401' })).toBeUndefined()
    expect(getStatus({ status: Number.NaN })).toBeUndefined()
    expect(getStatus(new Error('boom'))).toBeUndefined()
    expect(getStatus(null)).toBeUndefined()
  })

  it('classifies a status-coded 401 with no "401" substring in the message', () => {
    const err = new ApiErrorLike('Request failed', 401)
    expect(err.message).not.toContain('401')
    expect(isAuthError(err)).toBe(true)
    expect(isLockError(err)).toBe(false)
  })

  it('classifies a status-coded 423 with no "423" substring in the message', () => {
    const err = new ApiErrorLike('Request failed', 423)
    expect(isLockError(err)).toBe(true)
    expect(isAuthError(err)).toBe(false)
  })

  it('falls back to message sniffing only when no status is present', () => {
    expect(isAuthError(new Error('401 Unauthorized'))).toBe(true)
    expect(isAuthError(new Error('Unauthorized'))).toBe(true)
    expect(isLockError(new Error('423 Locked'))).toBe(true)
  })

  it('lets a real status win over a misleading message', () => {
    // A 500 whose body happens to mention "unauthorized" is not an auth failure.
    expect(isAuthError(new ApiErrorLike('unauthorized upstream', 500))).toBe(false)
    expect(hasHttpStatus(new ApiErrorLike('mentions 423 in prose', 500), 423)).toBe(false)
  })

  it('pins the shared just-logged-in grace window', () => {
    expect(JUST_LOGGED_IN_WINDOW_MS).toBe(10000)
  })
})
