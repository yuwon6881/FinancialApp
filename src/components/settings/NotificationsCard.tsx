import React from 'react'
import { AlertCircle, BellRing, ChevronRight, Gauge } from 'lucide-react'
import {
  BILL_REMINDER_PUSH_DESCRIPTION,
  BILL_REMINDER_PUSH_TITLE,
  CATEGORY_LIMIT_PUSH_DESCRIPTION,
  CATEGORY_LIMIT_PUSH_TITLE,
  otherDevicesHaveItOn,
} from '../../lib/push/messages'
import type { PushChannel } from '../../types'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { ToggleButton } from '../ui/ToggleButton'
import { PushDevicesList } from './PushDevicesList'
import { cn } from '../../lib/utils'
import { panelClass } from '../ui/panelStyles'

/**
 * One switch and everything that describes it, in a fixed shape: icon, name, busy badge,
 * a single line of explanation, control on the right.
 *
 * The rows here used to be written out longhand, and each drifted into carrying a different amount
 * of prose — the panel read as unrelated settings stacked rather than one list. A shared row also
 * caps the explanation at one line by construction, which is the actual fix for a panel that had
 * grown too wordy to scan.
 */
const NotificationRow: React.FC<{
  icon: React.ReactNode
  title: string
  description: string
  hint?: React.ReactNode
  control: React.ReactNode
}> = ({ icon, title, description, hint, control }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex min-w-0 flex-1 gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-body font-medium text-foreground sm:text-sm">{title}</span>
        <span className="text-xs leading-snug text-muted-foreground">{description}</span>
      </span>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {hint}
      {control}
    </div>
  </div>
)

export interface NotificationsCardProps {
  pushSupported: boolean
  pushLoading: boolean
  /** Which of the two switches is mid-flight, or null. They must not share one busy flag. */
  pushBusyChannel: PushChannel | null
  pushGuidance?: string | null
  /** This installation's own state, per kind. Never an account-wide flag. */
  billRemindersEnabled: boolean
  categoryAlertsEnabled: boolean
  /** Whether some other device has that kind on. Rendered as a sentence, never as a switch. */
  otherDevicesBillReminders: boolean
  otherDevicesCategoryAlerts: boolean
  onToggleChannel: (channel: PushChannel, checked: boolean) => void
  /**
   * Rises once per **server-confirmed** enrolment change, and is the only thing the roster re-reads
   * on. Deriving it from the switch booleans read the roster while the write was still in flight.
   */
  enrolmentRevision: number
  /** False when no category has a spending guide to alert on yet. */
  hasSpendingGuides: boolean
  onNavigateToCategoryLimits?: () => void
}

export const NotificationsCard: React.FC<NotificationsCardProps> = (props) => {
  const anyBusy = props.pushBusyChannel !== null || props.pushLoading
  const deviceUnavailable = !props.pushSupported

  return (
    <section
      aria-labelledby="settings-notifications-heading"
      className={cn(panelClass, 'space-y-3 p-4 sm:space-y-4 sm:p-5')}
    >
      <div className="border-b border-border/40 pb-2.5 sm:pb-3">
        <h3 id="settings-notifications-heading" className="text-subsection text-foreground">Notifications</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Choose which alerts this installation receives. Full details appear on the lock screen; other installations keep their choices.
        </p>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        {/* The two kinds are independent settings on equal footing. Turning either on is what asks
            the browser or native app for notification permission. */}
        <NotificationRow
          icon={<BellRing className="size-4" />}
          title={BILL_REMINDER_PUSH_TITLE}
          description={BILL_REMINDER_PUSH_DESCRIPTION}
          hint={
            <InfoHint
              label="How notifications are turned on"
              text="Each installation is set up separately, even on the same account. Notifications appear only after they are enabled here and allowed by the browser or app."
            />
          }
          control={
            <ToggleButton
              active={props.billRemindersEnabled}
              onClick={() => props.onToggleChannel('billReminders', !props.billRemindersEnabled)}
              label={BILL_REMINDER_PUSH_TITLE}
              disabled={anyBusy || deviceUnavailable}
              mutationStatus={{ isSyncing: props.pushBusyChannel === 'billReminders' }}
              mutationEntityLabel="bill reminders"
            />
          }
        />

        <OtherDevicesNote
          show={!props.billRemindersEnabled && props.otherDevicesBillReminders}
          kind="Bill reminders"
        />

        <NotificationRow
          icon={<Gauge className="size-4" />}
          title={CATEGORY_LIMIT_PUSH_TITLE}
          description={CATEGORY_LIMIT_PUSH_DESCRIPTION}
          control={
            <ToggleButton
              active={props.categoryAlertsEnabled}
              onClick={() => props.onToggleChannel('categoryAlerts', !props.categoryAlertsEnabled)}
              label={CATEGORY_LIMIT_PUSH_TITLE}
              disabled={anyBusy || deviceUnavailable}
              mutationStatus={{ isSyncing: props.pushBusyChannel === 'categoryAlerts' }}
              mutationEntityLabel="spending alerts"
            />
          }
        />

        <OtherDevicesNote
          show={!props.categoryAlertsEnabled && props.otherDevicesCategoryAlerts}
          kind="Spending alerts"
        />

        {/* Offered only when there is nothing to watch, which is the one state where it is the fix
            rather than a permanent extra link under a working switch. */}
        {!props.hasSpendingGuides && (
          <div className="ml-6 space-y-1">
            <p className="text-xs font-medium leading-snug text-muted-foreground">
              You have not set a planned amount for any category yet, so there is nothing to alert on.
            </p>
            {props.onNavigateToCategoryLimits && (
              <Button
                variant="tertiary"
                type="button"
                onClick={props.onNavigateToCategoryLimits}
                className="inline-flex items-center gap-1 text-xs font-bold text-accent-ink hover:underline"
              >
                Set planned amounts per category <ChevronRight className="size-3" aria-hidden="true" />
              </Button>
            )}
          </div>
        )}

        {/* amber-500 is aliased to --ledger-pending-500 in index.css, so this is the theme's own
            "needs attention" gold rather than a raw Tailwind palette colour. */}
        {props.pushGuidance && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-500"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 text-xs font-medium leading-snug sm:text-xs">{props.pushGuidance}</p>
          </div>
        )}

        {/* The device roster is reference material, not a control: it answers "which browsers did
            I ever turn this on in", which is a question people ask occasionally and never on the
            way to changing a setting. Left open it was the tallest thing in the panel. */}
        <details className="group border-t border-border/30 pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-eyebrow uppercase text-muted-foreground transition hover:text-foreground">
            <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden="true" />
            Devices set up
          </summary>
          <div className="pt-2">
            {/* Re-reads once each enrolment change is acknowledged by the server, so the roster
                never shows a browser that was just switched on or off — and never reads back the
                state from before the write it is reacting to. */}
            <PushDevicesList refreshKey={props.enrolmentRevision} />
          </div>
        </details>
      </div>
    </section>
  )
}

/**
 * "Another device has this on" — a statement about the other device, deliberately separate from
 * the switch, which stays off. The account-wide reading of this used to *be* the switch state, so
 * a desktop that had never asked for spending alerts showed them as on.
 */
const OtherDevicesNote: React.FC<{ show: boolean; kind: string }> = ({ show, kind }) => {
  if (!show) return null
  return (
    <p className="ml-6 text-xs font-medium leading-snug text-muted-foreground">
      {otherDevicesHaveItOn(kind)}
    </p>
  )
}
