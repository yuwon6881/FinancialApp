export function validateTransactionForm(state: {
  description: string
  amount: string
  date: string
  transactionType?: string
  transferSource?: string
  transferTarget?: string
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
  return errors
}
