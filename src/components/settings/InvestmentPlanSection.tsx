import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'
import { Reorder } from 'framer-motion'
import { AlertCircle, Save, WifiOff } from 'lucide-react'
import type {
  InvestmentAllocationOverview,
  InvestmentAllocationSleeve,
  InvestmentPlan,
} from '../../types'
import * as api from '../../lib/api'
import { useAppContext } from '../../contexts/AppContext'
import { Button } from '../ui/Button'
import { MutationButtonContent } from '../ui/MutationButtonContent'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { validateInvestmentPlan } from '../../lib/investmentAllocation'
import { getInvestmentGroups } from '../../lib/investmentGroups'
import { InvestmentGroupTargets } from './InvestmentGroupTargets'
import { InvestmentDriftSettings } from './InvestmentDriftSettings'
import { InvestmentClassificationRow } from './InvestmentClassificationRow'
import { EmptyState } from '../ui/EmptyState'
import { InvestmentPlanSettingsSkeleton } from '../ui/skeletons/InvestmentPlanSettingsSkeleton'
import { panelClass } from '../ui/panelStyles'
import { cn } from '../../lib/utils'

const defaults: InvestmentPlan = {
  usEquityTarget: 66,
  internationalExUsTarget: 10,
  bondsTarget: 24,
  watchDrift: 3,
  alertDrift: 5,
}

interface InvestmentPlanSectionProps {
  initialOverview?: InvestmentAllocationOverview | null
}

