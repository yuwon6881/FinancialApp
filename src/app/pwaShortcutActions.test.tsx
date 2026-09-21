import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getPwaShortcutAction, usePwaShortcutAction } from './pwaShortcutActions'

describe('PWA launcher shortcuts', () => {
  beforeEach(() => window.history.replaceState({}, '', '/'))

  it('accepts only the three manifest actions', () => {
    expect(getPwaShortcutAction('?pwaAction=add-transaction')).toBe('add-transaction')
    expect(getPwaShortcutAction('?pwaAction=scan-receipt')).toBe('scan-receipt')
    expect(getPwaShortcutAction('?pwaAction=upcoming-bills')).toBe('upcoming-bills')
    expect(getPwaShortcutAction('?pwaAction=run-anything')).toBeNull()
    expect(getPwaShortcutAction('')).toBeNull()
  })

  it('keeps the requested action through authentication and the launch gate, then consumes it once', () => {
    window.history.replaceState({}, '', '/?pwaAction=upcoming-bills')
    const onRunAction = vi.fn()
    const initial = {
      actionReady: false,
      username: '',
      hideSensitive: true,
      sensitivePreferenceStatus: 'pending' as const,
      onRequestSensitiveReveal: vi.fn(),
      onRunAction,
      onClearAction: vi.fn(),
    }
    const { rerender } = renderHook((options) => usePwaShortcutAction(options), { initialProps: initial })
    expect(onRunAction).not.toHaveBeenCalled()
    expect(new URLSearchParams(window.location.search).get('pwaAction')).toBe('upcoming-bills')

    rerender({ ...initial, actionReady: true, username: 'alice' })
    expect(onRunAction).toHaveBeenCalledTimes(1)
    expect(onRunAction).toHaveBeenCalledWith('upcoming-bills')
    expect(new URLSearchParams(window.location.search).has('pwaAction')).toBe(false)

    rerender({ ...initial, actionReady: true, username: 'alice' })
    expect(onRunAction).toHaveBeenCalledTimes(1)
  })

  it('waits for normal sensitive verification before opening a transaction form', () => {
    window.history.replaceState({}, '', '/?pwaAction=add-transaction')
    const onRequestSensitiveReveal = vi.fn()
    const onRunAction = vi.fn()
    const initial = {
      actionReady: true,
      username: 'alice',
      hideSensitive: true,
      sensitivePreferenceStatus: 'resolved' as const,
      onRequestSensitiveReveal,
      onRunAction,
      onClearAction: vi.fn(),
    }
    const { rerender } = renderHook((options) => usePwaShortcutAction(options), { initialProps: initial })
    expect(onRequestSensitiveReveal).toHaveBeenCalledTimes(1)
    expect(onRunAction).not.toHaveBeenCalled()

    act(() => rerender({ ...initial, hideSensitive: false }))
    expect(onRunAction).toHaveBeenCalledTimes(1)
    expect(onRunAction).toHaveBeenCalledWith('add-transaction')
    expect(new URLSearchParams(window.location.search).has('pwaAction')).toBe(false)
  })

  it('clears an unconsumed shortcut on account change before dispatching it', () => {
    window.history.replaceState({}, '', '/?pwaAction=add-transaction')
    const onRunAction = vi.fn()
    const onClearAction = vi.fn()
    const initial = {
      actionReady: true,
      username: 'alice',
      hideSensitive: true,
      sensitivePreferenceStatus: 'pending' as const,
      onRequestSensitiveReveal: vi.fn(),
      onRunAction,
      onClearAction,
    }
    const { rerender } = renderHook((options) => usePwaShortcutAction(options), { initialProps: initial })
    rerender({ ...initial, username: 'bob', actionReady: true })
    expect(onRunAction).not.toHaveBeenCalled()
    expect(onClearAction).toHaveBeenCalledTimes(1)
    expect(new URLSearchParams(window.location.search).has('pwaAction')).toBe(false)
  })

  it('does not mistake a stale remembered username for a completed sign-in', () => {
    window.history.replaceState({}, '', '/?pwaAction=upcoming-bills')
    const onRunAction = vi.fn()
    const initial = {
      actionReady: false,
      username: 'alice',
      hideSensitive: true,
      sensitivePreferenceStatus: 'pending' as const,
      onRequestSensitiveReveal: vi.fn(),
      onRunAction,
      onClearAction: vi.fn(),
    }
    const { rerender } = renderHook((options) => usePwaShortcutAction(options), { initialProps: initial })
    rerender({ ...initial, actionReady: true, username: 'bob' })
    expect(onRunAction).toHaveBeenCalledWith('upcoming-bills')
  })
})
