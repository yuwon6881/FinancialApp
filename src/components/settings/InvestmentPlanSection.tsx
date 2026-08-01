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
}: {
  value: InvestmentAllocationOverview['assignments'][number]
  classify: (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => void
  onReorderFinished: () => void
}) {
  const controls = useDragControls()
  const reduceMotion = useReducedMotion()

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onReorderFinished}
      layout="position"
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 38 }}
      whileDrag={reduceMotion ? undefined : { scale: 1.015, boxShadow: 'var(--app-shadow)' }}
      className="grid touch-pan-y gap-2 rounded-xl border border-border/50 bg-muted/20 p-3 sm:grid-cols-[auto_minmax(0,1fr)_190px] sm:items-center"
    >
      <button
        type="button"
        aria-label={`Reorder ${value.symbol}`}
        onPointerDown={event => controls.start(event)}
        className="row-start-1 inline-flex size-8 touch-none cursor-grab items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground active:cursor-grabbing sm:row-auto"
      >
        <GripVertical className="size-4" />
      </button>
      <div className="min-w-0">
        <strong className="block truncate text-xs text-foreground">{value.symbol}</strong>
        <span className="block truncate text-[10px] text-muted-foreground">{value.name}</span>
      </div>
      <CustomSelect
        ariaLabel={`Classify ${value.symbol}`}
        value={value.sleeve ?? ''}
        onChange={next => classify(value.instrumentId, String(next) === '' ? undefined : String(next) as InvestmentAllocationSleeve)}
        options={[
          { value: '', label: 'Unassigned' },
          { value: 'USEquity', label: 'US Equity' },
          { value: 'InternationalExUS', label: 'International ex-US' },
          { value: 'Bonds', label: 'Bonds' },
        ]}
        className="col-span-2 w-full sm:col-span-1"
      />
    </Reorder.Item>
  )
}

