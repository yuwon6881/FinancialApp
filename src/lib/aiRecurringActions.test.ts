import { describe, expect, it, vi } from 'vitest'
import { dispatchAiRecurringSettingAction } from './aiRecurringActions'

const payment = {
  id: 'recurring-1',
  name: 'Internet',
  active: true,
  reminderEnabled: false,
  reminderMode: 'Once',
  reminderLeadDays: 3,
}

function dependencies() {
  return {
    allRecurringPayments: [payment],
    handleToggleActive: vi.fn(),
    handleUpdateReminder: vi.fn(),
    navigate: vi.fn(),
    setConfirmModalData: vi.fn(),
    showToast: vi.fn(),
  }
}

describe('AI recurring mutation feedback', () => {
  it('leaves toggle success and Undo feedback to the outbox', () => {
    const deps = dependencies()
    dispatchAiRecurringSettingAction({ type: 'toggleRecurring', payload: { id: payment.id, active: false } } as any, deps as any)

    deps.setConfirmModalData.mock.calls[0][0].onConfirm()

    expect(deps.handleToggleActive).toHaveBeenCalledWith(payment.id)
    expect(deps.navigate).toHaveBeenCalled()
    expect(deps.showToast).not.toHaveBeenCalled()
  })

  it('leaves reminder success and Undo feedback to the outbox', () => {
    const deps = dependencies()
    dispatchAiRecurringSettingAction({ type: 'updateRecurringReminder', payload: { id: payment.id, enabled: true, leadDays: 7 } } as any, deps as any)

    deps.setConfirmModalData.mock.calls[0][0].onConfirm()

    expect(deps.handleUpdateReminder).toHaveBeenCalledWith(payment.id, { enabled: true, mode: 'Once', leadDays: 7 })
    expect(deps.navigate).toHaveBeenCalled()
    expect(deps.showToast).not.toHaveBeenCalled()
  })
})
