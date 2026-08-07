import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
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
      <StabilityRecoveryExceptionCard recovery={undefined} formatSensitive={format} onAddIncome={vi.fn()} />
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
        onAddIncome={vi.fn()}
      />
    )
    expect(container.innerHTML).toBe('')
  })

  it('says what was used and what putting it back looks like', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} onAddIncome={vi.fn()} />)

    expect(screen.getByText('Your emergency fund is below where it was')).toBeTruthy()
    expect(screen.getByText(/You used \$3000\.00 from your emergency fund/)).toBeTruthy()
    expect(screen.getByText(/Spread over 3 cycles/)).toBeTruthy()
    expect(screen.getByText(/Emergency fund progress: 70% of/)).toBeTruthy()
  })

  it('says so plainly on the last cycle of the plan', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ cyclesRemaining: 1, outstandingThisCycle: 400 })}
        formatSensitive={format}
        onAddIncome={vi.fn()}
      />
    )

    expect(screen.getByText(/this is the last cycle of the plan/)).toBeTruthy()
  })

  it('sends the user to add income', () => {
    const onAddIncome = vi.fn()
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} onAddIncome={onAddIncome} />)

    screen.getByRole('button', { name: 'Add income' }).click()
    expect(onAddIncome).toHaveBeenCalledTimes(1)
  })
})
