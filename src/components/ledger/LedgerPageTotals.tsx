import { ArrowLeftRight } from 'lucide-react'
import { hasDistinctBucketMovement } from '../../lib/ledgerTotals'
import { AmountText } from '../ui/AmountText'
import type { LedgerListProps } from './ledgerListShared'

interface LedgerPageTotalsProps {
  count: number
  totals: LedgerListProps['pageTotals']
  currency: string
  masked: boolean
}

function Total({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="text-label text-muted-foreground">{label}</dt>
      <dd className="text-body font-semibold text-foreground tabular-nums">{children}</dd>
    </div>
  )
}

/**
 * What the visible page adds up to: out, in, and the net between them -- or, when one bucket is
 * filtered and its movement differs from the plain net, that bucket's own movement instead, so the
 * strip never quotes two nets for one page. Transfers and allocations moved money without spending
 * it, so they are named on their own line and kept out of both sides.
 */
export function LedgerPageTotals({ count, totals, currency, masked }: LedgerPageTotalsProps) {
  const net = totals.inflow - totals.outflow
  const showBucket = Boolean(totals.bucket) && hasDistinctBucketMovement(totals.bucketNet, net)
  const signed = (value: number) => (
    <AmountText
      value={value}
      currency={currency}
      isMasked={masked}
      signDisplay="always"
      tone={value > 0 ? 'positive' : 'neutral'}
    />
  )
  return (
    <section aria-label="Page totals" className="rounded-panel bg-surface-2/70 px-4 py-3.5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
        <p className="text-label text-muted-foreground">
          {count} transaction{count === 1 ? '' : 's'} on this page
        </p>
        <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
          <Total label="Out"><AmountText value={totals.outflow} currency={currency} isMasked={masked} /></Total>
          <Total label="In"><AmountText value={totals.inflow} currency={currency} isMasked={masked} tone="positive" /></Total>
          {showBucket
            ? <Total label={`${totals.bucket} movement`}>{signed(totals.bucketNet)}</Total>
            : <Total label="Net">{signed(net)}</Total>}
        </dl>
      </div>
      {totals.transfer > 0 && (
        <p className="mt-2 flex items-center gap-1.5 border-t border-border/60 pt-2 text-caption text-muted-foreground">
          <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden="true" />
          <AmountText value={totals.transfer} currency={currency} isMasked={masked} className="font-medium text-foreground" />
          transferred or allocated between buckets — not counted as in or out
        </p>
      )}
    </section>
  )
}
