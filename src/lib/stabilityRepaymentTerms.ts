import { MAX_STABILITY_REPAYMENT_CYCLES } from './stabilityRecoveryPacing'

const termOption = (cycles: number) => ({ value: cycles, label: cycles === 1 ? '1 cycle' : cycles + ' cycles' })

export const stabilityRepaymentPresets = [
  ...[1, 3, 6, 12, MAX_STABILITY_REPAYMENT_CYCLES].map(termOption),
  { value: 'other' as const, label: 'Other' },
]

export function stabilityRepaymentTermOptions() {
  return Array.from({ length: MAX_STABILITY_REPAYMENT_CYCLES }, (_, index) => termOption(index + 1))
}
