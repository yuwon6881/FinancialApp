import { HardDrive } from 'lucide-react'
import { formatBytes } from './formatters'
import type { DocumentVaultUsage } from '../../../types'
import { Meter } from '../../ui/Meter'

// The bar turns amber then destructive as the quota fills. Thresholds match the
// storage warnings elsewhere in the app: informational until 70%, then escalating.
function barToneFor(percentUsed: number): string {
  if (percentUsed >= 90) return 'bg-destructive'
  if (percentUsed >= 70) return 'bg-primary'
  return 'bg-accent-ink'
}

export function StorageUsageMeter({ usage }: { usage: DocumentVaultUsage | null }) {
  if (!usage) return null

  // quotaBytes comes from the server; guard against a zero/absent value rather than
  // dividing by it and rendering NaN%.
  const quotaBytes = usage.quotaBytes > 0 ? usage.quotaBytes : null
  const percentUsed = quotaBytes ? Math.min(100, (usage.totalBytes / quotaBytes) * 100) : 0

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-border/40 bg-muted/40 px-3 py-2.5 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-caption">
        <div className="flex items-center gap-2 text-muted-foreground">
          <HardDrive className="size-4 shrink-0" aria-hidden="true" />
          <span className="font-semibold">
            {usage.documentCount} document{usage.documentCount === 1 ? '' : 's'} stored
          </span>
        </div>
        <span className="font-bold text-foreground tabular-nums">
          {formatBytes(usage.totalBytes)}
          {quotaBytes && <span className="text-muted-foreground font-semibold"> of {formatBytes(quotaBytes)}</span>}
        </span>
      </div>
      {quotaBytes && (
        <Meter
          className="bg-border/60"
          percent={percentUsed}
          tone={barToneFor(percentUsed)}
          label="Document vault storage used"
        />
      )}
    </div>
  )
}
