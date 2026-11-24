import { useEffect, useMemo, useRef, useState, type SetStateAction } from 'react'
import { Reorder } from 'framer-motion'
import { AlertCircle, RotateCcw, Save, WifiOff } from 'lucide-react'
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
import { currentGroupMix, getInvestmentGroups, groupingEnabled, hasActiveTargets, hasCompleteTargets, releasedByRemoval, targetsEnabled, weightedGroupTargets } from '../../lib/investmentGroups'
import { InvestmentTargetsPanel } from './InvestmentTargetsPanel'
import { InvestmentGroupsPanel } from './InvestmentGroupsPanel'
import { InvestmentClassificationRow } from './InvestmentClassificationRow'
import { EmptyState } from '../ui/EmptyState'
import { InvestmentPlanSettingsSkeleton } from '../ui/skeletons/InvestmentPlanSettingsSkeleton'
import { panelClass } from '../ui/panelStyles'
import { cn } from '../../lib/utils'

const defaults: InvestmentPlan = {
  groups: [],
  groupingEnabled: false,
  targetsEnabled: false,
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
    if (!queuedPlan?.payload) return value
    // Undo bookkeeping travels with the payload but is not part of the plan itself.
    const plan = Object.fromEntries(Object.entries(queuedPlan.payload)
      .filter(([key]) => key !== 'restoreAssignments' && key !== 'undoSnapshot'))
    return { ...value, ...plan } as InvestmentPlan
  }
  /** A queued plan save releases investments from removed groups, and an undo of one puts them back. */
  const projectPlanAssignments = (plan: InvestmentPlan, assignments: InvestmentAllocationOverview['assignments']) => {
    const queuedPlan = [...investmentOps].reverse().find(operation =>
      operation.entity === 'investmentPlan' && operation.type === 'update')
    if (!queuedPlan?.payload) return assignments
    const keys = new Set(getInvestmentGroups(plan).map(group => group.key))
    const restored = new Map((Array.isArray(queuedPlan.payload.restoreAssignments) ? queuedPlan.payload.restoreAssignments : [])
      .flatMap((item: { instrumentId?: unknown; sleeve?: unknown }) =>
        typeof item?.instrumentId === 'string' && typeof item.sleeve === 'string' && keys.has(item.sleeve)
          ? [[item.instrumentId, item.sleeve as InvestmentAllocationSleeve] as const] : []))
    return assignments.map(item => restored.has(item.instrumentId)
      ? { ...item, sleeve: restored.get(item.instrumentId) }
      : item.sleeve && !keys.has(item.sleeve) ? { ...item, sleeve: undefined } : item)
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
    const plan = projectQueuedPlan(value.plan)
    return {
      ...value,
      plan,
      assignments: projectPlanAssignments(plan, value.assignments).map(assignment => queuedAssignments.has(assignment.instrumentId)
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
      setOverview(previous => {
        if (!previous) return previous
        const plan = projectQueuedPlan(previous.plan)
        return {
          ...previous,
          plan,
          assignments: projectPlanAssignments(plan, previous.assignments).map(value => queuedAssignments.has(value.instrumentId)
            ? { ...value, sleeve: queuedAssignments.get(value.instrumentId) }
            : value),
        }
      })
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
  const validation = validateInvestmentPlan(plan)

  const save = () => {
    if (hideSensitive || validation || !overview) return
    const payload = {
      groups,
      groupingEnabled: groupingEnabled(plan),
      targetsEnabled: targetsEnabled(plan),
      watchDrift: plan.watchDrift,
      alertDrift: plan.alertDrift,
    }
    // The server releases investments from removed groups in the same save; undo puts them back.
    const released = releasedByRemoval(groups, overview.assignments)
    const accepted = queueMutation('investmentPlan', 'update', 'three-fund', {
      ...payload,
      undoSnapshot: {
        ...overview.plan,
        groups: getInvestmentGroups(overview.plan),
        restoreAssignments: released.map(item => ({ instrumentId: item.instrumentId, sleeve: item.sleeve })),
      },
    })
    if (!accepted) return
    setOverview(previous => previous ? {
      ...previous,
      plan: { ...previous.plan, ...payload },
      assignments: previous.assignments.map(item => item.sleeve && !draftKeys.has(item.sleeve) ? { ...item, sleeve: undefined } : item),
    } : previous)
    setDraft(null)
  }

  const classify = (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => {
    if (hideSensitive || !groupingEnabled(savedPlan) || (sleeve && !getInvestmentGroups(savedPlan).some(group => group.key === sleeve))) return
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
  const grouping = groupingEnabled(plan)
  const targets = targetsEnabled(plan)
  const planBusy = !overview || planSyncing || planPending
  const assignments = overview?.assignments ?? []
  const assignedKeys = new Set(assignments.flatMap(assignment => assignment.sleeve ? [assignment.sleeve] : []))
  const classificationGroups = grouping && groupingEnabled(savedPlan)
    ? savedGroups.filter(group => draftKeys.has(group.key) || assignedKeys.has(group.key))
    : []
  const unsavedGroups = grouping && groups.length > 0
    && (!groupingEnabled(savedPlan) || groups.some(group => !savedGroups.some(saved => saved.key === group.key)))
  const currentMix = currentGroupMix(groups, overview?.sleeves ?? [])
  const changeGroups = (groups: InvestmentPlan['groups']) => setPlan(previous => ({ ...previous, groups }))
  const changeTargets = (enabled: boolean) => setPlan(previous => {
    const current = getInvestmentGroups(previous)
    // The first mix a person sees follows what they already hold, or an even split without prices.
    const seeded = enabled && !hasCompleteTargets(current) ? weightedGroupTargets(current, currentMix) : current
    return { ...previous, targetsEnabled: enabled, groups: seeded }
  })

  return (
    <div id="settings-panel-investment-plan" role="tabpanel" aria-labelledby="settings-tab-investment-plan"
      className="grid w-full min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-2">
      <InvestmentGroupsPanel enabled={grouping} groups={groups} assignments={assignments}
        targetsActive={grouping && targets} disabled={planBusy} onChange={changeGroups}
        onEnabledChange={enabled => setPlan(previous => ({ ...previous, groupingEnabled: enabled }))} />

      <section aria-labelledby="investment-classification-title"
        className={cn(panelClass, 'w-full min-w-0 p-4 sm:p-6 xl:col-start-2 xl:row-span-2 xl:row-start-1')}>
        <div className="min-w-0">
          <h3 id="investment-classification-title" className="flex flex-wrap items-center gap-2 text-section text-foreground">
            Investment classification <RowSyncStatus isSyncing={orderSyncing} isPending={orderPending} entityLabel="classification order" />
          </h3>
          <p className="mt-1 text-caption text-muted-foreground">{classificationGroups.length > 0
            ? 'Choose a group for each holding. Drag to set the order money is planned in.'
            : 'Drag to set the order money is planned in.'}</p>
          {unsavedGroups && (
            <p className="mt-2 rounded-control inset-group p-3 text-caption text-muted-foreground">
              Save the investment plan to sort holdings into {groupingEnabled(savedPlan) ? 'new groups' : 'these groups'}.
            </p>
          )}
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

      <InvestmentTargetsPanel enabled={targets} grouping={grouping} groups={groups}
        savedTargetsActive={hasActiveTargets(savedPlan)} currentMix={currentMix}
        plan={plan} savedPlan={overview?.plan} setPlan={setPlan} disabled={planBusy}
        onEnabledChange={changeTargets} onGroupsChange={changeGroups} />

      <div className="flex flex-wrap items-center justify-end gap-3 xl:col-span-2">
        {(validation || error) && <p role="alert" className="mr-auto flex gap-2 text-caption text-destructive"><AlertCircle className="size-4 shrink-0" />{validation || error}</p>}
        {draft && !validation && !error && <p role="status" className="mr-auto text-caption text-muted-foreground">You have unsaved changes.</p>}
        <Button variant="tertiary" disabled={planBusy || !draft} onClick={() => setDraft(null)}>
          <RotateCcw className="size-4" aria-hidden="true" /> Discard changes
        </Button>
        <Button variant="primary" disabled={planBusy || Boolean(validation) || !draft} aria-busy={planSyncing} onClick={save}>
          <MutationButtonContent state={planSyncing ? 'syncing' : planPending ? 'pending' : null}
            entityLabel="investment plan" idleLabel="Save investment plan"
            busyLabel={planSyncing ? 'Saving…' : 'Pending'} idleIcon={<Save className="size-4" />} />
        </Button>
      </div>
    </div>
  )
}
