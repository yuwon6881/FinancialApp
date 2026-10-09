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
import { NoticeCard } from '../ui/NoticeCard'

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
    <NoticeCard
      tone="attention"
      icon={<AlertTriangle />}
      titleId="vault-retention-notice-heading"
      title={retentionNoticeHeading(groups)}
      description={<>Tax records are worth keeping for {review.keepYears} years after their tax year ends.</>}
      actions={onOpenVault && (
        <Button variant="secondary" size="sm" type="button" onClick={onOpenVault}>
          Review in the Vault
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </Button>
      )}
    >
      <ul className="divide-y divide-border/60 rounded-control bg-surface-2/60 px-3">
        {inline.map(year => <RetentionYearRow key={year.taxYear} year={year} />)}
      </ul>
      {rest.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-label font-medium text-accent-ink">
            Show all {ordered.length} years
          </summary>
          <ul className="mt-2 divide-y divide-border/60 rounded-control bg-surface-2/60 px-3">
            {rest.map(year => <RetentionYearRow key={year.taxYear} year={year} />)}
          </ul>
        </details>
      )}

      <p className="mt-3 text-caption font-medium text-muted-foreground">
        Nothing is ever deleted for you. Delete them yourself once you are sure you no longer need them.
      </p>
    </NoticeCard>
  )
}

function RetentionYearRow({ year }: { year: RetentionTaxYearSummary }) {
  const isPast = year.daysUntilKeepUntil < 0
  return (
    <li className="py-2 text-caption text-muted-foreground">
      <span className="font-semibold text-foreground tabular-nums">{year.taxYear}</span>
      {' — '}
      {year.documentCount} file{year.documentCount === 1 ? '' : 's'}, {formatBytes(year.totalBytes)}.{' '}
      {isPast ? 'You only needed to keep these until' : 'Keep these until'} {formatDate(year.keepUntil)}
      {' '}({describeKeepUntil(year.daysUntilKeepUntil)}).
    </li>
  )
}
