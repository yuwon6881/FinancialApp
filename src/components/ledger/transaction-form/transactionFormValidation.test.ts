import { describe, expect, it } from 'vitest'
import { validateTransactionForm } from './transactionFormValidation'

const validForm = {
  description: 'Move funds',
  amount: '25.00',
  date: '2026-07-13',
  transactionType: 'transfer',
  transferSource: 'Rewards',
  transferTarget: 'Growth',
  accountId: 'acc-rewards-1',
  counterAccountId: 'acc-growth-1',
}

describe('validateTransactionForm', () => {
  it('accepts a transfer between distinct buckets', () => {
    expect(validateTransactionForm(validForm)).toEqual({})
  })

  it('requires distinct accounts for a same-bucket transfer', () => {
    expect(validateTransactionForm({ ...validForm, transferTarget: 'Rewards', counterAccountId: 'acc-rewards-1' })).toMatchObject({
      counterAccountId: 'Choose two different accounts.',
    })
  })

  it('accepts a transfer in the same bucket when distinct accounts are selected', () => {
    expect(validateTransactionForm({
      ...validForm,
      transferTarget: 'Rewards',
      accountId: 'acc-rewards-1',
      counterAccountId: 'acc-rewards-2',
    })).toEqual({})
  })

  it('rejects a transfer in the same bucket when the same account is selected for both legs', () => {
    expect(validateTransactionForm({
      ...validForm,
      transferTarget: 'Rewards',
      accountId: 'acc-rewards-1',
      counterAccountId: 'acc-rewards-1',
    })).toMatchObject({
      counterAccountId: 'Choose two different accounts.',
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
      accountId: 'acc-stability-1',
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
      accountId: 'acc-essentials-1',
      counterAccountId: 'acc-rewards-1',
    }
    expect(validateTransactionForm({ ...base, stabilityReloadIntent: 'Required' })).toEqual({})
    expect(validateTransactionForm({ ...base, stabilityReloadIntent: 'NotRequired' })).toEqual({})
    expect(validateTransactionForm({ ...base, transferSource: 'Essentials' })).toEqual({})
  })
})
