import { computeIncomeLedgerCategory } from '../../../lib/incomeSplit'
import type { TransactionFormState } from './transactionFormReducer'

export const getTodayDateString = () => {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function mapFormToTransaction(
  state: TransactionFormState,
  options: {
    essentialsAlloc: number
    growthAlloc: number
    stabilityAlloc: number
    rewardsAlloc: number
    stabilityBalance: number
    stabilityTarget: number
    stabilityOverflowRedirect: string
    /** Accepted emergency-fund top-up, already capped. Zero when the offer was left unticked. */
    recoveryTopUp?: number
  }
) {
  const parsedAmount = parseFloat(state.amount)
  let finalAmount = parsedAmount
  let finalLedgerCategory: string = state.ledgerCategory

  if (state.transactionType === 'outflow') {
    finalAmount = -Math.abs(parsedAmount)
  } else if (state.transactionType === 'inflow') {
    finalAmount = Math.abs(parsedAmount)
  } else if (state.transactionType === 'transfer') {
    finalAmount = Math.abs(parsedAmount)
    finalLedgerCategory = `Transfer:${state.transferSource}->${state.transferTarget}`
  }

  const isIncome = state.transactionType === 'inflow' && state.ledgerCategory === 'Income'

  if (isIncome) {
    finalLedgerCategory = computeIncomeLedgerCategory({
      amount: finalAmount,
      essentialsAlloc: options.essentialsAlloc,
      growthAlloc: options.growthAlloc,
      stabilityAlloc: options.stabilityAlloc,
      rewardsAlloc: options.rewardsAlloc,
      stabilityBalance: options.stabilityBalance,
      stabilityTarget: options.stabilityTarget,
      stabilityOverflowRedirect: options.stabilityOverflowRedirect,
      recoveryTopUp: options.recoveryTopUp,
    })
  }

  return {
    description: state.description,
    amount: finalAmount,
    category: state.transactionType === 'transfer' ? 'Transfer' : state.category,
    ledgerCategory: finalLedgerCategory,
    date: state.date,
  }
}
