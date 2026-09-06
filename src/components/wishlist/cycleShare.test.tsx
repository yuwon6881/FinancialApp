import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SavingsGoal, WishlistItem } from '../../types'
import type { GoalPace, GoalPoolSummary } from '../../lib/savingsGoals'
import { RewardsPoolBar } from './RewardsPoolBar'
import { RewardCard } from './RewardCard'
import { SavingsGoalCard } from './SavingsGoalCard'

// The cycle share is the number a user acts on ("do I owe anything right now?"), so it is asserted
// as a labelled meter rather than trusted to a caption that is easy to lose in a redesign.
//
// Secondary figures now live behind a "Details" tail, closed by default at phone widths. Tests that
// assert one open it first; tests that assert the visible summary deliberately do not.

const openDetails = (index = 0) => {
  fireEvent.click(screen.getAllByText('Details')[index])
}

/**
 * Matches only what a user can actually read right now.
 *
 * jsdom applies no default stylesheet, so the children of a *closed* native <details> are still in
 * the document and still found by a plain text query. Filtering them out is the only way to assert
 * what the collapsed card shows.
 */
const visible = (matcher: Parameters<typeof screen.queryAllByText>[0]) =>
  screen.queryAllByText(matcher).filter(node => {
    const details = node.closest('details')
    return details === null || details.open
  })

const goal: SavingsGoal = {
  id: 7,
  name: 'Car Maintenance',
  targetAmount: 350,
  earmarkedAmount: 175,
  targetDate: '2026-09-15',
  priority: 'Medium',
  status: 'active',
  isRecurring: true,
  recurrenceMonths: 3,
  cycleFundedAmount: 175,
  createdAt: '2026-01-01T00:00:00.000Z',
}

const pace = (over: Partial<GoalPace> = {}): GoalPace => ({
  goalId: 7,
  remaining: 175,
  cyclesRemaining: 2,
  requiredPerCycle: 175,
  fundedThisCycle: 175,
  outstandingThisCycle: 0,
  isOverdue: false,
  isFunded: false,
  ...over,
})

// A second commitment, because the pool's own cycle panel is what *summing* looks like: with one
// goal every figure in it already appears verbatim on that goal's card, so the panel is suppressed
// and there would be nothing to assert against.
const secondGoal: SavingsGoal = { ...goal, id: 8, name: 'Laptop' }

