import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CycleProgress } from '../../lib/cycle'
import { evaluateEssentialsChallenge, type EssentialsChallengeInput } from '../../lib/essentialsChallenge'
import { EssentialsChallengeCard } from './EssentialsChallengeCard'

const formatSensitive = (value: number) => `$${value.toFixed(2)}`

const activeCycle: CycleProgress = {
  phase: 'active',
  totalDays: 30,
  dayNumber: 15,
  daysLeft: 16,
  daysUntilStart: 0,
  progressPct: 50,
  endDate: new Date('2026-08-27T23:59:59'),
  nextStartDate: new Date('2026-08-28T00:00:00'),
}

const baseInput: EssentialsChallengeInput = {
  totalAvailable: 2000,
  projectedRemaining: 1000,
  projectedEndingBalance: 200,
  currentDailyPace: 40,
  unpaidRecurringCount: 0,
  exceededCategoryLimits: 0,
  cycle: activeCycle,
}

const renderCard = (
  input: Partial<EssentialsChallengeInput> = {},
  cycle: CycleProgress = activeCycle,
  onReviewEssentials?: () => void,
) => render(
  <EssentialsChallengeCard
    challenge={evaluateEssentialsChallenge({ ...baseInput, ...input, cycle })}
    cycle={cycle}
    formatSensitive={formatSensitive}
    onReviewEssentials={onReviewEssentials}
  />,
)

describe('EssentialsChallengeCard ranks', () => {
  it('names the rank, shows the score, and places the pace marker at the elapsed share', () => {
    const { container } = renderCard({ projectedRemaining: 1600, projectedEndingBalance: 1200 })

    expect(screen.getByRole('heading', { name: 'Cruising' })).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
    expect(screen.getByText(/20% committed with 50% of the cycle gone/)).toBeTruthy()
    expect(screen.getByText(/\$1,?200\.00 ahead of where the plan expects you/)).toBeTruthy()

    const marker = container.querySelector('[style*="left: 50%"]')
    expect(marker).toBeTruthy()
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('20')
  })

  it('separates being over by a little from being over by a lot', () => {
    renderCard({ projectedRemaining: -150, projectedEndingBalance: -150 })
    expect(screen.getByRole('heading', { name: 'Just over' })).toBeTruthy()
    expect(screen.getByText(/Essentials is \$150\.00 past its money/)).toBeTruthy()

    screen.getByRole('heading', { name: 'Just over' })
    renderCard({ projectedRemaining: -400, projectedEndingBalance: -400 })
    expect(screen.getByRole('heading', { name: 'Well over' })).toBeTruthy()
  })

  it('warns that a bucket still holding money is on course to close short', () => {
    renderCard({ projectedRemaining: 600, projectedEndingBalance: -120 })
    expect(screen.getByRole('heading', { name: 'Heading over' })).toBeTruthy()
    expect(screen.getByText(/closes about \$120\.00 short/)).toBeTruthy()
  })

  it('caps the bar at full while still reporting the true committed share', () => {
    renderCard({ projectedRemaining: -1000, projectedEndingBalance: -1000 })
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100')
    expect(screen.getByText('150%')).toBeTruthy()
  })
})

describe('EssentialsChallengeCard guidance', () => {
  it('offers the daily allowance that keeps the cycle inside the plan and displays the daily spending target', () => {
    renderCard({ projectedRemaining: 1600, currentDailyPace: 10, projectedEndingBalance: 1200 })
    expect(screen.getByText('Daily spending target')).toBeTruthy()
    expect(screen.getByText(/Staying under \$100\.00 a day for the last 16 days/)).toBeTruthy()
  })

  it('names the gap when the current pace outruns the allowance', () => {
    renderCard({ projectedRemaining: 320, projectedEndingBalance: 10, currentDailyPace: 60 })
    expect(screen.getByText(/spending \$60\.00 a day against the \$20\.00 a day that is left/)).toBeTruthy()
  })

  it('does not suggest a daily allowance for a cycle with no money left to give and clarifies deficit recovery', () => {
    renderCard({ projectedRemaining: -150, projectedEndingBalance: -150 })
    expect(screen.getByText(/putting \$150\.00 back clears the red/)).toBeTruthy()
  })

  it('renders a direct link to review Essentials spending when provided', () => {
    const onReview = vi.fn()
    renderCard({ projectedRemaining: 1600, projectedEndingBalance: 1200 }, activeCycle, onReview)

    const reviewButton = screen.getByRole('button', { name: /Review Essentials spending/i })
    expect(reviewButton).toBeTruthy()
    reviewButton.click()
    expect(onReview).toHaveBeenCalledTimes(1)
  })
})

