import { describe, expect, it } from 'vitest'
import { buildAiLedgerDraftTransactions } from './aiLedgerDrafts'
import type { LedgerAccount, TransactionCategory } from '../types'

const categories = [
  { id: 'food', name: 'Food' },
  { id: 'other', name: 'Other' },
] as TransactionCategory[]

const account = (id: string, bucket: string, isArchived = false) =>
  ({ id, name: id, bucket, isArchived }) as LedgerAccount

describe('buildAiLedgerDraftTransactions account placement', () => {
  // The assistant may name an account only when the user did -- with an "@" mention or the exact
  // name -- so it must never pick between two on its own. A bucket with one open account
  // preselects it; a bucket with several leaves the field for the person reviewing the draft,
  // which is the gate every other writer goes through.
  it('preselects a bucket holding exactly one open account', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      { description: 'lunch', amount: 12, txType: 'outflow', ledgerCategory: 'essentials', ledgerCategorySpecified: true },
      categories,
      [account('ess-1', 'Essentials'), account('rew-1', 'Rewards')],
      '2026-08-01',
    )
    expect(draft.accountId).toBe('ess-1')
  })

  it('leaves the account unset when the bucket holds several, and ignores closed ones', () => {
    const [ambiguous] = buildAiLedgerDraftTransactions(
      { description: 'lunch', amount: 12, txType: 'outflow', ledgerCategory: 'essentials', ledgerCategorySpecified: true },
      categories,
      [account('ess-1', 'Essentials'), account('ess-2', 'Essentials')],
      '2026-08-01',
    )
    expect(ambiguous.accountId).toBeUndefined()

    const [resolved] = buildAiLedgerDraftTransactions(
      { description: 'lunch', amount: 12, txType: 'outflow', ledgerCategory: 'essentials', ledgerCategorySpecified: true },
      categories,
      [account('ess-1', 'Essentials'), account('ess-old', 'Essentials', true)],
      '2026-08-01',
    )
    expect(resolved.accountId).toBe('ess-1')
  })

  it('honors an explicit reviewed account id when the bucket is ambiguous', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      { description: 'lunch', amount: 12, txType: 'outflow', ledgerCategory: 'essentials', ledgerCategorySpecified: true, accountId: 'ess-2' },
      categories,
      [account('ess-1', 'Essentials'), account('ess-2', 'Essentials')],
      '2026-08-01',
    )
    expect(draft.accountId).toBe('ess-2')
  })

  it('names both legs of a transfer from their own buckets', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      { description: 'move', amount: 50, txType: 'transfer', transferSource: 'essentials', transferTarget: 'rewards' },
      categories,
      [account('ess-1', 'Essentials'), account('rew-1', 'Rewards')],
      '2026-08-01',
    )
    expect(draft.ledgerCategory).toBe('Transfer:Essentials->Rewards')
    expect(draft.accountId).toBe('ess-1')
    expect(draft.counterAccountId).toBe('rew-1')
  })

  // Two accounts in one bucket is an internal account move: the bucket total does not change,
  // the money has only changed hands. It is expressible only once both ends are exact.
  it('builds an account move when both named accounts sit in the same bucket', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      {
        description: 'move', amount: 50, txType: 'transfer',
        transferSource: 'essentials', transferTarget: 'essentials',
        accountId: 'ess-1', counterAccountId: 'ess-2',
      },
      categories,
      [account('ess-1', 'Essentials'), account('ess-2', 'Essentials')],
      '2026-08-01',
    )
    expect(draft.ledgerCategory).toBe('AccountMove')
    expect(draft.category).toBe('Transfer')
    expect(draft.amount).toBe(50)
    expect(draft.accountId).toBe('ess-1')
    expect(draft.counterAccountId).toBe('ess-2')
  })

  it('refuses a same-bucket move that names only one side, rather than guessing the other', () => {
    expect(buildAiLedgerDraftTransactions(
      {
        description: 'move', amount: 50, txType: 'transfer',
        transferSource: 'essentials', transferTarget: 'essentials', accountId: 'ess-1',
      },
      categories,
      [account('ess-1', 'Essentials'), account('ess-2', 'Essentials')],
      '2026-08-01',
    )).toEqual([])
  })

  // Moving money is a complete instruction on its own; the description belongs to the app.
  it('names a transfer from its two sides when the user gave no description', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      { amount: 50, txType: 'transfer', transferSource: 'essentials', transferTarget: 'rewards' },
      categories,
      [account('ess-1', 'Essentials'), account('rew-1', 'Rewards')],
      '2026-08-01',
    )
    expect(draft.description).toBe('Transfer ess-1 to rew-1')
  })

  it('still refuses a spend with no description, which genuinely needs one', () => {
    expect(buildAiLedgerDraftTransactions(
      { amount: 12, txType: 'outflow', ledgerCategory: 'essentials', ledgerCategorySpecified: true },
      categories,
      [account('ess-1', 'Essentials')],
      '2026-08-01',
    )).toEqual([])
  })

  // An Income row is split four ways by the server, so it names a receiving account per bucket
  // rather than one for itself.
  it('fills the per-bucket receiving accounts for an income row and omits the ambiguous ones', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      { description: 'salary', amount: 5000, txType: 'inflow', ledgerCategory: 'income', ledgerCategorySpecified: true },
      categories,
      [
        account('ess-1', 'Essentials'),
        account('gro-1', 'Growth'),
        account('sta-1', 'Stability'),
        account('rew-1', 'Rewards'),
        account('rew-2', 'Rewards'),
      ],
      '2026-08-01',
    )
    expect(draft.ledgerCategory).toBe('Income')
    expect(draft.accountId).toBeUndefined()
    expect(draft.splitAccountIds).toEqual({ Essentials: 'ess-1', Growth: 'gro-1', Stability: 'sta-1' })
  })

  it('places nothing when no accounts are known', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      { description: 'lunch', amount: 12, txType: 'outflow', ledgerCategory: 'essentials', ledgerCategorySpecified: true },
      categories,
      [],
      '2026-08-01',
    )
    expect(draft.accountId).toBeUndefined()
  })
})

