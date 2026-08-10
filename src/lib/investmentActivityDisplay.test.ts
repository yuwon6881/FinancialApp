import { describe, expect, it } from 'vitest'
import type { InvestmentActivity } from '../types'
import { investmentActivityCashAfterCharges, investmentActivityCharges } from './investmentActivityDisplay'

const activity = (overrides: Partial<InvestmentActivity> = {}): InvestmentActivity => ({
  id: 'activity-1',
  accountId: 'account-1',
  instrumentId: 'instrument-1',
  type: 'Dividend',
  tradeDate: '2026-07-01',
  units: 0,
  cashAmount: 0.7,
  fees: 0,
  taxes: 0,
  createdAt: '2026-07-01T00:00:00Z',
  ...overrides,
})

describe('investment activity display', () => {
  it('keeps the charge breakdown non-negative and totals it', () => {
    expect(investmentActivityCharges(activity({ fees: 0.02, taxes: 0.21 }))).toEqual({
      fees: 0.02,
      taxes: 0.21,
      total: 0.23,
    })
    expect(investmentActivityCharges(activity({ fees: -1, taxes: -2 }))).toEqual({ fees: 0, taxes: 0, total: 0 })
  })

  it('subtracts charges from cash received for a dividend or sale', () => {
    expect(investmentActivityCashAfterCharges(activity({ type: 'Dividend', cashAmount: 0.7, taxes: 0.21 }))).toBeCloseTo(0.49)
    expect(investmentActivityCashAfterCharges(activity({ type: 'Sell', cashAmount: 100, fees: 1.5 }))).toBeCloseTo(98.5)
  })

  it('adds charges to cash spent for a buy', () => {
    expect(investmentActivityCashAfterCharges(activity({ type: 'Buy', cashAmount: 100, fees: 1.5, taxes: 0.5 }))).toBeCloseTo(-102)
  })

  it('does not render an after-charge amount when there are no charges', () => {
    expect(investmentActivityCashAfterCharges(activity())).toBeUndefined()
  })

  it('does not invent a cash effect when the gross amount is missing', () => {
    expect(investmentActivityCashAfterCharges(activity({ cashAmount: undefined, fees: 1 }))).toBeUndefined()
  })
})
