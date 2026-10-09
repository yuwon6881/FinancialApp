import React from 'react'
import { AlertCircle, ArrowRightLeft, Calendar } from 'lucide-react'
import type { RecurringAccountShortfall } from '../../types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { NoticeCard } from './NoticeCard'

interface RecurringAccountShortfallCardProps {
  shortfalls: RecurringAccountShortfall[] | undefined
  formatSensitive: (value: number) => React.ReactNode
  onTransferMoney?: () => void
  onNavigateToRecurring?: (recurringId: string) => void
}

/**
 * Warns users when an upcoming auto-deducted recurring bill will exceed the available balance
 * in its assigned account, even if the parent ledger bucket has sufficient overall funds.
 */
export function RecurringAccountShortfallCard({
  shortfalls,
  formatSensitive,
  onTransferMoney,
  onNavigateToRecurring,
}: RecurringAccountShortfallCardProps) {
  if (!shortfalls || shortfalls.length === 0) return null

  // Sort by urgency: closest due date first, then largest shortfall.
  const sorted = [...shortfalls].sort((a, b) => {
    if (a.offsetDays !== b.offsetDays) return a.offsetDays - b.offsetDays
    return b.shortfall - a.shortfall
  })

  const primary = sorted[0]
  const othersCount = sorted.length - 1

  const dueLabel = primary.offsetDays === 0
    ? 'Due today'
    : primary.offsetDays === 1
      ? 'Due tomorrow'
      : `Due in ${primary.offsetDays} days`

  return (
    <NoticeCard
      tone="urgent"
      icon={<AlertCircle />}
      titleId="recurring-account-shortfall-title"
      title={`${primary.name} auto-deduct shortfall`}
      badge={<Badge tone="urgent">{dueLabel}</Badge>}
      description={(
        <>
          {primary.isCreditCard
            ? <>{primary.accountName} has {formatSensitive(primary.accountBalance)} of credit left, but {primary.name} needs {formatSensitive(primary.amount)}. Pay at least {formatSensitive(primary.shortfall)} off the card to avoid a declined charge.</>
            : <>{primary.accountName} has {formatSensitive(primary.accountBalance)}, but {primary.name} needs {formatSensitive(primary.amount)}. Transfer at least {formatSensitive(primary.shortfall)} to avoid a missed auto-deduction.</>}
          {othersCount > 0 && ` ${othersCount} other auto-deduction${othersCount > 1 ? 's are' : ' is'} also short on funds.`}
        </>
      )}
      actions={(onTransferMoney || onNavigateToRecurring) && (
        <>
          {onTransferMoney && (
            <Button variant="primary" size="sm" onClick={onTransferMoney}>
              <ArrowRightLeft className="size-3.5" aria-hidden="true" />
              Transfer money
            </Button>
          )}
          {onNavigateToRecurring && (
            <Button variant="secondary" size="sm" onClick={() => onNavigateToRecurring(primary.recurringPaymentId)}>
              <Calendar className="size-3.5" aria-hidden="true" />
              View bill
            </Button>
          )}
        </>
      )}
    />
  )
}
