import { MAX_STABILITY_REPAYMENT_CYCLES } from './stabilityRecoveryPacing'

// A short list of common terms. The API still accepts any 1-24, so a transaction saved with another
// term keeps its own value as an extra option instead of silently showing a different one.
const REPAYMENT_TERMS = [1, 3, 6, 12, 18, MAX_STABILITY_REPAYMENT_CYCLES] as const

export function stabilityRepaymentTermOptions(current: number) {
  const terms: number[] = [...REPAYMENT_TERMS]
  if (!terms.includes(current)) terms.push(current)
  return terms
    .sort((left, right) => left - right)
    .map(cycles => ({ value: cycles, label: cycles === 1 ? '1 month' : cycles + ' months' }))
}
