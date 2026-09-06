import { describe, expect, it } from 'vitest'
import type { Transaction } from '../types'
import { buildCsvContent } from './csvExport'

const row = (partial: Partial<Transaction>): Transaction => ({
  id: 'tx-1',
  date: '2026-07-13',
  description: 'Transaction',
  category: 'Other',
  ledgerCategory: 'Essentials',
  amount: -10,
  ...partial,
} as Transaction)

describe('buildCsvContent', () => {
  it('keeps internal movements out of cash-flow debit and credit columns', () => {
    const csv = buildCsvContent([
      row({ description: 'Salary', category: 'Salary', ledgerCategory: 'Income', amount: 1000 }),
      row({
        id: 'tx-1-split-Essentials',
        description: '[Split: Essentials] Salary',
        category: 'Transfer',
        ledgerCategory: 'Transfer:Income->Essentials',
        amount: 500,
      }),
    ])

    expect(csv).toContain('Ledger Allocation,Debit (Outflow),Credit (Inflow),Internal Movement')
    expect(csv).toContain('Salary,Salary,Income,,1000.00,')
    expect(csv).toContain('Transfer,Income -> Essentials,,,500.00')
  })

  it('classifies a lower-cased transfer as internal movement, as the server export does', () => {
    const csv = buildCsvContent([
      row({ description: 'Move', ledgerCategory: 'transfer:Essentials->Rewards', amount: -50 }),
    ])

    expect(csv).toContain('Essentials -> Rewards,,,50.00')
  })

  it('leaves the account column blank rather than writing an opaque account id', () => {
    const namedCsv = buildCsvContent(
      [row({ accountId: 'acc-1' })],
      [{ id: 'acc-1', name: 'Everyday' }],
    )
    expect(namedCsv.trim().endsWith('Everyday')).toBe(true)

    // The account list is optional and omits archived accounts; the server writes "" here.
    const unknownCsv = buildCsvContent([row({ accountId: 'acc-missing' })], [])
    expect(unknownCsv).not.toContain('acc-missing')
    expect(unknownCsv.trim().endsWith(',')).toBe(true)
  })
})
