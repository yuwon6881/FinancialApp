import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Check, Loader2 } from 'lucide-react'
import type { RecurringPayment, RecurringReminderMode, RecurringReminderSettings } from '../../types'
import { buildReminderPreview, getEffectiveReminderSettings, REMINDER_LEAD_DAY_OPTIONS } from '../../lib/recurringPayments'
import { RECURRING_PAUSED_LABEL } from '../../lib/push/messages'
import { ToggleButton } from '../ui/ToggleButton'

interface ReminderControlsProps {
  payment: Pick<RecurringPayment, 'id' | 'name' | 'reminderEnabled' | 'reminderMode' | 'reminderLeadDays'>
  globalPushEnabled: boolean
  disabled?: boolean
  isSyncing?: boolean
  onUpdateReminder?: (id: string, settings: RecurringReminderSettings) => void
}

export const ReminderControls: React.FC<ReminderControlsProps> = ({
  payment,
  globalPushEnabled,
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

  const paused = draftSettings.enabled && !globalPushEnabled

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
          <motion.div
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

              <div role="radiogroup" aria-label={`Reminder frequency for ${payment.name}`} className="flex gap-1.5">
                {(['Once', 'Daily'] as RecurringReminderMode[]).map(mode => (
                  <button
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
                  </button>
                ))}
              </div>

              <div role="radiogroup" aria-label={`Lead time for ${payment.name}`} className="mt-2 flex gap-1.5">
                {REMINDER_LEAD_DAY_OPTIONS.map(leadDays => (
                  <button
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
                  </button>
                ))}
              </div>

              <p className="mt-2 text-[10px] text-muted-foreground">{buildReminderPreview(draftSettings.mode, draftSettings.leadDays)}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDirty && (
          <motion.div
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
                <button
                  type="button"
                  disabled={disabled || isSyncing}
                  onClick={handleCancel}
                  className="px-2 py-1 rounded-md text-[10px] font-medium text-muted-foreground hover:bg-muted transition cursor-pointer disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={disabled || isSyncing}
                  onClick={handleSave}
                  className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white flex items-center gap-1 transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSyncing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Check className="size-3" />
                  )}
                  Save Reminder
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
