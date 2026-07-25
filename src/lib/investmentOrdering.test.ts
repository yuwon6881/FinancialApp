import { describe, expect, it } from 'vitest'
import type { InvestmentActivity, InvestmentCashFlow } from '../types'
import { sortActivityNewestFirst, sortCashFlowsNewestFirst } from './investmentOrdering'

const activity = (id: string, tradeDate: string, createdAt?: string): InvestmentActivity => ({
  id,
  accountId: 'a',
  instrumentId: 'i',
  type: 'Buy',
  tradeDate,
  units: 1,
  fees: 0,
  taxes: 0,
  createdAt: createdAt ?? '',
})

const flow = (id: string, date: string, createdAt?: string): InvestmentCashFlow => ({
  id,
  accountId: 'a',
  currency: 'USD',
  type: 'Deposit',
  amount: 1,
  date,
  createdAt,
})

describe('investment ordering', () => {
  it('places the newest trade date first', () => {
    const rows = [
      activity('1', '2026-01-05', '2026-01-05T00:00:00Z'),
      activity('2', '2026-03-01', '2026-01-01T00:00:00Z'),
      activity('3', '2026-02-01', '2026-01-02T00:00:00Z'),
    ]

    expect(sortActivityNewestFirst(rows).map(row => row.id)).toEqual(['2', '3', '1'])
  })

  it('moves an edited row without waiting for the server', () => {
    const rows = [
      activity('1', '2026-03-01', '2026-01-01T00:00:00Z'),
      activity('2', '2026-02-01', '2026-01-02T00:00:00Z'),
    ]
    // The user changed row 2's date to the latest one; only the local value changed.
    const edited = rows.map(row => row.id === '2' ? { ...row, tradeDate: '2026-04-01' } : row)

    expect(sortActivityNewestFirst(edited).map(row => row.id)).toEqual(['2', '1'])
  })

  it('keeps a same-day row without a timestamp at the top of that day', () => {
    const rows = [
      activity('existing', '2026-01-05', '2026-01-05T09:00:00Z'),
      activity('queued', '2026-01-05'),
    ]

    expect(sortActivityNewestFirst(rows).map(row => row.id)).toEqual(['queued', 'existing'])
  })

  it('orders cash movements newest first', () => {
    const rows = [flow('1', '2026-01-01'), flow('2', '2026-05-01'), flow('3', '2026-03-01')]

    expect(sortCashFlowsNewestFirst(rows).map(row => row.id)).toEqual(['2', '3', '1'])
  })

  it('orders same-day cash movements by creation time before their ids', () => {
    const rows = [
      flow('deposit', '2026-06-01', '2026-06-01T09:00:00Z'),
      flow('conversion', '2026-06-01', '2026-06-01T10:00:00Z'),
    ]

    expect(sortCashFlowsNewestFirst(rows).map(row => row.id)).toEqual(['conversion', 'deposit'])
  })

  it('does not mutate the input list', () => {
    const rows = [activity('1', '2026-01-01'), activity('2', '2026-09-01')]
    sortActivityNewestFirst(rows)

    expect(rows.map(row => row.id)).toEqual(['1', '2'])
  })
})
