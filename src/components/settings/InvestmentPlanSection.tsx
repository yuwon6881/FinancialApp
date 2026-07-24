import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Loader2, Save, SlidersHorizontal } from 'lucide-react'
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
    showToast,
  } = useAppContext()
  const cachedOverview = () => api.readCachedInvestmentPortfolio()?.allocation ?? null
  const [overview, setOverview] = useState<InvestmentAllocationOverview | null>(() => cachedOverview())
  const [plan, setPlan] = useState<InvestmentPlan>(() => cachedOverview()?.plan ?? defaults)
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
      ...redistributeInvestmentTargets(previous, key, value),
    }))
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
    showToast(
      isOffline ? 'Saved on this device and queued for synchronization.' : 'Saving in the background.',
      'Investment plan',
      'info',
    )
  }

  const classify = (instrumentId: string, sleeve?: InvestmentAllocationSleeve) => {
    setOverview(previous => previous ? {
      ...previous,
      assignments: previous.assignments.map(value =>
        value.instrumentId === instrumentId ? { ...value, sleeve } : value),
    } : previous)
    queueInvestmentMutation('investmentAllocation', 'update', instrumentId, { sleeve: sleeve ?? null })
    showToast(
      isOffline ? 'Classification queued until you reconnect.' : 'Classification is saving in the background.',
      'Investment classification',
      'info',
    )
  }

  if (loading && !overview) {
    return <div className="flex h-40 items-center justify-center"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div id="settings-panel-investment-plan" role="tabpanel" aria-labelledby="settings-tab-investment-plan" className="grid gap-6 lg:grid-cols-2 animate-in fade-in duration-200">
      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3 border-b border-border/40 pb-4">
          <div className="rounded-xl bg-violet-500/10 p-2 text-violet-500"><SlidersHorizontal className="size-4" /></div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Portfolio targets</h3>
            <p className="mt-1 text-[11px] text-muted-foreground">Changing one sleeve automatically redistributes the other two.</p>
          </div>
        </div>
        <div className="mt-5 space-y-5">
          {([
            ['US Equity', 'usEquityTarget'],
            ['International ex-US', 'internationalExUsTarget'],
            ['Bonds', 'bondsTarget'],
          ] as const).map(([label, key]) => (
            <label key={key} className="block">
              <span className="flex justify-between text-xs font-bold text-muted-foreground">
                <span>{label}</span><span className="text-foreground">{plan[key]}%</span>
              </span>
              <input
                aria-label={`${label} target`}
                type="range"
                min="1"
                max="98"
                step="1"
                value={plan[key]}
                onChange={event => changeTarget(key, Number(event.target.value))}
                className="mt-2 h-2 w-full cursor-pointer accent-violet-500"
              />
            </label>
          ))}
          <div className="rounded-xl bg-muted/30 px-3 py-2 text-xs font-bold text-foreground">Total: {total}%</div>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">
              Watch drift (pp)
              <input aria-label="Watch drift" type="number" min="1" max="99" step="1" value={plan.watchDrift} onChange={event => setPlan(value => ({ ...value, watchDrift: Number(event.target.value) }))} className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground" />
            </label>
            <label className="text-xs font-semibold text-muted-foreground">
              Alert drift (pp)
              <input aria-label="Alert drift" type="number" min="2" max="100" step="1" value={plan.alertDrift} onChange={event => setPlan(value => ({ ...value, alertDrift: Number(event.target.value) }))} className="mt-1.5 w-full rounded-xl border border-border/60 bg-background px-3 py-2 text-sm text-foreground" />
            </label>
          </div>
          {(validation || error) && <p role="alert" className="flex gap-2 text-xs text-destructive"><AlertCircle className="size-4 shrink-0" />{validation || error}</p>}
          <Button variant="primary" disabled={Boolean(validation)} onClick={save}><Save className="size-4" /> Save targets</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6">
        <h3 className="text-sm font-bold text-foreground">Investment classification</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Every open holding needs an explicit sleeve. Multiple funds may share one sleeve.</p>
        <div className="mt-4 space-y-3">
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
