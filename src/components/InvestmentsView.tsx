import React, { useEffect, useMemo, useRef, useState } from 'react'
import { m, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  CloudOff,
  Info,
  Loader2,
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
import { InfoHint } from './ui/InfoHint'
import { useInvestmentPortfolio } from './investments/useInvestmentPortfolio'
import { applyOpsToList } from '../lib/outbox'
import { availableActivityCash, availableActivityUnits, availableCash, validateActivityBalances, validateCashFlowBalances } from '../lib/investmentValidation'
import { sortActivityNewestFirst, sortCashFlowsNewestFirst } from '../lib/investmentOrdering'
import { RowSyncStatus } from './ui/RowSyncBadge'
import { InvestmentPlanPanel } from './investments/InvestmentPlanPanel'
import { InteractiveDoughnutChart } from './ui/InteractiveDoughnutChart'
import { ReceiptScanPicker } from './ledger/transaction-form/ReceiptScanPicker'
import { ReceiptScanStatus } from './ledger/transaction-form/ReceiptScanStatus'
import { useAutoOpenModal } from '../lib/useAutoOpenModal'
import { getErrorMessage } from '../lib/errors'
import type { InvestmentActivityScanResult } from '../lib/api'

interface InvestmentsViewProps {
  onNavigate: (tab: AppTab) => void
  autoOpenAddForm?: boolean
  onResetAutoOpen?: () => void
  onAddFormOpenChange?: (open: boolean) => void
  investmentScanDraft?: { jobId: string; result: InvestmentActivityScanResult } | null
  failedScanJob?: { jobId: string; errorMessage: string } | null
  activeScanJobIds?: string[]
  onInvestmentScanStarted?: (scanId: string) => void
  onInvestmentScanCleared?: (scanId: string) => void | Promise<void>
}

type Panel = 'account' | 'instrument' | 'activity' | 'cash' | null
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
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
  { value: 'Dividend', label: 'Dividend' },
  { value: 'FeeTax', label: 'Fee / tax' },
]

const today = () => {
  const value = new Date()
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const numberOrUndefined = (value: string) => value.trim() === '' ? undefined : Number(value)
// Height matches CustomSelect / DatePicker / CurrencySelect (h-10) so every control
// in a modal row lines up and measures the same, whatever kind of input it is.
const inputClass = 'h-10 w-full rounded-xl border border-border/60 bg-background px-3 text-sm text-foreground outline-none focus:border-ring'
const getInputClass = (hasError?: boolean) => hasError ? 'h-10 w-full rounded-xl border border-destructive bg-background px-3 text-sm text-foreground outline-none focus:border-destructive focus:ring-1 focus:ring-destructive transition duration-200' : inputClass
const InputError = ({ error }: { error?: string }) => error ? <p className="text-[11px] text-destructive font-medium mt-1 animate-in fade-in slide-in-from-top-1 duration-150">{error}</p> : null
// One column per control on mobile, aligned rows from `sm` up. `items-start` keeps
// every field pinned to the top of its row so a field with a hint or an error cannot
// shift its neighbours.
const formGridClass = 'grid items-start gap-4 sm:grid-cols-2'
const formGridWideClass = 'grid items-start gap-4 sm:grid-cols-2 lg:grid-cols-4'

/**
 * A single modal field: fixed-height caption, then the control, then optional hint or
 * error. Every field is built this way so controls share one baseline across the row.
 */
const Field = ({ label, hint, error, className = '', plain, children }: {
  label: React.ReactNode
  hint?: string
  error?: string
  className?: string
  /** Set for popover controls (select, date picker) so a caption click cannot re-toggle them. */
  plain?: boolean
  children: React.ReactNode
}) => {
  const Wrapper = plain ? 'div' : 'label'
  return (
    <Wrapper className={`flex min-w-0 flex-col ${className}`}>
      <span className="mb-1.5 block h-4 truncate text-xs font-semibold leading-4 text-muted-foreground">{label}</span>
      {children}
      {error ? <InputError error={error} /> : hint ? <span className="mt-1 block text-[10px] font-normal leading-relaxed text-muted-foreground">{hint}</span> : null}
    </Wrapper>
  )
}
const interactivePanelClass = 'interactive-card app-panel rounded-2xl border border-border/60 bg-card/92'

const money = (value: number, currency: string) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value)

const number = (value: number, digits = 4) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: digits }).format(value)

// A conversion has two legs, so a single signed figure cannot describe it.
const cashFlowAmount = (flow: InvestmentCashFlow, masked: boolean) => {
  if (masked) return '••••'
  const amount = money(Math.abs(flow.amount), flow.currency)
  if (flow.type === 'Deposit') return `+${amount}`
  if (flow.type === 'Withdrawal') return `−${amount}`
  if (flow.toCurrency === undefined || flow.toAmount === undefined) return amount
  return `${amount} → ${money(flow.toAmount, flow.toCurrency)}`
}

