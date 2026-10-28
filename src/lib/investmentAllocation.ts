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

/**
 * Rounds shares to one decimal so the rounded numbers still add up to 100.0 (largest-remainder
 * method). Independent rounding can leave a plan reading 99.9% or 100.1% although the exact
 * shares sum to 100. Returns null when the shares are not a full split (they do not sum to
 * about 100, e.g. some funds are not sorted into a basket), so callers fall back to plain rounding.
 */
export function roundSharesToTenth(shares: readonly number[]): number[] | null {
  if (shares.length === 0) return null
  if (shares.some(share => !Number.isFinite(share) || share < 0)) return null

  const sum = shares.reduce((acc, v) => acc + v, 0)
  if (Math.abs(sum - 100) > 0.2) return null

  const scaled = shares.map(share => share * 10)
  const floors = scaled.map(s => Math.floor(s + 1e-9))
  const remainders = scaled.map((s, index) => s - floors[index])

  const sumFloors = floors.reduce((acc, v) => acc + v, 0)
  const missing = 1000 - sumFloors
  if (missing < 0 || missing > shares.length) return null

  // Entries with the largest remainders receive +1 tenth; ties favor the earlier index.
  const rankedIndices = shares
    .map((_, index) => index)
    .sort((a, b) => remainders[b] - remainders[a] || a - b)

  const bonusIndices = new Set(rankedIndices.slice(0, missing))
  const result = floors.map((floor, index) => (floor + (bonusIndices.has(index) ? 1 : 0)) / 10)

  if (Math.round(result.reduce((acc, v) => acc + v, 0) * 10) !== 1000) return null

  return result
}
