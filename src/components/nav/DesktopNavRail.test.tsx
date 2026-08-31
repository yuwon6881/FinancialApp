import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DesktopNavRail } from './DesktopNavRail'
import { APP_LOCATION_CHANGED_EVENT } from '../../lib/appLocation'

describe('DesktopNavRail', () => {
  const originalLocation = window.location.href

  beforeEach(() => {
    window.history.replaceState({}, '', '/dashboard')
  })

  afterEach(() => {
    window.history.replaceState({}, '', originalLocation)
  })

  it('renders all grouped navigation items and the settings footer', () => {
    render(<DesktopNavRail activeTab="dashboard" onTabChange={vi.fn()} />)

    // Groups
    expect(screen.getByRole('group', { name: 'Overview' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Cash & Expenses' })).toBeTruthy()
    expect(screen.getByRole('group', { name: 'Wealth & Goals' })).toBeTruthy()

    // Items
    expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reports' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Ledger' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Accounts' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Recurring Bills' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Loans' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Investments' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Commitments' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rewards' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Vault' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy()
  })

  it('omits the cycle block until the cycle day is known, rather than assuming a cadence', () => {
    const { rerender } = render(<DesktopNavRail activeTab="dashboard" onTabChange={vi.fn()} />)
    expect(screen.queryByRole('progressbar', { name: 'Cycle progress' })).toBeNull()

    rerender(<DesktopNavRail activeTab="dashboard" onTabChange={vi.fn()} cycleDay={28} />)
    const progress = screen.getByRole('progressbar', { name: 'Cycle progress' })
    const value = Number(progress.getAttribute('aria-valuenow'))
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(100)
    expect(screen.getByText(/^Day \d+ of \d+$/)).toBeTruthy()
  })

  it('navigates to subtab destinations with search options', () => {
    const onTabChange = vi.fn()
    render(<DesktopNavRail activeTab="dashboard" onTabChange={onTabChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Loans' }))
    expect(onTabChange).toHaveBeenCalledWith('recurring', { search: { section: 'loans' } })

    fireEvent.click(screen.getByRole('button', { name: 'Accounts' }))
    expect(onTabChange).toHaveBeenCalledWith('settings', { search: { section: 'accounts' } })

    fireEvent.click(screen.getByRole('button', { name: 'Rewards' }))
    expect(onTabChange).toHaveBeenCalledWith('wishlist', { search: { section: 'rewards' } })

    fireEvent.click(screen.getByRole('button', { name: 'Commitments' }))
    expect(onTabChange).toHaveBeenCalledWith('wishlist', { search: { section: 'commitments' } })

    fireEvent.click(screen.getByRole('button', { name: 'Recurring Bills' }))
    expect(onTabChange).toHaveBeenCalledWith('recurring', { search: { section: 'recurring' } })
  })

  it('accurately distinguishes active subtab items based on location search', () => {
    window.history.replaceState({}, '', '/recurring?section=loans')
    const { rerender } = render(<DesktopNavRail activeTab="recurring" onTabChange={vi.fn()} />)

    // When on loans subtab, Loans is aria-current='page' and Recurring Bills is not
    expect(screen.getByRole('button', { name: 'Loans' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Recurring Bills' }).getAttribute('aria-current')).toBeNull()

    // When location updates to recurring bills
    act(() => {
      window.history.replaceState({}, '', '/recurring?section=recurring')
      window.dispatchEvent(new Event(APP_LOCATION_CHANGED_EVENT))
    })
    rerender(<DesktopNavRail activeTab="recurring" onTabChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Recurring Bills' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: 'Loans' }).getAttribute('aria-current')).toBeNull()
  })
})
