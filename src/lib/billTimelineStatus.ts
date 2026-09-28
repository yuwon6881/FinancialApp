import type { ActiveRecurringPayment } from '../types'

/** Grouped dates deliberately share the intermediate shade, without claiming payment. */
export function billTimelineStatus(bills: readonly ActiveRecurringPayment[]) {
  if (bills.length > 1) return { label: 'Multiple bills', dot: 'bg-accent-ink/60 ring-accent-ink/15', badge: 'text-accent-ink bg-accent-ink/10' }
  const status = bills[0]?.status
  if (status === 'Paid' || status === 'SettledByLoanPayoff') return { label: 'Paid', dot: 'bg-accent-ink ring-accent-ink/20', badge: 'text-accent-ink bg-accent-ink/15' }
  if (status === 'PartiallyPaid') return { label: 'Part paid', dot: 'bg-accent-ink/60 ring-accent-ink/15', badge: 'text-accent-ink bg-accent-ink/10' }
  if (status === 'Discarded') return { label: 'Discarded', dot: 'bg-muted-foreground/40 ring-muted-foreground/10', badge: 'text-muted-foreground bg-muted' }
  return { label: 'Pending', dot: 'bg-accent-ink/25 ring-accent-ink/20', badge: 'text-accent-ink bg-accent-ink/5' }
}
