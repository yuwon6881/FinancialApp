import { useMemo } from 'react'
import type { Transaction } from '../../../types'
import { bucketAmount } from '../../../lib/bucketAttribution'
import { drawsFor, projectStabilityRecovery, proposeTopUp } from '../../../lib/stabilityRecovery'
import { getCycleYearAndMonthForDate } from '../../../lib/cycle'
import type { TransactionFormState } from './transactionFormReducer'
import type { StabilityTopUpContext } from './useTransactionFormOptions'

interface UseStabilityTopUpOfferOptions {
  state: TransactionFormState
  transactions: Transaction[]
  cycleDay: number
  stabilityTopUpContext?: StabilityTopUpContext
}

function cycleForDate(value: string, cycleDay: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null
  return getCycleYearAndMonthForDate(date, cycleDay)
}

export function isDateInStabilityTopUpCycle(value: string, context: StabilityTopUpContext | undefined) {
  if (!context) return false
  const cycle = cycleForDate(value, context.cycleDay)
  return cycle?.year === context.cycleYear && cycle.monthIndex === context.cycleMonthIndex
}

export function hasSavedTopUpCycleMismatch(
  state: TransactionFormState,
  cycleDay: number,
) {
  if (!state.originalDate || !state.stabilityTopUpAccepted || Number(state.stabilityTopUpAmount) <= 0) {
    return false
  }
  const original = cycleForDate(state.originalDate, cycleDay)
  const next = cycleForDate(state.date, cycleDay)
  return Boolean(original && next && (original.year !== next.year || original.monthIndex !== next.monthIndex))
}

export function useStabilityTopUpOffer(options: UseStabilityTopUpOfferOptions) {
  const { state, transactions, cycleDay, stabilityTopUpContext } = options
  const isRecoveryCycleDate = isDateInStabilityTopUpCycle(state.date, stabilityTopUpContext)

  const topUpBuckets = useMemo(() => [
    { bucket: 'Essentials', alloc: stabilityTopUpContext?.essentialsAlloc ?? 0, balance: stabilityTopUpContext?.essentialsBalance ?? 0, committed: stabilityTopUpContext?.recovery.essentialsCommitted ?? 0 },
    { bucket: 'Growth', alloc: stabilityTopUpContext?.growthAlloc ?? 0, balance: stabilityTopUpContext?.growthBalance ?? 0, committed: 0 },
    { bucket: 'Rewards', alloc: stabilityTopUpContext?.rewardsAlloc ?? 0, balance: stabilityTopUpContext?.rewardsBalance ?? 0, committed: stabilityTopUpContext?.recovery.rewardsCommitted ?? 0 },
  ], [stabilityTopUpContext])

  const topUpOffer = useMemo(() => {
    if (state.transactionType !== 'inflow' || state.ledgerCategory !== 'Income') return null
    const amount = parseFloat(state.amount)
    if (!Number.isFinite(amount) || amount <= 0) return null

    let recoveryForOffer = isRecoveryCycleDate ? stabilityTopUpContext?.recovery : undefined
    let bucketsForOffer = topUpBuckets
    const original = state.editingId
      ? transactions.find(transaction => String(transaction.id) === String(state.editingId))
      : undefined
    const originalIsIncome = Boolean(original && original.amount > 0 && (
      original.ledgerCategory.toLowerCase() === 'income' ||
      original.ledgerCategory.toLowerCase().startsWith('incomesplit:')
    ))
    const originalIsRecoveryCycleDate = original
      ? isDateInStabilityTopUpCycle(original.date, stabilityTopUpContext)
      : false
    if (recoveryForOffer && original && originalIsIncome && originalIsRecoveryCycleDate) {
      bucketsForOffer = topUpBuckets.map(bucket => {
        const child = transactions.find(transaction => transaction.id === `${original.id}-split-${bucket.bucket}`)
        return child ? { ...bucket, balance: bucket.balance - child.amount } : bucket
      })
      const originalStabilityContribution = transactions
        .filter(transaction => String(transaction.id) === String(original.id) ||
          String(transaction.id).startsWith(`${original.id}-split-`))
        .reduce((sum, transaction) => sum + bucketAmount(transaction, 'Stability'), 0)
      const withoutOriginal = transactions.filter(transaction =>
        String(transaction.id) !== String(original.id) &&
        !String(transaction.id).startsWith(`${original.id}-split-`))
      recoveryForOffer = projectStabilityRecovery({
        recovery: recoveryForOffer,
        baseTransactions: transactions,
        projectedTransactions: withoutOriginal,
        stabilityAlloc: stabilityTopUpContext?.stabilityAlloc ?? 0,
        projectedBalance: recoveryForOffer.currentBalance - originalStabilityContribution,
        planPoints: stabilityTopUpContext?.planPoints,
        currentCycleKey: stabilityTopUpContext?.currentCycleKey,
        // Required for the origin-cycle cohort plan. Without it projectStabilityRecovery cannot
        // place an obligation in its cycle and silently falls back to the pre-cohort single
        // window, so this offer would ask for more than the dashboard's combined plan.
        cycleDay: stabilityTopUpContext?.cycleDay,
      })
    }

    const liveOffer = proposeTopUp(
      recoveryForOffer,
      Math.abs(amount),
      bucketsForOffer,
      stabilityTopUpContext?.stabilityAlloc ?? 0,
    )
    if (liveOffer) return liveOffer

    const saved = (state.mode === 'edit' || state.mode === 'draft') && state.stabilityTopUpAccepted
      ? Number(state.stabilityTopUpAmount)
      : 0
    if (!Number.isFinite(saved) || saved <= 0) return null
    return {
      requestedTopUp: saved,
      proposedTopUp: saved,
      maxTopUp: saved,
      safeCap: saved,
      isReduced: false,
      draws: drawsFor(saved, bucketsForOffer),
    }
  }, [isRecoveryCycleDate, state, stabilityTopUpContext, topUpBuckets, transactions])

  const resolveAcceptedTopUp = () => {
    if (!state.stabilityTopUpAccepted || !topUpOffer) return 0
    const typed = parseFloat(state.stabilityTopUpAmount)
    return state.stabilityTopUpAmount.trim() === '' ? topUpOffer.proposedTopUp : typed
  }

  return {
    resolveAcceptedTopUp,
    topUpBuckets,
    topUpOffer,
    isRecoveryCycleDate,
    savedTopUpMovedAcrossCycles: hasSavedTopUpCycleMismatch(state, cycleDay),
  }
}
