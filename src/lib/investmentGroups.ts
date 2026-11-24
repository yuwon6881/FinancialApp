import type { InvestmentGroup, InvestmentPlan } from '../types'

export function getInvestmentGroups(plan: InvestmentPlan): InvestmentGroup[] {
  if (plan.groups) return plan.groups
  if (plan.usEquityTarget === undefined || plan.internationalExUsTarget === undefined || plan.bondsTarget === undefined) return []
  return [
    { key: 'USEquity', label: 'US Equity', targetPercentage: plan.usEquityTarget, forecastClass: 'USEquity' },
    { key: 'InternationalExUS', label: 'International ex-US', targetPercentage: plan.internationalExUsTarget, forecastClass: 'InternationalExUS' },
    { key: 'Bonds', label: 'Bonds', targetPercentage: plan.bondsTarget, forecastClass: 'Bonds' },
  ]
}

export const groupingEnabled = (plan: InvestmentPlan) => plan.groupingEnabled ?? true
export const targetsEnabled = (plan: InvestmentPlan) => plan.targetsEnabled ?? true
export const hasActiveGroups = (plan: InvestmentPlan) => groupingEnabled(plan) && getInvestmentGroups(plan).length > 0
export const hasActiveTargets = (plan: InvestmentPlan) => hasActiveGroups(plan) && targetsEnabled(plan)

export const MAX_INVESTMENT_GROUPS = 20

export function groupTargetStep(groups: readonly InvestmentGroup[]): number {
  return groups.every(group => Number.isInteger(group.targetPercentage)) ? 1 : 0.01
}

export function groupTargetLimit(groups: readonly InvestmentGroup[], lockedKey: string | null): number {
  const locked = groups.find(group => group.key === lockedKey)
  const step = groupTargetStep(groups)
  const adjustable = groups.length - Number(Boolean(locked))
  return Math.round((100 - (locked?.targetPercentage ?? 0) - (adjustable - 1) * step) * 100) / 100
}

/** Distribute whole slider steps by weight, giving rounding leftovers to the largest remainders. */
function splitTargets(groups: readonly InvestmentGroup[], budget: number, scale: number) {
  const totalWeight = groups.reduce((total, group) => total + group.targetPercentage, 0)
  const targets = groups.map((group, index) => {
    const share = budget * group.targetPercentage / totalWeight
    const units = Math.max(1, Math.floor(share))
    return { index, units, remainder: share - units }
  })
  let remaining = budget - targets.reduce((total, target) => total + target.units, 0)
  if (remaining > 0) {
    for (const target of [...targets].sort((left, right) => right.remainder - left.remainder)) {
      if (remaining-- <= 0) break
      target.units++
    }
  } else if (remaining < 0) {
    for (const target of [...targets].sort((left, right) => left.remainder - right.remainder)) {
      const recovered = Math.min(target.units - 1, -remaining)
      target.units -= recovered
      remaining += recovered
      if (remaining === 0) break
    }
  }
  return targets.map(({ index, units }) => ({ ...groups[index], targetPercentage: units / scale }))
}

export function changeGroupTarget(
  groups: readonly InvestmentGroup[], key: string, requested: number, lockedKey: string | null = null,
): InvestmentGroup[] {
  if (key === lockedKey || !groups.some(group => group.key === key)) return [...groups]
  const scale = 1 / groupTargetStep(groups)
  const lockedUnits = Math.round((groups.find(group => group.key === lockedKey)?.targetPercentage ?? 0) * scale)
  const others = groups.filter(group => group.key !== key && group.key !== lockedKey)
  const available = 100 * scale - lockedUnits
  const units = others.length === 0 ? available : Math.max(1, Math.min(available - others.length, Math.round(requested * scale)))
  const updated = new Map(splitTargets(others, available - units, scale).map(group => [group.key, group]))
  return groups.map(group => group.key === key ? { ...group, targetPercentage: units / scale } : updated.get(group.key) ?? group)
}

/** A usable target mix: every group above zero and the whole plan at exactly 100%. */
export function hasCompleteTargets(groups: readonly InvestmentGroup[]) {
  return groups.length > 0 && groups.every(group => group.targetPercentage > 0)
    && groups.reduce((sum, group) => sum + Math.round(group.targetPercentage * 100), 0) === 10000
}

/**
 * Removes a group. A complete mix is spread back over the groups that remain; while targets are
 * off the shares carry no meaning, so they are left untouched rather than invented.
 */
export function removeInvestmentGroup(groups: readonly InvestmentGroup[], key: string): InvestmentGroup[] {
  const remaining = groups.filter(group => group.key !== key)
  if (!hasCompleteTargets(groups) || remaining.length === 0) return remaining
  const scale = 1 / groupTargetStep(groups)
  return splitTargets(remaining, 100 * scale, scale)
}

/** Adds a group, taking a small share from the others only while the mix is in use. */
export function addInvestmentGroup(groups: readonly InvestmentGroup[], label: string, targetsActive: boolean): InvestmentGroup[] {
  const added: InvestmentGroup = { key: crypto.randomUUID().replaceAll('-', ''), label, targetPercentage: 0, forecastClass: null }
  if (!targetsActive || !hasCompleteTargets(groups)) return [...groups, added]
  return changeGroupTarget([...groups, added], added.key, 5)
}

/**
 * Whole-percent targets weighted by `weights` (missing or zero weights still get 1%), or an even
 * split when no weight is known. Used for "Split evenly", "Match current mix" and the first mix a
 * person gets when they turn targets on.
 */
export function weightedGroupTargets(groups: readonly InvestmentGroup[], weights?: ReadonlyMap<string, number>) {
  if (groups.length === 0) return []
  const known = weights && [...groups].reduce((sum, group) => sum + Math.max(0, weights.get(group.key) ?? 0), 0) > 0
  const weighted = groups.map(group => ({ ...group, targetPercentage: known ? Math.max(0, weights.get(group.key) ?? 0) : 1 }))
  return splitTargets(weighted, 100, 1)
}

/**
 * Each group's share of the money already sorted into groups, by key — or undefined when any
 * draft group's value is unknown. A group that is not saved yet holds nothing, so it counts as 0.
 */
export function currentGroupMix(
  groups: readonly InvestmentGroup[],
  sleeves: ReadonlyArray<{ sleeve: string; value?: number | null }>,
): Map<string, number> | undefined {
  const values = new Map(sleeves.map(sleeve => [sleeve.sleeve, sleeve.value]))
  const mix = new Map<string, number>()
  for (const group of groups) {
    const value = values.has(group.key) ? values.get(group.key) : 0
    if (value == null || !Number.isFinite(value)) return undefined
    mix.set(group.key, Math.max(0, value))
  }
  return [...mix.values()].some(value => value > 0) ? mix : undefined
}

/** Names the investments a save would move to "Not sorted", so removing a group is never a surprise. */
export function releasedByRemoval<T extends { sleeve?: string | null }>(groups: readonly InvestmentGroup[], assignments: readonly T[]): T[] {
  const kept = new Set(groups.map(group => group.key))
  return assignments.filter(assignment => assignment.sleeve && !kept.has(assignment.sleeve))
}

export const investmentGroupColor = (index: number) => [
  'var(--primary)', 'var(--color-amber-500)', 'var(--color-emerald-500)', 'var(--color-sky-500)',
  'var(--color-pink-500)', 'var(--color-orange-500)', 'var(--color-violet-500)',
][index % 7]
