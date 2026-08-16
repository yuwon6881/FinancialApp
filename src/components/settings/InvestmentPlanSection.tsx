import { RangeInput } from '../ui/RangeInput'
import { Input } from '../ui/Input'
import { useEffect, useMemo, useState } from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'framer-motion'
import { AlertCircle, GripVertical, Info, Loader2, Save, SlidersHorizontal, Lock, Unlock } from 'lucide-react'
import type {
  InvestmentAllocationOverview,
  InvestmentAllocationSleeve,
  InvestmentPlan,
} from '../../types'
import * as api from '../../lib/api'
import { useAppContext } from '../../contexts/AppContext'
import { CustomSelect } from '../ui/CustomSelect'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { redistributeInvestmentTargets } from '../../lib/investmentAllocation'

type TargetKey = 'usEquityTarget' | 'internationalExUsTarget' | 'bondsTarget'

const defaults: InvestmentPlan = {
  usEquityTarget: 66,
  internationalExUsTarget: 10,
  bondsTarget: 24,
  watchDrift: 3,
  alertDrift: 5,
}

function ClassificationRow({
  value,
  classify,
  onReorderFinished,
  onMove,
  position,
  count,
  isSyncing,
  isPending,
  orderBusy,
  mutationsDisabled,
}: {
  value: InvestmentAllocationOverview['assignments'][number]
  classify: (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => void
  onReorderFinished: () => void
  onMove: (direction: -1 | 1) => void
  position: number
  count: number
  isSyncing: boolean
  isPending: boolean
  orderBusy: boolean
  mutationsDisabled: boolean
}) {
  const controls = useDragControls()
  const reduceMotion = useReducedMotion()
  const isBusy = mutationsDisabled || isSyncing || isPending || orderBusy

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onReorderFinished}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
      whileDrag={reduceMotion ? undefined : { scale: 1.015, boxShadow: 'var(--app-shadow)' }}
      className="flex flex-col gap-2.5 rounded-xl border border-border/50 bg-card/60 p-3 shadow-2xs transition-colors hover:border-border/80 sm:flex-row sm:items-center sm:gap-3"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <Button
          variant="unstyled"
          type="button"
          aria-label={`Reorder ${value.symbol}. Position ${position} of ${count}. Use Up or Down arrow keys.`}
          aria-keyshortcuts="ArrowUp ArrowDown"
          onPointerDown={event => controls.start(event)}
          onKeyDown={event => {
            if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
            event.preventDefault()
            onMove(event.key === 'ArrowUp' ? -1 : 1)
          }}
          disabled={isBusy}
          className="inline-flex size-8 shrink-0 touch-none cursor-grab items-center justify-center rounded-lg text-muted-foreground/70 transition hover:bg-muted/40 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <strong className="block truncate text-xs font-bold text-foreground">{value.symbol}</strong>
            <RowSyncStatus isSyncing={isSyncing} isPending={isPending} entityLabel="classification" />
          </div>
          <span className="block truncate text-[11px] text-muted-foreground">{value.name}</span>
        </div>
      </div>
      <div className="w-full sm:w-[190px] shrink-0">
        <CustomSelect
          ariaLabel={`Classify ${value.symbol}`}
          value={value.sleeve ?? ''}
          onChange={next => classify(value.instrumentId, String(next) === '' ? undefined : String(next) as InvestmentAllocationSleeve)}
          disabled={isBusy}
          options={[
            { value: '', label: 'Unassigned' },
            { value: 'USEquity', label: 'US Equity' },
            { value: 'InternationalExUS', label: 'International ex-US' },
            { value: 'Bonds', label: 'Bonds' },
          ]}
          className="w-full"
        />
      </div>
    </Reorder.Item>
  )
}

