import { MAX_STABILITY_REPAYMENT_CYCLES } from './stabilityRecoveryPacing'

export function stabilityRepaymentTermOptions() {
  return Array.from({ length: MAX_STABILITY_REPAYMENT_CYCLES }, (_, index) => {
    const cycles = index + 1
    return { value: cycles, label: cycles === 1 ? '1 month' : cycles + ' months' }
  })
}
