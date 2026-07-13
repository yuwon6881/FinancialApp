import { describe, expect, it } from 'vitest'
import { validateTransactionForm } from './transactionFormValidation'

const validForm = {
  description: 'Move funds',
  amount: '25.00',
  date: '2026-07-13',
  transactionType: 'transfer',
  transferSource: 'Rewards',
  transferTarget: 'Growth',
}

describe('validateTransactionForm', () => {
  it('accepts a transfer between distinct buckets', () => {
    expect(validateTransactionForm(validForm)).toEqual({})
  })

  it('rejects a transfer to the same bucket', () => {
    expect(validateTransactionForm({ ...validForm, transferTarget: 'Rewards' })).toMatchObject({
      transferTarget: 'Choose a different target category.',
    })
  })
})
