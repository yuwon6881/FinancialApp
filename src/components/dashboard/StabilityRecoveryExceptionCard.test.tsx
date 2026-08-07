import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { StabilityRecovery } from '../../types'
import { StabilityRecoveryExceptionCard } from './StabilityRecoveryExceptionCard'

const recovery = (overrides: Partial<StabilityRecovery> = {}): StabilityRecovery => ({
  isActive: true,
  highWaterMark: 10000,
  target: 10000,
  recoverableCeiling: 10000,
  currentBalance: 7000,
  outstandingShortfall: 3000,
  cyclesRemaining: 3,
  requiredThisCycle: 1000,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 1000,
  isOverdue: false,
  lastDrawdownCycleKey: '2026-06',
  lastDrawdownAmount: 3000,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [],
  ...overrides,
})

const format = (value: number) => `$${value.toFixed(2)}`

describe('StabilityRecoveryExceptionCard', () => {
  it('stays hidden when there is no recovery block at all', () => {
    const { container } = render(
      <StabilityRecoveryExceptionCard recovery={undefined} formatSensitive={format} />
    )
    expect(container.innerHTML).toBe('')
  })

  it.each([
    ['inactive', { isActive: false }],
    ['nothing left to put back', { outstandingShortfall: 0 }],
    // Deliberately separate from the shortfall gate: the fund can still be short overall while
    // this cycle's share is already back, which is a healthy state Today should not comment on.
    ["this cycle's share already back", { outstandingThisCycle: 0 }],
  ])('stays hidden when %s', (_label, overrides) => {
    const { container } = render(
      <StabilityRecoveryExceptionCard
        recovery={recovery(overrides as Partial<StabilityRecovery>)}
        formatSensitive={format}
       
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('says what was used and what putting it back looks like', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} />)

    expect(screen.getByText('Your emergency fund is below where it was')).toBeTruthy()
    expect(screen.getByText(/You used \$3000\.00 from your emergency fund/)).toBeTruthy()
    expect(screen.getByText(/Spread over 3 cycles/)).toBeTruthy()
    expect(screen.getByText('Emergency fund progress')).toBeTruthy()
    expect(screen.getByText(/70%/)).toBeTruthy()
  })

  it('says so plainly on the last cycle of the plan', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ cyclesRemaining: 1, outstandingThisCycle: 400 })}
        formatSensitive={format}
       
      />
    )

    expect(screen.getByText(/this is the last cycle of the plan/)).toBeTruthy()
  })

  // Past the window cyclesRemaining sits at 1 forever, so without the overdue flag the card
  // announced "the last cycle of the plan" every cycle from then on.
  it('stops calling every cycle the last one once the window has passed', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ isOverdue: true, cyclesRemaining: 1, outstandingShortfall: 746.8 })}
        formatSensitive={format}
       
      />
    )

    expect(screen.queryByText(/last cycle of the plan/)).toBeNull()
    expect(screen.getByText(/\$746\.80 is still to go/)).toBeTruthy()
  })

  // The card is informative only: putting money back happens by ticking the top-up offer on a
  // salary, so an action here would have pointed at a form that could not do it.
  it('offers no action at all', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} />)

    expect(screen.queryAllByRole('button').filter(b => b.textContent?.trim())).toHaveLength(0)
  })
})
