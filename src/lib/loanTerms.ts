import type { Loan, LoanInterestMethod, LoanRateBasis } from '../types'

export interface LoanInterestMethodCopy {
  key: LoanInterestMethod
  label: string
  hint: string
}

export const LOAN_INTEREST_METHOD_COPY: Record<LoanInterestMethod, LoanInterestMethodCopy> = {
  ReducingBalance: {
    key: 'ReducingBalance',
    label: "Interest on what's left, worked out monthly",
    hint: "Each month's interest is based on what you still owe, so it shrinks as you pay. This is how home loans, most bank personal loans and PTPTN work.",
  },
  ReducingBalanceDaily: {
    key: 'ReducingBalanceDaily',
    label: "Interest on what's left, worked out daily",
    hint: 'Same idea, but counted every day — paying earlier in the month costs you less. This is how credit card balances, overdrafts and flexi home loans work.',
  },
  Flat: {
    key: 'Flat',
    label: 'Interest on the original amount',
    hint: 'Interest is fixed on the amount you first borrowed, so paying it off early saves you nothing. Car hire purchase, Islamic personal financing-i and SPayLater or Atome plans work this way — a 0% plan is this with the rate set to 0.',
  },
  InterestOnly: {
    key: 'InterestOnly',
    label: 'Interest only — nothing comes off what you owe',
    hint: "You pay just the interest, so the amount you owe stays where it is. This is a home loan during the construction period, or paying only your credit card's minimum.",
  },
}

export const LOAN_INTEREST_METHOD_ORDER: LoanInterestMethod[] = [
  'ReducingBalance',
  'ReducingBalanceDaily',
  'Flat',
  'InterestOnly',
]

export const LOAN_INTEREST_METHOD_OPTIONS = LOAN_INTEREST_METHOD_ORDER.map(key => ({
  value: key,
  label: LOAN_INTEREST_METHOD_COPY[key].label,
}))

export function loanInterestMethodCopy(method: LoanInterestMethod) {
  return LOAN_INTEREST_METHOD_COPY[method]
}

export const LOAN_RATE_BASIS_OPTIONS = [
  { value: 'Yearly' as const, label: 'per year' },
  { value: 'Monthly' as const, label: 'per month' },
]

export function annualRateFromEntry(entered: number, basis: LoanRateBasis) {
  return roundRate(basis === 'Monthly' ? entered * 12 : entered)
}

export function entryRateFromAnnual(annual: number, basis: LoanRateBasis) {
  return roundRate(basis === 'Monthly' ? annual / 12 : annual)
}

export function formatRatePercent(value: number) {
  return `${new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value)}%`
}

function roundRate(value: number) {
  return Math.round(value * 10000) / 10000
}

export interface LoanPayoffProgress {
  /** 0-100, clamped. Null when the tracked principal cannot anchor a percentage. */
  percentPaid: number
  clearedPrincipal: number
  trackedPrincipal: number
}

/**
 * How much of the *tracked* principal has been cleared.
 *
 * The anchor is `openingPrincipal` — the balance at `trackingStartDate`, not the original loan — so
 * user-facing copy must say "tracked", never "borrowed". A loan added part-way through its life has
 * no record of what came before, and claiming otherwise would overstate progress.
 *
 * Returns null rather than a zero when the figure is not knowable: no tracked principal, a replay in
 * flight, or an incomplete schedule. Rendering 0% there would read as "no progress" instead of
 * "unknown", which the honest-absence rule forbids.
 *
 * An interest-only loan with its balance intact legitimately reports 0%, so callers must present
 * that as a fact about the loan rather than as an error.
 */
export function loanPayoffProgress(
  loan: Pick<Loan, 'openingPrincipal' | 'snapshot' | 'isRecalculating'>,
  scheduleUnavailable: boolean,
): LoanPayoffProgress | null {
  if (scheduleUnavailable || loan.isRecalculating) return null
  const trackedPrincipal = loan.openingPrincipal
  if (!(trackedPrincipal > 0)) return null

  const clearedPrincipal = Math.max(0, trackedPrincipal - loan.snapshot.outstandingBalance)
  return {
    trackedPrincipal,
    clearedPrincipal,
    percentPaid: Math.min(100, (clearedPrincipal / trackedPrincipal) * 100),
  }
}