export const InvestmentsView: React.FC<InvestmentsViewProps> = ({
  onNavigate,
  autoOpenAddForm,
  onResetAutoOpen,
  onAddFormOpenChange,
  investmentScanDraft,
  failedScanJob,
  activeScanJobIds,
  onInvestmentScanStarted,
  onInvestmentScanCleared,
}) => {
  const { hideSensitive, isOffline, confirm, activeSyncId, investmentOps = [], queueInvestmentMutation = () => undefined } = useAppContext()
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
  const [editingCashFlow, setEditingCashFlow] = useState<InvestmentCashFlow | null>(null)
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
  const pendingCashFlows = useMemo(() => investmentOps
    .filter(operation => operation.entity === 'investmentCashFlow' && operation.type === 'add' && operation.payload)
    .map(operation => ({
      ...(operation.payload as unknown as InvestmentCashFlow),
      id: operation.targetId,
      isPendingSync: true,
    })), [investmentOps])
  const pendingActivities = useMemo(() => investmentOps
    .filter(operation => operation.entity === 'investmentActivity' && operation.type === 'add' && operation.payload)
    .map(operation => ({
      ...(operation.payload as unknown as InvestmentActivity),
      id: operation.targetId,
      isPendingSync: true,
    })), [investmentOps])
  const queueInvestment = async (
    entity: 'investmentAccount' | 'investmentInstrument' | 'investmentActivity' | 'investmentCashFlow',
    type: 'add' | 'update' | 'delete' | 'restore',
    targetId: string,
    payload: Record<string, unknown> | undefined,
  ) => {
    queueInvestmentMutation(entity, type, targetId, payload)
    closePanel()
    return true
  }

  const openPanel = (next: Exclude<Panel, null>, activity: InvestmentActivity | null = null) => {
    setEditingActivity(activity)
    setEditingCashFlow(null)
    setFormKey(value => value + 1)
    setPanel(next)
  }
  const openCashPanel = (flow: InvestmentCashFlow | null = null) => {
    setEditingActivity(null)
    setEditingCashFlow(flow)
    setFormKey(value => value + 1)
    setPanel('cash')
  }
  const closePanel = () => {
    setPanel(null)
    setEditingActivity(null)
    setEditingCashFlow(null)
  }
  useAutoOpenModal(autoOpenAddForm, () => openPanel('activity'), onResetAutoOpen)
  useEffect(() => {
    if (!investmentScanDraft || !['Deposit', 'Withdrawal', 'Conversion'].includes(investmentScanDraft.result.type ?? '')) return
    if (panel === 'cash' && !editingCashFlow) return
    setEditingActivity(null)
    setEditingCashFlow(null)
    setFormKey(value => value + 1)
    setPanel('cash')
  }, [investmentScanDraft, panel, editingCashFlow])
  useEffect(() => {
    onAddFormOpenChange?.((panel === 'activity' && !editingActivity) || (panel === 'cash' && !editingCashFlow))
  }, [panel, editingActivity, editingCashFlow, onAddFormOpenChange])

  if (loading && !portfolio) return <CycleSkeleton variant="investments" />

  const back = () => {
    if (window.history.length > 1) window.history.back()
    else onNavigate('dashboard')
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-clip soft-rise">
      <header className="flex items-start gap-3">
        <button type="button" onClick={back} className="mt-0.5 cursor-pointer rounded-xl border border-border/60 p-2 text-muted-foreground hover:text-foreground" aria-label="Back to Today">
          <ArrowLeft className="size-4" />
        </button>
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">Growth Investments</h1>
          <p className="mt-1 text-xs text-muted-foreground">Track what you own, across any broker.</p>
        </div>
      </header>

      {(isOffline || loadError) && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <CloudOff className="size-4 shrink-0" />
          {isOffline ? 'You are offline, so this is the last saved copy. Edits are queued and prices cannot refresh yet.' : loadError}
        </div>
      )}

      {!portfolio?.marketDataConfigured && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/7 px-4 py-3 text-xs text-muted-foreground">
          Live prices are not switched on yet. You can still add accounts, investments, and activity, but valuations will remain unavailable until market data is configured.
        </div>
      )}

      <BottomSheet isOpen={panel === 'account'} title="Add investment account" onClose={closePanel} maxWidthClassName="max-w-lg">
        <AccountForm key={`account-${formKey}`} appCurrency={portfolio?.appCurrency} busy={busy} onCancel={closePanel} onSave={value => {
          const id = crypto.randomUUID()
          return queueInvestment('investmentAccount', 'add', id, { ...value, id })
        }} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'instrument'} title="Add investment" onClose={closePanel} maxWidthClassName="max-w-2xl">
        <InstrumentForm key={`instrument-${formKey}`} busy={busy} offline={isOffline} onCancel={closePanel} onSave={value => {
          const id = crypto.randomUUID()
          return queueInvestment('investmentInstrument', 'add', id, { ...value, id })
        }} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'activity'} title={editingActivity ? 'Edit investment activity' : 'Add activity'} onClose={closePanel} maxWidthClassName="max-w-3xl">
        <ActivityForm key={`activity-${formKey}`} portfolio={setupPortfolio} initial={editingActivity} pendingActivities={pendingActivities} busy={busy} scanDraft={editingActivity ? null : investmentScanDraft} failedScanJob={failedScanJob} activeScanJobIds={activeScanJobIds} onScanStarted={onInvestmentScanStarted} onScanCleared={onInvestmentScanCleared} onCancel={closePanel} onSave={value => {
          const id = editingActivity?.id ?? crypto.randomUUID()
          return queueInvestment(
            'investmentActivity',
            editingActivity ? 'update' : 'add',
            id,
            { ...value, id, undoSnapshot: editingActivity ?? undefined },
          )
        }} onNeedAccount={() => openPanel('account')} onNeedInstrument={() => openPanel('instrument')} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'cash'} title={editingCashFlow ? 'Edit cash movement' : 'Record cash movement'} onClose={closePanel} maxWidthClassName="max-w-lg">
        <CashForm key={`cash-${formKey}`} portfolio={setupPortfolio} initial={editingCashFlow} pendingCashFlows={pendingCashFlows} busy={busy} scanDraft={editingCashFlow ? null : investmentScanDraft} failedScanJob={failedScanJob} activeScanJobIds={activeScanJobIds} onScanStarted={onInvestmentScanStarted} onScanCleared={onInvestmentScanCleared} onCancel={closePanel} onSave={value => {
          const id = editingCashFlow?.id ?? crypto.randomUUID()
          return queueInvestment(
            'investmentCashFlow',
            editingCashFlow ? 'update' : 'add',
            id,
            { ...value, id, undoSnapshot: editingCashFlow ?? undefined },
          )
        }} onNeedAccount={() => openPanel('account')} />
      </BottomSheet>

      {!portfolio || (portfolio.accounts.length === 0 && portfolio.instruments.length === 0 && (portfolio.activityCount ?? portfolio.activity.length) === 0 && (portfolio.cashFlowCount ?? portfolio.cashFlows.length) === 0) ? (
        <EmptyState
          onAddAccount={() => openPanel('account')}
          onAddInvestment={() => openPanel('instrument')}
        />
      ) : (
        <>
          <SummaryCards portfolio={portfolio} masked={hideSensitive} />
          <ActionToolbar
            portfolio={portfolio}
            isOffline={isOffline}
            refreshing={refreshing}
            onAddActivity={() => openPanel('activity')}
            onManageCash={() => openPanel('cash')}
            onAddAccount={() => openPanel('account')}
            onAddInvestment={() => openPanel('instrument')}
            onUpdatePrices={() => void updatePrices()}
          />
          <InvestmentPlanPanel
            allocation={portfolio.allocation}
            usdRate={portfolio.usdRate}
            masked={hideSensitive}
            onNavigate={onNavigate}
          />
          <AccountsAndInstruments
            portfolio={setupPortfolio ?? portfolio}
            onArchiveAccount={id => {
              const account = portfolio.accounts.find(a => a.id === id)
              if (account) queueInvestment('investmentAccount', 'update', id, { name: account.name, baseCurrency: account.baseCurrency, isArchived: true, undoSnapshot: account })
            }}
            onUnarchiveAccount={(id, name, currency) => queueInvestment('investmentAccount', 'update', id, { name, baseCurrency: currency, isArchived: false })}
            onDeleteAccount={id => {
              const account = portfolio.accounts.find(a => a.id === id)
              confirm({
                title: 'Delete investment account?',
                message: 'Only accounts without activity can be deleted.',
                confirmText: 'Delete',
                onConfirm: () => { queueInvestment('investmentAccount', 'delete', id, { undoSnapshot: account }) },
              })
            }}
            onDeleteInstrument={id => {
              const instrument = portfolio.instruments.find(i => i.id === id)
              confirm({
                title: 'Delete investment?',
                message: 'Only investments without activity can be deleted.',
                confirmText: 'Delete',
                onConfirm: () => { queueInvestment('investmentInstrument', 'delete', id, { undoSnapshot: instrument }) },
              })
            }}
            onArchiveInstrument={id => {
              const instrument = portfolio.instruments.find(value => value.id === id)
              if (instrument) queueInvestment('investmentInstrument', 'update', id, {
                ...instrument,
                isArchived: true,
                undoSnapshot: instrument,
              })
            }}
            onUnarchiveInstrument={id => {
              const instrument = portfolio.instruments.find(value => value.id === id)
              if (instrument) queueInvestment('investmentInstrument', 'update', id, {
                ...instrument,
                isArchived: false,
                undoSnapshot: instrument,
              })
            }}
          />
          {portfolio.warnings.length > 0 && (
            <details className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <summary id="calculation-warnings" className="cursor-pointer text-sm font-bold text-foreground">Why some figures are missing</summary>
              <p className="mt-1 text-[10px] text-muted-foreground">Most clear up after selecting "Update prices".</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {portfolio.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            </details>
          )}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <ValueChart portfolio={portfolio} masked={hideSensitive} range={range} isFetching={loading} onRangeChange={setRange} />
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
              onConfirm: () => { queueInvestment('investmentActivity', 'delete', activity.id, { undoSnapshot: { transactions: [activity] } }) },
            })}
            onEditCashFlow={flow => openCashPanel(flow)}
            onDeleteCashFlow={flow => confirm({
              title: flow.type === 'Conversion'
                ? 'Delete conversion?'
                : flow.type === 'Withdrawal' ? 'Delete withdrawal?' : 'Delete deposit?',
              message: 'The cash balance and total portfolio value will be recalculated.',
              confirmText: 'Delete',
              onConfirm: () => { queueInvestment('investmentCashFlow', 'delete', flow.id, { undoSnapshot: flow }) },
            })}
          />
        </>
      )}
    </div>
  )
}

/**
 * Every page-level action in one place, in the order they are normally used, so
 * nothing looks attached to the plan card above it. The one primary action is the
 * record you add most; the rest share the same ghost pattern, and "Update prices"
 * is separated because it changes market data rather than your records.
 */
const ActionToolbar = ({ portfolio, isOffline, refreshing, onAddActivity, onManageCash, onAddAccount, onAddInvestment, onUpdatePrices }: {
  portfolio: InvestmentPortfolio
  isOffline: boolean
  refreshing: boolean
  onAddActivity: () => void
  onManageCash: () => void
  onAddAccount: () => void
  onAddInvestment: () => void
  onUpdatePrices: () => void
}) => (
  <section aria-label="Investment actions" className="app-panel flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/92 p-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      <Button variant="ghost" disabled={portfolio.accounts.length === 0 || portfolio.instruments.length === 0} onClick={onAddActivity}><Plus className="size-4" /> Add activity</Button>
      <Button variant="ghost" disabled={portfolio.accounts.length === 0} onClick={onManageCash}><Wallet className="size-4" /> Manage cash</Button>
      <Button variant="ghost" onClick={onAddAccount}><Building2 className="size-4" /> Add account</Button>
      <Button variant="ghost" onClick={onAddInvestment}><Search className="size-4" /> Add investment</Button>
    </div>
    <Button
      variant="ghost"
      className="justify-center lg:w-auto"
      disabled={isOffline || refreshing || !portfolio.marketDataConfigured || !portfolio.holdings.length}
      aria-busy={refreshing}
      onClick={onUpdatePrices}
    >
      {refreshing
        ? <><Loader2 className="size-4 animate-spin" /> Updating…</>
        : <><RefreshCw className="size-4" /> Update prices</>}
    </Button>
  </section>
)

