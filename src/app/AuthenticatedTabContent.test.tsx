import { Suspense } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AuthenticatedTabContent, type AuthenticatedTabContentProps } from './AuthenticatedTabContent'

const viewChunk = vi.hoisted(() => {
  let release: () => void = () => undefined
  const loaded = new Promise<void>(resolve => { release = resolve })
  return { loaded, release }
})

// Stands in for a view chunk that is still downloading on the first visit to its page.
vi.mock('../components/InvestmentsView', async () => {
  await viewChunk.loaded
  return { InvestmentsView: () => <div data-testid="investments-view" /> }
})

const noop = () => undefined

const props = {
  prefs: { activeTab: 'investments', setActiveTab: noop },
  financial: { optimisticDashboardData: null },
  nav: {},
  draftCount: 0,
  receiptScan: {},
  receiptSplit: {},
  investmentScan: {},
} as unknown as AuthenticatedTabContentProps

describe('AuthenticatedTabContent', () => {
  it('keeps the section toggle on screen while a view chunk is still loading', async () => {
    render(
      <Suspense fallback={<div data-testid="shell-fallback" />}>
        <AuthenticatedTabContent {...props} />
      </Suspense>,
    )

    const toggle = await screen.findByRole('navigation', { name: 'Wealth sections' }, { timeout: 10000 })
    await screen.findByTestId('investments-skeleton', undefined, { timeout: 10000 })
    expect(toggle.isConnected).toBe(true)
    expect(screen.getByRole('button', { name: 'Investments' }).getAttribute('aria-current')).toBe('page')
    expect(screen.queryByTestId('shell-fallback')).toBeNull()

    viewChunk.release()
    await screen.findByTestId('investments-view', undefined, { timeout: 10000 })
    expect(screen.getByRole('navigation', { name: 'Wealth sections' })).toBe(toggle)
  })
})
