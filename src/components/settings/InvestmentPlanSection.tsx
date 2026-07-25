import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Info, Loader2, Save, SlidersHorizontal, Lock, Unlock } from 'lucide-react'
import type {
  InvestmentAllocationOverview,
  InvestmentAllocationSleeve,
  InvestmentPlan,
} from '../../types'
import * as api from '../../lib/api'
import { useAppContext } from '../../contexts/AppContext'
import { CustomSelect } from '../ui/CustomSelect'
import { Button } from '../ui/Button'
import { redistributeInvestmentTargets } from '../../lib/investmentAllocation'

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
    investmentOps = [],
    queueInvestmentMutation = () => undefined,
  } = useAppContext()
  const cachedOverview = () => api.readCachedInvestmentPortfolio()?.allocation ?? null
  const [overview, setOverview] = useState<InvestmentAllocationOverview | null>(() => cachedOverview())
  const [plan, setPlan] = useState<InvestmentPlan>(() => cachedOverview()?.plan ?? defaults)
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
        setOverview(value)
        setPlan(value.plan)
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
    queueInvestmentMutation('investmentPlan', 'update', 'three-fund', payload)
  }

  const classify = (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => {
    setOverview(previous => previous ? {
      ...previous,
      assignments: previous.assignments.map(value =>
        value.instrumentId === instrumentId ? { ...value, sleeve } : value),
    } : previous)
    queueInvestmentMutation('investmentAllocation', 'update', instrumentId, { sleeve: sleeve ?? null })
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
              <input
                aria-label={`${label} target`}
                type="range"
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
              <label className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs font-semibold text-foreground">
                Watch when off by
                <span className="relative mt-2 block">
                  <input aria-label="Watch drift" aria-describedby="watch-drift-help" type="number" min="1" max="99" step="1" value={plan.watchDrift} onChange={event => setPlan(value => ({ ...value, watchDrift: Number(event.target.value) }))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 pr-8 text-sm text-foreground" />
                  <span className="pointer-events-none absolute right-3 top-2 text-xs text-muted-foreground">pp</span>
                </span>
                <span id="watch-drift-help" className="mt-1.5 block text-[9px] font-normal leading-relaxed text-muted-foreground">Shows an early warning; guidance may use new money to correct it.</span>
              </label>
              <label className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3 text-xs font-semibold text-foreground">
                Alert when off by
                <span className="relative mt-2 block">
                  <input aria-label="Alert drift" aria-describedby="alert-drift-help" type="number" min="2" max="100" step="1" value={plan.alertDrift} onChange={event => setPlan(value => ({ ...value, alertDrift: Number(event.target.value) }))} className="w-full rounded-xl border border-border/60 bg-background px-3 py-2 pr-8 text-sm text-foreground" />
                  <span className="pointer-events-none absolute right-3 top-2 text-xs text-muted-foreground">pp</span>
                </span>
                <span id="alert-drift-help" className="mt-1.5 block text-[9px] font-normal leading-relaxed text-muted-foreground">Marks a larger mismatch that may eventually require rebalancing.</span>
              </label>
            </div>
          </div>
          {(validation || error) && <p role="alert" className="flex gap-2 text-xs text-destructive"><AlertCircle className="size-4 shrink-0" />{validation || error}</p>}
          <Button variant="primary" disabled={Boolean(validation)} onClick={save}><Save className="size-4" /> Save targets</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="text-sm font-bold text-foreground">Investment classification</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Every open holding needs an explicit sleeve. Multiple funds may share one sleeve.</p>
        <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto pr-2">
          {overview?.assignments.map(value => (
            <div key={value.instrumentId} className="grid gap-2 rounded-xl border border-border/50 bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_190px] sm:items-center">
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
                className="w-full"
              />
            </div>
          ))}
          {!overview?.assignments.length && (
            <p className="rounded-xl border border-dashed border-border/60 p-5 text-center text-xs text-muted-foreground">
              Add investments first, then return here to classify them.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