const EmptyState = ({ onAddAccount, onAddInvestment }: { onAddAccount: () => void; onAddInvestment: () => void }) => (
  <section className="app-panel rounded-2xl border border-border/60 bg-card/92 px-6 py-14 text-center">
    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500"><TrendingUp className="size-7" /></div>
    <h2 className="mt-5 text-xl font-black text-foreground">Build your investment view</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
      Add an account and record a buy to get started.
    </p>
    <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
      <Button variant="primary" onClick={onAddAccount}><Building2 className="size-4" /> Add account</Button>
      <Button variant="ghost" onClick={onAddInvestment}><Search className="size-4" /> Add investment</Button>
    </div>
  </section>
)

interface SummaryMetric {
  label: string
  value: string
  hint: string
  color?: string
}

const SummaryCards = ({ portfolio, masked }: { portfolio: InvestmentPortfolio; masked: boolean }) => {
  const reduceMotion = useReducedMotion()
  const currency = portfolio.appCurrency
  const format = (value?: number) => value === undefined ? 'Not available yet' : masked ? '••••' : money(value, currency)
  const signed = (value?: number) => value === undefined
    ? 'Not available yet'
    : masked ? '••••' : `${value > 0 ? '+' : ''}${money(value, currency)}`
  const unrealised = portfolio.summary.unrealisedProfitLoss
  const realised = portfolio.summary.realisedProfitLoss
  const daily = portfolio.summary.dailyChange
  const percent = portfolio.summary.unrealisedPercent

  const tone = (value?: number) => {
    if (value === undefined) return 'text-amber-500'
    if (value > 0) return 'text-emerald-500'
    if (value < 0) return 'text-orange-500'
    return 'text-foreground'
  }
  const cardTone = (value?: number) => {
    if (value === undefined || value === 0) return 'bg-card/92 border-border/60'
    return value > 0 ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-orange-500/5 border-orange-500/20'
  }

  const cards: Array<{
    label: string
    hint: string
    bg: string
    hero: { label: string; value: string; color?: string }
    rows: SummaryMetric[]
  }> = [
    {
      label: 'What it is worth',
      hint: `Everything in your broker accounts right now, shown in ${currency}.`,
      bg: 'bg-card/92 border-border/60',
      hero: { label: 'Total today', value: format(portfolio.summary.totalValue), color: portfolio.summary.totalValue === undefined ? 'text-amber-500' : 'text-foreground' },
      rows: [
        { label: 'In investments', value: format(portfolio.summary.marketValue), hint: 'Value of the shares and funds you hold, at their latest prices.' },
        { label: 'In cash', value: format(portfolio.summary.cashValue), hint: 'Uninvested money sitting in your broker accounts.' },
        { label: 'You paid', value: format(portfolio.summary.costBasis), hint: 'What the investments you still hold originally cost you.' },
      ],
    },
    {
      label: 'Money you put in',
      hint: 'How much of your own money has gone towards investing, before any gains.',
      bg: 'bg-blue-500/5 border-blue-500/20',
      hero: { label: 'Sent to broker', value: format(portfolio.summary.netDeposits), color: portfolio.summary.netDeposits === undefined ? 'text-amber-500' : 'text-foreground' },
      rows: [
        { label: 'Set aside to invest', value: format(portfolio.summary.growthContributions ?? 0), hint: 'Total you have earmarked for investing in your budget so far.', color: 'text-blue-500' },
        { label: 'Not yet sent', value: format(portfolio.summary.growthLedgerBalance), hint: 'Money earmarked for investing that is still in your budget, not with the broker.', color: portfolio.summary.growthLedgerBalance >= 0 ? 'text-foreground' : 'text-orange-500' },
      ],
    },
    {
      label: 'Profit and loss',
      hint: 'Your gain or loss so far: what is still on paper, plus what you have already banked.',
      bg: cardTone(unrealised),
      hero: {
        label: 'On paper',
        value: unrealised === undefined || masked
          ? signed(unrealised)
          : `${signed(unrealised)} · ${(percent ?? 0) > 0 ? '+' : ''}${(percent ?? 0).toFixed(1)}%`,
        color: tone(unrealised),
      },
      rows: [
        { label: 'Already banked', value: signed(realised), hint: 'Profit or loss locked in on investments you have sold, after fees and taxes.', color: tone(realised) },
      ],
    },
    {
      label: 'Income and today',
      hint: 'Cash your investments paid you, and how much their value moved today.',
      bg: cardTone(daily),
      hero: { label: 'Change today', value: signed(daily), color: tone(daily) },
      rows: [
        { label: 'Dividends received', value: format(portfolio.summary.netDividends), hint: 'Payouts your investments have paid you, after any tax withheld.' },
      ],
    },
  ]

  return (
    <section aria-label="Investment summary" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, hint, hero, rows, bg }, index) => (
        <m.article
          key={label}
          className={`interactive-card app-panel flex flex-col rounded-2xl border p-4 ${bg}`}
          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: reduceMotion ? 0 : index * 0.035, ease: 'easeOut' }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
            <InfoHint label={label} text={hint} />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">{hero.label}</p>
          <strong className={`block break-words text-xl font-black leading-tight ${hero.color ?? 'text-foreground'}`}>{hero.value}</strong>
          <div className="mt-3 divide-y divide-border/40 border-t border-border/40 pt-1">
            {rows.map(row => (
              <div key={row.label} className="flex items-center justify-between gap-2 py-2">
                <span className="flex min-w-0 items-center gap-0.5 text-[11px] text-muted-foreground">
                  <span className="truncate">{row.label}</span>
                  <InfoHint label={row.label} text={row.hint} />
                </span>
                <strong className={`shrink-0 break-words text-right text-sm ${row.color ?? 'text-foreground'}`}>{row.value}</strong>
              </div>
            ))}
          </div>
        </m.article>
      ))}
    </section>
  )
}

const AccountsAndInstruments = ({
  portfolio,
  onArchiveAccount,
  onUnarchiveAccount,
  onDeleteAccount,
  onDeleteInstrument,
  onArchiveInstrument,
  onUnarchiveInstrument,
}: {
  portfolio: InvestmentPortfolio
  onArchiveAccount: (id: string) => void
  onUnarchiveAccount: (id: string, name: string, currency: string) => void
  onDeleteAccount: (id: string) => void
  onDeleteInstrument: (id: string) => void
  onArchiveInstrument: (id: string) => void
  onUnarchiveInstrument: (id: string) => void
}) => {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'accounts' | 'investments'>('accounts')
  const [query, setQuery] = useState('')
  const matches = (value: string) => value.toLowerCase().includes(query.trim().toLowerCase())
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        className={`${interactivePanelClass} group flex w-full cursor-pointer items-center justify-between p-4 text-left`}
      >
        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <strong className="text-sm text-foreground">Manage portfolio</strong>
          <span className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-600 dark:text-blue-400">{portfolio.accounts.length} ACCOUNT{portfolio.accounts.length === 1 ? '' : 'S'}</span>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-violet-600 dark:text-violet-400">{portfolio.instruments.length} INVESTMENT{portfolio.instruments.length === 1 ? '' : 'S'}</span>
          </span>
        </span>
        <ChevronDown className="size-4 -rotate-90 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground" />
      </button>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Manage portfolio" maxWidthClassName="max-w-2xl">
        <div className="space-y-4">
          <div className="flex rounded-xl bg-muted/40 p-1">
            {([
              ['accounts', `Accounts (${portfolio.accounts.length})`],
              ['investments', `Investments (${portfolio.instruments.length})`],
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
                        onClick={() => onUnarchiveAccount(value.id, value.name, value.baseCurrency)}
                      >
                        Unarchive
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!value.canDelete && !value.canArchive}
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
                    <strong className="flex items-center gap-2 truncate text-xs text-foreground">
                      {value.symbol} · {value.name}
                      {!value.canDelete && !value.canArchive && !value.isArchived && (
                        <span title={value.archiveUnavailableReason} className="flex cursor-help items-center gap-1.5 rounded-md px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/10">
                          <Info className="size-3.5" />
                          <span className="text-[10px] font-medium">Cannot archive</span>
                        </span>
                      )}
                    </strong>
                    <span className="text-[10px] text-muted-foreground">{value.type} · {value.currency} · {value.isCustom ? 'Manual' : value.mic ?? value.exchange ?? 'Provider'}</span>
                  </span>
                  <Button
                    variant={value.isArchived ? 'ghost' : 'danger'}
                    size="sm"
                    disabled={!value.isArchived && !value.canDelete && !value.canArchive}
                    title={value.archiveUnavailableReason}
                    onClick={() => value.isArchived
                      ? onUnarchiveInstrument(value.id)
                      : value.canDelete
                        ? onDeleteInstrument(value.id)
                        : onArchiveInstrument(value.id)}
                  >
                    {value.isArchived ? 'Unarchive' : value.canDelete ? 'Delete' : 'Archive'}
                  </Button>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-muted-foreground">Delete is available when an investment has no history. Once it has activity, close all units to archive it while preserving that history.</p>
          </div>}
        </div>
      </BottomSheet>
    </>
  )
}

