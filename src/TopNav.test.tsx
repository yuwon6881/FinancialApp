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

  it('shows compact accessible synchronization feedback in the phone header', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
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

    expect(screen.getByLabelText('Syncing…')).toBeTruthy()
    expect(screen.queryByText('Syncing…')).toBeNull()
  })

  it('uses the pull indicator as the single refresh label when a phone has drafts', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
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
        syncLabel="Refreshing"
        draftCount={1}
      />,
    )

    expect(screen.getByRole('button', { name: '1 Draft' })).toBeTruthy()
    expect(screen.queryByText('Refreshing')).toBeNull()
  })

  it('keeps synchronization feedback compact in wider headers', () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 })
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
        syncLabel="Refreshing"
        draftCount={1}
      />,
    )

    const status = screen.getByLabelText('Refreshing')
    expect(status).toBeTruthy()
    expect(status.className).toContain('absolute')
    expect(status.closest('button')?.getAttribute('aria-label')).toBe('Go to Today')
    expect(screen.queryByText('Refreshing')).toBeNull()
  })

  it('moves keyboard focus styling from the home logo to its wordmark', () => {
    render(
      <TopNav
        activeTab="dashboard"
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

    expect(screen.getByRole('button', { name: 'Go to Today' }).className).toContain('brand-home-button')
    expect(screen.getByText('FinancialApp').className).toContain('brand-home-label')
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

  it('triggers onOpenSearch from the header search button', () => {
    const onOpenSearch = vi.fn()
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={vi.fn()}
        onOpenSearch={onOpenSearch}
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

    fireEvent.click(screen.getByRole('button', { name: 'Search your records' }))
    expect(onOpenSearch).toHaveBeenCalled()
  })

  it('states only the signed-in name in the account menu, with no unsubstantiated tier', () => {
    render(
      <TopNav
        activeTab="dashboard"
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

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), { button: 0 })
    expect(screen.getByText('Test User')).toBeTruthy()
    expect(screen.queryByText('Premium Account')).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /commands/i })).toBeNull()
  })

  it('uses the same plus symbol for every Quick Add action', () => {
    render(
      <TopNav
        activeTab="dashboard"
        onTabChange={vi.fn()}
        onQuickAction={vi.fn()}
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

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Quick Add' }), { button: 0 })
    for (const label of ['Post Transaction', 'New Subscription', 'Add Reward']) {
      expect(screen.getByRole('menuitem', { name: label }).querySelector('.lucide-plus')).toBeTruthy()
    }
  })
})
