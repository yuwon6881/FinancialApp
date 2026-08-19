import type { DashboardData, Loan, Transaction, WishlistItem } from '../types'
import { getCycleRangeDates } from './cycle'
import { isReportableOutflow } from './transactionReportSemantics'

const ENVELOPES = ['Essentials', 'Growth', 'Stability', 'Rewards'] as const
const EPSILON = 0.005

const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

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
  transactions?: Transaction[],
  loans: Loan[] = [],
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
      accounts: [...(category?.accounts ?? [])]
        .sort((left, right) => Math.abs(right.remaining) - Math.abs(left.remaining) || left.name.localeCompare(right.name)),
    }
  })

  const topCategories = [...(data.monthlyCategoryBreakdown || [])]
    .filter(category => category.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)
  const topMax = topCategories.reduce((max, category) => Math.max(max, category.amount), 0)
  const bills = data.activeRecurringPayments || []
  const paidBills = bills.filter(bill => bill.status === 'Paid')
  const partPaidBills = bills.filter(bill => bill.status === 'PartiallyPaid')
  const paidOffBills = bills.filter(bill => bill.status === 'SettledByLoanPayoff')
  const pendingBills = bills.filter(bill => bill.status === 'Pending')
  const discardedBills = bills.filter(bill => bill.status === 'Discarded')
  const { start, end } = getCycleRangeDates(year, monthIndex, cycleDay)
  const startKey = localDateKey(start)
  const endKey = localDateKey(end)
  const purchasedThisCycle = wishlist.flatMap(item => {
    if (!item.isPurchased) return []
    const linkedTx = transactions?.find(t => t.wishlistItemId === item.id || (item.purchaseTransactionId && String(t.id) === String(item.purchaseTransactionId)))
    const rawDate = linkedTx?.date || item.purchasedAt
    if (!rawDate) return []
    const purchaseDateKey = rawDate.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(purchaseDateKey) || purchaseDateKey < startKey || purchaseDateKey > endKey) return []
    return [{ ...item, price: linkedTx ? Math.abs(linkedTx.amount) : item.price }]
  })

  const loansByPaymentId = new Map(
    loans
      .filter(loan => !loan.isPendingDelete)
      .map(loan => [loan.recurringPaymentId, loan] as const),
  )
  const loanActivityById = new Map<string, {
    id: string
    name: string
    total: number
    paymentCount: number
    paidAheadCount: number
    paidAheadTotal: number
    paidOffThisCycle: boolean
  }>()
  for (const transaction of transactions ?? []) {
    if (!transaction.recurringPaymentId || !isReportableOutflow(transaction)) continue
    const loan = loansByPaymentId.get(transaction.recurringPaymentId)
    if (!loan) continue
    const amount = Math.abs(transaction.amount)
    const postedDate = transaction.date.slice(0, 10)
    const occurrenceDate = transaction.recurringOccurrenceDate?.slice(0, 10)
    const paidAhead = Boolean(occurrenceDate && postedDate && occurrenceDate > postedDate)
    const matchingReplay = loan.snapshot.payments.find(payment => String(payment.transactionId) === String(transaction.id))
    const current = loanActivityById.get(loan.id) ?? {
      id: loan.id,
      name: loan.name,
      total: 0,
      paymentCount: 0,
      paidAheadCount: 0,
      paidAheadTotal: 0,
      paidOffThisCycle: false,
    }
    current.total += amount
    current.paymentCount += 1
    if (paidAhead) {
      current.paidAheadCount += 1
      current.paidAheadTotal += amount
    }
    current.paidOffThisCycle ||= matchingReplay != null && matchingReplay.balanceAfter <= EPSILON
    loanActivityById.set(loan.id, current)
  }
  const loanActivity = [...loanActivityById.values()]
    .sort((left, right) => right.total - left.total || left.name.localeCompare(right.name))

  const previousExpenses = previousData?.stats.monthlyExpenses ?? null
  const previousInflow = previousData?.stats.monthlyInflow ?? null
  const previousIncome = previousData?.stats.monthlyIncome ?? null
  const savingsRate = income > EPSILON ? (income - expenses) / income : null
  const previousSavingsRate = previousIncome !== null && previousIncome > EPSILON && previousExpenses !== null
    ? (previousIncome - previousExpenses) / previousIncome
    : null
  const spendingDelta = previousExpenses === null ? null : expenses - previousExpenses

  const toBreakdownMap = (items: typeof data.monthlyCategoryBreakdown) => {
    const result = new Map<string, { label: string; amount: number }>()
    for (const item of items || []) {
      const key = item.category.trim().toLocaleLowerCase()
      const existing = result.get(key)
      result.set(key, { label: existing?.label || item.category.trim(), amount: (existing?.amount || 0) + item.amount })
    }
    return result
  }
  const previousBreakdown = toBreakdownMap(previousData?.monthlyCategoryBreakdown || [])
  const currentBreakdown = toBreakdownMap(data.monthlyCategoryBreakdown || [])
  const categoryNames = new Set([...currentBreakdown.keys(), ...previousBreakdown.keys()])
  const biggestCategoryShift = [...categoryNames]
    .map(category => ({
      category: currentBreakdown.get(category)?.label || previousBreakdown.get(category)?.label || category,
      delta: (currentBreakdown.get(category)?.amount || 0) - (previousBreakdown.get(category)?.amount || 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] || null

  const growthNow = data.categories.find(category => category.name === 'Growth')?.remaining ?? null
  const growthBefore = previousData?.categories.find(category => category.name === 'Growth')?.remaining ?? null
  const growthDelta = growthNow === null || growthBefore === null ? null : growthNow - growthBefore
  const hasActivity = inflow > EPSILON || expenses > EPSILON || bills.length > 0 || purchasedThisCycle.length > 0
  const previousHasActivity = previousData != null && (
    (previousInflow ?? 0) > EPSILON || (previousExpenses ?? 0) > EPSILON ||
    (previousData.monthlyCategoryBreakdown || []).length > 0
  )

  const insights = data.cycleSummaryInsights
  const categoryLimits = [...(data.categoryLimitProgress || [])]
    .sort((a, b) => {
      const rank = { Exceeded: 0, Watch: 1, OnTrack: 2 } as const
      return rank[a.status] - rank[b.status] || b.percentUsed - a.percentUsed
    })

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
    paidTotal: [...paidBills, ...partPaidBills, ...paidOffBills].reduce(
      (sum, bill) => sum + Math.abs(bill.paidAmount ?? (bill.status === 'Paid' ? bill.amount ?? 0 : 0)),
      0,
    ),
    partPaidCount: partPaidBills.length,
    paidOffBillsCount: paidOffBills.length,
    clearedBillsCount: paidBills.length + paidOffBills.length,
    outstandingCount: pendingBills.length + partPaidBills.length,
    outstandingTotal: [...pendingBills, ...partPaidBills].reduce(
      (sum, bill) => sum + Math.abs(bill.remainingAmount ?? bill.amount ?? 0),
      0,
    ),
    discardedCount: discardedBills.length,
    billsCount: bills.length,
    loanActivity,
    loanPaymentCount: loanActivity.reduce((sum, loan) => sum + loan.paymentCount, 0),
    loanPaymentTotal: loanActivity.reduce((sum, loan) => sum + loan.total, 0),
    loanPaidAheadCount: loanActivity.reduce((sum, loan) => sum + loan.paidAheadCount, 0),
    loanPaidAheadTotal: loanActivity.reduce((sum, loan) => sum + loan.paidAheadTotal, 0),
    loansPaidOffCount: loanActivity.filter(loan => loan.paidOffThisCycle).length,
    purchasedThisCycle,
    purchasedTotal: purchasedThisCycle.reduce((sum, item) => sum + item.price, 0),
    cycleLabel: data.cycleLabel,
    // Backend insights
    largestTxn: insights?.largestExpenseDescription 
      ? { description: insights.largestExpenseDescription, amount: insights.largestExpenseAmount ?? 0 } 
      : null,
    biggestDay: insights?.biggestDayDate 
      ? { date: insights.biggestDayDate, total: insights.biggestDayTotal ?? 0 } 
      : null,
    avgDailySpend: insights?.avgDailySpend ?? null,
    velocityFirstHalf: insights?.velocityFirstHalf ?? null,
    velocitySecondHalf: insights?.velocitySecondHalf ?? null,
    cycleLengthDays: insights?.cycleLengthDays ?? 1,
    noSpendDays: insights?.noSpendDays ?? 0,
    transactionCount: insights?.transactionCount ?? 0,
    committedSpend: insights?.committedSpend ?? 0,
    discretionarySpend: insights?.discretionarySpend ?? 0,
    categoryLimits,
    categoryLimitsMet: categoryLimits.filter(limit => limit.spent <= limit.limit + EPSILON).length,
  }
}
