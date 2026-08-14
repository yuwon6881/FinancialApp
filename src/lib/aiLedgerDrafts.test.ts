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
  // The assistant is never told which accounts exist, so it must not pick between two. A bucket
  // with one open account preselects it; a bucket with several leaves the field for the person
  // reviewing the draft, which is the gate every other writer goes through.
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
