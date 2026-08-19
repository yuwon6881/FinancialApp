import type { LedgerAccount, Loan, LoanPaymentSplit, LoanScheduleEntry, LoanRepaymentPreviewResult, LoanRepaymentActionResult, RecurringPayment, SavingsGoal, Transaction, WishlistItem } from '../../types'
import type { WireLedgerAccount, WireLoan, WireLoanPaymentSplit, WireLoanScheduleEntry, WireLoanRepaymentPreviewResult, WireLoanRepaymentActionResult, WireRecurringPayment, WireSavingsGoal, WireTransaction, WireWishlistItem } from '../apiTypes'

const OBFUSCATION_KEY = 'FinancialAppObfuscationKey'

export function deobfuscateAmount(obfuscated: string | number | undefined | null): number {
  if (obfuscated === undefined || obfuscated === null) return 0
  if (typeof obfuscated === 'number') return Number.isFinite(obfuscated) ? obfuscated : 0
  try {
    const binaryString = atob(obfuscated)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    }
    const decoded = Number(new TextDecoder().decode(bytes))
    return Number.isFinite(decoded) ? decoded : 0
  } catch (error) {
    console.error('Failed to deobfuscate value:', obfuscated, error)
    return 0
  }
}

export function obfuscateAmount(value: number | string): string {
  const numeric = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numeric)) throw new TypeError('Amount must be a finite number.')
  const input = numeric.toFixed(2)
  const bytes = new TextEncoder().encode(input)
  let binaryString = ''
  for (let i = 0; i < bytes.length; i++) {
    const xored = bytes[i] ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    binaryString += String.fromCharCode(xored)
  }
  return btoa(binaryString)
}

export function deobfuscateTransaction(transaction: WireTransaction): Transaction {
  return {
    ...transaction,
    amount: deobfuscateAmount(transaction.amount),
    stabilityRecoveryTopUpAmount: transaction.stabilityRecoveryTopUpAmount == null
      ? transaction.stabilityRecoveryTopUpAmount
      : deobfuscateAmount(transaction.stabilityRecoveryTopUpAmount),
  }
}

export function deobfuscateLedgerAccount(account: WireLedgerAccount): LedgerAccount {
  return {
    ...account,
    remaining: deobfuscateAmount(account.remaining),
  }
}

export function deobfuscateRecurringPayment(payment: WireRecurringPayment): RecurringPayment {
  return { ...payment, amount: deobfuscateAmount(payment.amount) }
}

export function deobfuscateWishlistItem(item: WireWishlistItem): WishlistItem {
  return { ...item, price: deobfuscateAmount(item.price) }
}

export function deobfuscateSavingsGoal(goal: WireSavingsGoal): SavingsGoal {
  return {
    ...goal,
    targetAmount: deobfuscateAmount(goal.targetAmount),
    earmarkedAmount: deobfuscateAmount(goal.earmarkedAmount),
    cycleFundedAmount: deobfuscateAmount(goal.cycleFundedAmount),
    // The API returns a full timestamp for the date-typed column; the UI and all pacing math
    // work on the 'YYYY-MM-DD' calendar date, so normalise once here at the boundary.
    targetDate: (goal.targetDate || '').slice(0, 10),
  }
}

function deobfuscateLoanPayment(payment: WireLoanPaymentSplit): LoanPaymentSplit {
  return {
    ...payment,
    payment: deobfuscateAmount(payment.payment),
    interest: deobfuscateAmount(payment.interest),
    principal: deobfuscateAmount(payment.principal),
    balanceBefore: deobfuscateAmount(payment.balanceBefore),
    balanceAfter: deobfuscateAmount(payment.balanceAfter),
    surplus: deobfuscateAmount(payment.surplus),
  }
}

export function deobfuscateLoanSchedule(entry: WireLoanScheduleEntry): LoanScheduleEntry {
  return {
    ...entry,
    payment: deobfuscateAmount(entry.payment),
    interest: deobfuscateAmount(entry.interest),
    principal: deobfuscateAmount(entry.principal),
    balanceAfter: deobfuscateAmount(entry.balanceAfter),
  }
}

export function deobfuscateLoan(loan: WireLoan): Loan {
  const nextPayment = loan.snapshot.nextPayment
  return {
    ...loan,
    openingPrincipal: deobfuscateAmount(loan.openingPrincipal),
    annualRatePercent: deobfuscateLoanRate(loan.annualRatePercent),
    snapshot: {
      ...loan.snapshot,
      outstandingBalance: deobfuscateAmount(loan.snapshot.outstandingBalance),
      scheduledPayment: deobfuscateAmount(loan.snapshot.scheduledPayment),
      totalScheduledInterest: deobfuscateAmount(loan.snapshot.totalScheduledInterest),
      totalInterestPaid: deobfuscateAmount(loan.snapshot.totalInterestPaid),
      nextPayment: nextPayment ? deobfuscateLoanSchedule(nextPayment) : nextPayment,
      payments: (loan.snapshot.payments || []).map(deobfuscateLoanPayment),
      futureSchedule: (loan.snapshot.futureSchedule || []).map(deobfuscateLoanSchedule),
    },
  }
}

export function deobfuscateLoanRepaymentPreview(preview: WireLoanRepaymentPreviewResult): LoanRepaymentPreviewResult {
  return {
    cyclesCount: preview.cyclesCount,
    totalAmount: deobfuscateAmount(preview.totalAmount),
    occurrences: (preview.occurrences || []).map(o => ({
      occurrenceDate: o.occurrenceDate,
      payment: deobfuscateAmount(o.payment),
      interest: deobfuscateAmount(o.interest),
      principal: deobfuscateAmount(o.principal),
      balanceAfter: deobfuscateAmount(o.balanceAfter),
    })),
  }
}

export function deobfuscateLoanRepaymentAction(result: WireLoanRepaymentActionResult): LoanRepaymentActionResult {
  return {
    actionId: result.actionId,
    kind: result.kind,
    loan: deobfuscateLoan(result.loan),
    transactions: (result.transactions || []).map(deobfuscateTransaction),
  }
}

function deobfuscateLoanRate(value: number | string): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const plain = Number(value)
  return Number.isFinite(plain) ? plain : deobfuscateAmount(value)
}
