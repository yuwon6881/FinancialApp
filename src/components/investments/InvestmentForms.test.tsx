import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InvestmentPortfolio } from '../../types'
import { AccountForm, ActivityForm, CashForm } from './InvestmentForms'

const portfolio = (appCurrency?: string): InvestmentPortfolio => ({
  appCurrency: appCurrency as string,
  summary: { growthLedgerBalance: 0 },
  accounts: [{ id: 'account', name: 'Broker', baseCurrency: 'GBP', isArchived: false, createdAt: '', updatedAt: '' }],
  instruments: [{ id: 'instrument', symbol: 'FUND', name: 'Fund', type: 'ETF', currency: 'EUR', isCustom: false, isArchived: false }],
  holdings: [{
    accountId: 'account', accountName: 'Broker', instrumentId: 'instrument', symbol: 'FUND', name: 'Fund',
    type: 'ETF', currency: 'EUR', units: 4, averageCostNative: 100, fxIncomplete: false,
  }],
  activity: [],
  chart: [],
  cashBalances: [{ accountId: 'account', accountName: 'Broker', currency: 'EUR', amount: 500 }],
  cashFlows: [],
  insights: [],
  warnings: [],
  marketDataConfigured: false,
  allocation: {
    status: 'NotStarted', appCurrency: appCurrency as string,
    plan: { usEquityTarget: 66, internationalExUsTarget: 10, bondsTarget: 24, watchDrift: 3, alertDrift: 5 },
    assignments: [], sleeves: [], recommendations: [], incompleteReasons: [],
    freshness: { isStale: false, hasMissingData: false, maxAgeMinutes: 60, staleInputs: [] },
    availableCash: 0,
  },
} as unknown as InvestmentPortfolio)

const noop = () => undefined
const inputFor = (label: string) => screen.getByText(label).parentElement!.querySelector('input') as HTMLInputElement
const chooseOption = (selectLabel: string, optionLabel: string) => {
  fireEvent.click(screen.getByRole('combobox', { name: selectLabel }))
  fireEvent.click(screen.getByRole('option', { name: optionLabel }))
}

