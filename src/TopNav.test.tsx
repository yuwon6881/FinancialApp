import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TopNav from './TopNav'

const baseProps = {
  activeTab: 'dashboard' as const,
  onTabChange: vi.fn(),
  hideSensitive: false,
  sensitivePreferenceStatus: 'resolved' as const,
  onToggleHideSensitive: vi.fn(),
  onRetrySensitivePreference: vi.fn(),
  onLogout: vi.fn(),
  username: 'Test User',
  pendingNotifications: [],
  onOpenNotifications: vi.fn(),
  darkMode: false,
  onToggleDarkMode: vi.fn(),
}

const setWidth = (width: number) => Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })

afterEach(() => {
  setWidth(1024)
  sessionStorage.clear()
})

describe('TopNav on a phone', () => {
  it('puts the five Lumen destinations in the tab bar and the add action beside it', () => {
    setWidth(390)
    render(<TopNav {...baseProps} activeTab="investments" onQuickAdd={vi.fn()} />)

    const primary = screen.getByRole('navigation', { name: 'Primary' })
    const tabs = within(primary).getAllByRole('button')
    expect(tabs.map(tab => tab.getAttribute('aria-label'))).toEqual(['Today', 'Activity', 'Plan', 'Wealth', 'Insights'])
    // Investments belongs to Wealth.
    expect(within(primary).getByRole('button', { name: 'Wealth' }).getAttribute('aria-current')).toBe('page')
    // The add action is not a sixth tab.
    expect(within(primary).queryByRole('button', { name: 'Quick add' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Quick add' })).toBeTruthy()
  })

  it('opens the quick-add sheet from the add button', () => {
    setWidth(390)
    const onQuickAdd = vi.fn()
    render(<TopNav {...baseProps} onQuickAdd={onQuickAdd} />)

    fireEvent.click(screen.getByRole('button', { name: 'Quick add' }))
    expect(onQuickAdd).toHaveBeenCalledTimes(1)
  })

  it('reopens a destination on the section last visited', () => {
    setWidth(390)
    const onTabChange = vi.fn()
    sessionStorage.setItem('lumen:last-section:plan', 'goals')
    render(<TopNav {...baseProps} onTabChange={onTabChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }))
    expect(onTabChange).toHaveBeenCalledWith('wishlist', undefined)
  })

  it('opens a destination on its first section when nothing was visited', () => {
    setWidth(390)
    const onTabChange = vi.fn()
    render(<TopNav {...baseProps} onTabChange={onTabChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Wealth' }))
    expect(onTabChange).toHaveBeenCalledWith('accounts', undefined)
  })

  it('shows compact accessible synchronization feedback on the logo', () => {
    setWidth(390)
    render(<TopNav {...baseProps} hideSensitive isSyncing />)

    expect(screen.getByLabelText('Syncing…')).toBeTruthy()
    expect(screen.queryByText('Syncing…')).toBeNull()
  })

  it('keeps mutation progress on the logo alongside the drafts chip', () => {
    setWidth(390)
    render(<TopNav {...baseProps} hideSensitive isSyncing syncLabel="Refreshing" draftCount={1} />)

    expect(screen.getByRole('button', { name: '1 Draft' })).toBeTruthy()
    expect(screen.getByLabelText('Refreshing')).toBeTruthy()
    expect(screen.queryByText('Refreshing')).toBeNull()
  })
})

describe('TopNav from the tablet tier up', () => {
  it('renders the sidebar with the same destinations and a primary new-transaction action', () => {
    const onNewTransaction = vi.fn()
    render(<TopNav {...baseProps} activeTab="recurring" onNewTransaction={onNewTransaction} />)

    const primary = screen.getByRole('navigation', { name: 'Primary' })
    expect(within(primary).getAllByRole('button').map(item => item.getAttribute('aria-label')))
      .toEqual(['Today', 'Activity', 'Plan', 'Wealth', 'Insights'])
    expect(within(primary).getByRole('button', { name: 'Plan' }).getAttribute('aria-current')).toBe('page')

    fireEvent.click(screen.getByRole('button', { name: 'New transaction' }))
    expect(onNewTransaction).toHaveBeenCalledTimes(1)
  })

  it('anchors synchronization feedback to the logo, not the bar', () => {
    render(<TopNav {...baseProps} hideSensitive isSyncing syncLabel="Refreshing" draftCount={1} />)

    const status = screen.getByLabelText('Refreshing')
    expect(status.className).toContain('absolute')
    expect(status.parentElement?.className).toContain('relative')
    expect(status.closest('button')?.getAttribute('aria-label')).toBe('Go to Today')
    expect(screen.queryByText('Refreshing')).toBeNull()
  })

  it('counts drafts on Activity rather than in a separate header chip', () => {
    render(<TopNav {...baseProps} draftCount={2} />)

    expect(screen.getByRole('button', { name: 'Activity, 2' })).toBeTruthy()
  })

  it('moves keyboard focus styling from the home logo to its wordmark', () => {
    render(<TopNav {...baseProps} />)

    expect(screen.getByRole('button', { name: 'Go to Today' }).className).toContain('brand-home-button')
    expect(screen.getByText('FinancialApp').className).toContain('brand-home-label')
  })

  it('triggers onOpenSearch from the sidebar search field', () => {
    const onOpenSearch = vi.fn()
    render(<TopNav {...baseProps} onOpenSearch={onOpenSearch} />)

    fireEvent.click(screen.getByRole('button', { name: 'Search your records' }))
    expect(onOpenSearch).toHaveBeenCalled()
  })
})

describe('TopNav shared state', () => {
  it('draws the busy line while work is in flight and leaves it out when idle or offline', () => {
    const idle = render(<TopNav {...baseProps} />)
    expect(idle.container.querySelector('.nav-activity-bar')).toBeNull()
    idle.unmount()

    const busy = render(<TopNav {...baseProps} isSyncing />)
    const bar = busy.container.querySelector('.nav-activity-bar')
    expect(bar).toBeTruthy()
    // Visual only: the badge beside the logo owns the announcement.
    expect(bar?.getAttribute('aria-hidden')).toBe('true')
    busy.unmount()

    // Offline is a state, not activity.
    const offline = render(<TopNav {...baseProps} isOffline isSyncing />)
    expect(offline.container.querySelector('.nav-activity-bar')).toBeNull()
  })

  it('renders privacy resolution as a floating overlay that does not take layout space', () => {
    render(<TopNav {...baseProps} hideSensitive sensitivePreferenceStatus="pending" />)

    const privacyStatus = screen.getByTestId('privacy-status')
    expect(privacyStatus.className).toContain('fixed')
    expect(privacyStatus.className).toContain('pointer-events-none')
    expect(screen.getByText('Protecting your amounts')).toBeTruthy()
    expect(screen.getByText(/Checking privacy settings before anything is revealed/)).toBeTruthy()
  })

  it.each(['pending', 'resolved'] as const)('opens the account menu safely while privacy is %s', (sensitivePreferenceStatus) => {
    render(<TopNav {...baseProps} hideSensitive sensitivePreferenceStatus={sensitivePreferenceStatus} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), { button: 0 })

    expect(screen.getByRole('menu')).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeTruthy()
  })

  it('states only the signed-in name in the account menu, with no unsubstantiated tier', () => {
    render(<TopNav {...baseProps} />)

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Account menu' }), { button: 0 })
    expect(screen.getAllByText('Test User').length).toBeGreaterThan(0)
    expect(screen.queryByText('Premium Account')).toBeNull()
    expect(screen.queryByRole('menuitem', { name: /commands/i })).toBeNull()
    expect(screen.queryByRole('menuitem', { name: 'Investments' })).toBeNull()
  })
})
