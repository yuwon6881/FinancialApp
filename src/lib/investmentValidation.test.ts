import { describe, expect, it } from 'vitest'
import type { InvestmentCashFlow, InvestmentPortfolio } from '../types'
import { validateActivityBalances, validateCashFlowBalances } from './investmentValidation'

const portfolio = {
  appCurrency: 'MYR',
  summary: { growthLedgerBalance: 0 },
  accounts: [{ id: 'a1', name: 'Moomoo', baseCurrency: 'USD', isArchived: false, createdAt: '', updatedAt: '' }],
  instruments: [{ id: 'i1', symbol: 'VOO', name: 'Vanguard S&P 500', type: 'ETF', currency: 'USD', isCustom: false, isArchived: false }],
  holdings: [{
    accountId: 'a1',
    accountName: 'Moomoo',
    instrumentId: 'i1',
    symbol: 'VOO',
    name: 'Vanguard S&P 500',
    type: 'ETF' as const,
    currency: 'USD',
    units: 4,
    averageCostNative: 100,
   
    fxIncomplete: false,
  }],
  activity: [],
  chart: [],
  cashBalances: [{ accountId: 'a1', accountName: 'Moomoo', currency: 'USD', amount: 500 }],
  cashFlows: [],
  insights: [],
  warnings: [],
  marketDataConfigured: true,
  allocation: {
    status: 'OnTrack' as const,
    appCurrency: 'MYR',
    plan: { usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 },
    assignments: [],
    sleeves: [],
    recommendations: [],
    incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
    availableCash: 500,
  },
} as unknown as InvestmentPortfolio

const buy = (cashAmount: number, fees = 0) => ({ type: 'Buy' as const, accountId: 'a1', instrumentId: 'i1', units: 1, cashAmount, fees })
const sell = (units: number) => ({ type: 'Sell' as const, accountId: 'a1', instrumentId: 'i1', units, cashAmount: units * 100 })

describe('validateActivityBalances', () => {
  it('allows a buy covered by the account cash', () => {
    expect(validateActivityBalances(portfolio, buy(500))).toBeNull()
  })

  it('rejects a buy whose cost plus fees exceeds the account cash', () => {
    const issue = validateActivityBalances(portfolio, buy(500, 1))
    expect(issue?.field).toBe('cashAmount')
    expect(issue?.message).toContain('available in Moomoo')
  })

  it('counts a queued buy before validating another buy in the same account and currency', () => {
    const pendingBuy = {
      id: 'pending-buy',
      accountId: 'a1',
      instrumentId: 'i1',
      type: 'Buy' as const,
      tradeDate: '2026-06-01',
      units: 1,
      unitPrice: 400,
      cashAmount: 400,
      fees: 0,
      taxes: 0,
      createdAt: '',
    }

    const issue = validateActivityBalances(portfolio, buy(101), undefined, [pendingBuy])

    expect(issue?.field).toBe('cashAmount')
    expect(issue?.message).toMatch(/needs (?:US)?\$101\.00/)
  })

  it('applies only the net effect of an offline edit', () => {
    const pendingEdit = {
      id: 'edited-buy',
      accountId: 'a1',
      instrumentId: 'i1',
      type: 'Buy' as const,
      tradeDate: '2026-06-01',
      units: 1,
      unitPrice: 400,
      cashAmount: 400,
      fees: 0,
      taxes: 0,
      createdAt: '',
      isPendingSync: true,
      pendingOriginal: {
        id: 'edited-buy',
        accountId: 'a1',
        instrumentId: 'i1',
        type: 'Buy' as const,
        tradeDate: '2026-01-01',
        units: 3,
        unitPrice: 333.33,
        cashAmount: 1_000,
        fees: 0,
        taxes: 0,
        createdAt: '',
      },
    }

    // The server's 500 cash and 4 units include the original buy. The queued
    // edit releases 600 cash and 2 units, so the projected availability is
    // 1,100 cash and 2 units—not the current edited row applied on top again.
    expect(validateActivityBalances(portfolio, buy(1_100), undefined, [pendingEdit])).toBeNull()
    expect(validateActivityBalances(portfolio, buy(1_101), undefined, [pendingEdit])?.field).toBe('cashAmount')
    expect(validateActivityBalances(portfolio, sell(2), undefined, [pendingEdit])).toBeNull()
    expect(validateActivityBalances(portfolio, sell(3), undefined, [pendingEdit])?.field).toBe('units')
  })

  it('allows selling the units held and rejects selling more', () => {
    expect(validateActivityBalances(portfolio, sell(4))).toBeNull()
    const issue = validateActivityBalances(portfolio, sell(4.5))
    expect(issue?.field).toBe('units')
    expect(issue?.message).toContain('4 units of VOO')
  })

  it('measures an edit against the balance without the record being replaced', () => {
    const initial = { id: 't1', accountId: 'a1', instrumentId: 'i1', type: 'Buy' as const, tradeDate: '2026-01-01', units: 1, cashAmount: 400, fees: 0, taxes: 0, createdAt: '' }
    // Cash is 500 with the original 400 buy already applied, so up to 900 is spendable.
    expect(validateActivityBalances(portfolio, buy(900), initial)).toBeNull()
    expect(validateActivityBalances(portfolio, buy(901), initial)?.field).toBe('cashAmount')
  })

  it('rejects a dividend smaller than its fees and taxes', () => {
    const issue = validateActivityBalances(portfolio, { type: 'Dividend', accountId: 'a1', instrumentId: 'i1', cashAmount: 10, fees: 6, taxes: 6 })
    expect(issue?.field).toBe('cashAmount')
  })
})

