import type { Loan, LoanPaymentSplit, LoanScheduleEntry } from '../types'

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

export const roundMoney = (value: number) =>
  Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * 100) / 100

export const annualRate = (annualRatePercent: number) => annualRatePercent / 100

export function totalScheduledInterest(loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>, frequency?: string | null): number {
  const periods = periodsPerYear(frequency)
  if (loan.interestMethod === 'Flat') {
    return roundMoney(loan.openingPrincipal * annualRate(loan.annualRatePercent) * loan.termPeriods / periods)
  }
  const payment = scheduledPayment(loan, frequency)
  return roundMoney(Math.max(0, payment * loan.termPeriods - loan.openingPrincipal))
}

export function scheduledPayment(loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>, frequency?: string | null): number {
  const term = Math.max(1, loan.termPeriods)
  const periods = periodsPerYear(frequency)
  if (loan.interestMethod === 'Flat') {
    const totalInterest = loan.openingPrincipal * annualRate(loan.annualRatePercent) * term / periods
    return roundMoney((loan.openingPrincipal + totalInterest) / term)
  }
  const ratePerPeriod = annualRate(loan.annualRatePercent) / periods
  if (ratePerPeriod === 0) return roundMoney(loan.openingPrincipal / term)
  const power = Math.pow(1 + ratePerPeriod, term)
  return roundMoney(loan.openingPrincipal * ratePerPeriod / (1 - 1 / power))
}

export function applyPayment(
  loan: Pick<Loan, 'openingPrincipal' | 'annualRatePercent' | 'termPeriods' | 'interestMethod'>,
  frequency: string | null | undefined,
  occurrenceDate: string,
  balanceBefore: number,
  payment: number,
  paymentNumber: number,
  flatInterestPaidBefore: number,
  transactionId?: string | null,
): LoanPaymentSplit {
  const actualPayment = roundMoney(Math.max(0, payment))
  const balance = roundMoney(Math.max(0, balanceBefore))
  if (balance <= 0) {
    return { occurrenceDate, payment: actualPayment, interest: 0, principal: 0, balanceBefore: 0, balanceAfter: 0, surplus: actualPayment, paymentDidNotCoverInterest: false, transactionId }
  }
  const interestDue = loan.interestMethod === 'Flat'
    ? flatInterestForPayment(loan, frequency, paymentNumber, flatInterestPaidBefore)
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
): LoanScheduleEntry {
  const split = applyPayment(loan, frequency, occurrenceDate, balanceBefore, scheduledPayment(loan, frequency), paymentNumber, flatInterestPaidBefore)
  return { occurrenceDate, payment: split.payment, interest: split.interest, principal: split.principal, balanceAfter: split.balanceAfter }
}

export function replayLoan(loan: Loan, frequency: string | null | undefined, inputs: LoanPaymentInput[], dueDay?: number | null): LoanReplayResult {
  const ordered = [...inputs]
    .filter(input => input.occurrenceDate >= loan.trackingStartDate)
    .sort((left, right) => left.occurrenceDate.localeCompare(right.occurrenceDate)
      || String(left.postedAt ?? '').localeCompare(String(right.postedAt ?? ''))
      || String(left.transactionId ?? '').localeCompare(String(right.transactionId ?? '')))
  let balance = roundMoney(Math.max(0, loan.openingPrincipal))
  let flatInterestPaid = 0
  let paymentNumber = 0
  let totalInterestPaid = 0
  let lastOccurrenceDate: string | undefined
  let payoffDate: string | undefined
  const payments: LoanPaymentSplit[] = []

  for (const input of ordered) {
    if (!lastOccurrenceDate || input.occurrenceDate > lastOccurrenceDate) lastOccurrenceDate = input.occurrenceDate
    if (input.isDiscarded) continue
    paymentNumber += 1
    const split = applyPayment(loan, frequency, input.occurrenceDate, balance, Math.abs(input.amount), paymentNumber, flatInterestPaid, input.transactionId)
    payments.push(split)
    if (split.balanceBefore > 0 && split.balanceAfter <= 0) payoffDate ??= input.occurrenceDate
    balance = split.balanceAfter
    flatInterestPaid = roundMoney(flatInterestPaid + split.interest)
    totalInterestPaid = roundMoney(totalInterestPaid + split.interest)
  }

  const outstandingBalance = balance
  let nextDate = lastOccurrenceDate
    ? addPeriod(lastOccurrenceDate, frequency, dueDay ?? loan.recurringPaymentDueDate)
    : loan.trackingStartDate
  const futureSchedule: LoanScheduleEntry[] = []
  for (let i = 0; i < 600 && balance > 0; i += 1) {
    const entry = applyScheduledPayment(loan, frequency, nextDate, balance, paymentNumber + i + 1, flatInterestPaid)
    futureSchedule.push(entry)
    balance = entry.balanceAfter
    flatInterestPaid = roundMoney(flatInterestPaid + entry.interest)
    if (balance <= 0) {
      payoffDate ??= nextDate
      break
    }
    nextDate = addPeriod(nextDate, frequency, dueDay ?? loan.recurringPaymentDueDate)
  }

  return {
    outstandingBalance,
    scheduledPayment: scheduledPayment(loan, frequency),
    totalScheduledInterest: totalScheduledInterest(loan, frequency),
    totalInterestPaid,
    payoffDate: balance > 0 ? null : payoffDate,
    lastOccurrenceDate,
    nextPayment: futureSchedule[0] ?? null,
    payments,
    futureSchedule,
  }
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
