import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { StabilityRecovery } from '../../types'
import { StabilityRecoveryExceptionCard } from './StabilityRecoveryExceptionCard'

const recovery = (overrides: Partial<StabilityRecovery> = {}): StabilityRecovery => ({
  isActive: true,
  markedTotal: 3000,
  target: 10000,
  currentBalance: 7000,
  outstandingShortfall: 3000,
  cyclesRemaining: 3,
  requiredThisCycle: 1000,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 1000,
  isOverdue: false,
  lastDrawdownCycleKey: '2026-06',
  repaidTotal: 0,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [],
  recoveryFromDate: '2026-06-28',
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
  ])('stays hidden when %s', (_label, overrides) => {
    const { container } = render(
      <StabilityRecoveryExceptionCard
        recovery={recovery(overrides as Partial<StabilityRecovery>)}
        formatSensitive={format}
       
      />
    )
    expect(container.innerHTML).toBe('')
  })

  // 871.77 marked with 520 already put back leaves 351.77 genuinely owed, while the three-cycle
  // pace only asks for ceil(871.77 / 3) = 290.59 -- which the 520 already covers. Gating the card on
  // this cycle's ask hid it in exactly that state: below target, still owing, and never told.
  it('keeps reporting the overall shortfall when this cycle is already ahead of the plan', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          markedTotal: 871.77,
          repaidTotal: 520,
          outstandingShortfall: 351.77,
          toppedUpThisCycle: 520,
          requiredThisCycle: 290.59,
          outstandingThisCycle: 0,
        })}
        formatSensitive={format}
      />
    )

    expect(screen.getByText('Your emergency fund is below where it was')).toBeTruthy()
    expect(screen.getByText(/Nothing more is needed this cycle/)).toBeTruthy()
    expect(screen.getByText(/\$351\.77 remains overall across 3 cycles/)).toBeTruthy()
    expect(screen.queryByText(/Put back \$0\.00 more this cycle/)).toBeNull()
  })

  it('says what was used and what putting it back looks like', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} />)

    expect(screen.getByText('Your emergency fund is below where it was')).toBeTruthy()
    expect(screen.getByText(/Put back \$1000\.00 more this cycle/)).toBeTruthy()
    expect(screen.getByText(/\$3000\.00 remains overall across 3 cycles/)).toBeTruthy()
    expect(screen.getByText('Putting it back progress')).toBeTruthy()
    expect(screen.getByText(/0%/)).toBeTruthy()
  })

  it('says so plainly on the last cycle of the plan', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ cyclesRemaining: 1, outstandingThisCycle: 400 })}
        formatSensitive={format}
       
      />
    )

    expect(screen.getByText(/Put back \$400\.00 more this cycle/)).toBeTruthy()
    expect(screen.getByText(/final planned cycle/)).toBeTruthy()
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
    expect(screen.getByText(/\$746\.80 remains/)).toBeTruthy()
  })

  // Putting money back happens by ticking the top-up offer on a salary, so an action here would
  // have pointed at a form that could not do it. Showing the working is not such an action.
  it('offers nothing that claims to change the shortfall', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} />)

    const labelled = screen.queryAllByRole('button').filter(button => button.textContent?.trim())
    expect(labelled.map(button => button.textContent?.trim())).toEqual([])
  })

  it('shows the subtraction the figure comes from', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} />)

    expect(screen.getByText('Taken out and not yet fully back')).toBeTruthy()
    expect(screen.getByText('Put back so far')).toBeTruthy()
    expect(screen.getByText('In it now')).toBeTruthy()
    expect(screen.getByText('Still short')).toBeTruthy()
  })

  // The reported defect showed up here: 800 asked back against 200 owed, because drawdowns already
  // put back in full were still counted. The three figures are one subtraction and must agree.
  it('reports figures that account for exactly what is still owed', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ markedTotal: 300, repaidTotal: 100, outstandingShortfall: 200 })}
        formatSensitive={format}
      />
    )

    expect(screen.getByText('$300.00')).toBeTruthy()
    expect(screen.getByText('$100.00')).toBeTruthy()
    expect(screen.getByText('$200.00')).toBeTruthy()
    // 100 of 300 back, measured against what is still being put back rather than a running history.
    expect(screen.getByText('33%')).toBeTruthy()
  })

  it('opens the ledger on the window the shortfall accumulated over', () => {
    const onNavigateToLedger = vi.fn()
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery()}
        formatSensitive={format}
        onNavigateToLedger={onNavigateToLedger}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /every movement since then/i }))
    expect(onNavigateToLedger).toHaveBeenCalledWith(expect.objectContaining({
      category: 'Stability',
      startDate: '2026-06-28',
      showAllCycles: true,
      reloadFilter: 'put-back',
    }))
  })

  // Without a window there is no date filter to build, so the jump would land on an unfiltered
  // ledger and silently claim to be showing the movements behind the figure.
  it('explains itself instead of linking when no cycle has closed at the high point', () => {
    const onNavigateToLedger = vi.fn()
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ recoveryFromDate: undefined })}
        formatSensitive={format}
        onNavigateToLedger={onNavigateToLedger}
      />
    )

    expect(screen.queryByRole('button', { name: /every movement since then/i })).toBeNull()
    expect(screen.getByText(/no window of movements to list/)).toBeTruthy()
  })

  it('does not go silent when ordinary salary reaches an old high point below target', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ currentBalance: 6300, outstandingShortfall: 3000 })}
        formatSensitive={format}
      />
    )

    expect(screen.getByText(/remains overall/)).toBeTruthy()
  })

  it('stays hidden once the target clears the marked obligation', () => {
    const { container } = render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ isActive: false, outstandingShortfall: 0, outstandingThisCycle: 0, currentBalance: 10000 })}
        formatSensitive={format}
      />
    )

    expect(container.innerHTML).toBe('')
  })
})
