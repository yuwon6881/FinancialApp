import { describe, it, expect } from 'vitest'
import { addTransaction, fetchPagedTransactions, fetchTransactionById, deleteTransaction } from '@/lib/api/transactions'
import { obfuscateAmount, deobfuscateAmount } from '@/lib/api/amounts'
import { lastRequest, state } from '@/test/msw/backend'
import type { Transaction } from '@/types'

function draftTx(overrides: Partial<Transaction> = {}): Omit<Transaction, 'id'> & { id?: string } {
  return {
    date: '2026-06-15',
    description: 'Groceries',
    category: 'Food',
    ledgerCategory: 'Essentials',
    amount: -42.5,
    ...overrides,
  }
}

describe('transactions integration (wire contract)', () => {
  it('POSTs an obfuscated amount and parses the deobfuscated response', async () => {
    const created = await addTransaction(draftTx())

    // Response is deobfuscated back to a number for the app.
    expect(created.amount).toBe(-42.5)
    expect(created.description).toBe('Groceries')

    // The request body carried the amount as the obfuscated wire string, not a raw number.
    const body = lastRequest['POST /transactions'].body as { amount: unknown }
    expect(typeof body.amount).toBe('string')
    expect(deobfuscateAmount(body.amount as string)).toBe(-42.5)
  })

  it('does not send a bearer Authorization header on the web (cookie-authenticated)', async () => {
    await addTransaction(draftTx())

    const headers = lastRequest['POST /transactions'].headers
    expect(headers.get('Authorization')).toBeNull()
  })

  it('echoes the csrf_token cookie in the X-CSRF-Token header on mutations', async () => {
    document.cookie = 'csrf_token=csrf-abc-123'

    await addTransaction(draftTx())

    const headers = lastRequest['POST /transactions'].headers
    expect(headers.get('X-CSRF-Token')).toBe('csrf-abc-123')
  })

  it('round-trips a created transaction through the paged listing', async () => {
    const created = await addTransaction(draftTx({ id: 'tx-42', description: 'Coffee', amount: -4 }))

    const paged = await fetchPagedTransactions({ page: 1, pageSize: 50 })
    const found = paged.items.find(t => t.id === created.id)
    expect(found).toBeDefined()
    expect(found!.amount).toBe(-4)
    expect(found!.description).toBe('Coffee')
  })

  it('fetches a single transaction by id and deobfuscates it', async () => {
    state.transactions.set('tx-seed', {
      id: 'tx-seed',
      date: '2026-06-10',
      description: 'Seeded',
      category: 'Food',
      ledgerCategory: 'Essentials',
      amount: obfuscateAmount(-99.99),
    })

    const tx = await fetchTransactionById('tx-seed')
    expect(tx.amount).toBeCloseTo(-99.99, 2)
  })

  it('deletes a transaction', async () => {
    const created = await addTransaction(draftTx({ id: 'tx-del' }))
    await deleteTransaction(created.id)
    expect(state.transactions.has('tx-del')).toBe(false)
  })
})
