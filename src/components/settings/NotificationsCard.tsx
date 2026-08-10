import React from 'react'
import { AlertCircle, Bell, BellRing, ChevronRight, Gauge } from 'lucide-react'
import {
  CATEGORY_ALERTS_NEED_DEVICE,
  CATEGORY_LIMIT_PUSH_DESCRIPTION,
  NOTIFY_ON_LOGIN_DESCRIPTION,
  PUSH_DESCRIPTION,
  SCOPE_ALL_DEVICES,
  SCOPE_THIS_DEVICE,
} from '../../lib/push/messages'
import { Button } from '../ui/Button'
import { InfoHint } from '../ui/InfoHint'
import { RowSyncStatus } from '../ui/RowSyncBadge'
import { ToggleButton } from '../ui/ToggleButton'
import { PushDevicesList } from './PushDevicesList'

// Which devices a switch changes is the thing people get wrong here, so each row says it rather
// than leaving it to be read out of the wording.
const ScopeChip: React.FC<{ scope: string }> = ({ scope }) => (
  <span className="shrink-0 rounded-md border border-border/50 bg-muted/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
    {scope}
  </span>
)

/**
 * One switch and everything that describes it, in a fixed shape: icon, name, scope, busy badge,
 * a single line of explanation, control on the right.
 *
 * The three rows here used to be written out longhand, and each drifted into carrying a different
 * amount of prose — the panel read as three unrelated settings stacked rather than one list. A
 * shared row also caps the explanation at one line by construction, which is the actual fix for a
 * panel that had grown too wordy to scan.
 */
const NotificationRow: React.FC<{
  icon: React.ReactNode
  title: string
  scope: string
  description: string
  hint?: React.ReactNode
  status?: React.ReactNode
  control: React.ReactNode
}> = ({ icon, title, scope, description, hint, status, control }) => (
  <div className="flex items-start justify-between gap-3">
    <div className="flex min-w-0 flex-1 gap-2">
      <span className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true">{icon}</span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-foreground">
          <span className="truncate">{title}</span>
          <ScopeChip scope={scope} />
          {status}
        </span>
        <span className="text-[10px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </div>
    <div className="flex shrink-0 items-center gap-1.5">
      {hint}
      {control}
    </div>
  </div>
)

export interface NotificationsCardProps {
  notifyOnLoginEnabled: boolean
  onToggleNotifyOnLogin: (checked: boolean) => void
  pushEnabled: boolean
  pushSupported: boolean
  pushLoading: boolean
  deviceBusy: boolean
  categoryAlertsBusy: boolean
  pushGuidance?: string | null
  onTogglePushEnabled: (checked: boolean) => void
  categoryAlertsEnabled: boolean
  onToggleCategoryAlerts: (checked: boolean) => void
  /** False when no category has a spending guide to alert on yet. */
  hasSpendingGuides: boolean
  onNavigateToCategoryLimits?: () => void
}

