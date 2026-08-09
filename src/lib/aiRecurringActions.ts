import type { AiUiAction } from './api/ai'
import type { AiActionsDeps } from './aiActions'
import { buildMutationSuccessToast } from './mutationToast'
import { REMINDER_LEAD_DAY_OPTIONS } from './recurringPayments'

type RecurringActionDeps = Pick<
  AiActionsDeps,
  'allRecurringPayments' | 'handleToggleActive' | 'handleUpdateReminder' | 'navigate' | 'setConfirmModalData' | 'showToast'
>

const stringField = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const numberField = (payload: Record<string, unknown>, key: string) => {
  const value = payload[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function dispatchAiRecurringSettingAction(action: AiUiAction, deps: RecurringActionDeps): string | null {
  if (action.type !== 'toggleRecurring' && action.type !== 'updateRecurringReminder') return null

  const payload = action.payload
  const id = stringField(payload, 'id')
  const payment = id ? deps.allRecurringPayments.find(candidate => String(candidate.id) === id) : undefined
  if (!payment) {
    deps.showToast(
      'That recurring payment could not be found.',
      action.type === 'toggleRecurring' ? 'Toggle unavailable' : 'Reminder unavailable',
      'warning',
    )
    return null
  }

  if (action.type === 'toggleRecurring') {
    const requestedActive = typeof payload.active === 'boolean' ? payload.active : !payment.active
    if (payment.active === requestedActive) {
      deps.showToast(`"${payment.name}" is already ${requestedActive ? 'on' : 'off'}.`, 'No change needed', 'info')
      return payment.id
    }
    deps.setConfirmModalData({
      title: requestedActive ? 'Resume Recurring Payment' : 'Pause Recurring Payment',
      message: `${requestedActive ? 'Resume' : 'Pause'} "${payment.name}"?`,
      confirmText: requestedActive ? 'Resume' : 'Pause',
      onConfirm: () => {
        deps.handleToggleActive(payment.id)
        const copy = buildMutationSuccessToast({
          entity: 'Recurring Payment',
          action: requestedActive ? 'Resumed' : 'Paused',
          recordName: payment.name,
          messageVerb: requestedActive ? 'resumed' : 'paused',
        })
        deps.showToast(copy.message, copy.title, copy.tone)
        deps.navigate({ tab: 'recurring', recurringId: payment.id })
      },
    })
    return payment.id
  }

  if (typeof payload.enabled !== 'boolean') {
    deps.showToast('The AI did not say whether to turn the reminder on or off.', 'Reminder unchanged', 'warning')
    return payment.id
  }
  const enabled = payload.enabled
  const requestedMode = stringField(payload, 'reminderMode')
  const requestedLeadDays = numberField(payload, 'leadDays')
  const settings = {
    enabled,
    mode: requestedMode === 'Once' || requestedMode === 'Daily' ? requestedMode : (payment.reminderMode ?? 'Once'),
    leadDays: requestedLeadDays != null && REMINDER_LEAD_DAY_OPTIONS.includes(requestedLeadDays)
      ? requestedLeadDays
      : (payment.reminderLeadDays ?? 3),
  } as const
  const unchanged = (payment.reminderEnabled ?? false) === settings.enabled &&
    (!settings.enabled || ((payment.reminderMode ?? 'Once') === settings.mode && (payment.reminderLeadDays ?? 3) === settings.leadDays))
  if (unchanged) {
    deps.showToast(`"${payment.name}" already uses those reminder settings.`, 'No change needed', 'info')
    return payment.id
  }

  deps.setConfirmModalData({
    title: 'Update Recurring Reminder',
    message: settings.enabled
      ? `Turn on a ${settings.mode === 'Daily' ? 'daily' : 'one-time'} reminder for "${payment.name}", ${settings.leadDays} day${settings.leadDays === 1 ? '' : 's'} before it is due?`
      : `Turn off reminders for "${payment.name}"?`,
    confirmText: 'Update Reminder',
    onConfirm: () => {
      deps.handleUpdateReminder(payment.id, { ...settings })
      const copy = buildMutationSuccessToast({
        entity: 'Recurring Payment',
        action: 'Updated',
        recordName: payment.name,
        messageSuffix: settings.enabled
          ? `Reminder is on — ${settings.mode === 'Daily' ? 'daily' : 'once'}, ${settings.leadDays} day${settings.leadDays === 1 ? '' : 's'} before it is due.`
          : 'Reminder is off.',
      })
      deps.showToast(copy.message, copy.title, copy.tone)
      deps.navigate({ tab: 'recurring', recurringId: payment.id })
    },
  })
  return payment.id
}
