import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TopNav from './TopNav'

describe('TopNav mobile primary navigation', () => {
  it('keeps the five desktop workspaces in the bottom nav and routes Commitments and Rewards from the header', () => {
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
    expect(within(primary).getByRole('button', { name: 'Vault' })).toBeTruthy()
    expect(within(primary).queryByRole('button', { name: 'Wishlist' })).toBeNull()
    expect(within(primary).queryByRole('button', { name: /Investments/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Commitments and Rewards' })).toBeTruthy()
  })

  it('shows global synchronization feedback in the top-left brand area', () => {
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={vi.fn()}
        hideSensitive
        sensitivePreferenceStatus="resolved"
        onToggleHideSensitive={vi.fn()}
        onRetrySensitivePreference={vi.fn()}
        onLogout={vi.fn()}
        username="Test User"
        pendingNotifications={[]}
        onOpenNotifications={vi.fn()}
        darkMode={false}
        onToggleDarkMode={vi.fn()}
        isSyncing
      />,
    )

    expect(screen.getByText('Syncing…')).toBeTruthy()
  })

  it('renders privacy resolution as a floating overlay that does not take layout space', () => {
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={vi.fn()}
        hideSensitive
        sensitivePreferenceStatus="pending"
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

    const privacyStatus = screen.getByTestId('privacy-status')
    expect(privacyStatus.className).toContain('absolute')
    expect(privacyStatus.className).toContain('pointer-events-none')
    expect(screen.getByText('Protecting your amounts')).toBeTruthy()
    expect(screen.getByText(/Checking privacy settings before anything is revealed/)).toBeTruthy()
  })

  it.each(['pending', 'resolved'] as const)('opens the account menu safely while privacy is %s', (sensitivePreferenceStatus) => {
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={vi.fn()}
        hideSensitive
        sensitivePreferenceStatus={sensitivePreferenceStatus}
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

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), { button: 0 })

    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeTruthy()
  })
})
