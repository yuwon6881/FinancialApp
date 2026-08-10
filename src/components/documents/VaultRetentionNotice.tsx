import { AlertTriangle } from 'lucide-react'
import type { DocumentRetentionReview, RetentionTaxYearSummary } from '../../types'
import {
  describeKeepUntil,
  groupRetentionReview,
  hasRetentionNotice,
  retentionNoticeHeading,
} from '../../lib/documentRetention'
import { formatBytes, formatDate } from './view/formatters'
import { Button } from '../ui/Button'

/** Shown inline before the rest go behind a disclosure, so eight years cannot dominate a screen. */
const INLINE_YEAR_LIMIT = 3

interface VaultRetentionNoticeProps {
  review: DocumentRetentionReview
  /** A jump into the Vault. Omitted on the Vault page itself, which is already there. */
  onOpenVault?: () => void
}

/**
 * The single retention notice, shared by the Vault and the Dashboard. It used to be two inline
 * blocks with two different wordings for the same fact, which is how the same records came to be
 * described two ways depending on where you saw them.
 *
 * Amber is correct here and is not a raw palette colour: `index.css` maps `amber-*` onto
 * `--ledger-pending-*`, the app's needs-attention token. `ui/AlertBanner`'s `warning` variant is
 * deliberately **not** reused — it maps to `--ledger-expense-*`, so a retention notice would render
 * in the spending colour.
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
      className="app-panel rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h3 id="vault-retention-notice-heading" className="text-sm font-bold text-amber-700 dark:text-amber-300">
            {retentionNoticeHeading(groups)}
          </h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Tax records are worth keeping for {review.keepYears} years after their tax year ends.
          </p>

          <ul className="mt-2 space-y-1">
            {inline.map(year => <RetentionYearRow key={year.taxYear} year={year} />)}
          </ul>
          {rest.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                Show all {ordered.length} years
              </summary>
              <ul className="mt-1 space-y-1">
                {rest.map(year => <RetentionYearRow key={year.taxYear} year={year} />)}
              </ul>
            </details>
          )}

          <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
            Nothing is ever deleted for you. Delete them yourself once you are sure you no longer need them.
          </p>

          {onOpenVault && (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={onOpenVault}
              className="mt-2 bg-card text-xs"
            >
              Review in the Vault
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

function RetentionYearRow({ year }: { year: RetentionTaxYearSummary }) {
  const isPast = year.daysUntilKeepUntil < 0
  return (
    <li className="text-[11px] text-muted-foreground">
      <span className="font-bold text-foreground">{year.taxYear}</span>
      {' — '}
      {year.documentCount} file{year.documentCount === 1 ? '' : 's'}, {formatBytes(year.totalBytes)}.{' '}
      {isPast ? 'You only needed to keep these until' : 'Keep these until'} {formatDate(year.keepUntil)}
      {' '}({describeKeepUntil(year.daysUntilKeepUntil)}).
    </li>
  )
}
