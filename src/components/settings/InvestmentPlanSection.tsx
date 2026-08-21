import { RangeInput } from '../ui/RangeInput'
import { Input } from '../ui/Input'
import { useEffect, useMemo, useState } from 'react'
import { Reorder } from 'framer-motion'
import { AlertCircle, Info, Loader2, Save, SlidersHorizontal, Lock, Unlock, WifiOff } from 'lucide-react'
import type {
  InvestmentAllocationOverview,
  InvestmentAllocationSleeve,
  InvestmentPlan,
} from '../../types'
import * as api from '../../lib/api'
import { useAppContext } from '../../contexts/AppContext'
import { Button } from '../ui/Button'
import { FormField } from '../ui/FormField'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { redistributeInvestmentTargets, validateInvestmentPlan } from '../../lib/investmentAllocation'
import { InvestmentClassificationRow } from './InvestmentClassificationRow'

type TargetKey = 'usEquityTarget' | 'internationalExUsTarget' | 'bondsTarget'

const defaults: InvestmentPlan = {
  usEquityTarget: 66,
  internationalExUsTarget: 10,
  bondsTarget: 24,
  watchDrift: 3,
  alertDrift: 5,
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
  const validation = useMemo(() => validateInvestmentPlan(plan), [plan])

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

  if (!overview && isOffline) {
    return <div role="status" className="flex h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-border/60 bg-card p-5 text-center"><WifiOff className="size-6 text-muted-foreground" /><p className="text-sm font-semibold text-foreground">Investment plan unavailable offline</p><p className="text-xs text-muted-foreground">Connect once to load your investment plan on this device.</p></div>
  }
  if (!overview && loading) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div id="settings-panel-investment-plan" role="tabpanel" aria-labelledby="settings-tab-investment-plan" className="w-full min-w-0 grid grid-cols-1 gap-6 lg:grid-cols-2 items-start animate-in fade-in duration-200">
      <section className="w-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 sm:p-6 shadow-xs">
        <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4 min-w-0 w-full">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="rounded-xl bg-violet-500/10 p-2 text-violet-500 shrink-0"><SlidersHorizontal className="size-4" /></div>
            <div className="min-w-0 flex-1">
              <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                Portfolio targets <RowSyncStatus isSyncing={planSyncing} isPending={planPending} entityLabel="investment plan" />
              </h3>
              <p className="mt-1 text-[11px] text-muted-foreground break-words">Changing one sleeve automatically redistributes the other two.</p>
            </div>
          </div>
          <Button variant="unstyled"
            type="button"
            onClick={() => setGlobalTargetLock(!globalTargetLock)}
            disabled={hideSensitive}
            className="mt-0.5 inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border/60 bg-secondary/60 px-2.5 py-1.5 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer"
          >
            {globalTargetLock ? <Lock className="size-3" /> : <Unlock className="size-3" />}
            {globalTargetLock ? 'Locked' : 'Unlocked'}
          </Button>
        </div>
        <div className="mt-5 space-y-5 w-full min-w-0">
          {([
            ['US Equity', 'usEquityTarget', 'accent-blue-500'],
            ['International ex-US', 'internationalExUsTarget', 'accent-amber-500'],
            ['Bonds', 'bondsTarget', 'accent-emerald-500'],
          ] as const).map(([label, key, accentClass]) => (
            // A div, not a label. `<button>` is a labelable element, so a <label> wrapping this
            // row took the *lock button* as its labelled control (first labelable descendant, ahead
            // of the slider) and forwarded every click in the row to it -- clicking the basket
            // name, the empty gap, or the percentage badge silently toggled the lock. The slider
            // carries its own aria-label, so the label element was contributing nothing anyway.
            <div key={key} className="space-y-2 block w-full min-w-0">
              <div className="flex justify-between items-center text-[11px] font-bold min-w-0 w-full gap-2">
                <span className="text-muted-foreground flex items-center gap-1.5 min-w-0">
                  <span className="uppercase tracking-wider truncate">{label}</span>
                  <Button variant="unstyled" size="icon" type="button" aria-label={`${lockedSleeve === key ? 'Unlock' : 'Lock'} ${label} target`} onClick={(e) => { e.preventDefault(); toggleSleeveLock(key) }} className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" disabled={hideSensitive || (lockedSleeve !== null && lockedSleeve !== key)} title={lockedSleeve === key ? "Unlock target" : lockedSleeve ? "Unlock the current target before locking another" : "Lock target"}>{lockedSleeve === key ? <Lock className="size-3.5 text-blue-500" /> : <Unlock className="size-3.5" />}</Button>
                </span>
                <span className="text-foreground bg-secondary px-2 py-0.5 rounded-md shrink-0">{plan[key]}%</span>
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
            </div>
          ))}
          <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs font-bold text-foreground w-full">Total: {total}%</div>
          <div className="rounded-xl border border-border/50 bg-muted/20 p-3 w-full min-w-0">
            <p className="flex items-start gap-2 text-[10px] leading-relaxed text-muted-foreground min-w-0">
              <Info className="mt-0.5 size-3.5 shrink-0 text-blue-500" />
              <span className="min-w-0 break-words">Drift is the gap between a basket’s actual share and its target. 62% vs 66% is 4 points off.</span>
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 w-full min-w-0">
              <FormField
                label="Watch when off by"
                hint="Shows an early warning; guidance may use new money to correct it."
                className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 w-full min-w-0"
                labelClassName="text-xs text-foreground"
                hintClassName="text-[9px] break-words"
              >
                <span className="relative block w-full min-w-0">
                  <Input type="number" inputMode="numeric" min="1" max="99" step="1" disabled={hideSensitive} value={plan.watchDrift} onChange={event => setPlan(value => ({ ...value, watchDrift: Number(event.target.value) }))} className="w-full pr-8" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pp</span>
                </span>
              </FormField>
              <FormField
                label="Alert when off by"
                hint="Marks a larger mismatch that may eventually require rebalancing."
                className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 w-full min-w-0"
                labelClassName="text-xs text-foreground"
                hintClassName="text-[9px] break-words"
              >
                <span className="relative block w-full min-w-0">
                  <Input type="number" inputMode="numeric" min="2" max="100" step="1" disabled={hideSensitive} value={plan.alertDrift} onChange={event => setPlan(value => ({ ...value, alertDrift: Number(event.target.value) }))} className="w-full pr-8" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pp</span>
                </span>
              </FormField>
            </div>
          </div>
          {(validation || error) && <p role="alert" className="flex gap-2 text-xs text-destructive"><AlertCircle className="size-4 shrink-0" />{validation || error}</p>}
          <Button variant="primary" disabled={hideSensitive || Boolean(validation) || planSyncing || planPending} aria-busy={planSyncing} onClick={save}>{planSyncing ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} {planSyncing ? 'Saving…' : 'Save targets'}</Button>
        </div>
      </section>

      <section className="w-full min-w-0 rounded-2xl border border-border/60 bg-card p-4 sm:p-6 shadow-xs">
        <div className="min-w-0">
          <h3 className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
            Investment classification <RowSyncStatus isSyncing={orderSyncing} isPending={orderPending} entityLabel="classification order" />
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground break-words">Every open holding needs a basket. Drag a grip, or focus it and press Up or Down, to change the order.</p>
        </div>
        <Reorder.Group
          axis="y"
          values={orderedAssignments}
          onReorder={reorderAssignments}
          className="mt-4 space-y-2.5 max-h-[380px] overflow-y-auto pr-1 w-full min-w-0"
        >
          {orderedAssignments.map((value, index) => (
            <InvestmentClassificationRow
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
