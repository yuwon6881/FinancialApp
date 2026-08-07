import { describe, expect, it } from 'vitest'
import { getInitialState, transactionFormReducer, type TransactionFormAction } from './transactionFormReducer'

// The emergency-fund top-up is a per-salary decision. Consent must never survive a form opening or
// arrive pre-ticked from somewhere the user did not choose it, so every action that opens or
// repopulates the form clears it.

const accepted = () => ({
  ...getInitialState('2026-07-09', 'Other'),
  stabilityTopUpAccepted: true,
})

const openingActions: [string, TransactionFormAction][] = [
  ['OPEN_CREATE', { type: 'OPEN_CREATE', payload: { defaultCategory: 'Other', todayDate: '2026-07-09' } }],
  ['OPEN_EDIT', {
    type: 'OPEN_EDIT',
    payload: {
      id: 'tx-1',
      description: 'Salary',
      amount: '1000',
      date: '2026-07-09',
      category: 'Other',
      ledgerCategory: 'Income',
      txType: 'inflow',
    },
  }],
  ['RESET', { type: 'RESET', todayDate: '2026-07-09', defaultCategory: 'Other' }],
  ['APPLY_RECEIPT', { type: 'APPLY_RECEIPT', payload: { amount: '42.00' }, todayDate: '2026-07-09' }],
  ['APPLY_AI_DRAFT', { type: 'APPLY_AI_DRAFT', payload: { fields: { amount: 1000 } }, todayDate: '2026-07-09' }],
]

describe('transactionFormReducer stabilityTopUpAccepted', () => {
  it('starts unticked', () => {
    expect(getInitialState('2026-07-09', 'Other').stabilityTopUpAccepted).toBe(false)
  })

  it.each(openingActions)('is cleared by %s', (_label, action) => {
    expect(transactionFormReducer(accepted(), action).stabilityTopUpAccepted).toBe(false)
  })

  it('is set only by an explicit field change', () => {
    const state = transactionFormReducer(
      getInitialState('2026-07-09', 'Other'),
      { type: 'SET_FIELD', field: 'stabilityTopUpAccepted', value: true }
    )
    expect(state.stabilityTopUpAccepted).toBe(true)
  })

  it('survives unrelated edits within the same open form', () => {
    const state = transactionFormReducer(accepted(), { type: 'SET_FIELD', field: 'amount', value: '1200' })
    expect(state.stabilityTopUpAccepted).toBe(true)
  })
})
