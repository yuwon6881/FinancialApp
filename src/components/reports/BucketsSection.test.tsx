import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BucketsSection, type BucketsSectionProps } from './BucketsSection'
import type { CategorySummary } from '../../types'

const mockCategories: CategorySummary[] = [
  {
    name: 'Essentials',
    allocation: 0.5,
    target: 1896,
    incomeAllocated: 1896,
    budget: 7.93,
    spent: 1539.51,
    netChange: 364.42,
    remaining: 372.35,
    accounts: [
      { id: 'acc-1', name: 'Maybank', remaining: 200, isArchived: false },
      { id: 'acc-2', name: 'Cash Wallet', remaining: 172.35, isArchived: false },
    ],
  },
  {
    name: 'Growth',
    allocation: 0.25,
    target: 948,
    incomeAllocated: 948,
    budget: 2143.50,
    spent: 0,
    netChange: 800,
    remaining: 2943.50,
    accounts: [],
  },
]

const rewardsCategory: CategorySummary = {
  name: 'Rewards', allocation: 0.1, target: 100, incomeAllocated: 100,
  budget: 100, spent: 0, netChange: 100, remaining: 200, accounts: [],
}

const format = (value: number) => `RM ${value.toFixed(2)}`

function renderBuckets(overrides: Partial<BucketsSectionProps> = {}) {
  return render(
    <BucketsSection
      categories={mockCategories}
      isCurrentCycle
      cycleLabel="Aug 1st ~ Aug 31st"
      pendingDeductionsByCategory={{}}
      currency="MYR"
      amountsMasked={false}
      formatCurrency={format}
      formatSensitive={format}
      growthMetric={{ target: 948, currentPct: 0.844, pending: 0, safePct: 0.844, atRiskPct: 0 }}
      essentialsMetric={{ totalAvailable: 1903.93, currentPct: 0.196, pending: 0, projectedPct: 0.196, atRiskPct: 0 }}
      stabilityMetric={{ hasTarget: true, currentPct: 0.5, pending: 0, projectedPct: 0.5, atRiskPct: 0 }}
      growthAlloc={0.25}
      targetStabilityFund={10000}
      {...overrides}
    />,
  )
}

