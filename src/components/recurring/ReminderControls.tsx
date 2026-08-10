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
    <div className="mt-4 border-t border-border/30 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 shrink-0">
          <Bell className="size-3 text-blue-500" /> Payment Reminder
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
                <p className="mb-2 text-[10px] font-semibold text-amber-500">{RECURRING_PAUSED_LABEL}</p>
              )}
              {otherDevicesOnly && (
                <p className="mb-2 text-[10px] font-semibold text-amber-500">{RECURRING_OTHER_DEVICES_ONLY_LABEL}</p>
              )}

              <div role="radiogroup" aria-label={`Reminder frequency for ${payment.name}`} className="flex gap-1.5">
                {(['Once', 'Daily'] as RecurringReminderMode[]).map(mode => (
                  <Button variant="unstyled"
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={draftSettings.mode === mode}
                    disabled={disabled || paused || isSyncing}
                    onClick={() => handleModeChange(mode)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      draftSettings.mode === mode ? 'bg-blue-500/10 border-blue-500/40 text-blue-500' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {mode}
                  </Button>
                ))}
              </div>

              <div role="radiogroup" aria-label={`Lead time for ${payment.name}`} className="mt-2 flex gap-1.5">
                {REMINDER_LEAD_DAY_OPTIONS.map(leadDays => (
                  <Button variant="unstyled"
                    key={leadDays}
                    type="button"
                    role="radio"
                    aria-checked={draftSettings.leadDays === leadDays}
                    disabled={disabled || paused || isSyncing}
                    onClick={() => handleLeadDaysChange(leadDays)}
                    className={`size-7 rounded-lg text-[10px] font-semibold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      draftSettings.leadDays === leadDays ? 'bg-blue-500/10 border-blue-500/40 text-blue-500' : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {leadDays}d
                  </Button>
                ))}
              </div>

              <p className="mt-2 text-[10px] text-muted-foreground">{buildReminderPreview(draftSettings.mode, draftSettings.leadDays)}</p>
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
            <div className="pt-2 border-t border-border/20 flex items-center justify-between gap-2">
              <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-amber-500 inline-block animate-pulse" />
                Unsaved changes
              </span>
              <div className="flex items-center gap-1.5">
                <Button variant="unstyled"
                  type="button"
                  disabled={disabled || isSyncing}
                  onClick={handleCancel}
                  className="px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:bg-muted transition cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </Button>
                <Button variant="unstyled"
                  type="button"
                  disabled={disabled || isSyncing}
                  onClick={handleSave}
                  className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary hover:bg-primary/90 active:bg-primary/90 text-primary-foreground flex items-center gap-1 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSyncing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
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
