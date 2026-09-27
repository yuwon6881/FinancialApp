import { useState } from 'react'
import { BellRing, ScanText } from 'lucide-react'
import type { AppTab } from '../../types'
import type { usePurchaseCapture } from '../../app/usePurchaseCapture'
import { purchaseCaptureStatus } from '../../lib/native/purchaseCaptureStatus'
import { cn } from '../../lib/utils'
import { Badge, StatusBadge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ToggleButton } from '../ui/ToggleButton'
import { PageContainer } from '../ui/PageContainer'
import { panelClass } from '../ui/panelStyles'
import { DetectedTransactionsSheet } from './transaction-detection/DetectedTransactionsSheet'
import { DetectionConsentSheet, DetectionSetupSheet } from './transaction-detection/DetectionSetupSheet'
import { SourceAppsSheet } from './transaction-detection/SourceAppsSheet'

interface Props {
  detection: ReturnType<typeof usePurchaseCapture>
  tab: AppTab
  hidden: boolean
  formOpen: boolean
}

export function TransactionDetectionPanel({ detection, tab, hidden, formOpen }: Props) {
  const [consentOpen, setConsentOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selectionKey, setSelectionKey] = useState(0)
  const [showPending, setShowPending] = useState(false)
  if (!detection.supported || (tab !== 'settings' && tab !== 'ledger')) return null
  const { state, busy, error } = detection
  const candidates = state?.candidates ?? []
  const status = purchaseCaptureStatus(state)
  const unavailable = busy || !state || hidden

  const beginSelection = () => {
    setSelectionKey(key => key + 1)
    setSelecting(true)
    void detection.loadApplications()
  }
  const requestAccess = () => {
    // Consent comes first; once detection is on, access is only a trip to Android settings.
    if (state?.enabled) void detection.accessSettings()
    else setConsentOpen(true)
  }
  const errorRow = error && (
    <div className="flex flex-wrap items-center justify-end gap-2" role="alert">
      <p className="min-w-0 flex-1 text-sm text-destructive">{error}</p>
      <Button variant="tertiary" size="sm" onClick={() => { void detection.refresh() }}>Retry</Button>
    </div>
  )

  // The Ledger shows the queue only when detection is in use; an idle feature costs no space there.
  if (tab === 'ledger' && (!state || (!state.enabled && candidates.length === 0))) return null

  return (
    <PageContainer className={tab === 'settings' ? '!px-0 mb-4' : 'pt-4'}>
      {tab === 'settings' ? (
        <section className={cn(panelClass, 'space-y-3 p-4 sm:p-5')} aria-label="Transaction detection">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 gap-2">
              <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true"><ScanText className="size-4" /></span>
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-subsection text-foreground">Transaction detection</h3>
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                </div>
                <p className="text-xs leading-snug text-muted-foreground">{status.detail}</p>
              </div>
            </div>
            <ToggleButton
              active={state?.enabled ?? false}
              label="Detect transactions on this device"
              disabled={unavailable}
              onClick={() => { if (!state?.enabled) setConsentOpen(true); else void detection.configure(false, state.packages) }}
            />
          </div>
          {!hidden && candidates.length > 0 && (
            <p className="text-xs text-muted-foreground">{candidates.length} waiting for review in Ledger.</p>
          )}
          {hidden && <p className="text-xs text-muted-foreground">Reveal financial data to change detection settings.</p>}
          {errorRow}
          <div className="flex justify-end">
            <Button variant={state?.enabled && !status.listening ? 'primary' : 'secondary'} size="sm" disabled={unavailable} onClick={() => setSettingsOpen(true)}>
              {state?.enabled && !status.listening ? 'Finish setup' : 'Manage detection'}
            </Button>
          </div>
        </section>
      ) : (
        <section className={cn(panelClass, 'space-y-3 p-3 sm:p-4')} aria-label="Detected transactions">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/12 text-accent-ink" aria-hidden="true">
              <BellRing className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="text-subsection text-foreground">Detected transactions</h3>
              <p className="text-xs text-muted-foreground">
                {hidden ? 'Reveal financial data to review them.'
                  : candidates.length ? `${candidates.length} waiting for your review`
                  : status.listening ? 'All caught up' : status.detail}
              </p>
            </div>
            <Button
              variant={candidates.length && !hidden ? 'primary' : 'secondary'}
              size="sm"
              disabled={hidden || formOpen}
              aria-label={hidden ? 'Review detected transactions' : `Review ${candidates.length} detected ${candidates.length === 1 ? 'transaction' : 'transactions'}`}
              onClick={() => { setShowPending(true); void detection.refresh() }}
            >
              Review
              {!hidden && candidates.length > 0 && <Badge tone="neutral" className="ml-1.5 bg-background/70">{candidates.length}</Badge>}
            </Button>
          </div>
          {errorRow}
        </section>
      )}

      <DetectionSetupSheet
        isOpen={settingsOpen && !hidden}
        onClose={() => setSettingsOpen(false)}
        state={state}
        status={status}
        busy={busy}
        onChooseApps={beginSelection}
        onAccess={requestAccess}
        onNotificationSettings={() => { void detection.notificationSettings() }}
      />
      <DetectionConsentSheet
        isOpen={consentOpen && !hidden}
        onClose={() => setConsentOpen(false)}
        busy={busy}
        disabled={!state}
        onAgree={async () => {
          if (await detection.enable(state?.packages ?? [])) {
            setConsentOpen(false)
            if (!state?.packages.length) { setSettingsOpen(true); beginSelection() }
          }
        }}
      />
      <SourceAppsSheet
        key={selectionKey}
        isOpen={selecting && !hidden}
        onClose={() => setSelecting(false)}
        applications={detection.applications}
        loading={detection.applicationsLoading}
        busy={busy}
        initial={state?.packages ?? []}
        onSave={packages => detection.configure(state?.enabled ?? false, packages)}
      />
      <DetectedTransactionsSheet
        isOpen={showPending && !hidden}
        onClose={() => setShowPending(false)}
        candidates={candidates}
        busy={busy}
        formOpen={formOpen}
        onReview={candidate => { setShowPending(false); detection.review(candidate) }}
        onDiscard={detection.discard}
      />
    </PageContainer>
  )
}
