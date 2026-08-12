import { isStabilityReloadFormDrawdown } from '../../../lib/stabilityRecovery'

export function validateTransactionForm(state: {
  description: string
  amount: string
  date: string
  transactionType?: string
  ledgerCategory?: string
  transferSource?: string
  transferTarget?: string
  accountId?: string | null
  counterAccountId?: string | null
  stabilityReloadIntent?: string
}) {
  const errors: Record<string, string> = {}
  if (!state.description.trim()) {
    errors.description = 'Description is required.'
  }
  const parsedAmount = parseFloat(state.amount)
  if (!state.amount.trim()) {
    errors.amount = 'Amount is required.'
  } else if (isNaN(parsedAmount) || parsedAmount <= 0) {
    errors.amount = 'Please enter a valid amount greater than 0.'
  }
  if (!state.date) {
    errors.date = 'Posting date is required.'
  }
  if (state.transactionType === 'transfer' && state.transferSource === state.transferTarget) {
    errors.transferTarget = 'Choose a different target category.'
  }
  if (state.ledgerCategory === 'AccountMove') {
    if (!state.accountId) errors.accountId = 'Choose the account money is leaving.'
    if (!state.counterAccountId) errors.counterAccountId = 'Choose the account receiving the money.'
    if (state.accountId && state.accountId === state.counterAccountId) {
      errors.counterAccountId = 'Choose two different accounts.'
    }
  }
  if (isStabilityReloadFormDrawdown({
    transactionType: state.transactionType ?? '',
    ledgerCategory: state.ledgerCategory ?? '',
    transferSource: state.transferSource ?? '',
  }) && state.stabilityReloadIntent !== 'Required' && state.stabilityReloadIntent !== 'NotRequired') {
    errors.stabilityReloadIntent = 'Choose whether you will put this money back.'
  }
  return errors
}
