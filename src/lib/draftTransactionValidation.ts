import type { Transaction, TransactionCategory } from '../types'
import { validateTransactionForm } from '../components/ledger/transaction-form/transactionFormValidation'

const parseTransfer = (ledgerCategory: string) => {
  const [source = '', target = ''] = ledgerCategory.slice('Transfer:'.length).split('->').map(value => value.trim())
  return { source, target }
}

export function getDraftTransactionIssues(
  draft: Transaction,
  categories: TransactionCategory[],
): string[] {
  const isTransfer = draft.ledgerCategory.startsWith('Transfer:')
  const transactionType = isTransfer ? 'transfer' : draft.amount < 0 ? 'outflow' : 'inflow'
  const transfer = isTransfer ? parseTransfer(draft.ledgerCategory) : { source: '', target: '' }
  const errors = validateTransactionForm({
    description: draft.description,
    amount: Math.abs(draft.amount).toFixed(2),
    date: draft.date,
    transactionType,
    ledgerCategory: isTransfer ? '' : draft.ledgerCategory,
    transferSource: transfer.source,
    transferTarget: transfer.target,
    stabilityReloadIntent: draft.stabilityReloadIntent,
  })

  if (!isTransfer) {
    const category = categories.find(item => item.name.toLowerCase() === draft.category.toLowerCase())
    if (!category || category.isPendingDelete || (category.type && category.type !== 'both' && category.type !== transactionType)) {
      errors.category = 'Choose a category that matches this money direction.'
    }
    const allowedLedgerCategories = transactionType === 'inflow'
      ? ['Income', 'Essentials', 'Growth', 'Stability', 'Rewards']
      : ['Essentials', 'Growth', 'Stability', 'Rewards']
    if (!allowedLedgerCategories.includes(draft.ledgerCategory)) {
      errors.ledgerCategory = 'Choose a valid ledger category.'
    }
  }

  return Object.values(errors)
}
