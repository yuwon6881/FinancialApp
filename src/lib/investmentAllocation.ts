import type { InvestmentAllocationStatus, InvestmentAllocationSleeve, InvestmentInstrument, InvestmentPlan } from '../types'

/**
 * `key` is what code groups and matches on; `label` is only ever shown to a person.
 * They are kept apart deliberately: the backend sends its own sleeve labels, and
 * matching those strings against a copy of them here would silently produce empty
 * baskets the moment either side reworded a label.
 */
export type SleeveIndexEntry = {
  sleeve?: InvestmentAllocationSleeve
  key: string
  label: string
}

export const UNASSIGNED_SLEEVE_KEY = 'Unassigned'

const sleeveLabels: Record<InvestmentAllocationSleeve, string> = {
  USEquity: 'US shares',
  InternationalExUS: 'Shares outside the US',
  Bonds: 'Bonds',
}

const unassignedSleeve: SleeveIndexEntry = { key: UNASSIGNED_SLEEVE_KEY, label: 'Not sorted yet' }

export function buildSleeveIndex(instruments: InvestmentInstrument[]) {
  return new Map(instruments.map(instrument => [
    instrument.id,
    instrument.allocationSleeve
      ? {
          sleeve: instrument.allocationSleeve,
          key: instrument.allocationSleeve,
          label: sleeveLabels[instrument.allocationSleeve],
        }
      : unassignedSleeve,
  ]))
}

export function sleeveOf(
  holding: { instrumentId: string },
  index: Map<string, SleeveIndexEntry>,
): SleeveIndexEntry {
  return index.get(holding.instrumentId) ?? unassignedSleeve
}

/** The human label for a sleeve key, for UI that only has the key to hand. */
export function sleeveLabelFor(key: string, index: Map<string, SleeveIndexEntry>) {
  if (key === UNASSIGNED_SLEEVE_KEY) return unassignedSleeve.label
  return [...index.values()].find(entry => entry.key === key)?.label ?? key
}

const statusLabels: Record<InvestmentAllocationStatus, string> = {
  NotStarted: 'Not started',
  Incomplete: 'Needs sorting',
  OnTrack: 'On track',
  Watch: 'Drifting',
  Alert: 'Off target',
}

/** Status codes arrive as `OnTrack`/`NotStarted`; never show those to a person. */
export function allocationStatusLabel(status: InvestmentAllocationStatus) {
  return statusLabels[status]
}

export function validateInvestmentPlan(plan: InvestmentPlan) {
  const targets = [plan.usEquityTarget, plan.internationalExUsTarget, plan.bondsTarget]
  const driftBands = [plan.watchDrift, plan.alertDrift]
  if (![...targets, ...driftBands].every(Number.isFinite)) return 'Targets and drift bands must be valid numbers.'
  if (targets.some(value => value <= 0) || targets.reduce((sum, value) => sum + value, 0) !== 100)
    return 'Targets must be positive and total exactly 100%.'
  if (plan.watchDrift <= 0 || plan.alertDrift <= plan.watchDrift || plan.alertDrift > 100)
    return 'Alert drift must be greater than Watch drift and no more than 100 points.'
  return ''
}

type TargetKey = 'usEquityTarget' | 'internationalExUsTarget' | 'bondsTarget'

export function redistributeInvestmentTargets(
  current: Pick<InvestmentPlan, TargetKey>,
  changed: TargetKey,
  requested: number,
  lockedKey?: TargetKey,
): Pick<InvestmentPlan, TargetKey> {
  const keys: TargetKey[] = ['usEquityTarget', 'internationalExUsTarget', 'bondsTarget']
  const value = Math.max(1, Math.min(lockedKey ? 99 - current[lockedKey] : 98, Math.round(requested)))
  const others = keys.filter(key => key !== changed)
  const remainder = 100 - value
  
  if (lockedKey && lockedKey !== changed) {
    const unlockedOther = others.find(key => key !== lockedKey)!
    const lockedValue = current[lockedKey]
    const remainingForUnlocked = Math.max(1, remainder - lockedValue)
    const finalLockedValue = Math.max(1, remainder - remainingForUnlocked)
    return {
      ...current,
      [changed]: value,
      [lockedKey]: finalLockedValue,
      [unlockedOther]: remainingForUnlocked,
    }
  }

  const otherTotal = current[others[0]] + current[others[1]]
  const first = Math.max(1, Math.min(remainder - 1,
    Math.round(remainder * (otherTotal > 0 ? current[others[0]] / otherTotal : 0.5))))
  return {
    ...current,
    [changed]: value,
    [others[0]]: first,
    [others[1]]: remainder - first,
  }
}
