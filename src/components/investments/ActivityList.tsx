import { useEffect, useMemo, useRef, useState, type ComponentType } from 'react'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  Coins,
  Loader2,
  Minus,
  Pencil,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react'
import type { InvestmentActivity, InvestmentCashFlow, InvestmentPortfolio, InvestmentTransactionType } from '../../types'
import * as api from '../../lib/api'
import { applyOpsToList, type QueuedOp } from '../../lib/outbox'
import { sortActivityNewestFirst, sortCashFlowsNewestFirst } from '../../lib/investmentOrdering'
import { cn, formatCurrencyVal } from '../../lib/utils'
import { investmentActivityCashAfterCharges, investmentActivityCharges } from '../../lib/investmentActivityDisplay'
import { useIsExpanded } from '../../lib/breakpoints'
import { Badge, type BadgeTone } from '../ui/Badge'
import { BottomSheet } from '../ui/BottomSheet'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { CustomSelect } from '../ui/CustomSelect'
import { DatePicker } from '../ui/DatePicker'
import { OverflowMenu } from '../ui/OverflowMenu'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { Tabs } from '../ui/Tabs'
import { resolveMutationBusyLabel } from '../ui/rowSyncState'
import { DataTable, DataTableBody, DataTableFooter, DataTableHeader, DataTableHeaderCell, DataTablePagination } from '../ui/DataTable'
import { panelClass } from '../ui/panelStyles'

const activityTypes: Array<{ value: InvestmentTransactionType; label: string }> = [
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
  { value: 'Dividend', label: 'Dividend' },
  { value: 'FeeTax', label: 'Fee / tax' },
]

/**
 * The kind of a row changes how every other figure on it should be read, so it leads: as an icon
 * on the phone list and as a tinted chip in the table. The chip tones keep the meanings they carry
 * elsewhere: money going out to buy, money coming back from a sale, income, and a charge.
 */
const ACTIVITY_TONES: Record<InvestmentTransactionType, BadgeTone> = {
  Buy: 'info',
  Sell: 'accent',
  Dividend: 'success',
  FeeTax: 'warning',
}
const ACTIVITY_ICONS: Record<InvestmentTransactionType, ComponentType<{ className?: string }>> = {
  Buy: Plus,
  Sell: Minus,
  Dividend: Coins,
  FeeTax: Receipt,
}

const CASH_FLOW_TONES: Record<string, BadgeTone> = {
  Deposit: 'success',
  Withdrawal: 'urgent',
  Conversion: 'info',
}
const CASH_FLOW_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  Deposit: ArrowDownToLine,
  Withdrawal: ArrowUpFromLine,
  Conversion: ArrowLeftRight,
}

const PAGE_SIZES = [10, 25, 50] as const
const positiveTone = 'text-emerald-600 dark:text-emerald-400'

const activityLabel = (type: InvestmentTransactionType) =>
  activityTypes.find(item => item.value === type)?.label ?? type

const money = (value: number, currency: string) => formatCurrencyVal(value, currency)
const number = (value: number, digits = 4) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)

/** The instrument's ticker, in the same chip shape a category wears in the ledger table. */
function InstrumentChip({ symbol }: { symbol?: string }) {
  if (!symbol) return <span className="text-muted-foreground">—</span>
  return (
    <span className="inline-flex max-w-full items-center truncate rounded-md bg-surface-2 px-1.5 py-0.5 text-caption font-semibold text-foreground dark:bg-surface-3">
      {symbol}
    </span>
  )
}

const cashFlowAmount = (flow: InvestmentCashFlow, masked: boolean) => {
  if (masked) return '••••'
  const amount = money(Math.abs(flow.amount), flow.currency)
  if (flow.type === 'Deposit') return `+${amount}`
  if (flow.type === 'Withdrawal') return `−${amount}`
  if (flow.toCurrency === undefined || flow.toAmount === undefined) return amount
  return `${amount} → ${money(flow.toAmount, flow.toCurrency)}`
}

