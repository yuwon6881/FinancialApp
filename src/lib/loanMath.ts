import type { Loan, LoanPaymentSplit, LoanScheduleEntry } from '../types'
import { roundMoney } from './money'

export { roundMoney } from './money'

export interface LoanPaymentInput {
  occurrenceDate: string
  postedAt?: string
  amount: number
  isDiscarded?: boolean
  transactionId?: string | null
}

export interface LoanReplayResult {
  outstandingBalance: number
  scheduledPayment: number
  totalScheduledInterest: number
  totalInterestPaid: number
  payoffDate?: string | null
  lastOccurrenceDate?: string | null
  nextPayment: LoanScheduleEntry | null
  payments: LoanPaymentSplit[]
  futureSchedule: LoanScheduleEntry[]
}

export const periodsPerYear = (frequency?: string | null) =>
  frequency?.toLowerCase() === 'annually' ? 1 : 12

export const annualRate = (annualRatePercent: number) => annualRatePercent / 100

export function totalScheduledInterest(loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>, frequency?: string | null): number {
  const periods = periodsPerYear(frequency)
  if (loan.interestMethod === 'Flat' || loan.interestMethod === 'InterestOnly') {
    return roundMoney(loan.openingPrincipal * annualRate(loan.annualRatePercent) * loan.termPeriods / periods)
  }
  const payment = scheduledPayment(loan, frequency)
  return roundMoney(Math.max(0, payment * loan.termPeriods - loan.openingPrincipal))
}

export function scheduledPayment(loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>, frequency?: string | null): number {
  const term = Math.max(1, loan.termPeriods)
  const periods = periodsPerYear(frequency)
  const ratePerPeriod = annualRate(loan.annualRatePercent) / periods
  if (loan.interestMethod === 'Flat') {
    const totalInterest = loan.openingPrincipal * annualRate(loan.annualRatePercent) * term / periods
    return roundMoney((loan.openingPrincipal + totalInterest) / term)
  }
  if (loan.interestMethod === 'InterestOnly') {
    return roundMoney(loan.openingPrincipal * ratePerPeriod)
  }
  if (ratePerPeriod === 0) return roundMoney(loan.openingPrincipal / term)
  let inversePower = 1
  for (let period = 0; period < term; period += 1) inversePower /= 1 + ratePerPeriod
  return roundMoney(loan.openingPrincipal * ratePerPeriod / (1 - inversePower))
}

export function applyPayment(
  loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>,
  frequency: string | null | undefined,
  occurrenceDate: string,
  balanceBefore: number,
  payment: number,
  paymentNumber: number,
  flatInterestPaidBefore: number,
  previousAccrualDate: string,
  transactionId?: string | null,
): LoanPaymentSplit {
  const actualPayment = roundMoney(Math.max(0, payment))
  const balance = roundMoney(Math.max(0, balanceBefore))
  if (balance <= 0) {
    return { occurrenceDate, payment: actualPayment, interest: 0, principal: 0, balanceBefore: 0, balanceAfter: 0, surplus: actualPayment, paymentDidNotCoverInterest: false, transactionId }
  }
  const interestDue = loan.interestMethod === 'Flat'
    ? flatInterestForPayment(loan, frequency, paymentNumber, flatInterestPaidBefore)
    : loan.interestMethod === 'ReducingBalanceDaily'
      ? dailyInterest(loan, balance, previousAccrualDate, occurrenceDate)
      : roundMoney(balance * annualRate(loan.annualRatePercent) / periodsPerYear(frequency))
  const interest = Math.min(actualPayment, Math.max(0, interestDue))
  const didNotCoverInterest = actualPayment < interestDue && interestDue > 0
  const principal = didNotCoverInterest ? 0 : Math.min(balance, roundMoney(actualPayment - interest))
  const balanceAfter = roundMoney(Math.max(0, balance - principal))
  return {
    occurrenceDate,
    payment: actualPayment,
    interest: roundMoney(interest),
    principal: roundMoney(principal),
    balanceBefore: balance,
    balanceAfter,
    surplus: roundMoney(Math.max(0, actualPayment - interest - principal)),
    paymentDidNotCoverInterest: didNotCoverInterest,
    transactionId,
  }
}

