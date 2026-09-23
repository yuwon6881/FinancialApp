import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNativePushActions } from './useNativePushActions'

const native = vi.hoisted(() => ({
  onAction: null as ((data: unknown) => void) | null,
  listen: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }))
vi.mock('../lib/push/nativeMessaging', () => ({
  listenForNativePushActions: (callback: (data: unknown) => void) => {
    native.onAction = callback
    return Promise.resolve(vi.fn())
  },
}))

describe('native notification routing', () => {
  beforeEach(() => {
    native.onAction = null
    vi.clearAllMocks()
  })

  it('keeps a cold-start tap pending until both the app gate and server session check pass', async () => {
    const verifySession = vi.fn().mockResolvedValue(true)
    const openRecurringPayment = vi.fn()
    const handlers = { verifySession, openRecurringPayment, openCategoryAlerts: vi.fn() }
    const { rerender } = renderHook(
      ({ eligible }) => useNativePushActions(eligible, handlers),
      { initialProps: { eligible: false } },
    )
    await waitFor(() => expect(native.onAction).toBeTypeOf('function'))

    await act(async () => native.onAction?.({
      kind: 'recurring-payment',
      recurringPaymentId: 'rp-1',
      occurrenceDate: '2026-09-23',
    }))
    expect(verifySession).not.toHaveBeenCalled()
    expect(openRecurringPayment).not.toHaveBeenCalled()

    rerender({ eligible: true })
    await waitFor(() => expect(openRecurringPayment).toHaveBeenCalledWith('rp-1'))
    expect(verifySession).toHaveBeenCalledOnce()
  })

  it('ignores malformed and unauthorized notification routes', async () => {
    const verifySession = vi.fn().mockResolvedValue(false)
    const openRecurringPayment = vi.fn()
    const openCategoryAlerts = vi.fn()
    const handlers = { verifySession, openRecurringPayment, openCategoryAlerts }
    renderHook(() => useNativePushActions(true, handlers))
    await waitFor(() => expect(native.onAction).toBeTypeOf('function'))

    await act(async () => {
      native.onAction?.({ kind: 'recurring-payment', recurringPaymentId: 'rp-1', occurrenceDate: 'bad-date' })
      native.onAction?.({ kind: 'category-limit', cycleKey: 'not-a-cycle' })
      native.onAction?.({ kind: 'category-limit', cycleKey: '2026-09' })
    })

    await waitFor(() => expect(verifySession).toHaveBeenCalledOnce())
    expect(openRecurringPayment).not.toHaveBeenCalled()
    expect(openCategoryAlerts).not.toHaveBeenCalled()
  })
})
