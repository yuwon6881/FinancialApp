import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useAppPreferences } from './useAppPreferences'

describe('useAppPreferences', () => {
  beforeEach(() => {
    localStorage.clear()
    window.history.replaceState({}, '', '/')
    window.matchMedia = vi.fn().mockReturnValue({ matches: false })
    window.scrollTo = vi.fn()
  })

  it('keeps browser preferences isolated across account changes and waits for server-sensitive settings', () => {
    const { result } = renderHook(() => useAppPreferences())

    act(() => {
      result.current.setPreferenceOwner('alice')
      result.current.resolveHideSensitive(false)
      result.current.setHideBalanceAmounts(true)
      result.current.setDarkMode(true)
      result.current.setNotifyOnLogin(false)
    })

    expect(localStorage.getItem('hide_sensitive:alice')).toBe('false')
    expect(localStorage.getItem('hide_balance_amounts:alice')).toBe('true')
    expect(result.current.sensitivePreferenceStatus).toBe('resolved')

    act(() => result.current.setPreferenceOwner('bob'))

    expect(result.current.hideSensitive).toBe(true)
    expect(result.current.sensitivePreferenceStatus).toBe('pending')
    expect(result.current.hideBalanceAmounts).toBe(false)
    expect(result.current.darkMode).toBe(false)
    expect(result.current.notifyOnLogin).toBe(true)

    act(() => result.current.setPreferenceOwner('alice'))

    // Sensitive mode stays blurred until Alice's dashboard response applies her
    // server-backed choice, rather than using the old browser value.
    expect(result.current.hideSensitive).toBe(true)
    expect(result.current.sensitivePreferenceStatus).toBe('pending')
    expect(result.current.hideBalanceAmounts).toBe(true)
    expect(result.current.darkMode).toBe(true)
    expect(result.current.notifyOnLogin).toBe(false)
  })

  it('keeps amounts hidden and exposes an unavailable state when verification fails', () => {
    const { result } = renderHook(() => useAppPreferences())

    act(() => {
      result.current.setPreferenceOwner('alice')
      result.current.markSensitivePreferenceUnavailable()
    })

    expect(result.current.hideSensitive).toBe(true)
    expect(result.current.sensitivePreferenceStatus).toBe('unavailable')

    act(() => result.current.beginSensitivePreferenceResolution())

    expect(result.current.hideSensitive).toBe(true)
    expect(result.current.sensitivePreferenceStatus).toBe('pending')
  })

  it('replaces legacy wishlist URLs with the canonical route and preserves the cycle', () => {
    window.history.replaceState({}, '', '/wishlist?month=Jul&year=2026')
    renderHook(() => useAppPreferences())

    expect(window.location.pathname).toBe('/commitments-rewards')
    expect(window.location.search).toBe('?month=Jul&year=2026')
  })

  it('tracks commitments and rewards through browser history navigation', () => {
    window.history.replaceState({}, '', '/commitments-rewards?month=Jul&year=2026')
    const { result } = renderHook(() => useAppPreferences())

    act(() => result.current.setActiveTab('reports'))
    expect(result.current.activeTab).toBe('reports')

    act(() => {
      window.history.replaceState({}, '', '/commitments-rewards?month=Jul&year=2026')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(result.current.activeTab).toBe('wishlist')
    expect(window.location.search).toBe('?month=Jul&year=2026')
  })
})
