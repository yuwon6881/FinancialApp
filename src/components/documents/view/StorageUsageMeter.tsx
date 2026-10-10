import { formatBytes } from './formatters'
import type { DocumentVaultUsage } from '../../../types'
import { Meter } from '../../ui/Meter'
import { cn } from '../../../lib/utils'

// The bar turns amber then destructive as the quota fills. Thresholds match the
// storage warnings elsewhere in the app: informational until 70%, then escalating.
function barToneFor(percentUsed: number): string {
  if (percentUsed >= 90) return 'bg-destructive'
  if (percentUsed >= 70) return 'bg-amber-500'
  return 'bg-muted-foreground/60'
}

/**
 * Storage as one quiet line under the page title: how many files, how much space, and a short bar.
 * It used to be a full-width row with its own icon and a page-wide track, which gave a number that
 * almost never matters the visual weight of the page's content.
 */
export function StorageUsageMeter({ usage, className }: { usage: DocumentVaultUsage | null; className?: string }) {
  if (!usage) return null

  // quotaBytes comes from the server; guard against a zero/absent value rather than
  // dividing by it and rendering NaN%.
  const quotaBytes = usage.quotaBytes > 0 ? usage.quotaBytes : null
  const percentUsed = quotaBytes ? Math.min(100, (usage.totalBytes / quotaBytes) * 100) : 0

  return (
    <div data-testid="vault-storage" className={cn('flex min-w-0 items-center gap-2.5 text-caption text-muted-foreground', className)}>
      <span className="min-w-0 truncate tabular-nums">
        {usage.documentCount} document{usage.documentCount === 1 ? '' : 's'} stored
        <span aria-hidden="true"> · </span>
        <span className="font-medium text-foreground">{formatBytes(usage.totalBytes)}</span>
        {quotaBytes && <> of {formatBytes(quotaBytes)}</>}
      </span>
      {quotaBytes && (
        <Meter
          size="sm"
          className="w-16 shrink-0 sm:w-24"
          percent={percentUsed}
          tone={barToneFor(percentUsed)}
          label="Document vault storage used"
        />
      )}
    </div>
  )
}
