import { ArrowRight } from 'lucide-react'
import type { BucketImpact } from '../../../lib/transactionBucketWarnings'
import { getCategoryChartColor } from '../../../lib/categoryColors'
import { cn } from '../../../lib/utils'
import { AmountText } from '../../ui/AmountText'

/**
 * The effect before the commit: what the bucket this comes out of has left this cycle, and what it
 * will have once this is saved. Red only when saving takes it below zero.
 */
export function BucketImpactLine({ impact, currency, masked }: { impact: BucketImpact; currency: string; masked: boolean }) {
  const overdrawn = impact.after < 0
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-control bg-surface-2/70 px-3.5 py-3 text-label dark:bg-surface-3/70"
    >
      <span className="flex items-center gap-2 font-medium text-foreground">
        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: getCategoryChartColor(impact.bucket) }} />
        {impact.bucket}
      </span>
      <span className="text-muted-foreground">
        <AmountText value={impact.before} currency={currency} isMasked={masked} /> left
      </span>
      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="becomes" />
      <span className={cn('font-semibold', overdrawn ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
        <AmountText value={impact.after} currency={currency} isMasked={masked} /> after this
      </span>
    </div>
  )
}