const signedMoney = (value: number, currency: string) => `${value < 0 ? '−' : value > 0 ? '+' : ''}${money(Math.abs(value), currency)}`

function dayLabel(date: string, today = new Date()): string {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return date
  const value = new Date(year, month - 1, day)
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diff = Math.round((startOfToday.getTime() - value.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return value.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(year !== today.getFullYear() ? { year: 'numeric' } : {}),
  })
}

/** Consecutive rows sharing a date; the rows arrive sorted, so one pass is enough. */
function groupByDay<T>(rows: T[], dateOf: (row: T) => string) {
  const groups: Array<{ date: string; rows: T[] }> = []
  rows.forEach(row => {
    const date = dateOf(row).slice(0, 10)
    const last = groups[groups.length - 1]
    if (last && last.date === date) last.rows.push(row)
    else groups.push({ date, rows: [row] })
  })
  return groups
}

function TypeTile({ icon: Icon }: { icon: ComponentType<{ className?: string }> }) {
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-muted-foreground dark:bg-surface-3">
      <Icon className="size-4" />
    </span>
  )
}

function ActivityAmountCell({ activity, currency, masked }: { activity: InvestmentActivity; currency: string; masked: boolean }) {
  const charges = investmentActivityCharges(activity)
  const cashAfterCharges = investmentActivityCashAfterCharges(activity)
  return (
    <span className="flex flex-col items-end">
      <span className="font-semibold tabular-nums text-foreground">
        {masked ? '••••' : activity.cashAmount === undefined ? 'Unavailable' : money(activity.cashAmount, currency)}
      </span>
      {!masked && charges.total > 0 && (
        <span className="text-caption tabular-nums text-muted-foreground">
          {charges.fees > 0 && <>Fees {money(charges.fees, currency)}</>}
          {charges.fees > 0 && charges.taxes > 0 && ' · '}
          {charges.taxes > 0 && <>Taxes {money(charges.taxes, currency)}</>}
          {cashAfterCharges !== undefined && <> · After charges {signedMoney(cashAfterCharges, currency)}</>}
        </span>
      )}
    </span>
  )
}