export function InvestmentPlanSection() {
  const {
    isOffline,
    operations = [],
    queueMutation = () => undefined,
  } = useAppContext()
  const investmentOps = useMemo(
    () => operations.filter(operation => operation.entity.startsWith('investment')),
    [operations],
  )
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
    setPlan(previous => ({
      ...previous,
      ...redistributeInvestmentTargets(previous, key, value, lockedSleeve ?? undefined),
    }))
  }

  const toggleSleeveLock = (key: TargetKey) => {
    setLockedSleeve(current => {
      if (current === key) return null
      // Three sleeves need two adjustable values to preserve a 100% total. Keep the
      // first lock in place until the user explicitly unlocks it.
      return current ?? key
    })
  }

  const save = () => {
    if (validation) return
    const payload = {
      usEquityTarget: plan.usEquityTarget,
      internationalExUsTarget: plan.internationalExUsTarget,
      bondsTarget: plan.bondsTarget,
      watchDrift: plan.watchDrift,
      alertDrift: plan.alertDrift,
    }
    setOverview(previous => previous ? { ...previous, plan: { ...previous.plan, ...payload } } : previous)
    queueMutation('investmentPlan', 'update', 'three-fund', {
      ...payload,
      undoSnapshot: overview?.plan,
    })
  }

  const classify = (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => {
    setOverview(previous => previous ? {
      ...previous,
      assignments: previous.assignments.map(value =>
        value.instrumentId === instrumentId ? { ...value, sleeve } : value),
    } : previous)
    const previousSleeve = overview?.assignments.find(value => value.instrumentId === instrumentId)?.sleeve
    queueMutation('investmentAllocation', 'update', instrumentId, {
      sleeve: sleeve ?? null,
      undoSnapshot: { sleeve: previousSleeve ?? null },
    })
  }

  const orderedAssignments = useMemo(
    () => [...(overview?.assignments ?? [])].sort((left, right) => left.order - right.order),
    [overview?.assignments],
  )
  const reorderAssignments = (assignments: InvestmentAllocationOverview['assignments']) => {
    setOverview(previous => previous ? {
      ...previous,
      assignments: assignments.map((value, order) => ({ ...value, order })),
    } : previous)
  }
  const saveAssignmentOrder = () => {
    const instrumentIds = [...(overview?.assignments ?? [])]
      .sort((left, right) => left.order - right.order)
      .map(value => value.instrumentId)
    const queuedOrder = [...investmentOps].reverse().find(operation =>
      operation.entity === 'investmentAllocationOrder' && operation.type === 'update')
    const previousInstrumentIds = Array.isArray(queuedOrder?.payload?.instrumentIds)
      ? queuedOrder.payload.instrumentIds.filter((id): id is string => typeof id === 'string')
      : [...(cachedOverview()?.assignments ?? [])]
          .sort((left, right) => left.order - right.order)
          .map(value => value.instrumentId)
    queueMutation('investmentAllocationOrder', 'update', 'classification', {
      instrumentIds,
      undoSnapshot: { instrumentIds: previousInstrumentIds },
    })
  }

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
              <h3 className="text-sm font-bold text-foreground">Portfolio targets</h3>
              <p className="mt-1 text-[11px] text-muted-foreground">Changing one sleeve automatically redistributes the other two.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setGlobalTargetLock(!globalTargetLock)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 bg-secondary/60 text-[10px] font-bold text-muted-foreground hover:text-foreground hover:bg-secondary transition cursor-pointer shrink-0 mt-1"
          >
            {globalTargetLock ? <Lock className="size-3" /> : <Unlock className="size-3" />}
            {globalTargetLock ? 'Locked' : 'Unlocked'}
          </button>
        </div>
        <div className="mt-5 space-y-5">
          {([
            ['US Equity', 'usEquityTarget', 'accent-blue-500'],
            ['International ex-US', 'internationalExUsTarget', 'accent-amber-500'],
            ['Bonds', 'bondsTarget', 'accent-emerald-500'],
          ] as const).map(([label, key, accentClass]) => (
            <label key={key} className="space-y-2 block">
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span className="text-muted-foreground flex items-center gap-1.5"><span className="uppercase tracking-wider">{label}</span><button type="button" aria-label={`${lockedSleeve === key ? 'Unlock' : 'Lock'} ${label} target`} onClick={(e) => { e.preventDefault(); toggleSleeveLock(key) }} className="p-1 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" disabled={lockedSleeve !== null && lockedSleeve !== key} title={lockedSleeve === key ? "Unlock target" : lockedSleeve ? "Unlock the current target before locking another" : "Lock target"}>{lockedSleeve === key ? <Lock className="size-3.5 text-blue-500" /> : <Unlock className="size-3.5" />}</button></span>
                <span className="text-foreground bg-secondary px-2 py-0.5 rounded-md">{plan[key]}%</span>
              </div>
              <RangeInput
                aria-label={`${label} target`}
                min="1"
                max="98"
                step="1"
                disabled={globalTargetLock || lockedSleeve === key}
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
              Drift is the percentage-point gap between a sleeve's actual share and its target. For example, 62% versus a 66% target is 4 points off.
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
                  <Input type="number" min="1" max="99" step="1" value={plan.watchDrift} onChange={event => setPlan(value => ({ ...value, watchDrift: Number(event.target.value) }))} className="pr-8" />
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
                  <Input type="number" min="2" max="100" step="1" value={plan.alertDrift} onChange={event => setPlan(value => ({ ...value, alertDrift: Number(event.target.value) }))} className="pr-8" />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">pp</span>
                </span>
              </FormField>
            </div>
          </div>
          {(validation || error) && <p role="alert" className="flex gap-2 text-xs text-destructive"><AlertCircle className="size-4 shrink-0" />{validation || error}</p>}
          <Button variant="primary" disabled={Boolean(validation)} onClick={save}><Save className="size-4" /> Save targets</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="text-sm font-bold text-foreground">Investment classification</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Every open holding needs an explicit sleeve. Multiple funds may share one sleeve.</p>
        <Reorder.Group
          axis="y"
          values={orderedAssignments}
          onReorder={reorderAssignments}
          className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-2"
        >
          {orderedAssignments.map(value => (
            <ClassificationRow key={value.instrumentId} value={value} classify={classify} onReorderFinished={saveAssignmentOrder} />
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