const ValueChart = ({ portfolio, masked, range, isFetching, onRangeChange }: { portfolio: InvestmentPortfolio; masked: boolean; range: InvestmentRange; isFetching?: boolean; onRangeChange: (value: InvestmentRange) => void }) => {
  const reduceMotion = useReducedMotion()
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
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
  const selectNearest = (clientX: number) => {
    if (!svgRef.current || portfolio.chart.length === 0 || masked) return
    const rect = svgRef.current.getBoundingClientRect()
    const index = Math.round(((clientX - rect.left) / rect.width) * (portfolio.chart.length - 1))
    setHoveredIndex(Math.max(0, Math.min(portfolio.chart.length - 1, index)))
  }
  const summary = latest
    ? `Latest total portfolio value: ${masked || latest.totalValue === undefined ? 'hidden or incomplete' : money(latest.totalValue, portfolio.appCurrency)}; net deposits ${masked || latest.netDeposits === undefined ? 'hidden or incomplete' : money(latest.netDeposits, portfolio.appCurrency)}.`
    : 'No chart data is available.'
  return (
    <section aria-labelledby="value-chart-title" className="app-panel min-w-0 rounded-2xl border border-border/60 bg-card/92 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="value-chart-title" className="text-base font-bold text-foreground">Portfolio value</h2>
          <p className="mt-1 text-xs text-muted-foreground">Your investments plus cash, over time.</p>
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
        <div className="flex h-60 items-center justify-center text-xs text-muted-foreground">Add some activity to start the history.</div>
      ) : !hasAnyMarketValue ? (
        <div className="flex h-60 flex-col items-center justify-center gap-2 text-center text-xs text-muted-foreground">
          <span className="text-amber-500 font-semibold">Chart unavailable</span>
          <span className="max-w-xs">Some prices are missing. Try "Update prices" or check the investment's market-data mapping.</span>
        </div>
      ) : (
        <div className="relative mt-5">
          {isFetching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-2 rounded-lg bg-background/80 px-4 py-2 shadow-sm backdrop-blur-sm border border-border/50">
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Loading…</span>
              </div>
            </div>
          )}
          <div
            className={`relative cursor-crosshair ${masked || isFetching ? 'select-none blur-md pointer-events-none transition-all duration-200' : 'transition-all duration-200'}`}
            aria-hidden={masked}
            onMouseMove={event => selectNearest(event.clientX)}
            onMouseLeave={() => setHoveredIndex(null)}
            onTouchStart={event => selectNearest(event.touches[0].clientX)}
            onTouchMove={event => selectNearest(event.touches[0].clientX)}
          >
            <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="h-48 w-full overflow-visible sm:h-60" role="img" aria-label={summary}>
            <defs>
              <linearGradient id="investmentValueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--ledger-purple-500)" stopOpacity="0.24" />
                <stop offset="100%" stopColor="var(--ledger-purple-500)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <m.polygon
              key={`investment-area-${range}`}
              points={`0,${height} ${line('totalValue')} ${width},${height}`}
              fill="url(#investmentValueGradient)"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45 }}
            />
            <m.polyline key={`investment-total-${range}`} points={line('totalValue')} fill="none" stroke="var(--ledger-purple-500)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="nonScalingStroke" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }} />
            <m.polyline key={`investment-deposits-${range}`} points={line('netDeposits')} fill="none" stroke="var(--ledger-pending-500)" strokeWidth="2" strokeDasharray="7 6" strokeLinecap="round" strokeLinejoin="round" vectorEffect="nonScalingStroke" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45, delay: 0.08 }} />
            {hoveredIndex !== null && portfolio.chart[hoveredIndex]?.totalValue !== undefined && (
              <>
                <line x1={x(hoveredIndex)} x2={x(hoveredIndex)} y1="0" y2={height} stroke="var(--border)" strokeWidth="1" strokeDasharray="3 4" vectorEffect="nonScalingStroke" />
                <circle cx={x(hoveredIndex)} cy={y(portfolio.chart[hoveredIndex].totalValue!)} r="5" fill="var(--ledger-purple-500)" stroke="var(--card)" strokeWidth="3" vectorEffect="nonScalingStroke" />
              </>
            )}
          </svg>
          {hoveredIndex !== null && portfolio.chart[hoveredIndex] && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute z-20 w-36 rounded-xl border border-border/60 bg-card/95 p-2 text-center shadow-xl backdrop-blur-md"
              style={{ left: `clamp(0px, calc(${portfolio.chart.length <= 1 ? 50 : hoveredIndex / (portfolio.chart.length - 1) * 100}% - 72px), calc(100% - 144px))`, top: 4 }}
            >
              <b className="block text-[10px] text-muted-foreground">{portfolio.chart[hoveredIndex].date}</b>
              <span className="mt-0.5 block text-xs font-black text-violet-500">
                {portfolio.chart[hoveredIndex].totalValue === undefined ? 'Incomplete' : money(portfolio.chart[hoveredIndex].totalValue!, portfolio.appCurrency)}
              </span>
              <span className="block text-[9px] text-muted-foreground">
                Deposits {portfolio.chart[hoveredIndex].netDeposits === undefined ? 'incomplete' : money(portfolio.chart[hoveredIndex].netDeposits!, portfolio.appCurrency)}
              </span>
            </div>
          )}
          </div>
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
  // Keep adjacent slices visually distinct in both themes. These are theme tokens,
  // not literals, so the ramp follows the active palette; the hue *order* is what
  // guarantees neighbouring slices separate, so reorder with care.
  const colors = [
    'var(--ledger-purple-500)',
    'var(--ledger-sky-500)',
    'var(--ledger-pending-500)',
    'var(--ledger-expense-500)',
    'var(--ledger-income-500)',
    'var(--ledger-blue-500)',
    'var(--ledger-wishlist-500)',
    'var(--ledger-neutral-500)',
  ]
  const slices = groups.map(([name, value], index) => ({
    key: name,
    label: name,
    value,
    color: colors[index % colors.length],
  }))
  const allocationModeOptions: Array<{ value: AllocationMode; label: string }> = [
    { value: 'instrument', label: 'Instrument' },
    { value: 'asset', label: 'Asset type' },
    { value: 'account', label: 'Account' },
  ]
  const selectedKey = selected?.mode === mode ? selected.key : undefined
  const selectSlice = (name: string) => {
    if (name === 'Cash' && mode !== 'account') {
      onSelect(null)
      return
    }
    const key = mode === 'instrument' ? name.split(' · ')[0] : name
    onSelect(selected?.mode === mode && selected.key === key ? null : { mode, key })
  }
  return (
    <section aria-labelledby="allocation-title" className="app-panel min-w-0 flex flex-col rounded-2xl border border-border/60 bg-card/92 p-5">
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
      <div className="mt-5 flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden sm:flex-row lg:flex-col lg:justify-start">
        {groups.length > 0 ? (
          <InteractiveDoughnutChart
            key={mode}
            slices={slices}
            ariaLabel={groups.map(([name, value]) => `${name} ${total ? (value / total * 100).toFixed(1) : 0}%`).join(', ')}
            centerLabel="Total"
            centerValue={money(total, portfolio.appCurrency)}
            formatValue={value => money(value, portfolio.appCurrency)}
            masked={masked}
            selectedKey={mode === 'instrument'
              ? slices.find(slice => slice.label.startsWith(`${selectedKey} ·`))?.key
              : selectedKey}
            onActivate={slice => selectSlice(slice.label)}
            chartClassName="mx-auto aspect-square w-full max-w-52 sm:mx-0 sm:w-48 lg:mx-auto lg:w-56 lg:max-w-56"
            legendClassName="w-full min-w-0 flex-1 overflow-hidden space-y-1 lg:flex-none"
          />
        ) : <p className="text-xs text-muted-foreground">Add prices to see allocation.</p>}
      </div>
      {selected && <p className="mt-3 text-[10px] text-muted-foreground">Selected: {selected.key}. The holdings table is filtered to this allocation.</p>}
    </section>
  )
}

