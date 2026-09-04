import { AlertTriangle, ChevronRight } from 'lucide-react'
import type { DocumentRetentionReview, RetentionTaxYearSummary } from '../../types'
import {
  describeKeepUntil,
  groupRetentionReview,
  hasRetentionNotice,
  retentionNoticeHeading,
} from '../../lib/documentRetention'
import { formatBytes, formatDate } from './view/formatters'
import { Button } from '../ui/Button'
import { cn } from '../../lib/utils'
import { PANEL_TONES, panelClass } from '../ui/panelStyles'

/** Shown inline before the rest go behind a disclosure, so eight years cannot dominate a screen. */
const INLINE_YEAR_LIMIT = 3

interface VaultRetentionNoticeProps {
  review: DocumentRetentionReview
  /** A jump into the Vault. Omitted on the Vault page itself, which is already there. */
  onOpenVault?: () => void
}

/**
 * Today and the Vault surface tax-document retention as an advisory exception only.
 * Nothing is automatically pruned; the user decides what stays and what goes.
 */
export function VaultRetentionNotice({ review, onOpenVault }: VaultRetentionNoticeProps) {
  // Nothing to say means nothing on screen: a notice whose whole message is "all is well" costs a
  // scroll on every visit and teaches the eye to skip the region a real alert lands in.
  if (!hasRetentionNotice(review)) return null

  const groups = groupRetentionReview(review)
  const ordered = [...groups.past, ...groups.approaching]
  const inline = ordered.slice(0, INLINE_YEAR_LIMIT)
  const rest = ordered.slice(INLINE_YEAR_LIMIT)

  return (
    <section
      aria-labelledby="vault-retention-notice-heading"
      className={cn(panelClass, PANEL_TONES.warning, 'p-4 shadow-xs sm:p-5')}
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 id="vault-retention-notice-heading" className="text-subsection text-amber-700 dark:text-amber-300">
            {retentionNoticeHeading(groups)}
          </h3>
          <p className="mt-1 text-caption leading-relaxed text-muted-foreground">
            Tax records are worth keeping for {review.keepYears} years after their tax year ends.
          </p>
        </div>
      </div>

      <ul className="mt-3 space-y-1">
        {inline.map(year => <RetentionYearRow key={year.taxYear} year={year} />)}
      </ul>
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer text-caption font-semibold text-amber-700 dark:text-amber-300">
            Show all {ordered.length} years
          </summary>
          <ul className="mt-1 space-y-1">
            {rest.map(year => <RetentionYearRow key={year.taxYear} year={year} />)}
          </ul>
        </details>
      )}

      <p className="mt-2 text-caption font-semibold text-muted-foreground">
        Nothing is ever deleted for you. Delete them yourself once you are sure you no longer need them.
      </p>

      {onOpenVault && (
        <Button
          variant="secondary"
          size="sm"
          type="button"
          onClick={onOpenVault}
          className="mt-3 border-amber-500/30 bg-card/60 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300 text-caption"
        >
          Review in the Vault
          <ChevronRight className="size-3.5 ml-1" />
        </Button>
      )}
    </section>
  )
}

function RetentionYearRow({ year }: { year: RetentionTaxYearSummary }) {
  const isPast = year.daysUntilKeepUntil < 0
  return (
    <li className="text-caption text-muted-foreground">
      <span className="font-bold text-foreground">{year.taxYear}</span>
      {' — '}
      {year.documentCount} file{year.documentCount === 1 ? '' : 's'}, {formatBytes(year.totalBytes)}.{' '}
      {isPast ? 'You only needed to keep these until' : 'Keep these until'} {formatDate(year.keepUntil)}
      {' '}({describeKeepUntil(year.daysUntilKeepUntil)}).
    </li>
  )
}
