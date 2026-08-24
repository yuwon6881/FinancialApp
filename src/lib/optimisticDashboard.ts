import type { DashboardData, Transaction } from '../types'
import { applyOpsToList, type QueuedOp } from './outbox'
import { getCycleRangeDates, MONTH_NAMES } from './cycle'
import type { IncomeAllocations } from './incomeSplitProjection'
import { netBucketAmount } from './bucketAttribution'
import { buildCycleSummaryInsights, buildReportBreakdown } from './reportCalculations'
import { isReportableInflow, isReportableOutflow } from './transactionReportSemantics'
import { buildStabilityPlanPoints, projectStabilityRecovery } from './stabilityRecovery'

export interface OptimisticDashboardInputs {
  activeOps: QueuedOp[]
  transactions: Transaction[]
}

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const isIncomeTransaction = (transaction: Pick<Transaction, 'amount' | 'ledgerCategory'>) =>
  transaction.amount > 0 && (
    transaction.ledgerCategory.toLowerCase() === 'income' ||
    transaction.ledgerCategory.toLowerCase().startsWith('incomesplit:'))

export function computeOptimisticDashboard(
  dashboardData: DashboardData | null,
  { activeOps, transactions }: OptimisticDashboardInputs,
): DashboardData | null {
  if (!dashboardData) return null

  const data: DashboardData = {
    ...dashboardData,
    setting: { ...dashboardData.setting },
    stats: { ...dashboardData.stats },
    categories: (dashboardData.categories ?? []).map(category => ({ ...category })),
    activeRecurringPayments: (dashboardData.activeRecurringPayments ?? []).map(payment => ({ ...payment })),
    pendingNotifications: (dashboardData.pendingNotifications ?? []).map(notification => ({ ...notification })),
    trendPoints: (dashboardData.trendPoints ?? []).map(point => ({ ...point })),
    last3TrendPoints: (dashboardData.last3TrendPoints ?? []).map(point => ({ ...point })),
    last6TrendPoints: (dashboardData.last6TrendPoints ?? []).map(point => ({ ...point })),
  }

  for (const operation of activeOps) {
    if (operation.entity === 'settings' && operation.type === 'update' && operation.payload) {
      data.setting = { ...data.setting, ...operation.payload }
    }
  }

  const settingsOperations = activeOps.filter(operation =>
    operation.entity === 'settings' && operation.type === 'update')
  const hasSettingsProjection = settingsOperations.length > 0
  const hasTransactionProjection = activeOps.some(operation =>
    operation.entity === 'transaction' ||
    (operation.entity === 'wishlistItem' && ['purchase', 'unpurchase', 'delete'].includes(operation.type)) ||
    (operation.entity === 'recurringPayment' && operation.type === 'payEarly') ||
    (operation.entity === 'recurringOccurrence' && operation.type === 'settle'))

  const selectedMonth = MONTH_NAMES.indexOf(data.setting.selectedMonth) + 1
  const selectedRange = getCycleRangeDates(
    data.setting.selectedYear,
    selectedMonth || 1,
    data.setting.cycleDay,
  )
  const selectedStart = dateKey(selectedRange.start)
  const selectedEnd = dateKey(selectedRange.end)
  const inSelectedCycle = (transaction: Pick<Transaction, 'date'>) =>
    transaction.date >= selectedStart && transaction.date <= selectedEnd
  const stabilityPlanPoints = buildStabilityPlanPoints(
    dashboardData.stabilityRecovery?.target ?? data.setting.targetStabilityFund,
    dashboardData.setting.stabilityAlloc,
    settingsOperations.map(operation => ({
      createdAt: operation.createdAt,
      payload: operation.payload as Record<string, unknown> | undefined,
    })),
  )
  const projectRecovery = (
    baseCycleTransactions: Transaction[],
    projectedCycleTransactions: Transaction[],
    projectedBalance: number,
  ) => {
    if (!data.stabilityRecovery) return
    data.stabilityRecovery = {
      ...projectStabilityRecovery({
        recovery: data.stabilityRecovery,
        baseTransactions: baseCycleTransactions,
        projectedTransactions: projectedCycleTransactions,
        stabilityAlloc: data.setting.stabilityAlloc,
        projectedBalance,
        planPoints: stabilityPlanPoints,
        currentCycleKey: `${data.setting.selectedYear}-${String(selectedMonth).padStart(2, '0')}`,
        cycleDay: data.setting.cycleDay,
      }),
      target: data.setting.targetStabilityFund,
    }
  }

  if (!hasTransactionProjection) {
    if (hasSettingsProjection && data.stabilityRecovery) {
      const cycleTransactions = transactions.filter(inSelectedCycle)
      projectRecovery(cycleTransactions, cycleTransactions, data.stabilityRecovery.currentBalance)
      const stability = data.categories.find(category => category.name.toLowerCase() === 'stability')
      data.stats.stabilityPercentReached = stability && data.setting.targetStabilityFund > 0
        ? Math.max(0, stability.remaining / data.setting.targetStabilityFund)
        : 0
    }
    return data
  }

  const incomeAllocations: IncomeAllocations = {
    essentialsAlloc: data.setting.essentialsAlloc,
    growthAlloc: data.setting.growthAlloc,
    stabilityAlloc: data.setting.stabilityAlloc,
    rewardsAlloc: data.setting.rewardsAlloc,
  }

  // The outbox projection already models add/update/delete, bulk restore/delete, recurring
  // settlement, pay-early, and wishlist-linked rows. Recomputing from that one projected list
  // keeps old-date/new-date transitions and every queue state on the same path.
  const projectedTransactions = applyOpsToList(transactions, activeOps, 'transaction', { incomeAllocations })
    .filter(transaction => !transaction.isPendingDelete)
  const baseCycleTransactions = transactions.filter(inSelectedCycle)
  const projectedCycleTransactions = projectedTransactions.filter(inSelectedCycle)
  const bucketTransactions = (items: Transaction[]) => {
    // Generated income rows used to ask the whole list whether each parent had a split child.
    // The dashboard is already replaying a large list here, so make that relationship a single
    // pass instead of an O(n²) nested scan.
    const splitParentIds = new Set(
      items
        .map(item => {
          const id = String(item.id)
          const marker = id.indexOf('-split-')
          return marker > 0 ? id.slice(0, marker) : null
        })
        .filter((id): id is string => id !== null),
    )
    return items.filter(transaction =>
      !transaction.ledgerCategory.toLowerCase().startsWith('incomesplit:') ||
      !splitParentIds.has(String(transaction.id)))
  }
  const baseBucketTransactions = bucketTransactions(baseCycleTransactions)
  const projectedBucketTransactions = bucketTransactions(projectedCycleTransactions)
  const buckets = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
  const bucketDeltas = new Map<string, number>()

  for (const bucket of buckets) {
    const delta = netBucketAmount(projectedBucketTransactions, bucket) -
      netBucketAmount(baseBucketTransactions, bucket)
    bucketDeltas.set(bucket, delta)
    const category = data.categories.find(item => item.name.toLowerCase() === bucket.toLowerCase())
    if (!category) continue
    category.netChange += delta
    category.remaining += delta
    category.spent = projectedCycleTransactions
      .filter(transaction =>
        isReportableOutflow(transaction) &&
        transaction.ledgerCategory.toLowerCase() === bucket.toLowerCase())
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
    category.incomeAllocated = projectedBucketTransactions
      .filter(transaction => transaction.amount > 0 && (
        transaction.ledgerCategory.toLowerCase().startsWith('incomesplit:') ||
        transaction.ledgerCategory.toLowerCase().startsWith('transfer:income->')))
      .reduce((sum, transaction) => sum + netBucketAmount([transaction], bucket), 0)
  }

  data.stats.totalBalance += (bucketDeltas.get('Essentials') || 0) +
    (bucketDeltas.get('Stability') || 0) +
    (bucketDeltas.get('Rewards') || 0)
  data.stats.monthlyInflow = projectedCycleTransactions.filter(isReportableInflow)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  data.stats.monthlyExpenses = projectedCycleTransactions.filter(isReportableOutflow)
    .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
  data.stats.monthlyIncome = projectedCycleTransactions.filter(isIncomeTransaction)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
  const baseBreakdown = buildReportBreakdown(baseCycleTransactions)
  const projectedBreakdown = buildReportBreakdown(projectedCycleTransactions)
  const existingBreakdownLabels = new Map(
    (data.monthlyCategoryBreakdown || []).map(item => [item.category.toLocaleLowerCase(), item.category]),
  )
  data.monthlyCategoryBreakdown = projectedBreakdown.map(item => ({
    ...item,
    category: existingBreakdownLabels.get(item.category.toLocaleLowerCase()) || item.category,
  }))
  const applyBreakdownDelta = (existing: DashboardData['monthlyCategoryBreakdown']) => {
    const values = new Map(existing.map(item => [item.category.toLocaleLowerCase(), { ...item }]))
    const base = new Map(baseBreakdown.map(item => [item.category.toLocaleLowerCase(), item.amount]))
    const projected = new Map(projectedBreakdown.map(item => [item.category.toLocaleLowerCase(), item]))
    for (const key of new Set([...base.keys(), ...projected.keys()])) {
      const delta = (projected.get(key)?.amount || 0) - (base.get(key) || 0)
      const current = values.get(key)
      const amount = (current?.amount || 0) + delta
      if (amount <= 0) values.delete(key)
      else values.set(key, { category: current?.category || projected.get(key)?.category || key, amount })
    }
    return [...values.values()].sort((left, right) => right.amount - left.amount || left.category.localeCompare(right.category))
  }
  if (selectedStart <= dateKey(new Date())) {
    data.last3CategoryBreakdown = applyBreakdownDelta(data.last3CategoryBreakdown || [])
    data.last6CategoryBreakdown = applyBreakdownDelta(data.last6CategoryBreakdown || [])
    data.yearlyCategoryBreakdown = applyBreakdownDelta(data.yearlyCategoryBreakdown || [])
  }
  data.cycleSummaryInsights = buildCycleSummaryInsights(
    projectedCycleTransactions,
    selectedRange.start,
    selectedRange.end,
  )

  const selectedCycleKey = `${data.setting.selectedYear}-${String(selectedMonth).padStart(2, '0')}`
  const growthDelta = bucketDeltas.get('Growth') || 0
  const adjustTrend = (points: DashboardData['trendPoints']) => points.map(point =>
    point.cycleKey >= selectedCycleKey ? { ...point, balance: point.balance + growthDelta } : point)
  data.trendPoints = adjustTrend(data.trendPoints)
  data.last3TrendPoints = adjustTrend(data.last3TrendPoints)
  data.last6TrendPoints = adjustTrend(data.last6TrendPoints)

  const growth = data.categories.find(category => category.name.toLowerCase() === 'growth')
  data.stats.growthPercentAchieved = growth && growth.target > 0
    ? Math.max(0, growth.netChange / growth.target)
    : 0

  // Occurrence state is also visible independently from its projected Ledger row.
  for (const operation of activeOps) {
    if (operation.entity !== 'recurringOccurrence' || operation.type !== 'settle') continue
    const paymentId = typeof operation.payload?.recurringPaymentId === 'string'
      ? operation.payload.recurringPaymentId
      : ''
    const occurrenceDate = typeof operation.payload?.occurrenceDate === 'string'
      ? operation.payload.occurrenceDate
      : ''
    const index = data.activeRecurringPayments.findIndex(payment =>
      payment.recurringPaymentId === paymentId && payment.dueDate === occurrenceDate)
    const existing = index >= 0 ? data.activeRecurringPayments[index] : undefined
    // An explicit amount that does not cover what is left is a part payment, and the server will
    // answer PartiallyPaid. Projecting Paid there showed the bill as settled for as long as the
    // queue held, then visibly undid itself on the next refresh.
    const requestedAmount = typeof operation.payload?.amount === 'number' ? operation.payload.amount : undefined
    const scheduled = Math.abs(existing?.scheduledAmount ?? existing?.amount ?? 0)
    const alreadyPaid = existing?.paidAmount ?? 0
    const coversRemainder = requestedAmount == null
      || scheduled <= 0
      || alreadyPaid + requestedAmount >= scheduled - 0.005
    const status = operation.payload?.status === 'Discarded'
      ? 'Discarded'
      : coversRemainder ? 'Paid' : 'PartiallyPaid'

    if (index >= 0 && existing) {
      const paidAmount = status === 'PartiallyPaid' ? alreadyPaid + (requestedAmount ?? 0) : existing.paidAmount
      data.activeRecurringPayments[index] = {
        ...existing,
        status,
        isPaid: status === 'Paid',
        isDiscarded: status === 'Discarded',
        paidAmount,
        // The server sends the still-owed figure as the row's amount while a bill is part paid, so
        // the projection has to narrow it the same way or committed-money totals disagree.
        remainingAmount: status === 'PartiallyPaid' ? Math.max(0, scheduled - (paidAmount ?? 0)) : existing.remainingAmount,
        amount: status === 'PartiallyPaid' ? Math.max(0, scheduled - (paidAmount ?? 0)) : existing.amount,
        paidDate: status === 'Paid' && typeof operation.payload?.paidDate === 'string'
          ? operation.payload.paidDate
          : null,
      }
    }
    // A part-paid bill still needs reviewing, so its prompt stays.
    if (status !== 'PartiallyPaid') {
      data.pendingNotifications = data.pendingNotifications.filter(notification =>
        notification.recurringPaymentId !== paymentId || notification.billingDate !== occurrenceDate)
    }
  }

  const pendingBills = data.activeRecurringPayments.filter(payment =>
    payment.status === 'Pending' || payment.status === 'PartiallyPaid')
  const categoryCollator = new Intl.Collator(undefined, { sensitivity: 'accent' })
  const totalDays = data.cycleSummaryInsights.cycleLengthDays
  const todayKey = dateKey(new Date())
  const elapsedDays = todayKey < selectedStart
    ? 0
    : todayKey > selectedEnd
      ? totalDays
      : Math.round((new Date(todayKey).getTime() - new Date(selectedStart).getTime()) / 86_400_000) + 1
  const isEnded = todayKey > selectedEnd
  data.categoryLimitProgress = (data.categoryLimitProgress ?? []).map(limit => {
    const categoryTransactions = projectedCycleTransactions.filter(transaction =>
      isReportableOutflow(transaction) &&
      categoryCollator.compare(transaction.category, limit.category) === 0)
    const spent = categoryTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
    const recurringSpent = categoryTransactions.filter(transaction => transaction.recurringPaymentId)
      .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
    const nonRecurringSpent = spent - recurringSpent
    const pendingCommitted = pendingBills
      .filter(payment => categoryCollator.compare(payment.category, limit.category) === 0)
      .reduce((sum, payment) => sum + Math.abs(payment.remainingAmount ?? payment.amount ?? 0), 0)
    const projectedSpend = isEnded
      ? spent
      : recurringSpent + pendingCommitted + (elapsedDays > 0 ? nonRecurringSpent / elapsedDays * totalDays : 0)
    return {
      ...limit,
      spent,
      remaining: limit.limit - spent,
      pendingCommitted,
      projectedSpend,
      percentUsed: limit.limit > 0 ? spent / limit.limit : 0,
      status: spent > limit.limit ? 'Exceeded' : projectedSpend > limit.limit ? 'Watch' : 'OnTrack',
    }
  })

  const stabilityDelta = bucketDeltas.get('Stability') || 0
  if (data.stabilityRecovery) {
    projectRecovery(baseCycleTransactions, projectedCycleTransactions, data.stabilityRecovery.currentBalance + stabilityDelta)
  }
  const stability = data.categories.find(category => category.name.toLowerCase() === 'stability')
  data.stats.stabilityPercentReached = stability && data.setting.targetStabilityFund > 0
    ? Math.max(0, stability.remaining / data.setting.targetStabilityFund)
    : 0

  return data
}
