import { ArrowRight } from 'lucide-react'
import { getCategoryChartColor } from '../../lib/categoryColors'
import { cn, displayLedgerCategory } from '../../lib/utils'

interface LedgerAllocationBadgeProps {
  ledgerCategory: string
  transactionId: string
  compact?: boolean
}

interface TransferRoute {
  source: string
  target: string
}

function parseTransferRoute(ledgerCategory: string): TransferRoute | null {
  if (!ledgerCategory.startsWith('Transfer:')) return null
  const route = ledgerCategory.substring('Transfer:'.length).split('->')
  if (route.length !== 2) return null

  const source = route[0].trim()
  const target = route[1].trim()
  return source && target ? { source, target } : null
}

/** A bucket written as its colour dot and its name: quiet enough to sit in every row. */
function BucketMark({ name, compact }: { name: string; compact: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-muted-foreground', compact ? 'text-caption' : 'text-label')}>
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: getCategoryChartColor(name) }} />
      {name}
    </span>
  )
}

export function LedgerAllocationBadge({
  ledgerCategory,
  transactionId,
  compact = false,
}: LedgerAllocationBadgeProps) {
  if (ledgerCategory.toLowerCase() === 'accountmove') {
    return <BucketMark name="Between accounts" compact={compact} />
  }
  const route = parseTransferRoute(ledgerCategory)
  const generatedIncomeAllocation = transactionId.includes('-split-') || route?.source === 'Income'

  if (route && !generatedIncomeAllocation) {
    return (
      <span
        className="inline-flex items-center gap-1"
        aria-label={`Transfer from ${route.source} to ${route.target}`}
        title={`${route.source} to ${route.target}`}
      >
        <BucketMark name={route.source} compact={compact} />
        <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-muted-foreground/70" strokeWidth={2.25} />
        <BucketMark name={route.target} compact={compact} />
      </span>
    )
  }

  return <BucketMark name={displayLedgerCategory(ledgerCategory)} compact={compact} />
}
