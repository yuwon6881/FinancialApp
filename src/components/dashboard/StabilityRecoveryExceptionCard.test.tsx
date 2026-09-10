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

function openRecoveryDetails() {
  fireEvent.click(screen.getByRole('button', { name: 'See recovery details' }))
}

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
    expect(screen.getByText(/\$351\.77 is still short in total/)).toBeTruthy()
    expect(screen.getByText(/spreads it over 3 cycles, counting this one/)).toBeTruthy()
    expect(screen.queryByText(/Put back \$0\.00/)).toBeNull()
  })

  it('says what was used and what putting it back looks like', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} />)

    expect(screen.getByText('Your emergency fund is below where it was')).toBeTruthy()
    expect(screen.getByText(/Put back \$1000\.00 this cycle/)).toBeTruthy()
    expect(screen.getByText('Putting it back progress')).toBeTruthy()
    expect(screen.getByText(/0%/)).toBeTruthy()
  })

  it('explains overlapping recovery cohorts without shortening the newer plan', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          outstandingShortfall: 800,
          requiredThisCycle: 400,
          toppedUpThisCycle: 100,
          outstandingThisCycle: 300,
          cyclesRemaining: 2,
          recoveryCohorts: [
            {
              originCycleKey: '2026-06', fromDate: '2026-06-04', transactionCount: 1,
              remainingShortfall: 500, cyclesRemaining: 2, requiredThisCycle: 300, isOverdue: false,
            },
            {
              originCycleKey: '2026-07', fromDate: '2026-07-04', transactionCount: 2,
              remainingShortfall: 300, cyclesRemaining: 3, requiredThisCycle: 100, isOverdue: false,
            },
          ],
        })}
        formatSensitive={format}
      />
    )

    openRecoveryDetails()
    expect(screen.getByText(/Each cycle.s Stability spending keeps its own three-cycle plan/)).toBeTruthy()
    expect(screen.getByText('Combined plan for this cycle')).toBeTruthy()
    expect(screen.getByText('Jun 2026 cycle')).toBeTruthy()
    expect(screen.getByText('Jul 2026 cycle')).toBeTruthy()
    expect(screen.getByText('3 cycles left')).toBeTruthy()
    expect(screen.getByText(/Ledger completion still follows the oldest withdrawal first/)).toBeTruthy()
  })

  it('distinguishes an overdue cohort from a newer plan that still has time', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          isOverdue: true,
          cyclesRemaining: 1,
          recoveryCohorts: [
            {
              originCycleKey: '2026-04', fromDate: '2026-04-04', transactionCount: 1,
              remainingShortfall: 200, cyclesRemaining: 1, requiredThisCycle: 200, isOverdue: true,
            },
            {
              originCycleKey: '2026-07', fromDate: '2026-07-04', transactionCount: 1,
              remainingShortfall: 300, cyclesRemaining: 3, requiredThisCycle: 100, isOverdue: false,
            },
          ],
        })}
        formatSensitive={format}
      />
    )

    openRecoveryDetails()
    expect(screen.getByText(/At least one plan is overdue/)).toBeTruthy()
    expect(screen.getByText('Overdue')).toBeTruthy()
    expect(screen.getByText('3 cycles left')).toBeTruthy()
  })

  // The reported confusion: two figures side by side read as "pay 506.64 now AND 1013.27 later".
  // The cycle ask is a slice of the shortfall, so the sentence has to say which of the two contains
  // the other, and the breakdown has to show the slice under the figure it comes out of.
  it('says the cycle ask is part of the shortfall rather than money on top of it', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          markedTotal: 1463.27,
          repaidTotal: 450,
          outstandingShortfall: 1013.27,
          cyclesRemaining: 2,
          requiredThisCycle: 506.64,
          outstandingThisCycle: 506.64,
        })}
        formatSensitive={format}
      />
    )

    openRecoveryDetails()
    expect(screen.getByText(
      /Put back \$506\.64 this cycle — part of the \$1013\.27 still short, not money on top of it/
    )).toBeTruthy()
    expect(screen.getByText(/spreads it over 2 cycles, counting this one/)).toBeTruthy()
    expect(screen.getByText(/^This cycle.s share of that$/)).toBeTruthy()
  })

  // The reported complaint: the fund had just been tapped and the card asked for a third of it back
  // in the same cycle, out of income that had already been split and spent.
  it('asks for nothing in the cycle the money left the fund', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          isDeferred: true,
          outstandingShortfall: 500,
          requiredThisCycle: 0,
          outstandingThisCycle: 0,
          lastDrawdownCycleKey: '2026-07',
        })}
        formatSensitive={format}
      />
    )

    expect(screen.getByText('Starts next cycle')).toBeTruthy()
    expect(screen.getByText(/Nothing to put back this cycle/)).toBeTruthy()
    expect(screen.getByText(/\$500\.00 is short in total/)).toBeTruthy()
    expect(screen.getByText(/Putting it back starts next cycle, spread over 3 cycles/)).toBeTruthy()
    // A deferred cycle is not a funded one, so it must not be congratulated for being ahead.
    expect(screen.queryByText('Ahead of plan')).toBeNull()
    expect(screen.queryByText(/Put back \$0\.00/)).toBeNull()

    openRecoveryDetails()
    expect(screen.getByText('Planned for this cycle')).toBeTruthy()
    expect(screen.getAllByText('Starts next cycle').length).toBeGreaterThan(1)
    // Nothing was asked for, so there is no share for money to be "already back" against.
    expect(screen.queryByText('Of that share, already back')).toBeNull()
  })

  it('still credits money put back early during the deferred cycle', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          isDeferred: true,
          outstandingShortfall: 400,
          requiredThisCycle: 0,
          outstandingThisCycle: 0,
          toppedUpThisCycle: 100,
        })}
        formatSensitive={format}
      />
    )

    openRecoveryDetails()
    expect(screen.getByText('Already put back early')).toBeTruthy()
    expect(screen.getByText('$100.00')).toBeTruthy()
  })

  it('names a deferred cohort in the per-cycle breakdown', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          outstandingShortfall: 900,
          requiredThisCycle: 200,
          outstandingThisCycle: 200,
          recoveryCohorts: [
            {
              originCycleKey: '2026-06', fromDate: '2026-06-04', transactionCount: 1,
              remainingShortfall: 600, cyclesRemaining: 3, requiredThisCycle: 200, isOverdue: false,
            },
            {
              originCycleKey: '2026-07', fromDate: '2026-07-04', transactionCount: 1,
              remainingShortfall: 300, cyclesRemaining: 3, requiredThisCycle: 0, isOverdue: false,
              isDeferred: true,
            },
          ],
        })}
        formatSensitive={format}
      />
    )

    openRecoveryDetails()
    // The live cohort still asks; the new one says when it will start rather than showing a zero.
    expect(screen.getByText('Starts next cycle')).toBeTruthy()
    expect(screen.getByText('3 cycles left')).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
    expect(screen.getByText(/Each plan starts the cycle after the money left/)).toBeTruthy()
  })

  it('says so plainly on the last cycle of the plan', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          cyclesRemaining: 1,
          outstandingShortfall: 400,
          requiredThisCycle: 400,
          outstandingThisCycle: 400,
        })}
        formatSensitive={format}
      />
    )

    // The final cycle asks for the whole remaining shortfall, so naming both would print the same
    // figure twice.
    expect(screen.getByText(/Put back \$400\.00 this cycle to clear what is still short/)).toBeTruthy()
    expect(screen.getByText(/final planned cycle/)).toBeTruthy()
  })

  // Past the window cyclesRemaining sits at 1 forever, so without the overdue flag the card
  // announced "the last cycle of the plan" every cycle from then on.
  it('stops calling every cycle the last one once the window has passed', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          isOverdue: true,
          cyclesRemaining: 1,
          outstandingShortfall: 746.8,
          requiredThisCycle: 746.8,
          outstandingThisCycle: 746.8,
        })}
        formatSensitive={format}
      />
    )

    expect(screen.queryByText(/last cycle of the plan/)).toBeNull()
    expect(screen.getByText(/Put back \$746\.80 this cycle to clear what is still short/)).toBeTruthy()
    expect(screen.getByText(/planned cycles have run out/)).toBeTruthy()
  })

  // Putting money back happens by ticking the top-up offer on a salary, so an action here would
  // have pointed at a form that could not do it. The card only offers a read-only explanation.
  it('offers a read-only recovery details action rather than a mutation', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} />)

    const labelled = screen.queryAllByRole('button').filter(button => button.textContent?.trim())
    expect(labelled.map(button => button.textContent?.trim())).toEqual(['See recovery details'])
  })

  it('shows the subtraction the figure comes from', () => {
    render(<StabilityRecoveryExceptionCard recovery={recovery()} formatSensitive={format} />)

    expect(screen.queryByText('Taken out and not yet fully back')).toBeNull()
    openRecoveryDetails()
    expect(screen.getByText('Taken out and not yet fully back')).toBeTruthy()
    expect(screen.getByText('Put back so far')).toBeTruthy()
    expect(screen.getByText('In it now')).toBeTruthy()
    expect(screen.getByText('Still short')).toBeTruthy()
    expect(screen.getByText('Of that share, already back')).toBeTruthy()
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

    openRecoveryDetails()
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

    openRecoveryDetails()
    fireEvent.click(screen.getByRole('button', { name: /pending reload movements/i }))
    expect(onNavigateToLedger).toHaveBeenCalledWith(expect.objectContaining({
      category: 'Stability',
      startDate: '2026-06-28',
      reloadFilter: 'needs-put-back',
      showAllCycles: true,
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

    openRecoveryDetails()
    expect(screen.queryByRole('button', { name: /pending reload movements/i })).toBeNull()
    expect(screen.getByText(/no window of movements to list/)).toBeTruthy()
  })

  it('does not go silent when ordinary salary reaches an old high point below target', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({ currentBalance: 6300, outstandingShortfall: 3000 })}
        formatSensitive={format}
      />
    )

    expect(screen.getByText(/\$3000\.00 still short/)).toBeTruthy()
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

  // The aggregate counts down the most urgent cohort, so an older plan on its last cycle used to
  // stamp "Final cycle" on the whole card while the list below it offered a newer plan three more.
  it('does not call the recovery final while a newer cohort still has its whole window', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          outstandingShortfall: 900,
          requiredThisCycle: 700,
          outstandingThisCycle: 700,
          cyclesRemaining: 1,
          recoveryCohorts: [
            {
              originCycleKey: '2026-06', fromDate: '2026-06-04', transactionCount: 1,
              remainingShortfall: 600, cyclesRemaining: 1, requiredThisCycle: 600, isOverdue: false,
            },
            {
              originCycleKey: '2026-08', fromDate: '2026-08-04', transactionCount: 1,
              remainingShortfall: 300, cyclesRemaining: 3, requiredThisCycle: 100, isOverdue: false,
            },
          ],
        })}
        formatSensitive={format}
      />
    )

    openRecoveryDetails()
    expect(screen.queryByText('Final cycle')).toBeNull()
    expect(screen.queryByText(/This is the final planned cycle/)).toBeNull()
    expect(screen.getByText(/Each cycle.s Stability spending keeps its own three-cycle plan/)).toBeTruthy()
    expect(screen.getByText('1 cycle left')).toBeTruthy()
    expect(screen.getByText('3 cycles left')).toBeTruthy()
  })

  // A single plan is still the last one when its window runs down to this cycle.
  it('still names the final cycle when only one plan is open', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          cyclesRemaining: 1,
          requiredThisCycle: 3000,
          outstandingThisCycle: 3000,
          recoveryCohorts: [
            {
              originCycleKey: '2026-06', fromDate: '2026-06-04', transactionCount: 1,
              remainingShortfall: 3000, cyclesRemaining: 1, requiredThisCycle: 3000, isOverdue: false,
            },
          ],
        })}
        formatSensitive={format}
      />
    )

    expect(screen.getByText('Final cycle')).toBeTruthy()
    expect(screen.getByText(/This is the final planned cycle/)).toBeTruthy()
  })

  // Calling a sum of cohort shares "this cycle's share of that" describes arithmetic the card does
  // not show, so the label says "combined" instead — at every width, in one copy that wraps rather
  // than two that differed only in a tail the sentence above already carries.
  it('names the combined plan once, at every width', () => {
    render(
      <StabilityRecoveryExceptionCard
        recovery={recovery({
          requiredThisCycle: 400,
          outstandingThisCycle: 400,
          cyclesRemaining: 2,
          recoveryCohorts: [
            {
              originCycleKey: '2026-06', fromDate: '2026-06-04', transactionCount: 1,
              remainingShortfall: 500, cyclesRemaining: 2, requiredThisCycle: 300, isOverdue: false,
            },
            {
              originCycleKey: '2026-07', fromDate: '2026-07-04', transactionCount: 1,
              remainingShortfall: 300, cyclesRemaining: 3, requiredThisCycle: 100, isOverdue: false,
            },
          ],
        })}
        formatSensitive={format}
      />
    )

    openRecoveryDetails()
    expect(screen.getAllByText('Combined plan for this cycle')).toHaveLength(1)
    expect(screen.queryByText(/^This cycle.s share of that$/)).toBeNull()
  })
})