describe('buildAiLedgerDraftTransactions category flow', () => {
  // A staged draft can be synced from the review list without ever being opened, so the flow
  // restriction set in Settings has to hold here. The assistant is given category names without
  // their flow, so it can name a money-in-only category for a spend.
  const flowCategories = [
    { id: 'salary', name: 'Salary', type: 'inflow' },
    { id: 'food', name: 'Food', type: 'outflow' },
    { id: 'other', name: 'Other', type: 'both' },
  ] as TransactionCategory[]

  it('replaces a category that cannot take the drafted direction', () => {
    const [spend] = buildAiLedgerDraftTransactions(
      { description: 'lunch', amount: 12, txType: 'outflow', category: 'Salary' },
      flowCategories,
      [],
      '2026-08-01',
    )
    expect(spend.category).toBe('Other')

    const [deposit] = buildAiLedgerDraftTransactions(
      { description: 'bonus', amount: 500, txType: 'inflow', category: 'Food' },
      flowCategories,
      [],
      '2026-08-01',
    )
    expect(deposit.category).toBe('Other')
  })

  it('keeps a category the flow allows', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      { description: 'lunch', amount: 12, txType: 'outflow', category: 'Food' },
      flowCategories,
      [],
      '2026-08-01',
    )
    expect(draft.category).toBe('Food')
  })

  // "Other" may itself be restricted, and the fallback must not reach past the flow rule to it.
  it('falls back only to a category that accepts the direction', () => {
    const [draft] = buildAiLedgerDraftTransactions(
      { description: 'bonus', amount: 500, txType: 'inflow' },
      [
        { id: 'other', name: 'Other', type: 'outflow' },
        { id: 'salary', name: 'Salary', type: 'inflow' },
      ] as TransactionCategory[],
      [],
      '2026-08-01',
    )
    expect(draft.category).toBe('Salary')
  })
})
