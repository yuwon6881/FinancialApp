import type { DashboardData, WishlistItem } from '../types'
import { getCycleRangeDates } from './cycle'

const ENVELOPES = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
const EPSILON = 0.005

export function formatRate(value: number): string {
  return `${Math.round(value * 100)}%`
}

export function formatRateChange(value: number): string {
  const points = Math.round(Math.abs(value) * 100)
  if (points === 0) return 'No change'
  return `${points} ${points === 1 ? 'point' : 'points'} ${value > 0 ? 'higher' : 'lower'}`
}

export function buildCycleSummary(
  data: DashboardData,
  previousData: DashboardData | null,
  wishlist: WishlistItem[],
  year: number,
  monthIndex: number,
  cycleDay: number,
) {
  const income = data.stats.monthlyIncome
  const inflow = data.stats.monthlyInflow
  const expenses = data.stats.monthlyExpenses
  const net = inflow - expenses
  const envelopes = ENVELOPES.map(name => {
    const category = data.categories.find(item => item.name === name)
    return {
      name,
      spent: category?.spent ?? Math.max(0, -(category?.netChange ?? 0)),
      remaining: category?.remaining ?? 0,
      overspent: (category?.remaining ?? 0) < -EPSILON,
    }
  })

  const topCategories = [...(data.monthlyCategoryBreakdown || [])]
    .filter(category => category.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)
  const topMax = topCategories.reduce((max, category) => Math.max(max, category.amount), 0)
  const bills = data.activeRecurringPayments || []
  const paidBills = bills.filter(bill => bill.status === 'Paid')
  const { start, end } = getCycleRangeDates(year, monthIndex, cycleDay)
  const purchasedThisCycle = wishlist.filter(item => {
    if (!item.isPurchased || !item.purchasedAt) return false
    const purchasedAt = new Date(item.purchasedAt)
    return !Number.isNaN(purchasedAt.getTime()) && purchasedAt >= start && purchasedAt <= end
  })

  const previousExpenses = previousData?.stats.monthlyExpenses ?? null
  const previousInflow = previousData?.stats.monthlyInflow ?? null
  const previousNet = previousInflow === null || previousExpenses === null ? null : previousInflow - previousExpenses
  const savingsRate = inflow > EPSILON ? net / inflow : null
  const previousSavingsRate = previousInflow !== null && previousInflow > EPSILON && previousNet !== null
    ? previousNet / previousInflow
    : null
  const spendingDelta = previousExpenses === null ? null : expenses - previousExpenses

  const previousBreakdown = new Map(
    (previousData?.monthlyCategoryBreakdown || []).map(category => [category.category, category.amount]),
  )
  const currentBreakdown = new Map((data.monthlyCategoryBreakdown || []).map(category => [category.category, category.amount]))
  const categoryNames = new Set([...currentBreakdown.keys(), ...previousBreakdown.keys()])
  const biggestCategoryShift = [...categoryNames]
    .map(category => ({
      category,
      delta: (currentBreakdown.get(category) || 0) - (previousBreakdown.get(category) || 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] || null

  const growthNow = data.categories.find(category => category.name === 'Growth')?.remaining ?? null
  const growthBefore = previousData?.categories.find(category => category.name === 'Growth')?.remaining ?? null
  const growthDelta = growthNow === null || growthBefore === null ? null : growthNow - growthBefore
  const hasActivity = inflow > EPSILON || expenses > EPSILON || paidBills.length > 0 || purchasedThisCycle.length > 0
  const previousHasActivity = previousData != null && (
    (previousInflow ?? 0) > EPSILON || (previousExpenses ?? 0) > EPSILON ||
    (previousData.monthlyCategoryBreakdown || []).length > 0
  )

  return {
    income,
    inflow,
    expenses,
    net,
    positive: net >= 0,
    hasActivity,
    previousHasActivity,
    savingsRate,
    previousSavingsRate,
    spendingDelta,
    biggestCategoryShift: biggestCategoryShift && Math.abs(biggestCategoryShift.delta) > EPSILON
      ? biggestCategoryShift
      : null,
    growthDelta,
    envelopes,
    stabilityPct: Math.max(0, Math.min(1, data.stats.stabilityPercentReached)),
    stabilityTarget: data.setting.targetStabilityFund,
    topCategories,
    topMax,
    paidBillsCount: paidBills.length,
    paidTotal: paidBills.reduce((sum, bill) => sum + Math.abs(bill.amount), 0),
    pendingCount: bills.filter(bill => bill.status === 'Pending').length,
    discardedCount: bills.filter(bill => bill.status === 'Discarded').length,
    billsCount: bills.length,
    purchasedThisCycle,
    purchasedTotal: purchasedThisCycle.reduce((sum, item) => sum + item.price, 0),
    cycleLabel: data.cycleLabel,
  }
}
