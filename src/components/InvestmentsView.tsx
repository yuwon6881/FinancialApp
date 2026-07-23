import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  CircleDollarSign,
  CloudOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import type {
  AppTab,
  InvestmentActivity,
  InvestmentCashFlow,
  InvestmentPortfolio,
  InvestmentRange,
  InvestmentTransactionType,
} from '../types'
import type { ToastAction } from './ui/ToastViewport'
import * as api from '../lib/api'
import type { InstrumentSearchResult } from '../lib/api/investments'
import { useAppContext } from '../contexts/AppContext'
import { Button } from './ui/Button'
import { BottomSheet } from './ui/BottomSheet'
import { CycleSkeleton } from './ui/Skeleton'
import { CustomSelect } from './ui/CustomSelect'
import { DatePicker } from './ui/DatePicker'

interface InvestmentsViewProps {
  onNavigate: (tab: AppTab) => void
}

type Panel = 'account' | 'instrument' | 'activity' | 'price' | 'cash' | null
type AllocationMode = 'asset' | 'account' | 'instrument'
type AllocationFilter = { mode: AllocationMode; key: string } | null

const ranges: Array<{ value: InvestmentRange; label: string }> = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

const activityTypes: Array<{ value: InvestmentTransactionType; label: string }> = [
  { value: 'OpeningPosition', label: 'Opening position' },
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
  { value: 'Dividend', label: 'Dividend' },
  { value: 'FeeTax', label: 'Fee / tax' },
  { value: 'Split', label: 'Split' },
  { value: 'TransferIn', label: 'Transfer in' },
  { value: 'TransferOut', label: 'Transfer out' },
]

