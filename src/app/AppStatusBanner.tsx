import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { AlertBanner } from '../components/ui/AlertBanner'
import { Button } from '../components/ui/Button'
import type { SyncIssue } from '../lib/outboxSync'

const frame = 'mx-3 mt-2 sm:mx-6 lg:mx-8 [&>div]:flex-1 [&>svg]:mt-3.5 lg:[&>svg]:mt-2.5'

interface SyncPendingBannerProps {
  issue: SyncIssue
  countdown: string | undefined
  offline: boolean
  syncing: boolean
  editing: boolean
  hasPendingChanges: boolean
  onRetry: () => void
}

export function SyncPendingBanner({
  issue, countdown, offline, syncing, editing, hasPendingChanges, onRetry,
}: SyncPendingBannerProps) {
  const [expanded, setExpanded] = useState(false)
  const detailsId = useId()
  const waitingForServer = Boolean(countdown && issue.waitForServer)
  const nextAttempt = offline
    ? 'Sync will resume when your connection returns.'
    : waitingForServer
      ? 'The app will wait before trying again so the server can accept the request.'
      : hasPendingChanges
        ? 'Your changes are queued on this device and will sync automatically.'
        : 'Your changes reached the server. The app will retry refreshing your data.'

  return (
    <AlertBanner className={frame} role="region" aria-label="Sync pending">
      <div className="flex flex-wrap items-center gap-x-3">
        <p className="flex min-h-11 flex-1 items-center whitespace-nowrap text-label font-semibold lg:min-h-9" role="status">
          Sync pending
        </p>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1">
          <Button
            variant="tertiary"
            size="sm"
            className="tabular-nums"
            aria-expanded={expanded}
            aria-controls={detailsId}
            onClick={() => setExpanded(value => !value)}
          >
            {countdown ?? 'Sync details'}
            <ChevronDown className={expanded ? 'size-4 rotate-180' : 'size-4'} aria-hidden="true" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={offline || editing || waitingForServer}
            loading={syncing}
            onClick={onRetry}
          >
            Retry
          </Button>
        </div>
      </div>
      <div id={detailsId} hidden={!expanded} className="space-y-1 pb-1 pt-1 text-body text-foreground">
        <p>
          {issue.message}
          {issue.status && <> <span className="whitespace-nowrap">(HTTP {issue.status})</span></>}
        </p>
        <p className="text-muted-foreground">{nextAttempt}</p>
      </div>
    </AlertBanner>
  )
}

export function AppErrorBanner({ message, retrying, onRetry }: {
  message: string
  retrying: boolean
  onRetry: () => void
}) {
  return (
    <AlertBanner variant="error" className={frame}>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        <p className="min-w-0 flex-1 text-body">{message}</p>
        <Button variant="secondary" size="sm" loading={retrying} loadingLabel="Retrying…" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </AlertBanner>
  )
}