describe('investment forms', () => {
  it('requires an explicitly selected account currency instead of accepting an empty fallback', () => {
    const onSave = vi.fn().mockResolvedValue(true)
    render(<AccountForm busy={false} onCancel={noop} onSave={onSave} />)

    fireEvent.change(screen.getByPlaceholderText('e.g. Moomoo'), { target: { value: 'Broker' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add account' }))

    expect(screen.getByText('Choose a base currency.')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('uses the selected instrument currency when the cached app currency is incomplete', () => {
    render(
      <ActivityForm
        portfolio={portfolio(undefined)}
        initial={null}
        pendingActivities={[]}
        busy={false}
        onCancel={noop}
        onSave={vi.fn().mockResolvedValue(true)}
        onNeedAccount={noop}
        onNeedInstrument={noop}
      />,
    )

    expect(screen.getByLabelText('Unit price (EUR)')).toBeTruthy()
    expect(screen.getByLabelText('Gross amount (EUR)')).toBeTruthy()
    expect(inputFor('Units').type).toBe('number')
    expect(inputFor('Unit price (EUR)').type).toBe('text')
    expect(inputFor('Gross amount (EUR)').type).toBe('text')
    expect(inputFor('Fees (EUR)').type).toBe('text')
    expect(inputFor('Taxes (EUR)').type).toBe('text')
  })

  it('uses the account currency for cash entry when the app currency is unavailable', () => {
    render(
      <CashForm
        portfolio={portfolio(undefined)}
        busy={false}
        onCancel={noop}
        onSave={vi.fn().mockResolvedValue(true)}
        onNeedAccount={noop}
      />,
    )

    expect(inputFor('Amount (GBP)').type).toBe('text')
    expect(screen.getByRole('button', { name: /Currency/ }).textContent).toContain('GBP')
  })

  it('prefills scanned fees and taxes on the first activity review render', () => {
    render(
      <ActivityForm
        portfolio={portfolio('USD')}
        initial={null}
        pendingActivities={[]}
        busy={false}
        onCancel={noop}
        onSave={vi.fn().mockResolvedValue(true)}
        onNeedAccount={noop}
        onNeedInstrument={noop}
        scanDraft={{
          jobId: 'trade-with-costs',
          result: {
            type: 'Buy',
            accountId: 'account',
            instrumentId: 'instrument',
            tradeDate: '2026-01-01',
            units: 2,
            unitPrice: 100,
            cashAmount: 200,
            fees: 1.25,
            taxes: 0.75,
            currency: 'EUR',
            confidence: 0.9,
          },
        }}
      />,
    )

    expect(inputFor('Fees (EUR)').value).toBe('1.25')
    expect(inputFor('Taxes (EUR)').value).toBe('0.75')
  })

  // Units and unit price belong to Buy/Sell only. A scanned dividend that also reported a
  // holding size must not save numbers into fields this activity type never shows.
  it('does not save units or unit price a scanned dividend hides', () => {
    const onSave = vi.fn().mockResolvedValue(true)
    render(
      <ActivityForm
        portfolio={portfolio('USD')}
        initial={null}
        pendingActivities={[]}
        busy={false}
        onCancel={noop}
        onSave={onSave}
        onNeedAccount={noop}
        onNeedInstrument={noop}
        scanDraft={{
          jobId: 'dividend-with-units',
          result: {
            type: 'Dividend',
            accountId: 'account',
            instrumentId: 'instrument',
            tradeDate: '2026-01-01',
            units: 40,
            unitPrice: 2,
            cashAmount: 80,
            fees: null,
            taxes: null,
            currency: 'EUR',
            confidence: 0.9,
          },
        }}
      />,
    )

    expect(screen.queryByLabelText('Units')).toBeNull()
    expect(screen.queryByLabelText('Unit price (EUR)')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }))
    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0]).toMatchObject({ type: 'Dividend', cashAmount: 80 })
    expect(onSave.mock.calls[0][0].units).toBeUndefined()
    expect(onSave.mock.calls[0][0].unitPrice).toBeUndefined()
  })

  // Switching activity type is the only way to reach a field set from another type. Values
  // left behind in the hidden inputs would be saved without ever having been visible.
  it('drops units and unit price when the activity type stops showing them', () => {
    const onSave = vi.fn().mockResolvedValue(true)
    render(
      <ActivityForm
        portfolio={portfolio('USD')}
        initial={null}
        pendingActivities={[]}
        busy={false}
        onCancel={noop}
        onSave={onSave}
        onNeedAccount={noop}
        onNeedInstrument={noop}
      />,
    )

    fireEvent.change(screen.getByLabelText('Units'), { target: { value: '3' } })
    fireEvent.change(screen.getByLabelText('Unit price (EUR)'), { target: { value: '10' } })
    chooseOption('Activity type', 'Dividend')
    fireEvent.change(inputFor('Gross dividend (EUR)'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(onSave).toHaveBeenCalledOnce()
    expect(onSave.mock.calls[0][0].units).toBeUndefined()
    expect(onSave.mock.calls[0][0].unitPrice).toBeUndefined()
  })

  // The conversion legs are the Conversion type's own fields. A scanned deposit must not
  // pre-load them, or switching to Conversion later offers a rate nobody read off anything.
  it('leaves the conversion legs alone for a scanned deposit', () => {
    render(
      <CashForm
        portfolio={portfolio('USD')}
        busy={false}
        onCancel={noop}
        onSave={vi.fn().mockResolvedValue(true)}
        onNeedAccount={noop}
        scanDraft={{
          jobId: 'deposit-with-legs',
          result: {
            type: 'Deposit',
            accountId: 'account',
            instrumentId: null,
            tradeDate: '2026-01-01',
            units: null,
            unitPrice: null,
            cashAmount: 250,
            fees: null,
            taxes: null,
            currency: 'GBP',
            toCurrency: 'JPY',
            toAmount: 48000,
            confidence: 0.9,
          },
        }}
      />,
    )

    chooseOption('Cash movement type', 'Convert currency')
    expect(inputFor('To amount').value).toBe('')
    expect(screen.getByRole('button', { name: /To currency/ }).textContent).not.toContain('JPY')
  })

  it('allows an investment execution to temporarily overdraw broker cash', () => {
    const onSave = vi.fn().mockResolvedValue(true)
    render(
      <ActivityForm
        portfolio={portfolio('USD')}
        initial={null}
        pendingActivities={[{
          id: 'edited', accountId: 'account', instrumentId: 'instrument', type: 'Buy', tradeDate: '2026-01-01',
          units: 1, unitPrice: 400, cashAmount: 400, fees: 0, taxes: 0, createdAt: '', isPendingSync: true,
          pendingOriginal: {
            id: 'edited', accountId: 'account', instrumentId: 'instrument', type: 'Buy', tradeDate: '2025-01-01',
            units: 3, unitPrice: 333.33, cashAmount: 1000, fees: 0, taxes: 0, createdAt: '',
          },
        }]}
        busy={false}
        onCancel={noop}
        onSave={onSave}
        onNeedAccount={noop}
        onNeedInstrument={noop}
      />,
    )
    fireEvent.change(screen.getByLabelText('Units'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Unit price (EUR)'), { target: { value: '1101' } })
    fireEvent.change(screen.getByLabelText('Gross amount (EUR)'), { target: { value: '1101' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save activity' }))

    expect(document.body.textContent).not.toMatch(/Only .* available in Broker/)
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('stops scanning spinner and shows redirect message when scan on CashForm is a trade', () => {
    render(
      <CashForm
        portfolio={portfolio('USD')}
        busy={false}
        onCancel={noop}
        onSave={vi.fn().mockResolvedValue(true)}
        onNeedAccount={noop}
        scanDraft={{
          jobId: 'trade-scan',
          result: {
            type: 'Buy',
            accountId: 'account',
            instrumentId: 'instrument',
            tradeDate: '2026-01-01',
            units: 10,
            unitPrice: 100,
            cashAmount: 1000,
            fees: 0,
            taxes: 0,
            confidence: 0.9,
          },
        }}
      />,
    )

    expect(screen.getByText('This looks like a trade, not a cash movement — record it under Activity')).toBeTruthy()
  })

  it('stops scanning spinner and shows redirect message when scan on ActivityForm is a cash flow', () => {
    render(
      <ActivityForm
        portfolio={portfolio('USD')}
        initial={null}
        pendingActivities={[]}
        busy={false}
        onCancel={noop}
        onSave={vi.fn().mockResolvedValue(true)}
        onNeedAccount={noop}
        onNeedInstrument={noop}
        scanDraft={{
          jobId: 'cash-scan',
          result: {
            type: 'Deposit' as any,
            accountId: 'account',
            instrumentId: null,
            tradeDate: '2026-01-01',
            units: null,
            unitPrice: null,
            cashAmount: 500,
            fees: null,
            taxes: null,
            currency: 'USD',
            confidence: 0.9,
          },
        }}
      />,
    )

    expect(screen.getByText('This looks like a cash movement, not a trade — record it under Cash')).toBeTruthy()
  })

  it('rejects same-currency conversion in CashForm', () => {
    const onSave = vi.fn().mockResolvedValue(true)
    render(
      <CashForm
        portfolio={portfolio('USD')}
        busy={false}
        onCancel={noop}
        onSave={onSave}
        onNeedAccount={noop}
        initial={{
          id: 'cf-1',
          accountId: 'account',
          type: 'Conversion',
          currency: 'USD',
          amount: 100,
          toCurrency: 'USD',
          toAmount: 100,
          date: '2026-01-01',
          createdAt: '',
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(screen.getByText('Choose a different currency to receive.')).toBeTruthy()
    expect(onSave).not.toHaveBeenCalled()
  })
})
