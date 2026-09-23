import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
import { prefetchFingerprintAssertOptions } from './fingerprintOptionsCache'
import { useAutoLock } from './useAutoLock'

vi.mock('./api', () => ({
  SESSION_LOCKED_EVENT: 'financialapp:session-locked',
  lockSession: vi.fn(),
  sendSessionHeartbeat: vi.fn(),
}))

vi.mock('./fingerprintOptionsCache', () => ({
  prefetchFingerprintAssertOptions: vi.fn().mockResolvedValue(undefined),
}))

describe('useAutoLock', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    localStorage.clear()
    vi.mocked(api.lockSession).mockResolvedValue(undefined)
    vi.mocked(api.sendSessionHeartbeat).mockResolvedValue(undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('starts a newly opened unlocked document as active instead of counting time while it was closed', async () => {
    localStorage.setItem('last_active_time', String(Date.now() - 5 * 60 * 1000 - 1))
    const markSessionLocked = vi.fn()

    renderHook(() => useAutoLock({
      token: 'session',
      isLocked: false,
      hasFingerprintSetup: false,
      markSessionLocked,
      onAuthError: vi.fn(),
    }))

    await act(async () => Promise.resolve())

    expect(Number(localStorage.getItem('last_active_time'))).toBe(Date.now())
    expect(markSessionLocked).not.toHaveBeenCalled()
    expect(api.lockSession).not.toHaveBeenCalled()
  })

  it('keeps the local inactivity lock when the server lock request is offline', async () => {
    vi.mocked(api.lockSession).mockRejectedValue(new Error('network unavailable'))
    localStorage.setItem('last_active_time', String(Date.now()))
    const markSessionLocked = vi.fn()

    renderHook(() => useAutoLock({
      token: 'session',
      isLocked: false,
      hasFingerprintSetup: false,
      markSessionLocked,
      onAuthError: vi.fn(),
    }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 15_000)
    })

    expect(markSessionLocked).toHaveBeenCalledTimes(1)
  })

  it('does not request a fingerprint challenge when the account has no device unlock credential', async () => {
    localStorage.setItem('last_active_time', String(Date.now()))

    renderHook(() => useAutoLock({
      token: 'session',
      isLocked: false,
      hasFingerprintSetup: false,
      markSessionLocked: vi.fn(),
      onAuthError: vi.fn(),
    }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 15_000)
    })

    expect(prefetchFingerprintAssertOptions).not.toHaveBeenCalled()
  })
})
