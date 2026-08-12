import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { AppTab } from '../types'
import { shouldShowMobileFab, useFabMenu } from './useFabMenu'

describe('useFabMenu', () => {
  it('toggles and closes on Escape', () => {
    const { result } = renderHook(() => useFabMenu('dashboard'))

    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)

    act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
    expect(result.current.isOpen).toBe(false)
  })

  it('closes when the active tab changes', () => {
    const { result, rerender } = renderHook(
      ({ activeTab }: { activeTab: AppTab }) => useFabMenu(activeTab),
      { initialProps: { activeTab: 'dashboard' as AppTab } },
    )

    act(() => result.current.toggle())
    expect(result.current.isOpen).toBe(true)

    rerender({ activeTab: 'ledger' })
    expect(result.current.isOpen).toBe(false)
  })

  it('hides the mobile quick-add on surfaces with their own primary add actions', () => {
    expect(shouldShowMobileFab('dashboard')).toBe(true)
    expect(shouldShowMobileFab('wishlist')).toBe(false)
    expect(shouldShowMobileFab('recurring')).toBe(false)
    expect(shouldShowMobileFab('documents')).toBe(false)
    expect(shouldShowMobileFab('ledger')).toBe(true)
  })
})
