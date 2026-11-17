import { render, screen, waitFor, within } from '@testing-library/react'
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
  currency: 'MYR', hideSensitive: false,
  onAddAccount: vi.fn(), onUpdateAccount: vi.fn(), onRequestDeleteAccount: vi.fn(), onReconcileAccounts: vi.fn(),
}

describe('Accounts total beside what the investments are worth today', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows money in and worth today as equal figures, leaving every balance as recorded', async () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(null)
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockResolvedValue(portfolio({ totalValue: 4500, netDeposits: 3988.5 }))

    render(<AccountsSection {...props} />)

    expect(await screen.findAllByText('Worth today')).not.toHaveLength(0)
    expect(screen.getByText('Money in accounts')).toBeTruthy()
    expect(screen.queryByText('Total across accounts')).toBeNull()
    // Worth today leads (left); money in is the supporting figure after it.
    expect(screen.getAllByText('Worth today')[0].compareDocumentPosition(screen.getByText('Money in accounts')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // 5,988.50 recorded across accounts, plus the 511.50 market gain.
    expect(screen.getByText(/RM\s?6,500\.00/)).toBeTruthy()
    expect(screen.getAllByText(/RM\s?5,988\.50/).length).toBeGreaterThan(0)
    // Once on the total card and once on the Growth card.
    expect(screen.getAllByText(/RM\s?511\.50 above net broker deposits/)).toHaveLength(2)
    expect(screen.getByText(/worth RM\s?4,500\.00\. Net broker deposits were RM\s?3,988\.50 after withdrawals/)).toBeTruthy()
  })

  it('takes a loss off the worth and says so', () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ totalValue: 3987.03, netDeposits: 3988.5 }))
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockRejectedValue(new Error('offline'))

    render(<AccountsSection {...props} />)

    expect(screen.getAllByText(/RM\s?1\.47 below net broker deposits/)).toHaveLength(2)
    expect(screen.getByText(/RM\s?5,987\.03/)).toBeTruthy()
  })

  it('keeps an unknown worth unknown and hides figures while masked', () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ netDeposits: 3988.5 }))
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockRejectedValue(new Error('offline'))
    const { rerender, container } = render(<AccountsSection {...props} />)
    expect(screen.getByText(/enough exchange-rate data to compare with net broker deposits/)).toBeTruthy()
    expect(screen.getAllByText('Worth today')[0]).toBeTruthy()
    expect(screen.getAllByText('Unknown')[0]).toBeTruthy()
    expect(container.textContent).not.toMatch(/6,500|above net broker deposits|below net broker deposits/)

    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ totalValue: 4500, netDeposits: 3988.5 }))
    rerender(<AccountsSection key="masked" {...props} hideSensitive />)
    expect(screen.getAllByText('Worth today')[0]).toBeTruthy()
    expect(container.textContent).not.toMatch(/4,500|511\.50|6,500|above net broker deposits/)
  })

  it('never mixes today’s prices with an account balance in another currency', () => {
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockRejectedValue(new Error('offline'))
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ totalValue: 4500, netDeposits: 3988.5 }, 'USD'))
    render(<AccountsSection {...props} />)
    expect(screen.queryByText('Worth today')).toBeNull()
  })
})

describe('Growth bucket beside what was put in', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows worth today and money in on the Growth card only, never on an account row', async () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(null)
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockResolvedValue(portfolio({ totalValue: 4500, netDeposits: 3988.5 }))

    const { container } = render(<AccountsSection {...props} />)

    const growth = await waitFor(() => {
      const card = container.querySelector<HTMLElement>('#bucket-account-group-Growth')!
      expect(within(card).getByText('Worth today')).toBeTruthy()
      return card
    })
    // Growth holds 3,988.50 in the ledger; the market added 511.50.
    expect(within(growth).getByText(/RM\s?4,500\.00/)).toBeTruthy()
    expect(within(growth).getByText('Money in')).toBeTruthy()
    expect(within(growth).getAllByText(/RM\s?3,988\.50/).length).toBeGreaterThan(0)
    expect(within(growth).getByText(/RM\s?511\.50 above net broker deposits/)).toBeTruthy()
    expect(within(container.querySelector<HTMLElement>('#bucket-account-group-Essentials')!).queryByText('Worth today')).toBeNull()
  })

  it('keeps an unknown worth unknown', () => {
    vi.spyOn(api, 'readCachedInvestmentPortfolio').mockReturnValue(portfolio({ netDeposits: 3988.5 }))
    vi.spyOn(api, 'fetchInvestmentPortfolio').mockRejectedValue(new Error('offline'))
    const { container } = render(<AccountsSection {...props} />)
    expect(within(container.querySelector<HTMLElement>('#bucket-account-group-Growth')!).getByText('Unknown')).toBeTruthy()
  })
})
