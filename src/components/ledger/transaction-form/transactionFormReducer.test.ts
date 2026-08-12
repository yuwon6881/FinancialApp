import { describe, expect, it } from 'vitest'
import { getInitialState, transactionFormReducer, type TransactionFormAction } from './transactionFormReducer'

// New/drafted salaries never inherit consent. Editing a persisted reimbursement is different: its
// intent must remain explicit and stable through ordinary edits.

const accepted = () => ({
  ...getInitialState('2026-07-09', 'Other'),
  stabilityTopUpAccepted: true,
  stabilityTopUpAmount: '250.00',
})

const openingActions: [string, TransactionFormAction][] = [
  ['OPEN_CREATE', { type: 'OPEN_CREATE', payload: { defaultCategory: 'Other', todayDate: '2026-07-09' } }],
  ['RESET', { type: 'RESET', todayDate: '2026-07-09', defaultCategory: 'Other' }],
  ['APPLY_RECEIPT', { type: 'APPLY_RECEIPT', payload: { amount: '42.00' }, todayDate: '2026-07-09' }],
  ['APPLY_AI_DRAFT', { type: 'APPLY_AI_DRAFT', payload: { fields: { amount: 1000 } }, todayDate: '2026-07-09' }],
]

describe('transactionFormReducer stabilityTopUpAccepted', () => {
  it('starts unticked', () => {
    expect(getInitialState('2026-07-09', 'Other').stabilityTopUpAccepted).toBe(false)
  })

  it('starts an emergency-fund answer unanswered', () => {
    expect(getInitialState('2026-07-09', 'Other').stabilityReloadIntent).toBe('Unanswered')
  })

  it.each(openingActions)('is cleared by %s, amount included', (_label, action) => {
    const next = transactionFormReducer(accepted(), action)
    expect(next.stabilityTopUpAccepted).toBe(false)
    // An amount left over from a previous entry would silently move money on the next one.
    expect(next.stabilityTopUpAmount).toBe('')
  })

  it('starts with an empty amount so the offer supplies the default', () => {
    expect(getInitialState('2026-07-09', 'Other').stabilityTopUpAmount).toBe('')
  })

  it('loads a persisted reimbursement checked when editing', () => {
    const next = transactionFormReducer(accepted(), {
      type: 'OPEN_EDIT',
      payload: {
        id: 'tx-1', description: 'Salary', amount: '1000', date: '2026-07-09',
        category: 'Other', ledgerCategory: 'Income', txType: 'inflow',
        stabilityRecoveryTopUpAmount: 250,
      },
    })

    expect(next.stabilityTopUpAccepted).toBe(true)
    expect(next.stabilityTopUpAmount).toBe('250.00')
  })

  it.each(['OPEN_EDIT', 'OPEN_DRAFT'] as const)('normalizes an encoded income row for %s', type => {
    const next = transactionFormReducer(getInitialState('2026-07-09', 'Other'), {
      type,
      payload: {
        id: 'salary-1', description: 'Salary', amount: '1000', date: '2026-07-09',
        category: 'Other', ledgerCategory: 'IncomeSplit:50,25,15,10', txType: 'inflow',
        stabilityRecoveryTopUpAmount: 250,
      },
    })

    expect(next.ledgerCategory).toBe('Income')
    expect(next.stabilityTopUpAccepted).toBe(true)
    expect(next.stabilityTopUpAmount).toBe('250.00')
  })

  it('loads the persisted emergency-fund answer when editing', () => {
    const next = transactionFormReducer(getInitialState('2026-07-09', 'Other'), {
      type: 'OPEN_EDIT',
      payload: {
        id: 'tx-2', description: 'Emergency fund spend', amount: '250', date: '2026-07-09',
        category: 'Other', ledgerCategory: 'Stability', txType: 'outflow',
        stabilityReloadIntent: 'NotRequired',
      },
    })

    expect(next.stabilityReloadIntent).toBe('NotRequired')
  })

  it('opens a local draft without treating it as a persisted edit', () => {
    const next = transactionFormReducer(getInitialState('2026-07-09', 'Other'), {
      type: 'OPEN_DRAFT',
      payload: {
        id: 'draft-1', description: 'Emergency fund spend', amount: '250', date: '2026-07-09',
        category: 'Other', ledgerCategory: 'Stability', txType: 'outflow',
        stabilityReloadIntent: 'Required',
      },
    })

    expect(next).toMatchObject({
      mode: 'draft',
      editingId: 'draft-1',
      stabilityReloadIntent: 'Required',
      showAddForm: true,
    })
  })

  it('does not carry the answer through a new entry or an unrelated edit', () => {
    const answered = transactionFormReducer(getInitialState('2026-07-09', 'Other'), {
      type: 'SET_FIELD', field: 'stabilityReloadIntent', value: 'Required',
    })
    expect(transactionFormReducer(answered, openingActions[0][1]).stabilityReloadIntent).toBe('Unanswered')
    expect(transactionFormReducer(answered, {
      type: 'SET_FIELD', field: 'amount', value: '1200',
    }).stabilityReloadIntent).toBe('Required')
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

  it('normalizes a numeric OCR amount to the form string contract', () => {
    const state = transactionFormReducer(
      getInitialState('2026-07-09', 'Other'),
      {
        type: 'APPLY_RECEIPT',
        payload: { amount: 42.5 },
        todayDate: '2026-07-09',
      },
    )

    expect(state.amount).toBe('42.50')
  })
})
