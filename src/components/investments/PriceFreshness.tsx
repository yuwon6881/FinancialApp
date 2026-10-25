import { RefreshCw } from 'lucide-react'
import type { InvestmentPortfolio } from '../../types'
import { cn } from '../../lib/utils'

/** The newest moment any holding's price was fetched, or undefined when none says. */
function latestPriceFetch(holdings: InvestmentPortfolio['holdings']): Date | undefined {
  const times = holdings
    .map(holding => holding.priceFetchedAt ? new Date(holding.priceFetchedAt).getTime() : Number.NaN)
    .filter(Number.isFinite)
  return times.length > 0 ? new Date(Math.max(...times)) : undefined
}

function describeFetch(at: Date, now: Date): string {
  const minutes = Math.round((now.getTime() - at.getTime()) / 60_000)
  if (minutes < 1) return 'Prices updated just now'
  if (minutes < 60) return `Prices updated ${minutes} min ago`
  const sameDay = at.toDateString() === now.toDateString()
  const time = at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  return sameDay
    ? `Prices updated at ${time}`
    : `Prices updated ${at.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${time}`
}

/**
 * One quiet line under the page title saying how fresh the prices are, which turns into the
 * refresh indicator in place while new prices load. It used to be a pill that appeared beside the
 * title only while refreshing, shoving the title's actions sideways and back again.
 */
export function PriceFreshness({ holdings, isRefreshing, now = new Date() }: {
  holdings: InvestmentPortfolio['holdings']
  isRefreshing: boolean
  now?: Date
}) {
  const fetchedAt = latestPriceFetch(holdings)
  if (!isRefreshing && !fetchedAt) return null
  return (
    <span role="status" className="inline-flex min-h-5 items-center gap-1.5 text-caption text-muted-foreground">
      <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin text-accent-ink')} aria-hidden="true" />
      <span className={cn(isRefreshing && 'text-foreground')}>
        {isRefreshing ? 'Updating prices…' : describeFetch(fetchedAt!, now)}
      </span>
    </span>
  )
}
