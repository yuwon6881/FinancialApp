import { useState } from 'react'
import type { AppTab } from '../../types'
import type { usePurchaseCapture } from '../../app/usePurchaseCapture'
import { Button } from '../ui/Button'
import { Checkbox } from '../ui/Checkbox'
import { PageContainer } from '../ui/PageContainer'
import { panelClass } from '../ui/panelStyles'
import { BottomSheet } from '../ui/BottomSheet'
import { Input } from '../ui/Input'
import { FormField } from '../ui/FormField'

interface Props {
  detection: ReturnType<typeof usePurchaseCapture>
  tab: AppTab
  hidden: boolean
  formOpen: boolean
}

export function TransactionDetectionPanel({ detection, tab, hidden, formOpen }: Props) {
  const [consentOpen, setConsentOpen] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [appSearch, setAppSearch] = useState('')
  const [showPending, setShowPending] = useState(false)
  const [discardId, setDiscardId] = useState<string | null>(null)
  if (!detection.supported || (tab !== 'settings' && tab !== 'ledger')) return null
  const { state, busy, error } = detection
  const candidates = state?.candidates ?? []
  const beginSelection = () => {
    setSelected(state?.packages ?? [])
    setAppSearch('')
    setSelecting(true)
    void detection.loadApplications()
  }
  return (
    <PageContainer className="pt-4">
      <section className={`${panelClass} space-y-3 p-4`} aria-label="Transaction detection">
        {tab === 'settings' ? <>
          <h3 className="text-subsection text-foreground">Transaction detection</h3>
          <p className="text-sm text-muted-foreground">Read purchase alerts from apps you choose and prepare them for review. Nothing is added until you save.</p>
          <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
            Detect purchases on this device
            <Checkbox checked={state?.enabled ?? false} disabled={busy || !state || hidden}
              onChange={event => { if (event.target.checked) setConsentOpen(true); else void detection.configure(false, state?.packages ?? []) }} />
          </label>
          {state?.enabled && <p className="text-sm text-muted-foreground" role="status">
            {!state.access ? 'Notification access is needed to read alerts.' : !state.notifications ? 'Purchases can be captured, but review notifications are disabled.' : 'Listening for purchase alerts from your selected apps.'}
          </p>}
          <p className="text-xs text-muted-foreground">{state?.packages.length ?? 0} apps selected. Recognition depends on the alert format. Up to 200 purchases can wait for review; discard or save them to make space.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" disabled={busy || !state || hidden} onClick={beginSelection}>Choose apps</Button>
            {state?.enabled && !state.access && <Button variant="secondary" disabled={busy || hidden} onClick={() => setConsentOpen(true)}>Grant notification access</Button>}
            {state?.enabled && !state.notifications && <Button variant="secondary" disabled={busy} onClick={() => { void detection.notificationSettings() }}>Allow review notifications</Button>}
          </div>
        </> : <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-subsection text-foreground">Detected transactions</h3>
          <Button variant="secondary" disabled={hidden || formOpen} onClick={() => { setShowPending(true); void detection.refresh() }}>Review{!hidden ? ` (${candidates.length})` : ''}</Button>
        </div>}
        {error && <div className="flex flex-wrap items-center justify-end gap-2" role="alert"><p className="text-sm text-destructive">{error}</p><Button variant="tertiary" onClick={() => { void detection.refresh() }}>Retry</Button></div>}
        {hidden && <p className="text-sm text-muted-foreground">Reveal financial data to manage detection and review purchases.</p>}
      </section>
      <BottomSheet isOpen={consentOpen && !hidden} onClose={() => setConsentOpen(false)} title="Read purchase notifications">
        <div className="space-y-4 text-sm">
          <p>Android grants FinancialApp access to notifications across your phone. FinancialApp processes only apps you select here, ignores unrelated alerts, and stores detected purchase details encrypted on this device.</p>
          <p>Detected details are sent through the existing AI suggestion service only when you open an unlocked review form. No transaction is saved automatically. You can disable detection or revoke access in Android settings at any time.</p>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setConsentOpen(false)}>Cancel</Button><Button variant="primary" disabled={busy || !state} onClick={async () => {
            if (await detection.configure(true, state?.packages ?? [])) {
              if (await detection.accessSettings()) setConsentOpen(false)
            }
          }}>Agree and open settings</Button></div>
        </div>
      </BottomSheet>
      <BottomSheet isOpen={selecting && !hidden} onClose={() => setSelecting(false)} title="Choose notification sources">
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Select banking or wallet apps. Selecting an app does not guarantee that its notification format can be recognized.</p>
          <FormField label="Search apps"><Input value={appSearch} onChange={event => setAppSearch(event.target.value)} placeholder="Bank or wallet name" /></FormField>
          {busy && <p role="status">Loading apps…</p>}
          {detection.applications.filter(app => `${app.label} ${app.packageName}`.toLowerCase().includes(appSearch.trim().toLowerCase())).map(app => <label key={app.packageName} className="flex min-h-11 items-center justify-between gap-3">
            <span className="min-w-0 break-words text-sm">{app.label}</span>
            <Checkbox checked={selected.includes(app.packageName)} onChange={event => setSelected(previous => event.target.checked ? [...previous, app.packageName] : previous.filter(value => value !== app.packageName))} />
          </label>)}
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setSelecting(false)}>Cancel</Button><Button variant="primary" disabled={busy || !state} onClick={async () => { if (await detection.configure(state?.enabled ?? false, selected)) setSelecting(false) }}>Save selection</Button></div>
        </div>
      </BottomSheet>
      <BottomSheet isOpen={showPending && !hidden} onClose={() => { setShowPending(false); setDiscardId(null) }} title="Detected transactions">
        <div className="space-y-3">
          {candidates.length === 0 && <p className="text-sm text-muted-foreground">No purchases are waiting for review.</p>}
          {candidates.map(candidate => <div key={candidate.id} className="space-y-2 rounded-xl border border-border p-3">
            <p className="break-words text-sm font-medium">{candidate.description || 'Purchase details need review'}</p>
            <p className="text-xs text-muted-foreground">{candidate.sourceLabel} · Alert received {new Date(candidate.capturedAt).toLocaleString()}</p>
            {candidate.currency && candidate.amount && <p className="text-sm">{candidate.currency} {candidate.amount}</p>}
            {candidate.possibleDuplicate && <p className="text-xs text-muted-foreground">Another similar alert was detected. Check before saving both.</p>}
            {candidate.prepared && <p className="text-sm text-muted-foreground">Approved purchase awaiting recovery. Retry refresh to finish.</p>}
            <div className="flex justify-end gap-2">
              <Button variant="tertiary" disabled={busy || !!candidate.prepared} onClick={() => setDiscardId(candidate.id)}>Discard</Button>
              <Button variant="primary" disabled={formOpen || !!candidate.prepared} onClick={() => { setShowPending(false); detection.review(candidate) }}>Review</Button>
            </div>
            {discardId === candidate.id && <div className="space-y-2"><p className="text-sm">Discard this detected purchase?</p><div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDiscardId(null)}>Keep</Button><Button variant="destructive" disabled={busy} onClick={async () => { await detection.discard(candidate.id); setDiscardId(null) }}>Discard purchase</Button></div></div>}
          </div>)}
        </div>
      </BottomSheet>
    </PageContainer>
  )
}