export function applyScheduledPayment(
  loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>,
  frequency: string | null | undefined,
  occurrenceDate: string,
  balanceBefore: number,
  paymentNumber: number,
  flatInterestPaidBefore: number,
  previousAccrualDate: string,
): LoanScheduleEntry {
  const split = applyPayment(loan, frequency, occurrenceDate, balanceBefore, scheduledPayment(loan, frequency), paymentNumber, flatInterestPaidBefore, previousAccrualDate)
  return { occurrenceDate, payment: split.payment, interest: split.interest, principal: split.principal, balanceAfter: split.balanceAfter }
}

export function replayLoan(
  loan: Loan,
  frequency: string | null | undefined,
  inputs: LoanPaymentInput[],
  dueDay?: number | null,
  scheduleStartDate?: string | null,
): LoanReplayResult {
  const resolvedFrequency = frequency ?? loan.scheduleFrequency
  const resolvedDueDay = dueDay ?? loan.scheduleDueDay ?? (frequency !== undefined ? Number(loan.trackingStartDate.slice(-2)) : undefined)
  const resolvedStartDate = scheduleStartDate ?? loan.scheduleStartDate ?? loan.trackingStartDate
  const explicitCadence = frequency !== undefined || dueDay !== undefined || scheduleStartDate !== undefined
  const scheduleAvailable = explicitCadence
    ? hasValidCadence(resolvedFrequency, resolvedDueDay, resolvedStartDate)
    : loan.scheduleStatus !== 'Incomplete' && hasValidCadence(resolvedFrequency, resolvedDueDay, resolvedStartDate)
  if (!scheduleAvailable) return emptyReplay()

  const ordered = [...inputs]
    .filter(input => input.occurrenceDate >= loan.trackingStartDate)
    .sort((left, right) => left.occurrenceDate.localeCompare(right.occurrenceDate)
      || String(left.postedAt ?? '').localeCompare(String(right.postedAt ?? ''))
      || String(left.transactionId ?? '').localeCompare(String(right.transactionId ?? '')))
  let balance = roundMoney(Math.max(0, loan.openingPrincipal))
  let flatInterestPaid = 0
  let paymentNumber = 0
  let totalInterestPaid = 0
  let accrualDate = loan.trackingStartDate
  let lastOccurrenceDate: string | undefined
  let payoffDate: string | undefined
  const payments: LoanPaymentSplit[] = []

  for (const input of ordered) {
    if (!lastOccurrenceDate || input.occurrenceDate > lastOccurrenceDate) lastOccurrenceDate = input.occurrenceDate
    if (input.isDiscarded) continue
    paymentNumber += 1
    const split = applyPayment(loan, resolvedFrequency, input.occurrenceDate, balance, Math.abs(input.amount), paymentNumber, flatInterestPaid, accrualDate, input.transactionId)
    payments.push(split)
    if (split.balanceBefore > 0 && split.balanceAfter <= 0) payoffDate ??= input.occurrenceDate
    balance = split.balanceAfter
    flatInterestPaid = roundMoney(flatInterestPaid + split.interest)
    totalInterestPaid = roundMoney(totalInterestPaid + split.interest)
    // Underpayments still close the accrual window; interest is never capitalized.
    accrualDate = input.occurrenceDate
  }

  const outstandingBalance = balance
  let nextDate = lastOccurrenceDate
    ? addPeriod(lastOccurrenceDate, resolvedFrequency, resolvedDueDay)
    : findOccurrenceOnOrAfter(resolvedStartDate, resolvedFrequency!, resolvedDueDay!, loan.trackingStartDate)
  const futureSchedule: LoanScheduleEntry[] = []
  const futurePeriodLimit = loan.interestMethod === 'InterestOnly'
    ? Math.max(0, loan.termPeriods - paymentNumber)
    : 600
  for (let i = 0; i < futurePeriodLimit && balance > 0; i += 1) {
    const entry = applyScheduledPayment(loan, resolvedFrequency, nextDate, balance, paymentNumber + i + 1, flatInterestPaid, accrualDate)
    futureSchedule.push(entry)
    balance = entry.balanceAfter
    flatInterestPaid = roundMoney(flatInterestPaid + entry.interest)
    accrualDate = nextDate
    if (balance <= 0) {
      payoffDate ??= nextDate
      break
    }
    nextDate = addPeriod(nextDate, resolvedFrequency, resolvedDueDay)
  }

  return {
    outstandingBalance,
    scheduledPayment: scheduledPayment(loan, resolvedFrequency),
    totalScheduledInterest: totalScheduledInterest(loan, resolvedFrequency),
    totalInterestPaid,
    payoffDate: balance > 0 ? null : payoffDate,
    lastOccurrenceDate,
    nextPayment: futureSchedule[0] ?? null,
    payments,
    futureSchedule,
  }
}

