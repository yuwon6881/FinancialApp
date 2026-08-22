import { Input } from './ui/Input'
import React, { useEffect, useMemo, useState } from 'react'
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
  Sparkles,
} from 'lucide-react'
import type {
  AppTab,
  InvestmentActivity,
  InvestmentCashFlow,
  InvestmentPortfolio,
  InvestmentRange,
} from '../types'
import { useAppContext } from '../contexts/AppContext'
import { Button } from './ui/Button'
import { RowSyncStatus } from './ui/RowSyncBadge'
import { FormField } from './ui/FormField'
import { BottomSheet } from './ui/BottomSheet'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { InfoHint } from './ui/InfoHint'
import { useInvestmentPortfolio } from './investments/useInvestmentPortfolio'
import { applyOpsToList } from '../lib/outbox'
import { formatCurrencyVal } from '../lib/utils'
import type { PendingInvestmentActivity, PendingInvestmentCashFlow } from '../lib/investmentValidation'
import { InvestmentPlanPanel } from './investments/InvestmentPlanPanel'
import { ValueChart } from './investments/InvestmentCharts'
import { AllocationChart } from './investments/AllocationChart'
import type { AllocationFilter } from '../lib/investmentHoldingFilter'
import { PerformanceBars } from './investments/PerformanceBars'
import { HoldingsTable, PagedActivityTable } from './investments/InvestmentTables'
import { HoldingDetailSheet } from './investments/HoldingDetailSheet'
import { InvestmentForecastPanel } from './investments/forecast/InvestmentForecastPanel'
import { AccountForm, ActivityForm, CashForm, InstrumentForm } from './investments/InvestmentForms'
import { useAutoOpenModal } from '../lib/useAutoOpenModal'
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
  onExplainWithAi?: (range: InvestmentRange) => void
}

type Panel = 'account' | 'instrument' | 'activity' | 'cash' | null

const interactivePanelClass = 'interactive-card app-panel rounded-2xl border border-border/60 bg-card/92'