export function InvestmentPlanSection({ initialOverview: providedOverview }: InvestmentPlanSectionProps) {
  const {
    isOffline,
    activeSyncId,
    activeSyncIds = [],
    operations = [],
    queueMutation = () => false,
    hideSensitive,
  } = useAppContext()
  const investmentOps = useMemo(
    () => operations.filter(operation => operation.entity.startsWith('investment')),
    [operations],
  )
  const isActive = (targetId: string) => activeSyncIds.includes(targetId) || activeSyncId === targetId
  const planOperation = useMemo(() => [...investmentOps].reverse().find(operation =>
    operation.entity === 'investmentPlan' && operation.type === 'update'), [investmentOps])
  const orderOperation = useMemo(() => [...investmentOps].reverse().find(operation =>
    operation.entity === 'investmentAllocationOrder' && operation.type === 'update'), [investmentOps])
  const planSyncing = isActive('three-fund')
  const planPending = Boolean(planOperation && !planOperation.isCompleted && !planSyncing)
  const orderSyncing = isActive('classification')
  const orderPending = Boolean(orderOperation && !orderOperation.isCompleted && !orderSyncing)
  const cachedOverview = () => providedOverview ?? api.readCachedInvestmentAllocation()
  const projectQueuedPlan = (value: InvestmentPlan) => {
    const queuedPlan = [...investmentOps].reverse().find(operation =>
      operation.entity === 'investmentPlan' && operation.type === 'update')
    return queuedPlan?.payload ? { ...value, ...queuedPlan.payload } as InvestmentPlan : value
  }
  const projectQueuedChanges = (value: InvestmentAllocationOverview | null) => {
    if (!value) return null
    const queuedAssignments = new Map(investmentOps
      .filter(operation => operation.entity === 'investmentAllocation' && operation.type === 'update')
      .map(operation => [operation.targetId,
        typeof operation.payload?.sleeve === 'string'
          ? operation.payload.sleeve as InvestmentAllocationSleeve
          : undefined]))
    const queuedOrder = [...investmentOps].reverse().find(operation =>
      operation.entity === 'investmentAllocationOrder' && operation.type === 'update')
    const queuedIds = Array.isArray(queuedOrder?.payload?.instrumentIds)
      ? queuedOrder.payload.instrumentIds.filter((id): id is string => typeof id === 'string')
      : []
    const positions = new Map(queuedIds.map((id, index) => [id, index]))
    return {
      ...value,
      plan: projectQueuedPlan(value.plan),
      assignments: value.assignments.map(assignment => queuedAssignments.has(assignment.instrumentId)
        ? { ...assignment, sleeve: queuedAssignments.get(assignment.instrumentId) }
        : assignment)
        .sort((left, right) =>
          (positions.get(left.instrumentId) ?? left.order)
          - (positions.get(right.instrumentId) ?? right.order)),
    }
  }
  const initialOverview = () => projectQueuedChanges(cachedOverview())
  const [overview, setOverview] = useState<InvestmentAllocationOverview | null>(initialOverview)
  const [draft, setDraft] = useState<InvestmentPlan | null>(null)
  const savedPlan = overview?.plan ?? defaults
  const plan = draft ?? savedPlan
  const setPlan = (change: SetStateAction<InvestmentPlan>) => {
    setDraft(previous => typeof change === 'function' ? change(previous ?? savedPlan) : change)
  }
  const [loading, setLoading] = useState(() => !cachedOverview())
  const [error, setError] = useState('')

  useEffect(() => {
    if (!providedOverview) return
    const projected = projectQueuedChanges(providedOverview)
    setOverview(projected)
  }, [providedOverview])

  const load = async () => {
    if (isOffline) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const value = await api.fetchInvestmentAllocation()
      const projected = projectQueuedChanges(value)
      setOverview(projected)
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load the investment plan.')
      throw reason
    } finally {
      setLoading(false)
    }
  }

  // The coordinator broadcasts an authoritative allocation after a partial refresh. Keep the
  // event listener stable, but let it read the latest queued-operation projection and loader;
  // otherwise a listener installed before a user edits the plan can overwrite that edit with a
  // stale closure when the refresh response arrives.
  const projectQueuedChangesRef = useRef(projectQueuedChanges)
  const loadRef = useRef(load)
  useEffect(() => {
    projectQueuedChangesRef.current = projectQueuedChanges
    loadRef.current = load
  })

  useEffect(() => {
    if (!providedOverview) void load().catch(() => undefined)
  }, [isOffline, providedOverview])
  useEffect(() => {
    const queuedPlan = [...investmentOps].reverse().find(value =>
      value.entity === 'investmentPlan' && value.type === 'update')
    const queuedAssignments = new Map(investmentOps
      .filter(value => value.entity === 'investmentAllocation' && value.type === 'update')
      .map(value => [value.targetId,
        typeof value.payload?.sleeve === 'string'
          ? value.payload.sleeve as InvestmentAllocationSleeve
          : undefined]))
    if (queuedPlan?.payload || queuedAssignments.size > 0) {
      setOverview(previous => previous ? {
        ...previous,
        plan: projectQueuedPlan(previous.plan),
        assignments: previous.assignments.map(value => queuedAssignments.has(value.instrumentId)
          ? { ...value, sleeve: queuedAssignments.get(value.instrumentId) }
          : value),
      } : previous)
    }
  }, [investmentOps])
  useEffect(() => {
    const synced = (event: Event) => {
      const detail = (event as CustomEvent<{
        allocation?: InvestmentAllocationOverview
        acknowledge?: (work: Promise<void>) => void
      }>).detail
      const allocation = detail?.allocation
      if (allocation) {
        const projected = projectQueuedChangesRef.current(allocation)
        setOverview(projected)
        setLoading(false)
        setError('')
        detail?.acknowledge?.(Promise.resolve())
        return
      }
      const work = loadRef.current()
      if (detail?.acknowledge) detail.acknowledge(work)
      else void work.catch(() => undefined)
    }
    window.addEventListener('investment-sync', synced)
    return () => window.removeEventListener('investment-sync', synced)
  }, [])

  const groups = getInvestmentGroups(plan)
  const draftKeys = new Set(groups.map(group => group.key))
  const assignedKeys = new Set(overview?.assignments.flatMap(assignment => assignment.sleeve ? [assignment.sleeve] : []))
  const validation = [...assignedKeys].some(key => !draftKeys.has(key))
    ? 'Move investments to another portfolio group before removing their group.'
    : validateInvestmentPlan(plan)

  const save = () => {
    if (hideSensitive || validation || !overview) return
    const payload = {
      groups,
      usEquityTarget: plan.usEquityTarget,
      internationalExUsTarget: plan.internationalExUsTarget,
      bondsTarget: plan.bondsTarget,
      watchDrift: plan.watchDrift,
      alertDrift: plan.alertDrift,
    }
    const accepted = queueMutation('investmentPlan', 'update', 'three-fund', {
      ...payload,
      undoSnapshot: { ...overview.plan, groups: getInvestmentGroups(overview.plan) },
    })
    if (!accepted) return
    setOverview(previous => previous ? { ...previous, plan: { ...previous.plan, ...payload } } : previous)
    setDraft(null)
  }

  const classify = (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => {
    if (hideSensitive || (sleeve && !getInvestmentGroups(overview?.plan ?? defaults).some(group => group.key === sleeve))) return
    const previousSleeve = overview?.assignments.find(value => value.instrumentId === instrumentId)?.sleeve
    const accepted = queueMutation('investmentAllocation', 'update', instrumentId, {
      sleeve: sleeve ?? null,
      undoSnapshot: { sleeve: previousSleeve ?? null },
    })
    if (!accepted) return
    setOverview(previous => previous ? {
      ...previous,
      assignments: previous.assignments.map(value =>
        value.instrumentId === instrumentId ? { ...value, sleeve } : value),
    } : previous)
  }

  const orderedAssignments = useMemo(
    () => [...(overview?.assignments ?? [])].sort((left, right) => left.order - right.order),
    [overview?.assignments],
  )
  const reorderAssignments = (assignments: InvestmentAllocationOverview['assignments']) => {
    if (hideSensitive) return
    setOverview(previous => previous ? {
      ...previous,
      assignments: assignments.map((value, order) => ({ ...value, order })),
    } : previous)
  }
  const queueAssignmentOrder = (assignments: InvestmentAllocationOverview['assignments']) => {
    if (hideSensitive) return
    const instrumentIds = [...assignments]
      .sort((left, right) => left.order - right.order)
      .map(value => value.instrumentId)
    const queuedOrder = [...investmentOps].reverse().find(operation =>
      operation.entity === 'investmentAllocationOrder' && operation.type === 'update')
    const previousInstrumentIds = Array.isArray(queuedOrder?.payload?.instrumentIds)
      ? queuedOrder.payload.instrumentIds.filter((id): id is string => typeof id === 'string')
      : [...(cachedOverview()?.assignments ?? [])]
          .sort((left, right) => left.order - right.order)
          .map(value => value.instrumentId)
    return queueMutation('investmentAllocationOrder', 'update', 'classification', {
      instrumentIds,
      undoSnapshot: { instrumentIds: previousInstrumentIds },
    })
  }
  const saveAssignmentOrder = () => {
    queueAssignmentOrder(orderedAssignments)
  }
  const moveAssignment = (instrumentId: string, direction: -1 | 1) => {
    if (hideSensitive || orderSyncing || orderPending) return
    const sourceIndex = orderedAssignments.findIndex(value => value.instrumentId === instrumentId)
    const targetIndex = sourceIndex + direction
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= orderedAssignments.length) return
    const next = [...orderedAssignments]
    const [moved] = next.splice(sourceIndex, 1)
    if (!moved) return
    next.splice(targetIndex, 0, moved)
    const normalized = next.map((value, order) => ({ ...value, order }))
    if (!queueAssignmentOrder(normalized)) return
    setOverview(previous => previous ? { ...previous, assignments: normalized } : previous)
  }

  useEffect(() => {
    if (!hideSensitive) return
    const projectQueued = projectQueuedChanges(cachedOverview())
    setOverview(projectQueued)
    setDraft(null)
  }, [hideSensitive])

  if (!overview && isOffline) {
    return <div role="status" className={cn(panelClass, 'flex h-40 flex-col items-center justify-center gap-2 p-5 text-center')}><WifiOff className="size-6 text-muted-foreground" /><p className="text-subsection text-foreground">Investment plan unavailable offline</p><p className="text-caption text-muted-foreground">Connect once to load your investment plan on this device.</p></div>
  }
  if (!overview && loading) {
    return <InvestmentPlanSettingsSkeleton />
  }

  if (hideSensitive) {
    return <div id="settings-panel-investment-plan" role="tabpanel" aria-labelledby="settings-tab-investment-plan"
      className={cn(panelClass, 'p-5 text-body text-muted-foreground')}>Unhide balances to view or edit your investment plan.</div>
  }

  const savedGroups = getInvestmentGroups(savedPlan)
  const classificationGroups = savedGroups.filter(group => draftKeys.has(group.key) || assignedKeys.has(group.key))
  const hasNewGroups = groups.some(group => !savedGroups.some(saved => saved.key === group.key))

  return (
    <div id="settings-panel-investment-plan" role="tabpanel" aria-labelledby="settings-tab-investment-plan" className="grid w-full min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <section aria-labelledby="investment-targets-title" className={cn(panelClass, 'w-full min-w-0 p-4 sm:p-6')}>
        <InvestmentGroupTargets groups={groups} assignedKeys={assignedKeys}
          disabled={!overview || planSyncing || planPending}
          onChange={groups => setPlan(previous => ({ ...previous, groups }))} />
        <InvestmentDriftSettings plan={plan} savedPlan={overview?.plan} setPlan={setPlan}
          hideSensitive={planSyncing || planPending || !overview} />

        {(validation || error) && <p role="alert" className="mt-2 flex gap-2 text-caption text-red-600 dark:text-red-400"><AlertCircle className="size-4 shrink-0" />{validation || error}</p>}
        <div className="mt-4 flex justify-end">
          <Button variant="primary" disabled={!overview || Boolean(validation) || planSyncing || planPending} aria-busy={planSyncing} onClick={save}>
            <MutationButtonContent
              state={planSyncing ? 'syncing' : planPending ? 'pending' : null}
              entityLabel="investment plan"
              idleLabel="Save targets"
              busyLabel={planSyncing ? 'Saving…' : 'Pending'}
              idleIcon={<Save className="size-4" />}
            />
          </Button>
        </div>
      </section>

      <section aria-labelledby="investment-classification-title" className={cn(panelClass, 'w-full min-w-0 p-4 sm:p-6')}>
        <div className="min-w-0">
          <h3 id="investment-classification-title" className="flex flex-wrap items-center gap-2 text-section text-foreground">
            Investment classification <RowSyncStatus isSyncing={orderSyncing} isPending={orderPending} entityLabel="classification order" />
          </h3>
          <p className="mt-1 text-caption text-muted-foreground">Which target each holding counts towards. Drag to set the order money is planned in.</p>
          {hasNewGroups && <p className="mt-1 text-caption text-muted-foreground">Save targets to make new groups available here.</p>}
        </div>
        <Reorder.Group
          axis="y"
          values={orderedAssignments}
          onReorder={reorderAssignments}
          className="mt-3 max-h-[28rem] w-full min-w-0 divide-y divide-border/60 overflow-y-auto"
        >
          {orderedAssignments.map((value, index) => (
            <InvestmentClassificationRow
              key={value.instrumentId}
              value={value}
              groups={classificationGroups}
              classify={classify}
              onReorderFinished={saveAssignmentOrder}
              onMove={direction => moveAssignment(value.instrumentId, direction)}
              position={index + 1}
              count={orderedAssignments.length}
              isSyncing={isActive(value.instrumentId)}
              orderBusy={orderSyncing || orderPending}
              mutationsDisabled={hideSensitive}
              isPending={Boolean(investmentOps.find(operation =>
                operation.entity === 'investmentAllocation'
                && operation.type === 'update'
                && operation.targetId === value.instrumentId
                && !operation.isCompleted
              ))}
            />
          ))}
          {!overview?.assignments.length && (
            <EmptyState density="compact" className="bg-transparent p-5" title="Add investments first, then return here to classify them." />
          )}
        </Reorder.Group>
      </section>
    </div>
  )
}
