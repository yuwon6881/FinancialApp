import { describe, expect, it } from 'vitest'
import type { StabilityRecovery } from '../../../types'
import { getInitialState } from './transactionFormReducer'
import { hasSavedTopUpCycleMismatch, isDateInStabilityTopUpCycle } from './useStabilityTopUpOffer'
import type { StabilityTopUpContext } from './useTransactionFormOptions'

const recovery: StabilityRecovery = {
  isActive: true,
  markedTotal: 1000,
  target: 10000,
  currentBalance: 9000,
  outstandingShortfall: 1000,
  cyclesRemaining: 3,
  requiredThisCycle: 333.34,
  toppedUpThisCycle: 0,
  outstandingThisCycle: 333.34,
  isOverdue: false,
  repaidTotal: 0,
  essentialsCommitted: 0,
  rewardsCommitted: 0,
  suggestedDraws: [],
}

const context: StabilityTopUpContext = {
  recovery,
  cycleYear: 2026,
  cycleMonthIndex: 8,
  cycleDay: 28,
  essentialsAlloc: 0.5,
  growthAlloc: 0.25,
  stabilityAlloc: 0.15,
  rewardsAlloc: 0.1,
  essentialsBalance: 1000,
  growthBalance: 1000,
  rewardsBalance: 1000,
  stabilityOverflowRedirect: 'Growth 100%',
}

describe('isDateInStabilityTopUpCycle', () => {
  it('uses the posting date and configured cycle boundary', () => {
    expect(isDateInStabilityTopUpCycle('2026-08-28', context)).toBe(true)
    expect(isDateInStabilityTopUpCycle('2026-09-27', context)).toBe(true)
    expect(isDateInStabilityTopUpCycle('2026-08-27', context)).toBe(false)
    expect(isDateInStabilityTopUpCycle('2026-09-28', context)).toBe(false)
  })

  it('does not offer against missing context or malformed dates', () => {
    expect(isDateInStabilityTopUpCycle('2026-08-28', undefined)).toBe(false)
    expect(isDateInStabilityTopUpCycle('not-a-date', context)).toBe(false)
  })
})

describe('hasSavedTopUpCycleMismatch', () => {
  it('requires explicit removal before a saved reimbursement moves cycles', () => {
    const state = {
      ...getInitialState('2026-08-30', 'Salary'),
      mode: 'edit' as const,
      originalDate: '2026-08-30',
      date: '2026-09-28',
      stabilityTopUpAccepted: true,
      stabilityTopUpAmount: '250.00',
    }

    expect(hasSavedTopUpCycleMismatch(state, context.cycleDay)).toBe(true)
    expect(hasSavedTopUpCycleMismatch({ ...state, stabilityTopUpAccepted: false }, context.cycleDay)).toBe(false)
    expect(hasSavedTopUpCycleMismatch({ ...state, date: '2026-09-27' }, context.cycleDay)).toBe(false)
  })
})
