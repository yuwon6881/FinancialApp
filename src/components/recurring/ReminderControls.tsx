import React, { useState } from 'react'
import { Button } from '../ui/Button'
import { m, AnimatePresence } from 'framer-motion'
import { Bell, Check, Loader2 } from 'lucide-react'
import type { RecurringPayment, RecurringReminderMode, RecurringReminderSettings } from '../../types'
import { buildReminderPreview, getEffectiveReminderSettings, REMINDER_LEAD_DAY_OPTIONS } from '../../lib/recurringPayments'
import { RECURRING_OTHER_DEVICES_ONLY_LABEL, RECURRING_PAUSED_LABEL } from '../../lib/push/messages'
import { ToggleButton } from '../ui/ToggleButton'

interface ReminderControlsProps {
  payment: Pick<RecurringPayment, 'id' | 'name' | 'reminderEnabled' | 'reminderMode' | 'reminderLeadDays'>
  /**
   * True when any device on the account is opted into **bill reminders** specifically. A device
   * that only asked for spending alerts is registered but would never deliver this schedule, so
   * counting it here would be exactly the false reassurance these two props exist to prevent.
   */
  globalPushEnabled: boolean
  /** True when the device being looked at right now is one of them. */
  thisDevicePushEnabled?: boolean
  disabled?: boolean
  isSyncing?: boolean
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
}

export const ReminderControls: React.FC<ReminderControlsProps> = ({
  payment,
  globalPushEnabled,
  thisDevicePushEnabled = true,
  disabled,
  isSyncing,
  onUpdateReminder,
}) => {
  const savedSettings = getEffectiveReminderSettings(payment)
  const [draftSettings, setDraftSettings] = useState<RecurringReminderSettings>(savedSettings)

  const currentSavedKey = `${savedSettings.enabled}-${savedSettings.mode}-${savedSettings.leadDays}`
  const [prevSavedKey, setPrevSavedKey] = useState(currentSavedKey)

  if (prevSavedKey !== currentSavedKey) {
    setPrevSavedKey(currentSavedKey)
    setDraftSettings(savedSettings)
  }

  const isDirty =
    draftSettings.enabled !== savedSettings.enabled ||
    (draftSettings.enabled && (
      draftSettings.mode !== savedSettings.mode ||
      draftSettings.leadDays !== savedSettings.leadDays
    ))

  // Nothing at all will be delivered, anywhere: the schedule is inert.
  const paused = draftSettings.enabled && !globalPushEnabled
  // The reminder does work, just not on the screen being looked at. Reading this state as plain
  // "on" told someone holding a phone with notifications off that their bill would ring on it.
  const otherDevicesOnly = draftSettings.enabled && globalPushEnabled && !thisDevicePushEnabled

  const handleToggle = () => {
    if (draftSettings.enabled) {
      setDraftSettings(prev => ({ ...prev, enabled: false }))
    } else {
      setDraftSettings(prev => ({ ...prev, enabled: true }))
    }
  }

  const handleModeChange = (mode: RecurringReminderMode) => {
    setDraftSettings(prev => ({ ...prev, mode }))
  }

  const handleLeadDaysChange = (leadDays: number) => {
    setDraftSettings(prev => ({ ...prev, leadDays }))
  }

  const handleSave = () => {
    onUpdateReminder?.(payment.id, draftSettings)
  }

  const handleCancel = () => {
    setDraftSettings(savedSettings)
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between">
        <span className="flex shrink-0 items-center gap-1.5 text-label text-muted-foreground">
          <Bell className="size-3.5" aria-hidden="true" /> Payment Reminder
        </span>
        <ToggleButton
          active={draftSettings.enabled}
          onClick={handleToggle}
          label={`Turn ${draftSettings.enabled ? 'off' : 'on'} payment reminder for ${payment.name}`}
          disabled={disabled || isSyncing}
          className="size-6"
        />
      </div>

      <AnimatePresence initial={false}>
        {draftSettings.enabled && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-2"
          >
            <div className={paused ? 'opacity-50' : undefined}>
              {paused && (
                <p className="mb-2 text-caption font-medium text-amber-700 dark:text-amber-300">{RECURRING_PAUSED_LABEL}</p>
              )}
              {otherDevicesOnly && (
                <p className="mb-2 text-caption font-medium text-amber-700 dark:text-amber-300">{RECURRING_OTHER_DEVICES_ONLY_LABEL}</p>
              )}

              <div role="radiogroup" aria-label={`Reminder frequency for ${payment.name}`} className="inline-flex gap-1 rounded-full bg-surface-2 p-1">
                {(['Once', 'Daily'] as RecurringReminderMode[]).map(mode => (
                  <Button variant="tertiary" size="sm"
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={draftSettings.mode === mode}
                    disabled={disabled || paused || isSyncing}
                    onClick={() => handleModeChange(mode)}
                    className={`min-h-8 px-3 text-label font-medium disabled:opacity-40 lg:min-h-8 ${
                      draftSettings.mode === mode ? 'bg-card text-foreground shadow-(--app-shadow) ring-1 ring-border/60 hover:bg-card' : 'text-muted-foreground hover:bg-transparent hover:text-foreground'
                    }`}
                  >
                    {mode}
                  </Button>
                ))}
              </div>

              <div role="radiogroup" aria-label={`Lead time for ${payment.name}`} className="mt-2 flex flex-wrap gap-1.5">
                {REMINDER_LEAD_DAY_OPTIONS.map(leadDays => (
                  <Button variant="tertiary"
                    key={leadDays}
                    // The icon size is the padding-free one; the control scale's px-4 leaves a
                    // 28px square no room for its own label.
                    size="icon"
                    type="button"
                    role="radio"
                    aria-checked={draftSettings.leadDays === leadDays}
                    disabled={disabled || paused || isSyncing}
                    onClick={() => handleLeadDaysChange(leadDays)}
                    className={`h-8 w-10 rounded-full border text-caption font-medium tabular-nums disabled:opacity-40 lg:size-auto lg:h-8 lg:w-10 ${
                      draftSettings.leadDays === leadDays ? 'border-transparent bg-primary/12 text-accent-ink hover:bg-primary/12' : 'border-border/70 text-muted-foreground hover:bg-surface-2'
                    }`}
                  >
                    {leadDays}d
                  </Button>
                ))}
              </div>

              <p className="mt-2 text-caption text-muted-foreground">{buildReminderPreview(draftSettings.mode, draftSettings.leadDays)}</p>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDirty && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 pt-2">
              <span role="status" aria-label="Unsaved changes" title="Unsaved changes" className="flex items-center">
                <span className="size-2 rounded-full bg-amber-500 inline-block animate-pulse shrink-0" />
                <span className="sr-only">Unsaved changes</span>
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="tertiary"
                  size="sm"
                  type="button"
                  disabled={disabled || isSyncing}
                  onClick={handleCancel}
                  className="whitespace-nowrap text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  type="button"
                  disabled={disabled || isSyncing}
                  onClick={handleSave}
                  className="whitespace-nowrap"
                >
                  {isSyncing ? (
                    <Loader2 className="size-3 animate-spin mr-1" />
                  ) : (
                    <Check className="size-3 mr-1" />
                  )}
                  Save Reminder
                </Button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
