import { useMemo } from 'react'
import type { Transaction } from '../../../types'
import type { TransactionFormState } from './transactionFormReducer'
import { getBucketOutflowWarning, type BucketOutflowWarning, type OutflowBucket } from '../../../lib/transactionBucketWarnings'
import type { UseTransactionFormOptions } from './useTransactionFormOptions'

export function useTransactionOutflowWarning(
  state: TransactionFormState,
  transactions: Transaction[],
  options: Pick<UseTransactionFormOptions, 'ledgerSummaries' | 'savingsGoals' | 'activeRecurringPayments' | 'stabilityTarget'>,
) {
  const outflowBucket: OutflowBucket | null = useMemo(() => {
    if (state.transactionType === 'transfer') {
      return (state.transferSource as OutflowBucket) ?? 'Essentials'
    }
    if (
      state.transactionType === 'outflow' &&
      state.ledgerCategory !== 'AccountMove' &&
      state.ledgerCategory !== 'Income'
    ) {
      return (state.ledgerCategory as OutflowBucket) ?? 'Essentials'
    }
    return null
  }, [state.transactionType, state.transferSource, state.ledgerCategory])

  const existingAmountInBucket = useMemo(() => {
    if (state.mode !== 'edit' || !state.editingId) return 0
    const original = transactions.find(t => t.id === state.editingId)
    if (!original || !outflowBucket) return 0

    const isTransfer = original.ledgerCategory.startsWith('Transfer:')
    if (isTransfer) {
      const originalSource = original.ledgerCategory.substring(9).split('->')[0].trim()
      return originalSource.toLowerCase() === outflowBucket.toLowerCase()
        ? Math.abs(original.amount)
        : 0
    }
    if (original.ledgerCategory.toLowerCase() === outflowBucket.toLowerCase()) {
      return Math.abs(original.amount)
    }
    return 0
  }, [state.mode, state.editingId, transactions, outflowBucket])

  const bucketOutflowWarning = useMemo<BucketOutflowWarning | null>(() => {
    if (!outflowBucket) return null
    const parsedAmount = parseFloat(state.amount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null

    return getBucketOutflowWarning({
      bucket: outflowBucket,
      amount: parsedAmount,
      existingAmountInBucket,
      context: {
        categories: options.ledgerSummaries,
        savingsGoals: options.savingsGoals,
        activeRecurringPayments: options.activeRecurringPayments,
        targetStabilityFund: options.stabilityTarget,
      },
    })
  }, [
    outflowBucket,
    state.amount,
    existingAmountInBucket,
    options.ledgerSummaries,
    options.savingsGoals,
    options.activeRecurringPayments,
    options.stabilityTarget,
  ])

  return bucketOutflowWarning
}