const money = (value: number, currency: string) =>
  formatCurrencyVal(value, currency)


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
  onExplainWithAi,
}) => {
  const { hideSensitive, isOffline, confirm, activeSyncId, activeSyncIds = [], operations = [], queueMutation = () => false } = useAppContext()
  const investmentOps = useMemo(
    () => operations.filter(operation => operation.entity.startsWith('investment')),
    [operations],
  )
  const {
    activityRevision,
    isBackgroundRefreshing,
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
  const [detailHolding, setDetailHolding] = useState<InvestmentPortfolio['holdings'][number] | null>(null)
  // The API supplies both halves of the optional reference-currency pair. An incomplete
  // cached payload must not invent a currency or render a misleading toggle.
  const referenceCurrency = portfolio?.referenceRate !== undefined && portfolio.referenceCurrency
    ? { currency: portfolio.referenceCurrency, rate: portfolio.referenceRate }
    : undefined
  const setupPortfolio = useMemo(() => portfolio ? {
    ...portfolio,
    accounts: applyOpsToList(portfolio.accounts, investmentOps, 'investmentAccount'),
    instruments: applyOpsToList(portfolio.instruments, investmentOps, 'investmentInstrument'),
  } : null, [portfolio, investmentOps])
  const pendingCashFlows = useMemo<PendingInvestmentCashFlow[]>(() => investmentOps
    .filter(operation => operation.entity === 'investmentCashFlow' && ['add', 'update'].includes(operation.type) && operation.payload)
    .map(operation => {
      const current = {
        ...(operation.payload as unknown as InvestmentCashFlow),
        id: operation.targetId,
        isPendingSync: true,
      }
      const original = operation.type === 'update' && operation.payload?.undoSnapshot && typeof operation.payload.undoSnapshot === 'object'
        ? operation.payload.undoSnapshot as unknown as InvestmentCashFlow
        : undefined
      return original ? { ...current, pendingOriginal: original } : current
    }), [investmentOps])
  const pendingActivities = useMemo<PendingInvestmentActivity[]>(() => investmentOps
    .filter(operation => operation.entity === 'investmentActivity' && ['add', 'update'].includes(operation.type) && operation.payload)
    .map(operation => {
      const current = {
        ...(operation.payload as unknown as InvestmentActivity),
        id: operation.targetId,
        isPendingSync: true,
      }
      const original = operation.type === 'update' && operation.payload?.undoSnapshot && typeof operation.payload.undoSnapshot === 'object'
        ? operation.payload.undoSnapshot as unknown as InvestmentActivity
        : undefined
      return original ? { ...current, pendingOriginal: original } : current
    }), [investmentOps])
  const queueInvestment = async (
    entity: 'investmentAccount' | 'investmentInstrument' | 'investmentActivity' | 'investmentCashFlow',
    type: 'add' | 'update' | 'delete' | 'restore',
    targetId: string,
    payload: Record<string, unknown> | undefined,
  ) => {
    if (!queueMutation(entity, type, targetId, payload)) return false
    closePanel()
    return true
  }

  const openPanel = (next: Exclude<Panel, null>, activity: InvestmentActivity | null = null) => {
    if (hideSensitive) return
    setEditingActivity(activity)
    setEditingCashFlow(null)
    setFormKey(value => value + 1)
    setPanel(next)
  }
  const openCashPanel = (flow: InvestmentCashFlow | null = null) => {
    if (hideSensitive) return
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
  useEffect(() => {
    if (!hideSensitive) return
    setPanel(null)
    setEditingActivity(null)
    setEditingCashFlow(null)
    setDetailHolding(null)
  }, [hideSensitive])
  useAutoOpenModal(autoOpenAddForm, () => openPanel('activity'), onResetAutoOpen)
  useEffect(() => {
    if (!investmentScanDraft || !['Deposit', 'Withdrawal', 'Conversion'].includes(investmentScanDraft.result.type ?? '')) return
    if (panel === null) return
    if (panel === 'cash' && !editingCashFlow) return
    // Never throw away an edit in progress for a scan that finished in the background. The
    // banner and the toast action still route it once the user closes the form.
    if (editingActivity || editingCashFlow) return
    setFormKey(value => value + 1)
    setPanel('cash')
  }, [investmentScanDraft, panel, editingActivity, editingCashFlow])
  useEffect(() => {
    onAddFormOpenChange?.((panel === 'activity' && !editingActivity) || (panel === 'cash' && !editingCashFlow))
  }, [panel, editingActivity, editingCashFlow, onAddFormOpenChange])

  if (loading && !portfolio) return <CycleSkeleton variant="investments" />

  const back = () => {
    if (window.history.length > 1) window.history.back()
    else onNavigate('dashboard')
  }

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-clip">
      <header className="flex items-start gap-3">
        <Button
          variant="unstyled"
          type="button"
          onClick={back}
          className="mt-0.5 inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border/60 p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          aria-label="Back to Today"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-foreground">Growth Investments</h1>
            {isBackgroundRefreshing && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-medium text-purple-500 dark:text-purple-300"
              >
                <RefreshCw className="size-3 animate-spin text-purple-500 dark:text-purple-300" />
                <span>Updating prices…</span>
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Track holdings across your brokers.</p>
        </div>
        {onExplainWithAi && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="ml-auto shrink-0"
            onClick={() => onExplainWithAi(range)}
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">Explain my portfolio</span>
          </Button>
        )}
      </header>

      {investmentScanDraft && panel === null && (
        <section aria-labelledby="investment-scan-ready-title" className="app-panel rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="investment-scan-ready-title" className="text-sm font-bold text-foreground">Investment scan ready for review</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">Nothing opens until you choose to review the scanned record.</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => ['Deposit', 'Withdrawal', 'Conversion'].includes(investmentScanDraft.result.type ?? '') ? openCashPanel() : openPanel('activity')}
            >
              Review scan
            </Button>
          </div>
        </section>
      )}

      {(isOffline || loadError) && (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-3 text-xs text-amber-700 dark:text-amber-300">
          <CloudOff className="size-4 shrink-0" />
          {isOffline ? 'Offline: showing saved data. Edits queue; prices cannot refresh.' : loadError}
        </div>
      )}

      {!portfolio?.marketDataConfigured && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/7 px-4 py-3 text-xs text-muted-foreground">
          Live prices are unavailable. You can still record activity; values update when market data is configured.
        </div>
      )}

      <BottomSheet isOpen={panel === 'account'} title="Add investment account" onClose={closePanel} maxWidthClassName="max-w-lg">
        <AccountForm key={`account-${formKey}`} appCurrency={portfolio?.appCurrency} existingAccounts={setupPortfolio?.accounts ?? []} busy={busy} onCancel={closePanel} onSave={value => {
          const id = crypto.randomUUID()
          return queueInvestment('investmentAccount', 'add', id, { ...value, id })
        }} />
      </BottomSheet>
      <BottomSheet isOpen={panel === 'instrument'} title="Add investment" onClose={closePanel} maxWidthClassName="max-w-2xl">
        <InstrumentForm key={`instrument-${formKey}`} busy={busy} offline={isOffline} existingInstruments={setupPortfolio?.instruments ?? []} onCancel={closePanel} onSave={value => {
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
          const amount = value.type === 'Deposit' ? Math.abs(value.amount) : -Math.abs(value.amount)
          return queueInvestment(
            'investmentCashFlow',
            editingCashFlow ? 'update' : 'add',
            id,
            { ...value, amount, id, undoSnapshot: editingCashFlow ?? undefined },
          )
        }} onNeedAccount={() => openPanel('account')} />
      </BottomSheet>

      {!portfolio || ((setupPortfolio?.accounts.length ?? 0) === 0 && (setupPortfolio?.instruments.length ?? 0) === 0 && (portfolio.activityCount ?? portfolio.activity.length) === 0 && (portfolio.cashFlowCount ?? portfolio.cashFlows.length) === 0) ? (
        <EmptyState
          onAddAccount={() => openPanel('account')}
          onAddInvestment={() => openPanel('instrument')}
          mutationsDisabled={hideSensitive}
        />
      ) : (
        <>
          <SummaryCards portfolio={portfolio} masked={hideSensitive} />
          <ActionToolbar
            portfolio={setupPortfolio ?? portfolio}
            isOffline={isOffline}
            refreshing={refreshing}
            mutationsDisabled={hideSensitive}
            onAddActivity={() => openPanel('activity')}
            onManageCash={() => openPanel('cash')}
            onAddAccount={() => openPanel('account')}
            onAddInvestment={() => openPanel('instrument')}
            onUpdatePrices={() => void updatePrices()}
          />
          <InvestmentPlanPanel
            allocation={portfolio.allocation}
            holdings={portfolio.holdings}
            instruments={portfolio.instruments}
            reference={referenceCurrency}
            masked={hideSensitive}
            onNavigate={onNavigate}
          />
          <AccountsAndInstruments
            portfolio={setupPortfolio ?? portfolio}
            mutationsDisabled={hideSensitive}
            onArchiveAccount={id => {
              const account = portfolio.accounts.find(a => a.id === id)
              if (account) queueInvestment('investmentAccount', 'update', id, { name: account.name, baseCurrency: account.baseCurrency, isArchived: true, undoSnapshot: account })
            }}
            onUnarchiveAccount={(id, name, currency) => {
              const account = setupPortfolio?.accounts.find(value => value.id === id)
              return queueInvestment('investmentAccount', 'update', id, {
                name,
                baseCurrency: currency,
                isArchived: false,
                undoSnapshot: account,
              })
            }}
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
            activeSyncIds={activeSyncIds.length > 0 ? activeSyncIds : activeSyncId ? [activeSyncId] : []}
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
          <InvestmentForecastPanel
            key={`${portfolio.summary.totalValue ?? 'incomplete'}-${portfolio.allocation.plan.updatedAt ?? 'default'}-${portfolio.allocation.contributionPlan?.amount ?? 0}-${portfolio.allocation.contributionPlan?.routineContribution ?? 'unknown'}-${portfolio.allocation.contributionPlan?.isEstimated ?? false}`}
            portfolio={portfolio}
            masked={hideSensitive}
          />
          <PerformanceBars portfolio={portfolio} masked={hideSensitive} onSelectHolding={setDetailHolding} />
          <HoldingsTable portfolio={portfolio} masked={hideSensitive} filter={allocationFilter} onSelectHolding={setDetailHolding} />
          <HoldingDetailSheet
            holding={detailHolding}
            appCurrency={portfolio.appCurrency}
            masked={hideSensitive}
            onClose={() => setDetailHolding(null)}
          />
          <PagedActivityTable
            portfolio={setupPortfolio ?? portfolio}
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
const ActionToolbar = ({ portfolio, isOffline, refreshing, mutationsDisabled, onAddActivity, onManageCash, onAddAccount, onAddInvestment, onUpdatePrices }: {
  portfolio: InvestmentPortfolio
  isOffline: boolean
  refreshing: boolean
  mutationsDisabled: boolean
  onAddActivity: () => void
  onManageCash: () => void
  onAddAccount: () => void
  onAddInvestment: () => void
  onUpdatePrices: () => void
}) => (
  <section aria-label="Investment actions" className="app-panel flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/92 p-4 lg:flex-row lg:items-center lg:justify-between">
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:flex lg:flex-wrap">
      <Button variant="ghost" disabled={mutationsDisabled || portfolio.accounts.length === 0 || portfolio.instruments.length === 0} onClick={onAddActivity}><Plus className="size-4" /> Add activity</Button>
      <Button variant="ghost" disabled={mutationsDisabled || portfolio.accounts.length === 0} onClick={onManageCash}><Wallet className="size-4" /> Manage cash</Button>
      <Button variant="ghost" disabled={mutationsDisabled} onClick={onAddAccount}><Building2 className="size-4" /> Add account</Button>
      <Button variant="ghost" disabled={mutationsDisabled} onClick={onAddInvestment}><Search className="size-4" /> Add investment</Button>
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

const EmptyState = ({ onAddAccount, onAddInvestment, mutationsDisabled }: { onAddAccount: () => void; onAddInvestment: () => void; mutationsDisabled: boolean }) => (
  <section className="app-panel rounded-2xl border border-border/60 bg-card/92 px-6 py-14 text-center">
    <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-500"><TrendingUp className="size-7" /></div>
    <h2 className="mt-5 text-xl font-black text-foreground">Build your investment view</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
      Add an account and record a buy to get started.
    </p>
    <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
      <Button variant="primary" onClick={onAddAccount} disabled={mutationsDisabled}><Building2 className="size-4" /> Add account</Button>
      <Button variant="ghost" onClick={onAddInvestment} disabled={mutationsDisabled}><Search className="size-4" /> Add investment</Button>
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
  const currency = portfolio.appCurrency
  const format = (value?: number) => value === undefined ? 'Not available yet' : masked ? '••••' : money(value, currency)
  const signed = (value?: number) => value === undefined
    ? 'Not available yet'
    : masked ? '••••' : `${value > 0 ? '+' : ''}${money(value, currency)}`
  const unrealised = portfolio.summary.unrealisedProfitLoss
  const realised = portfolio.summary.realisedProfitLoss
  const daily = portfolio.summary.dailyChange
  const percent = portfolio.summary.unrealisedPercent
  const annualReturn = portfolio.summary.annualReturn

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

  // "Money sent to broker" compares two independent records of the same money: what the
  // budget earmarked for Growth, and what the broker actually received. The old
  // "Not yet sent" row read the net Growth ledger balance instead of that difference,
  // so it silently meant something else — and could print a figure identical to
  // broker received while the two records were in fact thousands apart. Deriving the
  // gap from the two numbers on the card keeps it self-consistent by construction.
  const earmarked = portfolio.summary.growthContributions ?? 0
  const sentToBroker = portfolio.summary.netDeposits
  const undeployed = sentToBroker === undefined ? undefined : earmarked - sentToBroker
  const deployedPercent = sentToBroker === undefined || earmarked <= 0
    ? undefined
    : Math.max(0, Math.min(999, sentToBroker / earmarked * 100))
  const moneyInRows: SummaryMetric[] = [
    {
      label: 'Set aside to invest',
      value: format(earmarked),
      hint: 'Total your budget has earmarked for investing so far.',
      color: 'text-blue-500',
    },
    undeployed !== undefined && undeployed < -0.005
      ? {
          label: 'More sent than set aside',
          value: format(Math.abs(undeployed)),
          hint: 'Your broker received more than you set aside in Growth.',
          color: 'text-amber-500',
        }
      : {
          label: 'Waiting to be sent',
          value: format(undeployed === undefined ? undefined : Math.max(0, undeployed)),
          hint: 'Earmarked money your broker has not received yet: what you set aside minus what you sent.',
          color: (undeployed ?? 0) > 0.005 ? 'text-foreground' : 'text-emerald-500',
        },
    {
      label: 'Share sent',
      value: deployedPercent === undefined
        ? '—'
        : masked ? '••••' : `${deployedPercent.toFixed(0)}%`,
      hint: 'How much of the money set aside has reached your broker.',
      color: deployedPercent === undefined || deployedPercent >= 95 ? 'text-foreground' : 'text-amber-500',
    },
  ]

  const cards: Array<{
    label: string
    hint: string
    bg: string
    hero: { label: string; value: string; color?: string }
    rows: SummaryMetric[]
  }> = [
    {
      label: 'What it is worth',
      hint: `Latest saved value of your investments and broker cash, shown in ${currency}.`,
      bg: 'bg-card/92 border-border/60',
      hero: { label: 'Latest total', value: format(portfolio.summary.totalValue), color: portfolio.summary.totalValue === undefined ? 'text-amber-500' : 'text-foreground' },
      rows: [
        { label: 'Investments', value: format(portfolio.summary.marketValue), hint: 'Value of the shares and funds you hold, at their latest saved prices.' },
        { label: 'Broker cash', value: format(portfolio.summary.cashValue), hint: 'Money sitting uninvested in your broker accounts.' },
        { label: 'You paid', value: format(portfolio.summary.costBasis), hint: 'What the investments you still hold originally cost you.' },
      ],
    },
    {
      label: 'Money sent to broker',
      hint: 'Tracks money added to and withdrawn from your broker accounts.',
      bg: 'bg-blue-500/5 border-blue-500/20',
      hero: { label: 'Deposits minus withdrawals', value: format(portfolio.summary.netDeposits), color: portfolio.summary.netDeposits === undefined ? 'text-amber-500' : 'text-foreground' },
      rows: moneyInRows,
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
        {
          label: 'Yearly return',
          value: annualReturn === undefined ? 'Not available yet' : masked ? '••••' : `${annualReturn > 0 ? '+' : ''}${(annualReturn * 100).toFixed(1)}% a year`,
          hint: 'Average yearly return, adjusted for when each deposit went in.',
          color: annualReturn === undefined ? undefined : tone(annualReturn),
        },
      ],
    },
    {
      label: 'Income and latest move',
      hint: 'Dividends received, plus the move between the two latest saved market values. It may be from an earlier market day.',
      bg: cardTone(daily),
      hero: { label: 'Latest value move', value: signed(daily), color: tone(daily) },
      rows: [
        { label: 'Dividends received', value: format(portfolio.summary.netDividends), hint: 'Payouts your investments have paid you, after any tax withheld.' },
      ],
    },
  ]

  return (
    <section aria-label="Investment summary" className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map(({ label, hint, hero, rows, bg }, index) => (
        <article
          key={label}
          className={`list-card-enter interactive-card app-panel flex flex-col rounded-2xl border p-4 ${bg}`}
          style={index === 0 ? undefined : { animationDelay: `${index * 35}ms` }}
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
        </article>
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
  activeSyncIds,
  mutationsDisabled,
}: {
  portfolio: InvestmentPortfolio
  onArchiveAccount: (id: string) => void
  onUnarchiveAccount: (id: string, name: string, currency: string) => void
  onDeleteAccount: (id: string) => void
  onDeleteInstrument: (id: string) => void
  onArchiveInstrument: (id: string) => void
  onUnarchiveInstrument: (id: string) => void
  activeSyncIds: string[]
  mutationsDisabled: boolean
}) => {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'accounts' | 'investments'>('accounts')
  const [query, setQuery] = useState('')
  useEffect(() => {
    if (mutationsDisabled) setOpen(false)
  }, [mutationsDisabled])
  const matches = (value: string) => value.toLowerCase().includes(query.trim().toLowerCase())
  return (
    <>
      <Button
        variant="unstyled"
        type="button"
        onClick={() => setOpen(true)}
        disabled={mutationsDisabled}
        aria-expanded={open}
        className={`${interactivePanelClass} group flex w-full cursor-pointer items-center justify-between p-4 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring`}
      >
        <span className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
          <strong className="text-sm text-foreground">Manage portfolio</strong>
          <span className="mt-2 flex flex-wrap items-center gap-2 sm:mt-0">
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-600 dark:text-blue-400">{portfolio.accounts.length} ACCOUNT{portfolio.accounts.length === 1 ? '' : 'S'}</span>
            <span className="rounded-full bg-violet-500/10 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-violet-600 dark:text-violet-400">{portfolio.instruments.length} INVESTMENT{portfolio.instruments.length === 1 ? '' : 'S'}</span>
          </span>
        </span>
        <ChevronDown className="size-4 -rotate-90 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-foreground" />
      </Button>
      <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Manage portfolio" maxWidthClassName="max-w-2xl">
        <div className="space-y-4">
          <div className="flex rounded-xl bg-muted/40 p-1">
            {([
              ['accounts', `Accounts (${portfolio.accounts.length})`],
              ['investments', `Investments (${portfolio.instruments.length})`],
            ] as const).map(([value, label]) => <Button key={value} variant="unstyled" type="button" onClick={() => { setTab(value); setQuery('') }} aria-pressed={tab === value} className={`min-w-0 flex-1 cursor-pointer rounded-lg px-2 py-2 text-[10px] font-bold sm:text-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${tab === value ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>{label}</Button>)}
          </div>
          <FormField label={`Search ${tab}`} labelClassName="sr-only">
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${tab}`} />
          </FormField>
          {tab === 'accounts' && <div>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Accounts</h3>
            <div className="mt-2 space-y-2">
              {portfolio.accounts.filter(value => matches(`${value.name} ${value.baseCurrency}`)).map(value => (
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3">
                  <span className="min-w-0">
                    {/* The name is its own truncating span: `truncate` on the flex row itself only clips
                        (text-overflow does not reach an anonymous flex item) and the badges beside
                        it are what got clipped away first. */}
                    <strong className="flex min-w-0 items-center gap-2 text-xs text-foreground">
                      <span className="truncate">{value.name}</span>
                      <RowSyncStatus
                        isDeleting={Boolean(value.isPendingDelete)}
                        isSyncing={activeSyncIds.includes(value.id)}
                        isPending={value.isPendingSync && !activeSyncIds.includes(value.id)}
                        entityLabel="account"
                      />
                      {!value.canDelete && !value.canArchive && !value.isArchived && (
                        <span title="Close all positions and set cash to zero before archiving." className="flex shrink-0 cursor-help items-center gap-1.5 rounded-md px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/10">
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
                        disabled={mutationsDisabled || Boolean(value.isPendingSync || value.isPendingDelete)}
                        onClick={() => onUnarchiveAccount(value.id, value.name, value.baseCurrency)}
                      >
                        Unarchive
                      </Button>
                    ) : (
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={mutationsDisabled || Boolean(value.isPendingSync || value.isPendingDelete) || (!value.canDelete && !value.canArchive)}
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
                <div key={value.id} className="flex items-center justify-between gap-2 rounded-xl bg-muted/25 p-3" aria-busy={value.isPendingSync || value.isPendingDelete || activeSyncIds.includes(value.id)}>
                  <span className="min-w-0">
                    <strong className="flex min-w-0 items-center gap-2 text-xs text-foreground">
                      <span className="truncate">{value.symbol} · {value.name}</span>
                      <RowSyncStatus
                        isDeleting={Boolean(value.isPendingDelete)}
                        isSyncing={activeSyncIds.includes(value.id)}
                        isPending={value.isPendingSync && !activeSyncIds.includes(value.id)}
                        entityLabel="investment"
                      />
                      {!value.canDelete && !value.canArchive && !value.isArchived && (
                        <span title={value.archiveUnavailableReason} className="flex shrink-0 cursor-help items-center gap-1.5 rounded-md px-1.5 py-0.5 text-amber-500 hover:bg-amber-500/10">
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
                    disabled={mutationsDisabled || Boolean(value.isPendingSync || value.isPendingDelete) || (!value.isArchived && !value.canDelete && !value.canArchive)}
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
            <p className="mt-3 text-[10px] text-muted-foreground">Delete only unused investments. Close active ones to keep their history.</p>
          </div>}
        </div>
      </BottomSheet>
    </>
  )
}

export default InvestmentsView