export const NotificationsCard: React.FC<NotificationsCardProps> = (props) => {
  const anyBusy = props.deviceBusy || props.categoryAlertsBusy || props.pushLoading
  const deviceUnavailable = !props.pushSupported
  // Category alerts are account-wide but undeliverable without a device, and the server refuses
  // to store the consent without one. The switch used to quietly enable this device first --
  // a browser permission prompt raised by a control that never mentioned devices or permission.
  const categoryAlertsBlocked = deviceUnavailable || !props.pushEnabled
  // At most one line of explanation under the alerts row. Both conditions can hold at once, and
  // rendering both stacked two caveats under a switch that is already disabled -- only the reason
  // it cannot be turned on right now is worth the line.
  const alertsNote = categoryAlertsBlocked && props.pushSupported
    ? CATEGORY_ALERTS_NEED_DEVICE
    : !props.hasSpendingGuides
      ? 'You have not set a planned amount for any category yet, so there is nothing to alert on.'
      : null

  return (
    <section
      aria-labelledby="settings-notifications-heading"
      className="app-panel rounded-2xl border border-border/60 bg-card/92 p-5 space-y-4"
    >
      <div className="border-b border-border/40 pb-3">
        <h3 id="settings-notifications-heading" className="text-sm font-bold text-foreground">Notifications</h3>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          Choose what you are told about, and on which devices.
        </p>
      </div>

      <div className="space-y-3">
        <NotificationRow
          icon={<BellRing className="size-4" />}
          title="Notifications on this device"
          scope={SCOPE_THIS_DEVICE}
          description={PUSH_DESCRIPTION}
          status={<RowSyncStatus isSyncing={props.deviceBusy} entityLabel="device notifications" />}
          hint={
            <InfoHint
              label="How notifications are turned on"
              text="Each device is set up separately, even on the same account. A phone only shows notifications once you turn this on while using that phone, and your browser has to allow them."
            />
          }
          control={
            <ToggleButton
              active={props.pushEnabled}
              onClick={() => props.onTogglePushEnabled(!props.pushEnabled)}
              label="Notifications on this device"
              disabled={anyBusy || deviceUnavailable}
            />
          }
        />

        {/* amber-500 is aliased to --ledger-pending-500 in index.css, so this is the theme's own
            "needs attention" gold rather than a raw Tailwind palette colour. */}
        {props.pushGuidance && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-amber-500"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 text-xs font-medium leading-relaxed">{props.pushGuidance}</p>
          </div>
        )}

        {/* Everything here depends on the switch above, and the left rule is what says so. */}
        <div className="ml-2 space-y-2 border-l border-border/50 pl-3">
          <NotificationRow
            icon={<Gauge className="size-4" />}
            title="Category spending alerts"
            scope={SCOPE_ALL_DEVICES}
            description={CATEGORY_LIMIT_PUSH_DESCRIPTION}
            status={<RowSyncStatus isSyncing={props.categoryAlertsBusy} entityLabel="spending alerts" />}
            control={
              <ToggleButton
                active={props.categoryAlertsEnabled}
                onClick={() => props.onToggleCategoryAlerts(!props.categoryAlertsEnabled)}
                label="Category spending alerts"
                disabled={anyBusy || categoryAlertsBlocked}
              />
            }
          />

          {alertsNote && <p className="text-[10px] font-medium text-muted-foreground">{alertsNote}</p>}

          {/* Only offered when there is nothing to watch, which is the one state where it is the
              fix rather than a permanent extra link under a working switch. */}
          {!props.hasSpendingGuides && props.onNavigateToCategoryLimits && (
            <Button
              variant="unstyled"
              type="button"
              onClick={props.onNavigateToCategoryLimits}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-ink hover:underline"
            >
              Set planned amounts per category <ChevronRight className="size-3" aria-hidden="true" />
            </Button>
          )}
        </div>

        <NotificationRow
          icon={<Bell className="size-4" />}
          title="Bill alerts when you open the app"
          scope={SCOPE_THIS_DEVICE}
          description={NOTIFY_ON_LOGIN_DESCRIPTION}
          control={
            <ToggleButton
              active={props.notifyOnLoginEnabled}
              onClick={() => props.onToggleNotifyOnLogin(!props.notifyOnLoginEnabled)}
              label="Bill alerts when you open the app"
            />
          }
        />

        {/* The device roster is reference material, not a control: it answers "which browsers did
            I ever turn this on in", which is a question people ask occasionally and never on the
            way to changing a setting. Left open it was the tallest thing in the panel. */}
        <details className="group border-t border-border/30 pt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground transition hover:text-foreground">
            <ChevronRight className="size-3 transition-transform group-open:rotate-90" aria-hidden="true" />
            Devices set up
          </summary>
          <div className="pt-2">
            <PushDevicesList refreshKey={props.pushEnabled ? 1 : 0} />
          </div>
        </details>
      </div>
    </section>
  )
}