describe('BucketsSection', () => {
  it('shows current Rewards commitments and free money using the shared pool rules', () => {
    renderBuckets({
      categories: [rewardsCategory],
      pendingDeductionsByCategory: { Rewards: 30 },
      savingsGoals: [{
        id: 1, name: 'Trip', targetAmount: 300, earmarkedAmount: 50,
        fundingBucket: 'Rewards', targetDate: '2026-12-01', priority: 'Medium',
        status: 'active', isRecurring: false, recurrenceMonths: 12,
        cycleFundedAmount: 0, createdAt: '2026-09-01T00:00:00Z',
      }],
    })

    expect(screen.getByText('Committed')).toBeTruthy()
    expect(screen.getByText('RM 80.00')).toBeTruthy()
    expect(screen.getByText('Free to spend')).toBeTruthy()
    expect(screen.getByText('RM 120.00')).toBeTruthy()
    expect(screen.queryByText('Projected')).toBeNull()
  })

  it('does not apply today’s Rewards commitments to a historical cycle', () => {
    renderBuckets({
      categories: [rewardsCategory],
      isCurrentCycle: false,
      pendingDeductionsByCategory: { Rewards: 30 },
    })
    expect(screen.queryByText('Committed')).toBeNull()
    expect(screen.queryByText('Free to spend')).toBeNull()
    expect(screen.getByText('Pending')).toBeTruthy()
    expect(screen.getByText('Projected')).toBeTruthy()
    expect(screen.getByText('RM 170.00')).toBeTruthy()
  })

  it('keeps every carryover figure and the plan measure on each bucket', () => {
    renderBuckets()
    const essentials = within(screen.getByTestId('bucket-essentials'))
    expect(essentials.getByText('Income added')).toBeTruthy()
    expect(essentials.getByText('RM 1896.00')).toBeTruthy()
    expect(essentials.getByText('Carried over')).toBeTruthy()
    expect(essentials.getByText('RM 7.93')).toBeTruthy()
    expect(essentials.getByText('+RM 364.42')).toBeTruthy()
    expect(essentials.getByText('Available budget')).toBeTruthy()
    expect(essentials.getByText('19.6%')).toBeTruthy()

    const growth = within(screen.getByTestId('bucket-growth'))
    expect(growth.getByText('Plan target · 25% of income')).toBeTruthy()
    expect(growth.getByText('84.4%')).toBeTruthy()
  })

  it('projects pending bills onto the plan measure', () => {
    renderBuckets({
      pendingDeductionsByCategory: { Essentials: 100 },
      essentialsMetric: { totalAvailable: 1903.93, currentPct: 0.196, pending: 100, projectedPct: 0.143, atRiskPct: 0.053 },
    })
    const essentials = within(screen.getByTestId('bucket-essentials'))
    expect(essentials.getByText('→ 14.3%')).toBeTruthy()
    expect(essentials.getByText('-RM 100.00')).toBeTruthy()
    expect(essentials.getByText('RM 272.35')).toBeTruthy()
  })

  it('opens a phone row’s detail from its summary', () => {
    renderBuckets()
    const toggle = screen.getByRole('button', { name: 'Essentials details' })
    const details = document.getElementById(toggle.getAttribute('aria-controls')!)!
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(details.className).toContain('hidden')
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(details.className).not.toContain('hidden')
  })

  it('links each bucket to its ledger and Growth to its investments', () => {
    const onNavigateToLedger = vi.fn()
    const onNavigate = vi.fn()
    renderBuckets({ onNavigateToLedger, onNavigate })
    fireEvent.click(screen.getByRole('button', { name: 'View Essentials activity in Ledger' }))
    expect(onNavigateToLedger).toHaveBeenCalledWith({ category: 'Essentials', showAllCycles: false })
    fireEvent.click(screen.getByRole('button', { name: 'View Growth activity in Ledger' }))
    expect(onNavigateToLedger).toHaveBeenCalledWith({ category: 'Growth', showAllCycles: true })
    fireEvent.click(screen.getByRole('button', { name: /Growth Investments/ }))
    expect(onNavigate).toHaveBeenCalledWith('investments')
  })

  it('masks the rolling balances while amounts are hidden', () => {
    const { container } = renderBuckets({ amountsMasked: true })
    expect(container.textContent).not.toContain('372.35')
    expect(container.textContent).not.toContain('1896.00')
  })

  it('renders categories and opens the account breakdown sheet on click', () => {
    const onNavigateToAccounts = vi.fn()
    renderBuckets({ onNavigateToAccounts })

    expect(screen.getByRole('heading', { name: 'Buckets' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'View account breakdown for Essentials' })).toBeTruthy()
    expect(screen.queryByTitle('Adjust balance')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'View account breakdown for Essentials' }))

    expect(screen.getByText('Essentials Account Balances')).toBeTruthy()
    expect(screen.getByText('Maybank')).toBeTruthy()
    expect(screen.getByText('Cash Wallet')).toBeTruthy()
    expect(screen.getByText('Total accounts balance')).toBeTruthy()
    expect(screen.getByText('Current balance')).toBeTruthy()
    expect(screen.queryByText(/Account editing and corrections use today/)).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: /Edit Maybank in Settings/i })[0])
    expect(onNavigateToAccounts).toHaveBeenCalledWith('acc-1')

    fireEvent.click(screen.getByRole('button', { name: 'View account breakdown for Essentials' }))
    fireEvent.click(screen.getByRole('button', { name: /Manage Essentials in Settings/i }))
    expect(onNavigateToAccounts).toHaveBeenCalledWith('Essentials')
  })

  it('labels past-cycle account figures as closing balances and explains where corrections post', () => {
    renderBuckets({ isCurrentCycle: false, cycleLabel: 'Mar 1st ~ Mar 31st' })

    fireEvent.click(screen.getByRole('button', { name: 'View account breakdown for Essentials' }))

    expect(screen.getByText('Balance at close')).toBeTruthy()
    expect(screen.getByText('Total balance at close')).toBeTruthy()
    expect(screen.getByText(/Mar 1st ~ Mar 31st/)).toBeTruthy()
    expect(screen.getByText(/Account editing and corrections use today/)).toBeTruthy()
  })
})
