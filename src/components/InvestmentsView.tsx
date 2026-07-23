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
  X,
} from 'lucide-react'
import type {
  AppTab,
  InvestmentActivity,
  InvestmentPortfolio,
  InvestmentRange,
  InvestmentTransactionType,
} from '../types'
import * as api from '../lib/api'
import type { InstrumentSearchResult } from '../lib/api/investments'
import { useAppContext } from '../contexts/AppContext'
import { Button } from './ui/Button'
import { CycleSkeleton } from './ui/Skeleton'

interface InvestmentsViewProps {
  onNavigate: (tab: AppTab) => void
}

type Panel = 'account' | 'instrument' | 'activity' | 'price' | null
type AllocationMode = 'asset' | 'account'
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
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [allocationFilter, setAllocationFilter] = useState<AllocationFilter>(null)
  const cancelRefreshRef = useRef(false)
  const refreshTimerRef = useRef<number | null>(null)

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

  const mutate = async (work: () => Promise<unknown>, success: string) => {
    if (isOffline) {
      showToast('Reconnect to make investment changes.', 'Offline', 'warning')
      return false
    }
    setBusy(true)
    try {
      await work()
      await load(range, true)
      showToast(success, 'Growth Investments', 'success')
      setPanel(null)
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
          <button type="button" onClick={back} className="mt-0.5 rounded-xl border border-border/60 p-2 text-muted-foreground hover:text-foreground" aria-label="Back to Today">
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">Growth Investments</h1>
            <p className="mt-1 text-xs text-muted-foreground">Broker-neutral holdings and performance. Your Growth ledger stays read-only.</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {refreshing ? (
            <Button variant="danger" onClick={() => { cancelRefreshRef.current = true }}><X className="size-4" /> Cancel</Button>
          ) : (
            <Button
              variant="ghost"
              disabled={isOffline || !portfolio?.marketDataConfigured || !portfolio.holdings.length}
              onClick={() => void updatePrices()}
            >
              <RefreshCw className="size-4" /> Update prices
            </Button>
          )}
          <Button variant="primary" disabled={isOffline} onClick={() => { setEditingActivity(null); setPanel('activity') }}>
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

      {panel === 'account' && <AccountForm busy={busy} onCancel={() => setPanel(null)} onSave={value => mutate(() => api.createInvestmentAccount(value), 'Account added.')} />}
      {panel === 'instrument' && <InstrumentForm busy={busy} offline={isOffline} onCancel={() => setPanel(null)} onSave={value => mutate(() => api.createInvestmentInstrument(value), 'Investment added.')} />}
      {panel === 'activity' && <ActivityForm portfolio={portfolio} initial={editingActivity} busy={busy} onCancel={() => { setEditingActivity(null); setPanel(null) }} onSave={value => mutate(() => editingActivity ? api.updateInvestmentActivity(editingActivity.id, value) : api.createInvestmentActivity(value), editingActivity ? 'Activity updated.' : 'Activity added.')} onNeedAccount={() => setPanel('account')} onNeedInstrument={() => setPanel('instrument')} />}
      {panel === 'price' && <ManualPriceForm portfolio={portfolio} busy={busy} onCancel={() => setPanel(null)} onSave={value => mutate(() => api.createManualInvestmentPrice(value), 'Manual price added.')} />}

      {!portfolio || (portfolio.accounts.length === 0 && portfolio.instruments.length === 0 && portfolio.activity.length === 0) ? (
        <EmptyState
          offline={isOffline}
          onAddAccount={() => setPanel('account')}
          onAddInvestment={() => setPanel('instrument')}
        />
      ) : (
        <>
          <SummaryCards portfolio={portfolio} masked={hideSensitive} />
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" disabled={isOffline} onClick={() => setPanel('account')}><Building2 className="size-4" /> Add account</Button>
            <Button variant="ghost" disabled={isOffline} onClick={() => setPanel('instrument')}><Search className="size-4" /> Add investment</Button>
            <Button variant="ghost" disabled={isOffline || portfolio.instruments.length === 0} onClick={() => setPanel('price')}><CircleDollarSign className="size-4" /> Manual price</Button>
          </div>
          <AccountsAndInstruments
            portfolio={portfolio}
            offline={isOffline}
            onArchiveAccount={id => void mutate(() => api.archiveInvestmentAccount(id), 'Account archived.')}
            onDeleteAccount={id => confirm({
              title: 'Delete investment account?',
              message: 'Only accounts without activity can be deleted.',
              confirmText: 'Delete',
              onConfirm: () => { void mutate(() => api.deleteInvestmentAccount(id), 'Account deleted.') },
            })}
            onDeleteInstrument={id => confirm({
              title: 'Delete investment?',
              message: 'Only investments without activity can be deleted.',
              confirmText: 'Delete',
              onConfirm: () => { void mutate(() => api.deleteInvestmentInstrument(id), 'Investment deleted.') },
            })}
            onDeleteManualPrice={id => confirm({
              title: 'Delete manual price?',
              message: 'The cached provider close, if available, will become active again.',
              confirmText: 'Delete',
              onConfirm: () => { void mutate(() => api.deleteManualInvestmentPrice(id), 'Manual price deleted.') },
            })}
          />
          {portfolio.warnings.length > 0 && (
            <section aria-labelledby="calculation-warnings" className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <h2 id="calculation-warnings" className="text-sm font-bold text-foreground">Calculation notes</h2>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {portfolio.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            </section>
          )}
          <div className="flex gap-1 rounded-xl bg-muted/40 p-1 w-fit" aria-label="Chart range">
            {ranges.map(item => (
              <button
                key={item.value}
                type="button"
                onClick={() => setRange(item.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${range === item.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'}`}
                aria-pressed={range === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ValueChart portfolio={portfolio} masked={hideSensitive} />
            <AllocationChart portfolio={portfolio} masked={hideSensitive} selected={allocationFilter} onSelect={setAllocationFilter} />
          </div>
          <PerformanceBars portfolio={portfolio} masked={hideSensitive} />
          <HoldingsTable portfolio={portfolio} masked={hideSensitive} filter={allocationFilter} />
          <ActivityTable
            portfolio={portfolio}
            masked={hideSensitive}
            onEdit={activity => { setEditingActivity(activity); setPanel('activity'); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            onDelete={activity => confirm({
              title: 'Delete investment activity?',
              message: 'All later holding results will be recalculated. Your Growth ledger and Reports are not changed.',
              confirmText: 'Delete',
              onConfirm: () => { void mutate(() => api.deleteInvestmentActivity(activity.id), 'Activity deleted.') },
            })}
          />
          <section aria-labelledby="quick-insights" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
            <h2 id="quick-insights" className="text-base font-bold text-foreground">Quick insights</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {portfolio.insights.map(value => <li key={value} className="rounded-xl bg-muted/30 p-3 text-xs text-muted-foreground">{value}</li>)}
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
      Add a generic broker account and an opening position. This tracker never connects to your broker and never creates ledger transactions.
    </p>
    <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
      <Button variant="primary" disabled={offline} onClick={onAddAccount}><Building2 className="size-4" /> Add account</Button>
      <Button variant="ghost" disabled={offline} onClick={onAddInvestment}><Search className="size-4" /> Add investment</Button>
    </div>
  </section>
)

const SummaryCards = ({ portfolio, masked }: { portfolio: InvestmentPortfolio; masked: boolean }) => {
  const format = (value?: number, suffix = '') => value === undefined ? 'Incomplete' : masked ? '••••' : `${money(value, portfolio.appCurrency)}${suffix}`
  const cards = [
    ['Growth ledger balance', format(portfolio.summary.growthLedgerBalance), 'Read-only ledger context'],
    ['Portfolio value', format(portfolio.summary.marketValue), 'Latest cached or manual prices'],
    ['Cost basis', format(portfolio.summary.costBasis), 'Historical trade FX where needed'],
    ['Unrealised P/L', portfolio.summary.unrealisedProfitLoss === undefined ? 'Incomplete' : masked ? '••••' : `${money(portfolio.summary.unrealisedProfitLoss, portfolio.appCurrency)} · ${(portfolio.summary.unrealisedPercent ?? 0).toFixed(1)}%`, 'Market value minus cost basis'],
    ['Realised P/L', format(portfolio.summary.realisedProfitLoss), 'Closed units and fees'],
    ['Net dividends', format(portfolio.summary.netDividends), 'Separate from capital gains'],
    ['Daily change', format(portfolio.summary.dailyChange), 'Based on cached daily closes'],
  ]
  return (
    <section aria-label="Investment summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(([label, value, note]) => (
        <div key={label} className="app-panel rounded-2xl border border-border/60 bg-card/92 p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-lg font-black text-foreground">{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{note}</p>
        </div>
      ))}
    </section>
  )
}

const AccountsAndInstruments = ({
  portfolio,
  offline,
  onArchiveAccount,
  onDeleteAccount,
  onDeleteInstrument,
  onDeleteManualPrice,
}: {
  portfolio: InvestmentPortfolio
  offline: boolean
  onArchiveAccount: (id: string) => void
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
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} className="flex w-full items-center justify-between p-4 text-left">
        <span><strong className="text-sm text-foreground">Accounts, investments, and manual prices</strong><span className="ml-2 text-[10px] text-muted-foreground">{portfolio.accounts.length} accounts · {portfolio.instruments.length} investments</span></span>
        <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="grid gap-5 border-t border-border/50 p-4 lg:grid-cols-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Accounts</h3>
            <div className="mt-2 space-y-2">{portfolio.accounts.map(value => <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3"><span className="min-w-0"><strong className="block truncate text-xs text-foreground">{value.name}</strong><span className="text-[10px] text-muted-foreground">{value.baseCurrency}{value.isArchived ? ' · Archived' : ''}</span></span>{!value.isArchived && <button disabled={offline} type="button" onClick={() => accountHasActivity(value.id) ? onArchiveAccount(value.id) : onDeleteAccount(value.id)} className="text-[10px] font-bold text-orange-500 disabled:opacity-40">{accountHasActivity(value.id) ? 'Archive' : 'Delete'}</button>}</div>)}</div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Investments</h3>
            <div className="mt-2 space-y-2">{portfolio.instruments.map(value => <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3"><span className="min-w-0"><strong className="block truncate text-xs text-foreground">{value.symbol} · {value.name}</strong><span className="text-[10px] text-muted-foreground">{value.type} · {value.currency} · {value.isCustom ? 'Manual' : value.mic ?? value.exchange ?? 'Provider'}</span></span>{!instrumentHasActivity(value.id) && <button disabled={offline} type="button" onClick={() => onDeleteInstrument(value.id)} className="text-[10px] font-bold text-orange-500 disabled:opacity-40">Delete</button>}</div>)}</div>
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Manual prices</h3>
            <div className="mt-2 space-y-2">{portfolio.manualPrices.map(value => <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3"><span><strong className="block text-xs text-foreground">{instrumentById.get(value.instrumentId)?.symbol ?? 'Investment'} · {value.marketDate}</strong><span className="text-[10px] text-muted-foreground">Manual close recorded</span></span><button disabled={offline} type="button" onClick={() => onDeleteManualPrice(value.id)} className="text-[10px] font-bold text-orange-500 disabled:opacity-40">Delete</button></div>)}{portfolio.manualPrices.length === 0 && <p className="text-xs text-muted-foreground">No manual prices.</p>}</div>
          </div>
        </div>
      )}
    </section>
  )
}

const ValueChart = ({ portfolio, masked }: { portfolio: InvestmentPortfolio; masked: boolean }) => {
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
  const summary = latest
    ? `Latest chart values: market ${masked || latest.marketValue === undefined ? 'hidden or incomplete' : money(latest.marketValue, portfolio.appCurrency)}, cost basis ${masked || latest.costBasis === undefined ? 'hidden or incomplete' : money(latest.costBasis, portfolio.appCurrency)}, net contributions ${masked || latest.netContributions === undefined ? 'hidden or incomplete' : money(latest.netContributions, portfolio.appCurrency)}.`
    : 'No chart data is available.'
  return (
    <section aria-labelledby="value-chart-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <h2 id="value-chart-title" className="text-base font-bold text-foreground">Portfolio value</h2>
      <p className="mt-1 text-xs text-muted-foreground">Market value, cost basis, and net contributions.</p>
      <p className="sr-only">{summary}</p>
      {portfolio.chart.length === 0 ? (
        <div className="flex h-60 items-center justify-center text-xs text-muted-foreground">Add activity to create a value history.</div>
      ) : (
        <div className={`mt-5 overflow-hidden ${masked ? 'blur-md select-none' : ''}`} aria-hidden={masked}>
          <svg viewBox={`0 0 ${width} ${height}`} className="h-60 w-full" role="img" aria-label={summary}>
            <defs>
              <pattern id="investment-grid" width="72" height="48" patternUnits="userSpaceOnUse">
                <path d="M 72 0 L 0 0 0 48" fill="none" className="stroke-border" strokeWidth="1" opacity=".45" />
              </pattern>
            </defs>
            <rect width={width} height={height} fill="url(#investment-grid)" />
            <polyline points={line('marketValue')} fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinejoin="round" />
            <polyline points={line('costBasis')} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinejoin="round" />
            <polyline points={line('netContributions')} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="7 6" strokeLinejoin="round" />
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
  const [mode, setMode] = useState<AllocationMode>('asset')
  const groups = useMemo(() => {
    const map = new Map<string, number>()
    portfolio.holdings.forEach(holding => {
      const key = mode === 'asset' ? holding.type : holding.accountName
      map.set(key, (map.get(key) ?? 0) + (holding.valueApp ?? 0))
    })
    return [...map].sort((a, b) => b[1] - a[1])
  }, [portfolio.holdings, mode])
  const total = groups.reduce((sum, [, value]) => sum + value, 0)
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#64748b']
  let cursor = 0
  const stops = groups.map(([, value], index) => {
    const start = total ? cursor / total * 100 : 0
    cursor += value
    return `${colors[index % colors.length]} ${start}% ${total ? cursor / total * 100 : 0}%`
  }).join(', ')
  return (
    <section aria-labelledby="allocation-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex items-start justify-between gap-2">
        <div><h2 id="allocation-title" className="text-base font-bold text-foreground">Allocation</h2><p className="mt-1 text-xs text-muted-foreground">Select a segment to highlight matching holdings.</p></div>
        <select value={mode} onChange={event => { setMode(event.target.value as AllocationMode); onSelect(null) }} className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs">
          <option value="asset">Asset</option><option value="account">Account</option>
        </select>
      </div>
      <div className="mt-5 flex items-center gap-5">
        <div
          role="img"
          aria-label={groups.map(([name, value]) => `${name} ${total ? (value / total * 100).toFixed(1) : 0}%`).join(', ') || 'No valued holdings'}
          className={`relative size-32 shrink-0 rounded-full ${masked ? 'blur-md' : ''}`}
          style={{ background: groups.length ? `conic-gradient(${stops})` : 'var(--muted)' }}
        >
          <div className="absolute inset-7 rounded-full bg-card" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          {groups.map(([name, value], index) => (
            <button key={name} type="button" onClick={() => onSelect(selected?.mode === mode && selected.key === name ? null : { mode, key: name })} aria-pressed={selected?.mode === mode && selected.key === name} className={`flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-xs ${selected?.mode === mode && selected.key === name ? 'bg-muted' : ''}`}>
              <span className="truncate"><i className="mr-2 inline-block size-2 rounded-full" style={{ background: colors[index % colors.length] }} />{name}</span>
              <span className="font-bold">{masked ? '••' : `${total ? (value / total * 100).toFixed(1) : 0}%`}</span>
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
    (filter.mode === 'asset' ? holding.type === filter.key : holding.accountName === filter.key))
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
  const accounts = new Map(portfolio.accounts.map(value => [value.id, value.name]))
  const instruments = new Map(portfolio.instruments.map(value => [value.id, value]))
  return (
    <section aria-labelledby="activity-title" className="app-panel overflow-hidden rounded-2xl border border-border/60 bg-card/92">
      <div className="p-5">
        <div className="flex items-center gap-2"><SlidersHorizontal className="size-4 text-blue-500" /><h2 id="activity-title" className="text-base font-bold text-foreground">Activity</h2></div>
        <div className="mt-4 grid gap-2 sm:grid-cols-5">
          <select aria-label="Filter by account" value={account} onChange={event => setAccount(event.target.value)} className={inputClass}><option value="">All accounts</option>{portfolio.accounts.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select>
          <select aria-label="Filter by investment" value={instrument} onChange={event => setInstrument(event.target.value)} className={inputClass}><option value="">All investments</option>{portfolio.instruments.map(value => <option key={value.id} value={value.id}>{value.symbol}</option>)}</select>
          <select aria-label="Filter by type" value={type} onChange={event => setType(event.target.value)} className={inputClass}><option value="">All types</option>{activityTypes.map(value => <option key={value.value} value={value.value}>{value.label}</option>)}</select>
          <input aria-label="From date" type="date" value={from} onChange={event => setFrom(event.target.value)} className={inputClass} />
          <input aria-label="To date" type="date" value={to} onChange={event => setTo(event.target.value)} className={inputClass} />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-left text-xs">
          <thead className="border-y border-border/50 bg-muted/25 text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Investment</th><th className="px-4 py-3">Account</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">Gross</th><th className="px-4 py-3">Notes</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map(value => {
              const item = instruments.get(value.instrumentId)
              return <tr key={value.id}><td className="px-4 py-3">{value.tradeDate}</td><td className="px-4 py-3 font-bold">{activityTypes.find(type => type.value === value.type)?.label}</td><td className="px-4 py-3">{item?.symbol}</td><td className="px-4 py-3">{accounts.get(value.accountId)}</td><td className="px-4 py-3 text-right">{masked ? '••••' : number(value.units, 8)}</td><td className="px-4 py-3 text-right">{masked ? '••••' : value.cashAmount === undefined ? '—' : money(value.cashAmount, item?.currency ?? portfolio.appCurrency)}</td><td className="max-w-52 truncate px-4 py-3 text-muted-foreground">{value.notes ?? '—'}</td><td className="px-4 py-3"><span className="flex gap-2"><button type="button" onClick={() => onEdit(value)} className="text-[10px] font-bold text-blue-500 hover:underline">Edit</button><button type="button" onClick={() => onDelete(value)} className="text-[10px] font-bold text-orange-500 hover:underline">Delete</button></span></td></tr>
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="p-5 text-xs text-muted-foreground">No activity matches these filters.</p>}
    </section>
  )
}

const FormShell = ({ title, children, onCancel }: { title: string; children: React.ReactNode; onCancel: () => void }) => (
  <section className="app-panel rounded-2xl border border-blue-500/25 bg-card/95 p-5" aria-label={title}>
    <div className="mb-5 flex items-center justify-between"><h2 className="text-base font-bold text-foreground">{title}</h2><button type="button" onClick={onCancel} aria-label="Close form" className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"><X className="size-4" /></button></div>
    {children}
  </section>
)

const AccountForm = ({ busy, onCancel, onSave }: { busy: boolean; onCancel: () => void; onSave: (value: api.AccountMutation) => Promise<boolean> }) => {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('USD')
  return <FormShell title="Add investment account" onCancel={onCancel}><form className="grid gap-4 sm:grid-cols-[2fr_1fr_auto]" onSubmit={event => { event.preventDefault(); void onSave({ name, baseCurrency: currency }) }}>
    <label className={labelClass}>Account name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Moomoo" className={inputClass} /></label>
    <label className={labelClass}>Base currency<input required pattern="[A-Za-z]{3}" maxLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} className={inputClass} /></label>
    <Button type="submit" disabled={busy} className="self-end">{busy && <Loader2 className="size-4 animate-spin" />} Add account</Button>
  </form><p className="mt-3 text-[10px] text-muted-foreground">Only a display name is stored. Broker credentials and broker API connections are not supported.</p></FormShell>
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
  return <FormShell title="Add investment" onCancel={onCancel}>
    <div className="mb-4 flex gap-1 rounded-xl bg-muted/40 p-1 w-fit"><button type="button" onClick={() => setManual(false)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${!manual ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Search markets</button><button type="button" onClick={() => setManual(true)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${manual ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Custom / manual</button></div>
    {manual ? <form className="grid gap-4 sm:grid-cols-4" onSubmit={saveManual}>
      <label className={labelClass}>Ticker<input required maxLength={32} value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} className={inputClass} /></label>
      <label className={`${labelClass} sm:col-span-2`}>Full name<input required maxLength={200} value={name} onChange={event => setName(event.target.value)} className={inputClass} /></label>
      <label className={labelClass}>Type<select value={type} onChange={event => setType(event.target.value as 'Stock' | 'ETF')} className={inputClass}><option>Stock</option><option>ETF</option></select></label>
      <label className={labelClass}>Currency<input required pattern="[A-Za-z]{3}" maxLength={3} value={currency} onChange={event => setCurrency(event.target.value.toUpperCase())} className={inputClass} /></label>
      <Button type="submit" disabled={busy} className="self-end sm:col-start-4">{busy && <Loader2 className="size-4 animate-spin" />} Save investment</Button>
    </form> : <>
      <label className={labelClass}>Symbol or company / fund name<div className="relative mt-1.5"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input value={query} onChange={event => { setQuery(event.target.value); setSelected(null) }} placeholder="Search at least 3 characters" className={`${inputClass} pl-9`} />{searching && <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-blue-500" />}</div></label>
      {message && <p className="mt-2 text-xs text-muted-foreground">{message}</p>}
      <div className="mt-3 grid gap-2">
        {results.map(result => <button type="button" key={`${result.symbol}-${result.mic ?? result.exchange}`} onClick={() => setSelected(result)} className={`rounded-xl border p-3 text-left ${selected === result ? 'border-blue-500 bg-blue-500/5' : 'border-border/50 hover:bg-muted/30'}`}>
          <span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-foreground">{result.symbol}</strong><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold">{result.type}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${result.availableOnBasic ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{result.availableOnBasic ? 'Basic available' : 'Plan unavailable'}</span></span>
          <span className="mt-1 block text-xs text-muted-foreground">{result.name}</span>
          <span className="mt-1 block text-[10px] text-muted-foreground">{[result.exchange, result.mic, result.currency, result.country].filter(Boolean).join(' · ')}</span>
        </button>)}
      </div>
      {selected && <div className="mt-4 flex justify-end"><Button disabled={busy || !selected.availableOnBasic} onClick={() => void onSave({ symbol: selected.symbol, name: selected.name, type: selected.type, currency: selected.currency, exchange: selected.exchange, mic: selected.mic, country: selected.country, providerSymbol: selected.symbol, providerMic: selected.mic, isCustom: false })}>{busy && <Loader2 className="size-4 animate-spin" />} Save investment</Button></div>}
    </>}
  </FormShell>
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
  useEffect(() => {
    const u = numberOrUndefined(units)
    const p = numberOrUndefined(unitPrice)
    const c = numberOrUndefined(cashAmount)
    if (u && p && !c) setCashAmount((u * p).toFixed(6).replace(/\.?0+$/, ''))
  }, [units, unitPrice])
  if (!accounts.length || !instruments.length) return <FormShell title="Add activity" onCancel={onCancel}><p className="text-sm text-muted-foreground">Add both an account and an investment before recording activity.</p><div className="mt-4 flex gap-2">{!accounts.length && <Button onClick={onNeedAccount}>Add account</Button>}{!instruments.length && <Button variant="ghost" onClick={onNeedInstrument}>Add investment</Button>}</div></FormShell>
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
  return <FormShell title={initial ? 'Edit investment activity' : type === 'OpeningPosition' ? 'Add opening position' : 'Add historical activity'} onCancel={onCancel}><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <label className={labelClass}>Activity type<select value={type} onChange={event => setType(event.target.value as InvestmentTransactionType)} className={inputClass}>{activityTypes.map(value => <option key={value.value} value={value.value}>{value.label}</option>)}</select></label>
    <label className={labelClass}>Account<select required value={accountId} onChange={event => setAccountId(event.target.value)} className={inputClass}>{accounts.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>
    <label className={labelClass}>Investment<select required value={instrumentId} onChange={event => setInstrumentId(event.target.value)} className={inputClass}>{instruments.map(value => <option key={value.id} value={value.id}>{value.symbol} · {value.name}</option>)}</select></label>
    <label className={labelClass}>Trade date<input required type="date" max={today()} value={tradeDate} onChange={event => setTradeDate(event.target.value)} className={inputClass} /></label>
    {needsUnits && <label className={labelClass}>{type === 'Split' ? 'Split ratio' : 'Units'}<input required={type === 'Split' || type.includes('Transfer')} type="number" min="0" step="0.0000000001" value={units} onChange={event => setUnits(event.target.value)} className={inputClass} /></label>}
    {trade && <label className={labelClass}>Unit price ({selectedInstrument?.currency})<input type="number" min="0" step="0.0000000001" value={unitPrice} onChange={event => setUnitPrice(event.target.value)} className={inputClass} /></label>}
    {type !== 'Split' && type !== 'TransferOut' && <label className={labelClass}>{type === 'TransferIn' ? 'Transferred cost basis' : type === 'Dividend' ? 'Gross dividend' : type === 'FeeTax' ? 'Charge amount' : 'Gross amount'} ({selectedInstrument?.currency})<input type="number" min="0" step="0.0000000001" value={cashAmount} onChange={event => setCashAmount(event.target.value)} className={inputClass} /></label>}
    {!['Split', 'TransferIn', 'TransferOut'].includes(type) && <><label className={labelClass}>Fees<input type="number" min="0" step="0.0000000001" value={fees} onChange={event => setFees(event.target.value)} className={inputClass} /></label><label className={labelClass}>Taxes<input type="number" min="0" step="0.0000000001" value={taxes} onChange={event => setTaxes(event.target.value)} className={inputClass} /></label></>}
    {selectedInstrument && selectedInstrument.currency !== portfolio?.appCurrency && <label className={labelClass}>Trade FX ({selectedInstrument.currency} → {portfolio?.appCurrency})<input type="number" min="0" step="0.0000000001" value={fx} onChange={event => setFx(event.target.value)} className={inputClass} /></label>}
    {type === 'TransferOut' && <label className={labelClass}>Destination (optional internal transfer)<select value={destination} onChange={event => setDestination(event.target.value)} className={inputClass}><option value="">External transfer out</option>{accounts.filter(value => value.id !== accountId).map(value => <option key={value.id} value={value.id}>{value.name}</option>)}</select></label>}
    <label className={`${labelClass} sm:col-span-2`}>Notes<input maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} className={inputClass} /></label>
    <div className="flex items-end justify-end sm:col-span-2"><Button type="submit" disabled={busy}>{busy && <Loader2 className="size-4 animate-spin" />} Save activity</Button></div>
  </form>{trade && <p className="mt-3 text-[10px] text-muted-foreground">Enter any two of units, unit price, and gross amount; the missing value is calculated.</p>}</FormShell>
}

const ManualPriceForm = ({ portfolio, busy, onCancel, onSave }: { portfolio: InvestmentPortfolio | null; busy: boolean; onCancel: () => void; onSave: (value: { instrumentId: string; marketDate: string; price: number; fxRate?: number }) => Promise<boolean> }) => {
  const instruments = portfolio?.instruments.filter(value => !value.isArchived) ?? []
  const [instrumentId, setInstrumentId] = useState(instruments[0]?.id ?? '')
  const [date, setDate] = useState(today())
  const [price, setPrice] = useState('')
  const [fx, setFx] = useState('')
  const instrument = instruments.find(value => value.id === instrumentId)
  return <FormShell title="Add manual closing price" onCancel={onCancel}><form className="grid gap-4 sm:grid-cols-4" onSubmit={event => { event.preventDefault(); void onSave({ instrumentId, marketDate: date, price: Number(price), fxRate: numberOrUndefined(fx) }) }}>
    <label className={labelClass}>Investment<select value={instrumentId} onChange={event => setInstrumentId(event.target.value)} className={inputClass}>{instruments.map(value => <option key={value.id} value={value.id}>{value.symbol}</option>)}</select></label>
    <label className={labelClass}>Market date<input required type="date" max={today()} value={date} onChange={event => setDate(event.target.value)} className={inputClass} /></label>
    <label className={labelClass}>Close ({instrument?.currency})<input required type="number" min="0.0000000001" step="0.0000000001" value={price} onChange={event => setPrice(event.target.value)} className={inputClass} /></label>
    {instrument && instrument.currency !== portfolio?.appCurrency && <label className={labelClass}>FX to {portfolio?.appCurrency} (optional)<input type="number" min="0.0000000001" step="0.0000000001" value={fx} onChange={event => setFx(event.target.value)} className={inputClass} /></label>}
    <div className="flex items-end justify-end sm:col-start-4"><Button type="submit" disabled={busy || !instrumentId}>{busy && <Loader2 className="size-4 animate-spin" />} Save price</Button></div>
  </form><p className="mt-3 text-[10px] text-muted-foreground">A manual value takes precedence over provider data for the same date. Deleting it restores the cached provider close.</p></FormShell>
}

export default InvestmentsView
