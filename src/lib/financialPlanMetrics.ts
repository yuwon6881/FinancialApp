import type { CategorySummary } from '../types'

const clampPercent = (value: number) => Math.max(0, Math.min(1, value))

export function calculateGrowthMetric(category: CategorySummary | undefined, pending: number) {
  const target = category?.target ?? 0
  const currentRaw = target > 0 ? (category?.netChange ?? 0) / target : 0
  const projectedRaw = target > 0 ? ((category?.netChange ?? 0) - pending) / target : 0
  const currentPct = clampPercent(currentRaw)
  const safePct = clampPercent(projectedRaw)
  return {
    target,
    currentPct,
    pending,
    projectedRemaining: (category?.remaining ?? 0) - pending,
    atRiskPct: pending > 0 ? Math.max(0, currentPct - safePct) : 0,
    safePct,
  }
}

export function calculateEssentialsMetric(category: CategorySummary | undefined, pending: number) {
  const totalAvailable = (category?.budget ?? 0) + (category?.incomeAllocated ?? category?.target ?? 0)
  const currentPct = totalAvailable > 0 ? clampPercent((category?.remaining ?? 0) / totalAvailable) : 0
  const projectedRemaining = (category?.remaining ?? 0) - pending
  const projectedPct = totalAvailable > 0 ? clampPercent(projectedRemaining / totalAvailable) : currentPct
  return {
    totalAvailable,
    currentPct,
    pending,
    projectedRemaining,
    projectedPct,
    atRiskPct: pending > 0 ? Math.max(0, currentPct - projectedPct) : 0,
  }
}

export function calculateStabilityMetric(
  category: CategorySummary | undefined,
  target: number,
  pending: number,
) {
  const hasTarget = target > 0
  const currentBalance = category?.remaining ?? 0
  const currentPct = hasTarget ? clampPercent(currentBalance / target) : 0
  const projectedBalance = currentBalance - pending
  const projectedPct = hasTarget ? clampPercent(projectedBalance / target) : currentPct
  return {
    hasTarget,
    currentPct,
    pending,
    currentBalance,
    projectedBalance,
    projectedPct,
    atRiskPct: pending > 0 ? Math.max(0, currentPct - projectedPct) : 0,
  }
}
