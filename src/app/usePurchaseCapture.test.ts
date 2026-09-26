import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { capturePrefill, usePurchaseCapture } from './usePurchaseCapture'
import type { PurchaseCapture } from '../lib/native/purchaseCapture'

const mocks = vi.hoisted(() => ({
  activate: vi.fn(), state: vi.fn(), consumeTap: vi.fn(), update: vi.fn(),
  addListener: vi.fn(async () => ({ remove: vi.fn() })),
}))
vi.mock('../lib/native/purchaseCapture', () => ({ supportsPurchaseCapture: () => true, PurchaseCapturePlugin: mocks }))
vi.mock('@capacitor/app', () => ({ App: { addListener: mocks.addListener } }))

const candidate = { id: 'capture', transactionId: 'transaction', sourceLabel: 'Bank', amount: '12.50', currency: 'MYR', description: 'Cafe', possibleDuplicate: false } as PurchaseCapture
const snapshot = { candidates: [candidate], packages: ['bank'], enabled: true, access: true, notifications: true, tapId: 'capture' }

describe('purchase capture routing', () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.state.mockResolvedValue(snapshot); mocks.activate.mockResolvedValue(undefined) })
  it('keeps notification taps pending until unlocked', async () => {
    const open = vi.fn()
    const options = { owner: 'one', eligible: false, hidden: false, formOpen: false, currency: 'MYR', reveal: vi.fn(), open, enqueue: vi.fn() }
    const { rerender } = renderHook(({ eligible }) => usePurchaseCapture({ ...options, eligible }), { initialProps: { eligible: false } })
    await waitFor(() => expect(mocks.state).toHaveBeenCalled())
    expect(open).not.toHaveBeenCalled()
    expect(mocks.consumeTap).not.toHaveBeenCalled()
    rerender({ eligible: true })
    await waitFor(() => expect(open).toHaveBeenCalledWith(expect.objectContaining({ captureId: 'capture', amount: '12.50' })))
    expect(mocks.consumeTap).toHaveBeenCalledWith({ owner: 'one' })
  })
  it('does not reveal a capture or consume its tap in sensitive mode', async () => {
    const reveal = vi.fn(), open = vi.fn()
    renderHook(() => usePurchaseCapture({ owner: 'one', eligible: true, hidden: true, formOpen: false, currency: 'MYR', reveal, open, enqueue: vi.fn() }))
    await waitFor(() => expect(reveal).toHaveBeenCalledTimes(1))
    expect(open).not.toHaveBeenCalled()
    expect(mocks.consumeTap).not.toHaveBeenCalled()
  })
  it('does not replace an existing financial form with a captured purchase', async () => {
    const open = vi.fn()
    const { result } = renderHook(() => usePurchaseCapture({ owner: 'one', eligible: true, hidden: false, formOpen: true, currency: 'MYR', reveal: vi.fn(), open, enqueue: vi.fn() }))
    await act(async () => { await result.current.refresh() })
    expect(open).not.toHaveBeenCalled()
    expect(mocks.consumeTap).not.toHaveBeenCalled()
  })
  it('suspends capture ownership on sign-out', async () => {
    const { rerender } = renderHook(({ owner }) => usePurchaseCapture({ owner, eligible: false, hidden: false, formOpen: false, currency: 'MYR', reveal: vi.fn(), open: vi.fn(), enqueue: vi.fn() }), { initialProps: { owner: 'one' as string | null } })
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledWith({ owner: 'one' }))
    rerender({ owner: null })
    await waitFor(() => expect(mocks.activate).toHaveBeenCalledWith({ owner: null }))
  })
  it('leaves mismatched or unknown currency amounts blank', () => {
    expect(capturePrefill(candidate, 'USD').amount).toBeUndefined()
    expect(capturePrefill({ ...candidate, currency: undefined }, 'MYR').amount).toBeUndefined()
    expect(capturePrefill({ ...candidate, edits: { amount: '9.50' } }, 'USD').amount).toBe('9.50')
  })
})
