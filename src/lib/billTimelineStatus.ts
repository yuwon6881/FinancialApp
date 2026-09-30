import type { ActiveRecurringPayment } from '../types'

type BillStatus = ActiveRecurringPayment['status']

const STYLES = {
  paid: { label: 'Paid', dot: 'bg-accent-ink ring-accent-ink/20', badge: 'text-accent-ink bg-accent-ink/15' },
  partPaid: { label: 'Part paid', dot: 'bg-accent-ink/60 ring-accent-ink/15', badge: 'text-accent-ink bg-accent-ink/10' },
  discarded: { label: 'Discarded', dot: 'bg-muted-foreground/40 ring-muted-foreground/10', badge: 'text-muted-foreground bg-muted' },
  pending: { label: 'Pending', dot: 'bg-accent-ink/25 ring-accent-ink/20', badge: 'text-accent-ink bg-accent-ink/5' },
} as const

const isPaid = (status: BillStatus | undefined) => status === 'Paid' || status === 'SettledByLoanPayoff'

/**
 * A date holding several bills is judged on all of them: fully paid only when every live bill is
 * paid, pending when none has any payment, part paid for anything in between. Discarded bills owe
 * nothing, so they neither block nor count towards "paid".
 */
export function billTimelineStatus(bills: readonly ActiveRecurringPayment[]) {
  const live = bills.filter(bill => bill.status !== 'Discarded')
  if (live.length === 0) return bills.length === 0 ? STYLES.pending : STYLES.discarded
  if (live.every(bill => isPaid(bill.status))) return STYLES.paid
  if (live.some(bill => isPaid(bill.status) || bill.status === 'PartiallyPaid')) return STYLES.partPaid
  return STYLES.pending
}
