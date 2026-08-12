import { useMemo } from 'react'
import type { StabilityRecovery, Transaction } from '../../../types'
import { bucketAmount } from '../../../lib/bucketAttribution'
import { drawsFor, projectStabilityRecovery, proposeTopUp } from '../../../lib/stabilityRecovery'
import type { TransactionFormState } from './transactionFormReducer'

interface UseStabilityTopUpOfferOptions {
  state: TransactionFormState
  transactions: Transaction[]
  stabilityRecovery?: StabilityRecovery
  essentialsAlloc: number
  growthAlloc: number
  stabilityAlloc: number
  rewardsAlloc: number
  essentialsBalance: number
  growthBalance: number
  rewardsBalance: number
}

export function useStabilityTopUpOffer(options: UseStabilityTopUpOfferOptions) {
  const { state, transactions, stabilityRecovery, essentialsAlloc, growthAlloc, stabilityAlloc,
    rewardsAlloc, essentialsBalance, growthBalance, rewardsBalance } = options

  const topUpBuckets = useMemo(() => [
    { bucket: 'Essentials', alloc: essentialsAlloc, balance: essentialsBalance, committed: stabilityRecovery?.essentialsCommitted ?? 0 },
    { bucket: 'Growth', alloc: growthAlloc, balance: growthBalance, committed: 0 },
    { bucket: 'Rewards', alloc: rewardsAlloc, balance: rewardsBalance, committed: stabilityRecovery?.rewardsCommitted ?? 0 },
  ], [essentialsAlloc, growthAlloc, rewardsAlloc, essentialsBalance, growthBalance, rewardsBalance, stabilityRecovery])

  const topUpOffer = useMemo(() => {
    if (state.transactionType !== 'inflow' || state.ledgerCategory !== 'Income') return null
    const amount = parseFloat(state.amount)
    if (!Number.isFinite(amount) || amount <= 0) return null

    let recoveryForOffer = stabilityRecovery
    let bucketsForOffer = topUpBuckets
    const original = state.editingId
      ? transactions.find(transaction => String(transaction.id) === String(state.editingId))
      : undefined
    const originalIsIncome = Boolean(original && original.amount > 0 && (
      original.ledgerCategory.toLowerCase() === 'income' ||
      original.ledgerCategory.toLowerCase().startsWith('incomesplit:')
    ))
    if (recoveryForOffer && original && originalIsIncome) {
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
        stabilityAlloc,
        projectedBalance: recoveryForOffer.currentBalance - originalStabilityContribution,
      })
    }

    const liveOffer = proposeTopUp(recoveryForOffer, Math.abs(amount), bucketsForOffer, stabilityAlloc)
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
  }, [stabilityAlloc, state, stabilityRecovery, topUpBuckets, transactions])

  const resolveAcceptedTopUp = () => {
    if (!state.stabilityTopUpAccepted || !topUpOffer) return 0
    const typed = parseFloat(state.stabilityTopUpAmount)
    return state.stabilityTopUpAmount.trim() === '' ? topUpOffer.proposedTopUp : typed
  }

  return { resolveAcceptedTopUp, topUpBuckets, topUpOffer }
}
