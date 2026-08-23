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
      result.current.setHideFinancialFigures(false)
      result.current.setDarkMode(true)
      result.current.setNotifyOnLogin(false)
    })

    expect(localStorage.getItem('hide_sensitive:alice')).toBe('false')
    expect(localStorage.getItem('hide_financial_figures:alice')).toBe('false')
    expect(result.current.sensitivePreferenceStatus).toBe('resolved')

    act(() => result.current.setPreferenceOwner('bob'))

    expect(result.current.hideSensitive).toBe(true)
    expect(result.current.sensitivePreferenceStatus).toBe('pending')
    expect(result.current.hideFinancialFigures).toBe(true)
    expect(result.current.darkMode).toBe(false)
    expect(result.current.notifyOnLogin).toBe(true)

    act(() => result.current.setPreferenceOwner('alice'))

    // Sensitive mode stays blurred until Alice's dashboard response applies her
    // server-backed choice, rather than using the old browser value.
    expect(result.current.hideSensitive).toBe(true)
    expect(result.current.sensitivePreferenceStatus).toBe('pending')
    expect(result.current.hideFinancialFigures).toBe(false)
    expect(result.current.darkMode).toBe(true)
    expect(result.current.notifyOnLogin).toBe(false)
  })

  it('defaults local financial figures to hidden and restores the account-scoped preference', () => {
    const { result } = renderHook(() => useAppPreferences())
    expect(result.current.hideFinancialFigures).toBe(true)

    act(() => {
      result.current.setPreferenceOwner('alice')
    })
    expect(result.current.hideFinancialFigures).toBe(true)

    act(() => {
      result.current.setHideFinancialFigures(false)
    })
    expect(result.current.hideFinancialFigures).toBe(false)

    // Logging out resets local hide balance to hidden
    act(() => {
      result.current.setPreferenceOwner(null)
    })
    expect(result.current.hideFinancialFigures).toBe(true)

    // Logging in resets local hide balance to hidden
    act(() => {
      result.current.setPreferenceOwner('alice')
    })
    expect(result.current.hideFinancialFigures).toBe(false)
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

  it('persists ledger page size and sort order per account', () => {
    const { result } = renderHook(() => useAppPreferences())
    act(() => {
      result.current.setPreferenceOwner('alice')
      result.current.setLedgerPageSize(50)
      result.current.setLedgerSortOrder('amount-desc')
    })

    expect(localStorage.getItem('ledger_page_size:alice')).toBe('50')
    expect(localStorage.getItem('ledger_sort_order:alice')).toBe('amount-desc')

    act(() => result.current.setPreferenceOwner('bob'))
    expect(result.current.ledgerPageSize).toBe(10)
    expect(result.current.ledgerSortOrder).toBe('date-desc')

    act(() => result.current.setPreferenceOwner('alice'))
    expect(result.current.ledgerPageSize).toBe(50)
    expect(result.current.ledgerSortOrder).toBe('amount-desc')
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
