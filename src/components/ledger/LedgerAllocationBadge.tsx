import { ArrowRight } from 'lucide-react'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import { displayLedgerCategory } from '../../lib/utils'

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

const badgeClass = (compact: boolean) =>
  `${compact ? 'px-1.5' : 'px-2'} py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap`

export function LedgerAllocationBadge({
  ledgerCategory,
  transactionId,
  compact = false,
}: LedgerAllocationBadgeProps) {
  if (ledgerCategory.toLowerCase() === 'accountmove') {
    return (
      <span className={`${badgeClass(compact)} ${getCategoryBadgeClass('Transfer')}`}>
        Between accounts
      </span>
    )
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
        <span className={`${badgeClass(compact)} ${getCategoryBadgeClass(route.source)}`}>{route.source}</span>
        <ArrowRight aria-hidden="true" className="size-3 shrink-0 text-blue-500/70" strokeWidth={2.5} />
        <span className={`${badgeClass(compact)} ${getCategoryBadgeClass(route.target)}`}>{route.target}</span>
      </span>
    )
  }

  const displayedCategory = displayLedgerCategory(ledgerCategory)
  return (
    <span className={`${badgeClass(compact)} ${getCategoryBadgeClass(displayedCategory)}`}>
      {displayedCategory}
    </span>
  )
}
