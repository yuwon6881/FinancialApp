import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Loader2, Search } from 'lucide-react'
import type { InvestmentActivity, InvestmentCashFlow, InvestmentPortfolio, InvestmentTransactionType } from '../../types'
import * as api from '../../lib/api'
import { applyOpsToList, type QueuedOp } from '../../lib/outbox'
import { sortActivityNewestFirst, sortCashFlowsNewestFirst } from '../../lib/investmentOrdering'
import { formatCurrencyVal } from '../../lib/utils'
import { buildSleeveIndex, sleeveLabelFor, sleeveOf } from '../../lib/investmentAllocation'
import { Button } from '../ui/Button'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { DataTable, DataTableBody, DataTableFooter, DataTableHeader, DataTableHeaderCell, DataTablePagination } from '../ui/DataTable'
import type { AllocationFilter } from './InvestmentCharts'

const activityTypes: Array<{ value: InvestmentTransactionType; label: string }> = [
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
  { value: 'Dividend', label: 'Dividend' },
  { value: 'FeeTax', label: 'Fee / tax' },
]

const money = (value: number, currency: string) =>
  formatCurrencyVal(value, currency)

const number = (value: number, digits = 4) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)

const cashFlowAmount = (flow: InvestmentCashFlow, masked: boolean) => {
  if (masked) return '••••'
  const amount = money(Math.abs(flow.amount), flow.currency)
  if (flow.type === 'Deposit') return `+${amount}`
  if (flow.type === 'Withdrawal') return `−${amount}`
  if (flow.toCurrency === undefined || flow.toAmount === undefined) return amount
  return `${amount} → ${money(flow.toAmount, flow.toCurrency)}`
}

