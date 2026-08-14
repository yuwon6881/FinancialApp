import { describe, it, expect } from 'vitest'
import {
  getMissingBuckets,
  getStatus,
  hasHttpStatus,
  isAuthError,
  isLedgerAccountRefusal,
  isLockError,
  JUST_LOGGED_IN_WINDOW_MS,
} from './errors'

class ApiErrorLike extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

describe('ledger account refusals', () => {
  // A 400 is normally terminal and unactionable, so the outbox has to tell a refusal the user can
  // fix from one they cannot. Both codes collapse to one question because both are answered by
  // choosing an open account in the bucket.
  it('recognises both account codes and nothing else', () => {
    expect(isLedgerAccountRefusal({ status: 400, code: 'ledger_account_required' })).toBe(true)
    expect(isLedgerAccountRefusal({ status: 400, code: 'ledger_account_invalid' })).toBe(true)
    expect(isLedgerAccountRefusal({ status: 400, code: 'something_else' })).toBe(false)
    expect(isLedgerAccountRefusal({ status: 400 })).toBe(false)
    expect(isLedgerAccountRefusal(new Error('boom'))).toBe(false)
    expect(isLedgerAccountRefusal(null)).toBe(false)
  })

  it('reads the named buckets and treats an empty or malformed list as none', () => {
    expect(getMissingBuckets({ missingBuckets: ['Rewards', 'Growth'] })).toEqual(['Rewards', 'Growth'])
    expect(getMissingBuckets({ missingBuckets: ['Rewards', 7, ''] })).toEqual(['Rewards'])
    expect(getMissingBuckets({ missingBuckets: [] })).toBeUndefined()
    expect(getMissingBuckets({ missingBuckets: 'Rewards' })).toBeUndefined()
    expect(getMissingBuckets({})).toBeUndefined()
  })
})

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