type Filters = { accountId: string; instrumentId: string; type: string; from: string; to: string }
const NO_FILTERS: Filters = { accountId: '', instrumentId: '', type: '', from: '', to: '' }

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
  const expanded = useIsExpanded()
  const [mode, setMode] = useState<'investments' | 'cash'>('investments')
  const [draft, setDraft] = useState<Filters>(NO_FILTERS)
  const [appliedFilters, setAppliedFilters] = useState<Filters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZES)[number]>(10)
  const [transactions, setTransactions] = useState<InvestmentActivity[]>([])
  const [cashFlows, setCashFlows] = useState<InvestmentCashFlow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const operationsRef = useRef(operations)
  const [projectedOperations, setProjectedOperations] = useState(operations)
  const accounts = useMemo(() => new Map(portfolio.accounts.map(value => [value.id, value.name])), [portfolio.accounts])
  const instruments = useMemo(() => new Map(portfolio.instruments.map(value => [value.id, value])), [portfolio.instruments])
  const showAccount = portfolio.accounts.length > 1

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
      setProjectedOperations(operationsRef.current)
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize))
      if (page > lastPage) setPage(lastPage)
    }).catch(() => undefined)
      .finally(() => { if (!abort.signal.aborted) setLoading(false) })
    return () => abort.abort()
  }, [mode, appliedFilters, page, pageSize, refreshToken])

  const setField = (field: keyof Filters) => (value: string) => setDraft(previous => ({ ...previous, [field]: value }))
  const switchMode = (next: 'investments' | 'cash') => {
    setMode(next)
    setDraft(previous => ({ ...previous, type: '', instrumentId: next === 'cash' ? '' : previous.instrumentId }))
    setAppliedFilters(previous => ({ ...previous, type: '', instrumentId: next === 'cash' ? '' : previous.instrumentId }))
    setPage(1)
  }
  const applySearch = () => {
    setAppliedFilters({ ...draft, instrumentId: mode === 'investments' ? draft.instrumentId : '' })
    setPage(1)
    setFiltersOpen(false)
  }
  const clearAll = () => {
    setDraft(NO_FILTERS)
    setAppliedFilters(NO_FILTERS)
    setPage(1)
    setFiltersOpen(false)
  }
  const displayTransactions = sortActivityNewestFirst(applyOpsToList(transactions, projectedOperations, 'investmentActivity').filter(value =>
    (!appliedFilters.accountId || value.accountId === appliedFilters.accountId) &&
    (!appliedFilters.instrumentId || value.instrumentId === appliedFilters.instrumentId) &&
    (!appliedFilters.type || value.type === appliedFilters.type) &&
    (!appliedFilters.from || value.tradeDate >= appliedFilters.from) &&
    (!appliedFilters.to || value.tradeDate <= appliedFilters.to)))
  const displayCashFlows = sortCashFlowsNewestFirst(applyOpsToList(cashFlows, projectedOperations, 'investmentCashFlow')
    .filter(value =>
      (!appliedFilters.accountId || value.accountId === appliedFilters.accountId) &&
      (!appliedFilters.type || value.type === appliedFilters.type) &&
      (!appliedFilters.from || value.date >= appliedFilters.from) &&
      (!appliedFilters.to || value.date <= appliedFilters.to)))
  const rows = mode === 'investments' ? displayTransactions : displayCashFlows
  const activeOperation = [...projectedOperations].reverse().find(operation =>
    operation.targetId === activeSyncId && !operation.isCompleted)
  const activeLabel = resolveMutationBusyLabel(activeOperation?.type)
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
  const activeFilterCount = (Object.keys(appliedFilters) as Array<keyof Filters>).filter(key => appliedFilters[key] !== '').length

  const filterControls = (
    <>
      <CustomSelect value={draft.accountId} onChange={value => setField('accountId')(String(value))} options={[{ value: '', label: 'All accounts' }, ...portfolio.accounts.map(value => ({ value: value.id, label: value.name }))]} ariaLabel="Filter by account" className="min-w-0 w-full" />
      {mode === 'investments' && <CustomSelect value={draft.instrumentId} onChange={value => setField('instrumentId')(String(value))} options={[{ value: '', label: 'All investments' }, ...portfolio.instruments.map(value => ({ value: value.id, label: value.symbol }))]} ariaLabel="Filter by investment" className="min-w-0 w-full" />}
      <CustomSelect value={draft.type} onChange={value => setField('type')(String(value))} options={typeOptions} ariaLabel="Filter by type" className="min-w-0 w-full" />
      <DatePicker value={draft.from} onChange={setField('from')} placeholder="From date" clearable clearAriaLabel="Clear from date" className="min-w-0 w-full" />
      <DatePicker value={draft.to} onChange={setField('to')} placeholder="To date" clearable clearAriaLabel="Clear to date" className="min-w-0 w-full" />
    </>
  )

  const rowActions = (label: string, busy: boolean, onEditRow: () => void, onDeleteRow: () => void) => (
    <OverflowMenu
      entityLabel={label}
      disabled={busy || masked}
      items={[
        { label: 'Edit', icon: Pencil, onSelect: onEditRow },
        { label: 'Delete', icon: Trash2, onSelect: onDeleteRow, tone: 'danger' },
      ]}
      className="relative z-10 text-muted-foreground"
    />
  )

  const phoneList = mode === 'investments'
    ? groupByDay(displayTransactions, value => value.tradeDate).map(group => (
      <section key={group.date} aria-label={dayLabel(group.date)}>
        <h3 className="px-5 pb-1 pt-3 text-caption font-medium text-muted-foreground sm:px-6">{dayLabel(group.date)}</h3>
        <ul className="divide-y divide-border/50">
          {group.rows.map(value => {
            const instrument = instruments.get(value.instrumentId)
            const currency = instrument?.currency ?? portfolio.appCurrency
            const isActive = isActiveRecord(value.id, 'investmentActivity')
            const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
            const charges = investmentActivityCharges(value)
            const afterCharges = investmentActivityCashAfterCharges(value)
            const label = `${activityLabel(value.type)} ${value.tradeDate}`
            const inflow = value.type === 'Sell' || value.type === 'Dividend'
            const detail = [
              value.units > 0 && value.type !== 'Dividend' && value.type !== 'FeeTax'
                ? `${masked ? '••' : number(value.units, 8)} × ${masked || value.unitPrice === undefined ? '—' : money(value.unitPrice, currency)}`
                : undefined,
              !masked && charges.fees > 0 ? `Fees ${money(charges.fees, currency)}` : undefined,
              !masked && charges.taxes > 0 ? `Taxes ${money(charges.taxes, currency)}` : undefined,
              showAccount ? accounts.get(value.accountId) : undefined,
            ].filter(Boolean).join(' · ')
            return (
              <li key={value.id} className="relative flex min-h-16 items-center gap-3 py-2.5 pl-5 pr-2 transition-colors hover:bg-surface-2/60 sm:pl-6">
                {/* The row is the edit action; the menu beside it holds edit and delete. */}
                <Button
                  variant="tertiary"
                  aria-label={`Edit ${label}`}
                  disabled={isBusy || masked}
                  onClick={() => onEdit(value)}
                  className="absolute inset-0 z-0 h-full min-h-0 w-full rounded-none p-0 hover:bg-transparent disabled:opacity-100 focus-visible:-outline-offset-2"
                />
                <span className="pointer-events-none relative"><TypeTile icon={ACTIVITY_ICONS[value.type]} /></span>
                <span className="pointer-events-none relative min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-body font-medium text-foreground">
                    <span className="truncate">{activityLabel(value.type)} {instrument?.symbol ?? ''}</span>
                    <RowSyncStatus entityLabel="investment activity" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} />
                  </span>
                  {detail && <span className="mt-0.5 block truncate text-caption text-muted-foreground">{detail}</span>}
                </span>
                <span className="pointer-events-none relative flex shrink-0 flex-col items-end">
                  <span className={cn('text-body font-semibold tabular-nums', inflow && !masked ? positiveTone : 'text-foreground')}>
                    {masked ? '••••' : value.cashAmount === undefined ? 'Unavailable' : `${inflow ? '+' : ''}${money(value.cashAmount, currency)}`}
                  </span>
                  {!masked && afterCharges !== undefined && (
                    <span className="mt-0.5 text-caption tabular-nums text-muted-foreground">{signedMoney(afterCharges, currency)} net</span>
                  )}
                </span>
                {rowActions(label, isBusy, () => onEdit(value), () => onDelete(value))}
              </li>
            )
          })}
        </ul>
      </section>
    ))
    : groupByDay(displayCashFlows, value => value.date).map(group => (
      <section key={group.date} aria-label={dayLabel(group.date)}>
        <h3 className="px-5 pb-1 pt-3 text-caption font-medium text-muted-foreground sm:px-6">{dayLabel(group.date)}</h3>
        <ul className="divide-y divide-border/50">
          {group.rows.map(value => {
            const isActive = isActiveRecord(value.id, 'investmentCashFlow')
            const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
            const label = `${value.type} ${value.date}`
            return (
              <li key={value.id} className="relative flex min-h-16 items-center gap-3 py-2.5 pl-5 pr-2 transition-colors hover:bg-surface-2/60 sm:pl-6">
                <Button
                  variant="tertiary"
                  aria-label={`Edit ${label}`}
                  disabled={isBusy || masked}
                  onClick={() => onEditCashFlow(value)}
                  className="absolute inset-0 z-0 h-full min-h-0 w-full rounded-none p-0 hover:bg-transparent disabled:opacity-100 focus-visible:-outline-offset-2"
                />
                <span className="pointer-events-none relative"><TypeTile icon={CASH_FLOW_ICONS[value.type] ?? ArrowLeftRight} /></span>
                <span className="pointer-events-none relative min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5 text-body font-medium text-foreground">
                    <span className="truncate">{value.type}</span>
                    <RowSyncStatus entityLabel="cash movement" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} />
                  </span>
                  <span className="mt-0.5 block truncate text-caption text-muted-foreground">{accounts.get(value.accountId)} · {value.currency}</span>
                </span>
                <span className={cn('pointer-events-none relative shrink-0 text-right text-body font-semibold tabular-nums', value.type === 'Deposit' && !masked ? positiveTone : 'text-foreground')}>
                  {cashFlowAmount(value, masked)}
                </span>
                {rowActions(label, isBusy, () => onEditCashFlow(value), () => onDeleteCashFlow(value))}
              </li>
            )
          })}
        </ul>
      </section>
    ))

  return (
    <section aria-labelledby="activity-title" className={cn(panelClass, 'min-w-0 overflow-hidden')}>
      <div className="space-y-3 px-5 pt-5 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 id="activity-title" className="text-section text-foreground">Activity</h2>
            <p className="mt-0.5 text-caption text-muted-foreground">{total} matching record{total === 1 ? '' : 's'}{activeLabel ? ` · ${activeLabel}` : ''}</p>
          </div>
          <Tabs
            value={mode}
            onValueChange={switchMode}
            options={[
              { value: 'investments', label: 'Investments', panelId: 'investment-activity-rows' },
              { value: 'cash', label: 'Cash flow', panelId: 'investment-activity-rows' },
            ]}
            label="Activity kind"
            idPrefix="investment-activity"
            variant="segmented"
          />
        </div>

        {expanded ? (
          <div
            className="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] items-center gap-2"
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); applySearch() } }}
          >
            {filterControls}
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={applySearch}><Search className="size-3.5" aria-hidden="true" /> Search</Button>
              <Button variant="tertiary" size="sm" onClick={clearAll}>Clear all</Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" aria-haspopup="dialog" onClick={() => { setDraft(appliedFilters); setFiltersOpen(true) }}>
              <SlidersHorizontal className="size-4" aria-hidden="true" /> Filters
              {activeFilterCount > 0 && <Badge tone="accent">{activeFilterCount}</Badge>}
            </Button>
            {activeFilterCount > 0 && (
              <Button variant="tertiary" size="sm" className="text-muted-foreground" onClick={clearAll}><X className="size-3.5" aria-hidden="true" /> Clear all</Button>
            )}
          </div>
        )}
      </div>

      {!expanded && (
        <BottomSheet
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Filter activity"
          maxWidthClassName="max-w-lg"
          footer={(
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={clearAll}>Clear all</Button>
              <Button variant="primary" onClick={applySearch}><Search className="size-4" aria-hidden="true" /> Search</Button>
            </div>
          )}
        >
          <div className="grid gap-3">{filterControls}</div>
        </BottomSheet>
      )}

      <div id="investment-activity-rows" role="tabpanel" aria-labelledby={`investment-activity-${mode}`} className="relative mt-2 min-h-32">
        {loading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <span className="flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-caption font-medium text-muted-foreground shadow-(--app-shadow-overlay)">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Updating…
            </span>
          </div>
        )}
        <div className={cn('transition-opacity duration-200', loading && 'pointer-events-none opacity-50')} aria-busy={loading}>
          {rows.length === 0 ? (
            <p className="px-5 py-6 text-center text-label text-muted-foreground sm:px-6">No activity matches these filters.</p>
          ) : !expanded ? (
            <div className="pb-2">{phoneList}</div>
          ) : (
            <DataTable embedded horizontalOverflow="auto" tableClassName="min-w-[650px]" className="mt-2">
              <DataTableHeader>
                <DataTableHeaderCell className="min-w-24">Date</DataTableHeaderCell>
                <DataTableHeaderCell className="min-w-28">Type</DataTableHeaderCell>
                <DataTableHeaderCell className="min-w-28">Account</DataTableHeaderCell>
                {mode === 'investments' && <DataTableHeaderCell className="min-w-24">Investment</DataTableHeaderCell>}
                <DataTableHeaderCell className="min-w-36 text-right">Gross amount</DataTableHeaderCell>
                <DataTableHeaderCell className="w-24 text-right"><span className="sr-only">Actions</span></DataTableHeaderCell>
              </DataTableHeader>
              <DataTableBody>{mode === 'investments' ? displayTransactions.map(value => {
                const isActive = isActiveRecord(value.id, 'investmentActivity')
                const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                return (
                  <tr key={value.id} className="transition-colors hover:bg-surface-2/50">
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{value.tradeDate}</td>
                    <td className="px-4 py-2.5"><span className="flex items-center gap-2"><Badge tone={ACTIVITY_TONES[value.type]}>{activityLabel(value.type)}</Badge><RowSyncStatus entityLabel="investment activity" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{accounts.get(value.accountId)}</td>
                    <td className="px-4 py-2.5"><InstrumentChip symbol={instruments.get(value.instrumentId)?.symbol} /></td>
                    <td className="px-4 py-2.5 text-right"><ActivityAmountCell activity={value} currency={instruments.get(value.instrumentId)?.currency ?? portfolio.appCurrency} masked={masked} /></td>
                    <td className="px-4 py-2.5"><span className="flex justify-end gap-1"><IconButton label={`Edit ${activityLabel(value.type)} ${value.tradeDate}`} tooltip="Edit" disabled={isBusy || masked} onClick={() => onEdit(value)} className="text-muted-foreground hover:text-foreground"><Pencil className="size-4" aria-hidden="true" /></IconButton><IconButton label={`Delete ${activityLabel(value.type)} ${value.tradeDate}`} tooltip="Delete" disabled={isBusy || masked} onClick={() => onDelete(value)} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" aria-hidden="true" /></IconButton></span></td>
                  </tr>
                )
              }) : displayCashFlows.map(value => {
                const isActive = isActiveRecord(value.id, 'investmentCashFlow')
                const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                return (
                  <tr key={value.id} className="transition-colors hover:bg-surface-2/50">
                    <td className="px-4 py-2.5 tabular-nums text-muted-foreground">{value.date}</td>
                    <td className="px-4 py-2.5"><span className="flex items-center gap-2"><Badge tone={CASH_FLOW_TONES[value.type] ?? 'neutral'}>{value.type}</Badge><RowSyncStatus entityLabel="cash movement" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></span></td>
                    <td className="px-4 py-2.5 text-muted-foreground">{accounts.get(value.accountId)}</td>
                    <td className={cn('px-4 py-2.5 text-right font-semibold tabular-nums', value.type === 'Deposit' && !masked ? positiveTone : 'text-foreground')}>{cashFlowAmount(value, masked)}</td>
                    <td className="px-4 py-2.5"><span className="flex justify-end gap-1"><IconButton label={`Edit ${value.type} ${value.date}`} tooltip="Edit" disabled={isBusy || masked} onClick={() => onEditCashFlow(value)} className="text-muted-foreground hover:text-foreground"><Pencil className="size-4" aria-hidden="true" /></IconButton><IconButton label={`Delete ${value.type} ${value.date}`} tooltip="Delete" disabled={isBusy || masked} onClick={() => onDeleteCashFlow(value)} className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="size-4" aria-hidden="true" /></IconButton></span></td>
                  </tr>
                )
              })}</DataTableBody>
            </DataTable>
          )}
        </div>
      </div>
      {total > PAGE_SIZES[0] ? (
        <DataTableFooter>
          <DataTablePagination
            centerOnMobile
            currentPage={page}
            pageSize={pageSize}
            totalItems={total}
            totalPages={pages}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={setPage}
            onPageSizeChange={value => { setPageSize(value as (typeof PAGE_SIZES)[number]); setPage(1) }}
          />
        </DataTableFooter>
      ) : <div className="h-3" />}
    </section>
  )
}
