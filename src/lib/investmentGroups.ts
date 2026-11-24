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

export function removeInvestmentGroup(groups: readonly InvestmentGroup[], key: string): InvestmentGroup[] {
  const remaining = groups.filter(group => group.key !== key)
  const scale = 1 / groupTargetStep(groups)
  return remaining.length ? splitTargets(remaining, 100 * scale, scale) : []
}

/** Restore the saved mix for the groups still present, then normalize after membership edits. */
export function resetGroupTargets(groups: readonly InvestmentGroup[], saved: readonly InvestmentGroup[]) {
  const weights = new Map(saved.map(group => [group.key, group.targetPercentage]))
  const restored = groups.map(group => ({ ...group, targetPercentage: weights.get(group.key) ?? group.targetPercentage }))
  const scale = 1 / groupTargetStep(restored)
  return restored.length ? splitTargets(restored, 100 * scale, scale) : []
}

export const investmentGroupColor = (index: number) => [
  'var(--primary)', 'var(--color-amber-500)', 'var(--color-emerald-500)', 'var(--color-sky-500)',
  'var(--color-pink-500)', 'var(--color-orange-500)', 'var(--color-violet-500)',
][index % 7]
