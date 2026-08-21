import type { CategoryBreakdown, Transaction } from '../types'
import { isReportableOutflow } from './transactionReportSemantics'

const dateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildReportBreakdown(transactions: Transaction[]): CategoryBreakdown[] {
  const groups = new Map<string, CategoryBreakdown>()
  for (const transaction of transactions) {
    if (!isReportableOutflow(transaction)) continue
    const label = transaction.category.trim() || 'Other'
    const key = label.toLocaleLowerCase()
    const existing = groups.get(key)
    groups.set(key, {
      category: existing?.category || label,
      amount: (existing?.amount || 0) + Math.abs(transaction.amount),
    })
  }
  return [...groups.values()].sort((left, right) => right.amount - left.amount || left.category.localeCompare(right.category))
}

export function buildCycleSummaryInsights(
  transactions: Transaction[],
  start: Date,
  end: Date,
  referenceDate: Date = new Date(),
) {
  const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  const referenceMidnight = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate())
  const startKey = dateKey(startMidnight)
  const endKey = dateKey(endMidnight)
  const referenceKey = dateKey(referenceMidnight)

  const dayTotals = new Map<string, number>()
  let totalSpend = 0
  let committedSpend = 0
  let discretionarySpend = 0
  let largest: Transaction | undefined
  let expenseCount = 0
  for (const transaction of transactions) {
    if (!isReportableOutflow(transaction)) continue
    const amount = Math.abs(transaction.amount)
    expenseCount += 1
    totalSpend += amount
    if (transaction.recurringPaymentId) committedSpend += amount
    else discretionarySpend += amount
    if (!largest || amount > Math.abs(largest.amount)) largest = transaction
    dayTotals.set(transaction.date, (dayTotals.get(transaction.date) || 0) + amount)
  }
  let biggestDay: [string, number] | undefined
  for (const day of dayTotals) if (!biggestDay || day[1] > biggestDay[1]) biggestDay = day
  const cycleLengthDays = Math.max(1, Math.round((endMidnight.getTime() - startMidnight.getTime()) / 86_400_000) + 1)
  const firstHalfDays = Math.ceil(cycleLengthDays / 2)
  const secondHalfStart = new Date(startMidnight)
  secondHalfStart.setDate(secondHalfStart.getDate() + firstHalfDays)
  const secondHalfStartKey = dateKey(secondHalfStart)
  let velocityFirstHalf = 0
  for (const transaction of transactions) {
    if (transaction.date < secondHalfStartKey && isReportableOutflow(transaction)) {
      velocityFirstHalf += Math.abs(transaction.amount)
    }
  }

  const elapsedDays = referenceMidnight < startMidnight
    ? 0
    : referenceMidnight > endMidnight
      ? cycleLengthDays
      : Math.round((referenceMidnight.getTime() - startMidnight.getTime()) / 86_400_000) + 1

  let distinctExpenseDaysElapsed = 0
  for (const date of dayTotals.keys()) {
    if (date >= startKey && date <= referenceKey && date <= endKey) {
      distinctExpenseDaysElapsed += 1
    }
  }

  return {
    largestExpenseDescription: largest?.description,
    largestExpenseAmount: largest ? Math.abs(largest.amount) : undefined,
    biggestDayDate: biggestDay?.[0],
    biggestDayTotal: biggestDay?.[1],
    // Mirrors the server: a spend rate is per elapsed day, not per whole-cycle day, so the
    // figure agrees with the cycle calendar's own daily average mid-cycle.
    avgDailySpend: expenseCount > 0 && elapsedDays > 0 ? totalSpend / elapsedDays : undefined,
    cycleLengthDays,
    velocityFirstHalf: expenseCount > 0 ? velocityFirstHalf : undefined,
    velocitySecondHalf: expenseCount > 0 ? totalSpend - velocityFirstHalf : undefined,
    noSpendDays: Math.max(0, elapsedDays - distinctExpenseDaysElapsed),
    transactionCount: expenseCount,
    committedSpend,
    discretionarySpend,
  }
}
