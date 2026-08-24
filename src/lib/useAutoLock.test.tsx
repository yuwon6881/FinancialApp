import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from './api'
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

  it('locks immediately when a restored session was already inactive for five minutes', async () => {
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

    expect(markSessionLocked).toHaveBeenCalledTimes(1)
    expect(api.lockSession).toHaveBeenCalledTimes(1)
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
})
