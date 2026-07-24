import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  ChevronDown,
  CircleDollarSign,
  CloudOff,
  Info,
  Loader2,
  PieChart,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import type {
  AppTab,
  InvestmentActivity,
  InvestmentCashFlow,
  InvestmentPortfolio,
  InvestmentRange,
  InvestmentTransactionType,
} from '../types'
import * as api from '../lib/api'
import type { InstrumentSearchResult } from '../lib/api/investments'
import { useAppContext } from '../contexts/AppContext'
import { Button } from './ui/Button'
import { BottomSheet } from './ui/BottomSheet'
import { CycleSkeleton } from './ui/Skeleton'
import { CustomSelect } from './ui/CustomSelect'
import { DatePicker } from './ui/DatePicker'
import { CurrencySelect } from './ui/CurrencySelect'
import { useInvestmentPortfolio } from './investments/useInvestmentPortfolio'
import { applyOpsToList } from '../lib/outbox'
import { RowSyncStatus } from './ui/RowSyncBadge'

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
  const { hideSensitive, isOffline, showToast, confirm, activeSyncId, investmentOps = [], queueInvestmentMutation = () => undefined } = useAppContext()
  const {
    activityRevision,
    loadError,
    loading,
    portfolio,
    range,
    refreshing,
    setRange,
    updatePrices,
  } = useInvestmentPortfolio()
  const [panel, setPanel] = useState<Panel>(null)
  const [editingActivity, setEditingActivity] = useState<InvestmentActivity | null>(null)
  // Bumped on every open so each form's `key` changes and it remounts with
  // fresh internal state -- reopening (or switching from edit to add) never
  // shows a previously entered or edited record.
  const [formKey, setFormKey] = useState(0)
  const busy = false
  const [allocationFilter, setAllocationFilter] = useState<AllocationFilter>(null)
  const setupPortfolio = useMemo(() => portfolio ? {
    ...portfolio,
    accounts: applyOpsToList(portfolio.accounts, investmentOps, 'investmentAccount'),
    instruments: applyOpsToList(portfolio.instruments, investmentOps, 'investmentInstrument'),
  } : null, [portfolio, investmentOps])
  const queueInvestment = async (
    entity: 'investmentAccount' | 'investmentInstrument' | 'investmentActivity' | 'investmentManualPrice' | 'investmentCashFlow',
    type: 'add' | 'update' | 'delete' | 'restore',
    targetId: string,
    payload: Record<string, unknown> | undefined,
    message: string,
  ) => {
    queueInvestmentMutation(entity, type, targetId, payload)
    closePanel()
    showToast(isOffline ? 'Saved on this device and will sync when you reconnect.' : 'Saving in the background.', message, 'info')
    return true
  }

  const openPanel = (next: Exclude<Panel, null>, activity: InvestmentActivity | null = null) => {
    setEditingActivity(activity)
    setFormKey(value => value + 1)
    setPanel(next)
  }
  const closePanel = () => {
    setPanel(null)
    setEditingActivity(null)
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
          <Button variant="primary" className="w-full justify-center sm:w-auto" onClick={() => openPanel('activity')}>
            <Plus className="size-4" /> Add activity
          </Button>
        </div>
      </header>

      {(isOffline || loadError) && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <CloudOff className="size-4 shrink-0" />
          {isOffline ? 'Offline: showing the last cached snapshot. Changes will be queued; market refresh remains unavailable.' : loadError}
        </div>
      )}

      {!portfolio?.marketDataConfigured && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/7 px-4 py-3 text-xs text-muted-foreground">
          Live market data is not configured. Accounts, custom investments, activity, and manual prices remain available.
        </div>
      )}

      <BottomSheet isOpen={panel === 'account'} title="Add investment account" onClose={closePanel} maxWidthClassName="max-w-lg">
        <AccountForm key={`account-${formKey}`} busy={busy} onCancel={closePanel} onSave={value => {
          const id = crypto.randomUUID()
          return queueInvestment('investmentAccount', 'add', id, { ...value, id }, 'Account queued')
        }} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'instrument'} title="Add investment" onClose={closePanel} maxWidthClassName="max-w-2xl">
        <InstrumentForm key={`instrument-${formKey}`} busy={busy} offline={isOffline} onCancel={closePanel} onSave={value => {
          const id = crypto.randomUUID()
          return queueInvestment('investmentInstrument', 'add', id, { ...value, id }, 'Investment queued')
        }} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'activity'} title={editingActivity ? 'Edit investment activity' : 'Add activity'} onClose={closePanel} maxWidthClassName="max-w-3xl">
        <ActivityForm key={`activity-${formKey}`} portfolio={setupPortfolio} initial={editingActivity} busy={busy} onCancel={closePanel} onSave={value => {
          const id = editingActivity?.id ?? crypto.randomUUID()
          const destinationLegId = value.destinationAccountId ? crypto.randomUUID() : undefined
          return queueInvestment(
            'investmentActivity',
            editingActivity ? 'update' : 'add',
            id,
            { ...value, id, destinationLegId, undoSnapshot: editingActivity ?? undefined },
            editingActivity ? 'Activity update queued' : 'Activity queued',
          )
        }} onNeedAccount={() => openPanel('account')} onNeedInstrument={() => openPanel('instrument')} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'price'} title="Add manual closing price" onClose={closePanel} maxWidthClassName="max-w-2xl">
        <ManualPriceForm key={`price-${formKey}`} portfolio={setupPortfolio} busy={busy} onCancel={closePanel} onSave={value => {
          const id = crypto.randomUUID()
          return queueInvestment('investmentManualPrice', 'add', id, { ...value, id }, 'Manual price queued')
        }} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'cash'} title="Record cash movement" onClose={closePanel} maxWidthClassName="max-w-lg">
        <CashForm key={`cash-${formKey}`} portfolio={setupPortfolio} busy={busy} onCancel={closePanel} onSave={value => {
          const id = crypto.randomUUID()
          return queueInvestment('investmentCashFlow', 'add', id, { ...value, id }, 'Cash movement queued')
        }} onNeedAccount={() => openPanel('account')} />
      </BottomSheet>

      {!portfolio || (portfolio.accounts.length === 0 && portfolio.instruments.length === 0 && (portfolio.activityCount ?? portfolio.activity.length) === 0 && (portfolio.cashFlowCount ?? portfolio.cashFlows.length) === 0) ? (
        <EmptyState
          offline={isOffline}
          onAddAccount={() => openPanel('account')}
          onAddInvestment={() => openPanel('instrument')}
        />
      ) : (
        <>
          <SummaryCards portfolio={portfolio} masked={hideSensitive} />
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <Button variant="ghost" onClick={() => openPanel('account')}><Building2 className="size-4" /> Add account</Button>
            <Button variant="ghost" onClick={() => openPanel('instrument')}><Search className="size-4" /> Add investment</Button>
            <Button variant="ghost" disabled={portfolio.accounts.length === 0} onClick={() => openPanel('cash')}><Wallet className="size-4" /> Deposit / withdraw</Button>
            <Button variant="ghost" disabled={portfolio.instruments.length === 0} onClick={() => openPanel('price')}><CircleDollarSign className="size-4" /> Manual price</Button>
          </div>
          {investmentOps.length > 0 && <div role="status" className="flex items-center gap-2 rounded-xl border border-blue-500/20 bg-blue-500/8 px-4 py-3 text-xs text-blue-700 dark:text-blue-300"><Loader2 className={`size-3.5 ${isOffline ? '' : 'animate-spin'}`} /> Pending changes · confirmed totals remain visible until synchronization completes.</div>}
          <section aria-labelledby="quick-insights" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
            <h2 id="quick-insights" className="text-base font-bold text-foreground">Quick insights</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {portfolio.insights.map((value, index) => {
                const isLargest = value.toLowerCase().includes('largest holding');
                const isBest = value.toLowerCase().includes('best performer');
                const isConcentration = value.toLowerCase().includes('concentration');
                const Icon = isLargest ? PieChart : isBest ? TrendingUp : isConcentration ? AlertCircle : Info;
                
                return (
                  <li key={index} className="flex items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/10 p-4 text-xs leading-relaxed text-blue-700 shadow-sm dark:text-blue-300">
                    <div className="shrink-0 rounded-full bg-blue-500/20 p-1.5 text-blue-600 dark:text-blue-400">
                      <Icon className="size-4" />
                    </div>
                    <span>{value}</span>
                  </li>
                );
              })}
            </ul>
          </section>
          <AccountsAndInstruments
            portfolio={setupPortfolio ?? portfolio}
            offline={isOffline}
            onArchiveAccount={id => {
              const account = portfolio.accounts.find(a => a.id === id)
              if (account) queueInvestment('investmentAccount', 'update', id, { name: account.name, baseCurrency: account.baseCurrency, isArchived: true, undoSnapshot: account }, 'Account archive queued')
            }}
            onUnarchiveAccount={(id, name, currency) => queueInvestment('investmentAccount', 'update', id, { name, baseCurrency: currency, isArchived: false }, 'Account restore queued')}
            onDeleteAccount={id => {
              const account = portfolio.accounts.find(a => a.id === id)
              confirm({
                title: 'Delete investment account?',
                message: 'Only accounts without activity can be deleted.',
                confirmText: 'Delete',
                onConfirm: () => { queueInvestment('investmentAccount', 'delete', id, { undoSnapshot: account }, 'Account deletion queued') },
              })
            }}
            onDeleteInstrument={id => {
              const instrument = portfolio.instruments.find(i => i.id === id)
              confirm({
                title: 'Delete investment?',
                message: 'Only investments without activity can be deleted.',
                confirmText: 'Delete',
                onConfirm: () => { queueInvestment('investmentInstrument', 'delete', id, { undoSnapshot: instrument }, 'Investment deletion queued') },
              })
            }}
            onDeleteManualPrice={id => {
              const mp = portfolio.manualPrices.find(p => p.id === id)
              confirm({
                title: 'Delete manual price?',
                message: 'The cached provider close, if available, will become active again.',
                confirmText: 'Delete',
                onConfirm: () => { queueInvestment('investmentManualPrice', 'delete', id, { undoSnapshot: mp }, 'Manual price deletion queued') },
              })
            }}
          />
          {portfolio.warnings.length > 0 && (
            <details className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <summary id="calculation-warnings" className="cursor-pointer text-sm font-bold text-foreground">Calculation notes</summary>
              <p className="mt-1 text-[10px] text-muted-foreground">These warnings explain why some values show as incomplete above. Most clear once you run "Update prices" (which fetches the market FX rates for each trade date automatically). If the provider has no rate for a date, supply one via the "Manual price" button or by entering the trade FX rate when editing the activity.</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {portfolio.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            </details>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ValueChart portfolio={portfolio} masked={hideSensitive} range={range} onRangeChange={setRange} />
            <AllocationChart portfolio={portfolio} masked={hideSensitive} selected={allocationFilter} onSelect={setAllocationFilter} />
          </div>
          <PerformanceBars portfolio={portfolio} masked={hideSensitive} />
          <HoldingsTable portfolio={portfolio} masked={hideSensitive} filter={allocationFilter} />
          <PagedActivityTable
            portfolio={portfolio}
            masked={hideSensitive}
            refreshToken={activityRevision}
            operations={investmentOps}
            activeSyncId={activeSyncId}
            onEdit={activity => openPanel('activity', activity)}
            onDelete={activity => confirm({
              title: 'Delete investment activity?',
              message: 'All later holding results will be recalculated.',
              confirmText: 'Delete',
              onConfirm: () => { queueInvestment('investmentActivity', 'delete', activity.id, { undoSnapshot: { transactions: [activity] } }, 'Activity deletion queued') },
            })}
            onDeleteCashFlow={flow => confirm({
              title: flow.type === 'Withdrawal' ? 'Delete withdrawal?' : 'Delete deposit?',
              message: 'The cash balance and total portfolio value will be recalculated.',
              confirmText: 'Delete',
              onConfirm: () => { queueInvestment('investmentCashFlow', 'delete', flow.id, { undoSnapshot: flow }, 'Cash movement deletion queued') },
            })}
          />
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
    { label: 'Investments', value: format(portfolio.summary.marketValue), note: 'End-of-day closing value', color: portfolio.summary.marketValue === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.marketValue === undefined },
    { label: 'Cash', value: format(portfolio.summary.cashValue), note: 'Uninvested settlement cash', color: portfolio.summary.cashValue === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.cashValue === undefined },
    { label: 'Cost basis', value: format(portfolio.summary.costBasis), note: 'Purchase cost of units still held, including applicable charges; foreign trades use transaction-date FX.', color: portfolio.summary.costBasis === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.costBasis === undefined },
    { label: 'Unrealised P/L', value: unrealised === undefined ? 'Incomplete' : masked ? '••••' : `${unrealised > 0 ? '+' : ''}${money(unrealised, portfolio.appCurrency)} · ${((portfolio.summary.unrealisedPercent ?? 0) > 0 ? '+' : '')}${(portfolio.summary.unrealisedPercent ?? 0).toFixed(1)}%`, note: 'Market value minus cost basis', color: getColor(unrealised), bg: getStyle(unrealised), isIncomplete: unrealised === undefined },
    { label: 'Realised P/L', value: realised === undefined ? 'Incomplete' : masked ? '••••' : `${realised > 0 ? '+' : ''}${money(realised, portfolio.appCurrency)}`, note: 'Closed units and fees', color: getColor(realised), bg: getStyle(realised), isIncomplete: realised === undefined },
    { label: 'Net dividends', value: format(portfolio.summary.netDividends), note: 'Separate from capital gains', color: portfolio.summary.netDividends === undefined ? 'text-amber-500' : 'text-foreground', bg: 'bg-card/92 border-border/60', isIncomplete: portfolio.summary.netDividends === undefined },
    { label: 'Daily change', value: daily === undefined ? 'Incomplete' : masked ? '••••' : `${daily > 0 ? '+' : ''}${money(daily, portfolio.appCurrency)}`, note: 'Based on cached daily closes', color: getColor(daily), bg: getStyle(daily), isIncomplete: daily === undefined },
  ]
  return (
    <section aria-label="Investment summary" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cards.map(({ label, value, note, color, bg, isIncomplete }) => (
        <div key={label} className={`app-panel rounded-2xl border p-4 ${bg}`}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className={`mt-2 break-words text-lg font-black ${color}`} title={value}>{value}</p>
          <p className="mt-1 text-[10px] text-muted-foreground" title={label === 'Cost basis' ? 'Current FX is not used to calculate historical purchase cost.' : undefined}>{note}</p>
          {isIncomplete && <p className="mt-1 text-[9px] text-amber-500/80">See calculation notes below</p>}
        </div>
      ))}
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
  const [tab, setTab] = useState<'accounts' | 'investments' | 'prices'>('accounts')
  const [query, setQuery] = useState('')
  const instrumentById = new Map(portfolio.instruments.map(value => [value.id, value]))
  const matches = (value: string) => value.toLowerCase().includes(query.trim().toLowerCase())
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className="app-panel flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border/60 bg-card/92 p-4 text-left"
      >
        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <strong className="text-sm text-foreground">Manage portfolio</strong>
          <span className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-600 dark:text-blue-400">{portfolio.accounts.length} ACCOUNT{portfolio.accounts.length === 1 ? '' : 'S'}</span>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-violet-600 dark:text-violet-400">{portfolio.instruments.length} INVESTMENT{portfolio.instruments.length === 1 ? '' : 'S'}</span>
          </span>
        </span>
        <ChevronDown className="size-4 -rotate-90 shrink-0 text-muted-foreground" />
      </button>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Manage portfolio" maxWidthClassName="max-w-2xl">
        <div className="space-y-4">
          <div className="flex rounded-xl bg-muted/40 p-1">
            {([
              ['accounts', `Accounts (${portfolio.accounts.length})`],
              ['investments', `Investments (${portfolio.instruments.length})`],
              ['prices', `Manual prices (${portfolio.manualPrices.length})`],
            ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => { setTab(value); setQuery('') }} className={`min-w-0 flex-1 rounded-lg px-2 py-2 text-[10px] font-bold sm:text-xs ${tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>{label}</button>)}
          </div>
          <input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab}`} className={inputClass} />
          {tab === 'accounts' && <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Accounts</h3>
            <div className="mt-2 space-y-2">
              {portfolio.accounts.filter(value => matches(`${value.name} ${value.baseCurrency}`)).map(value => (
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3">
                  <span className="min-w-0">
                    <strong className="flex items-center gap-2 truncate text-xs text-foreground">
                      {value.name}
                      {!value.canDelete && !value.canArchive && !value.isArchived && (
                        <span title="Close every position and bring all cash balances to zero before archiving." className="flex cursor-help items-center gap-1.5 rounded-md px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/10">
                          <Info className="size-3.5" />
                          <span className="text-[10px] font-medium">Cannot archive</span>
                        </span>
                      )}
                    </strong>
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
                        disabled={offline || (!value.canDelete && !value.canArchive)}
                        title={value.archiveUnavailableReason}
                        onClick={() => value.canDelete ? onDeleteAccount(value.id) : onArchiveAccount(value.id)}
                      >
                        {value.canDelete ? 'Delete' : 'Archive'}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">Archive preserves closed-account history.</p>
          </div>}
          {tab === 'investments' && <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Investments</h3>
            <div className="mt-2 space-y-2">
              {portfolio.instruments.filter(value => matches(`${value.symbol} ${value.name} ${value.currency}`)).map(value => (
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3">
                  <span className="min-w-0">
                    <strong className="block truncate text-xs text-foreground">{value.symbol} · {value.name}</strong>
                    <span className="text-[10px] text-muted-foreground">{value.type} · {value.currency} · {value.isCustom ? 'Manual' : value.mic ?? value.exchange ?? 'Provider'}</span>
                  </span>
                  {value.canDelete && (
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
          </div>}
          {tab === 'prices' && <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Manual prices</h3>
            <div className="mt-2 space-y-2">
              {portfolio.manualPrices.filter(value => matches(`${instrumentById.get(value.instrumentId)?.symbol ?? ''} ${value.marketDate}`)).map(value => (
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
          </div>}
        </div>
      </BottomSheet>
    </>
  )
}

const ValueChart = ({ portfolio, masked, range, onRangeChange }: { portfolio: InvestmentPortfolio; masked: boolean; range: InvestmentRange; onRangeChange: (value: InvestmentRange) => void }) => {
  const values = portfolio.chart.flatMap(point => [point.totalValue, point.netDeposits]).filter((value): value is number => value !== undefined)
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const width = 720
  const height = 240
  const x = (index: number) => portfolio.chart.length <= 1 ? width / 2 : index / (portfolio.chart.length - 1) * width
  const y = (value: number) => height - ((value - min) / (max - min || 1)) * (height - 20) - 10
  const line = (key: 'totalValue' | 'netDeposits') =>
    portfolio.chart
      .map((point, index) => point[key] === undefined ? null : `${x(index)},${y(point[key]!)}`)
      .filter(Boolean)
      .join(' ')
  const latest = portfolio.chart.at(-1)
  const hasAnyMarketValue = portfolio.chart.some(p => p.totalValue !== undefined)
  const summary = latest
    ? `Latest total portfolio value: ${masked || latest.totalValue === undefined ? 'hidden or incomplete' : money(latest.totalValue, portfolio.appCurrency)}; net deposits ${masked || latest.netDeposits === undefined ? 'hidden or incomplete' : money(latest.netDeposits, portfolio.appCurrency)}.`
    : 'No chart data is available.'
  return (
    <section aria-labelledby="value-chart-title" className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="value-chart-title" className="text-base font-bold text-foreground">Portfolio value</h2>
          <p className="mt-1 text-xs text-muted-foreground">Historical holdings plus reconstructed settlement cash.</p>
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
            <polyline points={line('totalValue')} fill="none" stroke="#8b5cf6" strokeWidth="4" strokeLinejoin="round" vectorEffect="nonScalingStroke" />
            <polyline points={line('netDeposits')} fill="none" stroke="#f59e0b" strokeWidth="2" strokeDasharray="7 6" strokeLinejoin="round" vectorEffect="nonScalingStroke" />
          </svg>
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-semibold text-muted-foreground">
        <span><i className="mr-1 inline-block size-2 rounded-full bg-violet-500" /> Total value</span>
        <span><i className="mr-1 inline-block w-4 border-t-2 border-dashed border-amber-500 align-middle" /> Net deposits</span>
      </div>
      <table className="sr-only">
        <caption>Portfolio value chart data</caption>
        <thead><tr><th>Date</th><th>Total value</th><th>Net deposits</th></tr></thead>
        <tbody>{portfolio.chart.map(point => <tr key={point.date}><td>{point.date}</td><td>{masked ? 'Hidden' : point.totalValue}</td><td>{masked ? 'Hidden' : point.netDeposits}</td></tr>)}</tbody>
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
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10)

  const holdings = portfolio.holdings.filter(holding =>
    !filter ||
    (filter.mode === 'asset' ? holding.type === filter.key || holding.symbol === filter.key : holding.accountName === filter.key))

  const total = holdings.length
  const pages = Math.max(1, Math.ceil(total / pageSize))

  useEffect(() => {
    if (page > pages) setPage(Math.max(1, pages))
  }, [page, pages])

  const paginatedHoldings = holdings.slice((page - 1) * pageSize, page * pageSize)

  const accountGroups = portfolio.accounts
    .map(account => {
      const accountHoldings = holdings.filter(holding => holding.accountId === account.id)
      const cash = portfolio.cashBalances.filter(balance => balance.accountId === account.id)
      const total = [...accountHoldings.map(value => value.valueApp), ...cash.map(value => value.amountApp)]
        .reduce<number | undefined>((sum, value) => sum === undefined || value === undefined ? undefined : sum + value, 0)
      return { account, holdings: accountHoldings, cash, total }
    })
    .filter(group => group.holdings.length > 0 || group.cash.length > 0)
  return (
  <section aria-labelledby="holdings-title" className="app-panel overflow-hidden rounded-2xl border border-border/60 bg-card/92">
    <div className="p-5"><h2 id="holdings-title" className="text-base font-bold text-foreground">Holdings by account</h2><p className="mt-1 text-xs text-muted-foreground">Recording opening, buy, or transfer activity places a reusable investment in an account.{filter ? ` Filtered by ${filter.key}.` : ''}</p></div>
    <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-3">
      {accountGroups.map(({ account, holdings: accountHoldings, cash, total }) => (
        <article key={account.id} className="rounded-xl border border-border/50 bg-muted/15 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate text-sm font-bold">{account.name}</h3><p className="text-[10px] text-muted-foreground">Base currency {account.baseCurrency} · {accountHoldings.length} holding{accountHoldings.length === 1 ? '' : 's'}</p></div>
            <strong className="shrink-0 text-xs">{masked ? '••••' : total === undefined ? 'Incomplete FX' : money(total, portfolio.appCurrency)}</strong>
          </div>
          {cash.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{cash.map(balance => (
            <span key={balance.currency} className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
              Cash · {masked ? '••••' : money(balance.amount, balance.currency)}
            </span>
          ))}</div>}
          {accountHoldings.length > 0 && <p className="mt-3 truncate text-[10px] text-muted-foreground">{accountHoldings.map(value => value.symbol).join(' · ')}</p>}
        </article>
      ))}
      {accountGroups.length === 0 && <p className="text-xs text-muted-foreground">Record an opening position, buy, transfer, or cash movement to populate an account.</p>}
    </div>
    <div className="space-y-3 px-3 pb-3 sm:hidden">
      {paginatedHoldings.map(holding => (
        <article key={`${holding.accountId}-${holding.instrumentId}`} className="min-w-0 rounded-xl border border-border/50 p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0"><strong className="block truncate text-sm">{holding.symbol} · {holding.name}</strong><span className="text-[10px] text-muted-foreground">{holding.accountName} · {holding.type}</span></div>
            <strong className="shrink-0 text-sm">{masked ? '••••' : holding.valueApp === undefined ? 'Incomplete FX' : money(holding.valueApp, portfolio.appCurrency)}</strong>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div><dt className="text-muted-foreground">Units</dt><dd className="break-words font-semibold">{masked ? '••••' : number(holding.units, 8)}</dd></div>
            <div><dt className="text-muted-foreground">Close</dt><dd className="break-words font-semibold">{masked || holding.latestPriceNative === undefined ? '—' : money(holding.latestPriceNative, holding.currency)}</dd></div>
            <div><dt className="text-muted-foreground">Native value</dt><dd className="break-words font-semibold">{masked || holding.valueNative === undefined ? '—' : money(holding.valueNative, holding.currency)}</dd></div>
            <div><dt className="text-muted-foreground">FX rate</dt><dd className="break-words font-semibold">{holding.fxRate === undefined ? 'Missing' : number(holding.fxRate, 8)}</dd></div>
          </dl>
          <p className="mt-3 break-words rounded-lg bg-muted/30 p-2 text-[9px] text-muted-foreground">
            {holding.latestPriceNative === undefined ? 'Closing price unavailable' : `${number(holding.units, 8)} × ${number(holding.latestPriceNative, 8)} ${holding.currency}`}
            {holding.currency !== portfolio.appCurrency ? ` × ${holding.fxRate === undefined ? 'missing FX' : number(holding.fxRate, 8)} = ${holding.valueApp === undefined ? 'incomplete' : money(holding.valueApp, portfolio.appCurrency)}` : ''}
            <span className="mt-1 block">{holding.priceSource ?? 'Price source unavailable'} · {holding.priceDate ?? 'No price date'}{holding.fxSource ? ` · ${holding.fxSource} (${holding.fxDate})` : ''}</span>
          </p>
        </article>
      ))}
    </div>
    <div className="hidden overflow-x-auto sm:block">
      <table className="w-full min-w-[1050px] text-left text-xs">
        <thead className="border-y border-border/50 bg-muted/25 text-[10px] uppercase tracking-wide text-muted-foreground">
          <tr><th className="px-4 py-3">Investment</th><th className="px-4 py-3">Account</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">Avg cost</th><th className="px-4 py-3 text-right">Latest</th><th className="px-4 py-3 text-right">Native value</th><th className="px-4 py-3 text-right">{portfolio.appCurrency} value</th><th className="px-4 py-3 text-right">Daily</th><th className="px-4 py-3 text-right">P/L</th><th className="px-4 py-3">Price date</th></tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {paginatedHoldings.map(holding => (
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
    {total > 0 && (
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 p-3">
        <CustomSelect value={pageSize} onChange={value => { setPageSize(Number(value) as 10 | 25 | 50); setPage(1) }} options={[10, 25, 50].map(value => ({ value, label: `${value} per page` }))} ariaLabel="Rows per page" />
        <div className="flex items-center gap-2 text-xs"><Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>{page} / {pages}</span><Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</Button></div>
      </div>
    )}
  </section>
  )
}

const PagedActivityTable = ({
  portfolio,
  masked,
  refreshToken,
  operations,
  activeSyncId,
  onEdit,
  onDelete,
  onDeleteCashFlow,
}: {
  portfolio: InvestmentPortfolio
  masked: boolean
  refreshToken: number
  operations: import('../lib/outbox').QueuedOp[]
  activeSyncId: string | null
  onEdit: (activity: InvestmentActivity) => void
  onDelete: (activity: InvestmentActivity) => void
  onDeleteCashFlow: (flow: InvestmentCashFlow) => void
}) => {
  const [mode, setMode] = useState<'investments' | 'cash'>('investments')
  const [accountId, setAccountId] = useState('')
  const [instrumentId, setInstrumentId] = useState('')
  const [type, setType] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({ accountId: '', instrumentId: '', type: '', from: '', to: '' })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10)
  const [transactions, setTransactions] = useState<InvestmentActivity[]>([])
  const [cashFlows, setCashFlows] = useState<InvestmentCashFlow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const operationsRef = useRef(operations)
  const [projectedOperations, setProjectedOperations] = useState(operations)
  const accounts = new Map(portfolio.accounts.map(value => [value.id, value.name]))
  const instruments = new Map(portfolio.instruments.map(value => [value.id, value]))

  useEffect(() => {
    operationsRef.current = operations
    setProjectedOperations(previous => {
      const currentIds = new Set(operations.map(operation => operation.id))
      return [...operations, ...previous.filter(operation => !currentIds.has(operation.id))]
    })
  }, [operations])

  useEffect(() => {
    const abort = new AbortController()
    setLoading(true)
    const requestMode = mode
    const filters = { ...appliedFilters, page, pageSize }
    const work = mode === 'investments'
      ? api.fetchInvestmentActivity(filters, abort.signal)
      : api.fetchInvestmentCashFlows(filters, abort.signal)
    work.then(result => {
      setTotal(result.total)
      if (requestMode === 'investments') setTransactions(result.items as InvestmentActivity[])
      else setCashFlows(result.items as InvestmentCashFlow[])
      // Keep completed optimistic rows visible until this paged server result has
      // actually reconciled them. Other queues retain completed operations across
      // refresh; this table owns a separate server request, so it needs the same
      // hand-off locally to avoid a deleted row briefly popping out or back in.
      setProjectedOperations(operationsRef.current)
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
      if (page > lastPage) setPage(lastPage)
    }).catch(() => undefined)
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [mode, appliedFilters, page, pageSize, refreshToken])

  const resetPage = (work: () => void) => { work(); setPage(1) }
  const applySearch = () => {
    setAppliedFilters({ accountId, instrumentId: mode === 'investments' ? instrumentId : '', type, from, to })
    setPage(1)
  }
  const clearAll = () => {
    setAccountId(''); setInstrumentId(''); setType(''); setFrom(''); setTo('')
    setAppliedFilters({ accountId: '', instrumentId: '', type: '', from: '', to: '' })
    setPage(1)
  }
  const displayTransactions = applyOpsToList(transactions, projectedOperations, 'investmentActivity').filter(value =>
    (!appliedFilters.accountId || value.accountId === appliedFilters.accountId) &&
    (!appliedFilters.instrumentId || value.instrumentId === appliedFilters.instrumentId) &&
    (!appliedFilters.type || value.type === appliedFilters.type) &&
    (!appliedFilters.from || value.tradeDate >= appliedFilters.from) &&
    (!appliedFilters.to || value.tradeDate <= appliedFilters.to))
  const displayCashFlows = applyOpsToList(cashFlows, projectedOperations, 'investmentCashFlow')
    .map(value => value.isPendingSync && value.type === 'Withdrawal' && value.amount > 0 ? { ...value, amount: -value.amount } : value)
    .filter(value =>
      (!appliedFilters.accountId || value.accountId === appliedFilters.accountId) &&
      (!appliedFilters.type || value.type === appliedFilters.type) &&
      (!appliedFilters.from || value.date >= appliedFilters.from) &&
      (!appliedFilters.to || value.date <= appliedFilters.to))
  const rows = mode === 'investments' ? displayTransactions : displayCashFlows
  const activeOperation = projectedOperations.find(operation => operation.targetId === activeSyncId)
  const activeLabel = activeOperation?.type === 'delete' ? 'Deleting…'
    : activeOperation?.type === 'restore' ? 'Undoing…'
    : activeOperation?.type === 'add' ? 'Saving…'
    : activeOperation ? 'Syncing…' : null
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const typeOptions = mode === 'investments'
    ? [{ value: '', label: 'All types' }, ...activityTypes]
    : [{ value: '', label: 'All types' }, { value: 'Deposit', label: 'Deposit' }, { value: 'Withdrawal', label: 'Withdrawal' }]

  return (
    <section aria-labelledby="activity-title" className="app-panel min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/92">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="activity-title" className="text-base font-bold text-foreground">Activity</h2><p className="mt-1 text-xs text-muted-foreground">{total} matching record{total === 1 ? '' : 's'}{activeLabel ? ` · ${activeLabel}` : ''}</p></div>
          <div className="flex rounded-xl bg-muted/40 p-1">
            <button type="button" onClick={() => resetPage(() => { setMode('investments'); setType(''); setAppliedFilters(value => ({ ...value, type: '' })) })} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'investments' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Investments</button>
            <button type="button" onClick={() => resetPage(() => { setMode('cash'); setType(''); setInstrumentId(''); setAppliedFilters(value => ({ ...value, type: '', instrumentId: '' })) })} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'cash' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Cash flow</button>
          </div>
        </div>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end" onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applySearch() } }}>
          <div className="grid min-w-0 flex-1 gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            <CustomSelect value={accountId} onChange={value => setAccountId(String(value))} options={[{ value: '', label: 'All accounts' }, ...portfolio.accounts.map(value => ({ value: value.id, label: value.name }))]} ariaLabel="Filter by account" className="min-w-0 w-full" />
            {mode === 'investments' && <CustomSelect value={instrumentId} onChange={value => setInstrumentId(String(value))} options={[{ value: '', label: 'All investments' }, ...portfolio.instruments.map(value => ({ value: value.id, label: value.symbol }))]} ariaLabel="Filter by investment" className="min-w-0 w-full" />}
            <CustomSelect value={type} onChange={value => setType(String(value))} options={typeOptions} ariaLabel="Filter by type" className="min-w-0 w-full" />
            <DatePicker value={from} onChange={setFrom} placeholder="From date" clearable clearAriaLabel="Clear from date" className="min-w-0 w-full" />
            <DatePicker value={to} onChange={setTo} placeholder="To date" clearable clearAriaLabel="Clear to date" className="min-w-0 w-full" />
          </div>
          <div className="flex shrink-0 gap-1 self-end lg:self-auto"><Button variant="primary" size="sm" onClick={applySearch}><Search className="size-3.5" /> Search</Button><Button variant="ghost" size="sm" onClick={clearAll}>Clear all</Button></div>
        </div>
      </div>
      {loading && rows.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Loading activity…</p> : rows.length === 0 ? <p className="p-5 text-xs text-muted-foreground">No activity matches these filters.</p> : (
        <div className="relative">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 rounded-lg bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm border border-border/50">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Updating…</span>
              </div>
            </div>
          )}
          <div className={loading ? 'opacity-50 blur-[2px] pointer-events-none transition-all duration-200' : 'transition-all duration-200'} aria-busy={loading}>
            <div className="space-y-2 p-3 sm:hidden">
            {mode === 'investments' ? displayTransactions.map(value => {
              const instrument = instruments.get(value.instrumentId)
              const isActive = activeSyncId === value.id
              const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
              return <article key={value.id} className="min-w-0 rounded-xl border border-border/50 p-3">
                <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-xs">{activityTypes.find(item => item.value === value.type)?.label} · {instrument?.symbol}</strong><span className="text-[10px] text-muted-foreground">{value.tradeDate} · {accounts.get(value.accountId)}</span><RowSyncStatus entityLabel="investment activity" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></div><span className="shrink-0 text-xs font-bold">{masked || value.cashAmount === undefined ? '—' : money(value.cashAmount, instrument?.currency ?? portfolio.appCurrency)}</span></div>
                {value.notes && <p className="mt-2 break-words text-[10px] text-muted-foreground">{value.notes}</p>}
                <div className="mt-2 flex justify-end gap-1"><Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEdit(value)}>Edit</Button><Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDelete(value)}>Delete</Button></div>
              </article>
            }) : displayCashFlows.map(value => {
              const isActive = activeSyncId === value.id
              const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
              return <article key={value.id} className="min-w-0 rounded-xl border border-border/50 p-3">
                <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-xs">{value.type} · {accounts.get(value.accountId)}</strong><span className="text-[10px] text-muted-foreground">{value.date}</span><RowSyncStatus entityLabel="cash movement" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></div><strong className={value.amount < 0 ? 'text-orange-500' : 'text-emerald-500'}>{masked ? '••••' : money(value.amount, value.currency)}</strong></div>
                {value.notes && <p className="mt-2 break-words text-[10px] text-muted-foreground">{value.notes}</p>}
                <div className="mt-2 flex justify-end"><Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDeleteCashFlow(value)}>Delete</Button></div>
              </article>
            })}
          </div>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-xs">
              <thead className="border-y border-border/50 bg-muted/25 text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Account</th>{mode === 'investments' && <th className="px-4 py-3">Investment</th>}<th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3" /></tr></thead>
              <tbody className="divide-y divide-border/40">{mode === 'investments' ? displayTransactions.map(value => {
                const isActive = activeSyncId === value.id
                const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                return <tr key={value.id}><td className="px-4 py-3">{value.tradeDate}</td><td className="px-4 py-3"><span className="flex items-center gap-2 font-bold">{activityTypes.find(item => item.value === value.type)?.label}<RowSyncStatus entityLabel="investment activity" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></span></td><td className="px-4 py-3">{accounts.get(value.accountId)}</td><td className="px-4 py-3">{instruments.get(value.instrumentId)?.symbol}</td><td className="px-4 py-3 text-right">{masked || value.cashAmount === undefined ? '—' : money(value.cashAmount, instruments.get(value.instrumentId)?.currency ?? portfolio.appCurrency)}</td><td className="px-4 py-3"><span className="flex justify-end gap-1"><Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEdit(value)}>Edit</Button><Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDelete(value)}>Delete</Button></span></td></tr>
              }) : displayCashFlows.map(value => {
                const isActive = activeSyncId === value.id
                const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                return <tr key={value.id}><td className="px-4 py-3">{value.date}</td><td className="px-4 py-3"><span className="flex items-center gap-2 font-bold">{value.type}<RowSyncStatus entityLabel="cash movement" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></span></td><td className="px-4 py-3">{accounts.get(value.accountId)}</td><td className="px-4 py-3 text-right">{masked ? '••••' : money(value.amount, value.currency)}</td><td className="px-4 py-3 text-right"><Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDeleteCashFlow(value)}>Delete</Button></td></tr>
              })}</tbody>
            </table>
          </div>
        </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 p-3">
        <CustomSelect value={pageSize} onChange={value => resetPage(() => setPageSize(Number(value) as 10 | 25 | 50))} options={[10, 25, 50].map(value => ({ value, label: `${value} per page` }))} ariaLabel="Rows per page" />
        <div className="flex items-center gap-2 text-xs"><Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Previous</Button><span>{page} / {pages}</span><Button variant="ghost" size="sm" disabled={page >= pages} onClick={() => setPage(value => value + 1)}>Next</Button></div>
      </div>
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
      <label className={labelClass}>Base currency<CurrencySelect value={currency} onChange={setCurrency} className="mt-1.5" ariaLabel="Base currency" /></label>
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
        <label className={labelClass}>Currency<CurrencySelect value={currency} onChange={setCurrency} className="mt-1.5" ariaLabel="Investment currency" /></label>
      </div>
      <FormActions busy={busy} onCancel={onCancel} submitLabel="Save investment" />
    </form> : <>
      <label className={labelClass}>Symbol or company / fund name<div className="relative mt-1.5"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input value={query} onChange={event => { setQuery(event.target.value); setSelected(null) }} placeholder="Search at least 3 characters" className={`${inputClass} pl-9`} />{searching && <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-blue-500" />}</div></label>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {selected ? (
        <div className="rounded-xl border border-blue-500 bg-blue-500/5 p-3">
          <div className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block text-sm">{selected.symbol} · {selected.name}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{[selected.exchange, selected.mic, selected.currency, selected.country].filter(Boolean).join(' · ')}</span></span><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button></div>
        </div>
      ) : <div className="grid max-h-64 gap-2 overflow-y-auto overscroll-contain pr-1">
        {results.map(result => <button type="button" key={`${result.symbol}-${result.mic ?? result.exchange}`} onClick={() => setSelected(result)} className="cursor-pointer rounded-xl border border-border/50 p-3 text-left transition-colors hover:bg-muted/30">
          <span className="flex flex-wrap items-center gap-2"><strong className="text-sm text-foreground">{result.symbol}</strong><span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-bold">{result.type}</span><span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${result.availableOnBasic ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{result.availableOnBasic ? 'Basic available' : 'Plan unavailable'}</span></span>
          <span className="mt-1 block text-xs text-muted-foreground">{result.name}</span>
          <span className="mt-1 block text-[10px] text-muted-foreground">{[result.exchange, result.mic, result.currency, result.country].filter(Boolean).join(' · ')}</span>
        </button>)}
      </div>}
      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border/40 bg-card py-3">
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
    {!['Split', 'TransferIn', 'TransferOut', 'FeeTax'].includes(type) && <><label className={labelClass}>Fees{feesLabelSuffix}<input type="number" min="0" step="0.0000000001" value={fees} onChange={event => setFees(event.target.value)} className={inputClass} /></label><label className={labelClass}>Taxes{feesLabelSuffix}<input type="number" min="0" step="0.0000000001" value={taxes} onChange={event => setTaxes(event.target.value)} className={inputClass} /></label></>}
    {selectedInstrument && selectedInstrument.currency !== portfolio?.appCurrency && <label className={labelClass}>Trade FX rate<span className="block text-[10px] font-medium text-muted-foreground">{selectedInstrument.currency} → {portfolio?.appCurrency} · Optional</span><input type="number" min="0" step="0.0000000001" value={fx} onChange={event => setFx(event.target.value)} className={inputClass} /></label>}
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
      <label className={labelClass}>Currency<CurrencySelect value={currency} onChange={setCurrency} className="mt-1.5" ariaLabel="Cash currency" /></label>
      <div className={labelClass}>Date<DatePicker value={date} onChange={setDate} max={today()} className="mt-1.5 w-full" /></div>
      <label className={`${labelClass} sm:col-span-2`}>Notes<input maxLength={1000} value={notes} onChange={event => setNotes(event.target.value)} className={inputClass} /></label>
    </div>
    <p className="text-[10px] text-muted-foreground">Record cash you moved into or out of the broker account itself — not a stock purchase. Buys, sells, dividends, and fees adjust cash automatically.</p>
    <FormActions busy={busy} onCancel={onCancel} submitLabel={type === 'Withdrawal' ? 'Record withdrawal' : 'Record deposit'} disabled={!accountId} />
  </form>
}

export default InvestmentsView
