import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TopNav from './TopNav'

describe('TopNav mobile primary navigation', () => {
  it('keeps exactly the five primary items when Growth Investments is routed separately', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
    render(
      <TopNav
        activeTab="investments"
        onTabChange={vi.fn()}
        hideSensitive={false}
        sensitivePreferenceStatus="resolved"
        onToggleHideSensitive={vi.fn()}
        onRetrySensitivePreference={vi.fn()}
        onLogout={vi.fn()}
        username="Test User"
        pendingNotifications={[]}
        onOpenNotifications={vi.fn()}
        darkMode={false}
        onToggleDarkMode={vi.fn()}
      />,
    )

    const primary = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(primary).getAllByRole('button')).toHaveLength(5)
    expect(within(primary).getByRole('button', { name: 'Today' })).toBeTruthy()
    expect(within(primary).getByRole('button', { name: 'Reports' })).toBeTruthy()
    expect(within(primary).getByRole('button', { name: 'Ledger' })).toBeTruthy()
    expect(within(primary).getByRole('button', { name: 'Recurring' })).toBeTruthy()
    expect(within(primary).getByRole('button', { name: 'Wishlist' })).toBeTruthy()
    expect(within(primary).queryByRole('button', { name: /Investments/ })).toBeNull()
  })
})
