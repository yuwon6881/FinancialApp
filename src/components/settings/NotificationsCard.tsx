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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BellRing className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span className="truncate">Notifications on this device</span>
                <ScopeChip scope={SCOPE_THIS_DEVICE} />
                <RowSyncStatus isSyncing={props.deviceBusy} entityLabel="device notifications" />
              </span>
              <span className="text-[10px] leading-relaxed text-muted-foreground">{PUSH_DESCRIPTION}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <InfoHint
              label="How notifications are turned on"
              text="Each device is set up separately, even on the same account. A phone only shows notifications once you turn this on while using that phone, and your browser has to allow them."
            />
            <ToggleButton
              active={props.pushEnabled}
              onClick={() => props.onTogglePushEnabled(!props.pushEnabled)}
              label="Notifications on this device"
              disabled={anyBusy || deviceUnavailable}
            />
          </div>
        </div>

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

        {/* Everything below depends on the switch above, and the left rule is what says so. */}
        <div className="ml-2 space-y-2 border-l border-border/50 pl-3 pt-1">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <Gauge className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="truncate">Category spending alerts</span>
                <ScopeChip scope={SCOPE_ALL_DEVICES} />
                <RowSyncStatus isSyncing={props.categoryAlertsBusy} entityLabel="spending alerts" />
              </span>
              <span className="text-[10px] leading-relaxed text-muted-foreground">
                {CATEGORY_LIMIT_PUSH_DESCRIPTION}
              </span>
            </div>
            <ToggleButton
              active={props.categoryAlertsEnabled}
              onClick={() => props.onToggleCategoryAlerts(!props.categoryAlertsEnabled)}
              label="Category spending alerts"
              disabled={anyBusy || categoryAlertsBlocked}
            />
          </div>

          {categoryAlertsBlocked && props.pushSupported && (
            <p className="text-[10px] font-medium text-muted-foreground">{CATEGORY_ALERTS_NEED_DEVICE}</p>
          )}

          {/* An alert can only fire for a category that has an amount to compare against, so
              switching this on with none set up is a promise nothing will ever keep. */}
          {!props.hasSpendingGuides && (
            <p className="text-[10px] font-medium text-muted-foreground">
              You have not set a planned amount for any category yet, so there is nothing to alert on.
            </p>
          )}

          {props.onNavigateToCategoryLimits && (
            <Button
              variant="unstyled"
              type="button"
              onClick={props.onNavigateToCategoryLimits}
              className="inline-flex items-center gap-1 text-[10px] font-bold text-accent-ink hover:underline"
            >
              Set planned amounts per category <ChevronRight className="size-3" aria-hidden="true" />
            </Button>
          )}

          <div className="pt-1">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              Devices set up
            </p>
            <PushDevicesList refreshKey={props.pushEnabled ? 1 : 0} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/20 pt-3 text-sm">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Bell className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-2 font-medium text-foreground">
                <span className="truncate">Bill alerts when you open the app</span>
                <ScopeChip scope={SCOPE_THIS_DEVICE} />
              </span>
              <span className="text-[10px] leading-relaxed text-muted-foreground">{NOTIFY_ON_LOGIN_DESCRIPTION}</span>
            </div>
          </div>
          <ToggleButton
            active={props.notifyOnLoginEnabled}
            onClick={() => props.onToggleNotifyOnLogin(!props.notifyOnLoginEnabled)}
            label="Bill alerts when you open the app"
          />
        </div>
      </div>
    </section>
  )
}
