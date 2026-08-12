import type { Loan, RecurringFrequency } from '../types'

export type LoanDurationUnit = 'Years' | 'Months'

interface LoanCadence {
  trackingStartDate: string
  scheduleFrequency?: string | null
  scheduleDueDay?: number | null
  scheduleStartDate?: string | null
  scheduleStatus?: Loan['scheduleStatus']
}

export function countLoanPaymentsThrough(cadence: LoanCadence, endDate?: string | null) {
  if (!endDate) return null
  let occurrence = firstLoanOccurrence(cadence)
  if (!occurrence || endDate < occurrence) return null
  let count = 0
  while (occurrence <= endDate && count <= 360) {
    count += 1
    occurrence = addLoanPeriod(occurrence, cadence.scheduleFrequency!, cadence.scheduleDueDay!)
  }
  return count >= 1 && count <= 360 ? count : null
}

export function loanEndDate(cadence: LoanCadence & { termPeriods: number }) {
  let occurrence = firstLoanOccurrence(cadence)
  if (!occurrence || cadence.termPeriods < 1 || cadence.termPeriods > 360) return null
  for (let index = 1; index < cadence.termPeriods; index += 1) {
    occurrence = addLoanPeriod(occurrence, cadence.scheduleFrequency!, cadence.scheduleDueDay!)
  }
  return occurrence
}

export function durationFromTermPeriods(termPeriods: number, frequency?: string | null) {
  if (frequency === 'Monthly' && termPeriods % 12 === 0) {
    return { value: termPeriods / 12, unit: 'Years' as const }
  }
  return {
    value: frequency === 'Annually' ? termPeriods : termPeriods,
    unit: frequency === 'Annually' ? 'Years' as const : 'Months' as const,
  }
}

export function termPeriodsFromDuration(value: number, unit: LoanDurationUnit, frequency?: RecurringFrequency | string | null) {
  if (!Number.isFinite(value) || value <= 0) return null
  const periods = frequency === 'Annually'
    ? (unit === 'Years' ? value : value / 12)
    : (unit === 'Years' ? value * 12 : value)
  return Number.isInteger(periods) && periods >= 1 && periods <= 360 ? periods : null
}

function firstLoanOccurrence(cadence: LoanCadence) {
  const { scheduleFrequency: frequency, scheduleDueDay: dueDay, scheduleStartDate: start, trackingStartDate } = cadence
  if (cadence.scheduleStatus === 'Incomplete' || !start || !trackingStartDate || !dueDay
    || (frequency !== 'Monthly' && frequency !== 'Annually')) return null
  const [startYear, startMonth] = start.split('-').map(Number)
  const [trackingYear, trackingMonth] = trackingStartDate.split('-').map(Number)
  if (frequency === 'Annually') {
    const year = Math.max(startYear, trackingYear)
    let candidate = anchoredDate(year, startMonth, dueDay)
    if (candidate < start || candidate < trackingStartDate) candidate = anchoredDate(year + 1, startMonth, dueDay)
    return candidate
  }
  let candidate = anchoredDate(trackingYear, trackingMonth, dueDay)
  if (candidate < start || candidate < trackingStartDate) candidate = addLoanPeriod(candidate, frequency, dueDay)
  while (candidate < start) candidate = addLoanPeriod(candidate, frequency, dueDay)
  return candidate
}

function addLoanPeriod(date: string, frequency: string, dueDay: number) {
  const [year, month] = date.split('-').map(Number)
  const annual = frequency === 'Annually'
  const nextMonth = annual ? month : month === 12 ? 1 : month + 1
  const nextYear = annual ? year + 1 : month === 12 ? year + 1 : year
  return anchoredDate(nextYear, nextMonth, dueDay)
}

function anchoredDate(year: number, month: number, dueDay: number) {
  const day = Math.min(dueDay, new Date(Date.UTC(year, month, 0)).getUTCDate())
  return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`
}