function emptyReplay(): LoanReplayResult {
  return {
    outstandingBalance: 0,
    scheduledPayment: 0,
    totalScheduledInterest: 0,
    totalInterestPaid: 0,
    payoffDate: null,
    lastOccurrenceDate: null,
    nextPayment: null,
    payments: [],
    futureSchedule: [],
  }
}

function hasValidCadence(frequency: string | null | undefined, dueDay: number | null | undefined, startDate: string | null | undefined) {
  return Boolean(
    startDate
    && Number.isInteger(dueDay)
    && dueDay! >= 1
    && dueDay! <= 31
    && (frequency?.toLowerCase() === 'monthly' || frequency?.toLowerCase() === 'annually'),
  )
}

function findOccurrenceOnOrAfter(start: string, frequency: string, dueDay: number, date: string) {
  const [startYear, startMonth] = start.split('-').map(Number)
  const [dateYear, dateMonth] = date.split('-').map(Number)
  const annual = frequency.toLowerCase() === 'annually'
  if (annual) {
    const year = Math.max(startYear, dateYear)
    let candidate = anchoredDate(year, startMonth, dueDay)
    if (candidate < start || candidate < date) candidate = anchoredDate(year + 1, startMonth, dueDay)
    return candidate
  }

  let year = Math.max(startYear, dateYear)
  let month = year === startYear ? Math.max(startMonth, dateMonth) : dateMonth
  let candidate = anchoredDate(year, month, dueDay)
  if (candidate < start || candidate < date) {
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
    candidate = anchoredDate(year, month, dueDay)
  }
  return candidate
}

function anchoredDate(year: number, month: number, dueDay: number) {
  const day = Math.min(dueDay, new Date(Date.UTC(year, month, 0)).getUTCDate())
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}

export function addPeriod(date: string, frequency?: string | null, dueDay?: number | null) {
  const [year, month, day] = date.split('-').map(Number)
  const annual = frequency?.toLowerCase() === 'annually'
  const targetMonth = annual ? month : month === 12 ? 1 : month + 1
  const targetYear = annual ? year + 1 : month === 12 ? year + 1 : year
  const anchorDay = dueDay != null && dueDay > 0 ? Math.min(dueDay, 31) : day
  const targetDay = Math.min(anchorDay, new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate())
  return `${targetYear.toString().padStart(4, '0')}-${targetMonth.toString().padStart(2, '0')}-${targetDay.toString().padStart(2, '0')}`
}

function flatInterestForPayment(
  loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>,
  frequency: string | null | undefined,
  paymentNumber: number,
  flatInterestPaidBefore: number,
) {
  const totalInterest = totalScheduledInterest(loan, frequency)
  const remaining = Math.max(0, totalInterest - flatInterestPaidBefore)
  return paymentNumber >= Math.max(1, loan.termPeriods)
    ? remaining
    : Math.min(remaining, roundMoney(totalInterest / Math.max(1, loan.termPeriods)))
}

function dailyInterest(
  loan: Pick<Loan, 'annualRatePercent'>,
  balance: number,
  previousAccrualDate: string,
  occurrenceDate: string,
) {
  const days = (Date.parse(occurrenceDate) - Date.parse(previousAccrualDate)) / 86_400_000
  if (days <= 0) return 0
  return roundMoney(balance * annualRate(loan.annualRatePercent) * days / 365)
}