// jsdom has no matchMedia, so useIsMobile reports desktop and the tails start open. Forcing the
// mobile branch is what makes "collapsed by default" assertable at all.
const asMobile = () => {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

const summary = (over: Partial<GoalPoolSummary> = {}): GoalPoolSummary => ({
  rewardsBalance: 550.4,
  totalEarmarked: 175,
  unassigned: 375.4,
  requiredPerCycleTotal: 175,
  fundedThisCycleTotal: 175,
  outstandingThisCycleTotal: 0,
  paceShortfall: 0,
  hasUnfinishedGoals: true,
  activeGoals: [goal, secondGoal],
  paces: new Map([[7, pace()], [8, pace({ goalId: 8 })]]),
  currentCycleKey: '2026-08',
  ...over,
})

const money = (value: number) => `RM ${value.toFixed(2)}`

const reward: WishlistItem = {
  id: 11,
  name: 'Noise-cancelling headphones',
  price: 250,
  priority: 'Medium',
  isPurchased: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  isActive: false,
}

function renderBar(over: Partial<GoalPoolSummary> = {}) {
  return render(
    <RewardsPoolBar
      summary={summary(over)}
      expectedInflow={379.2}
      formatSensitive={money}
      hideSensitive={false}
      isOffline={false}
      onFundCycle={() => undefined}
    />,
  )
}

function renderRewardsBar(over: Partial<GoalPoolSummary> = {}) {
  return render(
    <RewardsPoolBar
      summary={summary(over)}
      activeView="rewards"
      expectedInflow={379.2}
      formatSensitive={money}
      hideSensitive={false}
      isOffline={false}
      onFundCycle={() => undefined}
    />,
  )
}

function renderCard(over: Partial<GoalPace> = {}) {
  const p = pace(over)
  render(
    <SavingsGoalCard
      goal={goal}
      pace={p}
      status={p.isFunded ? 'funded' : p.outstandingThisCycle > 0 ? 'needsFunding' : 'onPace'}
      formatSensitive={money}
      hideSensitive={false}
      isSyncing={false}
      isDeleting={false}
      onEdit={() => undefined}
      onDelete={() => undefined}
      onComplete={() => undefined}
      onTopUp={() => undefined}
      onRelease={() => undefined}
    />,
  )
}

function renderRewardCard(freeAfterGoalPace = 100, claimableBalance = 100) {
  render(
    <RewardCard
      item={reward}
      isFocused={false}
      claimableBalance={claimableBalance}
      freeAfterGoalPace={freeAfterGoalPace}
      formatSensitive={money}
      hideSensitive={false}
      isSyncing={false}
      isDeleting={false}
      onClaim={() => undefined}
      onFocus={() => undefined}
      onEdit={() => undefined}
      onDelete={() => undefined}
    />,
  )
}

describe('RewardsPoolBar cycle share', () => {
  it('uses distinct full-color segments and leads with the active view', () => {
    const { container, unmount } = renderBar()
    const commitmentsOrder = [...container.querySelectorAll('[data-pool-segment]')]
      .map(segment => segment.getAttribute('data-pool-segment'))
    expect(commitmentsOrder).toEqual(['committed', 'free'])
    unmount()

    const rewardsRender = renderRewardsBar()
    const rewardsSegments = [...rewardsRender.container.querySelectorAll<HTMLElement>('[data-pool-segment]')]
    expect(rewardsSegments.map(segment => segment.dataset.poolSegment)).toEqual(['free', 'committed'])
    expect(rewardsSegments[0].style.backgroundColor).not.toBe(rewardsSegments[1].style.backgroundColor)
  })

  // The pool's split bar is the only track on this card. The cycle's pacing reports as a figure
  // and a share, so the page does not stack a second bar here and a third on every goal card.
  it('shows funded against required, and its share, once the cycle is paced', () => {
    renderBar()
    openDetails()
    expect(screen.getByText(/of RM 175\.00 set aside/)).toBeTruthy()
    expect(screen.getByText(/· 100%/)).toBeTruthy()
    expect(screen.queryByRole('progressbar')).toBeNull()
  })

  it('reports what is still owed and the share reached when the cycle is short', () => {
    renderBar({ fundedThisCycleTotal: 70, outstandingThisCycleTotal: 105 })
    // The shortfall is the visible status line; the figures behind it are a detail.
    expect(screen.getByText(/still to set aside across 2 commitments/)).toBeTruthy()
    openDetails()
    expect(screen.getByText(/of RM 175\.00 set aside/)).toBeTruthy()
    expect(screen.getByText(/· 40%/)).toBeTruthy()
  })

  it('says there is nothing committed instead of rendering an empty cycle block', () => {
    renderBar({ activeGoals: [], paces: new Map(), requiredPerCycleTotal: 0, fundedThisCycleTotal: 0 })
    expect(screen.getByText('No commitments yet')).toBeTruthy()
    openDetails()
    expect(screen.queryByText(/set aside/)).toBeNull()
  })

  // The pool panel, the Committed legend tile and the commitment card each used to spell out the
  // same figure, so with one commitment the page said it three times. The old fix suppressed the
  // pool panel for a single goal; each figure now has one home, so assert that directly.
  it('states each figure once when the pool and its only commitment are on screen together', () => {
    asMobile()
    // A per-cycle figure distinct from the earmarked total, so "RM 60.00 appears nowhere" is a
    // statement about the cycle figures alone and cannot be satisfied by the card's headline.
    const cyclePace = pace({ requiredPerCycle: 60, fundedThisCycle: 60 })
    const single = summary({
      activeGoals: [goal],
      paces: new Map([[7, cyclePace]]),
      requiredPerCycleTotal: 60,
      fundedThisCycleTotal: 60,
    })
    render(
      <>
        <RewardsPoolBar
          summary={single}
          expectedInflow={379.2}
          formatSensitive={money}
          hideSensitive={false}
          isOffline={false}
          onFundCycle={() => undefined}
        />
        <SavingsGoalCard
          goal={goal}
          pace={cyclePace}
          status="onPace"
          formatSensitive={money}
          hideSensitive={false}
          isSyncing={false}
          isDeleting={false}
          onEdit={() => undefined}
          onDelete={() => undefined}
          onComplete={() => undefined}
          onTopUp={() => undefined}
          onRelease={() => undefined}
        />
      </>,
    )

    // Both tails are collapsed, so no per-cycle figure is on screen and the only thing said about
    // this cycle is the card's one status line. Before the restructure this same tree rendered the
    // per-cycle amount three times: the pool inset, the Committed tile and the card inset.
    expect(visible(money(60))).toHaveLength(0)
    expect(visible(/of RM 60\.00 set aside/)).toHaveLength(0)
    expect(visible('Committed')).toHaveLength(0)
    expect(visible('Done for this cycle')).toHaveLength(1)

    // The earmarked total is the card's headline, and belongs to the card alone.
    expect(visible(money(175))).toHaveLength(1)

    // Every figure stays reachable, exactly once, when the tails are opened.
    openDetails(0)
    openDetails(1)
    expect(visible('Committed')).toHaveLength(1)
    expect(visible(/of RM 60\.00 set aside/)).toHaveLength(1)
  })

  it('reports a paced cycle as a status line, never as a disabled button', () => {
    renderBar()
    const funded = screen.getAllByText('Funded this cycle')
    expect(funded.length).toBeGreaterThan(0)
    expect(funded.every(node => node.closest('button') === null)).toBe(true)
    expect(screen.queryByRole('button', { name: /set aside/i })).toBeNull()
  })

  it('offers the funding button, with the outstanding amount on it, while the cycle is short', () => {
    renderBar({ fundedThisCycleTotal: 70, outstandingThisCycleTotal: 105 })
    expect(screen.getByRole('button', { name: /Set aside RM 105\.00/ })).toBeTruthy()
    expect(screen.queryByText('Funded this cycle')).toBeNull()
  })

  // The waterfall grants min(outstanding, free), so the button has to name the amount that will
  // actually move. Labelled with the outstanding figure it promised money the pool did not hold.
  it('names what the free balance can actually cover, not what the cycle owes', () => {
    renderBar({ fundedThisCycleTotal: 70, outstandingThisCycleTotal: 105, unassigned: 40 })
    expect(screen.getByRole('button', { name: /Set aside RM 40\.00/ })).toBeTruthy()
  })

  it('leads with over-commitment and keeps the guidance in the detail tail', () => {
    renderBar({ rewardsBalance: 120, totalEarmarked: 175, unassigned: 0 })
    expect(screen.getByText(/claim RM 55\.00 more than your rewards holds/)).toBeTruthy()

    openDetails()
    expect(screen.getByText(/release money from a commitment/)).toBeTruthy()
  })

  it('lets an unreachable pace outrank the cycle bookkeeping on the status line', () => {
    renderBar({ paceShortfall: 60, fundedThisCycleTotal: 70, outstandingThisCycleTotal: 105 })
    expect(screen.getByText(/RM 60\.00 over budget/)).toBeTruthy()
    expect(screen.queryByText(/still to set aside across/)).toBeNull()
  })

  it('stays quiet about over-commitment while the balance covers the earmarks', () => {
    renderBar()
    expect(screen.queryByText(/more than your rewards holds/)).toBeNull()
  })
})

describe('SavingsGoalCard cycle share', () => {
  it('leads with what this cycle still owes and keeps the figures in the tail', () => {
    renderCard({ fundedThisCycle: 70, outstandingThisCycle: 105 })
    expect(screen.getByText(/RM 105\.00 still to set aside this cycle/)).toBeTruthy()

    openDetails()
    // One bar per card: the commitment's own progress. This cycle's share is a figure beside it,
    // not a second track under it.
    expect(screen.getAllByRole('progressbar').length).toBe(1)
    expect(screen.getByText(/of RM 175\.00 · 40%/)).toBeTruthy()
  })

  it('marks a paced cycle done on the always-visible status line', () => {
    renderCard()
    // Asserted without opening the tail: this is the one line the card must always show.
    expect(screen.getByText('Done for this cycle')).toBeTruthy()
    openDetails()
    expect(screen.getByText(/of RM 175\.00 · 100%/)).toBeTruthy()
  })

  it('says the commitment is ready once it is fully funded', () => {
    renderCard({ isFunded: true, remaining: 0 })
    expect(screen.getByText('Ready to use')).toBeTruthy()
    expect(screen.queryByText(/still to set aside/)).toBeNull()
  })

  // The money actions used to be replaced by Edit/Delete, because six controls would not fit at
  // rail width. They now coexist: the primary pair stays put and the rest sit in a menu.
  it('keeps the money actions available while offering edit and delete in a menu', async () => {
    renderCard()
    const topUp = screen.getByRole('button', { name: 'Add money to Car Maintenance' })

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Car Maintenance' }))

    expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Release money' })).toBeTruthy()
    expect(topUp).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Complete this cycle for Car Maintenance' })).toBeTruthy()
  })
})

describe('RewardCard management actions', () => {
  it('warns when a claimable reward would consume this cycle\'s goal pace', () => {
    renderRewardCard(200, 300)
    expect(screen.getByText(/Buying this leaves your commitments/)).toBeTruthy()
    expect(screen.getByText('RM 50.00')).toBeTruthy()
  })

  it('does not warn when the claim leaves enough free money for the goal pace', () => {
    renderRewardCard(300, 300)
    expect(screen.queryByText(/leaves your commitments/)).toBeNull()
  })

  it('keeps Claim in place while offering the rest in a menu', async () => {
    renderRewardCard()
    const claimButton = screen.getByRole('button', { name: 'Claim' })

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Noise-cancelling headphones' }))

    expect(await screen.findByRole('menuitem', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByRole('menuitem', { name: 'Save toward this next' })).toBeTruthy()
    expect(claimButton).toBeTruthy()
  })

  it('keeps masked figures out of the detail tail and the menu', () => {
    render(
      <RewardCard
        item={reward}
        isFocused={false}
        claimableBalance={100}
        freeAfterGoalPace={100}
        formatSensitive={() => '......'}
        hideSensitive
        isSyncing={false}
        isDeleting={false}
        onClaim={() => undefined}
        onFocus={() => undefined}
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    )
    openDetails()

    expect(screen.queryByText(money(250))).toBeNull()
    expect(screen.queryByText(money(100))).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'More actions for Noise-cancelling headphones' }))
    expect(screen.getByRole('menuitem', { name: 'Edit' }).getAttribute('title')).toBe('Unhide balances to edit')
  })
})
