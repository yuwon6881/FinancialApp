import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StabilityRecovery } from '../../types'
import { StabilityRecoveryDetails } from './StabilityRecoveryDetails'

const format = (value: number) => `$${value.toFixed(2)}`

const baseRecovery = (overrides: Partial<StabilityRecovery> = {}): StabilityRecovery => ({
  isActive: true,
  markedTotal: 1000,
  repaidTotal: 200,
  outstandingShortfall: 800,
  target: 5000,
  currentBalance: 4200,
  cyclesRemaining: 3,
  requiredThisCycle: 300,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 300,
  isOverdue: false,
  lastDrawdownCycleKey: '2026-08',
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [],
  recoveryFromDate: '2026-08-01',
  ...overrides,
})

describe('StabilityRecoveryDetails', () => {
  it('renders single active cohort without redundant list box', () => {
    const recovery = baseRecovery({
      markedTotal: 696.05,
      repaidTotal: 10.16,
      outstandingShortfall: 685.89,
      requiredThisCycle: 416.23,
      toppedUpThisCycle: 416.23,
      outstandingThisCycle: 0,
      recoveryCohorts: [
        {
          originCycleKey: '2026-07',
          fromDate: '2026-08-15',
          transactionCount: 5,
          remainingShortfall: 0,
          cyclesRemaining: 2,
          requiredThisCycle: 146.54,
          isOverdue: false,
        },
        {
          originCycleKey: '2026-08',
          fromDate: '2026-09-10',
          transactionCount: 4,
          remainingShortfall: 685.89,
          cyclesRemaining: 3,
          requiredThisCycle: 269.69,
          isOverdue: false,
        },
      ],
    })

    const { container } = render(<StabilityRecoveryDetails recovery={recovery} formatSensitive={format} />)

    // Top card
    expect(screen.getByText('Total still to put back')).toBeTruthy()
    expect(screen.getByText('Aug 2026 withdrawal · Plan ends Nov 2026')).toBeTruthy()
    // No list box rendered for single cohort
    expect(container.querySelector('ul')).toBeNull()
    expect(screen.queryByText('Withdrawal plans')).toBeNull()

    // Current cycle section
    expect(screen.getByRole('heading', { name: 'This cycle' })).toBeTruthy()
    expect(screen.getByText('$416.23 of $416.23')).toBeTruthy()
    expect(screen.getByText('Covered. Remaining balance is for Nov 2026 cycle.')).toBeTruthy()

    // Calculation section
    expect(screen.getByText('Calculation')).toBeTruthy()
    expect(screen.getByText('Original withdrawals')).toBeTruthy()
    expect(screen.getByText('$696.05')).toBeTruthy()
    expect(screen.getByText('Put back so far')).toBeTruthy()
    expect(screen.getByText('− $10.16')).toBeTruthy()
    expect(screen.getByText('Remaining shortfall')).toBeTruthy()
    expect(screen.getAllByText('$685.89').length).toBeGreaterThan(0)
    expect(screen.queryByText(/Fully repaid withdrawals are excluded/)).toBeNull()
  })

  it('renders multiple active cohorts with summary in top card and grouped list section', () => {
    const recovery = baseRecovery({
      markedTotal: 1200,
      repaidTotal: 200,
      outstandingShortfall: 1000,
      requiredThisCycle: 400,
      toppedUpThisCycle: 100,
      outstandingThisCycle: 300,
      recoveryCohorts: [
        {
          originCycleKey: '2026-06',
          fromDate: '2026-06-04',
          transactionCount: 1,
          remainingShortfall: 600,
          cyclesRemaining: 2,
          requiredThisCycle: 300,
          isOverdue: false,
        },
        {
          originCycleKey: '2026-08',
          fromDate: '2026-08-04',
          transactionCount: 2,
          remainingShortfall: 400,
          cyclesRemaining: 3,
          requiredThisCycle: 100,
          isOverdue: false,
        },
      ],
    })

    render(<StabilityRecoveryDetails recovery={recovery} formatSensitive={format} />)

    // Top card summary
    expect(screen.getByText('2 active plans · Latest ends Nov 2026')).toBeTruthy()

    // Withdrawal plans section
    const listSection = screen.getByRole('region', { name: 'Withdrawal plans' })
    expect(within(listSection).getByRole('heading', { name: 'Withdrawal plans' })).toBeTruthy()
    expect(within(listSection).getByText('Jun 2026 cycle')).toBeTruthy()
    expect(within(listSection).getByText('Plan ends Sep 2026 cycle')).toBeTruthy()
    expect(within(listSection).getByText('$600.00')).toBeTruthy()
    expect(within(listSection).getByText('Aug 2026 cycle')).toBeTruthy()
    expect(within(listSection).getByText('Plan ends Nov 2026 cycle')).toBeTruthy()
    expect(within(listSection).getByText('$400.00')).toBeTruthy()

    // Calculation section with multiple plans
    expect(screen.getByText('Original withdrawals (2 plans)')).toBeTruthy()
    expect(screen.getByText('Put back so far')).toBeTruthy()
    expect(screen.getByText('− $200.00')).toBeTruthy()
    expect(screen.getByText('Remaining shortfall')).toBeTruthy()
    expect(screen.getAllByText('$1000.00')).toHaveLength(2)
  })

  it('handles deferred recovery status cleanly', () => {
    const recovery = baseRecovery({
      isDeferred: true,
      requiredThisCycle: 0,
      outstandingThisCycle: 0,
      toppedUpThisCycle: 50,
      recoveryCohorts: [
        {
          originCycleKey: '2026-08',
          fromDate: '2026-08-15',
          transactionCount: 1,
          remainingShortfall: 400,
          cyclesRemaining: 3,
          requiredThisCycle: 0,
          isOverdue: false,
          isDeferred: true,
        },
      ],
    })

    render(<StabilityRecoveryDetails recovery={recovery} formatSensitive={format} />)

    expect(screen.getByRole('heading', { name: 'This cycle' })).toBeTruthy()
    expect(screen.getByText('Starts next cycle')).toBeTruthy()
    expect(screen.getByText('Already put back early: $50.00')).toBeTruthy()
  })
})
