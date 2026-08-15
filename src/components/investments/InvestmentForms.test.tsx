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

    expect(screen.getAllByRole('spinbutton')).toHaveLength(1)
    expect(screen.getByRole('button', { name: /Currency/ }).textContent).toContain('GBP')
  })

  it('applies the queued edit delta instead of adding the edited row twice', () => {
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

    expect(document.body.textContent).toMatch(/Only .* available in Broker/)
    expect(onSave).not.toHaveBeenCalled()
  })
})