const PerformanceBars = ({ portfolio, masked }: { portfolio: InvestmentPortfolio; masked: boolean }) => {
  const reduceMotion = useReducedMotion()
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
              <m.div
                className={`absolute top-0 h-full rounded-full ${(holding.unrealisedPercent ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${Math.abs(holding.unrealisedPercent ?? 0) / scale * 50}%` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                style={(holding.unrealisedPercent ?? 0) >= 0 ? { left: '50%' } : { right: '50%' }}
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
    (filter.mode === 'asset' ? holding.type === filter.key :
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
    <div className="p-5"><h2 id="holdings-title" className="text-base font-bold text-foreground">Holdings by account</h2><p className="mt-1 text-xs text-muted-foreground">Recording a buy places a reusable investment in an account.{filter ? ` Filtered by ${filter.key}.` : ''}</p></div>
    <div className="grid gap-3 px-3 pb-3 sm:grid-cols-2 lg:grid-cols-3">
      {accountGroups.map(({ account, holdings: accountHoldings, cash, total }) => (
        <article key={account.id} className="interactive-card rounded-xl border border-border/50 bg-muted/15 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><h3 className="truncate text-sm font-bold">{account.name}</h3><p className="text-[10px] text-muted-foreground">Base currency {account.baseCurrency} · {accountHoldings.length} holding{accountHoldings.length === 1 ? '' : 's'}</p></div>
            <strong className="shrink-0 text-xs">{masked ? '••••' : total === undefined ? 'Incomplete FX' : money(total, portfolio.appCurrency)}</strong>
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
            <strong className="shrink-0 text-sm">{masked ? '••••' : holding.valueApp === undefined ? 'Incomplete FX' : money(holding.valueApp, portfolio.appCurrency)}</strong>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
            <div><dt className="text-muted-foreground">Units</dt><dd className="break-words font-semibold">{masked ? '••••' : number(holding.units, 8)}</dd></div>
            <div><dt className="text-muted-foreground">Close</dt><dd className="break-words font-semibold">{masked || holding.latestPriceNative === undefined ? '—' : money(holding.latestPriceNative, holding.currency)}</dd></div>
            <div><dt className="text-muted-foreground">Native value</dt><dd className="break-words font-semibold">{masked || holding.valueNative === undefined ? '—' : money(holding.valueNative, holding.currency)}</dd></div>
            <div><dt className="text-muted-foreground">FX rate</dt><dd className="break-words font-semibold">{holding.fxRate === undefined ? 'Missing' : number(holding.fxRate, 8)}</dd></div>
          </dl>
          <details className="mt-3 group rounded-lg border border-border/50 bg-muted/20">
            <summary className="flex cursor-pointer select-none items-center justify-between p-2.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground outline-none transition-colors hover:bg-muted/30">
              <span>Valuation Details</span>
              <ChevronDown className="size-3.5 transition-transform duration-200 group-open:rotate-180" />
            </summary>
            <div className="border-t border-border/50 p-2.5 pt-2 text-[10px] text-muted-foreground">
              <p className="break-words font-medium text-foreground/80">
                {holding.latestPriceNative === undefined ? 'Closing price unavailable' : `${number(holding.units, 8)} × ${number(holding.latestPriceNative, 8)} ${holding.currency}`}
                {holding.currency !== portfolio.appCurrency ? ` × ${holding.fxRate === undefined ? 'missing FX' : number(holding.fxRate, 8)} = ${holding.valueApp === undefined ? 'incomplete' : money(holding.valueApp, portfolio.appCurrency)}` : ''}
              </p>
              <div className="mt-2 space-y-1 text-[9px]">
                <div className="flex justify-between gap-2"><span className="opacity-70">Price Source</span><span className="text-right">{holding.priceSource ?? 'Price source unavailable'} · {holding.priceDate ?? 'No date'}</span></div>
                {holding.fxSource && <div className="flex justify-between gap-2"><span className="opacity-70">FX Source</span><span className="text-right">{holding.fxSource} · {holding.fxDate ?? 'No date'}</span></div>}
              </div>
            </div>
          </details>
        </article>
      ))}
    </div>
    <div className="hidden overflow-x-auto lg:block">
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
              <td className="px-4 py-3 text-right">{masked ? '••••' : holding.latestPriceNative === undefined ? 'Unavailable' : money(holding.latestPriceNative, holding.currency)}</td>
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
  onEditCashFlow,
  onDeleteCashFlow,
}: {
  portfolio: InvestmentPortfolio
  masked: boolean
  refreshToken: number
  operations: import('../lib/outbox').QueuedOp[]
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
  const activeOperation = projectedOperations.find(operation => operation.targetId === activeSyncId)
  const activeLabel = activeOperation?.type === 'delete' ? 'Deleting…'
    : activeOperation?.type === 'restore' ? 'Undoing…'
    : activeOperation?.type === 'add' ? 'Saving…'
    : activeOperation ? 'Syncing…' : null
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
                  const isActive = activeSyncId === value.id
                  const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                  return <article key={value.id} className="interactive-card min-w-0 rounded-xl border border-border/50 p-3">
                    <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><strong className="block truncate text-xs">{activityTypes.find(item => item.value === value.type)?.label} · {instrument?.symbol}</strong><span className="text-[10px] text-muted-foreground">{value.tradeDate} · {accounts.get(value.accountId)}</span><RowSyncStatus entityLabel="investment activity" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></div><span className="shrink-0 text-xs font-bold">{masked || value.cashAmount === undefined ? '—' : money(value.cashAmount, instrument?.currency ?? portfolio.appCurrency)}</span></div>
                    <div className="mt-2 flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEdit(value)}>Edit</Button>
                      <Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDelete(value)}>Delete</Button>
                    </div>
                  </article>
                }) : displayCashFlows.map(value => {
                  const isActive = activeSyncId === value.id
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
                <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full text-left text-xs">
                    <thead className="border-y border-border/50 bg-muted/25 text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Account</th>{mode === 'investments' && <th className="px-4 py-3">Investment</th>}<th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3" /></tr></thead>
                    <tbody className="divide-y divide-border/40">{mode === 'investments' ? displayTransactions.map(value => {
                      const isActive = activeSyncId === value.id
                      const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                      return <tr key={value.id}><td className="px-4 py-3">{value.tradeDate}</td><td className="px-4 py-3"><span className="flex items-center gap-2 font-bold">{activityTypes.find(item => item.value === value.type)?.label}<RowSyncStatus entityLabel="investment activity" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></span></td><td className="px-4 py-3">{accounts.get(value.accountId)}</td><td className="px-4 py-3">{instruments.get(value.instrumentId)?.symbol}</td><td className="px-4 py-3 text-right">{masked || value.cashAmount === undefined ? '—' : money(value.cashAmount, instruments.get(value.instrumentId)?.currency ?? portfolio.appCurrency)}</td><td className="px-4 py-3"><span className="flex justify-end gap-1"><Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEdit(value)}>Edit</Button><Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDelete(value)}>Delete</Button></span></td></tr>
                    }) : displayCashFlows.map(value => {
                      const isActive = activeSyncId === value.id
                      const isBusy = Boolean(value.isPendingSync || value.isPendingDelete || isActive)
                      return <tr key={value.id}><td className="px-4 py-3">{value.date}</td><td className="px-4 py-3"><span className="flex items-center gap-2 font-bold">{value.type}<RowSyncStatus entityLabel="cash movement" isDeleting={value.isPendingDelete} isSyncing={isActive} isPending={value.isPendingSync && !isActive} /></span></td><td className="px-4 py-3">{accounts.get(value.accountId)}</td><td className="px-4 py-3 text-right">{cashFlowAmount(value, masked)}</td><td className="px-4 py-3"><span className="flex justify-end gap-1"><Button variant="ghost" size="sm" disabled={isBusy} onClick={() => onEditCashFlow(value)}>Edit</Button><Button variant="danger" size="sm" disabled={isBusy} onClick={() => onDeleteCashFlow(value)}>Delete</Button></span></td></tr>
                    })}</tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
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