export const HoldingsTable = ({ portfolio, masked, filter }: { portfolio: InvestmentPortfolio; masked: boolean; filter: AllocationFilter }) => {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(10)
  const sleeveIndex = useMemo(() => buildSleeveIndex(portfolio.instruments), [portfolio.instruments])
  const filterLabel = filter?.mode === 'sleeve' ? sleeveLabelFor(filter.key, sleeveIndex) : filter?.key

  const holdings = portfolio.holdings.filter(holding =>
    !filter ||
    (filter.mode === 'sleeve' ? sleeveOf(holding, sleeveIndex).key === filter.key :
      filter.mode === 'asset' ? holding.type === filter.key :
      filter.mode === 'instrument' ? holding.symbol === filter.key :
        holding.accountName === filter.key))

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
    <div className="p-5"><h2 id="holdings-title" className="text-base font-bold text-foreground">What you hold</h2><p className="mt-1 text-xs text-muted-foreground">Every fund you own, grouped by the account holding it.{filter ? ` Showing only ${filterLabel}.` : ''}</p></div>
    <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-3">
      {accountGroups.map(({ account, holdings: accountHoldings, cash, total }) => (
        <article key={account.id} className="interactive-card rounded-xl border border-border/50 bg-muted/15 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate text-sm font-bold">{account.name}</h3><p className="text-[10px] text-muted-foreground">Base currency {account.baseCurrency} · {accountHoldings.length} holding{accountHoldings.length === 1 ? '' : 's'}</p></div>
            <strong className="shrink-0 text-xs">{masked ? '••••' : total === undefined ? 'Exchange rate missing' : money(total, portfolio.appCurrency)}</strong>
          </div>
          {cash.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{cash.map(balance => (
            <span key={balance.currency} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${balance.amount < 0 ? 'bg-orange-500/10 text-orange-700 dark:text-orange-300' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'}`}>
              Cash · {masked ? '••••' : money(balance.amount, balance.currency)}
            </span>
          ))}</div>}
          {accountHoldings.length > 0 && <p className="mt-3 truncate text-[10px] text-muted-foreground">{accountHoldings.map(value => value.symbol).join(' · ')}</p>}
        </article>
      ))}
      {accountGroups.length === 0 && <p className="text-xs text-muted-foreground">Record a buy or cash movement to populate an account.</p>}
    </div>
    <div className="space-y-3 px-3 pb-3 lg:hidden">
      {paginatedHoldings.map(holding => (
        <article key={`${holding.accountId}-${holding.instrumentId}`} className="interactive-card min-w-0 rounded-xl border border-border/50 p-4">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0"><strong className="block truncate text-sm">{holding.symbol} · {holding.name}</strong><span className="text-[10px] text-muted-foreground">{holding.accountName} · {holding.type}</span></div>
            <strong className="shrink-0 text-sm">{masked ? '••••' : holding.valueApp === undefined ? 'Exchange rate missing' : money(holding.valueApp, portfolio.appCurrency)}</strong>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div><dt className="text-muted-foreground">Units</dt><dd className="break-words font-semibold">{masked ? '••••' : number(holding.units, 8)}</dd></div>
            <div><dt className="text-muted-foreground">Latest price</dt><dd className="break-words font-semibold">{masked || holding.latestPriceNative === undefined ? '—' : money(holding.latestPriceNative, holding.currency)}</dd></div>
            <div><dt className="text-muted-foreground">Worth in fund currency</dt><dd className="break-words font-semibold">{masked || holding.valueNative === undefined ? '—' : money(holding.valueNative, holding.currency)}</dd></div>
            <div><dt className="text-muted-foreground">Exchange rate</dt><dd className="break-words font-semibold">{holding.fxRate === undefined ? 'Missing' : number(holding.fxRate, 8)}</dd></div>
            <div><dt className="text-muted-foreground">Already banked</dt><dd className={`break-words font-semibold ${holding.realisedProfitLossApp === undefined ? '' : holding.realisedProfitLossApp >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>{masked ? '••••' : holding.realisedProfitLossApp === undefined ? '—' : money(holding.realisedProfitLossApp, portfolio.appCurrency)}</dd></div>
            <div><dt className="text-muted-foreground">Dividends</dt><dd className={`break-words font-semibold ${holding.netDividendsApp === undefined ? '' : holding.netDividendsApp >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>{masked ? '••••' : holding.netDividendsApp === undefined ? '—' : money(holding.netDividendsApp, portfolio.appCurrency)}</dd></div>
          </dl>
          <details className="mt-3 group rounded-lg border border-border/50 bg-muted/20">
            <summary className="flex cursor-pointer select-none items-center justify-between p-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:bg-muted/30">
              <span>How this was worked out</span>
              <ChevronDown className="size-3.5 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 p-2.5 pt-2 text-[10px] text-muted-foreground">
              <p className="break-words font-medium text-foreground/80">
                {holding.latestPriceNative === undefined ? 'Closing price unavailable' : `${number(holding.units, 8)} × ${number(holding.latestPriceNative, 8)} ${holding.currency}`}
                {holding.currency !== portfolio.appCurrency ? ` × ${holding.fxRate === undefined ? 'missing FX' : number(holding.fxRate, 8)} = ${holding.valueApp === undefined ? 'incomplete' : money(holding.valueApp, portfolio.appCurrency)}` : ''}
              </p>
              <div className="mt-2 space-y-1 text-[9px]">
                <div className="flex justify-between gap-2"><span className="opacity-70">Price from</span><span className="text-right">{holding.priceSource ?? 'Price source unavailable'} · {holding.priceDate ?? 'No date'}</span></div>
                {holding.fxSource && <div className="flex justify-between gap-2"><span className="opacity-70">Rate from</span><span className="text-right">{holding.fxSource} · {holding.fxDate ?? 'No date'}</span></div>}
              </div>
            </div>
          </details>
        </article>
      ))}
    </div>
    <div className="hidden lg:block">
      <DataTable embedded tableClassName="min-w-[1050px]">
        <DataTableHeader className="text-[10px] uppercase tracking-wide">
          <DataTableHeaderCell>Investment</DataTableHeaderCell>
          <DataTableHeaderCell>Account</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Units</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Avg price paid</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Latest price</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Worth now ({portfolio.appCurrency})</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Change today</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Gain on paper</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Already banked</DataTableHeaderCell>
          <DataTableHeaderCell className="text-right">Dividends</DataTableHeaderCell>
        </DataTableHeader>
        <DataTableBody>
          {paginatedHoldings.map(holding => (
            <tr key={`${holding.accountId}-${holding.instrumentId}`} className="hover:bg-muted/20">
              <td className="px-4 py-3"><span className="font-bold text-foreground">{holding.symbol}</span><span className="ml-2 text-[10px] text-muted-foreground">{holding.type}</span><span className="block max-w-44 truncate text-[10px] text-muted-foreground">{holding.name}</span><details className="group/valuation mt-1 text-[9px] text-muted-foreground"><summary className="cursor-pointer select-none outline-none">How this was worked out</summary><div className="mt-1">Worth in fund currency {masked || holding.valueNative === undefined ? '—' : money(holding.valueNative, holding.currency)} · {holding.priceDate ?? 'No price date'}</div></details></td>
              <td className="px-4 py-3 text-muted-foreground">{holding.accountName}</td>
              <td className="px-4 py-3 text-right font-medium">{masked ? '••••' : number(holding.units, 8)}</td>
              <td className="px-4 py-3 text-right">{masked ? '••••' : money(holding.averageCostNative, holding.currency)}</td>
              <td className="px-4 py-3 text-right">{masked ? '••••' : holding.latestPriceNative === undefined ? 'Unavailable' : money(holding.latestPriceNative, holding.currency)}</td>
              <td className="px-4 py-3 text-right font-bold">{masked ? '••••' : holding.valueApp === undefined ? 'Exchange rate missing' : money(holding.valueApp, portfolio.appCurrency)}</td>
              <td className="px-4 py-3 text-right">{masked ? '••••' : holding.dailyChangeApp === undefined ? '—' : money(holding.dailyChangeApp, portfolio.appCurrency)}</td>
              <td className={`px-4 py-3 text-right font-bold ${(holding.unrealisedProfitLossApp ?? 0) >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>{masked ? '••••' : holding.unrealisedProfitLossApp === undefined ? '—' : `${money(holding.unrealisedProfitLossApp, portfolio.appCurrency)} (${(holding.unrealisedPercent ?? 0).toFixed(1)}%)`}</td>
              <td className={`px-4 py-3 text-right font-bold ${holding.realisedProfitLossApp === undefined ? '' : holding.realisedProfitLossApp >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>{masked ? '••••' : holding.realisedProfitLossApp === undefined ? '—' : money(holding.realisedProfitLossApp, portfolio.appCurrency)}</td>
              <td className={`px-4 py-3 text-right font-bold ${holding.netDividendsApp === undefined ? '' : holding.netDividendsApp >= 0 ? 'text-emerald-500' : 'text-orange-500'}`}>{masked ? '••••' : holding.netDividendsApp === undefined ? '—' : money(holding.netDividendsApp, portfolio.appCurrency)}</td>
            </tr>
          ))}
        </DataTableBody>
      </DataTable>
    </div>
    {total > 0 && (
      <DataTableFooter>
        <DataTablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={total}
          totalPages={pages}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={setPage}
          onPageSizeChange={value => { setPageSize(value as 10 | 25 | 50); setPage(1) }}
        />
      </DataTableFooter>
    )}
  </section>
  )
}

export const PagedActivityTable = ({
  portfolio,
  masked,
  refreshToken,
  operations,
  activeSyncId,
  onEdit,
  onDelete,
  onEditCashFlow,
  onDeleteCashFlow,
}: {
  portfolio: InvestmentPortfolio
  masked: boolean
  refreshToken: number
  operations: QueuedOp[]
  activeSyncId: string | null
  onEdit: (activity: InvestmentActivity) => void
  onDelete: (activity: InvestmentActivity) => void
  onEditCashFlow: (flow: InvestmentCashFlow) => void
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
      return [...operations, ...previous.filter(operation => !currentIds.has(operation.id) && operation.isCompleted)]
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
  // Re-sorted locally with the same key the server uses, so editing a date moves the
  // row straight away and the server response only confirms where it landed.
  const displayTransactions = sortActivityNewestFirst(applyOpsToList(transactions, projectedOperations, 'investmentActivity').filter(value =>
    (!appliedFilters.accountId || value.accountId === appliedFilters.accountId) &&
    (!appliedFilters.instrumentId || value.instrumentId === appliedFilters.instrumentId) &&
    (!appliedFilters.type || value.type === appliedFilters.type) &&
    (!appliedFilters.from || value.tradeDate >= appliedFilters.from) &&
    (!appliedFilters.to || value.tradeDate <= appliedFilters.to)))
  const displayCashFlows = sortCashFlowsNewestFirst(applyOpsToList(cashFlows, projectedOperations, 'investmentCashFlow')
    .map(value => value.isPendingSync && value.type === 'Withdrawal' && value.amount > 0 ? { ...value, amount: -value.amount } : value)
    .filter(value =>
      (!appliedFilters.accountId || value.accountId === appliedFilters.accountId) &&
      (!appliedFilters.type || value.type === appliedFilters.type) &&
      (!appliedFilters.from || value.date >= appliedFilters.from) &&
      (!appliedFilters.to || value.date <= appliedFilters.to)))
  const rows = mode === 'investments' ? displayTransactions : displayCashFlows
  const activeOperation = [...projectedOperations].reverse().find(operation =>
    operation.targetId === activeSyncId && !operation.isCompleted)
  const activeLabel = activeOperation?.type === 'delete' ? 'Deleting…'
    : activeOperation?.type === 'restore' ? 'Undoing…'
    : activeOperation?.type === 'add' ? 'Saving…'
    : activeOperation ? 'Syncing…' : null
  const isActiveRecord = (id: string, entity: 'investmentActivity' | 'investmentCashFlow') => {
    if (!activeSyncId) return false
    const operation = activeOperation
    if (!operation || operation.entity !== entity) return false
    if (String(id) === String(activeSyncId)) return true
    if (operation.type === 'restore' && entity === 'investmentActivity') {
      return Array.isArray(operation.payload?.transactions) && operation.payload.transactions.some(item =>
        item && typeof item === 'object' && 'id' in item && String(item.id) === String(id))
    }
    return false
  }
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const typeOptions = mode === 'investments'
    ? [{ value: '', label: 'All types' }, ...activityTypes]
    : [{ value: '', label: 'All types' }, { value: 'Deposit', label: 'Deposit' }, { value: 'Withdrawal', label: 'Withdrawal' }, { value: 'Conversion', label: 'Conversion' }]

  return (
    <section aria-labelledby="activity-title" className="app-panel min-w-0 overflow-hidden rounded-2xl border border-border/60 bg-card/92">
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 id="activity-title" className="text-base font-bold text-foreground">Activity</h2><p className="mt-1 text-xs text-muted-foreground">{total} matching record{total === 1 ? '' : 's'}{activeLabel ? ` · ${activeLabel}` : ''}</p></div>
          <div className="flex rounded-xl bg-muted/40 p-1">
            <Button variant="unstyled" onClick={() => resetPage(() => { setMode('investments'); setType(''); setAppliedFilters(value => ({ ...value, type: '' })) })} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'investments' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Investments</Button>
            <Button variant="unstyled" onClick={() => resetPage(() => { setMode('cash'); setType(''); setInstrumentId(''); setAppliedFilters(value => ({ ...value, type: '', instrumentId: '' })) })} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${mode === 'cash' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>Cash flow</Button>
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
          <div className="grid w-full shrink-0 grid-cols-2 gap-2 sm:w-auto lg:flex lg:self-auto">
            <Button variant="primary" className="h-10 px-3 text-xs" onClick={applySearch}><Search className="size-3.5" /> Search</Button>
            <Button variant="ghost" className="h-10 px-3 text-xs" onClick={clearAll}>Clear all</Button>
          </div>
        </div>
        </div>
        <div className="relative min-h-[160px]">
          {loading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 rounded-lg bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm border border-border/50">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Updating…</span>
              </div>
            </div>
          )}
          <div className={loading ? 'opacity-50 blur-[2px] pointer-events-none transition-all duration-200' : 'transition-all duration-200'} aria-busy={loading}>
            {rows.length === 0 ? (
              <p className="p-5 text-xs text-muted-foreground">
                {total === 0 && !appliedFilters.type && !appliedFilters.accountId && !appliedFilters.instrumentId && !appliedFilters.from && !appliedFilters.to
                  ? 'No activity matches these filters.'
                  : 'No activity matches these filters.'}
              </p>
            ) : (
              <>
                <div className="space-y-2 p-3 lg:hidden">
                {mode === 'investments' ? displayTransactions.map(value => {
                  const instrument = instruments.get(value.instrumentId)
                  const isActive = isActiveRecord(value.id, 'investmentActivity')
                  const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                  return <article key={value.id} className="interactive-card min-w-0 rounded-xl border border-border/50 p-3">
                    <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-xs">{activityTypes.find(item => item.value === value.type)?.label} · {instrument?.symbol}</strong><span className="text-[10px] text-muted-foreground">{value.tradeDate} · {accounts.get(value.accountId)}</span><RowSyncStatus entityLabel="investment activity" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></div><span className="shrink-0 text-xs font-bold">{masked || value.cashAmount === undefined ? '—' : money(value.cashAmount, instrument?.currency ?? portfolio.appCurrency)}</span></div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEdit(value)}>Edit</Button>
                      <Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDelete(value)}>Delete</Button>
                    </div>
                  </article>
                }) : displayCashFlows.map(value => {
                  const isActive = isActiveRecord(value.id, 'investmentCashFlow')
                  const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                  return <article key={value.id} className="interactive-card min-w-0 rounded-xl border border-border/50 p-3">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-xs">{value.type} · {accounts.get(value.accountId)}</strong><span className="text-[10px] text-muted-foreground">{value.date}</span><RowSyncStatus entityLabel="cash movement" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></div><strong className={`shrink-0 text-xs font-bold ${value.type === 'Conversion' ? '' : value.amount < 0 ? 'text-orange-500' : 'text-emerald-500'}`}>{cashFlowAmount(value, masked)}</strong></div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEditCashFlow(value)}>Edit</Button>
                      <Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDeleteCashFlow(value)}>Delete</Button>
                    </div>
                  </article>
                })}
                </div>
                <div className="hidden lg:block">
                  <DataTable embedded>
                    <DataTableHeader className="text-[10px] uppercase">
                      <DataTableHeaderCell>Date</DataTableHeaderCell>
                      <DataTableHeaderCell>Type</DataTableHeaderCell>
                      <DataTableHeaderCell>Account</DataTableHeaderCell>
                      {mode === 'investments' && <DataTableHeaderCell>Investment</DataTableHeaderCell>}
                      <DataTableHeaderCell className="text-right">Amount</DataTableHeaderCell>
                      <DataTableHeaderCell />
                    </DataTableHeader>
                    <DataTableBody>{mode === 'investments' ? displayTransactions.map(value => {
                      const isActive = isActiveRecord(value.id, 'investmentActivity')
                      const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                      return <tr key={value.id}><td className="px-4 py-3">{value.tradeDate}</td><td className="px-4 py-3"><span className="flex items-center gap-2 font-bold">{activityTypes.find(item => item.value === value.type)?.label}<RowSyncStatus entityLabel="investment activity" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></span></td><td className="px-4 py-3">{accounts.get(value.accountId)}</td><td className="px-4 py-3">{instruments.get(value.instrumentId)?.symbol}</td><td className="px-4 py-3 text-right">{masked || value.cashAmount === undefined ? '—' : money(value.cashAmount, instruments.get(value.instrumentId)?.currency ?? portfolio.appCurrency)}</td><td className="px-4 py-3"><span className="flex justify-end gap-1"><Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEdit(value)}>Edit</Button><Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDelete(value)}>Delete</Button></span></td></tr>
                    }) : displayCashFlows.map(value => {
                      const isActive = isActiveRecord(value.id, 'investmentCashFlow')
                      const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                      return <tr key={value.id}><td className="px-4 py-3">{value.date}</td><td className="px-4 py-3"><span className="flex items-center gap-2 font-bold">{value.type}<RowSyncStatus entityLabel="cash movement" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></span></td><td className="px-4 py-3">{accounts.get(value.accountId)}</td><td className="px-4 py-3 text-right">{cashFlowAmount(value, masked)}</td><td className="px-4 py-3"><span className="flex justify-end gap-1"><Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEditCashFlow(value)}>Edit</Button><Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDeleteCashFlow(value)}>Delete</Button></span></td></tr>
                    })}</DataTableBody>
                  </DataTable>
                </div>
              </>
            )}
          </div>
        </div>
      <DataTableFooter>
        <DataTablePagination
          currentPage={page}
          pageSize={pageSize}
          totalItems={total}
          totalPages={pages}
          pageSizeOptions={[10, 25, 50]}
          onPageChange={setPage}
          onPageSizeChange={value => resetPage(() => setPageSize(value as 10 | 25 | 50))}
        />
      </DataTableFooter>
    </section>
  )
}
