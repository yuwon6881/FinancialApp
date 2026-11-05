import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as api from '../../../lib/api'
import type { InvestmentPortfolio } from '../../../types'
import { AccountsSection } from './AccountsSection'

const portfolio = (summary: Partial<InvestmentPortfolio['summary']>, appCurrency = 'MYR') => ({
  appCurrency,
  accounts: [{ id: 'broker', name: 'Broker', baseCurrency: 'USD', isArchived: false }],
  summary: { growthLedgerBalance: 0, ...summary },
}) as unknown as InvestmentPortfolio

const props = {
  accounts: [
    { id: 'bank', name: 'Bank', bucket: 'Essentials', kind: 'Bank', remaining: 2000, isArchived: false },
    { id: 'growth', name: 'Broker money', bucket: 'Growth', kind: 'Bank', remaining: 3988.5, isArchived: false },
  ] as React.ComponentProps<typeof AccountsSection>['accounts'],
  currency: 'MYR', hideSensitive: false, isCurrentCycle: true,
  onAddAccount: vi.fn(), onUpdateAccount: vi.fn(), onRequestDeleteAccount: vi.fn(), onReconcileAccounts: vi.fn(),
}

describe('Accounts total with investments at today’s prices', () => {
  afterEach(() => vi.restoreAllMocks())

  it('adds what the market made of the money sent, leaving every balance as recorded', async () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(null)
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockResolvedValue(portfolio({ totalValue: 4500, netDeposits: 3988.5 }))

    render(<AccountsSection {...props} />)

    expect(await screen.findByText('With investments at today’s prices')).toBeTruthy()
    expect(screen.getByText(/worth RM\s?4,500\.00 today, RM\s?511\.50 more than the RM\s?3,988\.50 you sent/)).toBeTruthy()
    // 5,988.50 recorded across accounts, plus the 511.50 market gain.
    expect(screen.getByText(/RM\s?6,500\.00/)).toBeTruthy()
    expect(screen.getAllByText(/RM\s?5,988\.50/).length).toBeGreaterThan(0)
  })

  it('takes a loss off the total and says so', async () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ totalValue: 3987.03, netDeposits: 3988.5 }))
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockRejectedValue(new Error('offline'))

    render(<AccountsSection {...props} />)

    expect(screen.getByText(/RM\s?1\.47 less than the RM\s?3,988\.50/)).toBeTruthy()
    expect(screen.getByText(/RM\s?5,987\.03/)).toBeTruthy()
  })

  it('keeps an unknown worth unknown and hides figures while masked', async () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ netDeposits: 3988.5 }))
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockRejectedValue(new Error('offline'))
    const { rerender, container } = render(<AccountsSection {...props} />)
    expect(screen.getByText(/worth today shows here once prices arrive/)).toBeTruthy()
    expect(screen.queryByText('With investments at today’s prices')).toBeNull()

    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ totalValue: 4500, netDeposits: 3988.5 }))
    rerender(<AccountsSection key="masked" {...props} hideSensitive />)
    expect(screen.getByText('With investments at today’s prices')).toBeTruthy()
    expect(container.textContent).not.toMatch(/4,500|511\.50|6,500/)
  })

  it('never mixes today’s prices into a past cycle or another currency', () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ totalValue: 4500, netDeposits: 3988.5 }))
    const fetch = vi.spyOn(api, 'fetchInvestmentPortfolio').mockRejectedValue(new Error('offline'))
    const { unmount } = render(<AccountsSection {...props} isCurrentCycle={false} />)
    expect(screen.queryByText('With investments at today’s prices')).toBeNull()
    expect(fetch).not.toHaveBeenCalled()
    unmount()

    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ totalValue: 4500, netDeposits: 3988.5 }, 'USD'))
    render(<AccountsSection {...props} />)
    expect(screen.queryByText('With investments at today’s prices')).toBeNull()
  })
})