describe('EssentialsChallengeCard states without a rank', () => {
  it('says an unfunded cycle has nothing to rank instead of scoring zero', () => {
    renderCard({ totalAvailable: 0, projectedRemaining: 0, projectedEndingBalance: 0 })

    expect(screen.getByRole('heading', { name: 'Waiting on funding' })).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(screen.queryByText('Badges')).toBeNull()
    expect(screen.queryByText('Daily spending target')).toBeNull()
    expect(screen.getByText(/starts as soon as income is split into Essentials/)).toBeTruthy()
  })

  it('holds the rank back until an upcoming cycle begins', () => {
    const upcoming: CycleProgress = { ...activeCycle, phase: 'upcoming', dayNumber: 0, daysLeft: 30, daysUntilStart: 3, progressPct: 0 }
    renderCard({ projectedRemaining: 2000 }, upcoming)

    expect(screen.getByRole('heading', { name: 'Starts soon' })).toBeTruthy()
    expect(screen.getByText('Starts in 3 days')).toBeTruthy()
  })

  it('reports a closed cycle in the past tense with its final balance', () => {
    const ended: CycleProgress = { ...activeCycle, phase: 'ended', dayNumber: 30, daysLeft: 0, progressPct: 100 }
    renderCard({ projectedRemaining: 300, projectedEndingBalance: 300 }, ended)

    expect(screen.getByRole('heading', { name: 'Finished under' })).toBeTruthy()
    expect(screen.getByText('Essentials closed with $300.00 unspent.')).toBeTruthy()
    expect(screen.getByText('Cycle closed')).toBeTruthy()
  })
})

describe('EssentialsChallengeCard badges', () => {
  it('marks each badge with a state screen readers can read and provides touch/keyboard InfoHint', () => {
    renderCard({ projectedRemaining: 1600, projectedEndingBalance: 1200 })

    const badges = screen.getByRole('list')
    expect(within(badges).getByText(/Earned: no bill is waiting to be paid/)).toBeTruthy()
    expect(screen.getByText('4 of 4')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'What is Bills clear?' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'What is Under pace?' })).toBeTruthy()
  })

  it('withholds the badges whose conditions are not met', () => {
    renderCard({
      projectedRemaining: 600,
      projectedEndingBalance: -10,
      unpaidRecurringCount: 2,
      exceededCategoryLimits: 1,
    })

    const badges = screen.getByRole('list')
    expect(within(badges).getByText(/Not yet: at least one bill is still waiting/)).toBeTruthy()
    expect(within(badges).getByText(/Not yet: at least one tracked category is over its limit/)).toBeTruthy()
    expect(screen.getByText('0 of 4')).toBeTruthy()
  })
})

describe('EssentialsChallengeCard sensitive mode', () => {
  it('masks every amount while keeping the rank and the shares readable', () => {
    render(
      <EssentialsChallengeCard
        challenge={evaluateEssentialsChallenge({ ...baseInput, projectedRemaining: 1600, projectedEndingBalance: 1200 })}
        cycle={activeCycle}
        formatSensitive={() => '•••'}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Cruising' })).toBeTruthy()
    expect(screen.getByText('20%')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
    expect(screen.queryByText(/\$/)).toBeNull()
  })
})
