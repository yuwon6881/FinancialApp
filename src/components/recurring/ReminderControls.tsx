import React from 'react'
import { Bell } from 'lucide-react'
import type { RecurringPayment, RecurringReminderMode, RecurringReminderSettings } from '../../types'
import { buildReminderPreview, DEFAULT_REMINDER_SETTINGS, getEffectiveReminderSettings, REMINDER_LEAD_DAY_OPTIONS } from '../../lib/recurringPayments'
import { RECURRING_PAUSED_LABEL } from '../../lib/push/messages'
import { ToggleButton } from '../ui/ToggleButton'

interface ReminderControlsProps {
  payment: Pick<RecurringPayment, 'id' | 'name' | 'reminderEnabled' | 'reminderMode' | 'reminderLeadDays'>
  globalPushEnabled: boolean
  disabled?: boolean
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
}

export const ReminderControls: React.FC<ReminderControlsProps> = ({ payment, globalPushEnabled, disabled, onUpdateReminder }) => {
  const settings = getEffectiveReminderSettings(payment)
  const paused = settings.enabled && !globalPushEnabled

  const emit = (next: RecurringReminderSettings) => onUpdateReminder?.(payment.id, next)

  const handleToggle = () => {
    if (settings.enabled) {
      emit({ ...settings, enabled: false })
    } else {
      emit({ ...DEFAULT_REMINDER_SETTINGS, enabled: true })
    }
  }

  const handleModeChange = (mode: RecurringReminderMode) => {
    if (mode === settings.mode) return
    emit({ ...settings, mode })
  }

  const handleLeadDaysChange = (leadDays: number) => {
    if (leadDays === settings.leadDays) return
    emit({ ...settings, leadDays })
  }

  return (
    <div className="mt-4 border-t border-border/30 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground flex items-center gap-1.5 shrink-0">
          <Bell className="size-3 text-blue-500" /> Payment Reminder
        </span>
        <ToggleButton
          active={settings.enabled}
          onClick={handleToggle}
          label={`Turn ${settings.enabled ? 'off' : 'on'} payment reminder for ${payment.name}`}
          disabled={disabled}
          className="size-6"
        />
      </div>

      {settings.enabled && (
        <div className={paused ? 'opacity-50' : undefined}>
          {paused && (
            <p className="mb-2 text-[10px] font-semibold text-amber-500">{RECURRING_PAUSED_LABEL}</p>
          )}

          <div role="radiogroup" aria-label={`Reminder frequency for ${payment.name}`} className="flex gap-1.5">
            {(['Once', 'Daily'] as RecurringReminderMode[]).map(mode => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={settings.mode === mode}
                disabled={disabled || paused}
                onClick={() => handleModeChange(mode)}
                className={`px-2 py-1 rounded-lg text-[10px] font-semibold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  settings.mode === mode ? 'bg-blue-500/10 border-blue-500/40 text-blue-500' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>

          <div role="radiogroup" aria-label={`Lead time for ${payment.name}`} className="mt-2 flex gap-1.5">
            {REMINDER_LEAD_DAY_OPTIONS.map(leadDays => (
              <button
                key={leadDays}
                type="button"
                role="radio"
                aria-checked={settings.leadDays === leadDays}
                disabled={disabled || paused}
                onClick={() => handleLeadDaysChange(leadDays)}
                className={`size-7 rounded-lg text-[10px] font-semibold border transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  settings.leadDays === leadDays ? 'bg-blue-500/10 border-blue-500/40 text-blue-500' : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {leadDays}d
              </button>
            ))}
          </div>

          <p className="mt-2 text-[10px] text-muted-foreground">{buildReminderPreview(settings.mode, settings.leadDays)}</p>
        </div>
      )}
    </div>
  )
}
