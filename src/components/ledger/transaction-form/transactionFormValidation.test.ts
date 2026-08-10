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

  it('requires an answer when an outflow takes money from Stability', () => {
    expect(validateTransactionForm({
      description: 'Emergency fund spend',
      amount: '25.00',
      date: '2026-07-13',
      transactionType: 'outflow',
      ledgerCategory: 'Stability',
      transferSource: 'Essentials',
      transferTarget: 'Rewards',
      stabilityReloadIntent: 'Unanswered',
    })).toMatchObject({
      stabilityReloadIntent: 'Choose whether you will put this money back.',
    })
  })

  it('accepts either explicit answer and ignores the field for other categories', () => {
    const base = {
      description: 'Emergency fund spend',
      amount: '25.00',
      date: '2026-07-13',
      transactionType: 'transfer',
      ledgerCategory: 'Essentials',
      transferSource: 'Stability',
      transferTarget: 'Rewards',
    }
    expect(validateTransactionForm({ ...base, stabilityReloadIntent: 'Required' })).toEqual({})
    expect(validateTransactionForm({ ...base, stabilityReloadIntent: 'NotRequired' })).toEqual({})
    expect(validateTransactionForm({ ...base, transferSource: 'Essentials' })).toEqual({})
  })
})
