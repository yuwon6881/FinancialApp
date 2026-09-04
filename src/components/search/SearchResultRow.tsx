import { ArrowRight, CreditCard, FileEdit, Landmark, Receipt, TrendingDown } from 'lucide-react'
import { Button } from '../ui/Button'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { CommitmentIcon, RewardIcon } from '../semanticIcons'
import { getCategoryBadgeClass } from '../../lib/categoryColors'
import type { SearchResult, SearchResultKind } from '../../lib/search/searchSources'

/**
 * A component rather than an `iconFor(kind)` lookup: choosing a component in a render body and
 * rendering it as `<Icon />` trips `react-hooks/static-components`, the same reason
 * `documentRowParts` uses `DocumentTypeIcon`.
 */
function SearchResultIcon({ kind, className }: { kind: SearchResultKind; className?: string }) {
  switch (kind) {
    case 'transaction': return <Receipt className={className} />
    case 'draft': return <FileEdit className={className} />
    case 'account': return <Landmark className={className} />
    case 'bill': return <CreditCard className={className} />
    case 'loan': return <TrendingDown className={className} />
    case 'commitment': return <CommitmentIcon className={className} />
    case 'reward': return <RewardIcon className={className} />
  }
}

/**
 * The tile colour comes from the record's own category or bucket, so a row in search carries the
 * colour it already carries in the Ledger. `subtitle` leads with that name for every kind that
 * has one; loans have neither a category nor a bucket and take a plain surface rather than
 * borrowing an unrelated colour.
 */
const tileClassFor = (result: SearchResult): string => {
  if (result.kind === 'loan') return 'bg-muted/40 text-muted-foreground border-border/40'
  if (result.kind === 'reward') return getCategoryBadgeClass('Rewards')
  if (result.kind === 'commitment') return getCategoryBadgeClass('Essentials')
  return getCategoryBadgeClass(result.subtitle.split(' · ')[0])
}

/** Names the record the badge is talking about, in the page's own words. */
const SEARCH_ENTITY_LABELS: Record<SearchResultKind, string> = {
  transaction: 'transaction',
  draft: 'draft',
  account: 'account',
  bill: 'bill',
  loan: 'loan',
  commitment: 'commitment',
  reward: 'reward',
}

interface SearchResultRowProps {
  result: SearchResult
  id: string
  isActive: boolean
  /** Already masked when sensitive mode is on; this component never formats money itself. */
  amountText: string | null
  /** True while amounts are masked, so the row can withhold everything the mask withholds. */
  maskAmounts: boolean
  onActivate: () => void
  onHover: () => void
}

export function SearchResultRow({ result, id, isActive, amountText, maskAmounts, onActivate, onHover }: SearchResultRowProps) {
  // Gated on the mask, not just on the value: the amount text is replaced by the mask, but
  // painting an outflow orange still discloses the sign of every figure the mask is withholding,
  // and it does so without a query being typed. Masked rows read neutral either way.
  const isOutflow = !maskAmounts && typeof result.amount === 'number' && result.amount < 0

  return (
    <Button
      variant="tertiary"
      id={id}
      role="option"
      aria-selected={isActive}
      data-active={isActive}
      onClick={onActivate}
      // mousemove, not mouseenter: the list scrolls under a stationary cursor while arrow keys
      // drive it, and mouseenter fires on the row that arrives beneath the pointer, yanking the
      // selection away from the key press.
      onMouseMove={onHover}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left cursor-pointer border transition-colors duration-100 ${
        isActive ? 'bg-muted/80 border-border/60 shadow-xs' : 'border-transparent hover:bg-muted/40'
      }`}
    >
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg border ${tileClassFor(result)}`}>
        <SearchResultIcon kind={result.kind} className="size-4" />
      </span>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-bold text-foreground">{result.title}</span>
        <span className="block truncate text-caption text-muted-foreground">
          {result.subtitle}
          {result.meta ? ` · ${result.meta}` : ''}
        </span>
      </span>

      <RowSyncStatus entityLabel={SEARCH_ENTITY_LABELS[result.kind]} isPending={result.isPendingSync} />

      {amountText && (
        <span className={`shrink-0 text-caption font-bold tabular-nums ${isOutflow ? 'text-orange-500' : 'text-foreground'}`}>
          {amountText}
        </span>
      )}

      <ArrowRight
        aria-hidden
        className={`size-3.5 shrink-0 text-muted-foreground transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`}
      />
    </Button>
  )
}
