import type { LedgerAccount } from '../../../types'
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
  splitAccountIds?: Partial<Record<'Essentials' | 'Growth' | 'Stability' | 'Rewards', string>>
  stabilityReloadIntent?: string
  accounts?: LedgerAccount[]
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
  if (state.transactionType === 'transfer') {
    if (state.transferSource === state.transferTarget) {
      if (!state.accountId) errors.accountId = 'Choose the account sending the money.'
      if (!state.counterAccountId) errors.counterAccountId = 'Choose the account receiving the money.'
      if (state.accountId && state.counterAccountId && state.accountId === state.counterAccountId) {
        errors.counterAccountId = 'Choose two different accounts.'
      }
    } else {
      if (!state.accountId) errors.accountId = 'Choose the account sending the money.'
      if (!state.counterAccountId) errors.counterAccountId = 'Choose the account receiving the money.'
    }
  }
  if (state.ledgerCategory && ['Essentials', 'Growth', 'Stability', 'Rewards'].includes(state.ledgerCategory)
    && !state.accountId) {
    errors.accountId = 'Choose the account that holds this bucket money.'
  }
  if (state.ledgerCategory === 'Income') {
    for (const bucket of ['Essentials', 'Growth', 'Stability', 'Rewards'] as const) {
      const accountId = state.splitAccountIds?.[bucket]
      const account = accountId ? state.accounts?.find(candidate => candidate.id === accountId) : undefined
      if (!accountId) errors[`splitAccountIds.${bucket}`] = `Choose the ${bucket} receiving account.`
      else if (state.accounts && (!account || account.bucket !== bucket || account.isArchived)) {
        errors[`splitAccountIds.${bucket}`] = `Choose an open ${bucket} account.`
      }
    }
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