const AccountForm = ({ appCurrency = 'USD', busy, onCancel, onSave }: { appCurrency?: string; busy: boolean; onCancel: () => void; onSave: (value: api.AccountMutation) => Promise<boolean> }) => {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState(appCurrency)
  const [errors, setErrors] = useState<Record<string, string>>({})
  return <form noValidate className="space-y-4" onSubmit={event => {
    event.preventDefault();
    if (!name.trim()) { setErrors({ name: 'Account name is required.' }); return; }
    setErrors({})
    void onSave({ name, baseCurrency: currency }) 
  }}>
    <div className={formGridClass}>
      <Field label="Account name" error={errors.name}><input maxLength={120} value={name} onChange={event => { setName(event.target.value); setErrors({}) }} placeholder="e.g. Moomoo" className={getInputClass(!!errors.name)} /></Field>
      <Field label="Base currency" plain><CurrencySelect value={currency} onChange={setCurrency} className="w-full" ariaLabel="Base currency" /></Field>
    </div>
    <p className="text-[10px] text-muted-foreground">A display name only — no broker login is stored.</p>
    <FormActions busy={busy} onCancel={onCancel} submitLabel="Add account" />
  </form>
}

const InstrumentForm = ({ busy, offline, onCancel, onSave }: { busy: boolean; offline: boolean; onCancel: () => void; onSave: (value: api.InstrumentMutation) => Promise<boolean> }) => {
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<InstrumentSearchResult[]>([])
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<InstrumentSearchResult | null>(null)
  useEffect(() => {
    if (offline || query.trim().length < 3) {
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
  }, [query, offline])
  return <div className="space-y-4">
    <>
      <Field label="Symbol or company / fund name"><span className="relative block"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><input value={query} onChange={event => { setQuery(event.target.value); setSelected(null) }} placeholder="Search at least 3 characters" className={`${inputClass} pl-9`} />{searching && <Loader2 className="absolute right-3 top-3 size-4 animate-spin text-blue-500" />}</span></Field>
      {message && <p className="text-xs text-muted-foreground">{message}</p>}
      {selected ? (
        <div className="rounded-xl border border-blue-500 bg-blue-500/5 p-3">
          <div className="flex items-start justify-between gap-3"><span className="min-w-0"><strong className="block text-sm">{selected.symbol} · {selected.name}</strong><span className="mt-1 block text-[10px] text-muted-foreground">{[selected.exchange, selected.mic, selected.currency, selected.country].filter(Boolean).join(' · ')}</span></span><Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>Change</Button></div>
        </div>
      ) : <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
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
    </>
  </div>
}

const ActivityForm = ({ portfolio, initial, pendingActivities, busy, scanDraft, failedScanJob, activeScanJobIds = [], onScanStarted, onScanCleared, onCancel, onSave, onNeedAccount, onNeedInstrument }: {
  portfolio: InvestmentPortfolio | null
  initial: InvestmentActivity | null
  pendingActivities: InvestmentActivity[]
  busy: boolean
  scanDraft?: { jobId: string; result: InvestmentActivityScanResult } | null
  failedScanJob?: { jobId: string; errorMessage: string } | null
  activeScanJobIds?: string[]
  onScanStarted?: (scanId: string) => void
  onScanCleared?: (scanId: string) => void | Promise<void>
  onCancel: () => void
  onSave: (value: api.InvestmentActivityMutation) => Promise<boolean>
  onNeedAccount: () => void
  onNeedInstrument: () => void
}) => {
  const accounts = portfolio?.accounts.filter(value => !value.isArchived) ?? []
  const instruments = portfolio?.instruments.filter(value => !value.isArchived) ?? []
  const [type, setType] = useState<InvestmentTransactionType>(initial?.type ?? 'Buy')
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [instrumentId, setInstrumentId] = useState(initial?.instrumentId ?? instruments[0]?.id ?? '')
  const [tradeDate, setTradeDate] = useState(initial?.tradeDate ?? today())
  const [units, setUnits] = useState(initial?.units ? String(initial.units) : '')
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice ? String(initial.unitPrice) : '')
  const [cashAmount, setCashAmount] = useState(initial?.cashAmount ? String(initial.cashAmount) : '')
  const [fees, setFees] = useState(String(initial?.fees ?? 0))
  const [taxes, setTaxes] = useState(String(initial?.taxes ?? 0))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanBanner, setShowScanBanner] = useState(false)
  const [showScanPicker, setShowScanPicker] = useState(false)
  const [activeScanJobId, setActiveScanJobId] = useState<string | null>(null)
  const scanFileInputRef = useRef<HTMLInputElement>(null)
  const scanGalleryInputRef = useRef<HTMLInputElement>(null)
  const appliedScanJobRef = useRef<string | null>(null)
  const trackedScanJobsRef = useRef<Set<string>>(new Set())
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
  const clearScan = () => {
    const jobId = activeScanJobId
    setActiveScanJobId(null)
    setIsScanning(false)
    setScanError(null)
    setShowScanBanner(false)
    if (jobId) {
      trackedScanJobsRef.current.delete(jobId)
      void onScanCleared?.(jobId)
    }
  }
  const handleScan = async (file: File) => {
    setIsScanning(true)
    setScanError(null)
    setShowScanBanner(false)
    try {
      const started = await api.startInvestmentScan(file)
      setActiveScanJobId(started.scanId)
      onScanStarted?.(started.scanId)
    } catch (error) {
      setScanError(getErrorMessage(error, 'Could not scan this investment image. Please try a clearer image.'))
      setIsScanning(false)
    } finally {
      if (scanFileInputRef.current) scanFileInputRef.current.value = ''
      if (scanGalleryInputRef.current) scanGalleryInputRef.current.value = ''
    }
  }
  useEffect(() => {
    if (!scanDraft || appliedScanJobRef.current === scanDraft.jobId) return
    appliedScanJobRef.current = scanDraft.jobId
    setActiveScanJobId(scanDraft.jobId)
    setIsScanning(false)
    setShowScanBanner(true)
    const result = scanDraft.result
    const scannedActivityType = activityTypes.find(value => value.value === result.type)?.value
    if (scannedActivityType) setType(scannedActivityType)
    if (result.accountId && accounts.some(value => value.id === result.accountId)) setAccountId(result.accountId)
    if (result.instrumentId && instruments.some(value => value.id === result.instrumentId)) setInstrumentId(result.instrumentId)
    if (result.tradeDate) setTradeDate(result.tradeDate)
    if (result.units != null) setUnits(String(result.units))
    if (result.unitPrice != null) setUnitPrice(String(result.unitPrice))
    if (result.cashAmount != null) setCashAmount(String(result.cashAmount))
    if (result.fees != null) setFees(String(result.fees))
    if (result.taxes != null) setTaxes(String(result.taxes))
    const supplied = [
      result.units != null ? 'units' as const : null,
      result.unitPrice != null ? 'price' as const : null,
      result.cashAmount != null ? 'gross' as const : null,
    ].filter((value): value is 'units' | 'price' | 'gross' => value !== null)
    editOrder.current = supplied.length === 2 ? supplied : []
  }, [scanDraft, accounts, instruments])
  useEffect(() => {
    if (failedScanJob?.jobId !== activeScanJobId) return
    setScanError(failedScanJob.errorMessage)
    setIsScanning(false)
    trackedScanJobsRef.current.delete(failedScanJob.jobId)
    setActiveScanJobId(null)
  }, [failedScanJob, activeScanJobId])
  useEffect(() => {
    if (!activeScanJobId) return
    if (activeScanJobIds.includes(activeScanJobId)) {
      trackedScanJobsRef.current.add(activeScanJobId)
      return
    }
    if (scanDraft?.jobId === activeScanJobId || !trackedScanJobsRef.current.has(activeScanJobId)) return
    trackedScanJobsRef.current.delete(activeScanJobId)
    setIsScanning(false)
    setActiveScanJobId(null)
  }, [activeScanJobId, activeScanJobIds, scanDraft])
  useEffect(() => {
    if (!['Buy', 'Sell'].includes(type)) return
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
  const trade = ['Buy', 'Sell'].includes(type)
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    let numFields = 0
    if (numberOrUndefined(units) !== undefined) numFields++
    if (numberOrUndefined(unitPrice) !== undefined) numFields++
    if (numberOrUndefined(cashAmount) !== undefined) numFields++
    if (trade && numFields < 2) {
      setErrors({ form: 'Enter any two of units, unit price, and gross amount; the missing value is calculated.' })
      return
    }
    if (type === 'Dividend' && numberOrUndefined(cashAmount) === undefined) {
      setErrors({ cashAmount: 'Gross dividend is required.' })
      return
    }
    // Cash and units are checked before queueing, so an impossible record is never
    // sent and the reason lands on the field that caused it.
    const issue = validateActivityBalances(portfolio, {
      type,
      accountId,
      instrumentId,
      units: numberOrUndefined(units),
      cashAmount: numberOrUndefined(cashAmount),
      fees: Number(fees || 0),
      taxes: Number(taxes || 0),
    }, initial, pendingActivities)
    if (issue) {
      setErrors({ [issue.field]: issue.message })
      return
    }
    setErrors({})
    void onSave({
      accountId, instrumentId, type, tradeDate,
      units: numberOrUndefined(units), unitPrice: numberOrUndefined(unitPrice), cashAmount: numberOrUndefined(cashAmount),
      fees: Number(fees || 0), taxes: Number(taxes || 0),
    }).then(saved => {
      if (saved) clearScan()
    })
  }
  const feesLabelSuffix = selectedInstrument ? ` (${selectedInstrument.currency})` : ''
  const heldUnits = availableActivityUnits(portfolio, accountId, instrumentId, pendingActivities)
  const heldCash = selectedInstrument ? availableActivityCash(portfolio, accountId, selectedInstrument.currency, pendingActivities) : 0
  return <form noValidate onSubmit={submit} className="space-y-4">
    {!initial && <>
      <ReceiptScanPicker
        isScanning={isScanning}
        showScanPicker={showScanPicker}
        setShowScanPicker={setShowScanPicker}
        scanFileInputRef={scanFileInputRef}
        scanGalleryInputRef={scanGalleryInputRef}
        handleScanReceipt={handleScan}
        setScanError={setScanError}
        label="Scan investment activity"
        scanningLabel="Scanning investment activity..."
      />
      <ReceiptScanStatus
        showScanBanner={showScanBanner}
        setShowScanBanner={setShowScanBanner}
        scanError={scanError}
        setScanError={setScanError}
        successMessage="Investment activity scanned — review fields below and edit as needed"
      />
    </>}
    <div className={formGridWideClass}>
    <Field label="Activity type" plain><CustomSelect value={type} onChange={v => setType(v as InvestmentTransactionType)} options={activityTypes.map(t => ({ value: t.value, label: t.label }))} ariaLabel="Activity type" className="w-full" /></Field>
    <Field label="Account" plain><CustomSelect value={accountId} onChange={v => setAccountId(v as string)} options={accounts.map(a => ({ value: a.id, label: a.name }))} ariaLabel="Account" className="w-full" /></Field>
    <Field label="Investment" plain><CustomSelect value={instrumentId} onChange={v => setInstrumentId(v as string)} options={instruments.map(i => ({ value: i.id, label: `${i.symbol} · ${i.name}` }))} ariaLabel="Investment" className="w-full" /></Field>
    <Field label="Trade date" plain><DatePicker value={tradeDate} onChange={setTradeDate} max={today()} className="w-full" /></Field>
    {needsUnits && <Field label="Units" error={errors.units} hint={type === 'Sell' ? `${number(heldUnits, 8)} units held` : undefined}><input type="number" min="0" step="0.0000000001" value={units} onChange={event => { noteEdit('units'); setUnits(event.target.value); setErrors(prev => ({ ...prev, units: '', form: '' })) }} className={getInputClass(!!errors.units)} /></Field>}
    {trade && <Field label={`Unit price (${selectedInstrument?.currency})`} error={errors.unitPrice}><input type="number" min="0" step="0.0000000001" value={unitPrice} onChange={event => { noteEdit('price'); setUnitPrice(event.target.value); setErrors(prev => ({ ...prev, unitPrice: '', form: '' })) }} className={getInputClass(!!errors.unitPrice)} /></Field>}
    <Field label={`${type === 'Dividend' ? 'Gross dividend' : type === 'FeeTax' ? 'Charge amount' : 'Gross amount'} (${selectedInstrument?.currency})`} error={errors.cashAmount} hint={['Buy', 'FeeTax'].includes(type) && selectedInstrument ? `${money(Math.max(heldCash, 0), selectedInstrument.currency)} cash available` : undefined}><input type="number" min={type === 'Dividend' ? '0.0000000001' : '0'} step="0.0000000001" value={cashAmount} onChange={event => { noteEdit('gross'); setCashAmount(event.target.value); setErrors(prev => ({ ...prev, cashAmount: '', form: '' })) }} className={getInputClass(!!errors.cashAmount)} /></Field>
    {type !== 'FeeTax' && <>
      <Field label={`Fees${feesLabelSuffix}`}><input type="number" min="0" step="0.0000000001" value={fees} onChange={event => setFees(event.target.value)} className={inputClass} /></Field>
      <Field label={`Taxes${feesLabelSuffix}`}><input type="number" min="0" step="0.0000000001" value={taxes} onChange={event => setTaxes(event.target.value)} className={inputClass} /></Field>
    </>}
    </div>
    {trade && <p className="text-[10px] text-muted-foreground">Fill any two of units, unit price, and gross amount — the third is worked out for you.</p>}
    {selectedInstrument && selectedInstrument.currency !== portfolio?.appCurrency && <p className="text-[10px] text-muted-foreground">Amounts stay in {selectedInstrument.currency} and are reported in {portfolio?.appCurrency} at that date's market rate. Use "Manage cash" to convert cash into {selectedInstrument.currency} before trading.</p>}
    {errors.form && <p className="text-[11px] text-destructive font-medium animate-in fade-in slide-in-from-top-1 duration-150">{errors.form}</p>}
    <FormActions busy={busy} onCancel={() => { clearScan(); onCancel() }} submitLabel="Save activity" />
  </form>
}

const CashForm = ({ portfolio, initial, pendingCashFlows, busy, scanDraft, failedScanJob, activeScanJobIds = [], onScanStarted, onScanCleared, onCancel, onSave, onNeedAccount }: {
  portfolio: InvestmentPortfolio | null
  initial?: InvestmentCashFlow | null
  pendingCashFlows?: InvestmentCashFlow[]
  busy: boolean
  scanDraft?: { jobId: string; result: InvestmentActivityScanResult } | null
  failedScanJob?: { jobId: string; errorMessage: string } | null
  activeScanJobIds?: string[]
  onScanStarted?: (scanId: string) => void
  onScanCleared?: (scanId: string) => void | Promise<void>
  onCancel: () => void
  onSave: (value: { accountId: string; currency: string; type: 'Deposit' | 'Withdrawal' | 'Conversion'; amount: number; date: string; toCurrency?: string; toAmount?: number }) => Promise<boolean>
  onNeedAccount: () => void
}) => {
  const accounts = portfolio?.accounts.filter(value => !value.isArchived) ?? []
  const [accountId, setAccountId] = useState(initial?.accountId ?? accounts[0]?.id ?? '')
  const [type, setType] = useState<'Deposit' | 'Withdrawal' | 'Conversion'>(initial?.type ?? 'Deposit')
  const [currency, setCurrency] = useState(initial?.currency ?? accounts[0]?.baseCurrency ?? portfolio?.appCurrency ?? 'USD')
  const [amount, setAmount] = useState(initial?.amount ? String(Math.abs(initial.amount)) : '')
  const [toCurrency, setToCurrency] = useState(initial?.toCurrency ?? currency)
  const [toAmount, setToAmount] = useState(initial?.toAmount ? String(initial.toAmount) : '')
  const [date, setDate] = useState(initial?.date ?? today())
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [showScanBanner, setShowScanBanner] = useState(false)
  const [showScanPicker, setShowScanPicker] = useState(false)
  const [activeScanJobId, setActiveScanJobId] = useState<string | null>(null)
  const scanFileInputRef = useRef<HTMLInputElement>(null)
  const scanGalleryInputRef = useRef<HTMLInputElement>(null)
  const appliedScanJobRef = useRef<string | null>(null)
  const trackedScanJobsRef = useRef<Set<string>>(new Set())
  const clearScan = () => {
    const jobId = activeScanJobId
    setActiveScanJobId(null)
    setIsScanning(false)
    setScanError(null)
    setShowScanBanner(false)
    if (jobId) {
      trackedScanJobsRef.current.delete(jobId)
      void onScanCleared?.(jobId)
    }
  }
  const handleScan = async (file: File) => {
    setIsScanning(true)
    setScanError(null)
    setShowScanBanner(false)
    try {
      const started = await api.startInvestmentScan(file)
      setActiveScanJobId(started.scanId)
      onScanStarted?.(started.scanId)
    } catch (error) {
      setScanError(getErrorMessage(error, 'Could not scan this cash movement. Please try a clearer image.'))
      setIsScanning(false)
    } finally {
      if (scanFileInputRef.current) scanFileInputRef.current.value = ''
      if (scanGalleryInputRef.current) scanGalleryInputRef.current.value = ''
    }
  }
  useEffect(() => {
    if (!scanDraft || appliedScanJobRef.current === scanDraft.jobId) return
    const result = scanDraft.result
    if (!result.type || !['Deposit', 'Withdrawal', 'Conversion'].includes(result.type)) return
    appliedScanJobRef.current = scanDraft.jobId
    setActiveScanJobId(scanDraft.jobId)
    setIsScanning(false)
    setShowScanBanner(true)
    setType(result.type as 'Deposit' | 'Withdrawal' | 'Conversion')
    if (result.accountId && accounts.some(value => value.id === result.accountId)) setAccountId(result.accountId)
    if (result.currency) setCurrency(result.currency)
    if (result.cashAmount != null) setAmount(String(result.cashAmount))
    if (result.toCurrency) setToCurrency(result.toCurrency)
    if (result.toAmount != null) setToAmount(String(result.toAmount))
    if (result.tradeDate) setDate(result.tradeDate)
  }, [scanDraft, accounts])
  useEffect(() => {
    if (failedScanJob?.jobId !== activeScanJobId) return
    setScanError(failedScanJob.errorMessage)
    setIsScanning(false)
    trackedScanJobsRef.current.delete(failedScanJob.jobId)
    setActiveScanJobId(null)
  }, [failedScanJob, activeScanJobId])
  useEffect(() => {
    if (!activeScanJobId) return
    if (activeScanJobIds.includes(activeScanJobId)) {
      trackedScanJobsRef.current.add(activeScanJobId)
      return
    }
    if (scanDraft?.jobId === activeScanJobId || !trackedScanJobsRef.current.has(activeScanJobId)) return
    trackedScanJobsRef.current.delete(activeScanJobId)
    setIsScanning(false)
    setActiveScanJobId(null)
  }, [activeScanJobId, activeScanJobIds, scanDraft])
  if (!accounts.length) return <div><p className="text-sm text-muted-foreground">Add an investment account before recording cash.</p><div className="mt-4"><Button onClick={onNeedAccount}>Add account</Button></div></div>
  const heldCash = availableCash(portfolio, accountId, currency) + (pendingCashFlows ?? [])
    .filter(flow => flow.accountId === accountId && flow.currency.toUpperCase() === currency.toUpperCase() && flow.id !== initial?.id)
    .reduce((total, flow) => total + (flow.type === 'Deposit' ? Math.abs(flow.amount) : flow.type === 'Withdrawal' ? -Math.abs(flow.amount) : -Math.abs(flow.amount)), 0)
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (type === 'Conversion') {
      if (!(numberOrUndefined(amount)! > 0)) { setErrors({ amount: 'Enter a positive from amount.' }); return; }
      if (!(numberOrUndefined(toAmount)! > 0)) { setErrors({ toAmount: 'Enter a positive to amount.' }); return; }
    } else {
      if (!(numberOrUndefined(amount)! > 0)) { setErrors({ amount: 'Enter a positive amount.' }); return; }
    }
    // Withdrawals and conversions can only spend cash the account actually holds.
    const issue = validateCashFlowBalances(portfolio, {
      accountId,
      type,
      currency: currency.toUpperCase(),
      amount: numberOrUndefined(amount),
      toCurrency: type === 'Conversion' ? toCurrency.toUpperCase() : undefined,
      toAmount: type === 'Conversion' ? numberOrUndefined(toAmount) : undefined,
    }, initial, pendingCashFlows)
    if (issue) {
      setErrors({ [issue.field]: issue.message })
      return
    }
    setErrors({})
    void onSave({
      accountId,
      currency: currency.toUpperCase(),
      type,
      amount: Number(amount || 0),
      date, 
      toCurrency: type === 'Conversion' ? toCurrency.toUpperCase() : undefined,
      toAmount: type === 'Conversion' ? Number(toAmount || 0) : undefined,
    }).then(saved => {
      if (saved) clearScan()
    })
  }
  return <form noValidate onSubmit={submit} className="space-y-4">
    {!initial && <>
      <ReceiptScanPicker
        isScanning={isScanning}
        showScanPicker={showScanPicker}
        setShowScanPicker={setShowScanPicker}
        scanFileInputRef={scanFileInputRef}
        scanGalleryInputRef={scanGalleryInputRef}
        handleScanReceipt={handleScan}
        setScanError={setScanError}
        label="Scan cash movement"
        scanningLabel="Scanning cash movement..."
      />
      <ReceiptScanStatus
        showScanBanner={showScanBanner}
        setShowScanBanner={setShowScanBanner}
        scanError={scanError}
        setScanError={setScanError}
        successMessage="Cash movement scanned — review fields below and edit as needed"
      />
    </>}
    <div className={formGridClass}>
      <Field label="Account" plain><CustomSelect value={accountId} onChange={v => { const id = v as string; setAccountId(id); const next = accounts.find(value => value.id === id); if (next) { setCurrency(next.baseCurrency); if (!initial) setToCurrency(next.baseCurrency) } }} options={accounts.map(a => ({ value: a.id, label: a.name }))} ariaLabel="Account" className="w-full" /></Field>
      <Field label="Type" plain><CustomSelect value={type} onChange={v => setType(v as 'Deposit' | 'Withdrawal' | 'Conversion')} options={[{ value: 'Deposit', label: 'Deposit (cash in)' }, { value: 'Withdrawal', label: 'Withdrawal (cash out)' }, { value: 'Conversion', label: 'Convert currency' }]} ariaLabel="Cash movement type" className="w-full" /></Field>
      {type === 'Conversion' ? (
        <>
          <Field label="From amount" error={errors.amount} hint={`${money(Math.max(heldCash, 0), currency.toUpperCase())} available`}><input type="number" min="0.0000000001" step="0.0000000001" value={amount} onChange={event => { setAmount(event.target.value); setErrors(prev => ({ ...prev, amount: '' })) }} className={getInputClass(!!errors.amount)} /></Field>
          <Field label="From currency" plain><CurrencySelect value={currency} onChange={setCurrency} className="w-full" ariaLabel="From currency" /></Field>
          <Field label="To amount" error={errors.toAmount}><input type="number" min="0.0000000001" step="0.0000000001" value={toAmount} onChange={event => { setToAmount(event.target.value); setErrors(prev => ({ ...prev, toAmount: '' })) }} className={getInputClass(!!errors.toAmount)} /></Field>
          <Field label="To currency" error={errors.toCurrency} plain><CurrencySelect value={toCurrency} onChange={value => { setToCurrency(value); setErrors(prev => ({ ...prev, toCurrency: '' })) }} className="w-full" ariaLabel="To currency" /></Field>
        </>
      ) : (
        <>
          <Field label={`Amount (${currency})`} error={errors.amount} hint={type === 'Withdrawal' ? `${money(Math.max(heldCash, 0), currency.toUpperCase())} available` : undefined}><input type="number" min="0.0000000001" step="0.0000000001" value={amount} onChange={event => { setAmount(event.target.value); setErrors(prev => ({ ...prev, amount: '' })) }} className={getInputClass(!!errors.amount)} /></Field>
          <Field label="Currency" plain><CurrencySelect value={currency} onChange={setCurrency} className="w-full" ariaLabel="Cash currency" /></Field>
        </>
      )}
      <Field label="Date" plain><DatePicker value={date} onChange={setDate} max={today()} className="w-full" /></Field>
    </div>
    <p className="text-[10px] text-muted-foreground">For money moved in or out of the broker account itself, and for converting between currencies before a trade or after a sale. Buys, sells, dividends, and fees adjust cash on their own.</p>
    <FormActions busy={busy} onCancel={() => { clearScan(); onCancel() }} submitLabel={initial ? 'Save changes' : type === 'Conversion' ? 'Record conversion' : type === 'Withdrawal' ? 'Record withdrawal' : 'Record deposit'} disabled={!accountId} />
  </form>
}

export default InvestmentsView
