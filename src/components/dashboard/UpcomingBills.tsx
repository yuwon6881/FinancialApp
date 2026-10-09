import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'
import type { ActiveRecurringPayment } from '../../types'
import { cn } from '../../lib/utils'
import { AmountText } from '../ui/AmountText'
import { Button } from '../ui/Button'
import { CategoryIcon } from '../ui/CategoryIcon'
import { InteractiveCard } from '../ui/InteractiveCard'
import { ListRow } from '../ui/ListRow'
import { panelClass } from '../ui/panelStyles'

/** Rows shown before the rest are left to the Bills page. */
const VISIBLE_BILLS = 4
const DAY_MS = 24 * 60 * 60 * 1000

interface UpcomingBillsProps {
  payments: ActiveRecurringPayment[]
  currency: string
  hideSensitive: boolean
  onOpenBill: (recurringPaymentId: string) => void
  onOpenAll: () => void
  /** Injected by tests; defaults to now. */
  today?: Date
}

function parseDueDate(value: string): Date | null {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return null
  return new Date(year, month - 1, day)
}

function describeDue(due: Date | null, today: Date): { text: string; overdue: boolean } {
  if (!due) return { text: 'This cycle', overdue: false }
  const days = Math.round((due.getTime() - new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / DAY_MS)
  if (days < 0) return { text: `Overdue · ${Math.abs(days)} day${days === -1 ? '' : 's'}`, overdue: true }
  if (days === 0) return { text: 'Due today', overdue: false }
  if (days === 1) return { text: 'Due tomorrow', overdue: false }
  if (days < 7) return { text: `Due in ${days} days`, overdue: false }
  return { text: due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), overdue: false }
}

/**
 * The cycle's bills still waiting to be paid, soonest first -- the short list Today owes the reader
 * so a due date is never a surprise. Paid bills drop off; when nothing is outstanding the card is
 * not drawn at all, so a quiet cycle stays quiet.
 */
export function UpcomingBills({ payments, currency, hideSensitive, onOpenBill, onOpenAll, today = new Date() }: UpcomingBillsProps) {
  const outstanding = useMemo(() => payments
    .filter(payment => payment.status === 'Pending' || payment.status === 'PartiallyPaid')
    .map(payment => ({ payment, due: parseDueDate(payment.dueDate) }))
    .sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity)), [payments])

  if (outstanding.length === 0) return null
  const visible = outstanding.slice(0, VISIBLE_BILLS)
  const hiddenCount = outstanding.length - visible.length

  return (
    <section aria-labelledby="upcoming-bills-heading" className={cn(panelClass, 'p-5')}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="upcoming-bills-heading" className="text-subsection text-foreground">Upcoming bills</h2>
        <span className="text-caption text-muted-foreground tabular-nums">{outstanding.length} unpaid</span>
      </div>
      <ul className="-mx-2 mt-2">
        {visible.map(({ payment, due }) => {
          const { text, overdue } = describeDue(due, today)
          const owed = payment.remainingAmount ?? payment.amount
          return (
            <li key={payment.id}>
              <InteractiveCard
                surface="plain"
                onClick={() => onOpenBill(payment.recurringPaymentId)}
                className="rounded-control px-2 hover:bg-surface-2 focus-visible:outline-offset-[-2px]"
              >
                <ListRow
                  leading={<CategoryIcon category={payment.category || payment.ledgerCategory} size="sm" />}
                  title={payment.name}
                  subtitle={<span className={cn(overdue && 'font-medium text-red-600 dark:text-red-400')}>{text}</span>}
                  trailing={owed == null
                    ? <span className="text-muted-foreground">Varies</span>
                    : <AmountText value={Math.abs(owed)} currency={currency} isMasked={hideSensitive} />}
                  className="min-h-13 py-2"
                />
              </InteractiveCard>
            </li>
          )
        })}
      </ul>
      <Button variant="tertiary" size="sm" onClick={onOpenAll} className="-ml-2 mt-1">
        {hiddenCount > 0 ? `See all ${outstanding.length} bills` : 'See all bills'}
        <ChevronRight className="size-3.5" aria-hidden="true" />
      </Button>
    </section>
  )
}