const today = () => new Date().toISOString().slice(0, 10)
const numberOrUndefined = (value: string) => value.trim() === '' ? undefined : Number(value)
const inputClass = 'w-full rounded-xl border border-border/60 bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-blue-500'
const labelClass = 'space-y-1.5 text-xs font-semibold text-muted-foreground'

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const number = (value: number, digits = 4) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({ onNavigate }) => {
  const { hideSensitive, isOffline, showToast, confirm } = useAppContext()
  const [range, setRange] = useState<InvestmentRange>('3m')
  const [portfolio, setPortfolio] = useState<InvestmentPortfolio | null>(() => api.readCachedInvestmentPortfolio())
  const [loading, setLoading] = useState(!portfolio)
  const [loadError, setLoadError] = useState('')
  const [panel, setPanel] = useState<Panel>(null)
  const [editingActivity, setEditingActivity] = useState<InvestmentActivity | null>(null)
  // Bumped on every open so each form's `key` changes and it remounts with
  // fresh internal state -- reopening (or switching from edit to add) never
  // shows a previously entered or edited record.
  const [formKey, setFormKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [allocationFilter, setAllocationFilter] = useState<AllocationFilter>(null)
  const cancelRefreshRef = useRef(false)
  const refreshTimerRef = useRef<number | null>(null)

  const openPanel = (next: Exclude<Panel, null>, activity: InvestmentActivity | null = null) => {
    setEditingActivity(activity)
    setFormKey(value => value + 1)
    setPanel(next)
  }
  const closePanel = () => {
    setPanel(null)
    setEditingActivity(null)
  }

  const load = async (nextRange = range, quiet = false) => {
    if (!quiet) setLoading(!portfolio)
    setLoadError('')
    try {
      const result = await api.fetchInvestmentPortfolio(nextRange)
      setPortfolio(result)
    } catch (error) {
      const cached = api.readCachedInvestmentPortfolio()
      if (cached) {
        setPortfolio(cached)
        setLoadError('Showing the last cached investment snapshot.')
      } else {
        setLoadError(error instanceof Error ? error.message : 'Could not load investments.')
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const abort = new AbortController()
    setLoading(!portfolio)
    api.fetchInvestmentPortfolio(range, abort.signal)
      .then(setPortfolio)
      .catch(error => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        const cached = api.readCachedInvestmentPortfolio()
        if (cached) {
          setPortfolio(cached)
          setLoadError('Showing the last cached investment snapshot.')
        } else {
          setLoadError(error instanceof Error ? error.message : 'Could not load investments.')
        }
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false)
      })
    return () => abort.abort()
  }, [range])

  useEffect(() => () => {
    cancelRefreshRef.current = true
    if (refreshTimerRef.current !== null) window.clearTimeout(refreshTimerRef.current)
  }, [])

  const mutateUndo = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true)
    try {
      await work()
      await load(range, true)
      showToast(success, 'Growth Investments', 'info')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not undo.', 'Undo failed', 'error')
    } finally {
      setBusy(false)
    }
  }

  const mutate = async <T,>(work: () => Promise<T>, success: string, createUndo?: (result: T) => ToastAction | undefined) => {
    if (isOffline) {
      showToast('Reconnect to make investment changes.', 'Offline', 'warning')
      return false
    }
    setBusy(true)
    try {
      const result = await work()
      await load(range, true)
      const undoAction = createUndo ? createUndo(result) : undefined
      showToast(success, 'Growth Investments', 'success', undoAction)
      closePanel()
      return true
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'The change could not be saved.', 'Could not save', 'warning')
      return false
    } finally {
      setBusy(false)
    }
  }

  const updatePrices = async () => {
    if (isOffline || refreshing) return
    cancelRefreshRef.current = false
    setRefreshing(true)
    const step = async (): Promise<void> => {
      if (cancelRefreshRef.current) return
      try {
        const result = await api.refreshInvestmentMarketData()
        if (result.total > 0) {
          showToast(`${result.updated} of ${result.total} updated.`, 'Updating prices')
        } else if (result.message) {
          showToast(result.message, 'Market data')
        }
        if (!result.complete && result.retryAfterSeconds && !cancelRefreshRef.current) {
          await new Promise<void>(resolve => {
            refreshTimerRef.current = window.setTimeout(resolve, result.retryAfterSeconds! * 1000)
          })
          return step()
        }
        if (result.warnings.length) showToast(result.warnings[0], 'Prices may be stale', 'warning')
        await load(range, true)
      } catch (error) {
        showToast(error instanceof Error ? error.message : 'Prices could not be updated.', 'Market data', 'warning')
      }
    }
    await step()
    setRefreshing(false)
  }

  if (loading && !portfolio) return <CycleSkeleton variant="investments" />

  const back = () => {
    if (window.history.length > 1) window.history.back()
    else onNavigate('dashboard')
  }

  return (
    <div className="space-y-6 soft-rise">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <button type="button" onClick={back} className="mt-0.5 cursor-pointer rounded-xl border border-border/60 p-2 text-muted-foreground hover:text-foreground" aria-label="Back to Today">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Growth Investments</h1>
            <p className="mt-1 text-xs text-muted-foreground">Broker-neutral portfolio tracker.</p>
          </div>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            variant="ghost"
            className="w-full justify-center sm:w-auto"
            disabled={isOffline || refreshing || !portfolio?.marketDataConfigured || !portfolio.holdings.length}
            aria-busy={refreshing}
            onClick={() => void updatePrices()}
          >
            {refreshing
              ? <><Loader2 className="size-4 animate-spin" /> Updating…</>
              : <><RefreshCw className="size-4" /> Update prices</>}
          </Button>
          <Button variant="primary" className="w-full justify-center sm:w-auto" disabled={isOffline} onClick={() => openPanel('activity')}>
            <Plus className="size-4" /> Add activity
          </Button>
        </div>
      </header>

      {(isOffline || loadError) && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <CloudOff className="size-4 shrink-0" />
          {isOffline ? 'Offline: showing the last cached snapshot. Editing and market refresh are unavailable.' : loadError}
        </div>
      )}

      {!portfolio?.marketDataConfigured && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/7 px-4 py-3 text-xs text-muted-foreground">
          Live market data is not configured. Accounts, custom investments, activity, and manual prices remain available.
        </div>
      )}

      <BottomSheet isOpen={panel === 'account'} title="Add investment account" onClose={closePanel} maxWidthClassName="max-w-lg">
        <AccountForm key={`account-${formKey}`} busy={busy} onCancel={closePanel} onSave={value => mutate(() => api.createInvestmentAccount(value), 'Account added.', (res) => ({
          label: 'Undo',
          onAction: () => mutateUndo(() => api.deleteInvestmentAccount((res as any).id), 'Account addition undone.')
        }))} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'instrument'} title="Add investment" onClose={closePanel} maxWidthClassName="max-w-2xl">
        <InstrumentForm key={`instrument-${formKey}`} busy={busy} offline={isOffline} onCancel={closePanel} onSave={value => mutate(() => api.createInvestmentInstrument(value), 'Investment added.', (res) => ({
          label: 'Undo',
          onAction: () => mutateUndo(() => api.deleteInvestmentInstrument((res as any).id), 'Investment addition undone.')
        }))} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'activity'} title={editingActivity ? 'Edit investment activity' : 'Add activity'} onClose={closePanel} maxWidthClassName="max-w-3xl">
        <ActivityForm key={`activity-${formKey}`} portfolio={portfolio} initial={editingActivity} busy={busy} onCancel={closePanel} onSave={value => mutate(
          async () => {
            if (editingActivity) {
              await api.updateInvestmentActivity(editingActivity.id, value)
              return null
            } else {
              return await api.createInvestmentActivity(value)
            }
          },
          editingActivity ? 'Activity updated.' : 'Activity added.',
          (res) => editingActivity ? {
            label: 'Undo',
            onAction: () => mutateUndo(() => api.updateInvestmentActivity(editingActivity.id, {
              accountId: editingActivity.accountId,
              instrumentId: editingActivity.instrumentId,
              type: editingActivity.type,
              tradeDate: editingActivity.tradeDate,
              units: editingActivity.units,
              unitPrice: editingActivity.unitPrice,
              cashAmount: editingActivity.cashAmount,
              fees: editingActivity.fees,
              taxes: editingActivity.taxes,
              tradeFxRate: editingActivity.tradeFxRate,
              notes: editingActivity.notes,
              linkedTransferId: editingActivity.linkedTransferId,
            }), 'Activity update reverted.')
          } : res ? {
            label: 'Undo',
            onAction: () => mutateUndo(() => api.deleteInvestmentActivity(res.id), 'Activity addition undone.')
          } : undefined
        )} onNeedAccount={() => openPanel('account')} onNeedInstrument={() => openPanel('instrument')} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'price'} title="Add manual closing price" onClose={closePanel} maxWidthClassName="max-w-2xl">
        <ManualPriceForm key={`price-${formKey}`} portfolio={portfolio} busy={busy} onCancel={closePanel} onSave={value => mutate(() => api.createManualInvestmentPrice(value), 'Manual price added.', (res) => ({
          label: 'Undo',
          onAction: () => mutateUndo(() => api.deleteManualInvestmentPrice((res as any).id), 'Manual price addition undone.')
        }))} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'cash'} title="Record cash movement" onClose={closePanel} maxWidthClassName="max-w-lg">
        <CashForm key={`cash-${formKey}`} portfolio={portfolio} busy={busy} onCancel={closePanel} onSave={value => mutate(() => api.createInvestmentCashFlow(value), value.type === 'Withdrawal' ? 'Withdrawal recorded.' : 'Deposit recorded.', (res) => ({
          label: 'Undo',
          onAction: () => mutateUndo(() => api.deleteInvestmentCashFlow((res as any).id), 'Cash movement undone.')
        }))} onNeedAccount={() => openPanel('account')} />
      </BottomSheet>

      {!portfolio || (portfolio.accounts.length === 0 && portfolio.instruments.length === 0 && portfolio.activity.length === 0) ? (
        <EmptyState
          offline={isOffline}
          onAddAccount={() => openPanel('account')}
          onAddInvestment={() => openPanel('instrument')}
        />
      ) : (
        <>
          <SummaryCards portfolio={portfolio} masked={hideSensitive} />
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={isOffline} onClick={() => openPanel('account')}><Building2 className="size-4" /> Add account</Button>
            <Button variant="ghost" disabled={isOffline} onClick={() => openPanel('instrument')}><Search className="size-4" /> Add investment</Button>
            <Button variant="ghost" disabled={isOffline || portfolio.accounts.length === 0} onClick={() => openPanel('cash')}><Wallet className="size-4" /> Deposit / withdraw</Button>
            <Button variant="ghost" disabled={isOffline || portfolio.instruments.length === 0} onClick={() => openPanel('price')}><CircleDollarSign className="size-4" /> Manual price</Button>
          </div>
          <CashPanel
            portfolio={portfolio}
            offline={isOffline}
            masked={hideSensitive}
            onAdd={() => openPanel('cash')}
            onDeleteCashFlow={flow => confirm({
              title: flow.type === 'Withdrawal' ? 'Delete withdrawal?' : 'Delete deposit?',
              message: 'The account cash balance and total value will be recalculated.',
              confirmText: 'Delete',
              onConfirm: () => { void mutate(() => api.deleteInvestmentCashFlow(flow.id), 'Cash movement deleted.', () => ({
                label: 'Undo',
                onAction: () => mutateUndo(() => api.createInvestmentCashFlow({
                  accountId: flow.accountId,
                  currency: flow.currency,
                  type: flow.type,
                  amount: Math.abs(flow.amount),
                  date: flow.date,
                  notes: flow.notes
                }), 'Cash movement restored.')
              })) },
            })}
          />
          <AccountsAndInstruments
            portfolio={portfolio}
            offline={isOffline}
            onArchiveAccount={id => void mutate(() => api.archiveInvestmentAccount(id), 'Account archived.', () => {
              const account = portfolio.accounts.find(a => a.id === id)
              return account ? {
                label: 'Undo',
                onAction: () => mutateUndo(() => api.unarchiveInvestmentAccount(id, account.name, account.baseCurrency), 'Account unarchived.')
              } : undefined
            })}
            onUnarchiveAccount={(id, name, currency) => void mutate(() => api.unarchiveInvestmentAccount(id, name, currency), 'Account unarchived.', () => ({
              label: 'Undo',
              onAction: () => mutateUndo(() => api.archiveInvestmentAccount(id), 'Account archived.')
            }))}
            onDeleteAccount={id => {
              const account = portfolio.accounts.find(a => a.id === id)
              confirm({
                title: 'Delete investment account?',
                message: 'Only accounts without activity can be deleted.',
                confirmText: 'Delete',
                onConfirm: () => { void mutate(() => api.deleteInvestmentAccount(id), 'Account deleted.', () => account ? {
                  label: 'Undo',
                  onAction: () => mutateUndo(() => api.createInvestmentAccount({ name: account.name, baseCurrency: account.baseCurrency }), 'Account restored.')
                } : undefined) },
              })
            }}
            onDeleteInstrument={id => {
              const instrument = portfolio.instruments.find(i => i.id === id)
              confirm({
                title: 'Delete investment?',
                message: 'Only investments without activity can be deleted.',
                confirmText: 'Delete',
                onConfirm: () => { void mutate(() => api.deleteInvestmentInstrument(id), 'Investment deleted.', () => instrument ? {
                  label: 'Undo',
                  onAction: () => mutateUndo(() => api.createInvestmentInstrument({
                    symbol: instrument.symbol,
                    name: instrument.name,
                    type: instrument.type,
                    currency: instrument.currency,
                    exchange: instrument.exchange,
                    mic: instrument.mic,
                    country: instrument.country,
                    isCustom: instrument.isCustom
                  }), 'Investment restored.')
                } : undefined) },
              })
            }}
            onDeleteManualPrice={id => {
              const mp = portfolio.manualPrices.find(p => p.id === id)
              confirm({
                title: 'Delete manual price?',
                message: 'The cached provider close, if available, will become active again.',
                confirmText: 'Delete',
                onConfirm: () => { void mutate(() => api.deleteManualInvestmentPrice(id), 'Manual price deleted.', () => mp ? {
                  label: 'Undo',
                  onAction: () => mutateUndo(() => api.createManualInvestmentPrice(mp), 'Manual price restored.')
                } : undefined) },
              })
            }}
          />
          {portfolio.warnings.length > 0 && (
            <section aria-labelledby="calculation-warnings" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h2 id="calculation-warnings" className="text-sm font-bold text-foreground">Calculation notes</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">These warnings explain why some values show as incomplete above. Most clear once you run "Update prices" (which fetches the market FX rates for each trade date automatically). If the provider has no rate for a date, supply one via the "Manual price" button or by entering the trade FX rate when editing the activity.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {portfolio.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            </section>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ValueChart portfolio={portfolio} masked={hideSensitive} range={range} onRangeChange={setRange} />
            <AllocationChart portfolio={portfolio} masked={hideSensitive} selected={allocationFilter} onSelect={setAllocationFilter} />
          </div>
          <PerformanceBars portfolio={portfolio} masked={hideSensitive} />
          <HoldingsTable portfolio={portfolio} masked={hideSensitive} filter={allocationFilter} />
          <ActivityTable
            portfolio={portfolio}
            masked={hideSensitive}
            onEdit={activity => openPanel('activity', activity)}
            onDelete={activity => confirm({
              title: 'Delete investment activity?',
              message: 'All later holding results will be recalculated.',
              confirmText: 'Delete',
              onConfirm: () => { void mutate(() => api.deleteInvestmentActivity(activity.id), 'Activity deleted.', () => ({
                label: 'Undo',
                onAction: () => mutateUndo(() => api.createInvestmentActivity({
                  accountId: activity.accountId,
                  instrumentId: activity.instrumentId,
                  type: activity.type,
                  tradeDate: activity.tradeDate,
                  units: activity.units,
                  unitPrice: activity.unitPrice,
                  cashAmount: activity.cashAmount,
                  fees: activity.fees,
                  taxes: activity.taxes,
                  tradeFxRate: activity.tradeFxRate,
                  notes: activity.notes,
                  linkedTransferId: activity.linkedTransferId,
                }), 'Activity restored.')
              })) },
            })}
          />
          <section aria-labelledby="quick-insights" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
            <h2 id="quick-insights" className="text-base font-bold text-foreground">Quick insights</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {portfolio.insights.map(value => (
                <li key={value} className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs leading-relaxed text-blue-700 shadow-sm dark:text-blue-300">
                  <div className="mt-0.5 shrink-0 rounded-full bg-blue-500/20 p-1.5 text-blue-600 dark:text-blue-400">
                    <TrendingUp className="size-4" />
                  </div>
                  <span className="pt-0.5">{value}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

const EmptyState = ({ offline, onAddAccount, onAddInvestment }: { offline: boolean; onAddAccount: () => void; onAddInvestment: () => void }) => (
  <section className="app-panel rounded-2xl border border-border/60 bg-card/92 px-6 py-14 text-center">
    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500"><TrendingUp className="size-7" /></div>
    <h2 className="mt-5 text-xl font-black text-foreground">Build your investment view</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
      Add an account and an opening position to get started.
    </p>
    <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
      <Button variant="primary" disabled={offline} onClick={onAddAccount}><Building2 className="size-4" /> Add account</Button>
      <Button variant="ghost" disabled={offline} onClick={onAddInvestment}><Search className="size-4" /> Add investment</Button>
    </div>
  </section>
)

const SummaryCards = ({ portfolio, masked }: { portfolio: InvestmentPortfolio; masked: boolean }) => {
  const format = (value?: number, suffix = '') => value === undefined ? 'Incomplete' : masked ? '••••' : `${money(value, portfolio.appCurrency)}${suffix}`
  const unrealised = portfolio.summary.unrealisedProfitLoss
  const realised = portfolio.summary.realisedProfitLoss
  const daily = portfolio.summary.dailyChange

  const getColor = (val?: number) => {
    if (val === undefined) return 'text-amber-500'
    if (val > 0) return 'text-emerald-500'
    if (val < 0) return 'text-orange-500'
    return 'text-foreground'
  }

  const getStyle = (val?: number) => {
    if (val === undefined) return 'bg-card/92 border-border/60'
    if (val > 0) return 'bg-emerald-500/5 border-emerald-500/20'
    if (val < 0) return 'bg-orange-500/5 border-orange-500/20'
    return 'bg-card/92 border-border/60'
  }

  const cards = [
    { label: 'Total value', value: format(portfolio.summary.totalValue), note: 'Holdings plus uninvested cash', color: portfolio.summary.totalValue === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.totalValue === undefined },
    { label: 'Portfolio value', value: format(portfolio.summary.marketValue), note: 'Latest cached or manual prices', color: portfolio.summary.marketValue === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.marketValue === undefined },
    { label: 'Cash', value: format(portfolio.summary.cashValue), note: 'Uninvested settlement cash', color: portfolio.summary.cashValue === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.cashValue === undefined },
    { label: 'Growth ledger balance', value: format(portfolio.summary.growthLedgerBalance), note: 'Read-only ledger context', color: portfolio.summary.growthLedgerBalance === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: false },
    { label: 'Cost basis', value: format(portfolio.summary.costBasis), note: 'Historical trade FX where needed', color: portfolio.summary.costBasis === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.costBasis === undefined },
    { label: 'Unrealised P/L', value: unrealised === undefined ? 'Incomplete' : masked ? '••••' : `${unrealised > 0 ? '+' : ''}${money(unrealised, portfolio.appCurrency)} · ${((portfolio.summary.unrealisedPercent ?? 0) > 0 ? '+' : '')}${(portfolio.summary.unrealisedPercent ?? 0).toFixed(1)}%`, note: 'Market value minus cost basis', color: getColor(unrealised), bg: getStyle(unrealised), isIncomplete: unrealised === undefined },
    { label: 'Realised P/L', value: realised === undefined ? 'Incomplete' : masked ? '••••' : `${realised > 0 ? '+' : ''}${money(realised, portfolio.appCurrency)}`, note: 'Closed units and fees', color: getColor(realised), bg: getStyle(realised), isIncomplete: realised === undefined },
    { label: 'Net dividends', value: format(portfolio.summary.netDividends), note: 'Separate from capital gains', color: portfolio.summary.netDividends === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.netDividends === undefined },
    { label: 'Daily change', value: daily === undefined ? 'Incomplete' : masked ? '••••' : `${daily > 0 ? '+' : ''}${money(daily, portfolio.appCurrency)}`, note: 'Based on cached daily closes', color: getColor(daily), bg: getStyle(daily), isIncomplete: daily === undefined },
  ]
  return (
    <section aria-label="Investment summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ label, value, note, color, bg, isIncomplete }) => (
        <div key={label} className={`app-panel rounded-2xl border p-4 ${bg}`}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`mt-2 truncate text-lg font-black ${color}`} title={value}>{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>
          {isIncomplete && <p className="mt-1 text-[9px] text-amber-500/80">See calculation notes below</p>}
        </div>
      ))}
    </section>
  )
}

const CashPanel = ({ portfolio, offline, masked, onAdd, onDeleteCashFlow }: {
  portfolio: InvestmentPortfolio
  offline: boolean
  masked: boolean
  onAdd: () => void
  onDeleteCashFlow: (flow: InvestmentCashFlow) => void
}) => {
  const accountNames = new Map(portfolio.accounts.map(value => [value.id, value.name]))
  const hasCash = portfolio.cashBalances.length > 0 || portfolio.cashFlows.length > 0
  return (
    <section aria-labelledby="cash-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><Wallet className="size-4 text-emerald-500" /><h2 id="cash-title" className="text-base font-bold text-foreground">Cash</h2></div>
        <Button variant="ghost" size="sm" disabled={offline || portfolio.accounts.length === 0} onClick={onAdd}><Plus className="size-4" /> Deposit / withdraw</Button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Uninvested settlement cash held at your broker. Dividends and sale proceeds add to it; buys and fees draw it down. It counts toward your total value.</p>
      {!hasCash ? (
        <p className="mt-4 rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">No uninvested cash tracked yet. Record a deposit to reflect the settlement cash sitting in your broker account.</p>
      ) : (
        <>
          {portfolio.cashBalances.length > 0 && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.cashBalances.map(balance => (
                <div key={`${balance.accountId}-${balance.currency}`} className="rounded-xl bg-muted/25 p-3">
                  <p className="truncate text-xs font-bold text-foreground">{balance.accountName}</p>
                  <p className={`mt-1 text-base font-black ${balance.amount < 0 ? 'text-orange-500' : 'text-foreground'}`}>{masked ? '••••' : money(balance.amount, balance.currency)}</p>
                  {balance.currency !== portfolio.appCurrency && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{balance.amountApp === undefined ? 'FX needed for conversion' : `≈ ${masked ? '••••' : money(balance.amountApp, portfolio.appCurrency)}`}</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {portfolio.cashFlows.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Deposits &amp; withdrawals</h3>
              <div className="mt-2 space-y-2">
                {portfolio.cashFlows.map(flow => (
                  <div key={flow.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3">
                    <span className="min-w-0">
                      <strong className="block truncate text-xs text-foreground">{flow.type} · {accountNames.get(flow.accountId) ?? 'Account'}</strong>
                      <span className="block truncate text-[10px] text-muted-foreground">{flow.date}{flow.notes ? ` · ${flow.notes}` : ''}</span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className={`text-xs font-bold ${flow.amount < 0 ? 'text-orange-500' : 'text-emerald-500'}`}>{masked ? '••••' : money(flow.amount, flow.currency)}</span>
                      <Button variant="danger" size="sm" disabled={offline} onClick={() => onDeleteCashFlow(flow)}>Delete</Button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

const AccountsAndInstruments = ({
  portfolio,
  offline,
  onArchiveAccount,
  onUnarchiveAccount,
  onDeleteAccount,
  onDeleteInstrument,
  onDeleteManualPrice,
}: {
  portfolio: InvestmentPortfolio
  offline: boolean
  onArchiveAccount: (id: string) => void
  onUnarchiveAccount: (id: string, name: string, currency: string) => void
  onDeleteAccount: (id: string) => void
  onDeleteInstrument: (id: string) => void
  onDeleteManualPrice: (id: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const accountHasActivity = (id: string) => portfolio.activity.some(value => value.accountId === id)
  const instrumentHasActivity = (id: string) => portfolio.activity.some(value => value.instrumentId === id)
  const instrumentById = new Map(portfolio.instruments.map(value => [value.id, value]))
  return (
    <section className="app-panel rounded-2xl border border-border/60 bg-card/92">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left"
      >
        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <strong className="text-sm text-foreground">Accounts, investments, and manual prices</strong>
          <span className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-600 dark:text-blue-400">{portfolio.accounts.length} ACCOUNT{portfolio.accounts.length === 1 ? '' : 'S'}</span>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-violet-600 dark:text-violet-400">{portfolio.instruments.length} INVESTMENT{portfolio.instruments.length === 1 ? '' : 'S'}</span>
          </span>
        </span>
        <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid gap-5 border-t border-border/50 p-4 lg:grid-cols-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Accounts</h3>
            <div className="mt-2 space-y-2">
              {portfolio.accounts.map(value => (
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3">
                  <span className="min-w-0">
                    <strong className="block truncate text-xs text-foreground">{value.name}</strong>
                    <span className="text-[10px] text-muted-foreground">{value.baseCurrency}{value.isArchived ? ' · Archived' : ''}</span>
                  </span>
                  <div className="flex shrink-0 gap-1">
                    {value.isArchived ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={offline}
                        onClick={() => onUnarchiveAccount(value.id, value.name, value.baseCurrency)}
                      >
                        Unarchive
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={offline}
                        onClick={() => accountHasActivity(value.id) ? onArchiveAccount(value.id) : onDeleteAccount(value.id)}
                      >
                        {accountHasActivity(value.id) ? 'Archive' : 'Delete'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Investments</h3>
            <div className="mt-2 space-y-2">
              {portfolio.instruments.map(value => (
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3">
                  <span className="min-w-0">
                    <strong className="block truncate text-xs text-foreground">{value.symbol} · {value.name}</strong>
                    <span className="text-[10px] text-muted-foreground">{value.type} · {value.currency} · {value.isCustom ? 'Manual' : value.mic ?? value.exchange ?? 'Provider'}</span>
                  </span>
                  {!instrumentHasActivity(value.id) && (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={offline}
                      onClick={() => onDeleteInstrument(value.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Manual prices</h3>
            <div className="mt-2 space-y-2">
              {portfolio.manualPrices.map(value => (
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3">
                  <span>
                    <strong className="block text-xs text-foreground">{instrumentById.get(value.instrumentId)?.symbol ?? 'Investment'} · {value.marketDate}</strong>
                    <span className="text-[10px] text-muted-foreground">Manual close recorded</span>
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={offline}
                    onClick={() => onDeleteManualPrice(value.id)}
                  >
                    Delete
                  </Button>
                </div>
              ))}
              {portfolio.manualPrices.length === 0 && <p className="text-xs text-muted-foreground">No manual prices.</p>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

const ValueChart = ({ portfolio, masked, range, onRangeChange }: { portfolio: InvestmentPortfolio; masked: boolean; range: InvestmentRange; onRangeChange: (value: InvestmentRange) => void }) => {
  const values = portfolio.chart.flatMap(point => [point.marketValue, point.costBasis, point.netContributions]).filter((value): value is number => value !== undefined)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const width = 720
  const height = 240
  const x = (index: number) => portfolio.chart.length <= 1 ? width / 2 : index / (portfolio.chart.length - 1) * width
  const y = (value: number) => height - ((value - min) / (max - min || 1)) * (height - 20) - 10
  const line = (key: 'marketValue' | 'costBasis' | 'netContributions') =>
    portfolio.chart
      .map((point, index) => point[key] === undefined ? null : `${x(index)},${y(point[key]!)}`)
      .filter(Boolean)
      .join(' ')
  const latest = portfolio.chart.at(-1)
  const hasAnyMarketValue = portfolio.chart.some(p => p.marketValue !== undefined)
  const summary = latest
    ? `Latest chart values: market ${masked || latest.marketValue === undefined ? 'hidden or incomplete' : money(latest.marketValue, portfolio.appCurrency)}, cost basis ${masked || latest.costBasis === undefined ? 'hidden or incomplete' : money(latest.costBasis, portfolio.appCurrency)}, net contributions ${masked || latest.netContributions === undefined ? 'hidden or incomplete' : money(latest.netContributions, portfolio.appCurrency)}.`
    : 'No chart data is available.'
  return (
    <section aria-labelledby="value-chart-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="value-chart-title" className="text-base font-bold text-foreground">Portfolio value</h2>
          <p className="mt-1 text-xs text-muted-foreground">Market value, cost basis, and net contributions.</p>
        </div>
        <div className="flex max-w-full shrink-0 gap-1 self-start overflow-x-auto rounded-xl bg-muted/40 p-1" role="group" aria-label="Chart range">
          {ranges.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => onRangeChange(item.value)}
              className={`cursor-pointer whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${range === item.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              aria-pressed={range === item.value}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p className="sr-only">{summary}</p>
      {portfolio.chart.length === 0 ? (
        <div className="flex h-60 items-center justify-center text-xs text-muted-foreground">Add activity to create a value history.</div>
      ) : !hasAnyMarketValue ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <span className="text-amber-500 font-semibold">Chart unavailable</span>
          <span className="max-w-xs">Market values cannot be plotted because prices or FX rates are missing. Supply prices via "Update prices" or "Manual price", and add missing trade FX rates by editing each activity.</span>
        </div>
      ) : (
        <div className={`mt-5 overflow-hidden ${masked ? 'blur-md select-none' : ''}`} aria-hidden={masked}>
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-48 w-full sm:h-60" role="img" aria-label={summary}>
            <defs>
              <pattern id="investment-grid" width="72" height="48" patternUnits="userSpaceOnUse">
                <path d="M 72 0 L 0 0 0 48" fill="none" className="stroke-border" strokeWidth="1" opacity=".45" />
              </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#investment-grid)" />
            <polyline points={line('marketValue')} fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinejoin="round" vectorEffect="nonScalingStroke" />
            <polyline points={line('costBasis')} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" vectorEffect="nonScalingStroke" />
            <polyline points={line('netContributions')} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="7 6" strokeLinejoin="round" vectorEffect="nonScalingStroke" />
          </svg>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-semibold text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 rounded-full bg-violet-500" /> Market value</span>
        <span><i className="mr-1 inline-block size-2 rounded-full bg-blue-500" /> Cost basis</span>
        <span><i className="mr-1 inline-block size-2 rounded-full bg-amber-500" /> Net contributions</span>
      </div>
      <table className="sr-only">
        <caption>Portfolio value chart data</caption>
        <thead><tr><th>Date</th><th>Market value</th><th>Cost basis</th><th>Net contributions</th></tr></thead>
        <tbody>{portfolio.chart.map(point => <tr key={point.date}><td>{point.date}</td><td>{masked ? 'Hidden' : point.marketValue}</td><td>{masked ? 'Hidden' : point.costBasis}</td><td>{masked ? 'Hidden' : point.netContributions}</td></tr>)}</tbody>
      </table>
    </section>
  )
}

const AllocationChart = ({ portfolio, masked, selected, onSelect }: { portfolio: InvestmentPortfolio; masked: boolean; selected: AllocationFilter; onSelect: (value: AllocationFilter) => void }) => {
  const [mode, setMode] = useState<AllocationMode>('instrument')
  const groups = useMemo(() => {
    const map = new Map<string, number>()
    portfolio.holdings.forEach(holding => {
      const key = mode === 'asset' ? holding.type : mode === 'account' ? holding.accountName : `${holding.symbol} · ${holding.name}`
      map.set(key, (map.get(key) ?? 0) + (holding.valueApp ?? 0))
    })
    // Fold uninvested cash into the mix so the donut reflects total assets, like a
    // broker app. Per-account cash merges into its account slice; otherwise it is a
    // single "Cash" slice. Negative or unconvertible balances are omitted.
    portfolio.cashBalances.forEach(balance => {
      if (balance.amountApp === undefined || balance.amountApp <= 0) return
      const key = mode === 'account' ? balance.accountName : 'Cash'
      map.set(key, (map.get(key) ?? 0) + balance.amountApp)
    })
    return [...map].sort((a, b) => b[1] - a[1])
  }, [portfolio.holdings, portfolio.cashBalances, mode])
  const total = groups.reduce((sum, [, value]) => sum + value, 0)
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#64748b']
  let cursor = 0
  const stops = groups.map(([, value], index) => {
    const start = total ? cursor / total * 100 : 0
    cursor += value
    return `${colors[index % colors.length]} ${start}% ${total ? cursor / total * 100 : 0}%`
  }).join(', ')
  const allocationModeOptions: Array<{ value: AllocationMode; label: string }> = [
    { value: 'instrument', label: 'Instrument' },
    { value: 'asset', label: 'Asset type' },
    { value: 'account', label: 'Account' },
  ]
  const filterMode: AllocationMode = mode === 'instrument' ? 'asset' : mode
  return (
    <section aria-labelledby="allocation-title" className="app-panel flex flex-col rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0"><h2 id="allocation-title" className="text-base font-bold text-foreground">Allocation</h2><p className="mt-1 text-xs text-muted-foreground">Total assets by segment, including cash. Select a segment to highlight matching holdings.</p></div>
        <div className="w-full shrink-0 sm:w-auto">
          <CustomSelect
            value={mode}
            onChange={value => { setMode(value as AllocationMode); onSelect(null) }}
            options={allocationModeOptions}
            ariaLabel="Group allocation by"
            className="w-full sm:w-auto"
            align="right"
          />
        </div>
      </div>
      <div className="mt-5 flex flex-1 flex-col items-center justify-center gap-6 sm:flex-row lg:flex-col lg:justify-start">
        <div
          role="img"
          aria-label={groups.map(([name, value]) => `${name} ${total ? (value / total * 100).toFixed(1) : 0}%`).join(', ') || 'No valued holdings'}
          className={`relative size-36 shrink-0 rounded-full lg:size-44 ${masked ? 'blur-md' : ''}`}
          style={{ background: groups.length ? `conic-gradient(${stops})` : 'var(--muted)' }}
        >
          <div className="absolute inset-8 rounded-full bg-card lg:inset-10" />
        </div>
        <div className="min-w-0 w-full flex-1 space-y-2 lg:flex-none">
          {groups.map(([name, value], index) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                const symbol = mode === 'instrument' ? name.split(' · ')[0] : name
                if (symbol === 'Cash' && mode !== 'account') { onSelect(null); return }
                const fMode = mode === 'instrument' ? 'asset' : mode
                onSelect(selected?.mode === fMode && selected.key === symbol ? null : { mode: fMode, key: symbol })
              }}
              aria-pressed={mode === 'instrument'
                ? selected?.key === name.split(' · ')[0]
                : selected?.mode === filterMode && selected?.key === name}
              className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-muted/60 ${
                (mode === 'instrument' ? selected?.key === name.split(' · ')[0] : selected?.mode === filterMode && selected?.key === name)
                  ? 'bg-muted'
                  : ''
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-left"><i className="mr-2 inline-block size-2 shrink-0 rounded-full" style={{ background: colors[index % colors.length] }} />{name}</span>
              <span className="shrink-0 font-bold">{masked ? '••' : `${total ? (value / total * 100).toFixed(1) : 0}%`}</span>
            </button>
          ))}
          {groups.length === 0 && <p className="text-xs text-muted-foreground">Add prices to see allocation.</p>}
        </div>
      </div>
      {selected && <p className="mt-3 text-[10px] text-muted-foreground">Selected: {selected.key}. The holdings table is filtered to this allocation.</p>}
    </section>
  )
}

const PerformanceBars = ({ portfolio, masked }: { portfolio: InvestmentPortfolio; masked: boolean }) => {
  const holdings = [...portfolio.holdings].filter(value => value.unrealisedPercent !== undefined).sort((a, b) => (b.unrealisedPercent ?? 0) - (a.unrealisedPercent ?? 0))
  const scale = Math.max(...holdings.map(value => Math.abs(value.unrealisedPercent ?? 0)), 1)
  return (
    <section aria-labelledby="performance-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <h2 id="performance-title" className="text-base font-bold text-foreground">Holding performance</h2>
      <p className="mt-1 text-xs text-muted-foreground">Unrealised percentage gain or loss, ranked.</p>
      <div className="mt-4 space-y-3">
        {holdings.map(holding => (
          <div key={`${holding.accountId}-${holding.instrumentId}`} className="grid grid-cols-[64px_minmax(0,1fr)_52px] items-center gap-3 text-xs">
            <span className="truncate font-bold text-foreground">{holding.symbol}</span>
            <div className="relative h-3 rounded-full bg-muted">
              <div className="absolute left-1/2 top-0 h-full w-px bg-border" />
              <div
                className={`absolute top-0 h-full rounded-full ${(holding.unrealisedPercent ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                style={(holding.unrealisedPercent ?? 0) >= 0
                  ? { left: '50%', width: `${Math.abs(holding.unrealisedPercent ?? 0) / scale * 50}%` }
                  : { right: '50%', width: `${Math.abs(holding.unrealisedPercent ?? 0) / scale * 50}%` }}
              />
            </div>
            <span className="text-right font-bold">{masked ? '••' : `${(holding.unrealisedPercent ?? 0).toFixed(1)}%`}</span>
          </div>
        ))}
        {holdings.length === 0 && <p className="text-xs text-muted-foreground">Prices and cost basis are needed for performance.</p>}
      </div>
    </section>
  )
}

const HoldingsTable = ({ portfolio, masked, filter }: { portfolio: InvestmentPortfolio; masked: boolean; filter: AllocationFilter }) => {
  const holdings = portfolio.holdings.filter(holding =>
    !filter ||
    (filter.mode === 'asset' ? holding.type === filter.key || holding.symbol === filter.key : holding.accountName === filter.key))
  return (
  <section aria-labelledby="holdings-title" className="app-panel overflow-hidden rounded-2xl border border-border/60 bg-card/92">
    <div className="p-5"><h2 id="holdings-title" className="text-base font-bold text-foreground">Holdings</h2><p className="mt-1 text-xs text-muted-foreground">Current positions by account and investment.{filter ? ` Filtered by ${filter.key}.` : ''}</p></div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[1050px] text-left text-xs">
        <thead className="border-y border-border/50 bg-muted/25 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3">Investment</th><th className="px-4 py-3">Account</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">Avg cost</th><th className="px-4 py-3 text-right">Latest</th><th className="px-4 py-3 text-right">Native value</th><th className="px-4 py-3 text-right">{portfolio.appCurrency} value</th><th className="px-4 py-3 text-right">Daily</th><th className="px-4 py-3 text-right">P/L</th><th className="px-4 py-3">Price date</th></tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {holdings.map(holding => (
            <tr key={`${holding.accountId}-${holding.instrumentId}`} className="hover:bg-muted/20">
              <td className="px-4 py-3"><span className="font-bold text-foreground">{holding.symbol}</span><span className="ml-2 text-[10px] text-muted-foreground">{holding.type}</span><span className="block max-w-44 truncate text-[10px] text-muted-foreground">{holding.name}</span></td>
              <td className="px-4 py-3 text-muted-foreground">{holding.accountName}</td>
              <td className="px-4 py-3 text-right font-medium">{masked ? '••••' : number(holding.units, 8)}</td>
              <td className="px-4 py-3 text-right">{masked ? '••••' : money(holding.averageCostNative, holding.currency)}</td>
              <td className="px-4 py-3 text-right">{masked ? '••••' : holding.latestPriceNative === undefined ? 'Unavailable' : money(holding.latestPriceNative, holding.currency)}{holding.usesManualPrice && <span className="block text-[9px] text-blue-500">Manual</span>}</td>
              <td className="px-4 py-3 text-right">{masked ? '••••' : holding.valueNative === undefined ? '—' : money(holding.valueNative, holding.currency)}</td>
              <td className="px-4 py-3 text-right font-bold">{masked ? '••••' : holding.valueApp === undefined ? 'Incomplete FX' : money(holding.valueApp, portfolio.appCurrency)}</td>
              <td className="px-4 py-3 text-right">{masked ? '••••' : holding.dailyChangeApp === undefined ? '—' : money(holding.dailyChangeApp, portfolio.appCurrency)}</td>
              <td className={`px-4 py-3 text-right font-bold ${(holding.unrealisedProfitLossApp ?? 0) >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>{masked ? '••••' : holding.unrealisedProfitLossApp === undefined ? '—' : `${money(holding.unrealisedProfitLossApp, portfolio.appCurrency)} (${(holding.unrealisedPercent ?? 0).toFixed(1)}%)`}</td>
              <td className="px-4 py-3 text-muted-foreground">{holding.priceDate ?? 'Unavailable'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
  )
}

const ActivityTable = ({ portfolio, masked, onEdit, onDelete }: { portfolio: InvestmentPortfolio; masked: boolean; onEdit: (activity: InvestmentActivity) => void; onDelete: (activity: InvestmentActivity) => void }) => {
  const [account, setAccount] = useState('')
  const [instrument, setInstrument] = useState('')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const filtered = portfolio.activity.filter(value =>
    (!account || value.accountId === account) &&
    (!instrument || value.instrumentId === instrument) &&
    (!type || value.type === type) &&
    (!from || value.tradeDate >= from) &&
    (!to || value.tradeDate <= to))
  const hasFilters = !!(account || instrument || type || from || to)
  const clearFilters = () => { setAccount(''); setInstrument(''); setType(''); setFrom(''); setTo('') }
  const accounts = new Map(portfolio.accounts.map(value => [value.id, value.name]))
  const instruments = new Map(portfolio.instruments.map(value => [value.id, value]))
  const accountOptions = [{ value: '', label: 'All accounts' }, ...portfolio.accounts.map(a => ({ value: a.id, label: a.name }))]
  const instrumentOptions = [{ value: '', label: 'All investments' }, ...portfolio.instruments.map(i => ({ value: i.id, label: i.symbol }))]
  const typeOptions = [{ value: '', label: 'All types' }, ...activityTypes.map(t => ({ value: t.value, label: t.label }))]
  return (
    <section aria-labelledby="activity-title" className="app-panel overflow-hidden rounded-2xl border border-border/60 bg-card/92">
      <div className="p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-blue-500" /><h2 id="activity-title" className="text-base font-bold text-foreground">Activity</h2></div>
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-blue-600 transition-colors hover:bg-blue-500/10 dark:text-blue-400"
            >
              <X className="size-3" /> Clear filters
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <CustomSelect value={account} onChange={v => setAccount(v as string)} options={accountOptions} ariaLabel="Filter by account" className="w-full" />
          <CustomSelect value={instrument} onChange={v => setInstrument(v as string)} options={instrumentOptions} ariaLabel="Filter by investment" className="w-full" />
          <CustomSelect value={type} onChange={v => setType(v as string)} options={typeOptions} ariaLabel="Filter by type" className="w-full" />
          <div className="flex items-center gap-1">
            <DatePicker value={from} onChange={setFrom} placeholder="From date" className="w-full" />
            {from && <button type="button" onClick={() => setFrom('')} aria-label="Clear from date" className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
          </div>
          <div className="flex items-center gap-1">
            <DatePicker value={to} onChange={setTo} placeholder="To date" className="w-full" />
            {to && <button type="button" onClick={() => setTo('')} aria-label="Clear to date" className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>}
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="border-y border-border/50 bg-muted/25 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Investment</th><th className="px-4 py-3">Account</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map(value => {
              const item = instruments.get(value.instrumentId)
              return (
                <tr key={value.id} className="hover:bg-muted/20">
                  <td className="px-4 py-3">{value.tradeDate}</td>
                  <td className="px-4 py-3 font-bold">{activityTypes.find(type => type.value === value.type)?.label}</td>
                  <td className="px-4 py-3">{item?.symbol}</td>
                  <td className="px-4 py-3">{accounts.get(value.accountId)}</td>
                  <td className="px-4 py-3 text-right">{masked ? '••••' : number(value.units, 8)}</td>
                  <td className="px-4 py-3 text-right">{masked ? '••••' : value.cashAmount === undefined ? '—' : money(value.cashAmount, item?.currency ?? portfolio.appCurrency)}</td>
                  <td className="max-w-52 truncate px-4 py-3 text-muted-foreground">{value.notes ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className="flex gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(value)}>Edit</Button>
                      <Button variant="danger" size="sm" onClick={() => onDelete(value)}>Delete</Button>
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="p-5 text-xs text-muted-foreground">No activity matches these filters.</p>}
    </section>
  )
}

const FormActions = ({ busy, onCancel, submitLabel, disabled }: { busy: boolean; onCancel: () => void; submitLabel: string; disabled?: boolean }) => (
  <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
    <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
    <Button type="submit" disabled={busy || disabled}>{busy && <Loader2 className="size-4 animate-spin" />} {submitLabel}</Button>
  </div>
)

const AccountForm = ({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (value: api.AccountMutation) => Promise<boolean> }) => {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void onSave({ name, baseCurrency: currency }) }}>
    <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
      <label className={labelClass}>Account name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Moomoo" className={inputClass} /></label>
      <label className={labelClass}>Base currency<input required pattern="[A-Za-z]{3}" maxLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} className={inputClass} /></label>
    </div>
    <p className="text-[10px] text-muted-foreground">Only a display name is stored. Broker credentials and broker API connections are not supported.</p>
    <FormActions busy={busy} onCancel={onCancel} submitLabel="Add account" />
  </form>
}

const InstrumentForm = ({ busy, offline, onCancel, onSave }: { busy: boolean; offline: boolean; onCancel: () => void; onSave: (value: api.InstrumentMutation) => Promise<boolean> }) => {
  const [manual, setManual] = useState(false)
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<InstrumentSearchResult[]>([])
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<InstrumentSearchResult | null>(null)
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<'Stock' | 'ETF'>('Stock')
  const [currency, setCurrency] = useState('USD')
  useEffect(() => {
    if (manual || offline || query.trim().length < 3) {
      setResults([])
      setMessage(query.trim().length > 0 && query.trim().length < 3 ? 'Enter at least three characters.' : '')
      return
    }
    const abort = new AbortController()
    const timer = window.setTimeout(() => {
      setSearching(true)
      api.searchInvestmentInstruments(query.trim(), abort.signal)
        .then(response => { setResults(response.results); setMessage(response.message ?? '') })
        .catch(error => {
          if (!(error instanceof DOMException && error.name === 'AbortError')) setMessage(error instanceof Error ? error.message : 'Search failed.')
        })
        .finally(() => { if (!abort.signal.aborted) setSearching(false) })
    }, 600)
    return () => { window.clearTimeout(timer); abort.abort() }
  }, [query, manual, offline])
  const saveManual = (event: React.FormEvent) => {
    event.preventDefault()
    void onSave({ symbol, name, type, currency, isCustom: true })
  }
  return <div className="space-y-4">
    <div className="flex gap-1 rounded-xl bg-muted/40 p-1 w-fit">
      <button type="button" onClick={() => setManual(false)} className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${!manual ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Search markets</button>
      <button type="button" onClick={() => setManual(true)} className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${manual ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>Custom / manual</button>
    </div>
    {manual ? <form className="space-y-4" onSubmit={saveManual}>
      <div className="grid gap-4 sm:grid-cols-4">
        <label className={labelClass}>Ticker<input required maxLength={32} value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} className={inputClass} /></label>
        <label className={`${labelClass} sm:col-span-2`}>Full name<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} className={inputClass} /></label>
        <div className={labelClass}>Type<CustomSelect value={type} onChange={v => setType(v as 'Stock' | 'ETF')} options={[{ value: 'Stock', label: 'Stock' }, { value: 'ETF', label: 'ETF' }]} ariaLabel="Investment type" className="mt-1.5 w-full" /></div>
        <label className={labelClass}>Currency<input required pattern="[A-Za-z]{3}" maxLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} className={inputClass} /></label>
      </div>
      <FormActions busy={busy} onCancel={onCancel} submitLabel="Save investment" />
    </form> : <>
      <label className={labelClass}>Symbol or company / fund name<div className="relative mt-1.5"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input value={query} onChange={event => { setQuery(event.target.value); setSelected(null) }} placeholder="Search at least 3 characters" className={`${inputClass} pl-9`} />{searching && <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-blue-500" />}</div></label>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      <div className="grid gap-2">
        {results.map(result => <button type="button" key={`${result.symbol}-${result.mic ?? result.exchange}`} onClick={() => setSelected(result)} className={`cursor-pointer rounded-xl border p-3 text-left transition-colors ${selected === result ? 'border-blue-500 bg-blue-500/5' : 'border-border/50 hover:bg-muted/30'}`}>
          <span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-foreground">{result.symbol}</strong><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold">{result.type}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${result.availableOnBasic ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{result.availableOnBasic ? 'Basic available' : 'Plan unavailable'}</span></span>
          <span className="mt-1 block text-xs text-muted-foreground">{result.name}</span>
          <span className="mt-1 block text-[10px] text-muted-foreground">{[result.exchange, result.mic, result.currency, result.country].filter(Boolean).join(' · ')}</span>
        </button>)}
      </div>
      <div className="flex justify-end gap-2 border-t border-border/40 pt-4">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button disabled={busy || !selected || !selected.availableOnBasic} onClick={() => selected && void onSave({ symbol: selected.symbol, name: selected.name, type: selected.type, currency: selected.currency, exchange: selected.exchange, mic: selected.mic, country: selected.country, providerSymbol: selected.symbol, providerMic: selected.mic, isCustom: false })}>{busy && <Loader2 className="size-4 animate-spin" />} Save investment</Button>
      </div>
    </>}
  </div>
}

const ActivityForm = ({ portfolio, initial, busy, onCancel, onSave, onNeedAccount, onNeedInstrument }: { portfolio: InvestmentPortfolio | null; initial: InvestmentActivity | null; busy: boolean; onCancel: () => void; onSave: (value: api.InvestmentActivityMutation) => Promise<boolean>; onNeedAccount: () => void; onNeedInstrument: () => void }) => {
  const accounts = portfolio?.accounts.filter(value => !value.isArchived) ?? []
  const instruments = portfolio?.instruments.filter(value => !value.isArchived) ?? []
  const [type, setType] = useState<InvestmentTransactionType>(initial?.type ?? 'OpeningPosition')
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [instrumentId, setInstrumentId] = useState(initial?.instrumentId ?? instruments[0]?.id ?? '')
  const [tradeDate, setTradeDate] = useState(initial?.tradeDate ?? today())
  const [units, setUnits] = useState(initial?.units ? String(initial.units) : '')
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice ? String(initial.unitPrice) : '')
  const [cashAmount, setCashAmount] = useState(initial?.cashAmount ? String(initial.cashAmount) : '')
  const [fees, setFees] = useState(String(initial?.fees ?? 0))
  const [taxes, setTaxes] = useState(String(initial?.taxes ?? 0))
  const [fx, setFx] = useState(initial?.tradeFxRate ? String(initial.tradeFxRate) : '')
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [destination, setDestination] = useState('')
  const selectedInstrument = instruments.find(value => value.id === instrumentId)
  // "Enter any two of units, unit price, gross; the third is derived" (gross =
  // units x price). We track the two most recently edited fields and only ever
  // recompute the remaining one, so no user-entered value is clobbered and there
  // is no derivation loop. Prefilled values on an edit are left alone until the
  // user has edited at least two of the three fields.
  const editOrder = useRef<Array<'units' | 'price' | 'gross'>>([])
  const noteEdit = (field: 'units' | 'price' | 'gross') => {
    editOrder.current = [field, ...editOrder.current.filter(value => value !== field)]
  }
  useEffect(() => {
    if (!['OpeningPosition', 'Buy', 'Sell'].includes(type)) return
    const recent = editOrder.current.slice(0, 2)
    if (recent.length < 2) return
    const fmt = (value: number) => value.toFixed(6).replace(/\.?0+$/, '')
    const derive = (['units', 'price', 'gross'] as const).find(value => !recent.includes(value))!
    const u = numberOrUndefined(units)
    const p = numberOrUndefined(unitPrice)
    const c = numberOrUndefined(cashAmount)
    if (derive === 'gross' && u && p) setCashAmount(fmt(u * p))
    else if (derive === 'units' && c && p) setUnits(fmt(c / p))
    else if (derive === 'price' && c && u) setUnitPrice(fmt(c / u))
  }, [units, unitPrice, cashAmount, type])
  if (!accounts.length || !instruments.length) return <div><p className="text-sm text-muted-foreground">Add both an account and an investment before recording activity.</p><div className="mt-4 flex gap-2">{!accounts.length && <Button onClick={onNeedAccount}>Add account</Button>}{!instruments.length && <Button variant="ghost" onClick={onNeedInstrument}>Add investment</Button>}</div></div>
  const needsUnits = !['Dividend', 'FeeTax'].includes(type)
  const trade = ['OpeningPosition', 'Buy', 'Sell'].includes(type)
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void onSave({
      accountId, instrumentId, type, tradeDate,
      units: numberOrUndefined(units), unitPrice: numberOrUndefined(unitPrice), cashAmount: numberOrUndefined(cashAmount),
      fees: Number(fees || 0), taxes: Number(taxes || 0), tradeFxRate: numberOrUndefined(fx), notes,
      destinationAccountId: type === 'TransferOut' && destination ? destination : undefined,
    })
  }
  const feesLabelSuffix = selectedInstrument ? ` (${selectedInstrument.currency})` : ''
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div className={labelClass}>Activity type<CustomSelect value={type} onChange={v => setType(v as InvestmentTransactionType)} options={activityTypes.map(t => ({ value: t.value, label: t.label }))} ariaLabel="Activity type" className="mt-1.5 w-full" /></div>
    <div className={labelClass}>Account<CustomSelect value={accountId} onChange={v => setAccountId(v as string)} options={accounts.map(a => ({ value: a.id, label: a.name }))} ariaLabel="Account" className="mt-1.5 w-full" /></div>
    <div className={labelClass}>Investment<CustomSelect value={instrumentId} onChange={v => setInstrumentId(v as string)} options={instruments.map(i => ({ value: i.id, label: `${i.symbol} · ${i.name}` }))} ariaLabel="Investment" className="mt-1.5 w-full" /></div>
    <div className={labelClass}>Trade date<DatePicker value={tradeDate} onChange={setTradeDate} max={today()} className="mt-1.5 w-full" /></div>
    {needsUnits && <label className={labelClass}>{type === 'Split' ? 'Split ratio' : 'Units'}<input required={type === 'Split' || type.includes('Transfer')} type="number" min="0" step="0.0000000001" value={units} onChange={event => { noteEdit('units'); setUnits(event.target.value) }} className={inputClass} /></label>}
    {trade && <label className={labelClass}>Unit price ({selectedInstrument?.currency})<input type="number" min="0" step="0.0000000001" value={unitPrice} onChange={event => { noteEdit('price'); setUnitPrice(event.target.value) }} className={inputClass} /></label>}
    {type !== 'Split' && type !== 'TransferOut' && <label className={labelClass}>{type === 'TransferIn' ? 'Transferred cost basis' : type === 'Dividend' ? 'Gross dividend' : type === 'FeeTax' ? 'Charge amount' : 'Gross amount'} ({selectedInstrument?.currency})<input type="number" min="0" step="0.0000000001" value={cashAmount} onChange={event => { noteEdit('gross'); setCashAmount(event.target.value) }} className={inputClass} /></label>}
    {!['Split', 'TransferIn', 'TransferOut'].includes(type) && <><label className={labelClass}>Fees{feesLabelSuffix}<input type="number" min="0" step="0.0000000001" value={fees} onChange={event => setFees(event.target.value)} className={inputClass} /></label><label className={labelClass}>Taxes{feesLabelSuffix}<input type="number" min="0" step="0.0000000001" value={taxes} onChange={event => setTaxes(event.target.value)} className={inputClass} /></label></>}
    {selectedInstrument && selectedInstrument.currency !== portfolio?.appCurrency && <label className={labelClass}>Trade FX ({selectedInstrument.currency} → {portfolio?.appCurrency}, optional)<input type="number" min="0" step="0.0000000001" value={fx} onChange={event => setFx(event.target.value)} className={inputClass} /></label>}
    {type === 'TransferOut' && <div className={labelClass}>Destination<CustomSelect value={destination} onChange={v => setDestination(v as string)} options={[{ value: '', label: 'External transfer out' }, ...accounts.filter(a => a.id !== accountId).map(a => ({ value: a.id, label: a.name }))]} ariaLabel="Transfer destination" className="mt-1.5 w-full" /></div>}
    <label className={`${labelClass} sm:col-span-2`}>Notes<input maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} className={inputClass} /></label>
    </div>
    {trade && <p className="text-[10px] text-muted-foreground">Enter any two of units, unit price, and gross amount; the missing value is calculated.</p>}
    {selectedInstrument && selectedInstrument.currency !== portfolio?.appCurrency && <p className="text-[10px] text-muted-foreground">Amounts above stay in {selectedInstrument.currency}. Leave Trade FX blank to value them in {portfolio?.appCurrency} at the market rate for the trade date (fetched via "Update prices"); enter a rate only to override with your broker's executed rate.</p>}
    <FormActions busy={busy} onCancel={onCancel} submitLabel="Save activity" />
  </form>
}

const ManualPriceForm = ({ portfolio, busy, onCancel, onSave }: { portfolio: InvestmentPortfolio | null; busy: boolean; onCancel: () => void; onSave: (value: { instrumentId: string; marketDate: string; price: number; fxRate?: number }) => Promise<boolean> }) => {
  const instruments = portfolio?.instruments.filter(value => !value.isArchived) ?? []
  const [instrumentId, setInstrumentId] = useState(instruments[0]?.id ?? '')
  const [date, setDate] = useState(today())
  const [price, setPrice] = useState('')
  const [fx, setFx] = useState('')
  const instrument = instruments.find(value => value.id === instrumentId)
  return <form className="space-y-4" onSubmit={event => { event.preventDefault(); void onSave({ instrumentId, marketDate: date, price: Number(price), fxRate: numberOrUndefined(fx) }) }}>
    <div className="grid gap-4 sm:grid-cols-4">
      <div className={labelClass}>Investment<CustomSelect value={instrumentId} onChange={v => setInstrumentId(v as string)} options={instruments.map(i => ({ value: i.id, label: i.symbol }))} ariaLabel="Investment" className="mt-1.5 w-full" /></div>
      <div className={labelClass}>Market date<DatePicker value={date} onChange={setDate} max={today()} className="mt-1.5 w-full" /></div>
      <label className={labelClass}>Close ({instrument?.currency})<input required type="number" min="0.0000000001" step="0.0000000001" value={price} onChange={event => setPrice(event.target.value)} className={inputClass} /></label>
      {instrument && instrument.currency !== portfolio?.appCurrency && <label className={labelClass}>FX to {portfolio?.appCurrency} (optional)<input type="number" min="0.0000000001" step="0.0000000001" value={fx} onChange={event => setFx(event.target.value)} className={inputClass} /></label>}
    </div>
    <p className="text-[10px] text-muted-foreground">A manual value takes precedence over provider data for the same date. Deleting it restores the cached provider close.</p>
    <FormActions busy={busy} onCancel={onCancel} submitLabel="Save price" disabled={!instrumentId} />
  </form>
}

const CashForm = ({ portfolio, busy, onCancel, onSave, onNeedAccount }: {
  portfolio: InvestmentPortfolio | null
  busy: boolean
  onCancel: () => void
  onSave: (value: { accountId: string; currency: string; type: 'Deposit' | 'Withdrawal'; amount: number; date: string; notes?: string }) => Promise<boolean>
  onNeedAccount: () => void
}) => {
  const accounts = portfolio?.accounts.filter(value => !value.isArchived) ?? []
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [type, setType] = useState<'Deposit' | 'Withdrawal'>('Deposit')
  const [currency, setCurrency] = useState(accounts[0]?.baseCurrency ?? portfolio?.appCurrency ?? 'USD')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(today())
  const [notes, setNotes] = useState('')
  if (!accounts.length) return <div><p className="text-sm text-muted-foreground">Add an investment account before recording cash.</p><div className="mt-4"><Button onClick={onNeedAccount}>Add account</Button></div></div>
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    void onSave({ accountId, currency: currency.toUpperCase(), type, amount: Number(amount || 0), date, notes: notes.trim() || undefined })
  }
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <div className={labelClass}>Account<CustomSelect value={accountId} onChange={v => { const id = v as string; setAccountId(id); const next = accounts.find(value => value.id === id); if (next) setCurrency(next.baseCurrency) }} options={accounts.map(a => ({ value: a.id, label: a.name }))} ariaLabel="Account" className="mt-1.5 w-full" /></div>
      <div className={labelClass}>Type<CustomSelect value={type} onChange={v => setType(v as 'Deposit' | 'Withdrawal')} options={[{ value: 'Deposit', label: 'Deposit (cash in)' }, { value: 'Withdrawal', label: 'Withdrawal (cash out)' }]} ariaLabel="Cash movement type" className="mt-1.5 w-full" /></div>
      <label className={labelClass}>Amount ({currency})<input required type="number" min="0.0000000001" step="0.0000000001" value={amount} onChange={event => setAmount(event.target.value)} className={inputClass} /></label>
      <label className={labelClass}>Currency<input required pattern="[A-Za-z]{3}" maxLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} className={inputClass} /></label>
      <div className={labelClass}>Date<DatePicker value={date} onChange={setDate} max={today()} className="mt-1.5 w-full" /></div>
      <label className={`${labelClass} sm:col-span-2`}>Notes<input maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} className={inputClass} /></label>
    </div>
    <p className="text-[10px] text-muted-foreground">Record cash you moved into or out of the broker account itself — not a stock purchase. Buys, sells, dividends, and fees adjust cash automatically.</p>
    <FormActions busy={busy} onCancel={onCancel} submitLabel={type === 'Withdrawal' ? 'Record withdrawal' : 'Record deposit'} disabled={!accountId} />
  </form>
}

export default InvestmentsView
