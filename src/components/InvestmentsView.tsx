import React, { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  CloudOff,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import type {
  AppTab,
  InvestmentActivity,
  InvestmentCashFlow,
  InvestmentRange,
} from '../types'
import { useAppContext } from '../contexts/AppContext'
import { Button } from './ui/Button'
import { PageHeader } from './ui/PageHeader'
import { BottomSheet } from './ui/BottomSheet'
import { CycleSkeleton } from './ui/CycleSkeleton'
import { useInvestmentPortfolio } from './investments/useInvestmentPortfolio'
import { applyOpsToList } from '../lib/outbox'
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
import { isActivityScan, isCashMovementScan } from '../lib/investmentScanKind'
import type { InvestmentActivityScanResult } from '../lib/api'
import { SummaryCards } from './investments/SummaryCards'
import { AccountsAndInstruments } from './investments/AccountsAndInstruments'
import { ActionToolbar, EmptyState } from './investments/InvestmentToolbars'

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
  const { hideSensitive, maskPassiveFinancialFigures, isOffline, confirm, activeSyncId, activeSyncIds = [], operations = [], queueMutation = () => false } = useAppContext()
  const passiveMask = maskPassiveFinancialFigures ?? hideSensitive
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
  const [formKey, setFormKey] = useState(0)
  const busy = false
  const [allocationFilter, setAllocationFilter] = useState<AllocationFilter>(null)
  const [detailHoldingKey, setDetailHoldingKey] = useState<{ accountId: string; instrumentId: string } | null>(null)

  const detailHolding = useMemo(() => detailHoldingKey
    ? portfolio?.holdings.find(holding =>
      holding.accountId === detailHoldingKey.accountId
      && holding.instrumentId === detailHoldingKey.instrumentId) ?? null
    : null, [detailHoldingKey, portfolio])

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
    setDetailHoldingKey(null)
  }, [hideSensitive])
  useAutoOpenModal(
    autoOpenAddForm,
    () => {
      if (investmentScanDraft && isCashMovementScan(investmentScanDraft.result.type)) {
        openCashPanel()
      } else {
        openPanel('activity')
      }
    },
    onResetAutoOpen
  )
  useEffect(() => {
    if (!investmentScanDraft || !isCashMovementScan(investmentScanDraft.result.type)) return
    if (panel === null) return
    if (panel === 'cash' && !editingCashFlow) return
    if (editingActivity || editingCashFlow) return
    setFormKey(value => value + 1)
    setPanel('cash')
  }, [investmentScanDraft, panel, editingActivity, editingCashFlow])
  useEffect(() => {
    if (!investmentScanDraft || !isActivityScan(investmentScanDraft.result.type)) return
    if (panel === null) return
    if (panel === 'activity' && !editingActivity) return
    if (editingActivity || editingCashFlow) return
    setFormKey(value => value + 1)
    setPanel('activity')
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
      <PageHeader
        leading={<Button
          variant="unstyled"
          type="button"
          onClick={back}
          className="mt-0.5 inline-flex size-9 cursor-pointer items-center justify-center rounded-xl border border-border/60 p-2 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          aria-label="Back to Today"
        >
          <ArrowLeft className="size-4" />
        </Button>}
        title={<span className="flex flex-wrap items-center gap-2.5">Growth Investments
            {isBackgroundRefreshing && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-500 dark:text-purple-300"
              >
                <RefreshCw className="size-3 animate-spin text-purple-500 dark:text-purple-300" />
                <span>Updating prices…</span>
              </span>
            )}</span>}
        description="Track holdings across your brokers."
        titleActions={onExplainWithAi && (
          <Button
            variant="secondary"
            size="sm"
            type="button"
            className="size-11 shrink-0 p-0 sm:size-auto sm:px-3 sm:py-1.5"
            aria-label="Explain my portfolio"
            onClick={() => onExplainWithAi(range)}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Explain my portfolio</span>
          </Button>
        )}
      />

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
              onClick={() => isCashMovementScan(investmentScanDraft.result.type) ? openCashPanel() : openPanel('activity')}
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
          <SummaryCards portfolio={portfolio} masked={passiveMask} />
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
            fxRates={portfolio.planFxRates}
            masked={passiveMask}
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
              <p className="mt-1 text-xs text-muted-foreground">Most clear up after selecting "Update prices".</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {portfolio.warnings.map(warning => <li key={warning}>{warning}</li>)}
              </ul>
            </details>
          )}
          <div className="grid gap-6 grid-cols-1 2xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
            <ValueChart portfolio={portfolio} masked={passiveMask} range={range} isFetching={loading} onRangeChange={setRange} />
            <AllocationChart portfolio={portfolio} masked={passiveMask} selected={allocationFilter} onSelect={setAllocationFilter} />
          </div>
          <InvestmentForecastPanel
            key={`${portfolio.summary.totalValue ?? 'incomplete'}-${portfolio.allocation.plan.updatedAt ?? 'default'}-${portfolio.allocation.contributionPlan?.amount ?? 0}-${portfolio.allocation.contributionPlan?.routineContribution ?? 'unknown'}-${portfolio.allocation.contributionPlan?.isEstimated ?? false}`}
            portfolio={portfolio}
            masked={passiveMask}
          />
          <PerformanceBars portfolio={portfolio} masked={passiveMask} onSelectHolding={holding => setDetailHoldingKey({ accountId: holding.accountId, instrumentId: holding.instrumentId })} />
          <HoldingsTable portfolio={portfolio} masked={passiveMask} filter={allocationFilter} onSelectHolding={holding => setDetailHoldingKey({ accountId: holding.accountId, instrumentId: holding.instrumentId })} />
          <HoldingDetailSheet
            holding={detailHolding}
            appCurrency={portfolio.appCurrency}
            masked={passiveMask}
            portfolioUpdatedAt={portfolio.pricesUpdatedAt}
            onClose={() => setDetailHoldingKey(null)}
          />
          <PagedActivityTable
            portfolio={setupPortfolio ?? portfolio}
            masked={passiveMask}
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

export default InvestmentsView