export function InvestmentPlanSection() {
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
  const cachedOverview = () => api.readCachedInvestmentPortfolio()?.allocation ?? null
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
  const [plan, setPlan] = useState<InvestmentPlan>(() => initialOverview()?.plan ?? defaults)
  const [lockedSleeve, setLockedSleeve] = useState<TargetKey | null>(null)
  const [globalTargetLock, setGlobalTargetLock] = useState(true)
  const [loading, setLoading] = useState(() => !cachedOverview())
  const [error, setError] = useState('')

  const load = () => {
    if (isOffline) {
      setLoading(false)
      return
    }
    setLoading(true)
    api.fetchInvestmentAllocation()
      .then(value => {
        const projected = projectQueuedChanges(value)
        setOverview(projected)
        setPlan(projected?.plan ?? value.plan)
        setError('')
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : 'Could not load the investment plan.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [isOffline])
  useEffect(() => {
    const queuedPlan = [...investmentOps].reverse().find(value =>
      value.entity === 'investmentPlan' && value.type === 'update')
    if (queuedPlan?.payload) {
      setPlan(previous => ({
        ...previous,
        ...queuedPlan.payload,
      } as InvestmentPlan))
    }
    const queuedAssignments = new Map(investmentOps
      .filter(value => value.entity === 'investmentAllocation' && value.type === 'update')
      .map(value => [value.targetId,
        typeof value.payload?.sleeve === 'string'
          ? value.payload.sleeve as InvestmentAllocationSleeve
          : undefined]))
    if (queuedAssignments.size > 0) {
      setOverview(previous => previous ? {
        ...previous,
        assignments: previous.assignments.map(value => queuedAssignments.has(value.instrumentId)
          ? { ...value, sleeve: queuedAssignments.get(value.instrumentId) }
          : value),
      } : previous)
    }
  }, [investmentOps])
  useEffect(() => {
    const synced = () => load()
    window.addEventListener('investment-sync', synced)
    return () => window.removeEventListener('investment-sync', synced)
  }, [isOffline])

  const total = plan.usEquityTarget + plan.internationalExUsTarget + plan.bondsTarget
  const validation = useMemo(() => {
    if (total !== 100) return 'Targets must total exactly 100%.'
    if (plan.watchDrift <= 0 || plan.alertDrift <= plan.watchDrift)
      return 'Alert drift must be greater than Watch drift.'
    return ''
  }, [plan, total])

  const changeTarget = (key: TargetKey, value: number) => {
    if (hideSensitive) return
    setPlan(previous => ({
      ...previous,
      ...redistributeInvestmentTargets(previous, key, value, lockedSleeve ?? undefined),
    }))
  }

  const toggleSleeveLock = (key: TargetKey) => {
    if (hideSensitive) return
    setLockedSleeve(current => {
      if (current === key) return null
      // Three sleeves need two adjustable values to preserve a 100% total. Keep the
      // first lock in place until the user explicitly unlocks it.
      return current ?? key
    })
  }

  const save = () => {
    if (hideSensitive || validation) return
    const payload = {
      usEquityTarget: plan.usEquityTarget,
      internationalExUsTarget: plan.internationalExUsTarget,
      bondsTarget: plan.bondsTarget,
      watchDrift: plan.watchDrift,
      alertDrift: plan.alertDrift,
    }
    const accepted = queueMutation('investmentPlan', 'update', 'three-fund', {
      ...payload,
      undoSnapshot: overview?.plan,
    })
    if (!accepted) return
    setOverview(previous => previous ? { ...previous, plan: { ...previous.plan, ...payload } } : previous)
  }

  const classify = (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => {
    if (hideSensitive) return
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
    setPlan(projectQueued?.plan ?? defaults)
    setLockedSleeve(null)
    setGlobalTargetLock(true)
  }, [hideSensitive])

  if (!overview && (loading || isOffline)) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div id="settings-panel-investment-plan" role="tabpanel" aria-labelledby="settings-tab-investment-plan" className="grid gap-6 lg:grid-cols-2 animate-in fade-in duration-200">
      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex items-start justify-between gap-2 border-b border-border/40 pb-4">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-violet-500/10 p-2 text-violet-500 shrink-0"><SlidersHorizontal className="size-4" /></div>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">Portfolio targets <RowSyncStatus isSyncing={planSyncing} isPending={planPending} entityLabel="investment plan" /></h3>
              <p className="mt-1 text-[11px] text-muted-foreground">Changing one sleeve automatically redistributes the other two.</p>
            </div>
          </div>
          <Button variant="unstyled"
            type="button"
            onClick={() => setGlobalTargetLock(!globalTargetLock)}
            disabled={hideSensitive}
            className="mt-1 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/60 px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer sm:min-h-8"
          >
            {globalTargetLock ? <Lock className="size-3" /> : <Unlock className="size-3" />}
            {globalTargetLock ? 'Locked' : 'Unlocked'}
          </Button>
        </div>
        <div className="mt-5 space-y-5">
          {([
            ['US Equity', 'usEquityTarget', 'accent-blue-500'],
            ['International ex-US', 'internationalExUsTarget', 'accent-amber-500'],
            ['Bonds', 'bondsTarget', 'accent-emerald-500'],
          ] as const).map(([label, key, accentClass]) => (
            <label key={key} className="space-y-2 block">
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span className="text-muted-foreground flex items-center gap-1.5"><span className="uppercase tracking-wider">{label}</span><Button variant="unstyled" size="icon" type="button" aria-label={`${lockedSleeve === key ? 'Unlock' : 'Lock'} ${label} target`} onClick={(e) => { e.preventDefault(); toggleSleeveLock(key) }} className="inline-flex size-11 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 sm:size-8" disabled={hideSensitive || (lockedSleeve !== null && lockedSleeve !== key)} title={lockedSleeve === key ? "Unlock target" : lockedSleeve ? "Unlock the current target before locking another" : "Lock target"}>{lockedSleeve === key ? <Lock className="size-3.5 text-blue-500" /> : <Unlock className="size-3.5" />}</Button></span>
                <span className="text-foreground bg-secondary px-2 py-0.5 rounded-md">{plan[key]}%</span>
              </div>
              <RangeInput
                aria-label={`${label} target`}
                min="1"
                max="98"
                step="1"
                disabled={hideSensitive || globalTargetLock || lockedSleeve === key}
                value={plan[key]}
                onChange={event => changeTarget(key, Number(event.target.value))}
                className={`w-full h-2 rounded-full cursor-pointer ${accentClass} bg-border disabled:opacity-50 disabled:cursor-not-allowed`}
              />
            </label>
          ))}
          <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs font-bold text-foreground">Total: {total}%</div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
            <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
              Drift is the gap between a basket’s actual share and its target. 62% vs 66% is 4 points off.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <FormField
                label="Watch when off by"
                hint="Shows an early warning; guidance may use new money to correct it."
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3"
                labelClassName="text-xs text-foreground"
                hintClassName="text-[9px]"
              >
                <span className="relative block">
                  <Input type="number" min="1" max="99" step="1" disabled={hideSensitive} value={plan.watchDrift} onChange={event => setPlan(value => ({ ...value, watchDrift: Number(event.target.value) }))} className="pr-8" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pp</span>
                </span>
              </FormField>
              <FormField
                label="Alert when off by"
                hint="Marks a larger mismatch that may eventually require rebalancing."
                className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3"
                labelClassName="text-xs text-foreground"
                hintClassName="text-[9px]"
              >
                <span className="relative block">
                  <Input type="number" min="2" max="100" step="1" disabled={hideSensitive} value={plan.alertDrift} onChange={event => setPlan(value => ({ ...value, alertDrift: Number(event.target.value) }))} className="pr-8" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pp</span>
                </span>
              </FormField>
            </div>
          </div>
          {(validation || error) && <p role="alert" className="flex gap-2 text-xs text-destructive"><AlertCircle className="size-4 shrink-0" />{validation || error}</p>}
          <Button variant="primary" disabled={hideSensitive || Boolean(validation) || planSyncing || planPending} aria-busy={planSyncing} onClick={save}>{planSyncing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {planSyncing ? 'Saving…' : 'Save targets'}</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">Investment classification <RowSyncStatus isSyncing={orderSyncing} isPending={orderPending} entityLabel="classification order" /></h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Every open holding needs a basket. Drag a grip, or focus it and press Up or Down, to change the order.</p>
        <Reorder.Group
          axis="y"
          values={orderedAssignments}
          onReorder={reorderAssignments}
          className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1"
        >
          {orderedAssignments.map((value, index) => (
            <ClassificationRow
              key={value.instrumentId}
              value={value}
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
            <p className="rounded-xl border border-dashed border-border/60 p-5 text-center text-xs text-muted-foreground">
              Add investments first, then return here to classify them.
            </p>
          )}
        </Reorder.Group>
      </section>
    </div>
  )
}
