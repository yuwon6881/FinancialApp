import type { ReactNode } from 'react'
import { CheckCircle2, CircleAlert, Circle } from 'lucide-react'
import type { CaptureState } from '../../../lib/native/purchaseCapture'
import type { CaptureStatus } from '../../../lib/native/purchaseCaptureStatus'
import { BottomSheet } from '../../ui/BottomSheet'
import { Button } from '../../ui/Button'
import { ModalActions } from '../../ui/ModalActions'
import { StatusBadge } from '../../ui/Badge'

type StepState = 'done' | 'required' | 'optional'

const STEP_ICON: Record<StepState, ReactNode> = {
  done: <CheckCircle2 className="size-5 text-accent-ink" />,
  required: <CircleAlert className="size-5 text-destructive" />,
  optional: <Circle className="size-5 text-muted-foreground" />,
}
const STEP_LABEL: Record<StepState, string> = { done: 'Done', required: 'Required', optional: 'Optional' }

function SetupStep({ step, title, description, state, action }: { step: number; title: string; description: string; state: StepState; action: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-control border border-border/60 bg-card p-3">
      <span className="mt-0.5 shrink-0" aria-hidden="true">{STEP_ICON[state]}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-0.5">
          <p className="text-body font-medium text-foreground">
            <span className="sr-only">Step {step}: </span>{title}
            <span className="sr-only"> — {STEP_LABEL[state]}</span>
          </p>
          <p className="text-xs leading-snug text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-end">{action}</div>
      </div>
    </li>
  )
}

interface SetupProps {
  isOpen: boolean
  onClose: () => void
  state: CaptureState | null
  status: CaptureStatus
  busy: boolean
  onChooseApps: () => void
  onAccess: () => void
  onNotificationSettings: () => void
}

export function DetectionSetupSheet({ isOpen, onClose, state, status, busy, onChooseApps, onAccess, onNotificationSettings }: SetupProps) {
  const apps = state?.packages.length ?? 0
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Transaction detection setup"
      description="Turn payment alerts from your bank and wallet apps into Ledger entries you review first."
    >
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 rounded-control bg-muted/30 p-3">
          <p className="min-w-0 text-sm text-foreground">{status.detail}</p>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <ol className="space-y-2.5" aria-label="Setup steps">
          <SetupStep
            step={1}
            title="Choose source apps"
            description={apps ? `${apps} ${apps === 1 ? 'app' : 'apps'} selected. Only these apps are read.` : 'Pick the banking or wallet apps whose payment alerts should be read.'}
            state={apps ? 'done' : 'required'}
            action={<Button variant="secondary" size="sm" disabled={busy || !state} onClick={onChooseApps}>{apps ? 'Change apps' : 'Choose apps'}</Button>}
          />
          <SetupStep
            step={2}
            title="Allow notification access"
            description={state?.access ? 'Granted. Android lets FinancialApp see alerts from the apps above.' : 'Android asks you to allow this once in its settings. Detection can’t start without it.'}
            state={state?.access ? 'done' : 'required'}
            action={<Button variant="secondary" size="sm" disabled={busy || !state} onClick={onAccess}>{state?.access ? 'Review access' : 'Grant notification access'}</Button>}
          />
          <SetupStep
            step={3}
            title="Get review alerts"
            description={state?.notifications ? 'On. A private alert opens each detected payment for review.' : 'Off. Detected payments still wait in Ledger, but you won’t be alerted.'}
            state={state?.notifications ? 'done' : 'optional'}
            action={<Button variant="secondary" size="sm" disabled={busy || !state} onClick={onNotificationSettings}>Notification settings</Button>}
          />
        </ol>
        <p className="text-xs text-muted-foreground">Recognition depends on how each app words its alerts. Up to 200 transactions can wait for review. Turning detection off keeps the ones already waiting.</p>
      </div>
    </BottomSheet>
  )
}

interface ConsentProps {
  isOpen: boolean
  onClose: () => void
  busy: boolean
  disabled: boolean
  onAgree: () => void
}

export function DetectionConsentSheet({ isOpen, onClose, busy, disabled, onAgree }: ConsentProps) {
  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Read transaction notifications"
      footer={
        <ModalActions>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={disabled} onClick={onAgree}>Agree and continue</Button>
        </ModalActions>
      }
    >
      <ul className="list-disc space-y-3 pl-5 text-sm text-foreground marker:text-muted-foreground">
        <li>Android grants notification access for the whole phone. FinancialApp reads only the apps you select and ignores everything else.</li>
        <li>Detected details stay encrypted on this device. Nothing is uploaded until you open a review, when the description may be sent to the AI suggestion service.</li>
        <li>Nothing is saved automatically — you confirm every transaction.</li>
        <li>You can turn detection off here, or revoke access in Android settings, at any time.</li>
      </ul>
    </BottomSheet>
  )
}