describe('validateCashFlowBalances', () => {
  it('always allows a deposit', () => {
    expect(validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Deposit', currency: 'MYR', amount: 5000 })).toBeNull()
  })

  it('rejects a withdrawal beyond the currency balance', () => {
    expect(validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Withdrawal', currency: 'USD', amount: 500 })).toBeNull()
    const issue = validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Withdrawal', currency: 'USD', amount: 501 })
    expect(issue?.field).toBe('amount')
    expect(issue?.message).toContain('before withdrawing')
  })

  it('rejects a withdrawal in a currency the account does not hold', () => {
    expect(validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Withdrawal', currency: 'MYR', amount: 1 })?.field).toBe('amount')
  })

  it('rejects a conversion without funds in the source currency', () => {
    expect(validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Conversion', currency: 'MYR', amount: 100, toCurrency: 'USD', toAmount: 21 })?.field).toBe('amount')
    expect(validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Conversion', currency: 'USD', amount: 100, toCurrency: 'MYR', toAmount: 470 })).toBeNull()
  })

  it('counts a queued deposit before validating a conversion', () => {
    const pendingDeposit: InvestmentCashFlow = {
      id: 'deposit-1', accountId: 'a1', currency: 'MYR', type: 'Deposit', amount: 1000, date: '2026-06-01',
    }

    expect(validateCashFlowBalances(
      portfolio,
      { accountId: 'a1', type: 'Conversion', currency: 'MYR', amount: 1000, toCurrency: 'USD', toAmount: 250.27 },
      undefined,
      [pendingDeposit],
    )).toBeNull()
  })

  it('applies only the net effect of an offline cash-movement edit', () => {
    const pendingEdit = {
      id: 'withdrawal-1',
      accountId: 'a1',
      currency: 'USD',
      type: 'Withdrawal' as const,
      amount: 100,
      date: '2026-06-01',
      pendingOriginal: {
        id: 'withdrawal-1',
        accountId: 'a1',
        currency: 'USD',
        type: 'Withdrawal' as const,
        amount: -400,
        date: '2026-01-01',
      },
    }

    expect(validateCashFlowBalances(
      portfolio,
      { accountId: 'a1', type: 'Withdrawal', currency: 'USD', amount: 800 },
      undefined,
      [pendingEdit],
    )).toBeNull()
    expect(validateCashFlowBalances(
      portfolio,
      { accountId: 'a1', type: 'Withdrawal', currency: 'USD', amount: 801 },
      undefined,
      [pendingEdit],
    )?.field).toBe('amount')
  })

  it('rejects a conversion between the same currency', () => {
    expect(validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Conversion', currency: 'USD', amount: 1, toCurrency: 'usd', toAmount: 1 })?.field).toBe('toCurrency')
  })

  it('adds back the edited movement before checking a withdrawal', () => {
    const initial: InvestmentCashFlow = { id: 'c1', accountId: 'a1', currency: 'USD', type: 'Withdrawal', amount: -100, date: '2026-01-01' }
    expect(validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Withdrawal', currency: 'USD', amount: 600 }, initial)).toBeNull()
    expect(validateCashFlowBalances(portfolio, { accountId: 'a1', type: 'Withdrawal', currency: 'USD', amount: 601 }, initial)?.field).toBe('amount')
  })
})
